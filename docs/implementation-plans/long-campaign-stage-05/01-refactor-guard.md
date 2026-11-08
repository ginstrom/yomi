# Step 01: The refactor guard

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-05-company-of-one.md) (§5 "The refactor guard comes first", §6 Verification) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) (A1, §7.1 "Refactor guard") · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard")

**Difficulty:** routine. The step runs the simulator, records what it prints, exports one constant and adds one test whose fixture is copied from the unchanged tree. Use `model: "sonnet"` for both the engineer and the reviewer.

## 1. Objective

Fix what "no behaviour change" means for the whole stage, before any stage 5 code changes:
- **The 500-campaign figure.** Measure it on the tree as it stands. Step 10 must reproduce it line for line.
- **The 50-campaign check.** Record its printed summary and its log's SHA-256. Steps 02 to 09 each compare against them.
- **The guard test.** Add a 5-campaign test to `scripts/simulate.test.ts` (C1), whose fixture is this tree's output. It runs in `npm test` from now on, so every later step is checked by the gate itself.

## 2. Requirements and context

- **S5-R5:** no behaviour changes. A seeded simulator run gives an identical summary before and after (reference A1).
- **The design's words:** "Before any change, store the summary of `--campaign --battles 50 --seed 1` as a test fixture in `scripts/simulate.test.ts`, with a short run (about 5 campaigns) for test speed. After each step, the run must match exactly."
  - The plan takes the 5-campaign run as the in-test fixture.
  - The 50-campaign summary and log hash are recorded here, and each later step checks them by hand (index, "The refactor guard").
- **The early-game figure.** It was **230 of 500** after stage 4 (`npm run simulate -- --campaign --battles 500 --seed 1`). `--ready-level` defaults to 7, so the flag is not needed. The stages index's convention is to re-measure at the start of each stage.

### C1. The refactor guard (copied unchanged from the index)

- `scripts/simulate.ts` exports `CAMPAIGN_SEED_STEP` (existing constant, 1000, now exported).
- `scripts/simulate.test.ts` gains `describe('the refactor guard', …)` with one test. It:
  - builds `args = parseArgs(['--campaign', '--battles', '5', '--seed', '1'])`;
  - for `run` 0 to 4, calls `runCampaign(run, (1 + run * CAMPAIGN_SEED_STEP) >>> 0, args, firstBattleId)`, carrying `firstBattleId` forward by each campaign's battle count, as `main` does;
  - compares the list of `CampaignRecord`s with `GUARD_RECORDS`, a literal in the test file, using `toEqual`;
  - compares `sha256(lines.join('\n'))` with `GUARD_EVENTS_SHA256`, a string literal. `lines` is every battle's every event, in order, as `JSON.stringify(event)`, each event carrying its `battleId` as `main` writes it. Use `node:crypto`.
- The fixture is the output of the tree at `4a2b824`, taken before any change. It is never edited after step 01.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit (`make test` is the same in podman);
  - `npx vitest run scripts/simulate.test.ts -t "the refactor guard"` runs only this test;
  - `npm run simulate -- <flags>` (or `make -s simulate ARGS="<flags>"`). Give each run its own `--out` under `logs/`, which is gitignored, so never commit a log. Never run two `make simulate` at once: both build the same image, and the loser prints nothing.
- **The 50-campaign check.** Every step from 02 to 09 runs exactly:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  - The printed summary must equal, line for line, the one recorded in this step's execution record.
  - The log's hash must equal this step's.
  - The summary's first line names the `--out` path, so always use this exact path.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. This step changes no behaviour at all: exporting a constant and adding a test move nothing.
- **Commits.** One commit for this step, once `npm test` passes, on `long-campaign-stage-05`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.

## 3. Dependencies and prerequisites

