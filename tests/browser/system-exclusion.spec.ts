import {test,expect,type Page,type Locator} from '@playwright/test';
import fs from 'node:fs';
import {ready,snapshot,openTool,closeTool,settledCamera} from './helpers';

// "계통 빼기" (Q42): systems left out of the progressive peel are not drawn at
// any depth, the peel stops before the innermost included system goes, and
// explicit views (one system, layer combinations) still open what they need.
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
// The system of each catalogued mesh, read as first-frame.spec.ts does:
// ligaments belong to the skeleton and supplement tendons to the muscles.
const catalog=[...read('scripts/model-inputs.json').assets,...read('data/full-system-structures.json'),...read('data/connective-structures.json'),...read('data/sex-lymph-structures.json'),...read('data/female-atlas-structures.json'),...read('data/female-detail-structures.json')];
const layerById:Record<string,string>=Object.fromEntries(catalog.map((s:{id:string;layer:string})=>[s.id,s.layer]));
const order=['skin','muscle','bone','organ','vessel','lymph','nerve'] as const;
type System=typeof order[number];
const names:Record<System,string>={skin:'체표',muscle:'근육',bone:'골격',organ:'장기',vessel:'혈관',lymph:'림프',nerve:'신경'};
const shots='docs/system-exclusion';
// Scene tools the exclusion picker must leave clear (Q25).
const SCENE_TOOLS=['.ax-search','.ax-top-actions','.ax-point-chip','.ax-point-bar','.ax-status .scene-status','.ax-status .ax-source','.movement-pad','.view-tools','.view-presets','.ax-inspector .selection-card'];
const only=(...on:System[])=>Object.fromEntries(order.map(l=>[l,on.includes(l)]));

// Loads the atlas and keeps the react-three-fiber module URL for scene reads.
async function open(page:Page){
  const run={url:'',errors:[] as string[]};
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))run.url=r.url();});
  page.on('pageerror',e=>run.errors.push(e.message));
  await page.goto('/');await ready(page);
  expect(run.url).not.toBe('');
  return run;
}
// Meshes actually drawn, per system: visible through their whole parent chain
// and not faded out. (The canvas data-visible-* counters only update while a
// layer is mounted, so they cannot show a system that was taken away.)
const drawn=(page:Page,url:string)=>page.evaluate(async({url,layerById})=>{
  const {_roots}=await import(/* @vite-ignore */url),{scene}=_roots.get(document.querySelector('canvas')).store.getState();
  const counts:Record<string,number>={skin:0,muscle:0,bone:0,organ:0,vessel:0,lymph:0,nerve:0};
  scene.traverseVisible((o:any)=>{
    if(!o.isMesh||o.isInstancedMesh)return;
    const layer=o.userData.layer??o.userData.entry?.layer??layerById[o.name]??layerById[o.parent?.name];
    if(!layer||!(layer in counts))return;
    const materials=Array.isArray(o.material)?o.material:[o.material];
    if(materials.some((m:any)=>m.visible!==false&&m.opacity>=.01))counts[layer]++;
  });
  return counts as Record<System,number>;
},{url,layerById});
// Ids (and source names) of the drawn meshes of one system.
const drawnNames=(page:Page,url:string,system:System)=>page.evaluate(async({url,layerById,system})=>{
  const {_roots}=await import(/* @vite-ignore */url),{scene}=_roots.get(document.querySelector('canvas')).store.getState();
  const found:string[]=[];
  scene.traverseVisible((o:any)=>{
    if(!o.isMesh||o.isInstancedMesh)return;
    const layer=o.userData.layer??o.userData.entry?.layer??layerById[o.name]??layerById[o.parent?.name];
    const materials=Array.isArray(o.material)?o.material:[o.material];
    if(layer===system&&materials.some((m:any)=>m.visible!==false&&m.opacity>=.01))found.push(o.userData.entry?.name||(layerById[o.name]?o.name:o.parent?.name));
  });
  return found;
},{url,layerById,system});
// Drawn meshes of one system that do not wear the skin or sclera surface tone:
// while the skin covers the body, a left-out system may keep only toned parts.
const drawnUntoned=(page:Page,url:string,system:System)=>page.evaluate(async({url,layerById,system})=>{
  const {_roots}=await import(/* @vite-ignore */url),{scene}=_roots.get(document.querySelector('canvas')).store.getState();
  const found:string[]=[];
  scene.traverseVisible((o:any)=>{
    if(!o.isMesh||o.isInstancedMesh)return;
    const layer=o.userData.layer??o.userData.entry?.layer??layerById[o.name]??layerById[o.parent?.name];
    const materials=Array.isArray(o.material)?o.material:[o.material];
    if(layer!==system||!materials.some((m:any)=>m.visible!==false&&m.opacity>=.01))return;
    if(!materials.every((m:any)=>['b9826f','e2dbcf'].includes(m.color.getHexString())))found.push(o.name);
  });
  return found;
},{url,layerById,system});
// The BodyParts3D ears, lips, eyes and nasal cartilages are the male face's surface.
const SURFACE_ORGANS=['FMA52780','FMA59815nsn','FMA12513','FMA71704'];
const EYE_PART=/^(Cornea|Sclera|Iris|Lens|Retina|Vitreous body|Anterior chamber of eyeball|Suspensory ligament of eyeball|Anterior segment of eyeball|Posterior segment of eyeball) \((left|right)\)$/;
// Waits until exactly these systems have drawn meshes, then returns the counts.
async function expectDrawn(page:Page,url:string,present:System[]){
  await expect.poll(async()=>{const counts=await drawn(page,url);return order.filter(l=>counts[l]>0);},{timeout:20000}).toEqual(present);
  return drawn(page,url);
}
const sameCamera=(after:any,before:any)=>{
  for(const key of ['position','target'])for(let i=0;i<3;i++)expect(Math.abs(after.camera[key][i]-before.camera[key][i]),`camera ${key}[${i}]`).toBeLessThan(1e-9);
};
const preferences=(s:any)=>({markers:s.markers,labels:s.labels,connective:s.connective,modesty:s.modesty,alpha:s.alpha,anatomyRegion:s.anatomyRegion});
const excludedOf=async(page:Page)=>(await snapshot(page)).excluded;
// Font size and contrast of visible text against the first opaque surface behind it (Q14).
const textMetrics=(locator:Locator)=>locator.evaluateAll(elements=>elements.filter(el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden').map(el=>{
  const s=getComputedStyle(el);let node:Element|null=el,background='rgb(0, 0, 0)';
  while(node){const b=getComputedStyle(node).backgroundColor;const a=b.match(/[\d.]+/g)!.map(Number);if(a.length<4||a[3]>.5){background=b;break;}node=node.parentElement;}
  const lum=(c:string)=>c.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const fg=lum(s.color),bg=lum(background);
  return {text:(el.textContent||'').trim(),font:parseFloat(s.fontSize),contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};
}));
async function expectReadable(locator:Locator){
  const metrics=await textMetrics(locator);
  expect(metrics.length).toBeGreaterThan(0);
  for(const m of metrics){expect(m.font,`${m.text} font`).toBeGreaterThanOrEqual(12);expect(m.contrast,`${m.text} contrast`).toBeGreaterThanOrEqual(4.5);}
}
const boxes=(locator:Locator)=>locator.evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {text:(el.textContent||'').trim(),x:r.x,y:r.y,w:r.width,h:r.height};}));
type Box={text:string;x:number;y:number;w:number;h:number};
const overlaps=(a:Box,b:Box)=>a.x<b.x+b.w-.5&&b.x<a.x+a.w-.5&&a.y<b.y+b.h-.5&&b.y<a.y+a.h-.5;
function expectApart(list:Box[]){for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)expect(overlaps(list[i],list[j]),`${list[i].text} overlaps ${list[j].text}`).toBe(false);}
function expectInside(inner:Box,outer:{x:number;y:number;w:number;h:number},what:string){
  expect(inner.x,`${what} left`).toBeGreaterThanOrEqual(outer.x-.5);expect(inner.y,`${what} top`).toBeGreaterThanOrEqual(outer.y-.5);
  expect(inner.x+inner.w,`${what} right`).toBeLessThanOrEqual(outer.x+outer.w+.5);expect(inner.y+inner.h,`${what} bottom`).toBeLessThanOrEqual(outer.y+outer.h+.5);
}

