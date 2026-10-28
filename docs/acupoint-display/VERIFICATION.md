# 경혈 분류색과 연결 장부 표시 — 2026-10-28

요청: “각 혈에서 원혈 모혈 유혈 극혈 락혈등은 별도의 표시나 색으로 표한할 수 있도록 해줘. 그리고 각 혈에 연결된 장기별로 표시할 수 있도록 해줘.”

작업 worktree: `/Users/nuinuri/workspace/anatomy-worktrees/acupoint-classification`, 브랜치 `feat/acupoint-classification`. 모델 형상·좌표·수록 메쉬 범위는 변경하지 않았습니다.

## 요구와 증거

| 요구 | 구현 | 확인 증거 |
| --- | --- | --- |
| 원·모·유·극·락·오수혈 구분 | `data/concepts.json`, `build-acupoint-theory.mjs`, `point-display.ts`; 원12·모12·유12·극16·락15·오수60 | `tests/point-display.test.mjs`: 독립 코드 집합과 두 데이터 내보내기 대조 |
| 색상·별도 표기 | 목록의 표식 색상(경맥/분류/장부), 범례, 목록·상세 분류 표기, 분류색의 이름표 약자 | 추가 브라우저7/7: Three.js 실제 인스턴스 색·다중 분류 검증; [데스크톱 범례](desktop-legend.png) · [휴대폰 범례](mobile-legend.png) |
| 겹친 분류 유지 | 모두 표기, 현재 분류 필터색 우선; 전체에서는 원·모·유·극·락·오수 순 | LU9 원혈+오수혈 및 필터색 검사 |
| 연결 장부별 표시 | 12장부+배속 없음, 소속 경맥과 모혈·유혈 대응을 함께 찾음 | ST25 대장·위, BL13 폐·방광, GB25 신·담, CV12 위, 미배속 항목 검사 |
| 장기 비교 일관성 | 새 유혈의 명시적 비교는 기존 원혈의 전체 메쉬 묶음을 사용 | 폐5·콩팥2; 심포·삼초 메쉬 없음 검사 |
| 카메라·선호·복원 | 새 상태는 `view-state.ts`의 marker-color/filters 및 구버전 migration | 단위 검사와 실제 위키 왕복·새로고침·성별/계통 전환 검사 통과 |
| 모바일·키보드·접근성 | 기존 장면 위 패널의 접이식 필터, 공유 크기/간격 토큰, 네이티브 분류·장부 선택기와 색상 버튼 | 4화면 경계·가로 넘침 검사, 버튼 Enter·범례 Enter·터치 탭 통과. [360px 목록](small-mobile-list.png) · [390px 목록](mobile-list.png) · [가로 화면](landscape-list.png) |
| 출처·한계 | 위키 분류 문서와 출처 갱신 | 아래 자료와 편집 규칙, 전문가 미검수 고지 |

## 근거와 편집 결정

