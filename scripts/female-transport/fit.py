# Fit the male -> female registration field used to carry male-derived
# structures (Z-Anatomy vessels, nerves, ligaments, tendons, lymph;
# BodyParts3D muscles and the borrowed bones) into the HRA female body.
#
#   W(p) = P(p) + R(P(p))
#   P: articulated pre-pose. Each skeletal segment (torso, head, upper arm,
#      forearm+hand, thigh, leg, foot) gets the similarity that best carries its
#      male bones onto the female ones; the transforms are blended with
#      Gaussian weights of the distance to each segment's male bones.
#   R: residual cubic B-spline free-form deformation (2 cm grid) with a
#      bending-energy penalty, fitted to every correspondence.
#   S: skin layer. Near the male skin, a smooth kernel average of the
#      remaining skin residuals (male skin carried onto the female skin along
#      the female normal) fades in, so a structure keeps the depth below the
#      skin it has in the male source.
#
# Correspondences: native HRA female bones (stiff), the female skin (outer
# surface, matched iteratively along compatible normals; breast skin and the
# male external genitalia excluded), eyes and a few organs (soft), and the
# borrowed male-derived bones that lie inside the female skin (guides, weak).
# A borrowed bone that crosses the skin, and the borrowed thorax/girdle, are
# not guides; the same field re-places them later.
#
# Usage: .cache/female-ct-venv/bin/python scripts/female-transport/fit.py
import sys, json, time, hashlib, re, collections, numpy as np
sys.path.insert(0, 'scripts/female-transport')
from scipy.spatial import cKDTree
from scene import load
from pairs import female_to_male, male_bones, GUIDE_EXCLUDED
from bonefit import icp, init_centroid, apply, umeyama
from segments import segment_of
from field import group
from vessel_pairs import PAIRS
from ffd import FFD

CACHE = '.cache/female-transport'
CONFIG = dict(grid=0.02, bending=1e-2, sigma=0.03, iterations=[0.05, 0.025, 0.015], skinSigma=0.006, skinVoxel=0.006, skinMaxResidual=0.025,
              weight=dict(native=1.0, skin=0.4, eye=0.6, organ=0.08, borrowed=0.1, trunk=0.5, visceral=0.15),
              vesselRadii=[0.06, 0.03, 0.015], outsideMm=2.0, snapMm=6.0, seed=7)
rng = np.random.default_rng(CONFIG['seed']); T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
def sha(path): return hashlib.sha256(open(path, 'rb').read()).hexdigest()
F = load(f'{CACHE}/female-scene'); M = load(f'{CACHE}/male-scene')
mby = {p['name']: p for p in M}
inputs = {a['id']: a for a in json.load(open('scripts/model-inputs.json'))['assets']}
def cloud(name):
    a = np.frombuffer(open(f'{CACHE}/{name}', 'rb').read(), dtype=np.float32).reshape(-1, 6).astype(np.float64); return a[:, :3], a[:, 3:]
fs_, fn = cloud('female-skin-points.bin'); ms, mn = cloud('male-skin-points.bin')
fst = cKDTree(fs_)
def outside_female(P): d, j = fst.query(P, workers=-1); return ((P - fs_[j]) * fn[j]).sum(1) > CONFIG['outsideMm'] / 1000
crossing = {p['name'] for p in F if p['system'] == 'borrowed' and outside_female(p['pos']).any()}
def tri_area(P, T): return np.linalg.norm(np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]), axis=1) / 2
def surface_sample(P, T, n):
    a = tri_area(P, T); k = rng.choice(len(T), n, p=a / a.sum()); r1, r2 = rng.random(n), rng.random(n); s = np.sqrt(r1)
    return P[T[k, 0]] * (1 - s)[:, None] + P[T[k, 1]] * (s * (1 - r2))[:, None] + P[T[k, 2]] * (s * r2)[:, None]
def merged(parts):
    pos = np.vstack([q['pos'] for q in parts]); offs = np.cumsum([0] + [len(q['pos']) for q in parts])[:-1]
    return pos, np.vstack([q['tri'] + o for q, o in zip(parts, offs)])
