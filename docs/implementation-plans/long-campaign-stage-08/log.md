# Log: long campaign, stage 8 (trade partners and routes)

Append-only history for [the plan](index.md) and [the feature record](../../features/long-campaign-stage-08.md): baselines and measurements, run histories, review summaries, and anything else the plan accumulates as steps finish. The orchestrator does not read this file on resume.

## Verification

## Step 01: the stage's baseline (2026-11-21)

Measured by the `yomi-measure` agent on a clean worktree at `b28bba1` (no code change since `42cde46`), seed 1, one run at a time. Logs in `logs/s8-base-*` (gitignored).

| Run | Flags | Source wins | Mean days | Battles | Heroes dead | Gold by source (a campaign) |
| --- | --- | --- | --- | --- | --- | --- |
| 50-campaign check | `--campaign --battles 50 --seed 1 --parties 1` | 23 of 50 | — | — | — | — |
| `one` | `--campaign --battles 500 --seed 1 --parties 1` | 239 of 500 | 286 | 19.5 | 1.1 | sites 228, market 0, sales 42 |
| `company` | `--campaign --battles 500 --seed 1` | 239 of 500 | 286 | 19.5 | 1.1 | sites 227, market 0, sales 42 |
| `rl10` | `--campaign --battles 500 --seed 1 --ready-level 10` | 434 of 500 | 509 | 42.1 | 1.0 | sites 406, market 3, sales 144 |

- 50-campaign SHA-256: `1ceefe633e71c0326c0c5b261c77e1c010c49e30303a85286a782589e74400d1`.
- No income line: it prints only with `--waiting`, which the baseline did not pass.
- `rl10` is 434, above its 370–420 band (accepted up to 445), unchanged from the bands' "Now".

## Step 01: after the change

- 50-campaign check on the step's tree: SHA-256 `1ceefe633e71c0326c0c5b261c77e1c010c49e30303a85286a782589e74400d1`, **identical** to the baseline (23 of 50).
- The refactor guard (`scripts/simulate.test.ts`) passes with the fixture untouched.
