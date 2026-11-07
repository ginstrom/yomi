# Step 01: Design approval and the party list

[Index](index.md) · [Design](../../designs/party-list-and-gear-looks.md) §2 (Part A), §4.1 and §5.1

## Objective

1. Mark the design approved, with its two questions resolved.
2. Give the world map a list of the company's parties in an opaque 80px strip down its right side, between the header and the footer. There is one entry today. A click on the entry selects that party and centres the view on it, clearing any drag-pan. Hovering the entry shows a party summary in the info panel. The map's view narrows to end at the strip.

This covers A-R1 to A-R8 and AC1 to AC4.

## Requirements and context

- **A-R1.** A strip down the right, from `HEADER_BOTTOM` (64) to `footerTop`, with one entry per party in company order (one today).
- **A-R2.** An entry shows:
  - the leader's portrait (`members[0]`, the member the map figure is dressed from);
  - the member count;
  - a 64×6 bar of the whole party's hit points;
  - a red `!` while the party confronts monsters.
  The selected entry has a gold 3px frame (`FRAME_ACTIVE_COLOR`).
- **A-R3.** A click selects the party and centres the view on it, clearing `panOrigin` as Home does, even when the party was already selected.
- **A-R4.** The selected party is the one the left column shows and the one Home centres on. Changing the selection rebuilds the column; with one party this never happens, but the code path must exist.
- **A-R5.** Hovering an entry shows `partyListInfo(entry)` in the existing info panel.
- **A-R6.** At 840×560 the strip, info panel, header and footer buttons do not overlap. The map's `view` ends at the strip's left edge.
- **A-R7.** An entry ignores clicks while the party walks or while the outcome screen covers the map.
- **A-R8.** The list's data comes from `deployedParties`, which is the only reader of the single party.

**Acceptance criteria:**
- **AC1.** At 840×560 there is one entry at the right, inside the window and below the header. The info panel, while it shows, sits entirely left of the strip. The footer buttons are as before.
- **AC2.** After a drag-pan, a click on the entry puts the origin back to its value before the pan. The party's hex and the turn are unchanged.
- **AC3.** Hovering the entry sets the probe's `info` to the party summary, starting with "Your party".
- **AC4.** While walking, a click on the entry changes nothing.

**User decisions (2026-10-31):**
- The design is approved.
- Q1: no default horned helm; heroes show only what they wear.
- Q2: the single party is labelled "Your party".
- The stage 05/06 design edits in design §5.4 are **out of scope**.

## Dependencies and prerequisites

None. Step 02 (art) may run in parallel in a separate worktree. Step 03 later edits `WorldScene.ts` and `testHook.ts` after you.

**Current code (inspected at `3fe4c11`):**
- `src/scenes/WorldScene.ts` imports, at lines 29 to 33:
  - `clampOrigin`, `mapOrigin`, `pannedOrigin`, `pressMoved`, `rectContains` and `type Rect` from `./mapScroll.ts`;
  - `PartyColumn`;
  - `UnitFigure`;
  - `gearLayers` and the atlas names from `./unitLook.ts`;
  - `HEADER_BOTTOM`, `PARTY_PANEL_W`, `portraitClick` and `portraitRect` from `./partyPanel.ts`.
- **`layout()`** (around line 589):
  - `centreX = PARTY_PANEL_W + (width − PARTY_PANEL_W) / 2` centres the button rows, the message and the outcome screen. It stays as it is.
  - `infoBox` is at `width − INFO_MARGIN − INFO_W`, `HEADER_BOTTOM + INFO_MARGIN` (`INFO_W` 280, `INFO_MARGIN` 12, `INFO_PAD` 10).
  - `footerTop = messageY − 20`.
  - `footerBar` spans from `PARTY_PANEL_W` to `width`.
  - `column.layout(height)`.
  - `view = { x: PARTY_PANEL_W, y: HEADER_BOTTOM, width: max(0, width − PARTY_PANEL_W), height: max(0, footerTop − HEADER_BOTTOM) }`, then `applyOrigin()`.
  - `refresh()` calls `layout()` itself.
- **`applyOrigin()`** clamps any `panOrigin`, or else uses `mapOrigin(party figure point, map, view)`.
- **`recentre()`** (Home, `keydown-HOME`; Home is captured in `create` and released on shutdown):
  - It returns early when `this.walking || this.outcomeShade.visible || this.press || this.panOrigin === null`.
  - Otherwise it sets `panOrigin = null`, calls `applyOrigin()`, then `setHovered(hexAt(activePointer))`.
