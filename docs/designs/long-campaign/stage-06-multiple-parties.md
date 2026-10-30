# Stage 6: Multiple parties

Part of [the long campaign](index.md). Reference: [`reference/multiple-parties.md`](reference/multiple-parties.md), all of it except road guards (§R10, which waits for stage 8).

## 1. Purpose and status

The company grows past one party. The guild hall's levels 4 and 5 allow a second and a third party. Recruits stay green, at the hall's level. The world map gets a party bar, orders for every party, and interrupts that focus on the party concerned.

Parties can meet to exchange heroes and gear, and can garrison a site. A wiped party no longer ends the game while other heroes live.

On today's map this already gives the XCOM dynamic: a vanguard pushing to threat 5, and green heroes training on the home rings.

**Status:** ready for planning. Two defaults are worth confirming in play before stage 7: one clock (company §8.1) and no auto-resolve (§8.3).

## 2. Scope

**In:**
- **The guild hall.**
  - Levels 4 and 5 (company §4.1), with `GUILD_HALL_LEVELS` gaining `parties` and `company`.
  - `recruitLevel` is the hall's level.
  - Forming, renaming, disbanding and moving heroes at the guild hall, between the parties at home and the reserves.
- **Orders:** home, camp, garrison and meet, besides travel and idle. Each party acts in list order.
- **Interrupts** for every party:
  - arriving at monsters;
  - an order done;
  - the notable events measured from each party.

  `advance` refuses while any party is confronting.
- **Exchange:** members and baggage between two parties on the same hex.
- **Wipes.** The party is removed and its baggage is left as the location's loot. The game is lost only when the encampment falls or no hero is left.
- **Encampment actions** act for the party at home (company §4.4).
- **Scenes.**
  - The party bar, banners on the map, and order buttons.
  - Interrupts focus and centre the party concerned.
  - The Guild Hall's columns.
  - Exchange from the character panel.
  - BattleScene takes the expedition.
  - Banner sprites in three colours.
- **The simulator.**
  - The vanguard and home-guard roles, and a third party as a second guard (company §5.4).
  - The guard's targets cover reinforcement by meeting, defence, training within the threat 5 rings, and garrisoning.
  - `--parties N`.
  - The record gains per-role battles, wipes, levels, `promotions`, `vanguardWalkHomeDays` and `guardBattles`.
  - `fallen` now means that no hero is left.

**Out:**
- road guards (stage 8);
- auto-resolve (deferred);
- experience from garrison duty (deferred).

## 3. Requirements

Company R2, R3, R5 to R7, R9, R11 to R14, as specified, on today's map.

| ID | Requirement | Reference |
| --- | --- | --- |
| S6-R1 | Hall levels 4 and 5, and forming and managing parties at home. | company R2, R3 |
| S6-R2 | All orders, interrupts with focus, and confrontation blocking for every party. | company R5–R7 |
| S6-R3 | Meeting and exchange on a shared hex. | company R9 |
| S6-R4 | Wipes and the new loss condition. | company R11 |
| S6-R5 | Recruits at the hall's level. | company R12 |
| S6-R6 | The party bar and the multi-party UI. | company R13 |
| S6-R7 | The simulator's company policy and record. | company R14 |

## 4. What the player sees

- At the guild hall, at level 4, a **Form party** button. The player names it "Second Company" and moves two veterans and three level-4 recruits into it.
- On the world map, two banners. The player selects the Second Company and clicks a kobold nest near home, then selects the First Company and sends it east. Pressing Until something happens moves both.
- **An interrupt:** "Second Company: arrived at Kobold Scouts." The map centres on it, and the player fights. Then "First Company: Goblin Marauders sighted."
- **Promotion.** The First Company loses a hero. The player selects the Second Company and clicks the First's banner to meet it. On arrival, the player exchanges the best recruit and a spare Fine shield.

## 5. Technical notes

- `company.ts` gains `formParty`, `disband`, `moveHero` and `exchange`.
- `isNotable` measures `sighted` from the nearest presence.
- **Versions:**
  - `SAVE_VERSION` is bumped (the new hall fields, party names and orders, if not already saved in stage 5).
  - `LOG_SCHEMA_VERSION` is bumped for `battle_start` meta `party` and `role`.

## 6. Verification

**Tests:** company A2 to A7, A9 to A11 (reference §7.1), except A8.

**Simulator:**
1. The early-game guard. Hall level 4 should rarely be reached by level 7, so the figure barely moves. Record how often it is.
2. A run with `--ready-level 10` (this stage's stand-in for a longer campaign on today's map), compared with `--parties 1`. The company should show promotions, guard battles and fewer vanguard walking days.

**Play script:**
1. Run `facility guild_hall 4`, `stock gold 500` and recruit three heroes, who join at level 4. Form a Second Company with them and one veteran.
2. Send both parties out. Use Until something happens and see interrupts focus each party in turn. Try to advance while one party is confronting monsters, and see it refused.
3. Garrison the Second Company on a threatened site. Use `days 30` and see that the site does not fall.
4. Let the First Company take a death (or use the debug console to drop a hero's HP and fight). Send the Second Company to meet it, and exchange a hero and an item.
5. Lose the Second Company in a hard fight on purpose (`fight troll_lair 5` with green heroes). See its baggage listed as the location's loot, and the game going on.
6. Save and reload with two parties in the field and one confronting.

## 7. Risks

- **Player time in battles.** Note in the stage's implementation notes how it feels, to settle auto-resolve.
- **The guard's simulator policy is new.** If it plays poorly, the company's value is understated. Check its choices on fixed states in tests.

**Done when:** all tests pass, the guard holds, the company comparison shows its value, and the play script has been walked.
