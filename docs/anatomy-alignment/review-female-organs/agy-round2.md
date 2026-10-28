<!-- AGY (Gemini 3.8 Flash high), same conversation; JSON status ERROR with a complete response -->

# Confirmation Round Review: Female Organ Display & Approximate Acupoints

**Verdict:** **`approve`**

All round-1 findings have been cleanly addressed, verified in automated test suites (70/70 passing across all relevant unit tests, browser specs passing), and validated in mobile touch rendering. The newly introduced female approximate acupoint marker calculations follow rigorous geometric standards with exemplary disclosure and strict rule compliance. There are **zero remaining blockers or majors**.

---

### (a) Confirmation of Round-1 Findings

| Item | Description | Resolution in Code & Evidence | Status |
| :--- | :--- | :--- | :--- |
| **Codex 1** | Dynamic recomputation of `selection.layers` | [`src/view-state.ts#L678-L680`](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts#L678-L680) re-derives `selection.layers` directly from the runtime catalog (`assets`). Tested and asserting `["organ"]` in [`tests/female-organ-display.test.mjs:169`](file:///Users/nuinuri/workspace/anatomy/tests/female-organ-display.test.mjs#L169). | **Resolved** |
| **AGY 2** | Unconditional organ enablement during detail migration | [`src/view-state.ts#L672-L675`](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts#L672-L675) enables `s.layers.organ = true` unconditionally without requiring `keys.every(...)`, preventing detail desync. | **Resolved** |
| **Codex 2** | Focus shift to selection card after detail switch | [`src/AtlasPage.tsx#L186-L188`](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L186-L188) uses `focusWithoutOpeningSearch` to retain keyboard/screen-reader focus on `.selection-card`. | **Resolved** |
| **Codex 3** | Mobile touch target compliance (≥44px) | Verified via [`tests/browser/female-organs.spec.ts#L139-L165`](file:///Users/nuinuri/workspace/anatomy/tests/browser/female-organs.spec.ts#L139-L165) (hasTouch, 390×844) asserting button bounding boxes ≥44px and bottom ≤844px; visual proof in [`female-organs-reproductive-touch.png`](file:///Users/nuinuri/workspace/anatomy/docs/anatomy-alignment/female-organs-reproductive-touch.png). | **Resolved** |
| **Codex 4 / AGY 4** | Honest disclosure of 76% bowel occlusion, 79% peel, and ovaries | Clarified across [`src/AtlasPage.tsx#L214-L220`](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L214-L220), [`src/anatomy.ts#L483`](file:///Users/nuinuri/workspace/anatomy/src/anatomy.ts#L483), and [`docs/QUALITY_STANDARD.md#L39`](file:///Users/nuinuri/workspace/anatomy/docs/QUALITY_STANDARD.md#L39): '장기만 보기' (76%) stops while bowel covers the pelvis; users are explicitly guided to slide to ~79% or open the detail. | **Resolved** |
| **Codex 5** | Editorial order framing & anatomical precision | [`src/dissection.ts#L528-L537`](file:///Users/nuinuri/workspace/anatomy/src/dissection.ts#L528-L537) frames peeling as an observation sequence; [`data/reproductive-groups.json`](file:///Users/nuinuri/workspace/anatomy/data/reproductive-groups.json#L8-L16) renames the view to `'여성 생식기관 · 복막 포함'` / button `'복막 포함 보기'`, describes the pouch as peritoneum, and narrows musculature to external genitalia and bulbospongiosus. | **Resolved** |
| **Codex 6** | Lactiferous sinus reference model representation | Added Ramsay et al. (2005) ultrasound literature citation to the breast provenance note in [`src/AtlasPage.tsx#L218-L220`](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L218-L220). | **Resolved** |
| **AGY 1** | Button filter to remove duplicate overview actions | [`src/AtlasPage.tsx#L184`](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L184) filters `view.id !== (state.detail ? state.detail.id : selectedGroup)`, removing the redundant `[유방 전체 보기]` button when a breast structure is selected in overview. | **Resolved** |
| **AGY 3** | Round ligament alias ('자궁원색') | Not adopted as requested: "원인대" already matches the label via substring matching, and "자궁원색" is an unverified editorial term. Sound editorial decision. | **Resolved / Closed** |

---

### (b) Review of Female Approximate Acupoint Markers

1. **Integrity of Male Markers:**
   - Executed `git diff data/anchors.json public/models/acupoint-anchors.json` → **0 differences**. Male anchors and point coordinates are completely untouched.
2. **Correctness & Mathematical Grounding:**
   - Recalculated 51 points / 87 markers using female surface landmarks ([`data/female-acupoint-landmarks.json`](file:///Users/nuinuri/workspace/anatomy/data/female-acupoint-landmarks.json)) and WHO 2008 proportional B-cun (upper abdomen: 30.5 mm/cun, lower abdomen: 36.1 mm/cun, lateral: 27.4 mm/cun = inter-nipple/8).
   - Median frontal distance from theoretical target is **0.00 mm** (p90 0.01 mm, max 0.01 mm). Left/right symmetry mirror error is ≤0.39 mm on the torso.
   - Same-level alignments (umbilicus level CV8/KI16/ST25/SP15/GB26; pubic border CV2/KI11/ST30/LR12/SP12; 3-cun level; 4-cun level) align within **0.00 mm**.
   - Ray-casting normal checks resolved 8 previously inverted face-pointing markers (HT9, EX-UE11-4, BL66, LI7, SP2), ensuring all surface markers sit on visible outward skin.
   - Internal reference points (oral/nasal cavity points like GV28) are kept unprojected inside rather than protruding through the lips.
3. **Honest Disclosure & Rule Compliance ([`AGENTS.md`](file:///Users/nuinuri/workspace/anatomy/AGENTS.md)):**
   - Markers remain hidden by default (`state.femaleMarkers: false`); only displayed when explicitly enabled via `"근사 위치로 보기"`, marked with an accessible gold `[근사]` toggle.
   - Point cards explicitly describe the generation method (`femaleMarkerNote` in [`src/AtlasPage.tsx#L142-L159`](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L142-L159)), ending with: *"여성 근사 표식 · [...] 전문가 검수 전입니다."*
   - Strictly no medical efficacy, diagnostic, or clinical accuracy claims are made.

---

### (c) Evaluation of ST17 (Nipple Center) vs. Reversion

**Keeping ST17 at the female nipple center is unequivocally the right call.** Reverting it would be an unacceptable visual and anatomical regression.

1. **Acupoint Definition Invariant:**
   - Under WHO Standard Acupuncture Point Locations (2008), ST17 (유중, 乳中) is defined unambiguously: *"In the anterior thoracic region, in the centre of the nipple."*
   - Reverting ST17 to the male registration field placement would position the marker 63.3 mm (right) and 93.9 mm (left) away from the actual female nipple—floating on arbitrary thoracic/breast skin while the physical nipple sits inches away. For any student or practitioner, a marker labeled "젖꼭지 중심" placed outside the nipple on a 3D model would be perceived as a gross defect.
2. **Root Cause of the Broken Chest Relations:**
   - The broken height relations (e.g. ST17 on KI23–SP18 curve, LR14 below ST17) are caused by the fact that the female thoracic skeleton is not yet native: the ribs and the intercostal points (LR14, KI23, SP18) are still carried from the *male* model.
   - Moving the physical definition point (ST17) away from its genuine landmark to satisfy unadapted, transported intercostal points would prioritize transport artifacts over ground truth.
3. **Disclosure Standard:**
   - The conflict is documented honestly: recorded in [`data/female-acupoint-rules.json:knownBoundaryFailures`](file:///Users/nuinuri/workspace/anatomy/data/female-acupoint-rules.json), verified by unit test G6 in [`tests/female-acupoints.test.mjs`](file:///Users/nuinuri/workspace/anatomy/tests/female-acupoints.test.mjs), and stated directly on the point card ([`src/AtlasPage.tsx#L152-L153`](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L152-L153)):
     > *"가슴 갈비사이공간 경혈은 아직 남성 표식을 옮긴 것이라, 여성 젖꼭지·유방 아래 주름에 놓은 ST17·ST18과 WHO가 정한 높이 관계(LR14는 젖꼭지 아래 등)가 이 몸에서 맞지 않습니다."*

The implementation represents the highest standard of scientific integrity: anchored to the physical anatomical landmark, mathematically tested, and transparently disclosed.
