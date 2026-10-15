# The Blight

## 1. Purpose and status

The party was sent out to fight an encroaching evil. When the game begins, blight is already eating the land, and the party must push it back. The endgame is destroying the blight's Source, after which the player may go on in endless mode.

The blight gives the world map a reason for time to matter. Today travelling, waiting and camping cost nothing, so "Camp until healed" is a free full heal before every battle. With the blight, a day spent is a day it presses in, and a day the land is held is a day that land yields.

**Status: proposal, revised twice with the user's decisions (§8), ready to plan phase 1.** The shape of the system is settled. The constants are starting points for the simulator, not decisions. §9 lists what is still open; none of it blocks phase 1.

Related:
- [expeditions-and-encampment.md](expeditions-and-encampment.md) designs the encampment, towns, crafting and camp improvements. This design gives that loop its stakes: what the encampment defends and where its gold and materials come from. Its "later threat system" is this design.
- The field camp (`src/game/camp.ts`, Camp and "Camp until healed") is a separate thing from the encampment and stays. Only its days now cost time.

## 2. The loops

The game has two progression loops, and the blight feeds both:

1. **Battle → level up → harder battles.** This loop exists today. Experience makes the party stronger, and the party goes further from home, where threat is higher.
2. **Develop the encampment → more power → tougher foes.** Held land yields gold and materials. These buy improvements and buildings, which raise clean influence and, through crafting, gear. More influence pushes the front out into further bands, where the blight's nests are of higher threat.

```
 monsters, the Source ──┐                       ┌── encampment, buildings, the party
                        ▼                       ▼
              blight influence ◀─ contest ─▶ clean influence
                        │       per hex         │
       corrupted land spawns monsters     clean land is captured and yields
                        │                       │
                        └─▶ battles ─▶ levels   └─▶ improvements, buildings, crafting
```

How far meta-progression reaches, for instance whether anything carries over between playthroughs, is deliberately left open (§9).

## 3. Requirements

| ID | Requirement |
| --- | --- |
| R1 | **Blight levels:** every hex has a blight level, from 0 (clean) through 1 (tainted) and 2 (blighted) to 3 (corrupted), and the world map shows it on each hex. |
| R2 | **The contest:** each day, blight influence and clean influence contend for every hex, and the hex's level drifts toward the stronger side. |
| R3 | **Blight's sources:** monster locations and the Source, each by its threat, and corrupted land. |
| R4 | **Clean sources:** the encampment, buildings, held sites and the party, the party's influence scaled to its power. |
| R5 | **Occupied hexes:** influence cannot take a hex where units stand. Monsters keep their own hex blighted until they are beaten. The party makes its hex **neutral**, so blight neither spreads from it nor rises on it, and its own influence turns the hex over time. |
| R6 | **Spawning:** corrupted land spawns new monster locations over time. |
| R7 | **Beating monsters:** a won battle removes the location's influence and its occupation, and cleanses the land around it at once. |
| R8 | **Capture by influence:** a town or resource is captured when its hex is cleansed to level 0. Nobody has to stand on it. A held site yields gold and materials and adds clean influence. Blight takes it back the same way, when its hex reaches level 2. |
| R9 | **The encampment:** the game starts with one at Oakvale. Its improvements and buildings are the second progression loop, and if blight takes its hex, the game is lost. |
| R10 | **The Source:** the final monster location. Beating it wins the game, and the player may go on in endless mode. |
| R11 | **Time:** every world turn counts: each hex travelled, each day camped, each turn scouting or waiting. |
| R12 | **Interruptions:** a notable event on the map stops a journey or a stretch of camping where it happens. |
| R13 | **Determinism and code:** the same world seed and the same choices give the same blight, spawns and yields, and the rules stay Phaser-free. |

**Non-goals:**
- Blight changes nothing in battle.
- No fog of war.
- Monsters do not move yet. Later they will, spreading blight as they go (§4.9).
- Multiple parties get a design of their own (§5.4).
- Threat stays capped at `MAX_THREAT` (5) until the final boss's level is settled.

## 4. Rules (provisional)

### 4.1 Blight levels and the map

