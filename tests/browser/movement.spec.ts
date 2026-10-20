import { expect, test, type Page } from "@playwright/test";
import { ready } from "./helpers";

// docs/movement-mechanics/CONSENSUS.md §4–§7.
const heavy = (url: string) => url.endsWith(".glb") || url.endsWith(".bin.gz") || /\/src\/Atlas\.tsx|\/assets\/Atlas-/.test(url);
const saved = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("gyeol-view-v2") || "null"));

test("the movement page lists the agreed movements without loading the 3D viewer", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/#movement");
  await expect(page.getByRole("heading", { level: 1, name: "동작 역학" })).toBeVisible();
  await expect(page.locator(".mv-list > li strong")).toHaveText(["서 있기", "의자에서 일어서기", "의자에 앉기", "평지 걷기", "계단 오르기", "계단 내리기", "팔 들어올리기"]);
  await expect(page.locator(".mv-later").first()).not.toContainText("계단");
  await expect(page).toHaveTitle("동작 역학 — 결 GYEOL");
  await page.locator(".mv-list a").nth(3).click();
  await expect(page.locator(".mv-svg")).toBeVisible();
  await page.goto("/#movement/arm-elevation");
  await expect(page.locator(".mv-svg")).toBeVisible();
  expect(requests.filter(heavy)).toEqual([]);
});

test("the movement page opens and plays while every model download fails", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/\.(glb|bin\.gz)(\?|$)/, (route) => route.abort());
  await page.goto("/#movement/walking/loading-response");
  await expect(page.locator(".mv-svg")).toBeVisible();
  await expect(page.locator(".mv-steps button[aria-current=step]")).toHaveText(/부하 반응기/);
  await page.getByRole("button", { name: "다음 단계" }).first().click();
  await expect(page.locator(".mv-steps button[aria-current=step]")).toHaveText(/중간 입각기/);
  expect(errors).toEqual([]);
});

test("a movement opens paused on its first phase and steps without stacking history", async ({ page }) => {
  await page.goto("/#movement/sit-to-stand");
  const steps = page.locator(".mv-steps button");
  await expect(steps.first()).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("button", { name: "재생", exact: false }).first()).toHaveAttribute("aria-pressed", "false");
  const length = await page.evaluate(() => history.length);
  await page.getByRole("button", { name: "다음 단계" }).first().click();
  await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");
  const phase = (await page.evaluate(() => location.hash)).split("/")[2];
  expect(phase).toBeTruthy();
  expect(await page.evaluate(() => history.length)).toBe(length);
  // The phase is in the address: a reload comes back to it.
  await page.reload();
  await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");
  // Keys act only while the diagram has focus.
  await page.locator("body").press("ArrowRight");
  await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");
  await page.locator(".mv-figure").focus();
  await page.keyboard.press("ArrowRight");
  await expect(steps.nth(2)).toHaveAttribute("aria-current", "step");
  await page.keyboard.press("Home");
  await expect(steps.first()).toHaveAttribute("aria-current", "step");
  await page.keyboard.press("End");
  await expect(steps.last()).toHaveAttribute("aria-current", "step");
  await expect(page.locator(".mv-phase [aria-live]")).not.toHaveText("");
});

