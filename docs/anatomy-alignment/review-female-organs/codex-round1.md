**판정: approve-with-changes.** 첨부 화면에서 생식기관·젖샘 상세의 가림 해소를 확인했습니다. 허용된 Node 테스트는 **25/25 통과**했습니다. 명백한 출처 guard 우회나 비교 묶음 회귀는 찾지 못했습니다.

1. **minor — 저장 복원 후 선택 유지 오류** — [view-state.ts:605](/Users/nuinuri/workspace/anatomy/src/view-state.ts:605)  
   과거 젖샘 단독 선택을 `layers: ["skin","organ"]`으로 복원합니다. 실제 소속은 organ뿐이므로 이후 ‘장기만 보기’에서 선택이 해제됩니다(재현 확인). 선택 ID의 현재 카탈로그로 `selection.layers`를 다시 계산하세요.

2. **minor — 상세 전환 시 키보드 초점 소실** — [AtlasPage.tsx:576](/Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx:576)  
   하위 보기 버튼을 실행하면 해당 버튼이 목록에서 제거되지만 초점을 옮기지 않습니다. 전환 후 카드 제목이나 대응하는 새 버튼으로 초점을 보내세요.

3. **major — 모바일 검증이 실제 터치 조건을 확인하지 않음** — [female-organs.spec.ts:100](/Users/nuinuri/workspace/anatomy/tests/browser/female-organs.spec.ts:100)  
   viewport만 줄여 `pointer: coarse`의 44px 버튼·추가 줄바꿈을 검사하지 않습니다. 첨부 모바일 화면도 동작 버튼이 약 36px입니다. 터치 컨텍스트에서 전환·복귀·고지 접근·겹침을 검사하고 화면을 확인해야 출시 완료로 판단할 수 있습니다.

4. **minor — ‘약 79%’ 안내에 실행 불가능한 상태가 있음** — [AtlasPage.tsx:1120](/Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx:1120)  
   장기만 남긴 박리는 76%에서 멈추고, ‘장기만 보기’에는 장이 남아 자궁을 가립니다. 안내에 이 조건을 명시하고 생식기관 상세로 바로 연결하세요. 옮긴 골반 혈관에 의한 난소 가림도 해결 범위에서 제외해야 합니다.

5. **minor — 해부학적 설명이 표시 규칙보다 강함** — [dissection.ts:64](/Users/nuinuri/workspace/anatomy/src/dissection.ts:64), [reproductive-groups.json:8](/Users/nuinuri/workspace/anatomy/data/reproductive-groups.json:8)  
   Gray의 위치 관계를 전체 장기의 검증된 해부 순서로 확대하지 마세요. 세 구간은 **관찰을 위한 편집 순서**로 명시하고, 공간인 방광자궁오목을 ‘복막 주름’과 구별하세요. 카드의 ‘회음 근육은 두 원본 모두에 없음’도 과도합니다. 실제 옮긴 외항문조임근 `FMA21930`이 있으므로 ‘미수록 여성 외부생식기 근육’으로 좁히세요.

6. **minor — 젖샘관팽대의 모형 한계 추가** — [anatomy.ts:115](/Users/nuinuri/workspace/anatomy/src/anatomy.ts:115)  
   젖샘을 장기와 함께 표시하는 결정과 한국어 편집명은 타당합니다. 다만 팽대는 HRA의 참조 표현임을 명시하세요. 수유 여성 21명의 초음파 연구에서는 전형적인 팽대가 관찰되지 않았습니다. [Ramsay 등, 2005](https://pmc.ncbi.nlm.nih.gov/articles/PMC1571528/)

파일 수정·서버 실행·브라우저 테스트는 수행하지 않았습니다.