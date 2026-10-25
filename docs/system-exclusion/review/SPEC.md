# 박리 레일 통합 사양 (2026-10-25, 설계 워크플로 종합)

설계 3안(최소 변경·터치 우선·명확성/접근성 우선)과 심사 2명의 결과를 종합한 사양입니다. 구현은 이 사양과 Codex·AGY 사양 검토 반영 사항을 따릅니다([구현 기록](../IMPLEMENTATION.md#박리-레일-통합--2026-10-25)).

Final spec: system exclusion built into the peel rail (2026‑10‑25)

**Decision.** The judges split: one picked "touch", the other "minimal". This spec uses **touch** as the base and takes grafts from both of the others. The deciding difference is short landscape:
- Minimal's and clarity's lists beside the rail are about 196/346 px, which is 56–57% of the scene. That breaks the ≤45% panel rule for short landscape. Their 44 px toggle in the heading slot also overflows the rail in explicit views (a fatal issue).
- Touch's 4×2 band is the only one within 45%, and it also removes today's 20 px landscape dots, which overlap by 6 px.

Every other graft both judges asked for is included:
- From touch/clarity: the check‑mark square, 2 px gaps, the 188 px coarse rail, static swatches outside the peel, and a forced‑colors fallback.
- From minimal: the measured baselines (the bottom row is 100 px at 1024 wide), the scoped tooltip with an offset, and the visible reason for the last remaining system.
- From clarity: the desktop caption, the Escape guard, `aria-controls`, a status line set only by user actions, and a real "뺌" span.

View-state, `dissection.ts` and `tests/system-exclusion.test.mjs` do not change. `{type:"excluded"}` through `setExcluded` stays the only path.

## 1. Interaction model
- **Row:** `[포함 칸][이름 = ○○까지 박리][눈 = ○○ 빠른 보기]` on every surface (rail, phone band, landscape band). The colour dot leaves the stop button and becomes the check.
- **Included:** a square in the system colour with an ink check mark (#062028 = `--ax-accent-ink`).
  - The swatch is at least 3.67:1 on `--ax-surface` (muscle is the lowest); the ink on the swatch is at least 3.60:1.
  - Peeled rows keep the filled box. Only the name changes: struck through on rails, dimmed in bands. "Peeled" and "left out" therefore never look alike.
- **Left out:** a hollow square (`inset 0 0 0 2px var(--ax-muted)`, 8.74:1). The name is muted and followed by a real `<span class="ax-stop-left">뺌</span>`: inline on fine rails, on a second line on coarse rails and in bands.
- **Toggle:** click, tap or Space on the check calls `toggleKept(layer, checked)`, which uses `setExcluded` and sets the note (section 3).
  - Focus stays on the check. The phone and landscape bands stay open. Rows never move, because they are placed by `stageDepth` only.
  - Undo is ticking the box again. Re-including does not restore a clamped depth (current behaviour; recorded as a limit).
- **Left‑out stop:** stays `aria-disabled`, with the name "○○까지 박리 — 뺀 계통". Clicking it changes no state and sets the note to its tip:
  - in dissection: "○○ 뺌 · 왼쪽 칸으로 다시 넣기"
  - outside dissection: "○○ 뺌 · 연속 박리에서 다시 넣기"
- **Eye:** unchanged. It is an explicit one‑system view and leaves `excluded` alone. In bands it still closes the band.
- **Outside dissection** (one‑system view, selection, comparison, organ detail, direct combination; `peeling = state.displayMode==="dissection"` is false):
  - Each check is replaced in the same column by `<span class="ax-keep is-static" aria-hidden="true"><i class="ax-swatch {layer}"/></span>`: filled when included, hollow when left out, never ticked.
  - There are no inert controls, and stop and eye do not shift.
  - The peel entry ("N%에서 연속 박리") and the slider return to the peel, and the reducer reapplies `excluded`.
- **All‑7 rule:** `lastKept = state.excluded.length === stages.length-1`. The one remaining check is `locked`:
  - it gets `aria-disabled="true"` (not native `disabled`), stays focusable and loses its hover style;
  - its `aria-describedby` adds the last‑system help;
  - its tip reads "마지막 남은 계통은 뺄 수 없습니다";
  - `onChange` returns early and sets the note to that text; React restores the controlled `checked`. The reducer also refuses all 7.
  - The phone and landscape hint shows the same text while `lastKept`, because iOS does not focus a tapped checkbox.
- **Peel limit:** unchanged. The track past `--limit` is dashed, the summary shows "N%까지", and `aria-valuetext` reads "… · ○○ 뺌, N%까지".
- **Settings panel:** the "○○ 레이어" checkboxes stay direct combination. They keep a different name from the rail checks ("○○ 포함").

## 2. Layout (all sizes border-box)
**Fine rail** (1440×900, 1366×768, 1180×580 and any non‑coarse rail): `.ax-depth{width:156px (was 140); --keep-tip:101px}`.
- Row 108 = keep label 24×26 + gap 2 + stop 54 (padding 0 4px) + gap 2 + eye 26×26. Row height 26 and `--stop-gap` 28 are unchanged.
- The swatch is 14×14 with radius 4. "골격 뺌" (13 px + 12 px) fits about 46 px of content.
- `.depth-band` becomes a single column, `display:grid; gap:4px` (the 44 px button column goes away). Order:
  1. heading (live strong, or mode + peel entry)
  2. `.depth-excluded`, now inside `.depth-heading`, `display:grid; margin-top:4px`, 12 px muted, two lines: "골격·장기 뺌" or "N개 계통 뺌" for more than 3, then "N%까지"
  3. or, while peeling with nothing left out, the caption `<small class="depth-keep-hint" aria-hidden>`: "체크를 끄면 박리에서 뺍니다" (12 px muted, ≤2 lines)
- 1180×580 track ≈222 px against 190.5 px needed. Horizontally the rail ends at x 170, and the inspector starts at W−358 or later.

**Coarse tablet rail** (`(pointer:coarse) and (min-width:701px) and (min-height:561px)`: 1024×768, 1024×680, 1280×720, 768×1024): `.ax-depth{width:188px; --keep-tip:113px}`.
- Row 140 = 44 + 2 + 48 + 2 + 44.
- `.ax-keep` and `.ax-solo` are 44×44 and the swatch is 18×18.
- `.ax-stop{min-height:44px; flex-direction:column; align-items:flex-start; justify-content:center; gap:0}`. The name stays on one line (`.ax-stop-name{white-space:nowrap}`) and "뺌" goes to line 2. This removes the recorded one‑character‑per‑line wrapping.
- Keep `margin-top:8px` on the track.
- At `(pointer:coarse) and (min-width:701px) and (max-height:700px)`, `:is(.depth-excluded,.depth-keep-hint){display:none}`. 1024×680 track 313.5 px against 293.5 px needed. No new summary line.
- The rail spans x 14–202. At 768 wide the inspector starts at x 434; the cutaway reset sits at about 314–454 at y 68.

**Phone band** (≤700 px wide; 390×844, 360×740): the toggle, band position (`bottom: calc(100% + 6px + 196px)`), steps slot (196 px tall, `right:56px`) and closed depth row are unchanged.
- **Heading row:** the live strong (or mode + peel entry) on the left. `.depth-excluded` is right‑aligned: `display:block; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis`, with the existing `span+span::before{content:" · "}`.
- **Hint line:** `p.depth-band-hint` (aria-hidden), one line at 12 px:
  - while peeling: the legend "칸: 넣고 빼기 · 이름: 여기까지 박리 · 눈: 이것만 보기" (≈249 px ≤ 264 at 360). Three `<span>`s joined by `span+span::before{content:" · "}`.
  - while `lastKept`: "마지막 남은 계통은 뺄 수 없습니다"
  - otherwise: "이름: 그 계통까지 박리 · 눈: 그 계통만 보기"
  - a note, when set, replaces all of these.
  - In a comparison, `comparisonLine` replaces the hint (do not stack them). This saves about 20 px, so 360 + comparison lands near 42.6%, under 45%.
- **Steps grid:** `grid-auto-flow:column; grid-template-columns:repeat(2,minmax(0,1fr)); grid-template-rows:repeat(4,44px); gap:2px; padding:4px 4px 8px; align-content:start`.
  - DOM, tab and peel order run down column 1 (체표, 근육, 골격, 장기), then column 2 (혈관, 림프, 신경); cell 8 stays empty.
  - `li{position:static; transform:none; display:flex; align-items:stretch; gap:2px; min-width:0}`.
  - `.ax-keep` and `.ax-solo` are 44×44 (`flex:none`). `.ax-stop{flex:1; min-width:44px; min-height:44px; flex-direction:column; align-items:center; justify-content:center; padding:0 2px; font-size:12px}`.
  - Cells are 152 px at 390 (stop 60) and 137 px at 360 (stop 45).
  - Band plus steps is about 266 px, which is 33% of the scene at 390 and 38% at 360.
  - `.depth-keep-hint{display:none}`, and tips stay hidden (existing rule).

**Short landscape** (`(min-width:701px) and (max-height:560px)`; 844×390, 740×360):
- **Rail:** 124 wide, unchanged position. It holds: region select 30, `.depth-toggle` (now shown), and the track (`min-height:64px`, ticks and slider only). The rail no longer shows stops.
  - `.depth-band{display:none}`, `.depth-steps{display:none}` when closed.
  - Toggle: `display:grid; grid-template-columns:minmax(0,1fr) auto; width:100%; min-height:44px; padding:4px 6px; border:1px solid var(--ax-line-strong); background:var(--ax-surface-2); color:#fff; font:600 12px/1.25; text-align:left; word-break:keep-all`.
    - Text in column 1 and `.depth-toggle-count` (12 px muted) under it; chevron in column 2 spanning both rows; `[aria-expanded=true]` adds an accent border.
    - Its existing aria-label "깊이 단계 선택: …" contains all its visible text, so label‑in‑name holds.
  - Because the heading is no longer on the rail in this layout, explicit views cannot crowd it. That resolves the fatal issue the judges raised for minimal and clarity.
- **Open band:** `.ax-depth{--lw:min(580px, calc(100vw - 152px))}`; `[data-open=true] .depth-steps`:
  - `display:grid; position:absolute; z-index:2; left:calc(100% + 17px); right:auto; top:auto; bottom:-9px; width:var(--lw)`, which puts x at 142 and the bottom on the rail's outer bottom;
  - `grid-template-columns:repeat(4,minmax(0,1fr)); grid-template-rows:44px 44px; gap:2px; padding:4px; background:var(--ax-surface); border:1px solid var(--ax-line-strong); border-radius:var(--ax-radius); box-shadow:var(--ax-shadow)`.
  - Rows are row‑major: 체표 근육 골격 장기 / 혈관 림프 신경 + **cell 8** `li.depth-steps-aside`.
  - Height is 100 px (29% of 346 and 32% of 316).
  - Cells are 140 px at 844/740 (stop 48) and at least 136 px from 716 px wide.
- **Cell 8:**
  - While peeling: `<p aria-hidden>` showing the same hint content, `font-size:12px; line-height:14px; word-break:keep-all`. Spans are `display:block` (three legend lines) and fit in ≤3 lines.
  - Outside dissection: the peel entry button, with the same aria-label and text as the heading's, `width:100%; min-height:44px; font-size:12px`. On click it dispatches `{type:"dissection", value:state.dissection}`, keeps the band open, and runs `requestAnimationFrame(() => depthSlider.current?.focus({preventScroll:true}))`.
- **Comparison:** nav `data-compare={Boolean(state.comparison)}`. With `[data-open=true][data-compare=true]`, `grid-template-rows:auto 44px 44px`, and the first child is `li.depth-steps-note{grid-column:1/-1}` holding `comparisonLine` (`.panel-comparison-note{margin:0; padding:4px 8px; line-height:1.3}`). Height is ≤141.2 px with two lines (40.8% of 346; 44.7% of 316).
- **While open:** `.ax[data-popover="depth"] :is(.ax-inspector,.cutaway-reset){visibility:hidden}` (landscape block). Other rules: `.ax-depth .depth-steps [data-tip]::after{display:none}` and `li.peeled .ax-stop{text-decoration:none}`.
- **Delete:** `.ax{--stop-gap:14px}`, the `li:not(.active)` rules, `.ax-stop{min-height:20px}`, `.ax-solo{22px}`, `.depth-excluded{display:none}`, and `track min-height:90px`.

## 3. JSX (`src/AtlasPage.tsx`) and accessibility
State and handlers:
- New state and helpers near line 182: `shortLandscape = useMedia("(min-width: 701px) and (max-height: 560px)")`; `const [keepNote,setKeepNote]=useState("")`; `const depthSlider=useRef<HTMLInputElement>(null)`.
- Effects:
  - `useEffect(()=>setKeepNote(""),[popover,state.displayMode])`
  - `useEffect(()=>{ if(panel) setPopover(p=>p==="depth"?null:p); },[panel])`
- Lines 645–646: replace `excludePickerId` with `keepHelpId`, `lastHelpId` and `stepsId` (`useId`), plus `peeling`, `lastKept`, `LAST="마지막 남은 계통은 뺄 수 없습니다"`, and:
  ```tsx
  toggleKept(layer, keep) {
    if (!keep && lastKept && !state.excluded.includes(layer)) return setKeepNote(LAST);
    const next = keep ? state.excluded.filter(l => l !== layer) : [...state.excluded, layer];
    setExcluded(layer, keep);
    const lim = peelLimit(next, state.anatomyRegion);
    setKeepNote(`${name} ${keep ? "다시 넣음" : "뺌"}${lim < 100 ? ` · ${lim}%까지` : ""}`);
  }
  ```
- `hint = keepNote || (peeling ? (lastKept ? LAST : legendSpans) : "이름: 그 계통까지 박리 · 눈: 그 계통만 보기")`.

Nav markup:
- **Nav (881):** drop `data-excluding`; add `data-compare`.
- **Toggle:** add `aria-controls={stepsId}`.
- **Heading:** append the summary `<small className="depth-excluded">` (only when `peeling && excluded.length`) inside `.depth-heading`.
- **After the heading:** `{peeling && !state.excluded.length && <small className="depth-keep-hint" aria-hidden="true">체크를 끄면 박리에서 뺍니다</small>}`, then `{phone && comparisonLine ? comparisonLine : <p className="depth-band-hint" aria-hidden="true">{hint}</p>}`.
- **Slider:** `ref={depthSlider}`.
- **List:** `<ol className="depth-steps" id={stepsId} aria-label="계통 단계">`, containing in order:
  - `{shortLandscape && comparisonLine && <li className="depth-steps-note" role="presentation">…}`
  - the 7 rows
  - `{shortLandscape && <li className="depth-steps-aside" role="presentation">…}`
- **Nav end:** `<span id={keepHelpId} hidden>체크를 끄면 그 계통은 박리 깊이와 관계없이 그리지 않습니다</span><span id={lastHelpId} hidden>{LAST}</span><p className="depth-status ax-vh" role="status">{keepNote}</p>`.
- **Row:**
  ```tsx
  <li className={[current&&"active", left?"excluded":peeled&&"peeled"].filter(Boolean).join(" ")}>
    {peeling
      ? <label className="ax-keep" data-tip-side="right" data-tip={locked ? LAST : left ? `${name} 다시 넣기` : `${name} 빼기 · 어느 깊이에서도 그리지 않음`}>
          <input type="checkbox" className={`ax-keep-input ax-swatch ${layer}`} aria-label={`${name} 포함`} checked={!left}
            aria-disabled={locked||undefined} aria-describedby={locked ? `${keepHelpId} ${lastHelpId}` : keepHelpId}
            onChange={e => toggleKept(layer, e.target.checked)}/>
        </label>
      : <span className="ax-keep is-static" aria-hidden="true"><i className={`ax-swatch ${layer}`}/></span>}
    <button className="ax-stop" …>{/* no layer-dot */}<span className="ax-stop-name">{name}</span>{left && <span className="ax-stop-left">뺌</span>}</button>
    <button className="ax-solo" …/>
  </li>
  ```
  - `locked = lastKept && !left`. The class composition lets a left‑out row that is current in an explicit view show both states.
  - Stop `onClick`: `if (left) { setKeepNote(tip); return; }`.

Accessibility and keyboard:
- **Tab order while peeling:** region → (phone and landscape: toggle) → slider → for each system in peel order: check, stop, eye (21 stops). In explicit views the checks drop out, and the peel entry comes before the slider (rails and phone) or in cell 8 (landscape).
- **Focus:** stays on the toggled check. The landscape cell‑8 peel entry moves focus to the slider.
- **Tooltips on focus:**
  - `.ax-depth .ax-keep::after{left:calc(100% + var(--keep-tip))}`, so the tip opens outside the rail.
  - `.ax-depth .ax-keep:has(> input:focus-visible)::after{opacity:1; transform:translate(0,-50%)}`.
- **Announcements:** only `.depth-status` announces, and only after a user toggle, a refused last system, or a left‑out stop press. Never on load, restore or region change. Visible hint copies are aria-hidden. The rail heading's existing `aria-live` stays.
- **Escape (lines 301–303):**
  ```ts
  if (popover) {
    const shown = popoverTrigger.current?.checkVisibility({visibilityProperty:true}) ?? false;
    setPopover(null);
    if (shown) { requestAnimationFrame(() => focusWithoutOpeningSearch(popoverTrigger.current)); return; }
  }
  ```
  An invisible popover is cleared silently and Escape continues to panel → presenting (Q34). Delete the `excluding` branch. Deps: `[panel, popover, presenting, focusWithoutOpeningSearch]`.
- **Help (812, 817):**
  - Row "계통 빼고 박리": mouse/keyboard "깊이 막대 계통 행 왼쪽 칸의 체크 끄기(다시 체크하면 넣기)"; touch "단계 버튼 → 계통 칸의 체크 끄기".
  - Paragraph: replace "‘계통 빼기’로 뺀 계통은" with "깊이 막대에서 칸의 체크를 끈 계통은".

## 4. Removed and kept
- **Remove from `AtlasPage.tsx`:**
  - lines 173–176 (comment, `excluding` state, `excludeToggle`), 183–185 (both effects);
  - `setExcluding(false)` in `startPresenting` (344);
  - the `.depth-exclude` block (899–922: button, picker, 7 `.ax-include`, 완료, `.exclude-hint`) and the `excluding ?` hint ternary (924);
  - `{phone && comparisonLine}` (926), now merged into the hint line.
- **Remove from `atlas.css`:**
  - lines 326–356: `.exclude-*`, `.ax-include*`, `.depth-exclude`, `[data-mode=layers] .depth-band`, and the two‑column band;
  - line 359 and `li.peeled .layer-dot` (325);
  - phone rules for `depth-exclude`, `exclude-*`, `[data-excluding]`, `.exclude-picker`, the `::after " 뺌"`, `.ax-stop .layer-dot` and the `li{display:grid…}`;
  - line 854;
  - the landscape rules listed in section 2.
- **Change in `atlas.css`:**
  - lines 267–273: `.ax .layer-dot.X, .ax .ax-swatch.X { background-color:#… }` (was the `background` shorthand);
  - line 287: width 156 and `--keep-tip:101px`;
  - lines 315–324: `.ax-stop{gap:3px; padding:0 4px}`, `.ax-stop-name{white-space:nowrap}`, `.ax-stop-left{font-size:12px; font-weight:500; color:var(--ax-muted)}`.
- **Add to `atlas.css`:**
  - `.ax-keep{position:relative; flex:none; display:grid; place-items:center; width:24px; height:26px; border-radius:var(--ax-radius-ctl); cursor:pointer}`
  - `.ax-keep.is-static{cursor:default}`
  - `.ax-keep:not(.is-static):not(:has([aria-disabled=true])):hover{background:var(--ax-surface-2)}`
  - `.ax-swatch{display:block; flex:none; width:14px; height:14px; border-radius:4px}`
  - `.ax-keep-input{appearance:none; -webkit-appearance:none; margin:0; padding:0; border:0; cursor:pointer}`
  - `.ax-keep-input[aria-disabled=true]{cursor:default}`
  - `.ax-depth .ax-keep-input:checked{background:no-repeat center/100% 100% url("data:image/svg+xml,…14×14 path M3 7.2l2.6 2.6L11 4.4, stroke %23062028, width 2, round…")}`
  - `.ax-depth li.excluded .ax-swatch{background-color:transparent; background-image:none; box-shadow:inset 0 0 0 2px var(--ax-muted)}`
  - `.ax-depth .depth-band{display:grid; gap:4px}`
  - `.ax-depth .depth-keep-hint{display:block; margin:0; font-size:12px; line-height:1.3; color:var(--ax-muted); word-break:keep-all}`
  - `@media (forced-colors:active){.ax-depth .ax-keep-input{appearance:auto; -webkit-appearance:auto} .ax-depth .is-static .ax-swatch{forced-color-adjust:none}}`
  - `.ax .ax-vh{position:absolute!important; width:1px; height:1px; margin:-1px; padding:0; border:0; overflow:hidden; clip-path:inset(50%); white-space:nowrap}`
- **Keep:** the summaries, the closed‑row "N개 뺌" and its `aria-label`, the dashed track, `aria-valuetext`, `li.excluded` (stop is muted with no hover), the `aria-disabled` left‑out stop, and all reducer behaviour.

## 5. Tests
**`tests/system-exclusion.test.mjs`:** no change; it is state‑level only and runs in `npm test`.

**`tests/browser/system-exclusion.spec.ts`**
- **Helpers:**
  - `rail()`: delete `toggle`, `picker` and `done`. Keep `include(l)` (the checkbox "○○ 포함").
  - Add `keep(l)` (its `.ax-keep` label), `swatch(l)` (the `.ax-swatch` in the row whose stop name starts with "○○까지 박리"), `checks` (`nav.getByRole('checkbox')`), `caption` (`.depth-keep-hint`), `hint` (`.depth-band-hint`), `aside` (`.depth-steps-aside`), `status` (`.depth-status`), `band` (`page.locator('.depth-toggle')`) and `steps` (`.depth-steps`).
  - Add `visibleBoxes(locator)`, which skips `visibility:hidden` and zero‑size boxes, and `targets = nav.locator('.depth-steps :is(.ax-keep, .ax-stop, .ax-solo)')`.
  - The header comment for `SCENE_TOOLS` changes from "picker" to "rail and bands".
- **a)**
  - Assert `getByRole('button',{name:/계통 빼기/})` has count 0.
  - 7 checks visible and checked; the caption reads "체크를 끄면 박리에서 뺍니다".
  - Uncheck organ and then bone directly: focus stays on bone, and the status reads "골격 뺌". The caption is hidden and the summary reads "골격·장기 뺌".
  - For bone and organ: the swatch background is `rgba(0, 0, 0, 0)` with an inset box‑shadow, `.ax-stop-left` reads "뺌", and the stop is `aria-disabled`.
  - Included swatches have a `background-image` containing "svg".
  - `expectApart(.ax-keep)`. Keep the existing scene/camera assertions and `desktop-excluded.png`.
  - Hover `keep('organ')`: `::after` opacity is 1, content is "장기 다시 넣기", and the `::after` computed `left` plus the label's x is at or past the nav's right edge. Shoot `desktop-hover.png` (replaces `desktop-edit.png`).
  - Then `include('organ').check()` with the existing assertions; the status reads "장기 다시 넣음".
- **b)**
  - Uncheck directly.
  - The last check has `aria-disabled="true"`, is still checked, and `toHaveAccessibleDescription(/마지막 남은 계통은 뺄 수 없습니다/)`. The others have no `aria-disabled`.
  - Keyboard‑focus the last check (Tab from the previous eye): the tip shows (opacity 1). Space leaves `excluded` unchanged, focus stays, and the status reads LAST.
  - Keep the forced click. Replace `toBeEnabled`/`toBeDisabled` with `aria-disabled` checks. The rest is unchanged.
- **c)**
  - Uncheck directly. Tab after "골격 빠른 보기" lands on "장기 포231함"; the next Tab lands on the left‑out stop. Its tip contains "장기 뺌 · 왼쪽 칸으로 다시 넣기".
  - A forced click leaves the snapshot equal, and the status equals the tip.
  - Eye view: `checks` count 0, `.ax-keep.is-static` count 7, organ and nerve swatches hollow, the others filled. The rest is unchanged.
