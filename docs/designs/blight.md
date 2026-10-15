# The Blight

## 1. Purpose and status

The party was sent out to fight an encroaching evil. When the game begins, blight is already eating the land, and the party has to push it back. The endgame is to destroy the blight's source. After that, the player can keep playing in endless mode.

This gives the world map a reason for time to matter. Today, travelling, waiting and camping cost nothing, so "Camp until healed" is a free full heal before every battle. With this design, each day spent is a day the blight presses in. Each day held is also a day the party's territory pays out.

**Status: proposal, revised once with the user's decisions (§8), for further iteration.** The shape of the system is settled. The constants are starting points for the simulator, not decisions. §9 lists what is still open.

Related:
- [expeditions-and-encampment.md](expeditions-and-encampment.md) designs the encampment, the towns, crafting and the camp's improvements. This design gives that loop its stakes: what the encampment is defending and where its gold and materials come from. Its "later threat system" is this design.
- The existing field camp (`src/game/camp.ts`, Camp and "Camp until healed") is a different thing from the encampment and stays as it is. Only its days now cost time.

## 2. The loop

```
 monsters ──┐                                   ┌── encampment, held sites, parties
            ▼                                   ▼
        blight influence  ◀── contest per hex ──▶  clean influence
            │                                   │
   corrupted land spawns monsters        held land yields gold and materials
            │                                   │
            └──▶ battles ──▶ experience ◀───────┴──▶ improve the encampment, craft
```

There are two layers:

- **Strategic layer:** an influence war over the map between blight and clean.
- **Meta-progression layer:** the encampment, improved with what held territory yields, which makes the party and its reach stronger.

## 3. Requirements

| ID | Requirement |
| --- | --- |
| R1 | **Blight levels:** every hex has a blight level from 0 to 3 (clean, tainted, blighted, corrupted), and the world map shows it on each hex. |
| R2 | **Influence contest:** blight sources and clean sources contest each hex every day. A hex's level drifts toward whichever side presses harder there. |
| R3 | **Blight sources:** monster locations and the Source, each in proportion to its threat, and corrupted land itself, so blight creeps along. |
| R4 | **Clean sources:** the encampment, held sites and the party (and later its other parties). |
| R5 | **Spawning:** corrupted land spawns new monster locations over time. |
| R6 | **Victory over monsters:** it removes a blight source and cleanses the land around it at once. |
| R7 | **Capture:** towns and resources can be captured. Held sites yield gold and materials and can be lost to a siege the player is warned about. |
| R8 | **The encampment:** the game starts with one, at Oakvale. Its improvements are the meta-progression. Losing it loses the game. |
| R9 | **The Source and endless mode:** the Source is the final monster location. Beating it wins the game, and the player may then continue in endless mode. |
| R10 | **Time:** every world turn counts, including each hex of travel, each day of camping, scouting and waiting. |
| R11 | **Interruptions:** a notable map event stops a journey or a stretch of camping where it happens. |
| R12 | **Determinism:** the same world seed and the same choices give the same blight, spawns and yields. The rules stay Phaser-free. |

Non-goals: blight changes nothing in battle (§8.6); there is no fog of war; multiple parties get a design of their own (§5.4).

## 4. Rules (provisional)

### 4.1 Blight levels and the map

- `WorldState.blight` stores levels sparsely: only hexes above 0 are kept.
- **On the map:** each level is a tint over the grass, from a sickly yellow-green to a dark violet, drawn as a separate layer above the terrain so it can be redrawn without the terrain. Corrupted hexes also get a small animated atlas sprite (`blight/idle`, tendrils or spores).
- **Held land:** the edge of the territory a clean source wards gets a faint outline, so the player sees where the front line is.

### 4.2 The influence contest

Each day, for each hex, both sides' influence is summed:

- **Blight:** for each monster location, `max(0, BLIGHT_PER_THREAT × threat − distance)`; for the Source, `max(0, SOURCE_STRENGTH − distance)`; plus `CREEP` for each corrupted neighbour.
- **Clean:** for each clean source, `max(0, strength − distance)`. The strengths are:
  - **Encampment:** `CAMP_STRENGTH` (8), raised by its improvements.
  - **Held town:** `TOWN_STRENGTH` (5).
  - **Held resource:** `SITE_STRENGTH` (3).
  - **The party:** `PARTY_STRENGTH` (3), where it stands. This is the "forces" side, which later parties add to.

Each hex then carries a sparse `shift` counter, which moves by `blight − clean` each day. At `+SHIFT_COST` (20) the hex rises a level, and at `−SHIFT_COST` it falls a level. Either way the counter then resets to 0.

