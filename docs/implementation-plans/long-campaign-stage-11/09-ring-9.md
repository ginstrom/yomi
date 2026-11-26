# Step 09: Ring 9: wyverns

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-11-high-roster.md) (§2 Scope, §5 Technical notes, §6 Verification, §7 Risks) · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.5 (the roster), §5.2 (the yardstick), §5.3 (native levels and bands) · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.3 (trophies), §4.5 (rune loot) · [Stages index](../../designs/long-campaign/index.md) · [Step 08](08-ring-7.md) (the model ring step) · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) authors the wyvern's native block against the kitted yardstick, builds its routine from existing fields, re-records the policy snapshot proving it narrow, removes Elder Glade's stand-in across code, tests and docs, and tunes the roost's counts against its cells. The reviewer (opus) checks the block against the yardstick, the snapshot diff (only `wyvern_roost` lines added), the guard and the 50-campaign hash, the stand-in's removal everywhere, and that no shared constant was tuned.

## 1. Objective

Land ring 9 as a playable increment:
- the **Wyvern** kind (native 9), its routine `wyvern_strikes` (Bite, then a Tail Sting that poisons), its sprite (step 05, merged);
- the **Wyvern Roost** encounter (band 9–12), its spawn kind, its favoured rune (venom), the wyvern's trophy (wyvern hide 3);
- ring 9's nests: two Wyvern Roosts and an Ogre Camp (step 08's `ogre_camp`) in place of the salamander and spider placeholders; the two Bandit Companies stay;
- **Elder Glade's wyvern-hide stand-in removed** (`STAND_IN_GOODS`), now that wyverns drop wyvern hide;
- `SAVE_VERSION` 32 → 33; the policy snapshot re-recorded narrow; the cells `wy9`, `wy12` measured with `--player-kit expected`.

## 2. Requirements and context

- **S11-R1:** each kind's block, abilities, wards, `FOE_XP`, `FOE_NATIVE_LEVEL`, trophy and sprite (campaign R7, A11).
- **S11-R2:** each encounter with its band, counts, fixed nests and spawn kind (campaign R5).
- **S11-R5:** trophies from kills (gear R7). Elder Glade's stand-in from stage 10 is removed.
- **Design §2:** the wyvern's flight stays deferred: a plain block (it does not move over units). Rune loot favours a nest's element (gear §4.5). Each ring's nests replace bandit-filled placeholders; bandits keep about a third of each ring. `SPAWN_KINDS` gains the new encounters, by band.
- **Design §5:** blocks in `combat.ts`; encounters, kinds, XP and native levels in `encounters.ts`; nests in `worldMap.ts`; trophies in `encounters.ts`. `SAVE_VERSION` bumped for each ring landed that changes fixed locations.
- **Design §6, per ring:** tests: the kind's yardstick test; the encounter's composition at its band's ends; the new ability's behaviour on the kind (one engine test per kind with something special). Simulator: `--encounter X --threat T --party-level T --player-kit expected` at both ends of each band; a party of the threat's level wins most but not all.
- **Design §7:** land ring by ring; keep the bandit placeholders until each ring's tuning holds.
- **Campaign §5.5:** Wyvern, native 9, flyer (moves over units), res 2, routine Bite, Tail sting (poison).
- **Gear §4.3:** Wyvern hide, from wyverns, 3.

### Contracts (copied unchanged from the index)

**C1. Expected kit for single battles (step 02)** (consumed: the cells run with it)

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

**C2. The kitted yardstick (step 02)** (consumed: the wyvern is held to `'expected'`)

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

