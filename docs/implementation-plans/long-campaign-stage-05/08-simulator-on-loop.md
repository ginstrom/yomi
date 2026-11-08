# Step 08: The simulator on the loop

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-05-company-of-one.md) (§2 "Step B", §6) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §5.3, §5.5

**Difficulty:** opus / opus. Leave the engineer's and reviewer's model unset. This step restructures `runCampaign`, the code that the refactor guard measures, and it is the step most likely to drift. The guard must stay identical.

## 1. Objective

`runCampaign` in `scripts/simulate.ts` stops being a sequential script that calls day-passing functions. It drives the company's day loop (`company.ts`, C6):
- A **policy** decides what the single party does next whenever it is idle, or its order was cut short by an interrupt. Its decisions are the same as today's.
- Time passes only through `advance`, `passDay` or `act`.

The seeded campaign must play out exactly as before: the same days, battles, records and events.

## 2. Requirements and context

- **Design §2:** "The simulator's `runCampaign` runs on the loop. Its policy sets the order of the single party when it is idle, with the same decisions as today." S5-R5: no behaviour change; a seeded run gives an identical summary.
- **Why:** stage 6 adds a second party with its own role. A day loop that asks a policy per idle party is the shape it needs. Shape the code so a second policy can be added per party, by id, but **plan and build nothing of stage 6**: no roles, no `--parties`, no new record fields.
- **Today's `runCampaign`** (`scripts/simulate.ts`, about line 661), in order. Each loop of `for (;;)`:
  1. `world.status === 'lost'` → `finish('encampment')`; `world.turn > MAX_CAMPAIGN_DAYS` → `finish('timeout')`.
  2. If `hallErrand(game)` and not at home: `walkTo(home)`, and if that fails, `finish(worldActive ? 'timeout' : 'encampment')`.
  3. At the guild hall (`atGuildHall`): `visitGuildHall`, then `visitFacilities`, and add their figures to the record.
  4. `nextTarget(...)`, or `finish('timeout')` if there is none. Then `walkTo(next.position)`; if the world is not active, `finish('encampment')`; if it never arrived, `finish('timeout')`.
  5. Fight:
     - `ENCOUNTERS[...]`, the meta, the battle id and seed, `fight`;
     - a loss → `finish('fallen')`;
     - copy hit points and mana back;
     - `rewardVictory` into the baggage, deaths, `autoAdvance`, the level marks;
     - `takeRunes`;
     - `clearLocation`;
     - won → `finish('source')`.
  6. A watchtower if `canBuildTower` is null.
  7. `outpostErrand` → `walkTo` it and, if `canBuildOutpost` is null, `buildOutpost`.
  8. If `canCamp`: one field craft (`craftGear(game, 1)`), recording `crafted` and `fieldCraftDays` (the turns it took).
  9. If the world is not active → `finish('encampment')`.
  10. `while (partyWounded && canCamp) campUntilHealed`, recording `healedHp += rested + cast` and `campDays += days`.
- **`walkTo(to)`** loops `travel(…, to)` while the party is not at `to`, the world is active and `world.turn <= MAX_CAMPAIGN_DAYS`. It tallies each journey's events and gives up (false) on an empty journey. **Each call of `travel` re-plans the route from where the party stands.**
- **`campUntilHealed`** casts `autoHeal` before it camps. A camp cut short by an interrupt is called again, which **casts `autoHeal` again** before the next day.
- **`tally`** counts the events `spawned`, `site_captured`, `site_lost`, `tower_built`, `tower_lost` and `outpost_built` from every day's events.

### Contracts this step consumes (index C6, unchanged)

