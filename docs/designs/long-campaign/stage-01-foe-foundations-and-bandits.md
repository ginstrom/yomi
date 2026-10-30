# Stage 1: Foe foundations and bandits

Part of [the long campaign](index.md). Reference: [`reference/campaign-to-level-20.md`](reference/campaign-to-level-20.md) §5.2, §5.3, §5.5 (humanoids) and §5.7.

## 1. Purpose and status

This stage lays the foundation for foes beyond threat 5, without changing the map. It is checked in play through the first new opponents, bandits, at threats 3 to 5.

**Under the hood:**
- every foe kind gets a native level;
- every encounter gets a band of threats and its own foe counts;
- the simulator gets `--ready-level`.

**For the player:**
- **Bandit camps** on today's map. They are human opponents built by the same rules as heroes: drafts, levels, skill points, perks and gear.
- **A debug command** to fight any encounter at any threat, which later stages use to check their foes.

**Status:** ready for planning.

## 2. Scope

**In:**
- **Native levels.** `FOE_NATIVE_LEVEL` and `foeAtLevel(base, level, native)`, with the hit-point rule of campaign §5.3. Today's kinds are native 1, so their numbers are unchanged.
- **Bands.** `ENCOUNTER_BANDS` and per-encounter `counts`, which replace the global `FOES_AT_THREAT` cap. Today's five encounters keep their counts, cut to their bands. `encountersFor(threat)`.
- **The yardstick.** `foeYardstick(level)` (campaign §5.2), with its unit test applied to today's kinds at threats 1 to 5, recording any kind that falls outside a band as a named exception. It is written against the bare hero table (campaign §3). Stage 12 re-measures it against expected kit.
- **Bandits.** `banditStats(role, level, tier)` in a new `src/game/bandits.ts`. Stage 1 bandits use only today's items, at grade 1 at threats 3 to 4 and Fine at 5:

  | Role | Weapon | Body | Other |
  | --- | --- | --- | --- |
  | Cutthroat | Iron Dagger | — | — |
  | Archer | Yew Bow | — | — |
  | Brute | Iron Battle Axe | Steel Breastplate | — |
  | Hedge-Mage | Wand of Sparks | — | Magic Arrow, Flame Arrow, Shield |
  | Captain | Iron Longsword | Steel Breastplate | Oak Shield, perks spent by `autoAdvance` |

  The crossbowman waits for stage 3's crossbow. Each role uses a pre-roll-like draft fixed in the module, so bandits are deterministic.
- **The Bandit Camp encounter.** Band 3–7, with counts [3, 3, 4] at threats 3, 4 and 5 (later stages extend the counts). The camp is Captain, Brute, Archer, then Cutthroat, with the Hedge-Mage from threat 4. `FOE_XP` is 100 for every role (an even foe).
- **The map.** Two of today's nests become bandit camps:
  - Kobold Skulkers (30, 22) becomes **Bandit Camp** (threat 3);
  - Goblin Outriders (47, 13) becomes **Bandit Hideout** (threat 5).

  `SPAWN_KINDS` gains "Bandit Gang", which spawns only where its band holds.
- **Spawns by band.** `spawn` picks only kinds whose band holds `threatAt(at)`.
- **Sprites.** Five units: `bandit_cutthroat`, `bandit_archer`, `bandit_brute`, `bandit_mage` and `bandit_captain`. Each is a human silhouette in a ragged palette distinct from the heroes, so a bandit is never mistaken for a party member.
- **The simulator:**
  - `--ready-level N`, with `SOURCE_READY_LEVEL` staying 7;
  - the threat table prints any threat that occurs;
  - the record gains `finalLevels`, `deathsAtLevel` and `battlesToLevel` (campaign §5.7).
