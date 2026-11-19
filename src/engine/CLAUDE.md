# The battle engine and the AI

Loaded when working in `src/engine/`. The root `CLAUDE.md` has the module map; `src/combat/CLAUDE.md` the data the engine reads. **The full rules (every status, trait, aura, casting field, area rule and the policy's whole priority list) are in `docs/reference/battle.md`**; read the section you are touching before changing a rule.

## The engine's contract

`battleEngine.ts` is the battle state machine, the same in the game and the headless simulator. Callers only ever:

- ask: `legalActions(unit?)`, `previewMove`, `previewAttack`, `previewCast`, `previewAbility`, `getState()`;
- act: `step(action)`, which returns the `BattleEvent[]` it produced.

Nothing else may change a battle's state, and a scene must not decide outcomes.

- **Events are the engine's only output and the log format.** Bump `LOG_SCHEMA_VERSION` whenever an event's shape changes. Put detail in the event (AP spent and left, the numbers behind each roll) and keep `formatEvent`'s on-screen line short. `battle_start` records the seed and policies so any battle can be replayed.
- **Saving**: `snapshot()` gives the whole engine as plain data and `BattleEngine.restore` takes it up without starting anything over. It changes no events, so it needs no log bump, but a new field on `UnitRecord` or the snapshot is a save-shape change (raise `SAVE_VERSION`, and have `restore` take a missing field up as false or `[]`, as it does for `moved`, `attackedYet` and the rest).
- **`legalActions`** lists a unit's attacks, then casts (also when it lacks the AP to attack), then abilities. It never lists `equip`, so the AI never changes gear; gear changes reach the engine only as the scene's `equip` action carrying newly derived stats.
- A battle ends the moment a side is down (`checkWinner`); the player's side is judged first, so a cast that fells the last of both sides loses.

## RNG discipline

Replays and saved battles depend on every draw happening in the same order. Hold to this when adding any rule:

- **What draws**: a weapon attack (to-hit, then damage on a hit, damage dice skipped when it strikes a mirrored image); a hostile spell or rolled area, per unit touched in roster order, by the same `rollToHit` then dice; a routine's strikes, each as a plain attack. A policy draws from its own `rng`, a stream apart from the engine's (in the game, the battle's seed plus one).
- **What never draws**: on-hit (rune) effects, trait bonuses (`traitToHit`, `traitDamage`), Deadeye's pierce, Ambush's critical (no second draw), Unbreakable, Deathblow, Blademaster, auras, status and `auto` abilities, friendly spells, Revive, all turn-start restores, Rooted, Taunted's penalty, caster modifiers. A new rule of that kind must not draw either.
- **One helper, many readers.** The engine, its previews and the policy read the same functions, so a rule goes in one place and the odds shown stay true: `statsIn` (effective stats plus auras, at every roll and damage), `traitToHit` / `traitDamage`, `tauntPenalty`, `arcStruck`, `blowPierce` / `resistanceLeft`, `castTouches` / `abilityTouches`, `spellApCost` / `abilityApCost`. Every damage a unit takes goes through the one `applyDamage` (Unbreakable lives there).
- **`cast` and the ability path share `strikeUnit` and `aftermath`**, so a change to one must not change the other's draws.

## Turn-start order

As a side's turn begins (`startTurn`, which returns events), in this order: status ticks (unit by unit in roster order; a tick that ends the battle stops here), regeneration, then one pass each over the side's standing units in roster order for Renewing, Sanctuary, Serenity and Shadowdancer, then the ability recharge count-down. As a side's turn ends, before its statuses count down, the Rooted rule lays Rooted on unmoved units with the trait. The battle's first turn readies the player's side before `battle_start` is logged and runs these after it (`readySide`, `turnBegins`). Changing this order changes replays.

## The AI (`policies.ts`)

Policies are pure functions `({ state, legal, rng }) => Action`, registered in `POLICIES`; the game's enemy and both of the simulator's sides pick from the same registry (`aggressive`, `random`). `aggressive` picks the first applicable of a fixed priority list (revive, heal, cleanse, self-defence, taunt, support, area spells, control, mark, damage spell, best strike or technique or damaging area, Web, Sprint); the list and its scoring (`techniqueScore`, `STATUS_VALUE`, `MANA_WEIGHT`) are in the reference. It works only over what `legalActions` lists and what `castTouches` / `abilityTouches` say, so an enemy caster needs only a stat block with `magic`, and Taunt, Mark and Sprint are recognised by their data, not their ids.

`policies.test.ts` holds a snapshot of today's encounters' choices. A change that moves a monster's or bandit's choice fails it; re-record it only when the change is meant, and say why in the test's title as earlier re-recordings do. The simulator's refactor guard (`scripts/simulate.test.ts`) will usually move too.

## Checklists

**A new spell** (`SPELLS` in `src/combat/spells.ts`):
- its id in `SPELL_IDS` (a hero's, taught by exactly one node, `perkTeaching` in `src/character/perks.ts`) or `MONSTER_SPELL_IDS`;
- a look in `SPELL_LOOKS` (`src/scenes/battleEffects.ts`, a full `Record`, so `tsc` asks), and a sound if its element or school does not cover it (`spellSound`, `SPELL_SOUND_OVERRIDES` in `src/scenes/sounds.ts`);
- if the policy should cast it deliberately, a rule in `policies.ts`; else it is used only as the hardest-hitting spell or not at all;
- `isHealing` decides whether the world map, `autoHeal` and the heal reserve count it.

**A new status** (`STATUSES`, `STATUS_IDS`): a `mark` letter and colour; `hostile: true` if a foe lays it to harm (Purify ends it); anything not expressible as a `StatusRule` field needs engine code read through `effectiveStats` / `statsIn` so previews agree; `STATUS_VALUE` if the policy should value laying it.

**A new ability** (`ABILITIES`, `ABILITY_IDS`; monsters' first, techniques after): a node's `ability` to teach a technique; a sound in `ABILITY_SOUNDS` or a place in `SOUNDS_AS_ATTACKS` (`sounds.test.ts` enforces); an `ABILITY_LOOKS` or `STRIKE_FLASHES` entry for an area, status or elemental strike; AP read only through `abilityApCost`. The foe hover panel (`foeInfo.ts`) describes it from its data for free.

**A new trait** (`TRAIT_IDS` in `src/combat/combat.ts`): a node's `trait` switches it on (`traitsOf`); the engine reads it by name. Put its effect in the shared helpers (`traitToHit`, `traitDamage`, `applyDamage`, the turn-start passes, `auraBonus`) so previews and the policy see it; any per-unit state it needs goes on `UnitRecord` and the snapshot. A new event field from it bumps `LOG_SCHEMA_VERSION`; a new sound or float goes in `sounds.ts` / `battleEffects.ts`.

**A new element** (`ELEMENTS`): wards everywhere are `Partial<Record<Element, number>>`, and most readers iterate `ELEMENTS`; check those that key by name (`ELEMENT_SPELL_SOUNDS` in `sounds.ts`, the runes in `src/inventory/runes.ts`).

**Any event shape change**: bump `LOG_SCHEMA_VERSION`, update `formatEvent`, and check `eventSounds` (`sounds.ts`) and the battle playback (`eventSchedule.ts`, `battleEffects.ts`).
