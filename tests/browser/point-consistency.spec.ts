import { test, expect, type Page } from '@playwright/test';
import { ready, openTool, openFilters, openSearch, organs, snapshot, closeTool } from './helpers';
// Q46: the list, the bar, the count and the model agree on every filter and
// search choice, and an organ view names its zang-fu's 원·모·유·극·락혈.
const yuan = 'BL64 GB40 HT7 KI3 LI4 LR3 LU9 PC7 SI4 SP3 ST42 TE4'.split(' ');
const lung = 'BL13 LU1 LU10 LU11 LU2 LU3 LU4 LU5 LU6 LU7 LU8 LU9'.split(' ');
const rendered = async (page: Page) => ((await page.locator('canvas').getAttribute('data-rendered-point-ids')) || '').split(',').filter(Boolean).sort();
const named = async (page: Page) => (await page.locator('canvas').getAttribute('data-named-point-ids')) || '';
const count = (page: Page) => page.locator('.ax-marker-toggle small');
const barFilter = (page: Page) => page.getByRole('group', { name: '적용 중인 경혈 필터', exact: true });
// The bar's buttons stay inside the viewport and never cover each other.
async function barFits(page: Page) {
  const boxes = await page.locator('.ax-point-bar').evaluate(bar => [...bar.querySelectorAll('button')]
    .filter(b => b.getClientRects().length).map(b => { const r = b.getBoundingClientRect(); return { name: b.getAttribute('aria-label') || b.textContent, l: r.left, r: r.right, t: r.top, b: r.bottom }; }));
  const width = await page.evaluate(() => innerWidth);
  for (const b of boxes) { expect(b.l, b.name!).toBeGreaterThanOrEqual(0); expect(b.r, b.name!).toBeLessThanOrEqual(width); }
  for (const a of boxes) for (const b of boxes) if (a !== b) expect(a.r <= b.l + .5 || b.r <= a.l + .5 || a.b <= b.t + .5 || b.b <= a.t + .5, `${a.name} / ${b.name}`).toBe(true);
  // The status line keeps its '학습용 근사' link whole (QUALITY: 상태 줄은 한 줄로 늘 보입니다).
  const guide = await page.locator('.scene-guide').evaluate(el => { const r = el.getBoundingClientRect(), source = el.closest('.ax-source')!, p = source.getBoundingClientRect();
    return r.width > 0 && r.left >= p.left - .5 && r.right <= p.right + .5 && source.scrollWidth <= source.clientWidth + 1; });
  expect(guide, '학습용 근사 stays whole').toBe(true);
}
const views = [['desktop', 1440, 900], ['mobile', 390, 844], ['small-mobile', 360, 740], ['landscape', 844, 390]] as const;

