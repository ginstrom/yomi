# Step 04: Abilities, routines and recharge

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-02-special-attacks-and-elements.md) (§2 "Abilities", "The engine", "Existing kinds"; §5; §6) · Reference: [`campaign-to-level-20.md`](../../designs/long-campaign/reference/campaign-to-level-20.md) §4.4 and §5.4

**Difficulty:** intricate engine and policy logic. Use the session's model (CLAUDE.md, "Subagents"), not `sonnet`.

## 1. Objective

Monsters gain abilities, data by id as spells are, and the first kind of ability: the **strike routine**, several weapon strikes as one action, with retargeting when a target falls. Abilities **recharge**, and the counters live on units and in snapshots. The **Troll** swaps its two-claw turn for the routine `troll_claws`. The `aggressive` policy picks the **best strike**, a routine or a plain attack. The yardstick test counts routines. `LOG_SCHEMA_VERSION` goes 19 → 20 and `SAVE_VERSION` 13 → 14.

Area abilities (the `at` form of the action, `AbilityEvent`, `spider_web`, `fire_spit`) are step 05, not this step.

## 2. Requirements and context

- **S2-R1** Strike routines, with retargeting when a target falls (campaign R8, §4.4, §5.4).
- **S2-R2 (recharge part)** Abilities recharge rather than cost mana.
- **S2-R5 (routine part)** The policy uses routines by expected harm.
- **S2-R7 (Troll part)** The Troll's two-claw action points become a routine.
- **Design tests (§6) for this step:**
  - `battleEngine.test.ts`: routine strikes and retargeting; recharge countdown and blocking; snapshot round-trip; schema version.
  - `policies.test.ts`: a routine preferred over a single strike; recharge respected.
- **Design §5:** data stays plain (abilities by id); `sameCombatStats` compares `abilities`; `foeAtLevel` adds its damage step to ability damage; `legalActions` lists abilities when AP and recharge allow.

### Corrections that apply here (from the index)

