# Combat data

Loaded when working in `src/combat/`. This is the data and arithmetic the engine reads; the rules it applies to them, and the engine's RNG discipline, are in `src/engine/CLAUDE.md`, which you should read before changing anything that moves a battle's outcome. The full detail of every field (spells, abilities, statuses, scaling) is in `docs/reference/battle.md`.

## The modules

- `combat.ts`: percentile attack resolution (a roll of 1 to 100 within `toHit` plus bonuses less armour class, kept between 5 and 95; critical when also within `critChance`), damage through `resistance` (`damageThrough`, `effectiveResistance`), the stat block (`CombatantStats`, where `magic` makes a caster), `ELEMENTS` and wards (`warded`), `TRAIT_IDS`, and foe scaling (`foeAtLevel`, `foeYardstick`).
- `spells.ts`: `SPELLS` as the engine casts them, `SPELL_IDS` (the heroes', each taught by one node), `MONSTER_SPELL_IDS`, `ALL_SPELL_IDS`, `isHealing`, the cost and range a caster's modifiers make (`spellApCost`, `spellRange`, read wherever a spell's AP or range is), and `STATUSES`, what each lasting effect does. Nothing here knows which perk teaches a spell.
- `abilities.ts`: `ABILITIES` by id (the monsters', `MONSTER_ABILITY_IDS`, first in `ABILITY_IDS`, then the heroes' techniques), and `abilityApCost`, through which every reader of an ability's AP must go.
- `rng.ts`: the seedable `mulberry32`, whose `state()` lets a saved battle roll on as the unsaved one would.

## Foe scaling and the yardstick

`foeAtLevel(base, level, native)` scales a stat block from its kind's native level: a level below the native counts as it; armour class, chance to hit, damage (abilities' too, `abilityDamageBonus`) and a caster's mana and skill grow with the levels above; hit points are as written at the native level and grow as a level 1 block's would.

`foeYardstick(level)` gives the ranges (armour class, chance to hit, hit points, mean damage a turn) a foe of that level should sit in, from the ready-made fighter's measured growth. A test in `src/game/encounters.test.ts` holds every monster kind to it at its native level; a field outside the range must be a named exception there. A new or retuned monster must pass it. `foeYardstick(level, 'expected')` reads the fighter in the expected kit (`KITTED_FIGHTER_GROWTH`): stage 11's kinds (`STAGE_11_KINDS` there) are held to it until stage 12.

## When you add data

- Adding a spell, status, ability, trait or element: `.claude/skills/yomi-add-content/`.
- A new `StatusRule` field or `Ability` field means engine code to apply it; keep it out of the RNG unless it is a roll.
- Ids are `as const` arrays whose order matters: `ALL_SPELL_IDS` and `ABILITY_IDS` order the battle's Skills list and the Abilities tab.
