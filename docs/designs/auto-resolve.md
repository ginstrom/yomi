# Auto-resolve for battles

## 1. Purpose and status

**Request (user's words):** "there should be an auto-resolve option for all battles". Feature record: [`docs/features/auto-resolve.md`](../features/auto-resolve.md).

**Problem.** Every battle in the game is played by hand. With a company of up to three parties, and a vanguard fighting some 20 to 35 battles a campaign, many of them easy ones far below the party's level, the player spends much of their time on battles whose outcome is not in doubt. The company design parked this question at stage 6 ([multiple-parties §6 "Player time" and §8.3](long-campaign/reference/multiple-parties.md); the open-questions table of [the long campaign's index](long-campaign/index.md); [stage 6's implementation notes](long-campaign/stage-06-multiple-parties.md)), for lesser parties only. The user has now settled it, and widened it to every battle.

**Outcome.** Any battle can be auto-resolved, either before it starts (from the world map, beside Attack) or at any point during the player's turn (from the battle screen). The engine plays the battle to its end with the AI's policy on both sides, at once, as the simulator does, and the battle's result screen shows what happened. Everything after a battle (experience, deaths, loot, runes, the location cleared, the blight, the save) runs through the same code as for a played battle.

**Status: ready for planning.** The open questions in section 8 have recommended defaults and do not block implementation.

## 2. Requirements and scope

### Functional requirements

| ID | Requirement |
| --- | --- |
| R1 | On the world map, while the selected party stands among monsters, the footer offers **Auto-resolve** beside Scout, Wait and Attack, under the same rule as Attack. It fights that location's battle without the player playing it. |
| R2 | On the battle screen, an **Auto-resolve** button resolves the rest of the battle from where it stands. It is enabled exactly when End Turn is (the player has control) and hidden once the battle is over. |
| R3 | Auto-resolve covers every battle the game fights: every party's (the vanguard's and a lesser party's alike), every encounter (monster lairs, nests, bandits, the Source), a battle taken up from a save, and a debug console `fight`. There are no story or tutorial battles today (section 3). |
| R4 | The player's side is played by the `aggressive` policy from `POLICIES`, the policy the simulator's heroes use; the enemy by the battle's enemy policy and its own seeded stream, exactly as in a played battle. |
| R5 | The battle resolves at once: no per-event animation or sound. The board then shows the battle's final state (positions, facing, hit points, the fallen faded) and the log holds every event's line, as a battle taken up from a save shows its past. |
| R6 | The result screen is the played battle's (VICTORY or DEFEAT, the foes beaten, experience and levels, the fallen, the "Found:" line; or the defeat lines), with one line added saying it was auto-resolved and over how many rounds. The victory or defeat sting and the level-up sting play as for a played battle. |
| R7 | Everything downstream of the battle is the played battle's: `takeLoot`, `takeRunes` from the battle's seed, `clearLocation` (and with it the blight's cleansing and the Source's defeat), mana and hit points carried, `rewardVictory` (the fallen dead), `wipeParty` and permadeath, and the save. No new code path settles a battle. |
| R8 | Auto-resolve is deterministic: the same seed, the same state and the same moment of pressing give the same battle. A battle auto-resolved from its start records the player's policy in `battle_start`'s `meta`, so `?seed=` replays it. |
| R9 | If the battle has not ended `AUTO_ROUND_LIMIT` (50) rounds after auto-resolve began, it stops at that point, says so in the log, and hands the battle back to the player, who may press Auto-resolve again or play on. |
| R10 | The headless loop that plays a battle out with policies is one Phaser-free function in the engine's directory, with tests, used by the battle scene and by the simulator. |
| R11 | The player's manual describes auto-resolve, and its screenshots are retaken; the long campaign's open question is marked answered. |

### Quality constraints

- Game rules stay out of the scenes: the loop lives in `src/engine/`; the scene only asks for it and shows what it returns (root `CLAUDE.md`, "Architecture").
- Nothing outside the engine draws from the battle's stream. The player's policy gets a stream of its own (the battle's seed plus two, beside the enemy's seed plus one).
- No change to any `BattleEvent`'s shape (`LOG_SCHEMA_VERSION` stays 26) and none to any saved shape (`SAVE_VERSION` stays 26).
- The simulator's refactor guard (`scripts/simulate.test.ts`) must not move: moving the simulator onto the shared loop is a refactor.
- A battle of 3 to 12 rounds resolves well within a frame's budget of a second; the simulator plays some 10,000 battles, world included, in five minutes, about 30 ms each.

### Non-goals

- Watching the battle played back fast, or stopping it part-way to take over (question 8.1).
- A prediction of the outcome before choosing (win chance, expected losses), which would mean simulating the battle several times on other seeds (question 8.3).
- A setting that auto-resolves battles without asking, for example all of a lesser party's battles as days pass. Every battle still starts from a click: Attack or Auto-resolve.
- A choice of policy for the heroes, or new AI. The heroes' AI is the simulator's as it stands.
- Changing gear or spending points automatically. Auto-resolve changes nothing a played battle would not; the player still spends levels' points by hand.
- Any balance change (section 6).

### Acceptance criteria

| ID | Criterion | Requirements |
| --- | --- | --- |
| A1 | A party confronting a threat-1 lair presses Auto-resolve on the world map; the battle screen shows the final board and the result screen at once, with the auto-resolved line; OK returns to the world map with the location cleared, the experience given and the loot in the baggage. | R1, R5, R6, R7 |
| A2 | In a played battle, pressing Auto-resolve at the start of round 2 finishes the battle and shows the result screen; the game saved afterwards matches what the result screen says. | R2, R5, R6, R7 |
| A3 | The same seed and the same press give the identical event log twice. A battle auto-resolved from its start has `meta.playerPolicy: 'aggressive'` in its `battle_start`. | R8 |
| A4 | Playing a battle out with `playOut` gives the same log as stepping it by hand with the same policies and streams. | R4, R10 |
| A5 | A battle that cannot end within the limit (a test's stalemate) stops at the limit with the player in control and a line in the log. | R9 |
| A6 | A lost auto-resolved battle wipes the party exactly as a lost played battle does: heroes left elsewhere save and return to the world map; none left deletes the slot and offers Main Menu. | R7 |
| A7 | `npm test` passes with the refactor guard's hash unchanged. | R10 |
| A8 | The manual's Monsters and Battle chapters describe auto-resolve and its screenshots show the new buttons; the long campaign's open-questions row reads answered. | R11 |

## 3. Current system (inspected)

**Where battles start.** Every battle in the game starts from `WorldScene.onAttack`, which starts `Battle` with the location's id and the selected party (`src/scenes/WorldScene.ts`), or from the debug console's `fight`, which starts it with an encounter and threat and no location. A lesser party's battle is the same: when its monsters block the days, `blockingParty` selects it and the footer offers Scout, Wait and Attack for it. There are no scripted, story or tutorial battles: the only story tied to battle is two tutorial tips (`battle_start` at round 1, `battle_end_turn` from round 2) raised by `storyFor` with the `battle_turn` moment as each player turn begins (`src/story/tutorial.ts`). The Source is a monster location like any other.

**The battle scene** (`src/scenes/BattleScene.ts`). `create` builds the encounter (`chooseBattle` in `battleSetup.ts`), then either restores a saved engine and enemy RNG or starts `new BattleEngine(setup, { seed, meta: { source: 'game', enemyPolicy: ENEMY_POLICY, party } })` with the enemy's RNG `mulberry32(seed + 1)`. `continueBattle` hands control on: `endBattle` when the phase is `'over'`, `runEnemyAction` (one `POLICIES[ENEMY_POLICY]` step, then its animation, then `continueBattle`) in the enemy's phase, else the player's turn, which on a new round raises the `battle_turn` story moment and saves. `endBattle` settles the battle: item loot (`takeLoot`), rune loot (`takeRunes` seeded from `battleSeed(log)`), `clearLocation`, hit points (`syncUnitsFromEngine`) and, on a win, mana carried, `rewardVictory`, the level-up sting, `wipeParty` on a loss, the save or the slot's deletion, and the result screen (`describeRewards`, `foundNames`, `defeatLines`). `showRestored` shows a battle as it stands with nothing played back (log refilled with `formatEvent`, the fallen faded, `syncUnitsFromEngine`). The buttons are Attack, Skills and End Turn, 140 px wide and `BUTTON_SPACING` (160) apart, centred right of the party column (`PARTY_PANEL_W`, 80); End Turn is enabled exactly while `playerControl` holds.

**The engine** (`src/engine/battleEngine.ts`, `src/engine/policies.ts`). Callers ask (`legalActions`, `getState`) and `step(action)`. `battle_start` carries `meta: Record<string, unknown>`, free-form, so a new key is not a change of the event's shape. `abandon()` ends a battle with `winner: null`. Policies are `({ state, legal, rng }) => Action`; `aggressive` draws nothing from `rng` today (only `random` does), but takes a stream all the same.

**The simulator** (`scripts/simulate.ts`). `fight` builds an engine and loops: while the phase is not `'over'`, abandon if `state.round > args.maxRounds`, else step `POLICIES[args.policies[state.phase]]` with one policy stream `mulberry32(seed ^ 0x9e3779b9)` shared by both sides. `fightAt` then settles a campaign's battle with its own copy of the scene's settlement (hit points, mana, `rewardVictory`, `takeRunes`, `clearLocation`, `wipeParty`), without item loot.

**Saving** (`docs/reference/game.md`, "Saving"). `Battle` saves as each player turn begins (engine snapshot, enemy RNG state, ground) and again as the battle ends; a reload rewinds to the start of the turn with the same dice.

**Balance** (`scripts/CLAUDE.md`). The bands are measured by campaigns whose heroes are played by `aggressive`. The guide notes that the game as played runs easier than the tuned figure.

## 4. Proposed behaviour

### 4.1 From the world map

The footer's monster row becomes Scout, Wait, Attack, **Auto-resolve**, shown exactly when Attack is. Auto-resolve starts `Battle` as Attack does, with `auto: true` in its scene data. The battle scene opens on the battle's final state with the result screen over it (4.3). No battle turn is played by hand, so no `battle_turn` story moment is raised and the battle tutorial's tips wait for the first battle the player plays.

The button acts at once, as Attack does, with no confirmation (question 8.2).

### 4.2 From the battle screen

A fourth button, **Auto-resolve**, sits in the battle's button row (Attack, Skills, End Turn, Auto-resolve, at `BUTTON_SPACING`; the row of four spans 620 px, which fits the 760 px right of the party column at the minimum game width). It is enabled when End Turn is, so never during playback or the enemy's turn, and hidden with the others when the battle ends. Pressing it closes the Skills list and any aiming, takes control from the player and resolves the battle from the state it is in, mid-turn included: heroes that have already acted this turn keep what they did, and the policy plays the rest of the turn with what AP they have left. It has no key binding, so that a stray key cannot commit a battle.

A battle taken up from a save offers it the same way.

### 4.3 What resolving does

1. The scene calls `playOut` (5.1) on its engine with the player's side played by `AUTO_POLICY` (`'aggressive'`) on its own stream, the enemy's by `ENEMY_POLICY` on the scene's existing `enemyRng`, and a last round of the current round plus `AUTO_ROUND_LIMIT`.
2. Every event returned is pushed to the log as its `formatEvent` line, with no animation, float or sound.
3. The board is brought to the engine's state at once, as `showRestored` does: units placed and faced, hit points and status letters redrawn, the fallen faded.
4. If the battle is over, the last event (`battle_end`) is shown through the usual path for its music and sting (`showEvent`'s `battle_end` handling: the theme stops and `endShownAt` is set), then `endBattle` runs unchanged, followed by the auto-resolved line on the result screen: "Auto-resolved in N rounds." (N the rounds played under auto-resolve).
5. If it is not over (the limit was reached), the log says "The battle drags on. It is yours to finish." and `continueBattle` hands control on as usual: through the rest of the enemy's turn if it stopped there, then to the player, whose new turn raises its story moment and saves as any turn does.

### 4.4 What the player sees afterwards

The result screen is the played battle's: VICTORY with "<Foes> are beaten.", the experience each, the fallen named ("… fell and will not rise again. What they carried is in the baggage."), each level gained, the "Found:" line of items and runes; or DEFEAT with the fallen party, where its baggage lies, and the party the reserves formed, or the end of the journey. The auto-resolved line follows the first line. Under the shade the board stands as the battle ended, and the log holds every line. OK (or Main Menu) leaves as today.

Statuses do not outlast a battle, played or auto-resolved; wounds and mana carry over as they do now.

### 4.5 Edge cases

- **A side already down at the start** (a party carried in at 0 hit points): `playOut` returns at once with the battle over; the result screen shows as today.
- **The limit reached in the enemy's phase**: control returns through `runEnemyAction` for the rest of that turn, played and animated as normal.
- **A debug `fight`** (no location): auto-resolve works; as for a played debug fight, a win gives experience but clears nothing, takes no loot, rolls no runes and is not saved mid-battle.
- **The page's `?seed=`**: used as for any battle, so an auto-resolved battle replays exactly when the same button is pressed at the same point.
- **Reloading**: the run is synchronous between two saves (the turn's, and the end's), so no reload can see a battle half auto-resolved. A reload after the result opens the world map with the outcome, as after a played battle; auto-resolving cannot be undone by reloading.
- **The Source**: auto-resolvable like any battle (R3); its win ends the game through `clearLocation` as it does now.
- **Gear changed earlier in the battle** reached the engine as `equip` actions already; the policy never changes gear (`legalActions` lists no `equip`).

## 5. Technical design

### 5.1 The loop: `src/engine/autoPlay.ts` (proposed)

A Phaser-free module beside the engine:

```ts
import type { BattleEngine, BattleEvent, Side } from './battleEngine.ts'
import { POLICIES, type PolicyName } from './policies.ts'
import type { RNG } from '../combat/combat.ts'

/** The policy the player's side is played by when a battle is auto-resolved. */
export const AUTO_POLICY: PolicyName = 'aggressive'

/** Rounds auto-resolve plays before handing an unfinished battle back to the player. */
export const AUTO_ROUND_LIMIT = 50

export interface PlayOutOptions {
  policies: Record<Side, PolicyName>
  /** Each side's policy stream; the simulator passes one stream for both. */
  rngs: Record<Side, RNG>
  /** No step is taken once the round is past this one. */
  lastRound: number
}

export interface PlayOut {
  /** Every event the steps produced, in order. */
  events: BattleEvent[]
  /** True when the battle ended; false when it stopped at `lastRound`. */
  over: boolean
}

/** Steps `engine` with each side's policy until the battle is over or the round passes `lastRound`. */
export function playOut(engine: BattleEngine, options: PlayOutOptions): PlayOut
```

The loop is the simulator's: for each state, stop if `phase === 'over'` or `round > lastRound`, else `engine.step(POLICIES[policies[phase]]({ state, legal: engine.legalActions(), rng: rngs[phase] }))`. It never abandons; the caller decides (the simulator abandons, the game hands back). It draws nothing itself: the engine's dice come from the engine's stream and each policy's from the stream it is given.

Exact names are proposals.

### 5.2 The simulator

`fight` in `scripts/simulate.ts` calls `playOut(engine, { policies: args.policies, rngs: { player: policyRng, enemy: policyRng }, lastRound: args.maxRounds })` and abandons when it returns `over: false`. The stop condition and the order of draws are unchanged, so the refactor guard's hash must hold; if it moves, the change is wrong, not the guard. This makes the claim in section 6 literal: auto-resolve plays the loop the balance is measured with.

`fightAt`'s copy of the settlement stays as it is (it takes no item loot, and the campaign's figures depend on that); unifying it with `endBattle` is out of scope.

### 5.3 The battle scene

- `BattleData` gains `auto?: boolean`. In `create`, after the engine is built and the board drawn, a fresh battle with `auto` calls `autoResolve()` in place of `continueBattle()`; a restored battle ignores the flag. For such a battle `battle_start`'s meta gains `playerPolicy: AUTO_POLICY` (meta is free-form: no `LOG_SCHEMA_VERSION` bump).
- A new button `autoButton` ("Auto-resolve") in the button row; `setPlayerControl` enables it with End Turn; `endBattle` hides it with the others; `layout` places it.
- `autoResolve()` (4.3): `setPlayerControl(false)`, clear `targeting`; seed the player's stream with `mulberry32((battleSeed(log) ?? 0) + 2)`; `playOut`; push the lines and `renderLog`; bring the board to the engine's state (factor `showRestored`'s board part into a helper both use); then either the `battle_end` event's cue and music handling and `endBattle`, or the drag-on line and `continueBattle`.
- `endBattle` takes the auto-resolved line as an extra first-section line when the battle was auto-resolved (a field `autoRounds: number | null` set by `autoResolve`, reset in `create`, as other per-battle fields are). The line's words come from a pure helper (proposed `autoResolvedLine(rounds)` in `battleSetup.ts`), tested in the `domain` project.
- `probe()`: `buttons.auto`.

The player's policy stream is not saved: the run is synchronous, and a later press seeds a fresh stream from the battle's seed. Since `aggressive` draws nothing today this changes no outcome, but the stream keeps the contract if a drawing policy is ever used.

### 5.4 The world map

- A fourth footer button in `this.buttons` (Scout, Wait, Attack, Auto-resolve), its visibility the same rule; `onAutoResolve` starts `Battle` with `{ game, location, party, auto: true }`.
- `probe()`: `buttons.autoResolve`, and the `WorldProbe` type in `src/testHook.ts`.

### 5.5 Persistence and logs

- **Saves:** no shape changes; `SAVE_VERSION` stays 26. The battle saves at the turn it was pressed in (already saved as that turn began) and at its end, through the existing `save()`.
- **Logs:** no event changes; `LOG_SCHEMA_VERSION` stays 26. `battle_start.meta.playerPolicy` marks a battle auto-resolved from its start. A press mid-battle is not marked in the log; the actions it took are in the log as any action is. The `[battle-log]` dump is unchanged.

### 5.6 Files

| File | Change |
| --- | --- |
| `src/engine/autoPlay.ts` (new) + `autoPlay.test.ts` | `playOut`, `AUTO_POLICY`, `AUTO_ROUND_LIMIT` |
| `scripts/simulate.ts` | `fight` uses `playOut` |
| `src/scenes/BattleScene.ts` | `auto` scene data, the button, `autoResolve`, the result line |
| `src/scenes/battleSetup.ts` + test | `autoResolvedLine` |
| `src/scenes/WorldScene.ts` | the footer button |
| `src/testHook.ts` | probe fields |
| `src/scenes/BattleScene.test.ts`, `WorldScene.test.ts` | smoke cases |
| `e2e/battle.test.ts`, `e2e/world.test.ts` | in-browser cases (section 7) |
| `docs/manual/README.md` + screenshots | 7.3 |
| `docs/reference/scenes.md`, `docs/reference/simulator.md` | the footer, the battle screen, `fight`'s loop |
| `CLAUDE.md` (root), `src/engine/CLAUDE.md`, `src/scenes/CLAUDE.md` | one line each for `autoPlay.ts` and the scenes' new control |
| `docs/designs/long-campaign/index.md` | the open question answered |

## 6. Consequences

**Balance.** The campaign bands are measured with `aggressive` playing the heroes, so a company that auto-resolves everything plays at about the tuned difficulty. A careful human does better: the guide records that the game as played runs easier than the tuned figure, and the policy has known blind spots a player does not, all of which cost heroes, and heroes' deaths are permanent:

- it never changes gear, retreats or holds back a wounded hero; it heals by fixed rules;
- it fights a party that is already wounded exactly as a fresh one;
- it was tuned on the ready-made party's builds (`AUTO_PLANS`), and a player's own build may suit it less.

So auto-resolve is a trade the player makes, time for risk, and needs no lever: no penalty, no bonus, no change to experience or loot. It does not move the simulator's figures (5.2), so no retune is due. If play shows auto-resolve to be too costly to use, the remedy is a better hero-side policy (a separate feature, which would then move the bands and need a retune) or a prediction to choose by (question 8.3), not a change to the rewards.

**Player time.** This answers the stage 6 question in the wider form the user asked for: every battle, every party.

**Performance.** One battle's loop is tens of milliseconds; the frame in which it runs may stall that long, which is acceptable for a button press.

**Compatibility.** No save or log changes; older saves load as before, a saved battle included.

**Tutorial.** A player who auto-resolves every battle never sees the two battle tips; they stay waiting, as tips do. No change.

## 7. Verification

### 7.1 Tests (domain and scenes projects)

- `src/engine/autoPlay.test.ts`:
  - a seeded `goblin_raid` played out ends (`over: true`) and its log ends with `battle_end`;
  - the log equals one built by stepping the same engine by hand with the same policies and streams (A4);
  - twice from the same seed, identical logs (A3);
  - from a restored snapshot mid-battle, the same log as the uninterrupted battle's remainder;
  - with `lastRound` already passed, no step is taken; with a stalemate (two units that cannot reach each other, or a `lastRound` of the current round), it stops with `over: false` (A5);
  - it plays a side already down as over at once.
- `scripts/simulate.test.ts`: unchanged and passing (A7).
- `battleSetup.test.ts`: `autoResolvedLine` for 1 and several rounds.
- `BattleScene.test.ts`: a scene started with `auto: true` ends with the result screen shown and the probe's result button visible; `WorldScene.test.ts`: the footer's Auto-resolve shows with Attack.

### 7.2 In-browser tests (`npm run test:browser`)

- `e2e/world.test.ts` or `battle.test.ts`: with `?seed=` fixed, a party at a threat-1 lair presses Auto-resolve; the battle's probe shows the result (VICTORY), OK returns to the world map with the location gone and the members' experience raised (A1).
- `e2e/battle.test.ts`: a played battle's first move, then Auto-resolve; the result shows; the saved game read back agrees with the result's outcome (A2).
- A defeat (a weak party against a high-threat lair, seed fixed) wipes the party as a played defeat does (A6).

### 7.3 Docs

- `docs/manual/README.md`: chapter 3, "Monsters", a fourth bullet: **Auto-resolve** fights the battle for you at once, the heroes played by the same rules as the monsters; the result is final, and heroes who fall are dead as in any battle. Chapter 5, a short "Auto-resolve" section (the button, that it finishes the battle from where it stands, the 50-round hand-back) and a line in "Victory and defeat" that the rewards are the same. The "Battle keys" table is unchanged (no key).
- Screenshots: `npm run manual:screenshots` retakes them; `world-confront` and every battle shot change with the new buttons.
- `docs/designs/long-campaign/index.md`: the open-questions row "Auto-resolve for lesser parties' battles" becomes answered: every battle, from the world map or the battle screen (this design). Stage 6's notes may point here.

## 8. Open questions and assumptions

### Open questions (none blocking)

| # | Question | Recommendation |
| --- | --- | --- |
| 8.1 | Should auto-resolve play the battle back fast on the board, with a Stop that hands control back, rather than resolving at once? | **At once.** The point is the player's time; a watched battle is still time spent, and Stop adds a mode to the scene (a policy driving the playback loop, a save of the player's stream mid-run). The log keeps every action for a player who wants to read it. A fast playback can be added later on top of `playOut` if wanted. |
| 8.2 | Should Auto-resolve ask for confirmation, given that fallen heroes are dead? | **No.** Attack does not ask either, nothing else in the game confirms, and the button is apart from the board and has no key. If play shows misclicks, a second click ("Auto-resolve?") is a small change. |
| 8.3 | Should the player see a prediction (win chance, likely losses) before choosing? | **Not now.** It means simulating the battle many times on other seeds (its own stream, so allowed, but a second feature). Worth revisiting if players find auto-resolve too risky to use. |

### Assumptions

- "All battles" means every battle the game fights, from both the world map and the battle screen; the Source included (R3). There are no story or tutorial battles to exclude.
- The heroes' AI is `aggressive`, the only policy fit to play a side (`random` is a test policy). No new AI is in scope.
- An auto-resolved battle earns exactly what a played one does; no penalty or bonus (section 6).
- The round limit (50) is a safety net for stalemates, not a rule of play; the simulator's campaigns play `aggressive` against `aggressive` with a cap of 200 and battles last 3 to 12 rounds.
- The player's policy stream is seeded with the battle's seed plus two and not saved (5.3).
- A press mid-battle is not recorded as an event; adding one would bump `LOG_SCHEMA_VERSION` for no reader that needs it today.
- The simulator's settlement (`fightAt`) stays separate from `endBattle`; only the loop is shared.
