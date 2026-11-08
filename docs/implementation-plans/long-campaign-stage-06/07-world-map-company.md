# Step 07: The world map's company

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-06-multiple-parties.md) (S6-R2, S6-R6; §4 "What the player sees"; §6 A5, A11) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §4.2, §5.4

**Difficulty:** opus / opus. Leave the engineer's and the reviewer's model unset. This is the stage's largest scene change: `WorldScene` goes from drawing one party to drawing a company, its clicks gain a meaning (meet), its time controls must focus the right party, and the footer must still fit at 840×560. The reviewer must check the scene decides nothing the domain should.

## 1. Objective

The world map shows and drives a company of up to three parties:
- every party is drawn on the map, its first member's figure with its banner, offset when several share a hex;
- the party list (the right-hand strip) shows each party's banner, and its name once there are two or more;
- the footer gains **Home** and **Garrison**; a click on a hex where another party stands gives the selected party a **meet** order;
- an interrupt names the party it concerns and selects and centres it; a refused Next day or Until something happens selects and centres the party that blocks it;
- the encampment shows the guild hall's levels 4 and 5 with their own frames.

**Exchange is not this step's:** step 08 adds the Exchange button (footer and character panel) and the `Exchange` scene, and the `exchange` field of `WorldProbe.buttons`. This step adds `home` and `garrison` only.

## 2. Requirements and context

- **S6-R2:** all orders, interrupts with focus, and confrontation blocking for every party.
- **S6-R6:** the party bar and the multi-party UI; banners on the map; order buttons; interrupts focus and centre the party concerned.
- **A5:** advancing stops on the first notable event of any party and names it; it refuses while a confrontation is unanswered. **A11:** scene tests cover the party bar, orders, and focus on an interrupt.
- **Design §4 (what the player sees):** two banners on the map; select the Second Company and click a kobold nest near home, select the First Company and send it east, Until something happens moves both; "Second Company: arrived at Kobold Scouts." centres on it; select the Second Company and click the First's banner to meet it.

### Decisions from the index (unchanged)

