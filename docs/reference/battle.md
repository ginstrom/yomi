# Battle reference

The full rules of a battle as the engine (`src/engine/`) applies them to the data of `src/combat/`. The working guides are `src/engine/CLAUDE.md` and `src/combat/CLAUDE.md`; this file is the detail behind them. Where it and the code disagree, the code is right and this file should be fixed. The design behind casting is `docs/designs/spells.md`, and behind the trees' traits `docs/designs/skill-trees.md`.

## Combat data (`src/combat/`)

### Attack resolution and damage (`combat.ts`)

An attack is percentile: a roll of 1 to 100 hits when it is within the attacker's `toHit`, plus bonuses, less the defender's armour class, the chance kept between 5 and 95; a hit is critical when the roll is also within `critChance`. Damage rolls go through the defender's `resistance` (`damageThrough`, `effectiveResistance`).

### Foes and their levels

A monster stat block is written for its kind's native level. `foeAtLevel(base, level, native)` scales it: a level below the native counts as the native; armour class, chance to hit, damage (its abilities' too, as `abilityDamageBonus`) and a caster's mana and skill grow by the levels above it; hit points are scaled so that the block is as written at its native level and grows as a level 1 block would from there.

`foeYardstick(level)` gives the ranges a foe of a level should sit in: armour class, chance to hit, hit points and mean damage a turn (the better of its weapon's turn and a routine's), from the ready-made fighter's measured growth. A test in `encounters.test.ts` holds every monster kind to it at its native level, each field outside it a named exception. `foeYardstick(level, 'expected')` gives the same bands from the fighter in gear §5.8's expected kit (`KITTED_FIGHTER_GROWTH`, measured at levels 5, 10, 15 and 20 by the simulator's `kittedFighterRow`): the kinds of long-campaign stage 11 (`STAGE_11_KINDS` in that test) are held to it, until stage 12 measures again; today's kinds stay on the bare one.

A stat block's optional `magic` (mana, spell skill, spells known) is what makes a unit a caster; without it a unit behaves as it always did.

### Spells (`spells.ts`)

`SPELLS` is each spell as the engine casts it: school, cost, what it is aimed at, range and area, whether it is hostile, its damage and its element, healing, drain or status, and `bane`, `bonusVs`, `cleanse` and `oncePerBattle`. Nothing of the perk that teaches a spell is here. `spellApCost` and `spellRange` are what a caster's modifiers make of its cost and reach, and the engine reads them wherever a spell's AP or range is.

- `SPELL_IDS` are the heroes' spells (`HeroSpellId`), which the skill trees' nodes and casting on the world map alone read: 30, each taught by one node (`perkTeaching`), among them Web and Curse, which monsters cast too, and the six special spells, Ice Lance, Glacial Prison, Purify, Revive, Renew and Holy Light.
- `MONSTER_SPELL_IDS` are the spells only a stat block's `magic` can name: Lightning Bolt, Drain Life, Dark Shield.
- `ALL_SPELL_IDS` is both, in that order.
- `isHealing` counts a spell that restores hit points and is no cleanse, so Purify, cast for what it ends, is no heal on the world map, in `autoHeal` or in the policy's heal choices and reserve.

### Elements and wards

`ELEMENTS`: fire, frost, lightning, acid, poison, blight. A stat block's `wards` are flat points off each instance of damage of the element (`warded`).

### Abilities (`abilities.ts`)

`ABILITIES`, by id as spells are, which a stat block's `abilities` names: a routine of weapon strikes at one foe, each with its own dice, verb and maybe a status, or an area. Each costs action points, and one with a `recharge` of N is used at most every N turns of its side.

The monsters' abilities (`MONSTER_ABILITY_IDS`: Troll Claws, Spider Bite, Spider Web, Fire Spit, then the high roster's of long-campaign stage 11, so far the Worg Rider's Spear and Bite, the Ogre's Sweep, the Wyvern's Bite and Sting, the Basilisk's Gaze (a cone that only lays Chilled) the Hill Giant's Rock (a burst of radius 0, one foe, through resistance less the giant's piercing), and the Young Dragon's Fire Breath (a cone 3 hexes long, 6d6 fire, half on a miss, Seared; no `throughResistance`, so armour does not cut it and only a fire ward does) and Bite and Claws (a routine of three strikes)) come first in `ABILITY_IDS` and set none of the heroes' cost fields; the high roster's areas may use `centredOnSelf`, `foesOnly` and `throughResistance`. The heroes' techniques (17) come after them, taught by a node's `ability` (`knownAbilities`). A technique:

- may cost mana (`manaCost`);
- costs the weapon's attack AP plus `weaponAp` (`abilityApCost`, which every reader of an ability's AP goes through), plus nothing for the Spellsword Strikes (`SPELLSWORD_STRIKES`) of a unit with the trait `arcane_knight`;
- may ask for a melee or a ranged weapon (`needs`);
- strikes with the unit's own weapon (`Strike.weapon`, with a strike's `toHit`, `damageBonus`, `onHit` and `spreads`);
- or lays a status with no roll on the user (`selfStatus`, Sprint) or on a foe in range (`foeStatus`, Hunter's Mark);
- or strikes an area with the heroes' `AreaAttack` fields: the weapon's dice (`weaponDamage`) and range (`weaponRange`), through resistance as a shot (`throughResistance`, Volley), only foes (`foesOnly`), no roll and only a status (`auto`, Taunt), double dice against the bane-struck (`bane`), and centred on the user (`centredOnSelf`, Taunt and Consecrate).

### The RNG (`rng.ts`)

The seedable `mulberry32`, which can tell where its stream stands (`state()`) so that a saved battle rolls on as the unsaved one would.

## The engine's actions

### Callers' interface

`legalActions(unit?)`, `previewMove`, `previewAttack`, `previewCast`, `previewAbility` (a use of an ability: its costs and the odds on each unit it touches, a strike's first blow's as `attack` rolls it, null where nothing rolls) and `getState()` ask; `step(action)` acts and returns the `BattleEvent[]` it produced. `legalActions` lists a unit's attacks, then its casts (also for a unit with too few AP to attack; spell by spell, units in roster order or an area's centres in board order), then its abilities. It never lists `equip`, so the AI never changes gear.

### Ability actions

An `ability` action uses one of the unit's abilities once `canUse` allows it: the ability held, its `needs` met by `isMelee`, its AP and mana there, not recharging. AP and mana are paid as it begins.

