// Public check of acupoint picking (Q28) without dev-only hooks: marker screen
// positions are projected from the saved camera pose and the anchor data.
import { chromium } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import fs from 'node:fs';
const origin = process.env.PAGES_ORIGIN || 'https://jay-jang.github.io/gyeol-atlas/';
const anchors = JSON.parse(fs.readFileSync('data/anchors.json', 'utf8'));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = {};
const snap = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('gyeol-view-v2') || 'null'));
const settle = async (page) => { let last = ''; for (let i = 0; i < 20; i++) { await page.waitForTimeout(400); const now = JSON.stringify((await snap(page))?.camera); if (now === last) return; last = now; } };
async function project(page, mobile) {
  const box = await page.locator('canvas').boundingBox(), pose = (await snap(page)).camera;
  const cam = new PerspectiveCamera(39, box.width / box.height, .01, 20);
  cam.position.fromArray(pose.position); cam.lookAt(new Vector3(...pose.target));
  if (mobile) cam.setViewOffset(box.width, box.height, 28, (64 - 150) / 2, box.width, box.height);
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  return { box, points: anchors.map(a => { const v = new Vector3(...a.position).project(cam); return { id: a.pointId, side: a.side, x: box.x + (v.x + 1) * box.width / 2, y: box.y + (1 - v.y) * box.height / 2 }; }) };
}
// A front-midline (CV) marker far from every other anchor, inside the canvas.
function lone(p) {
  const inside = p.points.filter(a => a.x > p.box.x + 60 && a.x < p.box.x + p.box.width - 90 && a.y > p.box.y + 170 && a.y < p.box.y + p.box.height - 170);
  return inside.filter(a => a.id.startsWith('CV')).map(a => ({ ...a, gap: Math.min(...p.points.filter(b => b !== a).map(b => Math.hypot(a.x - b.x, a.y - b.y))) })).sort((a, b) => b.gap - a.gap)[0];
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin); await page.getByText('해부 모델 로드 완료').waitFor({ timeout: 180000 }); await settle(page);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '확대', exact: true }).last().click();
  await settle(page);
  const before = await snap(page), p = await project(page, false), m = lone(p);
  // Hover: cold 18px none, 11px hovered, drift 20px kept, click there selects.
  await page.mouse.move(m.x + 18, m.y); await page.waitForTimeout(200);
  const cold = await page.locator('.point-label').count();
  await page.mouse.move(m.x + 11, m.y, { steps: 3 }); await page.waitForTimeout(200);
  const hovered = await page.locator('.point-label.peek').textContent().catch(() => null);
  await page.mouse.move(m.x + 20, m.y, { steps: 3 }); await page.waitForTimeout(200);
  const kept = await page.locator('.point-label.peek').textContent().catch(() => null);
  await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(600);
  const picked = await snap(page);
  results.desktopHover = { marker: m.id, gapPx: Math.round(m.gap), cold, hovered, kept, pointId: picked.pointId, selection: picked.selection, cameraSame: same(picked.camera, before.camera), layersSame: same(picked.layers, before.layers) };
  // Tissue far from every anchor: selected in place.
  const q = await project(page, false);
  const spots = [];
  for (let y = q.box.y + q.box.height * .25; y < q.box.y + q.box.height * .75; y += 8) for (let x = q.box.x + q.box.width * .3; x < q.box.x + q.box.width * .7; x += 8)
    if (q.points.every(a => Math.hypot(a.x - x, a.y - y) > 40)) spots.push({ x, y, d: Math.hypot(x - (q.box.x + q.box.width / 2), y - (q.box.y + q.box.height / 2)) });
  spots.sort((a, b) => a.d - b.d);
  const pose = (await snap(page)).camera;
  for (const spot of spots.slice(0, 12)) {
    if (!(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', spot))) continue;
    await page.mouse.click(spot.x, spot.y); await page.waitForTimeout(900);
    const s = await snap(page);
    if (!s.selection) continue;
    results.desktopTissue = { selection: s.selection.ids, cameraSame: same(s.camera, pose), layersSame: same(s.layers, before.layers), dissection: s.dissection, displayMode: s.displayMode };
    await page.getByRole('button', { name: '구조 선택 해제', exact: true }).click(); await page.waitForTimeout(500);
    break;
  }
  // Drag that returns near its start: no selection.
  const t = spots.find(Boolean);
  await page.mouse.move(t.x, t.y); await page.mouse.down();
  await page.mouse.move(t.x + 60, t.y + 10, { steps: 8 }); await page.mouse.move(t.x + 2, t.y, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(600);
  results.desktopDrag = { selection: (await snap(page)).selection };
  results.desktopErrors = errors;
  await page.close();
}
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin); await page.getByText('해부 모델 로드 완료').waitFor({ timeout: 180000 }); await settle(page);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '확대', exact: true }).last().click();
  await settle(page);
  const before = await snap(page), p = await project(page, true), m = lone(p);
  await page.touchscreen.tap(m.x + 18, m.y); await page.waitForTimeout(700);
  const s = await snap(page);
  results.touch = { marker: m.id, gapPx: Math.round(m.gap), pointId: s.pointId, selection: s.selection, cameraSame: same(s.camera, before.camera), errors };
  await context.close();
}
results.origin = origin; results.checkedAt = new Date().toISOString();
fs.writeFileSync('docs/anatomy-alignment/picking-pages.json', JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results));
const failed = results.desktopHover.cold !== 0 || results.desktopHover.kept !== results.desktopHover.marker || results.desktopHover.pointId !== results.desktopHover.marker
  || !results.desktopHover.cameraSame || !results.desktopTissue?.cameraSame || !results.desktopTissue?.layersSame || results.desktopDrag.selection
  || results.touch.pointId !== results.touch.marker || !results.touch.cameraSame || results.desktopErrors.length || results.touch.errors.length;
if (failed) process.exitCode = 1;
await browser.close();
