# Step 12: The policy uses techniques

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R10; §5.5 the AI; §4.5 Taunt, Rooted and Pin in play; §8.3 risk "the AI under-uses actives") · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step changes the `aggressive` policy, which both sides of every battle choose by, the game's enemy and the simulator's heroes alike. A slip in the order of its steps, or in how a monster's existing choices are scored, moves every battle; the technique scoring decides whether the simulator's heroes use what the trees give them, which the whole of stage 4's balance rests on.

## 1. Objective

The `aggressive` policy uses hero techniques (stage 2's abilities, C11): it weighs a technique against a plain attack on equal AP, uses Taunt and Hunter's Mark when they pay, Sprints to close when that is the only way to strike this turn, and a Taunted unit turns on its taunter. Monsters, which have none of the new actives, choose exactly as before.

No hero in the simulator or the game has a technique yet (the nodes join `PERKS` in step 13), so play is unchanged and the refactor guard stays green. The new branches are proved on staged states whose heroes carry abilities directly in their stats.

## 2. Requirements and context

- **R10:** the `aggressive` policy uses hero actives, Taunt and Pin included.
- **AC5 (part):** Taunted foes take −25 to hit against anyone but the taunter, *and the policy attacks the taunter*. The engine half is step 11's; the policy half is this step's.
- **Design §8.3 risk:** the AI under-using actives makes the simulator's heroes look weaker than a player's. A policy fix is preferred to inflating numbers, so the scoring below must give a technique its due.

### The policy's full order (design §5.5)

`aggressive` keeps its order and gains steps. **Bold** = this step; *italic* = step 21's (not built here: leave no stub that changes behaviour); plain = existing.

1. *reviveCast* (step 21)
2. healCast (existing; Lay on Hands is a heal, already handled as one)
3. *purifyCast* (step 21)
4. guardCast (existing)
5. **tauntUse**
6. *supportCast* (step 21)
7. areaCast (existing)
8. blessCast, then *prisonCast* (step 21), sleepCast, curseCast (existing but prisonCast)
9. **markUse**
10. strikeCast (existing; Ice Lance's and Holy Light's scoring are step 21's)
11. bestStrike, **extended with technique scoring**
12. statusArea (existing)
13. **sprintUse**
14. closingMove (existing; **taunted rule** below)

Everything works over `legalActions`, `castTouches` and `areaTouches` as today. The policy never decides what is legal: a step only picks among the actions `legal` lists for the unit.

### The rules this step adds

**tauntUse (5).** Use Taunt (an ability whose `area` has `auto`, `foesOnly`, `centredOnSelf` and lays `taunted`) when the user is at half its hit points or more (`hp * 2 >= maxHp`) and either:
- two or more foes not already Taunted stand within its radius (as `areaTouches` reckons the action's area), or
- one such foe stands within its own `attackRange` of an ally (not the user) whose hit-point share (`hp / maxHp`) is below the user's.

**markUse (9).** Use Hunter's Mark (an ability with `foeStatus` laying `marked`) on the foe not already Marked, among those the legal actions offer, with the most hit points, when the user has the AP to mark and then attack: `ap − abilityApCost(markAbility) ≥ attackApCost`. Ties: roster order.

**Technique scoring in bestStrike (11).** A technique is an ability with `weaponAp` (C11). For each legal technique action at a foe:

```
score = (expectedHarm + statusValue − MANA_WEIGHT × manaCost) × attackApCost / abilityApCost(stats, ability)
```

- `expectedHarm`: over the technique's strikes, each strike's chance to hit (the unit's `toHit` + the strike's `toHit` + flanking and arc as for a plain attack, less the foe's AC, kept 5 to 95) times its mean damage (the weapon's dice and damage bonus for a `weapon` strike, plus `damageBonus`, through the foe's resistance as a plain attack's is), plus each strike's on-hit (the weapon's and the strike's `onHit`, `imbueDamage` added to entries with an element, each through the foe's ward; a bane entry only where `baneApplies`). Reuse `expectedHarm`, `onHitDamage` and `routineHarm`'s shape; a Cleave's second strike is scored on the foe it would go to (`spreads`: another foe in reach if one stands, else the same).
- `statusValue`: for a status the technique lays on a hit, `STATUS_VALUE[status] × chance to hit`, and only if the target does not already have it. `seared` is valued at the target's `regeneration` (0 without it).
- `MANA_WEIGHT` is 0.5; `manaCost` is 0 for an at-will technique.
- A plain attack and a monster routine score their expected harm as today (a plain attack's AP is its own `attackApCost`, so the factor is 1). The technique is chosen only when its score is strictly higher than the best plain attack's or routine's; on a tie the plain attack or routine stands (the existing routine-wins-a-tie rule between routine and attack is unchanged).
- **Heal reserve.** A mana technique is never chosen if paying for it would leave the unit below its heal reserve (`manaReserve`: the cost of the cheapest heal it knows, 0 if none): `mana − manaCost ≥ reserve`.
- **Area techniques** (Volley, Consecrate: an ability whose `area` has `weaponDamage` or `bane`, or `foesOnly` with damage) are scored by `areaHarm`, extended to the weapon's dice and damage bonus (`weaponDamage`), resistance (`throughResistance`), bane (doubled dice against a unit `baneApplies` to), touching foes only (`foesOnly`), less `MANA_WEIGHT × manaCost`, under the same heal-reserve rule, and compared with the best strike as areas are today.
- Monster routines and areas score exactly as today: none of them sets a new field, and the formula's new terms are 0 for them.

**sprintUse (13).** Use Sprint (an ability with `selfStatus` laying `hasted`) when no foe is within the unit's reach now, and the closing move cannot end with AP to strike, but could with 3 more AP (`hasted`'s +3). "Could" is judged as `closingMove` judges its walk: over `reachable` hexes, one from which a foe is within `attackRange` with `ap − moveCost ≥ attackApCost` after adding 3.

**Taunted units.** For a unit with a `taunted` status whose `source` stands (step 11's `ActiveStatus.source`), every step above that has a hostile candidate on the source keeps only its candidates on the source (a step with none on the source is judged on its other candidates as before, so a heal or guard still happens). `closingMove` closes on the source rather than the nearest foe.

### Decision from the index (unchanged)

2. **The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.

### Contracts (copied unchanged from the index)

**C16. The policy (steps 12 and 21)** — produced here (step 12's part):

Design §5.5's order. Step 12 adds `tauntUse` (5), `markUse` (9), technique scoring in `bestStrike` (11), `sprintUse` (13) and the taunted-unit rule. Step 21 adds `reviveCast` (1), `purifyCast` (3), `supportCast` (6), `prisonCast` (8), and Ice Lance's and Holy Light's scoring in `strikeCast` (10).

```ts
// src/engine/policies.ts
export const STATUS_VALUE: Partial<Record<StatusId, number>>   // chilled 3, slowed 3, pinned 3, poisoned 7, baned 4; seared = the target's regeneration
export const MANA_WEIGHT = 0.5
```

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

### Shared constraints (from the index)

- **Environment.** System Node is 22; prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH` (or use the podman `make` targets).
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run src/engine/policies.test.ts` for this file; `npx vitest run --project domain`.
- **The refactor guard** must stay green unchanged (decision 2): no simulated unit has a technique yet. A mismatch is a bug in this step.
- **Determinism.** Policies draw from `rng` only where they already do; add no draw. The policy is a pure function of `{ state, legal, rng }`.
- **Domain first.** Everything here is Phaser-free in `src/engine/`.
- **`tsc` is the linter** (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `.ts` extensions).
- **No measurement or tuning** in this step; the simulator is run only through the guard test.
- **Commits.** One commit once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 12: the policy uses techniques". No attribution lines.
- **Docs.** Update `CLAUDE.md`'s `policies.ts` paragraph (the `aggressive` order, technique scoring, Taunt, Mark, Sprint, taunted units); search it for any name you rename.

## 3. Dependencies and prerequisites

- **Step 09 (done):** the `Ability`/`Strike` extensions, `abilityApCost`, the technique strikes through `attack()`, self- and foe-status abilities in `legalActions` (self at the user's own id; foe-status at each standing foe in range), `marked` and `slowed`, `imbueDamage`.
- **Step 10 (done):** the `AreaAttack` extensions; Volley, Consecrate and Taunt's area (`centredOnSelf` areas listed at the user's hex only); `areaTouches` honours `foesOnly`.
- **Step 11 (done):** `taunted` with `ActiveStatus.source`, `pinned`, `rooted`, `UnitSnapshot.moved`, `TAUNT_PENALTY`.
- **Existing code** (`src/engine/policies.ts`, inspected at `50fb4cf`): `aggressive` runs `healCast ?? guardCast ?? areaCast ?? blessCast ?? sleepCast ?? curseCast ?? strikeCast ?? bestStrike ?? statusArea ?? closingMove` per unit in roster order; `castsOf`/`CastOption.withinReserve` and `manaReserve` (the cheapest heal known); `expectedHarm`, `onHitDamage`, `routineHarm`, `bestStrike` (attacks and routines by expected harm, a routine winning a tie, then damaging areas by `areaHarm` above the best strike), `statusArea`, `closingMove`, `reach`, `best`. `POLICIES` registers `aggressive` and `random`.
- No node teaches a technique until step 13, so only staged states exercise this step.

## 4. Scope and implementation guidance

### 4.1 `src/engine/policies.ts`

- Export `STATUS_VALUE` and `MANA_WEIGHT` (C16).
- Add `tauntUse`, `markUse`, `sprintUse` and insert them at positions 5, 9 and 13 of the chain. Identify each ability by its data (Taunt: area with `auto` laying `taunted`; Mark: `foeStatus` laying `marked`; Sprint: `selfStatus` laying `hasted`), not by id, so a later ability of the same shape is used the same way.
- Extend `bestStrike` with the technique score, the heal-reserve check and the area-technique terms of `areaHarm`. Keep the existing comparison for attacks and routines byte-for-byte in effect: a state with no technique must choose exactly as before.
- **Taunted filter.** A helper that, for a unit whose `taunted` source stands, narrows each step's hostile candidates to those on the source (`target === source`, or for an area or hostile cast, those whose touched foes include the source), falling back to the unfiltered list only for steps whose candidates are not hostile. `closingMove` takes the source as its goal.
- Use `abilityApCost` for every ability's AP; never read `apCost` directly for a hero ability.
- Leave step 21's steps unbuilt; do not add placeholders that change the chain.

### 4.2 Exclusions

- No engine change (if one is missing, stop and report: steps 09–11 own the engine).
- No nodes, plans or bandit changes (step 13); no scene change; no simulator change (step 15).
- Do not change how monsters score (decision: "Monster routines and areas score exactly as today").

## 5. Verification

### Tests (in `npm test`, `src/engine/policies.test.ts`)

Staged states: hero units whose stats carry `abilities` (and `magic` with mana where a mana technique is tested) directly, foes as in the existing policy tests. Use a scripted or seeded RNG as the file already does.

1. **Technique against plain attack.** A hero with Power Attack: chosen when its AP-normalised score is higher than a plain attack's (an armoured foe it reaches either way); not chosen when equal or lower (a foe with high AC where −10 to hit costs more than +6 damage gains). Assert the exact score in one case by hand.
2. **Status value.** Venom Strike scores `STATUS_VALUE.poisoned × chance` against an unpoisoned foe and none against a poisoned one; Flame Strike's `seared` is worth the target's regeneration.
3. **Heal reserve.** A hero knowing Heal (cost 4) with mana 6 and Pin (3 mana) does not choose Pin (6 − 3 < 4); with mana 7 it may.
4. **Area techniques.** Volley and Consecrate scored by the extended `areaHarm`, chosen over a strike only when higher; Consecrate never counts an ally.
5. **tauntUse.** Chosen with two untaunted foes in radius at ≥ half HP; chosen with one foe within its range of a more-wounded ally; not chosen below half HP, nor with every foe in radius already taunted, nor with one foe threatening only the user.
6. **markUse.** Marks the unmarked foe with most HP when AP allows mark + attack; skips it when not; never re-marks.
7. **sprintUse.** Chosen exactly when no foe is in reach and only +3 AP lets the closing move end with AP to strike; not when a foe is in reach, nor when +3 AP would not suffice.
8. **Taunted units.** A taunted unit with legal attacks on the source and on another foe attacks the source; a taunted caster's hostile spell is aimed at the source; with the source out of reach it closes on the source rather than the nearest foe; with the source fallen it chooses as before.
9. **Monsters unchanged.** Record, before changing the policy, the action chosen in every existing policy test state (and in a set of the encounters' opening states: each of `ENCOUNTERS` against the ready-made party at a threat in its band, a few turns played with a seeded RNG); after the change the same choices come out. Keep it as a test (a snapshot of choices).

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run src/engine/policies.test.ts
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test          # includes the refactor guard, unchanged
```

`npm run test:browser` is **not** required: this step changes no scene.

### Acceptance

- Every rule of §2's "The rules this step adds" has a test that passes.
- The refactor guard passes with its fixture untouched (`git diff --stat scripts/` shows no fixture change).
- `tsc` clean.

## 6. Completion criteria

- [x] `STATUS_VALUE`, `MANA_WEIGHT`, `tauntUse`, `markUse`, `sprintUse`, technique scoring and the taunted rule in `policies.ts`, in design §5.5's positions.
- [x] Tests 1–9 pass; `npm test` passes with the guard fixture unchanged.
- [x] `CLAUDE.md`'s `policies.ts` paragraph updated.
- [x] One commit "Skill trees step 12: the policy uses techniques".
- [x] `index.md`: step 12's status `done (<commit>)`.
- [x] Execution record filled: evidence (commands and results), deviations, anything step 13 or 21 should know (e.g. scoring weights that look off on staged states, for stage 4's levers).

## 7. Execution record

**2026-11-14, engineer (opus).**

What now works: `aggressive` runs heal, guard, **tauntUse**, area, bless, sleep, curse, **markUse**, strike spell, **bestStrike with techniques**, status area, **sprintUse**, closing move (design §5.5, step 21's steps left out). `STATUS_VALUE` and `MANA_WEIGHT` exported, and `techniqueScore(state, self, ability, target)` (exported for the hand-computed test). Taunt, Mark and Sprint are recognised by their data (`isTaunt`, `isMark`, `isSprint`), never by id; every ability's AP through `abilityApCost`. `bestStrike` scores plain attacks and routines exactly as before, then lets a technique in only on a strictly higher score (the first of the highest), then areas (monster areas, Volley, Consecrate) above `max(0, best)`; a mana technique or area under the heal reserve is not weighed. `areaHarm` takes the weapon's dice (`weaponDamage`, without `abilityDamageBonus`), resistance (`throughResistance`), doubled dice where `bane` applies, and Taunted's penalty. The taunted rule: `tauntSource` (the standing source of `taunted`); `best` gained an optional `onSource` predicate that prefers the first highest candidate on the source; `bestStrike` narrows strikes and positive areas to the source when any is on it; `closingMove` and `sprintUse` close on the source (`goals`). `expectedHarm` and `areaHarm` take `tauntPenalty` off the chance. `statusArea` now skips `auto` areas (Taunt has its own step) and weapon-dice areas. The isTechnique filter is gone.

Carried note from step 04 done here: `reach` prices a caster's damaging spell by `spellApCost` (Quickened Casting), with a test that tells the two apart; the guard did not move.

Commands and results:

- Before any policy change, a snapshot of choices was recorded: `aggressive` both sides over every encounter at every threat of its band, the ready-made party raised to the threat's level, seeds 1–3, up to 8 rounds: 4790 actions, SHA-256 `176ecb43…3e6b`, kept as the test "the choices of today's encounters" (test 9). It passed unchanged after the change.
- `npx vitest run src/engine/policies.test.ts` — 67 passed (the interim "until step 12" pair replaced by 23 new tests, plus the snapshot).
- Mutation check (each disabled in turn, file restored after): the taunted filter (3 tests fail, after strengthening the attack test so that Taunted's penalty alone cannot decide it), the old `reach` (1), resistance in `areaHarm` (2), bane (1), the heal reserve (1), Taunt recognition (2), Taunt back in `statusArea` (1).
- `npx vitest run scripts/simulate.test.ts -t "refactor guard"` — passed; `git diff --stat scripts/` empty.
- `npm test` — tsc clean; 86 files, 1782 tests passed. (The snapshot test takes ~5 s alone; it has a 60 s timeout, as the full parallel run timed it out at the default 5 s.)
- `npm run test:browser` not run: no scene changed.

Deviations:

- Test 3 (heal reserve): Heal costs 3 mana in `SPELLS`, not 4, so the test uses mana 5 (5 − 3 < 3: no Pin) and 6 (may Pin), rather than 6 and 7.
- Test 1's "not chosen when equal" is tested as "lower" only: an exact tie in floating point (e.g. 0.4 × 14 × 5/7 against 0.5 × 8) is not exact, so a tie test would hang on rounding. The code's tie rule is `score > bestHarm` (strict).
- `techniqueScore` exported besides C16's two constants, for the hand-computed score.

For steps 13, 21 and stage 4 (levers seen on staged states):

- Area techniques are not AP-normalised (as specified): Volley (bow 4 + 2 = 6 AP) is weighed by raw harm against one 4 AP shot, though a bow at 8 AP shoots twice; on two clustered foes it wins at about twice a shot's harm. Consecrate likewise (5 AP fixed). If the simulator over-volleys, normalise areas too.
- Hunter's Mark has no value check beyond AP (mark then attack); it is used whenever legal and a foe is unmarked, before the strike spell and the best strike.
- A taunted unit with its taunter out of reach but another foe in reach strikes that foe (at −25), as the rule says a step with no candidate on the source is judged on its others; only the closing move goes for the taunter.
- `tauntUse` reads a foe's `attackRange` (where it can strike from now), not how far it could walk and strike.
- Commit: `c920348` Skill trees step 12: the policy uses techniques.