import os
LS_SPLIT = os.environ.get('LS_SPLIT', '0') == '1'; USE_VESSELS = os.environ.get('VESSELS', '0') == '1'
CONFIG['lumbosacral'] = 'male sacrum S1 part <-> female lumbar vertebra 6' if LS_SPLIT else 'male L1-L5 <-> female L1-L5, sacrum <-> sacrum'
CONFIG['vesselCorrespondences'] = USE_VESSELS
if LS_SPLIT:
    # The female (VHF) spine has six lumbar vertebrae and a sacrum 47 mm shorter
    # than the male one: her L6 corresponds to the male first sacral segment.
    S = mby['FMA16202']; c = S['pos'].mean(0); axis = np.linalg.svd(S['pos'] - c, full_matrices=False)[2][0]
    if axis[1] < 0: axis = -axis
    proj = (S['pos'] - c) @ axis; cut = np.quantile(proj, 0.75)
    for key, keep in (('FMA16202:S1', proj >= cut), ('FMA16202:S2', proj < cut)):
        tri = S['tri'][keep[S['tri']].all(1)]; used = np.unique(tri); remap = -np.ones(len(S['pos']), int); remap[used] = np.arange(len(used))
        mby[key] = {'pos': S['pos'][used], 'tri': remap[tri]}
        inputs[key] = {'name': 'sacrum', 'layer': 'bone'}
        male_bones[key] = key
pairs = collections.defaultdict(list); excluded = collections.defaultdict(list)
for p in F:
    if p['layer'] != 'bone': continue
    t = female_to_male(p['sourceName'] or p['name'])
    if LS_SPLIT and p['sourceName'] == 'Lumbar vertebra 6': t = 'FMA16202:S1'
    if LS_SPLIT and p['sourceName'] == 'Sacrum': t = 'FMA16202:S2'
    if not t: continue
    kind = 'borrowed' if p['system'] == 'borrowed' else 'native'
    if kind == 'borrowed' and p['name'] in crossing: excluded['crosses the female skin'].append(p['sourceName']); continue
    if kind == 'borrowed' and GUIDE_EXCLUDED.search(t): excluded['borrowed thorax or shoulder girdle'].append(p['sourceName']); continue
    pairs[((male_bones[t],), kind)].append(p)
def fparts(pred): return [p for p in F if pred(p['sourceName'] or p['name'], p)]
ORGANS = [
    (('FMA12513',), 'eye', fparts(lambda n, p: re.match(r'(Sclera|Cornea) \((left|right)\)$', n))),
    (('FMA7333', 'FMA7337', 'FMA7383'), 'organ', fparts(lambda n, p: p['system'] == 'respiratory' and re.match(r'Right .*bronchopulmonary segment', n))),
    (('FMA7370', 'FMA7371'), 'organ', fparts(lambda n, p: p['system'] == 'respiratory' and re.match(r'(Left|Lingula) .*bronchopulmonary segment', n))),
    (('FMA7274',), 'organ', fparts(lambda n, p: n in ('Left cardiac atrium', 'Left ventricle', 'Right cardiac atrium', 'Right ventricle'))),
    (('FMA7197',), 'organ', fparts(lambda n, p: n == 'Capsule of the liver')),
    (('FMA7204',), 'organ', fparts(lambda n, p: n == 'Kidney capsule (right)')),
    (('FMA7205',), 'organ', fparts(lambda n, p: n == 'Kidney capsule (left)')),
    (('FMA7394',), 'organ', fparts(lambda n, p: n == 'Trachea')),
    (('FMA55099',), 'organ', fparts(lambda n, p: n == 'Thyroid cartilage')),
]
for mids, kind, parts in ORGANS:
    assert parts, mids
    pairs[(mids, kind)] = parts
