# Step 04: The guild hall's company

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-06-multiple-parties.md) (S6-R1, S6-R5; §2 "The guild hall"; §6 tests A2, A10) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §4.1, §4.4, §5.2

**Difficulty:** sonnet / opus. The engineer can be `model: "sonnet"`: the rules are small, the contracts fixed and the refusals listed. The reviewer should be opus (leave the model unset), because the step touches the simulator's hall errands and the guard must stay green, and the refusal checks must all come before any change.

## 1. Objective

The guild hall gains levels 4 and 5, which allow a second and a third party, and the domain gains the actions that form and manage parties at home:
- `GUILD_HALL_LEVELS` gains `parties` and `company` per level, and two levels;
- `maxParties`, `companyLimit`; recruits join at the hall's level;
- `homeParties` and `homeParty`: the encampment's actions act for a party at home;
- `formParty`, `renameParty`, `disband` and `moveHero` in `company.ts`, each with its refusals.

No screen changes here beyond what the new levels' text and frames need (the Guild Hall's columns are step 08). The simulator keeps playing one party exactly as today.

## 2. Requirements and context

- **S6-R1:** hall levels 4 and 5, and forming and managing parties at home (company R2, R3).
- **S6-R5:** recruits join at the hall's level (company R12).
- **A2:** hall levels 4 and 5 allow 2 and 3 parties. Forming is refused away from home, over the limits, or leaving a party empty.
- **A10:** recruits join at the hall's level.
- **Reference §4.1 table** (as C4 below): level 4 is the Barracks, 120 gold, 40 iron, 20 stone; level 5 is 200 gold, 30 silver, 20 stone. Party size stays 5 at levels 4 and 5 (more parties, not bigger ones).
- **Reference §4.4:** encampment actions need a party at home; they act for the selected party if it is at home, else for the first party at home. The stock is shared.

### Decisions from the index that this step touches (unchanged)