for (const [name, width, height] of views) {
  test(`${name}: filter and search choices show and clear the same way on the model`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width, height }); await page.goto('/'); await ready(page);
    expect(await rendered(page)).toHaveLength(409);
    // Hidden markers: choosing a filter draws its result (not a silent list change).
    await page.locator('.ax-marker-toggle').click();
    await expect.poll(() => rendered(page)).toEqual([]);
    await openTool(page, '경혈 찾기'); await openFilters(page);
    await page.getByLabel('경혈 분류', { exact: true }).selectOption('yuan');
    await expect.poll(() => rendered(page)).toEqual([...yuan].sort());
    await expect(count(page)).toHaveText('12/409');
    await expect(page.getByRole('region', { name: '경혈 목록', exact: true }).locator('.ax-panel-head small')).toHaveText('12/409');
    await closeTool(page);
    // The bar names the filter while the panel is closed; phones keep one row,
    // so the list button counts it and the list names and clears it.
    const phone = width <= 1000; // the compact bar (list-button count) up to 1000px
    if (phone) {
      await expect(barFilter(page)).toHaveCount(0);
      await expect(page.locator('.ax-list-toggle .ax-filter-count')).toHaveText('1');
      await expect(page.getByRole('button', { name: '경혈 찾기', exact: true })).toHaveAccessibleDescription(/필터 1개: 원혈/);
    } else await expect(barFilter(page).getByRole('button', { name: /경혈 필터 원혈/ })).toBeVisible();
    await expect(count(page)).toHaveText('12/409');
    await barFits(page);
    await page.screenshot({ path: `docs/acupoint-consistency/${name}-filter-bar.png` });
    if (phone) await openTool(page, '경혈 찾기');
    if (phone) {
      // The list head's release never covers the search row's 저장 toggle.
      const [release, keep] = [await page.locator('.ax-filter-release').boundingBox(), await page.locator('.ax-list-search .ax-ghost').boundingBox()];
      expect(release!.x >= keep!.x + keep!.width - .5 || release!.y >= keep!.y + keep!.height - .5 || keep!.y >= release!.y + release!.height - .5, 'release / 저장').toBe(true);
      await expect(page.locator('.ax-filter-release')).not.toBeFocused();
    }
    await page.getByRole('button', { name: '경혈 필터 해제', exact: true }).click();
    if (phone) await closeTool(page);
    await expect(barFilter(page)).toHaveCount(0);
    await expect(page.locator('.ax-filter-count')).toHaveCount(0);
    await expect.poll(async () => (await rendered(page)).length).toBe(409);
    await expect(count(page)).toHaveText('409');
    // Points found by search become the same kind of filter.
    const input = await openSearch(page); await input.fill('폐');
    const apply = page.getByRole('button', { name: /찾은 경혈 \d+개만 모델에 표시/ });
    const found = Number((await apply.textContent())!.match(/(\d+)개/)![1]);
    await apply.click();
    await expect.poll(async () => (await rendered(page)).length).toBe(found);
    await expect(count(page)).toHaveText(`${found}/409`);
    if (width > 1000) await expect(barFilter(page).getByRole('button', { name: /경혈 필터 “폐”/ })).toBeVisible();
    else await expect(page.getByRole('button', { name: '경혈 찾기', exact: true })).toHaveAccessibleDescription(/“폐”/);
    expect((await snapshot(page)).filters.query).toBe('폐');
    // Picking a found point selects it; deselecting leaves the result drawn.
    await (await openSearch(page)).fill('LU9');
    await page.getByRole('region', { name: '검색 결과', exact: true }).locator('.point-item').filter({ hasText: 'LU9' }).first().click();
    await expect(page).toHaveURL(/#atlas\/LU9$/);
    await page.getByRole('button', { name: '경혈 선택 해제', exact: true }).click();
    await expect(page).toHaveURL(/#atlas$/);
    await expect(page.locator('.point-summary')).toHaveCount(0);
    expect(await rendered(page)).toContain('LU9');
    await expect(count(page)).toHaveText(`${found}/409`);
    await barFits(page);
    expect(errors).toEqual([]);
  });

  test(`${name}: an organ view names its zang-fu's source, front-mu, back-shu, xi-cleft and connecting points`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width, height }); await page.goto('/'); await ready(page);
    await (await organs(page)).filter({ hasText: /^폐/ }).first().click(); await ready(page);
    const card = page.locator('.selection-card');
    const section = card.getByRole('region', { name: '폐 원·모·유·극·락혈', exact: true });
    await expect(section.locator(':scope > .organ-point-chips button')).toHaveText(['원태연LU9', '모중부LU1', '유폐수BL13', '극공최LU6', '락열결LU7']);
    // The five-shu points fold under their own summary, each with its shu type.
    await section.locator('.organ-five-shu > summary').click();
    await expect(section.locator('.organ-five-shu button')).toHaveText(['정소상LU11', '형어제LU10', '수태연LU9', '경경거LU8', '합척택LU5']);
    await expect(section.getByRole('button', { name: '오수혈 정(井) 소상 LU11 선택', exact: true })).toBeVisible();
    await expect(section.getByRole('button', { name: '원혈 태연 LU9 선택', exact: true })).toBeVisible();
    await expect(card.locator('.organ-points-note')).toContainText('해부학적 연결·압력 경로·효능을 뜻하지 않습니다');
    // The detail draws no markers; the list says so and offers the way back.
    await openTool(page, '경혈 찾기');
    await expect(page.locator('[data-model-note]')).toContainText('기관 상세 모형에는 경혈 표식을 그리지 않습니다');
    await closeTool(page);
    await page.screenshot({ path: `docs/acupoint-consistency/${name}-organ-card.png` });
    await card.getByRole('button', { name: '폐 경혈 몸에서 보기', exact: true }).click(); await ready(page);
    const state = await snapshot(page);
    expect([state.detail, state.markers, state.filters.organ, state.filters.concept]).toEqual([null, 'filtered', 'LU', 'all']);
    await expect.poll(() => rendered(page)).toEqual([...lung].sort());
    await expect.poll(() => named(page)).toBe('LU9,LU1,BL13,LU6,LU7');
    // One label per named point, its classes beside the name in every colour mode.
    await expect(page.locator('.point-label.named')).toHaveCount(5);
    await expect(page.locator('.point-label.named[data-point-id="LU9"] .marker-class-tag')).toHaveText(['원', '수']);
    await expect(page.locator('.point-label.named[data-point-id="BL13"] .marker-class-tag')).toHaveText(['유']);
    if (width > 1000) await expect(barFilter(page).getByRole('button', { name: /경혈 필터 폐/ })).toBeVisible();
    else await expect(page.locator('.ax-list-toggle .ax-filter-count')).toHaveText('1');
    await expect(count(page)).toHaveText('12/409');
    await barFits(page);
    await page.screenshot({ path: `docs/acupoint-consistency/${name}-organ-body.png` });
    // The organ filter's list leads with the same five points.
    await openTool(page, '경혈 찾기');
    const listed = page.getByRole('region', { name: '경혈 목록', exact: true }).getByRole('region', { name: '폐 원·모·유·극·락혈', exact: true });
    await listed.getByRole('button', { name: '극혈 공최 LU6 선택', exact: true }).click();
    await expect(page).toHaveURL(/#atlas\/LU6$/);
    expect(errors).toEqual([]);
  });
}

