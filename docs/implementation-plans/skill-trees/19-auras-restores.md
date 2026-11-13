# Step 19: Auras and turn-start restores

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R8; §5.4 rows "Auras", "Sanctuary / Renewing / Serenity", "Shadowdancer"; §5.2 statuses; AC6) · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step threads aura bonuses through every roll and damage resolution of the engine, its previews and the policy's view, and adds work at the start of a side's turn whose order is fixed; a slip changes what monsters roll or breaks a replay, which the refactor guard catches only partly.

## 1. Objective

The engine learns the passives that act through position or the turn's start:

- **Auras** (Guardian, Aura of Courage, Aegis): a unit gains the best bonus of each aura kind from standing allies in radius, at every roll and damage resolution, in previews and in what the policy reads.
- **Turn-start restores:** Renewing (a status's regen), Sanctuary (an aura of healing) and Serenity (mana regained), each logged as a new `RestoreEvent`.
- **Shadowdancer:** a mirror image laid as its side's turn begins, logged as a `StatusLaidEvent` with cause `shadowdancer`.

No hero carries these traits until step 21 adds the nodes, so the refactor guard stays green unchanged. Every rule is proven by engine tests on stats built by hand.

## 2. Requirements and context

- **R8:** the other new mechanics work in the engine as design §5.4 states, and battles stay deterministic from their seed.
- **AC6 (this step's share):** each mechanic below has an engine test, and the replay tests still pass.
- **Quality constraint:** a unit whose stats carry none of the new fields behaves exactly as today. A passive that rolls nothing draws nothing from the RNG: none of this step's rules draws.

### Design §5.4 rows, restated

| Mechanic | Rule |
| --- | --- |
| **Auras** (Guardian, Aura of Courage, Aegis) | A pure `auraBonus(units, unit)`: for each aura kind, the best one from any standing ally whose distance is within its radius. Guardian: +5 AC to allies within 1, not itself. Aura of Courage (trait `courage`): +5 to hit to allies within 2, not itself. Aegis: +2 resistance and +2 ward against every element to allies within 2, itself included. Two auras of one kind do not stack (two Guardians give +5, not +10). Added to `effectiveStats` wherever a roll or damage is resolved, through `statsIn(units, unit)`, which previews and the policy also use. |
| **Sanctuary / Renewing / Serenity** | As side S's turn begins, after the status ticks and regeneration: units of S with `renewing` heal its `regen` (3), unless a status with `stopsRegeneration` is on them; every unit of S within 2 hexes of a standing Sanctuary unit of S (itself included) heals 3, one Sanctuary at most per unit; units of S with `manaRegen` regain that much mana, never above their maximum. Each is logged by a `RestoreEvent { unit, hp?, mana?, cause }`. |
| **Shadowdancer** | As its side's turn begins, a unit with trait `shadowdancer` whose `mirrored` images are below 1 gets `mirrored` laid for 2 turns with 1 image (`StatusLaidEvent`, cause `shadowdancer`). |

**Order at the start of side S's turn** (existing `startTurn`): status ticks, then regeneration, then (new, in this order) Renewing, Sanctuary, Serenity, Shadowdancer, each pass over S's standing units in roster order; then the ability recharge count-down and AP refill as today. Heals cap at maximum hit points; a restore of 0 (already full, or already at maximum mana) logs nothing. A unit felled by a tick this turn is not standing and gets nothing. A battle that a tick ended returns before these passes, as today.

`formatEvent` lines: Sanctuary "Sera's sanctuary restores 3 to Aldric." (the source's name: the Sanctuary unit; for one healing itself "Sera's sanctuary restores 3 to Sera."); Renewing "Aldric is renewed (+3)."; Serenity "Sera regains 2 mana."; Shadowdancer's `status_laid` "A mirror image appears beside Brenna." Keep the lines short; the detail is in the event.

### Decisions from the index (unchanged)

- **2. The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
- **7. Saves.** `SAVE_VERSION` 23 in stage 1 (step 03 raises it; step 05 adds `migrateFrom22`), 24 in stage 2 (step 11), 25 in stage 3 (step 17). Versions 23 and 24 load into the current version with no game migration: `BattleEngine.restore` fills the new `UnitRecord` fields with their defaults. Version 18 goes through `migrateFrom18` then `migrateFrom22`. Between steps 03 and 05, version-22 saves read as unreadable, and so does the version-18 fixture (its migration yields version 22's shape): step 03 changes that test to expect unreadable, and step 05 restores it.
- **8. `LOG_SCHEMA_VERSION`** 25 from step 09 (the first stage-2 step to change an event); steps 10 and 11 change shapes under 25. 26 from step 17; steps 18 to 20 under 26.

### `renewing` arrives here (per C6)

This step adds the `renewing` status and `StatusRule.regen`, so that the Renewing pass and its `RestoreEvent` cause `'renewing'` are built and tested where the restore machinery is. Step 20 then only adds the Renew spell that lays it. Nothing lays `renewing` in play yet; tests lay it by hand.

### Contracts (copied unchanged from the index)

**C6. Spells and statuses (step 02; extended by 09, 11, 20):**

```ts
// src/combat/spells.ts
// SPELL_IDS gains (step 02): 'frostbite', 'meteor', 'mass_haste', 'lay_on_hands', 'ward', 'web', 'curse'
//   (web and curse leave MONSTER_SPELL_IDS, same ids and numbers); step 20 adds 'ice_lance', 'glacial_prison',
//   'purify', 'revive', 'renew', 'holy_light'
// STATUS_IDS gains 'warded' (02); 'marked', 'slowed', 'pinned' (09; pinned's rule in 11); 'taunted' (10, its rule in 11);
//   'rooted' (11); 'renewing' (19); 'frozen' (20)
// StatusRule gains wardAll?: number (02); immobile?: true (11); regen?: number (19); hostile?: true,
//   helpless?: true, wakesOnDamage?: true replacing sleep (20)
// ActiveStatus gains source?: UnitId (11)
```

| Status | Mark | Rule | Step |
| --- | --- | --- | --- |
| warded | G | wardAll 4 | 02 |
| marked | Y | armour class −10 | 09 |
| slowed | L | action points −3 | 09 |
| taunted | T | −`TAUNT_PENALTY` (25) to hit at any unit but its `source` | 10 (the id, no effect), 11 (the rule) |
| pinned | N | immobile | 09 (the id, no effect), 11 (the rule) |
| rooted | R | armour class +10, resistance +2 | 11 |
| frozen | I | helpless, does not wake on damage | 20 |
| renewing | U | regen 3 | 19 |


**C12. Taunt, Rooted and Pin (step 11), the parts this step uses:**

```ts
// src/engine/battleEngine.ts
export interface StatusLaidEvent extends EventBase { type: 'status_laid'; unit: UnitId; status: StatusId; turns: number; cause: 'rooted' | 'shadowdancer' }
// src/combat/combat.ts
export const TRAIT_IDS = ['rooted', 'tumble', 'counter', 'ambush', 'deathblow', 'blademaster', 'deadeye',
  'unbreakable', 'shadowdancer', 'guardian', 'courage', 'aegis', 'sanctuary', 'arcane_knight'] as const
export type TraitId = (typeof TRAIT_IDS)[number]
// CombatantStats gains traits?: readonly TraitId[]  (TRAIT_IDS order; only when non-empty)
```

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

**Sanctuary's source.** `RestoreEvent.source` (C13) names the Sanctuary unit whose aura healed (cause `sanctuary` only), so that `formatEvent` can say "Sera's sanctuary restores 3 to Aldric.". It is part of the shape under `LOG_SCHEMA_VERSION` 26.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets.
- **Determinism.** A battle replays from its seed. A passive that rolls nothing draws nothing: no rule here may draw from the RNG. A unit whose stats carry none of the new fields behaves exactly as today.
- **The refactor guard** stays green unchanged (decision 2). A mismatch means an aura or restore reached a unit that has none, or the order of `startTurn`'s events changed: find and fix it; never re-record in this step.
- **Domain first.** Every rule in `src/combat/` and `src/engine/`, with tests; scenes decide nothing (step 22 does the looks).
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit for this step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 19: auras and turn-start restores". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: the `battleEngine.ts` line (new event, auras, the turn-start order) and the rules of the battle system; search it for names you change.

## 3. Dependencies and prerequisites

- **Step 11 (done)** provides `TRAIT_IDS`, `CombatantStats.traits`, `StatusLaidEvent` (cause `'shadowdancer'` already in its union) and the `traits` emission in `deriveCombatStats` (`traitsOf`).
- **Step 17 (done)** provides `LOG_SCHEMA_VERSION` 26, `SAVE_VERSION` 25 and `CombatantStats.manaRegen` (emitted from the `manaRegen` effect, only when non-zero).
- **Step 18 (done)** routes every damage application through `applyDamage`; this step's heals do not go through it.
- **Existing code, for reference** (`src/engine/battleEngine.ts`): `effectiveStats(unit)` (exported, adds statuses to stats), called at every roll (`attack`, `cast`, strikes, areas, ticks' wards) and in `previewAttack` / `previewCast`; `startTurn(side)` (ticks, regeneration with `RegenerateEvent`, recharge count-down, AP); `formatEvent`. `src/combat/spells.ts`: `STATUSES`, `STATUS_IDS`, `StatusRule`, `ActiveStatus` (the `mirrored` status keeps its image count on the active status). `src/engine/policies.ts` reads units through `getState()` snapshots.

## 4. Scope and implementation guidance

### 4.1 Auras

- `auraBonus` and `statsIn` in `battleEngine.ts` as C13 gives them, pure over snapshots. Distance is hex distance; "standing" is hp > 0; allies are the unit's side. An aura's holder is any unit whose `traits` include `guardian`, `courage` or `aegis`.
- Inside the engine, replace each `effectiveStats(x)` used to resolve a roll or damage (attacker and defender of an attack or strike, caster and each target of a cast or area, ward on a tick, free attacks, counters) with the record-based equivalent of `statsIn`. Resistance and wards from Aegis apply wherever a status's resistance and wards do; AC from Guardian and to-hit from Courage wherever a status's do. Keep one helper so no call site is missed; grep for every `effectiveStats(` and account for each in the execution record.
- `previewAttack` and `previewCast` use it, so the battle screen's odds include auras. The policy reaches it through `statsIn` on its snapshots wherever it reads a unit's AC, to hit or resistance for scoring (a mechanical swap of its stat reads; no new policy step).
- A unit with no aura holder near it gets a zero bonus: the numbers it rolls are today's.

### 4.2 Turn-start restores

- Add `renewing` to `STATUS_IDS` and `STATUSES` (mark U, a green colour, `regen: 3`) and `regen?: number` to `StatusRule` (per C6).
- In `startTurn`, after regeneration, the Renewing, Sanctuary, Serenity and Shadowdancer passes in that order (§2). Sanctuary: one heal per unit even with two Sanctuary units in range; the source named is the first in roster order. Renewing is blocked by `stopsRegeneration` (Seared, Corroded), as regeneration is; Sanctuary and Serenity are not.
- `RestoreEvent` added to `BattleEvent`; `formatEvent` lines as in §2.
- Shadowdancer: lays `mirrored` with 1 image for 2 turns when the unit has no `mirrored` or one with 0 images; logs `StatusLaidEvent { cause: 'shadowdancer', turns: 2 }`.

### 4.3 Exclusions

- No node grants these traits yet (step 21). No sprite, float or nameplate change (step 22). No policy step (step 21's `supportCast` casts Renew).

## 5. Verification

### Tests (in `npm test`)

In `src/engine/battleEngine.test.ts`, with stats built by hand and a scripted or seeded RNG:

1. `auraBonus`: Guardian gives +5 AC to an ally at distance 1, none at 2, none to itself; two Guardians give +5. Courage +5 to hit within 2, not itself. Aegis +2 resistance and +2 to every ward within 2, itself included. A fallen holder gives nothing.
2. An attack on a unit beside a Guardian ally rolls against AC + 5 (the event's `chance` shows it); `previewAttack` agrees. A Courage ally raises an attack's chance and a cast's; `previewCast` agrees. Aegis cuts a weapon hit by 2 more resistance and a fire spell by 2 more ward.
3. Renewing: a wounded unit with `renewing` laid heals 3 as its side's turn begins, after a poison tick, logged as `restore` cause `renewing`; capped at maximum; nothing logged when full; nothing while Seared.
4. Sanctuary: allies within 2 (and the holder) heal 3; one at 3 hexes does not; two Sanctuaries heal a unit once; foes never; the event names the source.
5. Serenity: `manaRegen` 2 restores mana, never above `magic.maxMana`; nothing logged at full.
6. Shadowdancer: lays `mirrored` with 1 image for 2 turns as its side's turn begins; not while an image remains; again once the images are spent.
7. Order: a turn start with a tick, regeneration, Renewing, Sanctuary, Serenity and Shadowdancer emits their events in that order; a tick that ends the battle returns before the restores.
8. No RNG draw: a scripted RNG with no rolls left survives a turn start full of restores and auras.
9. A battle with none of these traits produces the same events as before (the existing replay tests pass unchanged); snapshot and `restore` round-trip mid-battle with `renewing` laid.

`src/combat/spells.test.ts`: `renewing` has its mark and rule. A `formatEvent` test for each new line.

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run src/engine/battleEngine.test.ts
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run scripts/simulate.test.ts -t "refactor guard"
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test
```

- The refactor guard passes **unchanged** (decision 2).
- This step changes no scene: `npm run test:browser` is not required. Run it if a scene's compile was touched by the new event type (e.g. an exhaustive switch in `BattleScene` or `sounds.ts`), and record the result.

## 6. Completion criteria

- [ ] `auraBonus` and `statsIn` exported as C13 gives them, used at every roll and damage resolution, in `previewAttack`, `previewCast` and the policy's stat reads; each former `effectiveStats(` call site accounted for in the record.
- [ ] `renewing` and `StatusRule.regen` added; the index's C6 lines for them say step 19.
- [ ] Renewing, Sanctuary, Serenity and Shadowdancer act in the stated order after ticks and regeneration, logged by `RestoreEvent` (with `source` for Sanctuary, C13 updated) and `StatusLaidEvent`.
- [ ] `formatEvent` lines added; tests 1 to 9 written first and passing.
- [ ] `npm test` passes; the refactor guard is green unchanged.
- [ ] `CLAUDE.md` updated (engine line, battle rules).
- [ ] Index: step 19's status `done (<commit>)`; this file's execution record filled.
- [ ] One commit, "Skill trees step 19: auras and turn-start restores".

## 7. Execution record