function rail(page:Page){
  const nav=page.getByRole('navigation',{name:'인체 깊이 탐색',exact:true});
  return {
    nav,
    toggle:nav.getByRole('button',{name:/^계통 빼기/}),
    include:(l:System)=>nav.getByRole('checkbox',{name:`${names[l]} 포함`,exact:true}),
    stop:(l:System)=>nav.getByRole('button',{name:`${names[l]}까지 박리`,exact:true}),
    leftStop:(l:System)=>nav.getByRole('button',{name:`${names[l]}까지 박리 — 뺀 계통`,exact:true}),
    eye:(l:System)=>nav.getByRole('button',{name:`${names[l]} 빠른 보기`,exact:true}),
    stage:nav.locator('.depth-heading strong small'),
    summary:nav.locator('.depth-excluded'),
    // The summary's lines: the left-out names, then where the peel stops.
    summaryLines:nav.locator('.depth-excluded > span'),
    picker:nav.locator('.exclude-picker'),
    done:nav.getByRole('button',{name:'완료',exact:true}),
    slider:page.getByLabel('연속 해부 박리 깊이',{exact:true}),
  };
}

test.describe('desktop 1440×900, male',()=>{
  test.use({viewport:{width:1440,height:900}});

  test('a) leaving bone and organs out keeps the view and draws muscles with or without organs',async({page})=>{
    test.setTimeout(180000);
    const run=await open(page),r=rail(page);
    await settledCamera(page);
    const before=await snapshot(page);
    expect(before.excluded).toEqual([]);
    const all=await expectDrawn(page,run.url,[...order]);
    // An aria-label keeps the CSS tooltip text out of the name.
    await expect(r.toggle).toHaveAccessibleName('계통 빼기');
    await r.toggle.click();
    await expect(r.toggle).toHaveAttribute('aria-pressed','true');
    await expect(r.nav).toHaveAttribute('data-excluding','true');
    await expect(r.toggle).toHaveAttribute('aria-controls',await r.picker.getAttribute('id') as string);
    // The stops stay on the rail; the checks open beside it.
    await expect(r.nav.locator('.ax-stop')).toHaveCount(7);
    for(const l of order)await expect(r.include(l)).toBeChecked();
    await r.include('organ').uncheck();
    await r.include('bone').uncheck();
    await expect.poll(()=>excludedOf(page)).toEqual(['bone','organ']);
    let s=await snapshot(page);
    expect(s.displayMode).toBe('dissection');expect(s.dissection).toBe(0);
    expect(s.layers).toEqual(only('skin','muscle','vessel','lymph','nerve'));
    sameCamera(s,before);expect(preferences(s)).toEqual(preferences(before));
    // Nothing of either system is drawn behind the skin; the muscles are. The
    // face keeps its BodyParts3D ears, lips and eyes as skin, and no second
    // (nerve-coloured) Z-Anatomy eye shows through.
    let counts=await expectDrawn(page,run.url,['skin','muscle','organ','vessel','lymph','nerve']);
    expect(counts.muscle).toBe(all.muscle);
    const surface=await drawnNames(page,run.url,'organ');
    expect(surface.length).toBeGreaterThan(0);
    for(const id of surface)expect(SURFACE_ORGANS,id).toContain(id);
    expect((await drawnNames(page,run.url,'nerve')).filter(n=>EYE_PART.test(n))).toEqual([]);
    // The rail's include checks sit apart from each other (Q25).
    expectApart(await boxes(r.nav.locator('.ax-include')));
    await r.toggle.click();
    await expect(r.toggle).toHaveAttribute('aria-pressed','false');
    await expect(r.toggle).toHaveAccessibleName('계통 빼기 · 2개 뺌');
    await expect(r.summary).toHaveText('골격·장기 뺌');
    for(const l of ['bone','organ'] as const){
      await expect(r.leftStop(l)).toHaveAttribute('aria-disabled','true');
      await expect(r.nav.locator('li.excluded').filter({has:page.getByRole('button',{name:`${names[l]}까지 박리 — 뺀 계통`,exact:true})})).toHaveCount(1);
      // A left-out system keeps a hollow swatch.
      expect(await r.leftStop(l).locator('.layer-dot').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    }
    await r.slider.fill('44');
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(44);
    s=await snapshot(page);
    expect(s.excluded).toEqual(['bone','organ']);expect(s.displayMode).toBe('dissection');
    expect(s.layers).toEqual(only('muscle','vessel','lymph','nerve'));
    sameCamera(s,before);expect(preferences(s)).toEqual(preferences(before));
    await expect(r.stage).toHaveText('근육');
    const without=await expectDrawn(page,run.url,['muscle','vessel','lymph','nerve']);
    // Off the rail, so the last click's hover tip does not cover the scene.
    await page.mouse.move(1300,450);await ready(page);
    await page.screenshot({path:`${shots}/desktop-excluded.png`});
    // The user's example: the same muscles with the organs put back.
    await r.toggle.click();
    await expect(r.include('organ')).not.toBeChecked();await expect(r.include('bone')).not.toBeChecked();
    // Off the rail, so the last click's hover tip does not cover the scene.
    await page.mouse.move(1300,450);await ready(page);
    await page.screenshot({path:`${shots}/desktop-edit.png`});
    await r.include('organ').check();
    await expect.poll(()=>excludedOf(page)).toEqual(['bone']);
    s=await snapshot(page);
    expect(s.dissection).toBe(44);expect(s.displayMode).toBe('dissection');
    expect(s.layers).toEqual(only('muscle','organ','vessel','lymph','nerve'));
    sameCamera(s,before);expect(preferences(s)).toEqual(preferences(before));
    counts=await expectDrawn(page,run.url,['muscle','organ','vessel','lymph','nerve']);
    expect(counts.muscle).toBe(without.muscle);expect(counts.bone).toBe(0);
    await expect(r.summary).toHaveText('골격 뺌');
    expect(run.errors).toEqual([]);
  });

  test('b) a left-out innermost system stops the peel before it and the last included system stays',async({page})=>{
    test.setTimeout(180000);
    const run=await open(page),r=rail(page);
    await r.toggle.click();await r.include('nerve').uncheck();
    await expect.poll(()=>excludedOf(page)).toEqual(['nerve']);
    await r.toggle.click();
    await expect(r.nav.locator('.ax-depth-track')).toHaveAttribute('style',/--limit: 90%/);
    await r.slider.fill('100');
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(90);
    await expect(r.slider).toHaveValue('90');
    await expect(r.stage).toHaveText('림프');
    await expect(r.slider).toHaveAttribute('aria-valuetext','90.0% 해부 깊이 · 림프 · 신경 뺌, 90%까지');
    expect((await snapshot(page)).layers).toEqual(only('lymph'));
    await expectDrawn(page,run.url,['lymph']);
    // Leave out everything but the lymphatics: that check cannot be cleared.
    await r.toggle.click();
    for(const l of ['skin','muscle','bone','organ','vessel'] as const)await r.include(l).uncheck();
    await expect.poll(()=>excludedOf(page)).toEqual(['skin','muscle','bone','organ','vessel','nerve']);
    await expect(r.include('lymph')).toBeChecked();await expect(r.include('lymph')).toBeDisabled();
    for(const l of ['skin','muscle','bone','organ','vessel','nerve'] as const)await expect(r.include(l)).toBeEnabled();
    await r.include('lymph').click({force:true});
    await expect(r.include('lymph')).toBeChecked();
    expect(await excludedOf(page)).toEqual(['skin','muscle','bone','organ','vessel','nerve']);
    expect((await snapshot(page)).dissection).toBe(90);
    await expectDrawn(page,run.url,['lymph']);
    // Muscles as the innermost system: the peel stops at 56%, where every body region keeps a muscle.
    await r.include('muscle').check();
    await expect(r.include('lymph')).toBeEnabled();
    await r.include('lymph').uncheck();
    await expect.poll(()=>excludedOf(page)).toEqual(['skin','bone','organ','vessel','lymph','nerve']);
    await expect(r.include('muscle')).toBeDisabled();
    let s=await snapshot(page);expect(s.dissection).toBe(56);expect(s.layers).toEqual(only('muscle'));
    await expect(r.stage).toHaveText('근육');
    const counts=await expectDrawn(page,run.url,['muscle']);expect(counts.muscle).toBeGreaterThan(0);
    await r.toggle.click();
    await r.slider.fill('100');await ready(page);
    s=await snapshot(page);expect(s.dissection).toBe(56);
    await expectDrawn(page,run.url,['muscle']);
    await expect(r.summaryLines).toHaveText(['6개 계통 뺌','56%까지']);
    expect(run.errors).toEqual([]);
  });

  test('c) a left-out stop is inert, its eye still shows it alone, and the peel entry returns with the exclusion',async({page})=>{
    test.setTimeout(180000);
    const run=await open(page),r=rail(page);
    await settledCamera(page);
    const start=await snapshot(page);
    await r.toggle.click();await r.include('organ').uncheck();await r.include('nerve').uncheck();await r.toggle.click();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ','nerve']);
    await ready(page);
    const before=await snapshot(page);
    // Keyboard focus shows the reason on the left-out stop (hover tips work on focus).
    await r.eye('bone').focus();await page.keyboard.press('Tab');
    await expect(r.leftStop('organ')).toBeFocused();
    await expect.poll(()=>r.leftStop('organ').evaluate(el=>getComputedStyle(el,'::after').opacity)).toBe('1');
    expect(await r.leftStop('organ').evaluate(el=>getComputedStyle(el,'::after').content)).toContain('장기 뺌');
    await page.keyboard.press('Enter');
    // Playwright will not click an aria-disabled control on its own; press it anyway.
    await r.leftStop('organ').click({force:true});
    await ready(page);
    expect(await snapshot(page)).toEqual(before);
    await expect(r.stop('organ')).toHaveCount(0);
    // The eye is an explicit view: it shows the left-out system on its own.
    await r.eye('organ').click();await ready(page);
    let s=await snapshot(page);
    expect(s.displayMode).toBe('layers');expect(s.layers).toEqual(only('organ'));expect(s.excluded).toEqual(['organ','nerve']);
    await expect(r.eye('organ')).toHaveAttribute('aria-pressed','true');
    await expect(r.nav.locator('.depth-mode')).toHaveText('장기만 보기');
    const organs=await expectDrawn(page,run.url,['organ']);expect(organs.organ).toBeGreaterThan(0);
    sameCamera(s,start);
    const entry=r.nav.getByRole('button',{name:'현재 기준 76.0%에서 연속 박리 시작',exact:true});
    await expect(entry).toHaveText('76.0%에서 연속 박리');
    await entry.click();await ready(page);
    s=await snapshot(page);
    expect(s.displayMode).toBe('dissection');expect(s.dissection).toBe(76);expect(s.excluded).toEqual(['organ','nerve']);
    expect(s.layers).toEqual(only('vessel','lymph'));
    await expect(r.stage).toHaveText('혈관');
    await expectDrawn(page,run.url,['vessel','lymph']);
    sameCamera(s,start);
    // Returning from a left-out system past the limit starts at the limit.
    await r.eye('nerve').click();await ready(page);
    s=await snapshot(page);expect(s.layers).toEqual(only('nerve'));expect(s.dissection).toBe(95);
    await expectDrawn(page,run.url,['nerve']);
    await expect(r.slider).toHaveAttribute('aria-valuetext','계통별 보기 중 · 박리 시작 기준 90.0% · 장기·신경 뺌, 90%까지');
    await r.nav.getByRole('button',{name:'현재 기준 90.0%에서 연속 박리 시작',exact:true}).click();await ready(page);
    s=await snapshot(page);
    expect(s.displayMode).toBe('dissection');expect(s.dissection).toBe(90);expect(s.excluded).toEqual(['organ','nerve']);
    expect(s.layers).toEqual(only('lymph'));
    await expect(r.stage).toHaveText('림프');
    await expectDrawn(page,run.url,['lymph']);
    sameCamera(s,start);expect(preferences(s)).toEqual(preferences(start));
    expect(run.errors).toEqual([]);
  });

  test('d) keyboard only: the mode, an include check and Alt+Arrow peeling stop at the limit',async({page})=>{
    test.setTimeout(150000);
    const run=await open(page),r=rail(page);
    await settledCamera(page);
    const before=await snapshot(page);
    await page.getByLabel('전신 부위 선택',{exact:true}).focus();
    for(let i=0;i<8&&!await r.toggle.evaluate(el=>el===document.activeElement);i++)await page.keyboard.press('Tab');
    await expect(r.toggle).toBeFocused();
    // Its explanation shows on keyboard focus, as on hover.
    await expect.poll(()=>r.toggle.evaluate(el=>getComputedStyle(el,'::after').opacity)).toBe('1');
    expect(await r.toggle.evaluate(el=>getComputedStyle(el,'::after').content)).toContain('체크를 끈 계통은 박리 깊이와 관계없이 빠집니다');
    await page.keyboard.press('Space');
    await expect(r.toggle).toHaveAttribute('aria-pressed','true');
    await expect(r.toggle).toBeFocused();
    const visited:string[]=[];
    for(let i=0;i<12;i++){
      await page.keyboard.press('Tab');
      const name=await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')||'');
      visited.push(name);if(name==='신경 포함')break;
    }
    // After the slider the checks follow the peel order.
    expect(visited.filter(n=>n.endsWith(' 포함'))).toEqual(order.map(l=>`${names[l]} 포함`));
    await expect(r.include('nerve')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(r.include('nerve')).not.toBeChecked();
    await expect.poll(()=>excludedOf(page)).toEqual(['nerve']);
    await expect(r.include('nerve')).toBeFocused();
    await page.keyboard.press('Space');
    await expect.poll(()=>excludedOf(page)).toEqual([]);
    await page.keyboard.press('Space');
    await expect.poll(()=>excludedOf(page)).toEqual(['nerve']);
    const canvas=page.locator('canvas');await canvas.focus();await expect(canvas).toBeFocused();
    for(let i=0;i<20;i++)await page.keyboard.press('Shift+Alt+ArrowDown');
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(90);
    await page.keyboard.press('Alt+ArrowDown');await ready(page);
    expect((await snapshot(page)).dissection).toBe(90);
    await page.keyboard.press('Alt+ArrowUp');
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(89.5);
    await page.keyboard.press('Alt+ArrowDown');await page.keyboard.press('Alt+ArrowDown');await ready(page);
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(90);
    await expect(canvas).toBeFocused();
    const s=await snapshot(page);
    expect(s.excluded).toEqual(['nerve']);expect(s.layers).toEqual(only('lymph'));
    sameCamera(s,before);expect(preferences(s)).toEqual(preferences(before));
    await expect(r.stage).toHaveText('림프');
    await expectDrawn(page,run.url,['lymph']);
    expect(run.errors).toEqual([]);
  });

  test('e) the 표시 설정 system checks stay a direct combination; the peel then applies the exclusion again',async({page})=>{
    test.setTimeout(150000);
    const run=await open(page),r=rail(page);
    await settledCamera(page);
    const before=await snapshot(page);
    await r.toggle.click();await r.include('organ').uncheck();await r.toggle.click();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ']);
    await r.slider.fill('44');
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(44);
    await openTool(page,'표시 설정');
    const panel=page.getByRole('region',{name:'표시 설정',exact:true});
    const box=(l:System)=>panel.getByRole('checkbox',{name:`${names[l]} 레이어`,exact:true});
    // The boxes show what is drawn now: peeled skin and the left-out organs are off.
    await expect(panel.locator('.control-hint').first()).toContainText('계통을 조합해');
    for(const l of order)if(['skin','organ'].includes(l))await expect(box(l)).not.toBeChecked();else await expect(box(l)).toBeChecked();
    // Ticking organs combines them directly (a layer view), as before; the exclusion is kept for the peel.
    await box('organ').check();await ready(page);
    let s=await snapshot(page);
    expect(s.displayMode).toBe('layers');expect(s.layers).toEqual(only('muscle','bone','organ','vessel','lymph','nerve'));expect(s.excluded).toEqual(['organ']);
    await expectDrawn(page,run.url,['muscle','bone','organ','vessel','lymph','nerve']);
    sameCamera(s,before);expect(preferences(s)).toEqual(preferences(before));
    await closeTool(page);
    await expect(r.nav.locator('.depth-mode')).toHaveText('계통 직접 조합');
    // Back to the peel: the exclusion applies again.
    await r.nav.getByRole('button',{name:'현재 기준 44.0%에서 연속 박리 시작',exact:true}).click();await ready(page);
    s=await snapshot(page);
    expect(s.displayMode).toBe('dissection');expect(s.dissection).toBe(44);expect(s.excluded).toEqual(['organ']);
    expect(s.layers).toEqual(only('muscle','bone','vessel','lymph','nerve'));
    await expectDrawn(page,run.url,['muscle','bone','vessel','lymph','nerve']);
    sameCamera(s,before);expect(preferences(s)).toEqual(preferences(before));
    expect(run.errors).toEqual([]);
  });

  test('f) reload restores the exclusions and the clamp; the female body keeps them',async({page})=>{
    test.setTimeout(240000);
    const run=await open(page),r=rail(page);
    await r.toggle.click();await r.include('organ').uncheck();await r.include('nerve').uncheck();await r.toggle.click();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ','nerve']);
    await r.slider.fill('100');
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(90);
    await page.reload();await ready(page);
    let s=await snapshot(page);
    expect(s.excluded).toEqual(['organ','nerve']);expect(s.displayMode).toBe('dissection');expect(s.dissection).toBe(90);
    expect(s.layers).toEqual(only('lymph'));expect(s.stage).toBe(5);
    await expect(r.summaryLines).toHaveText(['장기·신경 뺌','90%까지']);await expect(r.stage).toHaveText('림프');await expect(r.slider).toHaveValue('90');
    await expectDrawn(page,run.url,['lymph']);
    // A saved depth past the limit and an unordered list are normalised on restore.
    await page.evaluate(()=>{const key='gyeol-view-v2',v=JSON.parse(sessionStorage.getItem(key)!);v.excluded=['nerve','organ'];v.dissection=100;sessionStorage.setItem(key,JSON.stringify(v));});
    await page.reload();await ready(page);
    s=await snapshot(page);
    expect(s.excluded).toEqual(['organ','nerve']);expect(s.dissection).toBe(90);expect(s.layers).toEqual(only('lymph'));
    await expectDrawn(page,run.url,['lymph']);
    // The female body starts at 0% with the same systems left out.
    await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
    s=await snapshot(page);
    expect(s.sex).toBe('female');expect(s.excluded).toEqual(['organ','nerve']);expect(s.displayMode).toBe('dissection');expect(s.dissection).toBe(0);
    expect(s.layers).toEqual(only('skin','muscle','bone','vessel','lymph'));
    // Under the skin the left-out systems keep only parts drawn as the body's surface.
    await expect.poll(async()=>{const c=await drawn(page,run.url);return (['skin','muscle','bone','vessel','lymph'] as const).every(l=>c[l]>0);}).toBe(true);
    for(const l of ['organ','nerve'] as const)expect(await drawnUntoned(page,run.url,l),l).toEqual([]);
    await expect(r.summaryLines).toHaveText(['장기·신경 뺌','90%까지']);
    // Leaving the skeleton out keeps the borrowed alar cartilages: they are the female nose's surface.
    await r.toggle.click();await r.include('bone').uncheck();await r.done.click();
    await expect.poll(()=>excludedOf(page)).toEqual(['bone','organ','nerve']);
    await expect.poll(async()=>(await drawnNames(page,run.url,'bone')).sort()).toEqual(expect.arrayContaining(['BM0000','BM0001']));
    await r.toggle.click();await r.include('bone').check();await r.done.click();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ','nerve']);
    await r.slider.fill('68');
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(68);
    await expectDrawn(page,run.url,['bone','vessel','lymph']);
    // Control: the female organs are drawn at this depth once put back.
    await r.toggle.click();await r.include('organ').check();
    await expect.poll(()=>excludedOf(page)).toEqual(['nerve']);
    const female=await expectDrawn(page,run.url,['bone','organ','vessel','lymph']);expect(female.organ).toBeGreaterThan(0);
    await r.include('organ').uncheck();await r.toggle.click();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ','nerve']);
    await expectDrawn(page,run.url,['bone','vessel','lymph']);
    await ready(page);
    // Off the rail, so the last click's hover tip does not cover the scene.
    await page.mouse.move(1300,450);await ready(page);
    await page.screenshot({path:`${shots}/female-excluded.png`});
    expect(run.errors).toEqual([]);
  });

  test('f2) invalid saved exclusions fall back to a safe view; older sessions leave nothing out',async({page})=>{
    test.setTimeout(240000);
    const run=await open(page);
    const tamper=async(excluded:unknown)=>{
      await page.evaluate(excluded=>{const key='gyeol-view-v2',v=JSON.parse(sessionStorage.getItem(key)!);v.dissection=50;v.layers={skin:false,muscle:true,bone:true,organ:true,vessel:true,lymph:true,nerve:true};
        if(excluded===undefined)delete v.excluded;else v.excluded=excluded;sessionStorage.setItem(key,JSON.stringify(v));},excluded);
      await page.reload();await ready(page);return snapshot(page);
    };
    let s=await tamper(undefined);
    expect(s.excluded).toEqual([]);expect(s.dissection).toBe(50);
    for(const invalid of [[...order],'organ',['organ','spleen']]){
      s=await tamper(invalid);
      expect(s.excluded,JSON.stringify(invalid)).toEqual([]);expect(s.dissection,JSON.stringify(invalid)).toBe(0);
    }
    await expectDrawn(page,run.url,[...order]);
    expect(run.errors).toEqual([]);
  });
});

test.describe('phone 390×844 touch',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true});
  test('g) the depth band chooses systems with 44px targets and reopens on its peel stops',async({page})=>{
    test.setTimeout(150000);
    const run=await open(page),r=rail(page);
    expect(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches)).toBe(true);
    const band=page.locator('.depth-toggle');
    await band.tap();
    await expect(band).toHaveAttribute('aria-expanded','true');
    await r.toggle.tap();
    await expect(r.toggle).toHaveAttribute('aria-pressed','true');
    await r.include('organ').tap();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ']);
    await expect(band).toHaveAttribute('aria-label','깊이 단계 선택: 0.0% · 체표 · 1개 뺌');
    await expect(band).toHaveAttribute('aria-expanded','true');
    await expect(r.nav).toHaveAttribute('data-excluding','true');
    await expectDrawn(page,run.url,['skin','muscle','bone','organ','vessel','lymph','nerve']);
    for(const id of await drawnNames(page,run.url,'organ'))expect(SURFACE_ORGANS,id).toContain(id);
    // Touch targets (Q34/Q42).
    const toggle=(await r.toggle.boundingBox())!;
    expect(toggle.height).toBeGreaterThanOrEqual(44);expect(toggle.width).toBeGreaterThanOrEqual(44);
    const targets=await boxes(r.nav.locator('.ax-include'));
    expect(targets).toHaveLength(7);
    for(const t of targets){expect(t.h,`${t.text} height`).toBeGreaterThanOrEqual(44);expect(t.w,`${t.text} width`).toBeGreaterThanOrEqual(44);}
    expectApart(targets);
    // The band, its list and every check stay on screen without horizontal scroll.
    const viewport={x:0,y:0,w:390,h:844};
    const [bandBox]=await boxes(r.nav.locator('.depth-band'));const [picker]=await boxes(r.picker);
    expectInside(bandBox,viewport,'band');expectInside(picker,viewport,'picker');
    // The checks take the stops' place below the band.
    await expect(r.nav.locator('.depth-steps')).toBeHidden();
    expect(Math.abs(picker.y-(bandBox.y+bandBox.h))).toBeLessThan(1.5);
    const done=(await r.done.boundingBox())!;expect(done.height).toBeGreaterThanOrEqual(44);expect(done.width).toBeGreaterThanOrEqual(44);
    for(const t of targets)expectInside(t,viewport,t.text);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expectReadable(r.nav.locator('.ax-include-name, .depth-excluded, .exclude-label, .depth-band-hint, .exclude-done'));
    await page.screenshot({path:`${shots}/phone-band-edit.png`});
    // 완료 leaves the choice and keeps the band open on its stops.
    await r.done.tap();
    await expect(r.toggle).toHaveAttribute('aria-pressed','false');await expect(band).toHaveAttribute('aria-expanded','true');
    await expect(r.nav.locator('.depth-steps')).toBeVisible();
    await r.toggle.tap();await expect(r.toggle).toHaveAttribute('aria-pressed','true');
    await page.keyboard.press('Escape');
    await expect(band).toHaveAttribute('aria-expanded','false');
    await expect(r.nav).toHaveAttribute('data-excluding','false');
    expect(await excludedOf(page)).toEqual(['organ']);
    await band.tap();
    await expect(band).toHaveAttribute('aria-expanded','true');
    await expect(r.toggle).toHaveAttribute('aria-pressed','false');
    await expect(r.nav.locator('.ax-include')).toHaveCount(0);
    await expect(r.nav.locator('.ax-stop')).toHaveCount(7);
    for(const l of ['skin','muscle','bone','vessel','lymph','nerve'] as const)await expect(r.stop(l)).toBeVisible();
    await expect(r.leftStop('organ')).toBeVisible();await expect(r.leftStop('organ')).toHaveAttribute('aria-disabled','true');
    await expect(r.summary).toHaveText('장기 뺌');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    // The closed row keeps the count and its chevron inside the button; the depth name gives way first.
    await page.keyboard.press('Escape');
    await r.slider.fill('37.5');await ready(page);
    for(const width of [390,360]){
      await page.setViewportSize({width,height:width===390?844:740});
      await expect(band.locator('.depth-toggle-count')).toHaveText('1개 뺌');
      const fit=await band.evaluate(el=>{const b=el.getBoundingClientRect(),c=el.querySelector('svg')!.getBoundingClientRect(),n=el.querySelector('.depth-toggle-count')!.getBoundingClientRect();
        return {chevron:c.right<=b.right+.5&&c.left>=b.left-.5,count:n.right<=b.right+.5};});
      expect(fit,`${width}px`).toEqual({chevron:true,count:true});
      await expectReadable(band.locator('.depth-toggle-count'));
    }
    expect(run.errors).toEqual([]);
  });
});

