// Movement-mechanics data (docs/movement-mechanics/CONSENSUS.md §7).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { FLOOR_GAP, GAIT, MTP_ABOVE, backLines, cycle, backPose, footFixedPose, interpolate, sideLines, sidePose, stairContacts, stairHold, stairPose, stepOutline, stepTop, walkingPose } from "../src/movement-figure.ts";

const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const slugs = ["standing", "sit-to-stand", "stand-to-sit", "walking", "stair-ascent", "stair-descent", "arm-elevation"];
const STAIRS = ["stair-ascent", "stair-descent"];
const movements = slugs.map((slug) => read(`data/movements/${slug}.json`));
const sources = read("data/movement-sources.json");
const contrasts = read("data/movement-contrasts.json");
const sourceIds = new Set(sources.map((s) => s.id));
const catalogue = new Map([
  ...read("scripts/model-inputs.json").assets,
  ...read("data/full-system-structures.json"),
  ...read("data/connective-structures.json"),
].map((s) => [s.id, s]));
const female = new Set([...read("data/female-atlas-structures.json").map((s) => s.id),
  ...read("data/female-composite-groups.json").flatMap((g) => [g.id, ...(g.ids || [])])]);
const CONTRACTIONS = ["concentric", "eccentric", "isometric", "active", "low", "inhibited", "silent", "disputed", "nodata"];
const EVIDENCE = ["emg", "ultrasound", "dynamics", "model", "inference"];
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test("the agreed movements, in the agreed reading order", () => {
  assert.deepEqual(movements.map((m) => m.slug), slugs);
  assert.deepEqual([...movements].sort((a, b) => a.order - b.order).map((m) => m.slug), slugs);
  for (const m of movements) {
    for (const key of ["name", "nameEn", "plane", "summary", "conditions", "phaseKind", "timingNote"]) assert.ok(typeof m[key] === "string" && m[key].trim(), `${m.slug}.${key}`);
    assert.ok(["side", "back"].includes(m.view), m.slug);
  }
});

test("every source key resolves and every source says how far it was checked", () => {
  for (const s of sources) {
    assert.ok(s.id && s.citation && s.usedFor, JSON.stringify(s));
    assert.ok(["본문", "초록", "2차 인용", "미리보기", "공개 데이터"].includes(s.checked), s.id);
  }
  assert.equal(sourceIds.size, sources.length, "duplicate source ids");
  for (const m of movements) {
    const cited = [
      ...m.phases.flatMap((p) => p.sources), ...m.keyframes.flatMap((k) => [...k.sources, ...(k.com?.sources ?? []), ...(k.grf?.sources ?? [])]),
      ...m.muscles.flatMap((r) => Object.values(r.cells).flatMap((c) => c.sources)), ...m.joints.flatMap((j) => j.sources),
      ...m.mechanics.flatMap((x) => x.sources), ...m.passive.flatMap((x) => x.sources), ...m.misconceptions.flatMap((x) => x.sources),
      ...(m.duration?.sources ?? []), ...(m.stairs?.sources ?? []), ...(m.emg?.sources ?? []),
    ];
    for (const id of cited) assert.ok(sourceIds.has(id), `${m.slug}: unknown source ${id}`);
    for (const p of m.phases) assert.ok(p.sources.length, `${m.slug}/${p.id} has no source`);
    for (const k of m.keyframes) assert.ok(k.sources.length, `${m.slug} keyframe ${k.t} has no source`);
    for (const j of m.joints) assert.ok(j.sources.length && j.population, `${m.slug} joint ${j.joint}`);
    for (const x of [...m.mechanics, ...m.passive, ...m.misconceptions]) assert.ok(x.sources.length, `${m.slug}: ${x.text || x.name || x.wrong}`);
  }
});

test("the internal timeline is monotonic and the phases tile 0–1 exactly", () => {
  for (const m of movements) {
    assert.ok(m.phases.length >= 3, m.slug);
    assert.ok(near(m.phases[0].start, 0) && near(m.phases.at(-1).end, 1), m.slug);
    m.phases.forEach((p, i) => {
      assert.ok(p.end > p.start, `${m.slug}/${p.id}`);
      if (i) assert.ok(near(p.start, m.phases[i - 1].end), `${m.slug}/${p.id} gap`);
      assert.match(p.id, /^[a-z0-9-]+$/, `${m.slug}/${p.id} is a URL slug`);
    });
    assert.equal(new Set(m.phases.map((p) => p.id)).size, m.phases.length);
    const ts = m.keyframes.map((k) => k.t);
    assert.ok(ts.every((t, i) => t >= 0 && t <= 1 && (i === 0 || t > ts[i - 1])), `${m.slug} keyframes ${ts}`);
    assert.ok(near(ts[0], 0), `${m.slug} starts at 0`);
    if (!m.loop) assert.ok(near(ts.at(-1), 1), `${m.slug} ends at 1`);
  }
});

