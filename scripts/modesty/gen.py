# The closed male groin for "성기 가리기" (src/modesty-skin.ts): which triangles
# of the male skin FMA7163 (public/models/skin.glb) the runtime leaves out, and
# the skin-coloured patch it draws in their place, so the default view shows a
# plain smooth crotch. Writes data/modesty-male-skin.json (contract in
# src/modesty-skin.ts; "method" and "limits" in the file say how and with what
# limits) and state.npz (the closure's masks and patch, for check.py) in
# .cache/modesty, or in --cache DIR. Run scripts/modesty/export.mjs first (it
# writes the inputs to .cache/modesty/in), then this, then check.py.
#
# Usage: .cache/female-ct-venv/bin/python -I scripts/modesty/gen.py [--out FILE] [--cache DIR]
import os, sys, json, hashlib, heapq
for _v in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS'): os.environ[_v] = '1'
sys.path.insert(0, 'scripts/modesty')
import numpy as np
from collections import defaultdict, deque
import networkx as nx
from scipy import sparse
from scipy.sparse.csgraph import connected_components
from scipy.sparse.linalg import spsolve
from scipy.spatial import cKDTree
import rt, scipy

# min-cut tie-breaking and the sparse solves decide the output bytes: the versions it was made with
VERSIONS = {'numpy': (np, '1.26.4'), 'scipy': (scipy, '1.13.1'), 'networkx': (nx, '3.2.1')}
IN = '.cache/modesty/in'; CACHE = '.cache/modesty'; OUT = 'data/modesty-male-skin.json'; ANCHORS = 'data/anchors.json'
SKIN_SHA = 'fab135cd16d34e7459b7e0981d4a0f7ecfda6b776bfc14272a973bb4111945d5'
ANCHORS_SHA = '4718ede3c6c96444ff6acb6c8c7b23b151d4b3450de240db74a203f8e36774a6'
ELL_C = np.array([0, 0.752, 0.042]); ELL_R = np.array([0.048, 0.064, 0.072])   # the external genitals of FMA7163 (m)
GROIN_C, GROIN_R = np.array([0, 0.76, 0.02]), 0.16                              # the centroid of every triangle the closure touches lies in this box
CFG = dict(
    cut_q=1.69,                  # min-cut domain: outer triangles with centroids in the genital ellipsoid scaled by sqrt(cut_q)
    perineum_z=-0.005,           # min-cut sink: skin reaching behind this is perineum (m)
    crease=((-0.05, 0.05), (0.775, 0.845), 0.035),   # suprapubic crease above the penis root, hidden too (x, y range; z above, m)
    zone_q=2.25,                 # disk repairs (islands, pinches) stay in the ellipsoid scaled by 1.5
    pocket=(0.035, 0.745, 0.015, 0.045),   # drawn skin over the slot top that the scrotum covered: |x| <, y >, z range (m)
    ring=0.05,                   # ring: drawn outer triangles with a vertex this close to the hole loop are remeshed (m)
    ramp=0.05,                   # the pull towards the source skin rises from 0 at the loop to full at this geodesic distance (m)
    h_core=0.011,                # edges longer than this are split where the pull is below one half (they end up 5.5-11 mm, m)
    h_ring=0.02,                 # ... and in the rest of the ring, so its long thigh triangles cannot swing with the fill (m)
    membrane=1.0,                # membrane weight beside the bending energy: keeps the fill from bulging past the skin
    floor=(0.729, -0.01, 0.4, 0.02, 3.0),   # (y0, z0, slope, half width, weight): downward-facing new fill within 2 cm of the
                                             # midline is pulled above y0 + slope * (z - z0), so the midline rises forward from
                                             # the perineum (y0 at z0) instead of sagging into a pit; wider, it uncovers the gracilis
    view_deg=45.0,               # inner-shell test direction: towards a viewer front-below the groin at this elevation
    inner_eps=0.003,             # genital inner shell within this of the patch (or outside it) is hidden (m)
    hold=0.004,                  # source skin within this of another drawn mesh (one the fill let out) keeps its position (m)
    normal_len=0.02,             # stored patch normals are diffused over this length (seam normals held): no shading creases (m)
    normal_min=0.1,              # every corner normal within acos(0.1) = 84 degrees of its face, else the fill is relaxed there
)
log = lambda *a: print(*a, file=sys.stderr, flush=True)
sha = lambda path: hashlib.sha256(open(path, 'rb').read()).hexdigest()
CONTEXT_BOX = [[-0.09, 0.66, -0.06], [0.09, 0.86, 0.13]]    # export.mjs BOX: it keeps the other meshes' triangles with a vertex in it (m)
ell_q = lambda X: (((X - ELL_C) / ELL_R) ** 2).sum(-1)
in_groin = lambda X: np.all(np.abs(X - GROIN_C) <= GROIN_R, axis=-1)


def load():
    for k, (mod, v) in VERSIONS.items():
        if mod.__version__ != v: raise SystemExit('%s %s, but the closure was made with %s' % (k, mod.__version__, v))
    if sha(ANCHORS) != ANCHORS_SHA: raise SystemExit('%s changed (sha256 %s): re-check the re-cast markers, then update ANCHORS_SHA' % (ANCHORS, sha(ANCHORS)))
    if not os.path.exists(f'{IN}/source.json'): raise SystemExit(f'no {IN}: run scripts/modesty/export.mjs first')
    src = json.load(open(f'{IN}/source.json'))
    for f in ['public/models/skin.glb', 'public/models/organ.glb'] + sorted(src['contextSources']):
        if src.get(f, src['contextSources'].get(f)) != sha(f) or src.get('box') != CONTEXT_BOX: raise SystemExit(f'{IN} is stale for {f}: run scripts/modesty/export.mjs')
    if src['public/models/skin.glb'] != SKIN_SHA: raise SystemExit('public/models/skin.glb changed (sha256 %s); the triangle indices no longer apply' % src['public/models/skin.glb'])
    f32 = lambda n: np.fromfile(f'{IN}/{n}', np.float32).reshape(-1, 3)
    P32, N32 = f32('skin-pos.f32'), f32('skin-nrm.f32')
    T = np.fromfile(f'{IN}/skin-idx.u32', np.uint32).reshape(-1, 3).astype(np.int64)
    org = [(f32(f'organ-{k}-pos.f32').astype(float), np.fromfile(f'{IN}/organ-{k}-idx.u32', np.uint32).reshape(-1, 3).astype(np.int64), name)
           for k, name in src['organs'].items()]
    return P32, N32, T, org


# ---------------------------------------------------------------- source-skin helpers
def face_normals(P, T, unit=True):
    n = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-30) if unit else n


class Topo:
    """Edge adjacency of the skin, with duplicate triangles (same vertex triple) treated as one."""
    def __init__(self, T):
        self.T = T
        _, first, inv = np.unique(np.sort(T, axis=1), axis=0, return_index=True, return_inverse=True)
        self.first = np.zeros(len(T), bool); self.first[first] = True; self.cls = inv.reshape(-1); self.rep = first[self.cls]
        self.E = defaultdict(list)
        for t in np.nonzero(self.first)[0]:
            for j in range(3):
                a, b = int(T[t, j]), int(T[t, (j + 1) % 3]); self.E[(min(a, b), max(a, b))].append(int(t))

    def spread(self, sel):
        hit = np.zeros(self.cls.max() + 1, bool); hit[self.cls[sel]] = True
        return hit[self.cls]

    def components(self, sel):
        ids = np.nonzero(sel & self.first)[0]; pos = {t: i for i, t in enumerate(ids)}; r, c = [], []
        for ts in self.E.values():
            ts = [t for t in ts if sel[t]]
            for a in ts:
                for b in ts:
                    if a != b: r.append(pos[a]); c.append(pos[b])
        lab = connected_components(sparse.coo_matrix((np.ones(len(r)), (r, c)), shape=(len(ids),) * 2), directed=False)[1]
        out = np.full(len(self.T), -1); out[ids] = lab
        return out[self.rep]


