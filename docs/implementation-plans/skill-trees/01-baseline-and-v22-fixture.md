# Step 01: Baseline and the v22 fixture

[Plan index](index.md) · [Design](../../designs/skill-trees.md) §3 (current system), §5.9 (saves), §7.2 (balance method, step 0 "Baseline") · [Feature record](../../features/skill-trees.md)

**Difficulty:** sonnet / opus. Engineer `model: "sonnet"`; leave the reviewer's model unset. The step changes no code: it runs the simulator on today's rules and captures a save of today's format. The work is careful bookkeeping, and it must happen **before any other step touches the code**, because every later figure is judged against it and the fixture must be written by version-22 code.

## 1. Objective

1. **Re-measure today's balance** on the unchanged code at `50fb4cf`: the three campaigns and every cell of the index's measurement procedure, one run at a time, and write the figures into the **01 baseline** column of the index's Measurements table. These are the reference figures of design §7.2 step 0; `CLAUDE.md`'s figures (230, 239, 389, …) are not re-used unmeasured.
2. **Capture `src/game/fixtures/save-v22.json`**: a version-22 save string written by today's `serializeSave`, holding a company whose characters carry the perks the v22 migration (step 05) must fold, retire and collapse. Record exactly what it holds, so step 05 can assert AC10 from this record alone.

No source file, test or doc changes. The commit holds the fixture and the index's figures only.

## 2. Requirements and context

