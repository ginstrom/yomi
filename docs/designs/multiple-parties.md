# Multiple parties: a company of squads

## 1. Purpose and status

The player has one party. The heroes not in it wait at the guild hall as reserves, earn nothing and do nothing. A recruit joins at the hall's level, at most 3.

That made sense for the short campaign. It does not suit the long one in [`campaign-to-level-20.md`](campaign-to-level-20.md), where three problems arise:
- **Long walks home.** A party fighting in the outer rings walks some 120 days home to replace a fallen hero, raise the hall or defend a site, while the blight keeps going.
- **Defending far land.** The land and the trade routes ([`economy-and-trade-routes.md`](economy-and-trade-routes.md)) need defending far from where the party fights.
- **Useless replacements.** A level-3 recruit cannot stand beside level-15 veterans.

This design gives the player a **company** of several parties in the field at once, as in XCOM. Typically:
- **The vanguard** is a crack squad pushing outward through the rings.
- **A second or third party** of greener heroes holds the home rings. It clears low-threat nests, answers threatened sites, guards trade roads, and brings its best heroes up to the front when the vanguard loses one.

Recruits stay green on purpose. They grow by fighting the easier battles, and the guild hall's upper levels pay for more parties, not bigger ones.

This is the "multiple parties" left to a separate design by:
- [`blight.md`](blight.md) §5.4;
- [`guild-hall-and-watchtowers.md`](guild-hall-and-watchtowers.md), its non-goals and §8.2 and §8.3.

[`blight.md`](blight.md) already sums party influence over a list, so the blight needs no new rule.

**Status: ready for planning, with assumptions.** The first two steps are pure refactors with no change in behaviour. Section 8 lists the decisions taken on the user's behalf; 8.1 (the turn model) and 8.3 (auto-resolving battles) shape the most and are worth a look before step 3.

Where this design and the code differ, the code is right.

## 2. Requirements and scope

### Functional requirements

| ID | Requirement |
| --- | --- |
| R1 | **The company.** The game holds a list of **parties**, each with its own members, baggage, position on the world map, standing **order** and confrontation. Every hero is in exactly one party or in the reserves. |
| R2 | **The guild hall's upper levels** raise the number of parties: level 4 allows a second party and level 5 a third. The party size limit stays as at level 3 (5 a party). The company's size (parties plus reserves) is capped by hall level. |
| R3 | **Forming parties.** At the guild hall, with parties at the encampment, the player forms, renames, disbands and rearranges parties and reserves. A party sets out from the encampment. |
| R4 | **One clock.** World days pass for the whole company at once. On each day, every party carries out one day of its order before the blight, territory and sight are updated. |
| R5 | **Orders.** A party's order is one of: travel to a hex (then stop), return home, camp until healed, **garrison** a held site or road hex, **meet** another party, or idle. An order runs day after day until done, replaced, or interrupted. |
| R6 | **Actions that take a day** (scouting, waiting, building, a field craft, a camp day) act for the selected party. The day passes for everyone, and the other parties keep to their orders. |
| R7 | **Interruptions.** Advancing time ("next day" or "until something happens") stops at the first notable event for any party. The world map then selects the party it concerns. Time cannot advance while any party stands confronting monsters without having answered them. |
| R8 | **The blight and sight are per party.** Each party pushes the blight from its own hex with its own strength, keeps its own hex neutral, and sees around itself. Spawns keep clear of every party. A garrisoned party therefore holds its site. |
| R9 | **Meeting.** Two parties on the same hex may exchange members and baggage. A reserve joins or leaves only at the encampment. |
| R10 | **Guarding roads.** A party standing within `GUARD_RADIUS` of a road hex guards it as a watchtower does ([`economy-and-trade-routes.md`](economy-and-trade-routes.md) §4.4). |
| R11 | **Wipes.** A party wiped out in battle is gone. Its heroes are dead, and its baggage is left at the monster location as loot. The game is lost only when the encampment falls, or when no hero remains in any party or the reserves. |
| R12 | **Experience.** Each party earns its own battles' experience, as now. Recruits join at the guild hall's level (1 to 5), not tied to any party's levels. This replaces R13 of [`campaign-to-level-20.md`](campaign-to-level-20.md). |
| R13 | **The world map** shows every party with its banner and order. A party bar selects a party, orders are given from it, and the event log names the party concerned. |
| R14 | **The simulator** plays a company: a vanguard on today's targeting, and a home guard that defends, trains on low-threat nests, and reinforces the vanguard after a death by meeting it. It records each party's battles, wipes, promotions and walking days. |

