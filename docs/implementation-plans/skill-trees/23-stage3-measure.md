# Step 23: Stage 3: simulator lines, measure and document

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (§5.4 engine rules, §5.8 simulator, §7.2 balance method, §7.3 stage 3) · [Feature record](../../features/skill-trees.md)

**Difficulty:** sonnet. The code part follows the pattern step 15 set for the summary's per-side counts, and the rest is running the simulator, recording figures and bringing docs up to date. The reviewer is opus (model unset): it judges whether the counts read the right event fields, whether the figures support what the docs claim, and whether AC8's evidence is real.

## 1. Objective

Close stage 3:

- the simulator's summary counts the stage-3 events per side (counters, deathblows, revives, Unbreakable saves), and each campaign records the callings and capstones of its vanguard's heroes at the end, with the summary giving the share of campaigns whose vanguard holds a capstone;
- the refactor guard's fixture re-recorded last, with the stage's figures;
- the three campaigns and every cell measured and written into the index's **23 stage 3** column;
- AC8 shown: in `--ready-level 12` campaigns the ready-made heroes reach their capstones;
- `CLAUDE.md`, the manual's text and the feature record true for stage 3.

This step changes no rule and tunes nothing.

## 2. Requirements and context

- **R13:** `LOG_SCHEMA_VERSION` raised for every new or changed event (26, step 17); the simulator reports what heroes use.
- **R14:** balance is judged with the simulator by the cells and bands of design §7.2. Stage 3 records; stage 4 tunes.
- **R15:** the manual and `CLAUDE.md` brought up to date (screenshots are step 26's).
- **AC8 (R10):** `npm run simulate` runs with the new trees. The summary lists techniques used per side, and the ready-made heroes reach their capstones in `--ready-level 12` campaigns. The ready-made three and their capstones on their plans: Aldric (`knight`) Unbreakable, Brenna (`ranger`) Deadeye, Delwyn (`evoker_healer`) Meteor.
- **AC6 (R8)** was met by steps 17 to 20 and **AC1/AC2** by step 21; this step only confirms `npm test` still shows them.
- **Design §7.3, stage 3:** merges on its own, leaves the game playable, passes `npm test` and `npm run test:browser`, re-records the guard and records its campaign figures.

### Decisions from the index (unchanged)

2. **The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.

6. **Measurement between stages** records figures and does not tune (feature record; brief). A campaign figure under 150 of 500 in stage 1, 2 or 3 is reported to the orchestrator in the step's record and the report, with the cells that explain it, and not tuned around. Tuning is stage 4's.

### Contracts (copied unchanged from the index)

**C15. The simulator (steps 15 and 23)** — this step builds the step-23 parts:

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

**C13 (steps 17–20, consumed here), the event fields to count:**

```ts
// AttackEvent gains counter?: true, ambush?: true, deathblow?: true, apRefunded?: number, manaRestored?: number, endured?: true
// CastOutcome gains revived?: true, endured?: true; StatusTickEvent gains endured?: true
```

**C1 (step 03, consumed here):** `calling(character): PathId[]` (the deepest path(s), ties all; `[]` with no nodes) and `capstoneOf(character): PerkId | null` in `src/character/trees.ts`.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npm run test:browser` (read `e2e/CLAUDE.md`); `npm run build` at the stage's end.
- **The simulator.** A 500-campaign run takes about five minutes (`--ready-level 10` longer) and writes some 70 MB. **Run one at a time, never two at once**, each with its own `--out` under `logs/` (gitignored).
- **Determinism.** The summary lines and record fields read events and characters only; they draw nothing from any RNG and change no decision.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit for this step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 23: stage 3 simulator lines, measure and document". No attribution lines. Say in the message that the guard fixture was re-recorded and give the one-party, company and ready-level-10 figures.
- **Docs.** `CLAUDE.md` stays current: fix the lines stage 3 makes wrong and search it for every name renamed or removed.

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

## 3. Dependencies and prerequisites

- **Steps 21 and 22 are done** (and through them 17 to 20): all 95 nodes are in `PERKS`, the plans hold their stage-3 nodes, the policy has its last steps, and the scenes show the stage-3 events.
- **Step 15 is done:** the summary already counts per side techniques used, taunts, pins and mana on techniques; follow its shape (where the counts are gathered from events and where they print) for the new lines.
- **From the index's Measurements table:** the 01, 08 and 16 columns, to compare against.
- **Existing at `50fb4cf`, for reference:** `scripts/simulate.ts` (`parseArgs`, `runCampaign`, `CampaignRecord`, `finishCampaign`, the printed summary), `scripts/simulate.test.ts` (`describe('the refactor guard')`, `GUARD_RECORDS`, `GUARD_EVENTS_SHA256`).

## 4. Scope and guidance

### 4.1 The simulator's stage-3 lines (test first)

In `scripts/simulate.ts`:

- **Per side** (as step 15's counts are kept): `counters` (attack events with `counter`), `deathblows` (with `deathblow`), `revives` (cast outcomes with `revived`), `unbreakableSaves` (attack events, cast outcomes and status ticks with `endured`). Print them on the summary's per-side lines beside step 15's.
- **Per campaign:** `CampaignRecord.callings` counts, over the vanguard's heroes at the campaign's end, each path in each hero's `calling` (a tie counts every tied path); `CampaignRecord.capstones` counts each `capstoneOf` that is non-null. For a campaign lost in battle, read the fallen vanguard's heroes as `finalLevels` already does.
- **The summary** prints the callings and capstones totalled over the campaigns, and the share of campaigns whose vanguard ends holding at least one capstone ("Capstones: 312 of 500 campaigns (62%); unbreakable 280, deadeye 251, meteor 240, …").
- **Tests** in `scripts/simulate.test.ts`: the counts from a short hand-made event list (one of each field, and an event without them counting nothing); `callings` and `capstones` from a vanguard of hand-built characters (a tie, a capstone, none).
- **Re-record the guard** last, after every other change of the step: the record gains `callings` and `capstones`, and stage 3's play has moved since step 16. Run the 5-campaign test, take the new `GUARD_RECORDS` and `GUARD_EVENTS_SHA256`, and say so in the commit message.

### 4.2 Measure

Follow the measurement procedure above. Record each run's printed summary (in full for the one-party campaign, the lines that matter for the rest) in the execution record, and fill the index's **23 stage 3** column, including the 500-campaign run time.

1. The three campaigns: `--parties 1`, the default company, `--ready-level 10`.
2. Every cell of the cell table: GR3, BC3, BC4, BC5, SN5, SP5, TL5, SG7, SG10, F1, F2, F3.
3. **AC8:** one more campaign run,

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --ready-level 12 --out logs/23-rl12.jsonl > logs/23-rl12.txt
   ```

   If it runs past 15 minutes, stop it and run fewer campaigns (`--battles 200`, then 100), saying so in the record. From its summary's capstone lines (and the log if need be), record how many campaigns end with Aldric holding Unbreakable, Brenna Deadeye and Delwyn Meteor, and the share with any capstone. AC8 is met when each of the three is reached in a clear share of the campaigns that reach level 12. If one is never reached, find why (a plan order, an ask, a depth) and report it with the evidence; do not change rules here.
4. Compare with the 16 column and step 01's baseline. **If a campaign figure is under 150 of 500**, report it to the orchestrator (decision 6) with the cells that explain it, and do not tune. Note which cells are outside their bands for stage 4.

### 4.3 Document

- **`CLAUDE.md`** true for stage 3, searched for every name the stage renamed or removed (`sleep` on a status rule, now `helpless`/`wakesOnDamage`; anything else steps 17 to 22 recorded):
  - the engine's paragraph on the battle system: the traits (Iron Skin's free attacks, Counter, Tumble, Skirmisher, Backstab, Ambush, Executioner, Fortune, Deadeye, Battle Mage, Arcane Knight, Deathblow, Blademaster, Unbreakable through `applyDamage`), auras through `auraBonus` and `statsIn`, the turn-start restores (`RestoreEvent`), Shadowdancer;
  - the rules of casting: Purify, Revive (`fallen` target, once a battle), Renew, Holy Light, Ice Lance, Glacial Prison; `frozen`, `renewing`; `hostile`, `helpless`, `wakesOnDamage` on statuses;
  - the policy's line: the steps in design §5.5's order;
  - the versions: `LOG_SCHEMA_VERSION` 26, `SAVE_VERSION` 25 and what loads into it;
  - the simulator's flags paragraph: the new summary lines and record fields;
  - the rules of scaling: one short dated line, "Skill trees stage 3 (2026-…): one party N of 500, company N, ready level 10 N; …", without restating the whole paragraph (stage 4 does that).
