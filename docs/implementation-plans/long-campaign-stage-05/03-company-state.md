# Step 03: The company: parties, members and baggage

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-05-company-of-one.md) (§2 step A, §5, §6) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §5.1

**Difficulty:** wide but mechanical. The engineer is `model: "sonnet"` and the reviewer opus (unset). The contract is fixed (C3). The work is mostly moving about 90 production reads and about 150 test reads of `game.party` and `game.baggage` behind `leader(game)`, plus a save migration.

## 1. Objective

- `GameState` holds the company as `parties: Expedition[]`, one party in stage 5.
- `GameState.party` and `GameState.baggage` are gone. Their data lives in `parties[0].members` and `parties[0].baggage`.
- Every reader goes through the stopgap `leader(game)`.
- `SAVE_VERSION` goes to 19, and a version-18 save migrates into a company of one.
- Behaviour is unchanged: the refactor guard stays identical.

`WorldState.party` and `WorldState.confronting` stay on the world in this step. Step 04 moves them.

## 2. Requirements and context

- **S5-R1** (part): the company is a list of expeditions.
- **S5-R4** (part): old saves load as a company of one.
- **S5-R5:** no behaviour change.
- The design: "`GameState.party`, `GameState.baggage`, `WorldState.party` and `WorldState.confronting` move into the expedition. `leader(game)` is a stopgap while callers move." The save "migrates an old single-party save into `parties: [First Company]`."

### Corrections from the index that this step touches

1. **Two save bumps, one migration.** `SAVE_VERSION` (now 18) goes to **19** in step 03 (party and baggage move into the expedition) and to **20** in step 04 (position and confrontation move too). Each step's migration reads a version-18 save directly; step 04 replaces step 03's migration with one from 18 to 20, and version 19 (never released, only on this branch) reads as unreadable. `LOG_SCHEMA_VERSION` (23) is unchanged.
2. **The migration contradicts CLAUDE.md**, which says "There is no migration" and that old saves read as unreadable. The stages index ("Versions": "stages 5 and 7 migrate") and this design ask for one. Step 03 rewrites CLAUDE.md's rules of saving and the comment over `SAVE_VERSION`: a migration is written when a stage's design asks for one; otherwise the old rule stands.
3. **The party keeps showing as "Your party".** The reference names the migrated party "First Company". The user decided (party-list design, Q2, resolved 2026-10-31) that the list says "Your party" until stage 6 names parties. So `Expedition.name` is stored as `'First Company'` (`FIRST_PARTY_NAME`), but the world map shows `SINGLE_PARTY_NAME` ("Your party") while the company has one party. The debug console shows the stored name and the id.
8. **The rune pouch stays the company's** (`GameState.runes`). The reference predates runes. Whether a party in the field may embed from a pouch held elsewhere is stage 6's question, noted for it.

### Contract C3 (copied from the index, unchanged)

