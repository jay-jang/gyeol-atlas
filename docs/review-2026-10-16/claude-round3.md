1. **판정**: 조건부 승인

   하단 깊이 줄과 Atlas.tsx 최소 수정(G-03·G-19)은 구현을 막을 결함이 아니라고 봅니다. 다수 결정으로 받아들입니다.
   - Atlas.tsx 해시를 강제하는 곳은 `tests/muscle-peel.test.mjs:42` 한 곳입니다. `scripts/audit-muscle-peel.mjs`가 `result.files`의 해시를 다시 써서 고정을 갱신하므로, G-19의 재실행 절차로 충분합니다.
   - 바뀌는 상수는 Atlas.tsx:674–680의 위 150, 아래 `size.height-64`, 오른쪽 56으로 한정됩니다.
   - 대신 아래 세 차단 항목을 고친 뒤 구현해야 합니다.

2. **차단 항목**

   **B1 · G-07과 G-01이 서로 충돌합니다**
   - 문제: G-07은 "≥701에서 목록 행을 골라도 목록 유지"라고 하고, G-01은 "목록이 열린 동안 선택 카드 숨김"이라고 합니다. 둘을 같이 적용하면, 구조를 보던 중 목록에서 경혈을 고른 직후 '구조 선택 해제' 버튼이 `visibility:hidden` 상태가 되어 누를 수 없습니다.
   - 깨지는 계약(1440 화면): `continuity.spec.ts:26–32`, `selection-navigation-return.spec.ts:26–28·78–83`, `scripts/check-continuity-pages.mjs:25`. 모두 목록에서 경혈을 고른 뒤 바로 '구조 선택 해제'를 누릅니다.
   - 사용성 문제: Q30이 보장하는 "경혈을 골라도 구조 선택은 유지" 흐름에서 카드만 사라집니다.
   - G-07 수정 문구: "목록 행을 고르면 지금처럼 목록을 닫는다(위 검사 계약 유지). 차례 넘기기는 G-09의 이전/다음이 맡는다. 목록을 다시 열면 현재 행을 강조하고 그 행으로 스크롤한다."

   **B2 · G-03과 G-11이 서로 충돌합니다**
   - 문제: G-03은 "상단 상태 알약 제거, 상태 줄은 `원본 · 학습용 근사 ↗` 한 줄"이라고 해서 모바일에서 '해부 모델 로드 완료'가 빠집니다.
   - 깨지는 계약: `ready()`가 이 글자가 보이기를 기다립니다(helpers.ts:6). 브라우저 검사 40개 파일이 390·360 화면을 쓰고, `check-readability.mjs:24`와 `capture-workspace.mjs:17`도 같은 글자를 기다립니다.
   - G-03 수정 문구: "모바일 상태 줄 = `{로드 상태 문구(‘해부 모델 로드 완료’, role=status)} · {원본} · 학습용 근사 ↗` 한 줄. 로드 문구는 모든 크기에서 보이는 상태로 둔다."

   **B3 · 위험 목록의 테스트 계약에 빠진 항목이 있습니다**
   - 누락 항목:
     - `.ax-depth`: 7곳. 특히 `detail-context.spec.ts:81–83`은 깊이 막대가 위에 있다고 가정하고 이동 패드와의 간격을 잽니다. 그 밖에 `comparison-layout.spec:37`, `detail-layout.spec:61`, `check-comparison-pages.mjs:21`, `check-readability.mjs:56`, 겹침 감사의 OVERLAYS.
     - `.ax-point-bar`: 7개 파일.
     - '도움말': 7곳. panel-keyboard의 모바일 R1 트리거, `dissection-input-scope.spec:17` 포함.
     - '표시 설정': helpers의 PANELS.
     - '족양명위경 경혈만 보기': `acupoints.spec:58`. G-05 이후에는 팝오버를 먼저 열어야 합니다.
   - 위험 목록에 넣을 문구: "`.ax-depth`(하단 깊이 줄에도 같은 클래스), `.ax-point-bar`, ‘도움말’·‘표시 설정’ 버튼 이름, 경맥 옵션 이름(팝오버를 여는 헬퍼와 함께), `detail-context.spec`의 ‘깊이 막대는 위’ 가정 갱신"

3. **남은 쟁점 동의 여부**
   1. 동의합니다(다수 결정 수용). 조건:
      - 하단 배치가 "비교 상태 관찰 띠 ≥ 현행" 기준이나 360×740 확인을 통과하지 못하면, 상단 깊이 띠 배치(Claude 2차안, G-19 불필요)로 되돌립니다.
      - `COMMERCIAL_COMPARISON.md:81`과 `MINIMAL_REDESIGN.md:42`의 개정 근거를 기록합니다.
   2. 동의합니다. 이번에는 탭 없이 진행합니다.
   3. 동의합니다. 다만 `view-state.test.mjs`의 "explicit deselection … without changing viewing preferences"와 `comparison-clear.spec.ts:47·64`가 지금의 잔류 상태를 기대값으로 고정하고 있습니다. G-10 수용 기준에 이 두 곳을 이름으로 적어 주세요.
   4. 동의합니다(5칸).
   5. 동의합니다. 높이 ≤45%를 유지하고, '가로는 폭 ≤45%' 해석은 사용자 결정 안건으로 둡니다.

4. **비차단 의견**
   1. G-04: 부위 select를 `.depth-explorer` 안으로 옮기면, `AtlasPage.tsx:388`의 휠 처리(`target.closest(".depth-explorer")`) 때문에 select 위에서 휠을 굴려도 박리가 바뀝니다. select는 휠 처리에서 빼거나 깊이 묶음 밖의 형제 요소로 두세요.
   2. G-19: `audit-source-scheduling.mjs:90`과 `audit-body-containment.mjs:77`도 증거 JSON에 Atlas.tsx 해시를 남깁니다. 강제하는 검사는 없으므로 '낡은 해시'로 기록만 하면 됩니다.
   3. G-15: 여성 표식 숨김 이유(`.ax-note`)는 `.ax-point-bar` 안에 있습니다(AtlasPage.tsx:891–893). 발표 보기에서 경혈 도구 줄을 숨길 때 이 안내만은 보이게 남겨야 Q26을 지킵니다.
   4. G-11: 범례를 카드 안에만 두면, 카드 없이 경혈만 고른 상태에서 칠해지는 참조색(Atlas.tsx:376–392)을 설명할 곳이 없습니다(QUALITY:12). 지금도 있는 공백이니 한계로 기록하거나 칩 옆에 한 줄 견본을 두세요.
   5. G-01·G-19: 모바일의 기존 규칙 `.ax[data-panel=…] .ax-inspector{display:none}`(atlas.css:490)도 선택 카드 측정(Atlas.tsx:656–669)을 통해 카메라를 다시 맞출 수 있다고 봅니다(추론). 이번에 `visibility`로 바꾸고, 패널 여닫기 전후 카메라가 같은지 단언으로 확인하세요.