ctrl, held, pair_report = [], [], []
for (mids, kind), parts in pairs.items():
    fpos, ftri = merged(parts); fdense = np.vstack([fpos, surface_sample(fpos, ftri, 6000)])
    mpos, mtri = merged([mby[m] for m in mids])
    src = mpos[rng.choice(len(mpos), min(2000, len(mpos)), replace=False)]
    T, rms, p95 = icp(src, fdense, init_centroid(src, fdense))
    n = int(np.clip(tri_area(mpos, mtri).sum() * 30000, 16, 400 if kind == 'organ' else 220))
    pts = surface_sample(mpos, mtri, 2 * n); q = apply(T, pts); d, j = cKDTree(fdense).query(q)
    tgt = np.where((d < CONFIG['snapMm'] / 1000)[:, None], fdense[j], q)
    seg = group(segment_of(inputs[mids[0]]['name'])) if kind in ('native', 'borrowed') else ('head' if kind == 'eye' else 'organ')
    ctrl.append(dict(kind=kind, seg=seg, X=pts[:n], Y=tgt[:n])); held.append(dict(kind=kind, male=mids, X=pts[n:], Y=tgt[n:]))
    pair_report.append(dict(kind=kind, male=[inputs[m]['name'] for m in mids], female=sorted(p['name'] for p in parts),
                            similarity=dict(scale=round(float(T[0]), 4), rotationDeg=round(float(np.degrees(np.arccos(np.clip((np.trace(T[1]) - 1) / 2, -1, 1)))), 2)),
                            icpRmsMm=round(rms * 1000, 2), controls=n))
log('controls', dict(collections.Counter(c['kind'] for c in ctrl)))
# ---- articulated pre-pose ----
segX, segY = collections.defaultdict(list), collections.defaultdict(list)
for c in ctrl:
    if c['kind'] in ('native', 'borrowed', 'eye'): segX[c['seg']].append(c['X']); segY[c['seg']].append(c['Y'])
segs = sorted(segX); segT = {}; seg_report = {}
for s in segs:
    X, Y = np.vstack(segX[s]), np.vstack(segY[s]); T = umeyama(X, Y); e = np.linalg.norm(apply(T, X) - Y, axis=1); segT[s] = T
    seg_report[s] = dict(controls=len(X), scale=round(float(T[0]), 4), rotationDeg=round(float(np.degrees(np.arccos(np.clip((np.trace(T[1]) - 1) / 2, -1, 1)))), 2), rmsMm=round(float(np.sqrt((e ** 2).mean())) * 1000, 2))
clouds = collections.defaultdict(list)
for a in inputs.values():
    if a['layer'] == 'bone' and a.get('id') in mby and group(segment_of(a['name'])) in segT: clouds[group(segment_of(a['name']))].append(mby[a['id']]['pos'])
trees = {s: cKDTree(np.vstack(clouds[s])) for s in segs}
def prepose(P):
    D = np.stack([trees[s].query(P, workers=-1)[0] for s in segs], axis=1); dmin = D.min(1, keepdims=True)
    w = np.exp(-(D ** 2 - dmin ** 2) / (2 * CONFIG['sigma'] ** 2)); w /= w.sum(1, keepdims=True)
    return sum(w[:, k:k + 1] * apply(segT[s], P) for k, s in enumerate(segs))
