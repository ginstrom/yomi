# Adding an encampment facility

Touch every line, then run `npm test`.

- `src/game/encampment.ts` → `FACILITIES`: an entry.
- `src/game/encampment.ts` → `setFacilityLevel`: a field.
- `src/scenes/EncampmentScene.ts` → `OPENS`: a scene, if it has a screen of its own.
- `src/scenes/encampmentView.ts` → `FACILITY_SPRITES`: sprites `camp_<facility>/level_<n>`. How to draw them: `.claude/skills/yomi-sprites/`.
- A new level of an existing facility: its cost row (the workshop's is `WORKSHOP_COSTS` in `src/game/crafting.ts`), its effect line, and a frame `camp_<facility>/level_<n>` in `FACILITY_SPRITES` (the stage is not done while one falls back to a placeholder).
- `src/scenes/encampmentView.ts` → a plot, a seventh (six now; `plotAt` falls back to the last plot).
- `docs/manual/README.md` → the encampment screen: update it and retake its screenshots (`.claude/skills/yomi-manual/`).

## Tests that catch a miss

- `tsc` (`FACILITY_SPRITES` is a full `Record`).
- `src/game/encampment.test.ts`.
- The in-browser overlap test in `e2e/encampment.test.ts` checks the labels (`npm run test:browser`).
- `OPENS` is a `Partial`: not enforced; check by hand.
