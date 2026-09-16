"""Assemble reviewed catalogue/content and authored seeds; anchors build separately."""
import json
import re
from pathlib import Path

def read(p): return json.loads(Path(p).read_text())
def write(p, x): Path(p).write_text(json.dumps(x, ensure_ascii=False, indent=2) + '\n')

content = read('data/acupoint-content.json')
seeds = read('data/acupoint-seeds.json')
theory = read('data/acupoint-theory.json')
legacy = {p['id']: p for p in read('data/acupoint-authoring/legacy-points.json')}
old_concepts = read('data/acupoint-authoring/legacy-point-concepts.json')
multi = {
    'EX-HN1': [[0,1.643,.013], [0,1.637,-.037], [-.025,1.645,-.012], [.025,1.645,-.012]],
    'EX-B2': [[-.013,y,z] for y,z in [(1.378,-.08),(1.359,-.085),(1.335,-.096),(1.311,-.096),(1.279,-.095),(1.243,-.096),(1.216,-.094),(1.187,-.096),(1.163,-.092),(1.131,-.088),(1.106,-.08),(1.077,-.073),(1.04,-.067),(1.017,-.063),(.989,-.063),(.963,-.063),(.928,-.067)]],
    'EX-UE2': [[-.266,.921,.043],[-.25,.921,.043]],
    'EX-UE7': [[-.281,.78,.02],[-.245,.785,.02]],
    'EX-UE9': [[-.306,.76,.024],[-.281,.733,.022],[-.26,.734,.022],[-.242,.743,.024]],
    'EX-UE10': [[-.293,.714,.04],[-.271,.703,.04],[-.25,.709,.04],[-.23,.723,.04]],
    'EX-UE11': [[-.326,.741,.06],[-.309,.686,.085],[-.276,.677,.094],[-.249,.689,.094],[-.223,.702,.081]],
    'EX-LE1': [[-.068,.505,.059],[-.141,.505,.048]],
    'EX-LE5': [[-.064,.432,.04],[-.101,.432,.04]],
    'EX-LE10': [[-.07,.023,.145],[-.095,.02,.134],[-.11,.02,.122],[-.125,.02,.112]],
    'EX-LE12': [[-.078,.017,.14],[-.089,.016,.143],[-.105,.018,.137],[-.116,.014,.13],[-.128,.012,.122]],
}
# Correction against the vertebral levels in the location catalogue.
for id,y in {'BL50':1.077,'BL51':1.04,'BL52':1.017}.items(): seeds[id]['position'][1]=y
seeds['EX-HN12']['position'][0] = .008  # Jinjin is left only; Yuye right only.
midline_extra = {'EX-HN1','EX-HN3','EX-HN10','EX-HN11','EX-HN12','EX-HN13','EX-B5','EX-B8','EX-B9'}
internal = {'GV28','EX-HN9','EX-HN10','EX-HN11','EX-HN12','EX-HN13'}

def body_region(p, seed):
    id, loc = p['id'], p['locationExcerpt']
    x,y,z = seed['position']
    # Use the stated anatomical region, never incidental substrings such as 오목의.
    start = loc.split(',')[0].replace(' ', '')
    if start.startswith(('앞가슴','옆가슴','가슴')): return ('몸통','가슴')
    if start.startswith(('윗배','아랫배','옆배','샅부위','회음')): return ('몸통','배·골반')
    if start.startswith(('목앞','목뒤','목부위')): return ('머리·목','목')
    if start.startswith(('아래팔','팔꿈치')): return ('팔·손','팔꿈치·아래팔')
    if start.startswith(('위팔','팔이음뼈','어깨')) and id != 'EX-UE1': return ('팔·손','어깨·위팔')
    if start.startswith(('넓적다리','넙다리')): return ('다리·발','넓적다리')
    if start.startswith(('종아리','무릎')) and id not in ['EX-LE9']: return ('다리·발','무릎·종아리')
    if id.startswith('EX-HN'):
        return ('머리·목', '목' if id in ['EX-HN14','EX-HN15'] else '머리·얼굴')
    if id.startswith('EX-B') or (p['meridian']=='BL' and 11<=int(id[2:])<=35) or (p['meridian']=='BL' and 41<=int(id[2:])<=54) or (p['meridian']=='GV' and 1<=int(id[2:])<=13):
        return ('몸통','등·허리')
    if id.startswith('EX-UE') or (abs(x)>.19 and .65<y<1.4):
        return ('팔·손', '손목·손' if y<.855 else '팔꿈치·아래팔' if y<1.12 else '어깨·위팔')
    if id.startswith('EX-LE') or (y<.82 and abs(x)>.03):
        return ('다리·발', '발목·발' if y<.145 else '무릎·종아리' if y<.5 else '넓적다리')
    if re.match('목 앞|목 뒤|목부위|목의|목 앞부위|목 뒤부위',loc) or id in ['GB20','GV14','GV15','GV16','SI16','SI17','TE16']:
        return ('머리·목','목')
    if y>1.47 or re.search('얼굴|머리|이마|눈확|귓|귀의',loc): return ('머리·목','머리·얼굴')
    if re.search('어깨|겨드랑',loc) or id in ['LI15','LI16','SI9','SI10','SI11','SI12','SI13','SI14','SI15','TE14','TE15','GB21']:
        return ('팔·손','어깨·위팔')
    return ('몸통','가슴' if y>1.17 else '배·골반')

points=[]; concepts={}
for p in content:
    id=p['id']; old=legacy.get(id,{}); seed={**seeds[id]}
    if old: seed={k:old[k] for k in ['position','surface']}
    region,detail=body_region(p,seed)
    bilateral=p['meridian'] not in ['GV','CV'] and id not in midline_extra
    positions=multi.get(id,[seed['position']])
    count=len(positions)*(2 if bilateral else 1)
    point={**p, **seed, 'region':region, 'bodyRegion':detail,
           'page':old.get('page'), 'location':old.get('location',p['locationExcerpt']),
           'bilateral':bilateral, 'occurrences':positions, 'markerCount':count,
           'markerMode':'region-reference' if id in internal else 'surface-illustration',
           'markerNote':'입·코 안의 위치입니다. 외부 체표 표식은 해당 부위의 참조이며 실제 내부 위치를 나타내지 않습니다.' if id in internal else '단일 인체에 편집한 학습용 근사 표식이며 표준 취혈 좌표가 아닙니다.',
           'structures':old.get('structures',[]),
           'landmarks':old.get('landmarks',[detail]),
           'related':old.get('related',[]), 'coordinateStatus':'illustrative',
           'sourceIds':list(dict.fromkeys([*old.get('sourceIds',[]),'kmcric-points',p['traditionSourceId'],'five-shu-theory']))}
    points.append(point)
    t=theory[id]
    concepts[id]={**old_concepts.get(id,{'traditionalChannel':None,'traditionalName':None,'organIds':[],'sourceIds':['point-categories'],'note':'전통 분류와 현대 해부학을 구분합니다.'}), 'categories':t['categories'], 'shuType':t['fiveShu']['type'] if t['fiveShu'] else None}
write('data/points.json',points);write('data/point-concepts.json',concepts)
print('Assembled',len(points),'points with',sum(p['markerCount'] for p in points),'illustrative occurrences; projection pending.')
