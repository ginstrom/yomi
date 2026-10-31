# UI feedback: inventory drag and drop, world map drag-to-pan, healing cursor

## 1. Purpose and status

Three small, independent scene-level fixes from play feedback. No game rule changes; no architecture brief (see `docs/features/ui-feedback-drag-pan-cursor.md`).

**Status: approved by the user; ready for planning.** The three questions of the first draft are resolved (section 8).

The three changes share no code and can be built and shipped in any order.

## 2. Requirements

| ID | Requirement |
| --- | --- |
| R1 | In the inventory panel, the player can drag an item from one place and drop it on another to equip, stow, drop or pick it up (the pairs in 4.1). |
| R2 | Clicking (and right-/Ctrl+clicking) an item does exactly what it does today. A press that moves less than the drag threshold is a click. |
| R3 | Everywhere a drag is allowed, a drop on something that cannot take the item changes nothing; the item returns to where it was. |
| R4 | On the world map, pressing on the map and dragging pans the view. |
| R5 | A press that becomes a drag never travels the party. A press released within the threshold is a click-to-move as today. |
| R6 | While a spell that restores hit points is being aimed in battle, the cursor over a valid target is a healing cursor, not crossed swords. |
| R7 | Weapon attacks (and hostile spells) keep the crossed swords. |
| R8 | On the world map, **Home** recentres the view on the party, clearing any pan. |

Non-goals: handing an item to another party member by dragging it onto their portrait (decided out of scope; members still pass items through the baggage); reordering backpack spaces; ring1 to ring2 swaps; touch gestures and inertia on the map; pinch/wheel zoom.

## 3. Current system (inspected)

**Inventory** (`src/scenes/InventoryScene.ts`, rules in `src/character/character.ts`). Everything is click-driven and acts on `pointerdown`, through `changeGear(change)`, which refuses when `gearApCost === null` (not the unit's turn), plays the click sound and rebuilds the panel next tick (the redraw destroys the slot whose handler ran).
- Equipment slot (`createSlot`): click `unequipToBackpack(character, slot)` (first empty backpack space); right-/Ctrl+click `dropEquipped`. A two-handed weapon is shown ghosted in the off-hand slot and acts as `mainHand`.
- Backpack space (`buildBackpack`): click `equipFromBackpack(character, i, ground)`, which chooses the slot itself (`item.slot`; a ring takes the first empty ring slot, else ring2, else replaces ring1), swaps with what was there, and stows or drops the other hand when a two-hander and an off-hand item collide; right-click `dropFromBackpack`.
- Ground grid (`buildGround`): click `pickUp(character, ground, index)` into the first empty backpack space. On the world map the "ground" is the party's baggage (`gearApCost: 0`, `resumeKey 'World'`), which is also how an item passes from one member to another (take it in one member's panel, switch member, put it in).
- Only the active member's panel is shown at a time; the portrait column is in `PartyColumn` and takes only clicks. Slots are plain interactive rectangles in a scaled `panel` container; `probe()` reports slot centres for browser tests.
- Every item has one fixed `slot` (`Item.slot`), so a drag from slot to a different slot is never valid (rings aside, a non-goal).

**World map** (`src/scenes/WorldScene.ts`, `src/scenes/mapScroll.ts`). The whole map is `mapLayer`, positioned only by `follow()` = `mapOrigin(partyPoint, map, view)` (party kept mid-view, edges clamped to `view`, smaller-than-view axes centred). There is no way to pan. Input: a scene-level `pointerdown` whose `over` list is empty (nothing interactive under the pointer) calls `onMapClick`, which resolves `hexAt` and calls `travel`; `pointermove` drives `setHovered` (route preview and `info` panel); `GAME_OUT` clears the hover. `follow()` runs on `layout()` (resize) and `arrive()`. `probe().origin` already exposes `mapLayer`'s position.

