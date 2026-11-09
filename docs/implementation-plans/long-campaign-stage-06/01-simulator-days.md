# Step 01: The simulator's days on the loop

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-06-multiple-parties.md) (S6-R7) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §5.3, §5.5 · [Feature record](../../features/long-campaign-stage-06.md) ("Stage-5 hazards to start from", items 3 and 4)

**Difficulty:** opus / opus. Leave the engineer's and the reviewer's model unset. The step moves the simulator's one-day acts from "pass a day now, mid-decision" to "a day order run by the next `advance`", which must leave the 5-campaign guard and the 50-campaign log byte for byte the same. The order of days, decisions and RNG draws is easy to disturb.

## 1. Objective

Clear the stage-5 simulator hazards before any second party exists, without changing play:
- **Measure the stage's baseline** before any change: the 500-campaign figure (expected 230 of 500) and the 50-campaign summary and log hash.
- **A shared `startTravel`** in `company.ts`, used by `worldMap.travel` and by the simulator's `carryOut`, replacing the mirror between the two.
- **`orderAction`**: `act`'s checks without the day. `act` becomes `orderAction` then `passDay`.
- **The simulator's acts as day orders**: a `{ kind: 'act' }` decision gives the party a day order and lets the next `advance` run it, together with every other party's day. A field craft is chosen up front (`fieldCraft`) and runs the same way.
- **The vanguard in the run**: `CampaignRun.vanguard`; `finishCampaign` reads the vanguard's members, and `socketsFilled` counts every party.
- **`campDays` counted once** per day on which any party camped.

## 2. Requirements and context

- **Stage-5 hazard 3:** the simulator runs a one-day act while deciding for one party, so with two parties it would pass a day for both while deciding for one; `finishCampaign` reads `parties[0]`; `campDays` double-counts with two campers.
- **Stage-5 hazard 4:** `carryOut`'s travel branch mirrors `worldMap.travel`'s start-up guards (a refused order changes nothing; a nest on the first hex clears the order and sets `confronting`). A shared `startTravel` belongs here.
- **S6-R7** (later steps build on this): the simulator plays a company on the day loop.
- **No behaviour change.** With one party every result, event and RNG draw is as today.

### Decision 13 (from the index, unchanged)

> **`campDays`** in the simulator's record counts the days on which any party camped (no double count); `healedHp` sums every party's.

### Contract C1 (from the index, unchanged)

```ts
// src/game/company.ts (new exports)
/** Starts party `party`'s travel order to `to`: 'refused' (setOrder said no; nothing changed), 'blocked' (a nest on the route's first hex short of `to`: order idle, confronting = monstersHere(...)?.id ?? null), else 'started'. */
export type TravelStart = 'started' | 'blocked' | 'refused'
export function startTravel(game: GameState, party: Expedition, to: Hex): TravelStart
/** act's checks without the day: the action's own refusal, then the day's (advanceRefusal with this order); else sets { kind: 'day', action } and returns null. act = orderAction, then passDay. */
export function orderAction(game: GameState, id: string, action: DayAction): string | null
```