test.describe('short landscape 844×390 touch',()=>{
  test.use({viewport:{width:844,height:390},hasTouch:true});
  test('h) the word toggle opens seven 44px named checks beside the rail; a system view keeps the rail in its panel',async({page})=>{
    test.setTimeout(150000);
    const run=await open(page),r=rail(page);
    expect(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches)).toBe(true);
    const toggle=(await r.toggle.boundingBox())!;
    expect(toggle.width).toBeGreaterThanOrEqual(44);expect(toggle.height).toBeGreaterThanOrEqual(44);
    await expect(r.toggle).toHaveText('계통 빼기');await expectReadable(r.nav.locator('.exclude-label'));
    await r.toggle.tap();
    await expect(r.toggle).toHaveAttribute('aria-pressed','true');
    // The checks open as a picker beside the rail; the slider stays.
    await expect(r.slider).toBeVisible();
    for(const l of order){
      await expect(r.include(l)).toBeVisible();
      const label=r.nav.locator('.ax-include').filter({has:page.getByRole('checkbox',{name:`${names[l]} 포함`,exact:true})}).locator('.ax-include-name');
      await expect(label).toHaveText(names[l]);await expect(label).toBeVisible();
    }
    await r.include('organ').tap();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ']);
    const targets=await boxes(r.nav.locator('.ax-include'));
    expect(targets).toHaveLength(7);
    expectApart(targets);
    for(const t of targets){expect(t.h,`${t.text} height`).toBeGreaterThanOrEqual(44);expect(t.w,`${t.text} width`).toBeGreaterThanOrEqual(44);}
    const [picker]=await boxes(r.picker);
    expectInside(picker,{x:0,y:0,w:844,h:390},'picker');
    for(const t of targets)expectInside(t,picker,t.text);
    // The picker covers part of the body, not another tool (Q25).
    for(const other of SCENE_TOOLS){
      for(const b of await boxes(page.locator(other)))if(b.w>0&&b.h>0)expect(overlaps(picker,b),`picker × ${other}`).toBe(false);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expectReadable(r.nav.locator('.ax-include-name, .exclude-hint, .exclude-done'));
    await page.screenshot({path:`${shots}/landscape-edit.png`});
    await r.toggle.tap();
    await expect(r.toggle).toHaveAttribute('aria-pressed','false');
    await expect(r.nav.locator('.ax-include')).toHaveCount(0);
    // With systems left out the word button reads "N개 뺌".
    await expect(r.toggle).toHaveAccessibleName('계통 빼기 · 1개 뺌');
    await expect(r.nav.locator('.exclude-short')).toHaveText('1개 뺌');await expectReadable(r.nav.locator('.exclude-short'));
    // A one-system view: the button waits for the peel and the rail stays inside its panel.
    // An open picker closes with it rather than staying without its button.
    await r.toggle.tap();await expect(r.picker).toBeVisible();
    await page.keyboard.press('Escape');await expect(r.picker).toHaveCount(0);
    await r.toggle.tap();await expect(r.picker).toBeVisible();
    await r.nav.getByRole('button',{name:'체표 빠른 보기',exact:true}).evaluate((el:HTMLElement)=>el.click());await ready(page);
    await expect(r.picker).toHaveCount(0);await expect(r.nav).toHaveAttribute('data-excluding','false');
    await r.nav.getByRole('button',{name:/에서 연속 박리 시작$/}).tap();await ready(page);
    await r.eye('skin').tap();await ready(page);
    expect((await snapshot(page)).displayMode).toBe('layers');
    await expect(r.toggle).toBeHidden();
    const [nav]=await boxes(r.nav),[track]=await boxes(r.nav.locator('.ax-depth-track'));
    expectInside(track,nav,'track');
    for(const b of await boxes(page.locator('.ax-status .scene-status')))expect(overlaps(nav,b),'rail × status').toBe(false);
    expect(run.errors).toEqual([]);
  });
});