- **The manual** (`docs/manual/README.md`): the text on the traits, capstones, auras and the new spells and statuses, where its sections on battle, magic and growing stronger cover them; no screenshots (step 26).
- **The feature record** (`docs/features/skill-trees.md`): under Verification, stage 3's figures and AC8's result.

### 4.4 Play check

Start the dev server (`npm run dev`) and check one capstone in play: in the debug console (`~`), raise a hero to level 12 with nodes that open a capstone (`xp`, then take the nodes in the tree view), `fight` an encounter and see the capstone act (Unbreakable's "endures the blow", a Revive, a Meteor). Record what was seen, in a few lines. Stop the server afterwards.

### 4.5 Exclusions

- No rule, number, plan or policy change. A figure that looks like a bug is reported, not fixed.
- No screenshots (step 26). No restatement of the whole rules of scaling (step 26).

## 5. Verification

### Tests (in `npm test`)

- `scripts/simulate.test.ts`: the new per-side counts and the record's `callings` and `capstones`, as in §4.1; the refactor guard green against its re-recorded fixture.

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run scripts/simulate.test.ts
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm run test:browser
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm run build
```

Expected: all pass. The simulator runs of §4.2, one at a time.

## 6. Completion criteria

- [x] Summary lines for counters, deathblows, revives and Unbreakable saves per side; `CampaignRecord.callings` and `capstones`; the capstone share printed; tests written first and passing.
- [x] The guard fixture re-recorded last, and the commit message says so.
- [x] Three campaigns and every cell measured; the index's 23 column filled, run time included; any campaign under 150 reported with its cells.
- [x] AC8 shown by the `--ready-level 12` run (Unbreakable, Deadeye, Meteor reached), or the failure reported with evidence.
- [x] `CLAUDE.md`, the manual's text and the feature record true for stage 3.
- [x] The play check recorded.
- [x] `npm test`, `npm run test:browser`, `npm run build` pass, outputs recorded.
- [x] One commit; the index's step 23 row set to `done (<commit>)`.

## 7. Execution record

### Engineer record (2026-11-14)

**Code** (`scripts/simulate.ts`, tests first in `scripts/simulate.test.ts`): `Tally` counts per side `counters` and `deathblows` (the attacker's side), `revives` (the caster's) and Unbreakable saves (`endured` on an attack, a cast or area outcome or a status tick, by the side of the unit kept standing); `Summary` gains `avg{Player,Enemy}{Counters,Deathblows,Revives,UnbreakableSaves}`, printed as the "Traits" lines. `CampaignRecord` gains `callings` and `capstones` (`vanguardTallies`: each hero's `calling` paths, a tie counting all, and its `capstoneOf`; read where `finalLevels` is, so a wiped vanguard counts as it fell); `summarizeCampaigns` totals them with `withCapstone`, and the summary prints a "Capstones" and a "Callings" line. Guard: the events are unchanged (hash `b840633a...e0a2`, as before), the records gain `callings` and `capstones`; re-recorded.

**Runs** (Node 26, seed 1, 500 each, one at a time; `logs/23-*.txt`, times in `logs/23-times.txt`):

| Figure | Step 16 | Step 23 |
| --- | --- | --- |
| one party | 449 (339 days, 22.5 battles, 0.5 dead) | 449 (339 days, 22.5 battles, 0.5 dead), 272 s |
| default company | 449 | 449 (339 days, 22.6 battles), 270 s |
| `--ready-level 10` | 488 | 488 (567 days, 48.3 battles), 580 s |
| GR3 / BC3 / BC4 / BC5 | 500 / 494 / 495 / 488 | 500 / 494 / 495 / 488 |
| SN5 / SP5 / TL5 | 500 / 495 / 8 | 500 / 495 / 8 |
| SG7 / SG10 | 0 / 422 | 0 / 386 |
| F1 / F2 / F3 | 500 / 500 / 493 | 500 / 500 / 493 |

The three campaigns are exactly step 16's: no hero in them holds a stage-3 trait or capstone but Iron Skin and Guardian (capstones: 0 of 500 campaigns at ready level 7, 3 at 10: Deadeye 3, Unbreakable 2), and the trait lines read 0.000 on both sides. Only SG10 moved (422 to 386). No campaign under 150. Out of band as at stage 2: all three campaigns, BC3, BC4, SN5, SP5 (high), SG10; SG7 in band, TL5 report-only.

**AC8** (`--ready-level 12`, 500 campaigns, 883 s, under the 15 minute limit): 473 Source (94.6%), 12 fell, 15 out of days; 736 days, 73.6 battles; vanguards end at 11.5 to 12.1. Capstones: 449 of 500 campaigns (89.8%): unbreakable 627, deadeye 452, **meteor 0**. Callings: heavy_knight 1443, evoker 519, ranger 504, swordmaster 6. Why Meteor is 0: checked with `raisedParty` at levels 12 and 14. At 12 Delwyn holds magic_arrow, heal, arcane_study, destruction, flame_arrow, heal_all, fireball, pyromancy, mending (nine picks) and no capstone; at 14 he takes meteor. Arcane Study is his creation pick and is not in `evoker_healer`, so the plan's ninth entry becomes his tenth pick. AC8 is met for Unbreakable and Deadeye and not for Meteor at level 12; no rule changed. Stage-4 lever: put Meteor ahead of Mending (or Pyromancy) in `evoker_healer`, or accept level 14.

**Traits unseen in the simulator:** in the `--ready-level 12` log 0 `endured`, 0 `deathblow`, 0 `counter`, 0 `revived`; units with `unbreakable` at `battle_start`: 2851 (its heroes win 15 783 of 15 784 threat-5 battles, so no one reaches 0). Stage 4's parity cells at higher levels or a deliberately harder cell are where counts will first show. These figures bear on the stage-4 notes in the feature record: capstones are reached only in the longest campaigns, so capstone parity cannot be judged from campaign wins.

**Play check:** see the feature record's Stage 3 section (Aldric at level 12 with Unbreakable, at 1 hit point, struck by the Bandit Captain: `endured: true`, hit points stay 1). Meteor not cast by hand. A scratch test, removed.

**Docs:** CLAUDE.md (the flags paragraph's trait lines and `callings`/`capstones`; the stage-3 scaling sentence); manual (six node-table rows brought to their current descriptions: Iron Skin, Battle Mage, Deadeye, Skirmisher, Fortune, Serenity; a paragraph on auras and traits in chapter 5); the feature record's Stage 3 verification. The engine, casting, policy and version paragraphs of CLAUDE.md were already true from steps 17 to 22 (checked: `LOG_SCHEMA_VERSION` 26, `SAVE_VERSION` 25, no `sleep` on a status rule).

**Verification:** `npm test` 86 files, 2004 tests pass; `npm run build` ok; `npm run test:browser` 10 files, 118 tests pass (253 s).
