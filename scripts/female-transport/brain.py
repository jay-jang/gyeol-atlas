# Fit the female reference brain (Allen, 282 parts scaled to the female body)
# into the cranial cavity that the registration field gives the male skull:
# its outer surface follows the field-placed male BodyParts3D brain surface
# (non-rigid ICP, 8 mm cubic B-spline, bending penalty). The Visible Human
# optic chiasm and the HRA spinal cord stay fixed, so the brain keeps meeting
# them. Writes .cache/female-transport/out/brain.bin and a report.
#
# Usage: .cache/female-ct-venv/bin/python scripts/female-transport/brain.py
import sys, json, re, time, numpy as np
sys.path.insert(0, 'scripts/female-transport')
from scipy.spatial import cKDTree
from scene import load
from field import Field
from ffd import FFD
CACHE = '.cache/female-transport'; T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
CONFIG = dict(grid=0.012, bending=0.6, radii=[0.025, 0.015, 0.01], trim=0.9, fixedWeight=5.0, shellBins=4000, shellFraction=0.95, seed=3)
rng = np.random.default_rng(CONFIG['seed'])
F = load(f'{CACHE}/female-scene'); M = load(f'{CACHE}/male-scene'); W = Field(male=M)
inputs = {a['id']: a for a in json.load(open('scripts/model-inputs.json'))['assets']}
OUTER = re.compile(r'gyr|lobule|cerebell|pons|medulla oblongata|cuneus|precuneus|pole|insula|lingual|fusiform|parahippocampal|cingulate', re.I)
male = np.vstack([p['pos'] for p in M if inputs.get(p['name'], {}).get('layer') == 'nerve' and OUTER.search(inputs[p['name']]['name'])])
def shell(P, centre):
    # Outer envelope: per direction bin, the points near the farthest one.
    v = P - centre; r = np.linalg.norm(v, axis=1); u = v / r[:, None]
    k = CONFIG['shellBins']; i = np.arange(k) + .5; phi = np.arccos(1 - 2 * i / k); th = np.pi * (1 + 5 ** .5) * i
    dirs = np.stack([np.cos(th) * np.sin(phi), np.cos(phi), np.sin(th) * np.sin(phi)], 1)
    b = cKDTree(dirs).query(u)[1]; rmax = np.zeros(k); np.maximum.at(rmax, b, r)
    return P[r >= CONFIG['shellFraction'] * rmax[b]]
target_all = W(male)
brain = [p for p in F if p['system'] == 'brain' and 'chiasm' not in (p['sourceName'] or '').lower()]
fixed = np.vstack([p['pos'] for p in F if re.match(r'(Optic chiasm|Right optic nerve|Left optic nerve)$', p['sourceName'] or '')])
allpos = np.vstack([p['pos'] for p in brain]); offs = np.cumsum([0] + [len(p['pos']) for p in brain])
# The brain's outer surface: Allen points that are a target's nearest neighbour or face outward.
centre = allpos.mean(0)
target = shell(target_all, centre); src = shell(allpos, centre)
log('shell points', len(src), 'of', len(allpos), '| target', len(target), 'of', len(target_all))
inner = allpos[rng.choice(len(allpos), 60000, replace=False)]
fixed_s = fixed[rng.choice(len(fixed), min(4000, len(fixed)), replace=False)]
lo = np.minimum(allpos.min(0), target.min(0)) - 0.03; hi = np.maximum(allpos.max(0), target.max(0)) + 0.03
ffd = FFD(lo, hi, CONFIG['grid']); log('grid', ffd.n.tolist())
ttree = cKDTree(target); x0 = None; report = []
for radius in CONFIG['radii']:
    cur = src + ffd(src); stree = cKDTree(cur)
    # Symmetric closest points: Allen -> male surface and male surface -> Allen.
    d1, j1 = ttree.query(cur, distance_upper_bound=radius); ok1 = np.isfinite(d1)
    d2, j2 = stree.query(target, distance_upper_bound=radius); ok2 = np.isfinite(d2)
    P = np.vstack([src[ok1], src[j2[ok2]], fixed_s]); Y = np.vstack([target[j1[ok1]], target[ok2], fixed_s])
    w = np.concatenate([np.full(ok1.sum(), 1.0), np.full(ok2.sum(), 1.0), np.full(len(fixed_s), CONFIG['fixedWeight'])])
    D = Y - P
    resid = np.linalg.norm(D[:-len(fixed_s)] - ffd(P[:-len(fixed_s)]), axis=1); keep = np.concatenate([resid <= np.quantile(resid, CONFIG['trim']), np.ones(len(fixed_s), bool)])
    ffd.fit(P[keep], D[keep], w[keep], CONFIG['bending'], x0=x0); x0 = ffd.coef.copy()
    moved = src + ffd(src); dd = ttree.query(moved)[0]
    report.append(dict(radiusMm=radius * 1000, pairs=int(ok1.sum() + ok2.sum()), medianToMaleBrainMm=round(float(np.median(dd)) * 1000, 2)))
    log(report[-1])
new = allpos + ffd(allpos)
h = 0.0005; J = np.stack([(ffd(inner + h * e) + h * e - (ffd(inner - h * e) - h * e)) / (2 * h) for e in np.eye(3)], axis=2); det = np.linalg.det(J)
disp = np.linalg.norm(new - allpos, axis=1); fixed_move = np.linalg.norm(ffd(fixed), axis=1)
def cloud(name):
    a = np.frombuffer(open(f'{CACHE}/{name}', 'rb').read(), dtype=np.float32).reshape(-1, 6).astype(np.float64); return a[:, :3]
skin = cKDTree(cloud('female-skin-points.bin'))
summary = dict(version=1, createdBy='scripts/female-transport/brain.py', config=CONFIG, parts=len(brain), vertices=len(allpos), iterations=report,
    displacementMm=dict(median=round(float(np.median(disp)) * 1000, 2), p95=round(float(np.quantile(disp, .95)) * 1000, 2), max=round(float(disp.max()) * 1000, 2)),
    fixedMaxMoveMm=round(float(fixed_move.max()) * 1000, 3),
    jacobian=dict(min=round(float(det.min()), 3), p01=round(float(np.quantile(det, .01)), 3), folded=int((det <= 0).sum()), samples=len(det)),
    scalpDistanceMm=dict(before=dict(min=round(float(skin.query(allpos)[0].min()) * 1000, 1), p01=round(float(np.quantile(skin.query(allpos)[0], .01)) * 1000, 1)),
                         after=dict(min=round(float(skin.query(new)[0].min()) * 1000, 1), p01=round(float(np.quantile(skin.query(new)[0], .01)) * 1000, 1))))
log(json.dumps(summary))
bad = inner[det <= 0]
if len(bad):
    owner = np.concatenate([[p['sourceName']] * len(p['pos']) for p in brain]); d, j = cKDTree(allpos).query(bad)
    import collections; log('folds near', collections.Counter(owner[j]).most_common(8), 'y', np.round(np.quantile(bad[:, 1], [0, .5, 1]), 3))
blob = b''.join(new[offs[i]:offs[i + 1]].astype(np.float32).tobytes() for i in range(len(brain)))
open(f'{CACHE}/out/brain.bin', 'wb').write(blob)
import hashlib
json.dump(dict(summary=summary, parts=[dict(id=p['name'], vertexCount=len(p['pos']), sourceSha256=hashlib.sha256(p['pos'].astype(np.float32).tobytes()).hexdigest()) for p in brain]), open(f'{CACHE}/out/brain.json', 'w'))
