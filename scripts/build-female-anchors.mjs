// Approximate female acupoint anchors: each male anchor's skin point and
// outward direction carried by the registration field (warp.py writes them),
// then projected along that direction onto the HRA female skin. These are
// unreviewed approximations, shown only when the viewer asks for them.
//
// Projection of a carried marker: the nearest crossing of the skin HRAF0003
// within 120 mm either way along the carried outward direction whose outward
// (winding) face normal agrees with that direction, so the marker lands on
// the side of the body part the male marker was on. If no crossing faces
// that way, the nearest crossing is kept and listed (facingException). With
// no crossing at all, the closest skin point is used (field-closest).
//
// Corrections on top of the carried markers:
// - Female landmark rules (data/female-acupoint-rules.json, landmarks in
//   data/female-acupoint-landmarks.json from scripts/female-acupoints/landmarks.mjs):
//   female-landmark-cun: frontal target from landmarks and WHO B-cun,
//     projected along -z onto the outermost face of HRAF0003 (the abdominal
//     block CV2-CV15, KI11-KI21, ST19-ST30, SP14-SP16 and the neighbours
//     CV16, SP13, LR12, EX-CA1, GB27, GB28);
//   female-landmark-level: WHO gives a level but no lateral distance (SP12,
//     GB26): the level from the landmarks, the lateral position kept from the
//     carried marker;
//   female-landmark: a landmark construction without B-cun (ST17 nipple
//     centre, ST18 inframammary crease, ST31 by WHO Note 2).
// - Internal region references (male mode "region-reference": inside the
//   mouth or nose) keep the carried point instead of being pushed out to the
//   facial skin; the male builder never lifts them either.
// - Every other marker must sit on skin the viewer sees (the male open-air
//   rule of tests/data.test.mjs), tested along its face's outward normal. A
//   closed carried marker moves to the nearest open-air point within 10 mm on
//   a face that agrees with its carried direction; any that cannot is listed.
// Gates: tests/female-acupoints.test.mjs.
// Writes public/models/acupoint-anchors-female.json.
// Usage: node scripts/build-female-anchors.mjs
import fs from "node:fs";
import { CACHE, loadScene, meshOf, frontHit, openAir, sceneHashes, Vector3, Raycaster } from "./female-acupoints/scene.mjs";
import { ruleTarget, ruleLevel, medianX } from "./female-acupoints/rules.mjs";
import { PARTS } from "./female-acupoints/landmarks.mjs";
const scene = loadScene("female"), mesh = meshOf(scene, "HRAF0003"), g = mesh.geometry, ray = new Raycaster();
const breastFat = meshOf(scene, ["HRAF0004", "HRAF0012"]);
const anchors = JSON.parse(fs.readFileSync("data/anchors.json", "utf8"));
const rays = new Float32Array(fs.readFileSync(`${CACHE}/out/anchor-rays.bin`).buffer.slice(0));
const landmarks = JSON.parse(fs.readFileSync("data/female-acupoint-landmarks.json", "utf8")), L = landmarks.female;
const rules = JSON.parse(fs.readFileSync("data/female-acupoint-rules.json", "utf8"));
const hashes = sceneHashes("female");
for (const [file, sha] of Object.entries(landmarks.scenes.female.sha256))
  if (hashes[file] !== sha) throw Error(`female scene ${file} changed since the landmarks were measured; rerun node scripts/female-acupoints/landmarks.mjs`);
// A rule with "hold" stays on the carried marker (a failed gate is recorded there, not hidden).
const ruleOf = new Map(rules.rules.filter((r) => !r.hold).map((r) => [r.pointId, r]));
const RANGE = 0.12, OPEN_AIR_MOVE_MAX = 0.010, BREAST_MM = 12;
const round = (v) => +v.toFixed(5), mm2 = (v) => +(v * 1000).toFixed(2), out = [];
const degrees = (a, b) => +((Math.acos(Math.max(-1, Math.min(1, a.dot(b) / a.length() / b.length()))) * 180) / Math.PI).toFixed(0);

const P = g.attributes.position.array, I = g.index.array, A = new Vector3(), B = new Vector3(), C = new Vector3();
const corner = (k, j, v) => v.set(P[I[k * 3 + j] * 3], P[I[k * 3 + j] * 3 + 1], P[I[k * 3 + j] * 3 + 2]);
// HRAF0003 is one closed shell wound outward, so a face's winding normal is its outward side.
const windingNormal = (k) => { corner(k, 0, A); corner(k, 1, B); corner(k, 2, C); return B.clone().sub(A).cross(C.clone().sub(A)).normalize(); };

