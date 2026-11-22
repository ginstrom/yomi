# Step 03: The Routes tab pages

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-09-outer-rings.md) (§2 "Partners") · [Stage 8's Routes tab](../long-campaign-stage-08/06-routes-tab-and-debug.md) · [Feature record](../../features/long-campaign-stage-09.md) (carried item 1) · [Plan log](log.md)

**Difficulty:** sonnet / opus. The engineer (`model: "sonnet"`) reuses a pager the trading post's other tabs already have, under a fixed contract; no rule changes. The reviewer (opus) checks the layout at 840×560, the selection across pages and that the in-browser test really pages.

## 1. Objective

The trading post's Routes tab shows its partner rows page by page once there are more than `ROUTE_ROWS` (4), with the same Prev / Next pager and "Page N of M" the Buy and Sell tabs use. Step 05 brings the partners to five (Millbrook, Saltmere, Stonehollow, Elder Glade, Emberwatch), so this step must land before it.

## 2. Requirements and context

- **Carried from stage 8** (feature record, carried item 1): the Routes tab draws at most 4 rows with no paging, and `src/scenes/routesTab.test.ts` (line ~258, `describe('the Routes tab')`) asserts `PARTNERS.length <= ROUTE_ROWS`, which fails once step 05 adds the far partners.
- **S9-R4** (design): the far partners are added; every contacted partner must be reachable on the Routes tab.

### Decision from the index (unchanged)

10. **The Routes tab pages** (carried from stage 8): with five partners its four rows are not enough, and `routesTab.test.ts` asserts `PARTNERS.length <= ROUTE_ROWS`. Step 03 adds paging and must land before step 05 adds the partners.

### Contract produced (copied unchanged from the index)

**C3. The Routes tab pages (step 03)**

```ts
// src/scenes/routesTab.ts: ROUTE_ROWS (4) is the rows a page shows; routeRows is unchanged
// src/scenes/TradingPostScene.ts: the Routes tab shows rows page by page with the pager the other tabs use ("Page N of M", Prev, Next)
//   once there are more than ROUTE_ROWS; turning a page selects that page's first row, and the minimap and notes follow the selection
// The Routes tab's probe lists the rows of the page shown, and the pager's buttons as the other tabs' probes do.
// routesTab.test.ts: the `PARTNERS.length <= ROUTE_ROWS` assertion goes.
```

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file; `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test.
- **The refactor guard and the 50-campaign check:** this step changes no rule and no simulator code, so it must keep `scripts/simulate.test.ts`'s refactor guard green without touching the fixture and need not run the 50-campaign check (say so in the record).
- **Determinism.** Nothing here draws from any RNG.
- **Commits.** One commit once `npm test` and the in-browser tests pass, on `long-campaign-stage-09` or this step's worktree branch (merged by the orchestrator), without pushing; files staged by path. Message "Stage 9 step 03: the Routes tab pages". No attribution lines.
- **Docs.** CLAUDE.md files stay current; the manual's text for the screen changes here (`.claude/skills/yomi-manual/`); the screenshot is retaken in step 10.

## 3. Dependencies and prerequisites

- **None.** Run any time before step 05, on the stage branch or in its own worktree; it may run beside steps 01 and 02. It touches only `src/scenes/`, `src/testHook.ts`, `e2e/`, `docs/reference/scenes.md` and `docs/manual/README.md`. The index's task table is the only shared file (update your row only).
- **No partner exists yet beyond Millbrook and Saltmere** while this step runs (the far partners come in step 05), so more than four rows cannot come from `contact all`. See §4.4 for how to test paging anyway.

### Existing code (inspected at `08854d3`)

- `src/scenes/routesTab.ts`: `export const ROUTE_ROWS = 4` (line ~15, "How many partners' rows the Routes tab draws; more partners need paging"); `routeRows(game, party)` gives a `RouteRow` per contacted partner in contact order.
- `src/scenes/TradingPostScene.ts`:
  - `private page = 0` (~148), reset to 0 in `create`, `show(tab)` and `setFilter`; `turnPage(by)` (~634) adds and re-renders.
  - `rowsPerPage` (BUY or SELL rows a page) and `pageY` (`listTop + rowsPerPage * ROW_H + 18`, ~260): laid out for the Buy and Sell lists, not for the route rows (`ROUTE_TOP + i * ROUTE_ROW_H`).
  - `render` (~343–371): `rows()` returns `[]` for the Routes tab, so `pages` is 1 there and the pager is never drawn for it; the pager draws `prev` / `next` with `this.button(...)` (in the probe's `buttons`) and the "Page N of M" text.
  - `drawRoutes` (~466): `const rows = all.slice(0, ROUTE_ROWS)`; the chosen row is `this.routeChosen` or the first; the heading counts `world.routes.length`, not the rows; then `drawRouteRow` per row and `drawMinimap(chosen)`.
  - `chooseRoute(partner)` sets `routeChosen`.
- `src/testHook.ts`: `TradingPostProbe` (its `routes` list and `buttons`, among them `prev` and `next`).
- `e2e/encampment.test.ts` (~691): the Routes tab test (contact, open a route, a nest beside the road) reads `tab.routes`.

## 4. Scope and guidance

1. **Page the route rows.** In `drawRoutes`, show `all.slice(page * ROUTE_ROWS, (page + 1) * ROUTE_ROWS)`, with the page clamped to the pages there are (a partner list never shrinks, but keep the clamp as `render` does). Draw the pager under the route rows (its own y below `ROUTE_TOP + ROUTE_ROWS * ROUTE_ROW_H`, not `pageY`, which is the Buy/Sell list's), only when there are more than `ROUTE_ROWS` rows, with the same `prev` / `next` buttons, labels and "Page N of M" text the other tabs use. Reusing `this.page` and `turnPage` is the obvious way; whether the shared `pages` computation in `render` learns the Routes tab's row count or `drawRoutes` draws its own pager is yours, so long as there is one pager drawn and the probe's `prev` / `next` are the Routes tab's while it shows.
2. **Selection on a page turn.** Turning a page selects that page's first row (`routeChosen` set to it), so the minimap, the notes and the refusal under it follow. A row chosen on one page and then paged away from is not kept. Opening the tab, or coming back to it, starts at page 1 with its first row (as `show` already resets).
3. **Layout.** Everything fits the frame at 840×560 (`MIN_GAME_SIZE`) as today: the pager must not overlap the minimap, its notes stack, the message line or Close. Check by the probe's rects in the in-browser test, and by eye.
4. **Tests.**
   - Remove the `PARTNERS.length <= ROUTE_ROWS` assertion in `routesTab.test.ts`. If you extract a Phaser-free helper for the page's rows (for example the slice and the page count from `routeRows`), test it there: 0, 4, 5 and 9 rows. Otherwise the in-browser test carries the check; say which in the record.
   - **In-browser**, in `e2e/encampment.test.ts`: with more than four contacted partners, the Routes tab shows four rows and the pager; Next shows the rest and selects the first of them (the minimap's road and the probe's selected row follow); Prev comes back. Getting five partners before step 05: `contact all` gives only two, and the debug console cannot add a partner. Choose one and record it:
     - plant a save (`localStorage` `yomi.save.N`, through `page.evaluate`, as `e2e/CLAUDE.md` allows) whose world has extra partner locations made with `newWorld`'s `partners` parameter, contacted; or
     - write the test now against whatever five-partner setup you can make, or mark it pending (`it.todo` or a short note) and leave the real five-partner run to step 05 or step 07, which have the far partners (say so in the record and in the index's row, so step 05 or 07 picks it up).
   - The existing Routes tab test (two partners) still passes, with no pager drawn.
5. **Docs.**
   - `docs/reference/scenes.md`, the Routes tab paragraph: "at most four drawn" becomes four a page with the pager; how a page turn selects.
   - `docs/manual/README.md`, the Routes bullet of the trading post: more than four partners page with Prev and Next (`.claude/skills/yomi-manual/`). The screenshot is retaken in step 10, not here.
   - `routesTab.ts`'s doc comment on `ROUTE_ROWS`.
6. **Exclusions:** no change to `routeRows`, `routeOffer`, `routeState`, the minimap's drawing or any rule; no partner added (step 05); no other tab's paging changed.

## 5. Verification

- `npm test` passes (the refactor guard untouched and green).
- `npm run test:browser -- -t "Routes"` (or the file `e2e/encampment.test.ts`) passes, the new paging test included or, if deferred, the reason recorded.
- By eye at 840×560: the tab with two partners looks as before; with more than four, the pager sits under the rows and clear of the minimap stack.

## 6. Completion criteria

- [ ] The Routes tab pages its rows by `ROUTE_ROWS` with the shared pager; a page turn selects the page's first row; the probe lists the page's rows and the pager's buttons (C3).
- [ ] The `PARTNERS.length <= ROUTE_ROWS` assertion is gone; paging is tested (unit and/or in-browser), or the in-browser part is explicitly handed to step 05 or 07 in the index.
- [ ] `docs/reference/scenes.md` and the manual's Routes text current.
- [ ] `npm test` and the in-browser tests pass; the record says the guard and the 50-campaign check were not needed (no rule change).
- [ ] One commit, "Stage 9 step 03: the Routes tab pages", files staged by path, no attribution lines; the index's row 03 updated with status and commit.

## 7. Execution record

Engineer (sonnet), worktree branch `worktree-agent-a5482eb04e40c66ed`.

- `TradingPostScene.ts`: `rowsPerPage`, `pageY` and the `pages` count in `render` learned the Routes tab (`ROUTE_ROWS` a page, count from `routeRows`), so the one shared pager is drawn and the probe's `prev` / `next` are the Routes tab's; `drawRoutes` slices by `this.page`; `turnPage` sets `routeChosen` to the new page's first row; `show` resets to page 1. Layout: with more than four rows they are 64 px tall (`ROUTE_PAGED_ROW_H`; 72 otherwise, so the two-partner tab looks as before) and the pager sits at y 424, clear of the message line (462) and Close. `routesTab.ts` doc comment updated; the `PARTNERS.length <= ROUTE_ROWS` test removed with its two imports. No Phaser-free helper extracted: the in-browser test carries the paging check.
- In-browser test (`e2e/encampment.test.ts`, "pages the Routes tab ..."): plants a save with three extra contacted partners (stonehollow, elder_glade, emberwatch) at 840x560; checks four rows, the pager under them, Next selects the page's first row (emberwatch alone), Prev returns to page 1 with millbrook selected.
- Docs: `docs/reference/scenes.md` Routes paragraph and the manual's Routes bullet; screenshot left to step 10.
- Results: `npm run test:browser -- -t "Routes tab"` 3 passed. `npm test`: 2544 passed, 1 failed: `scripts/records.test.ts` "keeps each new plan index under 32000 bytes" (stage 9 index.md is 34741 bytes; not from this step, and this run may not edit the index). Refactor guard green, fixture untouched; the 50-campaign check was not needed (no rule change). Index row 03 not edited, per the run brief.

Review round 1 (found 4, fixed 4): (1) paged rows are now 69 px (round 2) starting at y 142 with the pager at y 431; checked by eye at 840x560 with partners planted beside a sighted nest: a four-line "Raided at once." row sits inside its box with margin, pager clear of Close and the message line. (2) planted ids are planted_1..3. (3) the two-partner Routes test asserts `buttons.prev` and `next` are not visible. (4) `routeRows` is computed once a render (`routeAll`), used by `drawRoutes` and `turnPage`. `npm test` still fails only on the plan-index size test; browser "Routes tab" 3 passed.

Review round 2 (found 1, fixed 1): the pager overlapped the fourth paged row by about 1 px; paged rows are now 69 px (top y 142) and the pager is centred at y 431. Seen at 840x560 with a four-line offer: the pager sits just under the last row; the two-line message fit is by the numbers (pager bottom 444, message top about 448.6), the screenshot showed a one-line message. Browser "Routes tab" 3 passed; `npm test` fails only on the plan-index size test.