- **Input handlers.** The scene-level `pointerdown` returns when `over.length > 0`, so a press on any interactive object is no map press. The `pointermove` and `pointerup` handlers call `setHovered(over.length > 0 ? null : hexAt(...))`.
- **`refreshInfo()`** shows `hexInfo(...)` as `[title, '', ...lines].join('\n')` while `hovered` is set and the outcome shade is hidden. The box is sized to the text.
- **`refresh()`** calls `column.refresh(this.active)`. `this.active` is set in `create` to `max(0, party.findIndex(canAdvance))`.
- **The outcome shade** is created after the column. It is interactive, so it swallows clicks over everything created before it.
- **`src/scenes/PartyColumn.ts`:**
  - It has private colours (`COLUMN_COLOR 0x17130f`, `COLUMN_EDGE 0x4a3d28`, `FRAME_COLOR 0x6b5a3a`, `FRAME_HOVER_COLOR 0xd8c9a3`, `FRAME_ACTIVE_COLOR 0xe8c766`) and the outlined 11px monospace text style.
  - `refresh` picks the bar colour inline (`ratio > 0.5 ? 0x43a047 : ratio > 0.2 ? 0xfb8c00 : 0xe53935`).
  - It has no `destroy()`. It creates a background, an edge, and per member an image, a frame, level and `+` texts, a name text, a bar background and a fill.
  - `PartyColumn.preload` loads every portrait texture (`portraitKey`), and `WorldScene.preload` calls it.
- **Probes.** `src/testHook.ts`'s `WorldProbe` has `world`, `walking`, `origin`, `view`, `message`, `outcome`, `visible`, `info`, `buttons` and `party: PortraitProbe[]`.
- **Domain helpers.** `maxHp` is in `src/character/character.ts`. `GameState` (`party`, `world`) is in `src/game/gameState.ts`. `WorldState.confronting` is a location id or null, and `world.locations` holds each location's `id` and `name`.
- **`e2e/world.test.ts`** has local helpers `pan(game, probe, dx, dy)`, `midView`, `plus` and `following`. Its tests "recentres on the party on Home" and "ignores Home while the party walks" show the patterns. The second slows the game with `window.__yomi!.speed = 0.25`. `game.resize(w, h)` resizes.

## Scope and implementation guidance

### Task 1: mark the design approved (first)

In `docs/designs/party-list-and-gear-looks.md`:
- **§1 Status.** Replace "Status: ready for planning…" with "Status: approved by the user 2026-10-31." Say that both questions were answered with the defaults.
- **§8.** Mark Q1 resolved ("Resolved 2026-10-31: no default helm; heroes show only worn gear") and Q2 resolved ("Resolved 2026-10-31: 'Your party'"). Keep the text of the alternatives.

Change nothing else in the design, and nothing under `docs/designs/long-campaign/`.

### Task 2: Phaser-free helpers (test first)

- **New `src/scenes/partyList.ts`.** It holds exactly the contract in the index: `PARTY_LIST_W`, `FIRST_PARTY_ID`, `SINGLE_PARTY_NAME`, `PartyListEntry`, `deployedParties`, `partyEntryRect`, `partyEntryBarRect` and `partyListInfo`.
  - Use type-only imports of `Character`, `GameState` and `Hex`. `maxHp` is a runtime import from `character.ts`, which is Phaser-free.
  - `deployedParties` returns `[]` for an empty party. Otherwise it returns one entry:
    - `id`: `FIRST_PARTY_ID`;
    - `name`: `SINGLE_PARTY_NAME`;
    - `members`: `game.party`;
    - `position`: `game.world.party`;
    - `confronting`: built from `world.confronting` and that location's name;
    - `hp` and `maxHp`: summed over the members.
  - Give the module a header comment saying it is the only reader of the single party and that stage 05 maps `game.parties` here.
  - Geometry and info lines are as in the index's contract.
- **`src/scenes/partyPanel.ts`:**
  - Add `hpBarColor(ratio)`.
  - Move the column's colours there as exports.
  - `PartyColumn` uses both.
