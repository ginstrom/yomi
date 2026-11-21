# Adding a trait

A trait is an id in `TRAIT_IDS` (`src/combat/combat.ts`) that the engine reads by name. Touch every line, then run `npm test`.

- `src/combat/combat.ts` → `TRAIT_IDS`.
- `src/character/perks.ts` → a node's `trait` switches it on (`traitsOf`); see `skill-node.md`.
- `src/engine/battleEngine.ts` → put its effect in the shared helpers (`traitToHit`, `traitDamage`, `applyDamage`, the turn-start passes, `auraBonus`) so previews and the policy see it. It never draws from the RNG.
- `src/engine/battleEngine.ts` → any per-unit state it needs goes on `UnitRecord` and the snapshot; that is a save-shape change (raise `SAVE_VERSION`, and have `restore` take a missing field up as false or `[]`).
- `src/engine/battleEngine.ts` → a new event field from it bumps `LOG_SCHEMA_VERSION`; see `battle-event.md`.
- `src/scenes/sounds.ts`, `src/scenes/battleEffects.ts` → a new sound or float.

## Tests that catch a miss

- `src/character/character.test.ts` and `src/character/perks.test.ts` (trait ids and nodes).
- `src/engine/battleEngine.test.ts` (events, restore).
- A change that moves play: `scripts/simulate.test.ts`; see `yomi-balance`.
