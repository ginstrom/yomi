# Step 29: Perk points in the UI

[Plan index](index.md) (Stage 5) · [Amendment design](../../designs/skill-trees-node-costs.md) §4.5, §4.6, §4.7, §5.5, §7.1 (perkTree, browser), NC4, NC7 · [Main design](../../designs/skill-trees.md) · [Feature record](../../features/skill-trees.md) (Notes carried forward)

**Difficulty:** sonnet. Engineer `model: "sonnet"`, reviewer `model: "sonnet"`. Every word and the node geometry are fixed by the design; the work is placing a digit in the node, rewording, renaming two probe fields and updating the in-browser tests. Escalate to the orchestrator if the digit cannot fit the labels at 840×560 without changing `NODE_W` or the font.

## 1. Objective

The player sees what a node costs and how many perk points the hero holds, everywhere picks were shown: a cost digit in every node of the tree view, the strip's asks line with the cost, "Perk points" in the Skills tab, the tree header and creation, the creation rule line, and the probes and in-browser tests to match. Two carried-forward notes are folded in. No play changes.

## 2. Requirements and context

- **N7:** "The tree view shows each node's cost and the perk points the hero holds. The strip states the cost and why a node cannot be afforded. Creation, the Skills tab and the victory screen say "perk points", and never use "pick" or a bare "points"."
- **NC4:** "Creation shows "Perk points: 3 of 3", allows three T1s and plays as before. The pre-rolls are legal."
- **NC7:** "In the browser at 840×560, every node shows its cost inside its frame. The status reads "Perk points: N". An unaffordable open node's hint names the points it needs and the level. No screen says "pick"."

### Design §4.6, restated

The two currencies are told apart by always naming them in full: **Skill points** (the skills' + buttons) and **Perk points** (the trees). The game never shows "points" or "pick" on its own.

- **Tree view, each node.** The cost is a digit at the node's right inner edge. It reserves `NODE_COST_W` (14 px) of the label area, and the label is centred in what is left. The digit is gold while the node is open and affordable, and dim otherwise. A taken node shows ✓ in its place, and a locked capstone ✕. Long names already shrink and wrap (`PerkTreeView`). A test holds every node's label and cost inside `NODE_W` at 840×560.
- **Tree view, header.** `buildPerkStatus` shows `Perk points: N`, gold when some open node is affordable on the world map, dim otherwise or in battle. "Next pick at level N" goes.
- **Strip.** The asks line: `Costs 3 perk points. Asks: Level 6, Melee 55%, 3 nodes in Heavy Knight`. The hint words are step 28's (C17).
- **Skills tab.** `Skill points: N` stays over the skills column; the perk status beside it reads `Perk points: N`.
- **Creation** (§4.5): header `Perk points: N of 3` (was `Picks: N of 3`); rule line *"3 perk points. One more with every level. A node costs 1 to 4 by its tier. Any path, any tree; only your deepest path may open its capstone."*, which must fit the strip at 840×560 as today's does (if not, drop "Any path, any tree; "); the summary's "picks" row reads "perk points".
- **Test hook:** `perkPicks` becomes `perkPoints` in both probes.

Edge case (§4.7): a node the hero qualifies for but cannot afford shows as open (pale lines); its digit is dim and its hint says how many points it needs; a click does nothing.

### Decisions (index, stage 5)

- **13.** Step 28 already wrote `nodeHint`, `draftNodeHint`, the Skills tab's status text (`Perk points: N`, today's colour rule), the debug line and the victory line. This step does the rest of what the player sees.
- **15.** No play changes: the refactor guard and the policy snapshot must stay green **unchanged**; a mismatch is a bug.

### Contracts (copied unchanged from the index)

**C17 (consumed; produced by step 28)**

