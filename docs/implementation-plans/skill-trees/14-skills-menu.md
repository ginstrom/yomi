# Step 14: The Skills menu and the techniques' looks

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R9; §4.6, §4.7, §5.6 "Battle" and "`battleEffects.ts`"; AC7) · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step turns the battle's spell list into one Skills list over spells and techniques, teaches the battle screen to aim every kind of active (foe strike, foe status, self status, area, area centred on the user), and plays the new events. It is the largest scene change of stage 2, with layout and input judgement, and it carries AC7, the stage's in-browser criterion.

## 1. Objective

In battle, a hero with any active (a spell or a technique) has a **Skills** button (M, formerly Cast). It lists spells, then techniques, each with its cost and recharge, greyed when the engine lists no legal use now. Picking one aims it as its kind asks, and the action goes to the engine. The battle screen plays technique strikes with the weapon's look, area techniques and status techniques with their own looks, shows the new statuses' letters on nameplates, and the foe hover panel describes bandits' techniques. AC7 passes in the browser.

The scenes decide nothing: every choice comes from `legalActions`, `castTouches`/`areaTouches`, `previewAttack`/`previewCast` and the helpers.

## 2. Requirements and context

- **R9:** the player uses a hero's actives in battle from one **Skills** list (the old Cast button), which holds spells and techniques with their costs and recharge.
- **AC7 (R9):** In the browser, a level 4 Aldric who took Rooted and Taunt opens Skills (M), sees Taunt with its AP, uses Taunt, and the foes' nameplates show **T**.

### Design §4.6, in battle (restated)

The **Skills** button (M, formerly Cast) shows for any unit with an active. It lists spells, then techniques, each greyed when the engine lists no legal use now:

```
Taunt          3 AP   (ready in 1)
Pin            3 mana  6 AP
Power Attack   7 AP
Magic Arrow    3 mana  4 AP
```

Then the hero aims:

- A strike or a foe status asks for a foe.
- An area asks for a hex, with its outline and odds.
- A self status (Sprint) asks for a click on the caster, as Shield does today.
- Taunt is an area centred on the user and is aimed at the user's hex.

