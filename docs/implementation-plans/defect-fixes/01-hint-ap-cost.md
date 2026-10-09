# Step 01: Take the hint's AP cost from the engine (fix 5)

[Index](index.md) · Source design: "Yomi Defect Fixes" canvas, board *Fixes 3–5: battle screen*, <https://claude.ai/artifact/3PhMw4zJFeGPdZn6V6G5Bp>

## Objective

The battle screen's hint text gets the attack cost from the engine's `ATTACK_AP_COST` constant instead of a hard-coded "2 AP", so the hint can't go stale if attacks get cheaper or dearer.

## Requirements and context

- R5: two hint strings in `refreshHighlights` say "(2 AP)". Build both with `ATTACK_AP_COST`.
- The rendered text must not change while `ATTACK_AP_COST` is 2.
- Shared constraints: one commit for this fix only. Battle outcomes and the log format are unchanged.

## Dependencies

None. This is existing code only.

## Scope

- `src/scenes/BattleScene.ts` (inspected):
  - `ATTACK_AP_COST` is exported from `src/engine/battleEngine.ts` (currently `2`). Add it to the existing `import { BattleEngine, formatEvent, ... } from '../engine/battleEngine.ts'`.
  - `refreshHighlights()` (around lines 517–523) has `'Choose a foe to attack (2 AP). Esc or Cancel to go back.'` and `'... Red: attack (2 AP).'`. Change both to template strings that use the constant.
- The comment `/** Move highlights fade as they cost more AP: 1 AP, 2 AP, 3+ AP. */` is about move costs, not attacks. Leave it alone.

## Verification

- The design specifies no automated test. `npm test` (which runs `tsc`) must pass.
- Check by eye, with `npm run dev` or `make run`: select the hero and read the hint. Then press Attack with two foes in reach and read the targeting hint. Both still say "(2 AP)".

## Completion criteria

- [ ] No literal "2 AP" for attacks remains in `BattleScene.ts` (`grep -n "2 AP" src/scenes/BattleScene.ts` shows only the move-highlight comment).
- [ ] `npm test` passes.
- [ ] One commit for fix 5.
- [ ] Index status set to `done`, with the commit hash in the completion log.
