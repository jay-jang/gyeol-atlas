import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { add, backLines, backPose, contactsOf, cycle, drawnMuscles, figureAt, footFixedPose, overlayAt, overlaysAt, rotate as rot, sideLines, sidePose, stanceAt, stepOutline, stepTop, supportSpan, within, type BackPose, type Leg, type PhaseMuscle, type Pt, type SidePose } from "./movement-figure";
import { contractionNames, type BackAngles, type Contraction, type Keyframe, type Movement, type MuscleCell, type MuscleRow, type SideAngles } from "./movement-types";

const dash: Record<string, string | undefined> = { eccentric: "0.05 0.03", isometric: "0.004 0.022", active: undefined, concentric: undefined };
const P = (p: Pt) => `${p.x.toFixed(4)},${(-p.y).toFixed(4)}`;
const line = (pts: Pt[]) => `M${pts.map(P).join("L")}`;
// Point at fraction f along a polyline.
const along = (pts: Pt[], f: number) => {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let rest = lens.reduce((a, b) => a + b, 0) * f;
  for (let i = 0; i < lens.length; i++) {
    if (rest <= lens[i]) { const k = rest / (lens[i] || 1); return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k }; }
    rest -= lens[i];
  }
  return pts[pts.length - 1];
};
// Muscle numbers sit on their lines, moved along a line (then just beside
// it, then on rings around its middle) when another number is already there.
// In a crowded small drawing with no free spot, a number goes where it
// overlaps least, so none is hidden under another.
function placeBadges(lines: Pt[][], r: number, box: { x: number; y: number; w: number; h: number }) {
  const placed: Pt[] = [];
  // Numbers stay inside the drawing.
  const inside = (c: Pt) => ({ x: Math.min(Math.max(c.x, box.x + r * 1.2), box.x + box.w - r * 1.2), y: Math.min(Math.max(c.y, box.y + r * 1.2), box.y + box.h - r * 1.2) });
  for (const pts of lines) {
    const fractions = [0.5, 0.38, 0.62, 0.28, 0.72, 0.18, 0.82, 0.1, 0.9];
    const onLine = fractions.map((f) => inside(along(pts, f)));
    const mid = along(pts, 0.5), a = pts[0], b = pts[pts.length - 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
    const beside = [1, -1, 2, -2].map((k) => inside({ x: mid.x + n.x * r * 2.4 * k, y: mid.y + n.y * r * 2.4 * k }));
    const rings = [2.4, 3.6, 4.8].flatMap((k) => Array.from({ length: 12 }, (_, i) => inside({ x: mid.x + Math.cos((i * Math.PI) / 6) * r * k, y: mid.y + Math.sin((i * Math.PI) / 6) * r * k })));
    const candidates = [...onLine, ...beside, ...rings];
    const gap = (c: Pt) => Math.min(Infinity, ...placed.map((q) => Math.hypot(c.x - q.x, c.y - q.y)));
    const free = candidates.find((c) => gap(c) > r * 2.2);
    placed.push(free ?? candidates.reduce((best, c) => (gap(c) > gap(best) ? c : best)));
  }
  return placed;
}

function bounds(m: Movement) {
  const xs: number[] = [], ys: number[] = [];
  const push = (p: Pt) => { xs.push(p.x); ys.push(p.y); };
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    if (m.view === "back") {
      const p = backPose(figureAt(m, t) as BackAngles);
      [p.wrist, p.elbow, p.leftWrist, p.sacrum, p.head].forEach(push);
      push({ x: p.head.x, y: p.head.y + 0.13 });
    } else {
      const p = sidePose(m, t);
      [p.right.toe, p.right.heel, p.left.toe, p.left.heel, p.right.knee, p.left.knee, p.lumbosacral, p.c7, p.elbow, p.wrist].forEach(push);
      push({ x: p.head.x - 0.11, y: p.head.y + 0.13 });
      push({ x: p.head.x + 0.11, y: p.head.y });
      // The treads under both feet stay in view.
      if (p.steps) for (const l of [p.right, p.left]) ys.push(stepTop(p.steps, l.mtp.x) - 0.04);
    }
  }
  if (m.view === "side" && !m.stairs) ys.push(-0.02);
  const pad = 0.08;
  const box = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad / 2, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 1.5 };
  // Stairs: widen to show the steps before and after the body, at the same
  // height (the drawing keeps its scale; the extra width is staircase).
  if (m.stairs && box.w < box.h * 1.05) { box.x -= (box.h * 1.05 - box.w) / 2; box.w = box.h * 1.05; }
  return box;
}

