# Step 17: Attack and movement traits

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R8, AC6; §5.1 `deriveCombatStats`, §5.4 table, §4.3 node tables) · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step opens stage 3: it adds eleven engine rules that touch the heart of `attack()` (to-hit, damage, criticals, free attacks, reactions), every new `UnitRecord` field of the stage with its restore defaults, and the stage's log and save versions. A slip in the order of rolls breaks replays, and a rule that leaks onto units without the new fields breaks the refactor guard.

## 1. Objective

The engine resolves the attack and movement traits of design §5.4, each switched on by a stats field or a trait and off when the field is absent:

- **Iron Skin's free attacks** (`opportunity`), **Counter** (trait `counter`), **Tumble** (trait `tumble`), **Skirmisher** (`movedToHit`), **Backstab** (`rear`), **Ambush** (trait `ambush`), **Executioner** (`execute`), **Fortune's critical damage** (`critDamage`), **Deadeye** (trait `deadeye`), **Battle Mage's mana on hit** (`manaOnHit`) and **Arcane Knight's Strikes at weapon AP + 0** (trait `arcane_knight`).

`deriveCombatStats` emits the new numbers and traits from a character's perks. `UnitRecord` and `UnitSnapshot` gain all five stage-3 fields (`attackedYet`, `endured`, `refunded`, `fallenThisBattle`, `usedOnce`), restored with defaults; this step uses `attackedYet`, steps 18 to 20 the rest. `LOG_SCHEMA_VERSION` becomes 26 and `SAVE_VERSION` 25.

No node in `PERKS` carries these effects or traits yet (step 21 adds the stage-3 nodes and completes the partial ones), so **no simulated unit can reach any rule here: the refactor guard stays green unchanged.**

## 2. Requirements and context

- **R8:** the new mechanics work in the engine as design §5.4 states, and battles stay deterministic from their seed.
- **AC6:** each mechanic of §5.4 has an engine test, and the replay tests still pass.
- **Quality constraints (design §2):** every rule in the Phaser-free domain modules with tests; a passive that rolls nothing draws nothing; a unit whose stats carry none of the new fields behaves exactly as today.

### The rules (design §5.4, restated)

