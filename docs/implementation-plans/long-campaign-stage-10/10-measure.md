# Step 10: Measure and judge

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-10-forging-and-high-tiers.md) (§6 Simulator, §7 Risks, "Done when") · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §5.8 (expected kit), §6 (the economy's levers), §7.2 · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard") · [Balance skill](../../../.claude/skills/yomi-balance/SKILL.md) · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) runs the stage's measurements through `yomi-measure`, judges the long run's kit against `expectedKit` and the early figures against the user's bands, decides whether a figure is a stop-and-report, and tunes only the levers the design names, in its order. The reviewer (opus) checks that the figures were read from the right lines, that nothing out of band was tuned away silently, and that any retune touched only the outer sites' yields or the forge costs.

## 1. Objective

Measure the stage on the code as step 09 left it, and judge it:
- the early figures (`one`, `company`, `rl10`, all with `--near-source`) against step 01's baseline and the bands;
- the long campaign (100 campaigns, ready level 18): the gear policy's kit at levels 5, 10, 15 and 20 against `expectedKit` ("the gear policy tracks the expected kit within a tier", the design's "Done when"), with its Source share and battles to level against step 01's long baseline and stage 9's;
- the standard cells (a check that the stage moved no battle at threats up to 5), and the report-only far cells, whose bandits now wear tiers 3 to 5 (step 02);
- if gear lags, tune the economy in the design's order (the outer sites' yields, then forge costs), and nothing else.

## 2. Requirements and context

- **Design §6 Simulator:**
  1. The early-game guard (`--ready-level 7 --near-source`).
  2. The long campaign (100 campaigns): gear tiers at levels 5, 10, 15 and 20 against the expected kit. If gear lags, tune site yields, then forge costs. Compare the Source share and the battles to level with stage 9's baseline.
- **Design §7 risk, the economy:** measure it, and tune its sources before the gear's costs.
- **Design "Done when":** all tests pass, the guard holds, the gear policy tracks the expected kit within a tier, and the play script has been walked (step 11).
- **Gear §6, the economy's levers in order:** site yields, rune sale prices, forge costs. The stage design names site yields, then forge costs; rune prices are not tuned here.
- **Stage 9's long baseline** (100, seed 1, `--log none`, `SOURCE_FOE_LEVEL` 6): 15 of 100 beat the Source, 85 fell; 1272 days, 46.4 battles; walked 1129.0 days (171.3 home); levels 5/10/15/20 after 6.8/28.5/54.3/— battles in 84/55/44/0 campaigns; ring win rates 7 0.956, 9 0.828, 12 0.601, 15 0.868, 18 0.75 (4 fought), 20 0.833. Far cells: bco9 1, bco12 0, fh15 0, fh18 0; `sg20-18` 28, `sg20` 71. Step 01 re-measured the long baseline on this branch (`log.md`, "Step 01").

### Contract consumed (copied unchanged from the index)

**C8. The simulator's gear policy, expected kit and record (step 09)**

