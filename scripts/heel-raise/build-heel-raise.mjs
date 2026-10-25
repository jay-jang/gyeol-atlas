// data/movements/heel-raise.json (docs/movement-mechanics/heel-raise/CONSENSUS.md §4–§6) from the
// SAME-Limb export and the authored text.
//   python3 -I scripts/heel-raise/export-same-limb.py <SAME-Limb root> same-limb.json
//   PATH=<node24>:$PATH node scripts/heel-raise/build-heel-raise.mjs same-limb.json heel-raise.base.json [--write data/movements/heel-raise.json]
// heel-raise.base.json holds the authored text. Every number taken from the export or from the drawing is
// written there as a {{token}} and filled here (an unknown token stops the build; unused ones are listed),
// so a change of definition reaches the page text only through the export.
// Timeline: quiet standing 0.5 s (editorial), then the measured subject-mean durations of the
// anticipatory adjustment (left tibialis anterior EMG onset → heel-off), the rise (→ peak) and the
// lowering (→ heel contact). The group curves (repetitions time-normalised between those events, averaged
// per subject, then over subjects, left and right legs averaged) are placed on that timeline.
// Angles (changes from quiet standing; the first keyframe is the engine's neutral pose, editorial):
// shank and thigh = marker-line inclination changes, knee = shank − thigh, hip = pelvis − thigh, foot = the
// pitch about the metatarsophalangeal joint at which the engine's heel point rises as far as the group-mean
// heel marker (never below 0), ankle = shank − foot, toe = foot (toes keep their resting line). At the
// heel-off and heel-contact events the foot pitch is rounded down to 0.1°, so the drawn heel stays at or
// under the 5 mm event threshold and inside the support band (HEEL_DOWN).
// Keyframes: the events plus the samples added one by one where the drawing (monotone cubic through the
// keyframes, angles stored to 0.1°) is furthest from the group curves, until every angle is within
// TOL_DEG and the heel within TOL_MM. Keyframes carry no `measured` field: the measured values use other
// angle definitions and are given, with those definitions, in the joints table and the event notes.
import fs from "node:fs";
import { HEEL_DOWN, SEG, footFixedPose, interpolate, sidePose, supportSpan } from "../../src/movement-figure.ts";

const args = process.argv.slice(2);
const [exportPath, basePath] = args;
const writeAt = args.indexOf("--write");
const target = writeAt >= 0 ? (args[writeAt + 1] ?? "data/movements/heel-raise.json") : null;
const d = JSON.parse(fs.readFileSync(exportPath, "utf8"));
const base = JSON.parse(fs.readFileSync(basePath, "utf8"));

const TOL_DEG = 0.25, TOL_MM = 0.5, THR_MM = d.definitions.heelThresholdMm;
const QUIET = 0.5; // editorial
const r1 = (v) => Math.round(v * 10) / 10 + 0;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const floor1 = (v) => Math.floor(v * 10 + 1e-9) / 10 + 0;

// 1. Timeline
const dur = { A: d.durations.anticipatory.mean, R: d.durations.rise.mean, L: d.durations.lowering.mean };
const T = QUIET + dur.A + dur.R + dur.L;
const tOn = r4(QUIET / T), tHo = r4((QUIET + dur.A) / T), tPk = r4((QUIET + dur.A + dur.R) / T);
const PHASES = [["quiet-standing", 0, tOn], ["anticipatory-adjustment", tOn, tHo], ["rise", tHo, tPk], ["lowering", tPk, 1]];

// 2. Group curves on the timeline. Quiet and anticipatory segments come from the repetitions with a valid
// onset; rise and lowering from all valid repetitions. At heel-off the rise segment's first value is used.
const SEGS = [["Q", 0, tOn], ["A", tOn, tHo], ["R", tHo, tPk], ["L", tPk, 1]];
const samples = [];
for (const [seg, a, b] of SEGS) {
  const n = d.curves[seg].heel.mean.length;
  for (let i = 0; i < n; i++) {
    if (i === n - 1 && seg !== "L") continue; // the next segment starts here
    samples.push({ t: a + ((b - a) * i) / (n - 1), seg, i });
  }
}
const val = (key, s, stat = "mean") => d.curves[s.seg][key][stat][s.i];
const junction = {};
for (const key of ["heel", "shank", "thigh", "pelvis", "kneeDrawn", "hipDrawn", "kneeDs", "ankleDs", "pitchSag"]) {
  const n = d.curves.A[key].mean.length;
  junction[key] = +(d.curves.A[key].mean[n - 1] - d.curves.R[key].mean[0]).toFixed(3);
}

