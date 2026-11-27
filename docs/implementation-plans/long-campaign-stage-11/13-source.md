# Step 13: The Source at 20

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-11-high-roster.md) (§2 the Source row, §4 "At the Source", §6) · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.5 (Blight Horror row), §5.2 (yardstick) · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.6 (Blight Breath's element) · [Stages index](../../designs/long-campaign/index.md) · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) authors a boss block at native 20 against the kitted yardstick, splits the Source's encounter so the near-home Source stays byte-identical, removes a constant several tests and docs name, re-records the policy snapshot narrowly, and tunes against a cell. The reviewer (opus) checks the near-home setups are unchanged, the snapshot diff is only `source_guardians` above threat 5, and that nothing was tuned past the cell's three trials.

## 1. Objective

Rebuild the Source as a threat-20 boss fight:
- a new kind `source_horror` ("Blight Horror", native 20, its own sprite from step 07) with Blight Breath and a routine of claws;
- `sourceGuardians` fights `SOURCE_AT_20` (the Horror and two Blight Cultists) above threat 5, and today's slots and counts at threats 1 to 5, unchanged;
- `SOURCE_FOE_LEVEL` and `EncounterDef.maxFoeLevel` removed;
- the `sgk20` cell measured and, if needed, tuned.

## 2. Requirements and context

- **S11-R3** (design §2): "Blight Horror rebuilt at native 20 | Source Guardians (20)". Campaign §5.5: "Blight Horror (Source) | 20 | final boss | res 3 | Blight Breath (burst 2 around itself, acid, lays Corroded); routine; regenerates 2".
- **Design §4, "At the Source":** "the Horror breathes blight around itself, corroding armour, and regenerates unless seared or corroded."
- **Carried from stage 10:** the Source Guardians sit at `SOURCE_FOE_LEVEL` 6 until this stage.
- **Design §6 per ring:** the kind's yardstick test; the encounter's composition at its band's ends; one engine test per kind with something special; the cell `--encounter source_guardians --threat 20 --party-level 20 --player-kit expected`; a party of the threat's level wins most but not all.

### Contracts (copied unchanged from the index)

**C7. The Source at 20 (step 13)**

```ts
// src/game/encounters.ts
// sourceGuardians(party, threat): threat <= 5: today's SOURCE_GUARDIANS slots and counts (band 1–5), byte-identical;
//   above 5: SOURCE_AT_20, fought at 20 whatever the threat: slots source_horror "Blight Horror", blight_cultist "Blight
//   Acolyte", blight_cultist "Blight Zealot"; count 3. ENCOUNTER_BANDS.source_guardians stays { min: 1, max: 20 }.
// SOURCE_FOE_LEVEL and EncounterDef.maxFoeLevel are removed. The Source location (`SOURCE_ID`) is unchanged.
```

**C3 row** (each a `MonsterKind`, `UnitKind` id = sprite id, block `<NAME>_STATS` in `src/combat/combat.ts`, `FOE_STATS`, `FOE_XP` (first value), `FOE_NATIVE_LEVEL`, `FOE_SOUNDS`, `DEATH`):

| Kind | Name | Native | XP | Defence | Special (C4) | Step |
| --- | --- | --- | --- | --- | --- | --- |
| `source_horror` | Blight Horror | 20 | 500 | res 3, regeneration 2, blightborn | `blight_breath`, `horror_claws` | 13 |

**C4 entries** (in `ABILITIES`, ids in `ABILITY_IDS` after `fire_spit` and before `power_attack`, in this order; numbers not given are the engineer's first values; earlier ring steps added the ones before these):

- `blight_breath` "Blight Breath": area burst centred on self, radius 2, `foesOnly: true`, element blight, lays `corroded`, `halfOnMiss: true`, recharge 3.
- `horror_claws` "Claws": routine of two claws.

Each area gets an `ABILITY_SOUNDS` and `ABILITY_LOOKS` entry reusing today's cues and looks.

**C9 (this step's cell)** `--encounter E --threat T --party-level T --player-kit expected`, 500 battles from seed 1, report only, read against decision 4 (300–475). This step: `sgk20` (`source_guardians` 20). Step 02 measured `sgk20` on today's Source (its figure is in `log.md`, "Step 02").

### Decisions from the index (unchanged)

3. **The Source at 20** *(for the user, Q3)*: a new kind `source_horror` ("Blight Horror", native 20, its own sprite) leads two Blight Cultists at threat 20. **The near-home Source keeps today's `horror` block and slots for threats 1 to 5**, so `--near-source` (the early figures, the refactor guard, the 50-campaign check) fights exactly as before. `SOURCE_FOE_LEVEL` and `maxFoeLevel` are removed. C7.
4. **The cells' reading of "most but not all"** *(for the user, Q4)*: per-ring cells are report-only (the user's bands are not extended); the plan's working reading is **300 to 475 wins of 500** at both band ends, with `--player-kit expected`, a party of the threat's level. A ring step tunes only its own encounters toward it, at most three trials an encounter, then reports. **Standing rule (the user, 2026-11-27, from step 11; replaces step 09's top-end rule):** the threats the map has (7, 9, 12, 15, 18) are tuned inside 300–475 first, the band's ends second; an in-play miss after three trials goes to the user; a band-end miss is recorded for stage 12 and the step carries on. C9.
5. **The yardstick for the new kinds** *(for the user, Q5)*: stage 12's measurement is not ready, so the new kinds are held to a **kitted** fighter growth table measured once in step 02 from `expectedKit` (the "stage 10 `expectedKit` readings" of the design); today's kinds stay on today's bare table, unchanged. C2.
7. **Blight Breath** *(for the user, Q7)*: element `blight` (gear §4.6; campaign §5.5's "acid" is read as its Corroded), lays Corroded, **foes only** (the Horror's guardians are the blight's own).
13. **Blightborn:** the Blight Cultist, the Blight Lich and `source_horror` are `blightborn` (Dawn's bane applies), as `horror` is.
15. **The refactor guard and the 50-campaign check stay identical through every step**: `--near-source` drops every fixed nest above threat 5, the near-home Source is unchanged (decision 3), and new `SPAWN_KINDS` are appended with `fromThreat: 7`. If a step moves either, it finds the cause; if the cause is only far spawns' kinds reaching the early campaign, it stops and brings it to the orchestrator (a re-record then needs approval and goes in that step). No step is planned to re-record the guard.
16. **The policy snapshot** (`src/engine/policies.test.ts`) iterates over every encounter, so **each ring step re-records it**, proving only its new encounters' lines were added (every earlier line unchanged), and step 13 re-records it with only `source_guardians` lines above threat 5 changed. Each says so in the test's title.
17. **Versions:** `SAVE_VERSION` 31 → 32, 33, 34, 35, 36 in the ring steps 08 to 12 (each changes fixed locations; no migration, older saves read as unreadable); step 13 changes no fixed location (no bump). `LOG_SCHEMA_VERSION` 26 → 27 in step 03 only.
19. **Early measures with `--near-source`** (as stages 9 and 10): `one`, `company`, `rl10`, the refactor guard and the 50-campaign check. **Stage 12 owns** the accepted out-of-band figures (`one` 288, `company` 289, 331 days), the long campaign's gear lag and the Source at 1 of 100; this stage records the long run and does not tune it. Any figure further out than accepted goes to the orchestrator with options, never tuned away. The user's bands are never changed.

### Shared constraints (from the index)

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

- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG for an existing encounter. New spawn kinds are appended (`.claude/skills/yomi-add-content/encounter.md`). The immunity draws nothing. Favoured runes draw from the loot stream, as today.
- **Import cycles.** `encounters.ts` imports `bandits.ts`; `loot.ts` imports `encounters.ts` and `worldMap.ts`; `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts` import one another (`src/game/CLAUDE.md`): nothing at module load. `src/combat/` imports nothing from `src/game/` or `scripts/`.
- **Content checklists** (`.claude/skills/yomi-add-content/`): `foe.md` (each kind: sprite, `MonsterKind`, `FOE_STATS`, `FOE_XP`, `FOE_NATIVE_LEVEL`, `FOE_SOUNDS`, `DEATH`, the yardstick), `ability.md` (`ABILITIES`, `ABILITY_IDS` with the monsters' before the techniques, `ABILITY_SOUNDS`, `ABILITY_LOOKS`), `encounter.md`. Balance: `.claude/skills/yomi-balance/`.
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on `long-campaign-stage-11`, without pushing; files staged by path. Messages "Stage 11 step NN: <title>". No attribution lines.
- **Docs.** Each step fixes the CLAUDE.md lines its change makes wrong and searches the CLAUDE.md files, `.claude/` and `docs/reference/` for every name it renames or removes (`SOURCE_FOE_LEVEL`, `STAND_IN_GOODS`, renamed nest ids). `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB: **`src/game/CLAUDE.md` is at 7,654 bytes**; move detail to `docs/reference/game.md` before adding a line. Each ring step adds its cells to `bands.md`'s cell codes and measure names (report only) and "Now"; step 15 writes the rest and the manual.

## 3. Dependencies and prerequisites

- **Step 12** done: every earlier ring's kinds, abilities and encounters are in; `blight_cultist` (C3, step 11: native 14, res 1, blightborn, spells `lightning_bolt`, `curse`, `heal`) exists, and `ABILITY_IDS` holds the monsters' ids up to `wyrm_strikes`.
- **Step 07 merged**: `art/units/source_horror.sprite.toml` built into `public/assets/sprites/` (`src/scenes/unitLook.test.ts` fails without it).
- **Step 02**: `foeYardstick(level, 'expected')`, `KITTED_FIGHTER_GROWTH`, `--player-kit expected`, and `STAGE_11_KINDS` in `src/game/encounters.test.ts` (the kinds held to the kitted yardstick).
- **Step 03**: `CombatantStats.immune` (not used here; Corroded is a ticking status, so the immunity is not in play against heroes).
- **Existing (at `1a008af`):** `src/game/encounters.ts` (`SOURCE_GUARDIANS_SLOTS`, `SOURCE_GUARDIANS` with `counts: [...TODAY.counts, ...15 × 5]` and `maxFoeLevel: SOURCE_FOE_LEVEL`, `SOURCE_FOE_LEVEL = 6`, `encounter()`'s `maxFoeLevel` parameter, `sourceGuardians`); `src/combat/combat.ts` (`BLIGHT_HORROR_STATS`, `blightborn`); `src/combat/abilities.ts` (area fields `centredOnSelf`, `foesOnly`, `element`, `status`, `halfOnMiss`); `src/combat/spells.ts` (`corroded`: −5 AC, −2 resistance, 1d4 acid tick, `stopsRegeneration`; `seared`: `stopsRegeneration`); `src/game/encounters.test.ts` (tests of `SOURCE_FOE_LEVEL` around lines 100–180); `src/game/loot.ts` (the Source rolls `SOURCE_THREAT`'s row: unchanged); `src/game/worldMap.ts` (`SOURCE_ID`, `SOURCE_THREAT` 20); `scripts/simulate.ts` (`NEAR_SOURCE` at threat 5).
- **Open questions:** Q3 (the Source's guardians, the near-home Source) and Q7 (Blight Breath's element and foes only). The step is written for their defaults; if the user answers otherwise before it starts, the orchestrator updates C7 and decision 7 here and in the index.

## 4. Scope and guidance

Work test-first: write each test, see it fail, then change the code.

### 4.1 The near-home Source stays as it is

- Before changing anything, add a test (`src/game/encounters.test.ts`) that `sourceGuardians(party, t)` for t = 1 to 5 equals today's setup, either from a recorded fixture or by building today's `SOURCE_GUARDIANS` def inline; it must pass before and after the change.
- Split `SOURCE_GUARDIANS` into the near-home def (band 1–5, today's slots and `TODAY.counts`, `horror` native 1) and `SOURCE_AT_20` (band 20–20, the C7 slots, count 3). `sourceGuardians(party, threat)` picks the near-home def at threat ≤ 5 and `SOURCE_AT_20` above (so any threat above 5 is fought at 20). `ENCOUNTER_BANDS.source_guardians` stays `{ min: 1, max: 20 }`; `ENCOUNTER_COUNTS.source_guardians` is the engineer's choice of how to express the split (for example the near counts then 3s), stated in the doc comment, as long as `encounters.test.ts`'s band-wide tests hold.
- Remove `SOURCE_FOE_LEVEL` and `EncounterDef.maxFoeLevel` (and `encounter()`'s use of it). Rewrite the tests that named them (around lines 100–180: "raises its foes to SOURCE_FOE_LEVEL at most…", "fields the same four at threat 5…, and all five slots at the Source's threat…") to the new rule: today's four at threat 5, and `SOURCE_AT_20`'s three at levels from their own natives at threats 6, 12 and 20.

### 4.2 The `source_horror` kind

- Per `.claude/skills/yomi-add-content/foe.md`: `MonsterKind`, `SOURCE_HORROR_STATS` in `src/combat/combat.ts` (name "Blight Horror", res 3, regeneration 2, `blightborn: true`, abilities `['blight_breath', 'horror_claws']`), `FOE_STATS`, `FOE_XP` 500, `FOE_NATIVE_LEVEL` 20, `FOE_SOUNDS`, `DEATH` (reuse `horror`'s cues).
- Add `source_horror` to `STAGE_11_KINDS`: its block at native 20 sits within `foeYardstick(20, 'expected')`, or each field outside is a named exception with a reason (a boss's damage, for example).
- Abilities per C4 and `ability.md`: `blight_breath` (burst centred on self, radius 2, `foesOnly`, blight, Corroded, half on a miss, recharge 3) and `horror_claws` (two claws), after `wyrm_strikes` in `ABILITY_IDS`; `ABILITY_SOUNDS` and `ABILITY_LOOKS` for `blight_breath` reusing today's cues and looks (for example `consecrate`'s blight impact). No new `Ability` field; if the breath cannot be built from today's fields, stop and report.
- **Today's `horror` kind and `BLIGHT_HORROR_STATS` stay unchanged** (the near-home Source).

### 4.3 Engine tests (one per special)

In `src/engine/battleEngine.test.ts` or `src/combat/abilities.test.ts`, with a seeded `mulberry32` or scripted RNG:
- Blight Breath touches every hero within 2 hexes of the Horror and **none of its guardians** beside it.
- It lays Corroded on a hit; a miss deals half and lays nothing.
- Its damage is blight: a hero with a blight ward takes that much less per outcome (`warded`).
- The Horror regenerates 2 at its side's turn start, and not while Seared or Corroded.
- Dawn's bane applies to `source_horror` (`baneApplies`).

### 4.4 The policy snapshot

Re-record `src/engine/policies.test.ts`'s "the choices of today's encounters" (decision 16), proving **only `source_guardians` lines above threat 5 changed** (diff the snapshot; every other encounter's lines and `source_guardians` at 1–5 identical). Add to the test's title: "and in long-campaign stage 11 step 13, when the Source's guardians at 20 became the Blight Horror and two cultists". Record the diff's size in the execution record.

### 4.5 Cells and tuning

Through `yomi-measure`, one at a time, seed 1, 500 battles, label `s11-13`:
- `sgk20`: `--encounter source_guardians --threat 20 --party-level 20 --player-kit expected`;
- the old report-only `sg20-18` and `sg20` (`--encounter source_guardians --threat 20 --party-level 18` and `--party-level 20`, own kit), recording that they now fight `SOURCE_AT_20` (stage 10: 28 and 71, `SOURCE_FOE_LEVEL` 6).

Read `sgk20` against decision 4 (300–475). If outside, tune only this encounter's slot order and count and the `source_horror` block (kept within the yardstick or a named exception), **at most three trials**, each a `sgk20` run logged in `log.md`; if still outside, put the code back to the best trial and stop to report to the orchestrator with the trials' figures and options. Do not touch the Blight Cultist's block (step 11's), shared constants (`FOE_*_PER_LEVEL`), `FOE_XP` as a lever, or the near-home Source.

### 4.6 Guards and versions

- `npm test` passes with `GUARD_RECORDS` and `GUARD_EVENTS_SHA256` unedited; the 50-campaign check identical to the step before's hash (`log.md`). The near-home Source is unchanged, so either moving is a defect: find it before going on (decision 15).
- No `SAVE_VERSION` bump: no fixed location changes. No `LOG_SCHEMA_VERSION` change.

### 4.7 Docs

Fix every line naming `SOURCE_FOE_LEVEL`, `maxFoeLevel` or the Source's provisional block: `docs/reference/game.md` (the Source Guardians line, about line 24), `.claude/skills/yomi-balance/levers.md`, `src/game/CLAUDE.md` if it names them (mind the 8 KB cap), comments in `encounters.ts`; search `.claude/` and `docs/reference/` for `SOURCE_FOE_LEVEL`. Add `sgk20` to `.claude/skills/yomi-balance/bands.md`'s cell codes and measure names (report only) and its figure to "Now", with `sg20-18` and `sg20`'s new figures.

### 4.8 Exclusions

No change to the near-home Source, the Source's location, its rune loot row, the blight, other encounters' blocks, the simulator's policy, or the long campaign's tuning (step 14 measures; stage 12 tunes). No scene change beyond the sound and look tables.

## 5. Verification

- `npx vitest run src/game/encounters.test.ts src/engine/battleEngine.test.ts src/engine/policies.test.ts`, then `npm test` and `npm run build`: pass.
- The near-home test (threats 1–5 identical) passes before and after.
- The yardstick test holds `source_horror` to `foeYardstick(20, 'expected')` with any exceptions named.
- The snapshot diff touches only `source_guardians` above threat 5.
- Refactor guard green and unedited; 50-campaign SHA-256 identical, recorded in `log.md`.
- `sgk20`, `sg20-18`, `sg20` recorded (`logs/s11-13-*`), with any trials.
- `grep -rn SOURCE_FOE_LEVEL src scripts docs/reference .claude` finds nothing.

## 6. Completion criteria

- [ ] `source_horror` with `blight_breath` and `horror_claws`; `SOURCE_AT_20` above threat 5; the near-home Source byte-identical; `SOURCE_FOE_LEVEL` and `maxFoeLevel` gone.
- [ ] Yardstick, composition and engine tests (§4.3) pass; the snapshot re-recorded narrowly with its title extended.
- [ ] Guard and 50-campaign check identical.
- [ ] `sgk20` within 300–475, or three trials logged and the result brought to the orchestrator and answered; `sg20-18` and `sg20` recorded.
- [ ] Docs and `bands.md` updated as §4.7.
- [ ] One commit, "Stage 11 step 13: the Source at 20", files staged by path, no attribution lines; the index's row 13 updated with status and commit.

## 7. Execution record
