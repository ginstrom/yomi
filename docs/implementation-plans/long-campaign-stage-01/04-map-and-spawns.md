# Step 04: Bandits on the map

[Plan index](index.md) · [Source design](../../designs/long-campaign/stage-01-foe-foundations-and-bandits.md)

## Objective

Two of today's nests become bandit camps, and corrupted land can spawn a **Bandit Gang** wherever the Bandit Camp's band holds the threat. Spawns choose only kinds whose encounter band holds the spawn's threat. `SAVE_VERSION` goes from 11 to 12.

After this step, a player meets bandits in a normal campaign at threats 3 and 4.

## Requirements and context

- **S1-R2 (spawns and placement by band):** a spawn picks its kind only among the kinds whose band holds `threatAt` of where it lands. Every fixed monster location's encounter band holds its threat.
- **S1-R4 (the map and the spawn kind):** two locations become bandit locations, and `SPAWN_KINDS` gains "Bandit Gang".
- **A correction from the index:** the Bandit Hideout stands at threat 4, not 5, because `threatAt` of (47, 13) is 4.
- **Constraints:**
  - Threat 1 and 2 spawns must draw exactly as today: the same RNG draws, in the same order.
  - The guard figure may move in this step, because the map changes. It is measured here and judged in step 07.

### Contract C3 (from index, unchanged)

```ts
export interface ThreatBand { min: number; max: number }
export const ENCOUNTER_BANDS: Record<EncounterId, ThreatBand>
/** The encounters whose band holds `threat`, in ENCOUNTERS order. */
export function encountersFor(threat: number): EncounterId[]
/** The highest threat on today's map, and threatAt's cap until stage 9. */
export const MAX_THREAT = 5   // existing export, kept; no longer derived from FOES_AT_THREAT
```

The five existing encounters have the band `{ min: 1, max: 5 }`.

### Contract C6, the part this step consumes (from index, unchanged)

```ts
export function banditCamp(party: readonly Fighter[], threat = 3): Encounter
// ENCOUNTERS gains bandit_camp: banditCamp  →  EncounterId includes 'bandit_camp'
```

Its band is `{ min: 3, max: 7 }`, with counts `[3, 3, 4, 4, 4]`.

### Contract C7 (from index, unchanged)

- **Two locations change** in `src/game/worldMap.ts` `newWorld` (existing), keeping their positions and loot:

  | Was | Becomes | Position | Encounter | Threat |
  | --- | --- | --- | --- | --- |
  | `kobold_skulkers` 'Kobold Skulkers' | `bandit_camp` 'Bandit Camp' | (30, 22) | `bandit_camp` | 3 |
  | `goblin_outriders` 'Goblin Outriders' | `bandit_hideout` 'Bandit Hideout' | (47, 13) | `bandit_camp` | 4 |

- **Spawns.** `src/game/blight.ts` `SPAWN_KINDS` (existing) gains `{ encounter: 'bandit_camp', name: 'Bandit Gang' }`. `spawn` draws the kind from those whose `ENCOUNTER_BANDS[encounter]` holds `threatAt(at)`. The draw is `eligible[Math.floor(rng() * eligible.length)]`, with every other RNG draw in the same order as today.
- **Versions:** `SAVE_VERSION` goes 11 → 12.

## Dependencies and prerequisites

**Steps 01 and 03 must be done:**
- **Step 01** produced `ENCOUNTER_BANDS` and `encountersFor` in `src/game/encounters.ts`.
- **Step 03** produced the `bandit_camp` encounter in `ENCOUNTERS`, its band, the bandit `UnitKind`s with `FOE_XP`, and the bandit sprites (step 02 through 03).

Check that all of these exist before starting. If `bandit_camp` is not in `ENCOUNTERS`, stop and mark this step blocked on 03.

