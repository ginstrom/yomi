# Step 01: caps and checks for `.claude/`

- **Index:** [index.md](index.md) · **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) §4.8 (`.gitignore`), §6 (size-cap tests), §7 (budget) · **Log:** [log.md](log.md)
- **Result:** `.claude/worktrees/` is gitignored, and `scripts/claudeMd.test.ts` caps every project skill, skill file and agent, checks their frontmatter, enforces the always-loaded budget and fails on a stale constant or path in `.claude/`. All before any `.claude/` file exists, so later steps are held to the caps from their first commit.

## 1. Requirements and context

- **R7** (size-cap tests): skills, agents, descriptions, the always-loaded budget, and the name-existence check land here. Role caps come in step 08; the directory cap drops to 8,000 in step 13.
- **R10**: the always-loaded cost (root `CLAUDE.md` + every skill's and agent's `name` and `description`) is capped. **[Q3]** The cap is 8,500 bytes. This is the user's open question 3, planned on its default. If the user picks another ceiling, only `ALWAYS_LOADED_LIMIT_BYTES` changes.
- Design §3: `.claude/` holds only `worktrees/`, which is not gitignored. Agent worktrees are whole repository copies (for example `.claude/worktrees/agent-…`), so **no test may walk `.claude/` recursively**.
- The existing test (inspected) caps the root at `< 16_000` and each directory `CLAUDE.md` at `< 12_000`. Its `claudeFiles` walk skips dot-directories and `node_modules`, `.git`, `dist`, `logs`, `.vitest`. Keep both tests and the walk unchanged.
- Its header comment says the CLAUDE.md files are loaded into context and that you move detail rather than raise a limit. Extend it to cover skills, agents and (later) role profiles. The rule stays the same: when a cap fails, move detail out; never raise the cap.

## 2. Dependencies and prerequisites

- None. This is the first step.
- **Existing:** `scripts/claudeMd.test.ts`, `.gitignore`, and the `domain` vitest project (`scripts/**/*.test.ts`, Node environment).
- **Uncommitted files this step carries:** `docs/designs/modular-context.md`, `docs/features/modular-context.md` and the whole `docs/implementation-plans/modular-context/` folder are untracked. Commit them with this step, staged by path. Leave every other uncommitted change alone, and stop and report if one overlaps this step's files.
- **Produces for later steps:** the constants and rules below (contract C2). Steps 02–04 and 10–12 add files the tests read. Step 08 adds `ROLE_LIMIT_BYTES` and the roles scope. Step 13 lowers `DIRECTORY_LIMIT_BYTES`.

## 3. Scope and implementation guidance

### `.gitignore`

Add `.claude/worktrees/` (with a short comment, for example "agent worktrees"). This must land before anything under `.claude/` is committed.

### `scripts/claudeMd.test.ts`: contract C2 (copied from the index, unchanged)

Constants at the top, with the existing comment extended:

| Constant | Value | Applies to |
| --- | --- | --- |
| `ROOT_LIMIT_BYTES` | `16_000` | root `CLAUDE.md` (existing, unchanged) |
| `DIRECTORY_LIMIT_BYTES` | `12_000` | each directory `CLAUDE.md` (existing, unchanged here; step 13 lowers it to `8_000`) |
| `SKILL_LIMIT_BYTES` | `4_000` | each `.claude/skills/*/SKILL.md` |
| `SKILL_FILE_LIMIT_BYTES` | `8_000` | every other `.md` in a skill directory |
| `AGENT_LIMIT_BYTES` | `6_000` | each `.claude/agents/*.md` |
| `DESCRIPTION_LIMIT_BYTES` | `260` | each skill's and agent's `description` |
| `ALWAYS_LOADED_LIMIT_BYTES` | `8_500` **[Q3]** | root `CLAUDE.md` bytes + Σ over skills and agents of (bytes of `name` + bytes of `description`) |
| `ABSENT_CONSTANTS` | `new Set<string>()` | allow-list for the name-existence test |

Do **not** add `ROLE_LIMIT_BYTES` (`4_000`, step 08). Write the file readers so that adding `.claude/roles/*.md` later is one more list. Step 08 adds the roles scope to the cap and name-existence tests. Roles have no frontmatter and are not in the budget.

All limits are strict (`<`). Rules:

