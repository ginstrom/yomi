# Stage 2: Special attacks and elements

Part of [the long campaign](index.md). Reference:
- [`reference/campaign-to-level-20.md`](reference/campaign-to-level-20.md) §4.2, §4.4 and §5.4;
- [`reference/gear-and-runes.md`](reference/gear-and-runes.md) §4.6 and §5.3 (elements and wards only).

## 1. Purpose and status

Monsters learn to fight in new ways:
- **Strike routines:** several weapon strikes as one action.
- **Area attacks:** cones, lines and bursts, which recharge rather than cost mana.
- **Monster-only spells.**
- **Elements.** Spells, area attacks and status ticks gain an element, and monsters can carry wards against them.

Two new nests on today's map show all of this in play.

Hero wards and weapon on-hit damage come with runes (stage 4). This stage builds the battle rules they need.

**Status:** implemented; see the [implementation notes](#implementation-notes). The guard is 249 of 500 (243 at the stage's start). The play script was walked in headless Chromium, but for retargeting, which was not seen.

## 2. Scope

**In:**
- **Abilities.** `src/combat/abilities.ts` (campaign §5.4): `Ability`, `Strike`, `AreaShape`, `ABILITIES`, `CombatantStats.abilities`.
- **Shapes.** `areaOf(shape, origin, aim, range, radius)` in `hex.ts`, and `areaTouches` shared by spells and abilities. `Spell` gains `shape` (default burst).
- **The engine:**
  - the `ability` action;
  - a routine emits per-strike `AttackEvent`s with `strike` and `ability`;
  - an area emits an `AbilityEvent`, and `CastOutcome.half` is added;
  - `recharging` on units and snapshots, counting down at the start of the unit's side's turn after ticks and regeneration;
  - half on a miss.
- **Monster spells.** `MONSTER_SPELL_IDS` (Lightning Bolt, Drain Life, Curse, Web, Dark Shield) and the statuses Cursed and Webbed. Monster spells never reach the hero spell tree.
- **Elements and wards:**
  - `Element`, `ELEMENTS`, `element` on spells, status rules and area abilities, `CombatantStats.wards`;
  - `warded()` applied to cast outcomes, area outcomes and status ticks;
  - `CastOutcome.warded` and `StatusTickEvent.warded`.

  The elements of today's spells and statuses are as in gear §4.6. Weapon `onHit` and hero wards wait for stage 4.
- **The policy.** The `aggressive` policy scores routines by summed expected harm, areas by expected harm to foes minus harm to allies (wards included), and monster spells by expected harm. It respects recharge.
- **The scene:**
  - the routine plays as successive strikes;
  - the `AbilityEvent` reuses the spell effect path, with the touched hexes drawn;
  - schedule and sound entries;
  - log lines ("breathes fire", "warded 4");
  - a foe's tooltip lists its abilities, their recharge, and its wards. (Extended after the stage, the user's decision of 2026-11-01: the panel is headed with the foe's name and describes each ability under it, from its data: shape and reach, dice and element, half on a miss, the status and its effect, a routine's strikes.)
- **Two new kinds and nests on today's map**, inside the threat 4 and 5 rings:

  | Kind | Native | Block (first values) | Special |
  | --- | --- | --- | --- |
  | Giant Spider | 4 | HP 20, AC 25, to hit 80, 1d6+2 bite, resistance 1 | Routine: Bite (1d6+2), Bite (lays Poisoned). The Web spell at range 4, recharge 3. |
  | Salamander | 5 | HP 26, AC 30, to hit 85, 1d8+2 claws, resistance 2, fire ward 99 | Fire Spit: cone 2, 3d6 fire, half on a miss, lays Seared, recharge 2 |

  The encounters are:
  - **Spider Nest:** band 4–5, Giant Spider, Kobold Sneak and Giant Spider.
  - **Salamander Pool:** band 5, Salamander with Kobolds.

  They replace the Troll Den (54, 28) and the Goblin Pillagers (57, 10). Both get `FOE_XP` set by the yardstick, and sprites.
- **Existing kinds.** The Troll swaps its two-claw action points for a routine: Claw, Claw as one 4-AP action, with the same expected damage. Nothing else changes.

