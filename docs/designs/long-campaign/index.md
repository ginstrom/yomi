# The long campaign: vision and stages

## Vision

Yomi's campaign today runs from level 1 to about level 7. One party of three to five heroes walks out from the encampment, clears nests up to threat 5, and beats the Source. The blight contests the land the whole time.

The long campaign makes it a game of twenty levels and a company of heroes, in which:

- **The world opens outward in rings of rising danger,** from the home country's goblins and kobolds to bandit companies, ogres, wyverns, giants and wights, and on to dragons and a lich in the blighted heart. The Source is fought at threat 20. Inside a ring the party outgrows its foes. Stepping into the next ring makes the fights hard again.
- **Foes fight in different ways.** Humanoid bandits are built like heroes and mirror the party. Monsters make several strikes in one action, breathe cones of fire, and cast spells only monsters know. Elements and wards make preparation matter: a fire drake calls for fire wards, and a troll calls for fire or acid to stop its regeneration.
- **Gear grows with the heroes.** Many families of weapon and armour, each a trade-off, come in five material tiers. The higher tiers are forged from far ores and from trophies of slain monsters. Sockets take runes, which are looted, bought and fused. A rune does one thing in a weapon and another in armour.
- **The encampment's economy grows with the land held.** Sites are improved into works and forts. The trading post becomes a market with passive income. Trade routes run to distant partners, paying while the road is clean, and are raided when the blight or nests come near. Every income stands on contested land, so waiting is never free money.
- **The player runs a company, not a party,** as in XCOM. A crack vanguard pushes outward, while a second and third party of green recruits hold the home rings, train on easier nests, guard the roads, and march out to promote their best hero when the vanguard loses one.

Throughout, the simulator plays the same game the player does, and the measure stays the same: a careful company beats the Source about two times in three.

## How this directory is organised

- **`index.md`** (this file) gives the vision, the stages, their dependencies, and the conventions every stage follows.
- **`stage-NN-*.md`** holds one design per stage. Each says what the stage builds, what it leaves for later, and how to check it in play before moving on.
- **`reference/`** holds the four full designs the stages are cut from. A stage cites their sections for detailed rules and data, rather than repeating them, and records where it differs from them. Where a stage and a reference design disagree, the stage wins for that stage. Where either disagrees with the code, the code is right.
  - [`reference/campaign-to-level-20.md`](reference/campaign-to-level-20.md): the rings, native levels, encounter bands, the foe yardstick, bandits, the monster roster, special attacks, monster spells, and the long-campaign simulator.
  - [`reference/gear-and-runes.md`](reference/gear-and-runes.md): families, material tiers, strength and weight, forging and tempering, trophies, elements and wards, runes, runecraft and rune loot.
  - [`reference/economy-and-trade-routes.md`](reference/economy-and-trade-routes.md): site improvements, the Builders' Lodge, market income, trade partners, routes, raids and roads.
  - [`reference/multiple-parties.md`](reference/multiple-parties.md): the company, one clock with standing orders, guild hall levels 4 and 5, meeting and promotion, garrisons and wipes.

## The stages

Each stage leaves a complete, playable game, verified by tests, by a simulator check, and by a short session of play described in the stage's design. Stages 1 to 8 run on today's 60 × 40 map. Stage 9 opens the outer rings.