**Battle cursor** (`src/scenes/cursors.ts`, `BattleScene.refreshHover`). `CURSORS` holds `move` (`default`), `select` (`pointer`), `attack` and `attackDisabled`. The latter two are one hand-built inline SVG, `swordsCursor(faded)`, a 32x32 `data:` URL with hotspot 16,16 and a `crosshair` fallback. `refreshHover` switches on `boardIntent(at)`: `attack` (weapon, faded when the AP cannot cover it) and `cast` both exist; **`case 'cast'` sets `CURSORS.attack` for every spell**, which is why healing shows swords. The cast intent's action carries the spell id (`CastAction.spell`), and `SPELLS[id]` has `hostile` and optional `heal`/`damage`/`status` (`src/combat/spells.ts`). Friendly spells: heal, greater_heal, heal_all, greater_heal_all (these have `heal`); shield, protect, bless, mirror_image, haste (statuses, `hostile: false`). `WorldScene.refreshHover` also uses `CURSORS.attack` for a route that ends among sighted monsters (unchanged).
- **Art pipeline:** the cursors are *not* sprite-tool art. `art/` and `npm run sprites` produce sprites loaded into Phaser; a CSS cursor must be a data URL, so the existing precedent is code-drawn SVG in `cursors.ts`. The new cursor follows that precedent; nothing is added to `art/` and `npm run sprites:check` is unaffected.

## 4. Proposed behaviour

### 4.1 Inventory drag and drop (R1-R3)

Drag is available only on the Inventory tab, with the primary button, on a slot that holds an item, and only when `gearApCost !== null` (same gate as a click). Items and drops:

| From | To | Result (existing function) |
| --- | --- | --- |
| Backpack space | its equipment slot (a ring: either ring slot) | equip into *that* slot, swapping with what is there; two-hander/off-hand rule as `equipFromBackpack` |
| Backpack space | Ground/baggage grid (anywhere on it) | `dropFromBackpack` |
| Equipment slot (the ghost off-hand counts as `mainHand`) | Backpack grid (anywhere on it) | `unequipToBackpack` (first empty space; refused when full) |
| Equipment slot | Ground/baggage grid | `dropEquipped` |
| Ground/baggage item | Backpack grid (anywhere on it) | `pickUp` |
| Ground/baggage item | its equipment slot | `pickUp`, then equip the picked item into that slot; refused (nothing changed) when the backpack is full |

Anything else (wrong slot, same place, outside any target, a refused change) is a no-op.

Gesture:
1. `pointerdown` (primary) on an item slot records it as a *candidate*; nothing happens yet. Secondary-button presses behave as today, immediately.
2. Pointer moves more than `DRAG_THRESHOLD_PX` (6, screen pixels) from the press: the drag starts. A half-transparent copy of the item icon follows the pointer (above the panel, scaled with it), the source slot is dimmed, the tooltip is hidden, and every slot that would accept the item gets the gold outline (`0xc9a227`, already the hover colour).
3. `pointerup`: if a drag was started, resolve the drop target by hit-testing the pointer against slot rectangles and the backpack/ground grids' bounds in panel space, and run the matching change through `changeGear`. If it was not, run the click action exactly as the `pointerdown` handler does today. Esc during a drag cancels it (and does not close the panel); a release outside the window cancels it.
4. Click effects therefore move from `pointerdown` to `pointerup` for the primary button (the position is still on the same slot). Right-/Ctrl+click stays on `pointerdown`. Everything after a change is unchanged: sound, redraw on the next tick, `gearChanges` computed on close.

Slot-specific equip needs a small domain extension: `equipFromBackpack(character, index, ground, slot?)`, with `slot` optional. Without it behaviour is identical. With it, the item must be able to go there (`slot === item.slot`, or `slot` is a ring slot and `item.ring`), else it returns false and changes nothing; the swap/two-hander logic uses that slot in place of the computed one. The hint line in `buildGearHint` gains "Drag to move." in the three variants where changes are allowed.

### 4.2 World map drag-to-pan (R4-R5)

State: `panOrigin: Point | null` on `WorldScene` (null = follow the party). `applyOrigin()` sets `mapLayer` to `panOrigin` clamped by the same bounds as `mapOrigin`, else to `mapOrigin(...)`; `follow()` is that function. Whole pixels are kept.

