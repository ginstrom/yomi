# Overlay frame scaling above 1

Status: ready for planning (the questions at the end have recommended answers; none blocks).

## Purpose

Overlay frames (fixed-size panels drawn over the map or menu) shrink to fit a small window but never grow: each scene computes `Math.max(0, Math.min(1, ...))`. On a 1920x1080 or 2560x1440 window a 720x500 panel is a small island and the encampment's 96 px buildings (48 px sprite at `BUILDING_SCALE` 2) stay 96 px. Let the frame grow on large windows, in whole steps so the pixel art stays crisp. No change to play.

## Current system (inspected)

Eight scenes copy the same line, each with its own constants (`src/scenes/*Scene.ts`):

| Scene | Frame | Line |
| --- | --- | --- |
| Encampment | 720x500 | `layout()` ~329 |
| Guild hall | 720x500 | ~352 |
| Crafting | 720x500 | ~526 |
| Exchange | 720x580 | ~254 |
| Trading post | 720x520 | ~430 |
| Party | 720x500 | ~359 |
| Creation | 720x500 | ~536 |
| Inventory | 720x500, in the space right of the party column (`free = width - PARTY_PANEL_W`) | ~1409 |

Each places `frame.setScale(scale).setPosition(centred)`. Contents are children of one container, so text, sprites, rectangles and hit zones scale together. Probes already multiply by `frame.scale` (`onScreen`, `box`), so e2e clicks follow. `main.ts` sets `pixelArt: true` (nearest-neighbour) and `RESIZE` mode with a minimum of 840x560.

Not in scope: `MenuScene.setScale(Math.min(1, ...))` and `panelButton.ts` (text shrink-to-fit of one label), the battle and world boards (own zoom/layout, not frames), `BattleScene`'s `Math.min(1, t)`.

Fit today at the e2e and manual viewport (1280x800): the limit is height, (800-32)/500 = 1.54, so a fractional scale would blur. At 1920x1080: min(2.62, 2.10) = 2.10. At 2560x1440: min(3.5, 2.82) = 2.82. Inventory at 1920x1080: free 1840, min(2.5, 2.10).

## Requirements

- R1. One Phaser-free helper decides an overlay's scale from the free space and the frame size; the eight scenes call it instead of repeating the formula.
- R2. Below the fit-to-window limit the result is what it is today: fractional, down to 0 (unchanged for small windows).
- R3. Above 1 the scale steps in whole numbers: `floor(fit)` when `fit >= 2`, else 1. Never above `fit` (16 px clear on each side kept), never a fraction above 1.
- R4. Everything in the frame scales together (text, sprites, hit areas, tooltips, drag), as now. Nothing is resized separately.
- R5. At 1280x800 and 840x560 every frame is exactly as today (scale 1 or less), so the manual's screenshots do not change.
- R6. No effect on rules, saves, log schema, balance or assets.

## Design

New `src/scenes/overlayScale.ts` (proposed, Phaser-free):

```ts
/** Scale for a frame of frameW x frameH in a free area: fractional below 1, whole steps above. */
export function overlayScale(freeW: number, freeH: number, frameW: number, frameH: number, margin = 32): number {
  const fit = Math.max(0, Math.min((freeW - margin) / frameW, (freeH - margin) / frameH))
  return fit >= 2 ? Math.floor(fit) : Math.min(1, fit)
}
```

Each scene: `const scale = overlayScale(width, height, FRAME_W, FRAME_H)` (Inventory passes `free`). Centring is unchanged. Encampment's `BUILDING_SIZE` stays a frame-local 96; it appears 192 px at scale 2 (the sprite is drawn at an even `BUILDING_SCALE` 2, times an integer, so pixels remain square).

Results: 1280x800 -> 1; 1920x1080 -> 2; 2560x1440 -> 2 (height-limited, 2.8; 3 would need 1532 px of height); 3840x2160 -> 4. Taller frames step later: at 1920x1080 Exchange (580) fits 1.81 so stays 1, Trading post (520) fits 2.02 so becomes 2. Accepted: one rule for all, though two frames of the same window may then differ in scale.

Text: Phaser text is rasterised at 1x, then scaled by the container. With `pixelArt: true` that makes 2x text blocky but legible, not blurred. If it reads poorly, a follow-up could set the text `resolution` to the integer scale; out of scope here (see Q2).

Documentation: change the "scaled down (never up)" comments and the `src/scenes/CLAUDE.md` Layout line / `docs/reference/scenes.md` where they say frames only shrink. Add `overlayScale.ts` to the helper list.

## Consequences

- Play, saves (`SAVE_VERSION`), events (`LOG_SCHEMA_VERSION`), balance: none.
- Assets: none; no new sprites.
- Manual: no text or screenshot changes (shots are taken at 1280x800 where the scale is 1). Add one sentence only if the manual describes window size (it does not mention viewports today).
- Risk: a window between steps leaves large margins (e.g. 1.9 fit shown at 1). Accepted for crisp art.

## Verification

- Domain (Node): `src/scenes/overlayScale.test.ts`: small windows give fractional fit and 0 for a window below the margin; 1280x800 -> 1 for 720x500; fit 1.99 -> 1; fit exactly 2 -> 2; 1920x1080 -> 2; 2560x1440 -> 2; 3840x2160 -> 4; never exceeds fit; Inventory case with `free` = width - 80.
- Scene smoke (jsdom): the existing `*Scene.test.ts` still pass (jsdom size is below 2x).
- e2e (`e2e/`, run after a scene change): one test using the driver's `resize` (`e2e/driver.ts`) to 1920x1080 on the encampment: the probe's `building` box is 192 px wide (96 x 2), and clicking a building and a button through the probe still works; resize back to 1280x800 gives 96. Also open the inventory at 1920x1080 and drag an item (hit areas follow the scale).
- Screenshots: look at the encampment, inventory and creation at 1920x1080 by hand (or the browser skill) for clipping and tooltip placement; none are saved to the manual.

## Open questions and assumptions

- Q1. Whole steps only above 1, or fractional (so 1280x800 would become 1.54)? Recommend whole steps: crisp pixel art, and it keeps the manual's shots and the e2e coordinates unchanged. Assumed.
- Q2. Should text be re-rasterised at the integer scale for sharpness? Recommend no, defer; judge from the 1920x1080 look.
- Q3. Cap the scale (for example at 3)? Recommend no cap: the window-fit limit already bounds it.
- Assumption: all eight frame scenes above want the same rule, including Inventory beside the party column; the party column (`PARTY_PANEL_W` 80) does not scale.
- Assumption: Phaser's `RESIZE` mode reports CSS pixels; device pixel ratio is not taken into account.
