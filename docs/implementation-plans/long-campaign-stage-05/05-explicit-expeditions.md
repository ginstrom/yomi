# Step 05: Explicit expeditions

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-05-company-of-one.md) (§2 "Step A", "Debug commands"; §5 "The ~90 call sites") · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §5.2 (item places), §5.4 (debug commands)

**Difficulty:** wide but mechanical, with fixed contracts. Engineer `model: "sonnet"`; reviewer opus (the session's model). The guard must stay identical.

## 1. Objective

Finish the design's step A: no code reaches the party through `leader(game)` any more.
- Every reader of a party takes it explicitly, as a parameter, through an item place's `party`, or from the scene data.
- Company-wide readers work over `game.parties`.
- Item places name their party.
- The debug console takes an optional party (`@<party>`) and `party` lists the company.
- `leader` is deleted.

Play is unchanged, and the refactor guard is identical.

## 2. Requirements and context

- **S5-R1:** the company is a list of expeditions, and the world rules take presences. This step completes it.
- **Design §2:** "Item places name the party." "Debug commands take an optional party name. The `party` command lists the company."
- **Design §5:** "The ~90 call sites move behind `leader(game)` first, then to explicit expeditions. Scenes get the selected expedition from scene data."
- **S5-R5:** no behaviour change. The seeded summary is identical.

**Corrections from the index that this step touches:**
- **3.** The party keeps showing as "Your party". The reference names the migrated party "First Company". The user decided (party-list design, Q2, resolved 2026-10-31) that the list says "Your party" until stage 6 names parties. So:
  - `Expedition.name` is stored as `'First Company'` (`FIRST_PARTY_NAME`);
  - the world map shows `SINGLE_PARTY_NAME` ("Your party") while the company has one party;
  - the debug console shows the stored name and the id.
- **12.** `placeKey` keeps its format (`baggage:0`, `worn:0:mainHand`), without the party, because the in-browser tests and probes name places by it. With one party nothing collides; stage 6 changes the format when it has a second party.
- **13.** `leader(game)` is gone by the end of this step. Every reader then takes an explicit expedition (a parameter, a place's `party`, or the scene data's), or works over `game.parties` (company-wide readers such as the save summary and the guild hall's `company`). The scene-data default, `selectedParty(game, id)`, falls back to `parties[0]`. That is the scene's selection rule, not a stopgap.

**Shared constraints (from the index):**
- **Commands.** Use local Node 26 (prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`) or the podman `make` targets.
  - `npm test` (`tsc && vitest run`) is the gate before the commit (`make test` in podman).
  - `npx vitest run <file>` runs one file.
  - `npm run test:browser` (or `make test-browser`) runs the in-browser tests. **This step changes scenes, so run the whole browser suite.** Read `e2e/CLAUDE.md` before changing an in-browser test.
- **The refactor guard.**
  - **The test.** `describe('the refactor guard')` in `scripts/simulate.test.ts` must pass unchanged. No step may edit its fixture. A mismatch means this step changed behaviour: find and fix the cause.
  - **The 50-campaign check.** Run it before committing:

    ```sh
    npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
    shasum -a 256 logs/guard-50.jsonl
    ```

    The summary must equal step 01's recorded output line for line, and the hash must equal step 01's. Record "guard identical" (or the diff) in the execution record.
- **Determinism.** No draw of the world or battle RNG is added, dropped or reordered. No order or arithmetic of the blight's sums or of a day's events changes.
- **Commits.** One commit on `long-campaign-stage-05`, once `npm test` passes and the guard holds. Don't push, and never switch branches. The message is "Stage 5 step 05: explicit expeditions", ending with the repo's `Co-Authored-By` attribution line.
- **Docs.** CLAUDE.md must stay current. Search it for every name this step renames or removes (`leader`, `takeLoot`, `deployedParties`, `ItemPlace`, `allPlaces`, `DebugSource`, …) and fix those lines.

## 3. Dependencies and prerequisites

**Step 04** must be done. What exists after step 04 (not in the code at `4a2b824`):

- From **C3** (`src/game/expedition.ts`, `src/game/gameState.ts`):

  ```ts
  export interface Expedition {
    id: string            // 'party_1', …
    name: string          // 'First Company' for the first; shown as 'Your party' while it is the only one
    members: Party
    baggage: Item[]
    position: Hex
    order: Order
    confronting: string | null
  }
  export const FIRST_PARTY_ID = 'party_1'           // moved here from partyList.ts, which imports it
  export const FIRST_PARTY_NAME = 'First Company'
  export function presenceOf(party: Expedition): PartyPresence
  export function presences(parties: readonly Expedition[]): PartyPresence[]

  export interface GameState {
    parties: Expedition[]   // never empty while the game lasts; one in stage 5
    world: WorldState
    runes: Pouch            // the company's
    reserves: Character[]
    slot: SlotId | null
    story: StoryState
  }
  export function leader(game: GameState): Expedition                       // parties[0]; this step deletes it
  export function partyById(game: GameState, id: string): Expedition | undefined
  export function selectedParty(game: GameState, id?: string): Expedition   // partyById, else parties[0]: the scenes' default (added by this step if step 03 did not)
  ```

  `GameState.party`, `GameState.baggage`, `WorldState.party` and `WorldState.confronting` no longer exist.
- From **C4**:
  - The position-dependent rules take `(world, party: Expedition)`: `monstersHere`, `routeTo`, `atEncampment`, `towerSiteRefusal`, `canBuildTower`, `outpostSite`, `outpostSiteRefusal`, `canBuildOutpost`, `atGuildHall`, `canCamp`, `restHealing(world, party, member)` and `craftTier`.
  - The day-passing functions take `(game, party)`: `travel`, `linger`, `buildTower`, `buildOutpost`, `campDay`, `campUntilHealed`.
  - `clearLocation(game, id)`.
  - Game-wide functions that read the party but take no party yet (`craft`, `embed`, `buy`, `sell`, the guild hall's, `improveFacility`, …) call `leader(game)` inside. **This step removes those calls.**
  - `WorldProbe` has `partyAt: Hex` and `confronting: string | null`.
- **Check first:** if `selectedParty` is not in `gameState.ts` yet, add it here as in C3.

## 4. Contract produced: C5 (copied from the index)

```ts
// itemPlace.ts
export type ItemPlace =
  | { from: 'baggage'; party: string; index: number; itemId: string }
  | { from: 'worn'; party: string; member: number; slot: EquipmentSlot; itemId: string }
  | { from: 'backpack'; party: string; member: number; index: number; itemId: string }
export function allPlaces(game: GameState, party: Expedition, worn?: boolean): Array<{ place: ItemPlace; item: Item }>
// placeKey: format unchanged (correction 12). A place whose party is unknown is stale (itemAt → null).
```

- **The rule:** every function that reads the party (its members, baggage, position or confrontation) takes the acting party explicitly.
  - A function given a place finds the party by `place.party`.
  - A function that lists or buys takes `party: Expedition` after `game` or `world`: `craftables`, `socketables`, `sellables`, `buy`, `buyRefusal`, the guild hall's moves, `recruitLevel`, `improveFacility`, and the like.
  - `takeLoot(party: Expedition, location: MonsterLocation): Item[]`.
- **Scene data** carries `party?: string`, the selected party's id: `World`, `Battle`, `Encampment`, `GuildHall`, `TradingPost`, `Crafting`, `Inventory` and `Story`, wherever the scene acts for or shows a party. Each scene resolves it with `selectedParty(game, data.party)` and passes it on when it starts another scene.
- **The debug console.**
  - `DebugSource` gains `party?: string`, the scene's selected party.
  - Every command that acts on a party (`heal`, `xp`, `give`, `goto`, `fight`, and `party`'s listing of members) takes an optional last argument `@<party>`: a party id (`party_1`) or a case-insensitive prefix of its name (`first`). Without it, it acts on the source's party, else the first.
  - `party` lists the company: each party's id, name, hex, order and confrontation, then its members as today. An unknown `@<party>` is an error naming the parties.
- `leader` is deleted (correction 13).

Steps 06 and 07 consume this:
- `ItemPlace.party`, for a `DayAction`'s craft or embed place;
- the explicit `party` parameters;
- `selectedParty`.

## 5. Scope and guidance

Paths below were inspected at `4a2b824` (line numbers are approximate after steps 03 and 04). Where a function's party parameter goes is fixed by the rule above. Its exact position in a signature not named in C5 is the implementer's choice: put it after `game`/`world`.

1. **`src/game/itemPlace.ts`.**
   - Add `party` to every `ItemPlace` variant.
   - `lookUp`, `replaceAt`, `removeAt` and `changeWorn` find the expedition with `partyById(game, place.party)`. An unknown party makes `itemAt` return null (stale), and `replaceAt`/`removeAt` are only ever called after `itemAt` found the item.
   - `allPlaces(game, party, worn = true)` lists that party's members (worn, then carried), then its baggage, each place carrying `party: party.id`, in today's order.
   - `placeKey` is unchanged.
   - Update `itemPlace.test.ts`. Add a test that a place naming an unknown party is stale.
2. **`src/game/crafting.ts`, `runecraft.ts`, `tradingPost.ts`.**
   - Functions given a place (`options`, `craft`, `embedRefusal`, `embed`, `extractRefusal`, `extract`, `sell`) take the party from `place.party`. For `craftTier`, the field day and `atEncampment` checks, use that expedition.
   - Listing functions take the party: `craftables(game, party)`, `socketables(game, party)`, `sellables(game, party)`.
   - Buying takes the party: `buy(game, party, itemId)`, `buyRefusal(game, party, itemId)`, and the rune buys and sales if they check that the party is at home. A purchase goes into `party.baggage`.
   - The pouch stays `game.runes` (index correction 8).
   - The field day's `passTurn` still gets `presences(game.parties)`.
3. **`src/game/guildHall.ts`.**
   - `company(game)` is every hero of every party plus the reserves: `[...game.parties.flatMap((p) => p.members), ...game.reserves]`. With one party that is the same order as today.
   - Party-specific moves take the party: `recruitLevel(game, party)` (unchanged rule: `max(1, min(hall, lowest level of party.members))`), `toReserves(game, party, index)`, `toParty(game, party, index)`, `swap(game, party, member, reserve)`, and `recruit`/`recruitRefusal` and `upgradeGuildHall` where they read the party or its place.
4. **`src/game/encampment.ts`.** `facilities(game, party)` and `improveFacility(game, party, id)` (with `setFacilityLevel` as the debug console needs). The "not at the encampment" refusal uses `atEncampment(world, party)`.
5. **`src/game/gameState.ts`.**
   - `takeLoot(party: Expedition, location: MonsterLocation): Item[]` moves the loot into `party.baggage`.
   - Delete `leader`.
6. **`src/game/save.ts`.** `saveSummary` works over `game.parties`: `names` are every party's members in company order, and `level` is the highest of them. With one party this is identical to today.
7. **`src/story/story.ts`, `src/story/tutorial.ts`.**
   - A condition about "the party" either receives the expedition its moment concerns (from the scene that raises it), or asks over `game.parties` (for example, any party standing at the encampment, or confronting).
   - Pick whichever keeps each condition's meaning for one party, and record the choice per condition in the execution record.
   - Today's story tests must pass unchanged in meaning.
8. **The scenes.**
   - **Scene data.** Each data interface gains `party?: string` (`WorldData`, the `Battle` data, and those of `Encampment`, `GuildHall`, `TradingPost`, `Crafting`, `Inventory` and `Story`). Each scene resolves its party with `selectedParty(this.gameState, data.party)` and passes `party: <id>` whenever it starts or resumes another scene (Encampment → GuildHall/TradingPost/Crafting → Encampment → World, World → Battle → World, Story's resume).
   - **`WorldScene`.**
     - It already holds `selectedParty`. Initialise it from `data.party` when given, else as now, and use `selectedParty(game, this.selectedParty)` wherever it read `leader(game)`.
     - Its debug source sets `party: this.selectedParty`.
   - **`BattleScene`.**
     - The fighting party's `members` make the fighters.
     - The victory's `rewardVictory(members, xp, party.baggage)` and `takeLoot(party, location)` use the same party.
     - `clearLocation(game, id)` is unchanged.
     - The save mid-battle needs no change: the save holds `parties`.
     - Its debug source sets `party`.
   - **`InventoryScene`, `gearDrag.ts`** (and `gearDrag.test.ts`), **`runecraftView.ts`** (and its test), **`CraftingScene`, `TradingPostScene`, `GuildHallScene`, `EncampmentScene`, `CreationScene`** (its name-uniqueness check uses `company(game)`), **`StoryScene`, `PartyColumn`, `hexInfo.ts`:**
     - every place they build carries the party's id;
     - every party they read is the resolved one.
   - **`src/scenes/partyList.ts`.**
     - `deployedParties(game)` maps `game.parties`, in order, one entry each. The entry's `name` is `SINGLE_PARTY_NAME` while `game.parties.length === 1`, else the expedition's `name`; `position` and `confronting` come from the expedition.
     - It no longer defines `FIRST_PARTY_ID` (it imports it from `expedition.ts`, as step 03 arranged).
     - Rewrite its header comment: it maps the company's parties, and the single-party name holds until stage 6 names parties.
     - Update `partyList.test.ts`.
9. **`src/scenes/debugCommands.ts`** (and `debugCommands.test.ts).
   - **`DebugSource`** gains `party?: string`.
   - **Parsing.** A last argument starting with `@` names the party: an exact id (`party_1`), else the first party whose `name` starts with the rest, case-insensitive (`@first`). It is stripped before the command's own arguments are read.
     - Without it, the command acts on `selectedParty(game, source.party)`.
     - An unknown name throws a `DebugError` naming the parties (id and name).
   - **Commands.**
     - `heal` and `xp` act on the party's members (the member argument is read within that party).
     - `give` puts items into that party's baggage. Runes still go to the company's pouch.
     - `goto` moves that party (its `position` and `confronting`).
     - `fight`'s default threat is `threatAt` of that party's hex.
     - `locations` says where each party stands.
   - **`party`.** It lists the company: for each party, a line with its id, stored name, hex (as `locations` prints one), order kind, and the location it confronts if any, then its members' rows as today. `party @first` lists that one party.
   - **Usage strings** show `[@party]`, and `help` stays aligned.
   - **Tests:**
     - `@first` and `@party_1` both select the first party;
     - a command without `@` acts on the source's party, else the first;
     - an unknown `@nobody` is an error naming `party_1 (First Company)`;
     - `party` lists the company's party, then its members.
10. **`scripts/simulate.ts`** (and its test).
    - `runCampaign` holds `const party = game.parties[0]` once, and passes it explicitly to everything it calls: `travel`, `campUntilHealed`, `buildTower`, `buildOutpost`, `canCamp`, `atGuildHall`, `takeRunes` if it reads the party, `takeLoot`, `rewardVictory(party.members, …, party.baggage)`, `craftGear`, `runecraftGear`, `visitFacilities`, `visitGuildHall`, `hallErrand`, `outpostErrand(world, party)` and `nextTarget(world, party, readyLevel)`.
    - Keep each call's order, arguments and results as today. **The guard must stay identical.**
    - Update `scripts/simulate.test.ts`'s fixtures to build places with `party: 'party_1'`. The guard fixture must not change.
11. **`e2e/`** (`manual.shots.ts`, the tests, `driver.ts`): replace any `leader`-style reach into the game. Keep reading places by `placeKey` strings, which are unchanged. Run the whole browser suite.
12. **Delete `leader`** from `gameState.ts`. `grep -rn "leader(" src scripts e2e` must find nothing that calls it. If a reader seems to need it, use the rule in correction 13 and record the choice.
13. **CLAUDE.md.** Update:
    - the `itemPlace.ts` line: a place names its party, and an unknown party is stale;
    - the `gameState.ts` line: `takeLoot(party, location)`, no `leader`, `selectedParty`;
    - the scene layer: each scene takes `party` in its scene data, resolved by `selectedParty`, and passes it on;
    - the debug console paragraph: the optional `@<party>` argument (written in backticks) and `party` listing the company;
    - the `partyList.ts` entry in the helper list: `deployedParties` maps `game.parties`, the name "Your party" while there is one;
    - any line still naming `game.party`, `game.baggage` or `leader`.

**Exclusions:**
- No `placeKey` format change (correction 12).
- No pouch per party.
- No new orders or `company.ts` (step 06).
- No change to what any screen shows: "Your party" stays.

## 6. Verification

- `npm test` passes, the refactor guard included, unchanged.
- **New and updated tests pass:**
  - `itemPlace.test.ts`: a stale unknown party, and `allPlaces` carrying `party`;
  - `debugCommands.test.ts`: `@first`, `@party_1`, the default, an unknown party, `party`'s listing;
  - `partyList.test.ts`: maps `game.parties`, named "Your party" with one;
  - `gearDrag.test.ts` and `runecraftView.test.ts`: places with `party`;
  - the crafting, runecraft, trading post, guild hall, encampment and story tests, with explicit parties.
- `npm run test:browser` passes in full.
- The 50-campaign check is identical to step 01's (summary and hash).
- `grep -rn "leader(" src scripts e2e` finds no call. `grep -rn "game\.party\b\|game\.baggage\|world\.party\b\|world\.confronting" src scripts e2e` finds nothing.

## 7. Completion criteria

- [ ] `ItemPlace` names its party; `allPlaces(game, party, worn?)`; an unknown party is stale; `placeKey` unchanged.
- [ ] Every party reader is explicit (parameter, `place.party`, or scene data via `selectedParty`); company-wide readers use `game.parties`.
- [ ] `takeLoot(party, location)`; Battle rewards and loots into the fighting expedition.
- [ ] Scene data carries `party?: string`, resolved and passed on by each scene.
- [ ] The debug console's `@<party>`, `DebugSource.party` and `party` listing work, with tests.
- [ ] `deployedParties` maps `game.parties`; its comment is rewritten.
- [ ] `leader` is deleted.
- [ ] `npm test` and `npm run test:browser` pass; the guard is identical (recorded).
- [ ] CLAUDE.md is updated.
- [ ] Committed as "Stage 5 step 05: explicit expeditions"; the index's step 05 row is set to done with the commit hash.

## 8. Execution record

