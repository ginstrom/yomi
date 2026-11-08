# Step 04: Position and confrontation in the expedition

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-05-company-of-one.md) (§2 step A, §5) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §5.1, §5.2

**Difficulty:** intricate. Leave the engineer's and the reviewer's model unset (opus / opus). The step changes the signatures of the rules that read where the party stands, across the domain, the scenes, the simulator and the in-browser tests, and the refactor guard must stay identical.

## 1. Objective

Move `WorldState.party` (the hex the party stands on) and `WorldState.confronting` (the monsters it walked into and has not answered) into the expedition, as `Expedition.position` and `Expedition.confronting`. Every rule that read them takes the expedition instead (C4). The world rules get their presences from `presences(game.parties)`, and the transitional `soloPresences` goes. `SAVE_VERSION` goes to 20, with the migration reading a version-18 save straight to version 20. Behaviour is unchanged: the guard stays identical.

## 2. Requirements and context

- **S5-R1** (the company is a list of expeditions, and the world rules take presences) and **S5-R4** (old saves load as a company of one), in part. Step 05 finishes S5-R1 with item places and explicit parties.
- **S5-R5:** no behaviour changes. A seeded simulator run gives an identical summary before and after.
- **Correction 1 (index):** `SAVE_VERSION` (now 18) went to **19** in step 03 (party and baggage moved into the expedition) and goes to **20** in this step (position and confrontation move too). Each step's migration reads a version-18 save directly. This step replaces step 03's migration with one from 18 to 20, and version 19 (never released, only on this branch) reads as unreadable. `LOG_SCHEMA_VERSION` (23) is unchanged.
- **Correction 2 (index):** the migration contradicts CLAUDE.md's old "There is no migration". Step 03 rewrote CLAUDE.md's rules of saving to allow a migration where a stage's design asks for one. Keep that wording true for version 20.
- **Correction 13 (index):** `leader(game)` is a stopgap until step 05. In this step, the game-wide functions that read the party but take none yet use `leader(game)` inside.

### Contracts consumed (existing after steps 02 and 03)

**C2 (step 02), as it stands before this step:**

```ts
// src/game/expedition.ts
export interface PartyPresence {
  position: Hex
  levels: readonly number[]
}
// worldMap.ts
export function passTurn(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
export function isNotable(world: WorldState, event: WorldEvent, presences: readonly PartyPresence[]): boolean
export function clearLocation(world: WorldState, id: string, presences: readonly PartyPresence[]): void   // this step changes it to C4's
// blight.ts, vision.ts and territory.ts take `presences` as in C2 (advanceDay, netInfluence, updateSight, visibleHexes, seedSight, daysToFall, updateTerritory)
```

- **The transitional helper** (removed in this step): `soloPresences(world: WorldState, party: readonly { level: number }[]): PartyPresence[]` returns `[{ position: world.party, levels: party.map((m) => m.level) }]`.
- **A new world** (`newWorld`, signature unchanged) seeds its sight from one presence at its home hex, `{ position: <home>, levels: [] }`, as every new game's party starts there. Keep it so.

**C3 (step 03; this step adds `position`, `confronting`, `presenceOf` and `presences`):**

```ts
// src/game/expedition.ts
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

export const FIRST_PARTY_ID = 'party_1'
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
// newGame(party, slot, seed, encampmentName, tutorial): signature unchanged; parties: [newExpedition(party, <encampment's hex>)]
```

- **Migration** (`parseSave`): a version-18 save becomes `parties: [{ id: 'party_1', name: 'First Company', members: game.party, baggage: game.baggage, position: world.party, order: { kind: 'idle' }, confronting: world.confronting }]`, and `party` and `confronting` are deleted from its world. The migration is checked as strictly as a current save.
- **The fixture** (made by step 03): `src/game/fixtures/save-v18.json`, a version-18 save made by the code at `4a2b824`. It has:
  - the party off home;
  - something in the baggage;
  - `confronting` set;
  - a runed item.

### Contract produced: C4. Position-dependent rules take the expedition

Read-only checks take `(world, party)`, and anything that passes a day takes `(game, party)`. The existing functions change to:

