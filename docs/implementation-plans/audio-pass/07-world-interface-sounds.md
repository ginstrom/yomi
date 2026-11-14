# Step 07: World and interface sounds

[Index](index.md) · [Design](../../designs/audio-pass.md) §4.1.5, §4.1.6, §4.2, §4.3, §5.3 (`worldSounds`)

## Objective

The world map sounds its notable moments, and every screen sounds its actions through the right cue: clicks, back, tabs, confirms, refusals and the success sounds of buying, crafting, runecraft, building, learning a node and changing gear. After this step every W1 hook of the design is in place (content may still be the placeholder-built banks of step 02). Covers R3, R4 and the world and interface parts of AC4 and AC5.

## Requirements and context

- **R3:** the world map sounds monsters confronted or sighted, the Source sighted, a site threatened, captured or lost, a building raised, an arrival.
- **R4:** the encampment, trading post, crafting screen, inventory and interface sound their actions: clicks, confirm, back, tabs, refusals, a node learnt, gear changed, coins, crafting, runecraft, a facility raised.
- **R16:** a missing marker or bank is silent, never an exception (the player of step 05 already guarantees this; do not add throwing paths).
- **Determinism:** audio never draws from the battle's or the world's seeded RNG; nothing here may change a rule, an event or a save. No `LOG_SCHEMA_VERSION` or `SAVE_VERSION` change.
- **W1 only.** The W2 cues (`world.step`, `world.camp`, `world.yield`, `world.recruit`, `ui.hover`, `battle.turn.*`) are out of scope and are not in the manifest; do not reference them. `yield` and camping therefore play nothing.

### World cues (design §4.1.5, W1, group `world`, bus `effects`)

| Cue | Played for |
| --- | --- |
| `world.confront` | a `confronting` party event |
| `world.sighted` | `sighted` (not the Source) |
| `world.source` | `sighted` with `source` |
| `world.threatened` | `site_threatened` |
| `world.captured` | `site_captured` |
| `world.lost` | `site_lost`, `tower_lost` |
| `world.build` | `tower_built`, `outpost_built`; a tower or outpost raised by the party's own day action |
| `world.arrive` | `arrived`, `met` |
| `world.upgrade` | a facility built or raised (`improveFacility`) |
| `world.coins` | a buy or sell at the trading post (items, runes, materials) |
| `world.craft` | a craft at the workshop or in the field |
| `world.rune.embed` / `world.rune.fuse` / `world.rune.extract` | embed / fuse / extract (workshop, and a field embed) |

`encampment_lost` plays `stings.defeat` (bus `music`).

### Interface cues (design §4.1.6, W1, group `ui`, bus `ui`)

| Cue | Played for |
| --- | --- |
| `ui.click` | a button or list line pressed, portrait clicks, slider release (already moved in step 05) |
| `ui.confirm` | a committing action with no sound of its own: Begin (Party screen), Form party, Rename kept (Enter), Recruit. An action with its own success sound (a buy, a craft) plays only that |
| `ui.back` | Close, Back, Leave, Esc closing a panel or overlay |
| `ui.tab` | a tab switch: character panel tabs, trading post Buy/Sell (and its Runes button), crafting Modify/Runes, the skill tree's tree tabs (clicks and keys 1–4) |
| `ui.error` | any action the game refuses (a refusal message is shown) |
| `ui.learn` | a skill-tree node taken |
| `ui.gear` | equip, stow, drop, pick up (battle and world map), including a drag that makes a change |

`battle.impact.heal` plays for a world-map heal cast (`castOnWorldMap` succeeding in `InventoryScene`, which played `sfx_heal`).

### When world sounds play (design §4.2, normative)

`WorldScene` already tells a walk, a day or an `advance` by one message. With that message it plays the cues `worldSounds(events)` returns: **one cue per kind of event, the two highest in this priority, the second `WORLD_SOUND_GAP_MS` (250) after the first**:

