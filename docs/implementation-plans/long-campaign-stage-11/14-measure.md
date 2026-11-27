# Step 14: Measure and record

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-11-high-roster.md) (§6 Verification, "After the last ring"; §7 Risks; "Done when") · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.2, §5.5, §5.7 · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard") · [Balance skill](../../../.claude/skills/yomi-balance/SKILL.md) (`bands.md`, `running.md`, `guards.md`) · [Stage 10's measuring step](../long-campaign-stage-10/10-measure.md) · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) runs the stage's closing measurements through `yomi-measure`, reads the early figures against step 01 and the user's bands, records the long run for stage 12 without tuning it, re-runs every cell, and decides what is a stop-and-report. The reviewer (opus) checks that each figure was read from the line `running.md` names, that nothing was tuned, and that every out-of-reading cell or out-of-band figure went to the orchestrator.

## 1. Objective

Measure the stage on the code as step 13 left it, and record it:
- the early figures (`one`, `company`, `rl10`, all with `--near-source`) against step 01's baseline and the bands: expected identical (decision 15);
- the standard cells, expected equal to "Now" in `bands.md`;
- the long campaign (100, ready level 18, `--log none`), timed: recorded against step 01's long run and stage 10's, with its Source share and battles to level written down for stage 12;
- every C9 cell once more on the final code, against the figure its ring step recorded.

No tuning and no code change in this step.

## 2. Requirements and context

- **Design §6, "After the last ring":** the long campaign (100 campaigns) against stage 10's numbers. The Source share and the battles to level are recorded for stage 12.
- **Design §6, per ring, Simulator:** `--encounter X --threat T --party-level T --player-kit expected` at both ends of each band; a party of the threat's level wins most but not all.
- **Design "Done when":** every ring's kinds, nests and sprites are in, all tests pass, the per-ring cells are fair, the long run is recorded, and every new encounter has been fought in play (step 15).
- **Stage 10's long run** (100, seed 1, `--log none`; `bands.md` "Now"): Source 1 of 100, fell 97, 1414 days, 42.3 battles; battles to level 5/10/15 6.8/28.4/55.9 in 84/53/16 campaigns; the kit lags `expectedKit` (accepted until stage 12). Stage 9's step 01 baseline: 15, 1272 days, 46.4 battles. Step 01 of this stage re-measured the long run on this branch (`log.md`, "Step 01").

### Decisions from the index (unchanged)

4. **The cells' reading of "most but not all"** *(for the user, Q4)*: per-ring cells are report-only (the user's bands are not extended); the plan's working reading is **300 to 475 wins of 500** at both band ends, with `--player-kit expected`, a party of the threat's level. A ring step tunes only its own encounters toward it, at most three trials an encounter, then reports. C9.
15. **The refactor guard and the 50-campaign check stay identical through every step**: `--near-source` drops every fixed nest above threat 5, the near-home Source is unchanged (decision 3), and new `SPAWN_KINDS` are appended with `fromThreat: 7`. If a step moves either, it finds the cause; if the cause is only far spawns' kinds reaching the early campaign, it stops and brings it to the orchestrator (a re-record then needs approval and goes in that step). No step is planned to re-record the guard.
19. **Early measures with `--near-source`** (as stages 9 and 10): `one`, `company`, `rl10`, the refactor guard and the 50-campaign check. **Stage 12 owns** the accepted out-of-band figures (`one` 288, `company` 289, 331 days), the long campaign's gear lag and the Source at 1 of 100; this stage records the long run and does not tune it. Any figure further out than accepted goes to the orchestrator with options, never tuned away. The user's bands are never changed.

### Contract consumed (copied unchanged from the index)

**C9. The cells (steps 02, 08 to 14)**