Consequences:
- **Front lines:** the contest settles into lines that move, rather than blight growing without limit. A threat-5 nest pushes hard and far, while a held town holds its valley.
- **No dice:** influence needs no RNG. Only spawning and tie-breaks draw from the world RNG.
- **Cost:** about 2,400 hexes a day, with a handful of sources each. That is cheap, but travel and camping advance many days at once, so it should be checked in the simulator.

Starting values (provisional): `BLIGHT_PER_THREAT` 3 (a threat-5 nest reaches about 15 hexes before falloff ends it), `SOURCE_STRENGTH` 20, `CREEP` 1.

### 4.3 Spawning

- **Pressure:** each day, `spawnPressure` grows by the number of corrupted hexes divided by `SPAWN_DIVISOR` (10).
- **A spawn:** when the pressure reaches `SPAWN_COST` (30), a new monster location appears on a corrupted hex. That hex must lie at least `SPAWN_CLEARANCE` (4) hexes from the party, other monster locations and held sites, and is chosen by the world RNG.
- **What appears:** a random encounter at `threatAt(position)`, with a small loot draw.
- **The cap:** `MAX_MONSTER_LOCATIONS` (24).

### 4.4 Pushing back

- **Winning a battle:**
  - The monster location is removed, as today, and so is its blight influence.
  - Blight drops 2 levels within `1 + threat` hexes, and the shift counters there are reset.
- **Capturing a site:**
  - The party captures a town or resource by standing on it when its hex is below level 2 and no monster location lies within `CLAIM_RADIUS` (3).
  - A captured site joins the clean sources and begins to yield.
- **Sieges:**
  - **Start:** when a monster location lies within `SIEGE_RADIUS` (5) of a held site or the encampment, a siege begins. This is announced and interrupts the party (§4.7), and a countdown of `SIEGE_DAYS` (10) shows on the map.
  - **Lifted:** if those monsters are beaten in time.
  - **Lost:** when the countdown runs out. A site that falls stops being held: it loses its influence and yield, and its hex becomes blighted. It can be recaptured. If the encampment falls, the game is lost.

### 4.5 Resources

- **What sites yield:** every `YIELD_DAYS` (5) days, each held site adds its yield to the encampment's stock. A resource yields its material (Iron Vein: iron, Timber Stand: timber, Gold Seam: gold, and so on), and a town yields gold.
- **Blight cuts the yield:** a site's yield shrinks by a third per blight level of its own hex.
- **No carrying:** the stock lives at the encampment, not in the party's baggage, so nothing has to be carried home.
- **Spending:** gold and materials pay for encampment improvements and for crafting, both per the expeditions design.

The expeditions design warned against income that accrues per turn, because waiting would then be a wealth generator. That concern is now settled: waiting feeds the blight, which threatens the very sites that yield.

### 4.6 The encampment

- **Location and strength:** it starts at Oakvale. It is the strongest clean source and the party's home.
- **Improvements:** they are bought with the stock and are the meta-progression. Examples:
  - **Palisade:** a longer siege countdown.
  - **Watchtower:** shows spawn pressure, and warns a few days before a spawn.
  - **Shrine:** raises `CAMP_STRENGTH`.
  - **Infirmary:** heals faster when camping at home.
  - **Workshop:** crafting.
  - **Barracks:** a second party (§5.4).

  The exact list and costs belong to the expeditions design. This design adds only the strength, siege and warning improvements.
- **Losing it** loses the game (permadeath, as a party wipe does now).

### 4.7 Time and interruptions

- **One function for a turn:** every world turn goes through `passTurn(world)`, which calls `advanceDay`. `advanceDay` returns `WorldEvent`s: `spawned`, `siege_started`, `site_fell`, `yield` and `level_changed`.
- **Travel goes a hex at a time.** If a day raises a **notable** event (a spawn within `NOTICE_RADIUS` (8) of the party, a siege starting, a site falling), the journey stops on that hex and the scene reports the event. The rest of the route is dropped, and the player picks the next move.
- **Camping goes a day at a time.** "Camp until healed" stops on a notable event in the same way, and reports the days camped so far and what happened.
- **Not notable:** level changes and yields are reported in the footer and the log but do not interrupt.

### 4.8 The Source and endless mode

- **The Source:** a monster location in the far east corner, at threat `MAX_THREAT`, with a boss encounter of its own (to be designed). It is the strongest blight source.
- **Victory:** beating the Source shows a victory screen with two choices: **End** (back to the menu, and the save is kept as a finished game) or **Continue (endless)**.
- **Endless mode:** remaining nests keep pushing and spawns go on. To keep it from winding down, a new Source rises every `RESURGENCE_DAYS` (proposed 60) at the far corner of the map from the encampment, with a stronger boss each time. Endless mode needs threat above `MAX_THREAT`, which today is a hard cap. That is open (§9).

