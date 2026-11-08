# Step 09: The world map's time controls

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-05-company-of-one.md) (§2 "The world map", §4, §6) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §4.2

**Difficulty:** pattern-following scene work: `model: "sonnet"` for the engineer, the session's model (opus) for the reviewer. It adds no rule; the domain loop it drives is step 06's and 07's.

## 1. Objective

The world map shows each party's standing order, and gives the player two time controls:
- **Next day** passes one day, with every party carrying on its order;
- **Until something happens** passes days until an interrupt, or until `UNTIL_LIMIT` (30) days pass quietly.

A click on a hex works exactly as before. The game is otherwise unchanged, and the refactor guard stays identical.

## 2. Requirements and context

- **Design §2 / §4:** "The party column shows the party's order ('Travelling to Troll Lair', 'Camping', 'Idle'). The Next day and Until something happens buttons. A click on a hex still means travel there, then advance until something happens." §6: "The existing scene tests pass unchanged, except for the new buttons."
- **Corrections from the index, which this step carries out:**
  - **3. The party keeps showing as "Your party".** `Expedition.name` is stored as `'First Company'` (`FIRST_PARTY_NAME`). The world map shows `SINGLE_PARTY_NAME` ("Your party") while the company has one party (the user's decision, party-list design Q2, resolved 2026-10-31).
  - **9. Until something happens stops after `UNTIL_LIMIT` (30) days** if nothing happens. With an idle party in a quiet land it would otherwise not stop. The message says that 30 days passed quietly.
  - **10. Orders persist past an interrupt.** After a walk or a stretch of camping is cut short, the party's order stays "Travelling to …" or "Camping". Next day carries it on, and a click on a hex or a button replaces it. A walk's remaining route is the one planned when the order was given. The `travel` and `campUntilHealed` conveniences give new orders each time they are called.
  - **11. Where the order is shown:** in the world map's party list (the strip down the right), as a short line under each party's entry and in its hover summary. The design says "party column". The list is the per-party element that stage 6's party bar grows from, while the left column shows the selected party's members.
- **C7 (from the index, unchanged):**
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
- **Shared constraints (from the index):**
  - **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
    - `npm test` (`tsc && vitest run`) is the gate before the commit;
    - `npx vitest run <file>` for one file;
    - `npm run test:browser -- -t <name>` (or `make test-browser ARGS="-t <name>"`) after any scene change. Read `e2e/CLAUDE.md` before adding an in-browser test.
  - **The refactor guard.**
    - The test `describe('the refactor guard')` in `scripts/simulate.test.ts` must pass unchanged. **Never edit its fixture.**
    - Before committing, run the 50-campaign check:

      ```sh
      npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
      shasum -a 256 logs/guard-50.jsonl
      ```

      The summary must equal, line for line, the one in step 01's execution record, and the hash must equal step 01's. This step changes no domain rule, so any difference is a bug in it.
  - **Determinism.** No change to a world or battle RNG draw, or to the order of a day's events.
  - **Commits.** One commit, once `npm test` passes and the guard holds, on `long-campaign-stage-05`, without pushing. Never switch branches. Message: `Stage 5 step 09: the world map's time controls`, with no attribution lines.
  - **Docs.** Keep CLAUDE.md current for what this step changes (see §4.6). The manual's text and screenshots are step 10's.

## 3. Dependencies and prerequisites

- **Step 07** (and through it 01–06) is done. Step 08 may run alongside; it touches only `scripts/simulate.ts` and its test. Neither step may change `company.ts`'s contract; if this step needs a change there, say so in the record and coordinate.
- **Consumed from earlier steps (copied from the index's C3 and C6):**

```ts
// src/game/expedition.ts (step 03/04)
export type Order =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Hex; route: Hex[] }   // route: the hexes still to walk, `to` last, planned once when given
  | { kind: 'camp' }                            // camp until healed
  | { kind: 'day'; action: DayAction }          // one day's action, then idle
export type DayAction =
  | { kind: 'scout' } | { kind: 'wait' } | { kind: 'camp' } | { kind: 'tower' } | { kind: 'outpost' }
  | { kind: 'craft'; place: ItemPlace; modifier: ModifierId; grade: Grade }
  | { kind: 'embed'; place: ItemPlace; rune: RuneKey }
export interface Expedition { id: string; name: string; members: Party; baggage: Item[]; position: Hex; order: Order; confronting: string | null }
export const FIRST_PARTY_ID = 'party_1'
export const FIRST_PARTY_NAME = 'First Company'
// src/game/gameState.ts
export function selectedParty(game: GameState, id?: string): Expedition   // partyById, else parties[0]

// src/game/company.ts (steps 06, 07)
export type PartyEvent =
  | { type: 'arrived'; party: string; at: Hex }
  | { type: 'confronting'; party: string; location: string }
  | { type: 'order_done'; party: string }
export interface Interrupt { party: string | null; event: WorldEvent | PartyEvent }
export interface PartyDay { party: string; walked: Hex | null; rested: number; cast: number; made: Item | null }
export interface DayReport { events: WorldEvent[]; partyEvents: PartyEvent[]; parties: PartyDay[]; interrupt: Interrupt | null }
export const UNTIL_LIMIT = 30
export function advanceRefusal(game: GameState): string | null
export function passDay(game: GameState): DayReport | null          // null, changing nothing, when advanceRefusal says no
export function advance(game: GameState, limit?: number): DayReport[] // stops after a report with an interrupt, when the world stops being active, when refused, or after `limit` (default UNTIL_LIMIT) days
```

- `travel(game, party, to): Journey` (worldMap.ts) is unchanged in what it returns; the hex click keeps using it.
- **Existing code** (at `4a2b824`; steps 03–05 changed the reads, not the shape):
  - `src/scenes/partyList.ts`: `PARTY_LIST_W` (80), `ENTRY_SIZE` (64), `ENTRY_PITCH` (80), `partyEntryRect`, `partyEntryBarRect`, `partyListInfo`, `deployedParties`, `SINGLE_PARTY_NAME`;
  - `src/scenes/PartyListView.ts` draws the entries;
  - `src/scenes/WorldScene.ts`: the footer's buttons (`createButton`, `BUTTON_W`, `WIDE_BUTTON_W`), the walk playback (`walking`), the camp handlers (`onCamp`, `onCampUntilHealed`) that word a day's events and save, and `probe()`;
  - `src/scenes/worldEvents.ts`: the words for a turn's events;
  - `src/testHook.ts`: `WorldProbe`, `PartyListProbe`.

## 4. Scope and guidance

### 4.1 The order line (`partyList.ts`, Phaser-free)

- Add `orderLabel` exactly as C7 says. A location's name is used only if the player knows it (a sighted monster location; a quiet location whose hex is explored, `seen` not `UNEXPLORED`). Never leak what the fog hides.
- `deployedParties(game)` maps `game.parties` in order (it may already, after step 05), with `order: orderLabel(game.world, party)` and the name `SINGLE_PARTY_NAME` while `game.parties.length === 1`, else `party.name`.
- `partyListInfo` adds the order line to the hover summary, after the hit points (the confronting line may then be redundant with "Before the …": keep one, not both).
- If the order line needs room under the entry, adjust the entry's geometry (pitch, a rect for the order text, e.g. `partyEntryOrderRect`) and keep `partyEntryRect` and `partyEntryBarRect` consistent with it. Test the geometry in `partyList.test.ts`.

### 4.2 The party list view (`PartyListView.ts`)

- Draw each entry's order as a small line (or two, wrapped) under its hit point bar, within `PARTY_LIST_W` (80 px); "Travelling to Salamander Pool" must wrap, not overflow. Shorten with an ellipsis (`fitText` in `panelButton.ts`) if two lines are not enough.
- Refresh it whenever the list is refreshed (after every action that changes the game).
- `PartyListProbe.order` reports the text of the line (the full label, not the wrapped text).

### 4.3 The footer buttons (`WorldScene.ts`)

- Add **Next day** and **Until something happens** to the footer. They show whenever the game is active and the selected party is not confronting (where Scout, Wait and Attack show instead), and never on the victory or defeat screen.
- The footer must still fit at 840 px wide (`MIN_GAME_SIZE`), with Camp, Camp until healed, Craft, Build Watchtower or Build Outpost, and Enter showing at once at the encampment or a held site. Measure; narrow labels or button widths, or wrap the footer onto two rows, as the existing layout allows. Record the widths chosen.
- **Next day:**
  1. If `advanceRefusal(game)` gives a reason, show it as the message and do nothing else.
  2. Else `passDay(game)`. If the selected party walked (`report.parties` entry's `walked`), play the one-hex walk as a journey's step plays.
  3. Word the day's events as camping's are worded (`worldEvents.ts`), and the interrupt if any.
  4. Redraw, save, and raise the world's story moment for a turn with its events, as other actions that pass time do.
- **Until something happens:**
  1. Refusal as for Next day.
  2. Else `advance(game)` (its default limit, `UNTIL_LIMIT`).
  3. Play the selected party's walked hexes, in order, as a journey plays.
  4. Report the events and the interrupt. If the reports ran out at `UNTIL_LIMIT` with no interrupt, the message is "30 days passed quietly." (built from `UNTIL_LIMIT`).
  5. If the interrupt names a party, select it and centre the view on it (with one party, that is the selected one).
  6. Redraw, save, raise the story moment.
- **A click on a hex is unchanged:** it calls the `travel` convenience as today. After an interrupt cuts the walk short, the order line keeps saying "Travelling to …" (correction 10), and Next day carries the walk on.
- **Camp until healed** and the other actions are unchanged; after Camp until healed is interrupted, the line says "Camping".
- Avoid running both buttons' handlers while a walk is playing (`walking`), as a hex click is refused then today.

### 4.4 Probes (`testHook.ts`, `WorldScene.probe()`)

- `WorldProbe.buttons.nextDay` and `buttons.untilSomething` (`ButtonProbe`, via `buttonProbe`).
- `PartyListProbe.order: string`.
- Comment each field as the neighbouring ones are.

### 4.5 Tests

- **`partyList.test.ts`:** `orderLabel` for each case (idle, travel to a sighted nest, to an unsighted one, to an explored quiet location, to a plain hex, camp, each day action, confronting); `deployedParties`' `order` and its name `SINGLE_PARTY_NAME` with one party; the hover summary's order line; the entry geometry if it changed.
- **`WorldScene.test.ts`** (scenes project, smoke): still passes; extend only if it lists the footer's buttons.
- **In-browser tests** in `e2e/world.test.ts` (read `e2e/CLAUDE.md` first; use the driver's helpers and probes, not the game state, where the conventions say so):
  1. With the party idle at home, Next day raises the turn by one and the party's entry reads "Idle".
  2. A travelling party moves one hex per Next day: click a far hex, let an interrupt stop the walk (or set the order up as the e2e conventions allow, e.g. through the debug console), check the line reads "Travelling to …" or "Travelling", press Next day, and see `partyAt` move one hex along the way and the turn rise by one.
  3. Until something happens stops on an event: the turn rises, and the message names an event, or says 30 days passed quietly.
  4. After Camp until healed, a wounded party's line reads "Camping" while it camps, or "Idle" when it is whole.
  5. Both buttons are hidden while the party stands before monsters.
- Run `npm run test:browser` in full after the change, since the footer's layout may move other tests' buttons.

### 4.6 CLAUDE.md

Update the scene layer:
- the world map's footer (Next day and Until something happens, when they show and what they do, the 30-day limit);
- the party list's entry (the order line, "Your party" while alone);
- the `partyList.ts` helper's line (`orderLabel`, `deployedParties` mapping `game.parties`).

Search CLAUDE.md for `deployedParties` and "Your party" and fix any line this step makes wrong.

### 4.7 Out of scope

- The manual's text and screenshots (step 10).
- Any domain change (`company.ts`, the conveniences). Home, garrison and meet orders, banners, focus between several parties (stage 6).

## 5. Verification

| Check | Command | Expected |
| --- | --- | --- |
| Gate | `npm test` | passes, the guard test included and unchanged |
| Helpers | `npx vitest run src/scenes/partyList.test.ts` | the new cases pass |
| In-browser | `npm run test:browser` | all pass, the new world tests included |
| 840 px footer | in-browser at 840×560 | every footer button visible and clickable (probes in view) |
| Guard | the 50-campaign check (§2) | summary and hash identical to step 01's |

## 6. Completion criteria

- [ ] `orderLabel`, `PartyListEntry.order` and the hover line, tested.
- [ ] The order line drawn under each entry, wrapped within the strip.
- [ ] Next day and Until something happens, shown and hidden per C7, each refusing with `advanceRefusal`'s reason, saving and raising the story moment; the 30-day message.
- [ ] Probes `buttons.nextDay`, `buttons.untilSomething` and `PartyListProbe.order`.
- [ ] The new in-browser tests pass, and the whole in-browser run passes.
- [ ] The footer fits at 840 px.
- [ ] CLAUDE.md updated (§4.6).
- [ ] `npm test` passes; the guard identical; committed as `Stage 5 step 09: the world map's time controls`.
- [ ] The index's table shows this step done with its commit.

## 7. Execution record
