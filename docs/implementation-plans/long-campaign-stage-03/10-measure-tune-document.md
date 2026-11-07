# Step 10: Measure, tune and document

Task: measure the stage in the simulator against step 01's baseline, run the design's matchup checks, tune the economy only if the guard moved too far, bring the docs up to date, and walk the play script.

- **Plan:** [index.md](index.md)
- **Source design:** [`docs/designs/long-campaign/stage-03-gear-families.md`](../../designs/long-campaign/stage-03-gear-families.md) (§6 Verification, §7 Risks, "Done when")
- **Reference:** [`reference/gear-and-runes.md`](../../designs/long-campaign/reference/gear-and-runes.md) §4.1 to §4.3
- **Stages overview and conventions:** [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md)
- **Engineer / reviewer:** opus / opus. Judging the guard and any tuning needs the session's model. The documentation pass (§4.3) is mechanical once the figures are in, and may go to `model: "sonnet"`.

## 1. Objective

Close stage 3:
- judge the early-game guard against step 01's baseline;
- run the design's simulator checks 2 and 3 (the war hammer against armour, and the spear against the longsword);
- watch the reach weapons' win rates (design §7);
- tune only the economy levers of §4.2, in order, if the guard moved too far;
- record every figure;
- update CLAUDE.md, the manual and its screenshots, the stage design's "Implementation notes" and the stages index's status line;
- walk the design's play script, or list what was not walked.

## 2. Requirements and context

- **The early-game guard.** The baseline is the figure step 01 measured on this tree before any code changed, recorded in [index.md](index.md) and in step 01's execution record. After stage 2 it was 248 of 500. The guard command is exactly:

  ```sh
  npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1
  ```

  A move of more than about 5 points from step 01's figure must be explained in CLAUDE.md's rules of scaling and in the stage's notes, or retuned away. The checkpoints before this step:
  - **after 04:** identical but for the mage's wand, which the simulator may now buy graded (correction 18), checked by a scratch run that skipped the wand;
  - **after 05:** identical to step 04's (no simulated hero holds a reach weapon or a crossbow; Q1 decides any strength penalty);
  - **after 06:** measured, with trading post level 4 (120 gold, 20 silver) as a new gold sink and tier 2 bought;
  - **after 09:** measured, with bandit gear and the Crossbowman as Q2 decided.

  So any move comes from the wand (04), Q1's rows (04/05), the trading post's level 4 and steel (06) and the bandits (09). Each step's record holds its figure.
- **Design §6 simulator checks:**
  1. The guard. The design expects small movement, from tier 2 bought at level 4 if the party affords it.
  2. `--player-weapon steel_war_hammer --encounter troll_lair --threat 5 --party-level 5` against `--player-weapon iron_sword` in the same cell: the hammer should win more against the armoured troll. `--player-weapon` puts the weapon in every member's hand, so the archer and mage (strength 3) swing it 3 points short, at −15 to hit (correction 12). That is part of the check as the design wrote it. Record it, and do not compensate.
  3. `--player-weapon iron_spear --encounter goblin_raid --threat 3 --party-level 3` against `iron_sword`: comparable. The party level is 3, the threat's own (correction 19).
- **Design §7 risk:** a second rank of reach weapons may be strong. Watch the spear's and halberd's win rates.
- **What "done" means** (design): all tests pass, the guard holds, check 2's matchup favours the hammer, and the play script has been walked.
- **Corrections from the index** this step relies on:
  - 1: `iron_greatsword` and `iron_breastplate`, with `steel_greatsword` now tier 2 and `steel_armor` an alias;
  - 2 to 4: wood, cloth and leather names;
  - 6: grades by gear class, small slots armour class +1 / +2;
  - 10: gear sprites for new held and worn icons, and the trading post's `level_4` frame;
  - 11: reach is melee in the engine, and `AttackEvent.melee`;
  - 12: shortfall per item, weapon attacks only;
  - 14: the filter defaults to weapons, and the shortfall shows only where a wearer is known;
  - 15: first-value prices;
  - 18: the Wand of Sparks is plain;
  - 19 and 20: the check-3 party level and the simulator's buy rule.

