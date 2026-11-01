# Step 05: Area abilities

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-02-special-attacks-and-elements.md) (§2 "The engine", "The policy"; §3 S2-R2, S2-R4, S2-R5; §5; §6) · References: [campaign §4.2, §4.4, §5.4](../../designs/long-campaign/reference/campaign-to-level-20.md), [gear §4.6, §5.3](../../designs/long-campaign/reference/gear-and-runes.md)

**Difficulty:** intricate engine and policy logic (session model). The RNG draw order, half on a miss, wards and the policy's net-harm scoring all have to agree between the engine, the policy and the tests.

## 1. Objective

Monsters gain area attacks that recharge rather than cost mana:
- the `ability` action's `at` form, resolved over every unit the area touches;
- a new `AbilityEvent`, and `CastOutcome.half`;
- half damage on a miss, resistance ignored, wards applied;
- the two area abilities, `spider_web` and `fire_spit`, in `ABILITIES`;
- the `aggressive` policy choosing an area by net expected harm, and a status-only area (Web) when nothing else is chosen;
- the simulator's tally counting area attacks.

No stat block uses an area ability until step 08, so the campaign summary must be identical to step 04's.

## 2. Requirements and context

- **S2-R2:** area attacks in cone, line and burst, with recharge and half on a miss. They ignore resistance.
- **S2-R4** (for areas): an area's element is reduced by the target's ward; `warded` shows in the log.
- **S2-R5** (for areas): the policy uses areas by expected harm, sparing its own side, and respects recharge.
- **Design risks (§7):** a cone aimed by the policy can still hurt its own side (intended, but the ally penalty must work); half on a miss makes breath reliable, so recharges stay at 2 or more.
- **Corrections that bear on this step** (index):
  - **8.** `AbilityEvent` gains `distance`, as `CastEvent` has; an area's `damage` is optional (Web); `warded` is the points the ward stopped, with `damage` what was dealt.
  - **9.** An area's aims must touch a standing foe (the design says "a unit").
  - **10.** Recharge: N ≥ 1 sets the counter to N; it falls by 1 as the side's turn begins; usable at 0. (Built in step 04.)
  - **11.** The abilities' AP costs and numbers are first values; step 09 tunes them.
  - **13.** Net-harm scoring applies to area *abilities* only. The rule for hostile area *spells* (two foes or more, no ally) is unchanged.
  - **14.** Statuses are laid whatever a ward stopped.
  - **15.** `LOG_SCHEMA_VERSION` 20 → 21 in this step.

## 3. Dependencies and prerequisites

**Step 04 must be done** (it depends on 02 and 03). This step consumes, unchanged:

**From step 02 (C1):**

```ts
// src/grid/hex.ts
export type AreaShape = 'burst' | 'cone' | 'line'
export function areaOf(shape: AreaShape, origin: Hex, aim: Hex, range: number, radius = 0): Hex[]
// src/engine/battleEngine.ts
export interface AreaSpec { shape: AreaShape; range: number; radius?: number }
/** The standing units an area of `area` from `caster` aimed at `at` touches, in roster order: everyone if `hostile`, else the caster's side. */
export function areaTouches<U extends Placed>(units: readonly U[], caster: Placed, area: AreaSpec, at: Hex, hostile: boolean): U[]
```

- Burst: today's `areaHexes(aim, radius)`, in its order. Line: `range` hexes from `origin` towards `aim`, origin excluded. Cone: hexes 1 to `range` from `origin` within 30° of the direction to `aim`, ordered by distance, then `q`, then `r`. Cone and line are [] when `aim` is `origin`. `areaOf` returns hexes on or off the board; callers filter.

**From step 03 (C2, C6):**

```ts
// src/combat/combat.ts
export const ELEMENTS = ['fire', 'frost', 'lightning', 'acid', 'poison', 'blight'] as const
export type Element = (typeof ELEMENTS)[number]
// CombatantStats.wards?: Partial<Record<Element, number>>
/** Damage of `element` after `stats`' ward: max(0, damage − ward); damage of no element is unchanged. */
export function warded(damage: number, element: Element | undefined, stats: CombatantStats): number
```

