# A campaign to level 20: wider lands, new foes and special attacks

## 1. Purpose and status

A campaign today runs from level 1 to about level 7. The Source is fought at threat 5, which is the most dangerous a battle gets. The world was built for that arc: threat stops at `MAX_THREAT` (5), a foe's level is its threat, and every foe is one of seven kinds.

A trial run of 40 campaigns, with the simulator's `SOURCE_READY_LEVEL` raised to 20, showed what happens when a party plays on:
- It ran out of nests at levels 14 to 16, after about 105 battles and 1,000 days.
- It won 3,393 of 3,396 battles at threats 4 and 5.
- After about level 7 nothing was at stake.

This design makes a campaign take the party from level 1 to level 20. It does that in five parts:
- **Wider lands.** More threat zones, with bigger steps between threats past the early game.
- **Foes for every zone.** Humanoid opponents (bandits) and new monsters, high-level ones among them.
- **Special attacks:**
  - several strikes in one action;
  - area attacks such as a breath;
  - spells that only monsters cast.
- **Scaling that holds to level 20.** Foes are measured against how a hero actually grows.
- **A simulator that plays the long campaign,** including replacing heroes who die.

**Status: ready for planning, with assumptions.** Nothing blocks a first step. Section 8 records the decisions taken on the user's behalf; each can be changed without reshaping the rest. The monster roster in section 5.5 is a proposal. Its numbers are first values for the retune (R14) to move.

Related documents:
- [`blight.md`](../../blight.md): spawning, influence and the Source.
- [`spells.md`](../../spells.md): areas, statuses and the enemy caster.
- [`guild-hall-and-watchtowers.md`](../../guild-hall-and-watchtowers.md): recruits and permadeath.
- The rules of scaling in [`CLAUDE.md`](../../../../CLAUDE.md).

Where those documents and the code differ, the code is right.

## 2. Requirements and scope

### Functional requirements

| ID | Requirement |
| --- | --- |
| R1 | **Zones.** Threat is set by rings of distance from home, as now, but by a table. Threats 1 to 5 keep their 11-hex rings. Past that, the rings step to threats 7, 9, 12, 15 and 18, and the Source is fought at threat 20. |
| R2 | **A bigger map.** The map grows to hold the new rings, with fixed nests in each ring. Spawns follow the same rings. |
| R3 | **Threat no longer drives the blight in proportion.** A nest's push on the blight does not grow without limit with its threat. The early game's blight behaves as it does today. |
| R4 | **Native levels.** Every foe kind has a native level, the level its stat block is written for. Within its encounter it scales above that level with `foeAtLevel`, by the same steps as today. Today's kinds are native level 1, so threats 1 to 5 play exactly as now. |
| R5 | **Encounter bands.** Every encounter covers a band of threats. It is placed on the map, and spawned, only where the ring's threat lies in its band. Each encounter sets its own foe count for each threat in its band. |
| R6 | **Humanoid foes.** Bandits are built the way heroes are: a draft, levels, skill points and perks spent by `autoAdvance`, and gear. Their stats come from `deriveCombatStats`. The bandit encounters span threats 3 to 20, with better gear further out. |
| R7 | **New monsters** fill threats 7 to 20, including high-level ones, each with a sprite. |
| R8 | **Strike routines.** A foe may have a routine: one action that makes several weapon strikes (for example bite, claw, claw), each rolled and resisted as a weapon attack. |
| R9 | **Area attacks.** A foe may have an area attack: a cone, a line or a burst. Like a spell, it rolls against each unit it touches and ignores resistance. It may lay a status, may deal half damage on a miss, and recharges over a number of rounds rather than costing mana. |
| R10 | **Monster spells.** Some spells are known only to monsters. They never appear in the hero spell tree, and they may use the new cone and line shapes. |
| R11 | The **`aggressive` policy** uses routines, area attacks and monster spells by expected harm, sparing its own side. So the game's enemy and both sides in the simulator use them. |
| R12 | The **battle screen** shows a routine as its strikes, and shows an area attack's hexes and its outcome on each unit. The log names each. |
| R13 | **Replacing late losses:** *superseded by [`multiple-parties.md`](multiple-parties.md).* Recruits join at the guild hall's level. A second party trains them and promotes its best to the vanguard. |
| R14 | The **simulator** gains `--ready-level N`, which sets the level every member needs before marching on the Source. It also reports the levels reached, deaths and recruits by level, and battles won by threat up to 20. The long campaign is retuned until about two in three campaigns beat the Source. |

### Quality constraints