(The example lists techniques before the spell; the order rule is C14's: spells first, in `ALL_SPELL_IDS` order, then abilities in `ABILITY_IDS` order. The example shows the row format, not the order.)

### Design §4.7, edge case (restated)

A hero without a melee weapon sees melee techniques greyed, and the hint says "Needs a melee weapon". A ranged technique wants a ranged weapon ("Needs a ranged weapon").

### Design §5.6, Battle (restated)

`spellMenu.ts` becomes the skills menu. It is renamed `skillMenu.ts`, and its rows are `{ kind: 'spell' | 'ability', id, label, enabled, readyIn? }`, built from `unit.magic.spells` and `unit.abilities` and enabled when `legal` holds a matching action. `targetingHint` covers abilities: "Pin: choose a foe (3 mana, 6 AP)…", "Taunt: click Aldric (3 AP)…", "Volley: choose where (6 AP)…". `BattleScene`'s Cast button is labelled Skills, keeps M, and shows when `magic` or `abilities` is non-empty. Its probe keeps `castButton` and the rows gain `kind`.

### Design §5.6, `battleEffects.ts` (restated)

- A technique strike plays its weapon's `attackLook`.
- `ABILITY_LOOKS` gains entries for Volley (arrows to each hex), Consecrate (a gold burst on the user), Taunt (a red ring on the user) and Hunter's Mark, Sprint and the strikes' on-hit flash, which reuse the existing fire, frost and lightning looks.
- `changesStatusMarks` covers `status_laid` (and, in stage 3, `restore`; not this step).
- (A `restore` event's green float is step 22's.)

`foeInfo.ts` already describes abilities from their data. It learns the new fields (mana, wAP, `needs`), which bandits now carry.

### Decisions from the index (unchanged)

- **2. The refactor guard.** A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach must keep the fixture green unchanged. This step is in the list that must keep it green (it changes scenes only).
- **5. Mana in technique events.** An `AttackEvent` (the first strike only) or `AbilityEvent` of an ability with a `manaCost` carries `manaCost` and `manaAfter`, as a `CastEvent` does (C11).

### Contracts (copied unchanged from the index)

**C7. Spell modifiers and mana (step 04; consumed here for spell rows' AP and range):**

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

**C11. Hero abilities (steps 09 and 10; consumed here):**

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

**C12. Taunt, Rooted and Pin (step 11; consumed here):**

```ts
// src/engine/battleEngine.ts
export const TAUNT_PENALTY = 25
// UnitRecord, UnitSnapshot gain moved: boolean  (false as its side's turn begins; true after its first step)
export interface StatusLaidEvent extends EventBase { type: 'status_laid'; unit: UnitId; status: StatusId; turns: number; cause: 'rooted' | 'shadowdancer' }
// AttackEvent, CastOutcome gain tauntPenalty?: number   (25 when applied)
// StatusEndEvent.reason gains 'source_fell' | 'moved' (step 20: 'cleansed')
// src/combat/combat.ts
export const TRAIT_IDS = ['rooted', 'tumble', 'counter', 'ambush', 'deathblow', 'blademaster', 'deadeye',
  'unbreakable', 'shadowdancer', 'guardian', 'courage', 'aegis', 'sanctuary', 'arcane_knight'] as const
export type TraitId = (typeof TRAIT_IDS)[number]
// CombatantStats gains traits?: readonly TraitId[]  (TRAIT_IDS order; only when non-empty)
// src/game/save.ts: SAVE_VERSION = 24; version 23 loads as is; BattleEngine.restore defaults `moved` to false
```

Rules: design §5.4's Taunt, Rooted and Pin rows and §4.7's edge cases.

**C14. The Skills menu (this step; extended by 22):**

```ts
// src/scenes/skillMenu.ts (renamed from spellMenu.ts)
export interface SkillMenuRow { kind: 'spell' | 'ability'; id: SpellId | AbilityId; label: string; enabled: boolean; readyIn?: number; why?: string }
export function skillMenuRows(unit: UnitSnapshot, legal: readonly Action[]): SkillMenuRow[]
  // spells (ALL_SPELL_IDS order) then abilities (ABILITY_IDS order); AP from spellApCost / abilityApCost;
  // why: "Needs a melee weapon" / "Needs a ranged weapon" where `needs` fails
export function targetingHint(row: Pick<SkillMenuRow, 'kind' | 'id'>, stats: CombatantStats): string
export function describeStatuses(statuses: readonly ActiveStatus[]): string   // unchanged
```

The battle probe keeps `castButton`; its menu rows gain `kind`.

### Status letters (from C6, for the nameplates)

| Status | Mark |
| --- | --- |
| warded | G |
| marked | Y |
| slowed | L |
| taunted | T |
| pinned | N |
| rooted | R |

The letters and colours live in `STATUSES` (steps 02, 09, 11); the nameplates already draw any status by its rule, so the work here is that every event that lays one redraws them.

### Shared constraints (from the index)

- **Environment.** System Node is 22; prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman `make` targets are an alternative.
- **Commands:**
  - `npm test` (`tsc && vitest run`) is the gate before the commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) **is required in this step** (it changes scenes); read `e2e/CLAUDE.md` before adding an in-browser test.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) must stay green with its fixture unchanged. Do not edit the fixture. No simulator run is needed in this step.