test("reduced motion steps through phases; continuous motion only on request", async ({ page }) => {
  await page.goto("/#movement/walking");
  const svg = page.locator(".mv-svg");
  const shape = () => svg.locator(".mv-bone .mv-femur").last().getAttribute("d");
  const before = await shape();
  await page.getByRole("button", { name: /단계 재생/ }).first().click();
  await page.waitForTimeout(700);
  expect(await shape()).toBe(before);
  await expect(page.locator(".mv-steps button").nth(1)).toHaveAttribute("aria-current", "step", { timeout: 4000 });
  await page.getByRole("button", { name: /일시정지/ }).first().click();
  await page.getByLabel("연속 동작 보기").check();
  const still = await shape();
  await page.getByRole("button", { name: /^재생$/ }).first().click();
  await page.waitForTimeout(400);
  expect(await shape()).not.toBe(still);
  await page.getByRole("button", { name: /일시정지/ }).first().click();
  // Walking draws no centre-of-mass line, so its option names only the base of support.
  await expect(page.locator(".mv-options label").filter({ hasText: "지지면" })).toHaveText("지지면");
  // Walking reports its position in gait-cycle percent; arm elevation in degrees.
  await expect(page.getByLabel("보행 주기 위치")).toHaveAttribute("aria-valuetext", /주기 \d+%/);
  await page.goto("/#movement/arm-elevation");
  await expect(page.getByLabel("팔 거상 위치")).toHaveAttribute("aria-valuetext", /거상 \d+°/);
  await page.goto("/#movement/standing");
  await expect(page.locator(".mv-slider")).toHaveCount(0);
});

// docs/movement-mechanics/stairs/CONSENSUS.md §3–§7.
test("stairs draw a staircase, report the cycle, tabulate one EMG recording and link the pair", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/#movement/stair-ascent/pull-up");
  await expect(page.locator(".mv-svg .mv-stairs")).toHaveCount(1);
  await expect(page.locator(".mv-steps button[aria-current=step]")).toHaveText(/끌어올리기/);
  await expect(page.getByLabel("보행 주기 위치")).toHaveAttribute("aria-valuetext", /끌어올리기 · 주기 1[4-9]%/);
  // Contact events tick the cycle slider; the edited boundary (E1) is the one dashed tick.
  await expect(page.locator(".mv-ticks i")).toHaveCount(4);
  await expect(page.locator(".mv-ticks i[data-edited]")).toHaveCount(1);
  // No centre-of-mass or force overlay on stairs: the option names only the base of support.
  await expect(page.locator(".mv-options label").filter({ hasText: "지지면" })).toHaveText("지지면");
  await expect(page.locator(".mv-options label").filter({ hasText: "지면반력" })).toHaveCount(0);
  // Phase means, not on/off bars; pale cells are under the cut, not "not detected".
  const emg = page.locator(".mv-emg-table");
  await expect(emg.locator("tbody tr")).toHaveCount(6);
  await expect(emg.locator("tbody tr").filter({ hasText: "가쪽넓은근" }).locator("td").first()).toHaveText(/^\d+%$/);
  await expect(page.locator(".mv-strip")).toHaveCount(0);
  await expect(page.locator(".mv-c-silent")).toHaveCount(0);
  // The comparison links to the matching phase of the other movement.
  await page.getByRole("link", { name: "계단 내리기 · 조절하며 내려가기 보기" }).click();
  await expect(page).toHaveURL(/#movement\/stair-descent\/controlled-lowering$/);
  await expect(page.locator("#mv-title")).toContainText("계단 내리기");
  await expect(page.locator(".mv-steps button[aria-current=step]")).toHaveText(/조절하며 내려가기/);
  // The phase survives a reload; keys move phases only while the diagram has focus.
  await page.reload();
  await expect(page.locator(".mv-steps button[aria-current=step]")).toHaveText(/조절하며 내려가기/);
  await page.locator("body").press("ArrowRight");
  await expect(page.locator(".mv-steps button[aria-current=step]")).toHaveText(/조절하며 내려가기/);
  await page.locator(".mv-figure").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".mv-steps button[aria-current=step]")).toHaveText(/유각/);
  await expect(page).toHaveURL(/#movement\/stair-descent\/swing$/);
  await page.keyboard.press("ArrowLeft");
  // Playing moves the staircase past the figure (the view follows the body).
  const stairs = () => page.locator(".mv-svg .mv-stairs").getAttribute("d");
  await page.getByLabel("연속 동작 보기").check().catch(() => {});
  const before = await stairs();
  await page.getByRole("button", { name: /^(재생|단계 재생)$/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /일시정지/ }).first().click();
  expect(await stairs()).not.toBe(before);
  expect(requests.filter(heavy)).toEqual([]);
});