test.describe('body regions 1440×900',()=>{
  test.use({viewport:{width:1440,height:900}});
  test('i) at its stop every body region of both bodies still draws the innermost kept system',async({page})=>{
    test.setTimeout(420000);
    const run=await open(page),r=rail(page);
    const regions=['whole','head','upper-body','lower-body','upper-limb','lower-limb','chest','abdomen','pelvis'];
    // Separately modelled tendons fade with the whole muscle layer; count only the ranked muscles.
    await openTool(page,'표시 설정');
    await page.getByRole('region',{name:'표시 설정',exact:true}).getByRole('checkbox',{name:/인대·힘줄 표시/}).uncheck();
    await closeTool(page);
    await r.toggle.click();
    for(const l of ['bone','organ','vessel','lymph','nerve'] as const)await r.include(l).uncheck();
    await r.toggle.click();
    await expect.poll(()=>excludedOf(page)).toEqual(['bone','organ','vessel','lymph','nerve']);
    for(const sex of ['male','female'] as const){
      if(sex==='female'){await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);}
      for(const region of regions){
        await page.getByLabel('전신 부위 선택',{exact:true}).selectOption(region);await ready(page);
        await r.slider.fill('100');await ready(page);
        const s=await snapshot(page);
        expect(s.dissection,`${sex} ${region}`).toBe(56);expect(s.layers,`${sex} ${region}`).toEqual(only('muscle'));
        await expect.poll(async()=>(await drawn(page,run.url)).muscle,{message:`${sex} ${region}: a muscle at 56%`}).toBeGreaterThan(0);
      }
    }
    // Organs innermost: the arm has none, so the peel stops at the bone there.
    await page.getByLabel('전신 부위 선택',{exact:true}).selectOption('upper-limb');await ready(page);
    await r.toggle.click();await r.include('bone').check();await r.include('organ').check();await r.toggle.click();
    await expect.poll(()=>excludedOf(page)).toEqual(['vessel','lymph','nerve']);
    await r.slider.fill('100');await ready(page);
    let s=await snapshot(page);expect(s.dissection).toBe(68);
    await expect(r.summaryLines).toHaveText(['혈관·림프·신경 뺌','68%까지']);
    await expect.poll(async()=>(await drawn(page,run.url)).bone).toBeGreaterThan(0);
    await page.getByLabel('전신 부위 선택',{exact:true}).selectOption('abdomen');await ready(page);
    await r.slider.fill('100');await ready(page);
    s=await snapshot(page);expect(s.dissection).toBe(76);
    await expect.poll(async()=>(await drawn(page,run.url)).organ).toBeGreaterThan(0);
    // Back to the arm: the region change itself re-clamps the peel.
    await page.getByLabel('전신 부위 선택',{exact:true}).selectOption('upper-limb');await ready(page);
    s=await snapshot(page);expect(s.dissection).toBe(68);expect(s.displayMode).toBe('dissection');
    await expect.poll(async()=>(await drawn(page,run.url)).bone).toBeGreaterThan(0);
    expect(run.errors).toEqual([]);
  });
});