Gesture, replacing the immediate `pointerdown` click:
1. `pointerdown` with an empty `over` list inside `view` (not while `walking` or the outcome shade shows) records `{ x, y, originAtPress }` as a *press*.
2. `pointermove` with the button down: once the pointer is more than `DRAG_THRESHOLD_PX` (6) from the press, the press becomes a pan. The map moves with the pointer: `panOrigin = clamp(originAtPress + (pointer - press))`. While panning the hover is cleared (no route, no info), and the cursor is `grabbing`. After release the cursor returns to normal on the next hover.
3. `pointerup`: a press that never became a pan calls `onMapClick` with the *press* position, exactly as today (so click-to-move, monsters, etc. are unchanged). A pan just ends; no click is issued.
4. `pointerupoutside`/`GAME_OUT` while pressed ends the gesture the same way (a pan stays where it is; an unpanned press is dropped without a click).
5. Panning stays within the map's edges, as the follow does (no empty space scrolled into view). `hexAt` already reads `mapLayer`'s position, so a click on a panned view resolves correctly.
6. The pan is kept until the view follows the party again: `arrive()` and a new journey's start clear `panOrigin` (so the party is back mid-view after a walk). `layout()` on resize re-clamps a pan rather than clearing it. Camping, scouting and panel closes do not clear it.

The press now fires on release, so the existing "click while walking is ignored" and outcome-shade checks apply at the press and again at release.

**Recentre key (R8).** `WorldScene` binds `keydown-HOME` beside its `ESC` and `C` bindings: it clears `panOrigin` and calls `follow()`, so the party is mid-view again (edges clamped as ever). Home is free on the world map: its only keys are Esc (menu) and C (character panel). Space and Enter are avoided because the Story overlay uses them to advance beats. The key does nothing while `walking`, while the outcome shade shows, or when no pan is active; the debug console takes every key while open, as for the others. It does not move the party or pass time. It is documented in the manual, not on screen.

### 4.3 Healing cursor (R6-R7)

Add `CURSORS.heal`: a stylised cross (a plus, thick arms, rounded caps) in the healing school's green (`#58b858`, the healing school's colour `0x58b858` in `spells.ts`) with a light fill and the same black halo outline as the swords (stroke 5 black under stroke 3 colour), 32x32, hotspot 16,16, fallback `crosshair`. It is drawn by a `healCursor()` beside `swordsCursor` in `cursors.ts` using the same SVG-to-data-URL approach.

Add a pure `spellCursor(spell: SpellId): CursorKey` (in `cursors.ts` or a small sibling) returning `'heal'` when `!SPELLS[spell].hostile`, otherwise `'attack'`. `refreshHover`'s `case 'cast'` calls it instead of the fixed `CURSORS.attack`. The cast intent already exists only over legal targets, so the cursor shows only over a valid target; elsewhere it stays `move`, as now.

Other friendly spells (shield, protect, bless, mirror image, haste) currently show swords too. **Decided (user): every friendly-target spell, heals and buffs, uses the cross.** `spellCursor` returns `'heal'` for any spell with `hostile: false` and `'attack'` otherwise. Hostile spells keep the swords.

## 5. Technical design summary

