# Adding a battle event kind or changing an event's shape

Events are the engine's only output and the log format. Touch every line, then run `npm test`.

- `src/engine/battleEngine.ts` → bump `LOG_SCHEMA_VERSION` for any event shape change.
- `src/engine/battleEngine.ts` → update `formatEvent`; keep its on-screen line short and put detail in the event.
- `src/scenes/sounds.ts` → check `eventSounds`; `src/scenes/sounds.test.ts` fails on an event kind that sounds nothing without an entry saying so.
- `src/scenes/eventSchedule.ts` → the battle playback.
- `src/scenes/battleEffects.ts` → effects; a battle event that changes statuses on screen needs `changesStatusMarks`.
- A new field on `UnitRecord` or the snapshot is a save-shape change (raise `SAVE_VERSION`).

## Tests that catch a miss

- `tsc` (the `BattleEvent['type']` record in `src/scenes/sounds.test.ts`).
- `src/scenes/sounds.test.ts`.
- `scripts/simulate.test.ts` (the refactor guard, when the log moves).
