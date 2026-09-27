import {test,expect} from '@playwright/test';
import {ready,snapshot,openTool,closeTool} from './helpers';
import groups from '../../data/male-detail-groups.json' with {type:'json'};
import catalog from '../../data/male-detail-structures.json' with {type:'json'};
import fs from 'node:fs';
import {initialView} from '../../src/view-state';
const lung=groups.find(g=>g.id==='lung')!,old=groups.find(g=>g.id==='lung-branches')!;
const internal=lung.ids.filter(id=>!catalog.find(s=>s.id===id)!.name.startsWith('Parenchyma of '));
for(const mobile of [false,true])test(`lung source views remain separate and selectable on ${mobile?'mobile':'desktop'}`,async({page})=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
  await page.goto('/');await ready(page);
  if(mobile){
    await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill('왼쪽 꼭대기뒤구역 폐실질');
    await page.locator('.structure-item').first().click();await ready(page);await closeTool(page);
    await page.getByRole('button',{name:'기관 전체 모형',exact:true}).click();await ready(page);
  }else{
    await page.locator('.featured-anatomy > button').filter({has:page.getByText('폐',{exact:true})}).click();await ready(page);
  }
  const visible=async()=>(await page.locator('canvas').getAttribute('data-visible-structure-ids')||'').split(',').filter(Boolean).sort();
  const check=async(ids:string[])=>{await ready(page);await expect.poll(visible).toEqual([...ids].sort());};
  const captures=[];
  for(const [id,button,ids] of [['lung',null,lung.ids],['lung-internal','혈관·기관지 보기',internal],['lung-branches','이전 세부 가지 별도 보기',old.ids]] as const){
    if(button)await page.getByRole('button',{name:button,exact:true}).click();
    await check(ids as string[]);expect((await snapshot(page)).detail.id).toBe(id);
    await expect(page.locator('.organ-detail-parts summary')).toBeInViewport();
    await expect(page.getByRole('button',{name:'기관 전체 모형',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'비교 대상만 보기',exact:true})).toHaveCount(0);
    await page.screenshot({path:`docs/anatomy-alignment/${id}-${mobile?'mobile':'desktop'}.png`});
    captures.push({id,visible:await visible()});
    await page.reload();await check(ids as string[]);
  }
  await page.getByRole('button',{name:'폐실질 함께 보기',exact:true}).click();await check(lung.ids);
  await page.locator('.organ-detail-parts summary').click();
  await page.locator('.organ-detail-parts button').nth(lung.ids.indexOf('BP4_FJ6595')).click();await check(['BP4_FJ6595']);
  await page.getByRole('button',{name:'전체 구조 보기',exact:true}).click();await check(lung.ids);
  expect((await snapshot(page)).selection.ids).toEqual(['BP4_FJ6595']);
  await page.locator('[data-lung-provenance] summary').click();
  await page.locator('[data-lung-provenance]').getByRole('button',{name:'혈관·기관지 보기',exact:true}).click();await check(internal);
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready(page);
  expect((await snapshot(page)).detail).toBe(null);expect((await visible()).some(id=>id.startsWith('BP4_'))).toBe(false);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  expect((await visible()).some(id=>id.startsWith('BP4_'))).toBe(false);expect(errors).toEqual([]);
  fs.writeFileSync(`docs/anatomy-alignment/lung-source-${mobile?'mobile':'desktop'}.json`,JSON.stringify({captures,errors},null,2)+'\n');
});

test('a retired fragment in a historical lung session restores a source bundle and preserves preferences',async({page})=>{
  const layers={...initialView().layers,skin:false,organ:true,vessel:true};
  const saved={...initialView(),displayMode:'layers',layers,markers:'hidden',isolated:true,
    camera:{position:[0,1.3,1.1],target:[0,1.3,0]},
    selection:{kind:'structure',ids:['BP4_FJ2041'],name:'Right anterior segmental artery'},
    detail:{id:'lung',name:'폐',ids:[...old.ids,'BP4_FJ2041','BP4_FJ2044'],layers}};
  await page.addInitScript(value=>{if(!sessionStorage.getItem('gyeol-view-v2'))sessionStorage.setItem('gyeol-view-v2',JSON.stringify(value));},saved);
  await page.goto('/');await ready(page);
  const visible=async()=>(await page.locator('canvas').getAttribute('data-visible-structure-ids')||'').split(',').filter(Boolean).sort();
  await expect.poll(visible).toEqual([...old.ids].sort());
  const restored=await snapshot(page);
  expect(restored.detail.id).toBe('lung-branches');expect(restored.markers).toBe('hidden');
  expect(restored.alpha).toEqual(saved.alpha);expect(restored.camera).toEqual(saved.camera);
  await page.reload();await ready(page);await expect.poll(visible).toEqual([...old.ids].sort());
});