- The battle and world rules stay Phaser-free, and the simulator runs the same engine as the game.
- Stat blocks, abilities and spells stay plain data, so `sameCombatStats` and snapshots stay simple.
- Today's tuned early game, threats 1 to 5 against levels 1 to about 7, changes only where R3 or R13 force it. It is re-measured, not redesigned.
- A 500-campaign run must stay practical: minutes, not hours (see 6.3).

### Non-goals

- **Units bigger than one hex.** A dragon stands on one hex, as a goblin does.
- **Summoning, and monsters that move on the world map.** These are left to [`blight.md`](../../blight.md) section 4.9.
- **Hero-side growth beyond what exists:** grades above 3, new hero perks and new hero spells. Section 6.4 explains why this is the main risk, and where it would come in.
- **Simulator heroes changing weapons.** This is a separate follow-up.
- **New loot tables.** Further rings reuse `MAGIC_ITEMS`, and bandits drop no gear.
- **A redesign of the encampment, travel or fast travel.** Section 6.2 notes the cost of a long walk home.

### Acceptance criteria

| ID | Criterion | Requirements |
| --- | --- | --- |
| A1 | `threatAt` returns 1 to 5 at today's distances, and 7, 9, 12, 15 and 18 in the outer rings. The Source's location has threat 20. | R1 |
| A2 | Every fixed nest's encounter band contains its threat, and every spawned nest's does too (a property test over seeds). | R2, R5 |
| A3 | A campaign run with `--ready-level 7` and the new code behaves like today's within noise. The early game's results do not depend on the outer rings. | R3, R4 |
| A4 | `foeAtLevel(kind, native)` returns the kind's block unchanged. One level above native adds today's steps, with hit points scaled per 5.3. | R4 |
| A5 | A bandit at level L has the same `deriveCombatStats` as a hero built from the same draft and gear at level L. | R6 |
| A6 | Engine tests cover each new action: a routine's strikes, an area attack's touched hexes for each shape and its half-on-miss, recharge, and monster-spell casts. Each emits the events of 5.4. | R8–R10 |
| A7 | Policy tests show the enemy using a breath only when it hits more of its foes than its allies, and preferring a routine over a single strike. | R11 |
| A8 | Scene tests show a routine as one strike per strike event and an area attack's hexes, and the log reads correctly. | R12 |
| A9 | See [`multiple-parties.md`](multiple-parties.md) A10 and A12. | R13 |
| A10 | `make simulate ARGS="--campaign --ready-level 18 --battles 500 --seed 1"` reports how campaigns end. Most parties reach level 18 or more before the Source. About two in three beat it. No threat band is won 100% of the time by a party of its own level. | R14 |
| A11 | Every new kind has a native-level block within the yardstick bands of 5.2 (a unit test). | R4, R7 |

## 3. Current system (inspected)

- **Threat.** In [`src/game/worldMap.ts`](../../../../src/game/worldMap.ts), `threatAt` is `min(MAX_THREAT, 1 + floor(distance / THREAT_BAND))`, with `THREAT_BAND` = 11. `WORLD_SIZE` is 60 × 40, home is at offset (9, 19), and the Source is at (58, 19). `newWorld` lists the fixed locations by hand, each with its `EncounterId` and loot.
- **Encounters.** In [`src/game/encounters.ts`](../../../../src/game/encounters.ts):
  - `FOES_AT_THREAT` = [2, 3, 3, 3, 4] and `MAX_THREAT` = its length.
  - `encounter()` takes the first N `FoeSlot`s that take the field at the threat (`fromThreat`). It levels each foe to the threat and caps the level at `MAX_THREAT`.
  - `xpReward` is the sum of `FOE_XP[kind] × threat`.
  - `UnitKind` names sprites and prices experience.
- **Scaling.** In [`src/combat/combat.ts`](../../../../src/combat/combat.ts), `foeAtLevel` adds 70% of the level 1 hit points per level, 5 to-hit and 5 armour class per level, +1 damage every 2 levels, and 3 mana per level to casters. Resistance and regeneration do not scale. At level 20 a Goblin would have:
  - 172 hit points;
  - armour class 110;
  - to-hit 160.

  The rule cannot be stretched to 20.