- **No step dependency.** This step runs first, on the tree at the plan's commit (code at `4a2b824`), before steps 02 to 10 change code.
- **Environment:** Node 26 at `/opt/homebrew/opt/node@26/bin`, or podman with the repo's image.
- **What later steps use:**
  - `GUARD_RECORDS` and `GUARD_EVENTS_SHA256` in `scripts/simulate.test.ts`. No later step may edit them;
  - the 50-campaign printed summary, verbatim, and the SHA-256 of `logs/guard-50.jsonl`, in this file's execution record;
  - the 500-campaign printed summary, verbatim, and its log's SHA-256, in this file's execution record. Step 10 compares against them;
  - the exported `CAMPAIGN_SEED_STEP`.

## 4. Scope and guidance

1. **Check that the tree has no code changes.** Run `git status`; only the plan's docs may differ. Record `git rev-parse --short HEAD`.
2. **Measure the 500-campaign figure, before touching code:**

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --out logs/s5-baseline-500.jsonl > logs/s5-baseline-500.txt
   shasum -a 256 logs/s5-baseline-500.jsonl
   ```

   - Expect "Beat the Source: 230 of 500". If it differs, record the figure and say so in your report; do not tune anything.
   - Paste the whole printed output and the hash into the execution record. A run takes about a minute and writes some 70 MB.
3. **Run the 50-campaign check** with the exact command in §2. At `4a2b824` the planner measured "Simulated 50 campaigns, 852 battles in all" and "Beat the Source: 23 of 50", in about 28 s. Paste the whole printed output (`logs/guard-50.txt`) verbatim and the hash into the execution record.
4. **Export `CAMPAIGN_SEED_STEP`** from `scripts/simulate.ts`. Change nothing else there.
5. **Produce the fixture** from the same code on the unchanged tree. For example, temporarily print `JSON.stringify(records)` and the hash from the test body, or from a scratch script outside the repository. Paste them into the test as `GUARD_RECORDS` (typed `CampaignRecord[]`) and `GUARD_EVENTS_SHA256`, then remove the temporary code.
   - Keep the literal readable: one record per entry, formatted as the file's other literals are.
   - Put a comment over the fixture saying what it is: the output at `4a2b824`, never to be edited. A mismatch means a step changed behaviour.
6. **Add the test** per C1, in `describe('the refactor guard', …)`.
   - It takes about 2 to 3 seconds. Raise that test's timeout if vitest's default is too short.
   - Do not touch the other tests in the file.

**Out of scope:** any change to the simulator's behaviour, to `runCampaign`, or to the summary's format.

## 5. Verification

- `npx vitest run scripts/simulate.test.ts -t "the refactor guard"` passes.
- **Check the test can fail.** Change one value in `GUARD_RECORDS` (say a `days`) and one character of `GUARD_EVENTS_SHA256`, and see each fail. Then restore both, and see the test pass again. Record this in the execution record.
- `npm test` passes.
- Run the 50-campaign check a second time and see the same summary and hash. This shows the run is deterministic on this machine.

## 6. Completion criteria

- [ ] The 500-campaign summary (expected 230 of 500) and its log's SHA-256 are recorded verbatim below.
- [ ] The 50-campaign summary and the SHA-256 of `logs/guard-50.jsonl` are recorded verbatim below.
- [ ] `CAMPAIGN_SEED_STEP` is exported, and the guard test (C1) with its fixture is in `scripts/simulate.test.ts`, passing, and was seen to fail on an altered fixture.
- [ ] `npm test` passes, and the step is committed as "Stage 5 step 01: the refactor guard", with no log committed.
- [ ] The index's task table shows step 01 as done, with its commit.

## Execution record

Run at HEAD `e58c806` (code identical to `4a2b824`; only plan docs differ), Node 26.

**Deviations.** None in behaviour. The 500 run took over 3 minutes here (not about one; it overlapped with other work), so timings are not comparable. The commit message has no `Co-Authored-By` line, by the brief's instruction (the task file says to add one). The fixture was generated by a scratch script outside the repository using the same calls as the test.

**Figures.** 500 campaigns: Beat the Source 230 of 500, as expected. 50 campaigns: 852 battles, 23 of 50, as the planner measured. The 5-campaign guard log has 3734 events.

**Guard test.** Fixture: SHA-256 `c5c83f8e83d614381e6bd76e5bee1075e5d7b66c6cf9b5873eafce41453b2769` of the 5-campaign events joined by newline. Seen to fail with `days: 333` changed to 334 and with the hash's first character changed; restored, it passes. `npm test` passed (see below).

### 500 campaigns (`logs/s5-baseline-500.jsonl`)

SHA-256 `d17e6dca65137917aaa7e1bb873ab241b323dbe6152e338c141ae618b51613fd`

```
Simulated 500 campaigns, 9121 battles in all (seed 1, player aggressive vs enemy aggressive) -> logs/s5-baseline-500.jsonl
Beat the Source: 230 of 500 (46.0%); party fell: 270 (54.0%); encampment lost: 0 (0.0%); out of days: 0
A campaign: 270 days, 18.2 battles, 26.0 spawns, 3.1 sites captured and 0.1 lost, 38% of the land blighted at the end
Watchtowers: 1.8 built a campaign, 0.0 lost
Shrine: level 1.0 at the end; outposts: 0.5 built a campaign
Trading post, workshop, infirmary: levels 1.1, 0.6, 0.5 at the end; 1 gold on gear and 51 from sales, 4.3 items crafted (2.7 days in the field) a campaign
Tier-2 items bought: 0.0 a campaign
Runes: 13.1 found, 0.0 bought and 0.1 fused a campaign, 3 gold on runes; 0.0 sockets filled at the end
Guild hall: level 2.4 at the end, 2.1 recruits and 1.8 heroes dead a campaign
Hit points healed between battles: 131.3 a campaign, in 22.2 days of camping
Levels at the end: lowest 6.7, highest 7.2 on average (ready level 7); heroes died at level 2 (35), 3 (190), 4 (38), 5 (113), 6 (18), 7 (258), 8 (214), 9 (22)
Battles to level 5: 6.8 (412 campaigns); 10: — (0 campaigns); 15: — (0 campaigns); 20: — (0 campaigns)
┌─────────┬────────┬─────────┬──────┬─────────┐
│ (index) │ threat │ battles │ won  │ winRate │
├─────────┼────────┼─────────┼──────┼─────────┤
│ 0       │ 1      │ 1007    │ 1007 │ 1       │
│ 1       │ 2      │ 1756    │ 1732 │ 0.986   │
│ 2       │ 3      │ 1995    │ 1932 │ 0.968   │
│ 3       │ 4      │ 2870    │ 2847 │ 0.992   │
│ 4       │ 5      │ 1493    │ 1333 │ 0.893   │
└─────────┴────────┴─────────┴──────┴─────────┘
┌───────────────────────┬──────────────────────┐
│ (index)               │ Values               │
├───────────────────────┼──────────────────────┤
│ battles               │ 9121                 │
│ playerWins            │ 8851                 │
│ enemyWins             │ 270                  │
│ unresolved            │ 0                    │
│ avgRounds             │ 5.022037057340204    │
│ avgPlayerDamageDealt  │ 98.09341081021817    │
│ avgEnemyDamageDealt   │ 28.94134415086065    │
│ playerHitRate         │ 0.6666905917142775   │
│ enemyHitRate          │ 0.6014830536935291   │
│ playerCritRate        │ 0.044321150699089894 │
│ enemyCritRate         │ 0.04885748445077309  │
│ avgOpportunityAttacks │ 0                    │
│ avgSideAttacks        │ 1.2334173884442496   │
│ avgRearAttacks        │ 0.16215327266747068  │
│ avgPlayerCasts        │ 4.740160070167745    │
│ avgEnemyCasts         │ 2.157767788619669    │
│ avgPlayerAreaAttacks  │ 0                    │
│ avgEnemyAreaAttacks   │ 0.024229799364104812 │
│ avgPlayerHealing      │ 2.4685889705076196   │
│ avgEnemyHealing       │ 6.620984541168731    │
│ avgPlayerStatuses     │ 2.9282973358184408   │
│ avgEnemyStatuses      │ 0.7772174103716698   │
└───────────────────────┴──────────────────────┘
```

### 50 campaigns (`logs/guard-50.jsonl`), run twice with the same result

SHA-256 `068016a82040ec5be673084265005a7218f0ce927629880565c1a27a8cf52d76`

```
Simulated 50 campaigns, 852 battles in all (seed 1, player aggressive vs enemy aggressive) -> logs/guard-50.jsonl
Beat the Source: 23 of 50 (46.0%); party fell: 27 (54.0%); encampment lost: 0 (0.0%); out of days: 0
A campaign: 266 days, 17.0 battles, 24.3 spawns, 2.9 sites captured and 0.1 lost, 38% of the land blighted at the end
Watchtowers: 1.8 built a campaign, 0.0 lost
Shrine: level 1.0 at the end; outposts: 0.5 built a campaign
Trading post, workshop, infirmary: levels 1.1, 0.6, 0.5 at the end; 6 gold on gear and 61 from sales, 4.4 items crafted (2.8 days in the field) a campaign
Tier-2 items bought: 0.0 a campaign
Runes: 12.1 found, 0.0 bought and 0.1 fused a campaign, 3 gold on runes; 0.0 sockets filled at the end
Guild hall: level 2.4 at the end, 2.2 recruits and 1.8 heroes dead a campaign
Hit points healed between battles: 109.4 a campaign, in 25.0 days of camping
Levels at the end: lowest 6.4, highest 6.9 on average (ready level 7); heroes died at level 2 (4), 3 (20), 4 (3), 5 (16), 6 (5), 7 (26), 8 (16)
Battles to level 5: 6.8 (38 campaigns); 10: — (0 campaigns); 15: — (0 campaigns); 20: — (0 campaigns)
┌─────────┬────────┬─────────┬─────┬─────────┐
│ (index) │ threat │ battles │ won │ winRate │
├─────────┼────────┼─────────┼─────┼─────────┤
│ 0       │ 1      │ 101     │ 101 │ 1       │
│ 1       │ 2      │ 170     │ 167 │ 0.982   │
│ 2       │ 3      │ 189     │ 180 │ 0.952   │
│ 3       │ 4      │ 262     │ 261 │ 0.996   │
│ 4       │ 5      │ 130     │ 116 │ 0.892   │
└─────────┴────────┴─────────┴─────┴─────────┘
┌───────────────────────┬──────────────────────┐
│ (index)               │ Values               │
├───────────────────────┼──────────────────────┤
│ battles               │ 852                  │
│ playerWins            │ 825                  │
│ enemyWins             │ 27                   │
│ unresolved            │ 0                    │
│ avgRounds             │ 5.076291079812207    │
│ avgPlayerDamageDealt  │ 97.71009389671362    │
│ avgEnemyDamageDealt   │ 29.18661971830986    │
│ playerHitRate         │ 0.6618246498184244   │
│ enemyHitRate          │ 0.6107468643101482   │
│ playerCritRate        │ 0.045653301711998814 │
│ enemyCritRate         │ 0.04789053591790194  │
│ avgOpportunityAttacks │ 0                    │
│ avgSideAttacks        │ 1.335680751173709    │
│ avgRearAttacks        │ 0.14084507042253522  │
│ avgPlayerCasts        │ 4.5481220657277      │
│ avgEnemyCasts         │ 2.2347417840375585   │
│ avgPlayerAreaAttacks  │ 0                    │
│ avgEnemyAreaAttacks   │ 0.015258215962441314 │
│ avgPlayerHealing      │ 2.335680751173709    │
│ avgEnemyHealing       │ 6.592723004694836    │
│ avgPlayerStatuses     │ 2.711267605633803    │
│ avgEnemyStatuses      │ 0.8697183098591549   │
└───────────────────────┴──────────────────────┘
```
