// Geometry of the movement diagrams: joint angles in, 2D points out.
// Pure functions (no DOM) so tests can check contact, monotonic timelines
// and that every drawn muscle line has anchors.
//
// Lower-limb proportions come from the male BodyParts3D bones in
// public/models/bone.glb (scene metres, y up, z forward), joint centres
// approximated from the bone extents (docs/movement-mechanics/VERIFICATION.md):
// ankle 0.07 m above the floor, knee 0.44, hip 0.83, shoulder 1.335, top of
// head 1.655; heel 0.053 m behind and toe tip 0.166 m in front of the ankle.
// Trunk, head and arm shapes are editorial. Nothing here computes a centre
// of mass: overlays are drawn only from cited keyframe values.
import type { BackAngles, Keyframe, Movement, MuscleCell, MuscleRow, SideAngles } from "./movement-types";

export type Pt = { x: number; y: number };
export const FLOOR_GAP = 0.01; // heel bone above the floor line in the foot-flat poses
export const SEG = {
  ankleHeight: 0.07,
  shank: 0.37,
  thigh: 0.39,
  pelvis: 0.12, // hip centre to lumbosacral junction
  trunk: 0.45, // lumbosacral junction to C7
  neck: 0.09,
  head: 0.2,
  upperArm: 0.265,
  forearm: 0.235,
  heel: { x: -0.053, y: -0.06 },
  mtp: { x: 0.113, y: -0.05 },
  toe: { x: 0.166, y: -0.06 },
} as const;

const rad = (deg: number) => (deg * Math.PI) / 180;
// Orientation measured from vertical-up, forward positive.
const dir = (phi: number): Pt => ({ x: Math.sin(rad(phi)), y: Math.cos(rad(phi)) });
export const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
export const rotate = (p: Pt, deg: number): Pt => {
  // Clockwise by deg (forward pitch of a horizontal vector points it down).
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return { x: p.x * c + p.y * s, y: -p.x * s + p.y * c };
};

export type Leg = { hip: Pt; knee: Pt; ankle: Pt; heel: Pt; mtp: Pt; toe: Pt; shank: number; thigh: number; footPitch: number };
export type SidePose = {
  right: Leg;
  left: Leg;
  steps?: StairSteps; // stair gait only
  pelvis: number;
  trunk: number;
  lumbosacral: Pt;
  c7: Pt;
  shoulder: Pt;
  head: Pt;
  elbow: Pt;
  wrist: Pt;
};

// A leg hanging from the hip with the pelvis at `pelvis` degrees.
function legFromHip(hip: Pt, pelvis: number, a: SideAngles): Leg {
  const thigh = pelvis - a.hip; // knee → hip direction
  const shank = thigh + a.knee; // ankle → knee direction
  const knee = add(hip, dir(thigh), -SEG.thigh);
  const ankle = add(knee, dir(shank), -SEG.shank);
  const footPitch = shank - a.ankle; // toe-down positive
  const at = (p: Pt) => add(ankle, rotate(p, footPitch));
  const mtp = at(SEG.mtp);
  // The toes bend up about the metatarsophalangeal joint.
  const toeVec = rotate({ x: SEG.toe.x - SEG.mtp.x, y: SEG.toe.y - SEG.mtp.y }, footPitch - (a.toe ?? 0));
  return { hip, knee, ankle, heel: at(SEG.heel), mtp, toe: add(mtp, toeVec), shank, thigh, footPitch };
}

// Upper body from the hip, shared by every side-view pose.
function upper(hip: Pt, pelvis: number, trunkAngle: number, arms: "crossed" | "hanging") {
  const lumbosacral = add(hip, dir(pelvis - 14), SEG.pelvis); // sacral promontory sits behind the hip centre
  const c7 = add(lumbosacral, dir(trunkAngle), SEG.trunk);
  // Shoulder joint below and in front of C7 (over the rib cage, not the spine); the head keeps the gaze
  // nearer level than the trunk.
  const shoulder = add(add(c7, dir(trunkAngle), -0.065), dir(trunkAngle + 90), 0.055);
  const head = add(c7, dir(trunkAngle * 0.6), SEG.neck + SEG.head * 0.45);
  // Arms crossed over the chest for rising and sitting (seen from the side,
  // the forearm runs across the body and looks short); hanging otherwise.
  const elbow = arms === "crossed"
    ? add(shoulder, dir(trunkAngle + 172), SEG.upperArm * 0.85)
    : add(shoulder, dir(trunkAngle + 180), SEG.upperArm);
  const wrist = arms === "crossed"
    ? add(elbow, dir(trunkAngle + 40), SEG.forearm * 0.45)
    : add(elbow, dir(trunkAngle + 175), SEG.forearm);
  return { lumbosacral, c7, shoulder, head, elbow, wrist };
}

