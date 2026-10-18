## 1. 판정

**조건부 승인** (아래 차단 항목 2건의 문구 보정 시 즉시 구현 승인)

---

## 2. 차단 항목 (2건)

| G-번호 | 문제 (코드 줄·스크린샷 근거) | 합의안에 넣을 정확한 수정 문구 |
| --- | --- | --- |
| **G-03 · G-11** | **모바일 `‘해부 모델 로드 완료’` 가시성 계약 충돌**:<br>`G-03`([CONSENSUS.md:21](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/CONSENSUS.md#L21))의 *"상단 깊이 띠·상태 알약 제거, 상태 줄은 `원본 · 학습용 근사 ↗` 한 줄"*을 그대로 구현해 모바일(`390×844`, `360×740`)에서 `.scene-status`(`해부 모델 로드 완료`)를 숨기거나 제거하면, `G-11`([CONSENSUS.md:29](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/CONSENSUS.md#L29))과 모순되며 [`tests/browser/helpers.ts:6`](file:///Users/nuinuri/workspace/anatomy/tests/browser/helpers.ts#L6), [`scripts/audit-scene-overlays.mjs:47, 56`](file:///Users/nuinuri/workspace/anatomy/scripts/audit-scene-overlays.mjs#L47), [`scripts/capture-workspace.mjs:17, 24`](file:///Users/nuinuri/workspace/anatomy/scripts/capture-workspace.mjs#L17) 등 39개 파일의 `getByText('해부 모델 로드 완료').toBeVisible()` 대기가 모바일에서 타임아웃으로 실패합니다. | **G-03 수정**: `"상단 깊이 띠·상태 알약 제거, 상태 줄은 원본 · 학습용 근사 ↗ 한 줄"` → **`"상단 깊이 띠 제거. 모바일 상태 줄(.ax-status)에도 ‘해부 모델 로드 완료’(또는 로드 진행 상태)와 ‘원본 · 학습용 근사 ↗’를 함께 표시해 39개 테스트의 가시성 대기 계약을 유지"`** |
| **G-01 · G-03 · G-20** | **모바일 패널(`.ax-results`, `.ax-side-panel`)과 우측 카메라 열(`.ax-camera`) 겹침 및 `display:none` 재맞춤 유발**:<br>1) 현행 [`src/atlas.css:446–447`](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L446-L447)에서 모바일 `.ax-results`·`.ax-side-panel`은 `right: var(--ax-gap)`(전체 폭)이고 `.ax-inspector`만 `right: calc(var(--ax-gap) + 56px)`([`atlas.css:481`](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L481))입니다([mobile-06-display-settings.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-06-display-settings.png), [mobile-07-point-list.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-07-point-list.png)). `G-03`대로 시트를 연 동안 `.ax-camera`가 보이면, `G-20`에서 `OVERLAYS`에 추가된 `.ax-side-panel`/`.ax-results`와 `.ax-camera`가 우측 56px 구간에서 겹쳐 `audit-scene-overlays.mjs`가 즉시 실패합니다.<br>2) 또한 현행 [`src/atlas.css:490`](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L490)은 모바일에서 패널이 열릴 때 `.ax-inspector`를 `display: none`으로 숨기는데, 이는 선택 카드 측정([`src/Atlas.tsx:656–666`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L656-L666))을 `0`으로 만들어 `layoutKey` 변경 및 카메라 재맞춤([`Atlas.tsx:887`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L887))을 일으킵니다. | **G-01·G-03 보충**: **`"모바일(≤700)에서 경혈 상세·선택 카드(.ax-inspector)는 우측 카메라 열 옆(right: calc(var(--ax-gap) + 56px))에 열어 깊이 줄·카메라 열이 함께 보이게 하고, 전체 폭을 쓰는 검색·목록·설정·도움말(.ax-results, .ax-side-panel)이 열린 동안에는 .ax-inspector와 .ax-camera를 visibility:hidden으로 숨김(atlas.css:490의 display:none을 visibility:hidden으로 교체)"`** |

---

## 3. 남은 쟁점 1–5에 대한 동의 여부

