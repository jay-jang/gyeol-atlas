import test from "node:test";
import assert from "node:assert/strict";
import { dissectionLayerOpacity, dissectionLayers, musclePeelOpacity } from "../src/dissection.ts";
import { initialView, viewReducer } from "../src/view-state.ts";

test("all 201 peel positions are finite, nonempty, and use the same visibility rule", () => {
  for (let i = 0; i <= 200; i++) {
    const depth = i / 2;
    const state = viewReducer(initialView(), { type: "dissection", value: depth });
    assert.equal(state.dissection, depth);
    assert.equal(state.displayMode, "dissection");
    assert.deepEqual(state.layers, dissectionLayers(depth));
    assert.ok(Object.values(state.layers).some(Boolean));
    for (const layer of Object.keys(state.layers)) {
      const alpha = dissectionLayerOpacity(layer, depth);
      assert.ok(alpha >= 0 && alpha <= 1);
      assert.equal(state.layers[layer], alpha > 0);
    }
  }
});
test("manual combinations and selected organs are independent of peel depth", () => {
  let state = viewReducer(initialView(), { type: "dissection", value: 0 });
  state = viewReducer(state, { type: "layers", layers: { ...state.layers, nerve: true } });
  assert.equal(state.displayMode, "layers");
  assert.equal(dissectionLayerOpacity("nerve", state.dissection, false), 1);
  state = viewReducer(state, { type: "select", layer: "organ", selection: { kind: "structure", ids: ["FMA7148"], name: "위" } });
  assert.equal(state.displayMode, "layers");
  assert.equal(dissectionLayerOpacity("organ", state.dissection, false), 1);
  state = viewReducer(state, { type: "dissection", value: 66.5 });
  assert.equal(state.selection, null);
  assert.equal(state.displayMode, "dissection");
});
test("assigned peel ranks disappear in order and never reappear (not anatomical depth validation)", () => {
  assert.ok(musclePeelOpacity(40, 0) < musclePeelOpacity(40, 1));
  for (let rank = 0; rank <= 1; rank += .1) {
    let previous = 1;
    for (let depth = 0; depth <= 100; depth += .5) {
      const value = musclePeelOpacity(depth, rank);
      assert.ok(value <= previous);
      previous = value;
    }
  }
});
