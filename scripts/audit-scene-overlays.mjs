// Measures scene overlays at desktop, laptop, tablet, mobile and landscape
// sizes in the initial, comparison and isolated-comparison states. Reports
// overlapping overlay pairs and active point labels outside the canvas.
// The visual gate (capture-workspace.mjs) asserts the four standard sizes;
// this audit adds laptop/tablet widths. Where the depth button shows (phones
// and short landscape) the open depth band is measured too, alone and over a
// comparison, and held to the 45% panel limit. It is not a physical-device test.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';

const origin = process.env.SMOKE_ORIGIN || 'http://127.0.0.1:5174';
const output = process.env.AUDIT_OUTPUT || 'docs/anatomy-alignment/scene-overlays.json';
const shots = process.env.AUDIT_SCREENSHOTS;
const viewports = [['desktop', 1440, 900], ['laptop', 1366, 768], ['small-laptop', 1280, 800], ['tablet-landscape', 1024, 768],
  ['tablet', 768, 1024], ['landscape', 844, 390], ['mobile', 390, 844], ['small-mobile', 360, 740]];
// Open panels and pickers are measured too (2026-10-16 renewal, CONSENSUS G-01/G-20).
const OVERLAYS = ['.ax-search', '.ax-top-actions', '.ax-depth', '.ax-point-bar', '.ax-point-chip', '.detail-panel', '.selection-card',
  '.movement-pad', '.view-presets', '.view-tools', '.ax-status .scene-status', '.ax-status .ax-source', '.cutaway-reset', '.comparison-note',
  '.ax-results', '.ax-side-panel', '.ax-popover', '.ax-depth .depth-band', '.ax-depth .depth-steps', '.ax-present-exit'];

const measure = page => page.evaluate(selectors => {
  const shown = el => { const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0; };
  const round = r => ({x: +r.x.toFixed(1), y: +r.y.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1)});
  const boxes = [...new Set(selectors.flatMap(sel => [...document.querySelectorAll(sel)]))].filter(shown)
    .map(el => ({el, name: el.className, r: el.getBoundingClientRect()}));
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 1 && h > 1) overlaps.push({a: a.name, b: b.name, width: +w.toFixed(1), height: +h.toFixed(1)});
  }
  const c = document.querySelector('canvas').getBoundingClientRect();
  const labels = [...document.querySelectorAll('.point-label.active')].filter(shown).map(el => {
    const r = el.getBoundingClientRect();
    return {text: el.innerText.replace(/\s+/g, ' '), ...round(r),
      insideCanvas: r.left >= c.left - .5 && r.right <= c.right + .5 && r.top >= c.top - .5 && r.bottom <= c.bottom + .5};
  });
  const offscreen = boxes.filter(b => b.r.left < -.5 || b.r.top < -.5 || b.r.right > innerWidth + .5 || b.r.bottom > innerHeight + .5).map(b => b.name);
  return {canvas: round(c), boxes: boxes.map(b => ({name: b.name, ...round(b.r)})), overlaps, labels, offscreen};
}, OVERLAYS);