2. **The simulator's hall cap.** A careful company raises the hall only as far as its parties use: level 3 for `--parties 1`, 4 for 2, 5 for 3 (`HALL_FOR_PARTIES = [3, 4, 5]`). `hallErrand`, `visitGuildHall` and `materialNeeds` all respect it, so one party plays as today. Step 04 adds the cap fixed at 3; step 10 makes it follow `--parties`.
3. **Company size.** Reserves stay capped at `MAX_RESERVES` (4). Recruiting also needs the company (parties plus reserves) under `companyLimit` (7, 8, 9, 14, 18 by hall level). At levels 1–3 the new cap never binds before the reserves' does.
4. **Party ids and names.** Ids are `party_1` to `party_3`; a new party takes the lowest free number. Default names `First Company`, `Second Company`, `Third Company` by that number (`PARTY_NAMES`). A rename is 1 to 16 characters, trimmed, unique among the parties (case-insensitive). The map keeps showing "Your party" while the company has one party (stage 5's user decision); with two or more it shows the names.
9. **The encampment's acting party** is the selected party when it is at home, else the first party at home (`homeParty`). The encampment, guild hall, trading post and crafting screens say which ("For: Second Company") when more than one party is at home. The Guild Hall shows a column for each party at home and one for the reserves. (This step adds `homeParty` and makes the domain's encampment actions use it; the screens' "For:" line and columns are step 08.)

### Contracts (copied unchanged from the index)

**C4. The guild hall and the company (this step):**

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

**C3, consumed (made in step 03):**

```ts
// src/game/expedition.ts
export const MAX_PARTIES = 3
export const PARTY_NAMES: readonly string[] = ['First Company', 'Second Company', 'Third Company']
export function partyId(n: number): string            // `party_${n}`
export function newExpedition(members: Party, position: Hex, id = FIRST_PARTY_ID, name = FIRST_PARTY_NAME): Expedition
// src/game/company.ts
export function partyNoun(game: GameState, party: Expedition): string   // 'The party' with one party, else its name
export const SAVE_VERSION = 22   // save.ts
```

`Expedition` has `id`, `name`, `members`, `baggage`, `position`, `order`, `confronting`. Its `Order` union (step 03) has idle, travel, home, camp, garrison, meet and day.

### Shared constraints (from the index)

- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, each `CampaignRecord` and a SHA-256 of every battle event against a fixture. **Do not edit the fixture**; it must stay green. A mismatch means this step changed play: find the cause and fix it. (The planner checked that recruits at the hall's level keep the 5-campaign test green.)
- **The 50-campaign check.** Run before committing:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  Unlike steps 01–03 and 05–08, **this step may move it**, through the recruit rule alone (a recruit now joins at the hall's level, not the party's lowest, which is the same or higher). Record the diff against step 01's summary and the new summary and hash in the execution record; steps 05–08 then match these new values. Any other cause of a difference is a bug.
- **The early-game figure** (230 of 500, `--ready-level` 7) is not re-run here; step 11 does. If you run it, record it.
- **Determinism.** Add, drop or reorder no draw of the world RNG or a battle's RNG; keep the order of a day's events.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate;
  - `npx vitest run <file>` for one file;
  - `npm run test:browser -- -t <name>` after a scene change (read `e2e/CLAUDE.md` first);
  - each simulator run its own `--out` under `logs/`; never run two `make simulate` at once.
- **Commits.** One commit, "Stage 6 step 04: the guild hall's company", on `long-campaign-stage-06`, without pushing. Never switch branches. No attribution lines.
- **Docs.** CLAUDE.md stays current: fix the lines this change makes wrong (the guild hall's line under the domain layer: levels, `partyLimit` 3, 4, 5, recruits "at `recruitLevel`: the hall's level or the party's lowest, whichever is less" becomes the hall's level; the encampment's acting party; `company.ts`'s new actions). Search it for every name you rename or remove.

## 3. Dependencies and prerequisites

- **Step 03 (done first)** provides C3: `MAX_PARTIES`, `PARTY_NAMES`, `partyId`, `newExpedition` with `id` and `name`, `partyNoun`, the seven order kinds, and `SAVE_VERSION` 22.
- **Steps 01–02** provide the simulator on true day orders and the saved battle's party; nothing here depends on their details.
- **Existing code at `63d2ea1`:**
  - `src/game/guildHall.ts`: `GUILD_HALL_LEVELS` (`partyLimit`, `cost`) with three levels; `MAX_GUILD_HALL_LEVEL = GUILD_HALL_LEVELS.length`; `partyLimit(world)`; `atGuildHall(world, party)`; `upgradeCost`, `upgradeGuildHall(game, party)`; `company(game)`; `recruitLevel(game, party)` = `max(1, min(hall, party's lowest level))`; `recruitRefusal(game, party, name?)`; `recruit(game, party, draft)`; `toReserves`, `toParty`, `swap` (kept as they are).
  - `src/game/encampment.ts`: the facility table (`FACILITIES`), the guild hall's `effect` text ("A party of up to N; recruits join at up to level L."), `facilities(game, party)`, `improveFacility(game, party, id)`, `improveRefusal` ("The party is not at <encampment>."), and `setFacilityLevel` (used by debug `facility`).
  - `src/scenes/GuildHallScene.ts` calls `recruitLevel(this.gameState, this.expedition)`.
  - `src/scenes/hexInfo.ts` prints `Guild hall level N/MAX_GUILD_HALL_LEVEL` (becomes `/5` by itself).
  - `src/scenes/encampmentView.ts`: `facilityFrame` returns `camp_guild_hall/level_<n>`; the atlas has `level_1` to `level_3` only until step 06.
  - `scripts/simulate.ts`: `hallErrand` (goes home when `upgradeCost` is affordable and nothing is threatened, or to fill an empty place), `visitGuildHall` (`while (upgradeGuildHall(...) === null);` then recruits into the party), `materialNeeds` (`GUILD_HALL_LEVELS.slice(world.guildHall)` adds every remaining level's cost).
  - The debug command `facility [id level]` checks `n <= facility.maxLevel`, which is `MAX_GUILD_HALL_LEVEL`, so `facility guild_hall 4` works once the table has five levels.

## 4. Scope and implementation guidance

### 4.1 The hall's levels (`guildHall.ts`)

- Extend `GUILD_HALL_LEVELS` to the five rows of C4. `MAX_GUILD_HALL_LEVEL` becomes 5 by itself.
- `partyLimit` is unchanged (5 at levels 4 and 5).
- `maxParties(world)` = the level's `parties`, never above `MAX_PARTIES`; `companyLimit(world)` = the level's `company`.
- `recruitLevel(game)` = `game.world.guildHall` (always at least 1). Drop the `party` parameter and update callers: `recruit` inside `guildHall.ts`, `GuildHallScene` (its recruit line), and any tests.
- `recruitRefusal` keeps its checks and order and adds, after the reserves' cap: `company(game).length >= companyLimit(world)` → "The guild hall's level N keeps no more than M heroes." (decision 3).
- `homeParties(game)` = parties standing on the encampment, in list order (use `atGuildHall`/`atEncampment`). `homeParty(game, preferred?)` = the preferred party if it is at home, else the first at home, else null.
- Update the guild hall's line in the `upgradeGuildHall` comment and the module comment to say the hall's level also sets how many parties the company may field.

### 4.2 Forming and managing parties (`company.ts`)

Each function checks every condition first and changes nothing on a refusal. Suggested refusal wording is the engineer's; each refusal needs a test.

- **A `HeroRef` at home:** `{ from: 'reserves' }` is always at home; `{ from: 'party' }` needs that party in `homeParties` (else "<noun> is not at <encampment>."). An unknown party or index is refused.
- **`formParty(game, name, hero)`:**
  - refused when no party is at home (the hall is opened by a party at home: "No party is at <encampment>.");
  - refused at `game.parties.length >= maxParties(world)` ("The guild hall's level N allows M parties.");
  - refused when the hero would leave its party empty;
  - refused for a bad name (decision 4: trimmed, 1 to 16 characters, unique among the parties, case-insensitive);
  - otherwise makes `newExpedition([hero], <encampment's position>, partyId(<lowest free n in 1..3>), name)` (the caller passes the default name; offer a helper `defaultPartyName(game)` = `PARTY_NAMES[n - 1]` for the lowest free `n`, used by the scene in step 08), appends it to `game.parties`, takes the hero out of its party or the reserves (a reserve comes out rested, as `toParty` does), and returns the new `Expedition`.
- **`renameParty(game, id, name)`:** the name rule; allowed anywhere (a name is not a hall action), unless the design's "at home" reading is preferred — choose anywhere, and note it in the execution record.
- **`disband(game, id)`:** the party at home; refused for the last party; refused when its members would push the reserves over `MAX_RESERVES`; refused when no other party is at home to take the baggage ("Its baggage needs another party at home to take it."); else members go to the reserves (in order), the baggage is appended to the first other party at home, and the party is removed from `game.parties`.
- **`moveHero(game, hero, to)`:**
  - both ends at home;
  - to a party: refused at its `partyLimit`; a reserve comes out rested;
  - to `'reserves'`: refused at `MAX_RESERVES`;
  - refused when it would leave the hero's party empty, or when the hero is already there.
  - It appends the hero at the target's end.
- Keep `toReserves`, `toParty` and `swap` in `guildHall.ts` unchanged; the simulator and today's Guild Hall use them.
- `company.ts` may import from `guildHall.ts` (`atGuildHall`, `partyLimit`, `maxParties`, `MAX_RESERVES`, `homeParties`); `guildHall.ts` must not import `company.ts` (no new cycle).

### 4.3 The encampment acts for the party at home (`encampment.ts`)

- `improveRefusal(game, party, cost)`: where `party` is not at home, act for `homeParty(game, party.id)` instead; with none at home, refuse "No party is at <encampment>." (reference §4.4). The facility actions keep their signatures; the scenes pass the selected party as today.
- The guild hall's `effect` text becomes, for example, "A party of up to N, M parties in the company; recruits join at level L." (L = the level). Keep it short enough for the encampment's panel (check `EncampmentScene`'s width at 840×560).

### 4.4 The encampment's picture at levels 4 and 5 (until step 06)

The atlas has `camp_guild_hall/level_1` to `level_3` only. **Decision for this step:** add a small cap in `src/scenes/encampmentView.ts`, `DRAWN_LEVELS: Partial<Record<FacilityId, number>> = { guild_hall: 3 }`, and have `facilityFrame` draw `min(level, DRAWN_LEVELS[id] ?? level)`. Test it in `encampmentView.test.ts` (level 4 and 5 give `camp_guild_hall/level_3`). Step 07, once step 06 has drawn `level_4` and `level_5`, removes the entry (or the cap if nothing else uses it) and changes the test to expect the new frames. This keeps the scene working whichever order 04 and 06 land in. Record it in the execution record so step 07's engineer sees it.

### 4.5 The simulator plays one party as today (`scripts/simulate.ts`)

- Add `export const SIM_HALL_CAP = 3` (decision 2; step 10 replaces it with `HALL_FOR_PARTIES[args.parties - 1]`).
- `hallErrand`: the upgrade clause applies only while `world.guildHall < SIM_HALL_CAP`.
- `visitGuildHall`: raise only while `world.guildHall < SIM_HALL_CAP`.
- `materialNeeds`: `GUILD_HALL_LEVELS.slice(world.guildHall, SIM_HALL_CAP)`, so the stone and silver of levels 4 and 5 are not kept back from sale.
- `visitGuildHall`'s recruits now join at the hall's level (the rule's only effect on the simulator).

### 4.6 Out of scope here

- Screens: the Guild Hall's columns, Form party, Rename, Disband and the "For:" line are step 08; the party bar is step 07.
- Exchange and wipes are step 05. Sprites are step 06.
- The simulator's guard (forming a second party) is step 10.

## 5. Verification

- **New tests** (domain project):
  - `guildHall.test.ts`: the five levels' `partyLimit`, `maxParties` (1, 1, 1, 2, 3) and `companyLimit`; `upgradeGuildHall` reaches 5 and then refuses; `recruitLevel` equals the hall's level, including with a party member below it (A10); `recruitRefusal` at `companyLimit`; `homeParties` and `homeParty` (preferred at home, preferred away, none at home).
  - `company.test.ts`: `formParty` at hall 4 succeeds from a reserve and from a home party's member (id `party_2`, default name, at the encampment, idle, empty baggage, the reserve rested); refused away from home, over `maxParties` (hall 3; and a third party at hall 4), leaving a party empty, with a bad or duplicate name (A2); the lowest free id is reused after a disband. `renameParty` with valid, empty, long and duplicate names. `disband` refusals (last party, reserves full, no other party at home, away from home) and its effect (members to reserves, baggage moved). `moveHero` between two home parties and to and from the reserves, with each refusal (away, full, empty, already there). Each refusal leaves the game unchanged (compare a deep copy).
  - `encampment.test.ts`: the guild hall's facility shows max level 5; improving it with the selected party away but another at home acts for the one at home; with none at home it refuses.
  - `encampmentView.test.ts`: the frame cap (4.4).
  - `scripts/simulate.test.ts`: `hallErrand` is false at hall 3 with the stock for level 4; `visitGuildHall` stops at 3; `materialNeeds` at hall 3 keeps no stone or silver for the hall.
- `npm test` passes, including the unchanged guard test.
- The 50-campaign check: record the diff (or "identical") and the new summary and hash (§2).
- Debug: `npx vitest run src/scenes/debugCommands.test.ts` covers `facility guild_hall 4` succeeding and `facility guild_hall 6` refused (add the cases if missing).
- In-browser: run `npm run test:browser -- -t encampment` (the encampment's text and frames changed). Read `e2e/CLAUDE.md` first.

## 6. Completion criteria

- [ ] C4 implemented as written; `recruitLevel(game)` callers updated.
- [ ] Every refusal of `formParty`, `renameParty`, `disband`, `moveHero` and the new `recruitRefusal` cap tested, each leaving the game unchanged.
- [ ] The encampment acts for `homeParty`; the guild hall's effect text updated; the frame cap in place and tested.
- [ ] `SIM_HALL_CAP` applied in `hallErrand`, `visitGuildHall` and `materialNeeds`.
- [ ] `npm test` passes; the guard test untouched and green; the 50-campaign result and new values recorded.
- [ ] Encampment in-browser tests pass.
- [ ] CLAUDE.md updated (guild hall line, `company.ts` line, encampment acting party).
- [ ] The index's row for step 04 updated with status and commit; this file's execution record filled in.

## 7. Execution record


Done by the engineer, one commit "Stage 6 step 04: the guild hall's company".

- Built as written (C4). `rested` in `guildHall.ts` is now exported, for `formParty` and `moveHero`; `toReserves`, `toParty` and `swap` are untouched. Extra helper `defaultPartyName(game)` in `company.ts`.
- `renameParty` is allowed anywhere (the plan's choice). `improveRefusal` now says "No party is at <encampment>." when no party is home (it used to say "The party is not at ..."); the old encampment test's regex was updated to match. `improveFacility` acts for `homeParty(game, party.id)`.
- Frame cap: `DRAWN_LEVELS = { guild_hall: 3 }` in `src/scenes/encampmentView.ts` (tested). **Step 07 removes it** once step 06 has drawn `level_4` and `level_5`, and changes the test to expect the new frames.
- Simulator: `SIM_HALL_CAP = 3` in `hallErrand`, `visitGuildHall` and `materialNeeds`; step 10 replaces it with the `--parties` mapping.
- Evidence: `npm test` 80 files, 1407 tests passed; the refactor guard unedited and green. 50-campaign check (`--campaign --battles 50 --seed 1`): output identical to step 01's apart from the path, hash `068016a82040ec5be673084265005a7218f0ce927629880565c1a27a8cf52d76` (the recruit rule moved nothing in 50 campaigns). Steps 05-08 match this unchanged baseline.
- The 500-campaign figure was not re-run (step 11).
