# Step 07: Day actions as orders

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-05-company-of-one.md) (S5-R3; §6 `company.test.ts`) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §4.2 ("A day-long action for the selected party … runs as that party's order for one day"), §5.3

**Difficulty:** opus / opus. Leave the engineer's and the reviewer's model unset. Every day-passing action moves onto the loop here, and the refactor guard must stay identical, so each action's order of effects and events must not change.

## 1. Objective

Every one-day action of the selected party runs as a one-day order through the day loop:
- scouting and waiting;
- a day's camp;
- building a watchtower or an outpost;
- a field craft;
- a field embed.

`act(game, party, action)` checks the action, sets `{ kind: 'day', action }` and passes one day with `passDay`. The existing functions (`campDay`, `linger`, `buildTower`, `buildOutpost`, `craft`, `embed`) keep their names, homes and result shapes. Each becomes a convenience over `act`, so callers and tests keep working and play is unchanged.

## 2. Requirements and context

- **S5-R3:** day actions run as one-day orders for the selected party. The day passes for everyone; with one party, that is just this party.
- **S5-R5:** no behaviour change. A seeded simulator run gives an identical summary before and after.
- **Corrections from the index that this step touches:**
  - **6. Day-passing functions keep their names and homes:**
    - `travel` and `linger` in `worldMap.ts`;
    - `campDay` and `campUntilHealed` in `camp.ts`;
    - `buildTower` and `buildOutpost` in `buildings.ts`;
    - `craft` in `crafting.ts`;
    - `embed` in `runecraft.ts`.

    Each becomes a convenience over the loop (`setOrder` + `advance`, or `act`), and `company.ts` calls only their time-free parts. This makes import cycles between `company.ts` and those modules. They are safe while no module calls another as it loads, as CLAUDE.md already says of `blight.ts`, `territory.ts` and `worldMap.ts`.
  - **7.** `DayReport` carries `partyEvents` and a `PartyDay` per party, so the conveniences can return their results unchanged. `PartyDay.made` is the item a day's craft or embed made.
  - **5.** Stage 5's orders are idle, travel, camp and day.

### Contracts (copied unchanged from the index)

**C3, the expedition's orders** (`src/game/expedition.ts`, made in step 03):

```ts
/** A one-day action of the selected party (step 07 runs them). */
export type DayAction =
  | { kind: 'scout' }
  | { kind: 'wait' }
  | { kind: 'camp' }                                  // one day's rest (campDay), no spells
  | { kind: 'tower' }                                 // build a watchtower where it stands
  | { kind: 'outpost' }                               // build an outpost on the held site it stands on
  | { kind: 'craft'; place: ItemPlace; modifier: ModifierId; grade: Grade }   // a field craft
  | { kind: 'embed'; place: ItemPlace; rune: RuneKey }                        // a field embed

/** A party's standing order (stage 6 adds home, garrison and meet). */
export type Order =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Hex; route: Hex[] }   // route: the hexes still to walk, `to` last, planned once when given (correction 4)
  | { kind: 'camp' }                            // camp until healed: rest, then the party's heals (autoHeal), each day
  | { kind: 'day'; action: DayAction }          // one day's action, then idle
```

`Expedition` has `id`, `name`, `members`, `baggage`, `position`, `order` and `confronting` (C3 in the index).

