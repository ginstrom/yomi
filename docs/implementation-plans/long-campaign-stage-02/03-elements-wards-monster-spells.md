# Step 03: Elements, wards and monster spells

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-02-special-attacks-and-elements.md) (§2 "Monster spells", "Elements and wards", "The policy"; §3 S2-R3, S2-R4, S2-R5; §6) · References: [`campaign-to-level-20.md`](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.4 "Monster spells", [`gear-and-runes.md`](../../designs/long-campaign/reference/gear-and-runes.md) §4.6 and §5.3 (elements and wards only)

**Difficulty:** intricate engine and policy work. Use the session's model, not `sonnet`.

## 1. Objective

Spells and statuses gain elements. Units can carry wards against an element, and the engine applies them to a hostile cast's damage and to each status tick, logging what each ward stopped. Five monster-only spells and two new statuses join the spell tables, and no hero can ever learn them. Drain Life heals its caster. The `aggressive` policy scores casts after wards and knows what to do with each monster spell.

No unit has a ward and no kind casts a monster spell yet. So every battle that exists today plays out exactly as before, and **the campaign summary must be identical to step 01's**.

## 2. Requirements and context

- **S2-R3:** monster spells, never learnable by heroes.
- **S2-R4 (the spell and status part):** elements on spells and statuses; monster wards; `warded` in the log. Areas get theirs in step 05, and the Salamander's ward in step 08.
- **S2-R5 (the spell part):** the policy uses monster spells by expected harm, and a warded target is scored lower.
- **Design tests (§6) this step covers:**
  - `battleEngine.test.ts`: monster spells (Drain Life heals the caster, Web lays Webbed); ticks warded; the schema version.
  - `policies.test.ts`: a warded target scored lower.
  - `spells.test.ts` and `perks.test.ts`: the hero spell tree never lists monster spells.
- **Corrections from the index that apply here:**
  - **8.** Drain Life's heal to its caster is `CastEvent.drained`. `warded` is the points the ward stopped, and `damage` is what was dealt.
  - **11.** The monster spells' mana and AP are first values. Step 09 may tune them.
  - **13.** The hero spells' policy rules are unchanged. Wards lower a spell's score only where a ward exists, and monster spells fit the existing rules.
  - **14.** Statuses are laid whatever a ward stops.
  - **15.** `LOG_SCHEMA_VERSION` goes 18 → 19 in this step. `SAVE_VERSION` does not change here.

### Contract C2: elements, wards and the spell changes (produced here, copied from the index)

```ts
// src/combat/combat.ts (new)
export const ELEMENTS = ['fire', 'frost', 'lightning', 'acid', 'poison', 'blight'] as const
export type Element = (typeof ELEMENTS)[number]
// CombatantStats gains:
/** Points taken off each instance of damage of an element; none when left out. */
wards?: Partial<Record<Element, number>>
/** Damage of `element` after `stats`' ward: max(0, damage − ward); damage of no element is unchanged. */
export function warded(damage: number, element: Element | undefined, stats: CombatantStats): number
```

- `sameCombatStats` compares `wards`. A missing key equals 0.
- `Spell` gains:
  - `element?: Element`;
  - `drain?: number`, the share of the damage dealt that heals the caster.
- `StatusRule` gains `element?: Element`, read for its tick.
- **Elements of today's spells and statuses:**
  - Flame Arrow and Fireball: fire;
  - Frost Blast: frost;
  - Acid Arrow and Corroded's tick: acid;
  - Death Cloud and Poisoned's tick: poison;
  - Magic Arrow: none.
- **The engine applies `warded`:**
  - to a hostile cast's damage on each unit, after any critical;
  - to each status tick.

  A status is laid whatever the ward stopped (correction 14).
- **Events:**
  - `CastOutcome` gains `warded: number`: the points the ward stopped (0 when none). `damage` is what was dealt after the ward.
  - `StatusTickEvent` gains `warded: number`, the same way.
  - `CastEvent` gains `drained: number`: the hit points the caster regained by `drain`. It is the floor of `drain` × the damage dealt to all the cast touched, no more than the caster had lost. It is 0 for any other spell.
- **Log:**
  - A warded outcome adds `(warded N)` after its damage, as in "HITS Salamander for 0 dmg (warded 9)" and "Goblin takes 1 from poison (warded 2).".
  - A drain adds "and drains N".
- `LOG_SCHEMA_VERSION` 18 → 19.

### Contract C3: monster spells (produced here, copied from the index)

```ts
// src/combat/spells.ts
export const SPELL_IDS = [/* today's seventeen, unchanged */] as const  // the heroes' spells: the spell tree, perks and worldCasting read it
export type HeroSpellId = (typeof SPELL_IDS)[number]
export const MONSTER_SPELL_IDS = ['lightning_bolt', 'drain_life', 'curse', 'web', 'dark_shield'] as const
export type MonsterSpellId = (typeof MONSTER_SPELL_IDS)[number]
export type SpellId = HeroSpellId | MonsterSpellId
/** Every spell, the heroes' first: the order a stat block's `magic.spells` keeps. */
export const ALL_SPELL_IDS: readonly SpellId[]
// STATUS_IDS gains 'cursed' and 'webbed'.
```

| Spell | School | Target | Shape, range, radius | Mana | AP | Effect | Element |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lightning Bolt (`lightning_bolt`) | offence | area | line, 6 | 8 | 5 | 4d6 | lightning |
| Drain Life (`drain_life`) | offence | foe | range 5 | 6 | 4 | 3d6, `drain: 0.5` | — |
| Curse (`curse`) | offence | foe | range 5 | 5 | 4 | lays Cursed, 3 turns | — |
| Web (`web`) | offence | area | burst, range 4, radius 1 | 5 | 4 | lays Webbed, 2 turns, no damage | — |
| Dark Shield (`dark_shield`) | support | self | 0 | 4 | 2 | lays Shielded, 3 turns | — |

All but Dark Shield are hostile. The mana and AP are first values (correction 11).

| Status | Mark, colour | Effect |
| --- | --- | --- |
| Cursed (`cursed`) | `K`, a dark purple | −15 to hit (weapon and spell) and −5 armour class |
| Webbed (`webbed`) | `W`, a pale grey | −4 action points |

- Every `Record<SpellId, …>` gains entries for the monster spells: `SPELLS`, and `SPELL_LOOKS` in `battleEffects.ts`.
- Perks, the spell tree, creation and `worldCasting` keep reading `SPELL_IDS`. Where they name a spell they take `HeroSpellId`, so no hero can learn a monster spell.

### Contract C6: the policy, step 03's part (produced here, copied from the index)

`aggressive`'s order becomes: heal, guard, hostile area spell, Bless, Sleep, **Curse (03)**, damaging spell of one foe, **the best strike (04, 05)**, **a status area (05)**, closing in. Only the Curse rule is new in this step; the best strike and the status area come in steps 04 and 05.

- Wards lower a cast's score: `strikeCast` ranks by `warded(mean damage)`.
- Drain Life goes through `strikeCast`.
- Lightning Bolt and the Web spell go through `areaCast`. Web needs only one foe not already Webbed, and no ally.
- Dark Shield goes through `guardCast`, after Shield.
- Curse is cast on the foe in range with the most hit points that is not already Cursed, while two foes or more stand.
- With no ward and no monster spell in play, every choice is today's.

## 3. Dependencies and prerequisites

- **Step 02 must be done.** It produces contract C1, which Lightning Bolt (a line) needs:

  ```ts
  // src/grid/hex.ts (from step 02)
  export type AreaShape = 'burst' | 'cone' | 'line'
  export function areaOf(shape: AreaShape, origin: Hex, aim: Hex, range: number, radius = 0): Hex[]
  // src/engine/battleEngine.ts (from step 02)
  export interface AreaSpec { shape: AreaShape; range: number; radius?: number }
  export function areaTouches<U extends Placed>(units: readonly U[], caster: Placed, area: AreaSpec, at: Hex, hostile: boolean): U[]
  ```

  - `Spell` has `shape?: AreaShape`, read only when `target` is `'area'`; left out means `'burst'`.
  - `castTouches` (signature unchanged) uses `areaTouches` for an area spell, with `{ shape: spell.shape ?? 'burst', range: spell.range, radius: spell.radius }`.
  - **The legal aims of an area spell:** a burst as today (on the board, within `range`); a cone or line on the board at distance 1 to `range`. A hostile area must touch a standing foe.
  - `BattleScene.markCast` and `showCast` draw an area with `areaOf`, so a line spell already shows its hexes.
- **Step 01's baseline** (in the index and step 01's record): the campaign summary this step must reproduce exactly.
- **Existing code (inspected at `51cecb5`):**
  - `src/combat/spells.ts`: `SPELL_IDS`, `SpellId`, `SPELLS`, `STATUS_IDS`, `STATUSES` (`StatusRule` with `tick`, `tickName`), `Spell`.
  - `src/combat/combat.ts`: `CombatantStats`, `sameCombatStats`.
  - `src/engine/battleEngine.ts`: `cast` (hostile outcomes rolled with `rollToHit` then `rollHitDamage`), `startTurn` (status ticks), `CastOutcome`, `CastEvent`, `StatusTickEvent`, `hostileOutcome`, `describeCast`, `formatEvent`, `LOG_SCHEMA_VERSION = 18`.
  - `src/engine/policies.ts`: `healCast`, `guardCast`, `areaCast`, `blessCast`, `sleepCast`, `strikeCast`, `reach`, `manaReserve`.
  - `src/character/perks.ts`: `spellPerk`, `spellPerkOf(spell: SpellId)`, `knownSpells`, the `spell?: SpellId` field of a perk.
  - `src/character/worldCasting.ts`, `src/scenes/spellMenu.ts`, `src/scenes/perkTree.ts`, `src/scenes/battleEffects.ts` (`SPELL_LOOKS: Record<SpellId, SpellLook>`, `castOutline`), `src/scenes/sounds.ts`.
  - `scripts/simulate.ts` `Tally`: reads `CastOutcome.damage` and `StatusTickEvent.damage`. Both stay "damage dealt", so the tally needs no change.