- `CastOutcome` has `warded: number` (the points the ward stopped); `damage` is what was dealt after the ward. A warded outcome's log adds `(warded N)`.
- The policy's order (C6) after step 03: heal, guard, hostile area spell, Bless, Sleep, Curse, damaging spell of one foe, then (step 04) the best strike, then closing in.
- Statuses `webbed` (−4 action points) and `seared` exist in `STATUSES`; `poisoned` existed before.

**From step 04 (C4):**

```ts
// src/combat/abilities.ts
export type { AreaShape } from '../grid/hex.ts'
export interface Strike { name: string; verb: string; damage: DamageRoll; status?: StatusLaid }
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
  verb: string
  description: string
  apCost: number
  recharge: number
  strikes?: readonly Strike[]
  area?: AreaAttack
}
export const ABILITY_IDS = ['troll_claws', 'spider_bite', 'spider_web', 'fire_spit'] as const  // step 04 adds the first two, step 05 the last two
export type AbilityId = (typeof ABILITY_IDS)[number]
export const ABILITIES: Record<AbilityId, Ability>
// CombatantStats: abilities?: readonly AbilityId[]; abilityDamageBonus?: number
```

```ts
// src/engine/battleEngine.ts
export type Action = /* existing members */
  | { type: 'ability'; unit: UnitId; ability: AbilityId; target: UnitId }  // a routine (step 04)
  | { type: 'ability'; unit: UnitId; ability: AbilityId; at: Hex }         // an area (this step)
// UnitRecord and UnitSnapshot: recharging: Partial<Record<AbilityId, number>>
```

- Step 04 built: legality (the unit has the ability, `ap ≥ apCost`, not recharging), `legalActions` listing abilities after a unit's casts in its `abilities` order, payment (AP, `gearChangePaid` cleared, the counter set when `recharge` ≥ 1), the countdown in `startTurn`, routines, and the policy's best strike (each plain attack's `expectedHarm`, each routine's summed `expectedHarm`; a routine wins a tie). Step 04 left `ABILITY_IDS` as `['troll_claws', 'spider_bite']` and `LOG_SCHEMA_VERSION` at 20, `SAVE_VERSION` at 14.

**Produced here and consumed later:** `AbilityEvent` and `CastOutcome.half` (step 06 plays them back; step 08 gives the Spider and the Salamander `spider_web` and `fire_spit`); `Summary.avgPlayerAreaAttacks` and `avgEnemyAreaAttacks` (step 09 reads them).

**Environment:** the simulator runs only in podman (`make -s simulate ARGS="..."`); never two at once. Logs go under `logs/` (gitignored).

## 4. Scope and implementation guidance

### 4.1 The two abilities (`src/combat/abilities.ts`)

Append to `ABILITY_IDS`, in this order, and add to `ABILITIES`:

| Id | Name | Verb | AP | Recharge | Content |
| --- | --- | --- | --- | --- | --- |
| `spider_web` | Web | spins a web | 4 | 3 | area: burst, range 4, radius 1, no damage, lays Webbed 2 turns, `halfOnMiss: false` |
| `fire_spit` | Fire Spit | spits fire | 4 | 2 | area: cone, range 2, 3d6, fire, lays Seared 1 turn, `halfOnMiss: true` |

Write each a short `description` for the foe info panel and the manual (for example "A cone of fire 2 hexes long: 3d6, half on a miss, and no regeneration next turn"). No stat block takes them in this step.

### 4.2 The engine (`src/engine/battleEngine.ts`)

- **Types:** add `AbilityEvent` exactly as in C5, add it to `BattleEvent`, and add `half: boolean` to `CastOutcome` (false on every cast outcome; set it in `cast`):

  ```ts
  export interface AbilityEvent extends EventBase {
    type: 'ability'
    unit: UnitId
    ability: AbilityId
    /** The hex aimed at. */
    at: Hex
    shape: AreaShape
    /** Every hex of the area on the board, in areaOf's order. */
    hexes: Hex[]
    /** Hexes between the unit and `at`. */
    distance: number
    apCost: number
    apAfter: number
    /** The unit's facing after turning to its aim. */
    facing: number
    /** The unit's toHit, its statuses included: the chance before each target's armour class. */
    skill: number
    /** One for each unit touched, in roster order. */
    outcomes: CastOutcome[]
  }
  ```

