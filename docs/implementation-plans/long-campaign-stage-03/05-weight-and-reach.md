# Step 05: Weight and reach

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-03-gear-families.md) (§2 "`deriveCombatStats`" and "The engine", S3-R2) · [Reference](../../designs/long-campaign/reference/gear-and-runes.md) (§4.1, §5.3 stat derivation only) · [Stages index](../../designs/long-campaign/index.md)

**Difficulty:** intricate engine and derivation work: the same `BattleEngine` drives the game and the simulator, and the checkpoint must stay byte-identical. Engineer opus, reviewer opus.

## 1. Objective

The new `ItemStats` fields, which step 04 declared and described, start to matter in battle:
- a wearer short of an item's strength loses to hit;
- `apPenalty` comes off action points;
- negative `spellSkill` lowers spell skill;
- a reach weapon (spear, halberd) is melee in every respect, and strikes from two hexes;
- the crossbow's piercing counts at range.

The engine stops judging "melee" by `attackRange === 1` and asks `isMelee(stats)` instead. Zones of control and free attacks stay at 1 hex. `AttackEvent` gains `melee`, so the battle screen swings a reach blow rather than shooting an arrow. `LOG_SCHEMA_VERSION` goes from 21 to 22.

When the step is done, the campaign summary is identical to step 04's: no simulated hero holds a reach weapon, a crossbow or an item it lacks the strength for (but see Q1 below).

## 2. Requirements and context

### Design requirements (restated)

- **S3-R2:** strength, AP and spell-skill penalties; reach; crossbow piercing.
- **Design §2, `deriveCombatStats`:**
  - a strength shortfall costs 5 to hit a point;
  - `apPenalty` comes off action points;
  - spell-skill penalties apply;
  - reach weapons count as melee for strength, piercing and skill;
  - crossbow piercing counts.

  `weaponSkill` follows the same rule.
- **Design §2, the engine:** a melee reach of 2 is an ordinary attack range. Zones of control and opportunity attacks stay at 1 hex.
- **Design §6 tests:**
  - `character.test.ts`: strength shortfall, AP penalty, spell-skill penalty, reach as melee, crossbow piercing;
  - `battleEngine.test.ts`: a reach-2 melee attack, and no zone of control at 2.

### Corrections that apply (copied from the index)

11. **The engine judges melee by `attackRange === 1`** (zones of control, a defender turning to meet a blow, `arcStruck`). A spear has range 2. So `CombatantStats` gains `reach?: true`, and the engine asks `isMelee(stats)` instead: a reach weapon is melee everywhere, its zone of control and free attacks staying at 1 hex (design §2). The battle screen tells a blow from a shot by distance, so `AttackEvent` gains `melee: boolean`. That raises `LOG_SCHEMA_VERSION`, which the design does not mention.
12. **Strength shortfall is counted per item and only against weapon attacks.** Each worn item that asks more strength than the wearer has costs 5 to hit a point short, and the items add up. A mage in plate (6) and a helm (4) with strength 3 loses 15 + 5 = 20. Spells are unaffected; heavy gear lowers them through its `spellSkill` instead.
13. **The crossbow's piercing is its own.** `rangedPierce` lets the weapon's `armorPierce` count at range. The strength perks' piercing (Armour Breaker, Sunder) stays melee only, as they are melee blows.

### Contract C7 (copied unchanged from the index)

```ts
// src/combat/combat.ts — CombatantStats gains:
/** Its weapon is melee though it strikes beyond the next hex (a spear); none when left out. */
reach?: true
// sameCombatStats compares it (left out equals false).

// src/engine/battleEngine.ts
/** A weapon that strikes as melee: range 1, or reach. */
export function isMelee(stats: Pick<CombatantStats, 'attackRange' | 'reach'>): boolean
export function arcStruck(defender: Pick<UnitSnapshot, 'position' | 'facing' | 'turnReady'>, from: Hex, melee: boolean): Arc  // was attackRange: number
// AttackEvent gains:
/** The blow was struck with a melee weapon, reach included; false for a shot. */
melee: boolean
```

- **`deriveCombatStats`** (`src/character/character.ts`), with `strength = attributeLevel(character, 'strength')` and the main hand's stats as `weapon`:
  - `ranged = attackRange > 1 && !weapon.reach`;
  - `toHit −= SHORTFALL_TO_HIT × Σ strengthShortfall(strength, s)` over `wornStats` (an off-hand item under a two-handed weapon does not count; correction 12);
  - `actionPoints −= Σ apPenalty` over `wornStats`;
  - `spellSkill` adds every worn `spellSkill`, negatives included (as today);
  - `pierce = ranged ? (weapon.rangedPierce ? armorPierce : 0) : armorPierce + perkBonus('armorPierce')` (correction 13);
  - `might` and the melee or ranged damage perk follow `ranged`, and the `range` perk adds only when `ranged`;
  - `reach: true` is set when the weapon has it.
