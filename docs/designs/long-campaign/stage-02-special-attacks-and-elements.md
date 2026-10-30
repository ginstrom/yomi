# Stage 2: Special attacks and elements

Part of [the long campaign](index.md). Reference:
- [`reference/campaign-to-level-20.md`](reference/campaign-to-level-20.md) §4.2, §4.4 and §5.4;
- [`reference/gear-and-runes.md`](reference/gear-and-runes.md) §4.6 and §5.3 (elements and wards only).

## 1. Purpose and status

Monsters learn to fight in new ways:
- **Strike routines:** several weapon strikes as one action.
- **Area attacks:** cones, lines and bursts, which recharge rather than cost mana.
- **Monster-only spells.**
- **Elements.** Spells, area attacks and status ticks gain an element, and monsters can carry wards against them.

Two new nests on today's map show all of this in play.

Hero wards and weapon on-hit damage come with runes (stage 4). This stage builds the battle rules they need.

**Status:** ready for planning.

## 2. Scope

**In:**
- **Abilities.** `src/combat/abilities.ts` (campaign §5.4): `Ability`, `Strike`, `AreaShape`, `ABILITIES`, `CombatantStats.abilities`.
- **Shapes.** `areaOf(shape, origin, aim, range, radius)` in `hex.ts`, and `areaTouches` shared by spells and abilities. `Spell` gains `shape` (default burst).
- **The engine:**
  - the `ability` action;
  - a routine emits per-strike `AttackEvent`s with `strike` and `ability`;
  - an area emits an `AbilityEvent`, and `CastOutcome.half` is added;
  - `recharging` on units and snapshots, counting down at the start of the unit's side's turn after ticks and regeneration;
  - half on a miss.
- **Monster spells.** `MONSTER_SPELL_IDS` (Lightning Bolt, Drain Life, Curse, Web, Dark Shield) and the statuses Cursed and Webbed. Monster spells never reach the hero spell tree.
- **Elements and wards:**
  - `Element`, `ELEMENTS`, `element` on spells, status rules and area abilities, `CombatantStats.wards`;
  - `warded()` applied to cast outcomes, area outcomes and status ticks;
  - `CastOutcome.warded` and `StatusTickEvent.warded`.

  The elements of today's spells and statuses are as in gear §4.6. Weapon `onHit` and hero wards wait for stage 4.
- **The policy.** The `aggressive` policy scores routines by summed expected harm, areas by expected harm to foes minus harm to allies (wards included), and monster spells by expected harm. It respects recharge.
- **The scene:**
  - the routine plays as successive strikes;
  - the `AbilityEvent` reuses the spell effect path, with the touched hexes drawn;
  - schedule and sound entries;
  - log lines ("breathes fire", "warded 4");
  - a foe's tooltip lists its abilities, their recharge, and its wards.
- **Two new kinds and nests on today's map**, inside the threat 4 and 5 rings:

  | Kind | Native | Block (first values) | Special |
  | --- | --- | --- | --- |
  | Giant Spider | 4 | HP 20, AC 25, to hit 80, 1d6+2 bite, resistance 1 | Routine: Bite (1d6+2), Bite (lays Poisoned). The Web spell at range 4, recharge 3. |
  | Salamander | 5 | HP 26, AC 30, to hit 85, 1d8+2 claws, resistance 2, fire ward 99 | Fire Spit: cone 2, 3d6 fire, half on a miss, lays Seared, recharge 2 |

  The encounters are:
  - **Spider Nest:** band 4–5, Giant Spider, Kobold Sneak and Giant Spider.
  - **Salamander Pool:** band 5, Salamander with Kobolds.

  They replace the Troll Den (54, 28) and the Goblin Pillagers (57, 10). Both get `FOE_XP` set by the yardstick, and sprites.
- **Existing kinds.** The Troll swaps its two-claw action points for a routine: Claw, Claw as one 4-AP action, with the same expected damage. Nothing else changes.

**Out:**
- weapon on-hit damage and hero wards (stage 4);
- the high roster (stage 11);
- reach weapons (stage 3).

