// Gates for the female acupoint markers (public/models/acupoint-anchors-female.json):
// the markers placed from female landmarks and WHO cun (data/female-acupoint-rules.json,
// data/female-acupoint-landmarks.json), and provenance, facing and open air for
// every marker. The rule arithmetic is repeated here on purpose instead of
// importing the builder's.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const F = read("public/models/acupoint-anchors-female.json"), M = read("data/anchors.json");
const LM = read("data/female-acupoint-landmarks.json"), L = LM.female, R = read("data/female-acupoint-rules.json");
const points = read("data/points.json");
const mm = (v) => v * 1000, d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const quant = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const dist = (a) => `median ${quant(a, .5).toFixed(2)} p90 ${quant(a, .9).toFixed(2)} max ${Math.max(...a).toFixed(2)} (n ${a.length})`;

// Independent rule arithmetic.
const samples = L.anteriorMedianLine.samplesYXRmsMm;
function midX(y) {
  if (y <= samples[0][0]) return samples[0][1];
  const i = samples.findIndex((s) => s[0] >= y);
  if (i < 0) return samples.at(-1)[1];
  const [ya, xa] = samples[i - 1], [yb, xb] = samples[i];
  return xa + (xb - xa) * (y - ya) / (yb - ya);
}
const yNavel = L.navel.point[1], yXs = L.xiphisternalJunction.point[1], yPubic = L.pubicSymphysisSuperior.point[1], yPubicLow = L.pubicSymphysisInferior.point[1];
const cun = { upper: (yXs - yNavel) / 8, lower: (yNavel - yPubic) / 5, lateral: (L.nipples.left[0] - L.nipples.right[0]) / 8 };
const level = { navel: yNavel, xiphisternalJunction: yXs, pubicSymphysisSuperior: yPubic, pubicSymphysisInferior: yPubicLow };
const sideSign = (side) => (side === "right" ? -1 : side === "left" ? 1 : 0);
const levelOf = (rule) => level[rule.vertical.from] + rule.vertical.cun * (rule.vertical.scale ? cun[rule.vertical.scale] : 0);
function target(rule, side) {
  const s = sideSign(side);
  if (rule.construction?.type === "lineAtLevel") {
    const [a, b] = rule.construction.line.map((k) => L[k][side]), y = level[rule.construction.level];
    return [a[0] + (b[0] - a[0]) * (a[1] - y) / (a[1] - b[1]), y];
  }
  let y = levelOf(rule), x;
  if (rule.lateral.from === "navel") x = L.navel.point[0];
  else if (rule.lateral.from === "asis") x = L.asis[side][0] + s * rule.lateral.cun * cun.lateral;
  else x = midX(y) + s * rule.lateral.cun * cun.lateral;
  if (rule.offset) {
    const t = rule.offset.angleDeg * Math.PI / 180;
    x -= s * rule.offset.cun * Math.cos(t) * cun.lateral;
    y -= rule.offset.cun * Math.sin(t) * cun[rule.offset.verticalScale];
  }
  return [x, y];
}
const rules = new Map(R.rules.map((r) => [r.pointId, r]));
const RULE_METHODS = new Set(["female-landmark-cun", "female-landmark-level", "female-landmark"]);
const placed = F.filter((a) => RULE_METHODS.has(a.method));
const frontal = placed.filter((a) => a.method === "female-landmark-cun" || rules.get(a.pointId).construction?.type === "lineAtLevel" || rules.get(a.pointId).projection === "front");
const byKey = new Map(F.map((a) => [a.key, a]));
const marker = (id, side) => F.find((a) => a.pointId === id && a.occurrence === 0 && (side === "midline" ? a.side === "midline" : a.side === side));
const lateralMm = (a) => Math.abs(mm(a.surfacePoint[0] - midX(a.surfacePoint[1])));

