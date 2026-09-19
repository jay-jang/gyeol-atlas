# 여성 참조 미수록 구조 — 2026-09-20 확인

현재 사용 중인 고정 Human-Atlas/HRA 원본의 concept·mesh 목록에는 위가 없고, 근육·말초신경도 전신 전체를 수록하지 않습니다. 기존 남성 장기를 여성 체표 안에 옮기거나 비장의 ‘gastric surface’를 위로 바꾸는 것은 보완으로 인정하지 않습니다.

확인한 자료:

- [Human-Atlas 원본 설명](https://github.com/slorksmo/Human-Atlas): 여성 원본의 근육은 눈·무릎 중심이며, 별도 여성 기증자의 하체 근육을 보완합니다. 현재 보관한 manifest와 출처는 `data/catalog/female-atlas-source.json`, `public/models/female/ATTRIBUTION.md`입니다.
- [NLM Visible Human Project](https://www.nlm.nih.gov/research/visible/visible_human.html): 여성의 CT·MRI·절단면 사진을 공개하지만 이는 즉시 사용할 수 있는 기관별 GLB 패키지가 아닙니다. 공식 설명의 여성 영상 자료는 약40GB·절단면5189장입니다. 이를 여성 위·상체 근육 등의 검증된 표면 모형으로 만드는 데에는 기관 분할과 해부 검수가 필요합니다.

이 확인은 ‘어디에도 공개 여성 모형이 없다’는 결론이 아닙니다. 현재 바로 통합할 수 있는, 성별·좌표·재배포 조건이 확인된 전체 여성 기관 패키지를 확보하지 못했다는 뜻입니다.

추가 원본을 받으면 확인할 조건은 재배포 라이선스, 여성 자료임을 입증하는 출처, 개별 구조명·구성 관계, 길이 단위·좌표축·자세, 여성 체표와 대조할 공통 기준 구조입니다. 단순히 모델 개수를 늘리거나 이름을 여성으로 바꾸어 전체 기관 수록으로 표시하지 않습니다. 전체 수록 요구는 여전히 미완료입니다.