```ts
// worldMap.ts
export function monstersHere(world: WorldState, party: Expedition): MonsterLocation | null
export function routeTo(world: WorldState, party: Expedition, to: Hex): Hex[] | null      // null while party.confronting !== null, as today
export function travel(game: GameState, party: Expedition, to: Hex): Journey
export function linger(game: GameState, party: Expedition, how: Lingering): WorldEvent[] | null
export function clearLocation(game: GameState, id: string): void   // clears every party's `confronting` on `id`; sight from presences(game.parties)
// buildings.ts
export function atEncampment(world: WorldState, party: Expedition): boolean
export function towerSiteRefusal(world: WorldState, party: Expedition): string | null
export function canBuildTower(world: WorldState, party: Expedition): string | null
export function buildTower(game: GameState, party: Expedition): WorldEvent[] | null
export function outpostSite(world: WorldState, party: Expedition): QuietLocation | null
export function outpostSiteRefusal(world: WorldState, party: Expedition): string | null
export function canBuildOutpost(world: WorldState, party: Expedition): string | null
export function buildOutpost(game: GameState, party: Expedition): WorldEvent[] | null
// guildHall.ts
export function atGuildHall(world: WorldState, party: Expedition): boolean
// camp.ts
export function canCamp(world: WorldState, party: Expedition): boolean
export function campDay(game: GameState, party: Expedition): CampDay | null
export function campUntilHealed(game: GameState, party: Expedition): CampResult | null
// infirmary.ts
export function restHealing(world: WorldState, party: Expedition, member: Character): number
// crafting.ts
export function craftTier(world: WorldState, party: Expedition): CraftTier
```

