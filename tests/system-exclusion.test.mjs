import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { initialView, viewReducer, restoreView } from "../src/view-state.ts";
import { depthStage, dissectionLayerOpacity, musclePeelOpacity, peelLayers, peelLimit, peelOrder, quantizeDepth, stageDepth } from "../src/dissection.ts";
import { musclePeelRanks } from "../src/muscle-peel.ts";

// "계통 빼기": systems left out of the progressive peel. Property-style checks
// over every non-full exclusion subset; display rules only, not tissue depth.
const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const points = read("data/points.json");
const assets = read("scripts/model-inputs.json").assets;
const pointIds = points.map((p) => p.id);
// The male heart detail source is not in the BodyParts3D input list.
const catalog = [...assets, { id: "BP4_FJ2631", layer: "organ", sex: "male" }];
const parse = (s, list = catalog) => restoreView(typeof s === "string" ? s : JSON.stringify(s), pointIds, list);

const ORDER = ["skin", "muscle", "bone", "organ", "vessel", "lymph", "nerve"];
// Where the innermost included system would begin to go (design contract).
// Muscles stop at 56, the last ranked muscle of the emptiest region (the arm).
const LIMIT = { skin: 8, muscle: 56, bone: 68, organ: 76, vessel: 84, lymph: 90, nerve: 100 };
// Bit i set = ORDER[i] left out; mask 127 (all seven) is never a valid set.
const SUBSETS = Array.from({ length: 127 }, (_, mask) => ORDER.filter((_, i) => (mask >> i) & 1));
const DEPTHS = Array.from({ length: 201 }, (_, i) => i / 2);
const OFF_GRID = [-10, 0.24, 7.76, 8.26, 33.3, 59.9, 60.26, 67.74, 99.9, 150];
const included = (excluded) => ORDER.filter((layer) => !excluded.includes(layer));
const innermost = (excluded) => included(excluded).at(-1);
const name = (excluded) => `[${excluded.join(",") || "none"}]`;
const drawn = (layers) => ORDER.filter((layer) => layers[layer]);
// Independent oracle: the progressive renderer mounts a system while its
// opacity is above zero, and never mounts a left-out one.
const expectedLayers = (depth, excluded) =>
  Object.fromEntries(ORDER.map((layer) => [layer, !excluded.includes(layer) && dissectionLayerOpacity(layer, depth) > 0]));
// Whole: the system and (for muscles) its deepest-ranked mesh are fully opaque.
const whole = (layer, depth) => dissectionLayerOpacity(layer, depth) === 1 && (layer !== "muscle" || musclePeelOpacity(depth, 1) === 1);
const only = (...on) => Object.fromEntries(ORDER.map((layer) => [layer, on.includes(layer)]));
const ALL = only(...ORDER);

const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (items, rng) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};
// The same set, out of order, with duplicates.
const messy = (excluded, rng) => shuffle([...excluded, ...excluded.slice(0, 2)], rng);

const CAMERA = { position: [0.3, 1.2, 2.4], target: [0, 1.1, 0] };
const FRAMED = { position: [0.1, 1.15, 0.8], target: [0, 1.1, 0] };
// A viewer with non-default preferences, in progressive peel mode at 0%.
function viewer(sex = "male", region = "lower-body") {
  let s = initialView("KI3");
  if (sex !== s.sex) s = viewReducer(s, { type: "sex", value: sex });
  for (const action of [
    { type: "anatomy-region", value: region },
    { type: "markers", value: "hidden" },
    { type: "labels", value: true },
    { type: "connective", value: false },
    { type: "modesty", value: true },
    { type: "fade-context", value: false },
    { type: "alpha", layer: "muscle", value: 0.6 },
    { type: "alpha", layer: "skin", value: 0.8 },
    { type: "camera", value: { position: [...CAMERA.position], target: [...CAMERA.target] } },
  ]) s = viewReducer(s, action);
  return s;
}
const PREFERENCES = ["camera", "markers", "labels", "connective", "modesty", "fadeContext", "femaleMarkers", "alpha", "pointId", "sex", "anatomyRegion", "filters"];
const peel = (s, excluded, depth) => viewReducer(viewReducer(s, { type: "excluded", value: excluded }), { type: "dissection", value: depth });

