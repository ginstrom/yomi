# Step 02: World rules over presences

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-05-company-of-one.md) (S5-R1, S5-R5, §5 "Determinism") · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §5.1, §5.2

**Difficulty:** intricate and determinism-sensitive. The blight's sums must come out bit for bit as today's, so leave the engineer's and reviewer's model unset (opus / opus).

## 1. Objective

The world's rules (the blight, spawns, sight, territory, `passTurn` and `isNotable`) stop reading the single party from `WorldState.party` and a party list. Instead they take a list of **presences**, `{ position, levels }`, one per party. With a list of one, every number, event and RNG draw stays exactly as today. `WorldState.party` still exists in this step, and callers build the list of one with the transitional `soloPresences(world, party)`. Step 04 replaces it with `presences(game.parties)`.

## 2. Requirements and context

- **S5-R1.** The world rules take presences (reference §5.2: `netAt` sums `partyStrength(levels) − distance` over the presences, every presence's hex is neutral, `spawn` keeps `SPAWN_CLEARANCE` from every presence, `updateSight` takes the union, `isNotable` measures from the nearest presence).
- **S5-R5.** There must be no behaviour change: the refactor guard stays identical.

### Contract C2 (from the index, unchanged)

```ts
// src/game/expedition.ts (new in step 02; step 03 adds C3)
import type { Hex } from '../grid/hex.ts'
/** A party as the world's rules see it: where it stands, and its members' levels. */
export interface PartyPresence {
  position: Hex
  levels: readonly number[]
}
```

The new signatures (existing functions, changed):

```ts
// blight.ts
export function partyStrength(levels: readonly number[]): number      // PARTY_BASE + floor(sum of levels / 2), as today
export function netInfluence(world: WorldState, presences: readonly PartyPresence[], h: Hex): number
export function advanceDay(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
// vision.ts
export function visibleHexes(world: WorldState, presences: readonly PartyPresence[]): Set<number>
export function updateSight(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
export function seedSight(world: WorldState, presences: readonly PartyPresence[]): void
// territory.ts
export function daysToFall(world: WorldState, presences: readonly PartyPresence[], site: { position: Hex }): number | null
export function updateTerritory(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
// worldMap.ts
export function passTurn(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
export function isNotable(world: WorldState, event: WorldEvent, presences: readonly PartyPresence[]): boolean
export function clearLocation(world: WorldState, id: string, presences: readonly PartyPresence[]): void   // step 04 changes it to C4's
```

**The rules, exact for one presence:**
- **Influence (`netAt`).** `clean = field.clean[i]`, then `+= Math.max(0, partyStrength(p.levels) − hexDistance(p.position, hexes[i]))` for each presence in list order.
  - Every presence's hex is neutral: `netAt` returns `-clean` there.
  - Creep skips a neighbour that is a presence's hex.
- **Spawns.** `spawn`'s corrupted list leaves out every presence's hex. `keepClear` starts with the presences' positions, in list order, then the rest as today.
- **Sight.** `visibleHexes` adds `PARTY_VISION` around each presence (in list order), then the held sites and towers as today.
- **Notable.** A `sighted` event is notable if it is the Source, or if *some* presence is within `NOTICE_RADIUS` of it.
- **A new world** (`newWorld`, signature unchanged) seeds its sight from one presence at its home hex, `{ position: <home>, levels: [] }`, as every new game's party starts there.
- **The transitional helper** (removed in step 04): `soloPresences(world: WorldState, party: readonly { level: number }[]): PartyPresence[]` returns `[{ position: world.party, levels: party.map((m) => m.level) }]`. It is exported from `expedition.ts`, and every caller that passed `party` today passes `soloPresences(world, party)`.

### What the code does today (inspected at `4a2b824`)

- **`blight.ts`, `netAt`** (around line 196):
  - `reach = partyStrength(party) - hexDistance(world.party, hexes[i])`;
  - `clean = field.clean[i] + Math.max(0, reach)`;
  - the party's hex is neutral (`i === partyIndex` returns `-clean`);
  - creep skips `n !== partyIndex`.
- **`blight.ts`, `advanceDay`** computes `partyIndex = boardIndex(world.board, world.party)` and passes it to `netAt` and `spawn`.
  - `spawn` builds its corrupted list without `partyIndex`.
  - Its `keepClear` starts with `world.party`.
  - The world RNG is drawn only after the candidates are found.
- **`blight.ts`, `netInfluence`** calls `netAt` with `world.party`'s index.
- **`vision.ts`, `visibleHexes`** starts with `hexesWithin(world, world.party, PARTY_VISION, visible)`. `updateSight` and `seedSight` call it.
- **`territory.ts`.** `daysToFall(world, party, site)` and `updateTerritory(world, party)` pass party levels on to `netInfluence`.
- **`worldMap.ts`:**
  - `passTurn(world, party)` is `turn += 1`, then `[...advanceDay, ...updateTerritory, ...updateSight]`, in that order;
  - `isNotable(world, event)` measures a `sighted` event from `world.party`;
  - `clearLocation` calls `updateSight(world)`;
  - `newWorld` calls `seedSight(world)` with the party at `HOME`.

### Why the rules above are exact

- `partyStrength` and `hexDistance` are integers. With one presence, `field.clean[i] + Math.max(0, reach)` is computed exactly as before.
- The neutral set and the creep exclusion hold one index.
- The order of `keepClear` cannot change `every`, and the candidates' order (and so the RNG draw) is the board order, untouched.
- The order of a `Set` of visible hexes changes nothing: `seen` is written per index, and `sighted` events follow `world.locations`' order.

## 3. Dependencies and prerequisites

- **Step 01** (done first). It gives:
  - the guard test in `scripts/simulate.test.ts` (`describe('the refactor guard')`), which must pass unchanged;
  - the 50-campaign summary and log hash, recorded in its execution record.
- **Existing code only.** `GameState.party`, `GameState.baggage`, `WorldState.party` and `WorldState.confronting` all still exist.
- **For later steps:**
  - step 03 adds `Expedition` and the rest of C3 to `src/game/expedition.ts`;
  - step 04 deletes `soloPresences` and passes `presences(game.parties)` instead.

## 4. Scope and guidance

### Order of work

1. **Pin today's numbers first, before changing any code.** Add characterization tests and commit nothing until they pass on the unchanged tree. On a seeded world (`newWorld(seed)`) with a party standing off home, at more than one level, record as literals:
   - `netInfluence` at several hexes: the party's hex, its neighbours, a hex at the party's reach, one beyond it, and one beside corrupted land;
   - a few days of `advanceDay`: the events, the levels and shift counters of chosen hexes, `spawnPressure`, `spawns`, `world.rng`, and a spawn's id, position and kind, with enough days or a forced pressure to see one;
   - `visibleHexes` (its size, and membership of chosen hexes) and `updateSight`'s events;
   - `daysToFall` for a threatened site.

   Put them in `blight.test.ts`, `vision.test.ts` and `territory.test.ts`. They must stay green, untouched, through the change.
2. **Create `src/game/expedition.ts`** with `PartyPresence` and `soloPresences` (C2). It imports types only, apart from what `soloPresences` needs, which is nothing at runtime.
3. **Change the world rules** to C2's signatures and rules.
   - Build the neutral set once per day from the presences' board indices, in `advanceDay` and `netInfluence`, and pass it to `netAt` and `spawn` in place of `partyIndex`.
   - `isNotable`: `event.source === true || presences.some((p) => hexDistance(p.position, event.at) <= NOTICE_RADIUS)`.
4. **Update every caller** to pass `soloPresences(world, party)`, or the presences it was handed:
   - `worldMap.ts`: `travel`, `linger`, `clearLocation`'s callers;
   - `camp.ts`: `campDay` and `campUntilHealed`'s `isNotable`;
   - `buildings.ts`: `buildTower`, `buildOutpost`;
   - `crafting.ts`: `craft`;
   - `runecraft.ts`: `embed`;
   - `src/scenes/hexInfo.ts` (`netInfluence`, `daysToFall`), `src/scenes/WorldScene.ts`, `src/scenes/debugCommands.ts` (`days`, and anything calling `passTurn` or `isNotable`);
   - `scripts/simulate.ts` (`nextTarget`'s `daysToFall`);
   - the tests: `blight`, `vision`, `territory`, `buildings`, `camp`, `worldMap`, `hexInfo`, `debugCommands`, `simulate`.

   `clearLocation`'s callers (`BattleScene`, the simulator, tests) pass `soloPresences(world, game.party)`.
5. **Add the list tests:**
   - **`blight.test.ts`:**
     - a list of one gives the pinned numbers;
     - with two presences, the influence at a hex is `field.clean` plus both parties' reaches;
     - both presences' hexes are neutral and neither creeps;
     - a spawn keeps `SPAWN_CLEARANCE` from both.
   - **`vision.test.ts`:** two presences see the union of their radii.
   - **`worldMap.test.ts`:** `isNotable` counts a `sighted` event within `NOTICE_RADIUS` of either presence, and the Source from anywhere.
   - **`territory.test.ts`:** `daysToFall` with presences matches the pinned figure.
6. **CLAUDE.md.**
   - Fix the lines this makes wrong: the rules of the blight ("and the party, with `PARTY_BASE` and half its levels together" now sums over the parties' presences; "the party's hex is neutral" now means each presence's hex), the vision module's line, `passTurn`'s description, and `isNotable`'s measure.
   - Add `src/game/expedition.ts` to the module list in one line (the parties as the world's rules see them, `PartyPresence`; step 03 extends it).

### Invariants

- No draw of the world RNG is added, dropped or reordered.
- `passTurn`'s event order stays `[...advanceDay, ...updateTerritory, ...updateSight]`.
- `partyStrength`'s arithmetic is unchanged: `PARTY_BASE + Math.floor(sum / 2)`.

### Exclusions

- Leave `WorldState.party` and `WorldState.confronting` in place (step 04).
- Leave `GameState.party` and `GameState.baggage` in place (step 03).
- Do not change position-dependent rules (`routeTo`, `monstersHere`, `atEncampment`, …), which step 04 changes.
- No save change. `SAVE_VERSION` stays 18. `LOG_SCHEMA_VERSION` stays 23.

### Shared constraints (from the index)

- **Commands.** Use local Node 26 (prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`) or the podman `make` targets.
  - `npm test` (`tsc && vitest run`) is the gate before every commit.
  - `npx vitest run <file>` runs one file.
  - `npm run test:browser -- -t <name>` runs after any scene change. This step touches scenes only in their calls; run `npm run test:browser` once anyway.
- **The refactor guard.**
  - **The test.** `describe('the refactor guard')` in `scripts/simulate.test.ts` must pass. No step may edit its fixture. A mismatch means this step changed behaviour: find the cause and fix it.
  - **The 50-campaign check.** Run it before committing:

    ```sh
    npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
    shasum -a 256 logs/guard-50.jsonl
    ```

    The printed summary must equal, line for line, the one in step 01's execution record, and the hash must equal step 01's. Always use this exact `--out` path, since the first line names it.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. No step changes the order or arithmetic of the blight's sums or of the events a day returns.
- **Commits.** One commit, "Stage 5 step 02: world rules over presences", on `long-campaign-stage-05`, once `npm test` passes and the guard holds.
  - Do not push. Never switch branches.
  - End the message with the repo's `Co-Authored-By` attribution line.
  - This step is part of the design's step A.
- **Docs.** CLAUDE.md stays current. Search it for every name this step changes (`passTurn(world, party)`, `partyStrength`, `isNotable`, `updateSight`).

## 5. Verification

- The characterization tests from guidance step 1 pass, unchanged, before and after the change.
- The new list tests pass.
- `npm test` passes, the guard test included.
- The 50-campaign summary and log hash are identical to step 01's. Record the command, the `diff` of the summaries (empty) and both hashes.
- `npm run test:browser` passes.

## 6. Completion criteria

- [ ] `src/game/expedition.ts` exists with `PartyPresence` and `soloPresences` exactly as C2.
- [ ] Every function in C2 has C2's signature and rules, and no world rule reads `world.party` for influence, spawns, sight or notability.
- [ ] Characterization tests pinned before the change and passing after; list tests for one and two presences.
- [ ] The guard test passes, unedited; the 50-campaign summary and hash are identical to step 01's.
- [ ] CLAUDE.md is updated for the blight, vision and `passTurn` lines, and lists `expedition.ts`.
- [ ] One commit on the branch.
- [ ] The index's table shows step 02 done, with its commit.

## Execution record
