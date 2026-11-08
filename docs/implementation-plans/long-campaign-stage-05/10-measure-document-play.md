# Step 10: Measure, document, play

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-05-company-of-one.md) (§6 Verification) · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard", "Docs", "Gameplay verification")

**Difficulty:** routine but broad. It runs the simulator, writes documentation and walks the play script in a browser, so `model: "sonnet"` will do for the engineer. The reviewer should be opus, because it judges whether the docs are true to the code and whether the play script was really walked.

## 1. Objective

Close the stage:
- prove the refactor changed nothing (the 500-campaign figure identical to step 01's);
- bring CLAUDE.md, the manual and its screenshots, the stage design and the stages index up to date;
- walk the design's play script in the real game and record what was seen.

## 2. Requirements and context

- **S5-R5, no behaviour change.** A seeded simulator run gives an identical summary before and after the stage. The early-game figure was **230 of 500** after stage 4. Step 01 measured it before any change, with its full printed summary and log hash in step 01's execution record. This step must reproduce it exactly, not just within the guard's 5 points.
- **S5-R4, old saves load as a company of one.** Play script step 1 checks it with the version-18 fixture.
- **Corrections the docs must state** (from the index, unchanged):
  - **2.** The migration contradicts CLAUDE.md's old "There is no migration". The rule now reads: a migration is written when a stage's design asks for one; otherwise old saves read as unreadable. Step 03 should already have rewritten it, so check that it is there and true.
  - **3.** `Expedition.name` is stored as `'First Company'` (`FIRST_PARTY_NAME`). The world map shows `SINGLE_PARTY_NAME` ("Your party") while the company has one party. The debug console shows the stored name and the id.
  - **9.** Until something happens stops after `UNTIL_LIMIT` (30) days if nothing happens, and says that 30 days passed quietly.
  - **10.** Orders persist past an interrupt. After a walk or a stretch of camping is cut short, the order stays "Travelling to …" or "Camping". Next day carries it on, and a click on a hex or a button replaces it. A walk's remaining route is the one planned when the order was given. The `travel` and `campUntilHealed` conveniences give new orders on each call.
  - **11.** The order is shown in the world map's party list (the strip down the right), as a short line under each party's entry and in its hover summary.
- **Contracts this step documents** (C3, C5, C6, C7 of the index, as built by steps 03–09):
  - **`src/game/expedition.ts`:** `Expedition` (`id`, `name`, `members`, `baggage`, `position`, `order`, `confronting`), `Order` (idle, travel with its planned `route`, camp, day), `DayAction`, `PartyPresence`, `presences`, `FIRST_PARTY_ID`, `FIRST_PARTY_NAME`.
  - **`GameState`:** `parties: Expedition[]` (never empty while the game lasts, one in stage 5); `runes` stays the company's. Also `partyById` and `selectedParty(game, id)`.
  - **`src/game/company.ts`:** `passDay`, `advance` (limit `UNTIL_LIMIT`), `setOrder` (`OrderRequest`), `advanceRefusal`, `act`, `DayReport` (`events`, `partyEvents`, `parties`, `interrupt`). The day-passing functions keep their names and homes (`travel`, `linger`, `campDay`, `campUntilHealed`, `buildTower`, `buildOutpost`, a field `craft`, a field `embed`) as conveniences over the loop, with import cycles that are safe while no module calls another as it loads.
  - **World rules over presences:**
    - `passTurn(world, presences)` and `isNotable(world, event, presences)`;
    - blight, vision and territory take presences;
    - `ItemPlace` names its `party`, and `placeKey` keeps its format;
    - scene data carries `party?: string`.
  - **The debug console:** an optional last argument `@<party>` (an id, or a case-insensitive prefix of the name). `party` lists the company.
  - **Versions:** `SAVE_VERSION` 20, which migrates from 18 (19 unreadable). `LOG_SCHEMA_VERSION` is unchanged at 23.
- **Shared constraints (from the index):**
  - **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
    - `npm test` is the gate before the commit;
    - `npm run test:browser` after any scene change (`e2e/CLAUDE.md` says how);
    - `npm run manual:screenshots` retakes the manual's screenshots;
    - `npm run simulate -- <flags>`: give each run its own `--out` under `logs/` (gitignored, never committed). Never run two `make simulate` at once. A 500-campaign run takes about a minute and writes about 70 MB.
  - **The refactor guard.** The test in `scripts/simulate.test.ts` (`describe('the refactor guard')`) is never edited after step 01. A mismatch is a bug in an earlier step: report it, do not tune or re-fixture.
  - **Determinism.** This step changes no rule. If a measurement differs, stop and report it.
  - **Commits.** One commit on `long-campaign-stage-05`, without pushing. Never switch branches. No attribution lines in the message.

## 3. Dependencies and prerequisites

- **Steps 08 and 09 are done** (and through them 01–07):
  - `runCampaign` runs on the day loop;
  - the world map shows the order line and has Next day and Until something happens (probes `buttons.nextDay`, `buttons.untilSomething`, `PartyListProbe.order`).
- **From step 01:**
  - its execution record holds the 500-campaign summary (the 230 figure) and its log's SHA-256;
  - it also holds the 50-campaign summary and hash.
- **From step 03:** the version-18 save fixture at `src/game/fixtures/save-v18.json`. It has the party off home, something in the baggage, `confronting` set, and a runed item.
- **Environment:** Node 26, Playwright's Chromium (as `npm run test:browser` uses), and a dev server (`npm run dev`, http://localhost:5173) for the play script.

## 4. Scope and guidance

### 4.1 Measure

1. **The 50-campaign guard check,** exactly:

   ```sh
   npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
   shasum -a 256 logs/guard-50.jsonl
   ```

   The printed summary and the hash must equal step 01's.
2. **The 500-campaign figure:**

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --out logs/s5-final-500.jsonl > logs/s5-final-500.txt
   shasum -a 256 logs/s5-final-500.jsonl
   ```

   - Compare the summary line for line with step 01's. Only line 1, which names the `--out` path, may differ.
   - If step 01 hashed its 500-campaign log, compare the hashes too.
   - Expected: "Beat the Source: 230 of 500", and everything else identical.
3. **Any difference** is a bug in an earlier step. Record the diff, find the first step whose guard check differs if you can (each step's execution record says "guard identical"), and report it as a blocker. Do not tune, and do not edit the guard fixture.

### 4.2 CLAUDE.md

Do a pass over the whole file, keeping its style: one line on what a module is responsible for, rules that span files, no inventory of exports.
- **Search** for every stale name and fix or remove each line: `GameState.party`, `game.party`, `game.baggage`, `gameState.baggage`, `WorldState.party`, `world.party`, `world.confronting`, `passTurn(world, party)`, `takeLoot` (now `takeLoot(party, location)`), `deployedParties` ("the only reader of the single party … stage 05"), `leader`, `soloPresences`, `confronting`, and "the party" where the text now means one expedition.
- **The domain layer:**
  - add `expedition.ts` (the expedition, its order, presences) and `company.ts` (the day loop: orders, `passDay`, `advance`, `setOrder`, `act`, the `DayReport`; the day-passing functions are conveniences over it; the import cycles and why they are safe);
  - update `gameState.ts` (parties; the pouch stays the company's), `itemPlace.ts` (a place names its party), `camp.ts`, `worldMap.ts` (`travel` as a convenience; routes from a party), and `blight.ts`, `vision.ts` and `territory.ts` (presences, each presence's hex neutral, spawns clear of every presence).
- **Rules of the world map:**
  - time passes through the day loop: each party's order, then the world's day;
  - Next day and Until something happens (with the 30-day stop);
  - a hex click is a travel order then advance until something happens;
  - orders persist past an interrupt (correction 10);
  - a day action (camp a day, scout, wait, build, field craft, field embed) is a one-day order of the selected party;
  - the order line in the party list (correction 11), and "Your party" while there is one (correction 3).
- **Rules of saving:** `SAVE_VERSION` 20 and the migration from 18 (correction 2). Check that step 03's rewrite is there, says when a migration is written, and names the fixture.
- **The debug console paragraph:** `@<party>` and `party` listing the company.
- **The simulator paragraph:** `runCampaign` runs on the day loop, its policy setting the idle party's order with the same decisions as before. Add stage 5's line to the rules of scaling: the guard unchanged at 230 of 500, the 5-campaign refactor guard test, the 50-campaign check.
- **Scenes:** scene data carries the selected party (`party`); the world map's footer has the two buttons.

### 4.3 The manual

- In `docs/manual/README.md`'s world map section:
  - the order line under the party's entry;
  - **Next day** (one day passes, the party carrying on its order);
  - **Until something happens** (days pass until something notable, the party arrives or finishes its order, or 30 quiet days);
  - that a walk or a stretch of camping cut short keeps its order, so Next day carries it on.

  Keep the manual's player-facing voice: no code names.
- Retake the screenshots with `npm run manual:screenshots`. Check with `git status` which images changed: the world map's should, for the buttons and the order line. Look at each changed image, and commit the changed ones. If `e2e/manual.shots.ts` needs a shot of the new buttons, add it there.

### 4.4 The stage design and the stages index

- **Add `## Implementation notes`** at the end of `docs/designs/long-campaign/stage-05-company-of-one.md`. Include:
  - **The figures:** the 5-campaign guard test identical through every step; the 50-campaign summary and log hash identical (with the hash); 500 campaigns at 230 of 500, identical to step 01's.
  - **Save 20,** migrating from 18 (19 never released). `LOG_SCHEMA_VERSION` unchanged.
  - **The corrections taken,** briefly: 1 to 13 of the plan's index, with 3, 9, 10 and 11 marked as defaults for the user to confirm.
  - **What stage 6 inherits:** `placeKey` without the party, the company's pouch, and orders home, garrison and meet still to add.
  - **What the play script showed** (§4.5).
- **In `docs/designs/long-campaign/index.md`:**
  - stage 5's row gets "(done; see its [implementation notes](stage-05-company-of-one.md#implementation-notes): the guard unchanged at 230 of 500, …)" in the style of rows 1–4;
  - the conventions' guard sentence gains "stage 5 230, unchanged".

### 4.5 The play script (design §6)

Walk it in a headless browser against the dev server: Playwright with Chromium, as earlier stages did, or the in-browser tests' driver (`e2e/driver.ts`) and the probes (`window.__yomi`). Use the debug console (`~`) where it helps. For each step, record in the execution record what was done and what was seen, with probe values or screenshots in the scratchpad.

1. **Load a save made before this stage.**
   - Put the contents of `src/game/fixtures/save-v18.json` into `localStorage` under `yomi.save.1`, reload, and Load slot 1.
   - Check that the party's members, the baggage (debug `party` and the character panel's baggage), the position (`partyAt` in the probe) and the confrontation (`confronting`, and Scout, Wait and Attack in the footer) are intact.
   - The party list shows "Your party".