test("G9 provenance: 834 markers, 409 names, male order and keys, every marker labelled unreviewed", () => {
  assert.equal(F.length, 834);
  assert.equal(new Set(F.map((a) => a.pointId)).size, 409);
  assert.deepEqual(F.map((a) => a.key), M.map((a) => a.key));
  assert.deepEqual(F.map((a) => a.side), M.map((a) => a.side));
  for (const p of points) assert.equal(F.filter((a) => a.pointId === p.id).length, p.markerCount, p.id);
  const methods = new Set(["field-ray", "field-closest", "field-carried", ...RULE_METHODS]);
  for (const a of F) {
    assert.ok(methods.has(a.method), `${a.key} method ${a.method}`);
    assert.equal(a.mode, "female-approximation", a.key);
    assert.equal(a.status, "approximate-unreviewed", a.key);
    assert.ok(a.surfacePoint.every(Number.isFinite) && a.position.every(Number.isFinite), a.key);
    assert.equal(a.openAirFix, undefined, `${a.key}: display offsets are no longer turned to pass the open-air rule`);
  }
  // Male internal region references keep that mode and are not pushed out to the skin.
  const internal = M.filter((a) => a.mode === "region-reference").map((a) => a.key);
  assert.deepEqual(F.filter((a) => a.markerMode === "region-reference").map((a) => a.key), internal);
  for (const k of internal) assert.equal(byKey.get(k).method, "field-carried");
  // The rule markers are exactly the markers of the rules that are not on hold, each with its rule's method.
  const shipped = R.rules.filter((r) => !r.hold).map((r) => r.pointId);
  assert.deepEqual([...new Set(placed.map((a) => a.pointId))].sort(), [...shipped].sort());
  for (const r of R.rules.filter((r) => r.hold)) assert.ok(F.filter((a) => a.pointId === r.pointId).every((a) => a.method === "field-ray"), r.pointId);
  for (const a of placed) {
    const r = rules.get(a.pointId);
    assert.equal(a.rule, r.id);
    assert.equal(a.method, r.method, a.key);
    assert.deepEqual(a.landmarks, r.landmarks);
    assert.ok(Number.isFinite(a.transportDeltaMm));
  }
  for (const r of R.rules) assert.ok((r.who || r.kmcric) && r.review.length && r.landmarks.length && RULE_METHODS.has(r.method), r.id);
  console.log("G9 methods:", Object.entries(F.reduce((n, a) => ({ ...n, [a.method]: (n[a.method] || 0) + 1 }), {})).map(([k, v]) => `${k} ${v}`).join(", "));
});

