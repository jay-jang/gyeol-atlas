"""Pack official BP3D 4.3 lungs into two non-overlapping source-cohort views.

Retains every official part_of member, but never renders alternative cohorts
together. Existing heart/liver/kidney/stomach/pancreas packed bytes are preserved exactly.
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import zipfile


def read(path):
    return json.loads(Path(path).read_text())


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    root = Path('public/models/male-detail')
    previous = read(root/'atlas.json')
    previous_bytes = gzip.decompress((root/'organs.bin.gz').read_bytes())
    imported_groups = read('data/male-detail-groups.json')
    groups = [g for g in imported_groups if g['id'] in ['heart','liver','kidney','stomach']]
    catalog = [s for s in read('data/male-detail-structures.json')
               if s['group'] in ['heart','liver','kidney','stomach','pancreas','pancreas-parenchyma']]
    imported_pancreas = [g for g in imported_groups if g['id'] in ['pancreas','pancreas-parenchyma']]
    assert len(imported_pancreas) in (1,2)
    assert all(g['sourceConcepts'] == ['FMA7198'] for g in imported_pancreas)
    assert {id for g in imported_pancreas for id in g['ids']} == {'BP4_FJ1895','BP4_FJ1896','BP4_FJ2629','BP4_FJ2630'}
    # Whole-organ and parenchyma surfaces nearly coincide. Keep the duct
    # representations in disjoint selectable views rather than overlaying all four.
    pancreas_views = [('pancreas','췌장 · 전체 형상',['BP4_FJ1895','BP4_FJ1896']),
                      ('pancreas-parenchyma','췌장 · 실질·관 가지',['BP4_FJ2629','BP4_FJ2630'])]
    for id, name, ids in pancreas_views:
        groups.append({'id':id,'name':name,'sex':'male','sourceConcepts':['FMA7198'],
                       'ids':ids,'sourceVersion':'4.0'})
        for part in catalog:
            if part['id'] in ids:
                part['group'] = id
                note = ' 같은 원본의 대체 표현을 동시에 표시하지 않습니다. 한국어 보기명은 편집 표기입니다.'
                if note not in part['description']:
                    part['description'] += note
    keep = {id for g in groups for id in g['ids']}
    source = read('.cache/bp4-official/lung43/receipt.json')
    for f in source['archives']:
        assert sha(f['file']) == f['sha256']
    relation = {}
    for line in Path('data/catalog/v43-FMA2Obj.txt').read_text().splitlines():
        if line and not line.startswith('#'):
            concept, logic, ids = line.split('\t')
            relation[concept, logic] = set(ids.split('+'))
    official = relation['FMA7309','part_of'] | relation['FMA7310','part_of']
    assert {p['id'] for p in source['parts']} == official
    recent_cohorts = {'140325_PAPV.obj', '140325-trachea.obj', '140325-separated Lung10Pieces.obj'}
    old_cohorts = {'DBCLS__FUJIEDA_120918_PA PV-obj', 'DBCLS__FUJIEDA_110909-trachea-obj'}
    assert {p['listing']['artg_name'] for p in source['parts']} == recent_cohorts | old_cohorts
    primary = [p for p in source['parts'] if p['listing']['artg_name'] in recent_cohorts]
    branches = [p for p in source['parts'] if p['listing']['artg_name'] in old_cohorts]
    assert len(primary) == 285 and len(branches) == 278
    for id, name, rows in [('lung','폐',primary), ('lung-branches','폐 · 이전 세부 가지',branches)]:
        groups.append({'id': id, 'name': name, 'sex': 'male', 'sourceConcepts': ['FMA7309','FMA7310'],
                       'ids': ['BP4_'+p['id'] for p in rows], 'sourceVersion': '4.3'})
    blob = bytearray()
    def append(raw):
        offset = len(blob)
        blob.extend(raw)
        blob.extend(b'\0' * ((-len(blob)) % 4))
        return offset
    parts = []
    for p in previous['parts']:
        if p['id'] not in keep:
            continue
        result = dict(p)
        for field, size in [('positions',p['vertexCount']*12),('normals',p['vertexCount']*6),('indices',p['indexCount']*4)]:
            result[field] = append(previous_bytes[p[field]:p[field]+size])
        parts.append(result)
    labels = ['왼쪽 꼭대기뒤구역 폐실질','왼쪽 뒤바닥구역 폐실질','왼쪽 꼭대기뒤구역 폐실질',
              '왼쪽 앞구역 폐실질','위혀구역 폐실질','아래혀구역 폐실질','왼쪽 위구역 폐실질',
              '왼쪽 앞바닥구역 폐실질','왼쪽 가쪽바닥구역 폐실질','오른쪽 꼭대기구역 폐실질',
              '오른쪽 뒤바닥구역 폐실질','오른쪽 뒤구역 폐실질','오른쪽 앞구역 폐실질',
              '가쪽구역 폐실질','안쪽구역 폐실질','오른쪽 위구역 폐실질','오른쪽 앞바닥구역 폐실질','오른쪽 가쪽바닥구역 폐실질']
    records = []
    for row in source['parts']:
        with zipfile.ZipFile(row['archive']) as archive:
            raw = archive.read(row['entry'])
        assert hashlib.sha256(raw).hexdigest() == row['sha256']
        text = raw.decode()
        header = dict(re.findall(r'^# ([^:\n]+?)\s*:\s*(.*)$', text, re.M))
        assert header == row['header'] and header['Compatibility version'] == '4.3'
        points, normals, indices = [], [], []
        for line in text.splitlines():
            if line.startswith('v '):
                x,y,z = map(float,line.split()[1:4])
                points.append((x*.001,z*.001+.0781112,-y*.001-.1))
            elif line.startswith('vn '):
                x,y,z = map(float,line.split()[1:4])
                length = math.sqrt(x*x+y*y+z*z)
                assert length > 0
                normals.append(tuple(round(v/length*32767) for v in (x,z,-y)))
            elif line.startswith('f '):
                face=[]
                for token in line.split()[1:]:
                    v,_,n=token.split('/')
                    assert int(v) == int(n) and int(v) > 0, token
                    face.append(int(v)-1)
                for j in range(1,len(face)-1):
                    indices.extend([face[0],face[j],face[j+1]])
        assert points and indices and len(normals) == len(points)
        assert max(indices) < len(points) and all(math.isfinite(v) for point in points for v in point)
        position_bytes = struct.pack('<'+'f'*(3*len(points)),*(v for p in points for v in p))
        stored = list(struct.iter_unpack('<fff',position_bytes))
        bounds = [[min(p[i] for p in stored) for i in range(3)], [max(p[i] for p in stored) for i in range(3)]]
        name, id = header['English name'], 'BP4_'+row['id']
        cohort = row['listing']['artg_name']
        system = 'venous' if 'vein' in name.lower() else 'arterial' if 'artery' in name.lower() else 'respiratory'
        layer = 'vessel' if system in ['arterial','venous'] else 'organ'
        group = 'lung' if cohort in recent_cohorts else 'lung-branches'
        label = labels[int(row['id'][2:])-6595] if cohort == '140325-separated Lung10Pieces.obj' else name
        parts.append({'id':id,'name':name,'conceptId':header['Concept ID'],'system':system,'chunk':0,
                      'positions':append(position_bytes), 'normals':append(struct.pack('<'+'h'*(3*len(normals)),*(v for n in normals for v in n))),
                      'indices':append(struct.pack('<'+'I'*len(indices),*indices)),
                      'vertexCount':len(points),'indexCount':len(indices),'bounds':bounds,'sourceVersion':'4.3'})
        catalog.append({'id':id,'name':name,'label':label,'layer':layer,'sex':'male','group':group,'detailOnly':True,
                        'fmaId':header['Concept ID'],'hierarchy':['폐',cohort], 'bodyRegion':'chest',
                        'source':'BodyParts3D 4.3 · '+('2014 폐 분할 자료' if group=='lung' else '2011–2012 세부 가지 자료'),
                        'description': '공식 폐 하위 구조입니다. 두 제작 시기의 대체 형상은 별도 보기로 구분합니다. 한국어 표기는 검색용 편집명이며 전문가 미검수입니다.'})
        records.append({**row,'runtimeId':id,'group':group,'vertices':len(points),'triangles':len(indices)//3,
                        'positionSha256':hashlib.sha256(position_bytes).hexdigest()})
    compressed = gzip.compress(blob, compresslevel=9, mtime=0)
    (root/'organs.bin.gz').write_bytes(compressed)
    atlas = {'version':'4.0-heart-liver-kidney-stomach-pancreas+4.3-lung','sex':'male','parts':parts,
             'chunks':[{'url':'/models/male-detail/organs.bin','gzip':'/models/male-detail/organs.bin.gz','bytes':len(blob),'gzipBytes':len(compressed)}]}
    (root/'atlas.json').write_text(json.dumps(atlas,separators=(',',':'))+'\n')
    for file, value in [('data/male-detail-structures.json',catalog),('data/male-detail-groups.json',groups)]:
        Path(file).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
    receipt = read('data/catalog/male-detail-source.json')
    receipt.update(structures=len(parts),bytes=len(compressed),lungSupplement='data/catalog/male-lung-source.json',
                   pancreasViews=[{'id':g['id'],'ids':g['ids']} for g in groups if g['id'].startswith('pancreas')],
                   files=[{'path':str(p),'sha256':sha(p)} for p in [root/'atlas.json',root/'organs.bin.gz']])
    Path('data/catalog/male-detail-source.json').write_text(json.dumps(receipt,indent=2)+'\n')
    supplement = {'version':'4.3','license':'CC-BY-4.0','officialConcepts':['FMA7309','FMA7310'],'logic':'part_of',
                  'membershipSha256':sha('data/catalog/v43-FMA2Obj.txt'),'parts':records,'archives':source['archives'],
                  'excludedObsoleteIds':['FJ2041','FJ2044'],'cohortPolicy':'2014 default; 2011–2012 alternative. Disjoint views, no automatic geometric deduplication.',
                  'generator':{'file':str(Path(__file__).resolve().relative_to(Path.cwd())),'sha256':sha(__file__)}}
    Path('data/catalog/male-lung-source.json').write_text(json.dumps(supplement,indent=2)+'\n')
    print(f'Packed {len(parts)} details, {len(compressed)} bytes; lung views 285 / 278, all 563 official members retained.')


if __name__ == '__main__':
    main()
