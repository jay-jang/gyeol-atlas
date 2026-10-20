import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, SkipBack } from "lucide-react";
import standing from "../data/movements/standing.json";
import sitToStand from "../data/movements/sit-to-stand.json";
import standToSit from "../data/movements/stand-to-sit.json";
import walking from "../data/movements/walking.json";
import stairAscent from "../data/movements/stair-ascent.json";
import stairDescent from "../data/movements/stair-descent.json";
import armElevation from "../data/movements/arm-elevation.json";
import sourceList from "../data/movement-sources.json";
import contrastList from "../data/movement-contrasts.json";
import { structures } from "./anatomy";
import { evidenceNames, type BackAngles, type Contrast, type Keyframe, type Movement, type MuscleCell, type MuscleRow, type Phase, type SideAngles, type Source } from "./movement-types";
import { ContractionLabel, MovementFigure, MuscleLegend, OverlayKey } from "./MovementFigure";
import { contactsOf, cycle, drawnMuscles, figureAt, overlaysAt } from "./movement-figure";
import { idsForSex, saveOrigin, readOrigin, structureLink, type Sex } from "./movement-link";
import { useMedia } from "./use-media";
import "./movement.css";

const movements = ([standing, sitToStand, standToSit, walking, stairAscent, stairDescent, armElevation] as unknown as Movement[]).sort((a, b) => a.order - b.order);
const sources = new Map((sourceList as Source[]).map((s) => [s.id, s]));
const contrasts = contrastList as Contrast[];
// Later candidates agreed with Codex and AGY (docs/movement-mechanics/CONSENSUS.md §1;
// stairs added per docs/movement-mechanics/stairs/CONSENSUS.md).
const LATER = "발끝 서기, 몸 앞으로 굽히기, 한 발 서기, 호흡";
const NOTICE = "건강한 성인의 대표 패턴 하나를 근사한 학습용 도식 · 진단·운동 처방 아님 · AI가 작성한 편집 초안, 해부·운동학 전문가 검수 전";


function phaseAt(m: Movement, t: number): Phase {
  const x = cycle(m, t);
  return m.phases.find((p) => x >= p.start && x < p.end) ?? m.phases[m.phases.length - 1];
}

