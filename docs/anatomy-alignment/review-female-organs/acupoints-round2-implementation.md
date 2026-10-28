Round 2 is done: all three verifier defects are fixed and the new rules are in, but one WHO order relation still fails. ST18 now sits on the breast crease and that puts it below ST19 on both sides. I recorded this in `knownBoundaryFailures` rather than hiding it. The two builds gave byte-identical output (sha256 c622218109a2…). The four named test files pass 27/27. The male files and `data/female-atlas-structures.json` are unchanged (git diff empty, hashes match the start of the session).

As a check, I ran the new gates against the round 1 output. They fail it: G7 lists all 10 wrong-face markers, and G6 lists 21 broken level, order and relation checks.

Nothing was checked in the app: no screenshots and no browser runs, as the brief required. Under AGENTS.md that means this is not visually verified. The requirement/evidence table in `docs/` is also not updated, because `docs/` was off limits.

## Files changed
- `/Users/nuinuri/workspace/anatomy/scripts/build-female-anchors.mjs` (rewritten)
- `/Users/nuinuri/workspace/anatomy/scripts/female-acupoints/rules.mjs`
- `/Users/nuinuri/workspace/anatomy/scripts/female-acupoints/scene.mjs` (adds `planeContours`, `meanNormal`)
- `/Users/nuinuri/workspace/anatomy/scripts/female-acupoints/landmarks.mjs`
- `/Users/nuinuri/workspace/anatomy/data/female-acupoint-landmarks.json`: new keys only, and every round 1 value is unchanged (checked field by field). New keys: `pubicSymphysisInferior`, `asis`, `patellaBaseLateral`, `nipples.outerCentre`, `inframammaryCrease`, `rib11FreeEnd`, plus new asymmetry values.
- `/Users/nuinuri/workspace/anatomy/data/female-acupoint-rules.json`: 51 rules, each now has a `method`. Also adds `round2`, `source.kmcric`, editorial choices, and a new `knownBoundaryFailures`.
- `/Users/nuinuri/workspace/anatomy/tests/female-acupoints.test.mjs` (rewritten)
- `/Users/nuinuri/workspace/anatomy/public/models/acupoint-anchors-female.json` (regenerated)

Helpers and backups are in the scratchpad, `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/female/acu2/`:
- `make-rules2.mjs` writes the rules file.
- `whoquotes2.py` and `who-quotes2.json` hold the WHO quote extraction.
- `round1/` is a backup of every round 1 file.
- `neg/round1-vs-new-gates.test.mjs` is the check that runs the new gates on round 1 output.

## New rules (WHO 2008 wording, PDF page)

| Point | Method | WHO text | How it is placed |
|---|---|---|---|
| CV16 | cun | "at the midpoint of the xiphisternal junction, on the anterior median line" (p236) | Junction height, on the median line |
| SP13 | cun | "4.3 B-cun inferior to the centre of the umbilicus, 4 B-cun lateral to the anterior median line" (p85) | navel −4.3 lower cun, 4 lateral cun |
| LR12 | cun | "at the same level as the superior border of the pubic symphysis, and 2.5 B-cun lateral to the anterior median line" (p210) | Pubic top level, 68.5 mm out |
| EX-CA1 | cun | Not in WHO 2008. KMCRIC: "아랫배부위, 배꼽 아래 4寸, 앞정중선 가쪽으로 3寸." | navel −4 lower cun, 3 lateral cun |
| GB27 | cun | "3 B-cun inferior to the centre of umbilicus, medial to the anterior superior iliac spine"; Note: "same level as CV4" (p194) | navel −3 lower cun; left–right position = that side's own ASIS (zero margin, editorial) |
| GB28 | cun | "0.5 B-cun medioinferior to the anterior superior iliac spine"; Note: "0.5 B-cun medioinferior to GB27" (p194) | From GB27: 9.7 mm medial and 12.8 mm down (45°, editorial) |
| SP12 | level | "at the inguinal crease, lateral to the femoral artery"; Note: "At the same level as CV2, medial and inferior to SP13" (p84) | Pubic top level; left–right offset kept from the transported marker; projected from the front |
| GB26 | level | "inferior to the free extremity of the 11th rib, at the same level as the centre of umbilicus"; Note 2: "inferior to LR13, at the same level as CV8" (p193) | Navel level; re-projected horizontally along the carried direction to the nearest skin face that faces it |
| ST31 | landmark | Note 2: "intersection of the line connecting the lateral end of the base of the patella with the anterior superior iliac spine, and the horizontal line of the inferior border of the pubic symphysis" (p70) | That intersection in the front view, projected onto the thigh |
| ST17 | landmark | "at the centre of the nipple" (p63) | Outer surface of the HRA nipple (HRAF0014 right / HRAF0006 left), on the nipple's axis; `surfacePart` names the part |
| ST18 | landmark | "In females, St18 is located at the midpoint of the inferior crease of the breast" (p63) | Crease on the nipple's vertical line (see below) |

