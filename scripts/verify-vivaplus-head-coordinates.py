"""Independent whitespace source-node readback; not an anatomy validator."""
import hashlib
import json
from pathlib import Path
import zipfile

folder=Path('.cache/vivaplus-head')
geometry=folder/'consistent-surfaces.json'
data=json.loads(geometry.read_text())
report=json.loads((folder/'consistent-extraction.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(geometry)==report['geometrySha256']
archive=Path('.cache/vivaplus/vivaplus-v2.0.2.zip')
assert sha(archive)==data['source']['archiveSha256']
nodes={};active=False
with zipfile.ZipFile(archive) as z:
    text=z.read('vivaplus-v2.0.2/model/50F-standing/vivaplus_50F-standing_nodes.k').decode()
for line in text.splitlines():
    line=line.strip()
    if not line or line.startswith('$'):continue
    if line.startswith('*'):
        active=line=='*NODE';continue
    if active:
        fields=line.split();nid=int(fields[0])
        assert nid not in nodes
        nodes[nid]=tuple(float(v) for v in fields[1:4])
assert len(nodes)==564960
records=[]
for mesh in data['meshes']:
    ids=mesh['sourceNodeIds'];positions=mesh['positions'];indices=mesh['indices']
    assert len(ids)==len(set(ids)) and len(positions)==3*len(ids)
    assert len(indices)%3==0 and all(isinstance(i,int) and 0<=i<len(ids) for i in indices)
    assert set(indices)==set(range(len(ids)))
    error=max(abs(positions[3*i+a]*1000-nodes[nid][(1,2,0)[a]]) for i,nid in enumerate(ids) for a in range(3))
    assert error<1e-9
    records.append(dict(id=mesh['id'],vertices=len(ids),triangles=len(indices)//3,maxSourceCoordinateErrorMm=error))
result=dict(geometrySha256=sha(geometry),sourceNodeCount=len(nodes),groups=records,
            totalReferencedVertices=sum(r['vertices'] for r in records),
            maxSourceCoordinateErrorMm=max(r['maxSourceCoordinateErrorMm'] for r in records),
            method='Independent whitespace source-node parser; all retained positions and index ranges; no triangulation import.',
            limitations=['Unions repeat component vertices; sum is not unique source nodes.',
                         'Does not independently verify every element membership, triangle winding, FE validity or anatomical correspondence.'],
            codeSha256=sha(Path(__file__)))
(folder/'coordinate-readback.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='groups'}))
