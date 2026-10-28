// Landmarks for the female acupoint rules, measured on the app's own
// world-space geometry by part ID (HRA female, HRAF*/BM*): the abdominal cun
// landmarks (with the same measurements on the male BodyParts3D scene for QA
// only; male markers never move) and, female only, the pelvis, patella,
// nipple-tip and inframammary-crease landmarks of the neighbour, ST31 and
// breast rules. Writes data/female-acupoint-landmarks.json.
// Usage: node scripts/female-acupoints/landmarks.mjs
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { loadScene, meshOf, frontHit, vertices, part, sceneHashes, sceneDir, planeContours, meanNormal, Vector3, Raycaster } from "./scene.mjs";

export const PARTS = {
  female: {
    skin: "HRAF0003", umbilicusArea: "HRAF0000", sternum: ["HRAF0823"], manubrium: "HRAF0824",
    pubis: { right: "HRAF0958", left: "HRAF0959" }, nipple: { right: "HRAF0014", left: "HRAF0006" },
    clavicle: { right: "BM0113", left: "BM0070" }, costalCartilage7: { right: "BM0056", left: "BM0040" },
    ilium: { right: "HRAF0827", left: "HRAF0828" }, patella: { right: "HRAF0929", left: "HRAF0953" },
    breastFat: { right: "HRAF0012", left: "HRAF0004" }, rib11: { right: "BM0042", left: "BM0023" },
  },
  male: {
    skin: "FMA7163", sternum: ["FMA7487", "FMA7488"], sternalBody: "FMA7487", xiphoid: "FMA7488", manubrium: "FMA7486",
    pubis: { right: "FMA16586", left: "FMA16587" }, nipple: null,
    clavicle: { right: "FMA13322", left: "FMA13323" }, costalCartilage7: { right: "FMA8248", left: "FMA8275" },
  },
};
const r5 = (v) => +v.toFixed(5), r1 = (v) => +v.toFixed(1), mm = (v) => r1(v * 1000);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

/** Area-weighted centroid of a part's triangles. */
function surfaceCentroid(scene, name) {
  const { pos, idx } = part(scene, name); const c = [0, 0, 0]; let w = 0;
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 3, b = idx[k + 1] * 3, d = idx[k + 2] * 3;
    const u = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], v = [pos[d] - pos[a], pos[d + 1] - pos[a + 1], pos[d + 2] - pos[a + 2]];
    const area = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    for (let i = 0; i < 3; i++) c[i] += area * (pos[a + i] + pos[b + i] + pos[d + i]) / 3;
    w += area;
  }
  return c.map((s) => s / w);
}

/** Anterior median line at level y: the x about which the frontal skin profile is mirror-symmetric. */
function mirrorMidline(skin, y) {
  const X0 = -0.16, STEP = 0.001, N = 321, z = [];
  for (let i = 0; i < N; i++) { const h = frontHit(skin, X0 + i * STEP, y); z.push(h ? h.point.z : NaN); }
  const at = (x) => { const f = (x - X0) / STEP, i = Math.floor(f); if (i < 0 || i + 1 >= N) return NaN; return z[i] + (z[i + 1] - z[i]) * (f - i); };
  let best = null;
  for (let s = -0.02; s <= 0.02 + 1e-9; s += 0.0001) {
    let e = 0, n = 0;
    for (let t = 0.01; t <= 0.12 + 1e-9; t += 0.001) { const a = at(s + t), b = at(s - t); if (Number.isFinite(a) && Number.isFinite(b)) { e += (a - b) ** 2; n++; } }
    if (n >= 100 && (!best || e / n < best.e)) best = { s, e: e / n, n };
  }
  return { x: best.s, rmsMm: Math.sqrt(best.e) * 1000 };
}