# ---- skin correspondences + residual FFD ----
breast = np.vstack([p['pos'] for p in F if p['system'] == 'integumentary' and p['name'] not in ('HRAF0003', 'HRAF0000', 'HRAF0001', 'HRAF0002')])
f_ok = cKDTree(breast).query(fs_)[0] > 0.02
genital = [i for i, a in inputs.items() if re.search(r'penis|scrot|testis|glans', a['name'], re.I)]
m_ok = cKDTree(np.vstack([mby[i]['pos'] for i in genital])).query(ms)[0] > 0.025
fsel, fnsel = fs_[f_ok], fn[f_ok]; ftree = cKDTree(fsel)
# Male chest skin that the pre-pose carries under the female breast has no
# skin counterpart there (the breast lies between it and her skin).
under_breast = cKDTree(breast).query(prepose(ms), workers=-1)[0] < 0.03
m_ok = m_ok & ~under_breast
key = np.floor(ms / 0.010).astype(np.int64); _, first = np.unique(key, axis=0, return_index=True); first = first[m_ok[first]]
perm = rng.permutation(first); test, train = perm[:3000], perm[3000:]
W8 = CONFIG['weight']
Xc = np.vstack([c['X'] for c in ctrl]); Yc = np.vstack([c['Y'] for c in ctrl]); Wc = np.concatenate([np.full(len(c['X']), W8[c['kind']]) for c in ctrl])
PXc = prepose(Xc); Pms = prepose(ms)
lo = np.minimum(PXc.min(0), fs_.min(0)) - 0.02; hi = np.maximum(PXc.max(0), fs_.max(0)) + 0.02
ffd = FFD(lo, hi, CONFIG['grid']); log('grid', ffd.n.tolist())
def warp_preposed(PP): return PP + ffd(PP)
def match(idx, radius):
    p, n = ms[idx], mn[idx]; q = warp_preposed(Pms[idx]); qn = warp_preposed(prepose(p + 0.004 * n)); nt = qn - q; nt /= np.linalg.norm(nt, axis=1)[:, None]
    d, j = ftree.query(q, k=24, distance_upper_bound=radius, workers=-1); best = np.full(len(q), -1); bd = np.full(len(q), np.inf)
    for c in range(24):
        ok = np.isfinite(d[:, c]); jj = np.where(ok, j[:, c], 0); better = ok & ((fnsel[jj] * nt).sum(1) > 0.6) & (d[:, c] < bd)
        best[better] = jj[better]; bd[better] = d[better, c]
    return best
x0 = None; skin_report = []
# ---- vessels the female source models: the same vessel, matched along its course ----
VISCERAL = re.compile(r'mesenteric|colic|sigmoid|rectal|anorectal|marginal|splenic|hepatic|portal|coeliac|celiac|ileocolic')
zname = {s['id']: s['name'] for s in json.load(open('data/full-system-structures.json'))}
male_vessel = collections.defaultdict(list)
for p in M:
    if p['name'] in zname: male_vessel[zname[p['name']]].append(p)
female_vessel = {p['sourceName']: p for p in F if p['system'] in ('arterial', 'venous')}
vessel_groups = []
for males, females in PAIRS:
    mpos, mtri = merged([q for n in males for q in male_vessel[n]]); fpos, ftri = merged([female_vessel[n] for n in females])
    fdense = np.vstack([fpos, surface_sample(fpos, ftri, 3000)])
    n = int(np.clip(tri_area(mpos, mtri).sum() * 20000, 20, 160))
    kind = 'visceral' if VISCERAL.search(' '.join(males).lower()) else 'trunk'
    vessel_groups.append(dict(kind=kind, males=males, females=females, X=surface_sample(mpos, mtri, n), tree=cKDTree(fdense), F=fdense))
VX = np.vstack([g['X'] for g in vessel_groups]); PVX = prepose(VX)
VW = np.concatenate([np.full(len(g['X']), W8[g['kind']]) for g in vessel_groups])
vessel_report = []
def match_vessels(radius):
    q = warp_preposed(PVX); tgt = np.full_like(q, np.nan); o = 0
    for g in vessel_groups:
        k = len(g['X']); d, j = g['tree'].query(q[o:o + k], distance_upper_bound=radius); ok = np.isfinite(d)
        tgt[o:o + k][ok] = g['F'][j[ok]]; o += k
    return tgt