// Rising, sitting, standing and the heel raise: the right foot keeps its
// metatarsophalangeal joint on one floor point and the chain is built upward
// from the ankle. The foot is flat unless `foot` pitches it about that joint
// (heel raise); the toes keep their resting line when `toe` equals `foot`.
// With a cited trunk inclination the lumbar spine takes up the difference;
// otherwise the trunk follows the pelvis.
const MTP_FLOOR = { x: SEG.mtp.x, y: SEG.ankleHeight + SEG.mtp.y };
export function footFixedPose(a: SideAngles, arms: "crossed" | "hanging" = "crossed"): SidePose {
  const footPitch = a.foot ?? 0;
  const ankle = add(MTP_FLOOR, rotate(SEG.mtp, footPitch), -1);
  const shank = footPitch + a.ankle;
  const knee = add(ankle, dir(shank), SEG.shank);
  const thigh = shank - a.knee;
  const hip = add(knee, dir(thigh), SEG.thigh);
  const pelvis = thigh + a.hip;
  const trunk = a.trunk ?? pelvis;
  const at = (p: Pt) => add(ankle, rotate(p, footPitch));
  const mtp = at(SEG.mtp);
  const toeVec = rotate({ x: SEG.toe.x - SEG.mtp.x, y: SEG.toe.y - SEG.mtp.y }, footPitch - (a.toe ?? 0));
  const leg: Leg = { hip, knee, ankle, heel: at(SEG.heel), mtp, toe: add(mtp, toeVec), shank, thigh, footPitch };
  return { right: leg, left: leg, pelvis, trunk, ...upper(hip, pelvis, trunk, arms) };
}

// Walking: the hip is held at a fixed x (a treadmill view). Its height puts
// the stance foot on the floor; in double support the height moves from the
// trailing to the leading leg as weight is accepted (Perry & Burnfield 2010:
// right stance 0–62%, loading response to 12%, left contact at 50%). The left
// leg runs half a cycle behind the right.
export const GAIT = { stanceEnd: 0.62, loadingEnd: 0.12, opposite: 0.5 } as const;
export type Contacts = { stanceEnd: number; loadingEnd: number; opposite: number };
const smooth = (v: number) => v * v * (3 - 2 * v);
// t wrapped into [0, 1) without adding 1 first, so a phase start such as
// 0.2323 stays exactly itself (1.2323 % 1 falls just below it).
export const wrap = (t: number) => { const x = t % 1; return x < 0 ? x + 1 : x; };
// Share of the body weight on the right leg (0 = all on the left): it moves
// over in each double support.
export function rightWeight(t: number, c: Contacts) {
  const x = wrap(t);
  return x < c.loadingEnd ? smooth(x / c.loadingEnd)
    : x < c.opposite ? 1
      : x < c.stanceEnd ? 1 - smooth((x - c.opposite) / (c.stanceEnd - c.opposite))
        : 0;
}
export function walkingPose(right: SideAngles, left: SideAngles, t = 0): SidePose {
  const probe = { x: 0, y: 0 };
  const height = (a: SideAngles) => { const leg = legFromHip(probe, 0, a); return FLOOR_GAP - Math.min(leg.heel.y, leg.mtp.y, leg.toe.y); };
  const w = rightWeight(t, GAIT);
  const hip = { x: 0, y: w * height(right) + (1 - w) * height(left) };
  return { right: legFromHip(hip, 0, right), left: legFromHip(hip, 0, left), pelvis: 0, trunk: right.trunk ?? 0, ...upper(hip, 0, right.trunk ?? 0, "hanging") };
}