// Every progressive scene under exclusions obeys the same rules.
function assertPeel(s, excluded, requested, msg) {
  const limit = peelLimit(excluded);
  const depth = Math.min(quantizeDepth(requested), limit);
  assert.equal(s.displayMode, "dissection", `${msg}: mode`);
  assert.deepEqual(s.excluded, excluded, `${msg}: excluded`);
  assert.equal(s.dissection, depth, `${msg}: depth`);
  assert.ok(s.dissection <= limit, `${msg}: depth ${s.dissection} beyond limit ${limit}`);
  assert.deepEqual(s.layers, expectedLayers(depth, excluded), `${msg}: layers`);
  assert.deepEqual(s.layers, peelLayers(depth, excluded), `${msg}: peelLayers`);
  const visible = drawn(s.layers);
  assert.ok(visible.length > 0, `${msg}: empty scene`);
  for (const layer of excluded) assert.equal(s.layers[layer], false, `${msg}: ${layer} drawn although left out`);
  assert.equal(s.layers[innermost(excluded)], true, `${msg}: innermost included system peeled away`);
  assert.equal(s.stage, ORDER.indexOf(visible[0]), `${msg}: stage names the outermost drawn system`);
  assert.equal(s.stage, depthStage(depth, excluded), `${msg}: depthStage`);
}
const ended = (s, msg) => {
  for (const key of ["selection", "selectionReturn", "detail", "detailReturn", "comparison"]) assert.equal(s[key], null, `${msg}: ${key}`);
  assert.equal(s.isolated, false, `${msg}: isolated`);
};

const PICKS = [
  { kind: "structure", ids: ["FMA7163"], name: "피부", layers: ["skin"] },
  { kind: "structure", ids: ["FMA22328"], name: "큰볼기근", layers: ["muscle"] },
  { kind: "structure", ids: ["FMA24474"], name: "넙다리뼈", layers: ["bone"] },
  { kind: "structure", ids: ["FMA7148"], name: "위", layers: ["organ"] },
  { kind: "structure", ids: ["FMA3736"], name: "오름대동맥", layers: ["vessel"] },
  { kind: "structure", ids: ["ZA_lymph_spleen"], name: "비장", layers: ["lymph"] },
  { kind: "structure", ids: ["FMA62004"], name: "숨뇌", layers: ["nerve"] },
  { kind: "bundle", ids: ["FMA24474", "FMA22328"], name: "뼈·근육", layers: ["bone", "muscle"] },
];
const HEART = { id: "heart", name: "심장", ids: ["BP4_FJ2631"], layers: only("organ", "vessel") };

test("the 127 exclusion subsets are distinct, never all seven, and each limit is where its innermost included system begins to go", () => {
  assert.equal(SUBSETS.length, 127);
  assert.equal(new Set(SUBSETS.map(String)).size, 127);
  assert.deepEqual([...peelOrder], ORDER);
  for (const excluded of SUBSETS) {
    assert.ok(excluded.length < ORDER.length, name(excluded));
    const inner = innermost(excluded), limit = peelLimit(excluded);
    assert.equal(limit, LIMIT[inner], name(excluded));
    // Whole at the clamp; the next half-percent would start to remove it.
    assert.ok(whole(inner, limit), `${name(excluded)}: ${inner} not whole at ${limit}`);
    // Muscles stop early on purpose: 56 keeps a muscle in every body region
    // (checked against the drawn scene in tests/browser/system-exclusion.spec.ts).
    if (limit < 100 && inner !== "muscle") assert.ok(!whole(inner, limit + 0.5), `${name(excluded)}: limit ${limit} stops short`);
    // Peeling up to the limit removes only systems outside the innermost one.
    for (const depth of DEPTHS.filter((d) => d <= limit)) assert.ok(whole(inner, depth), `${name(excluded)}: ${inner} fades at ${depth}`);
  }
  assert.equal(peelLimit(), 100);
  assert.equal(peelLimit([]), 100);
});

test("every subset at every half-percent depth: nonempty, no left-out system drawn, clamped, stage = outermost drawn", () => {
  for (const sex of ["male", "female"]) {
    const base = viewer(sex);
    for (const excluded of SUBSETS) {
      for (const depth of [...DEPTHS, ...OFF_GRID]) {
        const msg = `${sex} ${name(excluded)} @${depth}`;
        const s = peel(base, excluded, depth);
        assertPeel(s, excluded, depth, msg);
        // Choosing the depth first and the systems second gives the same scene.
        const other = viewReducer(viewReducer(base, { type: "dissection", value: depth }), { type: "excluded", value: excluded });
        assert.deepEqual(other, s, `${msg}: order of choice`);
      }
      // At the clamp the innermost included system is fully opaque.
      const atLimit = peel(base, excluded, 100);
      const inner = innermost(excluded);
      assert.equal(atLimit.dissection, peelLimit(excluded));
      assert.equal(dissectionLayerOpacity(inner, atLimit.dissection), 1, `${sex} ${name(excluded)}: ${inner} opacity`);
      if (inner === "muscle") assert.equal(musclePeelOpacity(atLimit.dissection, 1), 1, `${sex} ${name(excluded)}: deepest muscle rank`);
    }
  }
});

