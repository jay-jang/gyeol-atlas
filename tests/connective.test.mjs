import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { initialView, viewReducer, restoreView, CONNECTIVE_BUNDLE } from "../src/view-state.ts";

const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const glbNodes = (path) => {
  const data = fs.readFileSync(path);
  assert.equal(data.readUInt32LE(0), 0x46546c67);
  const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString("utf8"));
  return json.nodes.map((node) => node.name);
};
const catalog = read("data/connective-structures.json");
const kinds = new Set(["ligament", "capsule", "meniscus", "disc", "labrum", "membrane", "cartilage", "fatpad", "symphysis", "tendon", "aponeurosis", "retinaculum", "sheath", "tract"]);

test("ligament and tendon supplements match their pinned files and real GLB membership", () => {
  const provenance = read("data/catalog/connective-supplement.json");
  assert.equal(provenance.sourceCommit, "4211d717b0b624604a8bda174ffcae31a76f4581");
  for (const asset of provenance.assets)
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(asset.path)).digest("hex"), asset.sha256);
  assert.deepEqual(provenance.assets.map((a) => a.structures), [358, 58]);
  const ligamentNodes = new Set(glbNodes("public/models/ligament-full.glb"));
  const tendonNodes = glbNodes("public/models/tendon-full.glb");
  // The tendon file holds exactly the catalogued nodes; nothing else was kept.
  assert.deepEqual(new Set(tendonNodes), new Set(catalog.filter((e) => e.model === "tendon-full.glb").map((e) => e.node)));
  assert.equal(tendonNodes.length, 58);
  for (const entry of catalog.filter((e) => e.model === "ligament-full.glb")) assert.ok(ligamentNodes.has(entry.node), entry.node);
  // Base meshes of the same structures are kept, not duplicated.
  for (const name of provenance.excludedBaseDuplicates) assert.ok(!catalog.some((e) => e.name === name), name);
  assert.equal(provenance.excludedBaseDuplicates.length, 16);
});

test("connective catalog keeps source names, kinds and source-system layers", () => {
  assert.equal(catalog.length, 416);
  assert.equal(new Set(catalog.map((e) => e.id)).size, catalog.length);
  for (const entry of catalog) {
    assert.ok(entry.name && entry.label && entry.node && entry.description && entry.hierarchy.length, entry.id);
    assert.ok(kinds.has(entry.kind), entry.kind);
    assert.equal(entry.layer, entry.model === "ligament-full.glb" ? "bone" : "muscle");
    assert.ok(!/bursa|septum/i.test(entry.name), entry.name);
    // Korean labels are editorial: the English name and TA2 Latin stay searchable.
    assert.match(entry.label, /[가-힣]/);
  }
  const others = [...read("scripts/model-inputs.json").assets, ...read("data/full-system-structures.json"),
    ...read("data/female-atlas-structures.json")].map((s) => s.id);
  assert.ok(!catalog.some((e) => others.includes(e.id)));
  const acl = catalog.find((e) => e.name === "Anterior cruciate ligament (right)");
  assert.equal(acl.kind, "ligament");
  assert.equal(acl.latin, "Ligamentum cruciatum anterius");
  assert.equal(acl.label, "오른쪽 앞십자인대(전방십자인대)");
});

test("existing base ligaments and tendons are tagged by kind without new meshes", () => {
  const tags = read("data/connective-tags.json");
  const male = new Map(read("scripts/model-inputs.json").assets.map((s) => [s.id, s]));
  const female = new Map(read("data/female-atlas-structures.json").map((s) => [s.id, s]));
  assert.equal(Object.keys(tags.male).length, 17);
  assert.equal(Object.keys(tags.female).length, 16);
  for (const [id, kind] of Object.entries(tags.male)) {
    assert.ok(["muscle", "bone"].includes(male.get(id)?.layer), id);
    assert.ok(kinds.has(kind));
  }
  for (const [id, kind] of Object.entries(tags.female)) {
    assert.ok(["muscle", "bone"].includes(female.get(id)?.layer), id);
    assert.match(female.get(id).name, /ligament|meniscus|tendon/i);
    assert.ok(kinds.has(kind));
  }
  assert.equal(tags.male.FMA258847, "tendon");
  assert.equal(tags.male.FMA44249, "ligament");
});

test("ligament display is a view-state preference restored with older sessions", () => {
  const points = read("data/points.json").map((p) => p.id);
  const assets = read("scripts/model-inputs.json").assets;
  const s = initialView();
  assert.equal(s.connective, true);
  const off = viewReducer(s, { type: "connective", value: false });
  assert.equal(off.connective, false);
  assert.equal(off.dissection, s.dissection);
  const legacy = { ...initialView(), markers: "hidden" };
  delete legacy.connective;
  const restored = restoreView(JSON.stringify(legacy), points, assets);
  assert.equal(restored.connective, true);
  assert.equal(restored.markers, "hidden");
  assert.equal(restoreView(JSON.stringify({ ...initialView(), connective: "yes" }), points, assets).markers, initialView().markers);
  assert.equal(restoreView(JSON.stringify(off), points, assets).connective, false);
});