- **d)**
  - From the region select, Tab order is: slider, then 21 names in triples "○○ 포함", "○○까지 박리", "○○ 빠른 보기" in peel order.
  - Focus "신경 포함": the tip is shown on focus.
  - Space: unchecked, status "신경 뺌 · 90%까지", focus stays. Press Space twice more, as today.
  - The Alt+Arrow part is unchanged.
- **e, f, i, l:** replace each toggle→(un)check→close/완료 sequence with a direct `check()`/`uncheck()`. Assertions and screenshots (`female-excluded.png`) stay.
- **f2:** unchanged.
- **g) phone 390×844**
  - Open the band. Its 21 targets are each ≥44×44, apart, and inside the viewport.
  - Steps sit flush under the band (±1.5). Band plus steps is ≤45% of the canvas, with no horizontal scroll.
  - The hint shows the legend, is one line (height ≤18), and passes `expectReadable`.
  - Tap "장기 포함": `excluded` becomes `['organ']`, the band stays open, and `targets` boxes are unchanged. The summary reads "장기 뺌" and the hint reads "장기 뺌". The toggle label reads "깊이 단계 선택: 0.0% · 체표 · 1개 뺌".
  - Tap the left‑out organ stop: state unchanged; the hint reads "장기 뺌 · 왼쪽 칸으로 다시 넣기".
  - `expectReadable` on `.ax-stop-name, .ax-stop-left, .depth-excluded, .depth-band-hint`. Shoot `phone-band.png` (replaces `phone-band-edit.png`).
  - Escape: closed, focus on the toggle. Reopen: organ is still unchecked.
  - Record stop and eye boxes. Tap "체표 빠른 보기" (the band closes), reopen: those boxes are unchanged and there are 7 static swatches.
  - Focus "표시 설정" by keyboard and press Enter: the band closes. Tapping a stop closes the band.
  - Keep the closed‑row count checks at 390 and 360.
