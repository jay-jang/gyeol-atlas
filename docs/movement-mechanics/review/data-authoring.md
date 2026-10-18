# 동작 데이터 작성·검증 보고 (2026-10-18)

> 보관 안내: 이 문서는 에이전트 최종 보고의 원문입니다. 본문의 `/private/tmp/…/scratchpad/…` 경로(작업 사본, 백업, 검사 스크립트)는 세션 임시 폴더라 보관하지 않았습니다. 확정 결과는 `data/movements/<slug>.json`과 `data/movement-sources.json`입니다.
> 이후 수정: 서 있기의 t=0.95 키프레임과 그로 인한 0.95–1.0 이름표 지연, 걷기 엉덩관절 기준계·62%·75% 자세, 팔 들어올리기 기준점, 장딴지근 갈래는 구현 후 검토에서 다시 고쳤습니다([data-fix.md](data-fix.md), [합의안 ‘구현 중 개정’](../CONSENSUS.md)).

동작마다 작성 에이전트가 원문을 열어 `data/movements/<slug>.json`을 쓰고, 별도 검증 에이전트가 모든 수치·귀속·수축 판정을 반박형으로 대조해 파일을 직접 고쳤습니다. 아래는 각 에이전트의 최종 보고 원문입니다.

## author:sit-to-stand

I wrote both files and they pass all the checks. Only the seat-off keyframe uses angles taken straight from a source table. The other four keyframe poses are my own estimates, and each one's note says how I set it.

- `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/sit-to-stand.json`
- `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/sit-to-stand.sources.json` (12 sources)

**Checks run:**
- The data type-checks against `Movement` and `Source[]`.
- Every muscle row has all 4 phases.
- Every source key resolves, and all 36 structure ids are in the catalogues, listed right and left one by one.
- `HRAF0396` and `HRAF0394` are in the female catalogue.
- The `line` keys exist, no phase range prints a %, and there are no forbidden phrases.
- The seated hip centre sits 0.085 m above the 0.46 m seat in the figure engine.

**Angle source:** Kinoshita 2015 (PMC full text) is the single angle source, because it is the only one of the three young-adult papers with a joint-angle table.
- Seat-off: hip 93.3°, knee 82.7°, ankle 9.0°.
- Trunk at seat-off: about 34°, read by eye from its Fig. 2 (the table has no trunk value).
- Centre-of-mass overlay at seat-off: 18.2±30.6 mm in front of the ankle, confirmed.
- Ground-force overlay at seat-off: −8°, "large". The −8° is my calculation from the table's backward and vertical force components.

Yoshioka 2014 has only the starting ankle angle (17.3°) and peak trunk lean (34.6°). Li 2021 reports no joint angles. Values from both, from Yang 2023, and from Hayamizu 2025 (as a footnote) go in the `joints` table but not in the drawing.

**Estimated keyframes:**
- **Start:** knee and ankle are set equal to the seat-off values, because Li 2021 and Yang 2023 say the buttocks and shank barely move before seat-off. Hip is 74°, so the pelvis is upright, and trunk is 0°.
- **Max ankle dorsiflexion (t=0.40):** ankle is seat-off plus 3°. Kinoshita's supplementary Fig. S1 shows only a small rise, but that is one subject. Knee is 73°, chosen so the drawn hip rises about 7.6 cm, close to Li 2021's 74 mm centre-of-mass rise in that phase. Pelvis tilt is kept the same and trunk stays at 34°.
- **End of hip extension and end:** all angles are 0°.

**Timing:** Li 2021 at 18/40/91%T; `timingNote` contains "Li 2021 젊은 성인 기준 재생 시간". Duration is 1.6 s, confirmed by both Yoshioka 2014 (1.6±0.2 s at 40 cm) and Li 2021 (1.60 s).

**Muscle rows:** contraction types are mostly "active" from EMG timing (Goulart 1999 abstract, Tebbache 2021, McDonald 2025).
- Rows marked concentric: vasti in phases II–III, soleus III, lumbar erector spinae III, and gluteus maximus II–III. All are flagged as inferences.
- Gluteus maximus has no EMG in the sources I opened, so its row rests on the net hip moment only.
- Iliopsoas is left out, as the consensus rules require.
- Only rectus femoris has a `female` entry.

**Open questions:**
1. **Start knee:** Kinoshita's set-up says knee 90°, but the drawing starts at 82.7°. Using 90° drops the hip to 0.036 m above the seat in this figure, probably because Kinoshita's angle definitions don't match the figure's segment lengths. Is the 7° gap acceptable?
2. **Centre-of-mass dot:** at seat-off the drawn trunk and hip sit well behind the ankle, but the cited dot is 18 mm in front of it. The page will look visually inconsistent there; this is in `limitations`.
3. **Max-dorsiflexion pose:** I found no young-adult angle table at max dorsiflexion. Yang 2023 gives a peak shank tilt of 22.2°, but it was measured differently and would clash with Kinoshita's 9° at seat-off, so the 12° in the drawing is my estimate.
4. **Li's 91%T boundary** is defined by when the shank stops moving backward, not by when hip extension ends as in Schenkman. The difference is noted in `timingNote`.
5. **Unconfirmed sources:** Schenkman 1990, Goulart 1999, Crenna & Frigo 1991 and Doorenbosch 1994 were checked as abstracts only. Lombard & Abbott 1907 and Roebroeck 1994 could not be opened and are not cited.
6. **Empty cells:** "no data" cells have an empty evidence list. If the future test requires evidence on every cell, these will need a value.

## author:arm-elevation

I wrote both files. They pass a check script against the structure catalogues, the figure engine and the `Movement` type, but no screenshots were taken. The check found every id in the catalogues, a cell for every phase in every muscle row, every source key listed, and no forbidden words. Sampling the drawing from t 0 to 1 gave no NaN, and `tsc` accepts the JSON as `Movement` / `Source[]`.

- `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/arm-elevation.json`
- `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/arm-elevation.sources.json` (17 sources: Ludewig 2009, McClure 2001, Braman 2009 and the two Neumann/Camargo 2019 reviews read in full text; the other 12 from abstracts only)

**Where each keyframe comes from**

| Frame | elevation / upwardRotation / clavicleElevation | Source |
|---|---|---|
| Rest (t 0) | 0 / 0 / 0 | The measured resting arm is about 11° (McClure); drawn at 0° as an editorial choice |
| 30, 60, 90, 120 (t 0.122–0.49) | upward rotation 5 / 16 / 24 / 34; clavicle 1 / 4 / 5 / 6 | Ludewig 2009: read from Figs 5A and 5C (scapular-plane raising curve), measured from the 15° value, about ±1–2° |
| Max (t 0.6) | 147 / 50 / 10 | McClure 2001 table (11–147°) |
| Lowering 120, 90, 60, 30 → rest (t 0.673–1.0) | upward rotation 41 / 30 / 20 / 10 / 0 | Inferred from the Braman 2009 Table I ratios (2.73 / 2.31 = 1.18); method in the notes. Clavicle uses the raising values, because Ludewig found no significant raising–lowering difference |

At 120° the two studies nearly agree (McClure reads about 32°, Ludewig 34°), so joining them at that point is not a large jump. There are 9 muscle rows, right side only. No female muscle or ligament ids are listed, because carried `FT_` copies exist for all of them.

**Open questions**
1. **The consensus text needs a fix.** Ludewig's "11°→50° (+39°)" upward rotation does not run to 120°. Reading the figures, it runs from 15° to the mean peak elevation, about 131–138°. The same applies to the clavicle values (+16°, +6°, +31°) and to glenohumeral 85°. CONSENSUS §3.5 currently says "120°까지 +39°".
2. **Choice of rest baseline.** Ludewig's standing-rest values are about 5° below the first moving value at 15° (upward rotation 5.4° vs about 10°, clavicle 5.9° vs about 10.5°). I used the 15° value as zero. Using the standing rest would add about 5° to the 30–120° frames.
3. **The lowering curve may not be the best option.** The Braman-derived values sit about 4–5° above McClure's measured lowering curve at 60° and below. Ludewig found no significant difference between raising and lowering. McClure's measured curve (about 39 / 28 / 16 / 5°) is an alternative, and it comes from the same study as the max frame. I followed the task and used Braman.
4. **Ludewig's per-angle supplement could not be opened** (the download was blocked), so the 30–120° values are read off the figures.
5. **Weak muscle evidence.** Deltoid and supraspinatus lowering cells are inference only, with no EMG. Teres minor has no EMG data, so all its cells are "nodata". Reed 2013 and Wickham 2014 disagree on when subscapularis switches on, and both claims are recorded in the cells.
6. **Female bone ids need a decision.** The bones row lists `BM0113`, `BM0119` and `BM0115` as female matches. These are whole bones, but they are male-derived bones borrowed into the female model, not female shapes. Someone should decide whether they count as a valid female match.
7. **The timing is editorial.** The 7 s length and the 0.6 / 0.4 raise–lower split make lowering about 53°/s, slightly above McClure's 30–50°/s.

