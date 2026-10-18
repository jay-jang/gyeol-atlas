**거부 — 현재 구현의 공개 승인을 보류합니다.** 출처 탐색이 아틀라스로 이탈하고, 보행 도식 일부가 본문의 역학 설명과 반대로 표시됩니다.

코드·데이터·저장된 화면을 대조했고, 동작 단위 검사 9/9 통과를 재확인했습니다. 검토 환경에서는 `127.0.0.1:5174`에 연결되지 않아 실시간 브라우저 조작은 재검증하지 못했습니다. 파일 수정과 서버 재시작은 하지 않았습니다.

| 우선순위·위치 | 영향 | 정확한 수정 |
| --- | --- | --- |
| P1 · [MovementPage.tsx:55](/Users/nuinuri/workspace/anatomy/src/MovementPage.tsx:55), [App.tsx:550](/Users/nuinuri/workspace/anatomy/src/App.tsx:550) | 출처 링크의 `#mv-src-*`가 라우터에서 아틀라스 경로로 해석됩니다. 문서 탐색이 끊기고 3D 로딩 경로에 진입합니다. | 동작 경로를 유지하면서 출처 항목으로 스크롤·초점을 이동시키십시오. 클릭·Enter 모두에서 경로 유지와 GLB 요청 0건을 검사하십시오. |
| P1 · [MovementFigure.tsx:207](/Users/nuinuri/workspace/anatomy/src/MovementFigure.tsx:207) | 반력 시작점이 항상 발 가운데입니다. 현재 코드 계산상 주기 2%에서 작용선은 무릎 **앞 약 85mm**, 31%에서는 **뒤 약 27mm**로, 데이터가 설명하는 앞뒤 관계와 반대입니다. | 키프레임에 압력중심 위치를 명시하고 발꿈치→앞발 이동을 반영하십시오. 작용선과 관절의 위치 관계를 국면·보간 구간에서 검사하고, 근거 없는 구간은 표시하지 마십시오. |
| P1 · [MovementFigure.tsx:191](/Users/nuinuri/workspace/anatomy/src/MovementFigure.tsx:191) | 바닥에 가까우면 지지발로 취급합니다. 주기 31%에서 유각발이 기준 높이보다 약 6.7mm 위에 있지만 양발 지지로 판정되어 지지면이 부풀려집니다. | 접촉 사건에 따른 지지발 상태를 사용하십시오. 단순 거리 허용치로 유각발을 지지면에 포함하지 않도록 검사하십시오. |
| P1 · [walking.json:337](/Users/nuinuri/workspace/anatomy/data/movements/walking.json:337), [walking.json:1353](/Users/nuinuri/workspace/anatomy/data/movements/walking.json:1353) | 기준계가 확인되지 않은 엉덩관절 각도를 이어 붙이고, 서로 다른 연구의 관절별 최대값을 동시 자세로 합성합니다. 합의안 §3 공통 원칙 위반입니다. | 전체 궤적의 각도 기준을 통일하십시오. 기준계 변환은 근거를 제시하고, 최대값의 동시 배치는 제거하십시오. 발 접촉을 맞추는 문제는 좌표·접촉 모델에서 해결하십시오. |
| P1 · [arm-elevation.json:95](/Users/nuinuri/workspace/anatomy/data/movements/arm-elevation.json:95), [arm-elevation.json:123](/Users/nuinuri/workspace/anatomy/data/movements/arm-elevation.json:123) | 올리기 중간값은 Ludewig의 **15° 기준**, 최대·내리기는 McClure의 **휴식 기준**인데 같은 변화량으로 그립니다. 올리기·내리기 차이에 기준점·표본 차이가 섞입니다. | 휴식 기준으로 통일하고, 경로 비교에는 같은 연구의 올리기·내리기 곡선을 사용하십시오. 다른 연구는 별도 비교값으로 제시하십시오. |
| P1 · [walking.json:992](/Users/nuinuri/workspace/anatomy/data/movements/walking.json:992), [MovementPage.tsx:444](/Users/nuinuri/workspace/anatomy/src/MovementPage.tsx:444) | 말기 입각기에서 안쪽·가쪽장딴지근 묶음 전체에 ‘등척성·초음파’가 붙습니다. 안쪽갈래만 측정했다는 제한은 렌더링되지 않는 `note`에 있습니다. | 갈래별 판정을 분리하고 안쪽갈래에만 해당 결론을 붙이십시오. 각 셀의 측정 대상·제한을 표와 현재 단계 설명에서 열람할 수 있게 하십시오. |
| P2 · [MovementPage.tsx:414](/Users/nuinuri/workspace/anatomy/src/MovementPage.tsx:414) | 휴대폰 전체 비교표는 수축·근거 꼬리표만 남기고 역할·출처·제한·FMA ID를 생략합니다. | 모바일에서도 셀별 근거와 제한을 펼쳐 읽고, 행의 FMA ID를 확인할 수 있게 하십시오. |
| P2 · `mobile-04-sit-to-stand-extension.png`, `landscape-10-arm-elevation-120-max.png` | 세로 화면은 긴 근육 범례가 현재 단계 설명을 밀어냅니다. 가로 첫 화면은 도식이 잘리고 조작부가 보이지 않습니다. 합의안 T20 미충족입니다. | 현재 단계 한 줄 설명을 조작부 바로 뒤에 배치하고 긴 범례·조건은 접으십시오. 가로 화면에서는 도식·필수 조작부가 함께 들어오는지 실제 스크롤 화면도 확인하십시오. |