// 3. Effective foot pitch: engine heel rise = group-mean heel-marker rise.
const restHeel = footFixedPose({ ankle: 0, knee: 0, hip: 0, foot: 0 }).right.heel.y;
const heelRise = (foot) => (footFixedPose({ ankle: 0, knee: 0, hip: 0, foot }).right.heel.y - restHeel) * 1000;
const solveFoot = (mm) => {
  if (mm <= 0) return 0;
  let lo = 0, hi = 80;
  for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (heelRise(mid) < mm) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
};
let clamped = 0, clampMin = 0;
for (const s of samples) {
  const h = val("heel", s);
  if (h < 0) { clamped++; clampMin = Math.min(clampMin, h); }
  s.target = { foot: solveFoot(h) };
  s.target.ankle = val("shank", s) - s.target.foot;
  s.target.knee = val("kneeDrawn", s);
  s.target.hip = val("hipDrawn", s);
  s.heel = h;
}
const KEYS = ["ankle", "knee", "hip", "foot"];

// 4. Keyframes: events, then greedy refinement.
const EVENT_T = new Map([[0, "조용히 선 자세(편집)"], [tOn, "왼 앞정강근 근전도 개시"], [tHo, "발꿈치 떼기"], [tPk, "최고점"], [1, "발꿈치 닿기"]]);
const THRESHOLD_EVENTS = new Set([tHo, 1]);
const at = (t) => samples.reduce((b, s) => (Math.abs(s.t - t) < Math.abs(b.t - t) ? s : b), samples[0]);
const frameOf = (t) => {
  if (t === 0) return { t: 0, angles: { ankle: 0, knee: 0, hip: 0, foot: 0, toe: 0 } };
  const s = at(t), a = Object.fromEntries(KEYS.map((k) => [k, r1(s.target[k])]));
  if (THRESHOLD_EVENTS.has(t)) { a.foot = floor1(s.target.foot); a.ankle = r1(val("shank", s) - a.foot); }
  return { t: r4(t), angles: { ...a, toe: a.foot } };
};
let frames = [...EVENT_T.keys()].map(frameOf);
const errors = (fr) => {
  let worst = { z: 0 }; const max = { ankle: 0, knee: 0, hip: 0, foot: 0, heelMm: 0 };
  for (const s of samples) {
    const a = interpolate(fr, s.t, false);
    for (const k of KEYS) { const e = Math.abs(a[k] - s.target[k]); max[k] = Math.max(max[k], e); if (e / TOL_DEG > worst.z) worst = { z: e / TOL_DEG, t: s.t, why: k }; }
    const eh = Math.abs(heelRise(a.foot) - Math.max(s.heel, 0)); max.heelMm = Math.max(max.heelMm, eh);
    if (eh / TOL_MM > worst.z) worst = { z: eh / TOL_MM, t: s.t, why: "heel" };
  }
  return { worst, max };
};
for (let it = 0; it < 200; it++) {
  const { worst } = errors(frames);
  if (worst.z <= 1) break;
  if (frames.some((f) => Math.abs(f.t - r4(worst.t)) < 1e-9)) throw new Error(`stuck at ${worst.t} (${worst.why})`);
  frames = [...frames, frameOf(worst.t)].sort((a, b) => a.t - b.t);
}
const fit = errors(frames);
const dip = { samples: clamped, minMm: +clampMin.toFixed(2) }; // the heel's small dip below 0 is not drawn
const eventOf = (t) => EVENT_T.get(t) ?? [...EVENT_T.entries()].find(([e]) => Math.abs(e - t) < 1e-9)?.[1];
const keyframes = frames.map((f) => { const ev = eventOf(f.t); return { t: f.t, ...(ev ? { event: ev } : {}), angles: f.angles, sources: ["same-limb"] }; });

