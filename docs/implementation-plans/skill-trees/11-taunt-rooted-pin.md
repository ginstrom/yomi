# Step 11: Taunt, Rooted and Pin

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R7; §4.5, §4.7, §5.2, §5.4; AC5) · [Feature record](../../features/skill-trees.md)

**Stage 2: hero techniques.** **Engineer tier: opus** (leave the model unset). This step adds three battle rules that touch every hostile roll (Taunt), the end of a turn and the first step of a move (Rooted), and the legality of moves (Pin), plus the save version and a snapshot field. A slip in the order of end-of-turn effects or in where the penalty is applied breaks determinism or the refactor guard.

## 1. Objective

The engine knows the three Heavy Knight rules:

- **Taunted** (`taunted`, mark T): a taunted unit's hostile rolls at anyone but its taunter take −25 to hit; the status ends on every taunted foe when the taunter falls.
- **Rooted** (`rooted`, mark R): a unit with the trait `rooted` that ends its side's turn without having moved gains +10 AC and +2 resistance until it next moves or the end of its next turn.
- **Pinned** (`pinned`, mark N): a pinned unit has no legal move; it still attacks, casts, uses abilities and makes free attacks.

Traits arrive in the engine (`TRAIT_IDS`, `CombatantStats.traits`, `traitsOf`), with `rooted` the first used. `SAVE_VERSION` becomes 24. The Taunt ability (step 10's `auto`, `foesOnly`, `centredOnSelf` area) now lays `taunted` with its `source`, and Pin and Pinning Shot (step 09) now lay a working `pinned`.

No simulated unit can yet take Taunt, Rooted or Pin (the nodes enter `PERKS` in step 13), so **the refactor guard stays green unchanged**.

## 2. Requirements and context

- **R7:** Taunt, Rooted and Pin work in the engine as design §5.4 states.
- **AC5 (R7):** Engine tests show four things. Taunted foes take −25 to hit against anyone but the taunter, and the policy attacks the taunter. A Rooted unit gains +10 AC and +2 resistance until it moves. A pinned foe has no legal move on its next turn. Pin spends 3 mana and the weapon's AP + 1.
  - The policy half of the first ("the policy attacks the taunter") is step 12's; this step proves the −25 and leaves a note for step 12.
- **AC6 (R8), in part:** each mechanic here has an engine test, and the replay tests still pass.

### Design §4.5 (in play)

- **Taunt.** The Heavy Knight steps between the foes and the archer and spends 3 AP. Each foe within 2 hexes is Taunted (letter **T**) through its next turn. Its attacks, techniques and hostile spells on anyone but the knight take −25 to hit. The AI turns on the knight. Taunt is ready again two rounds later.
- **Rooted.** A knight that ends its turn where it stood gains Rooted (**R**): +10 AC and +2 resistance through the enemy's turn. Stepping off the hex ends it at once. Free attacks it suffers while walking do not keep it.
- **Pin.** A melee blow that also costs 3 mana. On a hit the foe is Pinned (**N**) through its next turn: it cannot move, though it can still attack, cast or use abilities from where it stands. Pinning Shot does the same at range.

### Design §4.7 (edge cases this step owns)

- Taunt's source falls: Taunted ends on every foe it taunted (reason `source_fell`).
- Taunt on a foe already Taunted by another unit: the newer taunter replaces the old (`source` overwritten, the longer duration kept).
- A Pinned foe with a free attack still makes it. Pinned stops moves, not reactions.

### Design §5.4 (the rows of this step)

| Mechanic | Rule |
| --- | --- |
| **Taunt** | An `auto` `foesOnly` area: lays `taunted` with `source = user` on every foe touched; logged as one `AbilityEvent` whose outcomes are status-only. Every hostile roll (weapon attack, strike, hostile spell or area, per target) by a unit with `taunted` against a unit other than its `source` subtracts `TAUNT_PENALTY` (25), recorded as `tauntPenalty` on the `AttackEvent` and `CastOutcome`. When the source falls, `taunted` ends on every unit it taunted (`status_end` reason `source_fell`). |
| **Rooted** | On `end_turn` for side S, *before* `countDownStatuses`, every standing unit of S with trait `rooted` and `moved === false` gets `rooted` laid for 2 turns (so 1 is left after the count-down, through the enemy's turn), logged by a new `StatusLaidEvent { unit, status, cause: 'rooted' }`. The first step of any move ends `rooted` (`status_end` reason `moved`), before free attacks on that step are rolled. |
| **Pin** | A technique strike laying `pinned` (1 turn) on a hit that leaves the foe standing. `reachable` returns no hexes for a unit with an `immobile` status, so it has no legal move. Its free attacks, attacks and casts are untouched. |

`formatEvent` gains short lines (design §5.4): "Aldric taunts 2 foes." (the Taunt `AbilityEvent`), "Aldric holds his ground (rooted)." (`status_laid` with cause `rooted`), "Goblin is pinned." (a pin laid by a strike, as other strike statuses are told).

### Decisions from the index (unchanged)

2. **The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
7. **Saves.** `SAVE_VERSION` 23 in stage 1 (step 03 raises it; step 05 adds `migrateFrom22`), 24 in stage 2 (step 11), 25 in stage 3 (step 17). Versions 23 and 24 load into the current version with no game migration: `BattleEngine.restore` fills the new `UnitRecord` fields with their defaults. Version 18 goes through `migrateFrom18` then `migrateFrom22`. Between steps 03 and 05, version-22 saves read as unreadable, and so does the version-18 fixture (its migration yields version 22's shape): step 03 changes that test to expect unreadable, and step 05 restores it.
8. **`LOG_SCHEMA_VERSION`** 25 from step 09 (the first stage-2 step to change an event); steps 10 and 11 change shapes under 25. 26 from step 17; steps 18 to 20 under 26.

### Contracts (copied unchanged from the index)

**C6. Spells and statuses (step 02; extended by 09, 11, 20)**

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

**C11. Hero abilities (steps 09 and 10; consumed by 11–15, 17, 21)**

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

**C12. Taunt, Rooted and Pin (this step)**

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

**From C2 (step 03), consumed here:** `Perk.trait?: TraitId` (step 11 on) and `traitsOf(character: Character): TraitId[]` (step 11 on; `TRAIT_IDS` order) in `src/character/perks.ts`.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets.
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npm run test:browser` after any scene change (read `e2e/CLAUDE.md` before adding one).
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`): this step must keep it green **unchanged** (decision 2). Do not edit its fixture. No simulator measurement in this step.
- **Determinism.** A battle replays from its seed. Nothing in this step draws from the RNG: Taunt's area is `auto` (no roll), Rooted is laid without a roll, Pin's roll is the strike's own. A unit whose stats carry none of the new fields (every monster, every hero without these nodes) behaves exactly as today.
- **Domain first.** Rules live in the Phaser-free modules with tests; scenes decide nothing.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` (`import type`), `.ts` extensions.
- **Commits.** One commit once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 11: Taunt, Rooted and Pin". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines this change makes wrong and search it for every name you rename.

## 3. Dependencies and prerequisites

- **Step 09 (done first)** provides the `Ability`/`Strike` extensions, `abilityApCost`, technique strikes resolved through `attack()` with a `status` laid on a hit that leaves the foe standing, `manaCost`/`manaAfter` on events, `LOG_SCHEMA_VERSION` 25, and the `pin` and `pinning_shot` entries in `ABILITIES` (3 mana, `weaponAp: 1`, `recharge: 1`; `pin` `needs: 'melee'`, `pinning_shot` `needs: 'ranged'`; a strike laying `{ id: 'pinned', turns: 1 }`). If step 09 could not name `pinned` before it existed, this step adds the status to those entries.
- **Step 10 (done first)** provides `AreaAttack`'s `foesOnly`, `auto`, `centredOnSelf`, and the `taunt` entry in `ABILITIES` (3 AP, recharge 2, radius 2, aimed only at the user's hex, laying `{ id: 'taunted', turns: 1 }` on every foe touched with no roll), logged as one `AbilityEvent` with status-only outcomes.
- **Step 03** provides `Perk.trait?` in the type (no node uses it yet) and `traitsOf` may not exist yet: add it here.
- **Existing code (at `50fb4cf`, as changed by steps 02–10):**
  - `src/engine/battleEngine.ts`: `UnitRecord` / `UnitSnapshot` (no `moved`); `effectiveStats` adds statuses' `armorClass`, `resistance`, `toHit`; `startTurn` (ticks, regeneration, recharging); `countDownStatuses(side)` called on `end_turn` (line ~949) before `startTurn(other)`; `endStatus(unit, status, reason)`; `reactorsAt` and `reachable` (`reachableHexes` with a provokes callback); the move resolution loop that rolls free attacks step by step (`reactorsAt(actor, actor.position, step)`); `fell(target)`; `snapshot()` and `BattleEngine.restore`; `StatusEndEvent.reason: 'expired' | 'woke' | 'spent'`; `formatEvent`.
  - `src/combat/spells.ts`: `STATUS_IDS`, `STATUSES` (each `StatusRule`: `name`, `adjective`, `mark`, `colour`, optional stat changes), `ActiveStatus`, the laying rule (laid again it takes the longer duration).
  - `src/character/character.ts`: `deriveCombatStats`.
  - `src/game/save.ts`: `SAVE_VERSION` 23, `parseSave` accepting 18, 22 (migrated) and 23.

## 4. Scope and implementation guidance

### 4.1 Statuses (`src/combat/spells.ts`)

- `taunted` (T, from step 10) and `pinned` (N, from step 09) are already status ids with no rule: give `taunted` its rule (C12) and `pinned` `immobile: true`. Add `rooted` (R: armour class +10, resistance +2) to `STATUS_IDS` and `STATUSES`, with a colour that reads on a nameplate and differs from the existing marks.
  - `rooted`: `armorClass: 10`, `resistance: 2`.
  - `pinned`: new `StatusRule.immobile?: true`.
  - `taunted`: no stat change in the rule (the penalty depends on the target, so the engine applies it, not `effectiveStats`).
- `ActiveStatus.source?: UnitId`. Laying `taunted` sets `source` to the user; laying it on a unit already taunted overwrites `source` with the newer taunter and keeps the longer duration. Other statuses never carry `source`.

### 4.2 Traits (`src/combat/combat.ts`, `src/character/perks.ts`, `src/character/character.ts`)

- `TRAIT_IDS`, `TraitId` and `CombatantStats.traits?: readonly TraitId[]` exactly as C12. Only `rooted` is read by the engine in this stage; the others are named now so that later steps add no new type.
- `traitsOf(character)`: the traits of the nodes held, in `TRAIT_IDS` order, without duplicates.
- `deriveCombatStats` emits `traits` only when non-empty. `sameCombatStats` (combat.ts) compares it.

### 4.3 Taunt (`battleEngine.ts`)

- `TAUNT_PENALTY = 25`, exported.
- A private helper gives the penalty for a roll by `attacker` at `target`: 25 when the attacker carries `taunted` whose `source` is not `target`'s id, else 0. Apply it to the chance of **every hostile roll, per target**: a weapon attack (free attacks included), each technique or routine strike, each unit a hostile spell rolls against, each unit a rolled area ability touches. It is subtracted where flanking, arc and status bonuses are combined, before the 5–95 clamp, so previews (`previewAttack`, `previewCast`) show it too.
- Record it as `tauntPenalty: 25` on the `AttackEvent` and on the `CastOutcome` (the outcome type that `CastEvent` and `AbilityEvent` share) only when applied; leave the field out otherwise, so monsters' events are unchanged.
- In `fell(target)` (or wherever a unit is downed), after the existing events: for every standing unit whose `taunted` has `source === target.id`, end it with `status_end` reason `source_fell`. Units in roster order.
- `StatusEndEvent.reason` gains `'source_fell' | 'moved'`.

### 4.4 Rooted (`battleEngine.ts`)

- `UnitRecord.moved: boolean` and `UnitSnapshot.moved`: set false for every unit of a side as that side's turn begins (in `startTurn`); set true when a unit takes a step.
- On `end_turn` for side S, **before** `countDownStatuses(S)`: every standing unit of S whose stats' `traits` include `rooted` and whose `moved` is false gets `rooted` laid for 2 turns, logged by one `StatusLaidEvent { type: 'status_laid', unit, status: 'rooted', turns: 2, cause: 'rooted' }` per unit, in roster order. The count-down then leaves 1, which lasts through the enemy's turn and ends after the unit's next turn unless it moves.
- In the move loop, on the **first step** of a move by a unit carrying `rooted`: end it (`status_end` reason `moved`) before the free attacks of that step are worked out and rolled, so those free attacks see the unit without Rooted's AC.
- `StatusLaidEvent` joins `BattleEvent`. `cause: 'shadowdancer'` is in the union for step 19 and unused here.

### 4.5 Pin (`battleEngine.ts`)

- `reachable(actor)` returns no hexes (beyond none to move to) for a unit carrying any status whose rule has `immobile`, so `legalActions` lists no move for it and a `move` action for it is refused as illegal.
- Nothing else changes for a pinned unit: its attacks, casts, abilities and free attacks are as before (a pinned unit still provokes nothing, as it cannot move).
- The pin itself is step 09's strike `status` (laid on a hit that leaves the foe standing, `turns: 1`), counting the unit's own next turn.

### 4.6 Saves and snapshots (`src/game/save.ts`, `battleEngine.ts`)

- `SAVE_VERSION = 24`. `parseSave` accepts 23 and loads it as is (no game migration); 18 and 22 keep their migrations and land at 24.
- `BattleEngine.restore` fills `moved: false` on any unit record lacking it, so a saved battle of version 22 or 23 restores.
- `snapshot()` carries `moved` and every status's `source`.

### 4.7 Log lines (`formatEvent`)

- The Taunt `AbilityEvent`: "Aldric taunts 2 foes." (the count of units the status was laid on; "1 foe" singular).
- `status_laid` with cause `rooted`: "Aldric holds his ground (rooted)."
- A strike that lays `pinned`: "Goblin is pinned." (follow how other strike-laid statuses are told).
- `status_end` with `source_fell` and `moved`: short lines of the same voice ("Goblin is no longer taunted.", "Aldric is no longer rooted.").

### 4.8 Exclusions

- The policy's use of Taunt and the taunted-unit focus are step 12; its Pin targeting is step 12's technique scoring.
- No node in `PERKS` yet carries `trait: 'rooted'` or `ability: 'taunt' | 'pin' | 'pinning_shot'` (step 13). Tests build stats or characters directly.
- Battle scene marks and effects are step 14; this step changes no scene, so `npm run test:browser` is not required (run it if any scene file is touched to compile).

## 5. Verification

### Tests (in `npm test`)

In `src/engine/battleEngine.test.ts`, with scripted RNG or fixed seeds, units built with stats carrying the new fields:

1. **AC5, Taunt:** a unit taunted by A attacking B (not A) has its chance 25 lower than the same attack untaunted, and the `AttackEvent` carries `tauntPenalty: 25`; attacking A carries none. The same for a hostile spell's `CastOutcome` and a rolled area ability's outcome at a non-source, and for a free attack. `previewAttack` shows the lowered chance.
2. **Taunt's area:** using `taunt` lays `taunted` with `source` on every foe within 2 hexes and no ally, draws nothing from the RNG (scripted RNG with no rolls), logs one `AbilityEvent`, and recharges for 2 rounds.
3. **Newer taunter:** a second taunter overwrites `source` and keeps the longer duration.
4. **Source falls:** when the taunter falls, `taunted` ends on each unit it taunted with `status_end` reason `source_fell`; a unit taunted by another taunter keeps its status.
5. **AC5, Rooted:** a unit with trait `rooted` that ends its turn without moving gets a `status_laid` event (cause `rooted`, turns 2) before the side's count-down; through the enemy's turn its `effectiveStats` show +10 AC and +2 resistance; a unit without the trait, or one that moved, gets none.
6. **Rooted ends on the first step:** on its next turn, the first step ends `rooted` (reason `moved`) and a free attack provoked on that step is rolled against the AC without Rooted (assert the event's chance).
7. **Rooted lapses:** unmoved, it ends after the unit's next turn as any 1-turn status does (or is laid again if it again does not move).
8. **AC5, Pin:** a hit by `pin` that leaves the foe standing pins it; on the foe's next turn `legalActions` lists no move for it, while it can attack an adjacent unit and make a free attack; the status ends after that turn. **Pin spends 3 mana and the weapon's AP + 1**: the event's `manaCost` is 3, `apCost` is `attackApCost + 1`, and the unit's mana and AP fall by those. `pinning_shot` likewise with a ranged weapon.
9. **Immobile:** a `move` action for a pinned unit is refused.
10. **Snapshot round-trip:** a battle snapshotted with `moved` true on a unit and a `taunted` status with `source`, restored, plays on to the same events as the unsnapshotted engine; a snapshot without `moved` restores with `moved` false.
11. **Monsters unchanged:** the existing replay tests pass untouched.

Elsewhere:

- `src/character/perks.test.ts` or `character.test.ts`: `traitsOf` and `deriveCombatStats` emit `traits` from a node with `trait` (a test-local perk table entry or a stubbed node), and none for a hero without.
- `src/game/save.test.ts`: `SAVE_VERSION` is 24; a version-23 save (built by writing one and setting its version, or a captured string) loads; v18 and v22 fixtures still load.
- Policy note for step 12: the AC5 clause "the policy attacks the taunter" is tested there.

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run src/engine/battleEngine.test.ts
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run scripts/simulate.test.ts -t "refactor guard"
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test
```

### Acceptance

- AC5's engine half met by tests 1, 5 and 8 (the policy half is step 12).
- The refactor guard is green with its fixture unchanged.
- `npm test` passes.

## 6. Completion criteria

- [ ] `taunted`, `pinned`, `rooted` in `STATUSES`; `StatusRule.immobile`; `ActiveStatus.source`.
- [ ] `TRAIT_IDS`, `TraitId`, `CombatantStats.traits`, `traitsOf`, `deriveCombatStats` emitting traits.
- [ ] `TAUNT_PENALTY` applied to every hostile roll at a non-source, recorded as `tauntPenalty`; `source_fell`.
- [ ] `UnitRecord.moved`; Rooted laid before the count-down with `StatusLaidEvent`; ended by the first step before its free attacks.
- [ ] Pinned units have no legal move; reactions untouched.
- [ ] `SAVE_VERSION` 24; version 23 loads; `restore` defaults `moved`.
- [ ] `formatEvent` lines; tests 1–11 pass; guard green unchanged; `npm test` passes.
- [ ] `CLAUDE.md` updated (the battle-system rules: Taunt, Rooted, Pin; the status list; `UnitRecord` fields; the save version in the rules of saving; `StatusLaidEvent` among the events).
- [ ] Committed as "Skill trees step 11: Taunt, Rooted and Pin"; the index's step table shows `done (<commit>)`.

## 7. Execution record
