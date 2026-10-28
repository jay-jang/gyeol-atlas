# Checks data/modesty-male-skin.json against the skin it closes: the file
# contract (src/modesty-skin.ts), the seam (patch vertices that are skin
# vertices, bit for bit as float32), stored normals against the patch geometry,
# open edges and see-through rays around the groin, the midline closure height
# from below, how far the patch lies in the original's open air and whether it
# shows where the original showed background, the drawn meshes left outside
# the closed skin, and the re-cast markers. Prints one JSON report with a
# "failed" list (empty when every check passes); exits 1 when it is not empty.
#
# Reads the state.npz that gen.py wrote with FILE (.cache/modesty or --cache DIR).
#
# Usage: .cache/female-ct-venv/bin/python -I scripts/modesty/check.py [FILE] [--cache DIR]
import sys, json, hashlib
sys.path.insert(0, 'scripts/modesty')
import numpy as np
from scipy.spatial import cKDTree
import rt
from gen import load, face_normals, vertex_normals, outside, in_groin, ell_q, context_samples, IN, OUT, ANCHORS, CACHE, SKIN_SHA, ELL_C, ELL_R

arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
cache = arg('--cache', CACHE); path = next((a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] != '--cache'), OUT)
P32, N32, T, _ = load(); P = P32.astype(float)
raw = open(path, 'rb').read(); j = json.loads(raw); rep = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}; failed = []
check = lambda name, ok: None if ok else failed.append(name)
H = np.array(j['hiddenTriangles']); X32 = np.array(j['patch']['positions'], np.float32).reshape(-1, 3); X = X32.astype(float)
NX = np.array(j['patch']['normals'], float).reshape(-1, 3); F = np.array(j['patch']['indices']).reshape(-1, 3)
hidden = np.zeros(len(T), bool); hidden[H] = True; kept = np.nonzero(~hidden)[0]
fn = face_normals(X, F); against = int(((fn * NX[F].mean(1)).sum(1) < 0).sum())
rep['contract'] = {'source': j['source'], 'hidden': len(H), 'hidden_sorted_unique': bool((np.diff(H) > 0).all()),
                   'patch_vertices': len(X), 'patch_triangles': len(F), 'indices_in_range': bool(F.min() >= 0 and F.max() < len(X)),
                   'normal_length_max_error': float(np.abs(np.linalg.norm(NX, axis=1) - 1).max()), 'faces_against_their_normals': against}
check('contract', j['source'] == {'file': 'public/models/skin.glb', 'node': 'FMA7163', 'sha256': SKIN_SHA, 'triangles': len(T)} and rep['contract']['hidden_sorted_unique'] and rep['contract']['indices_in_range'] and rep['contract']['normal_length_max_error'] < 1e-3)
check('faces against their normals', against == 0)
check('size', len(raw) < 100_000)                                   # the runtime fetches it with the male skin

# seam: patch vertices equal (as float32) to vertices of drawn skin triangles
skin_keys = {tuple(v): i for i, v in enumerate(P32.view(np.uint32))}
exact = np.array([skin_keys.get(tuple(v), -1) for v in X32.view(np.uint32)])
drawn_v = np.zeros(len(P), bool); drawn_v[T[kept].ravel()] = True
seam = (exact >= 0) & drawn_v[np.maximum(exact, 0)]
d = cKDTree(P[drawn_v]).query(X[~seam])[0]
rep['seam'] = {'patch_vertices_equal_to_drawn_skin_vertices': int(seam.sum()), 'their_normals_equal_to_skin_float32': int((NX[seam].astype(np.float32) == N32[exact[seam]]).all(1).sum()),
               'other_patch_vertices_within_0.1mm_of_a_drawn_skin_vertex': int((d < 1e-4).sum())}
check('seam', rep['seam']['their_normals_equal_to_skin_float32'] == seam.sum() and rep['seam']['other_patch_vertices_within_0.1mm_of_a_drawn_skin_vertex'] == 0)
ang = np.degrees(np.arccos(np.clip((NX * vertex_normals(X, F)).sum(1), -1, 1)))[~seam]
corner = (fn[:, None, :] * NX[F]).sum(2).min(1)
rep['least_corner_normal_vs_face_cos'] = {'min': round(float(corner.min()), 3), 'triangles_below_0.1': int((corner < 0.1).sum())}
rep['stored_vs_geometry_normal_deg_(non-seam)'] = {'p50': round(float(np.percentile(ang, 50)), 2), 'p95': round(float(np.percentile(ang, 95)), 2), 'max': round(float(ang.max()), 2)}

