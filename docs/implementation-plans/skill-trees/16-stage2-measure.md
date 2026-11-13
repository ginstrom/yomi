# Step 16: Stage 2: measure and document

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (§7.2 balance method, §7.3 stage 2; R13, R14, R15) · [Feature record](../../features/skill-trees.md)

**Difficulty:** sonnet. The engineer runs with `model: "sonnet"`; leave the reviewer's model unset. This step writes no rule: it measures stage 2, records what it finds, re-records the guard and brings the docs up to date. The reviewer checks the figures against the logs and the docs against the code.

## 1. Objective

Close stage 2 (hero techniques) as a merge point:

- the three campaigns and every cell of the index's Measurement procedure, run one at a time, with the **16 stage 2** column of the index's Measurements table filled;
- a first look at path parity (design §7.2 item 2): Bandit Camp threat 4 at levels 4 and 8 with each plan in its role's slot through `--plans`, **recorded only, not tuned**;
- the techniques each side used, taken from the summaries;
- the refactor guard re-recorded, last;
- `CLAUDE.md`, the manual's text and the feature record true for stage 2;
- `npm test`, `npm run test:browser` and `npm run build` passing, and a short play check of Taunt and Pin in the dev server.

## 2. Requirements and context

- **R13:** the simulator reports what heroes use (step 15 built the summary lines; this step reads them).
- **R14:** balance is judged with the simulator by the cells and bands of §7.2. Between stages the figures are recorded, not chased (decision 6 below).
- **R15:** the manual and `CLAUDE.md` are brought up to date (screenshots wait for step 26).
- **Design §7.3, stage 2:** each stage merges on its own, leaves the game playable, passes `npm test` and `npm run test:browser`, re-records the guard and records its campaign figures.
- **AC5 and AC7** were met by steps 11 and 14; this step confirms the stage still meets them by the play check and the in-browser run.

### Decisions from the index (unchanged)

- **2. The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
- **6. Measurement between stages** records figures and does not tune (feature record; brief). A campaign figure under 150 of 500 in stage 1, 2 or 3 is reported to the orchestrator in the step's record and the report, with the cells that explain it, and not tuned around. Tuning is stage 4's.
- **8. `LOG_SCHEMA_VERSION`** 25 from step 09 (the first stage-2 step to change an event); steps 10 and 11 change shapes under 25. 26 from step 17; steps 18 to 20 under 26.
- **7. Saves.** `SAVE_VERSION` 23 in stage 1 (step 03 raises it; step 05 adds `migrateFrom22`), 24 in stage 2 (step 11), 25 in stage 3 (step 17). Versions 23 and 24 load into the current version with no game migration: `BattleEngine.restore` fills the new `UnitRecord` fields with their defaults. Version 18 goes through `migrateFrom18` then `migrateFrom22`. Between steps 03 and 05, version-22 saves read as unreadable, and so does the version-18 fixture (its migration yields version 22's shape): step 03 changes that test to expect unreadable, and step 05 restores it.

### Measurement procedure (copied from the index)

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

### Contracts consumed (copied unchanged from the index)

**C5. Plans** (the parity runs name them):

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

**C15. The simulator** (step 15 built the stage-2 part):

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

**C11, C12** (what the docs describe): `Ability` gains `manaCost`, `weaponAp`, `needs`, `selfStatus`, `foeStatus`; `Strike` gains `weapon`, `toHit`, `damageBonus`, `onHit`, `spreads`; `AreaAttack` gains `weaponDamage`, `weaponRange`, `throughResistance`, `foesOnly`, `auto`, `bane`, `centredOnSelf`; `ABILITY_IDS` holds the monsters' four then the 17 techniques; `abilityApCost(stats, ability)`; `CombatantStats.imbueDamage`; `AttackEvent` (first strike only) and `AbilityEvent` carry `manaCost` and `manaAfter` for a mana ability; `LOG_SCHEMA_VERSION = 25`. `TAUNT_PENALTY = 25`; `UnitRecord.moved`; `StatusLaidEvent` (`type: 'status_laid'`, cause `'rooted' | 'shadowdancer'`); `tauntPenalty` on `AttackEvent` and `CastOutcome`; `status_end` reasons `'source_fell'` and `'moved'`; `TRAIT_IDS`, `CombatantStats.traits`; `SAVE_VERSION = 24`, version 23 loading as is.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **The simulator.** A 500-campaign run takes about five minutes (`--ready-level 10` longer) and writes some 70 MB. **Run one at a time, never two at once**, each with its own `--out` under `logs/` (gitignored).
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, `--parties 1`, each `CampaignRecord` and a SHA-256 of every event). This step re-records it, last.
- **Commits.** One commit for this step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 16: stage 2: measure and document". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines stage 2 made wrong and search it for every name renamed or removed in steps 09 to 15 (`spellMenu`, `spellMenuRows`, the Cast button, `MONSTER`-only wording of abilities).

