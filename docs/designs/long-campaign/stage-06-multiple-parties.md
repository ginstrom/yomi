# Stage 6: Multiple parties

Part of [the long campaign](index.md). Reference: [`reference/multiple-parties.md`](reference/multiple-parties.md), all of it except road guards (§R10, which waits for stage 8).

## 1. Purpose and status

The company grows past one party. The guild hall's levels 4 and 5 allow a second and a third party. Recruits stay green, at the hall's level. The world map gets a party bar, orders for every party, and interrupts that focus on the party concerned.

Parties can meet to exchange heroes and gear, and can garrison a site. A wiped party no longer ends the game while other heroes live.

On today's map this already gives the XCOM dynamic: a vanguard pushing to threat 5, and green heroes training on the home rings.

**Status:** done (see [Implementation notes](#implementation-notes)). Two defaults are worth confirming in play before stage 7: one clock (company §8.1) and no auto-resolve (§8.3).

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

## Implementation notes

Built as eleven steps (`docs/implementation-plans/long-campaign-stage-06/`).

**The figures** (500 campaigns from seed 1 each):

| Run | Source beaten | Days | Battles | Guard battles | Promotions | Vanguard walking home | Hall at 4+ (5) | Heroes dead in won battles |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The guard, `--parties 1`, ready level 7 | 230 | 270 | 18.2 | 0 | 0 | 56.0 days | 0 (0) | 1.8 |
| The company of three, ready level 7 | 239 | 274 | 18.6 | 0.2 | 0.0 | 57.6 days | 16 (0) | 1.8 |
| One party, ready level 10 | 389 | 422 | 34.4 | 0 | 0 | 64.7 days | 0 (0) | 1.7 |
| The company of three, ready level 10 | 389 | 466 | 39.5 | 4.9 | 0.0 | 91.7 days | 318 (5) | 1.9 |

- *The early-game guard* is 230 of 500, every line of its summary as step 01 measured before the stage (270 days, 18.2 battles, 1.8 heroes dead); only the log's hash moved, with schema 24's meta.
- *Check 1:* the default company reaches hall level 4 by the ready level of 7 in 16 campaigns of 500, so the figure barely moves (239).
- *Check 2* is not met: the company shows guard battles (4.9 a campaign) but no promotions and more vanguard walking days than one party, and the same Source share. On today's map, capped at threat 5, **the vanguard is self-sufficient**: it is never short once the hall has filled it, and the guards' recruits stay three levels or more below it, so even the swap promotion (decision 16 as amended) fires about 0.1 times a campaign (100 campaigns at ready level 10: 78 against 78, 0.1 promotions, 93.9 against 64.5 walking days). The extra walking comes with the company's errands at the hall, which it raises to 4 (in 318 campaigns of 500) and where it forms and refills guards. The user kept the guard policy (2026-11-09) and asked for this to be **revisited in stage 9**, when the outer rings make the vanguard's losses and a trained reserve matter.
- *The walk home to form a guard.* Step 10 had added a rule (`guardWanted` in `hallErrand`) sending the vanguard home to form a guard. Measured off at ready level 10: the same 389 wins, 91.7 walking days against 95.0 and 466 days against 473 (ready level 7: 239 against 240, 57.6 against 57.9 days). It did not help, so it was dropped; a guard now forms whenever the vanguard is home for another errand. The table's company rows are without it.

**Decisions that differ from the design** (the plan index's 1 to 18, in brief): `--parties` defaults to 3 and the guard runs with 1; the simulated company raises the hall only as far as its parties use (`HALL_FOR_PARTIES` 3, 4, 5); the company is capped by `companyLimit` (7, 8, 9, 14, 18) as well as the reserves' 4; ids `party_1` to `party_3`, default names First to Third Company, the map saying "Your party" while there is one; home, garrison (held resources only) and meet orders, a meet re-planned daily; a travel order to a nest another party holds is refused, and of two reaching one on a day the second stops a hex short; a wiped party's gear and baggage lie at the location (lost after a debug fight), and the last party wiped with reserves left is re-formed at the encampment; Exchange is an overlay of its own, from the footer and the character panel; the encampment acts for the selected party at home, else the first; banners crimson, azure and green, only the selected party's walk animated; interrupts and refusals name the party and focus it; `campDays` counts a day once; saves 22 (from 18 migrating; 20 and 21 unreadable); log schema 24 (`battle_start` meta `party` and `role`); the guard policy reinforce, defend, train, garrison, home, with the swap promotion; debug `hp`.

**Hazards deferred** (with the plan's reasons): `placeKey` without the party; the company's single rune pouch; `{leader}` the first party's; other parties' walks not animated; a reload during a walk losing that turn's story moment; the amber route under the party strip at 840 wide; auto-resolve and garrison experience.

**The play script, walked headless** (Playwright through the in-browser driver against the dev server, with the debug console, the screenshots kept out of the repository):
1. `facility guild_hall 4` and `stock gold 500`; at the guild hall Garrick hired from the pre-rolls and two heroes made through Create new: all three joined the reserves at level 4. Form party made the Second Company from a recruit; the other two and one veteran (Delwyn) were moved in by its heading: First Company Aldric and Brenna, Second Company Garrick, Mira, Tobin and Delwyn.
2. With the First Company sent east from 20,20 and the Second from home, the interrupts came in turn, each selecting its party: "First Company: Your journey stops. You sight a Bandit Camp (threat 3).", "First Company: You sight a Goblin Brood (threat 3)." (cutting the Second's walk short), "First Company, after 3 days: arrived.", "Second Company, after 6 days: arrived." With the First Company before the Goblin Raiders, Next day with the Second selected was refused ("First Company stands before the Goblin Raiders: scout, wait or attack.") and the map selected the First.
3. The Second Company garrisoned Gold Seam ("Garrisoning Gold Seam"); after `days 30` it was still held and the order stood. No held site came under threat in 120 days of play near home, so the garrison was not seen holding a *threatened* site; the rule it rests on (a party's hex is neutral) is the blight's and is tested there.
4. With Aldric at 1 hit point (`hp 1 Aldric @first`) the First Company attacked the Goblin Raiders and won in 3 rounds; Aldric fell ("Aldric fell and will not rise again"). The Second Company, given a meet by a click on the First's hex, met it four days later ("Second Company: met First Company."). In the Exchange screen, moving the First's last hero was refused ("First Company cannot be left empty."), Garrick moved to the First Company, and the Ring of Protection passed to the Second's baggage.
5. `goto troll_lair @second` and Attack: the Second Company was lost in 12 rounds; the defeat screen said "The Second Company has fallen. Its baggage lies at the Troll Lair.", OK returned to the map with the First Company selected and the game going on, and the lair's `loot` held the Second's gear and baggage (its three heroes' kit and the Ring of Protection) beside its own Hawkeye Bow.
6. With the Second Company garrisoning Gold Seam and the First before the Kobold Scouts, a reload and Continue put both where they stood, with the garrison order and the confrontation.

Seen on the way: a click on the map for a party while another party confronts monsters gives it a travel order silently (no message, the party list still showing "Idle", and nothing saved until the next save), where Next day says why and focuses the confronting party. Fixed after the step (at the coordinator's request): a map click, and Return home, now refuse as Next day does, giving no order, with `advanceRefusal`'s reason and the blocking party selected and centred.

**Player time** (design §7). The walk asked for only two battles, a 3-round win and a deliberate 12-round loss, and it was walked by a script, so it says nothing about how a second party's battles feel to play. The simulator's company fights about 5 guard battles a campaign beside the vanguard's 35 at ready level 10, so the extra battles are few on today's map. Auto-resolve stays deferred; decide after a human plays with two or three parties out.
