import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import {ready,snapshot,openSearch,choosePoint} from './helpers';

// "성기 가리기" is on by default: the external genitals and the vessels and
// nerve that follow them are left out of every system, the male skin is
// drawn closed over the groin, and only the shield, the display settings, a
// chosen structure or its organ detail show them.
const visible=async(page:Page)=>new Set(((await page.locator('canvas').getAttribute('data-visible-structure-ids'))||'').split(','));
const setView=async(page:Page,patch:Record<string,unknown>)=>{
  await page.evaluate(patch=>{const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2')!);sessionStorage.setItem('gyeol-view-v2',JSON.stringify({...s,...patch}));},patch);
  await page.reload();await ready(page);
};
const MALE_GENITAL=['FMA19618','FMA18247','FMA19617nsn','FMA7211','FMA7212','FMA18256','FMA19235','FMA19667'];
const MALE_COURSE=['ZA_vessel_external_pudendal_veins_l','ZA_vessel_superficial_external_pudendal_artery_r','ZA_vessel_dorsal_artery_of_penis_l','ZA_vessel_left_testicular_vein'];
const GROIN={target:[0,.76,.02],position:[.15,.82,.55]};

test('the genitals start hidden in every system and the shield or the settings show them',async({page})=>{
  test.setTimeout(300000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  const toggle=page.locator('.ax-top').getByRole('button',{name:'성기 가리기'}),canvas=page.locator('canvas');
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(toggle).toHaveAttribute('data-tip','성기 보이기');
  await expect(canvas).toHaveAttribute('data-modesty','hidden');
  await expect(canvas).toHaveAttribute('data-modesty-skin','true');
  expect((await snapshot(page)).modesty).toBe(true);
  // Every depth: skin closed while it is drawn (also while it fades), nothing genital beneath.
  for(const dissection of [0,12,30,72,86]){
    await setView(page,{dissection,camera:GROIN,markers:'hidden'});
    const ids=await visible(page);
    for(const id of [...MALE_GENITAL,...MALE_COURSE])expect(ids.has(id),`${dissection}% ${id}`).toBe(false);
    if(dissection<20)await expect(canvas).toHaveAttribute('data-modesty-skin','true');
    if(dissection===0||dissection===12)await page.screenshot({path:`docs/anatomy-alignment/modesty-male-${dissection}-desktop.png`});
  }
  // The front cut-away cannot open the skin onto the genitals either.
  await setView(page,{dissection:0,cutaway:.35});
  await expect(canvas).toHaveAttribute('data-modesty-skin','true');
  await page.screenshot({path:'docs/anatomy-alignment/modesty-male-cutaway-desktop.png'});
  // The prostate and the internal pudendal vessels stay.
  await setView(page,{dissection:72,cutaway:0});
  let ids=await visible(page);expect(ids.has('FMA9600')).toBe(true);
  // The shield shows them; the choice survives a reload and a change of body.
  await toggle.focus();await page.keyboard.press('Enter');await ready(page);
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect(toggle).toHaveAttribute('data-tip','성기 가리기');
  ids=await visible(page);for(const id of MALE_GENITAL)expect(ids.has(id),id).toBe(true);
  await setView(page,{dissection:0});
  await expect(canvas).toHaveAttribute('data-modesty','shown');
  await expect(canvas).toHaveAttribute('data-modesty-skin','false');
  expect((await snapshot(page)).modesty).toBe(false);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await setView(page,{dissection:80});
  ids=await visible(page);expect(ids.has('HRAF0406')).toBe(true);
  // The display settings hold the same preference; the female skin needs no closing.
  await page.getByRole('button',{name:'표시 설정',exact:true}).click();
  const box=page.getByRole('checkbox',{name:'성기 가리기'});await expect(box).not.toBeChecked();
  await box.check();await expect(toggle).toHaveAttribute('aria-pressed','true');await ready(page);
  ids=await visible(page);expect(ids.has('HRAF0406')).toBe(false);expect(ids.has('HRAF0435')).toBe(true);
  await setView(page,{dissection:0});
  await expect(canvas).toHaveAttribute('data-modesty-skin','false');
  await page.screenshot({path:'docs/anatomy-alignment/modesty-female-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await expect(toggle).toBeInViewport();
  expect(errors).toEqual([]);
});

test('a chosen genital structure and the reproductive detail are shown while hidden',async({page})=>{
  test.setTimeout(240000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  const input=await openSearch(page);
  await input.fill('FMA7211');
  await page.locator('.structure-item').filter({hasText:'FMA7211'}).first().click();await ready(page);
  let ids=await visible(page);expect(ids.has('FMA7211')).toBe(true);expect(ids.has('FMA7212')).toBe(false);
  await expect(page.locator('canvas')).toHaveAttribute('data-modesty','hidden');
  // The organ detail that holds them shows all of them, also after a part is picked in the scene.
  await page.evaluate(async()=>{
    const {structureGroups}=await import('/src/anatomy.ts');
    const g=structureGroups.find((x:any)=>x.id==='male-reproductive'&&x.sex==='male')!;
    const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2')!);
    const layers=Object.fromEntries(['skin','muscle','bone','organ','vessel','lymph','nerve'].map(l=>[l,l==='organ']));
    sessionStorage.setItem('gyeol-view-v2',JSON.stringify({...s,detail:{id:g.id,name:g.name,ids:g.ids,layers},selection:{kind:'structure',ids:['FMA9600'],name:'전립샘',layers:['organ']},layers,displayMode:'layers',isolated:false,detailReturn:null,selectionReturn:null}));
  });
  await page.reload();await ready(page);
  ids=await visible(page);
  for(const id of ['FMA7211','FMA7212','FMA18247','FMA19618','FMA9600'])expect(ids.has(id),id).toBe(true);
  expect(errors).toEqual([]);
});

// The groin markers the closed skin carries forward: drawn there and named on
// their card while hidden, back on the thigh once shown.
const moved=JSON.parse(fs.readFileSync('data/modesty-male-skin.json','utf8')).anchors.filter((a:any)=>a.key.startsWith('LR10-'));
const source=JSON.parse(fs.readFileSync('data/anchors.json','utf8')).filter((a:any)=>a.key.startsWith('LR10-'));
const drawnMarkers=(page:Page,url:string)=>page.evaluate(async url=>{
  const {_roots}=await import(/* @vite-ignore */url),s=_roots.get(document.querySelector('canvas')!).store.getState();
  let mesh:any;s.scene.traverse((o:any)=>{if(o.isInstancedMesh&&o.userData.acupointMarkers)mesh=o;});
  const out:number[][]=[];if(!mesh)return out;const m=s.camera.matrixWorld.clone(),v=s.camera.position.clone();
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);if(!m.elements[0])continue;v.setFromMatrixPosition(m);mesh.localToWorld(v);out.push([v.x,v.y,v.z]);}
  return out;
},url);
const drawnAt=(drawn:number[][],anchors:any[])=>anchors.every(a=>drawn.some(p=>Math.hypot(p[0]-a.position[0],p[1]-a.position[1],p[2]-a.position[2])<.002));

test('the groin markers the closure carries forward are drawn on it and say so on their card',async({page})=>{
  test.setTimeout(240000);let fiberUrl='';const errors:string[]=[];
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  expect(moved.length).toBe(2);
  await choosePoint(page,'LR10');await ready(page);
  if(await page.locator('.point-summary').getAttribute('aria-expanded')!=='true')await page.locator('.point-summary').click();
  const note=page.locator('[data-modesty-marker-note]');
  await expect(note).toContainText('편집 표시 면');
  expect(drawnAt(await drawnMarkers(page,fiberUrl),moved)).toBe(true);
  await page.screenshot({path:'docs/anatomy-alignment/modesty-marker-desktop.png'});
  await page.locator('.ax-top').getByRole('button',{name:'성기 가리기'}).click();await ready(page);
  await expect(note).toHaveCount(0);
  expect(drawnAt(await drawnMarkers(page,fiberUrl),source)).toBe(true);
  expect(errors).toEqual([]);
});