// Touch tablets and short windows: the rail keeps its stops apart with the
// button in place, and the picker opens beside it, on screen, clear of other tools.
for(const [width,height,touch] of [[1024,768,true],[1280,720,true],[1024,680,true],[768,1024,true],[1180,580,false],[1366,768,false]] as const){
  test.describe(`rail ${width}×${height}${touch?' touch':''}`,()=>{
    test.use({viewport:{width,height},hasTouch:touch});
    test('j) stops stay apart with systems left out, and the picker fits beside the rail',async({page})=>{
      test.setTimeout(150000);
      const run=await open(page),r=rail(page);
      const press=(l:Locator)=>touch?l.tap():l.click();
      const stopsApart=async(what:string)=>{
        const rows=await boxes(r.nav.locator('.depth-steps li'));
        expect(rows,what).toHaveLength(7);
        for(let i=1;i<rows.length;i++)expect(rows[i].y-(rows[i-1].y+rows[i-1].h),`${what}: ${order[i-1]}/${order[i]} gap`).toBeGreaterThanOrEqual(-.5);
        const [band]=await boxes(r.nav.locator('.depth-band'));
        expect(rows[0].y,`${what}: first stop under the band`).toBeGreaterThanOrEqual(band.y+band.h-.5);
        const [nav]=await boxes(r.nav);for(const row of rows)expectInside(row,nav,`${what} row`);
      };
      await stopsApart('nothing left out');
      await press(r.toggle);
      for(const l of ['skin','bone','organ','vessel','lymph','nerve'] as const)await press(r.include(l));
      await expect.poll(()=>excludedOf(page)).toEqual(['skin','bone','organ','vessel','lymph','nerve']);
      // Every check is its own target: the centre of each hits that check.
      for(const l of order){
        const hit=await r.include(l).evaluate(el=>{const b=el.getBoundingClientRect(),t=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return t===el||el.closest('label')!.contains(t);});
        expect(hit,`${names[l]} 포함 centre`).toBe(true);
      }
      const targets=await boxes(r.nav.locator('.ax-include'));expectApart(targets);
      if(touch)for(const t of targets){expect(t.h,`${t.text} height`).toBeGreaterThanOrEqual(44);expect(t.w,`${t.text} width`).toBeGreaterThanOrEqual(44);}
      const [picker]=await boxes(r.picker);
      expectInside(picker,{x:0,y:0,w:width,h:height},'picker');
      for(const other of SCENE_TOOLS)for(const b of await boxes(page.locator(other)))if(b.w>0&&b.h>0)expect(overlaps(picker,b),`picker × ${other}`).toBe(false);
      await expectReadable(r.nav.locator('.ax-include-name, .exclude-hint, .exclude-done'));
      await stopsApart('choosing');
      await press(r.include('skin'));
      await expect.poll(()=>excludedOf(page)).toEqual(['bone','organ','vessel','lymph','nerve']);
      await press(r.done);
      await expect(r.picker).toHaveCount(0);await expect(r.toggle).toBeFocused();
      await stopsApart('five left out');
      await expect(r.toggle).toHaveAccessibleName('계통 빼기 · 5개 뺌');
      await expectReadable(r.nav.locator('.exclude-short, .depth-excluded > span'));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(width===1024&&height===768)await page.screenshot({path:`${shots}/tablet-rail.png`});
      expect(run.errors).toEqual([]);
    });
  });
}