- **Consumers of this step's output:**
  - Step 05 uses `Element`, `warded` and `CastOutcome.warded` for area abilities.
  - Step 06 uses `SPELL_LOOKS` and the log lines.
  - Step 08 gives the Salamander `wards: { fire: 99 }`.
- **No blockers.**

## 4. Scope and implementation guidance

### 4.1 Elements and wards (`src/combat/combat.ts`, `src/combat/spells.ts`)

- Add `ELEMENTS`, `Element`, `CombatantStats.wards` and `warded` as in C2. `combat.ts` imports nothing new from `spells.ts` beyond what it already does (`spells.ts` imports `Element` as a type from `combat.ts`).
- Extend `sameCombatStats` so that `{ fire: 0 }` and no wards compare equal, and any other difference in a ward does not.
- Set `element` on Flame Arrow, Fireball, Frost Blast, Acid Arrow and Death Cloud, and on the `corroded` and `poisoned` status rules. Leave Magic Arrow and the rest without one.

### 4.2 The engine (`src/engine/battleEngine.ts`)

- **Hostile cast:** in `cast`, after `rollHitDamage` (a critical already doubled), deal `warded(rolled, spell.element, effectiveStats(unit))`. Set the outcome's `damage` to what was dealt and `warded` to the difference. A friendly cast's outcomes, and a miss or an image, have `warded: 0`. Do not draw the RNG any differently: the ward is arithmetic after the roll.
- **Status after a ward:** lay the status on a hit (not an image) that leaves the unit standing, as today, even if the ward stopped everything (correction 14). Waking still needs damage dealt > 0.
- **Status ticks:** in `startTurn`, roll the tick as today, then apply `warded` with the status rule's `element`. The `StatusTickEvent` records the damage dealt and `warded`. A tick warded to 0 does not wake a sleeper.
- **Drain:** for a spell with `drain`, after its outcomes, heal the caster `floor(drain × total damage dealt)`, capped at what the caster had lost, and record it as `CastEvent.drained`. Every other cast records `drained: 0`. If the caster's area touched the caster and felled it, it drains nothing.
- **New statuses:** add `cursed` and `webbed` to `STATUS_IDS` and `STATUSES` per C3. They use only existing `StatusRule` keys (`toHit`, `armorClass`, `actionPoints`), so `effectiveStats`, `apAfterStatuses` and `layStatus` need no change. Pick colours that read on the nameplate beside today's.
- **Monster spells:** add `MONSTER_SPELL_IDS`, `HeroSpellId`, `MonsterSpellId`, the widened `SpellId` and `ALL_SPELL_IDS`, and the five `SPELLS` entries per C3, each with a one-line `description` in the style of today's. Lightning Bolt sets `shape: 'line'`. Its legality and touches come from step 02's rules without new engine code. Dark Shield is a `self` spell that lays `shielded`.
- **Log** (`hostileOutcome`, `describeCast`, `formatEvent`):
  - append ` (warded N)` to a hit's damage text when `warded > 0`;
  - append it to a tick's line ("Goblin takes 1 from poison (warded 2).");
  - add "and drains N" to a cast with `drained > 0`.
  - Keep every line that has no ward and no drain byte-for-byte as today.