- **The debug command** `fight <encounter> [threat]`, a world-map command that changes the game. It starts a battle of that encounter at that threat (default: `threatAt` of the party's hex) against the party, as if a location were attacked, with no location cleared and no loot.

**Out (later stages):**
- threat rings past 5 and the bigger map (stage 9);
- abilities and elements (stage 2);
- crossbows and higher bandit gear tiers (stages 3 and 10);
- the recruit rule (stage 6).

## 3. Requirements

| ID | Requirement | Reference |
| --- | --- | --- |
| S1-R1 | Every `UnitKind` has a native level. `foeAtLevel` scales from it, and today's kinds at threats 1 to 5 have exactly today's stats. | campaign R4, §5.3 |
| S1-R2 | Every encounter has a band and per-threat counts. A threat outside the band is clamped to it. Spawns and placement respect bands. | campaign R5, §5.1 (bands only) |
| S1-R3 | Bandits are built from hero rules. A bandit at level L equals a hero of the same draft and gear at level L. | campaign R6, §5.5 |
| S1-R4 | The Bandit Camp encounter, two map locations and a spawn kind as in §2. | — |
| S1-R5 | `foeYardstick` and its test exist, with today's exceptions named. | campaign §5.2 |
| S1-R6 | The simulator's `--ready-level` flag and record fields. | campaign R14 (part) |
| S1-R7 | The debug command `fight <encounter> [threat]`. | — |

## 4. What the player sees

- Two map locations, named bandits, where goblins and kobolds were.
- A Bandit Camp at threat 3 fields a Captain with a longsword, shield and breastplate, a Brute with an axe, an Archer and a Cutthroat. Its hedge-mage casts from threat 4.
- Bandits fight by the same policy as other foes. They focus the most hurtable hero, flank, and the mage shields itself.
- Victory pays 100 × level per bandit, an even foe's worth.

## 5. Technical notes

- **`combat.ts`:** `foeAtLevel(base, level, native = 1)`.
- **`encounters.ts`:**
  - `FOE_NATIVE_LEVEL`, `ENCOUNTER_BANDS` and per-encounter `counts`;
  - `encounter()` levels each foe to the clamped threat with its own native level;
  - `MAX_THREAT` is kept as the early cap for `threatAt` until stage 9;
  - `UnitKind` gains the five bandit kinds.
- **`bandits.ts`:** `banditStats(role, level, tier)`, built from a `Character` via `levelUp` and `autoAdvance`, equipped, then `deriveCombatStats`. The result is cached per (role, level, tier).
- **`blight.ts`:** `SPAWN_KINDS` gains a band check.
- **`worldMap.ts`:** the two renamed locations.
- **`BattleScene`:** sprites for the bandit kinds via `UnitKind`.
- **`debugCommands.ts`:** `fight`.
- **Versions:**
  - `SAVE_VERSION` is bumped, because location encounters change and an old save's renamed locations would be stale.
  - `LOG_SCHEMA_VERSION` is unchanged; `battle_start` meta is unchanged.

## 6. Verification

**Tests:**
- `combat.test.ts`: `foeAtLevel` with native 1 equals today's; with native N, the hit-point rule holds.
- `encounters.test.ts`:
  - bands and counts;
  - clamping;
  - Bandit Camp at threats 3, 4 and 5 (roles and order);
  - `xpReward`.
- `bandits.test.ts`: equality with a hero of the same draft and gear (S1-A3); determinism.
- `blight.test.ts`: spawn kinds only within band, over many seeds.
- `worldMap.test.ts`: the new names and encounters; every fixed nest's band holds its threat.
- `debugCommands.test.ts`: `fight` starts the battle and refuses unknown ids.
- A yardstick test over today's kinds.
- `scripts/simulate.test.ts`: `--ready-level` parsing; record fields.

**Simulator:**
1. `make simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"` stays near the early-game figure. Record the Bandit Camp's win rates by threat.
2. Single cells: `--encounter bandit_camp --threat T --party-level T`, for T from 3 to 5. A party of the threat's level should win most battles but not all. If bandits are trivial or a wall, tune counts first, then the gear tier.

**Play script:**
1. Start a new game with the ready-made party. In the debug console run `xp 2000 all`, then `fight bandit_camp 3`. See four bandits with the right sprites and weapons in the hover info. Win, and see the XP.
2. Run `fight bandit_camp 5`. See the Hedge-Mage cast Shield and Magic Arrow, the Captain hold the line, and the Archer stay back.
3. Play normally to the Bandit Camp location. Attack, win, and see the location cleared and the blight cleansed as for any nest.
4. Run `days 300` and `locations all`. Any spawned Bandit Gang stands at threat 3 or more.

## 7. Risks

- **Bandits as even foes may be much harder than goblins of the same threat,** because they have hero-level hit points and perks. Their counts and grade are the levers; stage 1 sets the counts.
- **The `fight` command must not leave the world inconsistent:** no location cleared, no blight cleansed. Its test checks both.

**Done when:** all tests pass, simulator check 1 is within the guard and check 2 is reasonable, the play script has been walked, and CLAUDE.md's rules of scaling describe native levels, bands and bandits.