test("each included system's depth stop lands on that system without being clamped", () => {
  const base = viewer();
  for (const excluded of SUBSETS) for (const layer of included(excluded)) {
    const index = ORDER.indexOf(layer);
    const s = viewReducer(peel(base, excluded, 0), { type: "dissection", value: stageDepth[index] });
    assert.equal(s.dissection, stageDepth[index], `${name(excluded)} ${layer}`);
    assert.equal(s.stage, index, `${name(excluded)} ${layer}`);
    assertPeel(s, excluded, stageDepth[index], `${name(excluded)} stop ${layer}`);
  }
});

test("muscles at the 56% clamp: for any score order the deepest-ranked real muscle is still whole", () => {
  // Male ranks come from mesh geometry at runtime, female native ones from
  // bounds, transported ones from stored scores: check the real id sets with
  // the real relations under arbitrary scores, plus the stored scores.
  const rng = mulberry32(60);
  const sets = [
    assets.filter((a) => a.layer === "muscle").map((a) => a.id),
    read("data/female-atlas-structures.json").filter((s) => s.layer === "muscle").map((s) => s.id),
  ];
  for (const ids of sets) for (let trial = 0; trial < 12; trial++) {
    const ranks = musclePeelRanks(ids.map((id) => ({ id, score: rng() })));
    assert.ok([...ranks.values()].some((rank) => musclePeelOpacity(LIMIT.muscle, rank) === 1), `trial ${trial}`);
  }
  const transported = read("data/female-transport-structures.json").filter((s) => s.peelScore !== undefined);
  const ranks = musclePeelRanks(transported.map((s) => ({ id: s.transport, score: s.peelScore })));
  assert.ok([...ranks.values()].some((rank) => musclePeelOpacity(LIMIT.muscle, rank) === 1));
  assert.equal(dissectionLayerOpacity("muscle", LIMIT.muscle), 1);
});

test("peel order holds under every subset: deepening never brings a system back and peels from the outside in (Q20)", () => {
  const base = viewer();
  for (const excluded of SUBSETS) {
    const kept = included(excluded);
    // Absolute (slider) and relative (keyboard/wheel) inputs.
    for (const via of ["dissection", "dissection-step"]) {
      let s = peel(base, excluded, 0);
      assert.deepEqual(drawn(s.layers), kept, `${name(excluded)}: every included system present at 0%`);
      const gone = new Set();
      for (const depth of DEPTHS.slice(1)) {
        const next = via === "dissection"
          ? viewReducer(s, { type: "dissection", value: depth })
          : viewReducer(s, { type: "dissection-step", amount: 0.5 });
        const msg = `${name(excluded)} ${via} @${depth}`;
        for (const layer of gone) assert.equal(next.layers[layer], false, `${msg}: ${layer} reappears`);
        for (const layer of ORDER) if (!next.layers[layer]) gone.add(layer);
        // Once an included system is drawn, every included system inside it is too.
        const visible = drawn(next.layers);
        assert.deepEqual(visible, kept.slice(kept.indexOf(visible[0])), `${msg}: peeled out of order`);
        assert.ok(next.stage >= s.stage, `${msg}: stage moved outward`);
        assert.ok(next.dissection >= s.dissection, `${msg}: depth moved back`);
        s = next;
      }
      assert.equal(s.dissection, peelLimit(excluded), `${name(excluded)} ${via}: ends at the limit`);
    }
  }
});

test("excluding all seven is ignored; order, duplicates and unknown names normalise; the same set in a peel is the same state", () => {
  const rng = mulberry32(3);
  const base = viewer();
  const peeled = peel(base, ["skin", "muscle"], 70);
  const states = [
    base,
    peeled,
    viewReducer(peeled, { type: "stage", index: 2 }),
    viewReducer(peeled, { type: "select", layer: "organ", selection: PICKS[3] }),
    viewReducer(peeled, { type: "compare", name: "콩팥", ids: ["FMA7204", "FMA7205"], selectionLayers: ["organ"] }),
    viewReducer(peeled, { type: "detail", detail: HEART }),
  ];
  for (const s of states) for (const all of [[...ORDER], [...ORDER].reverse(), [...ORDER, "skin", "nerve"], [...ORDER, "bogus"], shuffle(ORDER, rng)])
    assert.equal(viewReducer(s, { type: "excluded", value: all }), s, `all seven from ${s.displayMode}`);
  for (const excluded of SUBSETS) {
    const s = peel(base, excluded, 64);
    const input = [...messy(excluded, rng), "bogus"];
    const frozen = [...input];
    const normalised = viewReducer(peel(base, [], 64), { type: "excluded", value: input });
    assert.deepEqual(input, frozen, "the action's array is not mutated");
    assert.deepEqual(normalised.excluded, excluded, `${name(excluded)}: peel order`);
    assert.deepEqual(normalised, s, name(excluded));
    // The same set (in any spelling) during a peel changes nothing.
    assert.equal(viewReducer(s, { type: "excluded", value: [...excluded] }), s, name(excluded));
    assert.equal(viewReducer(s, { type: "excluded", value: input }), s, name(excluded));
    // The same set from an explicit view re-enters the peel at its depth.
    const solo = viewReducer(s, { type: "stage", index: 6 });
    const back = viewReducer(solo, { type: "excluded", value: input });
    assert.notEqual(back, solo);
    assertPeel(back, excluded, solo.dissection, `${name(excluded)} from solo view`);
  }
});