- **Scope.** Read only:
  - `.claude/skills/*/` (recursively, `.md` files only);
  - `.claude/agents/*.md`.

  Never walk `.claude/` itself. A missing directory is an empty list, so every test passes before any file exists.
- **Frontmatter.** The block between a leading `---` line and the next `---` line, parsed as `key: value` lines. Add no YAML dependency.
  - `name` equals the skill's directory name, or the agent's file name without `.md`.
  - `description` is a single line: the line after it is another `key:` line or the closing `---`.
  - A skill's frontmatter is in its `SKILL.md`. A missing frontmatter, `name` or `description` is a failure.
- **Description length.** `Buffer.byteLength(description) < DESCRIPTION_LIMIT_BYTES`.
- **Budget.** `bytes(root CLAUDE.md) + Σ (bytes(name) + bytes(description)) < ALWAYS_LOADED_LIMIT_BYTES`.
  - Print or expose the total in the failure message, so later steps can record it in `log.md`.
  - Today the total is 6,243 bytes, the root file alone.
- **Name-existence.** In every file read above, check each backticked span (single backticks, inline):
  - **Constants.** An UPPER_SNAKE constant (`/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/`) must occur as a word in a `.ts` file under `src/`, `scripts/` or `e2e/`, or be in `ABSENT_CONSTANTS`. Read those trees once per run. Skip `node_modules`, the same way the existing walk does.
  - **Paths.** A repository path (it starts with `src/`, `scripts/`, `art/`, `audio/`, `e2e/`, `docs/` or `.claude/`, and contains no space) must exist relative to the root, after stripping a trailing `:<line>` and a trailing `#<anchor>`.
  - **Placeholders.** Skip any span containing `<`, `>`, `*`, `{`, `}` or `…`.
- **Failures list the offenders** (file, and the span or byte count), not just a count. Use `toEqual([])` on a list of offenders, as the existing directory test does.

The engineer settles routine choices (helper names, `it` titles, how fenced code blocks are treated). A reasonable choice is to ignore spans inside fenced blocks, or to check them too. Say which in the execution record.

### Proving the checks red

No `.claude/skills/` or `.claude/agents/` exists yet, so every new test passes vacuously. Prove each check fails for the right reason. Either:

- factor each check into a helper that takes a root directory, and add tests that run it on a scratch fixture tree (for example under `os.tmpdir()`, created and removed by the test). This is preferred, as the checks then stay tested; or
- temporarily add bad files under `.claude/`, see each test fail, then delete them before committing.

Cover each of these:

- an oversize `SKILL.md`;
- an oversize supporting file;
- an oversize agent;
- a `name` that differs from its directory or file;
- a multi-line description;
- a description of 260 bytes or more;
- a budget overrun;
- an unknown UPPER_SNAKE constant;
- a missing path;
- a placeholder path that is skipped;
- a `:<line>`-suffixed path that passes.

Any fixture tree lives outside the repository, or is removed in `afterAll`. Nothing temporary may be committed.

### Exclusions

- No `.claude/` content files: those start in step 02.
- No change to the root or directory `CLAUDE.md` files.
- No `records.test.ts`: that is step 06.
- No global-skill edits.

## 4. Verification

The host's default `node` is 22. Prefix every command with `PATH=/opt/homebrew/opt/node@26/bin:$PATH` (or use `make test`).

