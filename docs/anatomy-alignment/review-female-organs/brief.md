You are an independent, read-only code and design reviewer for GYEOL, a Korean anatomy/acupuncture atlas (React + three.js) in /Users/nuinuri/workspace/anatomy. Read AGENTS.md and docs/QUALITY_STANDARD.md first.

User request (Korean): "여성쪽의 근사값들에 대한 해결책을 찾아보자. 그리고 여자만의 기관들이 표시되지 않는거 같아 확인해서 해결해줘." (Find solutions for the female-side approximations; female-specific organs seem not to be displayed — check and fix.)

Diagnosis that motivated the change (measured in the live scene by pixel diff):
- Uterus/ovaries/tubes were loaded but 0/2452 px visible from the pelvis front at every opaque peel depth (0–76%) and in '장기만 보기' (organ-only), covered by HRA's own omentum, jejunum/ileum/colon and peritoneal folds (broad ligament, mesosalpinx, mesovarium, uterovesical pouch); all organs were one colour #a94d60, so the uterus could not be told from the bowel.
- The 16 HRA breast parts are system 'integumentary' → layer 'skin'; the glandular parts (mammary lobes, main lactiferous ducts and sinuses) sat inside the breast fat and were clipped/faded with the skin (8–20%), so they were never visible, not even in the '유방' detail (fat encloses them).
- Common Korean terms (나팔관, 난관, 유선, 젖샘, 유두) found nothing; 9/38 reproductive and 0/16 breast parts had Korean labels.
- 8 ungrouped reproductive parts fell outside the '골반' region (height heuristic); the modesty regex /labia/ hid lips and labial vessels.

What changed (diff at /private/tmp/claude-501/-Users-nuinuri-workspace-anatomy/2af69e14-e7b0-411b-99c2-e6791ac2ee5b/scratchpad/female/review/organ.diff; new files: data/female-organ-display.json, data/reproductive-groups.json, data/female-reproductive-labels.json, tests/female-organ-display.test.mjs, tests/browser/female-organs.spec.ts):
1. Organ sub-peel inside the organ window (src/dissection.ts organPeelOpacity, applied in src/PackedAtlas.tsx and src/Atlas.tsx for both bodies): rank 0 (omentum, epiploic appendage, jejunum, ileum, colon except rectum; male jejunum/ileum/colon/appendix/taeniae) 76→78, rank 1 (female peritoneal folds) 78→79, rank 2 (all other organs) 79→84. Stop/peel limit for organs stays 76. Source: Gray's Anatomy 20th ed. (1918) pp. 1149, 1259.
2. Organ colours: one palette for both bodies (male by name as before, extended to small intestine/rectum/appendix/taeniae; female by HRA group), plus a reproductive violet #9b6bc0 for uterus/ovary/tube/vagina and the 12 male genital/prostate meshes; a key in 표시 설정.
3. Glandular breast (6 IDs) drawn and peeled with the organs at runtime (src/anatomy.ts), source system kept; guard exception in src/packed-source-guard.ts limited to these IDs and their source system; ducts/sinuses take the skin tone while the skin covers them; saved-view migration in src/view-state.ts restoreView.
4. Featured details '여성 생식기관' (32 IDs, folds excluded) and '남성 생식기관' (12); sub-views '복막 주름 포함' (38) and '유방 · 젖샘엽·젖샘관' (6); card buttons and provenance text in src/AtlasPage.tsx.
5. Korean labels (editorial, unreviewed) and old-term aliases; group aliases in search (src/search-rank.ts).
6. regionScope 'pelvis' for ungrouped reproductive parts + uterine vessels (src/anatomy-region.ts); modesty regex word-bounded (src/modesty.ts); stage/help text corrections.
Measured after: glandular breast 12,400/12,462 px visible chest-front from 14% to 82%; uterus 1686–1757/2452 px at 79.5–80% pelvis-front (was 0–976 while every organ faded). Unit 490/490 and the new browser spec 3/3 pass; full browser suite is running.

Review task (read-only: do NOT modify files, do NOT start servers or run Playwright/browser tests — another process is using port 5174; you may run `node --test tests/female-organ-display.test.mjs tests/sex-source-boundary.test.mjs tests/search-rank.test.mjs tests/modesty.test.mjs` with Node 24 at /Users/nuinuri/.npm/_npx/3e062c1ecdbab29f/node_modules/node/bin/node):
A. Correctness bugs in the diff (rendering precedence, selection/isolation paths, comparisons, saved-view restore, guard holes, search ranking invariants, region scope, type issues).
B. Rule compliance (AGENTS.md): all view transitions through src/view-state.ts; no invented anatomy; Korean search keeps English names/IDs; honest disclosure; keyboard/touch parity; ≥12px text and design tokens.
C. Whether the change actually solves "female-specific organs not displayed" for a user, and what gaps remain (e.g. '장기만 보기' still shows the bowel over the uterus by design; ovaries remain behind transported pelvic-wall vessels).
D. Anatomical/editorial soundness of: the sub-peel order and its citation; displaying the glandular breast with organs; the Korean terms in data/female-reproductive-labels.json.
Return a verdict (approve / approve-with-changes / reject), then numbered findings with severity (blocker/major/minor), file:line and a concrete fix. Be concise.