/** Depth map of the frontal skin (z below the mean of a (2W+1)-cell window) on a grid; returns the deepest cell. */
function pitMap(skin, x0, x1, y0, y1, step, W) {
  const nx = Math.round((x1 - x0) / step) + 1, ny = Math.round((y1 - y0) / step) + 1, Z = [];
  for (let j = 0; j < ny; j++) { const row = []; for (let i = 0; i < nx; i++) { const h = frontHit(skin, x0 + i * step, y0 + j * step); row.push(h ? h.point.z : NaN); } Z.push(row); }
  const cells = []; let best = null;
  for (let j = W; j < ny - W; j++) for (let i = W; i < nx - W; i++) {
    let s = 0, c = 0;
    for (let b = -W; b <= W; b++) for (let a = -W; a <= W; a++) { const v = Z[j + b][i + a]; if (Number.isFinite(v)) { s += v; c++; } }
    const d = s / c - Z[j][i], cell = { d, x: x0 + i * step, y: y0 + j * step };
    cells.push(cell); if (!best || d > best.d) best = cell;
  }
  return { best, cells };
}
/** Navel: deepest frontal skin pit near the midline between the pubis and the sternum (coarse 2 mm scan, then 1 mm). */
function navel(skin, yPubic, yXs) {
  const L = yXs - yPubic, coarse = pitMap(skin, -0.03, 0.03, yPubic + 0.25 * L, yPubic + 0.75 * L, 0.002, 5).best;
  const { best, cells } = pitMap(skin, coarse.x - 0.03, coarse.x + 0.03, coarse.y - 0.03, coarse.y + 0.03, 0.001, 10);
  let sx = 0, sy = 0, sw = 0;
  for (const c of cells) if (Math.hypot(c.x - best.x, c.y - best.y) < 0.008 && c.d > 0.5 * best.d) { const w = c.d - 0.5 * best.d; sx += w * c.x; sy += w * c.y; sw += w; }
  const x = sx / sw, y = sy / sw, h = frontHit(skin, x, y);
  return { point: [x, y, h.point.z], deepest: [best.x, best.y], depthMm: best.d * 1000, coarse: [coarse.x, coarse.y] };
}

/** Xiphisternal junction: the largest 5 mm step in sternal width within 4 cm of the sternum's lower end. */
function xiphisternal(scene, names) {
  const V = vertices(scene, names), y0 = Math.min(...V.map((v) => v[1]));
  const ys = [], w = [], xm = [];
  for (let k = 1; k * 0.0025 < 0.04; k++) {
    const y = y0 + k * 0.0025, sl = V.filter((v) => Math.abs(v[1] - y) < 0.0025);
    const xs = sl.map((v) => v[0]); ys.push(y); w.push(Math.max(...xs) - Math.min(...xs)); xm.push((Math.max(...xs) + Math.min(...xs)) / 2);
  }
  const steps = w.slice(0, -2).map((v, k) => w[k + 2] - v), k = steps.indexOf(Math.max(...steps));
  const order = steps.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
  const y = (ys[k] + ys[k + 2]) / 2, slab = V.filter((v) => Math.abs(v[1] - y) < 0.0025);
  const x = (Math.max(...slab.map((v) => v[0])) + Math.min(...slab.map((v) => v[0]))) / 2;
  return {
    y, x, sternumLowestY: y0, stepMm: steps[k] * 1000,
    secondStep: { y: (ys[order[1][1]] + ys[order[1][1] + 2]) / 2, stepMm: order[1][0] * 1000 },
    widthProfile: ys.map((yy, i) => [r5(yy), mm(w[i])]),
  };
}

/** Superior border of the pubic symphysis: per side, the highest pubis vertex within 6 mm of its own medial face. */
function pubicSuperior(scene, pubis) {
  const side = {};
  for (const [s, name] of Object.entries(pubis)) {
    const V = vertices(scene, name), medial = s === "right" ? Math.max(...V.map((v) => v[0])) : Math.min(...V.map((v) => v[0]));
    const top = V.filter((v) => Math.abs(v[0] - medial) < 0.006).reduce((a, v) => (v[1] > a[1] ? v : a));
    side[s] = { part: name, medialX: medial, top };
  }
  const x = (side.right.medialX + side.left.medialX) / 2, y = (side.right.top[1] + side.left.top[1]) / 2;
  return { x, y, side, asymmetryMm: Math.abs(side.right.top[1] - side.left.top[1]) * 1000 };
}

