# Step 06: Runecraft

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-04-runes.md) (§2 "Runecraft", S4-R4) · [Reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.4 "Runecraft", §5.2 · [Stages index](../../designs/long-campaign/index.md)

**Difficulty:** judgement in the refusals and their order; the rest is routine. Engineer opus, reviewer opus.

## 1. Objective

Add `src/game/runecraft.ts`. It embeds a rune from the party's pouch into an item's next empty socket, extracts a rune back to the pouch intact for a fee, and fuses three runes of one kind and rank into one of the next rank. Each action has a refusal function that says why it cannot be done, and the action checks everything before it changes anything, as `crafting.ts` does. No scene changes; step 09 builds the Runes tab on these functions.

## 2. Requirements and context

- **The stage design (§2, Runecraft):** `embed`, `extract` and `fuse`, with refusals and costs as in reference §4.4.
  - Embedding works at the workshop at any level, or in the field for rank 1, which takes a day.
  - Fusing to rank 2 needs workshop level 1. Fusing to ranks 3 and 4 needs levels 4 and 5, which stage 10 adds, so until then fusing stops at rank 2. The refusal says which level is needed.
  - Extracting needs workshop level 2.
- **Reference §4.4 costs:** embed 5 gold × rank; fuse 10 gold × the new rank; extract 10 gold × rank. Embedding into a full item is refused: extract first.
- **Corrections from the index this step relies on:**
  - **1.** Runes sit compact in their sockets: filled sockets first, an empty one never written. `embed` takes no socket index and fills the next empty socket. `extract` takes the index of the rune in `item.runes`, and the rest close up. `fuse` takes the rune key being fused from (`fuse(game, 'storm1')` makes a `storm2`).
  - **4.** Life runes change maximum hit points. After any change to a worn item, `clampHp(character, maxBefore)` runs on its wearer, with the maximum read before the change, so `hp <= maxHp` holds. Extracting a Life rune from worn armour keeps the wearer's share of its hit points (the user's answer to D1; C3 as amended in step 03's commit).
  - **16** (context, for step 09). A field embed reports as a field craft does: the scene closes and resumes `World` with `CraftedData`. This step returns the day's events in `RuneResult` for that.
  - **18.** Fusing checks the workshop level before the count. With one rank-2 rune in the pouch, a fuse to rank 3 is refused naming workshop level 4, not "three are needed".

### Contract C6 (copied unchanged from the index)

```ts
// src/game/runecraft.ts (new); follows crafting.ts: refusal strings, ItemPlace, checks everything before changing anything
export const EMBED_GOLD_PER_RANK = 5          // gold × the rune's rank
export const FUSE_GOLD_PER_RANK = 10          // gold × the new rank
export const EXTRACT_GOLD_PER_RANK = 10       // gold × the rune's rank
export const FUSE_COUNT = 3
/** The workshop level that fuses to each rank; 4 and 5 are stage 10's levels, beyond MAX_WORKSHOP_LEVEL (3), so they are always refused for now. */
export const FUSE_LEVELS: Record<2 | 3 | 4, number>     // { 2: 1, 3: 4, 4: 5 }
export const EXTRACT_LEVEL = 2
export function embedCost(key: RuneKey): Stock
export function fuseCost(from: RuneKey): Stock          // the new rank's
export function extractCost(key: RuneKey): Stock
export type RuneResult = { refusal: string } | { refusal: null; item: Item; events: WorldEvent[] }
/** Every item the party has with a socket (allPlaces order), with its sockets. */
export function socketables(game: GameState): Array<{ place: ItemPlace; item: Item; sockets: number }>
export function embedRefusal(game: GameState, place: ItemPlace, key: RuneKey): string | null
/** Takes `key` from the pouch into the item's next empty socket, spending the cost; in the field (rank 1 only) the day passes (passTurn) and its events come back. */
export function embed(game: GameState, place: ItemPlace, key: RuneKey): RuneResult
export function extractRefusal(game: GameState, place: ItemPlace, index: number): string | null
/** Takes the rune at `index` of item.runes back into the pouch, intact, for the fee; the rest close up. No time passes. */
export function extract(game: GameState, place: ItemPlace, index: number): RuneResult
export function fuseRefusal(game: GameState, from: RuneKey): string | null
/** Three of `from` become one of the next rank, in the pouch, for the fee. No time passes. */
export function fuse(game: GameState, from: RuneKey): string | null
```

- **Where.** Each uses `craftTier(world)` (existing, `crafting.ts`).
  - Embedding at a workshop (any level) works for any rank. In the field (`'field'`, which includes the encampment without a workshop), it works for rank 1 only, where `canCamp`, and takes a day.
  - Fusing needs the workshop at `FUSE_LEVELS[new rank]`. It checks the level before the count (correction 18). From rank 4 it is refused: "A Grand rune is the highest rank."
  - Extracting needs the workshop at level 2.
- **The refusals,** each a sentence. The messages are the implementer's, but each must name what is needed:
  - the place is stale (`STALE`);
  - the item has no sockets;
  - its sockets are full ("extract one first"; the reference: overwriting is refused);
  - the rune is not in the pouch, or the pouch holds fewer than three for a fuse;
  - the rune does not fit (`runeFits`);
  - a rank above 1 in the field;
  - nothing can be done here (the field where `canCamp` is false);
  - the workshop's level, named ("Fusing to a Greater rune needs a level 4 workshop.");
  - no rune at that index;
  - the stock cannot afford it.
- After a change to a worn item, `clampHp` runs on its wearer (C3).

### Shared constraints (from the index)

- **The gate:** `npm test` (`tsc && vitest run`) passes before the commit. Locally use Node 26 (`PATH=/opt/homebrew/opt/node@26/bin:$PATH`), or `make test` in podman.
- **Commits:** one commit for this step on `long-campaign-stage-04`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
- **Determinism:** nothing here touches the battle or world RNG except the field embed's `passTurn`, which is the same day a field craft passes. The simulator does not call this module until step 10, so the guard is unchanged. Running it is optional: this step adds only a new module and does not touch `simulate.ts` or anything it calls.
- **Docs:** CLAUDE.md stays current. Edit only this step's own lines, since steps 05 and 07 may commit alongside; rebase your CLAUDE.md edit on theirs if they commit first.
- `tsc` is the lint step: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` (no enums, namespaces or parameter properties) and `verbatimModuleSyntax` (`import type` for type-only imports). Imports use explicit `.ts` extensions.

## 3. Dependencies and prerequisites

**Steps 03 and 04 must be committed.** This step consumes the following, which do not exist at `7d32a0a`:

- **From step 03 (C1, `src/inventory/runes.ts`):**
  - `RuneKey`, `Rank`, `MAX_RANK`, `parseRuneKey(text)` (`{ id, rank } | null`), `runeKey(id, rank)`, `runeName(key)` ("Lesser Ember Rune", for messages);
  - `socketsOf(item)`: the sockets of the unruned item (by tier, +1 at Masterwork, at most 3, at most 1 in a small slot; an enchanted item its own `sockets`);
  - `runeFits(rune, item)`: false for Mind in a weapon that does not strike with Magic;
  - `Pouch` (`Partial<Record<RuneKey, number>>`), `pouchCount(pouch, key)`, `addToPouch(pouch, key, n = 1)`, `takeFromPouch(pouch, key, n = 1)` (false, and nothing taken, if fewer).
- **From step 03 (C2, `src/inventory/inventory.ts`):**
  - `Item.runes?: readonly RuneKey[]`, compact, filled sockets first;
  - `withRunes(item, runes)`: the item with exactly those runes, the same object `itemById` gives for that id, or undefined if they do not fit;
  - `unruned(item)`.
- **From step 04 (C3 and C4):**
  - `clampHp(character, maxBefore)` in `src/character/character.ts` (read `maxHp` of the wearer before the change);
  - `GameState.runes: Pouch` (`newGame` starts it at `{}`).

**Existing code it reuses** (at `7d32a0a`):

- `src/game/crafting.ts`:
  - `craftTier(world)`, which returns `'field'` or the workshop's level;
  - `MAX_WORKSHOP_LEVEL` (3);
  - the refusal-string pattern, and `craft`'s handling of the field day (`passTurn(world, game.party)`, with the events returned).
- `src/game/camp.ts`: `canCamp(world)`.
- `src/game/worldMap.ts`: `passTurn(world, party)` and `encampmentName(world)`.
- `src/game/itemPlace.ts`:
  - `ItemPlace` and `STALE`;
  - `itemAt(game, place)` (null when stale);
  - `replaceAt(game, place, item)`;
  - `allPlaces(game)`: worn, then carried, member by member, then the baggage.
- `src/game/buildings.ts`: `canAfford(stock, cost)`, `spend(stock, cost)`, `describeCost(cost)` and `atEncampment(world)`.
- `src/game/blight.ts`: the `WorldEvent` type.
- `src/game/territory.ts`: the `Stock` type.

**Runs in parallel with** step 07 (`loot.ts`, `tradingPost.ts`) and step 05 (the engine). Neither touches `runecraft.ts`.

**Consumed later by:**
- step 09: the Runes tab calls every function here and shows the refusals as given;
- step 10: `runecraftGear` and the extraction before a replacement.

## 4. Scope and implementation guidance

**Add** `src/game/runecraft.ts` and `src/game/runecraft.test.ts`. Change no other module except CLAUDE.md.

- **Costs:** `embedCost(key)` is `{ gold: 5 × rank }`, `fuseCost(from)` `{ gold: 10 × (rank + 1) }` and `extractCost(key)` `{ gold: 10 × rank }`. No material.
- **`socketables`:** every item `allPlaces(game)` lists with `socketsOf(item) > 0`, in that order, with its socket count. Items with none are left out.
- **`embedRefusal(game, place, key)`:**
  - the item at `place` (`itemAt`; `STALE` if gone);
  - it has sockets, one of them empty (`(item.runes?.length ?? 0) < socketsOf(item)`);
  - the pouch holds the key;
  - `runeFits`;
  - the place: in the field, `canCamp(world)` and rank 1;
  - the cost affordable.
- **`embed`:** on no refusal:
  1. take the key from the pouch;
  2. spend the cost;
  3. build `withRunes(item, [...(item.runes ?? []), key])`;
  4. `replaceAt`;
  5. `clampHp` the wearer if worn;
  6. in the field, `passTurn` and return its events, and otherwise none.

  Return the new item.
- **`extractRefusal(game, place, index)`:**
  - stale;
  - a rune at `index` of `item.runes`;
  - the workshop at the encampment at level `EXTRACT_LEVEL` or more (`craftTier` a number ≥ 2), with the refusal naming level 2 and the encampment when the party is elsewhere;
  - the cost affordable.
- **`extract`:**
  1. remove the rune at `index` (the rest keep their order and close up);
  2. `withRunes` with the rest;
  3. `replaceAt`;
  4. `addToPouch`;
  5. spend;
  6. `clampHp` if worn.

  `events` is empty.
- **`fuseRefusal(game, from)`, in this order:**
  1. rank 4 is the highest;
  2. the workshop at `FUSE_LEVELS[rank + 1]`: in the field or at a lower level, name the level ("Fusing to a Greater rune needs a level 4 workshop."; use `RANK_NAMES` or `runeName` of the new key);
  3. `pouchCount ≥ FUSE_COUNT`;
  4. the cost affordable.

  The level comes before the count (correction 18).
- **`fuse`:** take three of `from`, add one of the next rank, spend.
- **Atomicity:** each action calls its refusal function first and changes nothing on a refusal.
- **Never write the pouch's zero counts:** use `takeFromPouch`, which leaves a key at 0 out.
- **CLAUDE.md:** add one line for `src/game/runecraft.ts` in the domain layer, beside `crafting.ts`, saying that it is runecraft (embed, extract, fuse between the pouch and an item's sockets) and stating the rules:
  - embedding at a workshop at any level, or rank 1 in the field for a day;
  - fusing to rank 2 from workshop level 1, with ranks 3 and 4 waiting for stage 10's levels 4 and 5;
  - extracting intact from level 2;
  - the costs;
  - `clampHp` after a change to a worn item.
- **Out of scope:**
  - the Runes tab and its probe (step 09);
  - the simulator's policy (step 10);
  - the trading post's rune sales (step 07);
  - `encampment.ts`'s workshop description (step 09).

## 5. Verification

Write `src/game/runecraft.test.ts`, building games with `newGame()` and setting what the test needs directly: `world.workshop`, `world.stock`, `game.runes`, the party's hex at or away from the encampment, and the items (via `itemById`, for example `iron_sword@3`, which has one socket, and `steel_longsword@3`, which has two). Cover:

1. **Embed:**
   - at a workshop of level 1, a rank-1 and a rank-2 rune each land in the next socket, so the id becomes `iron_sword@3#ember1`;
   - the gold spent is exactly 5 × rank;
   - the pouch count falls by one;
   - the item at `place` is the `itemById` object;
   - no turn passes.
2. **The field embed:**
   - away from the encampment, or at it with no workshop, a rank-1 embed passes exactly one day (`world.turn` + 1) and returns `passTurn`'s events;
   - a rank-2 embed there is refused;
   - where `canCamp` is false (among monsters), it is refused.
3. **Embed refusals,** each with nothing changed (stock, pouch, the item, `world.turn`):
   - stale place;
   - no sockets (a tier-1 plain item);
   - sockets full;
   - the rune not in the pouch;
   - Mind in a longsword (`runeFits`);
   - unaffordable.
4. **Extract:**
   - at workshop level 2, from a two-rune item at index 0: the rest close up (`#storm1` remains), and the rune returns to the pouch intact;
   - the fee is exactly 10 × rank.
   - Refused, with nothing changed:
     - at level 1, the message naming level 2;
     - in the field;
     - no rune at the index;
     - unaffordable;
     - stale.
5. **Fuse:**
   - three `storm1` at workshop level 1 make one `storm2`, for exactly 20 gold, and the `storm1` key leaves the pouch.
   - Refused, with nothing changed:
     - two only;
     - in the field;
     - unaffordable;
     - from rank 4 ("highest").
   - **To rank 3 with a single `storm2` in the pouch**, at workshop level 3, is refused with a message containing "level 4", which shows the level is checked before the count (correction 18).
6. **Hit points:** a member wearing armour with a `life1` rune (for example `steel_breastplate#life1`), at full hit points, has the rune extracted. Its `hp` falls to the new `maxHp` (`clampHp`).
7. **`socketables`:** it lists items with sockets in `allPlaces` order, and leaves out those without.

**Commands:**

```sh
PATH=/opt/homebrew/opt/node@26/bin:$PATH npx vitest run src/game/runecraft.test.ts
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test
```

Both pass. No simulator run is required (the guard is untouched; see the shared constraints).

## 6. Completion criteria

- [ ] `src/game/runecraft.ts` exports exactly C6, and every action checks everything before changing anything.
- [ ] `runecraft.test.ts` covers every item of §5 and passes, as does `npm test`.
- [ ] CLAUDE.md has the runecraft module line and its rules.
- [ ] One commit on `long-campaign-stage-04`, not pushed.
- [ ] Step 06's row in [index.md](index.md) is `done` with the commit, and the execution record below is filled.

## Execution record

- **Built:** `src/game/runecraft.ts`, exporting exactly C6 (costs, `FUSE_LEVELS`, `EXTRACT_LEVEL`, `socketables`, `embed`/`extract`/`fuse` and their refusal functions). Each action calls its refusal function first, so a refusal changes nothing. Refusal order: embed — stale, no sockets, full ("extract one first"), not in the pouch, `runeFits` (Mind outside a wand or staff), the field (`canCamp`, then rank 1), the cost; extract — stale, no rune at the index, the workshop at level 2 (naming the encampment when away), the cost; fuse — rank 4 ("A Grand rune is the highest rank."), the workshop level (`Fusing to a Greater Storm Rune needs a level 4 workshop.`, before the count, correction 18), the count, the cost.
- **Hit points (C3, D1 both ways):** `src/game/itemPlace.ts`'s `replaceAt` and `removeAt` now end a worn change with `clampHp(wearer, maxBefore)`. Runecraft relies on `replaceAt` for that rather than clamping a second time (a second call would be a no-op). This also covers crafting on a worn runed item. New `src/game/itemPlace.test.ts` (both paths, red without the change); runecraft tests embed a `life1` into worn `steel_breastplate` at full hp (rises to the new max) and extract it (falls back), and a wounded hero keeps its share.
- **Review clean-ups carried in this commit:** a direct rise case in `character.test.ts`'s clampHp tests (hp 18 of 36 → 20 of 40, with `steel_breastplate@3#life2.life2` giving max 40); CLAUDE.md's "enchanted items take neither" now reads "take no grade or modifier"; step 04's index row carries `724a09a`.
- **CLAUDE.md:** a `runecraft.ts` line beside `crafting.ts` with the rules and costs; the `itemPlace.ts` line says a worn change clamps hp.
- **Deviations:** none from C6. The field-day test compares `embed`'s events with `passTurn` on an identical twin game, rather than only checking a day passed.
- **Checks:** `npx vitest run src/game/runecraft.test.ts` 14 passed; `npm test` 77 files, 1147 tests passed. Guard (optional; run because `replaceAt` is on crafting's path, which the simulator uses): `npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1 --out logs/step06-guard.jsonl` (about 5 min). Its last 40 lines (from "Tier-2 items bought" through the threat table, 1007/1732/1927/2825/1349 won, and the values table, 9107 battles, 8840 player wins, 267 enemy wins) match step 01's summary line for line; the first lines, "Beat the Source" among them, were cut by a `tail -40` in the command, but 267 enemy wins of 267 campaigns lost is the baseline's.
- **For later steps:** step 09 can show the refusals as given; step 10's direct gear writes through `replaceAt`/`removeAt` are clamped already.
