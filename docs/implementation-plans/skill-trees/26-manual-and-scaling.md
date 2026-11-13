# Step 26: Manual, screenshots and the scaling rules

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R15; §5.7 Assets; §7.2 "Stop when … `CLAUDE.md`'s rules of scaling are then restated"; §7.3 stage 4) · [Feature record](../../features/skill-trees.md)

**Difficulty:** sonnet / opus. The engineer writes documentation, updates the screenshot script, retakes the screenshots and walks the game in a browser: broad but routine, so `model: "sonnet"`. The reviewer leaves the model unset, because it judges whether the manual and `CLAUDE.md` are true to the code and the figures, and whether the walk was really done.

## 1. Objective

Close the feature:
- the player's manual tells the trees as the game now has them: a table per tree in section 11 with all 95 nodes at their tuned numbers, and sections 2, 4, 5, 6 and 7 checked against the game;
- `e2e/manual.shots.ts` reaches the tree view, the battle's Skills menu and the panel's Abilities tab, and every screenshot is retaken;
- `CLAUDE.md`'s rules of scaling are restated from step 25's figures as one coherent account, and its rules of perks and spells, of progression and of creation are re-read for truth;
- the final gates pass, the game is walked from creation to a capstone, and the feature record and the index say the feature is done.

## 2. Requirements and context

- **R15:** the manual, `CLAUDE.md` and the e2e tests are brought up to date, and the manual's screenshots are retaken.
- **R14 (its last clause):** `CLAUDE.md`'s rules of scaling are restated from the runs (design §7.2, "Stop when …").
- **Design §5.7:** no new sprites; "the manual gets a table per tree in place of section 11's perk table".
- **Design §4.2, §4.3, §4.6, §4.7:** what the manual must say: three picks at creation and one at every even level; every node one rank; tiers L1, L2, L6, L12 with their depths; the calling and the single capstone; mana for every hero; the kinds of node (passive, at-will, mana, spell); the Skills button (M) in battle; the Skill Trees button (P) and the Abilities tab (B) in the panel; no respec.
- **AC11** is step 25's; this step only writes down its outcome (the figures in band, or the figure the user accepted).
- The numbers in the manual's tables are **the tuned ones in `PERKS`, `SPELLS` and `ABILITIES` at this step**, not the design's first values: read them from the code (a short script over the tables is fine, its output not committed), never from the design.

### Decisions from the index (unchanged)

- **2. The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
- **9.** The design's "(was Riposte)", "(was Mana Leech, Elemental Fury)", "Lethality", "Devotion", "Divine Favour", "Font of Life", "Beacon" and "Mana Font" name no perk in today's code. Only the ids in C8's `FOLDED` and `RETIRED` exist; nothing else is migrated. The manual names none of those as old perks.

This step changes no rule, number or plan: the guard fixture stays as step 25 left it, and must stay green.

### Contracts consumed (copied unchanged from the index)

**C1** (names the manual and `CLAUDE.md` use):

```ts
// src/character/trees.ts
export const TREE_IDS = ['warrior', 'scout', 'mage', 'cleric'] as const
export const PATH_IDS = ['swordmaster', 'heavy_knight', 'spellsword', 'ranger', 'rogue', 'assassin',
  'evoker', 'cryomancer', 'arcanist', 'healer', 'paladin', 'saint'] as const
export const TIERS: Record<Tier, { level: number; depth: number }>
  // 1: { level: 1, depth: 0 }, 2: { level: 2, depth: 1 }, 3: { level: 6, depth: 3 }, capstone: { level: 12, depth: 5 }
export const MANA_PER_TREE_NODE = 2                  // a node in the Mage or Cleric tree
```

(If step 24 or 25 moved a tier's level or depth or `MANA_PER_TREE_NODE`, the code's values are the truth; write those.)

**C2** (node kinds):

```ts
export type NodeKind = 'passive' | 'at-will' | 'mana' | 'spell'
export function nodeKind(perk: PerkId): NodeKind                // spell if `spell`; mana if its ability has manaCost; at-will if `ability`; else passive
```

**C4** (the economy):

```ts
export const PICK_LEVEL_STEP = 2                  // replaces PERK_LEVEL_STEP
export function picksAt(level: number): number    // 3 + ⌊level / 2⌋: every pick a hero has had by `level`
```

**C7** (mana):

```
maxMana = 2 × INT + (level − 1) × ⌊INT / 2⌋ + MANA_PER_TREE_NODE × (nodes in the Mage and Cleric trees) + perks' maxMana + gear's maxMana
```