## 5. Technical shape

### 5.1 Domain modules (proposed, Phaser-free)

- **`src/game/blight.ts`:** levels, the influence sums, shift counters, spawning, sieges, and `advanceDay(world): WorldEvent[]`.
- **`src/game/territory.ts`:** capture, held sites, yields and the encampment's stock.
- **`src/game/encampment.ts`:** improvements and their effects on strengths, sieges and warnings. The expeditions design proposed `camp.ts` for this, but that name is taken by the field camp.

### 5.2 Changes to existing code

- **`worldMap.ts`:**
  - Adds `passTurn`.
  - `travel` advances turn by turn and may stop early, returning the hexes walked and the events.
  - `linger` goes through `passTurn`.
  - `clearLocation` also cleanses the land around the location.
- **`camp.ts`:**
  - `campDay` goes through `passTurn`.
  - `campUntilHealed` stops on a notable event, and its `CampResult` gains `interruptedBy`.
- **`WorldState` gains:** `blight`, the shift counters, `spawnPressure`, held site ids, sieges, the world RNG state (`mulberry32`'s `state()`), the encampment's improvements and its stock, and `endless`. This changes the save shape, so `SAVE_VERSION` goes up.

### 5.3 The scene and the simulator

- **`WorldScene`:**
  - **Map layers:** the blight tint layer, the corrupted-hex sprites and the outlines of held land.
  - **Badges:** siege countdowns and a held-site flag.
  - **Footer:** a line with the stock and the share of the land blighted.
  - **Events:** shown as messages.
  - **Probe:** gains blight and held-site data, so the browser tests can check them.
- **Simulator:** `--campaign` now pays for its time and gets the new metrics: blight share at the end, spawns, sites lost, whether the encampment fell and whether the Source fell. Its policy needs rules for capturing sites (on the way), answering sieges (the nearest besieger first) and attacking the Source.

### 5.4 Multiple parties (separate design)

More parties are the natural way to hold a larger front. A party garrisoned at a site adds `PARTY_STRENGTH`, and a second party can answer a siege while the first pushes on. That needs the reserve roster, deployment and a turn model for several parties, which the expeditions design already flags. This design leaves room for it: `PARTY_STRENGTH` is per party, so the clean side sums over a list.

## 6. Phasing

1. **Blight levels and the influence contest**, with monsters, the encampment and the party as sources, cleansing on victory, the tint on the map, time costing turns, and interruptions. This is playable alone.
2. **Spawning.**
3. **Capture, held sites, yields and the stock, and sieges, the encampment's included**, which brings losing the game by losing the encampment.
4. **Encampment improvements**, with the expeditions design's crafting.
5. **The Source, victory and endless mode.**
6. **Multiple parties**, after their own design.

Each phase gets a campaign retune.

## 7. Balance

The current target, clearing the map about 2 times in 3, stops meaning much once the map refills itself. The proposed replacement is that the simulator's careful party **beats the Source about 2 times in 3, without losing the encampment**. The levers, in order:

1. `SHIFT_COST`
2. `BLIGHT_PER_THREAT`
3. `SPAWN_COST`
4. the clean strengths
5. the Source's encounter

`FOES_AT_THREAT` should not move for this. Spawns add experience as well as danger, and yields add gear through crafting, so judge by campaign runs.

## 8. Decisions made

1. **Levels.** Blight has levels 0–3, each shown on the map's hexes.
2. **Influence.** Blight and clean contest the land, and player-held resources, structures and forces push the blight back. This is another reason for multiple parties.
3. **Resources.** Held territory yields gold and materials for crafting and improvements.
4. **The encampment.** The game starts with an encampment, gradually improved as the meta-progression loop. Losing it loses the game.
5. **The Source.** Beating the Source wins the game, and the player can continue in endless mode.
6. **Battles.** Blight does not affect battles.
7. **Interruptions.** Events on the map take the party out of movement and rest.

## 9. Open questions

1. **What does "meta-progression" span?** This design takes it as within one playthrough, since the encampment is lost with the game. Should anything carry over between playthroughs, such as unlocked improvements or prerolls?
2. **Threat above 5 in endless mode:** extend `FOES_AT_THREAT` and `foeAtLevel` past `MAX_THREAT`, or keep threat 5 and make spawns more frequent?
3. **Does capturing a site take more than standing on it?** For example a battle, a garrison or a cost.
4. **Is a held site lost only to a siege,** or also when blight under it reaches a level?
5. **Should spawned monsters move toward the encampment**, or are they static nests as today? Static is simpler and already makes the sieges.