test("every stair phase keeps the diagram, controls and current phase on a 360×740 first screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const slug of ["stair-ascent", "stair-descent"]) {
    await page.goto(`/#movement/${slug}`);
    const steps = page.locator(".mv-steps button");
    for (let i = 0; i < await steps.count(); i++) {
      if (i) await page.getByRole("button", { name: "다음 단계" }).first().click();
      await expect(steps.nth(i)).toHaveAttribute("aria-current", "step");
      expect(await page.locator(".mv-now").evaluate((el) => el.getBoundingClientRect().bottom), `${slug} phase ${i + 1}`).toBeLessThanOrEqual(740);
      // Scrolled past it, the stuck bar holds the (long) phase name and four 44 px buttons.
      await page.evaluate(() => { const bar = document.querySelector(".mv-sticky")!; scrollTo(0, bar.getBoundingClientRect().top + scrollY + 400); });
      expect(await page.locator(".mv-sticky").evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThanOrEqual(1);
      const bar = await page.locator(".mv-sticky").evaluate((el) => { const b = el.getBoundingClientRect(), n = el.querySelector(":scope > span")!.getBoundingClientRect(); return { over: Math.max(b.top - n.top, n.bottom - b.bottom), min: Math.min(...[...el.querySelectorAll("button")].map((x) => x.getBoundingClientRect().height)) }; });
      expect(bar.over, `${slug} phase ${i + 1} sticky name`).toBeLessThanOrEqual(0.5);
      expect(bar.min).toBeGreaterThanOrEqual(44);
      await page.evaluate(() => scrollTo(0, 0));
    }
  }
});

const drawnIds = async (page: Page) => new Set(((await page.locator("canvas").getAttribute("data-visible-structure-ids")) || "").split(",").filter(Boolean));
async function prefer(page: Page, values: Record<string, unknown>) {
  await page.goto("/#atlas/ST36");
  await ready(page);
  await page.evaluate((v) => {
    const s = JSON.parse(sessionStorage.getItem("gyeol-view-v2")!);
    sessionStorage.setItem("gyeol-view-v2", JSON.stringify({ ...s, ...v }));
  }, values);
}

test("a structure link opens it once in the atlas, keeps preferences and links back", async ({ page }) => {
  test.setTimeout(300000);
  // Hide ligaments/tendons and markers: a linked ligament must still be drawn
  // and both preferences kept (Q2, Q27).
  await prefer(page, { connective: false, markers: "hidden" });
  await page.goto("/#movement/standing");
  await page.reload();
  const ligament = page.locator(".mv-passive li").filter({ hasText: "엉덩넙다리인대" }).first();
  await ligament.getByRole("link", { name: /3D에서 맞춰 보기/ }).click();
  await ready(page);
  await expect(page.locator(".selection-card strong")).toContainText("엉덩넙다리인대");
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("#atlas/ST36");
  const ligamentIds = ["ZA_ligament_transverse_part_of_iliofemoral_ligament_r", "ZA_ligament_transverse_part_of_iliofemoral_ligament_l", "ZA_ligament_descending_part_of_iliofemoral_ligament_r", "ZA_ligament_descending_part_of_iliofemoral_ligament_l"];
  await expect.poll(async () => { const ids = await drawnIds(page); return ligamentIds.every((id) => ids.has(id)); }).toBe(true);
  let view = await saved(page);
  expect(view.selection.ids).toEqual(ligamentIds);
  expect(view.connective).toBe(false);
  expect(view.markers).toBe("hidden");
  expect(view.pointId).toBe("ST36");
  // Clearing returns the scene before the link; the camera stays.
  const camera = view.camera;
  await page.getByRole("button", { name: "구조 선택 해제" }).click();
  view = await saved(page);
  expect(view.selection).toBeNull();
  expect(view.displayMode).toBe("dissection");
  expect(view.camera).toEqual(camera);
  // A muscle pair from another movement; a reload restores without reopening.
  await page.goto("/#movement/sit-to-stand");
  const row = page.locator(".mv-muscle-table tbody tr").filter({ hasText: "큰볼기근" }).first();
  await row.getByRole("link", { name: /3D에서 맞춰 보기/ }).click();
  await ready(page);
  await expect.poll(async () => { const ids = await drawnIds(page); return ids.has("FMA22328") && ids.has("FMA22329"); }).toBe(true);
  expect((await saved(page)).selection.ids).toEqual(["FMA22328", "FMA22329"]);
  await page.reload();
  await ready(page);
  expect((await saved(page)).selection.ids).toEqual(["FMA22328", "FMA22329"]);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("#atlas/ST36");
  await page.locator(".selection-card").getByRole("link", { name: /동작 역학으로 돌아가기/ }).click();
  await expect(page.locator("#mv-title")).toContainText("의자에서 일어서기");
});