New landmarks, as measured:
- **ASIS** (most forward point of each HRA ilium): right (−0.13806, 0.88164), left (0.12568, 0.88509). It stays within 7.1–7.6 mm when the search direction is tilted 20°. The two sides differ by 13.3 mm (mirror mismatch).
- **Inferior border of the pubic symphysis:** y 0.77046 (sides differ by 0.3 mm).
- **Lateral end of the patellar base:** sides at y 0.45731; the 30° vs 45° choice changes it by 9.8 mm.
- **Nipple outer centres:** 3.1 mm (right) / 3.5 mm (left) outside the skin.

How the crease is defined (ST18):
- I cut the skin vertically through the nipple and walk 150 mm down from it. The crease is the point deepest below the forward outline of that path.
- Right: (−0.10963, 1.13361, 0.02186). Left: (0.10972, 1.13137, 0.02271). That is 51–53 mm below the nipple and 11.4–12.4 mm from the breast fat.
- Moving the cut 2 mm sideways moves the point by up to 2.9 mm (right) / 5.2 mm (left). The two sides mirror within 2.4 mm.
- **Why below the nipple:** the crease has no measurable ends on this mesh, so I read WHO's "midpoint" as the point below the nipple, which is also WHO's 4 B-cun line. The lowest point of the crease is 20–30 mm further in and 4.7–5.7 mm lower.

## What moved (round 1 → round 2, mm)

Rule markers: distance moved in 3D, then height change (R / L).

| Point | 3D move | Height change |
|---|---|---|
| CV16 | 11.9 | +10.0 |
| SP13 | 59.9 / 61.1 | −59.9 / −60.6 |
| LR12 | 53.7 / 53.5 | −49.5 / −50.8 |
| SP12 | 50.6 / 50.4 | −50.6 / −50.3 |
| EX-CA1 | 40.8 / 42.1 | −39.8 / −40.2 |
| GB26 | 39.9 / 42.4 | −38.6 / −41.2 |
| GB27 | 30.8 / 48.5 | −27.2 / −30.7 |
| GB28 | 40.9 / 59.0 | −9.5 / −10.9 |
| ST31 | 43.2 / 53.4 | −24.5 / −27.2 |
| ST17 | 64.5 / 95.1 | −55.0 / −82.5 |
| ST18 | 93.9 / 114.1 | −81.6 / −109.6 |

Moved by the facing rule: skin point / displayed marker, and the carried-point distance to the nearest crossing → to the facing one.

| Marker | Skin point | Display | Nearest → facing |
|---|---|---|---|
| HT9 L | 11.8 | 16.2 | 4.1 → 7.8 |
| HT9 R | 14.7 | 19.8 | 5.6 → 9.1 |
| EX-UE11 site 4 L | 9.6 | 13.6 | 2.5 → 7.1 |
| EX-UE11 site 4 R | 13.0 | 17.5 | 3.9 → 9.1 |
| BL66 L | 7.4 | 9.8 | 3.6 → 3.8 |
| BL66 R | 11.3 | 15.0 | 4.5 → 6.8 |
| LI7 L | 13.5 | 14.9 | 4.1 → 9.5 |
| SP2 R | 5.8 | 6.6 | 0.7 → 6.5 |

The surface point of HT2 ×2 did not move; only its label changed (see exceptions).

