import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

test("the point-card summary matches the shipped female markers", () => {
  const anchors = read("public/models/acupoint-anchors-female.json");
  const notes = read("data/female-acupoint-notes.json");
  assert.equal(notes.markers, anchors.length);
  const pointsWith = (test) => [...new Set(anchors.filter(test).map((m) => m.pointId))].sort();
  for (const [method, ids] of Object.entries(notes.methods)) assert.deepEqual(ids, pointsWith((m) => m.method === method), method);
  assert.deepEqual(notes.breastSurface, pointsWith((m) => m.breastSurface));
  assert.deepEqual(notes.facingException, pointsWith((m) => m.facingException));
  assert.deepEqual(notes.regionReference, pointsWith((m) => m.method === "field-carried"));
  // A rule-placed point has every marker placed by that rule (both sides).
  for (const ids of Object.values(notes.methods)) for (const id of ids)
    assert.equal(new Set(anchors.filter((m) => m.pointId === id).map((m) => m.method)).size, 1, id);
  assert.deepEqual(notes.knownBoundaryFailures, read("data/female-acupoint-rules.json").knownBoundaryFailures.map((f) => f.pair));
  // Every marker stays an unreviewed approximation.
  assert.ok(anchors.every((m) => m.mode === "female-approximation" && m.status === "approximate-unreviewed"));
});