- **Schema:** `LOG_SCHEMA_VERSION` 18 → 19, and its test.
- The comment over `magic.spells` in `CombatantStats` becomes "In `ALL_SPELL_IDS` order".

### 4.3 Keeping monster spells away from heroes

- `src/character/perks.ts`: `spellPerk`, `spellPerkOf` and the perk's `spell` field take `HeroSpellId`. The spell tree is built from `SPELL_IDS` only, as today.
- `knownSpells` may keep returning `SpellId[]` or narrow to `HeroSpellId[]`; either way it can return only hero spells.
- `worldCasting.ts`, `spellMenu.ts`, `perkTree.ts` and creation keep iterating `SPELL_IDS`. Fix whatever the type widening breaks with the narrowest type that compiles, never by adding monster spells to a hero list.
- `src/scenes/battleEffects.ts`: add a `SPELL_LOOKS` entry for each monster spell:
  - Lightning Bolt: a pale yellow dart;
  - Drain Life: a dark red dart;
  - Curse and Web: clouds or rings in purple and grey;
  - Dark Shield: the support ring in a dark blue.

  `castOutline` and `sounds.ts` already work by `hostile` and `school`.

### 4.4 The policy (`src/engine/policies.ts`)

- **`strikeCast`:** rank by `warded(mean(damage), spell.element, target)` instead of the raw mean, keeping today's tie-break (then the weaker foe). This takes Drain Life with no other change.
- **`areaCast`:** keep today's rule (the hostile area spell touching the most foes, two at least, and no ally) for every spell but Web. The Web *spell* (status-only, `web`) qualifies with one foe or more not already Webbed and no ally. Lightning Bolt goes through the rule as is.
- **`guardCast`:** after Mirror Image and Shield, Dark Shield when the unit is not already Shielded.
- **New `curseCast`**, between `sleepCast` and `strikeCast`: Curse on the foe in range with the most hit points that is not already Cursed, while two foes or more stand, within the mana reserve as the others are.
- **`reach`:** unchanged. A damaging spell of one foe already counts, which now includes Drain Life.
- Update the doc comment over `aggressive` for the new rules.