test("a phase's own start time lands in that phase (deep links open the named phase)", () => {
  for (const m of movements) for (const p of m.phases) {
    const x = cycle(m, p.start);
    assert.ok(x >= p.start && x < p.end, `${m.slug}/${p.id}: ${p.start} wraps to ${x}`);
  }
});

test("overlays say where they start and seated spans fit the timeline", () => {
  for (const m of movements) for (const k of m.keyframes) {
    if (k.grf) assert.ok(["heel", "mid", "mtp", "toe"].includes(k.grf.from) && ["small", "medium", "large"].includes(k.grf.size), `${m.slug} grf at ${k.t}`);
    if (k.com) assert.ok(Number.isFinite(k.com.dx), `${m.slug} com at ${k.t}`);
  }
  for (const slug of ["sit-to-stand", "stand-to-sit"]) {
    const spans = movements.find((m) => m.slug === slug).seated;
    assert.ok(Array.isArray(spans) && spans.length && spans.every(([a, b]) => a >= 0 && b <= 1 && b > a), slug);
  }
  // Rising leaves the seat at seat-off; sitting reaches it at seat contact.
  assert.deepEqual(movements.find((m) => m.slug === "sit-to-stand").seated, [[0, movements.find((m) => m.slug === "sit-to-stand").phases[1].start]]);
});

test("each movement shows its own unit: cycle % for walking, events for stairs, state, angle or playback otherwise", () => {
  const range = (slug) => movements.find((m) => m.slug === slug).phases.map((p) => p.range || "");
  assert.ok(range("walking").every((r) => /주기 \d+–\d+%/.test(r)), range("walking").join(" | "));
  for (const slug of ["standing", "sit-to-stand", "stand-to-sit", "arm-elevation"]) assert.ok(range(slug).every((r) => !r.includes("%")), slug);
  // Stairs: phases run from event to event; a % names where it comes from.
  for (const slug of STAIRS) for (const r of range(slug)) {
    assert.match(r, /→/, `${slug}: ${r}`);
    for (const pct of r.match(/[\d.]+%/g) ?? []) assert.match(r, new RegExp(`(도식|DD|계산|G20|Grimmer)[^→]*${pct.replace(".", "\\.")}|${pct.replace(".", "\\.")}[^→]*(도식|DD|계산)`), `${slug}: ${r} — unlabelled ${pct}`);
  }
  assert.ok(range("arm-elevation").every((r) => r.includes("°") || /내리/.test(r)), range("arm-elevation").join(" | "));
  // Perry & Burnfield 2010 phase boundaries (CONSENSUS §3.4).
  const gait = movements.find((m) => m.slug === "walking");
  assert.deepEqual(gait.phases.map((p) => Math.round(p.start * 100)), [0, 2, 12, 31, 50, 62, 75, 87]);
  assert.equal(gait.loop, true);
  assert.equal(movements.find((m) => m.slug === "standing").loop, true);
});

test("muscle rows have a known call for every phase, with evidence and sources", () => {
  for (const m of movements) {
    const ids = m.phases.map((p) => p.id);
    assert.ok(m.muscles.length >= 4, m.slug);
    assert.equal(new Set(m.muscles.map((r) => r.id)).size, m.muscles.length);
    for (const row of m.muscles) {
      assert.deepEqual(Object.keys(row.cells).sort(), [...ids].sort(), `${m.slug}/${row.id} cells`);
      for (const [phase, c] of Object.entries(row.cells)) {
        assert.ok(CONTRACTIONS.includes(c.contraction), `${m.slug}/${row.id}/${phase} ${c.contraction}`);
        assert.ok(Array.isArray(c.evidence) && c.evidence.every((e) => EVIDENCE.includes(e)), `${m.slug}/${row.id}/${phase} evidence`);
        if (c.contraction !== "nodata") assert.ok(c.sources.length && c.evidence.length, `${m.slug}/${row.id}/${phase} needs evidence and sources`);
        // A contraction mode is never read off EMG timing alone.
        if (["concentric", "eccentric", "isometric"].includes(c.contraction) && c.evidence.every((e) => e === "emg"))
          assert.fail(`${m.slug}/${row.id}/${phase}: contraction from EMG alone`);
      }
      if (row.line) assert.ok((m.view === "back" ? backLines : sideLines)[row.line], `${m.slug}/${row.id} line ${row.line}`);
    }
  }
});

