import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { initialView, viewReducer, restoreView } from "../src/view-state.ts";
const points = JSON.parse(fs.readFileSync("data/points.json"));
const assets = JSON.parse(fs.readFileSync("scripts/model-inputs.json")).assets;
const parse = (s) =>
  restoreView(
    s,
    points.map((p) => p.id),
    assets,
  );
test("organ detail scopes selection, restores safely and resets on sex/layer/peel changes", () => {
  const initial = initialView();
  const layers = { ...initial.layers, skin: false, organ: true, vessel: true };
  const detail = { id: "heart", name: "심장", ids: ["heart", "artery"], layers };
  let s = viewReducer({ ...initial, selectionTarget: "skin" }, { type: "detail", detail });
  assert.equal(s.displayMode, "layers"); assert.equal(s.selectionTarget, "visible");
  assert.equal(s.stage, 3); assert.equal(s.dissection, 66);
  s = viewReducer(s, { type: "select", layer: "vessel", selection: { kind: "structure", ids: ["artery"], name: "혈관" } });
  assert.equal(s.detail.id, "heart"); assert.equal(s.isolated, true); assert.equal(s.layers.vessel, true); assert.equal(s.layers.organ, false);
  const catalog = [{ id: "heart", layer: "organ", sex: "male" }, { id: "artery", layer: "vessel", sex: "male" }];
  assert.deepEqual(restoreView(JSON.stringify(s), [], catalog).detail, detail);
  for (const action of [{type:"sex",value:"female"},{type:"stage",index:2},{type:"dissection",value:50.5},{type:"detail-close"},{type:"target",value:"skin"}]) {
    const next = viewReducer(s, action); assert.equal(next.detail,null); assert.equal(next.selection,null); assert.equal(next.isolated,false);
  }
  assert.equal(restoreView(JSON.stringify({...s,sex:"female"}), [], catalog).detail, null);
  const searched = viewReducer(initial, { type: "select", detail, layer: "vessel", selection: { kind: "structure", ids: ["artery"], name: "혈관" } });
  assert.equal(searched.detail.id, "heart"); assert.equal(searched.isolated, true);
  const surface = viewReducer(searched, { type: "target", value: "skin" });
  assert.equal(surface.selectionTarget, "skin"); assert.equal(surface.layers.skin, true); assert.equal(surface.displayMode, "layers");
  assert.equal(surface.detail, null); assert.equal(surface.selection, null); assert.equal(surface.isolated, false);
});
test("layer changes and presets leave no dangling isolated selection and preserve camera/markers", () => {
  let s = initialView("CV12");
  s = viewReducer(s, {
    type: "camera",
    value: { position: [0, 1, 0.5], target: [0, 1, 0] },
  });
  s = viewReducer(s, { type: "markers", value: "filtered" });
  s = viewReducer(s, { type: "compare", name: "위", ids: ["FMA7148"] });
  s = viewReducer(s, { type: "isolate" });
  assert.equal(s.isolated, true);
  s = viewReducer(s, {
    type: "layers",
    layers: { ...s.layers, organ: false, muscle: true },
  });
  assert.equal(s.selection, null);
  assert.equal(s.isolated, false);
  assert.equal(s.comparison, null);
  assert.equal(s.layers.muscle, true);
  const camera = s.camera;
  s = viewReducer(s, { type: "stage", index: 2 });
  assert.deepEqual(s.camera, camera);
  assert.equal(s.markers, "filtered");
});
test("comparison retains the entire kidney/lung bundle; explicit selection and point changes are independent", () => {
  const concepts = JSON.parse(fs.readFileSync("data/point-concepts.json"));
  for (const [id, count] of [
    ["KI3", 2],
    ["LU9", 5],
  ]) {
    let s = initialView(id);
    s = viewReducer(s, {
      type: "compare",
      name: "묶음",
      ids: concepts[id].organIds,
    });
    s = viewReducer(s, { type: "isolate" });
    assert.equal(s.selection.ids.length, count);
    assert.equal(s.selectionTarget, "internal");
    assert.equal(s.markers, "selected");
    const compare = s.comparison;
    s = viewReducer(s, {
      type: "select",
      selection: { kind: "structure", ids: [s.selection.ids[0]], name: "개별" },
    });
    assert.equal(s.isolated, false);
    assert.deepEqual(s.comparison, compare);
    s = viewReducer(s, { type: "point", id: "CV12" });
    assert.equal(s.comparison, null);
  }
});
test("continuous dissection keeps overlapping systems and advances through muscle depth", () => {
  let s = initialView();
  s = viewReducer(s, { type: "dissection", value: 20 });
  assert.equal(s.dissection, 20);
  assert.equal(s.layers.skin, false);
  assert.equal(s.layers.muscle, true);
  assert.equal(s.layers.bone, false);
  s = viewReducer(s, { type: "dissection", value: 50 });
  assert.equal(s.layers.muscle, true);
  assert.equal(s.layers.bone, true);
  assert.equal(s.layers.organ, false);
  s = viewReducer(s, { type: "dissection", value: 70 });
  assert.equal(s.layers.muscle, false);
  assert.equal(s.layers.organ, true);
  assert.equal(s.layers.vessel, true);
  assert.equal(s.layers.nerve, false);
  s = viewReducer(s, { type: "dissection", value: 90.24 });
  assert.equal(s.dissection, 90);
  assert.equal(s.layers.lymph, true);
  assert.equal(s.layers.nerve, true);
});
test("sex and anatomical region switches clear incompatible selections and expose lymph as its own layer", () => {
  let s = initialView("ST36");
  s = viewReducer(s, { type: "select", layer: "lymph", selection: { kind: "structure", ids: ["ZA_lymph_spleen"], name: "비장" } });
  assert.equal(s.stage, 5);
  assert.equal(s.dissection, 88);
  assert.equal(s.layers.lymph, true);
  assert.equal(Object.values(s.layers).filter(Boolean).length, 1);
  s = viewReducer(s, { type: "anatomy-region", value: "upper-limb" });
  assert.equal(s.anatomyRegion, "upper-limb");
  assert.equal(s.selection, null);
  s = viewReducer(s, { type: "sex", value: "female" });
  assert.equal(s.sex, "female");
  assert.equal(s.stage, 0);
  assert.equal(s.layers.skin, true);
  assert.equal(Object.values(s.layers).filter(Boolean).length, 1);
});
test("selecting a structure switches to its anatomical layer while preserving the camera and markers", () => {
  const camera = { position: [0, 1, 0.5], target: [0, 1, 0] };
  let s = initialView();
  s = viewReducer(s, { type: "camera", value: camera });
  s = viewReducer(s, { type: "markers", value: "filtered" });
  s = viewReducer(s, {
    type: "select",
    layer: "organ",
    selection: { kind: "structure", ids: ["FMA7148"], name: "위" },
  });
  assert.equal(s.stage, 3);
  assert.equal(s.dissection, 66);
  assert.deepEqual(s.layers, {
    skin: false,
    muscle: false,
    bone: false,
    organ: true,
    vessel: false,
    lymph: false,
    nerve: false,
  });
  assert.deepEqual(s.camera, camera);
  assert.equal(s.markers, "filtered");
  s = viewReducer(s, {
    type: "select",
    layer: "nerve",
    selection: { kind: "structure", ids: ["ZA_nerve_1"], name: "좌골신경" },
  });
  assert.equal(s.stage, 6);
  assert.equal(s.dissection, 98);
  assert.equal(s.layers.organ, false);
  assert.equal(s.layers.nerve, true);
  s = viewReducer(s, { type: "target", value: "skin" });
  assert.equal(s.stage, 0);
  assert.equal(s.dissection, 0);
  assert.equal(s.layers.skin, true);
  assert.equal(s.layers.nerve, true);
});
test("versioned session restoration validates current catalog, ranges and malformed storage", () => {
  let s = initialView("KI3");
  s = viewReducer(s, {
    type: "compare",
    name: "신",
    ids: ["FMA7204", "FMA7205"],
  });
  s = viewReducer(s, { type: "isolate" });
  assert.deepEqual(parse(JSON.stringify(s)), s);
  const legacy = { ...s, version: 2 };
  delete legacy.dissection;
  assert.equal(parse(JSON.stringify(legacy)).version, 4);
  for (const raw of [
    "bad",
    "null",
    "{}",
    JSON.stringify({ ...s, version: 1 }),
    JSON.stringify({ ...s, pointId: "FAKE" }),
    JSON.stringify({
      ...s,
      selection: { kind: "structure", ids: ["NOT_REAL"], name: "bad" },
    }),
    JSON.stringify({
      ...s,
      camera: { position: [NaN, 0, 1], target: [0, 0, 0] },
    }),
    JSON.stringify({ ...s, filters: { ...s.filters, concept: "unknown" } }),
  ])
    assert.deepEqual(parse(raw), initialView());
});
test("all 1179 searchable structures have Korean labels without losing original English identifiers", () => {
  const labels = JSON.parse(fs.readFileSync("data/structure-labels.json"));
  assert.equal(Object.keys(labels).length, 1179);
  assert.equal(assets.filter((a) => a.layer === "bone" && /phalan/i.test(a.name)).length, 56);
  for (const a of assets) {
    assert.match(labels[a.id], /[가-힣]/);
    assert.ok(a.name);
  }
  assert.match(labels.FMA24474, /대퇴골/);
  assert.match(labels.FMA22544, /전경골근/);
});