- **How heroes grow.** This is the ready-made party under `autoAdvance`, measured for this design. "Hit" is the weapon or spell chance before armour.

  | Level | Fighter HP / AC / hit / damage | Archer HP / AC / hit | Mage HP / AC / spell skill / spells |
  | --- | --- | --- | --- |
  | 1 | 32 / 26 / 60 / 1d8+6 | 18 / 22 / 61 | 17 / 16 / 63 / 2 |
  | 5 | 58 / 26 / 82 / 1d8+6 | 40 / 22 / 83 | 33 / 21 / 91 / 6 |
  | 10 | 83 / 26 / 104 / 1d8+8 | 66 / 22 / 105 | 53 / 26 / 117 / 11 |
  | 15 | 108 / 36 / 114 / 1d8+8 | 86 / 27 / 115 | 73 / 26 / 138 / 16 |
  | 20 | 133 / 36 / 124 / 1d8+9 | 106 / 27 / 130 | 93 / 26 / 150 / 17 |

  Heroes grow in hit points (about 5 a level) and in chance to hit (about 3.5 a level, slowing near the 150 skill cap). Their armour class and damage hardly grow: grades stop at 3 and the gear is the same gear.
- **The blight.** In [`src/game/blight.ts`](../../../../src/game/blight.ts):
  - A nest pushes with `BLIGHT_PER_THREAT` (2) × threat, and the Source with 20.
  - Spawns choose from `SPAWN_KINDS` (Goblin Brood, Kobold Nest) and take `threatAt` of where they land.
  - `MAX_MONSTER_LOCATIONS` is 24.
  - `advanceDay` visits every hex once a day.
