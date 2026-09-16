import json,pathlib
meridians=[('LU','수태음폐경','폐경','Lung',11,'#779c93'),('LI','수양명대장경','대장경','Large intestine',20,'#d4985d'),('ST','족양명위경','위경','Stomach',45,'#c98547'),('SP','족태음비경','비경','Spleen',21,'#a28d5b'),('HT','수소음심경','심경','Heart',9,'#bd7373'),('SI','수태양소장경','소장경','Small intestine',19,'#c08878'),('BL','족태양방광경','방광경','Bladder',67,'#6a8faf'),('KI','족소음신경','신경','Kidney',27,'#858caf'),('PC','수궐음심포경','심포경','Pericardium',9,'#b77898'),('TE','수소양삼초경','삼초경','Triple energizer',23,'#a391b2'),('GB','족소양담경','담경','Gallbladder',44,'#84a875'),('LR','족궐음간경','간경','Liver',14,'#6c9a82'),('GV','독맥','독맥','Governor vessel',28,'#8b889b'),('CV','임맥','임맥','Conception vessel',24,'#b3956e')]
ms=[dict(zip(['id','name','shortName','english','total','color'],m)) for m in meridians]
# Locations are short independent study summaries; not a translated reproduction of the standard.
rows=[
('LU9','태연','太淵','Taiyuan','팔·손',30,'손목 앞가쪽, 노뼈 붓돌기와 손배뼈 사이.',[-.277,.827,.05],'front',['FMA23464'],['노뼈','손배뼈'],['HT7','PC6']),
('LI4','합곡','合谷','Hegu','팔·손',35,'손등, 둘째 손허리뼈 중간의 엄지 쪽.',[-.282,.778,.02],'back',['FMA24466'],['둘째 손허리뼈'],['LI11','SI3']),
('LI11','곡지','曲池','Quchi','팔·손',39,'팔꿈치 가쪽, 척택과 위팔뼈 가쪽위관절융기 사이 중점.',[-.245,1.071,.005],'front',['FMA23130'],['위팔뼈'],['LI4']),
('ST25','천추','天樞','Tianshu','몸통',58,'배꼽 중심에서 가쪽 2 B-cun.',[-.05,1.005,.14],'front',['FMA13377'],['배곧은근'],['CV12','ST36']),
('ST35','독비','犢鼻','Dubi','다리·발',63,'무릎 앞쪽, 무릎인대 가쪽의 오목한 곳.',[-.101,.432,.04],'front',['FMA24477'],['정강뼈','무릎인대'],['ST36','GB34']),
('ST36','족삼리','足三里','Zusanli','다리·발',64,'독비–해계 연결선에서 독비 아래 3 B-cun. 앞정강근 위.',[-.106,.358,.04],'front',['FMA22544','FMA24477'],['앞정강근','정강뼈'],['ST35','GB34','SP9']),
('SP6','삼음교','三陰交','Sanyinjiao','다리·발',72,'안쪽복사 위 3 B-cun, 정강뼈 안쪽모서리 뒤.',[-.042,.16,-.04],'medial',['FMA24477'],['정강뼈'],['KI3','SP9']),
('SP9','음릉천','陰陵泉','Yinlingquan','다리·발',74,'정강뼈 안쪽관절융기 아래, 안쪽모서리와 만나는 오목한 곳.',[-.04,.392,.015],'medial',['FMA24477'],['정강뼈'],['SP6','ST36']),
('HT7','신문','神門','Shenmen','팔·손',85,'손목 앞주름, 자쪽손목굽힘근 힘줄의 노뼈 쪽.',[-.247,.835,.05],'front',['FMA23467'],['자쪽손목굽힘근 힘줄','자뼈'],['LU9','PC6']),
('SI3','후계','後谿','Houxi','팔·손',89,'다섯째 손허리손가락관절의 몸쪽·자뼈 쪽, 손바닥과 손등 경계.',[-.248,.739,.015],'back',['FMA24472'],['다섯째 손허리뼈'],['LI4','TE5']),
('BL40','위중','委中','Weizhong','다리·발',119,'무릎 뒤 오금주름의 가운데.',[-.079,.429,-.083],'back',['FMA24474'],['오금주름','넙다리뼈'],['GB34','ST35']),
('KI3','태계','太谿','Taixi','다리·발',137,'안쪽복사와 발꿈치힘줄 사이의 오목한 곳.',[-.043,.087,-.047],'medial',['FMA24477'],['안쪽복사','발꿈치힘줄'],['SP6','LR3']),
('PC6','내관','內關','Neiguan','팔·손',154,'손목 앞주름 위 2 B-cun, 긴손바닥근·노쪽손목굽힘근 힘줄 사이.',[-.253,.88,.035],'front',['FMA23464','FMA23467'],['긴손바닥근 힘줄','노쪽손목굽힘근 힘줄'],['TE5','HT7']),
('TE5','외관','外關','Waiguan','팔·손',160,'손목 뒤주름 위 2 B-cun, 노뼈와 자뼈 사이.',[-.251,.88,-.02],'back',['FMA23464','FMA23467'],['노뼈','자뼈'],['PC6','SI3']),
('GB20','풍지','風池','Fengchi','머리·목',181,'뒤통수뼈 아래, 목빗근과 등세모근 기시 사이.',[-.039,1.433,-.08],'back',['FMA52735'],['뒤통수뼈','목빗근','등세모근'],['GV20']),
('GB34','양릉천','陽陵泉','Yanglingquan','다리·발',188,'종아리뼈 머리의 앞아래 오목한 곳.',[-.13,.39,-.008],'lateral',['FMA24480'],['종아리뼈'],['ST36','SP9']),
('LR3','태충','太衝','Taichong','다리·발',197,'발등, 첫째·둘째 발허리뼈 바닥 접합부의 먼쪽 사이.',[-.075,.056,.11],'top',['FMA24507','FMA24509'],['첫째 발허리뼈','둘째 발허리뼈'],['KI3']),
('GV20','백회','百會','Baihui','머리·목',213,'머리 정중선, 앞머리카락 경계 위 5 B-cun.',[0,1.65,-.012],'top',['FMA52734'],['머리 정중선'],['GB20']),
('CV12','중완','中脘','Zhongwan','몸통',225,'배꼽 위 4 B-cun, 앞정중선.',[0,1.11,.14],'front',['FMA13377','FMA13378'],['앞정중선','배곧은근'],['ST25','CV17']),
('CV17','전중','膻中','Danzhong','몸통',228,'앞가슴 정중선, 넷째 갈비사이공간 높이.',[0,1.24,.12],'front',['FMA7487'],['복장뼈','넷째 갈비사이공간'],['CV12'])]
ps=[]
for row in rows:
 p=dict(zip(['id','name','hanja','pinyin','region','page','location','position','surface','structures','landmarks','related'],row));p['meridian']=''.join(c for c in p['id'] if c.isalpha());p['bilateral']=p['meridian'] not in ['CV','GV'];p['coordinateStatus']='illustrative';p['sourceIds']=['who-locations'];p['reviewStatus']='AI 작성 · 전문가 미검수';ps.append(p)
