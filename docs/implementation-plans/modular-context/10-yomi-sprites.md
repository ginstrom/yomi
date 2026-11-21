# Step 10: the `yomi-sprites` skill

- **Plan:** [index.md](index.md) · **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) §4.1 (the `art` rows), §4.4 · **History:** [log.md](log.md)
- **Stage 4, first step.** Stage 4 base = the parent of this step's first commit. Record that SHA in `log.md`; step 13 runs the findability check against it.
- **Suggested tier:** sonnet engineer, sonnet reviewer.

## 1. Objective

Move the sprite-tool workflow out of `art/CLAUDE.md` into a new project skill, `.claude/skills/yomi-sprites/`, which loads only when someone draws a sprite. `art/CLAUDE.md` keeps only its contracts plus one pointer line. The `yomi-add-content` files that point to `art/CLAUDE.md` for a sprite step now point to the skill.

## 2. Requirements and context

- **R1:** a directory `CLAUDE.md` holds contracts only. Every section that moves has a named destination, and nothing is dropped except what the design drops.
- **R9:** the `yomi-sprites` skill exists, and `art/` keeps only its contracts.
- **R10:** the always-loaded budget (root `CLAUDE.md` + every skill and agent `name` + `description`) stays under `ALWAYS_LOADED_LIMIT_BYTES` (8,500, **[Q3]**). This skill's name and description add about 190 bytes.
- **Moving text.** Move gathered lines without rewriting them. Trim them only to fit the new file's format. Add a line only after confirming it in the code or the tool (`sprite guide --project art`).
- **No source edits.** Change no file under `art/` except `art/CLAUDE.md`, and nothing under `public/assets/sprites/`. The 28 `art/gear/*.sprite.toml` files have header comments that say "see art/CLAUDE.md". Leave them alone, because editing a source can make `sprites:check` stale. The pointer line kept in `art/CLAUDE.md` (below) serves those comments.

### The skill (design §4.4)

Frontmatter of `.claude/skills/yomi-sprites/SKILL.md`, verbatim:

```yaml
name: yomi-sprites
description: Draw or change a Yomi sprite with sprite-tool (units, gear, icons, map, camp, portraits, effects): guide, check, show, preview, build. Use before editing art/ or adding a sprite.
```

| File | Contents |
| --- | --- |
| `SKILL.md` (< 4,000 bytes) | The loop in five lines: `sprite guide --project art` → edit the `.sprite.toml` → `sprite check --project art` until it prints `ok` → `sprite show` / `sprite preview` → `npm run sprites`, then `npm run sprites:check`. Links to `workflow.md`, `drawing.md`, `docs/reference/sprites.md` and `docs/designs/sprite-drawing-guidance.md`. One line: "Before handing off, run the `yomi-asset-check` agent." Name the agent in plain text only. Don't write a backticked `.claude/agents/yomi-asset-check.md` path, because that file arrives in step 12 and the name-existence test would fail. |
| `workflow.md` (< 8,000) | The install: `uv tool install git+https://github.com/ginstrom/sprite-tool@v0.6.0`, with `--force` to upgrade. sprite-tool is installed on the host and is not in the podman image. The pin is `v0.6.0`; note that the host has 0.7.0 (the stage 7 record) and that no export changed. Also: `sprite new` for each kind (`--canvas unit --project art --dir units`, where the id is the `UnitKind`; `icon_<id> --canvas icon --project art --dir icons --runs`); the manifest and `--adopt` procedure (`sprite build --adopt --project art`, plus the sprites `README.md` update); what to commit (everything the build writes into `public/assets/sprites/`, `.sprite-tool-manifest.json` included, with the source). Commands run from the repository root. |
| `drawing.md` (< 8,000) | Grids against runs (`[frames.<name>.runs]`, `[column, "pixels"]` lists; runs suit mostly empty 32px canvases; never write a script to generate a grid). `outline = "auto"`: draw only the interior; the tool adds the `k` outline. Variants: `[variants.<name>]`, `swap = { … }`, built as `<id>_<name>.png`. The check/show/preview loop flags: `--frame <name> --diff`, `--grid`, `--on warrior`, `--points`. Movement as frames plus `[anim.<name>]`; the scenes only say which animation plays. The gear sprite's drawing rules: `gear/gear_<icon>` on the `unit` canvas, `over = "warrior"`, `[anim.idle]` `like = "warrior"`, `[anim.walk]` `rest = true`, and staying out of the body's fist, off-hand and face regions. |

Both supporting files sit under `SKILL_FILE_LIMIT_BYTES` (8,000). Every backticked repository path in them must exist. Spans with `<`, `>`, `*`, `{`, `}` or `…` are placeholders and are skipped (C2).

### The `art/CLAUDE.md` ledger (design §4.1)

