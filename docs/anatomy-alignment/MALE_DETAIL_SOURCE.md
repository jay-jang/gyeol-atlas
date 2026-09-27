# 남성 상세 혈관 원본 대조 — 2026-09-27

## 결론과 적용 범위

폐 상세에서 떨어져 보였던 `BP4_FJ2041`·`BP4_FJ2044`는 앱의 개별 이동이나 상세 문맥 복원 때문에 생긴 좌표가 아닙니다. 현재 남성 상세423개·119,037정점 모두 공식 BodyParts3D4.0 OBJ 정점의 공통 변환 결과와 정확히 일치했습니다. **원본 좌표 재현은 해부학적 위치 승인과 다릅니다.** 모델·선택·박리·가시 집합은 이번에 바꾸지 않았습니다.

| 요구 | 실제 검사 | 판정 |
| --- | --- | --- |
| 앱 재포장과 원본 위치 문제 구분 |423개 위치/법선/인덱스 바이트가 고정 상류와 일치.119,037개 표시 정점 모두 공식4.0 원본 변환 정점에 정확히 존재 | 변환/재포장 결함 증거 없음. 단순화 후 삼각형의 원본 대응·해부 연결 검증 아님 |
| 수록 관계와 원본 버전 일치 |4.0 공식 part_of와 심장83·간60·폐280 일치.4.3은 각각92·66·563 | 새 목록은 교체 대응표가 아님. 추가/제외 전체 ID를 기록 |
| 떨어진 폐 혈관의 후속 원본 확보 |4.3 FMA8620 part_of14개를 공식 exporter에서 취득, ZIP CRC·OBJ ID/버전·실제 정점/면 검사 | 이전 FJ2041/2044는4.3 목록에 없음. 새 혈관군과 원본 Z 경계상자 간격212.160/228.030mm |
| 새 자료의 중복 표시 방지 |4.3 기존 가지7개는4.0 같은 ID와 양방향 최근접 정점 거리0. 추가7개와 대응7쌍은 최대3.132mm 이내 | 같은 공간의 유사 형상. 동일 표면/중복임을 입증한 것은 아니며 무조건 합쳐 적용하지 않음 |

## 원본과 방법

- [공식4.0 다운로드](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html)의 `20130619/isa_BP3D_4.0_obj_99.zip`, `partof_element_parts.txt`, `isa_element_parts.txt`를 확보했습니다. ZIP 전체 CRC를 검사했습니다.
- 상류는 `slorksmo/Human-Atlas` 커밋 `5bb5713aab18d7fe9380c3339eb09f173491ea06`입니다. 변환은 원본 mm 좌표 `[x,y,z]`에서 `[x*.001,z*.001+.0781112,-y*.001-.1]`로 같습니다. 변환 후 Float32 최근접 정점 거리를 전수 확인했고, 상류 단순화의 삼각형 정확성은 별개로 남깁니다.
- [공식4.3 관계 ZIP](https://lifesciencedb.jp/bp3d/get-info.cgi?version=4.3&cmd=concept-objfiles-list)의 내부 `FMA2Obj.txt`가 저장된 `data/catalog/v43-FMA2Obj.txt`와 바이트 단위로 일치합니다. SHA-256 `c3d16c891016da13447de2fc3241d05d92e8f9dc460e363233c03f420b935d4f`.
- 4.3 업로드 목록의 ID/representation을 공공 다운로드 폼으로 전달했습니다. 실제 반환된 OBJ는 모두Compatibility4.3이지만 representation ID가 업로드 목록과 다릅니다. 실제 헤더의 FMA·영문명·representation을 보존했습니다. 가지 FJ2974–2981의 실제 FMA는 FMA68677 또는 FMA68683이며 추가 FJ6044–6051은 FMA8620입니다. 범위 표기 중 빠진 번호가 있으며 각각7개입니다.
- [공식 라이선스](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)는2025-02-27 개정 CC BY4.0입니다. 과거 OBJ 헤더에는CC BY-SA2.1 JP가 남아 있음을 구분합니다. 출처: BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.
- [4.0 공식 릴리스 설명](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20130619/release_4.0_e.html)은 장기·골격 위치 변경과 폐/간 분할 개념 대응의 혼동 가능성을 명시합니다. 이것만으로 이번 특정 파일의 오류 원인을 단정하지 않습니다.

`scripts/audit-male-detail-source.py` → [423개 원본 감사](male-detail-source-audit.json). `scripts/download-detail-source-probe.py` → 공식4.3 제한 다운로드. `scripts/audit-pulmonary-source-probe.py` → [14개 원본 대조](pulmonary-source-probe.json). 원본 ZIP/업로드 목록은 `.cache/bp4-official/`에 보존하며 공개 모델로 복사하지 않았습니다.

초기 `ids`만 보낸 시험은 ZIP 대신HTML을 반환했습니다. 기존 공식 다운로드 방식과 같이 세션 쿠키·representation을 함께 전달한 다음 ZIP CRC/파일 헤더 검사를 통과했습니다. 실패한 응답을 모델로 사용하지 않았습니다.

## 직접 확인한 투영도

[공식 원본 정면/옆면 좌표 비교와 확대](pulmonary-source-probe.png)는 `scripts/draw-pulmonary-source-probe.py`로 생성한 정사영 진단입니다. 앱 스크린샷이 아니고 다른 두 형상을 정합하거나 변형한 결과도 아닙니다. 아래쪽 두 주황 조각과 위쪽 가지의 분리를 직접 확인했습니다. 청록/자주 형상은 투영에서 거의 겹칩니다. 가림과 평면 투영은 표면 동일성·3D 연결의 증거가 아니며 최근접 정점 거리도 표면 거리가 아닙니다.

## 다음 작업의 기준

전체4.3 part_of 목록을 바로 합치면 가지와 상위 개념 형상이 함께 들어갈 수 있습니다. 공식 계층과 실제 형상의 대응을 더 확인해, 같은 조직의 대체 표현을 동시에 표시하지 않는 수록 기준을 정해야 합니다. 두 기존 조각을 임의로 위로 옮기거나 삭제해 해결한 것으로 처리하지 않았습니다. 여성 보완 골격·근육, 남녀 신경 연결, 실제 근육 층서 등 전체 목표는 미완료입니다.

## 검사와 agy 범위

Node 단위172/172(건너뛰기0), 이 기록의 회귀3개 통과. 기록 검사는 대용량 원본 재검사의 대체물이 아니며, 이번에는 위 원본 감사 스크립트를 별도로 실행했습니다. 앱 기하·동작은 미변경으로 앱 브라우저/모바일·프로덕션·201단계 기하 게이트를 반복하지 않았습니다.

agy 대화 `9a7022e3-5dae-44f5-bf27-61b3062a0377`는 지정한 코드/검사/문서6개의 읽기 전용 정적 검토로SUCCESS 종료했습니다. 실행·브라우저·편집은 요청하지 않았고 응답도 실행 승인으로 사용하지 않습니다. 원본 정점 일치와 해부 정확도, 최근접 정점과 표면 거리의 구분에 새 결함을 보고하지 않았습니다. 응답의 ‘수치가 정확히 일치’는 코드/문서 대조이며 원본 수치의 독립 재실행이 아닙니다. 다운로드 스크립트는 두 representation을 보존하고, 실제 차이의 기록/단언은 후속 감사·테스트에서 수행한다는 범위를 명확히 합니다.
