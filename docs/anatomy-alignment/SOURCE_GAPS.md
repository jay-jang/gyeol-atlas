# 여성 참조 미수록 구조 — 2026-09-20 확인

후속 조사에서 **VIVA+ v2.0.2 여성 standing 상지의 실제 원본을 확보**했습니다. 상지96개 계산 부품(면/체적92개·두 점 인대4개)과 관절16개를 검사했습니다. 손뼈는 집합 형태이며 HRA 정합과 전체 상체 근육·말초신경 보완은 미완료입니다. 앱에 합치지 않았습니다. [고정 원본·검사·적용 조건](VIVA_SOURCE_AUDIT.md).

현재 사용 중인 고정 Human-Atlas/HRA 원본의 concept·mesh 목록에는 위가 없고, 근육·말초신경도 전신 전체를 수록하지 않습니다. 기존 남성 장기를 여성 체표 안에 옮기거나 비장의 ‘gastric surface’를 위로 바꾸는 것은 보완으로 인정하지 않습니다.

확인한 자료:

- [Human-Atlas 원본 설명](https://github.com/slorksmo/Human-Atlas): 여성 원본의 근육은 눈·무릎 중심이며, 별도 여성 기증자의 하체 근육을 보완합니다. 현재 보관한 manifest와 출처는 `data/catalog/female-atlas-source.json`, `public/models/female/ATTRIBUTION.md`입니다.
- [NLM Visible Human Project](https://www.nlm.nih.gov/research/visible/visible_human.html): 여성의 CT·MRI·절단면 사진을 공개하지만 이는 즉시 사용할 수 있는 기관별 GLB 패키지가 아닙니다. 공식 설명의 여성 영상 자료는 약40GB·절단면5189장입니다. 이를 여성 위·상체 근육 등의 검증된 표면 모형으로 만드는 데에는 기관 분할과 해부 검수가 필요합니다.

이 확인은 ‘어디에도 공개 여성 모형이 없다’는 결론이 아닙니다. 현재 바로 통합할 수 있는, 성별·좌표·재배포 조건이 확인된 전체 여성 기관 패키지를 확보하지 못했다는 뜻입니다.

추가 원본을 확인할 조건은 재배포 라이선스, 여성 자료임을 입증하는 출처, 개별 구조명·구성 관계, 길이 단위·좌표축·자세, 여성 체표와 대조할 공통 기준 구조입니다. 단순히 모델 개수를 늘리거나 이름을 여성으로 바꾸어 전체 기관 수록으로 표시하지 않습니다. 전체 수록 요구는 여전히 미완료입니다.

## 별도 공개 자료 확보 — 사용자 요청에 따른 후속 조사

사용자가 보유한 모델은 없으므로 공개 3D·분할 자료를 추가 조사했습니다. **여성 위와 양측 부신 원본을 확보했고 앱에 별도 CT 상세로 추가했습니다.** HRA 전신 자체의 누락이 모두 채워진 것은 아닙니다.

| 후보 | 확인 결과 | 적용 |
| --- | --- | --- |
| [TotalSegmentator CT 2.0.1](https://zenodo.org/records/10047292) | 공식 메타데이터 CC BY 4.0. 사례 s0255의 gender=f, 1.5mm 공개 분할 마스크. 위·부신·간·비장·콩팥·췌장은 촬영 경계와 만나지 않음 | 11개 마스크→실제 표면 모형으로 변환, 독립 CT 상세로 도입 |
| 동일 자료 s0241 | metadata의 검사명은 흉복부골반이지만 실제 파일에서 오른 콩팥·췌장 마스크가 비어 있고 왼 콩팥도 거의 잘림 | 제외. 메타데이터 검사명만으로 완전성을 판단하지 않음 |
| [CheRa 여성 근육](https://sketchfab.com/3d-models/female-anatomy-by-chera-muscles-132188d5be9b47eabb0e64b378d81603) | 공식 API에서 CC BY 4.0, isDownloadable=true, 여성 해부 공부용 모델 확인. 정식 다운로드 API는 로그인 부재401 | 후보 확보, 원본 파일은 미확보. 사용자에게 로그인 후 원본 ZIP 첨부 요청. 우회 추출·가입·구매하지 않음 |
| [HRA 공식 ref-organ 목록](https://github.com/hubmapconsortium/hra-kg/tree/main/digital-objects/ref-organ) | 여성 united v1.10까지 확인. 위·전신 상체 근육·말초신경 표면 패키지 없음. ASCT-B 말초신경 목록은 명명 관계표이지3D 모형이 아님 | 기존 HRA 유지 |
| [FHS 여성 상체 OpenSim](https://zenodo.org/records/18259702) | 여성 상체 생체역학 모델은 있으나 근육은 다수 선형 작용선/Hill-type 표현 | 완전한 근육 표면으로 간주하지 않음 |
| [NIH 일반 위 모형](https://3d.nih.gov/entries/21124?version=1) | CC BY 4.0의 공개 GLB이지만 기증자 성별 미확인 | 여성 CT 근거가 확인되는 s0255를 선택, 이 모델은 미도입 |
| [Zygote 여성 소화계](https://www.zygote.com/poly-models/3d-female-systems/3d-female-digestive-system), [SciePro 여성 신경계](https://library.sciepro.com/en/3d-models/female-nervous-system-9213796945381) | 유료 상용 모델. 무료 재배포 허가는 확인하지 못함 | 구매·파일 취득·통합하지 않음 |

### 좌표와 범위

s0255와 HRA의 공통 간·비장·양측 콩팥 경계 중심을 이용해 유사변환을 시험했습니다. 중심 잔차20.33~34.84mm, 맞춤에 쓰지 않은 췌장 중심41.18mm, 약38도 회전이 요구됐습니다. 서로 다른 신체의 장기 배치를 한 좌표계에 합성하는 데 충분하지 않아 **이 변환은 사용하지 않았습니다**. 임상 오차 측정이나 전문가 정합 판정이 아닙니다.

실제 앱의11개 CT 모형은 NIfTI RAS mm→좌·상·앞 m 축 변환과 공통 이동만 사용합니다. 각 기관의 상대 위치·축척·형태를 보존하며 HRA와 한 장면에 겹치지 않습니다. 여성 위·부신은 검색·주요 기관 상세에서 볼 수 있고, ‘주변 기관 함께 보기’는 같은 CT의11개 구조를 보여줍니다. 식도·등 고유근육군은 촬영 경계에서 잘린 부분 자료입니다. 이를 전신 식도·모든 상체 근육으로 표시하지 않습니다. 말초신경 전체는 미확보입니다.

### 재현

원본 마스크11개와 해당 사례의 공개 메타데이터를 `data/female-ct/s0255/`에 보관했습니다. 23.6GB 전체를 받지 않고 HTTP Range로 ZIP 디렉터리와 해당 마스크만 받았으며 ZIP CRC32와 개별 SHA-256을 검사했습니다. 전체 아카이브 MD5를 검사했다고 주장하지 않습니다.

```sh
python3 -m venv .cache/female-ct-venv
.cache/female-ct-venv/bin/pip install -r scripts/requirements-female-ct.txt
.cache/female-ct-venv/bin/python scripts/build-female-ct.py --input-root data/female-ct
node scripts/import-female-details.mjs .cache/female-ct/s0255 data/female-ct/s0255
```

원격 재취득은 `python3 scripts/fetch-female-ct.py --subject s0255 --masks stomach liver spleen kidney_left kidney_right pancreas adrenal_gland_left adrenal_gland_right esophagus autochthon_left autochthon_right`입니다. 고정 DOI·원본 체크섬·선택한 원본 경로·거부한 정합 결과는 `data/catalog/female-detail-source.json`, 배포 고지는 `public/models/LICENSE_female_ct.txt`입니다. 원본1.5mm 해상도로 인한 계단 모양이 남으며 새 분할·스무딩·임의의 미세구조 생성은 하지 않았습니다.
