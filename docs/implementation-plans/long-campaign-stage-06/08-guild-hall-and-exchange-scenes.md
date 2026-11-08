# Step 08: Guild hall columns and exchange

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-06-multiple-parties.md) (S6-R1, S6-R3, S6-R6; §4 "What the player sees"; §6 A11) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §4.1, §4.4, §5.4

**Difficulty:** sonnet / opus. The engineer can be `model: "sonnet"`: the domain functions are fixed by steps 04 and 05 and the scenes follow `GuildHallScene`'s and the overlays' existing patterns. The reviewer should be opus (leave the model unset): it judges that no scene decides a rule, that overlays pause and resume correctly, and that the in-browser tests really exercise the flows.

## 1. Objective

The player manages the company at home and in the field:
- **The Guild Hall** shows one column per party at home and one for the reserves. A click picks a hero; a click in another column moves it there, or swaps it with the hero clicked. **Form party**, **Rename** and **Disband** act on parties.
- **The `Exchange` scene**, a new overlay over `World`, lets two parties on the same hex trade heroes and baggage. It opens from the character panel on the world map and from the footer's Exchange button, both added by this step.
- **The encampment, trading post and crafting screens** say which party they act for when more than one is at home.

## 2. Requirements and context

- **S6-R1:** forming, renaming, disbanding and moving heroes at the guild hall, between the parties at home and the reserves.
- **S6-R3:** members and baggage exchanged between two parties on the same hex.
- **S6-R6:** the Guild Hall's columns; exchange from the character panel.
- **A11:** scene tests cover the multi-party UI (this step: the guild hall's columns, exchange, the acting party).
- **Decisions from the index that this step touches** (unchanged):
  - **4. Party ids and names.** Ids are `party_1` to `party_3`; a new party takes the lowest free number. Default names `First Company`, `Second Company`, `Third Company` by that number (`PARTY_NAMES`). A rename is 1 to 16 characters, trimmed, unique among the parties (case-insensitive). The map keeps showing "Your party" while the company has one party (stage 5's user decision); with two or more it shows the names.
  - **8. Exchange UI.** A new overlay scene, `Exchange`, over `World`, opened by an Exchange button in the character panel on the world map (and in the footer) when another party shares the selected party's hex. It shows the two parties as two rows of faces, swapped or moved as in the guild hall, and their two baggages as lists, a click moving an item across. Gear on a hero moves with the hero; a member's own items go through the baggage with the character panel as today.
  - **9. The encampment's acting party** is the selected party when it is at home, else the first party at home (`homeParty`). The encampment, guild hall, trading post and crafting screens say which ("For: Second Company") when more than one party is at home. The Guild Hall shows a column for each party at home and one for the reserves.

### Contracts (copied unchanged from the index)

**C4. The guild hall and the company** (step 04):

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

**C5. Exchange and wipes** (step 05; this step uses `exchange` only):

```ts
// src/game/company.ts
export type ExchangeMove =
  | { kind: 'member'; from: string; index: number }     // member `index` of party `from` joins the other party, at its end
  | { kind: 'swap'; a: number; b: number }              // member a of party A and member b of party B trade places
  | { kind: 'item'; from: string; index: number }       // baggage item `index` of party `from` goes to the other's baggage
export function exchange(game: GameState, a: string, b: string, moves: readonly ExchangeMove[]): string | null
```

- `exchange`: refused on different hexes, while either confronts (unless both confront the same location), over `partyLimit`, or leaving a party empty; moves apply in order, all checked first (indices as they stand after the earlier moves). Reserves are not reachable (the guild hall's `moveHero` is).

**C6. The world map's company** (step 07; consumed here):
- `WorldProbe.buttons` has `exchange` (`ButtonProbe`), shown when another party shares the selected party's hex. Step 07 gives it a handler; this step makes it launch `Exchange`.
- `PartyListEntry.banner` (1–3) and `BANNER_SPRITES` exist; the Exchange scene and the Guild Hall columns may show each party's banner beside its name.

### Shared constraints (from the index)

- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: never edit its fixture in this step; it must stay green. This step changes no rule, so the **50-campaign check** must match the values recorded by step 04 (and steps 05–07) line for line and hash for hash:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  Record "guard identical" (or the diff) in the execution record.
- **Determinism.** No draw of the world RNG or a battle's RNG is added, dropped or reordered.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before the commit;
  - `npx vitest run <file>` for one file;
  - `npm run test:browser` (or `-- -t <name>`) after the scene changes; read `e2e/CLAUDE.md` before adding an in-browser test;
  - give each simulator run its own `--out` under `logs/`; never run two `make simulate` at once.
- **Scenes decide nothing.** Every control calls a function of `guildHall.ts` or `company.ts` and shows its refusal in the message line. Logic that needs no Phaser goes in a helper module beside the scene, with tests in the `domain` project (no runtime Phaser import).
- **Commits.** One commit on `long-campaign-stage-06`, without pushing, once `npm test` and the relevant in-browser tests pass. Never switch branches. Message "Stage 6 step 08: guild hall columns and exchange". No attribution lines.
- **Docs.** CLAUDE.md stays current (its scene layer: the scene list and hand-overs, `GuildHall`'s description, the new `Exchange` scene and its helper module). The manual (`docs/manual/README.md`) gains the text for the guild hall's parties and for exchange; screenshots are retaken in step 11.

## 3. Dependencies and prerequisites

- **Step 04 (done)** provides C4: hall levels 4 and 5, `maxParties`, `homeParties`, `homeParty`, `formParty`, `renameParty`, `disband`, `moveHero`, `recruitLevel(game)`. Encampment actions already act for `homeParty` in the domain.
- **Step 05 (done)** provides C5's `exchange`.
- **Step 06 (done)** provides the guild hall's `level_4` and `level_5` frames and the banner sprites.
- **Step 07 (done)** provides C6: every party drawn on the map, the party bar's banners, `partyNoun`, and names in the bar when there are two or more parties.
- **Existing code** (at `63d2ea1`, for orientation):
  - `src/scenes/GuildHallScene.ts`: a roster view of two rows (`party`, `reserves`) and a recruit view; buttons `toReserves`, `toParty`, `recruit`, `create`, `back`, `close`; click one hero then one in the other row to `swap`. It holds `expedition` from `selectedParty(game, data.party)`.
  - `GuildHallProbe` in `src/testHook.ts` (`view`, `level`, `partyLimit`, `message`, `selected`, `party`, `reserves`, `prerolls`, `buttons`).
  - `src/scenes/PartyScene.ts` types the encampment's name with every key going to it: the pattern for Rename.
  - `src/scenes/InventoryScene.ts` is the character panel; on the world map it is launched with `gearApCost: 0` and `ground: <party>.baggage`.
  - `EncampmentScene`, `TradingPostScene`, `CraftingScene` resolve their party with `selectedParty(game, data.party)` and pass `party` back on close.
  - `src/main.ts` registers the scenes.

## 4. Scope and guidance

### 4.1 The Guild Hall's columns

- **Columns.** The roster view shows a column for each party at home (`homeParties(game)`, in list order), headed by its name (and banner), then a **Reserves** column. Columns hold faces stacked vertically (up to 5 a party, `MAX_RESERVES` reserves); with three parties and the reserves that is four columns within the 720-wide frame. The frame's level line reads the hall's level, `partyLimit`, `maxParties` and the company against `companyLimit`.
- **Clicks.** A click picks a hero (gold frame). A click on a hero in another column swaps the two; a click on an empty slot or a column's header moves the picked hero there. The scene maps these to the domain:
  - party ↔ reserves move: `moveHero(game, ref, 'reserves')` or `moveHero(game, { from: 'reserves', index }, { party })`;
  - party → party move: `moveHero(game, ref, { party })`;
  - swap of a party member and a reserve: the existing `swap(game, party, member, reserve)`;
  - swap between two parties at home: `exchange(game, a, b, [{ kind: 'swap', a, b }])` (both stand on the encampment's hex).
  
  The refusal, if any, goes in the message line. The old `toReserves` and `toParty` buttons may stay as shortcuts on the picked hero, or go if the columns make them redundant; keep the probe in step with whatever remains.
- **Form party.** Enabled with a hero picked. Calls `formParty(game, <default name>, ref)`, the default being `PARTY_NAMES` at the lowest free number. On success the new party's column appears; the message says "Second Company is formed." and how to rename it.
- **Rename.** Acts on the party of the picked hero (or the column header clicked). It turns its column's header into a text field taking every key (as `PartyScene` does for the encampment name): Enter calls `renameParty`, Esc cancels; a refusal stays in the message line.
- **Disband.** Acts on the party of the picked hero; calls `disband` and shows its refusal ("The last party cannot be disbanded.", or none at home to take the baggage).
- **The recruit view** is unchanged, but its line says recruits join at the hall's level (`recruitLevel(game)`), and `recruitRefusal` now also refuses at `companyLimit`.
- **The acting party.** The scene still takes `party` in its data (`homeParty(game, data.party)`), passes it back to `Encampment` on close, and shows "For: <name>" only when more than one party is at home. If the acting party was disbanded, pass the first party at home.
- **Probe.** `GuildHallProbe` gains `columns: Array<{ party: string | null; name: string; header: Point; faces: Array<HallFaceProbe & { level: number }> }>` (`party` null for the reserves), `maxParties: number`, `renaming: string | null`, and `buttons.form`, `buttons.rename`, `buttons.disband`. Keep `party` and `reserves` (the acting party's column and the reserves) so the existing in-browser tests keep working, or update them.

### 4.2 The `Exchange` scene

- **Registration.** `src/scenes/ExchangeScene.ts`, key `'Exchange'`, registered in `src/main.ts`. It is an overlay over the paused `World` (as `Encampment` is) with scene data `{ game: GameState; party: string; other?: string }`; `other` defaults to the first other party on the same hex.
- **Opened from:**
  - a new footer Exchange button (this step adds it, beside Home and Garrison, shown when another party shares the selected party's hex, probed as `WorldProbe.buttons.exchange`): it launches `Exchange` with the selected party;
  - the character panel on the world map: `InventoryScene` shows an **Exchange** button when it is opened over `World` and another party stands on the open member's party's hex (the World scene passes that fact, or the game and party id, in the panel's data; the panel itself decides nothing). Clicking it closes the panel and launches `Exchange` as the footer does.
- **What it shows.** Two rows of faces, one per party, headed by name and banner; below each, that party's baggage as a paged list of item names (icons via `ITEM_ICON_KEYS` and `iconTint`, socket pips via `createPips`, as `TradingPostScene` draws lines). A third party on the same hex: a small selector cycles `other`.
- **Clicks.** Faces as in the guild hall: pick one, click one in the other row to swap (`{ kind: 'swap' }`), or click the other row's empty slot or header to move it there (`{ kind: 'member' }`). A click on a baggage line moves that item across (`{ kind: 'item' }`). Each click calls `exchange(game, party, other, [move])` once and redraws; the refusal goes in the message line.
- **Close** (button or Esc) stops the scene and resumes `World`, which redraws the party bar and column (the selected party's members may have changed) and saves, as after the character panel closes.
- **Helper module.** `src/scenes/exchangeView.ts`, Phaser-free, with tests in the `domain` project: which parties can exchange here (`exchangePartners(game, party): Expedition[]`, the others on its hex), turning a pick and a click into an `ExchangeMove` (`exchangeMove(pick, click): ExchangeMove | null`), and the lines a baggage list shows. Mirror whatever the guild hall's columns share into a small helper too if it keeps `GuildHallScene` thin.
- **Probe.** `ExchangeProbe` in `src/testHook.ts`: `{ parties: [string, string]; rows: Array<Array<HallFaceProbe & { level: number }>>; baggage: Array<Array<{ id: string } & Point>>; selected: { row: 0 | 1; index: number } | null; message: string; buttons: { close: ButtonProbe; other: ButtonProbe } }`, reached as the other probes are (`window.__yomi`).

### 4.3 "For: <name>"

`EncampmentScene`, `TradingPostScene` and `CraftingScene` (when opened from the encampment) resolve their party with `homeParty(game, data.party)` and, when `homeParties(game).length > 1`, show "For: <name>" under the title. Their probes gain `actingFor: string` (the party id). Crafting opened from the map's Craft button (`resume: 'World'`) keeps acting for the selected party, wherever it stands.

### 4.4 Tests

- **Domain:** `exchangeView.test.ts` (partners on a hex; pick-and-click to moves; refusals passed through). Any guild-hall helper you add gets its own test.
- **Scene smoke tests** (`src/scenes/*Scene.test.ts`): `ExchangeScene` creates and closes over a game with two parties on one hex; `GuildHallScene` creates with two parties at home.
- **In-browser tests** (read `e2e/CLAUDE.md`):
  - `e2e/encampment.test.ts`: at hall level 4 (set through the debug console, `facility guild_hall 4`, and `stock gold 500`), recruit a hero, Form party with it, see a second column named "Second Company", rename it, move a hero into it from the first column, and see a refusal for a third party at level 4; Leave, and see two entries in the party bar.
  - Exchange (in `e2e/world.test.ts` or a new `e2e/exchange.test.ts`): two parties on one hex (form one at home, as above), open Exchange from the footer and from the character panel, move a hero and a baggage item (`give` puts one in a baggage), close, and see the party bar's member counts and the baggage changed; the button is hidden when the parties stand apart.
  - Run the whole in-browser suite once before committing.

### 4.5 Docs

- **CLAUDE.md**, scene layer: `GuildHall`'s description (columns per party at home and the reserves, Form party, Rename, Disband); the new `Exchange` scene over `World`, opened from the footer and the character panel, and its helper `exchangeView.ts` in the list of helper modules; "For: <name>" on the encampment's screens; the scene graph line (`World` ⇄ `Exchange`).
- **The manual:** the guild hall's section (levels 4 and 5, forming, renaming, disbanding, moving heroes) and a short "Meeting and exchange" section. Do not retake screenshots (step 11 does); if a shot named in the manual would now mislead, say so in the execution record.

### Exclusions

- No rule changes: refusals and moves are steps 04–05's. If a refusal reads badly, change the words in the domain only if no test or guard depends on them, and say so.
- No new orders, map behaviour or party bar changes (step 07's).
- No simulator changes.

## 5. Verification

- `npm test` passes (new domain and scene tests included); the refactor guard test is green and unedited.
- The 50-campaign check matches the values recorded by step 04 (guard identical).
- `npm run test:browser` passes in full, including the new tests.
- By hand or in the in-browser tests: Form party at hall 3 is refused with the hall's limit; at hall 4 it works once and the second time is refused; Disband of the last party is refused; Exchange is refused (message) when it would leave a party empty.

## 6. Completion criteria

- [ ] Guild Hall columns, Form party, Rename, Disband, moves and swaps between columns, all through C4/C5 functions.
- [ ] `Exchange` scene registered, opened from the footer and the character panel, moving heroes and baggage items through `exchange`.
- [ ] "For: <name>" on the encampment, trading post and crafting screens when more than one party is at home.
- [ ] Probes (`GuildHallProbe` columns, `ExchangeProbe`, `actingFor`), domain, scene and in-browser tests.
- [ ] CLAUDE.md scene layer and the manual's text updated.
- [ ] Guard identical; `npm test` and `npm run test:browser` pass.
- [ ] One commit; the index's row 08 updated with status and hash.

## 7. Execution record