test("G1 definition points: CV8 navel centre, CV2 pubic top, CV16 xiphisternal junction, ST17 nipple centre, ST18 inframammary crease", () => {
  const cv8 = marker("CV8", "midline"), cv2 = marker("CV2", "midline"), cv16 = marker("CV16", "midline");
  for (const a of [cv8, cv2, cv16]) assert.equal(a.method, "female-landmark-cun", a.key);
  const e8 = mm(d3(cv8.surfacePoint, L.navel.point)), e2 = mm(d2(cv2.surfacePoint, [midX(yPubic), yPubic])), e2bone = mm(d2(cv2.surfacePoint, L.pubicSymphysisSuperior.point));
  const e16 = mm(d2(cv16.surfacePoint, [midX(yXs), yXs])), e16bone = mm(d2(cv16.surfacePoint, L.xiphisternalJunction.point));
  console.log(`G1 CV8-navel ${e8.toFixed(2)} mm, CV2-pubic top on the median line ${e2.toFixed(2)} mm (bony centre ${e2bone.toFixed(2)} mm), CV16-xiphisternal junction on the median line ${e16.toFixed(2)} mm (bony centre ${e16bone.toFixed(2)} mm)`);
  assert.ok(e8 <= 5, `CV8 ${e8}`); assert.ok(e2 <= 5, `CV2 ${e2}`); assert.ok(e2bone <= 5, `CV2 bone ${e2bone}`); assert.ok(e16 <= 1, `CV16 ${e16}`); assert.ok(e16bone <= 8, `CV16 bone ${e16bone}`);
  assert.ok(L.navel.crossCheck.vertexCentroidFrontalDistanceMm <= 2);
  const nipplePart = { right: "HRAF0014", left: "HRAF0006" };
  for (const side of ["right", "left"]) {
    const st17 = marker("ST17", side), st18 = marker("ST18", side), c = L.nipples[side];
    assert.equal(st17.surfacePart, nipplePart[side]);
    const tip = mm(d3(st17.surfacePoint, L.nipples.outerCentre[side])), fromCentroid = mm(d3(st17.surfacePoint, c));
    assert.ok(tip <= 0.05, `ST17 ${side} ${tip} mm from the nipple's outer centre`);
    assert.ok(fromCentroid <= 5, `ST17 ${side} ${fromCentroid} mm from the nipple centroid`);
    const crease = mm(d3(st18.surfacePoint, L.inframammaryCrease[side].point)), meridian = Math.abs(mm(st18.surfacePoint[0] - c[0])), below = mm(c[1] - st18.surfacePoint[1]);
    assert.ok(crease <= 0.05, `ST18 ${side} ${crease} mm from the crease point`);
    assert.ok(meridian <= 1, `ST18 ${side} ${meridian} mm off the nipple meridian`);
    assert.ok(below > 30 && L.inframammaryCrease[side].breastFatDistanceMm <= 20, `ST18 ${side} is not at a crease below the breast`);
    console.log(`G1 ${side}: ST17 ${tip.toFixed(3)} mm from the nipple's outer centre (${fromCentroid.toFixed(1)} mm from its centroid); ST18 ${crease.toFixed(3)} mm from the crease, ${below.toFixed(1)} mm below the nipple, ${L.inframammaryCrease[side].breastFatDistanceMm} mm from the breast fat`);
  }
});

test("G2 every frontal rule marker is within 1 mm of its target after projection; level-only markers at their level", () => {
  assert.equal(placed.length, R.rules.filter((r) => !r.hold).reduce((n, r) => n + points.find((p) => p.id === r.pointId).markerCount, 0));
  const e = [], lv = [];
  for (const a of frontal) {
    const r = rules.get(a.pointId), t = r.projection === "front" ? [a.ruleTarget[0], levelOf(r)] : target(r, a.side), err = mm(d2(a.surfacePoint, t));
    e.push(err);
    assert.ok(err <= 1, `${a.key} ${err.toFixed(2)} mm from its target`);
    assert.ok(Math.abs(mm(d3(a.position, a.surfacePoint)) - 3) < 0.02, a.key);
    assert.ok(a.position[2] > a.surfacePoint[2], `${a.key} display offset faces the front`);
  }
  for (const a of placed.filter((a) => a.method === "female-landmark-level")) {
    const r = rules.get(a.pointId), dy = Math.abs(mm(a.surfacePoint[1] - levelOf(r)));
    lv.push(dy);
    assert.ok(dy <= 1, `${a.key} ${dy.toFixed(2)} mm off its level`);
    if (r.projection === "carried-horizontal") assert.ok(Math.abs(mm(a.surfacePoint[1] - a.ruleTarget[1])) < 0.05 && mm(d3(a.surfacePoint, a.ruleTarget)) <= 120, `${a.key} not on its horizontal re-projection`);
  }
  console.log("G2 frontal distance to target (mm):", dist(e), "\nG2 level-only markers, distance to level (mm):", dist(lv));
});