test("the female body opens carried copies, keeps the ligament preference, and offers the male model otherwise", async ({ page }) => {
  test.setTimeout(300000);
  await prefer(page, { sex: "female", connective: false });
  await page.goto("/#movement/standing");
  await page.reload();
  await expect(page.locator("a.mv-atlas").first()).toBeVisible();
  const hrefs = await page.locator("a.mv-atlas").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!));
  expect(hrefs.length).toBeGreaterThan(0);
  // Female links name carried copies only; anything else goes to the male model explicitly.
  for (const href of hrefs) expect(href).toMatch(/#atlas\/structure\/(female\/FT_[^/]+(\+FT_[^/]+)*|male\/)/);
  const tendon = page.locator(".mv-passive li").filter({ hasText: "발꿈치힘줄" }).first();
  await expect(tendon.getByRole("link", { name: /3D에서 맞춰 보기/ })).toHaveAttribute("href", /\/female\/FT_FMA258847\+FT_FMA264844\//);
  await tendon.getByRole("link", { name: /3D에서 맞춰 보기/ }).click();
  await ready(page);
  await expect.poll(async () => { const ids = await drawnIds(page); return ids.has("FT_FMA258847") && ids.has("FT_FMA264844"); }).toBe(true);
  const view = await saved(page);
  expect(view.sex).toBe("female");
  expect(view.selection.ids).toEqual(["FT_FMA258847", "FT_FMA264844"]);
  expect(view.connective).toBe(false);
  await expect(page.locator(".selection-card")).toContainText("남성 원본");
  // A row without a carried copy opens the male model only when asked.
  await page.goto("/#movement/sit-to-stand");
  const male = page.getByRole("link", { name: /남성 모델에서 보기/ });
  if (await male.count()) await expect(male.first()).toHaveAttribute("href", /#atlas\/structure\/male\//);
});

test("citations move to the source list without leaving the page", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/#movement/walking/loading-response");
  const cite = page.locator(".mv-phase .mv-cite button").first();
  await cite.click();
  await expect(page).toHaveURL(/#movement\/walking\/loading-response$/);
  await expect(page.locator(".mv-source-list li:focus")).toHaveCount(1);
  await page.locator(".mv-phase .mv-cite button").nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#movement\/walking/);
  expect(requests.filter(heavy)).toEqual([]);
});

// The header is shared: its movement-link rules must hold on pages that never
// loaded the movement page (they once lived in the lazy movement CSS).
for (const width of [1440, 390, 360]) {
  test(`header at ${width} px shows one movement label on one row without the movement page`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/#wiki");
    await expect(page.getByRole("heading", { level: 1, name: "지식 위키" })).toBeVisible();
    const link = page.locator(".site-header nav a").nth(1);
    await expect(link).toHaveAccessibleName("동작 역학");
    await expect(link).toHaveText(width < 375 ? "동작" : "동작 역학", { useInnerText: true });
    const tops = await page.locator(".site-header nav a").evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    // Each label stays on one line (no "3D 경혈 지" / "도" breaks).
    const lines = await page.locator(".site-header nav a").evaluateAll((as) => as.map((a) => {
      const tops = new Set<number>();
      const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent!.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width > 0) tops.add(Math.round(r.top / 4));
      }
      return tops.size;
    }));
    expect(lines).toEqual([1, 1, 1, 1]);
    await expect(page.getByRole("link", { name: "결 홈" })).toBeVisible();
    expect(await page.locator(".site-header").evaluate((h) => h.getBoundingClientRect().height)).toBeLessThanOrEqual(56);
  });
}

