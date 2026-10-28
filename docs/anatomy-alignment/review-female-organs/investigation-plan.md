# Female organ display and female approximations: implementation plan

All paths below are under `/Users/nuinuri/workspace/anatomy/` unless they start with `/private/tmp`. No repo files were changed.

## 0. What I checked myself, and corrections to the investigators

**Confirmed by reading the code and data**

- **Breast layer.** All 16 breast parts (HRAF0004–0019) have layer `skin` and hierarchy `[integumentary, 유방, breast]` in `data/female-atlas-structures.json`.
  - The skin fades from 8% to 20% (`src/dissection.ts:16`) and is cut by a clip plane from 8% to 20% (`src/anatomy-rendering.ts:55`). So the breast gland is never drawn after 20%, or in '장기만 보기'.
- **One organ colour.** Every female organ is drawn `#a94d60` (`src/PackedAtlas.tsx:43,203`). Only the male renderer tints organs by name (`src/Atlas.tsx:298-309`).
- **Guard.** `src/packed-source-guard.ts:26-28` throws if a catalogue layer differs from `packedSystemLayer[system]`. A naive runtime layer change would therefore stop the female model loading.
- **Concept sets.** `public/models/female/atlas-female.json` gives:
  - HRA:reproductive_system 46 − HRA:placenta 8 = 38.
  - Removing HRA:broad_ligament (5) and HRA:uterovesical_pouch (1) leaves 32.
  - HRA:mammary_lobes_L/R, main_lactiferous_ducts_L/R and main_lactiferous_sinuses_L/R map to HRAF0008/0018, 0009/0017 and 0010/0016.
- **Korean labels (runtime catalogue).** 9 of 38 reproductive parts and 0 of 16 breast parts have one.
- **Region.** HRAF0423–0426 and 0428–0431 have no group, so their runtime region is `abdomen`.
- **Modesty false matches.** I ran `isGenitalStructure` over the runtime catalogue. Beyond the intended genital structures it hides 10 female structures (8 FT lip vessels and 2 FT nasolabial nodes). In the male it hides 13 (FMA59815nsn lips, FJ3907, FJ3946, 8 ZA labial vessels, 2 nasolabial nodes). The urethra FMA19667 is hidden on purpose by ID.
- **Contradicting UI text.**
  - `src/anatomy.ts` stageDescription, organ: says '위·식도·부신·갑상샘은 전신 모형에 없습니다'.
  - Same function, skin: says '…표식을 표시하지 않습니다'.
  - `src/AnatomyControls.tsx:21`: same problems.
- **Docs that no longer match.**
  - `FEMALE_TRANSPORT.md:108` says the placement overwrites the cord corrections. Measured: placement covers arm 60/60 and cord 0/15.
  - `docs/anatomy-expansion/IMPLEMENTATION.md:79` and `SOURCE_GAPS.md:19` are out of date.
- **Proposed reproductive colour `#a46aa8`.** CIEDE2000 is 18.6 from the organ colour and at least 18.6 from every scene and emphasis colour (ligament 26.8, modesty cover 27.5). Contrast against `#07141c` is 4.62.
- **Provenance fetched today.**
  - HRA mammary gland v1.1 `metadata.yaml`: "created using a custom sculpted model to include relevant anatomy for placement of registration blocks" (Krstić 1991, Gilroy 2008; reviewer Nakshatri; 2024-06-15).
  - HRA uterus v1.2 and ovary v1.3: "created using data from the Visible Human Dataset".
  - The donor is 59 years old (`BONEHUB_FEMALE_SOURCE.md:11`).
- **WHO 2008 female notes** in the scratch `who.txt`: ST17 (p.54), ST18 (in females, midpoint of the lower breast crease), GB24 (p.183, midclavicular line × 7th intercostal space), LR14 (p.202, midclavicular line × 6th intercostal space).
- **Hash pins that bind the plan.**
  - `tests/muscle-peel.test.mjs:42` checks the SHA-256 of `src/dissection.ts`, `src/Atlas.tsx` and `src/PackedAtlas.tsx` via `docs/anatomy-alignment/muscle-peel-audit.json`. Re-run `node scripts/audit-muscle-peel.mjs` after editing any of them.
  - `data-visible-skin == 20` is asserted in `tests/browser/anatomy.spec.ts:74`, `details.spec.ts:142,159` and `sex-switch-loading.spec.ts:49`.
  - `tests/female-composite.test.mjs` asserts exactly 3 composite groups that do not overlap organ groups. A reproductive bundle must not go into `data/female-composite-groups.json`; the organ-display investigator suggested that file, and it would break the test.
