# Step 08: Ring 7: wolves, worg riders, ogres

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-11-high-roster.md) (§2 ring 7, §4 "Ring 7", §5, §6 "Per ring") · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.5 (the roster), §5.2 (the yardstick), §5.3 (bands) · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.3 (trophies) · [Stages index](../../designs/long-campaign/index.md) · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) authors three native-level blocks against the kitted yardstick, builds two abilities from existing `Ability` fields, re-records the policy snapshot narrowly, and tunes counts against cells. The reviewer (opus) checks the blocks against the yardstick and the design, that the snapshot re-record added lines only, that the guard and the 50-campaign check are identical, and that every cell was read from the right line.

## 1. Objective

Land ring 7 as a playable increment, the model the later ring steps follow:
- three kinds: `wolf`, `worg_rider`, `ogre` (blocks, XP, native levels, sounds), with the worg's routine and the ogre's sweep;
- three encounters: `wolf_pack`, `worg_riders`, `ogre_camp` (bands, slots, counts), and their spawn kinds;
- ring 7's nests: three of its five fixed nests become the new encounters; the two bandit camps stay;
- trophies: wolfhide from wolves and worg riders;
- `SAVE_VERSION` 31 → 32;
- the per-ring cells at both ends of each band, with `--player-kit expected`, tuned toward the working reading.

## 2. Requirements and context

