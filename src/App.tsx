import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useReducer,
  type Dispatch,
  type FormEvent,
} from "react";
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Layers3,
  Globe2,
  Bookmark,
  Check,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Plus,
  Minus,
  Focus,
  CircleHelp,
  SlidersHorizontal,
  Link2,
  ExternalLink,
  ArrowUp,
  LoaderCircle,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  Sparkles,
  X,
  Brain,
  HeartPulse,
  Boxes,
  Eye,
} from "lucide-react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import { assetUrl } from "./assets";
import { createKnowledge } from "../shared/knowledge.mjs";
import remarkGfm from "remark-gfm";
import AnatomyControls from "./AnatomyControls";
import PointTradition from "./PointTradition";
import {
  initialView,
  restoreView,
  viewReducer,
  type ViewState,
  type ViewAction,
} from "./view-state";
import { structures } from "./anatomy";

const VIEW_KEY = "gyeol-view-v2";
function readView() {
  try {
    return restoreView(
      sessionStorage.getItem(VIEW_KEY),
      pointData.map((p) => p.id),
      structures,
    );
  } catch {
    return initialView();
  }
}
function returnToAtlas() {
  const pointId = readView().pointId;
  return pointId ? `#atlas/${pointId}` : "#atlas";
}
import { anatomyRegionNames, femaleAvailableLayers, layerKeys, layerNames, stages, type Layer } from "./anatomy";
import conceptData from "../data/point-concepts.json";
import concepts from "../data/concepts.json";
const pointConcepts = conceptData as Record<
  string,
  {
    categories: string[];
    shuType: string | null;
    traditionalName: string | null;
    organIds: string[];
  }
>;
import pointData from "../data/points.json";
import meridians from "../data/meridians.json";
import sources from "../data/sources.json";
import wikiData from "../data/wiki.json";
import type { Point, Layers, CameraAction, WikiDoc } from "./types";
const Atlas = lazy(() => import("./Atlas"));
const points = pointData as Point[],
  docs = wikiData as WikiDoc[];