1. **The Troll's routine costs 8 AP, not 4.** The Troll has 8 AP and claws for 4 (`TROLL_STATS`): two claws standing still, one after a move. A 4-AP routine of two claws would give it four claws standing still (three with a recharge of 1), not "the same expected damage". The routine `troll_claws` (Claw, Claw) costs 8 AP with no recharge, and the Troll keeps its 4-AP claw for a turn it moves. Every turn's expected damage is today's, and the log shows "Claw, Claw" as one action when it stands and strikes.
5. **Abilities are data by id, so `foeAtLevel` cannot raise their dice.** `CombatantStats` gains `abilityDamageBonus` (default 0). `foeAtLevel` adds its damage step to it, and the engine adds it to every strike's (and, from step 05, area's) damage.
6. **`AreaShape` lives in `src/grid/hex.ts`** (step 02); `abilities.ts` re-exports it.
7. **A strike that is not made emits nothing** (reference §5.4, not §4.4's "logged as not made").
8. **Names left open:** `Ability` and `Strike` gain a `verb` for the log line.
10. **Recharge.** Using an ability with `recharge` N ≥ 1 sets its counter to N. The counter falls by 1 as the unit's side's turn begins, after status ticks and regeneration, and the ability is usable at 0. So recharge 1 is once a turn, recharge 2 every other turn. Recharge 0 limits nothing but AP.
11. **Numbers are first values** (the abilities' AP costs here); step 09 tunes them.
15. **Versions:** this step raises `LOG_SCHEMA_VERSION` 19 → 20 and `SAVE_VERSION` 13 → 14.
16. **The yardstick test counts routines** (contract below), so the Troll's numbers and exceptions are unchanged.

## 3. Dependencies and prerequisites

- **Step 03 must be done** (and through it step 02). This step builds on, unchanged:
  - **C1 (step 02):** `AreaShape` and `areaOf` in `src/grid/hex.ts`; `AreaSpec` and `areaTouches` in `battleEngine.ts`; `Spell.shape`.
  - **C2 (step 03):** `ELEMENTS`, `Element`, `CombatantStats.wards`, `warded(damage, element, stats)` in `src/combat/combat.ts`; `CastOutcome.warded`, `StatusTickEvent.warded`, `CastEvent.drained`; `LOG_SCHEMA_VERSION` is 19.
  - **C3 (step 03):** `SPELL_IDS` (heroes'), `MONSTER_SPELL_IDS`, `SpellId = HeroSpellId | MonsterSpellId`, `ALL_SPELL_IDS`; statuses `cursed` and `webbed`.
  - **C6 (step 03):** `aggressive`'s order is heal, guard, hostile area spell, Bless, Sleep, Curse, damaging spell of one foe, then `bestAttack`, then closing in; `strikeCast` ranks by warded mean damage.
- **Step 01's figures** (in the index and step 01's execution record): the guard and the Troll Lair cells at threats 4 and 5, which this step compares against.
- **Existing code** at `51cecb5` (read before changing): `src/combat/combat.ts` (`CombatantStats`, `sameCombatStats`, `foeAtLevel`, `TROLL_STATS`), `src/engine/battleEngine.ts` (`Action`, `UnitRecord`, `UnitSnapshot`, `snapshot()`, `legalActions`, `step`, `startTurn`, `attack`, `formatEvent`), `src/engine/policies.ts` (`bestAttack`, `expectedHarm`), `src/game/encounters.test.ts` (the yardstick test), `src/game/save.ts`.
- **Consumed later:** step 05 adds the `at` form of the action and the area entries of `ABILITY_IDS`; step 06 reads `recharging` on `UnitSnapshot` and the strike fields on `AttackEvent`; step 08 gives the Giant Spider `spider_bite`.

## 4. Contracts (copied from the index, C4 and C6)

### C4. Abilities, routines and recharge

```ts
// src/combat/abilities.ts (new in step 04)
export type { AreaShape } from '../grid/hex.ts'
export interface Strike {
  name: string
  /** As the log says it: "bites", "claws". */
  verb: string
  damage: DamageRoll
  /** Laid on a hit that leaves the target standing, as a spell's status is. */
  status?: StatusLaid
}
export interface AreaAttack {
  shape: AreaShape
  range: number
  radius?: number
  /** Left out for an area that only lays a status (Web). */
  damage?: DamageRoll
  element?: Element
  status?: StatusLaid
  /** A miss still deals half the dice, rounded down; no status is laid on a miss. */
  halfOnMiss: boolean
}
export interface Ability {
  name: string
  /** As the log says it: "claws", "spits fire", "spins a web". */
  verb: string
  description: string
  apCost: number
  /** Rounds before it can be used again: N ≥ 1 sets its counter to N (correction 10); 0 limits nothing but AP. */
  recharge: number
  /** A routine of weapon strikes at one foe within the unit's attackRange... (exactly one of strikes and area) */
  strikes?: readonly Strike[]
  /** ...or an area, rolled like a hostile spell with the unit's toHit, ignoring resistance. */
  area?: AreaAttack
}
export const ABILITY_IDS = ['troll_claws', 'spider_bite', 'spider_web', 'fire_spit'] as const  // step 04 adds the first two, step 05 the last two
export type AbilityId = (typeof ABILITY_IDS)[number]
export const ABILITIES: Record<AbilityId, Ability>
```

| Id | Name | Verb | AP | Recharge | Content | Step |
| --- | --- | --- | --- | --- | --- | --- |
| `troll_claws` | Claws | claws | 8 | 0 | strikes: Claw (verb "claws", 1d4+2), Claw (verb "claws", 1d4+2) | 04 |
| `spider_bite` | Bite | bites | 4 | 1 | strikes: Bite (verb "bites", 1d6+2), Venom Bite (verb "bites", 1d6+2, lays Poisoned 3 turns) | 04 |
| `spider_web` | Web | spins a web | 4 | 3 | area: burst, range 4, radius 1, no damage, lays Webbed 2 turns, `halfOnMiss: false` | 05 |
| `fire_spit` | Fire Spit | spits fire | 4 | 2 | area: cone, range 2, 3d6, fire, lays Seared 1 turn, `halfOnMiss: true` | 05 |

In this step `ABILITY_IDS` is `['troll_claws', 'spider_bite'] as const`; step 05 appends the other two. `AreaAttack` is declared now (the type is needed for `Ability`), though nothing uses it until step 05.

```ts
// src/combat/combat.ts — CombatantStats gains (step 04):
/** What the unit can do besides its weapon and spells, in ABILITY_IDS order; none when left out. */
abilities?: readonly AbilityId[]
/** Added to the damage bonus of every strike and area of its abilities (foeAtLevel's damage step); 0 when left out. */
abilityDamageBonus?: number
```

- `sameCombatStats` compares `abilities` (in order) and `abilityDamageBonus`.
- `foeAtLevel` sets `abilityDamageBonus` to `(base.abilityDamageBonus ?? 0) + floor(above / FOE_DAMAGE_LEVEL_STEP)` for a block with `abilities`, and leaves a block without them as today.
- `TROLL_STATS` gains `abilities: ['troll_claws']`; nothing else of it changes (correction 1).
- **The yardstick test** (`encounters.test.ts`): a kind's mean damage a turn is the better of the weapon's turn (today's formula) and the routine's turn: the sum of a routine's strikes' means (with `abilityDamageBonus`) times the uses a turn, `floor(actionPoints / apCost)`, at most 1 when `recharge` ≥ 1.

```ts
// src/engine/battleEngine.ts (step 04; the `at` form in step 05)
export type Action = /* existing members */
  | { type: 'ability'; unit: UnitId; ability: AbilityId; target: UnitId }  // a routine
  | { type: 'ability'; unit: UnitId; ability: AbilityId; at: Hex }         // an area
// UnitRecord and UnitSnapshot gain:
/** Rounds until each ability that is recharging can be used again; an ability absent here is ready. */
recharging: Partial<Record<AbilityId, number>>
// AttackEvent gains, on a routine's strikes only:
ability?: AbilityId
/** The strike's name. */
strike?: string
/** The status the strike laid, as it stands after; absent if none. */
status?: ActiveStatus
```

In this step only the `target` form of the action is added; step 05 adds the `at` form.

- **Legal:** the unit has the ability in `stats.abilities`, `ap ≥ apCost`, and it is not recharging. A routine's target is a standing foe within the unit's `attackRange`. `legalActions` lists abilities after a unit's casts, in its `abilities` order: a routine at each such foe in roster order; an area at each legal aim in board order.
- **On use:** AP paid, `gearChangePaid` cleared, the counter set if `recharge` ≥ 1.
- **Countdown:** in `startTurn(side)`, after the ticks and regeneration and only if the battle goes on, each of the side's standing units' counters fall by 1, an entry at 0 removed. A sleeper's counts down too.
- **A routine** makes its strikes in order, each a weapon attack as `attack` makes one (facing, the defender's turn, flanking, arc, helpless, mirror images, resistance and piercing), with the strike's damage plus `abilityDamageBonus` for the dice. The first strike's `apCost` is the ability's, the rest 0; `opportunity` is false. A strike's status is laid after its damage, on a hit that left the target standing.
- **Retargeting:** before a strike whose target has fallen, the strike goes to the nearest standing foe within `attackRange` (by `hexDistance`; ties to the lowest unit id by string order). With none, it and the rest are not made and emit nothing. A routine stops when the battle ends.
- **Log:** a strike's line names its verb: "Troll claws Aldric: rolls 23 (needs 55 or less) — HITS Aldric for 5 dmg (armour stops 1)." (the verb looked up from `ABILITIES[event.ability]` by the strike's name).
- `LOG_SCHEMA_VERSION` 19 → 20; `SAVE_VERSION` 13 → 14.

### C6. The policy (this step's part)

`aggressive`'s order becomes: heal, guard, hostile area spell, Bless, Sleep, Curse (03), damaging spell of one foe, **the best strike (04, 05)**, a status area (05), closing in.

- **Step 04:** `bestAttack` becomes the best strike: each legal plain attack scores today's `expectedHarm`; each legal routine the sum of `expectedHarm` over its strikes, each with its own dice plus `abilityDamageBonus`, against its target. The highest wins; a routine wins a tie. `reach` is unchanged.

## 5. Scope and implementation guidance

**Paths (inspected unless marked new):**
- `src/combat/abilities.ts` (new): the types, `ABILITY_IDS`, `ABILITIES` with `troll_claws` and `spider_bite`. It imports types only from `combat.ts`, `spells.ts` and `hex.ts`; `combat.ts` imports `type AbilityId` from it. A type-only cycle is safe under `verbatimModuleSyntax` with `import type`.
- `src/combat/combat.ts`: the two `CombatantStats` fields, `sameCombatStats`, `foeAtLevel`, `TROLL_STATS`.
- `src/engine/battleEngine.ts`: the action, `recharging` on `UnitRecord` (initialised `{}` in the constructor) and `UnitSnapshot` (copied in `snapshot()`, as `statuses` is), `legalActions`, `step`, a routine resolver, the countdown in `startTurn`, the `AttackEvent` fields, `formatEvent`, `LOG_SCHEMA_VERSION`.
  - **Reuse `attack`** for each strike rather than duplicating it: give it an optional strike (damage dice and bonus, ability id, strike name, status) so the RNG is drawn in the same order as a plain attack (`rollToHit`, then the dice only on a hit that did not strike an image). A plain attack and a free attack must stay byte-identical in their events and draws.
  - The strike's status is laid with the existing `layStatus` after the damage, only on a hit (not an image) that left the target standing; record it in `AttackEvent.status`. Order the follow-up events as `attack` does (images spent, wake, fall).
  - `AttackEvent.damageDice` for a strike is the dice actually rolled (the strike's, with the bonus).
  - `ability` actions name abilities by id; throw on an illegal one as `step` does for a cast.
  - `restore` takes `recharging` from the snapshot with the units, so a reloaded battle is still recharging (play-script item 4).
- `src/engine/policies.ts`: give `expectedHarm` a damage-roll parameter (defaulting to the unit's weapon), and replace `bestAttack` with the best strike over plain attacks and routines.
- `src/game/save.ts`: `SAVE_VERSION` 13 → 14 (the snapshot's units gain `recharging`).
- `src/game/encounters.test.ts`: the yardstick test's `meanDamage` per the contract. The Troll's routine turn (2 × 4.5 = 9, uses `floor(8 / 8) = 1`) equals its weapon turn, so its exceptions stay as they are.
- **Callers of `Action` and `BattleEvent`** may need a case for the new members to typecheck (for example `BattleScene` replaying the enemy's actions, `eventSchedule.ts`, `sounds.ts`, `scripts/simulate.ts`). Add only what compiles and keeps behaviour: a routine's events are `AttackEvent`s, which the scene and the tally already handle. The scene's playback polish is step 06.
- **CLAUDE.md:** update the lines this change makes wrong: the `combat/` bullet (abilities by id, `abilityDamageBonus`), the battle engine bullet (the `ability` action, `recharging` in snapshots), the policies bullet (the best strike), the rules of the battle system (the Troll's claws as a routine), and the yardstick test's damage note in the rules of scaling. Step 09 makes the full pass.

**Invariants:** heroes have no abilities, so the player's `legalActions`, a hero's attacks and every non-Troll battle draw exactly as before. Free attacks stay plain weapon attacks. An ability provokes nothing.

**Out of scope:** area abilities, `AbilityEvent` and `CastOutcome.half` (step 05); the spider's stat block (step 08); scene playback and the foe info panel (step 06).

## 6. Verification

**Tests, written first** (`npx vitest run --project domain` locally for quick runs; `make test` as the gate):
- `abilities.test.ts` (new) or `combat.test.ts`: every ability has exactly one of `strikes` and `area`; `sameCombatStats` tells blocks apart by `abilities` and by `abilityDamageBonus`; `foeAtLevel(TROLL_STATS, 4)` has `abilityDamageBonus` 1 and a block without abilities has none.
- `battleEngine.test.ts` (with a scripted or seeded RNG):
  - a routine makes one `AttackEvent` per strike, with `ability`, `strike`, the first carrying the AP cost and the rest 0, and each strike's dice plus the bonus;
  - the Venom Bite lays Poisoned on a hit that leaves the target standing, recorded in `status`, and not on a miss;
  - retargeting: the first strike fells its target, the second goes to the nearest other foe in reach (lowest id on a tie); with none in reach, no further event;
  - a routine that ends the battle stops there;
  - the defender's turn: a routine's first melee strike on a side may turn the defender, the second finds it turned (`turnReady` spent once);
  - recharge: `spider_bite` (recharge 1) is not listed again the same turn, counts down as its side's turn begins (after ticks and regeneration), and is listed again; a sleeping unit's counter counts down; `troll_claws` (recharge 0) is listed while AP allow;
  - `legalActions` lists a routine at each foe in reach, after casts, and not with too few AP;
  - a snapshot round-trip keeps `recharging`, and the restored engine plays on identically;
  - `LOG_SCHEMA_VERSION` is 20; the log line names the verb ("Troll claws …").
- `policies.test.ts`: a routine is chosen over a single strike when its summed harm is higher (and on a tie); a recharging routine is not chosen (only plain attacks); a Troll that has moved claws once with its 4-AP weapon.
- `encounters.test.ts`: the yardstick test passes with today's exception list unchanged.
- `save.test.ts`: `SAVE_VERSION` 14 where it is pinned.

**Simulator** (podman only, one `make simulate` at a time; `logs/` gitignored):
1. `make -s simulate ARGS="--encounter troll_lair --threat 4 --party-level 4 --battles 500 --seed 1"` and the same at `--threat 5 --party-level 5`. Compare with step 01's cells: the wins should be within noise (about ±3 percentage points at 500 battles). The rolls of a routine follow a different path than two attacks chosen one by one, so an exact match is not expected. A larger move must be explained in the execution record, and looked into before committing.
2. `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`: record the Source beaten of 500, days, battles, heroes dead and the per-threat table, and the difference from step 01's baseline. Step 09 judges the stage's total; note any move of more than about 5 points here.

## 7. Completion criteria

- [ ] `src/combat/abilities.ts` with `troll_claws` and `spider_bite`; `CombatantStats.abilities` and `abilityDamageBonus`; `sameCombatStats` and `foeAtLevel` as contracted; the Troll has its routine.
- [ ] The `ability` action (routine form), retargeting, `recharging` on records, snapshots and saves, the countdown, the `AttackEvent` fields and the log line.
- [ ] The policy's best strike.
- [ ] The yardstick test counts routines; exceptions unchanged.
- [ ] `LOG_SCHEMA_VERSION` 20, `SAVE_VERSION` 14.
- [ ] The tests above written and passing; `make test` passes.
- [ ] Troll Lair cells at threats 4 and 5 within noise of step 01's; the guard measured; both recorded below.
- [ ] CLAUDE.md lines this change makes wrong updated.
- [ ] Committed once tests pass, on the current branch, without pushing; the message ends with the repo's `Co-Authored-By` attribution line.
- [ ] The index's step 04 row set to `done` with the commit.

## Execution record

**Status:** done (commit: see the index row; the orchestrator fills in the hash).

**What was built**
- `src/combat/abilities.ts` (new): `Strike`, `AreaAttack`, `Ability`, the `AreaShape` re-export, `ABILITY_IDS = ['troll_claws', 'spider_bite']`, `ABILITIES` per the C4 table. Type-only imports from `combat.ts`, `spells.ts` and `hex.ts`.
- `combat.ts`: `CombatantStats.abilities` and `abilityDamageBonus`; `sameCombatStats` compares both (missing abilities as `[]`, missing bonus as 0); `foeAtLevel` sets `abilityDamageBonus` for a block with abilities only; `TROLL_STATS.abilities = ['troll_claws']`.
- `battleEngine.ts`: the `ability` action (routine form); `recharging` on `UnitRecord` (set to `{}` when the battle starts) and `UnitSnapshot` (copied in `snapshot()`), so it is kept in snapshots and `restore`; `canUse` / `canStrike`; `legalActions` lists routines after casts; `step` throws "X cannot use A on T" for an illegal one; `routine()` pays AP, clears `gearChangePaid`, sets the counter, and makes each strike through `attack()` with an optional strike argument (dice, ability, strike), retargeting with `nearestFoeInReach` and stopping once the battle is over; the strike's status is laid on a hit (not on a mirror image) that leaves the target standing; the countdown runs at the end of `startTurn`, after ticks and regeneration, and only if the battle goes on, for standing units, sleepers included; `AttackEvent.ability`, `strike` and `status` (these keys are absent on plain and free attacks, so those events are byte-identical); `formatEvent` names the strike's verb ("Troll claws Warrior: rolls 34 (needs 40 or less) — HITS Warrior for 5 dmg.") and appends a status laid (", poisoned"); `LOG_SCHEMA_VERSION` 20.
- `policies.ts`: `expectedHarm` takes optional dice; `bestAttack` is now `bestStrike` (plain attacks and routines, a routine summing its strikes with `abilityDamageBonus`, a routine winning a tie with a plain attack, the first routine winning a tie among routines).
- `save.ts`: `SAVE_VERSION` 14.
- `encounters.test.ts`: the yardstick's `meanDamage` is the better of the weapon's turn and each routine's turn; the exceptions are unchanged.
- CLAUDE.md: the `combat/` bullet (abilities, `abilityDamageBonus`, the yardstick's routine turn), the engine bullet (the `ability` action, retargeting, `recharging`), the policies bullet (the best strike), and the Troll in the rules of scaling (its claws as an 8 AP routine standing still, one 4 AP claw after a move).

**Tests added**: `abilities.test.ts` (each ability has exactly one of strikes and area; the two tables; the Troll's block; `sameCombatStats` on abilities and on the bonus; `foeAtLevel`'s bonus); `battleEngine.test.ts` "strike routines and recharge" (one event per strike with AP 8 then 0; the bonus on the dice; plain attacks without strike fields; the verb in the log line; the Venom Bite's poison recorded, and none laid on a miss or a felling bite; retargeting to the lowest id on a tie, and to the nearest over a lower id for a ranged routine; no further event with none in reach; stopping when the battle ends; the defender turns once; legal listing after casts and refusals; recharge 0 keeps the routine listed; `spider_bite` blocked, then ready again as its side's turn begins; the countdown with regeneration; a sleeper's countdown; snapshot round-trip through JSON then identical play-out; schema 20); `policies.test.ts` (claws over one claw; one weapon claw after a move; routine on a tie, weapon when higher; the bonus counted; the weapon while recharging); `encounters.test.ts` (routine-turn arithmetic); `save.test.ts` (`SAVE_VERSION` 14). Changed on purpose: the schema assertions 19 → 20, and `foeAtLevel(TROLL_STATS, native)` now equals the block plus `abilityDamageBonus: 0`.

**Checks run**
- `npm run -s typecheck`: clean. `npx vitest run --project domain`: 908 passed.
- `make test`: 70 files, 917 tests passed.
- `make -s simulate ARGS="--encounter troll_lair --threat 4 --party-level 4 --battles 500 --seed 1"`: **222 of 500** (baseline 218, +0.8 points, within noise); 15.62 rounds (15.482); enemy damage 102.31 (103.3); enemy hit rate 0.6752 (0.6776).
- Same at `--threat 5 --party-level 5`: **0 of 500** (baseline 0); 7.548 rounds (7.48); enemy damage 146.73 (147.002). A weak check: the cell was already 0.
- `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`: **Source beaten 242 of 500** (48.4%; baseline 243, −1). Party fell 258, encampment lost 0, out of days 0. A campaign: 280 days, 18.9 battles, 1.8 heroes dead (baseline 281, 19.0, 1.8). Per threat, won/battles: 1: 1009/1009; 2: 1777/1795; 3: 2021/2075 (0.974); 4: 3041/3064 (0.992; was 3053/3076); 5: 1358/1521 (0.893; was 1361/1523). The Troll changes draws only in battles it fights, so the small drift is expected and well inside 5 points.
- `make test-browser` not run: no scene code changed.

**Deviations and notes for later steps**
- No contract changed. Settled within it: a strike's status is laid before the wake check, so the `AttackEvent` carries it; a missing `abilities` compares equal to `[]`; the log appends a laid status as ", poisoned" (the contract shows only the hit line).
- Step 05: `Action` has only the `target` form; `canUse` is shared, and `canStrike` rejects an ability without strikes, so an area ability needs its own aim check and resolver. `strikeVerb` assumes `event.ability` is a routine.
- Step 06: a routine's strikes are ordinary `AttackEvent`s, so the scene already plays them; `UnitSnapshot.recharging` is ready for `foeInfoLines`.
