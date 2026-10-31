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
- [ ] Contracts exactly as above; domain tests seen failing first.
- [ ] Browser cases pass; R2 clicks unchanged.
- [ ] One commit; index status and hash updated.

## Execution record
