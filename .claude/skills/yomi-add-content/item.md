# Adding a base or enchanted item

The rule stays in `src/inventory/CLAUDE.md`, "One id is one object". Touch every line, then run `npm test`.

- `src/inventory/inventory.ts` → `BASE_ITEMS` (plain gear, generated from the catalog) or `MAGIC_ITEMS` (enchanted loot): a new item must be in one, or a game holding it cannot be loaded.
- Never build a graded, modified or runed item by hand; go through its id (or `withRunes`, `unruned`, `craftedItem`).
- `public/assets/sprites/icon_<icon>.png` and its key in `ITEM_ICON_KEYS` (`src/scenes/itemIcons.ts`). How to draw it: `art/CLAUDE.md`.
- A worn look for a weapon, shield, armour, head or cloak: `gear-icon.md`.

## Tests that catch a miss

- `src/game/save.test.ts` only round-trips the items already in `BASE_ITEMS` and `MAGIC_ITEMS`; that a new item is listed there is not enforced; check by hand.
- `src/scenes/itemIcons.test.ts` (an exported icon for every item).
- `src/scenes/unitLook.test.ts` (a worn look for every gear icon).
