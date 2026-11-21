# Adding a weapon, shield, armour, head or cloak look

Touch every line, then run `npm test`.

- `src/scenes/unitLook.ts` → `GEAR_SPRITES` (weapon or shield) or `WORN_SPRITES` (armour, head or cloak); `WORN_BACK_SPRITES` for a cape.
- `art/gear/gear_<icon>.sprite.toml` → the sprite: `over = "warrior"`, `[anim.idle]` `like = "warrior"`, `[anim.walk]` `rest = true`, and out of the body's fist, off-hand and face regions. How to draw it: `art/CLAUDE.md`.
- `src/scenes/sounds.ts` → `WEAPON_SOUNDS`: a weapon icon needs a sound.
- `src/scenes/unitLook.ts` → `SWUNG_GEAR`: a blade or axe that swings.
- An item that wears it: `item.md`.

## Tests that catch a miss

- `src/scenes/unitLook.test.ts` (an entry and a sprite for every gear icon).
- `src/scenes/sounds.test.ts` (`WEAPON_SOUNDS` for every weapon icon).
- `SWUNG_GEAR` is a choice: not enforced; check by hand.