- **Cached source.** The official v1.10 GLB is already cached at `.cache/neural-bone/hra-united-female-v1.10.glb`.

**Corrections and caveats**

- `anchor-outside.mjs` used a 7-direction parity vote. The project's rule is the open-air test in `tests/data.test.mjs:179-192`; parity fails when rays pass through other limbs. Both found the same 10 markers, but the committed test must use open air.
- Any "inside" vertex counts must use winding number. Normal-of-nearest-sample is on the rejected list.
- Pixel counts (`vis.json`, `sim2.json`) and crossing counts (1,245 pairs; breast 23; pelvic 39) come from the investigators' probes, and the crossings were measured on cached transport output. The committed audits in B2 must re-measure them and record input hashes.

**Diagnosis.** No female organ data is missing; the problem is display and navigation.

- **Uterus, ovaries and tubes** are loaded, but from the front HRA's own colon, omentum, peritoneal folds and bladder cover them at every opaque depth and in '장기만 보기'. They are also the same colour as the bowel.
- **Breast gland** is filed under skin, so it is clipped or hidden.
- **Search:** common Korean terms (나팔관, 난관, 유선, 젖샘, 유두) find nothing.

## 1. This session, Phase A (must): make female organs visible and findable

### A1. Organ colours by source group, with one reproductive colour for both bodies

**Files**
- `src/anatomy-rendering.ts`: add `REPRODUCTIVE_COLOR "#a46aa8"` and `organTone(entry)`.
- `src/PackedAtlas.tsx:203`: use `organTone` for the organ layer.
- `src/Atlas.tsx` `clinicalColor`: add the male reproductive set (the 12 `maleOnlyStructureIds` in `src/anatomy.ts`).
- `src/design-system.css` (token) and `src/atlas.css` (swatch).
- `src/AnatomyControls.tsx`: swatch, name and count in 표시 설정, following the Q27 pattern.

**Behaviour**
- Female parts with `hierarchy[0] === "reproductive"` (38, pregnancy excluded) and the 12 male genital and prostate IDs get the reproductive colour.
- Female heart, lung, liver, kidney and intestine get the male palette by group ID, not by name.
- Omentum, mouth and teeth keep the default.
- Precedence is unchanged: selection cyan > highlight gold > skin tone > connective > vein > borrowed bone.
- No `view-state` path is involved.

**Tests**
- New `tests/organ-tone.test.mjs`: CIEDE2000 ≥ 11.6 against every scene and emphasis colour (reuse the de2000 code from `tests/connective.test.mjs`); membership is exactly 38 + 12.
- Re-run the audit-muscle-peel script, then `tests/muscle-peel.test.mjs`.
- Browser, new `tests/browser/female-organs.spec.ts`: in female '장기만 보기', HRAF0435 colour differs from HRAF0521 colour. Male FMA7211 uses the reproductive colour.
- `tests/browser/face-surface.spec.ts` must stay green.

**Docs:** Q23 amendment and evidence row.

**Risks**
- Male visuals change after the skin peel.
- The colour is an editorial display colour, not tissue colour. Colour is never the only cue: legend and names stay.

### A2. Mammary glandular parts on the organ display layer (needs user decision D1)