## 3. Dependencies and prerequisites

- **Steps 09 to 15 done**, in particular:
  - 13: the 18 stage-2 nodes in `PERKS` and the plans and bandit plans carrying them (the step that re-recorded the guard for play);
  - 14: the Skills menu (`skillMenu.ts`), the Skills button (M), the techniques' looks and log lines, AC7's in-browser test;
  - 15: `--plans` and the per-side technique lines in the summary.
- **Step 01's and step 08's figures** in the index's Measurements table, to compare against.
- **Not yet in the game** (stage 3): traits beyond `rooted`, auras, capstones, Purify, Revive, Renew, Holy Light, Ice Lance, Glacial Prison. Parity plans of paths whose later nodes are stage 3's (healer, saint, assassin, rogue) run with what stage 2 has; say so beside their figures.

## 4. Scope and guidance

### 4.1 Measure

1. Confirm `npm test` passes before measuring; the guard may fail only as step 13 left it re-recorded (it should be green).
2. Run the three campaigns as `logs/16-one`, `logs/16-company`, `logs/16-rl10`, one at a time; time the one-party run (`time`) for the run-time row.
3. Run every cell (GR3, BC3, BC4, BC5, SN5, SP5, TL5, SG7, SG10, F1, F2, F3) as `logs/16-<cell>`.
4. **Path parity, first look** (design §7.2 item 2, record only). For each role and plan, Bandit Camp threat 4 at party levels 4 and 8:

   ```sh
   npm run simulate -- --battles 500 --seed 1 --encounter bandit_camp --threat 4 --party-level 4 --plans melee=swordmaster --out logs/16-par-melee-swordmaster-4.jsonl > logs/16-par-melee-swordmaster-4.txt
   ```

   - melee: swordmaster, knight, spellsword, assassin, paladin
   - archery: ranger, rogue_archer, assassin
   - magic: evoker, cryomancer, arcanist, healer, saint

   That is 13 plans × 2 levels = 26 runs, each a few seconds to a minute. Record wins of 500 and the gap to the role's best at that level; flag any plan more than 50 below its role's best. Do not change a number.
