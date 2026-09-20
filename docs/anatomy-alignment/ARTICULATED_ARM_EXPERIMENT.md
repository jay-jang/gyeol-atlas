# 어깨–팔꿈치–손목 연결 후보와 실제 표면 교차 검사

2026-09-20. **공개 모델에 적용하지 않은 실험입니다.** 앞선 [손 독립 교정](ARM_REGISTRATION_EXPERIMENT.md)은 손목을61.79~84.24mm 벌렸습니다. 이번에는 두 구간의 연결을 제한한 후보를 만들고, 기존 최소 거리 검사에 실제 삼각형 표면 교차 검사를 추가했습니다. 후보3종 모두 탈락했습니다. 여성 전체 기관·신경 보완 및 위치 교정 목표는 계속 미완료입니다.

## 무엇을 바꿔 시험했는가

- 원본 BP4의 상완골 정점에서 견갑골·요골·척골 삼각형의 최근접점을 계산했습니다. 각 쌍의 최소 거리+4mm 안인 정점과 최근접점의 중간점 평균을 어깨·팔꿈치 **인접 표면 대리 기준점**으로 사용합니다. 팔꿈치는 요골·척골 쪽 평균에 같은 가중치를 줍니다. 관절면의 해부 이름·회전축을 식별한 것이 아니며 정점 밀도·임계값에 의존합니다.
- 어깨 목표점은 기존 보완 견갑대 배치에 고정했습니다. 이 기존 배치 자체가 여성의 올바른 견갑대 위치라고 새로 검증된 것은 아닙니다. 손목은 이전 손 피부 단면 기준과 독립 손 적합을 재사용합니다.
- 상완·전완 길이와 어깨–손목 목표점으로 가능한 팔꿈치 위치의 원을 계산합니다. 도달 불가능한 길이는 자동으로 늘리지 않고 거부합니다. 그 원 위의 팔꿈치 각도와 전완 축 회전을, **전완 피부만의** 양방향 최근접 점군 잔차로 정합니다. 관절 충돌을 최적화 목적함수에 넣은 것은 아닙니다.
- 상완의 축 회전은 기존 배치에서 가장 가까운 회전을 유지합니다. 각 뼈는 구간별 등방 축척과 회전·이동만 받으며 정점의 국소 형태를 휘거나 새 기관을 생성하지 않습니다. 손가락별 자세는 아직 풀지 않았습니다.
- 기준점 연결 오차는 부동소수점 수준입니다. 이는 끝점 변환 구현 검사이지 실제 뼈 관절의 접촉·간격·가동 범위 검증이 아닙니다.

## 세 후보의 실제 결과

동일한 양팔60개 뼈·참조 정점14,112개를 검사했습니다. 현재 공개 배치의 피부2mm 경계대 초과 이탈은13,161개입니다. 아래 `새 교차`는 좌우 각각5개 지정 관절 쌍에서, 기존에는 없었으나 후보에서 생긴 **삼각형 표면 교차** 수입니다. 전체 뼈 쌍을 검사한 수가 아닙니다.

| 후보 | 상완 길이 조건 | 왼쪽 이탈 | 오른쪽 이탈 | 후보 최대 이탈 | 새 교차 | 판정 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| A: 손 축척을 두 구간에 사용 | 원본×0.96631/0.96684 | 974 | 895 | 47.31mm | 5 | 탈락 |
| B: 기존 상완 길이 유지 | 원본×0.91238/0.88483 | 562 | 456 | 21.76mm | 3 | 탈락 |
| C: B에서 손을 전완에 결합 | B와 동일, 손도 전완 변환 | 2,788 | 1,876 | 48.96mm | 1 | 탈락 |

