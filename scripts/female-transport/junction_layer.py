# Junction layer (carried vessels and lymph only). Where a carried branch
# opens into a vessel the female source models (vessel_connections.py), the
# part of the branch that touches the male trunk is moved onto the surface of
# the female trunk. Arteries share one smooth field over male coordinates, so
# carried arteries that meet each other move together, and the lymph nodes
# that lie along them follow it. Veins bend one by one at their root: the
# female source lays out its veins differently from the male one (pelvis, lung
# hilum), and a shared venous field dragged and pinched the vein beside a
# moving tributary (the external iliac vein next to the gluteal veins).
# Contacts that are not connections get no target.
# Writes .cache/female-transport/field-junctions.npz (read by field.py, tied to
# the field.npz it was fitted on) and data/catalog/female-junction-layer.json.
#
# Usage: .cache/female-ct-venv/bin/python scripts/female-transport/junction_layer.py [artery_sigma_mm,vein_sigma_mm]
import sys, json, hashlib, collections, numpy as np
sys.path.insert(0, 'scripts/female-transport')
from scipy.spatial import cKDTree
from scene import load
from field import Field
from vessel_pairs import PAIRS
from vessel_connections import CONNECTIONS, ALTERNATIVES, vessel_kind
from selection import selection
from inside import inside_any
CACHE = '.cache/female-transport'
CONFIG = dict(shared=['artery'], sigmaMm=dict(zip(('artery', 'vein'), [float(v) for v in (sys.argv[1] if len(sys.argv) > 1 else '20,25').split(',')])), contactMm=1.0, pointsPerJunction=16, mergeMm=8.0, toleranceMm=0.5, bendFromMm=2.0, bendWidth=1.5, bendMinMm=10.0, insideProbe=200, clusterMm=10.0, originMm=30.0, controlMm=5.0, repeats=int(sys.argv[2]) if len(sys.argv) > 2 else 3, seed=11)
rng = np.random.default_rng(CONFIG['seed'])
M = load(f'{CACHE}/male-scene'); F = load(f'{CACHE}/female-scene'); mby = {p['name']: p for p in M}
W = Field(male=M, junctions=False)
zname = {s['id']: s['name'] for s in json.load(open('data/full-system-structures.json'))}
zid = {v: k for k, v in zname.items()}
male_vessel = collections.defaultdict(list)
for p in M:
    if p['name'] in zname: male_vessel[zname[p['name']]].append(p['pos'])
female_vessel = {p['sourceName']: p for p in F if p['system'] in ('arterial', 'venous')}
def surface_points(p, n=40000):
    """Area-weighted surface samples of a female vessel (and their face normals)."""
    T = p['tri']; A = p['pos'][T[:, 0]]; B = p['pos'][T[:, 1]]; C = p['pos'][T[:, 2]]
    N = np.cross(B - A, C - A); area = np.linalg.norm(N, axis=1); k = rng.choice(len(T), n, p=area / area.sum())
    u, v = rng.random(n), rng.random(n); f = u + v > 1; u[f], v[f] = 1 - u[f], 1 - v[f]
    return A[k] + u[:, None] * (B[k] - A[k]) + v[:, None] * (C[k] - A[k]), N[k] / area[k, None]
trunks = {}
for males, females in PAIRS:
    pts, nrm = zip(*[surface_points(female_vessel[n]) for n in females]); fpts = np.vstack(pts)
    trunks['/'.join(females)] = (np.vstack([q for n in males for q in male_vessel[n]]), cKDTree(fpts), fpts, [female_vessel[n] for n in females])
