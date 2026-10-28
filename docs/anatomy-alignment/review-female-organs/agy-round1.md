<!-- AGY (Gemini 3.8 Flash high), conversation 5992ae71-2ba2-4bcd-bac8-5a1ec5b2863b; JSON status ERROR with a complete response -->

# Code & Design Review: Female Organ Display & Visibility Fixes

**Verdict:** **`approve-with-changes`**

The implementation is well-architected, mathematically verified (CIEDE2000 color delta, pixel-diff render tests), and strictly adheres to the core rules in [`AGENTS.md`](file:///Users/nuinuri/workspace/anatomy/AGENTS.md) and [`docs/QUALITY_STANDARD.md`](file:///Users/nuinuri/workspace/anatomy/docs/QUALITY_STANDARD.md). Glandular breast visibility (14–82% peel) and uterus exposure (at 79% peel and in dedicated featured details) solve the diagnostic problems without synthesizing missing anatomy.

---

### Executive Review Summary (Sections A–D)

- **A. Correctness Bugs:**
  - **Precedence & Alpha:** Organ sub-peel alpha in [`PackedAtlas.tsx`](file:///Users/nuinuri/workspace/anatomy/src/PackedAtlas.tsx#L179-L180) and [`Atlas.tsx`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L401) correctly overrides standard organ alpha during progressive peel. Bundle selection and isolation retain 100% opacity. Depth write correctly respects transparency boundaries via [`opacityWritesDepth`](file:///Users/nuinuri/workspace/anatomy/src/selection-context.ts#L15-L17).
  - **Source Guard:** [`verifyPackedSourceManifest`](file:///Users/nuinuri/workspace/anatomy/src/packed-source-guard.ts#L30-L38) allows *only* the 6 specific HRA glandular breast IDs to borrow `layer: "organ"`, rejecting male models, system swaps, and unlisted integumentary meshes.
  - **Modesty Boundaries:** [`\blabi(a|um)\b`](file:///Users/nuinuri/workspace/anatomy/src/modesty.ts#L483) successfully eliminates false-positive hiding of facial/lip structures (`Superior labial artery`, `Inferior labial vein`, `Nasolabial node`, `labial part of mouth`) while continuing to guard genital meshes.
  - **Ranking Invariants:** Structure search preserves the tier hierarchy (exact `0` < prefix `1` < substring `2` < `3`) and handles aliases seamlessly via [`structureFields`](file:///Users/nuinuri/workspace/anatomy/src/search-rank.ts#L19).
- **B. Rule Compliance ([`AGENTS.md`](file:///Users/nuinuri/workspace/anatomy/AGENTS.md)):**
  - **View Transitions:** All detail sub-views (`여성 생식기관 함께 보기`, `복막 주름 포함 보기`, `젖샘엽·젖샘관 보기`) route strictly through `dispatch({ type: "detail" })` in [`viewReducer`](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts#L406-L409) and return cleanly to prior peel depth/camera via `detail-close`.
  - **No Invented Anatomy:** Gaps in source models (vulva, clitoris, female urethra, ovarian vessels, perineal muscles) are left unmodelled and disclosed transparently in provenance notes.
  - **Search Identifiers:** Search preserves English names and HRAF/FMA IDs; Korean labels are explicitly marked as editorial.
  - **UI & Typography:** Design tokens in [`src/atlas.css`](file:///Users/nuinuri/workspace/anatomy/src/atlas.css#L428) are used consistently; all new text is ≥12px (labels 13px, notes 12px) with contrast exceeding 4.5:1.
- **C. Efficacy & User Experience Gaps:**
  - **Efficacy:** The user's issue ("여자만의 기관들이 표시되지 않는거 같아") is effectively solved in both search and 3D navigation.
  - **Remaining Gaps:**
    1. *'장기만 보기' (Organ-only at 76.0%):* By design, rank 0 organs (greater omentum, jejunum, ileum, colon) remain 100% opaque at 76%, hiding the uterus from the front. The user must advance to 79% peel or open the detail view.
    2. *Pelvic Wall Vasculature:* Transported male pelvic vessels running near pelvic walls remain visible at 79% (vessels peel at 84–90%), partially obscuring the ovaries from frontal angles unless vessels are excluded or detail view is used.
- **D. Anatomical & Editorial Soundness:**
  - **Sub-Peel Order:** Dissection order (bowel/omentum 76–78% → peritoneal folds 78–79% → pelvic organs 79–84%) accurately reflects surgical/dissection exposure (Gray's Anatomy 20th ed., pp. 1149, 1259).
  - **Glandular Breast as Organ:** Classifying mammary lobules and lactiferous ducts with organs at runtime while leaving fat and areola with skin is sound; it resolves the physical occlusion problem where fat enclosed and eliminated the glands during skin peel.
  - **Korean Nomenclature:** Standard terms in [`data/female-reproductive-labels.json`](file:///Users/nuinuri/workspace/anatomy/data/female-reproductive-labels.json) adhere to the 6th edition of the Korean Association of Anatomists (순화 한글 용어), with older Hanja terms appropriately relegated to search aliases.

---

### Numbered Findings & Required Changes

#### 1. Minor: Redundant action button when a breast structure is selected in overview
- **File & Line:** [`src/AtlasPage.tsx:576`](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L571-L578)
- **Problem:** `femaleViewOptions` filters views using `.filter((view) => view.id !== state.detail?.id)`. When `state.detail` is `null` (e.g. user selects a single breast mesh like `HRAF0008` in the overview), `state.detail?.id` is undefined. Consequently, both `[유방 전체 보기]` and `[젖샘엽·젖샘관 보기]` are rendered, while line 1162 also renders `[기관 상세 보기]` (which also targets the `breast` group), creating a duplicate button for the same action.
- **Concrete Fix:** Filter against `selectedGroup` rather than only `state.detail?.id`, matching the pattern in `maleLungViews` ([`AtlasPage.tsx:565`](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L565)):
  ```tsx
  const femaleViewOptions = [
    ...(reproductiveScope ? femaleReproductiveViews : []), ...(breastScope ? femaleBreastViews : []),
  ].filter((view) => view.id !== (state.detail ? state.detail.id : selectedGroup)).map((view) => <button key={view.id} onClick={() => selectFeatured(view)}>{
  ```

#### 2. Minor: Saved-view restore may fail to enable `layers.organ` if `state.layers` diverged from `detail.layers`
- **File & Line:** [`src/view-state.ts:603`](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts#L601-L606)
- **Problem:** When restoring legacy saved views with active glandular breast details, `if (keys.every(key => s.layers?.[key] === s.detail!.layers[key])) s.layers = { ...s.layers, organ: true };` only updates `s.layers.organ` if `s.layers` matches `s.detail.layers` for every single layer key. If a legacy session stored divergent overview layers, `s.layers.organ` stays `false`. Since [`AtlasPage.tsx:791`](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L791) passes `state.layers` to `<Atlas layers={state.layers}>`, [`PackedAtlas.tsx:191`](file:///Users/nuinuri/workspace/anatomy/src/PackedAtlas.tsx#L191) evaluates `props.layers["organ"]` as `false`, hiding the glandular breast meshes even while inside the detail view.
- **Concrete Fix:** Update `s.layers.organ` unconditionally whenever restoring an active detail containing glandular breast meshes:
  ```ts
  if (s.detail && glandular(s.detail.ids) && s.detail.layers?.skin === true && s.detail.layers.organ === false) {
    s.layers = { ...s.layers, organ: true };
    s.detail = { ...s.detail, layers: { ...s.detail.layers, organ: true } };
  }
  ```

#### 3. Minor: Round ligaments of uterus (`HRAF0417`, `HRAF0418`) lack search aliases
- **File & Line:** [`data/female-reproductive-labels.json:2`](file:///Users/nuinuri/workspace/anatomy/data/female-reproductive-labels.json#L2), [`data/catalog/female-pelvic-bindings.json:9`](file:///Users/nuinuri/workspace/anatomy/data/catalog/female-pelvic-bindings.json#L9)
- **Problem:** `HRAF0417` and `HRAF0418` receive Korean labels ("오른쪽/왼쪽 자궁원인대") via `female-pelvic-bindings.json`, but because they were omitted from `female-reproductive-labels.json`, they lack search aliases for common clinical/historical terms ("자궁원색", "원인대").
- **Concrete Fix:** Add entries for `HRAF0417` and `HRAF0418` in [`data/female-reproductive-labels.json`](file:///Users/nuinuri/workspace/anatomy/data/female-reproductive-labels.json):
  ```json
  { "id": "HRAF0417", "name": "Right round ligament of uterus", "label": "오른쪽 자궁원인대", "aliases": ["자궁원색", "원인대"] },
  { "id": "HRAF0418", "name": "Left round ligament of uterus", "label": "왼쪽 자궁원인대", "aliases": ["자궁원색", "원인대"] }
  ```
  *(Note: Update the test assertion in [`tests/female-organ-display.test.mjs:58`](file:///Users/nuinuri/workspace/anatomy/tests/female-organ-display.test.mjs#L58) accordingly to include these IDs).*

#### 4. Minor: Clarify '장기만 보기' (76%) occlusion behavior in user documentation
- **File & Line:** [`src/dissection.ts:460-471`](file:///Users/nuinuri/workspace/anatomy/src/dissection.ts#L460-L471), [`src/AtlasPage.tsx:922`](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L922)
- **Problem:** Users clicking "장기만 보기" expect to see all organs, including female organs. Because the organ-only preset snaps to 76.0%, the digestive tract completely obscures the uterus from the front. While anatomically accurate, users may perceive this as female organs still being missing.
- **Concrete Fix:** In the help text or stage description for `organ` ([`src/anatomy.ts:240`](file:///Users/nuinuri/workspace/anatomy/src/anatomy.ts#L240)), add a concise hint:
  ```ts
  "장기 단계(76%)에서는 장이 자궁·방광 앞을 덮고 있습니다. 슬라이더를 79%로 밀거나 ‘여성 생식기관’ 상세를 열면 생식기관을 바로 볼 수 있습니다."
  ```