test("camera, markers, labels, connective, modesty, alpha, point and sex survive leaving systems out and peeling (Q2/Q30)", () => {
  for (const sex of ["male", "female"]) {
    const base = viewer(sex);
    const camera = base.camera;
    for (const excluded of SUBSETS) for (const depth of [0, 8, 20, 50.5, 60, 66, 70, 80, 88, 92.5, 100]) {
      let s = viewReducer(base, { type: "dissection", value: depth });
      const chain = [
        { type: "excluded", value: excluded },
        { type: "dissection-step", amount: 5 },
        { type: "dissection", value: 100 },
        { type: "dissection-step", amount: -7.5 },
        { type: "excluded", value: [] },
        { type: "excluded", value: excluded },
      ];
      for (const action of chain) {
        s = viewReducer(s, action);
        const msg = `${sex} ${name(excluded)} @${depth} ${action.type}`;
        for (const key of PREFERENCES) assert.deepEqual(s[key], base[key], `${msg}: ${key}`);
        assert.equal(s.camera, camera, `${msg}: the camera is not moved`);
        assert.equal(s.displayMode, "dissection", msg);
      }
    }
  }
});

test("a picked structure is carried while its systems stay drawn and ends once one is left out (Q1)", () => {
  const base = viewer();
  for (const excluded of SUBSETS) for (const selection of PICKS) for (const depth of [0, 30, 62, 66, 70, 80, 86, 92, 100]) {
    let s = viewReducer(base, { type: "dissection", value: depth });
    if (!selection.layers.every((layer) => s.layers[layer])) continue;
    s = viewReducer(viewReducer(s, { type: "pick", selection }), { type: "isolate" });
    const next = viewReducer(s, { type: "excluded", value: excluded });
    const msg = `${name(excluded)} ${selection.name} @${depth}`;
    if (!excluded.length) { assert.equal(next, s, msg); continue; }
    assertPeel(next, excluded, depth, msg);
    const depthNow = Math.min(depth, peelLimit(excluded));
    const keep = selection.layers.every((layer) => !excluded.includes(layer) && dissectionLayerOpacity(layer, depthNow) > 0);
    if (keep) assert.equal(next.selection, s.selection, `${msg}: carried`);
    else assert.equal(next.selection, null, `${msg}: hidden selection left behind`);
    if (next.selection) assert.ok(next.selection.layers.every((layer) => next.layers[layer]), `${msg}: lone hidden selection`);
    // Within a peel the isolation of a selection that stays drawn remains.
    assert.equal(next.isolated, Boolean(next.selection), `${msg}: isolation follows the selection`);
    assert.equal(next.camera, s.camera, msg);
  }
});

test("a comparison is carried only while its organs stay drawn; a detail always ends without moving the camera", () => {
  const base = viewer();
  const compared = viewReducer(peel(base, [], 50.5), { type: "compare", name: "콩팥", ids: ["FMA7204", "FMA7205"], selectionLayers: ["organ"] });
  let detail = viewReducer(peel(base, [], 50.5), { type: "detail", detail: HEART });
  detail = viewReducer(detail, { type: "camera", value: FRAMED });
  for (const excluded of SUBSETS) {
    const c = viewReducer(compared, { type: "excluded", value: excluded });
    assertPeel(c, excluded, compared.dissection, `compare ${name(excluded)}`);
    if (excluded.includes("organ")) { assert.equal(c.selection, null); assert.equal(c.comparison, null); }
    else { assert.equal(c.selection, compared.selection); assert.equal(c.comparison, compared.comparison); }
    assert.equal(c.selectionReturn, null);
    assert.equal(c.camera, compared.camera);
    const d = viewReducer(detail, { type: "excluded", value: excluded });
    assertPeel(d, excluded, detail.dissection, `detail ${name(excluded)}`);
    ended(d, `detail ${name(excluded)}`);
    assert.equal(d.camera, detail.camera, `detail ${name(excluded)}: camera`);
    for (const key of ["markers", "labels", "connective", "modesty", "alpha", "pointId", "sex"]) assert.deepEqual(d[key], detail[key], key);
  }
});