### Quality constraints

- **The early game is unchanged** until the hall reaches level 4: one party, the same results. The refactor steps (§7.3) are checked by an identical seeded simulator run.
- **The world rules stay deterministic and Phaser-free.** Parties act in a fixed order each day: by id, the vanguard first.
- **A two-party company costs the blight's daily loop** at most one more party source and sight radius.

### Non-goals

- **Parties fighting side by side in one battle,** or reinforcing mid-battle.
- **Monster locations that attack a party** (moving monsters, [`blight.md`](blight.md) §4.9).
- **Training facilities, or experience from garrison duty.** These are deferred to §8.4: the scrubs grow by fighting.
- **More than three parties.**
- **Per-party stock.** The stock stays the encampment's, shared.
- **Real-time movement.** Time is in days, as now.

### Acceptance criteria

| ID | Criterion | Requirements |
| --- | --- | --- |
| A1 | After the refactor steps, a seeded `--campaign` run gives exactly the same summary as before. | R1, R4 |
| A2 | Hall levels 4 and 5 allow 2 and 3 parties. Forming is refused away from home, over the limits, or leaving a party empty. | R2, R3 |
| A3 | `passDay` moves every party one day of its order, then runs the world's day once. Two travelling parties both advance each day. | R4, R5 |
| A4 | A selected party's one-day action passes the day for all parties. | R6 |
| A5 | Advancing stops on the first notable event of any party and names it. It refuses while a confrontation is unanswered. | R7 |
| A6 | Influence and sight sum over parties. A garrisoned site does not fall. Spawns keep clear of all parties. | R8 |
| A7 | An exchange on a shared hex moves members and items. It is refused on different hexes, and refused for reserves outside home. | R9 |
| A8 | A party near a road guards its hexes. | R10 |
| A9 | A wipe removes the party and leaves its baggage as the location's loot. The game is not lost while other heroes live, and is lost when none do. | R11 |
| A10 | Recruits join at the hall's level. | R12 |
| A11 | Scene tests cover the party bar, orders, and focus on an interrupt. | R13 |
| A12 | The simulator's long campaign records promotions and the vanguard's walking days. Those days drop compared with a single-party run. | R14 |

## 3. Current system (inspected)

- **The game state.** In [`src/game/gameState.ts`](../../src/game/gameState.ts), `GameState` has one `party: Party`, one `baggage: Item[]` and `reserves: Character[]`.
- **The world map.** In [`src/game/worldMap.ts`](../../src/game/worldMap.ts):
  - `WorldState.party` is one hex, and `WorldState.confronting` is one location id.
  - `passTurn(world, party)` advances a day: the blight, territory and sight.
  - `travel` walks a route, a `passTurn` a hex, stopping on `isNotable`.
  - `isNotable` measures `sighted` from `world.party`.
- **Camping.** In [`src/game/camp.ts`](../../src/game/camp.ts), `campUntilHealed` and `campDay` act on the single party.
- **The blight.** In [`src/game/blight.ts`](../../src/game/blight.ts):
  - `partyStrength` takes a party's levels.
  - `netAt` adds the party's reach from `world.party` and keeps its hex neutral.
  - `spawn` keeps clear of `world.party`.
  - [`vision.ts`](../../src/game/vision.ts) sees from `world.party`.
