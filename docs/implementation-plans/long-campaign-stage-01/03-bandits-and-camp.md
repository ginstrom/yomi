# Step 03: Bandits and the Bandit Camp

- **Plan:** [index.md](index.md)
- **Source design:** [stage 1, foe foundations and bandits](../../designs/long-campaign/stage-01-foe-foundations-and-bandits.md). Reference: [campaign-to-level-20.md §5.5](../../designs/long-campaign/reference/campaign-to-level-20.md).

## Objective

Bring in the first humanoid foes. Bandits are built by the same rules as heroes: a draft, levels, skill points and perks spent by `autoAdvance`, and gear. Their stats come from `deriveCombatStats`.

A new `bandit_camp` encounter fields them at threats 3 to 7. It is registered in `ENCOUNTERS`, so the simulator's `--encounter` flag and step 05's debug `fight` command can reach it. It is **not** placed on the map in this step; step 04 places it.

When this step is done, a battle started with `ENCOUNTERS.bandit_camp(party, 4)` (in tests, or in `BattleScene` once step 05 lands) fields a Captain, a Hedge-Mage and a Brute, drawn with their own sprites.

## Requirements and context

From the design:

- **S1-R3:** bandits are built from hero rules. A bandit at level L equals a hero of the same draft and gear at level L (design acceptance S1-A3).
- **S1-R4 (encounter part):** the Bandit Camp encounter, band 3–7. Every bandit role is worth `FOE_XP` 100, an even foe, so a win pays 100 × level per bandit.
- **Gear on today's items only:** grade 1 below threat 5, Fine (grade 2) from threat 5. The crossbowman waits for stage 3.
- **Bandits fight by the same policy as every other foe.** No engine or policy change is needed: they are only `CombatantStats`.

**The plan's correction 2 applies** (see the index). The slot order is Captain, Hedge-Mage (from threat 4), Brute, Archer, Cutthroat, and the counts are `[3, 3, 4, 4, 4]`. So:

| Threat | Field |
| --- | --- |
| 3 | Captain, Brute, Archer |
| 4 | Captain, Hedge-Mage, Brute |
| 5 | Captain, Hedge-Mage, Brute, Archer |

The Cutthroat enters from threat 6, which this stage never reaches on the map. Step 07 may retune the counts from the simulator; this step uses these first values.

### Contracts (copied from the index, unchanged)

**C1. Unit kinds (`src/game/encounters.ts`)**

```ts
/** Monsters: stat blocks scaled by foeAtLevel from their native level. */            // step 01 (new type; same members as today's foes)
export type MonsterKind = 'goblin' | 'kobold' | 'shaman' | 'horror' | 'hobgoblin' | 'troll' | 'armored_troll'
/** Humanoids built by hero rules (bandits.ts). */                                   // step 03
export type BanditKind = 'bandit_cutthroat' | 'bandit_archer' | 'bandit_brute' | 'bandit_mage' | 'bandit_captain'
export type FoeKind = MonsterKind | BanditKind                                         // step 01 declares FoeKind = MonsterKind; step 03 widens it
export type UnitKind = 'warrior' | FoeKind                                              // existing name, redefined
```

`FOE_XP: Record<UnitKind, number>` (existing) gains `100` for each bandit kind in step 03.

**C2. `foeStats` (part)**

```ts
// src/game/encounters.ts — step 01
export const FOE_NATIVE_LEVEL: Record<MonsterKind, number>   // every MonsterKind: 1
/** A foe of `kind` at `level`: a monster by foeAtLevel from its native level; a bandit by banditStats (step 03). */
export function foeStats(kind: FoeKind, level: number): CombatantStats
```

**C3. Encounter building (part)**

- Each encounter has its slots, its band, and `counts: readonly number[]`, indexed by `threat - band.min`, whose length equals `band.max - band.min + 1`.
- Building an encounter at `threat`:
  - its level is `clamp(Math.floor(threat), band.min, band.max)`;
  - its foes are the slots whose `fromThreat` (default 1) ≤ that level, cut to `counts[level - band.min]`;
  - each foe's stats are `{ ...foeStats(kind, level), name }`;
  - `Encounter.threat` is the level.
