import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useReducer,
  type FormEvent,
} from "react";
import {
  Search,
  ArrowUpRight,
  BookOpen,
  Layers3,
  Globe2,
  LoaderCircle,
  PersonStanding,
} from "lucide-react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import { assetUrl } from "./assets";
import { createKnowledge } from "../shared/knowledge.mjs";
import remarkGfm from "remark-gfm";
import { initialView, restoreView, viewReducer } from "./view-state";
import { structures } from "./anatomy";
import { parseStructureLink, requestFocus } from "./movement-link";
import { useMedia } from "./use-media";

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
import pointData from "../data/points.json";
import meridians from "../data/meridians.json";
import sources from "../data/sources.json";
import wikiData from "../data/wiki.json";
import type { Point, WikiDoc } from "./types";
import AtlasPage from "./AtlasPage";
// The movement page draws 2D diagrams only; like the wiki it never loads the
// 3D viewer or any GLB (Q9).
const MovementPage = lazy(() => import("./MovementPage"));
const points = pointData as Point[],
  docs = wikiData as WikiDoc[];
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
    <section className="wiki-section wiki-assistant" aria-labelledby="wiki-ask-heading">
      <h2 id="wiki-ask-heading">질문으로 문서 찾기</h2>
      <p className="assistant-note">
        기본은 저장된 위키 검색입니다. 서버에 로컬 LLM을 연결하면 근거 문서로
        요약합니다.
      </p>
      <form onSubmit={submit}>
        <input
          aria-label="위키 질문"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={1000}
          placeholder="예: 족삼리 위치"
          required
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          aria-label="질문 보내기"
        >
          {busy && <LoaderCircle className="spin" size={16} />}
          질문 보내기
        </button>
      </form>
      <p className="question-examples">
        <span>예시</span>
        {["족삼리 위치", "내관과 외관", "B-cun이란?"].map((q) => (
          <button type="button" key={q} onClick={() => setQuestion(q)}>
            {q}
          </button>
        ))}
      </p>
      <div aria-live="polite">
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {result && (
          <div className="answer">
            <p className="answer-mode">
              {result.mode === "llm"
                ? "LLM 요약 · 검증이 필요한 생성 답변"
                : result.mode === "retrieval"
                  ? "위키 검색 · 생성형 답변 아님"
                  : "자료 안내"}
            </p>
            {result.message && <p>{result.message}</p>}
            {result.providerError && (
              <p className="muted small">
                LLM 연결을 사용할 수 없어 위키 검색 결과를 표시합니다.
              </p>
            )}
            {result.answer?.map((a, i) => (
              <div key={i}>
                <p>{a.text}</p>
                <ul className="answer-citations">
                  {a.citations.map((id) => (
                    <li key={id}>
                      <a href={`#wiki/${id}`}>
                        {docs.find((d) => d.id === id)?.title || id}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {result.documents.length > 0 && (
              <ul className="retrieved-docs">
                {result.documents.map((d) => (
                  <li key={d.id}>
                    <a href={`#wiki/${d.id}`}>{d.title}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
const CATEGORIES = ["시작하기", "학습 가이드", "경혈 이론", "기초 개념", "근거 읽기", "데이터 방법론", "프로젝트", "기술 조사", "경혈"];
const categories = [...new Set([...CATEGORIES, ...docs.map((d) => d.category)])];
const meridianColor = new Map(meridians.map((m) => [m.id, m.color]));
const pointDocCount = docs.filter((d) => d.pointId).length;
const guides = docs
  .filter((d) => !d.pointId)
  .sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category));
// The home status line repeats the stored review state instead of a fixed label.
const unreviewed = docs.filter((d) => d.reviewStatus.includes("미검수")).length;
const reviewSummary =
  unreviewed === docs.length
    ? docs.every((d) => d.reviewStatus.startsWith("AI"))
      ? "AI가 작성·편집한 초안이며 전문가 검수 전입니다"
      : "모든 문서가 전문가 검수 전입니다"
    : `전문가 검수 전 문서 ${unreviewed}개`;
function PointRow({ p }: { p: Point }) {
  return (
    <li>
      <a href={`#wiki/points/${p.id}`}>
        <i
          className="meridian-swatch"
          style={{ background: meridianColor.get(p.meridian) }}
          aria-hidden="true"
        />
        <span className="point-code">{p.id}</span>{" "}
        <span className="point-name">{p.name}</span>{" "}
        <span className="point-hanja">{p.hanja}</span>
      </a>
    </li>
  );
}
function WikiPage({ docId, saved }: { docId?: string; saved: string[] }) {
  const [query, setQuery] = useState(""),
    [listOpen, setListOpen] = useState(false);
  const wide = useMedia("(min-width: 701px)");
  const d = docs.find((d) => d.id === docId);
  const q = query.trim().toLowerCase();
  const filtered = docs.filter((d) =>
    `${d.title} ${d.category} ${d.body}`.toLowerCase().includes(q),
  );
  const savedPoints = saved
    .map((id) => points.find((p) => p.id === id))
    .filter((p): p is Point => Boolean(p));
  // A new document starts at its title; on phones the open list folds away.
  useEffect(() => {
    setListOpen(false);
    scrollTo(0, 0);
  }, [docId]);
  return (
    <div className="wiki-layout">
      <a className="atlas-return" href={returnToAtlas()}>
        ← {points.find((p) => p.id === readView().pointId)?.name || "인체"} 3D
        보기로 돌아가기
      </a>
      <aside className="wiki-sidebar" aria-label="위키 문서 목록">
        <label className="search-box">
          <Search size={16} aria-hidden="true" />
          <input
            placeholder="위키 문서 검색"
            aria-label="위키 문서 검색"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim()) setListOpen(true);
            }}
          />
        </label>
        <details
          className="wiki-toc"
          open={wide || listOpen}
          onToggle={(e) => {
            if (!wide) setListOpen(e.currentTarget.open);
          }}
        >
          <summary>
            문서 목록{" "}
            <span>{q ? `검색 결과 ${filtered.length}개` : `${docs.length}개`}</span>
          </summary>
          <a
            className="wiki-nav"
            href="#wiki"
            aria-current={!docId ? "page" : undefined}
          >
            위키 처음 화면
          </a>
          {categories.map((c) => {
            const items = filtered.filter((d) => d.category === c);
            return items.length ? (
              <div className="wiki-nav-group" key={c}>
                <p className="wiki-nav-label">{c}</p>
                <ul>
                  {items.map((x) => (
                    <li key={x.id}>
                      <a
                        href={`#wiki/${x.id}`}
                        className="wiki-nav"
                        aria-current={docId === x.id ? "page" : undefined}
                      >
                        {x.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null;
          })}
          {!filtered.length && <p className="muted">검색 결과가 없습니다.</p>}
          <a className="wiki-download" href={assetUrl("llms.txt")} target="_blank">
            LLM용 문서 인덱스
          </a>
        </details>
      </aside>
      <main className="wiki-main">
        {docId && !d ? (
          <div className="wiki-missing">
            <h1>문서를 찾지 못했습니다</h1>
            <p>
              <a href="#wiki">위키 처음 화면으로 돌아가기</a>
            </p>
          </div>
        ) : d ? (
          <>
            <nav className="breadcrumb" aria-label="문서 위치">
              <a href="#wiki">지식 위키</a>
              <span aria-hidden="true">/</span>
              <span>{d.category}</span>
            </nav>
            <p className="article-meta">
              <span>{d.reviewStatus}</span>
              <span>{d.updated} 갱신</span>
            </p>
            <p className="article-actions">
              {d.pointId && (
                <a href={`#atlas/${d.pointId}`}>이 경혈을 3D에서 보기</a>
              )}
              <a href={assetUrl(`wiki/${d.id}.md`)} download>
                Markdown 내려받기
              </a>
            </p>
            <article className="prose">
              <Markdown remarkPlugins={[remarkGfm]} urlTransform={(url) => { const safe = defaultUrlTransform(url); return safe.startsWith("/") && !safe.startsWith("//") ? assetUrl(safe) : safe; }}>{d.body}</Markdown>
            </article>
            <section className="backlinks" aria-labelledby="backlinks-heading">
              <h2 id="backlinks-heading">이 문서를 참조하는 문서</h2>
              {d.backlinks.length ? (
                <ul>
                  {d.backlinks.map((id) => (
                    <li key={id}>
                      <a href={`#wiki/${id}`}>
                        {docs.find((d) => d.id === id)?.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">아직 역링크가 없습니다.</p>
              )}
            </section>
          </>
        ) : (
          <>
            <h1 className="wiki-home-title">지식 위키</h1>
            <p className="wiki-status">
              경혈 문서 {pointDocCount}개 · 주제 가이드 {guides.length}개 ·{" "}
              {reviewSummary}
            </p>
            {savedPoints.length > 0 && (
              <section className="wiki-section wiki-saved" aria-labelledby="wiki-saved-heading">
                <h2 id="wiki-saved-heading">저장한 경혈</h2>
                <ul className="point-index">
                  {savedPoints.map((p) => (
                    <PointRow key={p.id} p={p} />
                  ))}
                </ul>
              </section>
            )}
            <section className="wiki-section" aria-labelledby="wiki-start-heading">
              <h2 id="wiki-start-heading">처음 읽을 문서</h2>
              <ul className="doc-list">
                {guides.map((x) => (
                  <li key={x.id}>
                    <a href={`#wiki/${x.id}`}>
                      <span className="doc-category">{x.category}</span>{" "}
                      <span className="doc-title">{x.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
            <WikiAssistant />
            <section className="wiki-section" aria-labelledby="wiki-index-heading">
              <h2 id="wiki-index-heading">경혈 사전</h2>
              <ul className="point-index">
                {points.map((p) => (
                  <PointRow key={p.id} p={p} />
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
// Year cells sometimes hold only an access date ("열람 2026-09-16"); show it as the
// access date and never invent a publication year.
function sourceDates(s: { year: string; accessed?: string }) {
  const viewedOnly = s.year.startsWith("열람");
  return {
    issued: viewedOnly ? "" : s.year,
    accessed:
      s.accessed ||
      (viewedOnly ? s.year.match(/\d{4}-\d{2}-\d{2}/)?.[0] : "") ||
      "",
  };
}
function SourcesPage() {
  return (
    <main className="sources-page">
      <h1>출처와 자료</h1>
      <p className="doc-lead">
        위치·명칭 표준, 근거 개요, 전통 문헌, 3D 모델을 구분해 기록합니다. 위치
        표준은 치료 효과의 근거가 아닙니다.
      </p>
      <div className="source-cards">
        {sources.map((s) => {
          const { issued, accessed } = sourceDates(s);
          return (
            <article key={s.id} aria-labelledby={`source-${s.id}`}>
              <p className="source-kind">{s.kind}</p>
              <div className="source-body">
                <h2 id={`source-${s.id}`}>{s.title}</h2>
                <p className="source-publisher">{s.publisher}</p>
                {(issued || accessed) && (
                  <dl className="source-dates">
                    {issued && (
                      <div>
                        <dt>발행·버전</dt>
                        <dd>{issued}</dd>
                      </div>
                    )}
                    {accessed && (
                      <div>
                        <dt>열람</dt>
                        <dd>{accessed}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <p className="source-note">{s.note}</p>
                <p className="source-links">
                  <a href={s.url} target="_blank" rel="noreferrer">
                    원문 열기
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                  {s.accessUrl && (
                    <a href={s.accessUrl} target="_blank" rel="noreferrer">
                      대조한 재현본
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  )}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <section className="source-footer" aria-labelledby="source-more-heading">
        <h2 id="source-more-heading">함께 확인할 문서</h2>
        <ul>
          <li>
            <a href="#wiki/library-comparison">라이브러리 비교와 기술 선택</a>
          </li>
          <li>
            <a href="#wiki/licenses">라이선스와 재배포 조건</a>
          </li>
          <li>
            <a href={assetUrl("models/manifest.json")}>
              모델 파일별 출처와 변환 이력
            </a>
          </li>
        </ul>
      </section>
    </main>
  );
}
// Hash routes own the URL fragment, so the skip control moves focus itself.
function skipToMain() {
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return;
  if (!main.hasAttribute("tabindex")) {
    main.setAttribute("tabindex", "-1");
    main.addEventListener("blur", () => main.removeAttribute("tabindex"), {
      once: true,
    });
  }
  main.focus();
}
export default function App() {
  const route = useRoute();
  const { saved, toggle } = useBookmarks();
  const [viewState, dispatch] = useReducer(viewReducer, undefined, readView);
  const [linkNotice, setLinkNotice] = useState("");
  useEffect(() => { if (!route.startsWith("atlas")) setLinkNotice(""); }, [route]);
  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_KEY, JSON.stringify(viewState));
    } catch {}
  }, [viewState]);

  const view = route.startsWith("wiki")
    ? "wiki"
    : route === "sources"
      ? "sources"
      : route === "movement" || route.startsWith("movement/")
        ? "movement"
        : "atlas";
  const structureLink = view === "atlas" ? parseStructureLink(route) : null;
  const atlasId = structureLink ? viewState.pointId : route.split("/")[1] || viewState.pointId;
  useEffect(() => {
    if (view !== "atlas") return;
    // A movement-page link opens its structures once, then the address goes
    // back to the acupoint view so a reload only restores the saved state.
    const link = structureLink;
    if (link) {
      const found = link.ids.map((id) => structures.find((s) => s.id === id && s.sex === link.sex));
      setLinkNotice(found.every(Boolean) ? "" : "동작 역학에서 연 구조를 이 모델에서 찾지 못해 열지 않았습니다. 동작 페이지에서 다른 모델로 여는 링크를 확인하세요.");
      if (found.every(Boolean)) {
        if (link.sex !== viewState.sex) dispatch({ type: "sex", value: link.sex });
        const layers = [...new Set(found.map((s) => s!.layer))];
        const regions = [...new Set(found.map((s) => s!.bodyRegion || "whole"))];
        const names = [...new Set(found.map((s) => (s!.label || s!.name).replace(/^(오른쪽|왼쪽) /, "")))];
        requestFocus(link.ids);
        dispatch({
          type: "open-structures", ids: link.ids, layers,
          name: link.name || (names.length === 1 ? (found.length > 1 ? `${names[0]} (좌우)` : found[0]!.label || found[0]!.name) : names.join(" · ")),
          region: regions.length === 1 && regions[0] !== "whole" ? (regions[0] as typeof viewState.anatomyRegion) : undefined,
        });
      }
      history.replaceState(history.state, "", viewState.pointId ? `#atlas/${viewState.pointId}` : "#atlas");
      dispatchEvent(new HashChangeEvent("hashchange"));
      return;
    }
    if (points.some((p) => p.id === atlasId)) dispatch({ type: "route-point", id: atlasId });
  }, [route, view]);
  useEffect(() => {
    document.title = `${view === "wiki" ? "지식 위키" : view === "sources" ? "출처와 자료" : view === "movement" ? "동작 역학" : "3D 경혈 지도"} — 결 GYEOL`;
  }, [view]);
  return (
    <>
      <header className="site-header">
        <button type="button" className="skip-link" onClick={skipToMain}>
          본문으로 건너뛰기
        </button>
        <Logo />
        <nav aria-label="주 메뉴">
          <a
            className={view === "atlas" ? "active" : ""}
            href={viewState.pointId ? `#atlas/${viewState.pointId}` : "#atlas"}
          >
            <Layers3 size={16} />
            3D 경혈 지도
          </a>
          <a
            className={view === "movement" ? "active" : ""}
            href="#movement"
            aria-label="동작 역학"
          >
            <PersonStanding size={16} />
            <span className="nav-long">동작 역학</span>
            <span className="nav-short" aria-hidden="true">
              동작
            </span>
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
            id={atlasId}
            saved={saved}
            toggle={toggle}
            state={viewState}
            dispatch={dispatch}
            navigate={navigate}
            notice={linkNotice}
            onNotice={() => setLinkNotice("")}
          />
        ) : view === "wiki" ? (
          <WikiPage docId={route.slice(5) || undefined} saved={saved} />
        ) : view === "movement" ? (
          <Suspense
            fallback={
              <main className="movement-page" aria-busy="true">
                <p className="doc-lead">동작 역학 불러오는 중</p>
              </main>
            }
          >
            <MovementPage route={route} sex={viewState.sex} />
          </Suspense>
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