- `soloPresences` is deleted. Every `passTurn` gets `presences(game.parties)`.
- **Game-wide functions** that read the party but take no party yet (`craft`, `embed`, `buy`, `sell`, the guild hall's, `improveFacility`, …) use `leader(game)` inside until step 05.
- **`WorldProbe`** (`src/testHook.ts`) gains `partyAt: Hex` and `confronting: string | null`, both of the selected party. The in-browser tests read these where they read `world.party` and `world.confronting`.

Later steps rely on these signatures as written:
- step 05 makes the remaining game-wide functions explicit;
- step 06 builds `company.ts` on `routeTo`, `monstersHere`, `canCamp`, `restHealing` and `presences`;
- step 07 uses `canBuildTower`, `canBuildOutpost` and `craftTier`.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit (`make test` is the same in podman);
  - `npx vitest run <file>` for one file, `npx vitest run --project domain` for the domain;
  - `npm run test:browser -- -t <name>` (or `make test-browser ARGS="-t <name>"`) after any scene change. Read `e2e/CLAUDE.md` before changing an in-browser test;
  - `npm run simulate -- <flags>` (or `make -s simulate ARGS="<flags>"`). Give each run its own `--out` under `logs/` (gitignored). Never run two `make simulate` at once.
- **The refactor guard** has two parts:
  - **The test.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, is in `npm test`. **Never edit its fixture.** A mismatch means this step changed behaviour: find the cause and fix it.
  - **The 50-campaign check.** Run it before committing:

    ```sh
    npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
    shasum -a 256 logs/guard-50.jsonl
    ```

    The printed summary must equal, line for line, the one in step 01's execution record, and the hash must equal step 01's.
- **Determinism.** Add, drop or reorder no draw of the world RNG or a battle's RNG. Change neither the order nor the arithmetic of the blight's sums, nor the order of the events a day returns.
- **Commits.** One commit for this step, once `npm test` passes and the guard holds, on `long-campaign-stage-05`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
- **Docs.** CLAUDE.md stays current: fix the lines this change makes wrong, and search it for every name this step renames or removes.

## 3. Dependencies and prerequisites

- **Step 03 must be done**:
  - `Expedition` without `position`/`confronting`;
  - `GameState.parties`, `leader`, `partyById`;
  - `SAVE_VERSION` 19 and its 18→19 migration;
  - the v18 fixture.
- **Step 02 must be done**: `PartyPresence`, the world rules over presences, and `soloPresences`.
- **Step 01's** guard test and its recorded 50-campaign summary and hash.
- No open blocker.

## 4. Scope and guidance

### 4.1 State

- **`src/game/worldMap.ts`:**
  - Remove `party` and `confronting` from `WorldState` and from `newWorld`.
  - Keep `newWorld`'s sight seeded from a presence at home (C2).
  - The home hex must be reachable by `newGame`. Use `encampment(world).position`, or export a helper; do not duplicate the offset.
- **`src/game/expedition.ts`:**
  - Add `position` and `confronting` to `Expedition`.
  - `newExpedition(members, position)`.
  - Add `presenceOf` and `presences` (C3).
  - Delete `soloPresences`.
- **`src/game/gameState.ts`:** `newGame` builds `parties: [newExpedition(party, <encampment's hex>)]`.

### 4.2 The rules (C4)

Change each function to the C4 signature. Its body reads `party.position` where it read `world.party`, and `party.confronting` where it read `world.confronting`. Every `passTurn(world, soloPresences(…))` becomes `passTurn(world, presences(game.parties))`.

- **`worldMap.ts`:** `monstersHere`, `routeTo`, `travel`, `linger`, `clearLocation(game, id)`.
  - `travel` sets `party.position = h` each step, and at the end `party.confronting = monstersHere(world, party)?.id ?? null`, exactly where today's code does. Keep the same early returns: no route, or a world that is not active.
  - `linger` clears `party.confronting`.
  - `clearLocation` sets `confronting = null` on every party whose `confronting` is `id`. It updates sight with `presences(game.parties)`, and wins the game on the Source as today.
  - `isNotable` keeps its C2 signature; callers pass `presences(game.parties)`.
- **`buildings.ts`:** the tower and outpost checks, `buildTower`, `buildOutpost` and `atEncampment`.
- **`guildHall.ts`:** `atGuildHall(world, party)`.
- **`camp.ts`:** `canCamp`, `campDay`, `campUntilHealed`.
  - `campDay` heals `party.members`.
  - `isNotable` inside `campUntilHealed` gets `presences(game.parties)`.
- **`infirmary.ts`:** `restHealing(world, party, member)`.
- **`crafting.ts`:** `craftTier(world, party)`. Its callers (`runecraft.ts`'s helpers, `craft`, `embed`, `encampment.ts`, the screens' views) pass `leader(game)` where they have only `game` (step 05 makes them explicit).
- **`territory.ts`, `blight.ts`, `vision.ts`:** no signature change; their callers pass `presences(game.parties)`.

### 4.3 Callers (surveyed at `4a2b824`; counts approximate)

Domain and tooling:
- `src/game/`: `buildings.ts` (8), `camp.ts`, `worldMap.ts` (~10), `guildHall.ts`, `infirmary.ts`, `crafting.ts`, `runecraft.ts`, `encampment.ts`, `tradingPost.ts`.
- `src/story/tutorial.ts` (3 tip conditions on `world.party` and `world.confronting`): read `leader(game)`.
- `scripts/simulate.ts`:
  - `outpostErrand(world)` and `nextTarget(world, party, …)` measure from `world.party`. Give them the expedition: `outpostErrand(world, party: Expedition)` and `nextTarget(world, party: Expedition, readyLevel)`, using `party.members` for levels.
  - `walkTo` and the home checks read `party.position`.
  - `atGuildHall(world, party)`, `canBuildTower(world, party)`, `buildTower(game, party)`, `outpostErrand`, `canBuildOutpost`, `buildOutpost`, `canCamp`, `campUntilHealed(game, party)` and `clearLocation(game, id)`.

Scene helpers and scenes:
- `src/scenes/hexInfo.ts`, `partyList.ts` (`deployedParties` reads `position` and `confronting` from the expedition), `debugCommands.ts`:
  - `locations` prints the party's hex;
  - `goto` sets `position` and `confronting = monstersHere(world, party)?.id ?? null`;
  - `fight` takes the threat at the party's hex;
  - `days` passes `presences(game.parties)`.
- `WorldScene.ts` (~8 readers):
  - the route preview `routeTo(world, party, hovered)`;
  - the travel, linger, camp, build and enter handlers;
  - the confronting message;
  - the probe.
- `BattleScene.ts` (1: the location fought, and `clearLocation(game, id)` on a win).
- `GuildHallScene.ts` (`atGuildHall`) and `InventoryScene.ts` (1).
- Where a scene has only the game, use `leader(game)` (step 05 replaces it with the scene data's party).

Tests:
- domain tests: `buildings` (22), `vision` (8), `worldMap` (12), `infirmary`, `guildHall`, `crafting`, `runecraft`, `tradingPost`, `encampment`, `territory`;
- scene-helper tests: `debugCommands`, `hexInfo`, `partyList`;
- `scripts/simulate.test.ts`.

Tests that put the party somewhere set `leader(game).position` (or an expedition's `position`) instead of `world.party`. Tests of a bare `WorldState` build an expedition with `newExpedition(readyMadeParty(), at)`.

- **Probes and in-browser tests.**
  - `WorldProbe` gains `partyAt: Hex` and `confronting: string | null`, of the selected party (C4). Fill them in `WorldScene.probe()`.
  - Then replace `world.party` with `partyAt`, and `world.confronting` with `confronting`, in every in-browser test: `e2e/world.test.ts`, `character.test.ts`, `battle.test.ts`, `party.test.ts`, `saves.test.ts`, `encampment.test.ts`, `driver.ts`, and `manual.shots.ts`. The probe's `world` no longer has those fields, so `tsc` finds them.

### 4.4 The save (correction 1)

- `SAVE_VERSION` = **20**.
- `serializeSave` writes each expedition's `position` and `confronting` with the rest of `parties`.
- `parseSave` accepts version 20. It checks `position` (a hex with numeric `q` and `r`) and `confronting` (a string or null) as strictly as the rest.
- **The migration.**
  - Replace step 03's 18→19 migration with one that reads a version-18 save straight to version 20: the C3 migration in full, `position: world.party` and `confronting: world.confronting`. Then delete `party` and `confronting` from the migrated world.
  - Version 19 reads as unreadable.
  - Keep the comment over `SAVE_VERSION` and CLAUDE.md's rules of saving saying so.
- **Tests** in `save.test.ts`:
  - The step-03 fixture loads. Its party's members, baggage, `position` and `confronting` equal what the fixture's version-18 `party`, `baggage`, `world.party` and `world.confronting` held. The migrated world has no `party` or `confronting` key.
  - A version-19 save string reads as unreadable (null).
  - A company round-trips: `serializeSave` then `parseSave` gives an equal game, with the position off home and `confronting` set.

### 4.5 CLAUDE.md

- Fix the `WorldState` description in `worldMap.ts`'s line: the party's hex and `confronting` are gone; the party, its position and its confrontation are the expedition's.
- In the rules of the world map, "walking into monsters sets `confronting`": say it is the party's.
- Fix the `buildings.ts`, `camp.ts` and `guildHall.ts` (`atGuildHall`) lines.
- Fix the version figure in the rules of saving.
- Remove every mention of `soloPresences`, and of `world.party`/`WorldState.party`/`world.confronting`.

### 4.6 Exclusions

- No item place changes, no scene-data `party`, no debug `@<party>`, and `leader` stays: all step 05.
- No orders run and no `company.ts`: steps 06 and 07. `order` stays `{ kind: 'idle' }`.
- Do not change what any function does: only where it reads the party's hex and confrontation.

## 5. Verification

- `npx vitest run src/game` while working; then `npm test` passes, the guard test included, its fixture untouched.
- `npm run test:browser` passes (scenes and probes changed).
- The 50-campaign check from §2: the summary is identical to step 01's line for line, and the log's SHA-256 equals step 01's.
- `npm run test:browser` (Node 26): first full run 88 of 89 (the `saves.test.ts` read above); after the fix `saves.test.ts` 6 of 6 and a second full run 9 files, 89 tests passed.
- `grep -rn "world\.party\|world\.confronting\|soloPresences" src scripts e2e` finds nothing that reads the old fields. A hit on an unrelated name (e.g. the probe's `partyAt`) is fine.
- `save.test.ts` covers the migration from the v18 fixture, the unreadable version 19 and the round trip (§4.4).

## 6. Completion criteria

- [ ] `WorldState` has no `party` or `confronting`; `Expedition` has `position` and `confronting`; `newExpedition(members, position)`; `presenceOf` and `presences` exist; `soloPresences` is gone.
- [ ] Every C4 function has its C4 signature, and every `passTurn` gets `presences(game.parties)`.
- [ ] `WorldProbe.partyAt` and `confronting` exist, and the in-browser tests read them.
- [ ] `SAVE_VERSION` is 20; a v18 save migrates with position and confrontation intact; v19 is unreadable; a company round-trips.
- [ ] `npm test` and `npm run test:browser` pass; the guard test is unchanged and passes.
- [ ] The 50-campaign summary and hash equal step 01's (recorded below).
- [ ] CLAUDE.md is updated (§4.5).
- [ ] Committed as "Stage 5 step 04: the expedition stands on the map"; the index's row 04 shows `done` with the commit hash.

## 7. Execution record


**Done.** `WorldState.party` and `WorldState.confronting` are now `Expedition.position` and `Expedition.confronting`; every C4 function has its C4 signature; `soloPresences` is gone and every `passTurn` gets `presences(game.parties)`.

- **State.** `expedition.ts`: `position`, `confronting`, `newExpedition(members, position)`, `presenceOf`, `presences` (pure; the module still imports types only). `newGame` puts the party at `encampment(world).position`. `newWorld` keeps seeding its sight from a presence at home.
- **Rules.** As C4. `clearLocation(game, id)` frees every party confronting `id`, and its sight is `presences(game.parties)`. Beyond C4 (needed, not listed there):
  - `raiseShrine(world, party)`: it calls `atEncampment`. `encampment.ts` passes `leader(game)`.
  - `hexInfo(game, party, visible, at)`: it read `world.party` and `routeTo`, and now takes its net influence and days to fall from `presences(game.parties)`.
  - crafting's `placeRefusal` and runecraft's `workshopIsAt`/`workshopHere` take the game (they call `canCamp`/`craftTier`/`atEncampment`).
  - `scripts/simulate.ts`: `outpostErrand(world, party)` and `nextTarget(world, party, readyLevel)` take the expedition (as §4.3). `nextTarget` passes `[presenceOf(party)]` to `daysToFall`, the same list `soloPresences` gave.
  - Game-wide functions (`craftables`, `options`, `craft`, `embed`, the guild hall's, the facilities' raises, `improveFacility`'s refusal, `tutorial.ts`'s monsters tip, `CraftingScene`, `runecraftView`) use `leader(game)` inside, as C4 says.
  - `WorldScene` has a private `expedition()` (`leader(this.gameState)`, for step 05 to replace with the scene data's party).
- **Save 20.** `migrateFrom18` reads a version-18 save straight to 20 (the world's `party` and `confronting` into the expedition, then deleted from the world); `parseSave` checks each party's `position` (numeric `q`, `r`) and `confronting` (string or null); version 19 reads as unreadable. Tests: the v18 fixture's position and confrontation, no `party`/`confronting` left on the world, broken v18 worlds refused, a v19 string refused, versions 17/19/21 refused, a company with position off home and `confronting` set round-tripping to an equal game, bad positions and confrontations refused.
- **Probe.** `WorldProbe.partyAt` and `confronting`; every in-browser read of `world.party`/`world.confronting` moved to them (`world.test.ts`, `battle.test.ts`, `encampment.test.ts`, `driver.ts`, `manual.shots.ts`, `saves.test.ts`; `character.test.ts` and `party.test.ts` had none, only the column's `party`). One read `tsc` could not catch: `saves.test.ts`'s `toMatchObject({ turn: 4, party: … })` on the probe's world, found by the first browser run and moved to `partyAt`; its reload test also checks `partyAt` now, as `world` no longer carries the hex. No e2e test planted `world.party` or `world.confronting` in a raw save, so no planted path changed.
- **Tests.** New `src/game/expedition.test.ts` (`newExpedition`, `presenceOf`, `presences`); `worldMap.test.ts`: clearing frees every party facing the location and only those, and walking in confronts only the party that walked. Tests of a bare world that need a party build a game (`newGame(readyMadeParty(), null, seed)`), and the pinned tests in `blight.test.ts` and `territory.test.ts` changed only `pinned` (it now takes the hex, as the world no longer holds it).
- **Review follow-ups from step 03.** `blight.test.ts`'s redundant assertion in "makes every party's hex neutral" moved out of the loop. `itemPlace.ts`'s two imports from `character.ts` merged. `isNotable`'s unused `_world` kept: C2, C4 and C6 all fix its signature as `(world, event, presences)`, so dropping it is a contract change for the orchestrator to decide (recommendation: leave it until stage 6, which may want the world for a sighting's party).
- **CLAUDE.md.** The `camp.ts`, `buildings.ts`, `guildHall.ts`, `expedition.ts`, `worldMap.ts` and `gameState.ts` lines, the world map's rule on `confronting` and the save rule's version figures; no mention of `soloPresences`, `world.party`, `WorldState.party` or `world.confronting` is left.

**Verification.**
- `npm test` (Node 26): 79 files, 1230 tests passed; the guard test unchanged (`git diff` touches only an unused import and the nextTarget, outpost and field-craft tests of `scripts/simulate.test.ts`, not `describe('the refactor guard')` or its fixture).
- 50-campaign check: summary identical to step 01's line for line (diffed, npm's header lines aside), "Simulated 50 campaigns, 852 battles in all", "Beat the Source: 23 of 50"; SHA-256 `068016a82040ec5be673084265005a7218f0ce927629880565c1a27a8cf52d76`, equal to step 01's. **Guard identical**, run twice (after the domain change and again after all edits).
- `npm run test:browser` (Node 26): first full run 88 of 89 (the `saves.test.ts` read above); after the fix `saves.test.ts` 6 of 6 and a second full run 9 files, 89 tests passed.
- `grep -rn "world\.party\|world\.confronting\|soloPresences" src scripts e2e`: only the migration in `save.ts` and its tests (the old save's fields), the tutorial anchor name `'world.party'`, and the probes' party column (`world.party[0]` on a `WorldProbe`).
