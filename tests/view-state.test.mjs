import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { initialView, viewReducer, restoreView } from "../src/view-state.ts";
const points = JSON.parse(fs.readFileSync("data/points.json"));
const assets = JSON.parse(fs.readFileSync("scripts/model-inputs.json")).assets;
const femaleAirway = JSON.parse(fs.readFileSync("data/female-airway-groups.json"))[0];
const parse = (s) =>
  restoreView(
    s,
    points.map((p) => p.id),
    assets,
  );
test("relative peel inputs compose without stale absolute depth and preserve preferences", () => {
  let s = {...initialView(), camera:{position:[0,1,3],target:[0,1,0]}, markers:'hidden'};
  const camera=s.camera;
  for(let i=0;i<201;i++)s=viewReducer(s,{type:'dissection-step',amount:.5});
  assert.equal(s.dissection,100);assert.equal(s.camera,camera);assert.equal(s.markers,'hidden');
  assert.equal(viewReducer(s,{type:'dissection-step',amount:.5}),s);
  assert.equal(viewReducer(s,{type:'dissection-step',amount:NaN}),s);
  s=viewReducer(s,{type:'dissection-step',amount:-5});assert.equal(s.dissection,95);
  for(let i=0;i<200;i++)s=viewReducer(s,{type:'dissection-step',amount:-.5});
  assert.equal(s.dissection,0);assert.equal(s.camera,camera);assert.equal(s.markers,'hidden');
});
test("clamped peel inputs enter progressive mode from layers but preserve progressive boundaries", () => {
  for(const sex of ['male','female'])for(const [depth,amount] of [[0,-.5],[100,.5]]) {
    const initial={...initialView(),sex,camera:{position:[0,1,3],target:[0,1,0]},markers:'hidden'};
    const s={...viewReducer(initial,{type:'compare',name:'bundle',ids:['x']}),dissection:depth};
    const n=viewReducer(s,{type:'dissection-step',amount});
    assert.equal(n.dissection,depth);assert.equal(n.displayMode,'dissection');
    assert.equal(n.selection,null);assert.equal(n.comparison,null);assert.equal(n.detail,null);assert.equal(n.isolated,false);
    for(const key of ['camera','markers','alpha','pointId','sex'])assert.deepEqual(n[key],s[key]);
    assert.equal(viewReducer(n,{type:'dissection-step',amount}),n);
    assert.equal(viewReducer(s,{type:'dissection-step',amount:0}),s);
  }
});
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
test("leaving an organ detail restores the prior half-percent peel, region and preferences", () => {
  for (const sex of ["male", "female"]) {
    let s = viewReducer(initialView("KI3"), { type: "sex", value: sex });
    s = viewReducer(s, { type: "anatomy-region", value: "lower-body" });
    s = viewReducer(s, { type: "dissection", value: 50.5 });
    s = viewReducer(s, { type: "markers", value: "hidden" });
    s = viewReducer(s, { type: "camera", value: { position: [0, 1, 2], target: [0, 1, 0] } });
    const before = s;
    const id = sex === "female" ? "CTF_stomach" : "BP4_FJ2631";
    const detail = { id: "stomach", name: "위", ids: [id], layers: { ...s.layers, skin: false, muscle: false, bone: false, organ: true } };
    s = viewReducer(s, { type: "detail", detail });
    assert.equal(s.dissection, 66); assert.equal(s.displayMode, "layers");
    assert.equal(s.detailReturn.dissection, 50.5);
    s = viewReducer(s, { type: "select", layer: "organ", selection: { kind: "structure", ids: [id], name: "위" } });
    assert.equal(s.detailReturn.dissection, 50.5);
    s = viewReducer(s, { type: "detail", detail: { ...detail, id: "abdomen", name: "복부" } });
    assert.equal(s.detailReturn.dissection, 50.5);
    const restored = viewReducer(s, { type: "detail-close" });
    for (const key of ["anatomyRegion", "stage", "dissection", "displayMode", "layers", "cutaway", "selectionTarget", "camera", "markers", "alpha", "pointId", "sex"])
      assert.deepEqual(restored[key], before[key], `${sex}/${key}`);
    assert.equal(restored.detail, null); assert.equal(restored.detailReturn, null); assert.equal(restored.selection, null);
    assert.deepEqual(viewReducer(s, { type: "clear-selection" }), restored);
    for (const action of [{ type: "stage", index: 1 }, { type: "dissection", value: 35.5 }, { type: "layers", layers: before.layers }, { type: "sex", value: sex === "male" ? "female" : "male" }]) {
      const next = viewReducer(s, action);
      assert.equal(next.detail, null); assert.equal(next.detailReturn, null);
    }
    const filter = viewReducer(s, { type: "region-filter", value: "다리·발" });
    assert.equal(filter.detail, null); assert.equal(filter.detailReturn, null);
    assert.equal(filter.dissection, 50.5); assert.deepEqual(filter.layers, before.layers);
    const filtered = viewReducer(s, { type: "show-filtered" });
    assert.equal(filtered.detail, null); assert.equal(filtered.dissection, 50.5);
    for (const pointId of ["KI3", "ST36"]) {
      const point = viewReducer(s, { type: "point", id: pointId });
      assert.equal(point.detail, null); assert.equal(point.detailReturn, null);
      assert.equal(point.pointId, pointId); assert.equal(point.dissection, 50.5);
      assert.deepEqual(point.layers, before.layers);
    }
    for (const region of ["whole", "head"]) {
      const next = viewReducer(s, { type: "anatomy-region", value: region });
      assert.equal(next.detail, null); assert.equal(next.detailReturn, null);
      assert.equal(next.anatomyRegion, region); assert.equal(next.dissection, 50.5);
      assert.deepEqual(next.layers, before.layers);
    }
  }
});
test("female airway detail preserves all 36 source members and restores the prior peel after a child selection", () => {
  const catalog = femaleAirway.ids.map(id => ({ id, layer: "organ", sex: "female" }));
  let before = viewReducer(initialView(), { type: "sex", value: "female" });
  before = viewReducer(before, { type: "dissection", value: 50.5 });
  before = viewReducer(before, { type: "markers", value: "hidden" });
  before = viewReducer(before, { type: "camera", value: { position: [0, 1.2, 2], target: [0, 1.2, 0] } });
  const detail = { id: femaleAirway.id, name: femaleAirway.name, ids: femaleAirway.ids,
    layers: { skin: false, muscle: false, bone: false, organ: true, vessel: false, lymph: false, nerve: false } };
  let inside = viewReducer(before, { type: "detail", detail });
  assert.deepEqual(inside.selection.ids, femaleAirway.ids);
  assert.equal(inside.layers.organ, true);
  inside = viewReducer(inside, { type: "select", layer: "organ",
    selection: { kind: "structure", ids: ["HRAF0808"], name: "Right anterior basal bronchus" } });
  inside = restoreView(JSON.stringify(inside), [], catalog);
  assert.deepEqual(inside.selection.ids, ["HRAF0808"]);
  assert.deepEqual(inside.detail.ids, femaleAirway.ids);
  const returned = viewReducer(inside, { type: "detail-close" });
  for (const key of ["anatomyRegion", "stage", "dissection", "displayMode", "layers", "camera", "markers", "sex"])
    assert.deepEqual(returned[key], before[key], key);
  assert.equal(returned.detail, null);
  assert.equal(viewReducer(inside, { type: "sex", value: "male" }).selection, null);
});
test("direct organ detail remembers the originating camera through framing, reload and point navigation", () => {
  const overviewPose = { position: [0.4, 1.2, 2.1], target: [0.1, 1.1, 0] };
  const detailPose = { position: [0.2, 1.4, 0.5], target: [0, 1.4, 0] };
  const detail = { id: "brain", name: "뇌", ids: ["HRAF0070"],
    layers: { skin: false, muscle: false, bone: false, organ: false, vessel: false, lymph: false, nerve: true } };
  let before = viewReducer(initialView(), { type: "sex", value: "female" });
  before = viewReducer(before, { type: "dissection", value: 50.5 });
  before = viewReducer(before, { type: "camera", value: overviewPose });
  let inside = viewReducer(before, { type: "detail", detail });
  assert.deepEqual(inside.detailReturn.camera, overviewPose);
  inside = viewReducer(inside, { type: "camera", value: detailPose });
  inside = restoreView(JSON.stringify(inside), ["KI3"], [{ id: "HRAF0070", layer: "nerve", sex: "female" }]);
  assert.deepEqual(viewReducer(inside, { type: "detail-close" }), before);
  assert.deepEqual(viewReducer(inside, { type: "point", id: "KI3" }).camera, overviewPose);
});
test("clearing an ordinary structure selected during peeling restores the exact prior scene", () => {
  for (const sex of ["male", "female"]) {
    let s = viewReducer(initialView("KI3"), { type: "sex", value: sex });
    s = viewReducer(s, { type: "anatomy-region", value: "lower-body" });
    s = viewReducer(s, { type: "dissection", value: 50.5 });
    s = viewReducer(s, { type: "markers", value: "hidden" });
    s = viewReducer(s, { type: "camera", value: { position: [0, 1, 2], target: [0, 1, 0] } });
    const before = s;
    const id = sex === "male" ? "FMA7148" : "HRAF0435";
    s = viewReducer(s, { type: "select", layer: "organ", selection: { kind: "structure", ids: [id], name: "장기" } });
    assert.equal(s.displayMode, "layers"); assert.equal(s.dissection, 66); assert.equal(s.layers.organ, true);
    s = viewReducer(s, { type: "clear-selection" });
    for (const key of ["anatomyRegion", "stage", "dissection", "displayMode", "layers", "cutaway", "selectionTarget", "camera", "markers", "alpha", "pointId", "sex"])
      assert.deepEqual(s[key], before[key], `${sex}/${key}`);
    assert.equal(s.selection, null);
  }
});
test("ordinary peel selection return survives another selection, detail and saved-session validation", () => {
  const catalog = [
    { id: "FMA7148", layer: "organ", sex: "male" },
    { id: "ZA_nerve_1", layer: "nerve", sex: "male" },
  ];
  const before = viewReducer(initialView(), { type: "dissection", value: 50.5 });
  let selected = viewReducer(before, { type: "select", layer: "organ", selection: { kind: "structure", ids: ["FMA7148"], name: "위" } });
  assert.equal(selected.selectionReturn.dissection, 50.5);
  selected = viewReducer(selected, { type: "select", layer: "nerve", selection: { kind: "structure", ids: ["ZA_nerve_1"], name: "신경" } });
  assert.equal(selected.selectionReturn.dissection, 50.5);
  selected = restoreView(JSON.stringify(selected), [], catalog);
  assert.equal(selected.selectionReturn.dissection, 50.5);
  assert.deepEqual(viewReducer(selected, { type: "clear-selection" }), before);
  const detail = { id: "nerve", name: "신경 상세", ids: ["ZA_nerve_1"], layers: { ...before.layers, bone: false, nerve: true } };
  const inside = viewReducer(selected, { type: "detail", detail });
  assert.equal(inside.selectionReturn, null);
  assert.equal(inside.detailReturn.dissection, 50.5);
  assert.deepEqual(viewReducer(inside, { type: "detail-close" }), before);
  assert.equal(viewReducer(selected, { type: "stage", index: 2 }).selectionReturn, null);
  assert.equal(viewReducer(selected, { type: "dissection", value: 51 }).selectionReturn, null);
  assert.equal(viewReducer(selected, { type: "sex", value: "female" }).selectionReturn, null);
  const invalid = { ...selected, selectionReturn: { ...selected.selectionReturn, layers: { ...selected.selectionReturn.layers, skin: "yes" } } };
  assert.deepEqual(restoreView(JSON.stringify(invalid), [], catalog), initialView());
  const invalidPose = { ...selected, selectionReturn: { ...selected.selectionReturn, camera: { position: [0, 0, 0], target: [0, 0, 0] } } };
  assert.deepEqual(restoreView(JSON.stringify(invalidPose), [], catalog), initialView());
});
test("leaving an ordinary peel selection for a point or region does not strand its single layer", () => {
  for (const sex of ["male", "female"]) {
    let before = viewReducer(initialView("KI3"), { type: "sex", value: sex });
    before = viewReducer(before, { type: "dissection", value: 50.5 });
    before = viewReducer(before, { type: "camera", value: { position: [0, 1, 2], target: [0, 1, 0] } });
    const id = sex === "male" ? "FMA7148" : "HRAF0435";
    const selected = viewReducer(before, { type: "select", layer: "organ", selection: { kind: "structure", ids: [id], name: "장기" } });
    for (const action of [
      { type: "point", id: "ST36" },
      { type: "anatomy-region", value: "head" },
      { type: "region-filter", value: "머리·목" },
      { type: "show-filtered" },
    ]) {
      const next = viewReducer(selected, action);
      for (const key of ["stage", "dissection", "displayMode", "layers", "cutaway", "selectionTarget", "camera"])
        assert.deepEqual(next[key], before[key], `${sex}/${action.type}/${key}`);
      assert.equal(next.selection, null);
      assert.equal(next.selectionReturn, null);
    }
  }
});
test("explicit same-point reselection exits an organ while wiki route sync preserves the prior view", () => {
  for (const sex of ["male", "female"]) {
    let before = viewReducer(initialView("ST36"), { type: "sex", value: sex });
    before = viewReducer(before, { type: "dissection", value: 50.5 });
    before = viewReducer(before, { type: "camera", value: { position: [0, 1, 2], target: [0, 1, 0] } });
    const id = sex === "male" ? "FMA7148" : "HRAF0435";
    const selected = viewReducer(before, { type: "select", layer: "organ", selection: { kind: "structure", ids: [id], name: "장기" } });
    assert.equal(viewReducer(selected, { type: "route-point", id: "ST36" }), selected, `${sex}/wiki return`);
    assert.equal(viewReducer(before, { type: "point", id: "ST36" }), before, `${sex}/plain reselect`);
    const returned = viewReducer(selected, { type: "point", id: "ST36" });
    assert.deepEqual(returned, before, `${sex}/explicit reselect`);
    assert.equal(viewReducer(selected, { type: "route-point", id: "KI3" }).pointId, "KI3");
  }
});
test("old detail sessions without a return snapshot exit to a safe whole-body view", () => {
  const detail = { id: "heart", name: "심장", ids: ["BP4_FJ2631"], layers: { ...initialView().layers, skin: false, organ: true } };
  let s = viewReducer(initialView(), { type: "detail", detail });
  const catalog = [{ id: "BP4_FJ2631", layer: "organ", sex: "male" }];
  assert.equal(restoreView(JSON.stringify(s), [], catalog).detailReturn.dissection, 0);
  const bad = { ...s, detailReturn: { ...s.detailReturn, layers: { ...s.detailReturn.layers, skin: "yes" } } };
  assert.deepEqual(restoreView(JSON.stringify(bad), [], catalog), initialView());
  const legacy = { ...s }; delete legacy.detailReturn;
  s = restoreView(JSON.stringify(legacy), [], catalog);
  assert.equal(s.detailReturn, null);
  const closed = viewReducer(s, { type: "detail-close" });
  assert.equal(closed.detail, null); assert.equal(closed.displayMode, "dissection");
  assert.equal(closed.layers.skin, true); assert.equal(closed.dissection, 0);
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
test("explicit deselection ends comparisons without changing viewing preferences; old orphaned highlights are repaired", () => {
  for (const sex of ['male', 'female']) {
    const base = {...initialView('KI3'),sex,camera:{position:[0,1,3],target:[0,1,0]},markers:'hidden'};
    const compared = viewReducer(base,{type:'compare',name:'콩팥',ids:['kidney-left','kidney-right']});
    const assets = ['kidney-left','kidney-right'].map(id=>({id,layer:'organ',sex}));
    for (const isolated of [false,true]) {
      const before = {...compared,isolated};
      const next = viewReducer(before,{type:'clear-selection'});
      assert.deepEqual(next,{...before,selection:null,detail:null,comparison:null,isolated:false});
      assert.deepEqual(restoreView(JSON.stringify(next),['KI3'],assets),next);
      const legacy = {...next,comparison:compared.comparison};
      assert.deepEqual(restoreView(JSON.stringify(legacy),['KI3'],assets),next);
    }
    const child=viewReducer(compared,{type:'select',selection:{kind:'structure',ids:['kidney-left'],name:'왼 콩팥'}});
    assert.deepEqual(restoreView(JSON.stringify(child),['KI3'],assets).comparison,compared.comparison);
    assert.equal(viewReducer(child,{type:'clear-selection'}).comparison,null);
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
