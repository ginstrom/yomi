# Stage 4: Runes

Part of [the long campaign](index.md). Reference: [`reference/gear-and-runes.md`](reference/gear-and-runes.md) §4.4, §4.5, §4.6 (on-hit damage and hero wards), §5.2, §5.3, §5.6 and §5.7.

## 1. Purpose and status

Gear gets sockets, and the party gets a rune pouch. There are ten runes at four ranks. They are found after wins and bought at the trading post, then embedded, fused and extracted at the workshop. A rune in a weapon adds elemental damage, accuracy or piercing. In armour it adds wards, resistance, armour class, hit points or mana.

Elements and wards came in stage 2. This stage gives them to heroes.

**Status:** ready for planning.

## 2. Scope

**In:**
- **Runes and sockets.**
  - `src/inventory/runes.ts`: `RUNES`, `RANK_NAMES` and `socketsOf` (gear §4.4). Tiers 1 and 2 give 0 and 1 sockets, with +1 at Masterwork.
  - Unique items' sockets: Emberblade 1, Storm Wand 1, Hawkeye Bow 1, and 0 for the rest.
  - The id grammar gains `#<rune>.<rune>`.
- **New stats.**
  - `ItemStats` gains `wards` and `onHit`.
  - `deriveCombatStats` sums wards over everything worn, and takes on-hit effects from the main hand only.
  - `maxHp` comes from Life runes in armour.
- **The engine.**
  - `onHit` bonus damage is rolled on a hit, added after resistance, warded, and not doubled by a critical.
  - On-hit statuses are laid after the damage. Life healing is applied.
  - `AttackEvent` gains `bonus` and `healed`.
  - The Dawn rune's "bane" applies to kinds with regeneration or the blight's own (the Horror).
- **The pouch.** `GameState.runes` is saved.
- **Runecraft.** `src/game/runecraft.ts`: `embed`, `extract` and `fuse`, with refusals and costs as in gear §4.4.
  - Embedding works at the workshop at any level, or in the field for rank 1, which takes a day.
  - Fusing to rank 2 needs workshop level 1. Fusing to ranks 3 and 4 needs levels 4 and 5, which stage 10 adds, so until then fusing stops at rank 2. The refusal says which level is needed.
  - Extracting needs workshop level 2.
- **Loot.** `src/game/loot.ts`: `rollRunes(threat, encounter, rng)`, seeded from the battle, using the table rows for threats 1 to 7 only. The victory screen lists runes found.
- **The trading post** sells rank-1 runes from level 2 and rank-2 runes from level 4. Runes sell for a third of their price. An embedded rune adds half its price to an item's sale price.
- **Scenes.**
  - `CraftingScene` gains a Runes tab: the pouch, the item's sockets, and embed, extract and fuse.
  - Inventory tooltips show sockets and runes, and the character panel shows wards.
  - The trading post gets a Runes section.
  - Battle floating text shows "+3 fire".
  - Each rune gets an icon, and items show a socket pip row.
- **The simulator.**
  - It takes rune loot, embeds by the gear policy's rune order (gear §5.8, step 3), fuses whenever allowed, and buys rank-1 runes when gold allows after gear.
  - The record gains runes found, bought and fused, and filled sockets.

**Out:**
- ranks 3 and 4 by fusing (stage 10's workshop levels);
- the loot table's rows past threat 7 (stage 9);
- runewords (deferred: gear §8.6).

## 3. Requirements

| ID | Requirement | Reference |
| --- | --- | --- |
| S4-R1 | Sockets by tier, grade and unique; ids with runes. | gear R8, §5.1 |
| S4-R2 | Ten runes, four ranks, effects by slot class. | gear R9, §4.4 |
| S4-R3 | Runes from loot, the trading post and fusing (to rank 2 in this stage). | gear R10 |
| S4-R4 | Embed, extract and fuse, with field embedding for rank 1. | gear R11 |
| S4-R5 | On-hit bonus damage and statuses, Life healing, hero wards. | gear R12, A6, A7, A8 |
| S4-R6 | The UI for sockets, pouch and runecraft. | gear R13 |

## 4. What the player sees

- **After a win:** "Found: Lesser Ember Rune".
- **At the workshop's Runes tab:** a Masterwork Iron Longsword shows one empty socket. Embedding the Ember rune makes it "Masterwork Iron Longsword ⟨Ember I⟩".
- **In battle,** hits read "HITS Troll for 8 dmg +1 fire". At rank 3 the rune lays Seared, and the troll stops regenerating.
- **Wards.** A breastplate with a Rime rune shows "Frost ward 2". The Salamander's spit lands 2 less on that hero, as does a Giant Spider's poison tick with a Venom ward.

## 5. Technical notes

- `runeStats(rune, rank, slotClass)`. A slot class is a weapon (main hand), a shield (off hand) or armour (every other slot).
- **Versions:**
  - `LOG_SCHEMA_VERSION` is bumped (`bonus` and `healed`).
  - `SAVE_VERSION` is bumped (the pouch, and ids with runes).

## 6. Verification

**Tests:**
- `runes.test.ts`: every rune by slot class and rank; `socketsOf`.
- `catalog.test.ts`: the grammar with runes, including on unique items.
- `runecraft.test.ts`:
  - embed, extract and fuse, with every refusal;
  - the field embed passes a day.
- `character.test.ts`:
  - wards summed;
  - `onHit` from the main hand only;
  - Life `maxHp`.
- `battleEngine.test.ts`:
  - bonus damage on a hit only, not doubled by a critical, ignoring resistance, warded;
  - Ember 3 lays Seared and stops regeneration (raise the rank in the test's item directly);
  - Life heals;
  - a hero ward against a Salamander spit.
- `loot.test.ts`: rolls deterministic for a seed, ranks by threat.
- `tradingPost.test.ts`: rune wares and prices.
- Scene tests:
  - the Runes tab flows and refusals;
  - tooltips;
  - floating text.

**Simulator:**
1. The early-game guard. Rune loot and Masterwork sockets should lift the figure a few points at most.
2. Single cells: a troll lair at threat 5 with and without an Ember-runed longsword, given by `--player-weapon iron_sword@3#ember1`. Expect a modest gain at rank 1 and a large one at rank 3 (given directly).

**Play script:**
1. Run `stock gold 300` and `facility trading_post 3`, buy a Masterwork longsword and two Lesser Ember runes, then `facility workshop 2`.
2. At the workshop, embed one rune. See the name and the tooltip change. Extract it, see the fee, and see it back in the pouch.
3. Fuse three Lesser Storm runes (`give` them via debug) into a Storm rune. A fourth fuse to rank 3 is refused, naming workshop level 4.
4. Run `fight troll_lair 4` with the Ember sword. See "+1 fire" on hits. Give `iron_sword@3#ember3` and see Seared stop the regeneration.
5. Embed a rank-1 rune in the field. One day passes.

## 7. Risks

- **The UI scope** (the Runes tab) is the heaviest piece of this stage. Keep the flows to select, act and confirm.
- **Stacking Life runes.** Sockets cap it at tiers 1 and 2.

**Done when:** all tests pass, the guard holds, and the play script has been walked.
