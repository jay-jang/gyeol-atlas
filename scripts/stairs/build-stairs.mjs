// The generated parts of data/movements/stair-ascent.json and stair-descent.json
// (docs/movement-mechanics/stairs/CONSENSUS.md §3, IMPLEMENTATION.md): keyframes, the
// staircase and the EMG phase means, from the Darmstadt stair dataset's grand means.
//   python3 -I scripts/stairs/export-darmstadt.py Data_fully_processed.mat dd-normal.json
//   PATH=<node24>:$PATH node scripts/stairs/build-stairs.mjs dd-normal.json [--write]
// Keyframes: the source's own 100 samples (t = i/99) + the events; the loop seam is removed in late swing; in double
// support the angles are adjusted within ±1 between-subject SD so both feet hold their
// treads. Prints the size of every edit and an engine check; --write replaces the
// generated fields in the data files (the authored text stays).
import fs from "node:fs";
import { interpolate, monotone, sidePose, stairHold, stepTop } from "../../src/movement-figure.ts";

const [, , ddPath, flag] = process.argv;
const dd = JSON.parse(fs.readFileSync(ddPath, "utf8"));
const JOINTS = ["hip", "knee", "ankle"]; // hip = thigh to vertical (−Athi)
const FIELD = { hip: "thigh", knee: "knee", ankle: "ankle" };
const SEG = { thigh: 0.39, shank: 0.37, mtp: { x: 0.113, y: -0.05 } };
const rad = (v) => (v * Math.PI) / 180;
const dirv = (phi) => ({ x: Math.sin(rad(phi)), y: Math.cos(rad(phi)) });
const rot = (p, deg) => { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return { x: p.x * c + p.y * s, y: -p.x * s + p.y * c }; };
const smooth = (v) => { const x = Math.min(Math.max(v, 0), 1); return x * x * (3 - 2 * x); };
// MTP from the hip at (0,0), pelvis upright (same chain as legFromHip).
const mtp = ([hip, knee, ankle]) => {
  const thigh = -hip, shank = thigh + knee;
  const k = { x: -dirv(thigh).x * SEG.thigh, y: -dirv(thigh).y * SEG.thigh };
  const a = { x: k.x - dirv(shank).x * SEG.shank, y: k.y - dirv(shank).y * SEG.shank };
  const m = rot(SEG.mtp, shank - ankle);
  return { x: a.x + m.x, y: a.y + m.y };
};

const CONFIG = [
  { slug: "stair-ascent", stride: "A5", direction: "up", stanceEnd: 0.641, fromEdge: 0.185, trunk: 15,
    events: [[0, "오른발 닿기"], [0.141, "반대발 떼기(도식 14.1% · DD 계산 13.5%)"], [0.4237, "E1 체중심 상승 멈춤(DD 계산 42.4%)"], [0.5, "반대발 닿기(도식 50% · DD 계산 49.8%)"], [0.641, "오른발 떼기(Grimmer 2020 64.1%)"], [0.859, "유각 무릎 최대 굽힘(DD 계산 85.9%)"]] },
  { slug: "stair-descent", stride: "D6", direction: "down", stanceEnd: 0.652, fromEdge: 0.08, trunk: 6,
    events: [[0, "오른발 닿기"], [0.152, "반대발 떼기(도식 15.2% · DD 계산 14.3%)"], [0.2323, "E1 하강이 다시 빨라짐(DD 계산 23.2%)"], [0.5, "반대발 닿기(도식 50% · DD 계산 49.7%)"], [0.652, "오른발 떼기(Grimmer 2020 65.2%)"], [0.687, "유각 무릎 최대 굽힘(DD 계산 68.7%)"]] },
];
const TAPER = 0.08;
// Double-support adjustment bound in SD; the margin under 1 SD leaves room for the
// 0.1° rounding of the stored angles.
const CORR_LIMIT = 0.97;
// Extra keyframes inside the double-support edit windows (cycle share), so the drawing follows
// the edited curve between the source samples instead of a cubic through sparse edited points.
const DENSE = 1 / 400;
const HEEL_PITCH = -3; // heel 0.166 m behind the joint: -3.45° puts it on the tread

