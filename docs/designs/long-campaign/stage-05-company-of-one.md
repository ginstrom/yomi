# Stage 5: A company of one

Part of [the long campaign](index.md). Reference: [`reference/multiple-parties.md`](reference/multiple-parties.md) §4.2, §5.1, §5.2, §5.3 and §7.3 steps 1–2.

## 1. Purpose and status

This stage is a refactor that changes no behaviour, plus time controls the player can see. The game moves from one party woven through the world state to a company held as a list of parties, here a list of one. Its days run through a loop of standing orders.

Nothing about play changes except two new buttons, **Next day** and **Until something happens**, and the order shown beside the party. This is the base stage 6 builds a second party on.

**Status:** ready for planning.

## 2. Scope

**In:**
- **Step A: the company of one.**
  - `Expedition` and `GameState.parties`. `GameState.party`, `GameState.baggage`, `WorldState.party` and `WorldState.confronting` move into the expedition.
  - `leader(game)` is a stopgap while callers move.
  - `PartyPresence` is a list of `{ position, levels }`, and the blight, vision, spawn clearance and `isNotable` take it.
  - Item places name the party.
  - The save migrates an old single-party save into `parties: [First Company]`.
- **Step B: the day loop.**
  - `Order` and `src/game/company.ts`: `passDay`, `advance`, `setOrder` and `DayReport`.
  - Travel, camping and the day actions (scout, wait, build, field craft, camp a day) become orders run by the loop.
  - `travel` and `campUntilHealed` stay as conveniences built on the loop, so callers and tests keep working.
  - The simulator's `runCampaign` runs on the loop. Its policy sets the order of the single party when it is idle, with the same decisions as today.
- **The world map.**
  - The party column shows the party's order ("Travelling to Troll Lair", "Camping", "Idle").
  - The Next day and Until something happens buttons.
  - A click on a hex still means travel there, then advance until something happens.
- **Debug commands** take an optional party name. The `party` command lists the company.

**Out:**
- more than one party, the guild hall's levels 4 and 5, meeting, garrisons and wipe rules (stage 6).

## 3. Requirements

| ID | Requirement | Reference |
| --- | --- | --- |
| S5-R1 | The company is a list of expeditions, and the world rules take presences. | company R1, R8, §5.1, §5.2 |
| S5-R2 | One clock: `passDay` runs each party's order, then the world's day. `advance` stops on an interrupt. | company R4, R5, R7 |
| S5-R3 | Day actions run as one-day orders for the selected party. | company R6 |
| S5-R4 | Old saves load as a company of one. | company §5.1 |
| S5-R5 | No behaviour changes. A seeded simulator run gives an identical summary before and after. | company A1 |

## 4. What the player sees

The same game:
- The party column says what the party is doing.
- **Next day** passes a day with the party continuing its order.
- **Until something happens** runs days until an interrupt, as walking does today.
- Clicking a hex works exactly as before.

## 5. Technical notes

- **The refactor guard comes first.** Before any change, store the summary of `--campaign --battles 50 --seed 1` as a test fixture in `scripts/simulate.test.ts`, with a short run (about 5 campaigns) for test speed. After each step, the run must match exactly.
- **Determinism.** The blight's party source and spawn clearance must use the presence list in the same order and arithmetic as today, so the run stays identical.
- **The ~90 call sites** move behind `leader(game)` first, then to explicit expeditions. Scenes get the selected expedition from scene data.
- **Versions:** `SAVE_VERSION` is bumped, with the migration. `LOG_SCHEMA_VERSION` is unchanged.

## 6. Verification

**Tests:**
- The refactor guard (S5-A5).
- `company.test.ts`:
  - `passDay` for each order kind with one party;
  - `advance` stops on interrupts;
  - refuses while confronting;
  - day actions.
- `save.test.ts`: migrating an old save; round-tripping a company.
- `blight.test.ts` and `vision.test.ts`: presence lists of one give today's numbers.
- The existing scene tests pass unchanged, except for the new buttons.

**Simulator:** an identical summary from seed 1 for the guard run, and the full early-game figure exactly as before.

