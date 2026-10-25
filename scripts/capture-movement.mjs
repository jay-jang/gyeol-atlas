// Screens and readability of the movement page (docs/movement-mechanics/VERIFICATION.md).
// Usage: PATH=<node24>:$PATH node scripts/capture-movement.mjs [outDir]
// Needs the dev server (npm run dev) or SMOKE_ORIGIN. Writes PNGs, metrics.json
// and readability.json; fails on sideways scroll, page errors, text under 12 px,
// text contrast under 4.5:1 or diagram strokes under 3:1 (WCAG 1.4.11).
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";

const origin = (process.env.SMOKE_ORIGIN || "http://127.0.0.1:5174").replace(/\/$/, "");
const dir = process.argv[2] || "docs/movement-mechanics/screens";
await fs.mkdir(dir, { recursive: true });
const VIEWPORTS = [["desktop", 1440, 900], ["laptop", 1280, 720], ["tablet", 820, 1180], ["mobile", 390, 844], ["small-mobile", 360, 740], ["landscape", 844, 390]];
const slugs = ["standing", "sit-to-stand", "stand-to-sit", "walking", "stair-ascent", "stair-descent", "arm-elevation", "heel-raise"];
// Stairs: contact, the main knee phase and swing (docs/movement-mechanics/stairs/CONSENSUS.md §7).
// Heel raise: the preparatory shift and the peak, where the drawn heel rise must show (heel-raise CONSENSUS §5).
const SCENES = { "stair-ascent": ["weight-acceptance", "pull-up", "swing"], "stair-descent": ["weight-acceptance", "controlled-lowering", "swing"], "heel-raise": ["anticipatory-adjustment", "lowering"] };
const phases = Object.fromEntries(await Promise.all(slugs.map(async (slug) => {
  const m = JSON.parse(await fs.readFile(`data/movements/${slug}.json`, "utf8"));
  return [slug, SCENES[slug] ?? [m.phases[0].id, m.phases[Math.floor(m.phases.length / 2)].id]];
})));

