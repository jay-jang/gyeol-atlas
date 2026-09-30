import {test,expect} from '@playwright/test';
import groups from '../../data/male-detail-groups.json' with {type:'json'};
import {ready,snapshot,organs} from './helpers';

test('male stomach and named vessel detail retains peel, selected vessel and sex boundary',async({page})=>{
  test.setTimeout(150000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const group=groups.find(group=>group.id==='stomach')!;
  const visible=async()=>(await page.locator('canvas').getAttribute('data-visible-structure-ids')||'')
    .split(',').filter(Boolean).sort();
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready(page);
  const before=await snapshot(page),canvas=page.locator('canvas');
  const beforeIds=await canvas.getAttribute('data-visible-structure-ids');
  await (await organs(page)).filter({has:page.getByText(group.name,{exact:true})}).click();
  await ready(page);
  expect((await snapshot(page)).detail.id).toBe('stomach');
  expect((await snapshot(page)).layers.organ).toBe(true);
  expect((await snapshot(page)).layers.vessel).toBe(true);
  await expect.poll(visible).toEqual([...group.ids].sort());
  await expect(page.locator('[data-stomach-frame-warning]')).toContainText('약 42mm');
  await page.screenshot({path:'docs/anatomy-alignment/male-stomach-detail-desktop.png'});
  await page.locator('[data-stomach-provenance] summary').click();
  await expect(page.locator('[data-stomach-provenance]')).toContainText('공식 ‘위의 9개 하위 부품’ 관계는 아닙니다');
  await page.locator('.organ-detail-parts summary').click();
  await expect(page.locator('.organ-detail-parts button')).toHaveCount(9);
  await page.locator('.organ-detail-parts button').filter({hasText:'왼쪽 위그물막동맥'}).click();await ready(page);
  expect((await snapshot(page)).selection.ids).toEqual(['BP4_FJ3501']);
  await expect.poll(visible).toEqual(['BP4_FJ3501']);
  await page.reload();await ready(page);
  expect((await snapshot(page)).detail.id).toBe('stomach');
  expect((await snapshot(page)).selection.ids).toEqual(['BP4_FJ3501']);
  await expect.poll(visible).toEqual(['BP4_FJ3501']);
  await page.setViewportSize({width:390,height:844});
  const card=await page.locator('.selection-card').boundingBox();
  const movement=await page.locator('.movement-pad').boundingBox();
  // The phone tool column sits beside the card: the two never overlap.
  expect(Math.max(card!.y-(movement!.y+movement!.height),movement!.y-(card!.y+card!.height),card!.x-(movement!.x+movement!.width),movement!.x-(card!.x+card!.width))).toBeGreaterThan(4);
  await expect(page.locator('[data-stomach-frame-warning]')).toBeInViewport();
  await page.screenshot({path:'docs/anatomy-alignment/male-stomach-selected-mobile.png'});
  await page.getByRole('button',{name:'기관 전체 모형'}).click();await ready(page);
  await expect.poll(visible).toEqual([...group.ids].sort());
  const warning=page.locator('[data-stomach-frame-warning]');
  const readability=await warning.evaluate(el=>{
    const rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number);
    const luminance=(v:number[])=>v.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;})
      .reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
    const fg=luminance(rgb(getComputedStyle(el).color));
    const bg=luminance(rgb(getComputedStyle(el.closest('.selection-card')!).backgroundColor));
    return {font:parseFloat(getComputedStyle(el).fontSize),contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};
  });
  expect(readability.font).toBeGreaterThanOrEqual(12);
  expect(readability.contrast).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({path:'docs/anatomy-alignment/male-stomach-detail-mobile.png'});
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready(page);
  const after=await snapshot(page);
  expect(after.detail).toBe(null);expect(after.dissection).toBe(50.5);
  expect(after.layers).toEqual(before.layers);
  await expect.poll(async()=>(await snapshot(page)).camera).toEqual(before.camera);
  await expect(canvas).toHaveAttribute('data-visible-structure-ids',beforeIds!);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  expect((await visible()).every(id=>!id.startsWith('BP4_'))).toBe(true);
  expect(errors).toEqual([]);
});
