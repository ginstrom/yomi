# Step 06: The day loop

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-05-company-of-one.md) (§2 "Step B", §5, §6) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §4.2, §5.3

**Difficulty:** intricate and determinism-sensitive. Leave the engineer's model unset (it inherits the session's); the reviewer the same (opus / opus). The guard decides whether this step is right.

## 1. Objective

Add `src/game/company.ts`: one clock for the company. It holds:
- standing orders (`idle`, `travel`, `camp`);
- `passDay`, which runs each party's day by its order and then the world's day once;
- `advance`, which runs days until something happens;
- `setOrder`, `advanceRefusal`, and the `DayReport`.

Then put the two long-running conveniences on the loop: `travel` (`worldMap.ts`) and `campUntilHealed` (`camp.ts`). They keep their names, homes and results, so the scenes and the simulator keep working without change. The guard stays identical.

The `day` order and `act` (scout, wait, camp a day, build, field craft and embed) are step 07's. Do not implement them here; `passDay` may leave the `day` branch to step 07, throwing or treating it as idle with a `// step 07` note.

## 2. Requirements and context

- **S5-R2:** one clock. `passDay` runs each party's order, then the world's day. `advance` stops on an interrupt.
- **S5-R5:** no behaviour changes. The guard (below) must be identical.
- **Design §6:** `company.test.ts` covers `passDay` for each order kind with one party, `advance` stopping on interrupts, and the refusal while confronting. The day actions are added in step 07.

**Corrections from the index that this step carries out:**
- **4. A travel order carries its planned route.** The reference's `{ kind: 'travel'; to }` re-plans each day. Re-planning could choose a different route among equal ones and break the guard, so the order stores the hexes still to walk, planned once when given. `setOrder` takes an `OrderRequest` (`{ kind: 'travel'; to }`) and plans the route.
- **6. Day-passing functions keep their names and homes** (`travel` and `linger` in `worldMap.ts`, `campDay` and `campUntilHealed` in `camp.ts`, `buildTower` and `buildOutpost` in `buildings.ts`, `craft` in `crafting.ts`, `embed` in `runecraft.ts`), so callers and tests keep working.
  - Each becomes a convenience over the loop (`setOrder` + `advance`, or `act`). This step does `travel` and `campUntilHealed`; step 07 does the rest.
  - `company.ts` calls only their time-free parts.
  - This makes import cycles between `company.ts` and those modules. They are safe while no module calls another as it loads, as CLAUDE.md already says of `blight.ts`, `territory.ts` and `worldMap.ts`.
- **7. `DayReport` carries more than the reference's.** It adds `partyEvents` and a `PartyDay` per party (the hex walked, hit points rested and cast, the item a day's craft made). The conveniences need these to return today's `Journey` and `CampResult` unchanged.
- **9. Until something happens stops after `UNTIL_LIMIT` (30) days** if nothing happens. With an idle party in a quiet land it would otherwise not stop. (The message is step 09's; this step defines the constant and `advance`'s default.)
- **10. Orders persist past an interrupt.** After a walk or a stretch of camping is cut short, the party's order stays "Travelling to …" or "Camping".
  - Next day carries it on, and a click on a hex or a button replaces it.
  - A walk's remaining route is the one planned when the order was given (correction 4).
  - The `travel` and `campUntilHealed` conveniences give new orders each time they are called, as the simulator's repeated calls do today.

**Shared constraints (from the index):**
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file;
  - `npm run test:browser -- -t <name>` after any scene change (this step should change no scene; run the world tests anyway if a scene import changed);
  - `npm run simulate -- <flags>`, each run with its own `--out` under `logs/` (gitignored).
- **The refactor guard.**
  - The test `describe('the refactor guard')` in `scripts/simulate.test.ts` must pass. **Never edit its fixture.** A mismatch means this step changed behaviour: find the cause and fix it.
  - The 50-campaign check, before committing:

    ```sh
    npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
    shasum -a 256 logs/guard-50.jsonl
    ```

    The summary must equal step 01's record line for line, and the hash must equal step 01's. Record "guard identical" (or the diff) below.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG, or changes the order or arithmetic of the blight's sums or of the events a day returns.
- **Commits.** One commit, `Stage 5 step 06: the day loop`, once `npm test` passes and the guard holds, on `long-campaign-stage-05`, without pushing. Never switch branches. No attribution lines in the message. This is the first commit of the design's step B.
- **Docs.** CLAUDE.md stays current (its "Keeping this file current" section): fix the lines this change makes wrong.

## 3. Dependencies and prerequisites

**Step 05 is done.** This step consumes, as existing code:

C3 (from `src/game/expedition.ts` and `src/game/gameState.ts`):