```ts
// scripts/simulate.ts
export type KitRole = 'fighter' | 'archer' | 'mage'
export function kitRole(character: Character): KitRole   // its first tagged skill: melee → fighter, archery → archer, magic → mage
export interface ExpectedKit { tier: Tier; grades: readonly [Grade, Grade]; sockets: readonly [number, number]; ranks: readonly [Rank, Rank] }
export function expectedKit(role: KitRole, level: number): ExpectedKit   // gear §5.8's table, the same for every role:
//   1–4 { 1, [1, 2], [0, 0], [1, 1] }   5–8 { 2, [2, 3], [1, 2], [1, 2] }   9–12 { 3, [2, 2], [2, 3], [2, 2] }
//   13–16 { 4, [2, 3], [3, 4], [2, 3] }  17–20 { 5, [3, 3], [4, 6], [3, 4] }   (sockets: runes filled across the member's worn gear)
// CampaignRecord gains:
goldOnForging: number   // gold spent forging and tempering
kitAtLevel: Partial<Record<LevelMark, Array<{ role: KitRole; tier: number; sockets: number }>>>
//   the vanguard's members when its lowest level first reaches the mark (as battlesToLevel): main-hand tier (0 for an enchanted or no weapon)
//   and runes embedded across worn gear
// summarizeCampaigns averages them by mark and KitRole (with the campaigns reaching each mark); the printed summary gains a
//   "Kit:" line or table against expectedKit's tier and sockets, and goldOnForging in the gear line.
// visitFacilities: the gear policy of gear §5.8 steps 1 and 2 (families by role; for every member, main hand, then body armour, then shield,
//   then head, gloves, boots: buy (tiers 1–2) or forge (3–5) the highest tier affordable; then temper, modify (craftGear), fill sockets
//   (runecraftGear, fusing any rank the workshop allows)), with decision 13's details. The fighter's war hammer and the archer's crossbow
//   switches as decision 13. takeTrophies after each win (fightAt).
```

The levers this step may tune (C2, step 03; C5 of stage 9 for the sites): `FORGE_GOLD` `{ 3: 30, 4: 50, 5: 80 }`, `FORGE_MATERIAL` `{ 3: 8, 4: 10, 5: 12 }` and `temperCost` (gold tier × 10 × grade, material 4 × grade) in `src/game/crafting.ts`; the seven outer sites' amounts in `RESOURCE_YIELDS` (`src/game/territory.ts`: `ironwood_grove`, `mithril_lode`, `elder_grove`, `adamant_deep`, `wyrmwood_thicket`, `fallen_star`, `heartwood`, each 2 today).

### Decisions from the index (unchanged)

