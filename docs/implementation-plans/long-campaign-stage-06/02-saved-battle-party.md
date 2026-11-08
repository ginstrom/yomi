# Step 02: A saved battle names its party

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-06-multiple-parties.md) (§2 Scenes, "BattleScene takes the expedition"; §5 Versions) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §5.4 ("BattleScene … receives the expedition id") · [Feature record](../../features/long-campaign-stage-06.md) (stage-5 hazard 1)

**Difficulty:** sonnet / opus. The change is small and follows the existing save code, so `model: "sonnet"` will do for the engineer. The reviewer should be opus (leave the model unset), because a save-shape change must be validated as strictly as the rest and must not break the version-18 migration.

## 1. Objective

A battle saved mid-fight records which party is fighting, and loading it fights that party, not the first. Today `SavedBattle` has no party id, so a load starts `Battle` without `party` and `selectedParty` falls back to `parties[0]` (stage-5 hazard 1). After this step, with two parties in the game, a save made while the second fights reloads into the second's battle.

## 2. Requirements and context

- **S6-R6** (the multi-party UI) includes "BattleScene takes the expedition". `BattleScene` already resolves `selectedParty(game, data.party)` and passes `party` back to `World`; only the save and the load lose it.
- **Decision 14 (from the index, unchanged):** `SAVE_VERSION` 20 → 21 in step 02 (a saved battle names its party) and → 22 in step 03 (the new order kinds). 21 is never released and reads as unreadable, as do stage 5's version-20 saves; the version-18 migration (`migrateFrom18`) is kept and now yields version 22's shape. No other migration.
  - In this step: `SAVE_VERSION` becomes 21; a version-18 save still loads (it can hold a battle; the migration gives that battle `party: 'party_1'`, `FIRST_PARTY_ID`, the only party it has). Version 20 now reads as unreadable.

### Contract C2 (copied unchanged from the index)

```ts
// src/game/save.ts
export interface SavedBattle { location: string; party: string; engine: BattleSnapshot; enemyRng: number; ground: GroundPile[] }
export const SAVE_VERSION = 21
```

`parseSave` refuses a battle whose `party` is not a party of the game. `MenuScene` starts `Battle` with `{ game, location, saved, party: file.battle.party }`; `BattleScene.save` writes `this.expedition.id`.

### Shared constraints (from the index)

- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, each `CampaignRecord` and a SHA-256 of every battle event against a fixture. Do not edit the fixture; keep it green. This step does not touch the simulator, so it must pass unchanged. Run the **50-campaign check** before committing and record "guard identical" (or the diff) against step 01's record (if step 01 is not yet done, against the values stage 5 recorded: 23 of 50, log `068016a8…`):

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```
- **Determinism.** Add, drop or reorder no draw of the world RNG or a battle's RNG.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate; `npx vitest run src/game/save.test.ts` for one file; `npm run test:browser` after a scene change (read `e2e/CLAUDE.md` before adding an in-browser test); each simulator run its own `--out` under `logs/`, never two `make simulate` at once.
- **Commits.** One commit, once `npm test` passes and the guard holds, on `long-campaign-stage-06`, without pushing. Never switch branches. Message "Stage 6 step 02: a saved battle names its party". No attribution lines.
- **Docs.** CLAUDE.md stays current: fix the lines this change makes wrong (the rules of saving; the save version).

## 3. Dependencies and prerequisites

- **None among this stage's steps.** It may run before, after or in parallel with step 01 (no shared files). Step 03 depends on it, and raises `SAVE_VERSION` to 22 on top of this step's 21.
- **Existing code at `63d2ea1`:**
  - `src/game/save.ts`: `SAVE_VERSION = 20`; `SavedBattle { location, engine, enemyRng, ground }`; `parseSave` accepts version 20 or 18 (`migrateFrom18`), and checks a battle's `location`, `enemyRng`, `ground` and `engine` (around lines 204–245).
  - `src/scenes/BattleScene.ts`: `BattleData.party?: string`; `create` sets `this.expedition = selectedParty(this.gameState, data?.party)`; `save()` (around line 2045) builds the `SavedBattle` from `this.location`, the engine snapshot, `this.enemyRng.state()` and `this.ground.piles()`.
  - `src/scenes/MenuScene.ts` (around line 290): `if (file.battle) this.scene.start('Battle', { game: file.game, location: file.battle.location, saved: file.battle })`. Check whether Continue (resuming a game paused under the menu) or any other path also starts `Battle` from a `SavedBattle`, and pass `party` there too.
  - `src/game/save.test.ts`: `battleOf(game)` builds a `SavedBattle` for the round-trip tests.
  - `src/game/fixtures/save-v18.json`: the version-18 fixture (stage 5), used by the migration tests.
  - `e2e/saves.test.ts`: "opens a game saved in battle in that battle, as it stood when the player's turn began".

## 4. Scope and guidance

1. **`save.ts`.**
   - Add `party: string` to `SavedBattle` (with a doc comment: the id of the expedition fighting) and raise `SAVE_VERSION` to 21. Update the comment over `SAVE_VERSION` if it names versions.
   - `parseSave`: accept version 21 or 18 (not 20). Check `typeof battle.party === 'string'` and that it names one of `game.parties` (after the migration), else unreadable.
   - `migrateFrom18`: a version-18 save's battle, if any, gains `party: FIRST_PARTY_ID`.
   - `serializeSave` needs no change beyond carrying the field (check `withKeys`).
2. **`BattleScene.save()`** writes `party: this.expedition.id`.
3. **`MenuScene`** (and any other place that starts `Battle` with `saved`) passes `party: file.battle.party`.
4. **Tests.**
   - `save.test.ts`: `battleOf` includes `party`; a round trip keeps it; a battle naming an unknown party is unreadable; a battle with no `party` is unreadable; a version-20 save is unreadable; the version-18 fixture still loads (and, if it has a battle, that battle names `party_1`). Raise any test that pins `SAVE_VERSION`.
   - A test that a game of two parties, saved in battle with the second party's id, loads with that id (construct the second `Expedition` by hand: `newExpedition` gains its `id`/`name` parameters only in step 03).
   - `e2e/saves.test.ts`: the existing battle-reload test must still pass; if the probes show the battle's party (`BattleProbe`'s `party`/column), assert the reloaded battle is the saved party's. Fix any in-browser test that writes a raw version-20 save string.
5. **CLAUDE.md**, "Rules of saving": a saved battle records the party fighting, and a load fights that party. Note `SAVE_VERSION` 21 where the version is stated (search for "version-18" and "20").

**Exclusions:** no new order kinds (step 03), no wipe handling (step 05), no change to `selectedParty`'s fallback.

## 5. Verification

- `npx vitest run src/game/save.test.ts` passes, with the new tests.
- `npm test` passes; the refactor guard is green and unedited.
- The 50-campaign check is identical to step 01's record (or stage 5's, as above).
- `npm run test:browser -- -t "saved in battle"` (and the whole `e2e/saves.test.ts`, `npm run test:browser`) passes.

## 6. Completion criteria

- [ ] `SavedBattle.party` written by `BattleScene.save`, validated by `parseSave`, and passed on by every load into `Battle`.
- [ ] `SAVE_VERSION` 21; version 18 migrates (its battle naming `party_1`); version 20 is unreadable.
- [ ] Unit tests for the round trip, unknown and missing party, and a second party's battle; in-browser saves tests pass.
- [ ] Guard test green and unedited; 50-campaign check identical, recorded below.
- [ ] CLAUDE.md's rules of saving updated.
- [ ] One commit; the index's row 02 updated with status and hash.

## 7. Execution record

- **Done:** `SavedBattle.party` (written by `BattleScene.save` from `this.expedition.id`, validated by `parseSave` against `game.parties`); `SAVE_VERSION` 21; `MenuScene` Load passes `party: file.battle.party` (the only place a `SavedBattle` starts `Battle`; Continue resumes the paused scene). `migrateFrom18` path: a v18 battle, if any, gets `party: 'party_1'` in `parseSave`. v20 reads as unreadable.
- **Tests:** `save.test.ts` (version 21, second party round trip, missing/unknown/non-string party, v20 unreadable, v18 battle migrates to `party_1`); `saveSlots.test.ts` fixture battle gained `party`. The v18 fixture has no battle, so the migrated battle is tested by hand-attaching one.
- **Gates:** `npm test` 1362 passed (80 files); `npm run test:browser` 98 passed (9 files), the existing "saved in battle" test already asserts `restored.party` equals the saved one, which is the single party here (no multi-party e2e possible until step 03). 50-campaign check: 23 of 50, log SHA-256 `068016a8...2d76`, identical to step 01 and stage 5.
- **Deviation:** none. CLAUDE.md's rules of saving updated.
