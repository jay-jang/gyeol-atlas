# 여성 원본 외피·지방과 메타데이터 확보 — 2026-09-21

추가 다운로드를 확인했습니다. 이전의 자동 다운로드 차단은 **사용자가 제공한 두 ZIP에 대해서 해소**됐습니다. Downloads의 원본은 이동하거나 변경하지 않았습니다. 이 기록은 자료 확보와 원본 좌표 검사이며, 공개 앱의 기하·선택·박리를 변경하거나 여성 정합을 완료한 기록이 아닙니다.

## 원본과 라이선스

[University of Denver 공식 배포 페이지](https://digitalcommons.du.edu/visiblehuman/1/)의 Original 3D STL Models와 Metadata입니다. 제공 ZIP의 README와 공식 페이지 모두 CC BY 4.0을 명시합니다. 인용: Andreassen et al., *Three-dimensional lower extremity musculoskeletal geometry of the Visible Human Female and Male*, Scientific Data 10, 34 (2023), DOI [10.1038/s41597-022-01905-2](https://doi.org/10.1038/s41597-022-01905-2). 처리 방법: Andreassen et al., *An Automated Process for 2D and 3D Finite Element Overclosure and Gap Adjustment using Radial Basis Function Networks*, [arXiv:2209.06948](https://doi.org/10.48550/arXiv.2209.06948).

- `Original 3D STL Models-stl.zip`: SHA-256 `cabc34be5b6d9ebed92983257aec8c394bbca658bb7d218cb4a48d84ba4cc5eb`.
- `MetaData.zip`: SHA-256 `520a06cd4e54b887d937450868e27fa22f93fb79782a6751af0e19c15bdab755`.

둘 다 `unzip -tq`의 전체 압축 무결성 검사를 통과했습니다. 해시는 받은 파일을 식별하며, 배포자가 별도로 서명한 해시와 대조했다는 의미는 아닙니다. 전체 목록·정확한 바이트 수·검사 파일 해시는 [기계 판독 기록](donor-original-receipt.json)에 있습니다.

## 새로 확보한 모형

Original ZIP에는 뼈28·근육76·연골16·인대8개와 `Both`4개, 총 **132 STL**이 있습니다. 이 수를 서로 독립적인 조직132개로 해석하지 않습니다. 앞선 Final ZIP128개에는 `Both`의4개가 없었습니다.

| Both 파일 | 실제 삼각형 수 | 원본 좌표 범위 크기 X/Y/Z(mm) |
| --- | ---: | --- |
| `VHF_Both_All.stl` |652,568 |441.321 / 284.917 / 1,174.054 |
| `VHF_Both_Fat_InterMuscular.stl` |1,664,362 |347.685 / 231.812 / 1,014.377 |
| `VHF_Both_Fat_Outer.stl` |1,105,382 |441.305 / 285.143 / 1,174.209 |
| `VHF_Both_Inner.stl` |460,064 |347.669 / 231.780 / 1,014.225 |

각 파일의 ASCII 삼각형 구조·모든 정점 좌표의 유한성·경계를 직접 읽었습니다. 원본 좌표축이므로 X/Y/Z를 앱의 좌우/상하/전후 축으로 단정하지 않습니다. 표면의 폐쇄성·다양체성·포함 관계·조직 대응은 아직 검증하지 않았습니다.

공식 설명의 `Outer fat`은 **표피+진피+지방의 합성 조직**이며 표피만의 독립 레이어가 아닙니다. `Intermuscular`에는 지방과 근막이 포함됩니다. `All`과 `Inner`의 정확한 조직 구성은 별도 대조가 필요하며 파일명만으로 전체 신체의 채워진 외피라고 가정하지 않습니다. 자료 범위는 하체로, 누락된 상체 근육·장기를 보완한 것이 아닙니다.

## 메타데이터: 원본의 가공 이력과 현재 앱을 구분

6개 XLSX의 실제 셀을 읽었습니다. 좌우 겹침량 표는108/113행입니다. 왼쪽에는 동일한 무순서 조직쌍을 반복한1행이 있어 고유쌍107개이며, 오른쪽은113개입니다. 오른쪽21행의 `1000`은 README에 명시된 **수동 수정 필요 표시**이고 실측1,000mm가 아닙니다. 이 표시를 제외한 표의 최대값은 왼쪽7.095mm·오른쪽8.765mm입니다.

이 값은 제작 과정의 초기 겹침량 메타데이터입니다. Final 자료나 현재 앱의 잔여 교차 거리로 가져다 쓰지 않습니다. 기존 독립 삼각형 교차 진단과도 정의·처리 시점이 달라 직접 비교할 수 없습니다. 왼쪽 전/후 부피 표는 각각65행, 오른쪽은 각각63행입니다. 표의 이름 철자는 보존하며, STL 파일과 자동 일대일 대응한 상태는 아닙니다.

## 보존·재현과 다음 검사

검사에 필요한 `Both`4개·README·Metadata만 `.cache/donor-original-zGjXMX/`에 추출했습니다. 원본 ZIP의 나머지128개 STL은 목록과 압축 무결성만 확인했으며, 이번에 그 정점 전체를 읽었다고 주장하지 않습니다. 대형 원본 및 추출물은 GitHub에 추가하지 않았습니다.

```sh
npm exec --yes --package=node@24.14.0 -- node scripts/audit-donor-original.mjs \
  '/Users/nuinuri/Downloads/Original 3D STL Models-stl.zip' \
  '/Users/nuinuri/Downloads/MetaData.zip' .cache/donor-original-zGjXMX
```

단위91/91 통과. 새2개는 ASCII 삼각형/경계와 한정된 XLSX 셀 해석 검증입니다. 앱 코드·모델은 변경하지 않았으므로 브라우저·박리201단계 검사를 이번에 재실행하지 않았습니다.

agy 읽기 전용 제한 검토 `e9adff28-b686-40e3-8d14-8d87609458ae` 완료. 작업 디렉터리에 의존하던 자기 파일 해시 경로를 모듈 URL 기준으로 보완했습니다. 응답의 `All`/`Inner`를 “enclosure”로 부른 표현은 아직 입증되지 않았으므로 채택하지 않습니다. 삼각형 구문 검사도 실제 표면 위상 검사가 아닙니다. 단위 검사는1000값과 셀 주소를 보존하는지만 확인하며, 실측 최대값에서 이를 제외한 결과는 실제 파일 실행 기록에서 별도로 확인했습니다.

다음은 이 원본의 표면 연결/폐쇄 상태와 Final 근육의 좌표 대응을 확인한 뒤, 기존 HRA 피부와의 차이를 분리하는 일입니다. 새로운 외피에 맞춰 근육을 줄이거나 현재 피부를 변경해 이탈을 감추지 않습니다. 전체 목표는 미완료입니다.
