# Step 20: The special spells

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R8; §4.3 Cryomancer, Healer, Saint; §4.7; §5.2; §5.4 rows Revive, Frozen, Purify, Ice Lance / Holy Light) · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus / opus. Leave the engineer's and the reviewer's model unset. This step adds a new kind of spell target (a fallen ally), brings a unit back from 0 hit points, splits the sleep rule that every helpless check reads, and adds dice to spells by the target's state and kind; a slip in the order of draws or in who counts as standing breaks replays and the refactor guard.

## 1. Objective

The engine casts the six stage-3 spells: **Purify**, **Revive**, **Renew**, **Holy Light**, **Ice Lance** and **Glacial Prison**. `SPELLS` gains them with design §4.3's numbers, `Spell` gains the fields they need (`bane`, `bonusVs`, `cleanse`, `oncePerBattle`, the target `fallen`), and `STATUSES` gains `frozen` (`renewing` came in step 19). Every hostile status is marked `hostile`, and the status rule's `sleep` is split into `helpless` and `wakesOnDamage`, so that Frozen is helpless like Asleep but does not wake when hurt. Asleep behaves exactly as today.

No hero can learn these spells yet: step 21 puts their nodes into `PERKS`. So the refactor guard stays green, unchanged. Monsters' Web and Curse are untouched.

## 2. Requirements and context

- **R8:** the other new mechanics (here the special spells and statuses) work in the engine as design §5.4 states, and battles stay deterministic from their seed.
- **AC6 (R8):** each mechanic of §5.4 has an engine test, and the replay tests still pass. This step covers the Revive, Frozen, Purify and Ice Lance / Holy Light rows.
- **Quality constraints (design §2):** every rule in the Phaser-free domain modules with tests; a battle replays from its seed; new rolls draw as existing ones do; a unit whose stats carry none of the new fields behaves exactly as today. Monsters change only where a status or spell moves.

### The six spells (design §4.3)

| Spell (id) | Path, tier | Asks | School | Effect and cost |
| --- | --- | --- | --- | --- |
| Ice Lance (`ice_lance`) | Cryomancer T3 | Magic 70 | offence | 2d8 frost to a foe within 6, and 2d8 more if it is Chilled, Slowed, Webbed, Asleep or Frozen; 7 mana, 4 AP |
| Glacial Prison (`glacial_prison`) | Cryomancer ★ | Magic 80 | offence | A foe within 5 is **Frozen** for 2 turns; 12 mana, 5 AP |
| Purify (`purify`) | Healer T3 | Magic 55 | healing | Ends every hostile status on an ally within 4 and heals it 1d6; 4 mana, 3 AP |
| Revive (`revive`) | Healer ★ | Magic 75 | healing | An ally within 2 that fell this battle, on a free hex, stands again at a quarter of its maximum hit points (at least 1); 20 mana, 6 AP, once per battle |
| Renew (`renew`) | Saint T3 | Magic 65 | support | Every ally within 2 hexes of the caster is **Renewing** (regains 3 hit points as its turn begins) for 3 turns; 10 mana, 5 AP |
| Holy Light (`holy_light`) | Saint T3 | Magic 70 | offence | 3d6 to a foe within 5, double the dice as bane; 7 mana, 4 AP |

The "Asks" column is for step 21's nodes; it is listed here so the spells' descriptions and tests use the same words. Glacial Prison and Ice Lance are hostile (they roll to hit with the spell skill); Purify, Revive and Renew are friendly (they never miss). Renew is an area of range 0 and radius 2 centred on the caster, as Heal All is.

### Design §5.2 (spells and statuses)

- `Spell` gains these optional fields:
  - `bane: true`: doubles the damage dice against `baneApplies` (Holy Light);
  - `bonusVs: { statuses: StatusId[]; damage: DamageRoll }` (Ice Lance);
  - `cleanse: true`: ends every status whose rule is `hostile` (Purify);
  - `oncePerBattle: true` (Revive);
  - `target: 'fallen'`, a new `SpellTarget`: an ally at 0 hit points that fell this battle, within range, whose hex no standing unit holds (Revive).
