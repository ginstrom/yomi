# Step 05: The debug `fight` command

[Plan index](index.md) · Source design: [stage 1](../../designs/long-campaign/stage-01-foe-foundations-and-bandits.md), S1-R7

## Objective

Add the debug console command `fight <encounter> [threat]`. On the world map, it starts a battle of any encounter at any threat against the party, as if a monster location had been attacked. The battle clears no location, takes no loot, and leaves the blight alone. This stage's play script uses it to fight the Bandit Camp, and later stages use it to check their foes in play.

## Requirements and context

- **S1-R7:** the debug command `fight <encounter> [threat]`. It changes the game, so it is a world-map command. It starts a battle of that encounter at that threat. The threat defaults to `threatAt` of the party's hex.
- **What such a battle does:**
  - it is a normal battle against the party's current members, at their current hit points;
  - a win gives experience as any win does;
  - no location is cleared, no loot is taken, and the blight is not cleansed.
- **Shared constraints** (from the index):
  - `make test` (podman, Node 26) is the gate before committing.
  - `npm run -s typecheck` and `npx vitest run --project domain` work locally for domain code.
  - Scene tests (`src/scenes/*Scene.test.ts`) run under jsdom with Phaser, in `make test`.
  - One commit for this step on the current branch, without pushing. The message ends with the repo's `Co-Authored-By` attribution line.
  - `LOG_SCHEMA_VERSION` and `SAVE_VERSION` are unchanged by this step.

### Contract C8 (copied from the index, unchanged)

```ts
// src/scenes/debugCommands.ts — DebugSource (existing interface) gains:
/** Starts a battle of `encounter` at `threat` against the party, as if a location were attacked; absent where battles can't start. */
fight?: (encounter: EncounterId, threat: number) => void
```

- The `fight <encounter> [threat]` command is `changes: true`, so it runs on the world map only. Its usage line is `fight <encounter> [threat]`.
- It validates the encounter against `ENCOUNTERS` and the threat as an integer ≥ 1. The threat defaults to `threatAt(world.party)`.
- It calls `source.fight`, and refuses with a message when `fight` is absent.
- **WorldScene** provides `fight` by starting `'Battle'` with `{ game, encounter, threat }`.
- **BattleScene's** init data gains `encounter?: EncounterId` and `threat?: number`. These are used only when no `location` is given: the encounter is `ENCOUNTERS[location?.encounter ?? data.encounter ?? DEFAULT_ENCOUNTER]` at `location?.threat ?? data.threat`.
- **Such a battle:**
  - rewards experience as any win does;
  - takes no loot and clears no location;
  - leaves the blight untouched;
  - is never saved mid-battle (already the case for a battle without a location).

## Dependencies and prerequisites

- **Step 01** (contract C3): `ENCOUNTERS[id](party, threat?)` keeps its signature and clamps the threat to the encounter's band (`clamp(Math.floor(threat), band.min, band.max)`). So `fight` may pass any integer ≥ 1 and the encounter makes it legal. Today's code already clamps to `1..MAX_THREAT`, so this step works on that too. Step 01 only widens the rule per encounter.
- **Step 03** is not needed. `fight` lists whatever `ENCOUNTERS` holds, and `bandit_camp` appears there once step 03 lands. The play check of fighting the Bandit Camp belongs to step 07.
- **No unresolved blockers.**

## Scope and implementation guidance

### Inspected, existing code

- **`src/scenes/debugCommands.ts`:**
  - `Command` is `{ usage, summary, changes?: true | 'withArgs', run(args, context) }`, held in `COMMANDS`.
  - `DebugSource` is `{ game, battle?, changed? }`.
  - `DebugError` is the refusal type. `gameOf(context)` gets the game, and `integer(raw, what)` parses integers.
  - `goto` and `days` are the patterns to follow: world-map changers that use `world.party` and `worldActive`.
  - `help` lists `usage` and `summary`, and marks changers with `*`. `completions` exists for tab completion.
  - The console runs a changer only when the source has `changed` (the world map). Check how `runCommand` refuses a change off the world map: `fight` must fail the same way in battle.
- **`src/scenes/debugConsole.ts`** finds the scene in front with a `debugSource()` and hands it to the commands.
- **`src/scenes/WorldScene.ts`:**
  - `debugSource()` (about line 318) returns `{ game, changed }`. Add `fight` here.
  - Attacking a location starts the battle with `this.scene.start('Battle', { game: this.gameState, location: here.id })` (about line 897). Start the debug battle the same way, with `{ game: this.gameState, encounter, threat }`.
- **`src/scenes/BattleScene.ts`:**
  - `BattleData` (about line 75) is `{ game?, location?, saved? }`. Add `encounter?: EncounterId` and `threat?: number`, documented as used only without a location.
  - The battle is built at about line 293: `ENCOUNTERS[this.location?.encounter ?? DEFAULT_ENCOUNTER](partyFighters(party), this.location?.threat)`. Change it to the C8 form.
  - The saved battle's meta (about line 1807) records `encounter` and `threat` from the location. Without a location it is never saved mid-battle (the guard at about line 1835, "A battle with no monster location behind it is a test's"), so no change is needed there. If the meta's fallbacks are shared with the outcome text, use the data's encounter and threat so they are right.
  - `endBattle` (about line 1883) already guards `takeLoot` and `clearLocation` on `this.location`, and says "Your foes" without one.