- **S11-R1:** each kind's block, abilities, wards, `FOE_XP`, `FOE_NATIVE_LEVEL`, trophy and sprite (campaign R7, A11).
- **S11-R2:** each encounter with its band, counts, fixed nests and spawn kind (campaign R5).
- **S11-R5:** trophies from kills (gear R7).
- **Design §2:** the wolf's pack bonus stays deferred: a plain block. Each ring's nests replace bandit-filled placeholders; bandits keep about a third of each ring. `SPAWN_KINDS` gains the new encounters, by band. The yardstick test covers every new kind (stage 12's measurement is not ready, so the kitted table of step 02).
- **Design §4, ring 7:** wolves run down the archer. Worg riders strike spear and bite in one action. An ogre sweeps everyone beside it.
- **Design §5:** blocks in `combat.ts`; encounters, kinds, XP and native levels in `encounters.ts`; nests in `worldMap.ts`; trophies in `encounters.ts`. `SAVE_VERSION` is bumped for each ring landed that changes fixed locations.
- **Design §6, per ring:** tests: the kinds' yardstick test; the encounters' composition at their bands' ends; each new ability's behaviour on the kind (one engine test per kind with something special). Simulator: `--encounter X --threat T --party-level T --player-kit expected` at both ends of each band; a party of the threat's level wins most but not all.
- **Campaign §5.5 rows:** Wolf, native 6, fast skirmisher (10 AP), no defence, pack bonus deferred. Worg Rider, native 7, goblin on a worg, res 1, routine Spear, Bite. Ogre, native 7, brute, res 2, Sweep: a routine striking each adjacent foe once.
- **Gear §4.3:** wolfhide, wolves and worgs, 1 per foe.

### Decisions from the index (unchanged)

1. **Encounter compositions and first counts** *(for the user, Q1)*: the design names each encounter's band but not its foes or counts. Default: C5's table (lead kind first, minions from the same or nearer rings), first values that the ring's step tunes against its cells.
2. **Each ring's nests** *(for the user, Q2)*: nests keep their positions and unique loot, and change encounter, id and name; each ring keeps its nest count; bandits keep about a third (2 of 5 in rings 7 to 15, 1 of 4 in ring 18). Spiders and salamanders leave the fixed nests of rings 7 and 9 (they still spawn there). Table: C6.
4. **The cells' reading of "most but not all"** *(for the user, Q4)*: per-ring cells are report-only (the user's bands are not extended); the plan's working reading is **300 to 475 wins of 500** at both band ends, with `--player-kit expected`, a party of the threat's level. A ring step tunes only its own encounters toward it, at most three trials an encounter, then reports. C9.
5. **The yardstick for the new kinds** *(for the user, Q5)*: stage 12's measurement is not ready, so the new kinds are held to a **kitted** fighter growth table measured once in step 02 from `expectedKit` (the "stage 10 `expectedKit` readings" of the design); today's kinds stay on today's bare table, unchanged. C2.
8. **Worg Riders' band is 7 to 9** *(for the user, Q8)*, not the design's 6 to 9: the Worg Rider is native 7 and campaign §5.3 keeps every band's minimum at or above its kinds' native levels. No ring has threat 6, so play is the same either way.
11. **Sweep and Rock use existing ability fields** (no engine addition beyond the immunity, design §2): Sweep is an area centred on the ogre, radius 1, foes only, through resistance; Rock is a burst of radius 0 at range 4, through resistance. If either cannot be built from today's fields, the ring step stops and reports. The wolf's pack bonus, the wyvern's flight and the wight's half damage from non-magic weapons stay out (plain blocks).
14. **Trophies** (gear §4.3) land with their kinds: wolf and worg_rider wolfhide 1 (ring 7), wyvern wyvern_hide 3 (ring 9), basilisk basilisk_scale 3 (ring 12), young_dragon drake_scale 6 (ring 15), elder_wyrm drake_scale 10 (ring 18). **Elder Glade's stand-in** (`STAND_IN_GOODS`) is removed in ring 9's step, when wyverns drop wyvern hide.
15. **The refactor guard and the 50-campaign check stay identical through every step**: `--near-source` drops every fixed nest above threat 5, the near-home Source is unchanged (decision 3), and new `SPAWN_KINDS` are appended with `fromThreat: 7`. If a step moves either, it finds the cause; if the cause is only far spawns' kinds reaching the early campaign, it stops and brings it to the orchestrator (a re-record then needs approval and goes in that step). No step is planned to re-record the guard.
16. **The policy snapshot** (`src/engine/policies.test.ts`) iterates over every encounter, so **each ring step re-records it**, proving only its new encounters' lines were added (every earlier line unchanged), and step 13 re-records it with only `source_guardians` lines above threat 5 changed. Each says so in the test's title.
17. **Versions:** `SAVE_VERSION` 31 → 32, 33, 34, 35, 36 in the ring steps 08 to 12 (each changes fixed locations; no migration, older saves read as unreadable); step 13 changes no fixed location (no bump). `LOG_SCHEMA_VERSION` 26 → 27 in step 03 only.
18. **First values for each kind** (XP, natives, defences, specials): C3 and C4. The ring step authors each block against the kitted yardstick; numbers not given there (dice, AP, armour class, hit points) are the engineer's, recorded.

### Contracts consumed (copied unchanged from the index)

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

### Contracts produced (ring 7's rows, copied unchanged from the index)

**C3. The new kinds** — each a `MonsterKind`, `UnitKind` id = sprite id, block `<NAME>_STATS` in `src/combat/combat.ts`, `FOE_STATS`, `FOE_XP` (first value), `FOE_NATIVE_LEVEL`, `FOE_SOUNDS`, `DEATH`:

| Kind | Name | Native | XP | Defence | Special (C4) | Step |
| --- | --- | --- | --- | --- | --- | --- |
| `wolf` | Wolf | 6 | 80 | — | 10 AP, plain bite | 08 |
| `worg_rider` | Worg Rider | 7 | 100 | res 1 | `worg_strikes` | 08 |
| `ogre` | Ogre | 7 | 140 | res 2 | `ogre_sweep` | 08 |