for (const [width, height, route] of [[390, 844, "walking/loading-response"], [360, 740, "walking/loading-response"], [844, 390, "walking/loading-response"],
  [390, 844, "stair-ascent/pull-up"], [360, 740, "stair-descent/controlled-lowering"], [844, 390, "stair-descent/weight-acceptance"]] as const) {
  test(`phone ${width}×${height} ${route}: one column, no sideways scroll, readable and touchable`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(`/#movement/${route}`);
    await expect(page.locator(".mv-svg")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    // Header: four links on one row; at 360 px the movement link uses its short name.
    const nav = page.locator(".site-header nav a");
    await expect(nav).toHaveCount(4);
    const tops = await nav.evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    await expect(nav.nth(1)).toHaveAccessibleName("동작 역학");
    if (width < 375) await expect(nav.nth(1)).toHaveText("동작", { useInnerText: true });
    for (const box of await nav.evaluateAll((as) => as.map((a) => a.getBoundingClientRect().width))) expect(box).toBeGreaterThanOrEqual(44);
    // Diagram, controls and the current phase share the first screen on a
    // phone; on a short landscape screen the diagram and controls do.
    if (width <= 700 || height <= 500) {
      const bottom = await page.locator(width <= 700 ? ".mv-now" : ".mv-figure-wrap > .mv-controls").first().evaluate((el) => el.getBoundingClientRect().bottom);
      expect(bottom).toBeLessThanOrEqual(height);
      expect(await page.locator(".mv-figure").evaluate((el) => el.getBoundingClientRect().top)).toBeLessThan(height / 2);
      for (const size of await page.locator(".mv-controls").first().locator("button").evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().height)))
        expect(size).toBeGreaterThanOrEqual(44);
      await expect(page.locator(".mv-muscle-table")).toHaveCount(0);
      await page.locator(".mv-all > summary").click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      if (width <= 700) {
        // Portrait phones: the diagram takes at most 42% of the screen height (CONSENSUS §4; stairs §7).
        expect(await page.locator(".mv-svg").evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(height * 0.42 + 1);
        // Tables fit their wrappers on stair pages (no hidden sideways scroll inside a table).
        if (route.startsWith("stair")) for (const over of await page.locator(".mv-table-wrap").evaluateAll((ws) => ws.map((w) => w.scrollWidth - w.clientWidth))) expect(over).toBeLessThanOrEqual(1);
      }
    }
    // Diagram labels stay inside the drawing.
    const outside = await page.locator(".mv-svg").evaluate((svg) => {
      const box = svg.getBoundingClientRect();
      return [...svg.querySelectorAll("text")].map((t) => t.getBoundingClientRect()).filter((r) => r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1).length;
    });
    expect(outside).toBe(0);
    // Meaningful text is at least 12 px, including diagram labels.
    const small = await page.locator(".movement-page").evaluate((root) => {
      const out: string[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement!;
        if (!n.textContent!.trim() || el.closest(".sr-only")) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || getComputedStyle(el).visibility === "hidden") continue;
        const size = el instanceof SVGElement ? r.height / 1.15 : parseFloat(getComputedStyle(el).fontSize);
        if (size < 11.9) out.push(`${n.textContent!.trim().slice(0, 20)} ${size.toFixed(1)}`);
      }
      return out;
    });
    expect(small).toEqual([]);
  });
}
