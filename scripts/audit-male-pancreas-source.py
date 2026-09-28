"""Read-only official 4.0 pancreas source/packed-geometry audit."""
import gzip
import hashlib
import json
from pathlib import Path
import re
import struct
import zipfile


def read(path):
    return json.loads(Path(path).read_text())


def sha(data):
    return hashlib.sha256(data).hexdigest()


official = Path('.cache/bp4-official/isa_BP3D_4.0_obj_99.zip')
relation_file = Path('.cache/bp4-official/partof_element_parts.txt')
relation = [line.split('\t')[-1] for line in relation_file.read_text().splitlines()
            if line.startswith('FMA7198\tpancreas\t')]
expected = ['FJ1895', 'FJ1896', 'FJ2629', 'FJ2630']
assert relation == expected, relation
upstream = read('.cache/male-details/atlas.json')
runtime = read('public/models/male-detail/atlas.json')
groups = read('data/male-detail-groups.json')
catalog = read('data/male-detail-structures.json')
runtime_bytes = gzip.decompress(Path('public/models/male-detail/organs.bin.gz').read_bytes())
upstream_bytes = {}
rows = []
with zipfile.ZipFile(official) as archive:
    assert archive.testzip() is None
    for id in expected:
        runtime_id = 'BP4_' + id
        part = next(p for p in runtime['parts'] if p['id'] == runtime_id)
        source = next(p for p in upstream['parts'] if p['id'] == id)
        item = next(p for p in catalog if p['id'] == runtime_id)
        assert part['name'] == source['name'] == item['name']
        assert part['conceptId'] == source['conceptId'] == item['fmaId']
        assert item['sex'] == 'male' and item['detailOnly']
        chunk = source['chunk']
        if chunk not in upstream_bytes:
            file = Path('.cache/male-details') / upstream['chunks'][chunk]['gzip'].split('/')[-1]
            upstream_bytes[chunk] = gzip.decompress(file.read_bytes())
        for field, size in [('positions', part['vertexCount']*12),
                            ('normals', part['vertexCount']*6),
                            ('indices', part['indexCount']*4)]:
            assert runtime_bytes[part[field]:part[field]+size] == upstream_bytes[chunk][source[field]:source[field]+size], (id, field)
        entry = f'isa_BP3D_4.0_obj_99/{id}.obj'
        raw = archive.read(entry)
        text = raw.decode()
        header = dict(re.findall(r'^# ([^:\n]+?)\s*:\s*(.*)$', text, re.M))
        assert header['Compatibility version'] == '4.0' and header['File ID'] == id
        source_positions = set()
        for line in text.splitlines():
            if line.startswith('v '):
                x, y, z = map(float, line.split()[1:4])
                source_positions.add(struct.pack('<fff', x*.001, z*.001+.0781112, -y*.001-.1))
        actual = runtime_bytes[part['positions']:part['positions']+part['vertexCount']*12]
        source_matches = sum(actual[i:i+12] in source_positions for i in range(0, len(actual), 12))
        assert source_matches == part['vertexCount'], (id, source_matches, part['vertexCount'])
        rows.append({'id':runtime_id,'name':part['name'],'fmaId':part['conceptId'],
                     'group':item['group'],'officialEntry':entry,'officialObjSha256':sha(raw),
                     'sourceDistinctPositions':len(source_positions),'runtimeVertices':part['vertexCount'],
                     'runtimeTriangles':part['indexCount']//3,'exactOfficialSourceVertices':source_matches,
                     'positionSha256':sha(actual),'boundsMetres':part['bounds']})

assert {id for group in groups if group['id'].startswith('pancreas') for id in group['ids']} == {'BP4_'+id for id in expected}
report = {'scope':'Official BodyParts3D 4.0 FMA7198 part_of source and exact deployed simplified vertices. No anatomical position approval.',
          'officialArchive':str(official),'officialArchiveSha256':sha(official.read_bytes()),
          'officialRelation':str(relation_file),'officialRelationSha256':sha(relation_file.read_bytes()),
          'sourceConcept':'FMA7198','officialMembers':expected,'rows':rows,
          'views':[{'id':g['id'],'ids':g['ids']} for g in groups if g['id'].startswith('pancreas')],
          'files':[{'path':str(p),'sha256':sha(Path(p).read_bytes())} for p in
                   ['.cache/male-details/atlas.json','public/models/male-detail/atlas.json',
                    'public/models/male-detail/organs.bin.gz','data/male-detail-groups.json',
                    'data/male-detail-structures.json','scripts/import-male-details.mjs',
                    'scripts/import-lung-details.py','scripts/audit-male-pancreas-source.py']]}
Path('docs/anatomy-alignment/male-pancreas-source.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'parts':len(rows),'vertices':sum(r['runtimeVertices'] for r in rows),
                  'triangles':sum(r['runtimeTriangles'] for r in rows),'officialVertexMatches':sum(r['exactOfficialSourceVertices'] for r in rows)}))
