# Implementation plan: skill trees (Warrior, Scout, Mage, Cleric)

The perk tree and the spell tree give way to four skill trees of three paths each, open to every hero and mixable. Picks come three at creation and one at every even level; every node has one rank; every hero has mana. Heroes gain techniques (weapon actives, some costing mana), Taunt, Rooted and Pin, traits, auras, capstones and new spells. The policy, the pre-rolls, the bandits and the simulator learn them, and the balance is brought back to its bands.

**Source design:** [`docs/designs/skill-trees.md`](../../designs/skill-trees.md) (approved 2026-11-13, committed in `50fb4cf`). **Feature record:** [`docs/features/skill-trees.md`](../../features/skill-trees.md); its decision log binds this plan. Written against `50fb4cf` on branch `skill-trees` (off `main` at `d18abf4`).

The plan covers all four stages of design §7.3, in order. Each stage ends in a playable game with `npm test` and `npm run test:browser` passing, and its last step records the stage's measurements.

## Decisions taken for the orchestrator

The plan follows the design; where the design leaves a choice open, these settle it. None blocks a step. **Items 1, 3 and 6 shape what the player sees between stages or what the simulator plays, and are worth the user's eye.**

1. **When a node enters `PERKS`.** A node joins `PERKS` in the first stage that can deliver its effect (table C3). Six passives enter in stage 1 with only their derived part and are completed later, because the v22 migration maps folded perks onto three of them and their derived part works at once: `iron_skin` (+2 resistance; free-attack bonus in stage 3), `battle_mage` (+6 mana; Strikes' elemental +2 in stage 2; mana on hit in stage 3), `skirmisher` (+1 Agility; +10 to hit after moving in stage 3), `fortune` (+10% critical, +1 Luck; critical damage in stage 3), `deadeye` (+10% Archery, Eagle Eye's effect; pierce and triple dice in stage 3) and `serenity` (friendly range +2; mana regained in stage 3). A node's `description` says only what works in its stage; the step that completes it rewrites the description. Some stage-1 nodes cannot be reached by depth until their path's later nodes arrive (Fortune, Iron Skin, Deadeye): that is expected.
2. **The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
3. **Between steps of a stage the game may be rough, never broken.** Step 03 changes the tree data before step 06 redraws the tree view: until 06, the panel's and creation's old two-way switch shows the Warrior tree ("Perks") and the Mage tree ("Spells") laid out by the new helper. In-browser tests that fail only because of that interim view are listed in step 03's record and restored by step 06; no other in-browser test may fail at any step.
4. **Plans.** `AUTO_PLANS` names fifteen plans (C5). The design's six are written out in full; the parity plans are their path's nodes in `PERKS` order (amended in step 24: the capstone first, and the cryomancer's Ice Lance before Web; see C5). A plan lists only nodes present in `PERKS`, so stage 1 writes each plan without its later nodes and steps 13 and 21 insert them at the positions C5 gives. The Captain follows `knight` (Rooted before Taunt), not the design's §5.8 "Taunt (L2), Rooted (L4)"; the Cutthroat's plan takes Sprint before Tumble, since Tumble asks Rogue depth 3, which a Cutthroat cannot have at level 6 otherwise.
5. **Mana in technique events.** An `AttackEvent` (the first strike only) or `AbilityEvent` of an ability with a `manaCost` carries `manaCost` and `manaAfter`, as a `CastEvent` does (C11).
6. **Measurement between stages** records figures and does not tune (feature record; brief). A campaign figure under 150 of 500 in stage 1, 2 or 3 is reported to the orchestrator in the step's record and the report, with the cells that explain it, and not tuned around. Tuning is stage 4's.
7. **Saves.** `SAVE_VERSION` 23 in stage 1 (step 03 raises it; step 05 adds `migrateFrom22`), 24 in stage 2 (step 11), 25 in stage 3 (step 17). Versions 23 and 24 load into the current version with no game migration: `BattleEngine.restore` fills the new `UnitRecord` fields with their defaults. Version 18 goes through `migrateFrom18` then `migrateFrom22`. Between steps 03 and 05, version-22 saves read as unreadable, and so does the version-18 fixture (its migration yields version 22's shape): step 03 changes that test to expect unreadable, and step 05 restores it.
8. **`LOG_SCHEMA_VERSION`** 25 from step 09 (the first stage-2 step to change an event); steps 10 and 11 change shapes under 25. 26 from step 17; steps 18 to 20 under 26.
9. **The design's "(was Riposte)", "(was Mana Leech, Elemental Fury)", "Lethality", "Devotion", "Divine Favour", "Font of Life", "Beacon" and "Mana Font"** name no perk in today's code. Only the ids in C8's `FOLDED` and `RETIRED` exist; nothing else is migrated.

## Step table

| Step | File | Outcome | Depends on | Engineer tier | Status |
| --- | --- | --- | --- | --- | --- |
| **Stage 1: trees, picks and passives** | | | | | |
| 01 | [Baseline and the v22 fixture](01-baseline-and-v22-fixture.md) | Today's figures re-measured on the unchanged code; `src/game/fixtures/save-v22.json` captured | — | sonnet | done (930f3ea) |
| 02 | [Stage-1 spells and the Warded status](02-stage1-spells.md) | Frostbite, Meteor, Mass Haste, Lay on Hands, Ward; Web and Curse become hero spells; `warded` and `StatusRule.wardAll` | 01 | sonnet | done (8ff7a06) |
| 03 | [Trees, nodes and picks](03-trees-nodes-picks.md) | `trees.ts`; the new `Perk`; the 57 stage-1 nodes; tier, depth, calling, capstone lock; a pick every even level; plans; pre-rolls and bandits rebuilt; `perkTree.ts` reworked; `SAVE_VERSION` 23 | 02 | opus | done (a50c13e) |
| 04 | [Mana for every hero and the derived passives](04-mana-and-derived-passives.md) | `maxMana` for all; `deriveCombatStats` reads the new effects; the engine applies spell power, heal bonus, extension, friendly range and AP discounts | 03 | opus | done (24a2400) |
| 05 | [Save v23: the migration from v22](05-save-migration.md) | `migrateFrom22` chained after `migrateFrom18`; v18 and v22 fixtures load (AC10) | 03, 04 | opus | done (5141cb9) |
| 06 | [The tree view in the panel and in creation](06-tree-view.md) | Four tree tabs, three path columns, tier bands, kind stripes, capstone frame, three-line strip; creation's perks step; e2e restored (AC9) | 03 | opus | done (f1bcf7a) |
| 07 | [The Skills and Abilities tabs and the hero's title](07-panel-tabs-and-title.md) | Character, Skills, Abilities, Inventory; Skill Trees (P); `heroTitle`; "Next pick at level N" | 04, 06 | sonnet | done (bc787c1) |
| 08 | [Stage 1: measure and document](08-stage1-measure.md) | Campaigns and cells measured; guard re-recorded; CLAUDE.md, manual text and feature record current | 05, 07 | sonnet | done (f129959) |
| **Stage 2: hero techniques** | | | | | |
| 09 | [Hero abilities: strikes and statuses](09-hero-strikes.md) | `Ability`/`Strike` extensions; mana, weapon AP, `needs`; self- and foe-status abilities; technique strikes through `attack()`; Cleave's spread; `slowed`, `marked`; `imbueDamage`; `LOG_SCHEMA_VERSION` 25 | 08 | opus | done (8e8e99b) |
| 10 | [Area techniques](10-area-techniques.md) | `AreaAttack` extensions: Volley, Consecrate and Taunt's area | 09 | opus | done (18595ee) |
| 11 | [Taunt, Rooted and Pin](11-taunt-rooted-pin.md) | `taunted`, `rooted`, `pinned`; `StatusLaidEvent`; `UnitRecord.moved`; `ActiveStatus.source`; trait `rooted`; `SAVE_VERSION` 24 (AC5) | 10 | opus | done (9ec03ef) |
| 12 | [The policy uses techniques](12-policy-techniques.md) | `bestStrike` weighs techniques; `tauntUse`, `markUse`, `sprintUse`; taunted units turn on the source; monsters unchanged | 11 | opus | done (c920348) |
| 13 | [Stage-2 nodes and plans](13-stage2-nodes.md) | The 18 stage-2 nodes in `PERKS`; plans and bandit plans take them; Battle Mage's imbue | 12 | sonnet | done (3ef4ea0, guard in the next commit) |
| 14 | [The Skills menu and the techniques' looks](14-skills-menu.md) | `skillMenu.ts`; the Skills button (M); targeting; effects and log lines; nameplate marks; `foeInfo`; AC7 in the browser | 13 | opus | done (294507c; rename a956def) |
| 15 | [Simulator: `--plans` and technique counts](15-simulator-plans.md) | `--plans role=plan,...`; per-side techniques used, taunts, pins, mana on techniques | 13 | sonnet | done (df74ce6) |
| 16 | [Stage 2: measure and document](16-stage2-measure.md) | Campaigns, cells and a first parity look measured; guard re-recorded; docs current | 14, 15 | sonnet | done (e45b36d, ffba662, e62ea8c, 82032ff; opus engineer by the orchestrator's decision) |
| **Stage 3: traits, auras, capstones and the special spells** | | | | | |
| 17 | [Attack and movement traits](17-attack-traits.md) | Iron Skin's free attacks, Counter, Tumble, Skirmisher, Backstab, Ambush, Executioner, Fortune's critical damage, Deadeye, Battle Mage's mana on hit, Arcane Knight; `LOG_SCHEMA_VERSION` 26, `SAVE_VERSION` 25 | 16 | opus | done (ca4c33a) |
| 18 | [Kill and survival traits](18-kill-survival-traits.md) | Deathblow, Blademaster, Unbreakable through `applyDamage` | 17 | opus | done (cf591da) |
| 19 | [Auras and turn-start restores](19-auras-restores.md) | Guardian, Aura of Courage, Aegis (`auraBonus`, `statsIn`); Sanctuary, the `renewing` status, Serenity's mana, Shadowdancer; `RestoreEvent` | 18 | opus | done (8de0df0) |
| 20 | [The special spells](20-special-spells.md) | Purify, Revive, Renew, Holy Light, Ice Lance, Glacial Prison; `frozen`; `hostile` and `helpless` on statuses | 19 | opus | done (85fd5c1) |
| 21 | [Stage-3 nodes, plans and the policy's last steps](21-stage3-nodes-policy.md) | The 20 stage-3 nodes; partial nodes completed; plans; `reviveCast`, `purifyCast`, `supportCast`, `prisonCast`, strikeCast extensions | 20 | opus | done (edcc04b, 77f858f, 27f6d66) |
| 22 | [Stage-3 scenes](22-stage3-scenes.md) | Looks, log lines and marks for the new events and statuses; Revive's aim; restore floats | 21 | sonnet | done (cef16a1) |
| 23 | [Stage 3: simulator lines, measure and document](23-stage3-measure.md) | Deathblows, revives, Unbreakable saves, callings and capstones in the summary; AC8's `--ready-level 12` check; measured; docs current | 21, 22 | sonnet | done (cf53531) |
| **Stage 4: balance** | | | | | |
| 24 | [Path parity and the cells](24-parity-and-cells.md) | Every plan within ±50 of its role's best; capstones checked; cells in band | 23 | opus | done (9016146, 3af5c59, 53cdeb0 and the record commit; cells in band, parity gaps at levels 8 and 12 reported) |
| 25 | [Campaign bands](25-campaign-bands.md) | The three campaigns, deaths and days in band, or the user has accepted the figure (AC11) | 24 | opus | done (6f9eee8; fabb6b8 reverted in the revert commit; the user accepted `--ready-level 10` at 445) |
| 26 | [Manual, screenshots and the scaling rules](26-manual-and-scaling.md) | Manual's tree tables; screenshots retaken; CLAUDE.md's rules of scaling restated; final verification | 25 | sonnet | pending |

**Tiers.** "opus" means leave the engineer's model unset (the session's); "sonnet" means `model: "sonnet"`. Opus steps change the engine's rules, the AI policy, the save migration, the economy or the balance, or carry layout judgement (06, 14). Sonnet steps follow fixed contracts and existing patterns, or measure and document. Reviewers: leave the model unset for every step.

## Execution order

Strictly in table order; no two steps run in parallel. Within a stage some steps touch disjoint files (06 and 05; 14 and 15; 22 and 23's code part), but they share `CLAUDE.md`, the guard fixture and `testHook.ts`, so run them one at a time.

**Checkpoints** (each stage's end is a merge point, design §7.3):

- After **08**: stage 1 complete. `npm test`, `npm run test:browser`, `npm run build` pass; the game is playable with the trees; figures recorded.
- After **16**: stage 2 complete, likewise; AC5, AC7 met.
- After **23**: stage 3 complete, likewise; AC6, AC8 met.
- After **26**: the feature complete; AC1 to AC11 met.

## Requirement map

| Design item | Steps |
| --- | --- |
| R1 four trees, 95 single-rank nodes | 03 (57), 13 (18), 21 (20) |
| R2 node kinds | 03 (`nodeKind`), 09 (abilities with mana) |
| R3 tiers, depth, calling, capstone | 03 |
| R4 picks every even level; spell picks gone | 03 |
| R5 mana for every hero | 04 |
| R6 perks and spells folded | 02, 03, 05 |
| R7 Taunt, Rooted, Pin | 10, 11 |
| R8 other mechanics; determinism | 02, 04, 09, 10, 17, 18, 19, 20 |
| R9 the Skills list in battle | 14, 22 |
| R10 policy, plans, pre-rolls, bandits | 03, 12, 13, 21 |
| R11 tree view, creation, panel tabs | 03 (helper), 06, 07 |
| R12 `SAVE_VERSION` and migration | 03, 05, 11, 17 |
| R13 `LOG_SCHEMA_VERSION`; simulator reports use | 09, 15, 17, 23 |
| R14 balance | 01, 08, 16, 23 (measure), 24, 25 (tune) |
| R15 manual, CLAUDE.md, e2e | every step for CLAUDE.md; 06, 07, 14, 22 (e2e); 08, 16, 23 (manual text); 26 (screenshots, scaling) |
| AC1 | 03 (stage-1 subset), 21 (all 95) |
| AC2 | 03 (with stage-1 stand-ins), 21 (Deathblow and Blademaster) |
| AC3 | 03 |
| AC4 | 04 |
| AC5 | 11 (engine), 12 (the policy attacks the taunter) |
| AC6 | 09, 10, 11, 17, 18, 19, 20 |
| AC7 | 14 |
| AC8 | 15, 23 |
| AC9 | 06 |
| AC10 | 01 (fixture), 05 |
| AC11 | 24, 25 |

## Scope and shared constraints

- **In:** design §2 R1 to R15 and AC1 to AC11, §7's tests, balance method and staging.
- **Out (design non-goals):** respec, classes, stealth, line of sight, terrain, forced movement, new sprites per ability, hand-retuning monster stat blocks.
- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **Commands:**
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run build` at each stage's end.
- **The simulator.** A 500-campaign run takes about five minutes (`--ready-level 10` longer) and writes some 70 MB. **Run one at a time, never two at once**, each with its own `--out` under `logs/` (gitignored). Measurement and tuning belong to steps 01, 08, 16, 23, 24 and 25 only.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, `--parties 1`, each `CampaignRecord` and a SHA-256 of every event). Decision 2 says which steps keep it green and which re-record it.
- **Determinism.** A battle replays from its seed. New rolls draw from the RNG in the order design §5.4 fixes; a passive that rolls nothing draws nothing. A unit whose stats carry none of the new fields behaves exactly as today.
- **Domain first.** Every rule lives in the Phaser-free modules (`src/character/`, `src/combat/`, `src/engine/`, `src/game/`) with tests; scenes decide nothing; Phaser-free helpers in `src/scenes/` stay free of runtime Phaser imports.
- **A node is data.** A new node of an existing shape is one entry in `PERKS`, plus one in `SPELLS` or `ABILITIES` if it teaches something; the tree view places it with no new code.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` (no enums, namespaces or parameter properties), `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit per step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step NN: <title>". No attribution lines.
- **Docs.** `CLAUDE.md` stays current in every step: fix the lines the change makes wrong and search it for every name renamed or removed. Scene steps update the manual's text for their screens. Step 26 retakes the screenshots.

## Measurement procedure (steps 01, 08, 16, 23, 24, 25)

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

## Contracts

Task files copy these unchanged. "Existing" means at `50fb4cf`.

### C1. Trees and paths (step 03; consumed by 04–07, 13, 21, 23)

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

`trees.ts` and `perks.ts` import each other; neither calls the other as its module loads.

### C2. Nodes (step 03; consumed by every later step)

```ts
// src/character/perks.ts
export interface Perk {
  name: string
  description: string          // what works in its stage (decision 1)
  path: PathId
  tier: Tier
  attributes?: Partial<Attributes>
  skills?: Partial<Record<SkillId, number>>
  anySkill?: Partial<Record<SkillId, number>>   // any one suffices: "Melee 40% or Archery 40%"
  requires?: PerkId                              // a node of its own path
  effects: PerkEffects
  meleeOnHit?: readonly OnHit[]                  // added to CombatantStats.onHit while the main hand is melee or bare (Sacred Weapon, Arcane Knight)
  spell?: HeroSpellId
  ability?: AbilityId          // step 13 on
  trait?: TraitId              // step 11 on
}
// PerkEffects keeps every existing key but xpPercent, and gains:
//   resistance, wardAll, wardBlight, shieldAc,
//   spellDamage, fireSpellDamage, frostSpellDamage, healBonus,
//   hostileExtend, friendlyExtend, friendlyRange, spellApDiscount, healApDiscount,
//   imbueDamage, manaOnHit, manaRegen,
//   opportunityToHit, opportunityDamage, rearToHit, rearDamage, movedToHit,
//   executeDamage, critDamage
export function perkLevel(perk: PerkId): number                 // TIERS[PERKS[perk].tier].level
export type NodeKind = 'passive' | 'at-will' | 'mana' | 'spell'
export function nodeKind(perk: PerkId): NodeKind                // spell if `spell`; mana if its ability has manaCost; at-will if `ability`; else passive
export function perkTeaching(spell: HeroSpellId): PerkId | null // replaces spellPerkOf
export function knownSpells(character: Character): HeroSpellId[]       // unchanged
export function knownAbilities(character: Character): AbilityId[]      // step 09 on; ABILITY_IDS order
export function traitsOf(character: Character): TraitId[]              // step 11 on; TRAIT_IDS order
// unchanged in kind: perkRanks (0 or 1), perkBonus, attributeLevel, attributesOf, perkParent,
//   cappedAttribute, missingRequirements, qualifiesFor, availablePerks, describePerkRequirements
// removed: SPELL_TIERS, spellPerk, gain, TRUNK_PERKS, isSpellPerk, SPELL_PERK_IDS, spellPerkOf, Perk.ranks/level/branch/school
```

`missingRequirements(character, perk)` words, in this order: "Level N"; attributes ("Strength 6"); skills ("Melee 40%"); `anySkill` ("Melee 40% or Archery 40%"); `requires` ("Magic Arrow"); depth ("3 nodes in Heavy Knight", only when the tier's depth > 0); for a capstone "Heavy Knight must be your deepest path" and "Only one capstone" (`capstoneOf` non-null). A held node is not qualified for (one rank). `describePerkRequirements` words the same asks for a node out of context.

### C3. The 95 nodes and their stage (steps 03, 13, 21)

`PERKS` is ordered by tree, path (PATH_IDS order), then the order below (by tier). "1p" enters in stage 1 partly (decision 1). Numbers, asks and effects: design §4.3.

| Path | Nodes in `PERKS` order (tier, stage) |
| --- | --- |
| swordmaster | weapon_training (1, 1), heavy_hand (1, 1), power_attack (2, 2), armor_breaker (2, 1), gain_strength (2, 1), cleave (3, 2), weapon_mastery (3, 1), blademaster (★, 3) |
| heavy_knight | toughness (1, 1), shield_wall (1, 1), taunt (2, 2), rooted (2, 2), pin (3, 2), iron_skin (3, 1p), guardian (3, 3), unbreakable (★, 3) |
| spellsword | arcane_blood (1, 1), flame_strike (1, 2), frost_strike (2, 2), spell_ward (2, 1), thunder_strike (3, 2), battle_mage (3, 1p), arcane_knight (★, 3) |
| ranger | marksmanship (1, 1), deadly_aim (1, 1), aimed_shot (2, 2), far_shot (2, 1), hunters_mark (2, 2), volley (3, 2), pinning_shot (3, 2), deadeye (★, 1p) |
| rogue | dodger (1, 1), sprint (1, 2), skirmisher (2, 1p), dirty_trick (2, 2), tumble (3, 3), evasion (3, 1), counter (3, 3), shadowdancer (★, 3) |
| assassin | keen_eye (1, 1), backstab (1, 3), venom_strike (2, 2), hamstring (2, 2), fortune (3, 1p), ambush (3, 3), executioner (3, 3), deathblow (★, 3) |
| evoker | magic_arrow (1, 1), destruction (1, 1), flame_arrow (2, 1), pyromancy (2, 1), fireball (3, 1), acid_arrow (3, 1), death_cloud (3, 1), meteor (★, 1) |
| cryomancer | frostbite (1, 1), numbing_cold (1, 1), sleep (2, 1), frost_blast (2, 1), web (3, 1), ice_lance (3, 3), lingering_cold (3, 1), glacial_prison (★, 3) |
| arcanist | shield (1, 1), arcane_study (1, 1), mirror_image (2, 1), ward (2, 1), haste (3, 1), lasting_magic (3, 1), quickened_casting (3, 1), mass_haste (★, 1) |
| healer | heal (1, 1), mending (1, 1), greater_heal (2, 1), heal_all (2, 1), greater_heal_all (3, 1), purify (3, 3), swift_hands (3, 1), revive (★, 3) |
| paladin | bless (1, 1), smite (1, 2), lay_on_hands (2, 1), blessed_armour (2, 1), aura_of_courage (3, 3), consecrate (3, 2), sacred_weapon (3, 1), aegis (★, 3) |
| saint | serenity (1, 1p), bane (1, 1), protect (2, 1), scholar (2, 1), curse (3, 1), renew (3, 3), holy_light (3, 3), sanctuary (★, 3) |

Stage 1: 57 nodes. Stage 2 adds 18 (the 17 techniques and `rooted`). Stage 3 adds 20. `requires` (same path): flame_arrow → magic_arrow; fireball, acid_arrow → flame_arrow; frost_blast → frostbite; greater_heal, heal_all → heal; greater_heal_all → heal_all.

Stage-1 effects of the partial nodes: iron_skin `{ resistance: 2 }`; battle_mage `{ maxMana: 6 }`; skirmisher `{ agility: 1 }`; fortune `{ critChance: 10, luck: 1 }`; deadeye `{ archery: 10 }`; serenity `{ friendlyRange: 2 }`. Later: battle_mage `imbueDamage: 2` (13), `manaOnHit: 1` (21); iron_skin `opportunityToHit: 15, opportunityDamage: 3` (21); skirmisher `movedToHit: 10` (21); fortune `critDamage: 4` (21); deadeye trait `deadeye` (21); serenity `manaRegen: 2` (21).

### C4. The economy (step 03)

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

### C5. Plans (step 03; extended by 13 and 21; read by 15)

```ts
// src/character/progression.ts
export const PLAN_IDS = ['knight', 'swordmaster', 'spellsword', 'ranger', 'rogue', 'rogue_archer', 'assassin',
  'evoker', 'evoker_healer', 'cryomancer', 'arcanist', 'healer', 'paladin', 'saint', 'bandit_mage'] as const
export type PlanId = (typeof PLAN_IDS)[number]
export const AUTO_PLANS: Record<PlanId, readonly PerkId[]>
export function planFor(character: Character): PlanId   // tagged melee → knight, archery → ranger, magic → evoker_healer
export function autoAdvance(character: Character, plan: PlanId = planFor(character)): void
  // skill points as today; then, while a pick is left: the first node of the plan it qualifies for,
  // else the first qualifying non-capstone node in PERKS order; stops when none qualifies
```

The full lists, in order (a stage writes only the ids present in `PERKS`, keeping this order):

- `knight`: weapon_training, toughness, rooted, taunt, pin, heavy_hand, iron_skin, guardian, unbreakable, shield_wall, power_attack, armor_breaker, weapon_mastery
- `swordmaster`: weapon_training, heavy_hand, power_attack, armor_breaker, cleave, gain_strength, weapon_mastery, blademaster, toughness
- `ranger`: marksmanship, deadly_aim, aimed_shot, far_shot, volley, hunters_mark, pinning_shot, deadeye, dodger, sprint, skirmisher, tumble, evasion
- `rogue` (the Cutthroat's): backstab, dirty_trick, sprint, tumble, evasion, counter, skirmisher, shadowdancer
- `evoker_healer`: magic_arrow, heal, destruction, flame_arrow, heal_all, fireball, pyromancy, mending, meteor, greater_heal, death_cloud, greater_heal_all, purify
- `bandit_mage`: flame_arrow, destruction, fireball, heal, heal_all
- `spellsword`, `assassin`, `evoker`, `arcanist`, `healer`, `paladin`, `saint`: their path's nodes, the capstone first and then the rest in `PERKS` order, so that the capstone is taken as soon as it opens (amended in step 24)
- `cryomancer`: likewise, but with Ice Lance moved ahead of Web (`glacial_prison, frostbite, numbing_cold, sleep, frost_blast, ice_lance, web, lingering_cold`), so that the capstone does not take Ice Lance's pick at level 12 (amended in step 24's review)
- `rogue_archer`: the rogue path's nodes, the capstone first and then the rest in `PERKS` order (the melee-only ones are skipped by their asks)

Pre-rolls and bandits (design §5.8): Aldric weapon_training, heavy_hand, toughness (`knight`); Brenna marksmanship, deadly_aim, dodger (`ranger`); Delwyn magic_arrow, heal, arcane_study (`evoker_healer`; amended in step 24 to build B: magic_arrow, heal, destruction); Garrick weapon_training, marksmanship, dodger (`knight`). Archer and Crossbowman marksmanship, deadly_aim, dodger (`ranger`); Cutthroat weapon_training, dodger, toughness (`rogue`); Brute weapon_training, heavy_hand, toughness (`swordmaster`); Hedge-Mage magic_arrow, shield, arcane_study (`bandit_mage`); Captain weapon_training, toughness, dodger (`knight`). The remaining pre-rolls are rebuilt on T1 nodes of their role, held legal by the existing test.

### C6. Spells and statuses (step 02; extended by 09, 11, 20)

```ts
// src/combat/spells.ts
// SPELL_IDS gains (step 02): 'frostbite', 'meteor', 'mass_haste', 'lay_on_hands', 'ward', 'web', 'curse'
//   (web and curse leave MONSTER_SPELL_IDS, same ids and numbers); step 20 adds 'ice_lance', 'glacial_prison',
//   'purify', 'revive', 'renew', 'holy_light'
// STATUS_IDS gains 'warded' (02); 'marked', 'slowed', 'pinned' (09; pinned's rule in 11); 'taunted' (10, its rule in 11);
//   'rooted' (11); 'renewing' (19); 'frozen' (20)
// StatusRule gains wardAll?: number (02); immobile?: true (11); regen?: number (19); hostile?: true,
//   helpless?: true, wakesOnDamage?: true replacing sleep (20)
// ActiveStatus gains source?: UnitId (11)
```

| Status | Mark | Rule | Step |
| --- | --- | --- | --- |
| warded | G | wardAll 4 | 02 |
| marked | Y | armour class −10 | 09 |
| slowed | L | action points −3 | 09 |
| taunted | T | −`TAUNT_PENALTY` (25) to hit at any unit but its `source` | 10 (the id, no effect), 11 (the rule) |
| pinned | N | immobile | 09 (the id, no effect), 11 (the rule) |
| rooted | R | armour class +10, resistance +2 | 11 |
| frozen | I | helpless, does not wake on damage | 20 |
| renewing | U | regen 3 | 19 |

### C7. Spell modifiers and mana (step 04; consumed by 09, 14, 20, 21)

```ts
// src/combat/combat.ts: CombatantStats.magic gains
magic?: {
  maxMana: number; skill: number; spells: readonly SpellId[]
  power?: { all?: number; fire?: number; frost?: number }   // added to each damaging outcome of its spells, by element, before wards
  healBonus?: number                                         // added to what its heals restore
  extend?: { hostile?: number; friendly?: number }           // turns added to statuses its hostile / friendly spells lay
  friendlyRange?: number                                     // added to the range of a friendly spell aimed at an ally or an area of range > 0
  apDiscount?: { all?: number; heal?: number }               // off a spell's AP (heal: spells with `heal`)
}
// src/combat/spells.ts
export function spellApCost(stats: Pick<CombatantStats, 'magic'>, spell: SpellId): number   // max(min(apCost, 2), apCost − all − heal)
export function spellRange(stats: Pick<CombatantStats, 'magic'>, spell: SpellId): number
// src/character/character.ts
// maxMana = 2 × INT + (level − 1) × ⌊INT / 2⌋ + MANA_PER_TREE_NODE × (nodes in the Mage and Cleric trees) + perks' maxMana + gear's maxMana
//   (for every hero; INT through attributeLevel)
// magic is emitted for a hero that knows a spell (step 09: or an ability with manaCost); each modifier only when non-zero
```

`magic.power` from effects: `all` = spellDamage, `fire` = fireSpellDamage, `frost` = frostSpellDamage. `healBonus` = healBonus. `extend` = hostileExtend / friendlyExtend. `friendlyRange` = friendlyRange. `apDiscount.all` = spellApDiscount, `.heal` = healApDiscount. `deriveCombatStats` also adds `resistance += perkBonus('resistance')`, `ac += perkBonus('shieldAc')` while the off hand holds a shield, `wards[e] += wardAll` for each element and `wards.blight += wardBlight`, and the nodes' `meleeOnHit` to `onHit` while the main hand is melee or bare.

### C8. The v22 migration (step 05)

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

### C9. The tree-view helper (step 03; consumed by 06, 07)

```ts
// src/scenes/perkTree.ts
export interface TreeNode { perk: PerkId; column: number; row: number; from: PerkId | null }
  // column: the path's index within its tree (0–2); row 0 is the path's heading, nodes from row 1 in PERKS order; from: `requires`
export function treeLayout(tree: TreeId): TreeNode[]
export type NodeState = 'taken' | 'open' | 'closed' | 'locked'   // locked: a capstone closed by the calling rule or another capstone
export function nodeState(character: Character, perk: PerkId): NodeState
export function nodeHint(character: Character, perk: PerkId): string   // lock words: "Closed: your deepest path is Assassin", "Closed: you hold Deathblow"
export function draftNodeHint(draft: CharacterDraft, perk: PerkId): string
export function tierBands(tree: TreeId): { tier: Tier; label: 'L1' | 'L2' | 'L6' | 'L12'; firstRow: number }[]
```

Existing exports of the same names keep their callers' shapes where they exist; `perkTreeLayout(kind)` and `TreeKind` are removed.

### C10. The hero's title (step 07)

```ts
// src/character/trees.ts
export function heroTitle(character: Character): string
  // "Level 9 · Heavy Knight"; "Level 9 · Heavy Knight / Paladin" when the second-deepest path holds 3 nodes or more;
  // "Level 1" with no nodes. Ties for deepest: PATH_IDS order.
```

### C11. Hero abilities (steps 09 and 10; consumed by 11–15, 17, 21)

```ts
// src/combat/abilities.ts
export interface Ability {      // existing fields kept; monsters set none of the new ones
  manaCost?: number                                    // paid as the action begins; canUse checks mana
  weaponAp?: number                                    // AP = attackApCost + weaponAp (apCost then ignored)
  needs?: 'melee' | 'ranged'                           // isMelee(stats) must match
  selfStatus?: StatusLaid                              // target is the user (Sprint)
  foeStatus?: { status: StatusLaid; range: number | 'weapon' }   // no roll (Hunter's Mark)
}
export interface Strike {       // damage becomes optional when weapon is set
  weapon?: true; toHit?: number; damageBonus?: number; onHit?: readonly OnHit[]; spreads?: true
}
export interface AreaAttack {   // step 10
  weaponDamage?: true; weaponRange?: true; throughResistance?: true
  foesOnly?: true; auto?: true; bane?: true; centredOnSelf?: true
}
export const ABILITY_IDS = ['troll_claws', 'spider_bite', 'spider_web', 'fire_spit',
  'power_attack', 'cleave', 'taunt', 'pin', 'flame_strike', 'frost_strike', 'thunder_strike',
  'aimed_shot', 'hunters_mark', 'volley', 'pinning_shot', 'sprint', 'dirty_trick', 'venom_strike',
  'hamstring', 'smite', 'consecrate'] as const
export function abilityApCost(stats: CombatantStats, ability: AbilityId): number
  // weaponAp !== undefined ? attackApCost + weaponAp (Arcane Knight's Strikes: + 0, step 17) : apCost
// src/combat/combat.ts: CombatantStats gains imbueDamage?: number (added to each on-hit entry with an element of a Strike)
// src/engine/battleEngine.ts: AttackEvent (first strike only) and AbilityEvent gain manaCost?: number, manaAfter?: number;
//   LOG_SCHEMA_VERSION = 25 (step 09)
```

Step 09 adds the 14 strike and status abilities to `ABILITY_IDS` and `ABILITIES` with design §4.3's numbers; step 10 inserts `taunt`, `volley` and `consecrate` at their places in the list above, with their entries. Taunt's status rule is step 11's. Pin and Pinning Shot lay `pinned` (an id with no rule from step 09): step 09 builds them and tests the strike; step 11 gives `pinned` its rule and tests the pin.

### C12. Taunt, Rooted and Pin (step 11)

```ts
// src/engine/battleEngine.ts
export const TAUNT_PENALTY = 25
// UnitRecord, UnitSnapshot gain moved: boolean  (false as its side's turn begins; true after its first step)
export interface StatusLaidEvent extends EventBase { type: 'status_laid'; unit: UnitId; status: StatusId; turns: number; cause: 'rooted' | 'shadowdancer' }
// AttackEvent, CastOutcome gain tauntPenalty?: number   (25 when applied)
// StatusEndEvent.reason gains 'source_fell' | 'moved' (step 20: 'cleansed')
// src/combat/combat.ts
export const TRAIT_IDS = ['rooted', 'tumble', 'counter', 'ambush', 'deathblow', 'blademaster', 'deadeye',
  'unbreakable', 'shadowdancer', 'guardian', 'courage', 'aegis', 'sanctuary', 'arcane_knight'] as const
export type TraitId = (typeof TRAIT_IDS)[number]
// CombatantStats gains traits?: readonly TraitId[]  (TRAIT_IDS order; only when non-empty)
// src/game/save.ts: SAVE_VERSION = 24; version 23 loads as is; BattleEngine.restore defaults `moved` to false
```

Rules: design §5.4's Taunt, Rooted and Pin rows and §4.7's edge cases.

### C13. Stage-3 engine (steps 17–20; consumed by 21–23)

```ts
// CombatantStats gains (only when non-zero): opportunity?: { toHit: number; damage: number }; rear?: { toHit: number; damage: number };
//   movedToHit?: number; execute?: number; critDamage?: number; manaOnHit?: number; manaRegen?: number
// UnitRecord, UnitSnapshot gain attackedYet: boolean, endured: boolean, refunded: boolean,
//   fallenThisBattle: boolean, usedOnce: SpellId[]   (step 17 adds all five; restore defaults false / [])
// AttackEvent gains counter?: true, ambush?: true, deathblow?: true, apRefunded?: number, manaRestored?: number, endured?: true
// CastOutcome gains revived?: true, endured?: true; StatusTickEvent gains endured?: true
export interface RestoreEvent extends EventBase { type: 'restore'; unit: UnitId; hp?: number; mana?: number; cause: 'renewing' | 'sanctuary' | 'serenity'; source?: UnitId }
  // source: the Sanctuary unit whose aura healed (for "Sera's sanctuary restores 3 to Aldric.")
export interface AuraBonus { ac: number; toHit: number; resistance: number; wardAll: number }
export function auraBonus(units: readonly UnitSnapshot[], unit: UnitSnapshot): AuraBonus
  // best of each aura kind from standing allies in radius: guardian (+5 AC, radius 1, not itself), courage (+5 to hit, 2, not itself),
  // aegis (+2 resistance, +2 wardAll, 2, itself included); two of a kind do not stack
export function statsIn(units: readonly UnitSnapshot[], unit: UnitSnapshot): CombatantStats
  // effectiveStats plus auraBonus; the engine reads the same through its records, and every roll, preview and the policy use it
// LOG_SCHEMA_VERSION = 26 and SAVE_VERSION = 25 (step 17); version 24 loads as is
// Spell gains (step 20): bane?: true; bonusVs?: { statuses: StatusId[]; damage: DamageRoll }; cleanse?: true;
//   oncePerBattle?: true; SpellTarget gains 'fallen'
```

Rules: design §5.4's table, one row per mechanic.

### C14. The Skills menu (step 14; extended by 22)

```ts
// src/scenes/skillMenu.ts (renamed from spellMenu.ts)
export interface SkillMenuRow { kind: 'spell' | 'ability'; id: SpellId | AbilityId; label: string; enabled: boolean; readyIn?: number; why?: string }
export function skillMenuRows(unit: UnitSnapshot, legal: readonly Action[]): SkillMenuRow[]
  // spells (ALL_SPELL_IDS order) then abilities (ABILITY_IDS order); AP from spellApCost / abilityApCost;
  // why: "Needs a melee weapon" / "Needs a ranged weapon" where `needs` fails
export function targetingHint(row: Pick<SkillMenuRow, 'kind' | 'id'>, stats: CombatantStats): string
export function describeStatuses(statuses: readonly ActiveStatus[]): string   // unchanged
```

The battle probe keeps `castButton`; its menu rows gain `kind`.

### C15. The simulator (steps 15 and 23)

```ts
// scripts/simulate.ts
// CliArgs gains plans: Partial<Record<SkillId, PlanId>>  (--plans melee=swordmaster,archery=ranger,magic=cryomancer;
//   unknown role or plan refused; the player's side only; replaces planFor for a hero tagged in that skill;
//   applies to single-battle cells (--encounter --threat --party-level) and to campaigns alike)
// The summary gains per side: techniques used by ability id, taunts laid, pins laid, mana spent on techniques (step 15);
//   counters, deathblows, revives, Unbreakable saves (step 23)
// CampaignRecord gains callings: Partial<Record<PathId, number>> and capstones: Partial<Record<PerkId, number>>
//   (the vanguard's heroes at the end) and the summary the share of campaigns whose vanguard holds a capstone (step 23)
```

### C16. The policy (steps 12 and 21)

Design §5.5's order. Step 12 adds `tauntUse` (5), `markUse` (9), technique scoring in `bestStrike` (11), `sprintUse` (13) and the taunted-unit rule. Step 21 adds `reviveCast` (1), `purifyCast` (3), `supportCast` (6), `prisonCast` (8), and Ice Lance's and Holy Light's scoring in `strikeCast` (10).

```ts
// src/engine/policies.ts
export const STATUS_VALUE: Partial<Record<StatusId, number>>   // chilled 3, slowed 3, pinned 3, poisoned 7, baned 4; seared = the target's regeneration
export const MANA_WEIGHT = 0.5
```

## Measurements

| Figure | 01 baseline | 08 stage 1 | 16 stage 2 | 23 stage 3 | 25 final |
| --- | --- | --- | --- | --- | --- |
| one party (`--parties 1`) | 230 of 500 | 425 of 500 | 449 of 500 | 449 of 500 | 243 of 500 |
| default company | 239 of 500 | 425 of 500 | 449 of 500 | 449 of 500 | 243 of 500 |
| `--ready-level 10` | 389 of 500 | 470 of 500 | 488 of 500 | 488 of 500 | 445 of 500 (over its band; the user's "Back to 63 HP (Rec.)", revisit in stage 9) |
| deaths a campaign (one party) | 1.8 | 1.0 | 0.5 | 0.5 | 1.0 |
| days a campaign (one party) | 270 | 333 | 339 | 339 | 287 |
| GR3 / BC3 / BC4 / BC5 | 500 / 429 / 473 / 469 | 500 / 473 / 485 / 482 | 500 / 494 / 495 / 488 | 500 / 494 / 495 / 488 | 500 / 455 / 462 / 484 |
| SN5 / SP5 / TL5 | 441 / 445 / 0 | 498 / 492 / 0 | 500 / 495 / 8 | 500 / 495 / 8 | 448 / 454 / 0 |
| SG7 / SG10 | 0 / 2 | 4 / 199 | 0 / 422 | 0 / 386 | 0 / 5 |
| F1 / F2 / F3 | 500 / 499 / 441 | 500 / 500 / 493 | 500 / 500 / 493 | 500 / 500 / 493 | 500 / 500 / 453 |
| 500-campaign run time | 270 s (one party; company 258 s, `--ready-level 10` 517 s) | 329 s (company 352 s, `--ready-level 10` 663 s) | 341 s (company 282 s, `--ready-level 10` 592 s) | 272 s (company 270 s, `--ready-level 10` 580 s, `--ready-level 12` 883 s) | 438 s (company 470 s, `--ready-level 10` 1255 s; other work on the machine) |

## Completion criteria

- `npm test`, `npm run test:browser` and `npm run build` pass at each stage's end and at the last step.
- AC1 to AC11 met, each with its evidence in the step that covers it.
- The campaign and cell figures are in band, or the user has accepted the figure (step 25).
- `CLAUDE.md`, the manual and its screenshots are current; the feature record lists the stages' figures.

## Open questions

None blocks a step. Decisions 1, 3 and 6 are defaults for the user to confirm. Step 25 may need the user to accept a figure outside its band.

## For implementers

Set your step's status here (`in progress`, then `done (<commit>)`) and fill the Measurements column if your step measures. Record evidence, deviations and blockers in your task file's **Execution record**. Keep this file short.
