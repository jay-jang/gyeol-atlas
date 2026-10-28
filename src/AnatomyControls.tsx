import type { Dispatch } from "react";
import { connectiveIdsForSex, connectiveKindOf, layerKeys, layerNames, stageDescription } from "./anatomy";
import { connectiveGroup } from "./anatomy-rendering";
import type { ViewState, ViewAction } from "./view-state";
// Display settings for the atlas: per-system layers and opacity, acupoint
// markers, click target and the front cutaway. Sex and body region live in
// the top bar; structure search lives in the unified search.
export default function AnatomyControls({
  state,
  dispatch,
  onDone,
}: {
  state: ViewState;
  dispatch: Dispatch<ViewAction>;
  onDone: () => void;
}) {
  const connectiveIds = connectiveIdsForSex(state.sex);
  const tendonCount = connectiveIds.filter((id) => connectiveGroup(connectiveKindOf(id)) === "tendon").length;
  const scopeControls = state.sex === "female" ? <details className="anatomy-scope-controls setting-details">
    <summary>여성 모델 자료 범위 · 남성 원본을 옮긴 보완은 여성 고유 형상 아님</summary>
    <p className="control-hint">HRA 여성 전신과 여성 CT 보완 상세는 서로 다른 신체 자료입니다. 위·식도·부신·뇌하수체·갑상샘·부갑상샘은 남성 원본을 옮긴 보완으로 전신에 그리고, 위·부신·식도 구간·등 근육군 구간은 검색하거나 주요 기관에서 별도 CT 모형으로도 볼 수 있습니다. 근육·팔다리 혈관·말초신경·인대·힘줄·전신 림프절은 남성 원본을 여성 고유 뼈·피부에 맞춘 하나의 정합장으로 옮긴 보완이며, 회청색 보완 골격 180개도 같은 정합장으로 놓았습니다. 여성 고유 형상이 아닙니다. 별도 Visible Human Female 하체 근육은 검색할 때만 보입니다. 유방의 젖샘엽·젖샘관은 장기와 함께 표시합니다(원본 분류는 피부계통). 여성 경혈 좌표는 검수 전이라 기본으로 숨기며 ‘근사 위치로 보기’로 켤 수 있습니다(배·사타구니·가슴 일부는 여성 표지 기준 WHO 비례촌으로 다시 계산).</p>
  </details> : null;
  return (
    <div className="layer-settings">
      <p className="control-hint">계통을 조합해 같은 부위를 비교하세요. 현재 시점은 유지됩니다.</p>
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
      <details className="setting-details">
        <summary>선택 강조와 주변 반투명</summary>
        <p className="control-hint">
          선택한 구조는 불투명하게 강조하며, 선택을 해제하면 위 투명도로 돌아갑니다.
          단일 구조 선택 시 주변 반투명 표시를 선택 카드에서 끌 수 있습니다. 실제 박리가 아닌 관찰 보조입니다.
          반투명 표시 중 겹친 표면을 누르면 선택 구조를 우선합니다. 겹친 다른 구조는 반투명을 끄거나 검색해 선택하세요.
        </p>
      </details>
      <div className="organ-key" role="group" aria-label="장기 색 구분">
        <strong>장기 색 <small>편집 표시색 · 조직 색 아님</small></strong>
        <ul className="connective-key">
          {([["heart", "심장"], ["lung", "폐"], ["liver", "간"], ["kidney", "콩팥"], ["bowel", "위·장"], ["reproductive", "생식기관"], ["other-organ", "그 밖의 장기"]] as const)
            .map(([key, name]) => <li key={key}><i className={`layer-dot ${key}`} />{name}</li>)}
        </ul>
      </div>
      {scopeControls}
      <div className="connective-setting">
        <label className="setting-check">
          <input
            type="checkbox"
            checked={state.connective}
            onChange={(e) => dispatch({ type: "connective", value: e.target.checked })}
          />
          <i className="layer-dot connective" />
          인대·힘줄 표시 <small>{connectiveIds.length}개</small>
        </label>
        <ul className="connective-key" aria-label="인대와 힘줄의 색 구분">
          <li><i className="layer-dot ligament" />인대·관절 구조 <small>{connectiveIds.length - tendonCount}개 · 무광 연청색</small></li>
          <li><i className="layer-dot tendon" />힘줄·힘줄집·지지띠 <small>{tendonCount}개 · 윤기 있는 진주색</small></li>
        </ul>
        <button onClick={() => { dispatch({ type: "connective-only", ids: connectiveIds }); onDone(); }}>
          인대·힘줄만 보기
        </button>
        <p className="control-hint">
          {state.sex === "male"
            ? "뼈와 뼈를 잇는 관절 인대·관절주머니·반달연골은 연청색, 근육을 뼈에 잇는 따로 모델링된 힘줄과 널힘줄·지지띠·힘줄집은 진주색으로 그립니다. 인대는 골격과 함께, 힘줄은 근육과 함께 박리됩니다. 대부분의 힘줄은 원본에서 근육 모형에 포함되어 근육색으로 보입니다."
            : "뼈와 뼈를 잇는 인대·반달연골은 연청색, 근육을 뼈에 잇는 힘줄은 진주색입니다. 무릎 인대·반달연골과 넙다리네갈래근 힘줄은 여성 원본이고, 나머지는 남성 원본을 여성 몸에 맞춰 옮긴 보완입니다. 인대는 골격과 함께, 힘줄은 근육과 함께 박리됩니다."}
        </p>
      </div>
      <label className="setting-check">
        <input
          type="checkbox"
          checked={state.modesty}
          onChange={(e) => dispatch({ type: "modesty", value: e.target.checked })}
        />
        성기 가리기
      </label>
      <p className="control-hint">기본으로 켜져 있습니다. 모든 계통에서 외부 생식기(음경·음낭·고환·부고환·정관·요도, 여성은 질)와 그리로 가는 혈관·신경 가지를 빼고, 남성 피부는 그 부위를 매끄러운 면으로 닫아 그립니다(편집 표시 면, 해부 구조 아님). 끄거나 상단의 방패 버튼을 누르면 보입니다. 검색으로 직접 고른 구조와 생식기관 상세는 켜져 있어도 보입니다.</p>
      <p className="coverage-description">{stageDescription(state.stage, state.sex)}</p>
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
  );
}