def escapes(P, T, mesh, tids, K=96, seed=2):
    """How many of K random front-hemisphere rays from each triangle's centroid leave `mesh`."""
    fn = face_normals(P, T[tids]); c = P[T[tids]].mean(1)
    rng = np.random.default_rng(seed); out = np.zeros(len(tids), int)
    for ch in np.array_split(np.arange(len(tids)), max(1, len(tids) // 400)):
        d = rng.normal(size=(len(ch), K, 3)); d /= np.linalg.norm(d, axis=2, keepdims=True)
        d[np.einsum('ikj,ij->ik', d, fn[ch]) < 0] *= -1
        out[ch] = (mesh.cast(np.repeat(c[ch] + fn[ch] * 2e-5, K, axis=0), d.reshape(-1, 3))[0].reshape(-1, K) < 0).sum(1)
    return out


def outer_triangles(P, T, topo, active, sel):
    """Triangles of `sel` from which at least 3 of 96 outward rays escape the active skin: the visible outer surface."""
    ids = np.nonzero(sel)[0]
    out = np.zeros(len(T), bool); out[ids] = escapes(P, T, rt.Mesh(P, T[active]), ids) >= 3
    return topo.spread(out) & sel


def hole_edges(T, topo, H):
    """Directed boundary edges of the hidden set, as wound in their hidden triangle."""
    out = []
    for e, ts in topo.E.items():
        h = [t for t in ts if H[t]]
        if len(h) != 1 or len(h) == len(ts): continue
        tri = list(T[h[0]]); i = tri.index(e[0])
        out.append((e[0], e[1]) if tri[(i + 1) % 3] == e[1] else (e[1], e[0]))
    return out


def boundary_loop(T, topo, H, outer):
    """The hole's boundary along the outer skin as one ordered vertex loop (hidden-triangle winding). Loops along
    inner-shell skin only (where the genital skin meets the shell's inside) stay open; inner_shell() hides that shell
    where it could show."""
    nxt, side = {}, {}
    for a, b in hole_edges(T, topo, H):
        if a in nxt: raise RuntimeError('pinched hole boundary at %d' % a)
        nxt[a] = b; side[a] = any(outer[t] and not H[t] for t in topo.E[(min(a, b), max(a, b))])
    loops, seen = [], set()
    for s0 in sorted(nxt):
        if s0 in seen: continue
        loop = [s0]; seen.add(s0); cur = nxt[s0]
        while cur != s0:
            if cur not in nxt or cur in seen: raise RuntimeError('open hole boundary at %d' % cur)
            loop.append(cur); seen.add(cur); cur = nxt[cur]
        loops.append(loop)
    best = int(np.argmax([np.mean([side[v] for v in l]) for l in loops]))
    if len(loops) > 1: log('hole: outer loop of %d vertices; %d inner-shell loops (%s vertices) stay open' % (len(loops[best]), len(loops) - 1, ', '.join(str(len(l)) for i, l in enumerate(loops) if i != best)))
    return np.array(loops[best])


def disk(T, topo, H, G, box, zone):
    """Make the hidden set one clean disk around the genital skin: drawn islands inside it and the drawn triangles of
    the zone at pinched boundary vertices are hidden, hidden islands away from it are drawn again."""
    H = topo.spread(H)
    for _ in range(60):
        H0 = H.copy()
        kl = topo.components(box & ~H)
        H |= (kl >= 0) & (kl != np.argmax(np.bincount(kl[kl >= 0]))) & zone
        cnt = defaultdict(int)
        for a, b in hole_edges(T, topo, H): cnt[a] += 1
        bad = [v for v, k in cnt.items() if k > 1]
        if bad: H |= zone & ~H & np.isin(T, bad).any(1)
        hl = topo.components(H)
        H &= ~((hl >= 0) & ~np.isin(hl, np.unique(hl[G])))
        H = topo.spread(H)
        if np.array_equal(H, H0): return H
    raise RuntimeError('hidden set did not settle')


# ---------------------------------------------------------------- genital skin: min-cut seeded by organ-hitting rays
BARY = np.array([[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6]])


def organ_mesh(org):
    """The external genital organs that lie under the hanging skin: the pendulous penis (in front of z 4 cm) and the
    scrotal part of the deferent ducts (below the pubis, y < 0.80 m, z > 3 cm), so inward rays from pubic skin miss."""
    Ps, Ts, off = [], [], 0
    for p, t, name in org:
        c = p[t].mean(1)
        if name in ('corpus spongiosum', 'corpus cavernosum', 'urethra'): t = t[c[:, 2] > 0.04]
        if 'deferent' in name: t = t[(c[:, 1] < 0.80) & (c[:, 2] > 0.03)]
        Ps.append(p); Ts.append(t + off); off += len(p)
    return rt.Mesh(np.concatenate(Ps), np.concatenate(Ts))


def genital_skin(P, T, topo, outer, om, cfg):
    """Outer skin over the external genitals: source = triangles whose inward rays (<= 3 cm) hit the organs (capacity
    by hit fraction and area), sink = triangles reaching out of the cut domain or onto the perineum; edge capacities
    are edge length, cheap along concave creases, so the cut follows the creases where the genitals meet the body."""
    fn = face_normals(P, T); area = np.linalg.norm(face_normals(P, T, False), axis=1) / 2; cen = P[T].mean(1); q = ell_q(P)
    dom = np.nonzero(outer & topo.first & (ell_q(cen) <= cfg['cut_q']))[0]; inside = set(dom.tolist())
    X = np.einsum('sk,tkd->tsd', BARY, P[T[dom]]).reshape(-1, 3); D = np.repeat(-fn[dom], len(BARY), axis=0)
    hit = (om.cast(X + D * 1e-4, D, tmax=0.03)[0] >= 0).reshape(-1, len(BARY)).mean(1)
    G = nx.DiGraph()
    for tt, h in zip(dom.tolist(), hit):
        if h > 0: G.add_edge('S', tt, capacity=10.0 * h * area[tt] / 1e-4)
        if q[T[tt]].max() > cfg['cut_q'] * 1.03 or P[T[tt], 2].min() < cfg['perineum_z']: G.add_edge(tt, 'K', capacity=1e9)
    for e in sorted(topo.E):
        ts = topo.E[e]
        if len(ts) != 2 or not (ts[0] in inside or ts[1] in inside): continue
        a, b = ts
        conc = 0.5 * ((cen[b] - cen[a]) @ fn[a] + (cen[a] - cen[b]) @ fn[b]) / max(np.linalg.norm(cen[b] - cen[a]), 1e-9)
        w = np.linalg.norm(P[e[0]] - P[e[1]]) / 1e-2 * np.exp(-6.0 * max(conc, 0.0)) + 1e-6
        if a in inside and b in inside: G.add_edge(a, b, capacity=w); G.add_edge(b, a, capacity=w)
        elif outer[b if a in inside else a]: G.add_edge(a if a in inside else b, 'K', capacity=w)
    S = nx.minimum_cut(G, 'S', 'K')[1][0]
    out = np.zeros(len(T), bool); out[[v for v in S if v != 'S']] = True
    return topo.spread(out)


# ---------------------------------------------------------------- patch mesh helpers (lists of vertex triples)
ekey = lambda a, b: (a, b) if a < b else (b, a)


def edge_map(F):
    emap = defaultdict(list)
    for i, f in enumerate(F):
        for j in range(3): emap[ekey(f[j], f[(j + 1) % 3])].append(i)
    return emap


def orient(F, seeds):
    """Wind every triangle reachable from the seed triangles consistently with them; returns the triangles and those
    whose neighbours disagree (a fold or a Moebius strip in the source)."""
    F = [list(f) for f in F]; emap = edge_map(F); done = np.zeros(len(F), bool); bad = set()
    dq = deque(seeds); done[list(seeds)] = True
    while dq:
        i = dq.popleft(); f = F[i]
        for j in range(3):
            a, b = f[j], f[(j + 1) % 3]
            for k in emap[ekey(a, b)]:
                if k == i: continue
                g = F[k]; same = g[(g.index(a) + 1) % 3] == b
                if not done[k]:
                    if same: F[k] = g[::-1]
                    done[k] = True; dq.append(k)
                elif same: bad |= {i, k}
    return F, bad


def dp_triangulate(V, ext, forbid=(), thin=1e-4):
    """Minimum (area + dihedral) triangulation of the polygon V (Liepa 2003); ext[i] is the neighbour normal across
    edge (i, i+1) (zero: none). Chords in `forbid` (index pairs) and triangles thinner than `thin` (area over squared
    mean edge) are not allowed."""
    n = len(V); scale = np.mean(np.linalg.norm(np.roll(V, -1, 0) - V, axis=1)); INF = 1e30; bad = set(forbid)
    C = np.full((n, n), INF); M = np.full((n, n), -1); BN = np.zeros((n, n, 3))
    for i in range(n - 1): C[i, i + 1] = 0.0; BN[i, i + 1] = ext[i]
    for L in range(2, n):
        for i in range(0, n - L):
            k = i + L; m = np.arange(i + 1, k)
            if (i, k) in bad: continue
            cr = np.cross(V[m] - V[i], V[k] - V[i]); ar = 0.5 * np.linalg.norm(cr, axis=1); nn = cr / np.maximum(2 * ar, 1e-30)[:, None]
            pen = (1 - (nn * BN[i, m]).sum(1)) + (1 - (nn * BN[m, k]).sum(1))
            if i == 0 and k == n - 1: pen = pen + (1 - nn @ ext[n - 1])
            c = np.where((ar < thin * scale ** 2) | (C[i, m] >= INF) | (C[m, k] >= INF), INF, C[i, m] + C[m, k] + ar / scale ** 2 + pen)
            j = int(np.argmin(c)); C[i, k] = c[j]; M[i, k] = m[j]; BN[i, k] = nn[j]
    tris, stack = [], [(0, n - 1)]
    while stack:
        i, k = stack.pop()
        if k - i < 2: continue
        m = M[i, k]
        if m < 0: raise RuntimeError('hole triangulation failed')
        tris.append((i, m, k)); stack += [(i, m), (m, k)]
    return np.array(tris)


def cap_holes(X, F):
    """Triangulate every boundary cycle of F but the longest (the patch's outer edge), so the patch is one disk."""
    emap = edge_map(F); out = defaultdict(list)
    for e, fs in emap.items():
        if len(fs) != 1: continue
        f = F[fs[0]]; i = f.index(e[0]); a, b = (e[0], e[1]) if f[(i + 1) % 3] == e[1] else (e[1], e[0])
        out[b].append(a)                                            # the cap runs against its neighbour
    cycles = []
    while any(out.values()):
        s0 = min(v for v in out if out[v]); cyc = [s0]; cur = out[s0].pop()
        while cur != s0 and out[cur]: cyc.append(cur); cur = out[cur].pop()
        cycles.append(cyc)
    def simple(c):
        seen = {}
        for i, v in enumerate(c):
            if v in seen: j = seen[v]; return simple(c[j:i]) + simple(c[:j] + c[i:])
            seen[v] = i
        return [c]
    cycles.sort(key=lambda c: -sum(np.linalg.norm(X[c[i]] - X[c[i - 1]]) for i in range(len(c))))
    caps = []
    for c in (s for c0 in cycles[1:] for s in simple(c0) if len(s) >= 3):
        forbid = [(a, b) for a in range(len(c)) for b in range(a + 2, len(c) - (a == 0)) if ekey(c[a], c[b]) in emap]
        caps += [[c[t[0]], c[t[1]], c[t[2]]] for t in dp_triangulate(np.asarray(X)[c], np.zeros((len(c), 3)), forbid, thin=0)]
    return caps


def collapse_short(X, F, attr, keep, near, lmin):
    """Collapse edges shorter than lmin between vertices that are not in `keep` and lie near the loop (clusters of tiny
    source triangles would otherwise pinch the faired surface). An edge (a, b) goes when a and b share exactly the two
    opposite vertices of its triangles (the link condition); b is merged into a. attr: per-triangle values carried
    along (a triangle whose corner moved gets None)."""
    F = [list(f) for f in F]; attr = list(attr); alias = {}
    while True:
        emap = edge_map(F); nbr = defaultdict(set)
        for (a, b) in emap: nbr[a].add(b); nbr[b].add(a)
        cand = sorted((np.linalg.norm(X[a] - X[b]), a, b) for (a, b), fs in emap.items()
                      if len(fs) == 2 and np.linalg.norm(X[a] - X[b]) < lmin and not (keep[a] or keep[b]) and (near[a] or near[b]))
        for _, a, b in cand:
            if {v for fi in emap[(a, b)] for v in F[fi] if v not in (a, b)} != nbr[a] & nbr[b]: continue
            kept = [i for i, f in enumerate(F) if not (a in f and b in f)]
            attr = [None if b in F[i] else attr[i] for i in kept]; F = [[a if v == b else v for v in F[i]] for i in kept]; alias[b] = a
            break
        else:
            return F, attr, alias


THIN = 1e-2
def bisect(X, NI, F, ring, fixed, hfun):
    """Longest-edge bisection (Rivara) of edges longer than hfun(a, b, X); edges in `fixed` are never split (a
    triangle whose longest edge is fixed splits its next longest). A new vertex takes the edge's midpoint and
    interpolated source normal; it lies on the source skin when the split edge belongs to a ring triangle. Children
    inherit their triangle's ring flag."""
    X = list(X); NI = list(NI); F = [list(f) for f in F]; ring = list(ring); data = [True] * len(X); forced = set()
    length = lambda e: np.linalg.norm(X[e[0]] - X[e[1]])
    thin = lambda f: np.linalg.norm(np.cross(X[f[1]] - X[f[0]], X[f[2]] - X[f[0]])) < THIN * max(length(ekey(f[k], f[(k + 1) % 3])) for k in range(3)) ** 2
    fixed = set(fixed) | {ekey(f[j], f[(j + 1) % 3]) for f in F if thin(f) for j in range(3)}   # slivers are not split
    def longest(f):
        es = sorted((ekey(f[j], f[(j + 1) % 3]) for j in range(3)), key=lambda e: (-length(e), e))
        return next((e for e in es if e not in fixed), None)
    for _ in range(200):
        emap = edge_map(F)
        cand = sorted({e for e in forced if e in emap and e not in fixed} | {e for e, fs in emap.items() if e not in fixed and len(fs) == 2 and length(e) > hfun(e[0], e[1], X)},
                      key=lambda e: (-length(e), e))
        if not cand: return np.array(X), np.array(NI), np.array(data), F, np.array(ring)
        used, forced = set(), set()
        for a, b in cand:
            fs = emap.get((a, b), [])
            if len(fs) != 2 or any(fi in used for fi in fs): continue
            if any(thin(F[fi]) for fi in fs): fixed |= {ekey(F[fi][j], F[fi][(j + 1) % 3]) for fi in fs if thin(F[fi]) for j in range(3)}; continue
            other = [longest(F[fi]) for fi in fs]
            if any(o != (a, b) for o in other):
                forced |= {o for o in other if o is not None and o != (a, b)}; forced.add((a, b)); continue
            m = len(X); X.append((X[a] + X[b]) / 2); NI.append((NI[a] + NI[b]) / 2); data.append(any(ring[fi] for fi in fs))
            for fi in fs:
                f = F[fi]; j = [k for k in range(3) if f[k] not in (a, b)][0]; c, u, v = f[j], f[(j + 1) % 3], f[(j + 2) % 3]
                F[fi] = [c, u, m]; F.append([c, m, v]); ring.append(ring[fi]); used.add(fi); used.add(len(F) - 1)
    raise RuntimeError('edge splitting did not settle')


def flips(X, F, keep, iters=50):
    """Delaunay edge flips (opposite angles summing past pi), boundary edges kept and edges with a `keep` triangle on
    either side (source skin: a flip across its facets would cut under it). Triangle indices stay."""
    F = [list(f) for f in F]
    ang = lambda p, q, r: np.arccos(np.clip((X[q] - X[p]) @ (X[r] - X[p]) / np.linalg.norm(X[q] - X[p]) / np.linalg.norm(X[r] - X[p]), -1, 1))
    for _ in range(iters):
        emap = edge_map(F); done, made, changed = set(), set(), False
        for (a, b), fs in emap.items():
            if len(fs) != 2 or fs[0] in done or fs[1] in done or keep[fs[0]] or keep[fs[1]]: continue
            f1, f2 = F[fs[0]], F[fs[1]]
            c = [v for v in f1 if v not in (a, b)][0]; d = [v for v in f2 if v not in (a, b)][0]
            if c == d or ekey(c, d) in emap or ekey(c, d) in made or ang(c, a, b) + ang(d, a, b) <= np.pi + 1e-9: continue
            made.add(ekey(c, d))
            if f1[(f1.index(a) + 1) % 3] == b: F[fs[0]], F[fs[1]] = [a, d, c], [d, b, c]
            else: F[fs[0]], F[fs[1]] = [b, d, c], [d, a, c]
            done |= {fs[0], fs[1]}; changed = True
        if not changed: break
    return F


def geodesic(X, F, src, allowed):
    """Edge-path distance from the src vertices through allowed vertices."""
    nb = defaultdict(list)
    for f in F:
        for j in range(3):
            a, b = f[j], f[(j + 1) % 3]
            if allowed[a] and allowed[b]: L = np.linalg.norm(X[a] - X[b]); nb[a].append((b, L)); nb[b].append((a, L))
    d = np.full(len(X), np.inf); h = [(0.0, s) for s in src]
    for s in src: d[s] = 0
    while h:
        dd, u = heapq.heappop(h)
        if dd > d[u]: continue
        for v, L in nb[u]:
            if dd + L < d[v]: d[v] = dd + L; heapq.heappush(h, (d[v], v))
    return d


def fair(X, F, fixed, w, wy, ty, mu):
    """Positions minimising |L x|^2 (umbrella bi-Laplacian) + mu * membrane + sum w |x - X|^2 + sum wy (y - ty)^2
    over the vertices not fixed (which keep X)."""
    n = len(X); E = set()
    for f in F:
        for j in range(3): a, b = int(f[j]), int(f[(j + 1) % 3]); E.add((a, b)); E.add((b, a))
    E = sorted(E); r = np.array([a for a, b in E]); c = np.array([b for a, b in E])
    A = sparse.csr_matrix((np.ones(len(E)), (r, c)), shape=(n, n)); deg = np.maximum(np.asarray(A.sum(1)).ravel(), 1)
    L = sparse.diags(1 / deg) @ A - sparse.identity(n); Ls = sparse.diags(deg) - A
    I = np.nonzero(~fixed)[0]; K = np.nonzero(fixed)[0]
    Q = (L[:, I].T @ L[:, I] + mu * Ls[I][:, I]).tocsr(); QK = L[:, I].T @ L[:, K] + mu * Ls[I][:, K]
    Y = X.copy()
    for k in range(3):
        wk = w + (wy if k == 1 else 0)
        Y[I, k] = spsolve((Q + sparse.diags(wk[I])).tocsc(), -(QK @ X[K, k]) + w[I] * X[I, k] + ((wy * ty)[I] if k == 1 else 0))
    return Y


def boundary_mask(F):
    """Per corner of F: whether the edge leaving it (to the next corner) is on one triangle only."""
    E = np.sort(np.stack([F, np.roll(F, -1, 1)], 2), 2).reshape(-1, 2)
    _, inv, cnt = np.unique(E, axis=0, return_inverse=True, return_counts=True)
    one = (cnt[inv.ravel()] == 1).reshape(F.shape)
    return one | np.roll(one, 1, 1)                          # both corners of a boundary edge


def umbrella(X, F):
    """Mean of each vertex's edge neighbours (X where it has none)."""
    E = np.unique(np.sort(np.r_[F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]], 1), axis=0)
    s = np.zeros_like(X); c = np.zeros(len(X))
    for a, b in ((0, 1), (1, 0)): np.add.at(s, E[:, a], X[E[:, b]]); np.add.at(c, E[:, a], 1)
    return np.where(c[:, None] > 0, s / np.maximum(c, 1)[:, None], X)


def vertex_normals(X, F):
    F = np.asarray(F); fa = face_normals(X, F, unit=False); Nn = np.zeros_like(X)
    for j in range(3): np.add.at(Nn, F[:, j], fa)
    return Nn / (np.linalg.norm(Nn, axis=1, keepdims=True) + 1e-30)


def smooth_normals(V, F, Nn, held, L0):
    """Screened-Poisson diffusion of the vertex normals Nn over the mesh F (vertex-area mass, graph Laplacian, smoothing
    length L0), `held` vertices fixed, so the shading carries no creases from folds and facets of the faired fill.
    Returns the normals and, per triangle, the least cosine between its face normal and its corner normals."""
    n = len(V); E = np.unique(np.sort(np.r_[F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]], 1), axis=0)
    A = sparse.csr_matrix((np.ones(2 * len(E)), (np.r_[E[:, 0], E[:, 1]], np.r_[E[:, 1], E[:, 0]])), shape=(n, n))
    Lap = (sparse.diags(np.asarray(A.sum(1)).ravel()) - A).tocsr()
    area = np.zeros(n); fa = np.linalg.norm(face_normals(V, F, unit=False), axis=1) / 6
    for j in range(3): np.add.at(area, F[:, j], fa)
    M = sparse.diags(area).tocsr(); I = np.nonzero(~held)[0]; K = np.nonzero(held)[0]
    Q = (M + L0 ** 2 * Lap)[I][:, I].tocsc(); out = Nn.copy()
    for k in range(3): out[I, k] = spsolve(Q, M[I][:, I] @ Nn[I, k] - L0 ** 2 * (Lap[I][:, K] @ Nn[K, k]))
    out /= np.linalg.norm(out, axis=1, keepdims=True) + 1e-30
    return out, (face_normals(V, F)[:, None, :] * out[F]).sum(2).min(1)


