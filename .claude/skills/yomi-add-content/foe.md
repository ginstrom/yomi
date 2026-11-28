# Adding a foe or unit kind

A foe kind is a `UnitKind`. Touch every line, then run `npm test`.

- `art/units/<kind>.sprite.toml` → a sprite named for the kind (its id is the `UnitKind`), with `idle` and `walk` animations and a `[points] chest` (where shots and spells are aimed and fly from). How to draw it: `.claude/skills/yomi-sprites/`.
- `src/game/encounters.ts` → a monster kind is added to `MonsterKind` and its stat block to `FOE_STATS`; a bandit kind is a `BanditKind` (same file) with its role in `BANDIT_ROLE` in `src/game/bandits.ts`.
- `src/game/encounters.ts` → `FOE_XP`: an experience value.
- `src/game/encounters.ts` → `FOE_NATIVE_LEVEL`: a native level, if not 1.
- `src/scenes/sounds.ts` → `FOE_SOUNDS`: a sound.
- The check, not an edit: `foeYardstick` (`src/combat/combat.ts`) gives the ranges a stat block must sit in at its native level; each field outside is a named exception in `src/game/encounters.test.ts` (a stage 11 kind: add it to `STAGE_11_KINDS` there, held to `foeYardstick(level, 'expected')`).
- Anything that changes a foe moves balance: `.claude/skills/yomi-balance/`.

## Tests that catch a miss

- `tsc` (`FOE_XP`, `FOE_NATIVE_LEVEL` and `FOE_SOUNDS` are full `Record`s).
- `src/scenes/unitLook.test.ts` (every kind in the atlas, with `idle` and `walk`).
- `src/scenes/sounds.test.ts` (a class, a fall and a step for every kind).
- The yardstick test in `src/game/encounters.test.ts`.
- `[points] chest` is not enforced; check by hand.
