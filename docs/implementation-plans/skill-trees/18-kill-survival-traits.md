# Step 18: Kill and survival traits

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R8; §5.4 rows Deathblow, Blademaster, Unbreakable; §4.7 edge cases; AC6) · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step routes every application of damage in the engine through one function, a refactor touching attacks, strikes, casts, areas, status ticks and on-hit damage, which must change nothing for any unit without the new traits; then three rules that end or spare a life sit on top of it. A slip in the order of damage, felling and events breaks replays and the refactor guard.

## 1. Objective

- Every damage application in `src/engine/battleEngine.ts` goes through a new private `applyDamage(unit, n)`. With no unit holding the new traits, play, events and RNG draws are exactly as before (the refactor guard stays green unchanged).
- **Unbreakable** (trait `unbreakable`): the first time each battle that damage would bring the unit to 0, it is left at 1 hit point and Shielded for 2 turns.
- **Deathblow** (trait `deathblow`): a weapon hit that leaves a non-`blightborn` foe at a quarter of its maximum hit points or less fells it.
- **Blademaster** (trait `blademaster`): once a turn, a weapon blow or technique of its own (not a free attack) that fells a foe gives back that action's AP.

No node teaches these traits yet: step 21 adds `unbreakable`, `deathblow` and `blademaster` to `PERKS`. Tests give units the traits directly in their `CombatantStats`.

## 2. Requirements and context

- **R8:** the other new mechanics work in the engine as design §5.4 states, and battles stay deterministic from their seed.
- **AC6 (R8):** each mechanic of section 5.4 has an engine test, and the replay tests still pass.
- Design §5.4 rows (restated):

| Mechanic | Rule |
| --- | --- |
| **Deathblow** | After a weapon hit's damage, if the defender stands, is not `blightborn`, and hp ≤ ⌊maxHp / 4⌋: hp → 0 (`AttackEvent.deathblow: true`), then `fell`. |
| **Blademaster** | When a unit with trait `blademaster` fells a foe with its own attack action or technique (not a free attack) and `refunded` is false: it regains that action's AP and sets `refunded` (`AttackEvent.apRefunded`). |
| **Unbreakable** | Every damage application (attack, strike, cast outcome, area, status tick) goes through a new `applyDamage(unit, n)`. If the unit has trait `unbreakable`, `endured` is false, hp > 0 and hp − n ≤ 0, then hp → 1, `endured` → true, and `shielded` is laid for 2 turns. The event carries `endured: true`. |

