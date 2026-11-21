# Step 02: the `yomi-balance` skill and the `yomi-measure` agent

- **Index:** [index.md](index.md) · **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) §4.1, §4.3, §4.6, §4.8 · **Log:** [log.md](log.md)
- **Result:** the balance procedure (bands, levers, running the simulator, the guards) lives in `.claude/skills/yomi-balance/`; the measurement job is the `.claude/agents/yomi-measure.md` agent; the scripts, character, engine and game guides keep only contract lines pointing there; the root `CLAUDE.md` and two code comments point to the skill. One `yomi-measure` run proves the agent works.
- **Suggested tiers:** engineer sonnet, reviewer opus. **Touches [Q1].**

## 1. Requirements and context

- **R3:** `yomi-balance` holds the bands, the levers, running and reading the simulator, and the guards. **R4:** `yomi-measure` runs simulations one at a time and returns one table against the bands. **R1 (part):** each section that leaves a guide has a named destination; nothing is dropped. **R10:** this step adds two descriptions to the always-loaded budget, which step 01's test enforces (< 8,500 bytes).
- This is an instructions refactor: no rule, constant or test of play changes. Gathered lines are **moved, not rewritten**; trim only to fit. A line may be added only after confirming it in the code.

### `.claude/skills/yomi-balance/` (design §4.3)

Frontmatter of `SKILL.md`, verbatim:

```yaml
name: yomi-balance
description: Yomi's balance bands, tuning levers, simulator runs and the refactor guard and policy snapshot. Use before changing anything that moves a battle or campaign outcome, or to measure or tune.
```