function build(cfg) {
  const s = dd[cfg.stride];
  const at = (arr, tau) => { const x = Math.min(Math.max(tau, 0), 1) * 99, i = Math.floor(x), f = x - i; return arr[i] * (1 - f) + arr[Math.min(i + 1, 99)] * f; };
  // The source curve between its 100 samples is the same monotone cubic the drawing uses, so an
  // unedited stretch of the drawing is the source curve itself.
  const xs = Array.from({ length: 100 }, (_, i) => i / 99);
  const src = (tau) => JOINTS.map((j) => monotone(xs, s[FIELD[j]].mean, ((tau % 1) + 1) % 1, false));
  const sd = (tau) => JOINTS.map((j) => at(s[FIELD[j]].sd, ((tau % 1) + 1) % 1));
  // 1. Loop seam: remove end − start smoothly from the swing knee peak to the next contact.
  const seamStart = cfg.events.find(([, e]) => e.startsWith("유각 무릎"))[0];
  // The named event times must be the data's: swing knee peak (sample) and E1.
  const knee = s.knee.mean, iTO = Math.ceil(cfg.stanceEnd * 99);
  const iMax = knee.indexOf(Math.max(...knee.slice(iTO))) ;
  if (Math.abs(iMax / 99 - seamStart) > 0.006) throw new Error(`${cfg.slug} knee peak ${iMax / 99}`);
  const vy = s.CoM_Vy.mean, e1 = cfg.events.find(([, e]) => e.startsWith("E1"))[0];
  const lo = Math.ceil((cfg.stanceEnd - 0.5) * 99), hi = Math.floor(0.5 * 99);
  let e1data;
  if (cfg.direction === "up") { for (let i = lo; i < hi; i++) if (vy[i] > 0 && vy[i + 1] <= 0) { e1data = (i + vy[i] / (vy[i] - vy[i + 1])) / 99; break; } }
  else { let b = lo; for (let i = lo; i <= hi; i++) if (vy[i] > vy[b]) b = i; e1data = b / 99; }
  if (Math.abs(e1data - e1) > 5e-4) throw new Error(`${cfg.slug} E1 ${e1data}`);
  const gap = JOINTS.map((j) => s[FIELD[j]].mean[99] - s[FIELD[j]].mean[0]);
  const seam = (tau) => { const x = ((tau % 1) + 1) % 1; const f = x <= seamStart ? 0 : smooth((x - seamStart) / (1 - seamStart)); return gap.map((g) => -g * f); };
  const base = (tau) => src(tau).map((v, i) => v + seam(tau)[i]);
  // 2. Double support: right leading at tau, the same curve half a cycle later trailing.
  const dsEnd = cfg.stanceEnd - 0.5, dir = cfg.direction === "up" ? 1 : -1;
  const target = { x: 0.29, y: dir * 0.17 };
  const taus = []; for (let j = 0; j / 100 <= dsEnd + 1e-9; j++) taus.push(j / 100);
  taus.push(dsEnd);
  const n = taus.length;
  const SDs = taus.map((t) => [...sd(t), ...sd(t + 0.5)]);
  const A0 = taus.map((t) => [...base(t), ...base(t + 0.5)]);
  const err = (t, z) => { const a = A0[t].map((v, i) => v + z[i] * SDs[t][i]); const L = mtp(a.slice(0, 3)), T = mtp(a.slice(3)); return [L.x - T.x - target.x, L.y - T.y - target.y]; };
  // Objective: contact gap (cm²) + small size + smoothness in time; |z| ≤ 1 (z = delta / SD).
  let Z = taus.map(() => [0, 0, 0, 0, 0, 0]);
  // A foot on its tread keeps its heel out of it: toe-up pitch at most HEEL_PITCH.
  const pitch = (a) => -a[0] + a[1] - a[2];
  const heel = (t, z) => { const a = A0[t].map((v, i) => v + z[i] * SDs[t][i]); return [pitch(a.slice(0, 3)), pitch(a.slice(3))].reduce((o, p) => o + Math.max(0, HEEL_PITCH - p) ** 2, 0); };
  const obj = (Z) => { let o = 0; for (let t = 0; t < n; t++) { const e = err(t, Z[t]); o += 1e4 * (e[0] ** 2 + e[1] ** 2) + 0.02 * Z[t].reduce((a, v) => a + v * v, 0) + 10 * heel(t, Z[t]); if (t) o += 0.5 * Z[t].reduce((a, v, i) => a + (v - Z[t - 1][i]) ** 2, 0); } return o; };
  let step = 0.05;
  let cur = obj(Z);
  for (let it = 0; it < 3000; it++) {
    const G = Z.map((zt, t) => zt.map((_, i) => { const Zp = Z.map((r) => r.slice()); Zp[t][i] += 1e-4; return (obj(Zp) - cur) / 1e-4; }));
    const next = Z.map((zt, t) => zt.map((v, i) => Math.max(-CORR_LIMIT, Math.min(CORR_LIMIT, v - step * G[t][i]))));
    const o = obj(next);
    if (o < cur) { Z = next; cur = o; step *= 1.1; } else step *= 0.5;
    if (step < 1e-7) break;
  }
  // Correction (degrees) at any curve time: the lead part around [0, dsEnd], the trail part around [0.5, stanceEnd].
  const lerpZ = (t, part) => {
    const k = taus.findIndex((x) => x >= t - 1e-9);
    const z = (i) => Z[i].slice(part * 3, part * 3 + 3).map((v, j) => v * SDs[i][part * 3 + j]);
    if (k <= 0) return z(0);
    if (k < 0 || t > taus[n - 1]) return z(n - 1);
    const f = (t - taus[k - 1]) / (taus[k] - taus[k - 1]);
    return z(k - 1).map((v, j) => v + (z(k)[j] - v) * f);
  };
  const corr = (tau) => {
    let x = ((tau % 1) + 1) % 1;
    const add = [0, 0, 0];
    const window = (u, part) => {
      // u: time relative to the window start (0 … dsEnd), tapered outside.
      if (u >= -TAPER && u < 0) return lerpZ(0, part).map((v) => v * smooth((u + TAPER) / TAPER));
      if (u >= 0 && u <= dsEnd) return lerpZ(u, part);
      if (u > dsEnd && u <= dsEnd + TAPER) return lerpZ(dsEnd, part).map((v) => v * (1 - smooth((u - dsEnd) / TAPER)));
      return [0, 0, 0];
    };
    const lead = window(x > 0.5 ? x - 1 : x, 0), trail = window(x - 0.5, 1);
    for (let i = 0; i < 3; i++) add[i] = lead[i] + trail[i];
    return add;
  };
  // Never more than CORR_LIMIT SD at any time (samples are interpolated between the solved points).
  const corrSD = (tau) => corr(tau).map((v, i) => Math.max(-CORR_LIMIT * sd(tau)[i], Math.min(CORR_LIMIT * sd(tau)[i], v)));
  const model = (tau) => base(tau).map((v, i) => v + corrSD(tau)[i]);
  // 3. Keyframes at the source samples (the last one, 100%, is the next cycle's start), the events,
  // and every DENSE inside the double-support edit windows (away from existing keyframes).
  const times = new Map();
  for (let i = 0; i < 99; i++) times.set((i / 99).toFixed(6), null);
  for (const [t, e] of cfg.events) times.set(t.toFixed(6), e);
  const inEdit = (t) => { const w = (u) => u >= -TAPER - 1e-9 && u <= dsEnd + TAPER + 1e-9; return w(t > 0.5 ? t - 1 : t) || w(t - 0.5); };
  for (let k = 0; k < 1 / DENSE; k++) {
    const t = k * DENSE;
    if (inEdit(t) && [...times.keys()].every((x) => Math.abs(Number(x) - t) > DENSE / 3)) times.set(t.toFixed(6), null);
  }
  const r1 = (v) => Math.round(v * 10) / 10 + 0;
  const keyframes = [...times.keys()].map(Number).sort((a, b) => a - b).map((t) => {
    const e = times.get(t.toFixed(6));
    const m = model(t), o = src(t), d = sd(t);
    const kf = { t, ...(e ? { event: e } : {}), angles: { hip: r1(m[0]), knee: r1(m[1]), ankle: r1(m[2]), trunk: cfg.trunk }, sources: ["darmstadt-stairs"] };
    if (t === 0) kf.note = "12명 총평균입니다. 엉덩관절은 넙다리와 수직선 사이 각(넙다리 분절각)이고, 골반 기준 엉덩관절 각은 관절 대표값 표에 따로 적었습니다. 몸통은 편집 근사입니다.";
    // The trunk is an edited constant, not a measured angle: it is left out of `measured`.
    if (m.some((v, i) => Math.abs(v - o[i]) >= 0.05)) kf.measured = { angles: { hip: r1(o[0]), knee: r1(o[1]), ankle: r1(o[2]) }, sd: { hip: r1(d[0]), knee: r1(d[1]), ankle: r1(d[2]) } };
    return kf;
  });
  // Report: edits in SD units.
  let maxCorr = 0, maxSeam = 0, maxAll = 0, maxAllAt = "";
  for (let j = 0; j <= 1000; j++) {
    const t = j / 1000, d = sd(t), c = corrSD(t), sm = seam(t);
    for (let i = 0; i < 3; i++) {
      maxCorr = Math.max(maxCorr, Math.abs(c[i]) / d[i]); maxSeam = Math.max(maxSeam, Math.abs(sm[i]) / d[i]);
      if (Math.abs(c[i] + sm[i]) / d[i] > maxAll) { maxAll = Math.abs(c[i] + sm[i]) / d[i]; maxAllAt = `${JOINTS[i]} ${(t * 100).toFixed(1)}%`; }
    }
  }
  const residual = taus.map((_, t) => Math.hypot(...err(t, Z[t])) * 100);
  // The double-support misfit before any adjustment (seam already removed), for the limitations text.
  const before = taus.map((_, t) => Math.hypot(...err(t, [0, 0, 0, 0, 0, 0])) * 100);
  return { keyframes, src, sd, seamStart, report: { seamGap: gap.map((g) => +g.toFixed(2)), maxCorrSD: +maxCorr.toFixed(3), maxSeamSD: +maxSeam.toFixed(3), maxEditSD: +maxAll.toFixed(3), maxEditAt: maxAllAt, dsResidualCm: +Math.max(...residual).toFixed(2), uncorrectedGapCm: [+Math.min(...before).toFixed(2), +Math.max(...before).toFixed(2)], zMax: +Math.max(...Z.flat().map(Math.abs)).toFixed(3) } };
}