B에서 오른쪽 상완골·요골·척골의 참조 정점1,348개는 피부 이탈0입니다. 왼쪽은 상완골69개·요골20개가 이탈하며, 양손에는 이전 손 후보의929개 이탈이 그대로 남습니다. 오른팔의 피부 포함만으로 채택하지 않았습니다. 새 교차는 **왼쪽 상완골–척골, 왼쪽 요골–손배뼈, 오른쪽 요골–손배뼈**입니다. 이때 단방향 최소 거리에는 각각0.182mm·0.032mm·0.981mm라는 양수가 나옵니다. 작은 양의 거리만 검사하면 실제 표면 교차를 놓칠 수 있음을 실물 후보에서 확인했습니다.

C는 손과 전완에 같은 유사 변환을 적용하므로 요골–손배뼈·반달뼈 거리의 기존값×축척을0.001mm 이내로 재현하며, 검사한 손목 표면 교차는0입니다. 그러나 손 피부 적합을 다시 최적화하지 않은 결합이라 손가락 이탈이 크게 증가하고 왼쪽 팔꿈치 교차도 남았습니다. 손목만 통과한 것을 전체 팔 성공으로 보고하지 않습니다.

이전 두 모드도 새 검사로 재실행했습니다. [팔 전체 일괄 후보](arm-rigid-collision-recheck.json)는 오른쪽 견갑골–상완골에 새 교차가 있었고, [손 독립 후보](hand-collision-recheck.json)는 지정 쌍의 교차0이지만 손목 간격61.79~84.24mm가 그대로입니다. 따라서 교차 없음만으로 연결 상태가 정상이라는 결론도 낼 수 없습니다. 기존 역사적 보고서를 덮어쓰지 않고 재검사 결과를 별도로 보존합니다.

## 검사와 화면의 범위

`jointSurfaceRelation`은 복제한 두 기하에 대해 단방향 정점→삼각형 최소 거리와 별도의 삼각형 교차 여부를 반환합니다. 원본 정점·인덱스는 보존합니다. 검사하는 쌍은 각 측의 견갑골–상완골, 상완골–요골, 상완골–척골, 요골–손배뼈, 요골–반달뼈입니다.

합성 십자 막대에서 정점 최소 거리가 양수여도 표면이 교차함을 재현했습니다. 다른 합성 검사에서는 완전히 포함된 작은 상자의 표면은 큰 상자 표면과 교차하지 않음을 명시합니다. 즉, 이 플래그는 **침투 부피·완전 포함·연골·관절면 일치**를 검사하지 않습니다. 초기 합성 실행에서 라이브러리의 미교차 결과가 `undefined`인 경로를 발견했고, 양쪽 BVH 사용과 명시적 불리언 반환 후2/2를 통과했습니다. 미교차 결과를 해부학적 성공으로 바꾸지 않습니다.

로컬 일회성 브라우저에서만60개 뼈의 행렬을 변경했습니다. [변경 전 오른팔](articulated-existing-upper-before.png), B의 [오른팔](articulated-existing-upper-after.png)·[왼팔](articulated-existing-upper-after-left.png), C의 [오른팔](articulated-coupled-hand-after.png)·[왼팔](articulated-coupled-hand-after-left.png)을 같은 시점 설정으로 비교합니다. 두 실행 모두60개 변환·입력 해시를 확인했고 브라우저 오류0입니다. 이전 손 캡처보다 관찰 거리를 늘려 손끝이 아래 도구에 가려지지 않게 했습니다. 모든 시점·모바일의 시각 검증이나 공개 UI 변경은 아닙니다.

## 재현과 보존 자료

기존 고정 BP4 청크와 여성 HRA 파일을 재사용하며, 다운로드·모델 파일·앱 상태 전이·좌표 자료를 수정하지 않았습니다. NumPy1.26.4/SciPy1.13.1, Node24.14.0을 사용했습니다.