- `ENCOUNTERS[id](party, threat?)` keeps its signature.

```ts
export interface ThreatBand { min: number; max: number }
export const ENCOUNTER_BANDS: Record<EncounterId, ThreatBand>
/** The encounters whose band holds `threat`, in ENCOUNTERS order. */
export function encountersFor(threat: number): EncounterId[]
```

**C5. Bandits (`src/game/bandits.ts`, new in step 03)**

```ts
export type BanditRole = 'cutthroat' | 'archer' | 'brute' | 'mage' | 'captain'
export const BANDIT_ROLE: Record<BanditKind, BanditRole>
/** A bandit of `role` at `level`, its gear at `grade`: built by hero rules, then deriveCombatStats. Cached per (role, level, grade). */
export function banditStats(role: BanditRole, level: number, grade: Grade): CombatantStats
/** The gear grade bandits wear at a threat: 1 below threat 5, 2 (Fine) from 5. */
export function banditGrade(threat: number): Grade
```

- **How a bandit is built:** take the role's fixed `CharacterDraft` and make it with `draftCharacter`. Then, until it reaches `level`, `levelUp`. Then `autoAdvance`. Then set its equipment for its role, at `grade` via `gradedItem` (existing, `src/inventory/grades.ts`). The result is `deriveCombatStats`.
- **Gear:**

  | Role | Main hand | Off hand | Armour |
  | --- | --- | --- | --- |
  | cutthroat | `IRON_DAGGER` | — | none |
  | archer | `YEW_BOW` | — | none |
  | brute | `IRON_BATTLE_AXE` | — | `STEEL_ARMOR` |
  | mage | `SPARK_WAND` | — | none |
  | captain | `IRON_SWORD` | `OAK_SHIELD` | `STEEL_ARMOR` |

  The mage's draft is a Spellcasting caster whose spells include Magic Arrow and Shield by level 3, and Flame Arrow by level 4.
- **Determinism:** the same arguments give equal stats every time.
- **The hero-rules contract (S1-A3):** a `Character` made by `draftCharacter(draft)`, levelled the same way, `autoAdvance`d and equipped with the same items, has `deriveCombatStats` equal to `banditStats`.

Wiring in `encounters.ts` (step 03): `foeStats(kind, level)` for a `BanditKind` is `banditStats(BANDIT_ROLE[kind], level, banditGrade(level))`.

**C6. The Bandit Camp (`src/game/encounters.ts`, step 03)**

```ts
export function banditCamp(party: readonly Fighter[], threat = 3): Encounter
// ENCOUNTERS gains bandit_camp: banditCamp  →  EncounterId includes 'bandit_camp'
```

