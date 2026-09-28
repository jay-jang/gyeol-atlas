# NLM 여성 머리 MRI 원본 확보와 좌표 한계 — 2026-09-28

## 확보한 원본

[미국 국립의학도서관(NLM) Visible Human Female 공개 목록](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Female-Images/PNG_format/radiological/mri/)에서 `BRAIN` T1 축상 PNG 33장과 [해당 GE 텍스트 헤더](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Female-Images/radiological/mriHeaders/) 33개를 확보했습니다. 앱 공개 자산이 아닌 `.cache/nlm-vhf-head-mri/`에 보관합니다. [파일별 SHA-256·촬영 메타데이터](nlm-female-head-mri.json)는 `node scripts/audit-nlm-female-head-mri.mjs`로 공식 두 목록을 다시 읽고, 목록의 파일 크기와 로컬 파일 길이를 대조해 재생성합니다. 66개 파일 총 2,738,438바이트입니다. 출처 표기: **Courtesy of the U.S. National Library of Medicine**. NLM은 자료 사용 시 출처 표시와 비보증·최신성 조건을 [다운로드 약관](https://www.nlm.nih.gov/databases/download/terms_and_conditions.html)에 둡니다. 이번에는 원본을 공개 앱·저장소에 배포하지 않았습니다.

헤더상 각 이미지는 256×256픽셀, 평면 내 간격 0.859375mm, 두께 4mm, 중심 간격 5mm이며, RAS 법선은 `(0,0,1)`입니다. 중심의 RAS 상하 축 부호 있는 좌표는 `+69.3mm`부터 `−90.7mm`까지 5mm씩 변합니다. 헤더의 `Image location`은 이미 부호가 있으므로 `I`를 한 번 더 음수로 바꾸지 않았습니다. 마지막 헤더의 방향 레이블은 `Iö`로 기록돼 있어 첫 글자 `I`만 해석하고 원문도 보고서에 남겼습니다. 파일 해시는 **로컬 확보본의 식별자**이며 NLM이 별도 게시한 공식 해시와 대조한 값은 아닙니다. 목록 크기·PNG 시그니처/IHDR·헤더의 계열/간격은 검사했지만 각 PNG 픽셀을 의학적으로 판독하거나 전수 CRC 검증하지 않았습니다.

`mvf10841.png`과 `mvf11241.png`의 원본 단면을 직접 열어 머리 영상임을 시각적으로 확인했습니다. 이 두 단면 확인만으로 33장의 기하 정확성, 뇌 분할, 두개골 안팎, 시신경·척수 연결을 검증했다고 간주하지 않습니다.

## 현재 전신에 합치지 않은 이유

이 자료는 **같은 Visible Human Female 사업의 원본 MRI 영상**이지, 기관별 라벨이 있는 3D 뇌·두개골 표면이 아닙니다. 영상의 스캐너 RAS(mm)와 [BoneHub/Denver CT 격자](BONEHUB_HEAD_CT.md), [HRA 여성 전신](BRAIN_PROVENANCE_SPLIT.md)의 좌표 연결은 아직 검증되지 않았습니다. 같은 기증자 자료라는 출처 관계만으로 서로 다른 촬영 자세·전처리·원점·축·변형이 동일하다고 가정할 수 없습니다. 또한 현재 배포 뇌는 Allen 참조 자료와 Visible Human 시신경교차가 섞여 있어 이 MRI를 그 뇌의 직접적인 정답 위치로 사용하지 않습니다.

따라서 기존 여성 두개골과 뇌의 충돌, 팔·손뼈 이탈을 이 원본 획득으로 해결했다고 표시하지 않습니다. 뇌/두개골/시신경교차/척수의 동일 신체 공통 기준점 또는 영상 간 등록을 따로 검증하고, 뇌 분할과 표면 정확도를 확인한 뒤에만 후보 변환을 고려할 수 있습니다. 그 전에는 앱 모형·좌표·가시 상태·출처 표기를 바꾸지 않습니다.
