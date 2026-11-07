# Step 07: Loot and the trading post's runes

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-04-runes.md) (§2 "Loot", "The trading post"; S4-R3) · [Reference](../../designs/long-campaign/reference/gear-and-runes.md) (§4.4 "Buying runes", §4.5, §5.5, §5.6) · [Stages index](../../designs/long-campaign/index.md)

**Difficulty:** routine, once the contracts are fixed. The engineer may be `model: "sonnet"`; the reviewer is opus (the draw order and the prices are contracts later steps and the simulator rely on).

## 1. Objective

Two sources of runes, both domain code with tests and no scene work:
- `src/game/loot.ts` (new): the runes a won battle yields, drawn from a stream of their own seeded from the battle's seed, and put in the pouch;
- `src/game/tradingPost.ts`: rune wares (rank 1 from level 2, rank 2 from level 4), buying into the pouch, selling from the pouch for a third, and runed items' sale price (an embedded rune adds half its price).

The victory screen's "Found:" line is step 08; the simulator's use of `takeRunes` and `buyRune` is step 10; the trading post's Runes screen is step 09.

## 2. Requirements and context

- **S4-R3:** runes come from loot, the trading post and fusing (fusing is step 06).
- **Design §2, Loot:** `rollRunes(threat, encounter, rng)`, seeded from the battle, using the table rows for threats 1 to 7 only.
- **Design §2, The trading post:** sells rank-1 runes from level 2 and rank-2 runes from level 4. Runes sell for a third of their price. An embedded rune adds half its price to an item's sale price.
- **Reference §4.4:** the post sells Ember, Rime, Storm, Stone, Wind and Life only, at 15 gold for rank 1 and 45 for rank 2. Venom, Acid, Mind and Dawn come only from loot and fusing.
- **Reference §4.5:** the loot rows, and the rule that a nest led by an elemental kind favours its element at 50%.

**Corrections from the index this step carries out:**

- **6.** Rune prices exist for every kind and rank, as first values: `RUNE_PRICES` 15, 45, 135 and 405 for ranks 1 to 4, whatever the kind. The post still sells only the six kinds at ranks 1 and 2.
- **8.** Only the rows for threats 1 to 7 are used:
  - threats 1 to 3: a 50% chance of one rank-1 rune;
  - threats 4 to 7, and anything above until stage 9: one rune, rank 1 at 70% and otherwise rank 2;
  - the Source (threat 5) rolls threat 5's row; the reference's Source row waits for stage 9;
  - the Salamander Pool favours Ember and the Spider Nest Venom, at 50%;
  - a battle the debug console's `fight` starts rolls no runes (it has no location; the scene's wiring in step 08 enforces this by calling `takeRunes` only for a location).
- **9.** Runes are drawn from `lootRng(battleSeed)`, a stream of their own (`mulberry32((battleSeed ^ RUNE_LOOT_SALT) >>> 0)`), so the battle's and the enemy's dice are untouched. The game reads the seed from the battle's `battle_start` event (step 08); the simulator uses the seed it passes to `fight` (step 10).
- **14.** The trading post never sells or prices a runed item as a ware. `sells` and `buyRefusal` refuse an item with runes. `buyPrice` of a runed item is its plain price, with the runes priced on their own. `salePrice` is `floor((item price + Σ RUNE_PRICES of its runes) / 2)`.

### C7. Loot (this step; copied from the index unchanged)

```ts
// src/game/loot.ts (new)
export const RUNE_LOOT_SALT: number                    // a fixed 32-bit constant, e.g. 0x52554e45
/** The rune loot's own stream for a battle (correction 9). */
export function lootRng(battleSeed: number): RNG       // mulberry32((battleSeed ^ RUNE_LOOT_SALT) >>> 0)
/** The element a nest's leader favours, at FAVOURED_CHANCE: { salamander_pool: 'ember', spider_nest: 'venom' }. */
export const FAVOURED_RUNES: Partial<Record<EncounterId, RuneId>>
export const FAVOURED_CHANCE = 0.5
/** The runes a won battle at `threat` against `encounter` yields (correction 8). */
export function rollRunes(threat: number, encounter: EncounterId, rng: RNG): RuneKey[]
/** Rolls the runes of a won battle at a monster location into the game's pouch and returns them. */
export function takeRunes(game: GameState, threat: number, encounter: EncounterId, battleSeed: number): RuneKey[]
```

