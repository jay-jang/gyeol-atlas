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
// "low" = recorded, but the phase mean stays under the movement's stated
// editorial cut (Movement.emg.cut; not a detection limit);
// "silent" = no activity detected by the cited recording; "disputed" = the
// sources disagree or report activity in only some subjects, so no call is
// made (the note says why); "nodata" = the sources say nothing (never drawn
// as inactive).
export type Contraction = "concentric" | "eccentric" | "isometric" | "active" | "low" | "inhibited" | "silent" | "disputed" | "nodata";
export const contractionNames: Record<Contraction, string> = {
  concentric: "단축성",
  eccentric: "신장성",
  isometric: "등척성",
  active: "활동",
  low: "평균 진폭 낮음",
  inhibited: "억제",
  silent: "검출 안 됨",
  disputed: "판정 보류",
  nodata: "자료 없음",
};

export type Cited = { sources: string[]; note?: string };

// Side view: degrees, positive = dorsiflexion / flexion. `trunk` is the
// thorax inclination from vertical (forward +) where a source reports it;
// otherwise pelvis and trunk stay rigid. Walking and stair keyframes give
// the right leg; the left leg is the same curve half a cycle later. In those
// cycles the pelvis is drawn upright unless `pelvis` gives its tilt from the
// same source (anterior +), and `hip` is then measured from the pelvis.
// `foot` (foot-fixed poses only) pitches the foot about its
// metatarsophalangeal joint, heel up +; `ankle` is then measured from the
// pitched foot.
export type SideAngles = { ankle: number; knee: number; hip: number; trunk?: number; toe?: number; pelvis?: number; foot?: number };
// Back view of the right shoulder: humerothoracic elevation, scapular
// upward rotation and clavicle elevation, all in degrees.
export type BackAngles = { elevation: number; upwardRotation: number; clavicleElevation?: number };

export type Keyframe<A> = Cited & {
  t: number; // 0–1 of the drawn cycle
  event?: string;
  angles: A;
  // Where the drawn angles were adjusted (stair double support, loop seam):
  // the source values and the between-subject SD they stay within.
  measured?: { angles: A; sd: A };
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
  alias?: string; // another Korean name shown beside the title (heel raise: 발꿈치 들기)
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
  // Stair gait (src/movement-figure.ts stairPose): the staircase of the
  // cited study in metres, the right toe-off as a share of the cycle (left
  // contact at half a cycle), and where each stance foot's
  // metatarsophalangeal joint sits: metres from the step edge onto the tread.
  stairs?: Cited & { direction: "up" | "down"; rise: number; going: number; stanceEnd: number; fromEdge: number };
  muscles: MuscleRow[];
  joints: JointRow[];
  mechanics: (Cited & { text: string })[];
  passive: PassiveRow[];
  absent: string[]; // structures not modelled in the 3D atlas
  misconceptions: (Cited & { wrong: string; better: string })[];
  limitations: string[];
  // Phase means of one EMG recording, shown instead of the activity strip:
  // per muscle row (`label` names the muscle actually recorded), % of the
  // reference named in `reference`; values under `cut` are drawn pale.
  // `basis` says how the phase means were formed when not from grand-mean envelopes.
  emg?: Cited & { basis?: string; reference: string; cut: number; rows: { muscle: string; label: string; values: Record<string, number> }[] };
  figureNote?: string; // replaces the default note under the diagram
  // Sentence links to other movements where a numeric comparison box would
  // pair unlike tasks (heel-raise CONSENSUS §8): the movement, optionally one
  // of its phases, and what to compare.
  related?: (Cited & { slug: string; phase?: string; text: string })[];
  // An unscaled principle figure under the mechanics text (heel raise: the
  // ankle moment arms r and d, src/MovementFigure.tsx AnkleMomentArms).
  principle?: Cited & { figure: "ankle-moment-arms"; caption: string };
};

// A comparison shown on both pages of a pair of movements
// (data/movement-contrasts.json): one value per movement in each row, and
// the phases that correspond, so each page links to its counterpart.
export type Contrast = {
  id: string;
  title: string;
  movements: [string, string];
  lead: string;
  rows: (Cited & { label: string; values: [string, string] })[];
  phases: [string, string][];
  note?: string;
};

export type Source = {
  id: string;
  citation: string;
  url?: string;
  // How far the claim was checked: full text, abstract, a secondary source,
  // or a public data file opened and computed from.
  checked: "본문" | "초록" | "2차 인용" | "미리보기" | "공개 데이터";
  usedFor: string;
  short?: string; // citation label when "first author 외 year" would be ambiguous (a dataset)
};