# open edges of the drawn surface (kept skin + patch, welded by exact float32 position) around the groin
VV32 = np.r_[P32, X32]; TT = np.r_[T[kept], F + len(P)]; VV = VV32.astype(float)
_, weld = np.unique(VV32.view(np.uint32).reshape(-1, 3), axis=0, return_inverse=True); weld = weld.ravel()
E = np.sort(weld[np.r_[TT[:, [0, 1]], TT[:, [1, 2]], TT[:, [2, 0]]]], 1); own = np.tile(np.arange(len(TT)), 3)
_, inv, cnt = np.unique(E[:, 0] * (weld.max() + 1) + E[:, 1], return_inverse=True, return_counts=True)
open_e = (cnt[inv.ravel()] == 1) & (ell_q((VV[TT[own, 0]] + VV[TT[own, 1]]) / 2) < 4)
st = np.load(f'{cache}/state.npz'); outer = st['outer']
check('state matches the file', np.array_equal(st['hidden'], hidden) and np.array_equal(st['Fp'], F))
on_patch = own >= len(kept); src_t = kept[np.minimum(own, len(kept) - 1)]
rep['open_edges_near_groin'] = {'on_patch': int((open_e & on_patch).sum()), 'on_outer_skin': int((open_e & ~on_patch & outer[src_t]).sum()),
                                'on_inner_shell_skin': int((open_e & ~on_patch & ~outer[src_t]).sum())}
check('open edges', rep['open_edges_near_groin']['on_patch'] == 0 and rep['open_edges_near_groin']['on_outer_skin'] == 0)

# see-through: rays from a 0.3 m sphere around the groin to points of the genital region; a back face first hit
# means a hole (FrontSide); a miss where the original skin was hit means a gap
rng = np.random.default_rng(12345); n = 60000
W = rng.normal(size=(n, 3)); W /= np.linalg.norm(W, axis=1)[:, None]; S0 = np.array([0, 0.75, 0.02]) + 0.3 * W
U = rng.normal(size=(n, 3)); U /= np.linalg.norm(U, axis=1)[:, None]
TG = ELL_C + U * rng.random((n, 1)) ** (1 / 3) * ELL_R * 1.3
D = TG - S0; D /= np.linalg.norm(D, axis=1)[:, None]
new, old = rt.Mesh(VV, TT), rt.Mesh(P, T)
h0 = old.cast(S0, D)[0]; h1, t1, _, _, f1 = new.cast(S0, D)
start_out = outside(old, S0)                                        # the start point is in open air (rays escape the original)
bk = start_out & (h1 >= 0) & ~f1
hf, tf = new.cast(S0[bk], D[bk], cull=1)[:2]                      # FrontSide draws the first front face behind it
thin = (hf >= 0) & (tf - t1[bk] < 0.003)
rep['rays'] = {'cast': n, 'starting_outside': int(start_out.sum()), 'first_hit_back_face': int(bk.sum()),
               'back_face_hits_on_patch': int((h1[bk] >= len(kept)).sum()), 'back_face_with_front_face_within_3mm_behind': int(thin.sum()),
               'see_through': int((~thin).sum()), 'miss_where_original_hit': int((start_out & (h1 < 0) & (h0 >= 0)).sum())}
check('see-through', (~thin).sum() == 0)

# midline closure height from straight below (closed surface) against the original perineum (full source skin, z <= -1 cm)
zs = np.round(np.arange(-0.03, 0.0501, 0.01), 3)
O = np.c_[np.zeros(len(zs)), np.full(len(zs), 0.5), zs]; Dup = np.tile([0, 1.0, 0], (len(zs), 1))
tri, t, *_ = new.cast(O, Dup); to = old.cast(O, Dup)[1]
rep['midline_from_below_y'] = {str(z): {'closed': round(0.5 + float(a), 4), 'surface': 'patch' if tr >= len(kept) else 'skin', 'original': round(0.5 + float(b), 4) if z <= -0.01 else None}
                               for z, a, b, tr in zip(zs, t, to, tri)}
peri = 0.5 + float(to[list(zs).index(-0.01)])
check('midline floor', all(0.5 + float(a) >= peri - 0.001 for z, a in zip(zs, t) if z >= -0.01))   # 1 mm: the faired perineum seam

# patch in the original's open air (some of 26 rays escape the intact original) and how deep; pixels where the
# original showed background and the closed surface shows skin (a web or a protrusion), per camera
fill = np.nonzero(exact < 0)[0]; air = outside(old, X[fill]); dist = cKDTree(P).query(X[fill][air])[0] if air.any() else np.zeros(1)
rep['patch_in_original_open_air'] = {'vertices': int(air.sum()), 'of': len(fill), 'max_depth_mm_(pocket_closed)': round(float(dist.max() * 1e3), 1),
                                     'lowest_new_vertex_y': round(float(X[fill, 1].min()), 4)}
