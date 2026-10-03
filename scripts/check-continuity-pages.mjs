// Public check of view continuity (Q30) without dev-only hooks: an organ
// picked from search stays selected and in view through peeling, choosing an
// acupoint and clearing; with motion allowed, framing glides to the same pose.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.PAGES_ORIGIN || "https://jay-jang.github.io/gyeol-atlas/";
const browser = await chromium.launch({ headless: true, args: process.env.PLAYWRIGHT_GPU === "1"
  ? ["--no-sandbox", "--use-gl=angle", "--use-angle=metal", "--ignore-gpu-blocklist"] : ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const snap = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("gyeol-view-v2")));
const settle = async (page) => { let last = ""; for (let i = 0; i < 25; i++) { await page.waitForTimeout(400); const now = JSON.stringify((await snap(page)).camera); if (now === last) return; last = now; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const results = { origin, checkedAt: new Date().toISOString() };
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin); await page.getByText("해부 모델 로드 완료").waitFor({ timeout: 180000 });
  await page.getByLabel("연속 해부 박리 깊이").fill("40"); await settle(page);
  const input = page.getByLabel("경혈·구조 검색"); await input.click(); await input.fill("stomach");
  await page.locator(".structure-item").first().click(); await settle(page);
  let s = await snap(page); const studied = s.camera;
  results.picked = { ids: s.selection?.ids, layers: s.selection?.layers };
  await page.getByLabel("연속 해부 박리 깊이").fill("60"); await settle(page);
  s = await snap(page); results.peeled = { dissection: s.dissection, ids: s.selection?.ids, cameraSame: same(s.camera, studied) };
  await page.getByRole("button", { name: "경혈 찾기", exact: true }).click();
  await page.getByLabel("경혈 검색").fill("CV12"); await page.locator(".point-item").filter({ hasText: "CV12" }).first().click(); await settle(page);
  s = await snap(page); results.acupoint = { pointId: s.pointId, ids: s.selection?.ids, cameraSame: same(s.camera, studied) };
  await page.getByRole("button", { name: "구조 선택 해제", exact: true }).click(); await settle(page);
  s = await snap(page); results.cleared = { selection: s.selection, dissection: s.dissection, cameraSame: same(s.camera, studied) };
  results.errors = errors;
  await page.close();
}
{
  // With motion allowed, sample the saved pose while a framing move runs.
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  await page.goto(origin); await page.getByText("해부 모델 로드 완료").waitFor({ timeout: 180000 });
  const input = page.getByLabel("경혈·구조 검색"); await input.click(); await input.fill("stomach");
  await page.locator(".structure-item").first().click(); await settle(page);
  const gap = (c) => Math.hypot(...c.position.map((v, i) => v - c.target[i]));
  const start = gap((await snap(page)).camera);
  // The canvas pixels change across several frames during a glide.
  const frames = [];
  await page.getByRole("button", { name: "계통 전체 보기", exact: true }).click();
  for (let i = 0; i < 6; i++) { frames.push((await page.locator("canvas").screenshot()).toString("base64").length); await page.waitForTimeout(60); }
  await settle(page);
  results.glide = { startDistance: +start.toFixed(4), endDistance: +gap((await snap(page)).camera).toFixed(4), distinctFrames: new Set(frames).size };
  await page.close();
}
await browser.close();
fs.writeFileSync("docs/ui-renewal/continuity-pages.json", JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results));
const ok = results.picked.ids?.[0] === "FMA7148" && results.peeled.dissection === 60 && results.peeled.ids?.[0] === "FMA7148" && results.peeled.cameraSame
  && results.acupoint.pointId === "CV12" && results.acupoint.ids?.[0] === "FMA7148" && results.acupoint.cameraSame
  && results.cleared.selection === null && results.cleared.cameraSame && !results.errors.length && results.glide.endDistance > results.glide.startDistance * 2;
if (!ok) process.exitCode = 1;
