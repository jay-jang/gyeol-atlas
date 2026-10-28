**Verdict: ship-with-fixes.** The abdominal block is correct: the WHO transcription, landmarks, gate numbers, tests and file scope all check out. Two problems need fixing before it ships, and neither is gated or recorded today:
- Fixing only the block breaks WHO "same level" relations with points just outside it.
- The open-air "fix" covers up 8 markers that sit on the wrong face of a body part.

## Defects

**1. New height mismatches with unchanged neighbours (medium).** WHO puts each of these at the same level as a block point. They were close before and are now 27–51 mm apart (marker height difference, before → now):

| Pair | Before | Now |
|---|---|---|
| GB26–CV8 | 0.6 / 3.2 | 38.6 / 41.2 |
| GB26–SP15 | 2.3 / 5.4 | 38.6 / 41.2 |
| LR12–ST30 | 0.9 / 1.1 | 49.5 / 50.8 |
| SP12–CV2 | 11.4 / 11.2 | 50.6 / 50.3 |
| EX-CA1–CV3 | 15.7 / 16.1 | 39.8 / 40.2 |
| GB27–CV4 | 6.6 / 10.1 | 27.2 / 30.7 |

- LR12 (0.8445) and SP12 (0.8456) now sit above ST29/CV3 (0.8311), although WHO puts them level with CV2.
- EX-CA1 (자궁) now sits about level with CV4 instead of CV3.
- `knownBoundaryFailures` lists only ST31 and SP13, and G6 checks neighbours on the same line only.
- **Fix:** apply the same cun rules to SP13, LR12, SP12, EX-CA1 and the GB26/GB27 levels, or record these pairs and gate them.

**2. The open-air fix hides misplaced markers (medium).** The 10 markers keep their old skin points; only the 3 mm display offset was turned round. That makes the open-air check pass. In 8 of them the skin point is on the face opposite the carried outward direction, 116–166° away from it:
- **HT2 ×2** sit on the lateral chest wall, not the medial upper arm. The nearest bones are the 7th/8th ribs (34–37 mm); the marker faces the arm across the gap, and no skin lies within 30 cm behind it.
- **HT9 ×2 and EX-UE11 site 4 ×2:** the carried point is inside the little finger. The build took the nearer, far-side face (2.5–5.6 mm away) instead of the face matching the carried direction (7.1–9.1 mm, alignment 0.78–1.0).
- **BL66 ×2** are on the far side and nearest the 3rd/4th toe distal phalanges (3.0–4.8 mm), not the 5th metatarsophalangeal joint. Female BL65 and BL67 also sit on the 4th toe; that error is inherited.
- LI7 L and SP2 R are grazing cases (95–104°) and ambiguous.
- The report's "no remaining exceptions" therefore removes a real warning.
- **Fix:** re-project these to the hit that faces the carried direction, or keep them as listed exceptions with reasons.

**3. ST19 sits on the underside of the breast (low).** The face normal points down (y −0.51/−0.55) and about 49 mm of breast fat (HRAF0004/0012) lies behind it on the projection ray. The report's "skin next to the breast" understates this; the limitation wording should say so.

**4. Report inaccuracies (low).**
- ST14 is flagged as breast surface on the right only, like KI25; the report implies both sides.
- The "old median 38.5 mm" uses the upper of the two middle values; their mean is 37.15 mm.

**5. Fragile gate (low).** The CV15–CV16 spacing ratio is 0.714 against a 0.7 limit, a 0.45 mm margin. Carried CV16 sits 9.96 mm below the measured xiphisternal junction.

**6. Not checked by the implementer (info).**
- The carried femoral artery at the pubic-top level is at x −74.8 / +67.8 mm, against ST30 at ±54.8 mm. The carried artery inherits the field error.
- Measuring vertical cun along the skin of the median line instead of as height would move CV3–CV7 by up to 3.9 mm, and by 1.5 mm or less above the navel.

## Measured numbers

**(a) WHO transcription:** all 40 rules match `who.txt` and `data/points.json`: point set, vertical cun, scale, lateral cun, quote text and PDF page. No mismatches. KI15's WHO wording ("inferior to umbilicus") and CV2's "superior to the pubic symphysis" are handled correctly; the Korean excerpt for CV2 says 두덩결합 위모서리.

