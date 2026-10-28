import { test, expect, type Page } from '@playwright/test';
import points from '../../data/points.json' with { type: 'json' };
import { ready, openTool, openFilters, snapshot, closeTool, settledCamera } from './helpers';
const xi = 'LU6 LI7 ST34 SP8 HT6 SI6 BL63 KI5 PC4 TE7 GB36 LR6 KI8 BL59 KI9 GB35'.split(' ');
const back = 'BL13 BL25 BL21 BL20 BL15 BL27 BL28 BL23 BL14 BL22 BL19 BL18'.split(' ');
const memberIds = async (page: Page) => (await page.locator('canvas').getAttribute('data-rendered-point-ids'))!.split(',').sort();
const chooseColour = async (page: Page, mode: string) => { await openFilters(page); await page.getByRole('group',{name:'표식 색상',exact:true}).getByRole('button',{name:({category:'혈 분류 색',organ:'연결 장부 색',meridian:'경맥 색'} as Record<string,string>)[mode],exact:true}).click(); };
const colour = async (page: Page, id: string) => page.locator('canvas').evaluate((el, id) => JSON.parse((el as HTMLCanvasElement).dataset.markerColors!)[id], id);

for (const [name, width, height] of [['desktop',1440,900],['mobile',390,844],['small-mobile',360,740],['landscape',844,390]] as const) {
  test(`${name}: classification and organ filters paint the model and keep the scene`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width, height }); await page.goto('/'); await ready(page); await settledCamera(page);
    const original = (await snapshot(page)).camera;
    await openTool(page, '경혈 찾기');
    await chooseColour(page, 'category');
    await expect(page.locator('canvas')).toHaveAttribute('data-marker-color-mode', 'category');
    await expect.poll(() => colour(page,'LU9')).toBe('#72d6ca');
    await openFilters(page);
    await page.getByLabel('경혈 분류',{exact:true}).selectOption('xi');
    await expect(page.locator('.point-item')).toHaveCount(16);
    await expect.poll(() => memberIds(page)).toEqual([...xi].sort());
    await expect.poll(() => colour(page,'LU6')).toBe('#f497c2');
    await expect(page.locator('.point-item').filter({hasText:'KI8'})).toContainText('음교맥');
    const horizontal = await page.locator('.ax-filter-grid').evaluate(root => {
      const box=root.getBoundingClientRect();
      return [...root.querySelectorAll('select')].filter(el=>{const r=el.getBoundingClientRect();return r.left<box.left-.5||r.right>box.right+.5;}).map(el=>el.getAttribute('aria-label'));
    });
    expect(horizontal).toEqual([]);
    await page.screenshot({ path:`docs/acupoint-display/${name}-filters.png` });
    const canvas = await page.locator('canvas').boundingBox(), panel = await page.getByRole('region',{name:'경혈 목록',exact:true}).boundingBox();
    if (width <= 700 || height <= 560) expect(panel!.height).toBeLessThanOrEqual(canvas!.height*.45+1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await snapshot(page)).camera).toEqual(original);
    await page.locator('.ax-filters > summary').click();
    await page.locator('.point-item').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:`docs/acupoint-display/${name}-list.png`});
    await openFilters(page);
    await page.getByLabel('경혈 분류',{exact:true}).selectOption('back-shu');
    await expect(page.locator('.point-item')).toHaveCount(12);
    await expect.poll(() => memberIds(page)).toEqual([...back].sort());
    await page.getByLabel('연결 장부',{exact:true}).selectOption('LU');
    await expect(page.locator('.point-item')).toHaveCount(1);
    await expect(page.locator('.point-item')).toContainText('BL13');
    await expect(page.locator('.point-item')).toContainText('폐(분류 대응)');
    await expect.poll(() => memberIds(page)).toEqual(['BL13']);
    await chooseColour(page, 'organ');
    await expect.poll(() => colour(page,'BL13')).toBe('#779c93');
    await page.getByRole('button',{name:/필터 결과 1개를 모델에서 보기/}).click();
    await expect(page.locator('.ax-panel')).toHaveCount(0);
    await ready(page); await page.getByRole('button',{name:'후면',exact:true}).click(); await settledCamera(page);
    await page.screenshot({path:`docs/acupoint-display/${name}-back-shu.png`});
    expect(errors).toEqual([]);
  });
}

