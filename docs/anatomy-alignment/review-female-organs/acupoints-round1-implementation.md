The abdominal block is shipped: 66 female markers (CV2–CV15, KI11–KI21, ST19–ST30, SP14–SP16) are now placed from female landmarks and WHO cun. All block gates pass. The four named test files pass (27/27). The male files and `data/female-atlas-structures.json` are unchanged in git.

Two boundary checks against neighbours I did not touch still fail, both because the neighbour (still on the old transported position) is too high:
- **ST31:** level with ST30 (0.0 mm on the right, 2.7 mm on the left), not below it. WHO Note 2 puts ST31 at the inferior border of the pubic symphysis.
- **SP13:** 48 mm below SP14; WHO puts it about 108 mm below on this body (spacing ratio 0.46).

Both are recorded in `knownBoundaryFailures` in the rules file. The G6 test fails if the observed set of boundary failures changes.

I did not take app screenshots (the brief ruled out browser runs and the dev server), so per AGENTS.md this is not visually verified in the app. I checked only a static front-view render of the data (`/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/fa/viz.png`).

**Files** (no other paths touched)
- Edited: `/Users/nuinuri/workspace/anatomy/scripts/build-female-anchors.mjs`
- New: `/Users/nuinuri/workspace/anatomy/scripts/female-acupoints/scene.mjs`, `landmarks.mjs`, `rules.mjs` (same folder)
- New: `/Users/nuinuri/workspace/anatomy/data/female-acupoint-landmarks.json`, `/Users/nuinuri/workspace/anatomy/data/female-acupoint-rules.json`
- New: `/Users/nuinuri/workspace/anatomy/tests/female-acupoints.test.mjs`
- Regenerated: `/Users/nuinuri/workspace/anatomy/public/models/acupoint-anchors-female.json` (834 markers, same order, keys and sides; re-running gives identical bytes)
- The rules file was transcribed with a helper left in the scratchpad: `/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/fa/make-rules.mjs`

