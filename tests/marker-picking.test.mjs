import test from "node:test";
import assert from "node:assert/strict";
import { CLICK_SLOP_PX, MARKER_HIT_PX, hitRadius, isDragRelease, markersFirst, nearestMarker, releasedDragPress, trackPresses } from "../src/marker-picking.ts";
import { initialView, viewReducer } from "../src/view-state.ts";

// A camera at the origin looking down -Z; one pixel at unit depth is 1/1000.
const origin = { x: 0, y: 0, z: 0 }, ahead = { x: 0, y: 0, z: -1 }, unit = 1 / 1000;
const at = (px, py, depth) => ({ x: px * unit * depth, y: py * unit * depth, z: -depth });
const resting = () => MARKER_HIT_PX.fine;

test("a marker is hit within its screen radius, not only on its few drawn pixels", () => {
  assert.equal(nearestMarker(origin, ahead, [at(9, 0, 2)], [true], unit, resting)?.index, 0);
  assert.equal(nearestMarker(origin, ahead, [at(MARKER_HIT_PX.fine + 1, 0, 2)], [true], unit, resting), null);
  // The radius is in screen pixels, so it does not shrink with distance.
  assert.equal(nearestMarker(origin, ahead, [at(9, 0, 6)], [true], unit, resting)?.index, 0);
  // Back-facing (not drawn) markers and points behind the camera are never hit.
  assert.equal(nearestMarker(origin, ahead, [at(0, 0, 2)], [false], unit, resting), null);
  assert.equal(nearestMarker(origin, ahead, [{ x: 0, y: 0, z: 2 }], [true], unit, resting), null);
});

test("the marker nearest the pointer on screen wins; coincident ones go to the front", () => {
  const near = at(3, 0, 3), front = at(8, 0, 1);
  assert.equal(nearestMarker(origin, ahead, [front, near], [true, true], unit, resting)?.index, 1);
  const behind = at(2, 0, 3), before = at(2.2, 0, 1);
  assert.equal(nearestMarker(origin, ahead, [behind, before], [true, true], unit, resting)?.index, 1);
});

test("a hovered marker keeps a larger target; touch starts larger", () => {
  const drift = [at(16, 0, 2)];
  assert.equal(nearestMarker(origin, ahead, drift, [true], unit, (i) => hitRadius("mouse", false)), null);
  assert.equal(nearestMarker(origin, ahead, drift, [true], unit, (i) => hitRadius("mouse", true))?.index, 0);
  assert.equal(nearestMarker(origin, ahead, drift, [true], unit, (i) => hitRadius("touch", false))?.index, 0);
  assert.ok(MARKER_HIT_PX.hovered > MARKER_HIT_PX.fine);
});

test("a press that travelled is a camera drag, not a pick", () => {
  assert.equal(isDragRelease(0, "mouse"), false);
  assert.equal(isDragRelease(CLICK_SLOP_PX.fine, "mouse"), false);
  assert.equal(isDragRelease(CLICK_SLOP_PX.fine + 1, "mouse"), true);
  assert.equal(isDragRelease(CLICK_SLOP_PX.fine + 1, "touch"), false);
  assert.equal(isDragRelease(CLICK_SLOP_PX.coarse + 1, "touch"), true);
});

test("an orbit drag that returns near its start is still a drag", () => {
  const listeners = {};
  const stop = trackPresses({ addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: (type) => { delete listeners[type]; } });
  listeners.pointerdown({ clientX: 100, clientY: 100, pointerId: 1 });
  listeners.pointermove({ clientX: 160, clientY: 110, pointerId: 1, buttons: 1 });
  listeners.pointermove({ clientX: 102, clientY: 100, pointerId: 1, buttons: 1 });
  assert.equal(releasedDragPress(2, "mouse"), true);
  // A steady press (a little jitter) is a click again.
  listeners.pointerdown({ clientX: 50, clientY: 50, pointerId: 2 });
  listeners.pointermove({ clientX: 53, clientY: 51, pointerId: 2, buttons: 1 });
  listeners.pointermove({ clientX: 300, clientY: 300, pointerId: 2, buttons: 0 });
  assert.equal(releasedDragPress(3, "mouse"), false);
  stop();
  assert.deepEqual(Object.keys(listeners), []);
});

