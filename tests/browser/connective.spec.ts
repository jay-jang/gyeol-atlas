import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import {ready,snapshot,closeTool,settledCamera} from './helpers';
import {LIGAMENT_COLOR,TENDON_COLOR,connectiveGroup} from '../../src/anatomy-rendering';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const catalog:{id:string;model:string}[]=read('data/connective-structures.json');
const tags=read('data/connective-tags.json');
const maleIds=new Set([...catalog.map(e=>e.id),...Object.keys(tags.male)]);
// Female: the HRA knee structures plus the male-source ligaments and tendons carried by the registration field.
const transported:{transport:string;system:string}[]=read('data/female-transport-structures.json');
const femaleIds=new Set([...Object.keys(tags.female),...transported.filter(r=>r.system==='ligament'||r.system==='tendon').map(r=>`FT_${r.transport}`)]);
const visible=async(page:Page)=>new Set(((await page.locator('canvas').getAttribute('data-visible-structure-ids'))||'').split(',').filter(Boolean));
const openDisplay=(page:Page)=>page.getByRole('button',{name:'표시 설정',exact:true}).click();

test('male ligaments and tendons are present, peel with their systems and can be hidden or viewed alone',async({page})=>{
  test.setTimeout(180000);
  const requests:string[]=[],errors:string[]=[];
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await ready(page);
  for(const file of ['ligament-full.glb','tendon-full.glb'])expect(requests.some(u=>u.endsWith(`/models/${file}`))).toBe(true);
  const depth=page.getByLabel('연속 해부 박리 깊이');
  // Muscles are fading: every ligament and supplement tendon is present.
  await depth.fill('66');await ready(page);
  await expect.poll(async()=>[...await visible(page)].filter(id=>id.startsWith('ZA_ligament_')).length).toBe(358);
  expect([...await visible(page)].filter(id=>id.startsWith('ZA_tendon_')).length).toBe(58);
  // Ligaments leave with the skeleton; nothing of theirs remains at 90%.
  await depth.fill('90');await ready(page);
  await expect.poll(async()=>[...await visible(page)].filter(id=>maleIds.has(id)).length).toBe(0);
  await depth.fill('66');await ready(page);await settledCamera(page);
  const before=await snapshot(page);
  await openDisplay(page);
  const toggle=page.getByRole('checkbox',{name:/인대·힘줄 표시/});
  await expect(toggle).toBeChecked();
  await expect(page.locator('.connective-setting')).toContainText(`${maleIds.size}개`);
  await toggle.uncheck();await ready(page);
  await expect.poll(async()=>[...await visible(page)].filter(id=>maleIds.has(id)).length).toBe(0);
  const hidden=await snapshot(page);
  expect(hidden.connective).toBe(false);expect(hidden.camera).toEqual(before.camera);expect(hidden.markers).toBe(before.markers);expect(hidden.dissection).toBe(66);
  await toggle.check();await ready(page);
  await expect.poll(async()=>[...await visible(page)].filter(id=>id.startsWith('ZA_ligament_')).length).toBe(358);
  // Only ligaments and tendons, then back to the same peel.
  await page.getByRole('button',{name:'인대·힘줄만 보기'}).click();await ready(page);
  const card=page.getByRole('region',{name:'선택 구조 조작'});
  await expect(card).toContainText(`인대·힘줄 ${maleIds.size}개 구조`);
  await expect(card).toContainText('대부분의 힘줄은 근육 모형에 포함');
  await expect.poll(async()=>{const ids=await visible(page);return ids.size===maleIds.size&&[...ids].every(id=>maleIds.has(id));}).toBe(true);
  await page.screenshot({path:'docs/anatomy-expansion/connective-only-desktop.png'});
  await settledCamera(page);const studied=(await snapshot(page)).camera;
  await card.getByRole('button',{name:'구조 선택 해제',exact:true}).click();await ready(page);await settledCamera(page);
  // Clearing returns to the same peel; the camera stays where the viewer was looking.
  const back=await snapshot(page);
  expect(back.selection).toBe(null);expect(back.dissection).toBe(66);expect(back.displayMode).toBe('dissection');
  for(const key of ['position','target'] as const)for(let axis=0;axis<3;axis++)expect(back.camera[key][axis]).toBeCloseTo(studied[key][axis],6);
  // Search keeps English, TA2 Latin and the source hierarchy; the card names the tissue kind.
  const input=page.getByLabel('경혈·구조 검색');await input.click();await input.fill('Ligamentum cruciatum anterius');
  const result=page.locator('.structure-item').filter({hasText:'오른쪽 앞십자인대'});
  await expect(result).toContainText('Anterior cruciate ligament (right)');
  await result.click();await ready(page);
  await expect(card.locator('.selection-kind')).toHaveText('선택 구조 · 인대');
  await expect(card).toContainText('TA2 · Ligamentum cruciatum anterius');
  await page.screenshot({path:'docs/anatomy-expansion/connective-acl-desktop.png'});
  expect(errors).toEqual([]);
});

