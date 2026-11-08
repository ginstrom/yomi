# Implementation plan: long campaign, stage 6 (multiple parties)

The company grows past one party. Guild hall levels 4 and 5 allow a second and a third party; recruits join at the hall's level. Parties take the orders home, garrison and meet besides travel, camp and idle; every interrupt focuses the party it concerns. Two parties on one hex exchange heroes and baggage. A wiped party no longer ends the game while another hero lives. The simulator plays a company: a vanguard and one or two home guards.

**Source design:** [`docs/designs/long-campaign/stage-06-multiple-parties.md`](../../designs/long-campaign/stage-06-multiple-parties.md) (status "ready for planning"). It cuts from [`reference/multiple-parties.md`](../../designs/long-campaign/reference/multiple-parties.md), all but §R10 (road guards, stage 8). Conventions: [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md). Groundwork: [stage 5's plan](../long-campaign-stage-05/index.md). Feature record: [`docs/features/long-campaign-stage-06.md`](../../features/long-campaign-stage-06.md). Written against `63d2ea1` on branch `long-campaign-stage-06` (off `main`).

## Decisions taken for the orchestrator

The plan follows the stage design, then the reference, then the code (where they differ, the code is right). None blocks a step. **Items 7, 8, 11 and 16 shape what the player or the simulator does and are worth the user's eye before steps 05, 08, 07 and 10 respectively.**

1. **`--parties N`** (1 to 3) defaults to 3 ("what the hall allows", design §5.5) from step 10. The refactor guard test and the early-game figure are run with `--parties 1`: step 09 adds `'--parties', '1'` to the guard test's arguments when it re-records the fixture.
2. **The simulator's hall cap.** A careful company raises the hall only as far as its parties use: level 3 for `--parties 1`, 4 for 2, 5 for 3 (`HALL_FOR_PARTIES = [3, 4, 5]`). `hallErrand`, `visitGuildHall` and `materialNeeds` all respect it, so one party plays as today. Step 04 adds the cap fixed at 3; step 10 makes it follow `--parties`.
3. **Company size.** Reserves stay capped at `MAX_RESERVES` (4). Recruiting also needs the company (parties plus reserves) under `companyLimit` (7, 8, 9, 14, 18 by hall level). At levels 1–3 the new cap never binds before the reserves' does.
4. **Party ids and names.** Ids are `party_1` to `party_3`; a new party takes the lowest free number. Default names `First Company`, `Second Company`, `Third Company` by that number (`PARTY_NAMES`). A rename is 1 to 16 characters, trimmed, unique among the parties (case-insensitive). The map keeps showing "Your party" while the company has one party (stage 5's user decision); with two or more it shows the names.
5. **Orders.** `home` is a travel order to the encampment with its own kind (label "Returning home"). `garrison` is allowed only on a held resource site (not the encampment; road hexes are stage 8), does nothing and never ends by itself (label "Garrisoning <site>"). `meet` re-plans its route to the other party's current hex every day, ends with a `met` party event when the two share a hex, and becomes idle with `order_done` when the other party is gone. A meet may step onto a monster location the other party stands on, and then confronts it too.
6. **Stopping short.** A travel or home order never steps onto a monster location another party stands on: the party stays, its order becomes idle and `order_done` is emitted (design §4.4, "two parties arrive at the same monsters").
7. **Wipes.** A wiped party's members are dead; what they wore and carried goes into its baggage (as `buryFallen` does), and the baggage is added to the location's `loot`. A debug fight has no location: its baggage is lost. The game is lost only when no hero is left in any party or the reserves (or the encampment falls, as today). **If the last party is wiped while reserves remain, a new party is formed at once at the encampment from the reserves** (up to the party limit, the lowest free id and default name), so `parties` is never empty.
8. **Exchange UI.** A new overlay scene, `Exchange`, over `World`, opened by an Exchange button in the character panel on the world map (and in the footer) when another party shares the selected party's hex. It shows the two parties as two rows of faces, swapped or moved as in the guild hall, and their two baggages as lists, a click moving an item across. Gear on a hero moves with the hero; a member's own items go through the baggage with the character panel as today.
9. **The encampment's acting party** is the selected party when it is at home, else the first party at home (`homeParty`). The encampment, guild hall, trading post and crafting screens say which ("For: Second Company") when more than one party is at home. The Guild Hall shows a column for each party at home and one for the reserves.
10. **The party bar** is stage 5's right-hand strip, kept at its width: each entry gains its banner (colour by party number: 1 crimson, 2 azure, 3 green), and its hover summary leads with the party's name. The left column keeps showing the selected party's members. On the map every party is drawn, its first member's figure with its banner; several on one hex are offset.
11. **Map clicks.** A click on a hex where another party stands gives the selected party a meet order (hover: "Meet Second Company"); any other hex is travel, as today. Parties are selected through the bar. New footer buttons: Home (away from home), Garrison (on a held resource site), Exchange (another party on the hex). Only the selected party's walk is animated; the others jump to their new hexes when it ends (stage-5 hazard "animating other parties' walks", deferred).
12. **Interrupts and refusals** name the party when the company has two or more ("Second Company: arrived at Kobold Scouts."). When Next day or Until something happens is refused because a party confronts monsters, the map selects and centres that party (`blockingParty`). One exported `partyNoun` replaces the private copies.
13. **`campDays`** in the simulator's record counts the days on which any party camped (no double count); `healedHp` sums every party's.
14. **Saves.** `SAVE_VERSION` 20 → 21 in step 02 (a saved battle names its party) and → 22 in step 03 (the new order kinds). 21 is never released and reads as unreadable, as do stage 5's version-20 saves; the version-18 migration (`migrateFrom18`) is kept and now yields version 22's shape. No other migration.
15. **`LOG_SCHEMA_VERSION`** 23 → 24 in step 09: `battle_start` meta gains `party` (the game's and the simulator's) and `role` (the simulator's). That step re-records the guard fixture, once.
16. **The guard policy** (step 10), in order: *reinforce* (the vanguard is under its party limit, the guard has two or more heroes and one within 3 levels of the vanguard's lowest: meet the vanguard; on `met` the guard's highest-level hero moves to the vanguard, a promotion; then the guard goes home to recruit; **amended by the user (swap promotion):** also when the vanguard is full and the guard's best hero outranks the vanguard's lowest by 2 levels or more, the guard meets it and on `met` the two swap (`exchange` `swap`), the vanguard's weakest joining the guard, counted as a promotion, after which the guard goes home as after any promotion); *defend* (the nest pushing hardest on a threatened held site, threat no higher than the guard's lowest level); *train* (the nearest nest of threat no higher than its lowest level); *garrison* (the threatened held site with the fewest `daysToFall`); else go home and stay idle. Targets of different parties are kept distinct; guards never march on the Source. A guard is formed at the guild hall, from reserves and recruits at the hall's level, when the hall allows another party, the company is under `--parties`, and at least 3 heroes can be had. While a guard exists the vanguard no longer goes home to fill an empty place (it still goes home to raise the hall). After a vanguard wipe the strongest remaining party (highest lowest level, then mean level) becomes the vanguard.
17. **Debug.** A new `hp <amount> [member|all] [@party]` sets hit points (for the play script's death). `facility guild_hall 4` works through the hall's new levels.
18. **Out of scope, with reasons** (stage-5 hazards not taken up):
    - `placeKey` keeps leaving the party out: every list of places is one party's, and exchange moves baggage by party id and index (C5), not by place key.
    - The rune pouch stays the company's: it is shared like the stock (design §4.4, "The stock is shared"); a per-party pouch has no design yet.
    - `fillText`'s `{leader}` stays the first party's leader: the story's moments are the company's, and the cutscenes are placeholders.
    - A reload during the walk animation losing that turn's story moment, and the amber route running under the party list at 840 wide, are pre-existing and untouched by this stage (the bar keeps its width).
    - Auto-resolve and garrison experience (design "Out").

### Stage-5 hazards, where each is taken

| Hazard (feature record) | Step |
| --- | --- |
| 1. Saved battles carry no party id | 02 |
| 2. `advanceRefusal` stops the whole company | kept (design); 07 focuses the blocking party (decision 12) |
| 3. Simulator acts pass a day mid-decision; `finishCampaign` reads `parties[0]`; `campDays` double-counts | 01 (and 09 for per-role levels) |
| 4. `carryOut` mirrors `travel`'s guards: shared `startTravel` | 01 |
| 5. Footer refusal wording; `partyNoun` | 07 (decision 12) |
| 5. `placeKey`, pouch, `{leader}`, animating other walks | out of scope (decisions 18, 11) |
| 6. Pre-existing reload/story moment; amber route at 840 | out of scope (decision 18) |

## Scope and shared constraints

- **In:** S6-R1 to S6-R7, the design's tests (§6, company A2–A7, A9–A11, not A8), its simulator checks and play script, the docs the stages index asks for.
- **Out:** road guards (stage 8), auto-resolve, garrison experience, decision 18's items.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). Never run two `make simulate` at once. A 500-campaign run takes about a minute and writes some 70 MB.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, each `CampaignRecord` and a SHA-256 of every battle event against a fixture.
  - **Steps 01–08 must not edit the fixture** and must keep it green. A mismatch means the step changed play: find the cause and fix it.
  - Steps 01–08 also run the **50-campaign check** before committing and record "guard identical" or the diff:

    ```sh
    npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
    shasum -a 256 logs/guard-50.jsonl
    ```

    It must match step 01's record line for line and hash for hash, except in step 04, whose recruit rule (decision 3, C4) may move it (the planner checked: the 5-campaign test stays green with it); step 04 records the diff and the new values, which steps 05–08 then match.
  - **Step 09 re-records the fixture once** (decision 15, new record fields), with `--parties 1` in its arguments. Step 10 must keep that new fixture green.
- **The early-game figure** is 230 of 500 from seed 1 after stage 5 (`npm run simulate -- --campaign --battles 500 --seed 1`, `--ready-level` 7). Step 01 re-measures it before any change. With `--parties 1` it should not move except through step 04's recruit rule (recruits at the hall's level rather than the party's lowest, which is the same or higher; at most a point or two, as the careful party rarely has a member below the hall's level); step 09's re-record changes only the log's schema, meta and zero fields. Step 11 measures it again. A move of more than 5 points must be explained in the commit and in CLAUDE.md's rules of scaling.
- **Determinism.** Steps 01–08 add, drop or reorder no draw of the world RNG or a battle's RNG and keep the order of a day's events. Parties act in list order.
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on `long-campaign-stage-06`, without pushing. Never switch branches. Messages "Stage 6 step NN: <title>". No attribution lines.
- **Docs.** CLAUDE.md stays current: each step fixes the lines its change makes wrong and searches it for every name it renames or removes. Scene steps update the manual's text for their screens; step 11 retakes the screenshots and writes the stage's implementation notes.
- **Sprites** are drawn with sprite-tool by following `art/CLAUDE.md` and `docs/designs/sprite-drawing-guidance.md`; never edit an exported PNG; `npm run sprites` then `npm run sprites:check`.

## Contracts

Task files copy these unchanged. "Existing" means at `63d2ea1`.

### C1. The simulator's days on the loop (step 01)

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

### C2. A saved battle names its party (step 02)

```ts
// src/game/save.ts
export interface SavedBattle { location: string; party: string; engine: BattleSnapshot; enemyRng: number; ground: GroundPile[] }
export const SAVE_VERSION = 21
```

`parseSave` refuses a battle whose `party` is not a party of the game. `MenuScene` starts `Battle` with `{ game, location, saved, party: file.battle.party }`; `BattleScene.save` writes `this.expedition.id`.

### C3. Orders for a company (step 03)

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

### C4. The guild hall and the company (step 04)

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

- Every action needs the parties it touches at home and returns its refusal (or the new party), checking everything before changing anything: over `maxParties`; a party left empty; over `partyLimit`; over `MAX_RESERVES`; a bad name (decision 4). A party formed stands at the encampment, idle, with no baggage. `disband` refuses the last party, sends members to the reserves and the baggage to the first other party at home (refused if none).
- `recruitRefusal` also refuses at `companyLimit` (decision 3). Encampment actions act for `homeParty`.
- Simulator: `SIM_HALL_CAP = 3` until step 10 (decision 2).

### C5. Exchange and wipes (step 05)

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

- `exchange`: refused on different hexes, while either confronts (unless both confront the same location), over `partyLimit`, or leaving a party empty; moves apply in order, all checked first (indices as they stand after the earlier moves). Reserves are not reachable (the guild hall's `moveHero` is).
- `wipeParty`: decision 7. `lost` when `heroesLeft` is 0 after it. Nothing else changes (no world status: the battle's loss screen ends the game, as today).
- `BattleScene` on a defeat: `wipeParty`; if `lost`, delete the slot and go to the menu as today; else save, say "The <name> has fallen. Its baggage lies at <location>." with OK back to `World`, selecting the first party.

### C6. The world map's company (step 07)

- `partyList.ts`: `PartyListEntry` gains `banner: number` (1–3, from the id); `PartyListProbe` gains `name: string` and `banner: number`. `BANNER_SPRITES` (by banner number) names the atlas sprites made in step 06.
- `WorldProbe.buttons` gains `home` and `garrison` (step 07) and `exchange` (step 08) (`ButtonProbe`); `WorldProbe` gains `parties: Array<{ id: string; at: Hex; screen: Point }>` (each party's figure on screen).
- The world map's message prefixes an interrupt with the party's name when there are two or more parties.

### C7. Sprites (step 06)

- `camp_guild_hall` gains frames `level_4` and `level_5` (the Barracks).
- Banners: three atlas sprites (or one sprite with three frames/anims, the engineer's choice under `art/CLAUDE.md`), each with an `idle` animation, in crimson, azure and green; their names are recorded in step 06's execution record for `BANNER_SPRITES`.

### C8. The simulator's company record (step 09)

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

## Tasks

| Step | Task | Outcome | Depends on | Engineer / reviewer | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | [The simulator's days on the loop](01-simulator-days.md) | Baseline figures; `startTravel`, `orderAction` (C1); acts and field crafts as day orders; vanguard in the run; `campDays` once; guard identical | — | opus / opus | done (d71a415) |
| 02 | [A saved battle names its party](02-saved-battle-party.md) | `SavedBattle.party`, save 21 (C2); load fights the right party; guard identical | — | sonnet / opus | done (8971db5) |
| 03 | [Orders for a company](03-company-orders.md) | home, garrison, meet; `met`; stopping short; `partyNoun`, `blockingParty`; save 22; two-party tests (A3–A6); guard identical | 01, 02 | opus / opus | done (b425c77) |
| 04 | [The guild hall's company](04-guild-hall-company.md) | Hall levels 4 and 5; form, rename, disband, move heroes; recruits at the hall's level; encampment acts for the party at home (C4); guard test green | 03 | sonnet / opus | done (a36f444) |
| 05 | [Exchange and wipes](05-exchange-and-wipes.md) | `exchange`, `wipeParty` (C5); the new loss condition; BattleScene's defeat; debug `hp`; guard identical | 04 | opus / opus | done (a9e8c0c) |
| 06 | [Sprites: barracks and banners](06-sprites.md) | Guild hall levels 4–5 frames; three banners (C7) | — | sonnet / opus | done (e26c81f, 6ad9a75) |
| 07 | [The world map's company](07-world-map-company.md) | Party bar banners, every party on the map, Home, Garrison, meet by click, interrupt and refusal focus (C6); manual text; in-browser tests | 05, 06 | opus / opus | done (ad65dcb; decision 11 confirmed by the user) |
| 08 | [Guild hall columns and exchange](08-guild-hall-and-exchange-scenes.md) | Guild Hall columns, Form party, Rename, Disband; the `Exchange` scene from the character panel; acting party shown; manual text; in-browser tests | 07 | sonnet / opus | done (4df8911) |
| 09 | [The simulator's company record](09-simulator-record.md) | `--parties`, roles, record fields, meta and `LOG_SCHEMA_VERSION` 24 (C8); the guard re-recorded once with `--parties 1` | 05 | opus / opus | done (564772c; `BattleScene`'s meta `party` in step 11's commit) |
| 10 | [The simulator's company policy](10-simulator-policy.md) | Guard formation, reinforce/defend/train/garrison, vanguard succession, `--parties` default 3, policy tests on fixed states; guard green | 09, 03 | opus / opus | done (4b23fac; decision 16 confirmed by the user) |
| 11 | [Measure, document, play](11-measure-document-play.md) | Guard figure, hall-4 frequency, `--ready-level 10` comparison; CLAUDE.md, manual and screenshots; implementation notes; play script walked | 08, 10 | sonnet / opus (engineer escalated to opus) | done (see the step's record) |

**Tiers.** "opus" means leave the model unset (the session's); "sonnet" means `model: "sonnet"`. Steps 01, 03, 05, 09 and 10 decide determinism, the guard or the loss rule; 07 is the largest scene change. Steps 02, 04 and 08 follow fixed contracts and existing patterns; 06 is tool work with a judged look; 11 is measurement and docs, reviewed for truth.

## Execution order

01 and 02 (either order, or in parallel) → 03 → 04 → 05 → then two tracks: **scenes** 07 → 08 (06 may run any time before 07) and **simulator** 09 → 10 → 11 after both tracks.

- 06 touches only `art/` and the exported atlas; it may run in parallel with anything.
- 09/10 touch `scripts/simulate.ts`, its test and `battleEngine.ts`'s `LOG_SCHEMA_VERSION` (and `BattleScene`'s meta, one line); 07/08 touch scenes, `testHook.ts`, `e2e/` and the manual. If both tracks need `company.ts`, the second to commit merges and says so. Commit one at a time on the branch.
- **Checkpoints:** after 05, the domain is done and the guard is identical (but for step 04's recorded diff); after 09, the fixture is re-recorded; after 10, the company comparison can be run.

## Requirement map

| Design item | Steps |
| --- | --- |
| S6-R1 hall levels 4–5; forming and managing parties at home | 04 (domain), 08 (Guild Hall) |
| S6-R2 all orders, interrupts with focus, confrontation blocking | 03 (orders, interrupts), 07 (buttons, focus) |
| S6-R3 meeting and exchange | 03 (meet), 05 (exchange), 08 (Exchange scene) |
| S6-R4 wipes and the loss condition | 05 |
| S6-R5 recruits at the hall's level | 04 |
| S6-R6 the party bar and multi-party UI; BattleScene takes the expedition; banners | 02, 06, 07, 08 |
| S6-R7 simulator policy and record; `--parties`; `fallen` | 01, 09, 10 |
| §5 `SAVE_VERSION` and `LOG_SCHEMA_VERSION` | 02, 03 (save 21, 22); 09 (log 24) |
| §6 tests A2 (04), A3 (03), A4 (03), A5 (03, 07), A6 (03), A7 (05), A9 (05), A10 (04), A11 (07, 08) | as listed |
| §6 simulator checks 1 and 2 | 11 |
| §6 play script | 11 |

## Completion criteria

- `npm test`, `npm run test:browser`, `npm run build` and `npm run sprites:check` pass.
- The guard fixture was edited only by step 09 and passes.
- The early-game figure (`--parties 1`) is within 5 points of step 01's, or the move is explained; the default run records how often hall level 4 is reached; the `--ready-level 10` comparison shows promotions, guard battles and fewer vanguard walking days.
- CLAUDE.md, the manual and its screenshots are current; the stage design has its implementation notes; the stages index shows stage 6's status.
- The play script has been walked, with what was seen recorded in step 11.

## Open questions

None blocks a step. Decisions 7, 8, 11 and 16 are defaults taken for the user to confirm. The design asks that the implementation notes say how the battles' player time feels, to settle auto-resolve (step 11).

## For implementers

When you start or finish a step, update its status and commits in the table above. Record evidence (commands and output, the guard's result), deviations and blockers in your task file's "Execution record". Keep this index short; every implementer reads it.
