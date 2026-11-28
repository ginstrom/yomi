# Adding an ability

An ability is an entry in `ABILITIES` (`src/combat/abilities.ts`): a monster's, or a hero's technique. Touch every line, then run `npm test`.

- `src/combat/abilities.ts` → `ABILITIES`, `ABILITY_IDS` (monsters' first, techniques after); its order is the Abilities tab's order. A monster's also goes in `MONSTER_ABILITY_IDS` (or the foe panel and the simulator count it a technique; `src/combat/abilities.test.ts` holds the list to the front of `ABILITY_IDS`, not enforced beyond that).
- `src/character/perks.ts` → a node's `ability` to teach a technique; see `skill-node.md`.
- `src/scenes/sounds.ts` → a sound in `ABILITY_SOUNDS`, unless it is a technique of strikes (a place in `SOUNDS_AS_ATTACKS`; `src/scenes/sounds.test.ts` enforces).
- `src/scenes/battleEffects.ts` → an `ABILITY_LOOKS` or `STRIKE_FLASHES` entry for an area, status or elemental strike (optional otherwise).
- `src/combat/abilities.ts` → AP read only through `abilityApCost`.
- A new `Ability` field means engine code to apply it; keep it out of the RNG unless it is a roll.
- The foe hover panel (`src/scenes/foeInfo.ts`) describes it from its data for free.

## Tests that catch a miss

- `src/scenes/sounds.test.ts` (an ability that would sound nothing).
- `src/scenes/battleEffects.test.ts` (looks).
- `tsc` (full `Record`s keyed by ability).
- A change that moves play: `scripts/simulate.test.ts`; see `yomi-balance`.
