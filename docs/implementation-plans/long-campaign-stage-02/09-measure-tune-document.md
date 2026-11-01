# Step 09: Measure, tune and document

Task: measure the stage in the simulator against step 01's baseline, tune the new nests if needed, bring the docs up to date, and walk the play script.

- **Plan:** [index.md](index.md)
- **Source design:** [`docs/designs/long-campaign/stage-02-special-attacks-and-elements.md`](../../designs/long-campaign/stage-02-special-attacks-and-elements.md) (§6 Verification, §7 Risks, "Done when")
- **Stages overview and conventions:** [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md)
- **Difficulty:** balance judgement: the tuning and the judgement of the guard need the session's model. The documentation pass (§4.3) is mechanical once the figures are in and may go to `model: "sonnet"`.

## 1. Objective

Close stage 2:
- judge the early-game guard against step 01's baseline;
- confirm the Spider Nest and the Salamander Pool are hard but winnable at their threats;
- confirm the Troll Lair is unchanged within noise after the Troll's routine;
- tune the new nests if they are not, by the levers in §4.2, in order;
- record every figure;
- update CLAUDE.md, the manual and its screenshots, the stage design's "Implementation notes" and the stages index's status line;
- walk the design's play script in the game, or list what was not walked.

## 2. Requirements and context

- **The early-game guard.** The baseline is the figure **step 01 measured** on this tree before any code changed, recorded in [index.md](index.md) and step 01's execution record (`make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`). After stage 1 it was 238 of 500, accepted by the user; `fdc0593` and `51cecb5` changed battle rules since, which is why step 01 re-measured it. A move of more than about 5 points from step 01's figure must be explained in CLAUDE.md's rules of scaling and the stage's notes, or retuned away.
  - Steps 02, 03 and 05 left the summary identical (step 05 to step 04's).
  - Step 04 changed the Troll (on the map at the Troll Lair, threat 4); its guard was measured there.
  - Step 08 replaced two threat-5 nests (the Troll Den and the Goblin Pillagers) with the Salamander Pool and the Spider Nest, so any further move comes from step 08.
- **The cells.** A party of the threat's level should win **most but not all**: roughly 60% to 95%.
  - `--encounter spider_nest --threat 4 --party-level 4` and `--encounter spider_nest --threat 5 --party-level 5`;
  - `--encounter salamander_pool --threat 5 --party-level 5`;
  - `--encounter troll_lair --threat 4 --party-level 4` and `--threat 5 --party-level 5`: within noise of step 01's figures (the design's check 3, after the routine change; correction 1 made every turn's expected damage today's).
  - Below about 60% the nest is a wall; above about 95% it is trivial.
- **The design's risks** (§7):
  - A cone aimed by the policy can still hurt its own side. That is intended; check the policy's ally penalty in play (the Salamander's spit on its kobolds).
  - Half on a miss makes breath reliable. Keep the recharge at 2 or more.
- **Corrections from the index** this step relies on: 1 (the Troll's routine at 8 AP), 2 (both nests at threat 5 on the map; the Spider Nest's threat-4 cell in the simulator only), 3 (the spider's Web is the area ability `spider_web`), 11 (the open numbers are first values, to tune here), 12 (the new nests do not spawn), 13 (the hero spells' policy rules unchanged), 15 (versions).

## 3. Dependencies and what this step relies on

All of steps 01 to 08 are done when this step starts. Steps 06 and 08 are hard prerequisites.

**From step 01:** the baseline guard (Source beaten of 500, days, battles, heroes dead, the per-threat win table, the level lines) and the Troll Lair cells at threats 4 and 5, in index.md and step 01's record.

**From step 04 (C4, unchanged):**

