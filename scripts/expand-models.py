import json,re,urllib.request
from pathlib import Path
# Optional authoring helper. Runtime builds use the checked-in model-inputs.json.
inputs=json.load(open('scripts/model-inputs.json'))
commit=inputs['commit']
cache=Path('.cache/catalog');cache.mkdir(parents=True,exist_ok=True)
for filename,url in {
 'tree.json':f'https://api.github.com/repos/Kevin-Mattheus-Moerman/BodyParts3D/git/trees/{commit}?recursive=1',
 'parts.txt':f'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/{commit}/assets/BodyParts3D_data/parts_list_e.txt'
}.items():
 if not (cache/filename).exists():
  with urllib.request.urlopen(url,timeout=60) as response:(cache/filename).write_bytes(response.read())
j=json.loads((cache/'tree.json').read_text());files={x['path'].split('/')[-1][:-4]:x for x in j['tree'] if x['path'].endswith('.stl')}
have={a['id'] for a in inputs['assets']}
organs={'FMA7148':'위','FMA7197':'간','FMA7202':'담낭','FMA7383':'오른폐 중엽','FMA7333':'오른폐 상엽','FMA7337':'오른폐 하엽','FMA7370':'왼폐 상엽','FMA7371':'왼폐 하엽','FMA15900':'방광','FMA7196':'지라(비장)','FMA7198nsn':'이자(췌장)','FMA7204':'오른콩팥','FMA7205':'왼콩팥','FMA7274':'심장벽','FMA14543nsn':'결장','FMA7206':'십이지장','FMA7207':'공장','FMA7208':'회장','FMA14544':'직장'}
nerves={'FMA50875':'오른시신경','FMA50878':'왼시신경','FMA62004':'숨뇌(연수)','FMA67943':'다리뇌(교뇌)','FMA67944':'소뇌','FMA61822':'대뇌반구 백질','FMA61993nsn':'중뇌'}
labels={}
for l in open(cache/'parts.txt'):
 if '\t' not in l:continue
 i,n=l.strip().split('\t')
 if i not in files:continue
 layer='organ' if i in organs else 'nerve' if i in nerves else 'vessel' if re.search(r'artery$|vein$|aorta$|vena cava$',n) else None
 if not layer:continue
 labels[i]=organs.get(i,nerves.get(i,n))
 if i not in have:inputs['assets'].append({'id':i,'name':n,'label':labels[i],'layer':layer,'path':files[i]['path']})
Path('scripts/model-inputs.json').write_text(json.dumps(inputs,ensure_ascii=False,indent=2)+'\n')
print({layer:sum(a['layer']==layer for a in inputs['assets']) for layer in ['skin','bone','muscle','organ','vessel','nerve']})