# ---------------------------------------------------------------- the whole closure
def hole_and_ring(P, T, org, cfg):
    """Genital skin (min-cut, alternating with the outer test), plus the suprapubic crease; then the ring of drawn
    outer skin around its loop. Skin the genitals hid that stays visible past a quick closure joins the outer skin."""
    topo = Topo(T); q = ell_q(P); c = P[T].mean(1); box = in_groin(c)
    (x0, x1), (y0, y1), zc = cfg['crease']
    V = P[T]; band = box & ((V[..., 0] > x0) & (V[..., 0] < x1) & (V[..., 1] > y0) & (V[..., 1] < y1) & (V[..., 2] > zc)).all(1)
    om = organ_mesh(org); G = np.zeros(len(T), bool)
    for it in range(8):
        outer = outer_triangles(P, T, topo, ~G, box)
        Gn = genital_skin(P, T, topo, outer, om, cfg)
        log('genital skin %d: outer %d, genital %d' % (it, outer.sum(), Gn.sum()))
        if np.array_equal(Gn, G): break
        G = Gn
    else:
        raise RuntimeError('genital skin did not settle')
    lab = topo.components(outer & band | G)
    H0 = (lab >= 0) & np.isin(lab, np.unique(lab[G])) & outer
    zone = box & (q[T] <= cfg['zone_q']).all(1)
    fn = face_normals(P, T)
    for it in range(10):
        H = disk(T, topo, H0, G, box, zone)
        loop = boundary_loop(T, topo, H, outer)
        dl = cKDTree(P[loop]).query(P)[0]
        R = outer & ~H & topo.first & box & (dl[T].min(1) <= cfg['ring'])
        R = disk(T, topo, H | R, G, box, box & (q[T] <= 6).all(1)) & ~H & topo.first
        own = {}                                              # ring normal across each loop edge, signed to the loop's winding
        for t in np.nonzero(R)[0]:
            for j in range(3): a, b = int(T[t, j]), int(T[t, (j + 1) % 3]); own[(b, a)] = fn[t]; own.setdefault((a, b), -fn[t])
        ext = np.array([own.get((int(loop[i]), int(loop[(i + 1) % len(loop)])), np.zeros(3)) for i in range(len(loop))])
        fill = [list(map(int, loop[f])) for f in dp_triangulate(P[loop], ext)]
        F, bad = orient(fill + [list(map(int, t)) for t in T[R]], list(range(len(fill))))
        cand = np.nonzero(box & ~outer & ~H & ~R & (dl[T].min(1) <= 1.5 * cfg['ring']))[0]
        exposed = cand[escapes(P, T, rt.Mesh(P, np.r_[T[~(H | topo.spread(R))], np.array(F)]), cand) >= 3]
        log('round %d: hidden %d, loop %d, ring %d, exposed %d' % (it, H.sum(), len(loop), R.sum(), len(exposed)))
        if not len(exposed): break
        outer[exposed] = True; outer = topo.spread(outer)
    else:
        raise RuntimeError('outer surface did not settle')
    return dict(topo=topo, outer=outer, G=G, H=H, band=band, loop=loop, R=np.nonzero(R)[0], F=F, nfill=len(fill), bad=bad, box=box, q=q)


