import {test,expect,type Page,type Locator} from '@playwright/test';
import fs from 'node:fs';
import {ready,snapshot,openTool,closeTool,settledCamera,compare} from './helpers';

// Leaving systems out of the peel (Q42): systems left out of the progressive
// peel are not drawn at any depth, the peel stops before the innermost included
// system goes, and explicit views (one system, layer combinations) still open
// what they need. Since 2026-10-25 the choice is part of the peel itself: every
// depth-rail stop row starts with its own "○○ 포함" check (no separate button,
// picker or 완료); the phone and landscape bands carry the same rows.
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
// The system of each catalogued mesh, read as first-frame.spec.ts does:
// ligaments belong to the skeleton and supplement tendons to the muscles.
const catalog=[...read('scripts/model-inputs.json').assets,...read('data/full-system-structures.json'),...read('data/connective-structures.json'),...read('data/sex-lymph-structures.json'),...read('data/female-atlas-structures.json'),...read('data/female-detail-structures.json')];
const layerById:Record<string,string>=Object.fromEntries(catalog.map((s:{id:string;layer:string})=>[s.id,s.layer]));
const order=['skin','muscle','bone','organ','vessel','lymph','nerve'] as const;
type System=typeof order[number];
const names:Record<System,string>={skin:'체표',muscle:'근육',bone:'골격',organ:'장기',vessel:'혈관',lymph:'림프',nerve:'신경'};
// The scene colour of each system, as its swatch must render it, and the check
// mark's ink (--ax-accent-ink) drawn over it.
const COLOURS:Record<System,string>={skin:'rgb(201, 139, 115)',muscle:'rgb(192, 80, 74)',bone:'rgb(227, 215, 179)',organ:'rgb(192, 122, 134)',vessel:'rgb(211, 75, 68)',lymph:'rgb(88, 195, 160)',nerve:'rgb(229, 195, 90)'};
const INK='rgb(6, 32, 40)';
const LAST='마지막 남은 계통은 뺄 수 없습니다';
const LEGEND=['포함: 넣고 빼기','이름: 여기까지 박리','눈: 이것만 보기'];
const shots='docs/system-exclusion';
// Scene tools the rail and bands must leave clear (Q25).
const SCENE_TOOLS=['.ax-search','.ax-top-actions','.ax-point-chip','.ax-point-bar','.ax-status .scene-status','.ax-status .ax-source','.movement-pad','.view-tools','.view-presets','.ax-inspector .selection-card'];
const only=(...on:System[])=>Object.fromEntries(order.map(l=>[l,on.includes(l)]));

// Loads the atlas and keeps the react-three-fiber module URL for scene reads.
async function open(page:Page,hash=''){
  const run={url:'',errors:[] as string[]};
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))run.url=r.url();});
  page.on('pageerror',e=>run.errors.push(e.message));
  await page.goto('/'+hash);await ready(page);
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
const luminance=(c:string)=>c.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
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
type Box={text:string;cls:string;x:number;y:number;w:number;h:number};
// Boxes named by their accessible label (a check label by its input's), or their text.
const boxes=(locator:Locator)=>locator.evaluateAll(elements=>elements.map(el=>{
  const r=el.getBoundingClientRect();
  return {text:(el.getAttribute('aria-label')||el.querySelector('[aria-label]')?.getAttribute('aria-label')||el.textContent||'').trim(),cls:el.classList[0]||el.tagName,x:r.x,y:r.y,w:r.width,h:r.height};
})) as Promise<Box[]>;
// Only what is on screen: skips visibility:hidden and zero-size boxes.
const visibleBoxes=async(locator:Locator)=>{
  const shown=await locator.evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';}));
  return (await boxes(locator)).filter((_,i)=>shown[i]);
};
const geometry=(list:Box[])=>list.map(({x,y,w,h})=>({x,y,w,h}));
const overlaps=(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number})=>a.x<b.x+b.w-.5&&b.x<a.x+a.w-.5&&a.y<b.y+b.h-.5&&b.y<a.y+a.h-.5;
function expectApart(list:Box[]){for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)expect(overlaps(list[i],list[j]),`${list[i].text} overlaps ${list[j].text}`).toBe(false);}
function expectInside(inner:{x:number;y:number;w:number;h:number},outer:{x:number;y:number;w:number;h:number},what:string){
  expect(inner.x,`${what} left`).toBeGreaterThanOrEqual(outer.x-.5);expect(inner.y,`${what} top`).toBeGreaterThanOrEqual(outer.y-.5);
  expect(inner.x+inner.w,`${what} right`).toBeLessThanOrEqual(outer.x+outer.w+.5);expect(inner.y+inner.h,`${what} bottom`).toBeLessThanOrEqual(outer.y+outer.h+.5);
}
async function expectClearOfTools(page:Page,box:Box,what:string){
  for(const other of SCENE_TOOLS)for(const b of await visibleBoxes(page.locator(other)))expect(overlaps(box,b),`${what} × ${other}`).toBe(false);
}
const noSideScroll=(page:Page)=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
// Text lines of an element (distinct line tops of its text), and whether it is cut off.
const lineFit=(locator:Locator)=>locator.evaluate(el=>{
  const tops:number[]=[],walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  for(let node=walk.nextNode();node;node=walk.nextNode()){const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())if(r.width>0)tops.push(r.top);}
  tops.sort((a,b)=>a-b);
  const lines=tops.filter((top,i)=>i===0||top-tops[i-1]>4).length;
  return {lines,clipped:el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1};
});
const tip=(locator:Locator)=>locator.evaluate(el=>{const s=getComputedStyle(el,'::after');return {opacity:s.opacity,content:s.content,left:parseFloat(s.left),x:el.getBoundingClientRect().x};});
const activeName=(page:Page)=>page.evaluate(()=>document.activeElement?.getAttribute('aria-label')||'');
// Presses Tab until the control with this accessible name has focus; returns the names passed.
async function tabTo(page:Page,name:string,max=30){
  const path:string[]=[];
  for(let i=0;i<max;i++){await page.keyboard.press('Tab');const now=await activeName(page);path.push(now);if(now===name)return path;}
  throw new Error(`Tab did not reach ${name}: ${path.join(' > ')}`);
}

function rail(page:Page){
  const nav=page.getByRole('navigation',{name:'인체 깊이 탐색',exact:true});
  // One system's stop row, found by its stop ("○○까지 박리", or "○○ 뺌 — 박리에서 뺀 계통").
  const row=(l:System)=>nav.locator('.depth-steps > li').filter({has:page.getByRole('button',{name:new RegExp(`^${names[l]}(까지 박리| 뺌 — )`)})});
  return {
    nav,row,
    include:(l:System)=>nav.getByRole('checkbox',{name:`${names[l]} 포함`,exact:true}),
    keep:(l:System)=>row(l).locator('.ax-keep'),
    swatch:(l:System)=>row(l).locator('.ax-swatch'),
    stop:(l:System)=>nav.getByRole('button',{name:`${names[l]}까지 박리`,exact:true}),
    leftStop:(l:System)=>nav.getByRole('button',{name:`${names[l]} 뺌 — 박리에서 뺀 계통`,exact:true}),
    // A reason beside its row on rails (a refused last system, a pressed left-out stop).
    rowNote:(l:System)=>row(l).locator('.ax-row-note'),
    rowNotes:nav.locator('.ax-row-note'),
    eye:(l:System)=>nav.getByRole('button',{name:`${names[l]}만 보기`,exact:true}),
    checks:nav.getByRole('checkbox'),
    statics:nav.locator('.depth-steps .ax-keep.is-static'),
    stage:nav.locator('.depth-heading strong small'),
    summary:nav.locator('.depth-excluded'),
    // The summary's lines: the left-out names, then where the peel stops.
    summaryLines:nav.locator('.depth-excluded > span'),
    caption:nav.locator('.depth-keep-hint'),
    cols:nav.locator('.depth-cols'),
    hint:nav.locator('.depth-band-hint'),
    aside:nav.locator('.depth-steps-aside'),
    status:nav.locator('.depth-status'),
    // The phone and landscape "깊이 단계" button, and what it opens.
    band:page.locator('.depth-toggle'),
    bandBox:nav.locator('.depth-band'),
    steps:nav.locator('.depth-steps'),
    targets:nav.locator('.depth-steps :is(.ax-keep, .ax-stop, .ax-solo)'),
    slider:page.getByLabel('연속 해부 박리 깊이',{exact:true}),
  };
}
type Rail=ReturnType<typeof rail>;

