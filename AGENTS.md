# GYEOL work standards

Read `docs/QUALITY_STANDARD.md` and the latest verification record before changing atlas interactions.

- Keep the human model as the primary workspace. Tools float above it; mobile panels must not replace the scene. Hover explanations also work on keyboard focus, and every action works with click/touch.
- Route all layer, isolation, comparison and marker transitions through `src/view-state.ts`. Do not add an independent control path that bypasses these rules.
- Preserve camera and marker preferences across system changes. Distinguish one selected mesh from a complete traditional-organ comparison bundle.
- Preserve prior view on wiki return while allowing the wiki to load without WebGL/GLB downloads.
- Korean structure search must retain original English names and FMA IDs. Record editorial naming limitations. Do not invent missing anatomy or turn traditional associations into anatomical pressure paths or clinical efficacy claims.
- Before calling an interaction release complete, run the applicable quality gates and inspect desktop/mobile screenshots. A green build alone does not verify visual usability.
- Update the requirement/evidence table and comparison notes when behavior or layout changes. Record limitations and failed checks accurately.

- For coverage changes, inspect `docs/anatomy-expansion/IMPLEMENTATION.md` and its verification record. Validate real GLB membership against the source hierarchy and the official version-stamped supplement. Keep neural tissue distinct from cavity meshes.
- Use the shared design tokens in `src/design-system.css`; keep meaningful text at least 12px and verify contrast on its rendered surface. Test keyboard movement only when the canvas has focus, including release and focus loss.
