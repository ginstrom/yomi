# Step 08: Stage 1: measure and document

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (§7.2 Balance method, §7.3 Staging, stage 1; R14, R15) · [Feature record](../../features/skill-trees.md) (decision log, guard bands)

**Difficulty:** sonnet / opus. The engineer runs the simulator, writes documentation and plays a short check in the browser: routine but broad, so `model: "sonnet"`. The reviewer is opus (model unset), because it judges whether the docs are true to the code and whether the figures support what is written.

## 1. Objective

Close stage 1 (trees, picks and passives):

- measure the three campaigns and every cell of the plan's Measurement procedure, one run at a time, and fill the **08 stage 1** column of the index's Measurements table, compared with step 01's baseline;
- report, without tuning, any campaign figure under 150 of 500, with the cells that explain it (decision 6);
- record the 500-campaign run time;
- re-record the refactor guard's fixture last, so that it holds stage 1's play;
- make `CLAUDE.md`, the manual's text and the feature record true for stage 1;
- pass the stage's gates (`npm test`, `npm run test:browser`, `npm run build`) and a short play check in the dev server.

This step changes no rule and no number. If a figure looks wrong (a crash, a campaign that never ends, a cell at 0 that step 01 had near 500), report it as a defect of an earlier step rather than fixing it here, unless the fix is a plain bug with an obvious one-line cause; then fix it test-first, say so in the record, and re-measure what it touches.

## 2. Requirements and context

- **R14:** balance is judged with the simulator by the cells and campaign bands of design §7.2. Stage 1 records figures; tuning is stage 4's (steps 24 and 25).
- **R15:** the manual, `CLAUDE.md` and the e2e tests are brought up to date. Stage 1 updates the manual's text; its screenshots are retaken in step 26.
- **Design §7.3, stage 1:** "Baseline and first campaign measurement." Each stage merges on its own, leaves the game playable, passes `npm test` and `npm run test:browser`, re-records the guard, and records its campaign figures.
- **Expected movement (design §6):** stage 1 moves the guard before any active exists: casters lose picks (a level 10 mage goes from about 17 perks and spells to 8 picks), fighters gain them (6 perks to 8 picks), every hero has mana, and the Hedge-Mage no longer heals on today's map. The figure is expected to move; record it and explain the move from the cells.

### Decisions from the index (unchanged)

2. **The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.

6. **Measurement between stages** records figures and does not tune (feature record; brief). A campaign figure under 150 of 500 in stage 1, 2 or 3 is reported to the orchestrator in the step's record and the report, with the cells that explain it, and not tuned around. Tuning is stage 4's.

### Measurement procedure (copied unchanged from the index)

All from seed 1, 500 battles or campaigns, one run at a time. Put each run's output under `logs/<step>-<name>.jsonl` and its summary in a `.txt` beside it.

```sh
P="PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH"
# campaigns
npm run simulate -- --campaign --battles 500 --seed 1 --parties 1 --out logs/NN-one.jsonl > logs/NN-one.txt
npm run simulate -- --campaign --battles 500 --seed 1 --out logs/NN-company.jsonl > logs/NN-company.txt
npm run simulate -- --campaign --battles 500 --seed 1 --ready-level 10 --out logs/NN-rl10.jsonl > logs/NN-rl10.txt
# cells: --encounter E --threat T --party-level L
npm run simulate -- --battles 500 --seed 1 --encounter bandit_camp --threat 3 --party-level 3 --out logs/NN-bc3.jsonl > logs/NN-bc3.txt
```