### 4.5 Exclusions

- No abilities, routines, recharge or `AbilityEvent` (steps 04 and 05).
- No stat block gains a ward or a monster spell in this step. Tests build their own blocks.
- No hero wards or weapon on-hit damage (stage 4).
- No scene work beyond `SPELL_LOOKS` and type fixes (step 06).
- `SAVE_VERSION` is unchanged. `CombatantStats` lives in the snapshot, but a missing `wards` reads as none, and the map does not change.
- **CLAUDE.md:** update only the lines this step makes wrong or incomplete. These are the `combat/` bullet (elements, wards, `warded`, monster spells beside `SPELLS`), the rules of casting (wards on casts and ticks, drain, Cursed and Webbed among the statuses) and the policy's sentence in the `policies.ts` bullet. Step 09 does the stage's full pass.

## 5. Verification

- **Tests first** where they pin behaviour; add to the existing files:
  - `src/combat/combat.test.ts`:
    - `warded`, including the floor of 0 and no element;
    - `sameCombatStats` with wards (a missing key equals 0).
  - `src/combat/spells.test.ts`:
    - `MONSTER_SPELL_IDS` and `SPELL_IDS` are disjoint;
    - `ALL_SPELL_IDS` is the two in order;
    - every id has a `SPELLS` entry;
    - the elements of today's spells and statuses are as in C2.
  - `src/character/perks.test.ts`: no perk teaches a monster spell, and the spell tree lists no monster spell.
  - `src/engine/battleEngine.test.ts`, with scripted RNGs and test stat blocks:
    - a warded hit records `damage` dealt and `warded` stopped;
    - a ward of 99 stops a Fireball and Seared is still laid;
    - a poison tick is warded, and one warded to 0 does not wake a sleeper;
    - Drain Life heals the caster by half the damage dealt, capped at what it lost, with `drained` recorded;
    - Web lays Webbed and the webbed unit's AP is 4 less on its next turn;
    - Curse lowers to-hit by 15 and armour class by 5;
    - Lightning Bolt touches a line of 6 hexes, both sides;
    - Dark Shield lays Shielded;
    - the log lines with `(warded N)` and "drains";
    - `LOG_SCHEMA_VERSION` is 19.
  - `src/engine/policies.test.ts`:
    - of two equal foes in range, `strikeCast` picks the one without a ward;
    - a caster knowing Drain Life uses it as a strike;
    - Web needs one unwebbed foe and no ally;
    - Curse picks the healthiest uncursed foe while two stand;
    - Dark Shield is cast when pressed and not already Shielded.
  - Scene helper tests (`battleEffects.test.ts`) still pass with the new `SPELL_LOOKS` entries.
