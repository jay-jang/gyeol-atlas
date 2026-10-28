import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { initialView, viewReducer, restoreView } from "../src/view-state.ts";
import { isGenitalStructure, hidesGenital } from "../src/modesty.ts";

const points = JSON.parse(fs.readFileSync("data/points.json"));
const assets = JSON.parse(fs.readFileSync("scripts/model-inputs.json")).assets;
const restore = (raw) => restoreView(raw, points.map((p) => p.id), assets);

test("the genitals start hidden and stay a viewer preference across sex, peel, region and reset", () => {
  let s = initialView();
  assert.equal(s.modesty, true);
  assert.equal(viewReducer(s, { type: "modesty", value: true }), s);
  s = viewReducer(s, { type: "modesty", value: false });
  assert.equal(s.modesty, false);
  for (const action of [{ type: "sex", value: "female" }, { type: "dissection", value: 40 }, { type: "anatomy-region", value: "pelvis" }, { type: "reset" }]) {
    s = viewReducer(s, action);
    assert.equal(s.modesty, false, action.type);
  }
  assert.equal(viewReducer(s, { type: "modesty", value: true }).modesty, true);
});

test("sessions saved while the genitals were shown by default start hidden; a later choice is kept", () => {
  const shown = { ...initialView(), modesty: false };
  assert.equal(restore(JSON.stringify(shown)).modesty, false);
  const { modestyVersion, ...old } = shown;
  assert.equal(restore(JSON.stringify(old)).modesty, true);
  const { modesty, modestyVersion: _, ...older } = initialView();
  assert.equal(restore(JSON.stringify(older)).modesty, true);
  assert.equal(restore(JSON.stringify({ ...old, modesty: true })).modesty, true);
  assert.deepEqual(restore(JSON.stringify({ ...shown, modesty: "yes", markers: "hidden" })), initialView());
});

test("only external genital structures and the vessels and nerve that follow them out are hidden", () => {
  const male = Object.fromEntries(assets.map((a) => [a.name, a.id]));
  for (const name of ["glans penis", "corpus cavernosum of penis", "right testis", "left epididymis", "right deferent duct", "urethra"]) assert.ok(isGenitalStructure(male[name], name), name);
  for (const name of ["prostate", "urinary bladder", "right seminal vesicle", "rectum", "right gluteus maximus"]) assert.equal(isGenitalStructure(male[name] || name, name), false, name);
  assert.ok(isGenitalStructure("HRAF0406", "Vagina"));
  assert.equal(isGenitalStructure("HRAF0435", "Body of uterus"), false);
  for (const name of ["Dorsal artery of penis (left)", "Left testicular vein", "External pudendal veins (right)", "Superficial external pudendal artery (left)", "Deep external pudendal artery (right)", "Genital branch of genitofemoral nerve (left)"]) assert.ok(isGenitalStructure("ZA_x", name), name);
  for (const name of ["Internal pudendal artery (left)", "Internal pudendal vein (right)", "Pudendal nerve (left)", "Obturator nerve (left)", "Femoral branch of genitofemoral nerve (left)", "Genitofemoral nerve (right)", "Superior labial artery (left)", "labial part of mouth, nsn", "Nasolabial node (right)"]) assert.equal(isGenitalStructure("ZA_x", name), false, name);
});

test("the hidden course list is the one the female transport leaves out", () => {
  const transport = JSON.parse(fs.readFileSync("data/catalog/female-transport.json", "utf8"));
  const course = transport.skipped.filter((s) => s.reason === "male external genital course");
  assert.equal(course.length, 8);
  for (const s of course) assert.ok(isGenitalStructure(s.id, s.name), s.name);
  const structures = JSON.parse(fs.readFileSync("data/full-system-structures.json", "utf8"));
  const list = Array.isArray(structures) ? structures : Object.values(structures).flat();
  const hidden = list.filter((s) => s?.name && isGenitalStructure(s.id, s.name) && !/penis|testicular/i.test(s.name)).map((s) => s.id).sort();
  assert.deepEqual(hidden, course.map((s) => s.id).sort());
});

test("a chosen structure or the organ detail that holds it is shown while hidden", () => {
  assert.equal(hidesGenital(true, "FMA7211", "right testis", false), true);
  assert.equal(hidesGenital(true, "FMA7211", "right testis", true), false);
  assert.equal(hidesGenital(false, "FMA7211", "right testis", false), false);
  assert.equal(hidesGenital(true, "FMA9600", "prostate", false), false);
});