```ts
// src/game/company.ts (steps 06 and 07)
export type PartyEvent =
  | { type: 'arrived'; party: string; at: Hex }            // a travel order reached `to`
  | { type: 'confronting'; party: string; location: string } // it stepped onto monsters
  | { type: 'order_done'; party: string }                   // a camp order healed everyone or could camp no more, a day action ended, a road was blocked
export interface Interrupt {
  /** The party it concerns: a party event's; for `sighted`, the nearest party within NOTICE_RADIUS (or nearest, for the Source), first in list order on a tie; else null. */
  party: string | null
  event: WorldEvent | PartyEvent
}
export interface PartyDay {
  party: string
  /** The hex it stepped onto today, or null. */
  walked: Hex | null
  /** Hit points restored by rest today. */
  rested: number
  /** Hit points restored by its heals today (the camp order's autoHeal). */
  cast: number
  /** The item a day's craft or embed made, else null. */
  made: Item | null
}
export interface DayReport {
  /** The parties' own events (tower_built, outpost_built), in party order, then the world day's (passTurn's), in that order. */
  events: WorldEvent[]
  partyEvents: PartyEvent[]
  parties: PartyDay[]
  /** The first notable world event (isNotable over the presences, in `events` order), else the first party event; null if neither. */
  interrupt: Interrupt | null
}
export type OrderRequest = { kind: 'idle' } | { kind: 'travel'; to: Hex } | { kind: 'camp' }
export const UNTIL_LIMIT = 30
/** Why no day can pass now: the game is over (not worldActive), or a party is confronting monsters and its order is not a scout or wait. Null when one can. */
export function advanceRefusal(game: GameState): string | null
/** Gives party `party` an order. Travel plans its route with routeTo (refused where routeTo is null); camp is refused where it cannot camp. Returns the refusal, or null. */
export function setOrder(game: GameState, party: string, order: OrderRequest): string | null
/** One day: each party's day by its order, in list order, then passTurn(world, presences(parties)) once, then the checks after the day. Null, changing nothing, when advanceRefusal says no. */
export function passDay(game: GameState): DayReport | null
/** Days until a report has an interrupt, the game stops being active, advanceRefusal says no, or `limit` days pass. */
export function advance(game: GameState, limit?: number): DayReport[]   // limit defaults to UNTIL_LIMIT
/** Step 07: the selected party's one-day action: checks it (the action's own refusal), sets the order { kind: 'day', action } and passes one day. */
export function act(game: GameState, party: string, action: DayAction): string | DayReport
```

```ts
// src/game/expedition.ts (index C3)
export type DayAction =
  | { kind: 'scout' } | { kind: 'wait' } | { kind: 'camp' }
  | { kind: 'tower' } | { kind: 'outpost' }
  | { kind: 'craft'; place: ItemPlace; modifier: ModifierId; grade: Grade }
  | { kind: 'embed'; place: ItemPlace; rune: RuneKey }
export type Order =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Hex; route: Hex[] }   // route planned once when given (correction 4)
  | { kind: 'camp' }
  | { kind: 'day'; action: DayAction }
export interface Expedition { id: string; name: string; members: Party; baggage: Item[]; position: Hex; order: Order; confronting: string | null }
```

**How a party's day runs** (C6):
- **Before `passTurn`:**
  - travel steps onto `route[0]`;
  - camp rests (each member heals `restHealing`, mana is filled), then casts `autoHeal`;
  - a day order runs its action, then goes idle.
- **After `passTurn`:**
  - travel at `to` emits `arrived` (and `confronting` on monsters) and goes idle. With the next hex blocked by monsters, it goes idle with `order_done`;
  - camp with nobody wounded, or where it cannot camp, goes idle with `order_done`;
  - a day order emits `order_done`.
- **The conveniences** `travel(game, party, to)` and `campUntilHealed(game, party)` (worldMap.ts, camp.ts) return exactly today's `Journey` and `CampResult`. `campDay`, `linger`, `buildTower`, `buildOutpost`, a field `craft` and a field `embed` are `act` with the matching `DayAction` (step 07). `craftGear` (this file) reaches the field craft through `craft`, so it already runs on `act` after step 07.

### Corrections that touch this step (index)

- **4.** A travel order stores the route planned when it was given. Re-planning happens only when a new order is given.
- **6.** The day-passing functions keep their names and homes and run on the loop.
- **10.** Orders persist past an interrupt. The conveniences give a new order each time they are called, as the simulator's repeated calls do today. **The policy must do the same**: on every interrupt it re-issues its phase's order as today's call would.

### Shared constraints (index)

