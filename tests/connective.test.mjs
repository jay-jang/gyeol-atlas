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
  assert.deepEqual(only.selection, { kind: "bundle", ids: ["ZA_ligament_a", "FMA44249"], name: CONNECTIVE_BUNDLE });
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