test('a picked point is drawn while markers are hidden and the list explains every narrower model', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await page.locator('.ax-marker-toggle').click();
  await (await openSearch(page)).fill('ST36');
  await page.getByRole('region', { name: '검색 결과', exact: true }).locator('.point-item').filter({ hasText: 'ST36' }).first().click();
  await expect.poll(() => rendered(page)).toEqual(['ST36']);
  expect((await snapshot(page)).markers).toBe('selected');
  await expect(count(page)).toHaveText('1');
  await openTool(page, '경혈 찾기');
  await expect(page.locator('[data-model-note]')).toContainText('선택 경혈만 그리는 중입니다');
  await page.locator('[data-model-note]').getByRole('button', { name: '결과 409개 그리기', exact: true }).click();
  await expect.poll(async () => (await rendered(page)).length).toBe(409);
  await expect(page.locator('[data-model-note]')).toHaveCount(0);
  // The meridian picker and the list's meridian select are the same filter.
  await page.locator('.ax-marker-toggle').click();
  await openFilters(page);
  await page.getByLabel('경맥 선택', { exact: true }).selectOption('LU');
  await expect.poll(async () => (await rendered(page)).length).toBe(12); // 11 LU + ST36 reference
  await expect(count(page)).toHaveText('11/409');
  await expect(page.locator('[data-filter-reference]')).toContainText('ST36');
  await closeTool(page);
  await expect(page.locator('.ax-meridian-button')).toContainText('폐경');
  await expect(barFilter(page)).toHaveCount(0);
  // The bar's clear keeps the meridian, which its own picker shows.
  await openTool(page, '경혈 찾기'); await openFilters(page);
  await page.getByLabel('경혈 분류', { exact: true }).selectOption('luo'); await closeTool(page);
  await expect.poll(() => rendered(page)).toEqual(['LU7', 'ST36']);
  await page.getByRole('button', { name: '경혈 필터 해제', exact: true }).click();
  expect((await snapshot(page)).filters).toMatchObject({ meridian: 'LU', concept: 'all' });
  // Female markers hidden: the list names the reason and the way to show them.
  await page.locator('.ax-top').getByRole('button', { name: '여성', exact: true }).click(); await ready(page);
  await openTool(page, '경혈 찾기');
  await expect(page.locator('[data-model-note]')).toContainText('여성 경혈 좌표는 검수 전이라 모델에 그리지 않습니다');
});

