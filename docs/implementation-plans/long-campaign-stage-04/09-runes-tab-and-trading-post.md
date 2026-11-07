# Step 09: The Runes tab and the trading post's Runes

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-04-runes.md) (§2 "Scenes", §4, §6 "Play script", §7 "Risks", S4-R3, S4-R4, S4-R6) · [Reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.4, §5.7 · [Stages index](../../designs/long-campaign/index.md)

**Difficulty:** judgement-heavy. The design names this UI the stage's heaviest piece (design §7), and its layout and flows need the session's model (engineer opus, reviewer opus). Mechanical probe or test additions may go to `model: "sonnet"`.

## 1. Objective

Give the player the screens for runecraft and for buying and selling runes:
- **crafting** gets two tabs, Modify (today's screen, unchanged) and Runes;
  - the Runes tab lists the party's socketed items, their sockets, and the pouch, with embed, extract and fuse, each with its cost or refusal, in a select, act and confirm flow;
  - from the map's Craft button, a rank-1 embed is a field embed: it passes a day, and the map reports it as a field craft;
- **the trading post** gets a Runes filter on its Buy tab, and the pouch's runes on its Sell tab;
- **the encampment screen** says what the workshop and the trading post do with runes at each level;
- **the probes** expose all of it, and scene and in-browser tests cover the play script's flows.

The screens decide nothing: every cost, refusal and effect comes from `runecraft.ts` (step 06) and `tradingPost.ts` (step 07).

## 2. Requirements and context

- **Design §2 (Scenes):** "`CraftingScene` gains a Runes tab: the pouch, the item's sockets, and embed, extract and fuse." "The trading post gets a Runes section." Embedding works at the workshop at any level, or in the field for rank 1, taking a day. Fusing to rank 2 needs workshop level 1. Fusing to ranks 3 and 4 needs levels 4 and 5, which stage 10 adds, so the refusal names the level. Extracting needs level 2.
- **Design §4:** at the workshop's Runes tab, a Masterwork Iron Longsword shows one empty socket. Embedding the Ember rune makes it "Masterwork Iron Longsword [Ember I]".
- **Design §7:** keep the flows to select, act and confirm.
- **The play script (design §6), the parts this step's screens carry:**
  1. `stock gold 300` and `facility trading_post 3`. Buy a Masterwork longsword and two Lesser Ember runes, then `facility workshop 2`.
  2. At the workshop, embed one rune, and see the name and the tooltip change. Extract it, see the fee, and see it back in the pouch.
  3. Fuse three Lesser Storm runes (from `give storm1 3`) into a Storm rune. A fourth fuse, to rank 3, is refused, naming workshop level 4.
  5. Embed a rank-1 rune in the field. One day passes.

  (Step 1 needs a level 2 post for runes: rank-1 runes are sold from level 2, and level 3 sells Masterwork.)
- **Corrections from the index** this step relies on:
  - **1.** Runes sit compact in their sockets. `embed` takes no socket index: it fills the next empty socket. `extract` takes the index of the rune in `item.runes`, and the rest close up. `fuse` takes the rune key being fused from (`fuse(game, 'storm1')` makes a `storm2`).
  - **16.** A field embed reports as a field craft does. It closes the crafting screen and resumes `World` with `CraftedData` (`crafted.item` is the new item's name, and `events` the day's).
  - **18.** Fusing checks the workshop level before the count, so a fuse to rank 3 with a single rank-2 rune is refused naming workshop level 4.
- **Contract C10, step 09's part** (copied unchanged from the index):
  - **Step 09 (the Runes tab and the trading post):**
    - *Crafting.* `CraftingScene` gains a Modify tab (today's screen) and a Runes tab.
      - The Runes tab lists `socketables`. A click on one shows its sockets: each filled one with Extract and its cost, or the refusal. The pouch is listed with Embed (into the selected item) and Fuse for each key. A click on an action shows its cost and effect, and Confirm does it. This is the select, act and confirm flow of design §7.
      - A field embed closes the screen and resumes `World` with `CraftedData` (correction 16).
    - *The trading post.* `TradingPostScene` gains a Runes filter on the Buy tab, after the slot buttons, which lists `runeWares` with prices. The Sell tab lists the pouch's runes after the materials, at `runeSalePrice`.
    - *The encampment.* `encampment.ts` adds the rune lines to the descriptions:
      - the workshop: embedding at any level, fusing to rank 2 from level 1, extracting from level 2;
      - the trading post: rank-1 runes from level 2, rank 2 from level 4.
    - *The probes.*
      - `CraftingProbe` gains `tab: 'modify' | 'runes'`, `sockets: Array<ButtonProbe & { index: number; rune: RuneKey | null }>`, `pouch: Array<{ key: RuneKey; count: number; embed: ButtonProbe; fuse: ButtonProbe }>` and the buttons `modifyTab`, `runesTab`, `confirm`.
      - `TradingPostProbe.rows[].kind` gains `'rune'` (id `rune:<key>`), `filter.slot` may be `'runes'`, and it gains a `runesButton: ButtonProbe`.
- **Shared constraints (from the index):**
  - `npm test` (`tsc && vitest run`) passes before the commit (local Node 26: `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or `make test`).
  - The in-browser tests pass after this scene change: `npm run test:browser` (or `make test-browser`). Read `e2e/CLAUDE.md` before adding one.
  - `src/scenes/*Scene.test.ts` are smoke tests under jsdom with Phaser. Real behaviour is tested in the domain (steps 06 and 07) and in Phaser-free helpers. A helper in `src/scenes/` must not import Phaser at runtime.
  - Game code must not read the test hook or the probes. A control a test clicks goes in its scene's probe.
  - A scene that redraws itself after a change does so on the next tick, and its new buttons take clicks only from the frame after (CLAUDE.md).
  - One commit for this step, on `long-campaign-stage-04`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
  - CLAUDE.md stays current: this step edits only its own scene lines (below). If step 10 commits first, rebase this step's CLAUDE.md edit on it.

## 3. Dependencies and prerequisites

**Steps 06, 07 and 08 are done.** What they produce (from the index's contracts; this step consumes them and does not change them):

- **From step 06, `src/game/runecraft.ts` (C6):**

  ```ts
  export const EMBED_GOLD_PER_RANK = 5          // gold × the rune's rank
  export const FUSE_GOLD_PER_RANK = 10          // gold × the new rank
  export const EXTRACT_GOLD_PER_RANK = 10       // gold × the rune's rank
  export const FUSE_COUNT = 3
  export const FUSE_LEVELS: Record<2 | 3 | 4, number>     // { 2: 1, 3: 4, 4: 5 }
  export const EXTRACT_LEVEL = 2
  export function embedCost(key: RuneKey): Stock
  export function fuseCost(from: RuneKey): Stock          // the new rank's
  export function extractCost(key: RuneKey): Stock
  export type RuneResult = { refusal: string } | { refusal: null; item: Item; events: WorldEvent[] }
  export function socketables(game: GameState): Array<{ place: ItemPlace; item: Item; sockets: number }>
  export function embedRefusal(game: GameState, place: ItemPlace, key: RuneKey): string | null
  export function embed(game: GameState, place: ItemPlace, key: RuneKey): RuneResult
  export function extractRefusal(game: GameState, place: ItemPlace, index: number): string | null
  export function extract(game: GameState, place: ItemPlace, index: number): RuneResult
  export function fuseRefusal(game: GameState, from: RuneKey): string | null
  export function fuse(game: GameState, from: RuneKey): string | null
  ```

  Embedding works at a workshop (any level) for any rank, and in the field (`craftTier(world) === 'field'`, the encampment without a workshop included) for rank 1 only, where `canCamp`, taking a day (`passTurn`, whose events come back in `RuneResult.events`). Fusing needs `FUSE_LEVELS[new rank]` and checks it before the count. Extracting needs level 2. Each refusal is a sentence naming what is needed. `clampHp` runs after a change to a worn item.
- **From step 07, `src/game/tradingPost.ts` (C8):**

  ```ts
  export const RUNE_PRICES: Record<Rank, number>              // { 1: 15, 2: 45, 3: 135, 4: 405 }
  export const SHOP_RUNES: readonly RuneId[]                  // ['ember', 'rime', 'storm', 'stone', 'wind', 'life']
  export const RUNE_RANK_LEVELS: Partial<Record<Rank, number>>  // { 1: 2, 2: 4 }
  export function runePrice(key: RuneKey): number
  export function runeSalePrice(key: RuneKey): number         // a third of the price, rounded down
  export function runeWares(world: WorldState): RuneKey[]
  export function buyRuneRefusal(game: GameState, key: RuneKey): string | null
  export function buyRune(game: GameState, key: RuneKey): string | null
  export function sellRune(game: GameState, key: RuneKey): string | null
  ```

  `salePrice(item)` already counts a runed item's runes (half their price); the Sell tab's item rows need no change for it.
- **From step 08, `src/scenes/itemIcons.ts` (C9):**

  ```ts
  export const RUNE_ICON_KEYS: Record<RuneId, string>                         // 'icon_rune_ember', …
  export const SOCKET_PIP_KEYS: { empty: string; filled: string }             // 'icon_socket_empty', 'icon_socket_filled'
  export const RUNE_COLOURS: Record<RuneId, number>
  export function socketPips(item: Item): Array<RuneId | null>
  ```

  Step 08 already loads these images in `InventoryScene`, `TradingPostScene` and `CraftingScene`, and draws item pips along the bottom of an icon in `InventoryScene` only (`createPips` in `src/scenes/socketPips.ts`, with `pipOffsets` and `socketPips` in `itemIcons.ts`). The trading post and crafting rows have no pips yet: this step should draw them with `createPips`, not a copy.
- **From steps 03 and 04 (C1, C4):** `runeName`, `runeLabel`, `rankNumeral`, `parseRuneKey`, `pouchKeys`, `pouchCount`, `socketLines`, `RUNES[id].describe` in `src/inventory/runes.ts`. `GameState.runes: Pouch`, saved. The debug console's `give storm1 3` puts runes in the pouch.
- **Existing code:**
  - `src/scenes/CraftingScene.ts`: today's list of craftables on the left, options on the right, the `Work it` button, paging, `CraftingData { game; resume?: 'World' }`, and `CraftedData { crafted: { item: string; events: WorldEvent[] } }`. A field craft stops the scene and resumes `World` with `CraftedData`.
  - `src/scenes/WorldScene.ts`: `crafted({ item, events })` reports "A day's work makes the <item>." and the day's events, on resume.
  - `src/scenes/TradingPostScene.ts`: the Buy and Sell tabs, the slot and family filter (opening on `mainHand`), eight lines a page, and `rows` of kind `'item' | 'material'`.
  - `src/game/encampment.ts`: `FACILITIES` with `about` and `effect(game, level)` per facility (the trading post's and workshop's entries).
  - `src/testHook.ts`: `CraftingProbe` and `TradingPostProbe`.
  - Tests: `src/scenes/CraftingScene.test.ts`, `src/scenes/TradingPostScene.test.ts`, `e2e/encampment.test.ts` (its `richAtHome(game, stock, postLevel, plant)` helper plants stock, the post's level and any saved value by dotted path, which can plant `runes` and items in the save).

## 4. Scope and implementation guidance

### 4.1 Crafting: the Modify and Runes tabs

- **Tabs.** Two tab buttons along the top of the frame, Modify and Runes (`modifyTab`, `runesTab` in the probe). Modify is today's screen, unchanged in behaviour, and the scene opens on it. Switching tabs clears the selection and the message.
- **The Runes tab, select:** the left list shows `socketables(game)`, paged as the Modify list is, each row the item's icon with its pips, its name and where it lies (member or baggage). An empty list says the party has nothing with a socket.
- **The Runes tab, act:** with an item selected, the right side shows:
  - **its sockets**, one row each, `index` from 0 to `sockets − 1`: a filled one shows the rune's icon, `runeLabel` and its effect there (`RUNES[id].describe[slotClass]` or `socketLines`), with an Extract action; an empty one says so;
  - **the pouch** (`pouchKeys`), one row a key with its icon, `runeName`, count, and two actions, Embed (into the selected item) and Fuse. Fuse does not need a selected item. With no item selected, the pouch still shows, with Embed disabled.
  - An action is greyed when its refusal (`embedRefusal`, `extractRefusal`, `fuseRefusal`) is non-null, but stays clickable so its refusal can be read.
- **The Runes tab, confirm:** a click on an action shows a preview in the right-hand panel:
  - the action and its cost (`embedCost`, `extractCost`, `fuseCost` through `describeCost`);
  - what it does: for embed and extract, the item's name and stat lines before and after (`compareLines` in `gearCompare.ts`, with the item built by `withRunes`); for fuse, "3 × Lesser Storm Rune → Storm Rune";
  - the refusal in the refused colour, if any.

  Confirm (`confirm` in the probe) calls the domain function, sets the message to what was done or the refusal, and redraws on the next tick. After an embed or extract the selection follows the item to its new id at the same place (the place key does not change).
- **The field embed (correction 16):** when the scene was opened with `resume: 'World'` and `craftTier` is `'field'`, a successful embed (rank 1 only, the domain says) stops the scene and resumes `World` with `CraftedData`, `crafted.item` the new item's name and `events` from `RuneResult.events`, exactly as a field craft does. `WorldScene.crafted` reports it as "A day's work makes the <item>." with no change there. Extract and fuse are always refused in the field (they need a workshop); show the refusal.
- **Keep logic out of the scene.** Anything beyond drawing and wiring (which rows a pouch key gets, the preview lines of an action, the fuse line's words) goes in a Phaser-free helper, either beside the existing ones in `gearCompare.ts` or a new `src/scenes/runecraftView.ts`. If a new helper module is added, give it its own `*.test.ts` in the domain project and a line in CLAUDE.md's list of scene helpers.

### 4.2 The trading post's Runes

- **Buy tab:** a Runes button after the slot buttons (`runesButton`). With it selected, `filter.slot` is `'runes'`, the family buttons are empty, and the rows are `runeWares(world)` (kind `'rune'`, id `rune:<key>`, price `runePrice`), each with its icon and `runeName`. A click shows the rune's effects by slot class (`RUNES[id].describe`) and its price; Confirm calls `buyRune` and shows the message or the refusal (`buyRuneRefusal`). Below level 2 the list is empty with a line saying a level 2 post sells runes.
- **Sell tab:** after the materials, one row a pouch key (kind `'rune'`, id `rune:<key>`, price `runeSalePrice`). Confirm sells one (`sellRune`).
- Opening the Buy tab still resets the filter to weapons (today's behaviour).

### 4.3 The encampment's descriptions

In `src/game/encampment.ts`, extend the `effect` lines:
- **the workshop:** level 1 "… Sets runes, and fuses three Lesser runes into one.", level 2 "… Takes runes out again, for a fee.", level 3 unchanged in its rune part (the higher fusions need stage 10's levels);
- **the trading post:** from level 2 "… and Lesser runes", from level 4 "… and runes up to the plain rank".

Exact wording is the implementer's; each level's line must say what that level adds for runes, and the existing tests of `encampment.ts` updated for it.

### 4.4 Probes

In `src/testHook.ts` and each scene's `probe()`:
- `CraftingProbe`: `tab: 'modify' | 'runes'`; `sockets: Array<ButtonProbe & { index: number; rune: RuneKey | null }>` (the selected item's, empty when none); `pouch: Array<{ key: RuneKey; count: number; embed: ButtonProbe; fuse: ButtonProbe }>`; `buttons` gains `modifyTab`, `runesTab`, `confirm`. On the Runes tab `items` lists the socketables (same shape, `id` the place key) and `preview` the confirm panel's lines; `message` as now.
- `TradingPostProbe`: `rows[].kind` may be `'rune'` with id `rune:<key>`; `filter.slot` may be `'runes'`; `runesButton: ButtonProbe`.

### 4.5 CLAUDE.md

Update the scene layer's lines: `Crafting` has Modify and Runes tabs (the Runes tab lists the socketed items, their sockets and the pouch, with embed, extract and fuse, select then confirm; a field embed resumes `World` as a field craft does); `TradingPost`'s Buy tab has a Runes filter after the slots and its Sell tab lists the pouch's runes after the materials; and any new helper module. Search CLAUDE.md for the crafting and trading post sentences and edit them in place.

### 4.6 Out of scope

- The domain rules (steps 06, 07): if a refusal or cost is wrong, record it and fix it in the domain with its test, not in the scene.
- Tooltips, the wards line, pips on the inventory, battle text and the victory line (step 08).
- The manual and its screenshots (step 11).

## 5. Verification

1. **Scene smoke tests** (`npx vitest run src/scenes/CraftingScene.test.ts src/scenes/TradingPostScene.test.ts`):
   - Crafting opens on Modify; the Runes tab lists a planted `iron_sword@3` with one empty socket and the pouch's runes; embedding `ember1` at a workshop changes the item to `iron_sword@3#ember1` named "Masterwork Iron Longsword [Ember I]"; a refused action shows its refusal and changes nothing.
   - Opened with `resume: 'World'` in the field, a rank-1 embed stops the scene and resumes `World` with `CraftedData`.
   - The trading post's Runes filter lists the six Lesser runes at a level 2 post and none at level 1; buying one adds it to the pouch; the Sell tab lists pouch runes at a third of their price.
2. **Helper tests** (domain project), if a helper was added: `npx vitest run src/scenes/<helper>.test.ts`.
3. **In-browser tests** in `e2e/encampment.test.ts` (read `e2e/CLAUDE.md`; drive through probes, wait on state, no sleeps). Plant the start with `richAtHome` (stock, post level, and by path `world.workshop`, `runes`, and an item such as `party.0.equipment.mainHand` = `'iron_sword@3'`). Cover the play script's flows:
   - buy two Lesser Ember runes at a level 2 or 3 post, and see them in the pouch;
   - at a level 2 workshop, embed one into the Masterwork longsword: the name gains "[Ember I]" and the gold falls by 5; extract it: the gold falls by 10 and the rune is back in the pouch;
   - with three `storm1` planted, fuse them into one `storm2` (gold −20); fusing the `storm2` is refused, the message naming a level 4 workshop;
   - from the map's Craft button away from the encampment, embed a rank-1 rune: the scene closes, the map's turn is one more and its message tells of the day's work.

   Run `npm run test:browser -- -t <name>` for each new test, then the whole `npm run test:browser` (or `make test-browser`), all passing with no console errors.
4. `npm test` passes.
5. **By eye** (`npm run dev`, with the debug console): the Runes tab and the trading post's Runes filter fit the frame at the minimum size (840×560) and at a large window; the confirm panel's lines do not overrun.

## 6. Completion criteria

- [x] Crafting has Modify and Runes tabs; embed, extract and fuse work through select, act and confirm, every refusal shown from the domain.
- [x] A field embed passes a day and is reported on the map as a field craft.
- [x] The trading post buys runes through a Runes filter and sells the pouch's runes.
- [x] The encampment's workshop and trading post lines say what each level does for runes.
- [x] `CraftingProbe` and `TradingPostProbe` carry the fields of C10.
- [x] Scene smoke tests and the in-browser tests above pass; `npm test` passes.
- [x] CLAUDE.md's scene lines updated.
- [x] One commit on `long-campaign-stage-04`; the index's step 09 row set to `done` with the commit; the execution record below filled.

## 7. Execution record

**Commits.** `cea4f9b` (runed names in square brackets, the user's choice: `inventory.ts`, its test, C2 and correction 10 in the index, the stage design's §4 example with a note, and task files 03, 09 and 11); `d106d2c` (review follow-ups from steps 06 and 10: runecraft refusals' article, "an Ember Rune"; the field embed's events test now embeds on a day that has events, and asserts they are not empty; the simulator test of runes sold with the old item asserts the sale counted the rune's half price and no extraction fee was paid; C11 amended to the order as built; index hashes for 08 and 10); then `c68c69a`, this step's commit (the Runes tab, the post's runes, the encampment lines, probes, tests, CLAUDE.md).

**Built.**
- `CraftingScene`: Modify and Runes tabs (`modifyTab`, `runesTab`; opens on Modify; switching clears the selection, the action and the message). The Modify list moved down 28 px for the tabs and holds 11 lines a page (was 12). The Runes tab: the socketed items (`socketables`, 5 a page) over the rune pouch (4 a page, its own Prev/Next, `pouchPrev`/`pouchNext` in the probe); on the right the selected item's sockets (rune icon, label in the rune's colour, its effect there, Extract), then the chosen action's preview and refusal, and Confirm. Every Embed, Fuse and Extract button is greyed when refused but still clickable, so its refusal can be read (`addPanelButton` gained `dimmed`). A field embed opened from the map closes the scene and resumes `World` with `CraftedData`, as a field craft does. Item rows in both tabs show socket pips (`createPips`), and a long name is cut with an ellipsis before the "where" text (`fitText`, new in `panelButton.ts`).
- `src/scenes/runecraftView.ts` (new, Phaser-free, with `runecraftView.test.ts`): action ids (`embed:<key>`, `extract:<index>`, `fuse:<key>`), socket rows, pouch rows, a rune's effect lines by place, the fuse line, each action's preview, refusal (the domain's; an embed with no item asks for one) and done message.
- `gearCompare.ts`: `statWords` gained Wards, Max HP and an "On a hit" line with every on-hit entry, joined by "; " (review round 1; it was a line an entry), so `compareLines` shows what a rune changes ("On a hit: none → +1 fire", "Wards: none → frost 2"); `statSummary` gained wards, hp and on-hit damage.
- `TradingPostScene`: a Runes filter button after the six slot buttons (seven across now), listing `runeWares` (kind `rune`, id `rune:<key>`, price `runePrice`, the rune's icon); the details are the rune's effect in a weapon, armour and a shield and its price; Confirm buys (`buyRune`, `buyRuneRefusal` shown). Below level 2, "A level 2 trading post sells runes." The Sell tab lists the pouch's runes after the materials ("2 × Lesser Ember Rune", "+5g each"), Confirm sells one (`sellRune`), the line kept selected while any is left. Item rows show pips; long labels are cut before the price.
- `encampment.ts`: the trading post's effect adds "and Lesser runes" from level 2 and "and runes of the first two ranks" at 4 (from `RUNE_RANK_LEVELS`), and its `about` mentions runes; the workshop's level 1 adds "Sets runes, and fuses three Lesser runes into one." and level 2 "Takes runes out again, for a fee."; level 3 unchanged.
- Probes as C10 (`CraftingProbe`: `tab`, `sockets`, `pouch`, `modifyTab`, `runesTab`, `confirm`, plus `pouchPrev`/`pouchNext`; on the Runes tab `chosen` is the action id and `preview` ends with the refusal if any. `TradingPostProbe`: `kind: 'rune'`, `filter.slot: 'runes'`, `runesButton`).
- CLAUDE.md: the `TradingPost` and `Crafting` scene sentences, `gearCompare.ts`'s new lines, `runecraftView.ts`, `panelButton.ts`'s `dimmed` and `fitText`; e2e/CLAUDE.md's encampment line.

**Verification.**
- `npx vitest run src/scenes/runecraftView.test.ts src/scenes/gearCompare.test.ts src/game/encampment.test.ts`: 31 passed.
- `npm test`: 78 files, 1188 tests passed. `npm run build`: built.
- `npm run test:browser` (whole suite): 9 files, 89 tests passed, no console errors. New in `e2e/encampment.test.ts`: a level 1 post's Runes filter is empty (in the first post test); "buys Lesser runes under the post's Runes filter and sells one from the pouch" (six Lesser runes at 15 at a level 2 post, two bought, one sold for 5 from the last page of Sell); "embeds, extracts and fuses runes on the workshop's Runes tab, a refusal naming the level it needs" (embed gold −5 and the name "[Ember I]", extract −10 with the rune back, fuse three storm1 −20 to a storm2, the storm2's greyed Fuse previewing "Fusing to a Greater Storm Rune needs a level 4 workshop."); "embeds a Lesser rune in the field from the map's Craft button, a day passing" (turn 2, gold −5, the map's "A day's work makes the Masterwork Iron Longsword [Ember I].").
- By eye at 840×560 and 1600×1000 (a scratch in-browser script, not committed, `/private/tmp/claude-501/-Users-ryan-personal-yomi/60b65517-05ed-4711-a327-4356c80f7c2b/scratchpad/zzshots.test.ts`; screenshots in `/private/tmp/claude-501/-Users-ryan-personal-yomi/60b65517-05ed-4711-a327-4356c80f7c2b/scratchpad/shots/`): the Runes tab with nothing selected, an embed preview, after an embed, an extract preview, a fuse preview, a refused fuse, a refused embed (sockets full), the post's Runes filter and its Sell tab's runes, and the encampment's workshop and post lines. Everything fits the frame; two fixes came from it (a wrapped socket effect ran into the next socket, and runed names ran over the "where" text).

**Deviations.**
- The scene smoke tests (`*Scene.test.ts`) stay as they are, registering the key: every scene's smoke test in this repo does only that, as the jsdom canvas mock does not run a scene's `create`. The flows the task lists for them (opens on Modify, the Runes tab's list and pouch, embedding `ember1` to `iron_sword@3#ember1`, a refusal changing nothing, a field embed resuming `World`, the post's Runes filter at levels 1 and 2, buying, selling at a third) are covered by the in-browser tests above and `runecraftView.test.ts`, with the rules in steps 06 and 07's domain tests.
- `CraftingProbe.buttons` gained `pouchPrev` and `pouchNext` beyond C10, as the pouch pages on its own.
- `gearCompare.ts`'s stat words gained the rune stats (wards, Max HP, on-hit), so that the embed and extract previews show what changes through `compareLines` as the task asks; without them an Ember rune's preview had no change lines.
- The workshop's `about` line is unchanged (a rune clause made the encampment's text panel too tall at level 1); its effect lines carry the runes.

**For step 11.** The manual's crafting and trading post sections and screenshots need the Runes tab and filter. The pouch on the Runes tab holds 4 lines a page; a long pouch pages.

**Review round 1** (clean; five non-blocking fixes, all made, none disputed, in one commit):
1. `gearCompare.ts`: the on-hit entries share one "On a hit" line ("+2 poison, lays Poisoned on a critical; +1 fire"), so an embed shows "X → X; +1 fire" and taking out the first of two runes changes one line, not two; its tests updated, one added for that extract.
2. `e2e/encampment.test.ts`, the field embed: the party now walks a hex off the encampment before the map's Craft button (turn 2 there, 3 after the embed), so it is the field proper and not the encampment without a workshop.
3. `runecraft.ts` exports `aRune`; `runecraftView.ts` uses it in place of its own `withArticle`.
4. `runecraftView.ts`'s fuse message counts by `FUSE_COUNT` (in words), not a written "three".
5. `scripts/simulate.test.ts`, "sells the runes with the old item below a level 2 workshop": the `goldOnRunes` equation is gone; the test asserts that extracting is refused at the level 1 workshop (so no fee can be paid) and that the workshop is still at level 1 after the visit, besides the sale counting the rune.

Checks: `npm test` 78 files, 1188 tests passed; `npm run test:browser -- e2e/encampment.test.ts` 11 of 11 passed.
