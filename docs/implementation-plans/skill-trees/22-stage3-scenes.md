# Step 22: Stage-3 scenes

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R9, R15; §5.4 log lines, §5.6 battle effects, §4.7 edge cases) · [Feature record](../../features/skill-trees.md)

**Difficulty:** sonnet. The engine, the policy and the data are done (steps 17–21); this step makes the battle screen show what they produce, through the existing helper modules and paths. Reviewer: leave the model unset.

## 1. Objective

The battle screen plays every stage-3 event and status as the player should see it, and lets the player aim every stage-3 spell:

- a `restore` event floats "+N" in green over the unit (and refreshes its hit point bar or mana);
- a counter, a deathblow, an Unbreakable save (`endured`), a revival (`revived`), an ambush and a Blademaster refund each have a look, reusing existing effects, and a short log line;
- the nameplates show the new status marks **I** (Frozen) and **U** (Renewing), and are redrawn after a `restore` or `status_laid` event;
- Revive is aimed at a fallen ally's hex (the fallen unit stays clickable as a target while Revive is being aimed);
- Glacial Prison, Ice Lance, Holy Light, Purify and Renew play through the existing spell paths (`SPELL_LOOKS`);
- the character panel's Abilities tab lists the new spells; Purify and Revive are not world-map heals, so they show no Cast button there.

No rule changes. The refactor guard stays green.

## 2. Requirements and context

- **R9:** the player uses a hero's actives from the one Skills list; stage 3's spells are on it, aimed as their target asks.
- **R15:** the manual and e2e tests are brought up to date for these screens.
- **Design §5.4, `formatEvent`'s short lines** (the engine's `formatEvent`, added in steps 17–20; this step checks they read so and fixes the wording if not):
  - "Brenna strikes back." (a counter)
  - "Mira endures the blow." (an Unbreakable save)
  - "Sera's sanctuary restores 3 to Aldric." (a `restore` with cause `sanctuary`; renewing and serenity read alike: "Aldric is renewed for 3.", "Sera regains 2 mana.")
  - "Aldric holds his ground (rooted)." and "Goblin is pinned." are stage 2's and stay.
- **Design §5.6, `battleEffects.ts`:**
  - `changesStatusMarks` covers `status_laid` and `restore`.
  - A `restore` event floats "+3" in green, as a heal does.
  - A technique strike plays its weapon's `attackLook` (stage 2; unchanged).
- **Design §4.7, edge cases this step must show correctly:** Revive on a hex now taken by another unit is illegal (the engine refuses it; the target is not offered); a unit revived this battle may be revived again only by another caster (`usedOnce`), so the row is greyed for the first caster.

### Decisions from the index (unchanged)

- **2. The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
- **8. `LOG_SCHEMA_VERSION`** 25 from step 09 (the first stage-2 step to change an event); steps 10 and 11 change shapes under 25. 26 from step 17; steps 18 to 20 under 26.

This step changes no event shape: `LOG_SCHEMA_VERSION` stays 26 and `SAVE_VERSION` stays 25.

### Contracts (copied unchanged from the index)

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

**C14. The Skills menu (step 14; extended by 22):**

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

The status table rows this step draws (C6): `frozen`, mark **I**, helpless, does not wake on damage; `renewing`, mark **U**, regen 3. Their colours are in `STATUSES` (step 20).

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make test-browser`).
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npm run test:browser` (or `-- -t <name>`) after any scene change, which this step is; read `e2e/CLAUDE.md` before adding an in-browser test.
- **The refactor guard** must stay green unchanged (decision 2). Do not edit its fixture.
- **Domain first.** Scenes decide nothing; Phaser-free helpers in `src/scenes/` (`battleEffects.ts`, `skillMenu.ts`, `sounds.ts`, `eventSchedule.ts`) stay free of runtime Phaser imports and carry the tests.
- **`tsc` is the linter** (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `.ts` extensions).
- **Commits.** One commit for this step once `npm test` and `npm run test:browser` pass, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 22: stage-3 scenes". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: the scene-layer paragraph on `battleEffects.ts` (restore floats, `changesStatusMarks`), `BattleScene`'s aiming (a fallen ally for Revive) and the Abilities tab. Search it for every name you rename.

## 3. Dependencies and prerequisites

- **Steps 17–20 (done):** the events and fields of C13 exist; `formatEvent` has lines for them; `frozen` and `renewing` are in `STATUSES`; the six special spells are in `SPELLS` with `SpellTarget` `'fallen'` for Revive; `legalActions` lists a Revive cast with `target` set to the fallen ally's id.
- **Step 21 (done):** the stage-3 nodes are in `PERKS`, so a hero can learn the special spells and traits; the policy uses them.
- **Step 14 (done):** `skillMenu.ts` (C14), the Skills button (M), `targeting` for spells and abilities, the effects of stage 2.
- **Existing code to read first:** `src/scenes/battleEffects.ts` (`attackLook`, `SPELL_LOOKS`, `ABILITY_LOOKS`, `impactMs`, `bonusText`, `changesStatusMarks`), `src/scenes/eventSchedule.ts`, `src/scenes/sounds.ts`, `src/scenes/skillMenu.ts`, `BattleScene`'s event playback and board-click handling (`targeting`), `InventoryScene`'s Abilities tab and `src/character/worldCasting.ts` (`worldSpells`).