```ts
export type Order =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Hex; route: Hex[] }   // route: the hexes still to walk, `to` last, planned once when given (correction 4)
  | { kind: 'camp' }                            // camp until healed: rest, then the party's heals (autoHeal), each day
  | { kind: 'day'; action: DayAction }          // one day's action, then idle

export interface Expedition {
  /** Stable: 'party_1', … */
  id: string
  /** 'First Company' for the first; shown as 'Your party' while it is the only one (correction 3). */
  name: string
  /** The members in battle order, as GameState.party was. */
  members: Party
  /** Its shared pile of items, as GameState.baggage was. */
  baggage: Item[]
  /** Step 04: the hex it stands on, as WorldState.party was. */
  position: Hex
  order: Order
  /** Step 04: the monster location it walked into and has not answered, as WorldState.confronting was. */
  confronting: string | null
}
export function presenceOf(party: Expedition): PartyPresence                // { position, levels: members' levels }
export function presences(parties: readonly Expedition[]): PartyPresence[]  // presenceOf each, in list order

export interface GameState {
  /** The company's parties in order; never empty while the game lasts; one in stage 5. */
  parties: Expedition[]
  world: WorldState
  runes: Pouch          // the company's (correction 8)
  reserves: Character[]
  slot: SlotId | null
  story: StoryState
}
export function partyById(game: GameState, id: string): Expedition | undefined
export function selectedParty(game: GameState, id?: string): Expedition   // partyById, else parties[0]: the scenes' default
```

`DayAction` (C3) exists as a type. This step only needs it to type the `day` order.

C2 and C4 (existing after steps 02 and 04):

```ts
export function passTurn(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
export function isNotable(world: WorldState, event: WorldEvent, presences: readonly PartyPresence[]): boolean
// worldMap.ts
export function monstersHere(world: WorldState, party: Expedition): MonsterLocation | null
export function routeTo(world: WorldState, party: Expedition, to: Hex): Hex[] | null      // null while party.confronting !== null, as today
export function travel(game: GameState, party: Expedition, to: Hex): Journey
// camp.ts
export function canCamp(world: WorldState, party: Expedition): boolean
export function campDay(game: GameState, party: Expedition): CampDay | null
export function campUntilHealed(game: GameState, party: Expedition): CampResult | null
// infirmary.ts
export function restHealing(world: WorldState, party: Expedition, member: Character): number
```

Also existing: `autoHeal(party: Party): number` (`party.ts`), `partyWounded(party: Party)` (`camp.ts`), `worldActive(world)`, `locationAt(world, hex)`, `NOTICE_RADIUS`, and `Journey` (`worldMap.ts`) and `CampResult` (`camp.ts`), whose shapes do not change.

**What later steps consume.** C6 exactly as below:
- step 07 adds `act` and the `day` order;
- step 08 drives the simulator with `setOrder`, `advance` and the conveniences;
- step 09 calls `passDay` and `advance` from the world map.

## 4. The contract this step produces (C6, from the index, unchanged)