**Display-only change I added beyond the brief:** the 8 field-closest markers now offset their display along the skin face's outward normal instead of the carried direction. Their skin points are unchanged. The display moves were SP4 L 4.1, LR10 2.3/2.1, LR11 3.3/3.2, EX-LE12 site 0 L 3.8, EX-LE12 site 2 3.8/3.8 mm. The old direction was 41–87° off the face normal (87° for SP4). Revert this if unwanted.

The 66 abdominal block markers and the 7 region-reference markers are unchanged.

**ST15–ST19 height (y)**

| Point | Round 1 (R / L, sides differ by, mirror mismatch) | Round 2 (R / L, sides differ by, mirror mismatch) |
|---|---|---|
| ST15 | 1.2860 / 1.3027, 16.7, 22.2 | unchanged |
| ST16 | 1.2627 / 1.2858, 23.1, 26.9 | unchanged |
| ST17 | 1.2401 / 1.2668, 26.8, 30.5 | 1.1851 / 1.1844, 0.8, 0.9 |
| ST18 | 1.2152 / 1.2410, 25.7, 30.1 | 1.1336 / 1.1314, 2.2, 2.4 |
| ST19 | 1.1587 / 1.1587, 0.0, 0.6 | unchanged |

- Round 1 order: ST15 > ST16 > ST17 > ST18 > ST19.
- Round 2 order: ST15 > ST16 > ST17 > ST19 > ST18. ST16 is still above ST17 (by 77.6 / 101.4 mm) and ST18 is below ST17 (by 51.5 / 53.0 mm).
- ST17 now sits 2.7 mm from the nipple centroid; in round 1 it was 63.3 mm (R) / 93.9 mm (L) away.

## Gate results
- **G9:** 834 markers, 409 names, male order kept. Methods: field-ray 732, female-landmark-cun 77, female-landmark-level 4, female-landmark 6, field-closest 8, field-carried 7. No marker still has `openAirFix`.
- **G1:**
  - CV8 is 0.00 mm from the navel centre.
  - CV2 is 0.00 mm from the pubic top on the median line (2.94 mm from the bony centre).
  - CV16 is 0.00 mm from the junction on the median line (7.05 mm from the bony centre).
  - ST17 is 0.000 mm from the nipple's outer centre.
  - ST18 is 0.000 mm from the crease point.
- **G2:** front-projected rule markers median 0.00, p90 0.01, max 0.01 mm (n 81). The 4 level-only markers are 0.00 mm off their level.
- **G5** (mirror mismatch):

  | Group | Limit (mm) | Result (mm) |
  |---|---|---|
  | Median-line cun pairs | 6.5 | median 0.08, p90 0.37, max 0.39 (n 29) |
  | ASIS-based: ST31 / GB27 / GB28 | 16.3 | 9.44 / 12.98 / 12.46 |
  | ST17 | 5.0 | 1.00 |
  | ST18 | 5.4 | 2.53 |
  | SP12 / GB26 (reported only, not gated) | none | 2.86 / 2.95 |

- **G6:**
  - Spacing ratio median 1.04, p90 1.11, max 1.17 (n 62). CV15–CV16 is now exactly 1 cun, so the fragile gate is gone.
  - "Same level" groups all within 0.00 mm:
    - navel: CV8, KI16, ST25, SP15, GB26 (n 9)
    - pubic top: CV2, KI11, ST30, LR12, SP12 (n 9)
    - 3 cun below the navel: CV4, KI13, ST28, GB27 (n 7)
    - 4 cun below the navel: CV3, KI12, ST29, EX-CA1 (n 7)
    - xiphisternal junction: CV16
    - inferior border of the symphysis: ST31
  - Relations:
    - SP12 is medial to SP13 (91.2 / 93.8 vs 109.7 mm) and 25.3 mm below it.
    - GB27 is not lateral to the ASIS (equal).
    - GB28 is 9.7 mm medial to GB27 and 12.8 mm below it.
    - GB26 is 113.6 / 114.3 mm below LR13.
  - Only known failure: ST19–ST18 order on both sides (ST18 below by 25.1 / 27.4 mm).
