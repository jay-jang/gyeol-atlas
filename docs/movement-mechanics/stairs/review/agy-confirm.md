# 계단 오르기·내리기 확인 검토서 (AGY)

## 1. 이전 지적 사항 반영 확인

1. **오르기 흔한 오해 해설의 가쪽넓은근 근전도 수치 불일치 (217% → 218%)**: **해결**
   - [`data/movements/stair-ascent.json:3125`](file:///Users/nuinuri/workspace/anatomy/data/movements/stair-ascent.json#L3125)에서 `가쪽넓은근 218%`로 수정되었으며, 문장 속 근전도 수치와 표의 일치를 검증하는 단위 검사([`tests/movements.test.mjs:372-387`](file:///Users/nuinuri/workspace/anatomy/tests/movements.test.mjs#L372-L387))가 추가되어 통과했습니다.
2. **비교 상자 내리기 엉덩관절 양의 일 수치 불일치 (0.23 → 0.22 J/kg)**: **해결**
   - [`data/movement-contrasts.json:11`](file:///Users/nuinuri/workspace/anatomy/data/movement-contrasts.json#L11)에서 `엉덩관절 0.22`로 정정되었고, 단위 검사([`tests/movements.test.mjs:391-393`](file:///Users/nuinuri/workspace/anatomy/tests/movements.test.mjs#L391-L393)) 및 스크린샷([`desktop-19-stair-descent-contrast.png`](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/screens/desktop-19-stair-descent-contrast.png))에서 일치가 확인되었습니다.
3. **비교 상자 주기 출처 주석 표현 보완**: **해결**
   - [`data/movement-contrasts.json:11`](file:///Users/nuinuri/workspace/anatomy/data/movement-contrasts.json#L11)의 주석(`note`)이 "같은 데이터의 Grimmer 2023 표 1은 오르기는 다른 주기(A6, 왼다리), 내리기는 같은 주기(D6)의 값입니다"로 수정되어 A5/D6 주기 관계가 명확해졌습니다.

---

## 2. 새로 생긴 문제

- **없음 (차단 및 주요 문제 0건)**
  - 생성기(`build-stairs.mjs`) 재실행 결과 접촉 순간 발끝 튐 0 cm, 디딤 발 오차 0 cm, 양발 지지 오차 최대 1.98 cm(≤ 2.0 cm 한도 충족), 디딤판 챌판 간격 ≥ 1.96 cm(≥ 1.0 cm 기준 충족), 관통 및 충돌 0건이 유지됩니다.
  - 단위 검사 451/451 전건 통과, 브라우저 검사 18/18 통과, 최종 120장 렌더링 검사(가로 넘침 0, 글자 12 px·대비 4.5:1, 선 대비 3:1, 잘림 0)를 모두 통과했습니다.

---

## 3. 최종 결론

**최종 승인**
