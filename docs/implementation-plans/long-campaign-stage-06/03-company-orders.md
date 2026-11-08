# Step 03: Orders for a company

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-06-multiple-parties.md) (S6-R2, S6-R3; §6 tests A3–A6) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §4.2 (orders), §4.4 (edge cases), §5.3 (the day loop)

**Difficulty:** opus / opus. Leave the engineer's and the reviewer's model unset. This step changes the day loop every party runs on (`partyDay`, `afterDay`, `setOrder`), the save format and the order shown on the map; a slip in the order of a day's effects breaks the refactor guard, and the two-party rules (stopping short, meeting) are new behaviour that later steps and the simulator's policy build on.

## 1. Objective

The company's parties can be given every order the design names:
- **home:** travel to the encampment, then idle;
- **garrison:** stay on a held resource site, pushing the blight back, with no end of its own;
- **meet:** walk a hex a day toward another party's current hex until the two share a hex;

besides stage 5's idle, travel, camp and day orders. A new party event, `met`, ends a meet. A travel or home order stops short of a monster location another party stands on. `partyNoun` and `blockingParty` are exported for the scenes (step 07). The save holds the new orders (`SAVE_VERSION` 22). The tests prove the loop over two parties: both travel, a one-day action passes the day for both, interrupts come from either party, and influence, sight, garrisons and spawns work over two presences.

Play is unchanged for a company of one that is never given a new order, so the refactor guard stays identical: the simulator gives none of the new orders.

## 2. Requirements and context

