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

## Implementation notes

Built from the plan in [`docs/implementation-plans/long-campaign-stage-01/`](../../implementation-plans/long-campaign-stage-01/index.md), on branch `armor-resistance`.

**Commits:**
- Step 01, native levels, bands and the yardstick: `ea3ed40`, review `ddc4bb8`.
- Step 02, bandit sprites: `e6362d5`.
- Step 03, bandits and the Bandit Camp: `8c76d91`.
- Step 04, bandits on the map: `7ff2fb9`.
- Step 05, the debug `fight` command: `c39b8ec`, review `112793b`.
- Step 06, `--ready-level` and the level record: `5481925`.
- Step 07, measure, tune and document: the commit "Step 07: measure, tune and document" (its hash is in the plan's step 07 note).

**Departures from this design** (the plan's corrections):
1. The Bandit Hideout (once Goblin Outriders, (47, 13)) is at threat 4, not 5: that is what `threatAt` gives there.
2. The camp's slot order is Captain, Hedge-Mage (from threat 4), Brute, Archer, Cutthroat, so that the mage can take the field at threat 4.
3. Today's five encounters keep the band 1 to 5 and their counts 2, 3, 3, 3, 4, so every battle that existed before is unchanged.
4. The yardstick test checks each monster kind at its native level only (level 1 for today's kinds), with named exceptions.
5. The threat table already printed every threat that occurs.
6. Also, from step 03: the Hedge-Mage's Wand of Sparks is enchanted and takes no grade, so it stays plain at every threat.

**The bandit cells** (`make -s simulate ARGS="--encounter E --threat T --party-level T --battles 500 --seed 1"`, party wins of 500 and average rounds):

| Threat | Bandit Camp, first counts (3, 3, 4) | Bandit Camp, tuned (2, 2, 2) | Goblin Raid |
| --- | --- | --- | --- |
| 3 | 195 (39%), 12.8 rounds | 444 (88.8%), 10.0 | 500 (100%), 7.0 |
| 4 | 158 (31.6%), 12.6 | 473 (94.6%), 9.5 | 500 (100%), 8.7 |
| 5 | 3 (0.6%), 8.2 | 434 (86.8%), 10.3 | 358 (71.6%), 13.1 |

**Tuning** (the counts first, then the grade, as §6 says):
- Counts `[3, 3, 4, 4, 4]` → `[2, 2, 2, 4, 4]`: threat 3 from 39% to 88.8%, threat 4 from 31.6% to 94.6%, threat 5 from 0.6% to 86.8%. The camp now fields the Captain and the Brute at threat 3, and the Captain and the Hedge-Mage at threats 4 and 5.
- Tried and not kept: three bandits at threat 5 (Captain, Hedge-Mage, Brute) won 59 of 500 (11.8%) in Fine gear, and 173 (34.6%) with `banditGrade` plain at 5 (Fine from 6). Three bandits are a wall at every threat of today's map; the gear grade is already plain below 5, so it cannot ease threats 3 and 4, and at 5 the Fine gear is kept, as two bandits in it are in range.
- The counts at threats 6 and 7 stay 4 and 4, unmeasured, for stage 9.
- So, on today's map, the Archer and the Cutthroat never take the field: they appear only from threat 6 (`fight bandit_camp 6` shows them).

**The early-game guard** (`make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`):

| | Before the stage | Step 04, first counts | Tuned |
| --- | --- | --- | --- |
| Beat the Source | 320 (64%) | 91 (18.2%) | 237 (47.4%) |
| Party fell | 180 | 409 | 263 |
| Days, battles a campaign | 328, 22.5 | 126, 9.1 | 279, 18.9 |
| Heroes dead a campaign | 1.6 | 1.2 | 1.8 |
| Guild hall level, recruits | 2.7, 2.1 | 1.6, 1.2 | 2.4, 2.2 |

Tuned, the battles won by threat are: 1, 1011 of 1011; 2, 1780 of 1796 (99.1%); 3, 2012 of 2066 (97.4%); 4, 2981 of 3004 (99.2%); 5, 1387 of 1557 (89.1%). The party's lowest level at the end is 6.7 and its highest 7.4 on average (a fallen party's levels count, for a campaign lost in battle). Heroes died at level 2 (48), 3 (178), 4 (33), 5 (102), 6 (27), 7 (271), 8 (219), 9 (24) and 10 (1). The lowest level reached 5 in 6.8 battles (429 campaigns) and 10 in 33 (2 campaigns).

Bandit battles in the tuned guard: the fixed Bandit Camp (threat 3) won 446 of 500 (89%); the Bandit Hideout (threat 4) 261 of 262; Bandit Gangs 379 of 379 at threat 3, 808 of 810 at 4 and 347 of 348 at 5.

**The guard stays 83 campaigns below 320, outside the 5 points.** Losses, before the stage and tuned:
- the Source: 113 of 433 fights before, 139 of 376 now;
- the fixed Bandit Camp: 54 (new);
- the Goblin Reavers at threat 2: 16 (new), each a lone survivor of a camp that killed two heroes;
- the Troll Lairs at threats 4 and 5: 67 before, 50 now.

The camp and the Reavers account for 70. The rest is at the Source: bandits kill heroes even in the battles the party wins (157 at the fixed camp, 72 in threat-3 gangs, 39 at threat 4), so the guild hall, a little poorer, sends more parties of four to the Source: 99 against 62 before. A party of four almost never wins the Source's battle (3 of 99 now, 1 of 62 before), and a party of five about 5 times in 6 both before and now (234 of 277; 319 of 371). The two levers can take it no further: two bandits are already the least that still makes a fight of the camp, and their gear is plain below threat 5. Closing the gap would take a change outside this stage's levers, such as the bandits' drafts or levels, the threat-3 camp's place on the map, or the Source's battle for a party of four. That is left to the user's decision.

**The debug `fight` command:** `e2e/debug.test.ts` (`make test-browser ARGS="e2e/debug.test.ts"`, 3 of 3 passed at step 07) fights `kobold_scouts` at threat 2 from the world map and checks the risk in §7: the locations and every hex's blight are the same after the battle, the win gives experience and no loot, and the slot is not saved mid-battle.

**The play script** was not walked: the implementer had no browser session at `make dev`. Adjusted for the tuned counts, these steps remain for the user:
1. New game with the ready-made party; in the console (`~`) `xp 2000 all`, then `fight bandit_camp 3`. Expect **two** bandits, the Bandit Captain and the Bandit Brute, with their own sprites and weapons in the hover info. Win and see the experience.
2. `fight bandit_camp 5`. Expect the Captain and the Hedge-Mage, the mage casting Shield and Magic Arrow and the Captain holding the line. The Archer is not there at 5; `fight bandit_camp 6` shows it (and four bandits) if wanted.
3. Play to the Bandit Camp at (30, 22), attack and win; see the location cleared and the blight cleansed as for any nest.
4. `days 300`, then `locations all`: any Bandit Gang stands at threat 3 or more.
5. After a `fight` battle with bandits, the world map is unchanged: no location cleared, no blight cleansed (covered by the browser test above for Kobold Scouts).