- **The guild hall.** In [`src/game/guildHall.ts`](../../src/game/guildHall.ts):
  - It has levels 1 to 3, with party limits 3, 4 and 5, and `MAX_RESERVES` is 4.
  - `recruitLevel` is `max(1, min(hall, lowest party level))`.
  - Swapping works only at home.
  - A wipe ends the game.
- **Who reads the single party.** References to it are spread through:
  - `WorldScene` (17);
  - `scripts/simulate.ts` (13);
  - `itemPlace.ts` and `guildHall.ts` (10 each);
  - `debugCommands` (8);
  - `save.ts` (7);
  - `worldMap.ts` (6);
  - `buildings.ts` (7 on `world.party`);
  - `BattleScene`, `TradingPostScene`, `CraftingScene`, `GuildHallScene`, and the story and tutorial modules.
- **The simulator.** In [`scripts/simulate.ts`](../../scripts/simulate.ts), `runCampaign` is a sequential script: walk to the next target, fight, camp, run errands. It calls `travel` and `campUntilHealed`, which pass the days inside them.

## 4. Proposed behaviour

### 4.1 The guild hall and the company

| Hall level | Cost | Parties | Party size | Company (parties + reserves) |
| --- | --- | --- | --- | --- |
| 1 | — | 1 | 3 | 7 |
| 2 | 30 gold, 15 iron | 1 | 4 | 8 |
| 3 | 60 gold, 30 iron | 1 | 5 | 9 |
| 4 | 120 gold, 40 iron, 20 stone (Barracks) | 2 | 5 | 14 |
| 5 | 200 gold, 30 silver, 20 stone | 3 | 5 | 18 |

Level 4 is priced to arrive in the middle game, about when the party leaves the threat-5 ring. That is when the walks start to hurt.

**Recruits** join at the hall's level: level 4 at hall 4 and level 5 at hall 5. So a new hero is always a scrub who needs the easy battles. The role of [`campaign-to-level-20.md`](campaign-to-level-20.md)'s recruit rule (§5.6 there) passes to the second party.

**Parties** are named "First Company", "Second Company" and "Third Company" by default, and the player may rename them. They form at the guild hall. The Guild Hall screen shows the parties at home and the reserves as columns, and a hero moves between them by clicking, as swapping does today.

### 4.2 Time and orders

The world map gains a **party bar**: one entry per party, with its banner, name, members' portraits and hit points, and its order. Clicking an entry selects that party and centres the map on it.

| Order | Given by | Each day |
| --- | --- | --- |
| Travel to a hex | clicking a hex with the party selected | One hex along its route. It stops on arrival. Arriving at monsters makes it confront them. |
| Return home | the Home button | Travel to the encampment, then idle. |
| Camp until healed | the Camp button | A camp day (`campDay`), until whole or interrupted. |
| Garrison | the Garrison button, on a held site or a road hex | Nothing. It stays, pushes the blight and guards. |
| Meet | clicking another party's banner | Travel toward that party's current hex, re-planned each day, until they share a hex. |
| Idle | when an order is done | Nothing. |

**Advancing time.** Clicking a hex with a party selected sets that party's travel order and advances time until something happens, which is what a click does today. Two buttons sit beside the bar: **Next day** and **Until something happens**. A day-long action for the selected party (scout, wait, build a tower or improvement, field craft, camp one day) runs as that party's order for one day. The day passes for everyone.

**Interrupts** are today's notable events, measured from each party, plus the new ones:
- a party arrives at monsters;
- a party finishes its order;
- a party is wounded below half while travelling (a spawn sighted near it);
- the economy design's route raids.

The first interrupt of a day stops the clock after that day. The map selects the party it concerns and the log says, for example, "Second Company: Kobold Nest sighted 5 hexes away."

**Confrontations.** A party that arrives at monsters confronts them, as the single party does now: attack, scout or wait. The clock does not run until the player has answered. Other parties' orders wait, and nothing happens off-screen.

### 4.3 Battles, deaths and promotions

