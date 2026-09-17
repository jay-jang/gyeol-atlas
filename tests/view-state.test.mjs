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
test("versioned session restoration validates current catalog, ranges and malformed storage", () => {
  let s = initialView("KI3");
  s = viewReducer(s, {
    type: "compare",
    name: "신",
    ids: ["FMA7204", "FMA7205"],
  });
  s = viewReducer(s, { type: "isolate" });
  assert.deepEqual(parse(JSON.stringify(s)), s);
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
