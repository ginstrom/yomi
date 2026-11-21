# Step 04: `yomi-add-content`, the world content files

- **Plan:** [index](index.md) · **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) §4.1, §4.2 · **Stage:** 1
- **Objective:** finish `.claude/skills/yomi-add-content/` with the twelve content files that are not battle content, and move the matching checklists out of `src/game/`, `src/scenes/`, `src/inventory/` and `src/story/` guides, leaving each guide its contracts plus one pointer line.

## 1. Requirements and context

- **R1:** each directory `CLAUDE.md` holds contracts only. Each section that moves has a named destination, and nothing is dropped except what the design drops (here, one duplicate item).
- **R2:** `yomi-add-content` has one file per content type. Each file lists every place to touch across all directories.
- **Format of every content file.** A heading naming the content type, then a checklist with one line per place: `` `file` → `symbol`: what to add ``. After that, a "Tests that catch a miss" list naming the tests that fail when a line is missed (for example `unitLook.test.ts`, `sounds.test.ts`, the yardstick test in `src/game/encounters.test.ts`, the in-browser overlap test, `tsc` for a full `Record`).
- **Moving text.** Move gathered lines; don't rewrite them. Trim them only to fit the format above. Add a line only after confirming it in the code. Keep each file under 8,000 bytes (`SKILL_FILE_LIMIT_BYTES`).
- **Lines that come from `art/CLAUDE.md`** (sprite ids, `idle`/`walk`/`[points] chest`, `map_<kind>`, `camp_<facility>`, `PORTRAIT_IDS`, gear sprite rules) are gathered into these files and point to `art/CLAUDE.md` for how to draw the sprite. Step 10 repoints them to `.claude/skills/yomi-sprites/`. Don't trim `art/CLAUDE.md` in this step; that is step 10.
- **The voiced-beat fields** in `story.md` point to `audio/CLAUDE.md`, "Narration". Step 11 repoints them to `.claude/skills/yomi-sound/narration.md`. Don't trim `audio/CLAUDE.md` in this step.
- **A sound effect** has no content file. Its row in `SKILL.md` (added in step 03, or here if step 03 left it out) points to `audio/CLAUDE.md`, "Which sound plays when".

## 2. Dependencies and prerequisites

- **Step 03** (done before this one) produced:
  - `.claude/skills/yomi-add-content/SKILL.md`, with frontmatter `name: yomi-add-content` and the design's description. It has the "how it works" sentence, the general rules and a table with rows for its own files.
  - `spell.md`, `status.md`, `ability.md`, `trait.md`, `element.md`, `skill-node.md` and `battle-event.md`.
  - The engine checklists, combat bullet 1 and the character node line moved out. The scenes items for an ability, a spell and a battle event were taken out of "If you add X, also update Y".
- **Step 02** produced `.claude/skills/yomi-balance/`, and added the game guide's **Balance** contract bullet: "**Balance.** Anything that changes a battle's outcome, a foe or an encounter moves balance: `.claude/skills/yomi-balance/`." It also replaced the game Checklists' last item (re-running balance). Check that this is done. If the game intro still says "The simulator and the balance figures are in `scripts/CLAUDE.md`", repoint it to `.claude/skills/yomi-balance/` here.
- **Step 01** produced the tests in `scripts/claudeMd.test.ts` (contract C2):
  - caps: `SKILL_LIMIT_BYTES` 4,000, `SKILL_FILE_LIMIT_BYTES` 8,000 and `DESCRIPTION_LIMIT_BYTES` 260;
  - the frontmatter test;
  - the always-loaded budget (`ALWAYS_LOADED_LIMIT_BYTES` 8,500);
  - name-existence: every backticked UPPER_SNAKE constant must occur in a `.ts` file under `src/`, `scripts/` or `e2e/`, or be in `ABSENT_CONSTANTS`. Every backticked repository path starting `src/`, `scripts/`, `art/`, `audio/`, `e2e/`, `docs/` or `.claude/` must exist, after stripping `:<line>` and `#<anchor>`. Spans with `<`, `>`, `*`, `{`, `}` or `…` are skipped as placeholders.
  - So every constant and path you write in backticks must be real, or written as a placeholder.
- **Environment.** Prefix commands with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, because the default `node` is 22.

## 3. Scope and implementation guidance