// A backless stool for rising and sitting, under the seated pose: the seat
// top sits under the ischial tuberosities (about 9.5 cm below the hip centre).
function seatOf(m: Movement) {
  if (!m.seated?.length) return null;
  const p = sidePose(m, m.seated[0][0]);
  return { top: p.right.hip.y - 0.095, front: p.right.knee.x - 0.07 };
}

function Leg({ leg, far }: { leg: Leg; far?: boolean }) {
  const patella = add(leg.knee, rot({ x: 0.045, y: 0.01 }, leg.thigh));
  const mtpTop = add(leg.mtp, rot({ x: 0, y: 0.016 }, leg.footPitch));
  const ankleBack = add(leg.ankle, rot({ x: -0.03, y: -0.01 }, leg.footPitch));
  return (
    <g className={far ? "mv-bone mv-far" : "mv-bone"}>
      <path className="mv-foot" d={`${line([leg.heel, ankleBack, leg.ankle, mtpTop, leg.toe, leg.mtp])}Z`} />
      <path d={line([add(leg.ankle, rot({ x: -0.022, y: 0.01 }, leg.shank)), add(leg.knee, rot({ x: -0.025, y: -0.03 }, leg.shank))])} className="mv-fibula" />
      <path d={line([leg.ankle, leg.knee])} className="mv-long" />
      <path d={line([leg.knee, leg.hip])} className="mv-long mv-femur" />
      {!far && <ellipse cx={patella.x} cy={-patella.y} rx={0.022} ry={0.03} className="mv-patella" transform={`rotate(${leg.thigh} ${patella.x} ${-patella.y})`} />}
      {[leg.hip, leg.knee, leg.ankle].map((p, i) => <circle key={i} cx={p.x} cy={-p.y} r={0.014} className="mv-joint" />)}
    </g>
  );
}

function SideSkeleton({ p }: { p: SidePose }) {
  // Pelvis outline, sacrum, spine, rib cage and skull, oriented by the pelvis
  // and trunk angles (local x = front, y = up). Shapes are editorial; joint
  // centres follow the pose.
  const at = (o: Pt, deg: number) => (v: Pt) => add(o, rot(v, deg));
  const pv = at(p.right.hip, p.pelvis);
  const pelvis = [pv({ x: -0.07, y: 0.12 }), pv({ x: 0.01, y: 0.16 }), pv({ x: 0.06, y: 0.07 }), pv({ x: 0.05, y: -0.04 }), pv({ x: 0.0, y: -0.075 }), pv({ x: -0.05, y: -0.06 }), pv({ x: -0.06, y: 0.02 })];
  const tr = at(p.lumbosacral, p.trunk);
  const spine = [p.lumbosacral, tr({ x: 0.025, y: 0.12 }), tr({ x: 0.0, y: 0.24 }), tr({ x: -0.02, y: 0.36 }), p.c7];
  const ribs = [tr({ x: 0.0, y: 0.2 }), tr({ x: 0.1, y: 0.18 }), tr({ x: 0.16, y: 0.3 }), tr({ x: 0.15, y: 0.42 }), tr({ x: 0.06, y: 0.45 }), tr({ x: -0.01, y: 0.43 })];
  const head = p.head;
  return (
    <g className="mv-bone">
      <path className="mv-pelvis" d={`${line(pelvis)}Z`} />
      <path className="mv-spine" d={line(spine)} />
      {spine.slice(1, -1).map((v, i) => <circle key={i} cx={v.x} cy={-v.y} r={0.012} className="mv-vertebra" />)}
      <path className="mv-ribs" d={`${line(ribs)}Z`} />
      <ellipse cx={head.x} cy={-head.y} rx={0.09} ry={0.11} className="mv-skull" transform={`rotate(${p.trunk * 0.6} ${head.x} ${-head.y})`} />
      <path d={line([p.shoulder, p.elbow])} className="mv-long mv-arm" />
      <path d={line([p.elbow, p.wrist])} className="mv-long mv-arm" />
      {[p.shoulder, p.elbow].map((v, i) => <circle key={i} cx={v.x} cy={-v.y} r={0.013} className="mv-joint" />)}
    </g>
  );
}

