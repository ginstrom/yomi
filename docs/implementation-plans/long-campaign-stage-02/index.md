# Implementation plan: long campaign, stage 2 (special attacks and elements)

Monsters learn to fight in new ways, and two new nests show it in play:
- area shapes (burst, cone, line) shared by spells and abilities;
- elements on spells, statuses and areas, and monster wards against them;
- monster-only spells, which never reach the hero spell tree;
- strike routines (several weapon strikes as one action) and recharge;
- area attacks that recharge rather than cost mana, with half damage on a miss;
- the `aggressive` policy using all of these by expected harm;
- the battle screen showing routines, areas and a foe's abilities and wards;
- the Giant Spider and the Salamander, their nests on today's map, and the Troll's routine.

**Source design:** [`docs/designs/long-campaign/stage-02-special-attacks-and-elements.md`](../../designs/long-campaign/stage-02-special-attacks-and-elements.md) (status "ready for planning", committed with the stage designs in `9c740ae`). Its references are [`reference/campaign-to-level-20.md`](../../designs/long-campaign/reference/campaign-to-level-20.md) §4.2, §4.4 and §5.4, and [`reference/gear-and-runes.md`](../../designs/long-campaign/reference/gear-and-runes.md) §4.6 and §5.3 (elements and wards only). The stages overview and the conventions every stage follows are in [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md). The plan was written against repo commit `51cecb5` on branch `armor-resistance`.

## Corrections to the design

The plan follows the design except where the design contradicts itself or the code, or leaves a number or a name open. These are the only departures; every task file repeats the ones it touches.