- **Tests (write them first):**
  - **New `src/scenes/partyList.test.ts`:**
    - For `newGame()` from `gameState.ts`, there is one entry with id `party_1`, the party's members and position, the summed `hp` and `maxHp`, and `confronting: null`.
    - After `travel` into a monster location, `confronting` is that location's id and name. Find one as `hexInfo.test.ts` and `worldMap.test.ts` do.
    - An empty party gives `[]`.
    - `partyEntryRect(0, w)` lies inside `[w − PARTY_LIST_W, w]` with `y > HEADER_BOTTOM`.
    - Three entries' bars end at or above 442 (`footerTop` at 840×560).
    - `partyListInfo` gives the lines for a confronting party and for a wounded one, and `1 member` for one.
  - **`src/scenes/partyPanel.test.ts`:** `hpBarColor` at 0.6, 0.5, 0.3, 0.2 and 0.

### Task 3: Phaser view

- **New `src/scenes/PartyListView.ts`.** It is a game-object counterpart of `PartyColumn`, with no logic. Its contract is in the index.
  - **Strip.** An opaque background (`COLUMN_COLOR`), interactive with no handler, so that a click between entries is no map click. An edge line on its left side (`COLUMN_EDGE`).
  - **Tile per entry, at `partyEntryRect`:**
    - the leader's portrait at `PORTRAIT_SCALE`;
    - a frame that is interactive with a hand cursor, stroked 2px `FRAME_COLOR`, lightened (`FRAME_HOVER_COLOR`) on hover, and 3px `FRAME_ACTIVE_COLOR` when selected;
    - the member count at the top left in the column's outlined 11px text (the design asks for a small person glyph; draw it as shapes or pick a glyph the monospace font surely has, so that nothing is missing);
    - a red `!` (`#e53935`, 15px, outlined) at the top right, visible while confronting;
    - the bar at `partyEntryBarRect`, filled to `hp / maxHp` in `hpBarColor`.
  - **Events.** `pointerdown` plays `sfx_ui_click` (as `PartyColumn` does) and calls `onClick(id)`. `pointerover` and `pointerout` call `onHover(id)` and `onHover(null)`.
  - **`refresh(entries, selected)`** rebuilds the tiles when the list of ids changes, and otherwise updates them in place.
  - **`layout(width, top, bottom)`** places the strip at `x = width − PARTY_LIST_W`, from `top` to `bottom`, and re-places the tiles.
  - **`probe()`** gives each tile's centre, `id`, `members` (count), `selected` and `confronting`.
- **`PartyColumn.destroy()`** destroys every object the column created.

### Task 4: WorldScene

- **Field `selectedParty: string`.** In `create()`, set it to `deployedParties(gameState)[0]?.id ?? FIRST_PARTY_ID`. Reset `hoveredParty` there too (Phaser reuses the scene instance).
- **Build order.** Build `partyList = new PartyListView(this, (id) => this.onPartyEntry(id), (id) => this.onPartyHover(id))` after the column and before `outcomeShade`, so that the shade covers it.
- **`layout()`:**
  - `view.width = max(0, width − PARTY_PANEL_W − PARTY_LIST_W)`;
  - `infoBox.x = width − PARTY_LIST_W − INFO_MARGIN − INFO_W`, with `infoText` following it;
  - call `partyList.layout(width, HEADER_BOTTOM, footerTop)`;
  - leave the footer, the header, `statusText` and `centreX` unchanged.
- **`refresh()`:** call `partyList.refresh(deployedParties(gameState), selectedParty)`, beside `column.refresh`.
- **`onPartyEntry(id)`:** return when `walking` or `outcomeShade.visible` (A-R7). Otherwise call `selectParty(id)`.
- **`selectParty(id)`:**
  1. If `id` differs from `selectedParty`, set it, then `column.destroy()` and a new `PartyColumn` for that entry's members, with the same click handler. Set `active` to the first member with something to spend (`canAdvance`), else 0. Then lay out and refresh.
  2. In every case, call `centreOnSelected()`.
- **`centreOnSelected()`** replaces `recentre()`. Home calls it.
  - Keep the guards `walking`, `outcomeShade.visible` and `press`.
  - Drop the `panOrigin === null` early return; centring an unpanned view changes nothing.
  - Clear `panOrigin`, call `applyOrigin()` (still focused on `this.party`, the one figure), and re-read the hover under the pointer as `recentre()` did.
  - Rename every reference to `recentre`, comments included.
- **Hover:**
  - Add `hoveredParty: string | null`. `onPartyHover(id)` sets it and calls `refreshInfo()`.
  - `refreshInfo()` shows `partyListInfo(entry)` (as `[title, '', ...lines]`) while `hoveredParty` is set and the outcome shade is hidden. Otherwise it behaves as today.
  - The scene's `pointermove` already clears the hex hover over an interactive object. Make sure that, when the hex hover was already null, the panel still switches to the party summary.