- **Gate:** `npm test` (`tsc && vitest run`) passes before the commit (`make test` in podman). Use local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.
- **The refactor guard:**
  - The test `describe('the refactor guard')` in `scripts/simulate.test.ts` must pass unchanged. **Never edit its fixture.** A mismatch means this step changed behaviour: find the cause.
  - Run the 50-campaign check before committing:

    ```sh
    npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
    shasum -a 256 logs/guard-50.jsonl
    ```

    The printed summary must equal step 01's line for line (its execution record), and the hash must equal step 01's. Use exactly this `--out` path, since the first line prints it. `logs/` is gitignored, so never commit a log. Never run two `make simulate` at once.
- **Determinism.** No world or battle RNG draw is added, dropped or reordered. Battle seeds stay `(seed + battles.length) >>> 0`. The meta of `battle_start` (`campaign`, `location`, `encounter`, `threat`, `day`, `partyLevels`) is unchanged, and `LOG_SCHEMA_VERSION` stays 23.
- **Commit:** one commit on `long-campaign-stage-05`, without pushing, never switching branches, titled `Stage 5 step 08: the simulator on the day loop`. No attribution lines in the message.
- **Parallel work:** step 09 (the scenes) may run alongside this step. Do not change `company.ts`'s contract. If you must, say so in the record and coordinate; whichever step commits second rebases on the other.

## 3. Dependencies and prerequisites

- **Step 07 done:** `company.ts` with `setOrder`, `passDay`, `advance`, `advanceRefusal` and `act`, and every day-passing function on the loop.
- **Step 05 done:** `runCampaign` already works on an explicit expedition (`game.parties[0]`, held in a local), with no `leader`. `nextTarget(world, party, readyLevel)`, `outpostErrand(world, party)` and the others take the party explicitly.
- **Step 01's record:** the 50-campaign summary and hash to compare against.

## 4. Scope and guidance

### Files

- `scripts/simulate.ts`: `runCampaign`, plus new non-exported or exported policy helpers.
- `scripts/simulate.test.ts`: new policy tests. **The guard fixture is not touched.**
- `CLAUDE.md`: the simulator paragraph.

### Build it in two stages inside this step (one commit)

**Stage 1: swap the calls and keep the sequential shape.** Replace each day-passing call in `runCampaign` and `walkTo` with its loop form, keeping the control flow line for line:
- a `travel` in `walkTo` becomes `setOrder(game, id, { kind: 'travel', to })` + `advance(game, Infinity)`, summed into the same journey figures (or keep calling the `travel` convenience, which already does this after step 06);
- `buildTower`, `buildOutpost` and the field craft become `act`;
- `campUntilHealed` becomes its loop form.

Run the guard test and the 50-campaign check. They must be identical before you go on. This isolates any drift in the conveniences from drift in the restructure.

**Stage 2: restructure into the idle-party policy loop.** `runCampaign` becomes a loop that:
1. Makes the top-of-loop checks at the same points as today: `status === 'lost'`, and `world.turn > MAX_CAMPAIGN_DAYS`, including the turn check that `walkTo` makes between journeys.
2. Asks the policy, for each party in `game.parties` order (one today) that is idle, or whose order was cut short by the last report's interrupt, what to do. The policy returns one of:
   - **an errand** that passes no time: the guild hall visit and `visitFacilities`; a battle, when the party confronts its target; the reward and `clearLocation` after a win;
   - **an order** through `setOrder`: travel to a target, home or an outpost site, or camp until healed;
   - **a one-day act** through `act`: tower, outpost, field craft;
   - **finish** with an outcome.
3. Lets time pass with `advance(game, Infinity)` (or `passDay`) once every party has an order. Tally every report's `events` and record the figures the conveniences recorded before.

### The policy

- **Keep a small plan per party, keyed by its id.** For example `{ phase: 'home' | 'target' | 'afterWin' | 'outpost' | 'craft' | 'heal', target?: MonsterLocation }`. A second party's policy can then be added per id in stage 6. Name and shape it as you see fit; it need not be exported, except what the tests below need (for example a `decide(game, party, plan): Decision` function).
- **The phases follow today's order exactly:**
  1. A hall errand means walking home.
  2. At the hall: guild hall, then facilities.
  3. Choose the target with `nextTarget` and walk to it.
  4. Fight.
  5. After the win: tower, then the outpost errand (walk, then build), then one field craft, then camp until healed.
  6. Back to step 1.