```ts
// src/character/perks.ts
export function perkCost(perk: PerkId): number                          // TIERS[PERKS[perk].tier].cost; no per-node override
// src/character/creation.ts
export const CREATION_PERK_POINTS = 3                 // replaces CREATION_PERK_PICKS
export function perkPointsLeft(draft: CharacterDraft): number   // replaces perkPicksLeft: CREATION_PERK_POINTS less the cost of draft.perks
// src/character/progression.ts
export function canAffordPerk(character: Pick<Character, 'perkPoints'>, perk: PerkId): boolean        // perkPoints ≥ perkCost(perk)
export function affordableAt(character: Pick<Character, 'level' | 'perkPoints'>, perk: PerkId): number  // level + max(0, perkCost(perk) − perkPoints)
// canAdvance: skillPoints > 0, or some node of availablePerks(character) that canAffordPerk
// qualifiesFor, availablePerks, missingRequirements, describePerkRequirements: unchanged (asks only, never points)
```

Strip hints (`src/scenes/perkTree.ts`, written in step 28; lock and "Not yet" words unchanged):

- `nodeHint`, open and `canAdvance` false: `Perk points are spent on the world map`
- open and affordable: `Click to take (3 of your 4 perk points)`
- open and short: `Needs 3 perk points; you have 1 (level 9)`, the level being `affordableAt`
- singular where the number is 1: `1 perk point`
- `draftNodeHint`, open with none left: `No perk points left`

**C20. The tree view's cost (this step)**

```ts
// src/scenes/perkTree.ts
export const NODE_COST_W = 14     // px of the node's label area reserved at its right inner edge; the label centred in what is left
export type CostTone = 'gold' | 'dim'
export function costTone(character: Character, perk: PerkId, canAdvance: boolean): CostTone | null
  // null for a taken node (✓ in the slot) or a locked capstone (✕); gold when open, affordable and canAdvance; else dim
export function draftCostTone(draft: CharacterDraft, perk: PerkId): CostTone | null   // the same for creation
export function nodeAsks(perk: PerkId): string
  // "Costs 3 perk points. Asks: Level 6, Melee 55%, 3 nodes in Heavy Knight"; "Costs 1 perk point." with no asks
// src/testHook.ts: CreationProbe.perkPicks and InventoryProbe.perkPicks are renamed perkPoints;
//   each entry of both probes' `perks` gains cost: number
```

Words: the Skills tab and tree header `Perk points: N` (gold when some open node is affordable on the world map, dim otherwise or in battle); creation's header `Perk points: N of 3`; creation's rule line "3 perk points. One more with every level. A node costs 1 to 4 by its tier. Any path, any tree; only your deepest path may open its capstone." (drop "Any path, any tree; " if it does not fit at 840×560); the victory line `Aldric reaches level 5: +6 max HP, 3 skill points, 1 perk point, wounds healed`; the debug console `N perk points`. No screen shows "pick" for a perk or a bare "points".

## 3. Dependencies