- **`weaponSkill(weapon)`** is `stats.skill`, else Archery when `attackRange > 1 && !reach`, else Melee Weapons.
- **The engine** uses `isMelee` wherever it asks `attackRange === 1` today:
  - `reactorsAt` (zones of control and free attacks, still at 1 hex);
  - a defender turning to meet a side or rear blow;
  - `arcStruck`.

  `policies.ts` and `scenes/attackPlan.ts` pass `isMelee(stats)` to `arcStruck`. A reach attack needs no other change: range 2 is an ordinary range.
- **The battle screen:** `attackLook` returns `'swing'` when `event.melee`. `impactMs` times a melee event as a swing.
- `LOG_SCHEMA_VERSION` 21 → 22.

### What this step consumes from step 04 (C1, copied unchanged)

```ts
// ItemStats gains (declared and described in step 04; derived in step 05):
/** The strength the item asks; each point its wearer lacks costs SHORTFALL_TO_HIT to hit (step 05). */
strength?: number
/** Action points it takes from its wearer every turn. */
apPenalty?: number
/** A melee weapon that strikes beyond the next hex: melee for skill, strength, piercing and the engine. */
reach?: true
/** A ranged weapon whose armorPierce counts though it is shot (the crossbow). */
rangedPierce?: true

export const SHORTFALL_TO_HIT = 5
/** Points of strength `stats` asks beyond `strength`: max(0, (stats?.strength ?? 0) − strength). */
export function strengthShortfall(strength: number, stats: ItemStats | undefined): number
```

These are in `src/inventory/inventory.ts`. The catalog rows that use them (C1, tier 1):

| Family | Id (tier 1) | Relevant stats |
| --- | --- | --- |
| spear | `iron_spear` | 1d8+1, 5 AP, range 2, pierce 1, `reach` |
| halberd | `iron_halberd` | 1d12+3, 7 AP, range 2, pierce 2, two-handed, `reach`, strength 6 |
| crossbow | `yew_crossbow` | 1d10, 6 AP, range 5, pierce 2, two-handed, `rangedPierce` |
| mace | `iron_mace` | strength 5 |
| war hammer | `iron_war_hammer` | 1d10+3, 6 AP, pierce 3, toHit −5, strength 6 |
| longbow | `yew_longbow` | range 7, two-handed, strength 5 |
| staff | `ash_staff` | 1d6+1, melee, two-handed, `skill: 'magic'`, spellSkill 5, maxMana 4 |
| wand | `spark_wand` | range 4, `skill: 'magic'` |
| tower shield | `iron_tower_shield` | acBonus 16, resistance 1, apPenalty 1, strength 6 |
| plate | `iron_plate` | acBonus 6, resistance 4, apPenalty 1, spellSkill −15, strength 6 |
| helm | `iron_helm` | acBonus 2, resistance 1, spellSkill −5, strength 4 |
| gauntlets, greaves | `iron_gauntlets`, `iron_greaves` | resistance 1, strength 4 (gauntlets spellSkill −5) |

**Q1 (open):** the battle axe (5), the greatsword (6) and the breastplate (strength 4, spell skill −5) may also carry weight, as the user decides. Step 04 commits the rows as Q1 settles them. This step's code is the same whichever way it goes; only the checkpoint expectation differs (§5).

### Shared constraints (from the index)