const side = (s) => /^right |\(right\)|_r$/i.test(s.name) || /_r$/.test(s.id) ? "R" : /^left |\(left\)|_l$/i.test(s.name) || /_l$/.test(s.id) ? "L" : "";
const partner = (s) => s.name.replace(/^right /i, "left ").replace(/\(right\)/i, "(left)").replace(/^left /i, "right ").replace(/\(left\)/i, "(right)");
test("structure ids exist in the catalogue, in the right system, with sides listed one by one", () => {
  for (const m of movements) {
    const symmetric = ["standing", "sit-to-stand", "stand-to-sit"].includes(m.slug);
    for (const row of [...m.muscles, ...m.passive]) {
      for (const id of row.structures) assert.ok(catalogue.has(id), `${m.slug}/${row.name}: ${id} not in catalogue`);
      const items = row.structures.map((id) => catalogue.get(id));
      if (m.muscles.includes(row)) for (const s of items) assert.ok(s.layer === "muscle", `${m.slug}/${row.name}: ${s.id} is ${s.layer}`);
      const names = new Set(items.map((s) => s.name.toLowerCase()));
      for (const s of items) {
        const k = side(s);
        if (!k) continue;
        if (symmetric) assert.ok(names.has(partner(s).toLowerCase()) || [...names].some((n) => n === partner(s).toLowerCase()), `${m.slug}/${row.name}: ${s.id} lacks its other side`);
        else assert.equal(k, "R", `${m.slug}/${row.name}: ${s.id} — one-sided movements use the right side`);
      }
      for (const id of row.female ?? []) assert.ok(female.has(id), `${m.slug}/${row.name}: female ${id}`);
    }
  }
});

const FORBIDDEN = /강화하면|예방|치료|교정|바른 자세|정상 기준|진단|좋은 자세|나쁜 자세|처방|무릎에 (나쁘|좋)|관절에 무리|운동 효과|칼로리|심폐|강화|재활|안전한 계단|바른 계단|난간을 잡아야|무릎이 발끝|낙상 위험|연골 손상|정상 운동학/;
test("descriptions make no exercise, treatment or diagnostic claims", () => {
  for (const m of movements) {
    const texts = [m.summary, ...m.phases.flatMap((p) => [p.summary, p.events, ...(p.mechanics ?? [])]),
      ...m.muscles.flatMap((r) => Object.values(r.cells).flatMap((c) => [c.role ?? "", c.note ?? ""])), ...m.mechanics.map((x) => x.text), ...m.passive.map((x) => x.role),
      ...m.misconceptions.flatMap((x) => [x.wrong, x.better]), ...m.limitations, m.timingNote, m.conditions, m.figureNote ?? "",
      ...m.phases.map((p) => p.range ?? ""), ...m.keyframes.flatMap((k) => [k.event ?? "", k.note ?? ""]), m.stairs?.note ?? "",
      m.emg?.note ?? "", m.emg?.reference ?? "", ...m.joints.flatMap((j) => [j.values, j.note ?? "", j.population])];
    for (const text of texts) assert.doesNotMatch(text, FORBIDDEN, `${m.slug}: ${text}`);
  }
  for (const c of contrasts) for (const text of [c.title, c.lead, c.note ?? "", ...c.rows.flatMap((r) => [r.label, ...r.values, r.note ?? ""])]) assert.doesNotMatch(text, FORBIDDEN, `${c.id}: ${text}`);
});

test("sitting down has its own keyframes, not rising played backwards", () => {
  const up = movements.find((m) => m.slug === "sit-to-stand"), down = movements.find((m) => m.slug === "stand-to-sit");
  const reversed = [...up.keyframes].reverse().map((k) => ({ t: +(1 - k.t).toFixed(3), angles: k.angles }));
  const own = down.keyframes.map((k) => ({ t: +k.t.toFixed(3), angles: k.angles }));
  assert.notDeepEqual(own, reversed);
  assert.notDeepEqual(own.map((k) => k.t), reversed.map((k) => k.t));
});