- **`src/game/worldMap.ts`:** `threatAt(position)` (exported) and `world.party` (the party's hex).
- **`src/game/encounters.ts`:** `ENCOUNTERS` and `EncounterId`.

### Changes

1. **The `fight` command** in `COMMANDS`:
   - `usage: 'fight <encounter> [threat]'`, a summary along the lines of "Fight an encounter at a threat (default: here's), with no location cleared and no loot", and `changes: true`.
   - `run` validates the id with `Object.hasOwn(ENCOUNTERS, id)`. An unknown or missing id raises `DebugError`, listing the ids.
   - It parses the threat with `integer` and requires it to be ≥ 1. If omitted, it uses `threatAt(world.party)`.
   - If `context.source?.fight` is absent, it raises `DebugError` ("Battles start only from the world map.").
   - Otherwise it calls `source.fight(id, threat)` and returns a line such as `Fighting goblin_raid at threat 3.`
   - Decide whether the result reports `changed`: the console's redraw and save after a changer must not fight the scene change. Read how `debugConsole.ts` uses `changed` and the result, and make sure starting the Battle scene and then running `changed()` on WorldScene does not misbehave (e.g. saving the world after the scene has stopped). If it does, have the command report no change while still being world-map-only.
   - Add `fight` to `completions` if completions list encounter ids for other commands. Otherwise just the command name.
2. **WorldScene's `debugSource()`** gains `fight: (encounter, threat) => this.scene.start('Battle', { game: this.gameState, encounter, threat })`. If the party is confronting a location, the debug battle still starts. `world.confronting` is left as it is.
3. **BattleScene:** the `BattleData` fields and the construction line as in C8. Nothing else changes: the loot and clearing guards already hold.

### Excluded

- No new encounter, no change to bands or `ENCOUNTERS`, and no change to the battle engine, saves or the log.
- No `fight` from the battle scene, which has no `fight` in its source, so it is refused.

## Verification

**A check to make first:** confirm that a win without a location still runs `rewardVictory`. Read `endBattle`: `xpLines = playerWon ? describeRewards(rewardVictory(this.gameState.party, this.xpReward, this.gameState.baggage)) : []` runs regardless of `this.location`, as at `9c740ae`. Confirm that `this.xpReward` is set from the encounter built at init (`xpReward(fight)`), not from the location. Record what you find in the completion note. If XP depends on the location, fix it so a debug battle rewards XP, and test it.

**Tests:**
- **`src/scenes/debugCommands.test.ts`** (domain project, Phaser-free), following the existing tests' fake `DebugContext`:
  - `fight goblin_raid 3` calls `source.fight` with `('goblin_raid', 3)`;
  - `fight goblin_raid` uses `threatAt` of the party's hex. Put the party (via `world.party`) on a hex whose threat is known, e.g. home gives 1 and another hex gives more;
  - an unknown id, a missing id, `0`, `-1` and `x` as the threat are each refused, and `source.fight` is not called;
  - with a source that has `changed` but no `fight`, it is refused with the message;
  - off the world map (a source without `changed`) it is refused as other changers are;
  - `help` lists `fight <encounter> [threat]`.
- **`src/scenes/BattleScene.test.ts`** (jsdom):
  - starting the scene with `{ game, encounter: 'kobold_scouts', threat: 2 }` and no location builds that encounter at that threat (the enemy units match `koboldScouts(..., 2)`);
  - a win in such a battle leaves `world.locations` and the blight unchanged, and adds nothing to the baggage from loot;
  - the party gains XP.

  Reuse the file's existing helpers for driving a battle to its end.
- **The full run:** `make test` passes. Locally, `npm run -s typecheck` and `npx vitest run --project domain src/scenes/debugCommands.test.ts` pass first.

**A manual check, optional here and required in step 07:** run `make dev`, open the console with `~` on the world map, and run `fight goblin_raid 3`. The battle starts with three foes at level 3. Win it: XP is shown, and back on the world map no location is gone.

## Docs

CLAUDE.md, under Commands (the debug console paragraph), lists what changers do: "healing, experience, stock, items, facilities' levels, revealing the map, moving the party, passing days". Add "starting a battle of any encounter at any threat (`fight`, through the source's `fight`, which only `World` offers)". Also note that `Battle` takes `encounter` and `threat` in its data when started without a location. Keep to the file's style.

## Completion criteria

- [x] `fight <encounter> [threat]` works on the world map, and is refused off it, without a source `fight`, and with bad arguments.
- [x] BattleScene uses `data.encounter` and `data.threat` without a location. No loot is taken, no location is cleared, the blight is unchanged, and XP is rewarded (check recorded).
- [x] The tests above are added and `make test` passes.
- [x] The CLAUDE.md debug console paragraph is updated.
- [x] Committed. The index's step 05 row is set to `done`, with a completion note (commit, checks run, the XP check's finding) added at the end of this file.

