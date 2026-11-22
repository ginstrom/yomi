# Step 09: Measure and judge

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-09-outer-rings.md) (§6 Simulator, §7 Risks, "Done when") · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.7, §6.2–§6.3, §7.2 · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard") · [Balance skill](../../../.claude/skills/yomi-balance/SKILL.md) · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) runs the stage's measurements through `yomi-measure`, judges them against step 01's baseline and the user's bands, decides whether a figure is a stop-and-report, and makes the one retune the design allows here (the Source winnable). The reviewer (opus) checks that the figures were read from the right lines, that nothing out of band was tuned away silently, and that any retune is the Source's count at 20 alone.

## 1. Objective

Measure the stage on the code as step 08 left it, and judge it:
- the early figures (`one`, `company`, `rl10`, all with `--near-source`) against step 01's baseline and the bands;
- the company against one party, at `--ready-level 10 --near-source` and on the long campaign (carried item 4);
- the first long-campaign baseline (100 campaigns, ready level 18), for stages 10 to 12;
- routes on the new map with `--trading-post 4`: opened, raided, abandoned, told, flickering, raided long without abandonment (carried items 2 and 3);
- the standard cells (a check they equal "Now") and the report-only cells of the new encounters and the Source at 20;
- make the Source winnable if it is not (decision 3), and nothing else.

## 2. Requirements and context

- **Design §6 Simulator:**
  1. `--ready-level 7`: the early-game guard. The early rings are unchanged, but the blight's spawn pressure is retuned, so check it. (Run with `--near-source`, decision 2.)
  2. The long campaign, `--battles 100` first: levels reached, battles to level, days, walking days, Source share. Expect the far rings to be too easy or too hard in places, because the roster and gear are incomplete. Record the figures as the baseline for stages 10 to 12. Don't tune the Source beyond "winnable".