- **Legal aims** of an area ability (also checked in `step`, which throws on an illegal one): `at` on the board; a burst with `hexDistance(at, unit) ≤ range`; a cone or line with distance 1 to `range`; and `areaTouches(units, unit, area, at, true)` includes a standing foe. `legalActions` lists an area ability at each legal aim in board order (row, then column), as area spells' centres are, in the unit's `abilities` order after its casts. Its touched units are what `areaTouches` returns (both sides).
- **Resolution,** after paying (AP, `gearChangePaid`, the recharge counter) and turning the unit to face `at` (`hexDirectionTowards`, as `cast` does), over each touched unit in roster order:
  1. `rollToHit` with an attacker whose `toHit` is the unit's effective `toHit` (`effectiveStats`), its own `critChance`, against the target's effective armour class, with no flanking, arc or helpless bonus;
  2. a hit on a mirrored unit strikes an image (`strikeImage`) and draws no dice;
  3. a hit otherwise draws the area's dice (`rollHitDamage`, doubled on a critical), adds `abilityDamageBonus`, then `warded(…, area.element, target stats)`; the ward's cut goes in `warded`;
  4. a miss, when `halfOnMiss` and the area has damage dice, draws the dice (not doubled), adds the bonus, halves rounding down, then `warded`, with `half: true`;
  5. an area without damage draws no dice;
  6. resistance is ignored (no `damageThrough`, no piercing);
  7. the area's status is laid on a hit (not an image) that left the unit standing, whatever the ward stopped (correction 14); never on a miss.
  Then, as `cast` does: a sleeper hurt awake, images spent, and the falls through `fellAll` (one battle end at most). The draws for each unit are made in this order, unit by unit, so a seeded battle replays.
- **Factor rather than copy.** `cast` and the area resolution share most of their work (the per-unit roll, image, wake and fall handling). A shared helper is welcome, but `cast`'s RNG draws for today's spells must stay exactly as they are (the summary must be identical).
- **`formatEvent`** renders an `AbilityEvent` as "Salamander spits fire: HITS Aldric for 9 dmg; MISSES Bryn, 4 dmg (half); HITS Kobold for 11 dmg." (the unit's name, the ability's `verb`, then each outcome as `hostileOutcome` gives it, with "(half)" for a half outcome and "(warded N)" for a warded one; a status laid is named as a cast's is, for example "Aldric is webbed"). With no outcome left to name, "…: it touches no one." as a cast's line does.
- **`LOG_SCHEMA_VERSION`** 20 → 21. Update the test that pins it.
- **Out of scope:** previews of abilities (`previewCast` has no ability twin; no hero has an ability), the scene's playback (step 06), stat blocks (step 08).

### 4.3 The policy (`src/engine/policies.ts`, C6 step 05)

- **An area ability with damage** scores its net harm over what `areaTouches` says it touches: for each unit, hit chance (`hitChance` of the unit's effective `toHit` against the unit's effective armour class) × `warded(mean, element, unit)`, plus, with `halfOnMiss`, (1 − hit chance) × `warded(floor(mean / 2), element, unit)`, where `mean` is the dice's mean plus `abilityDamageBonus`; added for a foe, subtracted for a unit of its own side. It is chosen when its net harm is above 0 and above the best strike's harm (the best plain attack's or routine's, 0 when none is in reach). Put it beside the best strike: the step-04 best-strike choice compares the three.
- **A status-only area ability** (no damage, such as Web) comes after the best strike and before closing in: used when it touches at least one foe not already under its status and no unit of its own side; the aim touching the most such foes first, the first in `legal` order on a tie.
- The order is then: heal, guard, hostile area spell, Bless, Sleep, Curse, damaging spell of one foe, the best strike (with areas), a status area, closing in. Recharge is respected because recharging abilities are not in `legal`. `reach` is unchanged.
- With no unit holding an area ability, every choice must be what step 04's policy chose.

### 4.4 The simulator (`scripts/simulate.ts`)

- The `Tally` adds each `AbilityEvent`'s outcomes' `damage` to the damage dealt by the unit's side (`sideOf`), and each outcome with a `status` to that side's statuses laid.
- `Summary` gains `avgPlayerAreaAttacks` and `avgEnemyAreaAttacks` (`AbilityEvent`s a battle per side); the printed summary shows them as area attacks used a battle, beside the casts. Update `scripts/simulate.test.ts` for the new fields.

### 4.5 CLAUDE.md

Update the lines this change makes wrong or incomplete: the engine's bullet (the `ability` action's area form, `AbilityEvent`, half on a miss, schema 21), the policies bullet (net harm for area abilities; the status area), the simulator's summary line (area attacks), and the battle rules paragraph's sentence on spells ignoring resistance, if area attacks belong beside them. Keep each to a line; step 09 makes the full pass.

