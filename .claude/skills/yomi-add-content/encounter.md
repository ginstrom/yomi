# Adding an encounter

Touch every line, then run `npm test`.

- `src/game/encounters.ts` → `ENCOUNTERS`: an entry.
- `src/game/encounters.ts` → `ENCOUNTER_BANDS`: its band.
- `src/game/encounters.ts` → `ENCOUNTER_COUNTS`: its counts.
- `src/game/blight.ts` → `SPAWN_KINDS`: add it only if the blight should spawn it.
- A foe kind it needs: see `foe.md`.
- Anything that changes an encounter moves balance: `.claude/skills/yomi-balance/`.

## Tests that catch a miss

- `tsc` (`ENCOUNTER_BANDS` and `ENCOUNTER_COUNTS` are full `Record`s).
- `src/game/encounters.test.ts` (each encounter builds, across its band).
- `src/scenes/sounds.test.ts` reads `ENCOUNTERS` (its foes sound).
- `SPAWN_KINDS` is a choice: not enforced; check by hand.
- A change that moves play: `scripts/simulate.test.ts`; see `yomi-balance`.
