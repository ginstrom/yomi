# Step 10: The simulator

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-04-runes.md) (§2 "The simulator", §6 "Simulator") · [Reference](../../designs/long-campaign/reference/gear-and-runes.md) §5.8 (step 3) · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard")

**Difficulty:** judgement-heavy. The rune policy is simulator behaviour that moves the guard, so the engineer and the reviewer both use the session's model (opus / opus).

## 1. Objective

The campaign simulator plays runes as the careful party would:
- it takes rune loot after each win;
- on home visits, at a workshop, it fuses, buys rank-1 runes for empty sockets, and embeds by a fixed order;
- it extracts runes before it replaces a runed item;
- it records runes found, bought and fused, the sockets filled and the gold on runes, and prints them.

Then the guard is measured with all of this in play. Step 11 judges the figure.

## 2. Requirements and context

- **The stage design (§2):** the simulator "takes rune loot, embeds by the gear policy's rune order (gear §5.8, step 3), fuses whenever allowed, and buys rank-1 runes when gold allows after gear". Its record gains "runes found, bought and fused, and filled sockets".
- **Correction 11** (index), the simulator's rune policy:
  - *Order.* Weapons get Ember, then Storm, then Stone; shields and armour get Stone, then Life. The reference's "ward of the next ring's dominant element" waits for stage 9, as today's map has no ring with a single element.
  - *Where.* It embeds only at a workshop (level 1 or more) on a home visit, never in the field.
  - *Fusing and buying.* It fuses whenever three runes match and the workshop allows. It buys rank-1 runes, after gear, only for empty sockets that the pouch cannot fill.
  - *Replacing gear.* Before it replaces a runed item, it extracts the runes if extracting is allowed and affordable. Otherwise they are sold with the item.
- **Correction 9:** rune loot draws from its own stream, seeded from the battle's seed. The simulator uses the seed it passes to `fight`.
- **Correction 8:** the loot rows for threats 1 to 7 only; the Source rolls threat 5's row; the Salamander Pool favours Ember and the Spider Nest Venom. These are `rollRunes`'s (step 07); this step only calls `takeRunes`.
- **Correction 4:** a direct write to a member's equipment (as `visitFacilities` does when it buys gear) ends with `clampHp(member, maxBefore)`, the maximum read before the write (C3 as amended for the user's answer to D1: a fall keeps the share of hit points).
- **The design's expectation** (§6, check 1): rune loot and Masterwork sockets lift the guard a few points at most. Sockets exist only on tier-1 Masterwork (grade 3) and tier-2 items, which the careful party seldom buys (stage 3: 2 gold on gear a campaign, tier 2 never bought), so few sockets will be filled. Record what happens; do not tune here.

### Contract C11 (from the index, unchanged)

```ts
// scripts/simulate.ts (existing file)
/** The careful party's rune order by slot class (correction 11). */
export const RUNE_ORDER: Record<SlotClass, readonly RuneId[]>   // { weapon: ['ember', 'storm', 'stone'], shield: ['stone', 'life'], armour: ['stone', 'life'] }
/** At a workshop: fuses every rank-1 triple it may, buys rank-1 runes for empty sockets the pouch cannot fill, and embeds by RUNE_ORDER, highest rank first, in each member's weapon, shield and armour. */
export function runecraftGear(game: GameState): { embedded: number; fused: number; bought: number; gold: number }
// CampaignRecord gains: runesFound, runesBought, runesFused, socketsFilled (filled sockets in the party's worn gear at the end), goldOnRunes
```

- After each win, `takeRunes(game, next.threat, next.encounter, battleSeed)` runs, with the seed passed to `fight` (`(seed + battles.length) >>> 0`, before the battle is pushed).
- `visitFacilities`:
  - before it replaces a runed worn item, it extracts the runes when `extractRefusal` is null;
  - it calls `runecraftGear` after the gear is bought and before `craftGear`;
  - then it sells the baggage again, and raises the shrine.
- The summary prints the five new fields.

## 3. Dependencies and prerequisites

Steps 05, 06 and 07 are done. This step may run alongside 08 and 09, which touch `src/scenes/`, `src/testHook.ts`, `encampment.ts` and `e2e/`; this one touches only `scripts/` (and its CLAUDE.md lines).

**What it consumes, as the earlier steps produce it** (copied from the index):