**Files**
- New `data/female-display-layers.json`: 6 rows `{id, sourceConcept, system:"integumentary", layer:"organ", reason}` for HRAF0008/0018, 0009/0017, 0010/0016.
- `src/anatomy.ts`: apply after the existing annotations. Keep the group and hierarchy. The description says the display layer differs from the source system, and that HRA's breast is a sculpted reference model, not the donor's segmented tissue.
- `src/packed-source-guard.ts`: allow a mismatch only for listed IDs whose manifest system and concept match. Throw otherwise.
- `src/anatomy-rendering.ts` SURFACE_TONES: add ducts and sinuses HRAF0009/0017/0010/0016. Their vertices reach up to 3.55 mm outside the skin (`BODY_CONTAINMENT.md:37-41`).
- `scripts/audit-female-show-through.mjs`: add the same 4 to its toned set. Re-run with `--write` and `BASELINE=1`.

**Behaviour**
- At 0% the gland is under the skin.
- From 20% to 76–84% it stays visible with the organs, and it shows in '장기만 보기'.
- Fat, areola, nipple, tubercles and suspensory ligaments stay `skin`.
- The hash-pinned catalogue is untouched. `fit.py` keys on system, so no refit is needed.

**Tests**
- `tests/sex-source-boundary.test.mjs`: build the runtime catalogue and check that the guard accepts exactly these 6 IDs and rejects any other remap or a system mismatch.
- New unit test: the override IDs equal the concept elements, and English names are unchanged.
- Update `data-visible-skin` from 20 to 14 at the 4 sites listed in §0.
- Browser: HRAF0008 has visible pixels > 0 at 22% chest-front and in '장기만 보기'.
- Record the FT pectoralis major visible pixels at 30, 45 and 60% before and after.
- Re-run `tests/female-transport.test.mjs` (show-through).

**Docs:** `BODY_CONTAINMENT.md`, `FEMALE_ORGAN_NAVIGATION.md` (new section), Q24 note "display classification, not tissue depth".

**Risks**
- The gland covers part of pectoralis major during the muscle stage. This mirrors how male external genitalia stay over the muscles; the probe measured testes and penis visible from 20% to 76%.
- In '장기만 보기', lung pixels drop 7.6% and heart 6.5% from the front.
- This is an editorial classification (TA98 integument vs HRA reference organ).
- Fallback if declined: skip A2. A3 alone still makes the gland reachable.

### A3. Detail sub-views

**Files**
- New `data/female-reproductive-views.json`, kept out of the composite file:
  - `female-reproductive` '여성 생식기관': 38 IDs.
  - `female-reproductive-organs` '여성 생식기관 · 복막 주름 제외': 32 IDs.
  - Each lists its `sourceConcepts`.
- `src/anatomy.ts`: add `femaleBreastViews` = [breast, {id `breast-gland`, '유방 · 젖샘 구조', breast IDs minus HRAF0004/HRAF0012 = 14}]. Add the reproductive views to `structureGroups`, and the 38-ID view to `organGroups` so it is listed and searchable (D6).
- `src/AtlasPage.tsx:558-568`:
  - Make `viewOptions` and `bundleIs` use the view's own sex instead of `state.sex === "male"`.
  - Breast card: '젖샘 구조 보기' / '유방 전체 보기'.
  - Uterus, ovary, uterine-tube and vagina cards: '생식기관 함께 보기' / '복막 주름 빼고 보기'.
  - Card text: provenance; external genitalia, perineal muscles, female urethra and ovarian vessels are in neither source; the transported pelvic-wall vessels and muscles cross these surfaces (counts from B2).
- `src/anatomy-region.ts`: map the new view IDs (chest / pelvis).

**Routing:** always `selectFeatured` → `view-state` `detail`; closing uses `detail-close` and `detailReturn`, which restores the prior view and camera.

**Tests**
- `tests/view-state.test.mjs`: detail IDs are 14 / 38 / 32; close restores; reload (Q5) restores; restoreView repairs an unknown ID.
- New membership test: concept arithmetic against `atlas-female.json`.
- Browser: 유방 → 젖샘 구조 shows HRAF0008/0018 (probe: 7392/9190 px) → back → 전신. 자궁 → 생식기관 → 복막 주름 빼고 shows HRAF0436.
- `details.spec.ts` (add the new featured group to its loop), `detail-layout.spec.ts`, `organ-region.spec.ts`; screenshots at 390×844 and 844×390.

**Risk:** card space on phones (check with audit:overlays).