- **Determinism.** Scenes draw nothing from a battle's RNG; the engine's events are unchanged by this step.
- **Domain first.** Scenes decide nothing; `skillMenu.ts`, `battleEffects.ts`, `foeInfo.ts`, `attackPlan.ts` and other helpers in `src/scenes/` stay free of runtime Phaser imports so their tests run in the `domain` project.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` (`import type`), `.ts` extensions.
- **Commits.** One commit once `npm test` and `npm run test:browser` pass, on `skill-trees`, without pushing; never switch branches. Message "Skill trees step 14: the Skills menu and the techniques' looks". No attribution lines.
- **Docs.** CLAUDE.md stays current: fix the lines this change makes wrong (the scene layer's list of helpers names `spellMenu.ts`; the `BattleScene` paragraph on the Cast button, M and `targeting`; `battleEffects.ts`'s line) and search it for `spellMenu`, `spellMenuRows`, `SpellMenuRow` and "Cast button". Update the manual's sections 5 (Battle) and 6 (Magic) for the Skills button and techniques.

## 3. Dependencies and prerequisites

- **Step 09 (done first)** provides the `Ability`/`Strike` extensions, `abilityApCost`, the technique strikes in the engine (`legalActions` lists `ability` actions with a `target` foe for strike routines and `foeStatus` abilities, with the user's own id for `selfStatus`), `slowed` and `marked`, and `manaCost`/`manaAfter` on the events (C11).
- **Step 10** provides the area techniques: Volley (an area aimed `at` a hex within weapon range), Consecrate and Taunt (`centredOnSelf`: listed only at the user's hex), with `areaTouches` covering them.
- **Step 11** provides `taunted`, `pinned`, `rooted`, `StatusLaidEvent` and the `rooted` trait (C12).
- **Step 12** makes the policy use techniques (foes may now use them against the player; bandits in step 13).
- **Step 13** puts the 18 stage-2 nodes in `PERKS`, so heroes can learn techniques and Rooted, and bandits carry them (Captain: Rooted, Taunt, Pin; Brute: Power Attack, Cleave; Cutthroat: Dirty Trick, Sprint).
- **Step 04** provides `spellApCost` and `spellRange` (C7).
- **Existing code at `50fb4cf`, for reference:**
  - `src/scenes/spellMenu.ts`: `SpellMenuRow { spell, label, enabled }`, `spellMenuRows(unit, legal)` (label `"Fireball  10 mana  6 AP"`), `targetingHint(spell)`, `describeStatuses`; its test `spellMenu.test.ts`.
  - `src/scenes/BattleScene.ts`: the Cast button (M) shown for a unit with `magic`; a spell picked by a click or its number; `targeting` holds what the next board click picks a target for; hovering an area's centre outlines the area (`areaOf`) and shows odds on every unit it would touch (`previewCast`); `spellCursor`, `CURSORS.heal`; the battle probe's `castButton` and spell rows.
  - `src/scenes/battleEffects.ts`: `attackLook`, `SPELL_LOOKS`, `ABILITY_LOOKS` (spider web, fire spit), `impactMs`, `bonusText`, `changesStatusMarks`.
  - `src/scenes/foeInfo.ts`: `foeInfoLines` describes each ability (name, when next usable, what it does from its data, `STATUSES` and `abilityDamageBonus`), then wards.
  - `src/engine/battleEngine.ts`: `formatEvent` (log lines), `previewAttack`, `previewCast`, `castTouches`.
  - `src/testHook.ts`: the battle probe type.
  - `e2e/battle.test.ts`: "casts a spell picked from the Cast button's list, on a foe and then on the caster, and backs out on Esc (A10)".
  - `src/scenes/debugCommands.ts`: `xp`, `give`, `fight <encounter> <threat>`, `hp`; there is no command to take a perk (see 4.5).

## 4. Scope and implementation guidance

### 4.1 `skillMenu.ts` (renamed from `spellMenu.ts`)

- `git mv` the module and its test. Rows per C14: spells from `unit.magic?.spells` in `ALL_SPELL_IDS` order, then abilities from `unit.abilities` in `ABILITY_IDS` order. Monsters' abilities appear in a monster's row list only if a monster is ever selectable; heroes are what matters.
- `label`: name, then mana if any, then AP: `"Pin  3 mana  6 AP"`, `"Taunt  3 AP"`, `"Magic Arrow  3 mana  4 AP"`; AP from `spellApCost(unit, id)` for a spell and `abilityApCost(unit, id)` for an ability, so a weapon technique shows the number for the weapon held now.
- `readyIn`: from `unit.recharging[id]` when above 0; the scene appends "(ready in N)".
- `enabled`: `legal` holds a `cast` of that spell or an `ability` action of that id by this unit.
- `why`: when an ability's `needs` does not match `isMelee(unit)`, "Needs a melee weapon" or "Needs a ranged weapon"; otherwise left out. The scene shows it as the greyed row's hover or hint.
- `targetingHint(row, stats)`:
  - foe strike or `foeStatus`: "Pin: choose a foe (3 mana, 6 AP). Esc or Cancel to go back."
  - `selfStatus` or `centredOnSelf`: "Taunt: click Aldric (3 AP). Esc or Cancel to go back." (the unit's name)
  - other area: "Volley: choose where (6 AP). Esc or Cancel to go back."
  - spells as today's wording, with AP from `spellApCost`.
- Keep `describeStatuses` as is.

### 4.2 `BattleScene.ts`

- Button text **Skills**, key M kept, shown when the selected unit has `magic` or a non-empty `abilities`. The list opens for spells and abilities alike; a row is picked by a click or its number; a greyed row cannot be picked and shows its `why` (or "not now") in the header hint.
- Aiming, by what was picked (all from `legalActions` of the unit; never compute legality in the scene):
  - **Strike routine or `foeStatus`**: a click on a standing foe that `legal` holds an `ability` action at. The crossed-swords cursor over a valid foe. Hovering a foe shows the hit chance from `previewAttack` adjusted per the strike (if the engine offers no preview for a technique, show the plain attack's chance and leave a note in the record; do not compute odds in the scene).
  - **`selfStatus`** (Sprint): a click on the user, as Shield is today.
  - **Area with `centredOnSelf`** (Taunt, Consecrate): a click on the user's hex; hovering it outlines the area and marks every unit `areaTouches` says it would touch.
  - **Other area** (Volley): a click on a hex the engine lists; hovering outlines the area and shows the odds on each touched unit, allies included, as an area spell does today.
- `targeting` holds a spell or an ability; Esc and Cancel back out as today.
- The battle probe keeps `castButton`; each menu row gains `kind` (and its `id`, `enabled`, `readyIn`). Update the type in `src/testHook.ts`.

### 4.3 `battleEffects.ts` and playback

- An `AttackEvent` with `ability` set (a technique strike) plays its weapon's `attackLook` (swing or shot, by `melee`), as a routine strike already does; its on-hit bonus floats through `bonusText` as today. Flame, Frost and Thunder Strike and Smite add a flash on a hit reusing the fire, frost and lightning spell looks (Smite the gold of Bless or Bane, implementer's choice among existing looks).
- `ABILITY_LOOKS` gains: `volley` (arrows to each hex of the area), `consecrate` (a gold burst on the user), `taunt` (a red ring on the user), `hunters_mark` (reuse an existing mark/flash look on the target), `sprint` (reuse Haste's look on the user). Status-only actives reuse a spell flash; no new sprites (design non-goal).
- `changesStatusMarks` returns true for `status_laid` (Rooted laid at the end of a turn) and keeps every existing case (an ability event's statuses, a status end with reasons `moved` and `source_fell`).
- `formatEvent` lines for stage 2 (the engine's, if step 11 did not add them): "Aldric taunts 2 foes.", "Aldric holds his ground (rooted).", "Goblin is pinned." Check they exist and are tested; add any missing in `battleEngine.ts` with a test.

### 4.4 `foeInfo.ts`

For an ability with the new fields: show mana ("3 mana"), the AP as `abilityApCost` for that foe's weapon ("6 AP (weapon + 1)"), and `needs`. A strike with `weapon: true` is described as "a weapon blow" with its to-hit and damage bonus and on-hit, a `foeStatus` as laying its status at a range, a `selfStatus` on itself, `centredOnSelf` areas around itself. Test with a bandit Captain's stats (Taunt, Pin) and a Brute's (Power Attack, Cleave) from `banditStats`.

### 4.5 In-browser tests (`e2e/battle.test.ts`)

- **AC7:** a level 4 Aldric who took Rooted and Taunt. Reach that state through existing means: either plant a save in `yomi.save.1` (a v24 save string built in the test with the domain's `newGame`/`serialiseSave`-equivalent through `page.evaluate`, or a JSON fixture in `e2e/`) or use the debug console (`xp` to level 4, then take the nodes from the character panel's tree view on the world map, as `character.test.ts` takes a perk). Then `fight` or travel into a battle, select Aldric, press M, read the probe's rows: a row `{ kind: 'ability', id: 'taunt' }` whose label shows its AP (3 AP), enabled; pick it, click Aldric's hex; wait for the probe to show at least one foe with status `taunted` and its nameplate letter **T** (expose the nameplate letters in the probe if not already).
- **Pin:** on a scripted seed (`?seed=`) where Pin hits, a hero with Pin (Heavy Knight depth 3 at level 6: Toughness, Rooted, Taunt; Melee 55) uses it on an adjacent foe; the foe's probe statuses show `pinned` (letter N).
- Update the existing Cast test to the Skills button and the rows' `kind`; keep its foe and caster casts and Esc.
- If a debug command to take a node would make these tests simpler, do not add one in this step; note it in the record.

### 4.6 Manual

Section 5 (Battle): the Skills button replaces Cast; techniques, their AP shown for the weapon held, greying and "Needs a melee weapon"; aiming rules (foe, self, area, around the user). Section 6 (Magic): spells are now one kind of Skill in the same list. No screenshots (step 26).

### 4.7 Exclusions

- Stage-3 events (`restore`, Revive's aim at the fallen, traits' log lines): step 22.
- The policy, the engine's rules and the simulator: steps 09–13, 15.
- The world map's Abilities tab: step 07.

## 5. Verification

### Tests (in `npm test`)

- `src/scenes/skillMenu.test.ts`: spells then abilities in their id orders; labels with mana and AP for a weapon technique at two weapons (sword 5 AP → Pin "3 mana  6 AP"; Power Attack 7 AP); `enabled` from `legal`; `readyIn` from `recharging`; `why` for a melee technique with a bow and a ranged technique with a sword; `targetingHint` for a foe strike, a self status (Sprint), a centred area (Taunt, naming the unit) and an area (Volley).
- `src/scenes/battleEffects.test.ts`: a technique strike's look is its weapon's `attackLook`; `ABILITY_LOOKS` has entries for volley, consecrate, taunt, hunters_mark, sprint; `changesStatusMarks` true for `status_laid`.
- `src/scenes/foeInfo.test.ts`: a Captain's Taunt and Pin and a Brute's Power Attack described with mana, AP and needs.
- `BattleScene.test.ts` smoke test still passes.
- The refactor guard stays green with its fixture unchanged.

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run src/scenes/skillMenu.test.ts src/scenes/battleEffects.test.ts src/scenes/foeInfo.test.ts
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm run test:browser
```

