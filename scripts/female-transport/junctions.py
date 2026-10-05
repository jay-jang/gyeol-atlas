# Junctions between carried male vessels and the vessels the female source
# models. Every carried vessel that touches (< 1 mm) such a male trunk is
# measured after transport: its gap to the HRA trunk of the same name (0 when
# part of it lies inside the trunk). Pairs are split into connections (a
# branch or tributary opening into the trunk, vessel_connections.py) and
# contacts (an artery lying on a vein, crossing vessels), which have no reason
# to stay touching in another body.
#
# Usage: .cache/female-ct-venv/bin/python scripts/female-transport/junctions.py [--write]
#   without --write: gaps of the built geometry (.cache/female-transport/out)
#   --write: the three stages (body field, + vessel layer, + junction layer
#   with root bends), their distortion, to docs/anatomy-alignment/female-vessel-junctions.json
import sys, json, collections, numpy as np
sys.path.insert(0, 'scripts/female-transport')
from scipy.spatial import cKDTree
from scene import load
from vessel_pairs import PAIRS
from vessel_connections import CONNECTIONS, ALTERNATIVES, vessel_kind
from selection import selection
from inside import inside_any, surface_samples, winding
CACHE = '.cache/female-transport'
M = load(f'{CACHE}/male-scene'); F = load(f'{CACHE}/female-scene'); mby = {p['name']: p for p in M}
zname = {s['id']: s['name'] for s in json.load(open('data/full-system-structures.json'))}
male_vessel = collections.defaultdict(list)
for p in M:
    if p['name'] in zname: male_vessel[zname[p['name']]].append(p['pos'])
fby = {p['sourceName']: p for p in F if p['system'] in ('arterial', 'venous')}
carried = [o for o in selection()[0] if o['source'] == 'vessel-full.glb']
carried_names = {o['name'] for o in selection()[0]}
def pairs():
    """(carried id, branch name, female trunk key, female parts) for every touching pair."""
    out = []
    for males, females in PAIRS:
        # A trunk carried from the male source moves with its branches.
        if all(n in carried_names for n in males): continue
        mt = cKDTree(np.vstack([v for n in males for v in male_vessel[n]]))
        for o in carried:
            if mt.query(mby[o['id']]['pos'])[0].min() < 0.001: out.append((o['id'], zname[o['id']], '/'.join(females), [fby[n] for n in females]))
    return out
PAIRS_TOUCHING = pairs()
rng = np.random.default_rng(5)
PARTS = {'/'.join(f): [fby[n] for n in f] for _, f in PAIRS}
TREES = {key: cKDTree(np.vstack([surface_samples(p, 40000, rng) for p in parts])) for key, parts in PARTS.items()}
def gaps(position):
    """Rows for every touching pair given carried positions {id: Q}."""
    rows = []
    for cid, branch, key, parts in PAIRS_TOUCHING:
        Q = position[cid]; best = None
        # A connection is complete at its trunk or at an anatomical alternative.
        for k in [key] + (ALTERNATIVES.get((branch, key), []) if (branch, key) in CONNECTIONS else []):
            d = TREES[k].query(Q)[0]; near = np.argsort(d)[:200]
            gap = 0.0 if d.min() < 0.0005 or inside_any(Q[near], PARTS[k]).any() else float(d.min())
            if best is None or gap < best[0]: best = (gap, k)
        rows.append(dict(branch=branch, trunk=key, connection=(branch, key) in CONNECTIONS, gapMm=round(best[0] * 1000, 2), **({'metAt': best[1]} if best[1] != key else {})))
    return rows
def summary(rows, connection):
    g = np.array([r['gapMm'] for r in rows if r['connection'] == connection])
    return dict(pairs=len(g), medianMm=round(float(np.median(g)), 2), p90Mm=round(float(np.quantile(g, .9)), 2), maxMm=round(float(g.max()), 2), over5Mm=int((g > 5).sum()))
def built():
    index = json.load(open(f'{CACHE}/out/index.json'))['vessel']; blob = open(f'{CACHE}/out/vessel.bin', 'rb').read()
    return {e['id']: np.frombuffer(blob, np.float32, e['vertexCount'] * 3, e['posOffset']).reshape(-1, 3).astype(float) for e in index}
