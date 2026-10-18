**차단 유지**

- **G-16:** [atlas.css:557](/Users/nuinuri/workspace/anatomy/src/atlas.css:557)의 4열 규칙이 뒤의 7열 규칙(:667)에 덮입니다. `overlays/small-mobile-depth.png`도 여전히 7열입니다. **4열 규칙을 기본 모바일 규칙 뒤로 옮기고 390px에도 적용해, 실제 누름 영역 44×44px와 팝오버 높이 제한을 검증하세요.**
- **G-01·G-11:** [atlas.css:554](/Users/nuinuri/workspace/anatomy/src/atlas.css:554)의 고정 행동 줄이 내용을 가립니다. `after/landscape-05-structure-selected.png`에서는 구조명, `landscape-09-comparison.png`에서는 비교 한계 문구가 가려집니다. **짧은 가로 화면에서는 행동 줄 고정을 해제하고 자식 축소를 막아 카드 전체를 스크롤하게 하세요. 검사에도 실제 가림 여부를 추가하세요.**

비차단: 검색 75개 표시, 펼친 필터 스크롤, 근사 링크 표시, 발표 종료 초점 복귀 수정은 확인했습니다.