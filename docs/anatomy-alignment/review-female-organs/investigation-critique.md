**Verdict: revise before implementing.** Most diagnostic claims hold up against the code and data. As written, though, Phase A does not make the uterus, ovaries or tubes visible in the overview, and A2/A3/A4/B3 contain test-breaking or wrong details. All paths below are under `/Users/nuinuri/workspace/anatomy/`.

**Claims I confirmed**
- All 16 breast parts are layer `skin` with hierarchy `integumentary`.
- The female renderer draws every organ `#a94d60` (`src/PackedAtlas.tsx:43`).
- The guard throws on a layer/system mismatch (`src/packed-source-guard.ts`).
- 38 reproductive parts, 9 of them with Korean labels; 0 of 16 breast labels.
- HRAF0423–0426 and 0428–0431 fail the pelvis box test and match 배/상체.
- Modesty false matches: 13 male, 10 female.
- The organ and skin `stageDescription` texts are wrong.
- The hash pins (`muscle-peel-audit.json`: `src/dissection.ts`, `src/Atlas.tsx`, `src/PackedAtlas.tsx`) and the four `data-visible-skin == 20` sites exist.
- `tests/female-composite.test.mjs` would break if a reproductive bundle went into `data/female-composite-groups.json`.
- `#a46aa8` is ΔE 18.6 from the organ colour, with contrast 4.62.

**1. Claims that are wrong or overstated**
- **B3 "add `method`":** `public/models/acupoint-anchors-female.json` already has `method` on all 834 markers (826 `field-ray`, 8 `field-closest`). Use a new value or a new field.
- **Colour distance "≥18.6 from every scene and emphasis colour":** the meridian marker palette was not checked. Distances are PC `#b77898` 9.9, TE 13.5, EX 16.2, GV 16.8 and KI 17.3. PC is below the repo's 10/11.6 thresholds. The new test must list its colour set explicitly.
- **Token location:** the atlas palette lives in `src/atlas.css` as `--ax-*`. `design-system.css` line 2 says so, and `tests/connective.test.mjs:150` asserts the CSS token equals the TS constant. Put `--ax-reproductive` in `atlas.css` with the same equality test, not in `design-system.css`.
- **A3 "map the new view IDs in `src/anatomy-region.ts`":** this does nothing. `sourceOrganRegions` is keyed by each structure's `group`, and opening a detail forces the region to `whole`. It would also add view IDs to the audited source-membership map. Drop it.
- **Breast-gland view membership contradicts itself.** "16 − fat = 14" includes the suspensory ligaments (HRAF0011/0019), nipple, areola and tubercles. §5 says the ligaments are "not adopted" into the gland view. The name '젖샘 구조' also does not fit the nipple or areola. Fix the membership or the name.
- **`src/AnatomyControls.tsx:21`** does not repeat the "위·식도·부신·갑상샘 전신에 없음" error. It only omits the transported organs and the '근사 위치로 보기' opt-in. "Same problems" is overstated.
- **F2 cites "F11"**, which is never defined.
- **C2/F8 (simplification error):** `public/models/female/atlas-female.json` already records meshoptimizer error ≤ 0.002 and 964 preserved meshes. Check whether the 54 meshes are in the preserved set before planning work.

**2. Root causes the plan leaves open ("female organs not displayed")**
- **Phase A does not fix the overview.** By the earlier probe (`/private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/female/organs/vis.json`), the uterus is 0/2452 px from the pelvis front at every opaque depth (0–76%) and in '장기만 보기'. A1 only changes colour.
  - If B1 is deferred for lack of a source, the user's complaint stays true in the overview. The plan must say so.
  - It should also add a non-B1 path routed through `view-state`. One option is a female organ-stage or pelvis shortcut to the 32-ID view via `selectFeatured`.
- **A1 colours the occluders.** The broad ligament, mesosalpinx, mesovarium and uterovesical pouch (HRAF0416, 0427–0431) would get the same purple as the uterus.
  - These folds are the main occluders. Hiding them alone raises the uterus from 0 to 399 px; with gut and omentum also hidden it reaches 1753 px.
  - The purple you would see in the overview is mostly broad ligament, which suggests a uterus that is not actually visible. Keep the folds a distinct tone.
- **The A1 browser test checks the wrong thing.** "HRAF0435 colour ≠ HRAF0521" passes even when the uterus is fully hidden. The acceptance test must count visible pixels per mesh ID (uterus, ovary, tube, gland) at the default view, pelvis-front and '장기만 보기', before and after.
- **Viewpoint is not addressed.** In '장기만 보기' from behind, the ovaries show 527/701 px and the tubes 208/815. From the side, the uterus shows about 200 px. At the default whole-body camera the uterus footprint is only 132 px. The plan has no region/camera framing step or test.