- **Spells and the engine.** In [`src/combat/spells.ts`](../../../../src/combat/spells.ts) and [`src/engine/battleEngine.ts`](../../../../src/engine/battleEngine.ts):
  - Areas are bursts only: a `radius` around a centre (`castTouches`, `areaHexes`). (As written; stage 2 replaced `areaHexes` with `areaOf` in `hex.ts`, with cones and lines.)
  - Monsters already cast through `CombatantStats.magic` (the Goblin Shaman).
  - Several attacks a turn already come from action points (the Troll's two claws).
  - Actions are `move`, `attack`, `cast`, `equip` and `end_turn`.
  - [`src/grid/hex.ts`](../../../../src/grid/hex.ts) has `hexLine`, `hexDirection` and `hexDirectionTowards`.
- **Recruits.** In [`src/game/guildHall.ts`](../../../../src/game/guildHall.ts), `recruitLevel` is `max(1, min(guildHall, lowest member level))`, with the hall at most level 3. In a long campaign a hero lost at level 15 is replaced at level 3.
- **The simulator.** In [`scripts/simulate.ts`](../../../../scripts/simulate.ts):
  - `SOURCE_READY_LEVEL` = 7 and `MAX_CAMPAIGN_DAYS` = 2000.
  - `nextTarget` goes to nests whose threat is no higher than the party's lowest level.
  - A 500-campaign run writes some 70 MB of log and takes about a minute.

## 4. Proposed behaviour

### 4.1 The shape of a campaign

| Ring (hexes from home) | Threat | Land | Foes (encounter bands) |
| --- | --- | --- | --- |
| 0–10 | 1 | Home | Goblin Raid, Kobold Scouts (1–5) |
| 11–21 | 2 | Near lands | as above, Hobgoblin Warband (2–3) |
| 22–32 | 3 | | as above, Bandit Camp (3–7) |
| 33–43 | 4 | | Troll Lair (4–5), Bandit Camp |
| 44–54 | 5 | | Troll Lair, Bandit Camp |
| 55–67 | 7 | Wildlands | Wolf Pack / Worg Riders (6–9), Spider Nest (6–9), Ogre Camp (7–10), Bandit Camp |
| 68–80 | 9 | Badlands | Ogre Camp, Wyvern Roost (9–12), Bandit Company (8–13) |
| 81–94 | 12 | Barrow lands | Barrow Wights (11–14), Hill Giant Steading (12–15), Basilisk Lair (11–14), Bandit Company |
| 95–108 | 15 | Blighted reach | Young Dragon (15–18), Golem Ruin (14–17), Blight Cult (14–18), Freebooter Host (14–20) |
| 109–122 | 18 | The heart | Blight Lich's Court (17–20), Elder Wyrm (18–20), Freebooter Host |
| Source | 20 | | Source Guardians (20) |

The party works outward as now (`nextTarget`).

Inside a ring it fights foes of a fixed threat while it gains levels, so the ring grows easier until the party is ready for the next. The jump into the next ring makes it hard again. That is the meaning of bigger steps between threats.

A party enters a ring when its lowest member's level reaches the ring's threat. Because XP is `FOE_XP × threat`, the curve already asks for about one level for every (L − 1) ÷ 3 battles fought at level. From 1 to 20 that is some 60 to 90 battles, against the trial's 105, most of them at foes below the party's level.

### 4.2 A battle with special attacks

**A Young Dragon (threat 15) on its turn:**
1. If its Fire Breath has recharged, the policy considers aiming it. A cone reaches 3 hexes from the dragon, toward an aim hex.
2. It scores the expected harm to the party touched, minus the harm to its own side.
3. If that beats its best strike routine, it breathes:
   - It rolls its to-hit against each unit's armour class.
   - A hit deals 6d6+L÷2, ignoring resistance, and lays Seared.
   - A miss deals half.
   - The breath then recharges for 3 rounds.
4. Otherwise it closes in and uses its routine, Bite (2d8) and two Claws (1d8 each). Each strike is a weapon attack, with flanking, arc and resistance as usual.

The player sees the cone drawn and every outcome logged. A unit downed by the breath is downed as by a spell.

**A Bandit Company (threat 9)** is a captain, crossbowmen, brutes and a hedge-mage:
- They are levelled heroes in mail and leather.
- They carry crossbows and shields, and cast the hero spells.
- They fight by the same policy as any foe, so they read as a mirror of the party.

### 4.3 Death and replacement

This is superseded by [`multiple-parties.md`](multiple-parties.md) §4.3. A second party of green heroes holds the home rings, and meets the vanguard to promote its best hero when the vanguard loses one. Recruits stay green, at the guild hall's level.

### 4.4 Edge cases

- **A routine whose target falls before the last strike:** each later strike goes to the nearest other foe within reach (lowest unit id on ties). If there is none, it is lost. The remaining strikes are logged as not made.
- **An area attack aimed so that it touches no foe:** the policy never chooses it. For the player's side it is not offered (no hero has one, by the non-goals).
- **Recharge:** the counter counts down at the start of the unit's side's turn, alongside the status ticks. A sleeping unit's recharge still counts down. Recharge state is kept in snapshots.
- **Threats outside a band:** they are never placed. `ENCOUNTERS[id](party, threat)` clamps a threat outside the band to the nearest end, as the cap at `MAX_THREAT` does today, so a debug command or an old save cannot crash.
- **A party that gains levels past its ring:** XP comes from `FOE_XP × threat`, with no penalty for a foe below the party's level. The XP curve still makes over-levelled fights slow to pay, as now.

## 5. Technical design

### 5.1 Zones and the map (R1–R3)

**[`src/game/worldMap.ts`](../../../../src/game/worldMap.ts)**

*Proposed:*
- `THREAT_RINGS: readonly { upTo: number; threat: number }[]`, the table of 4.1 (each `upTo` is the largest distance in the ring), and `SOURCE_THREAT = 20`.
- `threatAt(position)` returns the threat of the first ring whose `upTo` ≥ the distance, or the last ring's threat beyond the table.
- The Source's location sets `threat: SOURCE_THREAT` explicitly.
- `THREAT_BAND` goes; its few uses switch to the table.

**`WORLD_SIZE` (proposed)** is 140 × 72, with home at offset (9, 36). The 122-hex reach of the outer ring then fits east of home, and the rings to threat 5 keep today's widths.

**The fixed locations**
- Today's nests and resources are moved by the same offset as home (+17 rows), so the early game's geometry is unchanged.
- New nests and resources are placed by hand in each ring, as now: 4 to 6 nests and 2 to 3 resources a ring.
- The Source moves to about (131, 36).
- The implementer authors the coordinates and checks them with the test of A2.

**[`src/game/encounters.ts`](../../../../src/game/encounters.ts)**

*Proposed:*
- `ENCOUNTER_BANDS: Record<EncounterId, { min: number; max: number }>`
- `encountersFor(threat): EncounterId[]` (the encounters whose band holds it).

**Spawns.** In [`src/game/blight.ts`](../../../../src/game/blight.ts):
- `SPAWN_KINDS` gains entries for the new encounters.
- `spawn` picks among the kinds whose band holds `threatAt(at)`.
- `MAX_MONSTER_LOCATIONS` rises with the map, to 60 as a first value.
- `SPAWN_DIVISOR` is retuned so that spawn pressure per hex stays as today's.

**Blight strength (R3).** *Proposed:*
- `monsterStrength` = `BLIGHT_PER_THREAT × min(threat, BLIGHT_THREAT_CAP)`, with `BLIGHT_THREAT_CAP` = 5. A threat-18 nest pushes like a threat-5 nest, and the outer lands are blighted by their numbers, not by threats far past anything the encampment can push back.
- `SOURCE_STRENGTH` is unchanged.

Whether the outer rings should push harder is a retune question, with `BLIGHT_THREAT_CAP` as the lever.

### 5.2 The yardstick for foes (R4, R7, A11)

A foe at its native level N is written against the hero table of section 3. This yardstick is code, *proposed* in `combat.ts`:

```ts
/** What an even foe of level N looks like against the ready-made party of level N; bands for authored blocks. */
export function foeYardstick(level: number): {
  ac: [number, number]       // hero hit at N minus 55..35: a hero hits it 35–55% before flanking
  toHit: [number, number]    // 80..100: about 55–75% against hero armour class 22–36
  maxHp: [number, number]    // 3 to 6 average fighter hits (1d8+6..9): about 30–80 at any level
  meanDamage: [number, number] // a sixth to a tenth of the fighter's hit points at N, all strikes of a turn
}
```

The consequence is the main design point for high-level foes. Heroes grow in hit points and accuracy, not in damage or armour. So an even foe grows in armour class and damage, while its hit points stay within a few hero blows. An Elder Wyrm (level 18) is not 400 hit points. It is about 80 hit points with armour class 80, resistance 4, a breath and a routine that does about 20 a turn.

A unit test checks every kind's native-level block against the bands. A kind may sit outside a band on purpose, for example a golem's hit points or a kobold's armour, by naming the exception in the test.

### 5.3 Native levels and `foeAtLevel` (R4)

*Proposed* in [`src/combat/combat.ts`](../../../../src/combat/combat.ts):
- `FOE_NATIVE_LEVEL: Record<UnitKind, number>` lives in `encounters.ts`, beside `FOE_XP`. The stat block stays free of it.
- `foeAtLevel(base, level, native = 1)`, where `above = max(0, level - native)`:
  - To-hit, armour class, damage and mana use today's steps × `above`.
  - Hit points scale by the same growth a level-1 block would have: `maxHp = round(base.maxHp × (1 + FOE_HP_PER_LEVEL × (level − 1)) / (1 + FOE_HP_PER_LEVEL × (native − 1)))`.
  - With `native` = 1 both formulas reduce to today's, so A3 and A4 hold.
  - A level below native never occurs, because bands keep `min ≥ native`, and is clamped to native.

**Encounters.** `encounter()` takes the band and a `counts` array indexed by `threat − band.min`. Each foe is levelled to the threat, clamped to the band, with its own kind's native level. The levels are no longer capped at `MAX_THREAT`.

- `FoeSlot.fromThreat` stays. A kind whose native level is above the threat never takes the field, which `fromThreat` already expresses.
- Today's five encounters keep `FOES_AT_THREAT` as their counts, cut to their bands.
- `MAX_THREAT` is renamed `EARLY_THREAT_CAP` or removed. Its meaning moves to the bands.

**XP.** `xpReward` is unchanged in form, `FOE_XP[kind] × level`. New kinds get `FOE_XP` set by the yardstick: an even foe of level L is worth `EVEN_FOE_XP_PER_LEVEL × L`, so `FOE_XP` ≈ 100 × (strength relative to an even foe). [`progression.ts`](../../../../src/character/progression.ts) stays as is.

### 5.4 Special attacks (R8–R10, R12)

**Data**, *proposed* in a new [`src/combat/abilities.ts`](../../../../src/combat/abilities.ts) beside `spells.ts`:

```ts
export type AreaShape = 'burst' | 'cone' | 'line'

export interface Strike { name: string; damage: DamageRoll; status?: StatusLaid }

export interface Ability {
  name: string
  description: string
  apCost: number
  /** Rounds before it can be used again; 0 for every turn. */
  recharge: number
  /** A routine of weapon strikes at foes within the unit's reach... */
  strikes?: readonly Strike[]
  /** ...or an area, rolled like a hostile spell with the unit's toHit, ignoring resistance. */
  area?: { shape: AreaShape; range: number; radius?: number; damage: DamageRoll; status?: StatusLaid; halfOnMiss: boolean }
}

export const ABILITIES: Record<AbilityId, Ability>
```

`CombatantStats` gains `abilities?: readonly AbilityId[]`, and `sameCombatStats` compares it. `foeAtLevel` adds its damage step to every ability's damage, as it does to the weapon.

**Shapes**, *proposed* in [`src/grid/hex.ts`](../../../../src/grid/hex.ts): `areaOf(shape, origin, aim, range, radius)`.
- **Burst:** within `radius` of `aim`, which must be within `range` of the origin. This is today's spell rule.
- **Line:** `hexLine(origin, aim)` extended to `range` hexes, the origin excluded.
- **Cone:** the hexes within `range` of the origin whose direction from the origin is within 30° of the direction to `aim` (a 60° wedge), the origin excluded.

`castTouches` generalises to `areaTouches(units, origin, area, aim)`, which spells and abilities share. The engine, the policies and the scene all use it, so they keep agreeing on what an area touches. `Spell` gains an optional `shape` (default `'burst'`).

**Monster spells (R10).**
- *Proposed:* `MONSTER_SPELL_IDS`, `SpellId = HeroSpellId | MonsterSpellId`.
- `SPELL_IDS` stays the heroes' list, which the spell tree, perks and `worldCasting` read.
- First spells:
  - **Lightning Bolt:** line 6, 4d6.
  - **Drain Life:** foe, 3d6, heals the caster for half.
  - **Curse:** foe; lays a new status, Cursed (−15 to hit and −5 armour class, 3 turns).
  - **Web:** burst 1 at range 4; lays Webbed (−4 action points, 2 turns) and deals no damage.
  - **Dark Shield:** self; reuses Shielded.

**Actions and events**, in [`src/engine/battleEngine.ts`](../../../../src/engine/battleEngine.ts):
- New action: `{ type: 'ability'; unit; ability; target: UnitId } | { type: 'ability'; unit; ability; at: Hex }`. A routine takes a target and an area takes `at`. `legalActions` lists them while the AP and the recharge allow.
- **A routine** emits one `AttackEvent` per strike, with a new optional field `strike: string` (the strike's name) and `ability: AbilityId`. The scene's attack animation, sounds and log line stay as they are and name the strike ("Young Dragon bites Aldric…"). A strike not made emits nothing.
- **An area** emits a new `AbilityEvent` shaped like `CastEvent`:
  - It has `unit`, `ability`, `at`, `shape`, `hexes`, `apCost`, `apAfter`, `facing`, `skill` and `outcomes: CastOutcome[]`.
  - `CastOutcome` gains `half: boolean`, true for half-on-miss damage.
  - A new `RechargeEvent` is not needed. The recharge is visible in the snapshot.
- `UnitRecord` and `UnitSnapshot` gain `recharging: Partial<Record<AbilityId, number>>`. It counts down at the start of the unit's side's turn, after status ticks and regeneration.
- Bump `LOG_SCHEMA_VERSION` (new event and fields) and `SAVE_VERSION` (snapshot shape, the map and new locations).

**The scene** ([`src/scenes/BattleScene.ts`](../../../../src/scenes/BattleScene.ts) and its helpers):
- `AbilityEvent` reuses the spell-effect path ([`battleEffects.ts`](../../../../src/scenes/battleEffects.ts)) with the touched hexes drawn.
- `eventSchedule.ts` and `sounds.ts` get entries for it.
- A foe's tooltip lists its abilities and their recharge.

### 5.5 The roster (R6, R7)

**Humanoids (R6).** *Proposed* in a new [`src/game/bandits.ts`](../../../../src/game/bandits.ts):
- `banditStats(role, level, tier): CombatantStats` builds a `Character` from a role's draft, raises it with `levelUp` and `autoAdvance`, equips the tier's gear, and returns `deriveCombatStats`.
- The roles are:
  - **Cutthroat:** dagger.
  - **Crossbowman:** a new Crossbow weapon (6 AP, 1d10, piercing 2), added to the inventory for heroes too.
  - **Brute:** battle axe and mail.
  - **Hedge-Mage:** wand, Magic Arrow, Flame Arrow and Shield.
  - **Captain:** longsword, shield, steel armour and perks.
- The gear tier follows the ring: grade 0 at threats 3–5, 1 at 7–9, 2 at 12, 3 at 15+, with modifiers from 12 on.
- Their `FOE_XP` is 100: an even foe by construction.
- A bandit's level is the threat. Encounters:
  - **Bandit Camp** (3–7): 3–4 foes.
  - **Bandit Company** (8–13): 4.
  - **Freebooter Host** (14–20): 4–5, with a Captain.

  Each new role needs a sprite.

**Monsters (R7)** have authored native blocks against 5.2. These are first values:

| Kind | Native | Role | Defence | Special |
| --- | --- | --- | --- | --- |
| Wolf | 6 | fast skirmisher (10 AP) | — | Pack: +10 to hit beside another wolf (a flanking variant; or none at first) |
| Worg Rider | 7 | goblin on a worg | res 1 | Routine: Spear, Bite |
| Giant Spider | 6 | ambusher | res 1 | Web (as the monster spell, recharge 3); poisoned bite |
| Ogre | 7 | brute | res 2 | Sweep: a routine striking each adjacent foe once |
| Wyvern | 9 | flyer (moves over units) | res 2 | Routine: Bite, Tail sting (poison) |
| Barrow Wight | 11 | undead | res 3 | Drain Life; struck only half by non-magic weapons? *(deferred; plain resistance at first)* |
| Basilisk | 11 | slow, tough | res 4 | Gaze: cone 3, lays Chilled (as slowed), recharge 2 |
| Hill Giant | 12 | heavy | res 3 | Routine: Club; ranged Rock (range 4) as a second ability |
| Stone Golem | 14 | wall | res 8 (a piercing check) | Slam; immune to statuses that tick (a `StatusRule` flag) |
| Blight Cultist | 14 | caster | res 1 | Lightning Bolt, Curse, Heal |
| Young Dragon | 15 | boss of its nest | res 4 | Fire Breath (cone 3, 6d6, half on miss, recharge 3); routine Bite, Claw, Claw |
| Blight Lich | 17 | caster boss | res 3, regenerates 3 | Lightning Bolt, Death Cloud, Drain Life, Dark Shield |
| Elder Wyrm | 18 | top threat | res 5 | Breath (cone 4, 8d6); routine; regenerates 2 |
| Blight Horror (Source) | 20 | final boss | res 3 | Blight Breath (burst 2 around itself, acid, lays Corroded); routine; regenerates 2 |

Each row is a stat block, a `UnitKind`, a `FOE_XP`, a `FOE_NATIVE_LEVEL` and a sprite (`art/units/*.sprite.toml`, drawn by a subagent per [`sprite-drawing-guidance.md`](../../sprite-drawing-guidance.md)).

Two behaviours in the table are flagged as small engine additions, each optional in the first pass:
- the wolf's pack bonus;
- the wyvern moving over units.

Each nest's encounter is a lead kind with its minions, as Troll Lair is. The implementer may trim the roster for a first pass (see 7.3): one new encounter per ring is enough to run the campaign.

### 5.6 Recruits (R13)

This is superseded by [`multiple-parties.md`](multiple-parties.md) §4.1 and §5.2: `recruitLevel` is the guild hall's level, and the hall's levels 4 and 5 add parties.

### 5.7 The simulator (R14)

In [`scripts/simulate.ts`](../../../../scripts/simulate.ts):
- `--ready-level N` (default `SOURCE_READY_LEVEL`) is threaded into `nextTarget`.
- `SOURCE_READY_LEVEL` becomes 18 once the outer rings exist. Until then it stays 7.
- `MAX_CAMPAIGN_DAYS` rises to 6000.
- The threat table in the summary prints rows to 20.
- `CampaignRecord` gains:
  - `finalLevels`;
  - `deathsAtLevel: number[]`;
  - `recruitLevels: number[]`;
  - `battlesToLevel: Record<number, number>`, the battle count when the lowest member reached 5, 10, 15 and 20.
- The summary prints their averages.
- *Proposed:* `--log none`, which skips the JSONL so long runs need not write hundreds of MB. Summaries are computed from the events in memory per battle instead.

## 6. Consequences

### 6.1 Compatibility

- **Saves.** The map size, location list and snapshot all change, so `SAVE_VERSION` is bumped. Old saves show as unreadable, which is the project's practice.
- **Logs.** `LOG_SCHEMA_VERSION` is bumped for the new event and fields.

### 6.2 Play

- **Travel time.** The walk from the outer ring to the guild hall is some 120 days each way, so a late death costs most of a season. The blight goes on meanwhile, and that is a real risk the long campaign exposes.
- **Fast travel is not in scope.** If the retune shows the round trip dominating, the lever is a hall errand at an outpost. That would be a later design.

### 6.3 Performance

- The map is about 4.2 times as many hexes, and campaigns are 3 to 4 times as many days and battles.
- A 500-campaign run would grow from about a minute to some 15 to 20 minutes, and logs to over 1 GB without `--log none`.
- The simulator's default should be measured. If it is too slow, the cost is in `advanceDay`'s per-hex loop: the next lever is skipping hexes far from any source of influence, a separate change.

### 6.4 The hero ceiling (the main risk)

Heroes' armour class and damage hardly grow, as the table in section 3 shows. The yardstick works around this, by keeping foes' hit points within a few blows and moving danger into armour class, damage and abilities. But two problems remain:
- **Battles may feel alike at 5 and at 18.**
- **Armour can wall off a party.** A level-20 party still swings 1d8+9, so resistance 5 or more stops most of it. The simulator's heroes never change weapons (the Armoured Troll lesson).

If the retune cannot reach about two in three without making high rings trivial or walls, the next step is hero-side. Its levers are:
- grades 4 and 5 at the trading post and workshop;
- a damage perk line;
- higher-tier spells.

That design is [`gear-and-runes.md`](gear-and-runes.md): material tiers, more families, forging and runes. Its expected kit at each level (§5.8 there) replaces the bare hero table of section 3 as the hero side of the yardstick in 5.2.

### 6.5 Tuning

The early game's figure (64% from seed 1) is kept as a regression check with `--ready-level 7`, which exercises only rings 1 to 5. The long figure becomes the new headline in CLAUDE.md's rules of scaling, which are rewritten for zones, bands and native levels.

## 7. Verification

### 7.1 Tests

Tests run under `make test` (podman, Node 26). The domain project can be run locally with `npx vitest run --project domain`.

- **`worldMap.test.ts`:**
  - the ring table (A1);
  - every fixed nest's band holds its threat (A2);
  - home-ring geometry unchanged up to the offset.
- **`blight.test.ts`:**
  - spawn kinds by ring, over many seeds (A2);
  - the capped strength (R3).
- **`combat.test.ts`:**
  - `foeAtLevel` with native levels (A4);
  - the yardstick bands over every kind (A11);
  - `sameCombatStats` with abilities.
- **`hex.test.ts`:** the cone, line and burst shapes, worked on small boards.
- **`battleEngine.test.ts`** (A6):
  - a routine's strikes and retargeting;
  - area outcomes, half on miss and resistance ignored;
  - recharge counting down and blocking;
  - monster spells;
  - events, snapshot round-trips and the schema version.
- **`policies.test.ts`** (A7): breath only when net harm is positive; routine preferred; recharge respected.
- **`bandits.test.ts`:** a bandit equals a hero of the same draft and gear (A5).
- **`guildHall.test.ts`:** `recruitLevel` (A9).
- **Scene tests:** the ability event's effect, schedule and sound, and the log text (A8).
- **`scripts/simulate.test.ts`:** `--ready-level` parsing and the new record fields.

### 7.2 Simulator acceptance

1. `make simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"` stays near today's 320 of 500 (A3).
2. `--party-level L --encounter X --threat T` cells for each new encounter at its band's ends. A party of the threat's level should win most battles, but not all (A10).
3. `make simulate ARGS="--campaign --battles 500 --seed 1"`, with the ready level 18, is retuned toward about two in three, reporting levels reached, deaths and recruits by level, and battles to level (A10, R14).

### 7.3 Suggested order (for the planner)

Each step is a working game and a measured simulator run:

1. **Scaling infrastructure:**
   - native levels;
   - encounter bands and counts;
   - the ring table at today's map size (rings past 5 unused);
   - `--ready-level`;
   - the record fields;
   - the recruit rule.

   Check A3.
2. **The bigger map:** rings to 18, the Source at 20, and capped blight strength. Fill the outer rings with Bandit encounters only (R6), since they scale by construction. This gives the first long campaign.
3. **Abilities:** shapes, routines, area attacks, recharge, monster spells, the policy and the scene.
4. **The roster:** monster kinds ring by ring, with sprites and nests, each ring retuned as it lands.
5. **The final retune,** the Source's guardians at 20, and the documentation (CLAUDE.md rules of scaling, the manual's foes and the threat tables).

## 8. Open questions and assumptions

None of these block step 1. They are recorded with the default taken.

| # | Question | Default taken |
| --- | --- | --- |
| 8.1 | Ring threats past 5: 7, 9, 12, 15 and 18, then 20 at the Source? | Yes. The steps widen as levels cost more. |
| 8.2 | Bandits built from hero rules, rather than authored blocks? | Yes. It gives humanoid foes that scale to any level for free, and they mirror the party. |
| 8.3 | Area attacks ignore resistance and deal half on a miss? | Ignore resistance, as spells do. Half on a miss for breaths only (`halfOnMiss` per ability); monster spells keep the spell rule. |
| 8.4 | How are late losses replaced? | This is settled in [`multiple-parties.md`](multiple-parties.md): green recruits are trained by a second party and promoted. |
| 8.5 | Every unit stays one hex? | Yes. Large units are a separate engine design. |
| 8.6 | Blight strength capped at threat 5's push? | Yes, as a first value; the cap is the lever. |
| 8.7 | Map 140 × 72, with nests and resources placed by hand per ring? | Yes. Procedural placement is not in scope. |
| 8.8 | Should heroes gain damage or grades past 3 for the long campaign? | Not here (6.4). Revisit after step 2's measurement. |
| 8.9 | Wolf pack bonus, wyvern flight, a wight's resistance to non-magic weapons? | Deferred. They are plain blocks first. |

**Risks:**
- the hero ceiling (6.4);
- the simulator's runtime (6.3);
- the long walk home after a late death (6.2);
- the blight's balance on a map four times the size, which [`blight.md`](../../blight.md)'s numbers were not set for.
