# Codex 구현 후 검토 (2026-10-24, gpt-6.1-sol, 세션 01a16d84)

- **결론: 조건부 승인**
  - 주요 지적 1–3 수정, 검증 기록 보완 후 확인 라운드가 필요합니다.
  - 원자료 내보내기와 페이지 생성 결과는 기존 파일과 바이트 단위로 일치했습니다. 원자료 3개 반복의 높이·사건 시간·근전도 표본 재계산에서도 불일치를 찾지 못했습니다.
  - 동작 단위 검사 21/21과 타입 검사를 통과했습니다. 지정 PNG 10장을 직접 확인했고, 360×740에서 발꿈치 들림과 근육 번호의 분리는 보였습니다. 파일은 변경하지 않았습니다.

- **지적 목록**

  1. **심각도: 주요 — 모멘트팔 원리 그림 누락**
     - 위치: [MovementPage.tsx:370](/Users/nuinuri/workspace/anatomy/src/MovementPage.tsx:370), [heel-raise.base.json:530](/Users/nuinuri/workspace/anatomy/scripts/heel-raise/heel-raise.base.json:530)
     - 근거: 합의안 §5는 메커니즘에 축척 없는 원리 그림을 요구하지만, 해당 영역은 글 목록만 렌더링합니다. 데이터에는 “원리 그림에는 r·d에 숫자를 붙이지 않고”라는 설명만 있습니다.
     - 고칠 방법: 발목 중심, 힘줄·지면반력 작용선과 수직거리 r·d를 설명하는 그림을 추가하세요. 숫자는 넣지 않고 지면반력 작용선을 발허리발가락관절에 고정하지 않아야 합니다.

  2. **심각도: 주요 — 떠 있는 앞발까지 지지면에 포함**
     - 위치: [movement-figure.ts:397](/Users/nuinuri/workspace/anatomy/src/movement-figure.ts:397), `desktop-07-walking-initial-contact.png`
     - 근거: `supportSpan`은 발허리발가락관절·발끝을 무조건 포함합니다. 걷기 t=0에서 오른발 높이는 발꿈치 10.7 mm, 발허리발가락관절 76.9 mm, 발끝 85.6 mm인데, 띠는 떠 있는 발끝까지 약 206 mm 더 뻗습니다. 합의의 “닿은 점만”을 충족하지 않습니다.
     - 고칠 방법: 앞발도 접촉 여부를 판정하세요. 관절 중심의 기본 높이를 고려하고, 초기 접지·발 전체 접지·발꿈치 들림 각각의 띠 범위를 검사해야 합니다.

  3. **심각도: 주요 — 갈래 미기재 근전도가 안쪽갈래의 확정 활동으로 표시**
     - 위치: [heel-raise.base.json:187](/Users/nuinuri/workspace/anatomy/scripts/heel-raise/heel-raise.base.json:187), `desktop-18`·`tablet-18`의 근육 범례
     - 근거: 예비 조정의 안쪽갈래 `active` 근거는 SAME-Limb 하나이며, 75·191·45%도 갈래 미기재 전극값입니다. 근전도 표에는 이를 올바르게 표시하지만, 현재 구간·도식 범례는 “장딴지근 안쪽갈래 — 활동”으로 보입니다. 대응이 편집 가정이라는 설명은 다른 위치에 있습니다.
     - 고칠 방법: 갈래 미기재 기록을 독립적으로 표시하거나, 현재 구간·도식 범례에도 대응 가정을 명시하세요. 갈래별 측정 결과로 읽히지 않아야 합니다.

  4. **심각도: 경미 — 구현 완료를 뒷받침하는 검증 기록 누락**
     - 위치: [IMPLEMENTATION.md:5](/Users/nuinuri/workspace/anatomy/docs/movement-mechanics/heel-raise/IMPLEMENTATION.md:5), [공통 VERIFICATION.md:92](/Users/nuinuri/workspace/anatomy/docs/movement-mechanics/VERIFICATION.md:92)
     - 근거: 구현 기록이 연결하는 `heel-raise/VERIFICATION.md`가 없습니다. 공통 기록은 여전히 “발끝 서기 동작 데이터와 페이지는 아직 없습니다”라고 합니다. 요구–근거 표도 이번 구현을 반영하지 않았습니다.
     - 고칠 방법: 실행 명령·결과·수치 재현·화면 검토·실패와 한계를 기록하고, 요구–근거 표와 이전 구현 대비 변경점을 갱신하세요.

  5. **심각도: 경미 — 합의한 근섬유 근거 검사가 꼬리표 확인에 그침**
     - 위치: [movements.test.mjs:447](/Users/nuinuri/workspace/anatomy/tests/movements.test.mjs:447)
     - 근거: 단축성·신장성 검사는 `ultrasound` 포함 여부만 확인합니다. 합의안 §6이 요구한 근육·갈래·양발·평지·본문 확인 조건은 검사하지 않습니다. 현재 해당 판정이 없어 이 검사는 실질적으로 통과만 합니다.
     - 고칠 방법: 근거 조건을 구조화해 검사하고, 갈래나 과제 조건이 다른 근거를 거부하는 사례를 포함하세요.

- **확인 필요**
  - 전체 473개 검사, GPU 브라우저 21개, 빌드·프로덕션 스모크는 이번 검토에서 재실행하지 않았습니다. 화면 낭독기·실제 터치 조작도 독립 확인이 필요합니다.
  - 문헌 전체를 원문으로 재검증하지는 않았습니다. [OB19 초록](https://pubmed.ncbi.nlm.nih.gov/30935296/), [Manal 원문](https://pmc.ncbi.nlm.nih.gov/articles/PMC3871454/), CF91의 해당 본문 스캔 일부를 대조했습니다. 나머지 `checked`는 기존 열람 기록에 의존합니다.
  - 수정 뒤 6개 화면 크기의 관련 장면, GLB 요청 0건, 키보드·움직임 감소 동작을 다시 확인해야 합니다.