**C3. The new kinds** (this step's row; produced):

| Kind | Name | Native | XP | Defence | Special (C4) | Step |
| --- | --- | --- | --- | --- | --- | --- |
| `wyvern` | Wyvern | 9 | 150 | res 2 | `wyvern_strikes` | 09 |

Each a `MonsterKind`, `UnitKind` id = sprite id, block `<NAME>_STATS` in `src/combat/combat.ts` (here `WYVERN_STATS`), `FOE_STATS`, `FOE_XP` (first value), `FOE_NATIVE_LEVEL`, `FOE_SOUNDS`, `DEATH`.

**C4. The new abilities** (this step's entry; produced). In `ABILITIES`, ids in `ABILITY_IDS` after `fire_spit` and before `power_attack`, in the index's order (after step 08's `worg_strikes`, `ogre_sweep`); numbers not given are the engineer's first values:

- `wyvern_strikes` "Bite and Sting": routine, Bite then Tail Sting laying `poisoned`.

Each area gets an `ABILITY_SOUNDS` and `ABILITY_LOOKS` entry reusing today's cues and looks. (`wyvern_strikes` is a routine of strikes, not an area: it needs a place in `SOUNDS_AS_ATTACKS` or an `ABILITY_SOUNDS` entry as `src/scenes/sounds.test.ts` demands; `ability.md` says which.)

**C5. The new encounters** (this step's row; produced). Ids in `ENCOUNTERS` (after `freebooter_host`, in the index's order: after step 08's three), `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`; slots lead first; counts from `band.min` up; spawn kind appended to `SPAWN_KINDS` with `fromThreat: 7`; trophy and favoured rune as listed:

| Id | Band | Slots, in order | Counts | Spawn name | Favoured | Step |
| --- | --- | --- | --- | --- | --- | --- |
| `wyvern_roost` | 9–12 | wyvern ×3 | 2, 2, 3, 3 | Wyvern Roost | venom | 09 |

`TROPHIES` (decision 14) grows with the kinds. Counts and slot order are the ring step's tuning levers (decision 4). Slot names are the engineer's (for example Wyvern, Wyvern Mate, Young Wyvern).

**C6. The nests** (this step's row; produced). Each listed location keeps its position and loot and takes the new id, name and encounter (`farMonsters` in `newWorld`, `src/game/worldMap.ts`); the rest are unchanged.

| Ring | Old id → new id, name, encounter | Kept bandits | Step |
| --- | --- | --- | --- |
| 9 | `cinder_springs` → `cinder_roost` Cinder Roost `wyvern_roost`; `deepweb_hollow` → `deepcrag_roost` Deepcrag Roost `wyvern_roost`; `smoking_mere` → `mere_ogres` Mere Ogres `ogre_camp` | `ironhold_company`, `grey_company` | 09 |

`ogre_camp` (band 7–10, slots ogre, worg_rider, ogre, wolf) exists from step 08; this step only places a nest of it at threat 9.

**C9. The cells** (this step's codes; produced). `--encounter E --threat T --party-level T --player-kit expected`, 500 battles from seed 1, report only, read against decision 4 (300–475). This step: `wy9` (`wyvern_roost` 9, L9), `wy12` (`wyvern_roost` 12, L12).

### Decisions from the index (unchanged)

1. **Encounter compositions and first counts** *(for the user, Q1)*: the design names each encounter's band but not its foes or counts. Default: C5's table (lead kind first, minions from the same or nearer rings), first values that the ring's step tunes against its cells.
2. **Each ring's nests** *(for the user, Q2)*: nests keep their positions and unique loot, and change encounter, id and name; each ring keeps its nest count; bandits keep about a third (2 of 5 in rings 7 to 15, 1 of 4 in ring 18). Spiders and salamanders leave the fixed nests of rings 7 and 9 (they still spawn there). Table: C6.
4. **The cells' reading of "most but not all"** *(for the user, Q4)*: per-ring cells are report-only (the user's bands are not extended); the plan's working reading is **300 to 475 wins of 500** at both band ends, with `--player-kit expected`, a party of the threat's level. A ring step tunes only its own encounters toward it, at most three trials an encounter, then reports. C9.
5. **The yardstick for the new kinds** *(for the user, Q5)*: stage 12's measurement is not ready, so the new kinds are held to a **kitted** fighter growth table measured once in step 02 from `expectedKit` (the "stage 10 `expectedKit` readings" of the design); today's kinds stay on today's bare table, unchanged. C2.
6. **Favoured runes of the new nests** *(for the user, Q6)*: in `FAVOURED_RUNES` (it exists, `loot.ts`): `wyvern_roost` venom, `basilisk_lair` rime, `blight_cult` and `blight_lich_court` storm, `young_dragon` and `elder_wyrm` ember; none for the rest and none for the Source (its encounter id is also the near-home Source's).
11. **Sweep and Rock use existing ability fields** (no engine addition beyond the immunity, design §2): Sweep is an area centred on the ogre, radius 1, foes only, through resistance; Rock is a burst of radius 0 at range 4, through resistance. **`throughResistance` means cut by resistance, as a blow: give the kind `armorPierce`, or omit the flag to ignore resistance** (found in step 08; without it only the element's ward cuts an area; breaths keep no flag). If either cannot be built from today's fields, the ring step stops and reports. The wolf's pack bonus, the wyvern's flight and the wight's half damage from non-magic weapons stay out (plain blocks).
14. **Trophies** (gear §4.3) land with their kinds: wolf and worg_rider wolfhide 1 (ring 7), wyvern wyvern_hide 3 (ring 9), basilisk basilisk_scale 3 (ring 12), young_dragon drake_scale 6 (ring 15), elder_wyrm drake_scale 10 (ring 18). **Elder Glade's stand-in** (`STAND_IN_GOODS`) is removed in ring 9's step, when wyverns drop wyvern hide.
15. **The refactor guard and the 50-campaign check stay identical through every step**: `--near-source` drops every fixed nest above threat 5, the near-home Source is unchanged (decision 3), and new `SPAWN_KINDS` are appended with `fromThreat: 7`. If a step moves either, it finds the cause; if the cause is only far spawns' kinds reaching the early campaign, it stops and brings it to the orchestrator (a re-record then needs approval and goes in that step). No step is planned to re-record the guard.
16. **The policy snapshot** (`src/engine/policies.test.ts`) iterates over every encounter, so **each ring step re-records it**, proving only its new encounters' lines were added (every earlier line unchanged), and step 13 re-records it with only `source_guardians` lines above threat 5 changed. Each says so in the test's title.
17. **Versions:** `SAVE_VERSION` 31 → 32, 33, 34, 35, 36 in the ring steps 08 to 12 (each changes fixed locations; no migration, older saves read as unreadable); step 13 changes no fixed location (no bump). `LOG_SCHEMA_VERSION` 26 → 27 in step 03 only.
18. **First values for each kind** (XP, natives, defences, specials): C3 and C4. The ring step authors each block against the kitted yardstick; numbers not given there (dice, AP, armour class, hit points) are the engineer's, recorded.

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

- **The early-game figure.** Stage 10 ended at `one` 288 (331 days, 1.2 dead), `company` 289, `rl10` 409 (533 days), with `--near-source`; `one`, `company` and the days are accepted until stage 12 (`bands.md`). Step 01 re-measures them; step 14 measures again. A move of more than about 5 points is explained in the commit and in `src/game/CLAUDE.md`'s scaling line, or brought to the orchestrator.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG for an existing encounter. New spawn kinds are appended (`.claude/skills/yomi-add-content/encounter.md`). The immunity draws nothing. Favoured runes draw from the loot stream, as today.
- **Import cycles.** `encounters.ts` imports `bandits.ts`; `loot.ts` imports `encounters.ts` and `worldMap.ts`; `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts` import one another (`src/game/CLAUDE.md`): nothing at module load. `src/combat/` imports nothing from `src/game/` or `scripts/`.
- **Content checklists** (`.claude/skills/yomi-add-content/`): `foe.md` (each kind: sprite, `MonsterKind`, `FOE_STATS`, `FOE_XP`, `FOE_NATIVE_LEVEL`, `FOE_SOUNDS`, `DEATH`, the yardstick), `ability.md` (`ABILITIES`, `ABILITY_IDS` with the monsters' before the techniques, `ABILITY_SOUNDS`, `ABILITY_LOOKS`), `encounter.md` (`ENCOUNTERS`, `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`, `SPAWN_KINDS`). Balance: `.claude/skills/yomi-balance/`. Manual: `.claude/skills/yomi-manual/`.
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on `long-campaign-stage-11`, without pushing; files staged by path. Messages "Stage 11 step NN: <title>". No attribution lines.
- **Docs.** Each step fixes the CLAUDE.md lines its change makes wrong and searches the CLAUDE.md files, `.claude/` and `docs/reference/` for every name it renames or removes (`SOURCE_FOE_LEVEL`, `STAND_IN_GOODS`, renamed nest ids). `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB: **`src/game/CLAUDE.md` is at 7,654 bytes**; move detail to `docs/reference/game.md` before adding a line. Each ring step adds its cells to `bands.md`'s cell codes and measure names (report only) and "Now"; step 15 writes the rest and the manual.

## 3. Dependencies and prerequisites

- **Step 08 done** (ring 7). It produces, and this step relies on: `wolf`, `worg_rider`, `ogre` kinds; `worg_strikes`, `ogre_sweep` in `ABILITY_IDS` after `fire_spit`; `wolf_pack`, `worg_riders`, `ogre_camp` in `ENCOUNTERS` after `freebooter_host` and appended to `SPAWN_KINDS`; ring 7's nests; wolfhide trophies; `SAVE_VERSION` 32; the policy snapshot re-recorded once; the cells `wp6`…`oc10` in `bands.md`; `STAGE_11_KINDS` in `src/game/encounters.test.ts`. Read step 08's execution record for its choices (block shapes, how the snapshot's title names the re-record, what tuning it kept) and follow them.
- **Step 02 done** (C1, C2: `--player-kit expected`, `KITTED_FIGHTER_GROWTH`, `foeYardstick(level, 'expected')`). If `--player-kit` or `foeYardstick`'s second argument is missing, stop and report.
- **Step 05 merged** (sprites `wyvern`, plus `barrow_wight`, `basilisk`, `hill_giant` for step 10): `art/units/wyvern.sprite.toml` and its frames in `public/assets/sprites/atlas.json`. Without it `src/scenes/unitLook.test.ts` fails for the new kind: stop and ask the orchestrator to merge step 05.
- **Existing (at `1a008af`, before 08):**
  - `src/game/loot.ts`: `FAVOURED_RUNES: Partial<Record<EncounterId, RuneId>>` (today `salamander_pool: 'ember'`, `spider_nest: 'venom'`), `FAVOURED_CHANCE` 0.5; `takeTrophies(game, kinds, table = TROPHIES)`, wired in `BattleScene` (victory) and `scripts/simulate.ts` (`fightAt`, comment "None drop this stage (decision 8)": update it).
  - `src/game/encounters.ts`: `TROPHIES: Partial<Record<FoeKind, Trophy>>` (empty before step 08; its doc comment names the stage 11 entries).
  - `src/game/tradingPost.ts` line ~299: `export const STAND_IN_GOODS: Readonly<Record<string, readonly Material[]>> = { elder_glade: ['wyvern_hide'] }` and `goodsForSale` (`for (const material of [p.good, ...(STAND_IN_GOODS[p.id] ?? [])])`).
  - `src/game/worldMap.ts` `newWorld`: ring 9 (comment "Threat 9 (68 to 80)"): `ironhold_company` (67, 4) bandit_company, `cinder_springs` (74, 18) salamander_pool [EMBERBLADE], `deepweb_hollow` (83, 36) spider_nest [SAGE_CIRCLET], `grey_company` (74, 54) bandit_company, `smoking_mere` (66, 69) salamander_pool [RING_FORTUNE].
  - `src/game/blight.ts` `SPAWN_KINDS` (append only); `src/game/save.ts` `SAVE_VERSION` (32 after step 08).
  - `src/combat/abilities.ts`: `Strike` has `status?: StatusLaid` (laid on a hit that leaves the target standing), as `spider_bite`'s Venom Bite lays `{ id: 'poisoned', turns: 3 }`.

## 4. Scope and guidance

Work test-first: each new test fails before the change that makes it pass.

### 4.1 The kind

1. `WYVERN_STATS` in `src/combat/combat.ts`, with a doc comment (its role, why its numbers): native 9, `resistance: 2`, `abilities: ['wyvern_strikes']`, weapon named (for example Fangs). No flight (decision 11): a plain block that moves as any unit.
2. `wyvern_strikes` in `ABILITIES` and `ABILITY_IDS` (after step 08's `ogre_sweep`, before `power_attack`): name "Bite and Sting", a routine of two strikes, Bite then Tail Sting with `status: { id: 'poisoned', turns: N }`; dice, AP and recharge are first values.
3. `encounters.ts`: `wyvern` in `MonsterKind`, `FOE_STATS`, `FOE_XP` 150, `FOE_NATIVE_LEVEL` 9; `TROPHIES.wyvern = { material: 'wyvern_hide', amount: 3 }` (update `TROPHIES`'s doc comment).
4. `src/scenes/sounds.ts`: `FOE_SOUNDS.wyvern` (reuse, for example the spider's bite), `DEATH.wyvern`, and the ability's sound placement as `sounds.test.ts` requires. `src/scenes/battleEffects.ts`: a `STRIKE_FLASHES` or look entry only if the checklist asks (optional for a plain routine). Any new cue only through the `yomi-sound` skill (decision 20 of the index: reuse today's cues).
5. Yardstick: add `wyvern` to `STAGE_11_KINDS` in `src/game/encounters.test.ts`; it is held to `foeYardstick(9, 'expected')`; each field outside is a named exception with a reason (record why).

### 4.2 The encounter, spawn kind, rune

1. `WYVERN_ROOST` (`EncounterDef`): band 9–12, three wyvern slots (lead first; the board's foe hexes as the other encounters use, off `PARTY_START`), counts `[2, 2, 3, 3]`; `wyvernRoost(party, threat = 9)` with a doc comment; `wyvern_roost` in `ENCOUNTERS` (after step 08's entries), `ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`.
2. `SPAWN_KINDS`: append `{ encounter: 'wyvern_roost', name: 'Wyvern Roost', fromThreat: 7 }` after step 08's entries.
3. `FAVOURED_RUNES.wyvern_roost = 'venom'` (decision 6).

### 4.3 The nests

In `newWorld` (`src/game/worldMap.ts`), C6's ring-9 row: `cinder_springs` → `cinder_roost` "Cinder Roost" `wyvern_roost` (keeps (74, 18) and [EMBERBLADE]); `deepweb_hollow` → `deepcrag_roost` "Deepcrag Roost" `wyvern_roost` ((83, 36), [SAGE_CIRCLET]); `smoking_mere` → `mere_ogres` "Mere Ogres" `ogre_camp` ((66, 69), [RING_FORTUNE]). `ironhold_company` and `grey_company` unchanged. Grep `src/`, `scripts/`, `e2e/`, `docs/` and `.claude/` for the three old ids and names and fix every reference (tests in `worldMap.test.ts`, `saveSlots.test.ts`, `trade.test.ts` and any story or manual line). `SAVE_VERSION` 32 → 33 in `src/game/save.ts` (its doc comment: ring 9's nests), no migration.

### 4.4 Elder Glade's stand-in removed (decision 14)

- `src/game/tradingPost.ts`: delete `STAND_IN_GOODS` and its use; `goodsForSale` lists, from `GOODS_LEVEL`, each contacted partner that is not silent, in `PARTNERS` order, its own good only. Elder Glade still sells its own good (elderwood). Update the doc comments that mention the stand-in.
- Tests: `src/game/tradingPost.test.ts` ("list nothing … else each good in partner order with the stand-in" loses `elder_glade:wyvern_hide`; "sell Stonehollow's mithril … and the wyvern hide stand-in" becomes a test that wyvern hide is not offered and `buyGoodRefusal` refuses it with "no partner offers it"'s words). Grep `STAND_IN_GOODS`, `stand-in`, `wyvern_hide`, "wyvern hide" across `src/`, `scripts/`, `e2e/` (the `TradingPostScene` probe and its tests, `e2e/manual.shots.ts`), and fix those about the stand-in; leave trophy and debug `stock` uses alone.
- Docs: `docs/reference/game.md` (the goods paragraph, line ~195, and the Trophies paragraph, line ~246: trophies now come from kills: wolves and worgs from ring 7, wyverns from ring 9; basilisk and drake scale still to come), `docs/manual/README.md` line ~661 if it names wyvern hide among goods (a sentence fix; step 15 retakes screenshots), `docs/reference/scenes.md` if it names the stand-in.

### 4.5 Tests (design §6, per ring)

- The yardstick (4.1.5).
- The roost's composition at its band's ends: at threat 9, two wyverns at level 9; at 12, three at level 12 (`foeStats('wyvern', 12)` each, names distinct); below 9 as 9, above 12 as 12.
- **One engine test** (`src/engine/battleEngine.test.ts` or the abilities test, as step 08 did): a wyvern's `wyvern_strikes` on a hero with a scripted RNG emits two `AttackEvent`s with `ability: 'wyvern_strikes'` and the strikes' names, and the Tail Sting that hits and leaves the hero standing lays Poisoned; a miss lays nothing.
- Trophies: `trophiesFor(['wyvern', 'wyvern', 'warrior'])` gives `{ wyvern_hide: 6 }`; a won roost adds wyvern hide to the stock (`takeTrophies`).
- `rollRunes` for `wyvern_roost` favours venom (the existing favoured test pattern in `loot.test.ts`).
- The nests: the three new ids at their positions with their encounters and loot; ring 9 holds two `bandit_company` nests.
- The stand-in tests of 4.4.

### 4.6 The policy snapshot (decision 16)

Re-record `src/engine/policies.test.ts`'s "the choices of today's encounters" snapshot. Prove in the record that **only `wyvern_roost` lines were added** and every earlier line is unchanged (a diff of the snapshot before and after, lines removed: none). Extend the test's title with "and in long-campaign stage 11 step 09, when the Wyvern Roost came", as earlier re-recordings do.

### 4.7 Cells and tuning (decision 4)

Through `yomi-measure`, one at a time, label `s11-09`, logs `logs/s11-09-*`: `wy9` (`--encounter wyvern_roost --threat 9 --party-level 9 --player-kit expected`, 500, seed 1) and `wy12` (threat 12, level 12). Read wins of 500 against 300–475.

- Outside it: tune only `wyvern_roost`'s counts and slot order and `WYVERN_STATS` (kept within the yardstick or a named exception), **at most three trials** (each trial both cells), keeping the best; still outside: put the code at its best trial and **stop and report** to the orchestrator with each trial's figures and options. Never tune a shared constant (`FOE_*_PER_LEVEL`, `foeAtLevel`, `banditGear`, loot, `FOE_XP` of another kind, `ogre_camp`).
- Also run `oc10` once more only if the Mere Ogres change anything about `ogre_camp` (they do not: report "unchanged, step 08's figure").
- Record every run (cell, flags, wins, trials) in `log.md` under "Step 09".

### 4.8 Guard, 50-campaign check, bands

- `npm test` with the refactor guard unedited and green.
- The 50-campaign check (the index's command) identical to step 01's hash. If it moves: find the cause; if it is only far spawns' kinds (the new `wyvern_roost` spawns at threats 9 and 12) reaching the early campaign, stop and bring it to the orchestrator (decision 15); otherwise fix it.
- `.claude/skills/yomi-balance/bands.md`: `WY9`, `WY12` in the cell codes (`wyvern_roost` 9, 12, L9, L12, `--player-kit expected`, report only) and `wy9`, `wy12` in the measure names; their figures in "Now"'s "Also" line. `.claude/skills/yomi-balance/running.md` if it lists cells by code.
- `npm run build` passes.

### 4.9 Exclusions

No flight; no other ring's kinds or nests; no change to `ogre_camp`'s data, any existing encounter, `SPAWN_KINDS`'s existing entries or their order, the near-home Source, the guard fixture; no band change; no new sound cue outside `yomi-sound`.

## 5. Verification

- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes (the new tests red first, recorded); `npx vitest run src/game/encounters.test.ts src/game/loot.test.ts src/game/tradingPost.test.ts src/game/worldMap.test.ts src/engine/policies.test.ts` for the touched files.
- `npm run build` passes. If a scene file changed (the trading post's probe or text), `npm run test:browser -- -t <the trading post's test>` passes.
- Snapshot diff: only added `wyvern_roost` lines.
- 50-campaign SHA-256 equal to step 01's (`log.md`).
- `wy9`, `wy12` within 300–475, or the stop-and-report with three trials.
- `git grep STAND_IN_GOODS` and `git grep -n "cinder_springs\|deepweb_hollow\|smoking_mere"` empty outside `docs/implementation-plans/` and design history.

## 6. Completion criteria

- [ ] `wyvern` kind, block, `wyvern_strikes`, XP 150, native 9, sounds, trophy (wyvern hide 3), yardstick (`'expected'`) with named exceptions.
- [ ] `wyvern_roost` (9–12, counts as tuned), spawn kind appended (`fromThreat: 7`), favoured venom.
- [ ] Ring 9's nests per C6; references to the old ids fixed; `SAVE_VERSION` 33.
- [ ] `STAND_IN_GOODS` removed; goods are each partner's own; tests and docs fixed.
- [ ] Tests of §4.5 pass; the engine test shows the sting poisoning.
- [ ] Policy snapshot re-recorded, only `wyvern_roost` lines added, title extended.
- [ ] Refactor guard green and unedited; 50-campaign hash identical to step 01's.
- [ ] `wy9`, `wy12` recorded in `log.md` and `bands.md`; within 300–475 or brought to the orchestrator and answered.
- [ ] CLAUDE.md lines made wrong fixed (`src/game/CLAUDE.md` under 8 KB); `docs/reference/game.md` updated.
- [ ] One commit, "Stage 11 step 09: ring 9", files staged by path, no attribution lines; the index's row 09 updated with status and commit.

## 7. Execution record

2026-11-27, engineer (model unset). **Stopped at the cells' checkpoint: `wy9` is 498 after three trials** (decision 4). Figures, trials and proofs: [`log.md`](log.md), "Step 09". Commits: `d901faf` (index trimmed), then the step's code at trial 3 (green; see the index row).

**Built** (all of §4 but the settled tuning, `bands.md` and the final gates)

- `WYVERN_STATS` (native 9, 150 XP, resistance 2, `wyvern_strikes`; at trial 3: 56 hit points, armour class 50, 100 to hit, pierce 11, 10 AP, bite 2d6+2 at 6 AP), in `STAGE_11_KINDS`, inside the kitted yardstick, no exception. `wyvern_strikes` "Bite and Sting" (6 AP, recharge 0, Bite then Tail Sting 1d4 laying Poisoned 3 turns), in `ABILITY_IDS` and `MONSTER_ABILITY_IDS` after `ogre_sweep`; sounds as its attacks (`SOUNDS_AS_ATTACKS`). No engine change, no flight.
- `wyvern_roost` 9–12 after `ogre_camp`; spawn kind Wyvern Roost appended (`fromThreat: 7`); `FAVOURED_RUNES.wyvern_roost` venom; `TROPHIES.wyvern` wyvern hide 3.
- Nests per C6 (`cinder_roost`, `deepcrag_roost`, `mere_ogres`; same hexes and loot); `SAVE_VERSION` 33.
- `STAND_IN_GOODS` removed; `goodsForSale` lists each partner's own good; tests, `docs/reference/game.md` and the manual's sentence fixed.
- Sounds: `FOE_SOUNDS.wyvern` the bite, `DEATH.wyvern` the salamander's cue, `STEP` heavy. No new cue.
- Tests: `highRoster.test.ts` (the routine's two named attacks, the Sting's poison on a hit, none on a miss or on a felled foe, no flight), `encounters.test.ts`, `loot.test.ts`, `tradingPost.test.ts`, `worldMap.test.ts`, `blight.test.ts`, `save.test.ts`, `abilities.test.ts`, `sounds.test.ts`. Seen red against the old code (22 failures), then green.

**Departures**

1. Counts 3, 3, 3, 3 (C5: 2, 2, 3, 3), by trial 1. C5's row in the index is not yet changed: the roost is not settled.
2. `armorPierce` (7, then 11) and 10 action points, numbers C3 does not name.
3. Three far-world pins re-pinned as step 08 did, with the diff (log).
4. Not done, waiting on the decision: `bands.md`'s `WY9`/`WY12` rows and "Now"; the browser run and `sprites:check` on the final tree; the completion boxes.

**Verification so far** (trial 3's tree): `npm test` runlog #81, 2852 passed; `npm run build` #82, exit 0; 50-campaign hash identical; guard unedited and green. Run #80 (first values) had one failure, this step's own placeholder in the snapshot assertion.

**Options for the orchestrator** (the cells: `wy9` 498, `wy12` 399 now)

- A. Keep trial 3 and accept `wy9` at 498 (the user's call; the reading is the plan's, not a band).
- B. Keep trial 1's stronger block and accept `wy12` at 175.
- C. Let the roost differ by threat so 9 is harder than 12 in numbers with trial 3's block: four wyverns at 9 and 10, three at 11 and 12 (a fourth slot; counts fall as the threat rises, and a fourth foe may be a cliff). One more trial.
- D. A lesser third foe at 11 and 12 with the stronger block (a nearer ring's kind by `fromThreat`, which changes C5's "wyvern ×3"). One or two more trials.
- E. Read the cell at the band's top with the kit a level-12 party would more likely hold (the plan's kit is the row's low end at both 9 and 12): a change to decision 10, not to the roost.

Recommended: C tried once, else A.