test("the ligament-only view isolates the bundle over muscle and bone and returns to the prior peel", () => {
  const camera = { position: [0, 1, 3], target: [0, 1, 0] };
  const start = { ...initialView(), dissection: 42, layers: { ...initialView().layers }, camera, connective: false, markers: "hidden" };
  const only = viewReducer(start, { type: "connective-only", ids: ["ZA_ligament_a", "FMA44249"] });
  assert.deepEqual(only.selection, { kind: "bundle", ids: ["ZA_ligament_a", "FMA44249"], name: CONNECTIVE_BUNDLE, layers: ["bone", "muscle"] });
  assert.equal(only.isolated, true);
  assert.equal(only.connective, true);
  assert.equal(only.displayMode, "layers");
  assert.deepEqual(Object.entries(only.layers).filter(([, on]) => on).map(([layer]) => layer).sort(), ["bone", "muscle"]);
  assert.equal(only.markers, "hidden");
  const back = viewReducer(only, { type: "clear-selection" });
  assert.equal(back.selection, null);
  assert.equal(back.displayMode, "dissection");
  assert.equal(back.dissection, 42);
  assert.deepEqual(back.camera, camera);
  assert.equal(viewReducer(start, { type: "connective-only", ids: [] }), start);
  // An open organ detail is left first; its separate frame never mixes in.
  const detail = viewReducer(start, { type: "detail", detail: { id: "heart", name: "심장", ids: ["FMA7088"], layers: { ...start.layers, organ: true } } });
  const fromDetail = viewReducer(detail, { type: "connective-only", ids: ["ZA_ligament_a"] });
  assert.equal(fromDetail.detail, null);
  assert.equal(viewReducer(fromDetail, { type: "clear-selection" }).dissection, 42);
});

test("ligaments and tendons are told apart by colour and finish, by their kind", async () => {
  const { connectiveGroup, connectiveTone, LIGAMENT_COLOR, TENDON_COLOR, TENDON_KINDS } = await import("../src/anatomy-rendering.ts");
  assert.deepEqual([...TENDON_KINDS].sort(), ["aponeurosis", "retinaculum", "sheath", "tendon", "tract"]);
  for (const kind of kinds) assert.ok(["ligament", "tendon"].includes(connectiveGroup(kind)), kind);
  // Every ligament-file structure is a ligament or joint structure; the tendon file holds four named ligaments.
  assert.ok(catalog.filter((e) => e.model === "ligament-full.glb").every((e) => connectiveGroup(e.kind) === "ligament"));
  assert.deepEqual(catalog.filter((e) => e.model === "tendon-full.glb" && connectiveGroup(e.kind) === "ligament").map((e) => e.name).sort(),
    ["Superficial transverse metacarpal ligament (left)", "Superficial transverse metacarpal ligament (right)", "Superficial transverse metatarsal ligament (left)", "Superficial transverse metatarsal ligament (right)"]);
  const tags = read("data/connective-tags.json");
  assert.equal(connectiveGroup(tags.male.FMA258847), "tendon"); // calcaneal tendon
  assert.equal(connectiveGroup(tags.female.HRAF0395), "tendon"); // HRA quadriceps tendon
  assert.equal(connectiveGroup(tags.female.HRAF0910), "ligament"); // HRA meniscus
  // CIEDE2000 between the two and from every colour they sit beside.
  const lab = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
    const [x, y, z] = [(r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, r * 0.2126 + g * 0.7152 + b * 0.0722, (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883].map(f);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const de2000 = (p, q) => {
    const [L1, a1, b1] = lab(p), [L2, a2, b2] = lab(q), rad = Math.PI / 180;
    const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
    const A1 = (1 + G) * a1, A2 = (1 + G) * a2, C1 = Math.hypot(A1, b1), C2 = Math.hypot(A2, b2);
    let h1 = Math.atan2(b1, A1) / rad; if (h1 < 0) h1 += 360; let h2 = Math.atan2(b2, A2) / rad; if (h2 < 0) h2 += 360;
    let dh = C1 * C2 === 0 ? 0 : h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh * rad) / 2), Lb = (L1 + L2) / 2, Cp = (C1 + C2) / 2;
    const hb = C1 * C2 === 0 ? h1 + h2 : Math.abs(h1 - h2) > 180 ? (h1 + h2 + 360) / 2 : (h1 + h2) / 2;
    const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
    const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cp, SH = 1 + 0.015 * Cp * T;
    const RT = -2 * Math.sqrt(Cp ** 7 / (Cp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad);
    return Math.sqrt(((L2 - L1) / SL) ** 2 + ((C2 - C1) / SC) ** 2 + (dH / SH) ** 2 + RT * ((C2 - C1) / SC) * (dH / SH));
  };
  assert.ok(de2000(LIGAMENT_COLOR, TENDON_COLOR) > 15); // 16.0, plus about 19 L* of lightness and a different finish
  const beside = { bone: "#e8dec5", borrowedBone: "#9aa7b1", muscle: "#b43f3f", skin: "#b9826f", vein: "#356fb3", selection: "#34d3dd", comparison: "#e5b24f" };
  for (const [name, hex] of Object.entries(beside)) for (const c of [LIGAMENT_COLOR, TENDON_COLOR]) assert.ok(de2000(c, hex) > 10, `${c} vs ${name}`);
  assert.ok(connectiveTone("tendon").roughness < connectiveTone("ligament").roughness, "tendons glisten, ligaments are matte");
  // The legend swatches use the same colours.
  const css = fs.readFileSync("src/atlas.css", "utf8");
  assert.ok(css.includes(`--ax-ligament: ${LIGAMENT_COLOR};`) && css.includes(`--ax-tendon: ${TENDON_COLOR};`));
});
