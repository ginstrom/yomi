# Step 02: World map drag-to-pan and Home

[Index](index.md) · [Design](../../designs/ui-feedback-drag-pan-cursor.md) section 4.2

## Objective
On the world map, pressing and dragging pans the view; a press released within the threshold is a click-to-move as today; Home recentres on the party. Covers R4, R5, R8.

## Requirements and context
- R4: dragging the map pans the view. R5: a press that becomes a drag never travels the party; a press released within `DRAG_THRESHOLD_PX` (6) still calls `onMapClick`. R8: **Home** clears any pan and recentres on the party.
- Current system: the whole map is `mapLayer`, positioned only by `follow()` = `mapOrigin(partyPoint, map, view)` (party mid-view, edges clamped to `view`, smaller-than-view axes centred). A scene-level `pointerdown` whose `over` list is empty calls `onMapClick`, which resolves `hexAt` (reads `mapLayer`'s position, so panned views resolve correctly) and calls `travel`. `pointermove` drives `setHovered` (route preview, `info` panel); `GAME_OUT` clears the hover. `follow()` runs on `layout()` and `arrive()`. `probe().origin` already exposes `mapLayer`'s position. WorldScene's keys are Esc (menu) and C (character panel); the debug console takes every key while open.

## Contracts produced (copy of the index; do not change)
In `src/scenes/mapScroll.ts` (`Point` from `./boardGeometry.ts`, `Rect` already there):
```ts
export const DRAG_THRESHOLD_PX = 6
export function pressMoved(press: Point, now: Point, threshold: number = DRAG_THRESHOLD_PX): boolean   // distance MORE than threshold
export function pannedOrigin(originAtPress: Point, press: Point, now: Point, map: { width: number; height: number }, view: Rect): Point  // originAtPress + (now - press), clamped, whole pixels
export function clampOrigin(origin: Point, map: { width: number; height: number }, view: Rect): Point  // same bounds as mapOrigin
```
`mapOrigin` keeps its signature and behaviour (refactor it to share the bounds code with `clampOrigin`). Step 03 imports `DRAG_THRESHOLD_PX` and `pressMoved`.

## Scope
- `src/scenes/mapScroll.ts` and `mapScroll.test.ts`: the three functions and constant above.
- `src/scenes/WorldScene.ts`: add `panOrigin: Point | null` (null = follow the party) and `applyOrigin()` (sets `mapLayer` to `panOrigin` clamped, else `mapOrigin(...)`); `follow()` becomes that. Gesture replacing the immediate click:
  1. `pointerdown` with an empty `over` list, inside `view`, not while `walking` or the outcome shade shows, records a press `{ x, y, originAtPress }`.
  2. `pointermove` with the button down: once `pressMoved`, the press becomes a pan: `panOrigin = pannedOrigin(...)`; the hover is cleared (no route, no info) and the cursor is `grabbing`; the cursor returns to normal on the next hover after release.
  3. `pointerup`: a press that never became a pan calls `onMapClick` with the press position (re-applying the walking/outcome-shade checks at release); a pan just ends, no click.
  4. `pointerupoutside` or `GAME_OUT` while pressed: a pan stays where it is; an unpanned press is dropped with no click.
  5. `arrive()` and the start of a new journey clear `panOrigin`; `layout()` (resize) re-clamps a pan rather than clearing it; camping, scouting and panel closes do not clear it.
  6. Bind `keydown-HOME` beside the `ESC`/`C` bindings: clears `panOrigin` and calls `follow()`. It does nothing while `walking`, while the outcome shade shows, or when no pan is active. It moves no party and passes no time. Do not use Space/Enter (the Story overlay uses them).
- Exclusions: no inertia, touch or zoom; no change to `worldMap.ts` rules or `routeTo`; no on-screen hint for Home (documented in the manual in step 04).

## Verification
- Domain, `mapScroll.test.ts` (write first): `pressMoved` false at 5 px and true at 7 px; `pannedOrigin` shifts by the delta and clamps at each map edge; a map smaller than the view on an axis stays centred; `clampOrigin` of a mid-map origin is unchanged and of an out-of-range one is clamped; `mapOrigin` results unchanged; recentring (`mapOrigin` of the party) discards the pan.
- Browser (`e2e/world.test.ts`, using `driver.ts` press/move/letGo and `probe()`):
  - Press at a map point and move 40 px: `probe().origin` shifts by that delta (clamped), `world.party` and `turn` unchanged.
  - Press-release with no movement still travels.
  - After a journey `origin` follows the party again.
  - After a pan, `page.keyboard.press('Home')`: `origin` equals its value before the pan, `world.party` and `turn` unchanged; Home with no pan or while walking changes nothing.
  - A click on a panned view travels to the hex under the pointer (hexAt on a panned layer).
- `npm test` and `npm run test:browser` pass.

## Completion criteria
- [ ] Contracts above exist exactly as written; tests seen failing first.
- [ ] R4, R5, R8 behaviours verified by the browser cases above.
- [ ] One commit; index status and hash updated.

## Execution record
