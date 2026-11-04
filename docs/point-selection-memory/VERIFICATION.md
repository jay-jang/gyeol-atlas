# 경혈 미선택과 마지막 선택 기억 — 2026-10-28

요청: “경혈은 선택이 안된 상태를 만들어 주고 가장 마지막에 선택된 건 브라우저 캐시에 남겨서 다음번 방문에는 그걸 바탕으로 해줘.”

작업 worktree: `/Users/nuinuri/workspace/anatomy-worktrees/acupoint-selection-memory`, 브랜치 `feat/acupoint-selection-memory`.

## 요구와 증거

| 요구 | 구현 | 검증 |
| --- | --- | --- |
| 명시적 미선택 | 경혈 칩의 ‘경혈 선택 해제’, `view-state`의 `clear-point` | 새 브라우저8개 중 네 화면 시나리오 통과. 미선택·URL·이름표·초점과 이름/버튼 경계 검사 |
| 마지막 경혈 기억 | `gyeol-last-point-v1`에 버전·유효 경혈 ID만 로컬 저장 | 단위4개 및 실제 선택 해제→localStorage만 남긴 새 컨텍스트→KI3 복원→ST36 갱신 통과 |
| 탭 연속성 | 기존 `gyeol-view-v2` 세션이 있으면 그것이 우선, 미선택도 포함 | 해제→새로고침→위키 왕복 모두 미선택 유지, 카메라·필터 보존 통과 |
| 첫 방문·명시적 주소 | 기억이 없으면 미선택; 유효한 경혈 주소가 우선 | 빈/손상/알 수 없는 기억 단위 검사, #atlas/ST36 주소 우선·위키3D 요청0 통과 |
| 기존 장면 보존 | 독립 해부 선택/상세 유지; 경혈 소유 비교만 닫음 | 단위 및 실제 비교·단독 종료/독립 위 선택 유지·카메라 동일 검사 통과 |
| 저장 실패 | 세션/로컬 읽기·쓰기 실패를 따로 처리 | 브라우저 localStorage 접근 거부 중 선택·해제 통과; 읽기/쓰기 실패 단위 통과 |
| 작은 화면·접근성 | 공통 토큰·44px 터치·해제 후 미선택 버튼 초점 | 네 화면 Enter·터치44px·포커스·혈명/칩 경계 통과. 가독성258표본·겹침8화면94상태 통과 |

## 동작 기준

- 처음 쓰는 브라우저는 미선택입니다. 선택한 뒤 X를 누르면 현재 화면은 미선택이고 마지막 경혈 기억은 남습니다.
- 같은 탭의 새로고침·위키 왕복은 미선택을 유지합니다. 세션 저장이 없는 새 탭/다음 방문은 마지막 경혈을 선택한 기본 장면으로 시작합니다. 전체 카메라·필터를 다른 방문까지 저장하는 변경은 아닙니다.
- `#atlas/ST36` 같은 유효 경혈 주소는 세션/기억보다 우선합니다. 기존 비교와 같은 경혈로 위키에서 돌아오는 동작은 이전 장면을 보존합니다.
- 저장 범위는 같은 출처(origin)의 브라우저 저장소입니다. 사이트 데이터를 지우거나 영구 저장을 차단하면 마지막 경혈을 다음 방문에 남길 수 없습니다. 기본 선택·해제는 계속 동작합니다. 서버로 선택 기록을 보내지 않습니다.
- 인체 모델·해부 수록 범위·경혈 좌표·전통 분류 데이터는 바꾸지 않습니다.

## 검사 진행

