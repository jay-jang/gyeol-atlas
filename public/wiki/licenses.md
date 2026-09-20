
# 오픈 데이터와 라이선스

## BodyParts3D

모델 원저작자: **The Database Center for Life Science**. 배포 조건은 [CC Attribution-Share Alike 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/)입니다. GLB 변환본에도 같은 라이선스를 적용하며 원저작자·출처·변경 내용을 표시합니다.

STL 제공: [Kevin Mattheus Moerman의 BodyParts3D 미러](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D/tree/f0eeb6e843380cfe6b83797cf8c3e1af74de5e61). 버전과 커밋을 고정했습니다. 파일별 원본 SHA-256 및 변환 정보는 [모델 매니페스트](/models/manifest.json)에 있습니다.

## 남성 전신 보완과 림프계

[Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) 계보의 남성 신경525·혈관640·림프142개 명명 구조를 **CC BY-SA 4.0** 조건으로 표시합니다. 웹용 묶음은 Anatria-3D의 고정 커밋에서 가져왔고 정확한 URL·해시는 로컬 카탈로그에 기록합니다. 미세 말단 전체나 임상적 정합을 뜻하지 않습니다.

## NIH 여성 참조

여성은 [NIH Human Reference Atlas](https://humanatlas.io/3d-reference-library)의 Kristen Browne·Heidi Schlehlein 여성 참조 v1.10과 v1.5 골반 보완 자료를 사용합니다. 하체 근육은 [Andreassen 등(2023)](https://doi.org/10.1038/s41597-022-01905-2)의 다른 여성 기증자 자료이며, 회청색 보완 골격180개는 BodyParts3D 남성 유래입니다. 모두 **CC BY 4.0**입니다. 원본을 패키징한 [Human-Atlas](https://github.com/slorksmo/Human-Atlas)의 고정 커밋과 출처 고지를 보존했습니다.

HRA 전신1,220개 구조에는 위·상체 근육·일부 말초신경이 없습니다. 아래 여성 CT 보완은 별도 상세로 제공하며 HRA에 합성하지 않습니다. 여성 경혈 좌표는 검수 전이라 표식을 숨깁니다. 임상적으로 정합한 단일 기증자 모델이나 모든 기관을 수록한 모델이 아닙니다.

남성 심장·간·폐의 독립 상세 모형423개는 BodyParts3D 4.0의 원본 하위 관계를 따릅니다. **BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International**. [현행 라이선스](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). 전신 모형과 좌표계가 다르므로 별도 상세 보기로 표시합니다.

변경: 정점 병합, 표면 단순화, 법선 재계산, 좌표축 변환, STL→GLB. 모델은 임상 정확도를 검증하지 않았습니다.

## 문헌과 코드

여성 CT 보완 상세: **Jakob Wasserthal, 바젤대학병원**, [TotalSegmentator 2.0.1](https://zenodo.org/records/10047292), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). 여성으로 기록된 사례 s0255의 공개 분할 마스크11개를 사용했습니다. 위·양측 부신과 주변 간·비장·콩팥·췌장, 촬영 범위에서 잘린 식도·등 고유근육군이 포함됩니다. [원 논문](https://doi.org/10.1148/ryai.230024). 변경: 원본1.5mm 마스크의 표면 변환, 축·단위 변환, 모든 모형에 동일한 이동, 법선 계산·양자화·압축, 한국어 편집. 원본을 새로 분할하거나 HRA 전신에 맞춰 형태를 변형하지 않았습니다. 원저작자의 앱 검수·보증을 뜻하지 않습니다. [배포 고지](/models/LICENSE_female_ct.txt).

WHO 문헌은 무료 열람과 재배포 허가를 혼동하지 않습니다. 원문 전체·도판을 저장하거나 오픈 라이선스로 재배포하지 않고, 짧은 학습 요약과 원문 링크를 제공합니다. 위키 초안은 AI 작성이며 WHO의 공식 한국어 번역이 아닙니다.

프로젝트 코드는 MIT입니다. 독자적으로 작성한 위키 서술은 CC BY 4.0으로 제공하되, 인용된 원자료의 권리는 원저작자에게 있습니다. 모델과 파생 좌표에는 각 원본의 조건을 적용합니다. 여성 CT 보완은 CC BY 4.0이며 기존 BodyParts3D 3.0 변환본의 CC BY-SA 2.1 JP와 구분합니다. 세부 경계는 저장소의 `THIRD_PARTY_NOTICES.md`를 참조하세요.

[라이브러리 비교](#wiki/library-comparison) · [출처 목록](#sources)

## 전통적 용도 데이터

TCM Wiki를 간추린 경혈별 전통 용도와 해당 한국어 편집본은 **CC BY-SA 4.0**입니다. 각 경혈 문서에 원문 링크·원저작자·변경 사실을 표시합니다. [TCM Wiki 저작권](https://tcmwiki.com/wiki/copyrights) · [라이선스](https://creativecommons.org/licenses/by-sa/4.0/). 이 부분에는 위의 독자적 서술 CC BY 4.0 조건을 적용하지 않습니다. KMCRIC 위치 발췌와 eLotus의 소골공 짧은 용도 요약은 각 원자료의 권리를 유지하며 별도 출처를 표시합니다.
