# 작업 상태 — 2026-09-16

사용자 확정 범위: 정규 361 + 경외기혈 48 = 409개. 새 공개 GitHub 저장소 이름은 `jay-jang/gyeol-atlas`. GitHub push와 Pages 배포 승인됨. 기존 Cloudflare 터널 유지.

구현: 409개 데이터, 834개 복수·양측 표식, 11개 부위 필터, 전통적 활용과 음양오행·60오수혈, 위키419편. 신체 내부 위치는 부위 참조이고 새 경혈의 FMA 연결은 미검수. 공통 view-state 경로 사용. Pages는 동일 검색기를 브라우저에서 실행하며 `/gyeol-atlas/` 경로로 빌드.

단위21개 및 빌드 통과. 초기 브라우저2실패는 오래된 명칭과 잘못된 링크 선택자로 수정. 전체11브라우저 재검사 실행 중 (`.cache/verification/full-e2e.log`). 정적 Pages·Cloudflare HTTPS·가독성 검사와 실제 스크린샷 검토 후 최종 검증 기록 및 GitHub 배포가 남음.

원본 연구 다운로드는 `.cache`에만 존재하고 Git에 포함하지 않음. 정규 빌드는 체크인된 data만 사용. 기존36 저술 입력은 data/acupoint-authoring에 보존.