**The draws, in this order:**
1. At threat 3 or lower, `rng() < 0.5` gives one rune, and otherwise none. At threat 4 or higher there is always one.
2. For each rune:
   - if the encounter has a favoured rune, `rng() < FAVOURED_CHANCE` takes it;
   - otherwise the kind is `RUNE_IDS[Math.floor(rng() * 10)]`;
   - at threat 4 or higher, `rng() < 0.7` gives rank 1, and otherwise rank 2. At threat 3 or lower the rank is 1, with no draw.

### C8. The trading post's runes (this step; copied from the index unchanged)

```ts
// src/game/tradingPost.ts (existing file)
/** What a rune is worth by rank, any kind (correction 6). */
export const RUNE_PRICES: Record<Rank, number>              // { 1: 15, 2: 45, 3: 135, 4: 405 }
/** The kinds the post sells. */
export const SHOP_RUNES: readonly RuneId[]                  // ['ember', 'rime', 'storm', 'stone', 'wind', 'life']
/** The post level that sells each rank. */
export const RUNE_RANK_LEVELS: Partial<Record<Rank, number>>  // { 1: 2, 2: 4 }
export function runePrice(key: RuneKey): number
/** What the post pays for a rune from the pouch: a third of its price, rounded down. */
export function runeSalePrice(key: RuneKey): number
/** The runes the post sells at its level: SHOP_RUNES at rank 1 from level 2, then rank 2 from level 4. */
export function runeWares(world: WorldState): RuneKey[]
export function buyRuneRefusal(game: GameState, key: RuneKey): string | null
/** Buys one rune into the pouch for gold. */
export function buyRune(game: GameState, key: RuneKey): string | null
/** Sells one rune from the pouch. */
export function sellRune(game: GameState, key: RuneKey): string | null
```

- `salePrice(item)` becomes `Math.floor(((buyPrice(unruned(item)) ?? VALUES[unruned(item).id] ?? 0) + Σ runePrice(rune)) / 2)` (correction 14).
- `sells` and `buyRefusal` refuse an item with `runes`.

### Shared constraints (from the index)

