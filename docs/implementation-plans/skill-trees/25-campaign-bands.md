# Step 25: Campaign bands

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R14, AC11; §6 "The foe yardstick"; §7.2 parts 3 and 4) · [Feature record](../../features/skill-trees.md) (guard bands decision)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step judges and moves the balance of the whole campaign: which lever to pull, how far, and when a figure outside its band is the user's to accept rather than the engineer's to force.

## 1. Objective

The three campaign figures, the deaths and the days sit in their bands (design §7.2 part 3), with every cell and the path parity that step 24 settled still holding; or the user has accepted a figure outside its band (AC11). The guard fixture is re-recorded with the final play, the plan's Measurements column "25 final" is filled, and the feature record's Verification section lists the final figures.

## 2. Requirements and context

- **R14:** balance is judged and retuned with the simulator, by the cells and campaign bands of design §7.2; `CLAUDE.md`'s rules of scaling are restated from the runs (the restating itself is step 26's, from this step's figures).
- **AC11 (R14):** the campaign guard and the cells land in the bands of §7.2, or the user has accepted the figure.
- **The campaign bands** (feature record, decided 2026-11-13; design §7.2 part 3, Q5), out of 500 from seed 1:

  | Run | Before the feature (`CLAUDE.md`) | Band |
  | --- | --- | --- |
  | `--campaign --parties 1` | 230 | 215–250 |
  | `--campaign` (default company) | 239 | 220–260 |
  | `--campaign --ready-level 10` | 389 | 370–420 |
  | heroes dead a campaign (one party) | 1.8 | ≤ 2.0 |
  | days a campaign (one party) | 270 | step 01's figure ±10% |

  Step 01's re-measured baseline (index, Measurements) is the reference where it differs from `CLAUDE.md`'s.
- **The loop** (design §7.2 part 4):
  1. Change one lever.
  2. Run the cells it touches (seconds to minutes).
  3. Once the cells sit in band, run the three campaigns.
  4. Log each run: the lever, its value, the figures, and kept or reverted.
- **The levers, in this order** (design §7.2 part 4):
  1. Node numbers: technique bonuses, aura sizes, passive sizes, mana costs, recharges.
  2. Tier levels and depths (`TIERS`).
  3. `MANA_PER_TREE_NODE`.
  4. Node sizes by kind: casters' passives first, if casters lag fighters in parity. The pick rate (`PICK_LEVEL_STEP`, one pick every even level) is fixed by the user's decision (Q1) and is **not** a lever without asking.
  5. Bandit plans and counts.
  6. Foe counts and `FOE_HP_PER_LEVEL`, as `CLAUDE.md` advises, **only if the first five cannot reach the band**.
- **Stop rule:** stop when every cell and campaign figure is in band and parity holds, or after the user accepts a figure outside it. The engineer does not ask the user: when a figure will not come into band by the levers above without breaking a cell or parity, or a lever would need a user decision (the pick rate, a lever 6 change), stop and report the figure, what was tried, and a recommendation (accept, or which lever to pull next). The orchestrator asks the user and replies with the decision.
- **The foe yardstick** (design §6): `fighterGrowth` in `src/combat/combat.ts` is a measured table of the old fighter and stays frozen as a yardstick. If the yardstick test in `src/combat/combat.test.ts` (or the stat-block test in `encounters.test.ts`) fails **only** because the ready-made fighter now grows differently, re-measure the table from the new ready-made fighter and say so in the commit; never retune a monster to fit it.

### Decisions from the index (unchanged)

- **2. The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
- **6. Measurement between stages** records figures and does not tune (feature record; brief). A campaign figure under 150 of 500 in stage 1, 2 or 3 is reported to the orchestrator in the step's record and the report, with the cells that explain it, and not tuned around. Tuning is stage 4's.

### Measurement procedure (copied unchanged from the index)

All from seed 1, 500 battles or campaigns, one run at a time. Put each run's output under `logs/<step>-<name>.jsonl` and its summary in a `.txt` beside it.

