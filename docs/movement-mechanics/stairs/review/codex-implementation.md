**결론: 조건부 승인 — 아래 1–6을 수정하고 관련 검사를 다시 통과해야 합니다.**

DD 단일 출처, 반 주기 대칭, 네 국면, 근전도 수치 표, 비교 연결, 편집 모형과 측정값의 구분은 대체로 합의안 v2를 따릅니다. 다만 최종 도식에 적용되는 보정·이음 검증이 충분하지 않습니다.

**지적 목록**

1. **주요 — 발 닿기 순간 발가락 끝 위치가 불연속입니다.**  
   위치: [movement-figure.ts:192](/Users/nuinuri/workspace/anatomy/src/movement-figure.ts:192), 같은 파일 204–210행.  
   근거: 실제 데이터로 접촉 직전·직후(`±10⁻⁸` 주기)를 계산하면 발끝이 오르기 **0.230 cm**, 내리기 **0.895 cm** 이동합니다. 오른발은 주기 경계, 왼발은 50%에서 반복됩니다. 접촉 전에는 이전 디딤판 높이를 향해 발가락을 보정하다가 접촉 순간 목표 높이가 바뀝니다.  
   수정: 접촉 전 8% 구간부터 **다음에 닿을 디딤판**을 목표로 보정하세요. 실제 두 동작 데이터로 양발 발끝의 접촉 전후·주기 이음 연속성을 검사해야 합니다. 현재 이음 검사는 합성 각도로만 확인합니다.

2. **주요 — SD 편차 보고가 최종 보간 결과를 반영하지 않습니다.**  
   위치: [build-stairs.mjs:123](/Users/nuinuri/workspace/anatomy/scripts/stairs/build-stairs.mjs:123), [VERIFICATION.md:38](/Users/nuinuri/workspace/anatomy/docs/movement-mechanics/stairs/VERIFICATION.md:38).  
   근거: 생성기는 반올림·화면 보간 전 모형으로 편차를 계산합니다. 실제 `interpolate()` 결과는 오르기 13.7% 발목에서 **1.0414 SD**입니다(원값 20.9839°, SD 1.9547°, 도식 23.0196°). 1 SD 초과분은 약 0.081°로 작지만, 기록의 최대 1.00 SD와 다릅니다. 내리기도 99.7%에서 **1.1823 SD**로 기록의 1.17 SD보다 큽니다〔공개 데이터+엔진 계산〕.  
   수정: 저장된 키프레임의 **최종 보간값**으로 편차를 산출·검사하세요. 양발 지지 보정 한도를 지키도록 정밀도·보간을 조정하고 기록을 갱신해야 합니다. 두 동작의 `timingNote`도 실제 단조 3차 보간을 “선형 보간”으로 설명하는 부분을 구분하세요.

3. **주요 — 오르기의 챌판 간격 1 cm 조건을 만족하지 않습니다.**  
   위치: [stair-ascent.json:3279](/Users/nuinuri/workspace/anatomy/data/movements/stair-ascent.json:3279), 생성기의 `fromEdge: 0.17`.  
   근거: 주기 **11.21%**에서 오른발꿈치와 바로 뒤 챌판 위끝 사이 거리는 **0.492 cm**입니다. 합의 §3-7과 페이지의 “챌판과 1 cm 이상”이라는 설명에 미달합니다. 관통은 없지만 간격 조건은 별개입니다〔엔진 계산〕.  
   수정: 발 위치를 재조정하고, 발꿈치·발끝과 유한한 챌판 선분 사이 거리 ≥1 cm 검사를 추가하세요. 이후 양발 접촉·유각 관통도 다시 확인해야 합니다.

4. **경미 — DD 값 두 곳의 반올림이 틀립니다.**  
   위치: [movement-contrasts.json:11](/Users/nuinuri/workspace/anatomy/data/movement-contrasts.json:11), [stair-ascent.json:3110](/Users/nuinuri/workspace/anatomy/data/movements/stair-ascent.json:3110).  
   근거: D6 엉덩관절 양의 일은 **0.2247216 → 0.22 J/kg**인데 비교 상자는 0.23입니다. A5 같은 변수의 SD는 **0.0547000 → 0.05**인데 본문은 ±0.06입니다〔공개 데이터〕.  
   수정: 각각 **0.22**, **0.51±0.05 J/kg**로 통일하세요.

5. **경미 — Spanjaard 2007 인용이 화면에서 1985년으로 표시됩니다.**  
   위치: [MovementPage.tsx:38](/Users/nuinuri/workspace/anatomy/src/MovementPage.tsx:38), `desktop-12-stair-descent-weight-acceptance.png`.  
   근거: 첫 연도 검색이 학술지명 `J Appl Physiol (1985)`를 선택해 **“Spanjaard 외 1985”**로 표시합니다.  
   수정: 해당 출처에 `short: "Spanjaard 외 2007"`을 지정하거나 발행연도 필드를 사용하세요.

6. **경미 — E1 점선 표지가 빠졌습니다.**  
   위치: [MovementPage.tsx:265](/Users/nuinuri/workspace/anatomy/src/MovementPage.tsx:265), 합의안 §4.  
   근거: E1 시점과 설명은 있으나, 합의한 점선 표지가 도식·주기축에 없습니다. 저장 화면에서도 접촉 사건과 편집 경계를 시각적으로 구별하지 못합니다.  
   수정: 주기축에 E1 **42.37%·23.23%** 점선 눈금과 “DD 계산 편집 경계” 설명을 추가하세요.

**직접 확인한 범위**

- MAT·ZIP 해시는 기록과 일치했고, MAT 재추출 결과는 제공된 JSON과 같습니다. 두 동작의 `keyframes`·`stairs`·`emg`도 재생성 결과와 완전히 일치했습니다.
- 근전도 **48칸**은 원곡선의 구간별 적분으로 독립 계산해 모두 일치했습니다.
- 최종 자세를 0.01% 간격으로 계산하고 발 외곽선의 계단 경계 교차점도 확인한 범위에서 관통은 없었습니다. 생성기의 양발 접촉 오차 **1.86·0.87 cm**도 재현했습니다.
- 동작 단위 검사 **16/16**, 타입 검사 통과. 기존 다섯 동작의 1,001개 시점 좌표는 이전 코드와 수치 오차 수준에서 같았습니다.
- 계단 장면 36장과 표 화면 6장을 직접 열람했습니다. 가로 화면의 작은 도식과 몸에서 떨어진 근육 번호는 기록된 한계대로 남아 있습니다.
- 문헌 표본은 [Grimmer 2020 본문·표 1](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0239148), [Grimmer 2023 본문](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0294161), Lewis 2015의 저장된 본문 XML·표 2, [Chleboun 2008 초록](https://pubmed.ncbi.nlm.nih.gov/18827324/), [Protopapadaki 2007 초록](https://pubmed.ncbi.nlm.nih.gov/17126461/)과 대조했습니다. 표본 범위에서 열람 수준을 과장한 표기는 찾지 못했습니다.

**확인 필요**

- GPU 브라우저 18개 검사와 실제 화면 낭독기는 이번 검토에서 재실행하지 않았습니다. 전체 단위 검사에서는 HTTP 시험 1개가 환경의 포트 열기 제한(`EPERM`)으로 실패했습니다.
- `*-18-stair-ascent-compare` 화면 대부분은 근전도 표까지만 보여 비교 상자 본문·하단을 검증하기 어렵습니다. 해당 영역을 별도로 촬영해야 합니다.
- 추가 문헌 전체와 Spanjaard 2007 정정 공고는 전수 재검증하지 않았습니다.