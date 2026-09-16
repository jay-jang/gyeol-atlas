---
id: library-comparison
title: 3D 라이브러리 비교와 기술 선택
category: 기술 조사
sources: bodyparts
---

# 3D 라이브러리 비교와 기술 선택

선택: **React + Three.js + React Three Fiber + Drei**. 경혈 선택, 레이어 전환, 검색 결과, 위키 상태를 React로 함께 관리하는 구성이 이번 프로젝트에 적합하다고 판단했습니다. 아래의 적합도는 설계 판단이며 성능 벤치마크 결과가 아닙니다. 조사일: 2026-09-07.

| 후보           | 강점                                                | 이 프로젝트의 부담                                       | 라이선스     | 판단                                |
| -------------- | --------------------------------------------------- | -------------------------------------------------------- | ------------ | ----------------------------------- |
| Three.js + R3F | 메쉬별 선택·강조, React 상태 연결, 사용자 정의 표식 | 카메라·로딩·오류 처리를 설계해야 함                      | MIT          | 채택                                |
| Babylon.js     | 렌더링 엔진, 장면 도구와 상호작용 기능              | React UI와 장면 상태를 연결하는 계층 필요                | Apache 2.0   | XR·복잡한 시뮬레이션 확장 시 재검토 |
| vtk.js         | 과학·의료 시각화, 볼륨과 단면 처리                  | GLB 중심의 경혈 UI에는 추가 통합 필요                    | BSD 3-Clause | CT/MRI 볼륨을 다룰 때 적합          |
| model-viewer   | 웹 컴포넌트로 GLB 표시, 주석·카메라 제어            | 다수 해부 메쉬의 재질·레이어별 상호작용은 별도 구현 필요 | Apache 2.0   | 단일 모델 전시용 대안               |

기능·라이선스 출처: [Three.js](https://github.com/mrdoob/three.js), [React Three Fiber](https://github.com/pmndrs/react-three-fiber), [Babylon.js](https://github.com/BabylonJS/Babylon.js), [vtk.js](https://github.com/Kitware/vtk-js), [model-viewer](https://modelviewer.dev/).

## 함께 사용하는 라이브러리

- **Drei**: OrbitControls, HTML 표식, GLB 로더를 활용합니다. [공식 저장소](https://github.com/pmndrs/drei)
- **meshoptimizer + glTF Transform**: STL을 배포 가능한 GLB로 변환합니다. 원본 해부 구조 이름을 유지하며 형상은 단순화합니다. [meshoptimizer](https://github.com/zeux/meshoptimizer) · [glTF Transform](https://gltf-transform.dev/)
- **React Markdown**: 위키 Markdown을 React로 렌더링합니다. 임의 HTML 실행을 허용하지 않습니다. [공식 저장소](https://github.com/remarkjs/react-markdown)
- **Express**: 로컬 검색과 선택적 LLM 호출을 서버에서 처리합니다. [공식 문서](https://expressjs.com/)
- **Ollama**: 로컬 LLM 연결을 선택적으로 지원합니다. 키 없이 위키 검색이 작동하며, 모델 연결 시 검색 문서에 근거한 요약을 생성합니다. [Chat API](https://docs.ollama.com/api/chat)

## 모델 선택

BodyParts3D는 해부 구조를 ID별 파일로 제공하고 공통 좌표계가 있어 레이어를 겹치기 좋습니다. 이 프로젝트는 v3.0의 STL 미러를 고정하고 피부·뼈·근육 일부를 GLB로 변환했습니다. [원 데이터](https://lifesciencedb.jp/bp3d/info/index.html) · [미러의 버전·라이선스 설명](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D)

## 비용과 확장 기준

현재 409개 경혈에는 로컬 문자열 검색이 충분하다고 판단해 벡터 DB·LangChain·외부 임베딩 API를 도입하지 않았습니다. 문헌이 크게 늘어나면 한국어 검색 회수율을 평가한 후 SQLite FTS나 임베딩 검색을 비교할 수 있습니다. CT/MRI 추가 시 vtk.js, 다중 사용자 편집 시 데이터베이스와 검수 권한 모델을 따로 평가해야 합니다.

현재 모델 크기와 삼각형 수는 [매니페스트](/models/manifest.json)에서 확인할 수 있습니다. 3D 장면은 별도 청크로 로드하고, 수요 기반 렌더링과 제한된 픽셀 비율을 사용합니다.

[좌표 방법론](#wiki/coordinate-method) · [라이선스](#wiki/licenses)