- **Design §7 risks:** runtime (step 08's gate, done before this step); the blight on a map four times the size; pacing (too few nests per ring for the levels needed: watch battles to level).
- **Done when** (design): all tests pass, the guard holds, a 100-campaign long run completes in reasonable time with its baseline recorded in the stage's notes. (The notes are written by step 10 from the figures this step hands over.)

### Decisions from the index (unchanged)

2. **A stand-in Source for the early figures (open question 1, recommended answer).** The design keeps `--ready-level 7` as the early-game guard, but its Source is 122 hexes out at threat 20, which a level-7 party walks to through five rings and cannot beat: the guard, the bands `one`, `company` and `rl10` and the refactor guard would all collapse. The plan adds `--near-source` to the simulator (C2): the campaign's world puts the Source where it stood before this stage (stage 8's (58, 19), shifted to (58, 36)), fought at threat 5 as today; everything else is the stage-9 world. The early figures, the refactor guard and the 50-campaign check run with `--ready-level 7 --near-source` (`rl10` with `--ready-level 10 --near-source`), so they keep their meaning and the bands their values; `bands.md`'s measure names gain the flags (step 02). The long campaign runs without it. **Amended in step 05 (the user's decision, 2026-11-22):** the near-Source world also leaves out the fixed nests above threat 5 (the outer rings'), keeping the far sites and partners, and its land is seeded without them; left in, their corruption drew the spawns away from the home country.
3. **The Source's band is 1 to 20**, with today's counts at 1 to 5 and 5 foes (every slot) at 6 to 20, so the near Source and the `SG7`, `SG10` cells (threat 5) fight as today and the Source at 20 fields the Horror and its four guards at level 20 (design: "native level 1 rules, clamped" read as the encounter's level clamped to its band). Step 09 may lower the count at 20 to make it winnable, which the design allows; nothing else about the Source is tuned.
6. **Counts for the widened bands** (the design gives none; first values, measured as report-only cells in step 09): Spider Nest 3 at threat 4, 4 at 5 to 9 (it has four slots); Salamander Pool 3 at 5 to 9 (three slots); Bandit Company 4 at 8 to 13; Freebooter Host 4 at 14 to 16 and 5 at 17 to 20. The Bandit Camp already fields 4 at 6 and 7, as the design asks: no change.
13. **Measuring the carried route items needs record fields** (step 02, C2): `routeRaidsTold`, `routeFlickers` (a road told safe and raided again within 30 days, the case that is never abandoned) and `routesRaidedLong`; and `vanguardWalkDays` for the design's "walking days". Step 02 adds their values to `GUARD_RECORDS` only (no other value and not the event hash moves).

### Carried forward (from the index, unchanged)

(1) the Routes tab's four rows: step 03; (2) a raid that comes and goes between yield days never abandons: measured in step 09 with C2's fields, no rule change; (3) raids and abandonment unjudged: step 09 reports raided and abandoned counts on the new map; (4) the company against one party: step 09 reports both at `--ready-level 10 --near-source` and on the long campaign; (5) `src/game/CLAUDE.md` at its 8 KB cap: step 04 makes room before any line is added; (6) market income, spend order, full route figures: stage 12, out.

### Contract consumed (copied unchanged from the index)

**C2. The simulator's long-campaign settings and the Source's place (step 02)**

```ts
// src/game/worldMap.ts
export interface SourcePlace { position: Hex; threat: number }
export const SOURCE_PLACE: SourcePlace
//   step 02: { position: offsetToHex(58, 19), threat: 5 } (today's); step 04: { position: offsetToHex(131, 36), threat: SOURCE_THREAT }
export function newWorld(seed?: number, encampmentName?: string, partners: readonly PartnerLocation[] = PARTNERS, source: SourcePlace = SOURCE_PLACE): WorldState
//   the Source location ('blight_source', its name, encounter and loot unchanged) stands at source.position with source.threat, before the blight is seeded

// scripts/simulate.ts
export const SOURCE_READY_LEVEL = 18
export const MAX_CAMPAIGN_DAYS = 6000
export const NEAR_SOURCE: SourcePlace = { position: offsetToHex(58, 19), threat: 5 }   // step 04 changes the position to earlyHex(58, 19), i.e. offsetToHex(58, 36)
// CliArgs gains:
//   log: 'jsonl' | 'none'   (--log jsonl|none, default 'jsonl'; 'none' opens and writes no file; every printed figure is the same)
//   nearSource: boolean     (--near-source; refused without --campaign)
// With nearSource, a campaign's world and its waiting twin's are newWorld(seed, undefined, PARTNERS, NEAR_SOURCE).
// Amended in step 05 (the user's decision): the near-Source world (`nearSourceWorld(seed)`) also leaves out the fixed nests
//   above NEAR_SOURCE.threat (5), keeping the far sites and partners, and seeds its land, held sites and sight without them.
// CampaignRecord gains:
vanguardWalkDays: number     // days the vanguard (a lone party is the vanguard) walked, on any errand; vanguardWalkHomeDays counts those walking home
routeRaidsTold: number       // route_raided events with days 0 (a road turned raided)
routeFlickers: number        // route_restored events after which the same route turns raided again (route_raided, days 0) within ABANDON_AFTER * YIELD_DAYS days
routesRaidedLong: number     // routes raided on ABANDON_AFTER or more yield days in all (route_raided, days >= 1) and not abandoned by the end
// summarizeCampaigns averages them; the printed summary shows them in the trade line and a walking line.
// The refactor guard's args: --campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source.
// .claude/skills/yomi-balance/bands.md, measure names (flags only; no band value changes):
//   one: --campaign --parties 1 --ready-level 7 --near-source · company: --campaign --ready-level 7 --near-source
//   rl10: --campaign --ready-level 10 --near-source · rl12: --campaign --ready-level 12 --near-source
//   rl10-one: --campaign --parties 1 --ready-level 10 --near-source (report only)
//   long: --campaign --log none (count 100 unless told; report only) · long-one: long with --parties 1 · long-tp4: long with --trading-post 4
//   report-only cells: bc7 (bandit_camp 7, L7), sn7, sn9 (spider_nest), sp7, sp9 (salamander_pool), bco9, bco12 (bandit_company),
//   fh15, fh18 (freebooter_host), sg20-18 and sg20 (source_guardians 20 at L18 and L20); each --encounter E --threat T --party-level T unless named
```

The Source's counts (C1, step 01): `source_guardians { 1, 20 } [2, 3, 3, 3, 4, then 5 at each of 6 to 20]`, threats 1–5 unchanged.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`): `npm test` (`tsc && vitest run`) is the gate before every commit; `npm run simulate -- <flags>`, each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once.** Measurements go through the `yomi-measure` agent.
- **The refactor guard.** Step 09 may re-record it only for a retune the orchestrator approved (a `SPAWN_DIVISOR` change). The Source's count at 20 does not touch it (the guard fights the near Source at threat 5): if it moves, something else changed; find it.
- **The 50-campaign check** before committing, against step 08's hash (or step 05's if step 08 changed no code):

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  Identical unless an approved `SPAWN_DIVISOR` retune was made (record the new hash then).
- **The policy snapshot** (`src/engine/policies.test.ts`): re-recorded here only if the Source's count at 20 changes; then only the `source_guardians 20` lines may differ (prove it, as step 01 did for its lines).
- **The early-game figure.** Stage 8 ended at 233 of 500 (`--parties 1`) and 232 (company), `rl10` 433; step 01 re-measured the stage's baseline (see `log.md`). A move of more than about 5 points is explained in the commit and in `src/game/CLAUDE.md`'s scaling line, or retuned; **an out-of-band figure is brought to the orchestrator with options, never tuned away silently.** The design allows retuning `SPAWN_DIVISOR` (only with the orchestrator's go-ahead, as it moves the guard) and making the Source winnable (decision 3). The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed.
- **The runtime gate** is step 08 and is done: this step does not start until it is, and follows its decision.
- **Determinism.** No new draw of the world RNG or a battle's RNG; this step changes no code but, possibly, one count.
- **Commits.** One commit for this step once `npm test` passes, on `long-campaign-stage-09`, without pushing; files staged by path. Message "Stage 9 step 09: measure and judge". No attribution lines.
- **Docs.** If the Source's count changes, fix any line naming it (`docs/reference/game.md`'s encounter table, `.claude/skills/yomi-balance/levers.md`); the rest of the docs are step 10's.

## 3. Dependencies and prerequisites

- **Step 08** (and through it 01, 02, 04, 05) must be done, with the orchestrator's go-ahead if the runtime was over the gate. Step 07 (scenes) may run beside this step: no file overlaps but the index's table (update your row only).
- **Step 01's baseline** is in `log.md` (`one`, `company`, `rl10`, 50-campaign hash, day cost).
- **Step 08's outputs:** the timed 500-campaign `one` run and the 100-campaign long run, with the code's SHA. If no code changed since (compare `git log` from step 08's commit to `HEAD` over `src/` and `scripts/`), reuse those runs as `one` and `long` here and say so; otherwise run them again.
- **The measure names** of C2 are in `bands.md` (step 02). If a name is missing, stop and report: do not invent flags.
- **`yomi-measure`** is spawned per the engineer role (`.claude/roles/engineer.md`): if the spawn is refused, a `general-purpose` agent briefed with the body of `.claude/agents/yomi-measure.md`. One spawn at a time, each with a list of measures run in order; it refuses to start beside another simulation.

## 4. Scope and guidance

### 4.1 Measure, in this order

Seed 1, one run at a time, label `s9-09`. Counts 500 unless named; the long runs 100. Read every figure from the lines `running.md` names.

1. **`one`, `company`, `rl10`** (500 each, `--near-source`). Against step 01's baseline and the bands (`one` 215–250, `company` 220–260, `rl10` 370–420 accepted up to 445, heroes dead at most 2.0, days 243–297). Also read spawns, land blighted at the end, sites captured and lost.
   - A move of more than about 5 points from the baseline: find the cause as far as you can (diagnostic 50-campaign runs, not kept, e.g. with `SPAWN_DIVISOR` or `MAX_MONSTER_LOCATIONS` changed locally and reverted), and write it up for the commit and the scaling line.
   - **Any figure out of band: stop here and report** to the orchestrator with the figures, the cause as far as you can tell, and options (accept; retune `SPAWN_DIVISOR` to a named value with its 50-campaign figure; other). Retune `SPAWN_DIVISOR` only on the orchestrator's go-ahead; then re-record the refactor guard once (old and new figures in the doc comment above `GUARD_RECORDS`), record the new 50-campaign hash, and run 4.1.1 again.
2. **`rl10-one`** (500): carried item 4. Report `rl10` (company) against `rl10-one` (one party): Source wins, days, battles, heroes dead, guard battles, promotions. Stage 6 found them equal (389 each) on the old map.
3. **`long`** and **`long-one`** (100 each, `--log none`): the long baseline and carried item 4 again. From each: outcomes (Source, fallen, encampment lost, out of days) and the Source share; days; battles; walking days (`vanguardWalkDays`, `vanguardWalkHomeDays`); final levels (lowest and highest); battles to level 5, 10, 15 and 20 (and how many campaigns reached each); deaths by level; recruits and hall level; spawns; land blighted at the end; sites captured, lost and held; the threat table (battles and win rate at each threat, to 20); run time. Watch pacing (design §7): battles to level against the ring threats, and whether the vanguard stalls in a ring.
4. **`long-tp4`** (100): carried items 2 and 3. Partners contacted (and which, if the summary or a record count shows it: the far ones especially), routes opened, raided (runs), told (`routeRaidsTold`), flickering (`routeFlickers`), raided long without abandonment (`routesRaidedLong`), abandoned, route gold and its share of gold by source. No band is read with `--trading-post`.
5. **The standard cells** (`gr3`, `bc3`, `bc4`, `bc5`, `sn5`, `sp5`, `sg7`, `sg10`, and report-only `tl5`): a check that the stage moved no battle at threats up to 5. Each should equal "Now" in `bands.md`; any difference is a finding (stop and find the cause before going on).
6. **The report-only cells** (`bc7`, `sn7`, `sn9`, `sp7`, `sp9`, `bco9`, `bco12`, `fh15`, `fh18`, `sg20-18`, `sg20`): wins of 500 at the threat's own level (and `sg20-18` at 18). No band; record, don't tune (decision 6's counts are first values; design: "expect the far rings to be too easy or too hard in places").

### 4.2 Make the Source winnable (decision 3), and nothing else

"Winnable" here: the `long` run beats the Source at least once in 100, or `sg20-18` wins at least once in 500. If neither:
- lower `source_guardians`' count at threat 20 only (the last entry of its counts, 5 → 4), run `sg20-18` and a 50-campaign long run (`--campaign --battles 50 --seed 1 --log none`); if still neither wins, 4 → 3 and measure again; stop at 3 and report if it is still unwinnable (the next levers, the Horror's block, are stage 11's);
- re-record the policy snapshot, proving only `source_guardians 20` lines changed; the refactor guard and the 50-campaign check must stay identical (the near Source fights at threat 5);
- run `long` (100) again on the retuned count for the baseline.
Do not tune any other count, the Horror, `FOE_HP_PER_LEVEL`, the far nests or the blight.

### 4.3 Carried item 2, without a rule change

Say whether `routeFlickers` occur on the new map and how often (a campaign and per route opened), and how many routes were raided on `ABANDON_AFTER` or more yield days in all without being abandoned (`routesRaidedLong`). If they occur, frame it for the user as a question (the reset on "safe again" is the user's rule, stage 8's decision log), with the figures; change nothing.

### 4.4 Record

- `log.md`: a "Step 09" heading, then a dated table per run (measure, flags, figure, band or "report only", change from baseline, run time, log path) and the long-run detail tables (battles to level, deaths by level, threat table), and the hashes.
- This task file's execution record: the summary, the judgments, any stop-and-report and its answer, any retune.
- For step 10, a short "Figures for the implementation notes" list in the execution record: the early figures against the baseline, the long baseline, company against one party, routes, the cells, the Source's count at 20.

### 4.5 Exclusions

No rule change, no new simulator flag or policy, no scene or doc work beyond the lines a retune makes wrong, no change to a band, no tuning of the far rings (record them as the baseline for stages 10 to 12).

## 5. Verification

- Every measure of §4.1 run once, through `yomi-measure`, one at a time; their `.txt` (or `--log none` output) under `logs/s9-09-*`.
- The standard cells equal "Now" (or the difference is explained).
- If the Source was retuned: `npm test` passes with the policy snapshot re-recorded and the refactor guard unchanged; the 50-campaign check identical to the step's starting hash.
- If nothing changed in code: say so; `npm test` still passes.

## 6. Completion criteria

- [ ] `one`, `company`, `rl10` measured with `--near-source`, against the baseline and the bands; any out-of-band figure brought to the orchestrator and answered.
- [ ] `rl10-one`, `long`, `long-one` and `long-tp4` measured; company against one party reported both ways (carried 4); routes raided, abandoned, flickering and raided long reported (carried 2, 3).
- [ ] The standard cells checked against "Now"; the report-only cells recorded.
- [ ] The Source winnable (at least one win in `long` or in `sg20-18`), by the count at 20 alone if a retune was needed.
- [ ] Figures in `log.md` and the execution record, with the list for step 10.
- [ ] One commit, "Stage 9 step 09: measure and judge", files staged by path, no attribution lines; the index's row 09 updated with status and commit.

## 7. Execution record