## author:standing

Both files are written. The figure engine confirms the right foot stays flat in every frame, and the drawn gravity line never falls behind the knee or the ankle.

Files:
- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/standing.json
- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/standing.sources.json (17 sources, each one opened)
- Generator script: /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/stand_build/build.py

**Where the poses come from (angles are my own derivations, marked "inference")**
- **Mean frame:** ankle 4°, knee −1°, hip −5°, centre-of-mass line 0.058 m in front of the ankle.
  - The distances are Di Giulio 2019's values about 7.6 s after stopping: 58 mm in front of the ankle, 32 mm in front of the knee, 5 mm behind the hip.
  - Fitting those to the engine's shank (0.37 m) and thigh (0.39 m) gives the ankle and knee angles.
  - The hip −5° is editorial: it keeps the pelvis and trunk vertical. No opened source reports a hip or trunk angle, so trunk is left out.
  - Ankle 4° sits inside Loram & Lakie 2002's "mean ankle angles 1.5–4°", though that paper doesn't define the angle clearly.
- **Sway frames:** I chose ×8, not ×10. At ×10 the gravity line passed behind the knee during the backward transition, which would contradict the quadriceps being silent.
  - Real shift is 1 SD ≈ 4.5 mm (Gatev 1999), drawn as 36 mm.
  - Dividing by Loram & Lakie's mean centre-of-mass height above the ankle (0.92 m) gives ±2.24° at the ankle: forward 6.2° (com 0.094 m), backward 1.8° (com 0.022 m).
  - Knee and hip stay fixed, so the body swings as one rigid piece about the ankle.
- **Timeline:** mean 0–0.3, forward 0.3–0.7, backward 0.7–1.0, with the loop going mean → forward → mean → backward → mean.
  - The page jumps to `phase.start` when a state is picked, so each state's pose starts exactly at its phase start.
  - The labelled keyframes are at t = 0, 0.4 and 0.8; a mean frame at 0.95 stops the backward com value carrying into the return to mean.
  - Spans are marked editorial. `duration` is 5.5 s, inferred from Loram 2005 (about 1.1 s per one-way sway).

**Choices to review**
1. **Thigh, buttock and abdominal muscles in the sway states:** I took these from whole "standing at ease" recordings, which include natural sway. So quadriceps, hamstrings and glutes are "silent" in both sway states, with the results of deliberate, larger sways kept in notes.
   - Tibialis anterior is "active" in the backward state, because 4 of 9 people showed activity changes when the centre of mass neared the ankle (Di Giulio 2009). Reading that as "backward sway" is my interpretation of the paper's wording.
   - CONSENSUS §3.1 describes the quadriceps and tibialis anterior switching on only once the line goes behind the knee. That condition never happens in the drawing, which is why the quadriceps stay silent.
2. **Psoas major, mean state:** marked "active" from needle EMG (Nachemson 1966), with the surface-EMG null result (Joseph & Williams 1957) in the note. It will appear as a drawn muscle line.
3. **Wording change:** I dropped "작은" from the CONSENSUS line saying the knee and hip carry "small" moments. Di Giulio 2019 reports knee moments larger than the ankle's at the late time point and argues passive structures alone don't explain it; that caveat is recorded.
4. **Lateral gastrocnemius:** marked "silent", following Héroux 2014's needle recordings (the title says "Absence"). Gatev 1999's surface EMG disagrees; both are noted.
5. **No `female` fields:** the female catalogue only has rectus femoris (HRAF0394/0396), not the whole quadriceps group, and the separate VHF donor leg muscles don't count as matches. This is listed in the limitations.
6. **Notes not shown on the page:** `MovementPage.tsx` doesn't display a muscle cell's `note`, only its `role`. So I kept the key qualifiers in `role`.

**Problems found outside my files**
- The base-of-support band probably won't draw for any foot-flat pose. `MovementFigure.tsx` only counts a foot as touching the floor below y 0.006 m, but the updated engine puts the heel and toe at 0.01 m. I didn't change anything in the repo.
- The renderer picks hanging arms by checking `slug === "standing"`, so I added no `arms` field.
- **My mistake:** one Crossref lookup (checking DOIs) sent the user's email address in its User-Agent header. That shouldn't have happened; no other request included it.

## author:stand-to-sit

I wrote both stand-to-sit files and checked them with a copy of the repo's movement test rules: every check passes, no forbidden words appear, and the seated hip sits at 0.545 m. I did not run the repo test itself, because it reads all five files from `data/movements/`, which doesn't exist yet. Nothing inside `/Users/nuinuri/workspace/anatomy` was changed.

Files:
- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/stand-to-sit.json
- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/stand-to-sit.sources.json (15 sources: jeon2024, jeon2025, linlee2022, herzog2023, kinoshita2015, yoshioka2014, yoshioka2009, cunha2014 and chen2016 read in full text; jeon2021, kerr1997, mourey1998, dubost2005, ashford2000 and kralj1990 from abstracts only)

**How the poses were set**
- **Start (t=0):** standing at 0/0/0/0, the same as the sit-to-stand end pose. Jeon 2025 measures its angle changes from this starting stance.
- **Seated end (t=1):** `{ankle 9, knee 82.7, hip 74, trunk 0}`, copied from the sit-to-stand start pose, which appeared in the shared folder while I worked. The knee and ankle are Kinoshita 2015's values at the moment of leaving the seat (Table 1), used here as a seated pose; that is an inference. Hip 74 and trunk 0 are editorial. The hip centre drawn about 9 cm above the seat agrees with Yoshioka 2009 (0.492 m hip on a 0.40 m chair).
- **In-between frames (t = 0.10, 0.34, 0.46, 0.56, 0.63, 0.74):** editorial, each kept below Jeon 2025's reference-condition descent values. The profile:
  - trunk lean and the start of hip and ankle bending first;
  - the descent slows near the chair (Mourey 1998);
  - controlled descent ends just before the vertical floor force falls (Jeon 2024/2025);
  - a short fast drop to the seat;
  - the trunk straightens after sitting (Lin & Lee 2022; Kerr 1997).
- **Not used as poses:** Jeon 2025 (hip 89.9, knee 76.2, ankle 12.5, trunk 38.7) and Jeon 2024 (knee 73.4) appear only in `joints[]`, labelled as descent-phase angle changes.
- **Timing:** total 1.97 s (Kerr 1997). The four stages are editorial, no % appears on screen, and the timing note says the drawing slows near the chair. The keyframe times do not mirror sit-to-stand's.

**Muscle table:** six muscles, left and right ids listed separately.
- Vastus lateralis, tibialis anterior, gluteus maximus, biceps femoris long head, rectus femoris and gluteus medius.
- The stages after the controlled descent are mostly marked `nodata`, because none of the studies analysed muscle activity there.
- Only rectus femoris has a female mapping (`HRAF0396`/`HRAF0394`, the whole structure).
- The one passive row is the hip bone, covering weight moving onto the seat.

**Open questions**
1. **Seated pose:** the shared sit-to-stand start pose differs by about 7° from the 90° knee the chairs were set to (Jeon, Kinoshita). Yoshioka 2014 also measured 17.3° ankle bend in an actual seated start. Both pages carry this compromise; if sit-to-stand changes its start pose, the last frame here must change too.
2. **Jeon 2024's descent end is defined two ways:** "just before seat contact" in the Methods and "start of the floor-force drop" in the Discussion.
3. **Jeon 2024 and 2025 may share one group of participants:** both report the same 6 men and 6 women, with identical age and height tables, so I don't treat them as independent repeats.
4. **Erector spinae and medial gastrocnemius were left out:** Jeon recorded them but gave no separate results for the reference foot position.
5. **Muscle activity after sitting is unknown:** no source covers which muscles straighten the trunk once seated, so those cells stay `nodata`.
6. **Source ids need merging:** `kinoshita2015`, `yoshioka2014` and `yoshioka2009` also exist in `sit-to-stand.sources.json` with different `usedFor` text, so they must be combined when `data/movement-sources.json` is built.