네 가지 개정의 판정은 다음과 같습니다.

1. **걷기 20°: 수치 자체는 수용, 현재 혼용 방식은 불수용.** Perry의 넙다리–수직선 기준값을 채택할 수 있지만, 다른 기준의 값을 변환 없이 연결해서는 안 됩니다. [Perry·Burnfield 미리보기](https://api.pageplace.de/preview/DT0400.9781040143698_A49203435/preview-9781040143698_A49203435.pdf)
2. **유각 무릎 65°: 수용.** AAPMR 표의 60–65° 범위 안입니다. 발끝 간격을 맞추려고 선택한 편집값이라는 설명은 유지하십시오. [AAPMR 유각기 표](https://now.aapmr.org/wp-content/uploads/2017/03/Biomech-of-gait-Table-2-Swing-Phase.pdf)
3. **Ludewig 범위 정정: 수용.** 120° 공통 측정점과 최대 거상 평균점은 구별해야 합니다. 다만 현재 곡선의 기준점 혼용은 위 표대로 수정해야 합니다. [Ludewig 2009](https://drrobertlaprademd.com/wp-content/uploads/2015/07/motion-of-the-shoulder-complex-during-multiplanar-humeral-elevation-2009.pdf), [McClure 2001](https://pages.uoregon.edu/biomech/obl/articles/2001_mcclure_jses2001.pdf)
4. **일어서기 시작 자세: 편집 근사로 조건부 수용.** 82.7°는 좌면 이탈값이며 원 연구의 시작 설정은 무릎 90°입니다. 현재 차이 설명을 유지하고, 원 연구 시작 자세를 재현한 것으로 표현하지 마십시오. [Kinoshita 2015](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0133747)

비차단 의견:

- 데스크톱은 기존 위키와 조화롭고, 장식 카드·통계가 없어 ‘AI스러운 UI’ 인상은 크지 않습니다.
- 아틀라스 연결의 상태 전이 집중화와 재생 감소 대응은 방향이 적절합니다. 다만 여성 검사는 현재 링크 주소 확인에 그칩니다([movement.spec.ts:110](/Users/nuinuri/workspace/anatomy/tests/browser/movement.spec.ts:110)). 여성 구조 실제 열기·연결조직 설정 보존·복귀·새로고침의 화면 검증 전에는 완료로 기록하지 마십시오.