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

- 2026-11-21. Engineer opus (as briefed); reviewer opus. Verdict: changes needed in round 1, fixed in the follow-up commit; review rounds: 1.
- New files (bytes): `.claude/skills/yomi-balance/` SKILL 1,663, bands 3,817, running 2,902, levers 1,231, guards 1,252; `.claude/agents/yomi-measure.md` 2,154. Root `CLAUDE.md` 6,294; `scripts/CLAUDE.md` 895 (was 4,377). Always-loaded total checked by `scripts/claudeMd.test.ts`.
- Fallback used: `subagent_type: "yomi-measure"` was refused (agent type created this session), so a `general-purpose` agent at `model: "sonnet"` was briefed with the agent file's body.
- `yomi-measure` run, `one`, seed 1, `--battles 50`, label `mc02` (20 s, head 698b662 plus this step's uncommitted edits; logs `logs/mc02-one.jsonl` and `.txt`):

| Measure | Command flags | Figure | Band | In band | Change from Now |
| --- | --- | --- | --- | --- | --- |
| One party, wins | `--campaign --parties 1 --battles 50 --seed 1` | 23 of 50 | 215 to 250 of 500 | not comparable (about 230 per 500) | 23 against 239 (-216 raw; not comparable) |
| Heroes dead a campaign | same | 1.1 | at most 2.0 | yes | 0.0 |
| Days a campaign | same | 294 | 243 to 297 | yes | +8 |
| Battles a campaign | same | 19.7 | none | n/a | +0.2 vs 19.5 |

- A 50-battle cell run by the engineer after it (`bc4`, `logs/mc02-bc4.txt`): `playerWins` 44 of 50; used to write `running.md`.
- Not edited, noted: `docs/reference/simulator.md` line 3 still says `scripts/CLAUDE.md` holds "the balance bands and current figures" (out of scope: no `docs/reference/` change).
- Review round 1 (opus): changes needed. Fixed: `parity-L8` is `--encounter hobgoblin_warband --threat 5 --party-level 8 --plans <role>=<plan>`; `docs/reference/simulator.md` line 3 repointed to `bands.md` (orchestrator's exception to the no-`docs/reference/` rule); `standard` lists its cells explicitly without `tl5`; checklist ticked; this record corrected.
- Review round 2 (opus): changes needed. Fixed: `parity-L14` spelled out in full as `--encounter bandit_camp --threat 7 --party-level 14 --plans <role>=<plan>`, since "the same with" now read as the Warband row above it.

## Step 03: yomi-add-content, the battle content

- Date 2026-11-21. Tiers: engineer sonnet, reviewer sonnet. Verdict: clean (review sonnet, 1 round; three accuracy nits fixed in a follow-up commit: SKILL.md guides sentence, element.md catches, battle-event.md catch scope). Rounds: 1.
- Files: `.claude/skills/yomi-add-content/` `SKILL.md` 1,576 bytes (cap 4,000); `spell.md` 1,330; `status.md` 929; `ability.md` 1,219; `trait.md` 1,165; `element.md` 478; `skill-node.md` 1,007; `battle-event.md` 985 (cap 8,000 each).
- Guides after: `src/engine/CLAUDE.md` 5,246; `src/combat/CLAUDE.md` 2,576; `src/character/CLAUDE.md` 5,485; `src/scenes/CLAUDE.md` 6,011. Root 6,294.
- `npm test`: tsc clean; 97 files, 2407 tests passed.
- Moved-line self-check (scratch script: every backticked span and bold lead of `git show HEAD:<guide>` for the four guides, looked up verbatim in the new guide or the content files). Missing: the bold leads `A new spell`, `A new status`, `A new ability`, `A new trait`, `A new element`, `Any event shape change` (engine) and `An ability:`, `A spell:`, `A battle event that changes statuses on screen:` (scenes). Justified: they are headings of moved items, replaced by each content file's title; every backticked span of those items is present in the content files.

## Step 04: yomi-add-content, the world content files

- Date 2026-11-21. Tiers: engineer sonnet, reviewer sonnet. Review rounds: 1 (sonnet; changes needed, fixed in a follow-up commit: `docs/reference/game.md` line 3 repointed and six overclaimed catch lines reworded).
- Files: twelve new content files in `.claude/skills/yomi-add-content/` (350 to 1,122 bytes each); `SKILL.md` 2,344 bytes (cap 4,000).
- Guides after: `src/game/CLAUDE.md` 7,554; `src/scenes/CLAUDE.md` 4,837; `src/inventory/CLAUDE.md` 2,925; `src/story/CLAUDE.md` 1,223.
- `npm test`: tsc clean; 97 files, 2407 tests passed. Ledger, dropped duplicate and deviations: the execution record of `04-add-content-world.md`.

