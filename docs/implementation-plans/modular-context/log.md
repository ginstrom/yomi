# Log: modular context and skills

Append-only history for [the plan](index.md): one `## Step NN: <title>` section per step (date, tiers, verdict, review rounds, commands and results, figures), plus the size tables, findability results and global-skill diffs. The orchestrator does not read this file on resume.

## Step 01: caps and checks for .claude/

- 2026-11-21. Engineer opus; reviewer opus. Verdict: clean; review rounds: 1. Follow-up asked by the orchestrator: indented fences (below).
- `npx vitest run scripts/claudeMd.test.ts`: baseline 2 passed; stubbed helpers 7 of 8 fixture tests failed as expected, the eighth red by mutation; temporary bad `.claude/skills/tmp-bad/SKILL.md` failed the three live checks; final 14 passed.
- `npm test`: tsc clean, 97 test files, 2,406 tests passed.
- `git check-ignore -v .claude/worktrees/x` → `.gitignore:36:.claude/worktrees/`.
- Always-loaded total today: 6,243 bytes (root `CLAUDE.md` alone; no skills or agents), limit 8,500.
- Follow-up, indented fences: `backtickedSpans` now treats a ```` ``` ```` line with leading spaces or tabs (a fence inside a list item) as a fence. New fixture test `skips spans in a fence indented inside a list item`: red first (reported `INDENTED_FENCED` and `src/indented.ts` from inside the fence), then green; `npx vitest run scripts/claudeMd.test.ts` 15 passed.

## Step 02: the yomi-balance skill and yomi-measure agent

- 2026-11-21. Engineer opus (as briefed); reviewer pending. Verdict: pending review; review rounds: 0.
- New files (bytes): `.claude/skills/yomi-balance/` SKILL 1,663, bands 3,817, running 2,902 (before the final edit), levers 1,231, guards 1,252; `.claude/agents/yomi-measure.md` 2,154. Root `CLAUDE.md` 6,294; `scripts/CLAUDE.md` 895 (was 4,377). Always-loaded total checked by `scripts/claudeMd.test.ts`.
- Fallback used: `subagent_type: "yomi-measure"` was refused (agent type created this session), so a `general-purpose` agent at `model: "sonnet"` was briefed with the agent file's body.
- `yomi-measure` run, `one`, seed 1, `--battles 50`, label `mc02` (20 s, head 698b662 plus this step's uncommitted edits; logs `logs/mc02-one.jsonl` and `.txt`):

| Measure | Command flags | Figure | Band | In band | Change from Now |
| --- | --- | --- | --- | --- | --- |
| One party, wins | `--campaign --parties 1 --battles 50 --seed 1` | 23 of 50 | 215 to 250 of 500 | not comparable (about 230 per 500) | 23 against 239 (-216 raw; -9 scaled) |
| Heroes dead a campaign | same | 1.1 | at most 2.0 | yes | 0.0 |
| Days a campaign | same | 294 | 243 to 297 | yes | +8 |
| Battles a campaign | same | 19.7 | none | n/a | +0.2 vs 19.5 |

- A 50-battle cell run by the engineer after it (`bc4`, `logs/mc02-bc4.txt`): `playerWins` 44 of 50; used to write `running.md`.
- Not edited, noted: `docs/reference/simulator.md` line 3 still says `scripts/CLAUDE.md` holds "the balance bands and current figures" (out of scope: no `docs/reference/` change).