// 5. Engine checks on the final keyframes (0.001 steps).
const m = { slug: "heel-raise", view: "side", loop: false, keyframes };
const MTP = { x: SEG.mtp.x, y: SEG.ankleHeight + SEG.mtp.y };
const rest = sidePose(m, 0);
const toeRest = Math.atan2(rest.right.toe.y - rest.right.mtp.y, rest.right.toe.x - rest.right.mtp.x) * 180 / Math.PI;
let mtpOff = 0, toeOff = 0, toeLine = 0, below = Infinity, rising = 0, falling = 0, bandOff = null, bandOn = null;
const resid = Object.fromEntries(PHASES.map(([id]) => [id, { dx: 0, dz: 0 }]));
let prev = null, prevT = 0;
const phaseOf = (t) => PHASES.find(([, a, b]) => t >= a - 1e-9 && t < b - 1e-9)?.[0] ?? "lowering";
const curveAt = (key, t) => { // group-mean curve value at t, linear between samples
  let i = 0; while (i < samples.length - 2 && samples[i + 1].t < t) i++;
  const a = samples[i], b = samples[i + 1], f = Math.min(Math.max((t - a.t) / (b.t - a.t), 0), 1);
  return val(key, a) + (val(key, b) - val(key, a)) * f;
};
for (let j = 0; j <= 1000; j++) {
  const t = j / 1000, p = sidePose(m, t), l = p.right;
  mtpOff = Math.max(mtpOff, Math.hypot(l.mtp.x - MTP.x, l.mtp.y - MTP.y));
  toeOff = Math.max(toeOff, Math.hypot(l.toe.x - rest.right.toe.x, l.toe.y - rest.right.toe.y));
  toeLine = Math.max(toeLine, Math.abs(Math.atan2(l.toe.y - l.mtp.y, l.toe.x - l.mtp.x) * 180 / Math.PI - toeRest));
  for (const q of [l.heel, l.mtp, l.toe, l.ankle]) below = Math.min(below, q.y);
  // Compare steps that lie wholly inside a phase (a step across the peak is neither).
  if (prev) {
    if (prevT >= tHo - 1e-9 && t <= tPk + 1e-9) rising = Math.min(rising, l.heel.y - prev.heel.y);
    if (prevT >= tPk - 1e-9) falling = Math.max(falling, l.heel.y - prev.heel.y);
  }
  const span = supportSpan(l, 0), heelIn = span.lo <= l.heel.x + 1e-12;
  if (!heelIn && bandOff === null) bandOff = t;
  if (heelIn && bandOff !== null && bandOn === null && t > tPk) bandOn = t;
  const dx = (p.right.hip.x - rest.right.hip.x) * 1000 - curveAt("asisX", t), dz = (p.right.hip.y - rest.right.hip.y) * 1000 - curveAt("asisZ", t);
  const r = resid[phaseOf(t)];
  if (Math.abs(dx) > Math.abs(r.dx)) r.dx = +dx.toFixed(1);
  if (Math.abs(dz) > Math.abs(r.dz)) r.dz = +dz.toFixed(1);
  prev = l; prevT = t;
}
const atEvent = (t) => { const p = sidePose(m, t); return { hipForwardMm: +((p.right.hip.x - rest.right.hip.x) * 1000).toFixed(1), hipUpMm: +((p.right.hip.y - rest.right.hip.y) * 1000).toFixed(1), asisForwardMm: +curveAt("asisX", t).toFixed(1), asisUpMm: +curveAt("asisZ", t).toFixed(1), heelDrawnMm: +((p.right.heel.y - rest.right.heel.y) * 1000).toFixed(2), heelMeasuredMm: +Math.max(curveAt("heel", t), 0).toFixed(1) }; };
const events = Object.fromEntries([["onset", tOn], ["heelOff", tHo], ["peak", tPk], ["contact", 1]].map(([k, t]) => [k, atEvent(t)]));
const endHeel = sidePose(m, 1).right.heel.y;
const report = {
  durationsS: { quiet: QUIET, anticipatory: +dur.A.toFixed(3), rise: +dur.R.toFixed(3), lowering: +dur.L.toFixed(3), total: +T.toFixed(3) },
  boundaries: PHASES.map(([id, a, b]) => `${id} ${a}–${b}`),
  keyframes: keyframes.length,
  maxDeviation: Object.fromEntries(Object.entries(fit.max).map(([k, v]) => [k, +v.toFixed(3)])),
  heelDipNotDrawn: dip,
  heelOffJunction: junction,
  peakFoot: keyframes.find((k) => k.t === tPk).angles,
  mtpOffsetMax: mtpOff, toeTipOffsetMax: toeOff, toeLineVsRestDeg: toeLine, toeRestDeg: +toeRest.toFixed(2),
  lowestFootPointM: +below.toFixed(4), heelDropDuringRiseM: rising, heelGainDuringLoweringM: falling,
  supportBandHeelLeaves: bandOff, supportBandHeelBack: bandOn, HEEL_DOWN, supportBandMarginAtContactMm: +((HEEL_DOWN - endHeel) * 1000).toFixed(3),
  pelvisResidualMm: resid,
  events,
};
if (mtpOff > 1e-9 || toeOff > 1e-9 || toeLine > 1e-6) throw new Error("metatarsophalangeal joint or toes moved");
if (rising < -1e-9 || falling > 1e-9) throw new Error(`heel height not monotonic: ${rising} ${falling}`);
if (below < 0.01 - 1e-9) throw new Error(`foot below its resting floor line: ${below}`);
for (const k of ["heelOff", "contact"]) if (events[k].heelDrawnMm > THR_MM + 1e-9) throw new Error(`${k}: drawn heel ${events[k].heelDrawnMm} mm above the ${THR_MM} mm threshold`);
if (!(endHeel <= HEEL_DOWN)) throw new Error("heel outside the support band at heel contact");
console.log(JSON.stringify(report, null, 1));