test("explicit views open their own systems whatever the peel leaves out", () => {
  const base = viewer();
  for (const excluded of SUBSETS) {
    const s = peel(base, excluded, 50.5);
    const views = [
      ...ORDER.map((layer, index) => [`eye ${layer}`, viewReducer(s, { type: "stage", index }), only(layer)]),
      ["compare default", viewReducer(s, { type: "compare", name: "콩팥", ids: ["FMA7204", "FMA7205"] }), only("skin", "organ")],
      ["compare own layers", viewReducer(s, { type: "compare", name: "x", ids: ["FMA7148"], layers: only("organ", "nerve") }), only("organ", "nerve")],
      ...PICKS.slice(0, 7).map((selection) => [`select ${selection.layers[0]}`, viewReducer(s, { type: "select", layer: selection.layers[0], selection }), only(selection.layers[0])]),
      ["detail", viewReducer(s, { type: "detail", detail: HEART }), HEART.layers],
      ["connective-only", viewReducer(s, { type: "connective-only", ids: ["FMA24474"] }), only("muscle", "bone")],
      ["open-structures", viewReducer(s, { type: "open-structures", ids: ["FMA22328", "FMA22329"], name: "큰볼기근", layers: ["muscle", "bone"] }), only("muscle", "bone")],
      ["target skin", viewReducer(s, { type: "target", value: "skin" }), { ...s.layers, skin: true }],
      ["layers", viewReducer(s, { type: "layers", layers: ALL }), ALL],
    ];
    for (const [label, view, layers] of views) {
      const msg = `${name(excluded)} ${label}`;
      assert.equal(view.displayMode, "layers", msg);
      assert.deepEqual(view.layers, layers, msg);
      assert.deepEqual(view.excluded, excluded, `${msg}: the set itself is kept`);
      assert.equal(view.camera, s.camera, `${msg}: camera`);
    }
  }
});

// Explicit views opened from a peel, and the ways back to that peel.
const OPENERS = [
  ["select organ", (s) => viewReducer(s, { type: "select", layer: "organ", selection: PICKS[3] })],
  ["select nerve", (s) => viewReducer(s, { type: "select", layer: "nerve", selection: PICKS[6] })],
  ["open-structures", (s) => viewReducer(s, { type: "open-structures", ids: ["FMA22328", "FMA22329"], name: "큰볼기근", layers: ["muscle"] })],
  ["connective-only", (s) => viewReducer(s, { type: "connective-only", ids: ["FMA24474"] })],
  ["compare", (s) => viewReducer(s, { type: "compare", name: "콩팥", ids: ["FMA7204", "FMA7205"], selectionLayers: ["organ"] })],
  ["detail", (s) => viewReducer(s, { type: "detail", detail: HEART })],
  ["select inside detail", (s) => viewReducer(viewReducer(s, { type: "detail", detail: HEART }), { type: "select", layer: "organ", selection: { kind: "structure", ids: ["BP4_FJ2631"], name: "심장", layers: ["organ"] } })],
];
const CLOSERS = [
  [{ type: "clear-selection" }, () => true],
  [{ type: "detail-close" }, (s) => Boolean(s.detail)],
  [{ type: "anatomy-region", value: "head" }, () => true],
  [{ type: "point", id: "ST36" }, (s) => Boolean(s.detail || s.comparison)],
  [{ type: "show-filtered" }, () => true],
  [{ type: "region-filter", value: "다리·발" }, () => true],
];
function assertReturned(back, before, open, excluded, closer, msg) {
  assertPeel(back, excluded, before.dissection, msg);
  ended(back, msg);
  assert.equal(back.anatomyRegion, closer.type === "anatomy-region" ? closer.value : before.anatomyRegion, `${msg}: region`);
  for (const key of ["cutaway", "selectionTarget", "alpha", "sex", "modesty", "labels"]) assert.deepEqual(back[key], before[key], `${msg}: ${key}`);
  // A detail is a separate frame and returns with its origin's camera; a
  // selection or comparison keeps where the viewer is looking.
  assert.deepEqual(back.camera, open.detail ? before.camera : FRAMED, `${msg}: camera`);
}

test("leaving an explicit view returns to the peel with the systems left out now, including a set changed while it was open", () => {
  const rng = mulberry32(11);
  for (const [index, excluded] of SUBSETS.entries()) for (const depth of [0, 50.5, 66.5, 100]) {
    const before = peel(viewer(), excluded, depth);
    const others = [excluded, [], SUBSETS[(index * 37 + 11) % 127], SUBSETS[126 - index]];
    for (const [label, opener] of OPENERS) {
      const open = viewReducer(opener(before), { type: "camera", value: FRAMED });
      assert.equal(open.displayMode, "layers", label);
      for (const later of others) {
        // The reducer's own "excluded" ends the view (as a peel would); the
        // set can differ on return only through a saved or edited state.
        const changed = { ...open, excluded: later };
        for (const [closer, applies] of CLOSERS) if (applies(open)) {
          const msg = `${label} ${name(excluded)}→${name(later)} @${depth} ${closer.type}`;
          assertReturned(viewReducer(changed, closer), before, open, later, closer, msg);
        }
      }
      // Choosing a set while the view is open ends it at the view's depth.
      const target = SUBSETS[Math.floor(rng() * 127)];
      const next = viewReducer(open, { type: "excluded", value: target });
      assertPeel(next, target, open.dissection, `${label} ${name(excluded)} then excluded ${name(target)}`);
      assert.equal(next.detail, null); assert.equal(next.detailReturn, null); assert.equal(next.selectionReturn, null);
      if (next.selection) assert.ok(next.selection.layers?.every((layer) => next.layers[layer]), `${label}: hidden selection`);
      assert.equal(next.camera, open.camera, `${label}: camera`);
    }
  }
});

