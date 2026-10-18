**1. 판정: 조건부 승인**

**2. 합의 위반·결함**

| G | 확인된 근거·사용자 영향 | 수정 제안 |
|---|---|---|
| **G-01·G-11** | [atlas.css:603](/Users/nuinuri/workspace/anatomy/src/atlas.css:603), [AtlasPage.tsx:718](/Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx:718): 모바일 비교 중 검색을 열면 비교 카드가 숨겨지지만 검색에는 축약 고지가 없습니다. 깊이·경맥·시점 메뉴에서도 같은 누락이 생깁니다. | 비교 카드를 숨기는 모든 상태에서 비교 대상·한계 문구·해당 여성 출처를 유지하고, 비중첩·45% 제한을 함께 검사하세요. |
| **G-06** | [AtlasPage.tsx:556](/Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx:556): ‘위’ 결과는 **75개**지만 ‘모두 보기’도 **40개**로 잘립니다. `after/desktop-04-search-query.png`에서도 개수가 불일치합니다. | 경혈의 `slice(0, 40)`을 제거하고 전체 결과에서 정확 일치를 분리하세요. 펼친 뒤 75개가 표시되는 UI 검사를 추가하세요. |
| **G-07** | [atlas.css:197](/Users/nuinuri/workspace/anatomy/src/atlas.css:197): 목록 패널은 `overflow:hidden`, 필터는 축소되지 않습니다. 세로 모바일에서 필터를 펼치면 하단 필터·결과가 잘리고 터치 스크롤로 도달할 수 없습니다. | 필터를 펼친 상태에는 패널 전체 스크롤을 허용하세요. 가로 화면에 적용한 예외와 같은 방식으로 처리하고 360·390에서 마지막 조작까지 확인하세요. |
| **G-16** | [atlas.css:149](/Users/nuinuri/workspace/anatomy/src/atlas.css:149), [atlas.css:299](/Users/nuinuri/workspace/anatomy/src/atlas.css:299): 터치에서도 성별 버튼 높이는 38px, 넓은 화면 계통 눈 버튼은 26×26px입니다. 모바일 박리 띠도 고정 7열이라 폭이 44px에 못 미칩니다. | 변경한 조작의 실제 누름 영역을 양축 44px 이상으로 확보하고, 아틀라스의 터치 크기도 검사하세요. |
| **G-03·G-11** | `after/mobile-10-female.png`: 상태 줄이 ‘학…’으로 끝나 **학습용 근사 링크가 잘립니다**. [atlas.css:596](/Users/nuinuri/workspace/anatomy/src/atlas.css:596)이 출처와 링크 전체를 말줄임합니다. | 근사 링크는 축약 대상에서 제외하고 원본명·선택 대상 표시의 폭을 조정하세요. |
| **G-15** | [AtlasPage.tsx:335](/Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx:335): 모바일 발표 진입 버튼은 설정 패널과 함께 제거됩니다. 종료·Escape는 그 제거된 버튼에 초점을 돌리려 합니다. | 종료 시 설정 패널을 다시 열어 진입 버튼으로 초점을 복원하고 두 종료 경로를 검사하세요. |

**3. ‘AI스러운 UI’ 잔존 여부**

`after/desktop-11-wiki-home.png`, `desktop-13-sources.png`에서 슬로건·장식 통계·Sparkles·번호 카드가 제거됐습니다. 합의한 도구형 화면으로 정리되었습니다.

**4. 비차단 의견**

- 작은 모바일·가로 상세는 전체 스크롤로 읽을 수 있지만, 첫 화면에는 위치가 보이지 않습니다(`small-mobile-02`, `landscape-02`).
- 관련 순수 테스트 **51개 통과**를 직접 확인했습니다. 브라우저 로그는 최초 실패와 재실행 통과를 최종 검증 기록에 연결해 주세요.