- `worldMap.travel` uses `startTravel`; the simulator's `carryOut` travel branch uses it too, and the mirror comment goes.
- **The simulator** (`scripts/simulate.ts`): a `{ kind: 'act' }` decision calls `orderAction` and returns `'standing'` (the day runs in the next `advance`, with every other party's day); a refused one returns null. A field craft (`{ kind: 'craft' }`) picks its craft with `fieldCraft(game, party): Extract<DayAction, { kind: 'craft' }> | null` (the first item, modifier and grade `craftGear` would try that `craftRefusal` allows) and runs as an act; at a workshop it crafts at once as today. `Plan.running` gains `'day'`; `takeDays` records a day order's `made` craft (`crafted`, `fieldCraftDays`).
- `CampaignRun` gains `vanguard: string` (the vanguard's party id, `parties[0].id` at the start). `finishCampaign` reads the vanguard's members (`finalLevels`) and counts `socketsFilled` over every party.
- `campDays` counts the days on which any party camped (decision 13).

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). Never run two `make simulate` at once. A 500-campaign run takes about a minute and writes some 70 MB.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, each `CampaignRecord` and a SHA-256 of every battle event against a fixture. **Steps 01–08 must not edit the fixture** and must keep it green. A mismatch means the step changed play: find the cause and fix it.
- **The 50-campaign check**, run before committing, recording "guard identical" or the diff:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  Step 01 records the baseline (below); this step's own run after the change must match it line for line and hash for hash. The first line of the summary names the `--out` path, so always use this exact path.
- **The early-game figure** is 230 of 500 from seed 1 after stage 5 (`npm run simulate -- --campaign --battles 500 --seed 1`, `--ready-level` 7). Step 01 re-measures it before any change.
- **Determinism.** Add, drop or reorder no draw of the world RNG or a battle's RNG; keep the order of a day's events. Parties act in list order.
- **Commits.** One commit for this step once `npm test` passes and the guard holds, on `long-campaign-stage-06`, without pushing. Never switch branches. Message "Stage 6 step 01: the simulator's days on the loop". No attribution lines.
- **Docs.** CLAUDE.md stays current: fix the lines this change makes wrong (the `company.ts` line gains `startTravel` and `orderAction` in a few words; the simulator's paragraph on `--campaign` mentions the day's act and the field craft as one-day orders; `campDays`'s meaning if the summary's wording names it). Search it for every name you rename or remove.

## 3. Dependencies and prerequisites

- **None among this stage's steps.** Step 02 may run before, after or in parallel (it touches `save.ts`, `BattleScene`, `MenuScene`; this step touches `company.ts`, `worldMap.ts`, `scripts/simulate.ts` and their tests).
- **Existing code at `63d2ea1`:**
  - `src/game/company.ts`: `setOrder`, `roadBlocked`, a private `actionRefusal` and `dayRefusal`, `act` (checks `actionRefusal ?? dayRefusal(...)`, sets the day order, `passDay`), `passDay`, `advance`.
  - `src/game/worldMap.ts` `travel`: `setOrder` travel (refused → empty journey, nothing changed); if `roadBlocked` → order idle; else `advance(game, Infinity)` collecting the walk; then always `party.confronting = monstersHere(world, party)?.id ?? null` (except on refusal, which returned earlier).
  - `scripts/simulate.ts`: `Decision` (`finish`, `hall`, `fight`, `order`, `act`, `craft`, `heal`); `carryOut` (the `act` branch calls `act()` and tallies; the `craft` branch calls `craftGear(game, party, 1)`, tallies its events, adds `crafted` and `fieldCraftDays = world.turn − turn`; the `order` travel branch duplicates `travel`'s guards, with a "mirrors the start of `travel`" comment); `takeDays` (tallies; for `running === 'travel'` sets `stalled` and `confronting`; for `running === 'camp'` adds `reports.length` to `campDays` and each day's `rested + cast` to `healedHp`); `needsDecision`; `finishCampaign` (reads `game.parties[0].members` for `finalLevels` and `socketsFilled`); `runCampaign` (for each party needing a decision, `carryOut(decide(...))` until `'standing'` or an outcome; then `advance(game, Infinity)`, `takeDays`).
  - `craftGear(game, party, limit)`: for each member and each of `mainHand`, `offHand`, `armor`, the first preferred modifier unlocked here, the grades best first, skipping ranks not better than the item's own, calling `craft(game, place, id, grade)` and taking the first that is not refused; in the field `craft` passes a day (through `act`).

## 4. Scope and guidance

### 4.1 Baseline first

Before changing any code, run and record in the execution record:

```sh
npm run simulate -- --campaign --battles 500 --seed 1 --out logs/base-500.jsonl > logs/base-500.txt
shasum -a 256 logs/base-500.jsonl
npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
shasum -a 256 logs/guard-50.jsonl
```

Record the 500-campaign summary's headline (expected 230 of 500; stage 5 recorded log SHA-256 `d17e6dca…13fd`, 9121 battles) and the full 50-campaign summary and its hash (stage 5: `068016a8…2765`, 23 of 50). These are the stage's baseline that steps 02–08 compare against. If they differ from stage 5's, stop and report: `main` changed play since.

### 4.2 `company.ts`

- **`startTravel(game, party, to)`**: `setOrder(game, party.id, { kind: 'travel', to })`; refused → `'refused'`, nothing changed. If the new order's route is blocked at its first hex (`roadBlocked`) → order idle, `party.confronting = monstersHere(world, party)?.id ?? null`, `'blocked'`. Else `'started'`.
- **`orderAction(game, id, action)`**: exactly `act`'s current checks (`actionRefusal(...) ?? dayRefusal(game, (p) => (p === party ? order : p.order))`, and the unknown-party refusal); on success sets `party.order = { kind: 'day', action }` and returns null. `act` becomes `orderAction`, then `passDay(game)!`, with its result unchanged.
- **`worldMap.travel`** uses `startTravel`: refused → the empty journey as today (and no `confronting` change); blocked → the journey stays empty and `confronting` is as `startTravel` left it; started → `advance(game, Infinity)` as today, then `confronting = monstersHere(...)` as today. Its results must not change (its tests and the characterization tests from stage 5 step 06 keep passing).

### 4.3 `scripts/simulate.ts`

- **`act` decision**: `orderAction(game, party.id, decision.action)`; refused → return null (ask again, as today when `act` returned a string); else `plan.running = 'day'` and return `'standing'`. The day runs in `runCampaign`'s next `advance(game, Infinity)`, which stops after it (the day order's `order_done`, or an earlier notable event: either way an interrupt concerning this party or every party, so `needsDecision` asks it again). With one party this is the same day, the same events, in the same order as `act` gave.
- **`craft` decision**:
  - At a workshop (`craftTier(world, party) !== 'field'`): as today, `craftGear(game, party, 1)` at once (no day passes).
  - In the field: `const action = fieldCraft(game, party)`; none → return null (the phase has already moved on to `crafted`, as when `craftGear` made nothing); else `orderAction` with it and `plan.running = 'day'`, `'standing'`. `fieldCraft` must pick exactly what `craftGear(game, party, 1)` would have crafted: the same loop order, the same unlock, grade and rank checks, `craftRefusal(game, place, id, grade) === null` in place of trying `craft`. Factor the loop so `craftGear` and `fieldCraft` share it rather than copying it.
