# 여성 머리 교체 후보의 원본 검사 — 2026-09-27

**두개골 해면뼈 경계면 후보를 확보했지만, 여성 전신의 두개골을 교체하지 않았습니다.** 기존 여성 신경–보완 두개골 관련75쌍의 교차 문제는 그대로 미해결입니다. 이 기록은 [기존 원본 대조](FEMALE_NEURAL_SOURCE.md) 이후의 추가 자료 검사이며 위치 교정 완료 보고가 아닙니다.

## 고정 자료와 실제 수록

[VIVA+ v2.0.2](https://openvt.eu/fem/viva/vivaplus/-/archive/v2.0.2/vivaplus-v2.0.2.zip)의 `50F-standing`을 사용했습니다. ZIP SHA-256 `94b9415ffdc844c14e6ff79ca5a7a79810bc7f7e8632966dedf20f7faddcf7d1`, 커밋 `cc986b7df66b109c1c73d4d5986553877e28b0dd`는 [기존 확보 자료](VIVA_SOURCE_AUDIT.md)와 같습니다. ZIP CRC, 여성/서 있는 자세 매개변수, 사용 파일4개 해시를 다시 검사했습니다.

실제 `model/common/vivaplus-10-Head.k`에는 비어 있지 않은 PART73개가 있으며, 선택된 요소는 solid36,650개·일반 shell6,380개·두께 지정 shell5,272개입니다. **이는 기관73개나 여성 고유 스캔73개가 아닙니다.** 피질·해면·계산용 null·뇌척수액 등의 재료 구분을 포함합니다. 두께 continuation 행을 별도 요소로 세지 않습니다. [원본 목록](vivaplus-head-inventory.json).

[공식 머리 설명](https://vivaplus.readthedocs.io/en/latest/model/body-region/head/)은 개발 중인 요약입니다. 일반적인 ‘1mm shell’ 문구를 이번 고정 파일 전체에 적용하지 않았습니다. 실제 section/요소별 두께로 내부·외부 피질뼈 표면을 재구성하지 않았고, 두께 없는 참조면을 실제 피질뼈 체적으로 주장하지 않습니다. CSF·입안 공간·null을 신경 조직으로 분류하지 않습니다. 이름이 `HE-Brain`인 부품을 근거 없이 뇌줄기로 개명하지 않았습니다.

## 실패를 포함한 변환 경과

1. 기존의 노드 ID 기준 대각선 추출을 그대로 적용하면 PART10개와 합집합2개가 실패합니다. 나머지64개 그룹은 부분 결과입니다. [최초 추출 기록](vivaplus-head-extraction.json).
2. 37개 solid PART의 경계면을 검사하니, 실패 경계45개 모두 반대 대각선으로 나눌 때 기존 셀 중심 방향 검사를 통과합니다. 해당 실패 면의 셀에서 중심·8모서리·8가우스점의 야코비안 표본은 모두 양수였습니다. 이는 셀 전체가 유효하다는 증명이 아닙니다. [실제 좌표·표본 증거](vivaplus-head-boundary-failures.json).
3. 면마다 따로 대각선을 바꾸면 공유 면에 서로 다른 표면을 만들 수 있으므로, 모든 incident solid에서 같은 대각선을 검사하는 별도 변환을 구현했습니다. 양쪽 삼각형의 방향 기준 `1e-12 mm³`는 완화하지 않았고, 두 셀 중심의 방향 부호도 반대여야 합니다. 일치하는 shell에도 같은 선택을 적용합니다.
4. 전체113,616개 고유 solid 면 중106,284개가 두 셀의 공유 면입니다. 두 후보 대각선 모두 조건을 충족하지 못하는 면14개가 남았습니다. **6개는 같은 PART 내부에서 소거되는 면, 8개는 서로 다른 뇌/CSF PART의 경계**입니다. 14개 전부를 출력 경계의 결함으로 부르지 않습니다. [공유 면 검사](vivaplus-head-diagonals.json).
5. 출력 경계에 미해결 면이 있는 그룹은 구멍 난 일부 표면을 내보내지 않고 통째로 제외했습니다. 왼쪽/오른쪽 대뇌, 대뇌 CSF, 소뇌 CSF의6개 PART와 뇌 합집합1개가 실패합니다. 성공67개 PART+진단 합집합2개=69그룹·80,012삼각형입니다. 합집합은 원본 PART를 중복 포함하므로 기관·고유 정점 개수에 더하지 않습니다. [후속 부분 추출](vivaplus-head-consistent-extraction.json).

대각선 전역 선택에서 바뀐 면69개라는 수는 성공 그룹69개와 별개이며, 내부 소거 면도 포함할 수 있습니다. 공유 대각선의 일치가 전체 자기 교차·뒤집힌 요소·T접합의 부재를 보증하지 않습니다. 두 대각선이 이번 기준에 실패했다는 사실이 다른 표면 근사도 불가능하다거나 생체 형상 수리가 필요하다는 뜻은 아닙니다.

## 확보한 두개골 후보의 범위

| 검사 | 실제 결과 | 판정 범위 |
| --- | --- | --- |
| 두개골 해면뼈 solid16 PART 합집합 | 원본 셀7,102개, 내부 면17,964개 소거, 정점6,680·삼각형13,368 | 피질뼈 두께·아래턱·치아를 제외한 경계 후보 |
| 합집합 표면 위상 | 연결 성분1, 열린 모서리0·비다양체 모서리0·중복 삼각형0·2면 모서리 방향 충돌0 | 자기 교차/임상 형상 정확도 전체 검사 아님 |
| 원본 머리 피부 참조면 | 정점3,099·삼각형6,148·열린 모서리48 | 닫힌 신체 외피가 아니므로 홀짝 포함 검사 미사용 |
| 해면뼈 경계–피부 참조면 | 교차 삼각형 쌍0 | 내부 포함·조직 간격·HRA 정합의 증명 아님 |
| 모든 유지 그룹의 좌표 독립 재읽기 | 중복 포함 참조 정점41,320개, 원본 대비 최대7.11×10⁻¹⁵mm | 원본 좌표 보존. 전신 대응·삼각형 구성 전체의 독립 검증 아님 |

표면 검사는 [고정 결과](vivaplus-head-surface-audit.json), 좌표 검사는 [별도 공백 구분 파서 결과](vivaplus-head-coordinate-readback.json)에 기록했습니다. 공통 축·단위 변환 `(x,y,z) mm → (y,z,x)/1000 m`만 사용했습니다. 화면용 Float32 최대 오차는0.000060mm 미만입니다. 정점은 바꾸지 않았지만, 비평면 사각면의 대각선 변경은 그 평면 근사 표면을 바꿀 수 있습니다.

별도 WebGL 장면에서 해면뼈 합집합과 피부 참조면만 정면/측면으로 캡처하고2장 모두 직접 확인했습니다. 누락된 뇌·아래턱·치아·피질뼈 두께와 앱 미적용을 화면에 표시했습니다. 앱을 실행한 것이 아니며 UI·모바일·박리 검증을 대체하지 않습니다. [시점·해시](vivaplus-head-captures.json). 변환 형상과 PNG는 `.cache/vivaplus-head/`에만 보관하고 GitHub/Pages에 배포하지 않습니다.

## 검사·agy와 재현

새 Python 검사11개와 기존16개, 총27/27 통과: 실제 오른쪽 관자뼈 셀1043199, 양쪽 셀/쉘의 대각선 일치, 같은 쪽에 놓인 셀 거부, 좌표 왕복, 수치 미분에 의한 야코비안 대조 등을 포함합니다. 최초 `unittest discover`는 점이 들어간 파일 이름을 찾지 못해0개를 실행했습니다. 이를 성공으로 세지 않고 아래의 명시적 파일 실행으로27개를 확인했습니다.

고정 증거 간 수록·실패·해시·범위 일치 검사2개를 추가한 전체 Node 단위 검사116/116도 통과했습니다. 앱 상호작용 변경이 없어 프로덕션 빌드와 앱 브라우저 회귀는 이번 진단에서 반복하지 않았습니다.

```sh
python3 scripts/audit-vivaplus-head.py
python3 scripts/extract-vivaplus-head.py
python3 scripts/diagnose-vivaplus-head-boundaries.py
python3 scripts/extract-vivaplus-head-consistent.py
python3 scripts/verify-vivaplus-head-coordinates.py
node scripts/audit-vivaplus-head-surfaces.mjs
# Vite 서버 127.0.0.1:5174 실행 시:
node scripts/capture-vivaplus-head.mjs
python3 tests/viva-head-triangulation.test.py
python3 tests/vivaplus-head.test.py
python3 tests/vivaplus-surfaces.test.py
python3 tests/vivaplus-audit.test.py
npm test
```

agy 읽기 전용 대화 `d6ba03d5-44db-447b-a1be-99c2d39882a2`에서 제한 범위 코드를 정적 검토했습니다. 구체적인 코드 결함은 보고하지 않았습니다. 최초 응답의 ‘14개 모두 경계’, ‘T접합/교차/뒤집힘 방지’, ‘다른 변환 불가능’으로 읽힐 수 있는 일반화와 ‘저장소 편집 없음’은 후속 응답에서 위 범위로 정정했습니다. agy는 테스트나 원본 재읽기를 직접 실행하지 않았습니다.

원본 LGPL v3 또는 이후 버전의 배포 조건은 [기존 출처 기록](VIVA_SOURCE_AUDIT.md#적용-판단)을 따릅니다. 현재는 코드·감사 결과만 기록하며 변환 모델은 배포하지 않습니다. HRA 피부/뇌와의 대응점·공통 정합, 뇌/CSF 표면 표현과 피질뼈 두께, 위치 개선·비악화 검증이 남아 있습니다. **남녀 전체 기관·신경 위치와 실제 근육 층서 목표는 계속 미완료입니다.**