- Commands (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before the commit.
  - `npx vitest run --project domain` and `npx vitest run <file>` for quick checks.
  - `npm run test:browser -- -t <name>` for the in-browser tests (`e2e/CLAUDE.md` first).
  - The guard: `npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1` (about a minute, about 70 MB under `logs/`). Give concurrent local runs distinct `--out` files. Never run two `make simulate` at once.
- **Determinism.** Add, drop or reorder no RNG draw. The new checks are pure comparisons on stats already known.
- **Versions.** `LOG_SCHEMA_VERSION` 21 → 22 here. `SAVE_VERSION` is untouched: `CombatantStats.reach` sits inside the stats already saved in a snapshot, and an older save is already unreadable after step 04's bump to 16.
- **Commit:** one commit, once `npm test` passes, on `long-campaign-stage-03`. Do not push or switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
- **CLAUDE.md** must stay current: update the lines this change makes wrong (§4.6).

## 3. Dependencies and prerequisites

- **Step 04 (done before this one)** provides:
  - `ItemStats.strength`, `apPenalty`, `reach` and `rangedPierce`;
  - `SHORTFALL_TO_HIT` and `strengthShortfall` in `src/inventory/inventory.ts`;
  - the catalog (`src/inventory/catalog.ts`), so `itemById('iron_spear')`, `'iron_halberd'`, `'yew_crossbow'`, `'iron_plate'`, `'iron_helm'`, `'iron_tower_shield'`, `'iron_war_hammer'`, `'ash_staff'` and `'spark_wand'` build the items above;
  - `describeItemStats` already writes their lines.

  Before step 04, none of these exist.
- **Existing code this step changes** (inspected at `866f732`; line numbers approximate):
  - `src/character/character.ts`: `weaponSkill` (~88), `wornStats` (~95), `deriveCombatStats` (~120). `MELEE_RANGE = 1`. `ranged` is decided by `attackRange > MELEE_RANGE`, and piercing is zeroed for ranged.
  - `src/combat/combat.ts`: `CombatantStats` (~20), `sameCombatStats` (~82).
  - `src/engine/battleEngine.ts`:
    - `LOG_SCHEMA_VERSION = 21` (41);
    - `AttackEvent` (~247);
    - `arcStruck` (~557–567: `defender.turnReady && attackRange === 1 ? 'front' : attackArc(...)`);
    - its use in previews (~871);
    - `reactorsAt` (~1190–1202: `u.stats.attackRange === 1`);
    - the private `attack` (~1352), where `defenderTurned` tests `actor.stats.attackRange === 1`. Every `AttackEvent` is made there: plain attacks, free attacks and each strike of a routine.
  - `src/engine/policies.ts`: `expectedHarm` (~240) calls `arcStruck(target, self.position, self.attackRange)`; `reach` (~222) is unchanged.
  - `src/scenes/attackPlan.ts` (~64): `arcStruck(foe, m.action.to, actor.attackRange)`.
  - `src/scenes/battleEffects.ts`: `attackLook` (~28, `event.distance <= 1 ? 'swing' : …`) and `impactMs` (~110, `event.distance <= 1 ? SWING_IMPACT_MS : RELEASE_MS + flightMs(distance)`).
  - `src/scenes/sounds.ts`: an attack always plays `sfx_melee_swing`, then its outcome at `impactMs(event)`. It needs no change and follows `impactMs`.
- **Produces for later steps:** `isMelee`, `CombatantStats.reach` and `AttackEvent.melee` (step 07's screens and step 10's cells rely on them). The derived penalties are what step 07's tooltips describe and what checks 2 and 3 in step 10 measure.

## 4. Scope and implementation guidance

### 4.1 `src/character/character.ts`

- **`weaponSkill(weapon)`:** `weapon?.stats?.skill`, else Archery when `(attackRange ?? 1) > 1 && !reach`, else Melee Weapons. So the spear and halberd use Melee, the crossbow and longbow Archery, and the wand and staff Magic.
- **`deriveCombatStats`:**
  - Read `strength` through `attributeLevel` (today's `attributesOf` already does; keep one source), so a strength-raising trunk perk lowers the shortfall.
  - Sum `strengthShortfall(strength, s)` over every stats object of `wornStats(character)`. That already leaves out an off-hand item under a two-handed weapon, so a tower shield behind a halberd costs nothing. Subtract `SHORTFALL_TO_HIT ×` the sum from `toHit`.
  - Subtract `Σ (s.apPenalty ?? 0)` over `wornStats` from `actionPoints`. No floor is needed: the lowest is 5 + 0 − 2 = 3 at agility 1.
  - `spellSkill` already sums every worn `spellSkill`. Negatives now occur; leave the arithmetic, and check that a caster's `magic.skill` shows the drop.
  - `ranged = attackRange > MELEE_RANGE && !mainHand?.stats?.reach`. Take `reach` and `rangedPierce` from the main hand's stats, not from a sum, since only a weapon has them.
  - `might`, the `meleeDamage` / `rangedDamage` perk choice, and the `range` perk all follow `ranged` as today. A spear gains strength damage and Heavy Hand-style melee perks, but never the archer's range perk.
  - `pierce = ranged ? (rangedPierce ? armorPierce : 0) : armorPierce + perkBonus(character, 'armorPierce')`. The crossbow's 2 counts at range; Armour Breaker and Sunder never add to a shot.
  - Emit `reach: true` only when the weapon has it (spread it as `armorPierce` is), so every other unit's stats are unchanged and `sameCombatStats` sees no difference for today's gear.
  - `attackRange` stays the weapon's range (2 for the spear) plus the `range` perk only when `ranged`.
- **Keep everything else.** In particular, the order of fields in the returned object does not matter to the engine, but do not change any existing value for today's gear.

### 4.2 `src/combat/combat.ts`

- `CombatantStats` gains `reach?: true`, with the doc comment of C7.
- `sameCombatStats` adds `(a.reach ?? false) === (b.reach ?? false)`. That decides whether an `equip` action registers a change, so swapping a longsword for a spear is a change.
- No monster stat block gets `reach` in this stage.

### 4.3 `src/engine/battleEngine.ts`

- **Add `isMelee(stats)`**, exported: `stats.attackRange === 1 || stats.reach === true`.
- **`arcStruck(defender, from, melee: boolean)`:** `defender.turnReady && melee ? 'front' : attackArc(defender, from)`. Update its doc comment ("with a melee weapon" rather than "of `attackRange`"). Every caller passes `isMelee(...)`:
  - the engine's preview (~871: `isMelee(actor.stats)`);
  - `policies.ts` `expectedHarm` (`isMelee(self)`, a `UnitSnapshot`'s stats fields; pass what holds `attackRange` and `reach`);
  - `scenes/attackPlan.ts` (`isMelee(actor)`).
- **`reactorsAt`:** replace `u.stats.attackRange === 1` with `isMelee(u.stats)`. The adjacency tests (`hexDistance(u.position, hex) === 1 && hexDistance(u.position, to) > 1`) stay exactly as they are, so a spear's zone is its neighbouring hexes only: a foe two hexes from a spearman moves freely, and leaving its side provokes one free attack as from any melee unit.
- **The defender's turn** in the private `attack`: `target.turnReady && isMelee(actor.stats) && attackArc(target, actor.position) !== 'front'`. A spear thrust from two hexes on a ready foe's side turns it to face the spearman, as a sword would.
- **`AttackEvent.melee`:** set in the one place `AttackEvent`s are built (the private `attack`) to `isMelee(actor.stats)`, for plain attacks, free attacks (`opportunity: true`) and every strike of a routine alike. Today's monsters are all range 1, so their strikes are `melee: true`, and every bow or wand shot is `false`.
- **`formatEvent`:** no change. The on-screen line stays as it is (add detail to the event, keep the line simple).
- **`LOG_SCHEMA_VERSION`:** 21 → 22. Update any test that pins it.
- **No change** to `legalActions` (a range-2 melee unit lists attacks on foes within 2, as range does today), to `reachableHexes`, to flanking (allies adjacent to the defender), or to the AI's `reach` helper (it closes to `attackRange`).
- **Snapshots:** `BattleEngine.restore` takes stats as saved, so a reach unit restores with `reach`. No snapshot-shape change.

### 4.4 `src/engine/policies.ts`

- Only the `arcStruck` call changes. Check `aggressive`'s choices for today's units are untouched: every existing unit's `isMelee` equals its old `attackRange === 1`.

### 4.5 The battle screen (Phaser-free helpers)

- **`src/scenes/battleEffects.ts`:**
  - `attackLook(event, heldIcon)`: `'swing'` when `event.melee`; otherwise as today (a wand's bolt, else an arrow). `heldIcon` stays as a parameter.
  - `impactMs`: an attack event with `melee` lands at `SWING_IMPACT_MS`; a shot at `RELEASE_MS + flightMs(event.distance)`.
- **`src/scenes/BattleScene.ts`:** where it plays an attack, check nothing else keys a swing or a shot on `distance <= 1` (it calls `attackLook` and `flightMs`). A swing from two hexes lunges toward the target and slashes across it as a sword does. That is acceptable; do not add a new effect.
- **`src/scenes/sounds.ts`:** no change; its timing follows `impactMs`.
- **`src/scenes/eventSchedule.ts`:** check it times attacks through `impactMs` / `holdMs` and not through `distance` directly. If it reads `distance`, switch it to `melee` the same way.

### 4.6 CLAUDE.md

Update, in the same commit:
- **Rules of the battle system:**
  - the zone of control is held by a ready foe "with a melee weapon", reach included, still over its neighbouring hexes only;
  - a defender turns to meet a melee blow, reach included;
  - `previewAttack` and `arcStruck` judge melee by `isMelee`;
  - a sentence on reach: the spear and halberd strike from two hexes as melee weapons (Melee Weapons, strength damage, piercing).
- **The `battleEngine.ts` bullet:** `AttackEvent.melee`.
- **Rules of characters:**
  - `weaponSkill`: Archery for a weapon that reaches further than a hex "and has no reach";
  - the strength shortfall, 5 to hit a point per item;
  - `apPenalty` off action points;
  - negative spell skill from heavy gear;
  - the crossbow's piercing at range, its own and not the strength perks'.
- **Rules of the battle system's "a shot … pierces nothing":** except the crossbow's own piercing.

Search CLAUDE.md for `attackRange === 1`, "ranged weapons, wands among them, hold no zone of control", "Archery for a weapon that reaches further than a hex", and "a shot, a wand's included, pierces nothing", and fix each.

### 4.7 Out of scope

- The words in the tooltip and the comparisons: `describeItemStats` is step 04's; `gearCompare.ts` and the scenes' shortfall lines are step 07's.
- The trading post (step 06), bandits (step 09), tuning (step 10).
- Any zone-of-control reach beyond 1 hex (reference §8.7: revisit only if a second rank of spears proves too strong; step 10 watches it).

## 5. Verification

### Unit tests

**`src/character/character.test.ts`** (build characters with `createCharacter` or a draft and put items in `equipment` directly):
- **Shortfall, one item:** strength 3 in `iron_plate` (6) gives `toHit` 15 lower than the same character in no armour, other things equal (plate adds no `toHit`).
- **Summed per item:** strength 3 in `iron_plate` and `iron_helm` gives 20 lower (15 + 5).
- **No shortfall at or above:** strength 6 in plate loses nothing to strength.
- **Off hand under a two-handed weapon ignored:** strength 3 holding `iron_halberd` (6) with `iron_tower_shield` (6) in the off hand loses 15, not 30. The tower shield's `apPenalty` does not count either.
- **Perk-raised strength counts:** a character born at strength 5 with a strength trunk rank (+1, via `perks`) wearing a strength-6 item loses nothing.
- **AP penalty:** plate takes 1 from `actionPoints`; plate and a tower shield (with a one-handed weapon) take 2.
- **Spell-skill penalty:** a caster's `magic.skill` falls by 15 in plate and by 20 in plate and a helm; a robe or a staff raises it by 5.
- **Reach is melee:**
  - `iron_spear` gives `weaponSkill` Melee Weapons;
  - `attackRange` 2 and `reach: true`;
  - strength's `might` is added to the damage bonus;
  - the melee damage perk applies and the ranged one does not;
  - `armorPierce` is the spear's 1 plus Armour Breaker's points;
  - the `range` perk does not lengthen it (2 with Marksmanship-line range perks taken).
- **Crossbow:** `yew_crossbow` gives Archery, `armorPierce` 2, and Armour Breaker adds nothing. Today's bow still pierces 0.
- **Magic weapons:** `spark_wand` gives Magic and is ranged (no might). `ash_staff` gives Magic and is melee (might applies, `attackRange` 1, no `reach`).
- **Today's gear unchanged:** the ready-made party's three `deriveCombatStats` results equal what they were before the step (compare against literal expected values, or with `sameCombatStats` against a snapshot built from today's rules). Under Q1 (b), the breastplate's rows change the archer and the mage; then assert the new values.

**`src/combat/combat.test.ts`** (or wherever `sameCombatStats` is tested): two stats differing only in `reach` are not the same; `reach` left out equals `reach` false.

**`src/engine/battleEngine.test.ts`** (seeded `mulberry32` or a scripted RNG):
- **A reach-2 attack:** a spear unit two hexes from a foe has an `attack` action on it in `legalActions` without moving. `step` resolves it as a melee attack, with `distance` 2, `melee: true`, the spear's piercing applied, and the arc judged as a blow.
- **Zone of control at 1 hex only:**
  - a foe adjacent to a ready spear unit that steps to a hex not adjacent provokes one free attack (`opportunity: true`, `melee: true`);
  - a foe two hexes from the spear unit moving anywhere provokes nothing;
  - a foe moving from one hex beside it to another hex beside it provokes nothing (unchanged rule).
- **The defender turns to a reach blow:** a ready foe struck on its side by a spear from two hexes turns to face the attacker before the roll (`defenderTurned: true`, arc `front`).
- **A shot still gives no turn**, and has `melee: false`. A bow's free attack is impossible, as today.
- **`arcStruck`** with `melee` true and false on a `turnReady` defender: `'front'` and the standing arc respectively.
- **`isMelee`:** range 1 → true; range 2 with `reach` → true; range 5 → false.
- **Routines:** a monster routine's strikes carry `melee: true`.
- **`LOG_SCHEMA_VERSION` is 22.**

**`src/scenes/battleEffects.test.ts`:**
- `attackLook` gives `'swing'` for a `melee` event at distance 2, `'arrow'` for a shot, and `'bolt'` for a wand shot.
- `impactMs` gives `SWING_IMPACT_MS` for a melee event at distance 2.

**`src/engine/policies.test.ts`:** existing tests pass unchanged. Optionally add a test that the policy scores a spear unit's attack from two hexes.

### Checks

1. `npm test` passes (typecheck included: every `arcStruck` caller and every `AttackEvent` literal in tests updated).
2. **The guard checkpoint.** Run `npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1`. The printed summary must be **identical to step 04's** recorded summary: no simulated hero holds a reach weapon, a crossbow or a strength item, and every existing unit's `isMelee` equals its old `attackRange === 1`.
   - **Q1 caveat (amended at step 04; Q1 was answered (b)):** step 04's breastplate rows already moved the guard through its spell skill −5 (248 → 231). This step moves it again: the breastplate asks strength 4, and the ready-made archer and mage (and Brenna and Delwyn among the pre-rolls) have strength 3, so each loses `SHORTFALL_TO_HIT` (5) to hit with its weapon. No bandit is short (the Archer and the Hedge-Mage wear no armour; the Brute and the Captain have 10 and 6). So: (i) a **scratch** run with the breastplate's `strength` removed (an edit reverted, never committed) must be **identical** to step 04's recorded guard (231 of 500); (ii) the committed code's guard is recorded as this step's figure, and step 10 judges it.
   - If the summary differs, find the draw or choice that changed before committing.
3. **Event logs:** in the guard's JSONL, attack events now carry `melee`. Spot-check that free attacks and routine strikes have `melee: true` and arrows `false`.
4. **In-browser battle tests:** `npm run test:browser -- -t battle` (or `make test-browser ARGS="-t battle"`), since `battleEffects.ts` changed. Optionally, in `make dev`, run `give iron_spear` and `fight goblin_raid 3`. Equip the spear on the fighter, and attack a goblin from two hexes behind an ally: the fighter lunges and swings, no arrow flies, and the log line reads as a blow.

## 6. Completion criteria

- [ ] `deriveCombatStats` and `weaponSkill` follow C7: shortfall per item, AP penalty, negative spell skill, reach as melee, crossbow piercing, `reach` on the stats.
- [ ] `CombatantStats.reach` and `sameCombatStats` updated.
- [ ] `isMelee` exported and used in `reactorsAt`, the defender's turn and `arcStruck`. `arcStruck`'s new signature is used by the engine, `policies.ts` and `attackPlan.ts`.
- [ ] `AttackEvent.melee` set on every attack; `LOG_SCHEMA_VERSION` is 22.
- [ ] `attackLook` and `impactMs` key on `melee`.
- [ ] The unit tests above added. `npm test` passes, and the in-browser battle tests pass.
- [ ] The scratch guard (breastplate strength removed) is identical to step 04's; the committed guard is recorded in the execution record.
- [ ] CLAUDE.md updated (§4.6).
- [ ] Committed on `long-campaign-stage-03` without pushing. Step 05's row in the index set to `done` with the commit.

## Execution record

Commit `6514b5c` on `long-campaign-stage-03` (Node 26).

**Built** (C7 as written):
- `character.ts`: `weaponSkill` and `deriveCombatStats` decide "ranged" through one private `isRangedWeapon` (range above 1 and no `reach`, from the main hand's stats). The strength shortfall is summed per item over `wornStats` and taken off `toHit` (`SHORTFALL_TO_HIT`). `apPenalty` is summed and taken off action points. Piercing is the weapon's own at range only with `rangedPierce`, and the perks' only in a blow. `reach: true` is spread onto the stats only when the weapon has it.
- `combat.ts`: `CombatantStats.reach`, compared in `sameCombatStats`.
- `battleEngine.ts`: `isMelee` exported. It is used in `reactorsAt`, in the defender's turn, in `previewAttack` and in `AttackEvent.melee`. `arcStruck` takes `melee: boolean`. `LOG_SCHEMA_VERSION` is 22. The module doc says a reach weapon holds its zone over the next hexes only.
- `policies.ts` and `attackPlan.ts` pass `isMelee(...)` to `arcStruck`.
- `battleEffects.ts`: `attackLook` and `impactMs` key on `event.melee`. `eventSchedule.ts` and `sounds.ts` needed nothing, since they time by `impactMs`. Neither does `BattleScene.ts`, since it calls `attackLook`.
- CLAUDE.md (§4.6):
  - the rules of the battle system: melee is `isMelee`, and reach strikes from two hexes; the zone of control is held "reach included", still over the neighbouring hexes; the crossbow is among the ranged weapons that hold no zone; the crossbow's own piercing is the exception to "a shot pierces nothing"; a defender turns to a melee blow, reach included; `arcStruck` judges by `isMelee`;
  - `AttackEvent.melee` in the events paragraph;
  - the rules of characters: `weaponSkill` "and has no reach", and weight (shortfall, `apPenalty`, negative spell skill, the breastplate on the strength-3 archer and mage);
  - the catalog line no longer says "which nothing derives yet".

**Tests**:
- `character.test.ts` gains a "weight and reach" block of 10 tests, the §5 list: one item's shortfall, the items added up, nothing at or above the strength asked, an off hand under a two-handed weapon left out (to hit and AP), strength raised by a perk, the AP penalty, spell skill, the spear as melee with its perks, the crossbow, the wand and the staff.
- `party.test.ts`: the ready-made three's `toHit` (Aldric unchanged; Brenna and Delwyn −5). Delwyn's 63 → 58 is a deliberate change of expectation (Q1 b).
- `combat.test.ts`: `reach` in `sameCombatStats`.
- `battleEngine.test.ts` gains a "BattleEngine reach" block:
  - `isMelee`;
  - a thrust from 2 hexes: legal without moving, `distance` 2, `melee` true, the piercing recorded, the defender turned, the arc `front` in the preview and the event;
  - the zone at 1 hex only: a free attack with `melee` true; nothing provoked from 2 hexes off; nothing for a slide beside the spearman;
  - `arcStruck` with `melee` true and false.

  It also checks `melee: false` on a shot and `melee: true` on routine strikes. The schema test reads 22, and the caster test's pinned `schemaVersion: 21` now reads the constant.
- `policies.test.ts`: `aggressive` thrusts from two hexes.
- `battleEffects.test.ts`: a reach blow swings and lands at `SWING_IMPACT_MS`; a bow or wand shot from the next hex flies.
- The `AttackEvent` literals in `eventSchedule.test.ts` and `sounds.test.ts` gain `melee`.
- Red was seen before green for each new behaviour. Some tests passed at once because the code already did that (the slide test, spell skill, the staff, the perk-raised strength), and they are kept as guards.

**Commands:**
- `npm test`: 1034 passed (1016 at baseline).
- `npm run test:browser` (all, not only `-t battle`): 9 files, 79 passed.
- The in-game spear check from §5 check 4 (`make dev`, `give iron_spear`) was not walked; the domain and browser tests cover the look.

**Checkpoint** (the guard command with `--out` per run; seed 1, 500 campaigns):

| Run | Code | Source | Days | Battles | Heroes dead | Gold on gear |
| --- | --- | --- | --- | --- | --- | --- |
| step 04 (A) | step 04 | 231 | 269 | 18.2 | 1.8 | 2 |
| reference | step 04's tree re-run before any change | 231, same | 269 | 18.2 | 1.8 | 2 |
| scratch | step 05, breastplate `strength` removed (reverted, not committed) | 231, **identical to step 04's summary line for line** (run with step 04's `--out` path, `diff` empty) | 269 | 18.2 | 1.8 | 2 |
| **committed** | step 05 | **175** | 249 | 17.1 | 1.4 | 1 |

So everything in this step is neutral for today's gear, and the whole fall of 56 (231 → 175) is the breastplate's strength 4. It costs 5 to hit with their weapons to the ready-made archer and mage (strength 3), and to any strength-3 pre-roll recruited. Win rates by threat: 1 1.000, 2 0.984, 3 0.958, 4 0.988, 5 0.862 (against 1.000, 0.986, 0.968, 0.992 and 0.895 at step 04). Player hit rate 0.634 (0.666). Fewer heroes die a campaign (1.4 against 1.8) only because campaigns end sooner (249 days, 17.1 battles). This is far more than the "about 5 points" the guard allows, and step 10 must judge it or retune it. The levers are the breastplate's strength (4 → 3 would cost the strength-3 heroes nothing) or its spell skill.

**Event logs** (§5 check 3), counted over the committed guard's JSONL:
- plain attacks from more than a hex: 79901, all `melee: false`;
- plain attacks from the next hex: 112836 `melee: true` and 6522 `melee: false` (bows and wands shot at point blank, which used to play as a swing and now fly);
- routine strikes: 2706, all `melee: true`.

The simulator records no free attacks (`avgOpportunityAttacks` 0), so the free-attack case is checked only by the engine test.

Committed summary, verbatim:

```
Simulated 500 campaigns, 8558 battles in all (seed 1, player aggressive vs enemy aggressive) -> logs/s3-step05-guard.jsonl
Beat the Source: 175 of 500 (35.0%); party fell: 325 (65.0%); encampment lost: 0 (0.0%); out of days: 0
A campaign: 249 days, 17.1 battles, 24.4 spawns, 2.8 sites captured and 0.1 lost, 38% of the land blighted at the end
Watchtowers: 1.7 built a campaign, 0.0 lost
Shrine: level 0.9 at the end; outposts: 0.4 built a campaign
Trading post, workshop, infirmary: levels 1.1, 0.5, 0.4 at the end; 1 gold on gear and 46 from sales, 3.9 items crafted (2.5 days in the field) a campaign
Guild hall: level 2.3 at the end, 1.8 recruits and 1.4 heroes dead a campaign
Hit points healed between battles: 120.6 a campaign, in 19.5 days of camping
Levels at the end: lowest 6.4, highest 6.9 on average (ready level 7); heroes died at level 2 (36), 3 (175), 4 (38), 5 (80), 6 (12), 7 (193), 8 (162), 9 (20)
Battles to level 5: 6.8 (390 campaigns); 10: — (0 campaigns); 15: — (0 campaigns); 20: — (0 campaigns)
┌─────────┬────────┬─────────┬──────┬─────────┐
│ (index) │ threat │ battles │ won  │ winRate │
├─────────┼────────┼─────────┼──────┼─────────┤
│ 0       │ 1      │ 1012    │ 1012 │ 1       │
│ 1       │ 2      │ 1708    │ 1680 │ 0.984   │
│ 2       │ 3      │ 1891    │ 1811 │ 0.958   │
│ 3       │ 4      │ 2591    │ 2561 │ 0.988   │
│ 4       │ 5      │ 1356    │ 1169 │ 0.862   │
└─────────┴────────┴─────────┴──────┴─────────┘
┌───────────────────────┬──────────────────────┐
│ (index)               │ Values               │
├───────────────────────┼──────────────────────┤
│ battles               │ 8558                 │
│ playerWins            │ 8233                 │
│ enemyWins             │ 325                  │
│ unresolved            │ 0                    │
│ avgRounds             │ 5.1039962608086      │
│ avgPlayerDamageDealt  │ 96.05667211965412    │
│ avgEnemyDamageDealt   │ 29.41972423463426    │
│ playerHitRate         │ 0.6342574922520267   │
│ enemyHitRate          │ 0.5975226526499725   │
│ playerCritRate        │ 0.044571838597884    │
│ enemyCritRate         │ 0.049039640375970577 │
│ avgOpportunityAttacks │ 0                    │
│ avgSideAttacks        │ 1.2816078523019396   │
│ avgRearAttacks        │ 0.15739658798784764  │
│ avgPlayerCasts        │ 4.82425800420659     │
│ avgEnemyCasts         │ 2.0766534236971257   │
│ avgPlayerAreaAttacks  │ 0                    │
│ avgEnemyAreaAttacks   │ 0.022201448936667447 │
│ avgPlayerHealing      │ 2.53119887824258     │
│ avgEnemyHealing       │ 6.335826127599907    │
│ avgPlayerStatuses     │ 2.936667445664875    │
│ avgEnemyStatuses      │ 0.7411778452909559   │
└───────────────────────┴──────────────────────┘
```

**Deviations:**
- A ranged weapon shot at the next hex now plays as a shot, where `distance <= 1` used to swing it. That follows C7 (`attackLook` keys on `melee`); it is a change on screen only.
- The policy test is the optional one from §5.
- CLAUDE.md's rules of scaling still give step 01's figures. Step 04 did not add its 231 there either, so both moves are left to step 10's documentation pass, as the index's guard rule assigns.

**For later steps:**
- Step 06 measures against **175**, not 231.
- `isMelee`, `CombatantStats.reach` and `AttackEvent.melee` are in place for step 07 and step 10's cells.


### Follow-up: the breastplate's strength 3 (the user's decision, 2026-11-07)

The user lowered the breastplate's `strength` from 4 to 3 (spell skill −5, the axe's 5 and the greatsword's 6 unchanged), because step 05's 175 was all the breastplate's strength 4 on the strength-3 archer and mage. Done test-first: `character.test.ts` (a strength-3 wearer loses nothing to the breastplate, a strength-2 wearer 5), `party.test.ts` (the archer, mage and soldier lose nothing to hit; the mage's `toHit` is 63, its spell skill still 58) and `catalog.test.ts` (the row says 3). CLAUDE.md's rules of characters and the index's C1 row now say 3. The policy test "aggressive thrusts with a spear from two hexes" now also asserts the attack event is `melee: true` at `distance: 2`, which fails without `reach: true` (checked by removing it).

**Guard: 231 of 500** (`npm run simulate -- --campaign --battles 500 --seed 1`), 269 days, 18.2 battles, 1.8 heroes dead, 2 gold on gear, threat 5 won 0.895, threat 3 0.968: identical to step 04's summary, as expected, since the strength-3 archer and mage now lose nothing. Step 06 measures against 231.
