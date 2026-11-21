# Step 03: `yomi-add-content`, the battle content

- **Plan:** [index.md](index.md) · **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) §4.1, §4.2 · **Stage:** 1
- **Tier:** engineer sonnet, reviewer sonnet.

## 1. Objective

Create the `yomi-add-content` project skill with its index and its seven battle content files (spell, status, ability, trait, element, skill node, battle event). Move into them the checklists that today sit in `src/engine/CLAUDE.md`, `src/combat/CLAUDE.md`, `src/character/CLAUDE.md` and `src/scenes/CLAUDE.md`, and leave a pointer line in each guide. When this step is done, adding a spell means reading the engine and combat contracts plus `spell.md`, not four guides.

## 2. Requirements and context

- **R1:** every directory `CLAUDE.md` holds contracts only. Each section that moves has a named destination, and nothing is dropped.
- **R2:** `yomi-add-content` has one file per content type, and each file lists every place to touch across all directories. This step writes 7 of the 19 files. Step 04 writes the other 12 and adds their rows to the index.
- **R7, R10:** the caps and the always-loaded budget from step 01 apply. This skill's `description` is 254 bytes, so it is only 6 under the 260 limit. Copy it exactly.
- **Moving text** (shared constraint): move gathered lines without rewriting them. Trim them only to fit the format `file` → `symbol`: what to add. Add a line only after confirming it in the code. Drop nothing.
- This is an instructions refactor. Change no game code, rule, constant or test of play.

### Frontmatter of `.claude/skills/yomi-add-content/SKILL.md` (verbatim, design §4.2)

```yaml
---
name: yomi-add-content
description: Every place to touch when adding or renaming Yomi content (spell, status, ability, trait, element, skill node, foe, encounter, facility, item, rune, icon, location, portrait, banner, day action, battle event, debug command, story). Use before adding one.
---
```

### SKILL.md body (< 4,000 bytes including frontmatter)

- One sentence on how the skill works: open the file for your case, touch every item in it, then run `npm test`.
- A content-type table (File | Content type), with links. In this step it has only these rows:
  - `spell.md`: a spell (hero or monster)
  - `status.md`: a status
  - `ability.md`: a monster ability or hero technique
  - `trait.md`: a trait
  - `element.md`: an element
  - `skill-node.md`: a perk node of the trees
  - `battle-event.md`: a new event kind or a changed event shape
  - a sound effect, which has no file of its own: it points to `audio/CLAUDE.md`, "Which sound plays when". Step 11 repoints this row to `.claude/skills/yomi-sound/new-cue.md`.

  Step 04 adds the rows for foe, encounter, facility, location kind, day action, item, rune, gear icon, portrait, party banner, debug command and story. Don't add rows for files that don't exist yet.
- **General rules:**
  - Full `Record`s make `tsc` ask for an entry.
  - Coverage tests enforce some lists: `src/scenes/sounds.test.ts`, `src/scenes/unitLook.test.ts` and the yardstick test in `src/game/encounters.test.ts`. Confirm each path exists before writing it in backticks.
  - Run `npm run test:browser` after touching a scene.
  - Anything that moves an outcome goes through `yomi-balance` (`.claude/skills/yomi-balance/`).
  - Sprites go through `art/CLAUDE.md` (`yomi-sprites` from stage 4), and sounds through `audio/CLAUDE.md` (`yomi-sound` from stage 4).
  - A renamed name gets a search of the CLAUDE.md files and `.claude/`.

### Content file format (each < 8,000 bytes)

Each file has:

1. a title;
2. a checklist, one line per place, written `file` → `symbol`: what to add;
3. a closing **Tests that catch a miss** list.