- **Probe.** `probe()` adds:
  - `parties: partyList.probe()`;
  - `selectedParty`;
  - `infoRect`: the info box's `{ x, y, width, height }` while it is visible, else `null`.
  Add `PartyListProbe` and the three `WorldProbe` fields to `src/testHook.ts`, with doc comments.

### Task 5: CLAUDE.md (same commit)

- **Rules of the world map, or the scene layer's world-map description.** Add the party list down the right: one entry per party, a click selecting and centring, and the view ending at the strip. Home centres on the selected party (`centreOnSelected`).
- **Helper list** ("Scene logic that can be expressed without Phaser…"): add `partyList.ts` (the parties the world map lists, the only reader of the single party, and where its entries sit).
- **Phaser-helper sentence** ("Four helpers do import Phaser…"): it becomes five, with `PartyListView.ts` (the world map's party list).
- **Panel sentence.** Where it says the info panel is "at the view's top right", keep it true.

### Exclusions

- No selection logic for several parties, no names on tiles, no banners and no time buttons.
- No change to `worldMap.ts`, saves or `mapOrigin`.
- No tutorial anchor and no new key.
- The manual is updated in step 04.

## Verification

- **Domain, first, and seen failing:** `npx vitest run src/scenes/partyList.test.ts src/scenes/partyPanel.test.ts`.
- **Browser, `e2e/world.test.ts`** (new cases; use the probes, never fixed pixels):
  - **List and layout (A-R1, A-R6, AC1).** At the default 1280×800, and again after `game.resize(840, 560)`:
    - `parties` has one entry with `selected: true` and `members` equal to the party's size;
    - its centre is inside `[width − 80, width]` with `y > 64`;
    - `selectedParty === 'party_1'`;
    - `view.x + view.width <= width − 80`.
    Hover a hex; `infoRect` is not null and `infoRect.x + infoRect.width <= width − 80`. Use `game.canvasSize()` for the width.
  - **Centring (A-R3, AC2).** `pan(...)` by 40px, then click the entry. `origin` equals the start origin, and `world.party` and `world.turn` are unchanged. A click with no pan leaves `origin` unchanged.
  - **Home still works.** The existing Home tests pass unchanged.
  - **Hover (A-R5, AC3).** `hover` the entry; `info` starts with "Your party" and includes "Click to centre the view on it."
  - **While walking (A-R7, AC4).** At `speed = 0.25`, start a journey and click the entry while `walking`. The walk ends at its target with `origin` equal to `following(arrived)`, and there is no console error (the `useGames` fixture fails on one).
  - **Confronting (A-R2).** After `travelTo(RAIDERS.position)`, the entry's `confronting` is true, and hovering it shows "Before the …".
- `npx vitest run --project scenes` (the smoke tests, `WorldScene.test.ts` included), then `npm test` and `npm run test:browser`, all green.

## Completion criteria

- [x] The design is marked approved, with Q1 and Q2 resolved; nothing under `long-campaign/` is changed.
- [x] The contracts exist exactly as in the index, and the domain tests were seen failing first.
- [x] The browser cases above pass, and all existing world tests still pass.
- [x] CLAUDE.md is updated in the same commit, and no `recentre` mention is left.
- [x] This step's status and commit are recorded in the index.

## Execution record

Implemented 2026-10-31 on `armor-resistance`, one commit (hash in the index).

**What was built**
- Design §1 marked approved and Q1/Q2 marked resolved; nothing under `docs/designs/long-campaign/` touched.
- `src/scenes/partyList.ts` with the index's contract exactly (`PARTY_LIST_W`, `FIRST_PARTY_ID`, `SINGLE_PARTY_NAME`, `PartyListEntry`, `deployedParties`, `partyEntryRect`, `partyEntryBarRect`, `partyListInfo`).
- `partyPanel.ts`: `hpBarColor` and the exported colours `COLUMN_COLOR`, `COLUMN_EDGE`, `FRAME_COLOR`, `FRAME_HOVER_COLOR`, `FRAME_ACTIVE_COLOR`; `PartyColumn` uses them and gains `destroy()`.
- `src/scenes/PartyListView.ts` (class `PartyListView`), the member count drawn beside a small person drawn as shapes (no font glyph).
- `WorldScene`: `selectedParty`, `hoveredParty`, `onPartyEntry`, `onPartyHover`, `selectParty(id)`, `centreOnSelected()` (replaces `recentre()`, without the `panOrigin === null` early return); the view and the info panel end at the strip. `selectParty` with a different id rebuilds the column and brings the outcome screen's objects back to the top so it still covers the new column.
- `testHook.ts`: `PartyListProbe`; `WorldProbe.parties`, `selectedParty`, `infoRect`.
- Root CLAUDE.md: world-map rules (list, `centreOnSelected`), helper list (`partyList.ts`), Phaser helpers now five (`PartyListView.ts`).

**Verification**
- `npx vitest run src/scenes/partyList.test.ts src/scenes/partyPanel.test.ts`: seen failing first (module and `hpBarColor` missing), then 15 passed.
- `npx vitest run --project scenes`: 9 passed.
- `npm test`: 68 files, 807 tests passed.
- `npm run build`: succeeds (the usual chunk-size warning only).
- `npm run test:browser -- e2e/world.test.ts`: 29 passed, including the five new cases (list and layout at 1280×800 and 840×560, centring after a pan, hover summary, click while walking, confronting marker) and the unchanged Home tests.
- `npm run test:browser` (full): 9 files, 72 tests passed (193 s).
- A screenshot at 840×560 while confronting and hovering the entry was checked by eye: the strip, gold frame, count, red "!", bar and the info panel left of the strip, footer buttons unchanged.

**Deviations and notes**
- The browser cases were written after the scene code, so they were not seen failing first; the domain tests were.
- The `e2e/world.test.ts` names "recentres on the party on Home" and "The pan is over, so Home recentres" keep the English verb; the plan asked for the existing Home tests to stay unchanged. No `recentre` identifier remains in `src/` or CLAUDE.md.
- No budgets spent (no paid calls).

**For later steps**
- Step 03 edits `WorldScene.ts` and `testHook.ts` after this; the new fields sit beside `party` in `WorldProbe` and in `probe()`.
- Step 04's manual text can describe the list as built: entry, "!", gold frame, hover summary, click to centre.


### Review round 1

Found 5; fixed 5 (the AC4 walking test and the "recentres" test names were accepted as they are).

1. **Blocking: entries drew above the outcome shade.** `PartyListView` now makes a Container (`entryLayer`) in its constructor, before the shade, and adds every tile's objects to it, so a rebuild stays under the shade. A second, older defect came up while writing the test: `outcomeShade` was made 0×0 before `setInteractive()`, so Phaser gave it no hit area (`input` undefined) and it never swallowed a hover or click over anything, not only the list. It is now made 1×1, and `layout()`'s `setSize` grows the hit area. Test: "keeps the party list under the outcome screen, taking no hover or click" (in a `lost` state, hovering the entry leaves `parties[0].hovered` false, and a click changes neither `info` nor `origin`). It was seen failing before the fixes, and it fails again with the container removed and only the shade fixed, so the test needs both fixes. The coordinator's cursor check could not be used: over the shade the canvas cursor is already `pointer`, left over from the menu's Continue button, so the probe gained the signal instead: **`PartyListProbe.hovered: boolean`** (an addition to the index contract, which nothing later depends on).
2. **Drag from the strip.** Test "neither pans nor travels on a drag that starts on the party list": a drag from the entry, and from the strip between entries, into mid-view leaves `origin`, `turn` and `walking` unchanged. It passed at once; the strip's interactive background already made it no map press.
3. **Column from the selected entry.** `create()` now sets `selectedParty` first, then builds the column and `active` from `selectedMembers()` (the selected entry's members via `deployedParties`, falling back to `game.party` for an empty party), the same path as `selectParty`.
4. **Stale party hover.** The PAUSE and GAME_OUT handlers call `clearPartyHover()`, which clears `hoveredParty`, refreshes the info panel, and calls the new `PartyListView.clearHover()` so the frame's hover stroke goes too. Test "forgets the hovered entry when the pointer leaves the game or the menu opens": it was seen failing at the GAME_OUT step before the fix. The menu half was not run red separately; without the fix `setHovered(null)` returns early when no hex is hovered, so the panel would keep the party summary.
5. **Index:** the commit column now names `c90b008`.

Verification after the round: `npm test`: 68 files, 807 tests passed. `npm run test:browser`: 9 files, 75 tests passed.
