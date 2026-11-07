# Step 11: Measure, tune and document

Task: measure the stage in the simulator against step 01's baseline, run the design's check 2, tune only if the guard moved too far (with every attempt recorded), bring the docs up to date, and walk the play script.

- **Plan:** [index.md](index.md)
- **Source design:** [`docs/designs/long-campaign/stage-04-runes.md`](../../designs/long-campaign/stage-04-runes.md) (§6 Verification, §7 Risks, "Done when")
- **Reference:** [`reference/gear-and-runes.md`](../../designs/long-campaign/reference/gear-and-runes.md) §4.4, §4.5, §6 ("Economy": the levers)
- **Stages overview and conventions:** [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md)
- **Engineer / reviewer:** opus / opus. Judging the guard and any tuning needs the session's model. The documentation pass (§4.3) is mechanical once the figures are in, and may go to `model: "sonnet"`.

## 1. Objective

Close stage 4. This step:
- judges the early-game guard against step 01's baseline and step 10's figure;
- runs the design's check 2, the three Troll Lair cells;
- tunes only the economy levers of §4.2, in order, and only if the guard moved more than about 5 points;
- records every figure;
- reports the plan's defaults D1 to D4 for the user;
- updates CLAUDE.md, the manual and its screenshots, the stage design's "Implementation notes" and the stages index's status line;
- walks the design's play script, or lists what was not walked.

## 2. Requirements and context

- **The early-game guard.** The baseline is the figure step 01 measured on this tree before any code changed. It is recorded in [index.md](index.md) and in step 01's execution record. After stage 3 the guard was 233 of 500. The guard command is exactly:

  ```sh
  npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1
  ```

  A move of more than about 5 points from step 01's figure must be explained in CLAUDE.md's rules of scaling and in the stage's notes, or retuned away. The checkpoints before this step:
  - **after 03, 04, 05, 06 and 07:** identical to step 01's, because the simulator neither loots nor embeds runes until step 10, and nothing draws differently (correction 2);
  - **after 10:** measured, with the runes found, bought and fused, the sockets filled and the gold on runes (C11).

  So any move comes from step 10's rune policy: rune loot, fusing, buying, embedding, and extraction before replacement. Each step's record holds its figure. The design expects rune loot and Masterwork sockets to lift the guard a few points at most.
- **Design §6 check 2.** Three single cells at `--encounter troll_lair --threat 5 --party-level 5`. The party level is 5, as in stage 3's Troll Lair cell (correction 17). Quote the ids so that no shell reads the `#`:
  - `--player-weapon 'iron_sword@3'` (the Masterwork longsword, no rune);
  - `--player-weapon 'iron_sword@3#ember1'`: expect a modest gain;
  - `--player-weapon 'iron_sword@3#ember3'`, rank 3 given directly: expect a large gain, as Seared stops the trolls' regeneration (C1: Ember from rank 3 lays `seared` for 1 turn).

  `--player-weapon` puts the weapon in every member's hand.
- **What "done" means** (design): all tests pass, the guard holds, and the play script has been walked.
- **The plan's defaults for the user** (index "Open questions"; none blocked a step). Report each with what the stage showed of it:

  | # | Decision | Default taken |
  | --- | --- | --- |
  | D1 | Hit points when Life-runed gear comes off or goes on | The user chose to keep the hero's share (both ways, the orchestrator extending it to a rise); the default was to lose the excess (correction 4) |
  | D2 | The Source's rune loot | Threat 5's row; the reference's Source row waits for stage 9 (correction 8) |
  | D3 | The simulator's rune policy | Ember, Storm, Stone for weapons; Stone, Life for armour and shields; embeds only at a workshop (correction 11) |
  | D4 | Rune prices at ranks 3 and 4 | 135 and 405 (correction 6) |

