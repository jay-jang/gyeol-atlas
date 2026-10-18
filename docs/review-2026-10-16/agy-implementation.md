### 1. 판정

**`조건부 승인`**

합의안 v2(G-01~G-20)의 핵심 구조(상·하단 분리, 모바일 엄지 영역 3단 구성, `'위'` 정확도 순위화 `G-06`, 비교 해제 시 박리·투명도 복원 `G-10`, 경혈 `이전`/`다음` 순회 `G-09`, R1–R8 키보드 계약 보존)가 코드와 테스트 전반에 충실히 반영되었습니다. 다만 `after/` 화면을 직접 검수한 결과, **낮은 가로 화면(`landscape` 844×390)과 소형 모바일(`small-mobile` 360×740, `mobile` 390×844)에서 선택 카드 본문·비교 고지가 잘리거나 깊이 막대가 겹치는 시각적 결함 3건**이 확인되어 아래 수정 후 최종 승인을 제안합니다.

---

### 2. 합의 위반·결함

1. **G-07 · G-08 · G-01 (`Q5`·`Q25`·`Q29` 위반: 구조 선택·장부 비교 카드의 본문 및 비교 고지 잘림)**
   - **근거**: [atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L418-L452), [atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L652-L661), [atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L705-L706) 및 화면 [landscape-05-structure-selected.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/landscape-05-structure-selected.png), [landscape-09-comparison.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/landscape-09-comparison.png), [small-mobile-05-structure-selected.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/small-mobile-05-structure-selected.png), [mobile-05-structure-selected.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/mobile-05-structure-selected.png).
   - **사용자 영향**: `.selection-card`가 `overflow: hidden` 상태에서 첫째 자식(`div:first-child`: 구조명·영문명·FMA ID·`.comparison-note`·`.organ-detail-parts`)만 `min-height: 0; overflow: auto`로 줄어들고 하단 `.selection-actions`(체크박스 + 2줄 버튼, 약 150px)는 줄어들지 않습니다. 그 결과:
     - `landscape-05-structure-selected.png`(844×390)에서는 카드 상단 본문 높이가 **0px**이 되어 선택된 구조 이름(`위` / `stomach` / `FMA7148`)이 아예 보이지 않고 버튼만 남습니다(`Q5`·`G-08` 위반).
     - `landscape-09-comparison.png`(844×390)에서는 `.comparison-note`(`중완 · 위 비교 — 전통적 대응, 압력 경로 아님`)가 스크롤 영역 아래로 잘려 화면에 보이지 않습니다(`Q25`·`G-07` 위반).
     - `small-mobile-05-structure-selected.png`(360×740)에서는 `.ax-inspector` 전체에 `max-height: 45%`(311px)가 걸려 `.ax-point-chip`(52px)과 `.selection-actions`(152px), sticky `.organ-detail-parts`(37px)를 빼면 상단 본문이 약 50px만 남아 제목(`위 1개 구조`)이 가로로 반쯤 잘리고 `stomach · FMA7148 · 장기`가 가려집니다(`mobile-05-structure-selected.png`에서도 범례 줄이 반쯤 잘림).
   - **정확한 수정 제안**:
     - [atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L652-L661) (`@media (max-width: 700px)`)에서 `max-height: 45%`를 `.ax-inspector` 대신 카드 자체(`.ax-inspector > .detail-panel, .ax-inspector > .selection-card { max-height: calc((100dvh - var(--ax-header)) * .45); }`)에 부여하고, 모바일과 낮은 가로 화면(`@media (max-width: 700px)`, `@media (max-height: 560px) and (min-width: 701px)`)에서는 `.detail-panel`과 동일하게 `.ax .selection-card { overflow: auto; } .ax .selection-card > div:first-child { overflow: visible; min-height: auto; } .ax .organ-detail-parts:not([open]) { position: static; }`로 설정해 카드 상단의 구조명·FMA ID·`.comparison-note`가 절대 0px로 찌부러지지 않게 합니다.

