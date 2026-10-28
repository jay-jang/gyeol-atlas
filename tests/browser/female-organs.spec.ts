import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import {ready,snapshot,openSearch,closeTool} from './helpers';

const display=JSON.parse(fs.readFileSync('data/female-organ-display.json','utf8'));
const groups=JSON.parse(fs.readFileSync('data/reproductive-groups.json','utf8'));
const group=(id:string)=>groups.find((g:any)=>g.id===id);
const visibleIds=async(page:Page)=>(await page.locator('canvas').getAttribute('data-visible-structure-ids')||'').split(',').filter(Boolean);
// Pixels a set of meshes wins in the rendered frame (render with and without
// them), against the area they cover when drawn alone, from a set camera.
const winning=(page:Page,url:string,ids:string[],target:number[],offset:number[])=>page.evaluate(async({url,ids,target,offset})=>{
  const {_roots}=await import(/* @vite-ignore */url),s=_roots.get(document.querySelector('canvas')).store.getState();
  const {gl,scene,camera,controls}=s,ctx=gl.getContext(),w=ctx.drawingBufferWidth,h=ctx.drawingBufferHeight;
  const savedPosition=camera.position.clone(),savedTarget=controls.target.clone();
  controls.target.set(target[0],target[1],target[2]);camera.position.set(target[0]+offset[0],target[1]+offset[1],target[2]+offset[2]);camera.lookAt(target[0],target[1],target[2]);controls.update();camera.updateMatrixWorld();
  const draw=()=>{gl.setRenderTarget(null);gl.render(scene,camera);const b=new Uint8Array(w*h*4);ctx.readPixels(0,0,w,h,ctx.RGBA,ctx.UNSIGNED_BYTE,b);return b;};
  const meshes:any[]=[];scene.traverse((o:any)=>{if(o.isMesh)meshes.push(o);});
  const shown=(o:any)=>{for(let q=o;q;q=q.parent)if(!q.visible)return false;return true;};
  const on=meshes.filter(o=>ids.includes(o.name)&&shown(o));
  const base=draw();on.forEach(o=>{o.visible=false;});const hidden=draw();on.forEach(o=>{o.visible=true;});
  const others=meshes.filter(o=>!on.includes(o)&&o.visible);others.forEach(o=>{o.visible=false;});const solo=draw();others.forEach(o=>{o.visible=true;});
  const differ=(a:Uint8Array,b:Uint8Array,i:number)=>Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>6;
  let won=0;for(let i=0;i<base.length;i+=4)if(differ(base,hidden,i))won++;
  // Drawn alone, the meshes cover every pixel that is not the stage background.
  let area=0;const bg=solo.slice(0,4);for(let i=0;i<solo.length;i+=4)if(Math.abs(solo[i]-bg[0])+Math.abs(solo[i+1]-bg[1])+Math.abs(solo[i+2]-bg[2])>6)area++;
  camera.position.copy(savedPosition);controls.target.copy(savedTarget);controls.update();camera.updateMatrixWorld();gl.render(scene,camera);
  return {drawn:on.length,won,area,colors:[...new Set(on.map(o=>'#'+o.material.color.getHexString()))]};
},{url,ids,target,offset});