def closure(P, N, T, st, cfg, poked=()):
    """The patch: ring + loop fill as one mesh, cleaned (folded, non-manifold and pocket ring triangles removed and
    the holes capped, short edges near the loop collapsed), refined, and faired: bending + membrane energy, a pull
    towards the source skin that ramps up with geodesic distance from the loop, and a floor for the downward-facing new
    fill. Source skin is never flipped across its facets and never sinks below itself; skin within `hold` of a point
    of another drawn mesh in `poked` keeps its source position. Folds are freed and refaired, slivers merged; normals are
    diffused and crumples against them relaxed. Returns
    patch positions, normals, triangles, which patch vertices are skin vertices (exact), the ring triangles handed back
    to the skin, how far each patch vertex moved, and the source vertices the patch moved."""
    loop, nfill = st['loop'], st['nfill']
    used = sorted(set(v for f in st['F'] for v in f)); vid = {v: i for i, v in enumerate(used)}
    F = [[vid[v] for v in f] for f in st['F']]; X0 = P[used].copy(); NI = (N / np.linalg.norm(N, axis=1, keepdims=True))[used]
    loopv = [vid[int(v)] for v in loop]
    # ring triangles that cannot be faired as they are: winding conflicts, non-manifold edges, folds near the loop
    # (and their neighbours), and the skin over the slot top that the scrotum covered (a pocket once it is gone)
    fa = face_normals(X0, np.array(F)); emap = edge_map(F); nbr = defaultdict(set)
    for fs in emap.values():
        for i in fs: nbr[i] |= set(fs) - {i}
    dl = cKDTree(P[loop]).query(X0[np.array(F)].mean(1))[0]
    near = lambda i: i >= nfill and dl[i] < 0.5 * cfg['ring']
    drop = {i for i in st['bad'] if i >= nfill} | {i for fs in emap.values() if len(fs) > 2 for i in fs if i >= nfill}
    fold = {i for i in range(nfill, len(F)) if near(i) and nbr[i] and fa[i] @ fa[sorted(nbr[i])].sum(0) < 0}
    drop |= fold | {k for i in fold for k in nbr[i] if near(k)}
    px, py, pz0, pz1 = cfg['pocket']
    cen = X0[np.array(F)].mean(1)
    drop |= {i for i in range(nfill, len(F)) if abs(cen[i, 0]) < px and cen[i, 1] > py and pz0 < cen[i, 2] < pz1}
    keep = [i for i in range(len(F)) if i not in drop]
    src_tri = {i: (st['R'][i - nfill]) for i in range(nfill, len(F))}
    F = [F[i] for i in keep]; isring = [i >= nfill for i in keep]; tri_src = [src_tri.get(i, -1) for i in keep]
    caps = cap_holes(X0, F)
    F += caps; isring += [False] * len(caps); tri_src += [-1] * len(caps)
    bv0 = {v for e, fs in edge_map(F).items() if len(fs) == 1 for v in e}
    nearv = cKDTree(P[loop]).query(X0)[0] < 0.5 * cfg['ring']
    F, attr, alias = collapse_short(X0, F, list(zip(isring, tri_src)), np.isin(np.arange(len(X0)), sorted(bv0)), nearv, cfg['h_core'] / 2)
    isring = [a[0] if a else False for a in attr]; tri_src = [a[1] if a else -1 for a in attr]
    while any(v in alias for v in loopv): loopv = sorted({alias.get(v, v) for v in loopv})
    F = flips(X0, F, isring)
    log('patch: %d short edges collapsed' % len(alias))
    log('patch: %d ring triangles dropped, %d cap triangles' % (len(drop), len(caps)))
    emap = edge_map(F); bnd = {e for e, fs in emap.items() if len(fs) == 1}
    if any(len(fs) > 2 for fs in emap.values()): raise RuntimeError('non-manifold patch')
    blen = defaultdict(float)
    for a, b in bnd: L = np.linalg.norm(X0[a] - X0[b]); blen[a] = max(blen[a], L); blen[b] = max(blen[b], L)
    lt = cKDTree(P[loop])
    def hfun(a, b, X):
        d = lt.query((X[a] + X[b]) / 2)[0]
        h = cfg['h_core'] if d < 0.5 * cfg['ramp'] else cfg['h_ring'] if d < 1.5 * cfg['ramp'] else np.inf
        return max(h, 0.75 * max(blen.get(a, 0), blen.get(b, 0)))
    nsrc = len(X0)
    X, NI, data, F, isring = bisect(X0, NI, F, isring, bnd, hfun)
    tri_src += [-1] * (len(F) - len(tri_src))                 # split triangles are no longer source triangles
    for f_i in range(len(tri_src)):
        if tri_src[f_i] >= 0 and any(v >= nsrc for v in F[f_i]): tri_src[f_i] = -1
    data[loopv] = True
    d = geodesic(X, F, loopv, np.ones(len(X), bool))
    F = flips(X, F, isring)
    t = np.clip(d / cfg['ramp'], 0, 1); alpha = np.where(data, t * t * (3 - 2 * t), 0.0)
    pocket = (np.abs(X[:, 0]) < px) & (X[:, 1] > py) & (X[:, 2] > pz0) & (X[:, 2] < pz1); alpha[pocket] = 0
    usedv = np.zeros(len(X), bool); usedv[np.array(F).ravel()] = True
    fixed = (alpha >= 0.999) | ~usedv; fixed[[v for e in bnd for v in e]] = True
    if pocket[[v for e in bnd for v in e]].any(): raise RuntimeError('the patch edge reaches into the pocket box')
    fixed[pocket & usedv] = False
    if len(poked): fixed |= data & usedv & ~pocket & (cKDTree(np.asarray(poked)).query(X)[0] < cfg['hold'])
    w = alpha / (1 - alpha + 1e-3)
    y0, z0, slope, fx, fw = cfg['floor']; sm = lambda s: np.clip(s, 0, 1) ** 2 * (3 - 2 * np.clip(s, 0, 1))
    ty = y0 + slope * np.maximum(X[:, 2] - z0, 0)
    wy = np.zeros(len(X)); NIu = NI / np.linalg.norm(NI, axis=1, keepdims=True)
    for k in range(6):          # floor: a soft pull on downward-facing new fill near the midline; flips on the faired surface;
        Y = fair(X, F, fixed, w, wy, ty, cfg['membrane'])   # source skin that sinks below itself is held
        sink = data & (((Y - X) * NIu).sum(1) < -2e-4); w[sink] = np.maximum(w[sink] * 4, 50.0)
        Nk = vertex_normals(Y, F)
        wy = fw * sm((fx - np.abs(Y[:, 0])) / 0.01) * ~data * sm((ty - Y[:, 1]) / 0.004 + 0.5) * sm((-Nk[:, 1] - 0.2) / 0.5)
        if k in (1, 3):
            F = flips(Y, F, isring)
    Y = fair(X, F, fixed, w, wy, ty, cfg['membrane'])
    Fa = np.array(F); bv = np.zeros(len(X), bool); bv[[v for e in bnd for v in e]] = True
    sharp = lambda Z: (face_normals(Z, Fa) * vertex_normals(Z, Fa)[Fa].mean(1)).sum(1) < 0.2
    ridge = data[Fa].all(1) & sharp(X)                         # sharp in the source skin itself (the perineal ridge)
    for k in range(6):          # folds (a face against its corners' mean normal: thin source creases) are freed and refaired
        fold = sharp(Y) & ~ridge
        if not fold.any(): break
        free = np.zeros(len(X), bool); free[Fa[fold].ravel()] = True
        free[Fa[(free[Fa]).any(1)].ravel()] = True; free &= ~bv
        alpha[free] = 0; w[free] = 0; fixed[free] = False; data[free] = False
        log('patch: %d folded triangles, %d vertices freed' % (fold.sum(), free.sum()))
        Y = fair(X, F, fixed, w, wy, ty, cfg['membrane'])
    if (sharp(Y) & ~ridge).any(): raise SystemExit('patch: folds remain after refairing')
    keepv = bv | (fixed & data)                                # slivers the fairing made (corners within 0.5 mm) merge
    F, tri_src, alias = collapse_short(Y, F, tri_src, keepv, np.ones(len(Y), bool), 5e-4)
    tri_src = [-1 if t is None else t for t in tri_src]
    if alias: log('patch: %d sliver edges collapsed' % len(alias))
    # normals: the source normal blended with the patch geometry's by the pull, then diffused (patch edge held). A
    # triangle at odds with its smoothed corner normals is a crumple of the fill or a sharp crease of the source skin
    # (the perineal raphe): free corners are relaxed, the others keep the blended normal
    Fa = np.array(F); inF = np.zeros(len(Y), bool); inF[Fa.ravel()] = True; bv = np.zeros(len(Y), bool); bv[Fa[boundary_mask(Fa)]] = True
    movable = inF & ~fixed & ~bv; held = bv | ~inF
    for k in range(40):
        Ng = vertex_normals(Y, Fa)
        Nb = alpha[:, None] * NIu + (1 - alpha[:, None]) * Ng; Nb /= np.linalg.norm(Nb, axis=1, keepdims=True) + 1e-30
        Nb, worst = smooth_normals(Y, Fa, Nb, held, cfg['normal_len'])
        bad = (worst < cfg['normal_min']) & ~held[Fa].all(1)      # all corners held: the source skin as it was
        if not bad.any(): break
        mv = np.zeros(len(Y), bool); mv[Fa[bad].ravel()] = True; held |= mv & ~movable
        mv[Fa[mv[Fa].any(1)].ravel()] = True; mv &= movable
        dY = umbrella(Y, Fa) - Y                               # tangential first (the surface keeps its height), then plain
        if k < 20: dY -= (dY * Nb).sum(1, keepdims=True) * Nb
        Y[mv] += 0.5 * dY[mv]
    else:
        raise RuntimeError('patch triangles stay against their normals')
    log('patch normals: %d relaxing rounds, %d source vertices keep the blended normal' % (k, (held & ~bv & inF).sum()))
    # ring triangles that came through unchanged (unsplit, all corners at their source positions) go back to the skin
    back = [s for s, f in zip(tri_src, F) if s >= 0 and fixed[f].all()]
    Fe = [f for s, f in zip(tri_src, F) if not (s >= 0 and fixed[f].all())]
    ve = sorted(set(v for f in Fe for v in f)); remap = {v: i for i, v in enumerate(ve)}
    exact = np.array([used[v] if (v < nsrc and fixed[v]) else -1 for v in ve])
    return dict(V=Y[ve], Np=Nb[ve], Fp=np.array([[remap[v] for v in f] for f in Fe]), exact=exact, back=np.array(sorted(back), int),
                alpha=alpha[ve], shift=np.linalg.norm(Y - X, axis=1)[ve], moved=np.array([used[v] for v in range(nsrc) if usedv[v] and not fixed[v]], int))