pathlib.Path('data/meridians.json').write_text(json.dumps(ms,ensure_ascii=False,indent=2)+'\n')
pathlib.Path('data/points.json').write_text(json.dumps(ps,ensure_ascii=False,indent=2)+'\n')
sources=[
{'id':'who-locations','title':'WHO Standard Acupuncture Point Locations in the Western Pacific Region','publisher':'WHO Western Pacific','year':'2008 · 2009 재인쇄','url':'https://iris.who.int/handle/10665/353407','accessUrl':'https://www.scribd.com/document/235727760/World-Health-Organization-WHO-Standard-Accupuncture-Point-Locations','kind':'위치 표준','note':'공식 PDF 접근 제한으로 WHO 문서의 공개 재현본에서 항목과 인쇄 쪽수를 대조. 원문 전체는 포함하지 않음. 3D 좌표의 출처가 아님.'},
{'id':'who-names','title':'Standard acupuncture nomenclature','publisher':'WHO Western Pacific','year':'1993 · 웹 게시 2014','url':'https://www.who.int/publications/i/item/9290611057','kind':'명칭 표준','note':'361개 고전 경혈의 명칭 체계. 이 사이트의 20개 선별 항목과 전체 표준 범위를 구분.'},
{'id':'nccih','title':'Acupuncture: Effectiveness and Safety','publisher':'NIH · NCCIH','year':'열람 2026-09-07','url':'https://www.nccih.nih.gov/health/acupuncture-effectiveness-and-safety','kind':'근거 개요','note':'질환별 근거와 위해 가능성을 설명하는 공공기관 자료. 특정 경혈 단독의 효능 근거로 사용하지 않음.'},
{'id':'who-practice','title':'WHO benchmarks for the practice of acupuncture','publisher':'WHO','year':'2021','url':'https://www.who.int/westernpacific/publications/i/item/978-92-4-001688-0','kind':'실무 기준','note':'침술 서비스의 인프라와 안전한 실무 기준. 본 사이트는 시술 지침을 제공하지 않음.'},
{'id':'bodyparts','title':'BodyParts3D / Anatomography','publisher':'Database Center for Life Science','year':'모델 v3.0 · 20110915','url':'https://lifesciencedb.jp/bp3d/info/index.html','kind':'3D 해부 모델','note':'CC BY-SA 2.1 Japan. 단일 남성 모델이며 해부학적 오류 가능성을 원저자가 명시.'},
{'id':'bodyparts-mirror','title':'BodyParts3D STL mirror','publisher':'Kevin Mattheus Moerman','year':'고정 커밋 f0eeb6e8','url':'https://github.com/Kevin-Mattheus-Moerman/BodyParts3D/tree/f0eeb6e843380cfe6b83797cf8c3e1af74de5e61','kind':'모델 배포','note':'원본 OBJ를 STL로 변환한 미러. 이 프로젝트는 STL을 경량 GLB로 변환.'}]
for s in sources:s['accessed']='2026-09-07'
pathlib.Path('data/sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