## 3. Requirements

| ID | Requirement | Reference |
| --- | --- | --- |
| S2-R1 | Strike routines, with retargeting when a target falls. | campaign R8, §4.4, §5.4 |
| S2-R2 | Area attacks in cone, line and burst, with recharge and half on a miss. They ignore resistance. | campaign R9, §5.4 |
| S2-R3 | Monster spells, never learnable by heroes. | campaign R10 |
| S2-R4 | Elements on spells, statuses and areas; monster wards; `warded` in the log. | gear R12 (all but on-hit) |
| S2-R5 | The policy uses routines, areas and monster spells by expected harm, sparing its own side. | campaign R11 |
| S2-R6 | The scene shows routines, areas (hexes and outcomes) and abilities in tooltips. | campaign R12 |
| S2-R7 | The Giant Spider and the Salamander, with their nests, map places and sprites. The Troll's routine. | — |

## 4. What the player sees

- **A Salamander** turns toward the front rank and spits a cone of fire. The cone's hexes flash, and every unit in it, its own kobolds included, takes fire damage. A miss still burns for half. The trolls next door have a reason to fear it, and so does the party: Seared stops nothing on a hero, but the damage is real. Its fire ward makes Flame Arrow and Fireball useless against it.
- **Giant Spiders** web the party's archer from range, which takes 4 AP from it for 2 turns, then close and bite twice, the second bite poisoning.
- **Hovering a foe** lists its abilities, with "ready" or "recharging, 2 rounds", and its wards.

## 5. Technical notes

- **Data stays plain:** abilities by id, as spells are. `sameCombatStats` compares `abilities` and `wards`. `foeAtLevel` adds its damage step to ability damage.
- **`legalActions`** lists abilities when AP and recharge allow. Area aims are the hexes from which the area touches at least one unit.
- **Versions:**
  - `LOG_SCHEMA_VERSION` is bumped (AbilityEvent, `strike`, `half`, `warded`).
  - `SAVE_VERSION` is bumped (the snapshot's `recharging`, and the replaced locations).

## 6. Verification

**Tests:**
- `hex.test.ts`: the cone, line and burst on small boards, for each of the 6 directions.
- `battleEngine.test.ts`:
  - routine strikes and retargeting;
  - area outcomes, half on a miss, resistance ignored, wards applied;
  - recharge countdown and blocking;
  - monster spells (Drain Life heals the caster, Web lays Webbed);
  - ticks warded;
  - snapshot round-trip;
  - schema version.
- `policies.test.ts`:
  - breath only when net harm is positive;
  - a routine preferred over a single strike;
  - recharge respected;
  - a warded target scored lower.
- `spells.test.ts` and `perks.test.ts`: the hero spell tree never lists monster spells.
- Scene tests: the AbilityEvent effect, schedule and sound; log text; tooltip lines.

**Simulator:**
1. The early-game guard.
2. `--encounter spider_nest --threat 4 --party-level 4` and `--encounter salamander_pool --threat 5 --party-level 5`: hard but winnable. Tune recharge and damage first.
3. `--encounter troll_lair --threat 4 --party-level 4`: unchanged within noise, after the routine change.

**Play script:**
1. Run `fight salamander_pool 5` with the party levelled (`xp`). Bunch the party and watch the spit hit several units and burn one kobold. Spread out and watch the policy aim for the most heroes. Cast Flame Arrow at it, and see "warded" in the log.
2. Run `fight spider_nest 4`. See Web land on a hero from range, and the hero's AP shrink next turn. See a bite routine strike twice, then retarget when the first target drops.
3. Fight a Troll Lair. See Claw, Claw as one action in the log.
4. Save mid-battle and reload. A recharging ability is still recharging.

## 7. Risks

- **A cone aimed by the policy can still hurt its own side.** That is intended, but check the policy's ally penalty in play.
- **Half on a miss makes breath reliable.** Keep the recharge at 2 or more.

**Done when:** all tests pass, the guard holds, the two nests are hard but fair at their threats, and the play script has been walked.