- Design §4.7 edge cases (restated):
  - Unbreakable applies to status ticks as well as blows and spells.
  - Deathblow fells the unit outright and is not "damage", so Unbreakable does not save it from Deathblow.
  - A `blightborn` foe (the Blight Horror) is immune to Deathblow.
  - Blademaster refunds once a turn (`refunded`, false again as its side's turn begins) and never on a free attack (opportunity or counter).
- `UnitRecord` fields (design §5.4): `endured` (Unbreakable spent), `refunded` (Blademaster this turn; false as its side's turn begins). Step 17 added both, with `attackedYet`, `fallenThisBattle` and `usedOnce`, and their restore defaults.
- `formatEvent` short line: "Mira endures the blow." (design §5.4).

### Decisions from the index (unchanged)

- **2. The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
- **8. `LOG_SCHEMA_VERSION`** 25 from step 09 (the first stage-2 step to change an event); steps 10 and 11 change shapes under 25. 26 from step 17; steps 18 to 20 under 26.
- **7. Saves.** `SAVE_VERSION` 23 in stage 1 (step 03 raises it; step 05 adds `migrateFrom22`), 24 in stage 2 (step 11), 25 in stage 3 (step 17). Versions 23 and 24 load into the current version with no game migration: `BattleEngine.restore` fills the new `UnitRecord` fields with their defaults. Version 18 goes through `migrateFrom18` then `migrateFrom22`. Between steps 03 and 05, version-22 saves read as unreadable, and so does the version-18 fixture (its migration yields version 22's shape): step 03 changes that test to expect unreadable, and step 05 restores it.

This step therefore raises neither version: the event fields it fills (`endured`, `deathblow`, `apRefunded`) were declared under 26 by step 17, or are added here under 26.

### Contracts (copied unchanged from the index)

**C13. Stage-3 engine (steps 17–20; consumed by 21–23):**

```ts
// CombatantStats gains (only when non-zero): opportunity?: { toHit: number; damage: number }; rear?: { toHit: number; damage: number };
//   movedToHit?: number; execute?: number; critDamage?: number; manaOnHit?: number; manaRegen?: number
// UnitRecord, UnitSnapshot gain attackedYet: boolean, endured: boolean, refunded: boolean,
//   fallenThisBattle: boolean, usedOnce: SpellId[]   (step 17 adds all five; restore defaults false / [])
// AttackEvent gains counter?: true, ambush?: true, deathblow?: true, apRefunded?: number, manaRestored?: number, endured?: true
// CastOutcome gains revived?: true, endured?: true; StatusTickEvent gains endured?: true
export interface RestoreEvent extends EventBase { type: 'restore'; unit: UnitId; hp?: number; mana?: number; cause: 'renewing' | 'sanctuary' | 'serenity'; source?: UnitId }
  // source: the Sanctuary unit whose aura healed (for "Sera's sanctuary restores 3 to Aldric.")
export interface AuraBonus { ac: number; toHit: number; resistance: number; wardAll: number }
export function auraBonus(units: readonly UnitSnapshot[], unit: UnitSnapshot): AuraBonus
  // best of each aura kind from standing allies in radius: guardian (+5 AC, radius 1, not itself), courage (+5 to hit, 2, not itself),
  // aegis (+2 resistance, +2 wardAll, 2, itself included); two of a kind do not stack
export function statsIn(units: readonly UnitSnapshot[], unit: UnitSnapshot): CombatantStats
  // effectiveStats plus auraBonus; the engine reads the same through its records, and every roll, preview and the policy use it
// LOG_SCHEMA_VERSION = 26 and SAVE_VERSION = 25 (step 17); version 24 loads as is
// Spell gains (step 20): bane?: true; bonusVs?: { statuses: StatusId[]; damage: DamageRoll }; cleanse?: true;
//   oncePerBattle?: true; SpellTarget gains 'fallen'
```

Rules: design §5.4's table, one row per mechanic.

**C12 (step 11, consumed here):** `TRAIT_IDS` (in `src/combat/combat.ts`) already holds `'deathblow'`, `'blademaster'` and `'unbreakable'`; `CombatantStats.traits?: readonly TraitId[]` (TRAIT_IDS order; only when non-empty).

```ts
export const TRAIT_IDS = ['rooted', 'tumble', 'counter', 'ambush', 'deathblow', 'blademaster', 'deadeye',
  'unbreakable', 'shadowdancer', 'guardian', 'courage', 'aegis', 'sanctuary', 'arcane_knight'] as const
export type TraitId = (typeof TRAIT_IDS)[number]
```

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets.
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npx vitest run --project domain`; `npm run test:browser` after any scene change.
- **The simulator.** No measurement in this step. If you run it at all, run one at a time, each with its own `--out` under `logs/`.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) must stay green **unchanged** (decision 2). Do not edit its fixture.
- **Determinism.** A battle replays from its seed. None of the three rules rolls anything; they draw nothing from the RNG. `applyDamage` must not change the order of any draw or event.
- **Domain first.** Every rule lives in the engine with tests; scenes decide nothing.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit for this step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 18: kill and survival traits". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: add the three rules to the battle system's rules (a sentence each, with `applyDamage` named as the one way damage reaches a unit), and search it for any name you rename.

## 3. Dependencies and prerequisites

- **Step 17 (done first)** provides: `LOG_SCHEMA_VERSION` 26 and `SAVE_VERSION` 25; `UnitRecord`/`UnitSnapshot` fields `attackedYet`, `endured`, `refunded`, `fallenThisBattle`, `usedOnce` with restore defaults; the event fields of C13 declared (if any of `deathblow`, `apRefunded`, `endured` on `AttackEvent`, or `endured` on `CastOutcome`/`StatusTickEvent`, is not yet declared, declare it here under 26 as C13 gives it). Step 17 also added the attack traits (Iron Skin's free attacks, Counter's `AttackEvent.counter`, Ambush, Executioner, Fortune's `critDamage`, Deadeye, Battle Mage's mana on hit, Arcane Knight); a counter is a free attack.
- **Step 11** provides `TRAIT_IDS` and `CombatantStats.traits`; the `shielded` status exists today (+15 AC).
- **Step 09/10** provide technique strikes (`attack()` with an `ability` and `strike`), routines and areas for heroes; a technique is an action of its own with its AP cost (`abilityApCost`).
- **Existing code, for reference** (`src/engine/battleEngine.ts`): hit points are lowered in several places today: the weapon hit in `attack()` (dice plus each on-hit `bonus[].damage`), routine strikes, `strikeUnit` for casts and areas (shared by `cast` and the area ability path), status ticks in `startTurn`, and a drain's or heal's opposite. `fell(target)` emits `unit_down` and checks the winner (`fellAll`, `checkWinner`). Sleep wakes on damage (`status_end` reason `woke`); a mirrored unit's hit strikes an image and deals no damage.

## 4. Scope and implementation guidance

### 4.1 `applyDamage` (refactor first, its own green checkpoint)

- Add `private applyDamage(unit: UnitRecord, n: number): { dealt: number; endured: boolean }` (shape is the engineer's choice; it must report whether Unbreakable fired). It subtracts `n` from `hp` (never below 0) and nothing else for a unit without `unbreakable`.
- Route every place that lowers a unit's hit points through it: a weapon hit (dice and every on-hit bonus, applied as one total, as today's arithmetic does), each strike of a routine or technique, each outcome of a cast or an area (hostile spells, area abilities, Volley, Consecrate), and status ticks. A drain's heal and any healing stay as they are.
- Keep the order of everything around it: wake-on-damage, `unit_down`, the winner check, the events' fields. Do this first and run the whole suite and the guard before adding any rule: it must be a pure refactor.

### 4.2 Unbreakable

- In `applyDamage`: if the unit's `stats.traits` includes `unbreakable`, `endured` is false, `hp > 0` and `hp − n ≤ 0`, then `hp = 1`, `endured = true`, and `shielded` is laid for 2 turns (as a spell lays a status: the longer duration kept if already shielded; laid on its own side's turn it counts the turn under way, per the existing status rule). The unit does not fall.
- The event that dealt the damage carries `endured: true`: `AttackEvent.endured`, `CastOutcome.endured`, `StatusTickEvent.endured`. Use these fields rather than a new event; the `shielded` status shows through the existing nameplate marks.
- Once per battle: `endured` stays true (restored from a snapshot as saved).
- On-hit statuses and a strike's status are laid after damage only "if it still stands": an endured unit stands at 1, so they are laid as on any survivor.
- `formatEvent`: when an event has `endured`, add the line "<Name> endures the blow." (for a tick too).

### 4.3 Deathblow

- After a weapon hit's damage is applied (a plain attack, a free attack, a counter, or a technique strike: every `AttackEvent` that hit and struck no image), if the attacker's traits include `deathblow`, the defender stands (hp > 0), its stats are not `blightborn`, and `hp ≤ ⌊maxHp / 4⌋`: set `hp = 0` directly (not through `applyDamage`, so Unbreakable does not save it), mark `AttackEvent.deathblow: true`, then `fell` as for any fall.
- Spells, areas and ticks never deathblow. Order: on-hit damage and heal first, then the deathblow check, before any on-hit status (a felled unit gets none).
- `formatEvent` may add a short clause ("— a deathblow"); keep the line simple.

### 4.4 Blademaster

- When a unit whose traits include `blademaster` fells a foe with its own attack action or technique on its side's turn (not an opportunity attack, not a counter) and its `refunded` is false: it regains that action's AP (the `apCost` the action paid: `attackApCost` for an attack, `abilityApCost` for a technique), `refunded = true`, and the felling `AttackEvent` records `apRefunded` (the points regained). `apAfter` stays as paid; the next event shows the restored AP.
- A routine or Cleave that fells with its first strike refunds once; later strikes of the same action do not refund again.
- `refunded` becomes false as its side's turn begins (in `startTurn`, alongside the other per-turn resets).

### 4.5 Exclusions

- No node, plan or policy change (step 21), no scene look beyond `formatEvent` (step 22), no simulator summary lines (step 23).

## 5. Verification

### Tests (in `npm test`)

In `src/engine/battleEngine.test.ts`, with a scripted RNG:

- **applyDamage refactor:** the existing suite passes unchanged, the replay and snapshot round-trip tests included.
- **Unbreakable:** a blow that would take a unit with `unbreakable` to 0 leaves it at 1, Shielded for 2 turns, the `AttackEvent` with `endured: true`; a second lethal blow in the same battle fells it. A lethal spell outcome sets `CastOutcome.endured`; a lethal poison tick sets `StatusTickEvent.endured` and the unit stands. A unit at 0 is not raised. A unit without the trait falls as before.
- **Deathblow:** a hit leaving a foe at ⌊maxHp/4⌋ fells it with `deathblow: true` and a `unit_down`; at ⌊maxHp/4⌋ + 1 it stands. A `blightborn` foe is not felled. A foe with `unbreakable` is felled by a deathblow (not saved). A spell taking a foe below a quarter does not deathblow. The RNG draws the same number of values with and without the trait.
- **Blademaster:** a felling attack refunds its AP (`apRefunded`), and the unit can attack again; a second fell in the same turn refunds nothing; next turn it refunds again; a free attack (and a counter) that fells refunds nothing; a technique that fells refunds `abilityApCost`.
- **Snapshot:** a battle with `endured` and `refunded` set round-trips through `snapshot()` and `BattleEngine.restore` and plays on identically.
- **formatEvent:** "Mira endures the blow." for an endured hit.

### Commands

```sh
export PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH
npx vitest run src/engine/battleEngine.test.ts
npx vitest run scripts/simulate.test.ts -t "refactor guard"   # green, fixture unchanged
npm test
```

No scene changes: `npm run test:browser` is not required (run it if `formatEvent`'s change touches a scene's text checks).

### Acceptance

- AC6 rows for Deathblow, Blademaster and Unbreakable each have an engine test; the replay tests pass.
- The refactor guard is green with its fixture unchanged.

## 6. Completion criteria

- [x] Every damage application goes through `applyDamage`; the suite and the guard pass with no rule added (recorded as a checkpoint in the execution record).
- [x] Unbreakable, Deathblow and Blademaster work as in §4, with the tests of §5.
- [x] `LOG_SCHEMA_VERSION` stays 26 and `SAVE_VERSION` 25; no fixture edited.
- [x] `CLAUDE.md` states the three rules and `applyDamage`.
- [x] `npm test` passes; one commit "Skill trees step 18: kill and survival traits".
- [x] The index's step table shows step 18 `done (<commit>)`.

## 7. Execution record

**Engineer, 2026-11-14.**

- **Refactor checkpoint (no rule).** Added `applyDamage(unit, n)` (returns whether Unbreakable fired) and routed the three places that lowered hit points through it: the weapon hit in `attack()` (dice plus on-hit bonus as one total; routine and technique strikes go through `attack()`), `strikeUnit` (every cast and area outcome, Volley and Consecrate included) and the status ticks in `startTurn`. No other line lowers `hp` (the equip clamp at the maximum is not damage). Then `npx vitest run src/engine scripts/simulate.test.ts`: 507 passed, the refactor guard green with its fixture unchanged.
- **Rules.** Unbreakable in `applyDamage` (`UNBREAKABLE_SHIELD`, shielded 2 turns through `layStatus`, the longer duration kept); `endured` declared on `CastOutcome` and `StatusTickEvent` (step 17 had declared only the `AttackEvent` fields). Deathblow through the exported `deathblows(attacker, defender, hp)` after the on-hit damage and heal, before the strike's and on-hit statuses (a felled unit gets none). Blademaster refunds after the event is recorded (`apAfter` as paid); `refunded` reset in `startTurn` for the side whose turn begins. `formatEvent`: "<Name> endures the blow." on an attack, a tick, and after a cast's or an area's line for each endured outcome; " A deathblow!" on a deathblow's line.
- **Tests** (`src/engine/battleEngine.test.ts`, `describe('BattleEngine kill and survival traits')`, 18 tests): every case of §5, plus Shielded kept longer when already shielded, a venom strike that deathblows lays no poison, a routine whose second strike fells refunds the routine's AP, and draw counts for each trait. Carried forward from step 17's review: draw-count asserts added for Skirmisher, Executioner and Fortune.
- **Commands.** `npx vitest run src/engine/battleEngine.test.ts -t "kill and survival"`: 11 failed before the rules (the other 7 hold by construction: no trait, no deathblow by a spell, equal draws), 18 passed after. `npm test`: 86 files, 1887 tests passed. `npx vitest run scripts/simulate.test.ts -t "refactor guard"`: passed, fixture unchanged. `npm run test:browser` not run: no scene changed, and `formatEvent` only adds text when the new fields are set, which no simulated or scene unit sets yet.
- **Versions.** `LOG_SCHEMA_VERSION` 26 and `SAVE_VERSION` 25 unchanged; no fixture edited.
- **Deviations and decisions.**
  - Blademaster refunds only for an action that makes `AttackEvent`s (an attack, a strike technique or routine), as §4.4 says the felling `AttackEvent` records it; an area technique (Volley, Consecrate) that fells refunds nothing. If the design meant areas too, a field on `AbilityEvent` would be needed (a schema change under 26).
  - A routine's later strike that fells refunds the whole routine's AP (the action's cost), not 0: `attack()` takes `actionApCost` with a routine's strikes.
  - "A unit at 0 is not raised" is guarded in `applyDamage` (`hp > 0`); no engine path damages a fallen unit, so its test only checks a fallen Unbreakable unit stays at 0 through a round.
- **For later steps.** Step 21: give the nodes `trait: 'unbreakable' | 'deathblow' | 'blademaster'`; the policy does not yet weigh Deathblow in expected harm (a hit leaving a foe at a quarter fells it). Step 22: the looks of `endured`, `deathblow` and `apRefunded` (the log lines exist). Step 23: the summary lines read `AttackEvent.deathblow` and `endured` on the three event kinds.

**Review round 1, 2026-11-14.** Found 2, fixed 2, disputed 0.

1. *One hit that triggers both Unbreakable and Deathblow* (fixed; orchestrator's decision): Deathblow is now judged in `attack()` before `applyDamage`, on the hit points the hit and its on-hit damage leave without Unbreakable (`left`). It applies where `left > 0`, or where the hit is lethal by itself and Unbreakable would have kept the unit standing (`wouldEndure`, the same predicate `applyDamage` uses). A unit felled this way does not endure: its `endured` is not spent, no Shielded is laid, the event has no `endured`, and it falls with `deathblow: true`. A lethal hit on a foe without Unbreakable carries no `deathblow`; a blightborn Unbreakable foe still endures. Tests: "fells an Unbreakable foe, which does not endure" (the 7-left case and the lethal-alone case; it failed on `endured` before the fix), "marks no deathblow on a hit that fells a foe without Unbreakable by itself" and "lets a blightborn Unbreakable foe endure a lethal blow". CLAUDE.md's Deathblow sentence is restated.
2. *Snapshot test* (fixed): it now reaches `refunded` and `endured` through play (seed 1: both blows hit; the test asserts `apRefunded` and `endured` on the events), restores the snapshot, checks that the snapshots are equal and the flags are set, then plays the original and the restored engine on with the aggressive policy and compares the logs (to `battle_end`). It passed as soon as it was written, as expected for a test-only change.

Commands: `npx vitest run src/engine/battleEngine.test.ts -t "kill and survival"`: 1 failed before the fix, 20 passed after. `npm test`: 1889 passed. The refactor guard passed with its fixture unchanged.