- **Re-issue on interrupt, as today's calls did:**
  - **A travel phase** cut short gives a **fresh** travel order to the same `to`, which re-plans the route from where the party stands. Do not let the old order run on its stored route (correction 10 keeps it in the order; the policy must replace it).
  - An empty walk (no route) ends the phase as `walkTo` returning false did, with the same `finish` outcome at the same point.
  - **A heal phase** cut short casts `autoHeal(members)` again before the new camp order, and records its `cast`. This is what calling `campUntilHealed` again did.
  - The phase loops `while (partyWounded && canCamp)` as today, and a party already whole after the cast camps no day.
- **Records:**
  - `healedHp += rested + cast` and `campDays += days` count the same hit points and days as `CampResult` did. Take them from the reports' `PartyDay.rested` and `cast`, plus the casts before each camp order.
  - `crafted` and `fieldCraftDays` are as today, the latter the turns the field craft took.
  - `tally` sees every day's events, in order, including the act's own `tower_built` and `outpost_built`.
- **`finish`** runs at the same moments and reads the same state: `record.days = world.turn`, the final levels, sockets and facility levels.
- **The battle step is unchanged in substance:**
  - `fight(...)` with the same seed and meta;
  - hit points and mana copied back;
  - `rewardVictory(members, xpReward(encounter), party.baggage)`;
  - `autoAdvance`, the marks, `takeRunes`, `clearLocation(game, id)`.

  The party arrives confronting its target. Clearing the location clears its `confronting`.
- **Leave the exported helpers' behaviour alone:** `nextTarget`, `hallErrand`, `outpostErrand`, `visitGuildHall`, `visitFacilities`, `craftGear`, `runecraftGear` and `materialNeeds`. Their existing tests pass unchanged, except for argument changes made in earlier steps.

### Exclusions

- Nothing of stage 6: no second party, roles, `--parties`, new record fields, or `battle_start` meta `party` or `role`.
- No change to the battle engine, the policies in `src/engine/policies.ts`, the summary or the printed lines.

## 5. Verification

1. **The guard test** passes unchanged: `npx vitest run scripts/simulate.test.ts -t "refactor guard"`.
2. **The 50-campaign check** (commands above) is identical to step 01's summary and hash. Do it after stage 1 and after stage 2 of the build, and record both.
3. **New tests** in `scripts/simulate.test.ts` check the policy's decisions on fixed states, built with `newGame` and the debug-style setters the existing tests use:
   - Idle at home with a hall errand (the stock affords the next hall level): the home errands run (the hall is raised and places filled, as `visitGuildHall` does), then a travel order to `nextTarget`.
   - Idle away from home with a hall errand: a travel order home.
   - Arrived at and confronting its target: the decision is to fight it, not a new order.
   - Wounded after a win, on land where it may camp, with nothing else to do: a camp order. A party whole after the cast gets no camp order.
   - A travel order cut short by an interrupt (for example a `sighted` event): the same target ordered again, with a freshly planned route that starts from the party's present hex.
   - The tower and field craft steps after a win run as acts, each a day.
4. **The existing campaign tests** pass: "fights nest after nest", "spends days as it goes", "carries the party's wounds", "takes rune loot", "plays out the same from the same seed", the summary and record tests.
5. **`npm test` passes.**

## 6. Completion criteria

- [x] `runCampaign` passes time only through `advance`, `passDay` or `act`, with a per-party policy deciding for each idle or interrupted party.
- [x] Re-issuing on an interrupt matches today's re-calls: fresh travel routes, and `autoHeal` before each new camp order.
- [x] The guard test passes unchanged. The 50-campaign summary and hash are identical to step 01's, after both build stages, recorded below.
- [x] The policy's decision tests are added and pass. `npm test` passes.
- [x] CLAUDE.md's simulator paragraph (`--campaign`) says that a campaign runs on the company's day loop, a policy giving the idle party its next order, errand or day's act, with the same decisions as before. Search CLAUDE.md for any other line this makes wrong (for example "walks a day a hex", "calls `travel` and `campUntilHealed`").
- [x] One commit, `Stage 5 step 08: the simulator on the day loop`. The index's table shows step 08 as done with its hash.

