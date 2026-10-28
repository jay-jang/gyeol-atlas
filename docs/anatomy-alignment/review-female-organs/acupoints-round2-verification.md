**Verdict: ship-with-fixes.**

The round 2 placements are correct and reproducible. The WHO transcription, landmarks, tests, facing and open air all check out, and only the intended 39 markers moved. The problem is the report's claim that "one WHO order relation still fails". Moving ST17 to the nipple and ST18 to the breast crease also breaks several WHO chest relations with unchanged neighbours. None of these is gated, recorded in `knownBoundaryFailures`, or shown on the point card.

## Defects

**1. Chest relations broken by ST17/ST18 are not recorded (medium).** This is the same kind of problem as round 1 defect 1. Values are right / left; round 1 in brackets.
- **LR14 vs the nipple:** WHO's LR14 note says "inferior to the centre of the nipple". LR14 L is now 11.8 mm *above* ST17 L (round 1: 70.7 mm below). LR14 R is only 6.6 mm below.
- **Order on the 4 B-cun line:** WHO's intercostal order is ST16 (3rd) > ST17 (4th) > ST18 (5th) > LR14 (6th) > GB24 (7th). The markers now run:
  - right: ST16 > ST17 > LR14 > GB24 > ST18
  - left: ST16 > LR14 > ST17 > GB24 > ST18
  - ST18 is below GB24 by 15.5 / 28.9 mm and below LR14 by 44.9 / 64.7 mm.
- **5th intercostal curve** (WHO SP17 note: SP17, ST18 and KI22 lie along it): ST18 is 75 / 88 mm below the KI22–SP17 line (+6 / +19 mm).
- **4th intercostal curve** (WHO SP18 note: SP18, ST17 and KI23): ST17 is 53 / 64 mm below the KI23–SP18 line (+2 / +16 mm).
- **Why the gate misses them:** G6 has no line containing LR14, GB24, SP18 or KI23. The SP line stops at SP17 and the KI line at KI22, and both only check order on their own line.
- **Fix:** add these relations to G6 and to `knownBoundaryFailures`, with the reason (female note on a donor whose nipple is about at the 6th intercostal space). Then rerun `scripts/female-acupoints/notes.mjs`. That script writes `data/female-acupoint-notes.json`, which appeared at 01:00 and is outside the implementer's allowed paths.

**2. ST31–ST32 spacing failure is not recorded (low; inherited).**
- The carried ST32 is 103 / 101 mm (5.5 / 5.4 thigh B-cun) above WHO's "6 B-cun superior to the base of the patella" (thigh B-cun 18.8 mm).
- It is also 20 / 25 mm lateral of the ASIS–patella line.
- ST31–ST32 is therefore 98 / 99 mm against WHO's 201 mm, a ratio of 0.49 (round 1: 0.54 / 0.56). G6 checks only their order.
- Round 1's SP13 ratio of 0.46 was recorded; this one should be too. ST32 and ST33 could be built from the new ASIS and patella landmarks.
- SP11 is still 94 / 100 mm from WHO's one-third point between SP12 and the medial end of the patellar base. Round 2 improved this from 126 / 130 mm.

**3. G5's ASIS limit checks the ASIS against itself (low).**
- The limit is `asisMirrorMm + 3`, so a wrongly picked ASIS loosens its own tolerance.
- The ilium meshes mirror within a median of 2.1 mm after a rigid fit, but the right ilium sits 6.3 mm further out. That accounts for roughly half of the 12.2 mm left–right ASIS mismatch.
- The left ASIS pick is unstable beyond a 20° tilt: it jumps by up to 75.7 mm at 30°.

**4. Report inaccuracies (low).**
- "Only LI7 L and SP2 R are grazing" understates it. 23 carried markers meet the skin at more than 75° from their carried direction, for example SP4 L 87°, EX-LE1 L 86°, GB12 R 85°, GB40 L 84°, SP17 ×2 82° and GB30 R 82°. LI7 L is 77° and SP2 R is 80°.
- "Only known failure: ST19–ST18" is incomplete; see defect 1.

