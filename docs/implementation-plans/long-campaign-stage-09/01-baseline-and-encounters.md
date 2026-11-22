# Step 01: Baseline and the far encounters

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-09-outer-rings.md) (§2 "The rings", the nests table, "Rune loot"; §5 "Performance"; §6 Simulator 1) · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §4.1, §5.3, §5.5 (bandits) · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.2 (tiers by ring), §4.5 (rune loot) · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard") · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) adds two encounters, widens three bands and adds loot rows whose draws must keep today's RNG order exactly for every threat the map has today, and re-records the policy snapshot only where the change is meant. The reviewer (opus) checks that the refactor guard and the 50-campaign check are byte for byte the baseline, and that the snapshot's old lines are unchanged.

## 1. Objective

- Measure the stage's baseline before any change: `one`, `company` and `rl10` (500 campaigns, seed 1, today's flags, through `yomi-measure`), the 50-campaign check's hash, and the world's cost a day with a new committed script, `scripts/dayCost.ts`.
- Then build C1: the Bandit Company (threats 8–13) and the Freebooter Host (14–20) from existing bandit kinds; the Spider Nest widened to 4–9 and the Salamander Pool to 5–9; the Source Guardians' band 1–20; bandit gear by threat (Masterwork steel from 8); rune loot's full table; and `SOURCE_THREAT`.
- None of it is on today's map, so play does not move: the refactor guard and the 50-campaign check stay identical. The policy snapshot gains lines for the new (encounter, threat) pairs and is re-recorded once.

## 2. Requirements and context

- **Design §2, the nests table:** Bandit Camp 3–7, counts extended to 4 at 6 and 7 (already so: no change); Bandit Company (new) 8–13, 4 foes; Freebooter Host (new) 14–20, 4–5 with a Captain; Spider Nest widened to 4–9; Salamander Pool widened to 5–9. "Bandit gear tiers by ring: steel from threat 7. Higher tiers wait for stage 10, so until then far bandits wear Masterwork steel."
- **Design §2, the Source's Guardians** at threat 20, with a provisional block: the Horror and its guard scaled by native level 1 rules, clamped (to be replaced in stage 11). Retuning it to "winnable" is step 09's, not this step's.
- **Design §2, rune loot** uses the full table, up to the Source's row (gear §4.5). Ranks 3 and 4 found can't be fused into until stage 10 but can be embedded (the fuse refusal already says so: `FUSE_LEVELS` in `runecraft.ts`; no change).
- **Gear §4.5's table:** threats 1–3, 0–1 rune (50%), rank 1; 4–7, 1, rank 1 (70%) or 2; 9–12, 1–2, rank 2 (60%) or 3; 15–18, 2, ranks 2, 3 (60%), 4 (15%); the Source, 3, ranks 3 and 4.
- **Design §5, performance:** about 4.2× the hexes; measure `advanceDay` per day before and after. This step measures "before"; step 08 "after".
- **Stages index, the early-game guard:** the figure is re-measured at the start of each stage.

### Decisions from the index this step applies (unchanged)

