# Step 09: Bandits in crossbows and steel

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-03-gear-families.md) (§2, "Bandits") · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard", "Versions")

**Difficulty:** routine, following stage 1's bandit steps and stage 2's step 08 (a new kind, a slot, a test). Engineer `model: "sonnet"`, reviewer `model: "sonnet"`.

**Status: done (Q2 (a)).** Do not start until the user has answered Q2 (index, "Open questions"). This file describes option (a) in full and says what changes under the others.

## 1. Objective

Bandits use the stage's new gear. The camp's gear becomes tier 2 (steel, ironwood) from threat 5, and a Crossbowman role takes the field where Q2 places it. Bandits stay built by hero rules: a role's draft made a character, dressed in its role's gear, levelled and spent by `autoAdvance`. A hero built the same way still has the same stats.

## 2. Requirements and context

- **Design §2:** "Stage 1's roles may now use the crossbow (a Crossbowman role) and steel at threat 5."
- **Q2, copied from the index:**

  | # | Question | Options | Recommendation | Blocks |
  | --- | --- | --- | --- | --- |
  | Q2 | **Bandits: "may now use the crossbow (a Crossbowman role) and steel at threat 5."** A new role is a new unit kind, which needs a sprite, an experience value and a slot in the Bandit Camp. Steel at threat 5 strengthens the threat-5 Bandit Gangs that spawn on today's map, so the guard moves. | (a) a Crossbowman kind as a slot from threat 6 (off today's map; checked by cells), and steel (tier 2) from threat 5, measured and retuned in step 10; (b) the Crossbowman in the Archer's place at threat 5, with steel from 5; (c) steel only, no Crossbowman; (d) defer both to stage 9, when the rings beyond threat 5 exist | (a): it builds the role the design names, without reshaping today's threat-5 fight, and steel at 5 follows the design | Steps 08 and 09 |

- **Contract C9, copied from the index:**

  What Q2 decides: whether a Crossbowman role takes the field, and where, and whether bandit gear is steel from threat 5. Whatever the answer, any bandit stays a legal draft whose hero twin has the same stats (the existing test in `bandits.test.ts`). With option (a) of Q2:

  ```ts
  // src/game/bandits.ts
  export type BanditRole = /* existing */ | 'crossbowman'
  /** The tier and grade of bandit gear at a threat: tier 2 from threat 5 (Q2), grade as banditGrade. */
  export function banditGear(threat: number): { tier: Tier; grade: Grade }
  // src/game/encounters.ts
  export type BanditKind = /* existing */ | 'bandit_crossbowman'     // FOE_XP 100; sprite `bandit_crossbowman` (step 08)
  ```

- **The C1 rows the bandits' gear uses** (from the index's family table; tier 1, plain; Q1 values per the index's answer):

  | Family | Name | Slot | Kind | Icon | Damage | AP | Range | Pierce | Other stats | Str | Tier-1 id, name |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | `dagger` | Dagger | mainHand | metal | `dagger` | 1d4 | 3 | | | | | `iron_dagger` Iron Dagger |
  | `longsword` | Longsword | mainHand | metal | `sword` | 1d8+3 | 5 | | 1 | | | **`iron_sword`** Iron Longsword (tier1) |
  | `battle_axe` | Battle Axe | mainHand | metal | `axe` | 1d12+2 | 6 | | 2 | | Q1 (5) | `iron_battle_axe` Iron Battle Axe |
  | `bow` | Bow | mainHand | wood | `bow` | 1d6 | 4 | 5 | | twoHanded | | `yew_bow` Yew Bow |
  | `crossbow` | Crossbow | mainHand | wood | `crossbow` | 1d10 | 6 | 5 | 2 | twoHanded, rangedPierce | | `yew_crossbow` Yew Crossbow |
  | `wand` | Wand | mainHand | wood | `wand` | 1d6 | 5 | 4 | | skill magic | | **`spark_wand`** Wand of Sparks (tier1) |
  | `shield` | Shield | offHand | wood | `shield` | | | | | acBonus 10 | | **`oak_shield`** Oak Shield (tier1) |
  | `breastplate` | Breastplate | armor | metal | `armor` | | | | | acBonus 10, resistance 2; Q1 (spellSkill −5) | Q1 (4) | `iron_breastplate` Iron Breastplate |

  - Tier 2 is `<tier-2 material>_<family>`: `steel_dagger`, `steel_longsword`, `steel_battle_axe`, `ironwood_bow`, `ironwood_crossbow`, `ironwood_wand`, `ironwood_shield`, `steel_breastplate`.
  - `TIER_BONUS` tier 2 adds: weapon damage +2, shield acBonus +2, armour acBonus +2 and resistance +1.
  - Correction 18: the Wand of Sparks is now a plain item. Step 04 already dropped `bandits.ts`'s no-grade special case, so the Hedge-Mage's wand is graded and tiered like any other weapon.
