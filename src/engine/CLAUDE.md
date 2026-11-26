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
- **What never draws**: on-hit (rune) effects, trait bonuses (`traitToHit`, `traitDamage`), Deadeye's pierce, Ambush's critical (no second draw), Unbreakable, Deathblow, Blademaster, auras, status and `auto` abilities, friendly spells, Revive, all turn-start restores, Rooted, Taunted's penalty, caster modifiers, the immunity (`refusesStatus`, checked in `layStatus`: a refused status changes no draw). A new rule of that kind must not draw either.
- **One helper, many readers.** The engine, its previews and the policy read the same functions, so a rule goes in one place and the odds shown stay true: `statsIn` (effective stats plus auras, at every roll and damage), `traitToHit` / `traitDamage`, `tauntPenalty`, `arcStruck`, `blowPierce` / `resistanceLeft`, `castTouches` / `abilityTouches`, `spellApCost` / `abilityApCost`. Every damage a unit takes goes through the one `applyDamage` (Unbreakable lives there).
- **`cast` and the ability path share `strikeUnit` and `aftermath`**, so a change to one must not change the other's draws.

## Turn-start order

As a side's turn begins (`startTurn`, which returns events), in this order: status ticks (unit by unit in roster order; a tick that ends the battle stops here), regeneration, then one pass each over the side's standing units in roster order for Renewing, Sanctuary, Serenity and Shadowdancer, then the ability recharge count-down. As a side's turn ends, before its statuses count down, the Rooted rule lays Rooted on unmoved units with the trait. The battle's first turn readies the player's side before `battle_start` is logged and runs these after it (`readySide`, `turnBegins`). Changing this order changes replays.

## The AI (`policies.ts`)

Policies are pure functions `({ state, legal, legalFor?, rng }) => Action`, registered in `POLICIES`; `autoPlay` lists `legal` only when a policy reads it and gives `legalFor(unit)`, one unit's actions, which `aggressive` reads (it weighs a unit at a time), so a step lists only the units it weighs: `legalFor(u)` must stay `legal`'s actions of `u`, end_turn left out, in order; the game's enemy and both of the simulator's sides pick from the same registry (`aggressive`, `random`). `aggressive` picks the first applicable of a fixed priority list (revive, heal, cleanse, self-defence, taunt, support, area spells, control, mark, damage spell, best strike or technique or damaging area, Web, Sprint); the list and its scoring (`techniqueScore`, `STATUS_VALUE`, `MANA_WEIGHT`) are in the reference. It works only over what `legalActions` lists and what `castTouches` / `abilityTouches` say, so an enemy caster needs only a stat block with `magic`, and Taunt, Mark and Sprint are recognised by their data, not their ids.

`autoPlay.ts` is the one loop that steps a battle by policies (the simulator and the game): it draws nothing itself, each side's policy drawing on the stream it is given, and it never abandons a battle it stops (`over: false`).

`policies.test.ts` holds a snapshot of today's encounters' choices: re-record it only when the change is meant (`.claude/skills/yomi-balance/guards.md`).

## Checklists

Adding a spell, status, ability, trait, element or battle event: `.claude/skills/yomi-add-content/`.
