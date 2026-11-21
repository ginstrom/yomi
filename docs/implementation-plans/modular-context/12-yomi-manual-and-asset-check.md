# Step 12: the `yomi-manual` skill and the `yomi-asset-check` agent

- **Index:** [index.md](index.md). **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) §4.1 (`e2e` rows), §4.4 (`yomi-manual`), §4.6 (`yomi-asset-check`), §4.8, §8 (stage 4).
- **Stage 4, third step.** Tier: engineer sonnet, reviewer sonnet.

## 1. Objective

Move the player manual's screenshot procedure out of `e2e/CLAUDE.md` into a new project skill, `.claude/skills/yomi-manual/`. Add the `yomi-asset-check` agent (`.claude/agents/yomi-asset-check.md`), which runs the sprite and sound build checks and reports them in one table. Run that agent once on the host.

## 2. Requirements and context

- **R9:** `yomi-manual` and `yomi-asset-check` exist. `e2e/CLAUDE.md` keeps only its contracts.
- **R1:** the moved text keeps a named destination and nothing is dropped. Step 13's findability check covers `e2e/CLAUDE.md` against the stage 4 base (the parent of step 10's first commit).
- **R7 / R10:** the new skill and agent fall under the existing `.claude/` caps (C2 below). Their `name` and `description` count toward the always-loaded budget of 8,500 bytes **[Q3]**.

### `yomi-manual` (design §4.4)

Frontmatter, verbatim:

```yaml
name: yomi-manual
description: Update Yomi's player manual (docs/manual/) when a rule it states or a screen it shows changes, and retake its screenshots. Use after changing a player-facing rule or screen.
```

- `SKILL.md` (< 4,000 bytes):
  - When it applies: a change to a rule the manual states or a screen it shows (the root `CLAUDE.md` Docs line).
  - The manual is one file, `docs/manual/README.md`. Its images live in `docs/manual/images/`.
  - Check that the text still reads true after the change.
  - Link `screenshots.md`.
- `screenshots.md` (< 8,000 bytes):
  - `npm run manual:screenshots` runs under its own config, `vitest.manual.config.ts`. That config plays `e2e/manual.shots.ts`, so neither test run picks the file up.
  - Add a shot with `shot(game, name)` in a new or an existing `it`. It writes `docs/manual/images/<name>.png`.
  - Look at every changed PNG.
  - Commit the images together with the text.
- **Sources** (gather from these and drop nothing):
  - the root `CLAUDE.md` Docs line: "`docs/manual/README.md`: the player's manual; a change to a rule it states or a screen it shows updates it and retakes its screenshots."
  - the end of `e2e/CLAUDE.md`'s last paragraph: "`manual.shots.ts` is not a test: it plays to each screen the player's manual (`docs/manual/`) shows and saves a screenshot. Retake them with `npm run manual:screenshots` (its own config, so neither test run picks it up)."
  - the manual's footnote at the end of `docs/manual/README.md`: "The screenshots are taken from the running game by `npm run manual:screenshots`, which plays through `e2e/manual.shots.ts`. Run it again after changing how a screen looks."
  - the doc comment in `e2e/manual.shots.ts`: "Not a test: plays the game to the screens the manual shows and saves a screenshot of each in docs/manual/images/. Run with `npm run manual:screenshots` after a change to how a screen looks, and check the manual still reads true." Its helper `shot(game, name)` waits 4 frames, then screenshots to `${DIR}/${name}.png`, where `DIR = 'docs/manual/images'`.

### `yomi-asset-check` (design §4.6)

Frontmatter, verbatim:

```yaml
name: yomi-asset-check
description: Runs Yomi's sprite and sound build checks (sprites:check, sounds:check) and reports pass, fail or blocked with the failing ids. Use after changing art/ or audio/, or before a PR.
tools: Bash, Read
model: haiku
```

The body (< 6,000 bytes):

- Check the tools first:
  - `sprite --version`, compared with the pin in `.claude/skills/yomi-sprites/workflow.md` (written in step 10);
  - `uv --version` and `ffmpeg -version`.
  - A missing tool makes its check BLOCKED, not FAIL.
- Run `npm run sprites:check`, then `npm run sounds:check`. A brief may name only one of them.
- Write nothing.
- Return a table (check | result | failing ids or first error line | tool version), then the pin drift, if any.
- Add the Node 26 PATH prefix (`PATH=/opt/homebrew/opt/node@26/bin:$PATH`) to the `npm run` commands. The host's default `node` is 22.

## 3. Dependencies and prerequisites

- **Step 01 (done):** `scripts/claudeMd.test.ts` enforces these caps:
  - `SKILL_LIMIT_BYTES` `4_000`, `SKILL_FILE_LIMIT_BYTES` `8_000`, `AGENT_LIMIT_BYTES` `6_000` and `DESCRIPTION_LIMIT_BYTES` `260`;
  - `ALWAYS_LOADED_LIMIT_BYTES` `8_500` **[Q3]**: root `CLAUDE.md` bytes plus Σ (`name` + `description` bytes) over all skills and agents;
  - frontmatter `name` equals the directory or file name, and `description` is a single line;
  - name-existence: every backticked UPPER_SNAKE constant occurs in a `.ts` file under `src/`, `scripts/` or `e2e/`. Every backticked path starting `src/`, `scripts/`, `art/`, `audio/`, `e2e/`, `docs/` or `.claude/` (with no space) exists, after stripping `:<line>` and `#<anchor>`. Spans with `<`, `>`, `*`, `{`, `}` or `…` are skipped.
