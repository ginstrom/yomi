# Adding a one-day action

The contracts stay in `src/game/CLAUDE.md`: a refusal and a time-free apply per module, and `company.ts` calls only those. Touch every line, then run `npm test`.

- Its own module → a refusal (`craftRefusal`, `embedRefusal`, `canBuildTower`, …) and a time-free apply (`applyCraft`, `applyEmbed`, `raiseTower`, …).
- `src/game/expedition.ts` → `DayAction`: a case.
- `src/game/company.ts` → run that case in the day loop, calling only the refusal and the apply.
- `src/game/company.ts` → a convenience over `act`.

## Tests that catch a miss

- `tsc` (the exhaustive `switch` over `DayAction` in `src/game/company.ts` and `src/scenes/partyList.ts` lacks a return for a new case).
- `src/game/company.test.ts`.
- That `company.ts` calls only the refusal and the apply: not enforced; check by hand.
