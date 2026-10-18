# 3차 최종 합의안(`CONSENSUS.md` v1) 검토서

**판정: 조건부 승인**

## 차단 항목 (3건)

1. **[`CONSENSUS.md` §6 아틀라스·위키 왕복 (87–88행)](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L87-L88) — `ZA_` 묶음 강조 누락 및 `connective` 복원 불가 (구현 불가·동작 결함)**
   - **차단 사유**: ① [`src/view-state.ts`](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts#L50-L60)의 `ReturnView`에 `connective?: boolean`이 없어 [`clearSelection`](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts#L317-L334) 시 "해제 시 되돌림"을 수행할 수 없습니다. ② [`src/Atlas.tsx`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L522-L523)의 `SupplementModel`은 `connective` 메쉬를 `props.selectedStructure === item.name`(단일 선택일 때만 존재)으로만 `#34d3dd` 강조하므로, 양측성 `ZA_` 인대·힘줄(장골대퇴인대·족저근막 등)을 다중 `bundle`로 열면 선택 메쉬가 전혀 강조되지 않은 채 전신 400개 결합조직이 함께 켜져 식별이 불가능합니다.
   - **정확한 수정 문구**:
     > `[src/view-state.ts] ReturnView에 connective?: boolean을 추가해 restoreView에서 복원하고, ZA_ id 포함 시 connective: true를 켠다. [src/Atlas.tsx] SupplementModel의 결합조직 강조 조건을 (connective ? selected && !isConnectiveCategoryBundle : selected)로 수정해 CONNECTIVE_BUNDLE("connective-only")이 아닌 일반 ZA_ 묶음 선택 시에도 #34d3dd 강조가 적용되게 한다.`

2. **[`CONSENSUS.md` §6 아틀라스·위키 왕복 (90행, T23)](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L90) — 여성 대퇴골 대응 예시 `HRAF0911`의 부분 조각 오매핑 (사실 오류·Q3/Q11 위반)**
   - **차단 사유**: [`data/female-atlas-structures.json`](file:///Users/nuinuri/workspace/anatomy/data/female-atlas-structures.json#L2-L73) 및 [`data/female-composite-groups.json`](file:///Users/nuinuri/workspace/anatomy/data/female-composite-groups.json#L32-L52)에서 `HRAF0911`은 우측 대퇴골 전체가 아니라 16분할 메쉬 중 **골간(`오른쪽 대퇴골 본체`) 단일 조각**입니다. `FMA24474`를 `HRAF0911` 단일에 대응시키면 대퇴골두·경부·대전자·외측과 등 15개 조각이 누락되어 단일 조각과 전체 구조를 구분하는 프로젝트 원칙(Q3·Q11)을 위반합니다.
   - **정확한 수정 문구**:
     > `여성 고유 구조와 같은 해부 구조 대응은 전체 부위가 일치하는 경우(예: 우측 대퇴골은 HRAF0911 단일 조각이 아니라 복합 그룹 femur-right[HRAF0911–HRAF0926] 전체)에만 데이터에 명시해 열고, 대응이 없거나 불완전한 남녀 공용 기전 구조는 안내 문구와 "남성 모델에서 보기" 전환 버튼을 노출한다.`

3. **[`CONSENSUS.md` §7 테스트·품질 게이트 (96행)](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L96) — `국면 경계 0–100 피복` 검증과 §3.1·§3.3·§3.5 비-`%` 규칙의 충돌 (내부 모순)**
   - **차단 사유**: §3.1(서기)·§3.3(앉기)·§3.5(팔 들어올리기)는 시간 `%`를 쓰지 않기로 확정했으나([`CONSENSUS.md` 33·52·67행](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L33-L73)), §7은 모든 운동에 `국면 경계 단조 증가·0–100 피복`을 요구해 단위 테스트가 실패하거나 금지된 가짜 시간 `%`를 강제하게 됩니다.
   - **정확한 수정 문구**:
     > `- 단위(tests/movements.test.mjs): 5개 운동 데이터 무결성, 모든 해부 id의 실제 카탈로그 존재, 내부 보간 진행률(0–100) 단조 증가·0–100 피복(화면 표시는 walking만 주기 %이고 standing·stand-to-sit·arm-elevation은 상태·각도 구간 라벨임을 검증), 모든 수치의 출처·confidence 존재, 한국어 조사·금칙어(T15) 미포함.`

## 비차단 의견 (3건)

1. **[`CONSENSUS.md` §5 `DiagramSpec` 키프레임 구조 (81행)](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L81)**: 운동마다 사용하는 관절 자유도(`pelvisTilt`, `scapulaUpward`, `ghElevation` 등)가 다르므로 키프레임 각도를 고정 필드 대신 `angles: Record<string, number>`로 정의하면 보간기가 단순해집니다.
2. **[`CONSENSUS.md` §4 모바일 아틀라스 미니 바 (76행)](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L76)**: `380×844` 화면에서 하단 트레이(`max-height: 46vh`)가 열려도 3D 조작 영역이 가려지지 않도록 상단 미니 바를 `44–48px` 높이의 1줄 캡슐로 제한하는 것을 권장합니다.
3. **[`CONSENSUS.md` §3.2 `sit-to-stand` 근활성 주석 (48행)](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/CONSENSUS.md#L48)**: Roebroeck et al. (1994)와 Millington et al. (1992)은 계측 프로토콜이 다르므로 `phases[].notes`에서 두 출처의 수치를 문장별로 분리해 표기하는 것이 명확합니다.