`--encounter E --threat T --party-level T --player-kit expected`, 500 battles from seed 1, report only, read against decision 4 (300–475). Codes (`bands.md`'s cell codes and measure names, lower case): `wp6`, `wp9`, `wr7`, `wr9`, `oc7`, `oc10` (08); `wy9`, `wy12` (09); `bw11`, `bw14`, `bl11`, `bl14`, `hg12`, `hg15` (10); `go14`, `go17`, `cu14`, `cu18`, `yd15`, `yd18` (11); `lc17`, `lc20`, `ew18`, `ew20` (12); `sgk20` (`source_guardians` 20, 13). Step 02 also measures, kitted, `bco9k`, `bco12k`, `fh15k`, `fh18k`, `sgk20` on today's Source.

### Shared constraints (from the index, unchanged)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file; `npm run build` before a ring step's commit;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` first;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 08–14 run them, in order). Measurements go through the `yomi-measure` agent. Long runs: 100 campaigns took 4 minutes alone in stage 10, up to 20 under load.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, args `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`; `GUARD_RECORDS`, `GUARD_EVENTS_SHA256`. Rules: `.claude/skills/yomi-balance/guards.md`. Every step keeps it green and unedited (decision 15).
- **The 50-campaign check** before committing a domain or simulator step (02, 03, 08–13, 14 if anything changed), against the hash before the step (step 01's, `log.md`), recorded "identical" or the diff in `log.md`:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  Sprite steps (04–07) and step 15 change no rule and need not run it (say so).
- **The early-game figure.** Stage 10 ended at `one` 288 (331 days, 1.2 dead), `company` 289, `rl10` 409 (533 days), with `--near-source`; `one`, `company` and the days are accepted until stage 12 (`bands.md`). Step 01 re-measures them; step 14 measures again. A move of more than about 5 points is explained in the commit and in `src/game/CLAUDE.md`'s scaling line, or brought to the orchestrator.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG for an existing encounter. New spawn kinds are appended (`.claude/skills/yomi-add-content/encounter.md`). The immunity draws nothing. Favoured runes draw from the loot stream, as today.
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on `long-campaign-stage-11`, without pushing; files staged by path. Messages "Stage 11 step NN: <title>". No attribution lines.
- **Docs.** Each step fixes the CLAUDE.md lines its change makes wrong. Each ring step adds its cells to `bands.md`'s cell codes and measure names (report only) and "Now"; step 15 writes the rest and the manual.

## 3. Dependencies and prerequisites

- **Step 13** (and through it 01–12) must be done, every earlier stop-and-report answered. All sprite steps (04–07) merged.
- **Step 01's baseline** is in `log.md` ("Step 01"): the early figures, the 50-campaign hash, the long run, the far cells.
- **Each ring step's cell figures** (steps 08–13's execution records and `log.md`), and step 02's kitted far cells, are the comparisons for §4.1 item 4.
- **Measure names** (`.claude/skills/yomi-balance/bands.md`): `one`, `company`, `rl10`, `long`, the standard cells, and the C9 codes the ring steps added. If a name is missing or its flags differ from C9, stop and report: do not invent flags.
- **`yomi-measure`** (`.claude/agents/yomi-measure.md`), spawned per the engineer role (`.claude/roles/engineer.md`); if the spawn is refused, a `general-purpose` agent briefed with that file's body. One spawn at a time, each given a list of measures to run in order; it refuses to start beside another simulation.
- **Environment:** a quiet machine for the timed long run; note anything heavy running beside each run (in-browser tests, builds).

## 4. Scope and guidance

### 4.1 Measure, in this order

Seed 1, one run at a time, label `s11-14`, logs under `logs/s11-14-*`. Counts 500 unless named; `long` 100. Read every figure from the line `running.md` ("Which line carries each figure") names.

1. **`one`, `company`, `rl10`** (500 each, `--near-source`): Source wins, days, battles, heroes dead; `company`'s guard battles and promotions. Against step 01 and the bands (`one` 215–250, `company` 220–260, `rl10` 370–420, heroes dead at most 2.0, days 243–297; `one` 288, `company` 289 and 331 days accepted until stage 12). Expected identical to step 01 (decision 15).
   - A move of more than about 5 points from step 01, or any figure further out than accepted: **stop and report** to the orchestrator with the figures, the cause as far as the ring steps' records and the git log allow, and options. Do not tune.
2. **The standard cells** (`gr3`, `bc3`, `bc4`, `bc5`, `sn5`, `sp5`, `sg7`, `sg10`, and report-only `tl5`, `f1`–`f3`): each should equal "Now" in `bands.md` (no existing encounter changed; the near-home Source is today's). Any difference is a finding: stop and find the cause before going on.
3. **`long`** (100, `--log none`), timed. From it:
   - outcomes (Source, fallen, encampment lost, out of days) and the Source share;
   - days; battles; walking days (`vanguardWalkDays`, `vanguardWalkHomeDays`); final levels (lowest, highest);
   - battles to level 5, 10, 15 and 20, and the campaigns reaching each;
   - deaths by level;
   - the threat table (battles and win rate at each threat, to 20);
   - the Kit lines (all campaigns and forge-ready), against `expectedKit`;
   - trophies gained a campaign (wolfhide, wyvern hide, basilisk scale, drake scale), from the summary's gold-and-stock lines if it prints them; if it does not, say so and do not add a measure;
   - gold by source, gold on gear and on forging; trading post, workshop and infirmary levels at the end;
   - run time and load.

   Compare with step 01's long run and stage 10's (Source 1 of 100, 1414 days, 42.3 battles; battles to level 5/10/15 6.8/28.4/55.9 in 84/53/16 campaigns). Stage 9's step 01 baseline (15, 1272, 46.4) for context.
4. **Every C9 cell**, once more on the final code (`wp6` … `ew20`, `sgk20`, and step 02's `bco9k`, `bco12k`, `fh15k`, `fh18k`): wins of 500, against the figure its ring step recorded (step 02's for the kitted bandit cells; step 02's `sgk20` was today's Source, step 13's the rebuilt one).
   - A cell differing from its ring step's figure: later rings should not move earlier cells (each encounter is its own data), unless a shared kind (for example `ogre` or `barrow_wight` as a minion) was retuned later; find which step moved it and record it.
   - A cell outside 300–475 that was **not** already answered by the orchestrator in its ring step: bring it to the orchestrator with the figure and the step's trials. Do not tune.

### 4.2 Judge, without tuning

- The early figures and the standard cells: as §4.1 items 1 and 2.
- **The long run is recorded, not judged** (decision 19): stage 12 owns the Source share, the gear lag and the early figures. Note, without acting on it, what the high roster changed against stage 10: the ring win rates at 7, 9, 12, 15 and 18 (now monsters, not bandits), the Source at 20 (rebuilt), the trophies reaching the stock, and whether hide tiers 4 and 5 could now be forged in play.
- If 100 long campaigns take more than about 20 minutes alone, report it with the figure (stage 10: 4:07); do not profile or optimise here.

### 4.3 Record

- **`log.md`:** a "Step 14: measure and record" heading with the date and code SHA; a table per run (measure, flags, figure, band or "report only", change from step 01, wall time, log path); the long run's detail tables (battles to level, deaths by level, threat table, the Kit table against `expectedKit`, trophies); the cells table (code, encounter, threat, wins of 500, its ring step's figure, the reading 300–475); what else ran beside each run.
- **`bands.md` "Now":** the far cells (the C9 codes and the kitted bandit cells, report only) and the long campaign's line; the early rows only if they moved and the orchestrator accepted it. Never change a band.
- **The execution record** below: the summary, the judgments, any stop-and-report and its answer, and:
  - **"Figures for stage 12":** the Source share of the long run, battles to level 5/10/15/20 and campaigns reaching each, the ring win rates, against stage 10's and step 01's;
  - **"Figures for the implementation notes"** (step 15): the early figures against step 01; the long run against step 01 and stage 10; the cells per ring against the reading; any cell or figure the orchestrator accepted out of reading; the runtime.
- **The index:** row 14's status and commit.

### 4.4 Exclusions

No rule or constant change, no tuning, no new simulator flag or measure, no band change, no docs beyond `bands.md` "Now" (the rest is step 15's).

## 5. Verification

- Every measure of §4.1 run once, through `yomi-measure`, one at a time; their `.txt` under `logs/s11-14-*`.
- The early figures equal step 01's (or the move was brought to the orchestrator and answered); the standard cells equal "Now".
- Every C9 cell recorded against its ring step's figure and the reading.
- No code changed: say so; `npm test` still passes as the gate; the 50-campaign check is not needed (no change) and is skipped, said so in the record. If anything in `src/` or `scripts/` did change in this step, run it against step 01's hash, and it must be identical.

## 6. Completion criteria

- [ ] `one`, `company`, `rl10` measured with `--near-source`, against step 01 and the bands; any move or out-of-band figure brought to the orchestrator and answered.
- [ ] The standard cells checked against "Now".
- [ ] `long` (100) measured and timed, every figure of §4.1 item 3 recorded against step 01 and stage 10; "Figures for stage 12" written.
- [ ] Every C9 cell re-run and recorded; any unanswered cell outside 300–475 brought to the orchestrator.
- [ ] `log.md`, `bands.md` "Now", the execution record (with the list for step 15) and the index's row 14 updated.
- [ ] One commit, "Stage 11 step 14: measure and record", files staged by path, no attribution lines.

## 7. Execution record

2026-11-28, engineer (model unset). Code `2c1ec54` throughout (no `src`/`scripts` change in this step). Every figure, table and wall time is in `log.md`, "Step 14: measure and record"; logs `logs/s11-14-*`, times `logs/s11-14-times.txt`.

**How it ran.** The engineer ran the simulator itself, in the foreground, one run at a time under `caffeinate -i`, using step 01's flags (seed 1; `--log none` for everything except the runs that needed a `.jsonl` to diff: `guard-50`, `one-out`, `rl10`). No `yomi-measure` spawn (the brief preferred this). `pmset` shows no sleep across any run; load 2 to 4.6 (the podman VM, WindowServer, a Codex app); no other simulation, build or test ran beside them. The 50-campaign check ran even though nothing changed (the brief asked): identical, `1e85d023…`.

**Summary.**
- Early figures **moved**: `one` 288 → 287, `company` 289 → 288, `rl10` 409 → **371** (533 → 541 days, 1.3 → 1.6 dead). Cause found: the ring 7 and 9 kinds appended to `SPAWN_KINDS` (step 08 `b0fbe7d`, step 09 `2b35cb9`) widen the list `spawn` draws from at threats 7 and 9, so early campaigns that spawn there get other kinds; `wolf_pack` and `worg_riders` at 9 beat `rl10`'s own-kit parties (0.37, 0.25). `one` at `b0fbe7d` reproduces head's battle list exactly. This is decision 15's named stop case, and `rl10` moves by more than 5 points: **brought to the orchestrator** (below). Nothing tuned. `one` and `company` move toward their bands, and `rl10` is still in its band (370–420), by one.
- Standard cells: all equal "Now".
- `long` (100): Source 0 of 100 (fell 100), 739 days, 26.8 battles, 76 s. Recorded, not judged (decision 19).
- Every C9 cell, the in-play cells and step 02's kitted cells equal the figure their step recorded; no new cell outside 300–475.

**Stop-and-report (open): `rl10` 371, the new spawn kinds in the early campaign.** Options: (a) accept and record it (it is in band; it is what the game now does; stage 12, which owns the gear lag, retunes); update `bands.md`'s `one`/`company`/`rl10` "Now" and `src/game/CLAUDE.md`'s scaling line on that answer; (b) make `--near-source` also keep the pre-stage-11 `SPAWN_KINDS`, which brings the early measures back to 288/289/409 but makes them measure a world the game no longer has (a simulator change and a new guard reading, so the user's approval); (c) raise the new kinds' `fromThreat` (ring 7's to 8 or 10) or retune `wolf_pack`/`worg_riders` at 9: a rule change, out of this step. Recommendation: (a).

**Figures for stage 12** (now / step 01 = stage 10):
- Source share: 0 of 100 / 1 of 100 (stage 9's step 01: 15).
- Battles to level 5 / 10 / 15 / 20: 6.8 / 26.8 / 47.3 / — in 84 / 38 / 3 / 0 campaigns; before 6.8 / 28.4 / 55.9 / — in 84 / 53 / 16 / 0.
- Ring win rates (long run): 7 0.824 (0.939), 9 0.456 (0.785), 12 0.600 in 40 battles (0.367 in 768), 15 0 in 3 (0.295 in 156); 18 and 20 not reached (1 battle each before). The rebuilt Source is never fought in the long run.
- Kit: tier 1.0 and no runes at every mark, no forge-ready campaign; forging gold 82 (2271). Hide tiers 4 and 5 are not forged in play. Trophies are not printed by the summary (no measure added).
- `rl10` 371 (409), from the new kinds at 7 and 9 (above); the ready-made party in its own gear wins 0 of 500 at the Source (`sg20-18`, `sg20`).

**Figures for the implementation notes** (step 15):
- Early figures against step 01: `one` 287 (288), 331 days, 1.2 dead; `company` 288 (289); `rl10` 371 (409), 541 days; 50-campaign hash identical; the refactor guard green (below).
- Long run against step 01 and stage 10 (the same figures): Source 0 (1), 739 days (1414), 26.8 battles (42.3).
- Cells per ring against the reading: as `log.md`'s cells table; out of reading and accepted earlier: `bw11` 485, `hg12` 495 (step 10), `yd15` 491 (step 11, the user), `lc17` 497, `ew18` 482 (step 12, the user); `bco12k` 254 (step 02, a yardstick cell).
- Runtime: `long` 76 s alone (stage 10 4:07, step 01 166 s); `one` 141 s, `company` 152 s, `rl10` 361 s.

**Gate.** `npm test` runlog #203 at `6b4fce3` (clean tree): exit 0, 109 files, 3025 passed, the refactor guard (`scripts/simulate.test.ts`) among them, unedited. No build or browser run (no code or scene change). The index's row 14 stays `in progress` until the orchestrator answers the `rl10` question.

**Answer (the user, 2026-11-28; `docs/features/long-campaign-stage-11.md`'s decision log): option (a).** `rl10` 371, `one` 287, `company` 288 accepted with the cause found; the long run recorded for stage 12, the stage carries on. Done in the close-up commit: `bands.md`'s early "Now" rows (one, company, `rl10`, heroes dead, days: stage 11's figures; 7,957 bytes) and `src/game/CLAUDE.md`'s scaling line (7,717 bytes). For stage 12: the 50-campaign check never spawns at threat 7, so it cannot catch early-campaign changes from far spawn kinds; run `one` and `rl10` when `SPAWN_KINDS` or an encounter's band changes. Row 14: awaiting review.
