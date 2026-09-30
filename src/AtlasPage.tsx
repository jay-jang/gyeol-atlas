import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode } from "react";
import {
  ArrowUpRight, BookOpen, Bookmark, Check, ChevronDown, CircleHelp, Eye, Focus, Link2, List, LoaderCircle,
  Minus, Plus, RotateCcw, Search, SlidersHorizontal, Tag, X,
} from "lucide-react";
import AnatomyControls from "./AnatomyControls";
import PointTradition from "./PointTradition";
import { contextIsDimmed } from "./selection-context";
import { comparisonReference } from "./comparison-reference";
import { referenceSourceFor } from "./reference-source";
import { structureForSexId } from "./sex-structure";
import { depthStage, stageDepth } from "./dissection";
import type { ViewAction, ViewState } from "./view-state";
import {
  anatomyRegionNames, compositeGroups, detailForStructure, layerKeys, layerNames, maleKidneyViews, maleLungViews,
  malePancreasViews, organGroups, stageDescription, stages, structureGroups, structures, structuresForSex, type Layer,
} from "./anatomy";
import type { CameraAction, Layers, Point } from "./types";
import conceptData from "../data/point-concepts.json";
import concepts from "../data/concepts.json";
import pointData from "../data/points.json";
import meridians from "../data/meridians.json";
import sources from "../data/sources.json";

const Atlas = lazy(() => import("./Atlas"));
const points = pointData as Point[];
const pointConcepts = conceptData as Record<string, { categories: string[]; shuType: string | null; traditionalName: string | null; organIds: string[] }>;
const sourceById = (id: string) => sources.find((s) => s.id === id)!;
const meridianOf = (p: Point) => meridians.find((m) => m.id === p.meridian)!;
const categoryText = (id: string) => pointConcepts[id]?.categories.map((c) => concepts.find((x) => x.id === c)?.name).join(" · ") || "일반 경혈";
const normalizePointQuery = (q: string) => q.trim().toLowerCase().replace(/([a-z]+)\s+(\d+)/g, "$1$2");
type Panel = "search" | "display" | "help" | "points" | "detail" | null;
// Stable empty lists keep the 3D scene from redrawing on UI-only updates.
const NONE: string[] = [];
const fallbackPoint = { ...points.find((p) => p.id === "ST36")!, id: "" };

function SourceLink({ id, page }: { id: string; page?: number | null }) {
  const s = sourceById(id);
  return (
    <a href={s.url} target="_blank" rel="noreferrer" className="source-link">
      <span>{s.publisher}<small>{page ? `위치 표준 · p. ${page}` : s.kind}</small></span>
      <ArrowUpRight size={15} />
    </a>
  );
}

