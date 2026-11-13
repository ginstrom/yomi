# Step 10: Area techniques

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (§4.3 Volley, Consecrate, Taunt; §5.3 `AreaAttack`; §5.4 RNG order, "Hero ability use", "Taunt") · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step extends the engine's area resolution (`areaAttack`), which the monsters' Web and Fire Spit already use: a slip in the order of draws or in who an area touches changes monster battles and breaks the refactor guard, which must stay green.

## 1. Objective

Heroes' area techniques work in the engine. `AreaAttack` gains seven optional fields, and `ABILITIES` gains three entries:

- **Volley** (Ranger): the hero's weapon shot over an area, each unit touched rolled with `toHit`, the damage through resistance as a shot's.
- **Consecrate** (Paladin): a burst on the user that strikes only foes, half on a miss, double dice as bane, resistance ignored.
- **Taunt** (Heavy Knight): a burst on the user that, with no roll, lays `taunted` on every foe within 2 hexes.

Taunt's status id `taunted` enters `STATUS_IDS` in this step with a rule that does nothing yet (name, mark and colour only), as C6 says; **step 11 adds its rule** (the −25 to hit, `source`, `source_fell`).

No hero holds these abilities yet (the nodes enter `PERKS` in step 13), so play is unchanged and the guard stays green.

## 2. Requirements and context

- **R7** (Taunt in the engine, its area here), **R8** (the other mechanics; battles stay deterministic from their seed), **AC6** (each mechanic of design §5.4 has an engine test, and the replay tests still pass).
- **Numbers (design §4.3):**

| Ability (id) | Path, tier | AP | Mana | Recharge | Needs | Area | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Volley (`volley`) | Ranger T3, Archery 55 | wAP+2 (`weaponAp: 2`) | — | 2 | ranged | burst, radius 1, centre within the weapon's range (`weaponRange`) | Everyone within 1 hex of the centre (allies too) takes the weapon's dice and damage bonus, each unit rolled with `toHit`, the damage through resistance as a shot's (`weaponDamage`, `throughResistance`). No half on a miss. |
| Consecrate (`consecrate`) | Paladin T3, Melee 55 | 5 (`apCost: 5`) | 5 | 2 | — | burst, radius 1, centred on the user (`centredOnSelf`, range 0) | Every **foe** within 1 hex (`foesOnly`) takes 2d6, rolled with `toHit` against AC: half on a miss (`halfOnMiss`), double the dice as bane (`bane`), resistance ignored as an area's is. |
| Taunt (`taunt`) | Heavy Knight T2, END 5 | 3 (`apCost: 3`) | — | 2 | — | burst, radius 2, centred on the user | Needs no roll (`auto`): every foe within 2 hexes (`foesOnly`) is `taunted` for 1 turn. |

- **`AreaAttack` fields (design §5.3):**

```ts
weaponDamage?: true    // the unit's weapon dice and damage bonus (Volley)
weaponRange?: true     // range is the unit's attackRange (Volley)
throughResistance?: true // each hit's damage goes through resistance as a shot's (Volley)
foesOnly?: true        // touches only foes (Taunt, Consecrate)
auto?: true            // no roll: lays the status on every foe touched (Taunt)
bane?: true            // doubles the dice against baneApplies (Consecrate)
centredOnSelf?: true   // aimed only at the user's hex (Taunt, Consecrate); range 0
```

- **RNG order (design §5.4):** Volley and Consecrate resolve as `areaAttack` does today, in roster order: for each unit touched, one roll to hit, then the dice on a hit (or on a miss with `halfOnMiss`). Taunt (`auto`) draws nothing. A field left out changes nothing: Web and Fire Spit resolve exactly as today.
- **Edge cases:** Volley touches allies (and the user if within 1 of the centre), as every hostile area does (design §8.2). A `foesOnly` area never touches the user's side, so it is legal wherever it touches a standing foe; Taunt and Consecrate, centred on the user, are legal only when at least one standing foe is within their radius. A Volley's `weaponRange` centre may be any board hex within the weapon's range (as a burst's today), touching at least one standing foe. Bane doubles the dice count (2d6 → 4d6), not the bonus, and only against `baneApplies` (regeneration or `blightborn`). `throughResistance` uses the shot's piercing only (`rangedPierce`, never melee piercing), as `damageThrough` with the shot's `effectiveResistance`; a hit that rolled anything does at least 1.

### Decisions from the index (unchanged)

- **2. The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
- **5. Mana in technique events.** An `AttackEvent` (the first strike only) or `AbilityEvent` of an ability with a `manaCost` carries `manaCost` and `manaAfter`, as a `CastEvent` does (C11).
- **8. `LOG_SCHEMA_VERSION`** 25 from step 09 (the first stage-2 step to change an event); steps 10 and 11 change shapes under 25. 26 from step 17; steps 18 to 20 under 26.

