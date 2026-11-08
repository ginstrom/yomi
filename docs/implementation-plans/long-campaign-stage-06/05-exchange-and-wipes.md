# Step 05: Exchange and wipes

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-06-multiple-parties.md) (S6-R3, S6-R4; §6 tests A7, A9; play script 4–5) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §4.3 ("A wipe"), §4.4, §8.2, §8.6, §8.7, R9, R11

**Difficulty:** opus / opus. Leave the engineer's and the reviewer's model unset. This step changes the game's loss rule and the battle's defeat path, which deletes save slots, and adds an all-or-nothing domain action; a mistake loses a player's playthrough or leaves `parties` empty.

## 1. Objective

- Two parties on the same hex can **exchange** members and baggage items (`exchange`, domain only; the screen is step 08).
- A party **wiped out** in battle is gone: its heroes are dead, what they wore and carried lies at the monster location as loot, and the game goes on while any hero is left anywhere (`wipeParty`, `heroesLeft`).
- `BattleScene`'s defeat follows that rule: it deletes the slot only when no hero is left.
- A debug command `hp` sets hit points, for the play script's death.

The simulator is untouched: its `'fallen'` outcome changes in step 09.

## 2. Requirements and context

- **S6-R3 (company R9).** Two parties on the same hex may exchange members and baggage. A reserve joins or leaves only at the encampment (the guild hall's `moveHero`, step 04), never through `exchange`.
- **S6-R4 (company R11).** A party wiped out in battle is gone. Its heroes are dead, and its baggage is left at the monster location as loot. The game is lost only when the encampment falls, or when no hero remains in any party or the reserves.
- **A7.** An exchange on a shared hex moves members and items. It is refused on different hexes, and refused for reserves outside home.
- **A9.** A wipe removes the party and leaves its baggage as the location's loot. The game is not lost while other heroes live, and is lost when none do.

### Decisions from the index (unchanged)

- **7. Wipes.** A wiped party's members are dead; what they wore and carried goes into its baggage (as `buryFallen` does), and the baggage is added to the location's `loot`. A debug fight has no location: its baggage is lost. The game is lost only when no hero is left in any party or the reserves (or the encampment falls, as today). **If the last party is wiped while reserves remain, a new party is formed at once at the encampment from the reserves** (up to the party limit, the lowest free id and default name), so `parties` is never empty.
- **17. Debug.** A new `hp <amount> [member|all] [@party]` sets hit points (for the play script's death). `facility guild_hall 4` works through the hall's new levels.
- **14. Saves.** No save shape changes here; `SAVE_VERSION` stays 22 (from step 03).

### Contracts (copied unchanged from the index)

**C5, exchange and wipes (this step):**

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

**Consumed from step 03 (C3):**

```ts
// src/game/expedition.ts
export const MAX_PARTIES = 3
export const PARTY_NAMES: readonly string[] = ['First Company', 'Second Company', 'Third Company']
export function partyId(n: number): string            // `party_${n}`
export function newExpedition(members: Party, position: Hex, id = FIRST_PARTY_ID, name = FIRST_PARTY_NAME): Expedition
// src/game/company.ts
export function partyNoun(game: GameState, party: Expedition): string   // 'The party' with one party, else its name
```

A meet order whose other party is gone becomes idle with `order_done` (step 03 handles that in the day loop; a wipe needs nothing more for it).

**Consumed from step 04 (C4):**

```ts
// src/game/guildHall.ts
export function maxParties(world: WorldState): number
export function companyLimit(world: WorldState): number
export function homeParties(game: GameState): Expedition[]     // at the encampment, in list order
export function homeParty(game: GameState, preferred?: string): Expedition | null
// src/game/company.ts
export type HeroRef = { from: 'party'; party: string; index: number } | { from: 'reserves'; index: number }
export function formParty(game: GameState, name: string, hero: HeroRef): string | Expedition
```

A party formed stands at the encampment, idle, with no baggage; it takes the lowest free id and its default name (decision 4).

### Shared constraints (from the index)

- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: do not edit the fixture; keep it green. Run the 50-campaign check before committing and record "guard identical" (it must match step 04's recorded values, line for line and hash for hash):

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  The simulator does not call `wipeParty` or `exchange` in this step, so nothing should move.
- **Determinism.** Add, drop or reorder no draw of the world RNG or a battle's RNG. `wipeParty` and `exchange` draw nothing.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate;
  - `npx vitest run <file>` for one file;
  - `npm run test:browser` (or `-- -t <name>`) after this step's scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - each simulator run its own `--out` under `logs/`; never two `make simulate` at once.
- **Commits.** One commit, "Stage 6 step 05: exchange and wipes", on `long-campaign-stage-06`, without pushing. Never switch branches. No attribution lines.
- **Docs.** CLAUDE.md stays current: fix the lines this change makes wrong, and search it for every name you rename or remove.

## 3. Dependencies and prerequisites

- **Step 03 (done):** the order kinds (C3), `newExpedition` with id and name, `PARTY_NAMES`, `partyId`, `MAX_PARTIES`, `partyNoun`, `blockingParty`; `SAVE_VERSION` 22; the meet order's "other party gone" rule.
- **Step 04 (done):** the hall's levels 4 and 5, `maxParties`, `companyLimit`, `homeParties`, `homeParty`, `HeroRef`, `formParty`, `renameParty`, `disband`, `moveHero`; `recruitLevel` at the hall's level. Reuse its name/id helpers for the reformed party rather than writing a second "lowest free id" rule.
- **Existing code (at `63d2ea1`):**
  - `src/game/party.ts` `buryFallen(party, baggage)` puts each fallen member's equipment and backpack items into `baggage`, empties them, and removes the member. `rewardVictory` calls it on a win.
  - `src/game/guildHall.ts` `partyLimit(world)`, `MAX_RESERVES`, the private `rested(hero)` (full hit points and mana for a hero leaving the reserves).
  - `src/scenes/BattleScene.ts` `endBattle()` (near its end): on a win, `takeLoot`, `takeRunes`, `clearLocation`, `rewardVictory`, then `this.save()`; on a defeat, `deleteSlot(slot)` and `slot = null`; the banner "DEFEAT", the line "The party has fallen. The journey ends here.", the button "Main Menu". The button's handler (`leave`, around line 700) starts `World` after a win, else `Menu`. `this.location` is null for a debug fight (`chooseBattle` without a location). `this.expedition` is the fighting party (from scene data `party`). The probe exposes `outcome`, `result: string[]` and `buttons.result`.
  - `src/scenes/debugCommands.ts`: `COMMANDS`, `members(party, who)` (a member by number or name, or `all`), `partyOf(context)` (the `@<party>` rule), `heal` as the model for `hp`. A command with `changes: true` redraws and saves the world map after it.
  - `e2e/battle.test.ts`, `e2e/saves.test.ts` ("the slot deleted by a defeat"), `e2e/driver.ts` (`loseBattle`, `fightBattle`, `enterBattle`), `e2e/debug.test.ts` (driving the debug console).

## 4. Scope and implementation guidance

### 4.1 `exchange` (`src/game/company.ts`)

- Look up both parties by id; refuse unknown ids and `a === b`.
- Refuse when they stand on different hexes ("<A> and <B> are not on the same hex."), or when either confronts monsters, unless both confront the same location.
- Check every move before changing anything. Simulate the moves on copies of the two member lists and baggages (indices as they stand after the earlier moves), refusing:
  - an index with no member or item;
  - `member` that would leave its party empty, or take the other over `partyLimit(world)`;
  - `swap` with an index missing on either side.
  Then apply the same moves for real. Return null when done.
- A hero moving keeps what it wears and carries and its hit points (no `rested`: it is in the field). A `member` joins at the end of the other party's battle order; `swap` keeps each hero's place index.
- Reserves are never named by a move (no `HeroRef` here): that is how "refused for reserves outside home" holds; say so in the doc comment, and test that the guild hall's `moveHero` refuses a reserve for a party away from home (it is step 04's; a test here pins A7's half).
- Write refusals with `partyNoun` / party names, in the project's plain sentences.

### 4.2 `wipeParty` and `heroesLeft` (`src/game/company.ts`)

- `heroesLeft(game)`: the sum of every party's members and the reserves.
- `wipeParty(game, id, location)`:
  1. Bury every member with the same rule as `buryFallen` (call it with every member's `hp` treated as fallen, or factor a `buryAll` beside it in `party.ts`; do not copy the item-gathering code). `dead` is the members, in battle order.
  2. `left` is the baggage's items (the members' gear now among them). With a `location`, push them onto `location.loot`; with none (a debug fight), they are lost.
  3. Remove the party from `game.parties`. Any party with a `meet` order for it is left to the day loop's rule (step 03).
  4. If `game.parties` is now empty and the reserves are not: form a party at the encampment from the reserves, in their order, up to `partyLimit(world)`, each `rested`, with the lowest free id and its default name; it is `reformed`. Use step 04's machinery (`formParty` with the first reserve, then `moveHero` for the rest) only if its refusals allow it with no party at home; otherwise build it directly with `newExpedition` and the same id/name helper. Either way it stands at the encampment, idle, with no baggage.
  5. `lost` is `heroesLeft(game) === 0`. Change no world status.
- `wipeParty` must not touch the location otherwise: it stays on the map (not cleared), its other confronting parties keep confronting it.

### 4.3 `BattleScene` defeat (`src/scenes/BattleScene.ts`)

- In `endBattle`, on a defeat: call `wipeParty(this.gameState, this.expedition.id, this.location)` (after `syncUnitsFromEngine`, so the characters hold their final hit points).
  - `lost`: as today — delete the slot, clear `slot`, "The party has fallen. The journey ends here.", button "Main Menu", leave to `Menu`.
  - Otherwise: `this.save()`, banner "DEFEAT", line `The <name> has fallen. Its baggage lies at <location>.` (with the location's name through the article helpers, `theName`; for a debug fight, `The <name> has fallen.` with no second sentence; if `reformed`, add a line `The reserves form the <reformed name> at <encampment>.`), button "OK", leaving to `World` with `party` set to the first party's id.
  - "The <name>" is the party's stored name ("The Second Company"); with `partyNoun` it reads naturally only for one party, so use the name here.
- The save after a non-final defeat holds no battle (`battle: null`): `save()` must not write the finished battle (check how the victory's save handles it and do the same).
- Probe: `outcome` and `result` already carry the banner and lines; make sure `buttons.result` is the OK button and that the probe lets a test tell "went on" from "game over" (e.g. `result` text, or add `wiped: { lost: boolean } | null` to the battle probe in `src/testHook.ts` if the text is not enough).

### 4.4 Debug `hp` (`src/scenes/debugCommands.ts`)

- `hp <amount> [member|all] [@party]`, `acts: true`, `changes: true`: sets each named member's hit points to `amount`, kept within 0 and `maxHp`. Refuse a non-integer or negative amount. Returns `<name> now has <hp>/<max> hit points.` per member. `help` lists it.
- Test it beside the other commands' tests (`debugCommands.test.ts`).

### 4.5 Docs

- **CLAUDE.md:**
  - Rules of progression: "A battle is lost only when every member has fallen, and that ends the game, reserves or not" becomes: a lost battle wipes the party (`wipeParty`: its heroes dead, their gear and its baggage left as the location's loot), and the game ends only when no hero is left in any party or the reserves; the last party wiped with reserves left is replaced by one formed from them at the encampment.
  - Rules of saving: a defeat deletes the slot only when no hero is left; otherwise the game is saved and goes back to the world map.
  - The scene layer's line "a defeat deletes the game's slot and goes back to `Menu`" likewise.
  - `company.ts`'s module line: it gains exchange and wipes.
  - The debug console's list: `hp` among the commands that take `@<party>`.
- The manual's text for defeat (`docs/manual/README.md`, the section on battles or permadeath): one or two sentences on a wiped party when others live. Screenshots are step 11's.

### 4.6 Exclusions

- No Exchange screen or footer/panel button (step 08); no party bar change (step 07).
- No simulator change: `fightAt` still returns `'fallen'` on a lost battle (step 09).
- No `SAVE_VERSION` or `LOG_SCHEMA_VERSION` change.

## 5. Verification

- **`src/game/company.test.ts`** (A7, A9), on games built with `newGame` and a second party made with `newExpedition(..., partyId(2), PARTY_NAMES[1])` or `formParty`:
  - exchange: a `member` move, a `swap` and an `item` move on a shared hex, checking battle order, gear carried with the hero, and baggage;
  - refused: different hexes; one party confronting (and allowed when both confront the same location); a move leaving a party empty; over `partyLimit`; a bad index; nothing changed after any refusal (the whole move list rejected, including valid earlier moves);
  - a reserve cannot be moved to a party away from home (`moveHero` refuses);
  - wipe: the party is gone; its members' gear and its baggage are on `location.loot`; `dead` lists them; `lost` false while another party or a reserve lives;
  - wipe with no location: the items are lost, the party gone;
  - wipe of the last party with reserves: `reformed` stands at the encampment, idle, empty baggage, members rested, up to `partyLimit`, the lowest free id and its default name; `parties` not empty;
  - wipe of the last party with no reserves: `lost` true.
- **`src/scenes/debugCommands.test.ts`:** `hp 1 1`, `hp 0 all @<party>`, clamping to `maxHp`, refusals.
- **In-browser** (`e2e/battle.test.ts`, read `e2e/CLAUDE.md` first): plant a game with two parties (form one through the debug console and guild hall, or plant a slot through `localStorage` as `saves.test.ts` does), lose a battle with the second party (`hp 1 all @second`, `goto` a nest `@second`, Attack, then `loseBattle`), and see: the result says it has fallen, OK returns to `World`, the first party is selected, the slot still exists and loads, and the location's loot holds the baggage (through the debug console's `locations` or the probe). The existing "slot deleted by a defeat" test in `saves.test.ts` must still pass (one party, no reserves).
- `npm test` passes; `npm run test:browser` passes (at least `battle.test.ts`, `saves.test.ts`, `debug.test.ts`; the full run before the commit).
- The guard test unchanged and green; the 50-campaign check identical to step 04's record.

## 6. Completion criteria

- [ ] `exchange`, `wipeParty`, `heroesLeft` and `ExchangeMove`, `Wipe` exported from `company.ts` exactly as C5.
- [ ] A defeat with heroes left saves and returns to `World`; with none, it deletes the slot as before.
- [ ] Debug `hp` with its test.
- [ ] Domain tests for A7 and A9; the in-browser wipe test.
- [ ] `npm test` and `npm run test:browser` pass; guard identical (recorded).
- [ ] CLAUDE.md and the manual's text updated.
- [ ] One commit; the index's row 05 set to done with its hash.

## 7. Execution record