/** Inferior border of the pubic symphysis: per side, the lowest pubis vertex within 6 mm of its own medial face. */
function pubicInferior(scene, pubis) {
  const side = {};
  for (const [s, name] of Object.entries(pubis)) {
    const V = vertices(scene, name), medial = s === "right" ? Math.max(...V.map((v) => v[0])) : Math.min(...V.map((v) => v[0]));
    const low = V.filter((v) => Math.abs(v[0] - medial) < 0.006).reduce((a, v) => (v[1] < a[1] ? v : a));
    side[s] = { part: name, medialX: medial, low };
  }
  return { x: (side.right.medialX + side.left.medialX) / 2, y: (side.right.low[1] + side.left.low[1]) / 2, side, asymmetryMm: Math.abs(side.right.low[1] - side.left.low[1]) * 1000 };
}

const LATERAL = { right: -1, left: 1 }, DEG = Math.PI / 180;
const dot3 = (v, d) => v[0] * d[0] + v[1] * d[1] + v[2] * d[2];
/** The vertex furthest along direction d. */
const support = (V, d) => V.reduce((a, v) => (dot3(v, d) > dot3(a, d) ? v : a));
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** ASIS: per side, the most anterior vertex (+z support point) of the HRA ilium compact bone; the spread to the support points tilted 20 degrees superiorly, medially and laterally shows how sharp that extremum is. */
function asis(scene, ilium) {
  const out = {};
  for (const [s, name] of Object.entries(ilium)) {
    const V = vertices(scene, name), p = support(V, [0, 0, 1]), c = Math.cos(20 * DEG), sn = Math.sin(20 * DEG);
    const alternatives = { superior20: support(V, [0, sn, c]), lateral20: support(V, [LATERAL[s] * sn, 0, c]), medial20: support(V, [-LATERAL[s] * sn, 0, c]) };
    out[s] = { part: name, point: p, alternatives, spreadMm: Math.max(...Object.values(alternatives).map((a) => dist3(a, p))) * 1000 };
  }
  return out;
}

/** Lateral end of the patellar base: per side, the support point of the HRA patella in the frontal-plane superolateral direction (45 degrees); 30/60 degree alternatives. */
function patellaBaseLateral(scene, patella) {
  const out = {}, at = (deg, s) => [LATERAL[s] * Math.cos(deg * DEG), Math.sin(deg * DEG), 0];
  for (const [s, name] of Object.entries(patella)) {
    const V = vertices(scene, name), p = support(V, at(45, s)), alternatives = { deg30: support(V, at(30, s)), deg60: support(V, at(60, s)) };
    out[s] = { part: name, point: p, alternatives, spreadMm: Math.max(...Object.values(alternatives).map((a) => dist3(a, p))) * 1000 };
  }
  return out;
}

/** Nipple centre on its outer surface: the axis through the nipple's area centroid along the mean outward skin normal within 10 mm; the outermost crossing of the nipple part on that axis. */
function nippleOuterCentre(scene, skinName, name, centroid) {
  const c = new Vector3(...centroid), axis = meanNormal(scene, skinName, c, 0.01), ray = new Raycaster();
  ray.set(c.clone().addScaledVector(axis, 0.05), axis.clone().negate()); ray.far = 0.1;
  const h = ray.intersectObject(meshOf(scene, name))[0];
  return { point: h.point.toArray(), axis: axis.toArray(), aboveSkinMm: meshOf(scene, skinName).geometry.boundsTree.closestPointToPoint(h.point).distance * 1000 };
}

/**
 * Inframammary crease on the sagittal plane x = X: from the frontmost skin
 * point within 15 mm of the nipple height, walk the skin cross-section
 * downward for 150 mm; the crease is the point deepest below the anterior
 * convex hull of that walk (the fold where the breast's lower surface meets
 * the chest skin).
 */
