# Adding an element

Touch every line, then run `npm test`.

- `src/combat/combat.ts` → `ELEMENTS`. Wards everywhere are `Partial<Record<Element, number>>`, and most readers iterate `ELEMENTS`.
- Check the readers that key by name: `ELEMENT_SPELL_SOUNDS` in `src/scenes/sounds.ts`, and the runes in `src/inventory/runes.ts`.

## Tests that catch a miss

- `tsc` (full `Record`s keyed by element).
- `src/combat/spells.test.ts` (the `ELEMENTS` list check) is the sure catch.
- `ELEMENT_SPELL_SOUNDS` is a `Partial`, so nothing enforces it: check it by hand.