3. **The Source's band is 1 to 20**, with today's counts at 1 to 5 and 5 foes (every slot) at 6 to 20, so the near Source and the `SG7`, `SG10` cells (threat 5) fight as today and the Source at 20 fields the Horror and its four guards at level 20 (design: "native level 1 rules, clamped" read as the encounter's level clamped to its band). Step 09 may lower the count at 20 to make it winnable, which the design allows; nothing else about the Source is tuned.
5. **Bandit gear** *(for the user's eye)*: Masterwork steel (tier 2, grade 3) from threat 8; Fine steel at 6 and 7 as today; below as today. The design's "steel from threat 7" already holds, and "far bandits wear Masterwork steel" is read as the rings whose proper tier (gear §4.2: tier 3 from threat 9) waits for stage 10.
6. **Counts for the widened bands** (the design gives none; first values, measured as report-only cells in step 09): Spider Nest 3 at threat 4, 4 at 5 to 9 (it has four slots); Salamander Pool 3 at 5 to 9 (three slots); Bandit Company 4 at 8 to 13; Freebooter Host 4 at 14 to 16 and 5 at 17 to 20. The Bandit Camp already fields 4 at 6 and 7, as the design asks: no change.
7. **Rune loot rows** *(for the user's eye)*, gear §4.5 read as: threats 9–13, one rune and a second at 50%, each rank 2 at 60% else 3; 14–19, two, each rank 4 at 15%, 3 at 60%, else 2; 20 and up (the Source), three, each rank 3 at 50% else 4. Threats up to 8 draw exactly as today. The rows go by threat, so the near Source (threat 5) rolls today's row.
12. **The policy snapshot is re-recorded in step 01**: it iterates every encounter over its band, so the new encounters and widened bands add lines; the lines of today's (encounter, threat) pairs must be unchanged.
14. **`SOURCE_THREAT` lives in `worldMap.ts`** (reference §5.1), added in step 01 for the loot rows; `loot.ts` reads it only inside `rollRunes` (the import cycle rule).

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). **Never run two simulations at once.** Measurements go through the `yomi-measure` agent where a step says so.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, each `CampaignRecord` and a SHA-256 of every battle event, against `GUARD_RECORDS`. Rules: `.claude/skills/yomi-balance/guards.md`. **This step must not edit the fixture** and keeps it green; a mismatch means the step changed play: find the cause and fix it.
- **The 50-campaign check** before committing, against the hash taken before the step, recorded as "identical" or the diff in `log.md`; this step uses the command from before `--near-source` exists, and must be identical:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **The policy snapshot** (`src/engine/policies.test.ts`, "the choices of today's encounters"): re-recorded in step 01 only (decision 12), and in step 09 if the Source's count at 20 changes.
- **The early-game figure.** Stage 8 ended at 233 of 500 (`--parties 1`) and 232 (company), `rl10` 433. **Step 01 re-measures `one`, `company` and `rl10` before any change**: the stage's baseline. The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG except where play is meant to move (steps 04, 05). Rune loot draws from its own stream (`lootRng`), and for threats up to 8 its draws are today's, in today's order.
- **Import cycles.** `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts` import one another; `loot.ts` gains an import of `worldMap.ts`. Nothing may call across, or read an imported `const` into a top-level table, at module load.
- **Versions.** `SAVE_VERSION` is untouched here (step 04 bumps it). `LOG_SCHEMA_VERSION` unchanged: no battle event changes shape (new encounter ids in `battle_start`'s meta are not a shape change).
- **Content.** `.claude/skills/yomi-add-content/encounter.md` for the two encounters. No new foe kind, location kind, item or rune. Balance: `.claude/skills/yomi-balance/` (`guards.md`, `running.md`).
- **Commits.** One commit for this step once `npm test` passes and the guard holds, on `long-campaign-stage-09`, without pushing; files staged by path. Message "Stage 9 step 01: baseline and the far encounters". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines this change makes wrong and search the CLAUDE.md files, `.claude/` and `docs/reference/` for every name changed. `src/game/CLAUDE.md` is at 7,977 bytes of its 8 KB cap (`scripts/claudeMd.test.ts`): add nothing there in this step (detail goes to `docs/reference/game.md`); step 04 makes room.

## 3. Dependencies and prerequisites

- None. This is the stage's first step, on `long-campaign-stage-09` at `08854d3`.
- Step 03 (the Routes tab) and step 06 (sprites) may run beside it; they touch no file this step touches.

### Contract produced (copied unchanged from the index)

**C1. The far encounters, bandit gear and rune loot (step 01)**

```ts
// src/game/encounters.ts
export function banditCompany(party: readonly Fighter[], threat = 8): Encounter
export function freebooterHost(party: readonly Fighter[], threat = 14): Encounter
// ENCOUNTERS gains bandit_company and freebooter_host, after salamander_pool, so EncounterId gains them.
// ENCOUNTER_BANDS / ENCOUNTER_COUNTS, from each definition (counts from band.min up):
//   goblin_raid, kobold_scouts, hobgoblin_warband, troll_lair  { 1, 5 }   [2, 3, 3, 3, 4]          unchanged
//   bandit_camp      { 3, 7 }   [2, 2, 2, 4, 4]                                                   unchanged
//   spider_nest      { 4, 9 }   [3, 4, 4, 4, 4, 4]                                                threat 5 unchanged
//   salamander_pool  { 5, 9 }   [3, 3, 3, 3, 3]                                                   threat 5 unchanged
//   bandit_company   { 8, 13 }  [4, 4, 4, 4, 4, 4]
//   freebooter_host  { 14, 20 } [4, 4, 4, 5, 5, 5, 5]
//   source_guardians { 1, 20 }  [2, 3, 3, 3, 4, then 5 at each of 6 to 20]                       threats 1–5 unchanged
// Slots (existing bandit kinds; no new FoeKind; names are the implementer's to polish):
//   BANDIT_COMPANY_SLOTS:  sergeant (bandit_brute), crossbowman (bandit_crossbowman), mage (bandit_mage), archer (bandit_archer), cutthroat (bandit_cutthroat)
//   FREEBOOTER_HOST_SLOTS: captain (bandit_captain, 'Freebooter Captain'), brute (bandit_brute), crossbowman, mage, archer
// MAX_THREAT stays until step 04.

// src/game/bandits.ts
export function banditGear(threat: number): BanditGear
//   threat >= 8: { tier: 2, grade: 3 } (Masterwork steel); 6–7: { tier: 2, grade: 2 }; 4: { tier: 1, grade: 1 }; else { tier: 1, grade: 2 }

// src/game/worldMap.ts
export const SOURCE_THREAT = 20   // the Source's threat; on the map from step 04

// src/game/loot.ts: rollRunes(threat, encounter, rng), by row; each rune draws its kind (the favoured one at FAVOURED_CHANCE, else uniform) and then its rank:
//   threat <= 3:            unchanged (0 or 1 rune, rank 1)
//   4 to 8:                 unchanged (1 rune; rank 1 at 70%, else 2)
//   9 to 13:                1 rune, and a second at 50% (drawn first); each rank 2 at 60%, else 3
//   14 to SOURCE_THREAT-1:  2 runes; each rank 4 at 15%, rank 3 at 60%, else 2 (one draw: < 0.15 → 4, < 0.75 → 3, else 2)
//   >= SOURCE_THREAT:       3 runes; each rank 3 at 50%, else 4
// For threats up to 8 every draw is today's, in today's order. SOURCE_THREAT is read inside rollRunes only.

// scripts/dayCost.ts (new, committed; step 08 reruns it): `node scripts/dayCost.ts [--days N] [--seed S]` prints the ms a day of
//   passTurn and of advanceDay over N days (default 1000) of newWorld(seed) with the ready-made party at home
```

Consumed later: step 02 (`SOURCE_THREAT` is not yet used by the map), step 04 (`SPAWN_KINDS` gains the new encounters with `fromThreat: 7`; the Source placed at `SOURCE_THREAT`), step 05 (fixed nests of the new encounters), step 09 (the new cells, and the Source's count at 20).

### Existing code (inspected at `08854d3`)

- **`src/game/encounters.ts`:** `EncounterDef { slots, band, counts }` and `encounter()` (the level is the threat clamped to the band; the foes are the slots whose `fromThreat` the level reaches, cut to `counts[level - band.min]`; it throws if `counts.length` is not the band's width). `TODAY = { band: { min: 1, max: 5 }, counts: [2, 3, 3, 3, 4] }` is shared by goblin_raid, kobold_scouts, hobgoblin_warband, troll_lair and source_guardians: give the Source its own definition (`{ min: 1, max: 20 }`, counts `[2, 3, 3, 3, 4, ...Array(15).fill(5)]`); its slots (horror, brute, shaman, sneak, cutter) are five. `SPIDER_NEST` is `{ min: 5, max: 5 }, [4]` (slots spider, sneak, spider2, spider3); `SALAMANDER_POOL` `{ min: 5, max: 5 }, [3]` (salamander, kobold, kobold2); `BANDIT_CAMP` `{ min: 3, max: 7 }, [2, 2, 2, 4, 4]` and its slots (captain; archer from 5; mage from 4; crossbowman from 6; brute; cutthroat), with their board positions (`at`) on the 12 × 9 `BOARD` (foes at columns 8 and 9; the party's start hexes `PARTY_START` must stay free). `ENCOUNTERS`, `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS` are full records (tsc catches a miss). `foeStats` builds a bandit by `banditStats(BANDIT_ROLE[kind], level, banditGear(level))`. `FOE_XP` of every bandit kind is 100. `MAX_THREAT = 5` stays (step 04 removes it). The doc comments of `spiderNest`, `salamanderPool`, `banditCamp` and the Source's say "threat 5 only" or "stage 9": correct them.
- **`src/game/bandits.ts`:** `banditGear(threat)` returns `threat >= 6 ? { tier: 2, grade: 2 } : threat === 4 ? { tier: 1, grade: 1 } : { tier: 1, grade: 2 }`; grades are 1 plain, 2 Fine, 3 Masterwork (`src/inventory/grades.ts`). `banditStats` caches by (role, level, tier, grade); check that `equipmentFor` builds tier-2 grade-3 gear for every role and that a bandit levels to 20 (`levelUp`, `autoAdvance`) without error.
- **`src/game/loot.ts`:** `rollRunes(threat, encounter, rng)`: `low = threat <= 3`; if low and `rng() >= 0.5`, none; then the kind (`FAVOURED_RUNES[encounter]` at `FAVOURED_CHANCE`, else `RUNE_IDS[floor(rng() * length)]`); then `rank = low || rng() < 0.7 ? 1 : 2`. The doc comment says the rows past 7 and the Source's wait for stage 9: rewrite it. `takeRunes` is called by `BattleScene.ts` and `scripts/simulate.ts` with the battle's threat; no caller changes. Tests in `src/game/loot.test.ts`.
- **`src/game/worldMap.ts`:** imports `MAX_THREAT` from `encounters.ts`; `threatAt` is unchanged in this step. Add `SOURCE_THREAT` near `SOURCE_ID`, unused by the map until step 04.
- **`src/engine/policies.test.ts`** (~1092): the snapshot loops `Object.keys(ENCOUNTERS)` over each band's threats, levels the ready-made party to the threat, plays 3 seeds × up to 8 rounds, and asserts `lines.length` (5439) and a SHA-256, with a 60 s timeout. Its describe title lists each re-recording and why.
- **`scripts/simulate.ts`** has no `--log none` yet (step 02); the default `--ready-level` is 7, so today's flags for the bands are `one` = `--campaign --parties 1`, `company` = `--campaign`, `rl10` = `--campaign --ready-level 10` (`.claude/skills/yomi-balance/bands.md`, "Measure names").
- `passTurn(world, presences)` (`worldMap.ts`) is `advanceDay` + `updateTerritory` + `updateSight`; `advanceDay(world, presences)` is in `blight.ts`; `presences(game.parties)` (`expedition.ts`); `newGame()` (`gameState.ts`) builds the ready-made party at home on `newWorld(seed)`.

## 4. Scope and guidance

1. **Baseline first, before any code change.** On the branch as it stands:
   - Run the 50-campaign check (command above) and record its SHA-256 and "N of 50".
   - Through the `yomi-measure` agent (`.claude/agents/yomi-measure.md`; the engineer profile allows it), measures `one`, `company`, `rl10` by their names in `bands.md`, 500 campaigns, seed 1, label `s9-base`, one at a time (`rl10` passes 9 minutes and runs detached, as the agent says). If the spawn is refused, brief a `general-purpose` agent with the agent file's body, as `.claude/roles/engineer.md` says.
   - Record in `log.md` under "Step 01: the stage's baseline": a table like stage 8's (run, flags, Source wins, mean days, battles, heroes dead, gold by source), the hash, the head SHA, and each run's wall time (step 08 compares runtimes against them).
2. **`scripts/dayCost.ts`** (new, committed, a measuring tool, no test needed beyond `tsc`): `node scripts/dayCost.ts [--days N] [--seed S]` (defaults 1000 and 1) builds `newGame(undefined, null, seed)` (the ready-made party at the encampment), then times N days of `passTurn(world, presences(game.parties))`, and, on a second fresh world from the same seed, N days of `advanceDay` alone; it prints ms a day for each (and the board's size and the monster locations at the end, so step 08 can read like with like). It draws nothing beyond what those calls draw, and writes no file. Run it before any change (three runs; record the median) in `log.md`. Keep it small; step 08 reruns it on the new map.
3. **The two encounters** (C1, `encounter.md`'s checklist): `BANDIT_COMPANY_SLOTS` and `FREEBOOTER_HOST_SLOTS` with board positions as the Bandit Camp's slots use (columns 8 and 9, five distinct hexes clear of `PARTY_START`), their `EncounterDef`s, `banditCompany` and `freebooterHost` with doc comments, and their entries in `ENCOUNTERS`, `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS` (after `salamander_pool`). Do **not** add them to `SPAWN_KINDS` (step 04 does, with `fromThreat: 7`). Names: the Freebooter's lead is "Freebooter Captain"; the others are yours (for example "Bandit Sergeant").
4. **The widened bands** (decision 6): Spider Nest `{ 4, 9 }` `[3, 4, 4, 4, 4, 4]`, Salamander Pool `{ 5, 9 }` `[3, 3, 3, 3, 3]`, the Source Guardians `{ 1, 20 }` with today's counts at 1–5 and 5 at 6–20 (decision 3). The fights at threat 5 (the fixed nests, the near Source, the `SN5`, `SP5`, `SG7`, `SG10` cells) must field exactly today's foes.
5. **Bandit gear** (decision 5): `banditGear` as C1, its doc comment updated (it still names "the outer rings bring" Fine steel from 6).
6. **`SOURCE_THREAT`** in `worldMap.ts`, exported, with a one-line doc comment.
7. **Rune loot rows** (decision 7): restructure `rollRunes` by row as C1. Rows ≤ 8 keep today's code path and draw order exactly. For the new rows, for each rune draw the kind as today (favoured, then uniform) and then its rank; for 9–13 draw the second-rune chance first. Import `SOURCE_THREAT` from `worldMap.ts` and read it only inside the function. Update the module's doc comment.
8. **Tests:**
   - `encounters.test.ts`: each new encounter builds at every threat of its band with its count of foes, each foe at the threat's level and of the slot kinds C1 names; levels below and above the band clamp to it; today's five encounters' bands and counts unchanged; the Source at 20 fields its five slots at level 20, at 5 the same four as today; the Spider Nest at 4 fields 3 and at 9 four, the Salamander Pool 3 at 9; `xpReward` grows with threat for the new encounters. Tests that loop `1..MAX_THREAT` over "every encounter" must not start looping the new ones' bands by accident; check each.
   - `bandits.test.ts`: `banditGear` at 3, 4, 5, 6, 7, 8, 13, 20; a bandit of each role builds at level 20 in Masterwork steel.
   - `loot.test.ts`: for threats 1, 3, 4, 5, 7 and 8, a recorded sequence of draws (a scripted RNG, or `lootRng` of a few fixed seeds) gives exactly today's runes (write the expectations against the code before the change, so they prove nothing moved); the new rows' counts and ranks at their boundaries (9, 13, 14, 19, 20) with a scripted RNG; the favoured kind still applies in the new rows.
9. **Re-record the policy snapshot** (decision 12). Before the change, save the snapshot's `lines` (for example to a scratch file outside the repository); after it, check that every line of today's (encounter, threat) pairs is present, in order and unchanged (the old lines are a subsequence of the new: today's encounters come first in `ENCOUNTERS` and the widened bands add threats around today's), then update the count and the hash, and add to the describe's title "and in long-campaign stage 9 step 01, when the Bandit Company and Freebooter Host came and the Spider Nest's, Salamander Pool's and Source's bands widened". Record in the execution record the old and new line counts and how the subset was checked. The snapshot now levels the party to 20: if the test passes 60 s, raise its timeout (say by how much and why) rather than sample fewer threats.
10. **The refactor guard and the 50-campaign check** after the change: both identical to the baseline (nothing here is on the map, and the Source fights at 5). If either moves, stop and find why before committing.
11. **Docs.** `docs/reference/game.md` (encounters and bands, bandit gear by threat, rune loot rows); `.claude/skills/yomi-balance/levers.md` only where a statement becomes wrong; the comments in code. Not `src/game/CLAUDE.md` (at its cap; nothing here needs a rule there).
12. **Exclusions:** no map, ring, spawn or blight change; no simulator flag; no change to `SPAWN_KINDS`, `threatAt` or `MAX_THREAT`; no retuning; no change to the bands.

## 5. Verification

- `npm test` passes, with the new tests of §4.8 and the re-recorded policy snapshot.
- `npx vitest run src/game/encounters.test.ts src/game/bandits.test.ts src/game/loot.test.ts src/engine/policies.test.ts` pass.
- `npx vitest run scripts/simulate.test.ts -t "refactor guard"` passes with `GUARD_RECORDS` untouched.
- The 50-campaign check's hash after equals the baseline's (record both).
- `node scripts/dayCost.ts` runs and prints ms a day (record the before figures).
- The baseline table, hash, timings and day cost are in `log.md`.

## 6. Completion criteria

- [ ] Baseline recorded in `log.md`: `one`, `company`, `rl10` (500, seed 1, with wall times), the 50-campaign hash, the day cost before.
- [ ] `scripts/dayCost.ts` committed.
- [ ] C1 built: `banditCompany`, `freebooterHost` and their entries; the widened bands and counts; the Source's band 1–20; `banditGear`; `SOURCE_THREAT`; `rollRunes` rows.
- [ ] Tests of §4.8 pass; the policy snapshot re-recorded with today's lines shown unchanged.
- [ ] Refactor guard and 50-campaign check identical to the baseline.
- [ ] `docs/reference/game.md` current; no change to `src/game/CLAUDE.md`.
- [ ] One commit, "Stage 9 step 01: baseline and the far encounters", files staged by path, no attribution lines; the index's row 01 updated with status and commit.

## 7. Execution record

- **Baseline** (before any source change, at `5664289`): `one` 233, `company` 232, `rl10` 433 of 500 (out of band by 13, under the accepted 445, unchanged from "Now"); 50-campaign check 22 of 50, SHA-256 `b50f7b50…db904e52`; day cost `passTurn` 0.666 ms, `advanceDay` 0.628 ms a day (median of three). Table, wall times and logs in [`log.md`](log.md). `company` and `rl10` ran in a temporary clean worktree detached at `5664289` (removed after; logs in `logs/`) so this step's edits could not leak into them; `one` started before any source edit. Wall times are upper bounds (other work ran beside them).
- **Built:** C1 as written. `banditCompany` (Bandit Sergeant, Company Crossbowman, Company Hedge-Mage, Company Archer, Company Cutthroat) and `freebooterHost` (Freebooter Captain, Brute, Crossbowman, Hedge-Mage, Archer), hexes in columns 8 and 9 as the camp's; the Source's own `EncounterDef` (1–20); Spider Nest 4–9, Salamander Pool 5–9; `banditGear` Masterwork from 8; `SOURCE_THREAT` in `worldMap.ts`; `rollRunes` by row (helpers `runeKind`, `runes`), `SOURCE_THREAT` read inside the function only; `scripts/dayCost.ts`.
- **Tests** (written red first): `loot.test.ts` holds a SHA-256 of 500 seeds × 3 encounters of rolls and draw counts at threats 1, 3, 4, 5, 7, 8, recorded on the code before the change; scripted-draw tests of the new rows at 9, 13, 14, 19, 20, 21; favoured kind in the far rows. `bandits.test.ts`: `banditGear` at 3–8, 13, 20; every role at level 20 in Masterwork equals a hero built the same way. `encounters.test.ts`: the two new encounters (registration, counts and kinds at every threat, gear, hexes, clamping, xp), the Source at 5 and 20, the widened bands.
- **Deliberate test changes:** the loot test "from threat 4" looped [4, 5, 7, 9]; 9 is now a new row, so it loops [4, 5, 7, 8]. The generic "fields more at the top than at the bottom" check skips bands whose counts are flat by design (Salamander Pool 3s, Bandit Company 4s; decision 6). The bands test's `today` list became explicit (the five pre-bandit encounters), since filtering out three ids would have swept in the new ones; the Source's band and the clamp checks use each band's own top. `encountersFor` expectations extended to 21.
- **Policy snapshot:** 5439 → 14096 lines, hash `230ecb27…cb1f71`; old lines checked as an unchanged, in-order subsequence (script over the dumped lines, before and after, kept outside the repository). It runs in about 19 s, so the 60 s timeout stays.
- **Verification:** `npm test` 102 files, 2576 tests passed; the four named test files pass; `npx vitest run scripts/simulate.test.ts -t "refactor guard"` passes, fixture untouched; 50-campaign check identical; `npm run build` passes; `node scripts/dayCost.ts` runs.
- **Pre-existing failure, fixed here at the orchestrator's request:** `scripts/records.test.ts` failed at `5664289` because `index.md` was 34,741 bytes (cap 32,000). Trimmed to about 27,500: the bodies of C1, C2, C4 and C5 became summaries pointing at the task files, which hold each verbatim (checked by script: every copy in every task file was identical to the index's text before the cut). No decision, contract or constraint was dropped. Open question 1 marked answered (`--near-source`), decisions 4, 5, 7 and 8 marked accepted, and step 02's row unblocked (pending).
- **Docs:** `docs/reference/game.md` (encounters, bands and counts, bandit gear, rune rows), `docs/reference/simulator.md` (the Spider Nest's threat 5 only is now today's map's, not its band). `levers.md` needed no change; `src/game/CLAUDE.md` untouched. The manual describes today's map only and is unchanged (step 10).
- **For later steps:** nothing on today's map uses the new encounters or rows; `SPAWN_KINDS` is untouched (step 04 adds `fromThreat: 7`). Step 08: rerun `scripts/dayCost.ts` (three runs, median) and compare against the figures above.