function PointDetail({ point, onFocus, saved, onSave, onCompare, onClose, comparisonFeedback }: {
  point: Point; onFocus: () => void; saved: boolean; onSave: () => void; onCompare: () => void; onClose: () => void; comparisonFeedback?: ReactNode;
}) {
  const feedbackRef = useRef<HTMLDivElement>(null);
  const hasComparisonFeedback = Boolean(comparisonFeedback);
  useEffect(() => {
    if (!hasComparisonFeedback) return;
    const frame = requestAnimationFrame(() => feedbackRef.current?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [hasComparisonFeedback, point.id]);
  const [tab, setTab] = useState("overview");
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
      <div className="ax-card-head">
        <span className="ax-eyebrow">{point.catalogue === "extra" ? "경외기혈" : `${meridianOf(point).name} · 정규 경혈`} · {point.markerCount}곳 표시</span>
        <button className="ax-icon" onClick={onSave} aria-label={saved ? "북마크 해제" : "북마크 저장"} data-tip={saved ? "북마크 해제" : "북마크 저장"} aria-pressed={saved}>
          <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        <button className="ax-icon" onClick={onClose} aria-label="도구 패널 닫기" data-tip="닫기"><X size={17} /></button>
      </div>
      <h2 className="ax-point-title"><span style={{ color: meridianOf(point).color }}>{point.id}</span>{point.name}<small>{point.hanja}</small></h2>
      <p className="ax-pinyin">{point.pinyin}</p>
      <section className="concept-reference">
        <strong>{categoryText(point.id)} {concept?.shuType}</strong>
        {concept?.traditionalName && <p>전통적 장부 대응: <b>{concept.traditionalName}</b></p>}
        {!!concept?.organIds.length && <button className="ax-primary" onClick={onCompare}>대응 장부의 해부 구조 비교</button>}
        {comparisonFeedback && <div ref={feedbackRef} className="comparison-feedback" role="status">{comparisonFeedback}</div>}
        {concept?.traditionalName && !concept?.organIds.length && <p>이 전통 개념에 일대일 대응하는 장기 메쉬는 지정하지 않았습니다.</p>}
        <small>장부 대응은 전통적 분류입니다. 체표에서 장기로 압력이 전달되거나 장기를 직접 마사지한다는 뜻이 아닙니다.</small>
        <span className="ax-links"><a href="#wiki/point-categories">원혈·모혈 분류와 출처 ↗</a><a href="#wiki/massage-anatomy">마사지 전 해부학 참고 가이드 ↗</a></span>
      </section>
      <div className="detail-tabs" role="tablist" aria-label="경혈 정보">
        {([["overview", "개요"], ["tradition", "효능·오행"], ["anatomy", "해부 구조"], ["sources", "근거"]] as const).map(([id, name]) =>
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{name}</button>)}
      </div>
      <div className="detail-content" role="tabpanel">
        {tab === "tradition" && <PointTradition point={point} />}
        {tab === "overview" && <>
          <p className="location-text">{point.location}</p>
          <div className="reference-line">
            <a href={point.nameSource} target="_blank" rel="noreferrer">KMCRIC 위치 원문 ↗</a>
            {point.page && <span>WHO p. {point.page}</span>}
          </div>
          <button className="focus-link" onClick={onFocus}><Focus size={15} />3D에서 가까이 보기</button>
          <div className="anatomy-tags">{point.landmarks.map((s) => <span key={s}>{s}</span>)}</div>
          <p className="muted">{point.structures.length ? "골격·근육 레이어에서 관련 부위가 강조됩니다." : "이 경혈의 개별 기준점 메쉬는 아직 연결하지 않았습니다."}</p>
          <p className="coordinate-note"><span className="status-dot" />학습용 근사 위치 · {point.markerNote} 전문가의 위치 검수는 아직 진행하지 않았습니다.</p>
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
      </div>
      <div className="detail-bottom">
        <a className="ax-primary" href={`#wiki/points/${point.id}`}><BookOpen size={15} />위키에서 더 알아보기</a>
        <div className="related-points" aria-label="연결된 경혈">
          {point.related.slice(0, 3).map((id) => <a key={id} href={`#atlas/${id}`}>{points.find((p) => p.id === id)?.name}<span>{id}</span></a>)}
        </div>
        <button className="share-link" onClick={share}>{copied ? <Check size={14} /> : <Link2 size={14} />}{copied ? "링크를 복사했습니다" : "이 경혈 링크 복사"}</button>
      </div>
    </section>
  );
}

export default function AtlasPage({ id, saved, toggle, state, dispatch, navigate }: {
  id: string; saved: string[]; toggle: (id: string) => void; state: ViewState; dispatch: Dispatch<ViewAction>; navigate: (path: string) => void;
}) {
  const routeSelection = points.find((p) => p.id === id);
  const hasSelected = Boolean(routeSelection);
  const selected = routeSelection || fallbackPoint;
  const [panel, setPanel] = useState<Panel>(null);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLElement | null>(null);
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
  useEffect(() => { setComparisonNotice(""); setSeparateDetailIds([]); }, [state.sex, state.pointId]);
  const { query, region, meridian, concept, onlySaved, bodyRegion, catalogue } = state.filters;
  const setFilter = (value: Partial<ViewState["filters"]>) => dispatch({ type: "filters", value });
  const resetFilters = () => dispatch({ type: "reset-filters" });
  const found = useMemo(() => points.filter((p) =>
    (region === "전체" || p.region === region) &&
    (bodyRegion === "전체" || p.bodyRegion === bodyRegion) &&
    (catalogue === "all" || p.catalogue === catalogue) &&
    (meridian === "all" || p.meridian === meridian) &&
    (concept === "all" || pointConcepts[p.id]?.categories.includes(concept)) &&
    (!onlySaved || saved.includes(p.id)) &&
    `${p.id} ${p.name} ${p.hanja} ${p.pinyin} ${p.landmarks.join(" ")} ${meridianOf(p)?.name}`.toLowerCase().includes(normalizePointQuery(query))),
  [region, bodyRegion, catalogue, meridian, concept, onlySaved, saved, query]);
  const camera = (kind: CameraAction["kind"]) => {
    if (kind === "focus" && state.sex === "female") {
      setComparisonNotice("여성 표면의 경혈 좌표는 검수 전입니다. 남성 기준 좌표로 이동하지 않습니다.");
      setSeparateDetailIds([]);
      setPanel("detail");
      return;
    }
    setAction((a) => ({ kind, tick: a.tick + 1 }));
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
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const openPanel = (name: Panel, trigger?: HTMLElement) => {
    if (trigger) triggerRef.current = trigger;
    setPanel((current) => (current === name ? null : name));
  };
  useEffect(() => {
    if (panel && panel !== "search" && panel !== "detail") {
      dockRef.current?.querySelector<HTMLElement>("input:not([type=checkbox]),select,button:not([aria-label='도구 패널 닫기'])")?.focus({ preventScroll: true });
    }
  }, [panel]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (e.key === "Escape") {
        setPanel(null);
        if (typing && e.target === searchRef.current) searchRef.current?.blur();
        triggerRef.current?.focus();
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setPanel("search");
        searchRef.current?.focus();
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const select = (p: Point) => {
    const leavingDetail = Boolean(state.detail);
    const returnPose = leavingDetail ? state.detailReturn?.camera : state.selectionReturn?.camera;
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
    setSeparateDetailIds([]);
    dispatch({
      type: "compare",
      name: c.traditionalName || selected.name,
      ids,
      layers: Object.fromEntries(layerKeys.map((layer) => [layer, layer === "skin" || structures.some((s) => s.layer === layer && ids.includes(s.id))])) as Layers,
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
  useEffect(() => {
    if (!selectionKey) { focusedSelection.current = ""; return; }
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
  const featuredAnatomy = organGroups.filter((group) => group.sex === state.sex)
    .map((group) => ({ ...group, detail: group.ids.length > 1 ? `${group.ids.length}개 세부 모형` : "단일 원본 모형" }));
  const selectFeatured = (item: { id: string; name: string; ids: string[] }) => {
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
    const measure = () => root.style.setProperty("--ax-bottom-h", `${Math.ceil(row.getBoundingClientRect().height)}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(row); measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const wheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const depthControl = Boolean(target.closest(".depth-explorer"));
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
  ] as const).map(([kind, label, text]) => <button key={kind} aria-label={label} title={label} onClick={() => camera(kind)}>{text}</button>)}</div>;
  const leaveSelection = () => {
    if (isolateCameraFrame.current !== null) cancelAnimationFrame(isolateCameraFrame.current);
    isolateCameraFrame.current = null;
    const pose = state.detail ? state.detailReturn?.camera : (state.selectionReturn?.camera ?? state.camera);
    dispatch({ type: "clear-selection" });
    if (pose) restoreOverviewPose(pose);
    else if (state.detail) requestAnimationFrame(() => camera("fit"));
  };

  // Unified search: acupoints, organ details and every catalogued structure.
  const q = search.trim().toLowerCase();
  const pointResults = q ? points.filter((p) =>
    `${p.id} ${p.name} ${p.hanja} ${p.pinyin} ${p.landmarks.join(" ")} ${meridianOf(p)?.name}`.toLowerCase().includes(normalizePointQuery(q))).slice(0, 40) : [];
  const organResults = q ? featuredAnatomy.filter((g) => g.name.toLowerCase().includes(q)) : featuredAnatomy;
  const structureResults = useMemo(() => !q ? [] : structuresForSex(state.sex).filter((s) =>
    `${s.label} ${s.name} ${s.id} ${s.fmaId || ""} ${s.latin || ""} ${(s.hierarchy || []).join(" ")}`.toLowerCase().includes(q),
  ).sort((a, b) => {
    const score = (s: ReturnType<typeof structuresForSex>[number]) => {
      const direct = [s.label, s.name, s.id, s.fmaId || ""].map((value) => (value || "").toLowerCase());
      if (direct.some((value) => value === q)) return 0;
      if (direct.some((value) => value.startsWith(q))) return 1;
      if (direct.some((value) => value.includes(q))) return 2;
      return 3;
    };
    return score(a) - score(b) || (a.label || a.name).localeCompare(b.label || b.name);
  }), [q, state.sex]);
  const visibleStructures = structureResults.slice(0, 240);
  // Picking closes the results but keeps the query; focusing search reopens it.
  const pickStructure = (s: ReturnType<typeof structuresForSex>[number]) => {
    setPanel((current) => current === "search" ? null : current);
    dispatch({
      type: "select", layer: s.layer as Layer, detail: detailForStructure(s),
      region: s.bodyRegion && s.bodyRegion !== "whole" ? s.bodyRegion as ViewState["anatomyRegion"] : undefined,
      selection: { kind: "structure", ids: [s.id], name: s.label || s.name },
    });
  };
  // The 3D scene receives stable callbacks that always call the latest handlers,
  // so UI-only updates never make it redraw.
  const latest = useRef({ select, pickStructure, sex: state.sex });
  latest.current = { select, pickStructure, sex: state.sex };
  const onScenePoint = useCallback((p: Point) => latest.current.select(p), []);
  const onSceneStructure = useCallback((sid: string) => {
    const item = structureForSexId(structures, latest.current.sex, sid);
    if (item) latest.current.pickStructure(item);
  }, []);

  const depthName = (depth: number) => layerNames[stages[depthStage(depth)].layer];
  const soloLayer = layerKeys.filter((layer) => state.layers[layer]).length === 1 ? layerKeys.find((layer) => state.layers[layer]) : null;
  const femaleMarkers = state.sex === "female";
  const markerCount = femaleMarkers || state.detail ? 0 : markers.length;
  const statusText = !enabledLayers.length ? "레이어를 켜서 구조를 표시하세요"
    : ready ? "해부 모델 로드 완료"
    : loadedLayers.length ? `표시 중 · 내부 계통 불러오는 중 ${loadedLayers.length}/${enabledLayers.length}` : "해부 모델 준비 중";
  const closeButton = <button className="ax-icon ax-close" aria-label="도구 패널 닫기" onClick={closePanel}><X size={18} /></button>;

  return (
    <main
      className="ax"
      ref={workspaceRef}
      aria-label="인체 구조 탐색"
      data-panel={panel || "none"}
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
          />
        </Suspense>
      </section>

      <div className="ax-top">
        <div className="ax-search" role="search">
          <Search size={17} aria-hidden="true" />
          <input
            ref={searchRef}
            aria-label="경혈·구조 검색"
            placeholder="경혈 · 구조 · 기관 검색"
            value={search}
            onFocus={(e) => { if (panel !== "search") { triggerRef.current = e.currentTarget; setPanel("search"); } }}
            onChange={(e) => { setSearch(e.target.value); setPanel("search"); }}
          />
          {panel === "search" ? <button className="ax-icon" aria-label="도구 패널 닫기" onClick={() => { setSearch(""); setPanel(null); }}><X size={16} /></button> : <kbd aria-hidden="true">/</kbd>}
        </div>
        <div className="ax-top-actions">
          <div className="ax-segment" role="group" aria-label="인체 성별 기준">
            <button aria-pressed={state.sex === "male"} onClick={() => dispatch({ type: "sex", value: "male" })}>남성</button>
            <button aria-pressed={state.sex === "female"} onClick={() => dispatch({ type: "sex", value: "female" })}>여성</button>
          </div>
          <select className="ax-select" aria-label="전신 부위 선택" value={state.anatomyRegion} onChange={(e) => {
            const value = e.target.value as ViewState["anatomyRegion"];
            dispatch({ type: "anatomy-region", value });
            requestAnimationFrame(() => camera(value === "whole" ? "fit" : "anatomy-region"));
          }}>{Object.entries(anatomyRegionNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
          <button className="ax-icon" aria-label="표시 설정" data-tip="표시 설정" aria-expanded={panel === "display"} onClick={(e) => openPanel("display", e.currentTarget)}><SlidersHorizontal size={18} /></button>
          <button className="ax-icon" aria-label="도움말" data-tip="도움말" aria-expanded={panel === "help"} onClick={(e) => openPanel("help", e.currentTarget)}><CircleHelp size={18} /></button>
        </div>
      </div>

      {panel === "search" && (
        <div className="ax-panel ax-results" role="region" aria-label="검색 결과" ref={dockRef}>
          {!q && <>
            <p className="ax-hint">경혈 코드·이름, 구조의 한국어·영어·FMA로 찾습니다.</p>
            <h3 className="ax-group-title">기관 상세 <small>{featuredAnatomy.length}</small></h3>
          </>}
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
              <h3 className="ax-group-title">경혈 <small>{pointResults.length}</small></h3>
              {pointResults.map((p) => (
                <button key={p.id} className={`point-item ${p.id === selected.id ? "active" : ""}`} aria-pressed={p.id === selected.id} onClick={() => select(p)}>
                  <i style={{ background: meridianOf(p).color }} />
                  <span><strong>{p.name} <small>{p.id}</small></strong><small className="classification-text">{meridianOf(p).shortName} · {p.region} · {categoryText(p.id)}</small></span>
                </button>
              ))}
            </section>
          )}
          {q && (
            <div className="structure-browser">
              <p className="control-hint">{structureResults.length.toLocaleString()}개 구조 · 이름·라틴명·계통 경로로 검색{structureResults.length > visibleStructures.length && ` · 상위 ${visibleStructures.length}개 표시`}</p>
              {layerKeys.map((l) => {
                const items = visibleStructures.filter((s) => s.layer === l);
                return items.length > 0 && (
                  <section className="structure-group" key={l}>
                    <h3 className="ax-group-title">{layerNames[l]} <small>{items.length}</small></h3>
                    {items.map((s) => (
                      <button key={s.id} className="structure-item" aria-pressed={state.selection?.kind === "structure" && state.selection.ids[0] === s.id} onClick={() => pickStructure(s)}>
                        <strong>{s.label || s.name}</strong>
                        <small>{s.name}{s.latin ? ` · ${s.latin}` : ""} · {s.id}{s.fmaId && s.fmaId !== s.id ? ` · ${s.fmaId}` : ""} · {s.source || "BodyParts3D 남성 참조"}</small>
                        {s.hierarchy?.length ? <small className="structure-path">{s.hierarchy.join(" › ")}</small> : null}
                      </button>
                    ))}
                  </section>
                );
              })}
              {!structureResults.length && !pointResults.length && !organResults.length && <p className="ax-hint">일치하는 경혈·구조가 없습니다. 다른 이름이나 코드를 입력하세요.</p>}
              {state.selection && <button className="structure-focus" onClick={() => { setPanel(null); camera("structure"); }}>선택 구조 확대</button>}
            </div>
          )}
        </div>
      )}

      {panel === "display" && (
        <div className="ax-panel ax-side-panel" role="region" aria-label="표시 설정" ref={dockRef}>
          <div className="ax-panel-head"><strong>표시 설정</strong>{closeButton}</div>
          <AnatomyControls state={state} dispatch={dispatch} />
        </div>
      )}

      {panel === "help" && (
        <div className="ax-panel ax-side-panel" role="region" aria-label="도움말" ref={dockRef}>
          <div className="ax-panel-head"><strong>도움말</strong>{closeButton}</div>
          <div className="viewer-help">
            <p>왼쪽 깊이 막대를 끌거나 계통 이름을 눌러 바깥부터 한 겹씩 걷어 냅니다. 처음에는 모든 계통이 몸 안에 함께 있고, 피부 → 근육(개별 근육 순서) → 골격 → 장기 → 혈관 → 림프 순서로 사라지며 신경이 남습니다. 눈 모양 버튼은 그 계통만 따로 봅니다.</p>
            <p>아래 경맥 막대로 경혈을 한꺼번에 몸 위에 표시합니다. 표식에 마우스를 올리면 이름이, 누르면 경혈 정보가 열립니다. 보이지 않는 뒷면의 표식은 몸을 돌리면 나타납니다.</p>
            <p>모델을 클릭한 뒤 W/S로 전진·후진, A/D로 좌우, Q/E로 아래·위로 이동합니다. Shift를 누르면 빠르게 이동합니다. 드래그로 회전, 일반 휠·핀치로 확대·축소합니다. Alt/Option을 누른 채 휠을 돌리거나 ↑/↓를 누르면 박리 깊이를 조절합니다. / 키로 검색을 엽니다.</p>
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
          <label className="ax-field">이름·코드<input aria-label="경혈 검색" placeholder="이름, 코드, 해부 구조 검색" value={query} onChange={(e) => setFilter({ query: e.target.value })} /></label>
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
            <button aria-pressed={onlySaved} onClick={() => setFilter({ onlySaved: !onlySaved })}><Bookmark size={12} />저장 {saved.length}</button>
          </div>
          {concept !== "all" && <p className="ax-hint">{concepts.find((c) => c.id === concept)?.description}</p>}
          <div className="ax-row">
            <button className="show-filtered-button ax-primary" disabled={!found.length} onClick={() => { dispatch({ type: "show-filtered" }); camera("region"); setPanel(null); }}>필터 결과 {found.length}개를 모델에서 보기</button>
            <button className="ax-ghost" onClick={resetFilters}><RotateCcw size={13} />초기화</button>
          </div>
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
          <p className="coverage-note">14개 경맥 · 경혈 {points.length}개 · 정규 361경혈 + 표준 경외기혈 48개</p>
        </div>
      )}

      <nav className="depth-explorer ax-depth" aria-label="인체 깊이 탐색" data-mode={state.displayMode}>
        <div className="depth-heading">
          {state.displayMode === "dissection"
            ? <strong aria-live="polite">{state.dissection.toFixed(1)}%<small>{depthName(state.dissection)}</small></strong>
            : <button className="peel-entry" aria-label={`현재 기준 ${state.dissection.toFixed(1)}%에서 연속 박리 시작`} onClick={() => dispatch({ type: "dissection", value: state.dissection })}>박리<small>{state.dissection.toFixed(1)}%</small></button>}
        </div>
        <div className="ax-depth-track">
          <input
            type="range" min="0" max="100" step="0.5"
            value={state.dissection}
            aria-label="연속 해부 박리 깊이"
            aria-valuetext={state.displayMode === "dissection" ? `${state.dissection.toFixed(1)}% 해부 깊이 · ${depthName(state.dissection)}` : `계통별 보기 중 · 박리 시작 기준 ${state.dissection.toFixed(1)}%`}
            onChange={(event) => dispatch({ type: "dissection", value: Number(event.target.value) })}
          />
          <ol className="depth-steps">
            {stages.map((stage, index) => {
              const peeled = state.displayMode === "dissection" && index < state.stage;
              const current = state.displayMode === "dissection" ? index === state.stage : soloLayer === stage.layer;
              return (
                <li key={stage.layer} style={{ ["--at-f" as string]: stageDepth[index] / 100 }} className={current ? "active" : peeled ? "peeled" : ""}>
                  <button className="ax-stop" onClick={() => dispatch({ type: "dissection", value: stageDepth[index] })} aria-label={`${layerNames[stage.layer]}까지 박리`} title={`${layerNames[stage.layer]}까지 박리 · ${stageDepth[index]}%`}>
                    <i className={`layer-dot ${stage.layer}`} /><span className="ax-stop-name">{layerNames[stage.layer]}</span>
                  </button>
                  <button className="ax-solo" aria-label={`${layerNames[stage.layer]} 빠른 보기`} data-tip={`${layerNames[stage.layer]}만 보기`} data-tip-side="right" aria-pressed={soloLayer === stage.layer} onClick={() => dispatch({ type: "stage", index })}><Eye size={13} /></button>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>

      <aside className="ax-inspector" aria-label="선택 정보">
        {!hasSelected && (
          <div className="floating-point ax-point-chip">
            <button className="ax-point-empty" aria-label="경혈 선택 — 표식을 누르거나 목록에서 고르기" onClick={(e) => openPanel("points", e.currentTarget)}>
              <span className="ax-dot" />경혈 선택<small>표식을 누르거나 목록에서</small>
            </button>
          </div>
        )}
        {hasSelected && (
          <div className="floating-point ax-point-chip">
            <button className="point-summary" aria-expanded={panel === "detail"} onClick={(e) => openPanel("detail", e.currentTarget)}>
              <i style={{ background: meridianOf(selected).color }} />
              <span>{selected.id}</span>
              <strong>{selected.name}</strong>
              <small>{categoryText(selected.id)}</small>
              <ChevronDown size={15} />
            </button>
            <button className="ax-icon" aria-label="선택 경혈 확대" data-tip="선택 경혈 확대" onClick={() => camera("focus")}><Focus size={17} /></button>
          </div>
        )}
        {panel === "detail" && hasSelected && (
          <PointDetail
            point={selected}
            onFocus={() => { setPanel(null); camera("focus"); }}
            saved={saved.includes(selected.id)}
            onSave={() => toggle(selected.id)}
            onCompare={compare}
            onClose={closePanel}
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
          <section className="selection-card ax-card" data-detail={Boolean(state.detail)} data-selection="true" data-lung-part={selectedLungPart} aria-label="선택 구조 조작">
            <div key={selectionKey}>
              <span className={`selection-kind ${state.selection.kind}`}>
                {state.comparison ? "전통 장부 비교" : state.detail ? `${state.detail.name} · ${selectedComposite ? "구조" : "기관"} 상세 모델` : state.selection.kind === "bundle" ? "구조 묶음" : "선택 구조"}
              </span>
              <strong>{state.selection.name} <small>{state.selection.ids.length}개 구조</small></strong>
              {state.comparison && <p className="comparison-note">{selected.name} · {state.comparison.name} 비교 — 전통적 대응, 압력 경로 아님</p>}
              {state.sex === "male" && sourceKey === "male-detail" && selectedGroup === "stomach" && <p className="selection-description" data-stomach-frame-warning>별도 4.0 상세 원본입니다. 전신 3.0 위와 상자 중심이 약 42mm 달라 같은 위치로 정합된 화면이 아닙니다.</p>}
              {selectedAnatomy?.description && sourceKey !== "female-detail" && <p className="selection-description">{selectedAnatomy.description}</p>}
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
              {state.sex === "female" && selectedOrgan?.id === "brain" && <div data-brain-provenance>
                <p className="selection-description">뇌 묶음: Allen 참조 282개 + Visible Human 시신경교차 1개 · 차용 머리뼈와 뇌 모형 35개 표면 교차 · 위치 검증 미완료</p>
                <details className="anatomy-source-details"><summary>뇌 출처·방향 주의</summary>
                  <p className="selection-description">282개는 Allen 참조 구조를 대칭 복제하고 여성 신체에 맞춰 크기를 조정한 모델로, 여성 기증자 뇌 스캔이 아닙니다. 시신경교차 1개는 Visible Human 여성 자료로 그대로 유지합니다. Allen 원본의 좌우 표기가 전신의 눈·대퇴골 기준과 반대여서, 원문 이름·ID는 유지하고 대응하는 반대쪽 원본 형상을 연결했습니다. 전체 뇌 형상은 바꾸지 않았습니다. 현재 뇌 모형 35개와 남성 유래 보완 머리뼈 6개 사이에 표면 교차 55쌍이 남아 있습니다. 이 수치는 모형 쌍의 기하 교차로, 뇌 손상이나 임상적 관통 깊이가 아닙니다. 개별 설명에 실제 형상 출처를 표시하며, 일반적인 위치·신경 연결 교정이나 임상적 좌우 검증이 완료된 것은 아닙니다.</p>
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
              {detailParts.length > 1 && (
                <details className="organ-detail-parts" open={detailPartsOpen} onToggle={(e) => setPartsOpen({ scope: partsScope, open: e.currentTarget.open })}>
                  <summary>세부 구조 {detailParts.length}개 선택</summary>
                  <div>
                    {detailParts.map((part) => <button key={part.id} aria-pressed={state.selection?.ids.length === 1 && state.selection.ids[0] === part.id} onClick={() => dispatch({ type: "select", layer: part.layer, detail: state.detail?.ids.includes(part.id) ? state.detail : detailForStructure(part), selection: { kind: "structure", ids: [part.id], name: part.label || part.name } })}>{part.label || part.name}<small>{part.name}</small></button>)}
                  </div>
                </details>
              )}
            </div>
            <div className="selection-actions">
              {state.selection.kind === "structure" && state.selection.ids.length === 1 && !state.comparison && !state.isolated && <label className="selection-context">
                <input type="checkbox" aria-label="주변 반투명" aria-describedby="selection-context-help" checked={state.fadeContext} onChange={(e) => dispatch({ type: "fade-context", value: e.target.checked })} />
                <span>주변 반투명 <small id="selection-context-help">관찰 보조 · 실제 박리 아님</small></span>
              </label>}
              {sourceKey === "female-detail" && state.detail?.id !== "abdomen-ct" && <button aria-label="같은 여성 CT의 주변 기관 보기" onClick={() => selectFeatured(featuredAnatomy.find((item) => item.id === "abdomen-ct")!)}>주변 기관 함께 보기</button>}
              {fullLungDetail && lungViewOptions}
              {fullPancreasDetail && pancreasViewOptions}
              {fullKidneyDetail && kidneyViewOptions}
              {!fullCompositeDetail && !fullLungDetail && !fullPancreasDetail && !fullKidneyDetail && selectedOrgan && !(sourceKey === "female-detail" && selectedOrgan.ids.length === 1 && state.detail) && <button onClick={() => selectFeatured(selectedOrgan)}>{selectedComposite ? `${selectedComposite.name} ${state.detail ? "전체 모형" : "전체 상세 보기"}` : state.detail ? "기관 전체 모형" : "기관 상세 보기"}</button>}
              {state.detail && <button onClick={() => {
                if (isolateCameraFrame.current !== null) cancelAnimationFrame(isolateCameraFrame.current);
                isolateCameraFrame.current = null;
                const pose = state.detailReturn?.camera;
                dispatch({ type: "detail-close" });
                if (pose) restoreOverviewPose(pose);
                else requestAnimationFrame(() => camera("fit"));
              }}>전신으로 돌아가기</button>}
              <button onClick={() => { setPanel(null); camera("structure"); }}>확대</button>
              {!fullCompositeDetail && !fullLungDetail && <button aria-pressed={state.isolated} onClick={() => {
                const kind = state.isolated && state.detail ? "fit" : "structure";
                dispatch({ type: "isolate" });
                if (isolateCameraFrame.current !== null) cancelAnimationFrame(isolateCameraFrame.current);
                isolateCameraFrame.current = requestAnimationFrame(() => { isolateCameraFrame.current = null; camera(kind); });
              }}>{state.isolated ? "전체 구조 보기" : state.selection.kind === "bundle" ? "비교 대상만 보기" : "선택 구조만 보기"}</button>}
              <button aria-label="구조 선택 해제" onClick={leaveSelection}><X size={15} /></button>
            </div>
          </section>
        )}
      </aside>

      <div className="ax-bottom" ref={bottomRef}>
        <div className="ax-status">
          <span className="scene-status">
            <span className={`status-dot ${ready ? "live" : ""}`} />
            <span role="status">{statusText}</span>
            <span className="click-target">선택 대상: {state.selectionTarget === "internal" ? "내부 구조" : state.selectionTarget === "skin" ? "체표" : "보이는 구조"}</span>
          </span>
          {(state.selection || state.comparison) && (
            <span className="scene-legend">
              <span><i className="legend-selected" />선택 구조</span>
              <span><i className="legend-compare" />전통 장부 대응</span>
              <span><i className="legend-reference" />경혈 참조</span>
            </span>
          )}
          <span className="ax-source"><span className="scope-source">{sourceKey === "female-detail" ? "여성 CT 별도 상세 · HRA 전신과 다른 신체" : state.sex === "female" ? "HRA 전신 1,220개 + 여성 CT 별도 상세 11개 · 보완 골격·근육 정렬 미완료" : "BodyParts3D 남성 참조 · 림프 142개 포함"}</span> · <a className="scene-guide" href="#wiki/massage-anatomy">학습용 근사 · 근거 읽기 ↗</a></span>
        </div>
        <div className="ax-point-bar" role="toolbar" aria-label="경혈 표시">
          {femaleMarkers ? (<>
            <p className="ax-note">여성 모델의 경혈 좌표는 검수 전이라 표식을 숨깁니다. <button onClick={() => dispatch({ type: "sex", value: "male" })}>남성 모델에서 경혈 보기</button></p>
            <button className="ax-toggle" aria-expanded={panel === "points"} aria-label="경혈 찾기" data-tip="경혈 목록 · 장부 비교할 경혈 고르기" data-tip-side="top" onClick={(e) => openPanel("points", e.currentTarget)}><List size={15} /></button>
          </>) : <>
            <button className="ax-toggle" aria-pressed={state.markers !== "hidden"} onClick={() => dispatch({ type: "markers", value: state.markers === "hidden" ? "filtered" : "hidden" })}>
              <span className="ax-dot" />경혈 <small>{markerCount}</small>
            </button>
            <div className="ax-meridians">
              <button aria-pressed={meridian === "all" && state.markers === "filtered"} aria-label="모든 경맥의 경혈 보기" onClick={() => { setFilter({ meridian: "all" }); dispatch({ type: "markers", value: "filtered" }); }}>전체</button>
              {meridians.map((m) => (
                <button key={m.id} style={{ ["--c" as string]: m.color }} aria-pressed={meridian === m.id && state.markers === "filtered"} aria-label={`${m.name} 경혈만 보기`} data-tip={`${m.name} · ${m.total}혈`} data-tip-side="top"
                  onClick={() => { setFilter({ meridian: meridian === m.id ? "all" : m.id }); dispatch({ type: "markers", value: "filtered" }); }}>
                  <i />{m.id}
                </button>
              ))}
            </div>
            <button className="ax-toggle" aria-pressed={state.labels} aria-label="표식 이름 표시" data-tip="표식 이름 표시" data-tip-side="top" onClick={() => dispatch({ type: "labels", value: !state.labels })}><Tag size={14} /></button>
            <button className="ax-toggle" aria-expanded={panel === "points"} aria-label="경혈 찾기" data-tip="경혈 목록·필터" data-tip-side="top" onClick={(e) => openPanel("points", e.currentTarget)}><List size={15} /></button>
          </>}
        </div>
        <div className="ax-camera">
          <details className="movement-pad" aria-label="화면 이동">
            <summary title="키보드: WASD · Q/E">이동</summary>{movementButtons}
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
        </div>
      </div>

      {state.cutaway > 0 && <button className="cutaway-reset" onClick={() => dispatch({ type: "cutaway", value: 0 })}>앞쪽 구조 숨김 적용 · 초기화</button>}
    </main>
  );
}