## 3. Dependencies and what this step relies on

Steps 01 to 07 are done, and 08 and 09 are done or settled by Q2 (skipped if Q2 chose (d), with that recorded) when this step starts.

**From step 01:** the baseline guard (Source beaten of 500, how campaigns ended, days, battles, heroes dead, the per-threat win table, the level lines) and the reference cells it ran (`iron_sword` at Troll Lair t5/L5 and at Goblin Raid t3/L3, and the Bandit Camp cells), in index.md and step 01's record.

**From step 04 (C1, C2, C3, C4, C5, unchanged):**
- `src/inventory/catalog.ts` holds `MATERIALS` (iron, steel, yew, ironwood, leather, wolfhide, linen, silk), `FAMILIES` (28), `TIER_BONUS` by `GearClass`, `gearClass`, and `LEGACY_ALIASES` (`{ steel_armor: 'iron_breastplate' }`).
- Ids: `<material>_<family>`, or a family's `tier1.id` (`iron_sword`, `spark_wand`, `ash_staff`, `oak_shield`, `leather_armor`) at tier 1. Then `[@<grade>][+<modifier><grade>]`.
- `TIER_BONUS` tier 2: weapon damage +2; shield acBonus +2; armour acBonus +2 and resistance +1; small acBonus +1.
- Grades by class: weapon damage +1 / +2 (+5 to hit at Masterwork); shield armour class +3 / +6; armour resistance +1 / +2; small armour class +1 / +2.
- Modifier fits: balanced (shortsword, longsword, greatsword, spear); recurve (bow); bearded (battle_axe, mace); keen (dagger, shortsword, longsword); braced (shield); light (longsword, battle_axe); long (bow, crossbow); reinforced (breastplate, leather).
- Prices: `PRICES` per family at tier 1, `TIER_PRICE` `{ 1: 1, 2: 2.5 }`, `GRADE_PRICE` `{ 1: 1, 2: 3, 3: 8 }`, and `buyPrice = PRICES[family] × TIER_PRICE[tier] × GRADE_PRICE[grade]`.

  | Family | Price | Family | Price | Family | Price | Family | Price |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | dagger | 6 | battle_axe | 14 | wand | 30 | robe | 10 |
  | shortsword | 8 | war_hammer | 18 | staff | 16 | leather | 14 |
  | rapier | 10 | greatsword | 20 | buckler | 6 | breastplate | 20 |
  | longsword | 12 | halberd | 22 | shield | 10 | plate | 30 |
  | mace | 12 | bow | 12 | tower_shield | 18 | cap, gloves, boots | 4 |
  | spear | 12 | longbow | 16 | | | helm, gauntlets, greaves | 6 |
  | | | crossbow | 18 | | | | |
- `SAVE_VERSION` 16, and the Q1 answer applied to the battle axe's, greatsword's and breastplate's rows.

**From step 05 (C7, unchanged):**
- `deriveCombatStats` takes `SHORTFALL_TO_HIT` (5) × Σ `strengthShortfall` off `toHit` and Σ `apPenalty` off `actionPoints`.
- `ranged = attackRange > 1 && !reach`, and the crossbow's own `armorPierce` counts through `rangedPierce`.
- `CombatantStats.reach`, `isMelee`, and `arcStruck(defender, from, melee)`. `AttackEvent.melee`; `LOG_SCHEMA_VERSION` 22.

**From step 06 (C8, unchanged):**
- `TRADING_POST_COSTS` level 4 `{ gold: 120, silver: 20 }`, and `TIER_TWO_LEVEL = 4`.
- `sells(world, item)`, `wares(world, filter?)`, and `WaresFilter { slot?, family? }`.
- The simulator buys the dearest item of the worn family the post sells and the gold affords, if it costs more than what is worn (correction 20). `Trade.tierTwoBought`, and the summary's tier-2 items bought a campaign.