- **G7:**
  - 0 closed markers, 0 open-air moves, 0 open-air exceptions; no marker off its surface; no display offset points into the skin.
  - Wrong-face markers: 2, both listed (HT2 L 129°, HT2 R 166°).
  - The open-air check now uses each face's own outward normal, with no display-offset turning.
- **Breast flag:** 24 markers, down from 28. ST17 and ST18 are excluded on purpose: their position is defined by the breast itself. The other flags are unchanged, including ST14 and KI25 on the right side only.

## Exceptions
- **HT2 ×2 (`facingException`):** no skin face points the carried direction within 120 mm either way. The nearest crossing is kept, so the marker sits on the lateral chest wall facing the arm, 34–37 mm from the 7th rib. It is not on the medial upper arm.
- **ST19–ST18 order (`knownBoundaryFailures`):** on this donor the breast reaches below the 6 B-cun level, so the crease is 0.8–0.9 B-cun below ST19. WHO's order assumes the male nipple-line reading.

## Remaining limitations
- **Editorial choices around the ASIS:**
  - GB27 reads "medial to the ASIS" with zero margin.
  - GB28 uses a 45° "medioinferior" direction. Measured from the ASIS tip instead of GB27, it would sit about 15 mm higher.
  - The HRA ASIS left–right mismatch of 13.3 mm carries into GB27, GB28 and ST31.
- **ST31** uses WHO Note 2 only; the muscle depression is not checked. The patellar base end is uncertain by about 10 mm, which moves ST31 by about a quarter of that.
- **SP12 and GB26** keep their transported left–right position, so any transport error in that direction remains.
  - SP12's inguinal crease is not checked.
  - The transported (male) femoral artery is 16 / 26 mm medial to SP12 (consistent with WHO), at LR12, and 13–20 mm lateral of ST30 (not "over" it, inherited from round 1).
- **GB26** ignores the 11th rib: the borrowed rib's tip is 65–67 mm medial to GB26 and 99 mm above it.
- **ST19** sits on the underside of the breast: the skin face points down (y −0.51 left / −0.55 right) and the frontal ray behind it crosses 49.3 / 50.6 mm of breast fat. This wording is now in ST19's review notes.
- **ST15 and ST16** were not moved, as instructed. Their sides still differ in height by 17–23 mm (mirror mismatch 22–27 mm).
- **Toe line:** BL66 is now on the face matching the carried direction but is still nearest the 4th toe. BL65–BL67 inherit this transport error.
- **Grazing faces:** LI7 L and SP2 R meet the skin at shallow angles (dot 0.22 / 0.17).
- **LR10/LR11 (field-closest)** are still 25–40 mm from their carried points (inherited).
- **EX-CA1** follows KMCRIC, not WHO.
- **Review status:** everything is still marked unreviewed.

## Suggested Korean UI wording
- **`female-landmark-cun`:** "여성 배꼽·두덩결합·칼몸통결합(일부는 위앞엉덩뼈가시)과 두 젖꼭지 사이 8촌으로 계산한 근사 위치입니다. 전문가 검수 전입니다."
- **`female-landmark-level`:** "높이만 여성 표지(배꼽·두덩결합 위모서리)에 맞추고 가로 위치는 남성 표식을 옮긴 근사 위치입니다. 전문가 검수 전입니다."
- **`female-landmark`:** "여성 몸의 표지(젖꼭지 중심, 유방 아래 주름, 위앞엉덩뼈가시–무릎뼈 바닥 선)에 직접 놓은 근사 위치입니다. 전문가 검수 전입니다."
- **ST18 extra note:** "여성 기준(유방 아래 주름의 중점)으로 놓아 이 몸에서는 ST19보다 아래에 있습니다."
- **`facingException` (HT2):** "옮겨 온 방향에 맞는 피부면이 없어 반대쪽 면(가슴 옆벽)에 놓였습니다. 실제 위치와 다를 수 있습니다."
- **Toggle tooltip:** "배·사타구니·가슴 87개는 여성 표지 기준, 나머지는 남성 표식을 옮긴 근사 위치 · 검수 전 · 누르면 숨김"
