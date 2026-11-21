# Step 08: role profiles and their cap

- **Index:** [index.md](index.md) · **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) §4.7, §6 · **Stage:** 3 (first of two) · **Tier:** engineer sonnet, reviewer opus · **Tagged [Q2]**

## 1. Objective

Write the seven project role profiles in `.claude/roles/`, each a short list of what that role needs to know about Yomi, and cap them in `scripts/claudeMd.test.ts`. Step 09 then adds the global hook that makes each role read its profile. This step edits nothing outside the repository.

## 2. Requirements and context

- **R8**: role profiles in `.claude/roles/`; the global hook (step 09) reads `.claude/roles/<role>.md` "at the project root if it exists: the project's notes for this role".
- **R7**: each `.claude/roles/*.md` is capped at `ROLE_LIMIT_BYTES = 4_000` (strict `<`).
- Each profile is **≤ 4 KB**: a list of what the role needs to know about Yomi that the root `CLAUDE.md` does not already say. A profile **points to skills by path and never copies them**. Do not repeat root content (commands table, commit-on-current-branch rule as stated there, architecture contracts, test projects).
- **No `architect.md`**: no Yomi-specific need was found. The step 09 hook is harmless when the file is absent.
- Profiles (design §4.7, restated):

| Profile | Contents | Sources |
| --- | --- | --- |
| `orchestrator.md` | Commit on the current branch, one branch per long-campaign stage. Tier words: "opus" means leave the model unset. Use `yomi-measure` and `yomi-asset-check` instead of general workers for those jobs. Stage designs marked "ready for planning" skip architecture and design (precedent: stages 2–7). Only the user changes a balance band or accepts an out-of-band figure. The global skills are not in git, so back them up before an edit. **Added by this plan:** when briefing an engineer, state in the brief that it may spawn `yomi-measure` and `yomi-asset-check` (and no other agent), because `subagent-rules.md` recognises a grant only in the role file or the brief. | stage 7 record decision log (`docs/features/long-campaign-stage-07.md`); this feature's record decisions; root "Subagents" |
| `designer.md` | Designs go to `docs/designs/`, and long-campaign stages to `docs/designs/long-campaign/` following its `index.md`. A design states its effect on `SAVE_VERSION`, `LOG_SCHEMA_VERSION`, balance (`yomi-balance`), the manual (`yomi-manual`) and assets (`yomi-sprites`, `yomi-sound`), and which test layer covers each rule (domain, scene smoke, e2e). Rules are Phaser-free. | root; stage 7 design conventions (`docs/designs/long-campaign/stage-07-site-improvements-and-markets.md`) |
| `planner.md` | Name in each task file the skill files that apply (e.g. the `spell.md` of `yomi-add-content`); this is how the engineer loads only what it needs. The guard pattern: steps that must not move the fixture, one step that re-records it, the 50-campaign check. A final measuring step uses `yomi-measure`. Commands with the Node 26 PATH prefix (`PATH=/opt/homebrew/opt/node@26/bin:$PATH`). Never two campaign simulations at once. Messages are "<Feature> step NN: title", with no attribution lines. Sprite steps go in a worktree. A docs step covers the CLAUDE.md files, `.claude/`, `docs/reference/` and the manual. Measurement tables go in `log.md`. | stage 7 index "Scope and shared constraints" and "Tasks"; skill-trees index |
| `engineer.md` | Read the skill files your task names. `npm test` before every commit, and `npm run test:browser` after a scene change. You may spawn `yomi-measure` and `yomi-asset-check` (this profile, with the orchestrator's brief, grants it) and no other agent. Search the CLAUDE.md files and `.claude/` for every renamed name. Record measurements in the plan's `log.md`. | stage 7 index; root |
| `reviewer.md` | Check that the guard fixture changed only in the step allowed to change it; that `SAVE_VERSION` and `LOG_SCHEMA_VERSION` were bumped when shapes changed; that no new RNG draw was added (engine guide); that no scene decides an outcome; that the guides and skills are current for renames; that the manual was updated for a player-facing change; and that e2e ran after a scene change. | `src/engine/CLAUDE.md`, `src/scenes/CLAUDE.md` contracts; stage 7 reviews |
| `qa.md` | Run the game: `npm run dev` on 5173 is often the user's. Start your own on another port (`npx vite --port 5180`) and never kill a process you did not start (drop this parenthesis unless the stage 7 record or `docs/implementation-plans/long-campaign-stage-07/log.md` confirms it). `?seed=`; the `~` console (`stock`, `blight`, `days`, `facility`, `fight`); `window.__yomi` probes; the e2e driver as a harness. Use `yomi-measure` for balance claims. Evidence goes in `<git-common-dir>/pr-review/<branch>/evidence/`. | stage 7 record; `docs/reference/scenes.md` "Debug console"; `e2e/CLAUDE.md` |
| `pr-reviewer.md` | There is no CI. The CI equivalent is `npm test`, `npm run build`, `npm run test:browser`, plus `yomi-asset-check` when `art/` or `audio/` changed. These are host-only; say so if missing. | stage 7 PR review line; `package.json` |

- Confirm each fact against its source before writing it (e.g. the debug commands exist in `src/scenes/debugCommands.ts` `COMMANDS`; the long-campaign designs index exists). Drop a fact you cannot confirm and say so in the execution record.

## 3. Dependencies and prerequisites

- **Steps 01–07 done.** From them (expected to exist; check):
  - `scripts/claudeMd.test.ts` (step 01) with `SKILL_LIMIT_BYTES`, `SKILL_FILE_LIMIT_BYTES`, `AGENT_LIMIT_BYTES`, `DESCRIPTION_LIMIT_BYTES`, `ALWAYS_LOADED_LIMIT_BYTES`, `ABSENT_CONSTANTS` and the name-existence test. Its scope rule: read only `.claude/skills/*/` (recursively, `.md`), `.claude/agents/*.md` and `.claude/roles/*.md`; never walk `.claude/` itself; a missing directory is an empty list. Step 01 does not read `.claude/roles/`; this step adds it to the name-existence scope (see §4).
  - `.claude/skills/yomi-balance/` (`SKILL.md`, `bands.md`, `running.md`, `levers.md`, `guards.md`) and `.claude/agents/yomi-measure.md` (step 02); `.claude/skills/yomi-add-content/` and its 19 files (steps 03–04); the root "Keeping these files current" table (step 05); `scripts/records.test.ts` and the `log.md` shape (steps 06–07).
- **Not yet existing** (stage 4): `yomi-sprites`, `yomi-sound`, `yomi-manual` (steps 10–12) and `.claude/agents/yomi-asset-check.md` (step 12). The name-existence test fails on a backticked `.claude/…` path that does not exist. So **name these four by their bare name only** (`yomi-asset-check`, `yomi-sprites`, …, which are not path spans), never as `.claude/skills/yomi-sprites/` or `.claude/agents/yomi-asset-check.md`. Steps 10–12 may add their paths to the profiles. Existing skills (`yomi-balance`, `yomi-add-content`, `yomi-measure`) may be named by path.
- Backticked UPPER_SNAKE constants (`SAVE_VERSION`, `LOG_SCHEMA_VERSION`) must occur in `src/`, `scripts/` or `e2e/` `.ts` files; they do.
- **[Q2] settled (default):** the global orchestrator carries the verification-line rule after step 07, so `orchestrator.md` does not repeat it.

## 4. Scope and implementation guidance

- **Create** (proposed paths): `.claude/roles/orchestrator.md`, `designer.md`, `planner.md`, `engineer.md`, `reviewer.md`, `qa.md`, `pr-reviewer.md`. No frontmatter is needed (profiles are not skills or agents). Start each with a one-line heading such as `# Yomi notes for the engineer`, then a terse bullet list.
- **Extend** `scripts/claudeMd.test.ts` (inspected; extended in 01):
  - add `const ROLE_LIMIT_BYTES = 4_000` with the other constants;
  - add a test "keeps each role profile under its size limit" over `.claude/roles/*.md` (a missing directory is an empty list), failing with the list of `{ file, bytes }` at or over the limit;
  - add `.claude/roles/*.md` to the name-existence test's scope, with a fixture red case (a profile naming a missing `src/…` path and an unknown UPPER_SNAKE constant).
- **Red first**: write the test, then confirm it fails by temporarily creating an oversized `.claude/roles/` file (≥ 4,000 bytes); delete it, then write the real profiles.
- Do not touch the global skills (step 09), the root `CLAUDE.md`, or any directory guide. Do not copy skill content into a profile; link it.
- Keep every profile well under 4,000 bytes; aim for 1–2.5 KB.

## 5. Verification

- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npx vitest run scripts/claudeMd.test.ts`: the new role cap test failed on the temporary oversized file, then passes; the name-existence test passes over the profiles.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes.
- `wc -c .claude/roles/*.md`: each under 4,000; record the sizes in `log.md`.
- `grep -n '\.claude/\(skills/yomi-\(sprites\|sound\|manual\)\|agents/yomi-asset-check\)' .claude/roles/*.md` returns nothing.
- Check by eye: no profile restates a root `CLAUDE.md` fact or copies a skill's text.

## 6. Completion criteria

- [ ] Seven profiles exist with the contents above (no `architect.md`), each < 4,000 bytes.
- [ ] `ROLE_LIMIT_BYTES` and its test in `scripts/claudeMd.test.ts`, seen failing first.
- [ ] `orchestrator.md` tells the orchestrator to grant `yomi-measure`/`yomi-asset-check` spawns in engineer briefs; [Q2] handled per the user's answer.
- [ ] `npm test` passes; one commit `Modular context step 08: role profiles`, no attribution lines, files staged by path.
- [ ] Index: step 08 `done` with its commit; `log.md`: a `## Step 08: role profiles` section (date, tiers, verdict, rounds, commands, profile sizes).

## 7. Execution record
