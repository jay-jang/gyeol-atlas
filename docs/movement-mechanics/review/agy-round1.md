# 동작별 근육·골격 메커니즘 페이지 — AGY 1차 독립 제안

기준 문서: [BRIEF.md](file:///Users/nuinuri/workspace/anatomy/docs/movement-mechanics/BRIEF.md), [AGENTS.md](file:///Users/nuinuri/workspace/anatomy/AGENTS.md), [QUALITY_STANDARD.md](file:///Users/nuinuri/workspace/anatomy/docs/QUALITY_STANDARD.md), [REVIEW.md](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/REVIEW.md) · 기준 화면: [desktop-11-wiki-home.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/desktop-11-wiki-home.png), [mobile-11-wiki-home.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/mobile-11-wiki-home.png), [desktop-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/desktop-01-initial.png), [mobile-01-initial.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/mobile-01-initial.png) · 해부 데이터 대조: [model-inputs.json](file:///Users/nuinuri/workspace/anatomy/scripts/model-inputs.json), [full-system-structures.json](file:///Users/nuinuri/workspace/anatomy/data/full-system-structures.json), [connective-structures.json](file:///Users/nuinuri/workspace/anatomy/data/connective-structures.json), [structure-labels.json](file:///Users/nuinuri/workspace/anatomy/data/structure-labels.json).

---

## 1. 동작 목록 선정 (1차 출시 · 후속 후보 · 제외)

### 선정 기준 (5대 축)
1. **일상 빈도**: 하루 수십~수천 회 반복하는 기본 자세·이동·상지 과업인가.
2. **학습 가치**: 단축성·신장성·등척성 수축의 차이, 열린·닫힌사슬(OKC/CKC), 두 관절 근육의 역설, 짝힘(Force couple), 수동 인대·힘줄의 탄성/지지 기전을 대조해 배울 수 있는가.
3. **근거 수준**: 교과서·표준 논문에서 국면(Phase) 경계(%)와 대표 관절 각도·근전도(EMG) 시점이 합의되어 있는가.
4. **표현 가능성**: 단일 기준면(시상면 또는 어깨뼈면) 2D 투영만으로 3축 왜곡 없이 핵심 역학(무게중심·지면반력·모멘트 팔)을 정직하게 도식화할 수 있는가.
5. **모델 부합성**: 이 저장소의 뼈·근육·인대·힘줄 ID로 주동·길항·안정근과 수동 구조를 누락 없이 가리킬 수 있는가.

### 1차 출시 동작 (5개, 우선순위 순) 및 2차 후속·제외 구분

| 구분 | 순위 | 한국어 이름 | 영문 학술명 | 선정·배치 근거 (5대 축 평가) |
| :--- | :---: | :--- | :--- | :--- |
| **1차 출시** | **P1** | **편안히 서 있기** | **Quiet Standing (Upright Posture)** | 모든 동작의 영점(기준 자세). 중력선(LoG)과 관절축 정렬에 따른 수동 인대 장력(`엉덩넙다리인대` 등)과 최소 근활성(발목 전략)을 설명하는 정적·준정적 평형 기초. |
| **1차 출시** | **P2** | **의자에서 일어서기** | **Sit-to-Stand (STS)** | 사용자 요청 핵심 동작. 수평 운동량 생성 → 좁은 지지면(BoS)으로 무게중심 이전 → 수직 상승의 대표적 하지 닫힌사슬 **단축성** 과업이자 롬바드 역설의 교과서 사례. |
| **1차 출시** | **P3** | **의자에 앉기** | **Stand-to-Sit (StS)** | 사용자 요청 동작. 일어서기의 단순 역재생이 아니라 중력 굽힘 모멘트를 **폄근의 신장성 수축(Eccentric braking)**으로 감속하는 핵심 대조 학습 모델(P2와 짝 비교). |
| **1차 출시** | **P4** | **평지 걷기** | **Level Walking (Gait Cycle)** | 사용자 요청 동작. Rancho Los Amigos 8국면 표준, 3대 발목 로커(Rocker), 발바닥널힘줄 감기 기전(Windlass), 단축·신장·등척성 교대를 종합하는 이동 역학의 핵심. |
| **1차 출시** | **P5** | **팔 들어올리기** | **Shoulder Elevation (Scapulohumeral Rhythm)** | **추가 제안(상지 대표)**: 사용자 예시 4개가 모두 하지·자세에 편중되어 있어 상지·몸통 균형을 위해 추가. 저장소에 세분된 등세모근 3갈래·회전근개 4근·앞톱니근으로 2:1 관절 리듬과 짝힘(Force couple)을 명확히 설명 가능. |
| **후속 후보** | 2차-1 | **계단 오르기·내려가기** | **Stair Ascent & Descent** | 평지 걷기·일어서기보다 큰 무릎·엉덩 굴곡 각도와 모멘트를 요구하는 닫힌사슬 심화 동작(McFadyen & Winter 1988). 1차 STS·보행 UI 검증 후 확장 적합. |
| **후속 후보** | 2차-2 | **허리 굽혔다 펴기** | **Trunk Flexion–Extension (Lumbopelvic Rhythm)** | 허리골반 리듬과 굴곡-이완 현상(Flexion-relaxation) 학습 가치가 높으나, 허리뼈 5분절(`FMA13072~13076`)의 분절 회전 표현이 정교해야 하므로 2차 배치. |
| **후속 후보** | 2차-3 | **안정·깊은 호흡** | **Quiet & Deep Breathing** | `가로막(FMA13295)`·`갈비사이근(FMA9756/9757)`·갈비뼈(펌프·양동이손잡이 운동)가 모두 수록되어 있고 복부·흉부 경혈(CV12·CV17) 연계성이 높으나, 지레·지면반력 모델과 화면 문법이 달라 2차 분리. |
| **후속 후보** | 2차-4 | **발뒤꿈치 들기** | **Bilateral Heel Raise** | 발목 지레 논쟁과 `발꿈치힘줄(FMA258847)`·`발바닥널힘줄(ZA_tendon_plantar_aponeurosis_r)` 역할을 집중 학습할 수 있으나 1차에서는 평지 걷기 말기디딤기(TSt)에 통합 설명. |
| **제외** | — | 달리기·던지기·운동 처방 | Running / Throwing / Corrective Squat | 달리기는 체공기 탄성 충격 모델이 복잡하고, 던지기는 3축 회전이 지배적이어서 2D 도식 왜곡이 크며, 교정·재활·스쿼트 처방은 치료·진단 주장 금지 원칙([AGENTS.md](file:///Users/nuinuri/workspace/anatomy/AGENTS.md))에 어긋남. |

---

## 2. 1차 출시 5개 동작별 내용 골격

> **공통 수치 원칙**: 모든 각도·국면 비율은 **건강한 성인의 대표 근사값**이며 개인·의자 높이·보행 속도에 따라 달라집니다. 좌우 쌍 구조는 대표로 `오른쪽/왼쪽 ID`를 모두 표기합니다.

### 2.1 편안히 서 있기 — `Quiet Standing (Upright Posture)`
- **단계 구분 (자세 평형 3국면, Winter 1995; Horak & Nashner 1986; Neumann 2017, Ch. 14)**:
  1. `기준 정렬 (0–30%, Baseline Alignment)`: 중력선(LoG)이 귀바퀴 → 어깨관절 중심 부근 → 허리뼈 몸통 뒤쪽 → 엉덩관절 축 약간 뒤 → 무릎관절 축 약간 앞 → 발목관절(목말정강관절) 축 약 3–5 cm 앞을 통과.
  2. `전방 동요와 발목 전략 (30–70%, Anterior Sway & Ankle Strategy)`: 무게중심(CoM, 제2엉치뼈 `FMA16202` 앞쪽)이 앞으로 미세 이동할 때 압력중심(CoP)이 앞발 쪽으로 이동하며 종아리 굽힘근이 복원 토크 생성(역진자 모델).
  3. `후방·가쪽 미세 복원 (70–100%, Posterior & Frontal Correction)`: 후방 동요 시 발등굽힘근이 간헐 개입하고, 이마면에서는 양발 지지면(BoS) 안으로 CoP를 유지.
- **주요 관절 대표 각도 (시상면 근사, Neumann 2017)**: 엉덩관절 `0°`(중립~5° 폄), 무릎관절 `0°`(완전 폄 0–5°), 발목관절 `0°`(정강뼈 수직 대비 약 3–5° 전방 경사), 허리뼈 자연 앞굽이(Cobb 약 40–60°, **확인 필요**: 측정 분절 L1–L5 vs L1–S1 기준차 명시).
- **단계별 주요 근육·수축 방식·저장소 구조 ID**:
  - 전 구간·전방 동요: `가자미근(soleus, FMA22558/FMA22559)` 지속·간헐 **등척성·미세 신장성/단축성** (주된 자세 유지근); `장딴지근 안쪽·가쪽갈래(gastrocnemius, FMA45957/FMA45958, FMA45960/FMA45961)` 전방 동요 증가 시 간헐 **등척성·단축성**.
  - 후방·몸통 안정: `앞정강근(tibialis anterior, FMA22544/FMA22545)` 후방 동요 시 간헐 **단축성**; `등가장긴근(longissimus thoracis, FMA22751/FMA22753)`·`허리엉덩갈비근(iliocostalis lumborum, FMA22740/FMA22741)`·`뭇갈래근(multifidus, FMA22878/FMA22879)`·`큰허리근(psoas major, FMA22342/FMA22343)`·`배가로근(transversus abdominis, FMA22344/FMA22345)` 저강도 **등척성**.
  - 휴지기 대조: `큰볼기근(gluteus maximus, FMA22328/FMA22329)`·`넓은근(vastus lateralis/medialis/intermedius, FMA38930~FMA38935)`은 수동 폄 모멘트 덕분에 거의 **비활성(휴지)**(Basmajian & De Luca 1985).
- **골격·수동 메커니즘**:
  - **지레·모멘트**: 중력선이 엉덩관절(`볼기뼈 FMA16586/16587`–`넙다리뼈 FMA24474/24475`) 뒤, 무릎관절(`넙다리뼈`–`정강뼈 FMA24477/24478`) 앞을 지나므로 외력(중력) 자체가 수동적 엉덩·무릎 폄 모멘트를 만들어 근육 에너지를 아낌. 발목(`목말뼈 FMA24482/24483`)에서만 중력선이 축 앞을 지나 지속적인 외적 발등굽힘 모멘트가 발생함.
  - **수동 구조**: 엉덩 과폄은 `엉덩넙다리인대 내림·가로부분(ZA_ligament_descending_part_of_iliofemoral_ligament_r/l, ZA_ligament_transverse_part_of_iliofemoral_ligament_r/l)`과 `두덩넙다리인대(ZA_ligament_pubofemoral_ligament_r/l)`가, 무릎 과폄은 `앞·뒤십자인대(ZA_ligament_anterior_cruciate_ligament_r/l, ZA_ligament_posterior_cruciate_ligament_r/l)`와 `정강쪽·종아리쪽곁인대(ZA_ligament_superficial_part_of_tibial_collateral_ligament_r/l, ZA_ligament_fibular_collateral_ligament_r/l)`가 제한. 발바닥 아치는 `발바닥널힘줄(ZA_tendon_plantar_aponeurosis_r/l)`·`긴발바닥인대(FMA44249/FMA44250)`·`발바닥쪽발꿈치발배인대(스프링인대, ZA_ligament_plantar_calcaneonavicular_ligament_r/l)`가 수동 트러스(Truss)로 지지.
- **흔한 오해와 피해야 할 표현**: "서 있을 때 허벅지 앞근육과 엉덩이 근육이 계속 강하게 수축해 무릎·골반을 세운다"는 설명을 피하고, 중력선-관절축 오프셋과 인대 장력에 의한 에너지 절약 구조를 강조. "바른 자세 교정법" 같은 처방 문구 배제.

### 2.2 의자에서 일어서기 — `Sit-to-Stand (STS)`
- **단계 구분 (4단계 표준, Schenkman et al., *Phys Ther* 1990; Kralj et al. 1990; Neumann 2017)**:
  1. `1단계 굽힘-운동량 생성기 (0–27%, Flexion-Momentum)`: 동작 시작 ~ 둔부 이석(Seat-off) 직전. 몸통·골반이 앞으로 기울며 상체 전방 운동량 생성.
  2. `2단계 운동량 이전기 (27–40%, Momentum-Transfer)`: 둔부 이석(Seat-off, 약 27–30%) ~ 발목 최대 발등굽힘. 지지면(BoS)이 '의자+두 발'에서 '두 발'로 급격히 축소되며 전방 운동량이 상방·전방 변위로 이전(관절 모멘트·불안정성 최대 구간).
  3. `3단계 폄기 (40–85%, Extension)`: 발목 최대 발등굽힘 직후 ~ 엉덩관절 완전 폄. 엉덩·무릎·발목이 동시 신전하며 무게중심(CoM) 수직 상승.
  4. `4단계 안정화기 (85–100%, Stabilization)`: 완전 직립 도달 후 전후 동요 감쇠.
- **주요 관절 대표 각도 (시상면 근사, 무릎 높이 의자 기준, Schenkman et al. 1990; Roebroeck et al. 1994)**:
  - 엉덩관절: 시작 약 `85–90° 굽힘` → 1단계 말(골반·몸통 전경사) 최대 약 `95–105° 굽힘` → 3단계 말 `0°`.
  - 무릎관절: 시작 약 `85–95° 굽힘` → 이석 직후 `85–90°` → 3단계 말 `0°`.
  - 발목관절: 시작 약 `0–5° 발등굽힘` → 2단계 말 최대 약 `15–20° 발등굽힘` → 종료 `0°`.
- **단계별 주요 근육·수축 방식·저장소 구조 ID**:
  - 1단계 (0–27%): `엉덩근(iliacus, FMA22322/FMA22323)`·`큰허리근(psoas major, FMA22342/FMA22343)` **단축성**(골반 전경사 개시); `척추세움근(허리엉덩갈비근 FMA22740/22741, 등가장긴근 FMA22751/22753, 뭇갈래근 FMA22878/22879)` **등척성**(요추 과굽힘 방지); `앞정강근(tibialis anterior, FMA22544/FMA22545)` **단축성·등척성**(발바닥 고정 및 정강뼈 전방 견인).
  - 2단계 (27–40%, 최대 활성): `가쪽·안쪽·중간넓은근(vastus lateralis/medialis/intermedius, FMA38930/38931, FMA38932/38933, FMA38934/38935)` 및 `큰볼기근(gluteus maximus, FMA22328/FMA22329)`·`큰모음근(adductor magnus, FMA22459/FMA22460)` 강한 **단축성**; 두 관절 근육인 `넙다리곧은근(rectus femoris, FMA38928/FMA38929)`과 `뒤넓적다리근(넙다리두갈래근 긴갈래 FMA45888/45889, 반힘줄근 FMA22358/22359, 반막근 FMA22448/22449)`은 **롬바드 역설(Lombard's paradox, Lombard 1903; Gregor et al. 1985)**에 따른 공동수축(준등척성·단축성 힘 전달).
  - 3·4단계 (40–100%): `큰볼기근(FMA22328/22329)`·`넓은근(FMA38930~38935)` **단축성** 지속; `가자미근(FMA22558/22559)`·`장딴지근(FMA45957~45961)` **신장성→단축성**(정강뼈 전진 감속 후 직립 복귀).
- **골격·수동 메커니즘**:
  - **모멘트 팔과 CoM 이전**: 1단계에서 상체를 앞으로 숙이면 무게중심(CoM)이 발 지지면(BoS) 위로 가까워지고 무릎관절에서 본 외부(중력) 굽힘 모멘트 팔은 줄어드는 반면 엉덩관절의 외부 굽힘 모멘트 팔은 커져 큰볼기근·뒤넓적다리근이 부하를 분담함.
  - **무릎 도르래와 수동 구조**: `무릎뼈(patella, FMA24486/FMA24487)`는 넙다리네갈래근의 내적 모멘트 팔을 넓혀 폄 효율을 높임. *(데이터 한계 명시: 저장소에 무릎인대[슬개인대] 단독 메쉬는 없으며 `가쪽·안쪽무릎지지띠 ZA_tendon_lateral/medial_patellar_retinaculum_r/l`과 `반달무릎인대 ZA_ligament_meniscopatellar_ligament_r/l`, `무릎뼈아래지방체 ZA_ligament_infrapatellar_fat_pad_r/l`이 분리 수록됨 — Q27 준수).*
- **흔한 오해와 피해야 할 표현**: "허리를 꼿꼿이 세우고 일어나야 바른 동작이다" → 상체 전경사 없이는 이석 순간 CoM이 발 뒤에 남아 엄청난 무릎 폄 토크가 필요하거나 뒤로 넘어짐.

### 2.3 의자에 앉기 — `Stand-to-Sit (StS)`
- **단계 구분 (3단계, Kralj et al. 1990; Kerr et al. 1997; Neumann 2017 — 확인 필요: 문헌에 따라 착석 직후 안정화를 4단계로 분리하기도 함)**:
  1. `1단계 굽힘 개시·전방 경사기 (0–25%, Initiation & Forward Lean)`: 직립에서 무릎·엉덩·발목 잠김을 풀고 상체를 앞으로 기울여 CoM을 발 지지면 안에 유지.
  2. `2단계 제어 하강기 (25–80%, Controlled Eccentric Descent)`: 둔부가 뒤·아래로 내려가는 동안 중력 가속도를 하지 폄근의 **신장성 수축**으로 제동.
  3. `3단계 착석·체중 이전기 (80–100%, Seat Contact & Stabilization)`: 둔부 착석(Seat-on, 약 80–85%)과 함께 지지면이 의자로 넓어지고 상체가 수직으로 복귀.
- **주요 관절 대표 각도 (시상면 근사, Kerr et al. 1997)**: 엉덩관절 `0°` → 하강 말 최대 약 `90–100° 굽힘` → 착석 `85–90°`; 무릎관절 `0°` → `85–95° 굽힘`; 발목관절 `0°` → 하강 후반 약 `12–18° 발등굽힘` → 착석 후 `0–5°`.
- **단계별 주요 근육·수축 방식·저장소 구조 ID**:
  - 1단계 (0–25%): `앞정강근(FMA22544/22545)` **단축성·등척성**(둔부가 뒤로 빠질 때 정강뼈를 앞으로 당겨 뒤쪽 넘어짐 방지).
  - 2단계 (25–80%, 핵심 제동 구간): `가쪽·안쪽·중간넓은근(FMA38930~38935)`·`넙다리곧은근(FMA38928/38929)` **신장성**, `큰볼기근(FMA22328/22329)`·`큰모음근(FMA22459/22460)` **신장성**, `가자미근(FMA22558/22559)` **신장성**(정강뼈 전방 경사 속도 제어), `척추세움근(FMA22740/22741, FMA22751/22753, FMA22878/22879)` **신장성·등척성**.
  - 3단계 (80–100%): 착석 직후 하지 폄근 활성 종료, `배곧은근(rectus abdominis, FMA13377/FMA13378)`·`배바깥빗근(external oblique, FMA13336/FMA13337)`·`척추세움근`이 상체 수직 정렬 마무리.
- **골격·수동 메커니즘**:
  - **외력 모멘트와 제동 역학**: 중력 자체가 엉덩·무릎·발목에 큰 굽힘 모멘트를 가하므로, 골격이 중력 방향으로 굽혀지는 동안 실제로 일하는 근육은 굽힘근이 아니라 **늘어나며 장력을 내는 폄근(Eccentric brake)**임.
  - **수동 구조**: 무릎이 깊게 굽혀질 때 `안쪽·가쪽반달(ZA_ligament_medial/lateral_meniscus_r/l)`이 넙다리뼈 관절융기 뒤쪽 구름-미끄러짐(Roll-and-slide) 하중을 분산하고, `앞·뒤십자인대(ZA_ligament_anterior/posterior_cruciate_ligament_r/l)`가 전후방 활주를 안내함.
- **흔한 오해와 피해야 할 표현**: "무릎과 고관절을 굽히는 동작이므로 햄스트링과 장요근이 수축해서 앉는다"는 대표적 오해를 바로잡고, 중력과 같은 방향의 움직임은 반대쪽 길항근(폄근)의 신장성 조절이 지배함을 명시.

### 2.4 평지 걷기 — `Level Walking (Gait Cycle)`
- **단계 구분 (Rancho Los Amigos 8국면 표준, Perry & Burnfield, *Gait Analysis* 2nd ed. 2010; Neumann 2017, Ch. 15 — 오른쪽 다리 1주기 0–100%)**:
  - **디딤기(Stance, 0–60%)**: ① `초기접지기(IC, 0–2%)` → ② `하중반응기(LR, 2–12%, 첫 양발 지지)` → ③ `중간디딤기(MSt, 12–31%, 한발 지지 전반)` → ④ `말기디딤기(TSt, 31–50%, 뒤꿈치 들림)` → ⑤ `전흔들기(PSw, 50–60%, 두 번째 양발 지지·발가락 떼기 직전)`.
  - **흔들기(Swing, 60–100%)**: ⑥ `초기흔들기(ISw, 60–73%)` → ⑦ `중간흔들기(MSw, 73–87%)` → ⑧ `말기흔들기(TSw, 87–100%)`.
- **주요 관절 대표 각도 (시상면 근사, Perry & Burnfield 2010; Winter 2009)**:
  - 엉덩관절: IC `약 25–30° 굽힘` → TSt(50%) `약 10–20° 폄` → ISw/MSw `약 25–35° 굽힘`.
  - 무릎관절: IC `0–5° 굽힘` → LR `15–20° 굽힘`(충격흡수) → MSt/TSt `0–5°` → ISw `약 60° 굽힘`(발 바닥 통과) → TSw 말 `0–5°`.
  - 발목관절: IC `0°` → LR `5–7° 발바닥굽힘` → TSt `약 10° 발등굽힘` → PSw(60%) `15–20° 발바닥굽힘` → MSw/TSw `0°`.
  - 제1발허리발가락관절(`제1발허리뼈 FMA24507/24508`–`엄지발가락 첫마디뼈 FMA43253/43254`): TSt–PSw에서 `약 45–55° 발등굽힘(폄)`.
- **단계별 주요 근육·수축 방식·저장소 구조 ID**:
  - IC–LR (0–12%): `앞정강근(FMA22544/22545)`·`긴발가락폄근(FMA22548/22549)`·`긴엄지폄근(FMA22546/22547)` **신장성**(발바닥 급락 'Foot slap' 감속); `넓은근(FMA38930~38935)` **신장성**(무릎 15–20° 굴곡 충격흡수); `큰볼기근(FMA22328/22329)` **단축성·등척성**(엉덩 폄 안정); `중간·작은볼기근(FMA22330~22333)`·`넙다리근막긴장근(FMA22425/22426)` **신장성→등척성**(이마면 반대쪽 골반 낙하 제어).
  - MSt–TSt (12–50%): `가자미근(FMA22558/22559)`·`장딴지근(FMA45957~45961)` **신장성→등척성/단축성**(정강뼈 전방 회전 제어 및 추진력 준비); `뒤정강근(tibialis posterior, FMA65018/FMA65019)`·`긴종아리근(fibularis longus, FMA22552/FMA22553)` **등척성**(가로·세로 아치 안정).
  - PSw–ISw (50–73%): `엉덩근(FMA22322/22323)`·`큰허리근(FMA22342/22343)`·`넙다리곧은근(FMA38928/38929)`·`긴모음근(adductor longus, FMA22456/FMA22457)` **단축성**(엉덩 굽힘 가속); `앞정강근(FMA22544/22545)` **단축성**(발끝 들기).
  - MSw–TSw (73–100%): `뒤넓적다리근(넙다리두갈래근 긴·짧은갈래 FMA45888~45892, 반힘줄근 FMA22358/22359, 반막근 FMA22448/22449)` **신장성**(전방 스윙하는 넓적다리·종아리 감속); `앞정강근(FMA22544/22545)` **등척성**(접지 준비).
- **골격·수동 메커니즘**:
  - **3대 발목 로커(Perry & Burnfield 2010)**: 뒤꿈치 로커(IC–LR, `발꿈치뼈 FMA24497/24498` 축) → 발목 로커(MSt, `목말뼈 FMA24482/24483` 위 정강뼈 전진) → 앞발 로커(TSt–PSw, `제1~5발허리뼈 FMA24507~24516` 머리 축).
  - **감기 기전(Windlass mechanism, Hicks 1954)과 탄성 반동**: TSt–PSw에서 엄지발가락(`FMA43253`)이 젖혀질 때 `발바닥널힘줄(ZA_tendon_plantar_aponeurosis_r/l)`이 감기며 아치를 단단한 지레로 잠그고, MSt–TSt 동안 늘어난 `발꿈치힘줄(calcaneal tendon, FMA258847/FMA264844)`과 `엉덩넙다리인대(ZA_ligament_descending_part_of_iliofemoral_ligament_r/l)`, `엉덩정강근막띠(iliotibial tract, FMA58776/FMA58777)`의 수동 탄성이 PSw–ISw 추진을 보조함.
- **흔한 오해와 피해야 할 표현**: "유각기(흔들기) 내내 허벅지 앞근육이 다리를 들고 간다" → 실제로는 초기 가속 뒤 진자(Pendulum) 관성으로 이동하며 말기에는 햄스트링이 **신장성**으로 다리를 멈춤.

### 2.5 팔 들어올리기 — `Shoulder Elevation (Scapulohumeral Rhythm)`
- **단계 구분 (어깨뼈면/이마면 거상 3단계, Inman, Saunders & Abbott, *JBJS* 1944; Bagg & Forrest 1988; Neumann 2017, Ch. 5)**:
  1. `1단계 초기 세팅기 (0–30° 거상, 0–17%, Setting Phase)`: 오목위팔관절(GH) 위주로 위팔뼈가 들리며 어깨뼈 위쪽돌림은 작고 개인차가 큼.
  2. `2단계 중기 결합 리듬기 (30–120° 거상, 17–67%, Coupled 2:1 Rhythm)`: 오목위팔관절 거상과 어깨가슴관절 위쪽돌림이 약 `2:1` 비율로 결합 진행.
  3. `3단계 말기 완전 거상기 (120–180° 거상, 67–100%, Terminal Elevation)`: 빗장뼈 뒤쪽돌림·위팔뼈 가쪽돌림·등뼈 폄이 결합되어 봉우리 밑 충돌 없이 180° 도달.
- **주요 관절 대표 각도 (어깨뼈면 근사, Inman et al. 1944; Neumann 2017)**: 전체 거상 `180°` = 오목위팔관절(`위팔뼈 FMA23130/23131`–`어깨뼈 FMA13395/13396`) `약 120°` + 어깨가슴관절 위쪽돌림 `약 60°` (복장빗장관절 `복장뼈자루 FMA7486`–`빗장뼈 FMA13322/13323` 올림 `약 15–25°`·뒤쪽돌림 `약 20–35°` + 봉우리빗장관절 위쪽돌림 `약 20–30°`).
- **단계별 주요 근육·수축 방식·저장소 구조 ID**:
  - 오목위팔 거상 짝힘(전 구간): `어깨세모근 봉우리·빗장부분(deltoid acromial/clavicular, FMA34682/34683, FMA34680/34681)` 및 `가시위근(supraspinatus, FMA32544/32545)` 동시 **단축성**.
  - 관절오목 중심화·가쪽돌림(전 구간): `가시아래근(infraspinatus, FMA32547/32548)`·`작은원근(teres minor, FMA32553/32554)`·`어깨밑근(subscapularis, FMA13414/13415)` **등척성·단축성**(초기 어깨세모근의 위쪽 전단력을 상쇄해 위팔뼈 머리를 아래로 당기고 가쪽돌림 유도).
  - 어깨뼈 위쪽돌림 짝힘(2·3단계 주동): `앞톱니근(serratus anterior, FMA13398/13399)` + `등세모근 내림·가로·오름부분(trapezius descending/transverse/ascending, FMA33586/33587, FMA33584/33585, FMA33581/33583)` **단축성·등척성**.
- **골격·수동 메커니즘**:
  - **짝힘(Force couple)과 길이-장력 유지**: 어깨뼈(`FMA13395/13396`)가 60° 위쪽돌림함으로써 관절오목이 위팔뼈 머리 밑을 받치고 어깨세모근이 과도하게 짧아지는 것(Active insufficiency)을 막음.
  - **수동 구조**: `오목테두리(ZA_ligament_glenoid_labrum_r/l)`가 관절오목 깊이를 보완하고, `부리봉우리인대(ZA_ligament_coraco_acromial_ligament_r/l)`가 상방 아치를 이루며, `위·중간·아래오목위팔인대(ZA_ligament_superior/middle/inferior_glenohumeral_ligament_r/l)`와 `부리빗장·봉우리빗장·복장빗장인대 및 관절원반(ZA_ligament_acromioclavicular_ligament_r/l, ZA_ligament_articular_disc_of_sternoclavicular_joint_r/l)`이 빗장뼈 뒤쪽돌림을 수동 유도함.
- **흔한 오해와 피해야 할 표현**: "0–30°는 가시위근만, 30° 이후는 어깨세모근만 담당한다" → 실제로는 두 근육 모두 0°부터 함께 활성화됨(Reed et al. 2013; Neumann 2017).

---

## 3. 표현 방식 비교와 추천안

### 3.1 방식별 장단점 대조 및 WebGL 분리 판단
- **판단**: 새 동작 페이지는 위키(`#wiki`)·출처(`#sources`)와 동일하게 **WebGL/GLB 다운로드(남성 약 64MB, 여성 약 57MB) 없이 즉시 열리는 정적 문서·도식 화면**이어야 합니다([QUALITY_STANDARD.md](file:///Users/nuinuri/workspace/anatomy/docs/QUALITY_STANDARD.md) Q9·Q15).

| 표현 방식 | 장점 | 단점 및 한계 | 채택 여부 |
| :--- | :--- | :--- | :---: |
| **A. 2D 해부·역학 벡터 도식 애니메이션 (SVG)** | 용량 수십 KB로 즉시 로드. 무게중심(CoM), 지지면(BoS), 지면반력(GRF) 벡터, 관절 각도 호, 근육 작용선과 수축 방식(단축·신장·등척)을 교과서 도해처럼 정밀 표시 가능. | 3차원 자유 회전 불가(시상면 기본, 팔 들어올리기는 어깨뼈면 도식 사용). | **주력 채택** |
| **B. 단계별 정지 장면 (Key-stage Stills)** | 각 국면 경계(예: Seat-off, IC, TSt)를 또렷이 비교 가능하고 `prefers-reduced-motion` 및 저사양 기기에서 안정적. | 연속적인 운동량 이전 감각이 부족함. | **A와 결합 채택** (단계 탭 + 연속 보간) |
| **C. 3D 뼈 강체 회전 애니메이션** | 입체 시점 회전 가능. | 64MB GLB 로드 필수. 관절 중심 추정 오차·뼈 충돌 위험이 크고, 스키닝 없는 근육 메쉬는 뼈에서 떨어져 함께 그릴 수 없음([AGENTS.md](file:///Users/nuinuri/workspace/anatomy/AGENTS.md) 위반). | **배제** |
| **D. 아틀라스 3D 해부 연결 (`view-state.ts` 경유)** | 실제 3D 기시·정지·이웃 층 관계를 BodyParts3D·Z-Anatomy 정지 모형에서 정확히 확인 가능. | 아틀라스 진입 시 3D 로드가 발생하므로 사용자가 명시적으로 누를 때만 이동해야 함. | **필수 연동 채택** |

### 3.2 시각 인코딩과 조작 도구·화면 배치
- **색에만 의존하지 않는 도식 표기 (Q15)**:
  - **단축성(Concentric)**: 진한 적갈색 실선 + 안쪽 모임 화살표(`▶◀`) + 범례 글자 `[단축성: 짧아지며 힘 생성]`.
  - **신장성(Eccentric)**: 청록색 파선 + 바깥쪽 제어 화살표(`◀▶`) + 범례 글자 `[신장성: 늘어나며 감속 제어]`.
  - **등척성(Isometric)**: 황토색 이중 평행선(`=`) + 범례 글자 `[등척성: 길이 유지·관절 안정]`.
  - **역학 오버레이**: 무게중심(`CoM` 십자 원)·중력선(점선), 지지면(`BoS` 하단 굵은 막대), 지면반력(`GRF` 상향 벡터), 수동 인대·힘줄 장력(`인대·힘줄` 보라/진주색 점선).
- **재생·단계 조작 막대 (모든 버튼 터치 `≥44×44px`, 키보드 대응)**:
  - `[재생/일시정지]`(`Space`), `[처음으로]`(`Home`), `[이전 단계]`(`←` / `[`), `[다음 단계]`(`→` / `]`), `[연속 주기 슬라이더 0–100%]`(`role="slider"`, `aria-valuetext="2단계 운동량 이전기, 30%"`), `[속도: 0.25× · 0.5× · 1×]`, `[보조선 토글: 무게중심·지면반력 / 수동 인대]`.
  - `prefers-reduced-motion: reduce` 활성 시 자동 재생을 멈추고 단계 탭 전환(Key-stage Stills)을 기본으로 동작.
- **데스크톱·모바일 배치**:
  - **데스크톱(`≥701px`, `1440×900`, `1280×720`)**: 위키([desktop-11-wiki-home.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/desktop-11-wiki-home.png))와 같은 2열 문서 골격(`--doc-*` 토큰). 좌측 `aside`(동작 목록 5개 + 후속 후보 안내), 우측 `main` 상단은 2단 격자(왼쪽: SVG 도식 뷰포트 + 재생·단계 조작 바 / 오른쪽: 현재 단계 관절 각도 표·핵심 역학·흔한 오해), 하단은 전폭 `단계 × 근육` 매트릭스 표와 출처·한계.
  - **모바일 세로(`390×844`, `360×740`)**: 위키 모바일([mobile-11-wiki-home.png](file:///Users/nuinuri/workspace/anatomy/docs/review-2026-10-16/after/mobile-11-wiki-home.png))처럼 상단에 `← 인체 3D 보기로 돌아가기`와 `<details>` 동작 선택기(`동작 목록 5개`)를 두고, 그 바로 아래 **SVG 도식 뷰포트+조작 줄을 화면 높이의 40% 이내로 상단 고정(`position: sticky`)**하여 아래의 단계 설명과 근육 표를 스크롤해도 도식이 함께 보이게 함(Q10 정신 계승).
  - **모바일 가로(`844×390`)**: 좌측 44% 폭에 도식+조작 바 고정, 우측 56% 폭에 단계 설명·근육 표 독립 스크롤.

---

## 4. 페이지 구조와 아틀라스 3D 연동 설계

### 4.1 경로 이름과 헤더 구성 ([App.tsx](file:///Users/nuinuri/workspace/anatomy/src/App.tsx))
- **경로(Hash route)**: `#movements` (목록·개요 또는 첫 동작 기본 표시) 및 `#movements/<slug>` (`standing`, `sit-to-stand`, `stand-to-sit`, `gait`, `shoulder-elevation`), 선택 단계 쿼리 `#movements/sit-to-stand?step=2`.
- **헤더 4번째 메뉴와 360px 폭 예산**:
  - 주 메뉴(`nav[aria-label="주 메뉴"]`)를 `3D 경혈 지도`(`#atlas`) · **`동작 역학`(`#movements`)** · `지식 위키`(`#wiki`) · `출처와 자료`(`#sources`) 4개로 구성.
  - [atlas.css](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L591-L595)의 `@media (max-width: 700px)`에서 `.site-header nav { gap: 8px; }`로 조정하면 `360px` 화면에서도 로고(`~80px`) + 메뉴 4개(`~230px`)가 줄바꿈·가로 넘침 없이 1행에 들어감.

### 4.2 화면 구성과 `단계 × 근육` 표
1. **머리말·한계 고지 줄**: 동작 한국어명·영문 학술명, 기준면(예: 시상면), 대표값 고지(`건강한 성인 대표 근사값 · 임상 진단이나 운동 처방 기준 아님`).
2. **도식 뷰포트 + 단계 탭 + 조작 막대**: 단계 탭(예: `1. 굽힘-운동량 0–27%`, `2. 운동량 이전 27–40%`…)을 누르면 슬라이더·도식·아래 표의 강조 열이 동기화됨.
3. **`단계 × 근육` 매트릭스 표 및 수동 구조 목록**:
   - 행(Row): 주요 근육과 수동 구조 — **한국어 이름 + 영어 원문명 + FMA/ZA ID**를 함께 표기(예: `큰볼기근 · gluteus maximus · FMA22328, FMA22329`)하고 각 행 끝에 `[3D에서 보기 ↗]` 버튼 제공.
   - 열(Column): 동작의 각 단계(1~4단계 또는 8국면). 셀 안에는 수축 방식 약호와 역할(`단축성(주동) · 이석 직후 엉덩 폄`, `신장성(제동) · 무릎 굴곡 감속`, `등척성(안정)`, `—`)을 표기하며 현재 선택 단계 열을 강조.
   - 모바일(`≤700px`)에서는 표가 가로로 넘치지 않도록 **'현재 단계 근육 보기'(기본, 카드형 행 목록)**와 **'전체 단계 비교표'(가로 스크롤 표)** 전환 토글을 제공.
4. **출처·한계 표시 위치**:
   - 각 수치(관절 각도·국면 %) 옆에 짧은 출처 표기(예: `Perry & Burnfield 2010`, `Schenkman et al. 1990`)를 붙이고, 페이지 하단 `<section aria-labelledby="movement-sources">`에 참고 교과서·논문 서지사항과 모델 한계(정지 GLB 근사, 분리되지 않은 힘줄 등)를 명시하며 `#sources`와 상호 링크.

### 4.3 아틀라스 3D로 넘어가는 방식 ([view-state.ts](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts) 경유)
- **원칙 준수**: [view-state.ts](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts)를 우회하는 독립 상태를 만들지 않고 모든 구조·묶음 선택을 [`viewReducer`](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts#L176-L408)의 `select` 액션으로 라우팅합니다.
- **2가지 진입 동작**:
  1. **개별 구조 3D 보기** (`[3D에서 보기 ↗]`): 해당 근육·뼈·인대(좌우 쌍 포함, 예: `ids: ["FMA22328", "FMA22329"]`, `name: "큰볼기근"`, `layer: "muscle"`, `region: "lower-limb"`)로 `dispatch({ type: "select", selection: { kind: "bundle", ids, name, layers: [layer] }, layer, region })`를 실행한 뒤 `#atlas`로 이동.
  2. **단계 전체 근육 묶음 3D 보기** (`[이 단계 활성 근육 3D 묶음 보기 ↗]`): 현재 단계의 주동·안정 근육 ID 배열을 `kind: "bundle"`(`name: "일어서기 2단계 주요 근육"`, `layers: ["muscle"]`)로 `select` 디스패치 후 `#atlas`로 이동.
- **왕복 연속성 (Q5 확장)**: `#movements` 상단에는 기존 위키와 동일한 `← (경혈명/인체) 3D 보기로 돌아가기`를 두어 기존 아틀라스 세션(`gyeol-view-v2`)을 그대로 복원하고, 동작 페이지에서 `[3D에서 보기]`로 아틀라스에 진입한 경우 선택 카드 안에 `← 동작 역학(의자에서 일어서기 · 2단계)으로 돌아가기` 링크를 표시해 학습 문맥을 보존.

---

## 5. 한계와 검증 방법

### 5.1 무엇을 주장하지 않을지 (윤리·과학적 경계)
1. **임상·재활·운동 처방 주장 금지**: "스쿼트 시 무릎이 발끝을 넘으면 안 된다", "어느 근육을 강화하면 요통·무릎 통증이 치료된다", "경혈 자극이 특정 보행 근활성을 개선한다" 같은 진단·치료·처방 문구를 일절 쓰지 않습니다([AGENTS.md](file:///Users/nuinuri/workspace/anatomy/AGENTS.md), Q17).
2. **정지 3D 메쉬의 동적 변형 주장 금지**: 아틀라스의 3D 모델은 해부학적 자세의 정지 참조 모형임을 밝히고, 2D 도식의 각도·화살표는 교과서 대표값에 기반한 교육용 도해임을 명시합니다.
3. **없는 해부 구조 생성 금지 (Q11·Q27)**: 저장소에 별도 메쉬가 없는 구조(예: `무릎인대[patellar ligament]`, `등허리근막[thoracolumbar fascia]`)는 가짜 ID를 만들지 않고 텍스트에서 "원본 모델에 단독 메쉬로 분리되어 있지 않음(인접 구조 `무릎뼈 FMA24486`, `가쪽·안쪽무릎지지띠 ZA_tendon_lateral/medial_patellar_retinaculum_r` 참조)"으로 정직하게 기록합니다.
4. **수치의 절대화 금지**: 관절 각도·국면 %·근전도 시점은 성별·연령·보행 속도·의자 높이에 따라 달라지는 **건강한 성인 대표 근사 범위**임을 모든 표 머리에 적습니다.

### 5.2 검증 계획 (Quality Gates)
- **데이터·ID 무결성 단위 검사 (`npm test` 확장)**:
  - 동작 데이터 JSON/TS에 참조된 모든 구조 ID가 [model-inputs.json](file:///Users/nuinuri/workspace/anatomy/scripts/model-inputs.json), [full-system-structures.json](file:///Users/nuinuri/workspace/anatomy/data/full-system-structures.json), [connective-structures.json](file:///Users/nuinuri/workspace/anatomy/data/connective-structures.json)에 실제 존재하고 [structure-labels.json](file:///Users/nuinuri/workspace/anatomy/data/structure-labels.json)의 한국어명·영어 원문명과 100% 일치하는지 단언.
  - 동작 페이지에서 아틀라스 3D로 넘어가는 액션이 [view-state.ts](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts)의 `restoreView` 및 Q1~Q5 불변 조건(위키/동작 왕복 시 카메라·표식·비교 보존)을 깨뜨리지 않는지 단위 검사.
- **수치·출처 대조표 검수**:
  - 5개 동작의 국면 % 합계(0–100%), 관절 각도 부호(굽힘/폄, 발등/발바닥굽힘), 수축 방식(단축·신장·등척)이 인용 출처(Neumann 2017; Perry & Burnfield 2010; Schenkman et al. 1990; Winter 2009; Inman et al. 1944; Hicks 1954)와 일치하는지 대조하고 미확정 범위는 `확인 필요` 배지로 노출.
- **WebGL 비종속 및 성능 검사 (`npm run test:production`)**:
  - `#movements` 최초 진입 시 WebGL 컨텍스트 생성 및 `.glb` 네트워크 요청이 `0건`인지 단언(Q9).
- **가독성·접근성·시각 검증 (`check-readability.mjs`, Playwright E2E 및 스크린샷 육안 확인)**:
  - 데스크톱(`1440×900`, `1280×720`), 태블릿(`820×1180`), 모바일 세로(`390×844`, `360×740`), 모바일 가로(`844×390`) 6개 화면에서 ① 의미 있는 글자 `≥12px`(SVG 내부 라벨 포함), ② 텍스트·도식 대비 `≥4.5:1`, ③ `pointer: coarse` 조작부 `≥44×44px`, ④ 가로 넘침 `0`, ⑤ 키보드(`Tab`, `Space`, `←/→`, `Home/End`) 및 `prefers-reduced-motion` 동작, ⑥ 실제 캡처 화면의 비겹침·시각 품질을 검증합니다.