**C6, the day loop** (`src/game/company.ts`, made in step 06; `act` is this step's):

```ts
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

From C6, the parts this step implements:
- **A party's day, for a day order:** run the action's time-free part, then the order becomes idle.
- **After `passTurn`, for a day order:** emit `order_done`.
- **The other day-passing functions** (`campDay`, `linger`, `buildTower`, `buildOutpost`, a field `craft`, a field `embed`) become `act` with the matching `DayAction`. Their results, events and refusals are unchanged.

**C4 signatures in force** (from step 04; this step keeps them):
- `linger(game, party, how)`, `campDay(game, party)`, `buildTower(game, party)`, `buildOutpost(game, party)`;
- `canBuildTower(world, party)`, `canBuildOutpost(world, party)`, `canCamp(world, party)`, `monstersHere(world, party)`, `restHealing(world, party, member)`, `craftTier(world, party)`.

**C5 in force** (from step 05):
- An `ItemPlace` names its party (`place.party`). `craft(game, place, …)` and `embed(game, place, key)` find the acting party by it.
- `leader` no longer exists.

### Shared constraints (from the index)

- **The refactor guard.** The test in `scripts/simulate.test.ts`, `describe('the refactor guard')`, runs 5 campaigns from seed 1 and compares each `CampaignRecord`, and a SHA-256 of every battle event, with a fixture. **Never edit the fixture.** A mismatch means this step changed behaviour: find the cause and fix it.
- **The 50-campaign check.** Run it before committing:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  The printed summary must equal step 01's recorded summary line for line, and the hash must equal step 01's. Use this exact `--out` path, because the first line names it. Record "guard identical" (or the diff) in the execution record.
- **Determinism.** Add, drop or reorder no draw of the world RNG or a battle's RNG. Keep the order and arithmetic of the blight's sums and of the events a day returns.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate;
  - `npx vitest run <file>` for one file;
  - `npm run test:browser -- -t <name>` after a scene change (read `e2e/CLAUDE.md` first);
  - give each simulator run its own `--out` under `logs/`, and never run two `make simulate` at once.
- **Commits.** One commit for this step, once `npm test` passes and the guard holds, on `long-campaign-stage-05`, without pushing. Never switch branches. The message is "Stage 5 step 07: day actions as orders", with no attribution lines. This is one of step B's commits.
- **Docs.** CLAUDE.md must stay current. Fix the lines this change makes wrong, and search it for every name you rename or remove.

## 3. Dependencies and prerequisites

- **Step 06 (done first)** provides:
  - `src/game/company.ts` with `passDay`, `advance`, `setOrder`, `advanceRefusal`, `DayReport`, `PartyDay` and `PartyEvent`;
  - the idle, travel and camp orders;
  - `travel` and `campUntilHealed` on the loop;
  - debug `days` on `passDay`;
  - probably a time-free rest used by the camp order. Reuse it (see below) rather than adding a second.
- **Steps 03–05** provide the expedition (C3), the position-dependent signatures (C4) and the places that name the party (C5).
- **Existing code at `4a2b824`, for reference:**
  - `campDay` checks `canCamp`, judges `restHealing` for each member, calls `passTurn`, then heals and fills mana. It returns `{ healed, events }`, or null where it cannot camp.
  - `linger` returns null without monsters here or with the world inactive. Otherwise it clears `confronting` and returns `passTurn`'s events.
  - `buildTower` (and `buildOutpost`):
    - returns null when `canBuildTower` refuses;
    - otherwise spends, pushes the tower, increments `towersBuilt`, and returns `[tower_built, ...passTurn]`.
  - `craft`:
    - refuses with a `{ refusal }`;
    - spends and replaces the item at its place;
    - passes a day (`passTurn`) only at the `'field'` tier;
    - returns `{ refusal: null, item, events }`.
  - `embed` does the same: `embedRefusal`, take from the pouch, spend, replace, and a day only in the field.

## 4. Scope and guidance

1. **Characterization tests first.** Before changing any function, pin today's behaviour in its own test file (`camp.test.ts`, `worldMap.test.ts`, `buildings.test.ts`, `crafting.test.ts`, `runecraft.test.ts`), adding where coverage is missing. For each of `campDay`, `linger` (scout and wait), `buildTower`, `buildOutpost`, field `craft` and field `embed`, pin:
   - the returned shape and values;
   - the events, in order (`tower_built` / `outpost_built` first, then the day's);
   - the stock spent;
   - `world.turn` rising by exactly 1 (0 for a workshop craft or embed);
   - `confronting` afterwards;
   - each refusal: among monsters (where it applies), with the game over (`status` 'lost' and 'won'), without the stock, on the wrong land, and with a stale place.

   They must pass before and after the change, unedited.
2. **Time-free parts**, each in the action's own module. Each does exactly what the function did before its `passTurn`, in the same order, and nothing else:
   - **`camp.ts`: `rest(world: WorldState, party: Expedition): number`.** Each member heals `restHealing(world, party, member)` up to its maximum, and every caster's mana is filled. It returns the hit points restored. The healing must be judged *before* the day's `passTurn`, as today, because `restHealing` reads `atEncampment` and the infirmary. Applying it before `passTurn` rather than after is equivalent, since `passTurn` reads no hit points. If step 06 already made such a function for the camp order, reuse it, renaming it to `rest` only if nothing else depends on its name. The camp order's day stays: rest, then `autoHeal`.
   - **`buildings.ts`:**
     - `raiseTower(world: WorldState, party: Expedition): WorldEvent`: spend `TOWER_COST`, push the tower at `party.position`, increment `towersBuilt`, and return the `tower_built` event;
     - `raiseOutpost(world: WorldState, party: Expedition): WorldEvent`: the same for the outpost, returning `outpost_built`.

     Both assume `canBuildTower` / `canBuildOutpost` said null.
   - **`crafting.ts`:**
     - `craftRefusal(game: GameState, place: ItemPlace, modifier: ModifierId, grade: Grade): string | null`: exactly the refusals `craft` gives today, in the same order and with the same strings;
     - `applyCraft(game: GameState, place: ItemPlace, modifier: ModifierId, grade: Grade): Item`: spend, replace at the place (keeping runes, `clampHp` through `replaceAt`), and return the new item.
   - **`runecraft.ts`:** `applyEmbed(game: GameState, place: ItemPlace, key: RuneKey): Item`: take the rune from the pouch, spend, replace, and return the new item. `embedRefusal` already exists.
   - **Scout and wait** need no helper: the party's day sets `party.confronting = null`.
3. **`act(game, party, action)` in `company.ts`:**
   - **Refusal first, changing nothing.** An unknown party is refused. Otherwise give the action's own refusal, the string today's function gives or implies:
     - **scout and wait:** no monsters here, or the world inactive (linger's null); choose a short refusal string;
     - **camp:** not `canCamp`;
     - **tower:** `canBuildTower`;
     - **outpost:** `canBuildOutpost`;
     - **craft:** `craftRefusal`, plus a refusal if `craftTier` is not `'field'`, as `act` is for field work only;
     - **embed:** `embedRefusal`, with the same field-only rule.

     Also refuse when `advanceRefusal(game)` is non-null and the action does not answer it. Scout and wait answer a confrontation of their own party: `advanceRefusal` lets a confronting party whose order is a day scout or wait pass. A refused `act` changes nothing, not even the order.
   - **Otherwise:** set `order = { kind: 'day', action }` and call `passDay`.
     - In the party's day step: run the time-free part. Push `tower_built` / `outpost_built` onto the report's `events` before `passTurn`'s, in party order. Record `rested` for camp and `made` for craft and embed. Then the order becomes idle.
     - After `passTurn`, emit `order_done` for the party.
     - Return the `DayReport`.
4. **The conveniences, on `act`, with their result shapes unchanged:**
   - **`campDay(game, party)`:** null where it cannot camp; else `{ healed: report.parties[i].rested, events: report.events }`.
   - **`linger(game, party, how)`:** null as today; else `report.events`.
   - **`buildTower(game, party)` and `buildOutpost(game, party)`:** null when refused; else `report.events`, which begins with the building's event.
   - **`craft(game, place, modifier, grade)`:**
     - at a workshop: immediate as today (`craftRefusal`, then `applyCraft`, with `events: []` and no day);
     - in the field: through `act` (the party is `place.party`), returning `{ refusal: null, item: made, events: report.events }`, or `{ refusal }`.
   - **`embed(game, place, key)`:** the same split, as a `RuneResult`.

   Callers (scenes, the simulator, the debug console) need not change. Route the World map's Camp, Scout, Wait, Build Watchtower and Build Outpost buttons, and the crafting screen's field work, through these conveniences or through `act` directly. Either way the result must be the same.
5. **`company.test.ts`** adds, with one party:
   - each `DayAction` through `act`:
     - the day passes once (`world.turn` + 1);
     - the action's effect is done;
     - the events are in order (the building's first);
     - `PartyDay.rested` / `made` are set;
     - the order is idle afterwards, with `order_done` in `partyEvents`;
   - a refused `act` for each kind, changing nothing (turn, stock, order, items);
   - `act` scout and wait while confronting: allowed, `confronting` null afterwards. `passDay` / `advance` stay refused while confronting with any other order;
   - `act` craft and embed at the workshop tier: refused (field only).
6. **Import cycles.** `crafting.ts`, `runecraft.ts`, `buildings.ts`, `camp.ts` and `worldMap.ts` import `company.ts`, and it imports them. Nothing may call across them at module load: no top-level calls, no constants computed from the other module. `company.ts` calls only the time-free parts and refusals, never the conveniences.
7. **CLAUDE.md.**
   - Make the lines for `buildings.ts`, `crafting.ts`, `runecraft.ts` and `camp.ts` (and the rules of the world map where they say a build, camp day, scout, wait or field craft "passes the day") say that the day passes through `company.ts`'s loop as a one-day order (`act`).
   - Add the import cycles to the note that already names `blight.ts`, `territory.ts` and `worldMap.ts`.
   - Keep `company.ts`'s module line current with `act`.

**Exclusions:**
- The simulator's `runCampaign` restructuring (step 08).
- The world map's order line and the Next day / Until buttons (step 09).
- No stage 6 orders.
- Do not change `placeKey` or the save format.

## 5. Verification

- `npm test` passes. The characterization tests from 4.1 pass unedited, and the guard test passes untouched.
- `npx vitest run src/game/company.test.ts` covers every `DayAction`, refusals and `order_done`.
- `npx vitest run --project domain` for quick checks.
- The 50-campaign check: summary identical to step 01's line for line, and the log hash identical.
- `npm run test:browser`: the world and encampment tests pass. The Camp, Scout, Wait, Build and field Craft flows are unchanged.

## 6. Completion criteria

- [ ] Characterization tests for each day-passing function added first, passing before and after.
- [ ] `rest`, `raiseTower`, `raiseOutpost`, `craftRefusal`, `applyCraft` and `applyEmbed` exist, and `company.ts` uses only these and the refusals.
- [ ] `act` per C6, with every `DayAction`. A refused act changes nothing. A day order ends idle with `order_done`.
- [ ] `campDay`, `linger`, `buildTower`, `buildOutpost`, field `craft` and field `embed` go through `act`, with results unchanged.
- [ ] `company.test.ts` covers the above.
- [ ] Guard test unchanged and passing; 50-campaign summary and hash identical to step 01's.
- [ ] CLAUDE.md updated.
- [ ] Committed as "Stage 5 step 07: day actions as orders". The index's row is updated with status and commit.

## Execution record

### Round 1 (implementation)

**What was built.**
- Characterization tests first, each comparing the function's result, events and the whole game (`JSON.stringify(game)`) with a twin game that did the old sequence by hand around `passTurn`, on the first day that brings an event, plus game-over (`lost`, `won`), stock, land, monsters and stale-place refusals changing nothing: `camp.test.ts` (campDay), `worldMap.test.ts` (linger, scout and wait), `buildings.test.ts` (tower, outpost), `crafting.test.ts` (field and workshop craft), `runecraft.test.ts` (field embed). All passed before the change and pass unedited after it.
- Time-free parts: `rest(world, party)` (camp.ts, now also the camp order's rest, replacing step 06's inline copy in company.ts), `raiseTower` / `raiseOutpost` (buildings.ts), `craftRefusal` / `applyCraft` (crafting.ts), `applyEmbed` (runecraft.ts).
- `act(game, party, action)` in company.ts: unknown party, then the action's own refusal (`actionRefusal`: scout/wait "The game is over." / "There are no monsters here to scout or wait at."; camp "<The party> cannot camp here."; `canBuildTower`; `canBuildOutpost`; craft/embed: the place must be this party's, field only ("At the workshop that is done at once, not as a day’s work."), then `craftRefusal` / `embedRefusal`), then `advanceRefusal` as if the party held the day order (`dayRefusal` with an order override; `advanceRefusal` is that with each party's own order). A refused act changes nothing, its standing order included.
- `passDay`: a party's day for a `day` order runs the action (re-checking its refusal, which is pure), records `rested` / `made`, and puts a building's event before `passTurn`'s, in party order.
- Conveniences over `act`, result shapes unchanged: `campDay`, `linger`, `buildTower`, `buildOutpost`, field `craft`, field `embed` (workshop craft and embed stay immediate). No caller changed.
- Follow-ups folded in: (1) debug `goto` sets the party's order idle (test: a travel order, then `goto`, then `days 2` leaves it where it was put); (2) `campUntilHealed` for an already-whole party sets the order idle after its `autoHeal` (guard untouched: same check, same result); (3) `worldInterrupt` tells world from party events by kind (`PARTY_EVENT_TYPES`, typed so that a world event kind clashing with a party event kind fails to compile), not by array identity (test with a structurally equal copy); (4) CLAUDE.md's expedition.ts line describes the standing order run by company.ts.
- CLAUDE.md: camp.ts, buildings.ts, crafting.ts, runecraft.ts, expedition.ts and company.ts lines, and the rules of the world map ("until stage 5 step 07" removed), describe the day actions as one-day orders through `act`; company.ts's line names the new import cycles.

**Deviation.** The task says the party's day step makes the order idle; the order instead stays `day` through `passTurn` and `afterDay` (step 06's code) makes it idle as it emits `order_done`, as `afterDay` needs to know it was a day order. Nothing reads the order between the two, so the result is the same.

**Verification.**
- `npm test`: 80 files, 1315 tests passed (baseline before the change: 1277). Guard test in `scripts/simulate.test.ts` untouched and passing.
- `npx vitest run src/game/company.test.ts`: every `DayAction` through `act`, refusals of each kind changing nothing, a second party's confrontation refusing a camp, `passDay`/`advance` refused while confronting with a camp or day-camp order, `worldInterrupt`, the whole-party `campUntilHealed`.
- 50-campaign check: `npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt`: summary identical to step 01's line for line (diffed); `shasum -a 256 logs/guard-50.jsonl` = `068016a82040ec5be673084265005a7218f0ce927629880565c1a27a8cf52d76`. **Guard identical.**
- `npm run test:browser`: 9 files, 89 tests passed (186 s).

**For later steps.** `act` is the entry for step 09's buttons if they want the `DayReport`; step 08's simulator already reaches the loop through the conveniences. An action's refusal is internal (`actionRefusal`); export it if a scene needs to grey a button by it.
