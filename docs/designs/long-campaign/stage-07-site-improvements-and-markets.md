# Stage 7: Site improvements and market income

Part of [the long campaign](index.md). Reference: [`reference/economy-and-trade-routes.md`](reference/economy-and-trade-routes.md) §4.1, §4.2, §5.1 (improvements and the Lodge), §5.2 (territory, blight and buildings) and §5.4 (improvements).

## 1. Purpose and status

Two changes give the encampment's economy more to work with.

- **Held sites can be raised past an outpost:** to a **works** (more yield) and then to a **fort** (stronger, and lost only when corrupted). A new **Builders' Lodge** at the encampment unlocks them.
- **The trading post's upper levels,** 4 (from stage 3), 5 and 6, become the Market, Market Hall and Trading House, and bring **passive gold**.

Trade routes, and their slots at these levels, come in stage 8.

**Status:** done (see [Implementation notes](#implementation-notes)).

## 2. Scope

**In:**
- **Improvements.**
  - `WorldState.improvements` replaces `outposts`, and the save migrates it.
  - `siteYield`, `siteStrength` and `lossLevel` read the improvement level. `daysToFall` uses the site's own loss level.
  - `improveSite` and `improveRefusal` replace `buildOutpost` and `canBuildOutpost`, with wrappers kept until callers move.
  - Works names come from the site's material.
  - `site_improved` replaces `outpost_built`, and `site_lost` gains `improvement`.
- **The Builders' Lodge.** Levels 1 and 2 (works and forts), with `raiseLodge` and `lodgeCost`. Level 3 (roads) is in this stage's cost table, but the button says "Roads come with trade routes" until stage 8.
  - It is a new facility in `FACILITIES`.
  - A sprite, `camp_lodge`, with three level frames.
- **Market income.**
  - Trading post levels 5 and 6 are added: costs as in economy §4.2.
  - Levels 4 to 6 pay 2, 3 and 5 gold every yield day, halved on tainted ground.
  - A `yield` event carries `source: 'market'`.
  - The trading post's names follow its level.
- **Scenes.**
  - The world map's Build Outpost button becomes **Improve**, showing the next level and its cost or refusal.
  - The encampment gets the Lodge.
  - `worldEvents.ts` gains a yield summary by source in the stock panel.
- **The simulator.**
  - `outpostErrand` becomes `improveErrand`, with forts first on sites under 30 days to fall.
  - `visitFacilities` raises the Lodge and the trading post's market levels.
  - The record gains gold by source (sites, market and sales) and improvement levels at the end.
  - The waiting check: a summary line of gold per day at home against the campaign's average.

**Out:**
- partners, routes, roads and route slots (stage 8);
- partners' goods for sale (stage 10).

## 3. Requirements

| ID | Requirement | Reference |
| --- | --- | --- |
| S7-R1 | Improvement levels 1 to 3, with their yields, strength, loss level, building and razing. | economy R1, R3, A1 |
| S7-R2 | The Builders' Lodge, levels 1 and 2 active. | economy R2, A2 |
| S7-R3 | Market income at trading post levels 4 to 6. | economy R4, A3 |
| S7-R4 | The simulator's improvements, income by source, and the waiting check. | economy R11 (part), R12 (part) |

## 4. What the player sees

- **On a held Iron Vein** with an outpost and Lodge 1, the Improve button reads "Build a Mine: 30 gold, 15 stone". Built, the yield line reads "Mine: 5 iron every 5 days".
- **A fort on the Copper Pit** shows a palisade. When the blight reaches level 2 around it, it holds, and a warning gives the days until corruption takes it.
- **At the encampment,** the trading post reads "Market Hall 5/6: 3 gold every 5 days".

## 5. Technical notes

- `siteStrength` adds +3 at levels 1 and 2 and +7 at level 3 over a plain site. The blight memo key includes improvements, as it does outposts now.
- **Versions:**
  - `SAVE_VERSION` is bumped, with the migration from `outposts`.
  - `LOG_SCHEMA_VERSION` is unchanged: world events are not in the battle log.

## 6. Verification

**Tests:** economy A1 to A3 (reference §7.1: territory, buildings, save, encampment); scene tests for the Improve button and the Lodge; the simulator's `improveErrand`.

**Simulator:**
1. The early-game guard. Forts and works make the land stickier and give more stock. Expect the figure to rise a little, and record by how much.
2. The waiting check: gold per day at home is below the campaign's average.

**Play script:**
1. Run `facility builders_lodge 2` and `stock gold 300 stone 50 iron 50`, then walk to a held site with an outpost. Improve it to a works, then a fort. See the yield and strength in the hex info.
2. Run `days 200` with the party away. Watch a fort survive blight level 2. Use the debug console to push it to 3 and see it lost with "fort razed".
3. Run `facility trading_post 6`, then `days 25`. See five market yields of 5 gold. Taint the encampment's hex in debug and see them halved.
4. Load a save from before the stage. Its outposts show as level 1.

## 7. Risks

- **The blight balance.** Forts are strong. If the early land ends too clean, lower the fort's strength before its loss level.

**Done when:** all tests pass, the guard holds (or the change is explained), the waiting check passes, and the play script has been walked.

## Implementation notes

Built as seven steps (`docs/implementation-plans/long-campaign-stage-07/`).

**The figures** (500 campaigns from seed 1 each, ready level 7; "start" is step 01's measure before any change):

| Run | Source beaten | Days | Battles | Heroes dead in won battles | Sites captured, lost | Land blighted at the end | Gold by source a campaign (sites, market, sales) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The guard, `--parties 1`, start | 234 | 286 | 19.4 | 1.1 | 3.3, 0.1 | 38% | (not recorded), 0, 46 |
| The guard, `--parties 1`, end | 239 | 286 | 19.5 | 1.1 | 3.4, 0.1 | 38% | 228, 0, 42 |
| The default company of three, start | 236 | 286 | 19.5 | 1.1 | 3.3, 0.1 | 38% | (not recorded), 0, 45 |
| The default company of three, end | 239 | 286 | 19.5 | 1.1 | 3.4, 0.1 | 38% | 227, 0, 42 |

- *Check 1, the early-game guard:* 239 of 500, up 5 from 234, at the edge of the 5 points; the company 239, up 3. Both inside the user's bands (215–250, 220–260; days 243–297; deaths at most 2.0). The design expected forts and works to make the land stickier; they do not show, because the careful simulated party almost never builds them: 0.55 outposts, 0.01 works and no forts built a campaign; at the end 0.53 outposts and 0.01 works held; the Lodge at level 1 in 105 campaigns of 500 and 2 in 2; the trading post never past level 2 (49 campaigns at 2), so no market gold. The land ends no cleaner (38% blighted, 0.1 sites lost), so the fort's strength was not retuned. The move is the simulated economy that step 06 gave the party: `materialNeeds` keeps the Lodge's timber and stone and the post's upper levels' silver and crystal, so it sells less (42 gold a campaign against 46) and spends on the Lodge, which changes what it buys and crafts and when it walks home, and so its battles. No rule of play moved it.
- *Check 2, the waiting check* (`--waiting`, the same seeds; the Source count and battles identical to the runs without it, so the flag changes no play): income 1.30 a day campaigning against 0.98 waiting at home with one party (the twin below the campaign in 438 campaigns, equal in 62, which end early, and never above) and exactly the same with the company (1.30 against 0.98; the company plays as one party here, its hall never at level 4 by the ready level). Waiting earns less.

**Decisions that differ from the design** (the plan index's 1 to 16, in brief): `improveRefusal` and `raiseLodge` take the party, as every other building does; the day action `outpost` became `improve` and a saved `outpost` order migrates; `site_improved` replaces `outpost_built` outright (world events are not in the battle log) and `site_lost` carries the level razed; a market's yield is a `yield` event with `source: 'market'`; the Improve button shows, with the reason, when the Lodge is too low; the Lodge's third level is in the cost table but refused ("Roads come with trade routes.") until stage 8; the waiting check is the reference's twin (the company idle at home on the same seed), behind `--waiting` as it costs about a fifth again; the art added `camp_trading_post` levels 5 and 6 and the `map_fort` palisade; the hex info reads "Mine: 5 iron every 5 days." and "Strength 6 against the blight.", and the stock panel gains an unsaved "Last yield" line; debug `stock` takes several pairs, `blight` sets a hex's level, `days` totals the yields by source. The encampment's six plots are drawn at 2x (five at 3x before), and the trading post's details word its next level as what it adds, so every level's lines fit.

**The play script, walked headless** (Playwright through the in-browser driver against the dev server at 1280×800, with the debug console; the screenshots kept out of the repository):
1. `facility builders_lodge 2`, `stock gold 300 stone 50 iron 50 timber 20` and `goto iron_vein` (held, no outpost): the Improve button read "Build an Outpost: 15 gold, 10 timber", then "Build a Mine: 30 gold, 15 stone", then "Build a Fort: 50 gold, 20 iron, 10 stone", and the messages "An outpost stands at Iron Vein.", "A Mine stands at Iron Vein.", "A Fort stands at Iron Vein."; with a fort the button went. The hex info said "Mine: 5 iron every 5 days.", "Strength 6 against the blight.", "Next: a Fort, 50 gold, 20 iron, 10 stone.", then "Fort: 5 iron every 5 days.", "Strength 10 against the blight.", "Lost only when corrupted."; the map label's second line said "Mine", then "Fort", and the palisade stood over the iron.
2. With the party at Crystal Cave, far off, `days 200` passed (in four runs of 50): the fort's hex stayed clean throughout (the land never reached it by itself), and every yield day brought its 5 iron. `blight 2 iron_vein` and `days 5` with the party five hexes off: the fort held, its hex back to tainted and "The blight is receding here."; no warning of days to corruption showed, as the blight was not gaining. `blight 3 iron_vein` and `days 1`: "Iron Vein is lost to the blight, and its fort razed.", and the hex info then "Resource, not held. Yields 2 iron once held."
3. Home, `facility trading_post 6` and `days 25`: "Yields over 25 days: sites 20 gold; market 25 gold", five market yields of 5. Days to the eve of a yield day, `blight 1 encampment`, `days 1`: "sites 3 gold; market 2 gold", halved and rounded down. The stock panel's "Last yield" line shows only for days the map passes itself: after Next day to the following yield day it read "Last yield: sites 4 gold, 2 iron; market 5 gold" (the encampment's hex clean again by then).
4. The version-26 fixture (`src/game/fixtures/save-v26.json`) planted in slot 1 and continued (an intro beat played first and was skipped): `improvements` `{"iron_vein":1}`, the Lodge 0, the save rewritten as version 27; the party on Gold Seam listed as "Building" (its `outpost` day order migrated to `improve`) with the Improve button offering "Build an Outpost: 15 gold, 10 timber"; Iron Vein's map label said "Outpost" and its hex info "Outpost: 3 iron every 5 days." and "Next: a Mine, 30 gold, 15 stone (needs Lodge 1).", and on Iron Vein the Improve button read "A Mine needs the Builders' Lodge", a click saying "A Mine needs the Builders' Lodge.".

**Left for later:** the simulated party's economy hardly reaches this stage's buildings, so the campaign figures say little about forts and the market; stage 8's routes may change that. The Lodge's level-3 sprite is weak (unreachable until stage 8). The market pays on the day the encampment falls (harmless).