| File | Contents | Source |
| --- | --- | --- |
| `SKILL.md` (< 4,000 bytes) | When it applies: any outcome change; hero growth; foes, encounters, counts, healing, party limit. The order: measure the baseline → change → re-measure with `yomi-measure` → compare with the bands → re-record the guards if play moved. Links to the four files. | `scripts/CLAUDE.md` intro; `src/character/CLAUDE.md` "Changing hero growth means retuning"; `src/game/CLAUDE.md` last checklist item ("Anything that changes a battle's outcome, a foe or an encounter: re-run the balance cells and campaigns…") |
| `bands.md` **[Q1]** | The bands table with its "Now" column (moved whole from `scripts/CLAUDE.md` "Balance": the measure sentence, the table, the waiting check paragraph, "Also: TL5 … F1 to F3 …; capstones … `--ready-level 12`", path parity with the accepted gaps). The **cell codes**: code → encounter, threat, party level, from the cell table in `docs/implementation-plans/skill-trees/index.md` "Measurement procedure (steps 01, 08, 16, 23, 24, 25)" (GR3 `goblin_raid` 3 L3, BC3/BC4/BC5 `bandit_camp` 3/4/5 at L3/4/5, SN5 `spider_nest` 5 L5, SP5 `salamander_pool` 5 L5, TL5 `troll_lair` 5 L5, SG7/SG10 `source_guardians` 5 at L7/L10, F1–F3 `goblin_raid` 1/2/3 L1). The measure names `yomi-measure` accepts (index C1): `one`, `company`, `rl10`, `rl12`, the cell codes lower-cased (`gr3` … `f3`), `parity-L4`, `parity-L8`, `parity-L14`, `standard` (every row of the bands table), each with the flags it runs. History pointers: the Measurements table of `docs/implementation-plans/skill-trees/index.md`, and each plan's `log.md`. The rule: "The user sets the bands; only the user changes a band. A measuring step updates Now." | `scripts/CLAUDE.md` "Balance"; skill-trees index "Measurement procedure" |
| `running.md` | The common flags (with "every flag in full: `docs/reference/simulator.md`, \"Flags and single battles\""); cells (`--encounter`, `--threat`, `--party-level`, refused with `--campaign`); `--plans` and the parity command; `--campaign`, `--ready-level`, `--parties`, `--waiting`; the campaign paragraph; one run at a time, about 5 minutes and 70 MB for 500 campaigns, `--out logs/<label>-<measure>.jsonl > logs/<label>-<measure>.txt`; the Node 26 PATH prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; **which summary lines carry each figure** (wins of the Source, days, battles, dead, the waiting check, a cell's wins), written by reading the real `.txt` of this step's verification run and, for a cell, one short cell run (`--battles 50`). | `scripts/CLAUDE.md` "Flags", "Campaigns"; stage 7 index `docs/implementation-plans/long-campaign-stage-07/index.md` "Scope and shared constraints", bold lead **Commands** (the Node prefix, own `--out` under `logs/`, never two campaign simulations at once, ~5 min / 70 MB) |
| `levers.md` | "What a tuner needs to know" in full (all five bullets), plus a "When to retune" section: the growth list (creation budgets, skill points or perk points a level, what a node costs, a node, spell or technique, mana, the ready-made party or the plans; also the party limit and healing) and "re-run the guard and the bands, re-record the refactor guard if play moved". | `scripts/CLAUDE.md` "What a tuner needs to know"; `src/character/CLAUDE.md` "Changing hero growth means retuning" |
| `guards.md` | The refactor guard: `scripts/simulate.test.ts`, `describe('the refactor guard')`, 5 campaigns from seed 1 with `--parties 1`, each `CampaignRecord` and a SHA-256 of every battle event against a fixture; re-record only when play is meant to move, with old and new figures in the doc comment above `GUARD_RECORDS`. The guard pattern: steps that must not edit the fixture, one step that re-records it. The **50-campaign check**: `npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt` then `shasum -a 256 logs/guard-50.jsonl`, baseline before the change, "identical" or the diff after. The policy snapshot: `src/engine/policies.test.ts` holds today's encounters' choices; a change that moves a monster's or bandit's choice fails it; re-record only when the change is meant, saying why in the test's title as earlier re-recordings do; the refactor guard usually moves too. | `scripts/CLAUDE.md` "The refactor guard"; stage 7 index "Scope and shared constraints", bold lead **The refactor guard** (and its sub-bullets); `src/engine/CLAUDE.md` "The AI" snapshot paragraph |

Each supporting file is < 8,000 bytes (index C2).

### `.claude/agents/yomi-measure.md` (design §4.6)

Frontmatter (design verbatim, per index C1):

```yaml
name: yomi-measure
description: Runs Yomi's simulator (campaigns, balance cells, parity) one run at a time and returns one table of figures against the user's bands. Use for any balance measurement.
tools: Bash, Read, Grep, Glob
model: sonnet
```

Body (< 6,000 bytes in all):

1. **Input** from the brief: the measures, by name from `bands.md` (`one`, `company`, `rl10`, `rl12`, the cell codes, `parity-L4`/`L8`/`L14`, or `standard`); the seed (default 1) and the count (default 500); a label; extra flags such as `--waiting` or `--plans`.
2. **Before running:** read `.claude/skills/yomi-balance/running.md` and `bands.md`; record `git rev-parse HEAD` and `git status --short`; refuse to start if another `simulate` process is running (`pgrep -f scripts/simulate.ts`), and report that.
3. **Run** each measure in order, never two at once, as `npm run simulate -- … --out logs/<label>-<m>.jsonl > logs/<label>-<m>.txt` (with the Node 26 prefix). In the foreground use a timeout of 600,000 ms. A run that may pass 9 minutes (`rl10`, `rl12`, or any count above 500) is started detached (`nohup npm run simulate -- … > logs/<label>-<m>.txt 2>&1 &`, noting the PID) and waited on in the foreground with `caffeinate -w <PID>` at a 590,000 ms timeout, repeated until the process is gone. Never end the turn while a run is alive.
4. **Read-only:** edit no tracked file; write only under `logs/`.
5. **Return** one table, then the details:

   | Measure | Command flags | Figure | Band | In band | Change from Now |
   | --- | --- | --- | --- | --- | --- |

   After the table: the run times, head SHA and dirty state, the log paths, any run that failed (with its last 20 lines), and nothing else. It interprets nothing beyond "in band / out by N".

### Guide and root edits (design §4.1, §4.8; index C4, C5, exact wording)

| Where | Change |
| --- | --- |
| `scripts/CLAUDE.md` | Intro stays, shortened: what `simulate.ts` and `narration.ts` are, the detail in `docs/reference/simulator.md`. "Flags", "Campaigns" → `running.md`. "Balance" (measure, bands table, waiting check, also-figures, parity, history pointer) → `bands.md`; the guide keeps **[Q1]** "The bands are the user's; never change them. They are in `.claude/skills/yomi-balance/bands.md`." "The refactor guard" stays as the contract "`scripts/simulate.test.ts` holds a hash of the first 5 campaigns' events, so a change that moves play fails it; re-record it only when play is meant to move (`.claude/skills/yomi-balance/guards.md`)." "What a tuner needs to know" → `levers.md`. New contract line: "Run one simulation at a time; its output goes under `logs/`." |
| `src/character/CLAUDE.md` | "Changing hero growth means retuning" section → one line: "A change to hero growth moves balance: `.claude/skills/yomi-balance/` (`levers.md`, \"When to retune\")." The list moves to `levers.md`. |
| `src/engine/CLAUDE.md`, "The AI" | The `policies.test.ts` paragraph → "`policies.test.ts` holds a snapshot of today's encounters' choices: re-record it only when the change is meant (`.claude/skills/yomi-balance/guards.md`)." The procedure moves to `guards.md`. |
| `src/game/CLAUDE.md` | The last Checklists item ("Anything that changes a battle's outcome, a foe or an encounter") is removed from Checklists and becomes a Contracts bullet: "**Balance.** Anything that changes a battle's outcome, a foe or an encounter moves balance: `.claude/skills/yomi-balance/`." Also repoint the intro's "The simulator and the balance figures are in `scripts/CLAUDE.md`" to name the skill for the figures. The other checklists stay for step 04. |
| root `CLAUDE.md` | Balance contract → "**Balance.** Constants are tuned against the user's bands (`yomi-balance` skill); a change that moves play fails the refactor guard (`scripts/simulate.test.ts`)." Subagents gains "Simulator measurements: the `yomi-measure` agent." (the `yomi-asset-check` half is added in step 12). The Architecture table's `scripts/` row stays. |
| `src/game/encounters.ts:194`, `scripts/simulate.ts:12` | "see the rules of scaling in CLAUDE.md" → "see `.claude/skills/yomi-balance/levers.md`". Comments only. |

**[Q1] settled:** the user chose the default (the bands live in `bands.md`).

## 2. Dependencies and prerequisites

- **Step 01** (expected done) produced: `.claude/worktrees/` in `.gitignore`; in `scripts/claudeMd.test.ts` the constants `SKILL_LIMIT_BYTES` 4,000, `SKILL_FILE_LIMIT_BYTES` 8,000, `AGENT_LIMIT_BYTES` 6,000, `DESCRIPTION_LIMIT_BYTES` 260, `ALWAYS_LOADED_LIMIT_BYTES` 8,500, `ABSENT_CONSTANTS`; tests for frontmatter (`name` equals directory or file name, single-line `description`), the always-loaded budget (root bytes + Σ name + description bytes), and name-existence (every backticked UPPER_SNAKE constant occurs in a `.ts` file under `src/`, `scripts/` or `e2e/`; every backticked path starting `src/`, `scripts/`, `art/`, `audio/`, `e2e/`, `docs/` or `.claude/` exists after stripping `:<line>` and `#<anchor>`; spans with `<`, `>`, `*`, `{`, `}` or `…` skipped). These now run against real files: every backticked constant and path you write must exist (`GUARD_RECORDS`, `SOURCE_READY_LEVEL`, `AUTO_PLANS`, `PLAN_IDS`, `FOE_HP_PER_LEVEL`, `MARKET_INCOME`, `ENCOUNTERS` exist today; check others with grep).
- Host: Node 26 at `/opt/homebrew/opt/node@26/bin` (default `node` is 22).

## 3. Scope and implementation guidance

- **Create:** `.claude/skills/yomi-balance/{SKILL,bands,running,levers,guards}.md`, `.claude/agents/yomi-measure.md`. **Edit:** `scripts/CLAUDE.md`, `src/character/CLAUDE.md`, `src/engine/CLAUDE.md`, `src/game/CLAUDE.md`, root `CLAUDE.md`, the two code comments. Nothing else.
- Keep the bands' figures exactly as they stand (no band or "Now" value changes). Keep every other section of those guides unchanged (engine checklists, game's other checklists and the character "Nodes are data" text are step 03/04's).
- Project skill and agent files link by relative path and back-ticked repository paths; a skill points to others by path and never copies them.
- Root `CLAUDE.md` stays ≤ 6,500 bytes.
- **Exclusions:** no `yomi-add-content` files; no change to `docs/reference/`; no edit to `GUARD_RECORDS` or any fixture.

## 4. Verification

- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes (caps, frontmatter, budget, name-existence included).
- **One `yomi-measure` run:** measure `one` with `--battles 50`, label `mc02`. The engineer's brief must authorize this spawn; otherwise stop before it and report, and the orchestrator runs it. If `subagent_type: "yomi-measure"` is refused (agent types created mid-session may not be listed until a new session), spawn a `general-purpose` agent with `model: "sonnet"`, briefed with the agent file's body, and say so in `log.md`. Its outputs: `logs/mc02-one.jsonl` and `logs/mc02-one.txt`. Use that `.txt` (and one 50-battle cell run, e.g. `bc4`) to write `running.md`'s "which summary lines carry each figure".
- **Reviewer check:** the table's Figure equals the summary line in `logs/mc02-one.txt`; the Band column matches `bands.md`; "Change from Now" is figure minus Now (a 50-campaign figure is not comparable to a 500-campaign band, and the agent should say "out by N" without interpretation; the reviewer checks the arithmetic, not the balance).
- Findability for the four trimmed sections: every backticked span and bold lead from the removed text appears in the guide or in `.claude/skills/yomi-balance/` (the full stage-1 check is step 05's).
- `wc -c` of each new file, and the always-loaded total, noted in `log.md`.

## 5. Completion criteria

- [x] Five skill files and the agent file exist, each under its cap, frontmatter exactly as above.
- [x] The four guides, root `CLAUDE.md` and the two comments carry the exact lines in §1; nothing moved was dropped.
- [x] `npm test` passes; one commit `Modular context step 02: the yomi-balance skill and yomi-measure agent`, no attribution lines, staged by path.
- [x] `yomi-measure` run recorded in `log.md` (`## Step 02: …`: date, tiers, verdict, rounds, the table, run time, any fallback used).
- [x] Index: step 02 `done` with its commit.

## 6. Execution record

Done 2026-11-21 (engineer). Created the five skill files and the agent; trimmed the four guides, root and two comments as §1 says. `npx vitest run scripts/claudeMd.test.ts` 15 passed with the new files. `yomi-measure` run and the figures are in `log.md` (the agent type was not listed, so the general-purpose sonnet fallback ran). Deviations: `parity-L14` is the parity command with `--threat 7 --party-level 14`; `parity-L8` is `--encounter hobgoblin_warband --threat 5 --party-level 8` (corrected in review round 1 from a wrong first reading). Heroes dead a campaign is read from the `Guild hall` line. Exception to §3's "no `docs/reference/`" exclusion, by the orchestrator's ruling in review round 1: `docs/reference/simulator.md` line 3 now names `bands.md` for the bands and current figures. `standard` lists its cells explicitly (`tl5` is report-only).
