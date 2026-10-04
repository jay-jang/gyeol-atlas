import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SKIN_COLOR, SURFACE_TONES, isSupplementEyePart } from "../src/anatomy-rendering.ts";

const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const manifest = new Map(read("public/models/manifest.json").assets.map((a) => [a.id, a]));
const full = read("data/full-system-structures.json");

const female = new Map(read("public/models/female/atlas-female.json").parts.map((p) => [p.id, p]));
test("face surface tones name real BodyParts3D meshes of the face", () => {
  const names = Object.keys(SURFACE_TONES).filter((id) => id.startsWith("FMA")).map((id) => manifest.get(id)?.name);
  assert.deepEqual(names, ["ear", "labial part of mouth, nsn", "eyeball", "orbital part of right orbicularis oculi", "orbital part of left orbicularis oculi", "set of nasal cartilages"]);
  for (const [id, tone] of Object.entries(SURFACE_TONES)) assert.equal(tone, id === "FMA12513" ? "#e2dbcf" : SKIN_COLOR, id);
});

test("female surface tones are the source-crossing fibulae and the borrowed nose cartilages", () => {
  const ids = Object.keys(SURFACE_TONES).filter((id) => !id.startsWith("FMA"));
  assert.deepEqual(ids.map((id) => female.get(id)?.name), ["Fibula (right)", "Fibula (left)", "Right major alar cartilage", "Left major alar cartilage"]);
});

test("only Z-Anatomy eyeball parts count as the duplicate eye", () => {
  const eye = full.filter((s) => isSupplementEyePart(s.name));
  assert.equal(eye.length, 20);
  assert.ok(eye.every((s) => s.layer === "nerve" && /\((left|right)\)$/.test(s.name)));
  for (const kept of ["Choroid plexus (left)", "Optic nerve (left)", "Central retinal artery (left)"]) assert.equal(isSupplementEyePart(kept), false, kept);
});
