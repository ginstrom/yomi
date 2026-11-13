# Step 05: Save v23: the migration from v22

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R12, §5.9, AC10) · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step writes the save migration the design asks for: it rewrites every hero of a player's saved game onto the new economy, and a slip loses a player's perks or hands out picks they never earned. A migration is written only when a design asks for one; this one does (design §5.9).

## 1. Objective

A save of version 22 (stage 6's, today's `main`) loads into version 23, its heroes' perks mapped onto the new nodes and their picks recomputed from their level. A save of version 18 loads through `migrateFrom18` and then `migrateFrom22`. Both are then checked as strictly as a save of the current version. Between step 03 (which raised `SAVE_VERSION` to 23) and this step, version-22 saves read as unreadable; after it they load again.

No rule of play changes and no scene changes. The refactor guard stays green unchanged.

## 2. Requirements and context

- **R12:** `SAVE_VERSION` is raised. Saves of version 22 (and 18, through the existing migration) load, converted to the new economy.
- **AC10 (R12):** `save-v18.json` and a captured v22 save load. A level 6 fighter from v22 keeps its perks, mapped to the new nodes (design §5.9), and receives `3 + ⌊6/2⌋ − nodes` picks, never fewer than 0.
- **Design §5.9, the migration**, for every character in parties and reserves:
  1. Drop retired perk ids (`spellcasting`, `quick_study`) and any unknown id.
  2. Map each folded id to the node it went into (`FOLDED`).
  3. Collapse every kept or mapped node to rank 1, so a second rank and duplicates from folding become one node. Keep them even where the new asks would refuse them (grandfathered). A `deadeye` from Eagle Eye is kept and counts as the hero's one capstone.
  4. Recompute picks from level: `perkPicks = max(0, picksAt(level) − nodes held)`. Delete `spellPicks`.
  5. Clamp `mana` to the new `maxMana`.
- A caster of today, holding far more perks and spells than `3 + ⌊level/2⌋`, keeps them all and receives no picks until its level catches up.
- A saved battle in a v22 file restores; its units' stats are as saved, so a battle in progress finishes under the stats it began with.

### Decisions from the index (unchanged)

- **7. Saves.** `SAVE_VERSION` 23 in stage 1 (step 03 raises it; step 05 adds `migrateFrom22`), 24 in stage 2 (step 11), 25 in stage 3 (step 17). Versions 23 and 24 load into the current version with no game migration: `BattleEngine.restore` fills the new `UnitRecord` fields with their defaults. Version 18 goes through `migrateFrom18` then `migrateFrom22`. Between steps 03 and 05, version-22 saves read as unreadable, and so does the version-18 fixture (its migration yields version 22's shape): step 03 changes that test to expect unreadable, and step 05 restores it.
- **9.** The design's "(was Riposte)", "(was Mana Leech, Elemental Fury)", "Lethality", "Devotion", "Divine Favour", "Font of Life", "Beacon" and "Mana Font" name no perk in today's code. Only the ids in C8's `FOLDED` and `RETIRED` exist; nothing else is migrated.
- **2. The refactor guard.** This step is among those that **must keep the fixture green unchanged**; a mismatch is a bug.

### Contracts (copied unchanged from the index)

**C4. The economy (step 03, consumed here):**

```ts
// src/character/progression.ts
export const PICK_LEVEL_STEP = 2                  // replaces PERK_LEVEL_STEP
export function picksAt(level: number): number    // 3 + ⌊level / 2⌋: every pick a hero has had by `level`
export function nextPerkLevel(character: Character): number   // the next even level above its level
// levelUp: perkPicks += 1 when the new level is even; skill points and hit points as today
// takePerk(character, perk): spends one perk pick, nothing else
// removed: PERK_LEVEL_STEP, SPELLCASTING_SPELL_PICKS, hasSpellcasting, nextSpellLevel, XpGain.spellsGained, AUTO_PERKS, AUTO_SPELLS
// hasPickFor(character, perk) = character.perkPicks > 0; canAdvance loses the spell branch
// src/character/character.ts: Character.spellPicks removed
// src/character/creation.ts: CREATION_PERK_PICKS = 3 (unchanged); spellPicksLeft and draftCasts removed
// src/game/save.ts: SAVE_VERSION = 23
```

**C8. The v22 migration (this step):**

```ts
// src/game/save.ts (private)
const RETIRED_PERKS = ['spellcasting', 'quick_study']
const FOLDED: Record<string, PerkId> = {
  mighty_blow: 'weapon_mastery', sunder: 'weapon_mastery', gain_endurance: 'toughness', gain_perception: 'far_shot',
  eagle_eye: 'deadeye', gain_agility: 'skirmisher', tireless: 'evasion', gain_luck: 'fortune',
  deep_well: 'destruction', arcane_mastery: 'lingering_cold', gain_intelligence: 'lasting_magic',
}
function migrateFrom22(game: Record<string, unknown>): void   // after migrateFrom18 for a v18 file
```

For each character in every party and the reserves: drop retired and unknown ids; map folded ids; every node held to rank 1 (kept even where the new asks refuse it; a grandfathered `deadeye` counts as the capstone); `perkPicks = max(0, picksAt(level) − nodes held)`; delete `spellPicks`; clamp `mana` to the new `maxMana`. A saved battle is kept; its units' stats are as saved.

**C7 (step 04, consumed here):** `maxMana = 2 × INT + (level − 1) × ⌊INT / 2⌋ + MANA_PER_TREE_NODE × (nodes in the Mage and Cleric trees) + perks' maxMana + gear's maxMana`, for every hero; INT through `attributeLevel`.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`).
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run src/game/save.test.ts` for this file; `npx vitest run --project domain`.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) must stay green unchanged. Do not edit its fixture.
- **Determinism.** No draw of any RNG is added, dropped or reordered.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit for this step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 05: save v23, the migration from v22". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines this change makes wrong and search it for every name renamed or removed.

