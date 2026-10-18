# 구현 후 검토 (2026-10-18)

합의안 v2(`docs/movement-mechanics/CONSENSUS.md`, 끝의 ‘구현 중 개정’ 포함)를 구현했습니다. **읽기 전용**으로 검토하세요(파일 수정 금지). 개발 서버 `http://127.0.0.1:5174`가 실행 중이며 브라우저 전체 검사가 돌고 있으니 서버를 재시작하거나 `src/`를 바꾸지 마세요.

- 구현 기록: `docs/movement-mechanics/IMPLEMENTATION.md`
- 코드: `src/MovementPage.tsx`, `src/MovementFigure.tsx`, `src/movement-figure.ts`, `src/movement-types.ts`, `src/movement-link.ts`, `src/movement.css`, `src/App.tsx`(경로·헤더·`#atlas/structure/...` 처리), `src/view-state.ts`(`open-structures`), `src/AtlasPage.tsx`·`src/Atlas.tsx`·`src/atlas.css`(1회 맞춤·돌아가기·연결조직 강조)
- 데이터: `data/movements/*.json`, `data/movement-sources.json`, 작성·검증 보고 `docs/movement-mechanics/review/data-authoring.md`
- 검사: `tests/movements.test.mjs`, `tests/view-state.test.mjs`(마지막 테스트), `tests/browser/movement.spec.ts`, `scripts/capture-movement.mjs`, `scripts/smoke-production.mjs`
- 화면 72장: `docs/movement-mechanics/screens/`(desktop 1440×900, laptop 1280×720, tablet 820×1180, mobile 390×844, small-mobile 360×740, landscape 844×390; 목록, 동작별 두 단계, 일어서기 표). 가독성 측정: `docs/movement-mechanics/readability.json`
- 지금까지 결과: 단위 443/443, 빌드, 운영 스모크(동작 페이지 GLB·Atlas 요청 0), 동작 브라우저 검사 8/8, 촬영 스크립트(가로 넘침 0, 글자 12px·대비 4.5:1, 도식 선 3:1). 전체 브라우저 검사는 진행 중입니다.

확인할 것:
1. 합의안 위반이나 사실 오류(데이터 수치·귀속·수축 판정, 금지 표현, 모델에 없는 구조).
2. ‘구현 중 개정’ 네 항목(걷기 엉덩관절 기준계 20°, 유각 무릎 65°, Ludewig 범위, 일어서기 시작 자세)을 받아들일 수 있는지.
3. 화면(도식이 동작을 오해 없이 보여 주는지, 휴대폰·가로·데스크톱 배치, ‘AI스러운 UI’ 여부)과 접근성·상태 전이(아틀라스 연결·복귀·새로고침, 여성 보기).

출력(한국어, 60줄 이내): 1) `승인` / `조건부 승인` / `거부` 2) 결함 표(위치 — 파일:줄 또는 화면 파일명, 영향, 정확한 수정) 3) 비차단 의견 최대 3개.