## verify:arm-elevation

I checked both files against the sources and fixed them. JSON is valid, and `tsc` accepts the data against `Movement` and the sources against `Source[]`. A check modelled on `tests/movements.test.mjs` finds no unknown or unused source keys and no forbidden words. Phases cover 0–1 without gaps and keyframes increase. Every contraction call except "active" now carries `inference`. Every structure id is in the catalogues, and every muscle and ligament has an `FT_` copy.

**변경 (이전 → 이후, 출처)**

*`arm-elevation.json`*
1. **내리기 키프레임 위쪽돌림·빗장뼈 올림**: 41/30/20/10°, 6/5/4/1° → 39/28/16/5°, 9/6/3/1° (McClure 2001 그림 3B·3E 내리기 판독)
   - Braman 비율로 유도한 값은 60°·30°에서 두 뼈핀 연구 실측보다 4–5° 컸습니다. McClure 내리기 실측은 16°·5°이고, Ludewig 2009는 올리기·내리기 차이가 유의하지 않았습니다.
   - 이전 값은 Braman·McClure·Ludewig 세 연구를 한 자세에 섞은 것이었습니다. 이제 최대 거상과 내리기는 McClure 한 연구에서만 가져옵니다.
   - 판독값은 직접 숫자화해 확인했습니다. McClure 휴식 기준 내리기 위쪽돌림 39.2/27.5/15.7/5.4°, 올리기 120°는 32.8°입니다.
2. **시간축**: 7초, 올리기 0–0.6 → 6초, 올리기 0–0.5·내리기 0.5–1 (Ludewig 2009 과제 지시 "올리기·내리기 각 약 3초")
   - 이전 내리기 속도 약 53°/s는 McClure가 적은 30–50°/s를 넘었습니다.
   - 국면 경계: 0.122/0.49/0.6 → 0.102/0.408/0.5
   - 키프레임 t: 0.102, 0.204, 0.306, 0.408, 0.5, 0.592, 0.694, 0.796, 0.898
   - `duration`, `timingNote`, `conditions` 문장을 이에 맞췄습니다. 화면 문구에 내부 시간 비율(0.6 같은 값)은 남기지 않았습니다.
3. **조건 귀속**: "팔꿈치 폄·30–50°/s"를 두 연구 공통처럼 쓴 것 → McClure(팔꿈치 폄, 셋을 세며 올림, 30–50°/s)와 Ludewig(손끝을 판에 대어 평면 유지, 각 3초)로 나눔.
4. **아래쪽돌림 토크 주체**: "어깨세모근·가시위근" → "중간 어깨세모근·가시위근". Neumann & Camargo 2019 본문은 middle deltoid로 적습니다. 역학 문장, 어깨세모근 30–120° 칸의 역할·메모에 반영했습니다.
5. **등세모근 내림부분 30–120° 칸**: "어깨뼈를 직접 위쪽돌림하는 힘은 작다"의 근거로 Johnson 1994를 든 것 → 이 내용은 Camargo & Neumann 2019로, Johnson은 "어깨뼈를 직접 들어 올리지 못함"(초록)으로 고쳤습니다.
6. **가시아래근 120°–최대 칸**: 근거 `emg`만 → `emg`, `inference`. 가쪽돌림 역할은 근전도가 아니라 해부학적 작용과 관절 운동에서 추론한 것입니다.
7. **Alpert 2000 인용 칸들** (가시위근, 가시아래근, 작은원근): "작은원근 근전도 없음" → "초록은 회전근개를 묶어 보고해 근육별 결과·작은원근 측정 여부를 확인하지 못함".
8. **표본 수**: "McClure 8명, Braman 12명, Ludewig 12명" → Braman 2009는 Ludewig 2009와 같은 12명의 다른 과제임을 적음 (Braman 방법·참고문헌 16).
9. **오목위팔 85°**: "15°에서 최대 거상까지"로 단정 → "평균 초기값 0°에서; 그림 5D상 15°부터" (Ludewig 본문 문구 기준).
10. **내리기 국면 요약·역학·한계**: Braman 유도 설명 삭제. McClure 본문("대개 5° 이내, 최대 차이는 60–120° 위쪽돌림")을 넣고, Ludewig 문장은 "어깨가슴 운동에서"로 범위를 좁혔습니다. 두 연구를 이어서 생기는 왜곡도 한계에 적었습니다(60°에서 McClure 자체 차이 약 7°가 도식에서는 0°).

*`arm-elevation.sources.json`*
- `ludewig2009`: 표 1이 평균 ± 표준오차임, 올리기·내리기 유의차 범위(복장빗장 뒤당김 120°에서 1.2°), 과제 시간을 보충.
- `mcclure2001`: 내리기 키프레임 판독값 추가.
- `braman2009`: "키프레임 유도 근거" → "정성 근거, 같은 표본".
- `wickham2010`: "가장 높은 활동" → "가장 높은 %MVC를 보인 근육들에 속함" (초록 표현).
- `alpert2000`: 근육별 결과를 확인하지 못했음을 명시.
- `neumann2019`: "중간 어깨세모근"으로 수정.

**원문과 맞는다고 확인한 것** (변경 없음)
- **수치**:
  - Ludewig: 12명, 22–41세, 왼쪽 9명, 11→50°(+39°), 빗장뼈 +16/+6/+31°, 리듬 2.1/2.2/2.4.
  - McClure: 11–147°, 50°(SD 4.8), 뒤기울임 30°, 가쪽돌림 24°, 빗장뼈 올림 10°, R² 0.997, 1.7/2.0 및 1.9/2.3, 30–50°/s.
  - Braman 표 I: 2.31·2.73, 3.71, 1.11–7.89, 132.9 ± 9.9°.
- **그림 판독**: 작성자의 Ludewig 그림 5A·5C 판독은 직접 숫자화한 값과 ±1° 안에서 맞습니다. 위쪽돌림은 15° 기준 60°에서 15.7, 90°에서 24.4, 120°에서 33.8, 끝점 약 138°에서 41이고, 빗장뼈 올림은 1.1/3.9/5.1/6.5입니다.
- **초록 대조**: 나머지 12개 출처의 인용 수치와 수축 판정은 초록과 일치합니다.
- **자세 점검**: 이 동작은 뒤에서 본 도식이라 "앉은 엉덩이·발바닥" 점검은 해당하지 않습니다. 대신 `backPose`와 `interpolate`를 t 0–1에서 1001회 표본했습니다. NaN과 범위 이탈, 키프레임 사이 과도 진동이 없었고, 오른팔은 몸 가운데선을 넘지 않았으며 근육선 좌표도 모두 유한했습니다.

**확인하지 못한 것**
1. **Ludewig 2009 각도별 부록**: PMC 다운로드가 작업증명 화면으로 막혀 있어 우회하지 않았습니다. 30–120° 값은 512px 그림에서 읽은 것이고, 25–40° 표식은 가려져 있어 30° 값은 20°와 45° 사이를 보간했습니다.
2. **합의안 §3.5 수정 필요**: 그림 판독상 "+39°"는 120°까지가 아니라 최대 거상 평균점(약 131–138°)까지의 변화입니다. 120°까지는 세 평면 평균 약 +33°입니다. 저장소 문서라 고치지 않았습니다.
3. **초록만 본 출처**: Alpert 2000의 측정 근육 목록, Reed 2013의 어깨세모근 부위, Wickham 2014의 벌림 평면은 확인하지 못했습니다. Bagg 1986·1988, Johnson, Howell, Oki, Sharkey, Ebaugh 2005·2010도 초록만 봤습니다.
4. **어깨세모근·가시위근·가시아래근 내리기 칸**: 근전도 없이 추론만 있습니다. 작은원근은 전 구간 자료 없음입니다.
5. **여성 뼈 대응 결정 필요**: `BM0113`, `BM0119`, `BM0115`는 여성 카탈로그에 실제로 있고 뼈 전체라 T23 조건에는 맞습니다. 다만 여성 고유 형상이 아닌 남성 유래 보완 뼈이고, 다른 선택지는 없습니다. 이를 유효한 대응으로 칠지는 정책 결정입니다.
6. **화면 검토 안 함**: 스크린샷을 찍지 않아 화면 검토는 아직입니다.