- **A routine of strikes** at a foe in its attack range: each strike is an `AttackEvent` made as `attack` makes one, with the strike's dice plus `abilityDamageBonus`, and its `ability`, `strike` and any `status` laid recorded on it.
- **A technique's weapon strike** is the same plain attack (the unit's own weapon, flanking, arc, the defender's turn, criticals, piercing and runes as ever), with the strike's `toHit` added to the chance, its `damageBonus` added after a critical's doubling, and its `onHit` entries after the weapon's (each with an element raised by the unit's `imbueDamage`). It draws as a plain attack does.
- A strike that `spreads` (Cleave's second) goes to another standing foe in reach, the nearest, chosen before its roll, else the same foe. A strike whose target has fallen goes to the nearest standing foe in reach (the lowest id on a tie); with none, it and the rest are not made and log nothing.
- The first `AttackEvent` of a technique that costs mana carries `manaCost` and `manaAfter`, as a cast does.
- **A status ability** (`selfStatus`, aimed at the user's own id, or `foeStatus`, at a standing foe within its range) draws nothing and logs one `AbilityEvent` on the target's hex, with one outcome shaped as a friendly spell's (and `manaCost`, `manaAfter` for one that costs mana).
- **An area** is aimed `at` a hex: legal on the board, the user's own for `centredOnSelf`, else a burst within range (the weapon's `attackRange` for `weaponRange`), or a cone or line 1 to range away, touching a standing foe. It is one `AbilityEvent` resolved over everyone it touches (`abilityTouches`, which the policy reads too: both sides, or only foes for `foesOnly`) as a hostile area spell is, with the unit's own chance to hit (a critical doubling the dice):
  - resistance ignored, or gone through as a shot's with `throughResistance` (`CastOutcome.resisted`);
  - its element cut by wards;
  - half the dice (rounded down, no status) on a miss where it has `halfOnMiss` (`CastOutcome.half`);
  - the weapon's dice for `weaponDamage` (no `abilityDamageBonus`, no runes);
  - the dice's count doubled against a unit `baneApplies` to, for `bane`.
- **An `auto` area** draws nothing and lays its status on each unit touched (Taunt's `taunted` naming the user as its `source`), each outcome shaped as a friendly spell's.

`cast` and the ability path share `strikeUnit` and `aftermath`, so neither may change the other's draws.

Each unit's `recharging` (on `UnitRecord` and `UnitSnapshot`, so in snapshots and saves) counts the rounds until a used ability is ready, a round coming off as its side's turn begins, after the ticks and regeneration.

### Events and the log

Events are the engine's only output and the log format; bump `LOG_SCHEMA_VERSION` whenever an event's shape changes. Events record more than the player is shown (AP spent and left, the numbers behind each roll, the items behind a gear change); `formatEvent` renders the short on-screen line. `battle_start` records the seed and policies so that any battle can be replayed. `snapshot()` and `BattleEngine.restore` save and resume a battle without changing the events.

An `AttackEvent`'s `melee` says whether the blow was struck with a melee weapon, reach included (`isMelee`), which is how the battle screen tells a swing from a shot.

### On-hit effects (runes)

A hit that strikes no image adds the weapon's on-hit effects (`CombatantStats.onHit`):

- each entry's flat damage after resistance, cut by the defender's ward of its element and never doubled by a critical (a `bane` entry only against a unit `baneApplies` to);
- the wielder's heal;
- its statuses (an `onCrit` one on a critical only), once the damage leaves the defender standing.

None of it draws from the RNG. `damage` stays the weapon's; the rest is recorded in `bonus`, `healed` and `onHitStatuses`, and the defender loses `damage` plus every `bonus[].damage`.

## Rules of the battle system

### Turns, AP and weapons

A side's units act in any order and the turn ends manually. Units get 8 AP a turn by default; a move costs 1 AP per hex (`MOVE_AP_COST_PER_HEX`); an attack costs the unit's `attackApCost` and reaches foes within its `attackRange`, both from its weapon (`ItemStats`: the longsword costs 5 and reaches 1 hex, the bow costs 4 and reaches 5, so that a unit of 8 AP standing still shoots twice, and the light blades cost 4 and the dagger 3, for two blows; see the note over the weapons in `catalog.ts`).

A melee weapon is one of range 1 or with `reach` (`isMelee`, which the engine asks wherever it tells a blow from a shot): the spear and the halberd strike from two hexes as melee weapons, with Melee Weapons, strength's damage, the melee perks and piercing, a range of 2 being an ordinary attack range. Nothing blocks a shot or a spell, as there is no line of sight yet.

A two-handed weapon and an off-hand item cannot be held together, so equipping either stows the other (`equipFromBackpack`), or drops it on the ground when the backpack has no room; the inventory shows the weapon ghosted in the off-hand slot.

### Zones of control, free attacks and counters

Stepping from a hex adjacent to a ready foe with a melee weapon, reach included, to one that is not provokes one free attack. A reach weapon's zone is still its neighbouring hexes only; a step to another hex beside it provokes nothing. One free attack per unit per enemy turn, decided in `reactorsAt` (`reachable` reads the same rule, `canReact` and `leavesSideOf`, with the foes that could react found once a search), which `reachableHexes` asks about each step; none at all for a mover with the trait `tumble`. Ranged weapons, wands and the crossbow among them, hold no zone of control.

A unit with the trait `counter` whose free attack is ready, holding a melee weapon with the attacker in reach, answers a melee blow of the side in turn that misses it (an image struck is a hit) with a free attack at once (`AttackEvent.counter`, spending `reactionReady`), before a routine's next strike; a counter that fells the attacker ends its routine.

### Bonuses to hit

Bonuses to the chance to hit, in percent, stack from flanking (`FLANK_BONUS_PER_ALLY`, 10 an ally) and from the arc struck (`ARC_BONUS`: front 0, side 5, rear 10; judged at range by the neighbouring hex the shot comes in over). An attack on a helpless unit adds `HELPLESS_BONUS` (20).

### Facing

Facing is automatic, set by moving, attacking and casting. Once each enemy turn a unit struck in its side or rear by a melee weapon, reach included, hit or miss, turns to face the attacker before the roll (a shot, a wand's included, or a spell gives no turn and spends none) (`turnReady`, readied with `reactionReady` and never for the side taking its turn, so a mover struck by a free attack cannot turn; `AttackEvent.defenderTurned`). A second attacker from another side then finds the arc that exposes. Previews, the AI and `planAttack` judge the arc by `arcStruck`: the front for a melee blow (`isMelee`) on a foe that can still turn.

### Armour class, resistance and piercing

Defence has two axes. Armour class (agility, shields, the breastplate a little, statuses) comes off the chance to hit. `resistance` (what armour stops, and a monster's own hide or plates) comes off the damage of every weapon hit as flat points, a hit that rolled anything doing at least 1 (`damageThrough`). It is a flat cut, not a share, so that it tells most against weapons that hit often and lightly, the dagger, the shortsword and the bow, which are the weapons for the lightly armoured.

A melee weapon and the strength perks pierce points of resistance (`armorPierce`, `effectiveResistance`), most of all the heavy weapons, which are the answer to the armoured; nothing pierces armour class. A shot, a wand's included, pierces nothing but the crossbow's own piercing (`rangedPierce`; the strength perks' piercing is a blow's, never a shot's). A spell's damage, a status's ticks included, owes nothing to resistance, nor does an area ability's (unless `throughResistance`), nor a weapon's on-hit damage, which is warded instead.

An on-hit `bane` (the Dawn rune) applies only against a unit with `regeneration` or `blightborn` (the Blight Horror). Seared laid on a hit (an Ember rune of rank 3) stops regeneration as Fireball's does.

`previewAttack` gives the resistance left after piercing, which the battle screen shows on the foe's nameplate as "−N dmg".

### Attack traits

The attack traits (`CombatantStats.opportunity`, `rear`, `movedToHit`, `execute`, `critDamage`, `manaOnHit`, and the traits `ambush` and `deadeye`, derived from the nodes' effects):

- add to the chance (`traitToHit`, recorded as `traitBonus`): a free attack's `opportunity.toHit`; a rear blow's `rear.toHit`; `movedToHit` on an own-turn attack after a step (`UnitRecord.moved`); `AMBUSH_BONUS` (25) on a unit's first own-turn attack of the battle (`attackedYet`), whose hit is then critical with no second draw;
- add to a hit's damage after the dice (`traitDamage`, never multiplied): `opportunity.damage`, `rear.damage`, `execute` against a foe at half its hit points or less before the blow, `critDamage` on a critical;
- a Deadeye's shot (`deadeyeShot`) pierces `DEADEYE_PIERCE` (3) more (`blowPierce`, `resistanceLeft`), and its critical triples the dice;
- a melee hit that strikes no image restores `manaOnHit` mana up to the maximum (`manaRestored`).

None of these draws from the RNG; `previewAttack` and the policy's expected harm read the same helpers; a unit without the fields plays as before.

### Damage, Unbreakable, Deathblow and Blademaster

Every damage a unit takes (a weapon hit with its on-hit damage, a routine's or technique's strike, each outcome of a cast or an area, a status's tick) reaches it through the engine's one `applyDamage`.

- **Unbreakable** (trait `unbreakable`) keeps a standing unit that the battle's first lethal damage would bring to 0 at 1 instead, Shielded for 2 turns (`UNBREAKABLE_SHIELD`); `endured` is set on the unit and on the `AttackEvent`, `CastOutcome` or `StatusTickEvent`.
- **Deathblow** (trait `deathblow`, `deathblows`) fells outright a non-`blightborn` foe that a weapon hit striking no image leaves at a quarter of its maximum hit points or less, judged on the hit points the hit and its on-hit damage leave without Unbreakable (so a hit lethal by itself on a foe Unbreakable would keep standing is a deathblow too), before any status (`AttackEvent.deathblow`). A foe it fells does not endure (its Unbreakable is not spent, no Shielded, no `endured`). Spells, areas and ticks never deathblow.
- **Blademaster** (trait `blademaster`) gives back the whole AP of the unit's own attack or strike technique (a routine's, whichever strike) that fells a foe, once a turn (`refunded`, false again as its side's turn begins; `AttackEvent.apRefunded`, `apAfter` still as paid); never for a free attack or a counter, nor for an area.

None of the three draws from the RNG.

### Auras

`AURAS`, `auraBonus`: a unit gains, for each kind, the bonus of any standing ally of its side in reach, two of a kind not stacking.

| Aura | Bonus | Reach | Itself |
| --- | --- | --- | --- |
| Guardian (`guardian`) | +5 armour class | 1 | no |
| Aura of Courage (`courage`) | +5 to hit, spells' too | 2 | no |
| Aegis (`aegis`) | +2 resistance, +2 ward against every element | 2 | yes |

`statsIn(units, unit)` is `effectiveStats` plus the auras, which the engine reads at every roll and damage (its `statsOf`), its previews and the policies, so the odds shown include auras.

### Turn-start processing

As a side's turn begins, in this order:

1. statuses' damage over time (`status_tick`), unit by unit in roster order; a tick that ends the battle stops it here, before the rest;
2. regeneration (`regenerate` event): a unit with `regeneration` regains that many hit points unless a status with `stopsRegeneration` is on it (Corroded, Seared);
3. then, each a pass over the side's standing units in roster order and none drawing from the RNG:
   - Renewing (the `renewing` status's `regen`, 3, blocked as regeneration is);
   - Sanctuary (trait `sanctuary`: 3 to each unit of its side within 2, itself included, one heal a unit, the first Sanctuary in roster order named as `source`);
   - Serenity (`manaRegen`, up to the maximum mana);
   - Shadowdancer (trait `shadowdancer`: Mirrored with one image for 2 turns on a unit with no image left, a `status_laid` of cause `shadowdancer`);
   
   each heal or mana a `RestoreEvent` (cause `renewing`, `sanctuary` or `serenity`; a restore of 0 logs nothing);
4. the recharge count-down.

Also as the turn begins: `moved` and `refunded` go false, and status AP changes apply. The battle's first turn readies the player's side before `battle_start` is logged and runs these after it (`readySide`, `turnBegins`). `startTurn` returns events, as ticks may end the battle there.

As a side's turn ends, before its statuses count down, the Rooted rule runs (see Statuses).

## Rules of casting

### Targets

A unit whose stats have `magic` may cast a spell it knows, for the spell's action points and mana, at what the spell is aimed at (`Spell.target`):

- a standing foe within range;
- a standing ally within range (itself included);
- itself;
- an area: a hex of the board within range (its own for a spell of range 0, Bless and the Heal Alls) whose radius touches every standing unit around it;
- `fallen` (Revive): an ally at 0 hit points that fell this battle (`UnitRecord.fallenThisBattle`, set by `fellAll` and kept after it stands again; a unit that entered the battle at 0 never fell), within range (friendly range counting, as for an ally), on a hex no standing unit holds, which `castTouches` returns though it is down.

The cast action names a `target` unit or, for an area, the hex `at` its centre. A cast turns the caster to its aim, ends a paid-for change of gear as an attack does, and provokes nothing.

### Hostile and friendly spells

A hostile spell (offence, and Bane) rolls to hit each unit it touches, in roster order, as an attack does (`rollToHit`, then the dice on a hit, so the RNG is drawn from the same way), with the caster's spell skill for its chance and its own critical chance. Flanking and facing add nothing to it: the spell is the reliable strike, the blade the one that rewards position. A hostile area touches everyone in it, the caster's side and the caster included, and is illegal where it holds no foe. A cast that fells the last of both sides loses the battle, as the player's side is judged first.

A friendly spell never misses, touches only its own side and heals up to the maximum.

### Areas

A spell's area has a shape (`Spell.shape`, a burst when left out; a cone or line is aimed 1 to `range` hexes from the caster and reaches `range`), worked out by `areaOf`, which the scene also draws from. `castTouches` (over `areaTouches`) says whom a cast would touch, for the engine, the policies and the battle screen alike, and `previewCast` the odds on each.

### Elements and wards

A spell or a status's tick may have an element (`Spell.element`, `StatusRule.element`): Flame Arrow and Fireball fire, Frost Blast frost, Acid Arrow and Corroded acid, Death Cloud and Poisoned poison, Lightning Bolt lightning. A unit's ward against it takes its points off each hit (after a critical's doubling) and each tick (`warded`, recorded on the outcome and the tick as the points stopped, logged as "(warded N)"). A status is laid whatever the ward stopped, and a tick warded to 0 wakes no sleeper.

### Special spell fields

- `drain` (Drain Life): heals its caster that share of the hit points its targets lost (none for damage past what a target had left), rounded down and no more than it had lost (`CastEvent.drained`).
- `bane` (Holy Light): doubles its dice count against a unit `baneApplies` to, so it draws more only there.
- `bonusVs` (Ice Lance: chilled, slowed, webbed, asleep or frozen): rolls those dice too on a hit against a unit that had one of the statuses before the roll, right after its own and doubled with them on a critical, power and the ward then applied once.
- `oncePerBattle` (Revive): refused to a caster whose `UnitRecord.usedOnce` (saved in snapshots) holds it, so a unit revived and fallen again can come back only by another caster.
- Revive draws nothing: its target stands at max(1, ⌊maxHp / 4⌋), its statuses gone (no `status_end`), with no AP, no free attack and no turn to meet a blow, its `endured` kept, and its outcome says `revived` (`healed` the hit points it stands at). `checkWinner` is as ever, so a battle ends the moment a side is down and Revive can only come while an ally stands.
- `cleanse` (Purify): ends every status whose rule is `hostile` on its target, in the order laid, each logged as a `status_end` (reason `cleansed`) after the cast, then heals as any heal does.

### Caster modifiers

A caster's `magic` may carry modifiers from its nodes (`power`, `healBonus`, `extend`, `friendlyRange`, `apDiscount`, each left out when 0). All are flat and draw nothing, and monsters carry none.

- `power`, by element (`all`, `fire`, `frost`): added to each damaging outcome of its spells after a critical's doubling and before wards (never to a status's tick).
- `healBonus`: added to each heal before the cap.
- `extend`: turns added to the statuses its hostile or friendly spells lay (an ability's or a weapon's untouched).
- `friendlyRange`: added to a friendly spell aimed at an ally or an area of range above 0 (`spellRange`).
- `apDiscount`: off every spell (`all`) or a healing one (`heal`), never below 2 (`spellApCost`).

### Mana

Mana is a battle's budget: `UnitRecord.mana` starts at `magic.maxMana` whatever the character carried in and never comes back in battle (but for Serenity and `manaOnHit`). What a winner has left is copied back to its character, to heal with on the world map until the next battle; a level or a day of camping fills it.

## Statuses

Lasting effects are `UnitRecord.statuses`; `STATUSES` (`spells.ts`) says what each does, and `effectiveStats` adds that to armour class, resistance, the chance to hit and the ward against every element, which every roll reads (through `statsIn`, with the auras). Each has a nameplate letter (`mark`) and colour.

| Status | Letter | Effect | Hostile |
| --- | --- | --- | --- |
| Asleep | Z | helpless; damage that leaves it standing wakes it (reason `woke`) | yes |
| Chilled | C | AP −3 | yes |
| Corroded | A | AC −5, resistance −2, 1d4 acid a turn, stops regeneration | yes |
| Poisoned | P | 1d6 poison a turn | yes |
| Shielded | S | AC +15 | |
| Protected | D | AC +10 | |
| Blessed | B | to hit +10 | |
| Baned | X | to hit −15 | yes |
| Hasted | H | AP +3 | |
| Mirrored | M | each hit strikes an image instead (no damage dice) while images are left | |
| Seared | F | stops regeneration | yes |
| Cursed | K | to hit −15, AC −5 | yes |
| Webbed | W | AP −4 | yes |
| Warded | G | ward +4 against every element (`wardAll`) | |
| Marked | Y | AC −10 | yes |
| Slowed | L | AP −3 | yes |
| Pinned | N | `immobile` | yes |
| Taunted | T | −`TAUNT_PENALTY` at any unit but its source | yes |
| Rooted | R | AC +10, resistance +2 | |
| Renewing | U | heals 3 as its side's turn begins (`regen`) | |
| Frozen | I | helpless; damage does not end it | yes |

`hostile` marks a status a foe lays to harm, which is what Purify ends. The table is drawn from the code as of writing; `STATUSES` is the authority.

### Immunity

A unit with `CombatantStats.immune` is never laid a status whose rule has a `tick` (today Poisoned and Corroded), whatever would lay it: a spell, a rolled or `auto` area, a `foeStatus` ability, a routine's or technique's strike, a weapon's on-hit effect. `refusesStatus(stats, status)` (`spells.ts`) is the one test, read by the engine's `layStatus`, the policy and the foe hover panel. Every other status is laid on it as on any unit, and the damage of the blow that carried the status is dealt as ever (its wards are what stop that). The refusal draws nothing and changes no draw. It is recorded as `immune: true` on the `CastOutcome` (its `status` null) or on the `AttackEvent` (for the strike's status or any on-hit one; the statuses that were laid stay in `status` / `onHitStatuses`), absent otherwise (log schema 27), and `formatEvent` says "unaffected by the rest" after a hit's damage or "Stone Golem is unaffected." where nothing else landed. No unit has the flag until the Stone Golem (stage 11); a snapshot without the field reads as not immune.

### Duration and stacking

A status lasts its unit's own turns, counting the one under way if it is laid on its side's turn, and ends after the end of the last (`status_end`); laid again it takes the longer duration, and different ones stack. AP changes apply as the unit's turn begins, and at once on its own turn. Damage over time is dealt as its side's turn begins, unit by unit in roster order (`status_tick`). A unit that falls loses its statuses, and none outlasts the battle.

### Helpless

A `helpless` unit (Asleep, and Frozen from Glacial Prison; `isHelpless`) gets no AP, holds no zone of control and is struck with `HELPLESS_BONUS`. Damage ends a status that `wakesOnDamage` (Asleep) on a unit it leaves standing; Frozen has none, so it lasts its turns whatever hits it.

### Taunted, Pinned and Rooted

None of the three draws from the RNG.

- **Taunted** names its taunter (`ActiveStatus.source`, which no other status carries; a newer taunter replaces it, the longer duration kept). Every hostile roll of a taunted unit (an attack, a free attack, a strike, each unit a hostile spell or rolled area touches) at a unit other than its source loses `TAUNT_PENALTY` (25), taken off with the other bonuses before the 5–95 limits (`tauntPenalty`, which `previewAttack` and `previewCast` read too) and recorded as `tauntPenalty` on the `AttackEvent` or `CastOutcome` only when applied. When the taunter falls, Taunted ends on every unit it taunted (`status_end` reason `source_fell`, after the falls and before the battle's end).
- **Pinned** is `immobile`: `reachable` gives the unit no hex, so it has no legal move, while its attacks, casts, abilities and free attacks are untouched.
- **Rooted** is laid by the rule of the trait `rooted` (`CombatantStats.traits`, from the nodes' `trait`, `traitsOf`): as a side's turn ends, before its statuses count down, each of its standing units with the trait whose `UnitRecord.moved` is false (set false as its side's turn begins, true from its first step; in snapshots, and on a `UnitSnapshot` only once true) gets Rooted for 2 turns, logged as a `StatusLaidEvent` (cause `rooted`), so 1 is left through the other side's turn. The first step of a move ends it (`status_end` reason `moved`) before any free attack that step provokes is rolled.

## The `aggressive` policy

`aggressive` (`policies.ts`) gives each unit, in roster order, the first of these that applies, and acts with the first unit that has one. It reads a unit's actions from `legalFor` when given it (`autoPlay` does: the whole `legal` list is then never built, a step listing only the units it weighs) and else from `legal`; the two are the same actions, so its choice is the same.

1. Revive on a fallen ally whenever it is legal (`reviveCast`, kept from no heal reserve).
2. A heal when an ally is at half its hit points or less.
3. Purify on an ally asleep, frozen, poisoned, corroded or pinned (`purifyCast`).
4. Mirror Image or Shield (or Dark Shield) when a foe stands beside it.
5. Taunt (`tauntUse`) at half its hit points or more, where it would taunt two foes not yet taunted, or one within its own reach of an ally worse hurt (by share) than the user.
6. Support (`supportCast`): Mass Haste in its side's first two rounds where it touches two allies or more not hasted; else Renew where two allies or more in its radius are at 75% or less and none is renewing; else Haste on the first ally in roster order, not itself, that is not hasted; else Protect on the ally with a foe beside it, not protected, the most hurt by share.
7. A hostile area spell that touches two foes or more and no ally. A spell with damage counts only the foes its average damage gets through the ward of; the Web spell counts one foe or more not yet webbed; another spell that only lays a status (Bane) counts only the foes not under it yet and not immune to it (`refusesStatus`).
8. Bless on two allies or more.
9. Glacial Prison (`prisonCast`) and then Sleep on the healthiest foe not asleep or frozen and with no unit of its own side beside it (whose blows would wake it), while two stand.
10. Curse on the healthiest foe not yet cursed, while two stand.
11. Hunter's Mark (`markUse`) on the unmarked foe with the most hit points, when it has the AP to mark and then attack.
12. Its hardest-hitting spell on the weakest foe: its damage reckoned with the caster's spell power by element, after the foe's ward, statuses and auras counted through `statsIn`, with Ice Lance's `bonusVs` dice where the foe has one of its statuses and Holy Light's doubled where its bane applies.
13. Its best strike: the plain attack or routine of strikes that would do the most harm (each strike the chance to hit times an average hit through the foe's resistance, plus its weapon's on-hit damage through the foe's wards, a bane only where it applies; a routine the sum of its strikes'; a routine winning a tie). In its place:
    - a technique (an ability with `weaponAp`) whose `techniqueScore` is strictly higher: its strikes' expected harm (the strike's `toHit`, `damageBonus` and on-hit, `imbueDamage` included; a strike that `spreads` scored on the foe it would go to), plus each status it lays worth `STATUS_VALUE` (Seared: the target's regeneration; 0 on a foe immune to it) times the chance, where the foe lacks it, less `MANA_WEIGHT` (0.5) a point of mana, all times the uses that fit in the AP left this turn (once with a recharge, no more than its mana pays for above the heal reserve) over the plain blows that fit (at least one); so a 7 AP Power Attack and a 5 AP blow at 8 AP are one against one;
    - or an area ability with damage whose net harm is above 0 and above that strike's: each foe's chance to hit times the mean after its ward, plus half on a miss with `halfOnMiss`, less the same for its own side; the weapon's dice for `weaponDamage`, through resistance for `throughResistance`, double dice where a `bane` applies; less `MANA_WEIGHT` a point of mana.
14. An area ability that only lays a status with a roll (Web), where it touches a foe without it (and not immune to it) and none of its own side.
15. Sprint (`sprintUse`), when no foe is in reach and only Sprint's AP lets the closing move end with AP to strike.

A caster that knows a heal keeps the mana for its cheapest, as does a mana technique. Taunt, Mark and Sprint are known by their data (an `auto` area laying Taunted, a `foeStatus` laying Marked, a `selfStatus` laying Hasted), not by id.

A unit Taunted by a foe that stands keeps, in each step that has a hostile candidate on that foe, only those candidates, and closes on it rather than the nearest foe; every chance it reckons takes Taunted's penalty off (`tauntPenalty`).

Monsters have no technique. A caster of Bane (the Goblin Shaman, the Blight Horror) does not cast it where it would touch fewer than two units not already baned.

The policy judges how close to come by a damaging spell of one foe it has the mana for, at that spell's AP to it (`spellApCost`), else by its weapon. It works over the cast actions `legalActions` lists and what `castTouches` says a cast would touch, so an enemy caster needs only a stat block with `magic`.

## Gear mid-battle

Changing gear in battle is an `equip` action that `BattleScene` sends with newly derived stats (the engine knows stats, not items); it costs `EQUIP_AP_COST` (1 AP) once, further changes free until the unit moves or attacks or its turn ends (`equipCost`). The engine keeps the mana left within the new maximum and clamps `hp` to the new maximum (a Life rune put on mid-fight heals nothing). See the root `CLAUDE.md` for the panel's side.