test("drawn poses keep the feet on the floor and the seated hip above the seat", () => {
  for (const m of movements.filter((x) => x.view === "side" && !x.stairs)) {
    for (let i = 0; i <= 100; i++) {
      const t = i / 100, a = interpolate(m.keyframes, t, m.loop);
      for (const v of Object.values(a)) assert.ok(Number.isFinite(v), `${m.slug} t=${t}`);
      if (m.slug === "walking") {
        const p = walkingPose(a, interpolate(m.keyframes, t + 0.5, m.loop), t);
        const foot = (l) => Math.min(l.heel.y, l.mtp.y, l.toe.y);
        const right = t < GAIT.stanceEnd, left = (t + 0.5) % 1 < GAIT.stanceEnd;
        // The stance foot is on the floor; in double support both stay within
        // 2.5 cm of it, and no foot sinks more than 1 cm below the floor line.
        if (right && !left) assert.ok(near(foot(p.right), 0.01, 1e-6), `walking t=${t} right stance ${foot(p.right)}`);
        if (left && !right) assert.ok(near(foot(p.left), 0.01, 1e-6), `walking t=${t} left stance ${foot(p.left)}`);
        if (left && right) for (const l of [p.right, p.left]) assert.ok(Math.abs(foot(l) - 0.01) < 0.025, `walking t=${t} double support ${foot(l)}`);
        for (const l of [p.right, p.left]) assert.ok(foot(l) > 0, `walking t=${t} foot below the floor ${foot(l)}`);
        assert.ok(p.right.hip.y > 0.7 && p.right.hip.y < 0.9, `walking t=${t} hip ${p.right.hip.y}`);
      } else {
        const p = footFixedPose(a);
        assert.ok(near(Math.min(p.right.heel.y, p.right.mtp.y, p.right.toe.y), 0.01, 1e-6), `${m.slug} foot flat on the floor`);
        assert.ok(p.c7.y > p.right.hip.y, `${m.slug} t=${t} trunk above the hip`);
      }
    }
  }
  for (const slug of ["sit-to-stand", "stand-to-sit"]) {
    const m = movements.find((x) => x.slug === slug);
    const seated = footFixedPose(interpolate(m.keyframes, slug === "sit-to-stand" ? 0 : 1, false));
    assert.ok(seated.right.hip.y > 0.47 && seated.right.hip.y < 0.62, `${slug} seated hip ${seated.right.hip.y}`);
    const standingPose = footFixedPose(interpolate(m.keyframes, slug === "sit-to-stand" ? 1 : 0, false));
    assert.ok(standingPose.right.hip.y > 0.78, `${slug} standing hip ${standingPose.right.hip.y}`);
  }
  const arm = movements.find((x) => x.slug === "arm-elevation");
  for (let i = 0; i <= 50; i++) {
    const a = interpolate(arm.keyframes, i / 50, false);
    assert.ok(a.elevation >= 0 && a.elevation <= 160 && a.upwardRotation >= 0 && a.upwardRotation <= 60, JSON.stringify(a));
    backPose(a);
  }
});

