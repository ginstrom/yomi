# Design: modular context and skills

- **Slug:** `modular-context`. **Feature record:** [`docs/features/modular-context.md`](../features/modular-context.md), the feature's state and decisions. The approved proposal (five layers, four stages), verbatim, is in the plan's [`log.md`](../implementation-plans/modular-context/log.md), "Moved from the feature record (step 06)".
- **Status:** ready for planning. No question blocks a stage; three non-blocking questions for the user are in §9.
- **What this is:** an instructions refactor. No game code, rule or balance changes. The only code is tests in `scripts/`.

## 1. Purpose

Today every session working in a directory loads that directory's `CLAUDE.md` in full, including procedures (asset workflows, balance tuning, "if you add X" lists) that only one kind of task needs. Those cross-directory checklists are also split across eight guides, so adding a spell means reading three of them. The orchestrator re-reads feature records and plan indexes that have grown into logs (`skill-trees.md` 28 KB, `skill-trees/index.md` 60 KB).

The outcome is that each kind of work loads only what it needs:

- **Directory guides** keep only contracts, the rules that stop you breaking code in that directory.
- **Procedures** move into project skills, which load on demand. Each skill has one file per case.
- **What a role needs to know about Yomi** goes in a role profile, which the global role skills read when it exists.
- **Repeatable delegated jobs** go to project subagent types.
- **Orchestration state** is kept apart from history, with size caps enforced by tests.

## 2. Requirements

| ID | Requirement | Stage |
| --- | --- | --- |
| R1 | Every directory `CLAUDE.md` holds contracts only. Each section that moves has a named destination (§4.1), and nothing is dropped. | 1, 4 |
| R2 | The `yomi-add-content` skill: one file per content type, each listing every place to touch across all directories (§4.2). | 1 |
| R3 | The `yomi-balance` skill: the bands, the levers, running and reading the simulator, and the guards (§4.3). | 1 |
| R4 | The `yomi-measure` agent: runs simulations one at a time and returns one table against the bands (§4.6). | 1 |
| R5 | The root `CLAUDE.md`'s "Keeping these files current" states the new rule for where a fact goes (§4.8). | 1 |
| R6 | The state/history split: a feature record's State section ≤ 3 KB; the plan index keeps the step table and statuses; history goes to `log.md`, which the orchestrator never reads. The global skills write and read this shape (§5). | 2 |
| R7 | Size-cap tests for skills, agents, profiles, descriptions, the always-loaded budget, feature records and plan indexes (§6). | 1–3 |
| R8 | Role profiles in `.claude/roles/`, and one generic hook line in each global role skill (§4.7). | 3 |
| R9 | The `yomi-sprites`, `yomi-sound` and `yomi-manual` skills, plus the `yomi-asset-check` agent. `art/` and `audio/` keep only their contracts (§4.4, §4.5, §4.6). | 4 |
| R10 | The always-loaded cost (root `CLAUDE.md` plus every project skill and agent description) grows by at most 2 KB. Before and after sizes are recorded (§7). | all |
| R11 | Every edit to a global skill is generic, backward compatible and small. The exact text is given here (§5.3, §4.7). | 2, 3 |

**Non-goals:** changing any game rule, constant or test of play; moving or rewriting `docs/reference/` (it stays as is); migrating finished feature records or plans; changing the global skills beyond the listed lines; a `.claude/browser-qa/` profile.

**Acceptance:**

- `npm test` passes at the end of every stage.
- The findability check (§8) lists no missing fact.
- The always-loaded total is at most 8,500 bytes, and the test enforces it.
- `diff -r ~/.claude/skills-backup-2026-11-21 ~/.claude/skills` shows only the lines in §5.3 and §4.7.

## 3. Current system (inspected)

| Item | Bytes | Notes |
| --- | --- | --- |
| `CLAUDE.md` (root, always loaded) | 6,243 | map, contracts, "Keeping these files current" |
| `src/game/CLAUDE.md` | 8,308 | contracts, modules, 6 checklists |
| `src/engine/CLAUDE.md` | 7,542 | contracts, RNG, turn order, AI, 6 checklists |
| `audio/CLAUDE.md` | 6,726 | layout, command table, recipes, sources, narration |
| `src/scenes/CLAUDE.md` | 6,451 | contracts, probes, flow, "If you add X" (13 items), helpers |
| `src/character/CLAUDE.md` | 5,765 | modules, derived stats, HP, cycles, nodes, points, creation, retuning |
| `e2e/CLAUDE.md` | 4,844 | driver contracts, sound hooks, files, manual shots |
| `scripts/CLAUDE.md` | 4,377 | flags, campaigns, bands, guard, tuner's notes |
| `art/CLAUDE.md` | 4,161 | sprite-tool workflow and contracts |
| `src/inventory/CLAUDE.md` | 2,955 | ids, grades, runes, equipping |
| `src/combat/CLAUDE.md` | 2,582 | modules, yardstick, "When you add data" |
| `src/story/CLAUDE.md` | 1,617 | one paragraph |
| Directory guides in total | 55,328 | |