def cam(eye, target, size=240, fov=0.3):
    eye = np.array(eye, float); f = np.subtract(target, eye); f /= np.linalg.norm(f); r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r); u = np.cross(r, f)
    s = np.linspace(-np.tan(fov / 2), np.tan(fov / 2), size); a, b = np.meshgrid(s, -s)
    Dc = f + a.reshape(-1, 1) * r + b.reshape(-1, 1) * u; return np.broadcast_to(eye, Dc.shape), Dc / np.linalg.norm(Dc, axis=1, keepdims=True)
views = {'front': ((0, 0.77, 0.55), (0, 0.76, 0.02)), 'obl-l': ((0.32, 0.8, 0.45), (0, 0.76, 0.02)), 'obl-r': ((-0.32, 0.8, 0.45), (0, 0.76, 0.02)),
         'below': ((0.12, 0.35, 0.45), (0, 0.74, 0.02)), 'side': ((0.55, 0.76, 0.05), (0, 0.76, 0.02)), 'back-below': ((0.05, 0.45, -0.5), (0, 0.74, 0))}
rep['views'] = {}
for k, (e, tg) in views.items():
    Oc, Dc = cam(e, tg); a0, ta = old.cast(Oc, Dc, cull=1)[:2]; a1, tb = new.cast(Oc, Dc, cull=1)[:2]
    both = (a0 >= 0) & (a1 >= 0)
    rep['views'][k] = {'background_to_surface_px': int(((a0 < 0) & (a1 >= 0)).sum()), 'surface_to_background_px': int(((a0 >= 0) & (a1 < 0)).sum()),
                       'max_nearer_than_original_mm': round(float((ta - tb)[both].max() * 1e3), 1)}
check('silhouette', all(v['background_to_surface_px'] <= 2 for v in rep['views'].values()))   # 2 of 57,600 px: edge aliasing

# drawn meshes (not hidden by the runtime) near the groin left outside the closed skin, and inside the original
names = json.load(open(f'{IN}/source.json'))['context']; Q, mesh = context_samples(0.001)
near = cKDTree(X).query(Q)[0] < 0.02; Q, mesh = Q[near], mesh[near]   # farther from the patch nothing changed
bad = outside(new, Q) & ~outside(old, Q)
rep['context_points_outside_closed_skin'] = {names[int(k)]: int((mesh[bad] == k).sum()) for k in np.unique(mesh[bad])}
rep['context_points_checked_(1_mm_apart,_within_2_cm_of_the_patch)'] = len(Q)
check('context meshes', not bad.any())

# markers: re-cast ones (moved, marker in open air, facing out of the closure rather than into the thigh gap), and
# that no other groin marker is enclosed
A = {a['key']: a for a in json.load(open(ANCHORS))}; moved = {a['key']: a for a in j['anchors']}
def out_dir(p, nrm, k=64):
    """Fraction of rays from the marker within 60 degrees of its outward direction that leave the closed surface."""
    r = np.random.default_rng(7).normal(size=(k * 4, 3)); r /= np.linalg.norm(r, axis=1)[:, None]; r = r[r @ nrm > 0.5][:k]
    return float((new.cast(np.broadcast_to(p, r.shape), r)[0] < 0).mean())
rep['anchors'] = []
for a in j['anchors']:
    nrm = np.subtract(a['position'], a['surfacePoint']); nrm /= np.linalg.norm(nrm)
    rep['anchors'].append({'key': a['key'], 'surface_moved_mm': round(float(np.linalg.norm(np.subtract(a['surfacePoint'], A[a['key']]['surfacePoint'])) * 1e3), 2),
                           'position_moved_mm': round(float(np.linalg.norm(np.subtract(a['position'], A[a['key']]['position'])) * 1e3), 2),
                           'normal': np.round(nrm, 2).tolist(), 'open_within_60deg': round(out_dir(np.array(a['position']), nrm), 2),
                           'marker_outside_closed_skin': bool(outside(new, np.array([a['position']]))[0])})
groin = [a for a in A.values() if in_groin(np.array(a['surfacePoint']))]
pos = np.array([moved.get(a['key'], a)['position'] for a in groin])
rep['groin_markers_inside_closed_skin'] = [a['key'] for a, o in zip(groin, outside(new, pos)) if not o]
check('markers', not rep['groin_markers_inside_closed_skin'] and all(a['marker_outside_closed_skin'] and a['open_within_60deg'] > 0.5 for a in rep['anchors']))
rep['failed'] = failed
print(json.dumps(rep, indent=1, ensure_ascii=False))
sys.exit(1 if failed else 0)