test("stair engine: the stance foot holds its tread, the staircase repeats and a cycle loops", () => {
  // Synthetic angles with a flat stance foot (engine geometry only, no data).
  const K = (t, hip, knee, ankle) => ({ t, angles: { ankle, knee, hip }, sources: [] });
  const frames = [K(0, 55, 65, 10), K(0.15, 45, 50, 5), K(0.35, 20, 25, 5), K(0.5, 5, 10, 5), K(0.64, 10, 35, -10), K(0.8, 60, 95, 5)];
  for (const direction of ["up", "down"]) {
    const s = { direction, rise: 0.17, going: 0.29, stanceEnd: 0.64, fromEdge: 0.15, sources: [] };
    const c = stairContacts(s);
    const at = (t) => stairPose(interpolate(frames, t, true), interpolate(frames, t + 0.5, true), t, s);
    let held = null;
    for (let i = 0; i <= 200; i++) {
      const t = i / 200, p = at(t);
      if (t >= c.loadingEnd && t < c.opposite) {
        // Right single support: the MTP joint stays at one place on its tread.
        assert.ok(near(p.right.mtp.y - stepTop(p.steps, p.right.mtp.x), MTP_ABOVE, 1e-9), `${direction} t=${t} right foot on its tread`);
        const onTread = p.right.mtp.x - p.steps.origin.x;
        held ??= onTread;
        assert.ok(near(onTread, held, 1e-9), `${direction} t=${t} right foot slides ${onTread - held}`);
      }
    }
    // The cycle closes: the drawing at t=1 is the drawing at t=0 two steps on.
    const a = at(0), b = at(1 - 1e-9);
    for (const k of ["hip", "knee", "ankle", "mtp", "toe", "heel"]) for (const leg of ["right", "left"]) {
      assert.ok(Math.hypot(a[leg][k].x - b[leg][k].x, a[leg][k].y - b[leg][k].y) < 1e-6, `${direction} ${leg} ${k} loops`);
    }
    const shift = { x: a.steps.origin.x - b.steps.origin.x, y: a.steps.origin.y - b.steps.origin.y };
    assert.ok(near(shift.x, 2 * s.going, 1e-6) && near(shift.y, (direction === "up" ? 2 : -2) * s.rise, 1e-6), `${direction} two steps per cycle`);
    // The outline alternates treads and risers that climb (or drop) one rise each.
    const outline = stepOutline(a.steps, -1, 1);
    for (let i = 1; i < outline.length - 1; i += 2) {
      assert.ok(near(outline[i].y, outline[i - 1].y), `${direction} tread ${i}`);
      assert.ok(near(outline[i + 1].x, outline[i].x) && near(outline[i + 1].y - outline[i].y, (direction === "up" ? 1 : -1) * s.rise, 1e-9), `${direction} riser ${i}`);
    }
  }
});

// Stairs (docs/movement-mechanics/stairs/CONSENSUS.md §3–§7): one dataset,
// an edited periodic model that stays within the recorded spread, both feet
// on their treads, no foot through a step.
const stair = (slug) => movements.find((m) => m.slug === slug);
test("stairs: the Darmstadt staircase, phases and events as agreed", () => {
  const want = {
    "stair-ascent": { direction: "up", stanceEnd: 0.641, bounds: [0, 0.141, 0.4237, 0.641], ids: ["weight-acceptance", "pull-up", "forward-continuance", "swing"] },
    "stair-descent": { direction: "down", stanceEnd: 0.652, bounds: [0, 0.152, 0.2323, 0.652], ids: ["weight-acceptance", "forward-continuance", "controlled-lowering", "swing"] },
  };
  for (const slug of STAIRS) {
    const m = stair(slug), w = want[slug];
    assert.equal(m.loop, true);
    assert.deepEqual({ direction: m.stairs.direction, rise: m.stairs.rise, going: m.stairs.going, stanceEnd: m.stairs.stanceEnd }, { direction: w.direction, rise: 0.17, going: 0.29, stanceEnd: w.stanceEnd }, slug);
    assert.deepEqual(m.phases.map((p) => p.id), w.ids, slug);
    assert.deepEqual(m.phases.map((p) => p.start), w.bounds, slug);
    // Opposite toe-off of the symmetric drawing ends weight acceptance.
    assert.ok(near(m.phases[1].start, m.stairs.stanceEnd - 0.5, 1e-9), slug);
    // Every keyframe is the one dataset: its 100 samples (t = i/99, the last is the next start) plus the events.
    assert.ok(m.keyframes.every((k) => k.sources.length === 1 && k.sources[0] === "darmstadt-stairs"), slug);
    for (let i = 0; i < 99; i++) assert.ok(m.keyframes.some((k) => near(k.t, +(i / 99).toFixed(6), 1e-9)), `${slug} sample ${i}`);
    assert.ok(m.keyframes.every((k) => !k.com && !k.grf), `${slug}: no centre-of-mass or force overlay on stairs`);
    for (const e of ["오른발 닿기", "반대발 떼기", "반대발 닿기", "오른발 떼기"]) assert.ok(m.keyframes.some((k) => k.event?.startsWith(e)), `${slug} event ${e}`);
  }
  // Descent has its own curve, not ascent played backwards.
  const up = stair("stair-ascent").keyframes, down = stair("stair-descent").keyframes;
  const reversed = up.map((k) => ({ t: +((1 - k.t) % 1).toFixed(4), a: k.angles })).sort((a, b) => a.t - b.t);
  assert.notDeepEqual(down.map((k) => k.angles), reversed.map((k) => k.a));
});

