import { test, expect, type Page } from '@playwright/test';
import { ready, openTool, openFilters, openSearch, snapshot, closeTool } from './helpers';
// Q47: a per-meridian 원·모·유·극·락 filter and a labelled way to deselect a point.
const rendered = async (page: Page) => ((await page.locator('canvas').getAttribute('data-rendered-point-ids')) || '').split(',').filter(Boolean).sort();
const lung = ['BL13', 'LU1', 'LU6', 'LU7', 'LU9'];

for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844], ['landscape', 844, 390]] as const) {
  test(`${name}: the meridian picker keeps only each meridian's own 원·모·유·극·락혈`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width, height }); await page.goto('/'); await ready(page);
    await page.locator('.ax-meridian-button').click();
    const picker = page.getByRole('group', { name: '경맥 선택', exact: true });
    await picker.getByRole('checkbox', { name: /원·모·유·극·락혈만/ }).check();
    await expect.poll(async () => (await rendered(page)).length).toBe(63);
    await expect(picker.getByRole('button', { name: '수태음폐경 경혈만 보기' }).locator('small')).toHaveText('5');
    await expect(picker.getByRole('button', { name: '모든 경맥의 경혈 보기' }).locator('small')).toHaveText('63');
    await expect(page.locator('.ax-meridians button')).toHaveCount(16);
    await page.screenshot({ path: `docs/acupoint-key-filter/${name}-picker.png` });
    await picker.getByRole('button', { name: '수태음폐경 경혈만 보기' }).click();
    await expect.poll(() => rendered(page)).toEqual(lung);
    expect((await snapshot(page)).filters).toMatchObject({ concept: 'key', meridian: 'LU' });
    // The list names the same filter and keeps the lung's back-shu BL13.
    await openTool(page, '경혈 찾기'); await openFilters(page);
    await expect(page.getByLabel('경혈 분류', { exact: true })).toHaveValue('key');
    await expect(page.locator('.point-item')).toHaveCount(5);
    await expect(page.locator('.point-item').filter({ hasText: 'BL13' })).toContainText('유혈');
    await expect(page.locator('.ax-filters')).toContainText('폐의 유혈 BL13');
    await closeTool(page);
    await page.getByRole('button', { name: '후면', exact: true }).click().catch(async () => {});
    await page.screenshot({ path: `docs/acupoint-key-filter/${name}-lung.png` });
    // Unchecking returns every lung meridian point.
    await page.locator('.ax-meridian-button').click();
    await picker.getByRole('checkbox', { name: /원·모·유·극·락혈만/ }).uncheck();
    await expect.poll(async () => (await rendered(page)).length).toBe(11);
    expect(errors).toEqual([]);
  });

  test(`${name}: a selected point is deselected from its detail panel or the labelled chip button`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.goto('/'); await ready(page);
    await (await openSearch(page)).fill('BL40');
    await page.getByRole('region', { name: '검색 결과', exact: true }).locator('.point-item').filter({ hasText: 'BL40' }).first().click();
    await expect(page).toHaveURL(/#atlas\/BL40$/);
    await page.locator('.point-summary').click();
    const detail = page.locator('.detail-panel');
    await expect(detail.getByRole('button', { name: '경혈 선택 해제', exact: true })).toBeVisible();
    await page.screenshot({ path: `docs/acupoint-key-filter/${name}-detail-clear.png` });
    await detail.getByRole('button', { name: '경혈 선택 해제', exact: true }).click();
    await expect(page).toHaveURL(/#atlas$/);
    await expect(page.locator('.point-summary')).toHaveCount(0);
    await expect(page.locator('.detail-panel')).toHaveCount(0);
    await expect(page.locator('.ax-point-empty')).toBeFocused();
    // The chip's own button says what it does where there is room.
    await page.goto('/#atlas/BL40'); await ready(page);
    const chipClear = page.locator('.ax-point-chip').getByRole('button', { name: '경혈 선택 해제', exact: true });
    if (width > 1000) await expect(chipClear).toHaveText('해제'); else await expect(chipClear.locator('.clear-text')).toBeHidden();
    await chipClear.click();
    await expect(page.locator('.point-summary')).toHaveCount(0);
  });
}