수정한 파일:
- `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/arm-elevation.json`
- `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/arm-elevation.sources.json`

수정 전 원본:
- `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/verify-arm/arm-elevation.orig.json`
- `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/verify-arm/arm-elevation.sources.orig.json`

점검 스크립트: `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/verify-arm/check/check.mjs`

저장소(`/Users/nuinuri/workspace/anatomy`)는 수정하지 않았습니다.

## verify:sit-to-stand

I checked every number and attribution against the cited sources. The eight PMC papers were read in full text with their tables, and I also read Kinoshita's Fig. 2 and supplementary Fig. S1. Schenkman 1990, Goulart & Valls-Solé 1999, Crenna & Frigo 1991 and Doorenbosch 1994 are checked against their Europe PMC abstracts only. Both files now pass every check: JSON parsing, the `Movement`/`Source[]` type check, source keys, all four phases on every muscle row, the catalogue ids, the forbidden-phrase check, no % in `range`, and the pose check. Most numbers were correct; the fixes below are mainly attributions and overclaims. I did not edit anything inside `/Users/nuinuri/workspace/anatomy`.

## 수정한 것 (전 → 후, 근거)

**sit-to-stand.json**
1. **허리 척추세움근 3국면 수축**: `concentric`(근전도+추론) → `active`(근전도).
   - 출처들이 허리뼈 폄을 따로 재지 않았습니다. 몸통이 다시 서는 것은 엉덩관절 폄(골반 뒤기울임)일 수도 있어 단축성이라고 정할 근거가 없습니다(작성자 메모도 이를 인정).
   - 근거는 Yang 2023 3국면 서술, Tebbache·Goulart 근전도입니다.
2. **시작 키프레임 메모**: "Li·Yang에 따라 무릎·발목 고정"만 적혀 있었습니다 → Kinoshita S1의 1명 곡선이 이 단순화와 맞지 않는다는 점을 추가했습니다.
   - S1에서는 좌면 이탈 전 약 0.2초 동안 무릎이 약 87°에서 80°로, 발목이 약 15°에서 22°로 변합니다.
   - 시작 엉덩관절 74°는 S1 시작값(약 74°)과도 비슷하다는 점을 적었습니다. 같은 내용을 한계에도 넣었습니다.
3. **최대 발등굽힘 키프레임**: "S1 1명 약 1–2°" → "약 1°". +3°는 도식에서 보이게 하려는 편집 선택이며 S1 값보다 크다고 명시했습니다.
4. **큰볼기근 2국면**: "이후 엉덩관절이 펴집니다(Yoshioka 2014)"는 잘못된 귀속이었습니다. Yoshioka 2014는 관절각을 보고하지 않습니다.
   - → 엉덩관절 폄 근거를 Kinoshita S1과 McDonald 2025로 바꾸고, 출처에 두 논문을 추가했습니다.
   - 1국면 메모에 McDonald 서론의 Hanawa 2017 2차 인용(원문 미열람)을 적었습니다.
5. **Crenna & Frigo 1991**: "느린 속도에서는 순서가 다 나타나지 않습니다"를 일어서기에 일반화했습니다 → 속도 경계는 **걸음 시작 과제**에서 정의됐다고 고쳤습니다(초록 8항). 가자미근 메모와 mechanics 항목 둘 다 고쳤습니다.
6. **Doorenbosch 1994**: "설명되었습니다 / 분배에 관여합니다" → "설명될 수 있다고 보았습니다(초록)". 초록 표현은 "might explain"입니다. 넙다리곧은근 3국면, 뒤넙다리근 3국면, mechanics, 오해 항목에 적용했습니다.
7. **Kinoshita 고찰**: 사실처럼 쓴 "몸통을 기울이면 무릎 부담↓·엉덩관절 부담↑" → 낮은 손잡이 조건을 논한 저자 해석이며, 이 논문은 관절 모멘트를 보고하지 않았다고 명시했습니다.
8. **운동량 전달**: Schenkman 1990만 단정적으로 인용하던 것에 반대 해석을 추가했습니다(mechanics 1번, 오해 2번).
   - Tebbache 2021: 등받이를 눕혀 앞쪽 최대 속도가 커져도 위쪽 최대 속도는 변하지 않아, 앞쪽 운동량이 위쪽으로 그대로 넘어간다고 보기 어렵다는 해석입니다.
9. **Hayamizu 2025 표 마지막 시점**: "엉덩관절 폄 끝" → "끝 선 자세". 원문 표 3은 End posture(standing)입니다.
10. **엉덩허리근 오해 항목**: 근거가 없는데도 "틀린 설명"으로 단정했습니다 → "확인할 근거도 반박할 근거도 없음"으로 바꿨습니다(CONSENSUS §3.2와 맞춤).
11. **Tebbache % MVC 수치**: 출처는 등받이 5조건 평균인데 조건 없이 적혀 있었습니다 → "편한 속도·등받이 5조건 평균"을 표시하고, 2–4국면 평균이라는 단서를 붙였습니다.
12. **4국면 요약**: "흔들림이 줄어듭니다(Li)"는 Li 원문에 없습니다(Li는 "sways slightly"). → Li 2021과 Yang 2023 기준으로 고치고, 출처에 yang2023을 추가했습니다.
13. **2국면 요약**: "정강이가 조금 더 기울다" → Li 원문대로 "몸 전체가 발목을 축으로 돌고, 정강이 앞기울임은 국면 끝에 멈춤".
14. **conditions**: Kinoshita가 의자 높이를 보고하지 않았다는 점과, Tebbache는 등받이에 기대어 시작한 조건이라는 점을 추가했습니다.
15. **absent**: 무릎인대와 넙다리네갈래근 힘줄은 남성 모델에만 없습니다. 여성 HRA 아틀라스에는 있습니다(HRAF0909/0932, HRAF0395/0397). 이 점을 각 항목에 적었습니다.
16. **timingNote**: Yang 2023 자연 발 각도 조건의 좌면 이탈 약 20%를 추가했습니다.
    - "엉덩관절 폄 끝"은 Schenkman 초록에 없습니다. 그래서 Yang 2023과, Hayamizu 2025가 Schenkman 1990을 인용한 정의로 귀속을 바꿨습니다.
17. **limitations 추가 3줄**: Tebbache 조건 차이, McDonald 근전도 정규화 방식(MVC가 아니라 세트 내 최댓값), Lombard & Abbott 1907과 Roebroeck 1994 미열람.

**sit-to-stand.sources.json**
- `usedFor`를 원문에 맞게 보강했습니다(Kinoshita, Tebbache, Li, Yang, Crenna, Doorenbosch, McDonald, Hayamizu, Schenkman). Tebbache의 측정 근육은 12개이고 큰볼기근은 없습니다. 서지 정보(저자, 권호, DOI)는 모두 맞았습니다.

**맞는 것으로 확인한 값**
- Kinoshita 표 1: 93.3/82.7/9.0°, 18.2±30.6 mm, 0.84/6.1 N/kg에서 계산한 지면반력 −8°.
- 그림 2의 몸통 약 34–35°.
- Li 2021: 18/40/91/44%T, 51/109/74/40/169 mm, 32/56%T, 1.60초.
- Yoshioka 2014: 1.6±0.2초, 17.3°, 34.6° 등. Yoshioka 2009: 0.88/2.0초.
- Tebbache 켜짐 시점 9개, 738 ms, 55 mm, 561 mm/s.
- McDonald: 2.2초, 43±19세. Yang: 22.2°/35.9°.
- 구조 id 36개(좌우 각각)와 HRAF0394/0396.

**자세 점검**(작업 중 다시 확인한 최신 `src/movement-figure.ts`, 작업 도중 디스크에서 바뀌어 있었음): 앉은 엉덩관절 중심 0.545 m로 좌면 0.46 m보다 0.085 m 위입니다. 발은 전 구간 바닥(0.01 m)에 있고, 0–18% 구간에서 엉덩관절이 좌면 위에 있으며, 선 자세 엉덩관절은 0.83 m입니다.

