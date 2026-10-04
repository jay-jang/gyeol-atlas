import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { musclePeelRanks } from "../src/muscle-peel.ts";
import { musclePeelRelations } from "../src/muscle-peel-relations.ts";

const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const catalogue = read("data/female-transport-structures.json");
const manifest = read("public/models/female-transport/manifest.json");
const fit = read("data/catalog/female-transport-fit.json");
const transport = read("data/catalog/female-transport.json");
const female = read("public/models/female/atlas-female.json");
const male = new Map([
  ...read("data/full-system-structures.json").map((s) => [s.id, s]),
  ...read("data/connective-structures.json").map((s) => [s.id, s]),
  ...read("data/sex-lymph-structures.json").filter((s) => s.sex === "male").map((s) => [s.id, s]),
  ...read("scripts/model-inputs.json").assets.map((a) => [a.id, a]),
]);

const bySystemFile = Object.fromEntries(manifest.files.map((f) => [f.system, f.path]));
test("every transported row names one male source structure in a published system", () => {
  assert.equal(catalogue.length, 1789);
  assert.equal(new Set(catalogue.map((s) => s.transport)).size, catalogue.length);
  for (const row of catalogue) {
    assert.ok(male.get(row.transport), row.transport);
    assert.ok(Object.keys(bySystemFile).includes(row.system), row.system);
    assert.deepEqual(Object.keys(row).filter((k) => !["transport", "system", "peelScore", "surfaceTone"].includes(k)), [], row.transport);
  }
  const bySystem = Object.fromEntries(manifest.files.map((f) => [f.system, f.structures]));
  assert.deepEqual(bySystem, { nerve: 263, vessel: 527, muscle: 435, ligament: 342, tendon: 58, lymph: 137, bone: 15, organ: 12 });
  for (const [system, count] of Object.entries(bySystem)) assert.equal(catalogue.filter((r) => r.system === system).length, count, system);
  // Skin-toned rows are those within 1 mm of the male skin in the source.
  assert.equal(catalogue.filter((r) => r.surfaceTone).length, Object.values(transport.systems).reduce((a, s) => a + s.skinContact, 0));
});

test("male-only structures and those the female sources already model are not carried", () => {
  const names = catalogue.map((s) => male.get(s.transport).name);
  assert.ok(!names.some((n) => /penis|penile|scrot|testic|testis|prostat|deferen|epididym|glans|cremaster/i.test(n)));
  for (const kept of ["Abdominal aorta", "Optic nerve (II) (left)", "Right coronary artery", "Spleen", "right rectus femoris", "Anterior cruciate ligament (left)", "Cornea (left)", "Superficial external pudendal artery (left)"])
    assert.ok(!names.includes(kept), kept);
  assert.ok(!catalogue.some((s) => male.get(s.transport).hierarchy?.[0] === "중추신경계" && male.get(s.transport).name !== "Cauda equina"));
  for (const carried of ["Cauda equina", "Sural nerve (left)", "Great saphenous vein (left)", "Lacrimal gland (left)", "right pectoralis minor", "xiphoid process"])
    assert.ok(names.includes(carried), carried);
  const reasons = new Set(transport.skipped.map((s) => s.reason));
  assert.deepEqual([...reasons].sort(), ["female brain/spinal cord sources", "female eye source", "female heart source", "female knee source", "female optic nerve source", "female spleen/thymus/tonsil source", "female vessel source", "male external genital course", "male-only"]);
  assert.equal(transport.skipped.length, 398);
  // The HRA left carotid, subclavian and pulmonary arteries are partial: the whole male vessels are carried.
  for (const whole of ["Left common carotid artery", "Left subclavian artery", "Left pulmonary artery", "stomach", "esophagus", "pituitary gland"]) assert.ok(names.includes(whole), whole);
});

test("the published transport files are the ones the manifest names", () => {
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(`public/${file.path}`);
    assert.equal(bytes.length, file.bytes, file.path);
    assert.equal(sha(bytes), file.sha256, file.path);
  }
  const raw = gunzipSync(fs.readFileSync(`public/${manifest.placement.url}`));
  assert.equal(raw.length, manifest.placement.bytes);
  assert.equal(sha(raw), manifest.placement.sha256);
  assert.equal(manifest.field.sha256, fit.field.sha256);
  // Every borrowed bone gets a placement with its own vertex count.
  const borrowed = female.parts.filter((p) => p.system === "borrowed");
  const placed = new Map(manifest.placement.parts.map((p) => [p.id, p]));
  assert.equal(manifest.placement.parts.filter((p) => p.kind === "borrowed bone").length, borrowed.length);
  for (const part of borrowed) assert.equal(placed.get(part.id)?.vertexCount, part.vertexCount, part.id);
  // The reference brain (282 Allen parts; the VHF optic chiasm stays) is placed too.
  // Laterality-bound brain parts draw their partner's geometry (female-brain-bindings.json).
  const partner = new Map(read("data/catalog/female-brain-bindings.json").records.map((r) => [r.id, r.partnerId]));
  const byId = new Map(female.parts.map((p) => [p.id, p]));
  const brain = female.parts.filter((p) => p.system === "brain" && p.name !== "Optic chiasm");
  assert.equal(manifest.placement.parts.filter((p) => p.kind === "reference brain").length, brain.length);
  for (const part of brain) assert.equal(placed.get(part.id)?.vertexCount, byId.get(partner.get(part.id) || part.id).vertexCount, part.id);
});