test('actual GPU instance colours, overlaps, selection, wiki return and reload retain display preferences', async ({page}) => {
  let fiber = ''; page.on('request', r => {if(/\/@react-three_fiber\.js\?/.test(r.url())) fiber=r.url();});
  await page.goto('/#atlas/LU9'); await ready(page); await openTool(page,'경혈 찾기');
  await chooseColour(page, 'category'); await openFilters(page);
  await page.getByLabel('경혈 분류',{exact:true}).selectOption('five-shu');
  await expect(page.locator('.point-item').filter({hasText:'LU9'}).locator('[data-category]')).toHaveCount(2);
  await expect.poll(() => colour(page,'LU9')).toBe('#cadd80');
  // Read actual Three.js instance colours (not just the diagnostic attribute).
  const actual = await page.evaluate(async ({url, ids}) => {
    const {_roots} = await import(/* @vite-ignore */url), canvas=document.querySelector('canvas')!, store=_roots.get(canvas).store.getState();
    let mesh:any; store.scene.traverse((o:any) => { if(o.isInstancedMesh && o.userData.acupointMarkers) mesh=o; });
    const result:Record<string,string>={}; const color=mesh.material.color.clone();
    // Markers follow the catalogue order, with each point's occurrences together.
    const displayed=ids.filter(p=>canvas.dataset.renderedPointIds!.split(',').includes(p.id));
    let index=0; for(const p of displayed){mesh.getColorAt(index,color);result[p.id]='#'+color.getHexString();index+=p.markerCount;}
    return result;
  },{url:fiber,ids:points});
  expect(actual.LU9).toBe('#cadd80'); expect(actual.SI3).toBe('#cadd80');
  await page.getByLabel('경혈 분류',{exact:true}).selectOption('mu');
  await page.getByLabel('연결 장부',{exact:true}).selectOption('LI');
  await expect(page.locator('.point-item')).toContainText('ST25');
  // Q26: the selected point stays as a reference even outside the results.
  await expect(page.locator('[data-filter-reference]')).toContainText('LU9');
  expect(await memberIds(page)).toEqual(['LU9','ST25']);
  await page.getByRole('button',{name:/필터 결과 1개를 모델에서 보기/}).click();
  await expect.poll(() => memberIds(page)).toEqual(['LU9','ST25']);
  await settledCamera(page); const pose=(await snapshot(page)).camera;
  await page.getByRole('link',{name:'지식 위키',exact:true}).first().click();
  await page.getByRole('link',{name:/3D 보기로 돌아가기/}).click(); await ready(page);
  let saved=await snapshot(page); expect(saved.filters.organ).toBe('LI'); expect(saved.filters.concept).toBe('mu'); expect(saved.markerColor).toBe('category');
  expect(saved.camera.target.map((v:number)=>+v.toFixed(6))).toEqual(pose.target.map((v:number)=>+v.toFixed(6)));
  await page.reload(); await ready(page);
  await expect.poll(() => memberIds(page)).toEqual(['LU9','ST25']); expect((await snapshot(page)).markerColor).toBe('category');
  await openTool(page,'경혈 찾기'); await openFilters(page);
  await page.getByLabel('연결 장부',{exact:true}).selectOption('PC');
  await expect(page.locator('.point-item')).toContainText('CV17');
  await page.getByLabel('경혈 분류',{exact:true}).selectOption('all');
  await page.getByLabel('연결 장부',{exact:true}).selectOption('none');
  await expect(page.locator('.point-item')).toHaveCount(94); // CV24 + GV28 + extra48 - 6 explicitly assigned Mu points
  await closeTool(page);
});

