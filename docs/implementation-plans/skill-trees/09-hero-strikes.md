# Step 09: Hero abilities: strikes and statuses

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R2, R8, R13; §4.3 the techniques; §5.3 abilities for heroes; §5.4 rows "Hero ability use" and "Technique strike", RNG order) · [Feature record](../../features/skill-trees.md)

**Stage 2, first step.** **Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step extends the engine's ability path, which monsters already use, to weapon techniques with mana, weapon-relative AP, weapon dice and extra on-hit effects. A slip in the order of rolls breaks replays; a slip in the monster path breaks the refactor guard.

## 1. Objective

Heroes can have techniques, and the engine runs them. `Ability` and `Strike` gain the fields of contract C11, and `ABILITIES` gains every technique that is a strike or a status with no roll: Power Attack, Cleave, Pin, Flame Strike, Frost Strike, Thunder Strike, Aimed Shot, Hunter's Mark, Pinning Shot, Sprint, Dirty Trick, Venom Strike, Hamstring and Smite (14 of the 17; Taunt, Volley and Consecrate are areas, step 10). The statuses `marked` and `slowed` arrive. A character's perks can teach an ability (`Perk.ability`, `knownAbilities`), and `deriveCombatStats` emits `abilities`, and `magic` for a hero whose only mana use is a technique. The engine lists, prices and resolves the techniques; events record a technique's mana; `LOG_SCHEMA_VERSION` becomes 25.

No node teaches a technique yet (step 13 adds them to `PERKS`), so nothing a player or the simulator does changes: the refactor guard stays green.

## 2. Requirements and context