- **Step 02 (done):** root `CLAUDE.md` Subagents has "Simulator measurements: the `yomi-measure` agent". The `yomi-asset-check` half was left for this step.
- **Step 08 (done):** `.claude/roles/` profiles exist, each under `ROLE_LIMIT_BYTES` `4_000`.
- **Step 10 (done):** `.claude/skills/yomi-sprites/workflow.md` states the sprite-tool pin. The design says `v0.6.0`; the host has 0.7.0.
- **Step 11 (done):** `.claude/skills/yomi-sound/` exists.
- **Host tools** (inspected): `sprite 0.7.0` at `~/.local/bin/sprite`, `uv` and `ffmpeg` in `/opt/homebrew/bin`. `package.json` defines `sprites:check` (`sprite build --check --project art`) and `sounds:check` (`uv run --project tools/audio yomi-audio sfx check`).

## 4. Scope and implementation guidance

1. **Create `.claude/skills/yomi-manual/SKILL.md` and `screenshots.md`** as in §2. Every backticked path must exist: `docs/manual/README.md`, `docs/manual/images/`, `e2e/manual.shots.ts` and `vitest.manual.config.ts`. A bare `vitest.manual.config.ts` has no checked prefix and is fine.
2. **Create `.claude/agents/yomi-asset-check.md`** as in §2.
3. **Trim `e2e/CLAUDE.md`.**
   - Keep every section (intro, How a test drives the game, Sound, What belongs here, The files) and the last paragraph's file list.
   - Replace only the screenshot procedure with the C4 pointer: "`manual.shots.ts` is not a test; see `.claude/skills/yomi-manual/`."
4. **Root `CLAUDE.md`, Subagents (C5).** Complete the line so that it reads "Simulator measurements: the `yomi-measure` agent; asset checks: `yomi-asset-check`."
   - Leave the Docs line about the manual, the root size and the Commands sentence alone. Step 13 repoints the Commands sentence.
5. **Profiles (optional, only if needed).** Step 08 may have named `yomi-asset-check`, `yomi-manual`, `yomi-sprites` or `yomi-sound` without a path because they did not exist then. If so, add backticked `.claude/…` paths in `.claude/roles/orchestrator.md`, `engineer.md`, `pr-reviewer.md` and `designer.md`. Keep each profile under 4,000 bytes.
6. **`yomi-add-content`.** Search its files for references to the manual or to `e2e/CLAUDE.md`'s screenshot paragraph, such as `facility.md`'s encampment screen. Point them to `.claude/skills/yomi-manual/`.
7. **Renames.** Search the `CLAUDE.md` files and `.claude/` for anything that named the moved paragraph.

**Exclusions:**
- No change to `e2e/manual.shots.ts`, `docs/manual/`, `docs/reference/e2e.md`, any test or game code.
- No change to the directory cap (step 13).
- Don't retake screenshots.

**Moving text:**
- Gathered lines are moved, not rewritten.
- A line may be added only after confirming it in the code.

## 5. Verification

Prefix commands with `PATH=/opt/homebrew/opt/node@26/bin:$PATH` (or use `make test`).

1. `npx vitest run scripts/claudeMd.test.ts`: the caps, frontmatter, budget and name-existence tests pass. Record the always-loaded total.
2. `npm test` passes.
3. **One `yomi-asset-check` run** (design §8, stage 4). This spawn must be authorized in your brief. Without that authorization, stop before this check, and the orchestrator runs it and records the result.
   - Spawn `subagent_type: "yomi-asset-check"` with a brief naming both checks.
   - If the type is refused because a new agent file is not listed until a new session starts, spawn a `general-purpose` agent on `model: haiku`, briefed with the agent file's body. Say so in `log.md`.
   - Expected: both `sprites:check` and `sounds:check` pass, or one is BLOCKED with its reason.
   - Pin drift reported: 0.7.0 against the pin in `workflow.md`, unless step 10 updated the pin.
   - Check the agent's table against running `npm run sprites:check` and `npm run sounds:check` yourself, if time allows.
4. `git diff` shows only the files listed in §4, plus `log.md` and the index.

## 6. Completion criteria

- [ ] `.claude/skills/yomi-manual/SKILL.md` and `screenshots.md` exist with the §2 frontmatter and content, under their caps.
- [ ] `.claude/agents/yomi-asset-check.md` exists with the §2 frontmatter and body, under 6,000 bytes.
- [ ] `e2e/CLAUDE.md` has lost only the screenshot procedure and carries the C4 pointer.
- [ ] The root Subagents line names `yomi-asset-check`.
- [ ] `npm test` passes.
- [ ] `log.md` has a `## Step 12: the yomi-manual skill and the yomi-asset-check agent` section with:
  - the date and tiers;
  - the always-loaded total;
  - the asset-check table (check | result | failing ids or first error line | tool version) and the pin drift;
  - whether the fallback spawn was used.
- [ ] The index shows step 12 `done` with its commit, `Modular context step 12: yomi-manual skill and yomi-asset-check agent`. The commit is on the current branch, not pushed, with no attribution lines.

## 7. Execution record
