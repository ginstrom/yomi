# Step 04: Event schedule module (fix 9, part 1)

[Index](index.md) · Source design: "Yomi Defect Fixes" canvas, boards *Fixes 6, 7, 9* (fix 9) and *Fixes 1–2* (the `Cue`/`Beat` contract), <https://claude.ai/artifact/3PhMw4zJFeGPdZn6V6G5Bp>

## Objective

Move the battle screen's event timing out of `BattleScene.applyEvents` into a Phaser-free module, `src/scenes/eventSchedule.ts`, with tests. `applyEvents` then just plays the beats the module returns. This step changes no behaviour. Step 05 (fix 2) builds on it.

## Requirements and context

- R9: the battle screen's only test checks that the scene is registered. Rather than drive Phaser from tests, move the logic that can go wrong into Phaser-free modules beside `scrollingLog.ts`, and test those. Click routing, target picking and button state stay in the scene and are checked by hand.
- Timing rules (from today's `applyEvents`): events play in log order, starting at 0 ms. After a `move` event, the clock advances by `path.length × moveStepMs` (140 ms). After an `attack` event with `opportunity: true`, it advances by `opportunityPauseMs` (450 ms). Other events take no time.
- Contract. Step 05 consumes this exact API, so define it now:

  ```ts
  export type Cue =
    | { kind: 'show'; event: BattleEvent }
    | { kind: 'face'; unit: UnitId; facing: number }

  /** Cues that fire together, `at` ms after the action. */
  export interface Beat { at: number; cues: Cue[] }

  export interface EventTiming { moveStepMs: number; opportunityPauseMs: number }

  export function scheduleEvents(
    events: readonly BattleEvent[],
    timing: EventTiming,
  ): { beats: Beat[]; totalMs: number }
  ```
  - In this step, only `show` cues are produced, one per event, in log order. The `face` variant is declared now and first emitted in step 05.
  - Consecutive events at the same `at` share one beat, with their cues in log order. Beats are in increasing `at` order.
  - `totalMs` is the clock after the last event. It's the value `applyEvents` returns today.
- Shared constraints: Phaser-free (import only types from `../engine/battleEngine.ts`). Tests run in the Node `domain` vitest project. Write the tests first. One commit. No visible change in the game.

## Dependencies

- Step 01 also edits `BattleScene.ts`. Commit after it to avoid conflicts. Nothing else is needed.

## Scope

- `src/scenes/eventSchedule.ts` (new): `scheduleEvents` and the types above.
- `src/scenes/eventSchedule.test.ts` (new). It is matched by `src/**/*.test.ts` and isn't a `*Scene.test.ts`, so it runs in Node. Build events by hand, or by running a small `BattleEngine` battle and using its returned events. Cover:
  1. A plain move (one `move` event with N steps): one beat at 0 holding `show(move)`, with `totalMs = N × 140`.
  2. A move split by a free attack: `move(k steps)`, `attack(opportunity)`, `move(m steps)`. The attack's beat lands at `k × 140`, where the walk pauses. The second move segment's beat is at `k × 140 + 450`, and `totalMs = (k + m) × 140 + 450`.
  3. A move struck before its first step: an empty `move`, then `attack(opportunity)`. Both cues share the beat at 0, move first.
  4. A non-opportunity attack and `end_turn` advance nothing.
- `src/scenes/BattleScene.ts` (inspected), `applyEvents(events)` at around lines 634–647:
  - Replace the inline timing loop with `scheduleEvents(events, { moveStepMs: MOVE_STEP_MS, opportunityPauseMs: OPPORTUNITY_PAUSE_MS })`. Keep the constants in the scene, or move them; that's your choice.
  - For each beat: if `at === 0`, run its cues immediately, otherwise in `this.time.delayedCall(at, ...)`. A `show` cue calls `this.showEvent(event)`. Handle a `face` cue as `this.faceUnit(unit, facing)` now, so step 05 only has to emit it.
  - Keep the rest as it is: `refreshAllApPips()` right away, `syncUnitsFromEngine()` at `totalMs` (immediately if 0), and return `totalMs`. Callers (`playerAct`, `runEnemyAction`, `create`) rely on the return value.
  - Leave `showEvent`'s special case `if (event.path.length === 0) this.faceUnit(...)` in place. Step 05 replaces it.

## Verification

- `npm test`: the new tests pass. Write them before the module exists, so they first fail on the missing import.
- Manual check with `npm run dev` or `make run`: play a turn that provokes a free attack. Walking, the pause and the log lines look the same as before.

## Completion criteria

- [x] `scenes/eventSchedule.ts` exports `Cue`, `Beat`, `EventTiming` and `scheduleEvents` as specified, and is Phaser-free.
- [x] `applyEvents` plays beats from `scheduleEvents`, and its return value is unchanged.
- [x] `eventSchedule.test.ts` covers the four cases. `npm test` passes.
- [x] One commit (fix 9, schedule helper).
- [x] Index status set to `done`, with the commit hash in the completion log.
