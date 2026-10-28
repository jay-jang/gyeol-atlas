import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { organPeelOpacity, dissectionLayerOpacity, peelLimit } from "../src/dissection.ts";
import { ORGAN_TONES, ORGAN_COLOR, organColor } from "../src/anatomy-rendering.ts";
import { sourceOrganRegion, anatomyRegionMatches } from "../src/anatomy-region.ts";
import { isGenitalStructure } from "../src/modesty.ts";
import { matchOrgans, isExactOrgan, rankStructures, isExactStructure } from "../src/search-rank.ts";
import { initialView, restoreView } from "../src/view-state.ts";

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const display = read("data/female-organ-display.json");
const groups = read("data/reproductive-groups.json");
const labels = read("data/female-reproductive-labels.json");
const female = read("data/female-atlas-structures.json");
const femaleById = new Map(female.map((s) => [s.id, s]));
const maleAssets = read("scripts/model-inputs.json").assets;
const concepts = new Map(read("public/models/female/atlas-female.json").concepts.map((c) => [c.id, c.elements]));
const el = (id) => { assert.ok(concepts.has(id), id); return concepts.get(id); };
const minus = (a, ...b) => a.filter((id) => !b.some((list) => list.includes(id)));
const union = (...lists) => [...new Set(lists.flat())];
const same = (a, b, message) => assert.deepEqual([...a].sort(), [...b].sort(), message);

test("every female display list is recomputed from the HRA concepts it names", () => {
  same(display.reproductiveTone.ids, union(el("HRA:uterus"), el("HRA:ovary"), el("HRA:fallopian_tube"), el("HRA:vagina")), "tone");
  assert.equal(display.reproductiveTone.ids.length, 22);
  same(display.peritonealFolds.ids, union(el("HRA:uterovesical_pouch"), el("HRA:broad_ligament")), "folds");
  same(display.gutFirst.ids, union(el("HRA:omentum"), el("HRA:epiploic_appendage"), minus(el("HRA:small_intestine"), el("HRA:duodenum")), minus(el("HRA:colon"), el("HRA:rectum"))), "gut");
  same(display.glandularBreast.ids, ["L", "R"].flatMap((side) => ["mammary_lobes", "main_lactiferous_ducts", "main_lactiferous_sinuses"].flatMap((c) => el(`HRA:${c}_${side}`))), "gland");
  for (const id of display.glandularBreast.surfaceTone) assert.ok(display.glandularBreast.ids.includes(id) && /lactiferous/.test(femaleById.get(id).name), id);
  for (const id of display.glandularBreast.ids) assert.equal(femaleById.get(id).layer, "skin", "the pinned catalogue keeps the source system");
  same(display.pelvicScope.ids, union(minus(el("HRA:reproductive_system"), el("HRA:placenta")), el("HRA:blood_vasculature_of_uterus")), "pelvis");
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
  same(byId["female-reproductive-peritoneum"].ids, minus(el("HRA:reproductive_system"), el("HRA:placenta")));
  same(byId["female-reproductive"].ids, minus(el("HRA:reproductive_system"), el("HRA:placenta"), el("HRA:broad_ligament"), el("HRA:uterovesical_pouch")));
  assert.equal(byId["female-reproductive"].ids.length, 32);
  same(byId["breast-gland"].ids, display.glandularBreast.ids);
  // Male: the genital and prostate meshes the female body never shows, and the
  // jejunum, ileum, colon, appendix and taeniae (duodenum and rectum stay).
  same(byId["male-reproductive"].ids, display.male.reproductiveTone);
  same(display.male.reproductiveTone, ["FMA18247", "FMA18256", "FMA18257", "FMA19235", "FMA19236", "FMA19387", "FMA19388", "FMA19617nsn", "FMA19618", "FMA7211", "FMA7212", "FMA9600"]);
  const maleOrgan = new Map(maleAssets.filter((a) => a.layer === "organ").map((a) => [a.id, a.name]));
  for (const id of [...display.male.reproductiveTone, ...display.male.gutFirst]) assert.ok(maleOrgan.has(id), id);
  assert.deepEqual(display.male.gutFirst.map((id) => maleOrgan.get(id)), ["jejunum", "ileum", "colon, nsn", "appendix", "mesocolic taenia", "omental taenia", "free taenia"]);
});

test("Korean labels keep each English source name and cover every unlabelled breast and reproductive part", () => {
  const rows = labels.labels;
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
  for (const row of rows) {
    const source = femaleById.get(row.id);
    assert.ok(source, row.id);
    assert.equal(row.name, source.name, row.id);
    assert.equal(source.label, source.name, `${row.id} had no Korean label before`);
    assert.match(row.label, /[가-힣]/, row.id);
  }
  const scope = union(el("HRA:mammary_gland"), display.pelvicScope.ids);
  same(rows.map((r) => r.id), scope.filter((id) => femaleById.get(id).label === femaleById.get(id).name && !["HRAF0417", "HRAF0418"].includes(id)));
  for (const id of Object.keys(labels.groupAliases)) assert.ok(["uterine-tube", "breast", "female-reproductive", "male-reproductive"].includes(id), id);
});