- **Quick checks:** `npm run -s typecheck` and `npx vitest run --project domain` locally.
- **Gate:** `make test` passes.
- **The guard (identical):** `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"` in podman. Its printed summary must be identical to step 01's, line for line. Never run two `make simulate` at once. A difference means a draw or a choice changed; find it and fix it, don't explain it away.

## 6. Completion criteria

- [ ] C2 and C3 are implemented as written: `Element`, `ELEMENTS`, `wards`, `warded`, `Spell.element` and `drain`, `StatusRule.element`, `CastOutcome.warded`, `StatusTickEvent.warded`, `CastEvent.drained`, the five monster spells, Cursed and Webbed, `HeroSpellId`, `MonsterSpellId` and `ALL_SPELL_IDS`.
- [ ] No hero path (perks, the spell tree, creation, `worldCasting`) can reach a monster spell, and a test says so.
- [ ] The policy's step 03 rules from C6 are in, with tests.
- [ ] `LOG_SCHEMA_VERSION` is 19; `SAVE_VERSION` is still 13.
- [ ] `make test` passes.
- [ ] The campaign summary is identical to step 01's (record both runs' key figures, or say "identical", in the execution record).
- [ ] The CLAUDE.md lines this step makes wrong are updated.
- [ ] Committed on the current branch once tests pass, without pushing, the message ending with the repo's `Co-Authored-By` line.
- [ ] The index's step 03 row is set to `done` with the commit. Any contract this step had to change is amended in the index, marked "step 03".

## Execution record

**Status:** done (commit: see the index row; the orchestrator fills in the hash).

