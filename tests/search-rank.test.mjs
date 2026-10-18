import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import {
  normalizeQuery, rankPoints, rankStructures, matchOrgans, pointScore, structureScore,
  isExactPoint, isExactStructure, isExactOrgan, splitExact,
} from "../src/search-rank.ts";

// src/anatomy.ts is written for Vite (bare JSON and extensionless imports);
// these hooks let the test use the very catalogue the app searches.
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) { if (/^\.\.?\//.test(specifier) && !/\.\w+$/.test(specifier)) return next(`${specifier}.ts`, context); throw error; }
  },
  load(url, context, next) { return next(url, url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context); },
});
const { structuresForSex, organGroups } = await import("../src/anatomy.ts");
const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const points = read("data/points.json");
const meridians = read("data/meridians.json");
const meridianName = (p) => meridians.find((m) => m.id === p.meridian)?.name;
const catalog = (sex) => {
  const items = structuresForSex(sex), byId = new Map(items.map((s) => [s.id, s]));
  return { items, byId: (id) => byId.get(id), groups: organGroups.filter((g) => g.sex === sex) };
};
const male = catalog("male"), female = catalog("female");
// The filters AtlasPage.tsx used before ranking (membership must not change).
const oldPoints = (q) => points.filter((p) =>
  `${p.id} ${p.name} ${p.hanja} ${p.pinyin} ${p.landmarks.join(" ")} ${meridianName(p)}`.toLowerCase().includes(normalizeQuery(q)));
const oldStructures = (items, query) => {
  const q = query.trim().toLowerCase();
  return !q ? [] : items.filter((s) => `${s.label} ${s.name} ${s.id} ${s.fmaId || ""} ${s.latin || ""} ${(s.hierarchy || []).join(" ")}`.toLowerCase().includes(q));
};
const ids = (list) => list.map((item) => item.id);
const sorted = (list) => [...ids(list)].sort();
const queries = ["위", "stomach", "FMA7148", "대퇴골", "경수", "심장", "간", "liver", "Sural nerve (left)", "st 36", "족삼리", "zusanli", "  Stomach  ", "없는구조"];

test("the query keeps today's normalisation of point codes", () => {
  assert.equal(normalizeQuery(" ST 36 "), "st36");
  assert.equal(normalizeQuery("st36"), "st36");
  assert.equal(normalizeQuery("족삼리"), "족삼리");
  assert.equal(normalizeQuery("Zusanli"), "zusanli");
});

test("ranking keeps today's membership for points and structures of both sexes", () => {
  for (const q of queries) {
    assert.deepEqual(sorted(rankPoints(points, q, meridianName)), sorted(oldPoints(q)), q);
    for (const { items } of [male, female]) assert.deepEqual(sorted(rankStructures(items, q)), sorted(oldStructures(items, q)), q);
  }
  assert.deepEqual(rankStructures(male.items, "  "), []);
  assert.deepEqual(ids(rankPoints(points, "", meridianName)), ids(points));
  // Existing browser count assertions (anatomy.spec, spinal-detail.spec).
  assert.equal(rankStructures(male.items, "대퇴골").length, 4);
  assert.equal(rankStructures(female.items, "경수").length, 8);
});

test("'위', 'stomach' and 'FMA7148' put the male stomach first, not a muscle", () => {
  for (const q of ["위", "stomach", "FMA7148", "Stomach"]) {
    const ranked = rankStructures(male.items, q);
    assert.equal(ranked[0].id, "FMA7148", q);
    assert.equal(ranked[0].label, "위");
    assert.ok(isExactStructure(ranked[0], q), q);
  }
  // The detail-only copy of the same FMA entity follows it as an exact match.
  assert.deepEqual(ids(splitExact(rankStructures(male.items, "위"), (s) => isExactStructure(s, "위")).exact), ["FMA7148", "BP4_FJ2564"]);
});

test("female '위' still finds the carried stomach and the separate CT stomach", () => {
  const ranked = rankStructures(female.items, "위");
  assert.equal(ranked[0].id, "FT_FMA7148");
  assert.equal(ranked[0].fmaId, "FMA7148");
  assert.equal(ranked[1].id, "CTF_stomach");
  assert.equal(rankStructures(female.items, "FMA7148")[0].id, "FT_FMA7148");
  assert.deepEqual(ids(rankStructures(female.items, "stomach").slice(0, 2)), ["FT_FMA7148", "CTF_stomach"]);
});

test("structures are one ordered list: exact, prefix, substring, then other fields", () => {
  for (const { items } of [male, female]) for (const q of queries) {
    const ranked = rankStructures(items, q), scores = ranked.map((s) => structureScore(s, q));
    for (let i = 1; i < ranked.length; i++) {
      assert.ok(scores[i - 1] <= scores[i], `${q}: ${ranked[i - 1].id} before ${ranked[i].id}`);
      if (scores[i - 1] === scores[i]) assert.ok((ranked[i - 1].label || ranked[i - 1].name).localeCompare(ranked[i].label || ranked[i].name) <= 0, q);
    }
  }
  // Layers are interleaved by score: the '위' organ is ahead of muscles that only contain the term.
  const ranked = rankStructures(male.items, "위");
  assert.ok(ranked.findIndex((s) => s.id === "FMA7148") < ranked.findIndex((s) => s.layer === "muscle"));
});

