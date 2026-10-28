import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import {
  ArrowUpRight, BookOpen, Bookmark, Check, ChevronDown, CircleHelp, Eye, Focus, Link2, List, LoaderCircle,
  Minus, Plus, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Tag, X,
} from "lucide-react";
import AnatomyControls from "./AnatomyControls";
import PointTradition from "./PointTradition";
import { contextIsDimmed } from "./selection-context";
import { comparisonReference } from "./comparison-reference";
import { referenceSourceFor } from "./reference-source";
import { structureForSexId } from "./sex-structure";
import { depthStage, peelLimit, stageDepth } from "./dissection";
import { normalizeQuery, isExactPoint, isExactStructure, matchOrgans, rankPoints, rankStructures, splitExact } from "./search-rank";
import { CONNECTIVE_BUNDLE, type ViewAction, type ViewState } from "./view-state";
import { readOrigin, takeFocus } from "./movement-link";
import { useMedia } from "./use-media";
import { MODEST_MOVED_POINTS } from "./modesty";
import { FEMALE_TRANSPORT_NOTE,
  anatomyRegionNames, compositeGroups, connectiveKindNames, connectiveKindOf, detailForStructure, femaleBreastViews, femaleReproductiveViews, layerKeys, layerNames, maleKidneyViews, maleLungViews,
  malePancreasViews, organGroups, stageDescription, stages, structureGroups, structures, structuresForSex, type Layer,
} from "./anatomy";
import type { CameraAction, Layers, Point } from "./types";
import conceptData from "../data/point-concepts.json";
import concepts from "../data/concepts.json";
import pointData from "../data/points.json";
import meridians from "../data/meridians.json";
import sources from "../data/sources.json";
import femaleAcupointNotes from "../data/female-acupoint-notes.json";

// Male-source structures carried into the female body (src/anatomy.ts).
const transportedCount = structures.filter((s) => s.transport).length;
const Atlas = lazy(() => import("./Atlas"));
const points = pointData as Point[];
const pointConcepts = conceptData as Record<string, { categories: string[]; shuType: string | null; traditionalName: string | null; organIds: string[] }>;
const sourceById = (id: string) => sources.find((s) => s.id === id)!;
const meridianOf = (p: Point) => meridians.find((m) => m.id === p.meridian)!;
const categoryText = (id: string) => pointConcepts[id]?.categories.map((c) => concepts.find((x) => x.id === c)?.name).join(" · ") || "일반 경혈";
type Panel = "search" | "display" | "help" | "points" | "detail" | null;
// Short pickers open over the scene without closing the open panel.
type Popover = "meridian" | "depth" | null;
// Stable empty lists keep the 3D scene from redrawing on UI-only updates.
const NONE: string[] = [];
const fallbackPoint = { ...points.find((p) => p.id === "ST36")!, id: "", structures: [], landmarks: [] };
const detailTabs = [["overview", "개요"], ["tradition", "효능·오행"], ["anatomy", "해부 구조"], ["sources", "근거"]] as const;

function SourceLink({ id, page }: { id: string; page?: number | null }) {
  const s = sourceById(id);
  return (
    <a href={s.url} target="_blank" rel="noreferrer" className="source-link">
      <span>{s.publisher}<small>{page ? `위치 표준 · p. ${page}` : s.kind}</small></span>
      <ArrowUpRight size={15} />
    </a>
  );
}