## 7. Execution record

Run on `long-campaign-stage-05` from `073ba25`, Node 26.13.0.

**Stage 1 (swap the calls).** Already done by steps 06 and 07: at `073ba25`, `runCampaign` reached time only through `travel`, `campUntilHealed`, `buildTower`, `buildOutpost` and `craftGear` (→ `craft`), all conveniences over `advance` or `act`. So stage 1 changed no code; the guard was run on the tree as found: `npm run -s simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt` gave SHA-256 `068016a82040ec5be673084265005a7218f0ce927629880565c1a27a8cf52d76` and a summary identical to step 01's (`diff` empty). **Guard identical.**

**Stage 2 (the policy loop).** `scripts/simulate.ts`:
- `Plan` (a `Phase`, the walk's `to`, the `target`, `stalled`, the `running` order), one per party by id in `CampaignRun.plans` (`planOf`), so stage 6 can add a second party's plan or policy by id.
- `decide(run, party): Decision` moves the plan through today's phases (start → home → hall → choose → target → fight → won → tower → outpost → build → craft → crafted → heal ⇄ camp → start) and returns `finish`, `hall`, `fight`, `order` (travel, camp or idle), `act` (tower, outpost) or `craft`, or `heal` (the `autoHeal` that `campUntilHealed` cast before each camp).
- `carryOut(run, party, decision)` does it: errands at once, acts through `act` (the field craft through `craftGear` → `craft` → `act`), orders through `setOrder`. A travel order mirrors the `travel` convenience: refused, it changes nothing; with a nest on the first hex it goes idle and sets `confronting` from `monstersHere`; either way the walk is `stalled` (today's empty journey, `walkTo` false).
- `runCampaign` asks the policy for every party that is idle or concerned by the last report's interrupt (or every party when the days stopped for another reason) until each holds an order, then `advance(game, Infinity)`; `takeDays` tallies every report's events, sets `stalled` and `confronting` after a walk, and adds a camp's days, rest and casts to the record. Time passes only through `advance` and `act`.
- `walkTo`'s checks are `walking()`: stalled → false, at `to` → true, world not active or `turn > MAX_CAMPAIGN_DAYS` → false, else a fresh travel order. Each outcome feeds the same `finish` at the same point as before.
- Exported for the tests: `Phase`, `Plan`, `newPlan`, `Decision`, `CampaignRun`, `startCampaign`, `planOf`, `decide`, `carryOut`. The other exported helpers are unchanged.

**Guard after stage 2.** Same command: SHA-256 `068016a82040ec5be673084265005a7218f0ce927629880565c1a27a8cf52d76`, summary identical to step 01's line for line (`diff` empty), run twice (before and after the docs and tests). `npx vitest run scripts/simulate.test.ts -t "refactor guard"`: 1 passed, fixture untouched. **Guard identical.**

**Tests.** New `describe('the campaign’s policy on the day loop')` in `scripts/simulate.test.ts`, 6 tests: home errands then a travel order to `nextTarget`; away with a hall errand, a travel order home; at and confronting its target, a fight; wounded after a win, a heal then a camp order, and a party whole after the cast an idle order and no day camped; a walk cut short by a `sighted` interrupt ordered again to the same hex on a freshly planned route (the stale route overwritten in the test to prove it is replaced); the tower and the field craft as acts, a day each. They were written after the code; each was checked to fail against a mutation of the behaviour it covers (no re-plan, camping when whole, no tower, no hall errand). `npm test`: 80 files, 1321 tests passed.

**Docs.** CLAUDE.md's `--campaign` paragraph says the campaign runs on the company's day loop, through `decide` and `carryOut`, with the same decisions; its `campUntilHealed` mention there is replaced by the `autoHeal` and camp it now does.

**Deviations.** None in behaviour. `company.ts` is unchanged. The 500-campaign check was not run (step 10's). For stage 6: acts run inside a party's decision, so with two parties a party's act would pass a day for both; stage 6 should gather acts as day orders before one `passDay`.
