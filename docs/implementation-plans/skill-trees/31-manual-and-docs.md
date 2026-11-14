# Step 31: Manual, screenshots and CLAUDE.md

[Plan index](index.md) (Stage 5) · [Amendment design](../../designs/skill-trees-node-costs.md) §5.7 (the manual), N8, NC8, NC9 · [Main design](../../designs/skill-trees.md) · [Feature record](../../features/skill-trees.md)

**Difficulty:** sonnet. Engineer `model: "sonnet"`, reviewer `model: "sonnet"`. The words and the figures are fixed by the design and step 30; the work is rewriting the manual's sections, retaking screenshots and restating `CLAUDE.md`'s rules from step 30's figures.

## 1. Objective

The player's manual describes perk points and node costs and shows them in retaken screenshots; `CLAUDE.md`'s rules of perks, progression and scaling are restated with the amendment's figures; the final gates pass.

## 2. Requirements and context

- **N8:** "The manual, `CLAUDE.md`, the e2e tests and the affected screenshots are brought up to date."
- **NC8:** "The manual describes perk points and costs, and its screenshots are retaken. `CLAUDE.md` is current, with no `picksAt`, `perkPicks` or "pick at every even level" left."
- **NC9 (final gates):** `npm test`, `npm run test:browser` and `npm run build` pass.

### Design §5.7, restated (the manual, `docs/manual/README.md`)

- Chapter 3's "Picks, perks and spells" (line ~79) becomes "Perk points, perks and spells", with the new rule line ("3 perk points. One more with every level. A node costs 1 to 4 by its tier. Any path, any tree; only your deepest path may open its capstone.", or as step 29 shortened it to fit; quote the screen as it is) and one sentence: a node costs its tier's points (1, 2, 3, a capstone 4), and unspent points are kept. Every "pick" about perks in the chapter (lines ~83, 91, 99) becomes perk points.
- Each new level brings "1 **perk point**"; the "Next pick at level N" clause is removed (line ~475, and the Skills tab paragraph near line 226).
- "Building a hero" gains the cost table (tier, level, depth, cost: T1 L1 0 1; T2 L2 1 2; T3 L6 3 3; capstone L12 5 4) and the sentence: "Points you save buy deeper nodes; a hero who stays in one path reaches its tier 3 at level 6 and its capstone at 12, and one who mixes paths holds more nodes but reaches a capstone later."
- The tree-view paragraph (near line 230) says what the digit on a node means (its cost; gold when you can take it now, dim otherwise; ✓ taken, ✕ locked) and what the header's "Perk points: N" is.
- Spells bought "with a pick like any other" (line ~403) become "with perk points like any other node"; line ~485 ("a pick buys it once") likewise.
- Retake `creation-perks.png`, `creation-spells.png`, `panel-level-up.png` and every image of the tree view (`panel-perk-tree.png`, and any other the shots script takes of the trees or the Skills tab, `panel-skills.png` among them).

### `CLAUDE.md` (design §5.3, §7.2 step 8)

- The rules of scaling, progression and perks restated with step 30's final figures and any lever it moved (`banditGear`, `FOE_HP_PER_LEVEL`, counts), in the style of the existing stage paragraphs ("Skill trees stage 1 (…): one party … of 500…"), adding an amendment paragraph after stage 3's: the costs, the rate, the figures, and what moved.
- The bandit plan lines restated from the plan tests (C18's table, or as step 30 moved it).
- No `picksAt`, `perkPicks`, `PICK_LEVEL_STEP`, "pick at every even level" or "a pick" about perks left.

### Contracts (consumed)

**C18's node levels (or as step 30 left them; read the plan tests):**

| Hero or role | Levels |
| --- | --- |
| Aldric (`knight`) | Rooted 3, Taunt 5, Pin 8, Iron Skin 11, Unbreakable 15 |
| Brenna (`ranger`) | Aimed Shot 3, Volley 6, Far Shot 8, Deadeye 12 |
| Delwyn (`evoker_healer`) | Flame Arrow 3, Fireball 6, Heal All 8, Pyromancy 10, Meteor 14 |
| Captain | Rooted 3, Taunt 5, Pin 8 |
| Brute | Power Attack 3, Armour Breaker 5, Cleave 8 |
| Archer, Crossbowman | Aimed Shot 3, Volley 6 |
| Hedge-Mage | Flame Arrow 3, Destruction 4, Fireball 7 |

**C17 (the figures the manual states):** `TIERS` costs 1/2/3/4; 3 perk points at creation; 1 at every level; `pointsAt(L) = L + 2`.

## 3. Dependencies

- **Step 30** (done): final figures in the index's Stage 5 Measurement table and the feature record's Amendment table; any lever moved, in its record.
- **Step 29** (done): the screens' final words (the rule line as it fits).
- Existing: `e2e/manual.shots.ts` (`npm run manual:screenshots`, `vitest.manual.config.ts`; shots `creation-spells` ~line 59, the `p`/`trees`/`panel-perk-tree` entry ~line 84, `panel-level-up` ~line 161); the manual's section 11 node tables (generated from the code in step 26; unchanged by costs unless it states picks).

## 4. Scope

**In:** `docs/manual/README.md`, `docs/manual/images/*.png` (retaken), `CLAUDE.md`, the index (step status), this file's record. If the shots script needs a staged state to show a cost digit or an unaffordable node, adjust `e2e/manual.shots.ts`.

**Out:** code, tuning, the feature record's decision log.

### Shared constraints (from the index)

- **Environment.** Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`.
- **Commands:** `npm run manual:screenshots`; `npm test`; `npm run test:browser`; `npm run build`.
- **Commits.** On `skill-trees`, no push, no attribution lines: "Skill trees step 31: manual, screenshots and CLAUDE.md".

## 5. Verification

- `grep -n -i -E "picksAt|perkPicks|PICK_LEVEL_STEP|even level|a pick|picks" CLAUDE.md docs/manual/README.md`: every remaining hit is about items, heroes or choosing from a list, not perks.
- Each retaken image viewed (Read the PNG): the cost digits visible, "Perk points" in the header, no "Picks".
- `npm test`, `npm run test:browser` and `npm run build` pass (NC9's gates).

## 6. Completion criteria

- [ ] Manual chapter 3, the Skills tab and tree-view paragraphs, "Building a hero" and the level-up list reworded; the cost table added.
- [ ] Screenshots retaken and checked.
- [ ] `CLAUDE.md` restated: scaling, progression, perks, bandit plans; NC8's grep clean.
- [ ] Final gates pass; index step 31 status `done (<commit>)`.

## Execution record
