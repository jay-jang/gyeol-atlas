import { useState, type Dispatch } from "react";
import { layerKeys, layerNames, stages, structures } from "./anatomy";
import type { ViewState, ViewAction } from "./view-state";
export default function AnatomyControls({
  mode,
  state,
  dispatch,
  onFocus,
}: {
  mode: "layers" | "structures";
  state: ViewState;
  dispatch: Dispatch<ViewAction>;
  onFocus: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.toLowerCase().trim();
  const results = structures.filter((s) =>
    `${s.label} ${s.name} ${s.id} ${s.fmaId || ""} ${s.latin || ""} ${(s.hierarchy || []).join(" ")}`
      .toLowerCase()
      .includes(normalizedQuery),
  ).sort((a, b) => {
    const score = (s: (typeof structures)[number]) => {
      const direct = [s.label, s.name, s.id, s.fmaId || ""].map((value) => (value || "").toLowerCase());
      if (direct.some((value) => value === normalizedQuery)) return 0;
      if (direct.some((value) => value.startsWith(normalizedQuery))) return 1;
      if (direct.some((value) => value.includes(normalizedQuery))) return 2;
      return 3;
    };
    return score(a) - score(b) || (a.label || a.name).localeCompare(b.label || b.name);
  });
  const visibleResults = results.slice(0, 240);
  return mode === "layers" ? (
    <div className="layer-settings">
      <p className="control-hint">
        계통을 조합해 같은 부위를 비교하세요. 현재 시점은 유지됩니다.
      </p>
      {layerKeys.map((l) => (
        <div className="layer-row" key={l}>
          <label>
            <input
              type="checkbox"
              aria-label={`${layerNames[l]} 레이어`}
              checked={state.layers[l]}
              onChange={(e) =>
                dispatch({
                  type: "layers",
                  layers: { ...state.layers, [l]: e.target.checked },
                })
              }
            />
            <i className={`layer-dot ${l}`} />
            {layerNames[l]}
          </label>
          <input
            type="range"
            aria-label={`${layerNames[l]} 레이어 불투명도`}
            min="0.05"
            max="1"
            step="0.01"
            value={state.alpha[l]}
            disabled={!state.layers[l]}
            onChange={(e) =>
              dispatch({
                type: "alpha",
                layer: l,
                value: Number(e.target.value),
              })
            }
          />
          <output>{Math.round(state.alpha[l] * 100)}%</output>
        </div>
      ))}
      <p className="coverage-description">{stages[state.stage].description}</p>
      <label className="setting-select">
        경혈 표식
        <select
          aria-label="경혈 표식"
          value={state.markers}
          onChange={(e) =>
            dispatch({
              type: "markers",
              value: e.target.value as ViewState["markers"],
            })
          }
        >
          <option value="hidden">숨김</option>
          <option value="selected">선택 경혈만</option>
          <option value="filtered">필터 결과 전체</option>
        </select>
      </label>
      <label className="setting-check">
        <input
          type="checkbox"
          checked={state.labels}
          onChange={(e) =>
            dispatch({ type: "labels", value: e.target.checked })
          }
        />
        표식 이름 표시
      </label>
      <label className="setting-select">
        클릭 선택 대상
        <select
          aria-label="클릭 선택 대상"
          value={state.selectionTarget}
          onChange={(e) =>
            dispatch({
              type: "target",
              value: e.target.value as ViewState["selectionTarget"],
            })
          }
        >
          <option value="visible">보이는 구조</option>
          <option value="internal">내부 구조 (체표 통과)</option>
          <option value="skin">체표</option>
        </select>
      </label>
      <div className="cutaway-setting">
        <label>
          앞쪽 구조 일부 숨기기
          <input
            type="range"
            aria-label="앞쪽 구조 일부 숨기기"
            min="0"
            max="1"
            step="0.01"
            value={state.cutaway}
            onChange={(e) =>
              dispatch({ type: "cutaway", value: Number(e.target.value) })
            }
          />
        </label>
        <button onClick={() => dispatch({ type: "cutaway", value: 0 })}>
          숨기기 초기화
        </button>
        <p>
          메쉬 일부를 숨겨 안쪽을 관찰합니다. 실제 조직 단면이나 압박 깊이를
          재현하지 않습니다.
        </p>
      </div>
    </div>
  ) : (
    <div className="structure-browser">
      <label className="search-box">
        <input
          aria-label="해부 구조 검색"
          placeholder="한국어·영어·FMA 코드 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p className="control-hint">
        {results.length.toLocaleString()}개 구조 · 이름·라틴명·계통 경로로 검색
        {results.length > visibleResults.length && ` · 상위 ${visibleResults.length}개 표시`}
      </p>
      {layerKeys.map((l) => {
        const items = visibleResults.filter((s) => s.layer === l);
        return (
          items.length > 0 && (
            <section className="structure-group" key={l}>
              <h3>
                {layerNames[l]} <small>{items.length}</small>
              </h3>
              {items.map((s) => (
                <button
                  key={s.id}
                  className="structure-item"
                  aria-pressed={
                    state.selection?.kind === "structure" &&
                    state.selection.ids[0] === s.id
                  }
                  onClick={() =>
                    dispatch({
                      type: "select",
                      layer: l,
                      selection: {
                        kind: "structure",
                        ids: [s.id],
                        name: s.label || s.name,
                      },
                    })
                  }
                >
                  <strong>{s.label || s.name}</strong>
                  <small>
                    {s.name}{s.latin ? ` · ${s.latin}` : ""} · {s.id}{s.fmaId && s.fmaId !== s.id ? ` · ${s.fmaId}` : ""}
                  </small>
                  {s.hierarchy?.length ? <small className="structure-path">{s.hierarchy.join(" › ")}</small> : null}
                </button>
              ))}
            </section>
          )
        );
      })}
      {!results.length && (
        <p>일치하는 구조가 없습니다. 다른 이름이나 코드를 입력하세요.</p>
      )}
      {state.selection && (
        <button className="structure-focus" onClick={onFocus}>
          선택 구조 확대
        </button>
      )}
    </div>
  );
}