test("the registration field fits the female skin and bones without folding", () => {
  const skin = fit.skin.at(-1);
  assert.equal(skin.stage, "skin layer");
  assert.ok(skin.heldOutMedianMm < 2 && skin.heldOutP90Mm < 3 && skin.heldOutOutside < 0.01, JSON.stringify(skin));
  assert.ok(fit.heldOut.native.medianOfMediansMm < 2.5 && fit.heldOut.native.maxMm < 5, JSON.stringify(fit.heldOut.native));
  assert.ok(fit.folding.folded / fit.folding.samples < 0.0002, JSON.stringify(fit.folding));
  assert.ok(fit.folding.secondDifferenceUmMax < 500);
  // Misplaced borrowed bones are not guides; the borrowed thorax and girdle are re-derived.
  assert.ok(fit.guidesExcluded["borrowed thorax or shoulder girdle"].includes("Left clavicle"));
  assert.ok(fit.guidesExcluded["crosses the female skin"].includes("Occipital bone"));
});

test("carried vessels join the female trunks they branch from", () => {
  const j = read("docs/anatomy-alignment/female-vessel-junctions.json");
  assert.ok(j.after.medianMm < j.before.medianMm / 2 && j.after.p90Mm < j.before.p90Mm, JSON.stringify({ before: j.before, after: j.after }));
});

test("carried structures stay under the female skin and borrowed bones regain their joints", () => {
  const limits = { nerve: 0, vessel: 200, muscle: 10, ligament: 0, tendon: 0, lymph: 0, bone: 0 };
  for (const [system, limit] of Object.entries(limits)) assert.ok(transport.systems[system].outsideFemaleSkin <= limit, `${system} ${transport.systems[system].outsideFemaleSkin}`);
  const triangles = Object.values(transport.systems).reduce((a, s) => a + s.triangles, 0);
  const inverted = Object.values(transport.systems).reduce((a, s) => a + s.invertedTriangles, 0);
  assert.ok(inverted / triangles < 0.0002, `${inverted}/${triangles}`);
  const { before, after } = transport.borrowed;
  assert.ok(before.leftClavicleMedialToSternumMm > 20 && after.leftClavicleMedialToSternumMm < 2);
  assert.ok(before.rightClavicleMedialToSternumMm > 20 && after.rightClavicleMedialToSternumMm < 2);
  assert.ok(after.costalCartilage1to7ToSternumMm.max < 2);
  assert.ok(after.ribToVertebraMm.max < 2);
  // Only the two alar cartilages (the nose's own surface, skin-toned) reach outside.
  assert.ok(before.bonesOutsideSkin === 21 && after.bonesOutsideSkin <= 2 && after.verticesOutsideSkin < 100);
});

test("female show-through falls by more than 95% and the rest is mostly skin-toned", () => {
  const before = read("docs/anatomy-alignment/female-show-through-before.json");
  const after = read("docs/anatomy-alignment/female-show-through.json");
  assert.equal(before.rays, after.rays);
  assert.ok(after.showThroughRays < before.showThroughRays * 0.05, `${after.showThroughRays}/${before.showThroughRays}`);
  assert.ok(after.otherColourRays < 300, String(after.otherColourRays));
  // The reference brain fitted into the field's cranium crosses the skull less.
  const brain = read("docs/anatomy-alignment/female-brain-skull.json");
  assert.equal(brain.before.pairs, 55);
  assert.ok(brain.after.pairs < brain.before.pairs, `${brain.after.pairs}`);
  const placement = read("public/models/female-transport/manifest.json").placement.brain;
  assert.equal(placement.jacobian.folded, 0);
  assert.ok(placement.scalpDistanceMm.after.min > 5 && placement.fixedMaxMoveMm < 1, JSON.stringify(placement));
});

test("transported muscles peel in the male order", () => {
  const muscles = catalogue.filter((s) => s.peelScore !== undefined);
  assert.equal(muscles.length, 435);
  const ranks = musclePeelRanks(muscles.map((s) => ({ id: s.transport, score: s.peelScore })));
  for (const [outer, inner] of musclePeelRelations) {
    if (ranks.has(outer) && ranks.has(inner)) assert.ok(ranks.get(outer) < ranks.get(inner), `${outer} before ${inner}`);
  }
});
