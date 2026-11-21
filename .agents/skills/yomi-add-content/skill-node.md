# Adding a skill-tree node

A perk (`PERKS` in `src/character/perks.ts`) is a node of the skill trees. Touch every line, then run `npm test`.

- `src/character/perks.ts` → `PERKS`: a new node of an existing shape is one entry there.
- `PERKS` is ordered by tree, path and tier, which is the order the tree view lays a path out in; put the entry where it belongs.
- Its cost is its tier's, from `TIERS` (`src/character/trees.ts`); no node is priced on its own.
- A node that gives a spell, technique or trait: `spell.md`, `ability.md`, `trait.md` (a hero's spell is taught by exactly one node).
- The perk-points invariant (`perkPoints + nodesCost(hero) == pointsAt(level)`) is in `src/character/CLAUDE.md`, "Perk points".
- A growth change retunes: `.claude/skills/yomi-balance/levers.md`, "When to retune".

## Tests that catch a miss

- `src/character/trees.test.ts` and `src/character/perks.test.ts` (tiers, depth, one teaching node).
- `scripts/simulate.test.ts`, if growth moved; see `yomi-balance`.