**5. Information only.**
- **GB28:** WHO's main text and the Korean excerpt the app shows (위앞엉덩뼈가시에서 아래안쪽으로 0.5寸) both measure from the ASIS. The marker is 28.8 / 32.1 mm from the ASIS, about twice the main text's 0.5 B-cun. This was disclosed as editorial, but the point card will contradict the marker.
- **ST31:** it lies over the VHF sartorius (10.4 mm deep on the right) and the HRA rectus femoris. The tensor fasciae latae centre is 31 mm lateral on the right (26 mm on the left). The two muscle sources disagree by about 18 mm, and the muscle depression is not checked, as disclosed.
- **New files after the report:** `scripts/female-acupoints/notes.mjs`, `data/female-acupoint-notes.json` and `tests/female-acupoint-notes.test.mjs` appeared at 01:00, after the implementer's last write at 00:40. They match the other engineer's UI work (`src/AtlasPage.tsx` at 01:01), and their test passes.
- **Not done:** no app screenshots, and the docs requirement/evidence table is not updated (both disclosed).

## Measured numbers (my own scripts)

- **WHO transcription:**
  - All 10 WHO rules match `who.txt` quote and PDF page: CV16 p236, SP13 p85, LR12 p210, SP12 p84, GB26 p193, GB27/GB28 p194, ST31 p70, ST17/ST18 p63.
  - The EX-CA1 KMCRIC text matches `data/points.json` exactly.
- **Rebuild and landmarks:**
  - Rebuilding to my folder is byte-identical: sha256 c622218109a2bb99b006a69ba2e54a760b8f10f40cfa0f7bf65f916256f5d7eb.
  - Regenerating the landmarks is also byte-identical (44ef9036…). All round 1 values are unchanged and there are 15 new keys.
- **Counts and provenance:**
  - 834 markers and 409 names; male key, side and order kept.
  - Methods: field-ray 732, female-landmark-cun 77, female-landmark-level 4, female-landmark 6, field-closest 8, field-carried 7.
  - No `openAirFix` remains.
- **What moved:**
  - Exactly 39 markers changed, all in the intended sets. The 3D moves match the report.
  - The 66 abdominal block markers and 7 region-reference markers are unchanged, and no other field changed.
- **ST17:**
  - 0.45 / 0.64 mm from my outer-face tip estimate and 0.67 / 0.73 mm from the apex furthest from the skin.
  - 2.67 / 2.65 mm from the nipple area centroid.
  - 3.07 / 3.53 mm outside the skin; mirror error 0.89 mm.
- **ST18:**
  - The sagittal renders show it at the inframammary fold, on the outer skin and 51.3 / 52.9 mm below the nipple.
  - My own crease criteria bracket it: the sharpest concave turn is 5.8 / 6.1 mm above, and the deepest point is about 4 mm below.
  - Open air: 355 / 376 of 1024 directions escape.
  - Visible from the front and from 15° above; hidden by the breast at 30°.
- **Same-level groups:** all exact.
  - Navel 0.9757 (GB26), pubic top 0.7950 (SP12, LR12), 4.3 B-cun below the navel 0.8203 (SP13).
  - 3 B-cun below 0.8673 (GB27), 4 B-cun below 0.8311 (EX-CA1), junction 1.2197 (CV16), inferior border 0.7705 (ST31).
  - Relations as claimed: SP12 is 25.3 mm below SP13, GB28 is 9.7 mm medial and 12.8 mm below GB27, GB26 is 113.6 / 114.3 mm below LR13.
- **Face consistency:**
  - Only HT2 ×2 sit on a face opposite the carried direction (129°, 166°).
  - No display offset points into the skin and none ends inside it (winding |w| < 1e-15).
  - Every marker is within 0.007 mm of its surface.
- **Open air** (my copy of the `tests/data.test.mjs` rule): 0 closed markers.
- **Front projections and GB26:**
  - All 16 front-projected markers land on the trunk or thigh; the next skin crossing is 184–233 mm deeper.
  - GB26 sits on the lateral trunk, with the arm 112–117 mm further out.
- **Other landmarks:**
  - Femoral artery claims confirmed (16.5 / 26.0 mm).
  - Inferior border of the symphysis: mine 0.7705–0.7730 against their 0.77046.
  - Patellar base end: identical to mine.
- **Files and tests:**
  - `data/anchors.json`, `public/models/acupoint-anchors.json` and `data/female-atlas-structures.json` match HEAD.
  - The four test files pass 27/27 (I assumed they are female-acupoints, acupoints, data and female-transport).
  - The implementer's negative test fails round 1 output on 6 of 7 gates, with 21 G6 failures, as claimed.

My scripts and outputs are in `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/female/verify-acu2/`. The main ones are `chest.py` (defect 1), `thighrel.py` (defect 2), `pelvis.py` (defect 3), `faces.py`, `openair.mjs`, `crease.py`, and the renders `sag-right.png`, `sag-left.png` and `navel-level.png`.