- **Step 28** (done): C17 in the domain; `nodeHint`/`draftNodeHint` with the new words; `InventoryScene.buildPerkStatus` reading `Perk points: N`; the probes still named `perkPicks` but reading `perkPoints`.
- Existing: `PerkTreeView.ts` (draws nodes, ✓ and ✕, the strip; line ~265 builds `Asks: ${describePerkRequirements(perk)}`), `perkTree.ts` (`NODE_W` 196, `nodeRect`, `nodeLabel`, `nodeSummary`, `clampLines`, the strip test that holds every node inside the panel), `InventoryScene.ts` (tree help text near line 183: "A pick comes with every even level…"; `buildPerkStatus`; the probe's `perkPicks` near line 425), `CreationScene.ts` (`PERKS_RULE` line ~102, the header near line 428, the summary near line 498, the probe near line 233), `src/testHook.ts` (`perkPicks` at lines ~99 and ~394; `perks` entries at ~110 and ~425).

## 4. Scope and guidance

- `perkTree.ts`: `NODE_COST_W`, `CostTone`, `costTone`, `draftCostTone`, `nodeAsks` (C20). `describePerkRequirements` stays as it is (other readers; the manual's tables).
- `PerkTreeView.ts`: draw the digit in the reserved slot with its tone, ✓ or ✕ in the same slot; the label centred in `NODE_W − NODE_COST_W` (plus its insets); the strip's asks line from `nodeAsks`. The view takes the tone from its caller as it takes what a click does (the panel and creation each pass `costTone` or `draftCostTone`), so the view decides nothing.
- `InventoryScene.ts`: the header/status colour rule (gold only on the world map when some open node is affordable); the tree help text reworded without "pick" (e.g. "A perk point comes with every level; a node costs 1 to 4 by its tier…"), keeping it within its lines at 840×560; probe `perkPoints`, node `cost`.
- `CreationScene.ts`: header, `PERKS_RULE`, the summary row, probe `perkPoints`, node `cost`.
- `src/testHook.ts`: the renames and `cost` (C20).
- Search `src/scenes` and `src/game/party.ts` for "pick" in player-facing strings (`grep -rn -i "pick" src/scenes src/game/party.ts`): what remains must be about items or heroes (pick up, picked hero, picking a face, picking a spell from the list), never perks.

### Carried-forward notes (feature record)

- `CLAUDE.md` line 118: the character panel opens over `Battle` with "(C, S, B, I)"; it is "(C, S, I; B within the panel)". Fix it.
- `src/scenes/skillMenu.test.ts` ~line 103 ("checks the weapon first, then once a battle, the recharge, mana, AP and range, in that order"): it checks only recharge against weapon. Make it check the full order of reasons the test's name claims (weapon before recharge, recharge before mana, mana before AP, AP before range), each pair with a staged unit that fails both, as the neighbouring tests stage them. Test-only; `skillMenu.ts` does not change unless the test exposes a wrong order (then report it).

### Tests

- `perkTree.test.ts`: every node's label and cost digit fit within `NODE_W` (for all four trees, with the label's font size as `PerkTreeView` renders it; reuse how the existing fit test measures); `costTone` and `draftCostTone` (taken, locked, open affordable, open short, closed, in battle); `nodeAsks` wording, singular and plural, with and without asks.
- In-browser (`npm run test:browser`; read `e2e/CLAUDE.md` first):
  - every `perkPicks` in `e2e/` renamed `perkPoints` (`battle.test.ts`, `character.test.ts`, `party.test.ts`), and any assertion on old words updated;
  - creation shows "Perk points: 3 of 3" (probe `perkPoints` 3) and three T1s can be taken;
  - on the world map, a level-2 hero with 1 point cannot take a T2: a click on it changes nothing, its hint says it needs 2 perk points and the level, and after the next level it is taken;
  - the tree probe's nodes carry their costs (a T1 1, a capstone 4).

### Docs

- `CLAUDE.md`: line 118's fix; the scene lines this step makes wrong (the Skills tab's "Next pick at level N while no pick waits", `perkTree.ts`'s strip and node description, `PerkTreeView.ts`'s, creation's perks step and "Picks"). Search it for `perkPicks` and fix each line.
- The manual's text and screenshots are step 31's.

### Shared constraints (from the index)

- **Environment.** Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`.
- **Commands:** `npm test` before the commit; `npx vitest run <file>`; `npm run test:browser` (or `-- -t <name>`).
- **Scenes decide nothing**; `perkTree.ts` stays free of runtime Phaser imports; a control a test needs goes in the probe.
- **`tsc` is the linter.**
- **The refactor guard and the policy snapshot stay green unchanged** (decision 15).
- **Commits.** On `skill-trees`, no push, no attribution lines: "Skill trees step 29: perk points in the UI".

## 5. Verification

- `npm test` green with the guard unchanged.
- `npm run test:browser` green.
- `npm run build` passes.
- Screens checked at 840×560 in the browser (the panel's tree view on the world map and in battle, creation's perks step): every digit inside its node, labels readable, the rule line on its lines. Attach or describe the check in the record (screenshots to the scratchpad, not committed; step 31 retakes the manual's).
- `grep -rn "perkPicks" src e2e CLAUDE.md` finds nothing.

## 6. Completion criteria

- [ ] C20 implemented; NC4's words and NC7 met.
- [ ] The two carried-forward notes done.
- [ ] e2e updated and the new checks added; all green.
- [ ] `CLAUDE.md` current for the scenes this step changed.
- [ ] Index step 29 status `done (<commit>)`; record lists any wording that had to be shortened to fit.

## Execution record
