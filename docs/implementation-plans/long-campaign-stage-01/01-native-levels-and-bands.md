# Step 01: Native levels, encounter bands and the yardstick

**Plan:** [index](index.md). **Design:** [stage 1, foe foundations and bandits](../../designs/long-campaign/stage-01-foe-foundations-and-bandits.md), with reference [campaign-to-level-20 §5.2–§5.3](../../designs/long-campaign/reference/campaign-to-level-20.md).

## Objective

Put in place the foundations that later foes are built on:
- every monster kind gets a native level, and `foeAtLevel` scales from it;
- every encounter gets a band of threats and its own foe counts, which replace the global `FOES_AT_THREAT`;
- a single `foeStats(kind, level)` builds any foe;
- `encountersFor(threat)` lists the encounters for a threat;
- `foeYardstick(level)` exists, with a test of today's kinds at their native level.

**Nothing in play changes:** every battle that exists today fields the same foes with the same stats, and the seeded campaign summary is identical.

## Requirements and context

- **S1-R1:** Every unit kind has a native level. `foeAtLevel` scales from it, and today's kinds at threats 1 to 5 have exactly today's stats.
- **S1-R2 (this step's part):**
  - Every encounter has a band and counts for each threat in it.
  - A threat outside the band is clamped to it.
  - Spawn and placement by band come in step 04.
- **S1-R5:** `foeYardstick` and its test exist, with today's exceptions named.
- **Correction 3 (index):** today's five encounters (`goblin_raid`, `kobold_scouts`, `hobgoblin_warband`, `troll_lair`, `source_guardians`) all get band `{ min: 1, max: 5 }` and counts `[2, 3, 3, 3, 4]`, today's `FOES_AT_THREAT`.
- **Correction 4 (index):** the yardstick test checks every monster kind at its native level only (level 1 today), with named exceptions.

### Shared constraints

- **`make test`** runs the full suite in the podman container (Node 26). It must pass before the commit.
- **Quick local checks:** `npm run -s typecheck` and `npx vitest run --project domain` work on local Node 22.
- **The simulator runs only in podman,** with `make -s simulate ARGS="..."`. Local Node 22 cannot run `scripts/simulate.ts`. Never run two `make simulate` commands at the same time: both build the same image, and the loser prints nothing.
- **The guard for this step:** the seeded campaign summary must be **identical** before and after (see Verification).
- **Versions:** `SAVE_VERSION` (11) and `LOG_SCHEMA_VERSION` (17) do not change in this step.
- **The commit:** one commit once `make test` passes, on the current branch, not pushed. The message ends with the repo's `Co-Authored-By` attribution line.
- **CLAUDE.md:** update the lines this change makes wrong. The rules of scaling cite `FOES_AT_THREAT` and "foeAtLevel", so add native levels and bands briefly. Step 07 does the full documentation pass.

## Dependencies

None. This step produces the contracts that steps 03, 04 and 05 consume.

## Contracts produced (copied from the index)

### C1. Unit kinds (`src/game/encounters.ts`), the part for this step

```ts
/** Monsters: stat blocks scaled by foeAtLevel from their native level. */            // step 01 (new type; same members as today's foes)
export type MonsterKind = 'goblin' | 'kobold' | 'shaman' | 'horror' | 'hobgoblin' | 'troll' | 'armored_troll'
export type FoeKind = MonsterKind | BanditKind                                         // step 01 declares FoeKind = MonsterKind; step 03 widens it
export type UnitKind = 'warrior' | FoeKind                                              // existing name, redefined
```

In this step, declare `export type FoeKind = MonsterKind`. Step 03 adds `BanditKind` and widens it.

### C2. Native levels and scaling

```ts
// src/combat/combat.ts (existing function, new parameter) — step 01
export function foeAtLevel(base: CombatantStats, level: number, native = 1): CombatantStats
```

- `level` below `native` is treated as `native`. Let `above = level - native`.
- `ac`, `toHit`, the damage bonus and a caster's `maxMana` and `skill` grow by today's steps × `above`: `FOE_AC_PER_LEVEL` and `FOE_TO_HIT_PER_LEVEL` are 5, the damage bonus grows by `floor(above / FOE_DAMAGE_LEVEL_STEP)`, and `FOE_MANA_PER_LEVEL` is 3.
- `maxHp = Math.round(base.maxHp * (1 + FOE_HP_PER_LEVEL * (level - 1)) / (1 + FOE_HP_PER_LEVEL * (native - 1)))`.
- With `native = 1` every number equals today's exactly.
- Resistance and regeneration are unchanged, as today.

```ts
// src/game/encounters.ts — step 01
export const FOE_NATIVE_LEVEL: Record<MonsterKind, number>   // every MonsterKind: 1
/** A foe of `kind` at `level`: a monster by foeAtLevel from its native level; a bandit by banditStats (step 03). */
export function foeStats(kind: FoeKind, level: number): CombatantStats
```

In this step, `foeStats` handles monster kinds only: `foeAtLevel(FOE_STATS[kind], level, FOE_NATIVE_LEVEL[kind])`.

### C3. Encounter bands and counts (`src/game/encounters.ts`, step 01)

```ts
export interface ThreatBand { min: number; max: number }
export const ENCOUNTER_BANDS: Record<EncounterId, ThreatBand>
/** The encounters whose band holds `threat`, in ENCOUNTERS order. */
export function encountersFor(threat: number): EncounterId[]
/** The highest threat on today's map, and threatAt's cap until stage 9. */
export const MAX_THREAT = 5   // existing export, kept; no longer derived from FOES_AT_THREAT
```

- Each encounter has its slots, its band, and `counts: readonly number[]`, indexed by `threat - band.min`, whose length equals `band.max - band.min + 1`.
- Building an encounter at `threat`:
  - Its level is `clamp(Math.floor(threat), band.min, band.max)`.
  - Its foes are the slots whose `fromThreat` (default 1) ≤ that level, cut to `counts[level - band.min]`.
  - Each foe's stats are `{ ...foeStats(kind, level), name }`.
  - `Encounter.threat` is the level.
- The five existing encounters: band `{ min: 1, max: 5 }`, counts `[2, 3, 3, 3, 4]`. The private `FOES_AT_THREAT` goes.
- `ENCOUNTERS[id](party, threat?)` keeps its signature.

### C4. The yardstick (`src/combat/combat.ts`, step 01)

```ts
export interface FoeYardstick {
  ac: readonly [number, number]
  toHit: readonly [number, number]
  maxHp: readonly [number, number]
  /** Mean damage a turn: attacks a turn (floor(actionPoints / attackApCost), at least 1) × the mean of its damage roll. */
  meanDamage: readonly [number, number]
}
export function foeYardstick(level: number): FoeYardstick
```

Built from the ready-made fighter's measured growth (campaign §3), interpolated linearly between levels 1, 5, 10, 15 and 20, and clamped outside them:

| Level | Hero hit | Fighter HP | Fighter mean damage |
| --- | --- | --- | --- |
| 1 | 60 | 32 | 10.5 |
| 5 | 82 | 58 | 10.5 |
| 10 | 104 | 83 | 12.5 |
| 15 | 114 | 108 | 12.5 |
| 20 | 124 | 133 | 13.5 |

The bands are:
- `ac` = [hero hit − 55, hero hit − 35];
- `toHit` = [80, 100];
- `maxHp` = [3 × mean damage, 6 × mean damage];
- `meanDamage` = [fighter HP / 10, fighter HP / 6].

The test checks every `MonsterKind` at its native level. Each field outside its band must appear in a named exception map in the test, `{ kind, field, reason }`.

## Scope and implementation guidance

**Existing code, inspected at `9c740ae`:**

- **`src/combat/combat.ts`:**
  - `foeAtLevel(base, level)` uses `above = max(0, level - 1)`, `FOE_HP_PER_LEVEL` (0.7), `FOE_AC_PER_LEVEL` and `FOE_TO_HIT_PER_LEVEL` (5), `FOE_DAMAGE_LEVEL_STEP` (2) and `FOE_MANA_PER_LEVEL` (3).
  - The monster stat blocks are `GOBLIN_STATS`, `KOBOLD_STATS`, `GOBLIN_SHAMAN_STATS`, `BLIGHT_HORROR_STATS`, `HOBGOBLIN_CHIEF_STATS`, `TROLL_STATS` and `ARMORED_TROLL_STATS`.
  - `DamageRoll` is `{ count, sides, bonus }`, and `CombatantStats` has `actionPoints` and `attackApCost`.
- **`src/game/encounters.ts`:**
  - `UnitKind` is a union literal, and `FOE_XP: Record<UnitKind, number>`.
  - `FOES_AT_THREAT = [2, 3, 3, 3, 4]` is private, and `MAX_THREAT = FOES_AT_THREAT.length` is exported.
  - `FoeSlot` has `{ id, kind: Exclude<UnitKind, 'warrior'>, name, at, fromThreat? }`, and `FOE_STATS` maps the kind to its block.
  - The private `encounter(party, slots, threat)` clamps the level to 1..`MAX_THREAT`.
  - The slot lists are `GOBLIN_RAID`, `KOBOLD_SCOUTS`, `HOBGOBLIN_WARBAND`, `TROLL_LAIR` and `SOURCE_GUARDIANS`, with exported builders for each.
  - `xpReward` and `ENCOUNTERS` (the `satisfies` record), and `EncounterId = keyof typeof ENCOUNTERS`.
- **Who imports `MAX_THREAT`:** `src/game/worldMap.ts` (`threatAt` caps at it). Keep the export and its value of 5.

**Changes:**

1. **`foeAtLevel`** gains `native = 1` per C2. Keep the doc comment's reasoning, and add a sentence on native levels.
2. **Kinds and native levels** in `encounters.ts`:
   - Introduce `MonsterKind`, `FoeKind` (= `MonsterKind` for now) and `UnitKind = 'warrior' | FoeKind`.
   - `FoeSlot.kind` becomes `FoeKind`.
   - `FOE_STATS` is typed `Record<MonsterKind, CombatantStats>`.
   - Add `FOE_NATIVE_LEVEL` (all 1) and `foeStats`.
3. **Bands and counts:**
   - Replace `FOES_AT_THREAT` with a per-encounter definition: slots, band and counts (proposed shape `{ slots, band, counts }`).
   - Export `ENCOUNTER_BANDS`, derived from those definitions, so it cannot drift from them.
   - Rewrite `encounter()` per C3.
   - Make `MAX_THREAT` the literal 5, with the doc of C3.
   - Add `encountersFor`.
   - Move the doc comment on counts (numbers tell more than levels) to the per-encounter counts.
4. **`foeYardstick`** in `combat.ts`, per C4, with a small linear interpolation helper.
5. **Tests:**
   - **`src/combat/combat.test.ts`:**
     - `foeAtLevel(base, L)` equals `foeAtLevel(base, L, 1)`, and both equal the existing expectations.
     - With native N, level N returns the block unchanged.
     - At level N+1, `ac` and `toHit` are +5, and `maxHp` follows the C2 formula: for example, base 60 at native 15, level 16, gives `round(60 × 11.5 / 10.8)` = 64.
     - A level below native is treated as native.
     - `foeYardstick` values at levels 1, 7 (interpolated) and 25 (clamped).
   - **The yardstick test:** a new test, proposed in `src/game/encounters.test.ts` because it needs `FOE_NATIVE_LEVEL`. For every `MonsterKind`, it computes the block at its native level (`foeStats(kind, FOE_NATIVE_LEVEL[kind])`) and its mean damage a turn per C4, and asserts each field is within its band or listed in the exception map with a reason. Fill the map by running the test, and write a short reason for each entry (for example, "the Kobold is a weak foe, worth 50 XP").
   - **`src/game/encounters.test.ts` (existing):**
     - Add the bands and counts for the five encounters.
     - Clamping: threat 0 → 1, threat 9 → 5, threat 3.7 → 3.
     - `encountersFor(3)` lists all five, and `encountersFor(6)` none.
     - Each existing encounter's unit list at threats 1 to 5 is unchanged. Keep the existing assertions, and add a comparison against a snapshot of the stats if useful.
   - **Leave as they are:** `src/character/progression.test.ts` reads `FOE_XP`, and `src/scenes/unitLook.test.ts` iterates `Object.keys(FOE_XP)` for atlas sprites. Both must keep passing, and no keys are added to `FOE_XP` in this step.

**Excluded:** bandit kinds and `banditStats` (step 03); spawns by band and map changes (step 04); any change to counts, stats or `threatAt`.

## Verification

1. **The baseline, before any code change.** Run `make -s simulate ARGS="--campaign --battles 500 --seed 1" > /tmp/claude-…/scratchpad/s01-before.txt` (any scratch path) and keep the summary.
2. **Quick checks:** `npm run -s typecheck` and `npx vitest run --project domain` pass locally.
3. **The full suite:** `make test` passes.
4. **The guard.** Run `make -s simulate ARGS="--campaign --battles 500 --seed 1" > …/s01-after.txt`. `diff` of the two summaries (ignoring podman build lines, which start with `STEP`, `-->`, `COMMIT`, `Successfully` or a 64-hex id) is empty. Expect "Beat the Source: 320 of 500" or whatever the baseline says. Any difference means a behaviour change, which must be found and removed.
5. **Spot check:** `make -s simulate ARGS="--encounter troll_lair --threat 5 --party-level 5 --battles 200 --seed 1"` gives the same summary before and after.

## Completion criteria

- [ ] `foeAtLevel` has the `native` parameter. `FOE_NATIVE_LEVEL`, `foeStats`, `ThreatBand`, `ENCOUNTER_BANDS`, `encountersFor`, `MAX_THREAT` (= 5), `foeYardstick` and `FoeYardstick` are exported as in C1–C4.
- [ ] `FOES_AT_THREAT` is gone, and each encounter carries its band and counts.
- [ ] The new and updated tests pass, including the yardstick test with its named exceptions.
- [ ] `make test` passes, and the campaign and troll-lair summaries are identical before and after.
- [ ] The CLAUDE.md lines naming `FOES_AT_THREAT` and the scaling rule mention per-encounter counts, bands and native levels.
- [ ] One commit is made, and the index's step 01 row is set to `done`, with a completion note here (commit hash, the commands run, "summary identical").