## 남은 확인 불가 사항
- 그림 2 몸통 34°와 S1 곡선(1명) 값은 눈으로 읽은 근사입니다.
- **체중심 표시 불일치는 그대로입니다.** 이 도식의 좌면 이탈 자세는 몸통 무게중심이 발목보다 약 15 cm 뒤에 그려지는데, 인용한 체중심은 발목 앞 18 mm입니다. Kinoshita 평균 발목 9°(Plug-in-Gait)와 도식 분절 정의가 다르기 때문으로 보이며, 데이터만으로는 해결되지 않습니다.
- 시작 무릎 82.7°와 90°의 7° 차이는 그대로 두었습니다. 90°도 테스트 기준(엉덩관절 0.47 m 초과)은 통과하지만, 엉덩관절 중심이 좌면 위 3.6 cm밖에 되지 않습니다.
- Yoshioka 2014 그림 4에서 3국면 동안 엉덩·무릎 모멘트 부호를 확인하지 못했습니다. 큰볼기근 3국면 단축성은 추론으로만 남습니다.
- 지면반력이 한쪽 다리 값이라는 해석은 "좌우 다리 평균"이라는 서술에서 나온 추론입니다.
- 초록만 본 4편의 세부 사항은 확인하지 못했습니다(Goulart의 배근육·넙다리네갈래근이 어느 근육·갈래인지, Schenkman 원문의 국면 경계 등). Hanawa 2017, Lombard & Abbott 1907, Roebroeck 1994는 열지 못했습니다.
- 2–4국면 근전도 칸(가자미근, 넙다리곧은근 등의 `active`)은 2–4국면 합산 평균에 근거합니다. 그래서 이 국면에만 활동했는지는 알 수 없고, 칸마다 단서를 달았습니다.

검증 스크립트: `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/verify-scripts/check-sts.mjs`
원문 텍스트: `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/verify-src/`
그림: `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/verify-img/`

## author:walking

I wrote both files. Every walking pose now sits on the floor in the current `walkingPose(right, left, t)`. That function changed on disk twice while I was working, and I re-checked against the latest version.

- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/walking.json
- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/walking.sources.json (25 sources)

**Checks run**
- The data type-checks against `Movement` with `tsc --strict`.
- Every structure id is in the catalogues; right side only.
- Every muscle row has a cell for all 8 phases.
- Every source key resolves, and no source is unused.
- No forbidden words and no emoji.
- **Figure engine:** during double support the two feet differ in height by at most 0.42 cm. The swing foot clears the floor by at least 0.34 cm after 64%, and by about 0.7 cm in mid swing. The hip moves up and down about 3.2 cm, which fits Orendurff 2004.

**Sources used for the poses (keyframes at 0, .02, .12, .31, .50, .62, .75, .87; trunk 0)**
- **Phase timing:** Perry & Burnfield 2010, from the publisher preview (chapters 1–3), plus the AAPMR web page.
- **Hip angles:**
  - The heel-strike hip angle is Perry's 20° thigh flexion, measured against vertical.
  - Peak hip extension is −20°, from Kerrigan 2001 (young adults, 20.4°) and Godges.
  - The swing hip values (20° then 30°) come from the AAPMR swing table.
- **Knee:**
  - 15° at 12%, from AAPMR and Godges.
  - 35° at toe-off, from the AAPMR table.
  - 65° at the end of initial swing, the top of the AAPMR swing table's 60–65° range.
  - 30° at the end of mid swing, from AAPMR.
- **Ankle:**
  - −5° early on, from Perry's "about 5° plantarflexion" after heel contact.
  - +7° and +10° in mid and late stance, from the AAPMR table.
  - −14° at toe-off, from Brockett & Chapman 2016.
- **Big toe:** 42° at toe-off, from Nawoczenski 1999. Halstead 2006 (36.9°) and Lin 2013 (48°) are listed in the joint table.
- **Values I set myself so the feet stay on the floor (marked "inference" with the reason):**
  - hip −2° at 31% and −10° at toe-off;
  - knee 5° and ankle −5° at 2%;
  - toe 15° at 50%, and 0° for heel strike and swing because I found no figures for those.
- **Ground reaction force arrow (at .02, .12, .31, .50):** the direction follows Perry's Figure 3-14, which says where the force line passes each joint. I turned that into angles in the drawn pose, assuming the pressure centre is at the heel in early stance and under the forefoot later. Each note gives the allowed angle range. Arrow size follows the two peaks and dip of the vertical force (Perry Fig. 3-29; Anderson & Pandy 2003). These are my approximations, not measured angles.
- **Cycle time:** 1.07 s, calculated from the cadence in Schmitz 2009 (112 steps/min). I marked it as a calculated value, not a measured cycle time.
- **Muscle timing:** Schmitz 2009 surface EMG, given relative to each muscle's cycle average. Hip muscles come from Lyons 1983 and Semciw 2013. Calf contraction type comes from Fukunaga 2001 (medial gastrocnemius only) and Neptune 2001 (model). Iliopsoas cells are inferred from joint moment and power data in Whittington 2008.
- **Female:** only rectus femoris is linked, to `HRAF0396`, the same whole structure as consensus T23.

**Open questions**
1. **Hip reference frame:** pure AAPMR hip values (30° flexion, 10° extension, measured against the pelvis) make the feet float or sink 2–7 cm in this upright-pelvis figure. So I drew the hip against vertical (Perry 20°), which departs from the consensus "IC about 30°". I'm also mixing frames: Perry's 20° at heel strike with AAPMR's 30° in swing, so the hip drops 10° in terminal swing. Someone needs to approve this or choose one frame.
2. **Knee 65° is needed:** with 60° (the consensus value) the swing toe touches the floor in this engine.
3. **Arrow origin:** the `grf` schema has no origin point. The angles only match Perry's descriptions if the page draws the arrow from the heel early in stance and from under the forefoot later.
4. **Sliding stance foot:** with the hip held still, treadmill-style, the stance foot moves backward at uneven speed. This is noted in the limitations.
5. **Gastrocnemius in pre-swing:** the model study (Neptune) says it shortens; the ultrasound study Perry cites says there was no EMG, only tendon recoil. Both are written in the cell note.
6. **Unread sources:**
   - Perry chapters 4–7 (the joint-by-joint chapters with EMG figures).
   - Full texts of Fukunaga and Keller.
   - The AAPMR tables' contraction-type columns, which the PDF layout scrambles; I used only their angles and muscle names.

## verify:standing

## 서 있기 데이터 검증 결과

검증은 `standing.json`과 `standing.sources.json` 두 파일만 고쳤고, 저장소는 건드리지 않았습니다. `stand_build/build.py`를 다시 돌리면 아래 수정이 모두 덮어써지니, 재생성 전에 스크립트에도 반영해야 합니다.

자세 점검(1,001프레임) 결과는 문제없습니다.
- 오른발 바닥 접촉 위반 0, 몸통이 엉덩관절보다 위에 있음.
- 중력선이 무릎 뒤로 가는 프레임 0. 무릎 앞 최소 3.5 mm(t≈0.9), 발목 앞 최소 22 mm.
- 앉기 두 동작의 앉은 엉덩관절 높이는 0.545 m로 범위 안.
- 단위 검사의 서 있기 부분(출처 키, 0–1 시간축, 근육 칸, 구조 id·좌우 쌍, 금지 표현)은 통과했습니다. 서 있기만 넣은 사본으로 돌렸기 때문에, 다른 동작이 필요한 검사 3개는 그 동작이 없어서 실패한 것입니다.

원문과 맞춰 확인한 값: Di Giulio 2019의 거리·모멘트·대상(13명), Gatev 1999의 4.13–4.90 mm·18–21 mm·7명, Loram & Lakie 2002의 91±23%·1.5–4°·h 0.92 m, Loram 2005의 2.6회/2.8회·0.13°/0.23°, Di Giulio 2009의 80.78±15.82%·84±9%·4/9명, Héroux 2014, Joseph & Nightingale 1952·1954 표 1, Joseph & Williams 1957, Nachemson 1966, Floyd & Silver 1950 표 1, Joseph & McColl 1961, Le Huec 2011, O'Rahilly, Hicks 1954, Hewitt 2002, Horak & Nashner 1986. 서지 정보(권·호·쪽·DOI)는 Europe PMC에서 일치를 확인했고, ×8 각도 계산(6.2°/1.8°)과 실제 거리 변화 약 1 mm·3 mm도 맞습니다.

### 바꾼 것 (전 → 후, 근거)

