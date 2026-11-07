# Step 08: Tooltips, pips, wards and battle text

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-04-runes.md) (§2 "Scenes", §4, S4-R5, S4-R6) · [Reference](../../designs/long-campaign/reference/gear-and-runes.md) §5.7 · [Stages index](../../designs/long-campaign/index.md) ("Sprites", "Gameplay verification")

**Difficulty:** routine to moderate. The shapes are decided here, and the work is wiring and layout. Engineer `model: "sonnet"`, reviewer opus (the session's model), since layout and floating text need a judging eye.

## 1. Objective

Make runes visible everywhere outside the crafting and trading screens:
- the item tables for the rune icons and socket pips, loaded by the three item scenes;
- socket pips on item icons in the character panel;
- the tooltip's socket and rune lines;
- a wards line on the character tab;
- floating "+3 fire" text on a hit in battle;
- the runes found, named on the victory screen.

Step 09 builds the Runes tab and the trading post's Runes section on the tables this step adds.

## 2. Requirements and context

- **Design §4, what the player sees:**
  - after a win: "Found: Lesser Ember Rune";
  - in battle, hits read "HITS Troll for 8 dmg +1 fire". The log line is step 05's. This step adds the floating text;
  - a breastplate with a Rime rune shows "Frost ward 2".
- **S4-R6:** the UI for sockets, the pouch and runecraft (this step does sockets; step 09 does the pouch and runecraft).
- **Design §6 scene tests:** tooltips and floating text (this step); the Runes tab (step 09).
- **Corrections from the index this step relies on:**
  - **8.** Only battles at a monster location roll runes. A battle the debug console's `fight` starts has no location and rolls none, since CLAUDE.md says such a win takes no loot.
  - **9.** Runes are drawn from `lootRng(battleSeed)`, a stream of their own. The game reads the seed from the battle's `battle_start` event, the first event of `engine.getLog()`. It survives a save and reload in the snapshot's events, so a reloaded battle rolls the same runes.
  - **13.** One icon per rune kind, and the rank is a numeral. There are two socket pips, empty and filled. The filled one is drawn light, to take the rune's colour as a runtime tint.
- **CLAUDE.md rules to keep:**
  - Scenes decide no outcomes, and scene logic that can be written without Phaser goes into Phaser-free sibling helpers with domain tests (`itemIcons.ts` and `battleEffects.ts` are such helpers, and must stay free of runtime Phaser imports).
  - A scene that redraws itself after a change does so on the next tick.
  - A control or state a test needs goes in the scene's `probe()`, typed in `src/testHook.ts`. Game code never reads the probes.
  - Every scene lays itself out in `layout()`, which reruns on resize.
- **Shared constraints (from the index):**
  - `npm test` (`tsc && vitest run`) passes before the commit. Locally use Node 26 (`PATH=/opt/homebrew/opt/node@26/bin:$PATH`), or `make test` in podman.
  - Run the in-browser tests after this scene change: `npm run test:browser` (or `make test-browser`).
  - One commit for this step on `long-campaign-stage-04`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
  - No battle or world RNG draw is added, dropped or reordered. Rune loot has its own stream.
  - CLAUDE.md stays current. Update the lines this step makes wrong, in the same commit.

### Contract C9 (copied unchanged from the index)

| What | Names | Made in | Wired in |
| --- | --- | --- | --- |
| Rune icons (20px `icon` canvas) | `icon_rune_<id>` for each of the ten `RUNE_IDS` | step 02 (`art/icons/`) | step 08: `RUNE_ICON_KEYS` |
| Socket pips (new `pip` canvas, about 6×6) | `icon_socket_empty`, `icon_socket_filled` (the filled one drawn light, to take a tint) | step 02 | step 08: `SOCKET_PIP_KEYS` |

```ts
// src/scenes/itemIcons.ts (existing file, Phaser-free; step 08)
export const RUNE_ICON_KEYS: Record<RuneId, string>                         // 'icon_rune_ember', …
export const SOCKET_PIP_KEYS: { empty: string; filled: string }             // 'icon_socket_empty', 'icon_socket_filled'
/** Each rune's colour, for its filled pip's tint and its rows' text. */
export const RUNE_COLOURS: Record<RuneId, number>
/** An item's pips, socket by socket: the rune's id where one sits, null where empty; empty for an item with no sockets. */
export function socketPips(item: Item): Array<RuneId | null>
```

- `InventoryScene`, `TradingPostScene` and `CraftingScene` load every `RUNE_ICON_KEYS` and `SOCKET_PIP_KEYS` image from `assets/sprites/<key>.png`.
- They draw an item's pips in a row along the bottom of its icon.

### Contract C10, step 08's part (copied unchanged from the index)

```ts
// src/scenes/battleEffects.ts (existing file, Phaser-free; step 08)
/** The floating text of an attack's on-hit damage: "+3 fire", several joined by a space ("+1 fire +2 blight"); null when none came through. */
export function bonusText(event: AttackEvent): string | null
```

- **Step 08 (the inventory and the battle):**
  - *The tooltip.* `InventoryScene` adds `socketLines(item)` after `describeItemStats`.
  - *The character tab.* It gains `Wards: fire 2, frost 4` (`ELEMENTS` order) when any ward is above 0.
  - *Pips.* Items show socket pips in the slots, the backpack and the ground.
  - *Floating text.* `BattleScene` shows `bonusText` rising from the defender at impact.
  - *The victory screen.* `BattleScene.endBattle` calls `takeRunes` for a won battle at a location. It names the runes on the existing "Found:" line, the items first, then `runeName` of each: "Found: Lesser Ember Rune."
  - *The probe.* `InventoryProbe` gains `tooltip: string[]` (the lines shown, empty when hidden) if it lacks one.

`InventoryProbe` has no `tooltip` field at `7d32a0a`, so this step adds it.

## 3. Dependencies and prerequisites

This step needs steps 02, 05 and 07 done, and through them 03 and 04. It consumes the following. Signatures are copied from the index (C1, C2, C3, C5, C7); none is to be changed here.

- **Step 02 (art):** the PNGs `public/assets/sprites/icon_rune_<id>.png` for the ten ids, `icon_socket_empty.png` and `icon_socket_filled.png`, and their README rows. If one is missing, the step is blocked: a missing asset fails the in-browser tests.
- **Step 03 (`src/inventory/runes.ts`, `inventory.ts`):**
  - `RUNE_IDS`, `RuneId`, `Rank`, `RuneKey`;
  - `socketsOf(item: Item): number`, the sockets of the unruned item;
  - `socketLines(item: Item): string[]`, "Sockets: 1 of 2", then one line a rune, "Ember I: +1 fire on a hit", and empty for an item with no sockets;
  - `runeName(key: RuneKey): string`, for example 'Lesser Ember Rune';
  - `parseRuneKey(text: string): { id: RuneId; rank: Rank } | null`;
  - `Item.runes?: readonly RuneKey[]`, filled sockets first;
  - `describeItemStats` already writes the ward lines (`Frost ward 2`), `Max HP: +<n>` and the on-hit lines (`On a hit: +1 fire`, `On a hit: heals 1`, `On a hit: lays Seared`, `On a critical: lays Chilled`). The tooltip gets them with no work here.
- **Step 04 (`src/character/character.ts`):** `deriveCombatStats` returns `wards?: Partial<Record<Element, number>>`, summed over everything worn and left out when all are 0. `Element` and `ELEMENTS` (`fire`, `frost`, `lightning`, `acid`, `poison`, `blight`) already exist in `src/combat/combat.ts`.
- **Step 05 (`src/engine/battleEngine.ts`):**

  ```ts
  export interface AttackBonus {
    element?: Element
    bane?: true
    /** The on-hit damage before the defender's ward. */
    rolled: number
    /** What came through the ward: max(0, rolled − ward). */
    damage: number
  }
  // AttackEvent gains:
  bonus: AttackBonus[]          // one per on-hit entry with damage that applied, on a hit that struck no image; empty otherwise
  healed?: number
  onHitStatuses?: ActiveStatus[]
  // `damage` is unchanged: the weapon's damage through resistance. The defender loses damage + Σ bonus[].damage.
  ```

  `defenderHpAfter` is already the hit points after both. The log line (`formatEvent`) already shows " +1 fire" and the statuses. Every on-hit element is set (Dawn's is `blight`), so `bonusText` writes the element. An entry without one would be unnamed; write it as "+N" alone.
- **Step 07 (`src/game/loot.ts`):**

  ```ts
  export function lootRng(battleSeed: number): RNG       // mulberry32((battleSeed ^ RUNE_LOOT_SALT) >>> 0)
  /** Rolls the runes of a won battle at a monster location into the game's pouch and returns them. */
  export function takeRunes(game: GameState, threat: number, encounter: EncounterId, battleSeed: number): RuneKey[]
  ```

  `GameState.runes: Pouch` is step 04's. `takeRunes` writes into it.
- **Existing code** (inspected at `7d32a0a`):
  - `src/scenes/itemIcons.ts`: `ITEM_ICON_KEYS`, `ITEM_ICON_SCALE` (2), `MATERIAL_TINTS`, `iconTint`.
  - `src/scenes/InventoryScene.ts`:
    - it loads the icons at line ~279;
    - it draws slot and backpack icons at ~1006, and ground icons at ~1182;
    - the tooltip is `this.tooltipText.setText([item.name, item.description, ...describeItemStats(item.stats, strength)])` at ~1237;
    - `statLines()` is at ~1073 (Hit Points, Armor Class, Resistance, …).
  - `TradingPostScene.ts` and `CraftingScene.ts` load the icons in `preload` (~118, ~82) and draw a row icon at `LIST_X + 12` (~311, ~223).
  - `src/scenes/BattleScene.ts`:
    - `showAttack` (~1383) runs `land()` at impact (`impactMs(event)`), where the defender reacts and its hit points refresh;
    - `endBattle` (~2047) calls `takeLoot` for a win with `this.location`, and builds `lootLines` as `Found: ${listNames(...)}.`;
    - `this.location` is the `MonsterLocation`, which has `threat` and `encounter`.
  - `src/scenes/battleEffects.ts` and its test (`battleEffects.test.ts`, in the domain project).
  - `src/testHook.ts`: `InventoryProbe` (~296), `BattleProbe` (~271, which has `result: string[]`).
  - `e2e/`: `driver.ts`, `battle.test.ts`, `character.test.ts`, `debug.test.ts`, `encampment.test.ts`; `e2e/CLAUDE.md` says how to write a test.

## 4. Scope and implementation guidance

### 4.1 `src/scenes/itemIcons.ts` (C9)

- Add `RUNE_ICON_KEYS` (`icon_rune_<id>` for each `RuneId`), `SOCKET_PIP_KEYS` and `RUNE_COLOURS`.
  - The colours are the implementer's. They should be readable as text on the panels' dark brown and tell the elements apart: Ember a warm orange, Rime ice blue, Storm yellow, Venom green, Acid yellow-green, Stone grey, Wind pale teal, Life red or pink, Mind violet, Dawn pale gold.
  - Keep them light enough to tint the light filled pip without going muddy, as `MATERIAL_TINTS` does.
- Add `socketPips(item)`. For each socket of `socketsOf(item)`, it gives the id of `item.runes[i]` (via `parseRuneKey`) where one sits and `null` beyond. It is empty for an item with no sockets.
- Keep the module free of runtime Phaser imports. Import types only from `inventory.ts`, and `socketsOf` and `parseRuneKey` from `runes.ts`.
- **Test** (`src/scenes/itemIcons.test.ts`, new or existing, in the domain project):
  - every `RUNE_IDS` entry has a key and a colour;
  - `socketPips` of a plain tier-1 item is empty;
  - `socketPips` of `iron_sword@3` is `[null]`, and of `iron_sword@3#ember1` is `['ember']`;
  - `socketPips` of a tier-2 Masterwork item with one rune is the rune and then `null`;
  - `socketPips` of `emberblade` is `[null]`.
  - A check that every key's PNG exists under `public/assets/sprites/` belongs here too, if the existing icon tests do the same (follow their pattern; `unitLook.test.ts` checks sprites).

### 4.2 Loading in the three scenes

`InventoryScene`, `TradingPostScene` and `CraftingScene` each load every `RUNE_ICON_KEYS` and `SOCKET_PIP_KEYS` value in `preload`, next to the item icons: `this.load.image(key, \`assets/sprites/${key}.png\`)`. Step 09 draws rune icons in crafting and the trading post. Loading them here keeps the assets in one step, and the in-browser tests then catch a missing file.

### 4.3 Pips

- **The drawing.** Draw a row of pips along the bottom edge of an item icon, one a socket, in socket order, centred under the icon.
  - An empty socket is `SOCKET_PIP_KEYS.empty`, untinted.
  - A filled one is `SOCKET_PIP_KEYS.filled`, tinted `RUNE_COLOURS[id]`.
  - Draw at the icon's scale (`ITEM_ICON_SCALE` in the panel), so the pips' pixels match the icon's.
  - **From step 02's review:** the empty pip is drawn in dark greys and may all but vanish on a dark cell; check it on the panel's slot and backpack cells and give it a light rim or backing if it does. Three 6px pips (12px each at 2×) fill 36 of a 40px cell, so leave no gap wider than 2px between them at 2× and keep the row inside the cell.
- **Where it lives.** Write one small drawing function, used wherever an item icon is drawn: for example a `drawPips(scene, container, x, y, item, scale)` in a Phaser-importing helper next to the scene, or a private method. The pips' positions (offsets from the icon's centre, for n sockets at a scale) are logic. Put that in `itemIcons.ts` as a Phaser-free function (for example `pipOffsets(count, scale)`) with a test, so the scene only places sprites.
- **In `InventoryScene`:** the equipment slots, the backpack grid and the ground pile (design §2; C10).
- **In `TradingPostScene` and `CraftingScene`:** pips on a row's icon only if it is the same few lines with the shared function. Otherwise leave them to step 09 and say so in the record. Step 09 owns those two scenes' other rune work.

### 4.4 The tooltip

- In `InventoryScene` (~1237), add `...socketLines(item)` after `describeItemStats(...)`. Nothing is added for an item with no sockets.
- Check that the tooltip box grows with the extra lines and stays inside the panel at the 840×560 minimum: a tier-2 Masterwork runed weapon has the most lines. Fix the placement if it overruns.
- Add `tooltip: string[]` to `InventoryProbe` (`src/testHook.ts`) and to the scene's `probe()`. It holds the lines shown now, and is empty when the tooltip is hidden.

### 4.5 The wards line on the character tab

- In `statLines()`, after `Resistance:`, add `Wards:         fire 2, frost 4`.
  - Keep the existing column alignment: the label is padded to the same width as the others.
  - The elements are in `ELEMENTS` order, only those above 0.
  - The line is shown only when `this.stats.wards` has any ward above 0.
- The words are worked out by a Phaser-free function with a test, for example `wardsLine(wards): string | null`. It may go in `gearCompare.ts`, which holds the panel's other words, or beside `socketLines`. Check that the longest likely line (three elements) fits the stats column (`STATS_X`, the panel width). Shorten the label, not the content, if it does not.

### 4.6 `bonusText` and the floating text (C10)

- **`bonusText(event)` in `battleEffects.ts`.** It takes the `bonus` entries with `damage > 0`, maps each to `+<damage> <element>` (or `+<damage>` with no element), and joins them with a space. It returns null when none remain: a miss, an image, no runes, or everything warded to 0.
- **Domain test** (`battleEffects.test.ts`), with hand-built `AttackEvent`s. Copy one from the existing tests and add the step-05 fields:
  - `[{ element: 'fire', rolled: 3, damage: 3 }]` gives "+3 fire";
  - two entries give "+1 fire +2 blight";
  - an entry with `damage: 0` is left out, and if it is the only one, the result is null;
  - `bonus: []` gives null.
- **In `BattleScene.showAttack`, inside `land()`:** when `bonusText(event)` is not null, show a text at the defender's chest point (`this.chest(event.defender)`). Tween it up some pixels and fade it out, then destroy it.
  - Use the board layer's scaling, the way the foe info panel unscales its text, so it reads at its own size.
  - The colour is the first bonus element's `RUNE_COLOURS` entry, or a plain warm colour.
  - The tween runs under the hook's life speed like every other tween, and must not hold up the event schedule. It is a cosmetic tween; it adds no time to `eventSchedule.ts`.
- **The Life heal.** If `event.healed > 0`, the attacker's hit point display refreshes at impact too: it may have healed. The attacker's figure may flash `HELPED_TINT` as `regenerate` does. This needs no new text.
- **The battle probe.** The floating text is short-lived and timed, so it is checked through `bonusText`'s unit test, not the probe. Do not add a probe field that a test would have to catch mid-tween.

### 4.7 Runes on the victory screen

In `BattleScene.endBattle`, on a win with `this.location`, call `takeRunes` once and before `this.save()`, so the save holds the pouch with the runes:

```ts
takeRunes(this.gameState, this.location.threat, this.location.encounter, battleSeed)
```

- **The seed** is `battleSeed = (this.engine.getLog()[0] as BattleStartEvent).seed`. The `battle_start` event is kept in a restored engine's events (correction 9). If it is null (only an engine built with its own rng, which the game never makes) or the first event is not `battle_start`, roll nothing. Put the lookup in a small Phaser-free helper (in `battleSetup.ts` or a new `battleLoot.ts`) with a test, so the scene decides nothing:
  - a log starting with a seeded `battle_start` gives that seed;
  - a log with `seed: null` gives null.
- **Without a location**, as in the debug console's `fight`, roll no runes (correction 8).
- **The "Found:" line** names the items first, then `runeName` of each rune, in the order found, in one `listNames` list: "Found: Lesser Ember Rune." or "Found: Iron Sword and Lesser Ember Rune." The line is still left out when nothing was found.
- **Saves.** A victory is already saved as it happens, and the pouch is saved by step 04. A page reloaded on the victory screen opens the world map with the runes in the pouch. Make sure `takeRunes` cannot run twice for one win: `endBattle` is called once, and `takeLoot` already relies on that. Keep the two calls together.

### 4.8 Tests

- **Domain:** `itemIcons` (4.1, 4.3), the wards words (4.5), `bonusText` (4.6) and the seed lookup (4.7).
- **Scene smoke tests** (`src/scenes/InventoryScene.test.ts`, `BattleScene.test.ts`, the `scenes` project):
  - the inventory over a character wearing a runed item (`itemById('iron_breastplate#rime1')`, and `iron_sword@3#ember1` in the main hand) creates without error;
  - the probe's stat lines include `Wards:` with `frost 2`;
  - hovering, if the existing tests can trigger it, puts `Frost ward 2` and the `Sockets:` line in `tooltip`. If the smoke harness cannot hover, the e2e test covers it.
  - In `BattleScene.test.ts`, playing back an attack event with a bonus does not throw, if the existing tests play events.
- **In-browser** (`e2e/`, read `e2e/CLAUDE.md` first; wait on probes, never on time; no console errors):
  - In `character.test.ts` (or `debug.test.ts` if the console is the easier way to set it up):
    1. open a new game;
    2. use the debug console to `give iron_breastplate#rime1` (and `iron_sword@3#ember1`);
    3. equip them through the character panel;
    4. hover the armour and read the probe's `tooltip` for `Frost ward 2` and `Sockets: 1 of 1`;
    5. read the character tab's stat lines for `Wards: frost 2`.

    This also proves the rune and pip PNGs load (a failed request fails the test).
  - In `battle.test.ts`, optionally: win a battle at a location with a seed whose loot is known, and check that `result` names a rune. Only do this if a seed that rolls a rune at the first nest is cheap to find. A threat-1 nest rolls a rune half the time, so pick the seed by trying, and note it in the record. Otherwise leave it to the domain tests and step 11's play script, and record that.
- Run the whole in-browser suite after the change. Earlier tests' layouts (the tooltip and the stat column) may shift.

### 4.9 CLAUDE.md

Update the lines this step makes wrong or incomplete:
- **Assets.** `InventoryScene`, `TradingPostScene` and `CraftingScene` also load `RUNE_ICON_KEYS` and `SOCKET_PIP_KEYS` (`itemIcons.ts`, which also has `RUNE_COLOURS` and `socketPips`), and draw an item's sockets as pips under its icon, a filled one tinted in its rune's colour.
- **Scene layer.**
  - The character panel's tooltip lists sockets and runes, and the Character tab shows wards.
  - `BattleScene` floats an attack's on-hit damage (`bonusText` in `battleEffects.ts`) over the defender.
  - The victory screen names the runes found (`takeRunes`, seeded from the battle's `battle_start` seed; a battle with no location rolls none).
- **The helper module list.** It names `battleEffects.ts`'s new job, and any new helper (for example `battleLoot.ts`).

Change nothing about the rules here: steps 03 to 07 own those lines.

### 4.10 Out of scope

- the Runes tab, field embedding, the post's Runes filter and rune sales, and the encampment's descriptions (step 09);
- the log line's words (step 05);
- the manual and its screenshots (step 11);
- any rule change.

## 5. Verification

1. `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes (or `make test`), including the new domain tests:
   - `npx vitest run src/scenes/itemIcons.test.ts src/scenes/battleEffects.test.ts`;
   - the seed lookup's test file;
   - `npx vitest run --project scenes` for the smoke tests.
2. `npm run test:browser` passes in full (or `make test-browser`), with the new test (`npm run test:browser -- -t "ward"`, or whatever its name is).
3. By eye, in `npm run dev` (or `make run`), in a new game:
   - `give iron_sword@3#ember1` and `give iron_breastplate@3`;
   - see one pip under the sword (filled, orange) and one empty under the breastplate, in the backpack and when worn;
   - the tooltip shows the sockets and rune line;
   - the character tab shows no wards line until a Rime-runed armour is worn;
   - `fight troll_lair 4` with the sword: hits float "+1 fire", and the log reads "+1 fire".

   Note in the record what was seen, and the window size.
4. The guard is untouched: no simulator code changes. A run is not needed unless the step touched `scripts/` or a domain module the simulator calls. If it did, run `npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1 --out logs/s4-08-guard.jsonl`; it must be identical to step 01's summary.

## 6. Completion criteria

- [ ] `RUNE_ICON_KEYS`, `SOCKET_PIP_KEYS`, `RUNE_COLOURS` and `socketPips` in `itemIcons.ts`, Phaser-free, as in C9, with tests.
- [ ] The three item scenes load the rune icons and pips. The inventory draws pips in slots, the backpack and the ground (the trading post and crafting rows too, or left to step 09 and said so).
- [ ] The tooltip adds `socketLines`. The character tab has the wards line. `InventoryProbe.tooltip` exists.
- [ ] `bonusText` in `battleEffects.ts`, as in C10, with tests. The floating text shows at impact, and a Life heal refreshes the attacker's hit points.
- [ ] `endBattle` calls `takeRunes` for a win at a location, seeded from `battle_start`, before saving. The "Found:" line names the runes. Debug fights roll none.
- [ ] Scene smoke tests and an in-browser test cover the tooltip and the wards line. `npm test` and `npm run test:browser` pass.
- [ ] CLAUDE.md updated (4.9).
- [ ] One commit on `long-campaign-stage-04`. The index row for step 08 is set to `done` with the commit, and the execution record below is filled.

## 7. Execution record


Built by the step 08 engineer. Domain tests first (`itemIcons`, `battleEffects`, `gearCompare`, `battleSetup`, `battleEngine`), then the scenes.

- **Built:**
  - `itemIcons.ts`: `RUNE_ICON_KEYS`, `SOCKET_PIP_KEYS`, `RUNE_COLOURS`, `socketPips` (C9) and `pipOffsets(count, scale)`: a step of 5 px a pip (the drawing is 6 wide with 4 showing, so 1 px, 2 at 2x, between two), centred, at 8.5 px below the icon's centre.
  - `socketPips.ts` (new, a type-only Phaser import): `createPips(scene, item, x, y, scale)`. `InventoryScene` draws pips in the equipment slots (not the ghost of a two-hander), the backpack and the ground. Trading post and crafting rows draw none: their icons are unscaled and a row is a few pixels high, so step 09 decides there; all three scenes do load the rune and pip images.
  - The tooltip adds `socketLines`. Where the item's slot is too near the panel's top for the lines to fit above it (the head slot with a runed helm), the tooltip opens below the slot.
  - `wardsLine` (`gearCompare.ts`): `Wards:         fire 2, frost 4` in `statLines()`, so on the Character tab's "In battle" column and the Inventory tab's stats. `InventoryProbe` gains `tooltip: string[]` and `statLines: string[]` (the task named only `tooltip`; the stat lines are the only way a test reads the wards).
  - `battleEffects.ts`: `bonusText` (C10), `bonusElement` and `changesStatusMarks`. `BattleScene` floats the text from the defender's chest at impact, in a `floatLayer` of its own (`labelLayer` is emptied by `refreshHighlights`), unscaled to its own size, coloured by the element's rune colour. A Life heal refreshes and flashes the attacker.
  - `endBattle` rolls `takeRunes` after `takeLoot` and before the save, seeded by `battleSeed(log)` (`battleSetup.ts`); with no location or no seed it rolls none. `foundNames(items, runes)` builds the "Found:" list.
- **Review follow-ups from step 05:** the nameplates' status letters are redrawn for an attack with `onHitStatuses` (`changesStatusMarks`, tested); `formatEvent` names a status laid twice once (", seared", test added to `battleEngine.test.ts`). `LOG_SCHEMA_VERSION` is unchanged: the event's shape did not change.
- **Pips by eye** (1280x800 and 840x560, `scratchpad/inv-840.png`): the empty pip is a mid-grey with a dark outline, visible on the dark cells, so no rim or backing was added and no art changed. Two pips (a Masterwork tier-2 sword) sit clear of each other and inside the 46 px cell; three would span 32 px. They overlap the icon's lowest rows a little.
- **Floating text by eye:** `+1 fire` in orange, rising from a goblin hit by an Ember sword, the log reading "HITS Goblin for 9 dmg +1 fire." (captured at a tenth of normal speed, `scratchpad/c_battle-0-20.png`).
- **Not done:** scene smoke tests beyond the existing ones (the harness only checks registration; the in-browser test covers the tooltip and the wards). The victory line needed no new e2e: the existing loot test in `world.test.ts` (seed 1, the first nest) now ends "Found: Ring of Protection and Lesser Life Rune.", which proves the seeded roll and the line; its expectation was updated.
- **Verification:** `npm test` (tsc and 1158 tests) passes. In-browser: the full suite (86 tests) passes after the world loot test's expectation changed, and the new test ("shows sockets and runes in a tooltip, and the wards of what is worn (ward)") passes. The guard is untouched: no `scripts/` change, and the one domain change is the log line's text.
- **For later steps:** step 09 can use `RUNE_COLOURS`, `RUNE_ICON_KEYS` and `createPips`; the icons are already loaded by `TradingPostScene` and `CraftingScene`.
