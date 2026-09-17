"""Editorial Korean search labels; FMA IDs and original names remain authoritative."""
import json,re
from pathlib import Path
assets=json.load(open('scripts/model-inputs.json'))['assets']
base={
'Skin':'피부','occipital bone':'뒤통수뼈(후두골)','frontal bone':'이마뼈(전두골)','mandible':'아래턱뼈(하악골)','sacrum':'엉치뼈(천골)','body of sternum':'복장뼈 몸통(흉골체)',
'clavicle':'빗장뼈(쇄골)','scapula':'어깨뼈(견갑골)','hip bone':'볼기뼈(관골)','humerus':'위팔뼈(상완골)','radius':'노뼈(요골)','ulna':'자뼈(척골)','femur':'넙다리뼈(대퇴골)','tibia':'정강뼈(경골)','fibula':'종아리뼈(비골)','talus':'목말뼈(거골)','patella':'무릎뼈(슬개골)','calcaneus':'발꿈치뼈(종골)','temporal bone':'관자뼈(측두골)','parietal bone':'마루뼈(두정골)','maxilla':'위턱뼈(상악골)',
'atlas':'고리뼈(제1목뼈)','axis':'중쇠뼈(제2목뼈)','capitate':'알머리뼈(유두골)','costal cartilage':'갈비연골','cuboid bone':'입방뼈','ethmoid':'벌집뼈(사골)','hamate':'갈고리뼈(유구골)','hyoid bone':'목뿔뼈(설골)','inferior nasal concha':'아래코선반(하비갑개)','intermediate cuneiform bone':'중간쐐기뼈','lacrimal bone':'눈물뼈(누골)','lateral cuneiform bone':'가쪽쐐기뼈','long plantar ligament':'긴발바닥인대','lunate':'반달뼈(월상골)','manubrium':'복장뼈자루(흉골병)','medial cuneiform bone':'안쪽쐐기뼈','nasal bone':'코뼈(비골)','palatine bone':'입천장뼈(구개골)','pisiform':'콩알뼈(두상골)','scaphoid':'손배뼈(주상골)','sphenoid bone':'나비뼈(접형골)','trapezium':'큰마름뼈(대능형골)','trapezoid':'작은마름뼈(소능형골)','triquetral':'세모뼈(삼각골)','vomer':'보습뼈(서골)','xiphoid process':'칼돌기(검상돌기)','zygomatic bone':'광대뼈(관골)',
'distal phalanx of big toe':'엄지발가락 끝마디뼈','distal phalanx of index finger':'집게손가락 끝마디뼈','distal phalanx of little finger':'새끼손가락 끝마디뼈','distal phalanx of little toe':'새끼발가락 끝마디뼈','distal phalanx of middle finger':'가운데손가락 끝마디뼈','distal phalanx of ring finger':'약손가락 끝마디뼈','distal phalanx of thumb':'엄지손가락 끝마디뼈','distal phalanx of toe':'발가락 끝마디뼈','middle phalanx of index finger':'집게손가락 중간마디뼈','middle phalanx of little finger':'새끼손가락 중간마디뼈','middle phalanx of little toe':'새끼발가락 중간마디뼈','middle phalanx of middle finger':'가운데손가락 중간마디뼈','middle phalanx of ring finger':'약손가락 중간마디뼈','middle phalanx of toe':'발가락 중간마디뼈','proximal phalanx of big toe':'엄지발가락 첫마디뼈','proximal phalanx of index finger':'집게손가락 첫마디뼈','proximal phalanx of little finger':'새끼손가락 첫마디뼈','proximal phalanx of little toe':'새끼발가락 첫마디뼈','proximal phalanx of middle finger':'가운데손가락 첫마디뼈','proximal phalanx of ring finger':'약손가락 첫마디뼈','proximal phalanx of thumb':'엄지손가락 첫마디뼈','proximal phalanx of toe':'발가락 첫마디뼈',
'gingiva of lower jaw':'아래턱 잇몸','gingiva of upper jaw':'위턱 잇몸','interosseous membrane of forearm':'아래팔뼈사이막','interosseous membrane of leg':'종아리뼈사이막','intervertebral disk of axis':'중쇠뼈 척추사이원반','intervertebral disk of cervical vertebra':'목뼈 척추사이원반','intervertebral disk of lumbar vertebra':'허리뼈 척추사이원반','intervertebral disk of thoracic vertebra':'등뼈 척추사이원반','navicular bone of foot':'발배뼈(주상골)','sesamoid bone of foot':'발 종자뼈',
'rectus abdominis':'배곧은근(복직근)','sartorius':'넙다리빗근(봉공근)','tibialis anterior':'앞정강근(전경골근)','trapezius':'등세모근(승모근)','deltoid':'어깨세모근(삼각근)','pectoralis major':'큰가슴근(대흉근)','brachialis':'위팔근(상완근)','flexor carpi radialis':'노쪽손목굽힘근(요측수근굴근)','palmaris longus':'긴손바닥근(장장근)','brachioradialis':'위팔노근(상완요골근)','rectus femoris':'넙다리곧은근(대퇴직근)','vastus lateralis':'가쪽넓은근(외측광근)','vastus medialis':'안쪽넓은근(내측광근)','gastrocnemius':'장딴지근(비복근)',
'ascending aorta':'오름대동맥(상행대동맥)','arch of aorta':'대동맥활(대동맥궁)','descending aorta':'내림대동맥(하행대동맥)','gastric artery':'위동맥','common hepatic artery':'온간동맥(총간동맥)','splenic artery':'지라동맥(비동맥)','superior mesenteric artery':'위창자간막동맥(상장간막동맥)','inferior mesenteric artery':'아래창자간막동맥(하장간막동맥)','great cardiac vein':'큰심장정맥','middle cardiac vein':'중간심장정맥','superior vena cava':'위대정맥(상대정맥)','inferior vena cava':'아래대정맥(하대정맥)','superior mesenteric vein':'위창자간막정맥(상장간막정맥)','splenic vein':'지라정맥(비정맥)','renal vein':'콩팥정맥(신정맥)','renal artery':'콩팥동맥(신동맥)','common iliac artery':'온엉덩동맥(총장골동맥)','external iliac artery':'바깥엉덩동맥(외장골동맥)','internal iliac artery':'속엉덩동맥(내장골동맥)','external iliac vein':'바깥엉덩정맥(외장골정맥)','internal iliac vein':'속엉덩정맥(내장골정맥)','common iliac vein':'온엉덩정맥(총장골정맥)','common carotid artery':'온목동맥(총경동맥)','subclavian artery':'빗장밑동맥(쇄골하동맥)','brachiocephalic vein':'팔머리정맥(완두정맥)','internal jugular vein':'속목정맥(내경정맥)','subclavian vein':'빗장밑정맥(쇄골하정맥)','celiac artery':'복강동맥','pulmonary artery':'폐동맥','pulmonary vein':'폐정맥'}
exact={'FMA3818':'오른관상동맥 모서리가지','FMA71669':'오른관상동맥 심실사이중격가지들','FMA76994':'오른관상동맥 뒤가쪽가지','FMA71670':'왼관상동맥 심실사이중격가지들','FMA3895':'왼관상동맥 휘돌이가지','FMA3802':'오른관상동맥 줄기','FMA4685':'왼관상동맥 줄기'}
ordinals=dict(zip('first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth'.split(),range(1,13)))
parts={'ascending part':'오름부분','transverse part':'가로부분','descending part':'내림부분','clavicular part':'빗장부분','acromial part':'봉우리부분','spinal part':'가시부분','abdominal part':'배부분','medial head':'안쪽갈래','lateral head':'가쪽갈래','sternocostal part':'복장갈비부분'}
base.update(dict(line.rstrip('\n').split('\t',1) for line in open('data/catalog/ko-glossary.tsv') if '\t' in line))
parts.update({'long head':'긴갈래','short head':'짧은갈래','humeral head':'위팔갈래','ulnar head':'자뼈갈래','humeroulnar head':'위팔자뼈갈래','radial head':'노뼈갈래','deep head':'깊은갈래','superficial head':'얕은갈래','oblique head':'빗갈래','transverse head':'가로갈래','lower head':'아래갈래','upper head':'위갈래','anterior belly':'앞힘살','posterior belly':'뒤힘살','orbital part':'눈확부분','palpebral part':'눈꺼풀부분','deep part':'깊은부분','superficial part':'얕은부분','superior oblique part':'위빗부분','inferior oblique part':'아래빗부분','vertical intermediate part':'수직중간부분','anterior part':'앞부분','posterior part':'뒤부분'})
def expanded(n):
 if n in base: return base[n]
 side='오른쪽 ' if re.search(r'\bright\b',n) else '왼쪽 ' if re.search(r'\bleft\b',n) else ''
 n=re.sub(r'\bright\b|\bleft\b','',n); n=' '.join(n.split())
 if n in base:return side+base[n]
 m=re.fullmatch(r'intervertebral disk of (first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) (cervical|thoracic|lumbar) vertebra',n)
 if m:
  region={'cervical':'목뼈','thoracic':'등뼈','lumbar':'허리뼈'}[m[2]]
  return f'{region} 제{ordinals[m[1]]} 척추사이원반'
 m=re.fullmatch(r'(proximal|middle|distal) phalanx of (second|third|fourth) toe',n)
 if m:
  segment={'proximal':'첫','middle':'중간','distal':'끝'}[m[1]]
  return f'{side}제{ordinals[m[2]]} 발가락 {segment}마디뼈'
 suffix=''
 if n.startswith('set of '): n=n[7:];suffix=' 모음'
 for en,ko in parts.items():
  if n.startswith(en+' of '): n=n[len(en)+4:];suffix+=' · '+ko;break
 location=''
 for en,ko in [(' of hand','손 '),(' of foot','발 ')]:
  if n.endswith(en):n=n[:-len(en)];location=ko
 order=''
 for en,num in ordinals.items():
  if n.startswith(en+' '):order=f'제{num} ';n=n[len(en)+1:];break
 if n in base:return side+location+order+base[n]+suffix
 if n.endswith('secondary incisor tooth') or n.endswith('secondary canine tooth') or n.endswith('secondary premolar tooth') or n.endswith('secondary molar tooth'):
  words={'upper':'위턱','lower':'아래턱','lateral':'가쪽','central':'가운데','first':'첫째','second':'둘째','secondary':'영구치','incisor':'앞니','canine':'송곳니','premolar':'작은어금니','molar':'큰어금니','tooth':''}
  return side+' '.join(words[x] for x in n.split() if words[x])
 raise ValueError(n)