**근거와 맞지 않던 칸**
1. **장딴지근 가쪽갈래 세 칸**: 모두 silent → 평균 정렬 active(“드묾, 1개만 계속 활동”), 앞쪽 active(“결과 엇갈림”), 뒤쪽 nodata.
   - Héroux 2014 본문: 운동단위 1개가 계속 활동했고 3개는 시간의 8.7·4.1·2.3% 동안 활동했습니다. 제목은 “Absence”지만 실제로는 활동이 기록되었으므로 silent(검출된 활동 없음)의 정의에 맞지 않습니다.
   - Gatev 1999: 가쪽갈래 근전도가 체중심 앞뒤 이동과 약한 양의 상관을 보였습니다(Y축은 앞쪽이 양).
2. **배속빗근 앞쪽·뒤쪽 칸 메모**: “그림 9·10 앞뒤로 기울일 때 방전 일정(기울이는 방식은 그림 설명에 없음)”, 뒤쪽 칸의 “뒤로 기울이면 배곧은근·배바깥빗근 수축” → 근거를 139쪽 “선 자세에서 이 섬유의 수축은 연속적”으로 바꿨습니다.
   - Floyd & Silver 1950 139·142쪽: 그림 9·10은 몸통을 굽히거나(엉덩관절 30° 굽힘) 젖힌 동작이라 발목 흔들림과 다르다고 명시했습니다.
   - 평균 정렬 칸의 역할은 “약한~중간” → “아래쪽 섬유 부위 약한 지속 수축”입니다. 134쪽에 따르면 전극은 샅고랑 위 삼각의 섬유만 기록하고 배가로근 맨 아래 섬유가 섞였을 수 있습니다. 대상(21명, 여성 6명 포함)도 적었습니다.
3. **앞정강근 뒤쪽 칸 근거 꼬리표**: [emg] → [emg, inference].
   - “체중심이 발목에 가까울 때”를 뒤쪽 흔들림 상태로 옮긴 것은 해석입니다.
   - Joseph & Nightingale 1952 489쪽 원문은 “앞 또는 뒤 근육”입니다. “발목에서 뒤로 흔들면 앞쪽 근육”이라고 단정한 표현을 고쳤습니다.
4. **앞정강근 평균 정렬 칸 메모**: Di Giulio 2009의 “활동이 흔들림에 따라 변하지 않음”에 “활동이 없다는 뜻은 아님”을 덧붙이고, 84±9%가 깊은 구획 값임을 밝혔습니다.

**CONSENSUS와 어긋나던 곳**
5. **평균 정렬 상태 설명**: “발목 앞 약 5–6 cm, 무릎 앞 약 3 cm” → 정성 표현만 남겼습니다.
   - CONSENSUS §3.1은 도식에 정성 위치만, 수치는 출처 칸에만 두도록 합니다.
   - 원문 값은 47–58 mm라서 “5–6 cm”도 부정확했습니다.
   - 골격 메커니즘 항목의 “약 5–6 cm” → “약 4.7–5.8 cm”, 흔들림 범위는 “평균 18–21 mm”로 바꿨습니다.
6. **한계 항목의 “평균 정렬 0–0.3, 앞쪽 0.3–0.7, 뒤쪽 0.7–1”**: 삭제했습니다. 서 있기는 시간 비율을 화면에 쓰지 않기 때문입니다(§3.1, §4).

**과장되거나 틀린 표현**
7. **“의도적으로 크게 앞/뒤로 흔들면”** → “지시에 따라 발목에서 흔들어 어느 지점을 넘으면”.
   - Joseph & Nightingale 1954(7명)과 Joseph & Williams 1957(약 5°)은 크기가 “크다”고 하지 않았습니다.
   - 넙다리네갈래근과 중력선이 무릎 뒤로 가는 것의 연결은 “저자 설명”으로 표시했습니다. 해당 항목은 오해 항목, 뒤쪽 흔들림 상태 설명, 넙다리네갈래근 칸입니다.
8. **Héroux 2014 전극 “바늘 전극”** → “근육 속 가는 철사 전극”(본문: fine-wire). 가자미근·안쪽갈래 메모, 오해 항목, 한계, 출처 설명을 고쳤습니다.
9. **Gatev 1999 “표면 근전도”** → “쌍극 전극”. 본문에 표면 전극이라는 말이 없습니다.
10. **큰허리근 메모**: “L3 높이 … 표면 전극이 깊은 근육을 잡기 어렵다”는 설명을 바꿨습니다.
    - Nachemson은 셋째 허리 사이원반 높이에 동심 바늘 전극을 썼습니다.
    - Joseph & Williams는 샅고랑인대 아래에 표면 전극을 붙였습니다.
    - 두 연구는 전극과 기록 부위가 다르며, 결과 차이의 이유는 단정하지 않는다고 적었습니다.
11. **관절 표 발목 행 “정강이가 1.5–4° 기욺”** → “평균 발목 각도 1.5–4°(정의 미기재)”. Loram & Lakie 2002는 각도의 정의를 밝히지 않았습니다.
12. **무릎 인대 관련 서술**: “인대가 받음” → “무릎 인대 또는 장딴지근(또는 둘 다)”(Joseph & Nightingale 1954 83–84쪽). 넙다리네갈래근 칸, 오해 항목, 수동 구조 행을 고쳤습니다.

**보충**
- Gatev 체중심은 오른쪽 표지점으로 계산했고, 저자도 실제보다 오른쪽에 놓인다고 적었습니다. 이 점을 관절 표 메모에 넣었습니다.
- 무릎 행 “완전 폄 근처” 출처에 orahilly2004를 추가했습니다.
- 흔들림 오해 항목을 “범위의 조건별 평균 18–21 mm(남성 7명)”으로 고쳤습니다.
- 한계 1번의 “직접 보고한 열람 출처 없음”에, Gatev 그림 1에 각도가 그림으로만 있다는 점을 보탰습니다.
- `conditions`에 출처마다 조건이 다르다는 점을 적었습니다(Joseph & Williams 1957은 손을 등 뒤에 두고 발 간격 약 30 cm).
- `standing.sources.json`: 위 내용에 맞춰 gatev1999, heroux2014, digiulio2009, josephnightingale1952·1954, josephwilliams1957, nachemson1966, floydsilver1950, orahilly2004의 `usedFor`를 고쳤습니다.
  - josephwilliams1957은 286–287·293쪽 열람으로 바꿨습니다.
  - O'Rahilly 인용에는 “page copyright 2008”을 붙였습니다(페이지 표기는 2008).

### 확인하지 못한 것
- **Joseph & Nightingale 1952**: 486–487쪽 본문은 열지 못했고, 표 1과 고찰만 확인했습니다. 장딴지근 갈래 구분 여부도 확인하지 못했습니다.
- **Joseph & McColl 1961**: 36–37쪽만 열었고, 방법과 전극 종류는 보지 못했습니다.
- **2차 인용만 있는 값**: Åkerblom 1948(1.6±0.2 cm, 엉덩관절 10명 중 9명)과 Hellebrandt 1938(약 5 cm)은 Joseph & Nightingale을 거친 인용입니다. Joseph & Nightingale 1956(여성)은 열지 못했습니다.
- **Gatev 1999**: 전극이 표면인지 근육 속인지, 상관에서 어느 쪽이 앞서는지 본문에 명시되지 않았습니다. 그림 1의 각도 값은 읽지 못했습니다.
- **Hewitt 2002, Horak & Nashner 1986**: 초록 수준만 확인했습니다. O'Rahilly 웹판의 정확한 판 연도도 확인하지 못했습니다.
- **연속 재생 중 이름표 지연**: t 0.95–1.0에서 평균 자세가 “뒤쪽으로 흔들림”으로 표시되는 편집상 지연은 그대로 두었습니다. 상태를 고르면 각 상태의 시작 지점으로 가므로 정지 화면은 맞습니다.
- **저장소 문제(수정하지 않음)**: 작성자가 지적한 지지면 띠 문제는 사실로 확인했습니다. `MovementFigure.tsx` 167행은 발이 0.006보다 낮아야 바닥에 닿은 것으로 보는데, 엔진의 발 높이는 0.01이라 발바닥을 붙인 자세에서 지지면 띠가 그려지지 않습니다.
- **화면 검토**: 데스크톱·모바일 화면 촬영과 육안 검토는 하지 않았습니다.

