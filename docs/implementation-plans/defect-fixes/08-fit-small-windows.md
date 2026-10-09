# Step 08: Fit small windows (fix 4, with fix 9 part 2)

[Index](index.md) · Source design: "Yomi Defect Fixes" canvas, boards *Fixes 3–5: battle screen* (fix 4) and *Fixes 6, 7, 9* (fix 9), <https://claude.ai/artifact/3PhMw4zJFeGPdZn6V6G5Bp>

## Objective

The battle board and the inventory panel scale down to fit small windows instead of clipping. The board's pixel sums move into a tested, Phaser-free `src/scenes/boardGeometry.ts`.

## Requirements and context

- **The problem.** The board is drawn at a fixed size: about 590 px wide for the 8×5 board (`√3 × 40 × 8.5`), plus the sprites above it. The inventory panel is a fixed 720×500 (`PANEL_W`, `PANEL_H`). Nothing scales down, so narrow or short windows clip both. The game runs in `Phaser.Scale.RESIZE` mode at 100% × 100% (`src/main.ts`).
- **R4, battle.** `layout()` works out the free space between the header and the top of the log box (with a 12 px gap above the log box), less 16 px on each side. The board's scale is `min(1, freeW / boardW, freeH / (boardH + tallest sprite))`.
  - It never scales up, which keeps the pixel art crisp.
  - Apply the scale to the floor, unit, plate and label layers together, and centre the board in the free space.
  - The tallest sprite is the largest `APPEARANCE[kind].displayHeight` (84 px, the warrior). Nameplates hang about 35 px below a unit's feet (`PLATE_STATUS_Y` = 27, plus the label). Allow for that on the bottom row if it would otherwise overlap the log; this is your call.
  - `positionBanner` measures sprite tops in `unitLayer` coordinates. Make sure it accounts for the scale.
- **R4/R9, geometry module.** `hexAt` divides local coordinates by the scale. The sums move into a Phaser-free `scenes/boardGeometry.ts`, alongside `hexCenter`, so they can be tested. The design's contract:
  ```ts
  /** Board pixels and the hex under a screen point, for a board drawn at `origin` and `scale`. */
  export function boardHexAt(screen: Point, origin: Point, scale: number): Hex
  export function boardHexCenter(h: Hex): Point
  ```
  - `Point` is `{ x: number; y: number }`. `boardHexCenter` returns board-local, unscaled pixels relative to the board's top-left corner, as the scene's `hexCenter` does today. `boardHexAt` returns the hex under the point even when it's off the board; the scene then checks `board.contains`.
  - Move the board pixel size (today `boardPixelSize()`) and the constants it needs (`HEX_SIZE` = 40, `FLOOR_SQUASH_Y` = 0.6) into the module too, for example `boardPixelSize(size: BoardSize)`. That's your choice. `hexPolygon` can stay in the scene, since it builds Phaser `Vector2`s, but should use `boardHexCenter`.
- **R4, inventory.** `panel.setScale(min(1, (w − 32) / PANEL_W, (h − 32) / PANEL_H))`, centred on its scaled size. Phaser's hit testing follows container scale, so the slots and tooltips keep working. Tooltips are children of `inventoryContent` inside `panel`, so they scale with it.
- **Minimum supported window: 480×360.** Below that the screen may clip. Document this in a comment in the layout code.
- Click routing, target picking and button state stay in the scene (R9).
- Shared constraints: write the geometry tests first and see them fail. One commit. Battle outcomes and the log format are unchanged. The new module must be Phaser-free so its test runs in the Node `domain` vitest project.

## Dependencies

- Step 07 (fix 3) edits `create()` and the `pointerdown` handler in the same file. Do it first. Its guard makes clicks on the log or buttons never reach `onBoardClick`, which matters more once the board can sit close to them.
- No new interfaces are needed from earlier steps. Existing code: `pixelToHex`, `hexToPixel`, `HexBoard` and `BoardSize` in `src/grid/hex.ts`.

## Scope

- `src/scenes/boardGeometry.ts` (new) and `src/scenes/boardGeometry.test.ts` (new).
- `src/scenes/BattleScene.ts` (inspected):
  - The "board geometry" section, around lines 265–294: `boardPixelSize()`, `hexCenter()`, `hexAt()` and `hexPolygon()`. Delegate to the module. `hexAt(screenX, screenY)` becomes `boardHexAt({x, y}, {x: floorLayer.x, y: floorLayer.y}, scale)`, followed by the `board.contains` check.
  - `layout()`, around lines 390–420: today `floorX = (width − board.width) / 2` and `floorY = max(90, (height − board.height) / 2 − 20)`. The log box is laid out after the board, from `buttonY = height − 50`. Reorder so the log box top is known first, then compute the free area and scale, then `setScale` and position the four layers. Don't move the header (`roundText` at y 16, `hintText` at y 44) or the log box.
  - Every caller of `hexCenter` (unit placement, tweens in `animateMove`, hit-chance labels) works in layer-local coordinates, so it keeps working once the layers are scaled.
- `src/scenes/InventoryScene.ts` (inspected), `layout()`, around lines 344–349: today `panel.setPosition((width − PANEL_W) / 2, (height − PANEL_H) / 2)`. Add the scale and centre on `PANEL_W × s` by `PANEL_H × s`.

## Verification

- `src/scenes/boardGeometry.test.ts`:
  - For every hex on an 8×5 `HexBoard` (the size of the `goblinRaid` board in `src/game/encounters.ts`), `boardHexAt(origin + boardHexCenter(h) × scale, origin, scale)` returns `h` at scale 1 and at scale 0.6, with a non-zero origin.
  - Points off the board, for example left of the first column or below the last row, return a hex for which `new HexBoard({cols: 8, rows: 5}).contains(...)` is false.
- `npm test` passes.
- Manual check at 1440×900, 1000×500, 800×600 and 480×360 (`npm run dev` or `make run`, resize the browser window). At each size, check that:
  - The whole board and every unit sprite are visible.
  - Clicking a hex selects or moves to the hex under the cursor.
  - The hit-chance labels sit on the right foes.
  - The inventory panel (press I) and the character tab (press C) fit, and slot hover tooltips appear over the right slot.
  - At 1440×900 the board is drawn at scale 1, as before.

## Completion criteria

- [ ] `scenes/boardGeometry.ts` exists, is Phaser-free, and is tested at scales 1 and 0.6.
- [ ] The battle board scales down (never up) and is centred in the free area. The inventory panel scales and centres.
- [ ] The 480×360 minimum is documented in the layout code.
- [ ] Manual checks at the four sizes pass, recorded in the completion log.
- [ ] `npm test` passes. One commit for fix 4.
- [ ] Index status set to `done`, with the commit hash in the completion log.