| File | Gathers from (design §4.2) |
| --- | --- |
| `spell.md` | engine "A new spell" (all four bullets: `SPELL_IDS`/`MONSTER_SPELL_IDS` with `perkTeaching` in `src/character/perks.ts`; `SPELL_LOOKS` in `src/scenes/battleEffects.ts`, a full `Record`; `spellSound`/`SPELL_SOUND_OVERRIDES` in `src/scenes/sounds.ts`; a rule in `policies.ts` if it should be cast deliberately; `isHealing` for the world map, `autoHeal` and the heal reserve); scenes "A spell" (`SPELL_LOOKS`); combat bullet 3 (`ALL_SPELL_IDS` order is the Skills list's order); character "Nodes are data" (a hero's spell is taught by exactly one node) |
| `status.md` | engine "A new status" (`STATUSES`, `STATUS_IDS`; a `mark` letter and colour; `hostile: true` if a foe lays it to harm, which Purify ends; engine code read through `effectiveStats`/`statsIn` for anything not expressible as a `StatusRule` field; `STATUS_VALUE`); combat bullet 2 (a new `StatusRule` field means engine code, kept out of the RNG unless it is a roll); engine RNG "what never draws" (statuses don't draw) |
| `ability.md` | engine "A new ability" (`ABILITIES`, `ABILITY_IDS` with monsters first and techniques after; a node's `ability`; `ABILITY_SOUNDS` or `SOUNDS_AS_ATTACKS`, enforced by `sounds.test.ts`; `ABILITY_LOOKS` or `STRIKE_FLASHES`; AP only through `abilityApCost`; the description in `foeInfo.ts` comes free); scenes "An ability" (`ABILITY_SOUNDS` unless it is a technique of strikes; optional `ABILITY_LOOKS`/`STRIKE_FLASHES` in `battleEffects.ts`); combat bullet 2 (a new `Ability` field means engine code, kept out of the RNG); combat bullet 3 (`ABILITY_IDS` order is the Abilities tab's order) |
| `trait.md` | engine "A new trait" (`TRAIT_IDS` in `src/combat/combat.ts`; a node's `trait`, switched on by `traitsOf`; the shared helpers `traitToHit`, `traitDamage`, `applyDamage`, the turn-start passes and `auraBonus`; per-unit state on `UnitRecord` and the snapshot, which changes the save shape; a new event field bumps `LOG_SCHEMA_VERSION`; a sound or float in `sounds.ts`/`battleEffects.ts`); character (the engine reads a trait by name) |
| `element.md` | engine "A new element" (`ELEMENTS`; wards are `Partial<Record<Element, number>>`; check the readers that key by name: `ELEMENT_SPELL_SOUNDS` in `src/scenes/sounds.ts`, and the runes in `src/inventory/runes.ts`) |
| `skill-node.md` | character "Nodes are data" (a new node of an existing shape is one `PERKS` entry; `PERKS` order is the tree view's layout; the cost is its tier's, from `TIERS`); the perk-points invariant, by pointer to `src/character/CLAUDE.md` "Perk points"; `yomi-balance` (a growth change retunes: `.claude/skills/yomi-balance/levers.md`, "When to retune") |
| `battle-event.md` | engine "Any event shape change" (bump `LOG_SCHEMA_VERSION`, `formatEvent`, `eventSounds` in `sounds.ts`, `eventSchedule.ts`, `battleEffects.ts`); scenes "A battle event that changes statuses on screen" (`changesStatusMarks` in `battleEffects.ts`); audio (`sounds.test.ts` fails on an event kind that sounds nothing without an entry saying so) |

Some lines are repeated in two files on purpose, such as combat bullets 2 and 3 (design §4.1). Write each file so it stands alone.

## 3. Dependencies and prerequisites

- **Step 01** (expected done) adds the `.claude/` tests to `scripts/claudeMd.test.ts`, with the constants in index C2:
  - `SKILL_LIMIT_BYTES` 4,000;
  - `SKILL_FILE_LIMIT_BYTES` 8,000;
  - `DESCRIPTION_LIMIT_BYTES` 260;
  - `ALWAYS_LOADED_LIMIT_BYTES` 8,500;
  - the frontmatter test: `name` equals the directory name, and `description` is a single line;
  - the name-existence test. Every backticked UPPER_SNAKE constant must occur in a `.ts` file under `src/`, `scripts/` or `e2e/`. Every backticked path starting `src/`, `scripts/`, `art/`, `audio/`, `e2e/`, `docs/` or `.claude/` must exist, after stripping a trailing `:<line>` or `#<anchor>`. Spans containing `<`, `>`, `*`, `{`, `}` or `…` are skipped.
- **Step 02** (expected done) produces `.claude/skills/yomi-balance/` (`SKILL.md`, `bands.md`, `running.md`, `levers.md` with a "When to retune" section, and `guards.md`) and `.claude/agents/yomi-measure.md`. It also replaces character's "Changing hero growth means retuning" with its C4 line and engine's policy-snapshot paragraph with its C4 line. Leave those edits as they are.
- Check that these exist before you start. If a step 02 path is missing, stop and report.
- Existing guides you edit: `src/engine/CLAUDE.md`, `src/combat/CLAUDE.md`, `src/character/CLAUDE.md`, `src/scenes/CLAUDE.md`. Steps 04 and 11 also edit `src/scenes/CLAUDE.md`.

## 4. Scope and implementation guidance

Create the following files (all proposed, index C1):

- `.claude/skills/yomi-add-content/SKILL.md`
- `spell.md`, `status.md`, `ability.md`, `trait.md`, `element.md`, `skill-node.md`, `battle-event.md`, in the same directory.

Edit the guides as the design §4.1 ledger says, using the index C4 pointer lines exactly:

| Guide | Change |
| --- | --- |
| `src/engine/CLAUDE.md` | Remove the whole "Checklists" section (spell, status, ability, trait, element, event shape). Put in its place: "Adding a spell, status, ability, trait, element or battle event: `.claude/skills/yomi-add-content/`." The contract, RNG discipline, Turn-start order and The AI sections stay. |
| `src/combat/CLAUDE.md` | In "When you add data", replace bullet 1 with "Adding a spell, status, ability, trait or element: `.claude/skills/yomi-add-content/`." Keep bullets 2 and 3 where they are; they are also repeated in the content files. |
| `src/character/CLAUDE.md` | In "Nodes are data", move "a new node of an existing shape is one entry there" to `skill-node.md`, with the layout-order fact that goes with it. The rest of the section is rules and stays: `PERKS` ordered by tree, path and tier; ranks, tiers, depth, capstones, asks. Add "A new node: `.claude/skills/yomi-add-content/skill-node.md`." |
| `src/scenes/CLAUDE.md` | In "If you add X, also update Y", remove only the items for an ability, a spell, and a battle event that changes statuses on screen. Their content is now in `ability.md`, `spell.md` and `battle-event.md`. Leave every other item and the heading for step 04, which replaces the section with its pointer line. |

Rules for this step:

- Every symbol and path you write in backticks must exist. The name-existence test fails otherwise. Confirm each one by grep before you write it.
  - A file named only by its basename (`policies.ts`, `eventSchedule.ts`) is not checked, but write the full path the first time it appears, for example `src/engine/policies.ts`.
  - A placeholder such as `<id>` is skipped by the test.
- Don't edit `docs/reference/`, the game code or any other guide.

## 5. Verification

Run with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`:

- `npx vitest run scripts/claudeMd.test.ts` passes: the caps, frontmatter, budget and name-existence tests.
- `npm test` passes.
- Sizes: `wc -c .claude/skills/yomi-add-content/*.md`. `SKILL.md` must be under 4,000 bytes and each other file under 8,000. Check that the four edited guides shrank as expected.
- A self-check of moved lines. Run `git show HEAD:<guide>` for each of the four guides and list every backticked span and bold lead in the removed parts. Each must appear verbatim in a content file or in the guide's remaining text. Put the result, an empty list or justified entries, in `log.md`. The full stage findability check is step 05's job.

## 6. Completion criteria

- [ ] The eight skill files exist. Frontmatter is verbatim, and the index has only this step's rows plus the sound-effect row.
- [ ] The engine Checklists section, combat bullet 1, the character new-node sentence and the scenes ability, spell and battle-event items have moved, and the C4 pointer lines are in place.
- [ ] `npm test` passes, and caps and budget hold.
- [ ] The moved-line self-check is recorded in `log.md` under `## Step 03: yomi-add-content, the battle content` (C7: date, tiers, verdict, rounds, commands and results).
- [ ] The index shows step 03 `done` with its commit(s). Commit message: `Modular context step 03: yomi-add-content, the battle content`, with no attribution lines, staged by path.

## 7. Execution record
