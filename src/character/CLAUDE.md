# Characters and progression

Loaded when working in `src/character/`. Items and runes have their own guide in `src/inventory/CLAUDE.md`. The full rules, with every formula and number, are in `docs/reference/characters.md`; the skill trees' design is `docs/designs/skill-trees.md`.

## The modules

- `character.ts`: the `Character`, `maxHp`, `maxMana`, `deriveCombatStats` (a character to the engine's `CombatantStats`), equipping and `clampHp`.
- `attributes.ts`, `skills.ts`, `perks.ts`: the three tables, with the rules for raising a skill (`raiseSkill`, `skillRaiseRefusal`) and qualifying for a node (`missingRequirements`).
- `trees.ts`: the trees, their paths and tiers (`TIERS`), depth, the calling and the capstone.
- `creation.ts`: character creation; a `CharacterDraft` is what the player chose and `draftCharacter` the level 1 `Character` it makes. The screens call its functions and decide nothing.
- `progression.ts`: experience and levels, perk points (`pointsAt`, `canAffordPerk`, `affordableAt`), `takePerk`, and `autoAdvance` with its plans (`AUTO_PLANS`) for the simulator and the bandits.
- `worldCasting.ts`: healing on the world map, which rolls nothing (the average of the dice plus the heal bonus).
- `portraits.ts`: the preset faces (`PORTRAIT_IDS`); a portrait is only looks.

## Derived, never stored

A character stores only what it was born with (`attributes`, `tagged`), what it has learned (`level`, `trained`, `perks`, `perkPoints`), what it has left (`hp`, and `mana` through `manaOf`) and what it carries. Every number it fights with is derived:

- `character.attributes` is the birth value; every reader goes through `attributeLevel`, which adds what nodes raised, never past 10.
- `skillLevel` is the skill everywhere, the skill nodes' 10% included, so it counts towards what another node asks.
- `maxHp` and `maxMana` are worked out from attributes, level, nodes and worn gear, so raising an attribute changes past levels' hit points at once (skill points already handed out stay banked).
- `deriveCombatStats` gives the engine everything else: weapon skill, strength shortfall, wards, abilities, traits, spell modifiers.

Never add a stored copy of any of these; add to what derives it.

## Hit points when gear changes

A Life rune's `maxHp` is the only thing that moves maximum hit points, so every change to what a character wears ends with `clampHp(character, maxBefore, rule)`, the maximum read before the change. Outside battle the rule is `'share'`: the hero keeps its share of hit points, never to 0 from a positive value and never above the new maximum. In battle it is `'cap'`, as the engine's `equip` only lowers hit points to the new maximum; `BattleScene` hands the panel that rule as `hpRule`. `equipFromBackpack`, `unequipToBackpack` and `dropEquipped` take the rule, and any new way of changing worn gear must too.

## Import cycles

`skills.ts` and `perks.ts` import each other, and so do `perks.ts` and `trees.ts`. This is safe only while neither calls the other as its module loads: no top-level code that reads another module's tables or calls its functions.

## Nodes are data

A perk (`PERKS`) is a node of the skill trees: four trees of three paths, each node its `path`, `tier`, asks (attributes, skills, `anySkill`, a `requires` in its own path) and effects (`PerkEffects`, summed by `perkBonus` wherever the number is derived), or the `spell`, `ability` or `trait` it gives. `PERKS` is ordered by tree, path and tier, which is the order the tree view lays a path out in. A spell or a technique is a node like any other, and a trait is read by the engine by name (`TRAIT_IDS`). A new node: `.claude/skills/yomi-add-content/skill-node.md`.

- Every node has one rank and costs its tier's points (`TIERS`: 1, 2, 3, and 4 for a capstone); no node is priced on its own. `nodesCost` sums the nodes held.
- A tier asks a level and a depth (nodes held in its path, not points).
- A capstone also asks that its path be the hero's calling (`calling`, the path or paths with the most nodes, derived, ties all counting) and that the hero hold no capstone (`capstoneOf`): taking one closes every other.
- Asks gate taking a node, never keeping it.

## Perk points

A level brings one perk point; creation gives three. For a hero never migrated, `perkPoints + nodesCost(hero) == pointsAt(level)` always holds; a test checks it, and anything that grants or spends points must keep it. Points are spent on the world map, never in battle, as stats changed mid-battle would have to reach the engine through an `equip` action.

`autoAdvance` picks a target again and again: the first node of the plan it qualifies for or would at a higher level, else the first non-capstone in `PERKS` order it qualifies for now. While the target is short of level or points it stops and saves, never spending on a cheaper node further down; a node short of anything waiting will not bring (depth, a skill, an attribute, the node it requires) is skipped. A parity plan names its capstone first so that it is saved for.

## Creation

`draftCharacter` spends the draft's points with `raiseSkill` and `takePerk`, so creation has no rules of its own and waives nothing; a change that leaves a chosen node unqualified drops it and returns its point (`pruneDraft`). The prerolls, the ready-made three among them, are drafts held to the same rules by a test.

A change to hero growth moves balance: `.claude/skills/yomi-balance/` (`levers.md`, "When to retune").