- `scripts/claudeMd.test.ts` caps the root file below 16,000 bytes and each directory file below 12,000. It skips dot-directories, so nothing under `.claude/` is capped today.
- `.claude/` holds only an empty `worktrees/`, which is not gitignored. Agent worktrees live there (stage 7 used `.claude/worktrees/agent-…`), so a test that scans `.claude/` recursively would walk whole repository copies.
- No `.claude/skills/`, `.claude/agents/` or `.claude/roles/` exists. Global agents (`~/.claude/agents/`) don't exist either.
- `AGENTS.md` is a symlink to `CLAUDE.md` (`f0814da`). No directory `AGENTS.md` exists.
- Global skills tell each role to read "applicable CLAUDE.md (and/or) AGENTS.md": designer, planner, architect, qa, pr-reviewer, orchestrator, plan-implementer, implement-step and review-step. `browser-qa` already reads a project profile (`.claude/browser-qa/`), which is the precedent for the role hook.
- Feature records: 13 files, 130 KB. Two are unfinished: `modular-context` (phase 2) and `long-campaign-stage-07` (done on the branch, not merged). The rest are done or merged.
- Plan indexes: 14 files, 422 KB. In `skill-trees/index.md`, the Measurements tables, the stage-5 measurement and the per-step outcomes are history. In `long-campaign-stage-07/index.md` (28 KB), almost everything is live contracts and the step table. Its history sits in the feature record's Verification section (about 5 KB of the record's 8.7 KB).
- The cell codes (GR3 = `goblin_raid` 3 at level 3, …) are defined only in `skill-trees/index.md` "Measurement procedure". The 50-campaign guard check recipe is only in the stage 7 plan.
- No `.github/workflows/`. "All tests" for a PR is whatever the instructions say.
- Stale pointers already exist: `src/game/encounters.ts:194` and `scripts/simulate.ts:12` say "the rules of scaling in CLAUDE.md". That section no longer exists.

## 4. Technical design

All paths under `.claude/` are proposed. Skill and agent names carry a `yomi-` prefix, so they never collide with the global skills.

### 4.1 Directory guides: what stays, what moves

"Stays" means it remains as a contract, possibly shortened. Every guide that loses a checklist gains one pointer line, such as: "Adding a spell, status, ability, trait, element or battle event: `.claude/skills/yomi-add-content/`."

| Guide | Section | Outcome |
| --- | --- | --- |
| `src/combat` | intro, The modules, Foe scaling and the yardstick | stays |
| | When you add data, bullet 1 (checklists in engine) | replaced by the pointer line |
| | bullet 2 (new field means engine code; out of the RNG) | stays, and is repeated in `status.md` and `ability.md` |
| | bullet 3 (id order matters) | stays, and is repeated in `spell.md` and `ability.md` |
| `src/engine` | contract, RNG discipline, Turn-start order, The AI | stays |
| | the AI's policy-snapshot paragraph | stays as one line: "re-record only when meant; `yomi-balance` guards.md". The re-recording procedure moves to `yomi-balance/guards.md` |
| | Checklists: spell, status, ability, trait, element, event shape | all move to `spell.md`, `status.md`, `ability.md`, `trait.md`, `element.md` and `battle-event.md` |
| `src/character` | modules, Derived never stored, Hit points, Import cycles, Perk points, Creation | stays |
| | Nodes are data: the rules (ranks, tiers, depth, capstones, asks) | stays |
| | Nodes are data: "a new node of an existing shape is one entry there; PERKS order is the tree's layout" | moves to `skill-node.md` |
| | Changing hero growth means retuning | becomes one line: "a change to hero growth moves balance: `yomi-balance`". The list of growth changes moves to `yomi-balance/levers.md` "When to retune" |
| `src/inventory` | all sections | stays |
| | Equipping, last sentence (gear icon needs a sprite and a `unitLook.ts` entry) | moves to `gear-icon.md` |
| `src/game` | Contracts, The modules, The rules | stays |
| | Checklists: save shape | stays, as a contract bullet under Contracts |
| | Checklists: facility, encounter, foe kind, one-day action | move to `facility.md`, `encounter.md`, `foe.md` and `day-action.md` |
| | Checklists: anything that changes an outcome means re-running balance | becomes one contract line pointing to `yomi-balance`. The procedure is in `levers.md` |
| `src/story` | what the modules are, `storyFor`'s order, `narration.ts` never imported by a scene, the leader and tips are never voiced | stays |
| | writing a cutscene or tip, a new moment, a new anchor, `{encampment}` and `{leader}` | moves to `story.md` |
| | the fields of a voiced beat | moves to `story.md` in stage 1, which points to `audio/CLAUDE.md`. Stage 4 repoints it to `yomi-sound/narration.md` |
| `src/scenes` | Contracts, Probes, Scene flow, Helper modules | stays |
| | asset READMEs record provenance and licence | stays as one contract line |
| | If you add X: unit kind, gear icons, item icon, ability, spell, portrait, facility, location kind, banner, battle event, debug command | moves to `foe.md`, `gear-icon.md`, `item.md`/`rune.md`, `ability.md`, `spell.md`, `portrait.md`, `facility.md`, `location-kind.md`, `party-banner.md`, `battle-event.md` and `debug-command.md` |
| | If you add X: sound effect | moves to `audio/CLAUDE.md` "Which sound plays when" (stage 1, by pointer), then to `yomi-sound/new-cue.md` (stage 4) |
| | If you add X: a control a test clicks | dropped as a duplicate: it is already in Probes ("A control that a test needs to click goes in its scene's probe") |
| `scripts` | intro | stays, shortened: what `simulate.ts` and `narration.ts` are, and the detail in `docs/reference/simulator.md` |
| | The refactor guard | stays as a contract. The re-record procedure moves to `guards.md` |
| | Flags, Campaigns | move to `yomi-balance/running.md` |
| | Balance (measure, bands table, waiting check, also-figures, parity, history pointer) | moves to `yomi-balance/bands.md`. The guide keeps one contract line: "The bands are the user's; never change them. They are in `.claude/skills/yomi-balance/bands.md`." |
| | What a tuner needs to know | moves to `yomi-balance/levers.md` |
| | (new) one run at a time; output under `logs/` | stays as a contract line |
| `art` (stage 4) | sources are text and never edit an export; commit `public/assets/sprites/` with `.sprite-tool-manifest.json`; `sprites:check` fails when stale; the manifest and `--adopt` rule; a unit needs `idle`, `walk` and `[points] chest`, and `[points]` sits below `outline = "auto"`; a gear sprite needs a `GEAR_SPRITES` or `WORN_SPRITES` entry (test); provenance in the sprites README; the `.example` file | stays |
| | the install and pin, `sprite guide`, `sprite new`, runs, `outline = "auto"`, variants, the check/show/preview loop, movement as anims, the gear sprite's drawing rules (`over`, `like`, regions) | moves to `yomi-sprites/workflow.md` and `drawing.md` |
| | portrait, location and facility sprite keys | moves to `yomi-add-content` (`portrait.md`, `location-kind.md`, `facility.md`), already gathered in stage 1 |
| | the last line ("update this file in the same commit") | dropped: the root rule covers it |
| `audio` (stage 4) | intro (host only, never in `npm test` or the image, needs `uv` and `ffmpeg`); Layout; generated files never hand-edited and how to resolve a merge conflict; the allow-list, never clone a voice, downloads never enter the repository and are untrusted; runtime hints in `CUES`, never in a recipe; `npm test` fails on a stale voiced beat | stays |
| | the Commands table | moves to `yomi-sound/commands.md` |
| | Recipes and the build (peak-limited, incremental), Which sound plays when (the procedure), Listening | moves to `yomi-sound/new-cue.md` |
| | Sources and licences: the preference order, the download folders, `source add`, onsets, the catalogue | moves to `yomi-sound/sourcing.md` |
| | Narration: the TTS extra, the fields, `npm run narration` with its PATH, heteronyms, a new voice | moves to `yomi-sound/narration.md` |
| `e2e` (stage 4) | everything except the last paragraph's screenshot procedure | stays |
| | `manual.shots.ts` and retaking the screenshots | moves to `yomi-manual/screenshots.md`. The guide keeps "`manual.shots.ts` is not a test; see `yomi-manual`" |