2. **G-04 (`Q27` 위반: `landscape` 844×390 깊이 막대의 비활성 단계 호버·초점 이름 미표시 및 `.peel-entry` 노출 시 단계 점 겹침)**
   - **근거**: [atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L695-L704), [AtlasPage.tsx](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L880-L896) 및 화면 [landscape-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/landscape-01-initial.png), [landscape-05-structure-selected.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/landscape-05-structure-selected.png), [landscape-09-comparison.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/landscape-09-comparison.png).
   - **사용자 영향**:
     - G-04는 낮은 가로 화면(`height <= 560px`, `width > 700px`)에서 *"비활성 단계는 점·눈금만 남기며 호버·초점 시 이름을 표시한다"*고 규정했으나, [atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L697-L698)이 `.ax-depth li:not(.active) .ax-stop-name { display: none; }`로 무조건 숨기고 `.ax-stop`에는 `data-tip`도 없어, 마우스 호버나 키보드 `Tab` 초점 시 비활성 6개 계통의 이름을 확인할 방법이 없습니다(`Q27` 위반).
     - 또한 `landscape-05-structure-selected.png`·`landscape-09-comparison.png`처럼 `.depth-heading`에 `.peel-entry`(`76.0%에서 박리`) 버튼이 나타나면 `.ax-depth-track` 높이가 약 90px로 줄어드는데, `--stop-top` 계산식(`100% - offset * var(--stop-gap)`)에 하한(`max(0px, ...)`)이 없어 상단 점(`체표`·`근육`·`골격`)이 트랙 위로 삐져나와 `[76.0%에서 박리]` 버튼 테두리와 겹칩니다.
   - **정확한 수정 제안**:
     - [atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L697-L698)을 `.ax-depth li:not(.active):not(:hover):not(:focus-within) .ax-stop-name, .ax-depth li:not(.active):not(:hover):not(:focus-within) .ax-solo { display: none; }`로 바꾸고, 호버·초점된 `li`는 `z-index: 2; background: var(--ax-surface); border-radius: var(--ax-radius-ctl);`를 줍니다.
     - `@media (max-height: 560px) and (min-width: 701px)`에서 `.ax { --stop-gap: 11px; }`, `.ax-depth .depth-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px; } .ax-depth .depth-heading .depth-mode { margin: 0; font-size: 12px; }`로 머리말 높이를 줄이고, [AtlasPage.tsx](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L885)의 `--stop-top`을 `max(calc(var(--thumb) / 2), min(...))`로 감싸 트랙 위로 점이 넘치지 않게 합니다.

3. **G-01 · G-02 (`landscape-10-female.png`에서 하단 바 2줄 줄바꿈으로 인한 3D 모델 다리 가림)**
   - **근거**: [atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L555-L560), [atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L711-L713) 및 화면 [landscape-10-female.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/landscape-10-female.png).
   - **사용자 영향**: `landscape`(844×390)에서 여성 모델 전환 시 `.ax-point-bar` 안의 안내문(`.ax-note`)이 길어지면서 `.ax-bottom`이 2줄(높이 약 114px, 캔버스 높이의 33%)로 줄바꿈됩니다. 이로 인해 `.ax-point-bar`가 한 줄 위로 밀려 올라가 여성 3D 모델의 정강이·발목 부위를 중앙에서 가리고, `--ax-bottom-h`가 커져 왼쪽 `.ax-depth`까지 함께 압축됩니다.
   - **정확한 수정 제안**:
     - `@media (max-height: 560px) and (min-width: 701px)`([atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L711))에 `.ax-bottom { flex-wrap: nowrap; } .ax-status { flex: 0 1 124px; } .ax-note > span { display: none; }`를 추가하거나 안내 문구를 한 줄 폭 안에 들어오도록 줄여, 낮은 가로 화면에서도 하단 바가 1줄을 유지하고 모델을 가리지 않게 합니다.

---

### 3. ‘AI스러운 UI’ 잔존 여부

- **잔존하지 않습니다.** `after/` 78장 전체([desktop-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/desktop-01-initial.png), [mobile-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/mobile-01-initial.png), [desktop-11-wiki-home.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/desktop-11-wiki-home.png), [desktop-13-sources.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/desktop-13-sources.png))와 [atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L1-L27)를 확인한 결과, 반투명 블러(`backdrop-filter`), 다중 네온 그라디언트, 999px 알약 배지 남발, 스파클 아이콘, 챗봇형 문구가 모두 제거되었고 불투명 다크 슬레이트 표면(`#0f1d25`)과 단일 청록 강조색(`#6fd3e3`), 담백한 편집형 위키·출처 레이아웃으로 일관되게 정리되었습니다.

---

### 4. 비차단 의견 (최대 5개)

1. **모바일 상단 상태 줄(`mobile-10-female.png`, `small-mobile-09-comparison.png`) 말줄임 개선**: 비교 모드 진입 후(`selectionTarget: "internal"`)에는 `.scene-status`에 `선택 대상: 내부 구조`가 추가되어 오른쪽 `.ax-source`(`남성 참조 · 학습용 근사 ↗`)가 `학...`으로 잘립니다([atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L595-L600)). `@media (max-width: 700px)`에서는 `.ax-status .click-target`을 숨기거나 `내부 선택`으로 축약하면 `학습용 근사 ↗` 링크가 온전히 보입니다.
2. **`scripts/audit-scene-overlays.mjs`에 구조 선택(`structure-selected`) 및 여성(`female`) 상태 추가**: 이번 시각 검수에서 발견된 `landscape-05-structure-selected.png`(본문 높이 0px)와 `landscape-10-female.png`(하단 바 2줄 줄바꿈)는 감사 스크립트에 해당 상태와 `.selection-card > div:first-child` 최소 높이(`>= 48px`) 단언을 추가하면 자동으로 재발을 막을 수 있습니다.
