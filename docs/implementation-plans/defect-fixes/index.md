# Implementation plan: Yomi defect fixes

Fixes for the non-feature issues from the 2 October 2026 code review: two movement bugs, gaps in the battle screen, and loose ends in validation, the simulator and tests. No game rules change.

**Source design:** "Yomi Defect Fixes" design canvas, <https://claude.ai/artifact/3PhMw4zJFeGPdZn6V6G5Bp> (version `1791011051-f49e`, dated 3 Oct 2026; also exported as `~/Downloads/Yomi Defect Fixes.pdf`). It has four boards: *Overview and plan*, *Fixes 1–2: movement*, *Fixes 3–5: battle screen*, *Fixes 6, 7, 9: validation, stats, tests*. The plan was written against repo commit `f3d2684`.

## Scope and shared constraints

- **In scope:** review items 1–7 and 9 (see the requirement map below).
- **Out of scope:** review item 8 (the computer opponent working round to sides and backs), waypoints, and balance tuning.
- **One commit per fix**, so any fix can be held back. Commit messages end with the repo's `Co-Authored-By` attribution line.
- **Test first:** each fix's new test is written first and seen to fail, then passes after the fix. Fixes 3 and 5 are the exceptions: the design checks them by hand and with `tsc`.
- **Battle outcomes and the log format stay as they are**, except where a fix says otherwise. Only fix 1 changes outcomes, because some routes change. No fix changes an event's shape, so `LOG_SCHEMA_VERSION` (currently 7, in `src/engine/battleEngine.ts`) stays the same.
- **Commands:** `npm test` runs `tsc && vitest run`. `make test` runs the same thing in the podman dev container. The simulator is `node scripts/simulate.ts [flags]` or `make simulate ARGS="..."`. Its output goes under `logs/`, which is gitignored.
- **Test layout** (`vitest.config.ts`): `src/**/*.test.ts` and `scripts/**/*.test.ts` run in the Node `domain` project. Only `src/scenes/*Scene.test.ts` run under jsdom with Phaser. New helper modules under `src/scenes/` must be Phaser-free so their tests run in `domain`, the way `scrollingLog.ts` already does.

## Tasks

