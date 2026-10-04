# Junctions between carried male branches and the female trunks: a carried
# vessel that touches (<1 mm) a male trunk the female source models should
# touch the HRA trunk of the same name after transport. Reports the gaps.
import sys, json, collections, numpy as np
sys.path.insert(0, 'scripts/female-transport')
from scipy.spatial import cKDTree
from scene import load
from vessel_pairs import PAIRS
from selection import selection
def junctions(out_dir='.cache/female-transport/out'):
    M = load('.cache/female-transport/male-scene'); F = load('.cache/female-transport/female-scene')
    zname = {s['id']: s['name'] for s in json.load(open('data/full-system-structures.json'))}
    mby_name = collections.defaultdict(list)
    for p in M:
        if p['name'] in zname: mby_name[zname[p['name']]].append(p['pos'])
    fby_name = {p['sourceName']: p['pos'] for p in F if p['system'] in ('arterial', 'venous')}
    index = json.load(open(f'{out_dir}/index.json'))['vessel']; blob = open(f'{out_dir}/vessel.bin', 'rb').read()
    carried = {e['id']: np.frombuffer(blob, np.float32, e['vertexCount'] * 3, e['posOffset']).reshape(-1, 3).astype(float) for e in index}
    mby_id = {p['name']: p['pos'] for p in M}
    carried_names = {o['name'] for o in selection()[0]}
    rows = []
    for males, females in PAIRS:
        # A trunk carried from the male source moves with its branches; only the
        # junctions with female trunks that stay in view are measured.
        if all(n in carried_names for n in males): continue
        mtrunk = np.vstack([v for n in males for v in mby_name.get(n, [])]); ftrunk = np.vstack([fby_name[n] for n in females])
        mt, ft = cKDTree(mtrunk), cKDTree(ftrunk)
        for cid, Q in carried.items():
            d = mt.query(mby_id[cid])[0].min()
            if d < 0.001:
                rows.append(dict(branch=zname[cid], trunk='/'.join(females), maleGapMm=round(d * 1000, 2), femaleGapMm=round(float(ft.query(Q)[0].min()) * 1000, 2)))
    return rows
def summary(rows):
    g = np.array([r['femaleGapMm'] for r in rows])
    return dict(junctions=len(rows), medianMm=round(float(np.median(g)), 2), p90Mm=round(float(np.quantile(g, .9)), 2), maxMm=round(float(g.max()), 2), over5Mm=int((g > 5).sum()))
if __name__ == '__main__' and '--write' in sys.argv:
    # Before: the carried vessels at the body field only; after: with the vessel layer.
    import tempfile, os
    from field import Field
    M = load('.cache/female-transport/male-scene'); mby = {p['name']: p['pos'] for p in M}; W = Field(male=M)
    index = json.load(open('.cache/female-transport/out/index.json'))
    tmp = tempfile.mkdtemp(); blobs = []; entries = []; off = 0
    for e in index['vessel']:
        q = W(mby[e['id']]).astype(np.float32).tobytes(); entries.append({**e, 'posOffset': off}); blobs.append(q); off += len(q)
    open(f'{tmp}/vessel.bin', 'wb').write(b''.join(blobs)); json.dump({'vessel': entries}, open(f'{tmp}/index.json', 'w'))
    before, after = junctions(tmp), junctions()
    json.dump(dict(version=1, createdBy='scripts/female-transport/junctions.py', before=summary(before), after=summary(after),
                   largestAfter=sorted(after, key=lambda r: -r['femaleGapMm'])[:20]), open('docs/anatomy-alignment/female-vessel-junctions.json', 'w'), indent=1)
    print(summary(before), summary(after))
elif __name__ == '__main__':
    rows = junctions(sys.argv[1] if len(sys.argv) > 1 else '.cache/female-transport/out')
    gaps = np.array([r['femaleGapMm'] for r in rows])
    print('junctions', len(rows), 'female gap median', np.median(gaps), 'p90', np.quantile(gaps, .9), 'max', gaps.max(), '>2mm', int((gaps > 2).sum()), '>5mm', int((gaps > 5).sum()))
    for r in sorted(rows, key=lambda r: -r['femaleGapMm'])[:20]: print(r)
    json.dump(rows, open('.cache/female-transport/junctions.json', 'w'))