// Engine check on the final keyframes (0.1% steps): stance contact, penetration of the foot
// outline, distance of a standing foot from the risers of its tread, toes at contact, and the
// drawn (interpolated) angles against the source curve in SD.
function check(cfg, keyframes, src, sd, seamStart) {
  const stairs = { direction: cfg.direction, rise: 0.17, going: 0.29, stanceEnd: cfg.stanceEnd, fromEdge: cfg.fromEdge, sources: [] };
  const m = { slug: cfg.slug, view: "side", loop: true, keyframes, stairs };
  let worstStance = 0, worstDouble = 0, minClear = Infinity, minClearAt = 0, minSwing = Infinity, minSwingAt = 0, minRiser = Infinity, minRiserAt = "";
  const dsEnd = cfg.stanceEnd - 0.5;
  const dev = { edit: [0, ""], seam: [0, ""], other: [0, ""] };
  for (let j = 0; j < 1000; j++) {
    const t = j / 1000, p = sidePose(m, t);
    const rS = t < cfg.stanceEnd, lS = (t + 0.5) % 1 < cfg.stanceEnd;
    const hold = (k) => { const h = stairHold(stairs, k); return { x: h.x + p.steps.origin.x, y: h.y + p.steps.origin.y }; };
    const off = (leg, h) => Math.hypot(leg.mtp.x - h.x, leg.mtp.y - h.y);
    const dR = off(p.right, hold(0)), dL = off(p.left, hold(t < 0.5 ? -1 : 1));
    if (rS && lS) worstDouble = Math.max(worstDouble, dR, dL); else if (rS) worstStance = Math.max(worstStance, dR); else if (lS) worstStance = Math.max(worstStance, dL);
    // Risers bounding the tread a standing foot is on (vertical segments at both tread ends).
    const dirY = cfg.direction === "up" ? 1 : -1;
    for (const [leg, stance, k] of [[p.right, rS, 0], [p.left, lS, t < 0.5 ? -1 : 1]]) {
      if (!stance) continue;
      const x0 = p.steps.origin.x + k * 0.29, y0 = p.steps.origin.y + dirY * k * 0.17;
      const segs = [[x0, y0, y0 - dirY * 0.17], [x0 + 0.29, y0, y0 + dirY * 0.17]];
      for (const q of [leg.heel, leg.toe, leg.mtp]) for (const [sx, ya, yb] of segs) {
        const yc = Math.min(Math.max(q.y, Math.min(ya, yb)), Math.max(ya, yb)), d = Math.hypot(q.x - sx, q.y - yc);
        if (d < minRiser) { minRiser = d; minRiserAt = `${(t * 100).toFixed(1)}% ${leg === p.right ? "right" : "left"} ${q === leg.heel ? "heel" : q === leg.toe ? "toe" : "mtp"}`; }
      }
    }

    for (const [leg, stance] of [[p.right, rS], [p.left, lS]]) {
      const pts = [];
      const seg = (a, b) => { for (let k = 0; k <= 10; k++) pts.push({ x: a.x + (b.x - a.x) * k / 10, y: a.y + (b.y - a.y) * k / 10 }); };
      seg(leg.heel, leg.mtp); seg(leg.mtp, leg.toe); seg(leg.ankle, leg.heel); seg(leg.ankle, leg.mtp);
      const clear = Math.min(...pts.map((q) => q.y - stepTop(p.steps, q.x)));
      if (clear < minClear) { minClear = clear; minClearAt = t; }
      if (!stance && clear < minSwing) { minSwing = clear; minSwingAt = t; }
    }
  }
  // The final drawn (interpolated) angles against the source curve, in SD, every 0.01 % of the
  // cycle: double-support edit windows, the seam, elsewhere (rounding and interpolation only).
  const inWindow = (u) => u >= -TAPER - 1e-9 && u <= dsEnd + TAPER + 1e-9;
  for (let i = 0; i < 10000; i++) {
    const t = i / 10000, a = interpolate(keyframes, t, true), o = src(t), d = sd(t);
    const zone = t >= seamStart ? "seam" : inWindow(t > 0.5 ? t - 1 : t) || inWindow(t - 0.5) ? "edit" : "other";
    ["hip", "knee", "ankle"].forEach((jn, k) => { const z = Math.abs(a[jn] - o[k]) / d[k]; if (z > dev[zone][0]) dev[zone] = [z, `${jn} ${(t * 100).toFixed(1)}%`]; });
  }
  // Toes at contact: the drawing just before and at each foot's contact (right at 0, left at 0.5).
  const toeJump = (t0, side) => { const a = sidePose(m, (t0 + 1 - 1e-7) % 1)[side].toe, b = sidePose(m, t0)[side].toe; return Math.hypot(a.x - b.x, a.y - b.y) * 100; };
  const fmt = ([z, at]) => `${z.toFixed(3)} SD (${at})`;
  if (dev.edit[0] > 1) throw new Error(`${cfg.slug}: drawn angles ${fmt(dev.edit)} from the source in the double-support windows`);
  return { keyframes: keyframes.length, stanceOffCm: +(worstStance * 100).toFixed(2), doubleOffCm: +(worstDouble * 100).toFixed(2), minClearCm: +(minClear * 100).toFixed(2), minClearAt, minSwingCm: +(minSwing * 100).toFixed(2), minSwingAt,
    minRiserCm: +(minRiser * 100).toFixed(2), minRiserAt, toeJumpCm: [+toeJump(0, "right").toFixed(3), +toeJump(0.5, "left").toFixed(3)],
    drawnVsSourceSD: { edit: fmt(dev.edit), seam: fmt(dev.seam), elsewhere: fmt(dev.other) } };
}