- **g2) phone 360×740 (new)**
  - Repeat the target, flush, ≤45% and one‑line‑hint checks; also one line for the LAST and left‑stop notes. Shoot `phone-band-360.png`.
  - With `compare(page)`: the band shows `.panel-comparison-note` and no `.depth-band-hint`, and band plus steps is ≤45%.
- **h) landscape 844×390**
  - Closed: the toggle is ≥44×44, readable, inside the nav; `.depth-heading` and `.depth-steps` are hidden; the track is inside the nav; no overlap between the rail and the status.
  - Open:
    - 21 targets ≥44×44, apart, and inside both the band and the viewport;
    - band x ≥ nav right + 6; band bottom equals nav bottom (±1.5); band height ≤45% of the canvas;
    - `.ax-inspector` and `.cutaway-reset` are `visibility:hidden`; there is no overlap with `visibleBoxes(SCENE_TOOLS)`;
    - the aside shows the 3‑line legend, not clipped (`scrollHeight ≤ clientHeight+1`).
  - Tap "장기 포함": the band stays open, the aside reads "장기 뺌", and `.depth-toggle-count` reads "1개 뺌". Shoot `landscape-steps.png` (replaces `landscape-edit.png`).
  - Escape: closed, focus on the toggle, inspector visible.
  - Open and tap "체표 빠른 보기": layers mode, band closed, toggle text "체표만 보기", track inside the nav, and no overlap between the rail and the status. These are the judges' fatal cases.
  - Reopen: `checks` count 0, and the aside holds "현재 기준 0.0%에서 연속 박리 시작". Tap it: dissection mode, band still open, slider focused.
  - Set the viewport to 740×360 and repeat the open‑band geometry checks.