// An included system's check: a square in its scene colour with an ink check
// mark (≥3:1 on that colour); outside the peel the same square without the mark.
async function expectKept(r:Rail,systems:readonly System[],ticked=true){
  for(const l of systems){
    const s=await r.swatch(l).evaluate(el=>{const c=getComputedStyle(el);return {bg:c.backgroundColor,image:c.backgroundImage};});
    expect(s.bg,`${names[l]} swatch colour`).toBe(COLOURS[l]);
    expect(contrast(INK,s.bg),`${names[l]} check mark contrast`).toBeGreaterThanOrEqual(3);
    if(ticked){expect(s.image,`${names[l]} check mark`).toContain('svg');expect(s.image,`${names[l]} check ink`).toContain('062028');}
    else expect(s.image,`${names[l]} static swatch`).toBe('none');
  }
}
// A left-out system's check: a hollow square.
async function expectHollow(r:Rail,systems:readonly System[]){
  for(const l of systems){
    const s=await r.swatch(l).evaluate(el=>{const c=getComputedStyle(el);return {bg:c.backgroundColor,image:c.backgroundImage,shadow:c.boxShadow};});
    expect(s.bg,`${names[l]} hollow`).toBe('rgba(0, 0, 0, 0)');expect(s.image,`${names[l]} no mark`).toBe('none');expect(s.shadow,`${names[l]} outline`).toContain('inset');
  }
}
// The rail's column names sit over the check, the name and the eye of every row.
async function expectColumns(r:Rail){
  await expect(r.cols).toBeVisible();
  await expect(r.cols.locator('span')).toHaveText(['포함','박리','만 보기']);
  const heads=await boxes(r.cols.locator('span'));
  const [keep]=await boxes(r.keep('skin')),[stop]=await boxes(r.row('skin').locator('.ax-stop')),[eye]=await boxes(r.eye('skin'));
  for(const [head,column] of [[heads[0],keep],[heads[1],stop],[heads[2],eye]] as const){
    const centre=head.x+head.w/2;
    expect(centre,`${head.text} over its column`).toBeGreaterThanOrEqual(column.x-.5);expect(centre,`${head.text} over its column`).toBeLessThanOrEqual(column.x+column.w+.5);
  }
  for(const b of await boxes(r.nav.locator('.depth-steps > li')))expect(b.y,'rows under the column names').toBeGreaterThanOrEqual(heads[0].y+heads[0].h-.5);
}
// Band and steps together (phones: the steps sit flush under the band) as a share of the scene.
async function bandShare(page:Page){
  const parts=await visibleBoxes(page.locator('.ax-depth :is(.depth-band, .depth-steps)'));
  expect(parts.length).toBeGreaterThan(0);
  const canvas=(await page.locator('canvas').boundingBox())!;
  return (Math.max(...parts.map(b=>b.y+b.h))-Math.min(...parts.map(b=>b.y)))/canvas.height;
}
// The phone band: 21 targets of 44px, apart and on screen; the steps flush under the band; within 45%.
async function expectPhoneBand(page:Page,r:Rail,width:number,height:number){
  const viewport={x:0,y:0,w:width,h:height};
  const targets=await boxes(r.targets);
  expect(targets).toHaveLength(21);
  for(const t of targets){expect(t.h,`${t.text} height`).toBeGreaterThanOrEqual(44);expect(t.w,`${t.text} width`).toBeGreaterThanOrEqual(44);expectInside(t,viewport,t.text);}
  expectApart(targets);
  const [band]=await boxes(r.bandBox),[steps]=await boxes(r.steps);
  expectInside(band,viewport,'band');expectInside(steps,viewport,'steps');
  expect(Math.abs(steps.y-(band.y+band.h)),'steps flush under the band').toBeLessThan(1.5);
  expect(await bandShare(page),'band + steps share of the scene').toBeLessThanOrEqual(.45);
  expect(await noSideScroll(page)).toBe(true);
  return targets;
}
// The landscape band beside the rail: 21 targets of 44px (names at least
// minName wide), inside the band and the viewport; bottom on the rail's
// bottom; within 45%; the selection column and the cutaway reset step aside.
async function expectLandscapeBand(page:Page,r:Rail,width:number,height:number,minName=44){
  const viewport={x:0,y:0,w:width,h:height};
  const [steps]=await boxes(r.steps),[nav]=await boxes(r.nav);
  const canvas=(await page.locator('canvas').boundingBox())!;
  const targets=await boxes(r.targets);
  expect(targets,`${width}×${height} targets`).toHaveLength(21);
  for(const t of targets){
    expect(t.h,`${width}: ${t.text} height`).toBeGreaterThanOrEqual(44);
    expect(t.w,`${width}: ${t.text} width`).toBeGreaterThanOrEqual(t.cls==='ax-stop'?minName:44);
    expectInside(t,steps,`${width}: ${t.text} in the band`);expectInside(t,viewport,`${width}: ${t.text} on screen`);
  }
  expectApart(targets);
  expect(steps.x,`${width}: band beside the rail`).toBeGreaterThanOrEqual(nav.x+nav.w+6);
  expect(Math.abs(steps.y+steps.h-(nav.y+nav.h)),`${width}: band bottom on the rail bottom`).toBeLessThan(1.5);
  expect(steps.h/canvas.height,`${width}: band share of the scene`).toBeLessThanOrEqual(.45);
  expectInside(steps,viewport,`${width}: band`);
  for(const sel of ['.ax-inspector','.cutaway-reset'])for(const v of await page.locator(sel).evaluateAll(els=>els.map(el=>getComputedStyle(el).visibility)))expect(v,`${width}: ${sel} while the band is open`).toBe('hidden');
  await expectClearOfTools(page,steps,`${width}: band`);
  const [aside]=await boxes(r.aside);expectInside(aside,steps,`${width}: cell 8`);
  expect(await noSideScroll(page)).toBe(true);
  return targets;
}