test("stairs: drawn angles stay within the recorded spread and keep the source values", () => {
  for (const slug of STAIRS) {
    const m = stair(slug);
    const seamFrom = m.keyframes.find((k) => k.event?.startsWith("유각 무릎 최대")).t;
    let edited = 0;
    for (const k of m.keyframes) {
      if (!k.measured) continue;
      edited++;
      for (const j of ["hip", "knee", "ankle"]) {
        const d = Math.abs(k.angles[j] - k.measured.angles[j]), sd = k.measured.sd[j];
        assert.ok(sd > 0, `${slug} ${k.t} ${j} sd`);
        // Double-support adjustment ≤ 1 SD; the loop seam (late swing only) ≤ 1.3 SD.
        // Angles and SD are stored to 0.1°, so allow 0.15° of rounding.
        assert.ok(d <= (k.t >= seamFrom ? 1.3 : 1) * sd + 0.15, `${slug} t=${k.t} ${j}: ${k.angles[j]} vs measured ${k.measured.angles[j]} ± ${sd}`);
      }
    }
    // Edits stay where they were agreed: double support with 8% run-in/out, and the late-swing seam.
    const de = m.stairs.stanceEnd - 0.5, ease = 0.08 + 1e-6;
    const allowed = (t) => t <= de + ease || t >= 1 - ease || (t >= 0.5 - ease && t <= m.stairs.stanceEnd + ease) || t >= seamFrom;
    for (const k of m.keyframes) if (k.measured) assert.ok(allowed(k.t), `${slug}: edited at ${k.t}`);
    assert.ok(edited > 0, slug);
    // Mid single support is drawn as measured.
    assert.ok(m.keyframes.filter((k) => k.t > de + ease && k.t < 0.5 - ease).every((k) => !k.measured), `${slug} single support untouched`);
  }
});

test("stairs: both feet keep their treads and no foot passes through a step", () => {
  for (const slug of STAIRS) {
    const m = stair(slug), s = m.stairs, c = stairContacts(s);
    let held = null;
    for (let j = 0; j < 1000; j++) {
      const t = j / 1000, p = sidePose(m, t);
      const rS = t < c.stanceEnd, lS = t >= c.opposite || t < c.loadingEnd;
      const hold = (k) => { const h = stairHold(s, k); return { x: h.x + p.steps.origin.x, y: h.y + p.steps.origin.y }; };
      const off = (leg, h) => Math.hypot(leg.mtp.x - h.x, leg.mtp.y - h.y);
      const dR = off(p.right, hold(0)), dL = off(p.left, hold(t < c.opposite ? -1 : 1));
      // Single support: exactly on the hold; double support: within 2 cm.
      if (rS && !lS) assert.ok(dR < 1e-9, `${slug} t=${t} right ${dR}`);
      if (lS && !rS) assert.ok(dL < 1e-9, `${slug} t=${t} left ${dL}`);
      if (rS && lS) assert.ok(dR <= 0.02 && dL <= 0.02, `${slug} t=${t} double support ${dR} ${dL}`);
      if (rS && !lS) { const x = p.right.mtp.x - p.steps.origin.x; held ??= x; assert.ok(near(x, held, 1e-9), `${slug} t=${t} right slides`); }
      // The foot outline and ankle never go below the tread under them.
      for (const leg of [p.right, p.left]) {
        for (const [a, b] of [[leg.heel, leg.mtp], [leg.mtp, leg.toe], [leg.ankle, leg.heel], [leg.ankle, leg.mtp]]) {
          for (let k = 0; k <= 10; k++) {
            const q = { x: a.x + (b.x - a.x) * k / 10, y: a.y + (b.y - a.y) * k / 10 };
            assert.ok(q.y - stepTop(p.steps, q.x) > -1e-6, `${slug} t=${t} foot below the step by ${stepTop(p.steps, q.x) - q.y}`);
          }
        }
      }
      // A standing foot keeps 1 cm from the risers at both ends of its tread.
      const dirY = s.direction === "up" ? 1 : -1;
      for (const [leg, on, k] of [[p.right, rS, 0], [p.left, lS, t < c.opposite ? -1 : 1]]) {
        if (!on) continue;
        const x0 = p.steps.origin.x + k * s.going, y0 = p.steps.origin.y + dirY * k * s.rise;
        for (const q of [leg.heel, leg.toe]) for (const [sx, ya, yb] of [[x0, y0, y0 - dirY * s.rise], [x0 + s.going, y0, y0 + dirY * s.rise]]) {
          const yc = Math.min(Math.max(q.y, Math.min(ya, yb)), Math.max(ya, yb));
          assert.ok(Math.hypot(q.x - sx, q.y - yc) >= 0.01, `${slug} t=${t}: foot ${Math.hypot(q.x - sx, q.y - yc)} m from a riser`);
        }
      }
      // Toes of a foot on its tread rest on it (drawing rule; the source has no toe angle).
      if (rS && !lS) assert.ok(Math.abs(p.right.toe.y - stepTop(p.steps, p.right.toe.x) - FLOOR_GAP) < 0.002, `${slug} t=${t} right toes ${p.right.toe.y - stepTop(p.steps, p.right.toe.x)}`);
    }
  }
});