## Completion note

- **Commit:** "Step 05: the debug fight command" (one commit: code, tests, CLAUDE.md, this note and the index).
- **The XP check:** `xpReward` is set in `BattleScene.create` from the encounter built there (`this.xpReward = xpReward(fight)`), and `endBattle` runs `rewardVictory(..., this.xpReward, ...)` for any win, location or not. Only `takeLoot` and `clearLocation` are guarded on `this.location`. So a battle with no location already rewarded experience; nothing needed fixing. The in-browser test below confirms it (the victory screen shows `+N XP each`).
- **Changes:**
  - `src/scenes/debugCommands.ts`: `DebugSource.fight` (C8), and the `fight <encounter> [threat]` command, `changes: true`. It refuses an unknown or missing id (listing `ENCOUNTERS`' ids), a threat that is not a whole number or is below 1, and a source with no `fight` ("Battles start only from the world map."). Off the world map `runCommand` refuses it before it runs, as other changers. The threat defaults to `threatAt(world.party)`.
  - The `changed` question: the command reports a change, so the console runs WorldScene's `changed()` (redraw, save, `checkOutcome`) after `fight`. That is harmless: `scene.start` only queues the stop and start for the scene manager's next step, so `changed()` runs on a World still live, and saves a game nothing has changed. No special case was needed.
  - `completions` completes command names only, so `fight` needed no entry.
  - `src/scenes/WorldScene.ts`: `debugSource()` gains `fight`, starting `'Battle'` with `{ game, encounter, threat }`. `world.confronting` is left alone.
  - `src/scenes/BattleScene.ts`: `BattleData` gains `encounter?` and `threat?`, documented as used only without a location. The choice of encounter is `chooseBattle` (below), C8's rule. The `battle_turn` story moment now reads the scene's encounter id and the built encounter's threat (`Encounter.threat`), rather than falling back to Goblin Raid at threat 1 when there is no location. For every monster location these equal the location's own (each location's threat lies in its encounter's band).
  - **New helper `src/scenes/battleSetup.ts`** (`chooseBattle`, `DEFAULT_ENCOUNTER`, moved from BattleScene): what a `Battle` start asks for, a monster location's encounter and threat, else the data's, else Goblin Raid. CLAUDE.md lists it among the scene helpers.
  - CLAUDE.md: the debug console paragraph names `fight` among the changers, and says `Battle` takes `encounter` and `threat` without a location and what such a battle does. `e2e/CLAUDE.md`: `debug.test.ts`'s line.
- **Tests:**
  - `src/scenes/debugCommands.test.ts` (`fight`): calls `source.fight('goblin_raid', 3)`; the default threat is `threatAt` of the party's hex (home, then the Bandit Camp's hex, threat 3); an unknown id, a missing id, `0`, `-1` and `x` are refused and `fight` is not called; a source with `changed` and no `fight` is refused with the message; a source with `fight` but no `changed` (in battle) is refused as other changers are; `help` lists `fight <encounter> [threat]`. Red first: all five failed ("Unknown command").
  - `src/scenes/battleSetup.test.ts`: a location overrides the data; without one the data's encounter and threat are used; an id naming a quiet location gives no location; nothing asked gives Goblin Raid at its default threat.
  - `e2e/debug.test.ts`: on a new game's map, `fight kobold_scouts 2` starts `Battle`; its foes match `koboldScouts(readyMadeParty fighters, 2)` by id and maximum hit points; the battle is won (`WINNING_SEED`), the result shows XP and no "Found:"; back on the map the locations and the blight are unchanged.
- **Deviation from the task file:** it asks for `BattleScene.test.ts` (jsdom) tests that drive a battle with "the file's existing helpers". There are none: every `*Scene.test.ts` is a one-line smoke test, and CLAUDE.md says scene behaviour is tested through helper modules and in-browser tests. So the encounter choice was pulled into `battleSetup.ts` and tested in the domain project, and the battle itself (the encounter built, XP, no loot, no location cleared, the blight untouched) is tested in the browser, where `fightBattle` exists.
- **Verification:**
  - `npm run -s typecheck`: clean. `npx vitest run --project domain src/scenes/debugCommands.test.ts src/scenes/battleSetup.test.ts`: 17 + 4 passed.
  - `make test`: 65 files, 748 tests passed.
  - `make test-browser ARGS="e2e/debug.test.ts"`: 3 of 3 passed. `make test-browser ARGS="e2e/battle.test.ts e2e/saves.test.ts e2e/story.test.ts"` (BattleScene changed): 19 of 19 passed.
  - The manual `make dev` check was not done by hand; the in-browser test plays the same steps in the real game (headless Chromium). Step 07 walks it in play.
- **For later steps:** `fight bandit_camp 3` (or 4, 5) fights the camp anywhere on the map; a threat outside an encounter's band is fought at the band's nearest threat.