**Battles.** A battle is fought by the confronting party alone, with `BattleScene` given that party. Its experience, loot and baggage are that party's.

**A wipe:**
- The party's heroes are dead, and the party is removed.
- Its baggage is added to the monster location's loot.
- If no hero remains anywhere (parties and reserves), the game is lost. Otherwise the player rebuilds from the reserves and the other parties.

**Promotion** is the XCOM dynamic. When the vanguard loses a hero far out, the second party is ordered to **meet** it. They exchange: the second party's best hero goes to the vanguard, with gear from its baggage. The second party walks home to recruit. It walks about half as far as the vanguard would, and the vanguard keeps fighting meanwhile.

**Garrisons.** A party garrisoned at a site keeps that hex neutral, by the existing rule, so the site cannot fall while it stays. The party guards nearby road hexes (R10). Garrison duty earns no experience (§8.4).

### 4.4 Edge cases

- **Two parties arrive at the same monsters on the same day.** The earlier party in the order confronts them. The other stops one hex short and idles.
- **A party ordered to meet a party that is wiped or disbanded** becomes idle, with an interrupt.
- **Encampment actions** need a party at home, so they act for the selected party if it is at home, else for the first party at home:
  - the trading post (purchases go into a baggage);
  - crafting at the workshop (items come from a party at home);
  - the guild hall (heroes move between home parties and reserves).

  With no party at home, the encampment screen shows what it would do, but refuses with "No party is at Oakvale."
- **The stock is shared.** A purchase or craft by any party at home spends it, and every yield fills it.
- **Healing.** A party at home with the infirmary heals by the infirmary's rules. Reserves stay rested.
- **An old save** becomes a company of one party, named "First Company", with its baggage, position and confrontation moved in (§5.1).

## 5. Technical design

### 5.1 State

*Proposed* in [`src/game/gameState.ts`](../../src/game/gameState.ts):

```ts
export type Order =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Hex }
  | { kind: 'home' }
  | { kind: 'camp' }
  | { kind: 'garrison' }
  | { kind: 'meet'; party: string }
  | { kind: 'day'; action: DayAction }        // one day of scouting, waiting, building, crafting or camping

export interface Expedition {
  id: string                 // 'party_1', … (stable; names change)
  name: string
  members: Party             // Character[], as today
  baggage: Item[]
  position: Hex
  order: Order
  /** The monster location it walked into and has not answered; as WorldState.confronting today. */
  confronting: string | null
}

export interface GameState {
  parties: Expedition[]      // never empty while the game lasts; the selected one is a scene concern
  reserves: Character[]
  world: WorldState
  slot: SlotId | null
  story: StoryState
}
```

`GameState.party`, `GameState.baggage`, `WorldState.party` and `WorldState.confronting` go away:
- Domain functions take an `Expedition`, or the list for world-wide rules.
- During the refactor steps, a helper `leader(game)` returns `parties[0]`, so callers move over one at a time.

`WorldState` keeps no party fields. The world rules take the positions and strengths they need as a list of `{ position: Hex; levels: readonly number[] }`, a *proposed* `PartyPresence` built from `parties`.

**Save.** `SAVE_VERSION` is bumped. Loading an older version builds `parties: [{ id: 'party_1', name: 'First Company', members: party, baggage, position: world.party, order: idle, confronting: world.confronting }]`. One bump can serve the companion designs if they land together.

### 5.2 The world rules over parties

- **[`src/game/blight.ts`](../../src/game/blight.ts):**
  - `netAt` sums `partyStrength(levels) − distance` over the presences.
  - Every presence's hex is neutral.
  - `spawn` keeps `SPAWN_CLEARANCE` from every presence.
  - `advanceDay(world, presences)`.
- **[`src/game/vision.ts`](../../src/game/vision.ts):** `updateSight(world, presences)` takes the union of each presence's radius.
- **[`src/game/worldMap.ts`](../../src/game/worldMap.ts):**
  - `passTurn(world, presences)`.
  - `isNotable(world, event, presences)` measures `sighted` from the nearest presence.
  - `travel` is split: the route planning (`routeTo`) stays, and the stepping moves to the day loop.