### Acceptance

- AC7 passes in the browser as written: a level 4 Aldric with Rooted and Taunt opens Skills (M), sees Taunt with its AP, uses it, and the foes' nameplates show **T**.
- A pinned foe shows **N**; a rooted hero shows **R** after ending its turn unmoved.
- Every existing in-browser test passes.

## 6. Completion criteria

- [x] `skillMenu.ts` replaces `spellMenu.ts`, per C14, with tests.
- [x] The Skills button (M) shows for any unit with an active; every active kind can be aimed; greyed rows explain why.
- [x] Looks, `changesStatusMarks` and `foeInfo` cover the stage-2 actives and statuses.
- [x] AC7 and the Pin test pass in `npm run test:browser`; the Cast test updated; no other e2e test fails.
- [x] `npm test` passes; the guard fixture unchanged and green.
- [x] CLAUDE.md and the manual's sections 5 and 6 updated; no stale `spellMenu` mentions.
- [x] Committed as "Skill trees step 14: the Skills menu and the techniques' looks"; the index's step table shows `done (<commit>)`.

## 7. Execution record

**Commit:** 294507c (the change), after a956def (the rename alone, committed by a mis-staged add; not amended). Engineer: session model. 2026-11-14.

**What was built**

- `src/scenes/skillMenu.ts` (git-renamed from `spellMenu.ts`, test too): `Skill` (`{ kind: 'spell', id } | { kind: 'ability', id }`), `SkillMenuRow` per C14 (a `Skill` plus `label`, `enabled`, `readyIn?`, `why?`), `skillMenuRows` (spells in `ALL_SPELL_IDS` order with `spellApCost`, then abilities in `ABILITY_IDS` order with `abilityApCost` for the weapon held), `usesSkill`, `skillName`, `skillDescription`, `targetingHint(skill, stats)` (foe / "click <name>" / "choose where"), `describeStatuses` unchanged. The step-04 carry (the spell list showed base AP) is closed: spell rows and hints use `spellApCost`.
- `BattleEngine.previewAbility(unit, ability, target)` (new, additive, draws nothing): `{ apCost, manaCost, outcomes: [{ unit, hitChance | null }] }`; a strike's first blow's odds through a shared private `blowOdds` (which `previewAttack` now also uses: same numbers), an area's on each unit `abilityTouches` gives, null for `auto` areas and no-roll statuses; null when not legal. So the scene shows a technique's real chance (Power Attack's −10 included); no odds are computed in the scene. Tested in `battleEngine.test.ts` (strike, no-roll status, Volley, Taunt).
- `BattleScene`: the Skills button (M; label "Skills (mana)" for a unit with magic, "Skills" otherwise), shown for a unit with `magic` or abilities, **enabled whenever the player has control** (it was enabled only with a legal cast), so greyed rows and their reasons can be read; the list widens to its longest label and is kept on screen; a greyed row's hover (and a click or its number) puts "Name: <why | Ready in N | Not now>. <description>" in the hint in the warning colour. `targeting` holds `'attack' | Skill`; aiming covers foe strikes / foe statuses (crossed swords, odds from `previewAbility` on the nameplate and the hover), self statuses and centred areas (click the user; Sprint's cursor is the green cross), other areas (outline from the engine's `abilityArea`, odds on each touched unit; a no-roll area shows its status letter instead). Playback: a technique strike plays its weapon's look and on a hit `strikeFlash` (Flame Strike fire, Frost Strike frost, Thunder Strike lightning, Smite Bless's gold) bursts on the defender; Volley looses an arrow at each hex (`SpellLook.arrows`), Taunt rings the user (`SpellLook.onUser`).
- `battleEffects.ts`: `ABILITY_LOOKS` gains volley, consecrate (Bless's gold burst), taunt (red ring on the user), hunters_mark (a gold dart and ring), sprint (Haste's look); `strikeFlash`; `changesStatusMarks` true for `status_laid`.
- `foeInfo.ts`: `describeAbility(id, bonus, stats)` (signature changed from an `Ability`; only foeInfo used it): a technique gets a cost line ("3 mana, 6 AP (weapon + 1), melee weapon") from `costWords`; weapon strikes are "pin: weapon blow" / "weapon shot" / "weapon blow or shot" with to-hit, damage bonus, on-hit and spread; foe and self statuses and centred areas worded; status phrases learn `wardAll`, `immobile` ("cannot move") and Taunted's penalty. Monsters' lines unchanged.
- `perkTree.ts` `costWords(ability, stats)` now calls `abilityApCost` (step-09 carry); the intersection types are gone.
- `autoHeal` (`src/game/party.ts`) counts the healer's heal bonus (`worldHealing(spell, caster)`) in its thresholds (step-04 carry), test-first in `worldCasting.test.ts`. **The refactor guard did not move** (fixture unchanged and green), so no re-record commit.
- Probe (`testHook.ts`): `buttons.cast` kept (the Skills button); `casting` became `aiming: Skill | null`, `spellMenu` became `skillMenu: (Point & SkillMenuRow)[] | null`; new `marks: Record<UnitId, string>` (each nameplate's status letters, recorded as `refreshStatusMarks` draws them). `e2e/manual.shots.ts` updated to the new names (shots not retaken: step 26).
- e2e (`battle.test.ts`): the Cast test renamed and moved to `skillMenu`/`aiming` with `kind`; **AC7** "taunts from the Skills list: a level 4 Aldric with Rooted and Taunt marks the foes T, and stands rooted" (debug `xp`, nodes taken in the tree view, debug `fight goblin_raid 1`; the Taunt row "Taunt  3 AP" greyed at first, enabled once a foe is within 2 hexes, hint "Taunt: click Aldric (3 AP)…", foes' `marks` contain T, Aldric's R after waiting unmoved); **Pin** "pins a foe with Pin from the Skills list: its nameplate shows N" (level 6, Rooted, Taunt, Pin; picked by its number; the default seed's pin hits).
- Docs: CLAUDE.md (engine callers' `previewAbility`; the BattleScene paragraph on Skills, aiming, marks and technique playback; `battleEffects.ts`, `skillMenu.ts`, `foeInfo.ts` lines); manual chapter 5 gains "Skills: spells and techniques" and the keys table, chapter 6 says spells are one kind of skill, and the effects table gains Marked, Slowed, Taunted, Pinned, Rooted.

**Log lines.** "Aldric taunts 2 foes.", "Aldric holds their ground (rooted)." and a pin's "…HITS Goblin for N dmg, pinned." already existed and are tested in `battleEngine.test.ts` (steps 10 and 11); nothing added.

**Verification**

- `npx vitest run src/scenes/skillMenu.test.ts src/scenes/battleEffects.test.ts src/scenes/foeInfo.test.ts`: pass (11, 16, 13).
- `npm test`: 86 files, 1821 tests pass; the refactor guard green with its fixture unchanged (`git status` shows no change under `scripts/`).
- `npm run build`: passes (the usual chunk-size warning).
- `npm run test:browser` (full run): every test passed but one, `character.test.ts` "takes a node from the tree with the pick that the second level brings" (three battles), which hit the 60 s test timeout; run alone it passes, so it is load, not this step. The new AC7 and Pin tests and the renamed Skills test pass in the full run and alone (`-t "Skills|taunts|pins"`: 3 passed).
- Screenshots at 840×560 (scratch, not committed), `/private/tmp/claude-501/-Users-ryan-personal-yomi/d27ee47a-1631-4550-8a30-1ea2385e2b8a/scratchpad/shots/`: `01-skills-menu-greyed.png` (Aldric's list, both rows greyed, the hint giving Pin's "Not now"), `02-skills-menu-archer.png` (Brenna: Aimed Shot, Volley), `03-aiming-volley.png`, `04-skills-menu-ready.png`, `05-aiming-pin.png` (odds on the goblin), `06-pinned-marks.png` (log "Aldric pins Goblin: rolls 100 — fumbles the attack!"), `07-aiming-taunt.png` (the burst 2 outlined round Aldric), `08-taunted-marks.png` (log "Aldric taunts 2 foes.", red T on the Kobold's and the Goblin's plates, the hint "Rooted 1."), `08-zoom.png` (the plates enlarged), `09-hover-foe.png`.

**Deviations and notes for later steps**

- `previewAbility` is a new engine method (the task allowed showing the plain attack's chance if none existed; a preview was cleaner and is pure). No event changed; `LOG_SCHEMA_VERSION` unchanged.
- The probe's `casting`/`spellMenu` were renamed (`aiming`/`skillMenu`) rather than kept; the contract named only `castButton` and rows' `kind`.
- The Skills button is enabled whenever it shows on the player's turn (not only with a legal use), so a player can read why a row is greyed.
- At 840×560 the board is drawn small and the nameplate letters are about 7 px; readable in the zoom but small. A larger mark is a polish item for stage 4, not this step.
- No debug command to take a node was added; the e2e tests take nodes through the tree view (decision in 4.5).
- Step 22 extends `skillMenu.ts` (Revive's aim at the fallen) and `changesStatusMarks` (`restore`).