5. From the summaries, copy per side the techniques used by id, taunts laid, pins laid and mana spent on techniques, for the one-party campaign and BC4.
6. **If any campaign figure is under 150 of 500**, stop tuning thoughts: record it, name the cells that explain it (which encounter loses most, which side's techniques dominate), and put it at the top of the step's report (decision 6).
7. Fill the **16 stage 2** column of the index's Measurements table, and the same figures with step 08's beside them in the execution record.

### 4.2 Re-record the guard (last)

After every docs edit and before the commit, re-record the fixture of `describe('the refactor guard')` (`GUARD_RECORDS`, `GUARD_EVENTS_SHA256`) from the current code and run `npm test`. The commit message says the guard was re-recorded for stage 2's close and why it moved (or that it did not).

### 4.3 Document

- **`CLAUDE.md`**, true for stage 2:
  - the `abilities.ts` mention in the combat line: abilities are heroes' too (techniques), with mana, weapon AP (`abilityApCost`), `needs`, self- and foe-status abilities, technique strikes resolved as weapon attacks, Cleave's spread, the area extensions (Volley, Consecrate, Taunt);
  - the engine's rules: technique strikes through `attack()` with flanking and arc; Taunt (`TAUNT_PENALTY`, `source_fell`), Rooted (`moved`, `status_laid`), Pin (`immobile`, no legal move); the statuses `marked`, `slowed`, `taunted`, `pinned`, `rooted`;
  - the policy line: techniques weighed in `bestStrike` on equal AP with `STATUS_VALUE` and `MANA_WEIGHT`, `tauntUse`, `markUse`, `sprintUse`, taunted units turning on the source;
  - `LOG_SCHEMA_VERSION` 25 and `SAVE_VERSION` 24 (version 23 loading as is) in the rules of saving;
  - the battle scene: the Skills button (M), `skillMenu.ts` in the helpers list (replacing `spellMenu.ts`);
  - the simulator flags paragraph: `--plans` and the new summary lines (if step 15 left it undone);
  - in the rules of scaling, one short dated line: stage 2's campaign figures and the cells that moved most, without restating the old paragraph (step 26 restates it).
  - Search for every name stage 2 renamed or removed and fix or drop the lines.
- **Manual** (`docs/manual/README.md`), text only: §5 Battle (the Skills button replaces Cast: spells and techniques, costs and recharge, greyed rows and why; Taunt, Rooted, Pin and their marks T, R, N; marked Y and slowed L) and §6 Magic (spells are one kind of skill; mana techniques roll with the weapon). No screenshots (step 26).
- **Feature record** (`docs/features/skill-trees.md`), its **Verification** section: stage 2's figures, the parity look in one table or a pointer to this record, and any figure under 150.

### 4.4 Play check

Start the dev server (`npm run dev`) and, with the debug console (`~`): give a hero Taunt and Pin (`xp` to level 6 and take Rooted, Taunt and Pin from the tree, or a pre-roll that can), `fight` a goblin raid, use Taunt from the Skills list and see **T** on the foes' nameplates, then Pin a foe and see **N** and that it does not move on its turn. Note what you saw in the record. Stop the server afterwards.

### 4.5 Exclusions

- No tuning of any number, plan or count (decision 6; stage 4's).
- No screenshots, no restating of the rules of scaling (step 26).
- No code change beyond the guard fixture; a bug found while measuring is reported, not fixed here.

## 5. Verification

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm run test:browser
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm run build
```

### Expected

- Every run in §4.1 has its `.txt` summary under `logs/16-*`; the figures in the index and the record match them.
- `npm test` passes with the re-recorded guard; `npm run test:browser` and `npm run build` pass.
- `CLAUDE.md` names no removed symbol from stage 2 (`grep -n "spellMenu\|Cast button" CLAUDE.md` finds only intended lines).
- The play check saw Taunt's T and Pin's N.

## 6. Completion criteria

- [ ] Three campaigns and all 12 cells measured, one run at a time; the index's **16 stage 2** column filled.
- [ ] Parity table (26 runs) and per-side technique use in the execution record; plans more than 50 below their role's best flagged, not tuned.
- [ ] Any campaign under 150 reported at the top of the report with the cells that explain it.
- [ ] `CLAUDE.md`, manual text (§5, §6) and the feature record's Verification true for stage 2.
- [ ] Guard re-recorded last; `npm test`, `npm run test:browser`, `npm run build` pass.
- [ ] Play check done and noted.
- [ ] One commit "Skill trees step 16: stage 2: measure and document"; the index's step table shows `done (<commit>)`.

## 7. Execution record