function BackSkeleton({ p }: { p: BackPose }) {
  const s = p.scapula;
  const mirror = (v: Pt) => ({ x: -v.x, y: v.y });
  const rest = backPose({ elevation: 0, upwardRotation: 0 }).scapula;
  const scap = (q: BackPose["scapula"]) => [q.superior, q.acromion, q.glenoid, q.lateralBorder, q.inferior, q.root];
  return (
    <g className="mv-bone">
      <path className="mv-ribs" d="M-0.12,-1.37 C-0.17,-1.3 -0.17,-1.12 -0.12,-1.04 L0.12,-1.04 C0.17,-1.12 0.17,-1.3 0.12,-1.37 Z" />
      <path className="mv-pelvis" d="M-0.15,-0.98 C-0.17,-0.92 -0.12,-0.86 -0.05,-0.85 L0.05,-0.85 C0.12,-0.86 0.17,-0.92 0.15,-0.98 Z" />
      <path className="mv-spine" d={line([p.sacrum, p.c7])} />
      {Array.from({ length: 11 }, (_, i) => <circle key={i} cx={0} cy={-(0.97 + i * 0.04)} r={0.009} className="mv-vertebra" />)}
      <ellipse cx={0} cy={-p.head.y} rx={0.085} ry={0.105} className="mv-skull" />
      <path className="mv-scapula mv-far" d={`${line(scap(rest).map(mirror))}Z`} />
      <path className="mv-long mv-arm mv-far" d={line([p.leftShoulder, p.leftElbow, p.leftWrist])} />
      <path className="mv-clavicle" d={line([p.sc, p.ac])} />
      <path className="mv-clavicle mv-far" d={line([mirror(p.sc), mirror(rest.acromion)])} />
      <path className="mv-scapula" d={`${line(scap(s))}Z`} />
      <path className="mv-scap-spine" d={line([s.root, s.spineMid, s.acromion])} />
      <path className="mv-long mv-arm" d={line([p.humerusHead, p.elbow])} />
      <path className="mv-long mv-arm" d={line([p.elbow, p.wrist])} />
      {[p.humerusHead, p.elbow].map((v, i) => <circle key={i} cx={v.x} cy={-v.y} r={0.013} className="mv-joint" />)}
    </g>
  );
}

// A muscle's call in words first, with the line style the diagram uses.
export function ContractionLabel({ c }: { c: Contraction }) {
  return <span className={`mv-c mv-c-${c}`}><i aria-hidden="true" />{contractionNames[c]}</span>;
}
export function OverlayKey({ state }: { state: ReturnType<typeof overlaysAt> }) {
  if (!state.com && !state.grf && !state.bos) return null;
  return (
    <ul className="mv-overlay-key" aria-label="겹쳐 그린 표시">
      {state.bos && <li><i className="mv-key-bos" aria-hidden="true" />지지면{state.seat ? "(바닥과 좌면)" : ""}</li>}
      {state.com && <li><i className="mv-key-com" aria-hidden="true" />체중심 수직선(출처의 측정 위치)</li>}
      {state.grf && <li><i className="mv-key-grf" aria-hidden="true" />지면반력 방향(길이는 상대 크기)</li>}
    </ul>
  );
}
export function MuscleLegend({ drawn }: { drawn: PhaseMuscle[] }) {
  if (!drawn.length) return null;
  return (
    <ol className="mv-legend" aria-label="도식의 근육 번호">
      {drawn.map(({ row, cell }, i) => <li key={row.id}><span className="mv-legend-no">{i + 1}</span>{row.name} <ContractionLabel c={cell.contraction} /></li>)}
    </ol>
  );
}