test("G5 left/right pairs of rule markers mirror about the female anterior median line", () => {
  const base = Math.max(5, Math.max(L.asymmetry.nippleMirrorMm, L.asymmetry.pubicTopMm) + 3), A = L.asymmetry;
  // Limit per rule family: the landmark asymmetry it inherits + 3 mm.
  const limitOf = (r) => r.lateral?.from === "transport" ? null
    : r.lateral?.from === "asis" ? A.asisMirrorMm + 3
    : r.construction?.type === "lineAtLevel" ? Math.max(A.asisMirrorMm, A.patellaBaseMirrorMm) + 3
    : r.construction?.type === "nippleOuterCentre" ? Math.max(5, A.nippleOuterMirrorMm + 3)
    : r.construction?.type === "inframammaryCrease" ? Math.max(5, A.creaseMirrorMm + 3) : base;
  const groups = new Map();
  for (const a of placed.filter((a) => a.side === "left")) {
    const b = F.find((x) => x.pointId === a.pointId && x.occurrence === a.occurrence && x.side === "right");
    const x0 = midX((a.surfacePoint[1] + b.surfacePoint[1]) / 2), m = [2 * x0 - b.surfacePoint[0], b.surfacePoint[1], b.surfacePoint[2]];
    const err = mm(d3(a.surfacePoint, m)), limit = limitOf(rules.get(a.pointId)), g = limit === null ? "level-only (lateral kept from transport, not gated)" : `limit ${limit.toFixed(1)}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(`${a.pointId} ${err.toFixed(2)}`);
    if (limit !== null) assert.ok(err <= limit, `${a.pointId} mirror error ${err.toFixed(2)} mm > ${limit}`);
  }
  assert.equal(groups.get(`limit ${base.toFixed(1)}`).length, 29);
  console.log("G5 mirror error (mm):\n  " + [...groups].map(([g, v]) => `${g}: ${v.length === 29 ? dist(v.map((s) => +s.split(" ")[1])) : v.join(", ")}`).join("\n  "));
});

// Lines from bottom to top, rule markers with their unchanged neighbours.
const LINES = [
  { line: "CV", sides: ["midline"], ids: ["CV1", ...Array.from({ length: 15 }, (_, i) => `CV${i + 2}`), "CV17"] },
  { line: "KI", sides: ["right", "left"], ids: [...Array.from({ length: 11 }, (_, i) => `KI${i + 11}`), "KI22"] },
  { line: "ST", sides: ["right", "left"], ids: ["ST32", "ST31", ...Array.from({ length: 12 }, (_, i) => `ST${30 - i}`), "ST18", "ST17", "ST16"] },
  { line: "SP", sides: ["right", "left"], ids: ["SP11", "SP12", "SP13", "SP14", "SP15", "SP16", "SP17"] },
  { line: "LR", sides: ["right", "left"], ids: ["LR11", "LR12", "LR13"] },
  { line: "GB", sides: ["right", "left"], ids: ["GB28", "GB27", "GB26", "GB25"] },
];
// WHO "same level" relations (and levels set by the same landmarks): every marker's height within 1 mm of the level.
const SAME_LEVEL = [
  { level: "centre of the umbilicus", y: yNavel, ids: ["CV8", "KI16", "ST25", "SP15", "GB26"], who: "SP15 note: same level as ST25, KI16, CV8; GB26 note 2: same level as CV8" },
  { level: "superior border of the pubic symphysis", y: yPubic, ids: ["CV2", "KI11", "ST30", "LR12", "SP12"], who: "ST30, LR12: same level as the superior border; SP12 note: same level as CV2; KI11 5 B-cun below the umbilicus" },
  { level: "3 B-cun below the umbilicus", y: yNavel - 3 * cun.lower, ids: ["CV4", "KI13", "ST28", "GB27"], who: "GB27 note: same level as CV4" },
  { level: "4 B-cun below the umbilicus", y: yNavel - 4 * cun.lower, ids: ["CV3", "KI12", "ST29", "EX-CA1"], who: "EX-CA1 (KMCRIC) 4 B-cun below the umbilicus = CV3" },
  { level: "xiphisternal junction", y: yXs, ids: ["CV16"], who: "CV16" },
  { level: "inferior border of the pubic symphysis", y: yPubicLow, ids: ["ST31"], who: "ST31 note 2" },
];
const cunRule = (id) => rules.get(id)?.method === "female-landmark-cun" && !rules.get(id).offset && rules.get(id).lateral.from !== "asis";
const sameLine = (a, b) => (rules.get(a).lateral.from === "navel" ? 0 : rules.get(a).lateral.cun) === (rules.get(b).lateral.from === "navel" ? 0 : rules.get(b).lateral.cun);

test("G6 order along each line, cun spacing, WHO same-level and relative-position relations", () => {
  const ratios = [], failed = [], report = [];
  for (const { line, sides, ids } of LINES) for (const side of sides) {
    const seq = ids.map((id) => marker(id, side));
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1], b = seq[i], dy = mm(b.surfacePoint[1] - a.surfacePoint[1]);
      if (!(dy > 0)) failed.push(`${a.pointId}-${b.pointId} ${side} order`);
      if (cunRule(a.pointId) && cunRule(b.pointId) && sameLine(a.pointId, b.pointId)) {
        const r = d3(a.surfacePoint, b.surfacePoint) / Math.abs(levelOf(rules.get(b.pointId)) - levelOf(rules.get(a.pointId)));
        ratios.push(r);
        if (!(r >= 0.7 && r <= 1.4)) failed.push(`${a.pointId}-${b.pointId} ${side} spacing`);
      } else report.push(`${a.pointId}-${b.pointId} ${side}: dy ${dy.toFixed(1)} mm (${a.method} / ${b.method})`);
    }
  }
  const levels = [];
  for (const g of SAME_LEVEL) {
    const ms = g.ids.flatMap((id) => F.filter((a) => a.pointId === id && a.occurrence === 0)), dev = ms.map((a) => Math.abs(mm(a.surfacePoint[1] - g.y)));
    for (const [k, a] of ms.entries()) if (!(dev[k] <= 1)) failed.push(`${a.pointId} ${a.side} level`);
    levels.push(`${g.level}: ${ms.length} markers (${g.ids.join(", ")}), max ${Math.max(...dev).toFixed(2)} mm`);
  }
  const rel = [];
  for (const side of ["right", "left"]) {
    const [sp12, sp13, gb26, gb27, gb28, lr13] = ["SP12", "SP13", "GB26", "GB27", "GB28", "LR13"].map((id) => marker(id, side)), asisX = Math.abs(mm(L.asis[side][0] - midX(L.asis[side][1])));
    const checks = [
      ["SP12 medial to SP13", lateralMm(sp12) < lateralMm(sp13), `${lateralMm(sp12).toFixed(1)} < ${lateralMm(sp13).toFixed(1)} mm`],
      ["SP12 inferior to SP13", sp12.surfacePoint[1] < sp13.surfacePoint[1], `${mm(sp13.surfacePoint[1] - sp12.surfacePoint[1]).toFixed(1)} mm`],
      ["GB27 not lateral to the ASIS", lateralMm(gb27) <= asisX + 0.5, `${lateralMm(gb27).toFixed(1)} vs ASIS ${asisX.toFixed(1)} mm`],
      ["GB28 medial to GB27", lateralMm(gb28) < lateralMm(gb27), `${(lateralMm(gb27) - lateralMm(gb28)).toFixed(1)} mm`],
      ["GB28 inferior to GB27", gb28.surfacePoint[1] < gb27.surfacePoint[1], `${mm(gb27.surfacePoint[1] - gb28.surfacePoint[1]).toFixed(1)} mm`],
      ["GB26 inferior to LR13", gb26.surfacePoint[1] < lr13.surfacePoint[1], `${mm(lr13.surfacePoint[1] - gb26.surfacePoint[1]).toFixed(1)} mm`],
    ];
    for (const [name, ok, value] of checks) { rel.push(`${name} ${side}: ${value}`); if (!ok) failed.push(`${name} ${side}`); }
    // Chest and thigh relations WHO states with unchanged (carried) neighbours.
    // ST17/ST18 follow the female nipple and breast crease; the intercostal
    // points around them are still male markers carried by the field.
    const [st17, st18, st32, st31, lr14, gb24, ki22, sp17, ki23, sp18] = ["ST17", "ST18", "ST32", "ST31", "LR14", "GB24", "KI22", "SP17", "KI23", "SP18"].map((id) => marker(id, side));
    const onCurve = (p, a, c) => { const t = (p.surfacePoint[0] - a.surfacePoint[0]) / (c.surfacePoint[0] - a.surfacePoint[0]); return mm(p.surfacePoint[1] - (a.surfacePoint[1] + t * (c.surfacePoint[1] - a.surfacePoint[1]))); };
    const thighCun = (yPubic - L.patellaBaseLateral[side][1]) / 18, st32Expected = st31.surfacePoint[1] - (L.patellaBaseLateral[side][1] + 6 * thighCun);
    const chest = [
      ["LR14 inferior to ST17", lr14.surfacePoint[1] < st17.surfacePoint[1], `${mm(st17.surfacePoint[1] - lr14.surfacePoint[1]).toFixed(1)} mm`],
      ["ST18 superior to LR14", st18.surfacePoint[1] > lr14.surfacePoint[1], `${mm(st18.surfacePoint[1] - lr14.surfacePoint[1]).toFixed(1)} mm`],
      ["ST18 superior to GB24", st18.surfacePoint[1] > gb24.surfacePoint[1], `${mm(st18.surfacePoint[1] - gb24.surfacePoint[1]).toFixed(1)} mm`],
      ["ST18 on the KI22-SP17 curve", Math.abs(onCurve(st18, ki22, sp17)) <= 10, `${onCurve(st18, ki22, sp17).toFixed(1)} mm off`],
      ["ST17 on the KI23-SP18 curve", Math.abs(onCurve(st17, ki23, sp18)) <= 10, `${onCurve(st17, ki23, sp18).toFixed(1)} mm off`],
      ["ST31-ST32 spacing", (st31.surfacePoint[1] - st32.surfacePoint[1]) / st32Expected >= 0.7, `ratio ${((st31.surfacePoint[1] - st32.surfacePoint[1]) / st32Expected).toFixed(2)}`],
    ];
    for (const [name, ok, value] of chest) { rel.push(`${name} ${side}: ${value}`); if (!ok) failed.push(`${name} ${side}`); }
  }
  const known = R.knownBoundaryFailures.flatMap((f) => f.sides.map((s) => [f.pair, s, f.check].filter(Boolean).join(" ")));
  assert.deepEqual(failed.sort(), known.sort(), "G6 failures differ from data/female-acupoint-rules.json knownBoundaryFailures");
  console.log("G6 cun spacing ratio:", dist(ratios), "\nG6 same level:\n  " + levels.join("\n  ") + "\nG6 relations:\n  " + rel.join("\n  ") +
    "\nG6 other neighbours:\n  " + report.join("\n  ") + "\nG6 known failures: " + (known.join(", ") || "none"));
});

const haveScene = fs.existsSync(".cache/female-transport/female-scene/geometry.bin") && fs.existsSync(".cache/female-transport/out/anchor-rays.bin");
test("G7 facing and open air: carried markers on the face their carried direction points out of, every surface marker on skin the viewer sees", { skip: !haveScene && "female scene cache (.cache/female-transport) not present" }, async () => {
  const { loadScene, meshOf, openAir, frontHit, sceneHashes, Vector3 } = await import("../scripts/female-acupoints/scene.mjs");
  assert.deepEqual(sceneHashes("female"), LM.scenes.female.sha256, "landmarks were measured on another scene dump");
  const scene = loadScene("female"), skin = meshOf(scene, "HRAF0003"), g = skin.geometry, P = g.attributes.position.array, I = g.index.array;
  const rays = new Float32Array(fs.readFileSync(".cache/female-transport/out/anchor-rays.bin").buffer.slice(0));
  const winding = (k) => { const v = [0, 1, 2].map((j) => new Vector3(P[I[k * 3 + j] * 3], P[I[k * 3 + j] * 3 + 1], P[I[k * 3 + j] * 3 + 2])); return v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize(); };
  const closed = [], off = [], inward = [], wrongFace = [];
  for (const [i, a] of F.entries()) {
    if (a.markerMode === "region-reference") continue;
    const s = new Vector3(...a.surfacePoint), out = new Vector3(...a.position).sub(s).normalize();
    const host = a.surfacePart ? meshOf(scene, a.surfacePart) : skin, near = host.geometry.boundsTree.closestPointToPoint(s);
    if (near.distance > 2e-5) off.push(a.key);
    if (!openAir(skin, s, out).open) closed.push(a.key);
    if (a.surfacePart) continue;
    // The display offset leaves the skin on its own face's outer side (no turning towards open air).
    const n = winding(near.faceIndex);
    if (!(n.dot(out) > 0)) inward.push(a.key);
    // Carried markers sit on a face whose outward side agrees with the carried outward direction.
    if (["field-ray", "field-closest", "female-landmark-level"].includes(a.method)) {
      const d = new Vector3(rays[i * 6 + 3], rays[i * 6 + 4], rays[i * 6 + 5]);
      if (!(n.dot(d) > 0)) wrongFace.push(`${a.key} ${(Math.acos(Math.max(-1, Math.min(1, n.dot(d) / d.length()))) * 180 / Math.PI).toFixed(0)} deg`);
    }
  }
  const openExceptions = F.filter((a) => a.openAirException).map((a) => a.key), facingExceptions = F.filter((a) => a.facingException).map((a) => a.key);
  assert.deepEqual(off, [], "markers off their surface");
  assert.deepEqual(inward, [], "display offsets pointing into the skin");
  assert.deepEqual(closed.filter((k) => !openExceptions.includes(k)), [], "closed markers that are not listed exceptions");
  assert.deepEqual(wrongFace.map((s) => s.split(" ")[0]), facingExceptions, "markers on a face opposite their carried direction must be the listed facingException markers");
  for (const a of F.filter((a) => a.facingException)) assert.ok(a.facingException.length > 40, `${a.key} exception needs a reason`);
  for (const a of frontal) {
    const h = frontHit(skin, a.ruleTarget[0], rules.get(a.pointId).projection === "front" ? a.ruleTarget[1] : target(rules.get(a.pointId), a.side)[1]);
    assert.ok(mm(h.point.distanceTo(new Vector3(...a.surfacePoint))) < 0.05, `${a.key} is not the outermost face in front of its target`);
  }
  const moved = F.filter((a) => a.facingMoveMm !== undefined).map((a) => `${a.key} ${a.facingMoveMm}`);
  console.log(`G7 closed ${closed.length}, open-air exceptions ${openExceptions.length}, open-air moves ${F.filter((a) => a.openAirMoveMm !== undefined).length}; wrong-face ${wrongFace.length} (${wrongFace.join(", ") || "none"}), all listed facingException; moved to the facing crossing: ${moved.join(", ")} mm`);
});

test("breast-surface flag marks every marker within 12 mm of the HRA breast fat, except those placed on the breast's own landmarks", { skip: !haveScene && "female scene cache (.cache/female-transport) not present" }, async () => {
  const { loadScene, meshOf, Vector3 } = await import("../scripts/female-acupoints/scene.mjs");
  const fat = meshOf(loadScene("female"), ["HRAF0004", "HRAF0012"]);
  for (const a of F) assert.equal(Boolean(a.breastSurface), a.method !== "female-landmark" && fat.geometry.boundsTree.closestPointToPoint(new Vector3(...a.surfacePoint)).distance <= 0.012, a.key);
  console.log("breast-surface markers:", F.filter((a) => a.breastSurface).map((a) => a.key).join(" "));
});
