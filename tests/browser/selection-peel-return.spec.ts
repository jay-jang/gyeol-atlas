import { test, expect } from '@playwright/test';
import { ready, snapshot, openTool, closeTool } from './helpers';

for (const scenario of [
  { sex: 'male', label: '남성', id: 'FMA7148' },
  { sex: 'female', label: '여성', id: 'HRAF0435' },
] as const) test(`${scenario.sex}: clearing an ordinary structure restores the prior 50.5% peel`, async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/'); await ready(page);
  if (scenario.sex === 'female') {
    await page.locator('.explore-sidebar').getByRole('button', { name: scenario.label, exact: true }).click();
    await ready(page);
  }
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5'); await ready(page);
  const canvas = page.locator('canvas');
  const before = await snapshot(page);
  const beforeIds = await canvas.getAttribute('data-visible-structure-ids');
  expect(before.displayMode).toBe('dissection');
  expect(before.camera).toBeTruthy();
  expect(beforeIds).toBeTruthy();
  await openTool(page, '구조 찾기');
  await page.getByLabel('해부 구조 검색').fill(scenario.id);
  // The male 4.0 stomach detail (BP4_) also cites FMA7148; this scenario needs the whole-body mesh.
  await page.locator('.structure-item').filter({ hasText: scenario.id }).filter({ hasNotText: 'BP4_' }).click(); await ready(page);
  await closeTool(page);
  const inside = await snapshot(page);
  expect(inside.selection.ids).toEqual([scenario.id]);
  expect(inside.detail).toBe(null);
  expect(inside.displayMode).toBe('layers');
  expect(inside.selectionReturn.dissection).toBe(50.5);
  await page.reload(); await ready(page);
  expect((await snapshot(page)).selectionReturn.dissection).toBe(50.5);
  await page.getByRole('button', { name: '구조 선택 해제', exact: true }).click(); await ready(page);
  const after = await snapshot(page);
  for (const key of ['sex', 'anatomyRegion', 'stage', 'dissection', 'displayMode', 'layers', 'alpha', 'markers', 'pointId', 'selectionTarget'])
    expect(after[key], key).toEqual(before[key]);
  expect(after.selection).toBe(null);
  expect(after.selectionReturn).toBe(null);
  await expect.poll(async () => {
    const pose = (await snapshot(page)).camera;
    return Math.max(...['position', 'target'].flatMap(key => pose[key].map((value: number, i: number) => Math.abs(value - before.camera[key][i]))));
  }).toBeLessThan(1e-6);
  await expect(canvas).toHaveAttribute('data-visible-structure-ids', beforeIds!);
  await page.screenshot({ path: `docs/anatomy-alignment/selection-peel-return-${scenario.sex}-desktop.png` });
  const desktopPose = (await snapshot(page)).camera;
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => {
    const mobilePose = (await snapshot(page)).camera;
    return Math.hypot(...mobilePose.position.map((value: number, i: number) => value - mobilePose.target[i]));
  }).toBeGreaterThan(Math.hypot(...desktopPose.position.map((value: number, i: number) => value - desktopPose.target[i])));
  await expect(canvas).toBeInViewport();
  await page.screenshot({ path: `docs/anatomy-alignment/selection-peel-return-${scenario.sex}-mobile.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('female ordinary organ selection then detail returns to its original peel and pose', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/'); await ready(page);
  await page.locator('.explore-sidebar').getByRole('button', { name: '여성', exact: true }).click(); await ready(page);
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5'); await ready(page);
  const before = await snapshot(page);
  const canvas = page.locator('canvas');
  const beforeIds = await canvas.getAttribute('data-visible-structure-ids');
  await openTool(page, '구조 찾기');
  await page.getByLabel('해부 구조 검색').fill('HRAF0435');
  await page.locator('.structure-item').filter({ hasText: 'HRAF0435' }).click(); await ready(page);
  await closeTool(page);
  await page.getByRole('button', { name: '기관 상세 보기', exact: true }).click(); await ready(page);
  expect((await snapshot(page)).detailReturn.camera).toEqual(before.camera);
  await page.getByRole('button', { name: '전신으로 돌아가기', exact: true }).click(); await ready(page);
  await expect.poll(async () => {
    const state = await snapshot(page);
    return Math.max(...['position', 'target'].flatMap(key => state.camera[key].map((value: number, i: number) => Math.abs(value - before.camera[key][i]))));
  }).toBeLessThan(1e-6);
  const after = await snapshot(page);
  expect(after.dissection).toBe(50.5);
  expect(after.displayMode).toBe('dissection');
  expect(after.selection).toBe(null);
  expect(after.detail).toBe(null);
  await expect(canvas).toHaveAttribute('data-visible-structure-ids', beforeIds!);
});
