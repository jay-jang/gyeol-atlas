// Close views of the right male hand (palm and back) and both feet at 0% (every system present under
// the skin) for the skeleton-fitted registration. ORIGIN selects the build;
// PREFIX names the files so an older build can be captured for comparison.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN || "http://127.0.0.1:5174/";
const prefix = process.env.PREFIX || "male-hand";
const dir = process.env.DIR || "docs/anatomy-alignment";
const views = {
  "right-palm": { target: [-0.272, 0.756, 0.053], position: [-0.272, 0.79, 0.43] },
  "right-back": { target: [-0.272, 0.756, 0.053], position: [-0.272, 0.79, -0.33] },
  "right-foot": { target: [-0.09, 0.05, 0.03], position: [-0.2, 0.32, 0.45] },
};
const browser = await chromium.launch({ headless: true, args: process.env.PLAYWRIGHT_GPU === "1"
  ? ["--no-sandbox", "--use-gl=angle", "--use-angle=metal", "--ignore-gpu-blocklist"] : ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto(origin);
await page.getByText("해부 모델 로드 완료").waitFor({ timeout: 180000 });
const shots = {};
for (const [name, camera] of Object.entries(views)) {
  // The saved view is restored on load, so the pose is set through it.
  await page.evaluate((camera) => { const s = JSON.parse(sessionStorage.getItem("gyeol-view-v2")); s.camera = camera; s.dissection = 0; s.selection = null; sessionStorage.setItem("gyeol-view-v2", JSON.stringify(s)); }, camera);
  await page.reload();
  await page.getByText("해부 모델 로드 완료").waitFor({ timeout: 180000 });
  await page.waitForTimeout(1500);
  const path = `${dir}/${prefix}-${name}.png`;
  await page.locator("canvas").screenshot({ path, clip: { x: 420, y: 120, width: 600, height: 620 } });
  shots[name] = path;
}
console.log(JSON.stringify({ origin, shots, errors }));
await browser.close();
if (errors.length) process.exitCode = 1;
