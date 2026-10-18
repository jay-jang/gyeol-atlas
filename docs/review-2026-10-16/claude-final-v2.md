1) **최종 승인.** 제 차단 항목 B1–B3는 모두 해결됐습니다.
   - B1: G-07에서 목록 행을 고르면 목록을 닫도록 바뀌었습니다.
   - B2: G-03 모바일 상태 줄에 '해부 모델 로드 완료' 문구가 들어갔습니다.
   - B3: 위험 목록에 `.ax-depth`·`.ax-point-bar`·'도움말'·'표시 설정'·경맥 옵션 헬퍼·`detail-context` 가정이 추가됐습니다.
   - Codex·AGY 쪽 새 문구도 새 차단 결함을 만들지 않습니다. G-10이 가리키는 view-state.ts:526(`if (!s.selection || s.detail || s.comparison) s.selectionReturn = null;`)은 실제 삭제 조건과 맞습니다. G-01의 모바일 `visibility` 숨김과 `right: gap + 56px` 배치도 현행 카메라 열과 충돌하지 않습니다.

2) 차단 항목 없음.

3) 비차단 의견 두 가지:
   - **G-01 축약 비교 줄의 클래스:** `.comparison-note`를 다시 쓰지 말고 별도 클래스(예: `.panel-comparison-note`)를 쓰세요. 그래야 `.comparison-note`가 페이지에 하나뿐이라고 가정하는 계약이 지켜집니다. 해당 계약은 `panel-keyboard.spec.ts:82–98`의 `toContainText`, `smoke-comparison-clear.mjs:22·30`의 개수 0, `capture-workspace.mjs:25`의 `.selection-card .comparison-note`입니다. 카드를 `visibility`로 숨겨도 요소는 DOM에 남아 두 개로 잡힙니다.
   - **G-10 526행 수정 범위:** 비교가 있고 `validReturn`(view-state.ts:433)을 통과할 때만 보존하도록 한정하세요. 이때 `validReturn`이 선택적 alpha 필드도 검증해야 합니다. 비교 없이 선택만 있는 경로와 기관 상세 경로는 지금처럼 비워야 합니다.