### 3.1 New files in `.claude/skills/yomi-add-content/`, and where their lines come from

| File | Content type | Gathers from (inspected guides) |
| --- | --- | --- |
| `foe.md` | a foe or unit kind | game "A new foe kind" (sprite named for the kind with `idle` and `walk`, `FOE_XP`, `FOE_NATIVE_LEVEL` if not 1, `FOE_SOUNDS`, a stat block within `foeYardstick` at its native level, each field outside it a named exception); scenes "A unit kind"; combat "Foe scaling and the yardstick" (must pass; a named exception in `src/game/encounters.test.ts`); art (id is the `UnitKind`; `idle`, `walk`, `[points] chest`); the balance line (point to `.claude/skills/yomi-balance/`) |
| `encounter.md` | an encounter | game "A new encounter" (`ENCOUNTERS`, `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`; `SPAWN_KINDS` only if the blight should spawn it); balance (point to `yomi-balance`) |
| `facility.md` | an encampment facility | game "A new facility" (`FACILITIES` in `encampment.ts`, a field in `setFacilityLevel`, `EncampmentScene`'s `OPENS` if it has a screen); scenes "A facility" (sprites `camp_<facility>/level_<n>` in `FACILITY_SPRITES`, a plot in `encampmentView.ts`, six now; the in-browser overlap test checks labels); art (`FACILITY_SPRITES`); the manual's encampment screen (`docs/manual/README.md`, retake its screenshots; `yomi-manual` from step 12) |
| `location-kind.md` | a world map location kind | scenes "A location kind" (an atlas sprite with `idle`, keyed in `LOCATION_SPRITES`); art (`map_<kind>`) |
| `day-action.md` | a one-day action | game "A new one-day action" (a refusal and a time-free apply in its module, a `DayAction` case in `expedition.ts` that `company.ts` runs, a convenience over `act`); game contracts (refusal plus time-free apply; `company.ts` calls only those). Name the contract, don't move it: it stays in the game guide. |
| `item.md` | a base or enchanted item | inventory "One id is one object" (a new item must be in `BASE_ITEMS` or `MAGIC_ITEMS` or saves break; never build a graded, modified or runed item by hand). Name the rule, don't move it: it stays in the inventory guide. Also scenes "An item icon" (`assets/sprites/icon_<icon>.png`, `ITEM_ICON_KEYS` in `itemIcons.ts`), and a pointer to `gear-icon.md` for worn looks. |
| `rune.md` | a rune kind | scenes (`RUNE_ICON_KEYS`, `RUNE_COLOURS`); inventory "Rune fitting" (`runeFits`, `runeFitsOnly`) and `onHitParts` in `src/inventory/runes.ts`; `element.md`, since runes are keyed by element |
| `gear-icon.md` | a weapon, shield, armour, head or cloak look | scenes "A weapon or shield icon…" (`GEAR_SPRITES`, `WORN_SPRITES`, `WORN_BACK_SPRITES` for a cape in `unitLook.ts`, a sprite in `art/gear/`, `WEAPON_SOUNDS` for a weapon, `SWUNG_GEAR` for a blade or axe that swings); inventory "Equipping" last sentence; art (gear sprite, `unitLook.test.ts`) |
| `portrait.md` | a portrait preset | scenes "A portrait preset" (an id in `PORTRAIT_IDS`, an `art/portraits/` sprite `portrait_<id>.png`, `portraitKey`); character (`portraits.ts`); art (`PORTRAIT_IDS`) |
| `party-banner.md` | a party banner | scenes "A party banner" (`BANNER_SPRITES` in `partyList.ts`) |
| `debug-command.md` | a debug command | scenes "A debug command" (an entry in `COMMANDS` in `debugCommands.ts`; commands that change the game run only on the world map; `~` opens the console in dev builds; reference "Debug console") |
| `story.md` | a cutscene, tip, story moment or tutorial anchor | the story guide (see 3.3): a cutscene or tip is an entry in `CUTSCENES` (`cutscenes.ts`, backdrop `public/assets/cutscenes/<name>.png`) or `TUTORIAL` (`tutorial.ts`, in order, maybe a `TutorialAnchor`); `{encampment}` and `{leader}` (`fillText`); a new moment is a case in `StoryMoment` and a scene that raises it; a new anchor is a name in `TutorialAnchor` and a place in the `anchors()` of the scene with the control. A voiced beat's fields (`line`, `voice`, `emotion`, `intensity`, `spoken`, `take`) point to `audio/CLAUDE.md`, "Narration". |

Add a row to `SKILL.md`'s content-type table for each new file, linked with a Markdown link such as `[foe.md](foe.md)`. Add the sound-effect row if step 03 left it out. `SKILL.md` must stay under 4,000 bytes. Don't change its frontmatter: the description is in the always-loaded budget.

### 3.2 Guide trims (design §4.1)

- **`src/game/CLAUDE.md`, Checklists:**
  - The save-shape item becomes a contract bullet under **Contracts**, with its text unchanged: raise `SAVE_VERSION`; write a migration only when a design asks; a migration ends with the strict check and gets a fixture in `src/game/fixtures/`.
  - The facility, encounter, foe-kind and one-day-action items move to the files above.
  - The section becomes the pointer line (C4): "Adding a facility, encounter, foe kind or one-day action: `.claude/skills/yomi-add-content/`."
  - Contracts, The modules and The rules stay.
- **`src/scenes/CLAUDE.md`, "If you add X, also update Y":**
  - Move the remaining items: a unit kind, the gear icons, an item icon and a rune, a portrait preset, a facility, a location kind, a party banner and a debug command.
  - The sound-effect item ("a recipe in `audio/sfx/` built into the manifest (`npm run sounds`), then its cue in `CUES`. A button that closes or steps back belongs in `BACK_LABELS`") is not moved to a content file. Check that `audio/CLAUDE.md` "Which sound plays when" covers it. If any part is missing there (for example `BACK_LABELS`), keep that part in `SKILL.md`'s sound-effect row so it isn't lost.
  - **Drop** "A control a browser test clicks: its scene's probe." It duplicates Probes ("A control that a test needs to click goes in its scene's probe"). Note it in the execution record as the justification step 05's findability check needs.
  - Replace the section with the C4 line: "Adding content (a unit kind, a gear, item or rune icon, an ability, spell, portrait, facility, location kind, party banner, battle event or debug command): `.claude/skills/yomi-add-content/`. A sound effect: `audio/CLAUDE.md`, \"Which sound plays when\"."
  - Keep the contract line "Each asset directory's `README.md` records provenance and licence; update it when files are added." with its reference pointer.
  - Contracts, Probes, Scene flow and Helper modules stay.
- **`src/inventory/CLAUDE.md`, Equipping:** the last sentence ("A new gear icon needs a sprite and a `unitLook.ts` entry …") becomes "A new gear icon: `.claude/skills/yomi-add-content/gear-icon.md`." Every other section stays.
- **`src/story/CLAUDE.md`:**
  - Keep what the modules are; `storyFor`'s order; that `narration.ts` is imported only by tests and `scripts/narration.ts`, never a scene; and that the leader and the tutorial tips are not voiced and a voiced line speaks no `{…}` template.
  - Move the rest to `story.md`: "writing a cutscene or a tip is an entry there", `{encampment}`/`{leader}`, a new moment, a new anchor, and the fields of a voiced beat.
  - Add the C4 line: "Writing a cutscene, tip, story moment or tutorial anchor: `.claude/skills/yomi-add-content/story.md`."
- **`src/game/CLAUDE.md` intro:** if step 02 left "The simulator and the balance figures are in `scripts/CLAUDE.md`", point it to `.claude/skills/yomi-balance/`.
- **`docs/reference/scenes.md` line 3:** "The full detail behind `src/scenes/CLAUDE.md`, which holds the contracts and checklists" becomes "…which holds the contracts; the 'if you add X' checklists are in `.claude/skills/yomi-add-content/`". Change only that sentence. Nothing else in `docs/reference/` changes.

### 3.3 Invariants and exclusions

- Don't touch `art/CLAUDE.md`, `audio/CLAUDE.md` or `e2e/CLAUDE.md` (steps 10–12), or the root `CLAUDE.md` (step 05).
- Don't touch the step 03 files, except to add a cross-link when a line here needs one (for example `rune.md` → `element.md`).
- Change no code, rule or constant.
- Search the `CLAUDE.md` files and `.claude/` for other pointers to the sections you removed: "the foe-kind checklist in `src/game/CLAUDE.md`", "`src/scenes/CLAUDE.md`'s checklist", "the checklist in `src/game/CLAUDE.md`". Repoint each one to the content file.

## 4. Verification

- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npx vitest run scripts/claudeMd.test.ts`: the caps, frontmatter, budget and name-existence tests pass.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes.
- `wc -c` on the four trimmed guides and every new file: each skill file is under 8,000 bytes, `SKILL.md` under 4,000, and `src/game/CLAUDE.md` well under 8,000 (step 13 lowers the directory cap to 8,000).
- A manual ledger walk: for every item removed from the four guides, name its destination file and line in the execution record. Step 05 runs the scripted findability check across all eight stage 1 guides.

## 5. Completion criteria

- [ ] The twelve files exist, each in the checklist format with "Tests that catch a miss", and each listed in `SKILL.md`'s table.
- [ ] The game, scenes, inventory and story guides keep only their contracts and the C4 pointer lines. Save shape is a game contract bullet.
- [ ] The dropped duplicate is recorded with its reason.
- [ ] `docs/reference/scenes.md`'s header sentence is repointed.
- [ ] Every remaining pointer to a moved checklist is repointed.
- [ ] `npm test` passes, and the commit `Modular context step 04: yomi-add-content world content files` is made, with no attribution lines and staged by path.
- [ ] The index row for 04 is `done` with its commit, and a `## Step 04: …` section is appended to `log.md` (C7).

## 6. Execution record

- 2026-11-21. Engineer sonnet. Wrote the twelve files (`foe`, `encounter`, `facility`, `location-kind`, `day-action`, `item`, `rune`, `gear-icon`, `portrait`, `party-banner`, `debug-command`, `story`), each 350 to 1,122 bytes; `SKILL.md` 2,344 bytes with twelve new rows. Guides after: game 7,554, scenes 4,837, inventory 2,925, story 1,223 bytes.
- Every constant and file was grepped in the code. Catch lines were confirmed: `tsc` for the `DayAction` switch (tested by adding a case: errors in `src/game/company.ts` and `src/scenes/partyList.ts`), `FOE_NATIVE_LEVEL`, `FOE_SOUNDS`, `FACILITY_SPRITES`, `LOCATION_SPRITES`, `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`; tests `save.test.ts` (items round-trip), `itemIcons.test.ts`, `partyPanel.test.ts`, `debugCommands.test.ts`. Where nothing enforces a line (`OPENS`, `SPAWN_KINDS`, `SWUNG_GEAR`, `[points] chest`, a banner or portrait sprite, a cutscene backdrop) the file says "not enforced; check by hand".
- Ledger. game: save shape to a Contracts bullet "Saves"; facility, encounter, foe kind, one-day action to `facility.md`, `encounter.md`, `foe.md`, `day-action.md`. scenes: unit kind to `foe.md`; gear icons to `gear-icon.md`; item icon to `item.md`; rune icon and colour to `rune.md`; portrait to `portrait.md`; facility to `facility.md`; location kind to `location-kind.md`; banner to `party-banner.md`; debug command to `debug-command.md`; sound effect: `audio/CLAUDE.md` "Which sound plays when" lacks `BACK_LABELS`, so that sentence is kept in `SKILL.md`'s sound-effect row. inventory: gear-icon sentence to the C4 line (`gear-icon.md`); the rule "One id is one object" stays and `item.md` names it. story: authoring lines to `story.md`. `art/CLAUDE.md` lines (sprite ids, `idle`/`walk`, `[points] chest`, `map_<kind>`, `camp_<facility>`, `PORTRAIT_IDS`, gear sprite rules) gathered and pointed to `art/CLAUDE.md`, which is untouched.
- Dropped: the scenes item "A control a browser test clicks: its scene's probe." It duplicates the Probes section ("A control that a test needs to click goes in its scene's probe"); step 05's findability check needs that justification.
- Deviation: the game guide's "Checklists" and scenes' "If you add X" headings became `## Adding content` holding the C4 line. `docs/reference/game.md` line 3 still says the game guide holds "the checklists" and that the balance figures are in `scripts/CLAUDE.md`; left alone (the plan repoints only `scenes.md`).
- `npm test`: tsc clean; 97 files, 2407 tests passed.