- **Corrections from the index** this step relies on, for the docs:
  - 1: runes sit compact; `embed` fills the next socket, `extract` takes an index, `fuse` takes the key fused from;
  - 2: on-hit damage is flat and draws nothing;
  - 3: `CombatantStats.blightborn` on the Blight Horror; a bane applies against regeneration or `blightborn`;
  - 4: every gear change outside battle ends with `clampHp`, and CLAUDE.md's "no item changes maximum hit points" rule is rewritten;
  - 5: `AttackEvent.damage` stays the weapon's, with `bonus[]`, `healed` and `onHitStatuses`;
  - 6: `RUNE_PRICES` 15, 45, 135, 405;
  - 7: Mind fits only a weapon that strikes with Magic;
  - 8: the loot rows for threats 1 to 7, the Source at threat 5's row, the favoured runes, and no runes from a debug `fight`;
  - 9: `lootRng(battleSeed)`, a stream of its own;
  - 10: rank numerals I to IV in names, "[Ember I]";
  - 11: the simulator's rune policy;
  - 12: the aggressive policy counts the on-hit bonus;
  - 13: one icon per rune kind, the socket pips and the `pip` canvas;
  - 14: the trading post never sells a runed item, and a runed item's sale price adds half its runes' prices;
  - 16: a field embed reports as a field craft does;
  - 18: fusing checks the workshop level before the count;
  - 19: `give` takes rune keys.

## 3. Dependencies and what this step relies on

Steps 01 to 10 are done when this step starts.

**From step 01:** the baseline guard and the Troll Lair cell with `iron_sword@3`, in index.md and step 01's record. The baseline includes:
- the Source beaten of 500 and how the campaigns ended;
- days, battles and heroes dead;
- the per-threat win table and the level lines.

**From step 02 (C9):**
- the icons `icon_rune_<id>` for the ten `RUNE_IDS`;
- `icon_socket_empty` and `icon_socket_filled`;
- the `pip` canvas class in `art/sprite-tool.toml`.

**From steps 03 to 07 (C1 to C8, unchanged):**
- `src/inventory/runes.ts`:
  - `RUNES`, `RUNE_IDS`, `RANK_NAMES` and `rankNumeral`;
  - `runeStats`, `socketsOf` (tier 1: 0, tier 2: 1, +1 at Masterwork, at most 3, a small slot at most 1; the Emberblade, the Wand of Storms and the Hawkeye Bow 1), `runeFits` and `socketLines`;
  - the `Pouch` helpers.
- Ids: `<plain>[@<grade>][+<modifier><grade>][#<rune>(.<rune>)*]`, and `<unique>[#…]`.
- `ItemStats.wards`, `onHit` and `maxHp`, and `OnHit` in `combat.ts`. `deriveCombatStats` sums wards over everything worn, and takes `onHit` from the main hand only. `maxHp` adds the Life runes. `clampHp`.
- `GameState.runes`, saved; `SAVE_VERSION` **18**. Debug: `give <item|rune> [count]`, `items` and `runes`.
- The engine: on-hit damage after resistance, warded and not doubled by a critical; on-hit statuses after the damage; Life's healing; bane; `blightborn`. `AttackEvent.bonus`, `healed` and `onHitStatuses`; `LOG_SCHEMA_VERSION` **23**.
- `src/game/runecraft.ts`:
  - embedding costs 5 gold × rank and works at a workshop at any level, or in the field for rank 1, taking a day;
  - fusing costs 10 gold × the new rank and needs `FUSE_LEVELS` `{ 2: 1, 3: 4, 4: 5 }`;
  - extracting costs 10 gold × rank and needs workshop level 2.
- `src/game/loot.ts`: `lootRng`, `rollRunes`, `takeRunes`, and `FAVOURED_RUNES` (`salamander_pool` Ember, `spider_nest` Venom, at 50%).
- `tradingPost.ts`:
  - `RUNE_PRICES`, and `SHOP_RUNES` (ember, rime, storm, stone, wind, life);
  - rank 1 from post level 2 and rank 2 from level 4 (`RUNE_RANK_LEVELS`);
  - runes sell from the pouch for a third of their price, and an embedded rune adds half its price to an item's sale.