## 5. Verification

- **`src/engine/battleEngine.test.ts`** (with stat blocks built in the test that carry `fire_spit` or `spider_web`, and scripted or seeded RNG):
  - a cone, a line and a burst area each touch exactly the units on `areaOf`'s hexes, both sides, the user excluded, in roster order, with `hexes` filtered to the board;
  - a hit deals the dice plus `abilityDamageBonus` with no cut for resistance (a target with resistance 4 takes the full roll);
  - a miss with `halfOnMiss` deals half the dice, rounded down, with `half: true` and no status; a miss without it deals 0;
  - a ward cuts an area's element (a fire ward 99 takes `fire_spit` to 0, with `warded` the points stopped) and a status is still laid on that hit;
  - a critical doubles the dice; a mirrored unit's hit strikes an image and draws nothing;
  - Web (no damage) lays Webbed on a hit and draws no dice;
  - legality: an aim that touches no foe is neither listed nor accepted by `step`; a cone or line aimed at the user's own hex is illegal; a burst beyond `range` is illegal; a recharging area is not listed, and listed again once its counter runs out (`fire_spit`, recharge 2: used on round 1, not listed on round 2, listed on round 3);
  - AP paid, the facing turned to `at`, `distance`, `skill` and `apAfter` recorded;
  - falls, wakings and the battle's end as for a cast;
  - `formatEvent` lines for a hit, a half miss and a warded outcome;
  - a snapshot taken after an area attack restores to an engine that plays on identically;
  - the schema version is 21.
- **`src/engine/policies.test.ts`:**
  - breath only when net harm is positive: a cone that would touch two allies and one foe is not chosen; one that touches two foes and no ally is;
  - an area beats a single strike only when its net harm is greater;
  - a warded target is scored lower (a fire-warded foe makes the cone worth less);
  - recharge respected: the turn after `fire_spit`, the unit strikes or closes instead;
  - a status-only area (Web) is used from range when no strike is in reach, never when it would touch an ally, and not on a foe already Webbed.
- **`scripts/simulate.test.ts`:** the tally counts an `AbilityEvent`'s damage and statuses for the unit's side, and the area-attack averages.
- **`make test`** passes.
- **The checkpoint:** `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`; the summary must be identical to step 04's recorded one, but for the new area-attack lines, which read 0. Any other difference means a draw or a choice changed; find it before committing.

## 6. Completion criteria

- [x] `spider_web` and `fire_spit` in `ABILITY_IDS` and `ABILITIES` as in C4.
- [x] `AbilityEvent`, `CastOutcome.half`, the area's legal aims and resolution as in C5; `formatEvent` lines.
- [x] The policy's area and status-area rules as in C6, with its tests.
- [x] The simulator's tally and summary lines.
- [x] `LOG_SCHEMA_VERSION` is 21.
- [x] The tests listed above, and `make test`, pass.
- [x] The campaign summary identical to step 04's (area attacks at 0), recorded below.
- [x] CLAUDE.md lines updated.
- [x] Committed on the current branch, without pushing; the message ends with the repo's `Co-Authored-By` attribution line.
- [x] The index's step 05 row set to `done` with the commit; the execution record below filled in.

## Execution record

**Status:** done (commit: see the index row; the orchestrator fills in the hash).