const measure = (root) => {
  const rgb = (s) => s.match(/[\d.]+/g)?.map(Number) || [255, 255, 255];
  const lum = (v) => v.slice(0, 3).map((x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const background = (el) => {
    for (let node = el; node; node = node.parentElement) {
      if (node instanceof SVGElement) continue;
      const b = rgb(getComputedStyle(node).backgroundColor);
      if ((b[3] ?? 1) > 0.99) return b;
    }
    return [255, 255, 255];
  };
  const text = [...root.querySelectorAll("*")].filter((el) => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width && r.height && s.visibility !== "hidden" && !el.closest(".sr-only") && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  }).map((el) => {
    const s = getComputedStyle(el), svg = el instanceof SVGElement;
    const size = svg ? el.getBoundingClientRect().height / 1.15 : parseFloat(s.fontSize);
    const color = svg ? rgb(s.fill) : rgb(s.color);
    return { text: el.textContent.trim().slice(0, 50), font: +size.toFixed(1), contrast: +ratio(color, background(el)).toFixed(2) };
  });
  const strokes = [...root.querySelectorAll(".mv-svg .mv-long, .mv-svg .mv-line, .mv-svg .mv-floor, .mv-svg .mv-chair path, .mv-svg .mv-com path, .mv-svg .mv-grf path, .mv-svg .mv-bos, .mv-svg .mv-spine, .mv-svg .mv-stairs, .mv-principle-svg .mv-pr-force, .mv-principle-svg .mv-pr-dim, .mv-principle-svg .mv-pr-foot")].map((el) => {
    const s = getComputedStyle(el), paint = s.stroke !== "none" ? s.stroke : s.fill;
    return { cls: el.getAttribute("class"), contrast: +ratio(rgb(paint), background(el.closest(".mv-figure"))).toFixed(2) };
  });
  // Diagram labels must sit inside the drawing (no clipped words).
  const box = root.querySelector(".mv-svg")?.getBoundingClientRect();
  const clipped = box ? [...root.querySelectorAll(".mv-svg text")].map((t) => ({ text: t.textContent, r: t.getBoundingClientRect() }))
    .filter(({ r }) => r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1).map(({ text }) => text) : [];
  return { text, strokes, clipped };
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const metrics = [], readability = [];
try {
  for (const [name, width, height] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce", hasTouch: width < 900, isMobile: width < 500 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const shot = async (state, route, after) => {
      await page.goto(`${origin}/${route}`);
      await page.locator("main.movement-page h1").waitFor();
      if (after) await after();
      await page.waitForTimeout(300);
      await page.screenshot({ animations: "disabled", path: `${dir}/${name}-${state}.png` });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      metrics.push({ name, state, overflow });
      readability.push({ name, state, ...(await page.locator("main.movement-page").evaluate(measure)) });
    };
    await shot("00-list", "#movement");
    let i = 1;
    for (const slug of slugs) for (const phase of phases[slug]) await shot(`${String(i++).padStart(2, "0")}-${slug}-${phase}`, `#movement/${slug}/${phase}`);
    await shot(`${String(i++).padStart(2, "0")}-sit-to-stand-table`, "#movement/sit-to-stand", async () => {
      const fold = page.locator(".mv-all > summary");
      if (await fold.count()) await fold.click();
      await page.locator("#mv-muscles").scrollIntoViewIfNeeded();
    });
    await shot(`${String(i++).padStart(2, "0")}-stair-ascent-compare`, "#movement/stair-ascent/pull-up", async () => {
      const fold = page.locator(".mv-all > summary");
      if (await fold.count()) await fold.click();
      await page.locator("#mv-emg").scrollIntoViewIfNeeded();
    });
    await shot(`${String(i++).padStart(2, "0")}-stair-descent-contrast`, "#movement/stair-descent/controlled-lowering", async () => {
      const fold = page.locator(".mv-all > summary");
      if (await fold.count()) await fold.click();
      await page.locator("#mv-contrast-stairs").scrollIntoViewIfNeeded();
    });
    metrics.push({ name, errors });
    await page.close();
    console.log("captured", name);
  }
} finally {
  await browser.close();
}
await fs.writeFile(`${dir}/metrics.json`, JSON.stringify(metrics, null, 1) + "\n");
// The evidence file keeps per-screen minima and the weakest samples, not
// every one of the tens of thousands of text samples.
const summary = readability.map((r) => ({
  at: `${r.name}/${r.state}`,
  textSamples: r.text.length,
  minFont: Math.min(...r.text.map((t) => t.font)),
  minContrast: Math.min(...r.text.map((t) => t.contrast)),
  weakest: [...r.text].sort((a, b) => a.contrast - b.contrast).slice(0, 3),
  strokes: r.strokes.length,
  minStrokeContrast: r.strokes.length ? Math.min(...r.strokes.map((t) => t.contrast)) : null,
  clipped: r.clipped,
}));
await fs.writeFile("docs/movement-mechanics/readability.json", JSON.stringify({ origin, summary }, null, 1) + "\n");
const overflow = metrics.filter((m) => m.overflow > 0);
const errors = metrics.filter((m) => m.errors?.length);
const small = readability.flatMap((r) => r.text.filter((s) => s.font < 12 || s.contrast < 4.5).map((s) => ({ at: `${r.name}/${r.state}`, ...s })));
const faint = readability.flatMap((r) => r.strokes.filter((s) => s.contrast < 3).map((s) => ({ at: `${r.name}/${r.state}`, ...s })));
const clipped = readability.flatMap((r) => r.clipped.map((text) => `${r.name}/${r.state}: ${text}`));
assert.deepEqual({ overflow, errors, small: small.slice(0, 20), faint: faint.slice(0, 20), clipped }, { overflow: [], errors: [], small: [], faint: [], clipped: [] });
console.log(`Movement page: ${metrics.filter((m) => m.state).length} screens, no sideways scroll, no page errors; ${readability.reduce((n, r) => n + r.text.length, 0)} text samples ≥12 px and ≥4.5:1, ${readability.reduce((n, r) => n + r.strokes.length, 0)} diagram strokes ≥3:1, no clipped diagram label.`);
