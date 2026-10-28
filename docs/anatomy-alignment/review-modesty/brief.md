Post-implementation review (read-only; do not modify files, do not start servers or run Playwright — port 5174 is in use by another session; you may run `node --test tests/<file>.test.mjs` with Node 24 at /Users/nuinuri/.npm/_npx/3e062c1ecdbab29f/node_modules/node/bin/node, and `.cache/female-ct-venv/bin/python -I scripts/modesty/check.py` (about 90 s) from the repo root).

Repo: /Users/nuinuri/workspace/anatomy (GYEOL anatomy/acupuncture atlas). Read AGENTS.md and docs/QUALITY_STANDARD.md Q32/Q43 first.

User request (Korean, verbatim): “남자의 성기부분이 다소 부담스럽게 표시되어 있는거 같아. 각 구분 별로 모두 제거할 수 있는 버전을 기본으로 하고 특정한 메뉴나 버튼 클릭시에 보이도록 수정해줘.”
Interpretation implemented: by default, remove the external genitalia in every system/layer; close the male skin smoothly instead of covering it; show them only via the top-bar shield button or the display-settings checkbox (plus: a structure the viewer explicitly chooses by search/structure link, and an organ detail that holds it, are shown).

What changed (the working tree also contains an earlier, separately reviewed, uncommitted female-organ task; review only the modesty parts):
- src/view-state.ts: `modesty: true`, `modestyVersion: 2`; restoreView turns modesty on once for any saved state without version 2; reset keeps it.
- src/modesty.ts: removed the dark ellipsoid cover. Rules: GENITAL_IDS (male glans, corpora, testes, epididymides, deferent ducts, urethra; female vagina HRAF0406), word-bounded GENITAL_NAME, and new GENITAL_COURSE (external pudendal veins, superficial/deep external pudendal arteries, genital branch of genitofemoral nerve — the same 8 structures the female transport skips as "male external genital course"). `hidesGenital(modesty, id, name, revealed)`.
- src/modesty-skin.ts (new) + data/modesty-male-skin.json (new, 84 KB): the male skin FMA7163 drawn without 511 triangles plus a 1,023-vertex / 2,006-triangle patch child mesh that shares the skin material (so it fades/clips with the skin and picks as the skin). 18 male acupoint anchors on the replaced skin get override positions (`modestAnchors`), used only while modesty is on.
- src/Atlas.tsx: all three renderers (base layers, supplements, male lymph reference model — the last had no rule before) use hidesGenital with reveal = selected || in detailIds; skin layer prepares/applies the closed skin; data-modesty / data-modesty-skin on the canvas; anchorSource uses MODEST_ANCHORS while modesty is on.
- src/PackedAtlas.tsx: female cover removed, same reveal rule.
- src/AtlasPage.tsx, src/AnatomyControls.tsx: shield tooltip shows the next action (성기 보이기/성기 가리기), help row, settings hint text.
- scripts/modesty/{export.mjs,gen.py,check.py,rt.c,rt.py} (new): deterministic generator and checker of the JSON; scripts/requirements-female-ct.txt pins scipy/networkx for it.
- scripts/dump-drawn-geometry.mjs: the female-transport geometry dump uses the full source skin, never the closed one.
- Tests: tests/modesty.test.mjs (rewritten), tests/modesty-skin.test.mjs (new: sha, seam edge-for-edge, winding, leak rays, markers), tests/browser/modesty.spec.ts (new), updates in system-exclusion.test, female-organ-display.test, female-transport.spec, female-organs.spec, first-frame.spec.
- Record: docs/anatomy-alignment/MODESTY_DEFAULT.md (design, measurements, limits); QUALITY_STANDARD Q32/Q43 and revision line; README; FEMALE_TRANSPORT.md section.

Diff of the touched tracked files: /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/modesty/review/modesty.diff (new files are untracked; read them directly).

Live-app screenshots (attached/at these paths):
- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/modesty/refine/f3/final/final-sheet.png — male, modesty on: front, obliques, below, side, back-below, whole body, 12% and 18% peel, front cut-away 0.35.
- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/modesty/verify3/live/female-ref-sheet.png — female reference, same views.
- /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/modesty/spec-sheet.png — the four repo evidence screenshots from tests/browser/modesty.spec.ts.

Checks already run: unit 496/496; build; production smoke; the 6 affected browser specs 24/24 (GPU); check.py `failed: []`; two clean generator runs byte-identical to the committed JSON; three rounds of independent live/geometry/repro verification (last round: 0 blocking).

Please review for:
(a) correctness: every path that draws a mesh (base, supplement, lymph reference, female packed, details, comparisons, search results, structure links, marker focus) obeys the rule; the reveal rule cannot leak genitals without an explicit choice; state migration and reset semantics; picking; disposal of the modest geometry/patch; the anchors override (only while modesty is on, male only; focus action also uses it);
(b) whether the request is met — removed "in every system" by default, shown only by an explicit menu/button — and whether the extra reveal paths (search choice, structure link, organ detail) are acceptable or should be gated;
(c) rule compliance (AGENTS.md): view-state routing, no invented anatomy presented as real (the closure is labelled an editorial display surface), recorded limitations accurate;
(d) the generator/data: determinism, sha guards, any defect the checks would miss.
Return a verdict (approve / approve-with-changes / reject) and only blockers or majors with file:line and a concrete fix; list minors briefly.
