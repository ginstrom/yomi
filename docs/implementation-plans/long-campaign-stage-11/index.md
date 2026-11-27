# Implementation plan: long campaign, stage 11 (the high roster)

The outer rings get their monsters, ring by ring (7, 9, 12, 15, 18), and the Source's Blight Horror is rebuilt at native level 20: each kind with its block against the yardstick, abilities, wards, XP, native level, trophy and sprite; each ring with its encounters, fixed nests, spawn kinds and favoured runes. One engine addition, the golem's `CombatantStats.immune`; the simulator gains `--player-kit expected` for the per-ring cells. Elder Glade's wyvern-hide stand-in and `SOURCE_FOE_LEVEL` go.

**Source design:** [`docs/designs/long-campaign/stage-11-high-roster.md`](../../designs/long-campaign/stage-11-high-roster.md) (status "ready for planning"; the stage design is the approved design). It cuts from [`reference/campaign-to-level-20.md`](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.5 (the roster), §5.2 (the yardstick), §4.2 (a battle with special attacks), and [`reference/gear-and-runes.md`](../../designs/long-campaign/reference/gear-and-runes.md) §4.3 (trophies), §4.5 (rune loot), §4.6 (wards). Conventions: [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md). Previous stage: [stage 10's plan](../long-campaign-stage-10/index.md) and [feature record](../../features/long-campaign-stage-10.md). Feature record: [`docs/features/long-campaign-stage-11.md`](../../features/long-campaign-stage-11.md). History: [`log.md`](log.md). Written against `1a008af` on branch `long-campaign-stage-11` (off main at `c138d83`).

## Decisions taken for the orchestrator

Design first, then the references, then the code (the code wins, per the stages index). *(For the user)* marks a reading of a silent or loose design: the plan is written for its default; Open questions lists the steps it blocks.

1. **Encounter compositions and first counts** *(for the user, Q1)*: the design names each encounter's band but not its foes or counts. Default: C5's table (lead kind first, minions from the same or nearer rings), first values that the ring's step tunes against its cells.
2. **Each ring's nests** *(for the user, Q2)*: nests keep their positions and unique loot, and change encounter, id and name; each ring keeps its nest count; bandits keep about a third (2 of 5 in rings 7 to 15, 1 of 4 in ring 18). Spiders and salamanders leave the fixed nests of rings 7 and 9 (they still spawn there). Table: C6.
3. **The Source at 20** *(for the user, Q3)*: a new kind `source_horror` ("Blight Horror", native 20, its own sprite) leads two Blight Cultists at threat 20. **The near-home Source keeps today's `horror` block and slots for threats 1 to 5**, so `--near-source` (the early figures, the refactor guard, the 50-campaign check) fights exactly as before. `SOURCE_FOE_LEVEL` and `maxFoeLevel` are removed. C7.
4. **The cells' reading of "most but not all"** *(for the user, Q4)*: per-ring cells are report-only (the user's bands are not extended); the plan's working reading is **300 to 475 wins of 500** at both band ends, with `--player-kit expected`, a party of the threat's level. A ring step tunes only its own encounters toward it, at most three trials an encounter, then reports. **Standing rule (the user, 2026-11-27, from step 11; replaces step 09's top-end rule):** the threats the map has (7, 9, 12, 15, 18) are tuned inside 300–475 first, the band's ends second; an in-play miss after three trials goes to the user; a band-end miss is recorded for stage 12 and the step carries on. C9.
5. **The yardstick for the new kinds** *(for the user, Q5)*: stage 12's measurement is not ready, so the new kinds are held to a **kitted** fighter growth table measured once in step 02 from `expectedKit` (the "stage 10 `expectedKit` readings" of the design); today's kinds stay on today's bare table, unchanged. C2.
6. **Favoured runes of the new nests** *(for the user, Q6)*: in `FAVOURED_RUNES` (it exists, `loot.ts`): `wyvern_roost` venom, `basilisk_lair` rime, `blight_cult` and `blight_lich_court` storm, `young_dragon` and `elder_wyrm` ember; none for the rest and none for the Source (its encounter id is also the near-home Source's).
7. **Blight Breath** *(for the user, Q7)*: element `blight` (gear §4.6; campaign §5.5's "acid" is read as its Corroded), lays Corroded, **foes only** (the Horror's guardians are the blight's own).
8. **Worg Riders' band is 7 to 9** *(for the user, Q8)*, not the design's 6 to 9: the Worg Rider is native 7 and campaign §5.3 keeps every band's minimum at or above its kinds' native levels. No ring has threat 6, so play is the same either way.
9. **Sprites: 13** *(for the user, Q9)*: the design says 14; its table names 12 new kinds, and the rebuilt Horror is a 13th (decision 3). The plan draws 13.
10. **`--player-kit expected`** *(for the user, Q10)*: each member wears `expectedKit(level)`'s tier at the **low** end of each range (grade, runes filled, rank), in the families stage 10's gear policy picks by role, and the war hammer when the encounter's lead foe has resistance 4 or more; weapon runes Ember then Stone, armour runes Stone then Life (no ring wards: gear §5.8 step 3 stays out). C1.
11. **Sweep and Rock use existing ability fields** (no engine addition beyond the immunity, design §2): Sweep is an area centred on the ogre, radius 1, foes only, through resistance; Rock is a burst of radius 0 at range 4, through resistance. **`throughResistance` means cut by resistance, as a blow: give the kind `armorPierce`, or omit the flag to ignore resistance** (found in step 08; without it only the element's ward cuts an area; breaths keep no flag). If either cannot be built from today's fields, the ring step stops and reports. The wolf's pack bonus, the wyvern's flight and the wight's half damage from non-magic weapons stay out (plain blocks).
12. **The immunity** (step 03): `CombatantStats.immune?: true` means no status whose `StatusRule` has a `tick` (today Poisoned and Corroded) is laid on the unit; checked in the one place a status is laid; the outcome records `immune: true`, so `LOG_SCHEMA_VERSION` 26 → 27; the policy values such a status at 0 on an immune unit. No `SAVE_VERSION` bump for it (a missing field reads as none).
13. **Blightborn:** the Blight Cultist, the Blight Lich and `source_horror` are `blightborn` (Dawn's bane applies), as `horror` is.
14. **Trophies** (gear §4.3) land with their kinds: wolf and worg_rider wolfhide 1 (ring 7), wyvern wyvern_hide 3 (ring 9), basilisk basilisk_scale 3 (ring 12), young_dragon drake_scale 6 (ring 15), elder_wyrm drake_scale 10 (ring 18). **Elder Glade's stand-in** (`STAND_IN_GOODS`) is removed in ring 9's step, when wyverns drop wyvern hide.
15. **The refactor guard and the 50-campaign check stay identical through every step**: `--near-source` drops every fixed nest above threat 5, the near-home Source is unchanged (decision 3), and new `SPAWN_KINDS` are appended with `fromThreat: 7`. If a step moves either, it finds the cause; if the cause is only far spawns' kinds reaching the early campaign, it stops and brings it to the orchestrator (a re-record then needs approval and goes in that step). No step is planned to re-record the guard. **Exception (step 03, approved):** log 27 changed only `schemaVersion` on `battle_start`, so the guard's events hash and the forecast `logs` digests were re-recorded with play proven unmoved; later steps compare the 50-campaign check against `1e85d023…ed216` (`log.md`, step 03).
16. **The policy snapshot** (`src/engine/policies.test.ts`) iterates over every encounter, so **each ring step re-records it**, proving only its new encounters' lines were added (every earlier line unchanged), and step 13 re-records it with only `source_guardians` lines above threat 5 changed. Each says so in the test's title.
17. **Versions:** `SAVE_VERSION` 31 → 32, 33, 34, 35, 36 in the ring steps 08 to 12 (each changes fixed locations; no migration, older saves read as unreadable); step 13 changes no fixed location (no bump). `LOG_SCHEMA_VERSION` 26 → 27 in step 03 only.
18. **First values for each kind** (XP, natives, defences, specials): C3 and C4. The ring step authors each block against the kitted yardstick; numbers not given there (dice, AP, armour class, hit points) are the engineer's, recorded.
19. **Early measures with `--near-source`** (as stages 9 and 10): `one`, `company`, `rl10`, the refactor guard and the 50-campaign check. **Stage 12 owns** the accepted out-of-band figures (`one` 288, `company` 289, 331 days), the long campaign's gear lag and the Source at 1 of 100; this stage records the long run and does not tune it. Any figure further out than accepted goes to the orchestrator with options, never tuned away. The user's bands are never changed.
20. **Out of scope:** the deferred behaviours (decision 11), ring-element armour wards in the gear policy, the simulator's spend order and targeting, market income, sounds beyond reusing today's cues (a new cue is allowed only through the `yomi-sound` skill), the trading post selling tier 3+.

## Scope and shared constraints

- **In:** S11-R1 to S11-R5, the design's tests, cells and play script (§6), its long run (§6 "After the last ring"), the docs the stages index asks for, and the two items carried from stage 10 (trophies from kills with the stand-in removed; the Source rebuilt, `SOURCE_FOE_LEVEL` removed).
- **Ring by ring.** Each ring step (08 to 13) leaves a playable game: its kinds, sprites (merged before it), encounters, nests, spawn kinds, trophies and favoured runes in; tests, the guard and the 50-campaign check green; its cells measured. Bandit placeholders of later rings stay until their ring lands.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file; `npm run build` before a ring step's commit;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` first;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 08–14 run them, in order). Measurements go through the `yomi-measure` agent; 100 long campaigns took 4 minutes alone in stage 10.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, args `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`; `GUARD_RECORDS`, `GUARD_EVENTS_SHA256`. Rules: `.claude/skills/yomi-balance/guards.md`. Every step keeps it green and unedited (decision 15).
- **The 50-campaign check** before committing a domain or simulator step (02, 03, 08–13, 14 if anything changed), against the hash before the step (step 01's, `log.md`), recorded "identical" or the diff in `log.md`:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  Sprite steps (04–07) and step 15 change no rule and need not run it (say so).
- **The early-game figure.** Stage 10 ended at `one` 288 (331 days, 1.2 dead), `company` 289, `rl10` 409 (533 days), with `--near-source`; `one`, `company` and the days are accepted until stage 12 (`bands.md`). Step 01 re-measures them; step 14 measures again. A move of more than about 5 points is explained in the commit and in `src/game/CLAUDE.md`'s scaling line, or brought to the orchestrator.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG for an existing encounter. New spawn kinds are appended (`.claude/skills/yomi-add-content/encounter.md`). The immunity draws nothing. Favoured runes draw from the loot stream, as today.
- **Import cycles.** `encounters.ts` imports `bandits.ts`; `loot.ts` imports `encounters.ts` and `worldMap.ts`; `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts` import one another (`src/game/CLAUDE.md`): nothing at module load. `src/combat/` imports nothing from `src/game/` or `scripts/`.
- **Content checklists** (`.claude/skills/yomi-add-content/`): `foe.md`, `ability.md`, `encounter.md` (ring steps), `status.md`, `battle-event.md` (step 03). Sprites: `.claude/skills/yomi-sprites/`; never edit an exported PNG; `npm run sprites`, `npm run sprites:check`, then the `yomi-asset-check` agent. Balance: `.claude/skills/yomi-balance/`. Manual: `.claude/skills/yomi-manual/`.
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on `long-campaign-stage-11`, without pushing; files staged by path. A sprite step runs in its own worktree and commits on its own branch, merged by the orchestrator before its ring step. Messages "Stage 11 step NN: <title>". No attribution lines.
- **Docs.** Each step fixes the CLAUDE.md lines its change makes wrong and searches the CLAUDE.md files, `.claude/` and `docs/reference/` for every name it renames or removes (`SOURCE_FOE_LEVEL`, `STAND_IN_GOODS`, renamed nest ids). `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB: **`src/game/CLAUDE.md` is at 7,654 bytes**; move detail to `docs/reference/game.md` before adding a line. Each ring step adds its cells to `bands.md`'s cell codes and measure names (report only) and "Now"; step 15 writes the rest and the manual.

## Contracts

The task files copy each contract they produce or consume unchanged. "Existing" means at `1a008af`. A step that changes a contract updates the index and every task file that copies it.

### C1. Expected kit for single battles (step 02, done)

`--player-kit expected` and `expectedGear(character, level, leadResistance)` (`scripts/simulate.ts`): the contract's text is in [`02-expected-kit.md`](02-expected-kit.md) and copied in each ring step's task file; the code is as written there.

### C2. The kitted yardstick (step 02, done)

`KITTED_FIGHTER_GROWTH` and `foeYardstick(level, kit: 'bare' | 'expected' = 'bare')` (`src/combat/combat.ts`); every stage 11 kind is in `STAGE_11_KINDS` (`src/game/encounters.test.ts`), held to `'expected'` at its native level, exceptions named with a reason. Text: [`02-expected-kit.md`](02-expected-kit.md).

### C3. The new kinds (steps 08 to 13)

Each a `MonsterKind`, `UnitKind` id = sprite id, block `<NAME>_STATS` in `src/combat/combat.ts`, `FOE_STATS`, `FOE_XP` (first value), `FOE_NATIVE_LEVEL`, `FOE_SOUNDS`, `DEATH`:

| Kind | Name | Native | XP | Defence | Special (C4) | Step |
| --- | --- | --- | --- | --- | --- | --- |
| `wolf` | Wolf | 6 | 80 | — | 10 AP, plain bite | 08 |
| `worg_rider` | Worg Rider | 7 | 100 | res 1 | `worg_strikes` | 08 |
| `ogre` | Ogre | 7 | 140 | res 2 | `ogre_sweep` | 08 |
| `wyvern` | Wyvern | 9 | 150 | res 2 | `wyvern_strikes` | 09 |
| `barrow_wight` | Barrow Wight | 11 | 110 | res 3 | spells `drain_life` | 10 |
| `basilisk` | Basilisk | 11 | 150 | res 4 | `basilisk_gaze` | 10 |
| `hill_giant` | Hill Giant | 12 | 200 | res 3 | weapon Club; `giant_rock` | 10 |
| `stone_golem` | Stone Golem | 14 | 180 | res 8, wards poison 99, `immune` | weapon Slam | 11 |
| `blight_cultist` | Blight Cultist | 14 | 100 | res 1, blightborn | spells `lightning_bolt`, `curse`, `heal` | 11 |
| `young_dragon` | Young Dragon | 15 | 300 | res 4, wards fire 10 | `dragon_breath`, `dragon_strikes` | 11 |
| `blight_lich` | Blight Lich | 17 | 300 | res 3, regeneration 3, blightborn | spells `lightning_bolt`, `death_cloud`, `drain_life`, `dark_shield` | 12 |
| `elder_wyrm` | Elder Wyrm | 18 | 450 | res 5, regeneration 2, wards fire 15 | `wyrm_breath`, `wyrm_strikes` | 12 |
| `source_horror` | Blight Horror | 20 | 500 | res 3, regeneration 2, blightborn | `blight_breath`, `horror_claws` | 13 |

Piercing (the yardstick does not see `armorPierce`; step 08, against the kit's resistance): wolf 4, worg rider 6, ogre 5; wyvern 11 (step 09); barrow wight 8, basilisk 9, hill giant 9 (step 10; the Rock keeps `throughResistance`); stone golem 9, blight cultist 10 (a Blight Dart thrown 4 hexes), young dragon 10 (step 11; the breath has no flag); blight lich 14, elder wyrm 21, all of the kit's 21 from 17 (step 12; the Elder Wyrm also 115 to hit and 185 hit points, named exceptions).

### C4. The new abilities (steps 08 to 13)

In `ABILITIES`, ids in `ABILITY_IDS` after `fire_spit` and before `power_attack`, in this order; numbers not given are the engineer's first values:

- `worg_strikes` "Spear and Bite": routine, strikes Spear then Bite.
- `ogre_sweep` "Sweep": area `{ shape: 'burst', centredOnSelf: true, range: 0, radius: 1, foesOnly: true, throughResistance: true, damage, halfOnMiss: false }`, recharge ≥ 1.
- `wyvern_strikes` "Bite and Sting": routine, Bite then Tail Sting laying `poisoned`.
- `basilisk_gaze` "Gaze": area cone range 3, no damage, lays `chilled`, recharge 2, `halfOnMiss: false`.
- `giant_rock` "Rock": area burst range 4, radius 0, `throughResistance: true`, damage, recharge ≥ 1. The flag cuts it by resistance, as a blow: give the Hill Giant `armorPierce`, or omit the flag to ignore resistance (step 10 chooses).
- `dragon_breath` "Fire Breath": area cone range 3, 6d6, element fire, lays `seared`, `halfOnMiss: true`, recharge 3.
- `dragon_strikes` "Bite and Claws": routine Bite (2d8), Claw (1d8), Claw (1d8).
- `wyrm_breath` "Fire Breath": area cone range 4, 8d6, fire, lays `seared`, `halfOnMiss: true`, recharge 3.
- `wyrm_strikes` "Bite and Claws": routine of three strikes, heavier than the dragon's.
- `blight_breath` "Blight Breath": area burst centred on self, radius 2, `foesOnly: true`, element blight, lays `corroded`, `halfOnMiss: true`, recharge 3.
- `horror_claws` "Claws": routine of two claws.

Each area gets an `ABILITY_SOUNDS` and `ABILITY_LOOKS` entry reusing today's cues and looks.

### C5. The new encounters (steps 08 to 13)

Ids in `ENCOUNTERS` (after `freebooter_host`, in this order), `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`; slots lead first (`fromThreat` where noted); counts from `band.min` up; spawn kind appended to `SPAWN_KINDS` with `fromThreat: 7`; trophy and favoured rune as listed:

| Id | Band | Slots, in order | Counts | Spawn name | Favoured | Step |
| --- | --- | --- | --- | --- | --- | --- |
| `wolf_pack` | 6–9 | wolf ×5 (Pack Leader first) | 4, 4, 4, 5 | Wolf Pack | — | 08 |
| `worg_riders` | 7–9 | worg_rider, wolf, worg_rider, wolf, wolf, worg_rider (wolves `fromThreat` 8) | 3, 3, 5 | Worg Band | — | 08 |
| `ogre_camp` | 7–10 | ogre, worg_rider, ogre, wolf | 3, 3, 3, 4 | Ogre Camp | — | 08 |
| `wyvern_roost` | 9–12 | wyvern ×4 (the Old Wyvern last) | 4, 4, 3, 3 (falls: the user's decision, step 09) | Wyvern Roost | venom | 09 |
| `barrow_wights` | 11–14 | barrow_wight ×4 | 4, 4, 4, 4 | Barrow | — | 10 |
| `basilisk_lair` | 11–14 | basilisk, ogre, basilisk | 3, 3, 3, 3 | Basilisk Lair | rime | 10 |
| `hill_giant_steading` | 12–15 | hill_giant, hill_giant, ogre | 3, 3, 3, 3 | Giant Steading | — | 10 |
| `golem_ruin` | 14–17 | stone_golem, barrow_wight, stone_golem, barrow_wight, stone_golem | 4, 4, 4, 5 | Golem Ruin | — | 11 |
| `blight_cult` | 14–18 | blight_cultist, barrow_wight, blight_cultist, barrow_wight, blight_cultist | 5, 4, 4, 5, 5 | Blight Cult | storm | 11 |
| `young_dragon` | 15–18 | young_dragon, wyvern, wyvern | 2, 2, 3, 3 | Dragon Lair | ember | 11 |
| `blight_lich_court` | 17–20 | blight_lich, barrow_wight, blight_cultist, barrow_wight, blight_cultist | 5, 5, 5, 4 (step 12; first 3, 4, 4, 5) | Lich Court | storm | 12 |
| `elder_wyrm` | 18–20 | elder_wyrm, young_dragon, young_dragon | 2, 2, 2 (step 12; first 2, 2, 3) | Wyrm Lair | ember | 12 |

`TROPHIES` (decision 14) grows with the kinds. Counts and slot order are the ring step's tuning levers (decision 4).

### C6. The nests (steps 08 to 12)

Each listed location keeps its position and loot and takes the new id, name and encounter (`farMonsters` in `newWorld`, `src/game/worldMap.ts`); the rest are unchanged.

| Ring | Old id → new id, name, encounter | Kept bandits | Step |
| --- | --- | --- | --- |
| 7 | `webwood_nest` → `greyfang_pack` Greyfang Pack `wolf_pack`; `hollow_spiders` → `hollow_riders` Hollow Riders `worg_riders`; `ashen_pool` → `ashen_ogres` Ashen Hill Ogres `ogre_camp` | `wildland_bandits`, `moorland_bandits` | 08 |
| 9 | `cinder_springs` → `cinder_roost` Cinder Roost `wyvern_roost`; `deepweb_hollow` → `deepcrag_roost` Deepcrag Roost `wyvern_roost`; `smoking_mere` → `mere_ogres` Mere Ogres `ogre_camp` | `ironhold_company`, `grey_company` | 09 |
| 12 | `stonegate_company` → `stonegate_barrow` Stonegate Barrow `barrow_wights`; `thornwall_company` → `thornwall_lair` Thornwall Lair `basilisk_lair`; `marsh_company` → `marsh_steading` Marsh Steading `hill_giant_steading` | `ravenhill_company`, `dustroad_company` | 10 |
| 15 | `grey_freebooters` → `grey_ruin` The Grey Ruin `golem_ruin`; `wolfhead_host` → `wolfhead_cult` Wolfhead Cult `blight_cult`; `saltwind_host` → `saltwind_drake` Saltwind Drake `young_dragon` | `red_freebooters`, `black_banner_host` | 11 |
| 18 | `ashen_host` → `ashen_court` The Ashen Court `blight_lich_court`; `last_host` → `last_wyrm` The Last Wyrm `elder_wyrm`; `blightmarch_freebooters` → `blightmarch_drake` Blightmarch Drake `young_dragon` | `iron_freebooters` | 12 |

### C7. The Source at 20 (step 13)

```ts
// src/game/encounters.ts
// sourceGuardians(party, threat): threat <= 5: today's SOURCE_GUARDIANS slots and counts (band 1–5), byte-identical;
//   above 5: SOURCE_AT_20, fought at 20 whatever the threat: slots source_horror "Blight Horror", blight_cultist "Blight
//   Acolyte", blight_cultist "Blight Zealot"; count 3. ENCOUNTER_BANDS.source_guardians stays { min: 1, max: 20 }.
// SOURCE_FOE_LEVEL and EncounterDef.maxFoeLevel are removed. The Source location (`SOURCE_ID`) is unchanged.
```

### C8. Sprites (steps 04 to 07, done)

All 13 kinds' sprites are in the atlas (`art/units/<kind>.sprite.toml`); text in the sprite steps' task files.

### C9. The cells (steps 02, 08 to 14)

`--encounter E --threat T --party-level T --player-kit expected`, 500 battles from seed 1, report only, read against decision 4 (300–475). Codes (`bands.md`'s cell codes and measure names, lower case): `wp6`, `wp9`, `wr7`, `wr9`, `oc7`, `oc10` (08); `wy9`, `wy12` (09); `bw11`, `bw14`, `bl11`, `bl14`, `hg12`, `hg15` (10); `go14`, `go17`, `cu14`, `cu18`, `yd15`, `yd18` (11); `lc17`, `lc20`, `ew18`, `ew20` (12); `sgk20` (`source_guardians` 20, 13). Step 02 also measures, kitted, `bco9k`, `bco12k`, `fh15k`, `fh18k`, `sgk20` on today's Source.

## Tasks

| Step | Task | Outcome | Depends on | Engineer / reviewer | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | [The stage's baseline](01-baseline.md) | 50-campaign hash, `one`, `company`, `rl10` (500, `--near-source`), `long` (100), far cells; no code change | — | sonnet / sonnet | done (`42eaff0`) |
| 02 | [Expected kit and the kitted yardstick](02-expected-kit.md) | `--player-kit expected`, `expectedGear` (C1), `KITTED_FIGHTER_GROWTH`, `foeYardstick(level, kit)` (C2); kitted far cells | 01 | opus / opus | done (`67a6f0d`) |
| 03 | [The golem's immunity](03-immunity.md) | `CombatantStats.immune`, the `immune` outcome field, log 27, policy value (decision 12) | 01 | opus / opus | done (`d94188b`) |
| 04 | [Sprites: ring 7](04-sprites-ring-7.md) | `wolf`, `worg_rider`, `ogre` (C8) | — | sonnet / opus | done (`21834ec`, `d4d6402`) |
| 05 | [Sprites: rings 9 and 12](05-sprites-rings-9-12.md) | `wyvern`, `barrow_wight`, `basilisk`, `hill_giant` (C8) | — | sonnet / opus | done (`5bc31dc`, `3d0e480`) |
| 06 | [Sprites: ring 15](06-sprites-ring-15.md) | `stone_golem`, `blight_cultist`, `young_dragon` (C8) | — | sonnet / opus | done (`7ebb9c6`, `943e193`) |
| 07 | [Sprites: ring 18 and the Source](07-sprites-ring-18-source.md) | `blight_lich`, `elder_wyrm`, `source_horror` (C8) | — | sonnet / opus | done (`95e5046`, `651a4c7`) |
| 08 | [Ring 7: wolves, worg riders, ogres](08-ring-7.md) | Kinds, abilities, encounters, nests, spawn kinds, wolfhide; save 32; snapshot; cells | 02, 04 | opus / opus | done (`b0fbe7d`, `4ca43d2`) |
| 09 | [Ring 9: wyverns](09-ring-9.md) | Wyvern, roost (4, 4, 3, 3), nests, wyvern hide, stand-in removed; save 33; cells | 08, 05 | opus / opus | done (`2b35cb9`, `cecd65f`) |
| 10 | [Ring 12: wights, basilisks, giants](10-ring-12.md) | Three kinds and encounters (4 wights; lair and steading of 3), nests, basilisk scale; save 34; cells | 09, 05 | opus / opus | done (`5257f59`, `65ac1c0`, `9f692dc`) |
| 11 | [Ring 15: golems, cultists, young dragons](11-ring-15.md) | Three kinds (golem `immune`), encounters (ruin of 4, 5 at 17; cult of 5, 4 at 15 and 16; lair of 2, 3 from 17), nests, drake scale; save 35; cells | 10, 03, 06 | opus / opus | done (`5c83ec8`, `1b78a7e`, `eab9959`, `3f4f90c`, `4ccac5e`) |
| 12 | [Ring 18: the lich and the elder wyrm](12-ring-18.md) | Two kinds and encounters, nests, drake scale; save 36; cells | 11, 07 | opus / opus | done (`adb0921`, `921b3f7`, `14fc294`, `2ef2fb6`, `ad45e84`, `8916789`, `6061296`) |
| 13 | [The Source at 20](13-source.md) | `source_horror`, `SOURCE_AT_20`, `SOURCE_FOE_LEVEL` removed (C7); snapshot; `sgk20` | 12, 07 | opus / opus | pending |
| 14 | [Measure and record](14-measure.md) | Early figures vs step 01; `long` (100) vs stage 10: Source share, battles to level for stage 12; every cell | 13 | opus / opus | pending |
| 15 | [Document and play](15-document-and-play.md) | CLAUDE.md files, `docs/reference/`, skills, manual and screenshots, implementation notes, stages index; play script walked | 14 | sonnet / opus | pending |

**Tiers.** "opus" means leave the model unset; "sonnet" means `model: "sonnet"`. Each task file's Difficulty line gives the reasons.

## Execution order

01 → 02 → 03 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15, with the sprite steps 04–07 beside them.

- **04–07** (sprites) are done and merged.
- **Ring steps are strictly sequential**: they share `encounters.ts`, `combat.ts`, `abilities.ts`, `worldMap.ts`, `blight.ts`, `loot.ts`, `save.ts`, the snapshot and `bands.md`.
- **Checkpoints:** a ring step stops for the orchestrator if a cell stays outside 300–475 after three trials (decision 4), if an ability cannot be built from existing fields (decision 11), or if the guard or the 50-campaign check moves (decision 15). Step 14 brings any early figure further out than accepted to the orchestrator.

## Requirement map

| Design item | Steps |
| --- | --- |
| S11-R1 each kind's block, abilities, wards, XP, native level, trophy, sprite | 08–13 (blocks, trophies), 04–07 (sprites), 02 (yardstick) |
| S11-R2 each encounter's band, counts, fixed nests and spawn kind | 08–12 |
| S11-R3 the Source rebuilt at 20 | 13, 07 |
| S11-R4 the golem's immunity flag | 03, 11 |
| S11-R5 trophies from kills; Elder Glade's stand-in removed | 08–12; 09 |
| §2 rune loot favours a nest's element | 09–12 (`FAVOURED_RUNES`) |
| §2 the yardstick test covers every new kind | 02, 08–13 |
| §2 deferred behaviours stay out | 08–12 (plain blocks) |
| §5 versions: `SAVE_VERSION` per ring, `LOG_SCHEMA_VERSION` for the immunity | 08–12; 03 |
| §6 per ring: yardstick, composition at band ends, one engine test per special kind | 08–13 |
| §6 simulator: `--player-kit expected`, cells at both band ends | 02; 08–13; 14 |
| §6 play: `fight` each new encounter levelled and kitted | 15 |
| §6 after the last ring: long run (100) vs stage 10, Source share and battles to level for stage 12 | 01 (baseline), 14 |
| Carried: trophies table, stand-in, `SOURCE_FOE_LEVEL` | 08–12, 09, 13 |
| Cross-stage: docs, manual, implementation notes, stages index | each step; 15 |

## Completion criteria

- `npm test`, `npm run test:browser`, `npm run build` and `npm run sprites:check` pass; the `yomi-asset-check` agent passes.
- Every C3 kind, C4 ability, C5 encounter, C6 nest and C8 sprite is in; `SOURCE_FOE_LEVEL` and `STAND_IN_GOODS` are gone; `TROPHIES` holds decision 14's five kinds and six entries.
- The refactor guard is unedited and green; the 50-campaign hash equals step 01's after every step (or a move was approved, decision 15); the policy snapshot was re-recorded only as decision 16 says.
- Every C9 cell measured and recorded; each within 300–475 or brought to the orchestrator and answered.
- Early figures within about 5 points of step 01's, or explained; the long run (100) recorded against stage 10 with its Source share and battles to level for stage 12.
- The docs, the manual and its screenshots are current; the stage design has its implementation notes; the stages index shows stage 11's status; the play script walked and recorded.

## Open questions

None. **Answered 2026-11-26: the user accepted every planner default (Q1 to Q10)**; each is the decision marked *(for the user, Qn)* above (decision log of the feature record).

## For implementers

When you start or finish a step, update its status and commits in the table above. Record evidence (commands and output, the guard's result, the 50-campaign hash, cells), deviations and blockers in your task file's "Execution record", and anything the plan as a whole accumulates (measurements, run histories, review summaries) in [`log.md`](log.md). Keep this index short; every implementer reads it.
