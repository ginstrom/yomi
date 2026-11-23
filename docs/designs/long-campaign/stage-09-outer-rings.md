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

**Status:** done (see [Implementation notes](#implementation-notes)).

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

## Implementation notes

Built as ten steps (`docs/implementation-plans/long-campaign-stage-09/`; every figure below is in its `log.md`, 500 campaigns from seed 1 unless stated, one run at a time).

**The early figures** (`--ready-level 7 --near-source`, the stand-in Source of decision 2; `rl10` and `rl12` with their own levels):

| Run | Baseline (step 01) | Final | Band | Days (final) |
| --- | --- | --- | --- | --- |
| `one` (`--parties 1`) | 233 | **288** | 215–250 | **331** (band 243–297) |
| `company` | 232 | **289** | 220–260 | 334 |
| `rl10` | 433 | 409 | 370–420, in | 530 |
| `rl10-one` (report only) | n/a | 409 | n/a | 496 |
| `rl12` (report only) | n/a | 407 | n/a | 644 |

Heroes dead 1.2 a campaign (band at most 2.0). The standard cells `gr3` to `sg10` and `tl5` equal their "Now" figures. `one`, `company` and `one`'s days are out of band and **accepted by the user until stage 12**, with `SPAWN_DIVISOR` kept at 840. Cause, from 500-campaign diagnostics: mostly the divisor (fewer spawns, so fewer home nests and longer walks; a divisor of 400 gives 244 wins and 303 days, 300 gives 248 and 298), the rest the bigger board. Stage 12 takes them up with the divisor diagnostics.

**The long-campaign baseline for stages 10 to 12** (100 campaigns, `--campaign --battles 100 --seed 1 --log none`, ready level 18, with `SOURCE_FOE_LEVEL` 6):
- the Source: 15 of 100 beat it, 85 fell; 1272 days, 46.4 battles, 59.8 spawns a campaign; 57% of the land blighted at the end; 8.1 sites captured, 1.5 lost;
- walking: the vanguard walked 1129.0 days, 171.3 of them home;
- levels 5, 10, 15 and 20 after 6.8, 28.5, 54.3 and no battles (in 84, 55, 44 and 0 of the campaigns), so no campaign reached level 20 by battles alone;
- win rate by ring: threat 7 0.956, 9 0.828, 12 0.601, 15 0.868, 18 0.75 (4 fought), 20 0.833 (15 of 18);
- 5.9 parties wiped a campaign (9.7 before the Source was retuned, against 1.0 for one party); recruits 30.4; deaths cluster at levels 3 and 5 to 8 and again at 15 and 16;
- home rings in the real long campaign: 8.3 spawns a campaign (measured before the retune), against about 14.5 in the near-Source `one`;
- runtime: 100 campaigns take about 10 minutes (3 on a quiet machine), peak 360 MB; 500 early campaigns about 8 minutes. A day costs 0.83 ms (`passTurn`) and 0.71 ms (`advanceDay`) on the 140 × 72 board, against 0.67 and 0.63 on stage 8's, after step 08's byte-identical speed-ups (the board is 4.2 times the hexes; 3.2 times the cost before them).

Measured before the retune (the Source then unwinnable, 0 wins each): `long-one` (one party) 1322 days, 0.97 to 1.00 at every threat to 18, 45 of 100 dying at the Source; `long-tp4` 88 fell, 12 out of days, 2469 days.

**The company against one party:** equal at `--ready-level 10` (409 each; stage 6's question answered). On the long campaign the company's replacement parties (level about 5) are sent at threat 9 to 18 nests and wiped; the policy is a simulator matter, not a rule, **deferred to stage 12 (the user's decision)**.

**Routes** (`long-tp4`, carried items 2 and 3): 3.87 routes opened a campaign, 2.57 raided, 2.48 abandoned, 0 flickers (a road told safe and raided again within 30 days) and 0 routes raided six yield days and kept, so the "safe again" reset case does not arise on this map; routes bring 26% of the gold. No rule changed.

**The new cells** (report only, 500 battles): `bc7` 1, `sn7` 99, `sn9` 29, `sp7` 290, `sp9` 73, `bco9` 1, `bco12` 0, `fh15` 0, `fh18` 0, `sg20-18` 28, `sg20` 71. A party at the level of the nest it fights loses nearly all of them; the campaign's levelled and geared parties win threats 7 to 18 at 0.97 to 0.98 alone.

**Where the plan departed from the design, and why** (the plan index's decisions, by number): 1 the +17-row shift is an axial translation, as a row shift changes distances by one; 2 `--near-source` keeps the early figures meaningful, and by the user's decision leaves out the fixed nests above threat 5, since their corruption drew the spawns away from the home country; 3 the Source's count stays 5 at threats 6 to 20, and it is made winnable instead by `SOURCE_FOE_LEVEL` (6), the level its guardians are raised to at most past threat 5 (the user's decision: at level 20 they were barely hit, a party hit rate of about 0.28; counts of 4 and 3 changed nothing; at 6 a level-18 ready-made party wins 28 battles of 500 and 7 and above won none of the levels tried), a provisional block until stage 11; 4 the new spawn kinds spawn only from threat 7; 5 bandits wear Masterwork steel from threat 8 (their proper tiers wait for stage 10); 7 rune loot goes by threat rows, today's below 9; 8 three partner sprites were drawn (`map_partner_hold`, `map_partner_glade`, `map_partner_pass`); 9 the world map's blight layer is tiled (`BLIGHT_TILE_PX` 2048); 11 the refactor guard was re-recorded twice (steps 04 and 05). The user also chose byte-identical speed-ups only after step 08's runtime gate. Open question 1 was answered as recommended (the stand-in Source, decision 2). `SAVE_VERSION` 30, no migration.

**Open for the user (proposed for stage 12):** in the real long campaign the home country gets only a share of the spawns, about half by the orchestrator's account (step 09's probe counted 8.3 of 60.1 a campaign at threat 5 or below before the retune, about 14%), the rest landing in the outer rings, which the near-Source early figures do not show. Not decided by the user; the proposal is to take it up in stage 12 with the divisor and the company's replacement policy.

**The play script** was walked in the real game (headless Chromium, the debug console), as recorded in the plan's step 10 record with screenshots. The home country looked and played as before; `reveal` and `locations all` listed the rings at threats 1 to 5, 7, 9, 12, 15 and 18 and the Source at 20 in the far east; a threat-9 Bandit Company fielded a Bandit Sergeant, a Crossbowman, a Hedge-Mage and an Archer in Masterwork steel (the hit points match the encounter built at level 9); the route to Stonehollow was opened from the Routes tab (61 hexes, 2 gold every 5 days and 1 mithril every 10, security 41%), its road drawn secure, then tainted, then raided on the map; the Mithril Lode, held after `blight 0` and five days, put 2 mithril in the stock, which the trading post offers for sale. What did not go as scripted: a party raised to level 12 by `xp 50000 all` (the most that command gives) in its starting kit lost the fight, as did the in-browser harness's simple fighting bot at level 19; the real fight was won by auto-resolve with a level-19 party (forecast win above 95%).
