// Measures scene overlays at desktop, laptop, tablet, mobile and landscape
// sizes in the initial, comparison and isolated-comparison states. Reports
// overlapping overlay pairs and active point labels outside the canvas.
// The visual gate (capture-workspace.mjs) asserts the four standard sizes;
// this audit adds laptop/tablet widths. It is not a physical-device test.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';

const origin = process.env.SMOKE_ORIGIN || 'http://127.0.0.1:5174';
const output = process.env.AUDIT_OUTPUT || 'docs/anatomy-alignment/scene-overlays.json';
const shots = process.env.AUDIT_SCREENSHOTS;
const viewports = [['desktop', 1440, 900], ['laptop', 1366, 768], ['small-laptop', 1280, 800], ['tablet-landscape', 1024, 768],
  ['tablet', 768, 1024], ['landscape', 844, 390], ['mobile', 390, 844], ['small-mobile', 360, 740]];
const OVERLAYS = ['.ax-search', '.ax-top-actions', '.ax-depth', '.ax-point-bar', '.ax-point-chip', '.detail-panel', '.selection-card',
  '.movement-pad', '.view-presets', '.view-tools', '.ax-status .scene-status', '.ax-status .scene-legend', '.ax-status .ax-source', '.cutaway-reset', '.comparison-note'];

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
    const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce'});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/#atlas/CV12');
    await page.getByText('해부 모델 로드 완료').waitFor({timeout: 90000});
    const settle = async state => {
      await page.mouse.move(1, 1); await page.waitForTimeout(400);
      if (shots) await page.screenshot({animations: 'disabled', path: `${shots}/${name}-${state}.png`});
      return measure(page);
    };
    const states = {initial: await settle('initial')};
    await page.locator('.point-summary').click();
    await page.getByRole('button', {name: '대응 장부의 해부 구조 비교'}).click();
    await page.getByText('해부 모델 로드 완료').waitFor();
    states.compare = await settle('compare');
    await page.getByRole('button', {name: '비교 대상만 보기'}).click();
    await page.locator('.selection-card').getByRole('button', {name: '확대', exact: true}).click();
    states.isolate = await settle('isolate');
    results.push({name, width, height, errors, states});
    await page.close();
  }
} finally { await browser.close(); }
const failures = results.flatMap(r => Object.entries(r.states).flatMap(([state, m]) => [
  ...m.overlaps.map(o => `${r.name} ${state}: ${o.a} × ${o.b} ${o.width}×${o.height}`),
  ...m.labels.filter(l => !l.insideCanvas).map(l => `${r.name} ${state}: label ${l.text} outside canvas`),
  ...m.offscreen.map(o => `${r.name} ${state}: ${o} off screen`)]).concat(r.errors.map(e => `${r.name}: ${e}`)));
await fs.writeFile(output, JSON.stringify({date: new Date().toISOString(), origin, viewports: results.length, failures, results}, null, 2) + '\n');
console.log(failures.length ? failures.join('\n') : `Scene overlays separate and point labels stay on canvas at ${results.length} viewports × 3 states.`);
if (failures.length) process.exitCode = 1;