def inner_shell(P, T, hidden, outer, V, Fp, q, box, cfg):
    """Inner-shell (non-outer) skin of the genital core lying outside the patch or within inner_eps behind it, judged
    along the view direction w: hidden too, so nothing of it shows through the closed or fading surface."""
    ids = np.nonzero(box & ~outer & ~hidden & (q[T] <= 1).all(1))[0]
    a = np.radians(cfg['view_deg']); w = np.array([0.0, -np.sin(a), np.cos(a)])
    S, own = tri_samples(P, T, ids); m = rt.Mesh(V, Fp); W = np.broadcast_to(w, S.shape)
    tri, t, _, _, front = m.cast(S, W)
    behind = (tri >= 0) & ~front
    out = np.zeros(len(T), bool); out[np.unique(own[(behind & (t < cfg['inner_eps'])) | (~behind & (m.cast(S, -W)[0] >= 0))])] = True
    return out


def tri_samples(P, T, tids, step=0.003):
    pts, own = [], []
    for t in tids:
        a, b, c = P[T[t]]; n = int(np.ceil(max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b)) / step)) + 1
        i, j = np.meshgrid(np.arange(n + 1), np.arange(n + 1)); m = i + j <= n
        pts.append(a + (i[m] / n)[:, None] * (b - a) + (j[m] / n)[:, None] * (c - a)); own.append(np.full(m.sum(), t))
    return (np.concatenate(pts), np.concatenate(own)) if pts else (np.zeros((0, 3)), np.zeros(0, int))


