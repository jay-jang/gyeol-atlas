import { test, expect } from '@playwright/test';
import { ready, snapshot, openTool, closeTool } from './helpers';
import femaleGroups from '../../data/female-organ-groups.json' with { type: 'json' };
import maleGroups from '../../data/male-detail-groups.json' with { type: 'json' };

test('organ details use their own complete source memberships and individual parts survive reload', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await ready(page);
  const canvas = page.locator('canvas');
  const visible = async () => (await canvas.getAttribute('data-visible-structure-ids') || '').split(',').filter(Boolean);
  for (const sex of ['male', 'female'] as const) {
    await page.locator('.explore-sidebar').getByRole('button', { name: sex === 'male' ? '남성' : '여성', exact: true }).click();
    await ready(page);
    const groups = sex === 'female' ? femaleGroups : maleGroups;
    for (const group of groups) {
      await page.locator('.featured-anatomy > button').filter({ has: page.getByText(group.name, { exact: true }) }).click();
      await ready(page);
      await expect.poll(async () => (await visible()).sort()).toEqual([...group.ids].sort());
      await expect.poll(async () => (await snapshot(page)).detail.id).toBe(group.id);
      await expect(canvas).toHaveAttribute('data-rendered-markers', '0');
      const bounds = JSON.parse(await canvas.getAttribute('data-selected-world-bounds') || 'null');
      expect(bounds).toBeTruthy();
      await expect.poll(async () => {
        const target = (await snapshot(page)).camera.target;
        return Math.max(...target.map((v: number, i: number) => Math.abs(v - (bounds[0][i] + bounds[1][i]) / 2)));
      }).toBeLessThan(.001);
      if (group.id === 'heart' || group.id === 'brain' || group.id === 'uterus') {
        await page.screenshot({ path: `docs/anatomy-alignment/${sex}-${group.id}.png` });
      }
    }
    await page.locator('.organ-detail-parts summary').click();
    const firstPart = page.locator('.organ-detail-parts button').first();
    await firstPart.click(); await ready(page);
    await expect.poll(async () => (await visible()).length).toBe(1);
    const selection = (await snapshot(page)).selection.ids;
    await page.reload(); await ready(page);
    await expect.poll(visible).toEqual(selection);
    expect((await snapshot(page)).detail).toBeTruthy();
    await page.getByRole('button', { name: '기관 전체 모형', exact: true }).click(); await ready(page);
    await expect.poll(async () => (await visible()).length).toBe(groups.at(-1)!.ids.length);
    await page.getByRole('button', { name: '전신으로 돌아가기', exact: true }).click(); await ready(page);
    expect((await snapshot(page)).detail).toBe(null);
  }
  await page.locator('.explore-sidebar').getByRole('button', { name: '남성', exact: true }).click(); await ready(page);
  await openTool(page, '구조 찾기');
  await page.getByLabel('해부 구조 검색').fill(maleGroups[0].ids[0]);
  await page.locator('.structure-item').click(); await ready(page);
  expect((await snapshot(page)).detail.id).toBe('heart');
  await expect.poll(visible).toEqual([maleGroups[0].ids[0]]);
  await closeTool(page);
  await page.getByRole('button', { name: '기관 전체 모형', exact: true }).click(); await ready(page);
  await expect.poll(async () => (await visible()).length).toBe(83);
  await page.locator('.explore-sidebar').getByRole('button', { name: '여성', exact: true }).click(); await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openTool(page, '구조 찾기');
  await page.getByLabel('해부 구조 검색').fill('심장');
  await page.locator('.structure-item').first().click(); await ready(page);
  await closeTool(page);
  await page.getByRole('button', { name: '기관 상세 보기', exact: true }).click(); await ready(page);
  await page.screenshot({ path: 'docs/anatomy-alignment/female-heart-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('female peeling exposes each system and does not leak male anatomy', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/'); await ready(page);
  await page.locator('.explore-sidebar').getByRole('button', { name: '여성', exact: true }).click(); await ready(page);
  const canvas = page.locator('canvas');
  const depth = page.getByLabel('연속 해부 박리 깊이');
  const expected: [number,string][] = [[0,'skin'],[20,'muscle'],[48,'bone'],[66,'organ'],[78,'vessel'],[88,'lymph'],[98,'nerve']];
  for (const [value,layer] of expected) {
    await depth.fill(String(value)); await ready(page);
    await expect.poll(async () => Number(await canvas.getAttribute(`data-visible-${layer}`))).toBeGreaterThan(0);
    const ids = (await canvas.getAttribute('data-visible-structure-ids') || '').split(',').filter(Boolean);
    expect(ids.every(id => !id.startsWith('ZA_') && !id.startsWith('BP4_') && !id.startsWith('FMA'))).toBe(true);
    await page.screenshot({ path: `docs/anatomy-alignment/female-peel-${value}.png` });
  }
  await depth.fill('50.5'); await expect(depth).toHaveValue('50.5');
  await page.locator('.explore-sidebar').getByRole('button', { name: '남성', exact: true }).click(); await ready(page);
  await expect(canvas).toHaveAttribute('data-model-sex', 'male');
  await expect.poll(async () => (await snapshot(page)).dissection).toBe(0);
});

test('a failed female geometry chunk shows a recoverable error and retry loads the independent body', async ({ page }) => {
  test.setTimeout(90000);
  await page.route('**/models/female/female-0.bin.gz', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/'); await ready(page);
  await page.locator('.explore-sidebar').getByRole('button', { name: '여성', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('3D 모델을 열지 못했습니다');
  await expect(page.getByRole('link', { name: '지식 위키', exact: true })).toBeVisible();
  await page.unroute('**/models/female/female-0.bin.gz');
  await page.getByRole('button', { name: '3D 다시 시도', exact: true }).click(); await ready(page);
  await expect.poll(async () => Number(await page.locator('canvas').getAttribute('data-visible-skin'))).toBe(20);
  await expect(page.locator('canvas')).toHaveAttribute('data-model-sex', 'female');
});

test('surface targeting exits organ detail and isolation for both reference bodies', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/'); await ready(page);
  for (const label of ['남성','여성']) {
    await page.locator('.explore-sidebar').getByRole('button', { name: label, exact: true }).click(); await ready(page);
    await page.locator('.featured-anatomy > button').filter({has:page.getByText('심장',{exact:true})}).click(); await ready(page);
    await page.locator('.organ-detail-parts summary').click();
    await page.locator('.organ-detail-parts button').first().click(); await ready(page);
    expect((await snapshot(page)).isolated).toBe(true);
    await openTool(page,'레이어 조절');
    await page.getByLabel('클릭 선택 대상').selectOption('skin'); await ready(page);
    const state = await snapshot(page);
    expect(state.detail).toBe(null); expect(state.selection).toBe(null); expect(state.isolated).toBe(false);
    await expect.poll(async()=>Number(await page.locator('canvas').getAttribute('data-visible-skin'))).toBe(label==='여성'?20:1);
    await closeTool(page);
  }
});