// Stair gait, one foot per step. The staircase is fixed in the world: tread
// k spans x = k·going … (k+1)·going at height ±k·rise, its edge (nosing) at
// the near end going up and the far end going down. The right foot stands on
// tread 0 from contact to toe-off, the left on tread 1 from half a cycle
// later, so a cycle climbs (or descends) two steps. Each stance foot is held
// at its metatarsophalangeal joint, the pivot
// of both a forefoot landing and a heel rise; in double support the hip moves
// from one foot's hold to the other's as weight is accepted, as in walking.
// The drawing follows the body at a constant speed (two steps per cycle), so
// the staircase glides past like an escalator and the hip keeps its own small
// surges.
export type StairSteps = { origin: Pt; rise: number; going: number; dir: 1 | -1 };
type StairSpec = NonNullable<Movement["stairs"]>;
export const stairContacts = (s: Pick<StairSpec, "stanceEnd">): Contacts => ({ stanceEnd: s.stanceEnd, loadingEnd: s.stanceEnd - 0.5, opposite: 0.5 });
// Joint centre above the tread when the foot is flat (heel and toe tip rest
// FLOOR_GAP above it, as in the foot-flat poses).
export const MTP_ABOVE = SEG.ankleHeight + SEG.mtp.y;
export function stairHold(s: StairSpec, k: number): Pt {
  const dir = s.direction === "up" ? 1 : -1;
  return { x: k * s.going + (dir > 0 ? s.fromEdge : s.going - s.fromEdge), y: dir * k * s.rise + MTP_ABOVE };
}
// The sources give no toe angle on stairs. Drawing rule: a foot on its tread
// rests its toes on it (flat, or reaching down when the joint is lifted),
// easing in over TOE_EASE before contact and out after toe-off; elsewhere
// the toes keep the keyframe angle.
const TOE_EASE = 0.08;
const TOE = { x: SEG.toe.x - SEG.mtp.x, y: SEG.toe.y - SEG.mtp.y };
function stanceToes(leg: Leg, a: SideAngles, tread: number, k: number) {
  if (k <= 0) return a.toe ?? 0;
  // Clockwise turn of the toe segment that puts its tip FLOOR_GAP above the tread.
  const len = Math.hypot(TOE.x, TOE.y), base = Math.atan2(-TOE.y, TOE.x);
  const h = leg.mtp.y - tread - FLOOR_GAP;
  const turn = ((Math.asin(Math.min(Math.max(h / len, -1), 1)) - base) * 180) / Math.PI;
  // Somewhere between in line with the foot (0) and lying flat on the tread.
  const target = Math.min(Math.max(leg.footPitch - turn, Math.min(leg.footPitch, 0)), Math.max(leg.footPitch, 0));
  return (a.toe ?? 0) + k * (target - (a.toe ?? 0));
}
// 1 while the foot is on its tread [from, to) of the cycle, easing to 0 over TOE_EASE outside.
function onTread(x: number, from: number, to: number) {
  const len = wrap(to - from), u = wrap(x - from);
  if (u < len) return 1;
  const gap = Math.min(u - len, 1 - u);
  return gap < TOE_EASE ? smooth(1 - gap / TOE_EASE) : 0;
}
export function stairPose(right: SideAngles, left: SideAngles, t: number, s: StairSpec): SidePose {
  const probe = { x: 0, y: 0 };
  // One pelvis carries both hips: the right-leg keyframe gives its tilt (in
  // a symmetric cycle the tilt repeats every half cycle, so the left leg's
  // shifted curve was measured against the same tilt).
  const tilt = right.pelvis ?? 0;
  const R = legFromHip(probe, tilt, right), L = legFromHip(probe, tilt, left);
  const x = wrap(t);
  const dir = s.direction === "up" ? 1 : -1;
  const c = stairContacts(s);
  const w = rightWeight(x, c);
  const holdR = stairHold(s, 0), holdL = stairHold(s, x < c.opposite ? -1 : 1);
  // World position of the hip.
  const hipW = {
    x: w * (holdR.x - R.mtp.x) + (1 - w) * (holdL.x - L.mtp.x),
    y: w * (holdR.y - R.mtp.y) + (1 - w) * (holdL.y - L.mtp.y),
  };
  // The view moves two steps per cycle. It starts where a hip standing
  // upright over the right foot's hold would be drawn at (0, 0.83), as in
  // the foot-flat poses.
  const view = { x: holdR.x - SEG.mtp.x + 2 * s.going * x, y: holdR.y - MTP_ABOVE + 2 * dir * s.rise * x };
  const hip = { x: hipW.x - view.x, y: hipW.y - view.y };
  const steps: StairSteps = { origin: { x: -view.x, y: -view.y }, rise: s.rise, going: s.going, dir };
  const draw = (a: SideAngles, hold: Pt, from: number, to: number) => {
    const leg = legFromHip(hip, tilt, a);
    const toe = stanceToes(leg, a, hold.y - MTP_ABOVE - view.y, onTread(x, from, to));
    return toe === (a.toe ?? 0) ? leg : legFromHip(hip, tilt, { ...a, toe });
  };
  // Easing in before contact, the toes reach for the tread the foot is about
  // to land on (the right foot two steps on, the left one), so nothing jumps
  // at contact.
  const landing = (from: number) => wrap(from - x) <= TOE_EASE && wrap(from - x) > 0;
  return {
    right: draw(right, landing(0) ? stairHold(s, 2) : holdR, 0, c.stanceEnd),
    left: draw(left, landing(c.opposite) ? stairHold(s, 1) : holdL, c.opposite, c.loadingEnd),
    pelvis: tilt, trunk: right.trunk ?? tilt, steps, ...upper(hip, tilt, right.trunk ?? tilt, "hanging"),
  };
}
// Height of the tread under x (drawing coordinates), and the staircase
// outline between x0 and x1.
export function stepTop(s: StairSteps, x: number) {
  return s.origin.y + s.dir * Math.floor((x - s.origin.x) / s.going + 1e-9) * s.rise;
}
export function stepOutline(s: StairSteps, x0: number, x1: number): Pt[] {
  let k = Math.floor((x0 - s.origin.x) / s.going + 1e-9);
  const pts: Pt[] = [{ x: x0, y: stepTop(s, x0) }];
  for (;;) {
    const edge = s.origin.x + (k + 1) * s.going, y = s.origin.y + s.dir * k * s.rise;
    if (edge >= x1) { pts.push({ x: x1, y }); return pts; }
    pts.push({ x: edge, y }, { x: edge, y: y + s.dir * s.rise });
    k++;
  }
}