def neural_label(n):
 text=n.lower()
 for en,ko in sorted(base.items(),key=lambda kv:len(kv[0]),reverse=True):
  text=re.sub(r'(?<![a-z])'+re.escape(en.strip())+r'(?![a-z])',lambda m:ko,text)
 words={'set':'모음','branches':'가지들','branch':'가지','of':'·','to':'→','with':'연결','right':'오른쪽','left':'왼쪽','superior':'위','inferior':'아래','medial':'안쪽','lateral':'가쪽','anterior':'앞','posterior':'뒤','first':'제1','second':'제2','third':'제3','fourth':'제4','fifth':'제5','sixth':'제6','seventh':'제7','eighth':'제8','trunk':'줄기','root':'뿌리','cord':'다발','middle':'중간','communicating':'교통','ganglionic':'신경절','nerve':'신경','buccal':'볼','cervical':'목','marginal':'모서리','mandibular':'아래턱','temporal':'관자','zygomatic':'광대','occipital':'뒤통수','orbital':'눈확','palpebral':'눈꺼풀','labial':'입술','external':'바깥','internal':'속','nasal':'코','cutaneous':'피부','dorsal':'등쪽','digital':'손가락','proper':'고유','palmar':'손바닥','index':'집게','ring':'약','thumb':'엄지','finger':'손가락','side':'쪽','pericardial':'심장막','phrenico':'가로막','abdominal':'배','isthmus':'잘록','lobe':'엽','cavernous':'해면','part':'부분','carotid':'목동맥','artery':'동맥','nerves':'신경들','superficial':'얕은'}
 for word in set(re.findall('[a-z]+',text)):
  if word not in words:raise ValueError((n,word))
 return re.sub('[a-z]+',lambda m:words[m[0]],text)