- **Design §7.2, step 0:** re-measure on `main` (this branch is `main` plus the design and feature record, so the code is `main`'s) the one-party guard (`--campaign --parties 1`, `CLAUDE.md`: 230), the default company (239), `--ready-level 10` (389) and the cells. "These are the reference figures."
- **Design §5.9:** "A new fixture, `src/game/fixtures/save-v22.json`, is captured from a level 6 company before the change." It must exercise the migration's five rules (below).
- **AC10 (R12):** "`save-v18.json` and a captured v22 save load. A level 6 fighter from v22 keeps its perks, mapped to the new nodes (5.9), and receives `3 + ⌊6/2⌋ − nodes` picks, never fewer than 0." Step 05 asserts it; this step makes it assertable.
- **Design §3, "Not run":** no baseline was taken by the designer (Node 22 on the machine); this step is that baseline.

### What the fixture must exercise (C8, for step 05)

The migration, per character in every party and in the reserves:

1. drops retired ids (`spellcasting`, `quick_study`) and any unknown id;
2. maps folded ids (`FOLDED` below);
3. collapses every node held to rank 1 (a second rank, or duplicates from folding, become one node), keeping nodes the new asks would refuse (grandfathered; a grandfathered `deadeye` counts as the capstone);
4. sets `perkPicks = max(0, picksAt(level) − nodes held)`, `picksAt(level) = 3 + ⌊level / 2⌋` (9 at level 6), and deletes `spellPicks`;
5. clamps `mana` to the new `maxMana`.

So the fixture holds, at minimum:

- **A level 6 fighter** (tagged Melee) holding `weapon_training` at 2 ranks, `mighty_blow`, `sunder` (both fold into `weapon_mastery`: two ids become one node), `gain_endurance` (→ `toughness`) and, if it can be had, `toughness` itself too (folding then duplicates). It should end with few enough nodes that the migration gives it a positive pick count (AC10's case), e.g. `weapon_training`, `weapon_mastery`, `toughness` = 3 nodes → 9 − 3 = 6 picks.
- **A caster** (tagged Magic, level 6 or more) holding `spellcasting`, `quick_study`, `eagle_eye` (→ `deadeye`, a capstone), `arcane_mastery` (→ `lingering_cold`), `deep_well` (→ `destruction`), `arcane_study` at 2 ranks and many spells (`magic_arrow`, `flame_arrow`, `fireball`, `heal`, `heal_all`, `shield`, `bless`, …), with `spellPicks` > 0 and `perkPicks` > 0 left unspent, and `mana` above what step 04's formula will give it if possible. It ends with more nodes than `picksAt(level)`, so its picks clamp to 0.
- **One reserve** at the guild hall (`game.reserves`), with at least one folded or retired perk, so step 05 proves the migration covers the reserves.
- Ideally a **second party** (the company has two), so step 05 proves it covers every party. The guild hall must be at level 4 (`world.guildHall = 4`) for two parties to be legal on load.

### Decisions from the index (unchanged)

- **7. Saves.** `SAVE_VERSION` 23 in stage 1 (step 03 raises it; step 05 adds `migrateFrom22`), 24 in stage 2 (step 11), 25 in stage 3 (step 17). Versions 23 and 24 load into the current version with no game migration: `BattleEngine.restore` fills the new `UnitRecord` fields with their defaults. Version 18 goes through `migrateFrom18` then `migrateFrom22`. Between steps 03 and 05, version-22 saves read as unreadable, and so does the version-18 fixture (its migration yields version 22's shape): step 03 changes that test to expect unreadable, and step 05 restores it.
- **9.** The design's "(was Riposte)", "(was Mana Leech, Elemental Fury)", "Lethality", "Devotion", "Divine Favour", "Font of Life", "Beacon" and "Mana Font" name no perk in today's code. Only the ids in C8's `FOLDED` and `RETIRED` exist; nothing else is migrated.
- **6. Measurement between stages** records figures and does not tune (feature record; brief). A campaign figure under 150 of 500 in stage 1, 2 or 3 is reported to the orchestrator in the step's record and the report, with the cells that explain it, and not tuned around. Tuning is stage 4's.

### Contracts (copied unchanged from the index)

**C8. The v22 migration (step 05), which this fixture feeds:**

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

**C7 (the mana formula step 05 clamps to; for the record only):** `maxMana = 2 × INT + (level − 1) × ⌊INT / 2⌋ + MANA_PER_TREE_NODE × (nodes in the Mage and Cleric trees) + perks' maxMana + gear's maxMana` (for every hero; INT through `attributeLevel`), `MANA_PER_TREE_NODE = 2`.

### The measurement procedure (copied from the index)

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

Here `NN` is `01`. Today's figures from `CLAUDE.md`, to compare against: one party 230 of 500 in 270 days and 18.2 battles, 1.8 heroes dead a campaign; the default company 239 in 274 days; `--ready-level 10` 389. Bandit Camp cells 429 (threat 3), 473 (4), 469 (5); Spider Nest 451, Salamander Pool 456 (threat 5); Troll Lair at threat 5 about 0. Source guardians: not recorded; this step measures it. A baseline that differs from `CLAUDE.md`'s by more than 5 points is reported (it means the code moved since those were recorded), not investigated or fixed here.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file.
- **The simulator.** A 500-campaign run takes about five minutes (`--ready-level 10` longer) and writes some 70 MB. **Run one at a time, never two at once**, each with its own `--out` under `logs/` (gitignored). Measurement and tuning belong to steps 01, 08, 16, 23, 24 and 25 only.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) must stay green: this step changes no code.
- **Commits.** One commit per step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 01: baseline and the v22 fixture". No attribution lines.
- **Docs.** No `CLAUDE.md` or manual change in this step (it changes no rule).

## 3. Dependencies and prerequisites

- **No prior step.** This step must run on the code at `50fb4cf` (or any later commit that changed only docs). If another step has already changed `src/`, stop and report: the baseline and the fixture would be wrong.
- **Existing code, for reference:**
  - `src/game/save.ts`: `SAVE_VERSION = 22`; `serializeSave(file: SaveFile): string` (every `Item` written as its id); `parseSave(raw)` (accepts 22, and 18 through `migrateFrom18`); the stage-5 fixture `src/game/fixtures/save-v18.json` shows the file's form and how the existing v18 test reads it.
  - `src/game/gameState.ts`: `newGame(...)` builds `{ parties, world, runes, reserves, slot, story }`; `reserves: Character[]`.
  - `src/game/party.ts`: `PREROLLS`, `readyMadeParty()`; `src/character/creation.ts`: `draftCharacter`.
  - `src/character/progression.ts`: `gainXp`, `levelUp`, `takePerk`, `autoAdvance` (today's: `AUTO_PERKS`, `AUTO_SPELLS`, spell picks).
  - `src/character/character.ts`: `Character` with `perks: Partial<Record<PerkId, number>>`, `perkPicks`, `spellPicks`, `mana`, `level`, `xp`.
  - `src/game/company.ts` / `src/game/expedition.ts`: `newExpedition(members, position, id, name)`, `partyId(n)`, `PARTY_NAMES`; `src/game/guildHall.ts`: `world.guildHall` (1 to 5; two parties need 4).
  - Today's perks with ranks above 1: `weapon_training`, `arcane_study`, `toughness` and others (2 ranks); `mighty_blow`, `sunder`, `eagle_eye`, `deep_well`, `arcane_mastery` ask level 6 and attributes; the "Gain X" perks ask level 3 (2 ranks).

## 4. Scope and implementation guidance

### 4.1 Measure

Run the procedure above with `NN = 01`, one run at a time, in this order: the three campaigns, then the cells (GR3, BC3, BC4, BC5, SN5, SP5, TL5, SG7, SG10, F1, F2, F3). Time the one-party campaign run (wall clock) for the "500-campaign run time" row. From each summary take:

- campaigns: wins of 500 (the Source beaten), heroes dead a campaign, days a campaign (and battles a campaign, for the record);
- cells: wins of 500.

Fill the **01 baseline** column of the index's Measurements table (`one party`, `default company`, `--ready-level 10`, deaths, days, `GR3 / BC3 / BC4 / BC5`, `SN5 / SP5 / TL5`, `SG7 / SG10`, `F1 / F2 / F3`, run time). Copy the full summary lines of each run into this file's execution record (or attach the `.txt` paths with the key lines quoted); the logs themselves stay in `logs/` and are not committed.

### 4.2 Capture the fixture

Write a one-off script **in the scratchpad directory, not in the repository** (e.g. `<scratchpad>/capture-v22.ts`), importing today's modules by absolute path with `.ts` extensions, run with Node 26. It:

1. builds a game with `newGame(...)` (any fixed world seed; record it) and a slot of `null` so nothing touches storage;
2. builds the characters of §2 "What the fixture must exercise" from pre-roll drafts (`draftCharacter` of a `PREROLLS` draft, the ready-made Aldric and Delwyn are natural choices), levels them to 6 (or more for the caster) with `gainXp`/`levelUp`, then sets `perks`, `perkPicks`, `spellPicks` and `mana` **directly** to the values wanted (grandfathered holdings need not be reachable by today's asks; the point is the shapes the migration meets);
3. forms a second party (`newExpedition` with `partyId(2)`, `PARTY_NAMES[1]`) at the encampment, raises `world.guildHall` to 4, and puts one character in `game.reserves`;
4. writes `serializeSave({ ... game ..., battle: null or absent as the format wants, savedAt: <fixed> })` to `src/game/fixtures/save-v22.json`, formatted as the v18 fixture is (match its form: a JSON string or object, as `save-v18.json` and its test use);
5. checks the result loads now: `parseSave(fs.readFileSync(...))` is non-null and its characters' perks are as written.

Keep the fixture small enough to read: no battle in progress, an ordinary world. Do not edit `save.ts` or add a test: step 05 writes the load test.

### 4.3 Files

- **Add:** `src/game/fixtures/save-v22.json`.
- **Edit:** `docs/implementation-plans/skill-trees/index.md` (the 01 column of Measurements; step 01's status), and this file's execution record.
- **Nothing else.** The capture script stays in the scratchpad.

### 4.4 Exclusions

No code, test, `CLAUDE.md` or manual changes. No tuning. No investigation of a baseline that differs from `CLAUDE.md` beyond reporting it.

## 5. Verification

### Tests

None written. `npm test` must pass unchanged (the guard stays green, as no code changed).

### Commands

```sh
export PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH
npm test
# the runs of §4.1, one at a time
node <scratchpad>/capture-v22.ts
git status   # only the fixture, the index and this file changed
```

### Acceptance checks

- Every row of the Measurements table's 01 column is filled from an actual run, and each run's summary line is in the execution record.
- `save-v22.json` parses with today's `parseSave` (checked by the capture script), has `version: 22`, two parties, one reserve, and the characters of §2.
- The execution record states, for **each character** in the fixture: party (or reserve), name, level, tagged skill, intelligence, `perks` exactly as written (id and rank), `perkPicks`, `spellPicks`, `mana`; and the **expected result of the migration** worked out by hand from C8 and C7: nodes held after it, `perkPicks` after it (`max(0, 3 + ⌊level/2⌋ − nodes)`), and the clamped `mana` (state the Mage/Cleric node count used). Step 05 asserts these numbers.

**Scene change:** none. `npm run test:browser` is not required.

## 6. Completion criteria

- [ ] All three campaigns and all twelve cells run, one at a time, on the unchanged code; figures in the index's 01 column.
- [ ] Any baseline more than 5 points from `CLAUDE.md`'s figure reported in the execution record (and in the report to the orchestrator).
- [ ] `src/game/fixtures/save-v22.json` written by today's code, loading with today's `parseSave`.
- [ ] The execution record lists every fixture character's holdings and the expected migration result (§5).
- [ ] `npm test` passes.
- [ ] One commit, "Skill trees step 01: baseline and the v22 fixture", holding only the fixture, the index and this file; the index's status for step 01 set to `done (<commit>)`.

## 7. Execution record
