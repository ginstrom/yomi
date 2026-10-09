# Step 03: Average rounds over decided battles (fix 7)

[Index](index.md) · Source design: "Yomi Defect Fixes" canvas, board *Fixes 6, 7, 9*, <https://claude.ai/artifact/3PhMw4zJFeGPdZn6V6G5Bp>

## Objective

The simulator's `avgRounds` averages only battles that ended with a winner. Right now `summarize` adds every `battle_end` round to the total, including battles abandoned at `--max-rounds` (default 200), and then divides by all battles. In random-player runs, each abandoned battle adds 200 rounds and skews the average.

## Requirements and context

- R7:
  - Count rounds only for `battle_end` events with a non-null `winner`. Divide by `playerWins + enemyWins`, and use 0 when there are none.
  - The key keeps its name, `avgRounds`. Its doc comment in the `Summary` interface says abandoned battles are counted under `unresolved` and left out of this average.
  - Make the script testable: export `summarize`, and run `main()` only when the file is executed directly, with `if (import.meta.main) main()`. Node 26.8.1 here returns `true` for `import.meta.main`, and `@types/node` declares it in `web-globals/importmeta.d.ts`.
  - Test: a new `scripts/simulate.test.ts`. Two decided battles of 3 and 5 rounds plus one abandoned at round 200 should give `avgRounds` 4.
- Other `Summary` fields keep their current meaning, so per-battle averages still divide by all battles.
- Shared constraints: write the test first and see it fail. One commit. The engine and the log format are unchanged.

## Dependencies

None. This is existing code only.

## Scope

- `scripts/simulate.ts` (inspected):
  - `summarize(events: LoggedEvent[], battles: number): Summary` (around lines 124–183) adds to `totalRounds` for every `battle_end` and returns `avgRounds: totalRounds / battles`. Change it as described above.
  - `LoggedEvent` (`BattleEvent & { battleId: number }`) isn't exported. Export it, or build test events another way; that's your choice.
  - The last line is a bare `main()`. Change it to `if (import.meta.main) main()`.
- `scripts/simulate.test.ts` (new). `vitest.config.ts` already includes `scripts/**/*.test.ts` in the Node `domain` project, and `tsconfig.json` includes `scripts`. Build minimal `battle_start` and `battle_end` events with the fields `summarize` reads. `battle_end` has `type`, `round`, `winner` (`'player' | 'enemy' | null`) and `reason`; see `BattleEndEvent` in `src/engine/battleEngine.ts`.

## Verification

- `npm test`: the new test fails first (today's code gives (3 + 5 + 200) / 3 ≈ 69.3) and then passes with 4.
- Importing the test must not run a simulation or write `logs/battles.jsonl`. Check that no file is written during `npm test`.
- `node scripts/simulate.ts --battles 50 --seed 1` still prints the summary table, because running the file directly still calls `main()`.

## Completion criteria

- [x] `avgRounds` covers decided battles only, and its doc comment says so.
- [x] `summarize` is exported, `main()` is guarded, and the CLI still works.
- [x] `scripts/simulate.test.ts` was seen failing first. `npm test` passes.
- [x] One commit for fix 7.
- [x] Index status set to `done`, with the commit hash in the completion log.
