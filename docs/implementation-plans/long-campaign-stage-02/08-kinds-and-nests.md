# Step 08: The new kinds and nests

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-02-special-attacks-and-elements.md) (§2 "Two new kinds and nests", §4, S2-R7)

**Difficulty:** routine, following stage 1's bandit steps ([03](../long-campaign-stage-01/03-bandits-and-camp.md) and [04](../long-campaign-stage-01/04-map-and-spawns.md)). A `model: "sonnet"` implementer can do it; the yardstick exceptions need a line of judgement each.

## 1. Objective

The Giant Spider and the Salamander join the game:
- two monster stat blocks, `GIANT_SPIDER_STATS` (native 4) and `SALAMANDER_STATS` (native 5), carrying the abilities steps 04 and 05 built and the Salamander's fire ward;
- two `MonsterKind`s, their native levels and `FOE_XP`;
- two encounters, `spider_nest` and `salamander_pool`;
- two threat-5 nests on today's map in place of the Troll Den and the Goblin Pillagers;
- `SAVE_VERSION` 14 → 15.

When it is done, `fight salamander_pool 5` and `fight spider_nest 4` start those battles, and a new game has both nests in the east.

## 2. Requirements and context

- **S2-R7:** the Giant Spider and the Salamander, with their nests, map places and sprites. (The Troll's routine was step 04; the sprites are step 07.)
- **S2-R4, in part:** monster wards. The Salamander's fire ward 99 makes Flame Arrow and Fireball deal 0 to it (step 03's `warded`), while statuses are still laid (correction 14).
- **What the player sees (design §4):** a Salamander spits a cone of fire that burns its own kobolds too, and is warded against fire; Giant Spiders web a hero from range, then close and bite twice, the second bite poisoning.
- **Corrections that bear on this step** (index):
  - **2.** Both replaced locations lie at threat 5 (`threatAt`: 49 and 52 hexes from home). The Troll Den becomes the Salamander Pool; the Goblin Pillagers become the Spider Nest. Both are fought at threat 5 on the map. The Spider Nest keeps its band 4–5; its threat-4 cell is checked in the simulator only (step 09).
  - **3.** The spider's Web is the area ability `spider_web`, not the Web spell. The spider has no `magic`.
  - **11.** The blocks' unspecified numbers, the counts, positions and `FOE_XP` are first values. Step 09 tunes them; this step does not.
  - **12.** `SPAWN_KINDS` (`src/game/blight.ts`) is unchanged: the new nests do not spawn.
  - **15.** `SAVE_VERSION` 14 → 15 here, as two fixed locations change.
- **The early-game guard.** This step replaces two threat-5 nests, so the campaign figure may move. Measure it (§5) and record it; step 09 judges it against step 01's baseline (a move of more than about 5 points must be explained or retuned away). Do not tune here.

### Contract C7 (from the index, unchanged)

```ts
// src/combat/combat.ts (new stat blocks; first values, correction 11)
export const GIANT_SPIDER_STATS: CombatantStats  // native 4
export const SALAMANDER_STATS: CombatantStats    // native 5
// src/game/encounters.ts
export type MonsterKind = /* existing */ | 'giant_spider' | 'salamander'
// FOE_NATIVE_LEVEL: giant_spider 4, salamander 5. FOE_XP: giant_spider 100, salamander 120.
export function spiderNest(party: readonly Fighter[], threat = 4): Encounter
export function salamanderPool(party: readonly Fighter[], threat = 5): Encounter
// ENCOUNTERS gains spider_nest: spiderNest, salamander_pool: salamanderPool
```

| Block | HP | AC | To hit | Crit | Damage | Weapon | Attack AP | Range | AP | Resistance | Wards | Abilities |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Giant Spider | 20 | 25 | 80 | 5 | 1d6+2 | Fangs | 5 | 1 | 8 | 1 | — | `spider_bite`, `spider_web` |
| Salamander | 26 | 30 | 85 | 5 | 1d8+2 | Claws | 5 | 1 | 8 | 2 | fire 99 | `fire_spit` |

| Encounter | Band | Counts | Slots in order (id, kind, name, position) |
| --- | --- | --- | --- |
| `spider_nest` | 4–5 | [2, 3] | `spider` giant_spider Giant Spider (8, 4); `sneak` kobold Kobold Sneak (9, 2); `spider2` giant_spider Giant Spider (8, 6) |
| `salamander_pool` | 5–5 | [3] | `salamander` salamander Salamander (8, 4); `kobold` kobold Kobold (8, 2); `kobold2` kobold Kobold (8, 6) |

- **The map** (`src/game/worldMap.ts` `newWorld`), positions and loot kept:

  | Was | Becomes | Position | Encounter | Threat |
  | --- | --- | --- | --- | --- |
  | `troll_den` 'Troll Den' | `salamander_pool` 'Salamander Pool' | (54, 28) | `salamander_pool` | 5 |
  | `goblin_pillagers` 'Goblin Pillagers' | `spider_nest` 'Spider Nest' | (57, 10) | `spider_nest` | 5 |

