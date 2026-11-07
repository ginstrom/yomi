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
