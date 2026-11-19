# Items and runes

Loaded when working in `src/inventory/`. The full catalog, grade, socket and rune detail is in `docs/reference/characters.md`; how the trading post, crafting and runecraft use items is in `src/game/CLAUDE.md`.

## The modules

- `catalog.ts`: the families of plain gear (`FAMILIES`: slot, material kind, icon, tier-1 stats), the materials (a tier 1 and a tier 2 of each kind), what tier 2 adds (`TIER_BONUS`) and the legacy ids (`LEGACY_ALIASES`).
- `inventory.ts`: the items (`BASE_ITEMS`, generated from the catalog; `WEAPONS`, the starting weapons; `MAGIC_ITEMS`, the enchanted loot), `itemById`, `addStats` and the strength shortfall. Equipping itself (`equipFromBackpack` and the rest) is in `src/character/character.ts`.
- `grades.ts`: the three grades. `modifiers.ts`: the modifiers (`MODIFIERS`: families, workshop level, change at each grade).
- `runes.ts`: the ten rune kinds at four ranks, sockets (`socketsOf`), fitting (`runeFits`), the pouch, and `onHitParts`, the one phrasing of on-hit effects every screen uses.

## One id is one object

An item's id is `<plain>[@<grade>][+<modifier><grade>][#<rune>(.<rune>)*]`, as in `steel_longsword@3#ember2.storm1`; grade 1 is never written, and an enchanted item takes only the `#` part. `itemById` builds an item from its id and memoises it, so identity comparisons are safe and an alias (`steel_armor`) builds the canonical object. Saves store only ids and load them back through `itemById`, so a new base or enchanted item must be in `BASE_ITEMS` or `MAGIC_ITEMS`, or a game holding it cannot be loaded. Never construct a graded, modified or runed item by hand; go through its id (or `withRunes`, `unruned`, `craftedItem`).

## What changes what

- A grade adds by gear class (damage to a weapon, armour class to a shield or small-slot item, resistance to body armour) and never changes AP, range, piercing, strength or a penalty.
- No tier, grade or modifier touches maximum hit points; only a Life rune in armour or a shield does. Enchanted items take no grade or modifier.
- Each rune does one thing in a weapon (the main hand), another in armour and another in a shield (`slotClass`), folded into the item's stats (`addStats`). Its wards are summed over everything worn, its `onHit` read from the main hand only.

## Rune fitting

`itemById` refuses more runes than the item's sockets or a rune that does not fit. Tier 1 has no sockets, tier 2 one, Masterwork one more, at most 3, and a small-slot item at most 1; three enchanted items have one of their own. Mind fits a weapon only if it strikes with Magic, and Acid only a melee weapon or the crossbow. `runeFitsOnly` says where a rune fits, for refusals.

## Equipping

Every change to what a character wears ends with `clampHp` (see `src/character/CLAUDE.md`): the share rule outside battle, the cap rule in battle. A two-handed weapon and an off-hand item cannot be held together. A new weapon, shield, armour, head or cloak icon needs a sprite and an entry in `unitLook.ts`, or `unitLook.test.ts` fails.