**What was built**
- `abilities.ts`: `ABILITY_IDS` gains `spider_web` and `fire_spit`, with the C4 table's values and a description each.
- `battleEngine.ts`: the `ability` action's `at` form; `AbilityEvent` (C5) in `BattleEvent`; `CastOutcome.half`; `canAim` (on the board, a burst within range, a cone or line 1 to range, touching a standing foe); `legalActions` lists an area ability at each legal aim in board order, in the unit's `abilities` order after its casts; `step` throws "X cannot use A at q,r" on an illegal aim; `areaAttack` pays (AP, `gearChangePaid`, recharge), turns to `at`, and resolves each touched unit in roster order. `cast` and `areaAttack` share `strikeUnit` (roll with the attacker's chance; image; dice on a hit, doubled on a critical; half the dice, floor, on a miss with `halfOnMiss`; ward; wake; status on a hit left standing) and `aftermath` (wakings, images spent, `fellAll`). A cast's draws are unchanged (half is never set for a cast). `formatEvent` renders an `AbilityEvent` ("Salamander spits fire: HITS Warrior for 13 dmg, seared."; "MISSES Warrior, 4 dmg (warded 2) (half)"; "Spider spins a web: Warrior is webbed; MISSES Cleric."; "…: it touches no one."). `LOG_SCHEMA_VERSION` 21.
- `policies.ts`: `bestStrike` skips area actions when choosing the plain attack or routine, then takes the first damaging area ability whose net harm (`areaHarm`) is above 0 and above that strike's harm; `statusArea` (after the best strike, before closing in) takes the status-only area touching the most foes without its status and no unit of its own side.
- `scripts/simulate.ts`: the tally counts an `AbilityEvent`'s damage and statuses for the user's side; `Summary.avgPlayerAreaAttacks` / `avgEnemyAreaAttacks`, printed after the casts. Also, from step 03's note: `CastEvent.drained` now counts in the caster's side's healing (summary-neutral: no kind casts Drain Life).
- CLAUDE.md: the simulator's summary line, the engine bullet (the area form), the policies bullet (net harm, the status area), and the battle rules (an area ability owes nothing to resistance).

**Tests added**: `abilities.test.ts` (the two new entries, the id order); `battleEngine.test.ts` "area abilities" (cone, line and burst touches and board-filtered `hexes`; payment, facing, distance, skill; a hit with bonus and resistance ignored; half on a miss with no status; a miss without `halfOnMiss` drawing no dice; a ward of 99 and of 2, with the status still laid; a critical that fells and ends the battle; a mirror image drawing no dice; a sleeper woken; Web's hit and miss; listing in board order after the other actions; refusals of a foeless aim, an own-hex cone, a burst out of range and the target form; recharge across rounds 1–3; the empty line; snapshot round-trip and identical play-out); `policies.test.ts` "aggressive with an area ability" (two foes vs two allies; area vs a heavy blow; a fire ward lowering the score; striking while recharging; Web from range, not with a strike in reach, not touching an ally, not on a webbed foe); `simulate.test.ts` (area tallies; drain healing). Changed on purpose: the schema pins 20 → 21, `half: false` in the cast `toEqual` test and in the `CastOutcome` fixtures of `sounds.test.ts` and `simulate.test.ts`.

The line shape and a damaging miss without `halfOnMiss` belong to no listed ability, so `battleEngine.test.ts` adds a test-only `test_bolt` to `ABILITIES` in `beforeAll` and removes it in `afterAll`.

**Checks run**
- `npm run -s typecheck`: clean. `npx vitest run --project domain`: 939 passed.
- Policy tests checked against mutations (no area choice; no ward in the score; allies not subtracted): each fails at least one test.
- `make test`: 70 files, 948 tests passed.
- `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`, run on step 04's tree first and again after the change: from the "Simulated" line on, the output is identical but for the two new rows `avgPlayerAreaAttacks 0` and `avgEnemyAreaAttacks 0`. Source beaten 242 of 500; 280 days, 18.9 battles, 1.8 heroes dead.
- `make test-browser` not run: no scene code changed.

**Notes for later steps**
- No contract changed. Choices made within it: a half miss's damage is drawn without the critical doubling and halved after the bonus, then warded; a fumble counts as a miss (half still dealt); "(warded N)" comes before "(half)"; an area aimed at the user's own hex (a burst) leaves its facing alone, as a cast does.
- Step 06: `BattleScene` does not yet handle `AbilityEvent` (no unit has an area until step 08). `AbilityEvent.hexes` is already board-filtered; `CastOutcome.half` tells a half miss.
- Still open from step 03: drain heals from overkill damage (step 09 decides).