if __name__ == '__main__' and '--write' in sys.argv:
    from field import Field
    W0 = Field(male=M, junctions=False); W1 = Field(male=M)
    stages = {'field': {}, 'vesselLayer': {}, 'junctionLayer': {}}; distortion = {k: collections.Counter() for k in ('vesselLayer', 'junctionLayer')}
    for o in carried:
        p = mby[o['id']]; P = p['pos']; T = p['tri']; base = W0(P); kind = vessel_kind(o['name'])
        stage = {'field': base, 'vesselLayer': base + W0.vessel_layer(P), 'junctionLayer': base + W1.vessel_layer(P, kind) + W1.root_bend(o['id'], P)}
        for k, Q in stage.items(): stages[k][o['id']] = Q
        e0 = np.linalg.norm(base[T[:, 1]] - base[T[:, 0]], axis=1); n0 = np.cross(base[T[:, 1]] - base[T[:, 0]], base[T[:, 2]] - base[T[:, 0]]); ok = e0 > 1e-5
        for k in distortion:
            Q = stage[k]; e = np.linalg.norm(Q[T[:, 1]] - Q[T[:, 0]], axis=1)[ok] / e0[ok]; n = np.cross(Q[T[:, 1]] - Q[T[:, 0]], Q[T[:, 2]] - Q[T[:, 0]])
            c = distortion[k]; c['triangles'] += len(T); c['flippedTriangles'] += int(((n0 * n).sum(1) < 0).sum())
            c['edges'] += int(ok.sum()); c['edgesBeyond25pct'] += int(((e > 1.25) | (e < 0.8)).sum())
    # Vertices inside a female bone, for every vessel the junction layer moves by more than 1 mm.
    bones = [(b, cKDTree(b['pos'])) for b in F if b['system'] == 'skeletal']
    def in_bone(Q):
        n = 0
        for b, t in bones:
            near = t.query(Q, distance_upper_bound=0.03)[0] < 0.03
            if near.any(): n += int((np.abs(winding(Q[near], b['pos'], b['tri'])) > 0.5).sum())
        return n
    moved = [o['id'] for o in carried if np.abs(stages['junctionLayer'][o['id']] - stages['vesselLayer'][o['id']]).max() > 0.001]
    for k in distortion:
        distortion[k]['movedStructures'] = len(moved); distortion[k]['movedVerticesInsideFemaleBone'] = sum(in_bone(stages[k][i]) for i in moved)
    # Carried vessels that touch each other in the male source, where the junction
    # layer moves one of them: none of these is a branch opening into the other
    # (companion arteries and veins, neighbouring tributaries); their separation is recorded.
    male_tree = {o['id']: cKDTree(mby[o['id']]['pos']) for o in carried}; name = {o['id']: o['name'] for o in carried}; companions = {}
    for i in moved:
        for o in carried:
            k = o['id']
            if k == i or tuple(sorted((i, k))) in companions: continue
            if np.isfinite(male_tree[k].query(mby[i]['pos'], distance_upper_bound=0.001)[0]).any():
                g = lambda st: round(float(cKDTree(stages[st][k]).query(stages[st][i])[0].min()) * 1000, 2)
                companions[tuple(sorted((i, k)))] = dict(a=name[i], b=name[k], vesselLayerMm=g('vesselLayer'), junctionLayerMm=g('junctionLayer'))
    comp = list(companions.values())
    rows = {k: gaps(v) for k, v in stages.items()}
    built_rows = gaps(built()) if '--skip-built' not in sys.argv else None
    # The built geometry is the junction-layer stage in float32.
    if built_rows is not None:
        bad = [(a, b['gapMm']) for a, b in zip(built_rows, rows['junctionLayer']) if abs(a['gapMm'] - b['gapMm']) >= 0.05]
        assert not bad, f'the built geometry differs from the junction-layer stage: {bad[:3]}'
    record = dict(version=2, createdBy='scripts/female-transport/junctions.py',
                  definition='Carried vessels touching (< 1 mm) a male vessel the female source models; gap to the HRA vessel of the same name after transport, 0 when inside it. Connections: branch/tributary/continuation (scripts/female-transport/vessel_connections.py, editorial TA2/FMA classification); contacts: every other touching pair.',
                  stages={k: dict(connections=summary(r, True), contacts=summary(r, False)) for k, r in rows.items()},
                  distortion={k: dict(v) for k, v in distortion.items()},
                  carriedContacts=dict(pairs=len(comp), over5MmBefore=sum(c['vesselLayerMm'] > 5 for c in comp), over5MmAfter=sum(c['junctionLayerMm'] > 5 for c in comp),
                                       separated=sorted([c for c in comp if c['junctionLayerMm'] > 5], key=lambda c: -c['junctionLayerMm'])),
                  connectionsAfter=sorted([r for r in rows['junctionLayer'] if r['connection']], key=lambda r: -r['gapMm']),
                  contactsAfter=sorted([r for r in rows['junctionLayer'] if not r['connection']], key=lambda r: -r['gapMm']))
    json.dump(record, open('docs/anatomy-alignment/female-vessel-junctions.json', 'w'), indent=1)
    print(json.dumps(record['stages'])); print(json.dumps(record['distortion'])); print(json.dumps({k: v for k, v in record['carriedContacts'].items() if k != 'separated'}))
elif __name__ == '__main__':
    rows = gaps(built())
    print(json.dumps(dict(connections=summary(rows, True), contacts=summary(rows, False))))
