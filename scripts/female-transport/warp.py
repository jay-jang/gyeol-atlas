# Carry the selected male structures and the borrowed bones through the
# fitted field (scripts/female-transport/fit.py) and measure the result.
# Writes .cache/female-transport/out/ (geometry for build-female-transport.mjs)
# and data/catalog/female-transport.json (selection, exclusions, metrics).
#
# Usage: .cache/female-ct-venv/bin/python scripts/female-transport/warp.py
import sys, os, json, re, hashlib, collections, numpy as np
sys.path.insert(0, 'scripts/female-transport')
from scipy.spatial import cKDTree
from scene import load
from selection import selection
from bonefit import icp, init_centroid, apply, umeyama
from field import Field
from vessel_connections import vessel_kind
CACHE = '.cache/female-transport'; OUT = f'{CACHE}/out'; os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(0)
def sha(path): return hashlib.sha256(open(path, 'rb').read()).hexdigest()
M = load(f'{CACHE}/male-scene'); mby = {p['name']: p for p in M}
F = load(f'{CACHE}/female-scene'); fby = {p['name']: p for p in F}
W = Field(male=M)
def cloud(name):
    a = np.frombuffer(open(f'{CACHE}/{name}', 'rb').read(), dtype=np.float32).reshape(-1, 6).astype(np.float64); return a[:, :3], a[:, 3:]
fs_, fn = cloud('female-skin-points.bin'); ftree = cKDTree(fs_); ms, mn = cloud('male-skin-points.bin'); mtree = cKDTree(ms)
def outside(P, tree, pts, nrm): d, j = tree.query(P, workers=-1); return ((P - pts[j]) * nrm[j]).sum(1) > 0.002
# Unsigned distance to the male skin's outer surface (every outside ray hit,
# 1 mm apart; scripts/outer-skin-points.mjs): a structure within 1 mm of it
# touches the skin in its source.
outer_skin = cKDTree(np.frombuffer(open(f'{CACHE}/male-skin-outer-dense.bin', 'rb').read(), dtype=np.float32).reshape(-1, 3).astype(np.float64))
def skin_touch_mm(P): return float(outer_skin.query(P, workers=-1)[0].min()) * 1000
def inverted(P, Q, T):
    """Triangles whose orientation the field reverses (local Jacobian determinant <= 0)."""
    n0 = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]); n1 = np.cross(Q[T[:, 1]] - Q[T[:, 0]], Q[T[:, 2]] - Q[T[:, 0]])
    cand = np.where((n0 * n1).sum(1) < 0)[0]
    if not len(cand): return 0
    c = P[T[cand]].mean(1); h = 1e-4
    J = np.stack([(W(c + h * e) - W(c - h * e)) / (2 * h) for e in np.eye(3)], axis=2)
    return int((np.linalg.det(J) <= 0).sum())
def peel_score(P):
    lo, hi = P.min(0), P.max(0); c, e = (lo + hi) / 2, hi - lo
    ax = .095 if c[1] < .83 else .29 if abs(c[0]) > .2 and c[1] < 1.5 else 0
    return float(np.hypot(abs(c[0]) - ax, c[2]) + max(e[0], e[2]) * .24)
chosen, skipped = selection()
systems = collections.defaultdict(list); metrics = collections.defaultdict(lambda: collections.Counter())
for o in chosen:
    p = mby[o['id']]; P = p['pos']; Q = W(P)
    # Vessels (and the lymph that follows them) join the female vessels of the
    # same name; arteries and veins meet their own female trunks.
    if o['source'] == 'vessel-full.glb': Q = Q + W.vessel_layer(P, vessel_kind(o['name'])) + W.root_bend(o['id'], P)
    if o['source'] == 'reference/lymphatic_male.glb': Q = Q + W.vessel_layer(P, 'lymph')
    om, of = outside(P, mtree, ms, mn), outside(Q, ftree, fs_, fn)
    sysname = {'nerve-full.glb': 'nerve', 'vessel-full.glb': 'vessel', 'ligament-full.glb': 'ligament', 'tendon-full.glb': 'tendon',
               'muscle.glb': 'muscle', 'bone.glb': 'bone', 'organ.glb': 'organ', 'reference/lymphatic_male.glb': 'lymph'}[o['source']]
    m = metrics[sysname]; m['structures'] += 1; m['vertices'] += len(P); m['triangles'] += len(p['tri'])
    m['outsideMaleSkin'] += int(om.sum()); m['outsideFemaleSkin'] += int(of.sum()); m['newlyOutside'] += int((of & ~om).sum())
    m['invertedTriangles'] += inverted(P, Q, p['tri'])
    # Depth below the male skin in the source (negative: outside). A structure
    # touching the skin there shows through any coarser skin, as in the male face.
    depth = skin_touch_mm(P) / 1000
    m['skinContact'] += int(depth <= 0.001)
    systems[sysname].append(dict(id=o['id'], pos=Q.astype(np.float32), tri=p['tri'].astype(np.uint32), peelScore=peel_score(P) if sysname == 'muscle' else None, depth=depth))
index = {}
for sysname, items in systems.items():
    blobs, entries, off = [], [], 0
    for it in items:
        a, b = it['pos'].tobytes(), it['tri'].tobytes()
        entries.append(dict(id=it['id'], posOffset=off, vertexCount=len(it['pos']), idxOffset=off + len(a), indexCount=it['tri'].size, sourceSkinDepthMm=round(it['depth'] * 1000, 2),
                            **({'peelScore': round(it['peelScore'], 6)} if it['peelScore'] is not None else {})))
        blobs += [a, b]; off += len(a) + len(b)
    open(f'{OUT}/{sysname}.bin', 'wb').write(b''.join(blobs)); index[sysname] = entries
