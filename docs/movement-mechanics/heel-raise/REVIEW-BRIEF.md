# 발끝 서기 — 구현 후 검토 브리프 (2026-10-24)

[합의안 v2](CONSENSUS.md)대로 구현을 마쳤습니다. 세 검토자(Claude Code·Codex·AGY)가 서로의 결과를 보지 않고 독립적으로 검토합니다. 작업 폴더 `/Users/nuinuri/workspace/anatomy`는 읽기 전용입니다. 파일을 수정하지 마세요.

## 볼 것

- **구현 기록**: [IMPLEMENTATION.md](IMPLEMENTATION.md), [합의안 v2](CONSENSUS.md)
- **바뀐 코드**: `git diff`와 `git status`로 확인합니다. 엔진 준비(`foot` 각, `supportSpan`)는 직전 커밋 `2f4d9d7`에 있습니다(`git show 2f4d9d7`).
  - `src/MovementPage.tsx`, `src/movement-types.ts`
  - `src/movement-figure.ts`, `src/MovementFigure.tsx`(커밋 `2f4d9d7`)
- **데이터**
  - `data/movements/heel-raise.json`(생성 파일), `scripts/heel-raise/heel-raise.base.json`(작성한 글, 숫자는 `{{토큰}}`)
  - `data/movement-sources.json`(새 출처 14개, `crenna1991` 본문으로 수정, 재사용 6개에 용도 추가)
- **생성기**: `scripts/heel-raise/export-same-limb.py`, `scripts/heel-raise/build-heel-raise.mjs`
  - 원자료: `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/heel/hf/`(SAME-Limb v2.0.3, 해시 목록 `docs/movement-mechanics/heel-raise/checks/same-limb-files.sha256`)
  - 내보내기 출력: `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/heel/author/same-limb.json`(sha256 5b53cbb8…cadc0)
  - 재현 명령(쓰기 없음, 표준 출력만): `PATH=/Users/nuinuri/.npm/_npx/3e062c1ecdbab29f/node_modules/node/bin:$PATH node scripts/heel-raise/build-heel-raise.mjs <same-limb.json> scripts/heel-raise/heel-raise.base.json`
  - 내보내기를 다시 돌리려면 numpy·scipy가 있는 파이썬이 필요합니다: `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/heel/venv/bin/python3 -I scripts/heel-raise/export-same-limb.py <hf 폴더> <출력 경로>`. 출력은 작업 폴더 밖(예: 자신의 임시 폴더)에 쓰세요.
- **데이터 작성 기록**: [작성](review/data-authoring.md), [본문 확인](review/data-fulltext.md), [반박 검증 31건과 수정](review/data-verification.md)
- **검사**: `tests/movements.test.mjs`, `tests/browser/movement.spec.ts`, `scripts/capture-movement.mjs`
- **화면**: `docs/movement-mechanics/screens/`. 6개 화면 크기 × 동작별 장면입니다.
  - 발끝 서기는 `*-17-heel-raise-anticipatory-adjustment.png`(예비 자세 조정)와 `*-18-heel-raise-lowering.png`(최고점)입니다.
  - 그 뒤의 표·비교 화면은 번호가 19–21로 밀렸습니다.
  - 가독성 측정: `docs/movement-mechanics/readability.json`
- **지금까지 결과**
  - 단위 검사 473/473
  - 동작 브라우저 검사 21/21(GPU)
  - 빌드와 프로덕션 스모크 통과
  - 촬영 132장: 가로 넘침 0, 글자 12 px·대비 4.5:1, 도식 선 3:1, 이름표 잘림 0

## 검토할 것

1. **합의 준수**: 합의안 v2의 각 항목(§2–§8)이 코드·데이터·화면에 그대로 반영됐는지 봅니다. 빠지거나 다르게 구현된 것을 찾습니다. 출시 조건 1–8도 봅니다.
2. **수치 충실성**
   - 생성기를 다시 돌린 결과가 데이터 파일과 같은지 확인합니다.
   - 문장 속 SAME-Limb 수치(시간, 높이, 각도, 근전도 구간 평균, 민감도)를 `same-limb.json`에서 표본 검사합니다. 가능하면 원자료에서 정의대로 다시 계산합니다(허용 오차: 각도 0.5°, 길이 1 mm, 시간 0.01 s, 근전도 1%p).
   - 문헌 수치와 열람 수준(`checked`)이 맞는지 봅니다.
3. **도식**
   - 발허리발가락관절 고정, 발가락 선, 발꿈치 단조성, 지지면 띠를 봅니다.
   - 유효 발 기울기와 측정값의 구별이 화면과 표에 분명한지 봅니다.
   - 화면에서 그럴듯하게 보이는지 스크린샷을 직접 열어 확인합니다. 360×740에서 발꿈치 들림이 보이는지도 봅니다.
4. **코드**
   - 다른 동작(서 있기, 일어서기, 앉기, 걷기, 계단, 팔)의 회귀를 찾습니다. 커밋 `2f4d9d7`의 지지면 띠 변경도 포함합니다.
   - 버그, 접근성(키보드·화면 낭독기·움직임 감소), 문장 링크(`related`)를 봅니다.
5. **표현**
   - 과장을 찾습니다.
   - 처방·정상 기준·운동 효과로 읽힐 문장을 찾습니다.
   - 서로 다른 연구 수치의 합성, 근전도만으로 정한 수축 방식을 찾습니다.
   - 한국어로 읽기 어려운 곳도 짚습니다.

## 출력 (한국어, 120줄 이내)

- **결론**: 승인, 조건부 승인(조건 목록), 거부 중 하나입니다.
- **지적 목록**: 지적마다 다음을 적습니다.
  - 심각도: 차단, 주요, 경미
  - 위치: 파일:줄 또는 화면 이름
  - 근거: 인용 또는 계산값
  - 고칠 방법
- 확인하지 못한 것은 ‘확인 필요’로 따로 적습니다.