```ts
// src/game/company.ts (new)
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

**A party's day, by order** (before `passTurn`):
- **idle:** nothing.
- **travel:** step onto `route[0]` (removed from the route): `position = hex`, `walked = hex`.
- **camp:** rest (each member heals `restHealing` up to its maximum, judged before the day's events, and every caster's mana is filled), then `autoHeal(members)`. Record `rested` and `cast`.
- **day:** run the action's time-free part (step 07), then the order becomes idle.

**After `passTurn`, for each party in list order:**
- **travel:**
  - If it stands on `to`: emit `arrived`; if monsters stand there, set `confronting` and emit `confronting`; the order becomes idle.
  - Else, if the route's next hex is not `to` and a monster location stands on it: the order becomes idle and `order_done` is emitted (the road is blocked).
- **camp:** if no member is wounded, or it can no longer camp: the order becomes idle and `order_done` is emitted.
- **day:** `order_done`.

**The conveniences return exactly what they return today** (results, state changes, refusals):
- `travel` sets a travel order and advances with no limit, and maps the reports onto `Journey`. It covers:
  - no route, or a world that is not active: an empty journey and nothing changed;
  - an interrupt on the way or on the arrival day;
  - a road blocked at its first hex;
  - the world ending mid-walk;
  - `confronting` afterwards, `monstersHere` of where it stopped.
- `campUntilHealed`:
  - refuses where it cannot camp;
  - casts `autoHeal` once;
  - camps no day if everyone is whole;
  - otherwise sets the camp order and advances with no limit, mapping the reports onto `CampResult`.
- The other day-passing functions (`campDay`, `linger`, `buildTower`, `buildOutpost`, a field `craft`, a field `embed`) become `act` with the matching `DayAction` in step 07. Their results, events and refusals are unchanged. **In this step they keep calling `passTurn` directly, as after step 05.**

## 5. Scope and guidance

Inspected: `src/game/worldMap.ts` (`travel`, `routeTo`, `isNotable`, `monstersHere`) and `src/game/camp.ts` (`campDay`, `campUntilHealed`), as at `4a2b824`; step 04 changed their parameters (C4). Proposed: `src/game/company.ts` and `src/game/company.test.ts`.

### 5.1 Characterization tests first

Before changing `travel` or `campUntilHealed`, write tests that pin what they do now. Put them in `worldMap.test.ts` and `camp.test.ts`, beside the existing ones, or extend those. Commit nothing until all pass on the unchanged code; then they must pass, unchanged, after the change.

- **`travel`:**
  - no route (off the board, the same hex, or while confronting): an empty journey, and no turn, position, order or `confronting` change;
  - a world that is not active: the same;
  - an interrupt mid-walk: `walked` stops at that hex, `interruptedBy` is the first notable event of that day, and `confronting` is null;
  - an interrupt on the arrival day at monsters: `interruptedBy` is set, and `confronting` is set too;
  - a road blocked by a nest that spawned on it since the route was planned (put a monster location on a later hex of the planned route mid-walk, or arrange a spawn). Today the walk breaks **before** stepping onto the blocked hex, and no day passes for it. `walked` ends at the hex before.
  - a road blocked at its very first hex: an empty walk; `confronting` is recomputed as `monstersHere` of where the party stands (as today's code does after its loop);
  - arrival at monsters: `confronting` is that location's id;
  - arrival on open land: `confronting` is null;
  - the world ending mid-walk (the encampment lost): the walk stops after that day;
  - `world.turn` advances by exactly `walked.length`.
- **`campUntilHealed`:**
  - where it cannot camp: null, nothing changed;
  - a whole party: `days` 0, `cast` from the one `autoHeal`, no turn passed;
  - a wounded party: `days`, `rested` and `cast` as today, and the members' hit points and mana;
  - interrupted by a notable event: it stops after that day with `interruptedBy` set;
  - the encampment lost mid-camp: it stops.

### 5.2 `company.ts`

Implement C6 as written. The points that keep it identical to today:

1. **Travel's blocked check moves, without adding a day.**
   - Today the route is planned once, and before each step the loop asks whether the next hex (if not `to`) holds monsters, breaking without passing a day.
   - In the loop this check runs **after the previous day's `passTurn`**, in the after-day checks, so the order is idle before the next day starts and `advance` stops on its `order_done`.
   - The first hex has no previous day. The `travel` convenience checks it itself after `setOrder`, before advancing. If it is blocked, it returns an empty journey with `confronting = monstersHere(world, party)?.id ?? null` (as today) and the order idle.
2. **Camp's rest is equivalent applied before `passTurn`.**
   - Today `campDay` reads each member's `restHealing` before `passTurn` and applies it after.
   - `restHealing` reads `atEncampment` and the infirmary, never hit points, and `passTurn` reads no hit points. So in the party's day, judge the healing, apply it, fill mana, then `autoHeal`, all before `passTurn`. The result is the same.
   - The order ends in the after-day checks: when no one is wounded, or `canCamp` is false (e.g. the encampment fell that day). This mirrors today's `while (partyWounded && canCamp)`.
3. **The interrupt.** It is the first notable world event in `events` order (`isNotable(world, event, presences(game.parties))`, measured after the day's moves), else the first party event.
   - For a `sighted` event, `party` is the nearest party within `NOTICE_RADIUS` (for the Source, the nearest), the first in list order on a tie.
   - Other world events have `party: null`. A party event has its own party.
4. **`advance`** stops after the first report with an interrupt, when the world stops being active, when `advanceRefusal` refuses (returning the reports so far, `[]` if refused at once), or after `limit` days. The conveniences pass `Infinity`.
5. **`advanceRefusal`.**
   - When `!worldActive(world)`: a short sentence such as "The game is over."
   - When a party is confronting monsters and its order is not a day order of `scout` or `wait`: a sentence naming the monsters, e.g. "Your party stands before the Kobold Scouts: scout, wait or attack." (In this step no scout/wait order exists yet, so any confronting party refuses.)
6. **`setOrder`.**
   - An unknown party id is refused.
   - Travel is refused where `routeTo` is null (which covers confronting) or the world is not active. Camp is refused where `canCamp` is false. Idle always succeeds.
   - Refusals are sentences, as elsewhere.
   - A new order replaces the old one (correction 10).
7. **The conveniences.**
   - `travel(game, party, to)`:
     - with no route, or a world that is not active, it returns an empty journey and changes nothing;
     - else `setOrder` travel, the first-hex check, then `advance(game, Infinity)`;
     - it builds `Journey` from the reports: `walked` from `PartyDay.walked`, `events` concatenated, `interruptedBy` the interrupt's event when it is a world event, else null.
     - It leaves `party.confronting` exactly as today. `confronting` is set by arrival, and otherwise stays null after an interrupted walk, because `routeTo` required it null to start.
     - It leaves the order as the loop left it: idle on arrival or a block, still travel after an interrupt (correction 10).
   - `campUntilHealed(game, party)`:
     - if `!canCamp`, null;
     - `cast = autoHeal(members)`; if no one is wounded, return `days: 0`;
     - else `setOrder` camp and `advance(game, Infinity)`, summing `rested`, `cast` and the days from its `PartyDay`s;
     - `interruptedBy` is the interrupt's world event, else null (an `order_done` is not an interruption).
   - Both may live where they are and import `company.ts` (correction 6).
8. **Party events and orders, in after-day order.** Process parties in list order. A party's day must never read another party's state. There is one party today, but keep that rule for stage 6.
9. **Stage 6 hooks.** Write `passDay`'s per-order code as a `switch` on `order.kind`, so stage 6 adds `home`, `garrison` and `meet` as cases. Do not add them.

### 5.3 Callers

- The simulator (`scripts/simulate.ts`) and the scenes keep calling `travel` and `campUntilHealed`. They change only if an import moves; their behaviour must not.
- **The debug console's `days <count>`** (`src/scenes/debugCommands.ts`) now calls `passDay` `count` times, so the parties keep their orders (an idle party does nothing, as before).
  - It stops early, with a line saying why, when `passDay` returns null (`advanceRefusal`).
  - It reports the world events as before.
  - Update `debugCommands.test.ts`.

### 5.4 Tests: `src/game/company.test.ts` (new)

- **`passDay` with one party:**
  - idle: one turn passes, `events` equal what `passTurn` alone would give on a cloned game, and the party does not move;
  - travel: it moves one hex along the planned route a day; `arrived` on reaching `to`; `confronting` and the location set on monsters; the order idle after;
  - a blocked road: `order_done`, and the order idle without moving;
  - camp: `rested` and `cast` reported, mana filled, `order_done` once whole, and also when the encampment falls.
- **`setOrder`:** an unknown party, travel with no route or while confronting, camp where it cannot camp; idle always; the travel route equals `routeTo`'s.
- **`advance`:** it stops
  - on the first notable event (`interrupt` set, and `interrupt.party` the party for a nearby `sighted`, null for a site event);
  - on an `order_done`;
  - when the world stops being active;
  - at `limit` (`UNTIL_LIMIT` by default) for an idle party in a quiet land;
  - with `[]` while confronting, and `advanceRefusal` says why.
- **Report shapes:** a `PartyDay` per party, in list order, with `made: null`.
- **Orders persist (correction 10):** after an interrupted walk the order is still travel with the remaining route; another `passDay` continues it.
- **Equivalence:** for a seeded world, `travel` through the loop gives the same `Journey`, turn, blight and position as the characterization tests pinned.

### 5.5 Exclusions

- No `act` and no `day` order behaviour (step 07).
- No change to `campDay`, `linger`, `buildTower`, `buildOutpost`, `craft` or `embed` (step 07).
- No scene buttons or order line (step 09).
- No change to the simulator's structure (step 08).

### 5.6 CLAUDE.md

- Add `src/game/company.ts` to the domain list, in one line: the company's one clock, orders run day by day (`passDay`, `advance`, `setOrder`), and `travel` and `campUntilHealed` as conveniences over it.
- Add the module-cycle note: `company.ts` and the modules whose day-passing functions delegate to it import each other, safe while none calls another as it loads.
- Rules of the world map:
  - every day passes through `passDay`: each party's order, then `passTurn` once;
  - a journey and camping until healed are orders run until an interrupt;
  - orders persist past an interrupt;
  - a travel order keeps the route planned when given.
- Fix the line about `days` in the debug console description if it names `passTurn`.

## 6. Verification

- `npx vitest run src/game/company.test.ts src/game/worldMap.test.ts src/game/camp.test.ts src/scenes/debugCommands.test.ts`.
- The characterization tests (§5.1) were green before the change, and are unchanged and green after.
- `npm test` passes, the refactor guard included, its fixture untouched.
- The 50-campaign check: the summary is identical to step 01's record line for line, and the `shasum` equals step 01's.
- `npm run test:browser -- -t world` (the world map walks and camps through the conveniences).

## 7. Completion criteria

- [ ] `src/game/company.ts` implements C6 as written (but `act` and the `day` order, which are step 07's).
- [ ] `travel` and `campUntilHealed` run on the loop, with results identical to before (characterization tests).
- [ ] `company.test.ts` covers §5.4.
- [ ] Debug `days` runs on `passDay`.
- [ ] CLAUDE.md updated (§5.6).
- [ ] `npm test` passes; the guard is identical (test, summary and hash), recorded below.
- [ ] Committed as `Stage 5 step 06: the day loop`; the index's table shows step 06 done with the hash.

## 8. Execution record