```sh
P="PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH"
# campaigns
npm run simulate -- --campaign --battles 500 --seed 1 --parties 1 --out logs/NN-one.jsonl > logs/NN-one.txt
npm run simulate -- --campaign --battles 500 --seed 1 --out logs/NN-company.jsonl > logs/NN-company.txt
npm run simulate -- --campaign --battles 500 --seed 1 --ready-level 10 --out logs/NN-rl10.jsonl > logs/NN-rl10.txt
# cells: --encounter E --threat T --party-level L
npm run simulate -- --battles 500 --seed 1 --encounter bandit_camp --threat 3 --party-level 3 --out logs/NN-bc3.jsonl > logs/NN-bc3.txt
```

| Cell | Encounter, threat, level | Target band (design §7.2) |
| --- | --- | --- |
| GR3 | `goblin_raid` 3, level 3 | ≥ 470 |
| BC3 | `bandit_camp` 3, level 3 | 400–470 |
| BC4 | `bandit_camp` 4, level 4 | 430–490 |
| BC5 | `bandit_camp` 5, level 5 | 420–490 |
| SN5 | `spider_nest` 5, level 5 | 410–480 |
| SP5 | `salamander_pool` 5, level 5 | 410–480 |
| TL5 | `troll_lair` 5, level 5 | report only |
| SG7 | `source_guardians` 5, level 7 | within ±40 of step 01 |
| SG10 | `source_guardians` 5, level 10 | above step 01's |
| F1, F2, F3 | `goblin_raid` 1, 2, 3, level 1 | "nearly all, most, 7 in 10" (step 01's figures) |

| Campaign | Band (feature record) |
| --- | --- |
| `--parties 1` | 215–250 of 500 |
| default company | 220–260 |
| `--ready-level 10` | 370–420 |
| heroes dead a campaign (one party) | ≤ 2.0 |
| days a campaign (one party) | step 01's ±10% |

Each measurement step writes its figures into the **Measurements** table below and its own execution record.

Use `25` for `NN`, and a suffix per attempt (`logs/25-one-a.jsonl`, `-b`, …) so no run overwrites another that the log table cites.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **The simulator.** A 500-campaign run takes about five minutes (`--ready-level 10` longer) and writes some 70 MB. **Run one at a time, never two at once**, each with its own `--out` under `logs/` (gitignored).
- **Determinism.** A battle replays from its seed. A lever changes numbers, never the order of draws: new rolls draw in the order design §5.4 fixes; a passive that rolls nothing draws nothing.
- **A node is data.** A lever on a node is a change to its entry in `PERKS`, `SPELLS` or `ABILITIES` (and its `description`, which must keep telling the truth), not new code.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `.ts` extensions in imports.
- **Commits.** `npm test` passes before each commit, on `skill-trees`, without pushing; never switch branches; no attribution lines. Commit kept levers as you go if that helps the record ("Skill trees step 25: <lever>"), each re-recording the guard (decision 2); the last commit is "Skill trees step 25: campaign bands".
- **Docs.** `CLAUDE.md` stays current: a changed number it states (a node's, `TIERS`, `MANA_PER_TREE_NODE`, a bandit plan, a foe count, `FOE_HP_PER_LEVEL`) is corrected in the same commit. The full restating of the rules of scaling is step 26's; leave it, but do not leave a number there false. The manual's tables of nodes are step 26's too; note every changed node number in the execution record for it.

## 3. Dependencies and prerequisites

- **Step 24 (done first):** every plan within ±50 of its role's best at Bandit Camp threat 4, levels 4 and 8; capstones checked at level 12 against Spider Nest threat 5; the cells in band. Its execution record holds the parity table, the cell figures and every lever it kept. This step starts from those figures and must not undo them.
- **Steps 01, 08, 16, 23** filled the Measurements columns: step 01's baseline is the reference for days, SG7 and SG10 and the fresh-party cells.
- **The parity runs** use step 15's `--plans role=plan,...` flag (C15) and the plans of C5 (`PLAN_IDS`: knight, swordmaster, spellsword, ranger, rogue, rogue_archer, assassin, evoker, evoker_healer, cryomancer, arcanist, healer, paladin, saint, bandit_mage). Parity cells per role (design §7.2 part 2): melee swordmaster, knight, spellsword, assassin, paladin; archery ranger, rogue_archer, assassin; magic evoker, cryomancer, arcanist, healer, saint; each at `bandit_camp` threat 4, levels 4 and 8, target within ±50 of 500 of its role's best.
- **Existing levers' homes:** node numbers in `src/character/perks.ts`, `src/combat/spells.ts`, `src/combat/abilities.ts`; `TIERS` and `MANA_PER_TREE_NODE` in `src/character/trees.ts`; plans in `src/character/progression.ts` (`AUTO_PLANS`); bandit drafts and counts in `src/game/bandits.ts` and `src/game/encounters.ts` (`ENCOUNTER_COUNTS`); `FOE_HP_PER_LEVEL` in `src/combat/combat.ts`.

## 4. Scope and implementation guidance

### 4.1 Start

1. Run the three campaigns on step 24's final code (`25-one-a`, `25-company-a`, `25-rl10-a`). Read deaths and days from the one-party summary.
2. If all five figures are in band, go to 4.4.

### 4.2 The loop

For each figure out of band, pull the earliest lever in the order of §2 that bears on it, one lever at a time:

- Name what the summaries say moves the figure (which threat's battles are lost, which encounter, deaths at which level, days camping or walking home) before choosing the lever, and write it in the log.
- After the change, run the cells it touches (design §7.2 part 1); if a cell leaves its band, revert or adjust before any campaign run.
- **After each kept lever, re-check the cells and the parity cells of step 24 that the lever touches** (a node's path's parity plans at levels 4 and 8; a capstone's level-12 Spider Nest check; a bandit change's BC3, BC4, BC5). A lever that breaks parity beyond ±50 is reverted or paired with a node change that restores it.
- Then the three campaigns. Kept if it moves the figure toward its band without pushing another out; else reverted.
- Days: if days drift beyond ±10%, look first at camping (heal speed, `healBonus`, Mending, Sanctuary) and walking home (recruits after deaths), not at the blight.
- Foe counts and `FOE_HP_PER_LEVEL` (lever 6) only once levers 1 to 5 have been tried and logged as unable to reach the band. Before pulling lever 6, stop and report (§2 stop rule): it changes every encounter, and `CLAUDE.md` records why the counts sit where they do.

### 4.3 Run log

Keep this table in the execution record, one row per run (campaign or cell):

| # | Lever | Value (from → to) | Run(s) | Figures | Kept / reverted | Note |
| --- | --- | --- | --- | --- | --- | --- |

### 4.4 Finish

1. **The yardstick.** Run `npm test`. If `foeYardstick`'s test (or the per-kind stat-block test in `src/game/encounters.test.ts`) fails, find whether it fails only because the ready-made fighter now grows differently. If so, re-measure `fighterGrowth`'s table in `src/combat/combat.ts` from the new ready-made fighter (as its comment says it was measured), update the test's expected ranges, and say so in the commit. If a monster falls outside for any other reason, stop and report.
2. **Guard.** Re-record the refactor guard fixture (`GUARD_RECORDS`, `GUARD_EVENTS_SHA256` in `scripts/simulate.test.ts`) with the final play, and put the final campaign figures in the commit message.
3. **Final runs.** On the committed code, run the three campaigns and every cell of the table once more (`25-*-final`) and record the 500-campaign run time (design §6: it should stay near five minutes).
4. **Index.** Fill the Measurements column "25 final" in `index.md` with those figures; set this step's status.
5. **Feature record.** In `docs/features/skill-trees.md`, fill **Verification** with the final figures (the three campaigns, deaths, days, every cell, parity's spread per role, run time), each against its band, and any figure the user accepted outside its band with the date; add a decision-log row for each acceptance; set the phase as the orchestrator directs (leave it if not told).
6. **Hand-over to step 26.** List in the execution record every number changed in this step and in step 24 (node, old, new), which step 26 needs for the manual's tables and `CLAUDE.md`'s rules of scaling.

### 4.5 Exclusions

- No new mechanics, nodes or policy steps; a policy fix is step 24's (design §8.3 prefers it to inflating numbers). If a figure needs one, stop and report.
- No change to the pick rate or to `CREATION_PERK_PICKS` without the user's decision.
- The manual's tables, screenshots and the full restating of `CLAUDE.md`'s rules of scaling are step 26's.

## 5. Verification

- The three campaign figures, deaths and days, from the final runs, each in its band or accepted by the user (AC11).
- Every cell of the procedure's table in band (TL5 reported), and step 24's parity cells for every lever this step touched within ±50 of the role's best.
- `npm test` passes, the guard fixture re-recorded once at the end and green.
- `npm run build` passes.
- The run log names every lever tried, with figures and the decision.

## 6. Completion criteria

- [ ] Final campaign runs and cells recorded; each figure in band, or the user's acceptance recorded (orchestrator's reply quoted with date).
- [ ] Parity re-checked for every kept lever; no plan beyond ±50 of its role's best.
- [ ] Yardstick test green; `fighterGrowth` re-measured only if it failed for the fighter's growth alone, and said so.
- [ ] Guard fixture re-recorded with the final figures in the commit message; `npm test` and `npm run build` pass.
- [ ] `index.md`: Measurements "25 final" column filled; step 25 status `done (<commit>)`.
- [ ] `docs/features/skill-trees.md` Verification filled; decision-log rows for any acceptance.
- [ ] Execution record: run log, changed-numbers list for step 26, run time.
- [ ] `CLAUDE.md` states no number this step made false.

## 7. Execution record

### Status: in progress, waiting on a decision (`--ready-level 10`)

One lever kept (the Blight Horror's hit points); the one-party and company campaigns are in band, deaths and days too. `--ready-level 10` is 445 of 500, 25 above its band, and no foe-side lever on today's map moves it without wrecking the other two (below). Stopped by the stop rule; the final runs, the guard's last re-record, the Measurements column and the feature record wait on the decision.

### Run log

| # | Lever | Value (from → to) | Run(s) | Figures | Kept / reverted | Note |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Start (step 24's final code, fa49575) | — | `24-final-one` (the guard has not moved since, so step 24's run stands for `25-one-a`), `25-company-a`, `25-rl10-a` | one party 268, 287 days, 0.9 dead; company 269, 287 days; rl10 445, 539 days, 0.9 dead | — | Where the campaigns are lost (one party): the Source 177 of 232 falls (445 Source battles, 268 won); Bandit Camp threat 3 44; Goblin Raid threat 2 9 (lone survivors). At the Source a party of four at level 7 loses 144 of 147, a party of five 33 of 298. rl10: 55 falls, none at the Source (445 of 445 won, parties of five at levels 10–11); the falls are the early Bandit Camp 3 (44), Goblin Raid 2 (9) and stray threat-4/5 nests. |
| 1 | `BLIGHT_HORROR_STATS.maxHp` | 55 → 65 | `25-one-b`, `25-b-sg7`, `25-b-sg10` | one party 236, 287 days, 1.1 dead; SG7 0, SG10 2 | superseded by 2 | 65 is above the yardstick's top for a level 1 block (63), and SG10 fell to step 01's 2, the band's floor. |
| 2 | `BLIGHT_HORROR_STATS.maxHp` | 55 → 63 | `25-one-c`, `25-company-c`, `25-rl10-c`, `25-c-sg7`, `25-c-sg10` | one party **243**, 287 days, **1.0** dead; company **243**, 288 days, 1.1 dead; rl10 **445**, 539 days, 1.0 dead; SG7 0, SG10 5 | kept (6f9eee8) | 391 hit points at level 5 (341 before). Inside the yardstick, no exception. The Source lost 202 of 445 (one party). SG10 15 → 5: still above step 01's 2, as the band asks, but lower, as the brief asked to be told. The other cells are untouched by it (the Horror fights only at the Source). |
| 3 | Scratch: the Source for five pre-rolls (Aldric, Brenna, Delwyn, Garrick, Aldric 2) raised to a level, 200 seeds | Horror 55, 60, 65, 80, 100 | `scratchpad/scratch25/src5.ts`, `sweep1.txt` | level 8: 290 of 300 at 55, then 190, 177, 122, 69 of 200; level 10: 300 of 300 at 55, 200, 199, 197, 185 of 200; level 11: 200, 200, 200, 197 of 200 | not a code change | Why rl10 does not move: by level 10 a party of five outclasses the Source. To take ~50 Source wins from rl10 (to 395) the Horror would need well over 100 hit points a level 1 block, which at level 8 is a win in three (69 of 200 at 100), the one-party campaign far below 150. |
| 4 | Scratch: a fifth guardian at the Source (the Goblin Cutter, count 4 → 5 at threat 5), Horror 55 | 4 → 5 | scratch, reverted | level 8 176 of 200; level 10 200; level 11 200 | reverted (not committed) | The same shape: it hits level 8 and leaves 10–11 untouched. |

Levers 2 and 3 of the brief (a half-step of bandit gear at threat 5; `FOE_HP_PER_LEVEL` 1.3 → 1.4) were not run as campaigns: the one-party and company figures are already in band, and neither can reach rl10's falls. rl10's parties fight Bandit Camp 5 2229 times and lose 2, Goblin Raid 5 2208 and lose 5; step 24 measured every threat-5 cell at level 8 at 500 of 500 but the Hobgoblin Warband's 465, so a few points of foe hit points or a Masterwork weapon on a threat-5 bandit cannot wipe a level-8-to-11 party of five 50 more times in 500. The only things on record that beat such parties are off today's map (BC6 74 and BC7 22 at level 8, step 24).

Run time: one party 7 min 18 s and company 7 min 51 s with other work on the machine (the first company run, alone, 4 min 42 s); `--ready-level 10` 17 min 39 s and 20 min 55 s (step 23: 580 s), as its campaigns are now 539 days and 46 battles long.

### Decision needed: `--ready-level 10` at 445 (band 370–420)

What it is: every rl10 campaign that reaches the Source beats it; its 55 falls all come before level 8. No foe on today's map, which tops out at threat 5, is a danger to a party of five at levels 10–11 built with the skill trees.

Options:

1. **Accept 445** as the stand-in for a longer campaign that today's map cannot test, and revisit when stage 9 opens threats 6 and 7 (BC6 and BC7 are already a danger at level 8). Recommended: it changes nothing the player sees, and the two figures that are the game as played (one party, company) are in band.
2. Make the Source much harder (Horror ≥ 100 hit points a level 1 block, or more guardians): takes rl10 into band but the one-party and company campaigns to roughly 100 of 500, against the user's bands.
3. A Source that scales with the party that comes to it (a new mechanic, excluded by §4.5; would need a design).

Changed numbers for step 26 (so far): the Blight Horror's level 1 hit points 55 → 63 (step 25). Step 24's are in its own record (`FOE_HP_PER_LEVEL` 0.7 → 1.3, `banditGear` Fine iron from threat 3, the Spider Nest's fourth foe, Arcane Blood's Intelligence 4 → 3, Delwyn's build B, the parity plans' order).

Also folded in: contract C5 in `index.md` (and its decision 4) and `CLAUDE.md` now say the parity plans name their capstone first and the cryomancer takes Ice Lance before Web (step 24's review leftover), in 6f9eee8.
