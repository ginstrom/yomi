# Stage 11: The high roster

Part of [the long campaign](index.md). Reference:
- [`reference/campaign-to-level-20.md`](reference/campaign-to-level-20.md) §5.5 (monsters), §5.2 (yardstick) and §4.2;
- [`reference/gear-and-runes.md`](reference/gear-and-runes.md) §4.3 (trophies) and §4.6 (monster wards).

## 1. Purpose and status

The outer rings get their monsters, from the wolf packs of threat 7 to the elder wyrm of threat 18, and the Source is rebuilt as a threat-20 boss. Each kind has a native-level block written against the yardstick, its abilities (from stage 2's system), any wards, a trophy where gear §4.3 names one, an encounter with a band, fixed nests in its ring, a spawn kind and a sprite.

This is a content stage, and it can be landed **ring by ring**, each ring a playable increment.

**Status:** done (see [Implementation notes](#implementation-notes)); the far cells and the long run are recorded for stage 12, as the user decided.

## 2. Scope

**In**, in landing order:

| Ring | Kinds (native) | Encounters (band) | Trophy |
| --- | --- | --- | --- |
| 7 | Wolf (6), Worg Rider (7), Ogre (7) | Wolf Pack (6–9), Worg Riders (6–9), Ogre Camp (7–10) | wolfhide |
| 9 | Wyvern (9) | Wyvern Roost (9–12) | wyvern hide |
| 12 | Barrow Wight (11), Basilisk (11), Hill Giant (12) | Barrow Wights (11–14), Basilisk Lair (11–14), Hill Giant Steading (12–15) | basilisk scale |
| 15 | Stone Golem (14), Blight Cultist (14), Young Dragon (15) | Golem Ruin (14–17), Blight Cult (14–18), Young Dragon (15–18) | drake scale |
| 18 | Blight Lich (17), Elder Wyrm (18) | Blight Lich's Court (17–20), Elder Wyrm (18–20) | drake scale |
| Source | Blight Horror rebuilt at native 20 | Source Guardians (20) | — |

**Blocks and abilities** are as in campaign §5.5, with these decisions for this stage:
- The wolf's pack bonus, the wyvern's flight, and the wight's resistance to non-magic weapons stay deferred. They are plain blocks.
- The Stone Golem's immunity to ticking statuses is a `StatusRule`-independent flag, `CombatantStats.immune`, checked when a status is laid. It is the one small engine addition.
- Monster wards follow their element: the Young Dragon and Elder Wyrm have fire 10 and 15, and the golem has poison 99.

**Also in:**
- **Each ring's nests** replace bandit-filled placeholders from stage 9. Bandits keep about a third of each ring.
- **`SPAWN_KINDS`** gains the new encounters, by band.
- **Trophies** now come from kills. Elder Glade's stand-in from stage 10 is removed.
- **Rune loot** favours a nest's element (gear §4.5).
- **Sprites:** 14 units, drawn ring by ring.
- **The yardstick test** covers every new kind, against stage 12's expected kit if stage 12's measurement is ready. Otherwise it uses stage 10's `expectedKit` readings.

**Out:** the deferred behaviours above.

## 3. Requirements

| ID | Requirement | Reference |
| --- | --- | --- |
| S11-R1 | Each kind's block, abilities, wards, `FOE_XP`, `FOE_NATIVE_LEVEL`, trophy and sprite. | campaign R7, A11 |
| S11-R2 | Each encounter with its band, counts, fixed nests and spawn kind. | campaign R5 |
| S11-R3 | The Source rebuilt at 20. | campaign §5.5 |
| S11-R4 | The golem's immunity flag. | — |
| S11-R5 | Trophies from kills. | gear R7 |

## 4. What the player sees

- **Ring 7:** wolves run down the archer. Worg riders strike spear and bite in one action. An ogre sweeps everyone beside it.
- **Ring 15:** a Young Dragon's fire breath scorches the front rank. A party with Ember wards shrugs off a third of it. Its scales forge drake-scale leather.
- **At the Source:** the Horror breathes blight around itself, corroding armour, and regenerates unless seared or corroded.

## 5. Technical notes

- **Per ring:** blocks in `combat.ts`; encounters, kinds, XP and native levels in `encounters.ts`; nests in `worldMap.ts`; sprites; trophies in `encounters.ts`.
- **Versions:**
  - `SAVE_VERSION` is bumped for each ring landed that changes fixed locations.
  - `LOG_SCHEMA_VERSION` is bumped only if a new event field is needed (the immunity's log line).

## 6. Verification

**Per ring:**
- **Tests:**
  - the kinds' yardstick test;
  - the encounters' composition at their bands' ends;
  - each new ability's behaviour on the kind (one engine test per kind with something special).
- **Simulator:** `--encounter X --threat T --party-level T` with expected kit (`--player-kit expected`, a flag added in this stage: it gives every member `expectedKit` for their role and level), at both ends of each band. A party of the threat's level wins most but not all.
- **Play:** `fight <encounter> <threat>` for each new encounter with a party levelled and kitted (`xp`, `give`). Check each ability fires, its log reads well, and the sprite reads clearly.

**After the last ring:** the long campaign (100 campaigns) against stage 10's numbers. The Source share and the battles to level are recorded for stage 12.

## 7. Risks

- **Too many kinds to tune at once.** Land them ring by ring, and keep the bandit placeholders until each ring's tuning holds.
- **Sprites as the bottleneck.** Delegate them per ring, in parallel with the blocks.

**Done when:** every ring's kinds, nests and sprites are in, all tests pass, the per-ring cells are fair, the long run is recorded, and every new encounter has been fought in play.

## Implementation notes

Built as fifteen steps (`docs/implementation-plans/long-campaign-stage-11/`; every figure below is in its `log.md`, seed 1, 500 battles a cell, one run at a time; the decisions and the user's answers are in `docs/features/long-campaign-stage-11.md`).

**Commits by step.** 01 the baseline `42eaff0`; 02 `--player-kit expected` and the kitted yardstick `67a6f0d`; 03 the golem's immunity `d94188b`; sprites 04 ring 7 `21834ec`, `d4d6402`, 05 rings 9 and 12 `5bc31dc`, `3d0e480`, 06 ring 15 `7ebb9c6`, `943e193`, 07 ring 18 and the Source `95e5046`, `651a4c7`; 08 ring 7 `b0fbe7d`, `4ca43d2`; 09 ring 9 `2b35cb9`, `cecd65f`; 10 ring 12 `5257f59`, `65ac1c0`, `9f692dc`; 11 ring 15 `5c83ec8` to `4ccac5e`; 12 ring 18 `adb0921` to `6061296`; 13 the Source at 20 `0709692` to `a0b056e`; 14 measure `05cf092` to `504fec3`; 15 this documentation and the play script.

**What landed, ring by ring.**
- **Ring 7** (threat 7): the Wolf (native 6, 10 AP), the Worg Rider (Spear and Bite, one action of two strikes) and the Ogre (Sweep: a burst of radius 1 round itself, foes only, through resistance); the Wolf Pack (6–9), Worg Riders (7–9) and Ogre Camp (7–10); the Greyfang Pack, Hollow Riders and Ashen Hill Ogres in place of the Webwood Nest, Hollow Spiders and Ashen Pool; wolfhide 1 a wolf or rider; save 32.
- **Ring 9**: the Wyvern (Bite and Tail Sting, the sting poisoning); the Wyvern Roost (9–12, 4, 4, 3, 3 foes); the Cinder and Deepcrag Roosts and the Mere Ogres; wyvern hide 3; Elder Glade's wyvern-hide stand-in removed; save 33.
- **Ring 12**: the Barrow Wight (Drain Life), the Basilisk (Gaze: a cone that chills) and the Hill Giant (Rock: a burst of radius 0 at range 4, through resistance); Barrow Wights, the Basilisk Lair and the Giant Steading; the Stonegate Barrow, Thornwall Lair and Marsh Steading; basilisk scale 3; save 34.
- **Ring 15**: the Stone Golem (resistance 8, poison ward 99, `immune`), the Blight Cultist (Lightning Bolt, Curse, Heal; blightborn) and the Young Dragon (Fire Breath, a 6d6 cone of 3; Bite and Claws); the Golem Ruin, Blight Cult and Dragon Lair; the Grey Ruin, Wolfhead Cult and Saltwind Drake; drake scale 6; save 35.
- **Ring 18**: the Blight Lich (Lightning Bolt, Death Cloud, Drain Life, Dark Shield, regeneration 3) and the Elder Wyrm (an 8d6 cone of 4, regeneration 2, fire ward 15); the Lich Court and Wyrm Lair; the Ashen Court, Last Wyrm and Blightmarch Drake; drake scale 10; save 36.
- **The Source at 20**: `source_horror`, the Blight Horror of native 20 (Blight Breath: 8d6 blight round itself, foes only, Corroded; Claws; regeneration 2; blightborn) with two Blight Cultists (`SOURCE_AT_20`); the near-home Source at threats 1 to 5 is unchanged. `SOURCE_FOE_LEVEL` and `maxFoeLevel` are gone.
- **Engine and simulator**: `CombatantStats.immune` (no ticking status laid; the outcome's `immune: true`, log schema 27); `--player-kit expected` (`expectedGear`); `KITTED_FIGHTER_GROWTH` and `foeYardstick(level, kit)`, the stage's kinds held to `'expected'`; 13 unit sprites; favoured runes (Wyvern Roost venom, Basilisk Lair rime, Blight Cult and Lich Court storm, the dragon lairs ember).

**Departures** (the plan index's decisions). 3: the near-home Source keeps the old Horror and a new kind `source_horror` guards the far one, so the early figures and the guard stay as they were. 4: "most but not all" is read as 300 to 475 of 500 at the band's ends with the expected kit, report only, not a band; from step 11, by the user's rule, the threats the map has (7, 9, 12, 15, 18) are tuned inside first and the band's ends second. 8: Worg Riders 7–9, not 6–9 (the rider is native 7). 9: 13 sprites, not 14. 11: Sweep and Rock are built from the existing area fields; `throughResistance` cuts an area by the target's resistance less the user's `armorPierce`, and an area without it ignores resistance (the breaths). 12: the immunity added a log field, so `LOG_SCHEMA_VERSION` went to 27 and the guard's event hash was re-recorded with play unmoved. The user took the planner's defaults for Q1, Q2 and Q6–Q10, and answered Q3 to Q5 as the decisions above read; the user also decided the Wyvern Roost's falling counts, the step 11 tuning rule, and to accept the out-of-reading cells below.

**Early figures** (`--near-source`, step 01 → step 14): `one` 288 → 287 (331 days, 1.2 dead), `company` 289 → 288, `rl10` 409 → 371 (533 → 541 days). The 50-campaign check is identical and the refactor guard green throughout. The move comes from ring 7's and 9's kinds joining the `SPAWN_KINDS` the blight draws from at threats 7 and 9 (the 50-campaign check never spawns at 7, so it cannot see it); the user accepted it (`rl10` is still in its band, 370 to 420).

**The long run** (100 campaigns, ready level 18), recorded for stage 12, not tuned: the Source beaten 0 of 100 (stage 10: 1), 739 days (1414), 26.8 battles (42.3); battles to level 5, 10 and 15: 6.8, 26.8, 47.3 (stage 10: 6.8, 28.4, 55.9), level 20 never reached; ring win rates 7 0.82, 9 0.46, 12 0.60, 15 0 in 3 battles; the kit stays at tier 1 with no runes, so the campaigns end at rings 7 to 9 and the rebuilt Source is never fought. Stage 12 owns this (the gear lag and the spend order).

**The cells** (expected kit, party of the threat's level; the full table with every trial is in `log.md`): WP6 418, WP9 358, WR7 463, WR9 326, OC7 405, OC10 308, WY9 312, WY12 399, BW11 485, BW14 327, BL11 425, BL14 304, HG12 495, HG15 400, GO14 468, GO17 438, CU14 345, CU18 471, YD15 491, YD18 396, LC17 497, LC20 332, EW18 482, EW20 408, SGK20 445; in play BW12 477, BL12 445, GO15 366, CU15 429, YD15 491, LC18 464, EW18 482. Outside 300–475 and accepted: BW11 485 and HG12 495 (band bottoms, step 10's rule), YD15 491 and EW18 482 (in play, the user), LC17 497 (a band bottom); BCO12K 254 is a yardstick cell, not a ring's. The ready-made party in its own gear wins 0 of 500 at the Source (SG20).

**The play script**, walked in the dev build (`npm run dev` under the in-browser harness, headless Chromium, `?seed=42`, a throwaway script outside the repository): every new encounter at both ends of its band and the Source at 20, the party raised with `level <T> all auto` and dressed in `expectedGear`'s kit (planted in the save, as `give` and dressing by hand for 25 fights would be; the kit is the one `--player-kit expected` uses), each fight auto-resolved from the battle screen; one Worg Band played out turn by turn; the trophies taken at five fixed nests; a Drake-scale Leather forged from the Last Wyrm's drake scale; the Market Hall's goods. 22 of the 25 auto-resolved fights won (lost: the Basilisk Lair at 11 and 14, against cells of 425 and 304, and the Elder Wyrm at 20, cell 408: one seeded battle each, not a rate); the Worg Band played by the harness's naive player (each hero at the nearest foe) was lost in 26 rounds. Every ability fired and its line reads well ("Worg Rider Chief spears Aldric … bites Aldric", "Ogre Keeper sweeps its club: MISSES Brenna; HITS Delwyn for 14 dmg.", "Giant Chief hurls a rock: HITS Aldric for 8 dmg (armour stops 4).", "Blight Horror breathes the blight: HITS Aldric for 30 dmg, corroded.", "HITS Stone Warden for 26 dmg (armour stops 4), pinned, unaffected by the rest."); every sprite reads clearly, with no placeholder and no console error; the victory screen lists the trophies ("Trophies: 4 wolfhide.", "12 wyvern hide", "6 basilisk scale", "6 drake scale, 3 wyvern hide", "16 drake scale"); no partner sells wyvern hide. Findings for stage 12 or later, not tuned: one Ember rune of rank 2 in body armour wards 4 of the Young Dragon's breath (24 → 20 on a hit, 12 → 8 on a miss), a sixth to a third, not the design's "a third"; one Young Dragon's 6 drake scale is half a Drake-scale Leather (12); the victory line reads "The Greyfang Pack are beaten." (and the Cinder Roost, Saltwind Drake, Last Wyrm), plural for a singular name; a caster foe's spells (wights, cultists, the lich) are not listed in the hover panel, which shows abilities and wards only; the Ogre sweeps only with two heroes beside it, so a taunting fighter alone draws its club. Detail: `log.md`, "Step 15".

**Follow-ups outside the stage:** the `stopVoice` fade race in `src/scenes/soundPlayer.ts`; battle e2e A9 failing in the full battle file (order-dependent); e2e runs not protected against a sleeping machine.
