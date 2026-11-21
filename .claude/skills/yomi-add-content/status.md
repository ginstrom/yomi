# Adding a status

A status is an entry in `STATUSES` (`src/combat/spells.ts`). Touch every line, then run `npm test`.

- `src/combat/spells.ts` → `STATUSES`, `STATUS_IDS`.
- `src/combat/spells.ts` → a `mark` letter and colour.
- `src/combat/spells.ts` → `hostile: true` if a foe lays it to harm (Purify ends it).
- `src/engine/battleEngine.ts` → anything not expressible as a `StatusRule` field needs engine code read through `effectiveStats` / `statsIn` so previews agree.
- A new `StatusRule` field means engine code to apply it; keep it out of the RNG unless it is a roll. Statuses never draw from the RNG.
- `src/engine/policies.ts` → `STATUS_VALUE`, if the policy should value laying it.

## Tests that catch a miss

- `tsc` (full `Record`s keyed by status).
- `src/combat/spells.test.ts` (`STATUS_IDS`).
- `src/engine/policies.test.ts` (the policy snapshot, if `STATUS_VALUE` moves choices; see `yomi-balance`).
