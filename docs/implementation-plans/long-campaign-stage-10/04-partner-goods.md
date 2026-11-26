# Step 04: Partners' goods at the Market Hall

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-10-forging-and-high-tiers.md) (§2 "Partners' goods", §4 What the player sees, §6 `tradingPost.test.ts`) · [Economy reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.3 (trade partners), §4.2 (the Market Hall row), §8.6 · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.3 (trophies) · [Plan log](log.md)

**Difficulty:** sonnet / opus. One small change to one module under a fixed contract (C3), on the existing refusal-or-null pattern of `tradingPost.ts`: the engineer (`model: "sonnet"`) follows it; the reviewer (opus) checks the refusal order, the import-cycle rule and that play did not move.

## 1. Objective

From the Market Hall (trading post level 5), the trading post sells each contacted, unsilenced partner's good at 3 gold a unit, and Elder Glade's wyvern hide as the stand-in until stage 11, so rare materials have a gold price as well as a site. Domain only: the Buy tab's "Goods" entry is step 08's.

## 2. Requirements and context

- **S10-R5** (economy §4.3): "From the Market Hall, the trading post also sells it [a partner's good], at 3 gold a unit." Economy §8.6: "Do partners sell their good at the Market Hall? Yes, at 3 gold a unit, so rare materials have a gold price as well as a site." Economy §4.2's table: level 5, Market Hall, "as 4, plus partners' goods for sale (§4.3)".
- **Design §2:** "Partners' goods are for sale at the Market Hall at 3 gold a unit." Trophies: "Until stage 11 adds their monsters, wolfhide, wyvern hide, basilisk scale and drake scale come only from the trading post's partners' goods. Elder Glade sells wyvern hide as a stand-in, and the stage's notes record this."
- **Design §4:** "At the Market Hall, Stonehollow's mithril sells for 3 gold a unit."
- **Design §6 tests:** `tradingPost.test.ts`: partners' goods.
- **The partners and their goods today** (`PARTNERS`, `worldMap.ts`, in order): Millbrook timber, Saltmere salt, Stonehollow mithril, Elder Glade elderwood, Emberwatch adamant. A `PartnerLocation` carries `good: Material`. Contact is permanent (`world.contacted`); a partner is silent while its land is at `LOSS_LEVEL` or worse (`world.silent`), and a silent partner's route pays nothing.

### Decisions from the index this step applies (unchanged)

8. **Trophies this stage are data and a path, with no entries** *(settled by the user, 2026-11-23: the default)*: no wolf, wyvern, basilisk or dragon exists until stage 11, so `TROPHIES` is empty, and granting is wired (the victory screen, the simulator) and tested with an injected table. Elder Glade sells **wyvern hide** at the Market Hall as the design's stand-in; **basilisk scale and drake scale have no source in play until stage 11** (debug `stock` only), so hide tiers 4 and 5 cannot be forged in play this stage.
9. **Partners' goods** *(settled by the user, 2026-11-23: the default)*: from the Market Hall (trading post 5 and up), each **contacted partner not silent** sells its good (and Elder Glade its stand-in) at 3 gold a unit, bought into the stock in any whole amount. The design says only "for sale at the Market Hall"; silence is read as the route's rule (a silent partner pays nothing). The simulator does not buy goods (the spend order is stage 12's).
14. **The refactor guard** stays identical through steps 02, 03, 04 and 07 (no tier-3+ item, workshop above 3, good or bandit above threat 8 reaches the early campaign); **step 09 re-records it once** (its new record fields and the policy), with old and new figures; step 10 only for a retune the orchestrator approved. **The policy snapshot** is re-recorded in step 02 (bandits at threats 9 and up), only those lines changing.
17. **Stock text names materials** by `materialName` (`wyvern_hide` reads "wyvern hide"); `describeCost` uses it.
20. **Out of scope:** market income, the simulator's spend order, the company's long-campaign policy skew and home-country spawns (stage 12); the Source's guardians stay at `SOURCE_FOE_LEVEL` 6 (stage 11); trophies from kills and `--player-kit` (stage 11); gear §5.8's step 3 ring-element wards and step 4 unique items by `gearScore`; the trading post selling tier 3+.

If the user has answered decision 9 otherwise (for example goods from every contacted partner, silent or not), build the answer and note it in the execution record and the index's decision.

### Contract produced (copied unchanged from the index)

**C3. Partners' goods at the Market Hall (step 04)**

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

### Contract consumed (from step 03, copied unchanged from the index's C2)

```ts
// src/game/territory.ts
export type Material = /* today's sixteen */ | 'wolfhide' | 'wyvern_hide' | 'basilisk_scale' | 'drake_scale'   // trophies
// WORKS_NAMES gains an entry for each trophy (never shown: no site yields one)
export function materialName(material: Material): string   // the id with '_' read as ' ': 'wyvern hide'
// src/game/buildings.ts: describeCost names each material by materialName
```

C3's consumer is step 08 (the Buy tab's "Goods" entry: `goodsForSale` rows "Mithril, from Stonehollow: 3 gold a unit", Buy 1 and Buy 5, the refusal), which copies C3 unchanged.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file; `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 04, 07, 09 and 10 run them, in that order).
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, args `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`; `GUARD_RECORDS`, `GUARD_EVENTS_SHA256`. Rules: `.claude/skills/yomi-balance/guards.md`. This step must not edit it and keeps it green; a mismatch means the step changed play: find the cause and fix it.
- **The 50-campaign check** before committing, against step 03's hash (in `log.md`), recorded as "identical" or the diff in `log.md`. It must be identical:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **The early-game figure.** Not measured here (no play moves). The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. Goods draw nothing.
- **Import cycles.** `crafting.ts`, `runecraft.ts` and `company.ts` are in a cycle (`src/game/CLAUDE.md`), as are `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts`; `tradingPost.ts` may call `crafting.ts`'s `forgedValue` and `trade.ts`'s readers only inside functions. Nothing at module load: `STAND_IN_GOODS` is a literal, and `PARTNERS` and the trade readers are read only inside `goodsForSale` and `buyGoodRefusal`.
- **Versions.** `SAVE_VERSION` 31 (step 03), no change here: buying adds to the stock, whose shape is unchanged. `LOG_SCHEMA_VERSION` unchanged.
- **Commits.** One commit once `npm test` passes and the guard holds, on `long-campaign-stage-10`, without pushing; files staged by path. Message "Stage 10 step 04: partners' goods at the Market Hall". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines this change makes wrong; `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB (`src/game/CLAUDE.md` was 7,765 bytes before step 03, which made room).

## 3. Dependencies and prerequisites

- **Step 03 is done:** `Material` holds `wyvern_hide` (C2), `materialName` exists, and `tradingPost.ts` carries step 03's `salePrice` change (read it as it stands). Steps 01 and 02 through it.
- **Existing code (inspected at `f3a1102`):**
  - `src/game/tradingPost.ts`: `TRADING_POST_COSTS` (level 5 = 160 gold, 30 silver, 20 stone), `tradingPostName` (5 is the Market Hall), `buyRuneRefusal` / `buyRune` and `sellMaterial` as the patterns (refusal in order, `atEncampment`, `notHere`, `spend`); its module doc comment says the post "never sells materials", which this step makes false.
  - `src/game/trade.ts`: `partners(world)`, `isContacted(world, id)`, `isSilent(world, id)`; `PartnerLocation` (`worldMap.ts`) has `id`, `name`, `good`.
  - `src/game/tradingPost.test.ts`: existing tests and their game fixtures (how a game at the encampment with a post level is built).
- **Environment:** Node 26.

## 4. Scope and guidance

### 4.1 Changes

- **`src/game/tradingPost.ts`:** add C3 as written. `goodsForSale` walks the world's partners in `PARTNERS` (locations) order, keeps those contacted and not silent, and yields `{ partner: id, name, material: good }` then one per `STAND_IN_GOODS[id]` entry; empty below `GOODS_LEVEL`. `buyGoodRefusal` checks in C3's order, each refusal phrased as there (for "no partner offers it", say which material, e.g. "No partner sells wyvern hide here.", by `materialName`). `buyGood` returns the refusal or spends `GOOD_PRICE × amount` gold and adds `amount` to `world.stock[material]`. Update the module doc comment (and `TRADING_POST_COSTS`' comment) to say level 5 sells partners' goods.
- No scene, simulator or save change. The simulator's `visitFacilities` must not call `buyGood` (decision 9).

### 4.2 Tests (`src/game/tradingPost.test.ts`)

- Below level 5 (`facility` 4): `goodsForSale` is empty and `buyGoodRefusal` gives the level refusal.
- At level 5: with no partner contacted, nothing is listed; with all five contacted, the list is Millbrook timber, Saltmere salt, Stonehollow mithril, Elder Glade elderwood, Elder Glade wyvern hide, Emberwatch adamant, in that order; a silent partner (in `world.silent`) drops out and wakes back in.
- Every refusal, in C3's order: away from the encampment; level 4; a material no contacted partner offers (e.g. `starmetal`, or `mithril` with Stonehollow silent); amounts 0, −1 and 1.5; gold one short of the price.
- **The design's line:** Stonehollow contacted, level 5, 10 gold: `buyGood(game, party, 'mithril', 3)` is null, gold falls by 9 to 1 and the stock's mithril rises by 3. Wyvern hide from Elder Glade likewise.
- A refused buy leaves the stock untouched (deep-equal before and after).

### 4.3 Docs

- `docs/reference/game.md`, the trading post section: level 5 sells partners' goods at `GOOD_PRICE` a unit from `GOODS_LEVEL`, contacted and not silent partners only (decision 9), Elder Glade's wyvern hide as the stand-in until stage 11 (decision 8), the simulator never buys them.
- `src/game/CLAUDE.md`: the `tradingPost.ts` line ("buying and selling items, runes and materials") gains "and partners' goods" only if it fits under the 8 KB cap; otherwise leave it (the reference carries it).

### 4.4 Exclusions

No scene work (step 08), no simulator change, no change to routes, contact or silence, no trophies from kills (stage 11), no basilisk or drake scale stand-in (decision 8).

## 5. Verification

- `npx vitest run src/game/tradingPost.test.ts`, then `npm test`: all pass, the refactor guard untouched and green.
- The 50-campaign check identical to step 03's hash, recorded in `log.md` under "Step 04".
- `grep -n "never sells materials" src/game/tradingPost.ts` finds nothing.

## 6. Completion criteria

- [ ] C3 built as written, with every refusal in order and the tests of §4.2.
- [ ] The refactor guard unedited and green; the 50-campaign check identical, recorded in `log.md`.
- [ ] `docs/reference/game.md` (and, if it fits, `src/game/CLAUDE.md`) updated.
- [ ] One commit, "Stage 10 step 04: partners' goods at the Market Hall", files staged by path, no attribution lines; the index's row 04 updated with status and commit.

## 7. Execution record

2026-11-23. Decision 9 as the default (user's Q5 confirmed): contacted, not silent partners only; 3 gold a unit; the simulator never buys.
- Tests first (7 red on missing exports), then C3 in `tradingPost.ts` as written. Refusal texts: "A level 5 trading post sells partners' goods.", "No partner sells <materialName> here.", "Buy a whole number of at least 1.", "It costs N gold, more than the stock holds."
- `npx vitest run src/game/tradingPost.test.ts`: 35 pass. `npm test`: 105 files, 2,676 tests, all pass; refactor guard untouched and green.
- 50-campaign check: `57fdea15...e53e75`, identical to step 03.
- `src/game/CLAUDE.md` 7,413 bytes. `grep "never sells materials"` finds nothing. No deviations. Step 08 reads C3 unchanged.

Review round 1 (opus): clean, three notes, all fixed in the follow-up commit: trade.ts header and the import-cycle line in `src/game/CLAUDE.md` name the `tradingPost.ts`/`trade.ts` cycle (functions only); "refuse in order" also checks an unlisted material at level 4 gives the level refusal; module comment says "not silent". `npm test` green.
