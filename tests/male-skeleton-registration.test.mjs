import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";

const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const sha256 = (path) => createHash("sha256").update(fs.readFileSync(path)).digest("hex");
const registration = read("data/catalog/male-registration.json");
const fit = read("docs/anatomy-alignment/male-skeleton-registration.json");
const hands = read("docs/anatomy-alignment/male-hand-bones.json");
const showThrough = read("docs/anatomy-alignment/male-show-through.json");
const body = read("docs/anatomy-alignment/male-show-through-body.json");
const pinned = (report) => { for (const { path, sha256: hash } of report.files) assert.equal(sha256(path), hash, path); };

test("the male registration is the skeleton fit and keeps the earlier neural-centre fit on record", () => {
  assert.match(registration.method, /Z-Anatomy male bone onto the BodyParts3D base bones/);
  assert.equal(registration.scale, fit.fit.scale);
  assert.deepEqual(registration.translation, fit.fit.translation);
  assert.equal(registration.skeleton.sha256, fit.skeletonSha256);
  assert.equal(registration.skeleton.bones, 335);
  assert.equal(registration.previous.scale, 0.9599031746712589);
  assert.match(registration.previous.method, /four named neural centers/);
  // Neural centres and vessels are held out, not fitted.
  assert.equal(registration.neural.length, 4);
  assert.equal(registration.holdout.length, 39);
  for (const row of registration.neural) assert.ok(row.afterMm < 4, row.name);
  pinned(fit);
});

test("hand bones of the two sources coincide under the new fit and sat ~8 mm apart before", () => {
  pinned(hands);
  assert.deepEqual(hands.current.registration, { scale: registration.scale, translation: registration.translation });
  assert.equal(hands.current.bones, 54);
  assert.ok(hands.current.rigidShiftMm.max < 0.5, `current max ${hands.current.rigidShiftMm.max}`);
  assert.ok(hands.previous.rigidShiftMm.median > 7, `previous median ${hands.previous.rigidShiftMm.median}`);
  // The pairs are the same bone geometry: a rigid fit leaves well under 1 mm.
  assert.ok(hands.current.fittedSurfaceP95MmMax < 1);
  for (const region of ["hand", "foot", "head", "trunk and arm", "leg"])
    assert.ok(fit.summary[region].medianOfBoneMediansAfterMm <= fit.summary[region].medianOfBoneMediansBeforeMm, region);
});

test("supplement tissue in front of the hand and foot skin falls by at least 90%", () => {
  pinned(showThrough);
  pinned(body);
  for (const report of [showThrough, body]) {
    assert.deepEqual(Object.keys(report.states), ["final", "registrationOnly", "original"]);
    assert.deepEqual(report.states.final.registration, { scale: registration.scale, translation: registration.translation });
    assert.deepEqual(report.states.original.registration, { scale: registration.previous.scale, translation: registration.previous.translation });
    for (const [region, final] of Object.entries(report.states.final.regions)) {
      const original = report.states.original.regions[region], registered = report.states.registrationOnly.regions[region];
      assert.ok(registered.supplementRays < original.supplementRays, region);
      assert.ok(final.supplementRays <= original.supplementRays * 0.1, `${region}: ${final.supplementRays} vs ${original.supplementRays}`);
    }
  }
});

test("the deployed skin keeps finer hands and feet within the model budget", () => {
  const skin = read("public/models/manifest.json").assets.find((a) => a.id === "FMA7163");
  assert.equal(skin.detail.regions, "hands and feet");
  assert.equal(skin.detail.boxesMm.length, 4);
  assert.equal(skin.detail.targetErrorMm, 0.4);
  assert.ok(skin.detail.errorMm <= 0.4);
  assert.equal(skin.triangles, read("docs/anatomy-alignment/male-skin-source-topology.json").simplified.deployedPrune.triangles);
  assert.equal(showThrough.skinTriangles, skin.triangles);
});