carried = {o['id'] for o in selection()[0] if o['source'] in ('vessel-full.glb', 'reference/lymphatic_male.glb')}
def carried_pos(P): return W(P) + W.vessel_layer(P)
ctrl, resid, report, origins = [], [], [], []
for (branch, trunk), kind in sorted(CONNECTIONS.items()):
    bid = zid[branch]; assert bid in carried, branch
    mt = trunks[trunk][0]
    P = mby[bid]['pos']; d = cKDTree(mt).query(P)[0]; contact = d < CONFIG['contactMm'] / 1000
    # Each separate origin (a mesh such as the posterior intercostal arteries
    # holds several) is its own junction: contact points clustered at clusterMm.
    C = P[contact]; lab = -np.ones(len(C), int); n = 0
    for i in range(len(C)):
        if lab[i] >= 0: continue
        stack = [i]; lab[i] = n
        while stack:
            for k in cKDTree(C).query_ball_point(C[stack.pop()], CONFIG['clusterMm'] / 1000):
                if lab[k] < 0: lab[k] = n; stack.append(k)
        n += 1
    near_all = cKDTree(P)
    for c in range(n):
        # The smallest move that makes the branch near this origin meet the
        # female trunk: from its vertex nearest the trunk (within originMm of the
        # origin) to the trunk surface; none if it already lies inside the trunk
        # or within toleranceMm of it.
        cand = P[np.unique(np.concatenate(near_all.query_ball_point(C[lab == c], CONFIG['originMm'] / 1000)).astype(int))]
        q = carried_pos(cand)
        # The nearest of the female vessels the branch may open into.
        best = None
        for key in [trunk] + ALTERNATIVES.get((branch, trunk), []):
            _, ftree, fpts, fparts = trunks[key]; dd, j = ftree.query(q); near = np.argsort(dd)[:CONFIG['insideProbe']]
            k = int(np.argmin(dd)); gap = 0.0 if inside_any(q[near], fparts).any() else float(dd[k])
            if best is None or gap < best[0]: best = (gap, fpts[j[k]] - q[k], key, k)
        gap, r, met, k = best; inside = np.array([gap == 0.0])
        if gap <= CONFIG['toleranceMm'] / 1000: r = np.zeros(3)
        X = cand[np.linalg.norm(cand - cand[k], axis=1) < CONFIG['controlMm'] / 1000]
        if len(X) > CONFIG['pointsPerJunction']: X = X[rng.choice(len(X), CONFIG['pointsPerJunction'], replace=False)]
        ctrl.append(X); resid.append(np.repeat(r[None], len(X), 0)); origins.append((bid, cand, met))
        report.append(dict(branch=branch, trunk=trunk, met=met, kind=kind, origin=c, contactPoints=int((lab == c).sum()), insideTrunk=bool(inside.any()),
                           gapMm=round(gap * 1000, 2), moveMm=round(float(np.linalg.norm(r)) * 1000, 2)))

# One control per junction: the centre of the contact and its mean move onto
# the female trunk (contacts within mergeMm, such as the gastroduodenal artery
# at the common/proper hepatic division, are averaged). Overlapping controls
# are blended (a kernel average where their weights sum past 1), so the layer
# never overshoots its targets; a couple of repeats on what is left at the
# controls sharpen the fit and sum into the same weights.
def layer(P, X, Wt):
    K = np.exp(-((P[:, None] - X[None]) ** 2).sum(2) / (2 * s ** 2)); return (K @ Wt) / np.maximum(K.sum(1), 1)[:, None]
