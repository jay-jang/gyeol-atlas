# 동작 역학 페이지 — 독립 제안·합의·구현 기록 (2026-10-18)

## 요청

> 각 근육과 골격의 움직임에 대해 여러가지 동작 하는 과정을 나타내보고 싶어. 일어나는 동작, 앉는 동작 서있는 자세, 걸어가는 자세등 각 동작에 따라 근육과 골격의 매카니즘에 대해 별도의 페이지로 만들어줘. 각 동작 리스트는 codex와 agy와 상의해서 만들어줘.

## 진행

| 단계 | 내용 | 기록 |
| --- | --- | --- |
| 브리프 | 요청, 저장소 데이터(구조 id·FMA), 정지 GLB의 한계, 지킬 조건 | [BRIEF.md](BRIEF.md) |
| 1차 독립 제안 | 세 검토자가 서로 보지 않고 동작 목록·내용·표현·페이지 구조·검증을 제안. Claude는 후보 8묶음을 출처와 함께 조사한 뒤 작성 | [Claude](review/claude-round1.md)([조사](review/claude-research.json)) · [Codex](review/codex-round1.md) · [AGY](review/agy-round1.md) |
| 2차 교차 검토 | 쟁점 T1–T27 표결과 서로의 사실 오류 지적. Claude는 반박형 출처 대조 6묶음을 거쳐 작성 | [쟁점](ROUND2.md) · [Claude](review/claude-round2.md)([대조](review/claude-factcheck-round2.json)) · [Codex](review/codex-round2.md) · [AGY](review/agy-round2.md) |
| 합의안 v1 → 3차 | 다수결·절충으로 v1. 세 검토자 모두 조건부 승인(진행 단위 충돌, 연결조직 처리, 여성 대응, 주소 처리, 출처 귀속, Whittington 문구) | [ROUND3](ROUND3.md) · [Claude](review/claude-round3.md) · [Codex](review/codex-round3.md) · [AGY](review/agy-round3.md) |
| v2 → 4차 | 차단 항목 반영. 세 검토자 **최종 승인** | [합의안](CONSENSUS.md) · [Claude](review/claude-round4.md) · [Codex](review/codex-round4.md) · [AGY](review/agy-round4.md) |
| 데이터 작성·검증 | 동작마다 작성 에이전트 1 + 반박형 검증 에이전트 1. 원문을 열어 수치·귀속을 대조하고 직접 수정 | [보고](review/data-authoring.md) |
| 구현 | 페이지·도식 엔진·아틀라스 연결·검사 | [구현 기록](IMPLEMENTATION.md) |

## 동작 목록 합의

| 구분 | 동작 | 1차 제안(Claude / Codex / AGY) | 결정 |
| --- | --- | --- | --- |
| 1차 | 서 있기, 의자에서 일어서기, 의자에 앉기, 평지 걷기 | 셋 모두 포함 | 3/3 |
| 1차 | 팔 들어올리기 | 포함 / 후속 / 포함 | Codex 2차에서 찬성, 3/3 |
| 후속 | 계단 오르기·내리기 | 후속 1 / 후속 1 / 후속 1 | 첫 후속 |
| 후속 | 발끝 서기, 몸 앞으로 굽히기, 한 발 서기, 호흡 | 굽히기·한 발 서기는 Claude 1차·AGY 1차(2차) 제안 | 2차 표결 2:1로 후속 |
| 보류·제외 | 달리기·씹기·고개 돌리기(보류), 깊은 스쿼트·들기 비교·던지기·누운 자세에서 일어나기·교정(제외) | | 처방 위험·3축 운동·표준 패턴 없음 |

2차 교차 검토에서 각자의 1차 안에 있던 근거 없는 수치가 서로의 지적으로 걸러졌습니다. 예를 들면 서 있기의 국면 %, 발목 앞 3–5 cm, 일어서기 1국면 엉덩허리근 주동, 보행 PSw 50–60%, 팔 들기 180°, 앉기 각도의 ‘최대값’ 표기, 뼈핀 표본 160–170° 같은 것입니다.