- `npx vitest run scripts/claudeMd.test.ts`: every test passes, and the red cases above failed before their code existed (record each in the execution record).
- `git check-ignore -v .claude/worktrees/x` names the new `.gitignore` line.
- `git status --short` shows nothing under `.claude/worktrees/`.
- `npm test` (`tsc && vitest run`) passes. `tsc` is the lint step (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`: `import type` for types).
- No simulation, browser test or build is needed. No game code changes.

## 5. Completion criteria

- [ ] `.gitignore` ignores `.claude/worktrees/`.
- [ ] `scripts/claudeMd.test.ts` has the C2 constants (bar `ROLE_LIMIT_BYTES`) and the scope, frontmatter, budget and name-existence rules, each shown red once.
- [ ] `npm test` passes.
- [ ] One commit, `Modular context step 01: caps and checks for .claude/`, with no attribution lines. It is on the current branch (`long-campaign-stage-07`), not pushed, and staged by path. It includes the design, the feature record and the plan folder.
- [ ] Index: step 01 `done` with its commit hash.
- [ ] `log.md`: a `## Step 01: caps and checks for .claude/` section (contract C7), with the date, tiers, verdict, review rounds, commands and results, and the budget total today (6,243 bytes).
- [ ] Execution record below: the red cases, the fenced-block choice, and anything later steps need. For example: how to read the budget total, and where step 08 adds roles.

## 6. Execution record

- **2026-11-21, engineer (opus).** Node 26 (`PATH=/opt/homebrew/opt/node@26/bin:$PATH`) for every command.
- **Baseline:** `npx vitest run scripts/claudeMd.test.ts`: 2 passed.
- **Built:** `.gitignore` gains `.claude/worktrees/` (with an "Agent worktrees" comment). `scripts/claudeMd.test.ts` gains the C2 constants bar `ROLE_LIMIT_BYTES`, the extended header comment, four live tests on the repository (`.claude/ skills and agents`) and eight fixture tests (`the .claude/ checks, on a fixture tree`) that run the same helpers (`oversizeFiles`, `frontmatterProblems`, `alwaysLoadedBytes`, `staleNames`, each taking a root) on trees under `os.tmpdir()`, removed in `afterAll`.
- **Red, shown before the code existed** (helpers stubbed to return nothing / 0): 7 of the 8 fixture tests failed for the expected reason (no offenders reported, budget 0): an oversize `SKILL.md`, supporting file and agent; a mismatched name (skill and agent); missing frontmatter, `name`, `description` or `SKILL.md`; a multi-line description and one of 260 bytes (259 passes); a budget overrun (root 8,480 + 20 bytes of names and descriptions); an unknown UPPER_SNAKE constant; missing paths (`src/`, `docs/…:4`, `e2e/`), while placeholder spans (`<…>`, `*`, `{…}`, `…`), spans with a space, `:<line>`- and `#anchor`-suffixed existing paths and `ABSENT_CONSTANTS` members pass. The eighth (`never reads .claude/ outside skills and agents`) was shown red by mutation: with `projectFiles` walking `.claude/` recursively it failed on a fixture `.claude/worktrees/agent-1/…` file; restored. The live wiring was shown red with a temporary `.claude/skills/tmp-bad/SKILL.md` (4,094 bytes, name `wrong`, two-line description, `` `NO_SUCH_CONSTANT` ``, `` `src/nope.ts` ``): the size, frontmatter and name tests failed, each listing file and problem; the file was deleted (`.claude/` holds only `worktrees/` again).
- **Green:** `npx vitest run scripts/claudeMd.test.ts`: 14 passed. `npm test`: tsc clean, 97 files, 2,406 tests passed. `git check-ignore -v .claude/worktrees/x` → `.gitignore:36:.claude/worktrees/` (before the change it matched only the local, uncommitted `.git/info/exclude:11:**/.claude/worktrees/`). `git status --short` shows nothing under `.claude/`.
- **Choices:** spans inside fenced code blocks (```` ``` ```` lines) are **not** checked; only inline single-backtick spans in prose are. A constant counts as present if it occurs as a word (`\b[A-Z][A-Z0-9_]*\b`) in any `.ts` file under `src/`, `scripts/` or `e2e/` (skipping `SKIP` directories). Path suffixes stripped: a trailing `#anchor`, then a trailing `:<line>` or `:<line>-<line>`. A skill directory without `SKILL.md` is a frontmatter failure. Offenders are sorted by file (skills, then agents), spans in order of appearance.
- **For later steps:** the budget total is in the live test's title, so `npx vitest run scripts/claudeMd.test.ts --reporter=verbose` prints it ("… under 8500 bytes (now 6243)"), and in the failure message. Step 08 adds roles where the comment above `subdirectories` says: a `roleFiles = root => markdownFiles(join(root, '.claude', 'roles'), false)` list, added to `projectFiles` (name-existence) and to `oversizeFiles`' limit choice with `ROLE_LIMIT_BYTES`; not to `described` (no frontmatter, not in the budget). Step 13 changes only `DIRECTORY_LIMIT_BYTES`.
- **Deviation:** the index's Commits cell is filled by a second commit (`Modular context step 01: the index names its commit`), as stage 7 step 07 did, since a commit cannot name its own hash.