| Step | Task | Outcome | Depends on | Status |
| --- | --- | --- | --- | --- |
| 01 | [Hint AP cost from the engine (fix 5)](01-hint-ap-cost.md) | Hint strings use `ATTACK_AP_COST` | none | done |
| 02 | [Validate starting facing (fix 6)](02-validate-facing.md) | Constructor rejects facings outside 0–5 or non-integer | none | done |
| 03 | [Average rounds over decided battles (fix 7)](03-simulator-avg-rounds.md) | `avgRounds` leaves out abandoned battles; `summarize` is tested | none | done |
| 04 | [Event schedule module (fix 9, part 1)](04-event-schedule.md) | `scenes/eventSchedule.ts` drives event playback; tested | 01 | done |
| 05 | [Show the mover's turn before each free attack (fix 2)](05-face-before-free-attack.md) | Face cue before each interrupting attack; `MoveEvent.facing` comment corrected | 04 | done |
| 06 | [Score routes by distinct attackers (fix 1)](06-route-distinct-attackers.md) | `reachableHexes` minimises distinct provokers; simulator compared before and after | 02, 05 | done |
| 07 | [Board clicks only on the board (fix 3)](07-board-clicks-only.md) | Clicks on buttons, the log and the scrollbar no longer reach `onBoardClick` | 04 | done |
| 08 | [Fit small windows (fix 4, fix 9 part 2)](08-fit-small-windows.md) | Board and inventory panel scale down; `scenes/boardGeometry.ts` is tested | 07 | done |
| 09 | [Final browser pass](09-final-browser-pass.md) | One manual check of fixes 2, 3 and 4 together | 05, 06, 07, 08 | done |

## Execution order

This follows the design's commit order: quick fixes, then the schedule helper, then movement, then the screen.

1. **01, 02 and 03** are independent and touch different files (`BattleScene.ts`, `battleEngine.ts`, `scripts/simulate.ts`). They can run in parallel, but commit them in the order 01, 02, 03.
2. **04**: the schedule helper. It edits `applyEvents` in `BattleScene.ts`, so it comes after 01.
3. **05, then 06.** 05 builds on 04's `scheduleEvents`. 06 edits `battleEngine.ts` after 02 and 05 have touched it, and its simulator comparison needs a baseline taken just before 06.
4. **07, then 08.** Both edit `BattleScene.ts`, so run them one after the other. They don't depend on 05 or 06 for anything except avoiding edit conflicts in `BattleScene.ts`. Run them after 05 if possible.
5. **09** at the end.

**Checkpoints:** `npm test` passes after every commit. After 06, also compare the simulator runs (see step 06).

## Requirement map

Requirement IDs follow the review's item numbers, as the design uses them. The `-T` labels are local to this plan and mark the test requirements.

| Req | Requirement (from design) | Task |
| --- | --- | --- |
| R1 | Routes are scored by distinct provoked foes, not zone exits | 06 |
| R1-T | `hex.test.ts` and `battleEngine.test.ts` cases; the existing "routes around zones" test still passes; simulator before and after | 06 |
| R2 | `MoveEvent.facing` comment corrected; the screen turns the mover before each interrupting free attack | 05 |
| R2-T | Engine test for the repro; schedule test for the face cue | 05 |
| R3 | Board clicks only count when nothing interactive is under the pointer; the log box swallows clicks | 07 |
| R4 | Board and inventory scale down to fit, never up; the game is held at a minimum of 760×560 (changed from 480×360, see step 08's log entry) | 08 |
| R4-T | `boardGeometry.test.ts`; manual check at four sizes | 08, 09 |
| R5 | Hint text uses `ATTACK_AP_COST` | 01 |
| R6 | Starting facing is validated | 02 |
| R7 | `avgRounds` counts decided battles only; `summarize` is exported and tested | 03 |
| R9 | Battle-screen logic moved into Phaser-free tested modules: `eventSchedule.ts` and `boardGeometry.ts` | 04, 08 |
| V1 | `npm test` after every commit; each new test seen to fail first | all |
| V2 | Simulator, 2000 battles, seed 1, aggressive vs aggressive and random vs aggressive, before and after fix 1 | 06 |
| V3 | One browser pass at the end | 09 |

## Overall completion criteria

- Steps 01–09 are done, each fix is its own commit, and `npm test` passes on the final commit.
- The simulator comparison for fix 1 is recorded in step 06's evidence: win rates within noise, and free attacks per battle equal or lower.
- The browser pass in step 09 is recorded, with no regressions.

## Open questions and notes

1. **Fix 1 timing (your decision, not blocking).** The design leaves it to you whether to land fixes 1 and 2 now, since your upcoming movement work may affect them. It recommends landing both now. This plan follows that recommendation. If the upcoming work rewrites movement wholesale, skip step 06 but keep its test case: commit it as `it.skip` or carry it into the new work. Confirm before starting step 06.
2. **Correction to the design's fix 2 schedule test.** The design expects the face cue in a beat at 140 ms. In the repro, the first free attack lands at 0 ms and adds a 450 ms pause, then one 140 ms step follows. The cue and the second attack therefore land at **590 ms** (`OPPORTUNITY_PAUSE_MS + MOVE_STEP_MS`). I checked this against the current engine's event sequence. Steps 04 and 05 use 590 ms.
3. **Fix 2's repro needs speed ≥ 2.** The path is two steps, so a speed-1 mover with 1 AP can't reach the destination. With the test file's `WARRIOR_STATS` (speed 3, 3 AP) it works.

## For implementers

When you start a task, set its status in the table above to `in progress`. When you finish, set it to `done` and add a line under **Completion log** with the commit hash and the evidence the task asks for: test names, command output, or simulator numbers. If you're blocked, set the status to `blocked` and add the reason under **Open questions**.

## Completion log

- **01** (`4e8d421`): both attack hint strings in `refreshHighlights` built from `ATTACK_AP_COST`. `grep -n "2 AP" src/scenes/BattleScene.ts` shows only the move-highlight comment (line 64). `npm test`: tsc clean, 13 files / 105 tests passed. Visual check in the browser not done.
- **02** (`a682905`): constructor throws `<id> faces an unknown direction: <facing>` for facings outside 0–5 or non-integer. Extended `rejects bad rosters: ..., unknown facings` with facings 6, -1, 1.5; seen failing first (no throw), then passing. `npm test`: tsc clean, 13 files / 105 tests passed.
- **03** (`ec4eebc`): `summarize` counts rounds only for `battle_end` with a winner and divides by decided battles (0 if none); `avgRounds` doc comment updated. `summarize`, `Summary` and `LoggedEvent` exported; `main()` guarded by `import.meta.main`. New `scripts/simulate.test.ts` (`averages rounds over decided battles only`, `reports 0 average rounds when no battle was decided`) seen failing first (received ≈69.3 and 200), then passing. `npm test`: tsc clean, 14 files / 107 tests passed; `logs/battles.jsonl` untouched by the test run. `node scripts/simulate.ts --battles 50 --seed 1` still prints the summary table (avgRounds 5.74, 0 unresolved).
- **04** (`1e5f62b`): new `src/scenes/eventSchedule.ts` exports `Cue`, `Beat`, `EventTiming`, `scheduleEvents` (imports only engine types). `applyEvents` plays its beats via a new `playCues` (`show` → `showEvent`, `face` → `faceUnit`) and still returns `totalMs`. New `src/scenes/eventSchedule.test.ts` covers plain move, move split by a free attack, empty move struck at once, and non-opportunity attack / `end_turn`; seen failing first on the missing import, then passing. `npm test`: tsc clean, 15 files / 111 tests passed. Manual browser check not done.
- **05** (`59f24be`): `scheduleEvents` puts `face(mover, segment.facing)` ahead of the event after each `move` segment, in that event's beat; `showEvent`'s empty-segment `faceUnit` removed; `MoveEvent.facing` doc comment reworded (no logic or schema change). New engine test `judges a free attack mid-move against the mover turned towards its next step` (middle segment facing 4, second free attack `side`) passed straight away, as expected. New schedule test `turns the mover before each free attack that interrupts it` asserts beats at 0 ms `[show, face(3), show]` and 590 ms `[face(4), show]`; it and the two updated existing schedule tests were seen failing first, then passing. `npm test`: tsc clean, 15 files / 113 tests passed. Manual browser check not done (step 09).
- **06** (`3d16cb9`): landed now, as the design recommends (the user asked for step 6). `reachableHexes` takes `provokers: (from) => readonly string[]`; within a ring each hex keeps every route whose provoked set isn't a superset of another's (equal sets: first found wins), and answers with the smallest set, first found on a tie. `reachable()` passes `reactorsAt(...).map((u) => u.id)`. Tests: hex `breaks ties between shortest paths by the fewest provokers, ...` (rewritten), `prefers one provoker met three times over two provokers met once each`, and `keeps routes whose provokers cannot be compared until a later step decides` (the {x}/{y} case); engine `prefers walking past one foe several times to passing two foes once each` (the repro). The engine test failed first (`expected [ 'x', 'y' ] to have a length of 1`). The new hex tests failed `tsc` against the old API, and run through the old penalty search with the counts as penalties they picked the wrong routes. "Routes around zones" passes unchanged. `npm test`: tsc clean, 15 files / 116 tests passed.
  Simulator, 2000 battles, seed 1 (before → after):
  - aggressive vs aggressive: identical, 1022/978 wins, avgRounds 5.386, avgOpportunityAttacks 0 → 0. The AI never provokes here, so no route changed.
  - random vs aggressive: 0/2000 wins → 0/2000; avgRounds 3.54 → 3.5415; avgOpportunityAttacks 4.377 → 4.3835 (+0.0065, about 13 more free attacks over 2000 battles); side 4.064 → 4.0285, rear 1.5785 → 1.4925. The small rise in free attacks breaks the "equal or lower" expectation. For any given position the new route never provokes more distinct foes than the old one, so the rise has to come from battles diverging (different routes shift the dice and the random policy's later choices). I read it as noise, but it isn't proven.
- **07** (`c5b04e8`): the scene `pointerdown` listener calls `onBoardClick` only when Phaser's `currentlyOver` list is empty; `logBoxBg` is `setInteractive()` with no handler. Disabled buttons: Phaser's `InputManager.inputCandidate` drops input-disabled objects from the hit test, so a click on a greyed-out button would have reached the board. Chose to swallow it: `setButtonEnabled` no longer touches `bg.input.enabled`; it stores an `enabled` flag on the button container, which the `pointerdown` and hover handlers check, and switches the hand cursor off. Hidden buttons are still skipped (`inputCandidate` checks parent container visibility). No new automated test, per the design. `npm test`: tsc clean, 15 files / 116 tests passed. Manual check at 1000×500 not done (step 09).
- **08** (`a9dd4f0`): new Phaser-free `src/scenes/boardGeometry.ts` exports `Point`, `HEX_SIZE`, `FLOOR_SQUASH_Y`, `boardPixelSize(size)`, `boardHexCenter(h)` and `boardHexAt(screen, origin, scale)`. The scene's `boardPixelSize`/`hexCenter` are gone (callers use `boardHexCenter`), and `hexAt` delegates with `floorLayer.scale`. `layout()` now places the buttons and log box first. It then fits the board's drawn extent (board, plus 60 px of tallest sprite above the top row and 11 px of nameplate below the bottom row) into the area between `HEADER_BOTTOM` (64) and 12 px above the log, with 16 px each side, at `min(1, …)`, and centres it. All four layers get the same position and scale. `positionBanner` multiplies by the unit layer's scale. The inventory panel scales by `min(1, (w−32)/720, (h−32)/500)` and is centred. The 480×360 minimum is in comments in both `layout()`s. New `boardGeometry.test.ts` (round trip for every 8×5 hex at scales 1 and 0.6 with origin (37, 112); off-board points on all four sides; centre and size checks) failed first on the missing module, then passed. `npm test`: tsc clean, 16 files / 122 tests passed.
  Browser check (headless Chrome through Playwright against `vite`, game instance exposed by rewriting `main.ts` in flight): at 1440×900, 1000×500, 800×600 and 480×360, every sprite and nameplate is inside the free area. Board scale is 1, 0.829, 1 and 0.297. All 40 hex centres map back to themselves through `hexAt`. A real mouse click on a hex next to a foe moved the hero there (1000×500, 480×360). After ending the turn, the hit-chance labels sat on the goblin's and kobold's status rows. Inventory panel scale is 1, 0.936, 1 and 0.622, and fits. Hovering each interactive slot showed its tooltip centred over it. At 480×360 the board is tiny (scale 0.3) and nameplate text is not legible, though everything fits.
  Follow-up (`abc7818`), at the user's request: at 480×360 the board was legible only at scale 0.3, and text clipped (the hint line is 710 px; log lines don't wrap, and the longest possible one is about 1110 px). The user chose to wrap the log and set a minimum at which nothing clips. `main.ts` sets `scale.min` to `MIN_GAME_SIZE` = 760×560. Below that, the canvas holds its size and the page scrolls; `index.html` drops `overflow: hidden`, and `flex: none` on the canvas stops CSS from squeezing it, which had broken hit testing. At 760×560 the board and inventory fit at scale 1, so the step-08 scaling now only matters if the board grows. `ScrollingLog` wraps each line into rows through `setWrap` (the scene passes `logText.getWrappedText`, with the word-wrap width set in `layout()`). It scrolls by rows, holds a scrolled-back view as wrapped lines arrive, rewraps on resize, and drops whole lines from history. Four new `scrollingLog.test.ts` cases failed first, then passed. `npm test`: tsc clean, 16 files / 126 tests passed. Browser at 1440×900, 1000×500, 800×600, 760×560 and 480×360: the game is 1440×900, 1000×560, 800×600, 760×560 and 760×560; board scale is 1 at all sizes; the hint ends at x 730; the worst-case log line wraps onto two rows inside the box. At 480×360 with the page scrolled (120, 100), a mouse click on hex (1, 2) moved the hero there.
- **09** (no commit; no defects found, on `abc7818`): `npm test`: tsc clean, 16 files / 126 tests passed. Browser: headless Chrome through Playwright against `vite`. The game instance was exposed by rewriting `main.ts` in flight. All clicks, drags, wheel scrolls and hovers were real mouse input, at viewport coordinates allowing for page scroll.
  1. **Target picking at 1000×500** (game 1000×560, page scrolls): with both foes in reach (round 2), Attack turned targeting on. Two clicks on the log box, a scrollbar thumb drag, a track click and a wheel scroll all scrolled the log (where meant to) and left targeting, selection, positions and the engine log unchanged. Cancel and Attack toggled targeting, and a click on the kobold resolved the attack on it.
  2. **Move past both foes (1440×900)**: in natural play, 12 battles over up to 5 turns each never offered a route where the two free attacks come at different steps with the hero turned differently. One natural run had both attacks on the same step, and another had them on steps 5 and 6 facing the same way; both passed. So I staged the engine test's repro position in the live game (hero (1,1), goblin (0,0), kobold (0,2)) and clicked (-1,2). Events: move, attack, move, attack, move. At the moment each log line landed, the hero's arrow and sprite flip matched the facing the attack was judged against. For the kobold's front attack the hero faced west (3). For the goblin's attack it faced south-west (4), and the log reads "+1 from the side". The screenshot at the second attack shows the arrow pointing south-west.
  3. **Window sizes**: at 1440×900, 1000×500, 800×600, 760×560 and 480×360 (the 480×360 page scrolled to (120, 100)), the game is 1440×900, 1000×560, 800×600, 760×560 and 760×560, with board scale 1 at all sizes. Floor, sprites and nameplates sit between the header and the log box. The hint ends at x 730 and reads "(2 AP)". The worst-case log line wraps onto two rows inside the box. A real click on a hex next to a foe moved the hero there. After the enemy turn the hit-chance labels (60%, 55%) sat on the goblin's and kobold's nameplates. The inventory panel (I) fits at scale 1, and hovering each of the 3 slots showed its tooltip over that slot. The character tab (C) fits and has no tooltips by design.
  4. **Battle to the end** at 1440×900, twice (once natural, once from the staged position): Defeat both times. The banner spans y 130–183 and y 149–202, between the header (57) and the top of the units (256 and 294), and Back to Menu shows.
  Odd but not a defect: the routing rarely gives a natural move where two free attacks come with the mover turned between them, so check 2 needed the staged position.
