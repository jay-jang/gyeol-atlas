import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { initialView, viewReducer, restoreView } from "../src/view-state.ts";
import { isGenitalStructure, COVER_REGIONS } from "../src/modesty.ts";

const points = JSON.parse(fs.readFileSync("data/points.json"));
const assets = JSON.parse(fs.readFileSync("scripts/model-inputs.json")).assets;
const restore = (raw) => restoreView(raw, points.map((p) => p.id), assets);

test("the genital cover is a viewer preference that survives sex, peel, region and reset", () => {
  let s = initialView();
  assert.equal(s.modesty, false);
  s = viewReducer(s, { type: "modesty", value: true });
  assert.equal(s.modesty, true);
  assert.equal(viewReducer(s, { type: "modesty", value: true }), s);
  for (const action of [{ type: "sex", value: "female" }, { type: "dissection", value: 40 }, { type: "anatomy-region", value: "pelvis" }, { type: "reset" }]) {
    s = viewReducer(s, action);
    assert.equal(s.modesty, true, action.type);
  }
  assert.equal(viewReducer(s, { type: "modesty", value: false }).modesty, false);
});

test("saved sessions keep the cover; older sessions start without it and bad values reset", () => {
  const on = { ...initialView(), modesty: true };
  assert.equal(restore(JSON.stringify(on)).modesty, true);
  const { modesty, ...old } = initialView();
  assert.equal(restore(JSON.stringify(old)).modesty, false);
  assert.deepEqual(restore(JSON.stringify({ ...on, modesty: "yes", markers: "hidden" })), initialView());
});

test("only external genital structures are hidden", () => {
  const male = Object.fromEntries(assets.map((a) => [a.name, a.id]));
  for (const name of ["glans penis", "corpus cavernosum of penis", "right testis", "left epididymis", "right deferent duct", "urethra"]) assert.ok(isGenitalStructure(male[name], name), name);
  for (const name of ["prostate", "urinary bladder", "right seminal vesicle", "rectum", "right gluteus maximus"]) assert.equal(isGenitalStructure(male[name] || name, name), false, name);
  assert.ok(isGenitalStructure("HRAF0406", "Vagina"));
  assert.equal(isGenitalStructure("HRAF0435", "Body of uterus"), false);
  for (const name of ["Dorsal artery of penis (left)", "Left testicular vein"]) assert.ok(isGenitalStructure("ZA_x", name), name);
  for (const name of ["Internal pudendal artery (left)", "Pudendal nerve (left)", "Obturator nerve (left)"]) assert.equal(isGenitalStructure("ZA_x", name), false, name);
});

test("each cover encloses its body's external genitalia", () => {
  const inside = (p, r) => p.reduce((sum, v, i) => sum + ((v - r.center[i]) / r.radii[i]) ** 2, 0) <= 1;
  // Bounding corners measured from the source meshes (male glans/corpora/testes, female vagina inlet).
  for (const p of [[0, 0.71, 0.0], [0, 0.79, 0.09], [0.025, 0.73, 0.02], [-0.025, 0.73, 0.02]]) assert.ok(inside(p, COVER_REGIONS.male), p.join());
  for (const p of [[0, 0.72, -0.06], [0, 0.78, 0.0], [0.02, 0.75, -0.03]]) assert.ok(inside(p, COVER_REGIONS.female), p.join());
});