def context_samples(step=0.0015):
    """Points every 1.5 mm on the other drawn meshes near the groin (export.mjs), with their mesh index."""
    C = np.fromfile(f'{IN}/context.f32', np.float32).reshape(-1, 4).astype(float); I = np.fromfile(f'{IN}/context-idx.u32', np.uint32).reshape(-1, 3).astype(np.int64)
    S, own = tri_samples(C[:, :3], I, np.arange(len(I)), step)
    return S, C[I[own, 0], 3].astype(int)


def outside(mesh, Q, k=26):
    """Points from which some of k spread rays escape the mesh (in open air, not enclosed)."""
    i = np.arange(k) + 0.5; ph = np.arccos(1 - 2 * i / k); th = np.pi * (1 + 5 ** 0.5) * i
    d = np.c_[np.cos(th) * np.sin(ph), np.cos(ph), np.sin(th) * np.sin(ph)]
    return (mesh.cast(np.repeat(Q, k, 0), np.tile(d, (len(Q), 1)))[0].reshape(len(Q), k) < 0).any(1)


FORWARD = np.array([0, 0, 1.0])
def recast_anchors(P, N, T, hidden, V, Np, Fp):
    """Acupoint markers (data/anchors.json) near the groin whose surface point sits on hidden skin, off the drawn
    surface, or under it (the marker would be enclosed by the closed skin) move to the drawn surface (kept skin +
    patch): the crossing of the line seed -> surface point within 5 mm of the old point whose marker (displayOffset out
    along the drawn surface's normal) is in open air; else, for a point the closure encloses, the first drawn surface
    straight forward (+z: the same side and height, seen from the front) that faces open air; else the nearest
    crossing on the seed line that faces open air; else the nearest such drawn surface seen from the old point."""
    A = json.load(open(ANCHORS))
    kept = np.nonzero(~hidden)[0]; VV = np.r_[P, V]; TT = np.r_[T[kept], Fp + len(P)]; NN = np.r_[N / np.linalg.norm(N, axis=1, keepdims=True), Np]
    drawn, full = rt.Mesh(VV, TT), rt.Mesh(P, T)
    def crossings(m, o, d, upto):
        out, t0 = [], 0.0
        while True:
            tri, t, u, v, _ = m.cast(o[None] + d[None] * t0, d[None])
            if tri[0] < 0 or t0 + t[0] > upto: return out
            out.append((t0 + t[0], int(tri[0]), u[0], v[0])); t0 += t[0] + 1e-7
    cone = np.random.default_rng(7).normal(size=(1024, 3)); cone /= np.linalg.norm(cone, axis=1)[:, None]
    def open_face(p, n):
        """The marker at p is in open air and faces it: more than three quarters of 64 rays within 60 degrees of n leave
        the drawn surface (a marker on a wall facing into the thigh gap, drawn without depth test, would float in front
        of the other wall)."""
        r = cone[cone @ n > 0.5][:64]
        assert len(r) == 64
        return outside(drawn, p[None])[0] and (drawn.cast(np.broadcast_to(p, r.shape), r)[0] < 0).mean() > 0.75
    def normal(tri, u, v):
        n = (1 - u - v) * NN[TT[tri, 0]] + u * NN[TT[tri, 1]] + v * NN[TT[tri, 2]]; return n / np.linalg.norm(n)
    out = []
    for a in A:
        S, O = np.array(a['surfacePoint']), np.array(a['seed'])
        if not in_groin(S): continue
        D = S - O; L = np.linalg.norm(D); D /= L; w = (np.array(a['position']) - S) / a['displayOffset']
        on = [c for c in crossings(full, O, D, L + 1e-4) if abs(c[0] - L) < 1e-5]
        cands = []
        for t, tri, u, v in crossings(drawn, O - 0.1 * D, D, L + 0.2):
            n = normal(tri, u, v); cands.append((abs(t - 0.1 - L), O + D * (t - 0.1), n if n @ w >= 0 else -n))
        cands.sort(key=lambda c: c[0])
        ok = [c for c in cands if c[0] < 0.005 and outside(drawn, (c[1] + a['displayOffset'] * c[2])[None])[0]]
        for t, tri, u, v in ([] if ok else crossings(drawn, S, FORWARD, 0.08)):   # enclosed: straight forward, same side and height
            n = normal(tri, u, v); n = n if n @ FORWARD > 0 else -n; p = S + FORWARD * t
            if open_face(p + a['displayOffset'] * n, n): ok = [(t, p, n)]; break
        ok = ok or [c for c in cands if open_face(c[1] + a['displayOffset'] * c[2], c[2])]
        if not ok:                                     # the line runs inside the closed body: nearest way out
            k = 200; i = np.arange(k) + 0.5; ph = np.arccos(1 - 2 * i / k); th = np.pi * (1 + 5 ** 0.5) * i
            best = None
            for dj in np.c_[np.cos(th) * np.sin(ph), np.cos(ph), np.sin(th) * np.sin(ph)]:
                for t, tri, u, v in crossings(drawn, S, dj, 0.08):
                    if best is not None and t >= best[0]: break
                    n = normal(tri, u, v); n = n if n @ dj > 0 else -n; p = S + dj * t
                    if open_face(p + a['displayOffset'] * n, n): best = (t, p, n); break
            ok = [best] if best else []
        if not ok: raise RuntimeError('anchor %s: no drawn surface in open air near it' % a['key'])
        if not (on and hidden[on[0][1]]) and cands and cands[0][0] < 5e-4 and ok[0] is cands[0]: continue
        _, p, n = ok[0]
        out.append({'key': a['key'], 'surfacePoint': [round(float(x), 6) for x in p],
                    'position': [round(float(x), 6) for x in p + a['displayOffset'] * n]})
        log('anchor %s re-cast: surface point moved %.1f mm, normal %s' % (a['key'], np.linalg.norm(p - S) * 1e3, np.round(n, 2)))
    return out


