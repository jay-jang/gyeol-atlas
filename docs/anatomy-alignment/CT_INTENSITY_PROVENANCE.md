# 여성 CT 영상 값의 출처 확인 — 2026-09-28

**현재 BoneHub CT를 HU로 변환하거나 새 조직 분할에 사용하지 않았습니다.** 원래 NLM 촬영 헤더에서 보정값을 확인했지만, Denver 정렬 영상과 BoneHub 변환본까지 그 값이 보존됐는지는 아직 확인하지 못했습니다. 공개 모형의 위치 교정 완료가 아닙니다.

## 확인한 자료와 단절된 연결

1. [NLM 여성 촬영 헤더 목록](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Female-Images/radiological/normalCTHeaders/index.html)에서 아래 세 파일을 실제 내려받아 판독했습니다. 모두 저장 화소에 더하는 Hounsfield 보정값이 −1024입니다. 세 헤더 검사이며 전체 촬영 시리즈 검사로 확대하지 않습니다.
2. [Denver 공식 배포 설명](https://digitalcommons.du.edu/visiblehuman/1/)은 CT의 정렬·크기 조정과 cryosection에 대한 위치 보정을 명시합니다. 웹 설명만으로 영상 값 보존 여부는 확인되지 않습니다.
3. [BoneHub 고정 버전 설명](https://huggingface.co/datasets/BoneHub/visible-human-3d-models/blob/ac8de2b38f5ae1a0996053ca0639dd6ae43358f1/README.md)은 Denver의 Aligned CT DICOM을 3D Slicer에서 NIfTI로 변환했다고 밝힙니다. 별도의 강도 변환 공식은 확인하지 못했습니다.
4. 확보한 BoneHub 파일은 [기존 독립 판독](bonehub-female-ct-readback.json)에서 unsigned16bit, slope 1/intercept 0이고, [전체 저장값 검사](bonehub-female-ct-grid.json)는 0–4050입니다. 이 헤더만으로 실제 HU 보정이 이미 적용됐는지 또는 누락됐는지를 확정할 수 없습니다.

원래 NLM 격자와 현재 673×670×1727 격자는 다릅니다. 원래 헤더의 보정값을 현재 파일에 곧바로 적용하거나, 히스토그램 모양만으로 HU라고 부르지 않습니다. NLM 원본을 별도로 사용하는 경로도 현재 Denver/BoneHub 좌표와의 직접 대응을 대신하지 못합니다.

## 세 원본 헤더의 실제 판독

| 파일 | 화소 크기 X/Y(mm) | 행렬 X/Y | 슬라이스 간격(mm) | HU 보정값 |
| --- | ---: | --- | ---: | ---: |
| [c_vf1001.txt](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Female-Images/radiological/normalCTHeaders/c_vf1001.txt) |0.488281|512×512|1|−1024|
| [c_vf1800.txt](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Female-Images/radiological/normalCTHeaders/c_vf1800.txt) |0.9375|512×512|1|−1024|
| [c_vf2734.txt](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Female-Images/radiological/normalCTHeaders/c_vf2734.txt) |0.722656|512×512|1|−1024|

바이트 수와 SHA-256:

```text
c_vf1001.txt 16476 e1938a110fae1ec1d36ef404b2afc6fea44429372d92581fc858ee1128d5fe6a
c_vf1800.txt 16485 13c6d545a606f6a3658e9027c391f5302e892c74beb4267ce1313b2dfbce99b3
c_vf2734.txt 16493 32483ce6f8576586714d9ad3b69c1658661e33cc950cde96018de9a1689b1602
```

원본에는 NUL 바이트가 있어 최초 일반 텍스트 검색은 값을 출력하지 않았습니다. 이후 binary-as-text 검색과 Node의 Latin-1 판독으로 확인했습니다. 전체 개인/촬영 식별 필드는 문서에 복사하지 않았습니다.

## 접근 제한과 다음 검사

Downloads의 `MetaData.zip`, `Final 3D STL Models-stl.zip`, `Original 3D STL Models-stl.zip`을 확인했습니다. Metadata의 목록·README는 형상 부피/겹침 비교 자료이며, 그 안에서 CT DICOM이나 영상 값 변환 정보를 확인하지 못했습니다. 별도 Aligned CT DICOM 파일은 해당 Downloads 검색에서 발견되지 않았습니다.

2026-09-28 06:02:56 KST에 공식 `filename=1&article=1001&context=visiblehuman&type=additional` 주소를 범위 요청했으나 HTTP 403, `cf-mitigated: challenge`, HTML 5,818바이트를 받았습니다. ZIP으로 저장하거나 읽지 않았고 접근 제한을 우회하지 않았습니다. 사용자에게 같은 공식 페이지의 **Aligned CT DICOM(약 302MB)** 다운로드를 요청했습니다.

파일 확보 후에는 먼저 압축 목록·실제 영상 헤더의 단위/보정값/좌표/슬라이스 순서를 확인하고, 현재 NIfTI와 영상 값·공간 대응을 대조해야 합니다. DICOM이라는 형식 자체가 올바른 HU나 조직 경계를 보증하지 않습니다. 그 검사가 불충분하면 추가 보정 근거 없이 자동 분할을 진행하지 않습니다.

이번 변경은 출처 조사 기록뿐입니다. 앱 좌표·박리·선택·수록 범위를 바꾸지 않았고, 코드/브라우저/모바일/agy 검사를 새로 실행했다고 주장하지 않습니다. 전체 성별 정합·기관/신경 주행·실제 근육 층서 목표는 미완료입니다.
