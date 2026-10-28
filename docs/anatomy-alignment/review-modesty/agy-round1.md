# Post-Implementation Review: Male Genital Modesty Default

**Verdict**: **`approve`**
**Blockers / Majors**: **None (0)**

---

### 1. (a) Correctness & Robustness

* **Mesh Drawing Paths**:
  * **Base layers ([`AnatomyLayer`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L360-L445))**: Employs [`hidesGenital`](file:///Users/nuinuri/workspace/anatomy/src/modesty.ts#L22) on all base structures. For the skin layer (`layer === "skin"`), [`prepareModestSkin`](file:///Users/nuinuri/workspace/anatomy/src/modesty-skin.ts#L20) attaches the groin closure patch, and [`applyModestSkin`](file:///Users/nuinuri/workspace/anatomy/src/modesty-skin.ts#L49) swaps between the 511-triangle-culled geometry and the full source geometry, toggling `patch.visible` in synchrony with `skin.visible`.
  * **Supplements ([`SupplementModel`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L520-L530))**: Gated with [`hidesGenital`](file:///Users/nuinuri/workspace/anatomy/src/modesty.ts#L22).
  * **Reference models ([`ReferenceModel`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L610-L640))**: Now correctly incorporates [`hidesGenital`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L255) for the male lymphatic reference, and includes `props.modesty` in its `useLayoutEffect` dependency list ([`Atlas.tsx:268`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L268)).
  * **Female packed atlas ([`PackedAtlas`](file:///Users/nuinuri/workspace/anatomy/src/PackedAtlas.tsx#L524))**: Gated with [`hidesGenital`](file:///Users/nuinuri/workspace/anatomy/src/modesty.ts#L22); the unnatural protruding ellipsoid cover was completely removed, leaving the naturally flat female skin untouched.
* **Leak Prevention & Reveal Rule**:
  * In all renderers, `revealed = selected || props.detailIds.includes(id)`.
  * Because hidden meshes have `visible = false`, raycasting ignores them, preventing accidental canvas picking.
  * Organ comparisons do not add IDs to `detailIds` or `selectionIds`, so comparisons cannot inadvertently unhide genitalia.
* **State Migration & Reset Semantics**:
  * [`restoreView`](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts#L547-L550) detects sessions saved before version 2 (`s.modestyVersion !== 2`) and initializes them to `modesty: true, modestyVersion: 2`. Explicit user choices to turn modesty off under `modestyVersion: 2` are retained across reloads.
  * Reset (`case "reset"` in [`view-state.ts:475`](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts#L475)) explicitly preserves `s.modesty`, honoring AGENTS.md rules regarding viewer preference persistence.
* **Picking Behavior**:
  * In [`prepareModestSkin`](file:///Users/nuinuri/workspace/anatomy/src/modesty-skin.ts#L40-L43), `patch` (`PATCH_NAME = "modesty-patch"`) is mounted directly as a child of skin mesh `FMA7163`.
  * Raycast clicks on the patch fall through `structureById.has("modesty-patch")` to `e.object.parent?.name` ([`Atlas.tsx:477-479`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L477-L479)), resolving directly to `FMA7163` (the skin).
  * When `selectionTarget === "internal"`, [`configurePicking`](file:///Users/nuinuri/workspace/anatomy/src/anatomy-rendering.ts#L85) skips the skin layer including the patch, allowing clicks to pass through to internal organs as expected.
* **Memory & Disposal**:
  * In [`AnatomyLayer`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L177-L181), the cleanup hook calls `patch.geometry.dispose()` and `modestSkin.modest.dispose()`, and restores `skin.geometry` back to `full`. Cached GLTF source geometry in `useGLTF` remains pristine and uncorrupted across mount/unmount cycles.
* **Acupoint Anchors Override**:
  * [`modestAnchors`](file:///Users/nuinuri/workspace/anatomy/src/modesty-skin.ts#L15) overrides 18 male markers situated on or near the closed skin (14 adjusted <1.1 mm to sit on the faired surface; 4 groin crease markers LR10/LR11 brought forward onto the front surface).
  * In [`Atlas.tsx:829`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L829), `anchorSource` selectively uses `MODEST_ANCHORS` only when `sex === "male" && modesty === true`.
  * Camera focus (`action.kind === "focus"` in [`Atlas.tsx:1010`](file:///Users/nuinuri/workspace/anatomy/src/Atlas.tsx#L1010)) sources directly from `anchorSource`, correctly centering on the revised coordinates.

---

### 2. (b) Requirement Fulfillment & Reveal Paths

* **Requirement Met**:
  * The user's request (*“각 구분 별로 모두 제거할 수 있는 버전을 기본으로 하고 특정한 메뉴나 버튼 클릭시에 보이도록 수정해줘”*) is met across all 7 systems.
  * In default view (0% peel through deep dissection and cutaway), external genitalia and the 8 exiting vessel/nerve courses are omitted. The male skin smoothly closes over the pubic region in mannequin fashion without artifacts.
  * Controlled directly via the top-bar shield toggle button ([`AtlasPage.tsx:385`](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L385)) and the display settings checkbox ([`AnatomyControls.tsx:98`](file:///Users/nuinuri/workspace/anatomy/src/AnatomyControls.tsx#L98)).
* **Assessment of Extra Reveal Paths**:
  * **Explicit search result selection** and **direct structure links** (`#atlas/structure/male/<id>`): Fully acceptable and necessary. Silently failing to display a structure when a user explicitly searched for it (e.g., "고환" or "testis") would cause a broken state with an empty camera focus. The single selected mesh is rendered in high-visibility cyan emphasis (`#34d3dd`) against the closed skin context, preserving clinical utility without exposing surrounding external organs.
  * **Organ detail view** (`male-reproductive`): Fully acceptable. Opening the male reproductive organ card is an explicit user action to examine that organ system.
  * **Conclusion**: These reveal paths are deliberate and should **not** be gated.

---

### 3. (c) AGENTS.md Rule Compliance

* **View-State Routing**: All transitions flow through [`src/view-state.ts`](file:///Users/nuinuri/workspace/anatomy/src/view-state.ts) (`modesty` action, `restoreView`, `viewReducer`). No components bypass view-state or manage disconnected local state.
* **No Invented Anatomy**:
  * The closed groin is documented in [`MODESTY_DEFAULT.md`](file:///Users/nuinuri/workspace/anatomy/docs/anatomy-alignment/MODESTY_DEFAULT.md#L108-L109) and [`QUALITY_STANDARD.md` Q32](file:///Users/nuinuri/workspace/anatomy/docs/QUALITY_STANDARD.md#L52) as an editorial display surface (*편집 표시 면*), not real anatomy.
  * The generator rejected the implicit voxel-carving approach specifically because it formed ridges resembling an invented vulva, adopting instead the neutral, smooth mannequin surface.
* **Geometry Dump Separation**:
  * [`scripts/dump-drawn-geometry.mjs`](file:///Users/nuinuri/workspace/anatomy/scripts/dump-drawn-geometry.mjs#L45-L57) explicitly excludes `modesty-patch` and reads `userData.modestSkin.full`, ensuring the female transport alignment field is calculated against the real anatomical male skin rather than the editorial closure.

---

### 4. (d) Generator & Data Verification

* **Determinism & SHA Guards**:
  * Single-threaded mathematical execution enforced via environment variables (`OPENBLAS_NUM_THREADS=1`, `VECLIB_MAXIMUM_THREADS=1`, etc.) in [`scripts/modesty/gen.py:12`](file:///Users/nuinuri/workspace/anatomy/scripts/modesty/gen.py#L12).
  * Strict SHA-256 checks on `skin.glb` (`fab135cd...`), `organ.glb`, context files, and `data/anchors.json`.
  * Python dependencies pinned in [`scripts/requirements-female-ct.txt`](file:///Users/nuinuri/workspace/anatomy/scripts/requirements-female-ct.txt) (`scipy==1.13.1`, `networkx==3.2.1`).
* **Independent Check Script Execution**:
  * Executed [`.cache/female-ct-venv/bin/python -I scripts/modesty/check.py`](file:///Users/nuinuri/workspace/anatomy/scripts/modesty/check.py):
    * **Result**: `0` exit code, `"failed": []`.
    * **Seam**: 38 boundary vertices and normals match the kept skin bit-for-bit in float32; 0 unstitched boundary edges.
    * **Watertightness & Rays**: 60,000 rays cast from all angles (front, below, sides); `0` back-face hits, `0` see-through gaps.
    * **Context Clearance**: 1,625,070 context mesh sample points checked within 2 cm of the patch; `0` points protrude outside the closed skin.
    * **Anchors**: All 18 moved markers confirmed in open air and outside the skin.

---

### 5. Minor Notes (Non-Blocking)

1. **`MODESTY_DEFAULT.md` Verification Section Placeholder**:
   * [`docs/anatomy-alignment/MODESTY_DEFAULT.md:124`](file:///Users/nuinuri/workspace/anatomy/docs/anatomy-alignment/MODESTY_DEFAULT.md#L124) contains `(아래 ‘검증’ 항목은 게이트 실행 뒤 채웁니다.)`. When ready to merge/tag, fill in the executed quality gate summary.
2. **Accessible Screen Reader State on Header Button**:
   * In [`src/AtlasPage.tsx:385`](file:///Users/nuinuri/workspace/anatomy/src/AtlasPage.tsx#L385), `data-tip` dynamically switches to the next action (`"성기 보이기"` / `"성기 가리기"`), while `aria-pressed={state.modesty}` conveys current state. Screen readers read "성기 가리기, 눌림" when active, which is clear and consistent.