test('body selections, comparisons and both bodies map organs to zang-fu without inventing one', async ({ page }) => {
  await page.goto('/'); await ready(page);
  // A whole-body organ mesh names its zang-fu's points on the drawn body.
  await (await openSearch(page)).fill('FMA7148');
  await page.getByRole('region', { name: '검색 결과', exact: true }).locator('.structure-item').filter({ hasText: 'FMA7148' }).first().click(); await ready(page);
  await expect(page.locator('.selection-card').getByRole('region', { name: '위 원·모·유·극·락혈', exact: true })).toBeVisible();
  await expect.poll(() => named(page)).toBe('ST42,CV12,BL21,ST34,ST40');
  // An unrelated structure has no zang-fu section.
  await (await openSearch(page)).fill('FMA24474');
  await page.getByRole('region', { name: '검색 결과', exact: true }).locator('.structure-item').filter({ hasText: 'FMA24474' }).first().click(); await ready(page);
  await expect(page.locator('.selection-card [data-organ-points]')).toHaveCount(0);
  await expect.poll(() => named(page)).toBe('');
  // A Back-Shu comparison shows the zang-fu it compares.
  await page.goto('/#atlas/BL13'); await ready(page);
  await page.locator('.point-summary').click();
  await page.getByRole('button', { name: '대응 장부의 해부 구조 비교', exact: true }).click(); await ready(page);
  await expect(page.locator('.selection-card').getByRole('region', { name: '폐 원·모·유·극·락혈', exact: true })).toBeVisible();
  await expect(page.locator('.selection-card')).toContainText('전통적 대응, 압력 경로 아님');
  // Female intestine: the large and small intestine zang-fu both apply.
  await page.locator('.ax-top').getByRole('button', { name: '여성', exact: true }).click(); await ready(page);
  await (await organs(page)).filter({ hasText: /^장/ }).first().click(); await ready(page);
  await expect(page.locator('.selection-card section.organ-points')).toHaveCount(2);
  await expect(page.locator('.selection-card').getByRole('region', { name: '대장 원·모·유·극·락혈', exact: true })).toBeVisible();
  await expect(page.locator('.selection-card').getByRole('region', { name: '소장 원·모·유·극·락혈', exact: true })).toBeVisible();
  // Organs without a single zang-fu mesh relation (uterus) get no section.
  await (await organs(page)).filter({ hasText: /^자궁/ }).first().click(); await ready(page);
  await expect(page.locator('.selection-card [data-organ-points]')).toHaveCount(0);
  await closeTool(page);
});

test('a long filter set fits the bar beside the status and camera tools at laptop width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('/'); await ready(page);
  await openTool(page, '경혈 찾기'); await openFilters(page);
  await page.getByLabel('경혈 검색', { exact: true }).fill('폐');
  await page.getByLabel('경혈 분류', { exact: true }).selectOption('five-shu');
  await page.getByLabel('연결 장부', { exact: true }).selectOption('KI');
  await page.getByLabel('수록 범위', { exact: true }).selectOption('classical');
  await closeTool(page);
  await expect(barFilter(page)).toBeVisible();
  await expect(barFilter(page).getByRole('button', { name: /신\(腎\)/ })).toBeVisible();
  const chip = await barFilter(page).locator('.ax-toggle').first().evaluate(el => el.getBoundingClientRect().right <= el.parentElement!.getBoundingClientRect().right + .5);
  expect(chip).toBe(true);
  await barFits(page);
  // Clearing from the bar hands focus to the list button.
  await page.getByRole('button', { name: '경혈 필터 해제', exact: true }).click();
  await expect(page.locator('.ax-list-toggle')).toBeFocused();
});