// How the female approximate marker of a point was placed (shown only with those markers on).
const femaleRuleCount = Object.values(femaleAcupointNotes.methods).reduce((sum, ids) => sum + ids.length, 0);
const CHEST_RELATION_IDS = ["ST17", "ST18", "LR14", "GB24", "KI22", "KI23", "SP17", "SP18"];
function femaleMarkerNote(id: string) {
  const { methods } = femaleAcupointNotes;
  const notes = [methods["female-landmark-cun"].includes(id)
    ? "여성 배꼽·두덩결합·칼몸통결합(일부는 위앞엉덩뼈가시)과 두 젖꼭지 사이 8촌으로 WHO 비례촌을 다시 계산한 근사 위치입니다."
    : methods["female-landmark-level"].includes(id) ? "높이만 여성 표지(배꼽·두덩결합 위모서리)에 맞추고, 가로 위치는 남성 표식을 옮긴 근사 위치입니다."
    : methods["female-landmark"].includes(id) ? "여성 몸의 표지(젖꼭지 중심·유방 아래 주름·위앞엉덩뼈가시와 무릎뼈 바닥을 잇는 선)에 직접 놓은 근사 위치입니다."
    : femaleAcupointNotes.regionReference.includes(id) ? "입·코 안의 내부 참조점을 남성 표식에서 옮긴 근사입니다."
    : "남성 표식을 여성 골격·피부 대응(정합장)으로 옮긴 근사 위치입니다."];
  if (id === "ST18") notes.push("WHO의 여성 기준(유방 아래 주름의 중점)을 따라 이 몸에서는 ST19보다 아래에 있습니다.");
  // WHO relations the female ST17/ST18 cannot keep with the carried intercostal points (data/female-acupoint-rules.json).
  if (CHEST_RELATION_IDS.includes(id) && femaleAcupointNotes.knownBoundaryFailures.includes("ST18 superior to LR14"))
    notes.push("가슴 갈비사이공간 경혈은 아직 남성 표식을 옮긴 것이라, 여성 젖꼭지·유방 아래 주름에 놓은 ST17·ST18과 WHO가 정한 높이 관계(LR14는 젖꼭지 아래 등)가 이 몸에서 맞지 않습니다.");
  if (id === "ST32" && femaleAcupointNotes.knownBoundaryFailures.includes("ST31-ST32 spacing")) notes.push("WHO 위치(무릎뼈 바닥 위 6촌)보다 약 100mm 위에 있습니다.");
  if (id === "GB28") notes.push("WHO 본문(위앞엉덩뼈가시 기준)과 주석(GB27 기준)이 이 몸에서 달라 주석을 따랐고, 위앞엉덩뼈가시에서 약 30mm 떨어집니다.");
  if (femaleAcupointNotes.breastSurface.includes(id)) notes.push("유방 표면에 놓인 표식이며, 기준 위치는 유방 아래 가슴벽일 수 있습니다.");
  if (femaleAcupointNotes.facingException.includes(id)) notes.push("옮겨 온 방향에 맞는 피부면이 없어 반대쪽 면(가슴 옆벽)에 놓였고, 실제 위치와 다를 수 있습니다.");
  return `여성 근사 표식 · ${notes.join(" ")} 전문가 검수 전입니다.`;
}
function PointDetail({ point, onFocus, saved, onSave, onCompare, onClose, comparisonFeedback, femaleNote, modestyNote }: {
  point: Point; onFocus: () => void; saved: boolean; onSave: () => void; onCompare: () => void; onClose: () => void; comparisonFeedback?: ReactNode; femaleNote?: string; modestyNote?: string;
}) {
  const feedbackRef = useRef<HTMLDivElement>(null);
  const hasComparisonFeedback = Boolean(comparisonFeedback);
  useEffect(() => {
    if (!hasComparisonFeedback) return;
    const frame = requestAnimationFrame(() => feedbackRef.current?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [hasComparisonFeedback, point.id]);
  const [tab, setTab] = useState("overview");
  const tabScope = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [copied, setCopied] = useState(false);
  const concept = pointConcepts[point.id];
  useEffect(() => { setTab("overview"); setCopied(false); }, [point.id]);
  async function share() {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#atlas/${point.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  }
  return (
    <section className="detail-panel ax-card" aria-label="선택한 경혈 상세" id="atlas-dock">
      <div className="detail-head">
        <div className="ax-card-head">
          <span className="ax-eyebrow">{point.catalogue === "extra" ? "경외기혈" : `${meridianOf(point).name} · 정규 경혈`} · {point.markerCount}곳 표시</span>
          <button className="ax-icon" onClick={onSave} aria-label={saved ? "북마크 해제" : "북마크 저장"} data-tip={saved ? "북마크 해제" : "북마크 저장"} aria-pressed={saved}>
            <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
          </button>
          <button className="ax-icon" onClick={onClose} aria-label="도구 패널 닫기" data-tip="닫기"><X size={17} /></button>
        </div>
        <h2 className="ax-point-title"><span><i style={{ background: meridianOf(point).color }} />{point.id}</span>{point.name}<small>{point.hanja}</small></h2>
        <p className="ax-pinyin">{point.pinyin} · {categoryText(point.id)}{concept?.shuType ? ` ${concept.shuType}` : ""}{concept?.traditionalName ? <> · 전통적 장부 대응: <b>{concept.traditionalName}</b></> : null}</p>
        <div className="detail-actions">
          {/* Short visible labels; each accessible name contains its label. */}
          {!!concept?.organIds.length && <button className="ax-primary" aria-label="대응 장부의 해부 구조 비교" onClick={onCompare}>해부 구조 비교</button>}
          <button className="focus-link" aria-label="3D에서 가까이 보기" onClick={onFocus}><Focus size={15} />가까이 보기</button>
          <a className="focus-link" aria-label="위키에서 더 알아보기" href={`#wiki/points/${point.id}`}><BookOpen size={15} />위키</a>
        </div>
        {comparisonFeedback && <div ref={feedbackRef} className="comparison-feedback" role="status">{comparisonFeedback}</div>}
        <p className="concept-notice">
          {concept?.traditionalName && !concept.organIds.length && "이 전통 개념에 일대일 대응하는 장기 메쉬는 지정하지 않았습니다. "}
          장부 대응은 전통적 분류입니다. 체표에서 장기로 압력이 전달되거나 장기를 직접 마사지한다는 뜻이 아닙니다.
        </p>
      </div>
      <div className="detail-scroll">
        <div className="detail-tabs" role="tablist" aria-label="경혈 정보">
          {detailTabs.map(([id, name], index) =>
            <button key={id} ref={(element) => { tabRefs.current[index] = element; }}
              id={`${tabScope}-${id}`} role="tab" aria-selected={tab === id}
              aria-controls={`${tabScope}-panel`} tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)} onKeyDown={(event) => {
                if (event.altKey || event.ctrlKey || event.metaKey) return;
                const next = event.key === "ArrowRight" ? (index + 1) % detailTabs.length
                  : event.key === "ArrowLeft" ? (index + detailTabs.length - 1) % detailTabs.length
                  : event.key === "Home" ? 0 : event.key === "End" ? detailTabs.length - 1 : -1;
                if (next < 0) return;
                event.preventDefault();
                setTab(detailTabs[next][0]);
                tabRefs.current[next]?.focus({ preventScroll: true });
              }}>{name}</button>)}
        </div>
        <div className="detail-content" role="tabpanel" id={`${tabScope}-panel`} aria-labelledby={`${tabScope}-${tab}`} tabIndex={0}>
          {tab === "tradition" && <PointTradition point={point} />}
          {tab === "overview" && <>
            <p className="location-text">{point.location}</p>
            <div className="reference-line">
              <a href={point.nameSource} target="_blank" rel="noreferrer">KMCRIC 위치 원문 ↗</a>
              {point.page && <span>WHO p. {point.page}</span>}
            </div>
            <div className="anatomy-tags">{point.landmarks.map((s) => <span key={s}>{s}</span>)}</div>
            <p className="muted">{point.structures.length ? "골격·근육 레이어에서 관련 부위가 강조됩니다." : "이 경혈의 개별 기준점 메쉬는 아직 연결하지 않았습니다."}</p>
            <p className="coordinate-note"><span className="status-dot" />학습용 근사 위치 · {point.markerNote} 전문가의 위치 검수는 아직 진행하지 않았습니다.</p>
            {femaleNote && <p className="coordinate-note" data-female-marker-note>{femaleNote}</p>}
            {modestyNote && <p className="coordinate-note" data-modesty-marker-note>{modestyNote}</p>}
            <span className="ax-links"><a href="#wiki/point-categories">원혈·모혈 분류와 출처 ↗</a><a href="#wiki/massage-anatomy">마사지 전 해부학 참고 가이드 ↗</a></span>
          </>}
          {tab === "anatomy" && <>
            <p className="location-text">{point.landmarks.join(" · ")}</p>
            <div className="anatomy-tags">{point.structures.map((s) => <span key={s}>{s}</span>)}</div>
            <p className="muted">표시된 메쉬는 기준점 또는 같은 부위의 참조 구조입니다. 신경·혈관·힘줄을 모두 포함하지 않으며, 경맥과 해부 구조가 동일하다는 뜻은 아닙니다.</p>
            <button className="focus-link" onClick={onFocus}><Focus size={15} />관련 부위 확대</button>
            <a className="text-link" href="#wiki/coordinate-method">좌표를 만든 방법 ↗</a>
          </>}
          {tab === "sources" && <>
            <a className="source-link" href={point.nameSource} target="_blank" rel="noreferrer">{point.id} 명칭·위치 원문 ↗</a>
            {point.catalogue === "classical" && <SourceLink id="who-locations" page={point.page} />}
            <SourceLink id={point.traditionSourceId} />
            <p className="muted">공식 PDF 접근 제한으로 WHO 문서의 <a href={sourceById("who-locations").accessUrl} target="_blank" rel="noreferrer">공개 재현본</a>과 대조했습니다. 위치 표준은 치료 효과의 근거가 아닙니다.</p>
            <SourceLink id="bodyparts" />
            <a className="text-link" href="#wiki/evidence">근거를 읽는 방법 ↗</a>
          </>}
          <div className="detail-bottom">
            {point.related.length > 0 && <div className="related-points" aria-label="연결된 경혈">
              {point.related.slice(0, 3).map((id) => <a key={id} href={`#atlas/${id}`}>{points.find((p) => p.id === id)?.name}<span>{id}</span></a>)}
            </div>}
            <button className="share-link" onClick={share}>{copied ? <Check size={14} /> : <Link2 size={14} />}{copied ? "링크를 복사했습니다" : "이 경혈 링크 복사"}</button>
          </div>
        </div>
      </div>
    </section>
  );
}

// The acupoint bar names meridians in Korean (폐경, 위경 …). The kidney
// meridian's short name 신경(腎經) reads like the nerve layer 신경(神經), so it
// carries its character; the full name stays in the tooltip.
const meridianChipName = (m: { id: string; shortName: string }) => m.id === "KI" ? "신경(腎)" : m.shortName;

export default function AtlasPage({ id, saved, toggle, state, dispatch, navigate, notice, onNotice }: {
  id: string; saved: string[]; toggle: (id: string) => void; state: ViewState; dispatch: Dispatch<ViewAction>; navigate: (path: string) => void;
  // A movement-page link that named structures this body does not have.
  notice?: string; onNotice?: () => void;
}) {
  const routeSelection = points.find((p) => p.id === id);
  const hasSelected = Boolean(routeSelection);
  const selected = routeSelection || fallbackPoint;
  const [panel, setPanel] = useState<Panel>(null);
  const [popover, setPopover] = useState<Popover>(null);
  const popoverTrigger = useRef<HTMLElement | null>(null);
  // Presenting hides the exploration tools but keeps the selection, its
  // notices and the camera; it is a UI mode, not part of the saved view.
  const [presenting, setPresenting] = useState(false);
  const presentTrigger = useRef<HTMLElement | null>(null);
  const phone = useMedia("(max-width: 700px)");
  // Short landscape phones open the stops in a band beside the rail, like the phone band.
  const shortLandscape = useMedia("(min-width: 701px) and (max-height: 560px)");
  // What the rail says after a user changes what the peel keeps. Every note is
  // announced (cleared first, so a repeated note is announced again); a reason
  // (a refused last system, a pressed left-out stop) is also shown: beside its
  // row on rails, in place of the band legend on phones and in landscape. A
  // reason is transient: the next depth, selection or sex change, Escape or a
  // pointer outside the depth group hides it.
  type KeepNote = { text: string; reason: boolean; layer?: Layer };
  const [keepNote, setKeepNote] = useState<KeepNote>({ text: "", reason: false });
  const keepNoteReason = useRef(false);
  keepNoteReason.current = keepNote.reason;
  const announce = (next: KeepNote) => { setKeepNote({ text: "", reason: false }); requestAnimationFrame(() => setKeepNote(next)); };
  const hideReason = () => setKeepNote((note) => note.reason ? { ...note, reason: false } : note);
  useEffect(() => setKeepNote({ text: "", reason: false }), [popover, state.displayMode, state.anatomyRegion]);
  useEffect(hideReason, [state.dissection, state.selection, state.sex, panel, presenting]);
  useEffect(() => {
    if (!keepNote.reason) return;
    const down = (event: PointerEvent) => { if (!(event.target as Element | null)?.closest?.(".ax-depth")) hideReason(); };
    addEventListener("pointerdown", down, true);
    return () => removeEventListener("pointerdown", down, true);
  }, [keepNote.reason]);
  // A tool panel opening over the scene closes the stops band.
  useEffect(() => { if (panel) setPopover((current) => current === "depth" ? null : current); }, [panel]);
  const depthSlider = useRef<HTMLInputElement>(null);
  // Short landscape phones also take the compact camera group.
  const compactCamera = useMedia("(max-width: 700px), (max-height: 500px)");
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLElement | null>(null);
  // Programmatic focus must not open search or replace the shortcut's trigger.
  const skipSearchFocus = useRef(false);
  const focusWithoutOpeningSearch = useCallback((element: HTMLElement | null) => {
    skipSearchFocus.current = true;
    try { element?.focus({ preventScroll: true }); }
    finally { skipSearchFocus.current = false; }
  }, []);
  const dockRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const [action, setAction] = useState<CameraAction>({
    // A validated selection with a deliberately cleared migration pose must
    // wait for its real meshes and frame them, not consume a no-op restore.
    kind: state.selection && !state.camera ? "structure" : "restore",
    tick: 0,
  });
  const isolateCameraFrame = useRef<number | null>(null);
  const sourceKey = referenceSourceFor(state.sex, [...(state.selection?.ids || []), ...(state.detail?.ids || [])]);
  const pendingOverviewPose = useRef<ViewState["camera"]>(null);
  const [loaded, setLoaded] = useState<{ source: string | null; layers: Layer[] }>({ source: null, layers: [] });
  const [loadingReference, setLoadingReference] = useState(false);
  const [comparisonNotice, setComparisonNotice] = useState("");
  const [separateDetailIds, setSeparateDetailIds] = useState<string[]>([]);
  const comparisonPoint = points.find((point) => point.id === state.comparison?.pointId);
  // A successful comparison's CT choices survive reload/wiki return with it.
  // Local separateDetailIds is only for the unsuccessful-comparison notice.
  const comparisonDetailIds = useMemo(() => {
    const concept = state.comparison && pointConcepts[state.comparison.pointId];
    return concept ? comparisonReference(state.sex, concept.organIds, structures, organGroups).separateGroupIds : NONE;
  }, [state.sex, state.comparison?.pointId]);
  // The selection made in place on the model (placeStructure), kept through
  // its clearing so the picture glides back too; another selection or an
  // explicit camera action ends it.
  const [placed, setPlaced] = useState("");
  useEffect(() => { setComparisonNotice(""); setSeparateDetailIds([]); }, [state.sex, state.pointId]);
  const { query, region, meridian, concept, onlySaved, bodyRegion, catalogue } = state.filters;
  const setFilter = (value: Partial<ViewState["filters"]>) => dispatch({ type: "filters", value });
  // Results come first; the filters fold away where height is short unless
  // one of them is in use (QUALITY: 상세 필터는 필요할 때 펼칩니다).
  const roomy = useMedia("(min-width: 701px) and (min-height: 761px)");
  const activeFilters = [
    concept !== "all" && concepts.find((c) => c.id === concept)?.name,
    bodyRegion !== "전체" && bodyRegion,
    meridian !== "all" && meridians.find((m) => m.id === meridian)?.name,
    catalogue !== "all" && (catalogue === "extra" ? "경외기혈" : "정규 경혈"),
    region !== "전체" && region,
  ].filter(Boolean).join(" · ");
  const [filtersChoice, setFiltersOpen] = useState<boolean | null>(null);
  const filtersOpen = filtersChoice ?? (roomy || Boolean(activeFilters));
  const resetFilters = () => dispatch({ type: "reset-filters" });
  const found = useMemo(() => points.filter((p) =>
    (region === "전체" || p.region === region) &&
    (bodyRegion === "전체" || p.bodyRegion === bodyRegion) &&
    (catalogue === "all" || p.catalogue === catalogue) &&
    (meridian === "all" || p.meridian === meridian) &&
    (concept === "all" || pointConcepts[p.id]?.categories.includes(concept)) &&
    (!onlySaved || saved.includes(p.id)) &&
    `${p.id} ${p.name} ${p.hanja} ${p.pinyin} ${p.landmarks.join(" ")} ${meridianOf(p)?.name}`.toLowerCase().includes(normalizeQuery(query))),
  [region, bodyRegion, catalogue, meridian, concept, onlySaved, saved, query]);
  const camera = (kind: CameraAction["kind"]) => {
    if (kind === "focus" && state.sex === "female" && !state.femaleMarkers) {
      setComparisonNotice("여성 표면의 경혈 좌표는 검수 전입니다. 남성 기준 좌표로 이동하지 않습니다.");
      setSeparateDetailIds([]);
      setPanel("detail");
      return;
    }
    setAction((a) => ({ kind, tick: a.tick + 1 }));
    // Re-centring on a part picked in place keeps that pick's gliding card.
    if (kind !== "pivot") setPlaced("");
    if (kind === "focus" && state.markers === "hidden") dispatch({ type: "markers", value: "selected" });
  };
  const restoreOverviewPose = (pose: NonNullable<ViewState["camera"]>) => {
    // An overview source loaded after a CT/BP4 detail would otherwise run its
    // usual fit and overwrite the saved pre-detail viewpoint.
    if (sourceKey !== referenceSourceFor(state.sex, [])) pendingOverviewPose.current = pose;
    else setAction((a) => ({ kind: "pose", pose, tick: a.tick + 1 }));
  };
  const previousSex = useRef(state.sex);
  useEffect(() => {
    if (previousSex.current === state.sex) return;
    previousSex.current = state.sex;
    pendingOverviewPose.current = null;
    camera("fit");
  }, [state.sex]);
  const closePanel = () => {
    setPanel(null);
    requestAnimationFrame(() => focusWithoutOpeningSearch(triggerRef.current));
  };
  const openPanel = (name: Panel, trigger?: HTMLElement) => {
    if (trigger) triggerRef.current = trigger;
    setPanel((current) => (current === name ? null : name));
  };
  useEffect(() => {
    // Reopening the list brings the current row to its top when out of view.
    if (panel === "points") requestAnimationFrame(() => {
      const list = dockRef.current?.querySelector<HTMLElement>(".point-list"), row = list?.querySelector<HTMLElement>(".point-item.active");
      if (!list || !row || list.scrollHeight <= list.clientHeight) return;
      const top = row.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = Math.max(0, top - 4);
    });
    if (panel && panel !== "search" && panel !== "detail") {
      dockRef.current?.querySelector<HTMLElement>("input:not([type=checkbox]),select,button:not([aria-label='도구 패널 닫기'])")?.focus({ preventScroll: true });
    }
  }, [panel]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // Checks, sliders and buttons do not take text, so '/' still opens search there.
      const typing = (e.target instanceof HTMLInputElement && !["checkbox", "radio", "range", "button", "submit", "reset", "color"].includes(e.target.type)) || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (e.key === "Escape") {
        if (e.defaultPrevented) return;
        const pad = workspaceRef.current?.querySelector<HTMLDetailsElement>("details.movement-pad[open]");
        if (pad) { pad.open = false; pad.querySelector("summary")?.focus({ preventScroll: true }); return; }
        // An open picker closes first while its trigger can be seen; one that
        // cannot (a phone band left open across a resize) is cleared silently.
        if (popover) {
          const shown = popoverTrigger.current?.checkVisibility({ visibilityProperty: true }) ?? false;
          setPopover(null);
          if (shown) { requestAnimationFrame(() => focusWithoutOpeningSearch(popoverTrigger.current)); return; }
        }
        // Panels and presenting take Escape first; a visible reason closes after them.
        if (keepNoteReason.current && !panel && !presenting) { hideReason(); return; }
        if (!panel) {
          if (presenting) stopPresenting();
          return;
        }
        setPanel(null);
        if (typing && e.target === searchRef.current) searchRef.current?.blur();
        // On phones the point chip is hidden while its detail is open.
        // Restore focus after closing makes the trigger visible again.
        requestAnimationFrame(() => focusWithoutOpeningSearch(triggerRef.current));
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        // Search closes the stops band; Escape then returns to the band's toggle.
        triggerRef.current = popover === "depth" && active?.closest(".depth-steps") ? popoverTrigger.current : active;
        setPanel("search");
        focusWithoutOpeningSearch(searchRef.current);
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [panel, popover, presenting, focusWithoutOpeningSearch]);
  // A picker closes when the pointer goes down anywhere outside it.
  useEffect(() => {
    if (!popover) return;
    const down = (event: PointerEvent) => {
      // The trigger and its picker share one root element.
      if (popoverTrigger.current?.closest("[data-popover-root]")?.contains(event.target as Node)) return;
      setPopover(null);
    };
    addEventListener("pointerdown", down, true);
    return () => removeEventListener("pointerdown", down, true);
  }, [popover]);
  const togglePopover = (name: NonNullable<Popover>, trigger: HTMLElement) => {
    popoverTrigger.current = trigger;
    // The stops band takes the scene's tool layer: a side panel and the 시점 menu close.
    if (name === "depth" && popover !== "depth") {
      setPanel(null);
      const pad = workspaceRef.current?.querySelector<HTMLDetailsElement>("details.movement-pad[open]");
      if (pad) pad.open = false;
    }
    setPopover((current) => current === name ? null : name);
  };
  const closePopover = () => {
    setPopover(null);
    requestAnimationFrame(() => popoverTrigger.current?.focus({ preventScroll: true }));
  };
  const startPresenting = (trigger: HTMLElement) => {
    presentTrigger.current = trigger;
    setPanel(null); setPopover(null); setPresenting(true);
    requestAnimationFrame(() => workspaceRef.current?.querySelector<HTMLElement>(".ax-present-exit")?.focus({ preventScroll: true }));
  };
  // The phone entry sits in the settings panel, which closed on entry.
  const presentReturn = () => presentTrigger.current?.isConnected ? presentTrigger.current
    : workspaceRef.current?.querySelector<HTMLElement>('[aria-label="표시 설정"]') ?? null;
  const stopPresenting = () => {
    setPresenting(false);
    requestAnimationFrame(() => focusWithoutOpeningSearch(presentReturn()));
  };
  // Choosing an acupoint keeps the camera where the viewer is looking. Only
  // an independent detail source (its own frame) returns to the whole body.
  // A result chosen inside a closing panel hands focus to what it opened;
  // a marker clicked on the canvas keeps the canvas focus (Q13).
  const focusAfterPanel = (selector: string) => {
    if (!dockRef.current?.contains(document.activeElement)) return;
    requestAnimationFrame(() => requestAnimationFrame(() => focusWithoutOpeningSearch(workspaceRef.current?.querySelector<HTMLElement>(selector) ?? null)));
  };
  const select = (p: Point) => {
    focusAfterPanel(".point-summary");
    const leavingDetail = Boolean(state.detail);
    const returnPose = leavingDetail ? state.detailReturn?.camera : null;
    if (isolateCameraFrame.current !== null) cancelAnimationFrame(isolateCameraFrame.current);
    isolateCameraFrame.current = null;
    dispatch({ type: "point", id: p.id });
    navigate(`atlas/${p.id}`);
    setPanel(null);
    setSearch("");
    if (returnPose) restoreOverviewPose(returnPose);
    else if (leavingDetail) requestAnimationFrame(() => camera("fit"));
  };
  const compare = () => {
    const c = pointConcepts[selected.id];
    if (!c?.organIds.length) return;
    const { overviewIds: ids, separateGroupIds } = comparisonReference(state.sex, c.organIds, structures, organGroups);
    if (!ids.length) {
      setComparisonNotice("현재 여성 전신 원본에는 요청한 기관의 전체 비교 모형이 없습니다.");
      setSeparateDetailIds(separateGroupIds);
      return;
    }
    setComparisonNotice("");
    // A separate female CT organ stays one explicit choice away from the comparison.
    setSeparateDetailIds([]);
    dispatch({
      type: "compare",
      name: c.traditionalName || selected.name,
      ids,
      layers: Object.fromEntries(layerKeys.map((layer) => [layer, layer === "skin" || structures.some((s) => s.layer === layer && ids.includes(s.id))])) as Layers,
      selectionLayers: layersOf(ids),
    });
    setPanel(null);
    camera("comparison");
  };
  const onReady = useCallback(
    (l: Layer) => setLoaded((v) => v.source !== sourceKey
      ? { source: sourceKey, layers: [l] }
      : v.layers.includes(l) ? v : { ...v, layers: [...v.layers, l] }),
    [sourceKey],
  );
  const enabledLayers = layerKeys.filter((l) => state.layers[l]);
  const loadedLayers = loaded.source === sourceKey ? enabledLayers.filter((l) => loaded.layers.includes(l)) : [];
  const ready = loaded.source === sourceKey && enabledLayers.every((l) => loaded.layers.includes(l)) && !loadingReference;
  const selectionKey = state.selection?.ids.join("|") || "";
  // Opened from the movement page: the card links back while that selection lasts.
  const movementOrigin = useMemo(() => {
    const origin = selectionKey ? readOrigin() : null;
    return origin && origin.ids.join("|") === selectionKey ? origin : null;
  }, [selectionKey]);
  const framedSource = useRef(sourceKey);
  useEffect(() => {
    if (!ready || framedSource.current === sourceKey) return;
    framedSource.current = sourceKey;
    // A detail camera belongs to its own source coordinates and scale. Wait
    // for the overview geometry before fitting it; ordinary peeling/layer
    // changes within one source must still preserve the user's camera.
    if (!selectionKey && !state.comparison) {
      const returnPose = pendingOverviewPose.current;
      pendingOverviewPose.current = null;
      if (returnPose) setAction((a) => ({ kind: "pose", pose: returnPose, tick: a.tick + 1 }));
      else camera("fit");
    }
  }, [sourceKey, ready, selectionKey, state.comparison]);
  const focusedSelection = useRef(selectionKey);
  useEffect(() => { if (selectionKey && selectionKey !== placed) setPlaced(""); }, [selectionKey, placed]);
  useEffect(() => {
    if (!selectionKey) { focusedSelection.current = ""; return; }
    // A "3D에서 맞춰 보기" link asks for one fit even when it reopens the
    // selection the atlas already had.
    if (takeFocus(selectionKey)) focusedSelection.current = "";
    if (focusedSelection.current === selectionKey || !ready || state.comparison) return;
    const frame = requestAnimationFrame(() => {
      focusedSelection.current = selectionKey;
      camera("structure");
    });
    return () => cancelAnimationFrame(frame);
  }, [selectionKey, ready, state.comparison]);
  const onPose = useCallback((value: import("./view-state").CameraPose) => dispatch({ type: "camera", value }), [dispatch]);
  // Many points are shown on the body at once; the chosen point always stays
  // visible even when a meridian filter would exclude it.
  // An isolated structure hides the body, so only the chosen point stays as
  // its reference instead of markers floating in empty space.
  const markers = useMemo(() => state.markers === "hidden" ? []
    : state.markers === "selected" || state.isolated ? (hasSelected ? [selected] : [])
    : hasSelected && !found.some((p) => p.id === selected.id) ? [...found, selected] : found,
  [state.markers, state.isolated, hasSelected, selected, found]);
  // Previous/next follow the current filter results. A comparison or detail
  // source belongs to its acupoint, so stepping waits until it is closed;
  // stepping replaces the history entry and never moves the camera.
  const stepAt = hasSelected ? found.findIndex((p) => p.id === selected.id) : -1;
  const stepBlocked = Boolean(state.comparison || state.detail);
  const prevPoint = stepBlocked || stepAt <= 0 ? null : found[stepAt - 1];
  const nextPoint = stepBlocked ? null : stepAt < 0 ? found[0] ?? null : found[stepAt + 1] ?? null;
  const stepTip = (p: Point | null, edge: string) => p
    ? `${p.name} ${p.id} · ${found.indexOf(p) + 1}/${found.length}`
    : stepBlocked ? "비교·기관 상세를 닫으면 넘길 수 있습니다" : found.length ? edge : "필터 결과가 없습니다";
  const step = (p: Point | null) => {
    if (!p) return;
    dispatch({ type: "point", id: p.id });
    history.replaceState(history.state, "", `#atlas/${p.id}`);
    dispatchEvent(new HashChangeEvent("hashchange"));
  };
  const featuredAnatomy = organGroups.filter((group) => group.sex === state.sex)
    .map((group) => ({ ...group, detail: group.ids.length > 1 ? `${group.ids.length}개 세부 모형` : "단일 원본 모형" }));
  const selectFeatured = (item: { id: string; name: string; ids: string[] }) => {
    focusAfterPanel(".selection-card");
    dispatch({
      type: "detail",
      detail: { id: item.id, name: item.name, ids: item.ids, layers: Object.fromEntries(layerKeys.map((layer) => [layer, structures.some((s) => s.layer === layer && item.ids.includes(s.id))])) as Layers },
    });
    setPanel(null);
    setSearch("");
    requestAnimationFrame(() => camera("structure"));
  };
  const showAllSystems = () => {
    dispatch({ type: "layers", layers: Object.fromEntries(layerKeys.map((layer) => [layer, true])) as Layers });
    setPanel(null);
    camera("fit");
  };
  const shiftDissection = useCallback((amount: number) => dispatch({ type: "dissection-step", amount }), [dispatch]);
  // The bottom row (status, acupoint bar, camera tools) grows with wrapping and
  // context; the depth rail and inspector sit above its measured height.
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = bottomRef.current, root = workspaceRef.current;
    if (!row || !root) return;
    // On phones the row is split up and only the acupoint bar stays at the
    // bottom; sheets and the camera column sit above its wrapped height.
    const bar = row.querySelector<HTMLElement>(".ax-point-bar");
    const measure = () => {
      root.style.setProperty("--ax-bottom-h", `${Math.ceil(row.getBoundingClientRect().height)}px`);
      if (bar) root.style.setProperty("--ax-bar-h", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(row); if (bar) observer.observe(bar); measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const wheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // The region select inside the depth group keeps its own wheel.
      const depthControl = Boolean(target.closest(".depth-explorer")) && !target.closest("select");
      if (!depthControl && !(event.altKey && target instanceof HTMLCanvasElement)) return;
      // A non-passive listener actually prevents native scrolling/zooming.
      // A horizontal gesture is consumed here without changing peel depth.
      event.preventDefault();
      event.stopPropagation();
      if (event.deltaY !== 0) shiftDissection(event.deltaY > 0 ? .5 : -.5);
    };
    workspace.addEventListener("wheel", wheel, { capture: true, passive: false });
    return () => workspace.removeEventListener("wheel", wheel, true);
  }, [shiftDissection]);
  const selectedAnatomy = state.selection?.kind === "structure" ? structureForSexId(structures, state.sex, state.selection.ids[0]) : null;
  const selectedGroup = state.detail?.id || selectedAnatomy?.group;
  const selectedKind = selectedAnatomy ? connectiveKindOf(selectedAnatomy.id) : undefined;
  const connectiveBundle = state.selection?.kind === "bundle" && state.selection.name === CONNECTIVE_BUNDLE && !state.detail;
  const selectedOrgan = structureGroups.find((group) => group.id === selectedGroup && group.sex === state.sex);
  const selectedComposite = compositeGroups.find((group) => group.id === selectedGroup && group.sex === state.sex);
  const selectedLungPart = Boolean(state.sex === "male" && selectedAnatomy && maleLungViews.some((view) => view.id === selectedGroup));
  const bundleIs = (views: { id: string; ids: string[] }[]) => Boolean(state.sex === "male" && state.detail && state.selection?.kind === "bundle"
    && views.some((view) => view.id === state.detail!.id && view.ids.length === state.selection!.ids.length && view.ids.every((vid) => state.selection!.ids.includes(vid))));
  const fullLungDetail = bundleIs(maleLungViews);
  const fullPancreasDetail = bundleIs(malePancreasViews);
  const fullKidneyDetail = bundleIs(maleKidneyViews);
  const viewOptions = (views: { id: string; name: string; ids: string[] }[], label: (id: string) => string) =>
    state.sex === "male" && views.some((view) => view.id === selectedGroup)
      ? views.filter((view) => view.id !== selectedGroup).map((view) => <button key={view.id} onClick={() => selectFeatured(view)}>{label(view.id)}</button>) : null;
  const lungViewOptions = viewOptions(maleLungViews, (v) => v === "lung" ? "폐실질 함께 보기" : v === "lung-internal" ? "혈관·기관지 보기" : "이전 세부 가지 별도 보기");
  const pancreasViewOptions = viewOptions(malePancreasViews, (v) => v === "pancreas" ? "췌장 전체 형상 보기" : "췌장 실질·관 가지 별도 보기");
  const kidneyViewOptions = viewOptions(maleKidneyViews, (v) => v === "kidney" ? "양쪽 콩팥 전체 보기" : v === "kidney-left" ? "왼쪽 콩팥·혈관 확대 보기" : "오른쪽 콩팥·혈관 확대 보기");
  // Female breast and reproductive organs: the views that uncover what their
  // own covering hides (the breast fat, the peritoneal folds over the uterus).
  const reproductiveScope = state.sex === "female" && (["uterus", "ovary", "uterine-tube", "vagina"].includes(selectedGroup || "")
    || femaleReproductiveViews.some((view) => view.id === selectedGroup) || Boolean(selectedAnatomy && femaleReproductiveViews[1].ids.includes(selectedAnatomy.id)));
  const breastScope = state.sex === "female" && femaleBreastViews.some((view) => view.id === selectedGroup);
  const femaleViewOptions = [
    ...(reproductiveScope ? femaleReproductiveViews : []), ...(breastScope ? femaleBreastViews : []),
  ].filter((view) => view.id !== (state.detail ? state.detail.id : selectedGroup)).map((view) => <button key={view.id} onClick={() => {
    selectFeatured(view);
    // The pressed button leaves the card with its view; keep focus on the card.
    requestAnimationFrame(() => requestAnimationFrame(() => focusWithoutOpeningSearch(workspaceRef.current?.querySelector<HTMLElement>(".selection-card") ?? null)));
  }}>{view.id === "female-reproductive" ? "여성 생식기관 함께 보기" : view.id === "female-reproductive-peritoneum" ? "복막 포함 보기" : view.id === "breast" ? "유방 전체 보기" : "젖샘엽·젖샘관 보기"}</button>);
  const fullCompositeDetail = Boolean(selectedComposite && state.detail && state.selection?.kind === "bundle"
    && state.selection.ids.length === selectedComposite.ids.length && selectedComposite.ids.every((cid) => state.selection!.ids.includes(cid)));
  const detailParts = selectedOrgan ? structuresForSex(state.sex).filter((item) => selectedOrgan.ids.includes(item.id))
    .sort((a, b) => selectedOrgan.ids.indexOf(a.id) - selectedOrgan.ids.indexOf(b.id)) : [];
  // Card content remounts per selection so a newly chosen name starts in
  // view; keep the parts list open across those remounts within one organ.
  // A new organ, sex or cleared selection starts the list collapsed again.
  const partsScope = state.selection && selectedOrgan ? `${state.sex}:${selectedOrgan.id}` : "";
  const [partsOpen, setPartsOpen] = useState({ scope: "", open: false });
  if (partsOpen.scope && partsOpen.scope !== partsScope) setPartsOpen({ scope: "", open: false });
  const detailPartsOpen = partsOpen.open && partsOpen.scope === partsScope;
  const movementButtons = <div>{([
    ["move-up", "위로 이동", "↑"], ["move-forward", "앞으로 이동", "전진"], ["move-down", "아래로 이동", "↓"],
    ["move-left", "왼쪽으로 이동", "←"], ["move-backward", "뒤로 이동", "후진"], ["move-right", "오른쪽으로 이동", "→"],
  ] as const).map(([kind, label, text]) => <button key={kind} aria-label={label} data-tip={label} data-tip-side="top" onClick={() => camera(kind)}>{text}</button>)}</div>;
  // Clearing a selection restores the systems it replaced but keeps the
  // camera; only an independent detail source returns to its overview pose.
  const leaveSelection = () => {
    if (isolateCameraFrame.current !== null) cancelAnimationFrame(isolateCameraFrame.current);
    isolateCameraFrame.current = null;
    const pose = state.detail ? state.detailReturn?.camera : null;
    dispatch({ type: "clear-selection" });
    if (pose) restoreOverviewPose(pose);
    else if (state.detail) requestAnimationFrame(() => camera("fit"));
  };

  // Unified search: acupoints, organ details and every catalogued structure,
  // ranked so an exact name/code/FMA match comes first (src/search-rank.ts).
  const q = search.trim().toLowerCase();
  const [allPointResults, setAllPointResults] = useState(false);
  useEffect(() => setAllPointResults(false), [q]);
  const sexList = useMemo(() => structuresForSex(state.sex), [state.sex]);
  const sexStructures = useMemo(() => new Map(sexList.map((item) => [item.id, item])), [sexList]);
  const rankedPoints = useMemo(() => q ? rankPoints(points, q, (p) => meridianOf(p)?.name) : [], [q]);
  const organResults = q ? matchOrgans(featuredAnatomy, q, (sid) => sexStructures.get(sid)) : featuredAnatomy;
  const structureResults = useMemo(() => q ? rankStructures(sexList, q) : [], [q, sexList]);
  const visibleStructures = structureResults.slice(0, 240);
  const exactStructures = splitExact(visibleStructures, (item) => isExactStructure(item, q));
  const exactPoints = splitExact(rankedPoints, (p) => isExactPoint(p, q));
  const pointResults = allPointResults ? exactPoints.rest : exactPoints.rest.slice(0, 6);
  const resultCount = rankedPoints.length + organResults.length + structureResults.length;
  const structureRow = (item: ReturnType<typeof structuresForSex>[number]) => (
    <button key={item.id} className="structure-item" aria-pressed={state.selection?.kind === "structure" && state.selection.ids[0] === item.id} onClick={() => pickStructure(item)}>
      <strong>{item.label || item.name}</strong><span className="structure-layer" aria-hidden="true">{layerNames[item.layer as Layer]}</span>
      <small>{item.name}{item.latin ? ` · ${item.latin}` : ""} · {item.id}{item.fmaId && item.fmaId !== item.id ? ` · ${item.fmaId}` : ""} · {item.source || "BodyParts3D 남성 참조"}</small>
      {item.hierarchy?.length ? <small className="structure-path">{item.hierarchy.join(" › ")}</small> : null}
    </button>
  );
  const pointRow = (p: Point) => (
    <button key={p.id} className={`point-item ${p.id === selected.id ? "active" : ""}`} aria-pressed={p.id === selected.id} onClick={() => select(p)}>
      <i style={{ background: meridianOf(p).color }} />
      <span><strong>{p.name} <small>{p.id}</small></strong><small className="classification-text">{meridianOf(p).shortName} · {p.region} · {categoryText(p.id)}</small></span>
    </button>
  );
  // ↓/↑ move between results; ↑ from the first result returns to the input.
  const resultKeys = (event: ReactKeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...(dockRef.current?.querySelectorAll<HTMLElement>("button") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = event.target === searchRef.current ? (event.key === "ArrowDown" ? items[0] : null) : at < 0 ? null : items[at + (event.key === "ArrowDown" ? 1 : -1)] ?? (event.key === "ArrowUp" ? searchRef.current : null);
    if (!next) return;
    event.preventDefault();
    focusWithoutOpeningSearch(next);
  };
  const layersOf = (ids: string[]) => [...new Set(ids.map((id) => structureForSexId(structures, state.sex, id)?.layer).filter(Boolean))] as Layer[];
  // Picking closes the results but keeps the query; focusing search reopens it.
  const pickStructure = (s: ReturnType<typeof structuresForSex>[number]) => {
    focusAfterPanel(".selection-card");
    setPanel((current) => current === "search" ? null : current);
    dispatch({
      type: "select", layer: s.layer as Layer, detail: detailForStructure(s),
      region: s.bodyRegion && s.bodyRegion !== "whole" ? s.bodyRegion as ViewState["anatomyRegion"] : undefined,
      selection: { kind: "structure", ids: [s.id], name: s.label || s.name, layers: [s.layer as Layer] },
    });
  };
  // A part clicked on the model is selected where it is, without re-framing:
  // a near miss beside an acupoint must not move the camera. The card's
  // "확대" frames it on request; the picture only slides aside for the card.
  const placeStructure = (s: ReturnType<typeof structuresForSex>[number]) => {
    if (state.detail && !state.detail.ids.includes(s.id)) { pickStructure(s); return; }
    focusedSelection.current = s.id;
    setPlaced(s.id);
    dispatch({ type: "pick", selection: { kind: "structure", ids: [s.id], name: s.label || s.name, layers: [s.layer as Layer] } });
    // Turn about the picked part without changing the zoom, so it can be
    // seen from every side.
    camera("pivot");
  };
  // The 3D scene receives stable callbacks that always call the latest handlers,
  // so UI-only updates never make it redraw.
  const latest = useRef({ select, placeStructure, sex: state.sex });
  latest.current = { select, placeStructure, sex: state.sex };
  const onScenePoint = useCallback((p: Point) => latest.current.select(p), []);
  const onSceneStructure = useCallback((sid: string) => {
    const item = structureForSexId(structures, latest.current.sex, sid);
    if (item) latest.current.placeStructure(item);
  }, []);

  // A peel always draws an included system; a stale view falls back to the deepest one.
  const depthName = (depth: number) => layerNames[stages[depthStage(depth, state.excluded)]?.layer ?? "nerve"];
  const soloLayer = layerKeys.filter((layer) => state.layers[layer]).length === 1 ? layerKeys.find((layer) => state.layers[layer]) : null;
  // Outside continuous peeling the heading names the mode instead of a depth.
  const depthMode = state.comparison ? "장부 비교 표시 중" : state.detail ? "기관 상세 모형" : soloLayer ? `${layerNames[soloLayer]}만 보기` : "계통 직접 조합";
  // Left-out systems stay out at every depth; the peel stops before the last one.
  const peelEnd = peelLimit(state.excluded, state.anatomyRegion);
  const peelStart = Math.min(state.dissection, peelEnd);
  const excludedNames = state.excluded.map((layer) => layerNames[layer]).join("·");
  const excludedCount = state.excluded.length ? `${state.excluded.length}개 뺌` : "";
  const depthState = state.displayMode === "dissection" ? `${state.dissection.toFixed(1)}% · ${depthName(state.dissection)}` : depthMode;
  const depthSummary = depthState + (excludedCount && ` · ${excludedCount}`);
  const keepHelpId = useId(), lastHelpId = useId(), stepsId = useId();
  const setExcluded = (layer: Layer, included: boolean) => dispatch({ type: "excluded", value: included ? state.excluded.filter((l) => l !== layer) : [...state.excluded, layer] });
  // Leaving systems out is part of the peel: each stop row carries its own
  // "○○ 포함" check while peeling (explicit views show a static swatch).
  const peeling = state.displayMode === "dissection";
  const lastKept = state.excluded.length === stages.length - 1;
  const LAST = "마지막 남은 계통은 뺄 수 없습니다";
  const toggleKept = (layer: Layer, keep: boolean) => {
    if (!keep && lastKept && !state.excluded.includes(layer)) { announce({ text: LAST, reason: true, layer }); return; }
    const next = keep ? state.excluded.filter((l) => l !== layer) : [...state.excluded, layer];
    setExcluded(layer, keep);
    const limit = peelLimit(next, state.anatomyRegion);
    announce({ text: `${layerNames[layer]} ${keep ? "다시 넣음" : "뺌"}${limit < 100 ? ` · ${limit}%까지` : ""}`, reason: false });
  };
  // The bands keep the three roles in view; the last-system rule takes the line while it applies.
  const legend = <><span>포함: 넣고 빼기</span><span>이름: 여기까지 박리</span><span>눈: 이것만 보기</span></>;
  const hint = keepNote.reason ? keepNote.text : peeling ? (lastKept ? LAST : legend) : "이름: 그 계통까지 박리 · 눈: 그 계통만 보기";
  // A stop or eye run from a band closes it and hands focus back to its toggle.
  const leaveBand = () => {
    if (popover !== "depth") return;
    setPopover(null);
    requestAnimationFrame(() => popoverTrigger.current?.focus({ preventScroll: true }));
  };
  // The entry removes itself when the peel starts, so focus moves to the slider.
  const peelEntry = (className: string) => <button className={className} aria-label={`현재 기준 ${peelStart.toFixed(1)}%에서 연속 박리 시작`}
    onClick={() => { dispatch({ type: "dissection", value: state.dissection }); requestAnimationFrame(() => depthSlider.current?.focus({ preventScroll: true })); }}>{peelStart.toFixed(1)}%에서 연속 박리</button>;
  // Female markers are unreviewed approximations, hidden until asked for.
  const femaleHidden = state.sex === "female" && !state.femaleMarkers;
  const markerCount = femaleHidden || state.detail ? 0 : markers.length;
  const statusText = !enabledLayers.length ? "레이어를 켜서 구조를 표시하세요"
    : ready ? "해부 모델 로드 완료"
    : loadedLayers.length ? `표시 중 · 내부 계통 불러오는 중 ${loadedLayers.length}/${enabledLayers.length}` : "해부 모델 준비 중";
  const closeButton = <button className="ax-icon ax-close" aria-label="도구 패널 닫기" data-tip="닫기" onClick={closePanel}><X size={18} /></button>;
  // While a tool panel covers the comparison card, its limits stay in view (Q25).
  const carriedComparison = Boolean(state.comparison && state.sex === "female" && state.selection?.ids.some((sid) => sid.startsWith("FT_")));
  const comparisonLine = state.comparison ? <p className="panel-comparison-note">
    {comparisonPoint?.name || state.comparison.pointId} · {state.comparison.name} 비교 — 전통적 대응, 압력 경로 아님{carriedComparison && " · 남성 원본을 여성 골격·피부 대응으로 옮긴 보완 구조"}
  </p> : null;
  const steps = (
          <ol className="depth-steps" id={stepsId} aria-label="계통 단계">
            {/* Landscape: the comparison notice tops the band; otherwise a reason does. */}
            {shortLandscape && (comparisonLine || keepNote.reason) && <li className="depth-steps-note">{comparisonLine ?? <p className="depth-band-hint" aria-hidden="true">{keepNote.text}</p>}</li>}
            {stages.map((stage, index) => {
              const layer = stage.layer, name = layerNames[layer];
              const left = state.excluded.includes(layer);
              // Outside the peel a drawn system (an eye view) shows as current, not as left out.
              const shownLeft = left && !(!peeling && state.layers[layer]);
              const locked = lastKept && !left;
              const peeled = peeling && index < state.stage;
              const current = peeling ? index === state.stage : soloLayer === layer;
              // Proportional to the real depth, but pushed up so neighbouring
              // systems never share a pointer target (the ticks keep the true depth).
              const top = `max(calc(var(--thumb) / 2), min(${stageDepth.slice(index).map((depth, offset) => `calc(var(--thumb) / 2 + (100% - var(--thumb)) * ${depth / 100} - ${offset} * var(--stop-gap))`).join(", ")}))`;
              const stopTip = left ? `${name} 뺌 · ${peeling ? "왼쪽 ‘포함’으로 다시 넣기" : "연속 박리에서 다시 넣기"}` : `${name}까지 박리 · ${stageDepth[index]}%`;
              return (
                <li key={layer} style={{ ["--at-f" as string]: stageDepth[index] / 100, ["--stop-top" as string]: top }} className={current ? "active" : shownLeft ? "excluded" : peeled ? "peeled" : undefined}>
                  {peeling
                    ? <label className="ax-keep" data-tip-side="right" data-tip={locked ? LAST : left ? `${name} 다시 넣기` : `${name} 빼기 · 어느 깊이에서도 그리지 않음`}>
                      <input type="checkbox" className={`ax-keep-input ax-swatch ${layer}`} aria-label={`${name} 포함`} checked={!left}
                        aria-disabled={locked || undefined} aria-describedby={locked ? `${keepHelpId} ${lastHelpId}` : keepHelpId}
                        onChange={(event) => toggleKept(layer, event.target.checked)} />
                    </label>
                    : <span className="ax-keep is-static" aria-hidden="true"><i className={`ax-swatch ${layer}`} /></span>}
                  <button className="ax-stop" aria-disabled={left || undefined} onClick={() => { if (left) { announce({ text: stopTip, reason: true, layer }); return; } dispatch({ type: "dissection", value: stageDepth[index] }); leaveBand(); }} aria-label={left ? `${name} 뺌 — 박리에서 뺀 계통` : `${name}까지 박리`} data-tip={stopTip} data-tip-side="right">
                    <span className="ax-stop-name">{name}</span>{shownLeft && <span className="ax-stop-left">뺌</span>}
                  </button>
                  <button className="ax-solo" aria-label={`${name}만 보기`} data-tip={`${name}만 보기`} data-tip-side="right" aria-pressed={!peeling && soloLayer === layer} onClick={() => { dispatch({ type: "stage", index }); leaveBand(); }}><Eye size={13} /></button>
                  {/* Rails: a reason opens beside the row it is about (touch has no tooltips). */}
                  {!phone && !shortLandscape && keepNote.reason && keepNote.layer === layer && <span className="ax-row-note" aria-hidden="true">{keepNote.text}</span>}
                </li>
              );
            })}
            {shortLandscape && (peeling
              ? <li className="depth-steps-aside" aria-hidden="true"><p>{peeling && lastKept ? LAST : legend}</p></li>
              : <li className="depth-steps-aside">{peelEntry("peel-entry")}</li>)}
          </ol>
  );

  return (
    <main
      className="ax"
      ref={workspaceRef}
      aria-label="인체 구조 탐색"
      data-panel={panel || "none"}
      data-popover={popover || "none"}
      data-present={presenting}
      data-detail={Boolean(state.detail)}
      data-lung-part={selectedLungPart}
      data-selection={Boolean(state.selection)}
      data-point={hasSelected}
      onKeyDownCapture={(event) => {
        if (!(event.target instanceof HTMLCanvasElement) || !event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const step = event.shiftKey ? 5 : .5;
        shiftDissection(event.key === "ArrowDown" ? step : -step);
      }}
    >
      <section className="viewer-panel ax-viewer" aria-label="3D 해부도">
        <Suspense fallback={<div className="viewer-fallback"><LoaderCircle className="spin" />3D 뷰어 불러오는 중</div>}>
          <Atlas
            points={markers}
            selected={selected}
            onSelect={onScenePoint}
            layers={state.layers}
            opacity={state.alpha.skin}
            labels={state.labels}
            action={action}
            onReady={onReady}
            onLoading={setLoadingReference}
            selectedStructure={state.selection?.kind === "structure" ? state.selection.ids[0] : ""}
            onStructure={onSceneStructure}
            isolated={state.isolated}
            highlight={state.comparison?.ids ?? NONE}
            cutaway={state.cutaway}
            dissection={state.dissection}
            displayMode={state.displayMode}
            layerOpacity={state.alpha}
            contextDimmed={contextIsDimmed(state)}
            selectionIds={state.selection?.ids ?? NONE}
            detailIds={state.detail?.ids ?? NONE}
            selectionTarget={state.selectionTarget}
            initialPose={state.camera}
            onPose={onPose}
            sex={state.sex}
            anatomyRegion={state.anatomyRegion}
            connective={state.connective}
            connectiveCategory={connectiveBundle}
            modesty={state.modesty}
            excluded={state.excluded}
            femaleMarkers={state.femaleMarkers}
            glideFraming={placed !== "" && (!selectionKey || selectionKey === placed)}
          />
        </Suspense>
      </section>

      <div className="ax-top">
        <div className="ax-search" role="search">
          <Search size={17} aria-hidden="true" />
          <input
            ref={searchRef}
            aria-label="경혈·구조 검색"
            placeholder={phone ? "검색" : "경혈 · 구조 · 기관 검색"}
            value={search}
            onFocus={(e) => { if (!skipSearchFocus.current && panel !== "search") { triggerRef.current = e.currentTarget; setPanel("search"); } }}
            onClick={(e) => { if (panel !== "search") triggerRef.current = e.currentTarget; setPanel("search"); }}
            onChange={(e) => { setSearch(e.target.value); setPanel("search"); }}
            onKeyDown={(e) => { if (panel === "search") resultKeys(e); }}
          />
          {panel === "search" ? <button className="ax-icon" aria-label="도구 패널 닫기" data-tip="닫기" onClick={() => { setSearch(""); closePanel(); }}><X size={16} /></button> : <kbd aria-hidden="true">/</kbd>}
        </div>
        <div className="ax-top-actions">
          <div className="ax-segment" role="group" aria-label="인체 성별 기준">
            <button aria-pressed={state.sex === "male"} onClick={() => dispatch({ type: "sex", value: "male" })}>남성</button>
            <button aria-pressed={state.sex === "female"} onClick={() => dispatch({ type: "sex", value: "female" })}>여성</button>
          </div>
          <button className="ax-icon" aria-label="성기 가리기" data-tip={state.modesty ? "성기 보이기" : "성기 가리기"} aria-pressed={state.modesty} onClick={() => dispatch({ type: "modesty", value: !state.modesty })}><ShieldCheck size={18} /></button>
          <button className="ax-icon" aria-label="표시 설정" data-tip="표시 설정" aria-expanded={panel === "display"} onClick={(e) => openPanel("display", e.currentTarget)}><SlidersHorizontal size={18} /></button>
          <button className="ax-icon" aria-label="도움말" data-tip="도움말" aria-expanded={panel === "help"} onClick={(e) => openPanel("help", e.currentTarget)}><CircleHelp size={18} /></button>
          {!phone && <button className="ax-text-button" onClick={(e) => startPresenting(e.currentTarget)}>발표 보기</button>}
        </div>
        {presenting && <button className="ax-present-exit" onClick={stopPresenting}>발표 종료</button>}
      </div>

      {panel === "search" && (
        <div className="ax-panel ax-results" role="region" aria-label="검색 결과" ref={dockRef} onKeyDown={resultKeys}>
          {comparisonLine}
          {!q && <>
            <p className="ax-hint">경혈 코드·이름(ST36, 족삼리, zusanli), 구조의 한국어·영어·FMA(위, stomach, FMA7148)로 찾습니다.</p>
            <h3 className="ax-group-title">기관 상세 <small>{featuredAnatomy.length}</small></h3>
          </>}
          {q && <p className="ax-hint" aria-live="polite">{resultCount ? `경혈 ${rankedPoints.length} · 기관 상세 ${organResults.length} · 구조 ${structureResults.length.toLocaleString()}` : "일치하는 경혈·구조가 없습니다. 다른 이름이나 코드를 입력하세요."}</p>}
          {(exactStructures.exact.length > 0 || exactPoints.exact.length > 0) && (
            <section className="ax-exact-results">
              <h3 className="ax-group-title">정확히 일치</h3>
              {exactStructures.exact.map(structureRow)}
              {exactPoints.exact.map(pointRow)}
            </section>
          )}
          {organResults.length > 0 && (
            <div className="featured-anatomy">
              {q && <h3 className="ax-group-title">기관 상세 <small>{organResults.length}</small></h3>}
              {organResults.map((item) => (
                <button key={item.name} onClick={() => selectFeatured(item)}>
                  <strong>{item.name}</strong><small>{item.detail}</small>
                </button>
              ))}
            </div>
          )}
          {!q && <button className="all-anatomy-button" onClick={showAllSystems}>전체 인체 구조 보기 <small>7개 계통 · {structuresForSex(state.sex).filter((s) => !s.detailOnly).length.toLocaleString()}개 구조</small></button>}
          {pointResults.length > 0 && (
            <section className="ax-point-results">
              <h3 className="ax-group-title">경혈 <small>{exactPoints.rest.length}</small></h3>
              {pointResults.map(pointRow)}
              {exactPoints.rest.length > pointResults.length && <button className="ax-more" onClick={() => setAllPointResults(true)}>경혈 {exactPoints.rest.length}개 모두 보기</button>}
            </section>
          )}
          {q && exactStructures.rest.length > 0 && (
            <section className="structure-browser">
              <h3 className="ax-group-title">구조 <small>{structureResults.length.toLocaleString()}{structureResults.length > visibleStructures.length ? ` · 상위 ${visibleStructures.length}개 표시` : ""}</small></h3>
              {exactStructures.rest.map(structureRow)}
            </section>
          )}
          {q && state.selection && <button className="structure-focus" onClick={() => { setPanel(null); camera("structure"); }}>선택 구조 확대</button>}
        </div>
      )}

      {panel === "display" && (
        <div className="ax-panel ax-side-panel" role="region" aria-label="표시 설정" ref={dockRef}>
          <div className="ax-panel-head"><strong>표시 설정</strong>{closeButton}</div>
          {comparisonLine}
          {phone && <button className="ax-text-button ax-present-entry" onClick={(e) => startPresenting(e.currentTarget)}>발표 보기 <small>도구를 접고 모델·선택 정보만 표시</small></button>}
          <AnatomyControls state={state} dispatch={dispatch} onDone={() => setPanel(null)} />
        </div>
      )}

      {panel === "help" && (
        <div className="ax-panel ax-side-panel" role="region" aria-label="도움말" ref={dockRef}>
          <div className="ax-panel-head"><strong>도움말</strong>{closeButton}</div>
          {comparisonLine}
          <div className="viewer-help">
            <table className="help-table">
              <thead><tr><th scope="col">하려는 일</th><th scope="col">마우스·키보드</th><th scope="col">터치</th></tr></thead>
              <tbody>
                <tr><th scope="row">경혈 찾기</th><td>검색(/ 키), 경맥 선택, 경혈 찾기 목록, 표식 클릭</td><td>검색, 아래 경혈 도구, 표식 누르기</td></tr>
                <tr><th scope="row">차례로 보기</th><td colSpan={2}>경혈 칩의 이전·다음 — 현재 경맥·필터 결과 순서</td></tr>
                <tr><th scope="row">돌리기·확대</th><td>드래그로 회전, 휠로 확대·축소, 정면·후면·측면</td><td>한 손가락 회전, 두 손가락 확대, 오른쪽 +·−·시점</td></tr>
                <tr><th scope="row">이동</th><td>모델을 클릭한 뒤 W/S 전진·후진, A/D 좌우, Q/E 아래·위, Shift는 빠르게</td><td>시점 안의 이동 버튼</td></tr>
                <tr><th scope="row">겉에서 속으로</th><td>깊이 막대 끌기·계통 이름 누르기, Alt/Option+휠 또는 모델에 초점을 둔 채 Alt/Option+↑/↓</td><td>아래 깊이 줄, 단계 버튼에서 계통 고르기</td></tr>
                <tr><th scope="row">한 계통만</th><td>계통 옆 눈 버튼</td><td>단계 버튼 → 눈 버튼</td></tr>
                <tr><th scope="row">계통 빼고 박리</th><td>깊이 막대 계통 행 왼쪽 ‘포함’ 체크 끄기(다시 체크하면 넣기)</td><td>단계 버튼 → 계통의 ‘포함’ 체크 끄기</td></tr>
                <tr><th scope="row">장부 비교</th><td colSpan={2}>경혈 상세의 ‘대응 장부의 해부 구조 비교’</td></tr>
                <tr><th scope="row">성기 보이기</th><td colSpan={2}>기본으로 가려 둡니다 — 위쪽 방패 버튼이나 표시 설정의 ‘성기 가리기’ 끄기</td></tr>
              </tbody>
            </table>
            <h3>알아둘 점</h3>
            <p>처음에는 모든 계통이 몸 안에 함께 있고, 피부 → 근육(개별 근육 순서) → 골격 → 장기(그물막·장, 생식기관을 덮는 복막, 나머지 장기 순서) → 혈관 → 림프 순서로 사라지며 신경이 남습니다. 깊이 막대에서 ‘포함’ 체크를 끈 계통은 깊이와 관계없이 그리지 않고(예: 장기를 빼고 근육만 박리), 박리는 남긴 가장 안쪽 계통이 사라지기 전에 멈춥니다. 보이지 않는 뒷면의 표식은 몸을 돌리면 나타납니다.</p>
            <p>박리 백분율은 실제 조직 깊이가 아닌 교육용 표시 순서입니다. 가슴·복벽·엉덩이·종아리의 확인된 근육 관계는 표층부터 제거하며, 그 밖의 근육 순서는 기하학적 추정이므로 전체 해부 층서가 검증된 것은 아닙니다.</p>
            <p>표식은 체표 기준의 학습용 근사입니다. 장부 대응은 전통적 분류이며 압력 전달 경로가 아닙니다.</p>
            <p>{stageDescription(state.stage, state.sex)}</p>
            <a href="#wiki/layer-guide">전체 탐색 가이드 ↗</a>
            <a href="#wiki/massage-anatomy">마사지 해부학 참고 ↗</a>
            <a href="#wiki/licenses">모델 출처·라이선스 ↗</a>
          </div>
        </div>
      )}

      {panel === "points" && (
        <div className="ax-panel ax-side-panel ax-point-list" role="region" aria-label="경혈 목록" ref={dockRef}>
          <div className="ax-panel-head"><strong>경혈 목록 <small>{found.length}/{points.length}</small></strong>{closeButton}</div>
          {comparisonLine}
          <div className="ax-list-search">
            <input aria-label="경혈 검색" placeholder="이름·코드·해부 구조로 찾기" value={query} onChange={(e) => setFilter({ query: e.target.value })} />
            <button className="ax-ghost" aria-pressed={onlySaved} onClick={() => setFilter({ onlySaved: !onlySaved })}><Bookmark size={12} />저장 {saved.length}</button>
          </div>
          <details className="ax-filters" open={filtersOpen} onToggle={(e) => setFiltersOpen(e.currentTarget.open)}>
            <summary>필터 <small>{activeFilters || "분류 · 부위 · 경맥 · 수록 범위"}</small></summary>
            <div className="ax-filter-grid">
              <label className="ax-field">경혈 분류<select aria-label="경혈 분류" value={concept} onChange={(e) => setFilter({ concept: e.target.value })}>
                <option value="all">전체 분류</option>
                {concepts.map((c) => <option key={c.id} value={c.id}>{c.name} · {points.filter((p) => pointConcepts[p.id]?.categories.includes(c.id)).length}/{c.expectedTotal}</option>)}
              </select></label>
              <label className="ax-field">모델에서 볼 부위<select aria-label="모델 부위 선택" value={bodyRegion} onChange={(e) => { dispatch({ type: "region-filter", value: e.target.value }); camera("region"); }}>
                <option value="전체">전체 부위</option>
                {[...new Set(points.map((p) => p.bodyRegion))].map((r) => <option key={r} value={r}>{r} · {points.filter((p) => p.bodyRegion === r).length}</option>)}
              </select></label>
              <label className="ax-field">경맥<select aria-label="경맥 선택" value={meridian} onChange={(e) => setFilter({ meridian: e.target.value })}>
                <option value="all">14경맥 + 경외기혈</option>
                {meridians.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.id})</option>)}
              </select></label>
              <label className="ax-field">수록 범위<select aria-label="수록 범위" value={catalogue} onChange={(e) => setFilter({ catalogue: e.target.value })}>
                <option value="all">전체 409개</option><option value="classical">정규 경혈 361개</option><option value="extra">경외기혈 48개</option>
              </select></label>
            </div>
            <div className="ax-chips" role="group" aria-label="신체 부위">
              {["전체", "머리·목", "몸통", "팔·손", "다리·발"].map((r) => <button key={r} aria-pressed={region === r} onClick={() => setFilter({ region: r })}>{r}</button>)}
            </div>
            {concept !== "all" && <p className="ax-hint">{concepts.find((c) => c.id === concept)?.description}</p>}
            <div className="ax-row">
              <button className="ax-ghost" onClick={resetFilters}><RotateCcw size={13} />초기화</button>
              <p className="coverage-note">14개 경맥 · 경혈 {points.length}개 · 정규 361경혈 + 표준 경외기혈 48개</p>
            </div>
          </details>
          {/* Applying the results to the model matters only when they differ from what is shown. */}
          {(found.length !== points.length || state.markers !== "filtered" || state.selection) && (
            <button className="show-filtered-button ax-primary" disabled={!found.length} onClick={() => { dispatch({ type: "show-filtered" }); camera("region"); setPanel(null); }}>필터 결과 {found.length}개를 모델에서 보기</button>
          )}
          <div className="point-list">
            {found.map((p) => (
              <button key={p.id} className={`point-item ${p.id === selected.id ? "active" : ""}`} onClick={() => select(p)} aria-pressed={p.id === selected.id}>
                <i style={{ background: meridianOf(p).color }} />
                <span><strong>{p.name} <small>{p.id}</small></strong><small className="classification-text">{meridianOf(p).shortName} · {p.region} · {categoryText(p.id)}</small></span>
                {saved.includes(p.id) && <Bookmark size={13} />}
              </button>
            ))}
            {!found.length && <div className="empty-state"><strong>{onlySaved ? "저장한 경혈이 없습니다" : "일치하는 경혈이 없습니다"}</strong><button onClick={resetFilters}>전체 경혈 보기</button></div>}
          </div>
        </div>
      )}

      <nav className="depth-explorer ax-depth" aria-label="인체 깊이 탐색" data-mode={state.displayMode} data-open={popover === "depth"} data-compare={Boolean(state.comparison)} data-popover-root>
        <select className="ax-select ax-region" aria-label="전신 부위 선택" value={state.anatomyRegion} onChange={(e) => {
          const value = e.target.value as ViewState["anatomyRegion"];
          dispatch({ type: "anatomy-region", value });
          requestAnimationFrame(() => camera(value === "whole" ? "fit" : "anatomy-region"));
        }}>{Object.entries(anatomyRegionNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
        <button className="depth-toggle" aria-expanded={popover === "depth"} aria-controls={stepsId} aria-label={`깊이 단계 선택: ${depthSummary}`} onClick={(e) => togglePopover("depth", e.currentTarget)}>
          <span className="depth-toggle-text">{depthState}</span>{excludedCount && <small className="depth-toggle-count">{excludedCount}</small>}<ChevronDown size={14} />
        </button>
        <div className="depth-band">
          <div className="depth-heading">
            {peeling
              ? <strong aria-live="polite">{state.dissection.toFixed(1)}%<small>{depthName(state.dissection)}</small></strong>
              : <>
                <strong className="depth-mode">{depthMode}</strong>
                {peelEntry("peel-entry")}
              </>}
            {peeling && state.excluded.length > 0 && <small className="depth-excluded">
              <span>{state.excluded.length > 3 ? `${state.excluded.length}개 계통` : excludedNames} 뺌</span>{peelEnd < 100 && <span>{peelEnd}%까지</span>}
            </small>}
          </div>
          {peeling && !state.excluded.length && <small className="depth-keep-hint" aria-hidden="true">체크를 끄면 박리에서 뺍니다</small>}
          {/* Rails: the three columns of every stop row, named once above them. */}
          {peeling && <div className="depth-cols" aria-hidden="true"><span>포함</span><span>박리</span><span>만 보기</span></div>}
          {/* Only the phone band covers the comparison card; the wide rail never does. */}
          {phone && comparisonLine ? comparisonLine : <p className="depth-band-hint" aria-hidden="true">{hint}</p>}
        </div>
        <div className="ax-depth-track" style={{ ["--fill" as string]: `${state.dissection}%`, ["--limit" as string]: `${peelEnd}%` }}>
          <input
            ref={depthSlider}
            type="range" min="0" max="100" step="0.5"
            value={state.dissection}
            aria-label="연속 해부 박리 깊이"
            aria-valuetext={(peeling ? `${state.dissection.toFixed(1)}% 해부 깊이 · ${depthName(state.dissection)}` : `계통별 보기 중 · 박리 시작 기준 ${peelStart.toFixed(1)}%`) + (state.excluded.length ? ` · ${excludedNames} 뺌, ${peelEnd}%까지` : "")}
            onChange={(event) => dispatch({ type: "dissection", value: Number(event.target.value) })}
          />
          <span className="depth-ticks" aria-hidden="true">{stageDepth.map((depth, index) => <i key={index} style={{ ["--at-f" as string]: depth / 100 }} />)}</span>
          {!shortLandscape && steps}
        </div>
        {shortLandscape && steps}
        <span id={keepHelpId} hidden>체크를 끄면 그 계통은 박리 깊이와 관계없이 그리지 않습니다</span>
        <span id={lastHelpId} hidden>{LAST}</span>
        <p className="depth-status ax-vh" role="status">{keepNote.text}</p>
      </nav>

      <aside className="ax-inspector" aria-label="선택 정보">
        {notice && <p className="ax-link-notice ax-card" role="status">{notice} <button type="button" onClick={onNotice}>닫기</button></p>}
        <div className="floating-point ax-point-chip">
          <button className="ax-step" aria-label="이전 경혈" aria-disabled={!prevPoint} data-tip={stepTip(prevPoint, "첫 경혈입니다")} onClick={() => step(prevPoint)}>이전</button>
          {hasSelected ? <>
            <button className="point-summary" aria-expanded={panel === "detail"} onClick={(e) => openPanel("detail", e.currentTarget)}>
              <i style={{ background: meridianOf(selected).color }} />
              <span>{selected.id}</span>
              <strong>{selected.name}</strong>
              <small>{categoryText(selected.id)}</small>
              <ChevronDown size={15} />
            </button>
            <button className="ax-icon" aria-label="선택 경혈 확대" data-tip="선택 경혈 확대" onClick={() => camera("focus")}><Focus size={17} /></button>
          </> : (
            <button className="ax-point-empty" aria-label="경혈 선택 — 표식을 누르거나 목록에서 고르기" onClick={(e) => openPanel("points", e.currentTarget)}>
              <span className="ax-dot" />경혈 선택<small>표식을 누르거나 목록에서</small>
            </button>
          )}
          <button className="ax-step" aria-label="다음 경혈" aria-disabled={!nextPoint} data-tip={stepTip(nextPoint, "마지막 경혈입니다")} onClick={() => step(nextPoint)}>다음</button>
        </div>
        {panel === "detail" && hasSelected && (
          <PointDetail
            point={selected}
            onFocus={() => { setPanel(null); camera("focus"); }}
            saved={saved.includes(selected.id)}
            onSave={() => toggle(selected.id)}
            onCompare={compare}
            onClose={closePanel}
            femaleNote={state.sex === "female" && state.femaleMarkers ? femaleMarkerNote(selected.id) : undefined}
            modestyNote={state.sex === "male" && state.modesty && MODEST_MOVED_POINTS.includes(selected.id)
              ? "성기 가리기 중 · 사타구니를 닫아 그린 면(편집 표시 면) 앞쪽에 옮겨 그린 표식입니다. 원래 표식은 넓적다리 안쪽 면에 있고, 성기 가리기를 끄면 그 자리로 돌아갑니다."
              : undefined}
            comparisonFeedback={comparisonNotice ? <>
              <p>{comparisonNotice}</p>
              {separateDetailIds.length > 0 && <p>전신에 합쳐지지 않은 별도 여성 CT 자료는 아래에서 열 수 있습니다. 경혈 위치와 겹쳐 표시하지 않습니다.</p>}
              {featuredAnatomy.filter((group) => separateDetailIds.includes(group.id)).map((group) => <button key={group.id} onClick={() => {
                setComparisonNotice(""); setSeparateDetailIds([]); selectFeatured(group);
              }}>{group.name} 별도 상세 보기</button>)}
            </> : undefined}
          />
        )}
        {state.selection && (
          <section className="selection-card ax-card" tabIndex={-1} data-detail={Boolean(state.detail)} data-selection="true" data-lung-part={selectedLungPart} aria-label="선택 구조 조작">
            <div key={selectionKey}>
              <span className={`selection-kind ${state.selection.kind}`}>
                {state.comparison ? "전통 장부 비교" : state.detail ? `${state.detail.name} · ${selectedComposite ? "구조" : "기관"} 상세 모델` : state.selection.kind === "bundle" ? "구조 묶음" : "선택 구조"}
                {selectedKind && ` · ${connectiveKindNames[selectedKind]}`}
              </span>
              <strong>{state.selection.name} <small>{state.selection.ids.length}개 구조</small></strong>
              {movementOrigin && <a className="movement-return" href={movementOrigin.href}>← 동작 역학으로 돌아가기 <small>{movementOrigin.label}</small></a>}
              {/* The comparison's limits come first, right under its name (Q25). */}
              {state.comparison && <p className="comparison-note">{comparisonPoint?.name || state.comparison.pointId} · {state.comparison.name} 비교 — 전통적 대응, 압력 경로 아님</p>}
              {selectedAnatomy && <small className="selection-identity">{selectedAnatomy.name}{selectedAnatomy.fmaId && selectedAnatomy.fmaId !== selectedAnatomy.id ? ` · ${selectedAnatomy.fmaId}` : ""} · {selectedAnatomy.id} · {layerNames[selectedAnatomy.layer as Layer]}</small>}
              <span className="scene-legend">
                {state.selection.kind === "structure" && <span><i className="legend-selected" />선택 구조</span>}
                {state.comparison && <span><i className="legend-compare" />전통 장부 대응</span>}
                {hasSelected && selected.structures.length > 0 && <span><i className="legend-reference" />경혈 참조</span>}
              </span>
              {carriedComparison && <p className="selection-description" data-carried-comparison>남성 원본을 여성 골격·피부 대응으로 옮긴 보완 구조로, 여성 고유 형상이 아닙니다.{comparisonDetailIds.length > 0 && " 여성 CT 자료는 아래 별도 상세에서 따로 봅니다."}</p>}
              {!state.comparison && state.sex === "female" && state.selection.kind === "bundle" && state.selection.ids.every((id) => id.startsWith("FT_")) && <p className="selection-description" data-carried-bundle>{FEMALE_TRANSPORT_NOTE}</p>}
              {state.sex === "male" && sourceKey === "male-detail" && selectedGroup === "stomach" && <p className="selection-description" data-stomach-frame-warning>별도 4.0 상세 원본입니다. 전신 3.0 위와 상자 중심이 약 42mm 달라 같은 위치로 정합된 화면이 아닙니다.</p>}
              {selectedAnatomy?.description && sourceKey !== "female-detail" && <p className="selection-description">{selectedAnatomy.description}</p>}
              {selectedAnatomy?.id.startsWith("VHF") && <p className="selection-description" data-donor-muscle-note>별도 Visible Human Female 기증자 다리 근육입니다. 전신 정합이 끝나지 않아 개요에서는 숨기고, 개요의 다리 근육은 남성 원본을 여성 몸에 맞춰 옮긴 보완으로 보여 줍니다.</p>}
              {connectiveBundle && <p className="selection-description">{state.sex === "male"
                ? "원본에 따로 모델링된 인대·관절 구조(연청색)와 힘줄·힘줄집(진주색)만 모았습니다. 대부분의 힘줄은 근육 모형에 포함되어 있어 이 묶음에 없습니다. 인대는 두 원본이 공유하는 골격에 맞춘 전신 보정만 적용했으며 구조별 정합은 하지 않았습니다."
                : "여성 원본의 무릎 인대·반달연골·넙다리네갈래근 힘줄과, 남성 원본에 따로 모델링된 관절 인대·힘줄을 여성 골격·피부 대응으로 옮긴 보완을 모았습니다. 인대·관절 구조는 연청색, 힘줄 계열은 진주색입니다. 옮긴 구조는 여성 고유 형상이 아닙니다."}</p>}
              {selectedAnatomy?.latin && <small className="selection-latin">TA2 · {selectedAnatomy.latin}</small>}
              {selectedAnatomy?.source && sourceKey !== "female-detail" && <small className="selection-source">{selectedAnatomy.source} · 학습용 비진단 모델</small>}
              {selectedComposite && <details className="anatomy-source-details" data-composite-provenance>
                <summary>{selectedComposite.sourceSummary}</summary>
                <p className="selection-description">{selectedComposite.description}</p>
              </details>}
              {state.sex === "male" && maleLungViews.some((view) => view.id === selectedGroup) && <details className="anatomy-source-details" data-lung-provenance>
                <summary>{fullLungDetail ? "폐 자료·원본 묶음 구분" : "폐 보기 변경·원본 구분"}</summary>
                <p className="selection-description">BodyParts3D 4.3 공식 원본입니다. 기본 보기는 2014 표기 원본의 폐실질 18조각과 혈관·기관지 267조각입니다. 이전 세부 가지 278조각은 2011–2012 표기 원본으로, 겹치는 대체 형상과 일부 위치 차이가 있어 별도로 표시합니다. 연도는 원본 묶음명 기준입니다. 공식 목록에서 제외된 이전 혈관 2조각은 수록하지 않습니다. 미세 구조 전체나 임상적 위치 검증을 뜻하지 않습니다.</p>
                {!fullLungDetail && <div className="selection-actions">{lungViewOptions}</div>}
              </details>}
              {state.sex === "male" && malePancreasViews.some((view) => view.id === selectedGroup) && <details className="anatomy-source-details" data-pancreas-provenance>
                <summary>췌장 원본·대체 표현</summary>
                <p className="selection-description">BodyParts3D 4.0의 췌장 전체 형상·췌장관과 실질·관 가지는 같은 공식 췌장 관계에 수록된 별도 표현입니다. 전체 형상과 실질의 공간 범위가 크게 겹쳐 두 보기를 동시에 표시하지 않습니다. 원본 자세·좌표를 유지하며 췌장의 세포·미세 관 전체나 다른 전신 기관과의 위치 정합을 검증한 것은 아닙니다.</p>
                {!fullPancreasDetail && <div className="selection-actions">{pancreasViewOptions}</div>}
              </details>}
              {state.sex === "male" && maleKidneyViews.some((view) => view.id === selectedGroup) && <details className="anatomy-source-details" data-kidney-provenance>
                <summary>콩팥 세부 보기·출처 한계</summary>
                <p className="selection-description">BodyParts3D 4.0의 좌우 콩팥·요관 4개와 신장동맥·가지 27개, 신정맥 4개를 같은 원본 좌표계에서 별도 선택합니다. 좌우 확대 보기는 해당 측 콩팥·혈관만 프레이밍하며, 긴 요관은 양쪽 전체 보기에서 선택할 수 있습니다. 피질·속질·네프론은 이 상세에 없고, 일부 동맥 가지에는 원본의 간격이 남습니다. 혈관 분절의 완전 연결이나 기존 전신/다른 출처 기관과의 해부 위치는 검증되지 않았습니다. 한국어 이름은 편집 표기이며 원문명과 FMA ID는 유지합니다.</p>
                {!fullKidneyDetail && <div className="selection-actions">{kidneyViewOptions}</div>}
              </details>}
              {state.sex === "male" && sourceKey === "male-detail" && selectedGroup === "stomach" && <details className="anatomy-source-details" data-stomach-provenance>
                <summary>위·혈관 상세 출처와 한계</summary>
                <p className="selection-description">BodyParts3D 4.0의 위 1개, 좌우 위동맥·위정맥 4개와 위그물막동맥·정맥 4개를 같은 원본 좌표계에서 별도 선택합니다. 이 9개는 각각의 공식 개념에 대응하며 공식 ‘위의 9개 하위 부품’ 관계는 아닙니다. 위벽 층은 분할되지 않았고 혈관의 연결·관류나 기존 3.0 전신과의 국소 정합은 검증되지 않았습니다. 한국어 이름은 편집 표기이며 원문명·FMA ID를 유지합니다.</p>
              </details>}
              {reproductiveScope && <details className="anatomy-source-details" data-reproductive-provenance>
                <summary>생식기관 보기·출처 한계</summary>
                <p className="selection-description">Visible Human 여성 자료를 바탕으로 만든 HRA 참조 기관입니다. 자궁·자궁관·난소는 장과 넓은인대 등 복막 뒤에 있어, 전신 연속 박리에서는 장기 단계를 조금 더 지나(약 79%) 드러납니다. 장기만 남긴 박리(76%에서 멈춤)와 ‘장기만 보기’에서는 장이 남아 가리므로 이 상세에서 보세요. 난소는 남성 원본을 옮긴 골반 벽 혈관에 일부 가립니다. 외부생식기와 그 근육(망울해면체근 등)·여성 요도·난소 혈관은 두 원본 모두에 없어 만들지 않았고, 옮긴 골반 벽 혈관·근육은 이 기관들과 겹칠 수 있습니다. 한국어 이름은 편집 표기이며 원문명·ID를 유지합니다.</p>
              </details>}
              {breastScope && <details className="anatomy-source-details" data-breast-provenance>
                <summary>유방 보기·출처 한계</summary>
                <p className="selection-description">HRA 유방은 기증자 조직을 분할한 것이 아니라 문헌을 바탕으로 조형한 참조 모형입니다. 젖샘관팽대도 그 참조 표현이며, 수유 중 초음파 연구에서는 전형적인 팽대가 관찰되지 않았습니다(Ramsay 등 2005). 젖샘엽·젖샘관은 지방 속에 있어 ‘젖샘엽·젖샘관 보기’에서 드러나고, 전신에서는 장기와 함께 표시합니다(원본 분류는 피부계통). 유방 아래 가슴벽 근육은 남성 원본을 옮긴 보완이라 유방 조직과 겹칠 수 있습니다.</p>
              </details>}
              {state.sex === "female" && selectedOrgan?.id === "brain" && <div data-brain-provenance>
                <p className="selection-description">뇌 묶음: Allen 참조 282개 + Visible Human 시신경교차 1개 · 머리뼈 안에 맞춤 · 차용 머리뼈와 뇌 모형 26개 표면 교차 · 위치 검증 미완료</p>
                <details className="anatomy-source-details"><summary>뇌 출처·방향 주의</summary>
                  <p className="selection-description">282개는 Allen 참조 구조를 대칭 복제하고 여성 신체에 맞춰 크기를 조정한 모델로, 여성 기증자 뇌 스캔이 아닙니다. 시신경교차 1개는 Visible Human 여성 자료로 그대로 유지합니다. Allen 원본의 좌우 표기가 전신의 눈·대퇴골 기준과 반대여서, 원문 이름·ID는 유지하고 대응하는 반대쪽 원본 형상을 연결했습니다. Allen 참조 뇌는 두피에서 최소 1.3mm까지 붙어 있어 머리뼈가 들어갈 자리가 없었습니다. 그래서 정합장이 놓은 남성 뇌의 바깥면(머리뼈 안쪽)에 맞춰 부드럽게 맞췄습니다(이동 중앙 2.78mm·최대 13.92mm, 접힘 0). 시신경교차·시신경은 고정했고 두피까지 최소 8.2mm입니다. 현재 뇌 모형 26개와 남성 유래 보완 머리뼈 6개 사이에 표면 교차 30쌍이 남아 있습니다(이전 55쌍). 이 수치는 모형 쌍의 기하 교차로, 뇌 손상이나 임상적 관통 깊이가 아닙니다. 개별 설명에 실제 형상 출처를 표시하며, 일반적인 위치·신경 연결 교정이나 임상적 좌우 검증이 완료된 것은 아닙니다.</p>
                  <p className="selection-source"><a href="https://3d.nih.gov/entries/3DPX-020959" target="_blank" rel="noreferrer">HRA / NIH 3D 출처 설명</a> · CC BY 4.0 · 학습용 비진단 모델</p>
                </details>
              </div>}
              {sourceKey === "female-detail" && <>
                <p className="selection-source">여성 CT 별도 상세 · HRA 전신에 합쳐진 모델이 아닙니다.</p>
                <details className="ct-source-details"><summary>자료 출처·수록 범위</summary>
                  <p className="selection-description">{selectedAnatomy?.description || "동일 여성 CT의 11개 공개 분할 모형입니다. 식도·등 근육군은 촬영 구간만 수록하며 내부 세부 구획은 없습니다."}</p>
                  <p className="selection-source">원본 해상도 1.5mm · Jakob Wasserthal, 바젤대학병원 · <a href="https://zenodo.org/records/10047292" target="_blank" rel="noreferrer">TotalSegmentator 2.0.1</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · 표면 변환·축 변환·공통 이동. 진단·시술용이 아닙니다.</p>
                </details>
              </>}
              {state.selection.kind === "structure" && state.selection.ids.length === 1 && !state.comparison && !state.isolated && <label className="selection-context">
                <input type="checkbox" aria-label="주변 반투명" aria-describedby="selection-context-help" checked={state.fadeContext} onChange={(e) => dispatch({ type: "fade-context", value: e.target.checked })} />
                <span>주변 반투명 <small id="selection-context-help">관찰 보조 · 실제 박리 아님</small></span>
              </label>}
              {detailParts.length > 1 && (
                <details className="organ-detail-parts" open={detailPartsOpen} onToggle={(e) => setPartsOpen({ scope: partsScope, open: e.currentTarget.open })}>
                  <summary>세부 구조 {detailParts.length}개 선택</summary>
                  <div>
                    {detailParts.map((part) => <button key={part.id} aria-pressed={state.selection?.ids.length === 1 && state.selection.ids[0] === part.id} onClick={() => dispatch({ type: "select", layer: part.layer, detail: state.detail?.ids.includes(part.id) ? state.detail : detailForStructure(part), selection: { kind: "structure", ids: [part.id], name: part.label || part.name, layers: [part.layer as Layer] } })}>{part.label || part.name}<small>{part.name}</small></button>)}
                  </div>
                </details>
              )}
            </div>
            <div className="selection-actions">
              {sourceKey === "female-detail" && state.detail?.id !== "abdomen-ct" && <button aria-label="같은 여성 CT의 주변 기관 보기" onClick={() => selectFeatured(featuredAnatomy.find((item) => item.id === "abdomen-ct")!)}>주변 기관 함께 보기</button>}
              {fullLungDetail && lungViewOptions}
              {fullPancreasDetail && pancreasViewOptions}
              {fullKidneyDetail && kidneyViewOptions}
              {femaleViewOptions}
              {!fullCompositeDetail && !fullLungDetail && !fullPancreasDetail && !fullKidneyDetail && selectedOrgan && !(sourceKey === "female-detail" && selectedOrgan.ids.length === 1 && state.detail) && <button onClick={() => selectFeatured(selectedOrgan)}>{selectedComposite ? `${selectedComposite.name} ${state.detail ? "전체 모형" : "전체 상세 보기"}` : state.detail ? "기관 전체 모형" : "기관 상세 보기"}</button>}
              {state.detail && <button onClick={() => {
                if (isolateCameraFrame.current !== null) cancelAnimationFrame(isolateCameraFrame.current);
                isolateCameraFrame.current = null;
                const pose = state.detailReturn?.camera;
                dispatch({ type: "detail-close" });
                if (pose) restoreOverviewPose(pose);
                else requestAnimationFrame(() => camera("fit"));
              }}>전신으로 돌아가기</button>}
              {state.comparison && featuredAnatomy.filter((group) => comparisonDetailIds.includes(group.id)).map((group) => <button key={group.id} onClick={() => {
                setSeparateDetailIds([]); selectFeatured(group);
              }}>{group.name} 상세</button>)}
              <button onClick={() => { setPanel(null); camera("structure"); }}>확대</button>
              {!fullCompositeDetail && !fullLungDetail && <button aria-pressed={state.isolated} onClick={() => {
                const kind = state.isolated && state.detail ? "fit" : "structure";
                dispatch({ type: "isolate" });
                if (isolateCameraFrame.current !== null) cancelAnimationFrame(isolateCameraFrame.current);
                isolateCameraFrame.current = requestAnimationFrame(() => { isolateCameraFrame.current = null; camera(kind); });
              }}>{state.isolated ? "전체 구조 보기" : state.comparison ? "비교 대상만 보기" : connectiveBundle ? "인대·힘줄만 보기" : state.selection.kind === "bundle" ? "묶음만 보기" : "선택 구조만 보기"}</button>}
              <button className="clear-selection" aria-label="구조 선택 해제" data-tip="구조 선택 해제" data-tip-side="top" onClick={leaveSelection}><X size={15} /><span className="clear-text">해제</span></button>
            </div>
          </section>
        )}
      </aside>

      <div className="ax-bottom" ref={bottomRef}>
        <div className="ax-status">
          <span className="scene-status">
            <span className={`status-dot ${ready ? "live" : ""}`} />
            <span role="status">{statusText}</span>
            {state.selectionTarget !== "visible" && <span className="click-target"><span className="click-label">선택 대상: </span>{state.selectionTarget === "internal" ? "내부 구조" : "체표"}<span className="click-suffix"> 선택</span></span>}
          </span>
          <span className="ax-source">
            <span className="scope-source">{sourceKey === "female-detail" ? "여성 CT 별도 상세 · HRA 전신과 다른 신체" : state.sex === "female" ? `HRA 여성 전신 1,220개 + 남성 원본 정합 보완 ${transportedCount.toLocaleString("en-US")}개 · 여성 CT 별도 상세 11개` : "BodyParts3D 남성 참조 · 림프 142개 포함"}</span>
            <span className="scope-short">{sourceKey === "female-detail" ? "여성 CT 별도 상세" : state.sex === "female" ? "여성 HRA·남성 보완" : "남성 참조"}</span>
            {" · "}<a className="scene-guide" href="#wiki/massage-anatomy">학습용 근사<span className="guide-more"> · 근거 읽기</span> ↗</a>
          </span>
        </div>
        <div className="ax-point-bar" role="toolbar" aria-label="경혈 표시">
          {femaleHidden ? (<>
            <p className="ax-note"><span className="note-long">여성 모델의 경혈 좌표는 검수 전이라 표식을 숨깁니다.</span><span className="note-short">여성 경혈 좌표는 검수 전이라 숨깁니다.</span> <button aria-label="근사 위치로 보기" onClick={() => dispatch({ type: "female-markers", value: true })}>근사 위치<span className="note-long">로 보기</span></button> <button aria-label="남성 모델에서 경혈 보기" onClick={() => dispatch({ type: "sex", value: "male" })}>남성 모델<span className="note-long">에서 경혈 보기</span></button></p>
            <button className="ax-toggle" aria-expanded={panel === "points"} aria-label="경혈 찾기" data-tip="경혈 목록 · 장부 비교할 경혈 고르기" data-tip-side="top" onClick={(e) => openPanel("points", e.currentTarget)}><List size={15} /></button>
          </>) : <>
            {state.sex === "female" && <button className="ax-toggle ax-approx" aria-pressed="true" aria-label="여성 근사 표식 끄기" data-tip={`배·사타구니·가슴 ${femaleRuleCount}개 경혈은 여성 표지 기준, 나머지는 남성 표식을 옮긴 근사 위치 · 검수 전 · 누르면 숨김`} data-tip-side="top" onClick={() => dispatch({ type: "female-markers", value: false })}>근사</button>}
            <button className="ax-toggle" aria-pressed={state.markers !== "hidden"} onClick={() => dispatch({ type: "markers", value: state.markers === "hidden" ? "filtered" : "hidden" })}>
              <span className="ax-dot" />경혈 <small>{markerCount}</small>
            </button>
            <div className="ax-meridian-picker" data-popover-root>
              <button className="ax-toggle ax-meridian-button" aria-expanded={popover === "meridian"} onClick={(e) => togglePopover("meridian", e.currentTarget)}>
                {meridian === "all" ? <>경맥 <span>전체</span></> : <><i style={{ background: meridians.find((m) => m.id === meridian)?.color }} />경맥 <span>{meridianChipName(meridians.find((m) => m.id === meridian)!)}</span></>}
                <ChevronDown size={14} />
              </button>
              {popover === "meridian" && (
                <div className="ax-popover ax-meridians" role="group" aria-label="경맥 선택">
                  {comparisonLine}
                  <button aria-pressed={meridian === "all" && state.markers === "filtered"} aria-label="모든 경맥의 경혈 보기" onClick={() => { setFilter({ meridian: "all" }); dispatch({ type: "markers", value: "filtered" }); closePopover(); }}>
                    전체<small>{points.length}</small>
                  </button>
                  {meridians.map((m) => (
                    <button key={m.id} style={{ ["--c" as string]: m.color }} aria-pressed={meridian === m.id && state.markers === "filtered"} aria-label={`${m.name} 경혈만 보기`}
                      onClick={() => { setFilter({ meridian: meridian === m.id ? "all" : m.id }); dispatch({ type: "markers", value: "filtered" }); closePopover(); }}>
                      <i />{meridianChipName(m)}<small>{m.total}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="ax-toggle" aria-pressed={state.labels} aria-label="표식 이름 표시" data-tip="표식 이름 표시" data-tip-side="top" onClick={() => dispatch({ type: "labels", value: !state.labels })}><Tag size={14} /><span>이름</span></button>
            <button className="ax-toggle" aria-expanded={panel === "points"} aria-label="경혈 찾기" data-tip="경혈 목록·필터" data-tip-side="top" onClick={(e) => openPanel("points", e.currentTarget)}><List size={15} /><span>경혈 찾기</span></button>
          </>}
        </div>
        <div className="ax-camera">
          {compactCamera ? <>
            <div className="view-tools">
              <button aria-label="확대" data-tip="확대" onClick={() => camera("zoomIn")}><Plus size={17} /></button>
              <button aria-label="축소" data-tip="축소" onClick={() => camera("zoomOut")}><Minus size={17} /></button>
            </div>
            <div className="view-presets" role="group" aria-label="시점">
              <button onClick={() => camera("front")}>정면</button>
              <button onClick={() => camera("back")}>후면</button>
            </div>
            <details className="movement-pad" aria-label="화면 이동">
              <summary>시점</summary>
              <div>
                {comparisonLine}
                <button onClick={() => camera("side")}>측면</button>
                <button aria-label="계통 전체 보기" onClick={() => camera("fit")}>전체</button>
                <button aria-label="시점 초기화" onClick={() => camera("reset")}>초기화</button>
                {movementButtons}
              </div>
            </details>
          </> : <>
            <details className="movement-pad" aria-label="화면 이동">
              <summary data-tip="키보드: WASD · Q/E" data-tip-side="top">이동</summary>{movementButtons}
            </details>
            <div className="view-presets" role="group" aria-label="시점">
              {(["front", "back", "side"] as const).map((v, i) => <button key={v} onClick={() => camera(v)}>{["정면", "후면", "측면"][i]}</button>)}
            </div>
            <div className="view-tools">
              <button aria-label="확대" data-tip="확대" data-tip-side="top" onClick={() => camera("zoomIn")}><Plus size={17} /></button>
              <button aria-label="축소" data-tip="축소" data-tip-side="top" onClick={() => camera("zoomOut")}><Minus size={17} /></button>
              <button aria-label="계통 전체 보기" data-tip="계통 전체 보기" data-tip-side="top" onClick={() => camera("fit")}><Focus size={16} /></button>
              <button aria-label="시점 초기화" data-tip="시점 초기화" data-tip-side="top" onClick={() => camera("reset")}><RotateCcw size={16} /></button>
            </div>
          </>}
        </div>
      </div>

      {state.cutaway > 0 && <button className="cutaway-reset" onClick={() => dispatch({ type: "cutaway", value: 0 })}>앞쪽 구조 숨김 적용 · 초기화</button>}
    </main>
  );
}