```sh
npm exec --yes --package=node@24.14.0 -- node scripts/experiment-arm-joints.mjs
.cache/female-ct-venv/bin/python tests/arm-kinematics.test.py
.cache/female-ct-venv/bin/python scripts/experiment-articulated-arm.py
npm exec --yes --package=node@24.14.0 -- node scripts/audit-arm-candidate.mjs --articulated
.cache/female-ct-venv/bin/python scripts/experiment-articulated-arm.py --upper-existing
npm exec --yes --package=node@24.14.0 -- node scripts/audit-arm-candidate.mjs --articulated --upper-existing
.cache/female-ct-venv/bin/python scripts/experiment-articulated-arm.py --upper-existing --coupled-hand
npm exec --yes --package=node@24.14.0 -- node scripts/audit-arm-candidate.mjs --articulated --upper-existing --coupled-hand
# 127.0.0.1:5174 개발 서버가 실행 중일 때:
npm exec --yes --package=node@24.14.0 -- node scripts/capture-arm-candidate.mjs --articulated --upper-existing
npm exec --yes --package=node@24.14.0 -- node scripts/capture-arm-candidate.mjs --articulated --upper-existing --coupled-hand
```

- [기준점·입력 해시](arm-joints.json)
- A: [후보](articulated-candidates.json), [검사](articulated-candidate-audit.json)
- B: [후보](articulated-existing-upper-candidates.json), [검사](articulated-existing-upper-candidate-audit.json), [캡처 해시](articulated-existing-upper-captures.json)
- C: [후보](articulated-coupled-hand-candidates.json), [검사](articulated-coupled-hand-candidate-audit.json), [캡처 해시](articulated-coupled-hand-captures.json)

전체 Node 단위50/50, 두 구간 기하 검사4/4, 기존 단면 검사3/3 통과. 두 구간 검사는101개 각도의 길이 보존, 도달 불가·퇴화 입력 거부, 양 끝점 및 형태·축척·회전 방향 보존, 일직선/반대 방향 정렬을 포함합니다. 이들은 구현 검사지 해부 정합 성공 검사가 아닙니다. 별도 JSON의 `rejectionScreen`은 세 후보 모두 `passedGeometricScreen=false`, `anatomicallyValidated=false`, `deployed=false`입니다. 런타임 변경이 없으므로 전체 브라우저·201단계 박리는 재실행하지 않았습니다.

## agy와 다음 교정 조건

agy 대화 `fe4805f4-aa2d-4155-a637-1bcd27ef94e4`에서 두 구간 수식·후보 생성·관절 검사3개 소스만 정적 검토했습니다. 끝점 연결만으로 관절이 검증되지 않는 점, 피부만으로 정한 회전의 한계, 독립 축척과 실제 관절축 불일치, 완전 포함을 검출하지 않는 표면 검사의 한계를 확인했습니다. 실제 데이터나 브라우저 검증을 수행했다는 뜻은 아닙니다.

agy의 ‘대수적 항등식’이라는 표현을 ‘구현 검사도 무의미’로 확대하지 않습니다. 구현이 두 끝점을 연결하는지 확인하는 데에는 유효하지만 해부 검증으로는 불충분합니다. 완전 포함 상태의 표면 교차 `false`도 함수가 정의한 표면 검사로는 맞는 결과이며, 이를 ‘충돌이 없는 정상 관절’로 읽는 것이 오류입니다.

다음 교정에는 실제 관절면·회전축·허용 자세에 근거한 제약, 손목과 손가락의 관절별 대응, 불균등한 피부 정점 밀도의 영향을 줄인 표면 적합이 필요합니다. 피부 포함0이나 기준점 연결0을 새 완료 기준으로 삼지 않습니다. 기존 여성 원본에 상완동맥·요골동맥·정중/척골신경 등의 이름으로 된 상지 기준 자료가 있는지도 조회했지만 해당 이름의 부위가 없어 이번 후보의 독립 기준점으로 사용하지 못했습니다. 이 조회를 모든 공개 여성 자료의 부재로 일반화하지 않습니다.
