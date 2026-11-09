# Step 09: The simulator's company record

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-06-multiple-parties.md) (S6-R7; §2 "The simulator"; §5 "Versions") · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §5.5, §6

**Difficulty:** opus / opus. Leave the engineer's and the reviewer's model unset. This step bumps the log schema and re-records the refactor guard's fixture, the one time in the stage that is allowed; the engineer must prove that nothing but the new fields and the hash moved, and the reviewer must check that proof rather than trust it.

## 1. Objective

Give the simulator the shape of a company's record before it has a company policy:
- a `--parties N` flag (1 to 3, default 1 in this step);
- a role for each party (`vanguard`, `guard`) kept in the campaign run;
- the new `CampaignRecord` fields (per role battles, wipes and final levels; `wipes`, `promotions`, `vanguardWalkHomeDays`, `guardBattles`), filled and printed;
- a lost battle wiping the party through the domain's `wipeParty`, and `fallen` meaning that no hero is left;
- `battle_start` meta `party` and `role` (and `party` in the game's battles), with `LOG_SCHEMA_VERSION` 24;
- the guard fixture re-recorded **once**, with `--parties 1`, after showing that every field it already had is unchanged.

Play with one party does not change. Step 10 adds the guard policy and makes `--parties` default to 3.

## 2. Requirements and context

- **S6-R7:** the simulator's company policy and record. The record gains per-role battles, wipes and levels, `promotions`, `vanguardWalkHomeDays` and `guardBattles`. `fallen` now means that no hero is left.
- **Design §5, Versions:** `LOG_SCHEMA_VERSION` is bumped for `battle_start` meta `party` and `role`.
- **Decisions from the index that this step touches (unchanged):**
  - **1.** `--parties N` (1 to 3) defaults to 3 ("what the hall allows", design §5.5) from step 10. The refactor guard test and the early-game figure are run with `--parties 1`: step 09 adds `'--parties', '1'` to the guard test's arguments when it re-records the fixture.
  - **13.** `campDays` in the simulator's record counts the days on which any party camped (no double count); `healedHp` sums every party's. (Step 01 made it so; keep it.)
  - **15.** `LOG_SCHEMA_VERSION` 23 → 24 in step 09: `battle_start` meta gains `party` (the game's and the simulator's) and `role` (the simulator's). That step re-records the guard fixture, once.

### Contracts (copied unchanged from the index)

**C8. The simulator's company record (this step):**

```ts
// scripts/simulate.ts
export type Role = 'vanguard' | 'guard'
// CliArgs gains parties: number (1 to 3; default 1 in step 09, 3 from step 10)
// CampaignRecord gains:
roles: Record<Role, { battles: number; wipes: number; finalLevels: number[][] }>   // finalLevels: one list per party of that role at the end
wipes: number
promotions: number
vanguardWalkHomeDays: number
guardBattles: number
```

- `battle_start` meta gains `party` (id) and `role`; `BattleScene`'s meta gains `party`. `LOG_SCHEMA_VERSION` 24.
- `outcome: 'fallen'` means no hero is left (`heroesLeft` 0).
- The summary prints the new fields; `--parties` is in CLAUDE.md's flags.

**C1, consumed (step 01):**

```ts
// src/game/company.ts
export type TravelStart = 'started' | 'blocked' | 'refused'
export function startTravel(game: GameState, party: Expedition, to: Hex): TravelStart
export function orderAction(game: GameState, id: string, action: DayAction): string | null
```

- The simulator's acts and field crafts run as day orders (`Plan.running` includes `'day'`).
- `CampaignRun` has `vanguard: string` (the vanguard's party id, `parties[0].id` at the start). `finishCampaign` reads the vanguard's members (`finalLevels`) and counts `socketsFilled` over every party.
- `campDays` counts the days on which any party camped (decision 13).

**C5, consumed (step 05):**

```ts
// src/game/company.ts
export interface Wipe { dead: Character[]; left: Item[]; lost: boolean; reformed: Expedition | null }
export function wipeParty(game: GameState, id: string, location: MonsterLocation | null): Wipe
export function heroesLeft(game: GameState): number    // every party's members and the reserves
```

- `wipeParty`: the wiped party's members are dead; what they wore and carried goes into its baggage, and the baggage is added to the location's `loot`. `lost` when `heroesLeft` is 0 after it. If the last party is wiped while reserves remain, a new party is formed at once at the encampment from the reserves (`reformed`). Nothing else changes (no world status).

### Shared constraints (from the index)

- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, each `CampaignRecord` and a SHA-256 of every battle event against a fixture. **This step re-records the fixture once** (decision 15, new record fields), with `--parties 1` in its arguments. Step 10 must keep that new fixture green. No other step edits it.
- **The 50-campaign check** (run it before and after; record both):

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  Before this step it matches step 01's record (or step 04's recorded diff). After it, every line of the summary that existed must be unchanged; only the new lines are added. The log's hash changes (the schema version and meta); record the new hash.
- **The early-game figure** is 230 of 500 from seed 1 after stage 5 (`--ready-level` 7). With `--parties 1` this step should not move it: it changes only the log's schema, meta and zero fields. Step 11 measures it.
- **Determinism.** Add, drop or reorder no draw of the world RNG or a battle's RNG, and keep the order of a day's events. Parties act in list order.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate;
  - `npx vitest run scripts/simulate.test.ts` for the simulator's tests;
  - `npm run test:browser -- -t <name>` after the BattleScene change (read `e2e/CLAUDE.md`);
  - each simulator run its own `--out` under `logs/` (gitignored); never run two `make simulate` at once.
- **Commits.** One commit, "Stage 6 step 09: the simulator's company record", on `long-campaign-stage-06`, without pushing. Never switch branches. No attribution lines.
- **Docs.** CLAUDE.md stays current: fix the lines this change makes wrong, and search it for every name you rename or remove.

## 3. Dependencies and prerequisites

- **Step 05 (done first)** provides `wipeParty` and `heroesLeft` in `src/game/company.ts` (C5), and through steps 01–04:
  - **step 01:** `CampaignRun.vanguard`, acts as day orders, `startTravel`, `campDays` counted once;
  - **step 03:** the `home` order kind (`{ kind: 'home'; to; route }`), whose walks this step counts for the vanguard;
  - **step 04:** the simulator's hall cap `SIM_HALL_CAP = 3` (step 10 makes it follow `--parties`).
- **Existing code at `63d2ea1`:**
  - `parseArgs` in `scripts/simulate.ts` refuses `SINGLE_BATTLE_FLAGS` (`--encounter`, `--threat`, `--party-level`) with `--campaign`, and `--ready-level` without it; follow the same pattern.
  - `fightAt(run, party, target)` returns false on a lost battle, and `carryOut` turns that into `'fallen'`.
  - `fight(setup, seed, party, args, meta)` passes `meta` into `battle_start`; `fightAt` builds it from `campaign`, `location`, `encounter`, `threat`, `day` and `partyLevels`.
  - `LOG_SCHEMA_VERSION = 23` in `src/engine/battleEngine.ts`; `battle_start` carries `schemaVersion` and `meta`.
  - `BattleScene` builds its engine with `meta: { source: 'game', enemyPolicy: ENEMY_POLICY }` (around line 352) and holds `this.expedition`.
  - `summarizeCampaigns(events, records)` and `main` print the campaign summary.
- **Blocker:** none.

## 4. Scope and implementation guidance

### 4.1 The flag

- `CliArgs.parties: number`, parsed with `positiveInt`, 1 to 3 (`MAX_PARTIES` from `expedition.ts`), refused outside that range and refused without `--campaign` (it means nothing for single battles).
- Default **1** in this step. Step 10 changes the default to 3; do not do it here, as no policy forms a second party yet.
- `--parties` above 1 is accepted but plays like 1 until step 10 (no guard is formed). Say so in the flag's help text or comment only if one exists; do not add a refusal.

### 4.2 Roles in the run

- `export type Role = 'vanguard' | 'guard'`.
- `CampaignRun` gains `roles: Map<string, Role>` (by party id): the vanguard (`run.vanguard`) is `'vanguard'`, any other party `'guard'`. Add a helper `roleOf(run, party): Role` that falls back to `'guard'` for an id not in the map, and `run.vanguard` stays the one truth for which party is the vanguard (step 10 changes it on a vanguard wipe).

### 4.3 The record

- New fields of `CampaignRecord`, each initialised in `startCampaign` (zeros, empty lists):
  - `roles: Record<Role, { battles: number; wipes: number; finalLevels: number[][] }>`;
  - `wipes`, `promotions`, `vanguardWalkHomeDays`, `guardBattles`.
- **Battles:** each battle fought adds 1 to `roles[role].battles` of the party that fought; a guard's also to `guardBattles`.
- **Wipes:** a lost battle adds 1 to `wipes` and to `roles[role].wipes`.
- **`finalLevels` per role:** in `finishCampaign`, one list of member levels per party of that role, in list order. Keep the existing `finalLevels` (the vanguard's members, as step 01 made it).
- **`promotions`** stays 0 here; step 10 counts them.
- **`vanguardWalkHomeDays`:** in `takeDays`, for the vanguard, the days on which it walked (`PartyDay.walked`) while its plan was in the `'home'` phase (the walk home to the guild hall). Count each walking day once. With one party this counts the careful party's walks home today.
- Keep the field order of the record stable and put the new fields at the end, so the fixture diff is readable.

### 4.4 Wipes and `fallen`

- `fightAt`, on a lost battle: call `wipeParty(game, party.id, target)`, record the wipe, then:
  - if `wipe.lost` (no hero left: `heroesLeft(game) === 0`), the campaign ends `'fallen'`;
  - otherwise the campaign goes on. Drop the wiped party's plan (`run.plans.delete(id)`) and role. If the vanguard was wiped, leave choosing a new vanguard to step 10, but make sure nothing reads a removed party: if `run.vanguard` names no party, set it to the `reformed` party's id or `parties[0].id` (step 10 replaces this with the strongest party).
- Change `fightAt`'s result (or `carryOut`'s `'fight'` branch) so `'fallen'` comes only from `wipe.lost`. With one party and no reserves, a lost battle leaves no hero, so play is identical.
- The wipe's moving of the members' gear and the baggage into the location's loot happens after the battle's events are logged, so it changes no event and no draw.

### 4.5 Meta and the log schema

- `fightAt`'s `meta` gains `party: party.id` and `role: roleOf(run, party)`. Add them **after** the existing keys, so the order of the old keys in the JSON stays.
- `BattleScene`'s meta becomes `{ source: 'game', enemyPolicy: ENEMY_POLICY, party: this.expedition.id }`.
- `LOG_SCHEMA_VERSION` 23 → 24 in `src/engine/battleEngine.ts`, with a comment line on what changed (as its neighbours have, if they do). Update any test that pins 23.

### 4.6 The summary

- `summarizeCampaigns` (and `CampaignSummary`) gain averages or totals for the new fields: wipes, promotions, vanguard walking-home days, guard battles, and per role battles and wipes (final levels per role: the lowest and highest at the end, as the summary does for the party). `main` prints them as new lines **after** the existing ones, so the old lines stay byte for byte.

### 4.7 Re-recording the guard (once)

1. Before touching the fixture, run the guard test as it stands and confirm it fails only as expected (the hash, from the schema bump and meta; and `toEqual` on the new fields).
2. Change the test's arguments to `parseArgs(['--campaign', '--battles', '5', '--seed', '1', '--parties', '1'])`.
3. Compute the new records. **Check, in a scratch script or a temporary assertion, that each new record, with the new fields removed, equals the old `GUARD_RECORDS` entry exactly.** Record that comparison (passed, field by field if not) in the execution record. If any old field differs, stop: a behaviour change crept in; find it, do not re-record.
4. Replace `GUARD_RECORDS` (now with the new fields) and `GUARD_EVENTS_SHA256`. Update the comment over the fixture: re-recorded in stage 6 step 09 for `LOG_SCHEMA_VERSION` 24 and the company record, from `--parties 1`; never edited again in this stage.
5. Also check, for the event log: the battle count, the `battleId`s and every event other than `battle_start` are unchanged (for instance, hash the lines without `battle_start` before and after); record the result.

### 4.8 Docs

- CLAUDE.md: add `--parties` to the simulator flags (1 to 3, default 1 for now; step 10 makes it 3), the new record fields in the campaign summary's description, `fallen` meaning no hero is left, a lost battle wiping the party, and the meta `party` and `role`. Mention that `LOG_SCHEMA_VERSION` is 24 only if CLAUDE.md states a number.

### Exclusions

- No guard formation, no reinforcement, no new targets (step 10).
- Do not change `--parties`' default to 3.
- No change to `company.ts`'s contracts.

## 5. Verification

- **Unit tests** (`scripts/simulate.test.ts`):
  - `parseArgs`: `--parties 2` gives 2; the default is 1; 0, 4 and a non-number are refused; `--parties` without `--campaign` is refused.
  - A lost battle with reserves left (set up a run whose party is sure to lose, e.g. a weak party at a high threat, with a hero in `game.reserves`): the campaign does not end `'fallen'`; `wipes` is 1; the party is gone and a reformed party stands at the encampment; the location's loot holds the wiped party's baggage and gear.
  - A lost battle with no hero left ends `'fallen'`.
  - `battle_start` meta has `party` and `role` (`'vanguard'` for the first party) and `schemaVersion` 24.
  - `roles.vanguard.battles` equals `battles` for a one-party campaign; `guardBattles` is 0.
- **The guard:** re-recorded as in 4.7, then green; the comparison recorded.
- **The 50-campaign check:** before and after; every pre-existing summary line identical, the new lines listed, the new hash recorded.
- `npm test` passes.
- `npm run test:browser -- -t victorious` (the battle's win path), and the battle and saves in-browser tests, pass after the `BattleScene` meta change.

## 6. Completion criteria

- [ ] `--parties` parsed and documented; default 1.
- [ ] `Role`, the role map and the record fields (C8) filled; the summary prints them after the old lines.
- [ ] A lost battle calls `wipeParty`; `'fallen'` only when no hero is left.
- [ ] Meta `party` and `role` in the simulator, `party` in `BattleScene`; `LOG_SCHEMA_VERSION` 24.
- [ ] The guard fixture re-recorded once with `--parties 1`, its old fields shown identical, recorded here.
- [ ] 50-campaign check recorded (old lines identical, new hash).
- [ ] `npm test` passes; the relevant in-browser tests pass.
- [ ] CLAUDE.md updated.
- [ ] Index row 09 updated with status and commit.

## 7. Execution record

Branch `long-campaign-stage-06-simrecord`, off `long-campaign-stage-06` at `6fc5440` (worked in a worktree in parallel with the scenes track, as the orchestrator asked).

**Done.**
- `--parties` (1 to `MAX_PARTIES`, default 1; refused outside the range or without `--campaign`). `Role`, `CampaignRun.roles`, `roleOf` (the map, a guard's by default) and `setVanguard` (keeps `run.vanguard` and the map in step; step 10 uses it for succession).
- `CampaignRecord.roles`, `wipes`, `promotions` (0), `vanguardWalkHomeDays` (the vanguard's walking days while its plan is in `'home'`), `guardBattles`, at the end of the record. `finishCampaign` (now exported) fills `roles[*].finalLevels` per party in list order.
- `fightAt` returns `'won' | 'wiped' | 'fallen'`; a battle not won (an abandoned one too) calls `wipeParty` through `wipe()`: plan and role dropped; `'fallen'` only when `lost`; a wiped vanguard is replaced by the reformed party or `parties[0]` (`setVanguard`). The vanguard's levels as it fell go to `record.finalLevels`, so a fallen campaign's `finalLevels` is as before. Wipe deaths are not added to `deaths`/`deathsAtLevel` (those stay "heroes who fell in a won battle", which keeps the old fields identical); `wipes` counts them.
- `runCampaign` asks each party once a round by identity (a party a wipe formed is asked, a wiped one skipped); with one party this is the same order.
- `battle_start` meta gains `party` and `role` after the old keys; `LOG_SCHEMA_VERSION` 24 (two engine tests that pinned 23 updated).
- Summary: `avgWipes`, `avgPromotions`, `avgVanguardWalkHomeDays`, `avgGuardBattles`, `roles` (per role battles, wipes, lowest/highest final level over the campaigns with a party of that role); `main` prints three new lines after "Battles to level", before the two tables.
- Folded in from step 01's review: a two-party test that `finishCampaign` reads the vanguard (set to the second party), not `parties[0]`, and counts sockets over every party (2 runes, one in each party).
- CLAUDE.md: `--parties`, the meta keys, `fallen`/wipes, the record's new fields.

**Not done: `BattleScene`'s meta `party`.** The orchestrator's brief barred `src/scenes` for this step (the scenes track is editing it). The one line, `meta: { source: 'game', enemyPolicy: ENEMY_POLICY, party: this.expedition.id }`, is left to whoever merges, with the in-browser checks (`-t victorious`, battle, saves) after it. No in-browser test was run here, as nothing in scenes changed.

**The guard's re-record (4.7).**
1. Before the fixture was touched, the guard test failed only on `toEqual` (36 keys against 31) and the hash.
2. Arguments now `['--campaign', '--battles', '5', '--seed', '1', '--parties', '1']`.
3. A scratch test (deleted) ran the 5 campaigns: each new record with the five new fields removed `toEqual` the old `GUARD_RECORDS`: **passed**, every field.
4. Event log: 72 battles; every `battle_start` with `schemaVersion` set back to 23 and `meta.party`/`meta.role` deleted hashes to the **old** `GUARD_EVENTS_SHA256` (`c5c83f8e…2769`) exactly, so nothing else in the log moved. New hash `820e5b5d2740ee6549069200270ab5c882e3e95033d37dc1b5eb191c5c472cf1`.
5. New fields per campaign: vanguard battles 20, 18, 20, 9, 5 (= `battles`), wipes 0, 1, 1, 1, 1 (one per `fallen`), `vanguardWalkHomeDays` 66, 33, 129, 0, 22, guard all 0, promotions 0; `roles.vanguard.finalLevels` `[[8]]` for the Source win and `[]` for the fallen (no party left).

**50-campaign check.**
- Before: `068016a82040ec5be673084265005a7218f0ce927629880565c1a27a8cf52d76` (stage 5's hash), Beat the Source 23 of 50, 852 battles.
- After: `47043dc0bca21b318808860abbcedb688947bfa7ba16e0db12b5838c72c5d41c`. `diff` of the summaries: only the `--out` path (the before run wrote `guard-50-before.jsonl`) and three added lines:
  ```
  Company (1 party allowed): 0.5 parties wiped, 0.0 promotions, 55.3 days the vanguard walked home and 0.0 guard battles a campaign
  Vanguard: 17.0 battles and 0.5 wipes a campaign; levels at the end lowest 7.7, highest 8.6
  Guards: 0.0 battles and 0.0 wipes a campaign; levels at the end lowest 0.0, highest 0.0
  ```
- Log: 45276 lines both; the lines without `battle_start` hash the same before and after (`06266281…9f36`); all 852 differing lines are `battle_start`s, identical once the schema is set back and `party` (`party_1`) and `role` (`vanguard`) removed.
- The vanguard's level line averages only the campaigns that end with a vanguard (the 23 Source wins), so it reads higher than the old "Levels at the end" line, which includes the fallen party's levels.

**Tests.** `npx tsc` clean; `npx vitest run scripts/simulate.test.ts src/engine/battleEngine.test.ts` 282 passed; `npm test` 80 files, 1433 tests passed.
