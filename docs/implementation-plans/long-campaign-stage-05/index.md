# Implementation plan: long campaign, stage 5 (a company of one)

The game moves from one party woven through the world state to a **company**, a list of parties (expeditions), here a list of one, whose days run through a **loop of standing orders**. Nothing about play changes except:
- the order shown beside the party ("Travelling to Troll Lair", "Camping", "Idle");
- two new buttons, **Next day** and **Until something happens**;
- debug commands that take an optional party, and `party` listing the company.

It is a refactor guarded by a seeded simulator run that must stay identical from the first step to the last.

**Source design:** [`docs/designs/long-campaign/stage-05-company-of-one.md`](../../designs/long-campaign/stage-05-company-of-one.md) (status "ready for planning"). Its reference is [`reference/multiple-parties.md`](../../designs/long-campaign/reference/multiple-parties.md) §4.2, §5.1, §5.2, §5.3 and §7.3 steps 1–2. Stage 6 ([`stage-06-multiple-parties.md`](../../designs/long-campaign/stage-06-multiple-parties.md)) builds on this stage; its needs shaped the types below, but none of its work is planned here. Conventions: [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md). Written against commit `4a2b824` on branch `long-campaign-stage-05` (off `main`). Feature record: [`docs/features/long-campaign-stage-05.md`](../../features/long-campaign-stage-05.md).

## Corrections and decisions

The plan follows the stage design, then the reference, then the code (where they differ, the code is right). Every task file repeats the ones it touches. **Items 3, 4, 9 and 10 are visible to the player or change a documented rule, and are worth the user's eye.**