test.describe('desktop 1440×900 keys and click target',()=>{
  test.use({viewport:{width:1440,height:900}});
  test('k) Escape closes the choice first only while it can be seen; search and presenting close in one press',async({page})=>{
    test.setTimeout(150000);
    const run=await open(page),r=rail(page);
    await r.toggle.click();await expect(r.picker).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(r.picker).toHaveCount(0);await expect(r.toggle).toBeFocused();
    // The search panel hides the rail: Escape closes the search, not the hidden choice.
    await r.toggle.click();await expect(r.picker).toBeVisible();
    await page.locator('canvas').focus();await page.keyboard.press('/');
    await expect(page.getByRole('region',{name:'검색 결과',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region',{name:'검색 결과',exact:true})).toBeHidden();
    // Presenting ends the choice and ends with one Escape.
    await page.getByRole('button',{name:'발표 보기',exact:true}).click();
    // The rail is hidden while presenting, so read it by class.
    await expect(page.locator('.ax-depth')).toHaveAttribute('data-excluding','false');
    await page.keyboard.press('Escape');
    await expect(page.locator('.ax')).toHaveAttribute('data-present','false');
    expect(run.errors).toEqual([]);
  });

  test('l) with the click target set to internal structures, the male face keeps its ears, lips and eyes',async({page})=>{
    test.setTimeout(150000);
    const run=await open(page),r=rail(page);
    await openTool(page,'표시 설정');
    await page.getByLabel('클릭 선택 대상').selectOption('internal');
    await closeTool(page);
    await r.toggle.click();await r.include('organ').uncheck();await r.done.click();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ']);
    const s=await snapshot(page);expect(s.selectionTarget).toBe('internal');expect(s.displayMode).toBe('dissection');
    await expect.poll(async()=>(await drawnNames(page,run.url,'organ')).length).toBeGreaterThan(0);
    for(const id of await drawnNames(page,run.url,'organ'))expect(SURFACE_ORGANS,id).toContain(id);
    expect((await drawnNames(page,run.url,'nerve')).filter(n=>EYE_PART.test(n))).toEqual([]);
    // Peeling the skin away takes them with it.
    await r.slider.fill('30');await ready(page);
    await expect.poll(async()=>(await drawnNames(page,run.url,'organ')).length).toBe(0);
    expect(run.errors).toEqual([]);
  });
});
