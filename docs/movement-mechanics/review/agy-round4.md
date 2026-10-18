# 4차 최종 합의안(`CONSENSUS.md` v2) 검토서

1) **판정: 최종 승인**
- 3차 조건부 승인의 차단 항목 3건([§4·§7 진행 단위 및 내부 시간축 `0–1` 피복 검사 분리](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L71), [§6 연결조직 표시 설정 보존·`connectiveKindOf` 판정·일반 묶음 강조](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L90), [§6 T23 여성 대퇴골 복합 묶음 `femur-right` 전체 대응](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L92))이 [`CONSENSUS.md`](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L106-L117) v2에 모두 정확히 반영되었습니다.

2) **차단 유지 항목**: 없음.

3) **비차단 의견 (2건)**
- **[`CONSENSUS.md` §6 연결조직·묶음 강조 (90행)](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L90)**: 남성 [`SupplementModel`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L523)뿐 아니라 여성 [`PackedAtlas.tsx`](file:///Users/nuinuri/workspace/anatomy/src/PackedAtlas.tsx#L200)(`selected && props.selectionIds.length === 1`)와 [`AnatomyLayer`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L387)에서도 범주 묶음(`인대·힘줄`)이 아닌 일반 `bundle`(좌우 쌍·복합 골격 묶음) 선택 시 강조색이 일관되게 적용되도록 함께 점검하는 것을 권장합니다.
- **[`CONSENSUS.md` §5 T20 모바일 상단 고정 바 (84행)](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L84)**: 표 구간 스크롤 중 상단에 고정되는 한 줄 바(`≤56px`) 내부의 ‘이전/다음·재생’ 조작 버튼도 터치 타깃 `44×44px` 기준(§2·§7)을 충족하도록 히트박스를 확보하는 것을 권장합니다.
