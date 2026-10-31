# Implementation plan: UI feedback, inventory drag and drop, world map drag-to-pan, healing cursor

Three small, independent scene-level changes from play feedback. No game rule, save-format or event change, so `LOG_SCHEMA_VERSION` stays as it is.

**Source design:** [docs/designs/ui-feedback-drag-pan-cursor.md](../../designs/ui-feedback-drag-pan-cursor.md) (approved by the user 2026-10-31). Feature record: [docs/features/ui-feedback-drag-pan-cursor.md](../../features/ui-feedback-drag-pan-cursor.md). Planned against repo commit `dc5e4ee`, branch `armor-resistance`.

## Scope and shared constraints

- In scope: R1 to R8 of the design. Out of scope (non-goals): handing an item to another member by dragging onto a portrait, reordering backpack spaces, ring1/ring2 swaps, touch gestures and inertia on the map, pinch/wheel zoom.
- **Test first**, per the repo's split: rules and helpers get `domain` tests (`src/**/*.test.ts`, Node); `src/scenes/*Scene.test.ts` are registration smoke tests only; behaviour is covered by the browser tests in `e2e/` (`npm run test:browser`, headless Chromium, `e2e/driver.ts` has `press`/`move`/`letGo` helpers). New helper modules under `src/scenes/` must be Phaser-free so their tests run in `domain`.
- Imports use explicit `.ts` extensions, `import type` for types, no enums or constructor parameter properties; `tsc` is the lint (`noUnusedLocals`, `noUnusedParameters`).
- `npm test` (`tsc && vitest run`) must pass after each step; steps touching scenes also run `npm run test:browser`. CLAUDE.md says to commit finished work on the current branch (one commit per step) and not to push. Commit messages end with the attribution line given to the implementer.
- Domain code stays Phaser-free. `gearChanges`, the `equip` action and `equipCost` are untouched (AP is charged once on close). No new art in `art/`; `npm run sprites:check` is unaffected.
- One shared constant `DRAG_THRESHOLD_PX = 6` (screen pixels) for both gestures.

## Shared contracts

Produced by step 02, consumed by step 03, in `src/scenes/mapScroll.ts`:

```ts
export const DRAG_THRESHOLD_PX = 6
/** True once `now` is MORE than `threshold` pixels (Euclidean) from `press`. 5 px -> false, 7 px -> true. */
export function pressMoved(press: Point, now: Point, threshold: number = DRAG_THRESHOLD_PX): boolean
/** `originAtPress + (now - press)`, clamped to the map's edges as `mapOrigin` clamps; whole pixels. */
export function pannedOrigin(originAtPress: Point, press: Point, now: Point, map: { width: number; height: number }, view: Rect): Point
/** Clamps an origin to the same bounds `mapOrigin` uses (a map smaller than the view on an axis is centred on it). */
export function clampOrigin(origin: Point, map: { width: number; height: number }, view: Rect): Point
```

`Point` is from `src/scenes/boardGeometry.ts`. `mapOrigin` keeps its signature and behaviour.

Produced by step 03, in the new `src/scenes/gearDrag.ts` (Phaser-free; imports only `character.ts` and inventory types):

```ts
export type DragSource =
  | { kind: 'equipment'; slot: EquipmentSlot }   // a ghost off-hand is passed as (or normalised to) mainHand
  | { kind: 'backpack'; index: number }
  | { kind: 'ground'; index: number }
export type DropTarget =
  | { kind: 'equipment'; slot: EquipmentSlot }
  | { kind: 'backpack' }                          // anywhere on the backpack grid
  | { kind: 'ground' }                            // anywhere on the ground/baggage grid
export type GearMove =
  | { kind: 'equip'; index: number; slot: EquipmentSlot }
  | { kind: 'unequip'; slot: EquipmentSlot }
  | { kind: 'dropBackpack'; index: number }
  | { kind: 'dropEquipped'; slot: EquipmentSlot }
  | { kind: 'pickUp'; index: number }
  | { kind: 'pickUpEquip'; index: number; slot: EquipmentSlot }
export function planDrag(character: Character, ground: Item[], from: DragSource, to: DropTarget): GearMove | null
export function validTargets(character: Character, ground: Item[], from: DragSource): DropTarget[]
export function applyMove(character: Character, ground: Item[], move: GearMove): boolean   // all-or-nothing
```