// Unscaled principle figure of the ankle moment arms (heel-raise CONSENSUS §5):
// the drawn foot at its highest pitch as a free body, the Achilles tendon
// pulling along the shank, the ground force under the forefoot (not pinned to
// the metatarsophalangeal joint) and the perpendicular distances r and d from
// the ankle centre, without numbers.
export function AnkleMomentArms({ movement: m }: { movement: Movement }) {
  const frames = m.keyframes as Keyframe<SideAngles>[];
  const top = frames.reduce((a, k) => ((k.angles.foot ?? 0) > (a.angles.foot ?? 0) ? k : a), frames[0]);
  const leg = footFixedPose(top.angles).right;
  const K = 1000, x0 = leg.heel.x - 0.13, x1 = leg.toe.x + 0.09, y1 = leg.ankle.y + 0.2;
  const S = (p: Pt) => `${((p.x - x0) * K).toFixed(1)},${((y1 - p.y) * K).toFixed(1)}`;
  const path = (pts: Pt[]) => `M${pts.map(S).join("L")}`;
  const along = { x: Math.sin((leg.shank * Math.PI) / 180), y: Math.cos((leg.shank * Math.PI) / 180) };
  const mtpTop = add(leg.mtp, rot({ x: 0, y: 0.016 }, leg.footPitch));
  const ankleBack = add(leg.ankle, rot({ x: -0.03, y: -0.01 }, leg.footPitch));
  // Achilles line: from the back of the heel outline, parallel to the shank.
  const insertion = { x: (leg.heel.x + ankleBack.x) / 2, y: (leg.heel.y + ankleBack.y) / 2 };
  const tendonTop = add(insertion, along, 0.17);
  // Ground force: vertical, from the underside of the forefoot a third of the
  // way from the MTP joint to the toe tip; the floor line meets the toe tip
  // (the drawn foot rests FLOOR_GAP above the diagram's floor).
  const cop = { x: leg.mtp.x + (leg.toe.x - leg.mtp.x) / 3, y: leg.mtp.y + (leg.toe.y - leg.mtp.y) / 3 };
  const floor = leg.toe.y;
  const grfTop = { x: cop.x, y: 0.19 };
  // Perpendicular feet from the ankle centre to both lines.
  const k = (leg.ankle.x - insertion.x) * along.x + (leg.ankle.y - insertion.y) * along.y;
  const rFoot = add(insertion, along, k), dFoot = { x: cop.x, y: leg.ankle.y };
  const W = (x1 - x0) * K, H = y1 * K + 24;
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const at = (p: Pt, dx = 0, dy = 0) => ({ x: (p.x - x0) * K + dx, y: (y1 - p.y) * K + dy });
  const label = (p: { x: number; y: number }, text: string, anchor: "start" | "middle" | "end" = "start", cls = "") =>
    <text x={p.x.toFixed(1)} y={p.y.toFixed(1)} textAnchor={anchor} className={cls || undefined}>{text}</text>;
  return (
    <svg className="mv-principle-svg" viewBox={`0 0 ${W.toFixed(0)} ${H.toFixed(0)}`} width={W.toFixed(0)} height={H.toFixed(0)} role="img"
      aria-label="발목 모멘트팔 원리 그림: 발목 중심에서 발꿈치힘줄 작용선까지 수직거리 r, 지면반력 작용선까지 수직거리 d. 축척과 숫자 없음.">
      <defs><marker id="mv-pr-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" className="mv-pr-head" /></marker></defs>
      <path className="mv-pr-floor" d={path([{ x: x0, y: floor }, { x: x1, y: floor }])} />
      <g className="mv-bone mv-pr-bone">
        <path className="mv-pr-shank" d={path([leg.ankle, add(leg.ankle, along, 0.19)])} />
        <path className="mv-pr-foot" d={`${path([leg.heel, ankleBack, leg.ankle, mtpTop, leg.toe, leg.mtp])}Z`} />
      </g>
      <path className="mv-pr-force" d={path([insertion, tendonTop])} markerEnd="url(#mv-pr-arrow)" />
      <path className="mv-pr-force" d={path([cop, grfTop])} markerEnd="url(#mv-pr-arrow)" />
      <path className="mv-pr-dim" d={path([leg.ankle, rFoot])} />
      <path className="mv-pr-dim" d={path([leg.ankle, dFoot])} />
      <circle cx={at(leg.ankle).x} cy={at(leg.ankle).y} r={5} className="mv-pr-ankle" />
      {label(at(mid(leg.ankle, rFoot), 0, -8), "r", "middle", "mv-pr-dim-label")}
      {label(at(mid(leg.ankle, dFoot), 0, 20), "d", "middle", "mv-pr-dim-label")}
      {label(at(leg.ankle, 12, -12), "발목 중심")}
      {label(at(tendonTop, -6, 4), "발꿈치힘줄 힘", "end")}
      {label(at(grfTop, 6, 4), "지면반력")}
      {label(at({ x: cop.x, y: floor }, 0, 20), "앞발 아래(압력중심)", "middle")}
    </svg>
  );
}