- **[`src/game/camp.ts`](../../src/game/camp.ts):** `campDay(world, expedition)` heals one party. `campUntilHealed` stays as a convenience built on the day loop, for the simulator and tests.
- **[`src/game/buildings.ts`](../../src/game/buildings.ts), [`crafting.ts`](../../src/game/crafting.ts), [`trade.ts`](../../src/game/trade.ts) (economy design) and [`guildHall.ts`](../../src/game/guildHall.ts)** take the acting `Expedition` where they used `world.party` or `game.party`.
  - `atGuildHall(expedition)` is a new helper.
  - `recruitLevel(game)` = `world.guildHall`.
  - `GUILD_HALL_LEVELS` gains `parties` and `company` per level.
- **[`src/game/itemPlace.ts`](../../src/game/itemPlace.ts):** a place names the expedition: `{ party: id, member, slot } | { party: id, baggage: index }`.

### 5.3 The day loop

*Proposed:* a new [`src/game/company.ts`](../../src/game/company.ts).

```ts
export interface DayReport { events: Array<WorldEvent & { party?: string }>; interrupt: { party: string | null; event: WorldEvent | PartyEvent } | null }
export type PartyEvent =
  | { type: 'arrived'; party: string; at: Hex }
  | { type: 'confronting'; party: string; location: string }
  | { type: 'order_done'; party: string }
  | { type: 'met'; party: string; other: string }

export function passDay(game: GameState): DayReport          // every party's day, then passTurn once
export function advance(game: GameState, limit: number): DayReport[]   // until an interrupt or `limit` days
export function setOrder(game: GameState, party: string, order: Order): string | null   // refusal or null
export function formParty(game, name, heroes): string | null; disband(game, party); moveHero(game, from, to): string | null
export function exchange(game, a: string, b: string, moves): string | null              // same hex only
```

**`passDay`** does three things in order:
1. **Each party's day,** in the order of `parties` (the vanguard first by convention), by its order:
   - **travel and home:** one hex of `routeTo`;
   - **camp:** `campDay`;
   - **meet:** one hex toward the other's position;
   - **day:** the action, then the order becomes idle;
   - **garrison and idle:** nothing.

   A party that steps onto monsters gets `confronting` set and a `confronting` event.
2. **One world day:** `passTurn(world, presences(game))`. It also runs the economy's `tradeDay`, with guards from parties.
3. **The interrupt:** the first notable event, or a party event (`arrived` at monsters, `order_done`), in that order.

`advance` refuses to run while any `confronting` is unanswered.

**Determinism.** Parties act in list order. All randomness stays where it is today: the world's RNG for spawns and the battle seeds.

### 5.4 Scenes

- **[`WorldScene.ts`](../../src/scenes/WorldScene.ts):**
  - The party column becomes the party bar (§4.2): per-party banners on the map, and the selected party's route preview.
  - Buttons for Home, Camp, Garrison, Next day and Until something happens. The day actions (scout, wait, build, craft) act for the selected party.
  - On an interrupt it selects and centres the party concerned.
  - The meet order is given by clicking another party's banner.
  - Exchange opens from the character panel when two parties share a hex. It has two columns and works like the guild hall's swap.
- **[`BattleScene.ts`](../../src/scenes/BattleScene.ts):** it receives the expedition id, and reads members and baggage from it.
- **[`GuildHallScene.ts`](../../src/scenes/GuildHallScene.ts):** the parties at home and the reserves as columns; Form party, Rename and Disband; moving heroes.
- **The encampment, trading post and crafting scenes** act for the party at home (§4.4) and show which one when more than one is.
- **[`debugCommands.ts`](../../src/scenes/debugCommands.ts):** the commands that touch the party take an optional party name. A `party` command lists them.
- **Sprites:** a banner per party (three colours) on the world map marker, drawn by a subagent.