## 4. Scope and implementation guidance

### 4.1 `battleEffects.ts`

- `changesStatusMarks(event)` is true for `status_laid`, `restore`, a `cast` with any `revived` outcome and a `status_end` of reason `cleansed`.
- A `restore` event: floating "+N" in the heal's green over the unit for `hp`, and "+N mana" in the mana colour for `mana` (one float each when both). Reuse the heal float's style and layer.
- Looks, reusing existing ones (no new sprites): a counter is an ordinary blow (`attackLook`); a deathblow plays the blow, then the fall, with the float "Deathblow" at its own size; `endured` floats "Endures" and refreshes the shield's mark; a `revived` outcome plays the heal's impact and stands the figure back up (alpha, pose and nameplate restored); an ambush or `apRefunded` floats a short word ("Ambush", "+N AP") over the attacker.
- `SPELL_LOOKS` entries for `ice_lance` and `glacial_prison` (frost look), `holy_light` (gold bolt), `purify` and `renew` (heal look; Renew's area as Heal All's), `revive` (heal look on the fallen hex). An entry that reuses another's look says so.

### 4.2 `eventSchedule.ts` and `sounds.ts`

- `restore` events take the heal's slot in the schedule; several at a turn's start play together, as status ticks do. Check `impactMs` holds later events for the new looks.
- `sounds.ts` maps `restore` to the heal sound, a counter and a deathblow to the hit sound, `revived` to the heal sound. No new sound files.

### 4.3 `skillMenu.ts`

- `targetingHint` for a spell of target `'fallen'`: "Revive: choose a fallen ally (20 mana, 6 AP). Esc or Cancel to go back." (mana and AP from `spellApCost`).
- A once-per-battle spell already in the caster's `usedOnce` is greyed with `why: "Once a battle"`.

### 4.4 `BattleScene`

- While aiming a `'fallen'` spell, a click on a fallen ally's hex picks it if `legal` holds a cast at that unit; fallen figures stay on the board while Revive is aimed and are outlined as targets, with the green cross cursor. A hex taken by a standing unit offers nothing.
- After a `revived` outcome, the unit's figure, nameplate and portrait (`PartyColumn`) show it standing again at its hit points.
- Nameplates draw **I** and **U** from `STATUSES` as any other mark.

### 4.5 `InventoryScene` (Abilities tab)

- Lists the new spells with kind, AP (`spellApCost`), mana and recharge. `worldSpells` stays the source of world-map heals; Purify and Revive are not among them, so no Cast button shows for them. Check the list fits at 840×560 for a hero with every Healer and Saint spell.

### 4.6 Manual

- Section 5 (Battle): Revive's aim at a fallen ally, the new floats ("Endures", "Deathblow", "+N" restores), the marks I and U.
- Section 6 (Magic): the six special spells in a sentence each, from design §4.3. Screenshots are step 26's.

### 4.7 Exclusions

No engine, policy, data or simulator change. No new sprite or sound file. No screenshots.

## 5. Verification

### Tests (in `npm test`)

- `battleEffects.test.ts`: `changesStatusMarks` true for `status_laid`, `restore`, a revived cast, a cleansed `status_end`; the restore float's text and colour; a `SPELL_LOOKS` entry for each of the six new spells.
- `skillMenu.test.ts`: Revive's hint; Revive greyed with "Once a battle" when in `usedOnce`; enabled only when `legal` holds a cast.
- `sounds.test.ts` / `eventSchedule.test.ts`: the `restore` mapping and slot.
- Scene smoke tests (`*Scene.test.ts`) still pass.
- The refactor guard green, fixture untouched.

### In-browser (`npm run test:browser`, required: this step changes scenes)

- `e2e/battle.test.ts`, one short new test on a fixed seed: through the debug console, give a hero Revive and enough level and mana, start a `fight`, set an ally's hit points to fall (or let it fall), open Skills (M), pick Revive, click the fallen ally's hex, and see it stand (probe: its hp > 0) and the log line. Add any probe field it needs to `BattleScene.probe()` and `src/testHook.ts`.
- Every existing in-browser test passes.

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm run test:browser
```

### Acceptance

- A stage-3 battle in the dev server (`npm run dev`, a debug `fight`) shows restores, a revival and the marks I and U as described, with no console error.

## 6. Completion criteria

- [ ] `battleEffects.ts`, `eventSchedule.ts`, `sounds.ts`, `skillMenu.ts`, `BattleScene`, `InventoryScene` changed as section 4 says, with the helper tests.
- [ ] The new in-browser Revive test passes, and the whole `npm run test:browser` run passes.
- [ ] `npm test` passes; the guard fixture is unchanged.
- [ ] Manual sections 5 and 6 and `CLAUDE.md` updated.
- [ ] Committed as "Skill trees step 22: stage-3 scenes"; the index's step table shows `done (<commit>)`.

## 7. Execution record