### A4. Korean search aliases and runtime labels

**Files**
- New `data/female-organ-aliases.json`, for example:
  - uterine-tube: 나팔관, 난관, fallopian tube.
  - breast: 유선, 젖샘, mammary gland.
  - female-reproductive: 생식기관, reproductive.
- `src/search-rank.ts` `organScore`: exact alias match = 0; alias contains a query of ≥ 2 characters = 1.
- New `data/female-reproductive-labels.json`: 29 reproductive + 16 breast parts. Each label is the current KMA term with the older term in parentheses, e.g. '왼쪽 젖꼭지(유두)', '왼쪽 젖샘엽(유선엽)', '자궁넓은인대(광인대)'. Then substring search finds both forms.
- Apply the labels in `src/anatomy.ts` through a validator that throws if the English name differs (same pattern as `pelvicStructureDisplay`).
- English names and HRAF IDs stay in every result row. No IDs are invented.

**Tests**
- `tests/search-rank.test.mjs`: 나팔관/난관 → uterine-tube first; 유선/젖샘 → breast; 유두 → HRAF0006/0014; the 위/stomach/FMA7148 exact-first cases unchanged.
- Label test: English unchanged; the labelled set is exactly 29 + 16.
- Browser: search on a phone.

**Docs:** `FEMALE_ORGAN_NAVIGATION.md` naming limitation (editorial, unreviewed; cite the KMA edition); Q7/Q37 evidence.

### A5. Region membership

**Files:** `src/anatomy-region.ts` `sourceOrganRegion`: a female structure with `hierarchy[0] === "reproductive"` → `pelvis`. This fixes HRAF0423–0426 and 0428–0431, which are currently matched by bounding-box height (they vanish in 골반 and appear in 배/상체).

**Tests:** `tests/organ-region.test.mjs`: all 38 match pelvis and lower-body, none match abdomen or upper-body; restoreView repair. Browser: `organ-region.spec.ts`, `anatomy-region.spec.ts`.

**Docs:** `ORGAN_REGIONS.md`, whose HRAF0431 limitation is now corrected.

### A6. Correct the text and the modesty pattern

**Files**
- `src/anatomy.ts` stageDescription:
  - Organ: the 6 transported organs (위·식도·부신·뇌하수체·갑상샘·부갑상샘) are drawn as FT approximations; the CT stomach, oesophagus and adrenals are a separate body; the pelvic organs sit behind bowel and peritoneum in HRA, so view them in '기관 상세'.
  - Skin: '기본으로 숨기며 ‘근사 위치로 보기’로 켤 수 있습니다(검수 전)'.
- `src/AnatomyControls.tsx:21`: same corrections.
- `src/modesty.ts:14`: use word boundaries, e.g. `\bclitor|\blabi(a|um)\b|\bvulv`. Keep the HRAF0406 ID rule.

**Tests**
- New stage-text unit test.
- `tests/modesty.test.mjs`: FMA59815nsn, the ZA and FT labial vessels, nasolabial nodes and FJ3907/FJ3946 are not genital. Female genital = {HRAF0406}; the male set is otherwise unchanged.
- `node scripts/check-readability.mjs`.

## 2. This session, Phase B (should): reduce approximations, with evidence and disclosure

### B1. Organ sub-peel inside the organ window (only if a citable dissection-order source is recorded; otherwise defer)

**Files**
- `src/dissection.ts`: `organPeelOpacity(depth, rank)` plus an `organPeelSources` map.
  - Rank 0 = HRA:omentum, HRAF0445, HRA:small_intestine, HRA:colon; male FMA7206/7207/7208/14543nsn/14542 taken from the `female-comparison-counterparts` mapping. Fades 76→78.
  - Rank 1 = HRA:uterovesical_pouch and HRA:broad_ligament. Fades 78→79.
  - Rank 2 = all other organs. Fades 79→84.
  - `peelEnd.organ` 76 → 79 (Q42 amendment; muscle 56 is the precedent).
- Apply it next to `musclePeelOpacity` in `src/PackedAtlas.tsx:178` and `src/Atlas.tsx:~403`, progressive peel only.

