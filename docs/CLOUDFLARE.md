# Cloudflare 외부 접속

연결일: 2026-09-08 · 최신 모델·UI 배포 및 공개 경로 검증: 2026-09-14

현재 주소: https://veterans-curtis-inquiries-configurations.trycloudflare.com

Cloudflare Quick Tunnel을 통해 배포 빌드를 서비스합니다. 개발 서버와 분리한 Node 프로세스가 `127.0.0.1:3002`에서 정적 웹과 `/api`를 함께 제공합니다. 다른 프로젝트의 기존 터널은 변경하지 않았습니다.

## 현재 실행 정보

- 원본 서버: `127.0.0.1:3002`, `NODE_ENV=production`
- 서버 PID: `.cache/cloudflare/server.pid`
- 터널 PID: `.cache/cloudflare/tunnel.pid`
- 로그: `.cache/cloudflare/server.log`, `.cache/cloudflare/tunnel.log`
- 현재 주소: `.cache/cloudflare/url.txt`

서버와 터널은 터미널 세션에서 분리해 실행했습니다. 자동 부팅/재시작 서비스는 등록하지 않았습니다. 현재 실행 호스트와 프로세스가 유지되어야 접속할 수 있으며, Quick Tunnel을 새로 만들면 주소도 바뀝니다. 고정 도메인이나 상시 운영 SLA를 설정한 배포는 아닙니다. [Cloudflare Quick Tunnel 문서](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)

## 재실행

먼저 PID 파일의 프로세스가 실제로 실행 중인지 확인하여 중복 실행을 피합니다. 다음 명령은 각각 별도 터미널에서 실행합니다.

```sh
NODE_ENV=production PORT=3002 HOST=127.0.0.1 npm start
```

```sh
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3002
```

새 터널 URL은 cloudflared 출력에서 확인합니다. 파일을 갱신한 경우 `npm run build`로 웹을 빌드하고, 서버 코드/위키 서버 데이터 변경은 Node 서버를 재시작해야 반영됩니다.

## 외부 경로 확인 결과

실제 HTTPS 주소로 Chromium에서 접속해 다음을 확인했습니다.

- 메인 문서 HTTP 200
- 체표·근육·골격·장기·혈관·신경의 6개 GLB 해부 모델 로드 완료
- 위키 45편 및 족삼리 위치·원혈/모혈·마사지 참고 질문 응답
- 새 분류 문서의 위키 탐색 링크
- 비교 장기 전체 묶음, 위키 왕복 상태 복원 및 위키 단독 진입의 3D 지연 로딩
- 데스크톱·모바일·작은 모바일·가로 화면 4종에서 떠 있는 도구와 모델 동시 표시
- 브라우저 실행 오류 0건

상세 증거: [구조 확장·이동·가독성 검증](anatomy-expansion/VERIFICATION.md). 공개 모델 매니페스트의 메쉬1,030개와 4가지 화면 크기의 캡처 및 글자 대비를 확인했습니다.

LLM 모델은 연결하지 않았으므로 질문은 출처 기반 위키 검색으로 동작합니다.