// 6. EMG phase means: notched envelopes, % of the same subject's mean 4 km/h treadmill gait-cycle peak.
const E = d.emg["4kmh_A1-A4"], EX = d.emg["4kmh_A1-A4_withoutStanceTA"], ID = { Q: "quiet-standing", A: "anticipatory-adjustment", R: "rise", L: "lowering" };
const rowOf = (ch) => Object.fromEntries(Object.entries(ID).map(([k, id]) => [id, Math.round(E[ch][k].mean)]));
const join = (tab, ch, stat) => ["Q", "A", "R", "L"].map((k) => Math.round(tab[ch][k][stat])).join("·");
const speed = (ch, ph) => ["3kmh_A1", "4kmh_A1", "5kmh_A1"].map((n) => Math.round(d.emg[n][ch][ph].mean)).join("·");
const cyc = d.clock.cyclesPerSubject, xc = d.crosstalk;
const shortIds = (ids) => ids.map((u, i) => (i ? u.replace("user", "") : u)).join("·");
const CP = d.emg["4kmh_A1-A4_cyclePeaks"];
const emg = {
  basis: "반복마다 낸 구간 평균을 대상별로 평균한 뒤 30명을 평균한 값",
  reference: "같은 대상·같은 다리(왼다리)의 트레드밀 4 km/h 걷기(A1–A4) 평균 주기 최대를 100%로 둔 값입니다(최대 수의적 수축 대비가 아님).",
  cut: 30,
  sources: ["same-limb"],
  note: `30명 대상별 평균의 평균입니다. 배포 근전도(20–450 Hz 대역통과만 거침)에 50 Hz와 그 배수(450 Hz까지) 노치를 더 걸고, 정류한 뒤 4차 버터워스 6 Hz 저역 통과를 앞뒤로 한 번씩 걸어(위상 지연 없음) 포락선을 만들었습니다. 걷기 주기는 왼발꿈치 표지점이 엉치 표지점보다 가장 앞에 온 때부터 다음 그때까지로 잡았습니다(힘판 없음, 대상당 ${cyc.min}–${cyc.max}주기, 중앙값 ${cyc.median}). 대상별 중앙값은 앞정강근 ${join(E, "TA", "median")}, 장딴지근 ${join(E, "GA", "median")}이며, 오른쪽으로 긴 분포라 평균이 더 큽니다. 기준을 ‘평균 주기의 최대’ 대신 ‘주기별 최대의 평균’으로 잡으면 앞정강근 ${join(CP, "TA", "mean")}, 장딴지근 ${join(CP, "GA", "mean")}으로 작아집니다. 걷기에서 앞정강근 최대가 장딴지근 최대와 같은 입각기 중간(주기 16–54%)에 온 ${xc.subjects.length}명(${shortIds(xc.subjects)})은 앞정강근 신호가 장딴지근을 따라가 종아리 근육 신호가 섞였을 수 있습니다. 이들을 빼면 앞정강근은 ${join(EX, "TA", "mean")}입니다. 3·4·5 km/h(A1만) 기준으로 바꾸면 내려오기 칸은 앞정강근 ${speed("TA", "L")}, 장딴지근 ${speed("GA", "L")}입니다. 30 근처 칸은 기준 속도에 따라 판정이 바뀔 수 있습니다. 장딴지근 전극의 갈래는 출처에 적혀 있지 않아, 갈래를 나누지 않은 ‘장딴지근(갈래 미기재)’ 행에 대응시켰습니다. 넙다리곧은근·안쪽넓은근도 기록되었지만 걷기 최대가 작아 바닥 잡음 비중이 크고, 조용히 서기 값이 30을 넘는 대상이 많아(넙다리곧은근 ${E.RF.Q.over30}명, 안쪽넓은근 ${E.VM.Q.over30}명) 이 표에서 뺐습니다. 근전도와 동작 기록의 시계는 따로 보정되지 않았습니다.`,
  rows: [
    { muscle: "tibialis-anterior", label: "앞정강근", values: rowOf("TA") },
    { muscle: "gastrocnemius", label: "장딴지근(갈래 미기재)", values: rowOf("GA") },
  ],
};
console.log("emg", JSON.stringify(emg.rows));
const duration = { seconds: +T.toFixed(2), sources: ["same-limb"],
  note: `조용히 서기 ${QUIET}초(편집)에 측정 평균(30명 대상 평균의 평균) 예비 자세 조정 ${dur.A.toFixed(2)}초, 올라가기 ${dur.R.toFixed(2)}초, 내려오기 ${dur.L.toFixed(2)}초를 더한 값입니다(공개 데이터 계산).` };