- `WorldState.blight` stores levels sparsely: only hexes above 0 are kept.
- **Tint:** each level is a tint over the grass, from a sickly yellow-green to a dark violet. The tint is drawn as a layer of its own above the terrain, so it can be redrawn without redrawing the terrain.
- **Corrupted hexes** also get a small animated atlas sprite (`blight/idle`).
- **Front line:** the edge of clean-held land gets a faint outline.
- **Party's hex:** when the party stands on a blighted hex, the hex shows a neutral marker.

### 4.2 Influence

Each day, both sides' influence is summed for each hex. Each source pushes with its strength, less one for every hex of distance, and never below 0: `max(0, strength − distance)`.

**Blight sources:**

| Source | Strength |
| --- | --- |
| A monster location | `BLIGHT_PER_THREAT × threat` (3 × threat) |
| The Source | `SOURCE_STRENGTH` (20) |

Each corrupted neighbour of a hex also adds `CREEP` (1) to that hex.

**Clean sources:**

| Source | Strength |
| --- | --- |
| The encampment | `CAMP_STRENGTH` (8), raised by its improvements |
| A held town | `TOWN_STRENGTH` (5) |
| A held resource | `SITE_STRENGTH` (3) |
| A building (§4.6) | its own strength |
| The party | `PARTY_BASE` (2) plus half the sum of its members' levels, rounded down |

The party's power is its levels for now, so a new party of three at level 1 pushes with 3 and a party of three at level 5 with 9. Later this can count other things too, such as gear or perks.

### 4.3 The contest

- Each hex carries a sparse `shift` counter, which moves by `blight − clean` each day.
- At `+SHIFT_COST` (20) the hex's level rises by one, at `−SHIFT_COST` it falls by one, and either way the counter goes back to 0.
- **Occupied hexes are exempt (R5):**
  - **A monster location's hex** stays at its level, at least 2, and cannot be lowered until the monsters are beaten.
  - **The party's hex** neither rises nor counts as corrupted for `CREEP` or spawning. It still falls under the party's own influence, so standing on blighted land slowly turns it. Turning a hex this way is the party's way to take ground it has no building near.
- **Why this works:** the contest settles into front lines that move rather than unlimited growth. A threat-5 nest pushes hard and far, while a held town holds its valley.
- **Dice:** influence needs none. Only spawning and tie-breaks draw from the world RNG.
- **Cost:** about 2,400 hexes a day, each summing a handful of sources. That is cheap, but travel and camping advance many days at once, so the simulator should check it.

### 4.4 Spawning

- **Pressure:** each day, `spawnPressure` grows by the count of corrupted hexes (occupied ones excluded) divided by `SPAWN_DIVISOR` (10).
- **A spawn:** at `SPAWN_COST` (30) a monster location appears on a corrupted hex, chosen by the world RNG. The hex must be at least `SPAWN_CLEARANCE` (4) hexes from the party, other monster locations and held sites.
- **What appears:** a random encounter at `threatAt(position)`, with a small loot draw.
- **Cap:** `MAX_MONSTER_LOCATIONS` (24).

### 4.5 Taking and losing ground

- **Winning a battle:**
  - The location is removed, as today, along with its influence and its occupation.
  - Blight drops 2 levels within `1 + threat` hexes, and the shift counters there reset.
- **Captured:** a town or resource becomes held when its hex reaches level 0. The site's own influence then joins the clean side, which helps it stay clean.
- **Lost:** a held site is lost to the blight when its hex reaches level 2. A tainted site (level 1) is still held, which gives a margin, but it yields less (§4.7).
- **Monsters take ground as the party does:** by influence, which here means a nest close enough to push a site's hex up two levels. Once monsters move (§4.9), they will also take ground by occupying it.
- **Warnings instead of countdowns:**
  - A held site whose shift counter has turned toward blight is **under threat**. The map shows it with the projected days until it falls, worked out from the day's net influence. That is the announced threat, with time to answer it.
  - The answers are to beat the nests pushing on it, to stand on or near it with the party, or to build there.
- **The encampment** is held like any site, and if blight takes its hex the game is lost (§4.6).

### 4.6 The encampment and buildings