**From step 07:**
- `TradingPostProbe.filter`, `slotButtons` and `familyButtons`; the Buy tab opens on `{ slot: 'mainHand', family: null }`.
- The tooltip's and the comparisons' strength, AP, reach and spell-skill lines (C7 words), and `MATERIAL_TINTS` and `iconTint` in three scenes.

**From steps 08 and 09** (as Q2 decided): the `bandit_crossbowman` sprite and kind, `banditGear(threat)`, the Bandit Camp's slots, and `SAVE_VERSION` 17 if the slots changed.

**Environment:**
- Local Node 26: prefix commands with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or use the podman `make` targets.
- `npm test` (`tsc && vitest run`) is the gate before the commit.
- The simulator is `npm run simulate -- <flags>`.
  - A 500-campaign run takes about a minute and writes about 70 MB under `logs/` (gitignored).
  - Locally, give concurrent runs distinct `--out` files.
  - Never run two `make simulate` at once.
  - Delete the logs this step writes.
- `npm run manual:screenshots` retakes the manual's screenshots (`e2e/manual.shots.ts`, `vitest.manual.config.ts`). It needs Playwright's Chromium, which the podman image carries.

## 4. Scope and guidance

### 4.1 Measure

From seed 1, with 500 battles each:

1. **The guard** (the command in §2). Record:
   - Source beaten of 500 and how the campaigns ended;
   - days, battles and heroes dead a campaign;
   - the per-threat win table and the level lines;
   - gold spent on gear and taken from sales;
   - the trading post's level at the end;
   - the tier-2 items bought a campaign.

   Compare with step 01's figure and with the figures after 04, 06 and 09. If it moved more than about 5 points, break it down by cause:
   - a scratch run with the trading post held at level 3 (not committed);
   - the bandit cells against step 01's;
   - the battles lost at each threat.
2. **Check 2:**

   ```sh
   npm run simulate -- --player-weapon steel_war_hammer --encounter troll_lair --threat 5 --party-level 5 --battles 500 --seed 1
   npm run simulate -- --player-weapon iron_sword --encounter troll_lair --threat 5 --party-level 5 --battles 500 --seed 1
   ```

   Record the wins, rounds, the player side's damage dealt and its hit rate. Step 01 measured the `iron_sword` cell; re-run it here all the same, as stage 3 changed the derivation. As a control, also run `steel_longsword` (`--player-weapon steel_longsword`), which separates the hammer's piercing from steel's +2 damage.
3. **Check 3:**

   ```sh
   npm run simulate -- --player-weapon iron_spear --encounter goblin_raid --threat 3 --party-level 3 --battles 500 --seed 1
   npm run simulate -- --player-weapon iron_sword --encounter goblin_raid --threat 3 --party-level 3 --battles 500 --seed 1
   ```

   "Comparable" means within about 5% of each other's wins (25 of 500), with similar rounds.
4. **The reach cells** (design §7). Run `iron_spear`, `steel_spear`, `iron_halberd` and `steel_halberd` (`--player-weapon`) at:
   - `--encounter goblin_raid --threat 3 --party-level 3`;
   - `--encounter bandit_camp --threat 4 --party-level 4`.

   Run `iron_sword` and `steel_longsword` at the same two cells as the yardstick. A reach weapon that wins clearly more than the longsword of its tier is a finding: more than about 10% (50 of 500), or at a cell the longsword loses often. Record it for the user, with the second-rank strikes as the likely reason. Do not fix it here: it is an engine rule (correction 11; reference §8.7).
5. **The bandit cells**, if step 09 changed bandits: `--encounter bandit_camp --threat 3/4/5 --party-level` equal to the threat, against step 01's. Under Q2 (a) also run threats 6 and 7. Record them beside step 09's figures.

### 4.2 Tune (only if needed)

