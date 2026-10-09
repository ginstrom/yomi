# Step 09: Final browser pass

[Index](index.md) · Source design: "Yomi Defect Fixes" canvas, board *Fixes 6, 7, 9*, section "Verification", <https://claude.ai/artifact/3PhMw4zJFeGPdZn6V6G5Bp>

## Objective

Once all the fixes have landed, do one manual pass in the browser to confirm that the screen-facing fixes (2, 3 and 4) work together and nothing has regressed. This step changes no code unless it finds a defect.

## Requirements and context

- V3: one browser pass at the end, covering:
  - the window sizes from fix 4
  - target picking at a short window height (fix 3)
  - a move past both enemies, to watch the mover turn before the second free attack (fix 2)
- What each fix should look like:
  - **Fix 2:** when a free attack interrupts a move, the mover's sprite and facing arrow are already turned towards its next step when the attack lands. The arc in the log ("side" or "rear") matches what the arrow shows.
  - **Fix 3:** clicks on the Attack, End Turn and Back to Menu buttons, the log box, and the log scrollbar never select, move or cancel on the board.
  - **Fix 4:** at 1440×900, 1000×500, 800×600, 760×560 and 480×360, the board and inventory panel fit without clipping (below 760×560 the game holds that size and the page scrolls; long log lines wrap), and hex clicks and slot tooltips land on the right things. The board is never drawn larger than its natural size.
  - **Fix 5:** the hints still read "(2 AP)".
- Shared constraints: if you find a defect, fix it in a separate commit against the step it belongs to, note it in the index, and re-run `npm test`.

## Dependencies

- Steps 05, 07 and 08 must be done. Step 06 should be done too, since routes may differ after fix 1. If step 06 was deliberately skipped (see the index's open questions), go ahead without it and say so.
- Environment: `npm run dev` (Vite dev server), or `make run` (podman, http://localhost:5173). Resize the browser window to each size, for example with the browser's responsive design mode.

## Verification (the task itself)

1. `npm test` passes on the final commit.
2. At 1000×500: select the hero with two foes in reach, press Attack, and check that targeting mode stays on. Click a target and check that the attack resolves. Scroll the log with its scrollbar and check that the board doesn't react.
3. Move the hero past both enemies so that two free attacks interrupt the move, for example along the enemies' line where both zones are left. Watch the hero turn before the second attack. Check that its arrow agrees with the arc in the log line.
4. Go through the four window sizes, checking the board, the hit-chance labels, and the inventory panel (I) and character tab (C) with tooltips.
5. Play one battle to the end at the default size, and check that the Victory or Defeat banner sits above the units, not over them.

## Completion criteria

- [x] All five checks pass, or any defect found has its own fix commit.
- [x] Results recorded in the index's completion log: sizes checked, browser used, and anything odd.
- [x] Index status set to `done`.