1. **쟁점 1 (모바일 박리 위치 `G-03`·`G-19`)**: **동의** — 하단 엄지 영역 깊이 줄 배치와 `Atlas.tsx` 관찰 영역 상수의 CSS 변수화(`--ax-observe-*`) + `audit-muscle-peel.mjs` 해시 갱신 절차에 동의합니다.
2. **쟁점 2 (검색 범위 탭 제외 `G-06`)**: **동의** — 이번에는 범위 탭 없이 `search-rank.ts` 정확 일치 최우선 정렬과 유형별 묶음만으로 단순하게 해결하는 안에 동의합니다.
3. **쟁점 3 (비교 해제 복원 좁은 규칙 `G-10`)**: **동의** — `compare` 진입 전 장면과 `alpha.skin`을 `selectionReturn`에 저장하고 피부 불투명도가 `0.12` 그대로일 때만 복원하는 좁은 규칙과 테스트 갱신에 동의합니다.
4. **쟁점 4 (모바일 카메라 5칸 `G-18`)**: **동의** — `[+][−][정면][후면][시점 ▴]` 5칸으로 1탭 후면 보기(U3)와 한 손 확대/축소(U9)를 유지하는 안에 동의합니다.
5. **쟁점 5 (가로 모바일 패널 높이 `≤45%` 유지)**: **동의** — 브리프 불변 조건대로 가로 모바일에서도 패널 높이 `≤45%`를 엄격히 적용하고 폭 기준 재해석은 사용자 결정 안건으로만 기록하는 데 동의합니다.

---

## 4. 비차단 의견 (4개)

1. **`G-04` (`전신 부위 선택` 위치 이동 시 `.ax-depth` 숨김 영향 확인)**: `G-01`에서 `≥701px` 검색 결과가 열린 동안 `.ax-depth`를 `visibility:hidden`으로 숨기므로, `전신 부위 선택`을 `.ax-depth` 안으로 옮길 때 검색 패널을 닫은 뒤 부위를 조작하는 기존 E2E 흐름([`anatomy.spec.ts:43, 74`](file:///Users/nuinuri/workspace/anatomy/tests/browser/anatomy.spec.ts#L43), [`female-gallbladder.spec.ts:45`](file:///Users/nuinuri/workspace/anatomy/tests/browser/female-gallbladder.spec.ts#L45), [`female-airway.spec.ts:54`](file:///Users/nuinuri/workspace/anatomy/tests/browser/female-airway.spec.ts#L54))이 그대로 유지되는지만 확인하면 됩니다.
2. **`G-03`·`G-19` (모바일 하단 겹침 방지 기준선)**: [`comparison-layout.spec.ts:54–55`](file:///Users/nuinuri/workspace/anatomy/tests/browser/comparison-layout.spec.ts#L54-L55)는 모바일 여성 비교 상태에서 `.ax-inspector`와 `.ax-camera`의 하단(`y + height`)이 `.ax-point-bar.y - 4` 이하일 것을 단언합니다. `깊이 줄`이 `.ax-point-bar` 위에 놓이므로 `.ax-inspector`와 `.ax-camera`는 `깊이 줄` 위(`bottom: calc(깊이 줄 위 + 간격)`)에 배치되면 이 단언도 자연스럽게 통과합니다.
3. **`G-03`·`G-08` (모바일 상세 열림 시 `.ax-inspector` 45% 예산 배분)**: 모바일에서 상세(`.detail-panel`)나 선택 카드(`.selection-card`)가 열릴 때 맨 위에 `.ax-point-chip`(44px)이 함께 남으므로([`atlas.css:485`](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L485) 제거), `.ax-inspector` 전체에 `max-height: 45%`를 주고 내부 `.detail-panel`/`.selection-card`에 `flex: 1; min-height: 0`을 주어야 전체 인스펙터 높이가 45%를 넘지 않습니다.
4. **`G-17` (출처 페이지 선택자 호환)**: [`tests/browser/site.spec.ts:15`](file:///Users/nuinuri/workspace/anatomy/tests/browser/site.spec.ts#L15)가 `.source-cards article` 14개를 세므로, 역할별 목록으로 바꿀 때 컨테이너·항목에 `.source-cards`와 `<article>`을 유지하거나 `site.spec.ts:15`를 같은 커밋에서 함께 갱신하면 됩니다.
