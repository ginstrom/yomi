# Stage 9: The outer rings

Part of [the long campaign](index.md). Reference:
- [`reference/campaign-to-level-20.md`](reference/campaign-to-level-20.md) §4.1, §5.1 and §6.2–§6.3;
- [`reference/economy-and-trade-routes.md`](reference/economy-and-trade-routes.md) §4.3 (far partners);
- [`reference/gear-and-runes.md`](reference/gear-and-runes.md) §4.3 (new resource sites) and §4.5 (the full rune table).

## 1. Purpose and status

The map grows to 140 × 72. Its rings run to threat 18, and the Source is fought at threat 20.

The outer rings are filled with foes that already exist:
- bandit encounters, which scale to any level by construction;
- stage 2's spiders and salamanders where their bands fit.

New ore and wood sites and the far trade partners are placed. The blight's push is capped so the far nests don't overwhelm the encampment.

This is the first long campaign, from level 1 to about 20. The monsters of the high rings come in stage 11, and the gear of the high tiers in stage 10. This stage checks the map, the pacing and the company over the long haul.

**Status:** ready for planning.

## 2. Scope

**In:**
- **The rings.** `THREAT_RINGS` (campaign §4.1) and `SOURCE_THREAT = 20`. `threatAt` reads the table, and `MAX_THREAT` as a map cap goes.
- **The map.**
  - `WORLD_SIZE` is 140 × 72, with home at (9, 36).
  - Today's locations are shifted by +17 rows, so the early geometry is unchanged.
  - The Source is at about (131, 36).
- **Fixed nests per outer ring** (4 to 6), using these encounters:

  | Encounter | Band | Counts |
  | --- | --- | --- |
  | Bandit Camp | 3–7 | extended: 4 at 6 and 7 |
  | Bandit Company (new) | 8–13 | 4 |
  | Freebooter Host (new) | 14–20 | 4–5, with a Captain |
  | Spider Nest | widened to 4–9 | — |
  | Salamander Pool | widened to 5–9 | — |

  Bandit gear tiers by ring: steel from threat 7. Higher tiers wait for stage 10, so until then far bandits wear Masterwork steel.
- **The Source's Guardians** at threat 20, with a provisional block: the Horror and its guard scaled by native level 1 rules, clamped. A first-pass block to be replaced in stage 11. The retune in this stage only makes it winnable.
- **New resource sites.**
  - Ores and woods (gear §4.3), placed with their materials added to `Material` and `RESOURCE_YIELDS`.
  - Their materials have no use until stage 10. They sell at the trading post meanwhile.
- **Partners.** Millbrook and Saltmere move into the shifted map. Stonehollow, Elder Glade and Emberwatch are added.
- **The blight.**
  - `BLIGHT_THREAT_CAP = 5`.
  - `MAX_MONSTER_LOCATIONS = 60`.
  - `SPAWN_DIVISOR` is retuned for the same pressure per hex.
- **Rune loot** uses the full table, up to the Source's row. Ranks 3 and 4 found can't be fused into until stage 10, but can be embedded.
- **The simulator.**
  - `SOURCE_READY_LEVEL` is 18.
  - `MAX_CAMPAIGN_DAYS` is 6000.
  - The threat table runs to 20.
  - `--log none` is added (campaign §5.7).
  - Runtime is measured. If a 500-campaign run takes more than about 20 minutes, profile `advanceDay` before going on (campaign §6.3).
- **The world map** at the new size: camera bounds, and the minimap if any. Vision and fog over the larger board.

**Out:**
- the high roster (stage 11);
- tiers 3 to 5 (stage 10).

## 3. Requirements

| ID | Requirement | Reference |
| --- | --- | --- |
| S9-R1 | The ring table and the Source at 20. | campaign R1, A1 |
| S9-R2 | The bigger map, with the early geometry preserved; outer nests and spawns by band. | campaign R2, A2 |
| S9-R3 | Blight strength capped. | campaign R3 |
| S9-R4 | The new resource sites and far partners. | gear R7 (sites), economy §4.3 |
| S9-R5 | The long-campaign simulator settings and runtime. | campaign R14 (part) |

## 4. What the player sees

- **Past the Troll Lairs,** the land runs on. At threat 7 bandit camps and spider nests appear, at 9 bandit companies, and further out freebooter hosts and the far partners: the mountain hold of Stonehollow and the forest people of Elder Glade.
- **A Mithril Lode** yields an unfamiliar ore that the trading post buys.
- **The walk to the far rings is long,** and this is where the Second Company earns its keep.

## 5. Technical notes

- **The +17-row shift** must also apply to any fixed coordinates in tests, the tutorial and the story.
- **Performance:** about 4.2× the hexes. Measure `advanceDay` per day before and after.
- **Versions:** `SAVE_VERSION` is bumped. A new map means old saves can't continue.

## 6. Verification

**Tests:**
- `worldMap.test.ts`:
  - the ring table;
  - the shift preserves distances among the home locations;
  - every fixed nest's band holds its threat;
  - partners and sites placed.
- `blight.test.ts`:
  - the capped strength;
  - spawn kinds by band over many seeds.
- `scripts/simulate.test.ts`: `--log none`.

**Simulator:**
1. `--ready-level 7`: the early-game guard. The early rings are unchanged, but the blight's spawn pressure is retuned, so check it.
2. The long campaign, `--battles 100` first: levels reached, battles to level, days, walking days, Source share.

   Expect the far rings to be too easy or too hard in places, because the roster and gear are incomplete. Record the figures as the baseline for stages 10 to 12. Don't tune the Source beyond "winnable".

**Play script:**
1. Start a new game. The home country looks and plays as before.
2. Run `reveal` and inspect the rings and threats with `locations all`.
3. Run `xp 50000 all` and `goto` a threat 9 Bandit Company, then fight it. See bandits of level 9 in steel.
4. Contact Stonehollow and open a route (`facility trading_post 5`). See the long road and its exposure.
5. Hold the Mithril Lode and see mithril in the stock.

## 7. Risks

- **Runtime.**
- **The blight on a map four times the size.**
- **Pacing:** too few nests per ring for the levels needed. Watch battles to level.

**Done when:** all tests pass, the guard holds, a 100-campaign long run completes in reasonable time with its baseline recorded in the stage's notes, and the play script has been walked.
