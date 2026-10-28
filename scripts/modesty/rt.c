// BVH ray caster for scripts/modesty/rt.py (ctypes): first hit per ray, optional
// back-face culling, and whether the hit face is seen from its front (CCW) side.
// Compiled on first use to .cache/modesty/rt.dylib.
#include <stdlib.h>
#include <math.h>
#include <string.h>

typedef struct { double lo[3], hi[3]; int left, right, start, count; } Node;
typedef struct { const double *V; const int *T; int nt; int *order; Node *nodes; int nn; double *c; } BVH;

static void tri_box(const BVH *b, int t, double lo[3], double hi[3]) {
  for (int k = 0; k < 3; k++) { lo[k] = 1e30; hi[k] = -1e30; }
  for (int j = 0; j < 3; j++) { const double *p = b->V + 3 * b->T[3 * t + j];
    for (int k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; } }
}
static int build(BVH *b, int start, int count) {
  int id = b->nn++;
  Node *n = &b->nodes[id];
  for (int k = 0; k < 3; k++) { n->lo[k] = 1e30; n->hi[k] = -1e30; }
  double clo[3] = {1e30, 1e30, 1e30}, chi[3] = {-1e30, -1e30, -1e30};
  for (int i = start; i < start + count; i++) { int t = b->order[i]; double lo[3], hi[3]; tri_box(b, t, lo, hi);
    for (int k = 0; k < 3; k++) { if (lo[k] < n->lo[k]) n->lo[k] = lo[k]; if (hi[k] > n->hi[k]) n->hi[k] = hi[k];
      double c = b->c[3 * t + k]; if (c < clo[k]) clo[k] = c; if (c > chi[k]) chi[k] = c; } }
  n->start = start; n->count = count; n->left = n->right = -1;
  if (count <= 4) return id;
  int ax = 0; for (int k = 1; k < 3; k++) if (chi[k] - clo[k] > chi[ax] - clo[ax]) ax = k;
  double mid = 0.5 * (clo[ax] + chi[ax]);
  int i = start, j = start + count - 1;
  while (i <= j) { if (b->c[3 * b->order[i] + ax] < mid) i++; else { int tmp = b->order[i]; b->order[i] = b->order[j]; b->order[j] = tmp; j--; } }
  int nl = i - start;
  if (nl == 0 || nl == count) nl = count / 2;
  int l = build(b, start, nl); int r = build(b, start + nl, count - nl);
  b->nodes[id].left = l; b->nodes[id].right = r; b->nodes[id].count = 0;
  return id;
}
void *bvh_build(const double *V, const int *T, int nt) {
  BVH *b = calloc(1, sizeof(BVH)); b->V = V; b->T = T; b->nt = nt;
  b->order = malloc(sizeof(int) * (nt > 0 ? nt : 1)); b->nodes = malloc(sizeof(Node) * (2 * nt + 2)); b->c = malloc(sizeof(double) * 3 * (nt > 0 ? nt : 1));
  for (int t = 0; t < nt; t++) { b->order[t] = t; for (int k = 0; k < 3; k++) b->c[3 * t + k] = (V[3 * T[3 * t] + k] + V[3 * T[3 * t + 1] + k] + V[3 * T[3 * t + 2] + k]) / 3; }
  if (nt > 0) build(b, 0, nt);
  return b;
}
void bvh_free(void *h) { BVH *b = h; free(b->order); free(b->nodes); free(b->c); free(b); }
static int box_hit(const Node *n, const double o[3], const double inv[3], double tmax) {
  double t0 = 0, t1 = tmax;
  for (int k = 0; k < 3; k++) { double a = (n->lo[k] - o[k]) * inv[k], c = (n->hi[k] - o[k]) * inv[k];
    if (a > c) { double tmp = a; a = c; c = tmp; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return 0; }
  return 1;
}
// cull: 0 = both sides, 1 = only front faces (ray opposite to CCW normal), -1 = only back faces
static int tri_hit(const BVH *b, int t, const double o[3], const double d[3], double *tt, double *uu, double *vv, int cull) {
  const double *p0 = b->V + 3 * b->T[3 * t], *p1 = b->V + 3 * b->T[3 * t + 1], *p2 = b->V + 3 * b->T[3 * t + 2];
  double e1[3], e2[3], pv[3], tv[3], qv[3];
  for (int k = 0; k < 3; k++) { e1[k] = p1[k] - p0[k]; e2[k] = p2[k] - p0[k]; }
  pv[0] = d[1] * e2[2] - d[2] * e2[1]; pv[1] = d[2] * e2[0] - d[0] * e2[2]; pv[2] = d[0] * e2[1] - d[1] * e2[0];
  double det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2];
  if (fabs(det) < 1e-18) return 0;
  if (cull == 1 && det < 0) return 0;
  if (cull == -1 && det > 0) return 0;
  double inv = 1.0 / det;
  for (int k = 0; k < 3; k++) tv[k] = o[k] - p0[k];
  double u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) * inv; if (u < 0 || u > 1) return 0;
  qv[0] = tv[1] * e1[2] - tv[2] * e1[1]; qv[1] = tv[2] * e1[0] - tv[0] * e1[2]; qv[2] = tv[0] * e1[1] - tv[1] * e1[0];
  double v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) * inv; if (v < 0 || u + v > 1) return 0;
  double t_ = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) * inv;
  if (t_ <= 1e-9) return 0;
  *tt = t_; *uu = u; *vv = v; return 1;
}
// First hit per ray. out_tri = -1 when nothing is hit. out_front = 1 when the hit face's CCW normal faces the ray origin.
void bvh_cast(void *h, const double *O, const double *D, int nr, double tmax, int cull, int *out_tri, double *out_t, double *out_u, double *out_v, int *out_front) {
  BVH *b = h; int stack[256];
  for (int r = 0; r < nr; r++) {
    const double *o = O + 3 * r, *d = D + 3 * r; double inv[3];
    for (int k = 0; k < 3; k++) inv[k] = 1.0 / (fabs(d[k]) > 1e-300 ? d[k] : 1e-300);
    double best = tmax, bu = 0, bv = 0; int bt = -1; int sp = 0;
    if (b->nt > 0) stack[sp++] = 0;
    while (sp) { const Node *n = &b->nodes[stack[--sp]]; if (!box_hit(n, o, inv, best)) continue;
      if (n->left < 0) { for (int i = n->start; i < n->start + n->count; i++) { int t = b->order[i]; double tt, uu, vv;
          if (tri_hit(b, t, o, d, &tt, &uu, &vv, cull) && tt < best) { best = tt; bt = t; bu = uu; bv = vv; } } }
      else { stack[sp++] = n->left; stack[sp++] = n->right; } }
    out_tri[r] = bt; out_t[r] = bt >= 0 ? best : -1; out_u[r] = bu; out_v[r] = bv;
    if (bt >= 0) { const double *p0 = b->V + 3 * b->T[3 * bt], *p1 = b->V + 3 * b->T[3 * bt + 1], *p2 = b->V + 3 * b->T[3 * bt + 2];
      double e1[3], e2[3], nn[3]; for (int k = 0; k < 3; k++) { e1[k] = p1[k] - p0[k]; e2[k] = p2[k] - p0[k]; }
      nn[0] = e1[1] * e2[2] - e1[2] * e2[1]; nn[1] = e1[2] * e2[0] - e1[0] * e2[2]; nn[2] = e1[0] * e2[1] - e1[1] * e2[0];
      out_front[r] = (nn[0] * d[0] + nn[1] * d[1] + nn[2] * d[2]) < 0; }
    else out_front[r] = 0;
  }
}