test("dissection-step stops at the limit of what is left in: a no-op there in a peel, clamped past it, a transition from explicit views", () => {
  const base = viewer();
  for (const excluded of SUBSETS) {
    const limit = peelLimit(excluded);
    let s = peel(base, excluded, 0);
    let steps = 0;
    for (;;) {
      const next = viewReducer(s, { type: "dissection-step", amount: 0.5 });
      if (next === s) break;
      assert.equal(next.dissection, s.dissection + 0.5, name(excluded));
      s = next;
      assert.ok(++steps <= 200);
    }
    assert.equal(steps, limit * 2, name(excluded));
    assertPeel(s, excluded, limit, `${name(excluded)} at limit`);
    for (const amount of [0.5, 1, 5, 37.5, 100, 1e6, Infinity, NaN, 0]) assert.equal(viewReducer(s, { type: "dissection-step", amount }), s, `${name(excluded)} +${amount}`);
    if (limit > 0) assert.equal(viewReducer(s, { type: "dissection-step", amount: -0.5 }).dissection, limit - 0.5);
    for (const start of [0, Math.max(0, limit - 2), Math.max(0, limit - 0.5)]) for (const amount of [0.5, 5, 37.5, 100]) {
      const from = peel(base, excluded, start);
      const next = viewReducer(from, { type: "dissection-step", amount });
      assertPeel(next, excluded, Math.min(start + amount, limit), `${name(excluded)} ${start}+${amount}`);
    }
    // From an explicit view at or beyond the limit, a step re-enters the clamped peel.
    for (const index of ORDER.keys()) for (const amount of [0.5, -0.5, 5]) {
      const solo = viewReducer(s, { type: "stage", index });
      const next = viewReducer(solo, { type: "dissection-step", amount });
      assert.notEqual(next, solo);
      assertPeel(next, excluded, Math.min(quantizeDepth(solo.dissection + amount), limit), `${name(excluded)} eye ${ORDER[index]} ${amount}`);
    }
  }
});

test("switching the body keeps the systems left out and starts at 0% with them; reset clears them", () => {
  for (const excluded of SUBSETS) for (const depth of [0, 50.5, 100]) {
    const peeled = peel(viewer(), excluded, depth);
    for (const s of [peeled, viewReducer(peeled, { type: "select", layer: "nerve", selection: PICKS[6] }), viewReducer(peeled, { type: "detail", detail: HEART })]) {
      const female = viewReducer(s, { type: "sex", value: "female" });
      const msg = `${name(excluded)} @${depth} from ${s.displayMode}`;
      assertPeel(female, excluded, 0, `${msg} → female`);
      ended(female, msg);
      assert.equal(female.sex, "female");
      assert.equal(female.camera, s.camera, `${msg}: camera`);
      for (const key of ["markers", "labels", "connective", "modesty", "pointId"]) assert.deepEqual(female[key], s[key], `${msg}: ${key}`);
      assertPeel(viewReducer(female, { type: "sex", value: "male" }), excluded, 0, `${msg} → male`);
      assertPeel(viewReducer(female, { type: "dissection", value: 100 }), excluded, 100, `${msg} female full peel`);
      const reset = viewReducer(s, { type: "reset" });
      assert.deepEqual(reset.excluded, [], msg);
      assert.deepEqual(reset, { ...initialView("KI3"), modesty: s.modesty }, msg);
      assert.equal(viewReducer(reset, { type: "dissection", value: 100 }).dissection, 100, `${msg}: the full peel is available again`);
    }
  }
});