### Contracts (copied unchanged from the index)

**C11. Hero abilities (steps 09 and 10; consumed by 11–15, 17, 21):**

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

**C6 (the part this step touches):** `STATUS_IDS` gains `'taunted'` here, its id and a no-effect rule (`{ name: 'Taunted', adjective: 'taunted', mark: 'T', colour: <a red> }`), so that `taunt` can be built; step 11 adds `TAUNT_PENALTY` and `ActiveStatus.source`.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets.
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npx vitest run --project domain`.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`): **this step must keep it green unchanged** (decision 2). Do not edit the fixture.
- **Determinism.** A battle replays from its seed. New rolls draw from the RNG in the order design §5.4 fixes; a passive that rolls nothing draws nothing. A unit whose stats carry none of the new fields behaves exactly as today.
- **Domain first.** Every rule lives in the Phaser-free modules with tests; scenes decide nothing.
- **A node is data.** A new ability is one entry in `ABILITIES`.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 10: area techniques". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines this change makes wrong and search it for every name renamed or removed.

## 3. Dependencies and prerequisites

- **Step 09 (done first)** provides: `Ability.manaCost`, `weaponAp`, `needs`, `selfStatus`, `foeStatus`; the `Strike` extensions; the 14 non-area hero ids in `ABILITY_IDS` and their `ABILITIES` entries (this step inserts `taunt`, `volley` and `consecrate` at their C11 places); `abilityApCost`; `canUse` checking `needs`, mana and `abilityApCost`; mana paid as the action begins; `AttackEvent`/`AbilityEvent` `manaCost`/`manaAfter`; `LOG_SCHEMA_VERSION` 25; statuses `marked` and `slowed`; `CombatantStats.imbueDamage`; `knownAbilities` in perks.ts. Read its execution record for any deviation.
- **Existing code, for reference:**
  - `src/combat/abilities.ts`: `AreaAttack` (`shape`, `range`, `radius?`, `damage?`, `element?`, `status?`, `halfOnMiss`); `spider_web` (status-only burst) and `fire_spit` (cone with damage).
  - `src/engine/battleEngine.ts`: `legalActions` lists an area ability's centres in board order where it touches a standing foe; `canUseArea` (about line 1179) checks `canUse`, the board and the range; `areaAttack` (about line 1540) sets the recharge, rolls each unit touched in roster order with the unit's `toHit` through `strikeUnit` (shared with `cast`), half on a miss with `halfOnMiss`, element cut by wards, resistance ignored; records an `AbilityEvent` with `CastOutcome`s; `aftermath` lays statuses and fells. `areaTouches`/`castTouches` decide who an area touches.
  - `src/combat/combat.ts`: `baneApplies`, `damageThrough`, `effectiveResistance`, `isMelee`, `rangedPierce`.
  - `src/engine/policies.ts`: the aggressive policy scores areas with `areaHarm`; it must not start using the hero areas in a way that changes monster choices (no monster has them).

## 4. Scope and implementation guidance

### 4.1 `abilities.ts`