test("marker hits go before tissue in front of or behind them", () => {
  const skin = { object: { userData: {} }, distance: .5 }, marker = { object: { userData: { acupointMarkers: true } }, distance: .9 };
  assert.deepEqual(markersFirst([skin, marker]), [marker, skin]);
  assert.deepEqual(markersFirst([skin]), [skin]);
});

test("a part picked on the model is selected where it is", () => {
  let s = viewReducer(initialView("ST36"), { type: "dissection", value: 80 });
  s = viewReducer(s, { type: "camera", value: { position: [.2, 1.1, 2.4], target: [0, .9, 0] } });
  const picked = viewReducer(s, { type: "pick", selection: { kind: "structure", ids: ["FMA7204"], name: "kidney" } });
  assert.deepEqual(picked.selection.ids, ["FMA7204"]);
  for (const key of ["layers", "dissection", "displayMode", "stage", "anatomyRegion", "cutaway", "camera", "isolated", "markers", "connective", "selectionTarget"])
    assert.deepEqual(picked[key], s[key], key);
  assert.equal(picked.selectionReturn, null);
  // Clearing it leaves the same scene.
  const cleared = viewReducer(picked, { type: "clear-selection" });
  for (const key of ["layers", "dissection", "displayMode", "camera"]) assert.deepEqual(cleared[key], s[key], key);
  // The same part again changes nothing.
  assert.equal(viewReducer(picked, { type: "pick", selection: { kind: "structure", ids: ["FMA7204"], name: "kidney" } }), picked);
});

test("a pick keeps an earlier return view and replaces a comparison without moving systems", () => {
  const listed = viewReducer(initialView("ST36"), { type: "select", layer: "organ", selection: { kind: "structure", ids: ["FMA7204"], name: "kidney" } });
  assert.ok(listed.selectionReturn);
  const picked = viewReducer(listed, { type: "pick", selection: { kind: "structure", ids: ["FMA7205"], name: "kidney" } });
  assert.deepEqual(picked.selectionReturn, listed.selectionReturn);
  assert.deepEqual(picked.layers, listed.layers);
  assert.equal(viewReducer(picked, { type: "clear-selection" }).displayMode, "dissection");
  const compared = viewReducer(initialView("BL23"), { type: "compare", name: "신", ids: ["FMA7204", "FMA7205"] });
  // Clicking a one-organ comparison's own organ opens that structure in place.
  const single = viewReducer(initialView("CV12"), { type: "compare", name: "위", ids: ["FMA7148"] });
  const organ = viewReducer(single, { type: "pick", selection: { kind: "structure", ids: ["FMA7148"], name: "stomach" } });
  assert.equal(organ.selection.kind, "structure");assert.equal(organ.comparison, null);assert.deepEqual(organ.layers, single.layers);
  const fromComparison = viewReducer(compared, { type: "pick", selection: { kind: "structure", ids: ["FMA7204"], name: "kidney" } });
  assert.equal(fromComparison.comparison, null);
  assert.deepEqual(fromComparison.layers, compared.layers);
  assert.deepEqual(fromComparison.alpha, compared.alpha);
  // A part outside an open detail needs the full selection path.
  const detail = viewReducer(initialView("ST36"), { type: "detail", detail: { id: "d", name: "d", ids: ["A", "B"], layers: compared.layers } });
  assert.equal(viewReducer(detail, { type: "pick", selection: { kind: "structure", ids: ["C"], name: "c" } }), detail);
  assert.deepEqual(viewReducer(detail, { type: "pick", selection: { kind: "structure", ids: ["B"], name: "b" } }).detail, detail.detail);
});