test('female-specific organs show in the peel and in 장기만 보기, in their own colours',async({page})=>{
  test.setTimeout(240000);let fiberUrl='';const errors:string[]=[];
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  const depth=page.getByLabel('연속 해부 박리 깊이'),canvas=page.locator('canvas');
  // The glandular breast stays once the skin and its fat are peeled.
  await depth.fill('30');await ready(page);
  let ids=await visibleIds(page);
  for(const id of display.glandularBreast.ids)expect(ids,id).toContain(id);
  expect(ids).not.toContain('HRAF0004');
  const chest=await winning(page,fiberUrl,display.glandularBreast.ids,[0,1.21,.03],[0,0,.9]);
  expect(chest.won/chest.area).toBeGreaterThan(.9);
  // At 76% every organ is opaque and the bowel covers the pelvis; from 79%
  // the bowel and the peritoneal folds are peeled and the uterus shows.
  await depth.fill('76');await ready(page);
  const covered=await winning(page,fiberUrl,['HRAF0434','HRAF0435','HRAF0436','HRAF0437','HRAF0438','HRAF0439','HRAF0440','HRAF0441','HRAF0442','HRAF0443'],[-.006,.83,-.06],[0,0,.9]);
  expect(covered.won).toBeLessThan(covered.area*.05);
  await depth.fill('79');await ready(page);
  ids=await visibleIds(page);
  // The vagina is left out with the genitals by default (성기 가리기).
  for(const id of [...display.reproductiveTone.ids,'HRAF0609'].filter(id=>id!=='HRAF0406'))expect(ids,id).toContain(id);
  expect(ids).not.toContain('HRAF0406');
  for(const id of [...display.gutFirst.ids,...display.peritonealFolds.ids])expect(ids,id).not.toContain(id);
  const uterus=await winning(page,fiberUrl,['HRAF0434','HRAF0435','HRAF0436','HRAF0437','HRAF0438','HRAF0439','HRAF0440','HRAF0441','HRAF0442','HRAF0443'],[-.006,.83,-.06],[0,0,.9]);
  expect(uterus.won/uterus.area).toBeGreaterThan(.5);
  expect(uterus.colors).toEqual(['#9b6bc0']);
  await expect(canvas).toHaveAttribute('data-model-sex','female');
  await page.screenshot({path:'docs/anatomy-alignment/female-organs-peel-79.png'});
  // 장기만 보기 keeps the glandular breast with the organs.
  await page.getByRole('button',{name:'장기만 보기',exact:true}).first().click();await ready(page);
  ids=await visibleIds(page);
  for(const id of display.glandularBreast.ids)expect(ids,id).toContain(id);
  const bowel=await winning(page,fiberUrl,['HRAF0518'],[0,1.0,.05],[0,0,.9]);
  expect(bowel.colors).toEqual(['#c47a68']);
  await page.screenshot({path:'docs/anatomy-alignment/female-organs-organ-only.png'});
  expect(errors).toEqual([]);
});