- `npm test` (`tsc && vitest run`) passes before the commit (local Node 26: `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or `make test`).
- One commit for this step, on `long-campaign-stage-04`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
- **Determinism.** No battle or world RNG draw is added, dropped or reordered. Loot draws only from `lootRng`.
- No save-format change here: the pouch and `SAVE_VERSION` 18 are step 04's.
- CLAUDE.md stays current (its "Keeping this file current" section): update the lines this change makes wrong.

## 3. Dependencies and prerequisites

- **Step 04 must be done** (and through it step 03). This step consumes, as those steps produce them:
  - from **C1** (`src/inventory/runes.ts`, step 03): `RUNE_IDS`, `RuneId`, `Rank`, `RuneKey`, `runeKey(id, rank)`, `parseRuneKey(text)`, `isRuneKey`, `runeName(key)`, `pouchCount`, `addToPouch(pouch, key, n?)`, `takeFromPouch(pouch, key, n?)` (false, nothing taken, if fewer), `pouchKeys(pouch)`; `type Pouch = Partial<Record<RuneKey, number>>`;
  - from **C2** (`src/inventory/inventory.ts`, step 03): `Item.runes?: readonly RuneKey[]` and `unruned(item): Item` (the item without its runes, itself if it has none). A runed plain item carries `base`, so `baseItem` still finds its plain item; a runed enchanted item has no `base` (correction 15);
  - from **C4** (`src/game/gameState.ts`, step 04): `GameState.runes: Pouch`, `{}` in `newGame`.
- **Existing code this step changes** (at `7d32a0a`, `src/game/tradingPost.ts`):
  - `buyPrice(item)`: `PRICES[family] × TIER_PRICE[tier] × GRADE_PRICE[grade]` of the base item, null for an enchanted one. For a runed plain item it must give the plain price (it does once `baseItem` works on runed items; confirm with a test).
  - `salePrice(item)`: today `floor((buyPrice ?? VALUES[item.id] ?? 0) / 2)`; becomes C8's formula.
  - `sells(world, item)`: today refuses an enchanted or modified item; also refuses one with runes.
  - `buyRefusal(game, itemId)`: today refuses an unknown, enchanted or modified id; also refuses a runed one ("The trading post does not sell that.").
  - `wares(world, filter)`: lists plain items via `craftedItem(base, grade)`, so it lists no runed item; keep it so (a test).
  - `atEncampment`, `notHere`, `spend` and the refusal style (a sentence, or null) are the existing conventions.
- **Existing helpers:** `mulberry32` in `src/combat/rng.ts`; `RNG` in `src/combat/combat.ts`; `EncounterId` in `src/game/encounters.ts` (ids `salamander_pool`, `spider_nest`, among others).
- **Parallel with step 06** (runecraft, `src/game/runecraft.ts`) and step 05 (the engine). This step touches only `src/game/loot.ts` (new), `src/game/loot.test.ts` (new), `src/game/tradingPost.ts`, `src/game/tradingPost.test.ts` and its own CLAUDE.md lines.
- **Consumed by later steps:** step 08 (`takeRunes` and `runeName` on the victory screen), step 09 (`runeWares`, `buyRune`, `sellRune`, `runeSalePrice`, `runePrice` in the trading post screen), step 10 (`takeRunes`, `buyRune`, `runeWares`, runed sale prices in the simulator).

## 4. Scope and implementation guidance

### `src/game/loot.ts` (new)

- Implement C7 exactly, the draws in the stated order. Clamp nothing below threat 1: a threat of 1 to 3 uses the first row; 4 and above the second (stage 9 adds rows past 7).
- `lootRng` returns a `mulberry32` stream; `RUNE_LOOT_SALT` is a fixed constant written once (document it as such: changing it changes every game's loot).
- `takeRunes(game, threat, encounter, battleSeed)` calls `rollRunes(threat, encounter, lootRng(battleSeed))`, adds each to `game.runes` with `addToPouch`, and returns the keys in the order drawn.
- Imports: `loot.ts` imports types from `encounters.ts` and `gameState.ts`; keep it free of anything that runs at load time in those modules (type imports where possible).
- A module comment pointing to the stage design and naming correction 8 (the Source uses threat 5's row; rows past 7 and the Source's own row wait for stage 9).
- Do **not** change `takeLoot` (items stay as they are); rune loot sits beside it. Do not wire the scene (step 08) or the simulator (step 10).

### `src/game/tradingPost.ts`

- Add C8's constants and functions. `runeWares` lists `SHOP_RUNES` at rank 1 when `world.tradingPost >= 2`, then (after all rank 1) at rank 2 when `>= 4`, in `SHOP_RUNES` order.
- `buyRuneRefusal`, in this order: not at the encampment (`notHere`); not a rune key the post ever sells (a kind outside `SHOP_RUNES` or a rank without a level: "The trading post does not sell that."); the level is too low ("A level N trading post sells that."); not enough gold ("It costs N gold, more than the stock holds."). `buyRune` checks, spends the gold and adds one to the pouch.
- `sellRune`: not at the encampment; none in the pouch ("The pouch holds no <runeName>."); otherwise take one and add `runeSalePrice` gold. Any rank and any kind sells.
- `salePrice`, `sells`, `buyRefusal` as C8 and §3 say. `sellables` and `sell` need no change beyond `salePrice`.
- Update the module comment and `TRADING_POST_COSTS`'s doc line to mention the runes by level.
- Out of scope: the encampment's facility descriptions (step 09), the screens (steps 08 and 09), the simulator (step 10).

### CLAUDE.md

- In the domain-layer list, a one-line entry for `src/game/loot.ts`: rune loot after a win, drawn from its own stream seeded from the battle's seed (`lootRng`), by threat, a nest's leader favouring its element; the rows past threat 7 and the Source's own wait for stage 9.
- In `tradingPost.ts`'s entry: rune wares (Ember, Rime, Storm, Stone, Wind and Life at rank 1 from level 2, rank 2 from level 4, `RUNE_PRICES` 15 and 45), buying into the pouch, selling runes from the pouch for a third, and a runed item selling for half of its price plus its runes' (`salePrice`); it never sells a runed item.
- Where the world map's rules say a won battle "puts its loot in the baggage" (`takeLoot`), note that it also rolls runes into the pouch (`takeRunes`) — the scene's call itself lands in step 08, so word it so that it is true after step 08, or leave that sentence to step 08 and say so in the execution record.

## 5. Verification

**`src/game/loot.test.ts` (new):**
- `rollRunes` is deterministic: the same threat, encounter and seed give the same keys twice; `takeRunes` with the same seed gives the same result in two fresh games.
- `lootRng(seed)` differs from `mulberry32(seed)` and from `mulberry32(seed + 1)` (the battle's and the enemy's streams): their first values are not equal for a few seeds.
- Over many seeds (say 2000) at threats 1, 2 and 3: every roll yields 0 or 1 runes, all rank 1; about half yield one (within a loose band, e.g. 40% to 60%).
- At threats 4, 5, 7 and 9: every roll yields exactly one rune, of rank 1 or 2; rank 1 about 70% (loose band).
- Kinds: at a non-favouring encounter (e.g. `goblin_raid`) every one of the ten `RUNE_IDS` appears over many seeds; at `salamander_pool` Ember is about 55% (50% + 5%), and at `spider_nest` Venom likewise; no rank above 2 ever.
- A scripted RNG (a fixed list of values) pins the draw order: e.g. at threat 4, `goblin_raid`, values `[0.35, 0.8]` give `['venom2']` by C7's order (kind `RUNE_IDS[Math.floor(0.35 * 10)]` = `venom`, rank 2 since 0.8 ≥ 0.7); at threat 2, `[0.9]` gives `[]` and `[0.1, 0.0]` gives `['ember1']`; at `salamander_pool`, threat 4, `[0.2, 0.5]` gives `['ember1']` (favoured taken, then the rank draw).
- `takeRunes` adds the drawn runes to `game.runes` (counts add to what the pouch held) and returns them.

**`src/game/tradingPost.test.ts` (existing; add):**
- `runeWares`: level 1 none; levels 2 and 3 the six kinds at rank 1 in `SHOP_RUNES` order; level 4 those six then the six at rank 2.
- `runePrice` and `runeSalePrice`: 15 and 5 at rank 1, 45 and 15 at rank 2, 135 and 45, 405 and 135; the same for every kind.
- `buyRune`: spends the price and adds one to the pouch; refused away from the encampment, for a kind the post never sells (`venom1`, `dawn1`), for rank 2 below level 4, for rank 3, below level 2, and without the gold; a refusal changes neither the stock nor the pouch.
- `sellRune`: adds a third of the price in gold and takes one from the pouch; any kind and rank (e.g. `dawn3`); refused with none in the pouch and away from the encampment.
- A runed item: `sells` false and `buyRefusal` refuses `iron_sword@3#ember1` at every level; `wares` lists no item with runes; `buyPrice('iron_sword@3#ember1')` equals `buyPrice('iron_sword@3')`.
- `salePrice`: `iron_sword@3#ember1` sells for `floor((buyPrice(iron_sword@3) + 15) / 2)`; an item with two runes adds both; `emberblade#dawn1` sells for `floor((VALUES.emberblade + 15) / 2)`; an unruned item's sale price is unchanged from today (keep the existing assertions passing).

**Commands:**

```sh
PATH=/opt/homebrew/opt/node@26/bin:$PATH npx vitest run src/game/loot.test.ts src/game/tradingPost.test.ts
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test
```

**Guard checkpoint:** this step adds only functions the simulator does not yet call, and `salePrice` changes only for runed items, which the simulator never holds before step 10. If `scripts/simulate.ts` and everything it calls are untouched in behaviour, the guard run may be skipped; otherwise run the guard command (`npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1 --out logs/s4-07-guard.jsonl`) and confirm its summary is identical to step 01's.

## 6. Completion criteria

- [ ] `src/game/loot.ts` implements C7 exactly, with the draw order pinned by a scripted-RNG test.
- [ ] `src/game/tradingPost.ts` implements C8; runed items are never wares; `salePrice` includes runes.
- [ ] `loot.test.ts` and the new `tradingPost.test.ts` cases pass; `npm test` passes.
- [ ] CLAUDE.md's lines for `loot.ts` and the trading post updated (and the `takeLoot` sentence handled as §4 says).
- [ ] One commit on `long-campaign-stage-04`, not pushed.
- [ ] Step 07's row in [index.md](index.md) set to `done` with the commit; this file's execution record filled.

## Execution record