// "Schenkman M, Berger RA, … Phys Ther 1990" → "Schenkman 외 1990".
function shortCite(citation: string) {
  const authors = citation.split(". ")[0].split(", ");
  const surname = (a: string) => a.split(" ").filter((w, i, all) => i === 0 || i < all.length - 1 || !/^[A-Z][A-Z-]{0,3}$/.test(w)).join(" ");
  // A year in brackets can belong to the journal name ("J Appl Physiol (1985)"); prefer one outside.
  const rest = citation.slice(authors.join(", ").length);
  const year = (rest.match(/\b(19|20)\d{2}\b(?!\))/) ?? rest.match(/\b(19|20)\d{2}\b/))?.[0] ?? "";
  const who = authors.length === 1 ? surname(authors[0]) : authors.length === 2 && !/et al/.test(authors[1]) ? `${surname(authors[0])} & ${surname(authors[1])}` : `${surname(authors[0])} 외`;
  return `${who} ${year}`.trim();
}
// Same short name for two sources (e.g. two tables of one site): add a, b.
const shortNames = (() => {
  const names = new Map([...sources.values()].map((x) => [x.id, x.short ?? shortCite(x.citation)]));
  const counts = new Map<string, number>(), seen = new Map<string, number>();
  for (const n of names.values()) counts.set(n, (counts.get(n) ?? 0) + 1);
  for (const [id, n] of names) if (counts.get(n)! > 1) { const k = seen.get(n) ?? 0; seen.set(n, k + 1); names.set(id, `${n}${"abcdefgh"[k]}`); }
  return names;
})();
// The hash is the router, so a citation moves to its entry in the source list
// itself instead of changing the address.
function jumpToSource(id: string) {
  const entry = document.getElementById(`mv-src-${id}`);
  if (!entry) return;
  entry.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  entry.focus({ preventScroll: true });
}
function Cite({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return <span className="mv-cite">{ids.map((id, i) => <span key={id}>{i > 0 && "; "}<button type="button" onClick={() => jumpToSource(id)}>{shortNames.get(id) ?? id}</button></span>)}</span>;
}

const evidenceText = (c: MuscleCell) => c.evidence.map((e) => evidenceNames[e]).join("·");
// What a cell says beyond its call: role, caveats (measured part, group) and sources.
function CellText({ cell }: { cell: MuscleCell }) {
  const text = [cell.role, cell.note].filter(Boolean).join(" ");
  return <>{text}{text && " "}<Cite ids={cell.sources} /></>;
}
const hasMore = (c: MuscleCell) => Boolean(c.role || c.note || c.sources.length);

// Link into the 3D atlas for one row; a female view opens the carried copy
// or an explicit match, otherwise it offers the male model explicitly.
function AtlasLink({ row, sex, origin }: { row: Pick<MuscleRow, "name" | "structures" | "female">; sex: Sex; origin: { href: string; label: string } }) {
  const own = idsForSex(row.structures, sex, structures, row.female);
  const male = own ? null : idsForSex(row.structures, "male", structures);
  const ids = own ?? male;
  if (!ids) return <span className="mv-atlas-missing">3D 모델에 없음</span>;
  const target = own ? sex : "male";
  const remember = () => saveOrigin({ ...origin, ids, scroll: scrollY });
  return (
    <a className="mv-atlas" href={structureLink(target, ids, row.name)} onClick={remember}>
      {own ? "3D에서 맞춰 보기" : "남성 모델에서 보기"}
      <ArrowUpRight size={13} aria-hidden="true" />
    </a>
  );
}

function MovementList() {
  return (
    <main className="movement-page movement-home">
      <h1>동작 역학</h1>
      <p className="doc-lead">서 있기, 일어서기, 앉기, 걷기, 계단 오르기·내리기, 팔 들어올리기에서 뼈와 관절이 어떻게 움직이고 어떤 근육이 언제 일하는지 단계별 도식으로 봅니다.</p>
      <p className="mv-notice">{NOTICE}</p>
      <ol className="mv-list">
        {movements.map((m) => (
          <li key={m.slug}>
            <a href={`#movement/${m.slug}`}>
              <strong>{m.name}</strong>
              <span lang="en">{m.nameEn}</span>
              <small>{m.plane} · {m.phases.length}개 {m.phaseKind}</small>
              <p>{m.summary}</p>
            </a>
          </li>
        ))}
      </ol>
      <p className="mv-later">후속 후보: {LATER}. 근거 대조와 도식 검토를 마친 뒤 추가합니다.</p>
      <p className="mv-later"><a href="#wiki/library-comparison">3D 모델 출처</a> · 3D 지도는 정지한 해부 자세의 참조 모형이며, 이 페이지의 움직임은 2D 도식입니다.</p>
    </main>
  );
}

// What the slider and the live line say, in the unit each movement uses
// (CONSENSUS §4: state / cycle % / elevation angle / playback position).
function position(m: Movement, t: number, phase: Phase) {
  if (m.view === "back") {
    const a = figureAt(m, t) as BackAngles;
    const lowering = t > (m.phases.find((p) => p.id.includes("lower"))?.start ?? 2);
    return `거상 ${Math.round(a.elevation)}° · ${lowering ? "내리는 중" : "올리는 중"} · ${phase.name}`;
  }
  if (contactsOf(m)) return `${phase.name} · 주기 ${Math.round(cycle(m, t) * 100)}%`;
  return phase.name;
}

function MovementDetail({ m, phaseId, sex }: { m: Movement; phaseId?: string; sex: Sex }) {
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const phone = useMedia("(max-width: 700px)");
  // Phones and short landscape screens fold the movement list, conditions
  // and number key so the diagram and its controls share the first screen.
  const compact = useMedia("(max-width: 700px), (max-height: 500px)");
  // Short desktop screens (laptops) fold the conditions too, so the diagram's feet stay on the first screen.
  const short = useMedia("(max-height: 800px)");
  const initial = m.phases.find((p) => p.id === phaseId) ?? m.phases[0];
  const [t, setT] = useState(initial.start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  const [continuous, setContinuous] = useState(false);
  const [overlays, setOverlays] = useState({ muscles: true, com: true, grf: true });
  const [announce, setAnnounce] = useState("");
  const phase = phaseAt(m, t);
  const href = `#movement/${m.slug}/${phase.id}`;
  const origin = { href, label: `${m.name} · ${phase.name}` };
  const smooth = !reduced || continuous;

  // Phase steps change the address (no history entry); playback does not.
  const setPhaseHash = useCallback((id: string) => history.replaceState(history.state, "", `#movement/${m.slug}/${id}`), [m.slug]);
  const goPhase = useCallback((p: Phase, say = true) => {
    setPlaying(false);
    setT(p.start);
    setPhaseHash(p.id);
    if (say) setAnnounce(`${p.name}${p.range ? `, ${p.range}` : ""}`);
  }, [setPhaseHash]);
  // Only an address change (back/forward, a shared link) moves t to its
  // phase; playback and slider moves must not be pulled back.
  useEffect(() => {
    const p = m.phases.find((x) => x.id === phaseId);
    if (p && p.id !== phaseAt(m, t).id) setT(p.start);
  }, [phaseId]);
  useEffect(() => {
    // Returning from the atlas restores where the reader was.
    const back = readOrigin();
    if (back && back.href === location.hash && typeof back.scroll === "number") requestAnimationFrame(() => scrollTo(0, back.scroll!));
  }, []);

  const index = m.phases.indexOf(phase);
  const prev = index > 0 ? m.phases[index - 1] : m.loop ? m.phases[m.phases.length - 1] : null;
  const next = index < m.phases.length - 1 ? m.phases[index + 1] : m.loop ? m.phases[0] : null;
  const duration = m.duration?.seconds ?? 2;

  useEffect(() => {
    if (!playing) return;
    if (!smooth) {
      // Reduced motion: step through the phases instead of animating.
      const timer = setInterval(() => setT((value) => {
        const p = phaseAt(m, value), i = m.phases.indexOf(p);
        if (i === m.phases.length - 1 && !m.loop) { setPlaying(false); return value; }
        return m.phases[(i + 1) % m.phases.length].start;
      }), 2200);
      return () => clearInterval(timer);
    }
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT((value) => {
        const v = value + (dt * speed) / duration;
        if (!m.loop && v >= 1) { setPlaying(false); return 1; }
        return m.loop ? v % 1 : v;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, smooth, speed, duration, m]);

  const togglePlay = () => {
    if (!playing && !m.loop && t >= 1) setT(0);
    setPlaying((v) => !v);
  };
  const keys = (e: ReactKeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.key === " ") { e.preventDefault(); togglePlay(); }
    else if (e.key === "ArrowLeft" && prev) { e.preventDefault(); goPhase(prev); }
    else if (e.key === "ArrowRight" && next) { e.preventDefault(); goPhase(next); }
    else if (e.key === "Home") { e.preventDefault(); goPhase(m.phases[0]); }
    else if (e.key === "End") { e.preventDefault(); goPhase(m.phases[m.phases.length - 1]); }
  };

  const phaseMuscles = m.muscles.filter((row) => row.cells[phase.id] && row.cells[phase.id].contraction !== "nodata");
  const figureMuscles = phaseMuscles.map((row) => ({ row, cell: row.cells[phase.id] }));
  const drawn = drawnMuscles(m, figureMuscles, overlays.muscles);
  const keyframes = m.keyframes as Keyframe<SideAngles | BackAngles>[];
  const phaseFrames = keyframes.filter((k) => k.t >= phase.start - 1e-6 && k.t <= phase.end + 1e-6 && k.event);
  const sliderUnit = m.slug === "standing" ? null : position(m, t, phase);
  const allSources = useMemo(() => [...new Set([
    ...m.phases.flatMap((p) => p.sources), ...keyframes.flatMap((k) => [...k.sources, ...(k.com?.sources ?? []), ...(k.grf?.sources ?? [])]),
    ...m.muscles.flatMap((r) => Object.values(r.cells).flatMap((c) => c.sources)), ...m.joints.flatMap((j) => j.sources),
    ...m.mechanics.flatMap((x) => x.sources), ...m.passive.flatMap((x) => x.sources), ...m.misconceptions.flatMap((x) => x.sources),
    ...(m.duration?.sources ?? []), ...(m.stairs?.sources ?? []), ...(m.emg?.sources ?? []),
    ...contrasts.filter((c) => c.movements.includes(m.slug)).flatMap((c) => c.rows.flatMap((r) => r.sources)),
  ])].filter((id) => sources.has(id)), [m]); // keyframes is m.keyframes

  const controls = (
    <div className="mv-controls" role="group" aria-label="재생 조작">
      <button type="button" onClick={() => goPhase(m.phases[0])} aria-label="처음으로" data-tip="처음으로"><SkipBack size={16} aria-hidden="true" /></button>
      <button type="button" onClick={() => prev && goPhase(prev)} disabled={!prev} aria-label="이전 단계"><ChevronLeft size={18} aria-hidden="true" /></button>
      <button type="button" className="mv-play" onClick={togglePlay} aria-pressed={playing}>
        {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        <span className="mv-play-text">{playing ? "일시정지" : smooth ? "재생" : "단계 재생"}</span>
      </button>
      <button type="button" onClick={() => next && goPhase(next)} disabled={!next} aria-label="다음 단계"><ChevronRight size={18} aria-hidden="true" /></button>
    </div>
  );
  const movementList = <MovementLinks current={m.slug} />;
  const fold = (
    <details className="mv-nav-fold">
      <summary>동작 목록 <span>{m.name}</span></summary>
      {movementList}
    </details>
  );
  const conditions = <p className="mv-conditions">{m.plane} · {m.conditions}</p>;

  return (
    <main className="movement-page">
      <div className="mv-layout">
        {!compact && (
          <nav className="mv-nav" aria-label="동작 목록">
            <a className="mv-home-link" href="#movement">동작 역학</a>{movementList}<p className="mv-nav-later">후속 후보: {LATER}</p>
          </nav>
        )}
        <article className="mv-main" aria-labelledby="mv-title">
          <header className="mv-head">
            <div className="mv-title-row">
              <h1 id="mv-title">{m.name} <span lang="en">{m.nameEn}</span></h1>
              {compact && <nav className="mv-nav" aria-label="동작 목록">{fold}</nav>}
            </div>
            {!compact && (short ? <details className="mv-fold mv-cond-fold"><summary>수행 조건</summary>{conditions}</details> : conditions)}
            <p className="mv-notice">{NOTICE}</p>
          </header>

          <section className="mv-stage" aria-label="동작 도식과 현재 단계">
            <div className="mv-figure-wrap">
              <div className="mv-figure" tabIndex={0} role="group" onKeyDown={keys}
                aria-label={`${m.name} 도식. 스페이스로 재생, 왼쪽·오른쪽 화살표로 단계 이동`}>
                <MovementFigure movement={m} t={t} overlays={overlays} phaseMuscles={figureMuscles} />
              </div>
              {controls}
              {sliderUnit !== null && (
                <label className="mv-slider">
                  <span className="mv-slider-text" aria-hidden="true">{sliderUnit}</span>
                  <span className="mv-track-wrap">
                    <input type="range" min={0} max={1000} step={1} value={Math.round(cycle(m, t) * 1000)}
                      aria-label={m.view === "back" ? "팔 거상 위치" : contactsOf(m) ? "보행 주기 위치" : "재생 위치"}
                      aria-valuetext={sliderUnit}
                      onChange={(e) => { setPlaying(false); setT(Number(e.target.value) / 1000); }}
                      onPointerUp={() => setPhaseHash(phaseAt(m, t).id)}
                      onKeyUp={() => setPhaseHash(phaseAt(m, t).id)} />
                    {/* Stairs: contact events as solid ticks, the edited boundary (E1) dashed (stairs CONSENSUS §4). */}
                    {m.stairs && <span className="mv-ticks" aria-hidden="true">
                      {keyframes.filter((k) => k.event && k.t > 0 && /^(오른발|반대발|E1)/.test(k.event)).map((k) =>
                        <i key={k.t} data-edited={k.event!.startsWith("E1") || undefined} style={{ "--at": k.t } as CSSProperties} />)}
                    </span>}
                  </span>
                </label>
              )}
              {compact && <p className="mv-now" title={phase.range ? `${phase.name} · ${phase.range}` : phase.name}><strong>{index + 1}/{m.phases.length} {phase.name}</strong>{phase.range && <span> · {phase.range}</span>}</p>}
              {compact && drawn.length > 0
                ? <details className="mv-legend-fold"><summary>도식의 근육 번호 {drawn.length}개</summary><MuscleLegend drawn={drawn} /></details>
                : <MuscleLegend drawn={drawn} />}
              <OverlayKey state={overlaysAt(m, t, overlays)} />
              <p className="mv-figure-note">{m.view === "back" ? "뒤에서 본 어깨뼈면 투영입니다. 3축 운동을 한 면에 그렸습니다. " : "옆에서 본 시상면 도식입니다. "}
                {m.figureNote ?? "키프레임 사이는 보간한 근사이며 측정 궤적이 아닙니다."}{m.sway ? ` 흔들림은 ${m.sway.exaggeration}배 과장했습니다.` : ""}
                {m.stairs && " 주기 막대 아래 눈금은 발 닿기·떼기(실선)와 체중심 수직 속도로 정한 편집 경계 E1(점선)입니다."}</p>
              <div className="mv-options">
                <label><input type="checkbox" checked={overlays.muscles} onChange={(e) => setOverlays({ ...overlays, muscles: e.target.checked })} />근육 작용선</label>
                {m.view === "side" && <label><input type="checkbox" checked={overlays.com} onChange={(e) => setOverlays({ ...overlays, com: e.target.checked })} />{keyframes.some((k) => k.com) ? "체중심·지지면" : "지지면"}</label>}
                {m.view === "side" && keyframes.some((k) => k.grf) && <label><input type="checkbox" checked={overlays.grf} onChange={(e) => setOverlays({ ...overlays, grf: e.target.checked })} />지면반력 방향</label>}
                <label>속도 <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="재생 속도">
                  <option value={0.25}>0.25×</option><option value={0.5}>0.5×</option><option value={1}>1×</option>
                </select></label>
                {reduced && <label><input type="checkbox" checked={continuous} onChange={(e) => setContinuous(e.target.checked)} />연속 동작 보기</label>}
              </div>
              {compact && <details className="mv-fold"><summary>수행 조건</summary>{conditions}</details>}
              <details className="mv-fold">
                <summary>재생 시간축과 키프레임</summary>
                <p>{m.timingNote}</p>
              </details>
            </div>

            <div className="mv-phase" aria-labelledby="mv-phase-title">
              <ol className="mv-steps" aria-label={`${m.phaseKind} 선택`}>
                {m.phases.map((p, i) => (
                  <li key={p.id}><button type="button" aria-current={p.id === phase.id ? "step" : undefined} onClick={() => goPhase(p)}>
                    <span className="mv-step-no">{i + 1}</span>{p.name}</button></li>
                ))}
              </ol>
              <h2 id="mv-phase-title">{phase.name}{phase.nameEn && <span lang="en"> {phase.nameEn}</span>}</h2>
              {phase.range && <p className="mv-range">{phase.range}</p>}
              <p className="mv-events"><strong>시작과 끝</strong> {phase.events}</p>
              <p>{phase.summary} <Cite ids={phase.sources} /></p>
              {phase.mechanics && phase.mechanics.length > 0 && <ul className="mv-bullets">{phase.mechanics.map((x) => <li key={x}>{x}</li>)}</ul>}
              {phaseFrames.length > 0 && (
                <dl className="mv-frames">
                  {phaseFrames.map((k) => <div key={k.t}><dt>{k.event}</dt><dd>{angleText(m, k.measured ?? k)} <Cite ids={k.sources} />{k.note && <small> {k.note}</small>}
                    {k.measured && <small> 도식은 {angleText(m, k, false)}로 조정했습니다.</small>}</dd></div>)}
                </dl>
              )}
              <h3>이 {m.phaseKind}의 근육</h3>
              {phaseMuscles.length ? (
                <ul className="mv-phase-muscles">
                  {phaseMuscles.map((row) => {
                    const cell = row.cells[phase.id];
                    return (
                      <li key={row.id}>
                        <span className="mv-pm-name">{row.name}</span>
                        <ContractionLabel c={cell.contraction} />
                        <span className="mv-evidence">{evidenceText(cell)}</span>
                        {hasMore(cell) && <p><CellText cell={cell} /></p>}
                      </li>
                    );
                  })}
                </ul>
              ) : <p>이 {m.phaseKind}의 근활성 자료가 없습니다.</p>}
              <p className="sr-only" aria-live="polite">{announce}</p>
            </div>
          </section>

          <div className="mv-sticky" aria-hidden={phone ? undefined : "true"}>
            <span>{phase.name}</span>
            {phone && controls}
          </div>

          <MuscleTable m={m} phase={phase} sex={sex} origin={origin} cards={compact} />
          {m.emg ? <EmgTable m={m} phase={phase} /> : <ActivityStrip m={m} phase={phase} />}
          {contrasts.filter((c) => c.movements.includes(m.slug)).map((c) => <ContrastBox key={c.id} c={c} m={m} phase={phase} />)}

          <section className="mv-section" aria-labelledby="mv-joints">
            <h2 id="mv-joints">관절 대표값</h2>
            <div className="mv-table-wrap">
              <table className="mv-joint-table">
                <thead><tr><th scope="col">관절</th><th scope="col">대표값(근사)</th><th scope="col">대상·조건</th><th scope="col">출처</th></tr></thead>
                <tbody>{m.joints.map((j) => <tr key={j.joint + j.values}><th scope="row">{j.joint}</th><td>{j.values}{j.note && <small> {j.note}</small>}</td><td>{j.population}</td><td><Cite ids={j.sources} /></td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="mv-section" aria-labelledby="mv-mech">
            <h2 id="mv-mech">골격 메커니즘</h2>
            <ul className="mv-bullets">{m.mechanics.map((x) => <li key={x.text}>{x.text} <Cite ids={x.sources} />{x.note && <small> {x.note}</small>}</li>)}</ul>
          </section>

          <section className="mv-section" aria-labelledby="mv-passive">
            <h2 id="mv-passive">수동 구조</h2>
            <ul className="mv-passive">
              {m.passive.map((x) => (
                <li key={x.name}>
                  <strong>{x.name}</strong> <span lang="en" className="mv-en">{x.nameEn}</span>
                  <p>{x.role} <Cite ids={x.sources} />{x.note && <small> {x.note}</small>}</p>
                  {x.structures.length > 0 && <AtlasLink row={{ name: x.name, structures: x.structures, female: x.female }} sex={sex} origin={origin} />}
                </li>
              ))}
            </ul>
            {m.absent.length > 0 && <p className="mv-absent"><strong>3D 모델에 따로 없는 구조</strong> {m.absent.join(", ")}</p>}
          </section>

          <section className="mv-section" aria-labelledby="mv-myth">
            <h2 id="mv-myth">흔한 오해</h2>
            <dl className="mv-myths">
              {m.misconceptions.map((x) => <div key={x.wrong}><dt>“{x.wrong}”</dt><dd>{x.better} <Cite ids={x.sources} /></dd></div>)}
            </dl>
          </section>

          <section className="mv-section" aria-labelledby="mv-sources">
            <h2 id="mv-sources">출처와 한계</h2>
            <ul className="mv-limits">{m.limitations.map((x) => <li key={x}>{x}</li>)}</ul>
            <ol className="mv-source-list">
              {allSources.map((id) => {
                const s = sources.get(id)!;
                return (
                  <li key={id} id={`mv-src-${id}`} tabIndex={-1}>
                    <strong>{shortNames.get(id)}</strong>{" "}
                    {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.citation}</a> : s.citation}
                    <small> · 확인: {s.checked} · {s.usedFor}</small>
                  </li>
                );
              })}
            </ol>
          </section>

          <nav className="mv-section mv-others" aria-label="다른 동작">
            <h2>다른 동작</h2>
            {movementList}
          </nav>
        </article>
      </div>
    </main>
  );
}

function angleText(m: Movement, k: Pick<Keyframe<SideAngles | BackAngles>, "angles">, trunk = true) {
  if (m.view === "back") {
    const a = k.angles as BackAngles;
    const change = (v: number) => `${v < 0 ? "−" : "+"}${Math.abs(v)}°`;
    return `위팔 거상 ${a.elevation}° · 어깨뼈 위쪽돌림 ${change(a.upwardRotation)}${a.clavicleElevation ? ` · 빗장뼈 올림 ${change(a.clavicleElevation)}` : ""}`;
  }
  const a = k.angles as SideAngles;
  const part = (name: string, v: number | undefined, pos: string, neg: string) => v === undefined ? null : `${name} ${Math.abs(v)}° ${v >= 0 ? pos : neg}`;
  return [part("엉덩관절", a.hip, "굽힘", "폄"), part("무릎", a.knee, "굽힘", "폄"), part("발목", a.ankle, "발등굽힘", "발바닥굽힘"),
    trunk && a.trunk !== undefined ? part(m.stairs ? "몸통(편집 상수)" : "몸통", a.trunk, "앞기울임", "뒤기울임") : null, a.toe ? part("엄지발가락", a.toe, "젖힘", "굽힘") : null].filter(Boolean).join(" · ");
}

function MovementLinks({ current }: { current: string }) {
  return (
    <ul className="mv-links">
      {movements.map((m) => <li key={m.slug}><a href={`#movement/${m.slug}`} aria-current={m.slug === current ? "page" : undefined}>{m.name}</a></li>)}
    </ul>
  );
}

// One cell: the call and its evidence, with role, caveats and sources one
// tap away (open for the current phase).
function Cell({ cell, current }: { cell: MuscleCell | undefined; current: boolean }) {
  if (!cell) return <ContractionLabel c="nodata" />;
  const call: ReactNode = <><ContractionLabel c={cell.contraction} /><span className="mv-evidence">{evidenceText(cell)}</span></>;
  if (!hasMore(cell)) return call;
  return (
    <>
      {call}
      <details className="mv-cell-more" open={current || undefined}>
        <summary>근거</summary>
        <p><CellText cell={cell} /></p>
      </details>
    </>
  );
}

function MuscleTable({ m, phase, sex, origin, cards }: { m: Movement; phase: Phase; sex: Sex; origin: { href: string; label: string }; cards: boolean }) {
  const head = <p className="mv-table-note">근전도는 활동 시점만 보여 주며, 수축 방식은 대부분 관절 운동과 모멘트에서 추론한 해석입니다. ‘자료 없음’은 활동이 없다는 뜻이 아닙니다. 3D에서 맞춰 보기는 3D 지도로 이동하며 모델(남성 약 64MB)을 내려받습니다.</p>;
  if (cards) {
    return (
      <section className="mv-section" aria-labelledby="mv-muscles">
        <h2 id="mv-muscles">{m.phaseKind}별 근육</h2>
        {head}
        <details className="mv-all">
          <summary>전체 {m.phaseKind} 비교 ({m.muscles.length}개 근육)</summary>
          <ul className="mv-muscle-cards">
            {m.muscles.map((row) => (
              <li key={row.id}>
                <strong>{row.name}</strong> <span lang="en" className="mv-en">{row.nameEn}</span>
                <small className="mv-ids">{row.structures.join(" · ")}</small>
                <AtlasLink row={row} sex={sex} origin={origin} />
                <dl>{m.phases.map((p) => <div key={p.id} data-current={p.id === phase.id || undefined}><dt>{p.name}</dt><dd><Cell cell={row.cells[p.id]} current={p.id === phase.id} /></dd></div>)}</dl>
              </li>
            ))}
          </ul>
        </details>
      </section>
    );
  }
  return (
    <section className="mv-section" aria-labelledby="mv-muscles">
      <h2 id="mv-muscles">{m.phaseKind} × 근육</h2>
      {head}
      <div className="mv-table-wrap">
        <table className="mv-muscle-table">
          <thead>
            <tr><th scope="col">근육</th>{m.phases.map((p) => <th scope="col" key={p.id} aria-current={p.id === phase.id ? "true" : undefined}>{p.name}</th>)}</tr>
          </thead>
          <tbody>
            {m.muscles.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <span className="mv-row-name">{row.name}</span>
                  <span lang="en" className="mv-en">{row.nameEn}</span>
                  <small className="mv-ids">{row.structures.join(" · ")}</small>
                  <AtlasLink row={row} sex={sex} origin={origin} />
                </th>
                {m.phases.map((p) => <td key={p.id} data-current={p.id === phase.id || undefined}><Cell cell={row.cells[p.id]} current={p.id === phase.id} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Visual summary of the table (CONSENSUS T17): only cells backed by an EMG
// record, at phase resolution, never an amplitude. Only the gait cycles
// (walking, stairs) have a time axis (cycle %); other movements get one
// equal column per phase.
// Phase means of one EMG recording (stairs): numbers, not on/off bars, so a
// low mean is shown as low rather than as no activity.
function EmgTable({ m, phase }: { m: Movement; phase: Phase }) {
  const e = m.emg!;
  return (
    <section className="mv-section" aria-labelledby="mv-emg">
      <h2 id="mv-emg">국면 평균 상대 근전도</h2>
      <p className="mv-table-note">
        각 {m.phaseKind}의 총평균 포락선 평균이며, {e.reference} 진한 칸은 {e.cut}% 이상, 옅은 칸은 {e.cut}% 미만입니다(편집 구분). 열 너비는 {m.phaseKind}의 길이가 아닙니다.
        활동의 시작·끝이나 힘의 크기를 뜻하지 않습니다. 번호는 위 {m.phaseKind} 버튼의 번호입니다. <Cite ids={e.sources} />{e.note && <small> {e.note}</small>}
      </p>
      <div className="mv-table-wrap">
        <table className="mv-emg-table">
          <thead><tr><th scope="col">근육(측정 부위)</th>{m.phases.map((p, i) => <th scope="col" key={p.id} aria-current={p.id === phase.id ? "step" : undefined}><span className="mv-step-no">{i + 1}</span><span className="mv-emg-phase">{p.name} <small>주기 {Math.round(p.start * 100)}–{Math.round(p.end * 100)}%</small></span></th>)}</tr></thead>
          <tbody>
            {e.rows.map((r) => (
              <tr key={r.muscle}>
                <th scope="row">{r.label}</th>
                {m.phases.map((p) => <td key={p.id} data-high={r.values[p.id] >= e.cut || undefined} data-current={p.id === phase.id || undefined}>{r.values[p.id]}%</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// The same comparison on both pages of a pair, with a link to the
// corresponding phase of the other movement.
function ContrastBox({ c, m, phase }: { c: Contrast; m: Movement; phase: Phase }) {
  const here = c.movements.indexOf(m.slug), otherSlug = c.movements[1 - here];
  const other = movements.find((x) => x.slug === otherSlug);
  const pair = c.phases.find((p) => p[here] === phase.id);
  const target = other?.phases.find((p) => p.id === pair?.[1 - here]);
  const names = c.movements.map((slug) => movements.find((x) => x.slug === slug)?.name ?? slug);
  return (
    <section className="mv-section" aria-labelledby={`mv-contrast-${c.id}`}>
      <h2 id={`mv-contrast-${c.id}`}>{c.title}</h2>
      <p>{c.lead}</p>
      <div className="mv-table-wrap">
        <table className="mv-joint-table">
          <thead><tr><th scope="col">항목</th>{names.map((n) => <th scope="col" key={n}>{n}</th>)}<th scope="col">출처</th></tr></thead>
          {/* Phones stack the rows and hide the header, so each value names its movement. */}
          <tbody>{c.rows.map((r) => <tr key={r.label}><th scope="row">{r.label}</th>{r.values.map((v, i) => <td key={c.movements[i]}><span className="mv-contrast-who">{names[i]}</span>{v}</td>)}<td><Cite ids={r.sources} />{r.note && <small> {r.note}</small>}</td></tr>)}</tbody>
        </table>
      </div>
      {c.note && <p className="mv-table-note">{c.note}</p>}
      {other && <p><a className="mv-contrast-link" href={`#movement/${other.slug}${target ? `/${target.id}` : ""}`}>{other.name}{target ? ` · ${target.name}` : ""} 보기</a></p>}
    </section>
  );
}

function ActivityStrip({ m, phase }: { m: Movement; phase: Phase }) {
  const rows = m.muscles.filter((row) => Object.values(row.cells).some((c) => c.evidence.includes("emg")));
  if (!rows.length) return null;
  const timed = Boolean(contactsOf(m));
  const span = (p: Phase, i: number) => timed ? { left: `${p.start * 100}%`, width: `${(p.end - p.start) * 100}%` } : { left: `${(i / m.phases.length) * 100}%`, width: `${100 / m.phases.length}%` };
  const reported = (c: MuscleCell | undefined) => Boolean(c && c.evidence.includes("emg") && !["silent", "low", "disputed", "nodata", "inhibited"].includes(c.contraction));
  return (
    <section className="mv-section" aria-labelledby="mv-strip">
      <h2 id="mv-strip">근전도로 보고된 활동 구간</h2>
      <p className="mv-table-note">막대는 해당 {m.phaseKind} 중 활동이 보고되었다는 뜻이며, {m.phaseKind} 전체에서 계속 활동한다거나 힘의 크기를 뜻하지 않습니다. 빗금은 근전도 자료가 없는 구간입니다. 번호는 위 {m.phaseKind} 버튼의 번호이며, {timed ? "폭은 보행 주기 %입니다" : "폭은 시간 비율이 아니라 같은 간격입니다"}.</p>
      <div className="mv-strip" role="table" aria-label="근전도 보고 구간">
        <div className="mv-strip-row mv-strip-axis" role="row">
          <span role="columnheader">근육</span>
          <div className="mv-track" role="presentation">
            {m.phases.map((p, i) => <span key={p.id} style={span(p, i)} data-current={p.id === phase.id || undefined} title={p.name}>{i + 1}</span>)}
          </div>
        </div>
        {rows.map((row) => (
          <div className="mv-strip-row" role="row" key={row.id}>
            <span role="rowheader">{row.name}</span>
            <div className="mv-track" role="cell" aria-label={m.phases.filter((p) => reported(row.cells[p.id])).map((p) => p.name).join(", ") || "보고 없음"}>
              {m.phases.map((p, i) => {
                const c = row.cells[p.id];
                const state = reported(c) ? "on" : c && c.evidence.includes("emg") ? "off" : "none";
                return <i key={p.id} data-state={state} style={span(p, i)} />;
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MovementPage({ route, sex }: { route: string; sex: Sex }) {
  const [, slug, phaseId] = route.split("/");
  const m = movements.find((x) => x.slug === slug);
  const lastSlug = useRef(slug);
  useEffect(() => {
    if (lastSlug.current !== slug) scrollTo(0, 0);
    lastSlug.current = slug;
  }, [slug]);
  if (!slug) return <MovementList />;
  if (!m) {
    return (
      <main className="movement-page movement-home">
        <h1>동작을 찾을 수 없습니다</h1>
        <p className="doc-lead"><a href="#movement">동작 목록으로 돌아가기</a></p>
      </main>
    );
  }
  return <MovementDetail key={m.slug} m={m} phaseId={phaseId} sex={sex} />;
}
