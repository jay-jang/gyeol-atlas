import json
from pathlib import Path
points=json.load(open('data/points.json'));known={p['id'] for p in points}
rows=[
('ST42','충양','衝陽','Chongyang',67,'발등, 둘째 발허리뼈 바닥과 중간쐐기뼈의 관절 부위.',[-.085,.07,.075],'top','FMA24509','둘째 발허리뼈'),
('SP3','태백','太白','Taibai',71,'첫째 발허리발가락관절 몸쪽, 발 안쪽의 발등·발바닥 경계.',[-.065,.018,.115],'medial','FMA24507','첫째 발허리뼈'),
('SI4','완골','腕骨','Wangu',89,'손목 뒤안쪽, 다섯째 손허리뼈 바닥과 세모뼈 사이.',[-.247,.803,.02],'back','FMA24472','다섯째 손허리뼈'),
('BL64','경골','京骨','Jinggu',132,'발 가쪽, 다섯째 발허리뼈 거친면의 먼쪽.',[-.122,.031,.078],'lateral','FMA24480','다섯째 발허리뼈'),
('PC7','대릉','大陵','Daling',155,'손목 앞주름, 긴손바닥근과 노쪽손목굽힘근 힘줄 사이.',[-.26,.831,.05],'front','FMA23464','노뼈'),
('TE4','양지','陽池','Yangchi',159,'손목 뒤주름, 손가락폄근 힘줄의 자뼈 쪽.',[-.254,.827,.01],'back','FMA23467','자뼈'),
('GB40','구허','丘墟','Qiuxu',191,'가쪽복사 앞아래, 긴발가락폄근 힘줄 가쪽.',[-.114,.064,.019],'front','FMA24480','종아리뼈'),
('LU1','중부','中府','Zhongfu',26,'첫째 갈비사이공간 높이, 앞정중선 가쪽 6 B-cun.',[-.147,1.315,.085],'front','FMA13322','빗장뼈'),
('LR13','장문','章門','Zhangmen',202,'배 가쪽, 열한째 갈비뼈 자유끝 아래.',[-.142,1.079,.006],'lateral','FMA13377','열한째 갈비뼈'),
('LR14','기문','期門','Qimen',202,'여섯째 갈비사이공간, 앞정중선 가쪽 4 B-cun.',[-.09,1.169,.125],'front','FMA13377','여섯째 갈비사이공간'),
('GB24','일월','日月','Riyue',183,'일곱째 갈비사이공간, 앞정중선 가쪽 4 B-cun.',[-.09,1.142,.12],'front','FMA13377','일곱째 갈비사이공간'),
('GB25','경문','京門','Jingmen',184,'배 가쪽, 열두째 갈비뼈 자유끝 아래.',[-.124,1.046,-.043],'lateral','FMA13377','열두째 갈비뼈'),
('CV3','중극','中極','Zhongji',221,'배꼽 아래 4 B-cun의 앞정중선.',[0,.875,.12],'front','FMA13377','앞정중선'),
('CV4','관원','關元','Guanyuan',221,'배꼽 아래 3 B-cun의 앞정중선.',[0,.907,.12],'front','FMA13377','앞정중선'),
('CV5','석문','石門','Shimen',222,'배꼽 아래 2 B-cun의 앞정중선.',[0,.94,.14],'front','FMA13377','앞정중선'),
('CV14','거궐','巨闕','Juque',226,'배꼽 위 6 B-cun의 앞정중선.',[0,1.16,.13],'front','FMA7487','앞정중선')]
for id,name,hanja,pinyin,page,location,pos,surface,fma,landmark in rows:
 if id in known:continue
 meridian=''.join(c for c in id if c.isalpha())
 points.append(dict(id=id,name=name,hanja=hanja,pinyin=pinyin,region='몸통' if pos[1]> .85 and abs(pos[0])<.2 else '팔·손' if pos[1]>.7 else '다리·발',page=page,location=location,position=pos,surface=surface,structures=[fma],landmarks=[landmark],related=['CV12'] if meridian=='CV' else [next(p['id'] for p in points if p['meridian']==meridian)],meridian=meridian,bilateral=meridian!='CV',coordinateStatus='illustrative',sourceIds=['who-locations','point-categories'],reviewStatus='AI 작성 · 전문가 미검수'))