// Back view of the trunk and right arm. x is to the subject's right, which
// is the viewer's right when looking from behind.
export type BackPose = {
  c7: Pt; sacrum: Pt; sc: Pt; ac: Pt;
  scapula: { root: Pt; superior: Pt; inferior: Pt; glenoid: Pt; acromion: Pt; spineMid: Pt; lateralBorder: Pt };
  humerusHead: Pt; elbow: Pt; wrist: Pt;
  leftShoulder: Pt; leftElbow: Pt; leftWrist: Pt;
  head: Pt;
};
export function backPose(a: BackAngles): BackPose {
  const c7 = { x: 0, y: 1.4 }, sacrum = { x: 0, y: 0.92 };
  // Rest position of the right scapula (BodyParts3D extents: x 0.059–0.169,
  // y 1.215–1.373), rotated upward about a centre that moves from the root
  // of the spine toward the acromioclavicular joint (Bagg & Forrest 1988).
  const rest = {
    root: { x: 0.075, y: 1.33 }, superior: { x: 0.085, y: 1.37 }, inferior: { x: 0.1, y: 1.215 },
    glenoid: { x: 0.165, y: 1.315 }, acromion: { x: 0.175, y: 1.36 }, spineMid: { x: 0.125, y: 1.345 }, lateralBorder: { x: 0.15, y: 1.26 },
  };
  const turn = a.upwardRotation; // a change from the rest pose
  const w = Math.min(Math.max(turn / 50, 0), 1);
  const pivot = { x: rest.root.x + (rest.acromion.x - rest.root.x) * w * 0.7, y: rest.root.y + (rest.acromion.y - rest.root.y) * w * 0.7 };
  // Upward rotation turns the glenoid to face up: counter-clockwise on the
  // viewer's right side when seen from behind.
  const spin = (p: Pt) => {
    const c = Math.cos(rad(turn)), s = Math.sin(rad(turn));
    const d = { x: p.x - pivot.x, y: p.y - pivot.y };
    return { x: pivot.x + d.x * c - d.y * s, y: pivot.y + d.x * s + d.y * c };
  };
  const lift = { x: 0, y: Math.sin(rad(a.clavicleElevation ?? 0)) * 0.14 };
  const scapula = Object.fromEntries(Object.entries(rest).map(([k, p]) => [k, add(spin(p), lift)])) as BackPose["scapula"];
  const sc = { x: 0.02, y: 1.35 };
  const ac = scapula.acromion;
  // Humerothoracic elevation: 0 = arm hanging, measured from the trunk.
  const humerusHead = add(scapula.glenoid, { x: 0.02, y: -0.01 });
  const along = { x: Math.sin(rad(a.elevation)), y: -Math.cos(rad(a.elevation)) };
  const elbow = add(humerusHead, along, SEG.upperArm);
  const wrist = add(elbow, along, SEG.forearm);
  const leftShoulder = { x: -0.185, y: 1.305 };
  const leftElbow = add(leftShoulder, { x: -0.02, y: -1 }, SEG.upperArm);
  const leftWrist = add(leftElbow, { x: -0.01, y: -1 }, SEG.forearm);
  return { c7, sacrum, sc, ac, scapula, humerusHead, elbow, wrist, leftShoulder, leftElbow, leftWrist, head: { x: 0, y: 1.55 } };
}