- **S6-R2:** all orders, interrupts with focus (focus is step 07's), and confrontation blocking for every party (company R5–R7).
- **S6-R3:** meeting on a shared hex (company R9; exchange itself is step 05).
- **Design acceptance criteria this step covers:**
  - **A3:** `passDay` moves every party one day of its order, then runs the world's day once. Two travelling parties both advance each day.
  - **A4:** a selected party's one-day action passes the day for all parties.
  - **A5:** advancing stops on the first notable event of any party and names it. It refuses while a confrontation is unanswered.
  - **A6:** influence and sight sum over parties. A garrisoned site does not fall. Spawns keep clear of all parties.
- **Edge cases (design §4.4):** two parties arriving at the same monsters on the same day: the earlier party in the order confronts them, the other stops one hex short and idles. A party ordered to meet a party that is wiped or disbanded becomes idle, with an interrupt.

### Decisions from the index (unchanged)

- **4. Party ids and names.** Ids are `party_1` to `party_3`; a new party takes the lowest free number. Default names `First Company`, `Second Company`, `Third Company` by that number (`PARTY_NAMES`). A rename is 1 to 16 characters, trimmed, unique among the parties (case-insensitive). The map keeps showing "Your party" while the company has one party (stage 5's user decision); with two or more it shows the names.
- **5. Orders.** `home` is a travel order to the encampment with its own kind (label "Returning home"). `garrison` is allowed only on a held resource site (not the encampment; road hexes are stage 8), does nothing and never ends by itself (label "Garrisoning <site>"). `meet` re-plans its route to the other party's current hex every day, ends with a `met` party event when the two share a hex, and becomes idle with `order_done` when the other party is gone. A meet may step onto a monster location the other party stands on, and then confronts it too.
- **6. Stopping short.** A travel or home order never steps onto a monster location another party stands on: the party stays, its order becomes idle and `order_done` is emitted (design §4.4, "two parties arrive at the same monsters").
- **12. Interrupts and refusals** name the party when the company has two or more ("Second Company: arrived at Kobold Scouts."). When Next day or Until something happens is refused because a party confronts monsters, the map selects and centres that party (`blockingParty`). One exported `partyNoun` replaces the private copies.
- **14. Saves.** `SAVE_VERSION` 20 → 21 in step 02 (a saved battle names its party) and → 22 in step 03 (the new order kinds). 21 is never released and reads as unreadable, as do stage 5's version-20 saves; the version-18 migration (`migrateFrom18`) is kept and now yields version 22's shape. No other migration.

### Contracts (copied unchanged from the index)

**C3. Orders for a company (this step):**

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
export const ORDER_KINDS: readonly Order['kind'][]   // all seven
export const MAX_PARTIES = 3
export const PARTY_NAMES: readonly string[] = ['First Company', 'Second Company', 'Third Company']
export function partyId(n: number): string            // `party_${n}`
export function newExpedition(members: Party, position: Hex, id = FIRST_PARTY_ID, name = FIRST_PARTY_NAME): Expedition
// src/game/company.ts
export type OrderRequest = { kind: 'idle' } | { kind: 'travel'; to: Hex } | { kind: 'home' } | { kind: 'camp' } | { kind: 'garrison' } | { kind: 'meet'; party: string }
export type PartyEvent =
  | { type: 'arrived'; party: string; at: Hex }
  | { type: 'confronting'; party: string; location: string }
  | { type: 'order_done'; party: string }
  | { type: 'met'; party: string; other: string }
export function partyNoun(game: GameState, party: Expedition): string   // 'The party' with one party, else its name
export function blockingParty(game: GameState): Expedition | null      // the first party whose confrontation makes advanceRefusal refuse
export const SAVE_VERSION = 22   // save.ts
```

- **setOrder:** `home` plans `routeTo` the encampment (refused at home: "<noun> is already home."); `garrison` refused unless the party stands on a held resource site and is not confronting; `meet` refused for itself, an unknown party, while confronting, on the same hex ("already together"), or with no route.
- **A party's day:** `travel`/`home` step `route[0]`, unless it is a monster location another party stands on (decision 6: idle, `order_done`); `meet` steps the first hex of a fresh `routeTo` the other's position (none if already there); `garrison` nothing.
- **After the day:** `home` as `travel` (`arrived`, idle); `meet`: same hex → `met` (party = the mover, other = the met), idle, and `confronting` set if monsters stand there; other party gone → idle, `order_done`.
- The interrupt rule is unchanged (first notable world event, else the first party event).
- `orderLabel` (partyList.ts): `home` "Returning home", `garrison` "Garrisoning <site>", `meet` "Meeting <name>".

**C1 (step 01, consumed here):**

```ts
// src/game/company.ts (new exports)
/** Starts party `party`'s travel order to `to`: 'refused' (setOrder said no; nothing changed), 'blocked' (a nest on the route's first hex short of `to`: order idle, confronting = monstersHere(...)?.id ?? null), else 'started'. */
export type TravelStart = 'started' | 'blocked' | 'refused'
export function startTravel(game: GameState, party: Expedition, to: Hex): TravelStart
/** act's checks without the day: the action's own refusal, then the day's (advanceRefusal with this order); else sets { kind: 'day', action } and returns null. act = orderAction, then passDay. */
export function orderAction(game: GameState, id: string, action: DayAction): string | null
```

**C2 (step 02, consumed here):**

```ts
// src/game/save.ts
export interface SavedBattle { location: string; party: string; engine: BattleSnapshot; enemyRng: number; ground: GroundPile[] }
export const SAVE_VERSION = 21
```

`parseSave` refuses a battle whose `party` is not a party of the game. This step raises the version to 22 and keeps that check.

### Shared constraints (from the index)

- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, each `CampaignRecord` and a SHA-256 of every battle event against a fixture. **Do not edit the fixture**; keep it green. A mismatch means the step changed play: find the cause and fix it.
- **The 50-campaign check.** Run it before committing and record "guard identical" or the diff:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  It must match step 01's record line for line and hash for hash. Use this exact `--out` path, as the summary's first line names it.
- **Determinism.** Add, drop or reorder no draw of the world RNG or a battle's RNG, and keep the order of a day's events. Parties act in list order.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before the commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - give each simulator run its own `--out` under `logs/` (gitignored); never run two `make simulate` at once.
- **Commits.** One commit for this step once `npm test` passes and the guard holds, on `long-campaign-stage-06`, without pushing. Never switch branches. Message "Stage 6 step 03: orders for a company". No attribution lines.
- **Docs.** CLAUDE.md stays current: fix the lines this change makes wrong (the `Order` list in the `expedition.ts` and `company.ts` lines, the world map's rules on orders, the save version in the rules of saving), and search it for every name you rename or remove.

## 3. Dependencies and prerequisites

- **Step 01 (done first)** provides `startTravel` and `orderAction` in `company.ts` (C1). `worldMap.travel` uses `startTravel`; use it for `home` where a convenience is wanted, and keep `orderAction`/`act` as they are.
- **Step 02 (done first)** provides `SavedBattle.party` and `SAVE_VERSION` 21 (C2). This step raises it to 22.
- **Existing code at `63d2ea1`, for reference:**
  - `src/game/expedition.ts`: `Order` (idle, travel with `route`, camp, day), `ORDER_KINDS`, `FIRST_PARTY_ID`, `FIRST_PARTY_NAME`, `newExpedition(members, position)` (always `party_1`, `First Company`), `presenceOf`, `presences`.
  - `src/game/company.ts`: a private `partyNoun`; `dayRefusal`/`advanceRefusal` (refuses while a party confronts monsters and its order is not a scout or wait); `setOrder` (idle, travel, camp); `roadBlocked`; `partyDay` (travel steps `route[0]`; camp rests and heals; day runs its action); `afterDay` (travel: `arrived` and `confronting` on reaching `to`, `order_done` on a blocked road; camp: `order_done` when whole or unable to camp; day: `order_done`); `PARTY_EVENT_TYPES` (keyed so that a party event's type cannot clash with a world event's); `sightingParty`; `interruptOf`; `passDay` (every party's day in list order, then `passTurn(world, presences(parties))` once, then `afterDay` in list order); `advance`; `act`.
  - `src/game/save.ts`: `isOrder` validates a known kind, a travel order's `to` and `route`, a day order's action; `migrateFrom18` builds `{ kind: 'idle' }` orders; the fixture `src/game/fixtures/save-v18.json`.
  - `src/scenes/partyList.ts`: `orderLabel(world, party)` ("Before the …", "Idle", "Travelling to …"/"Travelling", "Camping", the day actions); `standingRoute` (what is left of a travel order).
  - `src/scenes/debugCommands.ts`: `party` lists each party as `<label> at <hex>, order <kind>…`.
  - `world.held`: the ids of held sites; `sites(world)` and the encampment (`ENCAMPMENT_ID`); a resource is a quiet location whose kind is not `'encampment'`.

## 4. Scope and implementation guidance

### 4.1 `expedition.ts`

- Widen `Order` and `ORDER_KINDS` to the seven kinds of C3.
- Add `MAX_PARTIES`, `PARTY_NAMES`, `partyId(n)`, and the optional `id` and `name` parameters of `newExpedition` (defaults unchanged, so every existing caller is untouched).
- Update the comment over `Order` ("stage 6 adds …" no longer holds).

### 4.2 `company.ts`

- **Export `partyNoun`** (unchanged behaviour: `'The party'` while the company has one party, else its name) and use it wherever the module named a party. Step 07 replaces the scenes' own wording with it.
- **`blockingParty(game)`:** the first party, in list order, for which `dayRefusal` would refuse with today's orders (confronting, order not a scout or wait); null when none. `advanceRefusal` must still give exactly today's message. Refactor so the two share one loop.
- **`OrderRequest` and `setOrder`** as C3:
  - `home`: refused while confronting (as travel), at the encampment (`<noun> is already home.`), or with no route; else `{ kind: 'home', to: <encampment>, route: routeTo(...) }`.
  - `garrison`: refused unless the world is active, the party is not confronting, and it stands on a resource site in `world.held` (not the encampment). Refusal wording is the engineer's ("Only a held site can be garrisoned.").
  - `meet`: refused for its own id, an unknown party, while confronting, on the same hex (`… already together.`), or when `routeTo` the other's position is null.
  - Keep idle, travel and camp exactly as they are.
- **`partyDay`:**
  - `travel` and `home` share one path. Before stepping onto `route[0]`, if that hex is a monster location (`locationAt(...).kind === 'monsters'`) on which another party stands (`position` equal), do not step: the order becomes idle and the party gets an `order_done` this day (decision 6). Carry that through to `afterDay`'s events in the same order position as today's events (party events are collected after `passTurn`, in list order). Because parties act in list order, the earlier party steps onto the nest first and the later one stops short; this also covers a nest a party already stands before.
  - `meet`: find the other party; if it is gone, do nothing (afterDay ends the order). Else plan `routeTo(world, party, other.position)`; with a route of one hex or more step onto its first hex; with none (already together, or no way) do nothing. No stop-short rule for a meet (decision 5).
  - `garrison`: nothing.
- **`afterDay`:**
  - `home` exactly as `travel` (`arrived`, `confronting` if monsters, idle; road blocked → idle, `order_done`). Reuse `roadBlocked` (widen its parameter to both kinds).
  - `meet`: other party gone → idle, `order_done`. Same hex as the other → `{ type: 'met', party: <mover>, other: <met> }`, idle, and if monsters stand there set `confronting` and emit `confronting` after `met`. Otherwise nothing; the meet goes on.
  - `garrison`: nothing, ever.
- **`PartyEvent`** gains `met`; add it to `PARTY_EVENT_TYPES` (the type-level check against world event kinds must still compile).
- `interruptOf` is unchanged: the first notable world event, else the first party event, so a `met` interrupts.
- `advanceRefusal`'s rule is unchanged for every order kind: a confronting party blocks unless its order is a scout or wait.
- Determinism: a day with only idle, travel, camp and day orders must produce exactly today's events in today's order.

### 4.3 `partyList.ts`

- `orderLabel`: `home` → `'Returning home'`; `garrison` → `'Garrisoning <site name>'` (the site the party stands on; with none found, `'Garrisoning'`); `meet` → `'Meeting <name>'` with the other party's stored name (`'Meeting'` if it is gone). The switch must be exhaustive (TypeScript will tell).
- `standingRoute` draws a `home` order's remaining route as it draws a travel order's.

### 4.4 `save.ts`

- `SAVE_VERSION = 22`; the version-18 migration still loads, into the new shape (orders stay idle); version 21 and 20 read as unreadable.
- `isOrder` accepts the seven kinds: `home` checked as `travel` (`to` and `route` hexes); `garrison` with no fields; `meet` with a string `party` that names a party of the same save (refuse otherwise). Keep the existing checks for the others.
- Update the comment over `SAVE_VERSION` and CLAUDE.md's rules of saving (version 22; 21 never released).
- Tests in `save.test.ts`: round-trip a company of two with a `home`, a `garrison` and a `meet` order; refuse a `meet` naming an unknown party and an unknown kind; the v18 fixture still loads (existing test, now asserting version 22's shape).

### 4.5 `debugCommands.ts`

- `party` lists each order with its detail: `order travel to <hex>`, `order home`, `order garrison`, `order meet <party id>` (format is the engineer's; keep it one line a party). Update its test.

### 4.6 Exclusions

- No scene control gives the new orders yet (step 07: Home, Garrison, meet by clicking). No exchange (step 05), no forming parties (step 04): tests build a second party by hand.
- The simulator gives none of the new orders (step 10). `scripts/simulate.ts` should need no change; if `tsc` requires an exhaustive switch there, add the cases without changing behaviour.
- Do not change `placeKey`, the pouch or the story's `{leader}` (index decision 18).

## 5. Verification

### Tests (in `npm test`)

Build a second party in tests with:

```ts
const second = newExpedition(members, position, partyId(2), PARTY_NAMES[1])
game.parties.push(second)
```

using fresh characters (e.g. from `readyMadeParty()` or `draftCharacter` of a preroll with another name) and a position near home. Use `newGame(undefined, null, <seed>)` and the debug-style setters (`goto`'s approach: set `position`, call `updateSight(world, presences(game.parties))`) to arrange states.

**`src/game/company.test.ts`:**
- **A3:** two parties given travel orders to different hexes both step one hex each `passDay`, in list order, and the world's turn rises by one a day; each arrives with its own `arrived` event.
- **A4:** with two parties, the second travelling, `act(game, first.id, { kind: 'camp' })` (or a tower/wait as convenient) passes exactly one day: the second party also steps a hex, the world's turn rises by one, and the first ends idle.
- **A5:**
  - an interrupt from either party: a `sighted` event near only the second party names the second (`interrupt.party`); an `arrived` of the second is the interrupt when nothing notable happens; `advance` stops on it;
  - with the first party confronting monsters (and not scouting or waiting), `passDay` returns null, `advanceRefusal` names it (with two parties, by its name), and `blockingParty` returns it; with neither confronting, `blockingParty` is null.
- **Each new order and its refusals:**
  - `home`: plans to the encampment, walks it, `arrived` then idle; refused at home and while confronting.
  - `garrison`: accepted on a held resource site, refused on the encampment, on an unheld site, off any site and while confronting; a garrisoned party never emits an event of its own over 30 days and its order stays `garrison`.
  - `meet`: two parties some hexes apart, one meeting the other (standing still): it closes a hex a day and ends with `met` (party and other right) and idle; both meeting each other converge; refused for itself, an unknown id, the same hex, while confronting; the other party removed from `game.parties` mid-walk → idle and `order_done`.
  - **Stopping short:** two parties travelling to the same monster location so that they would step onto it on the same day: the first in list order arrives and confronts, the second stays one hex short, idle, with `order_done`. A party travelling to a nest another party already stands before stops short likewise.
  - A meet that ends on a monster location the other party stands before confronts it too.
- The company-of-one characterization tests from stage 5 still pass unchanged.

**`src/game/blight.test.ts`, `src/game/vision.test.ts`, territory tests (A6):**
- Influence over two presences is the sum of both (a hex between them gets both pushes) and both presences' hexes are neutral.
- Sight is the union of `PARTY_VISION` around each presence.
- **A garrisoned site holds:** a held resource site under threat (a nest close enough that, with no party, `daysToFall` is finite and the site would be lost within 30 days, which the test checks first on a copy or with no party), with a second party given `garrison` on it: after 30 `passDay`s the site is still in `world.held` and its hex's level never rose.
- **Spawns keep clear of both parties:** with spawn pressure forced (as existing spawn tests do), no spawn lands within `SPAWN_CLEARANCE` of either presence.

**`src/scenes/partyList.test.ts`:** the three new labels, and `standingRoute` for a `home` order.

### Commands

```sh
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
shasum -a 256 logs/guard-50.jsonl
```

Expected: `npm test` passes with the guard test untouched and green; the 50-campaign summary and hash equal step 01's. If `partyList.ts` or the world map's probe changed in a way the in-browser tests read, run `npm run test:browser -- -t world` and `-- -t saves` (the saves test reads the save version).

## 6. Completion criteria

- [x] The seven order kinds, `met`, stopping short, `partyNoun`, `blockingParty`, `partyId`, `PARTY_NAMES`, `MAX_PARTIES` and the widened `newExpedition` exist as C3 says.
- [x] `orderLabel` and `standingRoute` cover the new kinds; debug `party` shows them.
- [x] `SAVE_VERSION` is 22; the new orders round-trip; the v18 fixture loads.
- [x] The tests of §5 exist and pass (A3, A4, A5, A6, each order and refusal).
- [x] `npm test` passes; the guard test is unedited and green; the 50-campaign check is identical to step 01's ("guard identical" recorded).
- [x] CLAUDE.md updated (orders, `PartyEvent`, save version, the edge cases of meeting and stopping short).
- [x] One commit, "Stage 6 step 03: orders for a company", no attribution lines; the index's row 03 updated with status and commit.

## 7. Execution record

- **Done:** `Order` has seven kinds (`home`, `garrison`, `meet` added); `MAX_PARTIES`, `PARTY_NAMES`, `partyId`, `newExpedition(members, position, id?, name?)` (expedition.ts). company.ts: exported `partyNoun`; `blockingParty`, sharing one loop (`firstBlocking`) with `dayRefusal`, so `advanceRefusal`'s words are unchanged; `setOrder` for `home` (refused while confronting, at home "<noun> is already home.", no route), `garrison` (refused unless active, not confronting and on a held resource, by buildings.ts's `outpostSite`) and `meet` (refused for itself, unknown, confronting, same hex "<noun> and <name> are already together.", no route); `partyDay` walks travel and home on one path and stops short (idle, `stoppedShort`) of a monster location another party stands on, steps a meet along a fresh `routeTo`, and does nothing for a garrison; `afterDay` (now `(game, party, done)`) emits the stopped-short `order_done` in the party's list position, treats home as travel, and ends a meet with `met` (then `confronting` if monsters stand there) or `order_done` when the other is gone. `PartyEvent` gains `met`. `SAVE_VERSION` 22; `isOrder` checks home as travel and a meet's party against the save's party ids. `orderLabel` covers the new kinds; `standingRoute` draws a home order. Debug `party` shows `order travel to <col,row>`, `order home`, `order garrison`, `order meet <id>`, `order day <action>`.
- **Tests:** company.test.ts: a company of two (A3 both walk; A4 one's act passes the day for both; A5 a sighting near only the second names it, the second's arrival interrupts, confrontations refuse and `blockingParty` finds the party, a wait answers it; `partyNoun`); home (walks and arrives idle; refused at home, by name with two, and while confronting); garrison (30 days with no event of its own; refused on the encampment, unheld site, off a site, confronting); meet (closes a hex a day to `met`; mutual meet converges with two `met`s; refusals; other gone → `order_done`; ends on the other's nest and confronts it); stopping short (two parties onto one nest the same day; travel and home onto a nest another stands on). A mutation check (disabling the stop-short rule) fails the two stop-short tests. territory.test.ts: a garrisoned Gold Seam holds 30 days under a siege that takes it unguarded, its hex never rising. save.test.ts: version 22; a current save marked 20 or 21 unreadable; a company of two round-trips home, garrison and meet; a meet naming no party, a home without route and an unknown kind refused; the v18 migration re-serialises as version 22. partyList.test.ts: the three labels, `deployedParties` naming the met party, `standingRoute` for home. worldEvents.test.ts: `met`'s words. debugCommands.test.ts: the order detail.
- **Gates:** `npm test` 80 files, 1385 tests passed (1362 before), the refactor guard unedited and green. 50-campaign check: hash `068016a82040ec5be673084265005a7218f0ce927629880565c1a27a8cf52d76`, every summary figure equal to step 01's record (**guard identical**). `npm run test:browser -- -t world` 47 passed; `-- -t saves` 1 passed.
- **Deviations:** `orderLabel(world, party, parties = [party])` takes the company's parties (optional third argument) to name a meet's other party; `deployedParties` and WorldScene pass `game.parties`. `describePartyEvent` (worldEvents.ts) had to cover `met` for exhaustiveness: "The parties meet." for now; step 07 words interrupts by party name. `scripts/simulate.ts`'s `order` decision is typed `Extract<OrderRequest, idle | travel | camp>` (type only, no behaviour change); step 10 widens it. A6's influence, neutral hexes, sight union and spawn clearance over two presences were already tested by stage 5 (blight.test.ts "the rules over several parties", vision.test.ts "the sight of several parties"), so only the garrison test was added.
- **For later steps:** a meet does not stop short (decision 5) and has no road-blocked check; it re-plans daily, so a nest sighted on the way is routed around next day. `met` is emitted by the mover only; when both meet each other, each emits one.
