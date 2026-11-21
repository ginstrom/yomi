# Adding a rune kind

Runes are keyed by element: see `element.md`. Touch every line, then run `npm test`.

- `src/inventory/runes.ts` → the rune kind and its ranks; `runeFits` and `runeFitsOnly` say where it fits (`runeFitsOnly` words the refusals).
- `src/inventory/runes.ts` → `onHitParts`: the one phrasing of an on-hit effect every screen uses.
- `src/scenes/itemIcons.ts` → `RUNE_ICON_KEYS` and `RUNE_COLOURS`: an icon and a colour. How to draw the icon: `.claude/skills/yomi-sprites/`.

## Tests that catch a miss

- `src/scenes/itemIcons.test.ts` (an exported icon and a colour for every rune).
- `src/inventory/runes.test.ts`.
- `onHitParts` and `runeFitsOnly` wording: not enforced; check by hand.