// Shape-preserving (monotone cubic, Fritsch–Carlson) interpolation through
// keyframes, so drawn angles never overshoot the cited values.
export function interpolate<A extends Record<string, number | undefined>>(frames: Keyframe<A>[], t: number, loop: boolean): A {
  const keys = Object.keys(frames[0].angles) as (keyof A)[];
  const out = {} as A;
  const ts = frames.map((f) => f.t);
  for (const key of keys) {
    const ys = frames.map((f) => f.angles[key] as number | undefined);
    if (ys.some((y) => y === undefined)) continue;
    out[key] = monotone(ts, ys as number[], t, loop) as A[keyof A];
  }
  return out;
}

export function monotone(xs: number[], ys: number[], x: number, loop: boolean): number {
  const n = xs.length;
  if (n === 1) return ys[0];
  if (loop) {
    // Close the cycle with the first frame one period later.
    xs = [...xs, xs[0] + 1];
    ys = [...ys, ys[0]];
    x = wrap(x - xs[0]) + xs[0];
  } else {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
  }
  const m = xs.length;
  const d: number[] = [];
  for (let i = 0; i < m - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const tan: number[] = [];
  for (let i = 0; i < m; i++) {
    if (i === 0 || i === m - 1) {
      tan.push(loop ? (d[0] + d[m - 2]) / 2 : i === 0 ? d[0] : d[m - 2]);
    } else tan.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  }
  if (loop && d[0] * d[m - 2] <= 0) { tan[0] = 0; tan[m - 1] = 0; }
  for (let i = 0; i < m - 1; i++) {
    if (d[i] === 0) { tan[i] = 0; tan[i + 1] = 0; continue; }
    const a = tan[i] / d[i], b = tan[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const s = 3 / Math.sqrt(h); tan[i] = s * a * d[i]; tan[i + 1] = s * b * d[i]; }
  }
  let i = 0;
  while (i < m - 2 && x > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i], s = (x - xs[i]) / h;
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
  return h00 * ys[i] + h10 * h * tan[i] + h01 * ys[i + 1] + h11 * h * tan[i + 1];
}

// Overlays (centre-of-mass line, ground reaction force) are cited only at
// some keyframes: one is drawn at a keyframe that carries it and, linearly
// interpolated, between two that both carry it — never across a gap.
type Com = NonNullable<Keyframe<SideAngles>["com"]>;
type Grf = NonNullable<Keyframe<SideAngles>["grf"]>;
// A force drawn between two keyframes also moves its starting point: `toward`
// names the next keyframe's point and how far along the way it is.
export type GrfAt = Grf & { toward?: { from: Grf["from"]; f: number } };
export function overlayAt(frames: Keyframe<SideAngles>[], t: number, key: "com", loop?: boolean): Com | null;
export function overlayAt(frames: Keyframe<SideAngles>[], t: number, key: "grf", loop?: boolean): GrfAt | null;
export function overlayAt(frames: Keyframe<SideAngles>[], t: number, key: "com" | "grf", loop = false): Com | GrfAt | null {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  // A looping movement closes the cycle with its first keyframe one period later.
  const list = loop && frames.length ? [...frames, { ...frames[0], t: frames[0].t + 1 }] : frames;
  if (loop) t = wrap(t - frames[0].t) + frames[0].t;
  for (let i = 0; i < list.length; i++) {
    const a = list[i], b = list[i + 1];
    if (near(t, a.t)) return a[key] ?? null;
    if (!b || t < a.t || t > b.t) continue;
    if (near(t, b.t)) return b[key] ?? null;
    const f = (t - a.t) / (b.t - a.t);
    if (key === "com") {
      if (!a.com || !b.com) return null;
      return { ...a.com, dx: a.com.dx + (b.com.dx - a.com.dx) * f, sources: [...new Set([...a.com.sources, ...b.com.sources])] };
    }
    if (!a.grf || !b.grf) return null;
    return { ...(f < 0.5 ? a.grf : b.grf), from: a.grf.from, toward: { from: b.grf.from, f }, angle: a.grf.angle + (b.grf.angle - a.grf.angle) * f, sources: [...new Set([...a.grf.sources, ...b.grf.sources])] };
  }
  return null;
}

// Muscle lines: anchor points on the posed skeleton (origin → via → insertion).
const along = (a: Pt, b: Pt, f: number) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
const off = (a: Pt, b: Pt, f: number, normal: number) => {
  // `normal` > 0 is to the front of a segment that runs from a (lower) to b (upper).
  const p = along(a, b, f), dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dy / len) * normal, y: p.y - (dx / len) * normal };
};
export const sideLines: Record<string, (p: SidePose, leg: Leg) => Pt[]> = {
  "gluteus-maximus": (p, l) => [off(l.hip, p.lumbosacral, 0.7, -0.075), off(l.hip, p.lumbosacral, -0.15, -0.07), off(l.knee, l.hip, 0.78, -0.03)],
  "gluteus-medius": (p, l) => [off(l.hip, p.lumbosacral, 0.95, -0.01), off(l.knee, l.hip, 0.97, -0.012)],
  vasti: (_p, l) => [off(l.knee, l.hip, 0.82, 0.02), off(l.knee, l.hip, 0.06, 0.055), off(l.ankle, l.knee, 0.9, 0.035)],
  "rectus-femoris": (p, l) => [off(l.hip, p.lumbosacral, 0.25, 0.06), off(l.knee, l.hip, 0.5, 0.05), off(l.knee, l.hip, 0.06, 0.055), off(l.ankle, l.knee, 0.9, 0.035)],
  hamstrings: (p, l) => [off(l.hip, p.lumbosacral, -0.45, -0.045), off(l.knee, l.hip, 0.5, -0.05), off(l.ankle, l.knee, 0.9, -0.035)],
  gastrocnemius: (_p, l) => [off(l.knee, l.hip, 0.06, -0.035), off(l.ankle, l.knee, 0.65, -0.055), l.heel],
  soleus: (_p, l) => [off(l.ankle, l.knee, 0.85, -0.03), off(l.ankle, l.knee, 0.45, -0.045), l.heel],
  "tibialis-anterior": (_p, l) => [off(l.ankle, l.knee, 0.82, 0.03), off(l.ankle, l.knee, 0.08, 0.035), along(l.ankle, l.mtp, 0.45)],
  iliopsoas: (p, l) => [off(p.lumbosacral, p.c7, 0.2, 0.03), off(l.hip, p.lumbosacral, 0.2, 0.06), off(l.knee, l.hip, 0.9, -0.005)],
  "erector-spinae": (p) => [off(p.lumbosacral, p.c7, -0.05, -0.05), off(p.lumbosacral, p.c7, 0.45, -0.055), off(p.lumbosacral, p.c7, 0.85, -0.04)],
  abdominals: (p, l) => [off(l.hip, p.lumbosacral, -0.05, 0.1), off(p.lumbosacral, p.c7, 0.3, 0.13), off(p.lumbosacral, p.c7, 0.6, 0.14)],
  sternocleidomastoid: (p) => [off(p.lumbosacral, p.c7, 0.97, 0.1), add(p.head, dir(p.trunk * 0.6 - 120), 0.06)],
};

