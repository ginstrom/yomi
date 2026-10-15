# The Blight

## 1. Purpose and status

The party was sent out to fight an encroaching evil. When the game begins, blight is already eating the land, and the party must push it back. The endgame is to destroy the blight's source. This gives the world map what it lacks now, which is a reason for time to matter. Today, travelling, waiting and camping cost nothing, so "Camp until healed" is a free full heal before every battle. With this design, every day the party spends is a day the blight grows.

**Status: summary proposal, for iteration.** This document covers the shape of the system and gives provisional numbers. Section 7 lists the decisions to settle before a detailed design and plan. Every constant here is a starting point for the simulator, not a decision.

Related: [expeditions-and-encampment.md](expeditions-and-encampment.md) §5 sketches territory and announced threats. This design takes on its "later threat system" and keeps its rule that a site under threat is announced with time to respond.

## 2. The loop

```
monsters ──(threat per day)──▶ blight spreads ──▶ corrupted land spawns monsters
    ▲                                                        │
    └──── party defeats monsters, cleanses land, holds sites ◀┘
```

| ID | Requirement |
| --- | --- |
| R1 | The world map has blight, a level per hex: 0 is clean, 1 tainted, 2 blighted and 3 corrupted. A new game starts with blight around the Source and its nearest monster locations. |
| R2 | Blight grows each world turn, in proportion to the threat of the monsters standing in it. |
| R3 | Corrupted land spawns new monster locations over time. |
| R4 | Defeating a monster location cleanses the blight around it. |
| R5 | Towns and resources can be captured. A held site wards the land around it and can be lost to a siege that the player is warned about. |
| R6 | The Source is a final monster location, far from home. Defeating it wins the game. |
| R7 | Every world turn counts, including each hex of a journey and each day of camping. |
| R8 | The same world seed and the same choices give the same blight and the same spawns. The rules stay Phaser-free, like the battle rules. |

Non-goals for now: blight changing a battle's board or rules, economy or resources from held sites, more than one party, and fog of war.

## 3. Rules (provisional)

### 3.1 Blight and spread

- `WorldState.blight` holds a level 0–3 for each hex, stored sparsely: only hexes above 0 are kept.
- **Sources:** every monster location is a source with a strength equal to its `threat`. The Source itself has a strength of `SOURCE_STRENGTH` (8).
- **Pressure:** each world turn, each source adds its strength to its own pressure. Each time a source's pressure reaches `SPREAD_COST` (12), it pays that cost and raises one hex of its **frontier** by a level. The frontier is the hexes below level 3 that touch the source's blight, or the source's own hex, and are not warded. The hex raised is the frontier hex nearest the source, with ties broken by the world RNG.
- **Effect:** a threat-1 nest creeps out about once every 12 days, and a threat-5 nest about once every 2–3 days. Far, dangerous lands spread fastest, and they fill up before the party can reach them, which is the pressure we want.

### 3.2 Spawning

- Each world turn, `spawnPressure` increases by the number of corrupted hexes divided by `SPAWN_DIVISOR` (10).
- When it reaches `SPAWN_COST` (30), a new monster location appears on a corrupted hex. That hex must be at least `SPAWN_CLEARANCE` (4) hexes from the party, other monster locations and held sites.
- The new location's encounter is drawn from `ENCOUNTERS`. Its threat is `threatAt(position)`, so distance from home still sets danger, and its loot is none or a small draw. A spawn is itself a source, so unchecked blight compounds.
- `MAX_MONSTER_LOCATIONS` (24) caps the number of monster locations so that a neglected map is grim but finite.

### 3.3 Pushing back

- **Victory:** winning at a monster location removes it, as today, and with it its source. It also lowers blight by 2 levels within `CLEANSE_RADIUS` hexes, where the radius is 1 + threat. Beating far monsters therefore cleanses more.
- **Capture:** a town or resource is captured when the party stands on it, its hex is below level 2, and no monster location lies within `CLAIM_RADIUS` (3) hexes. Oakvale is held from the start.
- **Holding:** a held site wards every hex within `WARD_RADIUS` (3). Blight cannot spread into a warded hex, and every `WARD_CLEANSE_DAYS` (5) days the ward lowers one hex in its radius by a level.
- **Siege:** when a monster location stands within `WARD_RADIUS` + 2 of a held site, because it spawned there or blight brought it, a siege begins. The map shows the countdown, `SIEGE_DAYS` (10). The siege is lifted if the party beats those monsters before the countdown ends. Otherwise the site falls: it is no longer held, its ward is gone, and its hex becomes blighted. A fallen site can be recaptured.

