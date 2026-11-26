# Step 02: Expected kit and the kitted yardstick

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-11-high-roster.md) (§2 "The yardstick test", §6 Simulator) · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.2 (the yardstick) · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §5.8 (expected kit, the gear policy) · [Stage 12 design](../../designs/long-campaign/stage-12-long-campaign-retune.md) (S12-R1, which later replaces this table) · [Balance skill](../../../.claude/skills/yomi-balance/SKILL.md) · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) builds a kit that must agree with stage 10's gear policy family for family, measures a constant from it, and writes the test that keeps the two in step; it must also judge whether the kitted readings look plausible against campaign §5.2 and report rather than adjust. The reviewer (opus) checks that `'bare'` and today's yardstick test are untouched, that the flag cannot reach a campaign, and that the guard and the 50-campaign hash are identical.

## 1. Objective

Give the simulator's single battles a party wearing the expected kit, and give the new kinds a yardstick to be judged against before stage 12 re-measures it:
- `--player-kit expected` and `expectedGear` (C1): every member of the raised party wears `expectedKit(level)`'s tier, grade and runes in its role's families;
- `KITTED_FIGHTER_GROWTH` and `foeYardstick(level, kit)` (C2): the ready-made fighter's hit, hit points and damage a turn measured in that kit at levels 5, 10, 15 and 20, with today's bare table unchanged;
- the far cells measured kitted (`bco9k`, `bco12k`, `fh15k`, `fh18k`, `sgk20` on today's Source), as the reference the ring steps' cells are read beside.

No rule the game or the campaign plays changes.

## 2. Requirements and context

- **Design §2:** "The yardstick test covers every new kind, against stage 12's expected kit if stage 12's measurement is ready. Otherwise it uses stage 10's `expectedKit` readings." Stage 12 is not started, so this step takes the readings.
- **Design §6, Simulator:** `--encounter X --threat T --party-level T` with expected kit (`--player-kit expected`, a flag added in this stage: it gives every member `expectedKit` for their role and level), at both ends of each band. A party of the threat's level wins most but not all.
- **Campaign §5.2:** heroes grow in hit points and accuracy, not damage or armour; an even foe grows in armour class and damage while its hit points stay within a few hero blows ("an Elder Wyrm (level 18) is not 400 hit points. It is about 80 hit points with armour class 80, resistance 4, a breath and a routine that does about 20 a turn").
- **Gear §5.8, the expected kit:** 1–4 tier 1 plain to Fine, no runes; 5–8 tier 2 Fine to Masterwork, 1–2 runes of rank 1–2; 9–12 tier 3 Fine, 2–3 of rank 2; 13–16 tier 4 Fine to Masterwork, 3–4 of rank 2–3; 17–20 tier 5 Masterwork, 4–6 of rank 3–4. Its provisional reading for the fighter: level 10 about 1d8+15 a hit, armour class 40, resistance 5; level 20 about 1d8+22 with +5 fire, armour class 55, resistance 8.

### Decisions from the index (unchanged)

5. **The yardstick for the new kinds** *(for the user, Q5)*: stage 12's measurement is not ready, so the new kinds are held to a **kitted** fighter growth table measured once in step 02 from `expectedKit` (the "stage 10 `expectedKit` readings" of the design); today's kinds stay on today's bare table, unchanged. C2.
10. **`--player-kit expected`** *(for the user, Q10)*: each member wears `expectedKit(level)`'s tier at the **low** end of each range (grade, runes filled, rank), in the families stage 10's gear policy picks by role, and the war hammer when the encounter's lead foe has resistance 4 or more; weapon runes Ember then Stone, armour runes Stone then Life (no ring wards: gear §5.8 step 3 stays out). C1.
15. **The refactor guard and the 50-campaign check stay identical through every step**: `--near-source` drops every fixed nest above threat 5, the near-home Source is unchanged (decision 3), and new `SPAWN_KINDS` are appended with `fromThreat: 7`. If a step moves either, it finds the cause; if the cause is only far spawns' kinds reaching the early campaign, it stops and brings it to the orchestrator (a re-record then needs approval and goes in that step). No step is planned to re-record the guard.
19. **Early measures with `--near-source`** (as stages 9 and 10): `one`, `company`, `rl10`, the refactor guard and the 50-campaign check. **Stage 12 owns** the accepted out-of-band figures (`one` 288, `company` 289, 331 days), the long campaign's gear lag and the Source at 1 of 100; this stage records the long run and does not tune it. Any figure further out than accepted goes to the orchestrator with options, never tuned away. The user's bands are never changed.

### Contracts produced (copied unchanged from the index)

**C1. Expected kit for single battles (step 02)**

```ts
// scripts/simulate.ts
export type PlayerKit = 'own' | 'expected'
// CliArgs gains playerKit: PlayerKit, default 'own'; flag '--player-kit own|expected'. 'expected' only for single battles
//   (refused with --campaign) and not with --player-weapon (refused: 'choose one of --player-kit expected and --player-weapon').
export function expectedGear(character: Character, level: number, leadResistance: number): void
//   equips `character` (its worn gear replaced; clampHp after) with expectedKit(level): every slot the role's family
//   (stage 10's gear-policy families by kitRole: fighter longsword, or war hammer when leadResistance >= 4, archer bow,
//   or crossbow from tier 3; mage staff and robe; the body armour the policy's strength rule picks; head, gloves, boots)
//   at expectedKit(level).tier and grades[0]; runes of rank ranks[0] filled across worn gear up to sockets[0], the main
//   hand first (Ember, then Stone), then body armour, shield and the small slots (Stone, then Life). Draws nothing.
// Single battles with 'expected': raisedParty's members each get expectedGear(member, args.partyLevel, lead), lead the
//   resistance of the encounter's first enemy unit built at --threat. The summary line names the kit.
```

**C2. The kitted yardstick (step 02)**

```ts
// src/combat/combat.ts
export const KITTED_FIGHTER_GROWTH: ReadonlyArray<readonly [number, number, number, number]>
//   [level, hero hit, hit points, mean damage a turn] of the ready-made fighter raised to level 5, 10, 15, 20 (raisedParty)
//   wearing expectedGear(fighter, level, 0): toHit, maxHp, and floor(actionPoints / attackApCost) × (mean of its damage roll +
//   mean on-hit bonus). Recorded constants; scripts/simulate.test.ts recomputes them and must match.
export function foeYardstick(level: number, kit: 'bare' | 'expected' = 'bare'): FoeYardstick
//   'bare' is today's (FIGHTER_GROWTH), unchanged; 'expected' the same bands from KITTED_FIGHTER_GROWTH.
// src/game/encounters.test.ts: today's nine kinds stay on 'bare' with today's exceptions; every kind added in stage 11
//   (STAGE_11_KINDS, a list in the test) is held to 'expected' at its native level, exceptions named with a reason.
```

Consumers: steps 08 to 13 (each adds its kinds to `STAGE_11_KINDS` and measures its cells with `--player-kit expected`), step 14 (every cell).

### The cells (C9, from the index, unchanged)

`--encounter E --threat T --party-level T --player-kit expected`, 500 battles from seed 1, report only, read against decision 4 (300–475). Codes (`bands.md`'s cell codes and measure names, lower case): `wp6`, `wp9`, `wr7`, `wr9`, `oc7`, `oc10` (08); `wy9`, `wy12` (09); `bw11`, `bw14`, `bl11`, `bl14`, `hg12`, `hg15` (10); `go14`, `go17`, `cu14`, `cu18`, `yd15`, `yd18` (11); `lc17`, `lc20`, `ew18`, `ew20` (12); `sgk20` (`source_guardians` 20, 13). Step 02 also measures, kitted, `bco9k`, `bco12k`, `fh15k`, `fh18k`, `sgk20` on today's Source.

### Shared constraints (from the index, unchanged)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file; `npm run build` before a ring step's commit;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` first;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 08–14 run them, in order). Measurements go through the `yomi-measure` agent. Long runs: 100 campaigns took 4 minutes alone in stage 10, up to 20 under load.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, args `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`; `GUARD_RECORDS`, `GUARD_EVENTS_SHA256`. Rules: `.claude/skills/yomi-balance/guards.md`. Every step keeps it green and unedited (decision 15).
- **The 50-campaign check** before committing a domain or simulator step (02, 03, 08–13, 14 if anything changed), against the hash before the step (step 01's, `log.md`), recorded "identical" or the diff in `log.md`:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **The early-game figure.** Stage 10 ended at `one` 288 (331 days, 1.2 dead), `company` 289, `rl10` 409 (533 days), with `--near-source`; `one`, `company` and the days are accepted until stage 12 (`bands.md`). Step 01 re-measures them; step 14 measures again. A move of more than about 5 points is explained in the commit and in `src/game/CLAUDE.md`'s scaling line, or brought to the orchestrator.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG for an existing encounter. New spawn kinds are appended (`.claude/skills/yomi-add-content/encounter.md`). The immunity draws nothing. Favoured runes draw from the loot stream, as today.
- **Import cycles.** `encounters.ts` imports `bandits.ts`; `loot.ts` imports `encounters.ts` and `worldMap.ts`; `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts` import one another (`src/game/CLAUDE.md`): nothing at module load. `src/combat/` imports nothing from `src/game/` or `scripts/`.
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on `long-campaign-stage-11`, without pushing; files staged by path. Messages "Stage 11 step NN: <title>". No attribution lines.
- **Docs.** Each step fixes the CLAUDE.md lines its change makes wrong and searches the CLAUDE.md files, `.claude/` and `docs/reference/` for every name it renames or removes. `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB.

## 3. Dependencies and prerequisites

- **Step 01** done: its 50-campaign hash (this step's reference) and its far cells (`bco9`, `bco12`, `fh15`, `fh18`, `sg20-18`, `sg20`, bare) are in `log.md`, "Step 01".
- **Existing code** (at `1a008af`; read before writing):
  - `scripts/simulate.ts`: `expectedKit(level)` (gear §5.8's table, the same for every role: `{ tier, grades, sockets, ranks }`), `kitRole(character)`, `KitRole`, `raisedParty(args)` (the ready-made party raised to `--party-level` by `levelUp` and `autoAdvance`), `parseArgs` and `SINGLE_BATTLE_FLAGS`, the `--player-weapon` handling, the single-battle summary line.
  - **Stage 10's gear policy** in `scripts/simulate.ts`: `HAMMER_RESISTANCE` (4), `leadFoeResistance`, `armourScore`, `wantsFamily(hero, slot, family, stats, leadResistance)` (the families by role, strength and AP-penalty rule for body armour, the mage's hide small slots), `forgeChoice`, `forgeGear`, `temperGear`, and the rune-filling helpers `visitFacilities` uses (`runecraftGear` and its rune order). **Find and reuse these** for `expectedGear`'s family choices rather than writing a second rule; `wantsFamily` covers tier 3 and up, and tiers 1–2 are the same families (the archer's bow, not the crossbow, below tier 3).
  - Items by id: `itemById` (`src/inventory/`), plain ids `<material>_<family>`, grade `@N`; runes by `runeKey(id, rank)`, embedded through the inventory's socket rules (sockets by tier and grade, `SOCKETS_BY_TIER`); `deriveCombatStats`; `clampHp`.
  - `src/combat/combat.ts`: `FIGHTER_GROWTH`, `fighterGrowth`, `FoeYardstick`, `foeYardstick(level)`.
  - `src/game/encounters.test.ts`, `describe('the foe yardstick')`: `EXCEPTIONS`, `meanDamage`, `routineTurn`, the per-kind test over `BLOCKS`.
- **`yomi-measure`** (`.claude/agents/yomi-measure.md`), spawned per the engineer role, one spawn at a time; if refused, a `general-purpose` agent briefed with that file's body.

## 4. Scope and guidance

Test-first: write each test red before the code.

1. **The flag** (`scripts/simulate.ts`): `--player-kit own|expected` into `CliArgs.playerKit` (default `'own'`); a bad value refused with the accepted values; `expected` with `--campaign` refused (as `--near-source` is refused without it); `expected` with `--player-weapon` refused with exactly `choose one of --player-kit expected and --player-weapon`. Add `--player-kit` to the usage comment. Tests in `scripts/simulate.test.ts` beside the other `parseArgs` tests.
2. **`expectedGear(character, level, leadResistance)`** as C1: replaces the worn gear, every slot the role wants (fighter: main hand, shield, body armour, head, gloves, boots; archer and mage: no off hand), at `expectedKit(level).tier` and `grades[0]`; runes of rank `ranks[0]` filled up to `sockets[0]` across worn gear in C1's order and kinds (an item's sockets limit what fits; if the worn gear has fewer sockets than `sockets[0]`, fill what fits and say so in a comment); `clampHp` after. Draws nothing. Tests on fixed characters: the ready-made fighter, archer and mage at levels 4, 8, 12, 16 and 20 wear the expected tier and grade in each slot, the fighter's war hammer at `leadResistance` 4 and longsword at 3, the archer's bow at level 8 and crossbow at 12, the runes counted and ranked.
3. **Single battles with `expected`**: after `raisedParty`, each member gets `expectedGear(member, args.partyLevel, lead)`, `lead` the resistance of the encounter's first enemy unit built at `--threat` (as `leadFoeResistance` reads one); the summary line names the kit (for example `… party level 12, expected kit (…)`). With `own` nothing changes: every existing single-battle output is byte-identical (a test, or the cells of step 01 rerun if cheaper).
4. **`KITTED_FIGHTER_GROWTH`** (`src/combat/combat.ts`, C2): compute the four rows once (the ready-made fighter, `raisedParty` to 5, 10, 15, 20, `expectedGear(fighter, level, 0)`, `deriveCombatStats`): hero hit `toHit`; hit points `maxHp`; mean damage a turn `floor(actionPoints / attackApCost) ×` (the damage roll's mean with its bonus + each on-hit entry's mean). Record them as constants with a doc comment naming how and when they were measured. A test in `scripts/simulate.test.ts` recomputes them and must equal the constant (`src/combat/` must not import `scripts/`).
5. **`foeYardstick(level, kit = 'bare')`**: `'bare'` exactly today's; `'expected'` the same four bands from `KITTED_FIGHTER_GROWTH` (linear between rows, held outside them, as `fighterGrowth`). A test that `foeYardstick(L)` and `foeYardstick(L, 'bare')` equal today's values at 1, 5, 10, 20.
6. **`src/game/encounters.test.ts`**: add `STAGE_11_KINDS: readonly MonsterKind[] = []` and a per-kind yardstick test that holds each of them to `foeYardstick(native, 'expected')` with its own named exceptions (an empty `it.each` needs a guard so vitest does not fail on no cases); today's kinds stay on `'bare'` with today's `EXCEPTIONS`, untouched. Ring steps add their kinds to the list.
7. **Plausibility.** Compare the kitted rows with gear §5.8's provisional reading (level 10 about 1d8+15, level 20 about 1d8+22 +5 fire) and the bands they give at 18 with campaign §5.2's sketch (Elder Wyrm about 80 hit points, armour class 80). If the kitted bands look implausible (for example a hit-point band whose low end is far above 80, or an armour class band far from 80), **record the figures and report to the orchestrator; do not adjust the kit or the bands**.
8. **Docs:** `docs/reference/simulator.md` (the flag, `expectedGear`, the single-battle line), `.claude/skills/yomi-balance/running.md` (the flag line, and the kitted cell codes `bco9k`, `bco12k`, `fh15k`, `fh18k`, `sgk20` as report-only measure names in `bands.md`'s cell-code and measure-name tables), `docs/reference/battle.md` or `src/combat/CLAUDE.md` where `foeYardstick` is described (one line: `'expected'` for stage 11's kinds until stage 12).
9. **Exclusions:** no rule change; no campaign use of the kit; no change to `expectedKit`'s table, the gear policy, `FIGHTER_GROWTH` or today's exceptions; no new kind.

## 5. Verification

- `npm test` passes: the new `parseArgs`, `expectedGear`, `KITTED_FIGHTER_GROWTH` and `foeYardstick` tests; today's yardstick test unchanged and green.
- The refactor guard green with `GUARD_RECORDS` and `GUARD_EVENTS_SHA256` unedited.
- The 50-campaign check (the index's command, `--out logs/s11-02-guard-50.jsonl`): **identical** to step 01's hash, recorded in `log.md`.
- Through `yomi-measure`, one at a time, seed 1, 500 battles, label `s11-02`: `bco9k` (`--encounter bandit_company --threat 9 --party-level 9 --player-kit expected`), `bco12k` (12), `fh15k` (`freebooter_host` 15), `fh18k` (18), `sgk20` (`source_guardians --threat 20 --party-level 20 --player-kit expected`, today's Source). Record each beside step 01's bare figure in `log.md` ("Step 02"), with run time. No band; report only.
- The kitted rows and their plausibility judgment (§4.7) in the execution record.

## 6. Completion criteria

- [x] `--player-kit` parsed and refused as C1; `expectedGear` built and tested; single battles with `own` unchanged.
- [x] `KITTED_FIGHTER_GROWTH` recorded and kept true by a test; `foeYardstick(level, kit)` with `'bare'` unchanged; `STAGE_11_KINDS` in place (empty).
- [x] Guard unedited and green; 50-campaign hash identical to step 01's.
- [x] The five kitted cells measured and recorded beside step 01's; plausibility judged, and reported if implausible.
- [x] Docs as §4.8.
- [x] One commit, "Stage 11 step 02: expected kit and the kitted yardstick", files staged by path, no attribution lines; the index's row 02 updated with status and commit.

## 7. Execution record

2026-11-26, engineer (model unset). Code commit `67a6f0d` "Stage 11 step 02: expected kit and the kitted yardstick"; this record in a follow-up commit.

**Built**
- `scripts/simulate.ts`: `PlayerKit`, `CliArgs.playerKit` and `--player-kit own|expected` (refused with `--campaign`: "--player-kit expected cannot be used with --campaign, ..."; with `--player-weapon`: exactly "choose one of --player-kit expected and --player-weapon"; a bad value: "--player-kit must be own or expected"); `expectedGear`, `EXPECTED_RUNES`, `encounterLeadResistance(encounter, threat, members)` (which `leadFoeResistance` now calls: one reading of the lead foe), `kitLabel(args)` (the summary line's kit), `kittedFighterRow(level)`; `runBattle` dresses the party through `battleParty`.
- `src/combat/combat.ts`: `KITTED_FIGHTER_GROWTH`, `foeYardstick(level, kit = 'bare')`; `fighterGrowth` takes its table.
- `src/game/encounters.test.ts`: `STAGE_11_KINDS` and `STAGE_11_EXCEPTIONS` (both empty), the per-kind check shared (`holds`), today's kinds on `'bare'` with `EXCEPTIONS` untouched.
- Docs: `docs/reference/simulator.md` (the flag; "The expected kit worn"), `docs/reference/battle.md`, `src/combat/CLAUDE.md`, `.claude/skills/yomi-balance/running.md` and `bands.md` (cell codes and measure names), `.claude/skills/yomi-add-content/foe.md`.

**Verification**
- `npm test` on the clean tree at `67a6f0d`: runlog #22, exit 0, 2753 passed (107 files). `npm run build`: runlog #23, exit 0.
- Refactor guard green, `GUARD_RECORDS` and `GUARD_EVENTS_SHA256` unedited (no `GUARD_` line in the diff).
- 50-campaign check: `57fdea15…53e75`, identical to step 01's (`logs/s11-02-guard-50.jsonl`).
- `own` unchanged: a test (`runBattle` with `--player-kit own` equals without), and `bc3` and `bco9` rerun, identical to step 01.
- Kitted rows, bands, plausibility and the five kitted cells: `log.md`, "Step 02". Cells: `bco9k` 499, `bco12k` 254, `fh15k` 477, `fh18k` 500, `sgk20` 500.
- Budgets: no paid call; one `yomi-measure` spawn (8 runs, about 2.5 minutes of simulation).

**Readings and assumptions**
- *Rune order in one item.* C1's "Ember, then Stone" and "Stone, then Life" are read socket by socket: an item's first socket takes the first kind, every later socket the second (`EXPECTED_RUNES`). So the tier 5 Masterwork weapon holds Ember III, Stone III, Stone III (one Ember, as gear §5.8's "+5 fire" reading has one fire bonus). The policy's own `RUNE_ORDER` with an unlimited pouch would fill every weapon socket with Ember.
- *Every row fits.* `sockets[0]` (1, 2, 3, 4) is always the main hand's sockets plus one of the body armour's, so no rune is left over and the shield and small slots take none; Life is never reached.
- *The kit replaces everything worn* (rings and amulets too; the ready-made party wears none).
- *The archer's armour follows the policy's strength rule*: metal at tiers 1 to 3 and 5 (Mithril and Starmetal ease strength), hide small slots at tier 4.
- *Mean damage a turn* counts each on-hit entry's damage but a bane entry (none in this kit).
- The war hammer: `expectedGear(fighter, level, lead)` with `lead >= 4`; `KITTED_FIGHTER_GROWTH` is measured with the longsword (lead 0), as C2 says.
- Tests were written before the code; all but the constant's passed on the first implementation (the constant's test was seen red against a placeholder, which is how the rows were read).

**Plausibility: reported, not adjusted** (`log.md`). The four yardstick fields look sound against campaign §5.2's sketch; the kitted fighter's resistance (7, 11, 13, 21 at levels 5, 10, 15, 20, against gear §5.8's "about 5" and "about 8") and armour class (53 and 73 against 40 and 55) are well above the provisional reading, and the yardstick has no resistance field. `fh18k` and `sgk20` are 500 of 500.

**For later steps**
- Ring steps: add each kind to `STAGE_11_KINDS` (and its exceptions to `STAGE_11_EXCEPTIONS`) in `src/game/encounters.test.ts`; a kind in that list leaves the bare test by itself.
- A foe's plain weapon damage meets resistance 11 to 21 on the kitted fighter (the archer 11 to 18, the mage 3 to 7): damage that is to tell at rings 12 to 18 has to go through resistance (`throughResistance` areas, spells, elements) or carry `armorPierce`. The cells will show it; decision 4's 300–475 may need this from the first trial.
- `FIGHTER_GROWTH` (the bare table) no longer matches today's bare fighter (hit 65/83/93/100/100 and hit points 35/59/89/119/149 at levels 1/5/10/15/20); it was left alone (out of scope; stage 12 re-measures).

**Review round 1** (opus reviewer, at `2cd7aca`; reruns runlog #27 and #28): verdict clean, no blocking finding; nothing disputed. Recorded from it, in the closing commit:
- *The cause of the resistance, corrected.* The small slots carry no rune. Level 10 / level 20: breastplate base + grade + one Stone rune 5 (3+1+1) / 9 (5+2+2); helm, gauntlets and greaves, base only, 6 / 9; shield 0 / 1; innate 0 / 2; total 11 / 21. The breastplate alone gives gear §5.8's "about 5" and "about 8" (`log.md`, "Step 02 outcome").
- *`expectedGear` reads `BASE_ITEMS`*, not the forge's options, so the mage wears hide small slots at tiers 3 to 5 and the archer at tier 4, where a campaign party forges none; noted in `docs/reference/simulator.md`.
- Open with the user (the orchestrator holds them): the rune-order reading and the kitted resistance. A follow-up change may come back to this step.