- **Home:** the encampment starts at Oakvale and is the strongest clean source.
- **What the stock buys:**
  - **Improvements at the encampment:**
    - **Shrine:** raises `CAMP_STRENGTH`.
    - **Watchtower:** warns a few days before a spawn and shows spawn pressure.
    - **Infirmary:** heals faster when camping at home.
    - **Workshop:** crafting.
    - **Barracks:** a second party (§5.4).
  - **Buildings at held sites:** an outpost, for instance, adds its strength to the site's and lifts that site's yield. These are the "buildings" of the influence war, the way to make the front line stick without the party standing there.
- **Who decides what:** the list, costs and services of the improvements belong to the expeditions design. This design adds only what bears on influence and warning.
- **Losing the encampment** loses the game, permadeath as a party wipe is now.

### 4.7 Resources

- **Yield:** every `YIELD_DAYS` (5), each held site adds its yield to the encampment's stock.
  - **Resources** yield their material: Iron Vein gives iron, Timber Stand timber, Gold Seam gold, and so on.
  - **Towns** yield gold.
- **Taint:** a tainted site yields half.
- **Where the stock lives:** at the encampment. Nothing is carried in baggage.
- **Waiting is not free money.** The expeditions design worried that per-turn income would make waiting a wealth generator. That no longer holds, because waiting feeds the blight, which threatens the sites that yield.

### 4.8 Time and interruptions

- **Every world turn passes through `passTurn(world)`,** which calls `advanceDay` and returns `WorldEvent`s: `level_changed`, `spawned`, `site_threatened`, `site_captured`, `site_lost` and `yield`.
- **Travel advances a hex at a time.** When a day raises a **notable** event, the journey stops on that hex. The scene reports the event, the rest of the route is dropped, and the player chooses again. The notable events are:
  - a spawn within `NOTICE_RADIUS` (8) of the party
  - a site under threat
  - a site lost
  - the encampment under threat
- **Camping advances a day at a time,** and "Camp until healed" stops on the same events. Its result gains `interruptedBy`.
- **Everything else** only goes into the footer and the log: level changes, captures and yields.

### 4.9 Later: monsters that move

Monster locations stay put for now. Later, a location will be able to move along a route toward a target, most likely the nearest held site or the encampment. As it moves it will lay blight on the hexes it crosses and occupy whatever it stands on, which is how monsters will also take ground by occupation. Two things should already be built with this in mind:
- a monster location's influence is computed from its current position;
- occupation is looked up from where units stand, not stored on the hex.

### 4.10 The Source and endless mode

- **The Source** is a monster location in the far east corner at threat `MAX_THREAT`. It has a boss encounter of its own, still to be designed, and is the strongest blight source.
- **Beating it** brings a victory screen with two choices:
  - **End:** back to the menu, with the save kept as a finished game.
  - **Continue (endless):** the remaining nests keep pushing and spawns go on.
- **Endless mode's escalation** waits for the final boss's level, so threat stays capped at 5 for now (§8.2).

## 5. Technical shape

### 5.1 Domain modules (proposed, Phaser-free)

- **`src/game/blight.ts`:** levels, influence, shift counters, occupation, spawning, warnings, and `advanceDay(world): WorldEvent[]`.
- **`src/game/territory.ts`:** held sites, capture and loss as levels change, buildings, yields and the stock.
- **`src/game/encampment.ts`:** improvements and their effects on strength and warning. The expeditions design proposed `camp.ts` for this, but the field camp now has that name.

### 5.2 Changes to existing code

- **`worldMap.ts`:**
  - **`passTurn`** is new.
  - **`travel`** advances turn by turn and may stop early, returning the hexes walked and the events.
  - **`linger`** passes its turn through `passTurn`.
  - **`clearLocation`** also cleanses the land around the location.
- **`camp.ts`:**
  - **`campDay`** passes its turn through `passTurn`.
  - **`campUntilHealed`** stops on a notable event.
- **`WorldState`** gains `blight`, the shift counters, `spawnPressure`, the held site ids, buildings, the world RNG's state (`mulberry32`'s `state()`), the encampment's improvements, its stock, and `endless`. This changes the save shape, so `SAVE_VERSION` goes up.

### 5.3 The scene and the simulator

