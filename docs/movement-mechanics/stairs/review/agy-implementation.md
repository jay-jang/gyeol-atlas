# 계단 오르기·내리기 구현 후 검토서 (AGY)

## 1. 결론: 조건부 승인

[합의안 v2](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/stairs/CONSENSUS.md)의 모든 요구 사항(Darmstadt 단일 주 출처, 반 주기 대칭, ±1 SD 양발 지지 보정과 `measured` 보존, 유각 말기 매끄러운 곡선 이음, E1 기반 4국면, 국면 평균 상대 근전도 표와 30% 미만 구분, 오르기·내리기 비교 상자)이 정확히 구현되었습니다.
- **검사 결과**: 단위 검사 450/450 통과, 브라우저 검사 18/18 통과, 6개 해상도 114장 스크린샷 검사 통과(가로 넘침 0, 글자 ≥12 px, 대비 ≥4.5:1, 선 대비 ≥3:1, 모바일 첫 화면 높이 규격 준수).
- **수치 충실성**: 생성기 재실행(`build-stairs.mjs`) 결과가 데이터 파일의 키프레임 및 근전도 값과 100% 일치하며, 디딤 발 지지면 유지 및 흔드는 발 단 모서리 관통 0이 확인되었습니다. 기존 동작(서 있기, 앉기, 일어서기, 걷기, 팔)의 기능 회귀도 없습니다.
- 아래 지적 목록(경미 3건)의 수치 및 설명 문구 정리 후 최종 출시를 승인합니다.

---

## 2. 지적 목록

### [경미] 1. 오르기 흔한 오해 해설의 근전도 수치 불일치
- **위치**: [`data/movements/stair-ascent.json:3255`](file:///Users/nuinuri/workspace/anatomy/data/movements/stair-ascent.json#L3255)
- **근거**: 본문 오해 해설란에 "체중 받아들이기의 DD 국면 평균은 넙다리곧은근 283%, 가쪽넓은근 217%이지만"으로 적혀 있으나, 검증 단계에서 사다리꼴 적분 평균을 적용하면서 근전도 표([`stair-ascent.json:2995`](file:///Users/nuinuri/workspace/anatomy/data/movements/stair-ascent.json#L2995)) 및 한계 칸([`stair-ascent.json:3284`](file:///Users/nuinuri/workspace/anatomy/data/movements/stair-ascent.json#L3284))은 `218%`로 갱신되었음([`VERIFICATION.md:45`](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/stairs/VERIFICATION.md#L45) 기록).
- **고칠 방법**: `stair-ascent.json:3255`의 `가쪽넓은근 217%`를 표와 동일하게 `가쪽넓은근 218%`로 수정합니다.

### [경미] 2. 비교 상자 내리기 엉덩관절 양의 일 수치 불일치
- **위치**: [`data/movement-contrasts.json:11`](file:///Users/nuinuri/workspace/anatomy/data/movement-contrasts.json#L11)
- **근거**: "한 주기의 관절 양의 일(J/kg)" 내리기 행에 `"엉덩관절 0.23 · 무릎 0.04 · 발목 0.18"`로 적혀 있으나, [`data/movements/stair-descent.json:3278`](file:///Users/nuinuri/workspace/anatomy/data/movements/stair-descent.json#L3278)에는 `"엉덩관절 0.22±0.05"`로 적혀 있고, DD 원 데이터(`dd-normal.json` D6 `Whip_p.mean`) 값은 `0.2247... J/kg`로 소수 둘째 자리 반올림 시 `0.22`입니다.
- **고칠 방법**: `movement-contrasts.json:11`의 내리기 값을 `"엉덩관절 0.22 · 무릎 0.04 · 발목 0.18"`로 통일합니다.

### [경미] 3. 비교 상자 주기 출처 주석 표현 보완
- **위치**: [`data/movement-contrasts.json:11`](file:///Users/nuinuri/workspace/anatomy/data/movement-contrasts.json#L11) `note`
- **근거**: `"같은 데이터의 다른 주기(A6·D6)는 Grimmer 2023 표 1에 있습니다"`라고 되어 있으나, 본 페이지의 내리기 주기는 이미 D6 자체이므로 Grimmer 2023 표 1 수치와 동일하며([`stair-descent.json:3283`](file:///Users/nuinuri/workspace/anatomy/data/movements/stair-descent.json#L3283) 참조), 오르기만 A5(페이지)와 A6(논문 표 1)으로 주기가 다릅니다.
- **고칠 방법**: 주석 문구를 `"오르기는 다른 주기(A6, 왼다리), 내리기는 같은 주기(D6)가 Grimmer 2023 표 1에 있습니다"`로 명확히 적습니다.

---

## 3. 확인 필요

1. **Spanjaard 2007 정정 공고(2008)**: 논문 정정 공고(J Appl Physiol 104:1857–1859) 원문은 이번 검토 환경에서도 열람하지 못하여, 합의안대로 정량 수치를 배제하고 정성 서술만 인용한 상태를 유지했습니다.
2. **외부 저장소 데이터 직접 열람**: figshare(Reznick 2021, Lencioni 2019)의 HTTP 403 열람 제한으로 발 떼기 사건의 원 데이터 직접 대조는 미수행되었으며, Grimmer 2020 표 1 및 Darmstadt 공개 데이터셋(DD) 계산값으로 대체 검증했습니다.