| Section of today's `art/CLAUDE.md` | Outcome |
| --- | --- |
| Sources are text in `art/**/<id>.sprite.toml`; never edit an exported file by hand | stays |
| Commit `public/assets/sprites/` with `.sprite-tool-manifest.json`; `npm run sprites:check` fails when they are stale | stays |
| The manifest rule (the tool overwrites only files on the manifest; a hand-placed PNG stops the build) and that `--adopt` exists | stays as a contract; the procedure goes to `workflow.md` |
| A unit needs `idle` and `walk` and `[points] chest`; `[points]` sits below `outline = "auto"` | stays |
| A gear sprite needs a `GEAR_SPRITES` or `WORN_SPRITES` entry (`src/scenes/unitLook.ts`), or `unitLook.test.ts` fails | stays |
| Provenance and licence in `public/assets/sprites/README.md` | stays |
| `art/units/warrior.sprite.toml.example` is a format reference, not the game's warrior | stays |
| The intro's pointer to `docs/reference/sprites.md` | stays |
| The install and pin, `sprite guide`, `sprite new`, adopt | moves to `workflow.md` |
| Runs, `outline = "auto"`, variants, the check/show/preview loop, movement as anims, the gear sprite's `over`, `like` and regions | moves to `drawing.md` |
| Portrait (`PORTRAIT_IDS`), location (`map_<kind>`, `LOCATION_SPRITES`) and facility (`camp_<facility>`, `FACILITY_SPRITES`) sprite keys | already gathered in `yomi-add-content` (`portrait.md`, `location-kind.md`, `facility.md`) in stage 1. Remove them here and confirm the content files hold them. |
| Last line ("When a canvas class, a sprite directory or a step of this workflow changes, update this file …") | dropped: the root "Keeping these files current" rule covers it |

`art/CLAUDE.md` gains this pointer line (C4), verbatim:

> Drawing a sprite (the loop, runs, variants, anims, gear sprites' `over`/`like`/regions): `.claude/skills/yomi-sprites/`.

## 3. Dependencies and prerequisites

- Steps 01–09 are done. What they produced and this step relies on:
  - `scripts/claudeMd.test.ts` checks the skill caps, frontmatter (`name` equals the directory name; a single-line `description` under 260 bytes), the always-loaded budget and name-existence (step 01, C2).
  - `.claude/skills/yomi-add-content/` holds `foe.md`, `facility.md`, `location-kind.md`, `portrait.md`, `gear-icon.md` and `SKILL.md`. Its general rules and those files say sprites go through `art/CLAUDE.md` (stage 1, design assumption 10).
  - Role profiles are in `.claude/roles/` (step 08).
- Tools: `sprite --version` on the host prints 0.7.0. This step needs no sprite build.

## 4. Scope and implementation guidance

1. Create `.claude/skills/yomi-sprites/SKILL.md`, `workflow.md` and `drawing.md` as in §2. Move the lines from `art/CLAUDE.md`.
2. Trim `art/CLAUDE.md` to the "stays" rows, then add the pointer line.
3. Repoint the sprite steps in `yomi-add-content` from `art/CLAUDE.md` to `.claude/skills/yomi-sprites/` (C4). Change the wording only where the step names the guide:
   - `SKILL.md`, general rules: "Sprites go through `.claude/skills/yomi-sprites/`."
   - `foe.md`, `facility.md`, `location-kind.md`, `portrait.md` and `gear-icon.md`: the line that sends you to draw the sprite.
   - Contract facts restated in a content file stay. Example: a unit needs `idle`, `walk` and `[points] chest`.
4. `docs/reference/sprites.md`, header line: today it reads "The detail behind `art/CLAUDE.md`, which keeps the workflow." Change it to say that `art/CLAUDE.md` keeps the contracts and the `yomi-sprites` skill (`.claude/skills/yomi-sprites/`) keeps the workflow. Change nothing else in `docs/reference/`.
5. Optional: if `.claude/roles/planner.md`, `designer.md` or `engineer.md` say "follow `art/CLAUDE.md`" for sprite work, repoint them to `.claude/skills/yomi-sprites/`. If they already name `yomi-sprites`, leave them alone.
6. Search the `CLAUDE.md` files and `.claude/` (never `.claude/worktrees/`) for other references to the moved sections, and fix them. Leave the root Commands sentence ("Sprites, sounds, narration and the manual's screenshots have their own commands …") for step 13.

Exclusions: no edit to `art/**/*.sprite.toml`, `art/sprite-tool.toml`, `public/assets/sprites/`, any `.ts` file, the root `CLAUDE.md` or the global skills.

## 5. Verification

Local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.

- `npx vitest run scripts/claudeMd.test.ts`: the new skill's caps, frontmatter, budget and name-existence all pass.
- `npm test` passes.
- `git status --short` shows nothing under `art/` except `art/CLAUDE.md`, and nothing under `public/assets/sprites/`. No source changed, so no sprite build or `sprites:check` is needed. Say so in `log.md`.
- Record the byte sizes of the new `art/CLAUDE.md` and of the three skill files in `log.md`.
- Optional, for the reviewer's ledger walk: a scratch run of the findability script from the shared constraints over `art/CLAUDE.md` against the stage 4 base. Step 13 runs the real check.

## 6. Completion criteria

- [ ] `.claude/skills/yomi-sprites/` holds `SKILL.md`, `workflow.md` and `drawing.md`. The frontmatter is verbatim and every cap holds.
- [ ] `art/CLAUDE.md` holds only the "stays" rows plus the pointer line. The facility, portrait and location keys are confirmed in `yomi-add-content`, and the last line is dropped.
- [ ] The `yomi-add-content` sprite steps and `docs/reference/sprites.md`'s header point to the skill.
- [ ] No sprite source or export changed.
- [ ] `npm test` passes. One commit: `Modular context step 10: the yomi-sprites skill`.
- [ ] The index shows the step `done` with its commit. `log.md` has a `## Step 10` section with the stage 4 base SHA, the sizes and the test result.

## 7. Execution record

