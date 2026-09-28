import { test, expect } from '@playwright/test';
import { ready, snapshot, openTool, closeTool } from './helpers';

for (const { sex, id } of [
  { sex: 'male', id: 'FMA7148' },
  { sex: 'female', id: 'HRAF0435' },
] as const) test(`${sex}: point and region navigation leave an ordinary selection for the prior peel`, async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#atlas/KI3'); await ready(page);
  if (sex === 'female') {
    await page.locator('.explore-sidebar').getByRole('button', { name: '여성', exact: true }).click();
    await ready(page);
  }
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5'); await ready(page);
  const canvas = page.locator('canvas');
  const before = await snapshot(page);
  const beforeIds = await canvas.getAttribute('data-visible-structure-ids');
  expect(beforeIds).toBeTruthy();
  const chooseStructure = async () => {
    await openTool(page, '구조 찾기');
    await page.getByLabel('해부 구조 검색').fill(id);
    await page.locator('.structure-item').filter({ hasText: id }).click(); await ready(page);
    await closeTool(page);
    expect((await snapshot(page)).displayMode).toBe('layers');
  };
  await chooseStructure();
  await openTool(page, '경혈 찾기');
  await page.getByLabel('경혈 검색').fill('ST36');
  await page.locator('.point-item').filter({ hasText: 'ST36' }).first().click(); await ready(page);
  const afterPoint = await snapshot(page);
  expect(afterPoint.pointId).toBe('ST36');
  expect(afterPoint.selection).toBe(null);
  expect(afterPoint.selectionReturn).toBe(null);
  expect(afterPoint.dissection).toBe(50.5);
  expect(afterPoint.displayMode).toBe('dissection');
  expect(afterPoint.layers).toEqual(before.layers);
  await expect(canvas).toHaveAttribute('data-visible-structure-ids', beforeIds!);
  await expect.poll(async () => {
    const pose = (await snapshot(page)).camera;
    return Math.max(...(['position', 'target'] as const).flatMap(key =>
      pose[key].map((value: number, i: number) => Math.abs(value - before.camera[key][i]))));
  }).toBeLessThan(1e-6);
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