- **h2) landscape comparison (new)**
  - At 844×390 and 740×360, with `compare(page)`: open the band. `.depth-steps .panel-comparison-note` contains "전통적 대응, 압력 경로 아님", the band is ≤45% of the canvas and inside the viewport.
  - The aside holds the peel entry. Escape restores the selection card.
- **j) the 6 rail viewports**
  - Remove the toggle, picker and done steps; press checks directly.
  - Keep `stopsApart` in the three states.
  - The centre of each check hits it; `expectApart(targets)`. On touch, each target is ≥44×44 and each `.ax-stop-name` is a single line (height < 2× line‑height). At every viewport `.ax-stop` has `scrollWidth ≤ clientWidth`.
  - The nav does not overlap `visibleBoxes(SCENE_TOOLS)`.
  - The caption is visible and readable at the start, except at 1024×680 (hidden). After five systems are left out, the summary lines are readable, except at 1024×680.
  - Shoot `tablet-rail.png` at 1024×768.
- **k)**
  - With exclusions set, focus "장기 포함" and press Escape: nothing changes and focus stays.
  - At 844×390, open the band; resize to 1440×900; press `/` on the canvas. One Escape closes the search, and the nav has `data-open="false"`.
  - Presenting ends with one Escape. Drop the `data-excluding` checks.

