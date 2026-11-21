# Adding a spell

A spell is an entry in `SPELLS` (`src/combat/spells.ts`). Touch every line, then run `npm test`.

- `src/combat/spells.ts` → `SPELL_IDS` (a hero's, taught by exactly one node, `perkTeaching` in `src/character/perks.ts`) or `MONSTER_SPELL_IDS`.
- `src/combat/spells.ts` → `ALL_SPELL_IDS`: its order is the battle's Skills list's order.
- `src/character/perks.ts` → `PERKS`: a hero's spell is taught by exactly one node; see `skill-node.md`.
- `src/scenes/battleEffects.ts` → `SPELL_LOOKS`: a look (a full `Record`, so `tsc` asks).
- `src/scenes/sounds.ts` → `spellSound`, `SPELL_SOUND_OVERRIDES`: a sound if its element or school does not cover it.
- `src/engine/policies.ts` → a rule, if the policy should cast it deliberately; else it is used only as the hardest-hitting spell or not at all.
- `src/combat/spells.ts` → `isHealing` decides whether the world map, `autoHeal` and the heal reserve count it.
- A new `StatusRule` field it needs means engine code; see `status.md`.

## Tests that catch a miss

- `tsc` (a full `Record` of `SPELL_LOOKS`).
- `src/combat/spells.test.ts` and `src/character/perks.test.ts` (ids, one teaching node).
- `src/scenes/sounds.test.ts` (sound coverage).
- A change that moves play: `scripts/simulate.test.ts` and `src/engine/policies.test.ts`; see `yomi-balance`.
