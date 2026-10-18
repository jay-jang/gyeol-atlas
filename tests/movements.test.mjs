// Movement-mechanics data (docs/movement-mechanics/CONSENSUS.md §7).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { GAIT, backLines, backPose, footFixedPose, interpolate, sideLines, walkingPose } from "../src/movement-figure.ts";

const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const slugs = ["standing", "sit-to-stand", "stand-to-sit", "walking", "arm-elevation"];
const movements = slugs.map((slug) => read(`data/movements/${slug}.json`));
const sources = read("data/movement-sources.json");
const sourceIds = new Set(sources.map((s) => s.id));
const catalogue = new Map([
  ...read("scripts/model-inputs.json").assets,
  ...read("data/full-system-structures.json"),
  ...read("data/connective-structures.json"),
].map((s) => [s.id, s]));
const female = new Set([...read("data/female-atlas-structures.json").map((s) => s.id),
  ...read("data/female-composite-groups.json").flatMap((g) => [g.id, ...(g.ids || [])])]);
const CONTRACTIONS = ["concentric", "eccentric", "isometric", "active", "inhibited", "silent", "nodata"];
const EVIDENCE = ["emg", "ultrasound", "dynamics", "model", "inference"];
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test("the five agreed movements, in the agreed reading order", () => {
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
    assert.ok(["본문", "초록", "2차 인용", "미리보기"].includes(s.checked), s.id);
  }
  assert.equal(sourceIds.size, sources.length, "duplicate source ids");
  for (const m of movements) {
    const cited = [
      ...m.phases.flatMap((p) => p.sources), ...m.keyframes.flatMap((k) => [...k.sources, ...(k.com?.sources ?? []), ...(k.grf?.sources ?? [])]),
      ...m.muscles.flatMap((r) => Object.values(r.cells).flatMap((c) => c.sources)), ...m.joints.flatMap((j) => j.sources),
      ...m.mechanics.flatMap((x) => x.sources), ...m.passive.flatMap((x) => x.sources), ...m.misconceptions.flatMap((x) => x.sources),
      ...(m.duration?.sources ?? []),
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

test("each movement shows its own unit: cycle % only for walking, state, angle or playback otherwise", () => {
  const range = (slug) => movements.find((m) => m.slug === slug).phases.map((p) => p.range || "");
  assert.ok(range("walking").every((r) => /주기 \d+–\d+%/.test(r)), range("walking").join(" | "));
  for (const slug of ["standing", "sit-to-stand", "stand-to-sit", "arm-elevation"]) assert.ok(range(slug).every((r) => !r.includes("%")), slug);
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
        if (["concentric", "eccentric", "isometric"].includes(c.contraction) && c.evidence.length === 1 && c.evidence[0] === "emg")
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

const FORBIDDEN = /강화하면|예방|치료|교정|바른 자세|정상 기준|진단|좋은 자세|나쁜 자세|처방/;
test("descriptions make no exercise, treatment or diagnostic claims", () => {
  for (const m of movements) {
    const texts = [m.summary, ...m.phases.flatMap((p) => [p.summary, p.events, ...(p.mechanics ?? [])]),
      ...m.muscles.flatMap((r) => Object.values(r.cells).map((c) => c.role ?? "")), ...m.mechanics.map((x) => x.text), ...m.passive.map((x) => x.role)];
    for (const text of texts) assert.doesNotMatch(text, FORBIDDEN, `${m.slug}: ${text}`);
  }
});

test("sitting down has its own keyframes, not rising played backwards", () => {
  const up = movements.find((m) => m.slug === "sit-to-stand"), down = movements.find((m) => m.slug === "stand-to-sit");
  const reversed = [...up.keyframes].reverse().map((k) => ({ t: +(1 - k.t).toFixed(3), angles: k.angles }));
  const own = down.keyframes.map((k) => ({ t: +k.t.toFixed(3), angles: k.angles }));
  assert.notDeepEqual(own, reversed);
  assert.notDeepEqual(own.map((k) => k.t), reversed.map((k) => k.t));
});

test("drawn poses keep the feet on the floor and the seated hip above the seat", () => {
  for (const m of movements.filter((x) => x.view === "side")) {
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