- **C1 (step 03), `src/inventory/runes.ts`:** `RUNE_IDS`, `RuneId`, `Rank`, `RuneKey`, `SlotClass`, `slotClass(slot)`, `runeKey(id, rank)`, `parseRuneKey`, `socketsOf(item)`, `runeFits(rune, item)`, `Pouch`, `pouchCount`, `pouchKeys`. `item.runes` lists the embedded keys, filled sockets first.
- **C3 (step 04), `src/character/character.ts`:** `clampHp(character, maxBefore): void`: if the maximum changed from `maxBefore` and `hp > 0`, `hp = min(max, max(1, round(hp × max / maxBefore)))` (the user's answer to D1); otherwise `hp = min(hp, max)`.
- **C4 (step 04):** `GameState.runes: Pouch` (`newGame` gives `{}`).
- **C5 (step 05):** `Tally.add` in `scripts/simulate.ts` already counts an attack's damage as `damage + Σ bonus[].damage`, `healed` as healing and on-hit statuses as statuses laid. **Do not change it again.**
- **C6 (step 06), `src/game/runecraft.ts`:**

  ```ts
  export const EMBED_GOLD_PER_RANK = 5          // gold × the rune's rank
  export const FUSE_GOLD_PER_RANK = 10          // gold × the new rank
  export const EXTRACT_GOLD_PER_RANK = 10       // gold × the rune's rank
  export const FUSE_COUNT = 3
  export const FUSE_LEVELS: Record<2 | 3 | 4, number>     // { 2: 1, 3: 4, 4: 5 }
  export const EXTRACT_LEVEL = 2
  export function embedCost(key: RuneKey): Stock
  export function fuseCost(from: RuneKey): Stock          // the new rank's
  export function extractCost(key: RuneKey): Stock
  export type RuneResult = { refusal: string } | { refusal: null; item: Item; events: WorldEvent[] }
  export function socketables(game: GameState): Array<{ place: ItemPlace; item: Item; sockets: number }>
  export function embedRefusal(game: GameState, place: ItemPlace, key: RuneKey): string | null
  export function embed(game: GameState, place: ItemPlace, key: RuneKey): RuneResult
  export function extractRefusal(game: GameState, place: ItemPlace, index: number): string | null
  export function extract(game: GameState, place: ItemPlace, index: number): RuneResult
  export function fuseRefusal(game: GameState, from: RuneKey): string | null
  export function fuse(game: GameState, from: RuneKey): string | null
  ```

  Each refuses without changing anything. Embedding at a workshop takes no time. `embed` and `extract` on a worn item already call `clampHp`.
- **C7 (step 07), `src/game/loot.ts`:** `takeRunes(game, threat, encounter, battleSeed): RuneKey[]`, which rolls the runes into `game.runes` and returns them.
- **C8 (step 07), `src/game/tradingPost.ts`:** `RUNE_PRICES` ({1: 15, 2: 45, 3: 135, 4: 405}), `SHOP_RUNES`, `runePrice(key)`, `runeWares(world): RuneKey[]` (rank 1 of the six shop kinds from post level 2, rank 2 from level 4), `buyRuneRefusal`, `buyRune(game, key)` (one rune into the pouch). `salePrice(item)` already counts a runed item's runes at half their price.

**Existing code in `scripts/simulate.ts`** (at `7d32a0a`):
- `Trade` (`goldOnGear`, `goldFromSales`, `crafted`, `tierTwoBought`) and `visitFacilities(game)`. It sells the baggage and surplus materials, raises the post, workshop and infirmary, and buys for each member's `GEAR_SLOTS` (`mainHand`, `offHand`, `armor`) the dearest ware of the same family that costs more than the worn one. It does so with `buy` then `game.baggage.pop()`, `hero.equipment[slot] = bought` and `game.baggage.push(worn)`. Then it sells again, calls `craftGear` when `craftTier(world) !== 'field'`, and raises the shrine.
- `craftGear(game, limit)`, the modifier policy; it already keeps runes, as `craftedItem` does since step 03.
- `runCampaign`: after a win it copies hit points and mana back, calls `rewardVictory`, `autoAdvance`, `clearLocation`, builds a tower and an outpost, field-crafts once, and camps. `fight(encounter.setup, (seed + battles.length) >>> 0, party, args, meta)` is the battle's seed.
- `CampaignRecord` (outcome, days, …, `goldOnGear`, `goldFromSales`, `tierTwoBought`, `crafted`, `fieldCraftDays`, levels) and its initial value in `runCampaign`.
- `CampaignSummary` and `summarizeCampaigns`, with `avg(...)` per field (`avgGoldOnGear`, `avgTierTwoBought`, …).
- `main`'s campaign print: one `console.log` line per topic ("Trading post, workshop, infirmary: …", "Tier-2 items bought: …").
- `scripts/simulate.test.ts` already tests `visitFacilities`, `craftGear`, `materialNeeds` and the summary on fixed states. Follow its fixtures.

## 4. Scope and implementation guidance

**Files:** `scripts/simulate.ts`, `scripts/simulate.test.ts`, CLAUDE.md. Nothing in `src/` changes; if a step-06 or step-07 function turns out to be missing or wrong, stop and report it rather than patching it here.

1. **`RUNE_ORDER`** exactly as C11. A slot's class is `slotClass(slot)`.
2. **`runecraftGear(game)`.** It returns at once (all zeros) unless `craftTier(game.world) !== 'field'`, that is, at a workshop. In this order:
   1. **Fuse.** For each rank-1 key in `pouchKeys(game.runes)`, while `fuseRefusal(game, key) === null`, call `fuse`. Count the fuses, and add their gold. Only rank 1 is fused, since higher fuses need stage 10's levels; still call through `fuseRefusal`, never assume.
   2. **Buy.** For each member, each slot of `GEAR_SLOTS` and each empty socket of the worn item (`socketsOf(item) - (item.runes?.length ?? 0)`), pick the first kind of `RUNE_ORDER[slotClass(slot)]` that `runeFits` the item and that the post sells at rank 1 (`runeWares`). If the pouch, less what earlier sockets of this pass have claimed, holds no rune of any rank of a wanted kind, buy that kind at rank 1 with `buyRune`, if `buyRuneRefusal` is null. Count the runes bought and their gold.
   3. **Embed.** For each member and each slot of `GEAR_SLOTS`, while the worn item has an empty socket: take the first kind in `RUNE_ORDER` that fits and is in the pouch, at the highest rank held, and `embed` it at `{ from: 'worn', member, slot, itemId }`. Stop for that item on any refusal (most likely gold). Count the embeds and their gold.
   4. Return the counts and the total gold spent.

   "Highest rank first" means that within a kind a higher rank is embedded before a lower one. It does not mean that the order's kinds are reordered by rank.
3. **`visitFacilities`.**
   - In the buy loop, before it replaces a worn item that has `runes`, extract them one at a time (index 0 while any remain) while `extractRefusal(...) === null`, adding the fees to the rune gold. The runes go to the pouch, and runes left in the item are sold with it (at half their price, via `salePrice`).
   - Read `maxHp(hero)` before `hero.equipment[slot] = bought`, and call `clampHp(hero, before)` after it.
   - After the gear loop, call `runecraftGear(game)` before the existing `craftGear`, so a new item is fused and runed and then modified (crafting keeps runes).
   - Then sell the baggage again and raise the shrine as now. Move the existing second `sellAll()` if needed so that this order holds.
   - Add `runesBought`, `runesFused`, `runesEmbedded` (internal, for tests) and `goldOnRunes` to `Trade`.
4. **`runCampaign`.**
   - Compute `const battleSeed = (seed + battles.length) >>> 0` once, pass it to `fight`, and after a won battle (once `state.winner === 'player'`, before `clearLocation`) call `takeRunes(game, next.threat, next.encounter, battleSeed)`. Add the count to `record.runesFound`.
   - Add the visit's `runesBought`, `runesFused` and `goldOnRunes` to the record.
   - In `finish`, set `record.socketsFilled` to the sum over the party's worn items of `item.runes?.length ?? 0`.
   - Initialise the five fields to 0.
5. **`CampaignRecord`, `CampaignSummary`, `summarizeCampaigns`:** add `runesFound`, `runesBought`, `runesFused`, `socketsFilled` and `goldOnRunes`, with JSDoc like the others, and `avgRunesFound`, `avgRunesBought`, `avgRunesFused`, `avgSocketsFilled` and `avgGoldOnRunes` in the summary.
6. **The print:** one new line after "Tier-2 items bought", for example `Runes: 1.2 found, 0.4 bought and 0.1 fused a campaign, 12 gold on runes; 0.3 sockets filled at the end`.
7. **Determinism.** Rune loot has its own stream (correction 9), and nothing else here draws. So without sockets, the battles are those of step 05's tree. The summary may still differ through gold spent on runes and the gear it buys.
8. **CLAUDE.md** (the `--campaign` paragraph under "Commands") must say that the simulator now:
   - takes rune loot after each win (`takeRunes`);
   - extracts runes before replacing a runed item, where it may;
   - after buying gear, fuses, buys rank-1 runes for empty sockets and embeds by `RUNE_ORDER` (`runecraftGear`), at a workshop only;
   - prints the runes found, bought and fused, the gold on runes and the sockets filled at the end.

   Remove or amend "Loot is not used" so that it says item loot is not used and rune loot is. Add the guard figure measured here only where step 11 will judge it; leave the rules of scaling to step 11.
9. **Out of scope:**
   - the ward-by-ring table (stage 9);
   - embedding in the field;
   - fusing beyond rank 2;
   - equipping unique items or selling found runes;
   - any tuning (step 11);
   - `Tally` (step 05).

## 5. Verification

1. **Unit tests** in `scripts/simulate.test.ts`, on fixed states built as the file's existing tests build them (`newGame()`, the party at the encampment, the stock and facility levels set directly):
   - `RUNE_ORDER` is exactly C11's.
   - `runecraftGear` does nothing in the field (workshop 0): all zeros, and the pouch, stock and gear unchanged.
   - At workshop 1 with three `ember1` in the pouch, it fuses one `ember2`. With five, it fuses one and leaves two.
   - With a member holding `iron_sword@3` (one socket) and `ember1` in the pouch, it embeds the Ember: the item becomes `iron_sword@3#ember1`, the pouch loses it, and the stock loses 5 gold.
   - With an empty pouch, post level 2 and gold enough, it buys `ember1` and embeds it. With post level 1 it buys nothing, and the socket stays empty.
   - Highest rank first: with `ember1` and `ember2` in the pouch, it embeds the `ember2`.
   - Armour sockets take Stone, then Life. A Mind rune is never chosen.
   - With too little gold, it embeds nothing and leaves the pouch as it was.
   - `visitFacilities`:
     - with a runed worn weapon about to be replaced and workshop 2, the runes come back to the pouch, and the fee is paid;
     - with workshop 1, the runes are sold with the old item;
     - the member's `hp` never exceeds `maxHp` after the visit (`clampHp`).
   - `runCampaign` with a seed and a short run fills `runesFound`, and the record has all five fields as numbers. `summarizeCampaigns` averages them.
2. **The gate:**

   ```sh
   PATH=/opt/homebrew/opt/node@26/bin:$PATH npx vitest run scripts/simulate.test.ts
   PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test
   ```

   Both pass (or `make test`).
3. **The guard**, exactly:

   ```sh
   PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1 --out logs/s4-step10-guard.jsonl
   ```

   Record:
   - the Source beaten, of 500, against step 01's figure;
   - the days, battles and heroes dead a campaign;
   - gold on gear and from sales;
   - the new rune line;
   - the per-threat table.

   Put a short note in the index under "Checkpoints" ("After 10: N of 500 …"). Step 11 judges it. If it moved by more than about 5 points, say which part is responsible, for example with a scratch run that skips `runecraftGear` and one that skips `takeRunes`, neither committed.
4. Never commit a log; `logs/` is gitignored. Run simulations one after another.

## 6. Completion criteria

- [ ] `RUNE_ORDER` and `runecraftGear` exist as C11 says, and `visitFacilities` and `runCampaign` follow §4.
- [ ] The five record fields are recorded, averaged and printed.
- [ ] The tests above pass, and `npm test` passes.
- [ ] The guard is measured and recorded here and in the index's checkpoints, with the rune figures.
- [ ] CLAUDE.md's simulator paragraph is updated.
- [ ] One commit on `long-campaign-stage-04`, not pushed, with the message ending in the repo's `Co-Authored-By` attribution line. Never switch branches.
- [ ] The index's step 10 row says `done` with the commit.

## Execution record
