// Data model of the movement-mechanics page (docs/movement-mechanics/CONSENSUS.md).
// Every number and every contraction call carries its source keys
// (data/movement-sources.json) and the kind of evidence behind it.

export type Evidence = "emg" | "ultrasound" | "dynamics" | "model" | "inference";
export const evidenceNames: Record<Evidence, string> = {
  emg: "근전도",
  ultrasound: "초음파",
  dynamics: "역학",
  model: "모델",
  inference: "추론",
};

// What a muscle does in one phase. "active" = active, mode not established;
// "silent" = no activity detected by the cited recording; "nodata" = the
// sources say nothing (never drawn as inactive).
export type Contraction = "concentric" | "eccentric" | "isometric" | "active" | "inhibited" | "silent" | "nodata";
export const contractionNames: Record<Contraction, string> = {
  concentric: "단축성",
  eccentric: "신장성",
  isometric: "등척성",
  active: "활동",
  inhibited: "억제",
  silent: "검출 안 됨",
  nodata: "자료 없음",
};

export type Cited = { sources: string[]; note?: string };

// Side view: degrees, positive = dorsiflexion / flexion. `trunk` is the
// thorax inclination from vertical (forward +) where a source reports it;
// otherwise pelvis and trunk stay rigid. Walking keyframes give the right
// leg; the left leg is the same curve half a cycle later.
export type SideAngles = { ankle: number; knee: number; hip: number; trunk?: number; toe?: number };
// Back view of the right shoulder: humerothoracic elevation, scapular
// upward rotation and clavicle elevation, all in degrees.
export type BackAngles = { elevation: number; upwardRotation: number; clavicleElevation?: number };

export type Keyframe<A> = Cited & {
  t: number; // 0–1 of the drawn cycle
  event?: string;
  angles: A;
  // Optional overlays, each drawn only where a source supports it.
  com?: Cited & { dx: number }; // metres in front of the ankle centre
  // Ground reaction force of the right (reference) foot: direction from vertical
  // (forward +), relative size, and where under the foot it starts (the centre
  // of pressure moves from the heel to the forefoot during stance).
  grf?: Cited & { angle: number; size: "small" | "medium" | "large"; from: "heel" | "mid" | "mtp" | "toe" };
};

export type Phase = {
  id: string; // also the URL slug
  name: string;
  nameEn?: string;
  start: number; // 0–1 of the drawn cycle
  end: number;
  range?: string; // as printed, e.g. "주기 2–12%" or "위팔 거상 30–120°"
  events: string;
  summary: string;
  mechanics?: string[];
  sources: string[];
};

export type MuscleCell = Cited & { contraction: Contraction; evidence: Evidence[]; role?: string };

export type MuscleRow = {
  id: string;
  name: string; // Korean
  nameEn: string; // original English name(s)
  // Male source ids; the atlas link opens these (a left/right pair or the
  // parts of one muscle become a bundle).
  structures: string[];
  // Optional same-named female structures (checked by tests/movements.test.mjs).
  female?: string[];
  line?: string; // muscle path drawn on the figure (src/movement-figure.ts)
  cells: Record<string, MuscleCell>; // keyed by phase id
};

export type PassiveRow = Cited & { name: string; nameEn: string; structures: string[]; role: string; female?: string[] };
export type JointRow = Cited & { joint: string; values: string; population: string };

export type Movement = {
  slug: string;
  name: string;
  nameEn: string;
  view: "side" | "back";
  plane: string; // e.g. "시상면"
  order: number;
  summary: string;
  conditions: string; // population and task conditions
  duration?: Cited & { seconds: number };
  loop: boolean;
  phaseKind: string; // e.g. "국면", "상태", "구간"
  phases: Phase[];
  keyframes: Keyframe<SideAngles>[] | Keyframe<BackAngles>[];
  timingNote: string; // how the drawn timeline was set
  // Spans of the timeline (0–1) while the buttocks rest on the seat; the
  // diagram draws a stool and adds the seat to the base of support then.
  seated?: [number, number][];
  sway?: { exaggeration: number }; // standing: drawn sway is magnified
  muscles: MuscleRow[];
  joints: JointRow[];
  mechanics: (Cited & { text: string })[];
  passive: PassiveRow[];
  absent: string[]; // structures not modelled in the 3D atlas
  misconceptions: (Cited & { wrong: string; better: string })[];
  limitations: string[];
};

export type Source = {
  id: string;
  citation: string;
  url?: string;
  // How far the claim was checked: full text, abstract, or a secondary source.
  checked: "본문" | "초록" | "2차 인용" | "미리보기";
  usedFor: string;
};