## 3. Dependencies and prerequisites

- **Step 01** captured `src/game/fixtures/save-v22.json` from the unchanged code (a company with a level 6 fighter holding folded perks and a caster holding more nodes than `picksAt(6)`, possibly mid-battle); its contents, member by member, are listed in step 01's execution record. Read that record for the expected values; do not regenerate the fixture.
- **Step 03** provides C4: `picksAt`, `Character` without `spellPicks`, `SAVE_VERSION = 23`, the new `PERKS` (with `weapon_mastery`, `toughness`, `far_shot`, `deadeye`, `skirmisher`, `evasion`, `fortune`, `destruction`, `lingering_cold`, `lasting_magic` all present, decision 1). Since step 03, `parseSave` reads version 22 as unreadable.
- **Step 04** provides `maxMana` for every hero (C7), which the clamp reads.
- **Existing code at `50fb4cf`, for reference** (`src/game/save.ts`): `SAVE_VERSION`; `migrateFrom18(game)` turns a version-18 game into the company shape of version 22; `parseSave` accepts `SAVE_VERSION` or 18, migrates 18, then checks the parties, orders, world, runes, reserves, story and battle, and builds characters with `characterOf` (which refuses a perk, skill or item the game does not have). `src/game/save.test.ts` has `describe('a version-18 save')` reading `fixtures/save-v18.json`.

## 4. Scope and implementation guidance

### 4.1 `src/game/save.ts`

- Add `RETIRED_PERKS`, `FOLDED` and `migrateFrom22` exactly as C8.
- `migrateFrom22` works on the raw parsed game (plain objects, before `characterOf`), over every member of every party and every reserve:
  - build the new `perks` record: for each id held with a rank ≥ 1, skip it if retired; map it through `FOLDED`; keep it only if it is now a key of `PERKS`; set it to 1 (so `weapon_training: 2` becomes 1, and `mighty_blow` plus `sunder` become one `weapon_mastery`);
  - `perkPicks = max(0, picksAt(level) − Object.keys(perks).length)`;
  - `delete spellPicks`;
  - clamp `mana` to `maxMana` of the migrated character. `maxMana` needs a `Character` (gear, attributes through perks): compute it on the character once built (for instance clamp after `characterOf`, only for a migrated file), or build a temporary one; pick whichever keeps `characterOf` the single place that turns raw data into a `Character`.
  - Validate as you go with `check` as `migrateFrom18` does (a member with no numeric `level` or no `perks` object makes the file unreadable).
- `parseSave` accepts versions `SAVE_VERSION` (23), 22 and 18: 18 runs `migrateFrom18` then `migrateFrom22`; 22 runs `migrateFrom22`; then every existing check runs as for a current save. Keep the v18 battle's `party = FIRST_PARTY_ID` fix-up.
- A saved battle's engine snapshot is kept untouched (its units' stats are as saved).
- Update the module's doc comment on versions and migrations, and `migrateFrom18`'s ("as a version-22 one", then migrated on).

