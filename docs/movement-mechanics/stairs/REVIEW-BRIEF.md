# 계단 오르기·내리기 — 구현 후 검토 브리프 (2026-10-19)

[합의안 v2](CONSENSUS.md)대로 구현을 마쳤습니다. 세 검토자(Claude Code·Codex·AGY)가 서로의 결과를 보지 않고 독립적으로 검토합니다. 작업 폴더 `/Users/nuinuri/workspace/anatomy`는 읽기 전용입니다. 파일을 수정하지 마세요.

## 볼 것

- **구현 기록**: [IMPLEMENTATION.md](IMPLEMENTATION.md), [합의안 v2](CONSENSUS.md)
- **바뀐 코드**: `git diff`와 `git status`로 확인합니다.
  - `src/movement-figure.ts`, `src/MovementFigure.tsx`, `src/MovementPage.tsx`, `src/movement-types.ts`, `src/movement.css`
- **데이터**
  - `data/movements/stair-ascent.json`, `stair-descent.json`
  - `data/movement-contrasts.json`
  - `data/movement-sources.json`(새 출처 22개, `lyons1983` 수정)
  - `data/movements/arm-elevation.json`(순서 7)
  - `data/movements/walking.json`(Lyons 1983 전극 표기만 수정)
- **생성기**: `scripts/stairs/export-darmstadt.py`, `scripts/stairs/build-stairs.mjs`
  - 원 데이터에서 내보낸 JSON: `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/stairs-dev/dd-normal.json`
    - 원본 `Data_fully_processed.mat` sha256 5f7cb5f5…0689
    - `FullyProcessed.zip` sha256 21db0099…363d(데이터셋 v1.0)
  - 재현 명령(쓰기 없음, 표준 출력만): `PATH=/Users/nuinuri/.npm/_npx/3e062c1ecdbab29f/node_modules/node/bin:$PATH node scripts/stairs/build-stairs.mjs <dd-normal.json>`
- **검사**: `tests/movements.test.mjs`, `tests/browser/movement.spec.ts`, `scripts/capture-movement.mjs`
- **화면**: `docs/movement-mechanics/screens/`. 6개 화면 크기 × 동작별 장면입니다.
  - 계단은 `*-09…14-stair-*`이고, 비교 상자·근전도 표는 `*-18-stair-ascent-compare`입니다.
  - 가독성 측정: `docs/movement-mechanics/readability.json`
- **지금까지 결과**
  - 단위 검사 450/450
  - 동작 브라우저 검사 18/18(GPU)
  - 촬영 114장: 가로 넘침 0, 글자 12 px·대비 4.5:1, 도식 선 3:1, 이름표 잘림 0
- **데이터 작성 기록**: 작성·반박 검증·수정 기록이 아래에 있습니다.
  - `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/stairs-data/*.notes.md`
  - 검증 지적: 오르기 27건, 내리기 26건

## 검토할 것

1. **합의 준수**: 합의안 v2의 각 항목(§2–§7)이 코드·데이터·화면에 그대로 반영됐는지 봅니다. 빠지거나 다르게 구현된 것을 찾습니다.
2. **수치 충실성**
   - 생성기를 다시 돌린 결과가 데이터 파일의 키프레임·근전도 값과 같은지 확인합니다.
   - 문장 속 DD 수치(관절 일, 각도, 국면 % 등)를 `dd-normal.json`에서 표본 검사합니다.
   - 문헌 수치와 열람 수준이 맞는지 봅니다.
3. **도식**
   - 디딤 발이 디딤판을 지키는지, 흔드는 발이 단 모서리를 뚫지 않는지 봅니다.
   - 보정·이음·발가락·몸통 편집이 기록대로인지 확인합니다.
   - 화면에서 그럴듯하게 보이는지 봅니다(스크린샷 직접 열람).
4. **코드**
   - 다른 동작(서 있기, 일어서기, 앉기, 걷기, 팔)의 회귀를 찾습니다.
   - 버그, 접근성(키보드·화면 낭독기·움직임 감소), 성능(키프레임 104개 × 보간)을 봅니다.
5. **표현**
   - 과장, 처방·정상 기준으로 읽힐 문장, ‘검출 안 됨’ 오용, 서로 다른 연구 수치의 합성을 찾습니다.
   - 한국어로 읽기 어려운 곳도 짚습니다.

## 출력 (한국어, 120줄 이내)

- **결론**: 승인, 조건부 승인(조건 목록), 거부 중 하나입니다.
- **지적 목록**: 지적마다 다음을 적습니다.
  - 심각도: 차단, 주요, 경미
  - 위치: 파일:줄 또는 화면 이름
  - 근거: 인용 또는 계산값
  - 고칠 방법
- 확인하지 못한 것은 ‘확인 필요’로 따로 적습니다.