`encampment_lost` (`stings.defeat`) > `confronting` > `sighted` Source > `site_lost`/`tower_lost` > `sighted` > `site_threatened` > `site_captured` > `tower_built`/`outpost_built` > `arrived`/`met`.

- `level_changed`, `spawned` (told only when sighted, which `sighted` covers), `order_done` and `yield` play nothing.
- Only events the message tells play: a walk's events for a walk (`describeWalk`), the days' for Next day / Until something happens (`describeDays`), and for a day the selected party spends on its own action (Scout, Wait, Camp, Camp until healed, a building) the events `describeOthers` tells besides the party's own words.
- A tower or an outpost raised by the party's own day action plays `world.build` (the `tower_built`/`outpost_built` event it produces is enough if it is among the events passed; do not play it twice).
- A field craft or embed returned to `WorldScene` through `CraftedData` (the `RESUME` handler, `crafted(...)`) plays `world.craft` or `world.rune.embed`, plus the `worldSounds` of the day's events it carries.

### When interface sounds play (design §4.3)

- Every `ui.click` site moved in step 05 keeps `ui.click`, except where the table above names another cue (close/back/leave → `ui.back`; tabs → `ui.tab`; committing buttons → `ui.confirm`).
- An action that returns a refusal (every module's `string | null` refusal convention) plays `ui.error` **instead of** its success sound. Sites to cover:
  - trading post: buy, sell (item, material, rune) (`TradingPostScene`);
  - crafting: `craft` (workshop and field) and runecraft `embed`, `fuse`, `extract`, including the greyed-but-clickable refused actions when confirmed (`CraftingScene`);
  - guild hall: recruit, `moveHero`, swap/exchange via `hallColumns.ts`, `formParty`, `renameParty`, `disband` (`GuildHallScene`);
  - exchange: `exchange` refusals (`ExchangeScene`);
  - encampment: `improveFacility` (`EncampmentScene`);
  - world map footer: buildings (`canBuildTower`, outpost), `orderAction` and the footer's actions refused by `advanceRefusal`/`actionBlocked` (Scout, Wait, Camp, Camp until healed, Craft, Return home, Garrison), refused Next day and Until something happens, a refused travel or meet (`startTravel`/`setOrder` refusal);
  - inventory: a refused equip or a refused world-map cast;
  - battle: a click on a foe that does nothing, where `attackPlan.ts`'s `noStrikeHint` applies (`BattleScene`).
- Success sounds: `improveFacility` → `world.upgrade`; buying or selling → `world.coins`; `craft` → `world.craft`; `embed`, `fuse`, `extract` → their rune cues; taking a node → `ui.learn` (the character panel's tree view on the world map, `InventoryScene`'s `takePerk` paths; creation's tier-1 picks in `CreationScene` are a draft edit and keep `ui.click`); any gear change in the inventory (battle and world map) → `ui.gear`; a world-map heal → `battle.impact.heal`.
- Victory and level-up stings are step 06's, not this step's.

## Dependencies and prerequisites

- **Step 05 (done before this):** `soundPlayer.ts` with `playCue(scene, cue, delayMs?)` and `playCues(scene, cues)`; `CUES`, `CueId` from `audio/sfx.manifest.json`; every existing click site already calls `playCue(scene, 'ui.click')`; `__yomi.audioLog()` in dev builds returning `AudioLogEntry { cue: string; marker: string; bus: Bus; at: number }` (last 50).
- **Step 06 (done before this):** `eventSounds(event, context?)` and the battle tables in `sounds.ts`. This step edits `sounds.ts` after 06 only (index: `sounds.ts` is edited by 05, 06, 07 in that order).
- **Step 02:** every W1 cue exists in the manifest (placeholder content is fine).
- Existing code: `WorldEvent` (`src/game/blight.ts`), `PartyEvent` (`src/game/company.ts`: `arrived`, `confronting`, `order_done`, `met`), `describeWalk`, `describeDays`, `describeOthers` (`src/scenes/worldEvents.ts`), `CraftedData` (`CraftingScene.ts`), `improveFacility` (`src/game/encampment.ts`).

## Contracts (copy of the index; do not change)

```ts
// src/scenes/sounds.ts (Phaser-free)
export interface SoundCue { cue: CueId; delayMs: number }
export function worldSounds(events: readonly (WorldEvent | PartyEvent)[]): SoundCue[]   // at most two, by priority, 250 ms apart
export const WORLD_SOUND_GAP_MS = 250
// from step 05, used here:
export function playCue(scene: Phaser.Scene, cue: CueId, delayMs?: number): void   // soundPlayer.ts
export function playCues(scene: Phaser.Scene, cues: readonly SoundCue[]): void
```

## Scope and implementation guidance

- `src/scenes/sounds.ts` (+ `sounds.test.ts`): `worldSounds` and `WORLD_SOUND_GAP_MS`. One cue per kind, duplicates of a kind collapsed (two `sighted` events play one `world.sighted`); the first cue at 0, the second at 250; empty for an event list with nothing that sounds. Keep the priority as one ordered table, not a chain of ifs.
- Small Phaser-free helpers where a decision is logic (proposed; the implementer may fold them into `sounds.ts`):
  - `refusalCue(refusal: string | null, success: CueId): CueId` → `ui.error` when refused, else the success cue; tested.
  - a mapping of the runecraft action id (`runecraftView.ts`'s action ids) to `world.rune.embed|fuse|extract`, tested.
  - the events a walk, a day report list or an own-action day passes to `worldSounds` (e.g. `reportEvents(reports)` flattening `DayReport` world and party events) if that is not already a one-liner at each site.
- `src/scenes/WorldScene.ts`: call `playCues(this, worldSounds(...))` beside each message (walk end, days, own actions, `CraftedData` resume); `world.build` for an own tower/outpost day; `ui.error` for every refused footer action, map click, Next day/Until; `ui.back`/`ui.confirm` where buttons warrant. Play sounds with the message, not per hex.
- `EncampmentScene`, `TradingPostScene`, `CraftingScene`, `GuildHallScene`, `ExchangeScene`, `InventoryScene`, `PartyScene` (Begin → `ui.confirm`), `MenuScene` (Back/Esc → `ui.back`), `BattleScene` (noStrikeHint → `ui.error`; gear changes are in `InventoryScene`), `StoryScene` untouched (step 17), `PerkTreeView`/`panelButton` only if a click handler there needs a different cue (the scenes decide; `panelButton` keeps `ui.click` by default — add an optional cue parameter if needed).
- `InventoryScene`: `ui.gear` on every successful `equipFromBackpack`, `unequipToBackpack`, `dropFromBackpack`, `dropEquipped`, `pickUp` and baggage move, and on a drag that makes a change (`gearDrag.ts`); `ui.learn` on a successful `takePerk` from the tree view; `ui.tab` on tab switches (C, S, B, I keys and clicks, Skill Trees, tree tabs and keys 1–4); `ui.back` on Esc/Back/close; `battle.impact.heal` replaces the step-05 mapping of the world heal.
- Exclusions: no W2 cue; no new rule, refusal or message text; no change to `eventSounds` beyond what step 06 left; no story audio.

## Verification

- **Domain (write first, see them fail):** `sounds.test.ts` for AC4: `worldSounds` returns at most two cues, in the stated priority, at 0 and 250 ms; `encampment_lost` → `stings.defeat` first; Source sighted beats a plain sighting; nothing for `level_changed`, `spawned`, `order_done`, `yield`; duplicate kinds collapse; an empty list gives `[]`. Tests for `refusalCue` and the runecraft mapping. A grep-style test or a manual check that every `CueId` referenced by these helpers exists (the type system enforces it).
- **Browser (`e2e/`, read `e2e/CLAUDE.md` first; use `__yomi.audioLog()`), AC5 (world/interface part):**
  - a walk onto monsters logs `world.confront`;
  - a buy at the trading post logs `world.coins`; a refused buy (not enough gold) logs `ui.error` and no `world.coins`;
  - taking a skill-tree node on the world map logs `ui.learn`;
  - optionally: a tab switch logs `ui.tab`, closing the character panel logs `ui.back`, equipping from the backpack logs `ui.gear`.
- Commands (Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`): `npm test`; `npm run test:browser` (this step changes scenes); `grep -rn "sound\.play(\|sfx_" src` finds nothing (AC1 still holds); `npm run sounds:check` still passes (this step does not touch `audio/`).

## Docs

- Root `CLAUDE.md`: the scene-layer helper list's `sounds.ts` entry (now `worldSounds` and, if added, the refusal helper); any new helper module gets one line there; the `WorldScene`/scene paragraphs if they describe what is heard. Search the file for any name this step renames.
- `docs/manual/README.md`: no change needed unless a rule the manual states changes (none expected).

## Completion criteria

- [ ] `worldSounds` and `WORLD_SOUND_GAP_MS` exactly as the contract; AC4 tests seen failing first, then passing.
- [ ] Every site of the lists above plays its cue; every refusal plays `ui.error` instead of its success sound.
- [ ] Browser tests for the four AC5 cases pass; `npm test` and `npm run test:browser` pass; AC1 grep clean.
- [ ] CLAUDE.md updated in the same commit.
- [ ] One commit `Audio pass step 07: World and interface sounds` on `audio-pass` (no push); the index row set to `done` with the hash.

Judgement: moderate to routine (many call sites; the shape is decided).

## Execution record

Engineer, step 07.

- Domain first (tests seen failing, then passing): `worldSounds`, `WORLD_SOUND_GAP_MS`, `refusalCue`, `runeCue`, `buttonCue`, `reportEvents` in `sounds.ts`, tested in `sounds.test.ts`. Priority is one ordered table; a Source sighting and a plain one are two kinds (`sighted` plain excludes `source`), so both may play.
- `addPanelButton` takes `cue` (`null` is silent, for a button whose action sounds its own outcome; a dimmed one defaults to `ui.error`). Trading post and crafting confirm buttons (buy, sell, Work it, rune confirm) are now faint but still clickable when refused so that the refusal is heard as `ui.error`; their probe `enabled` is unchanged.
- Scenes: World (map click, home, garrison, Next day, Until, own actions, `crafted` resume, refusals), Encampment, TradingPost, Crafting, GuildHall, Exchange, Inventory (`ui.gear`, `ui.learn`, `ui.tab`, `ui.back`, world heal or `ui.error`), Menu, Party (Begin `ui.confirm`), Creation, Battle (a foe click that does nothing: `ui.error`). Esc on each overlay plays `ui.back`.
- Deviations: `CraftedData.crafted` gains `kind` (`craft` or `embed`) so the map plays the right cue as it resumes; the field craft's and embed's sound is played by `WorldScene.crafted` and not by `CraftingScene`, to avoid a double. The tree tabs and keys 1 to 4 do not exist in this branch's `PerkTreeView`; the P and K tree keys and the tab buttons play `ui.tab`. A walk blocked on its first hex adds a synthetic `confronting` to the sound events, as no day is reported for it. Creation's node clicks play `ui.click`. Sounds for the events of a message are all of the reports' events (not only those the text tells), minus the acting party's own party events for own actions.
- Verification: `npm test` 85 files, 1623 tests passed; `npm run sounds:check` passed (85 cues, 4 banks); AC1 grep clean; `e2e/sounds.test.ts` (new: confront, buy/refused buy/back, tab/gear/learn/back) passed alone; full `npm run test:browser`: two runs under machine load 20 to 38 timed out at 60 s in 4 tests (saves, character's three-battle journey, and others), then the second run passed 126 of 127 with only the three-battle perk test timing out, which passed alone (30 s). No test failed on an assertion.