// 7. Numbers quoted in the authored text.
const MINUS = (s) => s.replace(/^-/, "−");
const fx = (v, n) => MINUS((+v).toFixed(n));
const sg = (v, n) => (v > 0 ? "+" : "") + fx(v, n); // signed
const pm = (st, n, sign = 1, signed = false) => `${signed ? sg(sign * st.mean, n) : fx(sign * st.mean, n)}±${(+st.sd).toFixed(n)}`;
const ev = d.events, pk = d.peaks, on = d.onsets, cm = d.circleSubjectMedians, sens = d.thresholdSensitivity;
const cnt = (k, s) => on.TA[k].counts[s] ?? 0;
const shares = ["2.0", "3.0", "4.0"].map((k) => Math.round(d.onsetOrder[k].share * 100));
const kf = (t) => keyframes.find((k) => Math.abs(k.t - t) < 1e-9).angles;
const u20 = d.counts.invalid.find((r) => r.reason === "no quiet window");
const u20other = d.repetitions.filter((r) => r.valid && r.user === u20.user && r.trial === u20.trial).map((r) => r.onset.TA.baseline[0]);
const mainsMed = (v) => Object.values(d.mainsShareQuiet[v]).map((x) => Math.round(x.median * 100));
const range = (xs, n = 0) => `${Math.min(...xs).toFixed(n)}–${Math.max(...xs).toFixed(n)}`;
const ceil1 = (v) => (Math.ceil(v * 10 - 1e-9) / 10).toFixed(1);
const asisMm = (k) => Math.round(ev.asisX[k].mean);
const FACTS = {
  validN: d.counts.valid, repsN: d.counts.repetitions,
  antPm: pm(d.durations.anticipatory, 2), ant: fx(d.durations.anticipatory.mean, 2), ant2: fx(on.TA["2.0"].lead.mean, 2), ant4: fx(on.TA["4.0"].lead.mean, 2),
  ant2wbc: fx(on.TA["2.0"].leadWithBeforeCue.mean, 2), ok3: cnt("3.0", "ok"), ex3: d.counts.valid - cnt("3.0", "ok"),
  edge3: cnt("3.0", "edge"), bc3: cnt("3.0", "beforeCue"), after3: cnt("3.0", "after"), missing3: cnt("3.0", "missing"), bc2: cnt("2.0", "beforeCue"), bc4: cnt("4.0", "beforeCue"), edge2: cnt("2.0", "edge"), ex2: d.counts.valid - cnt("2.0", "ok"),
  taFirst3: shares[1], taFirstRange: range(shares), cueOn: fx(on.TA["3.0"].cueToOnset.mean, 2), cueHo: pm(d.durations.cueToHeelOff, 2),
  risePm: pm(d.durations.rise, 2), lowerPm: pm(d.durations.lowering, 2), above90Pm: pm(d.durations.above90, 2),
  riseSens: `${fx(sens["3.0"].rise.mean, 2)}–${fx(sens["10.0"].rise.mean, 2)}`, lowerSens: `${fx(sens["3.0"].lowering.mean, 2)}–${fx(sens["10.0"].lowering.mean, 2)}`,
  gaLead: pm(on.GA["3.0"].lead, 2), gaBins: range(d.gaBeforeHeelOff.map((b) => b.groupMedian), 2), gaUnder: Math.max(...d.gaBeforeHeelOff.map((b) => b.under09)),
  heelR: pm(pk.heelRiseR, 1), heelL: pm(pk.heelRiseL, 1), heelMean: Math.round(pk.heelRiseMean.mean), heelCm: Math.round(pk.heelRiseMean.mean / 10),
  toePk: pm(ev.toe.peak, 1), toePkMean: fx(ev.toe.peak.mean, 1), pitchPk: pm(ev.pitchSag.peak, 1), pitchPkMean: fx(ev.pitchSag.peak.mean, 1), pitch3dPk: pm(ev.pitch3d.peak, 1),
  ankleR: pm(pk.ankleDsRAtPeak, 1, -1), ankleL: pm(pk.ankleDsLAtPeak, 1, -1), ankleDsPk: fx(-ev.ankleDs.peak.mean, 1), anklePkRound: Math.round(-ev.ankleDs.peak.mean),
  kneeDsPk: pm(ev.kneeDs.peak, 1), kneeR: pm(pk.kneeDsRAtPeak, 1), kneeL: pm(pk.kneeDsLAtPeak, 1), kneePkRound: Math.round(ev.kneeDs.peak.mean), kneeDsHo: fx(ev.kneeDs.heelOff.mean, 1),
  shankHo: pm(ev.shank.heelOff, 1, 1, true), shankPk: pm(ev.shank.peak, 1, 1, true), shankCo: pm(ev.shank.contact, 1, 1, true), shankHoMean: fx(ev.shank.heelOff.mean, 1),
  thighHo: pm(ev.thigh.heelOff, 1, 1, true), thighPk: pm(ev.thigh.peak, 1, 1, true), thighCo: pm(ev.thigh.contact, 1, 1, true),
  shankRPk: pm(pk.shankRAtPeak, 1, 1, true), thighRPk: pm(pk.thighRAtPeak, 1, 1, true),
  asisFwdHo: pm(ev.asisX.heelOff, 1), asisUpHo: pm(ev.asisZ.heelOff, 1), asisFwdPk: pm(ev.asisX.peak, 1), asisUpPk: pm(ev.asisZ.peak, 1), asisFwdMax: pm(pk.asisForwardMax, 1),
  asisFwdHoR: asisMm("heelOff"), asisFwdPkR: asisMm("peak"), asisUpPkR: Math.round(ev.asisZ.peak.mean), asisFwdCoR: asisMm("contact"), onsetAsis: asisMm("onset"),
  pelvisHo: pm(ev.pelvis.heelOff, 1, 1, true), pelvisPk: pm(ev.pelvis.peak, 1, 1, true),
  antAsis: Math.round(ev.asisX.heelOff.mean - ev.asisX.onset.mean), antShank: fx(ev.shank.heelOff.mean - ev.shank.onset.mean, 1),
  onsetAng: ceil1(Math.max(...["shank", "thigh", "pelvis", "ankleDs", "kneeDs"].map((k) => Math.abs(ev[k].onset.mean)))), dip: fx(-dip.minMm, 1),
  circR: Math.round(cm.radius.median), circRiqr: cm.radius.iqr.map(Math.round).join("–"), circSw: Math.round(cm.sweep.median), circSwIqr: cm.sweep.iqr.map(Math.round).join("–"),
  circBehind: Math.round(cm.centreBehindToe.median), circBelow: Math.round(cm.centreBelowToe.median),
  // Phase means for every phase; subject medians are quoted for the rise and lowering only.
  ...Object.fromEntries(["TA", "GA"].flatMap((c) => ["Q", "A", "R", "L"].flatMap((k) => [[`${c.toLowerCase()}${k}`, Math.round(E[c][k].mean)], ...("RL".includes(k) ? [[`${c.toLowerCase()}${k}med`, Math.round(E[c][k].median)]] : [])]))),
  taAx: Math.round(EX.TA.A.mean), taRx: Math.round(EX.TA.R.mean), taLx: Math.round(EX.TA.L.mean),
  taLspeed: speed("TA", "L"), gaLspeed: speed("GA", "L"), rfOver30: E.RF.Q.over30, vmOver30: E.VM.Q.over30,
  xcN: xc.subjects.length, xcIds: shortIds(xc.subjects), xcCorrHr: fx(xc.heelRaiseCorr.stance.mean, 2), xcCorrHrOther: fx(xc.heelRaiseCorr.others.mean, 2),
  xcCorrWalk: fx(xc.walkCorr.stance.mean, 2), xcCorrWalkOther: fx(xc.walkCorr.others.mean, 2), xcAnt: fx(xc.anticipatory.mean, 2), xcTaFirst3: Math.round(xc.order["3.0"].share * 100),
  gaBin2: d.clock.GABins["16-54"], gaPkMed: Math.round(d.clock.GA.median), rfPkMed: Math.round(d.clock.RF.median),
  taBin1: d.clock.TABins["0-15"], taBin2: d.clock.TABins["16-54"], taBin3: d.clock.TABins["55-85"], taBin4: d.clock.TABins["86-100"], taBinHs: d.clock.TABins["0-15"] + d.clock.TABins["86-100"],
  mainsRange: range(mainsMed("hann_raw")), mainsAfter: range(mainsMed("hann_notch")), lat: fx(d.definitions.cueFreeLatencyS, 2),
  u20: `${u20.user}의 ${u20.trial}`, u20ho: fx((u20.legs.L.heelOff + u20.legs.R.heelOff) / 2, 1), u20ratio: Math.round(u20.shiftedWindow.taMeanSd[0] / (u20other.reduce((a, b) => a + b, 0) / u20other.length)),
  footPk: fx(kf(tPk).foot, 1), ankleDrawnPk: fx(-kf(tPk).ankle, 1), kneeDrawnPk: fx(kf(tPk).knee, 1), hipDrawnPk: fx(kf(tPk).hip, 1),
  footHo: fx(kf(tHo).foot, 1), footCo: fx(kf(1).foot, 1), kneeDrawnHo: fx(kf(tHo).knee, 1), heelDrawnCo: fx(events.contact.heelDrawnMm, 1),
  hipFwdPk: Math.round(events.peak.hipForwardMm), hipUpPk: Math.round(events.peak.hipUpMm),
  residFwd: Math.round(events.peak.asisForwardMm - events.peak.hipForwardMm), residUp: Math.round(events.peak.asisUpMm - events.peak.hipUpMm),
  fitDeg: ceil1(Math.max(fit.max.ankle, fit.max.knee, fit.max.hip, fit.max.foot)), fitMm: ceil1(fit.max.heelMm),
  antS: dur.A.toFixed(2), riseS: dur.R.toFixed(2), lowerS: dur.L.toFixed(2), totalS: T.toFixed(2),
};
const used = new Set();
const fill = (o) => {
  if (typeof o === "string") return o.replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in FACTS)) throw new Error(`unknown token ${k}`); used.add(k); return String(FACTS[k]); });
  if (Array.isArray(o)) return o.map(fill);
  if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fill(v)]));
  return o;
};
const text = fill(base);
const unused = Object.keys(FACTS).filter((k) => !used.has(k));
console.log("tokens used", used.size, "unused", unused.join(" ") || "none");