1. **Two save bumps, one migration.** `SAVE_VERSION` (now 18) goes to **19** in step 03 (party and baggage move into the expedition) and to **20** in step 04 (position and confrontation move too). Each step's migration reads a version-18 save directly; step 04 replaces step 03's migration with one from 18 to 20, and version 19 (never released, only on this branch) reads as unreadable. `LOG_SCHEMA_VERSION` (23) is unchanged.
2. **The migration contradicts CLAUDE.md**, which says "There is no migration" and that old saves read as unreadable. The stages index ("Versions": "stages 5 and 7 migrate") and this design ask for one. Step 03 rewrites CLAUDE.md's rules of saving and the comment over `SAVE_VERSION`: a migration is written when a stage's design asks for one; otherwise the old rule stands.
3. **The party keeps showing as "Your party".** The reference names the migrated party "First Company". The user decided (party-list design, Q2, resolved 2026-10-31) that the list says "Your party" until stage 6 names parties. So `Expedition.name` is stored as `'First Company'` (`FIRST_PARTY_NAME`), but the world map shows `SINGLE_PARTY_NAME` ("Your party") while the company has one party. The debug console shows the stored name and the id.
4. **A travel order carries its planned route.** The reference's `{ kind: 'travel'; to }` re-plans each day. Re-planning could choose a different route among equal ones and break the guard, so the order stores the hexes still to walk, planned once when given. `setOrder` takes an `OrderRequest` (`{ kind: 'travel'; to }`) and plans the route.
5. **Stage 5's orders are idle, travel, camp and day.** Home, garrison and meet are stage 6's, which adds them to the union.
6. **Day-passing functions keep their names and homes** (`travel` and `linger` in `worldMap.ts`, `campDay` and `campUntilHealed` in `camp.ts`, `buildTower` and `buildOutpost` in `buildings.ts`, `craft` in `crafting.ts`, `embed` in `runecraft.ts`), so callers and tests keep working. Each becomes a convenience over the loop (`setOrder` + `advance`, or `act`). `company.ts` calls only their time-free parts. This makes import cycles between `company.ts` and those modules; they are safe while no module calls another as it loads, as CLAUDE.md already says of `blight.ts`, `territory.ts` and `worldMap.ts`.
7. **`DayReport` carries more than the reference's.** It adds `partyEvents` and a `PartyDay` per party (the hex walked, hit points rested and cast, the item a day's craft made), which the conveniences need to return today's `Journey` and `CampResult` unchanged.
8. **The rune pouch stays the company's** (`GameState.runes`). The reference predates runes. Whether a party in the field may embed from a pouch held elsewhere is stage 6's question, noted for it.
9. **Until something happens stops after `UNTIL_LIMIT` (30) days** if nothing happens. With an idle party in a quiet land it would otherwise not stop. The message says that 30 days passed quietly.
10. **Orders persist past an interrupt.** After a walk or a stretch of camping is cut short, the party's order stays "Travelling to …" or "Camping". Next day carries it on, and a click on a hex or a button replaces it. A walk's remaining route is the one planned when the order was given (item 4). The `travel` and `campUntilHealed` conveniences give new orders each time they are called, as the simulator's repeated calls do today.
11. **Where the order is shown:** in the world map's party list (the strip down the right), as a short line under each party's entry and in its hover summary. The design says "party column". The list is the per-party element that stage 6's party bar grows from, while the left column shows the selected party's members.
12. **`placeKey` keeps its format** (`baggage:0`, `worn:0:mainHand`), without the party, because the in-browser tests and probes name places by it. With one party nothing collides; stage 6 changes the format when it has a second party.
13. **`leader(game)` is gone by the end of step 05.** Every reader then takes an explicit expedition (a parameter, a place's `party`, or the scene data's), or works over `game.parties` (company-wide readers such as the save summary and the guild hall's `company`). The scene-data default, `selectedParty(game, id)`, falls back to `parties[0]`; that is the scene's selection rule, not a stopgap.

## Scope and shared constraints

- **In:** design S5-R1 to S5-R5, its world-map and debug bullets (§2), its tests (§6), and the documentation the stages index asks for.
- **Out (stage 6):**
  - more than one party;
  - the home, garrison and meet orders;
  - guild hall levels 4 and 5;
  - forming, exchange, wipes;
  - `placeKey` with the party;
  - the pouch per party.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit (`make test` is the same in podman);
  - `npx vitest run <file>` for one file, `npx vitest run --project domain` for the domain;
  - `npm run test:browser -- -t <name>` (or `make test-browser ARGS="-t <name>"`) after any scene change. Read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>` (or `make -s simulate ARGS="<flags>"`). Give each run its own `--out` under `logs/` (gitignored). Never run two `make simulate` at once.
- **The refactor guard** (S5-R5, step 01) has two parts:
  - **The test.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, runs 5 campaigns from seed 1 and compares each `CampaignRecord`, and a SHA-256 of every battle event, with a fixture stored in the test by step 01. It runs in `npm test`. **No later step may edit the fixture.** A mismatch means the step changed behaviour: find the cause and fix it.
  - **The 50-campaign check.** Every step from 02 to 09 runs it before committing:

    ```sh
    npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
    shasum -a 256 logs/guard-50.jsonl
    ```

    The printed summary must equal, line for line, the one recorded in step 01's execution record, and the log's hash must equal step 01's. The summary's first line names the `--out` path, so always use this exact path. Record "guard identical" (or the diff) in the step's execution record.
- **The early-game figure.** It is 230 of 500 after stage 4 (`npm run simulate -- --campaign --battles 500 --seed 1`; `--ready-level` defaults to 7). Step 01 measures it before any change, and step 10 after the last. The two must be identical, not just within the guard's 5 points.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. No step changes the order or arithmetic of the blight's sums or of the events a day returns. The presence rules in C2 are written to give today's numbers exactly for a list of one.
- **Commits.** One commit per step, once `npm test` passes and the guard holds, on `long-campaign-stage-05`, without pushing. Never switch branches. No attribution lines in the message. Steps 02–05 are the design's step A, and steps 06–09 its step B. Each is a separate commit.
- **Docs.** CLAUDE.md must stay current ("Keeping this file current"): each step fixes the lines its own change makes wrong. Search CLAUDE.md for every name the step renames or removes (`GameState.party`, `game.baggage`, `WorldState.party`, `world.confronting`, `passTurn(world, party)`, `takeLoot`, `deployedParties`, …). Step 10 does the stage's pass: the manual and its screenshots, the stage design's "Implementation notes", and the stages index's status line.

## Contracts

Every task file copies these unchanged. "Existing" means in the code at `4a2b824`; "new" means produced by the step named.

### C1. The refactor guard (step 01)

- `scripts/simulate.ts` exports `CAMPAIGN_SEED_STEP` (existing constant, 1000, now exported).
- `scripts/simulate.test.ts` gains `describe('the refactor guard', …)` with one test. It:
  - builds `args = parseArgs(['--campaign', '--battles', '5', '--seed', '1'])`;
  - for `run` 0 to 4, calls `runCampaign(run, (1 + run * CAMPAIGN_SEED_STEP) >>> 0, args, firstBattleId)`, carrying `firstBattleId` forward by each campaign's battle count, as `main` does;
  - compares the list of `CampaignRecord`s with `GUARD_RECORDS`, a literal in the test file, using `toEqual`;
  - compares `sha256(lines.join('\n'))` with `GUARD_EVENTS_SHA256`, a string literal. `lines` is every battle's every event, in order, as `JSON.stringify(event)`, each event carrying its `battleId` as `main` writes it. Use `node:crypto`.
- The fixture is the output of the tree at `4a2b824`, taken before any change. It is never edited after step 01.

### C2. Presences: the world rules over a list of parties (step 02)

```ts
// src/game/expedition.ts (new in step 02; step 03 adds C3)
import type { Hex } from '../grid/hex.ts'
/** A party as the world's rules see it: where it stands, and its members' levels. */
export interface PartyPresence {
  position: Hex
  levels: readonly number[]
}
```

The new signatures (existing functions, changed):

```ts
// blight.ts
export function partyStrength(levels: readonly number[]): number      // PARTY_BASE + floor(sum of levels / 2), as today
export function netInfluence(world: WorldState, presences: readonly PartyPresence[], h: Hex): number
export function advanceDay(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
// vision.ts
export function visibleHexes(world: WorldState, presences: readonly PartyPresence[]): Set<number>
export function updateSight(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
export function seedSight(world: WorldState, presences: readonly PartyPresence[]): void
// territory.ts
export function daysToFall(world: WorldState, presences: readonly PartyPresence[], site: { position: Hex }): number | null
export function updateTerritory(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
// worldMap.ts
export function passTurn(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
export function isNotable(world: WorldState, event: WorldEvent, presences: readonly PartyPresence[]): boolean
export function clearLocation(world: WorldState, id: string, presences: readonly PartyPresence[]): void   // step 04 changes it to C4's
```

**The rules, exact for one presence:**
- **Influence (`netAt`).** `clean = field.clean[i]`, then `+= Math.max(0, partyStrength(p.levels) − hexDistance(p.position, hexes[i]))` for each presence in list order.
  - Every presence's hex is neutral: `netAt` returns `-clean` there.
  - Creep skips a neighbour that is a presence's hex.
- **Spawns.** `spawn`'s corrupted list leaves out every presence's hex. `keepClear` starts with the presences' positions, in list order, then the rest as today.
- **Sight.** `visibleHexes` adds `PARTY_VISION` around each presence (in list order), then the held sites and towers as today.
- **Notable.** A `sighted` event is notable if it is the Source, or if *some* presence is within `NOTICE_RADIUS` of it.
- **A new world** (`newWorld`, signature unchanged) seeds its sight from one presence at its home hex, `{ position: <home>, levels: [] }`, as every new game's party starts there.
- **The transitional helper** (removed in step 04): `soloPresences(world: WorldState, party: readonly { level: number }[]): PartyPresence[]` returns `[{ position: world.party, levels: party.map((m) => m.level) }]`. It is exported from `expedition.ts`, and every caller that passed `party` today passes `soloPresences(world, party)`.

### C3. The expedition and the company (step 03; `position` and `confronting` in step 04)

```ts
// src/game/expedition.ts (types only but for the functions below; imports types only)
import type { Hex } from '../grid/hex.ts'
import type { Item } from '../inventory/inventory.ts'
import type { Grade } from '../inventory/grades.ts'
import type { ModifierId } from '../inventory/modifiers.ts'
import type { RuneKey } from '../inventory/runes.ts'
import type { ItemPlace } from './itemPlace.ts'
import type { Party } from './party.ts'

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

export const FIRST_PARTY_ID = 'party_1'           // moved here from partyList.ts, which imports it
export const FIRST_PARTY_NAME = 'First Company'
export function newExpedition(members: Party, position: Hex): Expedition   // id FIRST_PARTY_ID, name FIRST_PARTY_NAME, baggage [], order idle, confronting null (step 03: no `position` parameter yet)
export function presenceOf(party: Expedition): PartyPresence                // { position, levels: members' levels } (step 04)
export function presences(parties: readonly Expedition[]): PartyPresence[]  // presenceOf each, in list order (step 04)
```

```ts
// src/game/gameState.ts
export interface GameState {
  /** The company's parties in order; never empty while the game lasts; one in stage 5. */
  parties: Expedition[]
  world: WorldState
  runes: Pouch          // the company's (correction 8)
  reserves: Character[]
  slot: SlotId | null
  story: StoryState
}
export function leader(game: GameState): Expedition                       // parties[0]; a stopgap, steps 03–05, deleted in step 05
export function partyById(game: GameState, id: string): Expedition | undefined
export function selectedParty(game: GameState, id?: string): Expedition   // partyById, else parties[0]: the scenes' default (step 05)
// newGame(party, slot, seed, encampmentName, tutorial): signature unchanged; parties: [newExpedition(party, <encampment's hex>)]
```

- `GameState.party` and `GameState.baggage` are removed in step 03. `WorldState.party` and `WorldState.confronting` are removed in step 04.
- **The save** writes `parties` with every item as its id (members' gear, baggage), the order as plain data.
- **Migration** (`parseSave`): a version-18 save becomes `parties: [{ id: 'party_1', name: 'First Company', members: game.party, baggage: game.baggage, position: world.party, order: { kind: 'idle' }, confronting: world.confronting }]`, and `party` and `confronting` are deleted from its world. The migration is checked as strictly as a current save.
- **The fixture.** Step 03 stores a version-18 save string, made by the code at `4a2b824`, in `src/game/fixtures/save-v18.json`. It has:
  - the party off home;
  - something in the baggage;
  - `confronting` set;
  - a runed item.

  The migration tests and the play script use it.

### C4. Position-dependent rules take the expedition (step 04)

Read-only checks take `(world, party)`, and anything that passes a day takes `(game, party)`. The existing functions change to:

```ts
// worldMap.ts
export function monstersHere(world: WorldState, party: Expedition): MonsterLocation | null
export function routeTo(world: WorldState, party: Expedition, to: Hex): Hex[] | null      // null while party.confronting !== null, as today
export function travel(game: GameState, party: Expedition, to: Hex): Journey
export function linger(game: GameState, party: Expedition, how: Lingering): WorldEvent[] | null
export function clearLocation(game: GameState, id: string): void   // clears every party's `confronting` on `id`; sight from presences(game.parties)
// buildings.ts
export function atEncampment(world: WorldState, party: Expedition): boolean
export function towerSiteRefusal(world: WorldState, party: Expedition): string | null
export function canBuildTower(world: WorldState, party: Expedition): string | null
export function buildTower(game: GameState, party: Expedition): WorldEvent[] | null
export function outpostSite(world: WorldState, party: Expedition): QuietLocation | null
export function outpostSiteRefusal(world: WorldState, party: Expedition): string | null
export function canBuildOutpost(world: WorldState, party: Expedition): string | null
export function buildOutpost(game: GameState, party: Expedition): WorldEvent[] | null
// guildHall.ts
export function atGuildHall(world: WorldState, party: Expedition): boolean
// camp.ts
export function canCamp(world: WorldState, party: Expedition): boolean
export function campDay(game: GameState, party: Expedition): CampDay | null
export function campUntilHealed(game: GameState, party: Expedition): CampResult | null
// infirmary.ts
export function restHealing(world: WorldState, party: Expedition, member: Character): number
// crafting.ts
export function craftTier(world: WorldState, party: Expedition): CraftTier
// also changed by step 04 (not in the first draft of this contract): buildings.ts raiseShrine(world, party); scenes/hexInfo.ts hexInfo(game, party, visible, at)
```

- `soloPresences` is deleted. Every `passTurn` gets `presences(game.parties)`.
- **Game-wide functions** that read the party but take no party yet (`craft`, `embed`, `buy`, `sell`, the guild hall's, `improveFacility`, …) use `leader(game)` inside until step 05.
- **`WorldProbe`** (`src/testHook.ts`) gains `partyAt: Hex` and `confronting: string | null`, both of the selected party. The in-browser tests read these where they read `world.party` and `world.confronting`.

### C5. Item places name the party; explicit expeditions (step 05)

```ts
// itemPlace.ts
export type ItemPlace =
  | { from: 'baggage'; party: string; index: number; itemId: string }
  | { from: 'worn'; party: string; member: number; slot: EquipmentSlot; itemId: string }
  | { from: 'backpack'; party: string; member: number; index: number; itemId: string }
export function allPlaces(game: GameState, party: Expedition, worn?: boolean): Array<{ place: ItemPlace; item: Item }>
// placeKey: format unchanged (correction 12). A place whose party is unknown is stale (itemAt → null).
```

- **The rule:** every function that reads the party (its members, baggage, position or confrontation) takes the acting party explicitly.
  - A function given a place finds the party by `place.party`.
  - A function that lists or buys takes `party: Expedition` after `game` or `world`: `craftables`, `socketables`, `sellables`, `buy`, `buyRefusal`, the guild hall's moves, `recruitLevel`, `improveFacility`, and the like.
  - `takeLoot(party: Expedition, location: MonsterLocation): Item[]`.
- **Scene data** carries `party?: string`, the selected party's id: `World`, `Battle`, `Encampment`, `GuildHall`, `TradingPost`, `Crafting`, `Inventory` and `Story`, wherever the scene acts for or shows a party. Each scene resolves it with `selectedParty(game, data.party)` and passes it on when it starts another scene.
- **The debug console.**
  - `DebugSource` gains `party?: string`, the scene's selected party.
  - Every command that acts on a party (`heal`, `xp`, `give`, `goto`, `fight`, and `party`'s listing of members) takes an optional last argument `@<party>`: a party id (`party_1`) or a case-insensitive prefix of its name (`first`). Without it, it acts on the source's party, else the first.
  - `party` lists the company: each party's id, name, hex, order and confrontation, then its members as today. An unknown `@<party>` is an error naming the parties.
- `leader` is deleted (correction 13).

### C6. The day loop (step 06; `act` in step 07)

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
- The other day-passing functions (`campDay`, `linger`, `buildTower`, `buildOutpost`, a field `craft`, a field `embed`) become `act` with the matching `DayAction` in step 07. Their results, events and refusals are unchanged.

### C7. The world map's controls (step 09)

- `partyList.ts`:
  - `PartyListEntry` gains `order: string`;
  - `orderLabel(world: WorldState, party: Expedition): string` gives:
    - `'Before the <name>'` while it is confronting;
    - `'Idle'`;
    - `'Travelling to <name>'` where the player knows a location at `to` (a sighted monster location, or a quiet location on an explored hex), else `'Travelling'`;
    - `'Camping'`;
    - for a day order, `'Scouting'`, `'Waiting'`, `'Camping'`, `'Building'` or `'Crafting'`.
- `deployedParties(game)` maps `game.parties`, the name being `SINGLE_PARTY_NAME` while there is one party.
- **Probes.**
  - `PartyListProbe` gains `order: string`.
  - `WorldProbe.buttons` gains `nextDay: ButtonProbe` and `untilSomething: ButtonProbe`.
  - Both buttons show in the footer whenever the game is active and the selected party is not confronting. Among monsters, the footer shows Scout, Wait and Attack as today.

## Tasks

| Step | Task | Outcome | Depends on | Engineer / reviewer | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | [The refactor guard](01-refactor-guard.md) | The 500-campaign figure and the 50-campaign summary and log hash recorded; the 5-campaign guard test (C1) committed | — | sonnet / sonnet | done (8477c15) |
| 02 | [World rules over presences](02-presences.md) | `PartyPresence` (C2); blight, vision, territory, `passTurn` and `isNotable` over a list; tests for presences of one; guard identical | 01 | opus / opus | done (f4b1af0) |
| 03 | [The company: parties, members and baggage](03-company-state.md) | `Expedition` and `GameState.parties` (C3); `leader`; party and baggage moved; save 19 with migration and the v18 fixture; CLAUDE.md's rule of saving; guard identical | 02 | sonnet / opus | done |
| 04 | [Position and confrontation in the expedition](04-position-and-confrontation.md) | `WorldState.party` and `confronting` moved (C4); position-dependent rules take the expedition; `presences(game.parties)`; save 20; probes and in-browser tests; guard identical | 03 | opus / opus | done (5f0e851) |
| 05 | [Explicit expeditions](05-explicit-expeditions.md) | Item places name the party (C5); scenes take the party from scene data; debug `@<party>` and `party`; `leader` deleted; guard identical | 04 | sonnet / opus | done (b3de3e1) |
| 06 | [The day loop](06-day-loop.md) | `company.ts` (C6): orders idle, travel and camp, `passDay`, `advance`, `setOrder`; `travel` and `campUntilHealed` on the loop; debug `days` on `passDay`; guard identical | 05 | opus / opus | done |
| 07 | [Day actions as orders](07-day-actions.md) | `act` and every `DayAction`; `campDay`, `linger`, `buildTower`, `buildOutpost`, field craft and embed on the loop; guard identical | 06 | opus / opus | pending |
| 08 | [The simulator on the loop](08-simulator-on-loop.md) | `runCampaign` as a day loop with an idle-party policy making today's decisions; guard identical | 07 | opus / opus | pending |
| 09 | [The world map's time controls](09-world-map-controls.md) | The order line (C7); Next day and Until something happens; probes, scene and in-browser tests; guard identical | 07 | sonnet / opus | pending |
| 10 | [Measure, document, play](10-measure-document-play.md) | The 500-campaign figure identical to step 01's; CLAUDE.md pass; the manual and screenshots; stage notes and index status; the play script walked | 08, 09 | sonnet / opus | pending |

**Tiers.** "opus" means leave the engineer's model unset (it inherits the session's), as CLAUDE.md asks for intricate or determinism-sensitive work. "sonnet" means `model: "sonnet"`.
- Steps 03 and 05 are wide but mechanical, with fixed contracts.
- Step 09 follows the world map's existing patterns.
- Steps 02, 04, 06, 07 and 08 decide whether the guard holds.

## Execution order

01 → 02 → 03 → 04 → 05 → 06 → 07 → {08, 09} → 10.

- **08 and 09 may run in parallel** after 07:
  - 08 touches `scripts/simulate.ts` and its test;
  - 09 touches the scenes, `partyList.ts`, `testHook.ts`, the in-browser tests and the manual's text.

  Neither may change `company.ts`'s contract. If both need a change there, do it in whichever commits second and say so. Commit them one at a time on the branch.
- **Checkpoints:**
  - after 05: step A is done; the guard is identical and `leader` is gone;
  - after 08: step B's domain is done; the guard is identical.

## Requirement map

| Design item | Steps |
| --- | --- |
| S5-R1 the company is a list of expeditions; world rules take presences | 02 (presences), 03 (parties), 04 (position, confrontation), 05 (places, explicit parties) |
| S5-R2 one clock: `passDay`, `advance` stopping on an interrupt | 06 |
| S5-R3 day actions as one-day orders | 07 |
| S5-R4 old saves load as a company of one | 03, 04 (migration and fixture); 10 (play script 1) |
| S5-R5 no behaviour change: identical seeded summary | 01 (guard), every step (check), 10 (500 campaigns) |
| §2 the simulator's `runCampaign` on the loop | 08 |
| §2 the world map: order shown; Next day; Until something happens; hex click unchanged | 09 |
| §2 debug: optional party name; `party` lists the company | 05 |
| §5 `SAVE_VERSION` bumped with the migration; `LOG_SCHEMA_VERSION` unchanged | 03, 04 |
| §6 `company.test.ts` (every order kind, `advance`'s interrupts, refusal while confronting, day actions) | 06, 07 |
| §6 `save.test.ts` (migrating an old save, round-tripping a company) | 03, 04 |
| §6 `blight.test.ts`, `vision.test.ts`: presences of one give today's numbers | 02 |
| §6 scene tests pass unchanged but for the new buttons | every step; 09 |
| §6 play script | 10 |

## Completion criteria

- `npm test` and `npm run test:browser` pass.
- The guard test is unchanged since step 01 and passes.
- The 50-campaign summary and log hash match step 01's, and the 500-campaign summary matches step 01's line for line.
- `leader` and `soloPresences` are gone. No code reads `GameState.party`, `GameState.baggage`, `WorldState.party` or `WorldState.confronting`.
- CLAUDE.md, the manual and its screenshots are current; the stage design has its implementation notes; the stages index shows stage 5's status.
- The play script has been walked, with what was seen recorded in step 10.

## Open questions

None blocks the plan. Corrections 3, 9, 10 and 11 are defaults taken for the user to confirm.

## For implementers

When you start or finish a step, update its status and commits in the table above. Record evidence (commands and their output, the guard's result), deviations and blockers in your task file's "Execution record". Keep this index short; every implementer reads it.