**Routing:** unchanged `view-state` `peelScene`/`peelLimit`.

**Tests**
- `tests/dissection.test.mjs`: monotone, inside 76–84, outside-first holds at system level.
- `tests/system-exclusion.test.mjs` `LIMIT.organ` = 79; `system-exclusion.spec.ts` for both bodies.
- Pixel probe: at 79% pelvis-front, the uterus shows ≥ 60% of its unoccluded pixels (simulated 1753/2452).
- `npm run test:geometry`; rehash with audit-muscle-peel.

**Risks**
- Male visuals change between 76% and 79%.
- The ovaries stay partly covered by the FT external iliac vessels and nodes (106/724 px); record it.

### B2. Audit: transported structures × HRA organ surfaces

**Files**
- New `scripts/audit-female-transport-organ-crossings.mjs`, built from the scratch probes and using three-mesh-bvh. It records SHA-256 of the cache inputs and of the shipped GLBs, and notes the Draco quantisation difference.
- Output: `docs/anatomy-alignment/female-transport-organ-crossings.json`.
- New `tests/female-transport-organ-crossings.test.mjs`: pins the counts and fails if they rise. Probe baseline: 401 structures × 174 surfaces, 1,245 pairs; breast 23; reproductive 39 × 20.
- Add inside-vertex counts for the ovaries, vagina and bladder (winding number).
- Card and doc disclosure: transported chest-wall and pelvic-wall structures cross these organs (N pairs).

**Docs:** new limitation section in `FEMALE_TRANSPORT.md`.

**Risk:** a triangle crossing shows the surfaces intersect, not how deep; normal contacts are counted too.

### B3. Female acupoints: open-air check and provenance

**Files**
- `scripts/build-female-anchors.mjs`:
  - Add the open-air test from `tests/data.test.mjs:179-192`.
  - Move closed markers to the nearest open-air outer-skin point within 10 mm, using the cached visible-skin samples.
  - List any remaining exceptions with a reason (the male ones are HT2/LR10/LR11).
  - Add `method` and `breastSurfaceProjection` (28 markers / 16 points within 12 mm of HRA breast fat). Keep `status: "approximate-unreviewed"`.
- `src/AtlasPage.tsx` point card and tooltip: show the method, plus a breast note: the chest-wall point is projected onto the breast surface; female rule not applied; unreviewed.
- Male files are untouched.

**Tests**
- New `tests/female-acupoints.test.mjs`: open-air with listed exceptions (today 10 fail: LI7 L, SP2 R, HT2 ×2, HT9 ×2, BL66 ×2, EX-UE11-4 ×2); 834 markers and 409 names; every marker has `method`.
- Record, without enforcing, the symmetry and spacing summaries.
- Browser: `female-transport.spec.ts`.

**Hash note:** `public/models/acupoint-anchors-female.json` is not unit-pinned, but its public SHA in `FEMALE_TRANSPORT.md` must be re-recorded after deploy.

### B4. Abdominal block from WHO rules (gated experiment, decision D4)

- **Points:** CV2–CV15, KI11–KI21, ST19–ST30, SP14–SP16 (about 66 markers).
- **Vertical landmarks, all HRA-native:**
  - Navel pit at y 0.975, checked within 2 mm of the HRAF0000 centroid.
  - Pubic symphysis top at y 0.797.
  - Xiphisternal junction from the width step of the HRA sternum, ±1 cm.
- **Spans:** navel to pubic symphysis = 5 B-cun; navel to xiphisternal = 8 B-cun.
- **Lateral reference** (editorial; needs a decision):
  - Option 1: HRA nipples 8 B-cun apart (Lv 2022).
  - Option 2: midclavicular line, from the borrowed clavicle.
- **Projection:** from the front onto the open-air skin.
- **Files:** a landmark module, `data/acupoint-rules.json` transcribed from the WHO text, an evaluator and a merge into `scripts/build-female-anchors.mjs`. Method value: `female-rule`.
- **Adopt only if all hold, otherwise record and do not ship:**
  - CV8 and CV2 are within 5 mm of their landmark (today 40.7 and 40 mm).
  - Order along each line is monotone, including across the boundary with the unchanged chest and thigh points.
  - Left/right symmetry ≤ max(5 mm, landmark asymmetry + 3 mm).
  - Spacing stays within 0.7–1.4 of the regional ratio.
  - All markers pass open air.