```ts
// src/game/expedition.ts (types only but for the functions below; imports types only)
import type { Hex } from '../grid/hex.ts'
import type { Item } from '../inventory/inventory.ts'
import type { Grade } from '../inventory/grades.ts'
import type { ModifierId } from '../inventory/modifiers.ts'
import type { RuneKey } from '../inventory/runes.ts'
import type { ItemPlace } from './itemPlace.ts'
import type { Party } from './party.ts'

/** A one-day action of the selected party (step 07 runs them). */
export type DayAction =
  | { kind: 'scout' }
  | { kind: 'wait' }
  | { kind: 'camp' }                                  // one day's rest (campDay), no spells
  | { kind: 'tower' }                                 // build a watchtower where it stands
  | { kind: 'outpost' }                               // build an outpost on the held site it stands on
  | { kind: 'craft'; place: ItemPlace; modifier: ModifierId; grade: Grade }   // a field craft
  | { kind: 'embed'; place: ItemPlace; rune: RuneKey }                        // a field embed

/** A party's standing order (stage 6 adds home, garrison and meet). */
export type Order =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Hex; route: Hex[] }   // route: the hexes still to walk, `to` last, planned once when given (correction 4)
  | { kind: 'camp' }                            // camp until healed: rest, then the party's heals (autoHeal), each day
  | { kind: 'day'; action: DayAction }          // one day's action, then idle

export interface Expedition {
  /** Stable: 'party_1', … */
  id: string
  /** 'First Company' for the first; shown as 'Your party' while it is the only one (correction 3). */
  name: string
  /** The members in battle order, as GameState.party was. */
  members: Party
  /** Its shared pile of items, as GameState.baggage was. */
  baggage: Item[]
  /** Step 04: the hex it stands on, as WorldState.party was. */
  position: Hex
  order: Order
  /** Step 04: the monster location it walked into and has not answered, as WorldState.confronting was. */
  confronting: string | null
}

export const FIRST_PARTY_ID = 'party_1'           // moved here from partyList.ts, which imports it
export const FIRST_PARTY_NAME = 'First Company'
export function newExpedition(members: Party, position: Hex): Expedition   // id FIRST_PARTY_ID, name FIRST_PARTY_NAME, baggage [], order idle, confronting null (step 03: no `position` parameter yet)
export function presenceOf(party: Expedition): PartyPresence                // { position, levels: members' levels } (step 04)
export function presences(parties: readonly Expedition[]): PartyPresence[]  // presenceOf each, in list order (step 04)
```

```ts
// src/game/gameState.ts
export interface GameState {
  /** The company's parties in order; never empty while the game lasts; one in stage 5. */
  parties: Expedition[]
  world: WorldState
  runes: Pouch          // the company's (correction 8)
  reserves: Character[]
  slot: SlotId | null
  story: StoryState
}
export function leader(game: GameState): Expedition                       // parties[0]; a stopgap, steps 03–05, deleted in step 05
export function partyById(game: GameState, id: string): Expedition | undefined
export function selectedParty(game: GameState, id?: string): Expedition   // partyById, else parties[0]: the scenes' default (step 05)
// newGame(party, slot, seed, encampmentName, tutorial): signature unchanged; parties: [newExpedition(party, <encampment's hex>)]
```

