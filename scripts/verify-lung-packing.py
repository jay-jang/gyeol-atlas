"""Independent NumPy readback of all source positions/faces and packed normals."""
import gzip
import hashlib
from importlib.util import spec_from_file_location, module_from_spec
import json
from pathlib import Path
import subprocess
import zipfile
import numpy as np

spec = spec_from_file_location('probe', Path(__file__).with_name('audit-pulmonary-source-probe.py'))
probe = module_from_spec(spec)
spec.loader.exec_module(probe)
read = lambda p: json.loads(Path(p).read_text())
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
source = read('data/catalog/male-lung-source.json')
atlas = read('public/models/male-detail/atlas.json')
binary = gzip.decompress(Path('public/models/male-detail/organs.bin.gz').read_bytes())
parts = {p['id']:p for p in atlas['parts']}
records = []
for row in source['parts']:
    with zipfile.ZipFile(row['archive']) as z:
        raw = z.read(row['entry'])
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    header, points, triangles = probe.mesh(raw)
    part = parts[row['runtimeId']]
    expected = np.column_stack((points[:,0]/1000,points[:,2]/1000+.0781112,-points[:,1]/1000-.1)).astype('<f4')
    actual = np.frombuffer(binary,dtype='<f4',count=part['vertexCount']*3,offset=part['positions']).reshape(-1,3)
    # Division vs multiplication may differ in double rounding before float32;
    # record the actual residual rather than broadening a passing tolerance.
    residual = float(np.abs(expected.astype(float)-actual).max())
    assert residual == 0, (row['id'],residual)
    indices = np.frombuffer(binary,dtype='<u4',count=part['indexCount'],offset=part['indices']).reshape(-1,3)
    assert np.array_equal(indices,triangles), row['id']
    normal = np.array([[float(v) for v in line.split()[1:]] for line in raw.decode().splitlines() if line.startswith('vn ')])
    normal = np.column_stack((normal[:,0],normal[:,2],-normal[:,1]))
    normal /= np.linalg.norm(normal,axis=1)[:,None]
    stored = np.frombuffer(binary,dtype='<i2',count=part['vertexCount']*3,offset=part['normals']).reshape(-1,3)/32767
    error = float(np.abs(stored-normal).max())
    assert error <= .500001/32767
    assert part['name'] == header['English name'] and part['conceptId'] == header['Concept ID']
    records.append({'id':part['id'],'vertices':len(actual),'triangles':len(indices),'coordinateResidualMetres':residual,'maxNormalComponentError':error})
baseline_ref = '66db40fadf2fcb19237abb57202bfbd2ed9da4a6'
historical = lambda p: subprocess.check_output(['git','show',f'{baseline_ref}:{p}'])
old = json.loads(historical('public/models/male-detail/atlas.json'))
old_blob = gzip.decompress(historical('public/models/male-detail/organs.bin.gz'))
retained = {id for g in read('data/male-detail-groups.json') if g['id'] in ['heart','liver'] for id in g['ids']}
for p in old['parts']:
    if p['id'] not in retained:
        continue
    new = parts[p['id']]
    for key, size in [('positions',p['vertexCount']*12),('normals',p['vertexCount']*6),('indices',p['indexCount']*4)]:
        assert old_blob[p[key]:p[key]+size] == binary[new[key]:new[key]+size], (p['id'],key)
report = {'status':'Source packing verified; anatomical placement and connections are not clinically validated',
          'parts':records,'unchangedHeartLiverParts':len(retained),'baselineRef':baseline_ref,
          'summary':{'lungParts':len(records),'vertices':sum(r['vertices'] for r in records),'triangles':sum(r['triangles'] for r in records),
                     'maximumCoordinateResidualMetres':max(r['coordinateResidualMetres'] for r in records)},
          'files':[{'file':str(p),'sha256':sha(p)} for p in ['data/catalog/male-lung-source.json','public/models/male-detail/atlas.json',
                   'public/models/male-detail/organs.bin.gz',str(Path(__file__).resolve().relative_to(Path.cwd()))]]}
Path('docs/anatomy-alignment/lung-packing-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report['summary']))
