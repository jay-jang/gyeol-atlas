import {test,expect} from '@playwright/test';
import {ready,snapshot,openTool,closeTool} from './helpers';
import groups from '../../data/female-detail-groups.json' with {type:'json'};

test('female CT details preserve source isolation, search, nearby organs, reload and HRA return', async ({page}) => {
  test.setTimeout(180000);
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  let fiberUrl=''; page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.goto('/'); await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click(); await ready(page);
  const canvas=page.locator('canvas');
  const visible=async()=>(await canvas.getAttribute('data-visible-structure-ids')||'').split(',').filter(Boolean).sort();
  for(const group of groups) {
    await page.locator('.featured-anatomy > button').filter({has:page.getByText(group.name,{exact:true})}).click(); await ready(page);
    await expect.poll(visible).toEqual([...group.ids].sort());
    await expect(canvas).toHaveAttribute('data-female-detail-parts','11');
    await expect(canvas).toHaveAttribute('data-female-atlas-parts','0');
    await expect(page.locator('.selection-card')).toContainText('HRA 전신에 합쳐진 모델이 아닙니다');
    // The selected model's projected box must stay above the floating card.
    const projectedBottom = await page.evaluate(async url=>{
      const module=await import(/* @vite-ignore */ url);
      const canvas=document.querySelector('canvas')!;
      const camera=module._roots.get(canvas).store.getState().camera;
      const bounds=JSON.parse(canvas.dataset.selectedWorldBounds!);
      const rect=canvas.getBoundingClientRect(); let bottom=0;
      for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++) {
        const p=camera.position.clone().set(bounds[x][0],bounds[y][1],bounds[z][2]).project(camera);
        bottom=Math.max(bottom,rect.top+(1-p.y)*rect.height/2);
      }
      return bottom;
    },fiberUrl);
    expect(projectedBottom).toBeLessThan((await page.locator('.selection-card').boundingBox())!.y);
    await page.screenshot({path:`docs/anatomy-alignment/ct-${group.id}.png`});
  }
  await openTool(page,'구조 찾기'); await page.getByLabel('해부 구조 검색').fill('CTF_stomach');
  await page.locator('.structure-item').click(); await ready(page); await closeTool(page);
  await expect.poll(visible).toEqual(['CTF_stomach']);
  expect((await snapshot(page)).detail.id).toBe('stomach-ct');
  await page.reload(); await ready(page); await expect.poll(visible).toEqual(['CTF_stomach']);
  await page.getByRole('button',{name:'같은 여성 CT의 주변 기관 보기',exact:true}).click(); await ready(page);
  await expect.poll(visible).toEqual([...groups.at(-1)!.ids].sort());
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click(); await ready(page);
  await expect(canvas).toHaveAttribute('data-female-atlas-parts','1220');
  expect((await visible()).every(id=>!id.startsWith('CTF_'))).toBe(true);
  await page.setViewportSize({width:390,height:844});
  await openTool(page,'구조 찾기'); await page.getByLabel('해부 구조 검색').fill('위 (여성 CT)');
  await page.locator('.structure-item').click(); await ready(page); await closeTool(page);
  await page.locator('.selection-card').getByRole('button',{name:'확대',exact:true}).click();
  await page.screenshot({path:'docs/anatomy-alignment/ct-stomach-mobile.png'});
  const title = await page.locator('.selection-card strong').first().boundingBox();
  const card = await page.locator('.selection-card').boundingBox();
  expect(title!.y).toBeGreaterThanOrEqual(card!.y);
  expect(title!.y+title!.height).toBeLessThan(card!.y+card!.height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await openTool(page,'레이어 조절'); await page.getByLabel('클릭 선택 대상').selectOption('skin'); await ready(page);
  await expect(canvas).toHaveAttribute('data-female-atlas-parts','1220');
  expect((await snapshot(page)).detail).toBe(null);
  await page.locator('.anatomy-scope-controls').getByRole('button',{name:'남성',exact:true}).click(); await ready(page);
  await expect(canvas).toHaveAttribute('data-model-sex','male');
  expect((await visible()).every(id=>!id.startsWith('CTF_')&&!id.startsWith('HRAF'))).toBe(true);
  expect(errors).toEqual([]);
});

test('returning from female CT waits for the actual HRA source to reload', async ({page}) => {
  test.setTimeout(90000);
  await page.goto('/'); await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click(); await ready(page);
  await page.locator('.featured-anatomy > button').filter({has:page.getByText('위 (여성 CT)',{exact:true})}).click(); await ready(page);
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/models/female/female-0.bin.gz',async route=>{await held;await route.continue();});
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();
  await expect(page.getByText('해부 모델 로드 완료')).not.toBeVisible();
  release(); await ready(page);
  await expect(page.locator('canvas')).toHaveAttribute('data-female-atlas-parts','1220');
});

test('female CT chunk failure is recoverable without substituting male or HRA organs', async ({page}) => {
  test.setTimeout(90000);
  await page.route('**/models/female-detail/ct-supplement.bin.gz',r=>r.fulfill({status:503,body:'Unavailable'}));
  await page.goto('/'); await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click(); await ready(page);
  await page.locator('.featured-anatomy > button').filter({has:page.getByText('위 (여성 CT)',{exact:true})}).click();
  await expect(page.getByRole('alert')).toContainText('3D 모델을 열지 못했습니다');
  await page.unroute('**/models/female-detail/ct-supplement.bin.gz');
  await page.getByRole('button',{name:'3D 다시 시도',exact:true}).click(); await ready(page);
  await expect(page.locator('canvas')).toHaveAttribute('data-female-detail-parts','11');
});