**C4. The new abilities** — in `ABILITIES`, ids in `ABILITY_IDS` after `fire_spit` and before `power_attack`, in this order (the later rings' ids follow these); numbers not given are the engineer's first values:

- `worg_strikes` "Spear and Bite": routine, strikes Spear then Bite.
- `ogre_sweep` "Sweep": area `{ shape: 'burst', centredOnSelf: true, range: 0, radius: 1, foesOnly: true, throughResistance: true, damage, halfOnMiss: false }`, recharge ≥ 1.

Each area gets an `ABILITY_SOUNDS` and `ABILITY_LOOKS` entry reusing today's cues and looks.

**C5. The new encounters** — ids in `ENCOUNTERS` (after `freebooter_host`, in this order), `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`; slots lead first (`fromThreat` where noted); counts from `band.min` up; spawn kind appended to `SPAWN_KINDS` with `fromThreat: 7`; trophy and favoured rune as listed:

| Id | Band | Slots, in order | Counts | Spawn name | Favoured | Step |
| --- | --- | --- | --- | --- | --- | --- |
| `wolf_pack` | 6–9 | wolf ×5 (Pack Leader first) | 3, 4, 4, 5 | Wolf Pack | — | 08 |
| `worg_riders` | 7–9 | worg_rider, wolf, worg_rider, wolf | 3, 3, 4 | Worg Band | — | 08 |
| `ogre_camp` | 7–10 | ogre, worg_rider, ogre, wolf | 2, 3, 3, 4 | Ogre Camp | — | 08 |

`TROPHIES` (decision 14) grows with the kinds. Counts and slot order are the ring step's tuning levers (decision 4).

**C6. The nests** — each listed location keeps its position and loot and takes the new id, name and encounter (`farMonsters` in `newWorld`, `src/game/worldMap.ts`); the rest are unchanged.

| Ring | Old id → new id, name, encounter | Kept bandits | Step |
| --- | --- | --- | --- |
| 7 | `webwood_nest` → `greyfang_pack` Greyfang Pack `wolf_pack`; `hollow_spiders` → `hollow_riders` Hollow Riders `worg_riders`; `ashen_pool` → `ashen_ogres` Ashen Hill Ogres `ogre_camp` | `wildland_bandits`, `moorland_bandits` | 08 |

**C9. The cells** — `--encounter E --threat T --party-level T --player-kit expected`, 500 battles from seed 1, report only, read against decision 4 (300–475). This step's codes (`bands.md`'s cell codes and measure names, lower case): `wp6`, `wp9`, `wr7`, `wr9`, `oc7`, `oc10`.

### Shared constraints (from the index, unchanged)

- **Ring by ring.** Each ring step (08 to 13) leaves a playable game: its kinds, sprites (merged before it), encounters, nests, spawn kinds, trophies and favoured runes in; tests, the guard and the 50-campaign check green; its cells measured. Bandit placeholders of later rings stay until their ring lands.
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