**Other scripts**
- `scripts/audit-scene-overlays.mjs`: in the `depth` state (it now runs in landscape too), push to `panelLimit` when the union of the visible `.depth-band` and `.depth-steps` exceeds 45% of the canvas height (phone check). After `compare`, add a `depth-compare` state wherever `.depth-toggle` is visible.
- `scripts/check-readability.mjs`: also measure `.ax-depth` with the band open at 390×844.
- Re-run `peel-mode-entry`, `navigation`, `comparison-layout` and `detail-layout`. Their selectors still exist at their viewports.

## 6. Documentation
- **`docs/QUALITY_STANDARD.md`:**
  - **Line 3:** prepend "개정: 2026-10-25. 사용자 요청(“계통빼기 보다는 박리 화면에 아예 integration 하는 ui로 변경해줘.”)에 따라 Q42의 조작을 깊이 막대 각 계통 행의 ‘포함’ 칸으로 옮겼습니다([기록](system-exclusion/IMPLEMENTATION.md)). 이전 개정(2026-10-24)은 …".
  - **Q42, operation sentence** (replace "조작은 … 가로채지 않습니다."): "조작은 연속 박리 중 깊이 막대 각 계통 행 왼쪽의 ‘○○ 포함’ 칸입니다(별도 버튼·선택기·‘완료’ 없음). 레일에서는 바로, 휴대폰·가로 휴대폰은 단계 버튼으로 연 단계 띠에서 바꾸며, 바꿔도 띠는 열려 있고 초점은 그 칸에 남습니다. 남은 한 계통의 칸은 초점을 받되 바뀌지 않고 이유를 보입니다. 보이지 않는 단계 띠는 Escape를 가로채지 않습니다."
  - **Q42, explicit views:** "(그동안 버튼은 숨김)" becomes "(그동안 칸은 같은 자리의 채움·빈 견본으로만 남음)".
  - **Q42, visible signs** (replace "뺀 계통은 빈 견본 … 44px 이상입니다"): "뺀 계통은 빈 칸, 이름 옆 ‘뺌’, 요약(레일의 ‘골격·장기 뺌’·‘N%까지’, 휴대폰 띠 머리의 같은 요약, 깊이 줄·가로 화면 단계 버튼의 ‘N개 뺌’)으로 보이고, 아무것도 빼지 않은 레일은 ‘체크를 끄면 박리에서 뺍니다’를 보입니다. 데스크톱·태블릿 레일(높이 680px까지)·휴대폰 띠(폭 360px까지)·가로 휴대폰 띠(장면의 45% 이하, 열린 동안 선택 정보·절단 초기화는 비켜남)에서 단계 행은 서로·다른 도구와 겹치지 않고, 터치의 칸·이름·눈은 각각 44px 이상입니다."