export const backLines: Record<string, (p: BackPose) => Pt[]> = {
  deltoid: (p) => [p.ac, add(p.humerusHead, { x: 0.03, y: 0.0 }), along(p.humerusHead, p.elbow, 0.45)],
  supraspinatus: (p) => [along(p.scapula.superior, p.scapula.acromion, 0.15), along(p.scapula.superior, p.scapula.acromion, 0.7), add(p.humerusHead, { x: 0.012, y: 0.02 })],
  infraspinatus: (p) => [along(p.scapula.root, p.scapula.inferior, 0.45), along(p.scapula.spineMid, p.scapula.lateralBorder, 0.6), add(p.humerusHead, { x: 0.015, y: -0.005 })],
  "teres-minor": (p) => [along(p.scapula.lateralBorder, p.scapula.inferior, 0.3), add(p.humerusHead, { x: 0.01, y: -0.02 })],
  "serratus-anterior": (p) => [along(p.scapula.inferior, p.scapula.root, 0.15), { x: 0.2, y: 1.15 }],
  "trapezius-upper": (p) => [{ x: 0.0, y: 1.5 }, { x: 0.06, y: 1.43 }, along(p.ac, p.scapula.spineMid, 0.2)],
  "trapezius-middle": () => [{ x: 0, y: 1.33 }, { x: 0.07, y: 1.335 }],
  "trapezius-lower": (p) => [{ x: 0, y: 1.06 }, along(p.scapula.root, p.scapula.spineMid, 0.1)],
};

