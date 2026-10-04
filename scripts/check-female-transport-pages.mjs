// Public check of the female transport and the genital cover on GitHub Pages:
// the female body loads its transported systems, the borrowed clavicle meets
// the native sternum, the cover hides the external genitalia in both bodies
// and survives a reload. Desktop and mobile captures.
// Usage: PAGES_ORIGIN=https://jay-jang.github.io/gyeol-atlas/ [PLAYWRIGHT_GPU=1] node scripts/check-female-transport-pages.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.PAGES_ORIGIN || "https://jay-jang.github.io/gyeol-atlas/";
const gpu = process.env.PLAYWRIGHT_GPU === "1";
const browser = await chromium.launch({ headless: true, args: gpu ? ["--use-gl=angle", "--use-angle=metal", "--ignore-gpu-blocklist"] : [] });
const result = { origin, checkedAt: new Date().toISOString(), errors: [] };
for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  page.on("pageerror", (e) => result.errors.push(`${label}: ${e.message}`));
  const ready = () => page.getByText("해부 모델 로드 완료").waitFor({ timeout: 240000 });
  const ids = async () => new Set(((await page.locator("canvas").getAttribute("data-visible-structure-ids")) || "").split(","));
  await page.goto(origin + "#atlas");
  await ready();
  await page.locator(".ax-top").getByRole("button", { name: "여성", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.femaleTransportParts === "1774", null, { timeout: 240000 });
  await ready();
  const visible = await ids();
  result[label] = {
    femaleParts: await page.locator("canvas").getAttribute("data-female-atlas-parts"),
    transportParts: await page.locator("canvas").getAttribute("data-female-transport-parts"),
    transportVisible: await page.locator("canvas").getAttribute("data-female-transport-visible"),
    donorVisible: [...visible].filter((id) => id.startsWith("VHF")).length,
    sampleVisible: ["FT_ZA_nerve_sural_nerve_l", "FT_ZA_vessel_great_saphenous_vein_l", "FT_FMA13375"].every((id) => visible.has(id)),
  };
  await page.screenshot({ path: `docs/anatomy-alignment/pages-female-transport-${label}.png` });
  const toggle = page.locator(".ax-top").getByRole("button", { name: "성기 가리기" });
  await toggle.click();
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.modestyCover === "true", null, { timeout: 60000 });
  await page.reload(); await ready();
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.femaleTransportParts === "1774", null, { timeout: 240000 });
  result[label].coverAfterReload = await page.locator("canvas").getAttribute("data-modesty-cover");
  result[label].pressedAfterReload = await toggle.getAttribute("aria-pressed");
  await page.screenshot({ path: `docs/anatomy-alignment/pages-modesty-${label}.png` });
  result[label].noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await page.close();
}
await browser.close();
const ok = ["desktop", "mobile"].every((k) => result[k].transportParts === "1774" && result[k].transportVisible === "1774" && result[k].donorVisible === 0
  && result[k].sampleVisible && result[k].coverAfterReload === "true" && result[k].pressedAfterReload === "true" && result[k].noHorizontalScroll) && !result.errors.length;
result.ok = ok;
fs.writeFileSync("docs/anatomy-alignment/female-transport-pages.json", JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify(result));
if (!ok) process.exit(1);
