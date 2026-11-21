# Adding an encampment facility

Touch every line, then run `npm test`.

- `src/game/encampment.ts` → `FACILITIES`: an entry.
- `src/game/encampment.ts` → `setFacilityLevel`: a field.
- `src/scenes/EncampmentScene.ts` → `OPENS`: a scene, if it has a screen of its own.
- `src/scenes/encampmentView.ts` → `FACILITY_SPRITES`: sprites `camp_<facility>/level_<n>`. How to draw them: `art/CLAUDE.md`.
- `src/scenes/encampmentView.ts` → a plot, a seventh (six now; `plotAt` falls back to the last plot).
- `docs/manual/README.md` → the encampment screen: update it and retake its screenshots (`yomi-manual` from stage 4).

## Tests that catch a miss

- `tsc` (`FACILITY_SPRITES` is a full `Record`).
- `src/game/encampment.test.ts`.
- The in-browser overlap test in `e2e/encampment.test.ts` checks the labels (`npm run test:browser`).
- `OPENS` is a `Partial`: not enforced; check by hand.