Tune only if the guard moved more than about 5 points from step 01's figure, and the breakdown shows a gear or economy cause. Use these levers in this order, re-running the guard after each and reverting what does not help:
1. The trading post's level-4 cost, `TRADING_POST_COSTS[3]` (120 gold, 20 silver).
2. The tier-2 price multiplier, `TIER_PRICE[2]` (2.5).
3. The family prices in `PRICES` (C5), with today's eight last.

**Never the foes for a gear move.** Do not change stat blocks, encounter counts, `FOE_XP` or the bandits' roles here.

A move caused by the bandits (step 09) or by Q1's rows is not tuned here. Explain it, and take it to the user with the figures; the user accepted the bandits' price before. Any other change of balance beyond the three levers also goes to the user. Record the figures and the attempts, and leave a note in the execution record.

After any tuning:
- update the tests that pin a tuned number, so `npm test` stays green;
- amend a changed contract (C5 or C8) in index.md, marked "amended at step 10";
- re-run the guard.

### 4.3 Document

**CLAUDE.md.** Search it first for every name the stage renamed or removed: `STEEL_ARMOR`, `steel_armor`, `STEEL_GREATSWORD`, `steel_greatsword`, "steel breastplate", "Steel Breastplate", `SPARK_WAND`, "the wand, an enchanted item", `PRICES`, `WEAPONS`, `BASE_ITEMS`, the id grammar `<base>[@<grade>][+<modifier><grade>]`, and `fits`. Then make a full pass:
- **`src/character/` and `src/inventory/`:** `catalog.ts` (`MATERIALS`, `FAMILIES`, `TIER_BONUS` by gear class, `LEGACY_ALIASES`) in one line.
  - `BASE_ITEMS`: every family × material of its kind, tiers 1 and 2.
  - `WEAPONS`: still the six a new hero carries.
  - The Wand of Sparks is plain, and `MAGIC_ITEMS` is the enchanted ones.
  - The id grammar `<material>_<family>` or a family's tier-1 id, then `[@<grade>][+<modifier><grade>]`, with the aliases resolving to the canonical item.
  - Grades by gear class, and modifiers fitting families.
- **Rules of characters:**
  - starting gear: the Iron Breastplate;
  - weight: a strength shortfall costs 5 to hit a point, per item and against weapon attacks only;
  - `apPenalty`, and spell-skill penalties;
  - reach counts as melee for skill, strength, piercing and the engine;
  - the crossbow's own piercing counts at range, the strength perks' does not.