test('female reference shows its source knee structures and the carried ligaments and tendons',async({page})=>{
  test.setTimeout(180000);
  await page.goto('/');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await openDisplay(page);
  await expect(page.locator('.connective-setting')).toContainText(`${femaleIds.size}개`);
  await expect(page.locator('.connective-setting')).toContainText('무릎 인대·반달연골');
  await page.getByRole('button',{name:'인대·힘줄만 보기'}).click();await ready(page);
  await expect.poll(async()=>{const ids=await visible(page);return ids.size===femaleIds.size&&[...ids].every(id=>femaleIds.has(id));}).toBe(true);
  await closeTool(page);
});

test('the ligament setting and its view fit a phone without replacing the scene',async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');await ready(page);
  await openDisplay(page);
  const panel=await page.locator('.ax-panel').boundingBox(),canvas=await page.locator('canvas').boundingBox();
  expect(panel!.height).toBeLessThanOrEqual(canvas!.height*.45+1);
  await page.locator('.connective-setting').scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'인대·힘줄만 보기'})).toBeInViewport();
  await page.getByRole('button',{name:'인대·힘줄만 보기'}).click();await ready(page);
  await expect(page.locator('.ax-panel')).toHaveCount(0);
  const card=page.getByRole('region',{name:'선택 구조 조작'});
  await expect(card.getByRole('button',{name:'구조 선택 해제',exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'docs/anatomy-expansion/connective-only-mobile.png'});
});

test('ligaments and tendons are drawn apart in both bodies and the display settings name the two',async({page})=>{
  test.setTimeout(240000);
  let url='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))url=r.url();});
  const kinds:Record<string,string>={...Object.fromEntries(catalog.map((e:any)=>[e.id,e.kind])),...tags.male,...tags.female};
  const material=(ids:string[])=>page.evaluate(async({url,ids})=>{
    const {_roots}=await import(/* @vite-ignore */url),s=_roots.get(document.querySelector('canvas')!).store.getState();
    return Object.fromEntries(ids.map(id=>{const o=s.scene.getObjectByName(id);return [id,o&&{color:'#'+o.material.color.getHexString(),roughness:o.material.roughness}];}));
  },{url,ids});
  await page.goto('/');await ready(page);
  await openDisplay(page);
  const key=page.getByRole('list',{name:'인대와 힘줄의 색 구분'});
  const tendons=[...maleIds].filter(id=>connectiveGroup(kinds[id])==='tendon').length;
  await expect(key).toContainText(`인대·관절 구조 ${maleIds.size-tendons}개`);
  await expect(key).toContainText(`힘줄·힘줄집·지지띠 ${tendons}개`);
  await page.getByRole('button',{name:'인대·힘줄만 보기'}).click();await ready(page);
  // Supplements (ligament and tendon files) and tagged base meshes alike.
  const male=await material(['ZA_ligament_anterior_cruciate_ligament_r','ZA_tendon_synovial_sheaths_of_digits_of_hand_r','FMA258847','FMA44249']);
  for(const id of ['ZA_ligament_anterior_cruciate_ligament_r','FMA44249'])expect(male[id]?.color,id).toBe(LIGAMENT_COLOR);
  for(const id of ['ZA_tendon_synovial_sheaths_of_digits_of_hand_r','FMA258847'])expect(male[id]?.color,id).toBe(TENDON_COLOR);
  expect(male.FMA258847!.roughness).toBeLessThan(male.FMA44249!.roughness);
  await page.screenshot({path:'docs/anatomy-expansion/connective-kinds-male-desktop.png'});
  await page.getByRole('button',{name:'구조 선택 해제',exact:true}).click();await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await openDisplay(page);await page.getByRole('button',{name:'인대·힘줄만 보기'}).click();await ready(page);
  // HRA knee: quadriceps tendon vs ligament and meniscus; carried: a joint capsule vs a tendon sheath.
  const female=await material(['HRAF0395','HRAF0904','HRAF0910','FT_ZA_ligament_articular_capsule_of_acromioclavicular_joint_l','FT_ZA_tendon_synovial_sheaths_of_digits_of_hand_r']);
  for(const id of ['HRAF0904','HRAF0910','FT_ZA_ligament_articular_capsule_of_acromioclavicular_joint_l'])expect(female[id]?.color,id).toBe(LIGAMENT_COLOR);
  for(const id of ['HRAF0395','FT_ZA_tendon_synovial_sheaths_of_digits_of_hand_r'])expect(female[id]?.color,id).toBe(TENDON_COLOR);
  await page.setViewportSize({width:390,height:844});
  await openDisplay(page);await key.scrollIntoViewIfNeeded();await expect(key).toBeInViewport();
  await page.screenshot({path:'docs/anatomy-expansion/connective-kinds-female-mobile.png'});
});