## 구현 후 검토와 반영

| 단계 | 판정 | 기록 |
| --- | --- | --- |
| 구현 후 검토 | Claude 조건부 승인 · Codex **거부** · AGY 조건부 승인 | [Claude](review/claude-implementation.md) · [Codex](review/codex-implementation.md) · [AGY](review/agy-implementation.md) |
| 반영 | 코드 수정 + 데이터 수정 작업(수정 1 + 반박형 검증 1, 동작별) | [데이터 수정 보고](review/data-fix.md), [확인 요청](ROUND6-CONFIRM.md) |
| 확인 1 | Claude **최종 승인** · AGY **최종 승인** · Codex 차단 유지(걷기 62%·75%) | [Claude](review/claude-confirm.md) · [AGY](review/agy-confirm.md) · [Codex](review/codex-confirm.md) |
| 확인 2 | Codex 차단 유지(75% 엉덩관절 기준계, 발 겹침 설명, 한계 문구) | [ROUND7](ROUND7-CONFIRM.md) · [Codex](review/codex-confirm-2.md) |
| 확인 3 | Codex **최종 승인** — 세 검토자 모두 최종 승인 | [Codex](review/codex-confirm-3.md) |

반영한 주요 지적:

| 지적 | 반영 |
| --- | --- |
| 출처 링크가 해시 라우터 때문에 아틀라스로 이동(Codex) | 인용을 출처 목록으로 스크롤·초점 이동하는 버튼으로 |
| 지면반력이 발 가운데에서 그려져 부하 반응기 작용선이 무릎 앞(세 검토자) | 키프레임마다 압력중심 시작점, 시작점·각도 선형 보간, 오른발 디딤기에만 |
| 걷기 지지면을 거리로 판정, 좌면 띠가 좌면 이탈 뒤에도 남음, 등받이(Codex·Claude) | 접촉 사건과 데이터의 좌면 구간, 등받이 없는 의자 |
| 걷기 엉덩관절 기준계 혼용과 서로 다른 연구 최대값 합성(Codex·Claude) | 넙다리–수직선 기준으로 통일(Perry 수치·국면 정의에서 계산), 62%·75%는 AAPMR 같은 행 값, 다른 연구 값은 관절 표 비교 |
| 팔 들기 올리기(Ludewig 15° 기준)·내리기(McClure 휴식 기준) 혼용(Codex) | McClure 2001 그림 3 한 연구로 통일, Ludewig는 비교 행 |
| 장딴지근 갈래 미구분(Codex) | 안쪽·가쪽갈래 행 분리, 초음파 결과는 안쪽갈래만 |
| 칸 단서·출처가 화면에 없음, 휴대폰 표에 FMA id 없음(AGY·Codex) | ‘근거’ 펼침과 현재 단계 설명, 카드에 id |
| 휴대폰·가로 첫 화면, 이름표 잘림, 근활성 막대 폭(세 검토자) | 첫 화면 배치, 기호 범례, 번호 틀 안 고정, 걷기만 % 폭 |
| 좌면 이탈 체중심선이 그려진 몸과 모순(Claude·AGY) | 도식에서 빼고 본문·한계에만 |
| 실제 링크 열기 검사 공백(Claude·Codex) | 인대·힘줄 표시를 끈 상태의 남성 인대·여성 FT_ 힘줄 링크를 열어 그려진 메시와 설정 보존 확인 |
| 여성 FT_ 묶음 카드의 옮긴 보완 고지 누락(검사에서 발견, 합의 T23) | 선택 카드에 고지 |

데이터 작성 중 합의안과 달라진 네 항목과 구현 후 수정은 [합의안의 ‘구현 중 개정’](CONSENSUS.md#구현-중-개정-데이터-작성검증에서-발견-구현-후-검토에서-확인-요청)에 기록했고, 세 검토자가 확인 라운드에서 받아들였습니다. 검사 결과와 한계는 [검증 기록](VERIFICATION.md)에 있습니다.
