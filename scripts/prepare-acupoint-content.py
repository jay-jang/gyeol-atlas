"""Prepare the 409-point authoring catalogue from checked research caches.

Not a runtime importer. Run parse-acupoint-research.py first. No procedure text.
TCM Wiki adaptations remain CC BY-SA 4.0 with per-record attribution.
KMCRIC position excerpts are short, separately attributed factual references.
"""
import json
import re
from pathlib import Path

def read(p):
    return json.loads(Path(p).read_text())

catalogue = read('data/acupoint-catalogue.json')
locations = {r[0]: r for r in read('.cache/acupoints/kmcric-locations.json')}
research = read('.cache/acupoints/tcm-sections.json')
extra_slugs = '''ex-hn1 dangyang ex-hn3 yuyao ex-hn5 ex-hn6 ex-hn7 shangyingxiang neiyingxiang ex-hn11 haiquan jinjin yuye yiming jingbailao ex-ca1 ex-b1 ex-b2 ex-b3 pigen xiajishu yaoyi ex-b7 shiqizhui yaoqi %E8%82%98%E5%B0%96 ex-ue2 zhongquan zhongkui dagukong xiaogukong ex-ue7 ex-ue8 ex-ue9 sifeng shixuan kuangu heding baichongwo neixiyan xiyan dannangxue lanwei neihuaijian waihuaijian bafeng duyin qiduan'''.split()
assert len(extra_slugs) == 48
extra_map = dict(zip([p['id'] for p in catalogue[361:]], extra_slugs))
# Checked public search excerpts, whose full-page web-cache responses were unavailable.
for slug, text in {
    'yaoyi': 'Lumbago, frequency of micturition, irregular menstruation.',
    'kuangu': 'Pain in the lower extremities.',
}.items():
    research[slug] = {'url': 'https://tcmwiki.com/wiki/' + slug,
                      'sections': [['Indications', text]], 'synonyms': slug}

# A concise summary of the independently checked eLotus entry, not a TCM Wiki adaptation.
research['xiaogukong'] = {
    'url': 'https://www.mastertungacupuncture.org/acupuncture/traditional/points/xiaogukong-ex-ue6',
    'sections': [['Indications', 'Eye disorders; deafness; hand joint pain.']],
    'synonyms': 'Xiaogukong 小骨空',
}

# Terms label historical indications; matching does not claim efficacy or a mechanism.
terms = [
    ('headache|head-wind', '두통'), ('migraine', '편두통'),
    ('cough', '기침'), ('asthma', '천식'), ('dyspn|shortness of breath', '숨참'),
    ('sore throat|pharyng|swelling of the throat|pain in the throat', '인후통'),
    ('toothache|tooth pain', '치통'), ('tinnitus', '이명'), ('deafness', '난청'),
    ('dizziness|vertigo', '어지럼'), ('insomnia', '불면'),
    ('palpitation', '두근거림'), ('gastric pain|stomachache|stomach pain', '위통'),
    ('abdominal pain|abdominalgia', '복통'), ('abdominal distention|abdominal distension', '복부 팽만'),
    ('vomiting|emesis', '구토'), ('nausea', '메스꺼움'),
    ('diarrh', '설사'), ('constipation', '변비'), ('dysentery', '이질'),
    ('hiccup|hiccough', '딸꾹질'), ('dyspepsia|indigestion', '소화불량'),
    ('lumbago|lumbar pain|low back pain|lower back pain|lumbar strain', '허리 통증'),
    ('backache|pain in the back|back pain', '등 통증'),
    ('stiff neck|neck rigidity|stiffness.*neck|pain.*neck|neck pain', '목 통증·뻣뻣함'),
    ('shoulder', '어깨 부위 증상'), ('elbow', '팔꿈치 부위 증상'),
    ('wrist', '손목 부위 증상'), ('hand joint pain', '손 관절통'),
    ('pain.*forearm', '아래팔 통증'), ('pain.*arm', '팔 통증'),
    ('pain.*hand|swelling.*hand', '손의 통증·부기'),
    ('numb fingers|numbness.*finger', '손가락 저림'),
    ('gonalgia|knee', '무릎 부위 증상'), ('ankle', '발목 부위 증상'),
    ('sciatica', '좌골신경통'), ('pain.*lower extremit|pain.*leg', '다리 통증'),
    ('weakness.*lower extremit|paralysis.*lower extremit', '다리 힘 빠짐'),
    ('numbness.*toe', '발가락 저림'), ('pain.*foot|pain.*feet', '발 통증'),
    ('ophthalmalgia|eye pain|pain.*eye', '눈 통증'), ('eye disease|eye disorder', '눈 관련 증상'),
    ('conjunctiv|redness.*eye|congestion.*eye', '눈 충혈'),
    ('lacrimation|tearing', '눈물 흘림'), ('blurred vision|blurring of vision', '시야 흐림'),
    ('eyelid|blepharo', '눈꺼풀 증상'), ('rhinitis|rhinorrhea|stuffy nose|nasal obstruction', '코막힘·콧물'),
    ('epistaxis', '코피'), ('facial paralysis|deviation.*mouth|deviation.*eye', '안면 증상'),
    ('fever|febrile', '열 증상'), ('common cold|influenza', '감기 증상'),
    ('spontaneous sweating|night sweating|night sweat', '땀 증상'),
    ('chest pain|pain in.*chest|pain of.*chest|precordial pain', '가슴 통증'),
    ('hypochondr', '옆구리 증상'), ('oppression.*chest|fullness.*chest', '가슴 답답함'),
    ('dysuria|retention of urine|urinary retention|difficult.*urination', '배뇨 곤란'),
    ('enuresis|incontinence', '유뇨'), ('frequency.*micturition|frequent.*urination', '빈뇨'),
    ('irregular menstruation|irregular menstr', '월경 불규칙'), ('dysmenorrh', '월경통'),
    ('amenorrh', '무월경'), ('leukorrh|leucorrh', '대하'),
    ('mastitis|breast pain', '유방 부위 증상'), ('lactation|hypogalactia', '수유 관련 증상'),
    ('hemorrhoid|haemorrhoid', '치질'), ('prolapse.*rectum', '탈항'),
    ('edema|oedema', '부종'), ('jaundice', '황달'), ('urticaria', '두드러기'),
    ('prurit|itching', '가려움'), ('scrofula', '나력(전통 병명)'),
    ('epilepsy', '간질로 기록된 증상'), ('convulsion', '경련'),
    ('amnesia|poor memory', '건망'), ('apoplexy|stroke', '중풍(전통 병명)'),
    ('hernia', '산증·탈장 관련 기록'), ('gastro-intestinal|gastrointestinal', '위장관 증상'),
    ('malnutrition', '영양장애'), ('pertussis', '백일해'),
    ('mass in the abdomen', '복부 종괴'), ('cholecystitis|cholelithiasis', '담낭 관련 증상'),
    ('heart pain|cardiac pain|cardialgia', '심통(전통 병명)'),
    ('scapular', '어깨뼈 부위 통증'), ('sciatic neuralgia', '좌골신경통'),
    ('atrophic debility.*lower limb', '다리 위축·무력'),
    ('intercostal neuralgia', '갈비사이 신경통'),
    ('upper portion of the thorax', '등 위쪽: 인후·흉부 관련 기록'),
    ('lower portion of the thorax', '등 아래쪽: 소화기 관련 기록'),
    ('urogenital system', '허리: 비뇨·생식기 관련 기록'),
    ('spasm.*foot', '발 경련'),
]

