import { test, expect } from '@playwright/test';
import { ready, snapshot, openTool, closeTool, settledCamera } from './helpers';

// View continuity (Q30): choosing an acupoint keeps the organ being studied
// and the camera; clearing it restores the peel it replaced, not the camera.
test('female same-point click keeps an ordinary organ selection; clearing returns to the prior peel', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#atlas/ST36'); await ready(page);
  await page.locator('.ax-top').getByRole('button', { name: '여성', exact: true }).click(); await ready(page);
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5'); await ready(page);
  const before = await snapshot(page), canvas = page.locator('canvas');
  const beforeIds = await canvas.getAttribute('data-visible-structure-ids');
  await openTool(page, '구조 찾기');
  await page.getByLabel('경혈·구조 검색').fill('HRAF0435');
  await page.locator('.structure-item').filter({ hasText: 'HRAF0435' }).click(); await ready(page);
  await closeTool(page);
  expect((await snapshot(page)).selection.ids).toEqual(['HRAF0435']);
  await page.getByRole('link', { name: '지식 위키', exact: true }).first().click();
  await page.getByRole('link', { name: /3D 보기로 돌아가기/ }).click(); await ready(page);
  expect((await snapshot(page)).selection.ids).toEqual(['HRAF0435']);
  await settledCamera(page);
  const studied = (await snapshot(page)).camera;
  await openTool(page, '경혈 찾기');
  await page.getByLabel('경혈 검색').fill('ST36');
  await page.locator('.point-item').filter({ hasText: 'ST36' }).first().click(); await ready(page);
  const reselected = await snapshot(page);
  expect(reselected.selection.ids).toEqual(['HRAF0435']);
  expect(reselected.camera).toEqual(studied);
  await page.getByRole('button', { name: '구조 선택 해제', exact: true }).click(); await ready(page); await settledCamera(page);
  const after = await snapshot(page);
  for (const key of ['sex', 'pointId', 'anatomyRegion', 'stage', 'dissection', 'displayMode', 'layers', 'markers'])
    expect(after[key], key).toEqual(before[key]);
  expect(after.selection).toBe(null);
  expect(after.selectionReturn).toBe(null);
  expect(after.camera).toEqual(studied);
  await expect(canvas).toHaveAttribute('data-visible-structure-ids', beforeIds!);
  await page.screenshot({ path: 'docs/anatomy-alignment/same-point-return-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toBeInViewport();
  await page.screenshot({ path: 'docs/anatomy-alignment/same-point-return-mobile.png' });
});

for (const { sex, id } of [
  { sex: 'male', id: 'FMA7148' },
  { sex: 'female', id: 'HRAF0435' },
] as const) test(`${sex}: acupoints keep an ordinary selection; region navigation leaves it for the prior peel`, async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#atlas/KI3'); await ready(page);
  if (sex === 'female') {
    await page.locator('.ax-top').getByRole('button', { name: '여성', exact: true }).click();
    await ready(page);
  }
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5'); await ready(page);
  const canvas = page.locator('canvas');
  const before = await snapshot(page);
  const beforeIds = await canvas.getAttribute('data-visible-structure-ids');
  expect(beforeIds).toBeTruthy();
  const chooseStructure = async () => {
    await openTool(page, '구조 찾기');
    await page.getByLabel('경혈·구조 검색').fill(id);
    // The male 4.0 detail also cites FMA7148; this scenario needs the ordinary 3.0 mesh.
    const item = sex === 'male'
      ? page.getByRole('button', { name: /^위 stomach · FMA7148 · BodyParts3D 남성 참조$/ })
      : page.locator('.structure-item').filter({ hasText: id });
    await item.click(); await ready(page);
    await closeTool(page);
    expect((await snapshot(page)).displayMode).toBe('layers');
  };
  await chooseStructure();
  await settledCamera(page);
  const studied = (await snapshot(page)).camera;
  await openTool(page, '경혈 찾기');
  await page.getByLabel('경혈 검색').fill('ST36');
  await page.locator('.point-item').filter({ hasText: 'ST36' }).first().click(); await ready(page);
  const afterPoint = await snapshot(page);
  expect(afterPoint.pointId).toBe('ST36');
  expect(afterPoint.selection.ids).toEqual([id]);
  expect(afterPoint.camera).toEqual(studied);
  await page.getByRole('button', { name: '구조 선택 해제', exact: true }).click(); await ready(page); await settledCamera(page);
  const cleared = await snapshot(page);
  expect(cleared.selection).toBe(null);
  expect(cleared.selectionReturn).toBe(null);
  expect(cleared.dissection).toBe(50.5);
  expect(cleared.displayMode).toBe('dissection');
  expect(cleared.layers).toEqual(before.layers);
  expect(cleared.camera).toEqual(studied);
  await expect(canvas).toHaveAttribute('data-visible-structure-ids', beforeIds!);
  await page.screenshot({ path: `docs/anatomy-alignment/selection-navigation-${sex}-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toBeInViewport();
  await page.screenshot({ path: `docs/anatomy-alignment/selection-navigation-${sex}-mobile.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await chooseStructure();
  await page.getByLabel('전신 부위 선택').selectOption('head'); await ready(page);
  const afterRegion = await snapshot(page);
  expect(afterRegion.anatomyRegion).toBe('head');
  expect(afterRegion.selection).toBe(null);
  expect(afterRegion.selectionReturn).toBe(null);
  expect(afterRegion.dissection).toBe(50.5);
  expect(afterRegion.displayMode).toBe('dissection');
  expect(afterRegion.layers).toEqual(before.layers);
  await expect.poll(async () => (await canvas.getAttribute('data-visible-structure-ids') || '').split(',').filter(Boolean).length)
    .toBeGreaterThan(0);
  expect((await canvas.getAttribute('data-visible-structure-ids') || '').split(',').length)
    .toBeLessThan(beforeIds!.split(',').length);
  await page.getByLabel('전신 부위 선택').selectOption('whole'); await ready(page);
  await expect(canvas).toHaveAttribute('data-visible-structure-ids', beforeIds!);
  await chooseStructure();
  await openTool(page, '경혈 찾기');
  await page.getByLabel('모델 부위 선택').selectOption('발목·발'); await ready(page);
  const afterFilter = await snapshot(page);
  expect(afterFilter.selection).toBe(null);
  expect(afterFilter.dissection).toBe(50.5);
  expect(afterFilter.displayMode).toBe('dissection');
  await chooseStructure();
  await openTool(page, '경혈 찾기');
  await page.getByLabel('경혈 검색').fill('');
  await expect(page.getByRole('button', { name: /필터 결과 .*모델에서 보기/ })).toBeEnabled();
  await page.getByRole('button', { name: /필터 결과 .*모델에서 보기/ }).click(); await ready(page);
  const afterShowFiltered = await snapshot(page);
  expect(afterShowFiltered.selection).toBe(null);
  expect(afterShowFiltered.dissection).toBe(50.5);
  expect(afterShowFiltered.displayMode).toBe('dissection');
  expect(errors).toEqual([]);
});