Produced by step 03 in `src/character/character.ts`: `equipFromBackpack(character, index, ground, slot?: EquipmentSlot): boolean`. Produced by step 01 in `src/scenes/cursors.ts`: `healCursor()`, `CURSORS.heal`, `spellCursor(spell: SpellId): CursorKey`.

## Tasks

| Step | Task | Outcome | Depends on | Status |
| --- | --- | --- | --- | --- |
| 01 | [Healing cursor](01-healing-cursor.md) | Friendly-target spells show a green cross over a valid target; hostile spells and weapons keep the swords | none | done (0216092) |
| 02 | [World map drag-to-pan and Home](02-world-map-pan.md) | Dragging pans the map; a short press still travels; Home recentres | none | done (9fe243d) |
| 03 | [Inventory drag and drop](03-inventory-drag-drop.md) | Items drag between backpack, equipment and ground/baggage; clicks act on release | 02 (for `pressMoved`/`DRAG_THRESHOLD_PX`) | done (4c0dcb6) |
| 04 | [Docs and final pass](04-docs-and-final-pass.md) | CLAUDE.md and the manual describe the changes; one manual check of all three | 01, 02, 03 | pending |

## Execution order

01 and 02 are independent and touch different files; 03 follows 02 only for the shared threshold helper (it may be run in parallel if 03's implementer adds nothing to `mapScroll.ts` but imports 02's exports; otherwise run sequentially). 04 last. Steps 01 to 03 edit disjoint files (`cursors.ts`/`BattleScene.ts`; `mapScroll.ts`/`WorldScene.ts`; `character.ts`/`gearDrag.ts`/`InventoryScene.ts`), so commit order is 01, 02, 03, 04. Checkpoint: `npm test` and `npm run test:browser` pass after each commit.

## Requirement map

| Req | Requirement | Task |
| --- | --- | --- |
| R1 | Drag items between places in the inventory (table 4.1) | 03 |
| R2 | Click, right-click and Ctrl+click unchanged; under the threshold is a click | 03 |
| R3 | A drop that cannot take the item changes nothing | 03 |
| R4 | Dragging the world map pans the view | 02 |
| R5 | A drag never travels the party; a short press still does | 02 |
| R6 | Healing cursor while aiming a friendly spell over a valid target (all `hostile: false` spells, decision Q2) | 01 |
| R7 | Weapon attacks and hostile spells keep the swords | 01 |
| R8 | Home recentres the view on the party | 02 |
| Docs | CLAUDE.md, manual (world map pan and Home, inventory drag), "Drag to move." hint (hint itself in 03) | 04 |
| Verification | Domain tests per step; browser tests in 02 and 03; cursor checked by hand in 04 | 01 to 04 |

## Overall completion criteria

Steps 01 to 04 done, one commit each, `npm test` and `npm run test:browser` green on the last, and the manual check in step 04 recorded.

## Open questions and notes

No blocking questions. Planner decisions (routine):
1. The shared threshold helpers live in `mapScroll.ts`, as the design's file table puts them, and the inventory imports them from there.
2. `healCursor()` and `spellCursor` live in `cursors.ts` (the design allows a sibling file). `cursors.ts` must be importable from Node tests: it only builds strings, but the implementer must check it has no Phaser import and that `CURSORS`' module load is Node-safe.
3. The pan gesture's browser test and the drag tests go in `e2e/world.test.ts` and `e2e/character.test.ts` (or a new e2e file) as the implementer finds fits.

## For implementers

Set your step to `in progress` here when starting and `done` with the commit hash when finished. Record evidence, deviations and blockers in the task file's execution record.