def write_json(P32, N32, T, hidden, V, Np, Fp, exact, seam, anchors, method, limits, out=OUT):
    """Patch vertices that are skin vertices are written as the exact float32 skin positions (the decimal that parses
    to that float32); the seam ones (on drawn skin) also take the skin's float32 normal. The rest: 0.01 mm, 1e-4."""
    f32 = lambda x: repr(float(np.float32(x)))
    trim = lambda s: ('0' if s in ('-0', '') else s)
    fmt = lambda x, k: trim(('%.*f' % (k, x)).rstrip('0').rstrip('.'))
    pos, nrm = [], []
    for i in range(len(V)):
        pos += [f32(x) for x in P32[exact[i]]] if exact[i] >= 0 else [fmt(x, 5) for x in V[i]]
        nrm += [f32(x) for x in N32[exact[i]]] if seam[i] else [fmt(x, 4) for x in Np[i]]
    body = {'source': {'file': 'public/models/skin.glb', 'node': 'FMA7163', 'sha256': SKIN_SHA, 'triangles': int(len(T))},
            'hiddenTriangles': '@H', 'patch': {'positions': '@P', 'normals': '@N', 'indices': '@I'},
            'anchors': anchors, 'method': method, 'limits': limits}
    txt = json.dumps(body, ensure_ascii=False, separators=(',', ':'))
    txt = txt.replace('"@H"', '[' + ','.join(str(int(t)) for t in np.nonzero(hidden)[0]) + ']')
    txt = txt.replace('"@P"', '[' + ','.join(pos) + ']').replace('"@N"', '[' + ','.join(nrm) + ']')
    txt = txt.replace('"@I"', '[' + ','.join(str(int(i)) for i in Fp.ravel()) + ']')
    tmp = out + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f: f.write(txt + '\n')
    os.replace(tmp, out)
    return txt