// 8. Assemble: authored text + generated fields (phase start/end, keyframes with the authored event notes, duration, emg).
const byId = new Map(PHASES.map(([id, a, b]) => [id, [a, b]]));
const notes = new Map((text.keyframes ?? []).map((k) => [k.event, k.note]));
for (const k of keyframes) if (k.event && !notes.has(k.event)) throw new Error(`no note for ${k.event}`);
const mv = {
  ...text,
  phases: text.phases.map((p) => { const b = byId.get(p.id); if (!b) throw new Error(`phase ${p.id}`); return { ...p, start: b[0], end: b[1] }; }),
  duration,
  keyframes: keyframes.map((k) => (k.event ? { ...k, note: notes.get(k.event) } : k)),
  emg,
};
const ORDER = ["slug", "name", "alias", "nameEn", "view", "plane", "order", "summary", "conditions", "duration", "loop", "phaseKind", "phases", "keyframes", "timingNote", "figureNote", "muscles", "joints", "mechanics", "passive", "absent", "principle", "misconceptions", "limitations", "related", "emg"];
const out = Object.fromEntries(ORDER.filter((k) => k in mv).map((k) => [k, mv[k]]));
for (const k of Object.keys(mv)) if (!ORDER.includes(k)) throw new Error(`field ${k}`);
if (target) { fs.writeFileSync(target, JSON.stringify(out, null, 1) + "\n"); console.log("wrote", target); }