### 3.4 The Source and the end

- **The Source:** a monster location in the far east corner at threat `MAX_THREAT`. It has an encounter of its own (a boss with escorts, to be designed) and the strongest spread.
- **Victory:** beating the Source wins the game. Remaining blight stops being fed by it but can still be cleaned up. Whether that cleanup is optional is an open question (§7).
- **Defeat:** the game is lost when the party wipes, as today, or when Oakvale falls (proposed).

### 3.5 Time

- `travel` steps through every turn of a route, so blight and spawns happen mid-journey. A spawn on the route does not interrupt travel in the first version.
- `campDay`, `linger` and each hex of travel advance the blight once. "Camp until healed" now has a visible cost. Its message reports what grew, for example `Camped 6 days: 31 hp healed. The blight spread 4 hexes.`

## 4. Technical shape

- **`src/game/blight.ts` (proposed, Phaser-free):**
  - Blight levels and the constants above.
  - `advanceDay(world)`: spread, spawning, ward cleansing and siege countdowns for one turn. It returns events such as `spread`, `spawned`, `siege_started` and `site_fell`, so the scene can report what happened.
  - `cleanse(world, location)` for victories, and `capture(world)`.
- **`worldMap.ts`:**
  - Turns advance through one function, `passTurn(world)`, which increments `turn` and calls `advanceDay`. `travel`, `linger` and `campDay` use it.
  - `WorldState` gains `blight`, per-source pressure, `spawnPressure`, the `held` site ids, sieges and the world RNG state (`mulberry32` with `state()`, as a battle's is). This changes the save shape, so `SAVE_VERSION` goes up.
- **`WorldScene`:**
  - Tints hexes by blight level, flags held sites and shows siege countdowns.
  - Shows a footer line such as `Blight: 18% of the land`.
  - Reports what the events returned after each action.
- **Simulator:**
  - `--campaign` already walks nearest-first and camps until healed, so it now pays for the time it spends.
  - New metrics: blight share at the end, monsters spawned, sites lost, and whether the Source fell.
  - The policy needs a rule for when to attack the Source.

## 5. Phasing

1. **Blight and its spread from monster locations,** plus cleansing on victory, map tinting, and a cost to time. This is playable alone and puts a price on camping.
2. **Spawning.**
3. **Capture, wards and sieges.**
4. **The Source,** its encounter, and winning and losing.

Each phase gets a campaign retune (§6).

## 6. Balance

The current target, clearing the map about 2 times in 3, stops meaning much once the map refills itself. A proposed replacement is that the simulator's careful party **beats the Source about 2 times in 3**, with blight under some share of the land when it does. The levers are, in order:

1. `SPREAD_COST`
2. `SPAWN_COST`
3. `CLEANSE_RADIUS`
4. the Source's encounter

`FOES_AT_THREAT` should not move for this. Spawns add experience as well as danger, so judge changes by campaign runs.

## 7. Open questions

1. **Per-hex blight levels or a simpler binary:** levels give a visible gradient and something for wards to wear down. Binary halves the rules. This design proposes levels.
2. **Should threat follow blight instead of distance?** One example: a spawn's threat could be the level of the hex plus a distance band. Distance-based threat keeps the current tuning, so it is the proposal for now.
3. **What does holding a site give besides its ward?** Examples: recovery at a town, or the encampment design's services. This design gives only the ward.
4. **Does Oakvale falling lose the game, or is the party wipe the only loss?**
5. **After the Source falls, does the game end at once,** or must the remaining blight be cleansed?
6. **Does blight touch battles?** For example, corrupted ground could weaken healing or strengthen foes. Out of scope here, but cheap to add later through the encounter setup.
7. **Should a spawn or a siege beginning interrupt a journey or a camp?** Proposed for later. "Camp until healed" stopping when a siege begins is the most likely first case.