- `GameState.party` and `GameState.baggage` are removed in step 03. `WorldState.party` and `WorldState.confronting` are removed in step 04.
- **The save** writes `parties` with every item as its id (members' gear, baggage), the order as plain data.
- **Migration** (`parseSave`): a version-18 save becomes `parties: [{ id: 'party_1', name: 'First Company', members: game.party, baggage: game.baggage, position: world.party, order: { kind: 'idle' }, confronting: world.confronting }]`, and `party` and `confronting` are deleted from its world. The migration is checked as strictly as a current save.
- **The fixture.** Step 03 stores a version-18 save string, made by the code at `4a2b824`, in `src/game/fixtures/save-v18.json`. It has:
  - the party off home;
  - something in the baggage;
  - `confronting` set;
  - a runed item.

  The migration tests and the play script use it.

### What this step does of C3, and what it leaves to step 04

`position` and `confronting` are not added in this step. Step 04 adds them; until then the world's `party` and `confronting` remain authoritative.
- **The `Expedition` type** is declared in full except for those two fields. `order` is declared and always `{ kind: 'idle' }` until step 06.
- **`newExpedition(members: Party): Expedition`** takes no `position` here. Step 04 adds the parameter.
- **`presenceOf` and `presences`** are step 04's. Do not add them here. `soloPresences` (step 02) stays.
- **The migration** moves `party` and `baggage` only. It leaves `world.party` and `world.confronting` on the world, untouched. Step 04 extends it to the full C3 migration and bumps to 20.
- **`selectedParty`** may be added now or in step 05. `leader` and `partyById` are this step's.

`DayAction` imports `ItemPlace` from `itemPlace.ts`, which imports `GameState` from `gameState.ts`, which imports `expedition.ts`. All of these are `import type`, so there is no runtime cycle. Keep `expedition.ts`'s imports type-only but for what its own functions need.

## 3. Dependencies and prerequisites

- **Step 02 (done):** `src/game/expedition.ts` exists with `PartyPresence` and `soloPresences(world, party)`. The world rules (`passTurn`, `advanceDay`, `updateSight`, `isNotable`, `updateTerritory`, `daysToFall`, `netInfluence`, `clearLocation`) take `presences: readonly PartyPresence[]`. Callers pass `soloPresences(world, <members>)`; in this step `<members>` becomes `leader(game).members`.
- **Step 01:** the guard test in `scripts/simulate.test.ts` (C1), and the 50-campaign summary and log hash in `01-refactor-guard.md`'s execution record.
- **Environment:** Node 26 (`PATH=/opt/homebrew/opt/node@26/bin:$PATH`), or podman `make` targets. Playwright's Chromium for the in-browser tests (`make test-browser` has it).

## 4. Scope and guidance

### 4.1 First: capture the version-18 fixture, before any edit

- **Why first.** The fixture must be a save the code at `4a2b824` would write. Step 02 changed no save shape (`SAVE_VERSION` is still 18), so the tree as step 02 left it writes the same format. Making it from that tree before editing is acceptable. A `git worktree add <scratch dir> 4a2b824` (with `node_modules` linked) is the faithful alternative. Record which you used.
- **How.** Write a throwaway script outside the repository (the scratchpad), run with Node 26, importing the repo's modules by absolute path. Do not commit the script. It should:
  1. `newGame()` with a fixed seed (say 7) and no slot;
  2. walk the party into the Goblin Raiders, at offset (13, 18), 4 hexes east of home, with `travel` in the current tree's signature. Afterwards `world.party` is off home and `world.confronting` is `'goblin_raiders'` (assert both);
  3. put two items in `game.baggage`, a plain one (`itemById('iron_sword')`) and a runed one (`itemById('iron_sword@3#ember1')`), and a runed item in a member's backpack;
  4. give the pouch a rune (`storm1`);
  5. `serializeSave({ game, battle: null, savedAt: <a fixed number> })`, then write the string to `src/game/fixtures/save-v18.json`.

  Check that `JSON.parse` of the file has `version: 18`, `game.party`, `game.baggage`, `game.world.party` and `game.world.confronting`.
- **Committed with the step.** Vitest reads the file with `readFileSync`. A test that `import`s JSON is fine too, but the file holds a JSON *string* of the save, or the save object itself. Pick one, and read it as `parseSave` expects (a string).

### 4.2 The types and the state

- **Create the C3 parts of `src/game/expedition.ts`** that this step owns (see "What this step does" above):
  - `DayAction`, `Order` and `Expedition` (without `position` and `confronting`);
  - `FIRST_PARTY_ID` and `FIRST_PARTY_NAME`;
  - `newExpedition(members)`.
- **Move `FIRST_PARTY_ID` out of `src/scenes/partyList.ts`.** partyList.ts imports it from `expedition.ts`. `SINGLE_PARTY_NAME` stays in partyList.ts.
- **`gameState.ts`:**
  - replace `party` and `baggage` with `parties: Expedition[]`;
  - add `leader(game)` (returns `game.parties[0]`) and `partyById`;
  - `newGame` keeps its signature and builds `parties: [newExpedition(party)]`;
  - `takeLoot(game, location)` keeps its signature and pushes into `leader(game).baggage`. Step 05 changes it to take the party.
- **Every reader of `game.party` or `game.baggage`** reads `leader(game).members` or `leader(game).baggage`. That includes destructuring such as `const { party, world } = game`. The survey at `4a2b824` found production readers in:
  - `guildHall.ts` (10: `company`, `recruitLevel`, `toReserves`, `toParty`, `swap`);
  - `itemPlace.ts` (9);
  - `save.ts` (7);
  - `crafting.ts`, `runecraft.ts`, `tradingPost.ts`;
  - `story/story.ts`, `story/tutorial.ts`;
  - `BattleScene.ts` (6), `CraftingScene.ts` (3), `CreationScene.ts` (1), `GuildHallScene.ts` (4), `StoryScene.ts` (1), `TradingPostScene.ts` (2), `WorldScene.ts` (about 23);
  - `debugCommands.ts` (7), `runecraftView.ts` (2), `partyList.ts` (`deployedParties`);
  - `scripts/simulate.ts` (about 16);
  - `e2e/manual.shots.ts`.

  Let `tsc` find the rest. `PartyColumn` takes a member list and should need no change.
  - A function that keeps the members in a local (`const party = leader(game).members`) is fine.
  - Do not cache the members across a call that can replace `game.parties`: none can in this step, but say so in a comment only where it matters.
- **Scenes that receive `GameState` through scene data** keep receiving it. This step adds no `party` to scene data (that is step 05).
- **Tests.** About 150 test reads move the same way, in:
  - `save`, `crafting`, `runecraft`, `guildHall`, `infirmary`, `buildings`, `gameState`, `tradingPost`, `itemPlace`, `debugCommands`, `partyList`, `story` and `simulate` tests;
  - the in-browser tests in `e2e/` (`battle`, `character`, `encampment`, `party`, `saves`, `world`). Those read probes and the `__yomi` hook's game. Check what each reads before changing it.

  A test that built a `GameState` literal with `party`/`baggage` builds `parties: [newExpedition(...)]` (with baggage set) instead. Do not weaken an assertion.

### 4.3 The save (version 19)

- **The version.** `SAVE_VERSION = 19`. Rewrite the comment over it (correction 2): raise it when the shape changes; a migration is written when a stage's design asks for one (stage 5 does); otherwise older saves read as unreadable.
- **`serializeSave`** writes `parties`, each with:
  - `members` as `characterIds`;
  - `baggage` as ids;
  - `id`, `name` and `order` as they are.
- **`parseSave`** accepts `version === SAVE_VERSION` or `version === 18`.
  - **A version-18 save** is migrated first, into the version-19 shape: `parties: [{ id: FIRST_PARTY_ID, name: FIRST_PARTY_NAME, members: game.party, baggage: game.baggage, order: { kind: 'idle' } }]`, with `party` and `baggage` dropped from `game`. Its world is left as it is: `world.party` and `world.confronting` stay this step.
  - **Every save is then checked** with the same checks:
    - `parties` is a non-empty array;
    - each party has a string `id` and `name`, a non-empty `members` array, a `baggage` array, and an `order` object whose `kind` is one of the `Order` kinds;
    - party ids are unique;
    - every existing check still holds.
  - Each party's members and baggage go through `characterOf` and `itemsOf` as before.
  - Anything else, version 19 with a malformed `parties` included, is unreadable (null).
- **`saveSummary`.** `names` and `level` go over every party's members, flattened in party order. For one party this is today's result.
- Keep the migration a small named function (`migrateFrom18`, say), so that step 04 can replace it.

### 4.4 CLAUDE.md

Update the lines this step makes wrong:
- **Rules of saving.** "There is no migration…" becomes the rule of correction 2: a migration is written when a stage's design asks for one, as stage 5's does (version 18 saves load as a company of one). The `SAVE_VERSION` comment says the same.
- **`gameState.ts`'s description.** The party and the baggage are now the company's parties (`parties`, each an `Expedition` with its members and baggage), with `leader` a stopgap until step 05.
- **A line for `expedition.ts`.** Add it to the domain list (the expedition, the order types, and `PartyPresence` if step 02 did not already).
- **Other mentions** of `game.party`, `gameState.baggage` or "the party's `baggage`": search for `baggage` and `GameState` and fix each one.

### 4.5 Exclusions

- No change to `WorldState`.
- No `position` or `confronting` on the expedition.
- No `presences(game.parties)`.
- No item-place `party` field.
- No scene-data `party`.
- No orders acting.

Those are steps 04 to 07.

## 5. Verification

- **New tests.**
  - `src/game/gameState.test.ts`: `newGame()` has one party, `party_1`, "First Company", with the given members, empty baggage and an idle order. `leader` returns it. `takeLoot` puts the loot in its baggage.
  - `src/game/save.test.ts`:
    - **A company round-trips:** `serializeSave` then `parseSave` gives equal parties (members, baggage items by identity through `itemById`, id, name and order).
    - **The fixture migrates:** `parseSave(<save-v18.json>)` is not null and gives one party, `party_1`, "First Company", idle. Its members' names, levels, hit points and gear equal the fixture's `party`. Its baggage holds the plain and the runed item (the same objects `itemById` returns). The runed backpack item survives. The world is untouched: `world.party` and `world.confronting` are as the fixture had them. The pouch is kept.
    - **Malformed is refused:** a version-19 save with `parties: []`, one with a party missing `members`, and one whose order kind is unknown all parse as null.
    - **Other versions are refused:** a version-17 save and a version-20 save parse as null.
- **The gate.** `npm test` passes. The guard test (`describe('the refactor guard')`) is untouched and passes.
- **The 50-campaign guard:**

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  The printed summary equals step 01's line for line, and the hash equals step 01's. Record "guard identical" (or the diff) below. A mismatch means behaviour changed: find the cause and fix it, never the fixture.
- **The in-browser tests** (`npm run test:browser`, or `make test-browser`): the scenes read the party through `leader` now. Run the whole suite and record the result.
- **Search** the code for `game.party`, `gameState.party`, `.baggage` on a game, and `GameState['party']`. None remain but through `leader(game)`.

## 6. Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file;
  - `npm run test:browser` after any scene change (read `e2e/CLAUDE.md` first);
  - the simulator with its own `--out` under `logs/` (gitignored). Never run two `make simulate` at once.
- **The refactor guard.** The test fixture from step 01 is never edited. The 50-campaign summary and log hash must equal step 01's.
- **Determinism.** No world or battle RNG draw added, dropped or reordered. No change to the order or arithmetic of the blight's sums or of a day's events.
- **Commits.** One commit for this step, once `npm test` passes and the guard holds, on `long-campaign-stage-05`, without pushing. Never switch branches. The message is "Stage 5 step 03: the company holds the party". It ends with the repo's `Co-Authored-By` attribution line. Commit the fixture `src/game/fixtures/save-v18.json` with it; never commit a log or the capture script.
- **Docs.** CLAUDE.md stays current; this step fixes the lines its change makes wrong (§4.4).

## 7. Completion criteria

- [ ] `src/game/fixtures/save-v18.json` is captured before any edit, with the party off home, `confronting` set, a plain and a runed item in the baggage, and a runed item in a backpack.
- [ ] `expedition.ts` has C3's types (but for `position` and `confronting`), `FIRST_PARTY_ID`, `FIRST_PARTY_NAME` and `newExpedition(members)`.
- [ ] `GameState.parties`, `leader` and `partyById` exist. `GameState.party` and `GameState.baggage` are gone, and every reader goes through `leader`.
- [ ] `SAVE_VERSION` is 19. A company round-trips, the version-18 fixture migrates, and malformed or other-version saves are refused, all with tests.
- [ ] CLAUDE.md's rules of saving, the `SAVE_VERSION` comment, the `gameState.ts` line and the `expedition.ts` line are updated.
- [ ] `npm test` and the in-browser tests pass. The guard test is untouched; the 50-campaign summary and hash are identical to step 01's.
- [ ] The step is committed, and the index's table shows step 03 done with its commit hash.

## 8. Execution record