| Mechanic | Rule |
| --- | --- |
| **Iron Skin (free attacks)** | A free attack (`opportunity`) by a unit whose stats carry `opportunity` adds `opportunity.toHit` to the chance and `opportunity.damage` to a hit's damage (after the dice, not doubled by a critical). Iron Skin: +15 to hit, +3 damage. |
| **Counter** | After any melee attack (`isMelee` of the attacker's stats; technique strikes included) by a unit of the side in turn that **misses** a defender (not of that side) with trait `counter`, whose `reactionReady` is true, who holds a melee weapon, and who has the attacker within its `attackRange`: the defender spends `reactionReady` and makes a free attack on the attacker (`AttackEvent.counter: true`, `opportunity: true`, AP cost 0). No counter comes off a counter, since only the side not in turn counters. A counter is rolled after the missed attack's event and before anything else the action does (a routine's next strike, Cleave's second blow). A miss on an image (Mirrored) is a hit on the image, not a miss: no counter. |
| **Tumble** | `reactorsAt` returns no reactors for a mover with trait `tumble`, so its moves provoke no free attacks (and `reachableHexes` routes it accordingly). |
| **Skirmisher** | A weapon attack or technique strike, in its own turn, by a unit with `moved === true` adds `movedToHit` to the chance. (`moved` is step 11's field.) Not a free attack. |
| **Backstab** | A weapon attack or technique strike whose `arc` is `'rear'` adds `rear.toHit` to the chance and, on a hit, `rear.damage` to the damage (after the dice, not doubled). Backstab: +15, +4. Applies to free attacks too, as it reads only the arc. |
| **Ambush** | The first weapon attack or technique strike a unit with trait `ambush` makes in its own turn in the battle (not a free attack, not a counter) adds +25 to the chance (`AMBUSH_BONUS`), and a hit is critical (`AttackEvent.ambush: true`). Any such attack, by any unit, sets `attackedYet`; Ambush reads it. The roll is drawn as for any attack; a hit is made critical without a second draw. |
| **Executioner / Fortune** | +`execute` damage on a hit when the defender's hp ≤ ⌊maxHp / 2⌋ **before** the blow; +`critDamage` on a critical, after the dice are doubled. Executioner +5; Fortune +4. Neither is doubled. |
| **Deadeye** | A ranged weapon attack (not `isMelee`) by a unit with trait `deadeye` pierces 3 more points of resistance (beyond `rangedPierce`), and a critical rolls triple dice instead of double (`critMultiplier` 3 in the damage roll). |
| **Battle Mage (mana on hit)** | A melee hit that strikes no image restores `manaOnHit` mana (never above `magic.maxMana`; none for a unit without `magic`), recorded as `AttackEvent.manaRestored` (the mana actually regained, field present only when > 0). |
| **Arcane Knight** | A unit with trait `arcane_knight` pays `attackApCost + 0` for the Spellsword Strikes (`flame_strike`, `frost_strike`, `thunder_strike`) instead of `+ weaponAp`; `abilityApCost` applies it, so the engine, the policy and the menus agree. Its +4 fire on every melee hit is `meleeOnHit` data on the node, derived in step 04's way; step 21 adds the node. |

**RNG order.** None of these rules draws from the RNG except the counter's free attack, which is `attack()` as any free attack is (one roll to hit, then the dice on a hit). Everything else is a number added to an existing roll's chance or damage. A unit with none of the fields draws exactly as today.

**Previews.** `previewAttack` (and anything the policy and `planAttack` read from it) reflects every bonus that is known before the roll: Skirmisher, Backstab, Ambush's +25, Iron Skin's to-hit on a free attack where previewed, Deadeye's pierce in the resistance left, Executioner's damage when the defender is already at half or less.

### Decisions from the index (unchanged)

2. **The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.

7. **Saves.** `SAVE_VERSION` 23 in stage 1 (step 03 raises it; step 05 adds `migrateFrom22`), 24 in stage 2 (step 11), 25 in stage 3 (step 17). Versions 23 and 24 load into the current version with no game migration: `BattleEngine.restore` fills the new `UnitRecord` fields with their defaults. Version 18 goes through `migrateFrom18` then `migrateFrom22`. Between steps 03 and 05, version-22 saves read as unreadable, and so does the version-18 fixture (its migration yields version 22's shape): step 03 changes that test to expect unreadable, and step 05 restores it.

8. **`LOG_SCHEMA_VERSION`** 25 from step 09 (the first stage-2 step to change an event); steps 10 and 11 change shapes under 25. 26 from step 17; steps 18 to 20 under 26.

### Contracts (copied unchanged from the index)

**C11. Hero abilities (steps 09 and 10; consumed here):**

```ts
// src/combat/abilities.ts
export interface Ability {      // existing fields kept; monsters set none of the new ones
  manaCost?: number                                    // paid as the action begins; canUse checks mana
  weaponAp?: number                                    // AP = attackApCost + weaponAp (apCost then ignored)
  needs?: 'melee' | 'ranged'                           // isMelee(stats) must match
  selfStatus?: StatusLaid                              // target is the user (Sprint)
  foeStatus?: { status: StatusLaid; range: number | 'weapon' }   // no roll (Hunter's Mark)
}
export interface Strike {       // damage becomes optional when weapon is set
  weapon?: true; toHit?: number; damageBonus?: number; onHit?: readonly OnHit[]; spreads?: true
}
export interface AreaAttack {   // step 10
  weaponDamage?: true; weaponRange?: true; throughResistance?: true
  foesOnly?: true; auto?: true; bane?: true; centredOnSelf?: true
}
export const ABILITY_IDS = ['troll_claws', 'spider_bite', 'spider_web', 'fire_spit',
  'power_attack', 'cleave', 'taunt', 'pin', 'flame_strike', 'frost_strike', 'thunder_strike',
  'aimed_shot', 'hunters_mark', 'volley', 'pinning_shot', 'sprint', 'dirty_trick', 'venom_strike',
  'hamstring', 'smite', 'consecrate'] as const
export function abilityApCost(stats: CombatantStats, ability: AbilityId): number
  // weaponAp !== undefined ? attackApCost + weaponAp (Arcane Knight's Strikes: + 0, step 17) : apCost
// src/combat/combat.ts: CombatantStats gains imbueDamage?: number (added to each on-hit entry with an element of a Strike)
// src/engine/battleEngine.ts: AttackEvent (first strike only) and AbilityEvent gain manaCost?: number, manaAfter?: number;
//   LOG_SCHEMA_VERSION = 25 (step 09)
```

Step 09 adds the 14 strike and status abilities to `ABILITY_IDS` and `ABILITIES` with design §4.3's numbers; step 10 inserts `taunt`, `volley` and `consecrate` at their places in the list above, with their entries. Taunt's status rule is step 11's. Pin and Pinning Shot lay `pinned` (an id with no rule from step 09): step 09 builds them and tests the strike; step 11 gives `pinned` its rule and tests the pin.

**C12. Taunt, Rooted and Pin (step 11; consumed here):**

```ts
// src/engine/battleEngine.ts
export const TAUNT_PENALTY = 25
// UnitRecord, UnitSnapshot gain moved: boolean  (false as its side's turn begins; true after its first step)
export interface StatusLaidEvent extends EventBase { type: 'status_laid'; unit: UnitId; status: StatusId; turns: number; cause: 'rooted' | 'shadowdancer' }
// AttackEvent, CastOutcome gain tauntPenalty?: number   (25 when applied)
// StatusEndEvent.reason gains 'source_fell' | 'moved' (step 20: 'cleansed')
// src/combat/combat.ts
export const TRAIT_IDS = ['rooted', 'tumble', 'counter', 'ambush', 'deathblow', 'blademaster', 'deadeye',
  'unbreakable', 'shadowdancer', 'guardian', 'courage', 'aegis', 'sanctuary', 'arcane_knight'] as const
export type TraitId = (typeof TRAIT_IDS)[number]
// CombatantStats gains traits?: readonly TraitId[]  (TRAIT_IDS order; only when non-empty)
// src/game/save.ts: SAVE_VERSION = 24; version 23 loads as is; BattleEngine.restore defaults `moved` to false
```

Rules: design §5.4's Taunt, Rooted and Pin rows and §4.7's edge cases.

**C13. Stage-3 engine (this step produces the stats numbers, the five fields, the attack-event fields and the versions):**

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

**Of C13 this step builds:** the `CombatantStats` numbers `opportunity`, `rear`, `movedToHit`, `execute`, `critDamage`, `manaOnHit` (and declares `manaRegen`, read in step 19); all five `UnitRecord`/`UnitSnapshot` fields with their restore defaults; the `AttackEvent` fields `counter`, `ambush`, `manaRestored` (and declares `deathblow`, `apRefunded`, `endured` for step 18, which may instead add them; either way they are optional and set only by step 18's rules); `LOG_SCHEMA_VERSION` 26 and `SAVE_VERSION` 25. `RestoreEvent`, `auraBonus`, `statsIn`, the `CastOutcome` and `StatusTickEvent` fields and the `Spell` fields are steps 18 to 20's.

**C2 (step 03), the effect keys this step reads:** `PerkEffects` has `opportunityToHit`, `opportunityDamage`, `rearToHit`, `rearDamage`, `movedToHit`, `executeDamage`, `critDamage`, `manaOnHit`, `manaRegen`; `Perk.trait?: TraitId`; `traitsOf(character): TraitId[]` (TRAIT_IDS order; step 11).

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npx vitest run --project domain`; `npm run test:browser` after any scene change.
- **The simulator.** Do not run campaign measurements in this step (measurement belongs to steps 01, 08, 16, 23, 24, 25). Never run two simulator runs at once.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`): **keep it green unchanged** (decision 2). Do not edit its fixture. A mismatch means a rule leaked onto a unit without the new fields, or an RNG draw moved: find and fix it.
- **Determinism.** A battle replays from its seed. New rolls draw from the RNG in the order design §5.4 fixes; a passive that rolls nothing draws nothing. A unit whose stats carry none of the new fields behaves exactly as today.
- **Domain first.** Every rule lives in the Phaser-free modules with tests; scenes decide nothing.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` (no enums, namespaces or parameter properties), `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit for this step once `npm test` passes and the guard holds, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 17: attack and movement traits". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines this change makes wrong and search it for every name renamed or removed.

## 3. Dependencies and prerequisites

- **Steps 01–16 done** (stages 1 and 2). In particular, expected to exist:
  - step 03/04: `Perk` with `path`, `tier`, `effects`, `meleeOnHit`; `PerkEffects` with the C2 keys above (declared, unread until now); `deriveCombatStats` reading the stage-1 effects;
  - step 09: hero abilities (`Ability.weaponAp`, technique strikes through `attack()`, `abilityApCost`, `AttackEvent.manaCost`/`manaAfter`, `LOG_SCHEMA_VERSION` 25);
  - step 11: `TRAIT_IDS`, `TraitId`, `CombatantStats.traits`, `Perk.trait`, `traitsOf`, `UnitRecord.moved`, `StatusLaidEvent`, `SAVE_VERSION` 24 with version 23 loading as is.
- **Existing code at `50fb4cf`, for orientation:**
  - `src/combat/combat.ts`: `CombatantStats`; `resolveAttack` (to-hit roll, `critical = hit && attackRoll <= critChance`); `rollHitDamage(dice, critical, rng)` (a critical doubles the dice); `effectiveResistance`, `damageThrough`.
  - `src/engine/battleEngine.ts`: `UnitRecord` (with `recharging`), `UnitSnapshot extends CombatantStats`, `BattleSnapshot`, `static restore(snapshot)`, `previewAttack(unit, target)`, private `attack(...)` (free attacks when `apCost === null`, `opportunity` on the event), `reactorsAt(mover, hex, to)`, `reachable(actor)`, `attackArc`, `LOG_SCHEMA_VERSION`.
  - `src/character/character.ts`: `deriveCombatStats`.
  - `src/game/save.ts`: `SAVE_VERSION`, `parseSave` (accepts the current version and 18, after step 05 22, after step 11 23).

## 4. Scope and implementation guidance

### 4.1 `src/combat/combat.ts`

- `CombatantStats` gains `opportunity?`, `rear?`, `movedToHit?`, `execute?`, `critDamage?`, `manaOnHit?`, `manaRegen?` (C13). `sameCombatStats` (or its equivalent) compares them, so an `equip` that changes them is not taken as no change.
- The damage roll takes a critical multiplier: `rollHitDamage(dice, critical, rng, critMultiplier = 2)` (or an equivalent parameter); 3 rolls triple the dice count. With the default it draws exactly as today.
- Export `AMBUSH_BONUS = 25` where the engine's other constants live (combat.ts or battleEngine.ts; the engineer's choice).

### 4.2 `src/character/character.ts`

`deriveCombatStats` emits, each only when non-zero:

- `opportunity: { toHit: perkBonus('opportunityToHit'), damage: perkBonus('opportunityDamage') }` when either is non-zero;
- `rear: { toHit: perkBonus('rearToHit'), damage: perkBonus('rearDamage') }` likewise;
- `movedToHit`, `execute` (from `executeDamage`), `critDamage`, `manaOnHit`, `manaRegen`;
- `traits` already (step 11) from `traitsOf`.

Tests in `character.test.ts` use characters built with hand-made `perks` holding nodes that carry these effects. Since the stage-3 nodes enter `PERKS` only in step 21, test the derivation through the partial stage-1 nodes where they already carry a key, or by stubbing a perk record in the test (follow how `character.test.ts` builds characters; do not add nodes to `PERKS` here).

### 4.3 `src/combat/abilities.ts`

`abilityApCost(stats, ability)`: for `flame_strike`, `frost_strike` and `thunder_strike` (the abilities whose strikes carry an elemental `onHit`; name them in a `SPELLSWORD_STRIKES` list), a unit whose `traits` include `arcane_knight` pays `attackApCost + 0`. Everything else unchanged.

### 4.4 `src/engine/battleEngine.ts`

- **Fields.** `UnitRecord` and `UnitSnapshot` gain `attackedYet`, `endured`, `refunded`, `fallenThisBattle` (booleans, false at the start) and `usedOnce: SpellId[]` (`[]`). `snapshot()` copies them (`usedOnce` as a fresh array); `restore` fills each missing one with its default, so a version-23 or 24 snapshot plays on. Of these only `attackedYet` is set here; leave `endured`, `refunded`, `fallenThisBattle`, `usedOnce` untouched by any rule (steps 18–20).
- **`attack()`**, in one place, before the roll: add `rear.toHit` on a rear arc; `movedToHit` for an own-turn attack with `moved`; `opportunity.toHit` for a free attack; Ambush's +25 for the first own-turn attack of a unit with trait `ambush` and `attackedYet === false`. Record what Ambush did (`ambush: true`) on the event; fold the other to-hit bonuses into `chance` as `flankBonus` and `arcBonus` are, or record them on the event if that reads better in the log (the engineer's choice; any new event field is optional). After the roll: Ambush's hit is critical; damage = dice (× 2, or × 3 with Deadeye on a ranged critical) + existing bonuses + `rear.damage` on a rear hit + `execute` when the defender's hp ≤ ⌊maxHp / 2⌋ before the blow + `critDamage` on a critical + `opportunity.damage` on a free attack; then resistance (Deadeye adds 3 to a ranged attack's pierce), then on-hit as today. Set `attackedYet` on the attacker for any own-turn weapon attack or technique strike.
- **Mana on hit.** After a melee hit that struck no image: restore `manaOnHit`, capped, recorded as `manaRestored`.
- **Counter.** After an attack event whose attacker's side is in turn, which was melee and missed, check the defender's `counter` trait, `reactionReady`, melee weapon and range; if all hold, spend `reactionReady` and resolve a free attack on the attacker through the same `attack()` path (`counter: true`, `opportunity: true`). Wire it so that routines (`routine`), technique strikes and Cleave's two blows each give their own chance, the counter resolving straight after the miss. A counter that fells the attacker ends the rest of the action as any fall does (follow how a felled actor is handled today; a routine stops).
- **Tumble.** `reactorsAt` returns `[]` for a mover whose stats' `traits` include `tumble`.
- **Skirmisher** relies on step 11's `moved`; free attacks and counters never get `movedToHit`.
- **Previews.** `previewAttack` reflects the pre-roll bonuses (§2's "Previews"); the policy's expected-harm estimate reads the preview or the same helper, so the two never disagree.
- `LOG_SCHEMA_VERSION = 26`. `formatEvent`: a counter reads "Brenna strikes back." before the usual attack line (design §5.4's short lines); an ambush may add nothing to the line (the event holds it). Keep lines short.

### 4.5 `src/game/save.ts`

`SAVE_VERSION = 25`; `parseSave` accepts version 24 as is (with 23, 22 and 18 as before). No game migration; the battle's snapshot is restored with defaults. Update the doc comment's version list.

### 4.6 `CLAUDE.md`

Fix the lines this changes: the `battleEngine.ts` paragraph (free attacks: Tumble, Iron Skin's bonus, Counter's reaction), the rules of the battle system (critical tripled by Deadeye; rear and moved bonuses), the save version in the rules of saving, and `LOG_SCHEMA_VERSION`'s mention if any.

### 4.7 Exclusions

- No node enters `PERKS`; no plan, policy or bandit change (step 21).
- No Deathblow, Blademaster, Unbreakable (18), auras or restores (19), special spells (20).
- No scene change (step 22 draws the new events' lines and looks); `formatEvent` text only.

## 5. Verification

### Tests (in `npm test`)

Engine tests in `src/engine/battleEngine.test.ts`, with a scripted RNG, one `describe` row each, each also asserting the same situation **without** the field behaves as before:

1. **Iron Skin:** a free attack by a unit with `opportunity { toHit: 15, damage: 3 }` hits on a roll 15 above what a plain one needs, and deals 3 more; its own-turn attack gets neither.
2. **Counter:** a foe's melee attack misses a `counter` defender in reach → one free attack back (`counter: true`, `opportunity: true`), `reactionReady` spent; a second miss that turn brings none; a hit brings none; a shot that misses brings none; a defender holding a bow brings none; a counter in the defender's own turn never happens.
3. **Tumble:** a `tumble` unit stepping out of a ready foe's zone provokes nothing; `previewMove` lists no provokers.
4. **Skirmisher:** after a step, the attack's chance includes `movedToHit`; without a step it does not; a free attack never does.
5. **Backstab:** from the rear arc, +`rear.toHit` and +`rear.damage` on a hit; from the side, none.
6. **Ambush:** the first own-turn attack gets +25 and a hit is critical (`ambush: true`); the second does not; a free attack before it does not spend it.
7. **Executioner:** +`execute` against a defender at ⌊maxHp/2⌋ hp, none at one more.
8. **Fortune:** +`critDamage` on a critical, after the doubling; none on a normal hit.
9. **Deadeye:** a ranged critical rolls triple the dice (scripted dice show three sets); a melee critical by the same unit doubles; its shots pierce 3 more resistance; `previewAttack`'s resistance left shows it.
10. **Battle Mage:** a melee hit restores `manaOnHit` up to the maximum (`manaRestored`); a hit on an image restores none; a shot restores none.
11. **Arcane Knight:** `abilityApCost` of `flame_strike` is `attackApCost + 0` with the trait and `+ 1` without (in `abilities.test.ts`).
12. **Draws:** for each passive rule, the RNG is called the same number of times as without it (count draws with the scripted RNG).
13. **Snapshot round-trip:** a snapshot with every new field set to a non-default value (`attackedYet`, `endured`, `refunded`, `fallenThisBattle` true, `usedOnce: ['heal']`) restores and plays on identically to the original; a snapshot with the fields deleted restores with the defaults.
14. **Replay:** the existing replay tests pass unchanged.

`character.test.ts`: the derived numbers (§4.2) appear when the effects are present and are absent otherwise.

`save.test.ts`: a version-24 save (built in the test from a current save with `version: 24` and the new unit fields removed from its battle) loads and its battle restores with the defaults; `SAVE_VERSION` is 25.

### Commands

```sh
export PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH
npx vitest run src/engine/battleEngine.test.ts src/combat src/character/character.test.ts src/game/save.test.ts
npx vitest run scripts/simulate.test.ts -t "refactor guard"   # green, fixture unchanged
npm test
```

No scene changes in this step, so `npm run test:browser` is not required; run it if `formatEvent`'s new line touches a test that reads the log.

### Acceptance

- Every row of §2's table has its test and passes (AC6 for these mechanics).
- The refactor guard is green with its fixture unchanged.
- `LOG_SCHEMA_VERSION` is 26 and `SAVE_VERSION` 25; a version-24 save loads.

## 6. Completion criteria

- [x] The eleven rules resolve as §2 states, each off when its field is absent.
- [x] All five stage-3 `UnitRecord`/`UnitSnapshot` fields exist, snapshot and restore with defaults.
- [x] `previewAttack` reflects the pre-roll bonuses.
- [x] Tests 1–14 and the character and save tests pass; `npm test` passes; the guard fixture is unedited and green.
- [x] `CLAUDE.md` updated (§4.6).
- [x] Committed as "Skill trees step 17: attack and movement traits".
- [x] The index's step table shows step 17 `done (<commit>)`.

## 7. Execution record

### Step 17 (2026-11-14)

**What was built.** `CombatantStats` gains `opportunity`, `rear`, `movedToHit`, `execute`, `critDamage`, `manaOnHit`, `manaRegen` (compared by `sameCombatStats`); `rollHitDamage` takes a `critMultiplier` (default 2). `deriveCombatStats` emits them from the C2 effect keys, each only when not 0 (a pair when either half is). `abilityApCost` charges the Spellsword Strikes (`SPELLSWORD_STRIKES`) at `attackApCost + 0` for a unit with `arcane_knight`. In the engine: `AMBUSH_BONUS` (25), `DEADEYE_PIERCE` (3), `DEADEYE_CRIT_MULTIPLIER` (3), and exported pure helpers `BlowContext`, `ambushes`, `traitToHit`, `traitDamage`, `deadeyeShot`, `blowPierce`, `resistanceLeft`, which `attack()`, `blowOdds` (so `previewAttack` and `previewAbility`) and the policy's `blowBonus`/`expectedHarm` all read, so the preview and the policy never disagree. `reactorsAt` returns none for a `tumble` mover. A Counter is resolved inside `attack()` after the missed blow's event and its falls (`counters()`), and `routine` stops when its user falls. `UnitRecord` gains the five stage-3 fields; `restore` fills missing ones; `LOG_SCHEMA_VERSION` 26; `SAVE_VERSION` 25 with 24 accepted as is. `formatEvent`: a counter reads "Goblin strikes back. Goblin rolls …".

**Commands and results.**
- `npx vitest run src/engine/battleEngine.test.ts src/combat src/character/character.test.ts src/game/save.test.ts`: 615 passed (new: 29 engine tests in "BattleEngine attack and movement traits", rows 1–13 of §5; Arcane Knight in `abilities.test.ts`; `rollHitDamage` and `sameCombatStats` in `combat.test.ts`; derivation in `character.test.ts`; version 24 in `save.test.ts`). Red first: 19 of the new engine tests failed before the engine change.
- `npx vitest run scripts/simulate.test.ts -t "refactor guard"`: green (records unchanged; hash re-recorded, below).
- `npm test`: 86 files, 1866 tests passed. `npm run build`: passes.
- In-browser tests not run: no scene changed; `formatEvent`'s new counter line is read by no e2e test and no simulated unit can counter yet.

**Deviations.**
- *The refactor guard's hash (allowed by the decision log for a schema-only bump).* `GUARD_EVENTS_SHA256` moved to `4aed0810...eba05b` because `battle_start` carries `schemaVersion` 26. A scratch script (outside the repository) ran the guard's 5 campaigns: the log has 115 `"schemaVersion":26`, and with each written back as 25 it hashes to the recorded `aa9ffae5...ff5119`, so nothing else in the log moved. `GUARD_RECORDS` unchanged; the fixture's comment says so.
- *`UnitSnapshot`'s new fields are optional*, each present only when set (`attackedYet?: true`, ..., `usedOnce?` while non-empty), as `moved` is, so that `battle_start`'s unit snapshots (and the guard's log) are unchanged. `UnitRecord` (the save) always has all five. Readers: `u.attackedYet === true`.
- *`AttackEvent.traitBonus`* (optional, absent when 0) records what the traits added to `chance` (the task left the choice open). `armorPierce` on the event now records `blowPierce` (Deadeye's 3 included).
- *Policy.* `blowBonus` and `expectedHarm` read `traitToHit`, `traitDamage` (no critical) and `resistanceLeft`, per §4.4's "Previews"; no new policy branch (step 21). With no unit carrying the fields this changes nothing the guard sees.
- *Counter's reach* is `effectiveStats(defender).attackRange`; a spear holder counters at 2, a sword holder not at a spear's 2.

**For later steps.** Step 18: `deathblow`, `apRefunded`, `endured` are declared on `AttackEvent`; `endured`, `refunded`, `fallenThisBattle`, `usedOnce` exist on `UnitRecord` and are touched by no rule. Step 19: `manaRegen` is derived but unread. Step 21: the nodes need only the effect keys/traits; the policy already scores the traits' to-hit and damage. Step 22: the counter's log line exists; looks and floats for `counter`, `ambush`, `manaRestored` are yours.