test('keyboard and touch operate classification controls; system changes retain colour and filters', async ({page,browser,baseURL}) => {
  await page.goto('/'); await ready(page); await openTool(page,'경혈 찾기');
  await openFilters(page);
  const colourButton=page.getByRole('button',{name:'혈 분류 색',exact:true});
  await colourButton.focus(); await expect(colourButton).toBeFocused(); await colourButton.press('Enter');
  await expect(colourButton).toHaveAttribute('aria-pressed','true');
  await page.locator('.point-color-legend > summary').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.point-legend-swatches')).toBeVisible();
  await page.keyboard.press('Enter');
  await openFilters(page); await page.getByLabel('경혈 분류',{exact:true}).selectOption('xi');
  await page.getByLabel('연결 장부',{exact:true}).selectOption('KI');
  await closeTool(page); const before=await snapshot(page);
  await page.getByRole('button',{name:'골격만 보기',exact:true}).click(); await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click(); await ready(page);
  const after=await snapshot(page); expect(after.markerColor).toBe('category'); expect(after.filters).toEqual(before.filters);
  await expect(page.locator('canvas')).toHaveAttribute('data-rendered-markers','0');
  await page.getByRole('button',{name:'근사 위치로 보기',exact:true}).click();
  await expect.poll(() => memberIds(page)).toEqual(['KI5','KI8','KI9']);
  const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
  try {
    const p=await touch.newPage(); await p.goto(baseURL! + '/'); await ready(p);
    await p.getByRole('button',{name:'경혈 찾기',exact:true}).tap();
    await chooseColour(p, 'organ');
    await openFilters(p); await p.getByLabel('경혈 분류',{exact:true}).selectOption('back-shu');
    await p.getByLabel('연결 장부',{exact:true}).selectOption('KI');
    await p.getByRole('button',{name:/필터 결과 1개를 모델에서 보기/}).tap();
    await expect.poll(() => memberIds(p)).toEqual(['BL23']);
    await expect.poll(() => colour(p,'BL23')).toBe('#858caf');
    await p.screenshot({path:'docs/acupoint-display/mobile-touch.png'});
    // Added metadata belongs in the scrolling overview, preserving room for reading other tabs.
    await p.goto(baseURL! + '/#atlas/EX-B2'); await ready(p); await p.locator('.point-summary').click();
    await expect(p.locator('.detail-panel [data-point-organs]')).toContainText('장부 배속 없음');
    await p.getByRole('tab',{name:'효능·오행',exact:true}).click();
    for(const width of [390,360]) {
      await p.setViewportSize({width,height:width===390?844:740});
      await p.locator('.point-tradition').scrollIntoViewIfNeeded();
      const panel=await p.locator('.detail-panel').boundingBox(),tabs=await p.locator('.detail-tabs').boundingBox();
      expect(panel!.y+panel!.height-(tabs!.y+tabs!.height)).toBeGreaterThanOrEqual(48);
      await p.screenshot({path:`docs/acupoint-display/detail-tradition-${width}.png`});
    }

  } finally { await touch.close(); }
});


test('a Back-Shu comparison opens the complete organ bundle and retains marker settings', async ({page}) => {
  await page.goto('/#atlas/BL13'); await ready(page); await openTool(page,'경혈 찾기');
  await chooseColour(page, 'category');
  await openFilters(page); await page.getByLabel('경혈 분류',{exact:true}).selectOption('back-shu');
  await page.getByLabel('연결 장부',{exact:true}).selectOption('LU'); await closeTool(page);
  await page.locator('.point-summary').click();
  await expect(page.locator('.detail-panel [data-point-organs]')).toContainText('폐(분류 대응)');
  await page.getByRole('button',{name:'대응 장부의 해부 구조 비교',exact:true}).click(); await ready(page);
  const state=await snapshot(page);
  expect([...state.comparison.ids].sort()).toEqual(['FMA7333','FMA7337','FMA7370','FMA7371','FMA7383']);
  expect(state.comparison.kind).toBe('bundle'); expect(state.markerColor).toBe('category'); expect(state.filters.organ).toBe('LU');
  await expect(page.locator('.selection-card')).toContainText('전통적 대응, 압력 경로 아님');
  await page.screenshot({path:'docs/acupoint-display/back-shu-comparison.png'});
});