**From steps 08 and 09 (C9, C10):**
- the tooltip's socket lines, the character tab's `Wards:` line and the pips;
- `bonusText` and the floating "+3 fire" in battle;
- runes named on the victory screen's "Found:" line;
- crafting's Modify and Runes tabs, and the field embed;
- the trading post's Runes filter and rune sales;
- the encampment's rune lines for the workshop and the trading post;
- the probes.

**From step 10 (C11):**
- `RUNE_ORDER` and `runecraftGear`;
- extraction before replacement;
- `takeRunes` after each win;
- the record's `runesFound`, `runesBought`, `runesFused`, `socketsFilled` and `goldOnRunes`, in the summary;
- step 10's guard figure.

**Environment:**
- Local Node 26: prefix commands with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or use the podman `make` targets.
- `npm test` (`tsc && vitest run`) is the gate before the commit.
- The simulator is `npm run simulate -- <flags>` (or `make -s simulate ARGS="<flags>"`).
  - A 500-campaign run takes about a minute and writes about 70 MB under `logs/` (gitignored).
  - Locally, give concurrent runs distinct `--out` files.
  - Never run two `make simulate` at once: both build the same image, and the loser prints nothing.
  - Delete the logs this step writes.
- `npm run manual:screenshots` retakes the manual's screenshots (`e2e/manual.shots.ts`, `vitest.manual.config.ts`). It needs Playwright's Chromium, which the podman image carries.
- `make dev` (or `npm run dev`) serves the game at http://localhost:5173.

## 4. Scope and guidance

### 4.1 Measure

From seed 1, with 500 battles each:

1. **The guard** (the command in §2). Record:
   - the Source beaten of 500, and how the campaigns ended;
   - days, battles and heroes dead a campaign;
   - the per-threat win table and the level lines;
   - gold on gear and from sales, and the workshop's and trading post's levels at the end;
   - the new record fields: runes found, bought and fused, sockets filled and gold on runes, a campaign.

   Compare with step 01's figure and step 10's. If it moved more than about 5 points, break it down by cause with scratch runs that are not committed:
   - one with `takeRunes` skipped (no rune loot);
   - one with `runecraftGear` skipped (loot taken but never used);
   - the battles lost at each threat.
2. **Check 2:**

   ```sh
   npm run simulate -- --player-weapon 'iron_sword@3' --encounter troll_lair --threat 5 --party-level 5 --battles 500 --seed 1
   npm run simulate -- --player-weapon 'iron_sword@3#ember1' --encounter troll_lair --threat 5 --party-level 5 --battles 500 --seed 1
   npm run simulate -- --player-weapon 'iron_sword@3#ember3' --encounter troll_lair --threat 5 --party-level 5 --battles 500 --seed 1
   ```

   Record for each:
   - the wins of 500 and the rounds;
   - the player side's damage dealt (bonus included, C5) and its hit rate;
   - the statuses laid.

   Step 01 measured the `iron_sword@3` cell; re-run it here all the same, and say if it moved.
   - "Modest" at rank 1 means more wins than `iron_sword@3`, or more damage where the cell is still lost.
   - "Large" at rank 3 means clearly more wins.
   - If rank 3 does not win clearly more, check in a log that `seared` is laid and that `regenerate` events stop while it lasts.
3. **The record fields.** Say whether the party has sockets at all by the time it reaches the Source. Few sockets mean little Masterwork or tier 2 is bought. If no sockets are filled, the guard cannot have moved through runes, and that is a finding for the user (D3), not a bug to tune.

### 4.2 Tune (only if needed)

Tune only if the guard moved more than about 5 points from step 01's figure, and the breakdown shows a rune or economy cause. Use these levers in this order, re-running the guard after each and reverting what does not help (reference §6, "Economy"):
1. The rune sale prices: `runeSalePrice` (a third) and the half price an embedded rune adds to `salePrice`.
2. The site yields (`territory.ts`). Touch them only if the move is gold starved by runes.
3. The loot chances in `rollRunes`: threat 1–3's 50%, threat 4–7's rank-1 70%, and `FAVOURED_CHANCE`.