const browser = await chromium.launch({headless: true, args:process.env.PLAYWRIGHT_GPU==='1'?['--no-sandbox','--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist']:['--no-sandbox','--enable-unsafe-swiftshader']});
const results = [];
try {
  for (const [name, width, height] of viewports) {
    // Phones and tablets are measured as touch devices (44px controls).
    const touch = width < 1100 && (width <= 900 || height > width);
    const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce', hasTouch: touch, isMobile: touch && width <= 900});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/#atlas/CV12');
    await page.getByText('해부 모델 로드 완료').waitFor({timeout: 90000});
    const settle = async state => {
      if (process.env.AUDIT_VERBOSE) console.log(`${name} ${state}`);
      await page.mouse.move(1, 1); await page.waitForTimeout(400);
      if (shots) await page.screenshot({animations: 'disabled', path: `${shots}/${name}-${state}.png`});
      return measure(page);
    };
    const states = {initial: await settle('initial')};
    const phone = width <= 700 || height <= 500, panelLimit = [];
    const panelHeight = async (state, selector) => {
      const [box, canvas] = [await page.locator(selector).boundingBox(), await page.locator('canvas').boundingBox()];
      if (phone && box && canvas && box.height > canvas.height * .45 + 1) panelLimit.push(`${state}: ${selector} ${box.height.toFixed(1)} > 45% of ${canvas.height.toFixed(1)}`);
    };
    // The depth band (phones: band over its steps; short landscape: the steps
    // beside the rail) is measured as one panel: the union of what is shown.
    const depthBand = async state => {
      const parts = await page.locator('.ax-depth :is(.depth-band, .depth-steps)').evaluateAll(els => els.filter(el => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        // Visually hidden parts (the landscape heading kept for its live region) do not count.
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1 && r.height > 1;
      }).map(el => { const r = el.getBoundingClientRect(); return [r.top, r.bottom]; }));
      const canvas = await page.locator('canvas').boundingBox();
      if (!parts.length) { panelLimit.push(`${state}: depth band not shown`); return; }
      const height = Math.max(...parts.map(p => p[1])) - Math.min(...parts.map(p => p[0]));
      if (phone && canvas && height > canvas.height * .45 + 1) panelLimit.push(`${state}: depth band ${height.toFixed(1)} > 45% of ${canvas.height.toFixed(1)}`);
    };
    const view = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('gyeol-view-v2') || 'null')?.camera);
    await page.getByLabel('경혈·구조 검색').click(); await page.getByLabel('경혈·구조 검색').fill('위');
    states.search = await settle('search'); await panelHeight('search', '.ax-results'); await page.keyboard.press('Escape');
    for (const [state, button, region] of [['display', '표시 설정', '표시 설정'], ['points', '경혈 찾기', '경혈 목록'], ['help', '도움말', '도움말']]) {
      await page.getByRole('button', {name: button, exact: true}).first().click();
      await page.getByRole('region', {name: region, exact: true}).waitFor();
      states[state] = await settle(state); await panelHeight(state, '.ax-side-panel'); await page.keyboard.press('Escape');
    }
    await page.locator('.ax-meridian-button').click(); states.meridian = await settle('meridian'); await page.keyboard.press('Escape');
    // A selected structure keeps its name and its actions visible together in the card.
    await page.getByLabel('경혈·구조 검색').click(); await page.getByLabel('경혈·구조 검색').fill('stomach');
    await page.locator('.structure-item').first().click(); await page.getByText('해부 모델 로드 완료').waitFor();
    states.structure = await settle('structure');
    const cardParts = await page.locator('.selection-card').evaluate(card => {
      const c = card.getBoundingClientRect(), inside = el => { const r = el.getBoundingClientRect(); return r.top >= c.top - .5 && r.bottom <= c.bottom + .5; };
      const actions = card.querySelector('.selection-actions').getBoundingClientRect(), title = card.querySelector('strong').getBoundingClientRect();
      return {title: inside(card.querySelector('strong')) && title.bottom <= actions.top + .5, actions: inside(card.querySelector('.selection-actions'))};
    });
    if (!cardParts.title || !cardParts.actions) panelLimit.push(`structure: card title ${cardParts.title ? 'shown' : 'hidden'}, actions ${cardParts.actions ? 'shown' : 'hidden'}`);
    await page.getByRole('button', {name: '구조 선택 해제', exact: true}).click(); await page.getByText('해부 모델 로드 완료').waitFor();
    await page.getByLabel('경혈·구조 검색').fill(''); await page.keyboard.press('Escape');
    // Phones and short landscape open the depth stops from the depth button.
    if (await page.locator('.depth-toggle').isVisible()) { await page.locator('.depth-toggle').click(); states.depth = await settle('depth'); await depthBand('depth'); await page.keyboard.press('Escape'); }
    await page.locator('.point-summary').click();
    await page.getByRole('button', {name: '대응 장부의 해부 구조 비교'}).click();
    await page.getByText('해부 모델 로드 완료').waitFor();
    states.compare = await settle('compare');
    const compareCard = await page.locator('.selection-card').evaluate(card => {
      const c = card.getBoundingClientRect(), actions = card.querySelector('.selection-actions').getBoundingClientRect();
      const note = card.querySelector('.comparison-note').getBoundingClientRect();
      // Visible = inside the card and not under its pinned action row.
      return {note: note.top >= c.top - .5 && note.bottom <= Math.min(c.bottom, actions.top) + .5, actions: actions.top >= c.top - .5 && actions.bottom <= c.bottom + .5};
    });
    if (!compareCard.note || !compareCard.actions) panelLimit.push(`compare: card notice ${compareCard.note ? 'shown' : 'covered'}, actions ${compareCard.actions ? 'shown' : 'hidden'}`);
    // The depth band over a comparison carries its limits (phones: in the
    // band's hint line; short landscape: a row above the steps), within 45%.
    if (await page.locator('.depth-toggle').isVisible()) {
      await page.locator('.depth-toggle').click();
      states['depth-compare'] = await settle('depth-compare'); await depthBand('depth-compare');
      const bandNote = await page.locator('.ax-depth .panel-comparison-note').filter({visible: true}).first().innerText().catch(() => '');
      if (!/전통적 대응, 압력 경로 아님/.test(bandNote)) panelLimit.push('depth-compare: comparison note missing in the open depth band');
      await page.keyboard.press('Escape');
    }
    // A tool panel over a comparison keeps its limits in view and the camera still.
    const before = await view();
    await page.getByRole('button', {name: '표시 설정', exact: true}).click();
    states['compare-display'] = await settle('compare-display');
    const note = await page.locator('.ax-side-panel .panel-comparison-note').innerText().catch(() => '');
    if (!/전통적 대응, 압력 경로 아님/.test(note)) panelLimit.push('compare-display: comparison note missing in the open panel');
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    if (JSON.stringify(await view()) !== JSON.stringify(before)) panelLimit.push('compare-display: camera moved when a panel opened/closed');
    await page.getByRole('button', {name: '비교 대상만 보기'}).click();
    await page.locator('.selection-card').getByRole('button', {name: '확대', exact: true}).click();
    states.isolate = await settle('isolate');
    // Female view with its hidden-marker notice in the acupoint bar (Q26).
    await page.locator('.ax-top').getByRole('button', {name: '여성', exact: true}).click(); await page.getByText('해부 모델 로드 완료').waitFor({timeout: 90000});
    states.female = await settle('female');
    results.push({name, width, height, touch, errors, panelLimit, states});
    await page.close();
  }
} finally { await browser.close(); }
const failures = results.flatMap(r => Object.entries(r.states).flatMap(([state, m]) => [
  ...m.overlaps.map(o => `${r.name} ${state}: ${o.a} × ${o.b} ${o.width}×${o.height}`),
  ...m.labels.filter(l => !l.insideCanvas).map(l => `${r.name} ${state}: label ${l.text} outside canvas`),
  ...m.offscreen.map(o => `${r.name} ${state}: ${o} off screen`)]).concat(r.errors.map(e => `${r.name}: ${e}`), r.panelLimit.map(p => `${r.name} ${p}`)));
await fs.writeFile(output, JSON.stringify({date: new Date().toISOString(), origin, viewports: results.length, failures, results}, null, 2) + '\n');
const measured = results.reduce((n, r) => n + Object.keys(r.states).length, 0);
console.log(failures.length ? failures.join('\n') : `Scene overlays separate, phone panels and depth bands stay within 45% and point labels stay on canvas at ${results.length} viewports (${measured} measured states; depth band states: ${results.filter(r => r.states.depth).map(r => r.name).join(', ')}).`);
if (failures.length) process.exitCode = 1;