- **`takeDays`**: for a party with `plan.running === 'day'`, take its `PartyDay.made` from the reports: when a craft was made add 1 to `crafted` and 1 to `fieldCraftDays` (today's `world.turn − turn` was 1 for a made craft). Keep `tally` of every report's events as today (the `act` branch's tally moves here; nothing is tallied twice).
- **`campDays`** (decision 13): add `reports.length` once if any party's `plan.running === 'camp'`, not once per camping party. `healedHp` keeps adding every camping party's `rested + cast`.
- **`CampaignRun.vanguard: string`**, set in `startCampaign` to `game.parties[0].id`. `finishCampaign`: `finalLevels` from the vanguard's members (find by id; the vanguard is never removed in this step), `socketsFilled` summed over every party's members.
- **`carryOut`'s travel branch**: replace the guards with `startTravel(game, party, order.to)`: `'refused'` → `plan.stalled = true`, null; `'blocked'` → `plan.stalled = true`, null; `'started'` → `plan.running = 'travel'`, `'standing'`. Delete the "mirrors the start of `travel`" comment.

### 4.4 Invariants

- With one party the decisions, the days and the events come in the same order as today; the guard test and the 50-campaign log must be byte for byte the same.
- `company.ts` still calls only time-free parts and refusals of the modules it imports; no new import cycle is called at load time.
- No change to `DayReport`, `PartyDay`, `PartyEvent` or `OrderRequest` in this step (step 03 extends them).

### 4.5 Exclusions

No new order kinds, no second party in the game, no `--parties` flag, no change to the record's fields (step 09), no change to the guard fixture.

## 5. Verification

- **Characterization tests first**, committed with the step, written and passing against the pre-change tree where they can be:
  - `company.test.ts`: `startTravel` on a refused order (nothing changed), on a nest at the first hex (idle, `confronting` set as `travel` sets it), and a started walk; `orderAction` refuses what `act` refuses with the same message, and on success leaves the day for `passDay`; `act`'s results unchanged.
  - With a second party pushed into a test game by hand (an `Expedition` literal with id `party_2`, at another hex), `orderAction` for each of two parties, then one `passDay`: both actions happen in the same day and `world.turn` moves by one.
  - `scripts/simulate.test.ts` (the policy-on-the-loop suite): an `act` decision now returns `'standing'` with a day order and no day passed until `advance`; `fieldCraft` picks the craft `craftGear(game, party, 1)` makes, on a fixed state; two campers in `takeDays` add the days once.
- **Gates:**

  ```sh
  npx vitest run src/game/company.test.ts src/game/worldMap.test.ts
  npx vitest run scripts/simulate.test.ts
  npm test
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  The guard test passes unedited; the 50-campaign summary and hash equal the baseline of §4.1. No scene changes, so `npm run test:browser` is not required (run `npm run test:browser -- -t "walk"` if `travel`'s scene callers were touched).

## 6. Completion criteria

- [ ] Baseline recorded in the execution record: the 500-campaign summary headline and hash, the 50-campaign summary and hash, taken before any change.
- [ ] `startTravel` and `orderAction` exported from `company.ts` as C1; `act` and `travel` built on them with unchanged results.
- [ ] The simulator's acts and field crafts run as day orders in the next `advance`; `fieldCraft` shares `craftGear`'s loop; the mirror comment is gone.
- [ ] `CampaignRun.vanguard`; `finishCampaign` reads the vanguard and counts sockets over every party; `campDays` counted once a day.
- [ ] New tests as in §5; `npm test` passes; guard test unedited and green; 50-campaign check identical.
- [ ] CLAUDE.md's lines on `company.ts` and the simulator's campaign loop updated.
- [ ] Index row 01 set to done with the commit hash; one commit "Stage 6 step 01: the simulator's days on the loop", no attribution lines.

## Execution record

### Baseline (before any change, at `b9682cd`)

- `npm run simulate -- --campaign --battles 500 --seed 1 --out logs/base-500.jsonl`: **230 of 500** beat the Source (46.0%), party fell 270, encampment lost 0, out of days 0; 270 days, 18.2 battles, 26.0 spawns a campaign; 9121 battles. Log SHA-256 `d17e6dca65137917aaa7e1bb873ab241b323dbe6152e338c141ae618b51613fd` (stage 5's).
- `npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl`: log SHA-256 `068016a82040ec5be673084265005a7218f0ce927629880565c1a27a8cf52d76` (stage 5's). Summary:
  - Beat the Source: 23 of 50 (46.0%); party fell: 27 (54.0%); encampment lost: 0; out of days: 0
  - A campaign: 266 days, 17.0 battles, 24.3 spawns, 2.9 sites captured and 0.1 lost, 38% of the land blighted at the end
  - Watchtowers 1.8 built, 0.0 lost; shrine 1.0; outposts 0.5
  - Trading post, workshop, infirmary 1.1, 0.6, 0.5; 6 gold on gear, 61 from sales, 4.4 items crafted (2.8 days in the field)
  - Tier-2 bought 0.0; runes 12.1 found, 0.0 bought, 0.1 fused, 3 gold; 0.0 sockets filled
  - Guild hall 2.4, 2.2 recruits, 1.8 heroes dead; 109.4 hp healed in 25.0 days of camping
  - Levels at the end: lowest 6.4, highest 6.9; battles to level 5: 6.8 (38 campaigns)
  - Battles by threat (battles/won): 1 101/101, 2 170/167, 3 189/180, 4 262/261, 5 130/116; 852 battles, 825 player wins, 27 enemy wins

  (The 50-campaign baseline was run from a clean `git archive HEAD` tree, as the code was being edited while the 500-campaign run was going.)

### Implementation

- **Done:** `startTravel` and `orderAction` in `company.ts` (C1); `act` = `orderAction` then `passDay`; `worldMap.travel` over `startTravel`. Simulator: an `act` decision is a day order (`'standing'`, `plan.running = 'day'`); a field craft is chosen by `fieldCraft` and runs as a day order, sharing `craftGear`'s loop (`eachWantedCraft`); at a workshop `craft` crafts at once as before; `takeDays` (now exported) records a day order's `made` as `crafted` and `fieldCraftDays`, and adds `campDays` once a day when any party camps; `CampaignRun.vanguard`; `finishCampaign` reads the vanguard's members and counts sockets over every party; the mirror comment is gone.
- **Tests:** `company.test.ts` gains `startTravel` (refused, blocked, blocked after lingering, started) and `orderAction` (refuses as `act`, same words; leaves the day to `passDay`, equal to `act`; two parties' actions in one day). `scripts/simulate.test.ts`: the tower/craft test now expects `'standing'` and runs the day by `advance` + `takeDays`; new: a refused act asks again; `fieldCraft` matches `craftGear(game, party, 1)` (two picking cases, two picking-nothing cases); two campers count their days once and both heals.
- **Gates:** `npx vitest run src/game/company.test.ts src/game/worldMap.test.ts` 86 passed; `npx vitest run scripts/simulate.test.ts` 64 passed (the refactor guard unedited and green); `npm test` 80 files, 1359 tests passed; 50-campaign check after the change: hash `068016a8…2d76` and summary identical line for line (**guard identical**). No scene changed, so no in-browser run.
- **Deviations:** `takeDays` is exported, for the two-camper test. The old tower/craft test's expectations changed deliberately (an act no longer passes its day inside `carryOut`).
- **For later steps:** a day order's `made` counts as a field craft in `takeDays`; if the simulator ever embeds in the field, tell the two apart there.