saved, stats = {}, {}
for kind in ('artery', 'vein'):
    s = CONFIG['sigmaMm'][kind] / 1000; saved[f'{kind}Sigma'] = s
    if kind not in CONFIG['shared']:
        saved[f'{kind}Points'] = np.zeros((0, 3)); saved[f'{kind}Weights'] = np.zeros((0, 3)); continue
    idx = [i for i, r in enumerate(report) if vessel_kind(r['branch']) == kind]
    cx = np.array([ctrl[i].mean(0) for i in idx]); cr = np.array([resid[i].mean(0) for i in idx]); cn = np.array([len(ctrl[i]) for i in idx], float)
    groups = []
    for i in np.argsort(-cn):
        for g in groups:
            if np.linalg.norm(cx[g[0]] - cx[i]) < CONFIG['mergeMm'] / 1000: g.append(i); break
        else: groups.append([i])
    X = np.array([np.average(cx[g], axis=0, weights=cn[g]) for g in groups]); R = np.array([np.average(cr[g], axis=0, weights=cn[g]) for g in groups])
    Wt = np.zeros_like(R)
    for _ in range(CONFIG['repeats']): Wt = Wt + R - layer(X, X, Wt)
    fit = np.linalg.norm(layer(X, X, Wt) - R, axis=1) * 1000
    # Steepest slope near the controls (finite differences around each).
    h = 1e-4; probe = (X[:, None] + rng.normal(size=(len(X), 64, 3)) * s * 0.7).reshape(-1, 3)
    grad = np.stack([(layer(probe + h * e, X, Wt) - layer(probe - h * e, X, Wt)) / (2 * h) for e in np.eye(3)], axis=2)
    det = np.linalg.det(np.eye(3)[None] + grad)
    saved[f'{kind}Points'] = X; saved[f'{kind}Weights'] = Wt
    stats[kind] = dict(connections=len(idx), controls=len(X), fitResidualMm=dict(median=round(float(np.median(fit)), 3), max=round(float(fit.max()), 3)),
                       moveMm=dict(median=round(float(np.median(np.linalg.norm(R, axis=1))) * 1000, 2), max=round(float(np.linalg.norm(R, axis=1).max()) * 1000, 2)),
                       slope=dict(maxGradient=round(float(np.abs(grad).max()), 3), minJacobian=round(float(det.min()), 3), samples=len(det)))
# Root bends. Where the shared layer still leaves a connection more than
# bendFromMm apart (a neighbour in the same network needs a different move,
# as the right upper-lobe veins beside the connected apical vein), only that
# vessel bends near its origin onto the trunk: a Gaussian centred on the
# origin vertex, at least bendWidth times as wide as the move, so its slope
# stays below ~0.4 and the vessel's cross-section never turns over.
bends = []
for (bid, cand, trunk), r0 in zip(origins, report):
    kind = vessel_kind(r0['branch']); X, Wt, s = saved[f'{kind}Points'], saved[f'{kind}Weights'], saved[f'{kind}Sigma']
    _, ftree, fpts, fparts = trunks[trunk]
    q = carried_pos(cand) + (layer(cand, X, Wt) if len(X) else 0); dd, j = ftree.query(q); inside = inside_any(q[np.argsort(dd)[:CONFIG['insideProbe']]], fparts)
    k = int(np.argmin(dd)); gap = 0.0 if inside.any() else float(dd[k]); r0['afterSharedMm'] = round(gap * 1000, 2)
    if gap > (CONFIG['bendFromMm'] if kind in CONFIG['shared'] else CONFIG['toleranceMm']) / 1000:
        r = fpts[j[k]] - q[k]; width = max(CONFIG['bendWidth'] * float(np.linalg.norm(r)), CONFIG['bendMinMm'] / 1000)
        bends.append((bid, cand[k], r, width)); r0['rootBend'] = dict(moveMm=round(float(np.linalg.norm(r)) * 1000, 2), widthMm=round(width * 1000, 1))
field_sha = hashlib.sha256(open(f'{CACHE}/field.npz', 'rb').read()).hexdigest()
np.savez(f'{CACHE}/field-junctions.npz', fieldSha256=field_sha, bendIds=np.array([b[0] for b in bends]), bendPoints=np.array([b[1] for b in bends]).reshape(-1, 3),
         bendMoves=np.array([b[2] for b in bends]).reshape(-1, 3), bendWidths=np.array([b[3] for b in bends]), **saved)
summary = dict(version=1, createdBy='scripts/female-transport/junction_layer.py', config=CONFIG, fieldSha256=field_sha, connections=len(CONNECTIONS), layers=stats,
               rootBends=[dict(branch=r['branch'], trunk=r['trunk'], **r['rootBend']) for r in report if 'rootBend' in r], junctions=report)
json.dump(summary, open('data/catalog/female-junction-layer.json', 'w'), indent=1)
print(json.dumps(stats)); print(json.dumps(summary['rootBends']))