1. **The Troll's routine costs 8 AP, not 4.** The Troll has 8 AP and claws for 4 (`TROLL_STATS`): two claws standing still, one after a move. A 4-AP routine of two claws would give it four claws standing still (three with a recharge of 1), not "the same expected damage". The routine `troll_claws` (Claw, Claw) costs 8 AP with no recharge, and the Troll keeps its 4-AP claw for a turn it moves. Every turn's expected damage is today's, as the design asks, and the log shows "Claw, Claw" as one action when it stands and strikes.
2. **Both replaced locations lie at threat 5.** `threatAt` puts the Troll Den (54, 28) and the Goblin Pillagers (57, 10) at 49 and 52 hexes from home, both threat 5. The design's "inside the threat 4 and 5 rings" cannot hold on today's map. The Troll Den, nearer the Troll Lair, becomes the **Salamander Pool**; the Goblin Pillagers become the **Spider Nest**. Both are fought at threat 5 on the map. The Spider Nest keeps its band 4–5, and its threat-4 cell is checked in the simulator only.
3. **The Giant Spider's Web is an area ability, `spider_web`,** a twin of the Web spell (burst 1 at range 4, lays Webbed, no damage, recharge 3). Spells cost mana and abilities recharge, and the design gives the spider's Web a recharge. The Web spell also exists, in `MONSTER_SPELL_IDS`, for monster casters; no kind casts it in this stage.
4. **There is no foe tooltip today.** The battle screen shows only nameplates and hit-chance labels. Step 06 adds a small hover panel for an enemy unit that has abilities or wards, from a Phaser-free helper, `foeInfo.ts`. A foe with neither shows nothing new.
5. **Abilities are data by id, so `foeAtLevel` cannot raise their dice.** `CombatantStats` gains `abilityDamageBonus` (default 0). `foeAtLevel` adds its damage step to it, and the engine adds it to every strike's and area's damage, which is how "`foeAtLevel` adds its damage step to ability damage" is done.
6. **`AreaShape` lives in `src/grid/hex.ts`**, beside `areaOf`, because the grid layer imports nothing from combat. `abilities.ts` re-exports it.
7. **A strike that is not made emits nothing.** Reference §4.4 says the remaining strikes "are logged as not made", and §5.4 that "a strike not made emits nothing". The stage design is silent. The plan follows §5.4, the technical section.
8. **Names the design leaves open.** `Ability` and `Strike` gain a `verb` for the log line ("bites", "spits fire"); an area's `damage` is optional, for Web; `AbilityEvent` gains `distance`, as `CastEvent` has, for the scene's timing; Drain Life's heal to its caster is `CastEvent.drained`; `warded` is the points the ward stopped, with `damage` what was dealt.
9. **An area's aims must touch a standing foe.** The stage design says "at least one unit"; reference §4.4 and today's rule for hostile area spells say a foe. The plan uses a foe.
10. **Recharge.** Using an ability with `recharge` N ≥ 1 sets its counter to N. The counter falls by 1 as the unit's side's turn begins, after status ticks and regeneration, and the ability is usable at 0. So recharge 1 is once a turn, and recharge 2 every other turn. Recharge 0 limits nothing but AP.
11. **Numbers the design leaves open are first values here** (the new kinds' AP and attack costs, the abilities' AP costs, the monster spells' mana and AP, the nests' counts, positions and `FOE_XP`). Step 09 tunes them in the simulator, as the design asks ("tune recharge and damage first").
12. **The new nests do not spawn.** `SPAWN_KINDS` (`blight.ts`) is unchanged, so the blight spawns what it does today; the design names no spawn kind. Stage 9 fills the outer rings.
13. **The hero spells' policy rules are unchanged.** The design asks the policy to score "areas by expected harm to foes minus harm to allies". The plan applies that to area *abilities*. The rule for hostile area *spells* (two foes or more, no ally) stays as it is, because changing it would move the guard through the heroes' and bandits' Fireball. Wards lower a spell's score only where a ward exists. Monster spells fit the existing rules (C7).
14. **Statuses are laid whatever a ward stops.** A ward lowers damage only. Flame Arrow on the Salamander deals 0 and still lays Seared, which does nothing to a foe that does not regenerate.
15. **Versions are raised once per step that changes a shape.** `LOG_SCHEMA_VERSION` 18 → 19 (step 03), 20 (step 04), 21 (step 05). `SAVE_VERSION` 13 → 14 (step 04, the snapshot's `recharging`), 15 (step 08, the replaced locations). The design says each "is bumped"; one bump per step keeps every commit's logs and saves honest.
16. **The yardstick test counts routines.** Its mean damage a turn becomes the better of the weapon's turn and the routine's turn (C4), so the Troll's numbers and exceptions are unchanged.

## Scope and shared constraints

- **In:** design S2-R1 to S2-R7 (see the requirement map).
- **Out:**
  - weapon on-hit damage and hero wards (stage 4);
  - the high roster (stage 11);
  - reach weapons (stage 3);
  - abilities for heroes: no hero has one, so the player never aims one;
  - new spawn kinds (correction 12).
- **Commands:**
  - `make test` runs the full suite in the podman container (Node 26). This is the gate before every commit.
  - `npm run -s typecheck` and `npx vitest run --project domain` run locally (Node 22) for quick checks of domain code.
  - `make test-browser ARGS="-t <name>"` runs in-browser tests in podman; run them after a change to a scene.
  - The simulator runs only in podman: `make -s simulate ARGS="..."`. Local Node 22 cannot run `scripts/simulate.ts`. Logs go under `logs/` (gitignored). A 500-campaign run takes about a minute and writes about 70 MB.
  - Never run two `make simulate` commands at the same time: both build the same image, and the loser prints nothing.
- **Test layout:** `src/**/*.test.ts` and `scripts/**/*.test.ts` run in the Node `domain` project. `src/scenes/*Scene.test.ts` run under jsdom with Phaser. In-browser tests live in `e2e/` (read `e2e/CLAUDE.md` before adding one).
- **The early-game guard.** After stage 1 the figure was 238 of 500 (`--ready-level 7`), accepted by the user. Two later commits, `fdc0593` and `51cecb5` (free attacks only for leaving a foe's side; a defender turns once a turn to meet a melee side or rear blow), changed battle rules since, so it must be re-measured.
  - **Step 01** measures the baseline on this tree before any code changes, with the command `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`, and the Troll Lair cells.
  - **Steps 02, 03 and 05** must leave the campaign summary identical to step 01's (no unit has a ward or an area ability until step 08, and no kind casts a monster spell).
  - **Step 04** changes the Troll, which is on the map: the Troll Lair cells must stay within noise of step 01's, and the guard is measured.
  - **Step 08** replaces two threat-5 nests, so the guard may move. Step 09 judges it: a move of more than about 5 points from step 01's baseline must be explained in CLAUDE.md's rules of scaling and the stage's notes, or retuned away.
- **Versions** (correction 15): `LOG_SCHEMA_VERSION` (`src/engine/battleEngine.ts`, now 18) goes to 19 in step 03, 20 in step 04 and 21 in step 05. `SAVE_VERSION` (`src/game/save.ts`, now 13) goes to 14 in step 04 and 15 in step 08.
- **Determinism.** Every new roll is drawn from the engine's RNG in a fixed order (roster order for areas, strike order for routines). A step that leaves the summary identical must not add, drop or reorder a draw in today's battles.
- **Commits:** one commit per step once `make test` passes, on the current branch, without pushing. Messages end with the repo's `Co-Authored-By` attribution line.
- **Subagents:** CLAUDE.md's guidance on models applies. Sprite drawing in step 07 may be delegated.
- **Docs:** CLAUDE.md must stay current (its "Keeping this file current" section): each step updates the lines its own change makes wrong. Step 09 makes the stage's documentation pass, the manual and its screenshots, the stage design's "Implementation notes" and the stages index's status line.

## Contracts

Every task file copies these unchanged. "Existing" means in the code at `51cecb5`. "New" means produced by the step named.

### C1. Area shapes (step 02)

```ts
// src/grid/hex.ts (new)
export type AreaShape = 'burst' | 'cone' | 'line'
/**
 * The hexes an area of `shape` covers, on the board or off it (callers filter):
 * burst — every hex within `radius` of `aim` (the caller checks `aim` is within `range` of `origin`);
 * line  — `range` hexes from `origin` towards `aim`, the origin excluded;
 * cone  — the hexes 1 to `range` from `origin` whose direction from it is within 30° of the direction to `aim`.
 * Cone and line are [] when `aim` is `origin`.
 */
export function areaOf(shape: AreaShape, origin: Hex, aim: Hex, range: number, radius = 0): Hex[]
```

- **Burst:** exactly today's `areaHexes(aim, radius)` (`battleEngine.ts`), in its order. `areaHexes` moves out of `battleEngine.ts`; its callers (`BattleScene.markCast`, `BattleScene.showCast`) use `areaOf`.
- **Line:** let `n = hexDistance(origin, aim)` and `far = origin + (aim − origin) × ceil(range / n)`; the line is `hexLine(origin, far)` from its second hex, cut to `range` hexes.
- **Cone:** angles are measured in pixel space (`hexToPixel`, any size); a hex is in when the angle between `origin → hex` and `origin → aim` is at most 30° (with a tolerance of 1e-9). Ordered by distance from the origin, then `q`, then `r`. A cone of range 2 aimed at a neighbour is 4 hexes: that neighbour, the hex beyond it, and the two hexes at distance 2 either side of it.

```ts
// src/engine/battleEngine.ts (new)
export interface AreaSpec { shape: AreaShape; range: number; radius?: number }
/** The standing units an area of `area` from `caster` aimed at `at` touches, in roster order: everyone if `hostile`, else the caster's side. */
export function areaTouches<U extends Placed>(units: readonly U[], caster: Placed, area: AreaSpec, at: Hex, hostile: boolean): U[]
```

- `castTouches` (existing, signature unchanged) uses `areaTouches` for an area spell, with `{ shape: spell.shape ?? 'burst', range: spell.range, radius: spell.radius }`.
- `Spell` (existing, `src/combat/spells.ts`) gains `shape?: AreaShape`, read only when `target` is `'area'`; left out means `'burst'`. No existing spell sets it.
- **The legal aims of an area spell:** a burst as today (on the board, within `range`); a cone or line on the board at distance 1 to `range`. A hostile area must touch a standing foe, as today.

### C2. Elements, wards and the spell changes (step 03)

```ts
// src/combat/combat.ts (new)
export const ELEMENTS = ['fire', 'frost', 'lightning', 'acid', 'poison', 'blight'] as const
export type Element = (typeof ELEMENTS)[number]
// CombatantStats gains:
/** Points taken off each instance of damage of an element; none when left out. */
wards?: Partial<Record<Element, number>>
/** Damage of `element` after `stats`' ward: max(0, damage − ward); damage of no element is unchanged. */
export function warded(damage: number, element: Element | undefined, stats: CombatantStats): number
```

- `sameCombatStats` compares `wards` (a missing key equals 0).
- `Spell` gains `element?: Element` and `drain?: number` (the share of the damage dealt that heals the caster). `StatusRule` gains `element?: Element`, read for its tick.
- **Elements of today's spells and statuses:** Flame Arrow and Fireball fire; Frost Blast frost; Acid Arrow and Corroded's tick acid; Death Cloud and Poisoned's tick poison; Magic Arrow none.
- **The engine applies `warded`** to a hostile cast's damage on each unit (after any critical) and to each status tick. A status is laid whatever the ward stopped (correction 14).
- **Events:**
  - `CastOutcome` gains `warded: number`: the points the ward stopped (0 when none). `damage` is what was dealt after the ward.
  - `StatusTickEvent` gains `warded: number`, the same way.
  - `CastEvent` gains `drained: number`: the hit points the caster regained by `drain` (floor of `drain` × the damage dealt to all it touched, no more than the caster had lost), 0 for any other spell.
- **Log:** a warded outcome adds `(warded N)` after its damage, as in "HITS Salamander for 0 dmg (warded 9)" and "Goblin takes 1 from poison (warded 2).". A drain adds "and drains N".
- `LOG_SCHEMA_VERSION` 18 → 19.

### C3. Monster spells (step 03)

```ts
// src/combat/spells.ts
export const SPELL_IDS = [/* today's seventeen, unchanged */] as const  // the heroes' spells: the spell tree, perks and worldCasting read it
export type HeroSpellId = (typeof SPELL_IDS)[number]
export const MONSTER_SPELL_IDS = ['lightning_bolt', 'drain_life', 'curse', 'web', 'dark_shield'] as const
export type MonsterSpellId = (typeof MONSTER_SPELL_IDS)[number]
export type SpellId = HeroSpellId | MonsterSpellId
/** Every spell, the heroes' first: the order a stat block's `magic.spells` keeps. */
export const ALL_SPELL_IDS: readonly SpellId[]
// STATUS_IDS gains 'cursed' and 'webbed'.
```

| Spell | School | Target | Shape, range, radius | Mana | AP | Effect | Element |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lightning Bolt (`lightning_bolt`) | offence | area | line, 6 | 8 | 5 | 4d6 | lightning |
| Drain Life (`drain_life`) | offence | foe | range 5 | 6 | 4 | 3d6, `drain: 0.5` | — |
| Curse (`curse`) | offence | foe | range 5 | 5 | 4 | lays Cursed, 3 turns | — |
| Web (`web`) | offence | area | burst, range 4, radius 1 | 5 | 4 | lays Webbed, 2 turns, no damage | — |
| Dark Shield (`dark_shield`) | support | self | 0 | 4 | 2 | lays Shielded, 3 turns | — |

All but Dark Shield are hostile. The mana and AP are first values (correction 11).

| Status | Mark, colour | Effect |
| --- | --- | --- |
| Cursed (`cursed`) | `K`, a dark purple | −15 to hit (weapon and spell) and −5 armour class |
| Webbed (`webbed`) | `W`, a pale grey | −4 action points |

- Every `Record<SpellId, …>` gains entries for the monster spells (`SPELLS`, `SPELL_LOOKS` in `battleEffects.ts`).
- Perks, the spell tree, creation and `worldCasting` keep reading `SPELL_IDS` and take `HeroSpellId` where they name a spell, so no hero can learn a monster spell.

### C4. Abilities, routines and recharge (step 04; the area entries in step 05)

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

- **Legal:** the unit has the ability in `stats.abilities`, `ap ≥ apCost`, and it is not recharging. A routine's target is a standing foe within the unit's `attackRange`. `legalActions` lists abilities after a unit's casts, in its `abilities` order: a routine at each such foe in roster order; an area at each legal aim in board order.
- **On use:** AP paid, `gearChangePaid` cleared, the counter set if `recharge` ≥ 1.
- **Countdown:** in `startTurn(side)`, after the ticks and regeneration and only if the battle goes on, each of the side's standing units' counters fall by 1, an entry at 0 removed. A sleeper's counts down too.
- **A routine** makes its strikes in order, each a weapon attack as `attack` makes one (facing, the defender's turn, flanking, arc, helpless, mirror images, resistance and piercing), with the strike's damage plus `abilityDamageBonus` for the dice. The first strike's `apCost` is the ability's, the rest 0; `opportunity` is false. A strike's status is laid after its damage, on a hit that left the target standing.
- **Retargeting:** before a strike whose target has fallen, the strike goes to the nearest standing foe within `attackRange` (by `hexDistance`; ties to the lowest unit id by string order). With none, it and the rest are not made and emit nothing. A routine stops when the battle ends.
- **Log:** a strike's line names its verb: "Troll claws Aldric: rolls 23 (needs 55 or less) — HITS Aldric for 5 dmg (armour stops 1)." (the verb looked up from `ABILITIES[event.ability]` by the strike's name).
- `LOG_SCHEMA_VERSION` 19 → 20; `SAVE_VERSION` 13 → 14.

### C5. Area abilities (step 05)

```ts
// src/engine/battleEngine.ts
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
// BattleEvent gains AbilityEvent. CastOutcome gains:
/** The damage is half the dice for a miss (halfOnMiss); false on every cast outcome. */
half: boolean
```

- **Legal aims:** on the board; a burst within `range`; a cone or line at distance 1 to `range`; touching a standing foe (`areaTouches(..., hostile: true)`; correction 9).
- **Resolution,** each touched unit in roster order, everyone in the area (both sides):
  - `rollToHit` with the unit's effective `toHit` against the target's effective armour class, with no flanking, arc or helpless bonus;
  - a hit on a mirrored unit strikes an image and draws nothing;
  - a hit draws the dice (doubled on a critical), adds `abilityDamageBonus`, then `warded`;
  - a miss with `halfOnMiss` and damage dice draws the dice, adds the bonus, halves rounding down, then `warded`, with `half: true`;
  - resistance is ignored;
  - a status is laid on a hit that left the unit standing.
  Then the wakings, images spent and falls, as a cast's.
- **Log:** "Salamander spits fire: HITS Aldric for 9 dmg; MISSES Bryn, 4 dmg (half); HITS Kobold for 11 dmg." A warded outcome adds `(warded N)`.
- **The simulator's tally** (`scripts/simulate.ts`) adds an `AbilityEvent`'s outcomes to the damage dealt by the unit's side and its statuses laid, and `Summary` gains `avgPlayerAreaAttacks` and `avgEnemyAreaAttacks`, printed as area attacks used a battle.
- `LOG_SCHEMA_VERSION` 20 → 21.

### C6. The policy (steps 03, 04 and 05)

`aggressive`'s order becomes: heal, guard, hostile area spell, Bless, Sleep, **Curse (03)**, damaging spell of one foe, **the best strike (04, 05)**, **a status area (05)**, closing in.

- **Step 03:** wards lower a cast's score: `strikeCast` ranks by `warded(mean damage)`; Drain Life goes through `strikeCast`; Lightning Bolt and the Web spell through `areaCast` (Web needs only one foe not already Webbed, and no ally); Dark Shield through `guardCast`, after Shield; Curse on the foe in range with the most hit points not already Cursed, while two foes or more stand. With no ward and no monster spell in play, every choice is today's.
- **Step 04:** `bestAttack` becomes the best strike: each legal plain attack scores today's `expectedHarm`; each legal routine the sum of `expectedHarm` over its strikes, each with its own dice plus `abilityDamageBonus`, against its target. The highest wins; a routine wins a tie. `reach` is unchanged.
- **Step 05:** an area ability with damage scores its net harm, the sum over the foes it touches less the sum over the units of its own side: hit chance × `warded(mean)` plus, with `halfOnMiss`, miss chance × `warded(floor(mean / 2))`. It is chosen when its net harm is above 0 and above the best strike's harm (0 when none is in reach). A status-only area ability (Web) is used when nothing else was chosen and it touches at least one foe not already under its status and no unit of its own side, the one touching the most such foes first. Recharge is respected through `legal`.

### C7. The new kinds and nests (step 08)

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

### C8. The battle screen (step 06)

```ts
// src/scenes/foeInfo.ts (new, Phaser-free)
/** What hovering a foe tells: a line per ability ("Fire Spit: ready", "Web: recharging, 2 rounds"), then its wards ("Wards: fire 99"); [] for a unit with neither. */
export function foeInfoLines(unit: UnitSnapshot): string[]
```

- `BattleScene` shows those lines in a small panel beside an enemy unit while the pointer is over its hex, and nothing for a unit whose lines are empty. Its probe gains `foeInfo: string[]` (the lines shown, [] when none).
- A routine plays as successive attacks, each swung and heard as an attack is.
- An `AbilityEvent` reuses the spell-effect path: its hexes flash, then each outcome lands, timed by `impactMs` and `holdMs`, which cover `'ability'`. `battleEffects.ts` gains a look for each area ability; `sounds.ts` gives `'ability'` the cast's cues.

## Tasks

| Step | Task | Outcome | Depends on | Difficulty (model) | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | [Baseline measurement](01-baseline-measurement.md) | The guard and the Troll Lair cells measured on this tree, recorded here and in CLAUDE.md if moved | — | routine (sonnet) | pending |
| 02 | [Area shapes](02-area-shapes.md) | `areaOf`, `AreaShape`, `areaTouches`, `Spell.shape`; the scene uses them. The summary is identical. | 01 | moderate: geometry with worked tests (sonnet, or session model for the cone) | pending |
| 03 | [Elements, wards and monster spells](03-elements-wards-monster-spells.md) | `Element`, wards, `warded` on casts and ticks, `drained`, five monster spells, Cursed and Webbed, the policy's spell rules; LOG 19. The summary is identical. | 02 | intricate engine and policy (session model) | pending |
| 04 | [Abilities, routines and recharge](04-routines-and-recharge.md) | `abilities.ts`, the routine action, retargeting, `recharging`, the Troll's routine, the policy's best strike, the yardstick test; LOG 20, SAVE 14. Troll cells within noise. | 03 | intricate engine and policy (session model) | pending |
| 05 | [Area abilities](05-area-abilities.md) | `AbilityEvent`, half on a miss, wards on areas, `spider_web` and `fire_spit`, the policy's areas, the simulator's tally; LOG 21. The summary is identical to step 04's. | 04 | intricate engine and policy (session model) | pending |
| 06 | [The battle screen](06-battle-screen.md) | Routines and area abilities played back, schedule and sounds, the foe info panel, probe and tests | 05 | moderate: pattern-following on the spell-effect path (sonnet can; session model for review) | pending |
| 07 | [Spider and Salamander sprites](07-sprites.md) | `giant_spider` and `salamander` in the atlas with `idle` and `walk`, the sprites README | — | art judgement (session model) | pending |
| 08 | [The new kinds and nests](08-kinds-and-nests.md) | The two stat blocks, kinds, XP, `spider_nest` and `salamander_pool`, the two map places, yardstick exceptions; SAVE 15 | 05, 07 | routine, following stage 1's bandit steps (sonnet) | pending |
| 09 | [Measure, tune and document](09-measure-tune-document.md) | The guard against step 01, the nests' and Troll's cells, tuning, CLAUDE.md, the manual and screenshots, the stage notes and index status, the play script | 06, 08 | balance judgement (session model); the doc pass may be sonnet | pending |

## Execution order

1. **01** first, on the tree as it stands, before any code changes.
2. **02 → 03 → 04 → 05** in a line: each extends the same engine, policy and stat-block code (`battleEngine.ts`, `policies.ts`, `combat.ts`, `spells.ts`).
3. **07** may run at any time, in parallel with 02 to 06: it touches only `art/` and `public/assets/sprites/`.
4. **06 and 08** after 05 (and 08 after 07). They touch different files (06 `src/scenes/` and `e2e/`; 08 `src/combat/combat.ts` stat blocks, `src/game/encounters.ts`, `src/game/worldMap.ts`, `src/game/save.ts` and their tests) and may run in parallel; if they do, each edits only its own lines of CLAUDE.md, and the second to commit rebases its CLAUDE.md edit on the first.
5. **09** last.

**Checkpoints** (each a `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"` run compared with step 01's):
- After 02 and after 03: the campaign summary identical to step 01's.
- After 04: the Troll Lair cells within noise of step 01's; the guard measured and recorded.
- After 05: the summary identical to step 04's (the tally's new area-attack lines aside, at 0).
- After 08: the guard measured; 09 judges it.

## Requirement map

| Design requirement | Steps |
| --- | --- |
| S2-R1 strike routines, retargeting | 04 |
| S2-R2 cone, line and burst area attacks, recharge, half on a miss, resistance ignored | 02 (shapes), 04 (recharge), 05 (areas) |
| S2-R3 monster spells, never learnable by heroes | 03 |
| S2-R4 elements on spells, statuses and areas; monster wards; `warded` in the log | 03 (spells, statuses), 05 (areas), 08 (the Salamander's ward) |
| S2-R5 the policy uses routines, areas and monster spells by expected harm | 03 (spells), 04 (routines), 05 (areas) |
| S2-R6 the scene shows routines, areas and abilities in a tooltip | 02 (shaped spell areas), 06 |
| S2-R7 the Giant Spider and the Salamander, nests, map places, sprites; the Troll's routine | 04 (Troll), 07 (sprites), 08 (kinds, nests, map) |
| Verification: tests (design §6) | 02 to 08, each with its own |
| Verification: simulator (design §6) and play script; "Done when" | 01 (baseline), 04 (Troll cells), 09 |
| Conventions: guard, versions, docs, sprites (stages index) | 01, 03, 04, 05, 07, 08, 09 |

## Overall completion criteria

- [ ] Every step is done, with `make test` passing at each commit.
- [ ] The guard is measured at step 01 and after step 08, and judged in 09: within about 5 points of step 01's figure, or the move explained in CLAUDE.md's rules of scaling and the stage notes.
- [ ] The summary is identical to the baseline after steps 02 and 03, and to step 04's after 05.
- [ ] Cells recorded: `--encounter spider_nest --threat 4 --party-level 4`, `--encounter spider_nest --threat 5 --party-level 5` and `--encounter salamander_pool --threat 5 --party-level 5` are hard but winnable (a party of the threat's level wins most but not all; roughly 60% to 95%); `--encounter troll_lair --threat 4 --party-level 4` (and 5) within noise of step 01's.
- [ ] `giant_spider` and `salamander` are drawn sprites, not placeholders.
- [ ] `LOG_SCHEMA_VERSION` is 21 and `SAVE_VERSION` 15.
- [ ] CLAUDE.md describes shapes, elements and wards, monster spells, abilities and recharge, the policy's new rules, the foe info panel, the new kinds and nests; the manual describes them, its screenshots retaken (with one of a new nest).
- [ ] The stage design gets an "Implementation notes" section with the figures; the stages index's stage 2 row says done.
- [ ] The design's play script has been walked in the game (`make dev`), or the steps not walked are listed for the user in step 09's record.

## Open questions

None block the plan. The corrections above are recorded in place of questions. Two are worth the user's eye when the stage is reviewed: the Troll's routine at 8 AP (correction 1) and the hero spells' policy left as it is (correction 13).

## For implementers

After working on a step, update its row's status here (`in progress`, `done` or `blocked`) with the commit, and fill the task file's execution record: the commit, the checks run and their results, deviations, and anything left for a later step. If a step is blocked, say on what. A contract changed by a step is amended here, marked with the step, as stage 1's plan did.