- `SPAWN_KINDS` is unchanged (correction 12). `SAVE_VERSION` 14 → 15.
- **Sprites:** units are drawn by the atlas sprite named for their `UnitKind`, so the atlas must hold `giant_spider` and `salamander` (step 07) before the kinds join `FOE_XP`.

## 3. Dependencies and prerequisites

**Hard prerequisites: steps 05 and 07** (05 after 02, 03 and 04). What they produce, from the index's contracts:

- **From step 02 (C1):** `AreaShape` and `areaOf` in `src/grid/hex.ts`; `areaTouches` in `battleEngine.ts`.
- **From step 03 (C2, C3):** `Element`, `ELEMENTS` and `CombatantStats.wards?: Partial<Record<Element, number>>` in `src/combat/combat.ts`; `warded(damage, element, stats)` = `max(0, damage − ward)`, applied to casts and ticks; `CastOutcome.warded`; the statuses `cursed` and `webbed` in `STATUS_IDS` (Webbed: −4 action points).
- **From step 04 (C4):** `src/combat/abilities.ts` with `Ability`, `Strike`, `ABILITIES`, `AbilityId`; `CombatantStats.abilities?: readonly AbilityId[]` (in `ABILITY_IDS` order) and `abilityDamageBonus?: number`, which `foeAtLevel` raises for a block with `abilities` by `floor(above / FOE_DAMAGE_LEVEL_STEP)`; the `ability` action and `recharging`; the routine `spider_bite` (Bite, verb "bites", 4 AP, recharge 1: Bite 1d6+2, Venom Bite 1d6+2 laying Poisoned 3 turns); the yardstick test's mean damage a turn as the better of the weapon's turn and the routine's turn (the routine's strikes' means with `abilityDamageBonus`, times `floor(actionPoints / apCost)`, at most 1 when `recharge` ≥ 1); `SAVE_VERSION` 14.
- **From step 05 (C5, C6):** `spider_web` (Web, verb "spins a web", 4 AP, recharge 3, burst range 4 radius 1, no damage, lays Webbed 2 turns) and `fire_spit` (Fire Spit, verb "spits fire", 4 AP, recharge 2, cone range 2, 3d6 fire, lays Seared 1 turn, half on a miss) in `ABILITIES`; `AbilityEvent`; the policy's area and status-area rules.
- **From step 07:** the atlas sprites `giant_spider` and `salamander`, each with the frame `<kind>/idle_0` and the animations `<kind>/idle` and `<kind>/walk`. `src/scenes/unitLook.test.ts` requires these for every key of `FOE_XP`, so do not add the kinds to `FOE_XP` without them.

**Existing code (at `51cecb5`) this step edits:**
- `src/combat/combat.ts`: the monster blocks (`TROLL_STATS` and its neighbours are the pattern).
- `src/game/encounters.ts`: `MonsterKind`, `FOE_STATS`, `FOE_NATIVE_LEVEL`, `FOE_XP`, the `*_SLOTS` lists and `EncounterDef`s, `ENCOUNTERS`, `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`.
- `src/game/worldMap.ts` `newWorld`: the `monsters('troll_den', …)` and `monsters('goblin_pillagers', …)` lines.
- `src/game/save.ts`: `SAVE_VERSION`.

**Environment:** the simulator runs only in podman (`make -s simulate ARGS="..."`); never two at once.

## 4. Scope and implementation guidance

