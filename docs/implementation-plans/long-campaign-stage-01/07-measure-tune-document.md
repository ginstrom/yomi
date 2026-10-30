# Step 07: Measure, tune and document

Task: measure the stage in the simulator, tune the Bandit Camp if needed, bring the docs up to date, and walk the play script.

- **Plan:** [index.md](index.md)
- **Source design:** [`docs/designs/long-campaign/stage-01-foe-foundations-and-bandits.md`](../../designs/long-campaign/stage-01-foe-foundations-and-bandits.md) (§6 Verification, §7 Risks, "Done when")

## 1. Objective

Close stage 1:
- confirm the early game is within the guard;
- confirm bandit camps are hard but winnable at their threats;
- tune the camp's counts, then its gear grade, if they are not;
- record every figure;
- update CLAUDE.md, the manual and the stage's design;
- walk the design's play script in the game.

## 2. Requirements and context

- **The early-game guard.** The baseline is **320 of 500** campaigns beating the Source from seed 1 (CLAUDE.md's rules of scaling, before this stage). A move of more than about 5 points (outside roughly 295 to 345) must be explained in CLAUDE.md and the stage notes, or retuned away. Step 01 left the summary identical. Step 03 left it identical, since the camp is not on the map. Step 04 put bandit camps on the map and added the Bandit Gang spawn, so any move comes from step 04.
- **The bandit cells.** At threats 3, 4 and 5, a party of the threat's level should win **most but not all** battles. Treat roughly 60% to 95% as the target, and record the actual figures.
  - **Below about 60%,** the bandits are a wall.
  - **Above about 95%,** they are trivial.
- **The levers, in this order:**
  1. the Bandit Camp's `counts`;
  2. `banditGrade`.

  Record each change and its measured effect. Do not change bandit drafts, roles, gear tables or `FOE_XP` in this step: those are design decisions. If neither lever brings a cell into range, record the figures and the attempt, and leave the cell as it is, with a note for the user.
- **The design's risks** (§7):
  - Bandits as even foes may be much harder than goblins at the same threat.
  - The `fight` command must not leave the world inconsistent.

## 3. Dependencies and what this step relies on

All of these are expected to be done when this step starts. Steps 03, 04, 05 and 06 are hard prerequisites. Step 01's contracts are used through them.

**From step 01 (C3, unchanged):**
- Each encounter has a `ThreatBand { min, max }` in `ENCOUNTER_BANDS` and `counts: readonly number[]`, indexed by `threat - band.min`, of length `band.max - band.min + 1`.
- Its level is `clamp(Math.floor(threat), band.min, band.max)`.
- Its foes are the slots with `fromThreat` (default 1) ≤ the level, cut to `counts[level - band.min]`.
- The five existing encounters have band `{ min: 1, max: 5 }` and counts `[2, 3, 3, 3, 4]`.

**From step 03 (C5, C6, unchanged):**
- `src/game/bandits.ts`:
  - `banditStats(role, level, grade)`, built by hero rules;
  - `banditGrade(threat: number): Grade`, which is 1 below threat 5 and 2 (Fine) from 5;
  - `BANDIT_ROLE`.
- `banditCamp(party, threat = 3)`, registered as `ENCOUNTERS.bandit_camp`, with band `{ min: 3, max: 7 }` and counts `[3, 3, 4, 4, 4]`. Its slots, in order:

  | Id | Kind | Name | Position | From threat |
  | --- | --- | --- | --- | --- |
  | `captain` | `bandit_captain` | Bandit Captain | (8, 4) | — |
  | `mage` | `bandit_mage` | Hedge-Mage | (9, 4) | 4 |
  | `brute` | `bandit_brute` | Bandit Brute | (8, 2) | — |
  | `archer` | `bandit_archer` | Bandit Archer | (9, 6) | — |
  | `cutthroat` | `bandit_cutthroat` | Cutthroat | (8, 6) | — |

  So threat 3 fields the Captain, Brute and Archer; threat 4 the Captain, Hedge-Mage and Brute; and threat 5 the Captain, Hedge-Mage, Brute and Archer.
- `FOE_XP` is 100 for each bandit kind.

**From step 04 (C7, unchanged):**
- `kobold_skulkers` became `bandit_camp`, 'Bandit Camp', at (30, 22), threat 3.
- `goblin_outriders` became `bandit_hideout`, 'Bandit Hideout', at (47, 13), threat 4.
- `SPAWN_KINDS` gained `{ encounter: 'bandit_camp', name: 'Bandit Gang' }`. Spawns draw only kinds whose band holds `threatAt(at)`.
- `SAVE_VERSION` is 12.

**From step 05 (C8, unchanged):**
- The debug console's `fight <encounter> [threat]` runs on the world map only. Its threat defaults to `threatAt(world.party)`.
- It starts `'Battle'` with `{ game, encounter, threat }`.
- The battle rewards experience, but takes no loot, clears no location, leaves the blight alone, and is never saved mid-battle.

**From step 06 (C9, unchanged):**
- `--ready-level N` defaults to `SOURCE_READY_LEVEL` (7) and is refused without `--campaign`.
- `CampaignRecord` gains `finalLevels`, `deathsAtLevel` and `battlesToLevel` (for 5, 10, 15 and 20).
- The summary prints:
  - the average lowest and highest final level;
  - the levels heroes died at, with counts;
  - the average battles to reach each level, and how many campaigns did.

**Environment:**
- The simulator runs only in podman, through `make -s simulate ARGS="..."`. Local Node 22 cannot run `scripts/simulate.ts`.
- Never run two `make simulate` commands at once: they build the same image, and one prints nothing. Run them one after another, from a script in the scratchpad if looping.
- Logs go under `logs/` (gitignored). A 500-campaign run takes about a minute.

## 4. Scope and guidance

### 4.1 Measure

1. **The guard:** `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`. Record:
   - Source beaten, of 500;
   - average days and battles;
   - heroes dead per campaign;
   - the per-threat win table;
   - the new level lines from step 06.
2. **The cells**, one at a time: `make -s simulate ARGS="--encounter bandit_camp --threat T --party-level T --battles 500 --seed 1"` for T = 3, 4 and 5. Record the wins of 500 and the average rounds for each.
3. **For comparison,** the same cells for `goblin_raid` at T = 3, 4 and 5. They put the bandits' difficulty in context for the notes.

### 4.2 Tune (only if needed)

- If a bandit cell is outside its range, change `counts` in the Bandit Camp's definition in `src/game/encounters.ts` first:
  - Keep the length at 5, matching the band 3–7.
  - Keep the entries at threats 6 and 7 no lower than the threat-5 entry.
  - Re-measure the cell after each change.
- Then try `banditGrade` in `src/game/bandits.ts`, for example Fine from threat 4, or plain at 5.
- Re-run the guard after any tuning, because the map's camps use the same encounter.
- Update the tests that pin the changed numbers (`encounters.test.ts`, `bandits.test.ts`), so `make test` stays green. If the tuned counts no longer match C6 as written, record the final counts in the index's corrections list (an edit to `index.md` is allowed for that and for status).

### 4.3 Document

- **`CLAUDE.md`:**
  - **Domain layer, `encounters.ts` bullet:**
    - unit kinds split into monsters and bandits;
    - `FOE_NATIVE_LEVEL` and `foeStats`;
    - `ENCOUNTER_BANDS` with per-encounter counts and clamping;
    - `encountersFor`;
    - `MAX_THREAT` as today's map cap.
  - **A new `bandits.ts` bullet:** bandits built by hero rules, the roles and their gear, `banditGrade`.
  - **`combat.ts` bullet:** `foeAtLevel`'s native parameter and its hit-point rule; `foeYardstick` and its test.
  - **The rules of scaling paragraph:**
    - native levels and bands;
    - the Bandit Camp's composition by threat;
    - the two map locations and the Bandit Gang spawn;
    - the newly measured guard figure, appended to the history in the paragraph's existing style (what changed and what it did);
    - the bandit cells.
  - **The simulator flags paragraphs:** `--ready-level` (campaign only, default 7) and the new summary lines.
  - **The debug console's command list,** wherever CLAUDE.md describes it: `fight <encounter> [threat]`.
- **`docs/manual/README.md`:** bandits as a new foe at the Bandit Camp and Bandit Hideout, and in Bandit Gangs. They are humans built like heroes, armed and armoured, and casting at a camp of threat 4 or more. Adjust any threat wording the change makes wrong. Retake the manual's screenshots (`npm run manual:screenshots`) only if a screen it shows has changed, which is not expected.
- **`docs/designs/long-campaign/stage-01-foe-foundations-and-bandits.md`:** append an `## Implementation notes` section with:
  - the commits of steps 01 to 07;
  - the guard figure before and after;
  - the bandit and goblin cells;
  - any tuning, with its effect;
  - the plan's five corrections (from the index), in brief;
  - what the play-script walk found.
- **`docs/designs/long-campaign/index.md`:** mark stage 1 done in the stages table (for example, "done" after the title, or a status column if one is added), and link the implementation notes.

### 4.4 Walk the play script

Run the game with `make dev` and walk the design's play script, adjusted for correction 2:

1. Start a new game with the ready-made party. In the debug console (`~`), run `xp 2000 all`, then `fight bandit_camp 3`.

   Expect **three** bandits (Bandit Captain, Bandit Brute, Bandit Archer) with their own sprites, and their weapons in the hover info. Win, and see the experience.
2. Run `fight bandit_camp 5`. Expect:
   - the Hedge-Mage casting Shield and Magic Arrow;
   - the Captain holding the line;
   - the Archer staying back.
3. Play normally to the Bandit Camp location at (30, 22). Attack and win. See the location cleared and the blight cleansed, as for any nest.
4. Run `days 300`, then `locations all`. Any spawned Bandit Gang stands at threat 3 or more.

Also check the design's §7 risk: after a `fight` battle the world map is unchanged. No location is cleared and no blight is cleansed.

If the game cannot be driven from this session (no browser), list each unwalked play-script step in the completion note and in the implementation notes, for the user to walk.

### Out of scope

- Any code change other than the two tuning levers and the tests that pin them.
- Edits to files other than:
  - `src/game/encounters.ts` (counts only);
  - `src/game/bandits.ts` (`banditGrade` only);
  - the tests pinning those numbers;
  - `CLAUDE.md`;
  - `docs/manual/README.md` (and its images, only if retaken);
  - the stage design;
  - the stages index;
  - this plan's `index.md` and this file.

## 5. Verification

- **The guard figure:** recorded, and within about 5 points of 320, or explained in CLAUDE.md and the notes.
- **The bandit cells at T = 3, 4 and 5:** recorded. Each is within about 60% to 95%, or the shortfall and the tuning tried are recorded.
- **Tests:** `make test` passes after the last change. `npm run -s typecheck` is clean.
- **Docs:** CLAUDE.md, the manual, the stage's implementation notes and the stages index are updated as in §4.3.
- **The play script:** walked, or its unwalked steps are listed.

## 6. Completion criteria

- [x] The guard and all six cells (bandits and goblins at 3, 4 and 5) have been run, with their figures in the stage's implementation notes.
- [x] Any tuning is recorded with its effect, and the guard has been re-run after it.
- [x] CLAUDE.md, `docs/manual/README.md`, the stage design's implementation notes and `docs/designs/long-campaign/index.md` are updated.
- [x] The play script is walked, or its unwalked steps are listed for the user.
- [x] `make test` passes. One commit for the step is made on the current branch, not pushed, its message ending with the repo's `Co-Authored-By` attribution line.
- [x] Step 07's row in [index.md](index.md) is set to `done`, the overall completion checklist is ticked where met, and a completion note is added below.

## Completion note

- **Status:** done. Commit `c4ce6f8` ("Step 07: measure, tune and document").
- **Changed:**
  - `src/game/encounters.ts`: the Bandit Camp's counts `[3, 3, 4, 4, 4]` → `[2, 2, 2, 4, 4]`, and the doc comment above it. `banditGrade` is unchanged (plain below 5, Fine from 5).
  - `src/game/encounters.test.ts`: the three tests pinning the counts, the bandits fielded at each threat and the experience (600, 800, 1000 at threats 3 to 5).
  - `CLAUDE.md`: the `combat/` bullet (`foeAtLevel`'s native level and hit-point rule, `foeYardstick` and its test), the `encounters.ts` bullet (monster and bandit kinds, `FOE_NATIVE_LEVEL`, `foeStats`, `ENCOUNTER_BANDS` and `ENCOUNTER_COUNTS` with clamping, `encountersFor`, `MAX_THREAT`), a new `bandits.ts` bullet, and the rules of scaling (the camp's counts and composition by threat, the cells, and the guard's history). The simulator paragraphs (`--ready-level`, the level lines) and the debug console's `fight` were already current from steps 05 and 06.
  - `docs/manual/README.md`: a **Bandits** paragraph under Monsters, and spawns "bandits from threat 3". No screenshot changed.
  - The stage design: an `## Implementation notes` section with every figure below. The stages index marks stage 1 done, naming the open guard and play script.
  - `index.md`: correction 2 and C6 record the tuned counts; step 07's row and the overall checklist.
- **Measurements** (seed 1, 500 each, run one after another):
  - Cells, party wins of 500 and average rounds. Bandit Camp at the first counts: threat 3 195 (12.8), 4 158 (12.6), 5 3 (8.2). Tuned `[2, 2, 2, ...]`: 444 (10.0), 473 (9.5), 434 (10.3). Goblin Raid: 500 (7.0), 500 (8.7), 358 (13.1).
  - Tuning tried and not kept: `[2, 2, 3, ...]` at threat 5 won 59 (11.8%); the same with `banditGrade` Fine only from 6 won 173 (34.6%).
  - Guard, `--campaign --ready-level 7 --battles 500 --seed 1`, tuned: Beat the Source 237 of 500 (47.4%), party fell 263, encampment never lost; 279 days, 18.9 battles, 26.1 spawns; 1.8 heroes dead, guild hall 2.4, 2.2 recruits; won by threat 1011/1011, 1780/1796, 2012/2066, 2981/3004, 1387/1557; final levels lowest 6.7, highest 7.4; deaths at level 2 (48), 3 (178), 4 (33), 5 (102), 6 (27), 7 (271), 8 (219), 9 (24), 10 (1); level 5 in 6.8 battles (429 campaigns), 10 in 33.0 (2).
  - For the explanation, the pre-stage baseline was re-run at `70b3075` (a temporary worktree, since removed): 320 of 500, as recorded. Its battle log and the tuned one were broken down by location (losses, and heroes dead in won battles) with a scratch script; the figures are in the stage notes.
- **Judgement of the guard:** 83 campaigns below 320, outside the 5 points; explained in CLAUDE.md and the stage notes rather than retuned, as both levers are spent. The fixed camp at threat 3 is still lost 54 times, the Goblin Reavers 16 more (lone survivors), and bandit fights kill some 270 heroes a run in won battles, so 99 parties reach the Source four strong (62 before), and a party of four almost never wins it (3 of 99). **A decision for the user:** accept the fall as the price of bandits, or move it with a lever outside this step (the bandits' drafts or levels, the threat-3 camp's place on the map, or the Source's battle for a party of four).
- **Also for the user:** with two bandits at threats 3 to 5, the Archer and the Cutthroat never take the field on today's map; the design's play script expected four (correction 2: three) bandits at threat 3 and the Archer at 5. Putting the Archer in the Brute's slot would show it, but that is a change of the slot order (C6), unmeasured here.
- **Checks:** `npx vitest run --project domain` 745 passed; `npm run -s typecheck` clean; `make test` 65 files, 754 tests passed; `make test-browser ARGS="e2e/debug.test.ts"` 3 of 3 passed (the `fight` battle leaves the locations and the blight unchanged, §7's risk).
- **Play script:** not walked (no browser session at `make dev`). Steps 1 to 4, and the §7 check with bandits, are listed for the user in the stage's implementation notes, adjusted for the tuned counts (two bandits at threat 3; the Captain and Hedge-Mage at 5).
- **Not done:** the step 04 reviewer's optional note (`spawn` in `blight.ts` could use `encountersFor`) was left alone: `blight.ts` is outside this step's files.
- **Logs:** every log this step wrote was deleted; the older logs already in `logs/` were left.