test.describe('desktop 1440×900, male',()=>{
  test.use({viewport:{width:1440,height:900}});

  test('a) the rail\'s own checks leave bone and organs out, keep the view and draw muscles with or without organs',async({page})=>{
    test.setTimeout(180000);
    const run=await open(page),r=rail(page);
    await settledCamera(page);
    const before=await snapshot(page);
    expect(before.excluded).toEqual([]);
    const all=await expectDrawn(page,run.url,[...order]);
    // No separate mode: each stop row carries its own check.
    await expect(page.getByRole('button',{name:/계통 빼기/})).toHaveCount(0);
    await expect(r.nav.getByRole('button',{name:'완료',exact:true})).toHaveCount(0);
    await expect(r.checks).toHaveCount(7);
    for(const l of order){await expect(r.include(l)).toBeVisible();await expect(r.include(l)).toBeChecked();}
    await expect(r.caption).toBeVisible();await expect(r.caption).toHaveText('체크를 끄면 박리에서 뺍니다');
    await expectColumns(r);
    // Each check is a square in its system's colour with an ink mark (Codex blocker 1).
    await expectKept(r,order);
    await expect(r.status).toBeEmpty();
    await r.include('organ').uncheck();
    await expect(r.status).toHaveText('장기 뺌');
    await r.include('bone').uncheck();
    await expect(r.include('bone')).toBeFocused();
    await expect(r.status).toHaveText('골격 뺌');
    await expect.poll(()=>excludedOf(page)).toEqual(['bone','organ']);
    await expect(r.caption).toBeHidden();
    await expect(r.summary).toHaveText('골격·장기 뺌');
    await expectHollow(r,['bone','organ']);
    await expectKept(r,['skin','muscle','vessel','lymph','nerve']);
    for(const l of ['bone','organ'] as const){
      await expect(r.include(l)).not.toBeChecked();
      await expect(r.row(l).locator('.ax-stop-left')).toHaveText('뺌');
      await expect(r.leftStop(l)).toHaveAttribute('aria-disabled','true');
      await expect(r.row(l)).toHaveClass(/\bexcluded\b/);
    }
    // A result is announced, not shown: the rail opens no note for it.
    await expect(r.hint).toBeHidden();
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
    // The checks, names and eyes sit apart from each other (Q25).
    expectApart(await boxes(r.nav.locator('.ax-keep')));
    expectApart(await boxes(r.targets));
    await r.slider.fill('44');
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(44);
    s=await snapshot(page);
    expect(s.excluded).toEqual(['bone','organ']);expect(s.displayMode).toBe('dissection');
    expect(s.layers).toEqual(only('muscle','vessel','lymph','nerve'));
    sameCamera(s,before);expect(preferences(s)).toEqual(preferences(before));
    await expect(r.stage).toHaveText('근육');
    // Peeled rows keep the filled check; only their names change.
    await expectKept(r,['skin']);await expect(r.row('skin')).toHaveClass(/\bpeeled\b/);
    const without=await expectDrawn(page,run.url,['muscle','vessel','lymph','nerve']);
    // Off the rail, so the last click's hover tip does not cover the scene.
    await page.mouse.move(1300,450);await ready(page);
    await page.screenshot({path:`${shots}/desktop-excluded.png`});
    // The check's explanation opens past the rail, not over its own row.
    await r.keep('organ').hover();
    await expect.poll(async()=>(await tip(r.keep('organ'))).opacity).toBe('1');
    const t=await tip(r.keep('organ'));
    expect(t.content).toContain('장기 다시 넣기');
    const [nav]=await boxes(r.nav);
    expect(t.x+t.left,'tip starts past the rail').toBeGreaterThanOrEqual(nav.x+nav.w);
    await page.screenshot({path:`${shots}/desktop-hover.png`});
    // The user's example: the same muscles with the organs put back.
    await r.include('organ').check();
    await expect.poll(()=>excludedOf(page)).toEqual(['bone']);
    await expect(r.status).toHaveText('장기 다시 넣음');
    s=await snapshot(page);
    expect(s.dissection).toBe(44);expect(s.displayMode).toBe('dissection');
    expect(s.layers).toEqual(only('muscle','organ','vessel','lymph','nerve'));
    sameCamera(s,before);expect(preferences(s)).toEqual(preferences(before));
    counts=await expectDrawn(page,run.url,['muscle','organ','vessel','lymph','nerve']);
    expect(counts.muscle).toBe(without.muscle);expect(counts.bone).toBe(0);
    await expect(r.summary).toHaveText('골격 뺌');
    await expectKept(r,['organ']);
    expect(run.errors).toEqual([]);
  });

  test('b) a left-out innermost system stops the peel before it and the last included system stays',async({page})=>{
    test.setTimeout(180000);
    const run=await open(page),r=rail(page);
    await r.include('nerve').uncheck();
    await expect.poll(()=>excludedOf(page)).toEqual(['nerve']);
    await expect(r.status).toHaveText('신경 뺌 · 90%까지');
    await expect(r.nav.locator('.ax-depth-track')).toHaveAttribute('style',/--limit: 90%/);
    await r.slider.fill('100');
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(90);
    await expect(r.slider).toHaveValue('90');
    await expect(r.stage).toHaveText('림프');
    await expect(r.slider).toHaveAttribute('aria-valuetext','90.0% 해부 깊이 · 림프 · 신경 뺌, 90%까지');
    expect((await snapshot(page)).layers).toEqual(only('lymph'));
    await expectDrawn(page,run.url,['lymph']);
    // Leave out everything but the lymphatics: that check cannot be cleared.
    for(const l of ['skin','muscle','bone','organ','vessel'] as const)await r.include(l).uncheck();
    await expect.poll(()=>excludedOf(page)).toEqual(['skin','muscle','bone','organ','vessel','nerve']);
    await expect(r.include('lymph')).toBeChecked();
    await expect(r.include('lymph')).toHaveAttribute('aria-disabled','true');
    await expect(r.include('lymph')).toHaveAccessibleDescription(/마지막 남은 계통은 뺄 수 없습니다/);
    for(const l of ['skin','muscle','bone','organ','vessel','nerve'] as const)await expect(r.include(l)).not.toHaveAttribute('aria-disabled');
    // Keyboard: the locked check takes focus, shows why, and Space changes nothing.
    await r.eye('vessel').focus();await page.keyboard.press('Tab');
    await expect(r.include('lymph')).toBeFocused();
    await expect.poll(async()=>(await tip(r.keep('lymph'))).opacity).toBe('1');
    expect((await tip(r.keep('lymph'))).content).toContain(LAST);
    await page.keyboard.press('Space');await ready(page);
    await expect(r.include('lymph')).toBeChecked();await expect(r.include('lymph')).toBeFocused();
    expect(await excludedOf(page)).toEqual(['skin','muscle','bone','organ','vessel','nerve']);
    await expect(r.status).toHaveText(LAST);
    // While peeling no eye reads as pressed, even with one system kept.
    await expect(r.nav.locator('.ax-solo[aria-pressed="true"]')).toHaveCount(0);
    // The reason opens beside its row too (touch rails have no tips); Escape hides it, the status stays.
    await expect(r.rowNote('lymph')).toBeVisible();await expect(r.rowNote('lymph')).toHaveText(LAST);
    await page.keyboard.press('Escape');await expect(r.rowNotes).toHaveCount(0);await expect(r.include('lymph')).toBeFocused();
    await r.include('lymph').click({force:true});
    await expect(r.include('lymph')).toBeChecked();
    expect(await excludedOf(page)).toEqual(['skin','muscle','bone','organ','vessel','nerve']);
    expect((await snapshot(page)).dissection).toBe(90);
    await expectDrawn(page,run.url,['lymph']);
    // Muscles as the innermost system: the peel stops at 56%, where every body region keeps a muscle.
    await r.include('muscle').check();
    await expect(r.status).toHaveText('근육 다시 넣음 · 90%까지');
    await expect(r.hint).toBeHidden();
    await expect(r.include('lymph')).not.toHaveAttribute('aria-disabled');
    await r.include('lymph').uncheck();
    await expect.poll(()=>excludedOf(page)).toEqual(['skin','bone','organ','vessel','lymph','nerve']);
    await expect(r.status).toHaveText('림프 뺌 · 56%까지');
    await expect(r.include('muscle')).toHaveAttribute('aria-disabled','true');
    let s=await snapshot(page);expect(s.dissection).toBe(56);expect(s.layers).toEqual(only('muscle'));
    await expect(r.stage).toHaveText('근육');
    const counts=await expectDrawn(page,run.url,['muscle']);expect(counts.muscle).toBeGreaterThan(0);
    await r.slider.fill('100');await ready(page);
    s=await snapshot(page);expect(s.dissection).toBe(56);
    await expectDrawn(page,run.url,['muscle']);
    await expect(r.summaryLines).toHaveText(['6개 계통 뺌','56%까지']);
    expect(run.errors).toEqual([]);
  });

  test('c) a left-out stop is inert and says why, its eye still shows it alone, and the peel entry returns with the exclusion',async({page})=>{
    test.setTimeout(180000);
    const run=await open(page),r=rail(page);
    await settledCamera(page);
    const start=await snapshot(page);
    await r.include('organ').uncheck();await r.include('nerve').uncheck();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ','nerve']);
    await ready(page);
    const before=await snapshot(page);
    // Keyboard: after bone's eye comes organ's check, then its left-out stop,
    // which shows the reason on focus (hover tips work on focus).
    await r.eye('bone').focus();await page.keyboard.press('Tab');
    await expect(r.include('organ')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(r.leftStop('organ')).toBeFocused();
    await expect.poll(async()=>(await tip(r.leftStop('organ'))).opacity).toBe('1');
    const reason='장기 뺌 · 왼쪽 ‘포함’으로 다시 넣기';
    expect((await tip(r.leftStop('organ'))).content).toContain(reason);
    await page.keyboard.press('Enter');
    await expect(r.status).toHaveText(reason);
    await expect(r.rowNote('organ')).toBeVisible();await expect(r.rowNote('organ')).toHaveText(reason);
    // Playwright will not click an aria-disabled control on its own; press it anyway.
    await r.leftStop('organ').click({force:true});
    await ready(page);
    expect(await snapshot(page)).toEqual(before);
    await expect(r.status).toHaveText(reason);
    await expect(r.stop('organ')).toHaveCount(0);
    // The eye is an explicit view: it shows the left-out system on its own.
    await r.eye('organ').click();await ready(page);
    let s=await snapshot(page);
    expect(s.displayMode).toBe('layers');expect(s.layers).toEqual(only('organ'));expect(s.excluded).toEqual(['organ','nerve']);
    await expect(r.eye('organ')).toHaveAttribute('aria-pressed','true');
    await expect(r.nav.locator('.depth-mode')).toHaveText('장기만 보기');
    // The note goes with the mode change; the checks wait for the peel as
    // static swatches in the same column (filled or hollow, never ticked).
    await expect(r.status).toBeEmpty();await expect(r.hint).toBeHidden();
    await expect(r.checks).toHaveCount(0);
    await expect(r.statics).toHaveCount(7);
    // The system this view draws shows as current, not as left out (its stop
    // still cannot peel: the peel leaves it out); the others keep their marks.
    await expectHollow(r,['nerve']);
    await expectKept(r,['skin','muscle','bone','organ','vessel','lymph'],false);
    await expect(r.row('organ')).toHaveClass('active');await expect(r.row('organ').locator('.ax-stop-left')).toHaveCount(0);
    await expect(r.leftStop('organ')).toHaveAttribute('aria-disabled','true');
    // Outside the peel an eye shows its own view as pressed.
    await expect(r.eye('nerve')).toHaveAttribute('aria-pressed','false');
    expectApart(await boxes(r.targets));
    // A left-out stop outside the peel points back to the peel.
    await r.leftStop('nerve').click({force:true});await ready(page);
    await expect(r.status).toHaveText('신경 뺌 · 연속 박리에서 다시 넣기');
    expect((await snapshot(page)).layers).toEqual(only('organ'));
    const organs=await expectDrawn(page,run.url,['organ']);expect(organs.organ).toBeGreaterThan(0);
    sameCamera(s,start);
    const entry=r.nav.getByRole('button',{name:'현재 기준 76.0%에서 연속 박리 시작',exact:true});
    await expect(entry).toHaveText('76.0%에서 연속 박리');
    await entry.click();await ready(page);
    s=await snapshot(page);
    expect(s.displayMode).toBe('dissection');expect(s.dissection).toBe(76);expect(s.excluded).toEqual(['organ','nerve']);
    expect(s.layers).toEqual(only('vessel','lymph'));
    await expect(r.stage).toHaveText('혈관');
    await expect(r.checks).toHaveCount(7);await expect(r.include('organ')).not.toBeChecked();await expect(r.include('nerve')).not.toBeChecked();
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

  test('d) keyboard only: the checks in the stop rows and Alt+Arrow peeling stop at the limit',async({page})=>{
    test.setTimeout(150000);
    const run=await open(page),r=rail(page);
    await settledCamera(page);
    const before=await snapshot(page);
    // From the region: the slider, then check, name and eye of each system in peel order.
    await page.getByLabel('전신 부위 선택',{exact:true}).focus();
    const visited:string[]=[];
    for(let i=0;i<22;i++){await page.keyboard.press('Tab');visited.push(await activeName(page));}
    expect(visited).toEqual(['연속 해부 박리 깊이',...order.flatMap(l=>[`${names[l]} 포함`,`${names[l]}까지 박리`,`${names[l]}만 보기`])]);
    await page.keyboard.press('Shift+Tab');await page.keyboard.press('Shift+Tab');
    await expect(r.include('nerve')).toBeFocused();
    // Its explanation shows on keyboard focus, as on hover.
    await expect.poll(async()=>(await tip(r.keep('nerve'))).opacity).toBe('1');
    expect((await tip(r.keep('nerve'))).content).toContain('신경 빼기 · 어느 깊이에서도 그리지 않음');
    await expect(r.include('nerve')).toHaveAccessibleDescription(/체크를 끄면 그 계통은 박리 깊이와 관계없이 그리지 않습니다/);
    await page.keyboard.press('Space');
    await expect(r.include('nerve')).not.toBeChecked();
    await expect.poll(()=>excludedOf(page)).toEqual(['nerve']);
    await expect(r.status).toHaveText('신경 뺌 · 90%까지');
    await expect(r.include('nerve')).toBeFocused();
    await page.keyboard.press('Space');
    await expect.poll(()=>excludedOf(page)).toEqual([]);
    await expect(r.status).toHaveText('신경 다시 넣음');
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
    await r.include('organ').uncheck();
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
    // The rail's checks belong to the peel: here they are swatches; organs are
    // drawn in this combination, so they are not marked left out.
    await expect(r.checks).toHaveCount(0);await expect(r.statics).toHaveCount(7);await expectKept(r,['organ'],false);
    // Back to the peel: the exclusion applies again.
    await r.nav.getByRole('button',{name:'현재 기준 44.0%에서 연속 박리 시작',exact:true}).click();await ready(page);
    s=await snapshot(page);
    expect(s.displayMode).toBe('dissection');expect(s.dissection).toBe(44);expect(s.excluded).toEqual(['organ']);
    expect(s.layers).toEqual(only('muscle','bone','vessel','lymph','nerve'));
    await expect(r.include('organ')).not.toBeChecked();
    await expectDrawn(page,run.url,['muscle','bone','vessel','lymph','nerve']);
    sameCamera(s,before);expect(preferences(s)).toEqual(preferences(before));
    expect(run.errors).toEqual([]);
  });

  test('f) reload restores the exclusions and the clamp; the female body keeps them',async({page})=>{
    test.setTimeout(240000);
    const run=await open(page),r=rail(page);
    await r.include('organ').uncheck();await r.include('nerve').uncheck();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ','nerve']);
    await r.slider.fill('100');
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(90);
    await page.reload();await ready(page);
    let s=await snapshot(page);
    expect(s.excluded).toEqual(['organ','nerve']);expect(s.displayMode).toBe('dissection');expect(s.dissection).toBe(90);
    expect(s.layers).toEqual(only('lymph'));expect(s.stage).toBe(5);
    await expect(r.summaryLines).toHaveText(['장기·신경 뺌','90%까지']);await expect(r.stage).toHaveText('림프');await expect(r.slider).toHaveValue('90');
    await expect(r.include('organ')).not.toBeChecked();await expect(r.include('nerve')).not.toBeChecked();
    // Restoring is not announced.
    await expect(r.status).toBeEmpty();
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
    await r.include('bone').uncheck();
    await expect.poll(()=>excludedOf(page)).toEqual(['bone','organ','nerve']);
    await expect.poll(async()=>(await drawnNames(page,run.url,'bone')).sort()).toEqual(expect.arrayContaining(['BM0000','BM0001']));
    await r.include('bone').check();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ','nerve']);
    await r.slider.fill('68');
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(68);
    await expectDrawn(page,run.url,['bone','vessel','lymph']);
    // Control: the female organs are drawn at this depth once put back.
    await r.include('organ').check();
    await expect.poll(()=>excludedOf(page)).toEqual(['nerve']);
    const female=await expectDrawn(page,run.url,['bone','organ','vessel','lymph']);expect(female.organ).toBeGreaterThan(0);
    await r.include('organ').uncheck();
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
  test('g) the depth band\'s rows carry the checks with 44px targets; a stop or eye closes it and hands focus back',async({page})=>{
    test.setTimeout(180000);
    const run=await open(page),r=rail(page);
    expect(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches)).toBe(true);
    await r.band.tap();
    await expect(r.band).toHaveAttribute('aria-expanded','true');
    await expect(r.band).toHaveAttribute('aria-controls',await r.steps.getAttribute('id') as string);
    // Touch targets (Q34/Q42): 7 rows of [포함 44][이름][눈 44].
    const targets=await expectPhoneBand(page,r,390,844);
    await expect(r.checks).toHaveCount(7);
    for(const l of order)await expect(r.include(l)).toBeChecked();
    await expectKept(r,order);
    // The band's legend keeps the three roles in one line.
    await expect(r.hint.locator('span')).toHaveText(LEGEND);
    expect(await lineFit(r.hint)).toEqual({lines:1,clipped:false});
    await expectReadable(r.hint);
    // A tap anywhere on the 44px square changes it; the band stays open and nothing moves.
    await r.keep('organ').tap({position:{x:4,y:4}});
    await expect.poll(()=>excludedOf(page)).toEqual(['organ']);
    await expect(r.band).toHaveAttribute('aria-expanded','true');
    expect(geometry(await boxes(r.targets))).toEqual(geometry(targets));
    await expect(r.summary).toHaveText('장기 뺌');
    await expect(r.status).toHaveText('장기 뺌');
    // A result is announced; the legend stays.
    await expect(r.hint.locator('span')).toHaveText(LEGEND);
    await expect(r.band).toHaveAttribute('aria-label','깊이 단계 선택: 0.0% · 체표 · 1개 뺌');
    await expectHollow(r,['organ']);
    await expectDrawn(page,run.url,['skin','muscle','bone','organ','vessel','lymph','nerve']);
    for(const id of await drawnNames(page,run.url,'organ'))expect(SURFACE_ORGANS,id).toContain(id);
    // The left-out stop changes nothing and says why in the hint line.
    const before=await snapshot(page);
    await r.leftStop('organ').tap({force:true});await ready(page);
    expect(await snapshot(page)).toEqual(before);
    await expect(r.band).toHaveAttribute('aria-expanded','true');
    await expect(r.hint).toHaveText('장기 뺌 · 왼쪽 ‘포함’으로 다시 넣기');
    expect(await lineFit(r.hint)).toEqual({lines:1,clipped:false});
    await expect(r.status).toHaveText('장기 뺌 · 왼쪽 ‘포함’으로 다시 넣기');
    await expectReadable(r.nav.locator('.ax-stop-name, .ax-stop-left, .depth-excluded, .depth-band-hint'));
    await page.screenshot({path:`${shots}/phone-band.png`});
    await page.keyboard.press('Escape');
    await expect(r.band).toHaveAttribute('aria-expanded','false');await expect(r.band).toBeFocused();
    expect(await excludedOf(page)).toEqual(['organ']);
    // The note closed with the band.
    await r.band.tap();
    await expect(r.band).toHaveAttribute('aria-expanded','true');
    await expect(r.include('organ')).not.toBeChecked();
    await expect(r.hint.locator('span')).toHaveText(LEGEND);await expect(r.status).toBeEmpty();
    // An eye closes the band; reopened, stops and eyes stay where they were and the checks are swatches.
    const stopsBefore=geometry(await boxes(r.nav.locator('.depth-steps :is(.ax-stop, .ax-solo)')));
    await r.eye('skin').tap();await ready(page);
    await expect(r.band).toHaveAttribute('aria-expanded','false');await expect(r.band).toBeFocused();
    expect((await snapshot(page)).displayMode).toBe('layers');
    await r.band.tap();
    expect(geometry(await boxes(r.nav.locator('.depth-steps :is(.ax-stop, .ax-solo)')))).toEqual(stopsBefore);
    await expect(r.checks).toHaveCount(0);await expect(r.statics).toHaveCount(7);
    await expectHollow(r,['organ']);
    await expect(r.hint).toHaveText('이름: 그 계통까지 박리 · 눈: 그 계통만 보기');
    expect(await noSideScroll(page)).toBe(true);
    // A tool panel opened from the keyboard closes the band.
    await page.getByRole('button',{name:'표시 설정',exact:true}).first().focus();await page.keyboard.press('Enter');
    await expect(page.getByRole('region',{name:'표시 설정',exact:true})).toBeVisible();
    await expect(r.band).toHaveAttribute('aria-expanded','false');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region',{name:'표시 설정',exact:true})).toBeHidden();
    // A stop closes the band too.
    await r.band.tap();await expect(r.band).toHaveAttribute('aria-expanded','true');
    await r.stop('muscle').tap();await ready(page);
    await expect(r.band).toHaveAttribute('aria-expanded','false');await expect(r.band).toBeFocused();
    let s=await snapshot(page);expect(s.displayMode).toBe('dissection');expect(s.dissection).toBe(20);
    // Keyboard: Enter on a stop and Space on an eye close the band, focus
    // returns to the band button and the next Tab goes on to the slider.
    await r.band.focus();await page.keyboard.press('Enter');
    await expect(r.band).toHaveAttribute('aria-expanded','true');
    expect(await tabTo(page,'체표까지 박리')).toEqual(['연속 해부 박리 깊이','체표 포함','체표까지 박리']);
    await page.keyboard.press('Enter');await ready(page);
    await expect(r.band).toHaveAttribute('aria-expanded','false');await expect(r.band).toBeFocused();
    expect((await snapshot(page)).dissection).toBe(0);
    await page.keyboard.press('Tab');await expect(r.slider).toBeFocused();
    await r.band.focus();await page.keyboard.press('Space');
    await expect(r.band).toHaveAttribute('aria-expanded','true');
    await tabTo(page,'체표만 보기');
    await page.keyboard.press('Space');await ready(page);
    await expect(r.band).toHaveAttribute('aria-expanded','false');await expect(r.band).toBeFocused();
    expect((await snapshot(page)).displayMode).toBe('layers');
    await page.keyboard.press('Tab');await expect(r.slider).toBeFocused();
    // The closed row keeps the count and its chevron inside the button; the depth name gives way first.
    await r.slider.fill('37.5');await ready(page);
    s=await snapshot(page);expect(s.displayMode).toBe('dissection');expect(s.excluded).toEqual(['organ']);
    for(const width of [390,360]){
      await page.setViewportSize({width,height:width===390?844:740});
      await expect(r.band.locator('.depth-toggle-count')).toHaveText('1개 뺌');
      const fit=await r.band.evaluate(el=>{const b=el.getBoundingClientRect(),c=el.querySelector('svg')!.getBoundingClientRect(),n=el.querySelector('.depth-toggle-count')!.getBoundingClientRect();
        return {chevron:c.right<=b.right+.5&&c.left>=b.left-.5,count:n.right<=b.right+.5};});
      expect(fit,`${width}px`).toEqual({chevron:true,count:true});
      await expectReadable(r.band.locator('.depth-toggle-count'));
    }
    // Opening the band closes a tool panel that would sit under it; the toggle stays 44px tall.
    await page.setViewportSize({width:390,height:844});
    await openTool(page,'표시 설정');await expect(page.locator('.ax')).toHaveAttribute('data-panel','display');
    await r.band.tap();
    await expect(page.locator('.ax')).toHaveAttribute('data-panel','none');await expect(r.band).toHaveAttribute('aria-expanded','true');
    expect((await boxes(r.band))[0].h).toBeGreaterThanOrEqual(44);
    await r.band.tap();
    expect(run.errors).toEqual([]);
  });
});

test.describe('phone 360×740 touch',()=>{
  test.use({viewport:{width:360,height:740},hasTouch:true});
  test('g2) the narrow band keeps 44px targets and one-line notes',async({page})=>{
    test.setTimeout(180000);
    const run=await open(page),r=rail(page);
    await r.band.tap();await expect(r.band).toHaveAttribute('aria-expanded','true');
    await expectPhoneBand(page,r,360,740);
    await expect(r.hint.locator('span')).toHaveText(LEGEND);
    expect(await lineFit(r.hint),'legend').toEqual({lines:1,clipped:false});
    await r.include('organ').tap();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ']);
    await expect(r.summary).toHaveText('장기 뺌');
    await expectReadable(r.nav.locator('.ax-stop-name, .ax-stop-left, .depth-excluded, .depth-band-hint'));
    await page.screenshot({path:`${shots}/phone-band-360.png`});
    // While one system is left, the line says it cannot be left out.
    for(const l of ['skin','muscle','bone','vessel','lymph'] as const)await r.include(l).tap();
    await expect.poll(()=>excludedOf(page)).toEqual(['skin','muscle','bone','organ','vessel','lymph']);
    await expect(r.band).toHaveAttribute('aria-expanded','true');
    await expect(r.hint).toHaveText(LAST);
    expect(await lineFit(r.hint),'last-system note').toEqual({lines:1,clipped:false});
    await expect(r.include('nerve')).toHaveAttribute('aria-disabled','true');
    await r.include('nerve').tap({force:true});await ready(page);
    await expect(r.include('nerve')).toBeChecked();await expect(r.status).toHaveText(LAST);
    expect(await excludedOf(page)).toEqual(['skin','muscle','bone','organ','vessel','lymph']);
    await r.leftStop('organ').tap({force:true});
    await expect(r.hint).toHaveText('장기 뺌 · 왼쪽 ‘포함’으로 다시 넣기');
    expect(await lineFit(r.hint),'left-out stop note').toEqual({lines:1,clipped:false});
    await expectPhoneBand(page,r,360,740);
    expect(run.errors).toEqual([]);
  });
  test('g2b) a comparison takes the narrow band\'s hint line (not stacked), within 45%',async({page})=>{
    test.setTimeout(150000);
    const run=await open(page,'#atlas/CV12'),r=rail(page);
    await compare(page);
    await expect(r.nav).toHaveAttribute('data-compare','true');
    await r.band.tap();await expect(r.band).toHaveAttribute('aria-expanded','true');
    await expect(r.bandBox.locator('.panel-comparison-note')).toBeVisible();
    await expect(r.bandBox.locator('.panel-comparison-note')).toContainText('전통적 대응, 압력 경로 아님');
    await expect(r.hint).toHaveCount(0);
    await expectPhoneBand(page,r,360,740);
    await expectReadable(r.bandBox.locator('.panel-comparison-note'));
    expect(run.errors).toEqual([]);
  });
});

test.describe('short landscape 844×390 touch',()=>{
  test.use({viewport:{width:844,height:390},hasTouch:true});
  test('h) the rail keeps region, 깊이 단계 and slider; the rows open in a 4×2 band beside it',async({page})=>{
    test.setTimeout(240000);
    const run=await open(page),r=rail(page);
    expect(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches)).toBe(true);
    // A front cutaway, so its reset button is on screen and must step aside for the band.
    await openTool(page,'표시 설정');await page.getByLabel('앞쪽 구조 일부 숨기기',{exact:true}).fill('0.5');await closeTool(page);
    await expect(page.locator('.cutaway-reset')).toBeVisible();
    // Closed: the toggle replaces the heading and the stops on the short rail.
    const [nav]=await boxes(r.nav),[toggle]=await boxes(r.band);
    expect(toggle.w).toBeGreaterThanOrEqual(44);expect(toggle.h).toBeGreaterThanOrEqual(44);
    expectInside(toggle,nav,'toggle');
    await expectReadable(r.band.locator('.depth-toggle-text'));
    // The heading leaves the screen but stays a live region (depth changes from the canvas are announced).
    expect(await r.bandBox.evaluate(el=>el.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
    await expect(r.nav.locator('.depth-heading strong[aria-live="polite"]')).toHaveCount(1);
    await expect(r.steps).toBeHidden();
    const railFits=async(what:string)=>{
      const [n]=await boxes(r.nav),[track]=await boxes(r.nav.locator('.ax-depth-track'));
      expectInside(track,n,`${what}: track`);
      for(const b of await visibleBoxes(page.locator('.ax-status .scene-status')))expect(overlaps(n,b),`${what}: rail × status`).toBe(false);
    };
    await railFits('closed');
    // Open: seven rows of [포함 44][이름][눈 44] and the legend in cell 8.
    await r.band.tap();
    await expect(r.band).toHaveAttribute('aria-expanded','true');
    const targets=await expectLandscapeBand(page,r,844,390);
    await expect(r.checks).toHaveCount(7);await expectKept(r,order);
    const legend=r.aside.locator('p');
    await expect(legend.locator('span')).toHaveText(LEGEND);
    expect(await lineFit(legend)).toEqual({lines:3,clipped:false});
    await expectReadable(legend);
    await expectReadable(r.nav.locator('.depth-steps .ax-stop-name'));
    // A check changes the peel; the band stays open and nothing moves.
    await r.include('organ').tap();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ']);
    await expect(r.band).toHaveAttribute('aria-expanded','true');
    expect(geometry(await boxes(r.targets))).toEqual(geometry(targets));
    await expect(r.band.locator('.depth-toggle-count')).toHaveText('1개 뺌');await expectReadable(r.band.locator('.depth-toggle-count'));
    await expect(r.status).toHaveText('장기 뺌');
    await expect(legend.locator('span')).toHaveText(LEGEND);
    await expectHollow(r,['organ']);
    await page.screenshot({path:`${shots}/landscape-steps.png`});
    // The left-out stop's reason opens as a row above the cells; the legend stays in cell 8.
    const before=await snapshot(page);
    await r.leftStop('organ').tap({force:true});await ready(page);
    expect(await snapshot(page)).toEqual(before);
    const reasonRow=r.steps.locator('.depth-steps-note .depth-band-hint');
    await expect(reasonRow).toHaveText('장기 뺌 · 왼쪽 ‘포함’으로 다시 넣기');
    expect((await lineFit(reasonRow)).clipped).toBe(false);
    await expectReadable(reasonRow);
    await expect(legend.locator('span')).toHaveText(LEGEND);
    const [stepsBox]=await boxes(r.steps);const [canvasBox]=await boxes(page.locator('canvas'));
    expect(stepsBox.h/canvasBox.h,'band with a reason within 45%').toBeLessThanOrEqual(0.45);
    await page.keyboard.press('Escape');
    await expect(r.band).toHaveAttribute('aria-expanded','false');await expect(r.band).toBeFocused();
    await expect(page.locator('.ax-inspector')).toHaveCSS('visibility','visible');
    await expect(page.locator('.cutaway-reset')).toBeVisible();
    // A one-system view from the band: the band closes and the rail stays inside its panel.
    await r.band.tap();
    await r.eye('skin').tap();await ready(page);
    expect((await snapshot(page)).displayMode).toBe('layers');
    await expect(r.band).toHaveAttribute('aria-expanded','false');await expect(r.band).toBeFocused();
    await expect(r.band.locator('.depth-toggle-text')).toHaveText('체표만 보기');
    await railFits('one-system view');
    // Reopened outside the peel: swatches, and the peel entry in cell 8 that keeps the band open.
    await r.band.tap();await expect(r.band).toHaveAttribute('aria-expanded','true');
    await expect(r.checks).toHaveCount(0);await expect(r.statics).toHaveCount(7);
    const entry=r.aside.getByRole('button',{name:'현재 기준 0.0%에서 연속 박리 시작',exact:true});
    await expect(entry).toHaveText('0.0%에서 연속 박리');
    await expectReadable(entry);
    await entry.tap();await ready(page);
    expect((await snapshot(page)).displayMode).toBe('dissection');
    await expect(r.band).toHaveAttribute('aria-expanded','true');await expect(r.slider).toBeFocused();
    await expect(r.checks).toHaveCount(7);
    // Keyboard: Enter on an eye and Space on a stop close the band, focus
    // returns to the band button and the next Tab goes on to the slider.
    await r.eye('bone').focus();await page.keyboard.press('Enter');await ready(page);
    await expect(r.band).toHaveAttribute('aria-expanded','false');await expect(r.band).toBeFocused();
    expect((await snapshot(page)).layers).toEqual(only('bone'));
    await page.keyboard.press('Tab');await expect(r.slider).toBeFocused();
    await r.band.focus();await page.keyboard.press('Space');
    await expect(r.band).toHaveAttribute('aria-expanded','true');
    await r.stop('muscle').focus();await page.keyboard.press('Space');await ready(page);
    await expect(r.band).toHaveAttribute('aria-expanded','false');await expect(r.band).toBeFocused();
    let s=await snapshot(page);expect(s.displayMode).toBe('dissection');expect(s.dissection).toBe(20);
    await page.keyboard.press('Tab');await expect(r.slider).toBeFocused();
    await railFits('after the keyboard runs');
    // Smaller landscape phones: the same band, every target 44px; a reason row keeps it within 45%.
    for(const [width,height,minName] of [[740,360,44],[710,360,44],[701,360,44]] as const){
      await page.setViewportSize({width,height});
      await expect(r.band).toBeVisible();
      await r.band.tap();await expect(r.band).toHaveAttribute('aria-expanded','true');
      await expectLandscapeBand(page,r,width,height,minName);
      expect((await lineFit(legend)).clipped,`${width}: legend`).toBe(false);
      await expectReadable(r.nav.locator('.depth-steps .ax-stop-name'));
      await r.leftStop('organ').tap({force:true});
      await expect(r.steps.locator('.depth-steps-note .depth-band-hint')).toHaveText('장기 뺌 · 왼쪽 ‘포함’으로 다시 넣기');
      const [withReason]=await boxes(r.steps),[cv]=await boxes(page.locator('canvas'));
      expect(withReason.h/cv.h,`${width}: band with a reason`).toBeLessThanOrEqual(0.45);
      await page.keyboard.press('Escape');await expect(r.band).toHaveAttribute('aria-expanded','false');
      await railFits(`${width}×${height}`);
    }
    s=await snapshot(page);expect(s.excluded).toEqual(['organ']);
    expect(run.errors).toEqual([]);
  });

  test('h2) a comparison adds its notice on top of the landscape band, within 45%',async({page})=>{
    test.setTimeout(180000);
    const run=await open(page,'#atlas/CV12'),r=rail(page);
    await compare(page);
    await expect(page.locator('.ax-inspector .selection-card')).toBeVisible();
    for(const [width,height] of [[844,390],[740,360]] as const){
      await page.setViewportSize({width,height});
      await expect(r.band).toBeVisible();
      await r.band.tap();await expect(r.band).toHaveAttribute('aria-expanded','true');
      await expect(r.nav).toHaveAttribute('data-compare','true');
      const note=r.steps.locator('.depth-steps-note .panel-comparison-note');
      await expect(note).toBeVisible();await expect(note).toContainText('전통적 대응, 압력 경로 아님');
      await expectReadable(note);
      await expectLandscapeBand(page,r,width,height);
      const [n]=await boxes(note);
      for(const t of await boxes(r.targets))expect(overlaps(n,t),`${width}: notice × ${t.text}`).toBe(false);
      await expect(r.aside.getByRole('button',{name:/에서 연속 박리 시작$/})).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(r.band).toHaveAttribute('aria-expanded','false');
      await expect(page.locator('.ax-inspector .selection-card')).toBeVisible();
    }
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
    for(const l of ['bone','organ','vessel','lymph','nerve'] as const)await r.include(l).uncheck();
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
    await r.include('bone').check();await r.include('organ').check();
    await expect.poll(()=>excludedOf(page)).toEqual(['vessel','lymph','nerve']);
    await expect(r.status).toHaveText('장기 다시 넣음 · 68%까지');
    await r.slider.fill('100');await ready(page);
    let s=await snapshot(page);expect(s.dissection).toBe(68);
    await expect(r.summaryLines).toHaveText(['혈관·림프·신경 뺌','68%까지']);
    await expect.poll(async()=>(await drawn(page,run.url)).bone).toBeGreaterThan(0);
    await r.leftStop('vessel').click({force:true});
    await expect(r.rowNote('vessel')).toBeVisible();await expect(r.rowNote('vessel')).toHaveText('혈관 뺌 · 왼쪽 ‘포함’으로 다시 넣기');
    // A region change clears the notes (the arm's 68% would be wrong in the abdomen) and announces nothing.
    await page.getByLabel('전신 부위 선택',{exact:true}).selectOption('abdomen');await ready(page);
    await expect(r.status).toBeEmpty();await expect(r.rowNotes).toHaveCount(0);
    await r.slider.fill('100');await ready(page);
    s=await snapshot(page);expect(s.dissection).toBe(76);
    await expect(r.summaryLines).toHaveText(['혈관·림프·신경 뺌','76%까지']);
    await expect.poll(async()=>(await drawn(page,run.url)).organ).toBeGreaterThan(0);
    // Back to the arm: the region change itself re-clamps the peel.
    await page.getByLabel('전신 부위 선택',{exact:true}).selectOption('upper-limb');await ready(page);
    s=await snapshot(page);expect(s.dissection).toBe(68);expect(s.displayMode).toBe('dissection');
    await expect(r.status).toBeEmpty();
    await expect.poll(async()=>(await drawn(page,run.url)).bone).toBeGreaterThan(0);
    expect(run.errors).toEqual([]);
  });
});

// Touch tablets and short windows: the rail keeps its 21 targets apart with
// the checks in its rows, on screen and clear of other tools; a reason opens beside it.
for(const [width,height,touch] of [[1024,768,true],[1280,720,true],[1024,680,true],[768,1024,true],[1180,580,false],[1366,768,false]] as const){
  test.describe(`rail ${width}×${height}${touch?' touch':''}`,()=>{
    test.use({viewport:{width,height},hasTouch:touch});
    test('j) stops stay apart with systems left out, and the checks fit the rail',async({page})=>{
      test.setTimeout(150000);
      const run=await open(page),r=rail(page);
      const press=(l:Locator,force=false)=>touch?l.tap({force}):l.click({force});
      const short=touch&&height<=700;
      const stopsApart=async(what:string)=>{
        const rows=await boxes(r.nav.locator('.depth-steps li'));
        expect(rows,what).toHaveLength(7);
        for(let i=1;i<rows.length;i++)expect(rows[i].y-(rows[i-1].y+rows[i-1].h),`${what}: ${order[i-1]}/${order[i]} gap`).toBeGreaterThanOrEqual(-.5);
        const [band]=await boxes(r.bandBox);
        expect(rows[0].y,`${what}: first stop under the band`).toBeGreaterThanOrEqual(band.y+band.h-.5);
        const [nav]=await boxes(r.nav);for(const row of rows)expectInside(row,nav,`${what} row`);
        return rows;
      };
      await stopsApart('nothing left out');
      await expectColumns(r);
      if(short)await expect(r.caption).toBeHidden();
      else {await expect(r.caption).toBeVisible();await expectReadable(r.caption);}
      for(const l of ['skin','bone','organ','vessel','lymph','nerve'] as const)await press(r.include(l));
      await expect.poll(()=>excludedOf(page)).toEqual(['skin','bone','organ','vessel','lymph','nerve']);
      // Every check is its own target: the centre of each hits that check.
      for(const l of order){
        const hit=await r.include(l).evaluate(el=>{const b=el.getBoundingClientRect(),t=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return t===el||el.closest('label')!.contains(t);});
        expect(hit,`${names[l]} 포함 centre`).toBe(true);
      }
      const targets=await boxes(r.targets);expect(targets).toHaveLength(21);expectApart(targets);
      if(touch)for(const t of targets){expect(t.h,`${t.text} height`).toBeGreaterThanOrEqual(44);expect(t.w,`${t.text} width`).toBeGreaterThanOrEqual(44);}
      // A name keeps one line ("뺌" takes a second on touch) and never overflows
      // its button. (scrollWidth would count the button's own hidden tooltip.)
      for(const name of await r.nav.locator('.depth-steps .ax-stop-name').all())expect((await lineFit(name)).lines,`${await name.textContent()} lines`).toBe(1);
      for(const fit of await r.nav.locator('.depth-steps .ax-stop').evaluateAll(els=>els.map(el=>{
        const b=el.getBoundingClientRect();
        return {name:el.getAttribute('aria-label'),fits:[...el.children].every(c=>{const r=c.getBoundingClientRect();return r.left>=b.left-.5&&r.right<=b.right+.5&&r.top>=b.top-.5&&r.bottom<=b.bottom+.5;})};
      })))expect(fit.fits,`${fit.name} fits`).toBe(true);
      const [nav]=await boxes(r.nav);
      expectInside(nav,{x:0,y:0,w:width,h:height},'rail');
      await expectClearOfTools(page,nav,'rail');
      const rows=await stopsApart('one kept');
      await expectReadable(r.nav.locator('.depth-steps .ax-stop-name, .depth-steps .ax-stop-left'));
      // The last kept check refuses and the reason opens beside the rail, without moving the stops.
      await expect(r.include('muscle')).toHaveAttribute('aria-disabled','true');
      await press(r.include('muscle'),true);await ready(page);
      await expect(r.include('muscle')).toBeChecked();
      expect(await excludedOf(page)).toEqual(['skin','bone','organ','vessel','lymph','nerve']);
      await expect(r.status).toHaveText(LAST);
      const reasonBeside=async(text:string,l:System)=>{
        const note=r.rowNote(l);
        await expect(note).toBeVisible();await expect(note).toHaveText(text);
        const [box]=await boxes(note),[li]=await boxes(r.row(l));
        expect(box.x,`${text}: beside the rail`).toBeGreaterThanOrEqual(nav.x+nav.w);
        // Level with the row it is about.
        expect(Math.abs((box.y+box.h/2)-(li.y+li.h/2)),`${text}: at its row`).toBeLessThanOrEqual(1.5);
        expectInside(box,{x:0,y:0,w:width,h:height},text);
        await expectClearOfTools(page,box,text);
        await expectReadable(note);
        expect(geometry(await boxes(r.nav.locator('.depth-steps li')))).toEqual(geometry(rows));
      };
      await reasonBeside(LAST,'muscle');
      await press(r.leftStop('organ'),true);await ready(page);
      await reasonBeside('장기 뺌 · 왼쪽 ‘포함’으로 다시 넣기','organ');
      // Transient: a pointer outside the depth group hides it (the status keeps the text).
      await page.mouse.click(Math.round(width*0.6),Math.round(height*0.5));
      await expect(r.rowNotes).toHaveCount(0);await expect(r.status).toHaveText('장기 뺌 · 왼쪽 ‘포함’으로 다시 넣기');
      await press(r.include('skin'));
      await expect.poll(()=>excludedOf(page)).toEqual(['bone','organ','vessel','lymph','nerve']);
      await expect(r.status).toHaveText('체표 다시 넣음 · 56%까지');
      await expect(r.rowNotes).toHaveCount(0);
      await stopsApart('five left out');
      if(short)await expect(r.summary).toBeHidden();
      else {await expect(r.summaryLines).toHaveText(['5개 계통 뺌','56%까지']);await expectReadable(r.summaryLines);}
      await expect(r.cols).toBeVisible();
      expect(await noSideScroll(page)).toBe(true);
      if(width===1024&&height===768)await page.screenshot({path:`${shots}/tablet-rail.png`});
      expect(run.errors).toEqual([]);
    });
  });
}

test.describe('desktop 1440×900 keys and click target',()=>{
  test.use({viewport:{width:1440,height:900}});
  test('k) Escape on a check changes nothing; a band left open across a resize does not hold Escape; presenting ends in one press',async({page})=>{
    test.setTimeout(150000);
    const run=await open(page),r=rail(page);
    await r.include('organ').uncheck();
    await expect.poll(()=>excludedOf(page)).toEqual(['organ']);
    await ready(page);
    const before=await snapshot(page);
    await r.eye('bone').focus();await page.keyboard.press('Tab');
    await expect(r.include('organ')).toBeFocused();
    await page.keyboard.press('Escape');await ready(page);
    expect(await snapshot(page)).toEqual(before);
    await expect(r.include('organ')).toBeFocused();
    // A reason beside the rail does not hold Escape from a search opened over it.
    await page.keyboard.press('Tab');await expect(r.leftStop('organ')).toBeFocused();
    await page.keyboard.press('Enter');await expect(r.rowNote('organ')).toBeVisible();
    await page.keyboard.press('/');await expect(page.getByRole('region',{name:'검색 결과',exact:true})).toBeVisible();
    await expect(r.rowNotes).toHaveCount(0);
    await page.keyboard.press('Escape');await expect(page.getByRole('region',{name:'검색 결과',exact:true})).toBeHidden();
    await expect(r.leftStop('organ')).toBeFocused();
    // The landscape band, left open while the window grows into a rail, does
    // not hold Escape: it is cleared without moving focus.
    const canvas=page.locator('canvas');
    const leaveOpenAndGrow=async()=>{
      await page.setViewportSize({width:844,height:390});
      await expect(r.band).toBeVisible();
      await r.band.click();await expect(r.nav).toHaveAttribute('data-open','true');
      await page.setViewportSize({width:1440,height:900});
      await expect(r.band).toBeHidden();
      await canvas.focus();await expect(canvas).toBeFocused();
    };
    await leaveOpenAndGrow();
    await page.keyboard.press('Escape');
    await expect(r.nav).toHaveAttribute('data-open','false');
    await expect(canvas).toBeFocused();
    // The search opened over it closes with one Escape.
    await leaveOpenAndGrow();
    await page.keyboard.press('/');
    await expect(page.getByRole('region',{name:'검색 결과',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region',{name:'검색 결과',exact:true})).toBeHidden();
    await expect(r.nav).toHaveAttribute('data-open','false');
    await expect(canvas).toBeFocused();
    // Presenting ends with one Escape.
    await page.getByRole('button',{name:'발표 보기',exact:true}).click();
    await expect(page.locator('.ax')).toHaveAttribute('data-present','true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.ax')).toHaveAttribute('data-present','false');
    expect(await excludedOf(page)).toEqual(['organ']);
    expect(run.errors).toEqual([]);
  });

  test('l) with the click target set to internal structures, the male face keeps its ears, lips and eyes',async({page})=>{
    test.setTimeout(150000);
    const run=await open(page),r=rail(page);
    await openTool(page,'표시 설정');
    await page.getByLabel('클릭 선택 대상').selectOption('internal');
    await closeTool(page);
    await r.include('organ').uncheck();
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