for it, radius in enumerate(CONFIG['iterations']):
    best = match(train, radius); ok = best >= 0
    vt = match_vessels(CONFIG['vesselRadii'][it]); vok = np.isfinite(vt[:, 0]) & USE_VESSELS
    vessel_report.append(dict(radiusMm=CONFIG['vesselRadii'][it] * 1000, matched=int(vok.sum()), of=len(vt)))
    P = np.vstack([PXc, Pms[train][ok], PVX[vok]]); Y = np.vstack([Yc, fsel[best[ok]], vt[vok]])
    w = np.concatenate([Wc, np.full(ok.sum(), W8['skin']), VW[vok]])
    ffd.fit(P, Y - P, w, CONFIG['bending'], x0=x0); x0 = ffd.coef.copy()
    qt = warp_preposed(Pms[test]); dt, jt = cKDTree(fs_).query(qt, workers=-1); out = ((qt - fs_[jt]) * fn[jt]).sum(1) > CONFIG['outsideMm'] / 1000
    skin_report.append(dict(radiusMm=radius * 1000, pairs=int(ok.sum()), heldOutMedianMm=round(float(np.median(dt)) * 1000, 2), heldOutP90Mm=round(float(np.quantile(dt, .9)) * 1000, 2), heldOutOutside=round(float(out.mean()), 4)))
    log('skin', skin_report[-1])
W0 = lambda X: warp_preposed(prepose(X))
# ---- skin layer ----
key = np.floor(ms / CONFIG['skinVoxel']).astype(np.int64); _, sk = np.unique(key, axis=0, return_index=True)
SP, SN = ms[sk], mn[sk]; q = W0(SP); qn = W0(SP + 0.004 * SN) - q; qn /= np.linalg.norm(qn, axis=1)[:, None]
d, j = ftree.query(q, k=8, workers=-1); resid = np.zeros_like(q); used = np.zeros(len(q), bool)
for c in range(8):
    jj = j[:, c]; agree = (fnsel[jj] * qn).sum(1) > 0.5; free = ~used & agree & (d[:, c] < CONFIG['skinMaxResidual'] * 2)
    delta = ((q - fsel[jj]) * fnsel[jj]).sum(1); ok = free & (np.abs(delta) < CONFIG['skinMaxResidual'])
    resid[ok] = -delta[ok, None] * fnsel[jj][ok]; used |= free
resid[~m_ok[sk]] = 0
stree = cKDTree(SP); SIG = CONFIG['skinSigma']
def skin_mass(P):
    dd, jj = stree.query(P, k=64, workers=-1); return np.exp(-dd ** 2 / (2 * SIG ** 2)), jj
K, jj = skin_mass(SP); MASS = float(np.median(K.sum(1)))
def skin_layer(P):
    K, jj = skin_mass(P); return (K[:, :, None] * resid[jj]).sum(1) / np.maximum(K.sum(1), MASS)[:, None]
W = lambda X: W0(X) + skin_layer(X)
# ---- vessel layer (applied to carried vessels and lymph only) ----
# Where the female source has the same vessel, carried branches should join
# it. The height of the iliac bifurcation and the course of visceral vessels
# vary between bodies, so these are not body-wide correspondences: each
# group is aligned rigidly to its female vessel, snapped to its surface, and
# the residual spreads to nearby carried vessels with a 25 mm kernel.
VSIG = CONFIG['vesselSigma'] = 0.025
vP, vR, vessel_layer_report = [], [], []
for g in vessel_groups:
    # Translation-only trimmed ICP: thin, partly modelled tubes make rotations unstable.
    q = W(g['X']); shift = np.zeros(3)
    for _ in range(30):
        d, j = g['tree'].query(q + shift); keep = d <= np.quantile(d, 0.7)
        shift = shift + (g['F'][j[keep]] - (q + shift)[keep]).mean(0)
    t = q + shift; d, j = g['tree'].query(t); t = np.where((d < 0.01)[:, None], g['F'][j], t)
    before = float(np.median(g['tree'].query(q)[0])); after = float(np.median(g['tree'].query(t)[0]))
    used = np.linalg.norm(shift) < 0.1
    if used: vP.append(g['X']); vR.append(t - q)
    vessel_layer_report.append(dict(female='/'.join(g['females']), beforeMm=round(before * 1000, 1), afterMm=round(after * 1000, 1), shiftMm=round(float(np.linalg.norm(shift)) * 1000, 1), used=bool(used)))
