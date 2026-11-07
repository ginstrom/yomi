# Stage 7: Site improvements and market income

Part of [the long campaign](index.md). Reference: [`reference/economy-and-trade-routes.md`](reference/economy-and-trade-routes.md) §4.1, §4.2, §5.1 (improvements and the Lodge), §5.2 (territory, blight and buildings) and §5.4 (improvements).

## 1. Purpose and status

Two changes give the encampment's economy more to work with.

- **Held sites can be raised past an outpost:** to a **works** (more yield) and then to a **fort** (stronger, and lost only when corrupted). A new **Builders' Lodge** at the encampment unlocks them.
- **The trading post's upper levels,** 4 (from stage 3), 5 and 6, become the Market, Market Hall and Trading House, and bring **passive gold**.

Trade routes, and their slots at these levels, come in stage 8.

**Status:** ready for planning.

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