export function MovementFigure({ movement: m, t, overlays, phaseMuscles }: {
  movement: Movement; t: number; overlays: { muscles: boolean; com: boolean; grf: boolean }; phaseMuscles: PhaseMuscle[];
}) {
  const box = useMemo(() => bounds(m), [m]);
  const seat = useMemo(() => seatOf(m), [m]);
  const ref = useRef<SVGSVGElement>(null);
  const [unit, setUnit] = useState(0.025); // metres per 12.5 CSS px
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    // The drawing scales to fit both sides of the box; text keeps 12.5 px.
    const update = () => { const r = svg.getBoundingClientRect(); if (r.width && r.height) setUnit(12.5 / Math.min(r.width / box.w, r.height / box.h)); };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [box.w]);

  const drawn = drawnMuscles(m, phaseMuscles, overlays.muscles);
  let body: ReactNode, lines: { row: MuscleRow; cell: MuscleCell; pts: Pt[] }[] = [], extras: ReactNode = null, stairs: Pt[] | null = null;
  if (m.view === "back") {
    const p = backPose(figureAt(m, t) as BackAngles);
    body = <BackSkeleton p={p} />;
    lines = drawn.map(({ row, cell }) => ({ row, cell, pts: backLines[row.line!](p) }));
  } else {
    const p = sidePose(m, t);
    if (p.steps) stairs = stepOutline(p.steps, box.x - 0.05, box.x + box.w + 0.05);
    const twoLegs = Boolean(contactsOf(m));
    body = <>{twoLegs && <Leg leg={p.left} far />}<SideSkeleton p={p} /><Leg leg={p.right} /></>;
    lines = drawn.map(({ row, cell }) => ({ row, cell, pts: sideLines[row.line!](p, p.right) }));
    const frames = m.keyframes as Keyframe<SideAngles>[];
    const x = m.loop ? cycle(m, t) : t;
    const com = overlays.com ? overlayAt(frames, x, "com", m.loop) : null;
    // Walking and stairs: which foot is down follows the contact events
    // (right stance from contact to toe-off, left half a cycle later), not
    // how close a foot is to the ground.
    const stance = stanceAt(m, x);
    const grf = overlays.grf && stance.right ? overlayAt(frames, x, "grf", m.loop) : null;
    // The surface under a foot: the floor, or its tread on the stairs.
    const ground = (leg: Leg) => p.steps ? stepTop(p.steps, leg.mtp.x) : 0;
    // Base of support: the parts of each stance foot that are down (each on
    // its own tread on the stairs; supportSpan), plus the seat while the
    // buttocks rest on it.
    const feet = [stance.right && p.right, stance.left && p.left].filter(Boolean) as Leg[];
    const spans = feet.map((leg) => supportSpan(leg, ground(leg)));
    const bands = p.steps ? spans : spans.length ? [{ lo: Math.min(...spans.map((s) => s.lo)), hi: Math.max(...spans.map((s) => s.hi)), y: 0 }] : [];
    const seated = seat && within(m.seated, x);
    const from = (leg: Leg, where: string) => ({ heel: leg.heel, mid: { x: (leg.heel.x + leg.mtp.x) / 2, y: 0 }, mtp: leg.mtp, toe: leg.toe }[where] ?? leg.mtp);
    extras = (
      <g className="mv-overlay">
        {overlays.com && bands.map((b, i) => <rect key={i} className="mv-bos" x={b.lo} y={-(b.y + 0.008)} width={b.hi - b.lo} height={0.016} />)}
        {overlays.com && seated && <rect className="mv-bos mv-bos-seat" x={p.right.hip.x - 0.08} y={-(seat!.top + 0.008)} width={0.12} height={0.016} />}
        {com && (() => {
          const at = p.right.ankle.x + com.dx;
          return <g className="mv-com"><path d={`M${at.toFixed(4)},${(-(p.c7.y + 0.05)).toFixed(4)}V${(-ground(p.right)).toFixed(4)}`} /></g>;
        })()}
        {grf && (() => {
          const len = { small: 0.22, medium: 0.36, large: 0.5 }[grf.size];
          // The centre of pressure slides from one cited point to the next.
          const start = from(p.right, grf.from).x, end = grf.toward ? from(p.right, grf.toward.from).x : start;
          const base = { x: start + (end - start) * (grf.toward?.f ?? 0), y: ground(p.right) };
          const tip = add(base, { x: Math.sin((grf.angle * Math.PI) / 180), y: Math.cos((grf.angle * Math.PI) / 180) }, len);
          return <g className="mv-grf"><path d={line([base, tip])} markerEnd="url(#mv-arrow)" /></g>;
        })()}
      </g>
    );
  }
  return (
    <>
      <svg ref={ref} className="mv-svg" viewBox={`${box.x} ${-(box.y + box.h)} ${box.w} ${box.h}`} role="img" style={{ "--mv-ratio": box.w / box.h } as CSSProperties}
        aria-label={`${m.name} 도식, ${lines.map((l) => `${l.row.name} ${contractionNames[l.cell.contraction]}`).join(", ") || "근육 작용선 없음"}`}>
        <defs>
          <marker id="mv-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" className="mv-arrowhead" /></marker>
        </defs>
        {m.view === "side" && !m.stairs && <path className="mv-floor" d={`M${box.x},0H${box.x + box.w}`} />}
        {stairs && <path className="mv-stairs" d={`${line([...stairs, { x: stairs[stairs.length - 1].x, y: box.y - 0.5 }, { x: stairs[0].x, y: box.y - 0.5 }])}Z`} />}
        {seat && <g className="mv-chair"><path d={`M${seat.front},${-seat.top}H${seat.front - 0.42}`} /><path d={`M${seat.front - 0.03},${-seat.top}V0M${seat.front - 0.39},${-seat.top}V0`} /></g>}
        {body}
        {extras}
        <g className="mv-muscles">
          {lines.map(({ row, cell, pts }) => <path key={row.id} d={line(pts)} className={`mv-line mv-line-${cell.contraction}`} strokeDasharray={dash[cell.contraction]} />)}
          {placeBadges(lines.map((l) => l.pts), unit * 0.75, box).map((c, i) => (
            <g key={lines[i].row.id} className="mv-badge"><circle cx={c.x} cy={-c.y} r={unit * 0.75} /><text x={c.x} y={-c.y} fontSize={unit} dy="0.35em" textAnchor="middle">{i + 1}</text></g>
          ))}
        </g>
      </svg>
    </>
  );
}
