# Step 07: Board clicks only on the board (fix 3)

[Index](index.md) · Source design: "Yomi Defect Fixes" canvas, board *Fixes 3–5: battle screen*, <https://claude.ai/artifact/3PhMw4zJFeGPdZn6V6G5Bp>

## Objective

Clicks on the battle screen's buttons, log box or log scrollbar no longer count as board clicks.

## Requirements and context

- **The bug.** The scene-wide `pointerdown` listener calls `onBoardClick` on every click, including clicks on buttons and the log scrollbar. On windows shorter than about 560 px, the board overlaps the log and the buttons. Pressing Attack with two foes in reach starts target picking, and the same click then cancels it or picks the hex under the button. Clicking the scrollbar can move the selected unit.
- **R3, design.** Phaser passes the interactive objects under the pointer as the listener's second argument (`currentlyOver`, per `node_modules/phaser/src/input/events/POINTER_DOWN_EVENT.js`). If anything interactive is under the pointer, the click isn't a board click:
  ```ts
  this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
    if (over.length === 0) this.onBoardClick(pointer)
  })
  ```
  - Make `logBoxBg` interactive, with no handler, so a click on the log is swallowed too.
  - The buttons' background rectangles (`createButton`) and the scrollbar's track and thumb are already interactive. Units, nameplates and labels aren't, so clicks on the board still get through. Keep it that way.
- Shared constraints: one commit. The design specifies no automated test, because click routing stays in the scene and is checked by hand. Battle outcomes and the log format are unchanged.

## Dependencies

- None functionally. Steps 01 and 04 also edit `BattleScene.ts`, so commit after them. Step 08 follows this step in the same file.

## Scope

- `src/scenes/BattleScene.ts` (inspected):
  - `create()`, around line 200: `this.input.on('pointerdown', (pointer) => this.onBoardClick(pointer))`. Replace it with the guarded form above.
  - `create()`, around lines 167–170: `this.logBoxBg = this.add.rectangle(...)`. Add `.setInteractive()`. Check that the wheel scrolling in `onLogWheel`, which tests bounds itself, and the scrollbar track and thumb still work. They sit above `logBoxBg` in the display list, so they still receive their own `pointerdown` and `drag`.
  - Disabled buttons: `setButtonEnabled` sets `bg.input.enabled = false`. Phaser may leave disabled objects out of `currentlyOver`, which would let a click on a greyed-out button fall through to the board. The design doesn't cover this. Check it by hand. If it's a problem, prefer swallowing the click (for example, leave input enabled and ignore the click in the button's handler) over letting it reach the board, and record what you chose.

## Verification

- `npm test` passes (`tsc` and the existing `BattleScene.test.ts` registration test).
- Manual check, at a window size of 1000×500 (`npm run dev` or `make run`, resize the browser window):
  1. With two foes in reach, press Attack. Target picking starts and stays active; the press doesn't cancel it or pick a hex.
  2. Click a target. The attack happens.
  3. With the log long enough to show a scrollbar, click the track and drag the thumb where it lies over the board. The log scrolls and the selected unit doesn't move.
  4. Clicking an empty board hex or a unit still works as before.

## Completion criteria

- [ ] `onBoardClick` runs only when nothing interactive is under the pointer. `logBoxBg` is interactive.
- [ ] The manual checks at 1000×500 pass, recorded in the completion log.
- [ ] `npm test` passes. One commit for fix 3.
- [ ] Index status set to `done`, with the commit hash in the completion log.
