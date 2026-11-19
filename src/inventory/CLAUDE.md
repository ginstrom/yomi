# Items and runes

Loaded when working in `src/inventory/`.

The catalog, items, grades, modifiers and runes, and the rules of what a character wears, are described with characters in `src/character/CLAUDE.md`; read it before changing an item. A new base or enchanted item must be in `BASE_ITEMS` or `MAGIC_ITEMS` or a save holding it cannot be loaded, and a new weapon, shield, armour, head or cloak icon needs a sprite and an entry in `unitLook.ts` (`unitLook.test.ts` fails otherwise). How the trading post, crafting and runecraft use items is in `src/game/CLAUDE.md`.
