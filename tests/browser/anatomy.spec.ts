import {test,expect} from '@playwright/test';
import {ready,openTool,choosePoint,compare,closeTool,snapshot} from './helpers';
import assets from '../../scripts/model-inputs.json' with {type:'json'};
test('explore catalogue exposes all systems and featured brain and organs',async({page})=>{
 await page.goto('/');await ready(page);
 await expect(page.getByRole('heading',{name:'인체 탐색'})).toBeVisible();
 const depth=page.getByLabel('인체 계통 깊이');await depth.fill('5');await ready(page);expect((await snapshot(page)).stage).toBe(5);await expect(depth).toHaveAttribute('aria-valuetext','6단계 신경');
 const featured=page.locator('.featured-anatomy > button');await expect(featured).toHaveCount(6);for(const name of ['뇌','심장','폐','간','위','콩팥']) await expect(featured.filter({hasText:name})).toBeVisible();
 await featured.filter({hasText:'뇌'}).click();await ready(page);let s=await snapshot(page);expect(s.layers.nerve).toBe(true);expect(s.selection.name).toBe('뇌');expect(s.selection.ids).toHaveLength(5);
 await page.getByRole('button',{name:'전체 켜기'}).click();await ready(page);s=await snapshot(page);expect(Object.values(s.layers).every(Boolean)).toBe(true);expect(s.selection).toBe(null);
});
test('six real systems and shared layer/isolation transitions; clipping and bilingual structure selection',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];const glbs=new Set<string>();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().endsWith('.glb')&&r.ok())glbs.add(r.url().split('/').pop()!);});await page.goto('/');await ready(page);
 for(const name of ['체표','근육','골격','장기','혈관','신경']){await page.getByRole('button',{name:`${name} 단계`,exact:true}).click();await ready(page);await page.getByRole('button',{name:'계통 전체 보기',exact:true}).click();await page.locator('canvas').screenshot({path:`docs/ui-renewal/system-${name}.png`});}expect([...glbs].sort()).toEqual(['bone.glb','muscle.glb','nerve-full.glb','nerve.glb','organ.glb','skin.glb','vessel-full.glb','vessel.glb']);
 await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill('stomach');await page.locator('.structure-item').filter({hasText:'FMA7148'}).click();await closeTool(page);await page.getByRole('button',{name:'선택 구조만 보기',exact:true}).click();await expect.poll(async()=>(await snapshot(page)).isolated).toBe(true);
 await openTool(page,'레이어 조절');await page.getByLabel('장기 레이어',{exact:true}).uncheck();await page.getByLabel('근육 레이어',{exact:true}).check();await ready(page);expect((await snapshot(page)).isolated).toBe(false);await expect(page.locator('.selection-card')).toHaveCount(0);await closeTool(page);await page.locator('canvas').screenshot({path:'docs/ui-renewal/isolation-regression.png'});
 await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill('대퇴골');await expect(page.locator('.structure-item')).toHaveCount(2);await page.getByLabel('해부 구조 검색').fill('FMA7148');await page.locator('.structure-item').click();await page.getByRole('button',{name:'선택 구조 확대',exact:true}).click();await page.getByRole('button',{name:'선택 구조만 보기',exact:true}).click();const before=await page.locator('canvas').screenshot();await openTool(page,'레이어 조절');await page.getByLabel('앞쪽 구조 일부 숨기기',{exact:true}).fill('0.5');await closeTool(page);const after=await page.locator('canvas').screenshot({path:'docs/ui-renewal/cutaway.png'});expect(before.equals(after)).toBe(false);await page.getByRole('button',{name:'앞쪽 구조 숨김 적용 · 초기화'}).click();expect((await snapshot(page)).cutaway).toBe(0);expect(errors).toEqual([]);
});
test('hand and foot phalanges are searchable, selectable and frameable',async({page})=>{
 await page.goto('/');await ready(page);
 for(const query of ['엄지손가락 끝마디뼈','엄지발가락 끝마디뼈']){
  await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill(query);await expect(page.locator('.structure-item')).toHaveCount(2);await page.locator('.structure-item').first().click();await expect(page.locator('.selection-card')).toContainText(query);await page.locator('.selection-card').getByRole('button',{name:'확대',exact:true}).click();expect((await snapshot(page)).selection.ids).toHaveLength(1);
 }
});
test('point focus and marker preference survive stage changes',async({page})=>{
 await page.goto('/#atlas/ST36');await ready(page);await page.getByRole('button',{name:'선택 경혈 확대'}).click();await expect.poll(async()=>(await snapshot(page)).camera.position[2]).toBeLessThan(1.5);const before=(await snapshot(page)).camera;await page.getByRole('button',{name:'골격 단계'}).click();await ready(page);expect((await snapshot(page)).camera).toEqual(before);expect((await snapshot(page)).markers).toBe('selected');await page.locator('canvas').screenshot({path:'docs/ui-renewal/preserved-knee.png'});
 await openTool(page,'레이어 조절');await page.getByLabel('경혈 표식',{exact:true}).selectOption('hidden');await closeTool(page);await page.getByRole('button',{name:'근육 단계'}).click();await ready(page);expect((await snapshot(page)).markers).toBe('hidden');await expect(page.locator('.point-label')).toHaveCount(0);
});
test('whole-organ bundles, internal click targeting and wiki/session restoration',async({page})=>{
 await page.goto('/#atlas/KI3');await ready(page);await compare(page);await expect(page.locator('.selection-card')).toContainText('2개 구조');await page.getByRole('button',{name:'비교 대상만 보기'}).click();let s=await snapshot(page);expect(s.selection.ids.sort()).toEqual(['FMA7204','FMA7205']);expect(s.isolated).toBe(true);await page.locator('.selection-card').getByRole('button',{name:'확대',exact:true}).click();await page.locator('canvas').screenshot({path:'docs/ui-renewal/kidney-bundle.png'});
 await page.locator('.point-summary').click();await page.getByRole('link',{name:'마사지 전 해부학 참고 가이드 ↗'}).click();await expect(page.locator('canvas')).toHaveCount(0);await page.getByRole('link',{name:/태계 3D 보기로 돌아가기/}).click();await ready(page);s=await snapshot(page);expect(s.pointId).toBe('KI3');expect(s.selection.ids).toHaveLength(2);expect(s.isolated).toBe(true);const pose=s.camera;await page.reload();await ready(page);for (const key of ["position","target"] as const) for (let i=0;i<3;i++) expect((await snapshot(page)).camera[key][i]).toBeCloseTo(pose[key][i], 8);
 await choosePoint(page,'LU9');await compare(page);expect((await snapshot(page)).selection.ids).toHaveLength(5);
 await choosePoint(page,'CV12');await compare(page);const canvas=page.locator('canvas');const box=await canvas.boundingBox();await canvas.click({position:{x:box!.width*.52,y:box!.height*.48}});s=await snapshot(page);expect(s.selection.kind).toBe('structure');expect(assets.assets.find(a=>a.id===s.selection.ids[0])?.layer).toBe('organ');
 await openTool(page,'레이어 조절');await page.getByLabel('클릭 선택 대상').selectOption('skin');await closeTool(page);await canvas.click({position:{x:box!.width*.52,y:box!.height*.48}});expect((await snapshot(page)).selection.ids).toEqual(['FMA7163']);
});
test('mobile bundle comparison keeps its result visible and avoids page scroll; invalid snapshots recover',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.evaluate(()=>sessionStorage.setItem('gyeol-view-v2','{"version":2,"layers":{}}'));await page.reload();await ready(page);await choosePoint(page,'CV12');await compare(page);await expect(page.locator('.floating-dock')).toHaveCount(0);await expect(page.locator('.selection-card')).toContainText('위');expect(await page.evaluate(()=>scrollY)).toBe(0);await page.screenshot({path:'docs/ui-renewal/mobile-comparison-tested.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
