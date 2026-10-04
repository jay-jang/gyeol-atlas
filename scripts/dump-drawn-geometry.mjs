// Dump the geometry the app actually draws (after runtime corrections) for one
// sex, as input to scripts/female-transport/. Needs the dev server on :5174.
// Usage: node scripts/dump-drawn-geometry.mjs <male|female> <out dir>
import { chromium } from "@playwright/test";
import fs from "node:fs";
const sex = process.argv[2], out = process.argv[3];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion: "reduce" });
let fiberUrl = ""; page.on("request", r => { if (/\/@react-three_fiber\.js\?/.test(r.url())) fiberUrl = r.url(); });
// The registration field is fitted to the scene as it was drawn before it:
// leave out the transported structures and the borrowed bones' field placement.
await page.route("**/models/female-transport/manifest.json", async route => {
  const manifest = await (await route.fetch()).json();
  await route.fulfill({ json: { ...manifest, files: [], borrowed: { ...manifest.borrowed, parts: [] } } });
});
await page.goto("http://127.0.0.1:5174/");
await page.getByText("해부 모델 로드 완료").waitFor({ timeout: 180000 });
if (sex === "female") {
  await page.getByRole("button", { name: "여성", exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector("canvas")?.dataset.femaleAtlasParts || 0) > 0, null, { timeout: 180000 });
}
await page.waitForTimeout(2000);
const index = await page.evaluate(async (url) => {
  const { _roots } = await import(url), st = _roots.get(document.querySelector("canvas")).store.getState();
  const list = [];
  st.scene.updateMatrixWorld(true);
  st.scene.traverse(m => {
    if (!m.isMesh || m.isInstancedMesh || !m.geometry?.attributes?.position || m.name === "modesty-cover") return;
    list.push(m);
  });
  window.__dump = list;
  return list.map((m, i) => ({ i, name: m.name, parent: m.parent?.name || "", layer: m.userData.layer || "", system: m.userData.system || "", sourceName: m.userData.sourceName || m.userData.entry?.name || "", entryId: m.userData.entry?.id || "", vertexCount: m.geometry.attributes.position.count, indexCount: m.geometry.index ? m.geometry.index.count : 0 }));
}, fiberUrl);
const parts = [];
let offset = 0; const chunks = [];
for (const item of index) {
  const data = await page.evaluate((i) => {
    const m = window.__dump[i], g = m.geometry, p = g.attributes.position, n = p.count;
    const out = new Float32Array(n * 3), v = new (m.matrixWorld.constructor === Object ? Object : m.matrixWorld.elements.constructor)(0);
    const e = m.matrixWorld.elements;
    for (let k = 0; k < n; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      out[k*3] = e[0]*x + e[4]*y + e[8]*z + e[12]; out[k*3+1] = e[1]*x + e[5]*y + e[9]*z + e[13]; out[k*3+2] = e[2]*x + e[6]*y + e[10]*z + e[14]; }
    const idx = g.index ? Uint32Array.from(g.index.array) : null;
    const b64 = (a) => { const u = new Uint8Array(a.buffer); let s = ""; for (let k = 0; k < u.length; k += 0x8000) s += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000)); return btoa(s); };
    return { pos: b64(out), idx: idx ? b64(idx) : "" };
  }, item.i);
  const pos = Buffer.from(data.pos, "base64"), idx = Buffer.from(data.idx, "base64");
  parts.push({ ...item, posOffset: offset, posBytes: pos.length, idxOffset: offset + pos.length, idxBytes: idx.length });
  chunks.push(pos, idx); offset += pos.length + idx.length;
}
fs.writeFileSync(`${out}/geometry.bin`, Buffer.concat(chunks));
fs.writeFileSync(`${out}/index.json`, JSON.stringify({ sex, parts }, null, 0));
console.log(sex, parts.length, "meshes", offset, "bytes");
await browser.close();