function creaseAt(scene, skinName, X, nippleY) {
  let start = null;
  for (const loop of planeContours(scene, skinName, X))
    for (const [j, p] of loop.points.entries()) if (Math.abs(p[0] - nippleY) < 0.015 && (!start || p[1] > start.loop.points[start.j][1])) start = { loop, j };
  const P = start.loop.points, n = P.length, at = (j) => P[((j % n) + n) % n];
  const step = at(start.j + 1)[0] < at(start.j - 1)[0] ? 1 : -1, walk = [];
  for (let k = 0, j = start.j; k < n; k++, j += step) {
    if (!start.loop.closed && (j < 0 || j >= n)) break;
    const p = at(j);
    if (p[0] < nippleY - 0.15) break;
    walk.push(p);
  }
  // Anterior hull: upper envelope of z over y (monotone chain).
  const hull = [];
  for (const p of [...walk].sort((a, b) => a[0] - b[0])) {
    while (hull.length >= 2) { const a = hull[hull.length - 2], b = hull[hull.length - 1]; if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0) hull.pop(); else break; }
    hull.push(p);
  }
  let best = null;
  for (const p of walk) {
    const k = hull.findIndex((h) => h[0] >= p[0]);
    if (k <= 0) continue;
    const a = hull[k - 1], b = hull[k], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const depth = ((a[1] + ((b[1] - a[1]) * (p[0] - a[0])) / (b[0] - a[0]) - p[1]) * (b[0] - a[0])) / len;
    if (!best || depth > best.depth) best = { point: [X, p[0], p[1]], depth };
  }
  return { point: best.point, depthMm: best.depth * 1000, walked: walk.length };
}

function medialEnd(scene, name) { return vertices(scene, name).reduce((a, v) => (Math.abs(v[0]) < Math.abs(a[0]) ? v : a)); }
function clavicleMid(scene, name) { const xs = vertices(scene, name).map((v) => v[0]); return (Math.min(...xs) + Math.max(...xs)) / 2; }