- **Disclosure:** '여성 기준점·WHO 비례촌으로 계산한 근사 · 가로 기준은 편집 선택 · 검수 전'.
- **Male markers are never moved.** Give the reviewer a male QA list instead (male CV8 is 15 mm and CV2 24 mm from their own definitions).

### B5. Doc corrections

- `FEMALE_TRANSPORT.md:108`: drop "척수".
- `docs/anatomy-expansion/IMPLEMENTATION.md:79`: update (342 ligaments are now transported).
- `SOURCE_GAPS.md:19`: mark as superseded by the 12 transported organs.
- `FEMALE_ARM_PARTIAL_REGISTRATION.md`, FOREFOOT and THUMB docs: add a header saying the field placement replaced them (2026-10-04).
- Removing the overwritten arm and foot code is a separate change with hash regressions; not this session.

## 3. Phase C (could, if time remains)

- Re-audit organ–bone and airway–bone crossings with placement applied (`scripts/audit-female-organ-bone-relations.mjs`). The current 177 and 7 pairs predate the field.
- Measure the simplification error of the 38 reproductive + 16 breast meshes against the cached official v1.10 GLB. Restore only if the error is large.
- Make the HRA crosswalk FMA/UBERON IDs searchable, with a receipt and SHA-256 (Q12).
- Provenance notes, with no clinical or causal claims and no rescaling:
  - Uterus/ovary: "Visible Human Female, 59 years; geometry unchanged".
  - Allen brain: a different adult female.
- Short card notes for skin-toned structures and for the companion-vessel gaps.

## 4. Gates, screenshots and docs

**Order of gates**
1. Targeted unit tests per step: the files named above plus `tests/female-composite.test.mjs`, `tests/female-additional-organ-groups.test.mjs`, `tests/connective.test.mjs`, `tests/face-surface.test.mjs`, `tests/acupoints.test.mjs`, `tests/data.test.mjs`.
2. After all `src` edits: audit-muscle-peel, the show-through audit with `--write`, then `npm test` as the recorded unit gate.
3. `npm run build`, then `npm run test:production`. Never build while browser specs are running (HMR on :5174).
4. Browser specs only, with `PLAYWRIGHT_GPU=1 npx playwright test --workers=1`:
   - details, sex-switch-loading, anatomy, organ-region, anatomy-region, female-transport, female-pelvic-bindings, face-surface, detail-layout, navigation, first-frame, the new female-organs spec;
   - system-exclusion and muscle-peel if B1 lands.
   - The full suite (about 29 min) only on explicit approval.
5. `node scripts/check-readability.mjs`, `npm run test:visual`, `npm run audit:overlays`, including the 1024×680, 1280×720 touch and 1180×580 sizes.

**Screenshots to inspect at 1440×900, 390×844 and 844×390**
- Female pelvis at the organ depth.
- Female '장기만 보기'.
- 유방 → 젖샘 detail.
- 생식기관 → 복막 주름 제외 detail.
- Search for 나팔관.
- Approximate acupoints on the chest and abdomen.
- Male organ-only, for regression after the tint.

**Docs**
- `docs/VERIFICATION.md` (new top entry).
- `docs/QUALITY_STANDARD.md`: new Q43 (female-specific organs visible and findable) with an evidence row; amendments to Q23, Q24, Q26, Q32 and Q7/Q37; Q20/Q42 only if B1 lands.
- `docs/ui-renewal/COMMERCIAL_COMPARISON.md`: record only patterns observed in public demos, or state that no new observation was made.
- `FEMALE_ORGAN_NAVIGATION.md`, `ORGAN_REGIONS.md`, `BODY_CONTAINMENT.md`, `FEMALE_TRANSPORT.md`; new `docs/anatomy-alignment/FEMALE_ACUPOINT_LANDMARKS.md` if B4 runs.
- Record every failed run as it happened.