const sourceById = (id: string) => sources.find((s) => s.id === id)!;
const navigate = (path: string) => {
  window.location.hash = path;
};
function useRoute() {
  const [route, setRoute] = useState(location.hash.slice(1) || "atlas");
  useEffect(() => {
    const f = () => setRoute(location.hash.slice(1) || "atlas");
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return route;
}
function useBookmarks() {
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const x = JSON.parse(localStorage.getItem("gyeol-bookmarks") || "[]");
      return Array.isArray(x)
        ? x.filter(
            (id: unknown) =>
              typeof id === "string" && points.some((p) => p.id === id),
          )
        : [];
    } catch {
      return [];
    }
  });
  const toggle = (id: string) =>
    setSaved((old) => {
      const v = old.includes(id) ? old.filter((x) => x !== id) : [...old, id];
      try {
        localStorage.setItem("gyeol-bookmarks", JSON.stringify(v));
      } catch {}
      return v;
    });
  return { saved, toggle };
}
function Logo() {
  return (
    <a className="brand" href="#atlas" aria-label="결 홈">
      <span className="brand-symbol">
        결<span />
      </span>
      <strong>
        GYEOL<small>해부학과 경혈을 잇다</small>
      </strong>
    </a>
  );
}
function SourceLink({ id, page }: { id: string; page?: number | null }) {
  const s = sourceById(id);
  return (
    <a href={s.url} target="_blank" rel="noreferrer" className="source-link">
      <span>
        {s.publisher}
        <small>{page ? `위치 표준 · p. ${page}` : s.kind}</small>
      </span>
      <ArrowUpRight size={16} />
    </a>
  );
}
function PointDetail({
  point,
  onFocus,
  saved,
  onSave,
  onCompare,
}: {
  point: Point;
  onFocus: () => void;
  saved: boolean;
  onSave: () => void;
  onCompare: () => void;
}) {
  const [tab, setTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const meridian = meridians.find((m) => m.id === point.meridian)!;
  useEffect(() => {
    setTab("overview");
    setCopied(false);
  }, [point.id]);
  async function share() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}${location.pathname}#atlas/${point.id}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <aside className="detail-panel" aria-label="선택한 경혈 상세">
      <div className="detail-eyebrow">
        <span>ACUPOINT PROFILE</span>
        <button
          className={`icon-button ${saved ? "saved" : ""}`}
          onClick={onSave}
          aria-label={saved ? "북마크 해제" : "북마크 저장"}
          title={saved ? "북마크 해제" : "북마크 저장"}
        >
          <Bookmark size={19} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="point-heading">
        <span
          className="code-badge"
          style={{ color: meridian.color, background: `${meridian.color}15` }}
        >
          {point.id}
        </span>
        <h2>
          {point.name}
          <span>{point.hanja}</span>
        </h2>
        <p>
          {point.pinyin}{" "}
          <span>· {point.catalogue === "extra" ? "경외기혈" : "정규 경혈"} · {point.markerCount}곳 표시</span>
        </p>
      </div>
      <button
        className="meridian-tag"
        onClick={() => navigate(`wiki/points/${point.id}`)}
      >
        <i style={{ background: meridian.color }} />
        {meridian.name}
        <ChevronRight size={14} />
      </button>
      <section className="concept-reference">
        <strong>
          {pointConcepts[point.id]?.categories
            .map((id) => concepts.find((c) => c.id === id)?.name)
            .join(" · ") || "일반 경혈"}{" "}
          {pointConcepts[point.id]?.shuType}
        </strong>
        {pointConcepts[point.id]?.traditionalName && (
          <p>
            전통적 장부 대응: <b>{pointConcepts[point.id].traditionalName}</b>
          </p>
        )}
        {!!pointConcepts[point.id]?.organIds.length && (
          <button onClick={onCompare}>대응 장부의 해부 구조 비교</button>
        )}
        {pointConcepts[point.id]?.traditionalName &&
          !pointConcepts[point.id]?.organIds.length && (
            <p>
              이 전통 개념에 일대일 대응하는 장기 메쉬는 지정하지 않았습니다.
            </p>
          )}
        <small>
          장부 대응은 전통적 분류입니다. 체표에서 장기로 압력이 전달되거나
          장기를 직접 마사지한다는 뜻이 아닙니다.
        </small>
        <a href="#wiki/point-categories">원혈·모혈 분류와 출처 ↗</a>
        <a href="#wiki/massage-anatomy">마사지 전 해부학 참고 가이드 ↗</a>
      </section>
      <div className="detail-tabs" role="tablist" aria-label="경혈 정보">
        <button
          role="tab"
          aria-selected={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          개요
        </button>
        <button
          role="tab"
          aria-selected={tab === "tradition"}
          onClick={() => setTab("tradition")}
        >효능·오행</button>
        <button
          role="tab"
          aria-selected={tab === "anatomy"}
          onClick={() => setTab("anatomy")}
        >
          해부 구조
        </button>
        <button
          role="tab"
          aria-selected={tab === "sources"}
          onClick={() => setTab("sources")}
        >
          근거
        </button>
      </div>
      <div className="detail-content" role="tabpanel">
        {tab === "tradition" && <PointTradition point={point} />}
        {tab === "overview" && (
          <>
            <div className="section-label">
              <span className="tiny-dot" />
              위치 알아보기
            </div>
            <p className="location-text">{point.location}</p>
            <div className="reference-line">
              <a href={point.nameSource} target="_blank" rel="noreferrer">KMCRIC 위치 원문 ↗</a>
              {point.page && <span>WHO p. {point.page}</span>}
            </div>
            <button className="focus-link" onClick={onFocus}>
              <Focus size={16} />
              3D에서 가까이 보기
              <ArrowUpRight size={15} />
            </button>
            <div className="detail-divider" />
            <div className="section-label">함께 보는 해부 구조</div>
            <div className="anatomy-tags">
              {point.landmarks.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <p className="muted small">
              {point.structures.length ? "골격·근육 레이어에서 관련 부위가 강조됩니다." : "이 경혈의 개별 기준점 메쉬는 아직 연결하지 않았습니다."}
            </p>
            <div className="coordinate-note">
              <span className="status-dot" />
              학습용 근사 위치
              <small>
                {point.markerNote}
                <br />
                전문가의 위치 검수는 아직 진행하지 않았습니다.
              </small>
            </div>
          </>
        )}
        {tab === "anatomy" && (
          <>
            <div className="section-label">해부학적 기준점</div>
            <p className="location-text">{point.landmarks.join(" · ")}</p>
            <div className="anatomy-tags">
              {point.structures.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <p className="muted">
              표시된 메쉬는 기준점 또는 같은 부위의 참조 구조입니다.
              신경·혈관·힘줄을 모두 포함하지 않으며, 경맥과 해부 구조가
              동일하다는 뜻은 아닙니다.
            </p>
            <button className="focus-link" onClick={onFocus}>
              <Focus size={16} />
              관련 부위 확대
            </button>
            <a className="text-link" href="#wiki/coordinate-method">
              좌표를 만든 방법 <ArrowUpRight size={14} />
            </a>
          </>
        )}
        {tab === "sources" && (
          <>
            <div className="section-label">자료의 출처</div>
            <a className="source-link" href={point.nameSource} target="_blank" rel="noreferrer">{point.id} 명칭·위치 원문 ↗</a>
            {point.catalogue === "classical" && <SourceLink id="who-locations" page={point.page} />}
            <SourceLink id={point.traditionSourceId} />
            <p className="muted small">
              공식 PDF 접근 제한으로 WHO 문서의{" "}
              <a
                href={sourceById("who-locations").accessUrl}
                target="_blank"
                rel="noreferrer"
              >
                공개 재현본
              </a>
              과 대조했습니다. 위치 표준은 치료 효과의 근거가 아닙니다.
            </p>
            <SourceLink id="bodyparts" />
            <a className="text-link" href="#wiki/evidence">
              근거를 읽는 방법 <ArrowUpRight size={14} />
            </a>
          </>
        )}
      </div>
      <div className="detail-bottom">
        <a className="primary-button" href={`#wiki/points/${point.id}`}>
          <BookOpen size={17} />
          위키에서 더 알아보기
          <ArrowUpRight size={17} />
        </a>
        <div className="related-label">연결된 경혈</div>
        <div className="related-points">
          {point.related.slice(0, 3).map((id) => (
            <a key={id} href={`#atlas/${id}`}>
              {points.find((p) => p.id === id)?.name}
              <span>{id}</span>
            </a>
          ))}
        </div>
        <button className="share-link" onClick={share}>
          {copied ? <Check size={14} /> : <Link2 size={14} />}{" "}
          {copied ? "링크를 복사했습니다" : "이 경혈 링크 복사"}
        </button>
      </div>
    </aside>
  );
}
function AtlasPage({
  id,
  saved,
  toggle,
  state,
  dispatch,
}: {
  id: string;
  saved: string[];
  toggle: (id: string) => void;
  state: ViewState;
  dispatch: Dispatch<ViewAction>;
}) {
  const routeSelection = points.find((p) => p.id === id);
  const hasSelected = Boolean(routeSelection);
  const selected =
    routeSelection || { ...points.find((p) => p.id === "ST36")!, id: "" };
  const [panel, setPanel] = useState<
    "points" | "layers" | "structures" | "detail" | "help" | null
  >(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [action, setAction] = useState<CameraAction>({
    kind: "restore",
    tick: 0,
  });
  const [loaded, setLoaded] = useState<Layer[]>([]);
  const { query, region, meridian, concept, onlySaved, bodyRegion, catalogue } = state.filters;
  const setQuery = (v: string) =>
    dispatch({ type: "filters", value: { query: v } });
  const setRegion = (v: string) =>
    dispatch({ type: "filters", value: { region: v } });
  const setMeridian = (v: string) =>
    dispatch({ type: "filters", value: { meridian: v } });
  const setConcept = (v: string) =>
    dispatch({ type: "filters", value: { concept: v } });
  const setOnlySaved = (v: boolean) =>
    dispatch({ type: "filters", value: { onlySaved: v } });
  const resetFilters = () => dispatch({ type: "reset-filters" });
  const found = points.filter(
    (p) =>
      (region === "전체" || p.region === region) &&
      (bodyRegion === "전체" || p.bodyRegion === bodyRegion) &&
      (catalogue === "all" || p.catalogue === catalogue) &&
      (meridian === "all" || p.meridian === meridian) &&
      (concept === "all" ||
        pointConcepts[p.id]?.categories.includes(concept)) &&
      (!onlySaved || saved.includes(p.id)) &&
      `${p.id} ${p.name} ${p.hanja} ${p.pinyin} ${p.landmarks.join(" ")} ${meridians.find((m) => m.id === p.meridian)?.name}`
        .toLowerCase()
        .includes(
          query
            .trim()
            .toLowerCase()
            .replace(/([a-z]+)\s+(\d+)/g, "$1$2"),
        ),
  );
  const camera = (kind: CameraAction["kind"]) => {
    setAction((a) => ({ kind, tick: a.tick + 1 }));
    if (kind === "focus" && state.markers === "hidden")
      dispatch({ type: "markers", value: "selected" });
  };
  const previousSex = useRef(state.sex);
  useEffect(() => {
    if (previousSex.current === state.sex) return;
    previousSex.current = state.sex;
    camera("fit");
  }, [state.sex]);
  const closePanel = () => {
    setPanel(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const openPanel = (name: typeof panel, button?: HTMLButtonElement) => {
    if (button) triggerRef.current = button;
    setPanel((current) => (current === name ? null : name));
  };
  useEffect(() => {
    if (panel) {
      const input = dockRef.current?.querySelector<HTMLElement>(
        "input:not([type=checkbox]),select,button",
      );
      input?.focus({ preventScroll: true });
    }
  }, [panel]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanel(null);
        triggerRef.current?.focus();
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const select = (p: Point) => {
    dispatch({ type: "point", id: p.id });
    navigate(`atlas/${p.id}`);
    setPanel(null);
  };
  const compare = () => {
    const c = pointConcepts[selected.id];
    if (!c?.organIds.length) return;
    if (state.sex === "female") dispatch({ type: "sex", value: "male" });
    dispatch({
      type: "compare",
      name: c.traditionalName || selected.name,
      ids: c.organIds,
    });
    setPanel(null);
    camera("comparison");
  };
  const onReady = useCallback(
    (l: Layer) => setLoaded((v) => (v.includes(l) ? v : [...v, l])),
    [],
  );
  useEffect(() => setLoaded([]), [state.sex]);
  const ready = layerKeys
    .filter((l) => state.layers[l])
    .every((l) => loaded.includes(l));
  const onPose = useCallback(
    (value: import("./view-state").CameraPose) =>
      dispatch({ type: "camera", value }),
    [dispatch],
  );
  const markers =
    state.markers === "hidden"
      ? []
      : state.markers === "selected"
        ? hasSelected
          ? [selected]
          : []
        : found;
  const names = {
    points: "경혈 찾기",
    layers: "레이어 조절",
    structures: "구조 찾기",
    detail: "경혈 상세",
    help: "도움말",
  };
  const layerCounts = useMemo(
    () =>
      Object.fromEntries(
        layerKeys.map((layer) => [
          layer,
          structures.filter((structure) => structure.layer === layer && structure.sex === state.sex).length,
        ]),
      ) as Record<Layer, number>,
    [state.sex],
  );
  const featuredAnatomy = state.sex === "female" ? [
    { name: "자궁", detail: "자궁몸통·자궁목", layer: "organ" as Layer, ids: ["HRA_F_organ_body_of_uterus", "HRA_F_organ_cervix_of_uterus"] },
    { name: "난소", detail: "왼쪽·오른쪽", layer: "organ" as Layer, ids: ["HRA_F_organ_ovary_l", "HRA_F_organ_ovary_r"] },
    { name: "유방", detail: "좌우 유선엽", layer: "skin" as Layer, ids: ["HRA_F_skin_lobes_of_mammary_gland_l", "HRA_F_skin_lobes_of_mammary_gland_r"] },
    { name: "콩팥", detail: "좌우 섬유피막", layer: "organ" as Layer, ids: ["HRA_F_organ_fibrous_capsule_of_kidney_l", "HRA_F_organ_fibrous_capsule_of_kidney_r"] },
    { name: "비장", detail: "표면·문 구조", layer: "lymph" as Layer, ids: structures.filter(s => s.sex === "female" && s.layer === "lymph").map(s => s.id) },
  ] : [
    {
      name: "뇌",
      detail: "대뇌·소뇌·뇌줄기",
      layer: "nerve" as Layer,
      ids: ["FMA62004", "FMA67943", "FMA67944", "FMA61822", "FMA61993nsn"],
    },
    { name: "심장", detail: "심장벽", layer: "organ" as Layer, ids: ["FMA7274"] },
    {
      name: "폐",
      detail: "좌우 5개 엽",
      layer: "organ" as Layer,
      ids: ["FMA7383", "FMA7333", "FMA7337", "FMA7370", "FMA7371"],
    },
    { name: "간", detail: "간", layer: "organ" as Layer, ids: ["FMA7197"] },
    { name: "위", detail: "위", layer: "organ" as Layer, ids: ["FMA7148"] },
    {
      name: "콩팥",
      detail: "왼쪽·오른쪽",
      layer: "organ" as Layer,
      ids: ["FMA7204", "FMA7205"],
    },
  ];
  const selectFeatured = (item: (typeof featuredAnatomy)[number]) => {
    dispatch({
      type: "select",
      layer: item.layer,
      selection: { kind: "bundle", ids: item.ids, name: item.name },
    });
    setPanel(null);
    requestAnimationFrame(() => camera("structure"));
  };
  const showAllSystems = () => {
    const available = state.sex === "female" ? femaleAvailableLayers : layerKeys;
    dispatch({
      type: "layers",
      layers: Object.fromEntries(layerKeys.map((layer) => [layer, available.includes(layer)])) as Layers,
    });
    setPanel(null);
    camera("fit");
  };
  const shiftDissection = (amount: number) => {
    if (state.sex === "female") return;
    const next = Math.max(0, Math.min(100, state.dissection + amount));
    if (next !== state.dissection)
      dispatch({ type: "dissection", value: next });
  };
  const selectedAnatomy = state.selection?.kind === "structure"
    ? structures.find((item) => item.id === state.selection?.ids[0])
    : null;
  return (
    <main
      className="anatomy-workspace"
      aria-label="인체 구조 탐색"
      data-panel={panel || "none"}
      onWheelCapture={(event) => {
        if (!event.altKey || Math.abs(event.deltaY) < 2) return;
        event.preventDefault();
        event.stopPropagation();
        shiftDissection(event.deltaY > 0 ? 2 : -2);
      }}
      onKeyDownCapture={(event) => {
        if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const step = event.shiftKey ? 10 : 2;
        shiftDissection(event.key === "ArrowDown" ? step : -step);
      }}
    >
      <section className="viewer-panel" aria-label="3D 해부도">
        <Suspense
          fallback={
            <div className="viewer-fallback">
              <LoaderCircle className="spin" />
              3D 뷰어 불러오는 중
            </div>
          }
        >
          <Atlas
            points={markers}
            selected={selected}
            onSelect={select}
            layers={state.layers}
            opacity={state.alpha.skin}
            labels={state.labels}
            action={action}
            onReady={onReady}
            selectedStructure={
              state.selection?.kind === "structure"
                ? state.selection.ids[0]
                : ""
            }
            onStructure={(id) => {
              const item = structures.find((s) => s.id === id);
              if (item)
                dispatch({
                  type: "select",
                  layer: item.layer,
                  region: item.bodyRegion && item.bodyRegion !== "whole" ? item.bodyRegion as ViewState["anatomyRegion"] : undefined,
                  selection: {
                    kind: "structure",
                    ids: [id],
                    name: item.label || item.name,
                  },
                });
            }}
            isolated={state.isolated}
            highlight={state.comparison?.ids || []}
            cutaway={state.cutaway}
            dissection={state.dissection}
            layerOpacity={state.alpha}
            selectionIds={state.selection?.ids || []}
            selectionTarget={state.selectionTarget}
            initialPose={state.camera}
            onPose={onPose}
            sex={state.sex}
            anatomyRegion={state.anatomyRegion}
          />
        </Suspense>
      </section>
      <aside className="explore-sidebar" aria-label="해부학 탐색">
        <div className="explore-heading">
          <span>3D ANATOMY ATLAS</span>
          <h1>해부 깊이 탐색</h1>
          <p>표층 구조를 한 겹씩 걷어 내부 관계를 확인하세요</p>
        </div>
        <button
          className="explore-search"
          onClick={(e) => openPanel("structures", e.currentTarget)}
          aria-label="구조 카탈로그 열기"
        >
          <Search size={18} />
          <span>구조 이름·FMA 검색</span>
          <kbd>/</kbd>
        </button>
        <div className="explore-scope" aria-label="인체 기준과 표시 부위">
          <div className="sex-switch" role="group" aria-label="인체 성별 기준">
            <button aria-pressed={state.sex === "male"} onClick={() => dispatch({ type: "sex", value: "male" })}>남성</button>
            <button aria-pressed={state.sex === "female"} onClick={() => dispatch({ type: "sex", value: "female" })}>여성</button>
          </div>
          <label>부위<select aria-label="전신 부위 선택" value={state.anatomyRegion} onChange={e => {
            const value = e.target.value as ViewState["anatomyRegion"];
            dispatch({ type: "anatomy-region", value });
            requestAnimationFrame(() => camera(value === "whole" ? "fit" : "anatomy-region"));
          }}>{Object.entries(anatomyRegionNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
          <small className="scope-source">{state.sex === "female" ? "NIH 여성 참조 · 264개 구조" : "남성 참조 · 림프 142개 포함"}</small>
        </div>
        <section
          className="depth-explorer"
          aria-label="인체 깊이 탐색"
          onWheel={(event) => {
            if (state.sex === "female") return;
            if (Math.abs(event.deltaY) < 8) return;
            event.preventDefault();
            const next = Math.max(0, Math.min(100, state.dissection + (event.deltaY > 0 ? 3 : -3)));
            if (next !== state.dissection) dispatch({ type: "dissection", value: next });
          }}
        >
          <div className="depth-heading">
            <span>연속 박리 깊이</span>
            <strong>{state.dissection}% · {state.dissection < 8 ? "체표" : state.dissection < 28 ? "표층 근육" : state.dissection < 50 ? "중간 근육" : state.dissection < 68 ? "심부 근육" : state.dissection < 82 ? "골격·장기" : state.dissection < 89 ? "혈관" : state.dissection < 94 ? "림프" : "신경"}</strong>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={state.dissection}
            disabled={state.sex === "female"}
            aria-label="연속 해부 박리 깊이"
            aria-valuetext={`${state.dissection}% 해부 깊이`}
            onWheelCapture={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const next = Math.max(0, Math.min(100, state.dissection + (event.deltaY > 0 ? 3 : -3)));
              if (next !== state.dissection) dispatch({ type: "dissection", value: next });
            }}
            onChange={(event) => dispatch({ type: "dissection", value: Number(event.target.value) })}
          />
          <div className="depth-steps" aria-hidden="true">
            {stages.map((stage, index) => (
              <span key={stage.layer} className={index === state.stage ? "active" : ""}>
                <i className={`layer-dot ${stage.layer}`} />
                {layerNames[stage.layer]}
              </span>
            ))}
          </div>
          <p>{state.sex === "female" ? "여성 참조는 수록된 계통 빠른 보기를 사용하세요" : "슬라이더·이 영역 휠 · 모델 위 Alt/⌥+휠 또는 Alt/⌥+↑↓"}</p>
        </section>
        <div className="explore-section-label">
          <span>계통 빠른 보기</span>
          <button onClick={showAllSystems}>전체 켜기</button>
        </div>
        <div className="explore-systems">
          {stages.map((stage, index) => (
            <button
              key={stage.layer}
              disabled={state.sex === "female" && !femaleAvailableLayers.includes(stage.layer)}
              aria-label={`${layerNames[stage.layer]} 빠른 보기`}
              aria-pressed={
                layerKeys.filter((layer) => state.layers[layer]).length === 1 &&
                state.layers[stage.layer]
              }
              onClick={() => dispatch({ type: "stage", index })}
            >
              <i className={`layer-dot ${stage.layer}`} />
              <span>
                <strong>{layerNames[stage.layer]}</strong>
                <small>
                  {stage.layer === "nerve"
                    ? "전신 525개 선택·설명"
                    : stage.layer === "vessel"
                      ? `${layerCounts[stage.layer]}개 선택·설명`
                      : stage.layer === "lymph"
                        ? `${layerCounts[stage.layer]}개 림프 구조`
                      : `${layerCounts[stage.layer]}개 구조`}
                </small>
              </span>
              <Eye size={16} />
            </button>
          ))}
        </div>
        <div className="explore-section-label"><span>주요 기관</span></div>
        <div className="featured-anatomy">
          {featuredAnatomy.map((item) => (
            <button key={item.name} onClick={() => selectFeatured(item)}>
              {item.name === "뇌" ? <Brain size={18} /> : <HeartPulse size={18} />}
              <span><strong>{item.name}</strong><small>{item.detail}</small></span>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
        <button className="all-anatomy-button" onClick={showAllSystems}>
          <Boxes size={18} />
          <span><strong>전체 인체 구조 보기</strong><small>7개 계통 · {structures.filter(s => s.sex === state.sex).length.toLocaleString()}개 구조</small></span>
        </button>
      </aside>
      <div className="scene-title">
        <span className="eyebrow">GYEOL / ANATOMY ATLAS</span>
        <h1>몸의 구조를 탐색하세요</h1>
        <p>{state.sex === "female" ? "NIH 여성 참조" : "BodyParts3D 남성 참조"} · 7개 계통 · {anatomyRegionNames[state.anatomyRegion]}</p>
      </div>
      <nav className="floating-tools" aria-label="해부 탐색 도구">
        {(["points", "layers", "structures", "help"] as const).map(
          (name, i) => (
            <button
              key={name}
              aria-label={names[name]}
              aria-expanded={panel === name}
              aria-controls="atlas-dock"
              onClick={(e) => openPanel(name, e.currentTarget)}
            >
              <span aria-hidden="true">
                {
                  [
                    <Search size={19} />,
                    <Layers3 size={19} />,
                    <Network size={19} />,
                    <CircleHelp size={19} />,
                  ][i]
                }
              </span>
              <span className="tool-name">{names[name]}</span>
            </button>
          ),
        )}
      </nav>
      <div className={`floating-point ${hasSelected ? "" : "empty"}`}>
        {hasSelected ? (
          <>
            <button
              className="point-summary"
              aria-expanded={panel === "detail"}
              onClick={(e) => openPanel("detail", e.currentTarget)}
            >
              <span>{selected.id}</span>
              <strong>{selected.name}</strong>
              <small>
                {pointConcepts[selected.id]?.categories
                  .map((id) => concepts.find((c) => c.id === id)?.name)
                  .join(" · ") || "일반 경혈"}
              </small>
              <ChevronRight size={16} />
            </button>
            <button aria-label="선택 경혈 확대" onClick={() => camera("focus")}>
              <Focus size={18} />
            </button>
          </>
        ) : (
          <button
            className="point-summary point-empty"
            onClick={(e) => openPanel("points", e.currentTarget)}
          >
            <Search size={17} />
            <strong>경혈 선택</strong>
            <small>검색하거나 표식을 선택하세요</small>
            <ChevronRight size={16} />
          </button>
        )}
      </div>
      {panel && (
        <div
          ref={dockRef}
          className={`floating-dock dock-${panel}`}
          id="atlas-dock"
          role="region"
          aria-label={names[panel]}
        >
          <div className="dock-header">
            <strong>{names[panel]}</strong>
            <button aria-label="도구 패널 닫기" onClick={closePanel}>
              <X size={19} />
            </button>
          </div>
          <div className="dock-body">
            {panel === "points" && (
              <aside className="filter-panel">
                <div className="filter-title">
                  <h2>경혈 탐색</h2>
                  <span>{points.length}</span>
                </div>
                <label className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="경혈 검색"
                    placeholder="이름, 코드, 해부 구조 검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      className="icon-button"
                      onClick={() => setQuery("")}
                      aria-label="검색 지우기"
                    >
                      <X size={13} />
                    </button>
                  )}
                </label>
                <div className="filter-switch">
                  <button
                    className={!onlySaved ? "active" : ""}
                    onClick={() => setOnlySaved(false)}
                  >
                    전체 경혈
                  </button>
                  <button
                    className={onlySaved ? "active" : ""}
                    onClick={() => setOnlySaved(true)}
                  >
                    <Bookmark size={13} />
                    저장한 경혈 <span>{saved.length}</span>
                  </button>
                </div>
                <label className="meridian-select">
                  <span>모델에서 볼 부위</span>
                  <select aria-label="모델 부위 선택" value={bodyRegion} onChange={(e) => {
                    dispatch({ type: "region-filter", value: e.target.value });
                    camera("region");
                  }}>
                    <option value="전체">전체 부위</option>
                    {[...new Set(points.map(p => p.bodyRegion))].map(r => <option key={r} value={r}>{r} · {points.filter(p => p.bodyRegion === r).length}</option>)}
                  </select>
                </label>
                <button className="show-filtered-button" disabled={!found.length} onClick={() => {
                  dispatch({ type: "show-filtered" }); camera("region"); setPanel(null);
                }}>필터 결과 {found.length}개를 모델에서 보기</button>
                <label className="meridian-select">
                  <span>경혈 분류</span>
                  <select
                    aria-label="경혈 분류"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                  >
                    <option value="all">전체 분류</option>
                    {concepts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ·{" "}
                        {
                          points.filter((p) =>
                            pointConcepts[p.id]?.categories.includes(c.id),
                          ).length
                        }
                        /{c.expectedTotal}
                      </option>
                    ))}
                  </select>
                </label>
                {concept !== "all" && (
                  <p className="concept-filter-note">
                    {concepts.find((c) => c.id === concept)?.description}
                  </p>
                )}
                <details className="point-filter-options">
                  <summary>
                    부위·경맥 필터
                    {region !== "전체" || meridian !== "all"
                      ? " · 적용 중"
                      : ""}
                  </summary>{" "}
                  <label className="meridian-select"><span>수록 범위</span><select aria-label="수록 범위" value={catalogue} onChange={e => dispatch({ type: "filters", value: { catalogue: e.target.value } })}>
                    <option value="all">전체 409개</option><option value="classical">정규 경혈 361개</option><option value="extra">경외기혈 48개</option>
                  </select></label>
                  <div className="filter-label">신체 부위</div>
                  <div className="region-chips">
                    {["전체", "머리·목", "몸통", "팔·손", "다리·발"].map(
                      (r) => (
                        <button
                          className={region === r ? "active" : ""}
                          key={r}
                          onClick={() => setRegion(r)}
                        >
                          {r}
                        </button>
                      ),
                    )}
                  </div>
                  <label className="meridian-select">
                    <span>경맥</span>
                    <select
                      aria-label="경맥 선택"
                      value={meridian}
                      onChange={(e) => setMeridian(e.target.value)}
                    >
                      <option value="all">14경맥 + 경외기혈</option>
                      {meridians.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.id})
                        </option>
                      ))}
                    </select>
                  </label>
                </details>{" "}
                <div className="list-header">
                  <span>{found.length}개의 경혈</span>
                  <button onClick={resetFilters} title="필터 초기화">
                    <RotateCcw size={12} />
                    초기화
                  </button>
                </div>
                <div className="point-list">
                  {found.map((p) => (
                    <button
                      key={p.id}
                      className={`point-item ${p.id === selected.id ? "active" : ""}`}
                      onClick={() => select(p)}
                      aria-pressed={p.id === selected.id}
                    >
                      <i
                        style={{
                          background: meridians.find((m) => m.id === p.meridian)
                            ?.color,
                        }}
                      />
                      <span>
                        <strong>
                          {p.name}
                          <small>{p.id}</small>
                        </strong>
                        <em>
                          {
                            meridians.find((m) => m.id === p.meridian)
                              ?.shortName
                          }{" "}
                          · {p.region}
                        </em>
                        <small className="classification-text">
                          {pointConcepts[p.id]?.categories
                            .map(
                              (id) => concepts.find((c) => c.id === id)?.name,
                            )
                            .join(" · ") || "일반 경혈"}
                        </small>
                      </span>
                      {saved.includes(p.id) ? (
                        <Bookmark size={14} />
                      ) : (
                        <ChevronRight size={15} />
                      )}
                    </button>
                  ))}
                  {!found.length && (
                    <div className="empty-state">
                      <Search size={23} />
                      <strong>
                        {onlySaved
                          ? "저장한 경혈이 없습니다"
                          : "일치하는 경혈이 없습니다"}
                      </strong>
                      <p>이름이나 경맥 필터를 바꿔 보세요.</p>
                      <button onClick={resetFilters}>전체 경혈 보기</button>
                    </div>
                  )}
                </div>
                <div className="coverage-note">
                  <Globe2 size={15} />
                  <span>
                    14개 경맥 · 경혈 {points.length}개
                    <small>정규 361경혈 + 표준 경외기혈 48개</small>
                  </span>
                </div>
              </aside>
            )}
            {(panel === "layers" || panel === "structures") && (
              <AnatomyControls
                mode={panel}
                state={state}
                dispatch={dispatch}
                onFocus={() => {
                  setPanel(null);
                  camera("structure");
                }}
                onRegion={(region) => camera(region === "whole" ? "fit" : "anatomy-region")}
              />
            )}
            {panel === "detail" && (
              <PointDetail
                point={selected}
                onFocus={() => {
                  setPanel(null);
                  camera("focus");
                }}
                saved={saved.includes(selected.id)}
                onSave={() => toggle(selected.id)}
                onCompare={compare}
              />
            )}
            {panel === "help" && (
              <div className="viewer-help">
                <h2>관찰에 집중하세요</h2>
                <p>
                  모델을 클릭한 뒤 W/S로 전진·후진, A/D로 좌우, Q/E로 아래·위로 이동합니다. Shift를 누르면 빠르게 이동합니다. 방향키도 사용할 수 있습니다. 드래그로 회전, 일반 휠·핀치로 확대·축소합니다. Alt/Option을 누른 채 휠을 돌리거나 ↑/↓를 누르면 연속 박리 깊이를 조절합니다. 두 손가락 또는 우클릭
                  드래그로 이동하세요. 경혈과 구조는 목록에서도 선택할 수
                  있습니다.
                </p>
                <p>
                  도구에 마우스를 올리거나 키보드 초점을 두면 이름이 나타납니다.
                  클릭·터치로 패널을 열고, Escape로 닫습니다.
                </p>
                <p>
                  계통 전환은 현재 시점과 표식 설정을 유지합니다. 보고 싶은
                  구조가 없으면 ‘계통 전체 보기’를 사용하세요.
                </p>
                <p>
                  표식은 체표 기준의 학습용 근사입니다. 장부 대응은 전통적
                  분류이며 압력 전달 경로가 아닙니다.
                </p>
                <p>{stages[state.stage].description}</p>
                <a href="#wiki/layer-guide">전체 탐색 가이드 ↗</a>
                <a href="#wiki/massage-anatomy">마사지 해부학 참고 ↗</a>
                <a href="#wiki/licenses">모델 출처·라이선스 ↗</a>
              </div>
            )}
          </div>
        </div>
      )}
      {state.selection && (
        <section className="selection-card" aria-label="선택 구조 조작">
          <div>
            <span className={`selection-kind ${state.selection.kind}`}>
              {state.selection.kind === "bundle"
                ? "전통 장부 비교"
                : "선택 구조"}
            </span>
            <strong>
              {state.selection.name}{" "}
              <small>{state.selection.ids.length}개 구조</small>
            </strong>
            {selectedAnatomy?.description && (
              <p className="selection-description">{selectedAnatomy.description}</p>
            )}
            {selectedAnatomy?.latin && (
              <small className="selection-latin">TA2 · {selectedAnatomy.latin}</small>
            )}
            {selectedAnatomy?.source && (
              <small className="selection-source">{selectedAnatomy.source} · 학습용 비진단 모델</small>
            )}
          </div>
          <div className="selection-actions">
            <button
              onClick={() => {
                setPanel(null);
                camera("structure");
              }}
            >
              확대
            </button>
            <button
              aria-pressed={state.isolated}
              onClick={() => dispatch({ type: "isolate" })}
            >
              {state.isolated
                ? "전체 구조 보기"
                : state.selection.kind === "bundle"
                  ? "비교 대상만 보기"
                  : "선택 구조만 보기"}
            </button>
            <button
              aria-label="구조 선택 해제"
              onClick={() => dispatch({ type: "clear-selection" })}
            >
              <X size={15} />
            </button>
          </div>
        </section>
      )}
      <div className="scene-legend">
        <span>
          <i className="legend-selected" />
          선택 구조
        </span>
        <span>
          <i className="legend-compare" />
          전통 장부 대응
        </span>
        <span>
          <i className="legend-reference" />
          경혈 참조
        </span>
      </div>
      {state.comparison && (
        <p className="comparison-note">
          {selected.name} · {state.comparison.name} 비교 — 전통적 대응, 압력
          경로 아님
        </p>
      )}
      <div className="movement-pad" aria-label="화면 이동">
        <span>이동 <small>WASD · Q/E</small></span>
        <div>{([
          ['move-up', '위로 이동', '↑'], ['move-forward', '앞으로 이동', '전진'], ['move-down', '아래로 이동', '↓'],
          ['move-left', '왼쪽으로 이동', '←'], ['move-backward', '뒤로 이동', '후진'], ['move-right', '오른쪽으로 이동', '→'],
        ] as const).map(([kind, label, text]) => <button key={kind} aria-label={label} title={label} onClick={() => camera(kind)}>{text}</button>)}</div>
      </div>
      <div className="navigation-hint">WASD 이동 · 휠 확대/축소 · Alt/⌥+휠 박리</div>
      <div className="view-tools">
        <button aria-label="확대" onClick={() => camera("zoomIn")}>
          <Plus size={18} /><span className="view-action-label">확대</span>
        </button>
        <button aria-label="축소" onClick={() => camera("zoomOut")}>
          <Minus size={18} /><span className="view-action-label">축소</span>
        </button>
        <button
          aria-label="계통 전체 보기"
          title="계통 전체 보기"
          onClick={() => camera("fit")}
        >
          <Focus size={18} />
        </button>
        <button aria-label="시점 초기화" onClick={() => camera("reset")}>
          <RotateCcw size={17} />
        </button>
      </div>
      <div className="view-presets">
        {(["front", "back", "side"] as const).map((v, i) => (
          <button key={v} onClick={() => camera(v)}>
            {["정면", "후면", "측면"][i]}
          </button>
        ))}
      </div>
      <div className="scene-status">
        <span className={`status-dot ${ready ? "live" : ""}`} />
        <span role="status">
          {!layerKeys.some((l) => state.layers[l])
            ? "레이어를 켜서 구조를 표시하세요"
            : ready
              ? "해부 모델 로드 완료"
              : "해부 모델 준비 중"}
        </span>
        <span className="click-target">
          선택 대상:{" "}
          {state.selectionTarget === "internal"
            ? "내부 구조"
            : state.selectionTarget === "skin"
              ? "체표"
              : "보이는 구조"}
        </span>
      </div>
      {state.cutaway > 0 && (
        <button
          className="cutaway-reset"
          onClick={() => dispatch({ type: "cutaway", value: 0 })}
        >
          앞쪽 구조 숨김 적용 · 초기화
        </button>
      )}
      <a className="scene-guide" href="#wiki/massage-anatomy">
        학습용 근사 · 근거 읽기 ↗
      </a>
    </main>
  );
}
interface Answer {
  mode: string;
  message?: string;
  answer?: { text: string; citations: string[] }[];
  documents: { id: string; title: string }[];
  providerError?: boolean;
}
function WikiAssistant() {
  const [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<Answer | null>(null),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    controller.current = new AbortController();
    try {
      if (import.meta.env.VITE_STATIC_MODE === "true") {
        setResult(createKnowledge(docs, points).fallback(question));
        return;
      }
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.current.signal,
      });
      if (!r.ok)
        throw Error(
          r.status === 429
            ? "잠시 후 다시 질문해 주세요."
            : "위키 검색 서버에 연결할 수 없습니다.",
        );
      setResult(await r.json());
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="wiki-assistant">
      <div className="assistant-title">
        <Sparkles size={20} />
        <h2>위키에 물어보기</h2>
        <span>출처와 함께</span>
      </div>
      <p>경혈의 위치, 해부학적 기준점, 자료의 근거를 찾아보세요.</p>
      <form onSubmit={submit}>
        <input
          aria-label="위키 질문"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={1000}
          placeholder="족삼리는 어떤 해부 구조와 연결되나요?"
          required
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          aria-label="질문 보내기"
        >
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <ArrowUp size={18} />
          )}
        </button>
      </form>
      <div className="question-examples">
        {["족삼리 위치", "내관과 외관", "B-cun이란?"].map((q) => (
          <button key={q} onClick={() => setQuestion(q)}>
            {q}
            <Plus size={12} />
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {result && (
          <div className="answer">
            <span className="answer-mode">
              {result.mode === "llm"
                ? "LLM 요약 · 검증이 필요한 생성 답변"
                : result.mode === "retrieval"
                  ? "위키 검색 · 생성형 답변 아님"
                  : "자료 안내"}
            </span>
            {result.message && <p>{result.message}</p>}
            {result.providerError && (
              <p className="muted small">
                LLM 연결을 사용할 수 없어 위키 검색 결과를 표시합니다.
              </p>
            )}
            {result.answer?.map((a, i) => (
              <div key={i}>
                <p>{a.text}</p>
                <div className="answer-citations">
                  {a.citations.map((id) => (
                    <a href={`#wiki/${id}`} key={id}>
                      <BookOpen size={12} />
                      {docs.find((d) => d.id === id)?.title || id}
                    </a>
                  ))}
                </div>
              </div>
            ))}
            {result.documents.length > 0 && (
              <div className="retrieved-docs">
                {result.documents.map((d) => (
                  <a key={d.id} href={`#wiki/${d.id}`}>
                    {d.title}
                    <ArrowUpRight size={13} />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <small className="assistant-note">
        기본은 저장된 위키 검색입니다. 서버에 로컬 LLM을 연결하면 근거 문서로
        요약합니다.
      </small>
    </section>
  );
}
function WikiPage({ docId }: { docId?: string }) {
  const [query, setQuery] = useState("");
  const d = docs.find((d) => d.id === docId);
  const filtered = docs.filter((d) =>
    `${d.title} ${d.category} ${d.body}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="wiki-layout">
      <a className="atlas-return" href={returnToAtlas()}>
        ← {points.find((p) => p.id === readView().pointId)?.name || "인체"} 3D
        보기로 돌아가기
      </a>
      <aside className="wiki-sidebar">
        <div className="eyebrow">GYEOL KNOWLEDGE</div>
        <h2>
          지식 위키<span>{docs.length}</span>
        </h2>
        <label className="search-box">
          <Search size={16} />
          <input
            placeholder="위키 문서 검색"
            aria-label="위키 문서 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <a className={!docId ? "wiki-nav active" : "wiki-nav"} href="#wiki">
          <BookOpen size={16} />
          위키 둘러보기
        </a>
        {[
          "시작하기",
          "학습 가이드",
          "경혈 이론",
          "기초 개념",
          "근거 읽기",
          "데이터 방법론",
          "프로젝트",
          "기술 조사",
          "경혈",
        ].map((c) => {
          const items = filtered.filter((d) => d.category === c);
          return items.length ? (
            <div className="wiki-nav-group" key={c}>
              <span>{c}</span>
              {items.map((x) => (
                <a
                  href={`#wiki/${x.id}`}
                  className={`wiki-nav ${docId === x.id ? "active" : ""}`}
                  key={x.id}
                >
                  {x.title}
                  <ChevronRight size={13} />
                </a>
              ))}
            </div>
          ) : null;
        })}
        {!filtered.length && <p className="muted">검색 결과가 없습니다.</p>}
        <a className="wiki-download" href={assetUrl("llms.txt")} target="_blank">
          <Download size={14} />
          LLM용 문서 인덱스
        </a>
      </aside>
      <main className="wiki-main">
        {docId && !d ? (
          <div className="empty-state">
            <h1>문서를 찾지 못했습니다</h1>
            <a href="#wiki">위키 목록으로 돌아가기</a>
          </div>
        ) : d ? (
          <>
            <div className="breadcrumb">
              <a href="#wiki">지식 위키</a>
              <ChevronRight size={13} />
              <span>{d.category}</span>
            </div>
            <div className="article-meta">
              <span>AI 작성 · 전문가 미검수</span>
              <span>{d.updated}</span>
              <a href={assetUrl(`wiki/${d.id}.md`)} download>
                Markdown <Download size={13} />
              </a>
            </div>
            <article className="prose">
              <Markdown remarkPlugins={[remarkGfm]} urlTransform={(url) => { const safe = defaultUrlTransform(url); return safe.startsWith("/") && !safe.startsWith("//") ? assetUrl(safe) : safe; }}>{d.body}</Markdown>
            </article>
            <div className="backlinks">
              <h3>
                <Network size={17} />이 문서를 참조하는 지식
              </h3>
              {d.backlinks.length ? (
                d.backlinks.map((id) => (
                  <a key={id} href={`#wiki/${id}`}>
                    {docs.find((d) => d.id === id)?.title}
                    <ArrowUpRight size={13} />
                  </a>
                ))
              ) : (
                <p className="muted">아직 역링크가 없습니다.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="eyebrow">A LIVING, SOURCE-GROUNDED WIKI</div>
            <h1 className="wiki-title">
              연결하며 이해하는
              <br />
              우리 몸의 지식<span>.</span>
            </h1>
            <p className="wiki-lead">
              경혈의 이름에서 해부학적 기준점까지.
              <br />
              모든 설명의 출처와 한계를 함께 살펴보세요.
            </p>
            <div className="wiki-stats">
              <span>
                <strong>{points.length}</strong>경혈 문서
              </span>
              <span>
                <strong>{docs.filter((d) => !d.pointId).length}</strong>주제
                가이드
              </span>
              <span>
                <strong>14</strong>경맥 체계
              </span>
            </div>
            <WikiAssistant />
            <h2 className="section-heading">
              먼저 읽어보세요<span>START HERE</span>
            </h2>
            <div className="wiki-cards">
              {docs
                .filter((d) => d.category !== "경혈")
                .map((d, i) => (
                  <a href={`#wiki/${d.id}`} key={d.id}>
                    <span className="card-number">0{i + 1}</span>
                    <span className="card-category">{d.category}</span>
                    <h3>{d.title}</h3>
                    <ArrowUpRight size={19} />
                  </a>
                ))}
            </div>
            <h2 className="section-heading">
              경혈 사전<span>ACUPOINT INDEX</span>
            </h2>
            <div className="point-dictionary">
              {points.map((p) => (
                <a key={p.id} href={`#wiki/points/${p.id}`}>
                  <span
                    style={{
                      color: meridians.find((m) => m.id === p.meridian)?.color,
                    }}
                  >
                    {p.id}
                  </span>
                  {p.name}
                  <small>{p.hanja}</small>
                  <ChevronRight size={14} />
                </a>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
function SourcesPage() {
  return (
    <div className="sources-page">
      <div className="eyebrow">TRACEABLE BY DESIGN</div>
      <h1>지식의 시작, 출처.</h1>
      <p className="wiki-lead">
        위치 표준, 임상 근거, 3D 모델을 구분해 기록합니다.
        <br />
        자료별 열람일은 각 출처에 표시됩니다
      </p>
      <div className="source-cards">
        {sources.map((s, i) => (
          <article key={s.id}>
            <div className="source-card-top">
              <span>0{i + 1}</span>
              <span>{s.kind}</span>
            </div>
            <h2>{s.title}</h2>
            <div className="muted small">
              {s.publisher} · {s.year}
            </div>
            <p>{s.note}</p>
            <a href={s.url} target="_blank" rel="noreferrer">
              원문 열기
              <ArrowUpRight size={16} />
            </a>
            {s.accessUrl && (
              <a href={s.accessUrl} target="_blank" rel="noreferrer">
                대조한 재현본
                <ArrowUpRight size={16} />
              </a>
            )}
          </article>
        ))}
      </div>
      <div className="source-footer">
        <h2>함께 확인할 문서</h2>
        <a href="#wiki/library-comparison">
          라이브러리 비교와 기술 선택
          <ArrowUpRight size={17} />
        </a>
        <a href="#wiki/licenses">
          라이선스와 재배포 조건
          <ArrowUpRight size={17} />
        </a>
        <a href={assetUrl("models/manifest.json")}>
          모델 파일별 출처와 변환 이력
          <ArrowUpRight size={17} />
        </a>
      </div>
    </div>
  );
}
export default function App() {
  const route = useRoute();
  const { saved, toggle } = useBookmarks();
  const [viewState, dispatch] = useReducer(viewReducer, undefined, readView);
  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_KEY, JSON.stringify(viewState));
    } catch {}
  }, [viewState]);

  const view = route.startsWith("wiki")
    ? "wiki"
    : route === "sources"
      ? "sources"
      : "atlas";
  useEffect(() => {
    if (view === "atlas") {
      const id = route.split("/")[1] || viewState.pointId;
      if (points.some((p) => p.id === id)) dispatch({ type: "point", id });
    }
  }, [route, view]);
  useEffect(() => {
    document.title = `${view === "wiki" ? "지식 위키" : view === "sources" ? "출처와 자료" : "3D 경혈 지도"} — 결 GYEOL`;
  }, [view]);
  return (
    <>
      <header className="site-header">
        <Logo />
        <nav aria-label="주 메뉴">
          <a
            className={view === "atlas" ? "active" : ""}
            href={viewState.pointId ? `#atlas/${viewState.pointId}` : "#atlas"}
          >
            <Layers3 size={16} />
            3D 경혈 지도
          </a>
          <a className={view === "wiki" ? "active" : ""} href="#wiki">
            <BookOpen size={16} />
            지식 위키
          </a>
          <a className={view === "sources" ? "active" : ""} href="#sources">
            <Globe2 size={16} />
            출처와 자료
          </a>
        </nav>
        <a className="header-about" href="#wiki/library-comparison">
          오픈 아틀라스
          <ArrowUpRight size={15} />
        </a>
      </header>
      <div className={`app-shell ${view}`}>
        {view === "atlas" ? (
          <AtlasPage
            id={route.split("/")[1] || ""}
            saved={saved}
            toggle={toggle}
            state={viewState}
            dispatch={dispatch}
          />
        ) : view === "wiki" ? (
          <WikiPage docId={route.slice(5) || undefined} />
        ) : (
          <SourcesPage />
        )}
      </div>
      <footer className="site-footer">
        <span>
          結 <strong>GYEOL</strong> <span>몸의 구조와 지식의 연결</span>
        </span>
        <p>
          BodyParts3D © DBCLS ·{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/2.1/jp/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY-SA 2.1 JP
          </a>
        </p>
        <a href="#wiki/reading-guide">
          학습용 오픈 아틀라스
          <ArrowUpRight size={13} />
        </a>
      </footer>
    </>
  );
}