test("saved views round-trip the set; a missing field leaves nothing out; malformed or all-seven sets reset safely", () => {
  const rng = mulberry32(8);
  const base = viewer();
  for (const excluded of SUBSETS) {
    for (const depth of [0, 8, 20, 50.5, 60, 66.5, 68, 76, 84, 90, 95, 100]) {
      const s = peel(base, excluded, depth);
      assert.deepEqual(parse(s), s, `${name(excluded)} @${depth}`);
    }
    // Explicit views opened from the peel, and a pick carried in it.
    const s = peel(base, excluded, 50.5);
    for (const [label, opener] of OPENERS) {
      const open = opener(s);
      const restored = parse(open);
      assert.deepEqual(restored, open, `${name(excluded)} ${label}`);
      assert.deepEqual(viewReducer(restored, { type: "clear-selection" }), viewReducer(open, { type: "clear-selection" }), `${name(excluded)} ${label} back`);
    }
    for (const selection of PICKS.filter((pick) => !pick.ids[0].startsWith("ZA_"))) if (selection.layers.every((layer) => s.layers[layer])) {
      const picked = viewReducer(s, { type: "pick", selection });
      assert.deepEqual(parse(picked), picked, `${name(excluded)} pick ${selection.name}`);
    }
    // Out of order and duplicated input is stored in peel order.
    if (excluded.length) {
      const restored = parse({ ...s, excluded: messy(excluded, rng) });
      assert.deepEqual(restored.excluded, excluded, name(excluded));
      assert.deepEqual(restored, s, name(excluded));
    }
  }
  // Sessions saved before "계통 빼기" existed leave nothing out.
  for (const s of [peel(base, [], 50.5), viewReducer(peel(base, [], 50.5), { type: "select", layer: "organ", selection: PICKS[3] })]) {
    const legacy = { ...s }; delete legacy.excluded;
    assert.deepEqual(parse(legacy), s);
    assert.deepEqual(parse(legacy).excluded, []);
  }
  const s = peel(base, ["organ"], 50.5);
  for (const value of ["organ", { organ: true }, null, 3, true, ["organ", "bones"], ["Organ"], [null], [["organ"]], [...ORDER], [...ORDER].reverse(), [...ORDER, "organ"], shuffle(ORDER, rng)])
    assert.deepEqual(parse({ ...s, excluded: value }), initialView(), JSON.stringify(value));
});

test("restoring clamps a saved peel to the set's limit and recomputes progressive return views with it", () => {
  const base = viewer();
  for (const excluded of SUBSETS) for (const depth of [0, 8.5, 50.5, 62, 66.5, 70, 80, 86, 92, 100]) {
    const plain = peel(base, [], depth);
    // Stale or edited layers and depth: the peel schedule wins.
    for (const layers of [plain.layers, ALL]) {
      const restored = parse({ ...plain, excluded, layers });
      assertPeel(restored, excluded, depth, `${name(excluded)} @${depth}`);
      assert.deepEqual(restored, peel(base, excluded, depth), `${name(excluded)} @${depth}`);
    }
    // A selection opened during the peel: its return view uses the saved set.
    const selected = viewReducer(viewReducer(plain, { type: "select", layer: "organ", selection: PICKS[3] }), { type: "camera", value: FRAMED });
    const r = parse({ ...selected, excluded });
    const at = Math.min(depth, peelLimit(excluded));
    assert.equal(r.selectionReturn.displayMode, "dissection");
    assert.equal(r.selectionReturn.dissection, at, `${name(excluded)} @${depth}`);
    assert.deepEqual(r.selectionReturn.layers, expectedLayers(at, excluded), `${name(excluded)} @${depth}`);
    assert.equal(r.selectionReturn.stage, ORDER.indexOf(drawn(expectedLayers(at, excluded))[0]));
    assertReturned(viewReducer(r, { type: "clear-selection" }), plain, selected, excluded, { type: "clear-selection" }, `restored select ${name(excluded)} @${depth}`);
    // A detail's return view likewise.
    const detail = viewReducer(viewReducer(plain, { type: "detail", detail: HEART }), { type: "camera", value: FRAMED });
    const d = parse({ ...detail, excluded });
    assert.deepEqual(d.detailReturn.layers, expectedLayers(at, excluded));
    assert.equal(d.detailReturn.dissection, at);
    assertReturned(viewReducer(d, { type: "detail-close" }), plain, detail, excluded, { type: "detail-close" }, `restored detail ${name(excluded)} @${depth}`);
  }
  // A return view of explicit systems is left as it was saved.
  const solo = viewReducer(base, { type: "stage", index: 2 });
  const compared = viewReducer(solo, { type: "compare", name: "콩팥", ids: ["FMA7204", "FMA7205"], selectionLayers: ["organ"] });
  for (const excluded of SUBSETS) {
    const r = parse({ ...compared, excluded });
    assert.deepEqual(r.selectionReturn, compared.selectionReturn, name(excluded));
    assert.deepEqual(viewReducer(r, { type: "clear-selection" }).layers, only("bone"), name(excluded));
  }
  // An old detail saved without a return view closes onto 0% with the set.
  for (const excluded of SUBSETS) {
    const legacy = { ...viewReducer(peel(base, excluded, 50.5), { type: "detail", detail: HEART }) };
    delete legacy.detailReturn;
    const closed = viewReducer(parse(legacy), { type: "detail-close" });
    assertPeel(closed, excluded, 0, `legacy detail ${name(excluded)}`);
  }
});

