import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

// Read the actual Three scene through the installed R3F development module.
// No test hook, synthetic geometry, or production renderer change is required.
const origin = process.env.GEOMETRY_ORIGIN || "http://127.0.0.1:5174";
const read = async path => JSON.parse(await fs.readFile(path, "utf8"));
const base = (await read("scripts/model-inputs.json")).assets;
const male = [...base, ...await read("data/full-system-structures.json"), ...(await read("data/sex-lymph-structures.json")).filter(s => s.sex === "male")];
const female = await read("data/female-atlas-structures.json");
const allIds = [...male, ...female].map(s => s.id);
const report = { checkedAt: new Date().toISOString(), origin, method: "Actual local development Three.js scene graph; world-space mesh bounds at every 0.5% setting. GPU drawing paused during sweep; pixel appearance is tested separately.", status: "running", sexes: [] };
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
let page;
try {
  page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  let fiberUrl;
  const errors = [];
  page.on("request", r => { if (/\/@react-three_fiber\.js\?/.test(r.url())) fiberUrl = r.url(); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin);
  const ready = () => page.getByText("해부 모델 로드 완료").waitFor({ timeout: 120000 });
  await ready();
  assert.ok(fiberUrl, "This audit requires the Vite development server with the installed R3F module");
  await page.evaluate(async url => {
    const module = await import(url);
    const state = module._roots.get(document.querySelector("canvas")).store.getState();
    // Canvas re-applies its demand frameloop prop during React commits. Pausing
    // just the frameloop is therefore insufficient. Suppress GPU submission in
    // this audit's private browser only; geometry/material effects still run.
    state.gl.render = () => {};
  }, fiberUrl);
  const setDepth = value => page.evaluate(value => {
    const input = document.querySelector('input[aria-label="연속 해부 박리 깊이"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  const snapshot = () => page.evaluate(async ({ url, ids }) => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const module = await import(url);
    const canvas = document.querySelector("canvas");
    const root = module._roots.get(canvas);
    if (!root) throw Error("Missing live R3F canvas root");
    const scene = root.store.getState().scene;
    scene.updateMatrixWorld(true);
    const allowed = new Set(ids), result = {}, visible = new Set();
    scene.traverseVisible(object => {
      if (object.isMesh && allowed.has(object.name) && object.material.opacity > .01) visible.add(object.name);
    });
    scene.traverse(object => {
      if (!object.isMesh || !allowed.has(object.name)) return;
      if (result[object.name]) throw Error(`Duplicate anatomical mesh ID ${object.name}`);
      const geometry = object.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const bounds = geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
      result[object.name] = { bounds: [...bounds.min.toArray(), ...bounds.max.toArray()], vertices: geometry.getAttribute("position").count, visible: visible.has(object.name) };
    });
    return result;
  }, { url: fiberUrl, ids: allIds });
  for (const [sex, label, catalog] of [["male", "남성", male], ["female", "여성", female]]) {
    await page.locator(".explore-sidebar").getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("button", { name: "전체 켜기", exact: true }).click();
    await ready();
    const baseline = await snapshot(), expected = new Set(catalog.map(s => s.id));
    assert.deepEqual(Object.keys(baseline).sort(), [...expected].sort(), `${sex}: every source mesh must be present before peeling`);
    const evidence = { sex, baselineMeshes: expected.size, baselineSha256: createHash("sha256").update(JSON.stringify(baseline)).digest("hex"), depthStates: 0, boundsCompared: 0, maximumCoordinateDeltaMetres: 0, depths: [] };
    report.sexes.push(evidence);
    // Changing the range away from its current value enters dissection mode;
    // filling an already-zero input correctly emits no browser change event.
    await setDepth(.5);
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("gyeol-view-v2") || "null")?.dissection === .5);
    for (let tick = 0; tick <= 200; tick++) {
      const depth = tick / 2;
      await setDepth(depth);
      await ready();
      await page.waitForFunction(({ sex, depth }) => {
        const state = JSON.parse(sessionStorage.getItem("gyeol-view-v2") || "null");
        return state?.sex === sex && state.dissection === depth && state.displayMode === "dissection";
      }, { sex, depth });
      const actual = await snapshot();
      let visible = 0;
      for (const [id, mesh] of Object.entries(actual)) {
        assert.ok(expected.has(id), `${sex}/${depth}: foreign-sex mesh ${id}`);
        assert.equal(mesh.vertices, baseline[id].vertices, `${sex}/${depth}/${id}: vertex count changed`);
        for (let axis = 0; axis < 6; axis++) {
          const delta = Math.abs(mesh.bounds[axis] - baseline[id].bounds[axis]);
          assert.ok(Number.isFinite(delta) && delta < 1e-7, `${sex}/${depth}/${id}: world bound moved by ${delta}m`);
          evidence.maximumCoordinateDeltaMetres = Math.max(evidence.maximumCoordinateDeltaMetres, delta);
        }
        evidence.boundsCompared++;
        if (mesh.visible) visible++;
      }
      assert.ok(visible > 0, `${sex}/${depth}: empty anatomical scene`);
      evidence.depthStates++;
      evidence.depths.push({ depth, loadedMeshes: Object.keys(actual).length, visibleMeshes: visible });
      if (tick % 50 === 0) console.log(`${sex}: checked through ${depth}%`);
    }
    console.log(`${sex}: ${evidence.depthStates} depths, ${evidence.boundsCompared} mesh-bound comparisons, maximum displacement ${evidence.maximumCoordinateDeltaMetres}m`);
  }
  assert.deepEqual(errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = String(error);
  if (page) report.lastView = await page.evaluate(() => JSON.parse(sessionStorage.getItem("gyeol-view-v2") || "null")).catch(() => null);
  throw error;
} finally {
  await browser.close();
  await fs.writeFile("docs/anatomy-alignment/dissection-geometry.json", JSON.stringify(report, null, 2) + "\n");
}