### 5.5 The simulator

*Proposed* in [`scripts/simulate.ts`](../../scripts/simulate.ts):
- `runCampaign` becomes a day loop over `passDay`/`advance`, with a policy that sets each idle party's order. The sequential errand script becomes per-role decision functions. The battle, reward and camping steps are unchanged in substance.

**Roles:**
- **The vanguard** is `parties[0]`. Its targets are today's (`nextTarget`, `hallErrand` and the errands), except that it no longer goes home to replace a dead hero while a home guard exists.
- **The home guard** is formed at hall level 4 from reserves and recruits, filled to the party size. In priority order it goes:
  1. to **reinforce** the vanguard. When the vanguard is under strength and the guard has a hero within 3 levels of the vanguard's lowest, it meets the vanguard. On meeting, the guard's highest-level hero (with its gear) goes to the vanguard. The guard then goes home to recruit.
  2. to **defend**: nests threatening a site or raiding a route, with threat no higher than its lowest level, nearest first;
  3. to **train**: the nearest nest with threat no higher than its lowest level, within the rings to threat 5;
  4. to **garrison** the held site with the fewest `daysToFall`, or else idle at home.
- **A third party** (hall 5) is a second home guard. It takes the defend and train branches, and its targets are kept distinct from the first guard's.

**`CampaignRecord`** gains:
- per role: battles, wipes and levels at the end;
- `promotions`;
- `vanguardWalkHomeDays`;
- `guardBattles`;
- `wipes`.

The outcome `fallen` now means no hero is left. A vanguard wipe with others alive goes on, and the new vanguard is the strongest party.

**Flags.** `--parties N` (default: what the hall allows) compares one-party and company play in the same run, for A12.

## 6. Consequences

- **Compatibility.** The save is migrated (§5.1) and bumped. The log changes only in `battle_start` meta, which gains `party` and `role`, and `LOG_SCHEMA_VERSION` is bumped.
- **The early game.** Nothing changes before hall 4. The refactor steps are proved identical (A1), and the recruit rule's change (hall level, not lowest member) is the only early difference: at hall 1 to 3 it gives the same or higher levels than today's minimum. `--ready-level 7` re-checks it.
- **Balance.**
  - Two or three parties in the field multiply the party's push on the blight and its experience income. The blight's growth and `SPAWN_DIVISOR` are the levers if the land ends too clean.
  - The home guard trains on nests the vanguard would otherwise have cleared for experience, so the vanguard reaches the outer rings with fewer easy levels. That is intended, and it is measured by the simulator's battles-to-level record ([`campaign-to-level-20.md`](campaign-to-level-20.md) §5.7).
- **Player time.** More parties mean more battles to play. Auto-resolve is deliberately left out of the first version (§8.3). If playtesting finds the guard's battles tedious, the engine's policies already make auto-resolve cheap to add: run the battle headless with the `aggressive` policy for both sides, as the simulator does, and show the result.
- **The refactor's reach.** About 90 references to the single party across domain and scenes. Steps 1 and 2 of §7.3 do the refactor without changing behaviour, guarded by A1, so step 3 starts on a tested base.

## 7. Verification

### 7.1 Tests

Tests run under `make test` (podman). The domain project can be run locally with `npx vitest run --project domain`.

- **Refactor guard:** a test in `scripts/simulate.test.ts` runs a short seeded campaign and compares its summary with a stored snapshot taken before step 1 (A1).
- **`company.test.ts` (new):**
  - `passDay` with two travelling parties;
  - each order kind;
  - day actions for the selected party;
  - interrupts from either party;
  - the refusal while confronting;
  - meet and exchange;
  - wipes and the loss condition (A3–A5, A7, A9).
- **`blight.test.ts` and `vision.test.ts`:**
  - influence and sight over two presences;
  - a garrisoned site holds;
  - spawn clearance (A6).