// The ground a stance foot covers: the forefoot always, the heel only while
// it is down (not in a heel raise or after heel-off in walking).
export const HEEL_DOWN = FLOOR_GAP + 0.005;
export function supportSpan(leg: Leg, ground: number) {
  const xs = [leg.mtp.x, leg.toe.x, ...(leg.heel.y - ground <= HEEL_DOWN ? [leg.heel.x] : [])];
  return { lo: Math.min(...xs), hi: Math.max(...xs), y: ground };
}

// Position on a movement's timeline: a looping movement wraps, a single
// movement stops at its ends.
export const cycle = (m: Pick<Movement, "loop">, t: number) => m.loop ? wrap(t) : Math.min(Math.max(t, 0), 1);

// Angles drawn at time t (0–1). Walking draws the left leg half a cycle later.
export function figureAt(m: Movement, t: number) {
  return m.view === "back"
    ? interpolate(m.keyframes as Keyframe<BackAngles>[], t, m.loop)
    : interpolate(m.keyframes as Keyframe<SideAngles>[], t, m.loop);
}
export function sidePose(m: Movement, t: number): SidePose {
  const frames = m.keyframes as Keyframe<SideAngles>[];
  const right = interpolate(frames, t, m.loop);
  if (m.slug === "walking") return walkingPose(right, interpolate(frames, t + 0.5, m.loop), t);
  if (m.stairs) return stairPose(right, interpolate(frames, t + 0.5, m.loop), t, m.stairs);
  return footFixedPose(right, m.slug === "standing" ? "hanging" : "crossed");
}

// A span ends when its event happens (seat-off leaves the seat), except the
// one that runs to the end of the timeline.
export const within = (spans: [number, number][] | undefined, t: number) => Boolean(spans?.some(([a, b]) => t >= a - 1e-6 && (t < b - 1e-6 || (b >= 1 && t <= b))));

export type PhaseMuscle = { row: MuscleRow; cell: MuscleCell };
const DRAWN = new Set(["concentric", "eccentric", "isometric", "active"]);
// Muscles drawn on the diagram, in number order: those with a line whose
// call is a contraction or activity (inhibited/silent/no data stay as text).
export function drawnMuscles(m: Movement, phaseMuscles: PhaseMuscle[], on = true) {
  return on ? phaseMuscles.filter(({ row, cell }) => row.line && DRAWN.has(cell.contraction) && (m.view === "back" ? backLines[row.line] : sideLines[row.line])) : [];
}

// Contact events of the two-legged cycles (walking, stairs); null when the
// right foot never leaves the ground.
export function contactsOf(m: Movement): Contacts | null {
  return m.slug === "walking" ? GAIT : m.stairs ? stairContacts(m.stairs) : null;
}
export function stanceAt(m: Movement, t: number) {
  const c = contactsOf(m);
  if (!c) return { right: true, left: false };
  const x = cycle(m, t);
  return { right: x < c.stanceEnd, left: (x + 0.5) % 1 < c.stanceEnd };
}

// Which overlays the diagram draws at time t (named in the key under it,
// not inside the drawing, so no label is clipped or covers a muscle line).
// Walking and stairs: the right foot carries the force only in its stance.
export function overlaysAt(m: Movement, t: number, on: { com: boolean; grf: boolean }) {
  if (m.view !== "side") return { com: false, grf: false, bos: false, seat: false };
  const frames = m.keyframes as Keyframe<SideAngles>[];
  const x = m.loop ? cycle(m, t) : t;
  const rightStance = stanceAt(m, x).right;
  return { com: on.com && Boolean(overlayAt(frames, x, "com", m.loop)), grf: on.grf && rightStance && Boolean(overlayAt(frames, x, "grf", m.loop)), bos: on.com, seat: on.com && within(m.seated, x) };
}