test('female reproductive and breast views are found by common terms and return to the body',async({page})=>{
  test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await page.getByLabel('연속 해부 박리 깊이').fill('40');await ready(page);
  const input=await openSearch(page);
  await input.fill('나팔관');
  await expect(page.locator('.featured-anatomy > button').first()).toContainText('자궁관');
  await input.fill('생식기관');
  await page.locator('.featured-anatomy > button').filter({hasText:'여성 생식기관'}).click();await ready(page);
  expect((await snapshot(page)).detail.ids.sort()).toEqual([...group('female-reproductive').ids].sort());
  const card=page.locator('.selection-card');
  await expect(card).toContainText('생식기관 보기·출처 한계');
  await page.screenshot({path:'docs/anatomy-alignment/female-organs-reproductive-detail.png'});
  await card.getByRole('button',{name:'복막 포함 보기',exact:true}).click();await ready(page);
  expect((await snapshot(page)).detail.ids.length).toBe(38);
  await card.getByRole('button',{name:'여성 생식기관 함께 보기',exact:true}).click();await ready(page);
  expect((await snapshot(page)).detail.ids.length).toBe(32);
  await card.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready(page);
  let s=await snapshot(page);
  expect(s.detail).toBeNull();expect(s.dissection).toBe(40);expect(s.displayMode).toBe('dissection');
  // 유선 opens the breast; its glandular view uncovers the lobes and ducts.
  await (await openSearch(page)).fill('유선');
  await page.locator('.featured-anatomy > button').filter({hasText:'유방'}).first().click();await ready(page);
  expect((await snapshot(page)).detail.id).toBe('breast');
  await card.getByRole('button',{name:'젖샘엽·젖샘관 보기',exact:true}).click();await ready(page);
  s=await snapshot(page);
  expect(s.detail.id).toBe('breast-gland');
  expect(s.detail.ids.sort()).toEqual([...display.glandularBreast.ids].sort());
  expect(s.detail.layers.organ).toBe(true);
  for(const id of display.glandularBreast.ids)expect(await visibleIds(page),id).toContain(id);
  await page.screenshot({path:'docs/anatomy-alignment/female-organs-breast-gland.png'});
  await page.setViewportSize({width:390,height:844});await ready(page);
  await page.screenshot({path:'docs/anatomy-alignment/female-organs-breast-gland-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await card.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready(page);
  // Older terms find single parts too, with the English source name and ID.
  await (await openSearch(page)).fill('유두');
  const rows=page.locator('.structure-item');
  await expect(rows.first()).toContainText('젖꼭지');
  await expect(rows.first()).toContainText('Nipple');
  await closeTool(page);
  expect(errors).toEqual([]);
});

test('the male reproductive organs are one featured detail in the reproductive colour',async({page})=>{
  test.setTimeout(180000);let fiberUrl='';const errors:string[]=[];
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await ready(page);
  await (await openSearch(page)).fill('생식기관');
  await page.locator('.featured-anatomy > button').filter({hasText:'남성 생식기관'}).click();await ready(page);
  const s=await snapshot(page);
  expect(s.detail.ids.sort()).toEqual([...group('male-reproductive').ids].sort());
  const colors=await page.evaluate(async({url,ids})=>{
    const {_roots}=await import(/* @vite-ignore */url),scene=_roots.get(document.querySelector('canvas')).store.getState().scene;
    const out:string[]=[];scene.traverse((o:any)=>{if(o.isMesh&&ids.includes(o.name)&&o.visible)out.push('#'+o.material.color.getHexString());});
    return [...new Set(out)];
  },{url:fiberUrl,ids:['FMA7211','FMA7212','FMA9600']});
  expect(colors).toEqual(['#9b6bc0']);
  await page.locator('.selection-card').getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready(page);
  // In the overview the genitals are hidden by default; shown, they keep the colour.
  await page.getByLabel('연속 해부 박리 깊이').fill('30');await ready(page);
  const testis=async()=>page.evaluate(async({url})=>{
    const {_roots}=await import(/* @vite-ignore */url),scene=_roots.get(document.querySelector('canvas')).store.getState().scene;
    const testis=scene.getObjectByName('FMA7211');let mesh:any=testis?.isMesh?testis:null;testis?.traverse((o:any)=>{if(!mesh&&o.isMesh)mesh=o;});
    return mesh?{visible:mesh.visible,color:'#'+mesh.material.color.getHexString()}:null;
  },{url:fiberUrl});
  expect((await testis())?.visible).toBe(false);
  await page.locator('.ax-top').getByRole('button',{name:'성기 가리기'}).click();await ready(page);
  expect(await testis()).toEqual({visible:true,color:'#9b6bc0'});
  expect(errors).toEqual([]);
});

test.describe('on a touch phone',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  test('the reproductive views switch and return with 44 px targets and the card on screen',async({page})=>{
    test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');await ready(page);
    await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).tap();await ready(page);
    const input=page.getByLabel('경혈·구조 검색');await input.tap();await input.fill('생식기관');
    await page.locator('.featured-anatomy > button').filter({hasText:'여성 생식기관'}).tap();await ready(page);
    const card=page.locator('.selection-card');
    const check=async()=>{
      const boxes=await card.locator('.selection-actions button').evaluateAll(els=>els.filter(el=>(el as HTMLElement).offsetParent).map(el=>{const r=el.getBoundingClientRect();return {h:r.height,w:r.width,bottom:r.bottom,text:el.textContent};}));
      expect(boxes.length).toBeGreaterThan(3);
      for(const b of boxes){expect(b.h,b.text||'').toBeGreaterThanOrEqual(44);expect(b.bottom,b.text||'').toBeLessThanOrEqual(844);}
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    };
    await check();
    await page.screenshot({path:'docs/anatomy-alignment/female-organs-reproductive-touch.png'});
    await card.getByRole('button',{name:'복막 포함 보기',exact:true}).tap();await ready(page);
    expect((await snapshot(page)).detail.ids.length).toBe(38);
    await check();
    await card.locator('summary').filter({hasText:'생식기관 보기·출처 한계'}).tap();
    await expect(card.locator('[data-reproductive-provenance] p')).toBeVisible();
    await card.getByRole('button',{name:'전신으로 돌아가기',exact:true}).tap();await ready(page);
    expect((await snapshot(page)).detail).toBeNull();
    expect(errors).toEqual([]);
  });
});
