# 자료 조사 기록

조사일: 2026-09-07. 사용자가 요청한 오픈 3D 해부 모델, 경혈 자료, 라이브러리 비교, LLM 위키를 함께 구현하기 위한 기록입니다.

## 출처와 사용 범위

| 자료                                                                                      | 확인한 내용                                                              | 산출물                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------- |
| [WHO 경혈 명칭](https://www.who.int/publications/i/item/9290611057)                       | 361개 고전 경혈의 표준 명칭 체계                                         | 전체 체계와 선별 20개 수록 범위 구분   |
| [WHO 위치 표준](https://iris.who.int/handle/10665/353407)                                 | 20개 항목의 해부학적 위치 및 인쇄 쪽수, B-cun 개념                       | points.json의 짧은 위치 요약·쪽수      |
| [WHO 실무 기준](https://www.who.int/westernpacific/publications/i/item/978-92-4-001688-0) | 침술 서비스의 인프라·안전 실무 기준이라는 문서 목적                      | 시술 지침과 학습 도구의 역할 구분      |
| [NCCIH](https://www.nccih.nih.gov/health/acupuncture-effectiveness-and-safety)            | 조건별 근거, 대조군 차이, 심각한 위해 가능성                             | 근거 해석 가이드                       |
| [BodyParts3D](https://lifesciencedb.jp/bp3d/info/index.html)                              | 해부 메쉬와 개념의 대응, 버전 간 좌표 차이, 오류 가능성, CC BY-SA 2.1 JP | 단일 버전 모델·라이선스 및 한계        |
| [STL 미러](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D)                         | v3.0 선택 이유, 원본 출처, STL 변환, 필수 귀속                           | 커밋 고정 다운로드·GLB·해시 매니페스트 |

WHO 공식 PDF는 이 환경에서 403/타임아웃으로 읽을 수 없었습니다. 따라서 [WHO 2008/2009 문서의 공개 재현본](https://www.scribd.com/document/235727760/World-Health-Organization-WHO-Standard-Accupuncture-Point-Locations)에서 항목과 **책의 인쇄 쪽수**를 직접 대조했습니다. 출처 목록에 접근 경로를 명시했습니다. 재현본의 업로더를 원저자로 취급하지 않으며 원문 PDF나 도판을 저장·재배포하지 않습니다.

## 경혈 확인 표

| 경혈 | 이름   | 인쇄 쪽수 |
| ---- | ------ | --------- |
| LU9  | 태연   | 30        |
| LI4  | 합곡   | 35        |
| LI11 | 곡지   | 39        |
| ST25 | 천추   | 58        |
| ST35 | 독비   | 63        |
| ST36 | 족삼리 | 64        |
| SP6  | 삼음교 | 72        |
| SP9  | 음릉천 | 74        |
| HT7  | 신문   | 85        |
| SI3  | 후계   | 89        |
| BL40 | 위중   | 119       |
| KI3  | 태계   | 137       |
| PC6  | 내관   | 154       |
| TE5  | 외관   | 160       |
| GB20 | 풍지   | 181       |
| GB34 | 양릉천 | 188       |
| LR3  | 태충   | 197       |
| GV20 | 백회   | 213       |
| CV12 | 중완   | 225       |
| CV17 | 전중   | 228       |

## 기술 조사

기능·라이선스는 각 프로젝트의 공식 저장소/문서를 참조했습니다. 구체적 적합도와 선정은 이 앱의 요구사항에 대한 설계 판단입니다. 인기순위·실측 FPS·용량 비교로 오해할 수 있는 점수는 부여하지 않았습니다.

[라이브러리 비교 본문](../wiki/topics/library-comparison.md)에는 Three.js + R3F, Babylon.js, vtk.js, model-viewer와 보조 도구의 비교 및 사용 근거가 있습니다. 설치 버전은 `package-lock.json`을 기준으로 합니다.

## 검증되지 않은 사항

의료 전문가의 경혈 위치·해부 구조 검수, 모델 투영의 임상 좌표 오차, 체형·성별·연령 간 일반화, 임상 효능 및 자침 안전성, 로컬 LLM의 실제 의료 답변 품질은 검증하지 않았습니다. 자료와 화면 모두 이 경계를 유지합니다.


## 2026-09-08 확장 조사

BodyParts3D의 동일한 고정 커밋에서 장기 19개, 주요 혈관 50개, 뇌 구조·시신경 7개를 추가했습니다. 원본 파일·해시·변환 결과는 모델 매니페스트에 기록됩니다. 척수관을 척수 조직으로 대체하거나 가상의 말초신경을 생성하지 않았습니다.

원혈·모혈·오수혈·낙혈 분류는 [eLotus CORE의 교육 분류표](https://www.mastertungacupuncture.org/acupuncture/traditional/system/pointcharts)와 대조했습니다. 효능 서술은 채택하지 않았습니다. 원혈·모혈 각 12개 목록과 WHO 표기 정규화는 `wiki/topics/point-categories.md`, 점별 매핑은 `data/point-concepts.json`에 있습니다.

신규 16개 위치는 WHO 위치 표준 재현본의 LU1 p.26, ST42 p.67, SP3 p.71, SI4 p.89, BL64 p.132, PC7 p.155, TE4 p.159, GB40 p.191, LR13·LR14 p.202, GB24 p.183, GB25 p.184, CV3·CV4 p.221, CV5 p.222, CV14 p.226과 대조한 짧은 요약입니다. 투영 좌표는 별도의 학습용 편집값입니다.

[NCCIH 마사지 안내](https://www.nccih.nih.gov/health/massage-therapy-what-you-need-to-know)에서 연부 조직 마사지의 근거 한계와 위험을 확인했습니다. 내부 장기를 직접 마사지하는 압력·깊이·방향 지침으로 확장하지 않았습니다.
