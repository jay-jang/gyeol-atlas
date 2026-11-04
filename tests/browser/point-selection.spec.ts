import {test,expect,type Page} from '@playwright/test';
import {ready,choosePoint,openTool,closeTool,compare,snapshot,settledCamera} from './helpers';
const key='gyeol-last-point-v1';
const memory=(page:Page)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);

for(const [name,width,height,touch] of [['desktop',1440,900,false],['mobile',390,844,true],['small-mobile',360,740,true],['landscape',844,390,true]] as const){
 test.describe(name,()=>{
  test.use({viewport:{width,height},hasTouch:touch});
  test('clear selection keeps the camera, filters and last point without a selected label',async({page})=>{
   const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('/');await ready(page);
   await expect(page.locator('.ax-point-empty')).toBeVisible();
   await expect(page.locator('.point-label.active')).toHaveCount(0);
   await choosePoint(page,'EX-LE12');await settledCamera(page);
   await expect.poll(()=>memory(page)).toEqual({version:1,pointId:'EX-LE12'});
   const before=await snapshot(page),chip=page.locator('.ax-point-chip');
   const bounds=await chip.boundingBox();
   const nameBox=await chip.locator('.point-summary strong').evaluate(el=>({visible:el.clientWidth,needed:el.scrollWidth}));
   expect(nameBox.needed).toBeLessThanOrEqual(nameBox.visible+1);

   for(const button of await chip.locator('button').all()){
    const box=await button.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(bounds!.x-.5);expect(box!.x+box!.width).toBeLessThanOrEqual(bounds!.x+bounds!.width+.5);
   }
   const clear=page.getByRole('button',{name:'경혈 선택 해제',exact:true});
   if(touch){const box=await clear.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);}
   await page.mouse.move(1,1);await page.screenshot({path:`docs/point-selection-memory/${name}-selected.png`});
   if(touch)await clear.tap();else{await clear.focus();await clear.press('Enter');}
   await expect(page.locator('.ax-point-empty')).toBeVisible();await expect(page.locator('.ax-point-empty')).toBeFocused();
   await expect(page).toHaveURL(/#atlas$/);await expect(page.locator('.point-label.active')).toHaveCount(0);
   const after=await snapshot(page);
   expect(after.pointId).toBe('');for(const k of ['camera','markers','labels','markerColor','filters','layers','dissection'])expect(after[k]).toEqual(before[k]);
   await expect.poll(()=>memory(page)).toEqual({version:1,pointId:'EX-LE12'});
   await page.mouse.move(1,1);await page.screenshot({path:`docs/point-selection-memory/${name}-cleared.png`});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.reload();await ready(page);await expect(page.locator('.ax-point-empty')).toBeVisible();
   await page.getByRole('link',{name:'지식 위키',exact:true}).click();await page.getByRole('link',{name:/3D 보기로 돌아가기/}).click();await ready(page);
   await expect(page.locator('.ax-point-empty')).toBeVisible();expect((await snapshot(page)).pointId).toBe('');expect(errors).toEqual([]);
  });
 });
}

test('closing the tab and returning with only local storage restores the last selected point; a new choice replaces it',async({page,browser,baseURL})=>{
 await page.goto('/');await ready(page);await choosePoint(page,'KI3');
 await expect.poll(()=>memory(page)).toEqual({version:1,pointId:'KI3'});
 await page.getByRole('button',{name:'경혈 선택 해제',exact:true}).click();
 await expect(page.locator('.ax-point-empty')).toBeVisible();
 const storage=await page.context().storageState();await page.close();
 const next=await browser.newContext({storageState:storage,reducedMotion:'reduce'});
 try{
  const p=await next.newPage();await p.goto(baseURL!+'/');await ready(p);
  await expect(p.locator('.point-summary')).toContainText('KI3');expect((await snapshot(p)).pointId).toBe('KI3');
  await choosePoint(p,'ST36');await expect.poll(()=>memory(p)).toEqual({version:1,pointId:'ST36'});
 }finally{await next.close();}
});

test('an explicit point link wins over cached/session choices; wiki-only visits still download no 3D',async({page})=>{
 await page.goto('/#wiki');await page.evaluate(k=>{localStorage.setItem(k,JSON.stringify({version:1,pointId:'KI3'}));sessionStorage.removeItem('gyeol-view-v2');},key);
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.reload();
 await expect(page.getByRole('link',{name:/태계 3D 보기로 돌아가기/})).toBeVisible();
 expect(requests.filter(url=>/\.glb|\.bin\.gz|\/Atlas(\.tsx|-[\w-]+\.js)/.test(url))).toEqual([]);
 await page.goto('/#atlas/ST36');await ready(page);
 await expect(page.locator('.point-summary')).toContainText('ST36');await expect.poll(()=>memory(page)).toEqual({version:1,pointId:'ST36'});
});

test('clear ends an isolated point comparison but leaves an independent anatomy selection intact',async({page})=>{
 await page.goto('/#atlas/CV12');await ready(page);await compare(page);
 await page.getByRole('button',{name:'비교 대상만 보기',exact:true}).click();await ready(page);await settledCamera(page);
 const pose=(await snapshot(page)).camera;
 await page.getByRole('button',{name:'경혈 선택 해제',exact:true}).click();await ready(page);
 const cleared=await snapshot(page);expect(cleared.pointId).toBe('');expect(cleared.comparison).toBe(null);expect(cleared.selection).toBe(null);expect(cleared.isolated).toBe(false);expect(cleared.camera).toEqual(pose);
 await choosePoint(page,'KI3');
 const search=page.getByLabel('경혈·구조 검색');await search.click();await search.fill('FMA7148');
 await page.locator('.structure-item').filter({hasText:'FMA7148'}).first().click();await ready(page);await settledCamera(page);
 const selected=await snapshot(page);await page.getByRole('button',{name:'경혈 선택 해제',exact:true}).click();
 const after=await snapshot(page);expect(after.pointId).toBe('');expect(after.selection).toEqual(selected.selection);expect(after.camera).toEqual(selected.camera);
 await expect(page.getByRole('button',{name:'구조 선택 해제',exact:true})).toBeVisible();
});

test('bad or blocked local storage falls back to an empty selection and still allows clearing',async({page})=>{
 await page.goto('/#wiki');
 await page.evaluate(()=>{localStorage.setItem('gyeol-last-point-v1','{"version":1,"pointId":"FAKE"}');sessionStorage.removeItem('gyeol-view-v2');});
 await page.goto('/');await ready(page);await expect(page.locator('.ax-point-empty')).toBeVisible();
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('disabled','SecurityError');}}));
 await page.reload();await ready(page);await choosePoint(page,'KI3');await page.getByRole('button',{name:'경혈 선택 해제',exact:true}).click();await expect(page.locator('.ax-point-empty')).toBeVisible();
});