- **R2:** a node is a passive, an at-will active (AP, maybe a recharge) or a mana active (AP and mana, maybe a recharge).
- **R8:** the new mechanics work in the engine as design §5.4 states, and battles stay deterministic from their seed.
- **R13:** `LOG_SCHEMA_VERSION` is raised for every new or changed event.
- **AC6 (this step's share):** each mechanic has an engine test, and the replay tests still pass.
- **Quality constraint:** a unit whose stats carry none of the new fields behaves exactly as today. Monsters' abilities set none of the new fields.

### The techniques of this step (design §4.3)

"wAP+n" is the unit's weapon `attackApCost` plus n. A **weapon blow** is an attack with the unit's weapon (its dice, damage bonus, piercing and on-hit runes), rolled with its `toHit` and the attack's flanking and arc bonuses, as a plain attack is. A recharge left unstated is 0.

| Id | Name | Mana | AP | Recharge | Needs | What it does |
| --- | --- | --- | --- | --- | --- | --- |
| `power_attack` | Power Attack | — | wAP+2 | 0 | melee | Weapon blow, −10 to hit, +6 damage (not doubled by a critical) |
| `cleave` | Cleave | — | wAP+2 | 2 | melee | Two weapon blows at −5 each; the second goes to another foe in reach if there is one, else the same foe |
| `pin` | Pin | 3 | wAP+1 | 1 | melee | Weapon blow; a hit that leaves the foe standing lays `pinned` for 1 turn |
| `flame_strike` | Flame Strike | 3 | wAP+1 | 0 | melee | Weapon blow; a hit adds +5 fire and lays `seared` for 1 turn |
| `frost_strike` | Frost Strike | 3 | wAP+1 | 0 | melee | Weapon blow; a hit adds +4 frost and lays `chilled` for 1 turn |
| `thunder_strike` | Thunder Strike | 4 | wAP+1 | 0 | melee | Weapon blow at +10 to hit; a hit adds +7 lightning |
| `aimed_shot` | Aimed Shot | — | wAP+2 | 0 | ranged | Weapon shot, +20 to hit, +3 damage |
| `hunters_mark` | Hunter's Mark | — | 2 | 3 | — | No roll: a foe within the weapon's range is `marked` for 2 turns |
| `pinning_shot` | Pinning Shot | 3 | wAP+1 | 1 | ranged | Weapon shot; a hit that leaves the foe standing lays `pinned` for 1 turn |
| `sprint` | Sprint | — | 0 | 3 | — | No roll: the user is `hasted` (+3 AP) for this turn (1 turn, laid on its own turn, so its AP apply at once) |
| `dirty_trick` | Dirty Trick | — | wAP+1 | 2 | melee | Weapon blow; a hit lays `baned` (−15 to hit) for 2 turns |
| `venom_strike` | Venom Strike | 2 | wAP+1 | 0 | — | Weapon blow or shot; a hit lays `poisoned` for 3 turns |
| `hamstring` | Hamstring | — | wAP+1 | 2 | — | Weapon blow or shot; a hit lays `slowed` (−3 AP) for 1 turn |
| `smite` | Smite | 3 | wAP+1 | 0 | melee | Weapon blow; a hit adds +4 damage, and 6 more as bane (only against a unit `baneApplies` to) |

The flat on-hit additions are `Strike.onHit` entries (`OnHit`, combat.ts): Flame Strike `[{ damage: 5, element: 'fire', status: { id: 'seared', turns: 1 } }]` or the status on the strike, Frost Strike `{ damage: 4, element: 'frost' }` with `chilled` 1, Thunder Strike `{ damage: 7, element: 'lightning' }`, Smite `[{ damage: 4 }, { damage: 6, bane: true }]`. They resolve exactly as a rune's on-hit entries do: after resistance, cut by the defender's ward of their element, never doubled by a critical, the bane only where `baneApplies`. A strike's `status` (Pin, Dirty Trick, Venom Strike, Hamstring, Flame and Frost Strike) is laid on a hit that leaves the target standing, as a routine strike's is today.

### Engine rules (design §5.4, the two rows this step owns)

| Mechanic | Rule |
| --- | --- |
| **Hero ability use** | `canUse` adds: `needs` matches `isMelee`; `mana ≥ manaCost`; AP ≥ `abilityApCost`. `legalActions` lists `selfStatus` abilities with the user's own id as target, `foeStatus` abilities at each standing foe within range, and `centredOnSelf` areas at the user's hex only (step 10). A mana ability's cost is taken as the action begins, and the recharge is set as today. |
| **Technique strike** (`weapon: true`) | Resolved through `attack()` with the strike's `toHit`, `damageBonus`, extra `onHit` (fire, frost or lightning flat damage, warded; a bane entry only where it applies) and `status`. Flanking, arc, Backstab, Skirmisher, Executioner and Fortune's critical damage apply as to a plain attack (the last four arrive in step 17). The defender turns to face a melee technique as for any blow. `AttackEvent` carries `ability` and `strike` as routines do. |

**RNG order (design §5.4).** Every new roll draws as an existing one does. A technique strike is `attack()` with modifiers: one roll to hit, then the dice on a hit. Cleave's strikes go in order, each choosing its target before rolling. Hunter's Mark and Sprint roll nothing and draw nothing. Every passive draws nothing.

### Decisions from the index (unchanged)

2. **The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
5. **Mana in technique events.** An `AttackEvent` (the first strike only) or `AbilityEvent` of an ability with a `manaCost` carries `manaCost` and `manaAfter`, as a `CastEvent` does (C11).
8. **`LOG_SCHEMA_VERSION`** 25 from step 09 (the first stage-2 step to change an event); steps 10 and 11 change shapes under 25. 26 from step 17; steps 18 to 20 under 26.

### Contracts (copied unchanged from the index)

**C11. Hero abilities (steps 09 and 10; consumed by 11–15, 17, 21):**

```ts
// src/combat/abilities.ts
export interface Ability {      // existing fields kept; monsters set none of the new ones
  manaCost?: number                                    // paid as the action begins; canUse checks mana
  weaponAp?: number                                    // AP = attackApCost + weaponAp (apCost then ignored)
  needs?: 'melee' | 'ranged'                           // isMelee(stats) must match
  selfStatus?: StatusLaid                              // target is the user (Sprint)
  foeStatus?: { status: StatusLaid; range: number | 'weapon' }   // no roll (Hunter's Mark)
}
export interface Strike {       // damage becomes optional when weapon is set
  weapon?: true; toHit?: number; damageBonus?: number; onHit?: readonly OnHit[]; spreads?: true
}
export interface AreaAttack {   // step 10
  weaponDamage?: true; weaponRange?: true; throughResistance?: true
  foesOnly?: true; auto?: true; bane?: true; centredOnSelf?: true
}
export const ABILITY_IDS = ['troll_claws', 'spider_bite', 'spider_web', 'fire_spit',
  'power_attack', 'cleave', 'taunt', 'pin', 'flame_strike', 'frost_strike', 'thunder_strike',
  'aimed_shot', 'hunters_mark', 'volley', 'pinning_shot', 'sprint', 'dirty_trick', 'venom_strike',
  'hamstring', 'smite', 'consecrate'] as const
export function abilityApCost(stats: CombatantStats, ability: AbilityId): number
  // weaponAp !== undefined ? attackApCost + weaponAp (Arcane Knight's Strikes: + 0, step 17) : apCost
// src/combat/combat.ts: CombatantStats gains imbueDamage?: number (added to each on-hit entry with an element of a Strike)
// src/engine/battleEngine.ts: AttackEvent (first strike only) and AbilityEvent gain manaCost?: number, manaAfter?: number;
//   LOG_SCHEMA_VERSION = 25 (step 09)
```

Step 09 adds the 14 strike and status abilities to `ABILITY_IDS` and `ABILITIES` with design §4.3's numbers; step 10 inserts `taunt`, `volley` and `consecrate` at their places in the list above, with their entries. Taunt's status rule is step 11's. Pin and Pinning Shot lay `pinned` (an id with no rule from step 09): step 09 builds them and tests the strike; step 11 gives `pinned` its rule and tests the pin.

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

**From C2 (consumed here):** `Perk.ability?: AbilityId` ("step 13 on" for data; this step adds the field and its reader) and `knownAbilities(character: Character): AbilityId[]` ("step 09 on; ABILITY_IDS order"). `nodeKind(perk)` returns `'mana'` if its ability has a `manaCost`, `'at-will'` if it has an `ability`.

### The status `pinned` (per C6)

Pin and Pinning Shot are built here with the status they will lay. **This step adds `'pinned'` to `STATUS_IDS` with its name, adjective ("pinned"), mark `N` and a colour, and no rule field.** That is harmless: a status with no fields changes no number, no event shape and no draw, and nothing lays it until step 13 puts Pin in `PERKS`. Step 11 adds `immobile: true` to it and the rule that a pinned unit has no legal move, and tests the pin.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets.
- **The refactor guard** must stay green, unchanged (decision 2). No simulated hero has a technique in this step.
- **Determinism.** A battle replays from its seed. New rolls draw in the order above; a passive that rolls nothing draws nothing. A unit whose stats carry none of the new fields behaves exactly as today.
- **Domain first.** Every rule lives in the Phaser-free modules with tests; scenes decide nothing.
- **A node is data.** A technique is one entry in `ABILITIES`; the node that teaches it (step 13) is one entry in `PERKS`.
- **`tsc` is the linter** (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `.ts` extensions).
- **Commits.** One commit once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 09: hero abilities: strikes and statuses". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines this change makes wrong and search it for every name renamed or removed.

## 3. Dependencies and prerequisites

- **Stage 1 (steps 01–08) done.** From it this step uses:
  - `Perk` (C2) with `path`, `tier`, `effects`, `spell`; `knownSpells`; `nodeKind` (step 03), which already reads `ability` if the field exists, or which this step teaches to.
  - `CombatantStats.magic` with its modifiers (C7, step 04); `deriveCombatStats` emitting `magic` only for a hero that knows a spell; `maxMana` for every hero.
  - The `warded` status and `StatusRule.wardAll` (step 02).
- **Existing code at `50fb4cf`**, for reference:
  - `src/combat/abilities.ts`: `Strike { name, verb, damage, status? }`, `AreaAttack`, `Ability { name, verb, description, apCost, recharge, strikes?, area? }`, `ABILITY_IDS` (the four monster abilities), `ABILITIES`.
  - `src/combat/combat.ts`: `CombatantStats` (`toHit`, `critChance`, `damage`, `attackApCost`, `attackRange`, `reach`, `abilities`, `abilityDamageBonus`, `onHit`), `OnHit { damage, element?, bane?, status?, onCrit?, heal? }`, `baneApplies`, `rollHitDamage`, `isMelee`.
  - `src/engine/battleEngine.ts`: `LOG_SCHEMA_VERSION = 24`; `canUse(actor, ability)` (has it, AP, not recharging); the routine path (`canRoutine`, `routine`, which resolves each strike as an `AttackEvent` with `ability` and `strike`, retargeting a strike whose target fell to the nearest standing foe in reach, lowest id on a tie); `areaAttack`; `recharging` set as the ability is used and counted down as the side's turn begins; `attack()` and its on-hit resolution; `formatEvent`.
  - `src/engine/policies.ts`: `aggressive`'s best strike scores every routine in `legalActions` by its strikes' dice.
  - `src/scenes/foeInfo.ts`: describes an ability from its data (`strike.damage` among it).

## 4. Scope and implementation guidance

### 4.1 `src/combat/abilities.ts`

- Add the C11 fields to `Ability` and `Strike` (and `AreaAttack`'s, typed now, used in step 10). `Strike.damage` becomes optional; a strike has `damage` or `weapon: true`, never both (a test over `ABILITIES` holds that).
- Extend `ABILITY_IDS` with the 14 hero ids of section 2, in C11's order (leaving out `taunt`, `volley` and `consecrate`, which step 10 inserts at their places), with an `ABILITIES` entry each; `ABILITIES` stays a full `Record<AbilityId, Ability>`.
- Hero entries set `apCost: 0` where `weaponAp` is set (it is ignored), a `description` worded as the battle's hover panel and the Skills list will show it ("A weapon blow at −10 to hit for +6 damage."), and `verb` ("swings hard", "cleaves", "pins", …).
- `abilityApCost(stats, ability)` as C11 says. Every place that read `ABILITIES[id].apCost` (engine, policy, `foeInfo`) goes through it.

### 4.2 `src/combat/combat.ts` and `src/combat/spells.ts`

- `CombatantStats.imbueDamage?: number`: added to the `damage` of each entry of a **Strike's** `onHit` that has an `element` (not to the weapon's own runes). `sameCombatStats` compares it.
- `STATUS_IDS` and `STATUSES` gain `marked` (Y, armour class −10) and `slowed` (L, action points −3), and `pinned` (N, no rule field; section 2). Pick colours that read on the nameplate beside today's.

### 4.3 `src/character/perks.ts` and `character.ts`

- `Perk.ability?: AbilityId` (if step 03 did not already add it). `knownAbilities(character)`: the abilities its held nodes teach, in `ABILITY_IDS` order, no duplicates. It returns `[]` for every character until step 13, but test it with a hand-made `PERKS`-shaped stand-in or a temporary node in the test (do not add nodes to `PERKS`).
- `nodeKind` reads the ability's `manaCost` (C2).
- `deriveCombatStats`: `abilities: knownAbilities(character)` when non-empty; `magic` emitted when the hero knows a spell **or** an ability with a `manaCost` (then `spells` may be `[]`); the modifiers of C7 unchanged. `imbueDamage` from `perkBonus('imbueDamage')` when non-zero.

### 4.4 `src/engine/battleEngine.ts`

- `LOG_SCHEMA_VERSION = 25`.
- **`canUse`**: as today, plus `needs` matching `isMelee(stats)` (`'melee'` needs a melee weapon, reach included, or bare hands; `'ranged'` needs a weapon that is not melee), `mana ≥ manaCost`, and AP ≥ `abilityApCost`.
- **`legalActions`**, after casts as today, in the unit's `abilities` order:
  - a strike ability (strikes with or without `weapon`) at each standing foe within the unit's `attackRange`, as routines are listed today;
  - a `selfStatus` ability once, with `target` the user's own id;
  - a `foeStatus` ability at each standing foe within its range (`'weapon'` = the unit's `attackRange`), in roster order.
- **Using an ability**: AP (`abilityApCost`) and mana (`manaCost`) are paid as the action begins, then the recharge is set as today. The user turns to its target (not for `selfStatus`). A paid-for change of gear ends as for an attack.
- **Technique strike** (`weapon: true`): resolve through the same code path as a plain weapon attack, so flanking, arc, the defender's turn to face a melee blow, criticals, resistance and piercing, on-hit runes and mirror images behave identically. Add the strike's `toHit` to the chance (before the 5–95 clamp); add `damageBonus` to a hit's damage **after** the critical's doubling (so never doubled); append the strike's `onHit` entries (each elemental one raised by `imbueDamage`) to the weapon's for that blow; lay the strike's `status` on a hit that leaves the target standing. `abilityDamageBonus` is not added to a weapon strike. The `AttackEvent` carries `ability` and `strike`, `apCost` (the ability's, on the first strike; 0 after) and `apAfter`, as routines do.
- **Cleave (`spreads`)**: strikes go in order. The second strike's target is chosen before its roll: another standing foe within the unit's `attackRange` than the first strike's target (nearest, lowest id on a tie), else the same foe if it still stands, else the nearest standing foe in reach, else it is not made. The existing routine rule (a fallen target's strike goes to the nearest standing foe in reach) holds for the rest.
- **Status abilities** (`selfStatus`, `foeStatus`): no roll, no draw. Lay the status (laid on its own side's turn, so Sprint's `hasted` adds its 3 AP at once, as statuses do today). Log one `AbilityEvent`: `at` the target's hex, `hexes` that hex, `shape` `'burst'`, `distance`, `apCost`, `apAfter`, `facing`, `skill` the unit's `toHit`, and one status-only outcome for the target, shaped as a friendly spell's outcome is today (no chance, no roll).
- **Mana in events** (decision 5): the first `AttackEvent` of a mana technique, and the `AbilityEvent` of a mana status ability, carry `manaCost` and `manaAfter`.
- **`formatEvent`**: keep lines short and in today's voice, e.g. "Aldric power-attacks the Goblin: hit for 11.", "Brenna marks the Goblin.", "Mira sprints." A strike's line may reuse the routine line with the ability's verb.
- Nothing here changes a monster's path: their abilities have no new field, so `abilityApCost` returns `apCost` and the old code runs.

