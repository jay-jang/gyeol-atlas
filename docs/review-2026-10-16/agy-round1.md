# 결 GYEOL UI/UX 전면 개선 — AGY 독립 제안서 (`A-`)

## 1. 요약

1. **도구형 앱으로의 일관된 통합**: 아틀라스(다크 슬레이트)와 위키·출처(구버전 세이지 그린 + 마케팅 랜딩 클리셰)로 분열된 시각 체계를 [src/design-system.css](file:///Users/nuinuri/workspace/anatomy/src/design-system.css) 기반의 절제된 해부·경혈 도구 디자인 시스템으로 단일화하고, 반짝이 아이콘·영문 대문자 슬로건·죽은 CSS(약 700줄)를 제거합니다.
2. **패널 간섭 제거와 검색 정확도 복원**: 검색·사이드 패널이 깊이 막대·경혈 칩을 덮는 레이아웃 충돌을 해소하고, `'위'` 검색 시 경혈 40개와 근육(`오른쪽 가시위근`)에 밀려 정작 장기 `'위(Stomach)'`를 찾지 못하는 정렬·그룹화 결함을 교정합니다.
3. **모바일·낮은 높이 화면의 조작성 회복**: 필터·면책 문단에 밀려 목록과 본문이 0줄 보이던 모바일 경혈 목록·상세 시트를 접이식 구조로 개편하고, 작은 모바일(360px) 상단 바와 태블릿(820px) 하단 경맥 막대의 잘림 문제를 해결합니다.
4. **연속 탐색(U1–U12) 완결성 강화**: 첫 방문자 인라인 안내, 경맥 흐름을 따라가는 이전/다음(`‹`/`›`) 경혈 이동, 북마크 바로가기, 수업·발표용 도구 숨김(클린 뷰) 모드를 추가합니다.
5. **불변 조건(Q1–Q33) 100% 보존**: 모든 보기 상태 전이는 기존 [src/view-state.ts](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts)를 그대로 거치며, 정직성·출처·한계 고지는 삭제하지 않고 계층적 요약(`summary`/`details` 및 인라인 배지)으로 밀도를 정리합니다.

---

## 2. 현재 진단 (핵심 문제 11개)

### D1. 통합 검색의 결과 순서·계통 묶기 결함으로 핵심 구조 검색 실패 (심각도: **P0**)
- **근거 (직접 관찰):**
  - 스크린샷: [desktop-04-search-query.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-04-search-query.png), [desktop-05-structure-selected.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-05-structure-selected.png), [mobile-04-search-query.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-04-search-query.png), [small-mobile-04-search-query.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/small-mobile-04-search-query.png)
  - 코드: [src/AtlasPage.tsx:445-460](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L445-L460), [src/AtlasPage.tsx:593-636](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L593-L636)
- **상세:** `'위'`를 검색하면 ① 경혈 검색([src/AtlasPage.tsx:445-446](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L445-L446))이 이름 일치 점수를 따지지 않고 `landmarks`·`region`에 `'위'`(`위팔`, `위배` 등)가 들어간 경혈 40개(`천부 LU3`, `협백 LU4` 등)를 먼저 렌더링하여 구조 결과를 스크롤 아래로 밀어냅니다. ② 더 심각하게는 [src/AtlasPage.tsx:448-459](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L448-L459)에서 완전 일치(`score 0`)로 정렬해 놓고도, 렌더링([src/AtlasPage.tsx:618-631](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L618-L631))할 때 `layerKeys`(`skin` → `muscle` → `bone` → `organ`) 순서로 다시 묶어 버려, 장기 `'위(Stomach, FMA7148)'`보다 근육 부분 일치인 `'오른쪽 가시위근(극상근)'`이 첫 구조 결과로 선택됩니다([desktop-05-structure-selected.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-05-structure-selected.png)).
- **영향받는 사용 사례:** U2, U4, U5

### D2. 모바일·가로 화면에서 경혈 목록 패널의 필터 과밀로 실제 경혈 목록이 0줄 보임 (심각도: **P0**)
- **근거 (직접 관찰):**
  - 스크린샷: [mobile-07-point-list.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-07-point-list.png), [small-mobile-07-point-list.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/small-mobile-07-point-list.png), [landscape-07-point-list.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/landscape-07-point-list.png)
  - 코드: [src/AtlasPage.tsx:664-705](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L664-L705), [src/atlas.css:104-107](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L104-L107), [src/atlas.css:447](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L447)
- **상세:** 모바일 하단 시트(`max-height: 45%`) 안에 검색 입력 + 4개 셀렉트(`경혈 분류`, `모델에서 볼 부위`, `경맥`, `수록 범위`) + 6개 칩 + 실행 버튼이 모두 펼쳐진 채 고정되어 있어, 정작 경혈을 고르는 `.point-list`가 화면 아래로 완전히 잘려 보이지 않습니다. 이는 [docs/QUALITY_STANDARD.md:11](file:///Users/nuinuri/workspace/anatomy/docs/QUALITY_STANDARD.md#L11)("상세 필터는 필요할 때 펼칩니다")에 위배됩니다.
- **영향받는 사용 사례:** U2, U3, U9, U10, U12

### D3. 데스크톱·태블릿·가로 화면에서 열린 패널이 깊이 막대(`ax-depth`) 및 경혈 칩(`ax-point-chip`)을 덮음 (심각도: **P0**)
- **근거 (직접 관찰):**
  - 스크린샷: [desktop-03-search-empty.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-03-search-empty.png), [tablet-03-search-empty.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/tablet-03-search-empty.png), [desktop-06-display-settings.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-06-display-settings.png), [desktop-07-point-list.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-07-point-list.png), [desktop-08-help.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-08-help.png), [landscape-06-display-settings.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/landscape-06-display-settings.png)
  - 코드: [src/atlas.css:84](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L84), [src/atlas.css:134](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L134), [src/atlas.css:161](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L161), [src/atlas.css:207-211](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L207-L211), [src/atlas.css:266-269](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L266-L269), [src/atlas.css:490](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L490)
- **상세:** 좌측 `.ax-results`는 `.ax-depth` 바로 위(`z-index: 40` vs `20`)에 열려 깊이 막대 상단을 가리고, 우측 `.ax-side-panel`(`display`/`help`/`points`)은 `.ax-inspector`(`z-index: 25`)와 같은 우상단 좌표를 공유하면서도 모바일(`max-width: 700px`)에서만 `.ax-inspector`를 숨겨 데스크톱·노트북·태블릿·가로 화면에서 경혈 칩과 패널 테두리가 겹칩니다.
- **영향받는 사용 사례:** U1, U2, U4, U10

### D4. 작은 모바일(360px) 상단 바 폭 붕괴 및 태블릿(820px) 하단 경맥 막대 절단 (심각도: **P0**)
- **근거 (직접 관찰):**
  - 스크린샷: [small-mobile-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/small-mobile-01-initial.png), [small-mobile-04-search-query.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/small-mobile-04-search-query.png), [tablet-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/tablet-01-initial.png), [landscape-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/landscape-01-initial.png)
  - 코드: [src/AtlasPage.tsx:557-585](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L557-L585), [src/AtlasPage.tsx:874-926](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L874-L926), [src/atlas.css:239-261](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L239-L261), [src/atlas.css:434-443](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L434-L443)
- **상세:**
  1. 360px 화면에서 `.ax-top` 한 줄에 검색창 + 남/여 + 부위(`select`) + 방패 + 설정 + 도움말 6개 요소를 배치해 검색창 내부 텍스트 영역이 약 45px로 줄어들어 `'경혈 ·'`에서 잘립니다.
  2. 820px 태블릿 화면에서 `.ax-bottom` 한 줄에 `.ax-status` + `.ax-point-bar` + `.ax-camera`를 나란히 배치해 `.ax-status`는 `'선택 ㄷ'`에서 잘리고, `.ax-meridians`는 15개 경맥 중 `'전체 | 폐경'`만 보입니다.
- **영향받는 사용 사례:** U2, U3, U5, U9, U10

### D5. 경혈 상세 패널(`PointDetail`) 상단 개념 박스 과밀로 낮은 높이·모바일에서 본문 탭 가림 (심각도: **P1**)
- **근거 (직접 관찰):**
  - 스크린샷: [landscape-02-point-detail.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/landscape-02-point-detail.png), [small-mobile-02-point-detail.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/small-mobile-02-point-detail.png), [mobile-02-point-detail.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-02-point-detail.png), [laptop-02-point-detail.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/laptop-02-point-detail.png)
  - 코드: [src/AtlasPage.tsx:74-145](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L74-L145), [src/atlas.css:285-320](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L285-L320)
- **상세:** 경혈 제목 아래 `.concept-reference` 박스가 항상 고정 노출되어 `landscape`에서는 탭 자체가 잘리고, `mobile`·`small-mobile`에서는 탭 이름만 보인 채 위치 설명(`배꼽 위 4 B-cun`)과 `위키에서 더 알아보기` 버튼이 스크롤 아래로 숨겨집니다. 또한 패널 전체(`.detail-panel`)가 통째로 스크롤되어 헤더·탭·하단 액션이 고정되지 않습니다.
- **영향받는 사용 사례:** U2, U6, U8, U9, U10

### D6. 아틀라스와 위키·출처 간 디자인 분열 및 ‘AI스러운 UI’ 요소 잔존 (심각도: **P1**)
- **근거 (직접 관찰):**
  - 스크린샷: [desktop-11-wiki-home.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-11-wiki-home.png), [desktop-12-wiki-point.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-12-wiki-point.png), [desktop-13-sources.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-13-sources.png), [mobile-11-wiki-home.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-11-wiki-home.png)
  - 코드: [src/App.tsx:20](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L20), [src/App.tsx:147-182](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L147-L182), [src/App.tsx:252](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L252), [src/App.tsx:344-385](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L344-L385), [src/App.tsx:411-417](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L411-L417), [src/styles.css:1-14](file:///Users/nuinuri/workspace/anatomy/src/styles.css#L1-L14), [src/design-system.css:1-25](file:///Users/nuinuri/workspace/anatomy/src/design-system.css#L1-L25), [src/atlas.css:3-22](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L3-L22)
- **상세:**
  - `Sparkles` 아이콘과 `"위키에 물어보기"` 챗봇형 박스([src/App.tsx:147-182](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L147-L182)), 영문 대문자 장식(`A LIVING, SOURCE-GROUNDED WIKI`, `GYEOL KNOWLEDGE`, `START HERE`, `ACUPOINT INDEX`, `TRACEABLE BY DESIGN`), 슬로건형 큰 제목(`연결하며 이해하는 우리 몸의 지식.`), 장식용 큰 숫자 통계([src/App.tsx:355-366](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L355-L366)), 카드 일련번호(`01`, `02`...)가 전형적인 AI 생성 템플릿 인상을 줍니다.
  - CSS 변수 체계가 [src/styles.css](file:///Users/nuinuri/workspace/anatomy/src/styles.css)(`--green: #315a48`), [src/design-system.css](file:///Users/nuinuri/workspace/anatomy/src/design-system.css)(`--accent: #14553f`), [src/atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css)(`--ax-accent: #6fd3e3`) 3곳으로 쪼개져 있고, [src/styles.css:200-556](file:///Users/nuinuri/workspace/anatomy/src/styles.css#L200-L556), [src/styles.css:1148-1466](file:///Users/nuinuri/workspace/anatomy/src/styles.css#L1148-L1466), [src/styles.css:1648-1793](file:///Users/nuinuri/workspace/anatomy/src/styles.css#L1648-L1793)에 미사용 구버전 아틀라스 스타일이 방치되어 있습니다.
- **영향받는 사용 사례:** U1, U2, U12

### D7. 경맥별 순차 탐색(U3) 단절 및 저장한 경혈(U12) 접근 경로 은닉 (심각도: **P1**)
- **근거 (직접 관찰):**
  - 스크린샷: [desktop-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-01-initial.png), [desktop-07-point-list.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-07-point-list.png)
  - 코드: [src/AtlasPage.tsx:270-281](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L270-L281), [src/AtlasPage.tsx:687](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L687), [src/AtlasPage.tsx:748-758](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L748-L758)
- **상세:**
  - 목록에서 경혈을 누르면 `select(p)`가 `setPanel(null)`로 패널을 즉시 닫아버리고, 경혈 칩(`.ax-point-chip`)에는 현재 필터/경맥의 이전·다음 경혈로 넘어가는 버튼이 없어 한 경맥의 경혈을 차례로 넘기며 학습할 수 없습니다(U3).
  - 저장(북마크)한 경혈은 경혈 목록 패널 깊숙한 곳의 작은 칩(`저장 0`, [src/AtlasPage.tsx:687](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L687))으로만 필터링할 수 있으며 위키 화면에서는 전혀 볼 수 없습니다(U12).
- **영향받는 사용 사례:** U2, U3, U12

### D8. 깊이 막대(`ax-depth`)의 비선형 밀집과 모바일 계통명·단독 보기 누락 (심각도: **P1**)
- **근거 (직접 관찰):**
  - 스크린샷: [desktop-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-01-initial.png), [mobile-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-01-initial.png), [landscape-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/landscape-01-initial.png)
  - 코드: [src/AtlasPage.tsx:722-735](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L722-L735), [src/atlas.css:225-235](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L225-L235), [src/atlas.css:460-467](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L460-L467), [src/atlas.css:500-501](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L500-L501)
- **상세:** `stageDepth`(`0, 20, 68, 76, 84, 90, 95`) 백분율을 트랙 좌표(`--at-f`)로 그대로 배치해 20~68% 구간은 텅 비고 68~95% 구간에 5개 계통(골격·장기·혈관·림프·신경)이 몰려 있습니다. 모바일과 가로 화면에서는 현재 계통 외의 이름을 모두 숨기고 단독 보기(`Eye`) 버튼도 `display: none` 처리하여, 색 점만 보고는 어떤 계통인지 알 수 없고 계통 단독 보기도 불가능합니다.
- **영향받는 사용 사례:** U4, U9, U10

### D9. 첫 방문자 맥락 안내 부재(U1) 및 표시 설정 패널의 장문 안내문 상단 점유 (심각도: **P1**)
- **근거 (직접 관찰):**
  - 스크린샷: [desktop-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-01-initial.png), [desktop-06-display-settings.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-06-display-settings.png), [mobile-06-display-settings.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-06-display-settings.png)
  - 코드: [src/AnatomyControls.tsx:19-30](file:///Users/nuinuri/workspace/anatomy/src/AnatomyControls.tsx#L19-L30), [src/AnatomyControls.tsx:84-100](file:///Users/nuinuri/workspace/anatomy/src/AnatomyControls.tsx#L84-L100)
- **상세:** 첫 방문자에게 앱의 핵심 행동(경혈 검색·박리·장부 비교)을 안내하는 시작 장치가 없습니다. 반면 표시 설정 패널([mobile-06-display-settings.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-06-display-settings.png))은 맨 위에 6줄짜리 `.control-hint`가 자리 잡아 정작 조작부가 절반밖에 보이지 않습니다.
- **영향받는 사용 사례:** U1, U4, U7, U9

### D10. 모바일 세로 화면 우측 카메라 도구 기둥의 상시 점유와 수업·발표 모드(U8) 부재 (심각도: **P2**)
- **근거 (직접 관찰):**
  - 스크린샷: [mobile-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-01-initial.png), [mobile-05-structure-selected.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-05-structure-selected.png), [desktop-09-comparison.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-09-comparison.png)
  - 코드: [src/AtlasPage.tsx:912-925](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L912-L925), [src/atlas.css:472-481](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L472-L481)
- **상세:** 모바일 우측에 8칸 높이의 카메라 기둥(`.ax-camera`)이 상시 노출되어 3D 장면과 하단 시트 폭을 56px 잠식합니다. 또한 데스크톱 발표·수업 시 주변 UI를 접고 모델만 크게 보여주는 ‘클린 뷰(도구 최소화)’ 토글과 상시 접근 가능한 링크 공유 버튼이 없습니다.
- **영향받는 사용 사례:** U8, U9

### D11. 위키 모바일 목차 은닉, 409개 경혈 사전 무필터 나열, 키보드 캔버스 안내 부족 (심각도: **P2**)
- **근거 (직접 관찰):**
  - 스크린샷: [mobile-11-wiki-home.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-11-wiki-home.png), [mobile-12-wiki-point.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-12-wiki-point.png), [desktop-11-wiki-home.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-11-wiki-home.png)
  - 코드: [src/App.tsx:251-302](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L251-L302), [src/App.tsx:383-400](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L383-L400), [src/styles.css:1484-1491](file:///Users/nuinuri/workspace/anatomy/src/styles.css#L1484-L1491)
- **상세:** 모바일 위키에서 문서 목차(`.wiki-nav-group`)가 `:focus-within`일 때만 나타나 어떤 문서가 있는지 탐색하기 어렵고, 하단 경혈 사전은 409개를 필터 없이 나열합니다. 아틀라스에서는 캔버스 키보드 초점 시 조작 안내 배지가 없고 본문 건너뛰기(Skip link)가 없습니다.
- **영향받는 사용 사례:** U2, U11, U12

---

## 3. 설계 원칙 (5개)

1. **도구형 앱의 절제와 단일 시각 체계 (Tool-Grade Restraint)**
   마케팅 랜딩페이지 문법(영문 대문자 슬로건, 반짝이 아이콘, 거대 통계 숫자, 장식용 그라데이션)을 전면 배제하고, 아틀라스(다크 관찰 표면)와 위키·출처(고대비 뉴트럴 라이트 표면)가 동일한 타이포그래피·간격·강조색·테두리 토큰([src/design-system.css](file:///Users/nuinuri/workspace/anatomy/src/design-system.css))을 공유합니다.
2. **모델 우선과 비간섭 배치 (Model First & Zero Occlusion)**
   인체 3D 장면이 언제나 주 작업 공간입니다. 좌측 영역(검색·깊이), 우측 영역(선택 경혈·선택 구조·사이드 패널), 하단 영역(상태·경맥 바·시점 도구)이 서로 덮지 않도록 단일 슬롯 배타 규칙을 적용하고, 모바일 시트는 장면 높이의 45% 이하를 엄수합니다(Q10, Q25).
3. **조작이 먼저, 설명과 필터는 점진적 공개 (Controls First, Progressive Disclosure)**
   패널을 열었을 때 첫 화면에는 즉시 누를 수 있는 목록·슬라이더·핵심 행동 버튼이 먼저 보여야 합니다. 상세 필터와 출처·정합·한계 산문은 삭제하지 않고 한 줄 핵심 고지 + 펼침(`details/summary`) 또는 도움말 팝오버로 계층화합니다.
4. **탐색 흐름의 연속성 (Continuous Exploration Flow)**
   검색(정확도순) → 선택 → 이전/다음 경혈 순회(`‹`/`›`) → 장부 비교 → 위키 문서 → 3D 복귀까지 탭이나 패널을 불필요하게 다시 열지 않고 이어지게 하며, 모든 상태 전이는 [src/view-state.ts](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts)를 통과합니다(Q1–Q5, Q30).
5. **모든 입력 수단과 화면 크기의 동등성 (Cross-Viewport & Input Parity)**
   360px 소형 폰 한 손 조작부터 820px 태블릿, 1280×720 노트북, 844×390 가로 화면, 키보드·스크린리더까지 모든 기능이 잘림 없이 동등하게 작동해야 합니다(Q13, Q14, Q28).

---

## 4. 화면 크기별 배치 명세

### 4.1 데스크톱 (`≥ 1200px`, 예: `1440×900`)
- **핵심 규칙**:
  - 상단 `.ax-top`: 좌측 통합 검색(360px) + 첫 방문/상태 빠른 안내, 우측 범위·도구 바(남/여, 전신 부위, 방패, 표시 설정, 도움말, **도구 숨김/클린 뷰**).
  - 좌측 슬롯: 기본은 `.ax-depth`(폭 140px). 검색 패널(`.ax-results`)이 열리면 `.ax-depth`를 덮지 않고 우측으로 나란히 열리거나 검색 중에는 `.ax-depth`를 일시 페이드/비활성화하여 시각 충돌을 막음.
  - 우측 슬롯(`.ax-inspector`, 폭 352px): 상단에 **경혈 요약·순회 바**(`‹` `CV12 중완 · 모혈` `›` `확대` `공유` `북마크`). 그 아래 단일 도킹 영역에서 `경혈 상세` / `선택 구조·비교 카드` / `사이드 패널(경혈 목록·표시 설정·도움말)`이 겹치지 않고 교체·적치됨.
  - 하단 `.ax-bottom`: 좌측 상태·범례·출처 줄(최소 240px), 중앙 경혈·경맥 막대(15개 경맥을 좁은 칩 또는 좌우 스크롤 버튼과 함께 표시), 우측 시점·카메라 도구.

```text
+--------------------------------------------------------------------------------------------------+
| [결 GYEOL]                                         [3D 경혈 지도*]  [지식 위키]  [출처와 자료]   | 52px
+--------------------------------------------------------------------------------------------------+
| [🔍 경혈·구조·기관 검색 (/)        ]   [남성|여성] [전신 v] [🛡] [🔖저장] [⚙설정] [?도움] [⛶클린] |
|                                                                                                  |
| +----------+                                                  +--------------------------------+ |
| | 0.0%     |                                                  | [‹] ● CV12 중완 · 모혈 [›] [⌖][🔗]| |
| | 체표     |                                                  +--------------------------------+ |
| |----------|                                                  | (단일 우측 슬롯: 겹침 없음)    | |
| | ● 체표 👁|                    [ 3D 인체 모델 ]               | - 경혈 상세 카드 (탭 고정 스크롤)| |
| | ● 근육 👁|                     ┌──────────┐                 |   또는                         | |
| | ● 골격 👁|                     │ ● 중완   │                 | - 선택 구조 / 전통 장부 비교   | |
| | ● 장기 👁|                     └──────────┘                 |   또는                         | |
| | ● 혈관 👁|                  (주 작업 공간 확보)             | - 경혈 목록 / 표시 설정 / 도움말| |
| | ● 림프 👁|                                                  |                                | |
| | ● 신경 👁|                                                  +--------------------------------+ |
| +----------+                                                                                     |
|                                                                                                  |
| ● 모델 로드 완료 · 선택: 보이는 구조   +------------------------------------+  +---------------+ |
| ●선택 ●장부대응 ●참조 | BodyParts3D.. | [●경혈 409] [전체|폐경|대장경|..][🏷][☰] |  | [이동][정|후|측][+-⌖↺]| |
+--------------------------------------------------------------------------------------------------+
```

### 4.2 노트북·태블릿 (`701px – 1199px`, 낮은 높이 `1280×720` 및 태블릿 `820×1180` 포함)
- **핵심 규칙**:
  - **하단 2단 반응형 분리(`701px–1100px`)**: `tablet-01-initial.png`에서 확인된 `.ax-status`와 `.ax-meridians` 절단을 막기 위해, 폭이 1100px 이하일 때는 `.ax-status`(상태·범례·출처)를 `.ax-point-bar` 바로 위 좌측의 슬림한 인라인 줄로 올리고, 최하단 전폭을 `.ax-point-bar`와 `.ax-camera`만 공유하게 하여 태블릿에서도 경맥 칩이 8~10개 이상 한눈에 보이게 합니다.
  - **낮은 높이(`max-height: 760px`, 노트북 `1280×720`)**: `.ax-card`를 **고정 헤더 + 내부 스크롤 본문 + 고정 푸터** 3단 플렉스로 구성하여, `PointDetail`에서 `.concept-reference`를 컴팩트 배너(1줄 + 비교 버튼)로 줄이고 탭 본문과 하단 `위키에서 더 알아보기`·`링크 복사`가 잘리지 않게 합니다.

```text
[태블릿 820×1180 / 노트북 1280×720 배치]
+--------------------------------------------------------------------------------+
| [결 GYEOL]                           [3D 경혈 지도*]  [지식 위키]  [출처와 자료]|
+--------------------------------------------------------------------------------+
| [🔍 경혈·구조·기관 검색 (/) ]        [남|여] [전신 v] [🛡] [🔖] [⚙] [?] [⛶]    |
| +---------+                                      +---------------------------+ |
| | 0.0%    |                                      | [‹] ● CV12 중완·모혈 [›][⌖]| |
| | ●체표 👁|                                      +---------------------------+ |
| | ●근육 👁|            [ 3D 인체 모델 ]          | [고정 헤더: CV12 중완]     | |
| | ●골격 👁|               ● 중완                 | [컴팩트 비교 바: 위 [비교]]| |
| | ●장기 👁|                                      | [개요* | 효능 | 해부 | 근거]| |
| | ●혈관 👁|                                      | (내부 스크롤 본문 영역)    | |
| | ●림프 👁|                                      | [고정 푸터: 위키↗ | 링크🔗]| |
| | ●신경 👁|                                      +---------------------------+ |
| +---------+                                                                    |
| [● 로드 완료 · 내부 구조 | ●선택 ●비교 | BodyParts3D 남성 참조 · 근거 읽기 ↗]  |
| [●경혈 409 | 전체 | 폐경 | 대장경 | 위경 | 비경 | 심경 ... | 🏷 | ☰] [이동|정후측|+-⌖↺] |
+--------------------------------------------------------------------------------+
```

### 4.3 세로 모바일 (`≤ 700px`, `390×844` 및 소형 `360×740`)
- **핵심 규칙**:
  - **상단 2행 정리(소형 360px 대응)**: 1행에 `[🔍 경혈·구조·기관 검색]`(가변 폭 최소 170px 확보) + `[남|여]` + `[⚙설정]` + `[?도움]`만 배치해 검색어 입력이 절대 잘리지 않게 합니다. `[전신 부위 v]`와 `[🛡성기 가리기]`는 2행(깊이 막대 좌우 또는 컴팩트 칩 줄)으로 통합합니다.
  - **모바일 깊이 막대(`ax-depth`)**: 단순 색 점 나열 대신, 슬라이더 트랙 아래에 **7개 계통 약칭 칩(`체표·근육·골격·장기·혈관·림프·신경`)을 균등 간격**으로 배치하고, 현재 계통 옆에 `[👁만 보기]` 토글을 노출하여 모바일에서도 원탭 계통 전환·단독 보기가 가능하게 합니다.
  - **우측 카메라 도구 축약**: 8칸짜리 긴 기둥 대신 `[시점·이동]` 팝오버 버튼 + `[⌖맞춤]` + `[↺초기화]` 3칸(높이 116px)으로 줄여 3D 화면 가림을 최소화하고, 하단 시트(`.ax-inspector` / `.ax-side-panel`)가 좌우 전폭(`left: 8px; right: 8px`)을 모두 쓰게 합니다(시트가 열리면 카메라 버튼은 시트 위 우측으로 자동 이동).
  - **하단 시트(높이 ≤ 장면의 45%)**: 경혈 목록 시트는 `[검색 입력] + [필터 펼치기 (분류·부위·저장) ▾]` 1줄만 상단에 고정하고 **나머지 높이를 전부 실제 경혈 목록에 할당**하여 즉시 4~5개 경혈이 보이게 합니다.

```text
[세로 모바일 390×844 / 360×740]
+----------------------------------------+
| [결 GYEOL]   [3D지도*] [위키] [출처]    | 48px
+----------------------------------------+
| [🔍 경혈·구조 검색      ] [남|여][⚙][?]| 38px (검색 폭 충분 확보)
| [박리 0% ━━●━━━━━━━━] [전신v][👁만보기]| 52px (체표·근육·골격·장기·혈관·림프·신경)
| ● 모델 로드 완료                       |
|                                        |
|                                        |
|             [ 3D 인체 모델 ]           | (장면 최소 55% 이상 항상 노출)
|                 ● 중완                 |
|                                  +---+ |
|                                  |시점| | (컴팩트 3버튼: 시점·맞춤·초기화)
|                                  | ⌖ | |
|                                  | ↺ | |
|                                  +---+ |
+----------------------------------------+
| (열린 하단 시트 ≤ 45% 또는 경혈 칩 바)  |
| [‹] ● CV12 중완 · 모혈 [›]   [⌖] [🔗]  | (시트 닫힘 시 1줄 칩 바)
| --- 시트 열림 시 (전폭 사용): --------- |
| | 경혈 목록 409  [필터 ▾] [🔖저장] [✕] | |
| | [🔍 이름·코드·구조 필터 입력       ] | |
| | ● 중부 LU1  폐경 · 몸통 · 모혈       | | (목록 즉시 4~5행 노출!)
| | ● 운문 LU2  폐경 · 몸통 · 일반 경혈  | |
| | ● 천부 LU3  폐경 · 팔·손 · 일반 경혈 | |
+----------------------------------------+
| [●409][전체|폐경|대장경|위경..][🏷][☰] | 44px (하단 고정 경맥 바)
+----------------------------------------+
```

### 4.4 가로 모바일 (`높이 ≤ 500px`, 예: `844×390`)
- **핵심 규칙**:
  - 세로 높이가 346px(헤더 제외)뿐이므로 상하단 도구를 극도로 슬림화(상단 34px, 하단 36px)합니다.
  - 좌측에 컴팩트 깊이 막대(폭 116px, 현재 계통명 + 단독 보기 아이콘 포함), 우측에 단일 카드/패널 슬롯(폭 310px, 내부 고정 헤더 + 탭/목록 스크롤)을 배치하고, 중앙 400px 이상을 3D 모델 영역으로 보장합니다.
  - 패널 내부에서 필터 영역과 개념 설명은 기본 접힘(`details`) 상태로 두어 `844×390`에서도 경혈 상세 탭 본문과 경혈 목록 아이템이 즉시 최소 3행 이상 보이도록 합니다.

```text
[가로 모바일 844×390]
+------------------------------------------------------------------------------------+
| [결 GYEOL]                                    [3D 경혈 지도*] [지식 위키] [출처]    | 40px
+------------------------------------------------------------------------------------+
| [🔍 검색 (/)] [남|여][전신v][🛡][⚙][?][⛶]          [‹] ● CV12 중완 [›] [⌖] [🔗]    | 34px
| +-----------+                                     +------------------------------+ |
| |박리 0.0%  |                                     | CV12 중완 中脘 [모혈·위 비교]| |
| |●체표 [👁] |           [ 3D 인체 모델 ]          | [개요*|효능|해부|근거]  [🔖✕]| |
| |●근육 · · ·|               ● 중완                | 배꼽 위 4 B-cun, 앞정중선.   | |
| |●골격 · · ·|                                     | [⌖ 가까이] [위키 문서 ↗]     | |
| +-----------+                                     +------------------------------+ |
| [●완료] [●409|전체|폐경|대장경|위경|비경..|🏷|☰]      [이동] [정|후|측] [+|-|⌖|↺] | 36px
+------------------------------------------------------------------------------------+
```

---

## 5. 구성 요소별 변경

### 5.1 헤더 / 내비게이션 ([src/App.tsx:487-510](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L487-L510), [src/atlas.css:25-55](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L25-L55))
- 모든 페이지(`#atlas`, `#wiki`, `#sources`)에서 동일한 48px(모바일 44px) 슬림 도구 헤더를 사용합니다.
- 좌측에 `결 GYEOL` 브랜드와 함께 키보드 사용자를 위한 **본문/캔버스 바로가기(Skip link)**를 첫 포커스 요소로 추가합니다.
- 미사용 `.header-about`(`오픈 아틀라스`) 링크와 죽은 CSS([src/styles.css:80-158](file:///Users/nuinuri/workspace/anatomy/src/styles.css#L80-L158))를 제거하고 헤더 스타일을 [src/design-system.css](file:///Users/nuinuri/workspace/anatomy/src/design-system.css)로 일원화합니다.

### 5.2 통합 검색 ([src/AtlasPage.tsx:443-460](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L443-L460), [src/AtlasPage.tsx:587-638](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L587-L638))
- **정확도 우선 노출 및 카테고리 탭 제공**:
  - 검색어 입력 시 결과 패널 상단에 `[전체] [경혈 n] [해부 구조 n] [기관 상세 n]` 빠른 필터 칩을 제공합니다.
  - 경혈 검색([src/AtlasPage.tsx:445-446](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L445-L446))에도 구조 검색과 동일한 점수 정렬(코드/이름/병음 완전 일치 `0` → 시작 일치 `1` → 부분 일치 `2` → 해부 기준점/경맥 일치 `3`)을 적용하고, `전체` 탭에서는 경혈을 상위 5개만 먼저 보여준 뒤 `[경혈 결과 n개 모두 보기]`로 펼쳐, 구조 검색 결과가 40개 경혈 아래에 파묻히지 않게 합니다.
  - 구조 검색 결과([src/AtlasPage.tsx:618-631](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L618-L631))는 무조건 `layerKeys` 순서로 쪼개지 않고, **정확히 일치하거나 이름으로 시작하는 상위 결과(`score <= 1`)를 최상단 ‘정확한 일치’ 그룹에 먼저 노출**한 뒤 계통별 그룹을 보여줍니다. 이제 `'위'` 검색 시 첫 구조 결과가 근육 `'오른쪽 가시위근'`이 아니라 장기 `'위 (Stomach · FMA7148)'`가 됩니다.
- **소형 모바일 폭 확보**: `≤ 700px`에서 `.ax-top` 1행에는 검색창과 필수 토글(`남/여`, `표시 설정`, `도움말`)만 두어 360px 화면에서도 검색 입력창 폭을 170px 이상 확보합니다.

### 5.3 깊이·계통 막대 ([src/AtlasPage.tsx:708-737](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L708-L737), [src/atlas.css:207-235](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L207-L235), [src/atlas.css:449-467](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L449-L467))
- **데스크톱·노트북**: 7개 계통 버튼 목록을 비선형 절대 좌표(`top: calc(... * var(--at-f))`)로 겹치듯 몰아넣는 대신, 좌측에 연속 슬라이더 트랙(0~100%)을 두고 우측에 **균등한 간격(28px 행 높이)의 7개 계통 행(`체표 0%`, `근육 20%`, `골격 68%`, `장기 76%`, `혈관 84%`, `림프 90%`, `신경 95%`)과 `[👁단독]` 버튼**을 배치해 68~95% 구간의 클릭 오작동과 가독성 저하를 해결합니다.
- **모바일·가로 화면**: 점만 찍혀 있던 단계 표시를 **7계통 미니 칩(`체표|근육|골격|장기|혈관|림프|신경`) + 현재 계통 `[👁만 보기]` 토글**로 개선하여, 모바일에서도 설정 패널을 열지 않고 계통 이동과 단독 보기를 즉시 실행합니다.

### 5.4 경혈 막대·경맥 필터 ([src/AtlasPage.tsx:890-911](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L890-L911), [src/atlas.css:245-264](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L245-L264))
- 태블릿·작은 노트북(`701px–1100px`)에서 `.ax-status` 줄을 위로 분리해 `.ax-point-bar`의 가로 폭을 최소 220px 이상 추가 확보합니다.
- `.ax-meridians` 좌우에 스크롤 가능 여부를 알려주는 미세 페이드와 키보드/마우스용 좌우 스크롤 보조 버튼(또는 좁은 폭에서의 2줄 펼침 토글)을 추가해 14경맥+경외기혈 전체에 쉽게 접근하게 합니다.
- 경혈 막대 우측에 `[🔖 저장 n]` 빠른 필터 토글을 추가하여, 저장한 경혈만 모델 위에 즉시 남기거나 해제할 수 있게 합니다(U12).

### 5.5 경혈 칩·상세 패널 ([src/AtlasPage.tsx:50-147](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L50-L147), [src/AtlasPage.tsx:740-775](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L740-L775))
- **경혈 칩(`.ax-point-chip`) 강화**:
  - 현재 필터/경맥 목록(`found`) 내에서의 순번과 **이전/다음 경혈 버튼(`[‹]`, `[›]`)**을 칩 좌우에 추가합니다(예: 위경 선택 시 `ST35 ← ST36 족삼리 (36/45) → ST37`). 목록 패널을 열지 않고도 몸 위의 경혈을 차례로 넘기며 위치를 학습할 수 있습니다(U3).
  - 칩 옆에 `[⌖ 확대]`뿐 아니라 **`[🔗 링크 복사]`** 아이콘 버튼을 바로 배치해 상세 패널을 열지 않고도 현재 경혈 화면 링크를 즉시 공유할 수 있게 합니다(U8).
- **경혈 상세(`PointDetail`) 3단 고정 레이아웃**:
  - **상단 고정 헤더**: 경맥·분류 배지 + `CV12 중완 中脘 (Zhongwan)` + 북마크·링크복사·닫기 버튼 + **컴팩트 전통 장부 비교 바**(1줄 요약 + `[대응 장부(위) 비교]` 버튼 + `'전통적 분류이며 압력 전달 경로 아님'` 고정 한 줄 고지).
  - **중간 고정 탭 바**: `개요 | 효능·오행 | 해부 구조 | 근거` (기존 R3 키보드 방향키·Home/End 접근성 그대로 유지).
  - **내부 스크롤 본문(`.detail-content`)**: `landscape`·`small-mobile`에서도 탭 본문이 최소 120px 이상 항상 노출됩니다.
  - **하단 고정 푸터(`.detail-bottom`)**: `[위키에서 더 알아보기 ↗]` 버튼과 연결된 경혈 칩을 항상 카드 하단에 고정합니다.

### 5.6 선택 구조·비교·기관 상세 카드 ([src/AtlasPage.tsx:776-871](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L776-L871), [src/atlas.css:333-361](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L333-L361))
- **조작 버튼 상단/하단 고정과 출처 산문 계층화**:
  - 카드 상단에 선택 종류 배지(`전통 장부 비교` / `선택 구조` / `기관 상세 모델`), 구조 한글명·원문명·FMA ID, 그리고 필수 핵심 고지(`중완 · 위 비교 — 전통적 대응, 압력 경로 아님`, 여성 보완/CT 출처 1줄 요약)를 명확히 표시합니다.
  - `주변 반투명` 체크박스, `확대`, `비교 대상만 보기 / 선택 구조만 보기`, `전신으로 돌아가기`, `여성 CT 별도 상세` 등 **핵심 액션 버튼(`.selection-actions`)은 항상 스크롤 없이 보이는 고정 영역**에 둡니다.
  - 긴 기하학적·출처 설명(뇌 30쌍 교차, 폐 2014/2011 원본 구분, 췌장/콩팥 세부 설명)은 삭제하지 않고 기존처럼 `<details>` 안에 보존하되 기본 접힘 상태를 유지해 작은 화면에서 모델을 가리지 않게 합니다.

### 5.7 카메라·시점 도구 ([src/AtlasPage.tsx:912-925](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L912-L925), [src/atlas.css:362-375](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L362-L375), [src/atlas.css:472-478](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L472-L478))
- 데스크톱에서는 하단 우측의 `[이동] [정면|후면|측면] [+|-|⌖|↺]` 구성을 유지합니다.
- 모바일(`≤ 700px`)에서는 화면 우측을 길게 차지하던 8칸 기둥을 **`[시점·이동 ▴]`(누르면 정면/후면/측면 + 6방향 이동 패드 팝오버 열림) + `[⌖ 맞춤]` + `[↺ 초기화]`** 3버튼 캡슐로 축약하고, 하단 시트가 열릴 때는 시트 상단 우측 위로 자연스럽게 자리 잡게 하여 시트 폭이 깎이지 않게 합니다.

### 5.8 상태·범례·출처 줄 ([src/AtlasPage.tsx:875-889](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L875-L889), [src/atlas.css:377-392](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L377-L392))
- 색만으로 의미를 전달하지 않는 원칙(Q12/화면 원칙)에 따라 선택·비교 활성 시 `●선택 구조 ●전통 장부 대응 ●경혈 참조` 범례를 데스크톱·태블릿·모바일 모두에서 1줄 캡슐로 유지합니다.
- 출처·한계 줄(`BodyParts3D 남성 참조...`, `HRA 여성 전신 1,220개 + 남성 원본 정합 보완...`)이 좁은 화면에서 낱말 중간에 잘리지 않도록 태블릿 이하에서는 상태 바를 경혈 바 위쪽 독립 줄로 분리하고, 모바일에서는 상태 배지 옆 `[출처·근거 ↗]` 링크로 연결합니다.

### 5.9 표시 설정 패널 ([src/AnatomyControls.tsx:1-170](file:///Users/nuinuri/workspace/anatomy/src/AnatomyControls.tsx#L1-L170), [src/atlas.css:165-205](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L165-L205))
- **컨트롤 우선 배치**: 패널을 열자마자 ① **7계통 켜기/끄기 및 불투명도 슬라이더**, ② **인대·힘줄 표시 및 단독 보기(연청색/진주색 견본·개수 유지, Q27)**, ③ **경혈 표식 범위·이름 표시·클릭 선택 대상**, ④ **앞쪽 구조 일부 숨기기(단면 아님 고지 포함, Q8)**, ⑤ **성기 가리기(Q32)**가 즉시 한눈에 보이도록 배치합니다.
- 맨 위에 있던 6줄짜리 일반 안내문([src/AnatomyControls.tsx:25-30](file:///Users/nuinuri/workspace/anatomy/src/AnatomyControls.tsx#L25-L30))과 여성 보완 상세 안내([src/AnatomyControls.tsx:19-21](file:///Users/nuinuri/workspace/anatomy/src/AnatomyControls.tsx#L19-L21))는 삭제하지 않고 각 섹션 하단의 간결한 1줄 요약 + `<details><summary>자세한 출처·정합 기준 보기</summary>...</details>`로 정리하여 모바일에서도 스크롤 없이 주요 설정을 조작할 수 있게 합니다.

### 5.10 도움말·첫 방문 안내 (U1, U8)
- **첫 방문 퀵스타트 바 (U1)**: 첫 방문자(`localStorage` 기준 닫기 전 또는 도움말에서 다시 열기 가능)에게 상단 검색바 아래에 비모달 1줄 안내 바를 표시합니다:
  `💡 시작하기: ① 몸 위의 경혈 점을 누르거나 검색(/) → ② [대응 장부 비교]로 내부 장기 확인 → ③ 왼쪽 막대로 근육·골격 박리` + `[대표 경혈: 족삼리 ST36 보기]` `[닫기 ✕]`.
- **도움말 패널 구조화**: 줄글 6문단([desktop-08-help.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-08-help.png))을 **① 3가지 핵심 사용법(경혈·박리·비교), ② 마우스·터치·키보드 단축키 표(`WASD/QE`, `Alt+휠/↑↓`, `/`, `Esc`), ③ 데이터·정합 한계 고지 및 위키 가이드 링크**의 3개 섹션 카드로 정리해 스캔 가능성을 높입니다.

### 5.11 위키 페이지 (`#wiki`, [src/App.tsx:108-407](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L108-L407), [src/styles.css:630-1068](file:///Users/nuinuri/workspace/anatomy/src/styles.css#L630-L1068))
- **‘AI스러운 UI’ 전면 제거 및 도구형 문서 허브로 개편**:
  - `Sparkles` 아이콘, `A LIVING, SOURCE-GROUNDED WIKI`, `GYEOL KNOWLEDGE`, `START HERE`, `ACUPOINT INDEX` 영문 대문자 eyebrow, `연결하며 이해하는 우리 몸의 지식.` 슬로건 히어로, 장식용 큰 숫자 통계, 카드 번호(`01`, `02`...)를 모두 제거합니다.
  - 대신 상단에 **`← {선택 경혈} 3D 보기로 돌아가기` 복귀 바(Q5)**와 **통합 위키 검색 및 질문 바**(기존 문서 제목/본문 필터와 `/api/ask` 및 정적 지식 검색을 하나의 깔끔한 도구형 검색창으로 통합하고, 결과 출처와 `위키 검색 · 생성형 답변 아님` / `LLM 요약` 배지는 그대로 유지)를 배치합니다.
  - **주제 가이드 목록**: 카테고리별(`시작하기`, `학습 가이드`, `경혈 이론`, `기초 개념`, `근거 읽기`, `데이터 방법론`) 정돈된 문서 리스트로 배치합니다.
  - **경혈 사전 필터링**: 409개 경혈을 무작정 나열하지 않고, 상단에 **[전체] [저장한 경혈 🔖] [14경맥 + 경외기혈 칩]** 필터와 코드/이름 검색을 제공하여 위키에서도 경혈 문서를 즉시 찾게 합니다(U12).
  - **모바일 목차 드로어**: 모바일(`≤ 700px`)에서 숨겨져 있던 사이드바 목차를 `[☰ 문서 목차 (419)]` 토글 버튼으로 언제든 펼쳐 볼 수 있게 합니다.

### 5.12 출처 페이지 (`#sources`, [src/App.tsx:408-460](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L408-L460), [src/styles.css:1069-1147](file:///Users/nuinuri/workspace/anatomy/src/styles.css#L1069-L1147))
- `TRACEABLE BY DESIGN`, `지식의 시작, 출처.`, `01`·`02` 장식 번호를 제거하고, 명확한 제목(**출처와 자료 — 위치 표준·임상 근거·3D 해부 모델**)과 분류 배지(`위치 표준`, `명칭 표준`, `근거 개요`, `실무 기준`, `3D 해부 모델`) 중심의 레퍼런스 테이블/카드 레이아웃으로 정리합니다.

### 5.13 디자인 토큰 ([src/design-system.css](file:///Users/nuinuri/workspace/anatomy/src/design-system.css))
[src/styles.css](file:///Users/nuinuri/workspace/anatomy/src/styles.css), [src/design-system.css](file:///Users/nuinuri/workspace/anatomy/src/design-system.css), [src/atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css)에 흩어진 토큰을 [src/design-system.css](file:///Users/nuinuri/workspace/anatomy/src/design-system.css) 하나로 통합합니다.

- **색상 (Colors)**:
  - 아틀라스 다크 테마(Q23 준수): `--ax-stage: #08131a`, `--ax-surface: #0f1d26`, `--ax-surface-2: #162834`, `--ax-raised: #1e3544`, `--ax-line: #2a4452`, `--ax-text: #edf3f6` (대비 13.8:1), `--ax-muted: #a8bdc7` (대비 7.2:1 ≥ 4.5:1).
  - 문서(위키·출처) 라이트 테마(Q14 준수): `--doc-bg: #f6f8f9`, `--doc-surface: #ffffff`, `--doc-surface-subtle: #eef2f5`, `--doc-line: #d0dbe2`, `--doc-ink: #12212b` (대비 15.1:1), `--doc-muted: #465a65` (대비 6.8:1 ≥ 4.5:1), `--doc-accent: #0e6378`.
  - 공통 강조색: 주 조작 강조 `--ax-accent: #5ecce0` (다크 위) / `#0e6378` (라이트 위), 경혈·비교 보조 강조 `--ax-gold: #e6b455`.
- **글자 (Typography)**:
  - 본문·조작 기본 폰트: `-apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif` (불필요한 외부 `DM Sans` 웹폰트 의존 제거).
  - 크기 체계: 최소 크기 `12px`(`--fs-xs: 12px`), 기본 도구/본문 `13px–14px`(`--fs-sm: 13px`, `--fs-md: 14px`), 카드 제목 `16px–18px`(`--fs-lg: 17px`), 문서 제목 `22px–26px`(`--fs-xl: 24px`).
- **간격·모서리·그림자**:
  - 4px 배수 간격(`4, 8, 12, 16, 24px`), 도구 모서리 반경 `--radius-sm: 6px`, `--radius-md: 8px`, `--radius-lg: 10px` (과도한 15px~20px 알약형 남용 배제), 단정한 경계선(`1px solid`)과 절제된 단일 그림자(`0 8px 24px rgba(0,0,0,0.32)`).

---

## 6. 제안 목록 표 (`A-` 접두사)

| ID | 우선순위 | 제목 | 구체적 변경 | 근거 (스크린샷 / `파일:줄`) | 영향 파일 | 위험 |
| --- | --- | --- | --- | --- | --- | --- |
| **A-1** | **P0** | 통합 검색 정확도 정렬 복원 및 카테고리 탭 분리 | 1) 검색 결과 상단에 `전체/경혈/구조/기관` 필터 탭 추가.<br>2) `pointResults`에 정확도 점수 정렬(코드·이름 일치 우선) 적용 및 `전체` 탭에서 상위 5개만 우선 노출(나머지는 펼침).<br>3) `structureResults` 렌더링 시 `score <= 1`(완전·시작 일치) 구조를 계통 묶음보다 최상단에 먼저 노출해 `'위'` 검색 시 첫 구조 결과가 `'위(Stomach)'`가 되도록 수정. | [desktop-04-search-query.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-04-search-query.png), [desktop-05-structure-selected.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-05-structure-selected.png), [src/AtlasPage.tsx:445-460](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L445-L460), [src/AtlasPage.tsx:587-638](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L587-L638) | `src/AtlasPage.tsx`, `src/atlas.css` | 기존 E2E 검색 테스트가 `.structure-item` 첫 요소를 클릭할 때 실제 장기 `'위'`가 선택되므로 스냅샷/단언 확인 필요. |
| **A-2** | **P0** | 경혈 목록 패널의 상세 필터 접이식 전환 및 목록 가시성 확보 | `panel === "points"`에서 4개 셀렉트(`분류/부위/경맥/범위`)와 부위 칩을 `<details className="ax-filter-drawer">`로 묶어 모바일·가로 화면에서는 기본 접힘(필터 활성 시 배지 표시)으로 두고, 패널을 열자마자 `.point-list`가 최소 4행 이상 보이게 변경. | [mobile-07-point-list.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-07-point-list.png), [small-mobile-07-point-list.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/small-mobile-07-point-list.png), [landscape-07-point-list.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/landscape-07-point-list.png), [src/AtlasPage.tsx:664-705](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L664-L705), [docs/QUALITY_STANDARD.md:11](file:///Users/nuinuri/workspace/anatomy/docs/QUALITY_STANDARD.md#L11) | `src/AtlasPage.tsx`, `src/atlas.css` | E2E 테스트에서 필터 셀렉트를 조작할 때 `<details>`가 닫혀 있으면 클릭이 막힐 수 있으므로 데스크톱은 기본 열림 또는 테스트 헬퍼 확인. |
| **A-3** | **P0** | 좌·우 패널 슬롯 배타 배치로 깊이 막대·경혈 칩 덮임 해소 | 1) 우측 `.ax-side-panel`(`display`/`help`/`points`)을 `.ax-inspector`와 동일한 우측 컨테이너 흐름에 통합하거나, 사이드 패널 열림 시 데스크톱에서도 `.ax-inspector` 카드를 일시 전환.<br>2) 좌측 `.ax-results`(검색 결과) 열림 시 `.ax-depth`가 밑에 비쳐 겹치지 않도록 `data-panel="search"`일 때 `.ax-depth`를 숨기거나 `.ax-results` 우측에 배치. | [desktop-03-search-empty.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-03-search-empty.png), [tablet-03-search-empty.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/tablet-03-search-empty.png), [desktop-06-display-settings.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-06-display-settings.png), [src/atlas.css:134](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L134), [src/atlas.css:161](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L161), [src/atlas.css:266-269](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L266-L269) | `src/AtlasPage.tsx`, `src/atlas.css` | `npm run test:visual` 및 `npm run audit:overlays`의 요소 경계 측정 통과 여부 반드시 검증(Q25). |
| **A-4** | **P0** | 소형 모바일(360px) 상단 바 및 태블릿(820px) 하단 바 반응형 개편 | 1) `≤ 700px`에서 `.ax-top` 1행에 `[검색] [남|여] [설정] [도움말]`만 두어 360px에서도 검색창 폭 170px+ 확보, `[전신 부위 v]`와 `[🛡]`는 2행 깊이 바 옆으로 이동.<br>2) `701px–1100px`에서 `.ax-status`를 `.ax-point-bar` 위쪽 줄로 분리해 태블릿에서 상태 문구 잘림과 경맥 칩 절단(`폐경`만 보임) 해결. | [small-mobile-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/small-mobile-01-initial.png), [tablet-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/tablet-01-initial.png), [src/atlas.css:239-261](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L239-L261), [src/atlas.css:434-443](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L434-L443) | `src/AtlasPage.tsx`, `src/atlas.css` | 상단 2행 높이가 늘어나지 않도록 모바일 2행 패딩·높이를 48px 이내로 제한해 모델 영역 확보(Q10). |
| **A-5** | **P1** | 경혈 상세(`PointDetail`) 고정 헤더·탭·푸터 분리 및 비교 박스 압축 | `.detail-panel`을 `flex-direction: column`으로 구성해 상단(경혈명 + 컴팩트 장부 비교 바)과 탭 바, 하단(`위키에서 더 알아보기` + `링크 복사`)은 고정하고 `.detail-content`만 내부 스크롤 처리. `landscape`와 `small-mobile`에서도 탭 본문이 즉시 보이게 개선. | [landscape-02-point-detail.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/landscape-02-point-detail.png), [small-mobile-02-point-detail.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/small-mobile-02-point-detail.png), [laptop-02-point-detail.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/laptop-02-point-detail.png), [src/AtlasPage.tsx:74-145](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L74-L145) | `src/AtlasPage.tsx`, `src/atlas.css` | R3(탭 키보드 이동 및 `tabpanel` 포커스)와 R4(여성 CT 비교 피드백 스크롤)가 내부 스크롤 컨테이너에서도 동일하게 동작하는지 검증. |
| **A-6** | **P1** | 경혈 칩 이전/다음(`‹`/`›`) 순회 버튼 및 북마크·공유 바로가기 | 1) `.ax-point-chip`에 현재 필터 결과(`found`) 내 이전/다음 경혈로 이동하는 `‹`/`›` 버튼 추가(목록 패널을 다시 열지 않고도 경맥 순차 탐색).<br>2) 칩 옆에 `[🔗 링크 복사]` 버튼 추가.<br>3) 경혈 막대에 `[🔖 저장 n]` 원탭 필터 토글 추가. | [desktop-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-01-initial.png), [src/AtlasPage.tsx:270-281](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L270-L281), [src/AtlasPage.tsx:748-758](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L748-L758) | `src/AtlasPage.tsx`, `src/atlas.css` | 경혈 칩 폭이 넓어져 모바일에서 넘치지 않도록 모바일에서는 순번 텍스트를 숨기고 화살표 아이콘만 컴팩트하게 표시. |
| **A-7** | **P1** | 깊이 막대(`ax-depth`) 균등 계통 행 배치 및 모바일 단독 보기 복원 | 1) 데스크톱 `.depth-steps`의 비선형 겹침(`--at-f` 68~95% 과밀)을 해소하고, 좌측 연속 트랙 + 우측 균등 7계통 버튼 및 `[👁단독]` 구조로 정돈.<br>2) 모바일·가로 화면에서도 7계통 약칭 칩과 활성 계통 `[👁만 보기]` 버튼을 노출. | [desktop-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-01-initial.png), [mobile-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-01-initial.png), [landscape-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/landscape-01-initial.png), [src/AtlasPage.tsx:708-737](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L708-L737), [src/atlas.css:225-235](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L225-L235), [src/atlas.css:460-467](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L460-L467) | `src/AtlasPage.tsx`, `src/atlas.css` | `stageDepth` 값(0/20/68/76/84/90/95%)과 `view-state.ts`의 `dissection`/`stage` 액션 계약(Q20)은 절대 변경하지 않고 시각적 간격만 정리. |
| **A-8** | **P1** | 표시 설정 패널 컨트롤 우선 배치 및 산문 안내의 접이식 정리 | `AnatomyControls` 최상단의 6줄 안내문과 여성 보완 장문 설명을 각 설정 블록 하단의 1줄 핵심 고지 + `<details><summary>자세한 출처·정합 기준</summary>...</details>`로 이동해, 모바일에서도 패널을 열자마자 7계통 슬라이더와 인대·힘줄 설정이 한눈에 보이게 개선. | [mobile-06-display-settings.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-06-display-settings.png), [desktop-06-display-settings.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-06-display-settings.png), [src/AnatomyControls.tsx:19-30](file:///Users/nuinuri/workspace/anatomy/src/AnatomyControls.tsx#L19-L30), [src/AnatomyControls.tsx:84-100](file:///Users/nuinuri/workspace/anatomy/src/AnatomyControls.tsx#L84-L100) | `src/AnatomyControls.tsx`, `src/atlas.css` | 기존 텍스트 단언 테스트(`connective.spec.ts` 등)가 찾는 문구·색상 견본·개수(Q27)가 DOM에 그대로 존재하도록 유지. |
| **A-9** | **P1** | 위키·출처 페이지의 ‘AI스러운 UI’ 제거, 토큰 통합 및 죽은 CSS 정리 | 1) `Sparkles` 아이콘, 영문 대문자 eyebrow(`A LIVING...`, `TRACEABLE BY DESIGN` 등), 슬로건 히어로, 장식용 숫자 통계, 카드 번호(`01`, `02`) 제거.<br>2) `WikiAssistant`를 도구형 ‘위키 문서·근거 검색’ 바로 통합.<br>3) 위키 경혈 사전에 경맥 칩·북마크 필터 추가 및 모바일 목차 토글 제공.<br>4) [src/styles.css](file:///Users/nuinuri/workspace/anatomy/src/styles.css)의 미사용 구버전 아틀라스 CSS 약 700줄 삭제 및 [src/design-system.css](file:///Users/nuinuri/workspace/anatomy/src/design-system.css) 토큰으로 통합. | [desktop-11-wiki-home.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-11-wiki-home.png), [desktop-13-sources.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-13-sources.png), [mobile-11-wiki-home.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-11-wiki-home.png), [src/App.tsx:108-460](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L108-L460), [src/styles.css:200-556](file:///Users/nuinuri/workspace/anatomy/src/styles.css#L200-L556) | `src/App.tsx`, `src/design-system.css`, `src/styles.css` | 위키/출처 E2E 및 프로덕션 스모크(`test:production`)에서 검사하는 제목·폼·링크 선택자 호환성 유지. |
| **A-10** | **P1** | 첫 방문자 인라인 안내 바(U1) 및 구조화된 도움말 패널 | 첫 진입 시 검색바 아래에 1줄 퀵스타트 안내(경혈 선택·박리·장부 비교 요약 + 대표 경혈 바로가기 + 닫기)를 제공하고, 도움말 패널을 [핵심 기능 / 단축키 표 / 데이터 한계·출처] 3단 구조로 개편. | [desktop-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-01-initial.png), [desktop-08-help.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/desktop-08-help.png), [src/AtlasPage.tsx:647-661](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L647-L661) | `src/AtlasPage.tsx`, `src/atlas.css` | 첫 방문 바가 `test:visual` 및 `audit:overlays`에서 다른 오버레이와 겹치지 않도록 도움말 패널 내부 또는 상단 비간섭 위치로 설계. |
| **A-11** | **P2** | 모바일 카메라 기둥 축약(한 손 모드) 및 발표용 클린 뷰(U8) | 1) 모바일(`≤ 700px`) 우측 8칸 카메라 기둥을 `[시점·이동] [⌖] [↺]` 3칸으로 줄이고 하단 시트가 좌우 전폭(`100% - 16px`)을 쓰게 개선.<br>2) 상단 바에 `[⛶ 도구 숨김(클린 뷰)]` 토글을 추가해 발표·수업 시 모델과 선택 경혈 칩만 남길 수 있게 지원. | [mobile-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-01-initial.png), [mobile-05-structure-selected.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/baseline/mobile-05-structure-selected.png), [src/AtlasPage.tsx:912-925](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L912-L925), [src/atlas.css:472-481](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L472-L481) | `src/AtlasPage.tsx`, `src/atlas.css` | 모바일에서 `정면/후면/측면` 및 `이동` 버튼을 찾는 기존 테스트가 깨지지 않도록 접근 가능한 `summary/details` 구조 유지. |
| **A-12** | **P2** | 키보드 스킵 링크 및 캔버스 포커스 단축키 배지(U11) | 1) 헤더 첫 요소로 `3D 모델/본문으로 건너뛰기` 스킵 링크 추가.<br>2) `canvas:focus-visible` 상태일 때 하단 상태 줄에 `키보드 조작 활성: WASD/방향키 이동 · Q/E 상하 · Alt+↑↓ 박리` 인라인 배지 표시. | [src/App.tsx:487](file:///Users/nuinuri/workspace/anatomy/src/App.tsx#L487), [src/AtlasPage.tsx:513-520](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L513-L520), [docs/QUALITY_STANDARD.md:33](file:///Users/nuinuri/workspace/anatomy/docs/QUALITY_STANDARD.md#L33) | `src/App.tsx`, `src/AtlasPage.tsx`, `src/atlas.css` | 캔버스 외 요소 포커스 시에는 배지를 숨겨 화면 복잡도 증가 방지. |

---

## 7. 사용 사례 커버리지 표 (U1–U12)

| ID | 사용 사례 | 개선 후 동작 및 해결 근거 |
| --- | --- | --- |
| **U1** | 처음 방문자가 무엇을 할 수 있는지 바로 이해하고 첫 경혈을 찾음 | 첫 진입 시 상단 요약 안내(또는 구조화된 도움말)로 ‘경혈 선택 · 계통 박리 · 전통 장부 비교’ 3대 기능을 즉시 파악하고, 검색창(`/`)이나 몸 위의 표식·경맥 칩을 눌러 첫 경혈을 찾습니다 (**A-1, A-10**). |
| **U2** | 코드·이름·병음(ST36, 족삼리, zusanli)으로 경혈 검색 → 위치 확인 → 상세 읽기 → 위키 문서 → 원래 보기로 복귀 | 통합 검색에서 정확도순으로 정렬된 `ST36 족삼리`를 선택해 위치를 확인하고, 고정 탭/푸터 구조의 상세 카드에서 모든 탭과 `[위키에서 더 알아보기]`를 스크롤 잘림 없이 읽은 뒤, 위키 상단 `← 족삼리 3D 보기로 돌아가기`로 직전 카메라·레이어·비교 상태를 그대로 복원합니다 (**A-1, A-5, Q5**). |
| **U3** | 경맥별 탐색: 한 경맥 표식만 보기, 이름표 켜기, 목록에서 차례로 넘기기 | 하단 경맥 바에서 경맥(예: `위경`)과 `[🏷 이름표]`를 켜고, 우측 경혈 칩의 **`[‹] / [›]` 이전·다음 버튼**을 눌러 목록 패널을 다시 열지 않고도 `ST1 → ST2 → ... → ST45`를 차례대로 따라가며 3D 몸 위에서 학습합니다 (**A-4, A-6**). |
| **U4** | 해부 탐색: 박리 깊이 조절, 계통만 보기, 모델에서 구조 눌러 선택, 확대·단독 보기·주변 반투명 | 좌측(모바일은 상단) 깊이 막대에서 0~100% 연속 박리하거나 균등 배치된 7계통 이름·`[👁단독]` 버튼을 누릅니다. 모델 위 구조를 직접 누르면 카메라 점프 없이 회전 중심이 되고(Q28, Q30), 선택 카드의 고정 액션 바에서 `주변 반투명`, `확대`, `선택 구조만 보기`를 즉시 조작합니다 (**A-3, A-7**). |
| **U5** | 구조 검색: 한국어/영어/FMA(위, stomach, FMA7148) → 선택 → 기관 상세 모델 → 전신 복귀 | `'위'` 또는 `'FMA7148'` 검색 시 완전 일치(`score 0`)가 최상단에 노출되어 근육(`가시위근`)에 밀리지 않고 바로 장기 `'위'` 또는 `'위 · 위동맥·위정맥'` 상세 모델을 선택합니다. 상세 카드 하단 고정 버튼 `[전신으로 돌아가기]`로 직전 박리·카메라 상태로 복귀합니다 (**A-1, A-3**). |
| **U6** | 전통 장부 비교: 중완 → 위 비교 → 비교 대상만 보기 → 해제(‘전통적 대응, 압력 경로 아님’ 고지 유지) | `중완 CV12` 상세의 컴팩트 비교 바에서 `[대응 장부의 해부 구조 비교]`를 실행하면 체표 반투명 + 위 강조 화면으로 전환되고, 비교 카드 안에 `'중완 · 위 비교 — 전통적 대응, 압력 경로 아님'` 고지와 `[비교 대상만 보기]`, `[✕ 해제]`가 고정 노출됩니다 (**A-5, Q3, Q25**). |
| **U7** | 남/여 전환, 여성 근사 표식 켜기, 여성 CT 별도 상세 | 상단 `[남성|여성]` 전환 후 하단 바에서 `[근사 위치로 보기]`(금색 `근사` 토글, Q26)를 켜거나, 여성 `중완 → 위` 비교 카드에서 출처 고지 확인 후 `[위 (여성 CT) 상세]`를 명시적으로 눌러 별도 CT 상세를 봅니다 (**A-4, A-8, Q24, Q31, Q33**). |
| **U8** | 수업·발표: 큰 화면에서 도구를 최소화한 깨끗한 화면, 링크 공유로 같은 경혈 화면 재현 | 상단 `[⛶ 클린 뷰]` 버튼으로 주변 패널·막대를 숨겨 3D 인체 모델과 현재 경혈/구조 칩만 깨끗하게 띄우고, 경혈 칩 옆 `[🔗 링크 복사]` 버튼 한 번으로 `#atlas/CV12` 주소를 복사·공유합니다 (**A-6, A-11**). |
| **U9** | 모바일 세로 한 손 사용(엄지 영역), 패널이 모델을 다 가리지 않음, 가로 회전 | 소형 모바일(360px)에서도 상단 검색창이 잘리지 않고, 우측 카메라 기둥을 3버튼으로 축약해 하단 시트(장면 높이 45% 이하)가 전폭을 쓰며, 경혈 목록·상세·설정 시트 모두 엄지 영역에서 즉시 목록과 컨트롤을 조작할 수 있습니다. 가로 회전(`844×390`) 시 좌우 분할로 모델과 본문이 함께 보입니다 (**A-2, A-4, A-5, A-11**). |
| **U10** | 태블릿 세로/가로, 노트북 1280×720 같은 낮은 높이 | 태블릿(`820×1180`)에서는 상태 줄과 경맥 바를 2단 분리해 경맥 칩 잘림을 막고, 노트북(`1280×720`)에서는 우측 카드의 헤더·탭·푸터 고정 및 내부 스크롤로 버튼 잘림을 원천 방지합니다 (**A-3, A-4, A-5**). |
| **U11** | 키보드 전용·스크린리더 사용자 | 스킵 링크, `/` 검색 열기 및 `Esc` 초점 복귀(R1/R2), 상세 탭 방향키·Home/End 이동(R3), 모든 아이콘 버튼의 호버·초점 툴팁(R8), 캔버스 포커스 시 키보드 이동(`WASD/QE`, `Alt+↑↓`) 안내 배지로 완전한 키보드·낭독기 동선을 제공합니다 (**A-5, A-12, Q13**). |
| **U12** | 3D 없이 위키 읽기·출처 확인, 저장한 경혈 다시 보기 | `#wiki`와 `#sources`는 WebGL/GLB 다운로드 없이 즉시 열리며(Q9), 절제된 도구형 문서 레이아웃과 경맥별·저장 경혈(`🔖`) 필터로 409개 경혈 문서와 출처를 탐색하고, 아틀라스 하단 바의 `[🔖 저장 n]` 버튼으로 북마크한 경혈만 바로 모아 봅니다 (**A-6, A-9**). |

---

## 8. 유지할 것 / 하지 않을 것

### 반드시 유지할 것 (Preserve)
1. **상태 전이 단일 경로**: 모든 레이어·박리·단독·비교·표식·성별·부위·카메라 전이는 오직 [src/view-state.ts](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts)의 `viewReducer`와 `restoreView`를 거칩니다.
2. **2026-10-05 합의 보정(R1–R8) 및 품질 기준(Q1–Q33)**:
   - `/` 단축키 및 `Escape` 닫기 시 이전 실행 요소로의 정확한 초점 복귀(R1, R2).
   - 경혈 상세 탭의 WAI-ARIA `tablist`/`tab`/`tabpanel` 연결과 방향키·Home/End 이동(R3).
   - 여성 비교의 명시적 CT 상세 버튼 복원(R4, Q33), 비교 묶음과 인대·일반 묶음 문구 구분(R5).
   - 홈/뒤로 가기(`#atlas`) 및 위키 왕복 시 경혈·레이어·비교·카메라 상태 복원(R6, Q5).
   - 미선택 시 가짜 참조 강조 제거(R7) 및 아이콘 버튼의 호버·키보드 초점 설명(`data-tip`, R8).
   - 0%에서 7계통 존재 후 바깥부터 박리되는 규칙(Q20), 인대(무광 연청색)·힘줄(윤기 진주색) 색 구분과 견본·개수 표시(Q27), 경혈 화면 원 우선 선택과 직접 클릭 구조의 제자리 회전 중심(Q28, Q30), 성기 가리기 방패 버튼과 체크박스 동기화(Q32).
3. **데이터 정직성과 고지 문구**:
   - 한국어 구조 검색의 영어 원문명·TA2 라틴명·FMA ID 병기(Q7, Q21).
   - ‘전통적 대응, 압력 경로 아님’, ‘학습용 근사 위치 · 전문가 미검수’, 여성 정합 보완(`FT_`) 및 뇌–머리뼈 교차·별도 CT 출처 고지 문구 전체 보존.

### 절대 하지 않을 것 (Do Not Do)
1. **`view-state.ts`를 우회하는 로컬 레이어/선택 상태 추가 금지**: UI 개편을 이유로 별도의 React state로 가시 메쉬나 투명도를 조작하지 않습니다.
2. **‘AI스러운’ 장식 요소 재도입 금지**: 네온 글로우, 다중 반투명 블러 카드 중첩, 의미 없는 영문 대문자 슬로건, 반짝이 아이콘, 이모지 남발을 하지 않습니다.
3. **모바일 전체 화면 모달로 3D 장면 가리기 금지**: 모바일 패널은 언제나 장면의 45% 이하 하단/상단 시트로 열어 인체 모델과 함께 보이게 합니다(Q10).
4. **정직성·한계 고지 삭제 금지**: 화면을 깔끔하게 만든다는 이유로 출처·미검수·정합 한계 문구를 삭제하거나 임상 효능·압력 경로처럼 오해될 표현으로 바꾸지 않습니다.

---

## 9. 구현 순서 및 단계별 검증 방법

구현은 상태 회귀를 막기 위해 **작고 독립적으로 검증 가능한 5단계**로 진행합니다.

### 1단계: 디자인 토큰 통합 및 위키·출처 ‘AI스러운 UI’ 제거 (**A-9**)
- **작업**:
  - [src/design-system.css](file:///Users/nuinuri/workspace/anatomy/src/design-system.css)에 아틀라스(다크)·문서(라이트) 공통 토큰 정의.
  - [src/styles.css](file:///Users/nuinuri/workspace/anatomy/src/styles.css)에서 미사용 구버전 아틀라스 CSS(약 700줄) 제거 및 위키·출처 스타일 정리.
  - [src/App.tsx](file:///Users/nuinuri/workspace/anatomy/src/App.tsx)에서 `Sparkles`, 영문 대문자 eyebrow, 슬로건 히어로, 장식 통계 제거 및 위키 경혈 사전 필터·모바일 목차 토글 추가.
- **검증**:
  - `npm test` 및 `npm run build` 통과.
  - `npm run test:production`으로 위키 최초 진입 시 WebGL/GLB 요청 0건(Q9) 및 위키 질문/문서 이동 확인.
  - `desktop/mobile`의 `11-wiki-home`, `12-wiki-point`, `13-sources` 스크린샷 대조.

### 2단계: 통합 검색 정확도 복원 및 결과 탭 분리 (**A-1**)
- **작업**:
  - [src/AtlasPage.tsx](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx)의 `pointResults`에 정확도 정렬 추가, 검색 결과 패널 상단에 `전체/경혈/구조/기관` 탭 추가, `structureResults`에서 완전·시작 일치(`score <= 1`) 최상단 노출.
- **검증**:
  - 단위/브라우저 테스트 추가: `'위'`, `'stomach'`, `'FMA7148'`, `'ST36'`, `'족삼리'` 검색 시 첫 구조 결과가 `'위(Stomach)'`이고 첫 경혈 결과가 정확한 경혈인지 검증(Q7).
  - `03-search-empty`, `04-search-query`, `05-structure-selected` 6개 화면 스크린샷 촬영 및 확인.

### 3단계: 아틀라스 패널 비간섭 배치 및 반응형 상·하단 바 개편 (**A-3, A-4, A-7, A-11**)
- **작업**:
  - 좌측 검색 결과와 깊이 막대 간섭 제거, 우측 사이드 패널과 `.ax-inspector` 슬롯 통합(**A-3**).
  - 소형 모바일(360px) 상단 바 2행 분리 및 태블릿(820px) 하단 상태 줄/경맥 바 2단 분리(**A-4**).
  - 깊이 막대 7계통 균등 행 배치 및 모바일 단독 보기 버튼 복원(**A-7**), 모바일 우측 카메라 기둥 3버튼 축약 및 클린 뷰 토글 추가(**A-11**).
- **검증**:
  - `PLAYWRIGHT_GPU=1 npm run test:visual` 및 `PLAYWRIGHT_GPU=1 npm run audit:overlays` 실행 → 8화면×3상태 도구 겹침 0, 가로 넘침 0, 이름표 잘림 0 확인(Q25).
  - `small-mobile-01-initial`, `tablet-01-initial`, `mobile-01-initial`, `landscape-01-initial` 스크린샷 육안 대조.

### 4단계: 경혈 목록·상세·표시 설정 패널의 내부 구조 및 순차 탐색 개선 (**A-2, A-5, A-6, A-8**)
- **작업**:
  - 경혈 목록 패널의 상세 필터를 접이식(`<details>`)으로 전환해 모바일에서도 목록 즉시 노출(**A-2**).
  - `PointDetail`을 고정 헤더(컴팩트 비교 바) + 고정 탭 + 내부 스크롤 본문 + 고정 푸터로 개편(**A-5**).
  - 경혈 칩에 이전/다음(`‹`/`›`) 순회 버튼·링크 복사 버튼 추가 및 하단 바에 `저장 n` 필터 토글 추가(**A-6**).
  - `AnatomyControls` 상단 장문 안내를 섹션 하단 접이식으로 이동(**A-8**).
- **검증**:
  - `npm run test:e2e` (특히 `panel-keyboard.spec.ts`, `connective.spec.ts`, 비교·복원 시나리오) 통과.
  - `node scripts/check-readability.mjs` 실행 → 모든 모바일 패널에서 글자 크기 ≥ 12px, 대비 ≥ 4.5:1 검증(Q14).
  - `02-point-detail`, `06-display-settings`, `07-point-list`, `09-comparison` 6개 뷰포트 스크린샷 검증.

### 5단계: 첫 방문 안내·도움말 구조화 및 키보드 접근성 마무리 (**A-10, A-12**)
- **작업**:
  - 첫 방문 퀵스타트 안내 및 3단 구조화 도움말 적용(**A-10**).
  - 헤더 스킵 링크 및 캔버스 포커스 시 키보드 조작 배지 추가(**A-12**).
- **검증**:
  - 전체 품질 게이트(`npm test`, `npm run build`, `npm run test:e2e`, `npm run test:production`, `npm run test:visual`, `npm run audit:overlays`, `node scripts/check-readability.mjs`) 전수 실행 및 6개 화면 × 13개 상태(78장) 캡처 비교, `docs/QUALITY_STANDARD.md` 및 `docs/ui-renewal/COMMERCIAL_COMPARISON.md` 증거 기록 업데이트.

---

## 10. 예상 반론과 트레이드오프

1. **반론 1: “경혈 목록 패널에서 필터를 접어두면(A-2) 원혈·모혈이나 부위 필터를 찾는 데 클릭이 한 번 더 들지 않는가?”**
   - **트레이드오프와 해법**: 데스크톱(`≥ 701px` 및 충분한 높이 `≥ 760px`)에서는 공간이 충분하므로 필터를 기본 열림(`open`) 상태로 두거나 1줄 컴팩트 셀렉트로 보여주고, 세로 높이가 제한된 모바일(`≤ 700px`)과 가로 화면(`max-height: 560px`)에서만 기본 접힘으로 설정합니다. 또한 필터가 적용 중일 때는 토글 버튼에 `필터 (원혈 · 몸통)`처럼 활성 조건을 바로 표시해 인지 비용을 없앱니다. 이를 통해 모바일에서 목록이 0줄 보이던 치명적 결함(D2)을 해결합니다.
2. **반론 2: “표시 설정과 선택 카드에서 출처·정합 안내 문구를 `<details>`로 접으면(A-8) 데이터 한계 고지가 약화되지 않는가?”**
   - **트레이드오프와 해법**: 핵심 정직성 고지 1줄(예: `전통적 대응, 압력 경로 아님`, `남성 원본 정합 보완 · 여성 고유 형상 아님`, `여성 CT 별도 상세 · 다른 신체`, `실제 조직 단면 아님`)은 **절대 접지 않고 항상 눈에 보이는 위치에 고정**합니다. 접는 대상은 5~8줄에 달하는 세부 기하학 수치(예: 이동 중앙 2.78mm, 동맥 27개·정맥 4개 구성 등)와 중복 조작 설명뿐이므로, 정직성 원칙을 100% 지키면서도 작은 화면에서 조작부가 가려지는 문제를 해결합니다.
3. **반론 3: “깊이 막대의 계통 버튼을 균등 간격으로 배치하면(A-7) 실제 박리 백분율(0, 20, 68, 76, 84, 90, 95%)의 비선형 간격과 시각적 위치가 달라지지 않는가?”**
   - **트레이드오프와 해법**: 어차피 박리 백분율은 실제 해부학적 조직 깊이가 아니라 교육용 제거 순서(Q20)입니다. 20~68% 구간(근육 개별 박리 구간) 때문에 나머지 5개 계통 버튼이 하단 27% 공간에 몰려 터치·클릭이 불편한 것보다, 좌측 연속 슬라이더는 0~100% 연속 값을 유지하되 우측 7개 계통 점프 버튼은 `체표(0%)` · `근육(20%)` · `골격(68%)`처럼 목표 백분율을 명시한 균등 행으로 배치하는 편이 조작 정확도와 가독성 모두에서 월등히 유리합니다.