test("stairs: nothing jumps at foot contact or across the loop", () => {
  for (const slug of STAIRS) {
    const m = stair(slug);
    for (const [t0, side] of [[0, "right"], [0.5, "left"]]) {
      const a = sidePose(m, (t0 + 1 - 1e-7) % 1)[side], b = sidePose(m, t0)[side];
      for (const k of ["toe", "mtp", "heel", "ankle", "knee"]) assert.ok(Math.hypot(a[k].x - b[k].x, a[k].y - b[k].y) < 1e-3, `${slug} ${side} ${k} jumps at contact`);
    }
  }
});

test("stairs: the EMG table is one recording's phase means and the cells agree with it", () => {
  for (const slug of STAIRS) {
    const m = stair(slug);
    assert.ok(m.emg && m.emg.cut === 30 && m.emg.sources.length === 1 && m.emg.sources[0] === "darmstadt-stairs", slug);
    for (const r of m.emg.rows) {
      const row = m.muscles.find((x) => x.id === r.muscle);
      assert.ok(row, `${slug}: emg row ${r.muscle}`);
      assert.deepEqual(Object.keys(r.values).sort(), m.phases.map((p) => p.id).sort(), `${slug}/${r.muscle}`);
      for (const [phase, v] of Object.entries(r.values)) {
        assert.ok(Number.isInteger(v) && v >= 0, `${slug}/${r.muscle}/${phase} ${v}`);
        const cell = row.cells[phase];
        if (cell.contraction === "low") assert.ok(v < m.emg.cut, `${slug}/${r.muscle}/${phase}: low but ${v}`);
        // Under the cut but called active: only when another EMG source reports activity (the note says which).
        if (v < m.emg.cut && ["active", "concentric", "eccentric", "isometric"].includes(cell.contraction))
          assert.ok(cell.evidence.includes("emg") && cell.sources.some((id) => id !== "darmstadt-stairs"), `${slug}/${r.muscle}/${phase}: ${v}% called ${cell.contraction} without another EMG source`);
        if (v >= m.emg.cut) assert.notEqual(cell.contraction, "low", `${slug}/${r.muscle}/${phase}: ${v} is not low`);
        assert.notEqual(cell.contraction, "silent", `${slug}/${r.muscle}/${phase}: a low mean is not 'not detected'`);
        // A cell that quotes the phase mean quotes the table's number.
        const quoted = (cell.note ?? "").match(/국면 평균 (\d+)%/);
        if (quoted) assert.equal(Number(quoted[1]), v, `${slug}/${r.muscle}/${phase}: note says ${quoted[1]}%, table ${v}%`);
      }
    }
  }
  // Sentences quoting DD phase means use the table's numbers.
  const RECORDED = { 넙다리두갈래근: "hamstrings", 넙다리곧은근: "rectus-femoris", 가쪽넓은근: "vasti", "장딴지근 가쪽갈래": "gastrocnemius-lateral", 가쪽장딴지근: "gastrocnemius-lateral", 가자미근: "soleus", 앞정강근: "tibialis-anterior" };
  for (const slug of STAIRS) {
    const m = stair(slug);
    const texts = [...m.misconceptions.flatMap((x) => [x.wrong, x.better]), ...m.mechanics.map((x) => x.text), ...m.limitations, ...m.phases.flatMap((p) => [p.summary, ...(p.mechanics ?? [])])];
    for (const t of texts.filter((x) => /DD 국면 평균/.test(x))) {
      for (const hit of t.matchAll(/(넙다리두갈래근|넙다리곧은근|가쪽넓은근|장딴지근 가쪽갈래|가쪽장딴지근|가자미근|앞정강근) (\d+)%/g)) {
        const [, name, v] = hit;
        const row = m.emg.rows.find((r) => r.muscle === RECORDED[name]);
        // The phase named last before the number, if any, is the one quoted.
        const before = t.slice(0, hit.index);
        const named = m.phases.filter((p) => before.includes(p.name)).sort((a, b) => before.lastIndexOf(b.name) - before.lastIndexOf(a.name))[0];
        if (named) assert.equal(row.values[named.id], Number(v), `${slug}: "${name} ${v}%" in ${named.name} — table ${row.values[named.id]}%`);
        else assert.ok(Object.values(row.values).includes(Number(v)), `${slug}: "${name} ${v}%" is not in the EMG table (${Object.values(row.values)})`);
      }
    }
    // The other phrasing: "<muscle> <phase>(기) 평균 N%" anywhere in the texts and cell notes.
    const PHASE_WORDS = { "체중 받아들이기": "weight-acceptance", 끌어올리기: "pull-up", "앞으로 이어가기": "forward-continuance", "조절하며 내려가기": "controlled-lowering", 유각: "swing" };
    const all = [...texts, ...m.muscles.flatMap((r) => Object.values(r.cells).map((c) => c.note ?? ""))];
    for (const t of all) for (const [, name, ph, v] of t.matchAll(/(넙다리두갈래근|넙다리곧은근|가쪽넓은근|장딴지근 가쪽갈래|가쪽장딴지근|가자미근|앞정강근) (체중 받아들이기|끌어올리기|앞으로 이어가기|조절하며 내려가기|유각)기? 평균 (\d+)%/g)) {
      const row = m.emg.rows.find((r) => r.muscle === RECORDED[name]);
      assert.equal(row.values[PHASE_WORDS[ph]], Number(v), `${slug}: "${name} ${ph} 평균 ${v}%" — table ${row.values[PHASE_WORDS[ph]]}%`);
    }
  }
  // The comparison box quotes the per-stride joint work of the drawn strides (Darmstadt FullyProcessed
  // A5/D6 Whip/Wkne/Wank grand means, scripts/stairs/build-stairs.mjs; docs/movement-mechanics/stairs/VERIFICATION.md).
  const WORK = { positive: ["엉덩관절 0.51 · 무릎 0.59 · 발목 0.73", "엉덩관절 0.22 · 무릎 0.04 · 발목 0.18"], negative: ["엉덩관절 −0.03 · 무릎 −0.20 · 발목 −0.09", "엉덩관절 −0.02 · 무릎 −1.04 · 발목 −0.98"] };
  const box = contrasts.find((x) => x.id === "stairs");
  assert.deepEqual(box.rows.find((r) => r.label.includes("양의 일")).values, WORK.positive);
  assert.deepEqual(box.rows.find((r) => r.label.includes("음의 일")).values, WORK.negative);
  // Every other row too (Grimmer 2020 table 1 and the same Darmstadt computation: phase work by
  // integrating the grand-mean power, foot pitch at contact, CoM height change).
  assert.deepEqual(box.rows.map((r) => r.values), [
    ["0.53 m/s · 1.12초", "0.56 m/s · 1.06초"], ["주기 64.1%", "주기 65.2%"], ["약 4°, 거의 평평", "약 33°, 발끝이 아래"],
    WORK.positive, WORK.negative, ["끌어올리기: 양의 일 0.25 J/kg", "조절하며 내려가기: 음의 일 −0.70 J/kg"],
    ["앞으로 이어가기: 양의 일 0.41 J/kg", "체중 받아들이기: 음의 일 −0.57 J/kg"], ["+0.34 m(단 두 개)", "−0.34 m(단 두 개)"],
  ]);
  // The comparison box names both movements and pairs phases that exist.
  const c = contrasts.find((x) => x.id === "stairs");
  assert.deepEqual(c.movements, STAIRS);
  for (const [a, b] of c.phases) assert.ok(stair(STAIRS[0]).phases.some((p) => p.id === a) && stair(STAIRS[1]).phases.some((p) => p.id === b), `${a}/${b}`);
  for (const r of c.rows) { assert.equal(r.values.length, 2); for (const id of r.sources) assert.ok(sourceIds.has(id), id); }
});