### 4.5 `src/engine/policies.ts`

The policy learns techniques in step 12. Until then, `aggressive` must never choose a hero ability and must not throw on one: filter out of every step the abilities with `weaponAp`, `selfStatus`, `foeStatus` or a `weapon` strike. A test gives a unit a technique and shows the policy's choice is what it is without it.

### 4.6 Callers of `Strike.damage`

`foeInfo.ts` (and any other reader) must compile with `damage` optional; describe a weapon strike as "a weapon blow" (step 14 words it fully). No scene behaviour changes.

### 4.7 Exclusions

- Taunt, Volley, Consecrate and the `AreaAttack` fields' behaviour: step 10. `taunted`, `rooted`, `immobile`, `moved`, `StatusLaidEvent`: step 11.
- Nodes in `PERKS`, plans, bandits: step 13. The Skills menu and looks: step 14.
- Skirmisher, Backstab, Executioner, Fortune's critical damage, Arcane Knight's discount: step 17.

## 5. Verification

### Tests (in `npm test`)

- `src/combat/abilities.test.ts`: every hero ability's numbers as section 2's table; each has `damage` xor `weapon` on its strikes; `abilityApCost` is `attackApCost + weaponAp` for a technique (a longsword's 5 → Power Attack 7, a bow's 4 → Aimed Shot 6) and `apCost` for a monster ability; monsters' four abilities unchanged.
- `src/combat/spells.test.ts`: `marked` −10 AC and `slowed` −3 AP through `effectiveStats`; `pinned` has no rule field.
- `src/character/perks.test.ts` / `character.test.ts`: `knownAbilities` in `ABILITY_IDS` order from a stand-in node; `nodeKind` 'mana' / 'at-will'; `deriveCombatStats` emits `abilities`, and `magic` with `spells: []` for a hero whose only mana use is a technique; `imbueDamage` emitted only when non-zero.
- `src/engine/battleEngine.test.ts`, with a scripted RNG, one test per technique or rule:
  - `canUse`: refused without the weapon kind `needs`, without the mana, without `abilityApCost` AP, and while recharging; listed otherwise.
  - `legalActions` lists Sprint at the user only, Hunter's Mark at each foe within weapon range, strikes at foes in `attackRange`.
  - Power Attack: −10 in the chance, +6 on a hit, a critical doubles only the dice; Aimed Shot +20 / +3.
  - Cleave: two rolls in order; the second at another foe in reach when one stands, else the same foe; −5 on each.
  - Flame Strike (fire 5 warded by a fire ward, Seared on a hit that leaves the foe standing), Frost Strike (frost 4, Chilled), Thunder Strike (+10, lightning 7), Smite (+4, and +6 only against a regenerating or `blightborn` foe), with `imbueDamage` raising only elemental entries.
  - Dirty Trick, Venom Strike, Hamstring, Pin and Pinning Shot lay their status on a hit that leaves the foe standing, none on a miss or a kill (Pin's `pinned` is laid; its effect is step 11's).
  - Mana paid as the action begins and recorded as `manaCost`/`manaAfter` on the first `AttackEvent` only; recharge set.
  - Hunter's Mark and Sprint draw nothing from the RNG (a scripted RNG with no rolls left passes); Sprint's +3 AP is usable the same turn.
  - Flanking and arc bonuses and the defender's turn apply to a melee technique as to a plain attack.
  - Snapshot and restore round-trip a battle mid-way with a technique recharging; the replay tests still pass.