test("the reproductive tone stands apart from every scene colour and meridian marker", () => {
  const lab = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
    const [x, y, z] = [(r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, r * 0.2126 + g * 0.7152 + b * 0.0722, (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883].map(f);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const de2000 = (p, q) => {
    const [L1, a1, b1] = lab(p), [L2, a2, b2] = lab(q), rad = Math.PI / 180;
    const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
    const A1 = (1 + G) * a1, A2 = (1 + G) * a2, C1 = Math.hypot(A1, b1), C2 = Math.hypot(A2, b2);
    let h1 = Math.atan2(b1, A1) / rad; if (h1 < 0) h1 += 360; let h2 = Math.atan2(b2, A2) / rad; if (h2 < 0) h2 += 360;
    let dh = C1 * C2 === 0 ? 0 : h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh * rad) / 2), Lb = (L1 + L2) / 2, Cp = (C1 + C2) / 2;
    let hb = h1 + h2; if (C1 * C2 !== 0) hb = Math.abs(h1 - h2) > 180 ? (h1 + h2 + 360) / 2 : (h1 + h2) / 2;
    const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
    const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cp, SH = 1 + 0.015 * Cp * T;
    const RT = -2 * Math.sqrt(Cp ** 7 / (Cp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad);
    return Math.sqrt(((L2 - L1) / SL) ** 2 + ((C2 - C1) / SC) ** 2 + (dH / SH) ** 2 + RT * ((C2 - C1) / SC) * (dH / SH));
  };
  const violet = ORGAN_TONES.reproductive;
  assert.equal(organColor("reproductive"), violet);
  assert.equal(organColor(undefined), ORGAN_COLOR);
  assert.equal(organColor("unknown"), ORGAN_COLOR);
  // Every colour a reproductive organ can sit beside or be confused with.
  const scene = { ...ORGAN_TONES, organ: ORGAN_COLOR, muscle: "#b43f3f", vessel: "#d33f49", vein: "#356fb3", bone: "#e8dec5", borrowedBone: "#9aa7b1",
    skin: "#b9826f", lymph: "#58b99f", nerve: "#f0c94f", ligament: "#a7b9e0", tendon: "#e9edf7", selection: "#34d3dd", highlight: "#e5b24f",
    mirrored: "#bca77a", emphasis: "#238b91", sclera: "#e2dbcf" };
  delete scene.reproductive;
  for (const [name, hex] of Object.entries(scene)) assert.ok(de2000(violet, hex) >= 18, `${name} ${de2000(violet, hex).toFixed(1)}`);
  for (const m of read("data/meridians.json")) assert.ok(de2000(violet, m.color) >= 14, `${m.id} ${de2000(violet, m.color).toFixed(1)}`);
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  assert.ok((lum(violet) + 0.05) / (lum("#07141c") + 0.05) >= 4.5, "against the stage");
  const css = fs.readFileSync("src/atlas.css", "utf8");
  assert.ok(css.includes(`--ax-reproductive: ${violet};`), "the 표시 설정 key uses the same colour");
});

test("organs peel bowel first, then the folds, then the rest, all inside the organ window", () => {
  for (let tick = 0; tick <= 200; tick++) {
    const depth = tick / 2, [gut, folds, rest] = [0, 1, 2].map((rank) => organPeelOpacity(depth, rank));
    const layer = dissectionLayerOpacity("organ", depth);
    if (depth <= 76) assert.deepEqual([gut, folds, rest], [1, 1, 1], `${depth}`);
    if (depth >= 84) assert.deepEqual([gut, folds, rest], [0, 0, 0], `${depth}`);
    // An inner rank starts to fade only once the outer one is gone.
    if (folds < 1) assert.equal(gut, 0, `${depth}`);
    if (rest < 1) assert.equal(folds, 0, `${depth}`);
    // The system stays present (stage, counts) while any of its ranks is drawn.
    if (Math.max(gut, folds, rest) > 0) assert.ok(layer > 0, `${depth}`);
    if (tick) for (const rank of [0, 1, 2]) assert.ok(organPeelOpacity(depth, rank) <= organPeelOpacity(depth - 0.5, rank));
  }
  // The stop and the limit for a peel that keeps organs innermost are unchanged.
  assert.equal(peelLimit(["vessel", "lymph", "nerve"]), 76);
  // At 79% the bowel and folds are gone and every other organ is still opaque.
  assert.deepEqual([0, 1, 2].map((rank) => organPeelOpacity(79, rank)), [0, 0, 1]);
});

test("reproductive parts without a group are scoped to the pelvis by their concept", () => {
  assert.equal(sourceOrganRegion({ layer: "organ", regionScope: "pelvis" }), "pelvis");
  assert.equal(sourceOrganRegion({ layer: "organ" }), undefined);
  const mesovarium = femaleById.get("HRAF0431");
  assert.equal(mesovarium.group, undefined);
  const bounds = [[0, 0.83, -0.06], [0.03, 0.87, -0.04]];
  const scoped = { ...mesovarium, regionScope: "pelvis" };
  for (const region of ["pelvis", "lower-body", "whole"]) assert.ok(anatomyRegionMatches(bounds, region, scoped), region);
  for (const region of ["abdomen", "upper-body", "chest"]) assert.equal(anatomyRegionMatches(bounds, region, scoped), false, region);
});

test("the cover hides genitalia, not the lips or their vessels", () => {
  for (const name of ["Superior labial artery (left)", "Inferior labial vein (right)", "Nasolabial node (left)", "labial part of mouth, nsn", "Superior labial branches of infraorbital nerve"])
    assert.equal(isGenitalStructure("ZA_x", name), false, name);
  assert.equal(isGenitalStructure("FMA59815nsn", "labial part of mouth, nsn"), false);
  for (const name of ["Labia majora", "Labium minus (left)", "Clitoris", "Vulva", "Dorsal artery of penis (left)"]) assert.ok(isGenitalStructure("ZA_x", name), name);
  assert.ok(isGenitalStructure("HRAF0406", "Vagina"));
});

test("older and common Korean terms find the female organs and their parts", () => {
  const groupList = [
    { id: "uterus", name: "자궁", ids: ["HRAF0435"] },
    { id: "uterine-tube", name: "자궁관", ids: ["HRAF0408"], aliases: labels.groupAliases["uterine-tube"] },
    { id: "breast", name: "유방", ids: ["HRAF0008"], aliases: labels.groupAliases.breast },
    { id: "female-reproductive", name: "여성 생식기관", ids: ["HRAF0435"], aliases: labels.groupAliases["female-reproductive"] },
  ];
  const parts = labels.labels.map((row) => ({ ...femaleById.get(row.id), label: row.label, aliases: row.aliases }));
  const byId = (id) => parts.find((p) => p.id === id);
  for (const [q, expected] of [["나팔관", "uterine-tube"], ["난관", "uterine-tube"], ["fallopian tube", "uterine-tube"], ["유선", "breast"], ["젖샘", "breast"], ["생식기관", "female-reproductive"]]) {
    const matched = matchOrgans(groupList, q, byId);
    assert.equal(matched[0]?.id, expected, q);
    assert.ok(isExactOrgan(matched[0], q, byId), q);
  }
  assert.deepEqual(matchOrgans(groupList, "나팔", byId).map((g) => g.id), ["uterine-tube"]);
  for (const q of ["li", "st", "l", "s"]) assert.deepEqual(matchOrgans(groupList, q, byId).map((g) => g.id), groupList.filter((g) => g.name.includes(q)).map((g) => g.id), q);
  const nipple = rankStructures(parts, "유두");
  assert.deepEqual(nipple.slice(0, 2).map((p) => p.id).sort(), ["HRAF0006", "HRAF0014"]);
  assert.ok(isExactStructure(nipple[0], "유두"));
  assert.ok(rankStructures(parts, "젖샘엽").every((p) => /Mammary lobes/.test(p.name)));
  assert.equal(rankStructures(parts, "Mammary lobes (left)")[0].id, "HRAF0008");
});

test("a view saved with the glandular breast on the skin layer keeps showing it", () => {
  const points = read("data/points.json").map((p) => p.id);
  const runtime = female.map((s) => (display.glandularBreast.ids.includes(s.id) ? { ...s, layer: "organ" } : s));
  const layers = { skin: true, muscle: false, bone: false, organ: false, vessel: false, lymph: false, nerve: false };
  const saved = { ...initialView(), sex: "female", stage: 0, dissection: 0, displayMode: "layers", layers,
    selection: { kind: "structure", ids: ["HRAF0008"], name: "Mammary lobes (left)", layers: ["skin"] } };
  const restored = restoreView(JSON.stringify(saved), points, runtime);
  assert.deepEqual(restored.selection.ids, ["HRAF0008"]);
  assert.equal(restored.layers.organ, true);
  assert.deepEqual(restored.selection.layers, ["organ"]);
  const breast = read("data/female-organ-groups.json").find((g) => g.id === "breast");
  const detail = { ...initialView(), sex: "female", stage: 0, dissection: 0, displayMode: "layers", layers,
    detail: { id: "breast", name: "유방", ids: breast.ids, layers }, selection: { kind: "bundle", ids: breast.ids, name: "유방" } };
  const back = restoreView(JSON.stringify(detail), points, runtime);
  assert.equal(back.detail.id, "breast");
  assert.equal(back.detail.layers.organ, true);
  assert.equal(back.layers.organ, true);
  // A male view or an unrelated selection is untouched.
  const male = restoreView(JSON.stringify({ ...initialView(), displayMode: "layers", layers }), points, runtime);
  assert.equal(male.layers.organ, false);
});
