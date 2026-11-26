# Implementation plan: long campaign, stage 10 (forging and the high tiers)

Gear reaches the far rings. Every family gains **tiers 3 to 5** (Mithril, Adamant, Starmetal; Elderwood, Wyrmwood, Heartwood; Wyvern-hide, Basilisk-scale, Drake-scale), with their bonuses, strength relief and sockets. The **workshop** gains levels 4 to 6, which **forge** tiers 3 to 5 from gold and the far ores, woods and trophies, **temper** them to Fine and Masterwork, and **fuse** runes to ranks 3 and 4. **Trophies** are data and a granting path (their monsters come in stage 11). The **Market Hall** sells partners' goods at 3 gold a unit. **Bandits** wear tiers 3 to 5 by ring. The scenes get a **Forge** tab, **Temper** in the Modify tab, tints and the goods. The **simulator** gets the gear policy (families by role, forge and temper on home visits), `expectedKit` and a kit record. Four items carried from stage 9 are folded in: a faster auto-resolve estimate, a debug command to reach high levels, bandits' real tiers, and the world map header's stock.

**Source design:** [`docs/designs/long-campaign/stage-10-forging-and-high-tiers.md`](../../designs/long-campaign/stage-10-forging-and-high-tiers.md) (status "ready for planning", approved by the user). It cuts from [`reference/gear-and-runes.md`](../../designs/long-campaign/reference/gear-and-runes.md) §4.2 (tiers 3–5), §4.3 (forging and trophies), §5.4 (forging and the workshop) and §5.8 (expected kit and the gear policy), and [`reference/economy-and-trade-routes.md`](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.3 (partners' goods). Conventions: [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md). Previous stage: [stage 9's plan](../long-campaign-stage-09/index.md) and [feature record](../../features/long-campaign-stage-09.md). Feature record: [`docs/features/long-campaign-stage-10.md`](../../features/long-campaign-stage-10.md). History: [`log.md`](log.md). Written against `f3a1102` on branch `long-campaign-stage-10`.

## Decisions taken for the orchestrator

The plan follows the stage design, then the references, then the code (where they disagree the code is right, per the stages index). Items marked *(for the user)* read the design one way where it is silent or loose, or reach past it; each has a default the plan is written for, so none blocks a step, but the user should see them before the step named.

1. **Cloth gets tiers 3 to 5** *(settled by the user, 2026-11-23: the default)*. S10-R1 asks tiers 3 to 5 "in every family", but gear §4.2's ladders are metal, wood and hide only, and stage 3 added a fourth kind, cloth (Linen, Silk), for the robe. Default: **Mithrilweave** (3), **Adamantweave** (4) and **Starweave** (5), forged from the tier's ore (mithril, adamant, starmetal), so the mage's robe follows the staff. Alternative: the robe stops at Silk (tier 2), an exception to R1. Either is a few data rows in C1.
2. **Hide materials' catalog ids hold no underscore** (`wyvern`, `basilisk`, `drake`; names "Wyvern-hide", "Basilisk-scale", "Drake-scale", so "Drake-scale Leather"): a plain id splits at its first underscore. `MaterialDef.stock` names the stock material each tier-3+ material spends (`wyvern_hide`, …), keeping `catalog.ts` free of game imports.
3. **Mithril and Starmetal also halve their families' spell-skill penalties** *(settled by the user, 2026-11-23: the default, both)*. The stage lists only "strength relief"; gear §4.2's same bullet adds the halving (`casterFriendly`). Default: both, as the reference says (toward 0: −5 → −2, −15 → −7). Alternative: strength relief only.
4. **Tier bonuses as gear §4.2's table**, read: a small-slot item's "resistance when it has any" goes to a family whose tier-1 stats have resistance (helm, gauntlets, greaves); every weapon's tier-4 and -5 "pierce +1" is `armorPierce` +1 (a tier now touches piercing: the catalog's and the inventory guide's "a tier never changes piercing" are corrected).
5. **`forge` and `temper` take the party** (the project's `(game, party)` convention; the design writes `forge(game, family, material)` and `temper(game, place, grade)`, and `temper` keeps its place, which names the party).
6. **Tempering** goes straight to the asked grade at that grade's cost (gold tier × 10 × grade, the tier's material 4 × grade), at workshop level 3 and up (gear §4.3: "at any level 3+"), only for a tier-3+ plain item; it keeps the modifier and runes. Modifiers at workshop levels 4 to 6 stay at grade 3 at most (`highestGrade` clamped: without it level 4 would offer a grade 4).
7. **A forged item's worth** is 1.5 × (its forge gold + the temper gold of its grade), sold for half (gear §5.5); the material is not counted.
8. **Trophies this stage are data and a path, with no entries** *(settled by the user, 2026-11-23: the default)*: no wolf, wyvern, basilisk or dragon exists until stage 11, so `TROPHIES` is empty, and granting is wired (the victory screen, the simulator) and tested with an injected table. Elder Glade sells **wyvern hide** at the Market Hall as the design's stand-in; **basilisk scale and drake scale have no source in play until stage 11** (debug `stock` only), so hide tiers 4 and 5 cannot be forged in play this stage.
9. **Partners' goods** *(settled by the user, 2026-11-23: the default)*: from the Market Hall (trading post 5 and up), each **contacted partner not silent** sells its good (and Elder Glade its stand-in) at 3 gold a unit, bought into the stock in any whole amount. The design says only "for sale at the Market Hall"; silence is read as the route's rule (a silent partner pays nothing). The simulator does not buy goods (the spend order is stage 12's).
10. **Bandit gear grades by ring** *(settled by the user, 2026-11-23: the default)*: Mithril **Fine** at threats 9–11, Adamant **Fine** at 12–17, Starmetal **Masterwork** from 18 (the expected kit's grades at those levels, gear §5.8); threat 8 keeps Masterwork steel, below as today. The design gives the tiers and thresholds only.
11. **Workshop sprites for levels 4 to 6** (step 05): the design lists none, but the encampment draws a facility by `camp_<facility>/level_<n>`, and the stages index says a stage is not done while something falls back to a placeholder.
12. **The gear policy applies families by role only from tier 3** *(settled by the user, 2026-11-23, **not** the plan's default "from tier 1, gated")*: below tier 3 the simulator keeps today's policy (in-family buying at tiers 1 and 2), so the early figure should not move. Step 09's gate stays as a check: if `one` still moves more than about 5 points from step 01's baseline, it stops and reports. Step 09's task file says so.
13. **The policy's details the design leaves open** (step 09; first values, recorded): the fighter switches to the war hammer when the lead foe (the first enemy unit) of the vanguard's next target, built at its threat, has resistance 4 or more; the archer's crossbow from tier 3; "the best body armour their strength allows" is the engineer's documented rule; fusing any rank the workshop allows (gear §5.8 step 3, which "fill sockets" needs at ranks 3–4); tier-3+ ores, woods and trophies are never sold as surplus; trophies are taken (none drop yet); no partner goods.
14. **The refactor guard** stays identical through steps 02, 03, 04 and 07 (no tier-3+ item, workshop above 3, good or bandit above threat 8 reaches the early campaign); **step 09 re-records it once** (its new record fields and the policy), with old and new figures; step 10 only for a retune the orchestrator approved. **The policy snapshot** is re-recorded in step 02 (bandits at threats 9 and up), only those lines changing.
15. **The auto-resolve estimate is made faster only in ways that keep every estimate byte-identical** (step 07, carried item); a change that alters an estimate (fewer samples, stopping early) is brought to the user with figures, not made.
16. **High levels in the debug console** (step 06, carried item): a `level <n>` command, with `auto` to spend points along `planFor`'s plan, rather than a bigger `xp` (whose 50000 reaches about level 12 only because each level costs more).
17. **Stock text names materials** by `materialName` (`wyvern_hide` reads "wyvern hide"); `describeCost` uses it.
18. **The world map header's stock** (carried, low priority): step 08 checks it at 840 × 560 with a stock holding every material; a layout fix within `headerLines` and the header is in scope, anything larger is recorded and left.
19. **Versions:** `SAVE_VERSION` 30 → 31 in step 03 (the trophies in `Material`, as the design asks), no migration (older saves read as unreadable, stages 8–9's practice). `LOG_SCHEMA_VERSION` unchanged: no battle event changes shape.
20. **Out of scope:** market income, the simulator's spend order, the company's long-campaign policy skew and home-country spawns (stage 12); the Source's guardians stay at `SOURCE_FOE_LEVEL` 6 (stage 11); trophies from kills and `--player-kit` (stage 11); gear §5.8's step 3 ring-element wards and step 4 unique items by `gearScore`; the trading post selling tier 3+.
21. **Kit lag accepted until stage 12** *(the user, step 10)*: "Done when"'s kit clause unmet by the simulator's policy, not the economy; report-only forge-ready Kit line (`forgeReadyAt`, `kitForgeReady`); stage 12's candidates in [step 10](10-measure.md).

## Scope and shared constraints

- **In:** S10-R1 to S10-R6, bandit gear by ring, the design's tests (§6), its simulator checks and play script, the docs the stages index asks for, and the carried items.
- **Carried forward** (feature record): (1) mithril and the far ores have no use: steps 03 (forging), 04 (goods); (2) rune ranks 3–4 cannot be fused into: step 03; (3) far bandits' stand-in steel: step 02; (4) the auto-resolve estimate's "(…)" for about 2 s at level 12+: step 07; (5) debug `xp` reaching about level 12: step 06; (6) the header's stock running to three lines at 840 wide: step 08 (low priority). Not this stage: decision 20.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 04, 07, 09 and 10 run them, in that order). Measurements go through the `yomi-measure` agent where a step says so. Long runs: 100 campaigns take about 10 minutes alone, up to 20 under load.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, args `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`; `GUARD_RECORDS`, `GUARD_EVENTS_SHA256`. Rules: `.claude/skills/yomi-balance/guards.md`. Steps 02, 03, 04, 06, 07 and 08 must not edit it and keep it green (a mismatch means the step changed play: find the cause and fix it, or, in step 02 only, if the cause is a battle at threat 9 or more, bring it to the orchestrator). **Step 09 re-records it** with old and new figures in the doc comment above `GUARD_RECORDS`. Step 10 only for a retune the orchestrator approved.
- **The 50-campaign check** before committing a domain or simulator step (02, 03, 04, 07, 09, 10 if it retunes), against a hash taken before the step (step 01's for step 02), recorded as "identical" or the diff in `log.md`:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  Steps 02, 03, 04 and 07 must be identical; 09 records the new hash and figures; 05, 06, 08 and 11 change no rule the campaign plays and need not run it (say so).
- **The policy snapshot** (`src/engine/policies.test.ts`, "the choices of today's encounters"): re-recorded in step 02 only (decision 14), proving only `bandit_company` and `freebooter_host` lines at threats 9 and up changed (and say so in its title, as earlier re-recordings do).
- **The early-game figure.** Stage 9 ended at `one` 288 (days 331), `company` 289, `rl10` 409, accepted by the user until stage 12 (`bands.md`). **Step 01 re-measures `one`, `company`, `rl10` and the long baseline before any change** (code moved after stage 9's measuring step). Steps 09 and 10 measure again with `--near-source`. A move of more than about 5 points from step 01's figure is explained in the commit and in `src/game/CLAUDE.md`'s scaling line, or retuned; **any figure out of the user's bands, or further out than accepted, is brought to the orchestrator with options, never tuned away silently.** The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed; only "Now".
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. Forging, tempering, goods and trophies draw nothing. Step 07's changes leave every battle and every estimate byte-identical.
- **Import cycles.** `crafting.ts`, `runecraft.ts` and `company.ts` are in a cycle (`src/game/CLAUDE.md`), as are `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts`; `tradingPost.ts` may call `crafting.ts`'s `forgedValue` and `trade.ts`'s readers only inside functions. `catalog.ts` and `inventory.ts` import each other: nothing at module load. `catalog.ts` imports nothing from `src/game/`.
- **Versions.** `SAVE_VERSION` 31 in step 03, no migration; `LOG_SCHEMA_VERSION` unchanged.
- **Content.** `.claude/skills/yomi-add-content/`: `item.md` (steps 02, 03: plain items come from the catalog, so `BASE_ITEMS` grows by itself), `facility.md` (steps 03, 05, 08: a facility's new levels, sprites and manual), `debug-command.md` (step 06). Sprites: `.claude/skills/yomi-sprites/` (`art/CLAUDE.md`, `docs/designs/sprite-drawing-guidance.md`); never edit an exported PNG; `npm run sprites` then `npm run sprites:check`, then the `yomi-asset-check` agent. Manual: `.claude/skills/yomi-manual/`. Balance: `.claude/skills/yomi-balance/`.
- **Commits.** One commit per step once `npm test` passes (and the guard holds as above), on `long-campaign-stage-10`, without pushing; files staged by path. A step run in a worktree commits on its own branch, merged by the orchestrator. Messages "Stage 10 step NN: <title>". No attribution lines.
- **Docs.** Each step fixes the CLAUDE.md lines its change makes wrong and searches the CLAUDE.md files, `.claude/` and `docs/reference/` for every name it renames or removes. `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB: **`src/game/CLAUDE.md` is at 7,765 bytes**, so step 03 moves detail to `docs/reference/game.md` before adding a line. Scene steps update the manual's text for their screens; step 11 retakes the screenshots and writes the rest.

## Contracts

The task files hold each contract's full text, copied verbatim (C1, C2 and C8 are summarised here to keep this index under its cap); each task file copies its contracts unchanged. "Existing" means at `f3a1102`; a step that changes a contract updates every task file that copies it.

### C1. Tiers 3 to 5 and bandit gear (step 02)

`catalog.ts`: `Tier` 1–5; `MaterialDef` gains `strengthRelief?`, `casterFriendly?` and `stock?` (the stock material a tier-3+ material spends); `MATERIALS` gains, after today's eight, mithril (3, relief 1, caster-friendly), adamant (4), starmetal (5, relief 2, caster-friendly), elderwood, wyrmwood, heartwood, wyvern "Wyvern-hide", basilisk "Basilisk-scale", drake "Drake-scale" (stock `wyvern_hide`, `basilisk_scale`, `drake_scale`), mithrilweave, adamantweave, starweave (decision 1); `TIER_BONUS` for tiers 3–5 per gear §4.2 (weapon +4/+6/+8 damage, to hit +5/+5/+10, pierce +1 at 4 and 5; shield, armour, small), `SMALL_RESISTANCE` { 3: 1, 4: 1, 5: 2 } for small-slot families with resistance; `tierStats(stats, cls, material)`. `inventory.ts`: 140 plain items, ids `<material>_<family>`. `runes.ts`: `SOCKETS_BY_TIER` { 1: 0, 2: 1, 3: 1, 4: 2, 5: 2 }. `tradingPost.ts`: never sells tier 3+. `bandits.ts`: `GEAR` at five tiers; `banditGear` ≥ 18 { 5, 3 }, 12–17 { 4, 2 }, 9–11 { 3, 2 }, below as today. Full text: the task files of steps 02, 03, 08, 09, 11.


### C2. The workshop: forging, tempering, fusing, trophies (step 03)

`territory.ts`: `Material` gains `wolfhide`, `wyvern_hide`, `basilisk_scale`, `drake_scale`; `materialName`; `describeCost` uses it. `crafting.ts`: `WORKSHOP_COSTS` to six levels (100 gold 20 mithril; 150 gold 20 adamant; 200 gold 10 starmetal); `HighTier`, `FORGE_LEVEL` { 3: 4, 4: 5, 5: 6 }, `FORGE_GOLD` { 30, 50, 80 }, `FORGE_MATERIAL` { 8, 10, 12 } (doubled for two-handed and plate), `TEMPER_LEVEL` 3; `forgeCost`, `ForgeOption`, `forgeOptions(game, party, slot?)`, `forgeRefusal`, `forge(game, party, family, material)` (into the baggage); `temperCost` (gold tier × 10 × grade, material 4 × grade), `temperRefusal`, `temper(game, place, grade)`; `forgedValue`; `craftCost` with the tier's material for tier 3+; `highestGrade` capped at 3; `craftables` lists tier-3+ items. `tradingPost.ts`: `salePrice` by `forgedValue`. `runecraft.ts`: fusing to 3 and 4 now possible. `encampment.ts`: effect lines 4–6. `encounters.ts`: `Trophy`, `TROPHIES` (empty). `loot.ts`: `trophiesFor`, `takeTrophies`. `SAVE_VERSION` 31. Debug `MATERIALS`. Full text: the task files of steps 03, 08, 11 (parts in 04, 09).


### C3. Partners' goods at the Market Hall (step 04)

```ts
// src/game/tradingPost.ts
export const GOODS_LEVEL = 5   // the Market Hall
export const GOOD_PRICE = 3    // gold a unit
/** Goods a partner sells besides its own until stage 11 brings their monsters (decision 8). */
export const STAND_IN_GOODS: Readonly<Record<string, readonly Material[]>> = { elder_glade: ['wyvern_hide'] }
export interface GoodOffer { partner: string; name: string; material: Material }
export function goodsForSale(world: WorldState): GoodOffer[]
//   from GOODS_LEVEL: each contacted partner that is not silent, in PARTNERS order, its good then its stand-ins; empty below GOODS_LEVEL
export function buyGoodRefusal(game: GameState, party: Expedition, material: Material, amount: number): string | null
//   in order: not at the encampment; below GOODS_LEVEL ('A level 5 trading post sells partners' goods.'); no partner offers it;
//   amount not a whole number of at least 1; gold short ('It costs N gold, more than the stock holds.')
export function buyGood(game: GameState, party: Expedition, material: Material, amount: number): string | null
//   spends GOOD_PRICE × amount gold and adds `amount` to the stock
```

### C4. Workshop sprites (step 05)

`camp_workshop` (`art/encampment/`) gains frames `level_4`, `level_5`, `level_6`, at the size and in the style of `level_1` to `level_3`, each grander (a forge with a stack and bellows at 4, a second hearth at 5, a star-lit great forge at 6, or as the sprite guidance suits). `facilityFrame` already names them; nothing in `src/` changes.

### C5. The debug console reaches high levels (step 06)

```ts
// src/scenes/debugCommands.ts, COMMANDS gains:
//   level: usage 'level <n> [member|all] [auto] [@party]'
//   raises each member named (all by default) to level n, a level at a time (levelUp), its experience toward the next level set to 0;
//   with `auto`, after each level autoAdvance(member, planFor(member)) spends its points as the simulator's raised party does;
//   refuses n not above a member's level ('<name> is level L already.') or above 20; changes the game (world map only).
// `xp` is unchanged.
```

### C6. A faster auto-resolve estimate (step 07)

```ts
// Every Forecast is byte-identical to today's for the same (start, base, samples): a fixture of estimates recorded before any change
//   (src/game/forecast.test.ts) holds them; the refactor guard, the policy snapshot and the 50-campaign check stay identical.
// scripts/forecastCost.ts (new, committed): `node scripts/forecastCost.ts [--samples N]` prints the ms an estimate takes
//   for fixed starts: the ready-made party raised to 6, 12, 15 and 18 (as `raisedParty`), each member's worn weapon, shield and armour
//   the same family at tier 2, 3, 4 and 5 (Fine), against bandit_company 9, bandit_company 12, freebooter_host 15, freebooter_host 18.
// Anything that would change an estimate is brought to the orchestrator with figures (decision 15).
```

### C7. The scenes (step 08)

```ts
// src/scenes/CraftingScene.ts: tabs Modify, Forge, Runes.
//   Forge: a slot filter (weapon, shield, armour, head, gloves, boots), the slot's forgeOptions rows (family, material, cost),
//     a member picker (the party's members, the first by default), the chosen row's stats against that member's worn item
//     in the slot (gearCompare), its refusal, and a Forge button (forge(); the item to the baggage; a message).
//   Modify: a tier-3+ item also offers "Temper to Fine" and "Temper to Masterwork", with temperCost and temperRefusal.
//   Probe: tab 'forge', control forgeTab, the forge rows (family, material, tier, cost text, refusal), the member picker,
//     the Forge button; temper options among the modify options.
// src/scenes/itemIcons.ts: MATERIAL_TINTS gains every tier-3+ material id of C1; iconTint tints every tier from 2 by its material.
// src/scenes/TradingPostScene.ts: from GOODS_LEVEL the Buy tab's filter row gains "Goods", listing goodsForSale rows
//   ("Mithril, from Stonehollow: 3 gold a unit") with Buy 1 and Buy 5 and the refusal; the probe lists them.
// src/scenes/BattleScene.ts: on a win, takeTrophies beside takeRunes; the victory lines list trophies ('Trophies: 3 wyvern hide') when any.
// Stock text in the scenes names materials by materialName.
// src/scenes/WorldScene.ts: at 840 × 560 with a stock of every material, the header's stock stays clear of the party column (decision 18).
```

### C8. The simulator's gear policy, expected kit and record (step 09)

`scripts/simulate.ts`: `KitRole` and `kitRole(character)`; `ExpectedKit` and `expectedKit(role, level)` (gear §5.8's table: tier 1, 2, 3, 4, 5 by level band 1–4, 5–8, 9–12, 13–16, 17–20, with grades, filled sockets and ranks); `CampaignRecord` gains `goldOnForging` and `kitAtLevel` (each vanguard member's role, main-hand tier and runes embedded when the vanguard's lowest level first reaches 5, 10, 15, 20); the summary's "Kit:" line against `expectedKit`; `visitFacilities` follows gear §5.8 steps 1 and 2 with decision 13's details; `takeTrophies` after each win. Full text: the task files of steps 09, 10, 11.


## Tasks

| Step | Task | Outcome | Depends on | Engineer / reviewer | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | [The stage's baseline](01-baseline.md) | `one`, `company`, `rl10` (500, `--near-source`), the 50-campaign hash, the long baseline (100); no code change | — | sonnet / sonnet | done (Stage 10 step 01: the stage's baseline) |
| 02 | [Tiers 3 to 5 and bandit gear](02-tiers-and-bandit-gear.md) | Materials, `TIER_BONUS`, relief, sockets, 140 plain items, the post refusing tier 3+, bandits by ring (C1); policy snapshot re-recorded; guard identical | 01 | opus / opus | done (Stage 10 step 02: tiers 3 to 5 and bandit gear) |
| 03 | [The workshop: forging, tempering, fusing, trophies](03-workshop.md) | Levels 4–6, `forge`, `temper`, `craftCost`, forged worth, fusing to 3 and 4, trophies and `takeTrophies`, `materialName`, save 31 (C2); room made in `src/game/CLAUDE.md`; guard identical | 02 | opus / opus | done (Stage 10 step 03: the workshop) |
| 04 | [Partners' goods at the Market Hall](04-partner-goods.md) | `goodsForSale`, `buyGood` and its refusal, Elder Glade's wyvern hide (C3); guard identical | 03 | sonnet / opus | done (6e62d7d, review fix 6de80da) |
| 05 | [Workshop sprites](05-workshop-sprites.md) | `camp_workshop` levels 4–6 (C4) | — | sonnet / opus | done (7f9610a, 8aa5deb, 169a9ff, merged in dd96b2c; frames camp_workshop/level_4–level_6, same canvas and anchor, no offset; sprites:check and asset check pass; no simulation) |
| 06 | [High levels in the debug console](06-debug-level.md) | `level <n> [member\|all] [auto]` (C5) | 03 | sonnet / sonnet | done (beebb44, merged as 32b401d) |
| 07 | [A faster auto-resolve estimate](07-faster-estimate.md) | `scripts/forecastCost.ts`, an estimate fixture, byte-identical speed-ups (C6); **checkpoint** if only result-changing options remain | 04 | opus / opus | done (2cdd885 fixture and timing script; Stage 10 step 07: a faster auto-resolve estimate) |
| 08 | [The scenes](08-scenes.md) | Forge tab, Temper, tints, goods on the Buy tab, trophies on the victory screen, stock names, header stock (C7); manual text; in-browser tests | 04, 05 | sonnet / opus | done (d63b426, ed99a2f, merged in 9c0f04c; review opus clean, 1 round) |
| 09 | [The simulator's gear policy](09-gear-policy.md) | `kitRole`, `expectedKit`, kit record, the gear policy (C8); guard re-recorded; **gate** on `one` (decision 12) | 07 | opus / opus | done (400c9db kit record; Stage 10 step 09: the simulator's gear policy; guard not re-recorded: play unchanged; `one` 288 identical) |
| 10 | [Measure and judge](10-measure.md) | Early figures against step 01, the long run's kit against `expectedKit`, Source share and battles to level against stage 9 and step 01, far bandit cells; tune site yields then forge costs if gear lags | 09 | opus / opus | done (lag accepted, decision 21) |
| 11 | [Document and play](11-document-and-play.md) | CLAUDE.md files, `docs/reference/`, the balance skill, the manual and its screenshots, implementation notes, stages index; play script walked | 06, 08, 10 | sonnet / opus | done (1c2be19) |

**Tiers.** "opus" means leave the model unset; "sonnet" means `model: "sonnet"`.
- 01: runs measures through `yomi-measure` and records them; the reviewer checks the figures against the logs.
- 02: balance-moving data (bandits' gear), a snapshot re-record that must be proved narrow, and stats that must stay exact at tiers 1–2.
- 03: many refusals and costs under one contract, a save bump, an import cycle and a full CLAUDE.md to make room in.
- 04: one small module change under a fixed contract.
- 05: tool work with a judged look.
- 06: one debug command on an existing pattern.
- 07: profiling an unknown hot spot and proving byte-identity; a go/no-go judgment.
- 08: fixed contracts on existing scene patterns (tabs, pagers, filters); escalate to opus if a layout cannot fit 840 × 560.
- 09: a policy with judgment calls, a guard re-record that must be explained, and the early-figure gate.
- 10: balance judgment against the user's bands, and tuning in the order the design gives.
- 11: by then everything is decided; the reviewer checks the docs against the code and the play script against what was seen.

## Execution order

01 → 02 → 03 → 04 → then two tracks: **scenes** 08 (after 05), and **simulator** 07 → 09 → 10; 11 after both and 06.

- **05** touches only `art/` and `public/assets/sprites/`: any time, in its own worktree, merged before 08.
- **06** touches `src/scenes/debugCommands.ts` (and its test, the reference, the manual's debug lines): after 03 (which adds the trophies to its `MATERIALS`), beside anything; it runs no simulation.
- **08** may run beside 07, 09 and 10: it touches `src/scenes/`, `src/testHook.ts`, `e2e/` and the manual, and runs no simulation (its in-browser tests load the machine: tell the orchestrator so timings in 07 and 10 are read with care). The index's table is the only shared file (update your row only).
- **Simulations run one at a time**, in the order 01, 02, 03, 04, 07, 09, 10.
- **Checkpoints:** after 04 the domain is complete; **step 07 stops for the orchestrator** if no byte-identical change makes the estimate fast enough; **step 09 stops at its gate** if `one` moves more than about 5 points; step 10 brings out-of-band figures to the orchestrator.

## Requirement map

| Design item | Steps |
| --- | --- |
| S10-R1 tiers 3 to 5 in every family, bonuses and sockets (gear R1, R8) | 02 (catalog, relief, sockets), 08 (tints) |
| S10-R2 workshop levels 4 to 6, forging and tempering (gear R6, A4) | 03 (rules), 05 (sprites), 08 (Forge tab, Temper) |
| S10-R3 trophies by kind, data and granting (gear R7) | 03 (data, `takeTrophies`), 08 (victory screen), 09 (simulator) |
| S10-R4 fusing to ranks 3 and 4 (gear R10) | 03 (levels and tests; the Runes tab already fuses) |
| S10-R5 partners' goods for sale (economy §4.3) | 04 (rules), 08 (Buy tab) |
| S10-R6 the simulator's gear policy, expected kit and record (gear R14) | 09, 10 |
| §2 bandit gear by ring | 02 |
| §2 `craftCost` with tier materials | 03 |
| §4 what the player sees (Mithril Longsword for 30 gold and 8 mithril, one socket, two at Masterwork; the damage line; mithril at the Market Hall) | 02, 03, 04, 08; walked in 11 |
| §5 `BASE_ITEMS` covers five tiers, the post lists 1 and 2; `SAVE_VERSION` | 02; 03 |
| §6 tests: `catalog.test.ts` (02), `crafting.test.ts` (03), `runecraft.test.ts` (03), `tradingPost.test.ts` (02, 03, 04), `scripts/simulate.test.ts` (09), scene tests (08) | as listed |
| §6 simulator 1 (early guard) and 2 (long campaign, 100) | 01 (baseline), 09 (gate), 10 |
| §6 play script | 06 (`level`), 11 (walked) |
| §7 risk: the economy | 10 (site yields, then forge costs) |
| Carried 1–6 | 03, 04; 03; 02; 07; 06; 08 |
| Cross-stage: docs, manual, implementation notes | each step; 11 |

## Completion criteria

- `npm test`, `npm run test:browser`, `npm run build` and `npm run sprites:check` pass.
- The guard fixture was edited only by step 09 (and 10 only for an approved retune), and passes; the policy snapshot only by step 02.
- The early figures (`one`, `company`, `rl10`, with `--near-source`) are within about 5 points of step 01's baseline, or the move is explained (and accepted by the user where step 09's gate stopped); out-of-band figures were brought to the orchestrator.
- A 100-campaign long run shows each role's main-hand tier at levels 5, 10, 15 and 20 (where reached) within a tier of `expectedKit`, or the lag, its cause and the tuning tried are recorded and brought to the orchestrator; its Source share and battles to level are compared with stage 9's and step 01's.
- Every auto-resolve estimate is byte-identical to before step 07, and its time at levels 12 to 18 is recorded before and after.
- CLAUDE.md files, `docs/reference/`, the balance skill, the manual and its screenshots are current; the stage design has its implementation notes; the stages index shows stage 10's status. The play script has been walked, with what was seen recorded in step 11.

## Open questions

None. The user answered all six on 2026-11-23 (recorded in the decisions above): Q1 robes Mithrilweave, Adamantweave, Starweave from the tier's ore (decision 1, default); Q2 Mithril and Starmetal halve spell-skill penalties as well as easing strength (decision 3, default); Q3 bandits Fine at threats 9–17, Masterwork from 18 (decision 10, default); Q4 trophies empty until stage 11, hide tiers 4–5 by debug stock only, Elder Glade's wyvern hide the stand-in (decision 8, default); Q5 goods only from contacted, unsilenced partners, any whole amount, 3 gold, the simulator never buys (decision 9, default); Q6 **not the default**: families by role only from tier 3, today's policy below (decision 12).

## For implementers

When you start or finish a step, update its status and commits in the table above. Record evidence (commands and output, the guard's result, timings), deviations and blockers in your task file's "Execution record", and anything the plan as a whole accumulates (measurements, run histories, review summaries) in [`log.md`](log.md). Keep this index short; every implementer reads it.
