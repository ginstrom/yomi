# Step 06: Score routes by distinct attackers (fix 1)

[Index](index.md) · Source design: "Yomi Defect Fixes" canvas, board *Fixes 1–2: movement*, <https://claude.ai/artifact/3PhMw4zJFeGPdZn6V6G5Bp>

## Before starting

The design leaves it to you whether to land this fix now, because your upcoming movement work may affect it. It recommends landing it now: the change stays inside the route search, and scoring routes by distinct foes is what later routing work, waypoints included, would need anyway. Confirm before starting. If the upcoming work rewrites movement wholesale, skip this step but keep the test case: commit the engine repro test as `it.skip`, or carry it into the new work. Record the choice in the index.

## Objective

Among equally short routes, movement picks the one that provokes the fewest *distinct* foes. Today `reachableHexes` breaks ties by adding up a per-step penalty, which counts zone exits. A foe strikes at most once per turn, so walking along one foe's edge for three hexes scores 3 but costs only one attack.

## Requirements and context

- **Repro (confirmed against commit `f3d2684`).** A 6×5 board. The mover is at `(0,0)` with speed 2 and 2 AP (4 steps of reach). Foes are at `(1,0)` and `(3,1)`. Moving to `(3,0)`, the engine takes `(0,1) (1,1) (2,1) (3,0)` and `previewMove` reports `provokes: [x, y]`, two free attacks. Another route of the same length provokes one.
- **R1, design.** Replace the numeric penalty with the set of foes each step provokes. The grid module stays generic: it deals in string ids and knows nothing about units.

  ```ts
  export function reachableHexes(
    start: Hex,
    maxSteps: number,
    passable: (h: Hex) => boolean,
    /** Ids of whoever is provoked by stepping out of `from`; each counts once per route. */
    provokers: (from: Hex) => readonly string[] = () => [],
  ): Map<string, Hex[]>
  ```
  - Each search entry carries its path and the `Set` of ids it has provoked so far.
  - Within a ring (one path length), a hex keeps every candidate route unless another candidate there has provoked a subset of its foes. If two sets are equal, the route found first wins. Keeping only the cheapest route so far isn't enough: sets don't add up like numbers, so a route that has provoked `{X}` can end up cheaper than one that provoked `{Y}` if the rest of the way runs past X again.
  - The next ring expands every kept candidate.
  - The answer for a hex is its kept candidate with the fewest ids, and the first found on a tie, so today's tie-breaking order is kept. Paths are still shortest, and the start is still excluded.
  - Cost: the routes kept per hex are bounded by the sets of nearby foes where none contains another. With three units and at most 9 hexes of reach, that's a handful. No optimisation is needed.
- **Engine.** `reachable()` passes `(from) => this.reactorsAt(actor, from).map((u) => u.id)`. `move()` and `previewMove()` already count distinct foes and don't change. There is no log schema change, so `LOG_SCHEMA_VERSION` stays 7.
- **Side effects (expected).** Some routes change, so the dice line up differently and old seeds no longer reproduce the same battles.
- Shared constraints: write the tests first and see them fail. One commit. The event shape is unchanged.

## Dependencies

- Steps 02 and 05 also edit `src/engine/battleEngine.ts` (constructor validation and the `MoveEvent.facing` comment). Commit after them to avoid conflicts. There's no functional dependency.
- **Take the simulator baseline before you change any code** (see Verification).

## Scope

- `src/grid/hex.ts` (inspected), `reachableHexes`, around lines 120–157: today it takes `stepPenalty: (from, to) => number` and keeps one `Entry { hex, path, penalty }` per hex per ring. Rewrite it to the contract above and update its doc comment.
- `src/engine/battleEngine.ts` (inspected), `reachable()`, around lines 491–499: swap `(from) => this.reactorsAt(actor, from).length` for the id-returning function above, and keep the doc comment accurate. `reactorsAt` returns `UnitRecord[]` with `id`.
- No other callers: only `battleEngine.ts` and `hex.test.ts` use `reachableHexes`.
- Tests:
  - `src/grid/hex.test.ts`: the existing test `'breaks ties between shortest paths by the lowest step penalty, never taking a longer path'` uses the numeric penalty API. Rewrite it for `provokers` and keep what it checks. Add `'prefers one provoker met three times over two provokers met once each'`: a layout where the shortest route that walks along one id's edge for three steps beats one that touches two different ids once each.
  - `src/engine/battleEngine.test.ts`: add the repro under `BattleEngine zones of control`, with a speed-2, 2-AP mover on a `{ cols: 6, rows: 5 }` board. `previewMove('mover', hex(3, 0))!.provokes` has exactly 1 foe, and stepping the move yields exactly one opportunity attack. The existing test `'routes around zones when an equally short path exists'` must still pass unchanged.

## Verification

1. **Baseline, before any edit** (on the commit before this fix):
   ```
   node scripts/simulate.ts --battles 2000 --seed 1 --out logs/before-aa.jsonl
   node scripts/simulate.ts --battles 2000 --seed 1 --player-policy random --out logs/before-ra.jsonl
   ```
   (or `make simulate ARGS="..."`). Save both summary tables.
2. `npm test`: the new hex and engine tests fail before the change and pass after it. All existing tests pass.
3. **After the change**, run the same two commands with `--out logs/after-*.jsonl`. Expect `playerWins`/`enemyWins` within noise, and `avgOpportunityAttacks` equal or lower. If step 03 has landed, `avgRounds` excludes abandoned battles in both runs, which keeps them comparable. `logs/` is gitignored, so don't commit the output.

## Completion criteria

- [ ] `reachableHexes` takes `provokers` and minimises distinct ids, as specified. `reachable()` passes ids.
- [ ] Hex and engine tests added or rewritten, and seen failing first. "Routes around zones" still passes. `npm test` passes.
- [ ] Before and after simulator tables for both policy pairings recorded in the index's completion log, with the free-attack figures noted.
- [ ] One commit for fix 1.
- [ ] Index status set to `done`, with the commit hash in the completion log.