- **Rules of the battle system:** a reach weapon (spear, halberd) strikes at range 2 as melee, holding its zone of control and making free attacks at 1 hex (`isMelee`, `CombatantStats.reach`). A defender turns to meet its blow. `AttackEvent.melee`.
- **`LOG_SCHEMA_VERSION`** (22) and **`SAVE_VERSION`** (16 or 17) wherever CLAUDE.md names a number.
- **The trading post** (`tradingPost.ts` line and the rules of the encampment's gear):
  - level 4 (120 gold, 20 silver) sells tier 2;
  - levels 1 to 3 sell tier 1 up to their grade;
  - `wares` takes a slot and family filter;
  - prices per family × tier × grade.
- **The scene layer:**
  - the trading post's filter (default weapons) and its probe;
  - `MATERIAL_TINTS` and `iconTint` beside `ITEM_ICON_KEYS`;
  - the new rows in `GEAR_SPRITES`, `WORN_SPRITES` and `SWUNG_GEAR`;
  - the shortfall shown in the tooltip and the crafting comparison;
  - `gearCompare.ts`'s new words;
  - the trading post's fourth frame.
- **Bandits** (`bandits.ts` and `encounters.ts`): whatever step 09 made of Q2.
- **The simulator paragraph:**
  - `PREFERRED_MODIFIERS` keyed by family;
  - `visitFacilities` buying the dearest item of the worn family the post sells (tier 2 from level 4);
  - the summary's tier-2 items bought;
  - `--player-weapon` taking any catalog id (`steel_war_hammer`, `iron_spear`).
- **Rules of scaling:**
  - append the guard to the history in the paragraph's existing style (what changed, and what it did to the figure), with step 01's baseline;
  - the cells of checks 2 and 3 and the reach cells;
  - any tuning, and the reason for any move beyond about 5 points.

Earlier steps updated the lines their own changes made wrong; check each, and fix what is still stale.

**`docs/manual/README.md`:**
- **Character creation:** heroes start in an Iron Breastplate.
- **Gear** (around today's grades, trading post and modifiers sections):
  - the families and their trade-offs, the weapons and armour as a short table;
  - the tiers (iron, then steel and its wood, hide and cloth twins);
  - weight: strength asked, its shortfall, "AP −1" from plate and the tower shield, spell skill lowered by metal;
  - reach: the spear and halberd strike from the second hex, past an ally;
  - the crossbow pierces armour;
  - grades on every family, with the small slots at armour class +1 / +2;
  - the renamed Iron Greatsword.
- **The facilities table:** the trading post's level 4 cost (120 gold + 20 silver) and "steel".
- **The trading post:** the slot and family filter; the price table rewritten per family, with tier 2 at ×2.5.
- **The modifiers table:** the new fits (spear Balanced, mace Bearded, crossbow Long, leather Reinforced).
- **Bandits:** as step 09 made them.
- **Elsewhere:** adjust any wording the stage made wrong (the Steel Breastplate wherever named; the Wand of Sparks no longer "enchanted").

**Screenshots.** Retake all of them with `npm run manual:screenshots`, in the podman image if Chromium is not local:
- the trading post test in `e2e/manual.shots.ts` (`it('the trading post and the workshop', …)`) clicks `iron_sword@2` by id, which still exists; check that it still finds the row;
- show the Buy tab with the filter set to a family (for example click the `slotButtons` entry for `mainHand`, then the `familyButtons` entry for `war_hammer`, with the post raised to level 4 by the debug console so steel shows);
- the character panel's tooltip with a shortfall, if a shot already shows the panel;
- look at each image against its caption, and update the captions.

**The stage design** ([`stage-03-gear-families.md`](../../designs/long-campaign/stage-03-gear-families.md)): set its status line to done, with a link to the notes. Append an `## Implementation notes` section with:
- the commits of steps 01 to 10;
- the guard: step 01's baseline, and the figures after 04, 06, 09 and any tuning;
- checks 2 and 3, the reach cells and the bandit cells;
- any tuning, with its effect;
- the plan's corrections and the answers to Q1 and Q2, in brief;
- what the play-script walk found, or the steps left for the user.

**The stages index** ([`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md)): mark stage 3 done in the stages table, as stages 1 and 2's rows do ("done; see its implementation notes", with the guard figure). Add stage 3's figure to the guard sentence under "Conventions for every stage".

**Not this step's:** `docs/features/long-campaign-stage-03.md` belongs to the orchestrator; do not edit it.

### 4.4 Walk the play script

Run the game with `make dev` (or `npm run dev`), start a new game with the ready-made party, and walk the design's play script. Open the debug console with `~`.
1. Run `facility trading_post 4` and `stock gold 500`, enter the encampment, and open the trading post.
   - See the Buy tab open filtered to weapons.
   - Filter to the war hammer.
   - Buy a Steel War Hammer.
   - Filter to the head slot and buy a Steel Helm.
   - Check the steel icons are tinted and the prices are ×2.5.
2. On the world map, open the mage's (Delwyn's) panel.
   - Take the hammer from the baggage and equip it.
   - See "Strength: 6 (you have 3): to hit −15%" in its tooltip.
   - Fight a battle (`fight goblin_raid 1`) and see the lower hit chance on the mage's attack preview.
3. Give the fighter (Aldric) an Iron Spear: buy it, or `give iron_spear`. Run `fight goblin_raid 3`.
   - Put an ally between Aldric and a goblin, and attack from the second hex.
   - See the blow play as a swing, not an arrow.
   - See the log line, and that a goblin stepping away from the spearman's side provokes a free attack only at 1 hex.
4. Equip plate on the fighter (`give iron_plate`). See 7 AP, not 8, on his Character tab and in battle, and one attack fewer with a 4-AP weapon (for example the Iron Shortsword he carries).

If the game cannot be driven by hand from this session, drive it headless with the in-browser test driver (`e2e/driver.ts`, as in `e2e/CLAUDE.md`) from a scratch script, not committed, with screenshots to look at. List each step not walked, or not seen, in the execution record and the stage's notes, for the user to walk.

### Out of scope

- Any code change other than the levers in §4.2, the tests that pin them, and `e2e/manual.shots.ts`.
- Changing the reach rule, the foes, or the bandits (§4.2: take them to the user).
- Edits to files other than:
  - `src/game/tradingPost.ts` (the levers) and the tests pinning those numbers;
  - `e2e/manual.shots.ts` and `docs/manual/images/`;
  - `CLAUDE.md` and `docs/manual/README.md`;
  - the stage design and the stages index;
  - this plan's `index.md` and this file.

## 5. Verification

- **The guard:** recorded, and within about 5 points of step 01's figure, or the move explained in CLAUDE.md and the notes (or taken to the user, §4.2).
- **Check 2:** `steel_war_hammer` wins more Troll Lair t5/L5 battles than `iron_sword`. If not, record it with the control run and leave a note for the user; the hammer's numbers are not tuned here.
- **Check 3:** `iron_spear` within about 25 of 500 of `iron_sword` at Goblin Raid t3/L3, or the gap recorded for the user.
- **The reach cells:** recorded, and any finding noted.
- **Tests:** `npm test` passes after the last change. `npm run test:browser` passes if anything in a scene or `e2e/` moved.
- **Sprites:** `npm run sprites:check` is up to date, and no new icon or gear sprite is a placeholder.
- **Docs:** CLAUDE.md, the manual and its screenshots, the stage's implementation notes and the stages index updated as in §4.3.
- **The play script:** walked, or its unwalked steps listed.

## 6. Completion criteria

- [ ] The guard, checks 2 and 3 (with the control), the reach cells and the bandit cells have been run, with their figures in the stage's implementation notes.
- [ ] Any tuning is recorded with its effect, the guard re-run after it, and any changed contract amended in index.md. Moves not tuned are explained or taken to the user.
- [ ] CLAUDE.md, `docs/manual/README.md` (with retaken screenshots), the stage design's implementation notes and status line, and `docs/designs/long-campaign/index.md` are updated.
- [ ] The play script is walked, or its unwalked steps are listed for the user.
- [ ] `npm test` passes. One commit for the step, on `long-campaign-stage-03`, not pushed, the message ending with the repo's `Co-Authored-By` attribution line. The screenshots may go in a commit of their own.
- [ ] Step 10's row in [index.md](index.md) is set to `done` with the commit, the overall completion checklist is ticked where met, and the execution record below is filled.

## Execution record

**Go-ahead and decisions carried by the brief** (the user's, through the orchestrator): bandit gear tier 2 from threat 6, not 5 (amends Q2 (a)); the guard at 233 accepted and documented, not tuned back; threats 6 and 7 left for stage 9; tier 2 never bought judged under §4.2.

**Code change (beyond the plan's levers, by the user's decision):** `banditGear` (`src/game/bandits.ts`) gives tier 1 plain below threat 5, tier 1 Fine at 5 and tier 2 Fine from 6. Test first: `bandits.test.ts`'s `banditGear` test (threats 3 to 7) failed red, then passed; `encounters.test.ts`'s camp test now pins threat 5 at `{ tier: 1, grade: 2 }` and threat 6 (the Captain and the Crossbowman) at tier 2; the captain's tier-2 comparison test moved to threat 6. `encounters.ts`'s doc comment updated. No `SAVE_VERSION` change (no shape changed).

**Measurements** (seed 1, 500 each, scratch runs with distinct `--out` under the scratchpad, logs deleted):
- Guard: **233 of 500** (46.6%), party fell 267, encampment lost 0; 269 days, 18.2 battles, 26.0 spawns, 1.8 heroes dead a campaign; threats 1 to 5 won 1.000, 0.986, 0.968, 0.992, 0.896; post, workshop, infirmary 1.1, 0.6, 0.5; 2 gold on gear, 51 from sales; tier-2 items bought 0.0. Step 01 248, step 04 231, step 05 175 (231 with strength 3), step 06 233, step 09 233.
- Check 2 (Troll Lair t5/L5): steel_war_hammer 0 wins, 7.09 rounds, 48.1 dealt, hit 0.222; iron_sword 0, 7.09, 42.3, 0.201; steel_longsword 0, 7.09, 46.6, 0.200. Not met in wins (the cell is lost whatever the weapon, 0 at step 01 too); recorded for the user.
- Check 3 (Goblin Raid t3/L3): iron_spear 443 (14.3 rounds), iron_sword 486 (12.0): a gap of 43, beyond 25; recorded for the user.
- Reach cells: Goblin Raid t3/L3: iron_halberd 476, steel_spear 472, steel_halberd 486, steel_longsword 494; Bandit Camp t4/L4: iron_sword 433, iron_spear 283, iron_halberd 349, steel_longsword 466, steel_spear 371, steel_halberd 395. No reach weapon beats the longsword of its tier: no §7 finding.
- Bandit cells (L = threat): t3 429, t4 473, t5 **469** (256 with steel at step 09; 470 at step 01), t6 2, t7 1.

**Tuning: none.** The move from 248 to 233 has no gear or economy cause (the breastplate's spell skill −5 on the mage, isolated at steps 04 and 05; the user accepted it), so §4.2's levers were not touched. Tier 2 is never bought because the post ends at level 1.1: §4.2 tunes only to bring the guard back, which lowering level 4's price would not do (and could only cost the guard gold), so it was left; recorded in CLAUDE.md and the notes.

**Docs:** CLAUDE.md (the simulator flag's catalog ids, `banditGear`, the bandit cells, the stage-3 guard history and the check and reach cells in the rules of scaling); the manual (the Iron Breastplate at creation, every weapon family in the attack table with strength, reach and the crossbow's piercing, zones of control for reach, a new "Gear families" section with armour, tiers and weight, grades on every family, the trading post's level 4, filter and per-family prices, the modifiers' new fits, the Crossbowman and steel beyond threat 5); every screenshot retaken (`npm run manual:screenshots`, 6 passed), with the trading post shot filtered to war hammers at level 4 (`manual.shots.ts` now clicks the War Hammer family, raises the post to 4) and a new `panel-strength.png` (the mage hovering the Iron Greatsword: "Strength: 6 (you have 3): to hit −15%"); the stage design's status and implementation notes; the stages index's row and guard sentence.

**Review hand-offs:** the manual shot no longer depends on `iron_sword@2`'s page (it filters by family); the e2e crafting test "…and none for the baggage" now checks the baggage: it pages to `baggage:0`, an Iron Greatsword, and finds no "you have" line.

**Play script:** walked headless with a scratch e2e file on `e2e/driver.ts` (deleted, not committed); see the stage design's notes. Seen: the filter opening on weapons, ×2.5 prices, buying a Steel War Hammer and Steel Helm, the mage's tooltip shortfall line and To Hit −11%, a spear strike at distance 2 over an ally (`melee: true`), 7 AP in plate with one shortsword blow. Not seen, for the user: the spear's swing animation, a spearman's free attack at 1 hex and none at 2, the mage's nameplate preview, and the steel tint (pale, hard to tell at list size).

**Verification:** `npm test` 1053 passed; `npm run build` ok; `npm run sprites:check` up to date (109 sprites); `npm run test:browser` 9 files, 81 tests passed.