def translate(a):
 if a.get('sourceVersion')=='4.3':return neural_label(a['name'])
 if a['id'] in exact:return exact[a['id']]
 if a.get('label') and re.search('[가-힣]',a['label']):return a['label']
 n=a['name'];part=''
 for en,ko in parts.items():
  if n.startswith(en+' of '):part=' · '+ko;n=n[len(en+' of '):];break
 side=''
 for en,ko in [('right ','오른쪽 '),('left ','왼쪽 ')]:
  if n.startswith(en):side=ko;n=n[len(en):];break
 if n in base:return side+base[n]+part
 for en,num in ordinals.items():
  if n.startswith(en+' '):
   rest=n[len(en)+1:];t={'cervical vertebra':'목뼈(경추)','thoracic vertebra':'등뼈(흉추)','lumbar vertebra':'허리뼈(요추)','rib':'갈비뼈(늑골)','metacarpal bone':'손허리뼈(중수골)','metatarsal bone':'발허리뼈(중족골)'}.get(rest)
   if t:return f'{side}제{num} {t}'
 return expanded(a['name'])
labels={a['id']:translate(a) for a in assets};Path('data/structure-labels.json').write_text(json.dumps(labels,ensure_ascii=False,indent=2)+'\n');print(len(labels),'bilingual labels')