**Existing code, inspected at `9c740ae`:**
- **`src/game/worldMap.ts` `newWorld`** lists the fixed locations with the helper `monsters(id, name, col, row, encounter, loot)`. Each threat comes from `threatAt(offsetToHex(col, row))`. The two lines to change are:
  - `monsters('kobold_skulkers', 'Kobold Skulkers', 30, 22, 'kobold_scouts', [SHADOW_CLOAK])`;
  - `monsters('goblin_outriders', 'Goblin Outriders', 47, 13, 'goblin_raid', [STORM_WAND])`.

  Measured threats: (30, 22) is 3, and (47, 13) is 4.
- **`src/game/blight.ts`:**
  - `SPAWN_KINDS` is `[{ encounter: 'goblin_raid', name: 'Goblin Brood' }, { encounter: 'kobold_scouts', name: 'Kobold Nest' }]`.
  - `spawn(world, pinned, partyIndex)` makes one RNG (`mulberry32(world.rng)`) and draws, in order: the position (`candidates[Math.floor(rng() * candidates.length)]`), the kind (`SPAWN_KINDS[Math.floor(rng() * SPAWN_KINDS.length)]`), the loot chance (`rng() < SPAWN_LOOT_CHANCE`), then the loot item. It saves `world.rng = rng.state()` afterwards.
  - The new location's `threat` is `threatAt(at)`.
- **`src/game/save.ts`:** `export const SAVE_VERSION = 11`. `save.test.ts` refers to `SAVE_VERSION` symbolically, and checks that a different version is refused.
- **`src/game/worldMap.test.ts`:** the test "gives every monster location loot of its own" maps every location name to its loot, including `'Kobold Skulkers': ['Cloak of Shadows']` and `'Goblin Outriders': ['Wand of Storms']`.
- **Other references.** A grep for `kobold_skulkers`, `goblin_outriders`, `Kobold Skulkers` and `Goblin Outriders` in `src`, `scripts`, `e2e`, the story and tutorial modules and the manual finds only `worldMap.ts` and `worldMap.test.ts`. Re-run the grep before finishing, in case earlier steps added any.

## Scope and implementation guidance