**(b) Landmarks, by my own method:**

| Landmark | Mine | Implementer |
|---|---|---|
| Navel, depth-weighted centre | (0.00005, 0.97581, 0.07673), pit 1.7–2.5 mm | (0, 0.9757) |
| Pubic symphysis top | y 0.79456–0.79562 depending on tolerance | 0.79496 |
| Xiphisternal junction, largest width step | 1.2197–1.2207 | 1.21974 |

- Navel: deepest point (−0.001, 0.9755). Male navel (−0.00085, 0.98878).
- Pubic symphysis: left/right tops 0.7924–0.7945 / 0.7967.
- Xiphisternal junction: the 7th costal cartilage ends span 1.214–1.227. Male width step is 1.2005 against the explicit boundary at 1.2026.
- Nipples: area centroids match exactly. Inter-nipple distance is 219.3 mm, level within 0.66 mm.
- Median line: −0.2 to +0.5 mm.
- Cun: upper 30.52, lower 36.25 (theirs 36.15), lateral 27.42 mm.

**(c) Gates, re-measured from the female anchor file:**
- **G1:** CV8 is 0.00 mm from their navel, 0.13 mm from mine and 1.02 mm from my deepest point. CV2 is 0.01 mm from the pubic top on the median line, 2.94 mm from the bony centre, and 0.4 mm above my pubic top.
- **G2:** with their median line, median 0.00 and max 0.01 mm. With a constant median line, max 0.61 mm. Every block marker is the outermost skin hit (z error 0.01 mm or less). Display offset is 3.00 mm and faces the front.
- **G5:** with their median line, median 0.10, p90 0.37, max 0.39 mm. With a constant line, median 0.21 and max 1.28 mm (n 26).
- **G6:** all lines are in order. Spacing ratio min 1.00, median 1.04, p90 1.11, max 1.17 (n 59). Boundary checks match the report exactly: ST31 is 0.0 / 2.7 mm off ST30, SP13 ratio 0.46, and SP13 is 59.9 / 60.6 mm from its own rule target.
- **Open air** (my own copy of the `tests/data.test.mjs` rule):
  - The current file has 0 closed markers and none off the skin.
  - The previous committed version has 10 closed markers, the same list.
  - The skin is closed: all 88,008 edges are shared by exactly two faces. Winding number is 1 inside and 0 outside.
  - Before the fix, those 10 display positions were inside the skin; now they are outside.
- **Counts and provenance:**
  - 834 markers and 409 names; keys, sides, occurrences and point ids are in the male order.
  - Methods: 753 field-ray, 66 female-landmark-cun, 8 field-closest, 7 field-carried. Every marker has mode female-approximation and status approximate-unreviewed.
  - The 7 region-reference keys match the male file.
  - Breast flag: 28 markers, no mismatches.
- **Rebuild:** I ran a copy of the build with its output sent to my scratch folder. The result is byte-identical to the shipped file.

**(d) Changed files.**
- `git diff --stat` is empty for `data/anchors.json`, `public/models/acupoint-anchors.json` and `data/female-atlas-structures.json`; the last one's blob hash still matches HEAD.
- The allowed paths changed as reported.
- Other changes are `src/` (9 files) and three new data files (`data/female-organ-display.json`, `female-reproductive-labels.json`, `reproductive-groups.json`). They are organ and rendering work with nothing acupoint-related, presumably the other engineer's. I can't tell from git who wrote them.

**(e) Tests:** the four named test files pass, 27 of 27.

**(f) Markers outside the block that moved:** 17 in total.
- GV28 moved 64.8 mm, as intended when it became region-reference.
- EX-HN11 and EX-HN13 moved about 14.5 mm, and the other 4 region-reference markers 0.7–4.0 mm.
- The 10 open-air markers kept their skin points; their display positions moved 6.0 mm.
- No other marker or field changed.

Not done: the app is still not visually checked (no screenshots), and the requirement/evidence table in `docs/` is not updated.

My scripts and outputs are in `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/female/verify-acu/`. The main ones are `who_check.py`, `landmarks_check.json`, `gates.out`, `openair.json`, `crossline.py` (defect 1) and `aspect.mjs` (defect 2).