- Add the seven optional `AreaAttack` fields (C11), each documented.
- Add the entries `taunt`, `volley`, `consecrate` with the numbers of §2, in their `ABILITY_IDS` positions (C11's order). Write `description`s in the house style ("Lays Taunted on every foe within 2 hexes for a turn: they strike others at −25."). Volley's `area` has no `damage` (it takes the weapon's) and `weaponRange` (its `range` field is then ignored; set it to 0 and say so). Consecrate's `damage` is 2d6, `halfOnMiss: true`, `bane: true`.

### 4.2 `spells.ts`

- `'taunted'` in `STATUS_IDS` and a no-effect `STATUSES.taunted` rule (mark `T`, a red). Step 11 gives it its effect. Check that nothing enumerating statuses (nameplates, `describeStatuses`, save validation) breaks.

### 4.3 The engine

- **Legal centres.** `centredOnSelf`: only the user's hex is a legal `at`. `weaponRange`: the range is `effectiveStats(actor).attackRange`. The rule "touches a standing foe" stays; with `foesOnly` an area touches only the user's foes (the user's side, itself included, is never touched). `legalActions` lists them as today (abilities after casts, centres in board order).
- **Touch.** `foesOnly` filters what `areaTouches` returns for the ability (and therefore the policy's and the scene's view of it).
- **Resolution, in roster order:**
  - `auto`: no roll, no draw: the status is laid on every unit touched; each outcome is status-only (no hit roll, no damage) in the `AbilityEvent`. Decide and document how the outcome marks "no roll" (for example `roll: null`/`hit: true`), keeping `CastOutcome`'s existing fields meaningful; any new field is an event shape change under `LOG_SCHEMA_VERSION` 25 (decision 8), so no further bump.
  - `weaponDamage`: dice and damage bonus are the user's weapon's (`stats.damage`); `abilityDamageBonus` is not added (it is the monsters' level step). A critical doubles the dice as a weapon hit's would only if the existing area path already rolls criticals; do not add critical rolls the area path lacks (state which in the record).
  - `throughResistance`: each hit's damage goes through the target's resistance as a shot's (shot piercing only), at least 1 when anything was rolled; on-hit runes are **not** added (an area is not a weapon blow; say so in the description comment).
  - `bane`: the dice count doubles against a target `baneApplies` to.
  - Mana: Consecrate's 5 mana is paid as the action begins, as step 09 pays it; `AbilityEvent.manaCost`/`manaAfter` record it.
- The recharge, AP payment, facing and `aftermath` stay as `areaAttack` does them.
- `previewCast`-style odds for an area ability (if the engine exposes them for abilities) account for `auto` (certain) and `foesOnly`.

### 4.4 The policy

No new step (that is step 12). Make sure the existing area scoring (`areaHarm`, the status-area step) does not throw or misjudge on the new fields for a unit that has them; a test with a hero holding `volley` only needs to show the policy returns a legal action. Monster choices must not change (the guard proves it).

### 4.5 Exclusions

- Taunt's effect on rolls, `source`, `source_fell` (step 11). Rooted, Pin (step 11). The policy's `tauntUse` and technique scoring (step 12). Nodes in `PERKS` (step 13). The Skills menu, looks and log lines beyond `formatEvent` not throwing (step 14).

## 5. Verification

### Tests (in `npm test`)

In `src/engine/battleEngine.test.ts`, with a scripted RNG and stats built by hand (a hero `CombatantStats` with `abilities: ['volley']` etc. and, for Consecrate, `magic`/mana as step 09 requires):

1. **Volley:** wAP+2 spent (a bow of 4 AP → 6); legal centres are exactly the hexes within the bow's `attackRange` touching a standing foe; two foes and one ally within 1 of the centre are each rolled in roster order with the archer's `toHit` (scripted draws consumed in that order: to-hit, then dice per unit); damage is the bow's dice + bonus, less resistance (an armoured foe takes `damageThrough`), at least 1; the ally is hit too; recharge 2 set.
2. **Consecrate:** only the user's hex is legal; it is illegal with no foe adjacent; 5 mana and 5 AP spent (`manaCost`/`manaAfter` on the event); allies adjacent are untouched; a miss deals half the dice rounded down; against a troll (regeneration) the dice are 4d6; resistance ignored.
3. **Taunt:** only the user's hex; every foe within 2 is `taunted` for 1 turn, foes at 3 untouched, allies untouched; **no RNG draw** (a scripted RNG with no values does not throw); 3 AP; recharge 2; illegal with no foe within 2.
4. **Unchanged:** an existing Web and Fire Spit test still passes untouched; a replay of a battle with Volley and Consecrate from its seed gives the same events; a snapshot taken mid-battle and restored plays on identically.
5. `src/combat/abilities.test.ts`: the three entries carry the numbers of §2; every hero area ability's fields are consistent (`centredOnSelf` ⇒ range 0; `auto` ⇒ a status and no damage).
6. A policy test: a unit holding `volley` gets a legal action from `aggressive`.

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run src/engine/battleEngine.test.ts src/combat/abilities.test.ts
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test    # guard green, unchanged
```

No scene changes in this step, so `npm run test:browser` is not required (run it if a scene file had to change to compile, and record it).

### Acceptance

- The three area techniques resolve as §2 says, each shown by a test.
- No monster battle changes: the refactor guard passes with its fixture untouched.

## 6. Completion criteria

- [ ] `AreaAttack`'s seven fields and the `taunt`, `volley`, `consecrate` entries exist with design §4.3's numbers.
- [ ] `taunted` is a status id with a no-effect rule; the record says step 11 adds its rule.
- [ ] Engine tests for Volley, Consecrate and Taunt's area, the RNG order, replay and restore pass.
- [ ] `npm test` passes; the guard fixture is unedited and green.
- [ ] `CLAUDE.md` updated (the `abilities.ts` and engine `ability` lines: hero areas, `foesOnly`, `auto`, `centredOnSelf`, `weaponDamage`/`weaponRange`/`throughResistance`, `bane`).
- [ ] Committed as "Skill trees step 10: area techniques"; the index's step table shows `done (<commit>)`.

## 7. Execution record