**Hash pins**
- `data/female-atlas-structures.json` (sha 4affd375…) is never edited; every change is a runtime overlay.
- No field refit this session, so the transport GLBs, placement and field hashes and the brain and pelvic manifest pins stay as they are.

**Publishing:** commit and push only when the user asks. After that, run `scripts/smoke-pages.mjs`, `scripts/check-female-transport-pages.mjs` and `audit:overlays` against SMOKE_ORIGIN.

## 5. Dropped or flagged

- **MOOSE stomach non-rigid fit: dropped.** The rigid placement already crosses 10/13 neighbours versus 2/13 for the transported stomach. High risk.
- **Reproductive bundle in `female-composite-groups.json`: rejected.** It breaks the composite test; use a separate views file.
- **Suspensory ligaments into the gland view: not adopted.** They stay with the integument.
- **"Small uterus because postmenopausal" as UI text: not allowed.** State donor provenance only.
- **Breast-area acupoints (ST15–19, KI22–24, CV15–18, LR14, GB24, PC1, SP17):**
  - Not moved this session.
  - Moving ST17 alone would invert the ST16–ST18 order.
  - In this donor the nipple is at the 6th-intercostal level, which conflicts with WHO's male rules and the LR14 note.
  - Flag and disclose only.
- **Transport refits with organ obstacles or a breast-underside constraint: not this session.** See F1.
- **Rejected transport methods: none re-proposed.**

## 6. Follow-ups that need downloads, experts or separate approval

- **F1. Field refit** (in repo, L, separate approval). Add organ and breast non-crossing penalties as obstacles, with no new vessel correspondences.
  - Success: breast crossings 23 → 0; pelvic crossings below the B2 baseline; Q31 held (held-out skin and own-bone medians 2 / 2.5 mm, folds < 0.02%, 47 junctions within 5 mm).
  - Everything pinned must be regenerated: 8 GLBs, placement, manifest, fit record, female anchors, docs, public check.
- **F2. BoneHub female thorax** (ribs, sternum, clavicles, scapulae; in repo, L). This unlocks female intercostal spaces for chest acupoints; Allen re-fit (F11) depends on it.
- **F3. Expert review packages:**
  - the 45 Korean labels and aliases;
  - breast display classification;
  - dissection-order source for B1;
  - acupoint operational rules (lateral reference, ST17/ST18 female rules, the six-lumbar-vertebra L6 issue, breast-region points);
  - the male QA list.
- **F4. TotalSegmentator open tasks** (Apache-2.0; weights download) run offline on the VHF CT: breasts, abdominal_muscles, body, total. Candidates only; they must pass the same audits.
- **F5. CheRa female muscles** (CC BY 4.0; the user must download). Check whether it includes perineal muscles.
- **F6. Missing female structures:** external genitalia, perineal muscles, female urethra, ovarian vessels.
  - No open source exists: HRA v1.10 is the latest (CDN v1.11/v2.0 return 404 as of 2026-10-25).
  - Visible Korean, ICRP-145, IT'IS Ella and SMPL-X are unusable because of their licences.
- **F7.** Denver VHF leg-muscle field (L, high risk).
- **F8.** Source restoration of reproductive and breast meshes, if C2 shows large simplification error.
- **F9.** Spinal cord centreline from BoneHub CT (needs an expert).
- **F10.** Memory note for the orchestrator: figshare API and ndownloader now return 200; only the HTML pages show a 202 challenge.

## 7. Decisions needed from the user

- **D1.** Move the breast gland to the organ layer (A2)? Yes, or detail sub-view only?
- **D2.** Apply the reproductive colour to the male too, or female only?
- **D3.** B1: which dissection source, and should the same order apply to the male?
- **D4.** B4 lateral reference: nipples or midclavicular line? Or hold B4 for expert review?
- **D5.** Should '성기 가리기' keep hiding the internal vagina mesh HRAF0406?
- **D6.** Show '여성 생식기관' as a listed '기관 상세' entry, or only from the organ cards?

Scratch files from this pass are in /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/female:
- syn-modesty2.mjs
- syn-de.mjs