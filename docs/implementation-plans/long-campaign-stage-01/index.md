# Implementation plan: long campaign, stage 1 (foe foundations and bandits)

This stage lays the foundation for foes beyond threat 5 and checks it in play with bandits:
- every foe kind gets a native level;
- every encounter gets a band of threats and its own foe counts;
- a foe yardstick test;
- bandits built by hero rules, in a Bandit Camp encounter at threats 3 to 5 on today's map;
- a debug `fight` command;
- the simulator's `--ready-level` flag and level record.

**Source design:** [`docs/designs/long-campaign/stage-01-foe-foundations-and-bandits.md`](../../designs/long-campaign/stage-01-foe-foundations-and-bandits.md). Its reference is [`docs/designs/long-campaign/reference/campaign-to-level-20.md`](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.2, §5.3, §5.5 and §5.7, and the stages overview is [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md). The plan was written against repo commit `9c740ae` on branch `armor-resistance`.

## Corrections to the design

The plan follows the design except where the design contradicts itself or the code. These are the only departures.

1. **The Bandit Hideout is at threat 4, not 5.** Goblin Outriders at (47, 13) measures threat 4 (`threatAt`). The design's "(threat 5)" was a stale assumption. The location keeps its place and its threat.
2. **The Bandit Camp's composition.** The design's §2 gives counts [3, 3, 4] at threats 3, 4 and 5 with "Captain, Brute, Archer, then Cutthroat, with the Hedge-Mage from threat 4". With those counts the mage never takes the field at threat 4, and §4 and the play script count four bandits at threat 3. The plan uses this slot order:
   1. Captain;
   2. Hedge-Mage (`fromThreat: 4`);
   3. Brute;
   4. Archer;
   5. Cutthroat.

   The counts are `[3, 3, 4, 4, 4]` over the band 3–7. A threat-3 camp then fields the Captain, Brute and Archer. Threat 4 fields the Captain, Hedge-Mage and Brute. Threat 5 fields the Captain, Hedge-Mage, Brute and Archer. The Cutthroat, fifth in the slot order, takes the field only once a later stage raises a count to 5 (stage 9); the counts top out at 4. (Corrected at the second overall review: this once said the Cutthroat enters from threat 6.) Step 07 may retune the counts on today's map from the simulator, and records what it measures.

   **Retuned at step 07:** the counts are `[2, 2, 2, 4, 4]` (C6 below as amended). Three bandits were a wall at threats 3 and 4 (39% and 32% for a party of the threat's level) and four at 5 (0.6%); two win 89%, 95% and 87%. The camp now fields the Captain and Brute at threat 3, and the Captain and Hedge-Mage at threats 4 and 5; the Archer from threat 6; the Cutthroat, fifth in the slot order, takes the field only once a later stage raises a count to 5 (stage 9).

   **Reordered after the stage (2026-10-30, the user's follow-up):** the slot order is Captain, Archer (`fromThreat: 5`), Hedge-Mage (`fromThreat: 4`), Brute, Cutthroat, counts unchanged, so the camp fields the Captain and Brute at threat 3, the Captain and Hedge-Mage at 4, the Captain and Archer at 5, and the Captain, Archer, Hedge-Mage and Brute at 6 and 7. See C6 and the execution notes.
3. **Today's encounters keep the band 1–5.** The design says today's five encounters keep their counts "cut to their bands", but gives no bands for them in this stage. The plan gives each of them `{ min: 1, max: 5 }` with counts `[2, 3, 3, 3, 4]`, today's `FOES_AT_THREAT`, so every battle that exists today is unchanged. Narrower bands for them belong to stage 9.
4. **The yardstick is checked at native level only.** The design asks for the test "applied to today's kinds at threats 1 to 5". The reference (campaign A11) checks a kind at its native level. Today's kinds are native 1, so the test checks level 1, with exceptions named. Checking every threat would turn the test into a list of exceptions.
5. **The threat table already prints every threat that occurs** (`ThreatRow`, "a threat no campaign reached has no row"), so that part of the design needs no work.

## Scope and shared constraints

- **In:** design S1-R1 to S1-R7 (see the requirement map).
- **Out:** threats past 5 and the bigger map (stage 9); abilities and elements (stage 2); crossbows and higher bandit gear (stages 3 and 10); recruit rules (stage 6).
- **Commands:**
  - `make test` runs the full suite in the podman container (Node 26). This is the gate before every commit.
  - `npm run -s typecheck` and `npx vitest run --project domain` run locally (Node 22) for quick checks of domain code.
  - The simulator runs only in podman: `make -s simulate ARGS="..."`. Local Node 22 cannot run `scripts/simulate.ts`. Its logs go under `logs/` (gitignored). A 500-campaign run takes about a minute.
  - Two `make simulate` commands must never run at the same time: both build the same image, and the loser prints nothing.
- **Test layout:** `src/**/*.test.ts` and `scripts/**/*.test.ts` run in the Node `domain` project. `src/scenes/*Scene.test.ts` run under jsdom with Phaser.
- **The early-game guard.** The campaign figure is 320 of 500 from seed 1 (`make -s simulate ARGS="--campaign --battles 500 --seed 1"`, CLAUDE.md's rules of scaling).
  - **Step 01** must leave the full summary identical.
  - **Step 03** adds the Bandit Camp to `ENCOUNTERS` but places it nowhere, so the campaign is unchanged.
  - **Step 04** changes the map and spawns, so the figure may move. A move of more than about 5 points must be explained in step 07, or retuned away.
- **Versions:**
  - `SAVE_VERSION` (`src/game/save.ts`, now 11) goes to 12 in step 04, because two fixed locations change their encounters.
  - `LOG_SCHEMA_VERSION` (`src/engine/battleEngine.ts`, now 17) is unchanged in this stage.
- **Commits:** one commit per step once `make test` passes, on the current branch, without pushing. Messages end with the repo's `Co-Authored-By` attribution line.
- **Subagents:** CLAUDE.md's guidance on models applies. Sprite drawing in step 02 may be delegated.
- **Docs:** CLAUDE.md must stay current (its "Keeping this file current" section). Step 07 makes the stage's documentation pass. Earlier steps update the CLAUDE.md lines their own change makes wrong.

## Contracts

Every task file copies these unchanged. "Existing" means in the code at `9c740ae`. "New" means produced by the step named.

### C1. Unit kinds (`src/game/encounters.ts`)

```ts
/** Monsters: stat blocks scaled by foeAtLevel from their native level. */            // step 01 (new type; same members as today's foes)
export type MonsterKind = 'goblin' | 'kobold' | 'shaman' | 'horror' | 'hobgoblin' | 'troll' | 'armored_troll'
/** Humanoids built by hero rules (bandits.ts). */                                   // step 03
export type BanditKind = 'bandit_cutthroat' | 'bandit_archer' | 'bandit_brute' | 'bandit_mage' | 'bandit_captain'
export type FoeKind = MonsterKind | BanditKind                                         // step 01 declares FoeKind = MonsterKind; step 03 widens it
export type UnitKind = 'warrior' | FoeKind                                              // existing name, redefined
```

`FOE_XP: Record<UnitKind, number>` (existing) gains `100` for each bandit kind in step 03.

### C2. Native levels and scaling

```ts
// src/combat/combat.ts (existing function, new parameter) — step 01
export function foeAtLevel(base: CombatantStats, level: number, native = 1): CombatantStats
```

- `level` below `native` is treated as `native`. Let `above = level - native`.
- `ac`, `toHit`, the damage bonus and a caster's `maxMana` and `skill` grow by today's steps × `above`: `FOE_AC_PER_LEVEL` and `FOE_TO_HIT_PER_LEVEL` are 5, the damage bonus grows by `floor(above / FOE_DAMAGE_LEVEL_STEP)`, and `FOE_MANA_PER_LEVEL` is 3.
- `maxHp = Math.round(base.maxHp * (1 + FOE_HP_PER_LEVEL * (level - 1)) / (1 + FOE_HP_PER_LEVEL * (native - 1)))`.
- With `native = 1` every number equals today's exactly.
- Resistance and regeneration are unchanged, as today.

```ts
// src/game/encounters.ts — step 01
export const FOE_NATIVE_LEVEL: Record<MonsterKind, number>   // every MonsterKind: 1
/** A foe of `kind` at `level`: a monster by foeAtLevel from its native level; a bandit by banditStats (step 03). */
export function foeStats(kind: FoeKind, level: number): CombatantStats
```

### C3. Encounter bands and counts (`src/game/encounters.ts`, step 01)

```ts
export interface ThreatBand { min: number; max: number }
export const ENCOUNTER_BANDS: Record<EncounterId, ThreatBand>
/** The encounters whose band holds `threat`, in ENCOUNTERS order. */
export function encountersFor(threat: number): EncounterId[]
/** The highest threat on today's map, and threatAt's cap until stage 9. */
export const MAX_THREAT = 5   // existing export, kept; no longer derived from FOES_AT_THREAT
```

- Each encounter has its slots, its band, and `counts: readonly number[]`, indexed by `threat - band.min`, whose length equals `band.max - band.min + 1`.
- Building an encounter at `threat`:
  - Its level is `clamp(Math.floor(threat), band.min, band.max)`.
  - Its foes are the slots whose `fromThreat` (default 1) ≤ that level, cut to `counts[level - band.min]`.
  - Each foe's stats are `{ ...foeStats(kind, level), name }`.
  - `Encounter.threat` is the level.
- The five existing encounters: band `{ min: 1, max: 5 }`, counts `[2, 3, 3, 3, 4]`. The private `FOES_AT_THREAT` goes.
- `ENCOUNTERS[id](party, threat?)` keeps its signature.

### C4. The yardstick (`src/combat/combat.ts`, step 01)

```ts
export interface FoeYardstick {
  ac: readonly [number, number]
  toHit: readonly [number, number]
  maxHp: readonly [number, number]
  /** Mean damage a turn: attacks a turn (floor(actionPoints / attackApCost), at least 1) × the mean of its damage roll. */
  meanDamage: readonly [number, number]
}
export function foeYardstick(level: number): FoeYardstick
```

Built from the ready-made fighter's measured growth (campaign §3), interpolated linearly between levels 1, 5, 10, 15 and 20, and clamped outside them:

| Level | Hero hit | Fighter HP | Fighter mean damage |
| --- | --- | --- | --- |
| 1 | 60 | 32 | 10.5 |
| 5 | 82 | 58 | 10.5 |
| 10 | 104 | 83 | 12.5 |
| 15 | 114 | 108 | 12.5 |
| 20 | 124 | 133 | 13.5 |

The bands are:
- `ac` = [hero hit − 55, hero hit − 35];
- `toHit` = [80, 100];
- `maxHp` = [3 × mean damage, 6 × mean damage];
- `meanDamage` = [fighter HP / 10, fighter HP / 6].

The test checks every `MonsterKind` at its native level. Each field outside its band must appear in a named exception map in the test, `{ kind, field, reason }`.

### C5. Bandits (`src/game/bandits.ts`, new in step 03)

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

  **Amended at step 03 (`8c76d91`):** the Wand of Sparks is an enchanted item, which takes no grade (`itemById` refuses one), so the mage's wand stays plain at every grade. All other gear is graded as above.
- **Determinism:** the same arguments give equal stats every time.
- **The hero-rules contract (S1-A3):** a `Character` made by `draftCharacter(draft)`, levelled the same way, `autoAdvance`d and equipped with the same items, has `deriveCombatStats` equal to `banditStats`.

Wiring in `encounters.ts` (step 03): `foeStats(kind, level)` for a `BanditKind` is `banditStats(BANDIT_ROLE[kind], level, banditGrade(level))`.

### C6. The Bandit Camp (`src/game/encounters.ts`, step 03)

```ts
export function banditCamp(party: readonly Fighter[], threat = 3): Encounter
// ENCOUNTERS gains bandit_camp: banditCamp  →  EncounterId includes 'bandit_camp'
```

- Band `{ min: 3, max: 7 }`, counts `[3, 3, 4, 4, 4]`. **Amended at step 07:** counts `[2, 2, 2, 4, 4]`, tuned in the simulator (see correction 2).
- **Amended 2026-10-30 (follow-up after the stage):** the slot order is Captain, Archer (`fromThreat: 5`), Hedge-Mage, Brute, Cutthroat, so that the Archer takes the field at threat 5 in the Hedge-Mage's place. The table below keeps its ids, kinds, names and positions; only the order and the Archer's `fromThreat` change. The threat-5 cell went from 434 to 470 of 500, the guard from 237 to 238.
- The slots, in order (ids are unit ids; positions are `[col, row]` on the 12 × 9 board, off the party's hexes):

  | Id | Kind | Name | Position | From threat |
  | --- | --- | --- | --- | --- |
  | `captain` | `bandit_captain` | Bandit Captain | (8, 4) | — |
  | `archer` | `bandit_archer` | Bandit Archer | (9, 6) | 5 (amended 2026-10-30; was second to last, from threat 1) |
  | `mage` | `bandit_mage` | Hedge-Mage | (9, 4) | 4 |
  | `brute` | `bandit_brute` | Bandit Brute | (8, 2) | — |
  | `cutthroat` | `bandit_cutthroat` | Cutthroat | (8, 6) | — |

### C7. The map and spawns (step 04)

- **Two locations change** in `src/game/worldMap.ts` `newWorld` (existing), keeping their positions and loot:

  | Was | Becomes | Position | Encounter | Threat |
  | --- | --- | --- | --- | --- |
  | `kobold_skulkers` 'Kobold Skulkers' | `bandit_camp` 'Bandit Camp' | (30, 22) | `bandit_camp` | 3 |
  | `goblin_outriders` 'Goblin Outriders' | `bandit_hideout` 'Bandit Hideout' | (47, 13) | `bandit_camp` | 4 |

- **Spawns.** `src/game/blight.ts` `SPAWN_KINDS` (existing) gains `{ encounter: 'bandit_camp', name: 'Bandit Gang' }`. `spawn` draws the kind from those whose `ENCOUNTER_BANDS[encounter]` holds `threatAt(at)`. The draw is `eligible[Math.floor(rng() * eligible.length)]`, with every other RNG draw in the same order as today.
- **Versions:** `SAVE_VERSION` goes 11 → 12.

### C8. The debug `fight` command (step 05)

```ts
// src/scenes/debugCommands.ts — DebugSource (existing interface) gains:
/** Starts a battle of `encounter` at `threat` against the party, as if a location were attacked; absent where battles can't start. */
fight?: (encounter: EncounterId, threat: number) => void
```

- The `fight <encounter> [threat]` command is `changes: true`, so it runs on the world map only. Its usage line is `fight <encounter> [threat]`.
- It validates the encounter against `ENCOUNTERS` and the threat as an integer ≥ 1. The threat defaults to `threatAt(world.party)`.
- It calls `source.fight`, and refuses with a message when `fight` is absent.
- **WorldScene** provides `fight` by starting `'Battle'` with `{ game, encounter, threat }`.
- **BattleScene's** init data gains `encounter?: EncounterId` and `threat?: number`. These are used only when no `location` is given: the encounter is `ENCOUNTERS[location?.encounter ?? data.encounter ?? DEFAULT_ENCOUNTER]` at `location?.threat ?? data.threat`.
- **Such a battle:**
  - rewards experience as any win does;
  - takes no loot and clears no location;
  - leaves the blight untouched;
  - is never saved mid-battle (already the case for a battle without a location).

### C9. The simulator (`scripts/simulate.ts`, step 06)

- **`CliArgs`** gains `readyLevel: number`, a positive integer that defaults to `SOURCE_READY_LEVEL` (existing, 7). It is parsed from `--ready-level`, and is refused without `--campaign`, with a message naming the flag.
- **`nextTarget(world, party, readyLevel = SOURCE_READY_LEVEL)`**: the Source is chosen once every member has `readyLevel`, or nothing else is left.
- **`CampaignRecord`** gains:

  ```ts
  /** Each member's level when the campaign ended. */
  finalLevels: number[]
  /** The level of each hero who died, in the order they fell. */
  deathsAtLevel: number[]
  /** For 5, 10, 15 and 20: how many battles had been fought when the party's lowest level first reached it; absent if never. */
  battlesToLevel: Partial<Record<5 | 10 | 15 | 20, number>>
  ```

- **`CampaignSummary`** and the printed summary gain:
  - the average lowest and highest final level;
  - the levels heroes died at, with counts;
  - for each of 5, 10, 15 and 20, the average battles to reach it and how many campaigns did.

## Tasks

| Step | Task | Outcome | Depends on | Status |
| --- | --- | --- | --- | --- |
| 01 | [Native levels, encounter bands and the yardstick](01-native-levels-and-bands.md) | `foeAtLevel` with native levels, `foeStats`, bands and counts per encounter, `encountersFor`, `foeYardstick` and its test. The campaign summary is identical. | — | done |
| 02 | [Bandit sprites](02-bandit-sprites.md) | Five bandit sprites in the atlas, with `idle` and `walk`, and the sprites README updated | — | done |
| 03 | [Bandits and the Bandit Camp](03-bandits-and-camp.md) | `bandits.ts`, the bandit kinds, XP, the `bandit_camp` encounter. Bandits drawn in battle. | 01, 02 | done |
| 04 | [Bandits on the map](04-map-and-spawns.md) | Two locations become bandit camps; spawns by band with a Bandit Gang; `SAVE_VERSION` 12 | 03 | done (7ff2fb9; guard 91 of 500, see the task's note) |
| 05 | [The debug `fight` command](05-debug-fight.md) | `fight <encounter> [threat]` starts a battle with no location | 01 | done (see the task's note) |
| 06 | [The simulator's ready level and level record](06-simulator-ready-level.md) | `--ready-level`, `finalLevels`, `deathsAtLevel`, `battlesToLevel`, printed | — | done (5481925; guard identical but for the new lines, see the task's note) |
| 07 | [Measure, tune and document](07-measure-tune-document.md) | The guard and the bandit cells measured, counts tuned if needed, CLAUDE.md, the manual and the stage's notes updated, the play script walked | 03, 04, 05, 06 | done (c4ce6f8; counts tuned to [2, 2, 2, 4, 4]; guard 237 of 500, outside the 5 points and explained; play script left for the user; see the task's note) |

## Execution order

1. **01, 02 and 06** are independent. 02 touches only `art/` and `public/assets/sprites/`, and 06 only `scripts/simulate.ts` and its test. They may run in parallel. Commit 01 first if they run together, because 06's checks are cleaner on a tree where 01 is already proven identical.
2. **03** after 01 and 02. `unitLook.test.ts` requires an atlas sprite for every key of `FOE_XP`, so the sprites must exist before the bandit kinds join `FOE_XP`.
3. **04 and 05**, after 03 and 01 respectively. They touch different files (`worldMap.ts` and `blight.ts`, against `debugCommands.ts`, `WorldScene.ts` and `BattleScene.ts`) and can run in parallel.
4. **07** last.

**Checkpoints:**
- After 01, an identical campaign summary.
- After 03, the campaign is still identical: the camp is not on the map.
- After 04, the guard is measured. 07 judges it.

## Requirement map

| Design requirement | Steps |
| --- | --- |
| S1-R1 native levels | 01 |
| S1-R2 bands, clamping, spawns and placement by band | 01 (bands, clamping), 04 (spawns, placement) |
| S1-R3 bandits by hero rules | 03 |
| S1-R4 Bandit Camp, two locations, spawn kind | 03 (encounter), 04 (locations, spawn) |
| S1-R5 the yardstick and its test | 01 |
| S1-R6 `--ready-level` and record fields | 06 |
| S1-R7 the debug `fight` command | 05 |
| Sprites (design §2) | 02 |
| Docs and the play script (design §6, "Done when") | 07 |

## Overall completion criteria

- [x] Every step is done, with `make test` passing at each commit.
- [x] The campaign summary is identical after step 01, and the guard is measured after step 04 and judged in 07 (237 of 500 after tuning, 83 below 320: explained in CLAUDE.md and the stage notes, not retuned away; 238 with the Archer at threat 5). **Accepted by the user** after the stage, at that level: "a real player can just choose to grind more".
- [x] Cells `--encounter bandit_camp --threat T --party-level T` for T = 3, 4 and 5 are recorded. A party of the threat's level wins most but not all (88.8%, 94.6%, 86.8%; with the Archer at threat 5, 94%).
- [x] CLAUDE.md describes native levels, bands, bandits, the `fight` command and `--ready-level`, and the manual mentions bandits.
- [x] The stage design gets an "Implementation notes" section with the figures. The stages index marks stage 1 done.
- [x] The design's play script has been walked in the game (`make dev`), or the steps not walked are listed for the user in step 07's record (not walked; listed).

## Execution notes

- **Overall review** of steps 01 to 07 (`bf7b802..24d1a82`): clean. Four doc fixes made in one commit, "Overall review: correct the stage's remaining docs": the `banditCamp` comment for the tuned counts; "foe", not "monster", in `encounter`'s comment; the stage design's status line, its commit list (step 07's review commits) and play-script item 2 (the threat-5 mage's Fireball and Heal All); and this note. Checks run by the reviewer: `make test` 754 passed; the production build OK; the sprites check OK; browser tests `debug` 3/3, `battle` 9/9 and `saves` 6/6 when run alone (three timeouts seen only when they ran together under load).
- **Second overall review:** clean but for one doc error: the Cutthroat never takes the field at any threat, as the camp's counts top out at 4 (threats 6 and 7; higher threats clamp to 7) and it is fifth in the slot order, while several docs said it appears from threat 6. Corrected in the `banditCamp` comment, CLAUDE.md's rules of scaling, the stage's implementation notes, correction 2 above and step 03's task file: the Archer from threat 6; the Cutthroat only once a later stage raises a count to 5 (stage 9).

- **Follow-ups after the stage (2026-10-30, the user's decisions):**
  - **The guard is accepted** at its level, 237 of 500 (238 after the next item), against 320 before the stage. The user's reason: "a real player can just choose to grind more." Recorded in CLAUDE.md's rules of scaling, the stage design's status line and notes, and the stages index.
  - **The Archer at threat 5.** The slot order became Captain, Archer (`fromThreat: 5`), Hedge-Mage (`fromThreat: 4`), Brute, Cutthroat, counts unchanged (C6 amended). Tests first: `encounters.test.ts` pins the field at threats 3 to 7, the Archer's stats at 5 and the XP at threats 3 to 6 (the field test failed on threat 5 before the change). Measured from seed 1 in podman: the threat-5 cell `--encounter bandit_camp --threat 5 --party-level 5 --battles 500` 470 of 500 (94%, 8.4 rounds; was 434), most but not all, so not retuned; the guard `--campaign --ready-level 7 --battles 500` 238 of 500 (was 237), the fixed camp 446 of 500, the Hideout 260 of 261, Bandit Gangs 377 of 377, 817 of 819 and 346 of 346 at threats 3, 4 and 5. Threats 3 and 4 field what they did. CLAUDE.md, the stage notes (cells, follow-up, play-script step 2) and the manual's bandit paragraph were updated.
  - **The manual** was checked against the code and corrected (roster button names, skill-cost thresholds, the melee hero's starting shield, the blight's growth and its cap, the nameplate's flanking bonus, the Attack and Cast buttons, the reserves' cap, the encampment's own yield, perk attribute minimums, the P and K keys, mana on the Character tab), and all 30 screenshots retaken with `npm run manual:screenshots` in the podman image, plus a new one, `battle-bandits.png` (`fight bandit_camp 5` from the debug console: the Captain and the Archer). Each image was looked at against its caption. In a commit of its own.

## Open questions

None block the plan. The corrections above are recorded in place of questions.

## For implementers

After working on a step, update its row's status here (`in progress`, `done` or `blocked`) and add a short completion note under the step's own file: the commit, the checks run and their results, and anything left for a later step. If a step is blocked, say on what.