**What was built**
- `combat.ts`: `ELEMENTS`, `Element`, `CombatantStats.wards`, `warded`; `sameCombatStats` compares wards (a missing key as 0). The `magic.spells` comment reads "In `ALL_SPELL_IDS` order".
- `spells.ts`: `HeroSpellId`, `MONSTER_SPELL_IDS`, `MonsterSpellId`, the widened `SpellId`, `ALL_SPELL_IDS`; `Spell.element` and `drain`; `StatusRule.element`; elements on Flame Arrow, Fireball (fire), Frost Blast (frost), Acid Arrow and Corroded (acid), Death Cloud and Poisoned (poison); the five monster spells per C3 (Web sets `shape: 'burst'` explicitly, Lightning Bolt `'line'`); Cursed (`K`, 0x8a3cb8) and Webbed (`W`, 0xc8c8c0).
- `battleEngine.ts`: `warded` after `rollHitDamage` on each hostile outcome and after each tick's roll (no draw added, moved or dropped); `CastOutcome.warded`, `StatusTickEvent.warded`, `CastEvent.drained`; drain heals a caster still standing, `floor(drain × Σ damage dealt)`, capped at what it lost; the log's " (warded N)" (a hit warded to 0 now prints "HITS X for 0 dmg (warded N)") and " and drains N"; `LOG_SCHEMA_VERSION` 19.
- Hero paths narrowed to `HeroSpellId`: `perks.ts` (`Perk.spell`, `spellPerk`, `spellPerkOf`, `knownSpells`), `worldCasting.ts` (`worldSpells`, `castOnWorldMap`), `party.ts` (`autoHeal`'s helper), `InventoryScene.ts` (world casting fields).
- `battleEffects.ts`: `SPELL_LOOKS` for the five monster spells.
- `policies.ts`: `strikeCast` ranks by `warded(mean)` against the target; `areaCast` scores Web by foes touched not yet webbed (one suffices), every other hostile area as before (two foes or more); `guardCast` adds Dark Shield after Shield while not shielded; new `curseCast` between `sleepCast` and `strikeCast`; the doc comment over `aggressive`.
- CLAUDE.md: the `combat/` bullet, the rules of casting, the `policies.ts` bullet.

**Tests added**: `combat.test.ts` (`warded`, wards in `sameCombatStats`); new `spells.test.ts` (ids disjoint, `ALL_SPELL_IDS` order, `SPELLS` and `STATUSES` complete, elements, the monster spell table, Cursed and Webbed); `perks.test.ts` (perks teach every hero spell and no monster spell); `perkTree.test.ts` (the spell tree draws no monster spell); `battleEngine.test.ts` (warded hit and its line, a ward after a critical, Fireball stopped whole and Seared laid, other elements untouched, warded and unwarded ticks and their lines, a sleeper not woken by a tick warded to 0, Drain Life with its cap, miss and line, Web's AP, Curse's to-hit and AC, Dark Shield, Lightning Bolt's line of six over both sides, its legal aims through `legalActions` — 1 to 6 hexes, the caster's own hex and 7 hexes refused, by `previewCast` and `step` too — and a lightning ward, schema 19); `policies.test.ts` (ward-aware strike and spell choice, Drain Life as a strike, Lightning Bolt on two foes, Web's rule, Curse's rule, Dark Shield). Existing fixtures gained `warded: 0` / `drained: 0` (`simulate.test.ts`, `battleEffects.test.ts`, `eventSchedule.test.ts`, `sounds.test.ts`) and the schema assertion 18 → 19.

**Checks run**
- `npm run -s typecheck`: clean. `npx vitest run --project domain`: 876 passed.
- `make test`: 69 files, 885 tests passed.
- `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`: the summary from the "Simulated ..." line on is **identical** to step 01's (diffed line for line, 43 lines): 243 of 500, 281 days, 19.0 battles.
- `SAVE_VERSION` unchanged at 13.

**Deviations and notes for later steps**
- None from the contracts. Web's `shape: 'burst'` is written out though "left out" would mean the same.
- `strikeCast` keeps today's floor (`-Infinity`), so a caster whose every damaging spell is warded to 0 still casts one; `reach` does not look at wards either, so such a caster holds at its spell's range. No unit has a ward until step 08 (the Salamander's fire 99, where the heroes' Flame Arrow and Fireball meet it); step 09 should watch for a mage wasting Flame Arrows on the Salamander.
- `BattleScene.showCast` refreshes the hit points of the units a cast touched, not the caster's after a drain; no kind casts Drain Life yet. Step 06 should refresh the caster's bar when `drained > 0`.