- Band `{ min: 3, max: 7 }`, counts `[3, 3, 4, 4, 4]`.
- The slots, in order (ids are unit ids; positions are `[col, row]` on the 12 × 9 board, off the party's hexes):

  | Id | Kind | Name | Position | From threat |
  | --- | --- | --- | --- | --- |
  | `captain` | `bandit_captain` | Bandit Captain | (8, 4) | — |
  | `mage` | `bandit_mage` | Hedge-Mage | (9, 4) | 4 |
  | `brute` | `bandit_brute` | Bandit Brute | (8, 2) | — |
  | `archer` | `bandit_archer` | Bandit Archer | (9, 6) | — |
  | `cutthroat` | `bandit_cutthroat` | Cutthroat | (8, 6) | — |

## Dependencies and prerequisites

**Step 01 (must be done)** provides, in `src/game/encounters.ts` and `src/combat/combat.ts`:
- `foeAtLevel(base, level, native = 1)`;
- `MonsterKind`, with `FoeKind = MonsterKind` until this step widens it;
- `FOE_NATIVE_LEVEL`;
- `foeStats(kind, level)`, monsters only until this step;
- `ThreatBand`, `ENCOUNTER_BANDS` and `encountersFor`;
- encounter definitions carrying slots, band and counts, built by the C3 rule.

Read step 01's code as committed before starting. This step adds an entry beside the existing five; it does not reshape the encounter builder.

**Step 02 (must be done)** provides atlas sprites named exactly `bandit_cutthroat`, `bandit_archer`, `bandit_brute`, `bandit_mage` and `bandit_captain`, each with `idle_0` and the `idle` and `walk` animations, in `public/assets/sprites/atlas.json` and `atlas.anims.json`. [`src/scenes/unitLook.test.ts`](../../../src/scenes/unitLook.test.ts) ("has every kind of unit in the atlas") iterates `Object.keys(FOE_XP)`, so adding the bandit kinds to `FOE_XP` fails that test unless step 02 is in.

**No blockers.**

## Scope and implementation guidance

### Inspected code to build on

- **[`src/character/creation.ts`](../../../src/character/creation.ts):**
  - `CharacterDraft` is `{ name, portrait: PortraitId, attributes, tagged: SkillId | null, raises: Record<SkillId, number>, perks: PerkId[] }`.
  - `draftCharacter(draft)` makes a level 1 `Character` with the draft's perks taken, at full HP and mana.
  - It builds on `createCharacter` in [`src/character/character.ts`](../../../src/character/character.ts), which gives **every character a steel breastplate, the `STARTING_KIT` of its tagged skill** (melee: `IRON_SWORD` + `OAK_SHIELD`; archery: `YEW_BOW`; magic: `SPARK_WAND`), **and every other plain weapon in its backpack** (plus the shield if its hands are full).
  - So `banditStats` must set `equipment` explicitly per role:
    - `mainHand` always.
    - `offHand` for the captain only. Delete it otherwise.
    - `armor` set to `STEEL_ARMOR` at grade for the brute and captain, and **deleted** for the cutthroat, archer and mage.

    The backpack does not affect `deriveCombatStats` and may be left as is or emptied.
- **[`src/game/party.ts`](../../../src/game/party.ts) `PREROLLS`:** Aldric (melee), Brenna (archer), Delwyn (mage) and Garrick are working models of valid drafts: attributes, tag, `raises` of 10 in the tagged skill, and perks that qualify. Base each role's draft on the closest pre-roll.
  - captain and brute: Aldric-like, melee;
  - archer: Brenna-like;
  - cutthroat: melee with high agility;
  - mage: Delwyn-like.

  Each draft has a fixed name ("Bandit Captain" and so on; the encounter renames the unit anyway) and any existing `PortraitId`, since a bandit's portrait is never shown.
- **The mage's spells.** The spell perks are in [`src/character/perks.ts`](../../../src/character/perks.ts):
  - `spellcasting` (2 spell picks), then `magic_arrow` and `shield` (tier 1, need Spellcasting);
  - `flame_arrow` (tier 2, needs `magic_arrow`).

  Delwyn's draft spends Spellcasting's picks on `magic_arrow` and `heal`. The bandit mage's draft takes `spellcasting`, `magic_arrow` and `shield`. Check what [`src/character/progression.ts`](../../../src/character/progression.ts) `levelUp` and `autoAdvance` do with later spell picks: `autoAdvance` never takes Spellcasting itself, but may spend spell picks.
  - If `autoAdvance` does not reach Flame Arrow by level 4, spend that pick in `banditStats` before `autoAdvance` (with `takePerk`), so the contract holds: Magic Arrow and Shield by level 3, Flame Arrow by level 4.
  - The hero-rules test then mirrors the same sequence.
- **Levelling:** `levelUp(character)` raises one level, with its points and picks left to spend, and `autoAdvance(character)` spends them. Build by `levelUp` up to `level`, then one `autoAdvance` (C5). The simulator's `runBattle` in [`scripts/simulate.ts`](../../../scripts/simulate.ts) levels the same way.
  - `autoAdvance` raises the skill of the weapon in hand first, so **equip before `autoAdvance`** if the role's weapon differs from the draft's starting kit. Otherwise the wrong skill is raised. The cutthroat's dagger and the captain's sword are melee like their kit, but be explicit.
  - Whatever order is chosen, write it down in `bandits.ts` and use the same order in the hero-rules test.

  This refines C5's sequence only in the timing of equipping. The contract's guarantee (equal to a hero built the same way) is unchanged.
- **Grades:** `gradedItem(base, grade)` in [`src/inventory/grades.ts`](../../../src/inventory/grades.ts). Grade 1 returns the base item itself. `Grade` is `1 | 2 | 3`.
- **Items:** `IRON_DAGGER`, `YEW_BOW`, `IRON_BATTLE_AXE`, `SPARK_WAND`, `IRON_SWORD`, `OAK_SHIELD` and `STEEL_ARMOR` are exported from [`src/inventory/inventory.ts`](../../../src/inventory/inventory.ts).
- **Stats:** `deriveCombatStats(character)` in `src/character/character.ts`.

### Changes

1. **New `src/game/bandits.ts`.**
   - `BanditRole`, `BANDIT_ROLE`, `banditStats` and `banditGrade` exactly as C5.
   - The five role drafts and the gear table.
   - A cache `Map` keyed by `${role}:${level}:${grade}` returning the same stats object. Callers spread it, so it is never mutated.
   - `level` below 1 is treated as 1.
   - `banditGrade(threat)` returns `threat >= 5 ? 2 : 1`.
   - Keep the module Phaser-free.
   - **Imports must not cycle.** `encounters.ts` imports `bandits.ts`, so `bandits.ts` imports the `BanditKind` type from `encounters.ts` as a type only (`import type`). Alternatively, `BANDIT_ROLE` may live in `encounters.ts`, but C5 places it in `bandits.ts`; keep it there.
2. **`src/game/encounters.ts`:**
   - Add `BanditKind` and widen `FoeKind` per C1.
   - Add the five `FOE_XP` entries at 100. Extend the `FOE_XP` doc comment with a sentence on bandits as even foes.
   - Extend `foeStats` with the bandit branch per C5's wiring.
   - Add the `BANDIT_CAMP` slots, its band and counts (C6), `banditCamp`, and `bandit_camp` in `ENCOUNTERS`. `ENCOUNTER_BANDS` (from step 01) gains `bandit_camp: { min: 3, max: 7 }`.
   - Doc-comment `banditCamp` in the style of its neighbours.
   - Make sure the slot `kind` type admits `BanditKind`. Step 01's slot type may be `MonsterKind`-only; widen it to `FoeKind`.
3. **Battle drawing.** `BattleScene` draws a unit as the atlas sprite named for its `UnitKind` (`UnitFigure`). Bandits therefore show with step 02's sprites with no scene change. Check that nothing in `src/scenes/` switches on `UnitKind` exhaustively (a `Record<UnitKind, …>` there would need entries). The inspected code had none besides `FOE_XP`.
4. **CLAUDE.md:** fix the lines this step makes wrong.
   - The `encounters.ts` bullet in the Architecture section should mention bandits and `bandits.ts` (bandits are built by hero rules, `foeStats`).
   - The Assets paragraph's sentence on "a new unit kind needs a sprite of that name with both and an experience value in `FOE_XP`" stays true; leave it.

   Do not write the rules-of-scaling account of bandits or the camp's measured figures. Step 07 does that.

### Exclusions

- No map location and no spawn kind (step 04).
- No debug command (step 05).
- No count tuning beyond C6's first values (step 07).
- No new items: no crossbow, and no steel tier (stage 3).
- Do not change the five existing encounters or `LOG_SCHEMA_VERSION`/`SAVE_VERSION`.

## Verification

Tests are written first and seen to fail where they can.

1. **New `src/game/bandits.test.ts`** (domain project):
   - **Hero-rules equality (S1-A3):** for each role, at levels 1, 3 and 5 and grades 1 and 2, `banditStats(role, L, g)` deep-equals `deriveCombatStats` of a character built in the test by the documented sequence: `draftCharacter` with the same draft (export the drafts, or a `banditDraft(role)` helper, for the test), `levelUp` to L, the same equipment at the same grade, and `autoAdvance`, in the order `bandits.ts` uses.
   - **Determinism:** two calls with the same arguments give equal stats.
   - **The mage's spells:** `banditStats('mage', 3, 1).magic?.spells` includes `magic_arrow` and `shield`, and at level 4 also `flame_arrow`.
   - **Gear shows in stats:** the cutthroat and archer have no resistance (no armour); the brute and captain have resistance from the breastplate; the captain's armour class includes the shield. At grade 2, a weapon's damage bonus is 1 higher than at grade 1.
   - **`banditGrade`:** 1 at threats 3 and 4, 2 at 5 and 7.
2. **`src/game/encounters.test.ts`:**
   - `ENCOUNTERS.bandit_camp(party, 3)` fields exactly `captain`, `brute` and `archer`; at 4, `captain`, `mage` and `brute`; at 5, `captain`, `mage`, `brute` and `archer`. Check unit ids, `kinds`, names and positions per C6.
   - A threat below 3 (1, 2.5) clamps to 3, and a threat above 7 (9) clamps to 7, with `Encounter.threat` 3 and 7.
   - Each foe's stats equal `{ ...foeStats(kind, level), name }`, and `foeStats('bandit_captain', 5)` equals `banditStats('captain', 5, 2)`.
   - `xpReward` of a threat-T camp = 100 × T × the number of bandits (900 at threat 3, 1200 at 4, 2000 at 5).
   - `encountersFor(3)` now includes `bandit_camp`, and `encountersFor(2)` does not.
3. **`src/scenes/unitLook.test.ts`** passes unchanged: every `FOE_XP` key, the bandit kinds included, has an atlas sprite with `idle` and `walk`.
4. **Full suite:** `make test` passes. Use `npm run -s typecheck` and `npx vitest run --project domain` locally while working.
5. **Checkpoint: the campaign is unchanged.** The camp is on no map location and in no spawn kind, so
   ```
   make -s simulate ARGS="--campaign --battles 500 --seed 1"
   ```
   must print a summary identical to the one recorded after step 01: 320 of 500 at the time of writing, every line equal. Run it alone; never run two `make simulate` commands at once.
6. **A battle cell, informational:**
   ```
   make -s simulate ARGS="--encounter bandit_camp --threat 3 --party-level 3 --battles 200 --seed 1"
   ```
   Run it, and the same at threats 4 and 5 with party levels 4 and 5. Record the win rates in the completion note. No target is enforced here; step 07 tunes.

## Completion criteria

- [ ] `src/game/bandits.ts` implements C5, and `src/game/encounters.ts` implements C1 (bandit kinds, `FOE_XP` 100), C5's wiring and C6.
- [ ] `bandits.test.ts` and the new `encounters.test.ts` cases pass, `unitLook.test.ts` passes, and `make test` is green.
- [ ] The 500-campaign summary from seed 1 is identical to step 01's.
- [ ] The cells at threats 3, 4 and 5 are recorded in this file's completion note, for step 07.
- [ ] The CLAUDE.md lines made wrong are fixed.
- [ ] One commit on the current branch, not pushed, its message ending with the repo's `Co-Authored-By` attribution line.
- [ ] [index.md](index.md)'s row for step 03 is set to `done`, with a completion note added below: the commit hash, the checks run and their results, and the cell win rates.

## Completion note

- **Status:** done. Commit `8c76d91` ("Step 03: bandits and the Bandit Camp").
- **Built:**
  - `src/game/bandits.ts`: `BanditRole`, `BANDIT_ROLE`, `banditStats` (cached per role, level and grade; a level below 1 counts as 1), `banditGrade`, and `banditDraft(role)` (an extra export, a copy of the role's draft, for the hero-rules test). The build order, written in `banditStats`'s comment and mirrored by the test: `draftCharacter`, then the role's gear in place of the starting kit, then `levelUp` to the level, then one `autoAdvance`, then `deriveCombatStats`.
  - Drafts, each a legal creation (checked with `draftProblems`, the long names aside): Captain (Aldric's attributes; Weapon Training, Toughness, Dodger), Brute (strength 10; Weapon Training, Heavy Hand, Armour Breaker), Archer (Brenna's), Hedge-Mage (Delwyn's attributes; Spellcasting, Arcane Study, Keen Eye, Magic Arrow, Shield), Cutthroat (agility 9; Weapon Training, Dodger, Toughness).
  - The mage's spells come by `autoAdvance` alone: Magic Arrow, Shield, Heal and Flame Arrow at level 3; Heal All at 4; Fireball at 5. No `takePerk` was needed.
  - `src/game/encounters.ts`: `BanditKind`, `FoeKind` widened, `FOE_XP` 100 for each bandit (doc comment extended), `foeStats`'s bandit branch, `BANDIT_CAMP` (band 3–7, counts `[3, 3, 4, 4, 4]`, slots per C6), `banditCamp`, and `bandit_camp` in `ENCOUNTERS`, `ENCOUNTER_BANDS` and `ENCOUNTER_COUNTS`.
  - CLAUDE.md: the `encounters.ts` bullet describes bandits, `bandits.ts` and the camp ("not yet on the map": **step 04 must update that phrase**); the rules of scaling say the monsters' five are band 1 to 5 and the Bandit Camp 3 to 7.
- **Tests:** new `src/game/bandits.test.ts` (hero-rules equality for every role at levels 1, 3, 5 and grades 1, 2; determinism; level below 1; legal drafts; the mage's spells; gear in the stats; grade 2 damage; `banditGrade`; `BANDIT_ROLE`). `src/game/encounters.test.ts`: a `banditCamp` block (registration, fields at 3 to 6, kinds, names, positions and stats, clamping at 1, 2.5 and 9, XP 900/1200/2000). The generic "as the threat rises" tests now walk each encounter's own band rather than 1 to `MAX_THREAT`, and the "today's band 1 to 5" tests cover the five monster encounters only, as the camp's band is 3 to 7; `encountersFor` is checked at 1, 2, 3, 5, 6, 7, 8 and 0.
- **Verification:**
  - `npm run -s typecheck` clean; `npx vitest run --project domain`: 55 files, 725 tests passed.
  - `make test`: 64 files, 734 tests passed (`unitLook.test.ts` unchanged and passing with the bandit kinds in `FOE_XP`).
  - Checkpoint, `make -s simulate ARGS="--campaign --battles 500 --seed 1"`, run on `e6362d5` (changes stashed) and then on this step's tree: the summaries differ only in podman's build lines; every summary line is identical, "Beat the Source: 320 of 500 (64.0%)".
  - Cells, `--encounter bandit_camp --threat T --party-level T --battles 200 --seed 1`:

    | T | Party wins | Avg rounds | Party / bandit damage dealt | Party / bandit hit rate |
    | --- | --- | --- | --- | --- |
    | 3 | 70 of 200 (35%) | 13.1 | 105 / 114 | 57% / 58% |
    | 4 | 61 of 200 (30.5%) | 12.5 | 120 / 135 | 67% / 61% |
    | 5 | 1 of 200 (0.5%) | 8.2 | 109 / 164 | 73% / 71% |

- **For step 07 (and step 04):** the camp is much harder than the plan's target ("a party of the threat's level wins most but not all"): bandits have hero-sized hit points (the Captain 48 at level 3, armour class 31 with shield and breastplate), and at threat 5 Fine gear and a fourth bandit make it nearly unwinnable. Step 04 puts the camp on the map at threats 3 and 4, so the campaign guard will likely fall well over 5 points unless the counts or grades are retuned first. The design names counts and grade as the levers.
- **Deviations:**
  - The Hedge-Mage's Wand of Sparks is not graded: it is an enchanted item, and enchanted items take no grade (`grades.ts`, CLAUDE.md), so a Fine wand is no item of today's game and no hero could hold it. Every other piece of gear is graded as C5 says.
  - The extra `banditDraft(role)` export, which the task file allowed for the test.
  - Generic encounter tests changed from the threats 1 to `MAX_THREAT` to each encounter's own band, as described above; no expectation was weakened for the five monster encounters.