- `npm test`: **505/505**, 건너뜀0. 새 저장소/해제 단위4개 포함.
- `npm run build`: TypeScript·앵커·위키·정적 빌드 통과. 기존 큰 청크 경고 유지.
- 브라우저 영향 범위 **48/48** 통과: 새 미선택/저장8개 + anatomy·comparison-clear·continuity·dissection-input-scope·marker-picking·panel-keyboard·point-display·site. 전체193개를 실행한 결과로 표현하지 않습니다. [로그](checks/regression.log).
- 프로덕션 스모크 통과: 정적 위키/동작은 Atlas·GLB 없이 열리고, 모델·묶음·복원·문서/API/내보내기·출처와 페이지 오류0 확인. [로그](checks/production.log).
- 가독성 **258표본/15면**, 12px 이상·대비4.5:1 이상 통과. [실제 계산값](readability.json).
- 일반 시각 게이트4화면 통과. [측정](workspace/layout-metrics.json). 겹침 감사8화면94상태 통과(실패0·패널45%·카메라 유지). [측정](scene-overlays.json).
- 실제 [데스크톱 선택](desktop-selected.png)·[해제](desktop-cleared.png), [390px 선택](mobile-selected.png)·[해제](mobile-cleared.png), [360px 선택](small-mobile-selected.png)·[해제](small-mobile-cleared.png), [가로 선택](landscape-selected.png)·[해제](landscape-cleared.png)를 직접 검토했습니다. 일반 시각 게이트의 작은 휴대폰 비교·가로 초기 화면도 확인했습니다.
- [최종 소스 해시](verification.json), [단위](checks/unit.log), [빌드](checks/build.log), [시각 게이트](checks/visual.log), [겹침](checks/overlays.log), [가독성](checks/readability.log). 과거 기록의 PNG는 회귀 실행 전 내용으로 되돌리고 새 화면은 이 디렉터리에 보존했습니다.

### 실패와 수정

- 최초 새 브라우저8개는4통과/4실패였습니다. 선택 해제 상태는 맞았지만 해시 변경으로 빈 칩이 생기기 전에 초점을 옮겨서 네 화면 모두 초점 확인이 실패했습니다. 미선택 화면이 반영된 다음 프레임에 옮기도록 고친 뒤8/8 통과했습니다. [최초 로그](checks/initial-browser.log).
- 첫 관련 회귀는47/48이었습니다. 390px에서 긴 코드(EX-LE12)의 이름이17px만 받아23px 글자를 잘랐습니다. 데스크톱은 이름을 먼저 보존하고, 휴대폰은 보조 분류·화살표·색 점을 접어 코드·이름·44px 확대/해제 버튼을 확보했습니다. 새 검사에서 혈명 실제 폭과 모든 버튼의 칩 경계를 검사하고 **48/48**을 다시 통과했습니다. 분류는 상세·범례와 칩의 전체 접근 이름/설명으로 확인할 수 있습니다. [첫 회귀 로그](checks/first-regression.log).

### 재현

- `npm test`, `npm run build`, `npm run test:production`.
- `PLAYWRIGHT_GPU=1 npx playwright test tests/browser/{point-selection,point-display,site,panel-keyboard,continuity,comparison-clear,anatomy,marker-picking,dissection-input-scope}.spec.ts`.
- `PLAYWRIGHT_GPU=1 node scripts/check-readability.mjs`, `PLAYWRIGHT_GPU=1 npm run test:visual`, `PLAYWRIGHT_GPU=1 npm run audit:overlays`. 별도 서버는 `SMOKE_ORIGIN`으로 지정합니다. 이번 실행은 임시 Vite/Playwright 설정으로5176/API3003 포트를 사용했습니다.
- 최종 검사 렌더러는 Chromium ANGLE Metal이며 프로덕션 스모크는 SwiftShader입니다.
- Node는 이전 작업에서 사용한 공식 v24.14.0을 작업 캐시에서 참조하고, 독립 포트5176/API3003에서 검사합니다. 원본 검사 캐시는 읽기 링크로만 참조합니다.
- 실기기 Safari·VoiceOver는 검증하지 않았습니다. 공개 배포·push는 이번 요청에 포함하지 않았습니다.

### 커밋 전 재확인 — 2026-11-04

- 위 `verification.json`의 소스 8개 SHA-256이 현재 파일과 모두 일치합니다.
- `npm test`를 다시 실행해 505/505 통과, 실패·건너뜀0을 확인했습니다.
- 기본 PATH의 Node에서는 네이티브 바인딩의 macOS 서명 제약으로 빌드가 실패했습니다. 기존 검증에서 사용한 `.cache/node-v24.14.0-darwin-arm64/bin`을 PATH 앞에 두고 `npm run build`를 다시 실행해 통과했습니다. 기존 큰 청크 경고는 유지됩니다.
- 기존 데스크톱 미선택·모바일 선택 스크린샷을 다시 검토했습니다. 브라우저·시각 자동 검사는 이번에 재실행하지 않았으며 위 결과는 2026-10-28 기록입니다.