export function measure(sex) {
  const P = PARTS[sex], scene = loadScene(sex), skin = meshOf(scene, P.skin);
  const xs = xiphisternal(scene, P.sternum), pub = pubicSuperior(scene, P.pubis);
  const nav = navel(skin, pub.y, xs.y);
  const out = { parts: P };
  out.navel = {
    point: nav.point.map(r5), parts: [P.skin], depthMm: r1(nav.depthMm), deepestXY: nav.deepest.map(r5),
    method: "Frontal skin z-map (rays travelling -z, first hit = outer face). Coarse: 2 mm grid, |x| <= 30 mm, 25-75% of the way from the pubic symphysis to the xiphisternal junction. Fine: 1 mm grid within 30 mm of the coarse pit. Depth = mean z of the 21 mm window minus z; centre = depth-weighted centroid of the cells deeper than half the maximum within 8 mm of the deepest cell; z = frontal skin hit at that centre.",
  };
  if (P.umbilicusArea) {
    const c = surfaceCentroid(scene, P.umbilicusArea), V = vertices(scene, P.umbilicusArea), vc = [0, 1, 2].map((i) => V.reduce((s, v) => s + v[i], 0) / V.length);
    const xsU = V.map((v) => v[0]), ysU = V.map((v) => v[1]);
    const vDist = Math.hypot(vc[0] - nav.point[0], vc[1] - nav.point[1]) * 1000, aDist = Math.hypot(c[0] - nav.point[0], c[1] - nav.point[1]) * 1000;
    out.navel.crossCheck = {
      part: P.umbilicusArea, sourceName: part(scene, P.umbilicusArea).sourceName, limitMm: 2,
      vertexCentroid: vc.map(r5), vertexCentroidFrontalDistanceMm: r1(vDist), areaCentroid: c.map(r5), areaCentroidFrontalDistanceMm: r1(aDist),
      footprint: { x: [r5(Math.min(...xsU)), r5(Math.max(...xsU))], y: [r5(Math.min(...ysU)), r5(Math.max(...ysU))] },
      passes: vDist <= 2 ? (aDist <= 2 ? "both centroids" : "vertex centroid only") : "neither",
      note: "HRAF0000 is a closed adipose patch around the umbilicus, not a navel point: it reaches further below the navel than above it, so its area (and volume) centroid sits lower than its vertex centroid. The skin pit is the definitional landmark; HRAF0000 is only a coarse cross-check.",
    };
  }
  const xsSkin = frontHit(skin, xs.x, xs.y).point;
  out.xiphisternalJunction = {
    point: [r5(xs.x), r5(xs.y), r5(xsSkin.z)], boneLowestY: r5(xs.sternumLowestY), parts: P.sternum, stepMm: r1(xs.stepMm), secondStep: { y: r5(xs.secondStep.y), stepMm: r1(xs.secondStep.stepMm) },
    method: "Sternum vertices in 5 mm slabs every 2.5 mm over the lowest 4 cm; the junction is the middle of the largest 5 mm increase in left-right width (xiphoid narrower than the sternal body); x = centre of that slab; z = frontal skin hit.",
    widthProfileYWidthMm: xs.widthProfile,
  };
  const cc = Object.fromEntries(Object.entries(P.costalCartilage7).map(([s, n]) => [s, medialEnd(scene, n).map(r5)]));
  out.xiphisternalJunction.costalCartilage7MedialEnds = { parts: P.costalCartilage7, ...cc, meanY: r5((cc.right[1] + cc.left[1]) / 2) };
  if (P.xiphoid) {
    const body = Math.min(...vertices(scene, P.sternalBody).map((v) => v[1])), xi = Math.max(...vertices(scene, P.xiphoid).map((v) => v[1]));
    out.xiphisternalJunction.explicitBoundary = { parts: [P.sternalBody, P.xiphoid], y: r5((body + xi) / 2), sternalBodyLowestY: r5(body), xiphoidHighestY: r5(xi), widthStepErrorMm: mm(xs.y - (body + xi) / 2) };
  }
  const pubSkin = frontHit(skin, pub.x, pub.y).point;
  out.pubicSymphysisSuperior = {
    point: [r5(pub.x), r5(pub.y), r5(pubSkin.z)], parts: Object.values(P.pubis), asymmetryMm: r1(pub.asymmetryMm),
    perSide: Object.fromEntries(Object.entries(pub.side).map(([s, v]) => [s, { part: v.part, medialX: r5(v.medialX), top: v.top.map(r5) }])),
    method: "Per side, the highest pubis vertex within 6 mm of that bone's medial (symphyseal) face; y = mean of the two sides, x = midpoint of the two medial faces; z = frontal skin hit over it.",
  };
  if (P.nipple) {
    const n = Object.fromEntries(Object.entries(P.nipple).map(([s, name]) => [s, surfaceCentroid(scene, name)]));
    out.nipples = {
      parts: P.nipple, right: n.right.map(r5), left: n.left.map(r5), interNippleXMm: mm(n.left[0] - n.right[0]), interNipple3dMm: mm(Math.hypot(n.left[0] - n.right[0], n.left[1] - n.right[1], n.left[2] - n.right[2])), levelDifferenceMm: mm(Math.abs(n.left[1] - n.right[1])),
      method: "Area-weighted centroid of each HRA nipple part; the inter-nipple distance is the left-right (x) separation in the frontal plane, not a path over the skin.",
    };
  }
  const cl = Object.fromEntries(Object.entries(P.clavicle).map(([s, name]) => [s, clavicleMid(scene, name)]));
  out.midclavicularLines = { parts: P.clavicle, right: r5(cl.right), left: r5(cl.left), method: "Midpoint of each clavicle's left-right extent." + (sex === "female" ? " The female clavicles are borrowed male bones carried by the registration field (BM*), not HRA female bones." : "") };
  // Anterior median line: the mirror-symmetry axis of the frontal skin profile, sampled every 5 mm.
  const yLo = Math.floor((pub.y - 0.02) * 200) / 200, yHi = Math.ceil((xs.y + 0.02) * 200) / 200, samples = [];
  for (let y = yLo; y <= yHi + 1e-9; y += 0.005) { const m = mirrorMidline(skin, y); samples.push([r5(y), r5(m.x), +m.rmsMm.toFixed(2)]); }
  const x0At = (y) => { let i = samples.findIndex((s) => s[0] >= y); if (i <= 0) i = Math.max(1, i < 0 ? samples.length - 1 : 1); const [ya, xa] = samples[i - 1], [yb, xb] = samples[i]; return xa + ((xb - xa) * (y - ya)) / (yb - ya); };
  out.anteriorMedianLine = {
    parts: [P.skin], samplesYXRmsMm: samples, medianX: r5(median(samples.map((s) => s[1]))),
    method: "At each level, the x about which the frontal skin profile z(x) (1 mm samples, |x - s| from 10 to 120 mm) is mirror-symmetric (least squares, 0.1 mm search); linear between 5 mm samples.",
    landmarkOffsetsMm: { navel: mm(nav.point[0] - x0At(nav.point[1])), pubicSymphysis: mm(pub.x - x0At(pub.y)), xiphisternalJunction: mm(xs.x - x0At(xs.y)), ...(P.nipple ? { nippleMidpoint: mm((out.nipples.left[0] + out.nipples.right[0]) / 2 - x0At((out.nipples.left[1] + out.nipples.right[1]) / 2)) } : {}) },
  };
  const upper = xs.y - nav.point[1], lower = nav.point[1] - pub.y;
  out.cun = {
    upperAbdomenMm: mm(upper / 8), lowerAbdomenMm: mm(lower / 5), xiphisternalToNavelMm: mm(upper), navelToPubicMm: mm(lower),
    ...(P.nipple ? { lateralMm: mm((out.nipples.left[0] - out.nipples.right[0]) / 8) } : {}),
    lateralMidclavicularMm: mm((cl.left - cl.right) / 8),
  };
  if (P.ilium) measurePelvisAndBreast(scene, P, skin, out);
  return out;
}