| Stage | Title | What the player gets | Depends on |
| --- | --- | --- | --- |
| 1 | [Foe foundations and bandits](stage-01-foe-foundations-and-bandits.md) (done; see its [implementation notes](stage-01-foe-foundations-and-bandits.md#implementation-notes): the guard is 238 of 500, accepted by the user as a real player can just choose to grind more, and the play script is still to walk) | Native levels and encounter bands under the hood. Bandit camps, built like heroes, at threats 3 to 5. A debug command to fight any encounter. | — |
| 2 | [Special attacks and elements](stage-02-special-attacks-and-elements.md) (done; see its [implementation notes](stage-02-special-attacks-and-elements.md#implementation-notes): the guard is 248 of 500, 243 at the stage's start, +5 from the Salamander Pool in the Troll Den's place; the Spider Nest is threat 5 only; the play script walked in a headless browser but for a retarget) | Strike routines, cone, line and burst area attacks with recharge, monster spells, elements and monster wards. A Spider Nest and a Salamander nest. | 1 |
| 3 | [Gear families and the first two tiers](stage-03-gear-families.md) (done; see its [implementation notes](stage-03-gear-families.md#implementation-notes): the guard is 233 of 500, from 248, accepted by the user as the iron breastplate's spell skill −5 on the mage; bandit steel waits for threat 6; the play script walked in a headless browser but for the spear's swing and a spearman's free attack) | Many weapon and armour families, iron and steel tiers, strength and weight, helms, gloves and boots, and the trading post's level 4 and filter. | 1 |
| 4 | [Runes](stage-04-runes.md) (done; see its [implementation notes](stage-04-runes.md#implementation-notes): the guard is 230 of 500, from 233, inside the 5 points, as the simulated party finds runes but wears almost nothing with a socket; the play script walked in full, in a headless browser, the floating on-hit text and the Seared letter by QA) | Sockets, the rune pouch, ten runes in four ranks, embedding, fusing and extracting, rune loot and shop runes, hero wards and on-hit damage. | 2, 3 |
| 5 | [A company of one](stage-05-company-of-one.md) (done; see its [implementation notes](stage-05-company-of-one.md#implementation-notes): the guard unchanged at 230 of 500, the 500- and 50-campaign logs byte for byte the same, save 20 migrating from 18, the play script walked headless) | The world rules over a list of parties, and the day loop with orders and time controls. Play is unchanged. | — (best after 1) |
| 6 | [Multiple parties](stage-06-multiple-parties.md) | Guild hall levels 4 and 5, a second and third party, the party bar, meeting and promotion, garrisons, wipes that don't end the game, green recruits. | 5 |
| 7 | [Site improvements and market income](stage-07-site-improvements-and-markets.md) | Works and forts, the Builders' Lodge, and passive income from trading post levels 4 to 6. | 3 (trading post 4) |
| 8 | [Trade partners and routes](stage-08-trade-routes.md) | Partners to contact, routes to open, roads on the map, raids, abandonment, roads that push back the blight, parties guarding roads. | 6, 7 |
| 9 | [The outer rings](stage-09-outer-rings.md) | The 140 × 72 map with rings to threat 18 and the Source at 20, bandits and stage 2's monsters filling them, ore and wood sites, the far partners, and the capped blight. | 1, 2, 6, 8 |
| 10 | [Forging and the high tiers](stage-10-forging-and-high-tiers.md) | Tiers 3 to 5, workshop levels 4 to 6, forging, tempering, trophies, and partners' goods for sale. | 3, 4, 7, 9 |
| 11 | [The high roster](stage-11-high-roster.md) | Ogres, wyverns, wights, basilisks, giants, golems, cultists, dragons, the lich, the elder wyrm, and the Source rebuilt at 20, each with a sprite. | 2, 9, 10 |
| 12 | [The long-campaign retune](stage-12-long-campaign-retune.md) | The simulator's company, gear and economy policies together, the headline figure, the yardstick from expected kit, and the documentation. | all |

### Dependencies

- **Foes:** 1 → 2.
- **Gear:** 1 → 3 → 4 (runes also need 2's elements).
- **The company:** 5 → 6.
- **The economy:** 3 → 7 → 8 (routes also need 6, for parties guarding roads).
- **The outer rings:** 9 needs 1, 2, 6 and 8.
- **The late game:** 10 needs 3, 4, 7 and 9; 11 needs 2, 9 and 10; 12 needs everything.

Stages 1 to 4 (foes and gear) and stages 5 and 6 (the company) are independent tracks, and may be built in either order or interleaved. The order above puts the visible combat and gear work first. Stage 5 is a pure refactor that is easiest on a quiet tree.

## Conventions for every stage

- **IDs.** Requirements are `S<N>-R<k>` and acceptance criteria `S<N>-A<k>`. Where a reference design's requirement is taken as is, the stage cites it, for example "campaign R8, as specified".
- **The early-game guard.** Every stage keeps the current campaign figure, which was 320 of 500 from seed 1 at the time of writing and is 238 of 500 (`--ready-level 7`) after stage 1, which the user accepted (bandits cost the figure; a real player can just choose to grind more); battle-rule changes after it made it 243, stage 2 248, stage 3 233 (accepted by the user: the iron breastplate's spell skill −5 on the ready-made mage), stage 4 230 (runes found but not worn by the simulated party), and stage 5 230, unchanged. A move of more than about 5 points must be explained in the stage's commit and in CLAUDE.md's rules of scaling, or retuned away. The figure is re-measured at the start of each stage, because a previous stage's retune may have moved it.
- **Versions.** Any stage that changes an event's shape bumps `LOG_SCHEMA_VERSION`. Any that changes what a save holds bumps `SAVE_VERSION` and migrates where it can: stages 5 and 7 migrate, and others may let old saves show as unreadable, as the project does today.
- **Docs.** Each stage updates CLAUDE.md (architecture, rules of scaling, simulator flags) and the player's manual for what it adds. When the stage is complete, it also adds a short "Implementation notes" section to its own design doc, with the figures measured.
- **Sprites.** New units, facilities and item icons are drawn with sprite-tool by a subagent, following [`../sprite-drawing-guidance.md`](../sprite-drawing-guidance.md). A stage is not done while a unit falls back to a placeholder.
- **Gameplay verification.** Each stage design ends with a play script: what to set up (often with the debug console) and what to see. A stage is done when its tests pass, its simulator checks hold, and its play script has been walked through in the game. Run the game with `make dev`.
- **Commits.** Commit as the project's CLAUDE.md says: finished work once tests pass, with a commit per step of the stage's plan when it is built with `/plan-implementer`.

## Open questions that span stages

These are recorded in the reference designs' section 8 with defaults taken. The ones that most change later stages:

| Question | Default | Where it bites |
| --- | --- | --- |
| Elements and wards (gear §8.1) | yes, in points, with a floor of 0 | stages 2 and 4 |
| Runes are extracted intact for a fee (gear §8.3) | yes | stage 4 |
| One clock with standing orders (company §8.1) | yes | stages 5 and 6 |
| Auto-resolve for lesser parties' battles (company §8.3) | not at first | stage 6. Revisit after playing it. |
| Blight strength capped at threat 5's push (campaign §8.6) | yes | stage 9 |
| The hero ceiling: grades above 3 or damage perks (campaign §8.8) | answered by tiers and runes | stages 10 and 12 |