- **Today's bandit facts** (inspected at `866f732`):
  - `banditStats(role, level, grade)` is cached per `${role}:${level}:${grade}` and deeply frozen.
  - `foeStats(kind, level)` in `encounters.ts` calls `banditStats(BANDIT_ROLE[kind], level, banditGrade(level))`, the threat being the level.
  - `banditGrade(threat)` is 1 below threat 5 and 2 from it.
  - `GEAR` maps each role to its items. The Archer's draft is `{ strength 3, perception 9, endurance 5, intelligence 4, agility 7, luck 4 }`, tagged archery, 10 points in archery, perks `marksmanship`, `deadly_aim`, `dodger`.
  - `BANDIT_CAMP_SLOTS` in order:
    - Captain;
    - Archer (`fromThreat: 5`);
    - Hedge-Mage (`fromThreat: 4`);
    - Brute;
    - Cutthroat.
  - The band is 3 to 7, with counts 2, 2, 2, 4, 4. So the fields are:
    - threat 3: Captain, Brute;
    - threat 4: Captain, Hedge-Mage;
    - threat 5: Captain, Archer;
    - threats 6 and 7: Captain, Archer, Hedge-Mage, Brute.
- **Shared constraints (from the index):**
  - `npm test` (local Node 26: `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or `make test`) is the gate before the commit.
  - The simulator is `npm run simulate -- <flags>` (or `make -s simulate ARGS="..."`). Never run two `make simulate` at once. Locally, give concurrent runs distinct `--out` files. Logs stay under `logs/` and are never committed.
  - The guard command is exactly `npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1`.
  - No step adds, drops or reorders an RNG draw in a battle that does not involve the changed bandits.
  - Commit on `long-campaign-stage-03` only, without pushing; never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
  - CLAUDE.md must stay current. This step fixes the lines its own change makes false in the code map's `bandits.ts` and `encounters.ts` entries (the roles, the gear, `banditGrade`). The rules-of-scaling prose on bandits and the manual's bandit paragraph are left to step 10, which this step's record tells what changed.

## 3. Dependencies and prerequisites

- **Q2 answered** (the index's Open questions). Record the answer at the top of the execution record.
- **Step 06** (done): the catalog's items (C1, C2) exist, `itemById` builds tier-2 ids, and the guard after step 06 is recorded in the index. This step's guard is compared with step 06's figure and with step 01's.
- **Step 08** (done, under options (a) and (b)): the atlas holds `bandit_crossbowman` with `idle` and `walk` animations and a `chest` point. Do not add `bandit_crossbowman` to `BanditKind` or `FOE_XP` before it is committed: `unitLook.test.ts` checks that every key of `FOE_XP` is in the atlas.
- **Step 01's record** holds the Bandit Camp cells measured before the stage, which this step compares against.
- **Produces for step 10:** the cells and the guard after this step, and the list of what step 10 must write into CLAUDE.md's rules of scaling and the manual.
- **Parallel work:** step 07 may run at the same time. It touches `src/scenes/` and `e2e/`, and this step touches `src/game/bandits.ts`, `src/game/encounters.ts`, `src/game/save.ts` and their tests. Each edits only its own lines of CLAUDE.md, and the second to commit rebases its CLAUDE.md edit on the first.

## 4. Scope and implementation guidance (option (a))

1. **Gear by tier and grade** (`src/game/bandits.ts`):
   - Add `banditGear(threat): { tier: Tier; grade: Grade }`, with `tier` 2 from threat 5 and 1 below it, and `grade` as `banditGrade` gives (2 from threat 5). Keep `banditGrade` if anything still reads it; otherwise fold it in and update its test.
   - `GEAR` names each role's items by family, and `equipmentFor(role, gear)` builds each item through the catalog. That means the tier's material item from `itemById` (`steel_longsword` for tier 2, the tier-1 id for tier 1), then `gradedItem` / `craftedItem` at the grade. So tier-2 metal is steel and tier-2 wood is ironwood.
   - Roles:
     - Cutthroat: dagger;
     - Archer: bow;
     - Brute: battle axe and breastplate;
     - Hedge-Mage: wand;
     - Captain: longsword, shield and breastplate;
     - Crossbowman: crossbow.
   - `banditStats(role, level, gear)` takes `{ tier, grade }` in place of `grade`, and its cache key includes the tier.
   - `encounters.ts`'s `foeStats` passes `banditGear(level)`.
2. **The Crossbowman role:**
   - Add `'crossbowman'` to `BanditRole` and `bandit_crossbowman: 'crossbowman'` to `BANDIT_ROLE`.
   - Its draft is modelled on the Archer, and is legal:
     - attributes as the Archer's;
     - tagged archery, 10 points in archery;
     - three level-1 perks the Archer could take (`marksmanship`, `deadly_aim`, `dodger` is the default; a different set is fine if it stays legal, as `builds each role from a legal draft` checks);
     - name "Bandit Crossbowman" and a portrait from `PORTRAIT_IDS` (never shown).
   - It holds the crossbow (yew at tier 1, ironwood at tier 2) and wears nothing else, as the Archer does.
   - The crossbow has 6 AP and the Archer's AP is 8, so it shoots once a turn standing still. Its 2 points of piercing count at range (`rangedPierce`, step 05).
3. **The kind** (`src/game/encounters.ts`):
   - `BanditKind` gains `'bandit_crossbowman'`, and `FOE_XP.bandit_crossbowman = 100`, as every bandit.
   - Any exhaustive `Record<UnitKind, …>` or `Record<BanditKind, …>` the compiler then flags gets an entry.
4. **The slot.** Add a slot to `BANDIT_CAMP_SLOTS`:

   ```ts
   { id: 'crossbowman', kind: 'bandit_crossbowman', name: 'Bandit Crossbowman', at: [9, 2], fromThreat: 6 }
   ```

   - It goes after the Hedge-Mage and before the Brute.
   - Pick a free hex (`[9, 2]` is not taken today); every foe in a battle needs a hex and a name of its own.
   - The counts are unchanged (2, 2, 2 at threats 3 to 5; 4, 4 at 6 and 7). So:
     - threat 3: Captain, Brute (unchanged);
     - threat 4: Captain, Hedge-Mage (unchanged);
     - threat 5: Captain, Archer (unchanged, now in Fine tier-2 gear);
     - threats 6 and 7: **Captain, Archer, Hedge-Mage, Crossbowman**. The Brute drops to fifth and the Cutthroat to sixth, so neither takes the field until a count reaches 5 or 6 (stage 9).

   This order is the plan's reading of option (a). Confirm it with the user's answer before committing. If the user wants the Brute kept at threats 6 and 7 (Captain, Archer, Hedge-Mage, Brute, with the Crossbowman fifth), the Crossbowman takes no field before stage 9, and the record says so. Update the comment above `BANDIT_CAMP_SLOTS` and `banditCamp`'s doc comment to match.
5. **Versions.**
   - The slots change, and a loaded battle rebuilds its encounter from the location to find the units' kinds. So raise `SAVE_VERSION` (`src/game/save.ts`) from 16 to 17, and amend the index's Versions line.
   - No event changes shape, so `LOG_SCHEMA_VERSION` stays 22.
6. **Tests** (`src/game/bandits.test.ts`, `src/game/encounters.test.ts`):
   - `equals a hero of the same draft, levels and gear (S1-A3)` covers the Crossbowman, and tier 2 as well as tier 1. Its own `GEAR` copy is rewritten by family and tier, and the test's comment about the wand being enchanted is dropped.
   - `builds each role from a legal draft` includes the Crossbowman.
   - `BANDIT_ROLE` names the new kind.
   - `banditGear` is tier 1, grade 1 at threats 3 and 4, and tier 2, grade 2 at 5 and 7.
   - "Shows the gear in the stats": at threat 5 the Captain's damage is the longsword's 1d8+3 plus 2 (tier) plus 1 (Fine) plus its strength and perks. Its armour class and resistance include the steel breastplate's +2 AC and +1 resistance and the ironwood shield's +2 AC.
   - In `encounters.test.ts`, the Bandit Camp fields at each threat 3 to 7, as listed in item 4, by kind.
   - The yardstick test holds monster kinds only and needs no change; check that it does not enumerate `BanditKind`.
7. **CLAUDE.md:** fix the `bandits.ts` code-map entry (the five roles become six, the Crossbowman's gear, `banditGear` in place of `banditGrade`, "the wand, an enchanted item, takes no grade" if step 04 left it) and the `encounters.ts` entry's camp slots. Leave the rules-of-scaling paragraph on bandits and the manual to step 10, but list in the record what they must say.
8. **Out of scope:** retuning (step 10 judges the guard and tunes); the sprite (step 08); spawns (`SPAWN_KINDS` is unchanged); new encounters.

### Under the other options

- **(b) the Crossbowman in the Archer's place at threat 5, steel from 5:** as (a), but the slot is `fromThreat: 5`, placed ahead of the Archer. So threat 5 fields the Captain and the Crossbowman, and threats 6 and 7 field the Captain, Crossbowman, Archer and Hedge-Mage. This reshapes today's threat-5 fight. Measure the threat-5 cell with care, as the Bandit Gangs at threat 5 spawn on the map. SAVE 17.
- **(c) steel only:** items 1, 6 (gear tests only) and 7. No role, kind, slot or sprite, and no SAVE bump (the slots are unchanged). Step 08 is dropped.
- **(d) defer both:** nothing changes in the code. Mark this step and step 08 `done (deferred to stage 9 by Q2)` in the index, and note it for step 10's stage notes.

## 5. Verification

1. `npm test` passes (typecheck and both vitest projects).
2. **The cells**, one after the other, each `--battles 500 --seed 1`, against step 01's figures:

   ```sh
   npm run simulate -- --encounter bandit_camp --threat 3 --party-level 3 --battles 500 --seed 1
   npm run simulate -- --encounter bandit_camp --threat 4 --party-level 4 --battles 500 --seed 1
   npm run simulate -- --encounter bandit_camp --threat 5 --party-level 5 --battles 500 --seed 1
   npm run simulate -- --encounter bandit_camp --threat 6 --party-level 6 --battles 500 --seed 1
   npm run simulate -- --encounter bandit_camp --threat 7 --party-level 7 --battles 500 --seed 1
   ```

   - Threats 3 and 4 must be identical to step 01's: their gear and slots are unchanged.
   - Threat 5 moves by the steel alone (step 01 recorded 470 of 500 before the stage).
   - Threats 6 and 7 move by the Crossbowman.
   - Record wins of 500, rounds, and both sides' damage and hit rates for each.
3. **The guard command**, recorded against step 06's figure and step 01's. Under (a) the move comes from steel on the threat-5 Bandit Gangs alone. Record the per-threat battles-won line for threat 5. Step 10 judges and tunes it. Do not tune here.
4. If any scene file was touched (it should not be), run `npm run test:browser -- -t battle`.

## 6. Completion criteria

- [ ] Q2's answer recorded, and the work done for that option.
- [ ] `banditGear` in use, with tier-2 gear from threat 5; the Crossbowman role, kind, `FOE_XP` and slot as the option says, with the fields at threats 6 and 7 confirmed against the answer.
- [ ] Hero-twin, legality, gear and camp-field tests cover the new role and tier 2.
- [ ] `SAVE_VERSION` 17 if the slots changed, and the index's Versions line amended.
- [ ] The five cells and the guard recorded here; the index row set to `done` with the commit, and its checkpoint note for "After 09" filled.
- [ ] CLAUDE.md's code-map lines for `bandits.ts` and `encounters.ts` true. The list for step 10 (the rules of scaling and the manual's bandit paragraph) is in the record.
- [ ] `npm test` passes; committed on `long-campaign-stage-03`, without pushing, the message ending with the repo's `Co-Authored-By` attribution line.

## Execution record

**Q2: (a)**, with the user's confirmation of the order: a Crossbowman slot from threat 6 after the Hedge-Mage and before the Brute (threats 6 and 7 field the Captain, Archer, Hedge-Mage and Crossbowman; the Brute waits for a count of 5), and tier 2 (steel, ironwood) Fine gear from threat 5.

**Done.**
- `bandits.ts`: `BanditRole` gains `crossbowman` (the Archer's attributes, skill and perks, name "Bandit Crossbowman"); `GEAR` names two ids per item (tier 1, tier 2); `banditGear(threat)` (`{ tier, grade }`: tier 1 plain below 5, tier 2 Fine from 5) replaces `banditGrade`; `banditStats(role, level, gear)` keys its cache by tier.
- `encounters.ts`: `bandit_crossbowman` in `BanditKind` and `FOE_XP` (100), a slot `crossbowman` at `[9, 2]`, `fromThreat: 6`; `SAVE_VERSION` 17 (`save.test.ts` updated); `LOG_SCHEMA_VERSION` unchanged.
- Tests: hero twin over six roles and both tiers; legality; `banditGear`; tier 2 in the Captain's stats; the Crossbowman's crossbow; the camp's fields at threats 3 to 7 and hero-rule stats at each.
- CLAUDE.md: the `bandits.ts` entry and the camp's slots in the rules of scaling were corrected (they were swept into step 07's commit `0ddaa77`, as the other engineer committed CLAUDE.md while my edit was in the tree).
- `npm test`: 73 files, 1052 tests pass.

**Measured** (seed 1, 500 battles; `--party-level` = threat). Step 01's cells predate steps 04 and 05, so threat 3 is compared with a run at `HEAD` before this step (429, identical to now):

| Cell | Wins | Rounds | Party / foes damage a battle | Party / foes hit rate |
| --- | --- | --- | --- | --- |
| threat 3 (step 01: 444; HEAD 429) | 429 | 10.3 | 96.7 / 64.7 | 0.565 / 0.515 |
| threat 4 (step 01: 473) | 473 | 9.7 | 105.6 / 67.4 | 0.617 / 0.610 |
| threat 5 (step 01: 470; HEAD 469, 8.8 rounds) | 256 | 11.0 | 91.6 / 121.9 | 0.565 / 0.637 |
| threat 6 | 2 | 7.0 | 121.0 / 188.7 | 0.801 / 0.781 |
| threat 7 | 1 | 7.2 | 133.4 / 204.9 | 0.815 / 0.861 |

Guard: 233 of 500 (46.6%), as step 06; 272 days, 18.3 battles; threat 5 won 1353 of 1510 (0.896, as at step 06), threat 3 0.969. The campaign party is far above level 5 when it meets threat-5 camps, so steel moves the campaign little though it halves the level-5 cell.

**For step 10.**
- The threat-5 cell fell from 469 to 256 on steel alone; threats 6 and 7 (Captain, Archer, Hedge-Mage, Crossbowman at party level 6 and 7) are won 2 and 1 times in 500: the counts of 4 there were a first guess and need tuning (or the cells need parties with tier-2 gear).
- CLAUDE.md's rules of scaling still quote the old cells (444, 473, 470) and the campaign narrative; the manual's bandit paragraph should mention the Crossbowman and steel from threat 5.