검증용 사본과 스크립트는 `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/vstand_env`, `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/vstand_fix.py`에 있습니다. 수정 전 원본은 같은 폴더의 `standing.before.json`, `standing.sources.before.json`입니다.

## verify:stand-to-sit

I checked both files against the sources and fixed 14 items. All the numbers were correct and every structure id exists in the catalogues. What I changed was wording that claimed more than the sources say, plus several attributions and descriptions. The pose check passes: both feet stay flat at all 401 sampled frames, the trunk is always above the hip, the seated hip is at 0.545 m (8.5 cm above the 0.46 m seat), and the standing hip is at 0.83 m. I also ran a copy of the repo's movement test against the scratch files. It covered sit-to-stand and stand-to-sit only, and 7 of 7 checks pass. I did not run the repo test itself, because `data/movements/` still holds mock files. Nothing inside `/Users/nuinuri/workspace/anatomy` was changed.

**What I checked**
- **Full text:** the 8 PMC papers (via Europe PMC XML) and Cunha 2014 (SciELO page).
- **Abstracts:** Kerr, Mourey, Dubost, Ashford, Kralj and Jeon 2021 (PubMed).
- **Numbers that match the source:** all Jeon 2025 Table 2 REF values, Jeon 2024's 73.40/81.11, Kinoshita Table 1 (82.7/9.0), Yoshioka 2014 (17.3°, 86.4%), Yoshioka 2009 (0.492 m), Kerr (1.97/1.91 s), Lin & Lee (2.0 s, 8.8°), Herzog (0.71–0.88 s, 1.33–1.49 s, 2 of 60) and Dubost (about 10°).
- **ids:** all male ids are in the catalogues with the correct system, and HRAF0396/HRAF0394 are in the female catalogue.

**Changes (before → after, source)**
1. **Herzog mechanics line:** "vertical or hybrid lowering, and then seat contact came earlier" → only vertical lowering reached the seat earlier. Vertical was 0.71 ± 0.15 s, hybrid 0.87 ± 0.19 s, backward 0.88 ± 0.20 s. "Arms free" → "arms not crossed", in the mechanics line, the limitations and `usedFor`. (Herzog 2023 Results)
2. **Rectus femoris cell:** "the authors read it as eccentric control at the knee" → the abstract says only "eccentric contraction/control of the RF" and names no joint. Corrected in `jeon2021.usedFor` too. (Jeon 2021 abstract)
3. **Vastus lateralis cells, mechanics line, `usedFor`, new limitation:** the claim that activity rises until just before the vertical floor force drops, then falls sharply, comes from representative-subject figures and the authors' text, not group statistics. I added this to the descent cell, the mechanics line and the `usedFor`, and as a new note on the seat-loading cell. (Jeon 2024 Fig. 3, Jeon 2025 Fig. 2)
4. **Lin & Lee stage definition:** "after the pelvis stops" → "after the greater-trochanter marker (hip) stops, until the shoulder marker stops". Applied to the stage summary, the stage mechanics and the t=0.74 note. (Lin & Lee 2022 Methods)
5. **Misconception 1:** "the joints move through a similar range" → "in young adults the shoulder path and trunk angle change are similar". (Mourey 1998 abstract)
6. **Misconception 2:** "throughout the descent" → "during the controlled descent". (Jeon 2024/2025)
7. **Kerr note:** says the abstract's "recovery velocity" is translated as trunk re-uprighting speed, measured with the C7 marker in 50 people aged 20–78. (Kerr 1997 abstract)
8. **Kinoshita:** population → 16 young adults (15 men, 1 woman, aged 21–43). "Chair set to a 90° knee" → Kinoshita only seated people at a 90° knee; it was Jeon who adjusted the chair height. (Kinoshita 2015 Methods)
9. **Not-in-model list:**
   - Patellar ligament and quadriceps tendon: added "not in the male model, present in the female HRA atlas" (HRAF0909/0932, HRAF0395/0397).
   - "Fat and muscle layer": gluteus maximus is in the model, so this became the fat pad over the ischial tuberosity only.
10. **Female-view limitation:** the other five muscles open as the carried male copies (FT_); the hip bone has neither a whole female structure nor a carried copy, so it does not open in female view. (`src/movement-link.ts`, `female-transport-structures.json`)
11. **Shared-sample limitation:** added the identical height and weight tables and the same ethics approval number (IRB 2022–118) as evidence.
12. **Timing note:**
    - Added the fixed line "키프레임 사이는 보간한 근사이며 측정 궤적이 아닙니다" (the same wording sit-to-stand uses).
    - Added that slowing near the chair (Mourey) and the fast final drop (Jeon) come from different studies and measures, and joining them into one path is editorial.
13. **Smaller fixes:**
    - The biceps femoris cell now says the sources name only "biceps femoris"; mapping it to the long head is an editorial choice.
    - The Mourey note now says the result is from young adults.
    - The Chen & Yang note now says its claims are background from the introduction.
14. **Cunha citation:** pages added (27(2):251-259, from the SciELO page).

**Still unverifiable**
- Kerr, Mourey, Dubost, Ashford, Kralj and Jeon 2021 were checked from abstracts only. Kralj's four stage names and Ashford's muscle-by-muscle results (hamstrings eccentric when sitting) are known only through Cunha 2014.
- No source gives group-average timing for when vastus lateralis peaks and drops; it comes only from representative-subject figures.
- The intermediate keyframes, hip 74° and trunk 0° when seated, and the stage lengths are editorial. The seated knee (82.7°) is about 7° off the 90° chair setting. If the sit-to-stand start pose changes, the last frame here must change with it.
- Only Mourey describes slowing near the chair, without numbers, and the abstract doesn't say which marker's speed was measured.
- No source analyses muscle activity after seat loading or once seated.
- Ids still to merge when building `data/movement-sources.json`: `kinoshita2015`, `yoshioka2014`, `yoshioka2009` (also in `sit-to-stand.sources.json` with different `usedFor` text).

Files changed:
- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/stand-to-sit.json
- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/stand-to-sit.sources.json

Originals backed up in /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/verify-sts/

## verify:walking

**걷기 데이터 검증 결과**

두 파일을 수정했습니다. 저장소 안의 파일은 건드리지 않았습니다. 수정 뒤 저장소의 `tests/movements.test.mjs`를 스크래치 복사본에서 돌려 9개 모두 통과했습니다. 이 검사에는 앉은 자세 엉덩관절 높이와 발 접지도 들어 있습니다. `tsc --strict` 타입 검사도 통과했습니다. 출처 키는 모두 존재하고 안 쓰는 키도 없으며, 금지 표현과 이모지는 0건입니다.

**자세 점검** (방금 어깨 위치가 바뀐 최신 `movement-figure.ts` 기준, 다리 계산은 변화 없음)
- 한발 지지 중 디딤발은 정확히 바닥에 닿아 있습니다.
- 양발 지지 중 두 발의 높이 차는 최대 0.42 cm입니다.
- 바닥을 뚫는 프레임은 없습니다.
- 엉덩관절 위아래 움직임은 3.15 cm입니다.

작성자의 주장 세 가지는 직접 다시 계산해 맞다고 확인했습니다.
- 무릎을 60°로 하면 67%에서 발끝이 접지 높이보다 0.03 cm 내려갑니다. 그래서 65°가 필요합니다.
- 초기 접지에 엉덩관절 30°를 쓰면 발이 약 5.3 cm 뜹니다.
- 발가락 떼기에 엉덩관절 0°를 쓰면 접지가 깨집니다.

**고친 것** (이전 → 이후, 근거)
1. **여성 보기 한계 문장**: "나머지 근육은 남성 원본만 연결" → "남성 원본을 옮긴 보완 구조(FT_)를 열고, 넙다리곧은근만 HRAF0396". 저장소 `female-transport-structures.json`과 `movement-link.ts`를 보면, FMA38928만 옮긴 사본이 없고 나머지 구조는 모두 있습니다.
2. **오해 항목 "유각기 무릎 굽힘은 뒤넙다리근이 당긴다"의 설명**:
   - 이전에는 "뒤넙다리근은 중간 유각기에 시작해 말기 유각기에 가장 커짐"이라고 일반화했습니다.
   - Lyons 1983은 반막근과 넙다리두갈래근 긴갈래만 다뤘으므로 그 둘로 한정했습니다.
   - Schmitz 2009는 "측정한 구간 가운데" 말기 유각기가 가장 크다고 적었습니다.
   - AAPMR 유각기 표가 초기 유각기 무릎 굽힘에 넙다리두갈래근·두덩정강근·넙다리빗근을 적은 점을 덧붙이고, 출처에 aapmr2017swing을 추가했습니다.