// EMG: mean of the grand-mean envelope over each drawn phase (level-walking stride peak = 100).
const PHASES = {
  "stair-ascent": [["weight-acceptance", 0, 0.141], ["pull-up", 0.141, 0.4237], ["forward-continuance", 0.4237, 0.641], ["swing", 0.641, 1]],
  "stair-descent": [["weight-acceptance", 0, 0.152], ["forward-continuance", 0.152, 0.2323], ["controlled-lowering", 0.2323, 0.652], ["swing", 0.652, 1]],
};
// Integral mean (trapezoid rule) of the linearly interpolated curve over [a, b].
const phaseMean = (arr, a, b, n = 400) => {
  const at = (tau) => { const x = tau * 99, i = Math.floor(x), f = x - i; return arr[i] * (1 - f) + arr[Math.min(i + 1, 99)] * f; };
  let s = (at(a) + at(b)) / 2; for (let k = 1; k < n; k++) s += at(a + (b - a) * k / n);
  return Math.round(s / n);
};
const EMG_ROWS = [["hamstrings", "BF", "넙다리두갈래근"], ["rectus-femoris", "RF", "넙다리곧은근"], ["vasti", "VL", "가쪽넓은근"], ["gastrocnemius-lateral", "GAS", "장딴지근 가쪽갈래"], ["soleus", "SOL", "가자미근"], ["tibialis-anterior", "TA", "앞정강근(10명)"]];
for (const cfg of CONFIG) {
  if (process.env.FROM_EDGE && cfg.slug === process.env.SLUG) cfg.fromEdge = Number(process.env.FROM_EDGE);
  const { keyframes, report, src, sd, seamStart } = build(cfg);
  const c = check(cfg, keyframes, src, sd, seamStart);
  const generated = {
    keyframes,
    stairs: { direction: cfg.direction, rise: 0.17, going: 0.29, stanceEnd: cfg.stanceEnd, fromEdge: cfg.fromEdge, sources: ["grimmer2020"],
      note: `단 높이 0.17 m·디딤판 0.29 m와 발 떼기(duty factor ${(cfg.stanceEnd * 100).toFixed(1)}%)는 Grimmer 2020 본문·표 1의 값입니다. 디딤판 위 발 위치(단 모서리에서 발허리발가락관절까지 ${+(cfg.fromEdge * 100).toFixed(1)} cm)는 편집값으로, 디딤 발이 앞뒤 챌판과 1 cm 이상 떨어지고 흔드는 발이 단 모서리에 걸리지 않도록 정했습니다.` },
    emg: { reference: "같은 대상·같은 다리의 평지 보행 주기 최대를 100%로 둔 값입니다(최대 수의적 수축 대비가 아님).", cut: 30, sources: ["darmstadt-stairs"],
      note: "앞정강근은 대상 2명의 자료가 없어 10명 평균입니다. 넙다리두갈래근·가쪽넓은근만 측정했으므로 뒤넙다리근·넓은근의 다른 갈래는 이 표에 없습니다.",
      rows: EMG_ROWS.map(([muscle, key, label]) => ({ muscle, label, values: Object.fromEntries(PHASES[cfg.slug].map(([id, a, b]) => [id, phaseMean(dd[cfg.stride][key].mean, a, b)])) })) },
  };
  console.log(cfg.slug, JSON.stringify(report), JSON.stringify(c), "keyframes", keyframes.length);
  if (flag !== "--write") continue;
  const file = `data/movements/${cfg.slug}.json`, m = JSON.parse(fs.readFileSync(file, "utf8"));
  Object.assign(m, generated);
  fs.writeFileSync(file, JSON.stringify(m, null, 1) + "\n");
}