test("organ details match by Korean name, English organ key and exact member name or FMA ID", () => {
  for (const [{ groups, byId }, q, expected] of [
    [male, "위", ["stomach"]], [male, "stomach", ["stomach"]], [male, "FMA7148", ["stomach"]],
    [female, "위", ["stomach", "stomach-ct"]], [female, "stomach", ["stomach", "stomach-ct", "abdomen-ct"]], [female, "FMA7148", ["stomach"]],
    [male, "liver", ["liver"]], [female, "liver", ["liver", "abdomen-ct"]], [female, "Spleen", ["spleen", "abdomen-ct"]],
    [male, "heart", ["heart"]], [female, "heart", ["heart"]], [female, "uterine tube", ["uterine-tube"]],
  ]) {
    const matched = matchOrgans(groups, q, byId);
    assert.deepEqual(ids(matched), expected, q);
    assert.ok(isExactOrgan(matched[0], q, byId), q);
  }
  // Every English organ key opens its own detail first, ahead of the CT bundle.
  for (const { groups, byId } of [male, female]) for (const g of groups) {
    const matched = matchOrgans(groups, g.id, byId);
    assert.equal(matched[0], g, g.id);
    assert.ok(isExactOrgan(g, g.id, byId), g.id);
  }
  // Three letters of a key start a prefix match while typing.
  assert.deepEqual(ids(matchOrgans(male.groups, "hea", male.byId)), ["heart"]);
  assert.deepEqual(ids(matchOrgans(female.groups, "ute", female.byId)), ["uterus", "uterine-tube"]);
  // Member names are matched whole, never by prefix: "위혀구역 폐실질" (lung) stays out of '위',
  // and laterality words or a single letter add nothing beyond today's group-name rule.
  for (const { groups, byId } of [male, female]) for (const q of ["왼쪽", "오른쪽", "left", "Right", "l", "s", "c", "r", "li", "st"]) {
    assert.deepEqual(ids(matchOrgans(groups, q, byId)), ids(groups.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()))), q);
  }
  assert.deepEqual(ids(matchOrgans(male.groups, "l", male.byId)), []);
  // Today's Korean-name matches stay, exact ones lead, the rest keep data order.
  for (const { groups, byId } of [male, female]) for (const q of queries) {
    const matched = matchOrgans(groups, q, byId), key = q.trim().toLowerCase();
    for (const g of groups.filter((g) => g.name.toLowerCase().includes(key))) assert.ok(matched.includes(g), `${q} → ${g.id}`);
    const exact = matched.map((g) => isExactOrgan(g, q, byId));
    assert.deepEqual(exact, [...exact].sort((a, b) => b - a), q);
    const rest = matched.filter((g, i) => !exact[i]);
    assert.deepEqual(rest, groups.filter((g) => rest.includes(g)), q);
  }
  assert.deepEqual(matchOrgans(male.groups, "", male.byId), male.groups);
  assert.equal(matchOrgans(male.groups, "없는구조", male.byId).length, 0);
});

test("ST36 is first for its code, spaced code, Korean name, hanja and pinyin", () => {
  for (const q of ["ST36", "st 36", "족삼리", "足三里", "zusanli", "Zusanli"]) {
    const ranked = rankPoints(points, q, meridianName);
    assert.equal(ranked[0].id, "ST36", q);
    assert.ok(isExactPoint(ranked[0], q), q);
  }
  // A code prefix lists the exact code before the longer ones.
  assert.deepEqual(ids(rankPoints(points, "st3", meridianName).slice(0, 2)), ["ST3", "ST30"]);
});

test("'위' lists points named 위… before points found only by landmark or meridian", () => {
  const ranked = rankPoints(points, "위", meridianName), scores = ranked.map((p) => pointScore(p, "위", meridianName));
  const named = points.filter((p) => p.name.startsWith("위"));
  assert.deepEqual(ids(ranked.slice(0, named.length)), ids(named));
  assert.ok(named.length >= 4 && named.some((p) => p.id === "BL40"));
  assert.ok(scores.slice(named.length).every((s) => s === 3));
  assert.ok(ranked.some((p) => p.meridian === "ST" && !p.name.includes("위")), "족양명위경 points still match by meridian");
  // Equal scores keep data order.
  const order = new Map(points.map((p, i) => [p.id, i]));
  for (let i = 1; i < ranked.length; i++) if (scores[i - 1] === scores[i]) assert.ok(order.get(ranked[i - 1].id) < order.get(ranked[i].id));
  assert.equal(ranked.filter((p) => isExactPoint(p, "위")).length, 0);
});

test("splitting exact matches keeps each row once", () => {
  for (const { items } of [male, female]) for (const q of queries) {
    const ranked = rankStructures(items, q), { exact, rest } = splitExact(ranked, (s) => isExactStructure(s, q));
    assert.deepEqual([...exact, ...rest], ranked, q);
    assert.ok(exact.every((s) => structureScore(s, q) === 0) && rest.every((s) => structureScore(s, q) > 0), q);
  }
  const { exact, rest } = splitExact(rankPoints(points, "족삼리", meridianName), (p) => isExactPoint(p, "족삼리"));
  assert.deepEqual([ids(exact), rest.length], [["ST36"], 0]);
});