- **`docs/system-exclusion/IMPLEMENTATION.md`:** add a section "## 박리 레일 통합 — 2026-10-25" containing:
  - the verbatim request and the decision with its reasons (section 0 of this spec);
  - a new screen table: screen × check × summary or caption × left‑out mark × where the hint/note shows;
  - the budgets above;
  - limits:
    - landscape 701–715 px wide: names 40–44 px wide;
    - below 360 px wide: names under 44 px;
    - coarse rails under 680 px tall, including coarse 1180×580, unchanged;
    - Firefox has no dashed track;
    - 21 tab stops;
    - rails +16 px (fine) and +48 px (coarse);
    - landscape stops are one tap away, and the inspector and cutaway reset step aside while the band is open;
    - re-including does not restore a clamped depth;
    - an eye next to a checkbox can read as show/hide;
    - visible hints are aria-hidden copies of the status and descriptions.
  - Strike the tablet one‑character‑wrap limit once j passes.
  - Verification results, including whether a VoiceOver pass was done.
  - Delete `desktop-edit.png`, `phone-band-edit.png` and `landscape-edit.png` and their references.
- **`docs/ui-renewal/COMMERCIAL_COMPARISON.md`:** a new top entry "## 2026-10-25 계통 빼기를 박리 레일에 통합". It should say:
  - per‑row include toggles in a layer list are a common pattern (the BioDigital system list below), but nothing was newly observed this time;
  - the basis is the user request and the three‑design review;
  - this is not the rejected "checkbox whose meaning changes by mode": the checks exist only during the peel and are swatches elsewhere, and the settings checkboxes stay direct combination.