- **`WorldScene`:**
  - **Map layers:** the tint layer, corrupted-hex sprites, the front-line outline and the neutral marker.
  - **Badges:** held-site flags, and under-threat badges with the days left.
  - **Footer:** the stock and the share of the land blighted.
  - **Events** become messages.
  - **Probe:** blight and held-site data, for the browser tests.
- **Simulator:**
  - **Time:** `--campaign` now pays for the days it spends.
  - **New metrics:** the blight share at the end, spawns, sites captured and lost, and whether the encampment or the Source fell.
  - **New policy rules:** answer threats to held sites first (the nest pushing hardest), then the nearest nest. Attack the Source once the party is ready, a condition to be tuned.

### 5.4 Multiple parties (separate design)

More parties are the natural way to hold a longer front. A party left at a site keeps its hex neutral and adds its influence there, and a second party can answer a threat while the first pushes on.

Before that, the reserve roster, deployment and a turn model for several parties need deciding, as the expeditions design already notes. This design leaves room for it: party influence is summed over a list of parties and occupation over a list of units, so a second party needs no new rule.

## 6. Phasing

1. **Blight and the contest:** levels, influence (monsters, the encampment, the party), occupation and the neutral hex, cleansing on victory, the map's tint and markers, time costing turns, interruptions, and the save bump. This phase is playable on its own.
2. **Spawning.**
3. **Territory:** capture and loss by influence, warnings, yields and the stock, and losing the encampment as a defeat.
4. **The encampment:** its improvements and buildings, with the expeditions design's crafting.
5. **The Source:** victory and endless mode.
6. **Later:** moving monsters, then multiple parties, each after a design of its own.

Each phase gets a campaign retune.

## 7. Balance

Clearing the map about 2 times in 3 stops meaning much once the map refills itself. The proposed replacement is that the simulator's careful party **beats the Source about 2 times in 3 without losing the encampment**. Before phase 5, the interim measure is the share of the land clean after a fixed number of days, together with the battle record by threat.

The levers, in order:
1. `SHIFT_COST`
2. `BLIGHT_PER_THREAT`
3. `SPAWN_COST`
4. the clean strengths (the party's scaling included)
5. the Source's encounter

`FOES_AT_THREAT` should not move for this. Spawns add experience as well as danger, and yields add gear through crafting, so judge each change by campaign runs.

## 8. Decisions made

1. **Levels:** blight has levels 0–3, and each hex on the map shows its level.
2. **The contest:** clean and blight contest the land. The player's resources, structures and forces push the blight back, which is another reason to have multiple parties.
3. **Resources:** held territory yields gold and materials for crafting and improvements.
4. **The encampment:** the game starts with one, and improving it gradually is the meta-progression loop. Losing it loses the game.
5. **The Source:** beating it wins the game, and the player can go on in endless mode.
6. **Battles:** blight does not affect them.
7. **Interruptions:** events on the map take the party out of movement and rest.
8. *(second round)*
   1. **Meta-progression:** its scope need not be settled yet. Two loops are required: battle → level up → harder battles, and develop the encampment → more power → tougher foes.
   2. **Threat:** it stays capped at 5 for now. Higher levels wait until the final boss's level is known.
   3. **Capturing:** to capture a site is to remove its blight, which influence does without anyone standing there: buildings, and nearby friendly units scaled to their power. An occupied hex cannot be taken. The party occupying a hex makes it neutral, so blight does not spread from it, but the party's influence has to turn it over time.
   4. **Losing sites:** blight takes held sites back, and monsters take them as the player takes ground.
   5. **Moving monsters:** monsters stay put for now, and will eventually move, spreading blight.

## 9. Open questions

None of these block phase 1.

1. **Meta-progression:** does anything carry over between playthroughs?
2. **Playing it safe at home:** is it a problem? The party standing at the encampment keeps it from being taken, since an occupied hex cannot be taken. That makes waiting at home safe but fruitless, as sites fall and spawns grow. Should something stop that, for instance the encampment also falling when every site is lost?
3. **Does the blight answer the player's growth?** The second loop's "tougher foes" comes from pushing into further bands. Should the blight also grow as the encampment does, for instance the Source's strength or spawn pressure rising with the encampment's improvements?
4. **Buildings:** which buildings exist, what they cost, and where they may stand: only at held sites, or on any clean hex?
5. **The party's power:** is it only levels, or should gear and perks count too?