**Out:**
- weapon on-hit damage and hero wards (stage 4);
- the high roster (stage 11);
- reach weapons (stage 3).

## 3. Requirements

| ID | Requirement | Reference |
| --- | --- | --- |
| S2-R1 | Strike routines, with retargeting when a target falls. | campaign R8, §4.4, §5.4 |
| S2-R2 | Area attacks in cone, line and burst, with recharge and half on a miss. They ignore resistance. | campaign R9, §5.4 |
| S2-R3 | Monster spells, never learnable by heroes. | campaign R10 |
| S2-R4 | Elements on spells, statuses and areas; monster wards; `warded` in the log. | gear R12 (all but on-hit) |
| S2-R5 | The policy uses routines, areas and monster spells by expected harm, sparing its own side. | campaign R11 |
| S2-R6 | The scene shows routines, areas (hexes and outcomes) and abilities in tooltips. | campaign R12 |
| S2-R7 | The Giant Spider and the Salamander, with their nests, map places and sprites. The Troll's routine. | — |

## 4. What the player sees

- **A Salamander** turns toward the front rank and spits a cone of fire. The cone's hexes flash, and every unit in it, its own kobolds included, takes fire damage. A miss still burns for half. The trolls next door have a reason to fear it, and so does the party: Seared stops nothing on a hero, but the damage is real. Its fire ward makes Flame Arrow and Fireball useless against it.
- **Giant Spiders** web the party's archer from range, which takes 4 AP from it for 2 turns, then close and bite twice, the second bite poisoning.
- **Hovering a foe** lists its abilities, with "ready" or "recharging, 2 rounds", and its wards. (As built: headed with its name; "ready", "ready next turn" or "ready in 2 turns", counted in the foe's turns; and under each ability what it does, as "cone 2: 3d6 fire, half on a miss".)

## 5. Technical notes

- **Data stays plain:** abilities by id, as spells are. `sameCombatStats` compares `abilities` and `wards`. `foeAtLevel` adds its damage step to ability damage.
- **`legalActions`** lists abilities when AP and recharge allow. Area aims are the hexes from which the area touches at least one unit.
- **Versions:**
  - `LOG_SCHEMA_VERSION` is bumped (AbilityEvent, `strike`, `half`, `warded`).
  - `SAVE_VERSION` is bumped (the snapshot's `recharging`, and the replaced locations).

## 6. Verification

**Tests:**
- `hex.test.ts`: the cone, line and burst on small boards, for each of the 6 directions.
- `battleEngine.test.ts`:
  - routine strikes and retargeting;
  - area outcomes, half on a miss, resistance ignored, wards applied;
  - recharge countdown and blocking;
  - monster spells (Drain Life heals the caster, Web lays Webbed);
  - ticks warded;
  - snapshot round-trip;
  - schema version.
- `policies.test.ts`:
  - breath only when net harm is positive;
  - a routine preferred over a single strike;
  - recharge respected;
  - a warded target scored lower.
- `spells.test.ts` and `perks.test.ts`: the hero spell tree never lists monster spells.
- Scene tests: the AbilityEvent effect, schedule and sound; log text; tooltip lines.

**Simulator:**
1. The early-game guard.
2. `--encounter spider_nest --threat 4 --party-level 4` and `--encounter salamander_pool --threat 5 --party-level 5`: hard but winnable. Tune recharge and damage first.
3. `--encounter troll_lair --threat 4 --party-level 4`: unchanged within noise, after the routine change.

**Play script:**
1. Run `fight salamander_pool 5` with the party levelled (`xp`). Bunch the party and watch the spit hit several units and burn one kobold. Spread out and watch the policy aim for the most heroes. Cast Flame Arrow at it, and see "warded" in the log.
2. Run `fight spider_nest 4`. See Web land on a hero from range, and the hero's AP shrink next turn. See a bite routine strike twice, then retarget when the first target drops.
3. Fight a Troll Lair. See Claw, Claw as one action in the log.
4. Save mid-battle and reload. A recharging ability is still recharging.

## 7. Risks

- **A cone aimed by the policy can still hurt its own side.** That is intended, but check the policy's ally penalty in play.
- **Half on a miss makes breath reliable.** Keep the recharge at 2 or more.

**Done when:** all tests pass, the guard holds, the two nests are hard but fair at their threats, and the play script has been walked.

## Implementation notes

Built from the plan in [`docs/implementation-plans/long-campaign-stage-02/`](../../implementation-plans/long-campaign-stage-02/index.md), on branch `armor-resistance`.

**Commits:**
- Step 01, the baseline: `0804545`.
- Step 02, area shapes: `1465f7a`.
- Step 03, elements, wards and monster spells: `405f8d5`.
- Step 04, routines, recharge and the Troll's claws: `b104227`.
- Step 05, area abilities, Web and Fire Spit: `09b679a`.
- Step 06, the battle screen and the foe info panel: `b523a7f`, `3b70c70`.
- Step 07, the Giant Spider and Salamander sprites: `0daf6bf`.
- Step 08, the kinds, the nests and the map: `8b5cf18`.
- Step 09, measure, tune and document: the commits titled "Stage 2 step 09" (`0a2dbbc` and those after it).

**Departures from this design** (the plan's corrections, in brief):
1. The Troll's routine `troll_claws` costs 8 AP, not 4, so that each turn's expected damage is today's (two 4-AP claws standing still, one after a move).
2. Both replaced places lie at threat 5 on today's map (`threatAt`): the Troll Den became the Salamander Pool, the Goblin Pillagers the Spider Nest. The Spider Nest's threat 4 is fought only in the simulator or with `fight spider_nest 4`.
3. The spider's Web is an area ability, `spider_web` (burst 1 at range 4, recharge 3). The Web spell exists for monster casters; no kind casts it.
4. There was no foe tooltip, so a small hover panel was added (`foeInfo.ts`).
5. `foeAtLevel` raises ability damage through `abilityDamageBonus`.
6. `AreaShape` lives in `hex.ts`, beside `areaOf`.
7. A strike that is not made emits nothing (reference §5.4).
8. Names the design left open: `verb` on abilities and strikes, `CastEvent.drained`, `warded` as the points stopped, `AbilityEvent.distance`.
9. An area's aims must touch a standing foe.
10. Recharge N sets a counter that falls as the unit's side's turn begins: recharge 1 is once a turn, 2 every other turn.
11. The open numbers were first values, checked here.
12. The new nests do not spawn.
13. The hero spells' policy was left unchanged, then changed by the user's decision (below): a damaging area spell no longer counts a foe fully warded against it.
14. A status is laid whatever a ward stops.
15. `LOG_SCHEMA_VERSION` went 18 → 21 and `SAVE_VERSION` 13 → 15, a bump per step that changed a shape.
16. The yardstick test counts routines.
- Also, from step 08: the second spider is the **Brood Spider** and the pool's Kobolds the **Kobold Stoker** and the **Kobold Warden**, as every foe in a battle needs a name of its own.
- And from step 09: Drain Life heals from the hit points its targets lost, not from damage past what a target had left (no kind casts it yet).

**The early-game guard** (`make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`):

| | Step 01 (baseline) | Step 04 (Troll routine) | Step 08 and step 09 (no tuning) |
| --- | --- | --- | --- |
| Beat the Source | 243 (48.6%) | 242 | 248 (49.6%) |
| Party fell | 257 | — | 252 |
| Days, battles a campaign | 281, 19.0 | — | 274, 18.7 |
| Heroes dead a campaign | 1.8 | — | 1.7 |
| Won at threat 5 | 1361 of 1523 (89.4%) | — | 1411 of 1568 (90.0%) |

At step 09, battles won by threat: 1010 of 1010, 1770 of 1788, 1963 of 2017, 2924 of 2947, 1411 of 1568. Lowest and highest level at the end 6.8 and 7.3. Area attacks: 0.03 a battle by the enemy.

The move is +5, at the edge of "about 5", and comes from the replaced places. Losses by place, step 01 against step 09 (the baseline re-run from `0804545` for this breakdown, again 243):
- the Troll Den (a Troll Lair at threat 5): 32 lost in 100 fights; the Salamander Pool in its place: 0 in 100;
- the Goblin Pillagers: 0 in 69; the Spider Nest in its place: 0 in 67;
- so 405 parties reach the Source rather than 373, and it is won 248 times rather than 243 (61% against 65% of the parties that reach it);
- everything else as it was (the fixed Bandit Camp 54 lost, the Troll Lairs 20, the Goblin Reavers 18).

It is explained in CLAUDE.md's rules of scaling, not retuned away: making the Salamander Pool lose campaigns would mean pushing its own cell below the bandits'.

**The cells** (`--encounter E --threat T --party-level T --battles 500 --seed 1`; wins of 500, average rounds, the enemy's damage dealt and area attacks a battle):

| Cell | Wins | Rounds | Enemy damage | Enemy area attacks |
| --- | --- | --- | --- | --- |
| Spider Nest, threat 4 | 500 (100%) | 3.7 | 16.2 | 1.0 |
| Spider Nest, threat 5 | 451 (90.2%) | 6.9 | 60.4 | 3.0 |
| Salamander Pool, threat 5 | 470 (94%) | 8.4 | 69.6 | 3.5 |
| Troll Lair, threat 4 | 222 (step 01: 218) | 15.6 | 102.3 | 0 |
| Troll Lair, threat 5 | 0 (step 01: 0) | 7.5 | 146.7 | 0 |
| Goblin Raid, threat 5 | 357 (71.4%) | 13.1 | 101.3 | 0 |
| Bandit Camp, threat 5 | 470 (94%) | 8.4 | 65.1 | 0 |

Also: the Spider Nest at threat 4 with a party of level 3 won 499 of 500.

**Tuning: none kept.** The two cells fought on the map, the Spider Nest and the Salamander Pool at threat 5, are won 451 and 470 times in 500, which is where CLAUDE.md puts a fair cell (the bandits' 444 to 473 for a party of the threat's level). The Spider Nest at threat 4 (a Giant Spider and a Kobold Sneak) is trivial at 500 of 500, but it is fought nowhere on today's map. The levers tried for it, in the design's order, each measured at threats 4 and 5:

| Change | Threat 4 | Threat 5 |
| --- | --- | --- |
| None | 500 | 451 |
| `spider_web` recharge 3 → 2 | 500 | 437 |
| Spider bites 1d6+2 → 1d8+2 | 500 | 423 |
| Spider counts [2, 3] → [3, 3] | 479 (95.8%); 439 with a party of level 3 | unchanged |
| Giant Spider hit points 20 → 26 | 500 | 377 |
| Giant Spider hit points 20 → 32 | 500 | 269 |

Damage, recharge and hit points do not move a two-foe fight that lasts under 4 rounds; they only make threat 5 harder. Only a third foe at threat 4 does, but then the nest would field as many foes at the bottom of its band as at the top, which the encounter tests forbid (every band grows). So threat 4 was left as it is. Whether to make the Spider Nest a threat-5-only nest, like the Salamander Pool, or to accept three foes at both threats is for the user.

**Checked in the simulator:**
- The Salamander's spit never caught its own Kobolds: 0 of 1762 spits in the pool's cell, 0 of 133 in the guard. The net-harm rule spares its side. In the cell, 1676 spits touched one hero and 86 touched two; in the guard, 33 touched one, 97 two and 3 three.
- The Spider Nest at threat 5: 1510 webs, 947 of them webbing a hero; 5830 bite strikes.
- **Heroes' mages against the Salamander.** `strikeCast` ranks by the warded damage, so the mage casts Magic Arrow at the Salamander rather than Flame Arrow (Flame Arrow at it: never in the cell). But the heroes' Fireball counts the Salamander as one of its two foes: 1484 Fireballs touched it in the pool's cell, and in 475 of them the only hits were on the Salamander, for 0. The fix (count only foes the spell can hurt) is cheap, but it changes the pool's battles and goes against correction 13, so it was recorded, not made.
- **Retargeting.** In 416 routines whose first strike felled its target (spider and Troll cells), no other foe was in reach, so the second strike was not made; a retargeted strike was never seen. The engine's tests cover it.

**The play script**, walked in headless Chromium through a scratch in-browser script (the e2e driver, the debug console, a save and a reload), with the log and screenshots looked at:
1. **The Salamander Pool** (`xp 2000 all`, then `goto salamander_pool` and Attack, so that the battle is saved). Hovering the Salamander showed "Fire Spit: ready" and "Wards: fire 99", then "Fire Spit: recharging, 2 rounds" and "…, 1 round" turn by turn. With the party standing in its starting column, the spit touched two heroes every time it was used ("Salamander spits fire: HITS Aldric for 11 dmg, seared; HITS Delwyn for 11 dmg, seared."; "MISSES Delwyn, 3 dmg (half)"; a fumble still did half). On screen the cone's four hexes flashed orange with fire marks and the heroes in it pulsed red. It is one flash rather than a sweep, but it reads clearly, so it was left. A Flame Arrow at it: "HITS Salamander for 0 dmg (warded 11), seared." The spit did not catch a Kobold, as the Kobolds stood beside it and not in its cone. Not walked: spreading the party out to watch where the spit aims (the heroes stood still).
2. **The Spider Nest** (`fight spider_nest 4`). On its first turn the spider webbed Aldric from range ("Giant Spider spins a web: Aldric is webbed."), and Aldric began his next turn with 4 AP. The bite routine struck twice, each logged "Giant Spider bites Aldric", the second laying Poisoned. The panel showed "Bite: ready" and "Web: recharging, 3 rounds". A Bite with recharge 1 shows "recharging, 1 round" on the player's turn though it is ready on the spider's next. Not seen: a retarget, as each kill came on the second bite.
3. **The Troll Lair** (`fight troll_lair 4`). Standing still, the Troll's two claws came as one action ("Troll claws Aldric: …" twice in a row); after a move it struck once.
4. **Save and reload.** At the pool, after the spit, the battle saved as the player's turn began. A reload and Continue brought back the battle with `fire_spit` still recharging (2), and the panel said so.
No console errors were logged. The user may want to walk step 1's spreading out, and to see a retarget, by hand.

**After verification** (the user's decisions of 2026-11-01, and the fixes QA and the overall review asked for):
- **The Spider Nest is fought at threat 5 only** (band 5 to 5, count 3, the same three foes as before at 5). Its threat-5 cell is unchanged at 451 of 500, and the old threat-4 cell is gone: `--threat 4` is now fought as 5, and a party of level 4 wins it 362 times in 500.
- **The heroes' Fireball no longer counts a foe fully warded against it** toward its two foes; a partly warded foe still counts while the average damage gets through. This overrides correction 13.
  - The Salamander Pool cell went from 470 to 493 of 500 (8.4 rounds to 6.9). The move is not small. Before, the mage spent 10 mana a time on Fireballs that touched the Salamander and one Kobold (1484 in 500 battles, 475 hurting nothing but the Kobold, which they missed). Now it throws none and casts Flame Arrow at the Kobolds (2695 in 500 battles), so they fall fast and the Salamander is left alone. At 98.6% the cell is above the 60 to 95% target. It was not retuned, which is for the user to decide.
  - The guard went from 248 to 249 of 500 (274 days, 18.7 battles, 1.7 heroes dead; threat 5 won 1417 of 1573).
- **The foe panel** now has the foe's name as its title. It counts recharge in the foe's own turns ("ready next turn", "ready in N turns"), as the old "recharging, 1 round" read one too high on the player's turn. Under each ability, worked out from its data and `STATUSES`, it describes what the ability does, with the foe's level-scaled dice (`abilityDamageBonus`):
  - "claw 1d4+2, claw 1d4+2";
  - "bite 1d6+2, venom bite 1d6+2" and "venom bite: poisoned 3 turns (1d6 poison a turn)";
  - "burst 1, range 4: webbed 2 turns (−4 AP)";
  - "cone 2: 3d6 fire, half on a miss" and "seared 1 turn (no regeneration)".
  
  Its text is drawn at its own size however far the board is scaled. It was checked by eye at 840×560 and at 1280×800, and the manual's `battle-salamander` screenshot was retaken.
- **The log** now puts a critical and a ward in one bracket: "HITS X for N dmg (CRITICAL, warded M)".
- **"MISSES Brenna" while she was webbed** was not a bug. A web logs "is webbed" on every hit, a unit already webbed included (now pinned by a test), and in 1510 simulated webs every hit laid Webbed and every miss laid nothing. Webbed lasts 2 of the hero's own turns, so a web from an earlier round leaves her webbed in a round whose webs miss.
- **The manual:** some special attacks recharge (the Troll's Claws do not), and a web can catch everyone in its area, rolling for each.
