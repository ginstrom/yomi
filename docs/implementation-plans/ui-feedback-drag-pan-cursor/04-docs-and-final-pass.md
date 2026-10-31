# Step 04: Docs and final pass

[Index](index.md) · [Design](../../designs/ui-feedback-drag-pan-cursor.md) section 5 (Docs row)

## Objective
The root CLAUDE.md and the player's manual describe the three changes, and one manual check of all three is recorded.

## Dependencies
Steps 01 (cursor), 02 (pan, Home key), 03 (drag and drop) are done. Their behaviour: drag threshold 6 px; the map pan is kept until the party next moves (`arrive()`, a new journey) or Home is pressed, and survives resize, camping and panel closes; friendly-target spells (heals and buffs, `hostile: false`) show a green cross, others the crossed swords; inventory primary clicks act on release.

## Scope
- `CLAUDE.md` (root, inspected): 
  - World-map paragraph (line ~92): "there is no way to pan the view" becomes: drag to pan; the view follows the party again after a journey or on Home.
  - Inventory paragraph (line ~86): items can be dragged as well as clicked (`gearDrag.ts` plans the move, `equipFromBackpack` takes an optional slot).
  - `BattleScene` paragraph (line ~114): the cursor note (`spellCursor`, `CURSORS.heal`), and the new Phaser-free helper modules in the list of sibling modules (`gearDrag.ts`).
- `docs/manual/README.md` (inspected): section 3 "The world map" (line ~101): dragging the map pans it and **Home** returns the view to the party; the key table (line ~278) gets Home on the world map; "Inventory" (line ~188): items can be dragged as well as clicked. Retake screenshots (`npm run manual:screenshots`) only if a screen changed visibly (none should).
- Exclusions: no code changes except fixing defects the check finds, which are reported to the orchestrator rather than silently widened.

## Verification
Run the game (`npm run dev`, `?seed=` for a repeatable battle) and check, recording the result in the execution record:
1. Battle with a healer: aiming Heal over an ally shows the green cross; over a foe with a weapon attack, the swords; aiming a hostile spell, the swords; aiming Shield/Bless over an ally, the cross.
2. World map: drag pans and clamps at the edges, a short click still travels, Home recentres, a journey recentres.
3. Inventory: drag backpack to slot, slot to backpack, backpack to ground and back; a bad drop returns the item; Esc during a drag cancels without closing; plain clicks and right-click as before.
4. `npm test` and `npm run test:browser` pass.

## Completion criteria
- [ ] CLAUDE.md and the manual updated as above.
- [ ] Manual check recorded; `npm test` and `npm run test:browser` green.
- [ ] One commit; index status and hash updated.

## Execution record