**Landmarks (female, metres, y up, +z front, body's right = −x)**

| Landmark | Value | How it was found |
|---|---|---|
| Navel centre | (0.00000, 0.97570, 0.07669), pit 2.0 mm deep | Skin pit seen from the front |
| Navel cross-check (HRAF0000) | 1.0 mm from its vertex centroid; **3.9 mm from its area/volume centroid** | Passes the 2 mm limit on the vertex centroid only |
| Pubic symphysis, superior border | (−0.00305, 0.79496), skin z 0.00982 | HRAF0958/HRAF0959; left/right tops differ by 3.5 mm, mean used |
| Xiphisternal junction | (0.00696, 1.21974), skin z 0.04414 | Width step of HRAF0823, 7.0 mm step |
| Junction alternatives | 1.22224 (second step), 1.22541 (borrowed 7th costal cartilages), 1.22972 (cartilages + male offset) | Treated as ±10 mm ambiguity |
| Nipples HRAF0014 (R) / HRAF0006 (L) | (−0.10963, 1.18489) / (0.10972, 1.18423) | 219.3 mm apart, level within 0.7 mm |
| Anterior median line | x ≈ −0.0001 | Mirror axis of the frontal skin profile (left/right mismatch 0.1–0.9 mm) |
| Landmark offsets from that line | navel +0.1 mm, symphysis −2.9 mm, junction bone +7.1 mm, nipple midpoint +0.2 mm | |

Proportions: junction→navel 244.0 mm, so **30.5 mm per upper cun**; navel→pubic top 180.7 mm, so **36.1 mm per lower cun**; lateral **27.4 mm per cun** (nipples/8). The midclavicular alternative is 21.2 mm per cun, which puts 0.5 / 2 / 4 cun at 10.6 / 42.4 / 84.8 mm instead of 13.7 / 54.8 / 109.7 mm.

On the male scene the same width-step rule lands 2.6 mm from the male's explicit xiphoid boundary. That supports the method.

Male comparison (report only, male markers not moved):
- Male landmarks: navel (−0.00087, 0.98882, 0.10704), junction 1.20003, pubic top 0.82725, 26.4 / 32.3 mm per upper/lower cun.
- The male markers sit 13–38 mm (median 19.5 mm) above the male rule targets. Male CV8 is 16.2 mm above the male navel and CV2 is 20.6 mm above the male pubic top.

**Rule table** (WHO 2008 wording, transcribed; U = umbilicus, XS = xiphisternal junction, PS = superior border of the pubic symphysis)

| Points | Vertical | Lateral |
|---|---|---|
| CV2 | level with PS | median line |
| CV3–CV7 | U −4, −3, −2, −1.5, −1 (lower scale) | median line |
| CV8 | centre of U | U centre |
| CV9–CV14 | U +1 … +6 (upper scale) | median line |
| CV15 | XS −1 (upper scale) | median line |
| KI11–KI15 | U −5 … −1 | 0.5 |
| KI16 | U | 0.5 |
| KI17–KI21 | U +2 … +6 | 0.5 |
| ST19–ST24 | U +6 … +1 | 2 |
| ST25 | U | 2 |
| ST26–ST29 | U −1 … −4 | 2 |
| ST30 | level with PS | 2 |
| SP14 | U −1.3 | 4 |
| SP15 | U | 4 |
| SP16 | U +3 | 4 |

Each rule also lists its landmarks and the choices that need expert review. One example: CV2's "superior to the pubic symphysis" is read as level with the bony border. Another: ST30's "over the femoral artery" is not checked. A third: ST19 Note 2 is not modelled.

**Before/after for the block, by point** (old = transported marker; values are R/L where paired)

| Point | Old → rule target, 3D (mm) | Old was higher by (mm) |
|---|---|---|
| CV2 | 42.4 | 39 |
| CV3 | 28.6 | 24 |
| CV4 | 24.2 | 21 |
| CV5 | 25.7 | 24 |
| CV6 | 29.5 | 28 |
| CV7 | 32.8 | 32 |
| CV8 | 40.2 | 38 |
| CV9 | 44.1 | 44 |
| CV10 | 40.8 | 39 |
| CV11 | 30.1 | 28 |
| CV12 | 18.0 | 17 |
| CV13 | 8.8 | 8 |
| CV14 | 5.9 | 4 |
| CV15 | 5.8 | 4 |
| KI11 | 47.0 / 47.6 | 43 / 43 |
| KI12 | 35.5 / 38.6 | 31 / 32 |
| KI13 | 28.3 / 33.0 | 25 / 26 |
| KI14 | 25.3 / 29.1 | 24 / 24 |
| KI15 | 27.7 / 31.9 | 27 / 28 |
| KI16 | 38.5 / 42.0 | 38 / 38 |
| KI17 | 47.1 / 48.1 | 45 / 45 |
| KI18 | 35.6 / 35.8 | 34 / 34 |
| KI19 | 24.5 / 24.2 | 24 / 23 |
| KI20 | 16.9 / 17.1 | 16 / 17 |
| KI21 | 15.8 / 17.7 | 15 / 17 |
| ST19 | 16.6 / 29.2 | 15 / 28 |
| ST20 | 14.1 / 19.2 | 13 / 19 |
| ST21 | 19.6 / 22.0 | 19 / 20 |
| ST22 | 32.3 / 34.3 | 30 / 29 |
| ST23 | 45.8 / 49.6 | 42 / 41 |
| ST24 | 49.0 / 54.2 | 44 / 43 |
| ST25 | 43.4 / 52.3 | 34 / 35 |
| ST26 | 42.4 / 49.6 | 35 / 35 |
| ST27 | 43.3 / 47.6 | 37 / 38 |
| ST28 | 49.5 / 53.8 | 45 / 46 |
| ST29 | 58.8 / 63.2 | 54 / 58 |
| ST30 | 51.1 / 52.6 | 49 / 50 |
| SP14 | 59.7 / 64.8 | 50 / 53 |
| SP15 | 65.4 / 70.7 | 36 / 36 |
| SP16 | 73.1 / 78.6 | 23 / 25 |

- **Old, all 66 markers:** 3D median 38.5, p90 59.7, max 78.6 mm; frontal-plane median 34.6, p90 51.2 mm.
- **New:** within 0.01 mm of the rule target in the frontal plane for every marker.

**Gate results**
- **G1:** CV8 is 0.00 mm from the navel centre. CV2 is 0.00 mm from the pubic top on the median line and 2.94 mm from the bony symphysis centre.
- **G2:** distance to rule target median 0.00, max 0.01 mm (n 66). Display offset is 3 mm and faces the front.
- **G5:** left/right mirror error median 0.10, p90 0.37, max 0.39 mm (n 26), limit 6.5 mm (max(5, 3.5 + 3)).
- **G6:** all lines are monotone. Within-block spacing ratio median 1.04, p90 1.11, max 1.17 (n 59).

| Boundary pair | Result |
|---|---|
| CV1 below CV2 | ok (13.4 mm) |
| CV15–CV16 | ratio 0.71, just inside the limit; CV16 sits 10.0 mm below the measured junction |
| KI22 above KI21 | ok (+55.0 / +72.7 mm) |
| ST18 above ST19 | ok (+56.5 / +82.3 mm) |
| SP17 above SP16 | ok (+138 / +144 mm) |
| ST30–ST31 | **fails**, see top |
| SP14–SP13 | **fails**, see top |

KI11 is level with CV2 by definition.
- **G7:** 0 closed markers and 0 exceptions. Every block marker is the outermost skin face in front of its target. This gate needs the `.cache` scene files, checks their SHA-256 against the landmarks file, and is skipped if they are missing.
- **G9:** 834 markers, 409 names, male key/side order, every marker has a method, mode `female-approximation` and status `approximate-unreviewed`.
- **Breast flag:** 28 markers within 12 mm of HRAF0004/HRAF0012 get `breastSurface: true`. These are ST14–ST19, KI22–KI24 and KI25 (right only), SP19, SP20, PC1, GB24 and LR14. ST20 dropped out once the block moved it; ST19 is the only block point flagged.

**Open air:** with the full male rule, the same 10 markers failed (LI7 L, SP2 R, HT2 ×2, HT9 ×2, BL66 ×2, EX-UE11 site 4 ×2). In every case the skin point is on the visible outer skin. The old build had turned the 3 mm display offset to follow the carried direction, which pointed into the skin. The nearest open-air point is therefore the marker's own point. Each now has `openAirMoveMm: 0` and `openAirFix: "outward-normal"`. There are no remaining exceptions. The skin mesh is one closed shell wound outward (2999 of 3000 sampled faces open only on the outward side).

**Region-reference markers** (GV28, EX-HN9 ×2, EX-HN10, EX-HN11, EX-HN12, EX-HN13)
- They now use `method: "field-carried"` and `markerMode: "region-reference"`, and keep `mode: "female-approximation"`. The marker sits at the field-carried point, not projected onto the skin.
- Depth inside the skin: GV28 59.1 mm, EX-HN11 13.8 mm, EX-HN13 13.2 mm; the others 0.7–2.5 mm. Before, GV28 had been pushed 64.8 mm out onto the lip.
- GV28's carried point lands 0.4 mm from the tongue (HRAF0459), not at the upper-lip frenulum. That is inherited: the male GV28 itself sits 59 mm behind the male lip.
- The app needs no drawing change. `src/Atlas.tsx` draws markers without depth testing and uses position minus surfacePoint as the facing direction, which is how the male internal markers already show. The new fields are ignored by the app.

**Suggested UI wording** (the other engineer's call)
- Toggle tooltip: "배 부위 66개는 여성 배꼽·두덩결합·칼몸통결합 기준 골도분촌, 나머지는 남성 표식을 옮긴 근사 위치 · 검수 전 · 누르면 숨김"
- Note for `female-landmark-cun` markers: "여성 배꼽·두덩결합 위모서리·칼몸통결합과 두 젖꼭지 사이 8촌으로 계산한 근사 위치입니다. 전문가 검수 전입니다."
- Note for `breastSurface` markers: "유방 표면에 놓인 근사 표식입니다. 기준 위치는 유방 아래 가슴벽일 수 있습니다."
- Note for female region-reference markers: "입·코 안의 위치입니다. 남성 표식을 정합장으로 옮긴 내부 참조점이며 실제 위치가 아닙니다."
- The requirement/evidence table in `docs/` still needs updating; I was not allowed to edit `docs/`.

**Limitations to record**
- **Lateral scale is an editorial choice.** WHO's notes tie the nipple line to men, and for women place ST18 at the breast crease. Switching to the midclavicular alternative moves the 2-cun lines about 12 mm and the 4-cun lines about 25 mm.
- **Donor nipple** sits at about the 6th intercostal space / 7th rib (borrowed ribs), not the 4th. Only its left-right position is used.
- **Xiphisternal junction is ambiguous by about 1 cm** (the HRA sternum has no separate xiphoid). 1 cm moves CV15 by 8.75 mm and CV14/KI21/ST19 by 7.5 mm.
- The junction bone sits 7.1 mm off the skin's median line. The symphysis sits 2.9 mm off it, with 3.5 mm left/right asymmetry.
- The navel cross-check passes only on the vertex centroid (1.0 mm); the area centroid is 3.9 mm away.
- Vertical cun is measured as height in the front view, not along the skin; markers are projected straight back onto the skin.
- The six lumbar vertebrae don't matter here: no vertebrae are used.
- **Male seed errors are not corrected.** Every other female marker still carries them.
- Not checked: ST30 over the femoral artery; ST19's rib/infrasternal note. ST19 sits on skin next to the breast.
- **Large errors outside the block** worth a follow-up:
  - Female ST17 is 63 mm (R) and 94 mm (L) from the HRA nipple centres, though ST17 is defined as the nipple centre.
  - ST18 is above the nipple rather than at the breast crease.
  - KI22 and ST18 differ by 17.7 and 25.7 mm in height between left and right.
- Everything is still unreviewed.