1. **The locations.** In `newWorld`, replace the two lines as in C7: same coordinates, same loot (`SHADOW_CLOAK` and `STORM_WAND`), with the new ids, names and encounter `'bandit_camp'`.
2. **Spawns by band.** In `spawn`:
   1. Draw the position exactly as today.
   2. Compute `threat = threatAt(at)`, and `eligible = SPAWN_KINDS.filter((k) => band(k.encounter) holds threat)`, using `ENCOUNTER_BANDS`.
   3. Draw the kind as `eligible[Math.floor(rng() * eligible.length)]`.
   4. Draw the loot chance and item as today.

   At threats 1 and 2 the eligible list is today's two kinds in today's order, so those draws are unchanged.

   If `eligible` is ever empty (no kind's band holds the threat), return `null` before drawing the kind. On today's map that cannot happen, since the goblin and kobold bands are 1–5. Keep that path covered by a test that uses a threat no band holds, or reasoned in a comment if no clean seam exists.
3. **`SAVE_VERSION`** goes to 12 in `src/game/save.ts`. Any older save is refused, as the project does today.
4. **Tests:**
   - `worldMap.test.ts`:
     - Update the loot map to `'Bandit Camp': ['Cloak of Shadows']` and `'Bandit Hideout': ['Wand of Storms']`.
     - Add a test that every fixed monster location's `ENCOUNTER_BANDS[encounter]` holds its `threat`.
     - Add a test that `bandit_camp` is threat 3 and `bandit_hideout` is threat 4.
   - `blight.test.ts`, under `describe('spawning')`:
     - Over many seeds (say 200), force spawns (as the existing tests do with `world.spawnPressure = SPAWN_COST`), and check every spawned location's encounter band holds its threat.
     - A Bandit Gang appears only at threat 3 or more.
     - Spawns at threats 1 and 2 have the same location, kind and loot as the code before this step produced. Capture expected outcomes for a few fixed seeds before changing `spawn`, and assert them after.
5. **CLAUDE.md:**
   - In the blight paragraph, the sentence on spawns should say the kind is drawn among those whose encounter band holds the spawn's threat: Goblin Brood, Kobold Nest, and the Bandit Gang from threat 3.
   - In the rules of scaling, the sentence listing the armoured nests and the map's nests should mention the Bandit Camp (threat 3) and Bandit Hideout (threat 4), which replaced the Kobold Skulkers and Goblin Outriders.
   - Keep the edits to the lines this change makes wrong. Step 07 writes the stage's fuller documentation.

**Exclusions:**
- Do not change other locations, `threatAt`, the encounters, or the blight's constants.
- Do not tune bandit counts here (step 07).

## Verification

1. `npm run -s typecheck` and `npx vitest run --project domain` locally while working.
2. `make test` (podman, the full suite) passes.
3. **The guard run.**
   - Run `make -s simulate ARGS="--campaign --battles 500 --seed 1"`. If step 06 is done, add `--ready-level 7`; it is the default either way.
   - Record in this file's completion note:
     - the Source share;
     - days and battles a campaign;
     - heroes dead;
     - the win rate by threat;
     - the bandit encounters' win rate, filtered by `meta.encounter === 'bandit_camp'` in `logs/campaign.jsonl` if the summary does not split it.
   - Compare with the baseline of 320 of 500 (64%). Do not tune here: note the difference for step 07.
   - Never run two `make simulate` commands at once.
4. **By hand, if convenient:** a new game shows "Bandit Camp" and "Bandit Hideout" on the map (`locations all` in the debug console), and attacking the camp fields bandits.

## Shared constraints

- `make test` is the gate before the commit. Local Node 22 can typecheck and run the domain tests, but not the simulator.
- Commit once `make test` passes, on the current branch, without pushing. The message ends with the repo's `Co-Authored-By` attribution line.
- `LOG_SCHEMA_VERSION` is unchanged.

## Completion criteria

- [x] The two locations are replaced as in C7. Spawns draw from kinds in band. `SAVE_VERSION` is 12.
- [x] The new and updated tests pass, including unchanged threat 1–2 spawns. `make test` passes.
- [x] The guard run's figures are recorded below for step 07.
- [x] The CLAUDE.md lines are updated.
- [x] Committed. The index row for 04 is set to `done`, with the commit hash.

## Completion note

- **Status:** done. Commit `7ff2fb9` ("Step 04: bandits on the map").
- **Built:**
  - `src/game/worldMap.ts`: Kobold Skulkers (30, 22) is now `bandit_camp` 'Bandit Camp', and Goblin Outriders (47, 13) `bandit_hideout` 'Bandit Hideout', both fighting `bandit_camp`, with their old loot (Cloak of Shadows, Wand of Storms). Threats 3 and 4, as measured.
  - `src/game/blight.ts`: `SPAWN_KINDS` gains `{ encounter: 'bandit_camp', name: 'Bandit Gang' }`. `spawn` draws the position, then the kind among those whose `ENCOUNTER_BANDS` holds `threatAt(at)` (`eligible[Math.floor(rng() * eligible.length)]`), then the loot, as before. The number of draws is unchanged, so the world RNG's stream is the same as before for every spawn; only the kind at threats 3 to 5 differs.
  - The empty-`eligible` path returns `null` before the kind is drawn, leaving `world.rng` unsaved and the pressure in place. It is covered by a comment, not a test: `threatAt` stops at `MAX_THREAT` (5), inside the goblins' and kobolds' bands, and `spawn` is private, so no clean seam gives it a threat no band holds.
  - `src/game/save.ts`: `SAVE_VERSION` 12.
  - CLAUDE.md: the `encounters.ts` bullet (the camp is now at two nests and in Bandit Gang spawns, no longer "not yet on the map"); the blight's spawn sentence (the kind drawn among those whose band holds the threat: Goblin Brood, Kobold Nest, and from threat 3 the Bandit Gang); the rules of scaling (a sentence after the armoured foes: the Bandit Camp, threat 3, and the Bandit Hideout, threat 4, replaced the Kobold Skulkers and Goblin Outriders).
  - A re-run grep for `kobold_skulkers`, `goblin_outriders`, `Kobold Skulkers` and `Goblin Outriders` in `src`, `scripts`, `e2e` and `docs/manual` finds nothing.
- **Tests:**
  - `worldMap.test.ts`: the loot map renamed; every fixed monster location's band holds its threat; `bandit_camp` is threat 3 and `bandit_hideout` threat 4.
  - `blight.test.ts` (`spawning`): over seeds 1 to 200 with all land at threats 1 to 5 corrupted (two hexes clear of every location) and a forced spawn, every spawn's band holds its threat; Bandit Gangs appear, and only at threat 3 or more, with `bandit_camp`; for seeds 1 to 4, three forced spawns with only the land at threats 1 and 2 corrupted give the same places, kinds and loot at threats 1 and 2 as the code before this step (captured on `70b3075` before `spawn` changed; seeds 3 and 4 also make a spawn at threat 4 or 5 on land already corrupted, before or among them, showing the draws after it are unchanged).
  - Red first: the Bandit Gang test and the two `worldMap` tests failed before the change; the band and unchanged-spawn tests passed before it, as they should (they guard what must not change).
- **Verification:**
  - `npm run -s typecheck` clean; `npx vitest run --project domain`: 55 files, 730 tests passed.
  - `make test`: 64 files, 739 tests passed.
  - Guard, `make -s simulate ARGS="--campaign --battles 500 --seed 1"` (step 06 not done, so no `--ready-level`; 7 is the default):
    - **Beat the Source: 91 of 500 (18.2%)**, against the baseline 320 of 500 (64%): a fall of 46 points. The party fell in 409 (81.8%); the encampment never lost; never out of days.
    - A campaign: 126 days, 9.1 battles, 10.4 spawns (baseline 328 days, 22.5 battles); 1.2 heroes dead a campaign (baseline 1.6, but over far fewer battles); guild hall level 1.6, 1.2 recruits.
    - Won by threat: 1, 1000 of 1000; 2, 974 of 1006 (96.8%); 3, 852 of 1171 (72.8%); 4, 972 of 985 (98.7%); 5, 326 of 371 (87.9%).
    - Bandit Camp battles (`meta.encounter === 'bandit_camp'` in `logs/battles.jsonl`, the summary does not split them): threat 3, 364 of 683 (53.3%); threat 4, 341 of 350 (97.4%); threat 5, 66 of 78 (84.6%). By location: the fixed **Bandit Camp (threat 3) 185 of 500 (37%)**, every campaign meeting it with the party of three all at level 3; Bandit Hideout (threat 4) 74 of 78; Bandit Gang spawns 179 of 183 at threat 3, 267 of 272 at threat 4, 66 of 78 at threat 5.
    - Battles lost: the Bandit Camp at threat 3 319 (78% of all 409 losses), Goblin Raid at threat 2 32, the Source 31, Bandit Gangs at threat 5 12 and at 4 9, Troll Lairs 6. The Goblin Raid losses are a knock-on effect: all 32 were the Goblin Reavers fought by a lone survivor (party of one at level 4) after the Bandit Camp killed two heroes. Monster encounters otherwise win as before (Goblin Raid and Kobold Scouts every battle at threats 3 to 5).
- **For step 07:** the guard fall is almost entirely the fixed Bandit Camp at threat 3, which the campaign reaches with a level 3 party of three and wins 37% (matching step 03's cell, 35%). Later bandit fights, against a stronger, larger party, are won 85 to 99%. The lever is the threat-3 camp (its count of 3, or its gear, or the Captain's survivability); no tuning was done here, as the brief directs.
- **Deviations:** none from the task file. The spawn-band tests corrupt land by hand (`corruptWhere`) to reach spawns at chosen threats, since forced spawns on a fresh world land only in the far east, at threats 4 and 5.
