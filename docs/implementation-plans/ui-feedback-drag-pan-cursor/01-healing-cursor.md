# Step 01: Healing cursor

[Index](index.md) · [Design](../../designs/ui-feedback-drag-pan-cursor.md) section 4.3

## Objective
While aiming a friendly-target spell in battle, the cursor over a valid target is a green cross instead of crossed swords. Covers R6, R7.

## Requirements and context
- R6: aiming any spell with `hostile: false` (heals: heal, greater_heal, heal_all, greater_heal_all; buffs: shield, protect, bless, mirror_image, haste), the cursor over a valid target is the healing cursor. User decision Q2: heals and buffs both use the cross.
- R7: weapon attacks and hostile spells keep the swords (`CURSORS.attack`, `attackDisabled`).
- Today `BattleScene.refreshHover`'s `case 'cast'` sets `CURSORS.attack` for every spell. The cast intent exists only over legal targets, so elsewhere the cursor stays `move`.
- The cursors are code-drawn inline SVG data URLs in `src/scenes/cursors.ts` (`swordsCursor(faded)`: 32x32, hotspot 16,16, `crosshair` fallback), not sprite-tool art. Add nothing to `art/`.
- `SPELLS` is in `src/combat/spells.ts` (`hostile: boolean`, optional `heal`/`damage`/`status`; healing school colour `0x58b858`).

## Scope
- `src/scenes/cursors.ts` (inspected): add `healCursor()` beside `swordsCursor`: a plus-shaped cross with thick arms and rounded caps, light fill, green `#58b858`, the same black halo as the swords (stroke 5 black under stroke 3 colour), 32x32, hotspot 16,16, fallback `crosshair`, same SVG-to-data-URL approach. Add `heal` to `CURSORS`. Export `spellCursor(spell: SpellId): CursorKey` returning `'heal'` when `!SPELLS[spell].hostile`, else `'attack'`. Export `CursorKey` if it is not already.
- `src/scenes/BattleScene.ts` (inspected): in `refreshHover`'s `case 'cast'` use `CURSORS[spellCursor(action.spell)]` (the cast intent's action carries `CastAction.spell`) in place of `CURSORS.attack`.
- Exclusions: `WorldScene.refreshHover` keeps `CURSORS.attack` for a route ending among monsters; no change to `attackDisabled`, policies, engine or art.

## Verification
- New `src/scenes/cursors.test.ts` (domain; first confirm `cursors.ts` imports no Phaser): `spellCursor` is `'heal'` for every `SPELLS` entry with `hostile: false` and `'attack'` for every hostile one (iterate `SPELLS`); `healCursor()` returns a string matching `url("data:image/svg+xml...") 16 16, crosshair` and differs from `CURSORS.attack`. Seen failing first.
- `npm test` passes; `npm run test:browser` still passes.
- Browser tests cannot read the CSS cursor reliably; the on-screen check (heal cursor over an ally, swords over a foe) is done in step 04.

## Completion criteria
- [ ] `healCursor`, `CURSORS.heal`, `spellCursor` exist as above; `case 'cast'` uses `spellCursor`.
- [ ] New test failed first, then passes; `npm test` green.
- [ ] One commit; index status and hash updated.

## Execution record

- Baseline: `npx vitest run` 754 passed before changes.
- Red: new `src/scenes/cursors.test.ts` failed (3 of 4) on missing `healCursor`/`spellCursor`/`CURSORS.heal`; `cursors.ts` had no Phaser import, so it runs in `domain`.
- Green: added `healCursor()` (green `#58b858` plus with black halo and light core, 32x32, hotspot 16,16, `crosshair` fallback), `CURSORS.heal`, `CursorKey`, `spellCursor()`; `BattleScene.refreshHover` `case 'cast'` uses `CURSORS[spellCursor(intent.action.spell)]`.
- `npm test`: 66 files, 758 tests passed (tsc clean). `npm run test:browser`: 9 files, 54 tests passed.
- Deviations: none. The on-screen cursor check is left to step 04.