- `StatusRule` gains:
  - `hostile: true`, set on every hostile status: asleep, chilled, corroded, poisoned, baned, seared, cursed, webbed and the new taunted, pinned, marked, slowed, frozen;
  - `regen: number`: heals as its side's turn begins, unless a status with `stopsRegeneration` is on it (Renewing; added by step 19);
  - `helpless: true`, which today's `sleep: true` is split into, alongside `wakesOnDamage: true`. Asleep is helpless and wakes on damage. Frozen is helpless and does not wake.

| Id | Name | Mark | Rule |
| --- | --- | --- | --- |
| `frozen` | Frozen | I | hostile, helpless, does not wake on damage |

### Design §5.4 rows (this step)

| Mechanic | Rule |
| --- | --- |
| **Revive** | `canCast` for target `fallen`: an ally with `fallenThisBattle`, hp 0, within range, its hex free, and the spell not in `usedOnce`. On cast: hp = max(1, ⌊maxHp / 4⌋), statuses cleared, ap 0, `reactionReady` false, `fallenThisBattle` kept. Logged as a `CastEvent` outcome with `revived: true`. `checkWinner` is unchanged: a battle ends the moment a side is down, so Revive can only bring back an ally while another still stands. |
| **Frozen** | Helpless as Asleep: no AP, no zone of control, `HELPLESS_BONUS` against it. Damage does not wake it. |
| **Purify** | Ends each `hostile` status on the target (`status_end` reason `cleansed`), then heals. |
| **Ice Lance / Holy Light** | `bonusVs` adds its dice when the target has one of the statuses before the roll. `bane` doubles the dice count against `baneApplies`. |

### Edge cases (design §4.7)