def method_and_limits(cfg, stats, anchors):
    mm = lambda m: '%g mm' % round(m * 1e3, 1)
    y0, z0, slope, fx, _ = cfg['floor']; mid = stats['midline']; dips = np.maximum.accumulate(mid[MID_Z >= z0]) - mid[MID_Z >= z0]
    method = ("Generated by scripts/modesty/gen.py from FMA7163 of public/models/skin.glb; the skin buffers are unchanged. "
        "Outer skin = triangles from which at least 3 of 96 outward rays escape. Genital skin = a graph min-cut on that outer skin "
        "seeded by inward rays (3 cm) that hit the external genital organs, with sinks where the skin leaves the genital ellipsoid "
        "or reaches the perineum and cheap cuts along concave creases, alternating with the outer test until stable. The "
        "suprapubic crease above the penis root is hidden with it. Drawn outer skin with a vertex within %s of the hole's loop "
        "is the ring; ring and a minimum area + dihedral triangulation of the loop (Liepa 2003) form one mesh, from which ring "
        "triangles that are folded, non-manifold or wound against their neighbours near the loop, and the skin over the slot "
        "top that the scrotum covered, are removed and the holes capped; short edges near the loop are collapsed. Edges "
        "longer than %s are split (longest-edge bisection) where the fill is mostly free and longer than %s in the rest of "
        "the ring, new-fill edges Delaunay-flipped (source skin is never flipped across its facets), and the positions faired: "
        "umbrella bi-Laplacian plus a membrane term (weight %g, so the fill does not bulge past the skin), a pull towards the "
        "source skin that rises with geodesic distance from the loop to full at %s (where the vertex keeps its source "
        "position), and a soft floor for downward-facing new fill within %s of the midline that rises forward from y %g m at "
        "z %g m by %g m per m; source skin that sinks below itself is held, folds are freed and refaired, and source skin over "
        "another drawn mesh that would come through stays put. Normals blend the source skin's interpolated normal and the "
        "patch geometry's by the same pull and are then diffused over %s (screened Poisson, the patch edge held), so folds and "
        "facets of the fill leave no shading creases; fill crumpled against those normals is relaxed. "
        "Ring triangles that come through unchanged stay drawn skin; patch vertices that are skin vertices are written as the "
        "exact float32 skin coordinates, and those on drawn skin also take its float32 normal (no flange, no cracks). Genital "
        "inner-shell skin outside the patch or within %s behind it is hidden. Male acupoint markers near the groin whose surface "
        "point is hidden or enclosed are re-cast onto the drawn surface ('anchors'). All patch triangles are counter-clockwise "
        "seen from outside." % (mm(cfg['ring']), mm(cfg['h_core']), mm(cfg['h_ring']), cfg['membrane'], mm(cfg['ramp']),
                                mm(fx), y0, z0, slope, mm(cfg['normal_len']), mm(cfg['inner_eps'])))
    moved = ', '.join('%s %s' % (a['key'], mm(a['moved'])) for a in anchors)
    limits = [
        "Editorial display surface, not anatomy: the patch is a smooth closure of the hole left by the penis and scrotum; it reconstructs no structure and implies nothing about real anatomy.",
        "The closure spans the space between the inner thighs that the scrotum filled, so it closes a pocket of former open air behind and above it: new-fill vertices lie up to %s from the original skin (largest distance from a new-fill vertex in the original's open air to the nearest original skin vertex); on the midline the original outer skin outside the genitals (the crease behind the scrotum) is up to %s above the closure seen from below. The silhouette is not extended." % (mm(stats['pocket']), mm(stats['pocket_mid'])),
        "Seen from below on the midline (z = %s cm) the closure is at y %s m; the original perineum is at %.4f m at z = %g cm, and the lowest closure point there is %s. %s" % (
            ', '.join('%g' % round(z * 100, 1) for z in MID_Z), ', '.join('%.4f' % y for y in mid), stats['peri'], MID_Z[0] * 100,
            ('%s below it' % mm(stats['peri'] - mid.min())) if mid.min() < stats['peri'] else 'not below it',
            'It rises forward without a dip.' if dips.max() < 5e-4 else 'Forward of the perineum it dips by up to %s before rising (a faired saddle over the slot top).' % mm(dips.max())),
        "The male skin mesh is coarse in the groin (triangles up to several cm); the hidden outline follows existing skin edges and the faired ring blends into the kept facets. The stored patch normals are smoothed over %s: the shading is smoother than the faceted geometry, whose small folds and corner dimples where the closure meets the thigh walls can still show on the silhouette." % mm(cfg['normal_len']),
        "Re-cast markers (surface point moved): %s. Markers on skin the patch replaces follow its surface (under 1 mm); %s sat in the crease the scrotum sealed (already enclosed in the source mesh) and were moved straight forward onto the front of the closure, at the same side and height: an editorial placement on invented surface, not their anatomical site." % (moved or 'none', ', '.join(a['key'] for a in anchors if a['moved'] > 0.005) or 'none'),
        "Genital organ meshes and the vessels and nerve that follow them out of the body lie outside the closed surface, so the runtime must hide them in this mode (src/modesty.ts); every other male mesh near the groin stays inside it.",
        "Inner-shell skin of the genital core is hidden where it could show; its cut edges stay open inside the body.",
        "Valid only for public/models/skin.glb with the sha256 above (triangle indices refer to FMA7163's index buffer). Male skin only.",
    ]
    return method, limits


MID_Z = np.round(np.arange(-0.01, 0.0401, 0.005), 3)
def midline_heights(VV, TT):
    """Height of the surface seen straight from below on the midline at MID_Z."""
    O = np.c_[np.zeros(len(MID_Z)), np.full(len(MID_Z), 0.5), MID_Z]
    tri, t = rt.Mesh(VV, TT).cast(O, np.tile([0, 1.0, 0], (len(MID_Z), 1)))[:2]
    if (tri < 0).any(): raise RuntimeError('no surface above the midline at z = %s' % MID_Z[tri < 0])
    return 0.5 + t


def main(cfg=CFG, out=OUT, cache=CACHE):
    P32, N32, T, org = load()
    P, N = P32.astype(float), N32.astype(float)
    st = hole_and_ring(P, T, org, cfg)
    topo = st['topo']
    ctx, cmesh = context_samples(); names = json.load(open(f'{IN}/source.json'))['context']; poked = np.zeros((0, 3))
    for it in range(4):              # every other drawn mesh near the groin has to stay inside the closed skin
        pc = closure(P, N, T, st, cfg, poked)
        if it == 0:                  # only the points near the patch can come out
            near = cKDTree(pc['V']).query(ctx)[0] < 0.015; ctx, cmesh = ctx[near], cmesh[near]
            inside_old = ~outside(rt.Mesh(P, T), ctx)
        hidden = st['H'] | topo.spread(np.isin(np.arange(len(T)), st['R']))
        hidden &= ~topo.spread(np.isin(np.arange(len(T)), pc['back']))
        inner = inner_shell(P, T, hidden, st['outer'], pc['V'], pc['Fp'], st['q'], st['box'], cfg)
        torn = ~hidden & np.isin(T, pc['moved']).any(1)            # drawn skin at a source vertex the patch moved
        if (torn & st['outer']).any(): raise RuntimeError('the patch moved a vertex of drawn outer skin')
        hidden = topo.spread(hidden | inner | torn)
        poke = inside_old & outside(rt.Mesh(np.r_[P, pc['V']], np.r_[T[~hidden], pc['Fp'] + len(P)]), ctx)
        log('inner shell hidden %d, inner shell at moved vertices %d, drawn-mesh points outside %d %s' % (inner.sum(), torn.sum(), poke.sum(), sorted({names[k] for k in cmesh[poke]})))
        if not poke.any(): break
        poked = np.r_[poked, ctx[poke]]
    else:
        raise RuntimeError('drawn meshes stay outside the closed skin')
    V, Np, Fp, exact = pc['V'], pc['Np'], pc['Fp'], pc['exact']
    lo, hi = np.array(CONTEXT_BOX)                                    # outside the exported context the skin may not move
    far = ~np.all((V >= lo) & (V <= hi), axis=1) & (pc['shift'] > 5e-4)
    if far.any(): raise RuntimeError('%d patch vertices moved outside the exported context box' % far.sum())
    drawn_v = np.zeros(len(P), bool); drawn_v[T[~hidden].ravel()] = True
    seam = (exact >= 0) & drawn_v[np.maximum(exact, 0)]
    anchors = recast_anchors(P, N, T, hidden, V, Np, Fp)
    A0 = {a['key']: a for a in json.load(open(ANCHORS))}
    for a in anchors: a['moved'] = float(np.linalg.norm(np.subtract(a['surfacePoint'], A0[a['key']]['surfacePoint'])))
    kept = np.nonzero(~hidden)[0]; VV = np.r_[P, V]; TT = np.r_[T[kept], Fp + len(P)]
    fillv = np.nonzero(exact < 0)[0]; air = outside(rt.Mesh(P, T), V[fillv])
    mid = midline_heights(VV, TT); Om = np.c_[np.zeros(len(MID_Z)), mid + 1e-4, MID_Z]   # original non-genital outer skin above the closure
    tri, up = rt.Mesh(P, T[st['outer'] & ~st['G']]).cast(Om, np.tile([0, 1.0, 0], (len(MID_Z), 1)), tmax=0.1)[:2]
    stats = dict(midline=mid, peri=midline_heights(P, T)[0], pocket_mid=float(up[tri >= 0].max()) if (tri >= 0).any() else 0.0, pocket=float(cKDTree(P).query(V[fillv][air])[0].max()) if air.any() else 0.0)
    method, limits = method_and_limits(cfg, stats, anchors)
    for a in anchors: del a['moved']
    txt = write_json(P32, N32, T, hidden, V, Np, Fp, exact, seam, anchors, method, limits, out)
    os.makedirs(cache, exist_ok=True)
    np.savez(f'{cache}/state.tmp.npz', V=V, Np=Np, Fp=Fp, exact=exact, seam=seam, hidden=hidden, outer=st['outer'], G=st['G'], H=st['H'], loop=st['loop'], alpha=pc['alpha'])
    os.replace(f'{cache}/state.tmp.npz', f'{cache}/state.npz')
    log('hidden %d, patch %d vertices %d triangles (%d seam), %d bytes' % (hidden.sum(), len(V), len(Fp), seam.sum(), len(txt) + 1))


if __name__ == '__main__':
    arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
    main(out=arg('--out', OUT), cache=arg('--cache', CACHE))