overrides = {
    'BL57': '종아리 뒤쪽, 장딴지근 힘살과 발꿈치힘줄 사이의 오목한 곳. 위중(BL40)에서 아래로 8촌.',
    'PC8': '손바닥의 둘째·셋째 손허리뼈 사이, 손허리손가락관절 몸쪽. 셋째·넷째 손허리뼈 사이로 보는 이설도 있음.',
    'PC9': '가운데손가락 끝의 중심. 손톱 노쪽 뿌리각 근처로 보는 이설도 있음.',
    'EX-UE7': '손등의 둘째·셋째 및 넷째·다섯째 손허리뼈 사이. 손마다 두 곳, 양손 네 곳.',
}
output = []
missing = []
for p in catalogue:
    id = p['id']
    slug = extra_map.get(id, {'ST34': 'liangqiu', 'GV16': 'fengfu', 'ST17': 'ruzhong'}.get(id, id.lower()))
    source = research.get(slug)
    if not source:
        missing.append((id, slug))
        continue
    raw = '\n'.join(t for title, t in source['sections'] if title.lower().startswith(('indication', 'incication'))).strip()
    raw = re.sub(r'(^|\n)\s*(?:\*\s*)?(?:\d+\.?|[①②③④⑤])\s*', r'\1', raw)
    if id == 'ST17':
        raw = ''
    elif not raw:
        missing.append((id, 'no traditional indication'))
    summaries = list(dict.fromkeys(label for pattern, label in terms if re.search(pattern, raw, re.I)))[:4]
    _, names, loc = locations[id]
    short = re.split(r'\n\s*(?:On|In|At|Between) ', loc)[0]
    short = re.sub(r'\([a-zA-Z][^)]*\)', lambda m: m[0] if re.match(r'\([A-Z]{2}\d', m[0]) else '', short)
    short = re.sub(r'\s+', ' ', short).strip()
    short = overrides.get(id, short)
    assert len(short.split()) <= 25, (id, short)
    pinyin = names[0].split(', ')[-1]
    if id == 'EX-LE3':
        pinyin = 'Baichongwo'
    output.append({**p, 'pinyin': pinyin, 'locationExcerpt': short,
                   'locationExcerptNote': 'KMCRIC 위치 설명에서 영문 병기 생략. 긴 항목은 별도 요약.',
                   'traditionalIndications': summaries, 'traditionalTextEn': raw,
                   'traditionSourceUrl': source['url'],
                   'traditionSourceId': 'elotus-extra' if id == 'EX-UE6' else 'tcm-wiki',
                   'traditionLicense': None if id == 'EX-UE6' else 'CC-BY-SA-4.0',
                   'traditionStatus': 'landmark-only' if id == 'ST17' else 'historical-not-clinically-validated',
                   'reviewStatus': 'AI 편집 · 전문가 미검수'})
Path('data/acupoint-content.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print('Prepared', len(output), 'content records. Missing sources:', missing)
print('Needs Korean indication review:', [(p['id'], p['traditionalTextEn']) for p in output if not p['traditionalIndications'] and p['id'] != 'ST17'])
assert not missing
assert len(output) == 409