**3. A2 effects the plan does not cover**
- **Saved views reset (Q5).** `restoreView` (`src/view-state.ts` `validSelection`) requires `s.layers[layer]` to be on for every selected ID. A saved breast detail or lobe selection (layers `{skin}`) would reset the whole saved view after A2. Add a migration and a test.
- **Female comparisons change.** A comparison draws the skin at 0.12 alpha and organs opaque. The gland moves from translucent skin to an opaque organ in front of the lungs and heart in every female comparison. Add the comparison-layout and comparison-clear specs and Q3/Q25 checks.
- **A test breaks.** `tests/face-surface.test.mjs:16-19` asserts the exact list of 5 non-FMA `SURFACE_TONES`. Adding 4 breast IDs breaks it, and the plan only says the test must "stay green".
- **The show-through audit would measure nothing.** `scripts/audit-female-show-through.mjs` decides "skin" from the layer recorded in the cached scene dump (`.cache/female-transport/female-scene/index.json`, made by `scripts/dump-drawn-geometry.mjs`).
  - Editing the script's toned set without re-dumping, or without applying the overlay inside the audit, changes no result.
  - Toned rays still count toward `showThroughRays` (Q31 limit < 5% of the before value; current 3339 of 5432).
  - The lobes (HRAF0008/0018) are not toned, which risks the `otherColourRays < 300` limit.
  - Re-running `BASELINE=1 --write` would rewrite the gate's denominator. Do not do that without a stated reason.
- **Q20 needs an amendment too**, not only Q24. The gland would stay after the muscles are peeled, which is an exception to the outside-first rule.
- **Skin-layer controls change meaning** for these 6 IDs: skin opacity, the skin layer checkbox, and `selectionTarget` skin/internal. Document it.

**4. A3, A4 and A5**
- **D6 should be no by default.** Putting the 38-ID view into `organGroups` breaks the male precedent: lung, kidney and pancreas sub-views live only in `structureGroups`. It also produces duplicate exact organ hits, e.g. HRAF0432 → 난소 + 여성 생식기관.
- **A3 depends on B2.** The card text "(counts from B2)" makes a must-do step depend on a should-do step. Drop the counts or do B2 first.
- **A4 search aliases** must keep the `tests/search-rank.test.mjs` invariants: 2-letter queries like 'li' and 'st' match by group name only, and "ute" → [uterus, uterine-tube]. An alias such as "breast" would fail the 'st' case. State this.
- **A4 labels** need a sourced term table (KMA or 대한해부학회 edition and page) before any are written. The "new term (old term)" format also differs from the existing 9 labels; pick one convention.
- **A5 must stay runtime-only.** `scripts/import-female-atlas.mjs` also calls `sourceOrganRegion`, so re-importing would change the hash-pinned catalogue.
  - Key the rule on the `HRA:reproductive_system` concept IDs (minus placenta), not the hierarchy string.
  - `restoreView`'s `assets` type needs the extra field.
  - The uterine vessels HRAF0629–0632 still fall into 배/상체 by bounding box; decide what to do with them.
  - Keep the `tests/organ-region.test.mjs` assertion that HRAF0431 has no group.

**5. Female acupoint approximations the plan misses**
- **ST17 is not at the nipple.** ST17 is defined as the nipple centre, but the female markers are 63 mm (right) and 94 mm (left) from the HRA nipples.
  - ST16–ST18 are 23–27 mm higher on the left than the right, while the HRA nipples are level (y 1.184 / 1.185).
  - "Flag and disclose" must put these numbers on the point card. Consider hiding the female ST17 until it is reviewed.
- **Internal reference points are projected onto the outer skin.** The 7 male internal (`region-reference`) markers (GV28, EX-HN9×2, EX-HN10–13) lose that mode in the female file.
  - GV28 was projected 64.8 mm onto the outer skin.
  - B3's open-air test and the build script must carry the mode over or skip these markers.
- **32 markers project more than 10 mm.** Examples: LR14 57/55 mm, GB24 52/37 mm, LR11 40/37 mm (`field-closest`), CV16 38 mm. Record them all, not only the 28 within 12 mm of breast fat.

**6. Gates to add**
- A fresh before/after visible-pixel probe as the acceptance gate for "displayed".
- A `restoreView` migration unit test.
- Updated `face-surface.test.mjs` and `search-rank.test.mjs` with reasons.
- Browser specs:
  - comparison-layout and comparison-clear (A2);
  - detail-context, detail-peel-return and selection-navigation-return (A3 return paths);
  - translucent-depth and selection-opacity (A1/B1);
  - panel-keyboard: new card buttons must show their hover tip on keyboard focus and work by touch.

**7. Scope**
- Drop F10 (a memory note for the orchestrator) from the user-facing plan.
- Transported thyroid, parathyroid and pituitary approximations get only text, with no plan. Say so in the list of remaining approximations.

**Suggested go-ahead**
- A1: female-only, peritoneal folds kept a separate tone, judged by pixel tests.
- A3: in `structureGroups` only, no region-map change, consistent breast membership.
- A4: after the sourced term table exists.
- A5: runtime-only and keyed on concept IDs.
- A6: as written.
- A2: only after D1, plus the restoreView, comparison, audit and test work in section 3.
- B1: only with a recorded source; otherwise tell the user plainly that the overview stays covered.
- B3: corrected per section 5.
- B4: stays gated.