channels=['LU','LI','ST','SP','HT','SI','BL','KI','PC','TE','GB','LR']
yuan=['LU9','LI4','ST42','SP3','HT7','SI4','BL64','KI3','PC7','TE4','GB40','LR3']
mu=['LU1','ST25','CV12','LR13','CV14','CV4','CV3','GB25','CV17','CV5','GB24','LR14']
organs={'LU':['FMA7333','FMA7370','FMA7337','FMA7371','FMA7383'],'LI':['FMA14543nsn'],'ST':['FMA7148'],'SP':['FMA7196'],'HT':['FMA7274'],'SI':['FMA7206','FMA7207','FMA7208'],'BL':['FMA15900'],'KI':['FMA7204','FMA7205'],'PC':[],'TE':[],'GB':['FMA7202'],'LR':['FMA7197']}
names=['폐','대장','위','비','심','소장','방광','신','심포','삼초','담','간']
shu={'LU9':'수(兪)','SP3':'수(兪)','HT7':'수(兪)','KI3':'수(兪)','PC7':'수(兪)','LR3':'수(兪)','SI3':'수(兪)','LI11':'합(合)','ST36':'합(合)','SP9':'합(合)','BL40':'합(合)','GB34':'합(合)'}
relations={}
for p in points:
 tags=[];target=None
 if p['id'] in yuan:tags.append('yuan');target=channels[yuan.index(p['id'])]
 if p['id'] in mu:tags.append('mu');target=channels[mu.index(p['id'])]
 if p['id'] in shu:tags.append('five-shu')
 if p['id'] in ['PC6','TE5']:tags.append('luo')
 relations[p['id']]={'categories':tags,'shuType':shu.get(p['id']),'traditionalChannel':target,'traditionalName':names[channels.index(target)] if target else None,'organIds':organs.get(target,[]),'sourceIds':['point-categories'] if tags else [],'note':'전통적 장부 대응이며 압력 전달 경로나 장기 마사지 효과를 뜻하지 않습니다.'}
Path('data/points.json').write_text(json.dumps(points,ensure_ascii=False,indent=2)+'\n')
Path('data/point-concepts.json').write_text(json.dumps(relations,ensure_ascii=False,indent=2)+'\n')
Path('data/concepts.json').write_text(json.dumps([{'id':'yuan','name':'원혈','hanja':'原穴','description':'십이경맥마다 하나씩 분류하는 원혈. 손발의 경혈과 장부의 전통적 관계를 비교합니다.','expectedTotal':12},{'id':'mu','name':'모혈','hanja':'募穴','description':'가슴·배에 분포하는 장부의 모혈. 소속 경맥과 대응 장부가 다를 수 있습니다.','expectedTotal':12},{'id':'five-shu','name':'오수혈','hanja':'五輸穴','description':'정·형·수·경·합의 다섯 분류. 현재 수록점 중 수혈·합혈을 표시합니다.','expectedTotal':60},{'id':'luo','name':'낙혈','hanja':'絡穴','description':'전통적으로 경맥 사이의 연결에 쓰이는 분류. 현재 내관·외관을 수록합니다.','expectedTotal':15}],ensure_ascii=False,indent=2)+'\n')
sources=json.load(open('data/sources.json'))
for s in [{'id':'point-categories','title':'TCM Acupuncture Point Charts — Specific Points / Five Shu','publisher':'eLotus CORE','year':'열람 2026-09-08','url':'https://www.mastertungacupuncture.org/acupuncture/traditional/system/pointcharts','kind':'전통 분류 교육자료','note':'원혈·모혈·오수혈·낙혈 명칭 대응표만 참조. 해당 자료의 치료 효능 주장은 이 사이트의 검증된 근거로 채택하지 않음. TH를 WHO 코드 TE로 정규화.','accessed':'2026-09-08'},{'id':'massage-nccih','title':'Massage Therapy: What You Need To Know','publisher':'NIH · NCCIH','year':'열람 2026-09-08','url':'https://www.nccih.nih.gov/health/massage-therapy-what-you-need-to-know','kind':'마사지 근거·안전','note':'마사지 연구의 한계와 강한 마사지에서 보고된 위해. 경혈별 내부 장기 마사지 효과의 근거는 제공하지 않음.','accessed':'2026-09-08'}]:
 if not any(x['id']==s['id'] for x in sources):sources.append(s)
Path('data/sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
