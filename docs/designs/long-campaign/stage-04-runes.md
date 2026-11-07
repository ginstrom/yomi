# Stage 4: Runes

Part of [the long campaign](index.md). Reference: [`reference/gear-and-runes.md`](reference/gear-and-runes.md) §4.4, §4.5, §4.6 (on-hit damage and hero wards), §5.2, §5.3, §5.6 and §5.7.

## 1. Purpose and status

Gear gets sockets, and the party gets a rune pouch. There are ten runes at four ranks. They are found after wins and bought at the trading post, then embedded, fused and extracted at the workshop. A rune in a weapon adds elemental damage, accuracy or piercing. In armour it adds wards, resistance, armour class, hit points or mana.

Elements and wards came in stage 2. This stage gives them to heroes.

**Status:** done; see the [implementation notes](#implementation-notes).

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
- **At the workshop's Runes tab:** a Masterwork Iron Longsword shows one empty socket. Embedding the Ember rune makes it "Masterwork Iron Longsword [Ember I]". (Square brackets are the user's choice, made during implementation: the ⟨ ⟩ first written here read as parentheses at the tooltip's 12px.)
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

## Implementation notes

Built from the plan in [`docs/implementation-plans/long-campaign-stage-04/`](../../implementation-plans/long-campaign-stage-04/index.md), on branch `long-campaign-stage-04` (off `long-campaign-stage-03`).

**Commits:**
- Step 01, the baseline: `6ad6ab4`.
- Step 02, rune icons and socket pips: `7dab325`.
- Step 03, runes and ids: `1e51399`.
- Step 04, derivation, the pouch and the save (`SAVE_VERSION` 18): `724a09a`.
- Step 05, the engine (`LOG_SCHEMA_VERSION` 23): `9b46d64`.
- Step 06, runecraft: `b1eeef1`.
- Step 07, loot and the trading post's runes: `2d7d130`.
- Step 08, tooltips, pips, wards and battle text: `4c55ee9`, `f1e71e7`.
- Step 09, the Runes tab and the trading post's runes: `cea4f9b` (square brackets), `d106d2c`, `c68c69a`, `58805d7`.
- Step 10, the simulator: `5e04803`.
- Step 11, measure, tune and document: the commit titled "Stage 4 step 11".

**Departures from this design** (the plan's corrections and the user's answers, in brief):
1. Runes sit compact in their sockets: embedding fills the next empty socket, extracting takes a rune by its index and the rest close up, and fusing names the rune fused from.
2. On-hit damage is flat and draws nothing from the battle's dice: added after resistance, cut by the defender's ward, never doubled by a critical. `AttackEvent.damage` stays the weapon's; the rune's is in `bonus[]`, with `healed` and `onHitStatuses`.
3. "The blight's own" is `CombatantStats.blightborn`, set on the Blight Horror; a Dawn rune's bane applies against it and against anything that regenerates.
4. **D1, the user's choice:** a Life rune changes maximum hit points, and every change of gear outside battle keeps the hero's share of its hit points, both when the maximum falls and when it rises (`clampHp`); the engine still clamps on `equip` in battle.
5. Rune prices exist for every rank: 15, 45, 135 and 405 (**D4**, accepted); a rune sells for a third, and an embedded one adds half its price to an item's sale. The post sells six kinds, rank 1 from level 2 and rank 2 from level 4, and never a runed item.
6. A Mind rune fits a weapon only if it strikes with Magic (a wand or a staff).
7. Loot rows for threats 1 to 7 only; the Source rolls threat 5's (**D2**, accepted); the Salamander Pool favours Ember and the Spider Nest Venom at 50%; a debug `fight` rolls none. Runes are drawn from a stream of their own, seeded from the battle's seed.
8. Rank numerals go to IV, and a runed item is named with square brackets, "Masterwork Iron Longsword [Ember I]" (the user's choice during step 09; the ⟨ ⟩ first written read as parentheses at the tooltip's 12px).
9. The simulator's rune policy (**D3**, accepted): Ember, Storm, Stone in weapons and Stone, Life in shields and armour, embedded only at a workshop on a home visit; it fuses every triple it may and buys Lesser runes only for sockets the pouch cannot fill. The aggressive policy counts the on-hit bonus in the harm it expects.
10. Fusing checks the workshop's level before the count; fusing to ranks 3 and 4 waits for stage 10's workshop levels. A field embed reports as a field craft does. `give` takes rune keys.

**The early-game guard** (`npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1`):

| | Step 01 (baseline) | Steps 03 to 07 | Step 10 | Step 11 (final) |
| --- | --- | --- | --- | --- |
| Beat the Source | 233 | 233 (identical) | 230 | **230 (46.0%)** |
| Days, battles a campaign | 269, 18.2 | | 270, 18.2 | 270, 18.2 |
| Heroes dead a campaign | 1.8 | | 1.8 | 1.8 |

The final run: the party fell in 270 campaigns, the encampment never; 26.0 spawns; won at threats 1 to 5: 1007 of 1007, 1732 of 1756, 1932 of 1995, 2847 of 2870, 1333 of 1493 (step 01: 1349 of 1506 at threat 5); trading post, workshop, infirmary 1.1, 0.6, 0.5 at the end; 1 gold on gear and 51 from sales a campaign; 0.0 tier-2 items bought. **Runes a campaign: 13.1 found, 0.0 bought, 0.1 fused, 3 gold on runes, 0.0 sockets filled at the end.**

**No tuning.** The move of 3 is inside the guard's 5 points. Its cause: the simulated party almost never wears a socketed item (no tier 2 is bought, the post ending at level 1.1, and Masterwork is rare), so the runes it finds sit in the pouch, and the difference is the gold of the few fuses moving a purchase or a craft. The design expected rune loot and Masterwork sockets to lift the guard a few points; in the simulator they cannot, as it has no sockets to fill. A real player who buys Masterwork or steel will feel runes; the simulator's economy was not retuned to make it use them.

**Check 2** (Troll Lair, threat 5, party level 5, `--player-weapon` in every hand, 500 battles from seed 1):

| Weapon | Wins | Rounds | Damage dealt a battle | Hit rate | Statuses laid a battle |
| --- | --- | --- | --- | --- | --- |
| `iron_sword@3` | 0 | 7.12 | 49.8 | 0.243 | 1.3 |
| `'iron_sword@3#ember1'` | 0 | 7.13 | 52.6 | 0.244 | 1.3 |
| `'iron_sword@3#ember3'` | 2 | 7.22 | 58.9 | 0.248 | 3.9 |

The plain Masterwork cell is unchanged from step 01. Rank 1 adds 2.8 damage a battle (the "modest gain" is met in damage, as the cell is lost either way); rank 3 adds 9.1 and wins 2, which is not the "large gain" the design expected. The log shows Seared working as designed: 1315 laid on hits over the 500 battles, no troll regenerating while seared (checked event by event), and regenerations down from 3139 to 2285. The cell is lost whatever the party holds (stage 3's hammer and steel swords won 0 too): the trolls deal 148 a battle and the Armoured Troll's resistance 5 takes most of each blow. Recorded for the user; the rune numbers were not tuned.

**The play script**, walked in headless Chromium with a scratch script on the in-browser test driver (not committed), with screenshots looked at:
1. `stock gold 300`, `facility trading_post 3`: the Masterwork Iron Longsword bought for 96 gold; under the Runes filter the six Lesser runes at 15 gold each, two Lesser Ember Runes bought into the pouch; `facility workshop 2`, and `runes` listed the two.
2. On the workshop's Runes tab, the Ember rune embedded for 5 gold: the item became "Masterwork Iron Longsword [Ember I]"; the character panel's tooltip ended "Sockets: 1 of 1" and "Ember I: +1 fire on a hit", and the sword's pip was filled in orange. Extracted for 10 gold, back in the pouch (2 again).
3. `give storm1 3`, fused into a Storm Rune for 20 gold; fusing it on was refused, "Fusing to a Greater Storm Rune needs a level 4 workshop.", the Confirm greyed.
4. With the Ember sword on Aldric, `fight troll_lair 4`: the log read "HITS Troll for 10 dmg +1 fire." on his hits. With `give iron_sword@3#ember3`: "HITS Troll for 10 dmg +3 fire, seared.", then "Troll is no longer seared."; Seared was laid 3 times and no troll regenerated while seared (both battles were lost, as a level 1 party loses a threat-4 lair).
5. A hex off the encampment, from the Craft button's Runes tab, a Lesser Ember Rune embedded in a Masterwork longsword: the preview said "Costs 5 gold and a day.", the screen closed, the turn went from 2 to 3, 5 gold came off and the map reported "A day's work makes the Masterwork Iron Longsword [Ember I]."

Also seen: the Character tab's "Wards:" line with "frost 2" under it for a Rime-runed breastplate, and after a win over the Goblin Raiders the victory screen's "Found: Ring of Protection and Lesser Life Rune."

**Walked by QA after step 11:** the floating "+3 fire" rising from the defender at impact (caught frame by frame, `41-ember3-floating-text-frame03.png`), and the Seared "F" letter on a troll's nameplate (`42-seared-letter-on-troll.png`), both in `.git/pr-review/long-campaign-stage-04/evidence/`. The play script is walked in full.

**Fix round 1** (after the overall review, QA and the simulated user): in battle the character panel caps hit points only when gear moves the maximum, as the engine's `equip` does (the share rule is the world map's; in battle it would let a hero heal by putting Life armour on); the tooltip's socket line names the runes only, "Sockets: 1 of 1 (Ember I)", as the stat lines above already tell what they do (so step 2's "Ember I: +1 fire on a hit" line is now the stat line "On a hit: +1 fire"); a gained stat in a preview reads "On a hit: +1 fire", a lost one "no longer ...", never "none"; the Runes tab's empty list says which gear has sockets, a rune's details and pouch hover say it is set in a socketed item, and a pouch row's hover tells what the rune does in each place; the Character tab shows the weapon's "On a hit:" line.