- Revive on a hex now taken by another unit: the cast is illegal.
- A unit revived this battle may fall and be revived again only by another caster, since the spell is once per battle per caster (`usedOnce` is the caster's).

### Decisions from the index (unchanged)

- **2. The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
- **7. Saves.** `SAVE_VERSION` 23 in stage 1 (step 03 raises it; step 05 adds `migrateFrom22`), 24 in stage 2 (step 11), 25 in stage 3 (step 17). Versions 23 and 24 load into the current version with no game migration: `BattleEngine.restore` fills the new `UnitRecord` fields with their defaults. Version 18 goes through `migrateFrom18` then `migrateFrom22`. Between steps 03 and 05, version-22 saves read as unreadable, and so does the version-18 fixture (its migration yields version 22's shape): step 03 changes that test to expect unreadable, and step 05 restores it.
- **8. `LOG_SCHEMA_VERSION`** 25 from step 09 (the first stage-2 step to change an event); steps 10 and 11 change shapes under 25. 26 from step 17; steps 18 to 20 under 26.

### Contracts (copied unchanged from the index)

**C6. Spells and statuses (step 02; extended by 09, 11, 20):**

```ts
// src/combat/spells.ts
// SPELL_IDS gains (step 02): 'frostbite', 'meteor', 'mass_haste', 'lay_on_hands', 'ward', 'web', 'curse'
//   (web and curse leave MONSTER_SPELL_IDS, same ids and numbers); step 20 adds 'ice_lance', 'glacial_prison',
//   'purify', 'revive', 'renew', 'holy_light'
// STATUS_IDS gains 'warded' (02); 'marked', 'slowed', 'pinned' (09; pinned's rule in 11); 'taunted' (10, its rule in 11);
//   'rooted' (11); 'renewing' (19); 'frozen' (20)
// StatusRule gains wardAll?: number (02); immobile?: true (11); regen?: number (19); hostile?: true,
//   helpless?: true, wakesOnDamage?: true replacing sleep (20)
// ActiveStatus gains source?: UnitId (11)
```

| Status | Mark | Rule | Step |
| --- | --- | --- | --- |
| warded | G | wardAll 4 | 02 |
| marked | Y | armour class −10 | 09 |
| slowed | L | action points −3 | 09 |
| taunted | T | −`TAUNT_PENALTY` (25) to hit at any unit but its `source` | 10 (the id, no effect), 11 (the rule) |
| pinned | N | immobile | 09 (the id, no effect), 11 (the rule) |
| rooted | R | armour class +10, resistance +2 | 11 |
| frozen | I | helpless, does not wake on damage | 20 |
| renewing | U | regen 3 | 19 |

Step 19 added `renewing` and `StatusRule.regen`; this step only adds the Renew spell that lays it.

**C7. Spell modifiers and mana (step 04; consumed by 09, 14, 20, 21):**

```ts
// src/combat/combat.ts: CombatantStats.magic gains
magic?: {
  maxMana: number; skill: number; spells: readonly SpellId[]
  power?: { all?: number; fire?: number; frost?: number }   // added to each damaging outcome of its spells, by element, before wards
  healBonus?: number                                         // added to what its heals restore
  extend?: { hostile?: number; friendly?: number }           // turns added to statuses its hostile / friendly spells lay
  friendlyRange?: number                                     // added to the range of a friendly spell aimed at an ally or an area of range > 0
  apDiscount?: { all?: number; heal?: number }               // off a spell's AP (heal: spells with `heal`)
}
// src/combat/spells.ts
export function spellApCost(stats: Pick<CombatantStats, 'magic'>, spell: SpellId): number   // max(min(apCost, 2), apCost − all − heal)
export function spellRange(stats: Pick<CombatantStats, 'magic'>, spell: SpellId): number
// src/character/character.ts
// maxMana = 2 × INT + (level − 1) × ⌊INT / 2⌋ + MANA_PER_TREE_NODE × (nodes in the Mage and Cleric trees) + perks' maxMana + gear's maxMana
//   (for every hero; INT through attributeLevel)
// magic is emitted for a hero that knows a spell (step 09: or an ability with manaCost); each modifier only when non-zero
```

`magic.power` from effects: `all` = spellDamage, `fire` = fireSpellDamage, `frost` = frostSpellDamage. `healBonus` = healBonus. `extend` = hostileExtend / friendlyExtend. `friendlyRange` = friendlyRange. `apDiscount.all` = spellApDiscount, `.heal` = healApDiscount. `deriveCombatStats` also adds `resistance += perkBonus('resistance')`, `ac += perkBonus('shieldAc')` while the off hand holds a shield, `wards[e] += wardAll` for each element and `wards.blight += wardBlight`, and the nodes' `meleeOnHit` to `onHit` while the main hand is melee or bare.

**C13. Stage-3 engine (steps 17–20; consumed by 21–23):**

```ts
// CombatantStats gains (only when non-zero): opportunity?: { toHit: number; damage: number }; rear?: { toHit: number; damage: number };
//   movedToHit?: number; execute?: number; critDamage?: number; manaOnHit?: number; manaRegen?: number
// UnitRecord, UnitSnapshot gain attackedYet: boolean, endured: boolean, refunded: boolean,
//   fallenThisBattle: boolean, usedOnce: SpellId[]   (step 17 adds all five; restore defaults false / [])
// AttackEvent gains counter?: true, ambush?: true, deathblow?: true, apRefunded?: number, manaRestored?: number, endured?: true
// CastOutcome gains revived?: true, endured?: true; StatusTickEvent gains endured?: true
export interface RestoreEvent extends EventBase { type: 'restore'; unit: UnitId; hp?: number; mana?: number; cause: 'renewing' | 'sanctuary' | 'serenity'; source?: UnitId }
  // source: the Sanctuary unit whose aura healed (for "Sera's sanctuary restores 3 to Aldric.")
export interface AuraBonus { ac: number; toHit: number; resistance: number; wardAll: number }
export function auraBonus(units: readonly UnitSnapshot[], unit: UnitSnapshot): AuraBonus
  // best of each aura kind from standing allies in radius: guardian (+5 AC, radius 1, not itself), courage (+5 to hit, 2, not itself),
  // aegis (+2 resistance, +2 wardAll, 2, itself included); two of a kind do not stack
export function statsIn(units: readonly UnitSnapshot[], unit: UnitSnapshot): CombatantStats
  // effectiveStats plus auraBonus; the engine reads the same through its records, and every roll, preview and the policy use it
// LOG_SCHEMA_VERSION = 26 and SAVE_VERSION = 25 (step 17); version 24 loads as is
// Spell gains (step 20): bane?: true; bonusVs?: { statuses: StatusId[]; damage: DamageRoll }; cleanse?: true;
//   oncePerBattle?: true; SpellTarget gains 'fallen'
```

Rules: design §5.4's table, one row per mechanic.

`StatusEndEvent.reason` gains `'cleansed'` in this step (C12: "StatusEndEvent.reason gains 'source_fell' | 'moved' (step 20: 'cleansed')").

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npx vitest run --project domain`; `npm run test:browser` (or `-- -t <name>`) after any scene change.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) must stay green, **unchanged** (decision 2): no simulated hero knows these spells, and Asleep, Web and Curse play exactly as before. A mismatch is a bug in this step.
- **Determinism.** A battle replays from its seed. New rolls draw from the RNG as existing ones do; a cast that rolls nothing draws nothing.
- **Domain first.** Every rule lives in the Phaser-free modules with tests; scenes decide nothing.
- **A node is data.** A new spell of an existing shape is one entry in `SPELLS`.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `.ts` extensions in imports.
- **Commits.** One commit for this step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 20: the special spells". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines this change makes wrong and search it for every name renamed or removed.

## 3. Dependencies and prerequisites

- **Step 17 (done first)** added `fallenThisBattle` and `usedOnce` to `UnitRecord` and `UnitSnapshot` (C13), with `restore` defaulting them, and raised `LOG_SCHEMA_VERSION` to 26 and `SAVE_VERSION` to 25. This step sets and reads those two fields; it raises neither version.
- **Step 19 (done first)** added `RestoreEvent` (cause `'renewing'` among others), `auraBonus` and `statsIn`, and the `renewing` status with `StatusRule.regen` (C6). Rolls and previews in this step read stats through `statsIn`, as step 19 made every roll do.
- **Step 18** routed every damage application through `applyDamage` (Unbreakable). Ice Lance and Holy Light damage goes through it as every spell's does.
- **Step 04** gave `magic.power`, `healBonus`, `extend`, `friendlyRange` and `apDiscount` (C7): Ice Lance is frost (frost power applies once per outcome, before wards); Holy Light has no element (`power.all` only); Purify's heal adds `healBonus`; Glacial Prison's Frozen takes `extend.hostile`, Renew's Renewing `extend.friendly`.
- **Step 11** added `taunted` and `pinned`; **step 09** `marked` and `slowed`. Mark them `hostile` here.
- **Existing code at `50fb4cf`, for reference:**
  - `src/combat/spells.ts`: `Spell`, `SpellTarget = 'foe' | 'ally' | 'self' | 'area'`, `SPELLS`, `STATUSES` (`asleep` has `sleep: true`), `StatusRule`.
  - `src/engine/battleEngine.ts`: casting (`canCast`, `cast`, `castTouches`, `previewCast`, `strikeUnit`, `aftermath`), `fell`, `fellAll`, `checkWinner`, `startTurn`, `countDownStatuses`, `endStatus(unit, status, reason)`, the asleep wake in damage (`reason: 'woke'`), and every reader of `STATUSES[...].sleep` (AP at turn start, zone of control in `reactorsAt`, `HELPLESS_BONUS`).
  - `src/engine/policies.ts`: reads statuses and spells; it must not cast the new spells yet (step 21 adds those steps). Check that its existing branches cannot pick them up by accident (none of today's units knows them).

## 4. Scope and implementation guidance

### 4.1 `src/combat/spells.ts`

- Add the six ids to `SPELL_IDS` (after step 02's additions; they are hero spells) and their `SPELLS` entries with the numbers above. Descriptions in the style of today's ("2d8 frost to a foe within 6, 2d8 more if it is chilled, slowed, webbed, asleep or frozen").
- `Spell` gains `bane`, `bonusVs`, `cleanse`, `oncePerBattle`; `SpellTarget` gains `'fallen'`. Ice Lance's `bonusVs` is `{ statuses: ['chilled', 'slowed', 'webbed', 'asleep', 'frozen'], damage: 2d8 }`.
- `StatusRule`: replace `sleep?: true` with `helpless?: true` and `wakesOnDamage?: true`; add `hostile?: true`. `asleep` becomes `{ ..., helpless: true, wakesOnDamage: true, hostile: true }`. Mark `hostile` on asleep, chilled, corroded, poisoned, baned, seared, cursed, webbed, taunted, pinned, marked, slowed, frozen; on no other.
- Add `frozen` (`Frozen`, `frozen`, mark `I`, an icy colour, `helpless`, `hostile`, no `wakesOnDamage`).
- Any helper that reads `sleep` (here, in `combat.ts`, the policy or a scene helper such as `foeInfo.ts`) moves to `helpless` or `wakesOnDamage` as its meaning is: "no AP / no zone of control / helpless bonus" reads `helpless`; "damage ends it" reads `wakesOnDamage`.

### 4.2 `src/engine/battleEngine.ts`

- **Helpless.** Every rule today keyed on `sleep` keys on `helpless`, and the wake on damage on `wakesOnDamage` (an asleep unit wakes exactly as today, `reason: 'woke'`; a frozen one does not). A tick warded to 0 still wakes no sleeper.
- **`fell`** sets `fallenThisBattle = true` on the unit that falls (it stays true after a revive).
- **Target `fallen`.** `canCast` for such a spell: the target is of the caster's side, hp 0, `fallenThisBattle`, within `spellRange` of the caster (a fallen ally counts as "aimed at an ally" for `friendlyRange`; record this reading in the execution record), no standing unit on its hex, and the spell not in the caster's `usedOnce` when `oncePerBattle`. `legalActions` lists such casts with the fallen unit as `target`, in roster order, as ally casts are listed today. `castTouches` returns the fallen unit for it.
- **Revive's cast.** No roll and no draw. Set hp = max(1, ⌊maxHp / 4⌋) (maxHp from the unit's stats), clear its statuses (without `status_end` events, as falling clears them), ap 0, `reactionReady` false, keep `fallenThisBattle`; push the spell id onto the caster's `usedOnce`. Outcome `revived: true`, with the hit points restored as a heal's outcome records them. `checkWinner` is unchanged; a battle already over cannot be cast in.
- **`oncePerBattle`** generally: a spell so marked is refused for a caster whose `usedOnce` holds it; `usedOnce` is saved in snapshots (step 17 put it there).
- **Purify (`cleanse`).** On the target, end each status whose rule is `hostile`, in the order laid, each with `status_end` reason `'cleansed'`; then heal the spell's dice plus `healBonus`, drawn as today's heal spells draw. Legal on an ally with no hostile status too.
- **`bonusVs` (Ice Lance).** Whether the target has one of the statuses is judged before the roll to hit. On a hit, the bonus dice are rolled right after the spell's own dice, from the same RNG, and doubled with them on a critical; on a miss nothing more is drawn. Then `power`, wards and `applyDamage` as for any damaging spell.
- **`bane` (Holy Light).** Against a target `baneApplies` to, the dice count doubles (3d6 → 6d6) in the one damage roll, so the number of draws grows only against such a target.
- **Glacial Prison.** A hostile spell that lays `frozen` for 2 turns (plus `extend.hostile`) on a hit, as Sleep lays `asleep`. Frozen: no AP as its turn begins, no zone of control, `HELPLESS_BONUS` against it, damage does not end it; it ends on expiry (`reason: 'expired'`) or by Purify.
- **Renew.** A friendly area of range 0, radius 2, laying `renewing` for 3 turns (plus `extend.friendly`) on every ally it touches. Step 19's turn-start restore heals it; check that a Renewing unit regains 3 at its side's turn start through the cast.
- **`previewCast`** gives the odds of the hostile ones as today, the bonus or bane dice reflected wherever it shows damage, and for Revive and Purify the friendly outcome; it uses `spellApCost` and `spellRange` (C7).
- **`formatEvent`**: a short line for a revive ("Sera revives Aldric.") and for a cleanse ("Purify cleanses Aldric."), keeping the existing cast line otherwise; `status_end` with `cleansed` reads "<name> is no longer <adjective>." as an expiry does. Detail goes in the event, not the line.
- The event shapes added here (`'cleansed'`, `revived`, the `fallen` target) are under `LOG_SCHEMA_VERSION` 26 (decision 8); do not raise it.

### 4.3 Exclusions

- No node teaches these spells (step 21). No policy step casts them (step 21: `reviveCast`, `purifyCast`, `supportCast`, `prisonCast`, the strikeCast extensions).
- No scene work: Revive's aim, the marks' drawing and the effects are step 22's. A scene helper that read `sleep` is updated mechanically only.
- Monsters' Web and Curse, and every monster stat block, are untouched.

## 5. Verification

### Tests (in `npm test`)

In `src/combat/spells.test.ts`:

1. The six spells exist with the numbers of §2's table; `SPELL_IDS` holds them; `MONSTER_SPELL_IDS` is unchanged.
2. Exactly the thirteen statuses listed are `hostile`; `asleep` is `helpless` and `wakesOnDamage`; `frozen` is `helpless` and not `wakesOnDamage`; no rule keeps `sleep`.

In `src/engine/battleEngine.test.ts` (scripted RNG):

3. **Asleep unchanged:** an asleep unit still gets no AP, holds no zone of control, is struck with `HELPLESS_BONUS` and wakes on damage (`woke`), as the existing tests say; they pass untouched.
4. **Frozen:** a frozen unit gets no AP, provokes no free attack's zone (it holds none), is struck with `HELPLESS_BONUS`, stays frozen after damage, and ends with `expired` after 2 of its turns; Glacial Prison lays it on a hit and not on a miss, and `extend.hostile` lengthens it.
5. **Revive:** a fallen ally within 2 on a free hex is a legal target, at 0 hit points with `fallenThisBattle`; after the cast hp = max(1, ⌊maxHp / 4⌋) (one test with maxHp 3 giving 1), statuses empty, ap 0, `reactionReady` false; the outcome has `revived: true`; no RNG draw (the scripted RNG is not advanced).
6. **Revive refusals:** a standing unit on the fallen ally's hex makes it illegal; out of range is illegal; the same caster cannot cast it twice in a battle, while a second caster can revive the same unit again; a unit that never fell (hp > 0) is not a target; the spell is in `usedOnce` after a snapshot and restore.
7. **Revive and the winner:** a cast that brings back an ally while another stands keeps the battle going; `checkWinner` ends the battle when the last standing ally falls, with no chance to revive.
8. **Purify:** ends every hostile status on the target, in order laid, with `cleansed`, keeps friendly ones (Blessed, Shielded), then heals the dice plus `healBonus`.
9. **Ice Lance:** against a Chilled (or Slowed, Webbed, Asleep, Frozen) target a hit draws the bonus dice after the spell's own; against an unaffected target it draws only 2d8; a miss draws no damage dice; a critical doubles both; frost `power` and a frost ward apply once.
10. **Holy Light:** 6d6 against a unit with regeneration or `blightborn`, 3d6 otherwise (count the draws).
11. **Renew:** lays `renewing` on every ally within 2 of the caster (the caster included) and no foe; a Renewing unit regains 3 at its side's next turn start through step 19's restore.
12. **Replay:** a scripted battle using each of the six spells replays to identical events from its seed, and survives `snapshot()` / `restore` mid-battle.

The existing replay tests and policy tests pass unchanged.

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run src/combat/spells.test.ts src/engine/battleEngine.test.ts
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run scripts/simulate.test.ts -t "refactor guard"   # green, fixture untouched
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test
```

`npm run test:browser` is not required: this step changes no scene. If a scene helper had to move from `sleep` to `helpless`, run it anyway and record the result.

### Acceptance

- AC6's rows for Revive, Frozen, Purify and Ice Lance / Holy Light each have an engine test that passes.
- The refactor guard is green with its fixture unchanged (`git diff` shows no change to it).

## 6. Completion criteria

- [x] The six spells, the new `Spell` fields, `frozen`, `hostile` and the `helpless` / `wakesOnDamage` split are in `spells.ts`; no reader of `sleep` remains.
- [x] The engine casts all six as §4.2 says; `fallenThisBattle` and `usedOnce` are set and read; `status_end` has `'cleansed'`.
- [x] Tests 1–12 pass; existing tests pass unchanged; the refactor guard is green and its fixture untouched.
- [x] `npm test` passes.
- [x] `CLAUDE.md` updated: the rules of casting (the statuses list gains frozen, the hostile flag, Frozen's helplessness, the `fallen` target and Revive's rule, Purify's cleanse, `bonusVs` and spell `bane`), `spells.ts`'s line (`SPELL_IDS`), and any mention of `sleep` as a status rule.
- [x] One commit, "Skill trees step 20: the special spells", on `skill-trees`, no push.
- [x] The index's step table shows this step `done (<commit>)`.

## 7. Execution record

**2026-11-14, engineer (opus).**

What was built:
- `spells.ts`: the six spells (`SPELL_IDS` now 30, the six last, in C6's order; `ALL_SPELL_IDS` 33); `Spell.bane`, `bonusVs`, `cleanse`, `oncePerBattle`; `SpellTarget` `'fallen'`; `StatusRule.sleep` replaced by `helpless` and `wakesOnDamage`, plus `hostile` on the thirteen statuses; `frozen` (mark I). `spellRange` adds friendly range to a `fallen` spell (**reading recorded:** a fallen ally counts as "aimed at an ally").
- `battleEngine.ts`: `isHelpless` (exported) replaces every `asleep` check of AP, zone of control, reactions and `HELPLESS_BONUS`; waking is generic over `wakesOnDamage` (`wakings`; `StruckOutcome.woke` is now the list of statuses woken); `fellAll` sets `fallenThisBattle`; `canPayFor` refuses a `oncePerBattle` spell in `usedOnce`; `canCast` and `castTouches` handle `fallen`; `cast` does Revive (no draw; hp max(1, ⌊maxHp/4⌋), statuses cleared without events, ap 0, `reactionReady` and `turnReady` false, `endured` and `fallenThisBattle` kept, outcome `revived: true` with `healed` = hp it stands at), Purify's cleanse (statuses ended in order laid; their `status_end` events, reason `cleansed`, are recorded right after the cast event, before the aftermath), `bane` (dice count doubled against `baneApplies`) and `bonusVs` (judged before the roll; on a hit drawn after the spell's own, doubled with them on a critical). `StatusEndEvent.reason` gains `'cleansed'`, `CastOutcome` gains `revived`. `formatEvent`: "Sera revives Aldric.", "Sera casts Purify: Aldric is cleansed (+3, 12 hp).", and a cleansed status "<name> is no longer <adjective>." (so a cleansed Asleep reads "is no longer asleep", not "wakes"). Carried-forward fix: `turnBegins`'s docstring now says it returns after the ticks when one ends the battle.
- `policies.ts`: `blowBonus` reads `isHelpless` (same result for every unit today). `foeInfo.ts` reads `helpless`. `battleEffects.ts`: `SPELL_LOOKS` is a full `Record<SpellId, …>`, so the six got first looks borrowed from their kin (frost dart, healing sparkle, …); step 22 gives them their own.
- `previewCast` needed no change: it has no damage field, and its odds and touched units (the fallen target included, `hitChance` null) come from `castTouches` and `spellApCost`/`spellRange` already.

Tests: `spells.test.ts` (tests 1–2: the six spells' numbers, the hostile thirteen, helpless/wakesOnDamage, no `sleep` key; plus Revive's friendly range); `battleEngine.test.ts` new describe "the special spells (skill trees step 20)", 29 tests covering 3–12 (Asleep's existing tests untouched and passing; Frozen; Revive and its refusals, `usedOnce` through snapshot/restore, the winner; Purify; Ice Lance against each of the five statuses, miss, critical, power and ward; Holy Light draw counts; Renew and its restore; a seeded six-spell battle replayed and restored mid-way; the two log lines).

Deviation from test-first: the engine and data changes were written before the engine tests. To show the tests bite, the engine file was swapped back to `HEAD`'s and the new describe run: 19 of 29 failed; the 10 that passed exercise paths that already existed (Glacial Prison laying a status, Renew, an unaffected Ice Lance, misses, the winner rule, Purify's plain heal).

Tests changed deliberately: `spells.test.ts` (Ice Lance in the element map; 30 hero spells, 33 in all; `frozen` after `renewing` in `STATUS_IDS`; Pinned's and Taunted's rules now carry `hostile`); `perks.test.ts` exempts the six from "every hero spell has one node" and asserts they have none yet — **step 21 must drop that `UNTAUGHT` list** once their nodes are in `PERKS`.

Commands and results:
- `npx vitest run src/combat/spells.test.ts src/engine/battleEngine.test.ts`: pass.
- `npx vitest run scripts/simulate.test.ts -t "refactor guard"`: 1 passed; no change under `scripts/` or any fixture (`git status`).
- `npm test`: 86 files, 1946 tests passed; `tsc` clean.
- `npm run test:browser` (run because `foeInfo.ts` and `battleEffects.ts` moved): 10 files, 117 tests passed.

For later steps:
- Step 21: Purify has `heal`, so `isHealing('purify')` is true: once a hero knows it, the world map's `worldSpells`/`autoHeal` and the policy's heal reserve and `healCast` treat it as a heal (1d6). Decide whether that is wanted when adding `purifyCast`. `sleepCast` still checks only `asleep` (not Frozen); `prisonCast` will want "not Frozen or Asleep".
- Step 22: the six spells' looks are placeholders; `restore` events and Revive's aim still have no look; a revived unit's figure must stand again on a `cast` outcome with `revived`.