2. **Walk to a nest, fight and camp.**
   - Click a nest some way off. The walk stops on the same events as before.
   - If practical, compare with the same walk from the same save at `4a2b824` (a `git worktree` and a dev server on another port, with an equivalent save). Otherwise note that the guard covers the walk's rules.
   - Fight (`fight` or Attack) and win.
   - Camp until healed. The order line shows "Camping" while it lasts and "Idle" after.
3. **Next day five times with the party idle.**
   - The turn rises by 5.
   - The blight moves: the header's share or the map changes, or debug `locations`.
   - Yields arrive: debug `stock` before and after, across a yield day.
4. **Set the party travelling, then Next day.**
   - Give a travel order that is cut short (a click on a far hex, interrupted), or start a long walk and stop it on an interrupt.
   - The order line still says "Travelling to …".
   - Next day moves the party exactly one hex (`partyAt`), and the turn rises by 1.
5. **Build a watchtower** (`stock gold 100` if needed). Exactly one day passes, and the tower stands.

- Also check that **Until something happens** with the party idle stops on an event, or after 30 days with its message.
- Check that **Next day while confronting** is refused, or that the button is hidden.
- Stop the dev server afterwards.

## 5. Verification

- `npm test` passes, the refactor guard test included, its fixture unchanged since step 01 (`git log -p scripts/simulate.test.ts` shows no fixture edit after step 01's commit).
- `npm run test:browser` passes.
- Both simulator checks are identical to step 01's (§4.1).
- `grep -n "game.party\|game.baggage\|world.party\|world.confronting\|soloPresences\|leader(" CLAUDE.md docs/manual/README.md` finds nothing stale.
- `grep -rn "leader(\|soloPresences" src scripts e2e` finds nothing.
- The manual's changed screenshots have been looked at and show the buttons and the order line.

## 6. Completion criteria

- [ ] 500 campaigns identical to step 01's (230 of 500), and the 50-campaign summary and hash identical. Both recorded below.
- [ ] CLAUDE.md current: the new modules, the time controls, saving with the migration, the debug `@<party>`, the simulator on the loop, and stage 5's line in the rules of scaling.
- [ ] The manual and its screenshots current, with the changed images committed.
- [ ] The stage design's "Implementation notes" written, and the stages index's row 5 and guard sentence updated.
- [ ] The play script's five steps walked and recorded, plus the 30-day stop and the refusal while confronting.
- [ ] `npm test` and `npm run test:browser` pass.
- [ ] Committed as "Stage 5 step 10: measured, documented, played", with the attribution line.
- [ ] The index's row 10 set to done, with the commit.

## 7. Execution record