3. **엉덩관절 기준계 단정 삭제**: "AAPMR 30°·10°·중립은 골반 기준 값"이라는 단정을 "표에 각도 기준이 적혀 있지 않음, 원인 확인 안 됨"으로 바꿨습니다. 해당 위치는 키프레임 0, .31, .62, .87의 노트, 엉덩관절 행 노트, 한계 문장입니다. CONSENSUS 2차 지적("기준계 탓은 확인되지 않음")과 AAPMR 표를 따랐습니다. .31 노트에는 Godges의 "중간 입각기 후반 10° 폄"을 함께 적었습니다.
4. **한계 문장의 엉덩관절 −2°/−10° 이유**: 이전에는 둘 다 "두 발이 함께 바닥에 닿도록"이었습니다. 이제 −2°는 "발바닥이 평평하도록", −10°는 "두 발 접지"입니다. 엔진 계산(발 기울기 = 무릎 − 엉덩관절 − 발목 = 0)으로 확인했습니다.
5. **발목 행**: "부하 반응기 10°(AAPMR 표·Godges)" → "10°(Godges; AAPMR 표는 중간 입각기 시작 값)". AAPMR 입각기 표에는 부하 반응기 발목 각도가 없습니다.
6. **Perry 인용**: "약 5° 발바닥굽힘 호" → "5°"입니다(원문 "a 5º arc"). `usedFor`에 "12% 무릎 20°"를 추가했습니다.
7. **장딴지근 칸**:
   - 말기 입각기 노트에 Neptune을 인용하면서 출처에 없었기 때문에 neptune2001을 추가했습니다.
   - "안쪽갈래 측정값이며 가쪽갈래로 넓히지 않음"을 적었습니다.
   - 중간 입각기 role을 "안쪽갈래 …(초음파)"로 바꿨습니다(CONSENSUS §3.4).
8. **넓은근 중간 입각기 단축성**: 근거 [근전도, 역학] → [근전도, 역학, 추론]. Perry의 일률은 넙다리네갈래근 전체 값이라, 넓은근에 배정한 것은 해석입니다.
9. **엉덩근·큰허리근 전유각기**: "근육의 몫은 그 나머지" → "나머지는 능동 근육 전체의 몫이며 이 근육 하나의 기여율이 아님"(CONSENSUS §3.4, Whittington 2008).
10. **넙다리곧은근 초기 유각기**: Whittington의 에너지 전달이 "수동 신장 성분의 추정"임을 밝혔습니다(본문 확인).
11. **중간볼기근 중간 입각기**:
    - Anderson은 수직 지지만, Liu는 지지와 전진을 함께 다룬다고 나눠 적었습니다.
    - "수축 방식 확인 필요"를 추가했습니다(CONSENSUS).
12. **앞정강근 초기 접지**: 정강이 앞 근육 무리 설명의 출처로 aapmr2017stance를 추가했습니다(표 확인).
13. **Lin 2013 대상**: "젊은 성인 10명" → "정상 지원자 10명"(초록).
14. **Williams 2022**:
    - "발허리–발목뼈 관절"은 오역이라 "가로발목뼈관절(midtarsal)"로 고쳤습니다.
    - 발바닥널힘줄 노트의 "다른 요소가 더 크게 기여"를 "운동학적 몫 약 1/6, 다른 결합 요인 제시"로 바꿨습니다(본문).
    - doi를 추가했습니다.
15. **출처 세부**:
    - Keller: "레크리에이션 운동선수"를 명시했습니다.
    - Andersson: "트레드밀 11명"을 명시했습니다.
    - AAPMR 표 두 개: 연도 "2017" → "작성자 미기재, 업로드 경로 2017/03"으로 바꿨습니다.
    - aapmr2025: "발꿈치가 대개 먼저" → 원문대로 "정상 보행에서 먼저 닿는다는 서술".
    - Nawoczenski 42°: PubMed 초록에는 빠져 있고 Europe PMC 판 초록에서 확인했다고 적었습니다.
16. **한계 문장 추가 세 가지**:
    - 초기 접지 경계 차이: 이 페이지는 Perry의 0–2%, Schmitz는 0–10%를 부하 반응기로 묶음. CONSENSUS §3.4가 요구합니다.
    - 서로 다른 연구의 관절별 최대값을 한 순간(50%, 62%)에 함께 둔 점(CONSENSUS §3 공통 규칙).
    - 지면반력 화살표: 시작점이 발꿈치와 발허리뼈머리여야 방향이 맞고, 12–21% 구간에는 부하 반응기 방향이 보인다는 점.

**원문과 일치를 확인한 항목**
- Perry 미리보기: 국면 %, 82 m/min, 넙다리 20°, 5° 발바닥굽힘 호, 12% 시점, 정강이 수직, 말기 유각기 20°, 약 1 cm 낙하, 그림 3-14·3-29, 양의 일률 네 구간, 서문의 초음파 연구, 엉덩넙다리인대.
- AAPMR 웹 페이지와 두 표의 모든 각도.
- Godges의 모든 값.
- Schmitz 표 2·3의 모든 배수(젊은 성인 선호 속도). 112걸음/분으로 계산하면 주기 1.07초입니다.
- Whittington의 38%, 58%, 15%, 0.88 Nm/kg, 10→14°.
- Brockett의 14°, 30°, 50%.
- Kerrigan, Fukunaga, Neptune, Lyons, Semciw, Anderson, Liu, Keller, Orendurff, Kuo, Donelan, Halstead, Lin, Pirker의 수치.
- 구조 id는 모두 카탈로그에 있고 오른쪽만 씁니다. "모델에 없는 구조" 목록도 맞습니다.

**검증하지 못한 것과 결정이 필요한 것**
- **화살표 렌더러 문제 (데이터가 아니라 코드, 저장소라 수정하지 않음)**:
  - `MovementFigure.tsx`는 발 접지 판정 기준이 `< 0.006`인데, 엔진의 바닥 간격(`FLOOR_GAP`)은 0.01입니다. 그래서 걷기에서 지면반력 화살표와 지지면이 101프레임 중 2프레임에만 그려집니다.
  - 화살표 시작점이 발 가운데입니다. 이 경우 부하 반응기에는 Perry의 관계를 만족하는 각도가 없고, .31은 −1~0°, .5는 15~17°가 필요합니다.
  - 데이터 각도(−10, −5, −5, +10)는 발꿈치·발허리뼈머리에서 시작할 때만 맞습니다. 작성자가 적은 허용 범위는 다시 계산해 맞음을 확인했습니다.
- **엉덩관절 기준계 (작성자 질문 1)**: CONSENSUS는 "초기 접지 약 30°"인데 도식은 20°입니다. 이 엔진에서 30°는 접지가 깨지므로 데이터만으로는 해결할 수 없습니다. 승인이 필요합니다.
- **무릎 65°**: CONSENSUS의 "약 60°"보다 큽니다. AAPMR 범위(60–65°) 안이고 접지 조건 때문에 필요합니다. 승인이 필요합니다.
- **초기 접지 0–3%**를 쓰는 출처는 찾지 못했습니다. 0–2%와 0–10%의 차이만 적었습니다.
- **원문 미열람**:
  - Perry 4–7장을 볼 수 없어, 서문이 인용한 초음파 연구가 어느 논문인지 확인하지 못했습니다.
  - Kerrigan의 각도 정의는 확인하지 못했습니다.
  - Fukunaga, Neptune, Lyons, Semciw, Andersson, Anderson, Liu, Keller, Orendurff, Nawoczenski, Halstead, Lin은 초록만 확인했습니다.
- **AAPMR 표의 단축성·신장성 열**은 렌더링해 보니 비어 있고 내용이 한 칸씩 밀려 있어, 수축 유형은 판독할 수 없습니다.

수정한 파일:
- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/walking.json
- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/motion/data/walking.sources.json

원본 백업과 수정 스크립트는 /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/155538f4-138a-435b-b77b-f26fbb0786be/scratchpad/verify-walk/ 에 있습니다.
