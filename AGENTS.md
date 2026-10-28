# GYEOL work standards

## Mandatory worktree workflow

- Before changing any tracked or project file, run `git worktree list`, `git status --short`, and `git branch --show-current` to identify the checkout, branch, and existing changes.
- All implementation, documentation, configuration, and test changes MUST be made in a separate linked Git worktree on a dedicated task branch. Do not work directly in the primary checkout or on `main`/`master`. A branch alone in the primary checkout does not satisfy this rule.
- If the current directory is the primary checkout, create a task worktree before editing, for example: `git worktree add -b <task-branch> ../anatomy-worktrees/<task-name>`. Run subsequent edits, builds, and checks from that worktree. An existing linked worktree may be reused only for the same task and branch after checking its state.
- Verify the working directory is a linked worktree using `git rev-parse --git-dir` and `git rev-parse --git-common-dir`; their resolved paths must differ. If a suitable worktree cannot be created or verified, stop before editing and report the blocker. Do not fall back to the primary checkout.
- Preserve existing user changes and other task worktrees. Do not reset, clean, remove, or overwrite them to prepare a workspace.
- Use the primary checkout only for inspection and user-authorized integration of completed changes. Report the task worktree path and branch with the result. Do not remove the task worktree until its changes are safely preserved or the user requests removal.

## Atlas quality requirements

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
