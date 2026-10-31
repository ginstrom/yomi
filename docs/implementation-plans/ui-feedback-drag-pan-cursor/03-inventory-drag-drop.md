# Step 03: Inventory drag and drop

[Index](index.md) · [Design](../../designs/ui-feedback-drag-pan-cursor.md) section 4.1

## Objective
In the inventory panel the player can drag an item between backpack, equipment slots and the ground/baggage grid. Covers R1, R2, R3.

## Requirements and context
- R1 drag moves per the table below. R2: click, right-click and Ctrl+click do exactly what they do today; a press moving less than `DRAG_THRESHOLD_PX` is a click. R3: a drop on something that cannot take the item changes nothing.
- Current: everything is click-driven and acts on `pointerdown` in `src/scenes/InventoryScene.ts`, through `changeGear(change)`, which refuses when `gearApCost === null` (not the unit's turn), plays the click sound and rebuilds the panel next tick (the redraw destroys the slot whose handler ran). Equipment slot (`createSlot`): click `unequipToBackpack(character, slot)`, right-/Ctrl+click `dropEquipped`; a two-hander shows ghosted in the off-hand slot and acts as `mainHand`. Backpack space (`buildBackpack`): click `equipFromBackpack(character, i, ground)`, right-click `dropFromBackpack`. Ground grid (`buildGround`): click `pickUp(character, ground, index)`. On the world map the "ground" is the party's baggage (`gearApCost: 0`). Slots are interactive rectangles in a scaled `panel` container; `probe()` reports slot centres. Every item has one fixed `Item.slot` (rings aside: `item.ring` fits either ring slot).
- Rules in `src/character/character.ts`: `equipFromBackpack`, `unequipToBackpack` (first empty space; false when full), `dropFromBackpack`, `dropEquipped`, `pickUp`.

### Drop table (drag is only on the Inventory tab, primary button, a slot holding an item, and `gearApCost !== null`)
| From | To | Result |
| --- | --- | --- |
| Backpack space | its equipment slot (a ring: either ring slot) | equip into that slot, swapping with what is there; two-hander/off-hand rule as `equipFromBackpack` |
| Backpack space | ground/baggage grid (anywhere) | `dropFromBackpack` |
| Equipment slot (ghost off-hand counts as `mainHand`) | backpack grid (anywhere) | `unequipToBackpack` (refused when full) |
| Equipment slot | ground/baggage grid | `dropEquipped` |
| Ground/baggage item | backpack grid (anywhere) | `pickUp` |
| Ground/baggage item | its equipment slot | `pickUp` then equip into that slot; refused with nothing changed when the backpack is full |

Anything else (wrong slot, same place, outside any target, a refused change) is a no-op.

## Contracts consumed / produced
Consumed from step 02 (`src/scenes/mapScroll.ts`; if step 02 is not yet merged, these are exactly): `export const DRAG_THRESHOLD_PX = 6` and `export function pressMoved(press: Point, now: Point, threshold: number = DRAG_THRESHOLD_PX): boolean` (true when the distance is MORE than the threshold). `Point` is from `src/scenes/boardGeometry.ts`.

Produced:
```ts
// src/character/character.ts
export function equipFromBackpack(character: Character, index: number, ground: Item[], slot?: EquipmentSlot): boolean
// Without slot: identical to today. With slot: the item must fit (slot === item.slot, or slot is a ring slot and item.ring), else return false and change nothing; the swap and two-hander logic use that slot in place of the computed one.

// src/scenes/gearDrag.ts (Phaser-free; imports only character.ts and inventory types)
export type DragSource = { kind: 'equipment'; slot: EquipmentSlot } | { kind: 'backpack'; index: number } | { kind: 'ground'; index: number }
export type DropTarget = { kind: 'equipment'; slot: EquipmentSlot } | { kind: 'backpack' } | { kind: 'ground' }
export type GearMove =
  | { kind: 'equip'; index: number; slot: EquipmentSlot } | { kind: 'unequip'; slot: EquipmentSlot }
  | { kind: 'dropBackpack'; index: number } | { kind: 'dropEquipped'; slot: EquipmentSlot }
  | { kind: 'pickUp'; index: number } | { kind: 'pickUpEquip'; index: number; slot: EquipmentSlot }
export function planDrag(character: Character, ground: Item[], from: DragSource, to: DropTarget): GearMove | null
export function validTargets(character: Character, ground: Item[], from: DragSource): DropTarget[]
export function applyMove(character: Character, ground: Item[], move: GearMove): boolean   // all-or-nothing
```
`planDrag` returns null for wrong slot, same place, a source slot with no item, `pickUpEquip`/`unequip`/`pickUp` when the backpack has no empty space, etc. A ghost off-hand source (empty offHand while mainHand is two-handed) resolves to `mainHand`. `validTargets` lists exactly the targets for which `planDrag` is non-null (used to outline slots).

## Scope and gesture
- `src/character/character.ts` and `character.test.ts`: the optional `slot`.
- New `src/scenes/gearDrag.ts` and `gearDrag.test.ts`.
- `src/scenes/InventoryScene.ts` (inspected): 
  1. Primary `pointerdown` on an item slot records a candidate and does nothing yet; secondary-button presses (right/Ctrl+click) behave as today, immediately on `pointerdown`.
  2. Pointer moves more than the threshold (`pressMoved`, screen pixels): the drag starts. A half-transparent copy of the item icon follows the pointer (above the panel, scaled with it; it belongs to the scene, not the slot, since the panel redraws), the source slot is dimmed, the tooltip is hidden, and every slot/grid in `validTargets` gets the gold outline `0xc9a227` (the existing hover colour).
  3. `pointerup`: if a drag started, hit-test the pointer against slot rectangles and the backpack/ground grids' bounds in panel space, `planDrag`, and run the move through `changeGear` (`applyMove`). If not, run the click action exactly as the old `pointerdown` handler did. Esc during a drag cancels it and does not close the panel; a release outside the window cancels it.
  4. Primary click effects therefore move from `pointerdown` to `pointerup` (same slot). Sound, next-tick redraw and `gearChanges` on close are unchanged.
  5. Drag is allowed only under the same gate as a click (`gearApCost !== null`); when refused, nothing starts.
  6. `buildGearHint` gains "Drag to move." in the three variants where changes are allowed.
- Exclusions: no portrait drop targets, no backpack reordering, no ring1/ring2 swap; `gearChanges`, the `equip` action, `equipCost`, saves and events untouched (`LOG_SCHEMA_VERSION` unchanged).

## Verification
- Domain (write first): `character.test.ts`: right slot equips and swaps; wrong slot returns false and changes nothing; a ring into ring2 with ring1 occupied; a two-hander into mainHand with an off-hand item stows it; omitting the slot behaves as before. `gearDrag.test.ts`: each row of the table gives the right move; refusals (full backpack, wrong slot, same place, ghost off-hand resolves to `mainHand`); `validTargets` for each source kind; `applyMove` all-or-nothing.
- Browser (new cases in `e2e/`, `driver.ts` press/move/letGo, `probe()` slot centres): drag the main-hand weapon to the backpack (`equipment.mainHand.item` becomes null, appears in `backpack`) and back; drag a backpack item to the ground and back; a drag onto a wrong slot changes nothing; a plain click still equips/stows; right-click still drops; in battle one AP is still charged on close.
- `InventoryScene.test.ts` still passes. `npm test` and `npm run test:browser` pass.

## Completion criteria
- [x] Contracts exactly as above; domain tests seen failing first.
- [x] Browser cases pass; R2 clicks unchanged.
- [x] One commit; index status and hash updated.

## Execution record

**2026-10-31, implementer (Opus).** Done.

Built, test-first:
1. `equipFromBackpack(character, index, ground, slot?)` in `character.ts`, with a new exported `fitsSlot(item, slot)` (its own slot, or either ring slot for a ring). The new `character.test.ts` cases (right slot swaps, wrong slot changes nothing, ring into a named ring slot, two-hander stows the off hand, empty space) failed first on the two that depend on the slot (wrong-slot refusal, ring2 while ring1 is empty), then passed.
2. `src/scenes/gearDrag.ts` with `DragSource`, `DropTarget`, `GearMove`, `planDrag`, `validTargets`, `applyMove` exactly as the contract. `gearDrag.test.ts` (20 cases: every table row, refusals, ghost off hand, `validTargets` per source kind, `applyMove` all-or-nothing) failed first on the missing module; a mutation dropping `applyMove`'s pre-check on `pickUpEquip` made the all-or-nothing case fail, confirming it bites.
3. `InventoryScene`: a primary press on an item records an `ItemPress`; right-/Ctrl+click still acts on `pointerdown`. Past `DRAG_THRESHOLD_PX` (`pressMoved`), the drag starts: a scene-level copy of the icon (scaled with the panel, depth 1) follows the pointer, the source icon is dimmed to 0.35, the tooltip hides and hover is suppressed, and each target from `validTargets` gets a gold (`0xc9a227`) outline drawn in a `Graphics` in the inventory content (a slot's square, or the whole grid's bounds). On release, drag versus click is `press.drag !== null || pressMoved(press.at, pointer)` (per the step 02 review); a click runs the old action through `changeGear`, a drag hit-tests the slots and then the two grids in panel space and runs `planDrag`/`applyMove` through `changeGear`. Esc mid-drag cancels without closing; `pointerupoutside` cancels; leaving the Inventory tab cancels; the wheel is ignored mid-drag (its redraw would take away the outlines). No press is recorded while `gearApCost === null`.
4. `buildGearHint` gains "Drag to move." in the three variants that allow changes. Checked by screenshot at 1280x800 in battle (the longest variant): it fits above the grid titles.

Browser tests: `e2e/character.test.ts` "drags gear between the equipment, the backpack and the baggage" (weapon to backpack and back, backpack item to baggage and back, a drop on a wrong slot changes nothing, a press moved 3-4 px is still a click on release, Esc mid-drag changes nothing and keeps the panel open); `e2e/battle.test.ts` "charges one action point for gear dragged in the inventory, however many moves" (two drags, 7 AP left, one `equip` with `apCost: 1`). The world-map case failed first at the drop onto the baggage. Existing click and right-click tests (`battle.test.ts`, `world.test.ts` loot) pass unchanged, covering R2.

Verification: `npm test` 67 files, 795 tests passed. `npm run test:browser` 9 files, 66 tests passed. `npm run build` succeeded (the usual chunk-size warning). No paid calls.

Deviations and notes:
- The driver has `holdDown`/`hover`/`letGo` (not `press`/`move`); added `Game.drag(from, to)` on top of them, and recorded it in `e2e/CLAUDE.md`.
- `InventoryProbe` gains `grids: { backpack, ground }` (grid centres on screen), as an empty baggage has no item positions to drop on.
- `equipFromBackpack`'s new parameter is named `into` (the body already has a local `slot`); the type is as contracted. `gearDrag.ts` also imports the value `EQUIPMENT_SLOT_ORDER` from `inventory.ts` (Phaser-free), for the order of `validTargets`.
- A click now fires on release anywhere within the threshold, not only over the same slot; at 6 px that is the same slot except at its very edge.
- `InventoryScene` reuses `rectContains` and `Rect` from `mapScroll.ts`.
- CLAUDE.md updated in this commit (gear paragraph, helper list). The manual is left for step 04, which should also mention the "Drag to move." hint.


**Review round 1 (opus): clean, one non-blocking finding, fixed.**
- Found: a drag could outlive a release the browser never reports (Cmd-Tab mid-drag, let go elsewhere). The ghost would follow a released pointer, and the next press could drop it or leak it. Fixed: a slot's `pointerdown` first calls `endPress()`. `onPointerMove` cancels when `!pointer.isDown || pointer.noButtonDown()`; Phaser keeps `isDown` true without a mouseup, so the move's `buttons` is what shows the release. The game's `BLUR` and `HIDDEN` events cancel too, and are unhooked on shutdown. Browser case added to "drags gear…": a synthetic `mousemove` with `buttons: 0` after a drag starts, then a late release over the baggage, changes nothing. With the move check disabled, that case failed.
- Test gaps filled: `gearDrag.test.ts`, `pickUpEquip` of a two-hander with exactly one free backpack space (the shield falls to the ground); `character.test.ts`, `equipFromBackpack` with the slot omitted matching the old ring choice.
- Disputed: none.
- Verification: `npm test` 67 files, 797 tests passed. `npm run test:browser` 9 files, 66 tests passed.