/** Female-only landmarks for the neighbour, thigh and breast rules (round 2). */
function measurePelvisAndBreast(scene, P, skin, out) {
  const v5 = (v) => v.map(r5), sides = ["right", "left"];
  const inf = pubicInferior(scene, P.pubis), infSkin = frontHit(skin, inf.x, inf.y).point;
  out.pubicSymphysisInferior = {
    point: [r5(inf.x), r5(inf.y), r5(infSkin.z)], parts: Object.values(P.pubis), asymmetryMm: r1(inf.asymmetryMm),
    perSide: Object.fromEntries(Object.entries(inf.side).map(([s, v]) => [s, { part: v.part, medialX: r5(v.medialX), low: v5(v.low) }])),
    method: "Per side, the lowest pubis vertex within 6 mm of that bone's medial (symphyseal) face; y = mean of the two sides, x = midpoint of the two medial faces; z = frontal skin hit. The HRA model has no interpubic disc, so this is the lower end of the facing bony surfaces.",
  };
  const A = asis(scene, P.ilium);
  out.asis = {
    parts: P.ilium, right: v5(A.right.point), left: v5(A.left.point),
    spreadMm: { right: r1(A.right.spreadMm), left: r1(A.left.spreadMm) },
    alternatives: Object.fromEntries(sides.map((s) => [s, Object.fromEntries(Object.entries(A[s].alternatives).map(([k, v]) => [k, v5(v)]))])),
    skinDepthMm: Object.fromEntries(sides.map((s) => [s, mm(frontHit(skin, A[s].point[0], A[s].point[1]).point.z - A[s].point[2])])),
    method: "Anterior superior iliac spine: per side, the most anterior vertex (largest z) of the HRA ilium compact bone. spreadMm = largest distance to the support points tilted 20 degrees superiorly, laterally or medially (how sharply the spine stands out).",
  };
  const PB = patellaBaseLateral(scene, P.patella);
  out.patellaBaseLateral = {
    parts: P.patella, right: v5(PB.right.point), left: v5(PB.left.point), spreadMm: { right: r1(PB.right.spreadMm), left: r1(PB.left.spreadMm) },
    alternatives: Object.fromEntries(sides.map((s) => [s, Object.fromEntries(Object.entries(PB[s].alternatives).map(([k, v]) => [k, v5(v)]))])),
    method: "Lateral end of the base (superior border) of the HRA patella: per side, the vertex furthest in the frontal-plane superolateral direction (45 degrees between lateral and superior). Alternatives at 30 and 60 degrees.",
  };
  const tips = Object.fromEntries(sides.map((s) => [s, nippleOuterCentre(scene, P.skin, P.nipple[s], out.nipples[s])]));
  out.nipples.outerCentre = {
    parts: P.nipple, right: v5(tips.right.point), left: v5(tips.left.point),
    axis: { right: tips.right.axis.map((v) => +v.toFixed(4)), left: tips.left.axis.map((v) => +v.toFixed(4)) },
    aboveSkinMm: { right: r1(tips.right.aboveSkinMm), left: r1(tips.left.aboveSkinMm) },
    method: "Centre of the nipple on its outer surface: the axis through the nipple's area centroid along the area-weighted mean outward normal of the HRAF0003 skin faces within 10 mm; the outermost crossing of the nipple part on that axis.",
  };
  const fat = Object.fromEntries(sides.map((s) => [s, meshOf(scene, P.breastFat[s])]));
  const fatMm = (s, p) => fat[s].geometry.boundsTree.closestPointToPoint(new Vector3(...p)).distance * 1000;
  const crease = {};
  for (const s of sides) {
    const [nx, ny] = out.nipples[s], c = creaseAt(scene, P.skin, nx, ny), p = new Vector3(...c.point);
    const line = [];
    for (let dx = -60; dx <= 35; dx += 5) {
      const q = creaseAt(scene, P.skin, nx + (LATERAL[s] * dx) / 1000, ny);
      line.push([dx, r5(q.point[1]), r5(q.point[2]), r1(q.depthMm), r1(fatMm(s, q.point))]);
    }
    const valid = line.filter((q) => q[4] <= 20), lowest = valid.reduce((a, q) => (q[1] < a[1] ? q : a));
    const nearby = [-2, 2].map((dx) => creaseAt(scene, P.skin, nx + dx / 1000, ny).point);
    crease[s] = {
      point: v5(c.point), normal: meanNormal(scene, P.skin, p, 0.005).toArray().map((v) => +v.toFixed(4)), depthMm: r1(c.depthMm),
      onSkinMm: +(skin.geometry.boundsTree.closestPointToPoint(p).distance * 1000).toFixed(3), breastFatDistanceMm: r1(fatMm(s, c.point)),
      belowNippleMm: mm(ny - c.point[1]), stabilityMm: r1(Math.max(...nearby.map((q) => dist3(q, c.point))) * 1000),
      lowestOnCrease: { lateralOffsetMm: lowest[0], y: lowest[1], z: lowest[2], higherThanLowestMm: mm(c.point[1] - lowest[1]) },
      lineLateralMmYZDepthFat: line,
    };
  }
  out.inframammaryCrease = {
    parts: [P.skin, ...Object.values(P.breastFat)], right: crease.right, left: crease.left,
    method: "Sagittal cross-section of the skin HRAF0003 at the nipple's x (the nipple's vertical meridian). From the frontmost skin point within 15 mm of the nipple height, the section is walked downward for 150 mm; the crease is the point deepest below the anterior convex hull of that walk (the fold where the breast's lower surface meets the chest skin). normal = mean outward skin normal within 5 mm. The same construction every 5 mm from 60 mm medial to 35 mm lateral of the nipple traces the crease line (lineLateralMmYZDepthFat: lateral offset, y, z, depth, distance to the breast fat HRAF0004/HRAF0012; samples more than 20 mm from the fat are not crease).",
    choice: "WHO ST18 (females): 'at the midpoint of the inferior crease of the breast'. The crease has no measurable ends on this mesh (it wraps round the side of the chest), so its midpoint is read as the crease point on the nipple's vertical meridian, which is also the 4 B-cun line of the WHO main text (the lateral B-cun is inter-nipple / 8). lowestOnCrease reports the lowest point of the traced crease as the alternative reading.",
  };
  const ribs = Object.fromEntries(sides.map((s) => [s, support(vertices(scene, P.rib11[s]), [0, 0, 1])]));
  out.rib11FreeEnd = {
    parts: P.rib11, right: v5(ribs.right), left: v5(ribs.left),
    method: "Most anterior vertex of the 11th rib. These are borrowed male ribs carried by the registration field (BM*), not HRA female bones; reported for the GB26 check only.",
  };
}