/** Skin crossings within RANGE either way from o along dir: the nearest one, and the nearest whose outward face normal agrees with dir. */
function facingHit(o, dir) {
  let nearest = null, facing = null;
  for (const s of [1, -1]) {
    ray.set(o, dir.clone().multiplyScalar(s)); ray.far = RANGE;
    for (const h of ray.intersectObject(mesh)) {   // three-mesh-bvh: face.normal is the winding normal
      if (!nearest || h.distance < nearest.distance) nearest = h;
      if (h.face.normal.dot(dir) > 0 && (!facing || h.distance < facing.distance)) facing = h;
    }
  }
  return { nearest, facing };
}
/** The carried marker's skin point (see the header). */
function carriedSurface(o, d) {
  const { nearest, facing } = facingHit(o, d);
  if (facing) return { surface: facing.point.clone(), normal: facing.face.normal.clone(), method: "field-ray", ...(facing === nearest ? {} : { facingMoveMm: mm2(facing.point.distanceTo(nearest.point)), facingFromMm: mm2(nearest.distance), facingToMm: mm2(facing.distance) }) };
  if (nearest) return {
    surface: nearest.point.clone(), normal: nearest.face.normal.clone(), method: "field-ray",
    facingException: `no skin face toward the carried outward direction within ${RANGE * 1000} mm either way; the nearest crossing (${mm2(nearest.distance)} mm away, its outward normal ${degrees(nearest.face.normal, d)} degrees from the carried direction) is kept, so the marker sits on the opposite side of a body part from the male marker`,
  };
  const t = g.boundsTree.closestPointToPoint(o), n = windingNormal(t.faceIndex);
  return { surface: t.point.clone(), normal: n, method: "field-closest", ...(n.dot(d) > 0 ? {} : { facingException: `no skin crossing within ${RANGE * 1000} mm; the closest skin point faces ${degrees(n, d)} degrees away from the carried direction` }) };
}

const NIPPLE = PARTS.female.nipple;
/** Rule markers: surface point, outward normal and the target the gates check. */
function placeRule(rule, side, carried, d) {
  if (rule.method === "female-landmark-cun" || rule.construction?.type === "lineAtLevel") {
    const t = ruleTarget(rule, L, side), h = frontHit(mesh, t.x, t.y);
    if (!h) throw Error(`${rule.id} ${side}: no skin in front of ${t.x}, ${t.y}`);
    const normal = h.face.normal.clone();
    if (normal.z < 0) normal.negate();
    return { surface: h.point.clone(), normal, target: [t.x, t.y] };
  }
  if (rule.method === "female-landmark-level") {
    const y = ruleLevel(rule, L);
    if (rule.projection === "front") {
      // Keep the carried marker's left-right offset from the anterior median line.
      const x = medianX(L, y) + (carried.surface.x - medianX(L, carried.surface.y)), h = frontHit(mesh, x, y);
      const normal = h.face.normal.clone();
      if (normal.z < 0) normal.negate();
      return { surface: h.point.clone(), normal, target: [x, y] };
    }
    if (rule.projection === "carried-horizontal") {
      // Keep the carried position round the trunk; re-project horizontally along the carried outward direction.
      const origin = new Vector3(carried.surface.x, y, carried.surface.z), dh = new Vector3(d.x, 0, d.z).normalize(), { facing } = facingHit(origin, dh);
      if (!facing) throw Error(`${rule.id} ${side}: no skin facing the carried direction at the rule level`);
      return { surface: facing.point.clone(), normal: facing.face.normal.clone(), target: [origin.x, y, origin.z] };
    }
  }
  if (rule.construction?.type === "nippleOuterCentre") {
    const nipple = meshOf(scene, NIPPLE[side]), p = nipple.geometry.boundsTree.closestPointToPoint(new Vector3(...L.nipples.outerCentre[side])).point;
    return { surface: p, normal: new Vector3(...L.nipples.outerCentre.axis[side]).normalize(), target: L.nipples.outerCentre[side], surfacePart: NIPPLE[side] };
  }
  if (rule.construction?.type === "inframammaryCrease") {
    const c = L.inframammaryCrease[side], p = g.boundsTree.closestPointToPoint(new Vector3(...c.point)).point;
    return { surface: p, normal: new Vector3(...c.normal).normalize(), target: c.point };
  }
  throw Error(`${rule.id}: no placement for method ${rule.method}`);
}

const facingMoved = [], facingExceptions = [], closestNormal = [];
for (const [i, a] of anchors.entries()) {
  const o = new Vector3(rays[i * 6], rays[i * 6 + 1], rays[i * 6 + 2]), d = new Vector3(rays[i * 6 + 3], rays[i * 6 + 4], rays[i * 6 + 5]);
  const carried = carriedSurface(o, d), rule = ruleOf.get(a.pointId);
  let { surface, normal, method } = carried, extra = {};
  if (a.mode === "region-reference") {
    // Inside the mouth or nose: keep the carried point (the app draws markers without depth test).
    surface = o.clone(); normal = d.clone(); method = "field-carried";
    extra = { markerMode: "region-reference", skinDistanceMm: mm2(g.boundsTree.closestPointToPoint(o).distance) };
  } else if (rule) {
    const placed = placeRule(rule, a.side, carried, d);
    surface = placed.surface; normal = placed.normal; method = rule.method;
    extra = { rule: rule.id, landmarks: rule.landmarks, ruleTarget: placed.target.map(round), transportDeltaMm: mm2(surface.distanceTo(carried.surface)), ...(placed.surfacePart ? { surfacePart: placed.surfacePart } : {}) };
  } else {
    if (carried.facingMoveMm !== undefined) { extra = { facingMoveMm: carried.facingMoveMm }; facingMoved.push(`${a.key} ${carried.facingMoveMm} mm (nearest crossing ${carried.facingFromMm} mm -> facing ${carried.facingToMm} mm)`); }
    if (carried.facingException) { extra = { facingException: carried.facingException }; facingExceptions.push(a.key); }
    if (method === "field-closest") closestNormal.push(`${a.key} ${degrees(normal, d)} deg`);
  }
  const position = surface.clone().addScaledVector(normal, a.displayOffset ?? 0.003);
  out.push({ pointId: a.pointId, occurrence: a.occurrence, key: a.key, side: a.side, mode: "female-approximation", method,
    surfacePoint: surface.toArray().map(round), position: position.toArray().map(round), projectionMm: +(surface.distanceTo(o) * 1000).toFixed(2),
    status: "approximate-unreviewed", ...extra });
}