- [eLotus CORE의 원저 분류표](https://www.mastertungacupuncture.org/acupuncture/traditional/system/pointcharts), 2026-10-28 열람: Specific Points·Five Shu 표를 코드 단위 대조. TH→TE 정규화. 효능·시술 문구는 채택하지 않음.
- [AAMA Review Course, Section B](https://medicalacupuncture.org/wp-content/uploads/2025/01/Section-B-2025.pdf), B.2, 2026-10-28 열람: 분류 범위 보조 확인(개별 코드 출처가 아닌 빈 학습표).
- 유혈은 背俞穴(십이장부 배수혈)로 해석. 輸穴(오수혈 중 수혈)은 별도. 이름에 ‘유’가 있는 모든 점을 배수혈로 확대하지 않음.
- 극혈의 기경4는 KI8 음교·BL59 양교·KI9 음유·GB35 양유맥으로 적되 그 점의 소속 경맥 장부와 동일한 관계라고 표현하지 않음.
- 장부 필터는 명시된 대응과 소속 경맥의 합집합. 낙혈의 표리 관계·문헌상 효능 전체로 확장하지 않음. 장부색은 실제 장기 메쉬 색과 별개.
- `build`/`wiki:build` 및 전체 경혈 재조립에서 분류 생성기를 실행하여 유혈·극혈이 소실되지 않도록 함.

## 검증 진행 기록

- Node 단위 **501/501 통과, 건너뜀0**. 최초 worktree 실행은 원본 캐시가 없어3개를 건너뛰었고, 기존 원본 GLB·여성 장면·앵커 광선 캐시를 읽는 링크를 작업 worktree에 마련하여 모두 다시 검사했습니다. 최초 실행은 Atlas.tsx 전체 파일 해시를 고정한 기존 근육 감사1건이 실패. `node scripts/audit-muscle-peel.mjs`로 실제 일정과 입력을 재감사한 결과, 근육 데이터·관계는 동일하고 Atlas.tsx 해시만 갱신됨.
- TypeScript·정적 빌드 통과. 기존 500kB 초과 청크 경고 유지.
- 환경: 앱에 포함된 Node는 네이티브 모듈의 Team ID 불일치로 Vite 실행 실패. WASM 대체 시도도 실패. worktree의 `.cache`에 공식 Node v24.14.0을 풀어 잠금파일 그대로 `npm ci` 후 빌드 통과. 원본 실행 서버와 분리한 포트5175/API3002 사용.
- 추가 브라우저 **7/7 통과**: 1440×900, 390×844, 360×740, 844×390의 분류16/유혈12·장부 교차, 실제 인스턴스 색, 선택 참조, 위키·새로고침, Enter·터치·여성 근사, 유혈→폐5메쉬 비교. 최종 렌더러는 Chromium Metal(`PLAYWRIGHT_GPU=1`).
- 프로덕션 스모크 통과: 위키/동작 진입의 Atlas·GLB 요청0, 남녀 모델·묶음 복원·API·내보내기·출처, 페이지 오류0.
- 모바일 가독성 **258표본/15면**, 12px 이상·대비4.5:1 이상 통과(분류 약자 글자의 실제 면도 포함).
- 최종 화면: 목록·필터·유혈 후면을 네 화면에서 촬영하고 직접 확인. 색상·범례는 상세 필터 안으로 옮기고 기본으로 접어 360px에서도 첫 결과의 이름·코드·분류·장부가 함께 보이게 했습니다. 긴 분류명 때문에 선택기가 가로로 잘린 문제는 `minmax(0,1fr)`와 필드 최소 폭으로 고쳤습니다.
- 전체 브라우저 **최초184/185 통과**. 실패1개는 분류명의 옛 DOM 위치를 고정한 `site.spec.ts` 검사였습니다. 원혈 배지12개를 직접 검사하도록 고쳤고, 마지막 상세 레이아웃 보정 후 **관련26/26 통과**(신규7 + 경혈3 + 키보드8 + 비교 레이아웃2 + 사이트6). 전체185개를 마지막 보정 뒤 다시 실행한 것으로 표현하지 않습니다.
- 최종 `npm run test:visual`: 네 화면의 초기·목록·비교·단독 확대, 도구 비중첩·이름표 위치 통과. [측정](workspace/layout-metrics.json). 데스크톱·휴대폰·작은 휴대폰·가로 화면의 실제 이미지를 직접 검토했습니다.
- 최종 겹침 감사: **8화면94상태 통과**, 실패0, 휴대폰 패널·단계 띠45% 제한과 패널 여닫기 카메라 유지. [측정](scene-overlays.json).
- 원저 편집 입력만 둔 빈 임시 디렉터리에서 분류 데이터를 생성한 결과와 재실행 결과 모두 현재 두 JSON과 바이트 단위 일치. [측정](generator-verification.json).
- [최종 소스 해시·검사 요약](verification.json), [단위 로그](checks/unit.log), [전체 브라우저 최초 로그](checks/browser-full.log), [최종 관련26개 로그](checks/browser-final.log), [프로덕션](checks/production.log), [가독성](checks/readability.log), [시각 게이트](checks/visual.log), [겹침](checks/overlays.log).
- 회귀 검사가 덮어쓴 과거 작업의 PNG는 원래 기록으로 복원했고, 이번 화면은 이 디렉터리에 보존했습니다. `VISUAL_OUTPUT`을 추가하여 일반 시각 게이트도 이번 디렉터리에 별도로 기록합니다.

### 실패와 수정

- 최초 프로덕션 스모크는 분류 문서의 옛 제목을 고정한 검사1건이 실패했습니다. 내용의 식별자인 문서 경로로 찾도록 바꾸고 재실행하여 통과했습니다.
- 추가 브라우저 검사 작성 중: ‘필터 결과 보기’ 후 선택 경혈까지 사라진다는 기대는 Q26과 달라 수정했습니다(선택 참조 유지, 화면 안내 추가). 미배속 경혈100개라는 기대는 임맥의 명시적 모혈6개를 빼지 않은 오류로94개로 고쳤습니다.
- macOS 헤드리스의 네이티브 select 방향키 선택이 최소 독립 페이지에서도 작동하지 않았습니다. 색상 선택을 명시적인3버튼으로 다듬어 실제 Enter 조작을 검사했습니다. 분류·장부 자체는 네이티브 select입니다. 실기기 키보드 메뉴 동작을 검증했다고 주장하지 않습니다.
- 범례를 상세 필터 안으로 이동한 뒤 기존 공용 헬퍼가 하위 summary 둘을 찾으면서5개 검사가 실패했습니다. 직접 자식 summary를 고르도록 고친 뒤 추가7개를 모두 다시 통과했습니다.
- 초기 SwiftShader 촬영에서 모델의 몸통 일부가 비어 보이는 프레임을 관찰했습니다. 최종 Metal 촬영으로 인체·표식 전체를 다시 확인했습니다. SwiftShader 전환경의 렌더링 안정성을 입증한 것은 아닙니다.

### 마지막 화면 검토와 보정

새 분류·장부 두 줄을 고정 머리에 더하니 터치 휴대폰에서 상세 본문이 탭 아래로 밀려났습니다. 두 줄을 기본 ‘개요’ 본문으로 옮기고, 전통 대응 고지를 짧게 유지하며, 모든 휴대폰 상세가 한 시트로 스크롤되도록 고쳤습니다(탭은 상단에 붙음). 본문을 읽을 때 탭 아래 **48px 이상**이 남는지를390×844·360×740에서 실제 검사하여 통과했습니다. [390px](detail-tradition-390.png) · [360px](detail-tradition-360.png). 최초 검사는 -12.8px, 두 줄만 옮긴 중간 검사는39.2px라 실패했으며, 완성된 시트 스크롤 동작에서 통과했습니다. [보정 전 실패 로그](checks/detail-before.log) · [보정 후](checks/detail-after.log).

## 재현

- `npm test`, `npm run build`, `npm run test:production`.
- `PLAYWRIGHT_GPU=1 npx playwright test`(전체), 마지막 영향 범위는 `tests/browser/{point-display,acupoints,panel-keyboard,comparison-layout,site}.spec.ts`.
- `PLAYWRIGHT_GPU=1 node scripts/check-readability.mjs`, `PLAYWRIGHT_GPU=1 npm run test:visual`, `PLAYWRIGHT_GPU=1 npm run audit:overlays`.
- 이번 실행은 기존 서버와 충돌하지 않게 worktree의 임시 Vite/Playwright 설정으로5175/API3002 포트를 사용했습니다. 다른 포트에서 검사하려면 `SMOKE_ORIGIN`을 지정합니다. 모델·원본 검사 캐시와 플랫폼 Node 설치는 작업 worktree의 `.cache`에만 두었습니다.

## 한계

한국어 분류·장부명은 편집 표기이며 전문가 미검수입니다. 표식은 기존 학습용 근사이고 여성은 근사 표시를 명시적으로 켜야 합니다. 미수록 해부 구조를 만들지 않았으며 전통 대응을 압력 경로·임상 효능으로 표현하지 않습니다. 실기기 Safari·VoiceOver는 확인하지 않았습니다. 공개 배포는 포함하지 않았습니다.