- **The policy snapshot:** decision 16.
- **The early-game figure.** Stage 10 ended at `one` 288 (331 days, 1.2 dead), `company` 289, `rl10` 409 (533 days), with `--near-source`; `one`, `company` and the days are accepted until stage 12 (`bands.md`). Step 01 re-measures them; step 14 measures again. A move of more than about 5 points is explained in the commit and in `src/game/CLAUDE.md`'s scaling line, or brought to the orchestrator.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG for an existing encounter. New spawn kinds are appended (`.claude/skills/yomi-add-content/encounter.md`). The immunity draws nothing. Favoured runes draw from the loot stream, as today.
- **Import cycles.** `encounters.ts` imports `bandits.ts`; `loot.ts` imports `encounters.ts` and `worldMap.ts`; `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts` import one another (`src/game/CLAUDE.md`): nothing at module load. `src/combat/` imports nothing from `src/game/` or `scripts/`.
- **Content checklists** (`.claude/skills/yomi-add-content/`): `foe.md` (each kind: sprite, `MonsterKind`, `FOE_STATS`, `FOE_XP`, `FOE_NATIVE_LEVEL`, `FOE_SOUNDS`, `DEATH`, the yardstick), `ability.md` (`ABILITIES`, `ABILITY_IDS` with the monsters' before the techniques, `ABILITY_SOUNDS`, `ABILITY_LOOKS`), `encounter.md` (`ENCOUNTERS`, `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`, `SPAWN_KINDS`), `status.md` and `battle-event.md` (step 03). Sprites: `.claude/skills/yomi-sprites/` (`art/CLAUDE.md`, `docs/reference/sprites.md`, `docs/designs/sprite-drawing-guidance.md`); never edit an exported PNG; `npm run sprites`, `npm run sprites:check`, then the `yomi-asset-check` agent. Balance: `.claude/skills/yomi-balance/`. Manual: `.claude/skills/yomi-manual/`.
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on `long-campaign-stage-11`, without pushing; files staged by path. A sprite step runs in its own worktree and commits on its own branch, merged by the orchestrator before its ring step. Messages "Stage 11 step NN: <title>". No attribution lines.
- **Docs.** Each step fixes the CLAUDE.md lines its change makes wrong and searches the CLAUDE.md files, `.claude/` and `docs/reference/` for every name it renames or removes (`SOURCE_FOE_LEVEL`, `STAND_IN_GOODS`, renamed nest ids). `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB: **`src/game/CLAUDE.md` is at 7,654 bytes**; move detail to `docs/reference/game.md` before adding a line. Each ring step adds its cells to `bands.md`'s cell codes and measure names (report only) and "Now"; step 15 writes the rest and the manual.

## 3. Dependencies and prerequisites

- **Step 02 done:** `--player-kit expected` and `expectedGear` (C1), `KITTED_FIGHTER_GROWTH` and `foeYardstick(level, kit)` (C2), and the `STAGE_11_KINDS` list in `src/game/encounters.test.ts` (empty until this step). If C1 or C2 is missing or differs, stop and report; do not invent a yardstick.
- **Step 04 merged:** `art/units/wolf.sprite.toml`, `worg_rider.sprite.toml`, `ogre.sprite.toml` and the rebuilt atlas in `public/assets/sprites/`. `src/scenes/unitLook.test.ts` fails for a kind with no sprite, so this step cannot commit without them. Check `git log -- art/units/wolf.sprite.toml` before starting.
- **Step 03 is not needed** (no ring-7 kind is immune); if it is done, `LOG_SCHEMA_VERSION` is 27 already, which this step leaves alone.
- **Step 01's 50-campaign hash** in `log.md` (unchanged by steps 02 and 03, which record "identical").
- **Existing code at `1a008af`** (inspected):
  - `src/game/encounters.ts`: `MonsterKind`, `FOE_STATS`, `FOE_NATIVE_LEVEL`, `FOE_XP`, `TROPHIES` (empty, with a doc comment naming stage 11), `FoeSlot`, `EncounterDef`, `encounter()`, `ENCOUNTERS`, `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`, `encountersFor`.
  - `src/combat/combat.ts`: the stat blocks (`TROLL_STATS`, `SALAMANDER_STATS`, …), `foeAtLevel`, `foeYardstick`.
  - `src/combat/abilities.ts`: `Strike`, `AreaAttack` (fields `centredOnSelf`, `foesOnly`, `throughResistance`, `halfOnMiss`), `ABILITY_IDS` (monsters' four first: `troll_claws`, `spider_bite`, `spider_web`, `fire_spit`), `ABILITIES`; `consecrate` and `taunt` are today's self-centred areas to copy.
  - `src/game/blight.ts`: `SPAWN_KINDS` (seven entries; the outer kinds take `fromThreat: 7`); `spawn` picks `eligible[floor(rng() * eligible.length)]`.
  - `src/game/worldMap.ts`: `newWorld`'s locations; ring 7's five under "Threat 7 (55 to 67 hexes out)": `wildland_bandits` (55, 6) bandit_camp, `webwood_nest` (62, 20) spider_nest [SHADOW_CLOAK], `ashen_pool` (70, 36) salamander_pool [SPARK_WAND], `moorland_bandits` (62, 52) bandit_camp, `hollow_spiders` (55, 67) spider_nest [HAWK_BOW].
  - `src/game/loot.ts`: `trophiesFor`, `takeTrophies` (wired into `BattleScene.ts` and `scripts/simulate.ts`'s `fightAt`, whose comment says "None drop this stage (decision 8): `TROPHIES` is empty until stage 11").
  - `src/game/save.ts`: `SAVE_VERSION = 31`.
  - `src/scenes/sounds.ts`: `FOE_SOUNDS` (Record over `FoeKind`), `DEATH` (Record over `UnitKind`), `ABILITY_SOUNDS`; `src/scenes/battleEffects.ts`: `ABILITY_LOOKS`.
  - `src/engine/policies.test.ts`: "the choices of today's encounters" iterates `Object.keys(ENCOUNTERS)`.
  - `src/game/encounters.test.ts`: `describe.each(Object.entries(ENCOUNTERS))` builds each encounter across its band; "the foe yardstick" with `EXCEPTIONS`, `meanDamage`, `routineTurn`.

## 4. Scope and guidance

Test-first throughout: write each test red, then the code. Read the three checklists (`foe.md`, `ability.md`, `encounter.md`) and `docs/reference/battle.md`'s sections on abilities and areas before starting.

### 4.1 Abilities (C4)

- `worg_strikes` "Spear and Bite": a routine of two strikes (Spear, then Bite), each with its own dice, like `spider_bite`; `apCost` and `recharge` the engineer's (record them).
- `ogre_sweep` "Sweep": exactly C4's area. Confirm, with an engine test, that today's area code rolls it against **each** adjacent foe once (unit's `toHit` against each armour class), damage through resistance, and touches no ally and not the ogre. If the existing fields cannot give that (for example `centredOnSelf` forbids a radius above 0, or `throughResistance` is refused for a self-centred area), **stop and report** to the orchestrator with what blocks it (decision 11); do not add an `Ability` field.
- Insert both after `fire_spit` in `ABILITY_IDS`. Check that no hero's or existing monster's legal-action order changes (the guard and the snapshot's existing lines prove it).
- `ABILITY_SOUNDS.ogre_sweep` and `ABILITY_LOOKS.ogre_sweep` reusing today's cues and looks (for example a heavy swing cue and a burst look); `worg_strikes` is a routine of its own dice: check `sounds.test.ts`'s rule for routines (it may need nothing, as `troll_claws`). No new cue (decision 20 of the index: a new cue only through `yomi-sound`).

### 4.2 Kinds (C3)

- `WOLF_STATS`, `WORG_RIDER_STATS`, `OGRE_STATS` in `src/combat/combat.ts`, each with a doc comment saying what it is and how it fights (as the existing blocks have). Wolf: 10 action points, a plain bite (no ability), no resistance, no pack bonus. Worg Rider: resistance 1, `abilities: ['worg_strikes']`. Ogre: resistance 2, `abilities: ['ogre_sweep']`, a heavy weapon.
- Write each at its native level against `foeYardstick(native, 'expected')`: armour class, chance to hit, hit points and mean damage a turn inside the bands, or a named exception with a reason. Record the block's numbers and the yardstick's bands in the execution record.
- `encounters.ts`: `MonsterKind` gains the three; `FOE_STATS`, `FOE_NATIVE_LEVEL` (6, 7, 7), `FOE_XP` (80, 100, 140, first values; update the `FOE_XP` doc comment for them).
- `sounds.ts`: `FOE_SOUNDS` (wolf and worg a bite, ogre a heavy crush, from today's cues) and `DEATH` (beast or the closest existing cue; the worg rider's goblin may take `battle.death.goblinoid`).
- `encounters.test.ts`: add the three to `STAGE_11_KINDS`, held to `'expected'` at native level; exceptions named with reasons.

### 4.3 Encounters (C5) and spawn kinds

- Slot lists in `encounters.ts`, each with a comment (as the existing ones have) and a builder with a doc comment: `wolfPack`, `worgRiders`, `ogreCamp`; slots lead first, names of their own (Pack Leader, Grey Wolf, …; Worg Rider Chief, …; Ogre, Ogre Brute, …), positions on the board off `PARTY_START` (copy today's foe positions: [8, 4], [8, 2], [9, 4], [8, 6], [9, 6], [9, 2]).
- Append to `ENCOUNTERS`, `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS` after `freebooter_host`, in C5's order.
- Append to `SPAWN_KINDS` after the existing seven, in C5's order, names "Wolf Pack", "Worg Band", "Ogre Camp", each `fromThreat: 7`. Their bands make them eligible at threat 7 and 9 (and `ogre_camp` 7 and 9 only, as no ring has 10). Update the `blight.test.ts` checks that list spawn kinds if they enumerate them.

### 4.4 Trophies

- `TROPHIES`: `wolf: { material: 'wolfhide', amount: 1 }`, `worg_rider: { material: 'wolfhide', amount: 1 }`. Rewrite its doc comment (the table now fills ring by ring; until ring 9 the stand-in still sells wyvern hide).
- `scripts/simulate.ts` `fightAt`: replace the "None drop this stage (decision 8)" comment with one that is true.

### 4.5 Nests (C6)

- In `newWorld` (`worldMap.ts`), the three ring-7 locations take their new id, name and encounter at the same position with the same loot; the two bandit camps stay. Fix the ring's comment.
- Grep `src/`, `scripts/`, `e2e/`, `docs/reference/`, `docs/manual/`, `.claude/` and the story (`src/story/`) for `webwood_nest`, `hollow_spiders`, `ashen_pool`, "Webwood Nest", "Hollow Spiders", "Ashen Pool" and fix each reference (tests that name them; the manual if it names them).
- `SAVE_VERSION` 31 → 32 in `src/game/save.ts`, with its history comment (ring 7's nests); no migration.

### 4.6 The policy snapshot

Re-record "the choices of today's encounters" in `src/engine/policies.test.ts`. Prove by diff (the snapshot before and after) that every existing line is unchanged and only `wolf_pack`, `worg_riders` and `ogre_camp` lines were added; extend the test's title ("…and in long-campaign stage 11 step 08, when ring 7's wolves, worg riders and ogres came"). If any existing line changed, find why (most likely the `ABILITY_IDS` insertion) and fix it rather than re-record it.

### 4.7 Tests (design §6, per ring)

- The yardstick for each kind (4.2).
- Composition at both band ends: `wolf_pack` at 6 and 9, `worg_riders` at 7 and 9, `ogre_camp` at 7 and 10: the kinds, names and counts fielded, each foe at the threat's level (`foeStats(kind, threat)`); the generic `describe.each(ENCOUNTERS)` tests pass for the three.
- Engine tests (`src/engine/battleEngine.test.ts` or the abilities tests' home): the worg rider's `worg_strikes` makes Spear then Bite at one foe as two attack events with their strike names; the ogre's `ogre_sweep` rolls once against each adjacent foe, touches no ally (a fellow ogre or wolf beside it) and not the ogre, damage through resistance; the wolf has 10 action points at its turn's start.
- Trophies: a won `wolf_pack` (by `takeTrophies` on its `kinds`) adds one wolfhide per wolf to the stock; a won `bandit_camp` adds none.
- The world: `newWorld`'s ring-7 nests are the five of C6 (ids, encounters, positions, loot, threat 7); `nearSourceWorld` (`scripts/simulate.ts`) still drops them.
- Spawn kinds: at threat 7 and 9 the eligible kinds include the three new ones after the existing seven; at threats 1 to 5 the eligible list is unchanged.

### 4.8 Cells and tuning

Through `yomi-measure` (`.claude/agents/yomi-measure.md`; if the spawn is refused, a `general-purpose` agent briefed with its body), one run at a time, label `s11-08`, logs under `logs/s11-08-*`: `wp6`, `wp9`, `wr7`, `wr9`, `oc7`, `oc10` (C9's flags). Read each against 300–475 wins of 500.

If a cell is outside: tune **only** that encounter's counts and slot order, and the three new kinds' blocks (kept within the kitted yardstick or a named exception), one lever per trial, **at most three trials an encounter**, each trial re-running that encounter's two cells. Never tune shared constants (`FOE_*_PER_LEVEL`, `banditGear`, loot, XP). Keep the best trial; if a cell is still outside, **stop and report** to the orchestrator with every trial's figures and options. A change to a block re-runs the yardstick test and every cell its kind appears in.

### 4.9 The guard and the 50-campaign check

Run `npm test` (the refactor guard unedited and green) and the 50-campaign check: it must equal step 01's hash. If it moves, find the cause; if the cause is only far spawns' kinds (threat 7 or more) reaching the early campaign, **stop and report** to the orchestrator (decision 15); otherwise fix the cause.

### 4.10 Record and docs

- `log.md`: a "Step 08: ring 7" heading, date and code SHA; each cell (code, flags, wins of 500, against 300–475, run time, log path); every tuning trial; the 50-campaign hash.
- `.claude/skills/yomi-balance/bands.md`: the six cell codes in "Cell codes" (report only) and the measure names; their figures under "Also" (report only). `.claude/skills/yomi-balance/running.md` if it lists measure names.
- `docs/reference/game.md`: the three encounters (bands, slots, counts), the ring-7 nests, the spawn kinds, the trophies; `docs/reference/battle.md`: the two abilities if it lists monster abilities. `src/game/CLAUDE.md` and `src/combat/CLAUDE.md` only where a line becomes wrong (mind the 8 KB cap: `src/game/CLAUDE.md` is near it).
- The manual is step 15's, but fix any line this step makes false (a nest's name).

### 4.11 Exclusions

No other ring's kinds or nests; no wolf pack bonus; no new `Ability` or `CombatantStats` field; no change to an existing encounter, kind, spawn kind or band; no favoured rune (none for ring 7, decision 6 of the index); no change to the user's bands; no scene code beyond the sound and look tables.

## 5. Verification

- `npm test` passes: the new yardstick, composition, engine, trophy, world and spawn tests; `unitLook.test.ts` and `sounds.test.ts` for the three kinds; the policy snapshot with lines added only; the refactor guard unedited.
- `npm run build` passes.
- The 50-campaign check identical to step 01's hash.
- Each of the six cells measured once through `yomi-measure` (plus any trials), within 300–475 or brought to the orchestrator and answered.
- `git diff` shows the policy snapshot's existing lines unchanged.

## 6. Completion criteria

- [ ] `wolf`, `worg_rider`, `ogre` (C3) with blocks, XP, native levels, sounds and deaths; held to the kitted yardstick or named exceptions.
- [ ] `worg_strikes` and `ogre_sweep` (C4) built from existing fields, with engine tests; sounds and looks.
- [ ] `wolf_pack`, `worg_riders`, `ogre_camp` (C5) with bands, slots, counts and spawn kinds appended; composition tested at both band ends.
- [ ] Ring 7's nests as C6; old ids fixed everywhere; `SAVE_VERSION` 32.
- [ ] `TROPHIES` holds wolf and worg_rider wolfhide 1; the simulator's comment fixed.
- [ ] Policy snapshot re-recorded with only the new lines; title extended.
- [ ] Cells recorded in `log.md` and `bands.md`; tuning trials logged; any cell outside 300–475 brought to the orchestrator.
- [ ] Guard green and unedited; 50-campaign hash identical to step 01's.
- [ ] Docs fixed; one commit "Stage 11 step 08: ring 7", files staged by path, no attribution lines; the index's row 08 updated with status and commit.

## 7. Execution record