export function build() {
  const female = measure("female"), male = measure("male");
  const nip = female.nipples, x0 = female.anteriorMedianLine.medianX;
  // Mirror the right nipple about the median line: residual = landmark asymmetry.
  const nippleAsym = Math.hypot(2 * x0 - nip.right[0] - nip.left[0], nip.right[1] - nip.left[1], nip.right[2] - nip.left[2]) * 1000;
  female.asymmetry = { nippleMirrorMm: r1(nippleAsym), pubicTopMm: female.pubicSymphysisSuperior.asymmetryMm, symmetryLimitMm: r1(Math.max(5, Math.max(nippleAsym, female.pubicSymphysisSuperior.asymmetryMm) + 3)) };
  // Round 2 landmarks: right-side landmark mirrored about the median line against the left one.
  const mirror = (r, l) => r1(Math.hypot(2 * x0 - r[0] - l[0], r[1] - l[1], r[2] - l[2]) * 1000);
  Object.assign(female.asymmetry, {
    pubicBottomMm: female.pubicSymphysisInferior.asymmetryMm,
    asisMirrorMm: mirror(female.asis.right, female.asis.left),
    patellaBaseMirrorMm: mirror(female.patellaBaseLateral.right, female.patellaBaseLateral.left),
    nippleOuterMirrorMm: mirror(female.nipples.outerCentre.right, female.nipples.outerCentre.left),
    creaseMirrorMm: mirror(female.inframammaryCrease.right.point, female.inframammaryCrease.left.point),
  });
  const xsAlt = female.xiphisternalJunction.costalCartilage7MedialEnds.meanY, maleCcOffset = male.xiphisternalJunction.explicitBoundary.y - male.xiphisternalJunction.costalCartilage7MedialEnds.meanY;
  female.xiphisternalJunction.ambiguity = {
    alternatives: [
      { method: "7th costal cartilage medial ends (borrowed BM0040/BM0056)", y: xsAlt },
      { method: "7th costal cartilage medial ends + the male offset from those ends to the male explicit xiphoid boundary", y: r5(xsAlt + maleCcOffset) },
      { method: "second-largest sternal width step", y: female.xiphisternalJunction.secondStep.y },
    ],
    statedMm: 10,
    note: "HRA 'Sternum' (HRAF0823) includes the xiphoid; there is no separate xiphoid part. On the male scene, where the xiphoid is a separate part, the same width-step rule lands within " + Math.abs(male.xiphisternalJunction.explicitBoundary.widthStepErrorMm) + " mm of the explicit boundary.",
    sensitivity: "1 cm on the junction changes the upper-abdomen cun by " + r1((10 / 8 / (female.cun.xiphisternalToNavelMm / 8)) * 100) + "% and moves CV15 by 8.75 mm, CV14/KI21/ST19 by 7.5 mm.",
  };
  return {
    schema: 1, status: "approximate-unreviewed",
    generatedBy: "scripts/female-acupoints/landmarks.mjs",
    coordinates: "App world space (metres, y up, +z anterior, the body's right side at -x), as dumped by .cache/female-transport/dump-scene.mjs.",
    scenes: { female: { dir: sceneDir("female"), sha256: sceneHashes("female") }, male: { dir: sceneDir("male"), sha256: sceneHashes("male") } },
    female,
    maleQa: { note: "Same measurements on the male BodyParts3D scene for comparison only; male markers are never moved. The male skin has no nipple part.", ...male },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = build();
  fs.writeFileSync("data/female-acupoint-landmarks.json", JSON.stringify(out, null, 1) + "\n");
  const f = out.female;
  console.log("navel", f.navel.point, "depth", f.navel.depthMm, "mm, HRAF0000 vertex/area centroid", f.navel.crossCheck.vertexCentroidFrontalDistanceMm, f.navel.crossCheck.areaCentroidFrontalDistanceMm, "mm");
  console.log("xiphisternal", f.xiphisternalJunction.point, "pubic", f.pubicSymphysisSuperior.point, "nipples", f.nipples.right, f.nipples.left);
  console.log("cun", f.cun, "median line", f.anteriorMedianLine.medianX, f.anteriorMedianLine.landmarkOffsetsMm, "asym", f.asymmetry);
  console.log("male", out.maleQa.navel.point, out.maleQa.xiphisternalJunction.point, out.maleQa.xiphisternalJunction.explicitBoundary, out.maleQa.pubicSymphysisSuperior.point, out.maleQa.cun);
}
