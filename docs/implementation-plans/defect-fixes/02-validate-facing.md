# Step 02: Validate starting facing (fix 6)

[Index](index.md) · Source design: "Yomi Defect Fixes" canvas, board *Fixes 6, 7, 9*, <https://claude.ai/artifact/3PhMw4zJFeGPdZn6V6G5Bp>

## Objective

`BattleEngine`'s constructor rejects a unit whose starting facing isn't a valid direction index. Today the value is used as given: a facing like 7, −1 or 2.5 makes `attackArc` call every attack on that unit frontal, with no error.

## Requirements and context

- R6: validate `UnitSetup.facing` alongside the constructor's existing roster checks. The design gives this check:

  ```ts
  const facing = u.facing ?? DEFAULT_FACING[u.side]
  if (!Number.isInteger(facing) || facing < 0 || facing >= HEX_DIRECTIONS.length) {
    throw new Error(`${u.id} faces an unknown direction: ${facing}`)
  }
  ```
- Valid facings are the integers 0–5, which index `HEX_DIRECTIONS` in `src/grid/hex.ts`. A missing facing still defaults to `DEFAULT_FACING[side]`.
- Shared constraints: write the test first and see it fail. One commit. Battle outcomes and the log format are unchanged for valid rosters.

## Dependencies

None. This is existing code only.

## Scope

- `src/engine/battleEngine.ts` (inspected): the constructor, around lines 268–291, already throws on duplicate ids, a missing side, off-board starts and shared hexes. Add the facing check in that validation block, before `this.units` is built. `HEX_DIRECTIONS` is not imported in this file yet; add it to the existing import from `../grid/hex.ts`. `DEFAULT_FACING` is defined in this file.
- `src/engine/battleEngine.test.ts` (inspected): extend `it('rejects bad rosters: duplicate ids, a missing side, shared or off-board hexes', ...)` (around line 101). Add cases for facings `6`, `-1` and `1.5`, for example `setup([WARRIOR, { ...GOBLIN, facing: 6 }])`, each expected to throw `/unknown direction/`. Update the test's title to mention facing.

## Verification

- `npm test`: the new assertions fail before the constructor change and pass after it. Every other test still passes.

## Completion criteria

- [x] Facings 6, −1 and 1.5 are rejected with a clear message. Omitted and valid facings still work.
- [x] The test was seen failing first. `npm test` passes.
- [x] One commit for fix 6.
- [x] Index status set to `done`, with the commit hash in the completion log.