**Play script:**
1. Load a save made before this stage. The party, baggage, position and any confrontation are intact.
2. Walk to a nest: the walk stops on the same events as before. Fight and camp.
3. Press Next day five times with the party idle. The day counter rises, the blight moves, and yields arrive.
4. Set the party travelling, then press Next day. It moves one hex.
5. Build a watchtower. One day passes.

## 7. Risks

- **The refactor's breadth.** The guard makes any drift visible at once. Keep step A and step B as separate commits.

**Done when:** the guard matches exactly, all tests pass, and the play script has been walked.

## Implementation notes

Built as ten steps (`docs/implementation-plans/long-campaign-stage-05/`).

**The figures.** The 5-campaign refactor guard (`scripts/simulate.test.ts`) was identical through every step. The 50-campaign run from seed 1 gives the same summary and log hash as before the stage (SHA-256 `068016a82040ec5be673084265005a7218f0ce927629880565c1a27a8cf52d76`, 852 battles, 23 of 50). The 500-campaign run gives **230 of 500 (46.0%)**, 9121 battles, line for line the summary measured before the stage, and the same log (SHA-256 `d17e6dca65137917aaa7e1bb873ab241b323dbe6152e338c141ae618b51613fd`). Only the printed `--out` path differs.

**Save 20.** `SAVE_VERSION` went from 18 to 20 and migrates from 18 (19 was never released). `LOG_SCHEMA_VERSION` is unchanged at 23. CLAUDE.md's old "there is no migration" now reads: a migration is written when a stage's design asks for one.

**The plan's corrections, as taken.** 1 two save bumps, one migration; 2 the migration against CLAUDE.md's old rule; 3 the party shows as "Your party" while it is the only one, stored as "First Company" (**default, for the user to confirm**); 4 a travel order carries its planned route; 5 orders are idle, travel, camp and day; 6 the day-passing functions keep their names and homes as conveniences over the loop; 7 `DayReport` carries more than the reference's; 8 the rune pouch stays the company's; 9 Until something happens stops after 30 quiet days and says so (**default, to confirm**); 10 orders persist past an interrupt (**default, to confirm**); 11 the order is shown in the world map's party list (**default, to confirm**); 12 `placeKey` keeps its format; 13 `leader(game)` is gone, every reader taking an explicit party.

**What stage 6 inherits.** `placeKey` without the party (it changes format with a second party), the company's single rune pouch (whether a party in the field may embed from it is open), and the orders home, garrison and meet, still to add to the `Order` union. The simulator's `carryOut` mirrors the start of `worldMap.travel` for a travel order; both must change together.

**The play script, walked headless** (Playwright through the in-browser driver, against the dev server, with the debug console):
1. Loading `src/game/fixtures/save-v18.json` from slot 1: the three heroes, their hit points, the two items in the baggage, the party on the hex it stood on and the confrontation with the Goblin Raiders came through; Scout, Wait and Attack showed and Next day and Until something happens did not; the party list hover said "Your party" and "Before the Goblin Raiders"; debug `party` showed `party_1 (First Company)`.
2. After Wait freed the party, a click on a far hex walked it until "You sight a Kobold Diggers" stopped it (the order line "Travelling"); it returned, attacked the Goblin Raiders and won through the real battle, and Camp passed a day. Not observed: the "Camping" line during a camp until healed, as the party was whole after the win (a level-up heals), though the in-browser tests plant a wounded party and a camp order and see it. Not done: the same walk from the same save at the commit before the stage; the guard covers the walk's rules.
3. Five Next days: the turn rose by exactly 5, the blight's total rose, and the stock went from gold 20, iron 10 to gold 24, iron 12 across a yield day.
4. The cut-short walk kept "Travelling"; Next day moved the party exactly one hex and the turn by 1.
5. With gold and iron added, Build Watchtower stood one tower and passed one day.
Also: Until something happens with the idle party passed 30 days and said "30 days passed quietly."; Next day and Until something happens are hidden while the party stands before monsters (the refusal is `advanceRefusal`, tested in `company.test.ts`).