| Id | Name | Verb | AP | Recharge | Content |
| --- | --- | --- | --- | --- | --- |
| `troll_claws` | Claws | claws | 8 | 0 | strikes: Claw (verb "claws", 1d4+2), Claw (verb "claws", 1d4+2) |
| `spider_bite` | Bite | bites | 4 | 1 | strikes: Bite (verb "bites", 1d6+2), Venom Bite (verb "bites", 1d6+2, lays Poisoned 3 turns) |

- `CombatantStats` has `abilities?: readonly AbilityId[]` and `abilityDamageBonus?: number`; `foeAtLevel` adds `floor(above / FOE_DAMAGE_LEVEL_STEP)` to `abilityDamageBonus` for a block with `abilities`.
- Recharge (correction 10): use with `recharge` N ≥ 1 sets the counter to N; it falls by 1 as the unit's side's turn begins, after ticks and regeneration; usable at 0. Recharge 0 limits nothing but AP.
- The yardstick test counts a routine: mean damage a turn is the better of the weapon's turn and the routine's turn (the sum of the strikes' means with `abilityDamageBonus`, times `floor(actionPoints / apCost)`, at most 1 when `recharge` ≥ 1).
- `LOG_SCHEMA_VERSION` 20, `SAVE_VERSION` 14 at that step.

**From step 05 (C4, C5, unchanged):**

| Id | Name | Verb | AP | Recharge | Content |
| --- | --- | --- | --- | --- | --- |
| `spider_web` | Web | spins a web | 4 | 3 | area: burst, range 4, radius 1, no damage, lays Webbed 2 turns, `halfOnMiss: false` |
| `fire_spit` | Fire Spit | spits fire | 4 | 2 | area: cone, range 2, 3d6, fire, lays Seared 1 turn, `halfOnMiss: true` |

- An area is rolled with the unit's effective `toHit` against each touched unit's armour class, ignoring resistance; a miss with `halfOnMiss` deals half the dice rounded down; `warded` applies after; `AbilityEvent` logs it.
- The simulator's summary prints area attacks used a battle (`avgPlayerAreaAttacks`, `avgEnemyAreaAttacks`). `LOG_SCHEMA_VERSION` 21.

**The policy (C6, unchanged):** an area ability with damage is used when its net harm (foes touched less its own side) is above 0 and above the best strike's; a routine beats a plain attack on a tie; a status-only area (Web) is used when nothing else was chosen and it touches a foe not already Webbed and none of its own side.

**From step 08 (C7, unchanged):**

| Block | HP | AC | To hit | Crit | Damage | Weapon | Attack AP | Range | AP | Resistance | Wards | Abilities |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Giant Spider | 20 | 25 | 80 | 5 | 1d6+2 | Fangs | 5 | 1 | 8 | 1 | — | `spider_bite`, `spider_web` |
| Salamander | 26 | 30 | 85 | 5 | 1d8+2 | Claws | 5 | 1 | 8 | 2 | fire 99 | `fire_spit` |

- `FOE_NATIVE_LEVEL`: `giant_spider` 4, `salamander` 5. `FOE_XP`: `giant_spider` 100, `salamander` 120.

| Encounter | Band | Counts | Slots in order (id, kind, name, position) |
| --- | --- | --- | --- |
| `spider_nest` | 4–5 | [2, 3] | `spider` giant_spider Giant Spider (8, 4); `sneak` kobold Kobold Sneak (9, 2); `spider2` giant_spider Giant Spider (8, 6) |
| `salamander_pool` | 5–5 | [3] | `salamander` salamander Salamander (8, 4); `kobold` kobold Kobold (8, 2); `kobold2` kobold Kobold (8, 6) |

| Was | Becomes | Position | Encounter | Threat |
| --- | --- | --- | --- | --- |
| `troll_den` 'Troll Den' | `salamander_pool` 'Salamander Pool' | (54, 28) | `salamander_pool` | 5 |
| `goblin_pillagers` 'Goblin Pillagers' | `spider_nest` 'Spider Nest' | (57, 10) | `spider_nest` | 5 |

- `SPAWN_KINDS` is unchanged. `SAVE_VERSION` is 15.

**From step 06 (C8, unchanged):** `foeInfoLines(unit: UnitSnapshot): string[]` in `src/scenes/foeInfo.ts`; `BattleScene` shows those lines beside an enemy unit while the pointer is over its hex, and its probe has `foeInfo: string[]`. Routines play as successive attacks; an `AbilityEvent` flashes its hexes and lands each outcome.

**From step 07:** the atlas sprites `giant_spider` and `salamander`, with `idle` and `walk`.

**Environment:**
- `make test` (podman, Node 26) is the gate before the commit. `npm run -s typecheck` and `npx vitest run --project domain` run locally for quick checks.
- The simulator runs only in podman: `make -s simulate ARGS="..."`. Never run two at once (they build the same image and the loser prints nothing); loop them one after another from a script in the scratchpad. Logs go under `logs/` (gitignored); a 500-campaign run takes about a minute and writes about 70 MB. Delete the logs this step writes.
- `npm run manual:screenshots` retakes the manual's screenshots (`e2e/manual.shots.ts`, `vitest.manual.config.ts`); it needs Playwright's Chromium, which the podman image carries (stage 1 ran it in the podman image).

## 4. Scope and guidance

### 4.1 Measure

Run each from seed 1, one at a time:

1. **The guard:** `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`. Record Source beaten of 500, how the campaigns ended, days, battles, heroes dead a campaign, the per-threat win table, the level lines, and the area attacks line. Compare with step 01's and step 04's figures, and note how the Salamander Pool and the Spider Nest fared (break the log down by location with a scratch script if the figure moved, as stage 1 did).
2. **The nest cells:**
   - `make -s simulate ARGS="--encounter spider_nest --threat 4 --party-level 4 --battles 500 --seed 1"`
   - `make -s simulate ARGS="--encounter spider_nest --threat 5 --party-level 5 --battles 500 --seed 1"`
   - `make -s simulate ARGS="--encounter salamander_pool --threat 5 --party-level 5 --battles 500 --seed 1"`

   Record wins of 500, average rounds, enemy area attacks used a battle, and the enemy's damage dealt.
3. **The Troll cells:** `--encounter troll_lair --threat 4 --party-level 4` and `--threat 5 --party-level 5`, 500 battles each, against step 01's.
4. **For comparison:** `--encounter goblin_raid --threat 5 --party-level 5` and `--encounter bandit_camp --threat 5 --party-level 5`, to put the new nests in context in the notes.

### 4.2 Tune (only if needed)

If a nest cell is outside about 60% to 95%, use these levers in this order, re-measuring the cell after each change:

1. **Recharge and damage first** (the design: "Tune recharge and damage first"):
   - `fire_spit`: its dice (3d6) and recharge (2). Keep the recharge at 2 or more (§7: half on a miss makes breath reliable).
   - `spider_bite`: its strikes' dice and its AP cost or recharge; `spider_web`: its recharge (3).
2. **Then the counts:** `spider_nest` `[2, 3]` (length 2, matching the band 4–5) and `salamander_pool` `[3]` (length 1), in `src/game/encounters.ts`.
3. **Then the stat blocks or `FOE_XP`**, only with a reason recorded for each change: `GIANT_SPIDER_STATS` and `SALAMANDER_STATS` in `src/combat/combat.ts` (hit points, armour class, to hit, attack AP), and `FOE_XP` (priced against the yardstick: an even foe for a hero of its level is worth `EVEN_FOE_XP_PER_LEVEL`, 100). A stat change may move a kind in or out of the yardstick: keep the yardstick test's named exceptions (`encounters.test.ts`) in step, each with a reason.

Do not change the Troll's numbers unless the Troll cells moved beyond noise; if they did, record the figures and try the routine's AP or the Troll's attack AP so that each turn's expected damage is today's (correction 1), and note it.

Re-run the guard after any tuning, since both nests are on the map. Update the tests that pin a tuned number so `make test` stays green. If a tuned value no longer matches a contract in index.md (C4, C7), amend the contract there, marked "amended at step 09", and add a line to the corrections if it changes the design's intent.

If no lever brings a cell into range, record the figures and the attempts, leave the cell as it is, and leave a note for the user.

### 4.3 Document

- **`CLAUDE.md`** (search it first for every name the stage renamed or removed, such as `areaHexes`):
  - **`src/grid/hex.ts` bullet:** `areaOf` and `AreaShape` (burst, cone, line).
  - **`src/combat/` bullet:** `ELEMENTS`, wards and `warded`; `abilities.ts` (`ABILITIES`: routines of strikes and area attacks, recharge); monster spells (`MONSTER_SPELL_IDS`, never in `SPELL_IDS` or the spell tree), Cursed and Webbed; `abilityDamageBonus` in `foeAtLevel`; the yardstick test counting routines.
  - **`battleEngine.ts` bullet:** the `ability` action, `AbilityEvent`, `recharging` in the snapshot, `areaTouches`.
  - **`policies.ts` bullet:** the policy's new order and rules (C6).
  - **`encounters.ts` bullet and the rules of scaling:** the Giant Spider (native 4) and the Salamander (native 5), the Spider Nest and the Salamander Pool, their bands and counts, the two map places that replaced the Troll Den and the Goblin Pillagers, that they do not spawn, the cells, and the guard figure appended to the history in the paragraph's existing style (what changed and what it did), with step 01's baseline and the reason for any move beyond about 5 points.
  - **The rules of the battle system and of casting:** routines and retargeting, area attacks (half on a miss, resistance ignored), recharge, elements and wards (statuses are laid whatever a ward stops), shaped spell areas.
  - **Scene layer:** `foeInfo.ts` in the helper list, and the battle screen's foe info panel; the `Troll` sentence ("two claws a turn") as the routine now reads.
  - **`LOG_SCHEMA_VERSION`** is 21 and **`SAVE_VERSION`** 15 wherever CLAUDE.md names a number.
  - The simulator paragraph: the area attacks summary line.
  - Earlier steps updated the lines their own changes made wrong; check each and fix what is still stale.
- **`docs/manual/README.md`:**
  - **Monsters** (§3): the Spider Nest and the Salamander Pool, far to the east; the Giant Spider (webs from range, two bites, the second poisoning) and the Salamander (a cone of fire every other turn that burns its own side too, half on a miss; fire does nothing to it).
  - **Battle** (§5): monsters' special attacks (routines, areas and their recharge); hovering a foe shows its abilities and wards.
  - **Magic** (§6) and **Lasting effects:** elements and wards; Webbed and Cursed, where a monster lays them.
  - The Troll's two claws as one action, wherever the manual describes it.
  - Adjust any wording the stage made wrong.
- **Screenshots:** the battle screen gained the foe info panel and the map lost two places, so retake all of them with `npm run manual:screenshots` (in the podman image). Add one for a new nest to `e2e/manual.shots.ts`, after the bandits' (`it('a battle with bandits', …)`), for example `it('a battle at the Salamander Pool', …)` with the debug console's `xp 2000 all` then `fight salamander_pool 5`, waiting for the player's control, hovering the Salamander so the panel shows, and `shot(game, 'battle-salamander')`. Reference it from the manual with a caption. Look at each image against its caption.
- **`docs/designs/long-campaign/stage-02-special-attacks-and-elements.md`:** set its status line to done (with a link to the notes), and append an `## Implementation notes` section with:
  - the commits of steps 01 to 09;
  - the guard: step 01's baseline, step 04's, and the figure after step 08 and any tuning;
  - the nest, Troll, Goblin Raid and Bandit Camp cells;
  - any tuning, with its effect;
  - the plan's corrections (from the index), in brief;
  - what the play-script walk found, or the steps left for the user.
- **`docs/designs/long-campaign/index.md`:** mark stage 2 done in the stages table, as stage 1's row does ("done; see its implementation notes", with the guard figure), and link the notes.
- **Not this step's:** `docs/features/long-campaign-stage-02.md` belongs to the orchestrator; do not edit it.

### 4.4 Walk the play script

Run the game with `make dev` and walk the design's play script, adjusted for correction 2 (the map's nests are at threat 5) and correction 3 (the spider's Web is the ability `spider_web`):

1. Start a new game with the ready-made party. In the debug console (`~`), run `xp 2000 all`, then `fight salamander_pool 5`. Bunch the party and watch the spit hit several units and burn a kobold. Spread out and watch the policy aim for the most heroes. Cast Flame Arrow at the Salamander and see "warded" in the log. Hover the Salamander: "Fire Spit: ready" or "recharging, N rounds", and "Wards: fire 99".
2. Run `fight spider_nest 4`. See Web land on a hero from range, and that hero's AP shrink next turn. See the bite routine strike twice ("bites"), the second poisoning, and retarget when its first target drops.
3. Fight a Troll Lair (`fight troll_lair 4`). See "Claw, Claw" as one action in the log ("Troll claws …" twice in a row).
4. Save mid-battle at a location with a recharging ability (attack the Salamander Pool on the map, or a battle the game saves), reload from the menu, and see the ability still recharging in the hover panel.

Also check §7's first risk in play: how often the Salamander's spit catches its own kobolds.

If the game cannot be driven from this session (no browser), list each unwalked step in the execution record and the stage's implementation notes, for the user to walk.

### Out of scope

- Any code change other than the levers in §4.2, the tests that pin them, and the new screenshot test in `e2e/manual.shots.ts`.
- Edits to files other than:
  - `src/combat/abilities.ts`, `src/combat/combat.ts` (the two new stat blocks; the Troll only as §4.2 says), `src/game/encounters.ts` (counts, `FOE_XP`) and the tests pinning those numbers;
  - `e2e/manual.shots.ts` and `docs/manual/images/`;
  - `CLAUDE.md`;
  - `docs/manual/README.md`;
  - the stage design and the stages index;
  - this plan's `index.md` and this file.

## 5. Verification

- **The guard:** recorded, and within about 5 points of step 01's figure, or the move explained in CLAUDE.md and the notes.
- **The cells:** the three nest cells within about 60% to 95%, or the shortfall and the tuning tried recorded; the Troll cells within noise of step 01's.
- **Tests:** `make test` passes after the last change; `npm run -s typecheck` is clean. `make test-browser ARGS="-t <name>"` for the battle tests if anything in a scene moved.
- **Sprites:** `npm run sprites:check` is up to date; neither new kind falls back to a placeholder.
- **Docs:** CLAUDE.md, the manual and its screenshots, the stage's implementation notes and the stages index updated as in §4.3.
- **The play script:** walked, or its unwalked steps listed.

## 6. Completion criteria

- [ ] The guard, the three nest cells, the two Troll cells and the comparison cells have been run, with their figures in the stage's implementation notes.
- [ ] Any tuning is recorded with its effect, the guard re-run after it, and any changed contract amended in index.md.
- [ ] CLAUDE.md, `docs/manual/README.md` (with retaken screenshots and the new nest's), the stage design's implementation notes and status line, and `docs/designs/long-campaign/index.md` are updated.
- [ ] The play script is walked, or its unwalked steps are listed for the user.
- [ ] `make test` passes. One commit for the step (the screenshots may go in a commit of their own) on the current branch, not pushed, its message ending with the repo's `Co-Authored-By` attribution line.
- [ ] Step 09's row in [index.md](index.md) is set to `done` with the commit, the overall completion checklist is ticked where met, and the execution record below is filled.

## Execution record

Done on the tree at `95fe30b`. Each simulator run was made in podman, one at a time, from seed 1 with 500 battles. The logs (`logs/s09-*`) were deleted afterwards. Full figures, tables and reasoning are in the stage design's [implementation notes](../../designs/long-campaign/stage-02-special-attacks-and-elements.md#implementation-notes).

**Runs:**
- **Cells:**
  - Spider Nest t4/L4: 500 (3.67 rounds, enemy damage 16.2, 1.01 areas).
  - Spider Nest t5/L5: 451 (6.94; 60.4; 3.02).
  - Salamander Pool t5/L5: 470 (8.37; 69.6; 3.52).
  - Troll Lair t4/L4: 222 (step 01: 218). Troll Lair t5/L5: 0 (step 01: 0).
  - Goblin Raid t5/L5: 357. Bandit Camp t5/L5: 470. Spider Nest t4 with a party of level 3: 499.
- **Tuning tried** (Spider Nest t4 / t5):
  - `spider_web` recharge 2: 500 / 437.
  - Bites 1d8+2: 500 / 423.
  - Counts [3, 3]: 479 at t4 (439 with a party of level 3).
  - Spider HP 26: 500 / 377. HP 32: 500 / 269.
  - Every change was reverted.
- **Guard:** 248 of 500, identical to step 08's (274 days, 18.7 battles, 1.7 heroes dead; threat 5 1411 of 1568). For the location breakdown, the step 01 tree (`0804545`) was re-run from a temporary worktree: again 243. The Troll Den lost 32 of 100 there, and the Salamander Pool loses 0 of 100 here. 405 parties reach the Source rather than 373.

**Decisions:**
- **No tuning kept.** Both map cells (t5) sit in the bandits' fair range.
- **Spider Nest threat 4** (500/500, not on the map): left as it is. Only a third foe moves it, which breaks the band-growth invariant the encounter tests hold. This is for the user: make the nest threat-5-only, or take [3, 3] and relax that test for it.
- **Guard +5:** explained in CLAUDE.md's rules of scaling and the stage notes, not retuned.

**Carried items:**
- **Drain Life overkill:** capped at the hit points lost. A failing test came first, then the fix in `battleEngine.ts`. C2 was amended. Summary-neutral, as no kind casts it.
- **Mages vs the Salamander:** checked in the pool's cell.
  - `strikeCast` avoids Flame Arrow on it (never cast at it).
  - The heroes' Fireball still counts it as a foe: 1484 Fireballs touched it, and in 475 the only hits were on it, for 0.
  - Recorded, not fixed: the fix changes the pool's battles, and correction 13 keeps the hero spells' area rule.
- **Spider yardstick reason:** reworded (its routine is 11 a turn, above the band's 8.6).
- **C7 slot rows:** amended with Brood Spider, Kobold Stoker and Kobold Warden, marked step 08.
- **`docs/designs/magic.md:212`:** left as historical. Its loot table also still lists the Kobold Skulkers and Goblin Outriders, which stage 1 replaced; it describes the map as that design was written.
- **Stale `areaHexes`:** the reference line marked as written before stage 2.
- **Fumble on a half area:** test added; it passes as written, pinning half damage on a fumble.
- **Cone sweep:** seen on screen (the cone's four hexes flash orange, and the units in it pulse). One flash, but it reads clearly, so it was left.

**Play script:** walked in headless Chromium with a scratch in-browser script (not committed), at speed 1 to 2 with screenshots each few frames. See the notes.
- Not seen: a retarget (no case in the browser, and none in the simulator's 416 first-strike kills, as no other foe was in reach), and the spit's aim with the party spread out.

**Docs:**
- CLAUDE.md: the drain rule, the rules of scaling (cells, tuning tried, the guard's history), and the Fireball note.
- Manual: Monsters (Spider Nest, Salamander Pool), Battle (special attacks, the hover panel), Magic (elements and wards), Lasting effects (Cursed, Webbed).
- Screenshots retaken in podman (`npm run manual:screenshots`), with a new `battle-salamander` after the bandits'.
- Stage design status and notes; stages index row and guard line.

**Checks:**
- `make test`: 71 files, 984 tests passed.
- `npm run -s typecheck`: clean.
- `npm run -s sprites:check`: up to date (74 sprites).
- Manual screenshots: 6 of 6.
- No scene code changed, so no in-browser test was rerun beyond the walk and the shots.

**Follow-up after verification** (the user's decisions of 2026-11-01, and the QA and review fixes):
1. **Spider Nest threat 5 only:** band 5–5, count [3] (`c8c23b5`); tests first. Its threat-5 cell is unchanged at 451/500. `--threat 4` is now fought as 5: 362/500 for a level-4 party.
2. **Fireball rule** (`5c205f3`):
   - `areaCast` counts only foes whose ward lets some of a damaging spell's average through; a test covers a ward of 99 against a ward of 5. This amends correction 13.
   - The Salamander Pool went from 470 to **493**/500 (8.4 to 6.9 rounds). The mage casts no Fireball there now, and 2695 Flame Arrows at the Kobolds.
   - The guard went from 248 to **249**/500. Threat 5 was won 1417 of 1573.
   - The pool cell is now above 95%; it was not retuned, which is for the user.
3. **Recharge wording** (`7539056`): "ready next turn" for 1, and "ready in N turns" for more, counted in the foe's turns. Tests added.
4. and 5. **Manual:** "some" special attacks recharge; a web "can catch" everyone in its area.
6. **Web log:** not a bug.
   - In 1510 simulated webs, every hit laid Webbed and logged "is webbed", and every miss laid nothing.
   - The webbed state seen in round 4 was left by an earlier web, as Webbed lasts 2 of the hero's turns.
   - A test pins a second web on an already webbed unit (`13ddea9`).
7. **Panel title:** the foe's name, as a gold title line (`7539056`). `foeInfoLines` returns it first, and C8 is amended.
8. **Brackets:** "(CRITICAL, warded N)" in one bracket (`13ddea9`). The "(warded N) (half)" of a half miss was left, since a test pins it.
9. **Descriptions** (`7539056`):
   - Generated from the ability data and `STATUSES`, with the foe's `abilityDamageBonus` added to the dice: the snapshot has its stats.
   - The panel draws each line, the descriptions dimmer and indented, and scales its text back from the board's scale.
   - It was looked at by eye at 840×560 for the Giant Spider, the Brood Spider and the Salamander.
   - Tests cover each of today's four abilities and the level bonus. C8 is amended.

**Checks:**
- `make test`: 71 files, 993 tests.
- `make test-browser ARGS="e2e/debug.test.ts"`: 4/4.
- `make test-browser ARGS="e2e/battle.test.ts"`: 11/11.
- Manual screenshots: 6/6. Only `battle-salamander.png` was kept as changed; two others differed by noise and were restored.

**Salamander Pool retune** (user, 2026-11-01; target 445 to 470 of 500):
- **Runs** (pool cell, seed 1):
  - 4d6: 471. **4d6+2: 456 (kept).** 4d6+1: 468. 5d6: 425.
  - Cone range 3: 492. Salamander HP 36: 485. 4d6 with HP 32: 453.
  - Every variant was reverted before the next.
- **Kept:** `fire_spit` damage 4d6+2. Recharge 2 is unchanged.
- **Tests:** the expectations that pinned 3d6 were updated (engine area tests, `abilities.test.ts`, the policy's ward test now uses a 4d6+4 blow, the panel's tests).
- **Docs:** C4 amended.
- **Guard:** 248 of 500 (threat 5 1416/1573); the pool is 100/100 in the campaign.
- **Checks:** `make test` passed; `battle-salamander.png` retaken.
