import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import {ready} from './helpers';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const catalog=[...read('scripts/model-inputs.json').assets,...read('data/full-system-structures.json'),...read('data/sex-lymph-structures.json'),...read('data/female-atlas-structures.json'),...read('data/female-detail-structures.json')];
const layerById=Object.fromEntries(catalog.map(s=>[s.id,s.layer]));

async function observe(page:Page) {
  let url='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))url=r.url();});
  await page.goto('/');await ready(page);
  await page.evaluate(async({url,layerById})=>{
    const {_roots}=await import(/* @vite-ignore */url),state=_roots.get(document.querySelector('canvas')).store.getState();
    const renderer=state.gl,render=renderer.render;
    (window as any).__drawSamples=[];
    renderer.render=function(scene:any,camera:any){
      const sample:Record<string,{alpha:number;transparent:boolean}[]>={};
      scene.traverseVisible((mesh:any)=>{
        if(!mesh.isMesh)return;const id=layerById[mesh.name]?mesh.name:mesh.parent?.name;
        if(!layerById[id])return;
        (sample[id]??=[]).push({alpha:mesh.material.opacity,transparent:mesh.material.transparent});
      });
      (window as any).__drawSamples.push(sample);
      return render.call(this,scene,camera);
    };
  },{url,layerById});
}
const take=(page:Page)=>page.evaluate(()=>(window as any).__drawSamples.splice(0) as Record<string,{alpha:number;transparent:boolean}[]>[]);

test('new male bone, vessel, lymph and nerve meshes use their peel opacity on their first draw',async({page})=>{
  test.setTimeout(180000);await observe(page);
  const samples=[
    {depth:'34.5',layer:'bone',prefix:'',count:278,alpha:.05},
    {depth:'68.5',layer:'vessel',prefix:'ZA_',count:640,alpha:.05},
    {depth:'80.5',layer:'lymph',prefix:'ZA_',count:142,alpha:.0625},
    {depth:'88.5',layer:'nerve',prefix:'ZA_',count:525,alpha:.05},
  ];
  for(const sample of samples) {
    await take(page);
    await page.getByLabel('연속 해부 박리 깊이').fill(sample.depth);await ready(page);
    await expect.poll(async()=>{
      return page.evaluate(({layer,prefix,layerById})=>(window as any).__drawSamples.some((f:any)=>Object.keys(f).some(id=>layerById[id]===layer&&id.startsWith(prefix))),{...sample,layerById});
    }).toBe(true);
    const frames=await take(page),ids=new Set<string>();
    for(const frame of frames)for(const [id,materials] of Object.entries(frame)) {
      if(layerById[id]!==sample.layer||!id.startsWith(sample.prefix)||ids.has(id))continue;
      ids.add(id);
      for(const material of materials) {expect(material.alpha,`${id} first frame`).toBeCloseTo(sample.alpha,12);expect(material.transparent).toBe(true);}
    }
    expect(ids.size).toBe(sample.count);
  }
});

test('female and independent CT source mounts never draw the default all-visible packed scene',async({page})=>{
  test.setTimeout(180000);await observe(page);
  for(const step of ['female','ct','return','ct','return']) {
    await take(page);
    if(step==='female')await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();
    else if(step==='ct')await page.locator('.featured-anatomy > button').filter({has:page.getByText('위 (여성 CT)',{exact:true})}).click();
    else await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();
    await ready(page);
    const expected=step==='ct'?['CTF_stomach']:catalog.filter(s=>s.sex==='female'&&s.model==='HRA female whole-body atlas'&&s.layer===(step==='female'?'skin':'organ')&&!s.hierarchy.includes('pregnancy')).map(s=>s.id).sort();
    const isTarget=(id:string)=>step==='ct'?id.startsWith('CTF_'):/^(HRAF|BM|VHF)/.test(id);
    await expect.poll(async()=>(await page.evaluate(()=>(window as any).__drawSamples as Record<string,unknown>[])).some(f=>Object.keys(f).some(isTarget))).toBe(true);
    const relevant=(await take(page)).map(f=>Object.keys(f).filter(isTarget).sort()).filter(ids=>ids.length);
    for(const ids of relevant)expect(ids,`${step} every target-source frame`).toEqual(expected);
  }
  await page.screenshot({path:'docs/anatomy-alignment/first-frame-female-return-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'계통 전체 보기',exact:true}).click();
  await page.screenshot({path:'docs/anatomy-alignment/first-frame-female-return-mobile.png'});
});

test('cancelled female and CT downloads cannot expose a late source after switching back',async({page})=>{
  test.setTimeout(120000);await observe(page);
  for(const source of ['female','female-detail']) {
    let release=()=>{},finished=()=>{},requested=false;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const done=new Promise<void>(resolve=>{finished=resolve;});
    const pattern=`**/models/${source}/*.bin.gz`;
    let held=false;
    await page.route(pattern,async route=>{
      if(held){await route.continue();return;}
      held=true;requested=true;
      try {await gate;await route.continue();} catch { /* The source request was deliberately aborted. */ }
      finally {finished();}
    });
    try {
      await take(page);
      if(source==='female')await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();
      else await page.locator('.featured-anatomy > button').filter({has:page.getByText('위 (여성 CT)',{exact:true})}).click();
      await expect.poll(()=>requested).toBe(true);
      await expect(page.getByText('해부 모델 로드 완료')).not.toBeVisible();
      if(source==='female')await page.locator('.explore-sidebar').getByRole('button',{name:'남성',exact:true}).click();
      else await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();
      release();await done;await ready(page);
      const forbidden=source==='female'?/^(HRAF|BM|VHF)/:/^CTF_/;
      for(const frame of await take(page))expect(Object.keys(frame).filter(id=>forbidden.test(id))).toEqual([]);
    } finally {release();await page.unroute(pattern);}
    if(source==='female') {await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);}
  }
});