test("a restored peel that carries a selection still obeys the set: clamped, no left-out system drawn, an outermost stage", () => {
  // Reducer-made sessions are always consistent; this is an edited or stale
  // snapshot (only the "excluded" field differs), which restoreView treats as
  // untrusted. AtlasPage reads stages[depthStage(depth, excluded)] while peeling.
  const base = viewer("male", "whole");
  const cases = [];
  for (const excluded of SUBSETS) for (const selection of PICKS.filter((pick) => !pick.ids[0].startsWith("ZA_"))) for (const depth of [0, 50.5, 66, 70, 80, 86, 90, 100]) {
    const s = viewReducer(base, { type: "dissection", value: depth });
    if (!selection.layers.every((layer) => s.layers[layer])) continue;
    const picked = viewReducer(s, { type: "pick", selection });
    const r = parse({ ...picked, excluded });
    if (r.displayMode !== "dissection") continue;
    const limit = peelLimit(r.excluded);
    const broken = r.dissection > limit || r.excluded.some((layer) => r.layers[layer]) || depthStage(r.dissection, r.excluded) < 0
      || (r.selection && !r.selection.layers.every((layer) => r.layers[layer] && !r.excluded.includes(layer)));
    if (broken) cases.push(`${name(excluded)} pick ${selection.layers.join("+")} @${depth} → depth ${r.dissection}, drawn ${drawn(r.layers).join("+")}, stage ${depthStage(r.dissection, r.excluded)}`);
  }
  assert.deepEqual(cases.slice(0, 8), [], `${cases.length} restored peels break the exclusion rules, e.g.`);
});

test("within a peel, changing what is left out keeps the cut and click target; pushing past the stop changes nothing", () => {
  let s = viewReducer(viewer(), { type: "dissection", value: 30 });
  s = viewReducer(viewReducer(s, { type: "cutaway", value: 0.5 }), { type: "target", value: "internal" });
  const next = viewReducer(s, { type: "excluded", value: ["organ"] });
  assert.equal(next.cutaway, 0.5); assert.equal(next.selectionTarget, "internal"); assert.equal(next.layers.organ, false);
  // At the stop a slider value beyond it is a no-op, as at 100%.
  let limited = viewReducer(viewReducer(viewer(), { type: "excluded", value: ["bone", "organ", "vessel", "lymph", "nerve"] }), { type: "dissection", value: 100 });
  assert.equal(limited.dissection, 56);
  const pick = { kind: "structure", ids: [assets.find((a) => a.layer === "muscle").id], name: "근육", layers: ["muscle"] };
  limited = viewReducer(viewReducer(viewReducer(limited, { type: "pick", selection: pick }), { type: "isolate" }), { type: "cutaway", value: 0.4 });
  assert.equal(viewReducer(limited, { type: "dissection", value: 70 }), limited);
  assert.equal(viewReducer(limited, { type: "dissection-step", amount: 0.5 }), limited);
  // A real move still ends isolation and the cut, as before.
  const moved = viewReducer(limited, { type: "dissection", value: 40 });
  assert.equal(moved.isolated, false); assert.equal(moved.cutaway, 0);
});

test("the arm has no organs: an organ-innermost peel there stops at the next included system, and a region change re-clamps", () => {
  assert.equal(peelLimit(["vessel", "lymph", "nerve"]), 76);
  assert.equal(peelLimit(["vessel", "lymph", "nerve"], "upper-limb"), 68);
  assert.equal(peelLimit(["bone", "vessel", "lymph", "nerve"], "upper-limb"), 56);
  assert.equal(peelLimit(["vessel", "lymph", "nerve"], "lower-limb"), 76);
  // Organs alone cannot be helped in the arm; the limit stays theirs.
  assert.equal(peelLimit(["skin", "muscle", "bone", "vessel", "lymph", "nerve"], "upper-limb"), 76);
  let s = viewReducer(viewReducer(viewer(), { type: "excluded", value: ["vessel", "lymph", "nerve"] }), { type: "dissection", value: 100 });
  assert.equal(s.dissection, 76); assert.equal(s.stage, 3);
  s = viewReducer(s, { type: "anatomy-region", value: "upper-limb" });
  assert.equal(s.dissection, 68); assert.equal(s.displayMode, "dissection"); assert.equal(s.layers.bone, true);
  assert.equal(viewReducer(s, { type: "dissection-step", amount: 0.5 }), s);
  const restored = parse({ ...s, dissection: 76, layers: peelLayers(76, s.excluded) });
  assert.equal(restored.dissection, 68); assert.equal(restored.layers.bone, true);
});