8. **Trophies this stage are data and a path, with no entries** *(settled by the user, 2026-11-23: the default)*: no wolf, wyvern, basilisk or dragon exists until stage 11, so `TROPHIES` is empty, and granting is wired (the victory screen, the simulator) and tested with an injected table. Elder Glade sells **wyvern hide** at the Market Hall as the design's stand-in; **basilisk scale and drake scale have no source in play until stage 11** (debug `stock` only), so hide tiers 4 and 5 cannot be forged in play this stage.
9. **Partners' goods** *(settled by the user, 2026-11-23: the default)*: from the Market Hall (trading post 5 and up), each **contacted partner not silent** sells its good (and Elder Glade its stand-in) at 3 gold a unit, bought into the stock in any whole amount. The design says only "for sale at the Market Hall"; silence is read as the route's rule (a silent partner pays nothing). The simulator does not buy goods (the spend order is stage 12's).
10. **Bandit gear grades by ring** *(settled by the user, 2026-11-23: the default)*: Mithril **Fine** at threats 9–11, Adamant **Fine** at 12–17, Starmetal **Masterwork** from 18 (the expected kit's grades at those levels, gear §5.8); threat 8 keeps Masterwork steel, below as today. The design gives the tiers and thresholds only.
12. **The gear policy applies families by role only from tier 3** *(settled by the user, 2026-11-23, **not** the plan's default "from tier 1, gated")*: below tier 3 the simulator keeps today's policy (in-family buying at tiers 1 and 2), so the early figure should not move. Step 09's gate stays as a check: if `one` still moves more than about 5 points from step 01's baseline, it stops and reports. Step 09's task file says so.
13. **The policy's details the design leaves open** (step 09; first values, recorded): the fighter switches to the war hammer when the lead foe (the first enemy unit) of the vanguard's next target, built at its threat, has resistance 4 or more; the archer's crossbow from tier 3; "the best body armour their strength allows" is the engineer's documented rule; fusing any rank the workshop allows (gear §5.8 step 3, which "fill sockets" needs at ranks 3–4); tier-3+ ores, woods and trophies are never sold as surplus; trophies are taken (none drop yet); no partner goods.
14. **The refactor guard** stays identical through steps 02, 03, 04 and 07 (no tier-3+ item, workshop above 3, good or bandit above threat 8 reaches the early campaign); **step 09 re-records it once** (its new record fields and the policy), with old and new figures; step 10 only for a retune the orchestrator approved. **The policy snapshot** is re-recorded in step 02 (bandits at threats 9 and up), only those lines changing.
20. **Out of scope:** market income, the simulator's spend order, the company's long-campaign policy skew and home-country spawns (stage 12); the Source's guardians stay at `SOURCE_FOE_LEVEL` 6 (stage 11); trophies from kills and `--player-kit` (stage 11); gear §5.8's step 3 ring-element wards and step 4 unique items by `gearScore`; the trading post selling tier 3+.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file; `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 04, 07, 09 and 10 run them, in that order). Measurements go through the `yomi-measure` agent. Long runs: 100 campaigns take about 10 minutes alone, up to 20 under load.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, args `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`; `GUARD_RECORDS`, `GUARD_EVENTS_SHA256`. Rules: `.claude/skills/yomi-balance/guards.md`. **Step 09 re-records it** with old and new figures in the doc comment above `GUARD_RECORDS`. Step 10 only for a retune the orchestrator approved. The levers this step may tune (the outer sites' yields, the forge and temper costs) do not reach the early campaign: if the guard moves after one, something else changed; find it.
- **The 50-campaign check** before committing a retune, against step 09's hash (`log.md`), recorded as "identical" or the diff in `log.md`:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  It must be identical after any retune of this step. If nothing was retuned, say so and need not run it.
- **The policy snapshot** (`src/engine/policies.test.ts`) is not touched by this step.
- **The early-game figure.** Stage 9 ended at `one` 288 (days 331), `company` 289, `rl10` 409, accepted by the user until stage 12 (`bands.md`). Step 01 re-measured them before any change (`log.md`). A move of more than about 5 points from step 01's figure is explained in the commit and in `src/game/CLAUDE.md`'s scaling line, or retuned; **any figure out of the user's bands, or further out than accepted, is brought to the orchestrator with options, never tuned away silently.** The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed; only "Now".
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. A retune here changes only constants.
- **Commits.** One commit once `npm test` passes and the guard holds, on `long-campaign-stage-10`, without pushing; files staged by path. Message "Stage 10 step 10: measure and judge". No attribution lines.
- **Docs.** If a lever is retuned, fix every line naming its value (`docs/reference/game.md`, `.claude/skills/yomi-balance/levers.md`, `src/game/CLAUDE.md` if it names it); the rest of the docs are step 11's.

## 3. Dependencies and prerequisites

- **Step 09** (and through it 01–04 and 07) must be done, with the orchestrator's answer if its gate stopped (decision 12). Step 08 (scenes) may run beside this step: no file overlaps but the index's table (update your row only); its in-browser tests load the machine, so ask the orchestrator for a quiet machine before the timed long run, or mark the timing as under load.
- **Step 01's baseline** is in `log.md` (`one`, `company`, `rl10`, the 50-campaign hash, the long baseline).
- **Step 09's outputs:** the new 50-campaign hash, its `one` run and the code's SHA. If no code changed since (compare `git log` from step 09's commit to `HEAD` over `src/` and `scripts/`, ignoring `src/scenes/`), reuse step 09's `one` here and say so; otherwise run it again.
- **The Kit line** (C8) is printed in the summary. If it is missing or its fields differ from C8, stop and report: do not invent a measure.
- **`yomi-measure`** is spawned per the engineer role (`.claude/roles/engineer.md`): if the spawn is refused, a `general-purpose` agent briefed with the body of `.claude/agents/yomi-measure.md`. One spawn at a time, each with a list of measures run in order; it refuses to start beside another simulation.

## 4. Scope and guidance

### 4.1 Measure, in this order

Seed 1, one run at a time, label `s10-10`. Counts 500 unless named; the long runs 100. Read every figure from the lines `running.md` names.

1. **`one`, `company`, `rl10`** (500 each, `--near-source`). Against step 01's baseline and the bands (`one` 215–250, `company` 220–260, `rl10` 370–420, heroes dead at most 2.0, days 243–297; `one` 288, `company` 289 and 331 days accepted until stage 12). Also read gold on gear, `goldOnForging`, tier-2 items bought, runes embedded, workshop and post levels at the end.
   - A move of more than about 5 points from step 01: find the cause as far as you can (step 09's gate should already have explained it; cite its record), and write it up for the commit and the scaling line.
   - **Any figure out of band or further out than accepted: stop here and report** to the orchestrator with the figures, the cause as far as you can tell, and options. Do not tune the early game in this step.
2. **`long`** (100, `--log none`), timed. From it: outcomes (Source, fallen, encampment lost, out of days) and the Source share; days; battles; walking days; final levels (lowest and highest); battles to level 5, 10, 15 and 20 and how many campaigns reached each; deaths by level; the threat table (battles and win rate at each threat, to 20); **the Kit line**: by role (fighter, archer, mage) at each mark, the mean main-hand tier and filled sockets and the campaigns reaching it, against `expectedKit` (tier 2 at 5, 3 at 10, 4 at 15, 5 at 20; sockets 1–2, 2–3, 3–4, 4–6); `goldOnForging`; gold by source; workshop and post levels at the end; run time. Compare with step 01's long baseline and stage 9's (15 of 100, 1272 days, 46.4 battles).
3. **The standard cells** (`gr3`, `bc3`, `bc4`, `bc5`, `sn5`, `sp5`, `sg7`, `sg10`, and report-only `tl5`): each should equal "Now" in `bands.md` (no cell is played with the simulator's gear policy, and no bandit below threat 9 changed). Any difference is a finding: stop and find the cause before going on.
4. **The report-only far cells** `bco9`, `bco12`, `fh15`, `fh18` (bandits now in Fine mithril at 9–11, Fine adamant at 12–17, Masterwork starmetal from 18, decision 10), and `sg20-18`, `sg20` (should equal stage 9's 28 and 71: the Source is untouched). Wins of 500, against step 01's figures where it measured them, else stage 9's. No band; record, don't tune (the far rings' foes are stage 11's).

### 4.2 Judge the kit, and tune only if gear lags

"Tracks within a tier": at every mark reached by at least 10 campaigns, each role's mean main-hand tier is at least `expectedKit`'s tier − 1. Sockets are reported against the table, not judged.

If gear lags at any such mark:
1. Find why from the long run's figures (gold on gear and forging, workshop level reached, the outer sites held, the materials held at the end, the gold by source): a short material, or short gold.
2. **Tune in the design's order**, one lever per trial, each trial a 50-campaign long run (`--campaign --battles 50 --seed 1 --log none`) read for the Kit line:
   - first the outer sites' yields (the seven `RESOURCE_YIELDS` amounts, together or the one whose material is short);
   - then the forge costs (`FORGE_GOLD`, `FORGE_MATERIAL`, then `temperCost`'s factors).
   **At most three trials**; if gear still lags, put the code back to its best trial or to the start, and stop to report with the trials' figures and options.
3. Confirm the kept retune with a 100-campaign `long` run, and run `npm test` and the 50-campaign check: both must be identical to step 09's (the far sites and the costs do not reach the early campaign; if either moves, find out why before going on).
4. Log every trial (lever, value, the Kit line, Source share, run time) in `log.md`.

Do not tune rune prices, market income, the spend order, the far nests' counts, any bandit's gear, the Source (`SOURCE_FOE_LEVEL` 6 stays, stage 11), `FOE_HP_PER_LEVEL` or the blight.

### 4.3 Runtime

Record each long run's wall time and whether the machine was quiet. If 100 long campaigns take more than about 20 minutes alone, report it to the orchestrator with the figure (stage 9's were 10:21); do not profile or optimise here.

### 4.4 Record

- `log.md`: a "Step 10" heading, then a dated table per run (measure, flags, figure, band or "report only", change from baseline, run time, log path), the long run's detail tables (battles to level, deaths by level, threat table, the Kit table against `expectedKit`), any tuning trials, and the hashes.
- This task file's execution record: the summary, the judgments, any stop-and-report and its answer, any retune.
- For step 11, a "Figures for the implementation notes" list in the execution record: the early figures against step 01; the long run against step 01 and stage 9 (Source share, days, battles, battles to level); the Kit table against `expectedKit`; gold on forging; the cells; any retune and why; the runtime.

### 4.5 Exclusions

No rule change, no new simulator flag or policy change, no scene or doc work beyond the lines a retune makes wrong, no change to a band, no tuning beyond §4.2's levers.

## 5. Verification

- Every measure of §4.1 run once, through `yomi-measure`, one at a time; their `.txt` under `logs/s10-10-*`.
- The standard cells equal "Now" (or the difference is explained); `sg20-18` and `sg20` equal stage 9's.
- The Kit line judged at each mark reached by at least 10 campaigns.
- If a lever was retuned: `npm test` passes with the refactor guard and the policy snapshot unchanged; the 50-campaign check identical to step 09's hash; a 100-campaign confirming run recorded.
- If nothing changed in code: say so; `npm test` still passes.

## 6. Completion criteria

- [ ] `one`, `company`, `rl10` measured with `--near-source`, against step 01 and the bands; any out-of-band figure brought to the orchestrator and answered.
- [ ] `long` (100) measured and timed: Source share, days, battles, battles to level, deaths by level, threat table, the Kit table against `expectedKit`, gold on forging, compared with step 01 and stage 9.
- [ ] The standard cells checked against "Now"; the far cells and the Source cells recorded.
- [ ] The kit within a tier of `expectedKit` at every mark reached by 10 campaigns or more, or the lag, its cause and up to three tuning trials (site yields, then forge costs) recorded and brought to the orchestrator.
- [ ] Figures in `log.md` and the execution record, with the list for step 11.
- [ ] One commit, "Stage 10 step 10: measure and judge", files staged by path, no attribution lines; the index's row 10 updated with status and commit.

## 7. Execution record

2026-11-23, engineer (opus), on `82a7969`. **Stopped: awaiting the user** (the orchestrator's brief: check step 09's diagnosis after §4.1; if it holds, at most one confirming trial, then report with options; change nothing).

**Measured (§4.1)**, through `yomi-measure`, one at a time, quiet machine; figures and tables in `log.md`, "Step 10".
- Early: `one` 288 (331 days, 1.2 dead), `company` 289, `rl10` 409 (533 days): wins identical to step 01, no figure further out than accepted; `rl10` days +3. `one` re-run (not reused from step 09: `scripts/simulate.ts` changed in 82a7969).
- Standard cells all equal "Now"; `sg20-18` 28 and `sg20` 71 equal stage 9; far bandits `bco9` 2, `bco12` 0, `fh15` 0, `fh18` 0 (report only).
- Long (100, 4:07, quiet): Source 1 of 100 (step 01: 15; stage 9: 15), 1414 days, 42.3 battles; battles to level 5/10/15 6.8/28.4/55.9 in 84/53/16 campaigns; 2271 gold on forging.

**Judged (§4.2)**: the kit is within a tier at 5 (1.0 vs 2) but **lags at 10** (1.0 vs 3, 53 campaigns) **and 15** (1.3–1.5 vs 4, 16 campaigns).

**Diagnosis check** (a temporary stderr trace of every home visit, reverted; `log.md`): step 09's corrected diagnosis holds. The workshop stays at level 1 in 52 of 100 campaigns for want of stone (Old Quarry held in 51 campaigns, from about day 682, mostly blighted; the post takes its 15 stone first); level 4 comes in 37 campaigns around day 1176, after the vanguards that reach 10 (around day 848) got there, and those vanguards hardly come home between 9 and 16 (13 visits in 100 campaigns). 739 of 742 forging visits arm parties at lowest level 4–6, which then wipe at threat 12.

**No trial run.** Outer-site yields act only after the workshop reaches 4 (mithril is short at level 3, but so is gold at every level-3 visit, and Mithril Lode is held at 24 of 182); forge and temper costs act only at level 4+, whose gold goes to wiped recruits. Neither can move the kit at 10, which is fixed before either applies. Nothing retuned; no code changed; `npm test` 107 files, 2,736 pass. The 50-campaign check not needed (no change).

**Options for the user** (none taken):
1. Accept the lag until stage 12 (the policy skew and spend order are its scope, decision 20); record "Done when"'s kit clause as unmet by the simulator's policy, not the economy. Touches nothing.
2. Simulator only: do not send a party whose lowest level is more than N under the target's threat (e.g. N = 3: no level-5 recruits at threat 12). Fewer wipes, gold left for the vanguard. Touches `nextTarget` (stage 12's policy skew, pulled forward); `one` and the guard meet nothing above threat 7, so they should hold, but `rl10` fights 234 battles at threat 9 and could move; needs a confirming long run and `rl10`.
3. Simulator only: forge and temper only for the vanguard (or only for a party at expected tier 3, level 9+). Saves most of the 2271 gold (232 forging visits were guards; 739 at levels 4–6), but on its own does not move the kit at 10: the workshop is not at 4 in time. Pairs with 4 or 5.
4. Simulator only: raise the workshop before the trading post in `visitFacilities` (the spend order, stage 12). Stone reaches the workshop's level 2 first in the 51 quarry campaigns; level 4 stays held by mithril and gold. May move `one`/`company` slightly (workshop 0.7 there; the post's level 2 would wait).
5. Rule change: the workshop's level-2 cost without stone (e.g. 40 gold + 15 iron or timber), or Old Quarry's yield 2 → 4. Lets the 49 quarry-less campaigns reach level 2–3, but level 4 still needs 20 mithril and 100 gold. Moves the early game: the workshop's level sets the crafting grade, and `one` ends at workshop 0.7; not measured (a trial is a change). Touches `WORKSHOP_COSTS` / `RESOURCE_YIELDS`, the refactor guard and the 50-campaign hash would likely move, and the docs and manual naming those costs.
6. Re-read the test: judge the kit only on campaigns whose workshop reached 4 before the mark, or by the day rather than the level. A measure change (C8's record), not a tuning; shows whether the forge policy itself works when the forge exists.

Recommendation: 1, with 2 + 3 as stage 12's first measured candidates (they are the cause); 5 only with an early-game measurement, since it moves the guarded figure.

### Figures for the implementation notes (step 11)
- Early: `one` 288 / 331 days, `company` 289, `rl10` 409 / 533 days: identical to step 01 in wins.
- Long: Source 1 of 100 (step 01 and stage 9: 15; step 02: 2), 1414 days (1272), 42.3 battles (46.4); to level 5/10/15: 6.8/28.4/55.9 (6.8/28.5/54.3) in 84/53/16 campaigns (84/55/44).
- Kit at 5/10/15: tier 1.0 / 1.0 / 1.3–1.5 against 2 / 3 / 4; runes 0 / 0 / 0.3–0.4 against 1–2 / 2–3 / 3–4. Gold on forging 2271 a campaign, mostly re-arming recruits.
- Cells: standard all = Now; far `bco9` 2, `bco12` 0, `fh15` 0, `fh18` 0; `sg20-18` 28, `sg20` 71.
- No retune. Runtime: 100 long campaigns 4:07 alone (stage 9: 10:21).