| Change | Files (proposed) |
| --- | --- |
| Slot-specific equip | `src/character/character.ts` (`equipFromBackpack` optional `slot`) |
| Drag plan: from/to to a change, valid-target set | new `src/scenes/gearDrag.ts`, Phaser-free, imports only `character.ts` types/functions |
| Drag gesture and ghost | `src/scenes/InventoryScene.ts` (slot handlers, press/threshold/up, hit-test, hint line) |
| Pan gesture maths | `src/scenes/mapScroll.ts` (`panBy`/clamp reusing `mapOrigin`'s bounds) and a tiny gesture state helper (`pressMoved(press, now, threshold)`), shared with the inventory for the threshold |
| Pan wiring | `src/scenes/WorldScene.ts` (`panOrigin`, input handlers, `follow`/`arrive`, the Home key) |
| Cursor | `src/scenes/cursors.ts`, `src/scenes/BattleScene.ts` (`refreshHover`, `case 'cast'`) |
| Probe | `InventoryProbe` needs no new field (slot centres exist); `WorldProbe.origin` already shows the pan |
| Docs | root `CLAUDE.md`: world-map paragraph ("there is no way to pan the view" becomes "drag to pan; the view follows the party again after a journey or on Home"), inventory paragraphs (drag as well as click), cursor note in the `BattleScene` paragraph; `docs/manual/README.md`: in the world-map section say that dragging the map pans it and **Home** returns the view to the party, and in the inventory section (near line 152, the character panel) that items can be dragged as well as clicked; retake screenshots only if a screen changed visibly (none should) |

Contracts and invariants: `gearChanges`, the `equip` action and `equipCost` are untouched (a drag is one or more of the same changes; AP is still charged once on close). `hp <= maxHp` stays true (no item changes max HP). No save format or event change, so no `LOG_SCHEMA_VERSION` bump. Both gestures use one `DRAG_THRESHOLD_PX = 6` constant.

## 6. Consequences

- Clicks on the map and on inventory items now act on release rather than press: no practical difference for mouse users, and the browser tests' `mouse.click` still works.
- A panned world map does not auto-recentre until the party moves or Home is pressed; resizing does not lose the pan.
- The panel redraws after every change, which destroys the dragged-from slot; the drag ghost belongs to the scene, not the slot, so the drop is unaffected.
- Performance: nothing beyond a pointermove handler; hit-testing is a few rectangle checks.

## 7. Verification

Following the repo's split: rules in `domain`, helpers in `domain`, `*Scene.test.ts` smoke only, behaviour in the browser tests.

**Domain (`npm test`)**
- `character.test.ts`: `equipFromBackpack` with a target slot: right slot equips and swaps; wrong slot returns false and changes nothing; a ring into ring2 with ring1 occupied; two-hander into mainHand with an off-hand item stows it; omitting the slot behaves as before. (R1, R3)
- `gearDrag.test.ts`: each row of the 4.1 table gives the right change; refusals (full backpack, wrong slot, same place, ghost off-hand source resolves to `mainHand`); the valid-target set for each source. (R1, R3)
- `mapScroll.test.ts`: recentring gives `mapOrigin` of the party (the pan discarded); a pan is clamped to the map's edges, a map smaller than the view stays centred, `pressMoved` is false at 5 px and true at 7 px. (R4, R5)
- `cursors.test.ts` (new, domain): `spellCursor` is `heal` for every `SPELLS` entry with `hostile: false` (heals and buffs) and `attack` for every hostile spell; `healCursor()` returns a `url("data:image/svg+xml…") 16 16, crosshair` string distinct from `attack`'s. (R6, R7)
- `InventoryScene.test.ts` and `WorldScene` smoke tests keep passing (registration only).

**Browser (`npm run test:browser`, new cases in `e2e/`)** using `driver.ts` press/move/letGo helpers and the probes:
- Inventory: drag the main-hand weapon to the backpack (`equipment.mainHand.item` becomes null, appears in `backpack`); drag it back to its slot; drag a backpack item to the ground and back; a drag onto a wrong slot changes nothing; a plain click still equips/stows; right-click still drops. In battle, one AP is still charged on close. (R1-R3)
- World map: press at a map point and move 40 px: `probe().origin` shifts by that delta (clamped), and `world.party` and `turn` are unchanged (no travel); a press-release without movement still travels; after the journey `origin` follows the party again. (R4, R5)
- Recentre: after a pan, press Home (`page.keyboard.press('Home')`): `probe().origin` equals its value before the pan, `world.party` and `turn` unchanged; Home with no pan or while walking changes nothing. (R8)
- Cursor: the browser tests cannot read the CSS cursor reliably; verify R6/R7 in the domain test above and by running the game (`?seed=` replays) with a healer, noting the cursor shape over an ally while aiming Heal and over a foe while attacking. (R6, R7)

## 8. Open questions and assumptions

Assumptions (made without the user; change them cheaply):
- A1. Drag threshold is 6 px for both screens.
- A2. Click actions move to `pointerup`; right-click stays on `pointerdown`.
- A4. The map pan resets when the party next moves and survives resize, camping and panel closes.
- A5. Ground-to-slot is supported as pick-up-then-equip when the backpack has room.
- A6. The cursor art is an inline SVG in `cursors.ts` (the existing method), not a sprite-tool asset; the art is a plus-shaped cross, not a book.

Resolved by the user (the first draft's questions):
- Q1. Dragging an item onto a party member's portrait: out of scope, a non-goal.
- Q2. Every friendly-target spell, heals and buffs, uses the cross (section 4.3).
- Q3. A key recentres the map on the party: Home (section 4.2, R8).

No open questions remain.