Record every attempt and its figure in the execution record, kept or reverted.

**Never the foes for a rune move.** Do not change stat blocks, encounter counts, `FOE_XP`, the bandits or the engine's rules here. Any change of balance beyond the three levers goes to the user, with the figures. So does a change to the rune table (C1) or to the simulator's policy (D3).

After any tuning:
- update the tests that pin a tuned number, so `npm test` stays green;
- amend a changed contract (C7 or C8) in index.md, marked "amended at step 11";
- re-run the guard.

### 4.3 Document

**CLAUDE.md.** Earlier steps updated the lines their own changes made wrong; check each, and fix what is still stale. Make a full pass:
- **The id grammar** in the `src/character/` and `src/inventory/` paragraph: `<plain>[@<grade>][+<modifier><grade>][#<rune>(.<rune>)*]`, a unique item taking only the `#` part, and the names "[Ember I]".
- **`runes.ts`**, in one line:
  - the ten runes at four ranks, each by slot class (weapon, shield, armour);
  - `socketsOf` (by tier, +1 at Masterwork, a small slot at most 1, and three unique items with 1);
  - `runeFits` (Mind only in a magic weapon);
  - the pouch.
- **The hit-point rule** (correction 4). Search for "No item changes maximum hit points" and every line that leans on it, in the gear-in-battle paragraph and the rules of characters. Rewrite it: only a Life rune adds maximum hit points, and every gear change outside battle ends with `clampHp`, which keeps the hero's share of its hit points when the maximum drops (the user's answer to D1), while the engine clamps on `equip` in battle.
- **The rules of the battle system:**
  - on-hit effects: flat damage after resistance, warded, not doubled by a critical, no RNG draw;
  - statuses laid after the damage, an `onCrit` one only on a critical;
  - Life's healing;
  - a bane only against regeneration or `blightborn`;
  - `AttackEvent.bonus`, `healed` and `onHitStatuses`, with `damage` still the weapon's;
  - hero wards from gear;
  - the aggressive policy's harm counting the bonus.
- **`deriveCombatStats`:** wards summed over everything worn, `onHit` from the main hand only, and Life runes in `maxHp`.
- **`LOG_SCHEMA_VERSION`** (23) and **`SAVE_VERSION`** (18), wherever CLAUDE.md names a number.
- **The modules:** a line each for `src/game/runecraft.ts` and `src/game/loot.ts`. Runecraft is embed, extract and fuse, with its levels and costs, and the field embed of rank 1 taking a day. Loot is `rollRunes`, its own seeded stream, the rows for threats 1 to 7 and the favoured runes. `GameState.runes` goes in the `gameState.ts` line.
- **The trading post and the encampment's gear:**
  - rank-1 runes from level 2 and rank 2 from level 4, of six kinds;
  - `RUNE_PRICES`;
  - a rune sells for a third, and an embedded rune adds half its price;
  - a runed item is never a ware.
- **The scene layer:**
  - `RUNE_ICON_KEYS`, `SOCKET_PIP_KEYS`, `RUNE_COLOURS` and `socketPips` beside `ITEM_ICON_KEYS`, and which scenes load them;
  - crafting's Modify and Runes tabs, and the field embed resuming `World` with `CraftedData`;
  - the trading post's Runes filter and rune sales;
  - `bonusText` in `battleEffects.ts`;
  - the victory screen's runes;
  - the character panel's wards line.
- **The debug console:** `give` taking rune keys, `items`, and the new `runes`. Also say that a debug `fight` rolls no runes.
- **The simulator paragraph:**
  - rune loot taken after each win;
  - `RUNE_ORDER` and `runecraftGear` at a workshop;
  - extraction before replacement;
  - the summary's runes found, bought and fused, sockets filled and gold on runes;
  - `--player-weapon` taking runed ids (`'iron_sword@3#ember1'`, quoted).