### 4.2 Exclusions

- No grandfathering check beyond keeping the nodes: a migrated hero may hold a node whose asks it no longer meets, or two capstones never (only `deadeye` can arrive as a capstone).
- No reverse migration (design §6).
- No scene, no simulator change. `e2e/saves.test.ts` needs nothing new.

### 4.3 `CLAUDE.md`

In the rules of saving: `SAVE_VERSION` is 23; a version-22 save loads through `migrateFrom22` (perks folded and collapsed to one rank, picks recomputed as `picksAt(level) − nodes`, never below 0, `spellPicks` gone, mana clamped), and a version-18 save through `migrateFrom18` and then `migrateFrom22`; the fixtures are `save-v18.json` and `save-v22.json`. Fix the sentence that names version 22 as current.

## 5. Verification

### Tests (in `npm test`, `src/game/save.test.ts`)

- **The v22 fixture loads** (`describe('a version-22 save')`): `parseSave` of `fixtures/save-v22.json` is not null and its game has the parties, reserves, world and battle (if any) step 01 recorded.
- **AC10:** the level 6 fighter keeps its perks mapped: `mighty_blow` and `sunder` give one `weapon_mastery`, `gain_endurance` gives `toughness`, `weapon_training` at rank 2 becomes rank 1; every value in its `perks` is 1; `perkPicks` is `max(0, 3 + 3 − nodes)` for its node count.
- The caster holding more nodes than `picksAt(level)` keeps every surviving node and has `perkPicks` 0.
- `spellcasting` and `quick_study` are gone from every hero; no hero has a `spellPicks` field; every `mana` ≤ `maxMana`.
- A battle saved in the v22 file is kept: `battle` is non-null, names its party, and its engine snapshot's units equal the fixture's.
- **The v18 fixture loads** through both migrations, and its heroes meet the same rules (ranks 1, picks recomputed, no `spellPicks`).
- Small synthetic cases (a raw v22 save built in the test): an unknown perk id is dropped; a folded duplicate (`eagle_eye` with `deadeye` mapped twice) is one node; `perkPicks` never below 0; a member without a numeric `level` makes the file unreadable; a version-21 or version-20 file stays unreadable.
- A current (v23) save round-trips unchanged (the existing round-trip tests stay green).

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run src/game/save.test.ts
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test
```

`npm test` includes the refactor guard, which must pass unchanged. No scene changes: `npm run test:browser` is not required for this step (run `-- -t "slot"` or `e2e/saves.test.ts` only if a load path in a scene was touched, which it should not be).

### Acceptance

- AC10 holds, shown by the tests above.
- `git diff` touches only `src/game/save.ts`, `src/game/save.test.ts`, `CLAUDE.md` and this plan's files.

## 6. Completion criteria

- [ ] `migrateFrom22`, `RETIRED_PERKS` and `FOLDED` as C8; `parseSave` accepts 23, 22 and 18, migrated then checked as strictly as a current save.
- [ ] The tests of §5 written first and passing; `npm test` green, the refactor guard unchanged.
- [ ] `CLAUDE.md`'s rules of saving updated.
- [ ] Committed as "Skill trees step 05: save v23, the migration from v22".
- [ ] The index's step table shows step 05 `done (<commit>)`.
- [ ] The execution record below lists the tests, the fixture values checked and any deviation.

## 7. Execution record

### Round 1 (engineer, 2026-11-13)

Code at `c2b1d51`. Node 26. Baseline `npx vitest run src/game/save.test.ts scripts/simulate.test.ts`: 143 passed.

**What was built** (`src/game/save.ts`): `RETIRED_PERKS`, `FOLDED` and `migrateFrom22` as C8. `migrateFrom22` works on the raw game before `characterOf`, over every member of every party and the reserves: a member without an integer `level` ≥ 1, or whose `perks` is not an object of numbers, makes the file unreadable; ids at rank < 1 and retired ids are skipped, folded ids mapped, ids not in `PERK_IDS` dropped, the rest set to 1; `perkPicks = max(0, picksAt(level) − nodes)`; `spellPicks` deleted. The mana clamp runs after `characterOf` (only for a migrated file, `clampMana`), so `characterOf` stays the one place raw data becomes a `Character` and `maxMana` reads the built character (gear included). `parseSave` accepts 23, 22 and 18; 18 runs `migrateFrom18` (and the battle's `party` fix-up) then `migrateFrom22`; 22 runs `migrateFrom22`; every existing check then runs. The battle and its engine snapshot are untouched. Module doc comments updated.

**Tests** (`src/game/save.test.ts`, written first, 15 red for the expected reason, a null load):
- `describe('a version-22 save')`: the fixture is v22 and holds the old ids; it loads with its parties (`party_1` Aldric, Delwyn; `party_2` "Second Company" Brenna), reserve Garrick (level 4), guild hall 4, turn and positions as written, no battle, `savedAt` 1 700 000 000 000; AC10 for Aldric; Delwyn's 11 nodes with 0 picks, `maxMana` 62 and mana 40; Brenna's and Garrick's folds and picks; no retired id, every rank 1, no `spellPicks`, mana ≤ `maxMana` for every hero; re-saves as version 23 and round-trips; a battle injected into a v22 save is kept, `party` and `engine` equal; synthetic v22 inputs (built from `gameUnderWay`, version set to 22, `spellPicks` added): an unknown id (`second_wind`) dropped, `eagle_eye` with `deadeye` and `gain_luck` (rank 2) with `fortune` each one node, a rank-0 perk dropped, picks clamped at 0 (level 1 holding 5 nodes with 7 saved picks) and recomputed (level 5 holding 1: `picksAt(5) − 1`), mana 999 clamped to `maxMana`, missing or string `level`, null or non-numeric `perks`, non-array reserves unreadable; versions 20 and 21 unreadable; a bad item or order still refused.
- The v18 tests step 03 had turned to "unreadable" are restored: `migrates a version-18 battle to the first party`, and `migrates into a company of one, its heroes on the skill trees` (the old assertions, plus perks after the migration, picks `[0, 0, 0]`, no `spellPicks`, Delwyn's mana 18, re-saved as `SAVE_VERSION`).

**Fixture values checked, and corrections to step 01's hand-worked table.** Step 01's record took `picksAt(6)` as 9; by C4 it is `3 + ⌊6/2⌋ = 6` (`picksAt(4) = 5` was right). So:

| Name | Nodes | `perkPicks` (step 01 said) | `perkPicks` (actual) | maxMana |
| --- | --- | --- | --- | --- |
| Aldric | 3 | 6 | **3** | 0 (mana 0) |
| Delwyn | 11 | 0 | 0 | **62**, confirmed (below) |
| Brenna | 6 | 3 | **0** | **22**, not 20: `lasting_magic` (folded from `gain_intelligence`) adds 1 Intelligence, so 2 × 5 + 5 × 2 + 2 × 1 (mana 0 either way) |
| Garrick | 3 | 2 | 2 | 9 |

Delwyn re-derived against the trees as built: `arcane_study` is an arcanist node (Mage tree) in `PERKS`, so his Mage and Cleric nodes are lingering_cold, destruction, arcane_study, magic_arrow, flame_arrow, fireball, heal, heal_all, shield, bless = 10 (deadeye is ranger, Scout); `lingering_cold` and `arcane_study` add Magic skill, not Intelligence; maxMana = 18 + 5 × 4 + 2 × 10 + 4 (Destruction) = 62, which the test asserts through `maxMana`. The expectation stood.

The v18 fixture after both migrations: Aldric {weapon_training, toughness, heavy_hand}, Brenna {marksmanship, deadly_aim, dodger}, Delwyn {arcane_study, keen_eye, magic_arrow, heal} (spellcasting dropped), all level 1, picks 0, Delwyn's mana 18 (new maximum 24).

**Commands.** `npx vitest run src/game/save.test.ts`: 51 passed. `npm test`: tsc clean, 85 files, 1590 tests passed, the refactor guard green with its fixture unchanged. No scene touched, so no in-browser run.

**Deviations.** None from the task. `git diff` touches only `src/game/save.ts`, `src/game/save.test.ts`, `CLAUDE.md` and this plan's files.

**For later steps.** When steps 11 and 17 raise `SAVE_VERSION`, add the previous current version (23, then 24) to `parseSave`'s accepted list `[SAVE_VERSION, 22, 18]`; such a save loads with no game migration. `migrateFrom22` runs only for versions 22 and 18 (`migrated` names them explicitly), so a 23 is never migrated again.
