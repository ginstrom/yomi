# Step 10: The simulator's company policy

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-06-multiple-parties.md) (S6-R7; §6 simulator checks) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §4.3 (promotion), §5.5 (the simulator's roles)

**Difficulty:** opus / opus. Leave the engineer's and the reviewer's model unset. The guard's policy is new judgement (the design's own risk: "if it plays poorly, the company's value is understated"), it runs several parties on one clock where a wrong re-ask spins the loop or starves a party, and the `--parties 1` guard must stay exactly green.

## 1. Objective

The campaign simulator plays a company: the vanguard on today's targeting, and one or two home guards that reinforce the vanguard by meeting it, defend threatened sites, train on nests they are up to, and garrison. `--parties` defaults to 3. With `--parties 1` every campaign is exactly what step 09 recorded.

## 2. Requirements and context

- **S6-R7:** the simulator's company policy and record. The vanguard and home-guard roles, and a third party as a second guard (reference §5.4/§5.5). The guard's targets cover reinforcement by meeting, defence, training within the threat-5 rings (all of today's map), and garrisoning. `--parties N`.
- **Design §6, simulator check 2** (run in step 11): a `--ready-level 10` run against `--parties 1` should show promotions, guard battles and fewer vanguard walking days. This step makes that measurable and smoke-tests it.
- **Design §7 risk:** check the guard's choices on fixed states in tests.

### Decisions from the index (unchanged)

1. **`--parties N`** (1 to 3) defaults to 3 ("what the hall allows", design §5.5) from step 10. The refactor guard test and the early-game figure are run with `--parties 1`: step 09 adds `'--parties', '1'` to the guard test's arguments when it re-records the fixture.
2. **The simulator's hall cap.** A careful company raises the hall only as far as its parties use: level 3 for `--parties 1`, 4 for 2, 5 for 3 (`HALL_FOR_PARTIES = [3, 4, 5]`). `hallErrand`, `visitGuildHall` and `materialNeeds` all respect it, so one party plays as today. Step 04 adds the cap fixed at 3; step 10 makes it follow `--parties`.
5. **Orders.** `home` is a travel order to the encampment with its own kind (label "Returning home"). `garrison` is allowed only on a held resource site (not the encampment; road hexes are stage 8), does nothing and never ends by itself (label "Garrisoning <site>"). `meet` re-plans its route to the other party's current hex every day, ends with a `met` party event when the two share a hex, and becomes idle with `order_done` when the other party is gone. A meet may step onto a monster location the other party stands on, and then confronts it too.
16. **The guard policy** (step 10), in order: *reinforce* (the vanguard is under its party limit, the guard has two or more heroes and one within 3 levels of the vanguard's lowest: meet the vanguard; on `met` the guard's highest-level hero moves to the vanguard, a promotion; then the guard goes home to recruit); *defend* (the nest pushing hardest on a threatened held site, threat no higher than the guard's lowest level); *train* (the nearest nest of threat no higher than its lowest level); *garrison* (the threatened held site with the fewest `daysToFall`); else go home and stay idle. Targets of different parties are kept distinct; guards never march on the Source. A guard is formed at the guild hall, from reserves and recruits at the hall's level, when the hall allows another party, the company is under `--parties`, and at least 3 heroes can be had. While a guard exists the vanguard no longer goes home to fill an empty place (it still goes home to raise the hall). After a vanguard wipe the strongest remaining party (highest lowest level, then mean level) becomes the vanguard.

### Contracts consumed (copied unchanged from the index)

**C1** (step 01), `src/game/company.ts`:

```ts
/** Starts party `party`'s travel order to `to`: 'refused' (setOrder said no; nothing changed), 'blocked' (a nest on the route's first hex short of `to`: order idle, confronting = monstersHere(...)?.id ?? null), else 'started'. */
export type TravelStart = 'started' | 'blocked' | 'refused'
export function startTravel(game: GameState, party: Expedition, to: Hex): TravelStart
/** act's checks without the day: the action's own refusal, then the day's (advanceRefusal with this order); else sets { kind: 'day', action } and returns null. act = orderAction, then passDay. */
export function orderAction(game: GameState, id: string, action: DayAction): string | null
```

- A `{ kind: 'act' }` decision calls `orderAction` and returns `'standing'`; a field craft is an act (`fieldCraft`). `Plan.running` has `'day'`. `CampaignRun` has `vanguard: string`. `finishCampaign` reads the vanguard's members and counts `socketsFilled` over every party. `campDays` counts the days on which any party camped.

**C3** (step 03):

```ts
// src/game/expedition.ts
export type Order =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Hex; route: Hex[] }
  | { kind: 'home'; to: Hex; route: Hex[] }   // travel to the encampment; then idle
  | { kind: 'camp' }
  | { kind: 'garrison' }                       // on a held resource site; nothing each day; never ends by itself
  | { kind: 'meet'; party: string }            // a hex a day toward that party's current hex, re-planned daily
  | { kind: 'day'; action: DayAction }
export const MAX_PARTIES = 3
export const PARTY_NAMES: readonly string[] = ['First Company', 'Second Company', 'Third Company']
export function partyId(n: number): string            // `party_${n}`
// src/game/company.ts
export type OrderRequest = { kind: 'idle' } | { kind: 'travel'; to: Hex } | { kind: 'home' } | { kind: 'camp' } | { kind: 'garrison' } | { kind: 'meet'; party: string }
export type PartyEvent =
  | { type: 'arrived'; party: string; at: Hex }
  | { type: 'confronting'; party: string; location: string }
  | { type: 'order_done'; party: string }
  | { type: 'met'; party: string; other: string }
```

- `setOrder`: `home` refused at home; `garrison` refused unless on a held resource site and not confronting; `meet` refused for itself, an unknown party, while confronting, on the same hex ("already together"), or with no route.
- A party's day: `travel`/`home` never step onto a monster location another party stands on (idle, `order_done`); `meet` steps the first hex of a fresh `routeTo` the other's position. After the day, `meet` on the same hex → `met` (party = the mover, other = the met), idle, `confronting` set if monsters stand there; other party gone → idle, `order_done`.

**C4** (step 04):

```ts
// src/game/guildHall.ts
export const GUILD_HALL_LEVELS: ReadonlyArray<{ partyLimit: number; parties: number; company: number; cost: Stock }>
//  1: 3, 1, 7, {} · 2: 4, 1, 8, {gold 30, iron 15} · 3: 5, 1, 9, {gold 60, iron 30}
//  4: 5, 2, 14, {gold 120, iron 40, stone 20} · 5: 5, 3, 18, {gold 200, silver 30, stone 20}
export function maxParties(world: WorldState): number
export function companyLimit(world: WorldState): number
export function recruitLevel(game: GameState): number          // world.guildHall (the party parameter goes)
export function homeParties(game: GameState): Expedition[]     // at the encampment, in list order
export function homeParty(game: GameState, preferred?: string): Expedition | null   // preferred if at home, else the first at home
// src/game/company.ts
export type HeroRef = { from: 'party'; party: string; index: number } | { from: 'reserves'; index: number }
export function formParty(game: GameState, name: string, hero: HeroRef): string | Expedition
export function renameParty(game: GameState, id: string, name: string): string | null
export function disband(game: GameState, id: string): string | null
export function moveHero(game: GameState, hero: HeroRef, to: { party: string } | 'reserves'): string | null
```

- Simulator: `SIM_HALL_CAP = 3` until step 10 (decision 2). This step replaces it.

**C5** (step 05):

```ts
// src/game/company.ts
export type ExchangeMove =
  | { kind: 'member'; from: string; index: number }     // member `index` of party `from` joins the other party, at its end
  | { kind: 'swap'; a: number; b: number }              // member a of party A and member b of party B trade places
  | { kind: 'item'; from: string; index: number }       // baggage item `index` of party `from` goes to the other's baggage
export function exchange(game: GameState, a: string, b: string, moves: readonly ExchangeMove[]): string | null
export interface Wipe { dead: Character[]; left: Item[]; lost: boolean; reformed: Expedition | null }
export function wipeParty(game: GameState, id: string, location: MonsterLocation | null): Wipe
export function heroesLeft(game: GameState): number    // every party's members and the reserves
```

**C8** (step 09), `scripts/simulate.ts`:

```ts
export type Role = 'vanguard' | 'guard'
// CliArgs gains parties: number (1 to 3; default 1 in step 09, 3 from step 10)
// CampaignRecord gains:
roles: Record<Role, { battles: number; wipes: number; finalLevels: number[][] }>   // finalLevels: one list per party of that role at the end
wipes: number
promotions: number
vanguardWalkHomeDays: number
guardBattles: number
```

- `battle_start` meta has `party` (id) and `role`; `LOG_SCHEMA_VERSION` 24. `outcome: 'fallen'` means no hero is left (`heroesLeft` 0).

### Shared constraints (from the index)

- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, now runs with `--parties 1` and the fixture step 09 re-recorded. **This step must not edit it** and must keep it green: with `--parties 1` no guard is ever formed, the hall cap is 3, and every decision of the vanguard is the one step 09 made. A mismatch means a `--parties 1` path changed: find it and fix it.
- **The 50-campaign check** with `--parties 1` must match step 09's recorded summary and hash:

  ```sh
  npm run simulate -- --campaign --parties 1 --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **Determinism.** Parties act in list order. Add no draw of the world RNG or a battle's RNG on the `--parties 1` path. The policy itself draws nothing (choices by distance, level and id, ties to the lower id).
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` is the gate; `npx vitest run scripts/simulate.test.ts`; `npm run simulate -- <flags>`, each run its own `--out` under `logs/` (gitignored), never two `make simulate` at once.
- **Commits.** One commit, "Stage 6 step 10: the simulator's company policy", on `long-campaign-stage-06`, without pushing. Never switch branches. No attribution lines.
- **Docs.** CLAUDE.md's simulator paragraph: `--parties` (default 3; 1 for the guard), the roles and the guard's priorities in a sentence or two, `HALL_FOR_PARTIES`. Step 11 does the stage's full pass.

## 3. Dependencies and prerequisites

- **Step 09 (done):** `--parties` parsed (1–3, default 1), `Role`, the record fields (zeros for one party), `battle_start` meta `party`/`role`, `LOG_SCHEMA_VERSION` 24, the re-recorded guard fixture with `--parties 1`, `fallen` meaning no hero left (via `wipeParty`/`heroesLeft`). Read its execution record for how it stores roles (expected: a `roles: Map<string, Role>` or equivalent on `CampaignRun`) and build on that rather than adding a second.
- **Step 03:** the `home`, `garrison` and `meet` orders and the `met` event. **Step 04:** `formParty`, `moveHero`, `maxParties`, `homeParties`, `recruitLevel` at the hall's level, `SIM_HALL_CAP`. **Step 05:** `exchange`, `wipeParty`, `heroesLeft`. **Step 01:** `startTravel`, `orderAction`, the per-party `Plan`, `vanguard` on the run.
- **Existing at `63d2ea1`** (`scripts/simulate.ts`): `decide`/`carryOut` over a `Plan` per party (phases `start` … `camp`), `needsDecision`, `takeDays`, `runCampaign`'s loop (decide for each party needing it until `'standing'`, then `advance(game, Infinity)`), `nextTarget`, `hallErrand`, `visitGuildHall`, `materialNeeds`, `visitFacilities`.

## 4. Scope and implementation guidance

All in `scripts/simulate.ts` and `scripts/simulate.test.ts`. Do not change `company.ts`'s contracts; if a domain gap blocks the policy, report it rather than widening a domain function quietly.

### 4.1 The hall cap and the vanguard's errands

- `HALL_FOR_PARTIES = [3, 4, 5] as const`; the cap is `HALL_FOR_PARTIES[args.parties - 1]`. Replace `SIM_HALL_CAP` in `hallErrand`, `visitGuildHall` and `materialNeeds` (hall levels past the cap are neither raised, nor walked home for, nor kept materials for). Pass the cap in (an argument or the run), keeping the exported functions testable.
- **`hallErrand` for the vanguard while a guard exists:** only the upgrade clause (the stock affords the next level up to the cap and no held site is threatened). The recruit clause ("an empty place and a recruit affordable") is dropped then: the guard fills the vanguard's places by promotion. With no guard (always, under `--parties 1`) it is as today.
- `vanguardWalkHomeDays` (step 09's field): if step 09 left it counting the vanguard's `home`-phase walking days, keep it; otherwise count here the days the vanguard walks with plan phase `home`.

### 4.2 Forming a guard

At the guild hall (the `hall` decision, whichever party is at home), after `visitGuildHall` raised the hall and filled the acting party:
- if `game.parties.length < min(args.parties, maxParties(world))`, and the reserves plus the recruits the stock affords (at `RECRUIT_COST`, under `MAX_RESERVES` and `companyLimit`) come to at least 3 heroes:
  - recruit into the reserves (pre-rolls in turn, renamed when taken, as `visitGuildHall` does), `formParty(game, <default name of the lowest free number>, { from: 'reserves', index: 0 })`, then `moveHero` reserves into it up to `partyLimit`, each spent by `autoAdvance`;
  - count recruits in `record.recruits`; give the new party role `guard` and a `newPlan()`.
- Which party fills first: the acting party (the vanguard, or a guard at home) is filled to its limit before a new guard is formed, as today's `visitGuildHall` does.
- A guard at home also runs the hall and facilities errands (`visitGuildHall`, `visitFacilities`) as the vanguard does; a guard back home after a promotion refills its own places there.

### 4.3 The guard's decisions

Give a guard its own policy (`decideGuard(run, party): Decision`, alongside `decide`, which stays the vanguard's), over the same `Plan` and `Decision` shapes, adding phases as needed (for example `reinforce`, `promote`, `defend`, `train`, `garrison`, `home`, `idle`; the engineer names them). The `Decision` union gains what it needs (expected: `{ kind: 'order'; order: OrderRequest }` already covers `meet`, `home` and `garrison`; a `{ kind: 'promote'; vanguard: string }` that runs the exchange at once). Battles, the win's steps (tower, outpost, field craft, camping until healed) are the same as the vanguard's after a fight: reuse the vanguard's `fight` → `won` → … → `camp` chain rather than copying it, then return to the guard's choice.

Priorities, re-evaluated each time the guard is asked (decision 16):
1. **Reinforce.** The vanguard (`run.vanguard`) has fewer members than `partyLimit(world)`, the guard has 2 or more members, and some guard member's level ≥ the vanguard's lowest level − 3: order `{ kind: 'meet', party: run.vanguard }`. On the guard's `met` event with the vanguard (or on finding the two on one hex while reinforcing): `exchange(game, guard.id, vanguard.id, [{ kind: 'member', from: guard.id, index: <the guard's highest-level member, lowest index on a tie> }])`; `record.promotions++`; then the guard's next choice is home (to recruit). A refused exchange (the vanguard full by then, or a confrontation) drops the guard back to its next priority.
2. **Defend.** Among threatened held sites (`world.threatened`), nearest-to-falling first (`daysToFall` over the guard's presence), the nest pushing hardest on it (as `nextTarget`'s threatened branch: `monsterStrength(l) − distance > 0`) with threat ≤ the guard's lowest level (at least 1): travel there and fight.
3. **Train.** The nearest nest (not the Source) with threat ≤ `max(1, guard's lowest level)`: travel there and fight.
4. **Garrison.** The threatened held resource site with the fewest `daysToFall`: travel there, then `{ kind: 'garrison' }`.
5. **Home and idle.** Travel home (`{ kind: 'home' }`, unless at home) and stay idle.

- **Distinct targets.** A nest another party's plan targets (vanguard or other guard) is never chosen; nor a garrison site another guard holds or walks to. Ties go to the lower location id.
- **Never the Source.** Guards' pools exclude `l.source`. The vanguard's `nextTarget` is unchanged, but it also skips a nest a guard's plan targets (with `--parties 1` there is none, so the guard test holds).
- **Walking.** Walks use `startTravel` through the existing `walk`/`walking` helpers, re-ordering a cut-short walk as the vanguard does.

### 4.4 Vanguard succession and wipes

- A lost battle: `wipeParty(game, party.id, target)`; tally `record.wipes` and `roles[role].wipes`. If `wipe.lost` (no hero left), finish with `'fallen'` (step 09). If the vanguard was wiped and parties remain, the strongest remaining party (highest lowest level, then highest mean level, then lowest id) becomes `run.vanguard`, its role `vanguard`, and its plan reset to `start`. A `reformed` party (from the reserves) gets role `guard` unless it is the only party, then `vanguard`, and a new plan.
- Plans of parties that no longer exist are dropped; a guard reinforcing a wiped vanguard gets `order_done` from the loop and re-chooses.

### 4.5 The loop

- **`needsDecision`:** as today for travelling and camping parties (idle, or the last interrupt concerns it or every party). In addition, a guard holding `garrison` or `idle` is asked again after **every** `advance`, so a threatened site or a weakened vanguard is answered without waiting for a world-wide event.
- **`advance`'s limit:** `Infinity` while some party has a running walk, meet or camp (or a day order); otherwise a small finite limit, `IDLE_DAYS = 10`, so a company whose parties are all garrisoned or idle passes ten days and is asked again rather than spinning forever. With `--parties 1` the vanguard always holds a running order when `advance` is called (as today), so the limit never applies there.
- `MAX_CAMPAIGN_DAYS` still ends the campaign from the vanguard's `start` phase; guard plans check it too so a guard never loops on a finished world.
- Every party's `battle_start` meta carries its `party` and `role` (step 09); `roles[role].battles` and `guardBattles` count by the party that fought.

### 4.6 The default

`--parties` defaults to 3 (CliArgs and the usage text). The guard test already passes `--parties 1` (step 09); check `main`'s other tests or callers that relied on the old default and pass `--parties 1` where they mean the single party.

### Exclusions

No change to the vanguard's targeting beyond 4.1 and the distinct-targets skip; no tuning of the hall costs, blight or counts (that is for the user after step 11's measurement); no game-side (scene) change.

## 5. Verification

1. **Policy tests on fixed states** (`scripts/simulate.test.ts`, new `describe('the company policy')`), each from `newGame(undefined, null, 1)` with a second (and third) party built through `formParty`/`moveHero` or set up directly, the hall level set as needed:
   - each branch chosen correctly: a weakened vanguard and a qualifying guard → a meet order to the vanguard; no qualifying hero (all more than 3 levels below, or a guard of one) → not reinforce; a threatened site with a pushing nest within the guard's level → that nest; no threat → the nearest nest it is up to; no nest it is up to and a threatened site → garrison travel then `{ kind: 'garrison' }`; nothing → home, then idle;
   - **reinforcement end to end:** two parties, the vanguard one short; run the loop (or `decide`/`carryOut`/`advance` by hand) until the `met` event; the guard's highest-level hero is now the vanguard's last member, `record.promotions` is 1, and the guard's next order is home;
   - **succession:** wiping the vanguard with a guard alive makes the strongest remaining party the vanguard (`run.vanguard`), and a campaign is `fallen` only when `heroesLeft` is 0;
   - **distinct targets:** two guards and the vanguard never share a target nest; no guard ever targets the Source;
   - **the hall cap:** with `--parties 2` `visitGuildHall` stops at level 4 and `hallErrand` never walks home for level 5; with `--parties 1` at 3;
   - **forming:** at hall 4 with the stock for three recruits, a hall visit forms a Second Company of at least 3, at the hall's level;
   - **the loop never spins:** all parties garrisoned or idle, `advance` passes at most `IDLE_DAYS` and each guard is asked again.
2. **The guard test** (`--parties 1`) passes unchanged, and the 50-campaign check with `--parties 1` matches step 09's summary and hash.
3. **A smoke run** with the default parties, recorded in the execution record (summary lines for outcomes, battles, promotions, guard battles, wipes, hall level, vanguard walk-home days):

   ```sh
   npm run simulate -- --campaign --battles 20 --seed 1 --out logs/company-20.jsonl > logs/company-20.txt
   ```

   Expected: it finishes; `promotions` > 0 and `guardBattles` > 0 over the 20; no campaign hits `MAX_CAMPAIGN_DAYS` because of a stalled loop. If promotions or guard battles are 0, find out why (the hall never reaching 4 by the Source at `--ready-level 7` is plausible: then also run `--ready-level 10` and record both) before committing.
4. `npm test` passes.

## 6. Completion criteria

- [x] `HALL_FOR_PARTIES` replaces `SIM_HALL_CAP` in `hallErrand`, `visitGuildHall` and `materialNeeds`.
- [x] Guards are formed at the hall (decision 16) and decide reinforce → defend → train → garrison → home/idle, with distinct targets and never the Source; promotions run through `exchange`.
- [x] The vanguard drops the recruit errand while a guard exists; succession after a vanguard wipe; `fallen` only with no hero left.
- [x] `needsDecision` re-asks garrisoned or idle guards after every `advance`; `advance`'s limit is `IDLE_DAYS` when nothing runs.
- [x] `--parties` defaults to 3.
- [x] Policy tests on fixed states pass; the guard test and the 50-campaign check (`--parties 1`) identical to step 09's.
- [x] The 20-campaign smoke run recorded, with promotions and guard battles above 0 (or explained).
- [x] CLAUDE.md's simulator paragraph updated; one commit; the index row updated with status and hash.

## 7. Execution record

Branch `long-campaign-stage-06-simrecord` (worktree, off step 09's `564772c`), the user having confirmed decision 16 as written.

**Done** (all in `scripts/simulate.ts`, `scripts/simulate.test.ts`, CLAUDE.md's simulator paragraph):
- `HALL_FOR_PARTIES = [3, 4, 5]`, `hallCap(parties)`; `hallErrand(game, party, parties = 1, guarded = false)`, `visitGuildHall(game, party, parties = 1)`, `materialNeeds(game, parties = 1)`, `visitFacilities(game, party, parties = 1)` (defaults keep the old one-party behaviour for the existing tests). `SIM_HALL_CAP` is gone.
- `formGuard(game, parties)`, run from `carryOut`'s `hall` after `visitGuildHall` (the acting party filled first) and before `visitFacilities`; it loops, so a level 5 hall can form two at once. Role `guard`, a new plan, recruits counted.
- `guardChoice` / `decideGuard` (decision 16), the Decision union widened to every `OrderRequest`, plus `promote` (the exchange, `promotedIndex`) and `stand` (idle, or garrison kept; returns `'standing'`). The vanguard's chain from `fight` to `camp` is now `afterBattle`, shared by both policies. `takenTargets` keeps nests distinct; `nextTarget` gained `taken` (falls back to every nest when a guard holds them all). Guards never take the Source.
- Succession: `strongestParty`; the new vanguard's plan reset, its guard walk stopped (idle), or, if it already confronts a nest, aimed at it; `decide`'s `start` fights a nest the party confronts (never reached with one party).
- Loop: `playRound` (one round; `runCampaign` loops it), `needsDecision(run, …)` re-asks garrisoned guards, `advanceLimit` (`IDLE_DAYS` 10 when nothing runs). A walk stopped a hex short of another party's monsters is not stalled. `--parties` defaults to 3.
- Review items from step 09: (1) `socketsFilled` is now counted before the wipe when the company falls (stage 5's meaning); (2) `deaths`/`deathsAtLevel` stay heroes dead in battles won (record fields are fixture-bound), and the summary line now says "heroes dead in battles won (a wiped party's not counted)"; wipes stay on the Company line; (3) the Vanguard/Guards lines name the campaigns their levels cover (`RoleSummary.campaigns`). The summary also counts campaigns ending with the hall at 4+ and 5 (`hallFour`, `hallFive`).

**Deviations.** `hallErrand` has a third clause, walking home to form a guard (`guardWanted`: under `--parties` and the hall's parties, 3 heroes affordable); without it a guard formed only by chance on another errand. Never true with `--parties 1`. Guards run the hall's errands when they arrive home and when idle at home with a hall errand (once a day at most).

**Verification.**
- Refactor guard (fixture untouched) green. 50-campaign `--parties 1`: `47043dc0bca21b318808860abbcedb688947bfa7ba16e0db12b5838c72c5d41c`, identical to step 09; the summary differs only in the labels of three lines and the added hall counts (all figures equal).
- `npm test`: 80 files, 1457 tests passed. Simulator file: 100 tests, 23 new under `the company policy` (each branch, reinforcement end to end, refused exchange, succession, fallen only at `heroesLeft` 0, sockets as fallen, distinct targets/no Source, hall cap 1/2, form errand, forming, re-asking, `IDLE_DAYS`, rounds without spinning). Mutations of the promoted hero, the advance limit, the garrison re-ask, the taken-target filter and succession order each fail a test.
- Smoke, 20 campaigns, default parties: Source 11, fallen 9, timeout 0; promotions 0.0, guard battles 0.6, wipes 0.5, hall 2.5 (1 campaign at 4+), vanguard walk-home 64.8 days. With `--ready-level 10`: Source 15, fallen 5; promotions 0.0, guard battles 6.5, wipes 0.4, hall 3.2 (12 at 4+, 1 at 5), walk-home 101.6 days.
- 500 campaigns, default (`--parties 3`), seed 1: Source 240 of 500 (48.0%), fallen 260, 274 days, 18.6 battles; hall 2.4, at 4+ in 16 campaigns, 5 in 0; promotions 0.0, guard battles 0.3, wipes 0.5, walk-home 57.9 days. It took 7.5 min of CPU against about a minute before (partly an `npm test` run alongside); step 11 should time it alone.

**Why promotions are 0.** Guards exist only from hall 4, which few campaigns reach before the Source at `--ready-level 7`. At `--ready-level 10` (100 campaigns, a scratch tally): 64 reached hall 4, still 0 promotions. Over 40 campaigns the vanguard was short of its limit while a guard existed in exactly one round each in 17 campaigns, always after the Source battle that ended the campaign: by hall 4 the vanguard (level 8+, full) no longer loses heroes in won battles. Reinforcement works on fixed states (the end-to-end test). Step 11's `--ready-level 10` measure will show this; making promotions happen is a tuning question for the user (for example the hall costs), not this step's.

**A bug found by the smoke run** (fixed and tested): a guard made the vanguard while walking reached its nest under a vanguard plan, so its `home` walk was refused (confronting) and the campaign ended `timeout` on day 480.
