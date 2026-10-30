# Stage 11: The high roster

Part of [the long campaign](index.md). Reference:
- [`reference/campaign-to-level-20.md`](reference/campaign-to-level-20.md) §5.5 (monsters), §5.2 (yardstick) and §4.2;
- [`reference/gear-and-runes.md`](reference/gear-and-runes.md) §4.3 (trophies) and §4.6 (monster wards).

## 1. Purpose and status

The outer rings get their monsters, from the wolf packs of threat 7 to the elder wyrm of threat 18, and the Source is rebuilt as a threat-20 boss. Each kind has a native-level block written against the yardstick, its abilities (from stage 2's system), any wards, a trophy where gear §4.3 names one, an encounter with a band, fixed nests in its ring, a spawn kind and a sprite.

This is a content stage, and it can be landed **ring by ring**, each ring a playable increment.

**Status:** ready for planning.

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