1. **The blocks** in `src/combat/combat.ts`, each with a short doc comment in the style of the others (what it is and how it fights), exactly the C7 table's numbers. The Salamander's `wards: { fire: 99 }`. Neither has `magic` or `regeneration`.
2. **The kinds** in `src/game/encounters.ts`: `MonsterKind` gains `'giant_spider' | 'salamander'`; `FOE_STATS`, `FOE_NATIVE_LEVEL` (4 and 5) and `FOE_XP` (100 and 120) gain entries. Extend `FOE_XP`'s comment: the spider and the Salamander are priced near an even foe of their native level (`EVEN_FOE_XP_PER_LEVEL`), the Salamander a little above for its spit and ward; first values for step 09.
3. **The encounters:** `SPIDER_NEST_SLOTS` and `SALAMANDER_POOL_SLOTS` as in C7, `EncounterDef`s with their bands and counts, the functions `spiderNest(party, threat = 4)` and `salamanderPool(party, threat = 5)` with doc comments, and entries in `ENCOUNTERS`, `ENCOUNTER_BANDS` and `ENCOUNTER_COUNTS`. Slot positions are off the party's `PARTY_START` hexes. With counts [2, 3], threat 4 fields the Giant Spider and the Kobold Sneak, and threat 5 adds the second spider.
4. **The map:** replace the two `monsters(...)` lines in `newWorld` as in C7's map table, each keeping its position and loot (the Salamander Pool `[SAGE_CIRCLET]`, the Spider Nest `[EMBERBLADE]`). `threatAt` gives both threat 5; do not set the threat by hand.
5. **Spawns:** leave `SPAWN_KINDS` alone. `encountersFor(4)` and `encountersFor(5)` will now list the new encounters, but `spawn` draws only from `SPAWN_KINDS`, so the blight spawns as before. Check that no test or caller assumes `encountersFor` equals the spawn kinds.
6. **`SAVE_VERSION`** 14 → 15 in `src/game/save.ts`.
7. **Tests:**
   - `src/game/encounters.test.ts`:
     - the encounter-wide `describe.each` over `ENCOUNTERS` covers the new two; make sure they pass;
     - the fields at each threat of the bands: `spider_nest` at 4 (spider, sneak) and 5 (spider, sneak, spider2), clamped below 4 and above 5; `salamander_pool` at 5 (salamander, kobold, kobold2), clamped either side;
     - the stats: `foeStats('giant_spider', 4)` equals `GIANT_SPIDER_STATS` but for `abilityDamageBonus` 0; at 5 it is one level up (`foeAtLevel` with native 4); the Salamander at 5 carries `wards.fire` 99 and `abilities: ['fire_spit']`;
     - `xpReward`: a threat-5 Salamander Pool is `(120 + 50 + 50) × 5`; a threat-4 Spider Nest `(100 + 50) × 4`;
     - **the yardstick:** both kinds are held to it at their native level. Fields they sit outside (expected: the spider's and the Salamander's `maxHp`, below 3 × the fighter's mean damage, and likely the spider's routine damage) go into the `EXCEPTIONS` list with a reason each (for example, "the Giant Spider is a fragile ambusher; its Web and venom are its danger"). Do not change the blocks to fit.
   - `src/game/worldMap.test.ts`: the loot table names `'Troll Den'` and `'Goblin Pillagers'`; rename them to `'Salamander Pool'` and `'Spider Nest'`, loot unchanged. Add a check that both are monster locations at threat 5 with their encounters, and that no `troll_den` or `goblin_pillagers` remains.
   - `src/game/vision.test.ts`: `expect(world.sighted).not.toContain('goblin_pillagers')` becomes `'spider_nest'` (same position, still unexplored at the start).
   - `src/game/save.test.ts` (or wherever the version is pinned): 15.
   - `src/scenes/unitLook.test.ts` passes unchanged once the kinds are in `FOE_XP`, given step 07's sprites.
8. **CLAUDE.md**, the lines this change makes wrong: the `encounters.ts` bullet (the two new kinds and encounters, with their bands); the rules of scaling (the two nests that replaced the Troll Den and the Goblin Pillagers, at threat 5; the Salamander's fire ward; the new nests do not spawn). Step 09 adds the figures. If step 06 runs in parallel, edit only these lines.

**Out of scope:** tuning (step 09), new abilities or changes to `ABILITIES`, spawn kinds, sprites (step 07), the scene (step 06), the manual (step 09).

## 5. Verification

1. **`make test`** passes (typecheck and both vitest projects).
2. **Quick local checks:** `npm run -s typecheck`; `npx vitest run --project domain src/game/encounters.test.ts src/game/worldMap.test.ts src/game/vision.test.ts`.
3. **Smoke cells** (podman, one at a time), to show each nest fights to an end without errors; record wins of 500 and average rounds, but do not tune:
   - `make -s simulate ARGS="--encounter spider_nest --threat 4 --party-level 4 --battles 500 --seed 1"`
   - `make -s simulate ARGS="--encounter spider_nest --threat 5 --party-level 5 --battles 500 --seed 1"`
   - `make -s simulate ARGS="--encounter salamander_pool --threat 5 --party-level 5 --battles 500 --seed 1"`
   Check in the summary that enemy area attacks are above 0 (the spit and the web are used).
4. **The guard:** `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`. Record the Source beaten of 500, days, battles, heroes dead, and the per-threat table, against step 01's baseline (in the index and step 01's record). Step 09 judges it.
5. **A look in the game, if a browser is at hand** (`make dev`, the debug console): `fight salamander_pool 5` and `fight spider_nest 4` start, and both kinds are drawn with their sprites, not a placeholder. If not walked, say so in the record.

## 6. Completion criteria

- [ ] `GIANT_SPIDER_STATS` and `SALAMANDER_STATS` exactly as C7; the kinds, native levels and `FOE_XP` added.
- [ ] `spider_nest` and `salamander_pool` in `ENCOUNTERS`, `ENCOUNTER_BANDS` and `ENCOUNTER_COUNTS`, with the C7 slots, bands and counts.
- [ ] The Troll Den and the Goblin Pillagers replaced by the Salamander Pool and the Spider Nest, positions and loot kept, both threat 5; `SPAWN_KINDS` unchanged.
- [ ] `SAVE_VERSION` is 15.
- [ ] Tests added and updated as in §4.7, yardstick exceptions named with reasons; `make test` passes.
- [ ] The three smoke cells and the guard measured and recorded below.
- [ ] CLAUDE.md's lines updated.
- [ ] Committed on the current branch, without pushing; the message ends with the repo's `Co-Authored-By` attribution line.
- [ ] The index's step 08 row set to `done` with the commit; this file's execution record filled in. If a contract had to change, amend it in the index, marked "step 08".

## Execution record