| Cell | Encounter, threat, level | Target band (design §7.2) |
| --- | --- | --- |
| GR3 | `goblin_raid` 3, level 3 | ≥ 470 |
| BC3 | `bandit_camp` 3, level 3 | 400–470 |
| BC4 | `bandit_camp` 4, level 4 | 430–490 |
| BC5 | `bandit_camp` 5, level 5 | 420–490 |
| SN5 | `spider_nest` 5, level 5 | 410–480 |
| SP5 | `salamander_pool` 5, level 5 | 410–480 |
| TL5 | `troll_lair` 5, level 5 | report only |
| SG7 | `source_guardians` 5, level 7 | within ±40 of step 01 |
| SG10 | `source_guardians` 5, level 10 | above step 01's |
| F1, F2, F3 | `goblin_raid` 1, 2, 3, level 1 | "nearly all, most, 7 in 10" (step 01's figures) |

| Campaign | Band (feature record) |
| --- | --- |
| `--parties 1` | 215–250 of 500 |
| default company | 220–260 |
| `--ready-level 10` | 370–420 |
| heroes dead a campaign (one party) | ≤ 2.0 |
| days a campaign (one party) | step 01's ±10% |

Each measurement step writes its figures into the **Measurements** table below and its own execution record.

For this step `NN` is `08`. The bands are shown for comparison only: stage 1 does not chase them.

### Contracts this step documents (copied unchanged from the index)

The docs written here must describe these as built. Read the code to confirm each before writing it down.

**C1. Trees and paths (step 03)**

```ts
// src/character/trees.ts (new)
export const TREE_IDS = ['warrior', 'scout', 'mage', 'cleric'] as const
export type TreeId = (typeof TREE_IDS)[number]
export const PATH_IDS = ['swordmaster', 'heavy_knight', 'spellsword', 'ranger', 'rogue', 'assassin',
  'evoker', 'cryomancer', 'arcanist', 'healer', 'paladin', 'saint'] as const
export type PathId = (typeof PATH_IDS)[number]
export interface PathInfo { name: string; tree: TreeId; colour: number }
export const PATHS: Record<PathId, PathInfo>          // names: 'Swordmaster', 'Heavy Knight', ...; three per tree in PATH_IDS order
export const TREES: Record<TreeId, { name: string }>  // 'Warrior', 'Scout', 'Mage', 'Cleric'
export type Tier = 1 | 2 | 3 | 'capstone'
export const TIERS: Record<Tier, { level: number; depth: number }>
  // 1: { level: 1, depth: 0 }, 2: { level: 2, depth: 1 }, 3: { level: 6, depth: 3 }, capstone: { level: 12, depth: 5 }
export const MANA_PER_TREE_NODE = 2                  // a node in the Mage or Cleric tree
export function pathsOf(tree: TreeId): PathId[]
export function pathDepth(character: Pick<Character, 'perks'>, path: PathId): number   // nodes held in the path
export function calling(character: Pick<Character, 'perks'>): PathId[]                // the deepest path(s), ties all; [] with no nodes
export function capstoneOf(character: Pick<Character, 'perks'>): PerkId | null
export function treeNodes(character: Pick<Character, 'perks'>, tree: TreeId): number  // nodes held in the tree's paths
```

**C3 (stage-1 part).** Stage 1 has 57 nodes in `PERKS`; stage 2 adds 18 (the 17 techniques and `rooted`), stage 3 adds 20. The six partial nodes in stage 1 and their stage-1 effects: iron_skin `{ resistance: 2 }`; battle_mage `{ maxMana: 6 }`; skirmisher `{ agility: 1 }`; fortune `{ critChance: 10, luck: 1 }`; deadeye `{ archery: 10 }`; serenity `{ friendlyRange: 2 }`. The manual's tables list only the nodes present, each with what it does now.

**C4. The economy (step 03)**

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

**C5. Plans (step 03).** `PLAN_IDS` (15 plans), `AUTO_PLANS`, `planFor` (tagged melee → knight, archery → ranger, magic → evoker_healer), `autoAdvance(character, plan = planFor(character))`: skill points as today; then the first qualifying node of the plan, else the first qualifying non-capstone node in `PERKS` order.

**C7. Spell modifiers and mana (step 04)**

```ts
// maxMana = 2 × INT + (level − 1) × ⌊INT / 2⌋ + MANA_PER_TREE_NODE × (nodes in the Mage and Cleric trees) + perks' maxMana + gear's maxMana
//   (for every hero; INT through attributeLevel)
// magic is emitted for a hero that knows a spell; each modifier (power, healBonus, extend, friendlyRange, apDiscount) only when non-zero
export function spellApCost(stats: Pick<CombatantStats, 'magic'>, spell: SpellId): number   // max(min(apCost, 2), apCost − all − heal)
export function spellRange(stats: Pick<CombatantStats, 'magic'>, spell: SpellId): number
```

**C8. The v22 migration (step 05).** `SAVE_VERSION` 23; `migrateFrom22` after `migrateFrom18`: retired ids (`spellcasting`, `quick_study`) and unknown ids dropped, folded ids mapped (`FOLDED`), every node at rank 1 (grandfathered), `perkPicks = max(0, picksAt(level) − nodes held)`, `spellPicks` deleted, `mana` clamped. Fixture `src/game/fixtures/save-v22.json`.

**C9. The tree-view helper (step 03) and C10 the hero's title (step 07):** `treeLayout(tree)`, `nodeState` with `'locked'`, `nodeHint`, `tierBands`; `heroTitle(character)` ("Level 9 · Heavy Knight", "Level 9 · Heavy Knight / Paladin").

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npm run test:browser` (read `e2e/CLAUDE.md` first); `npm run build` at the stage's end.
- **The simulator.** A 500-campaign run takes about five minutes (`--ready-level 10` longer) and writes some 70 MB. **Run one at a time, never two at once**, each with its own `--out` under `logs/` (gitignored). Do not run the in-browser tests while a timed simulator run is going, or the run time recorded is not the run's own.
- **Determinism.** This step changes no rule; re-running a run gives the same figures.
- **Commits.** One commit for this step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 08: stage 1 measured and documented". No attribution lines. The commit message carries the stage's campaign figures and says the guard fixture was re-recorded for stage 1's play.
- **Docs.** `CLAUDE.md` stays current: search it for every name stage 1 renamed or removed.

## 3. Dependencies and prerequisites

- **Steps 01 to 07 done.** Step 01's column of the Measurements table holds the baseline; steps 03 and 04 re-recorded the guard for their changes (decision 2); step 05 loads v22 saves; steps 06 and 07 restored every in-browser test step 03 listed as failing under the interim view (check step 03's and 06's execution records; if any listed test still fails, that is a blocker to report, not to skip).
- **Existing code** (as left by steps 02–07): `src/character/trees.ts`, `perks.ts` (57 nodes), `progression.ts` (`PICK_LEVEL_STEP`, `picksAt`, `AUTO_PLANS`, `planFor`), `creation.ts`, `character.ts` (`maxMana` for all), `src/combat/spells.ts` (stage-1 spells, `warded`, `spellApCost`, `spellRange`), `src/game/save.ts` (`SAVE_VERSION` 23, `migrateFrom22`), `src/scenes/perkTree.ts`, `PerkTreeView.ts`, `InventoryScene.ts` (Character, Skills, Abilities, Inventory), `CreationScene.ts`.
- **The guard test:** `scripts/simulate.test.ts`, `describe('the refactor guard')` (5 campaigns from seed 1, `--parties 1`; `GUARD_RECORDS` and `GUARD_EVENTS_SHA256`).

## 4. Scope and guidance

### 4.1 Measure

1. Confirm the tree is clean and `npm test` passes before measuring, so the figures are of the committed code.
2. Run the three campaigns and the cells of the procedure above, one at a time, `NN` = `08`. Time each campaign run (`time npm run simulate -- ...`) and record the `--parties 1` run's wall time as "500-campaign run time".
3. From each summary take: wins of 500; for the one-party run also heroes dead a campaign and days a campaign. For the cells, wins of 500.
4. Fill the **08 stage 1** column of the index's Measurements table, and put the full table, with step 01's figures beside, in the execution record.
5. **Compare and explain.** For each campaign, state the move from step 01 and what the cells say about it (for example: BC4 and BC5 rose because the Hedge-Mage no longer heals; SG7 fell because Delwyn has fewer spells). Look at the summaries' casting lines (spells cast, healed) to support the explanation.
6. **Collapse rule (decision 6).** If any campaign is under 150 of 500, write that in the record and the report, with the cells that explain it. Do not change a number.
7. Note whether the ready-made heroes' levels at the end (the summary's lowest and highest level) and deaths moved, and whether any run printed warnings or errors.

### 4.2 Re-record the guard (last)

After the measurements, re-record `GUARD_RECORDS` and `GUARD_EVENTS_SHA256` in `scripts/simulate.test.ts` the way earlier steps did (see steps 03 and 04's records for the method). If the fixture already passes unchanged (steps 03 and 04 re-recorded it and nothing since moved play), say so and leave it. Run `npx vitest run scripts/simulate.test.ts` to show it green.

### 4.3 Document

**`CLAUDE.md`** must be true for stage 1. Read each passage against the code and fix what is wrong; earlier steps should have kept most of it current, so this is a check and a completion. Search it for every removed or renamed name: `PERK_LEVEL_STEP`, `SPELLCASTING_SPELL_PICKS`, `spellPicks`, `spell pick`, `Spellcasting`, `SPELL_TIERS`, `TRUNK_PERKS`, `trunk`, `branch`, `isSpellPerk`, `spellPerkOf`, `perkTreeLayout`, `TreeKind`, `Quick Study`, `xpPercent`, "every `PERK_LEVEL_STEP`th level", `MONSTER_SPELL_IDS` (Web and Curse moved), "Spells tab", "Spell Tree button", "(or K)", `spellTree`, "11 rows", "3 columns and 11 rows", "9 of the view's 11 rows". Passages to cover:

- **Domain layer**: the `src/character/` paragraph (trees.ts as a new module with one line; perks as nodes of a path and tier; `attributeLevel` unchanged); `spells.ts`'s `SPELL_IDS` and `MONSTER_SPELL_IDS` (Web and Curse are hero spells too); `progression.ts`'s line; `party.ts`'s pre-rolls; `bandits.ts`'s drafts and the Hedge-Mage's plan (Flame Arrow at 2, Destruction at 4, Fireball at 6, Heal at 8: on today's map it no longer heals); the policy line if it named Spellcasting.
- **Rules of characters**: mana for every hero (C7's formula); a node has one rank.
- **Rules of creation**: 3 picks among the T1 nodes of all twelve paths; no spell picks.
- **Rules of perks and spells**: rewritten for the trees: four trees of three paths, tiers (C1's `TIERS`), depth, the calling and the one capstone, kinds, `anySkill`, the partial stage-1 nodes (decision 1), the nodes of later stages not yet in `PERKS`.
- **Rules of progression**: a pick at every even level (`PICK_LEVEL_STEP`, `picksAt`); `autoAdvance` follows a plan (`AUTO_PLANS`, `planFor`).
- **Rules of saving**: `SAVE_VERSION` 23 and the v22 migration (`migrateFrom22`, the fixture `save-v22.json`), chained after `migrateFrom18`.
- **Scene layer**: the character panel's tabs (Character, Skills, Abilities, Inventory; Skill Trees button P; K gone), the tree view (four tree tabs, keys 1 to 4, three path columns, the strip), creation's perks step, `heroTitle`; the helper line for `perkTree.ts` and `PerkTreeView.ts`.
- **Rules of scaling**: add one short dated line (2026-…) after stage 6's sentences: "Skill trees stage 1 (…): one party N of 500, the company N, `--ready-level 10` N, from step 01's 230/239/389 re-measured as …; the cells …" and the reason in a clause. Do not restate the rules of scaling; step 26 does that.

**The manual** (`docs/manual/README.md`), text only (screenshots wait for step 26; do not reference images that do not exist):

- §2 Creating a character: the perks step shows four tree tabs; three picks among the first-tier nodes; any path, any tree; only the deepest path may open its capstone.
- §4 The character panel: the tabs (Character, Skills, Abilities, Inventory), the Skill Trees button (P) and the tree view, the title under the name.
- §6 Magic: every hero has mana (the formula in words); spells are nodes of the Mage and Cleric trees and ask Magic; Web, Curse and the new stage-1 spells; Spellcasting gone.
- §7 Growing stronger: a pick at every even level ("Next pick at level N"), tiers and their levels, depth, the calling, one capstone, no respec.
- §11 Reference: the perk table replaced by a table per tree (Warrior, Scout, Mage, Cleric), each listing its paths' present nodes with tier, kind, asks and effect as they work in stage 1.

**The feature record** (`docs/features/skill-trees.md`): fill **Verification** with stage 1's figures (the three campaigns, deaths and days, the cells), step 01's beside them, and any collapse reported; set the plan link to `docs/implementation-plans/skill-trees/`.

### 4.4 Gates and play check

- `npm test`, `npm run test:browser` and `npm run build` pass; record each one's summary line.
- **Play check** in the dev server (`npm run dev`, http://localhost:5173/?seed=42; the `run` or browser skills may help):
  1. New game, create a hero (not the ready-made one) whose three picks span two trees (for example Weapon Training from Warrior and Magic Arrow from Mage); see the four tree tabs and the strip's wording.
  2. Begin; on the world map use the debug console (`~`) to give the hero experience (`xp <amount>`) to reach level 2; open the panel, see "Next pick" gone and one pick waiting, open Skill Trees (P) and take a T2 node; see the title under the name.
  3. Record what was seen, item by item, and anything that looked wrong.
- Stop the dev server afterwards.

### 4.5 Exclusions

- No tuning of any number, plan or count (decision 6).
- No screenshots (step 26).
- No change to stage 2 or 3 nodes.

## 5. Verification

- Every run of §4.1 recorded with its figures; the 08 column of the index filled; the 500-campaign run time recorded.
- Any campaign under 150 of 500 reported with its explaining cells.
- `npx vitest run scripts/simulate.test.ts` green with the fixture holding stage 1's play.
- `npm test`, `npm run test:browser`, `npm run build` pass, outputs recorded.
- `CLAUDE.md` searched for every name listed in §4.3 with none stale; the manual's sections named in §4.3 match the game; the manual references no missing image.
- The play check walked and recorded.

## 6. Completion criteria

- [x] Three campaigns and all cells measured, one at a time; the index's Measurements column **08 stage 1** filled; compared with step 01 and the moves explained.
- [x] Collapse (any campaign under 150) reported, or "none".
- [x] Guard fixture re-recorded last (or confirmed current) and green.
- [x] `CLAUDE.md`, the manual's text and the feature record's Verification current for stage 1.
- [x] `npm test`, `npm run test:browser`, `npm run build` pass; play check recorded.
- [x] One commit; the index's step 08 row set to `done (<commit>)`.

## 7. Execution record

### Done (2026-11-13)

**Measured** on the committed code (clean tree, `npm test` 86 files / 1609 tests green first), seed 1, 500 each, one run at a time, `logs/08-*.jsonl` and `.txt`:

| Figure | 01 baseline | 08 stage 1 |
| --- | --- | --- |
| one party | 230 | 425 (85.0%), 333 days, 21.7 battles |
| company | 239 | 425, 335 days, 21.8 battles |
| `--ready-level 10` | 389 | 470, 573 days, 48.0 battles, 2 out of days |
| deaths a campaign (one party) | 1.8 | 1.0 |
| days a campaign (one party) | 270 | 333 (+23%) |
| GR3 / BC3 / BC4 / BC5 | 500 / 429 / 473 / 469 | 500 / 473 / 485 / 482 |
| SN5 / SP5 / TL5 | 441 / 445 / 0 | 498 / 492 / 0 |
| SG7 / SG10 | 0 / 2 | 4 / 199 |
| F1 / F2 / F3 | 500 / 499 / 441 | 500 / 500 / 493 |
| run time | 270 / 258 / 517 s | 329 / 352 / 663 s (machine loaded; the in-browser tests did not run during the timed runs) |

**Collapse rule:** none; no campaign under 150. The opposite: all three campaign figures are far above their bands (215-250, 220-260, 370-420), and of the cells BC3 (473, band 400-470), SN5 (498) and SP5 (492) (band 410-480) are above theirs, BC4 (485) and BC5 (482) inside, SG10 (199) far above step 01's 2 and SG7 (4) within +4 of 0. Reported, not tuned (decision 6).

**Explanation (supported by the summaries, not isolated by ablation):** the party wins every battle at threats 1 to 4 (99.8% to 100%) and 97.6% at threat 5 (step 01: about 9 in 10 at threat 5); heroes dead a campaign fell from 1.8 to 1.0; battle rounds fell in every cell (BC3 10.3 to 8.2, SN5 7.2 to 5.8, SP5 7.8 to 5.5, F3 10.5 to 8.2), so the fighters gain from the new nodes (Weapon Training +10%, Heavy Hand +2) more than the casters lose by losing picks; the Hedge-Mage no longer heals (`avgEnemyHealing` 0 in the bandit and nest cells), which helps BC3 to BC5; the Source's shaman still heals (17.6 and 26.7 a battle in SG7 and SG10). The one-party run is 23% longer in days because more campaigns reach and win the Source. Levels at the end: lowest 6.9, highest 8.2 (ready level 7). No run printed a warning or error.

**Guard:** `npx vitest run scripts/simulate.test.ts` passes unchanged (107 tests); steps 03 and 04 had re-recorded it and nothing since moved play, so no re-record.

**Docs:** CLAUDE.md read against the code and searched for every name in section 4.3: no stale name remained (steps 03 to 07 had updated it); added the dated stage-1 line in the rules of scaling. Manual: section 6 (mana for every hero, spells as nodes, Web and Curse), 7 (a pick every even level, tiers, depth, calling, one capstone, no respec), 11 (the spell table gained Frostbite, Meteor, Web, Curse, Lay on Hands, Mass Haste, Ward; the Perks table replaced by a node table per tree, generated from `PERKS`) and the Warded status; sections 2 and 4 were already current; every image it references exists. Feature record: Verification filled.

**Gates:** `npm test` 86 files, 1609 tests pass; `npm run test:browser` 10 files, 115 tests pass (274 s); `npm run build` succeeds (chunk-size warning only).

**Play check** (a scripted browser run, a scratch test since removed; creation across two trees is held by `e2e/party.test.ts`): ready-made party on the world map; debug `xp 100 @party_1` made all three level 2 with a pick waiting; the Skills tab listed Weapon Training, Heavy Hand and Toughness; Skill Trees showed Armour Breaker and Shield Wall open; taking Armour Breaker left 0 picks and four taken nodes; the Character tab title read "Level 2 · Swordmaster". Nothing looked wrong. I did not click through the dev server by hand.