- `src/engine/policies.test.ts`: a unit given a technique chooses as without it.
- The refactor guard (`scripts/simulate.test.ts`) passes **unchanged**.

### Commands

```sh
export PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH
npx vitest run src/engine/battleEngine.test.ts src/combat/abilities.test.ts
npm test
npm run test:browser   # once: the battle log's lines and foeInfo are touched, though no scene changes
```

### Acceptance

- AC6 for the two §5.4 rows this step owns: each has an engine test, and the replay tests pass.
- The guard fixture is untouched and green.

## 6. Completion criteria

- [ ] C11's fields, ids, `abilityApCost`, `imbueDamage` and the 14 entries in place; `marked`, `slowed`, `pinned` (no rule) added.
- [ ] `knownAbilities` and `deriveCombatStats` emit abilities and `magic` for mana techniques.
- [ ] The engine lists, prices and resolves techniques as section 4.4; `LOG_SCHEMA_VERSION` 25; `formatEvent` lines.
- [ ] The policy ignores hero abilities until step 12.
- [ ] `npm test` passes; the guard fixture unchanged; `npm run test:browser` passes.
- [ ] `CLAUDE.md` current (the abilities line in `src/combat/`, the engine's `ability` action, the policy's line, the statuses list, `LOG_SCHEMA_VERSION`'s mention).
- [ ] Committed as "Skill trees step 09: hero abilities: strikes and statuses"; the index's row set to `done (<commit>)`; the execution record filled.

## 7. Execution record
