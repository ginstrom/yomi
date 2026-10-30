# Step 06: The simulator's ready level and level record

- **Plan:** [index.md](index.md)
- **Source design:** [`docs/designs/long-campaign/stage-01-foe-foundations-and-bandits.md`](../../designs/long-campaign/stage-01-foe-foundations-and-bandits.md), S1-R6. Reference: [`reference/campaign-to-level-20.md`](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.7.
- **Status:** pending

## Objective

The campaign simulator can be told when the party is ready to march on the Source (`--ready-level N`). It also records and prints the levels a campaign reaches:
- each member's final level;
- the level of each hero who died;
- how many battles it took the party's lowest level to reach 5, 10, 15 and 20.

With the default ready level, every existing line of the campaign summary is unchanged. Only new lines are added.

## Requirements and context

- **S1-R6:** the simulator's `--ready-level` flag and record fields. This is the first part of the long-campaign simulator (campaign R14, §5.7). Stage 9 raises `SOURCE_READY_LEVEL` to 18. Here it stays **7**.
- **The behaviour guard.** With no `--ready-level`, campaigns must play exactly as before. `nextTarget` must take the same decisions, every RNG draw must stay in the same order, and the existing summary lines must stay identical. The new record fields only observe.
- **Why the record matters:** later stages judge pacing by levels reached and battles to level (stage 9, stage 12). The deaths by level feed the company design (stage 6).

### Contract C9 (copied from index.md, unchanged)

- **`CliArgs`** gains `readyLevel: number`, a positive integer that defaults to `SOURCE_READY_LEVEL` (existing, 7). It is parsed from `--ready-level`, and is refused without `--campaign`, with a message naming the flag.
- **`nextTarget(world, party, readyLevel = SOURCE_READY_LEVEL)`**: the Source is chosen once every member has `readyLevel`, or nothing else is left.
- **`CampaignRecord`** gains:

  ```ts
  /** Each member's level when the campaign ended. */
  finalLevels: number[]
  /** The level of each hero who died, in the order they fell. */
  deathsAtLevel: number[]
  /** For 5, 10, 15 and 20: how many battles had been fought when the party's lowest level first reached it; absent if never. */
  battlesToLevel: Partial<Record<5 | 10 | 15 | 20, number>>
  ```

- **`CampaignSummary`** and the printed summary gain:
  - the average lowest and highest final level;
  - the levels heroes died at, with counts;
  - for each of 5, 10, 15 and 20, the average battles to reach it and how many campaigns did.

## Dependencies and prerequisites

- **Depends on:** none. It may run in parallel with steps 01 and 02. If they run together, commit step 01 first: the guard here is cleaner on a tree where step 01 is already proven identical.
- **Touches only:** `scripts/simulate.ts`, `scripts/simulate.test.ts` and `CLAUDE.md`. It must not touch `src/`.
- **Environment:**
  - The simulator runs only in podman: `make -s simulate ARGS="..."`. The local Node 22 cannot run `scripts/simulate.ts`.
  - `npx vitest run --project domain scripts/simulate.test.ts` does run locally for quick checks.
  - Two `make simulate` commands must never run at the same time: both build the same image, and the loser prints nothing. Run the before and after runs one after the other.
  - Logs go under `logs/` (gitignored). Use `--out logs/<name>.jsonl` to keep runs apart.

## Scope and implementation guidance

The inspected code is in `scripts/simulate.ts` at `9c740ae`.

**1. `CliArgs` and `parseArgs`.**
- Add `readyLevel` to `CliArgs`, with a doc comment, defaulting to `SOURCE_READY_LEVEL` in `parseArgs`'s initial object.
- Add a `case '--ready-level'` using the existing `positiveInt(flag, value())`.
- After the loop, beside the existing `SINGLE_BATTLE_FLAGS` refusal, add the reverse rule: `--ready-level` without `--campaign` throws, naming `--ready-level` and saying it applies only to `--campaign`.
- Update the usage comment at the top of the file to list `[--ready-level 7]` beside `[--campaign]`.

**2. `nextTarget`.** Its signature becomes `nextTarget(world, party, readyLevel = SOURCE_READY_LEVEL)`, and it compares `lowestLevel(party) >= readyLevel` where it now compares `SOURCE_READY_LEVEL`. Its doc comment names the parameter. `runCampaign` passes `args.readyLevel`. With the default, the decisions are the same.

**3. `CampaignRecord` and `runCampaign`.**
- Add the three fields, with the doc comments of C9. Initialise them in `runCampaign`'s `record` literal: `finalLevels: []`, `deathsAtLevel: []`, `battlesToLevel: {}`.
- **Deaths:** where `runCampaign` now does `record.deaths += rewardVictory(party, xpReward(encounter), game.baggage).dead.length`, keep the reward in a variable. Push each dead member's `level` onto `deathsAtLevel`, in the order `dead` lists them, and keep adding `dead.length` to `deaths`. The fallen are `Character`s, so their `level` is read directly. Take it before anything else changes them; `rewardVictory` buries the fallen before granting experience, so the dead keep their level.
- **Battles to level:** after `autoAdvance` has run for the survivors of a won battle, for each of 5, 10, 15 and 20 that `lowestLevel(party)` has reached and `battlesToLevel` has no entry for yet, record `battles.length` (the battles fought so far, this one included). A party that starts at or above a mark records it at the first battle won.
- **Final levels:** in `finish(outcome)`, set `record.finalLevels = party.map((member) => member.level)`. On a `'fallen'` outcome the dead are already gone from the party, so the list holds the members left.
- The `partyLevels` meta on `battle_start` is unchanged.

**4. `CampaignSummary` and `summarizeCampaigns`.**
- Add these fields, each with a doc comment:
  - `avgLowestFinalLevel` and `avgHighestFinalLevel`. A campaign whose `finalLevels` is empty is left out of these averages.
  - `deathsByLevel: Array<{ level: number; deaths: number }>`, in rising level, only levels that occurred.
  - `toLevel: Array<{ level: 5 | 10 | 15 | 20; campaigns: number; avgBattles: number }>`. `avgBattles` is averaged over the campaigns that reached the level. A level no campaign reached has `campaigns: 0` and `avgBattles: 0`.
- The names are routine choices if they read better, but they must be exported on `CampaignSummary` so the test can read them.

**5. `main()`.** Print new lines after the existing "Hit points healed…" line and before the threat table. Leave every existing line's text unchanged. For example:

```
Levels at the end: lowest 6.8, highest 7.4 on average; heroes died at level 3 (120), 4 (210), 5 (95)
Battles to level 5: 9.1 (500 campaigns); 10: — (0); 15: — (0); 20: — (0)
```

The exact wording is the implementer's. It must say the averages, the death counts by level, and battles to each mark with the number of campaigns that reached it.

**6. `CLAUDE.md`.** In the Commands section's simulator paragraphs:
- Add `--ready-level` to the flags sentence: the level every member must reach before the party marches on the Source, default `SOURCE_READY_LEVEL` (7), campaign only.
- In the `--campaign` paragraph:
  - say `nextTarget` marches on the Source once every member has the ready level (it names `SOURCE_READY_LEVEL` (7) now);
  - add to the list of what it prints: the final levels, the levels heroes died at, and the battles to levels 5, 10, 15 and 20.

  Keep the paragraph's style. Do not touch the rules of scaling; step 07 does that.

**Exclusions:**
- No change to `SOURCE_READY_LEVEL`'s value, to `MAX_CAMPAIGN_DAYS`, or to campaign behaviour.
- No new flags beyond `--ready-level`.
- `--log none` is stage 9's.

## Verification

**Unit tests** (`scripts/simulate.test.ts`, which already has `describe('parseArgs')`, `describe('a campaign')` and `describe('nextTarget')`):
1. **`parseArgs`:**
   - `--campaign --ready-level 10` gives `readyLevel: 10`;
   - no flag gives `SOURCE_READY_LEVEL`;
   - `--ready-level 10` alone throws, naming `--ready-level`;
   - `--ready-level 0` and `--ready-level x` throw (`positiveInt`).
2. **`nextTarget`:** a world and party that do not march on the Source at the default when members are below 7 *do* march when `readyLevel` is the party's lowest level. A party at 7 does not march when `readyLevel` is 8 and nests remain. Reuse the existing "marches on the Source once every member is ready" fixture.
3. **A campaign:** a short seeded `runCampaign` gives these, in a test written first and seen to fail:
   - `finalLevels` with one entry per member left at the end, equal to their levels;
   - `deathsAtLevel.length === record.deaths`;
   - `battlesToLevel[5]` between 1 and `record.battles` when the lowest level reached 5, and absent otherwise.
4. **`summarizeCampaigns`:** given two hand-made records, it gives the averages, `deathsByLevel` and `toLevel` described above, including a mark no campaign reached.

**Commands:**
- `npm run -s typecheck` and `npx vitest run --project domain scripts/simulate.test.ts` locally while working.
- `make test` (the full suite, in podman) before committing. It must pass.

**The behaviour guard** (required, one run after the other):
1. Before the change, on the parent commit: `make -s simulate ARGS="--campaign --battles 500 --seed 1 --out logs/before.jsonl" > logs/before.txt`.
2. After: `make -s simulate ARGS="--campaign --battles 500 --seed 1 --out logs/after.jsonl" > logs/after.txt`.
3. `diff logs/before.txt logs/after.txt`. The only differences are the added lines, with every existing line identical, including "Beat the Source: … of 500" and the threat table. Strip podman's image build lines from both files first if they appear: lines starting `STEP`, `-->`, `COMMIT`, `Successfully`, or a 64-hex id.

**A smoke check:**
- Run `make -s simulate ARGS="--campaign --ready-level 10 --battles 500 --seed 1 --out logs/ready10.jsonl"` once, after the guard.
- Note in the completion record: the Source share, the average days and battles, the average lowest and highest final level, and battles to level 5 and 10.
- Expect the party to march later, at a lowest level of 10 or more. It may run out of nests first and march anyway ("or nothing else is left").
- This is a record, not a gate.

## Completion criteria

- [ ] `--ready-level` is parsed, defaults to 7, is refused without `--campaign`, and is used by `nextTarget`.
- [ ] `CampaignRecord` has `finalLevels`, `deathsAtLevel` and `battlesToLevel` as in C9. `CampaignSummary` and the printed summary show them.
- [ ] The new unit tests were written first, seen to fail, and now pass. `make test` passes.
- [ ] The guard diff shows only added lines.
- [ ] The `--ready-level 10` figures are recorded below.
- [ ] CLAUDE.md's simulator paragraphs mention `--ready-level` and the new summary lines.
- [ ] Committed on the current branch (not pushed), with the message ending in the repo's `Co-Authored-By` attribution line. The index's step 06 status is set to `done`, with a completion note here.

## Completion record

_(For the implementer: the commit, the guard diff result, and the `--ready-level 10` figures.)_