# ---- borrowed bones: back to the male frame through their own similarity, then the field ----
inputs = {a['id']: a for a in json.load(open('scripts/model-inputs.json'))['assets']}
male_by_name = {a['name'].lower(): a['id'] for a in inputs.values() if a['layer'] == 'bone'}
borrowed, info = {}, {}
for p in F:
    if p['system'] != 'borrowed': continue
    mid = male_by_name.get((p['sourceName'] or '').lower())
    if not mid: continue
    V = p['pos']; mb = mby[mid]['pos']
    src = mb[rng.choice(len(mb), min(2000, len(mb)), replace=False)]
    T, rms, _ = icp(src, V if len(V) < 5000 else V[rng.choice(len(V), 5000, replace=False)], init_centroid(src, V))
    s, R, t = T; borrowed[p['name']] = W(((V - t) @ R) / s); info[p['name']] = dict(source=p['sourceName'], male=mid, icpRmsMm=round(rms * 1000, 2), skinTouchMm=round(skin_touch_mm(mb), 2))
nasal = [n for n in borrowed if info[n]['source'].lower().endswith('nasal bone')]
S = umeyama(np.vstack([fby[n]['pos'] for n in nasal]), np.vstack([borrowed[n] for n in nasal]))
for p in F:   # alar cartilages have no male bone counterpart: follow the nasal bones
    if p['system'] == 'borrowed' and p['name'] not in borrowed: borrowed[p['name']] = apply(S, p['pos']); info[p['name']] = dict(source=p['sourceName'], male=None, follows='nasal bones')
order = sorted(borrowed); blobs, entries, off = [], [], 0
for n in order:
    a = borrowed[n].astype(np.float32).tobytes()
    entries.append(dict(id=n, offset=off, vertexCount=len(borrowed[n]), sourceSha256=hashlib.sha256(fby[n]['pos'].astype(np.float32).tobytes()).hexdigest(),
                        **({'surfaceTone': True} if info[n].get('skinTouchMm', 99) <= 1 else {})))
    blobs.append(a); off += len(a)
open(f'{OUT}/borrowed.bin', 'wb').write(b''.join(blobs)); index['borrowed'] = entries
json.dump(index, open(f'{OUT}/index.json', 'w'))
# ---- anatomical relations of the borrowed skeleton, before and after ----
name_of = {info[n]['source']: n for n in borrowed}
native = {p['sourceName']: p for p in F if p['system'] == 'skeletal'}
st = cKDTree(np.vstack([native['Manubrium']['pos'], native['Sternum']['pos']]))
vt = cKDTree(np.vstack([p['pos'] for n, p in native.items() if 'vertebra' in n]))
lt = cKDTree(np.vstack([p['pos'] for p in F if p['system'] == 'respiratory' and 'bronchopulmonary segment' in p['sourceName']]))
def relations(get):
    out = {}
    for side in ['Left', 'Right']:
        c = get(f'{side} clavicle'); med = c[np.abs(c[:, 0]) <= np.quantile(np.abs(c[:, 0]), .15)]
        out[f'{side.lower()}ClavicleMedialToSternumMm'] = round(float(st.query(med)[0].min()) * 1000, 1)
    ribs = [s for s in name_of if re.search(r'\brib\b', s)]
    heads = [vt.query(get(s))[0].min() * 1000 for s in ribs]
    cart = [st.query(get(s))[0].min() * 1000 for s in name_of if re.match(r'^(Left|Right) (first|second|third|fourth|fifth|sixth|seventh) costal cartilage$', s)]
    out['ribToVertebraMm'] = dict(median=round(float(np.median(heads)), 1), max=round(float(np.max(heads)), 1))
    out['costalCartilage1to7ToSternumMm'] = dict(median=round(float(np.median(cart)), 1), max=round(float(np.max(cart)), 1))
    out['ribVerticesWithin1mmOfLung'] = int(sum((lt.query(get(s))[0] < 0.001).sum() for s in ribs))
    out['verticesOutsideSkin'] = int(sum(outside(get(s), ftree, fs_, fn).sum() for s in name_of))
    out['bonesOutsideSkin'] = int(sum(1 for s in name_of if outside(get(s), ftree, fs_, fn).any()))
    return out
moves = {n: float(np.linalg.norm(borrowed[n] - fby[n]['pos'], axis=1).mean()) * 1000 for n in borrowed}
report = dict(version=1, createdBy='scripts/female-transport/warp.py',
    field=dict(path=f'{CACHE}/field.npz', sha256=sha(f'{CACHE}/field.npz')),
    selection=dict(chosen=dict(collections.Counter(o['source'] for o in chosen)), skipped={f"{k[0]} · {k[1]}": v for k, v in collections.Counter((o['source'], o['reason']) for o in skipped).items()}),
    skipped=[dict(id=o['id'], name=o['name'], source=o['source'], reason=o['reason']) for o in skipped],
    systems={k: dict(v) for k, v in metrics.items()},
    borrowed=dict(bones=len(borrowed), meanMoveMm=dict(median=round(float(np.median(list(moves.values()))), 2), max=round(float(max(moves.values())), 2)),
                  before=relations(lambda s: fby[name_of[s]]['pos']), after=relations(lambda s: borrowed[name_of[s]]),
                  largestMoves=sorted(([info[n]['source'], round(v, 1)] for n, v in moves.items()), key=lambda r: -r[1])[:20]))
json.dump(report, open('data/catalog/female-transport.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({k: report[k] for k in ['selection', 'systems']}, ensure_ascii=False, indent=1)); print(json.dumps(report['borrowed'], ensure_ascii=False))