- **`trade.test.ts`:** parties guard road hexes (A8).
- **`guildHall.test.ts`:**
  - levels 4 and 5;
  - forming, disbanding and moving heroes, with refusals;
  - the recruit level (A2, A10).
- **`save.test.ts`:** migrating a single-party save; round-tripping a company.
- **Scene tests:**
  - the party bar;
  - orders;
  - focus on an interrupt;
  - the Guild Hall's columns;
  - the encampment acting for the party at home (A11).
- **`scripts/simulate.test.ts`:**
  - the role policies on fixed states;
  - reinforcement by meeting;
  - the record fields (A12).

### 7.2 Simulator acceptance

1. Before and after steps 1 and 2: an identical summary from seed 1 (A1).
2. `--ready-level 7`: the early game near its figure.
3. The long campaign with `--parties 1` against the default:
   - the company cuts the vanguard's walking days home;
   - the guard records promotions;
   - the campaign's Source share is retuned toward about two in three (A12).

### 7.3 Suggested order (for the planner)

1. **Refactor to a company of one:**
   - `GameState.parties`, `Expedition`;
   - `leader(game)`;
   - world rules over presences;
   - item places by party;
   - the save migration.

   No behaviour changes (A1).
2. **The day loop, still one party:** orders and `passDay`/`advance`; travel and camping expressed as orders; the simulator on the day loop. No behaviour changes (A1).
3. **Hall levels 4 and 5:** forming parties at home; the recruit rule; wipes and the loss condition.
4. **The world map's company UI:** the party bar, orders, interrupts with focus, banners, and the Guild Hall's columns.
5. **Meeting, exchange, garrisons and road guards** (the road guards need the economy design's routes).
6. **The simulator's company policy:** vanguard, guard and third party; reinforcement; the record; `--parties`; and the retune with the companion designs. Then CLAUDE.md, the manual, and [`blight.md`](blight.md) §5.4 and [`guild-hall-and-watchtowers.md`](guild-hall-and-watchtowers.md) marked as answered.

This is the companion that makes [`campaign-to-level-20.md`](campaign-to-level-20.md)'s long walks bearable, so its step 2 (the bigger map) is best measured with this design's step 6 in place.

## 8. Open questions and assumptions

None of these block steps 1 and 2. They are recorded with the default taken.

| # | Question | Default taken |
| --- | --- | --- |
| 8.1 | Should all parties act in one clock, or should the player move one party at a time while time stands still for the others? | One clock with standing orders, XCOM-like. A party can't be moved without the world moving, which is what makes several parties worth having. |
| 8.2 | Can heroes change parties in the field? | Only between two parties on the same hex. Reserves join or leave only at home. |
| 8.3 | Can the player auto-resolve a battle for a lesser party? | Not in the first version. Every battle is played. It is cheap to add later with the simulator's policies (§6). |
| 8.4 | Do garrisoned heroes gain experience slowly (drill)? | No. The scrubs grow by fighting easy nests. A drill rate would have to be weighed against "waiting is not free". |
| 8.5 | Recruits at the hall's level (up to 5), not near the veterans'? | Yes. This replaces the campaign design's "highest − 2". Promotion from the second party fills late gaps. |
| 8.6 | Does a vanguard wipe end the game when other heroes live? | No. The game is lost only when the encampment falls or no hero is left. |
| 8.7 | Is a wiped party's baggage lost, or left at the location? | Left as the location's loot, so a later party can recover it. |
| 8.8 | Party size stays 5 at hall levels 4 and 5? | Yes. More parties, not bigger ones. `FOES_AT_THREAT` must not grow with the company. |
| 8.9 | At most three parties? | Yes. One more party per hall level past 3. |

**Risks:**
- **The refactor's breadth,** mitigated by the two no-change steps.
- **Player time** in many battles (8.3).
- **The blight tipping** toward the party with two or three pushers in the field.
- **The simulator's policy** for two roles: the more it plays the company well, the more the tuning can be trusted. A poor guard policy would understate the design's value.
