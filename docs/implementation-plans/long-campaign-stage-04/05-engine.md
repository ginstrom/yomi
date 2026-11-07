# Step 05: The engine

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-04-runes.md) (§2 "The engine", §4 "In battle", §6 `battleEngine.test.ts`) · [Reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.6, §5.3 · [Stages index](../../designs/long-campaign/index.md) ("Versions")

**Difficulty:** judgement-heavy. This step changes the battle rules and the log format, so the engineer and the reviewer use the session's model (opus / opus).

## 1. Objective

Make a weapon's on-hit effects work in battle:
- flat elemental bonus damage after resistance, warded and not doubled by a critical;
- on-hit statuses (Seared, Chilled, Poisoned);
- Life healing for the wielder;
- the Dawn rune's bane, which applies only against units that regenerate or are the blight's own.

Record all of it on the attack event, show it in the log line, count it in the aggressive policy's harm and in the simulator's tally, and raise `LOG_SCHEMA_VERSION` to 23. No battle without on-hit effects may change in any way.

## 2. Requirements and context

- **Design S4-R5:** on-hit bonus damage and statuses, Life healing, and hero wards (the wards already work in the engine through `warded`; step 04 derives them for heroes).
- **Design §2 "The engine":**
  - bonus damage comes on a hit, after resistance, warded, and is not doubled by a critical;
  - on-hit statuses are laid after the damage;
  - Life healing is applied;
  - `AttackEvent` gains `bonus` and `healed`;
  - Dawn's bane applies to kinds with regeneration or the blight's own (the Horror).
- **Design §4:** "HITS Troll for 8 dmg +1 fire". At rank 3 the Ember rune lays Seared, and the troll stops regenerating. A hero's fire ward of 2 (an Ember rune in armour) takes 2 off the Salamander's Fire Spit, and a poison ward (Venom) 2 off a Giant Spider's poison tick; the engine already wards these through `warded` once the hero's stats carry `wards`.
- **Corrections from the index this step relies on:**
  - **2.** On-hit bonus damage is flat and draws nothing. "Rolled on a hit" means "applied only on a hit". No on-hit effect draws from the battle RNG, so a battle without runes draws exactly as before. `AttackEvent.bonus[].rolled` is the bonus before the ward.
  - **3.** `CombatantStats.blightborn?: true`, set on `BLIGHT_HORROR_STATS`. A bane effect applies against a unit whose stats have `regeneration > 0` or `blightborn`. Its element is blight, so a blight ward takes it down.
  - **5.** `AttackEvent.damage` stays the weapon's damage through resistance. The bonus is in `bonus[]`; the hit points lost are `damage + Σ bonus[].damage`; `defenderHpAfter` is what is left after both. On-hit statuses go in a new `onHitStatuses`; a routine strike's own `status` is unchanged. Code that adds up `damage` (the simulator's tally, the engine's `wake`) uses the total.
  - **12.** The aggressive policy's `expectedHarm` adds the chance to hit times the warded, bane-filtered on-hit damage. It changes nothing until a unit has `onHit`.

### Contract C5 (copied unchanged from the index)

```ts
// src/engine/battleEngine.ts (existing file); LOG_SCHEMA_VERSION 22 → 23
export interface AttackBonus {
  element?: Element
  bane?: true
  /** The on-hit damage before the defender's ward. */
  rolled: number
  /** What came through the ward: max(0, rolled − ward). */
  damage: number
}
// AttackEvent gains:
/** One per on-hit entry with damage that applied (a bane only where baneApplies), on a hit that struck no image; empty otherwise. */
bonus: AttackBonus[]
/** On a hit that struck no image, by a weapon with an on-hit heal: hit points the attacker regained (0 at full health); absent otherwise. */
healed?: number
/** The on-hit statuses laid, as they stand after; absent if none. */
onHitStatuses?: ActiveStatus[]
// `damage` is unchanged: the weapon's damage through resistance (correction 5). The defender loses damage + Σ bonus[].damage.
```

**Order on a hit that strikes no image:**
1. The weapon's damage, as today (the same draws).
2. Each on-hit entry with `damage > 0`, in order, skipping a bane entry unless `baneApplies(defender stats)`. Its damage is `warded(entry.damage, entry.element, defender effective stats)`. A critical does not double it.
3. The defender loses the total.
4. The attacker heals the sum of the entries' `heal`, up to its maximum (`healed`).
5. The routine strike's own status, as today. Then each on-hit status, if the defender still stands: an `onCrit` status only on a critical. They are laid with the existing `layStatus`.
6. Then `imagesSpent`, `wake(target, total)` and `fell`, as today.

- This holds for every attack, free attacks included.
- No step draws from the RNG.
- `BLIGHT_HORROR_STATS` gains `blightborn: true`. `foeAtLevel` keeps it, since it spreads the base.

**The log line** (`formatEvent`): after `for N dmg` and the armour note:
- each bonus with damage > 0 as ` +<damage> <element>`, and ` (warded <w>)` when the ward took some;
- the statuses with the existing laid phrase;
- then `<Attacker> heals <n>.` when `healed > 0`.

For example: "HITS Troll for 8 dmg (armour stops 1) +1 fire, seared."

**The policy** (`src/engine/policies.ts`, `expectedHarm`, correction 12): it adds `hitChance × Σ` of the warded, bane-filtered on-hit damage.

**The simulator's tally** (`scripts/simulate.ts`, `Tally.add`):
- an attack's damage is `damage + Σ bonus[].damage`;
- `healed` counts as the side's healing;
- each on-hit status counts as one of the side's statuses laid.

### What this step consumes from C2 (produced by step 03)

```ts
// src/combat/combat.ts (step 03)
export interface OnHit {
  /** Flat damage added after resistance, less the defender's ward of `element`; 0 for an effect that only heals or lays. */
  damage: number
  element?: Element
  /** Only against a unit with regeneration or `blightborn` (the Dawn rune). */
  bane?: true
  /** Laid on the defender after all the damage, if it still stands: on every hit, or with `onCrit` on a critical only. */
  status?: StatusLaid
  onCrit?: true
  /** Hit points the wielder regains on a hit, up to its maximum (Life). */
  heal?: number
}
// CombatantStats gains:
onHit?: readonly OnHit[]           // the main hand's (step 04 derives it; step 05 resolves it)
blightborn?: true                  // the blight's own: a Dawn rune's bane applies (correction 3)
// sameCombatStats compares onHit (deeply, in order) and blightborn.
export function baneApplies(stats: CombatantStats): boolean   // (stats.regeneration ?? 0) > 0 || stats.blightborn === true
```

The rune values a test may need (C1, rank 1 / 2 / 3 / 4):
- Ember: onHit `{ damage: 1/2/3/5, element: 'fire' }`, from rank 3 with `status: { id: 'seared', turns: 1 }`.
- Rime: `{ damage: 1/2/3/5, element: 'frost' }`, from rank 3 with `status: { id: 'chilled', turns: 1 }, onCrit: true`.
- Venom: `{ damage: 1/2/3/4, element: 'poison' }`, from rank 2 with `status: { id: 'poisoned', turns: 3 }, onCrit: true`.
- Life: `{ damage: 0, heal: 1/1/2/3 }`.
- Dawn: `{ damage: 2/3/5/7, element: 'blight', bane: true }`.

Tests in this step build `CombatantStats` with `onHit` directly. They do not need step 04's derivation or an item.

### Shared constraints (from the index)

- **The gate.** `npm test` (`tsc && vitest run`) passes before the commit (local Node 26: `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or `make test`).
- **Determinism.** No new, dropped or reordered draw of the battle or world RNG. The guard's summary must be identical to step 01's.
- **Versions.** `LOG_SCHEMA_VERSION` goes from 22 to **23** here. `SAVE_VERSION` is step 04's; do not touch it. `snapshot()`/`restore` need no change, as the events carry the new fields.
- **The simulator.** Give each run its own `--out` under `logs/` (gitignored; never commit a log). Never run two `make simulate` at once.
- **Commits.** One commit for this step on `long-campaign-stage-04`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
- **Docs.** Update the CLAUDE.md lines this change makes wrong (below).

## 3. Dependencies and prerequisites

- **Step 03 (done before this step starts):** `OnHit`, `CombatantStats.onHit` and `blightborn`, `baneApplies` and `sameCombatStats`'s new comparisons, all in `src/combat/combat.ts`. If step 03 left `baneApplies` or the `sameCombatStats` comparisons out, add them here with their tests in `combat.test.ts` and note it in the record.
- **Step 01:** the guard's full summary, in step 01's execution record, to compare with.
- **Runs alongside step 04** (`character.ts`, `gameState.ts`, `save.ts`, `debugCommands.ts`). This step's files are `battleEngine.ts`, `policies.ts`, `combat.ts` (the Horror's flag only), `scripts/simulate.ts` (`Tally` only) and their tests. Do not edit step 04's files. Each step edits only its own lines of CLAUDE.md, and the second to commit rebases its CLAUDE.md edit on the first.
- **Consumed by later steps:**
  - step 08 reads `AttackEvent.bonus` for the floating text (`bonusText`) and relies on `formatEvent`'s line;
  - step 10's simulator relies on the tally counting the bonus, healing and statuses;
  - step 11 runs check 2 (`'iron_sword@3#ember3'` against the Troll Lair), which needs Seared to stop regeneration.

## 4. Scope and implementation guidance

**Existing code (inspected at `7d32a0a`):**
- `src/engine/battleEngine.ts`:
  - `private attack(actor, target, apCost, strike?)` (around line 1361). It rolls `rollToHit(attacker, defenderAc, this.rng, bonus)`, then `strikeImage(target)` on a hit, then `rollHitDamage(dice, roll.critical, this.rng)` and `damageThrough(rolled, effectiveResistance(attacker, defenderResistance))`. It takes the hit points, lays the strike's status with `layStatus` when the target still stands, records the `AttackEvent`, and then pushes `imagesSpent(target)`, `wake(target, damage)` and `fell(target)`. Every attack, free attacks and routine strikes included, passes through it.
  - `AttackEvent` (around line 247);
  - `formatEvent`'s `'attack'` case (around line 1759);
  - `LOG_SCHEMA_VERSION = 22` (line 41);
  - regeneration as a side's turn begins (around line 1037), which `stopsRegeneration` statuses (Seared, Corroded) already stop.
- `src/combat/combat.ts`: `warded(damage, element, stats)`, `BLIGHT_HORROR_STATS`, and `foeAtLevel`, which spreads `...base`.
- `src/engine/policies.ts`: `expectedHarm(state, self, target, dice?)` (around line 236).
- `scripts/simulate.ts`: `Tally.add`, whose `'attack'` case adds `event.damage`.

**Changes:**
1. **`AttackBonus` and the `AttackEvent` fields,** exactly as C5. `bonus` is always present (empty on a miss, an image or no on-hit damage). `healed` is set only on a hit that struck no image by a weapon whose on-hit entries have a `heal`. `onHitStatuses` is set only when at least one status was laid.
2. **`attack()`.** After the weapon's damage, follow C5's order. Read the on-hit entries from the attacker's stats (`effectiveStats(actor).onHit`, or `actor.stats.onHit`; statuses do not change it). Ward with the defender's effective stats, as casts do. `baneApplies` reads the defender's stats (a Seared troll still counts as regenerating, as its `regeneration` stat is unchanged). Take the total from the defender's hit points in one subtraction (floored at 0). Heal the attacker within `stats.maxHp`. Lay the strike's status, then the on-hit ones in entry order, only if the defender still stands and, for `onCrit`, only on a critical. Pass the total to `wake`. Draw nothing from `this.rng`.
3. **`BLIGHT_HORROR_STATS.blightborn = true`.** Check the yardstick test in `encounters.test.ts` still passes (a flag adds nothing to its fields).
4. **`formatEvent`.** As C5. Keep a hit with no bonus, heal or on-hit status reading exactly as today. Use the existing laid phrase for each on-hit status, after the strike's.
5. **`expectedHarm`.** Add `hitChance(attacker, defender.ac, bonus) × Σ warded(entry.damage, entry.element, defender)` over the attacker's on-hit entries with `damage > 0`, skipping a bane entry unless `baneApplies(defender)`. A unit without `onHit` scores exactly as today.
6. **`Tally.add` in `scripts/simulate.ts`.** As C5. Touch nothing else in `simulate.ts`; step 10 owns the rest.
7. **`LOG_SCHEMA_VERSION` to 23.**
8. **CLAUDE.md.**
   - In the engine's bullet ("Events are the engine's only output…"), add that an attack on a hit adds its weapon's on-hit effects (flat, after resistance, warded, not doubled by a critical, no draws), recorded in `bonus`, `healed` and `onHitStatuses`, and that `damage` stays the weapon's.
   - In the rules of the battle system, where resistance and spells are described: on-hit damage owes nothing to resistance but is warded. Seared from an Ember rune stops regeneration. A bane applies only against `regeneration` or `blightborn` (the Horror).
   - In the policy bullet, add that the best strike counts the on-hit bonus.

**Out of scope:**
- deriving `onHit`, wards or `maxHp` from gear (step 04);
- runes, items and ids (step 03);
- the floating text and the battle screen (step 08);
- the rest of the simulator (step 10);
- any previewAttack change (the nameplate's "−N dmg" stays the resistance).

## 5. Verification

1. **`src/engine/battleEngine.test.ts`** (new cases, with stats built directly and a scripted or seeded RNG):
   - bonus on a hit only: a miss and an image record `bonus: []`, no heal and no status;
   - not doubled by a critical: a critical's `bonus[].damage` equals a plain hit's;
   - ignoring resistance: a defender with resistance 5 still takes the full bonus;
   - warded: a defender with `wards.fire: 2` takes `max(0, 3 − 2)` of an Ember-3 bonus, with `rolled` 3 and `damage` 1, and the log line says `(warded 2)`;
   - the total: `defenderHpBefore − defenderHpAfter` is `damage + Σ bonus[].damage` (floored at 0), and a sleeper woken by bonus damage alone is woken;
   - Ember 3 lays Seared: an attacker with `onHit: [{ damage: 3, element: 'fire', status: { id: 'seared', turns: 1 } }]` hits a Troll (`TROLL_STATS`, `regeneration` 3); as the Troll's side's turn begins, no `regenerate` event is logged for it;
   - Rime or Venom `onCrit`: the status is laid on a critical and not on a plain hit;
   - Life heals: an attacker with `onHit: [{ damage: 0, heal: 2 }]` at 1 below its maximum records `healed: 1`, and at full health `healed: 0`; a miss records no `healed`;
   - bane: a Dawn entry deals its damage to a Troll and to a unit with `blightborn: true`, and records nothing in `bonus` against a Goblin;
   - a hero ward against a Salamander spit: a hero with `wards: { fire: 2 }` takes 2 less from Fire Spit than the same hero without, with the same rolls;
   - determinism: with the same scripted RNG, a battle whose attacker has an on-hit entry draws exactly as many numbers as one without (the scripted RNG runs out at the same point, or a counting wrapper records the same count);
   - `LOG_SCHEMA_VERSION` is 23 and `battle_start` records it;
   - `formatEvent` gives "HITS Troll for 8 dmg (armour stops 1) +1 fire, seared." for such an event (or the same shape with the test's numbers), and an unchanged line for a hit with no on-hit effects.
2. **`src/engine/policies.test.ts`:** of two otherwise equal foes, an attacker with an Ember entry prefers the one without a fire ward; an attacker without `onHit` makes today's choice.
3. **`src/combat/combat.test.ts`:** `BLIGHT_HORROR_STATS.blightborn` is true and survives `foeAtLevel`; `baneApplies` and the `sameCombatStats` comparisons, if step 03 did not test them.
4. **The gate:**

   ```sh
   PATH=/opt/homebrew/opt/node@26/bin:$PATH npx vitest run src/engine src/combat
   PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test
   ```

5. **The guard, identical to step 01's** summary, line for line:

   ```sh
   PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1 --out logs/s4-step05-guard.jsonl
   ```

   No simulated hero carries an on-hit effect yet, so any difference is a bug, for example a draw moved or a tally changed.
6. **In-browser smoke:** `npm run test:browser -- -t battle` passes. The log line of a plain hit is unchanged.

## 6. Completion criteria

- [ ] `AttackBonus`, `bonus`, `healed` and `onHitStatuses` as C5; the order of operations as C5; no new RNG draws.
- [ ] `BLIGHT_HORROR_STATS.blightborn` is true.
- [ ] `formatEvent`, `expectedHarm` and `Tally.add` as C5.
- [ ] `LOG_SCHEMA_VERSION` is 23.
- [ ] The tests of §5 pass, and so does `npm test`.
- [ ] The guard is identical to step 01's, with the run recorded below.
- [ ] CLAUDE.md's engine, battle-rule and policy lines updated.
- [ ] One commit on `long-campaign-stage-04`; step 05's row in the index set to `done` with the commit.

## 7. Execution record

**Built** (one commit, "Stage 4 step 05: the engine"), on top of step 04 (`724a09a`):
- `battleEngine.ts`: `AttackBonus`; `AttackEvent.bonus` (always present), `healed`, `onHitStatuses`; `attack()` resolves the on-hit entries in C5's order from `effectiveStats(actor).onHit`, warding with the defender's effective stats, `baneApplies` on the defender's, one subtraction of the total, the heal within `actor.stats.maxHp`, the strike's status then the on-hit ones while the defender stands; `wake` gets the total. No draw added. `formatEvent` adds ` +N element (warded W)` for each bonus with damage above 0, every status laid (the strike's, then the on-hit ones), then ` <Attacker> heals N.` after the sentence (and after "CRITICAL HIT!"). `LOG_SCHEMA_VERSION` 23.
- `combat.ts`: `BLIGHT_HORROR_STATS.blightborn = true`.
- `policies.ts`: `expectedHarm` = chance × (average hit + `onHitDamage`), the warded, bane-filtered on-hit damage.
- `scripts/simulate.ts` `Tally.add`: the attack's damage plus `bonus[].damage`, `healed` as healing, each on-hit status as a status laid. Nothing else in the file.
- CLAUDE.md: the engine bullet, the battle rules (on-hit damage owes nothing to resistance but is warded; bane; Seared from an Ember rune), the policy bullet.

**Tests:** `battleEngine.test.ts` gains "BattleEngine on-hit effects" (16 cases: a hit only, a miss and an image record nothing; not doubled by a critical; resistance ignored; warded and the "(warded 2)" line, a fully warded entry left out of the line; two entries warded each; the total floored and a fell; a sleeper woken by the bonus alone; Ember III sears a Troll and stops its regeneration, with the line "HITS Troll for 6 dmg (armour stops 1) +3 fire, seared."; Venom and Rime `onCrit`; Life's heal 1, 0 and absent; bane against a regenerator, a blightborn unit and not a goblin, and cut by a blight ward; free attacks; the RNG's draws counted equal with and without on-hit entries; a plain hit's event and line unchanged; schema 23). The old "raises the log schema to 22" case now says 23. `policies.test.ts`: "aggressive with an on-hit weapon" (3 cases). `combat.test.ts`: the Horror is blightborn, also through `foeAtLevel`. `simulate.test.ts`: the tally counts on-hit damage, heal and status from a real engine's events. The hero-ward-against-Fire-Spit case already existed ("cuts a half miss by its ward too", "cuts its element by a ward…"), so none was added. Three scene test fixtures (`battleEffects`, `eventSchedule`, `sounds`) gained `bonus: []`, as the field is required.

**Checks:**
- `npx vitest run src/engine src/combat`: pass.
- `npm test`: 74 files, 1119 tests, pass (tsc clean).
- The guard (`--out logs/s4-step05-guard.jsonl`, tree = step 04's commit plus this step): **identical** to step 01's summary line for line (233 of 500, 9107 battles, every tally value the same), after stripping the log path.
- `npm run test:browser -- -t battle`: 6 files, 17 tests, pass.

**Deviations:** none in behaviour. Choices C5 left open: a fully warded bonus (damage 0) stays in `bonus[]` but is left out of the line, as C5 says "each bonus with damage > 0"; `healed` is present whenever an entry has a `heal` key, even `heal: 0`.

**For later steps:** step 08's `bonusText` reads `bonus[].damage > 0`; step 10's tally already counts runes.
