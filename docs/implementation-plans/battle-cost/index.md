# Implementation plan: battle cost on the result screen

A won battle's result screen says what the battle cost the party in hit points, measured before the reward's level-up healing. Scene-only: no rule, balance, event, log-schema or save change.

**Source design:** [docs/designs/battle-cost.md](../../designs/battle-cost.md) (approved; Q1 to Q3 settled with the design's recommendations: HP only, no mana; the fallen count in the total, unmarked; heroes listed most-lost first). Planned against `main` at `822988d`.

## Scope and shared constraints

- In scope: R1 to R6. Non-goals: mana, damage dealt, per-round breakdown, a world-map cost line, anything saved.
- Test first. The logic goes in a Phaser-free module with `domain` tests (`src/scenes/*.test.ts` that are not `*Scene.test.ts`). `*Scene.test.ts` are smoke tests only; behaviour is covered by `e2e/` (`npm run test:browser`).
- Imports use explicit `.ts` extensions, `import type` for types, no enums or constructor parameter properties; `tsc` is the lint.
- `LOG_SCHEMA_VERSION` and `SAVE_VERSION` do not change. `describeRewards` (`src/game/party.ts`) is not touched. The simulator's refactor guard is unaffected.
- Commit the finished step on `main` once `npm test` and `npm run test:browser` pass; do not push. End the commit message with the attribution line given to you.
- Keep every `CLAUDE.md` within its size limit (`scripts/claudeMd.test.ts`); detail goes in `docs/reference/`.

## Shared contracts

New `src/scenes/battleCost.ts` (no Phaser import):

```ts
export interface HeroCost { id: UnitId; name: string; lost: number }
export function battleCost(log: BattleEvent[], finalUnits: UnitSnapshot[], names: Record<UnitId, string>): HeroCost[]
export function costLines(costs: HeroCost[], width?: number): string[]   // default width 72
```

## Tasks

| Step | Task | Outcome | Depends on | Status |
| --- | --- | --- | --- | --- |
| 01 | [Battle cost line](01-battle-cost.md) | `battleCost.ts`, its use in `endBattle`, the layout shift, tests, e2e, manual and docs | none | done (0aea703) |

One step; nothing to parallelise.

## Requirement mapping

| Requirement | Task |
| --- | --- |
| R1, R2, R3, R4 | 01 (module, `endBattle`, tests A1, A2, A4, A5) |
| R5 | 01 (`costLines` width, `layout()` shift, tests A3, A6) |
| R6 | 01 (no schema or engine edits; checked by `npm test`) |

## Completion criteria

`npm test` and `npm run test:browser` pass; the manual sentence, retaken screenshots, `docs/reference/scenes.md` and `src/scenes/CLAUDE.md` lines are in the same commit; this index shows step 01 done with its commit hash.

## Open questions

None. Implementers: update the step's status and commit here; record evidence, deviations and blockers in the task file's execution record.