- **`docs/VERIFICATION.md`:** update line 16 (operation via the rail's 포함 칸) and add a dated record with the gate counts.

## 7. Verification checklist (clean worktree, Node 24 on PATH, `PLAYWRIGHT_GPU=1` for the browser suite)
- [ ] `npm test` (unit tests including `system-exclusion.test.mjs`) and `npm run build`.
- [ ] `npx playwright test tests/browser/system-exclusion.spec.ts` (a–l, g2, h2), then `peel-mode-entry`, `navigation`, `comparison-layout` and `detail-layout`, then the full browser suite.
- [ ] `npm run audit:overlays`: 8 viewports, including the new landscape `depth` and `depth-compare` states and the 45% union check.
- [ ] `npm run test:visual`, `node scripts/check-readability.mjs` (12 px and 4.5:1 for `.ax-stop-name`, `.ax-stop-left`, `.depth-excluded`, `.depth-keep-hint`, `.depth-band-hint`, the aside and the toggle) and `npm run test:production`.
- [ ] Inspect by eye: 1440×900 (excluded and hover), 1366×768, 1180×580, 1280×720 touch, 1024×768 touch (`tablet-rail.png`), 1024×680 touch, 768×1024 touch, 390×844 (`phone-band.png`), 360×740 (with comparison), 844×390 (`landscape-steps.png`, one‑system view, comparison) and 740×360 (comparison).
- [ ] Manual checks: forced‑colors emulation (native checkbox shows), a VoiceOver (ko) pass on the rail and phone band (name, state, description, status, LAST, Escape), and a real touch‑tablet tap pass. Record any that were not done as not done.
- [ ] Update the docs in section 6 with the actual results, including any failed or skipped checks.