### 4.2 `yomi-add-content`

**Frontmatter:**

```yaml
name: yomi-add-content
description: Every place to touch when adding or renaming Yomi content (spell, status, ability, trait, element, skill node, foe, encounter, facility, item, rune, icon, location, portrait, banner, day action, battle event, debug command, story). Use before adding one.
```

**SKILL.md (index, ≤ 4 KB):**

- One sentence on how it works: open the file for your case, touch every item in it, then run `npm test`.
- The content-type table below, linking each file.
- General rules: full `Record`s make `tsc` ask for an entry. Coverage tests enforce some lists: `sounds.test.ts`, `unitLook.test.ts` and the yardstick test in `encounters.test.ts`. Run `npm run test:browser` after touching a scene. Anything that moves an outcome goes through `yomi-balance`. Sprites go through `art/CLAUDE.md` (`yomi-sprites` from stage 4), and sounds through `audio/CLAUDE.md` (`yomi-sound` from stage 4). A renamed name gets a search of the CLAUDE.md files and `.claude/`.

Each file is a checklist, one line per place (`file` → `symbol`: what to add), followed by "Tests that catch a miss". The sources below are where its lines come from. Gathered lines are moved, not rewritten. An implementer may add a line only after confirming it in the code.

| File | Content type | Gathers from |
| --- | --- | --- |
| `spell.md` | a spell (hero or monster) | engine "A new spell"; scenes "A spell"; combat bullet 3 (id order); character "Nodes are data" (taught by one node, `perkTeaching`) |
| `status.md` | a status | engine "A new status"; combat bullet 2; engine RNG "what never draws" (statuses don't draw) |
| `ability.md` | a monster ability or hero technique | engine "A new ability"; scenes "An ability"; combat bullets 2 and 3 |
| `trait.md` | a trait | engine "A new trait"; character (`traitsOf`, read by name) |
| `element.md` | an element | engine "A new element" (`ELEMENT_SPELL_SOUNDS`, runes keyed by element) |
| `skill-node.md` | a perk node of the trees | character "Nodes are data" (one `PERKS` entry, order is layout, tier cost); the perk-points invariant (by pointer); `yomi-balance` (growth changes retune) |
| `foe.md` | a foe or unit kind | game "A new foe kind"; scenes "A unit kind"; combat "Foe scaling and the yardstick" (must pass; a named exception in `encounters.test.ts`); art (id is the `UnitKind`; `idle`, `walk`, `[points] chest`); game's last checklist (balance) |
| `encounter.md` | an encounter | game "A new encounter" (`ENCOUNTERS`, `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`, `SPAWN_KINDS`); balance |
| `facility.md` | an encampment facility | game "A new facility"; scenes "A facility" (`camp_<facility>/level_<n>`, a plot in `encampmentView.ts`, the overlap test); art (`FACILITY_SPRITES`); `yomi-manual` (the encampment's screen) |
| `location-kind.md` | a world map location kind | scenes "A location kind"; art (`map_<kind>`, `LOCATION_SPRITES`) |
| `day-action.md` | a one-day action | game "A new one-day action"; game contracts (refusal plus time-free apply; `company.ts` calls only those) |
| `item.md` | a base or enchanted item | inventory "One id is one object" (`BASE_ITEMS`/`MAGIC_ITEMS` or saves break; never build by hand); scenes "An item icon" (`ITEM_ICON_KEYS`); `gear-icon.md` for worn looks |
| `rune.md` | a rune kind | scenes (`RUNE_ICON_KEYS`, `RUNE_COLOURS`); inventory "Rune fitting" (`runeFits`, `runeFitsOnly`) and `onHitParts`; `element.md` |
| `gear-icon.md` | a weapon, shield, armour, head or cloak look | scenes "A weapon or shield icon…" (`GEAR_SPRITES`, `WORN_SPRITES`, `WORN_BACK_SPRITES`, `WEAPON_SOUNDS`, `SWUNG_GEAR`); inventory "Equipping"; art (gear sprite, `unitLook.test.ts`) |
| `portrait.md` | a portrait preset | scenes "A portrait preset"; character (`portraits.ts`); art (`PORTRAIT_IDS`) |
| `party-banner.md` | a party banner | scenes "A party banner" |
| `battle-event.md` | a new event kind or a changed event shape | engine "Any event shape change" (`LOG_SCHEMA_VERSION`, `formatEvent`, `eventSounds`, `eventSchedule.ts`, `battleEffects.ts`); scenes (`changesStatusMarks`); audio (`sounds.test.ts` fails on a silent event kind) |
| `debug-command.md` | a debug command | scenes "A debug command" (`COMMANDS`; changes run only on the world map) |
| `story.md` | a cutscene, tip, story moment or tutorial anchor | story guide (entries, `StoryMoment`, `TutorialAnchor`, `anchors()`, `fillText`); voiced beats point to the narration procedure |

The index also has one row with no file of its own, a sound effect: it points to `audio/CLAUDE.md`, and from stage 4 to `yomi-sound/new-cue.md`.

### 4.3 `yomi-balance`

```yaml
name: yomi-balance
description: Yomi's balance bands, tuning levers, simulator runs and the refactor guard and policy snapshot. Use before changing anything that moves a battle or campaign outcome, or to measure or tune.
```

| File | Contents | Source |
| --- | --- | --- |
| `SKILL.md` | when it applies (any outcome change; hero growth; foes, encounters, counts, healing, party limit); the order: measure the baseline → change → re-measure with `yomi-measure` → compare with the bands → re-record the guards if play moved; links | scripts guide intro; character "Changing hero growth"; game's last checklist |
| `bands.md` | the bands table with its "Now" column, the waiting check, the also-figures (TL5, F1–F3), path parity and the accepted gaps, and the cell codes (code → encounter, threat, party level). History pointers: the skill trees' Measurements table, and each plan's `log.md`. "The user sets the bands; only the user changes a band. A measuring step updates Now." | scripts "Balance"; `skill-trees/index.md` "Measurement procedure" (the cell table) |
| `running.md` | the flags (common ones, with a pointer to the reference for all), cells, `--plans` and the parity command, `--campaign`/`--ready-level`/`--parties`/`--waiting`; one run at a time, about 5 minutes and 70 MB, `--out logs/<label>-<measure>.jsonl > .txt`; the Node 26 PATH prefix; which summary lines carry each figure (the implementer writes this by reading one real summary) | scripts "Flags", "Campaigns"; stage 7 index "Commands" |
| `levers.md` | "What a tuner needs to know" in full, plus "When to retune" (the growth list) | scripts; character |
| `guards.md` | the refactor guard (what it hashes, re-record only when play is meant to move, old and new figures in the doc comment above `GUARD_RECORDS`); the 50-campaign check recipe (`shasum` of `logs/guard-50.jsonl`); the policy snapshot (`policies.test.ts`; re-record only when meant, with the reason in the test's title) | scripts "The refactor guard"; stage 7 index "The refactor guard"; engine "The AI" |

### 4.4 `yomi-sprites` and `yomi-manual` (stage 4)

```yaml
name: yomi-sprites
description: Draw or change a Yomi sprite with sprite-tool (units, gear, icons, map, camp, portraits, effects): guide, check, show, preview, build. Use before editing art/ or adding a sprite.
```

- `SKILL.md`: the loop in five lines (guide → edit → `sprite check` until `ok` → `show`/`preview` → `npm run sprites`, then `sprites:check`), with links to the two files below, `docs/reference/sprites.md` and `docs/designs/sprite-drawing-guidance.md`. Run `yomi-asset-check` before handing off.
- `workflow.md`: the install and the `v0.6.0` pin (the host now has 0.7.0, per the stage 7 record), `sprite new` for each kind, `--adopt`, and what to commit.
- `drawing.md`: grids against runs, `outline = "auto"`, variants, anims, `[points]`, and the gear sprite's rules (`over`, `like`, `rest`, the regions).

The source for all three is the `art/CLAUDE.md` rows in §4.1.

```yaml
name: yomi-manual
description: Update Yomi's player manual (docs/manual/) when a rule it states or a screen it shows changes, and retake its screenshots. Use after changing a player-facing rule or screen.
```

- `SKILL.md`: when it applies (the root Docs line); the manual is one file, `docs/manual/README.md`, and its images live in `docs/manual/images/`; check that its text still reads true.
- `screenshots.md`: `npm run manual:screenshots` (`vitest.manual.config.ts`, which plays `e2e/manual.shots.ts`); add a shot with `shot(game, name)` in a new or existing `it`; look at every changed PNG; commit the images with the text.
- Sources: the root CLAUDE.md "Docs" line, the last paragraph of `e2e/CLAUDE.md`, the manual's own footnote, and the doc comment in `manual.shots.ts`.

### 4.5 `yomi-sound` (stage 4)

```yaml
name: yomi-sound
description: Make or change Yomi's sound effects and narration with the yomi-audio tool: sourcing and licences, recipes, audition, build and check, voicing a line. Use before editing audio/ or a voiced beat.
```

`SKILL.md` indexes four files: `commands.md`, `new-cue.md`, `sourcing.md` and `narration.md`. Their sources are the `audio/CLAUDE.md` rows in §4.1. The full detail stays in `docs/reference/audio.md`, which the files link by section ("Sound design without ears", "Designing a voice").

### 4.6 Subagent types (`.claude/agents/`)

**`yomi-measure.md`**

```yaml
name: yomi-measure
description: Runs Yomi's simulator (campaigns, balance cells, parity) one run at a time and returns one table of figures against the user's bands. Use for any balance measurement.
tools: Bash, Read, Grep, Glob
model: sonnet
```

The body (≤ 6 KB):

1. **Input** from the brief:
   - the measures, by name from `bands.md`: `one`, `company`, `rl10`, `rl12`, the cell codes, `parity-L4`/`L8`/`L14`, or `standard` (every row of the bands table);
   - the seed (default 1) and the count (default 500);
   - a label;
   - extra flags such as `--waiting` or `--plans`.
2. **Before running:**
   - Read `.claude/skills/yomi-balance/running.md` and `bands.md`.
   - Record `git rev-parse HEAD` and `git status --short`.
   - Refuse to start if another `simulate` process is running (`pgrep -f scripts/simulate.ts`), and report that.
3. **Run** each measure in order, never two at once, as `npm run simulate -- … --out logs/<label>-<m>.jsonl > logs/<label>-<m>.txt`.
   - In the foreground, use a timeout of 600,000 ms.
   - A run that may pass 9 minutes (`rl10`, `rl12`, or anything with a count above 500) starts in the background and is waited on with an until-loop on its `.txt` summary line. Never end the turn while a run is alive.
4. **Read-only:** edit no tracked file. Write only under `logs/`.
5. **Return** one table, then the details:

   | Measure | Command flags | Figure | Band | In band | Change from Now |
   | --- | --- | --- | --- | --- | --- |

   After the table: the run times, head SHA and dirty state, the log paths, any run that failed (with its last 20 lines), and nothing else. It interprets nothing beyond "in band / out by N".

**`yomi-asset-check.md`**

```yaml
name: yomi-asset-check
description: Runs Yomi's sprite and sound build checks (sprites:check, sounds:check) and reports pass, fail or blocked with the failing ids. Use after changing art/ or audio/, or before a PR.
tools: Bash, Read
model: haiku
```

The body:

- Check the tools first: `sprite --version` (compare it with the pin in `.claude/skills/yomi-sprites/workflow.md`) and `uv --version`/`ffmpeg -version`. A missing tool makes that check BLOCKED, not FAIL.
- Run `npm run sprites:check`, then `npm run sounds:check`. A brief may name only one.
- Write nothing.
- Return a table (check | result | failing ids or first error line | tool version), then the pin drift, if any.

### 4.7 Role profiles (`.claude/roles/`, stage 3)

Each profile is ≤ 4 KB, a list of what that role needs to know about Yomi that the root `CLAUDE.md` doesn't already say. A profile points to skills by path and never copies them.

| Profile | Contents | Sources |
| --- | --- | --- |
| `orchestrator.md` | Commit on the current branch, one branch per long-campaign stage. Tier words: "opus" means leave the model unset. Use `yomi-measure` and `yomi-asset-check` instead of general workers for those jobs. Stage designs marked "ready for planning" skip architecture and design (precedent: stages 2–7). Only the user changes a balance band or accepts an out-of-band figure. The global skills are not in git, so back them up before an edit. | stage 7 record decision log; feature record decisions; root Subagents |
| `architect.md` | not written (no Yomi-specific need found). The hook is harmless when the file is absent. | — |
| `designer.md` | Designs go to `docs/designs/`, and long-campaign stages to `docs/designs/long-campaign/` following its `index.md`. A design states its effect on `SAVE_VERSION`, `LOG_SCHEMA_VERSION`, balance (`yomi-balance`), the manual (`yomi-manual`) and assets (`yomi-sprites`, `yomi-sound`), and which test layer covers each rule (domain, scene smoke, e2e). Rules are Phaser-free. | root; stage 7 design conventions |
| `planner.md` | Name in each task file the skill files that apply (e.g. `.claude/skills/yomi-add-content/spell.md`); this is how the engineer loads only what it needs. The guard pattern: steps that must not move the fixture, one step that re-records it, the 50-campaign check. A final measuring step uses `yomi-measure`. Commands with the Node 26 PATH prefix. Never two campaign simulations at once. Messages are "<Feature> step NN: title", with no attribution lines. Sprite steps go in a worktree. A docs step covers the CLAUDE.md files, `.claude/`, `docs/reference/` and the manual. Measurement tables go in `log.md`. | stage 7 index "Scope and shared constraints" and "Tasks"; skill-trees index |
| `engineer.md` | Read the skill files your task names. `npm test` before every commit, and `npm run test:browser` after a scene change. You may spawn `yomi-measure` and `yomi-asset-check` (this profile grants it, per `subagent-rules.md`) and no other agent. Search the CLAUDE.md files and `.claude/` for every renamed name. Record measurements in the plan's `log.md`. | stage 7 index; root |
| `reviewer.md` | Check that the guard fixture changed only in the step allowed to change it; that `SAVE_VERSION` and `LOG_SCHEMA_VERSION` were bumped when shapes changed; that no new RNG draw was added (engine guide); that no scene decides an outcome; that the guides and skills are current for renames; that the manual was updated for a player-facing change; and that e2e ran after a scene change. | engine/scenes contracts; stage 7 reviews |
| `qa.md` | Run the game: `npm run dev` on 5173 is often the user's. Start your own on another port (`npx vite --port 5180`) and never kill a process you did not start (stage 7's simulated user killed the user's server). `?seed=`; the `~` console (`stock`, `blight`, `days`, `facility`, `fight`); `window.__yomi` probes; the e2e driver as a harness. Use `yomi-measure` for balance claims. Evidence goes in `<git-common-dir>/pr-review/<branch>/evidence/`. | stage 7 record; scenes reference "Debug console"; e2e guide |
| `pr-reviewer.md` | There is no CI. The CI equivalent is `npm test`, `npm run build`, `npm run test:browser`, plus `yomi-asset-check` when `art/` or `audio/` changed. These are host-only; say so if missing. | stage 7 PR review line; package.json |

**Hook lines in the global skills** (R11): the same sentence everywhere, with `<role>` replaced as listed.

> Also read `.claude/roles/<role>.md` at the project root if it exists: the project's notes for this role.

| Global file | Where | `<role>` |
| --- | --- | --- |
| `orchestrator/SKILL.md` | Phase 0, the "Otherwise read the request…" bullet, and the resume bullet | `orchestrator` |
| `architect/SKILL.md` | "Ground the brief", first bullet | `architect` |
| `designer/SKILL.md` | "Ground the design", first bullet | `designer` |
| `planner/SKILL.md` | "Establish the source of truth", first bullet | `planner` |
| `plan-implementer/implement-step.md` | "Start", first bullet | `engineer` |
| `plan-implementer/review-step.md` | "Sources" | `reviewer` |
| `qa/SKILL.md` | "Prepare", first bullet | `qa` |
| `pr-reviewer/SKILL.md` | "Establish the scope", the "Read applicable CLAUDE.md…" bullet | `pr-reviewer` |

`browser-qa` is unchanged, because it already has its own profile.

One more generic line goes in `orchestrator/SKILL.md` "Roles", after "Spawn workers as `general-purpose` agents…":

> If the project defines agent types in `.claude/agents/` for a job (such as measurements), use them for it.

**AGENTS.md wording.** Change it. In each file that says "CLAUDE.md and AGENTS.md" or "CLAUDE.md (and AGENTS.md)" or "CLAUDE.md or AGENTS.md", replace that phrase with "CLAUDE.md or AGENTS.md instructions (once if one links to the other)". This saves a second read of a 6 KB file in Yomi and changes nothing where they differ. The files are designer, planner, architect, qa, pr-reviewer, orchestrator (Phase 0), plan-implementer `SKILL.md`, implement-step and review-step. Do this in stage 3 with the hook.

### 4.8 Root `CLAUDE.md` changes

- **"Balance" contract:** "…tuned against the user's bands (`yomi-balance` skill); …". The Architecture table's `scripts/` row stays.
- **"Subagents":** add one line: "Simulator measurements: the `yomi-measure` agent; asset checks: `yomi-asset-check`."
- **"Docs":** add one line: "`.claude/`: project skills (`yomi-*`), agents and role profiles; `scripts/claudeMd.test.ts` caps them."
- **"Keeping these files current":** replace the "Where a fact goes" list with this table, and keep the two framing sentences ("Update the right file in the same commit…; search the CLAUDE.md files and `.claude/` for every name renamed or deleted" and the cap sentence):

| A fact | Goes in |
| --- | --- |
| commands, the map, contracts spanning directories | this file |
| a rule that stops you breaking code in one directory | that directory's `CLAUDE.md`, one line a module |
| how to do a kind of task: an "if you add X" list, a tool workflow, tuning | a project skill, `.claude/skills/yomi-<task>/`, one file per case |
| what one role needs to know about Yomi | `.claude/roles/<role>.md` |
| a delegated job with a fixed report | `.claude/agents/<name>.md` |
| full rule text and detail | `docs/reference/<area>.md` |
| a feature's state / its history | `docs/features/<slug>.md` State / the plan's `log.md` |
| what a grep answers, what the code says | nowhere |

- Fix the two stale code comments (`encounters.ts:194`, `simulate.ts:12`) to point to `yomi-balance/levers.md` (stage 1). The `narration.ts` comment (`audio/CLAUDE.md`) stays valid.
- `.gitignore`: add `.claude/worktrees/` (stage 1, before `.claude/` holds committed files).

## 5. State and history (stage 2)

### 5.1 Feature record shape

`docs/features/<slug>.md`:

```markdown
# Feature: <name>

## State
- Request (user's words): …
- Slug · Phase · Next action · Branch
- Links: architecture, design, plan index, plan log
- Open questions: each with what it blocks
- Tiers: per role and step; escalations
- Verification: the latest verdict of each gate (overall review, QA, simulated user, PR review) with its head SHA
- Carried forward: notes for a later step or stage; removed once used

## Decision log
| Date | Decision | By | Alternatives | Reason |   (one row per decision in force; a superseded row is replaced)
```

- **State** is ≤ 3,000 bytes, and the whole file is ≤ 8,000 bytes.
- The orchestrator reads the whole record, because decisions in force are state.
- Everything else goes to the plan's `log.md`: per-step verification lines, review rounds, fix narratives, measurements and superseded decisions.

### 5.2 Plan folder shape

| File | Holds | Read by |
| --- | --- | --- |
| `index.md` (≤ 32,000 bytes) | everything the planner writes today: title, links, decisions taken, shared constraints, contracts, the step table with statuses and commits, the order, the requirement map, completion criteria, open questions, the note for implementers. It also gains a link to `log.md`. No table that grows as steps finish. | orchestrator, plan-implementer, engineers, reviewers |
| `NN-*.md` | unchanged, including each step's execution record | that step's engineer and reviewer |
| `log.md` (uncapped, append-only) | one section per step: date, tier, verdict, review rounds, commands and figures. Also the measurement tables, the overall-review and QA outcomes, and the feature record's moved history | humans, and a role whose brief names it; never the orchestrator on resume |

The 32 KB cap fits the largest index whose content is all live (stage 7's, 28 KB) and catches the log growth seen in `skill-trees` (60 KB) and `long-campaign-stage-04` (50 KB). Splitting contracts into their own file was rejected: it would change the planner's output and four global files for every project, beyond the proposal.

### 5.3 Global skill edits (stage 2, exact)

1. **`orchestrator/SKILL.md`, "The feature record":**
   - Replace the bullet list and the two paragraphs after it ("You reread…", "Commit the record…" stays) with:

     > It has two parts. **State**, at the top, kept under about 3 KB: the request in the user's words, the slug, the phase and the next action; links to the architecture brief, design, plan index, plan `log.md`, and branch or worktree; open questions and what each blocks; the tier per role and step, with escalations; the latest verdict of each verification gate with its head SHA; and notes carried forward, removed once used. **Decision log**, below it: one row per decision in force (the decision, who made it, the alternatives, the reason). Replace a superseded row.
     >
     > History goes in the plan's `log.md` (`docs/implementation-plans/<slug>/log.md`), not the record: each step's verification line (tier, verdict, rounds), review and QA outcomes, fix narratives, measurements. Append to it; don't read it on resume. Findings, test counts and commit lists already in task files and the review record are linked, not copied. When you resume a record that has grown into a log, move its history to `log.md`, trim it to this shape, and commit that on its own.
   - In Phase 4, change "Record each escalation and each step's verdict in the feature record" to "Record each escalation in the feature record and each step's verdict in the plan's `log.md`".
2. **`planner/SKILL.md`:**
   - Add `log.md` to the folder sketch.
   - Add a bullet to "Write index.md": "Keep the index to what decides the next step. Anything that grows as steps finish (measurements, run histories, review summaries) goes in `log.md` in the plan folder, which the index links."
   - Extend the implementers' bullet: "…and anything the plan as a whole accumulates in `log.md`."
3. **`plan-implementer/implement-step.md`, "Complete":** add "Put figures and histories the plan accumulates (measurements, run tables) in the plan's `log.md`, not the index; create it if absent."
4. **`plan-implementer/step-loop.md`:**
   - "Overall review": change "The outcome goes in the index's execution notes" to "The outcome goes in the plan's `log.md`".
   - "Confirm": add "and the step's outcome line is in `log.md`".

These edits are backward compatible. A plan without `log.md` gets one on first use, and an old record is trimmed by the existing resume rule. `pr-reviewer` still finds QA results in the record's State (the latest verdict with its SHA).

### 5.4 Migration

| Record or plan | Action |
| --- | --- |
| `modular-context` record and plan | written in the new shape from the start. The orchestrator briefs the planner with §5 before the global edits land. |
| `long-campaign-stage-07` record (unfinished: not merged) | migrated in stage 2 as the worked example. Verification lines and the "done in step 07" notes move to a new `docs/implementation-plans/long-campaign-stage-07/log.md`. State keeps the phase, links, the three stage-8 carried-forward notes, the open AGENTS.md question (marked resolved by `f0814da`) and the latest verdicts. Its index (28 KB, all live) stays as it is. |
| the other 11 records and 13 plans (done or merged) | none. They are listed as legacy in the test. The existing resume rule trims any that is resumed. |

## 6. Size-cap tests

There are two test files, both in the `domain` project. Neither scans `.claude/` recursively; each reads only `.claude/skills/*/`, `.claude/agents/*.md` and `.claude/roles/*.md`.

**`scripts/claudeMd.test.ts`** (extended; its comment says the caps keep loaded context small and that you move detail rather than raise a cap):

| Test | Limit | Stage |
| --- | --- | --- |
| root `CLAUDE.md` (existing) | < 16,000 | — |
| each directory `CLAUDE.md` (existing) | < 12,000, lowered to < 8,000 in stage 4 | 4 |
| each `.claude/skills/*/SKILL.md` | < 4,000 | 1 |
| each skill supporting file | < 8,000 | 1 |
| each `.claude/agents/*.md` | < 6,000 | 1 |
| each `.claude/roles/*.md` | < 4,000 | 3 |
| each skill and agent: frontmatter has `name` equal to its directory or file name, and a single-line `description` | description < 260 | 1 |
| always-loaded budget: root `CLAUDE.md` + every skill and agent `name` and `description` | < 8,500 | 1 |
| every backticked `UPPER_SNAKE` constant in `.claude/**/*.md` occurs in `src/` or `scripts/`, and every backticked repository path (`src/…`, `scripts/…`, `art/…`, `audio/…`, `e2e/…`, `docs/…`, `.claude/…`) exists | — | 1 |

The last test makes a rename that leaves a skill stale fail `npm test`. Constants that are not in the code (none known) go in an explicit allow-list in the test.

**`scripts/records.test.ts`** (new, stage 2):

| Test | Limit |
| --- | --- |
| each `docs/features/*.md` not in `LEGACY_RECORDS` has `## State` and `## Decision log`; the State section (from its heading to the next `## `) | < 3,000 |
| the same records, whole file | < 8,000 |
| each `docs/implementation-plans/*/index.md` not in `LEGACY_PLANS` | < 32,000 |
| `LEGACY_RECORDS` and `LEGACY_PLANS` name only slugs that exist (so the list can only shrink) | — |

`LEGACY_RECORDS` lists the 11 done records. `LEGACY_PLANS` lists all 14 current plans, `long-campaign-stage-07` included (its index is unchanged).

## 7. Context cost

| Measure | Before | After (target; the implementer records actuals) |
| --- | --- | --- |
| root `CLAUDE.md` | 6,243 | ≤ 6,500 (the new table is about the size of the list it replaces; plus 3 short lines) |
| project skill descriptions (5) | 0 | ≈ 1,100 |
| project agent descriptions (2) | 0 | ≈ 400 |
| **always loaded** | **6,243** | **≈ 8,000, capped at 8,500** (+1.8 KB) |
| directory guides, in total | 55,328 | ≈ 39,000 (estimate: engine −2.3 KB, scenes −1.9, scripts −2.9, audio −3.7, art −2.3, game −1.2, character −0.8, others −0.9) |
| adding a spell: guides to read | engine + combat + scenes + character ≈ 22.3 KB | engine + combat (contracts) + `spell.md` ≈ 8.5 KB |
| orchestrator resume, stage-7-sized feature | record 8.7 KB + index 28 KB | record ≤ 8 KB (State ≤ 3 KB) + index 28 KB |

The always-loaded growth (+1.8 KB, about 29%) is the cost of making seven procedures discoverable. Any one task in a directory saves more than that, because each directory guide sheds 1–4 KB.

## 8. Verification, by stage

Every stage ends with `npm test` passing and a commit on the current branch. Global-skill edits are outside git. Their diff (`diff -ru ~/.claude/skills-backup-2026-11-21 ~/.claude/skills`) is pasted into the plan's `log.md`.

**The findability check** applies to each guide trimmed in a stage. A scratch script, not committed, does the following:

1. Take every backticked span and every bold lead phrase (`**…**`) from `git show <stage-base>:<guide>`.
2. Report each one not found verbatim in the union of the new guide, `.claude/**` (worktrees excluded) and `docs/reference/**`.

The list must be empty, or each entry must be justified in the step's record (for example, the dropped duplicate in §4.1). The reviewer also walks the §4.1 ledger row by row against the diff.

| Stage | Checks |
| --- | --- |
| 1 | `npm test` (new caps, descriptions, budget, name-existence); findability check for combat, engine, character, inventory, game, story, scenes and scripts; the size table in §7 filled in with actuals; `yomi-measure` run once on one short measure (`one` with `--battles 50`); the reviewer checks that the figure in its table equals the summary line in its `.txt` and that its band and "change from Now" columns are right. |
| 2 | `npm test` (`records.test.ts`); the stage 7 record migration loses no line: every non-blank line of the old record appears in the new record or in `log.md`, by a scratch line-set check; the global diff contains only §5.3. |
| 3 | `npm test` (profile caps); the global diff contains only the §4.7 hook lines, the agent-types line and the AGENTS.md phrase; a smoke check: a fresh sonnet subagent briefed as an engineer for a made-up step names `.claude/roles/engineer.md` and the task's skill file among what it read. |
| 4 | `npm test` (directory cap at 8,000); findability check for art, audio and e2e; `yomi-asset-check` run once on the host, with both checks passing, or BLOCKED with the reason; a description trigger check: a haiku agent given only the seven descriptions and ten sample tasks (e.g. "add a Frost Lance spell", "retune BC4", "draw a new map icon", "voice a cutscene line", "retake the manual's shots") picks the intended skill or agent for each. |

## 9. Assumptions and questions

**Assumptions** (decided here, where the proposal is silent):

1. The feature record keeps its decision log below a capped State section, and the whole file has its own cap (8 KB). The orchestrator still reads the whole record.
2. Contracts stay in `index.md`, with a 32 KB cap. No `contracts.md` is added.
3. Migration covers the unfinished records only: `modular-context`, and `long-campaign-stage-07`'s record (not its done index). Finished ones are listed as legacy.
4. The bands live in `.claude/skills/yomi-balance/bands.md` and nowhere else. `scripts/CLAUDE.md` keeps only the contract that they are the user's.
5. `yomi-asset-check` runs on haiku, since it is mechanical. The proposal names only `yomi-measure`'s tier.
6. The engineer profile grants spawning `yomi-measure` and `yomi-asset-check`, and nothing else.
7. No `architect.md` profile. The hook is still added to `architect/SKILL.md`, for uniformity.
8. The global skills' "CLAUDE.md and AGENTS.md" wording changes to read once when one links to the other.
9. Directory guides are capped at 8 KB from stage 4, to hold the guides to contracts only.
10. In stage 1, the content files point to `art/CLAUDE.md` and `audio/CLAUDE.md` for sprite and sound steps. Stage 4 repoints them.
11. `e2e/CLAUDE.md` loses only its screenshot procedure. Its other sections are contracts on writing in-browser tests.

**Questions for the user** (none blocks a stage; each has a default):

1. **Where the bands live.** The bands are your targets. Moving them into `.claude/skills/yomi-balance/bands.md` puts them under the agent tooling. Is that acceptable, or should they stay in `docs/` (for example `docs/reference/simulator.md` "Bands"), with the skill linking to them? Default: the skill.
2. **The global orchestrator's verification lines.** The orchestrator would move per-step verification lines out of every project's feature records and into `log.md`. That changes how it works in your other projects. Default: yes, as in §5.3.
3. **The always-loaded growth.** The always-loaded cost grows by about 1.8 KB, capped at +2.3 KB. Is that the right ceiling? Default: an 8,500-byte cap.