**C15** (the simulator's flags and summary lines the scaling rules quote): `--plans role=plan,...`; per side techniques used, taunts, pins, mana spent on techniques, counters, deathblows, revives, Unbreakable saves; the vanguard's callings and capstones and the share of campaigns whose vanguard holds a capstone.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **Commands:**
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run build` at each stage's end.
- **The simulator.** A 500-campaign run takes about five minutes (`--ready-level 10` longer) and writes some 70 MB. **Run one at a time, never two at once**, each with its own `--out` under `logs/` (gitignored). Measurement and tuning belong to steps 01, 08, 16, 23, 24 and 25 only. (This step runs none.)
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, `--parties 1`, each `CampaignRecord` and a SHA-256 of every event). Decision 2 says which steps keep it green and which re-record it.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` (no enums, namespaces or parameter properties), `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit per step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 26: manual, screenshots and the scaling rules". No attribution lines.
- **Docs.** `CLAUDE.md` stays current in every step: fix the lines the change makes wrong and search it for every name renamed or removed. Scene steps update the manual's text for their screens. Step 26 retakes the screenshots.

## 3. Dependencies and prerequisites

- **Step 25 (done first)** leaves the tuned numbers in the code, the final campaign figures in the index's Measurements table ("25 final" column) and in its execution record, and either all figures in band or the user's acceptance of a figure outside it, recorded there and in the feature record's decision log.
- **Steps 08, 16 and 23** each added a short stage line to `CLAUDE.md`'s rules of scaling and updated the manual's text for their stage; step 24 recorded the parity and cell figures. This step replaces the three stage lines with one account.
- **Steps 06, 07, 14 and 22** built the screens the screenshots show: the tree view (four tabs, keys 1 to 4, three path columns), the Skills and Abilities tabs and `heroTitle`, the battle's Skills menu (M, `skillMenu.ts`), and the stage-3 looks and marks. Their probes (`src/testHook.ts`) give the controls `manual.shots.ts` clicks.
- **Existing at `50fb4cf`, for reference:** `docs/manual/README.md` (sections 1 to 11; section 11 "Reference" holds the old perk table), its images in `docs/manual/images/`, `e2e/manual.shots.ts` (run by `npm run manual:screenshots` with `vitest.manual.config.ts`, part of neither test run), the debug console (`~`; `xp`, `give`, `fight`, `party` and the rest in `debugCommands.ts`).

## 4. Scope and guidance

### 4.1 The manual (`docs/manual/README.md`)

- **Section 11, Reference:** replace the perk table with four tables, one per tree (Warrior, Scout, Mage, Cleric), each grouped by path in `PATH_IDS` order and by tier within it, every node one row: name, tier (L1, L2, L6, L12 ★), kind (passive, at-will, mana, spell), asks (level from the tier, depth in its path, attributes, skills, "Melee 40% or Archery 40%", the `requires` parent), and its effect with costs (AP as "weapon + N" where it is one, mana, recharge). All 95 nodes, numbers read from the code. The spell and status tables that section holds gain the new spells and statuses (`warded`, `marked`, `slowed`, `taunted`, `pinned`, `rooted`, `frozen`, `renewing`) with their marks.
- **Section 2, Creating a character:** three picks from the T1 nodes of any path, the four tree tabs, the rule line ("3 picks. One more comes with every level. Any path, any tree; only your deepest path may open its capstone."), no spell picks, no Spellcasting.
- **Section 4, The character panel:** tabs Character, Skills, Abilities, Inventory (C, S, B, I); Skill Trees (P) and keys 1 to 4; the hero's title ("Level 9 · Heavy Knight"); the Abilities tab's world-map Cast for heals.
- **Section 5, Battle:** the Skills button (M), spells then techniques, greyed with a reason ("Needs a melee weapon"), aiming a strike, a foe status, an area, a self status, Taunt at the user's hex; the new nameplate letters; free attacks, counters, Tumble.
- **Section 6, Magic:** every hero has mana (the C7 formula in words, with Aldric's 6 and Delwyn's 24 as examples if they still hold), spells cast with the spell skill, techniques with the weapon; spell power, heal bonus, longer statuses, reach and AP discounts from nodes.
- **Section 7, Growing stronger:** a pick at every even level ("Next pick at level N"), skill points as before, the calling, the one capstone ever, no respec; how Revive and Unbreakable soften permadeath (once per battle).
- Check every claim in those sections against the game, not the design; fix anything a later step left stale.

### 4.2 The screenshots (`e2e/manual.shots.ts`)

- Update the script for the screens that changed: creation's perks step on a tree tab, the panel's tree view (one tab with a capstone's lock hint visible if convenient), the Skills tab, the Abilities tab, the battle's Skills menu open, and any screenshot of the old Spells tab or spell tree, which goes.
- Drive the game through probes only, as `e2e/CLAUDE.md` says; stage a hero with techniques through the debug console where the manual needs one.
- Run `npm run manual:screenshots`; retake **every** screenshot, then view each changed image and check the manual references only images that exist.

### 4.3 `CLAUDE.md`

- **Rules of scaling:** replace the stage lines steps 08, 16 and 23 added with one account in the file's existing style: what the trees did to the guard (step 01's baseline → stage 1 → stage 2 → stage 3 → tuned), the levers step 24 and 25 moved and their values, the final one-party, company and `--ready-level 10` figures with days, battles and deaths a campaign, the cells, the path-parity result, how many campaigns' vanguards reach a capstone, and, where a figure sits outside its band, that the user accepted it. Keep the retune advice ("Retune when a hero's growth changes …") true to the new economy.
- **Rules of perks and spells, of progression, of creation, and of characters:** re-read each against the code and rewrite what is stale: the trees and paths, tiers and depths, the calling, the capstone lock, single-rank nodes, picks every even level (`PICK_LEVEL_STEP`, `picksAt`), mana for every hero, the plans (`AUTO_PLANS`, `planFor`), the bandits' plans, the tree view's layout (four tabs, three columns), the Skills menu.
- **Search for every removed name** and fix or remove each line: `Spellcasting`, `spell pick`, `spellPicks`, `SPELLCASTING_SPELL_PICKS`, `PERK_LEVEL_STEP`, `TRUNK_PERKS`, `SPELL_TIERS`, `isSpellPerk`, `spellPerkOf`, `spellMenu`, `perkTreeLayout`, `TreeKind`, "perk tree" and "spell tree" (as two trees), "Spells tab", "Cast button" (now Skills), the K key, `quick_study`, "a perk every third level", "2 ranks". Record the grep and its empty result.
- The simulator paragraph names `--plans` and the summary lines of C15 (steps 15 and 23 should have added them; check).

### 4.4 The play walk

In the dev server (`npm run dev`, Node 26), record what was seen for each:

1. New game, create a character: take three T1 nodes across two tree tabs; Begin.
2. A level-up pick: with the debug console's `xp`, bring a hero to level 2; open the panel, Skill Trees (P), take a T2 node; the panel says the next pick's level.
3. A technique in battle: a hero with a technique (`fight` from the console if needed), Skills (M), use it; the log line and the nameplate letter appear.
4. A capstone: bring a hero to level 12 with depth 5 in one path (console), take its capstone; another path's capstone shows its lock hint.

Stop the dev server afterwards.

### 4.5 Records

- The feature record (`docs/features/skill-trees.md`): phase to the one the orchestrator uses for done implementation ("4 — implemented" or as the record's convention says), the plan link without "(to write)", the final figures under Verification.
- The index: every step's status `done (<commit>)` (this one last, after its commit), the Measurements table complete.

### 4.6 Exclusions

No rule, number, plan, sprite or test-of-play change. If the walk or the docs find a bug, record it in the execution record and report it; do not fix it here.

## 5. Verification

- `npm test`, `npm run test:browser` and `npm run build` pass; record their outputs (pass counts). The guard fixture unchanged and green.
- `npm run manual:screenshots` ran; every changed image viewed; every image the manual references exists.
- Section 11's tables hold 95 rows in all, checked against `PERK_IDS.length` and against the code's numbers (record how).
- The `CLAUDE.md` grep of §4.3's names, with no stale line left.
- The four walk items recorded, each with what was seen.

## 6. Completion criteria

- [ ] The manual's sections 2, 4, 5, 6, 7 and 11 true to the game; four tree tables with all 95 nodes at their tuned numbers.
- [ ] `e2e/manual.shots.ts` updated; every screenshot retaken.
- [ ] `CLAUDE.md`'s rules of scaling restated from step 25's figures as one account; perks, progression, creation and characters rules true; no removed name left.
- [ ] The play walk recorded.
- [ ] The feature record updated; the index's Measurements complete and every step's status done.
- [ ] Index completion criteria (copied unchanged):
  - `npm test`, `npm run test:browser` and `npm run build` pass at each stage's end and at the last step.
  - AC1 to AC11 met, each with its evidence in the step that covers it.
  - The campaign and cell figures are in band, or the user has accepted the figure (step 25).
  - `CLAUDE.md`, the manual and its screenshots are current; the feature record lists the stages' figures.
- [ ] One commit, "Skill trees step 26: manual, screenshots and the scaling rules"; the index's step 26 row updated with status and commit.

## 7. Execution record

