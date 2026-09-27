"""Compare every current male detail vertex with its official BP3D 4.0 OBJ.

Offline diagnostic only. Does not interpret either release as anatomical truth.
"""
import gzip
import hashlib
import json
from pathlib import Path
import re
import zipfile
import numpy as np
from scipy.spatial import cKDTree

root = Path('.cache/bp4-official')
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
read = lambda p: json.loads(Path(p).read_text())
source = read('data/catalog/male-detail-source.json')
for f in source['files']:
    assert sha(f['path']) == f['sha256'], f['path']
for f in source['sources']:
    assert sha(Path('.cache/male-details')/f['url'].split('/')[-1]) == f['sha256']
upstream = read('.cache/male-details/atlas.json')
runtime = read('public/models/male-detail/atlas.json')
groups = read('data/male-detail-groups.json')
packed = gzip.decompress(Path('public/models/male-detail/organs.bin.gz').read_bytes())
chunks = {n: gzip.decompress((Path('.cache/male-details')/upstream['chunks'][n]['gzip'].split('/')[-1]).read_bytes()) for n in {p['chunk'] for p in upstream['parts'] if 'BP4_'+p['id'] in {p['id'] for p in runtime['parts']}}}
relations = {}
for line in (root/'partof_element_parts.txt').read_text().splitlines()[1:]:
    concept, name, element = line.split('\t')
    relations.setdefault(concept, set()).add(element)
new_relations = {}
for line in Path('data/catalog/v43-FMA2Obj.txt').read_text().splitlines():
    if not line or line.startswith('#'):
        continue
    concept, logic, elements = line.split('\t')
    if logic == 'part_of':
        new_relations[concept] = set(elements.split('+'))
with zipfile.ZipFile(root/'v43-FMA2Obj.zip') as z:
    assert z.read('FMA2Obj.txt') == Path('data/catalog/v43-FMA2Obj.txt').read_bytes()
group_rows = []
for g in groups:
    official = set().union(*(relations[c] for c in g['sourceConcepts']))
    current = {id.removeprefix('BP4_') for id in g['ids']}
    assert current == official, g['id']
    later = set().union(*(new_relations[c] for c in g['sourceConcepts']))
    group_rows.append({'id': g['id'], 'official40Members': len(official), 'official43Members': len(later),
                       'absentFrom43': sorted(current-later), 'addedIn43': sorted(later-current)})
rows = []
with zipfile.ZipFile(root/'isa_BP3D_4.0_obj_99.zip') as z:
    assert z.testzip() is None
    for part in runtime['parts']:
        id = part['id'].removeprefix('BP4_')
        up = next(p for p in upstream['parts'] if p['id'] == id)
        # Byte-perfect local repacking is separate from upstream source fidelity.
        for field, length in [('positions', part['vertexCount']*12), ('normals', part['vertexCount']*6), ('indices', part['indexCount']*4)]:
            assert packed[part[field]:part[field]+length] == chunks[up['chunk']][up[field]:up[field]+length], (id, field)
        name = f'isa_BP3D_4.0_obj_99/{id}.obj'
        raw = z.read(name)
        text = raw.decode()
        header = dict(re.findall(r'^# ([^:\n]+?)\s*:\s*(.*)$', text, re.M))
        assert header['Compatibility version'] == '4.0'
        assert header['File ID'] == id
        points = np.array([[float(v) for v in line.split()[1:4]] for line in text.splitlines() if line.startswith('v ')])
        converted = np.column_stack((points[:, 0]*.001, points[:, 2]*.001+.0781112, -points[:, 1]*.001-.1)).astype(np.float32)
        actual = np.frombuffer(packed, dtype='<f4', count=part['vertexCount']*3, offset=part['positions']).reshape(-1, 3)
        distances, _ = cKDTree(converted).query(actual)
        rows.append({'id': part['id'], 'officialEntry': name, 'officialObjSha256': hashlib.sha256(raw).hexdigest(),
                     'header': header, 'upstreamConceptId': part['conceptId'], 'sourceVertices': len(points), 'runtimeVertices': len(actual),
                     'exactSourceVertices': int((distances == 0).sum()), 'maximumNearestSourceDistanceMm': float(distances.max()*1000),
                     'rawBoundsMm': [points.min(axis=0).tolist(), points.max(axis=0).tolist()],
                     'runtimeBoundsMetres': [actual.min(axis=0).tolist(), actual.max(axis=0).tolist()]})
report = {'status': 'Source coordinate and membership diagnostic; not anatomical approval or runtime correction',
          'officialArchiveUrl': 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20130619/isa_BP3D_4.0_obj_99.zip',
          'officialLicenseUrl': 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
          'licenseNote': 'Official license page updated 2025-02-27 states CC BY 4.0; historical OBJ headers still say CC BY-SA 2.1 JP.',
          'transform': '[x*0.001,z*0.001+0.0781112,-y*0.001-0.1] from upstream converter',
          'parts': rows, 'groups': group_rows,
          'summary': {'parts': len(rows), 'runtimeVertices': sum(r['runtimeVertices'] for r in rows), 'exactSourceVertices': sum(r['exactSourceVertices'] for r in rows),
                      'maximumNearestSourceDistanceMm': max(r['maximumNearestSourceDistanceMm'] for r in rows)},
          'limitations': ['Source vertex membership does not verify simplification triangles, normals, anatomical placement or connections.',
                         'Different release membership is not a one-to-one replacement map or permission to translate individual parts.'],
          'files': [{'file': str(p), 'sha256': sha(p)} for p in [root/'isa_BP3D_4.0_obj_99.zip',root/'partof_element_parts.txt',root/'isa_element_parts.txt',root/'v43-FMA2Obj.zip',
                    'data/catalog/v43-FMA2Obj.txt','data/catalog/male-detail-source.json','public/models/male-detail/atlas.json','public/models/male-detail/organs.bin.gz',__file__]]}
Path('docs/anatomy-alignment/male-detail-source-audit.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report['summary']))
print(json.dumps([{k: v for k, v in r.items() if k != 'addedIn43'} for r in group_rows]))