// Open air along each marker's own outward normal (no display-offset turning).
// A closed carried marker may move to sampled points on faces within 10 mm
// whose outward normal agrees with its carried direction.
function nearestOpen(s, d) {
  const cands = [];
  for (let k = 0; k < I.length / 3; k++) {
    corner(k, 0, A); corner(k, 1, B); corner(k, 2, C);
    if (Math.min(A.distanceTo(s), B.distanceTo(s), C.distanceTo(s)) > OPEN_AIR_MOVE_MAX + 0.02) continue;
    const n = windingNormal(k);
    if (n.dot(d) <= 0) continue;
    for (let u = 0; u <= 8; u++) for (let v = 0; v <= 8 - u; v++) {
      const p = A.clone().multiplyScalar(1 - (u + v) / 8).addScaledVector(B, u / 8).addScaledVector(C, v / 8), dist = p.distanceTo(s);
      if (dist <= OPEN_AIR_MOVE_MAX) cands.push({ p, n, dist });
    }
  }
  cands.sort((x, y) => x.dist - y.dist);
  return cands.find((c) => openAir(mesh, c.p, c.n).open) || null;
}
const fixed = [], exceptions = [];
for (const [i, m] of out.entries()) {
  if (m.markerMode === "region-reference") continue;
  const s = new Vector3(...m.surfacePoint), n = new Vector3(...m.position).sub(s).normalize();
  if (openAir(mesh, s, n).open) continue;
  const d = new Vector3(rays[i * 6 + 3], rays[i * 6 + 4], rays[i * 6 + 5]);
  const c = m.rule ? null : nearestOpen(s, d);
  if (!c) { m.openAirException = m.rule ? "rule marker on skin closed off from open air" : "no open-air outer-skin point facing the carried direction within 10 mm"; exceptions.push(m.key); continue; }
  m.surfacePoint = c.p.toArray().map(round); m.position = c.p.clone().addScaledVector(c.n, anchors[i].displayOffset ?? 0.003).toArray().map(round);
  m.projectionMm = +(c.p.distanceTo(new Vector3(rays[i * 6], rays[i * 6 + 1], rays[i * 6 + 2])) * 1000).toFixed(2);
  m.openAirMoveMm = mm2(c.dist);
  fixed.push(`${m.key} ${m.openAirMoveMm} mm`);
}
// Markers on breast skin: within 12 mm of the HRA breast fat, except those placed on the breast's own landmarks (nipple, crease).
const breast = [];
for (const m of out)
  if (m.method !== "female-landmark" && breastFat.geometry.boundsTree.closestPointToPoint(new Vector3(...m.surfacePoint)).distance * 1000 <= BREAST_MM) { m.breastSurface = true; breast.push(m.key); }

fs.writeFileSync("public/models/acupoint-anchors-female.json", JSON.stringify(out) + "\n");
const mm = out.filter((a) => a.method === "field-ray" || a.method === "field-closest").map((a) => a.projectionMm).sort((x, y) => x - y);
const count = (k) => out.filter((a) => a.method === k).length;
console.log("female anchors", out.length, "ray", count("field-ray"), "closest", count("field-closest"), "cun", count("female-landmark-cun"), "level", count("female-landmark-level"),
  "landmark", count("female-landmark"), "carried", count("field-carried"), "projection median", mm[mm.length >> 1], "mm p90", mm[Math.floor(mm.length * 0.9)]);
const delta = out.filter((a) => a.transportDeltaMm !== undefined).map((a) => a.transportDeltaMm).sort((x, y) => x - y);
if (delta.length) console.log("rule markers moved from the carried skin point: median", delta[delta.length >> 1], "mm, max", delta.at(-1));
console.log("facing rule moved", facingMoved.length + ":", facingMoved.join("; "));
console.log("facing exceptions", facingExceptions.length + ":", facingExceptions.join(", "));
console.log("field-closest outward normal vs carried direction:", closestNormal.join(", "));
console.log("open air: moved", fixed.length, fixed.join(", "), "| exceptions", exceptions.length, exceptions.join(", "));
console.log("breast surface", breast.length, breast.join(" "));