- **Rules of scaling:**
  - append the stage-4 guard to the history in the paragraph's existing style (what changed, and what it did to the figure), with step 01's baseline;
  - check 2's three cells;
  - any tuning, and the reason for any move beyond about 5 points.

Search CLAUDE.md before committing for every name the stage renamed or replaced: `gradeNumeral` used for runes, `takeLoot`'s description, and "no item changes maximum hit points".

**`docs/manual/README.md`:**
- **§4 "Inventory":** sockets and runes in the tooltip, the pips on item icons, and the Character tab's wards line.
- **§5 "Victory and defeat":** runes found after a win.
- **§5 "Attacking" or "How a hit is rolled":** on-hit damage ("+1 fire"), warded and not doubled by a critical, and the statuses it lays.
- **§6 "Elements and wards":** heroes now have wards, from runes in armour and shields.
- **§9 "Building"** (around "Gear families", "Gear grades", "The trading post" and "Crafting"):
  - a new section on runes: the ten runes as a short table by weapon, armour and shield, the four ranks, and sockets by tier and grade;
  - runecraft: embed, fuse and extract, with costs, workshop levels and the field embed;
  - the pouch;
  - the trading post's rune wares and prices;
  - fusing stops at rank 2 for now.
- **The facilities table:** the workshop's and the trading post's rune lines.
- **Elsewhere:** adjust any wording the stage made wrong, such as a claim that items never change hit points.

**Screenshots.** Retake all of them with `npm run manual:screenshots`, in the podman image if Chromium is not local.
- In `e2e/manual.shots.ts`, `it('the trading post and the workshop', …)` is the place for the new shots:
  - the crafting screen's Runes tab with a Masterwork item selected and a rune in the pouch (raise the post and the workshop, and `give` the rune, by the debug console as the test already does);
  - the trading post's Runes filter.
- A tooltip showing a runed item's socket lines, if a shot already shows the panel.
- Look at each image against its caption, and update the captions.

**The stage design** ([`stage-04-runes.md`](../../designs/long-campaign/stage-04-runes.md)): set its status line to done, with a link to the notes. Append an `## Implementation notes` section with:
- the commits of steps 01 to 11;
- the guard: step 01's baseline, the identical checkpoints after 03 to 07, step 10's figure and any tuning;
- check 2's three cells;
- the record's rune figures a campaign;
- any tuning, with its effect;
- the plan's corrections and the defaults D1 to D4, in brief;
- what the play-script walk found, or the steps left for the user.