vP, vR = np.vstack(vP), np.vstack(vR); vtree = cKDTree(vP)
VMASS = float(np.median(np.exp(-vtree.query(vP, k=64)[0] ** 2 / (2 * VSIG ** 2)).sum(1)))
log('vessel layer', vessel_layer_report)
qt = W(ms[test]); dt, jt = cKDTree(fs_).query(qt, workers=-1); out = ((qt - fs_[jt]) * fn[jt]).sum(1) > CONFIG['outsideMm'] / 1000
skin_report.append(dict(stage='skin layer', residualPoints=int((np.linalg.norm(resid, axis=1) > 0).sum()), heldOutMedianMm=round(float(np.median(dt)) * 1000, 2), heldOutP90Mm=round(float(np.quantile(dt, .9)) * 1000, 2), heldOutOutside=round(float(out.mean()), 4)))
log('skin', skin_report[-1])
held_report = {}
for kind in ['native', 'borrowed', 'eye', 'organ']:
    errs = [float(np.median(np.linalg.norm(W(h['X']) - h['Y'], axis=1))) * 1000 for h in held if h['kind'] == kind]
    held_report[kind] = dict(pairs=len(errs), medianOfMediansMm=round(float(np.median(errs)), 2), maxMm=round(float(np.max(errs)), 2))
log('held-out', held_report)
# ---- folding and smoothness on male tissue ----
pts = np.vstack([p['pos'][rng.choice(len(p['pos']), min(25, len(p['pos'])), replace=False)] for p in M if p['parent'] in ('muscle', 'bone', 'anatria_export')])
h = 0.0005; J = np.stack([(W(pts + h * e) - W(pts - h * e)) / (2 * h) for e in np.eye(3)], axis=2); det = np.linalg.det(J)
dvec = rng.normal(size=pts.shape); dvec /= np.linalg.norm(dvec, axis=1)[:, None]; dvec *= 0.0005
second = np.linalg.norm(W(pts + dvec) - 2 * W(pts) + W(pts - dvec), axis=1)
fold_report = dict(samples=len(pts), folded=int((det <= 0).sum()), detMin=round(float(det.min()), 3), detP01=round(float(np.quantile(det, .01)), 3),
                   detMedian=round(float(np.median(det)), 3), detP99=round(float(np.quantile(det, .99)), 3),
                   secondDifferenceUmMedian=round(float(np.median(second)) * 1e6, 2), secondDifferenceUmMax=round(float(second.max()) * 1e6, 1))
log('folding', fold_report)
np.savez(f'{CACHE}/field.npz', o=ffd.o, n=ffd.n, h=ffd.h, coef=ffd.coef, segs=np.array(segs), sigma=CONFIG['sigma'],
         skinPoints=SP, skinResidual=resid, skinSigma=SIG, skinMass=MASS, vesselPoints=vP, vesselResidual=vR, vesselSigma=VSIG, vesselMass=VMASS,
         segT=np.array([np.concatenate([[segT[s][0]], segT[s][1].ravel(), segT[s][2]]) for s in segs]))
report = dict(version=1, createdBy='scripts/female-transport/fit.py', config=CONFIG,
    inputs={k: sha(f'{CACHE}/{k}') for k in ['female-scene/geometry.bin', 'female-scene/index.json', 'male-scene/geometry.bin', 'male-scene/index.json', 'female-skin-points.bin', 'male-skin-points.bin']},
    field=dict(path=f'{CACHE}/field.npz', sha256=sha(f'{CACHE}/field.npz')),
    guidesExcluded={k: sorted(v) for k, v in excluded.items()}, segments=seg_report, skin=skin_report, vessels=vessel_report, vesselLayer=vessel_layer_report, heldOut=held_report, folding=fold_report, pairs=pair_report)
json.dump(report, open('data/catalog/female-transport-fit.json', 'w'), indent=1, ensure_ascii=False)
log('wrote data/catalog/female-transport-fit.json')
