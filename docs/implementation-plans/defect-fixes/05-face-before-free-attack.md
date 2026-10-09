# Step 05: Show the mover's turn before each free attack (fix 2)

[Index](index.md) · Source design: "Yomi Defect Fixes" canvas, board *Fixes 1–2: movement*, <https://claude.ai/artifact/3PhMw4zJFeGPdZn6V6G5Bp>

## Objective

When a free attack interrupts a move, the screen shows the mover already turned the way the engine judged the attack against, so the facing arrow never contradicts the logged arc. The engine's behaviour doesn't change; only its doc comment is corrected.

## Requirements and context

- **The bug.** Before each step, the engine turns the mover towards that step, then records the movement so far if a free attack follows. So when a free attack interrupts a move, the recorded `MoveEvent.facing` points at the *next* step, and that is the facing the attack's arc is judged against. That is correct. But the doc comment says "towards its last step", and the screen applies `event.facing` only when the segment is empty (`showEvent`). So at a second interruption, the sprite and arrow still face the last step.
- **Repro (confirmed against commit `f3d2684`).** A 6×4 board. The mover is at `(1,1)` with speed ≥ 2. Goblins are at `(0,0)` and `(0,2)`. The mover moves to `(-1,2)` by way of `(0,1)`. The engine logs:
  1. `move` with path `[]` and facing 3 (west)
  2. a free `attack` by the goblin at `(0,2)`, arc `front`
  3. `move` with path `[(0,1)]` and facing **4** (south-west)
  4. a free `attack` by the goblin at `(0,0)`, arc **`side`**
  5. `move` with path `[(-1,2)]` and facing 4

  On screen, at event 4 the mover still faces west (3), so the arrow puts that goblin in its front arc.
- **R2, engine.** Behaviour is unchanged. Reword the `MoveEvent.facing` doc comment to: "The mover's facing when the segment ends. If a free attack interrupts the move here, this is turned towards the step about to be taken, which is the facing the attack is judged against. Otherwise it is towards the last step." The event shape doesn't change, so `LOG_SCHEMA_VERSION` stays 7.
- **R2, screen.** When a move segment finishes and another event follows it in the same action, `scheduleEvents` puts a `face` cue for the mover, carrying that segment's `facing`, into the *same beat as the next event, ahead of its `show` cue*. The turn and the free attack then run in one callback, in order, with no race between the end of the walking tween and a separate timer. This applies to empty segments too. It replaces the special case in `showEvent`.
- `animateMove` keeps turning the sprite for each step while it walks.
- **Timing note.** The design says this beat is at 140 ms. That's a design error. The first free attack adds a 450 ms pause before the one-step segment, so the beat is at **590 ms** (`OPPORTUNITY_PAUSE_MS + MOVE_STEP_MS`). Assert 590.
- Shared constraints: write the tests first and see them fail. One commit. Battle outcomes and the log format are unchanged.

## Dependencies

- **Step 04 (required).** `src/scenes/eventSchedule.ts` exports:
  ```ts
  export type Cue = { kind: 'show'; event: BattleEvent } | { kind: 'face'; unit: UnitId; facing: number }
  export interface Beat { at: number; cues: Cue[] }
  export interface EventTiming { moveStepMs: number; opportunityPauseMs: number }
  export function scheduleEvents(events: readonly BattleEvent[], timing: EventTiming): { beats: Beat[]; totalMs: number }
  ```
  `scheduleEvents` currently emits only `show` cues. Consecutive events at the same time share a beat. `BattleScene.applyEvents` plays beats and already handles `face` cues by calling `faceUnit(unit, facing)`. If step 04 isn't done, do it first.

## Scope

- `src/scenes/eventSchedule.ts`: emit the `face` cue as described. The rule: for each `move` event followed by another event in the same list, put `{ kind: 'face', unit: move.unit, facing: move.facing }` at the front of the next event's cues, in that event's beat. A final segment with nothing after it needs no cue, because `syncUnitsFromEngine` faces every unit at `totalMs`.
- `src/scenes/BattleScene.ts` (inspected), `showEvent`, around lines 649–669: remove `if (event.path.length === 0) this.faceUnit(event.unit, event.facing)` and its comment. The empty-segment case is now covered by the face cue.
- `src/engine/battleEngine.ts` (inspected), the `MoveEvent.facing` doc comment, around line 143: reword it as above. Don't change the logic in `move()`.

## Verification

- `src/engine/battleEngine.test.ts`, a new test in the `BattleEngine facing` describe. Build the repro with the file's helpers, for example `{ ...WARRIOR, position: hex(1, 1) }` plus two `GOBLIN`-based units at `(0,0)` and `(0,2)` on a `{ cols: 6, rows: 4 }` board. Use a fumble RNG (`rng: sequence([FUMBLE])`) so nobody falls. Assert that the middle `move` event (path `[(0,1)]`) has `facing` 4 and the second free attack has `arc: 'side'`. This test documents existing behaviour, so it passes straight away.
- `src/scenes/eventSchedule.test.ts`: for the same events, there is a beat at 590 ms whose cues are exactly `[face(mover, 4), show(the second attack)]`, in that order. There is also a beat at 0 ms with `[show(empty move), face(mover, 3), show(first attack)]`. This test fails before the change.
- `npm test` passes.
- Manual check, also covered by step 09: move the hero past both enemies and watch it turn before the second free attack lands.

## Completion criteria

- [ ] `MoveEvent.facing` comment reworded. No engine logic or schema change.
- [ ] `scheduleEvents` emits face cues ahead of the following event. `showEvent`'s special case is removed.
- [ ] Engine and schedule tests added. The schedule test was seen failing first. `npm test` passes.
- [ ] One commit for fix 2.
- [ ] Index status set to `done`, with the commit hash in the completion log.