**The stages index** ([`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md)): mark stage 4 done in the stages table, as the rows of stages 1 to 3 do ("done; see its implementation notes", with the guard figure). Add stage 4's figure to the guard sentence under "Conventions for every stage".

**Not this step's:** `docs/features/long-campaign-stage-04.md` belongs to the orchestrator; do not edit it.

### 4.4 Walk the play script

Run the game with `make dev` (or `npm run dev`), start a new game with the ready-made party, and walk the design's play script. Open the debug console with `~`.
1. Run `stock gold 300` and `facility trading_post 3`. Enter the encampment and open the trading post. Buy a Masterwork Iron Longsword (`iron_sword@3`, one socket) and two Lesser Ember Runes from the Runes filter. Then run `facility workshop 2`.
2. At the workshop's Runes tab, embed one Ember rune in the longsword.
   - See the name become "Masterwork Iron Longsword [Ember I]".
   - See the tooltip's socket lines and the pip filled.
   - Extract it, see the fee (10 gold) come off the stock, and see the rune back in the pouch.
3. Run `give storm1 3`, and fuse the three into a Storm Rune (20 gold, workshop level 1 or more). Try to fuse it on to rank 3, and see it refused naming a level 4 workshop (correction 18).
4. Equip the Ember sword on the fighter (Aldric) and run `fight troll_lair 4`.
   - See "+1 fire" rise on hits and in the log line ("HITS Troll for N dmg … +1 fire").
   - Then run `give iron_sword@3#ember3`, equip it, and fight again. See Seared laid on hits ("seared"), and no "regenerates" line for a troll while it is seared.
5. Away from the encampment, on the world map, embed a rank-1 rune in the field from the Craft button's Runes tab. See the screen close, one day pass, and the map report it.

Also look at the character panel's `Wards:` line with a Rime-runed breastplate (`give iron_breastplate@3#rime1`), and at a victory's "Found:" line after a win at a monster location.

If the game cannot be driven by hand from this session, drive it headless with the in-browser test driver (`e2e/driver.ts`, as in `e2e/CLAUDE.md`) from a scratch script, not committed, with screenshots to look at. List each step not walked, or not seen, in the execution record and the stage's notes, for the user to walk.

### Out of scope

- Any code change other than the levers in §4.2, the tests that pin them, and `e2e/manual.shots.ts`.
- Changing the rune table, the foes, the bandits, the engine's rules or the simulator's rune policy (§4.2: take them to the user).
- Edits to files other than:
  - `src/game/tradingPost.ts`, `src/game/loot.ts` and `src/game/territory.ts` (the levers), and the tests pinning those numbers;
  - `e2e/manual.shots.ts` and `docs/manual/images/`;
  - `CLAUDE.md` and `docs/manual/README.md`;
  - the stage design and the stages index;
  - this plan's `index.md` and this file.

## 5. Verification

- **The guard:** recorded, and within about 5 points of step 01's figure, or the move explained in CLAUDE.md and the notes (or taken to the user, §4.2).
- **Check 2:** the three cells recorded. Rank 1 gains modestly over `iron_sword@3`, and rank 3 gains clearly. If not, record it with what the logs show for the user; the rune numbers are not tuned here.
- **Defaults D1 to D4:** each reported in the execution record and the stage's notes, with what the stage showed of it.
- **Tests:** `npm test` passes after the last change. `npm run test:browser` passes if anything in a scene or `e2e/` moved.
- **Sprites:** `npm run sprites:check` is up to date, and no rune icon or pip is a placeholder.
- **Build:** `npm run build` succeeds.
- **Docs:** CLAUDE.md, the manual and its screenshots, the stage's implementation notes and the stages index updated as in §4.3. A search of CLAUDE.md for "maximum hit points" finds no stale claim.
- **The play script:** walked, or its unwalked steps listed.

## 6. Completion criteria

- [ ] The guard and check 2's three cells have been run, with their figures and the record's rune figures in the stage's implementation notes.
- [ ] Any tuning is recorded with its effect, the guard re-run after it, and any changed contract amended in index.md. Moves not tuned are explained or taken to the user.
- [ ] D1 to D4 are reported for the user.
- [ ] CLAUDE.md, `docs/manual/README.md` (with retaken screenshots), the stage design's implementation notes and status line, and `docs/designs/long-campaign/index.md` are updated.
- [ ] The play script is walked, or its unwalked steps are listed for the user.
- [ ] `npm test` passes. One commit for the step, on `long-campaign-stage-04`, not pushed, the message ending with the repo's `Co-Authored-By` attribution line. The screenshots may go in a commit of their own.
- [ ] Step 11's row in [index.md](index.md) is set to `done` with the commit, the overall completion checklist is ticked where met, and the execution record below is filled.

## Execution record

- **Guard** (`npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1`, `--out logs/s11-guard.jsonl`): **230 of 500** (46.0%), identical to step 10's run line for line; party fell 270, encampment lost 0; 270 days, 18.2 battles, 26.0 spawns, 1.8 heroes dead a campaign; post, workshop, infirmary 1.1, 0.6, 0.5; 1 gold on gear, 51 from sales, 4.3 items crafted; 0.0 tier-2 bought; runes 13.1 found, 0.0 bought, 0.1 fused, 3 gold on runes, 0.0 sockets filled at the end. Per threat: 1007/1007, 1732/1756, 1932/1995, 2847/2870, 1333/1493 (step 01: 1349/1506 at threat 5). Against step 01's 233: −3, inside about 5, so no scratch breakdown runs and **no tuning** (§4.2 not entered). Cause, as step 10 found: the party wears almost no socketed gear (no tier 2, Masterwork rare), so the found runes sit in the pouch; the 3 points are the gold of the few fuses. Per §4.1.3 this is a finding for the user (D3, and the economy), not a bug.
- **Check 2** (Troll Lair, threat 5, party level 5, 500 from seed 1): `iron_sword@3` 0 wins, 7.12 rounds, 49.8 damage, hit 0.243, statuses 1.30 (identical to step 01); `'iron_sword@3#ember1'` 0, 7.13, 52.6, 0.244, 1.30; `'iron_sword@3#ember3'` 2, 7.22, 58.9, 0.248, 3.93. Rank 1 modest in damage (the cell is lost); rank 3 is **not clearly more wins**. Log check (scratch script over `logs/s11-c3.jsonl`): 1315 Seared laid on hits, 2285 regenerations (3139 with the plain sword), 0 regenerations of a troll while seared. Recorded for the user; rune numbers not tuned.
- **D1 to D4:** D1 (keep the share of hit points, both ways) is in CLAUDE.md, the manual's Runes section and the notes; the simulator never filled a socket, so Life gear never moved its hit points there. D2 (Source rolls threat 5's row): the Source's win takes one rune like any threat-5 win. D3 (rune order, workshop only): never exercised in the guard, as no socket is worn; 0.1 fuses a campaign. D4 (135, 405): unused, as nothing reaches rank 3.
- **Docs:** CLAUDE.md: `--player-weapon` takes runed ids (quoted); stale "nothing derives or resolves the three yet" and "Nothing calls `takeRunes` yet" fixed; debug console (`give` rune keys, `items`, `runes`, a `fight` rolls no runes); the pips in all three scenes; Life's `maxHp` (armour or shield) and "the user's choice, both ways"; hero wards in the rules of characters; stage 4's guard and cells in the rules of scaling. A search for "maximum hit points" finds only the Life-rune wording. Manual: Character tab's wards line, tooltip sockets and pips, on-hit damage under Attacking, runes on the victory screen, hero wards under Elements and wards, the facilities table's rune lines, the post's Runes filter and rune sales, the Modify tab, a new **Runes** section (sockets, ranks, the ten runes' table, Life and hit points, runecraft with costs and levels, the field embed), sockets on the three uniques. Stage design: status done and Implementation notes. Stages index: row 4 done, guard sentence.
- **Screenshots:** `e2e/manual.shots.ts` plants a `steel_longsword@3#storm1` in the baggage and Ember and Life runes in the pouch, and takes `trading-post-runes` (the Runes filter at post level 4) and `crafting-runes` (the Runes tab, the longsword selected with one socket filled, an Ember embed previewed). `npm run manual:screenshots`: 6 passed; both new images and `crafting.png` looked at. The runed-item tooltip was not added to a manual shot (the panel shots come from a fresh game); the play-script walk saw it.
- **Play script:** walked headless with a scratch `e2e/zz-playscript.test.ts` (deleted, not committed), screenshots in the session scratchpad. Steps 1, 2, 3 and 5 walked and seen in full (messages, previews, gold, pouch, turn, tooltip lines, the filled pip); step 4 seen in the log lines ("HITS Troll for 10 dmg +1 fire.", "+3 fire, seared.", no regeneration while seared). Also seen: "Wards:" / "frost 2" with a Rime breastplate, and "Found: Ring of Protection and Lesser Life Rune." after the Goblin Raiders. **Not seen, for the user:** the floating "+1 fire" at impact (gone by the screenshot at tenfold speed) and the Seared letter on the troll's nameplate.
- **Gates:** `npm test` 78 files, 1188 tests passed; `npm run sprites:check` up to date (121 sprites); `npm run build` built; `npm run test:browser` 9 files, 89 tests passed. Logs written by this step deleted.
- **Deviation:** none in code; no lever touched.
