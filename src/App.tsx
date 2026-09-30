import {
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
  ChevronRight,
  Plus,
  ArrowUp,
  LoaderCircle,
  Network,
  Download,
  Sparkles,
} from "lucide-react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import { assetUrl } from "./assets";
import { createKnowledge } from "../shared/knowledge.mjs";
import remarkGfm from "remark-gfm";
import { initialView, restoreView, viewReducer } from "./view-state";
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
import pointData from "../data/points.json";
import meridians from "../data/meridians.json";
import sources from "../data/sources.json";
import wikiData from "../data/wiki.json";
import type { Point, WikiDoc } from "./types";
import AtlasPage from "./AtlasPage";
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
      if (points.some((p) => p.id === id)) dispatch({ type: "route-point", id });
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
            navigate={navigate}
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