4. **Party ids and names.** Ids are `party_1` to `party_3`; a new party takes the lowest free number. Default names `First Company`, `Second Company`, `Third Company` by that number (`PARTY_NAMES`). A rename is 1 to 16 characters, trimmed, unique among the parties (case-insensitive). The map keeps showing "Your party" while the company has one party (stage 5's user decision); with two or more it shows the names.

5. **Orders.** `home` is a travel order to the encampment with its own kind (label "Returning home"). `garrison` is allowed only on a held resource site (not the encampment; road hexes are stage 8), does nothing and never ends by itself (label "Garrisoning <site>"). `meet` re-plans its route to the other party's current hex every day, ends with a `met` party event when the two share a hex, and becomes idle with `order_done` when the other party is gone. A meet may step onto a monster location the other party stands on, and then confronts it too.

10. **The party bar** is stage 5's right-hand strip, kept at its width: each entry gains its banner (colour by party number: 1 crimson, 2 azure, 3 green), and its hover summary leads with the party's name. The left column keeps showing the selected party's members. On the map every party is drawn, its first member's figure with its banner; several on one hex are offset.

11. **Map clicks.** A click on a hex where another party stands gives the selected party a meet order (hover: "Meet Second Company"); any other hex is travel, as today. Parties are selected through the bar. New footer buttons: Home (away from home), Garrison (on a held resource site), Exchange (another party on the hex). Only the selected party's walk is animated; the others jump to their new hexes when it ends (stage-5 hazard "animating other parties' walks", deferred).

12. **Interrupts and refusals** name the party when the company has two or more ("Second Company: arrived at Kobold Scouts."). When Next day or Until something happens is refused because a party confronts monsters, the map selects and centres that party (`blockingParty`). One exported `partyNoun` replaces the private copies.

(Decision 11's Exchange button is step 08's; see §1.)

### Contracts (copied unchanged from the index)

**C6. The world map's company (this step):**

- `partyList.ts`: `PartyListEntry` gains `banner: number` (1–3, from the id); `PartyListProbe` gains `name: string` and `banner: number`. `BANNER_SPRITES` (by banner number) names the atlas sprites made in step 06.
- `WorldProbe.buttons` gains `home` and `garrison` (step 07) and `exchange` (step 08) (`ButtonProbe`); `WorldProbe` gains `parties: Array<{ id: string; at: Hex; screen: Point }>` (each party's figure on screen).
- The world map's message prefixes an interrupt with the party's name when there are two or more parties.

(This step adds `home` and `garrison`; step 08 adds `exchange`, with the button it probes.)

**C3. Orders for a company (step 03; consumed here):**

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
- `orderLabel` (partyList.ts): `home` "Returning home", `garrison` "Garrisoning <site>", `meet` "Meeting <name>".

**C5. Exchange and wipes (step 05; consumed here):** after a wipe that is not lost, `BattleScene` returns to `World` selecting the first party, which may be a party formed from the reserves (`Wipe.reformed`). The world map must draw whatever parties `game.parties` holds when it opens; nothing else of C5 is this step's.

**C7. Sprites (step 06; consumed here):**

- `camp_guild_hall` gains frames `level_4` and `level_5` (the Barracks).
- Banners: three atlas sprites (or one sprite with three frames/anims, the engineer's choice under `art/CLAUDE.md`), each with an `idle` animation, in crimson, azure and green; their names are recorded in step 06's execution record for `BANNER_SPRITES`.

### Shared constraints (from the index)

- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`. **Do not edit the fixture**; keep it green. This step touches no domain rule and no simulator code, so the guard must be identical. Run the **50-campaign check** before committing and record "guard identical" or the diff:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  It must match the values recorded by step 04 (and matched by step 05) line for line and hash for hash.
- **Determinism.** Add, drop or reorder no draw of the world RNG or a battle's RNG; parties act in list order.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate;
  - `npx vitest run <file>` for one file;
  - `npm run test:browser` after the change (read `e2e/CLAUDE.md` before adding an in-browser test);
  - each simulator run its own `--out` under `logs/`; never two `make simulate` at once.
- **Commits.** One commit, "Stage 6 step 07: the world map's company", on `long-campaign-stage-06`, without pushing. Never switch branches. No attribution lines.
- **Docs.** CLAUDE.md stays current: fix the lines this change makes wrong (the scene layer's world map paragraph, `partyList.ts`'s and `PartyListView.ts`'s lines, "one today" and "Your party" wording, the footer's buttons, the asset tables if `BANNER_SPRITES` is a new id-to-asset table), and search it for every name you rename or remove. Update the manual's text for the world map (`docs/manual/README.md`); the screenshots are retaken in step 11.

## 3. Dependencies and prerequisites

- **Step 03** (done): the order kinds, `met`, stopping short, `partyNoun`, `blockingParty`, `orderLabel` for the new kinds, save 22.
- **Step 04** (done): `homeParties`, `homeParty`, `formParty`, hall levels 4–5. If step 04 left a fallback for the guild hall's missing level-4/5 frames in `encampmentView.ts`, remove it here.
- **Step 05** (done): `exchange`, `wipeParty`, the defeat flow back to `World`.
- **Step 06** (done): the banner sprites and the guild hall frames in the atlas; its execution record names the banner sprites.
- **Existing code at `63d2ea1`** (inspected):
  - `WorldScene.ts` keeps `selectedParty` (an id), `selectParty(id)` (selects and centres; the interrupt path at ~line 1047 already calls it for `reports.at(-1)?.interrupt?.party`), `centreOnSelected`, `playWalk` (animates the selected party's steps; `walkingOrder` overrides its order line while it plays), and the time buttons' handlers calling `advanceRefusal` (~lines 1015, 1027). It draws one party figure (~line 617, "Shows the party's figure wearing and holding what its first member does now").
  - `partyList.ts`: `deployedParties(game, shown?)`, `orderLabel`, `standingRoute`, `SINGLE_PARTY_NAME`, `PARTY_LIST_W` 80, `ENTRY_PITCH` 104. `PartyListView.ts` draws the entries.
  - `testHook.ts`: `PartyListProbe` (`id`, `members`, `selected`, `confronting`, `order`, `hovered`), `WorldProbe` (`partyAt`, `confronting`, `message`, `buttons` with `nextDay`, `untilSomething`, the camp, build and enter buttons).
  - `worldEvents.ts` (`describeWorldEvents`, `describePartyEvent`, `describeDays`), `hexInfo.ts`, `mapScroll.ts`, `UnitFigure.ts`.

## 4. Scope and implementation guidance

### 4.1 Every party on the map

- Draw one figure per party in `game.parties` (a `UnitFigure` dressed from its first member, as the single party's is now), with its banner sprite (`BANNER_SPRITES[banner]`, playing `idle`) beside or above it. Keep figures in a map keyed by party id and redraw them when the company changes (a party formed, disbanded or wiped while the map was paused).
- **Offsets on a shared hex:** parties on one hex are spread by a small fixed offset in list order (for example −10, 0, +10 px horizontally), the selected one drawn on top. Put the offset rule in a Phaser-free helper (`partyList.ts` or a new helper module, with a test) so it can be tested.
- The banner number comes from the id (`party_2` → 2), never from the list position, so a colour stays with its party.
- **The walk:** only the selected party's steps are animated (`playWalk`). Every other party's figure jumps to its new hex when the walk ends (or at once when no walk plays). Remember the selected party may change at the end of the walk (the interrupt's party).
- Hover over a hex with parties shows them in the info panel (`hexInfo.ts`): their names, as far as the fog allows (own parties are always known).

### 4.2 The party list

- `PartyListEntry.banner` (from the id) and `name`: "Your party" (`SINGLE_PARTY_NAME`) while there is one party, else the party's name (decision 4). `PartyListView` draws the banner over the portrait's corner; the hover summary leads with the name. The strip keeps `PARTY_LIST_W`; entries keep their pitch, three fitting at 560 high (check).
- `PartyListProbe` gains `name` and `banner`.

### 4.3 Orders from the map

- **Click a hex where another party stands** (with the selected party not standing there): `setOrder(game, selected, { kind: 'meet', party: other })`, then advance as a hex click does today (Until something happens semantics: `advance`, save first, play the selected party's walk). The hover route preview is the route to that party, and the header hint says "Meet <name>". With two other parties on one hex, meet the first in list order. A refusal (`setOrder`'s string) goes in the message.
- **Home** (footer, shown while the selected party is away from the encampment and stands on no monster location): `setOrder(…, { kind: 'home' })` then advance, as a hex click does.
- **Garrison** (footer, shown on a held resource site without monsters): `setOrder(…, { kind: 'garrison' })`; no day passes; the order line says "Garrisoning <site>". A click without it being allowed puts the refusal in the message.
- The footer's action row must fit at 840×560 with Camp, Camp until healed, Craft, Build Watchtower, Build Outpost, Enter, Home and Garrison (not all show at once: Enter only at home, Home only away, Garrison only on a held site, Build Outpost only on a held site without one). Shrink widths or drop to a smaller font as needed; check the probe rects do not overlap and stay inside the window at 840×560 and 1280×720. Leave room for step 08's Exchange (shown only when another party shares the hex).

### 4.4 Interrupts and refusals

- **Interrupt messages:** with two or more parties, the message for the stopping report is prefixed with the party's name (`partyNoun`): "Second Company: arrived at Kobold Scouts." / "First Company: Goblin Marauders sighted." For a world interrupt whose `party` is null (a site threatened), no prefix. Do the wording in `worldEvents.ts` (Phaser-free, tested), taking the interrupt and the game.
- **Focus:** the map already selects and centres `interrupt.party`; keep it, and make sure it also happens for `met`, `order_done` and `confronting` of a party that is not the selected one, and that the column, footer and standing route follow.
- **Refusals:** when Next day or Until something happens is refused and `blockingParty(game)` is non-null, select and centre it, and show the refusal (which now names it via `partyNoun`) in the message. The footer then shows Scout, Wait and Attack for it, as it stands on monsters.
- The time buttons stay hidden while the **selected** party stands on a monster location (stage 5's rule); another party's confrontation is answered through the refusal's focus.

### 4.5 The encampment's guild hall frames

`encampmentView.ts`'s `facilityFrame` draws `camp_guild_hall/level_4` and `level_5` from the atlas (step 06). Remove any fallback step 04 added; extend `encampmentView.test.ts`.

### 4.6 Probes and tests

- `testHook.ts`: `WorldProbe.buttons.home`, `WorldProbe.buttons.garrison`; `WorldProbe.parties` (`id`, `at`, `screen`: each figure's screen point, so a test can click another party's hex); `PartyListProbe.name`, `banner`.
- **Helper tests (domain project):** the banner from an id; offsets on a shared hex; `deployedParties` names ("Your party" with one, names with two); the interrupt message prefix; the hover hint for a meet hex.
- **Scene smoke test** (`src/scenes/WorldScene.test.ts`, scenes project): a game of two parties opens and draws two figures and two entries.
- **In-browser tests** (`e2e/world.test.ts`; read `e2e/CLAUDE.md`). Build a two-party game either through the debug console (`facility guild_hall 4`, `stock gold 500`, and a hero to form with, if the Guild Hall's Form party is not yet on screen — it is step 08's) or, more simply, by writing a version-22 save with two parties to a slot the way `e2e/saves.test.ts` writes saves, then loading it. Cover:
  1. both parties move on one Until something happens (each given a travel order: one via the bar and a hex click, the other likewise), and their figures' `at` change;
  2. an interrupt concerning the non-selected party selects it (`PartyListProbe.selected`) and the message starts with its name;
  3. with one party confronting monsters, Next day is refused, the blocking party becomes selected, and the footer shows Scout/Wait/Attack;
  4. a click on the other party's hex gives a meet order (the entry's order reads "Meeting …") and, after advancing, a `met` brings them to one hex;
  5. Home walks the party home ("Returning home"); Garrison on a held site sets "Garrisoning …" (use `goto` to put the party on a held site).
- Run the whole `npm run test:browser`: stage 5's single-party tests must still pass unchanged ("Your party", one figure).

### 4.7 Docs

- **CLAUDE.md:** the scene layer's world map paragraph (every party drawn with banners; the strip shows banners and names from two parties; Home, Garrison, meet by click; interrupt and refusal focus; others jump after the walk), `partyList.ts`'s and `PartyListView.ts`'s helper lines, any new helper module's line, `BANNER_SPRITES` among the asset tables, the guild hall's frames to level 5. Remove "one today" where it is now false.
- **Manual** (`docs/manual/README.md`): the world map's parties, the bar, Home, Garrison, meeting, interrupts naming the party. No screenshots in this step.

### Exclusions

- The Exchange button and scene, the Guild Hall columns, the "For: <name>" lines (step 08).
- No domain rule changes; if one seems needed, stop and report it (it belongs in step 03–05's contracts).
- No animation of other parties' walks (decision 11).
- No simulator changes.

## 5. Verification

- `npm test` passes (new helper and scene tests included).
- `npm run test:browser` passes in full, with the new world tests.
- The guard test passes untouched; the 50-campaign check matches step 04's recorded values.
- Screenshots (not committed) at 840×560 and 1280×720 of: two parties on the map with banners, two on one hex, the footer with Home and Garrison, the meet hover hint. Attach their paths in the execution record; the footer must not overflow at 840.

## 6. Completion criteria

- [ ] Every party drawn with its banner; shared hexes offset; others jump after the walk.
- [ ] Party list banners and names ("Your party" with one party).
- [ ] Home, Garrison, meet by click, with refusals in the message.
- [ ] Interrupt messages name and focus the party; refusals focus `blockingParty`.
- [ ] Guild hall frames level 4–5 used, no fallback.
- [ ] Probes (C6, without `exchange`), helper, scene and in-browser tests.
- [ ] CLAUDE.md and the manual's text updated.
- [ ] Guard identical; `npm test` and `npm run test:browser` pass; one commit; index row updated with status and commit.

## 7. Execution record

