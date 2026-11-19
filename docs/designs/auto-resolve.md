# Auto-resolve for battles

## 1. Purpose and status

**Request (user's words):** "there should be an auto-resolve option for all battles". Feature record: [`docs/features/auto-resolve.md`](../features/auto-resolve.md).

**Problem.** Every battle in the game is played by hand. With a company of up to three parties, and a vanguard fighting some 20 to 35 battles a campaign, many of them easy ones far below the party's level, the player spends much of their time on battles whose outcome is not in doubt. The company design parked this question at stage 6 ([multiple-parties §6 "Player time" and §8.3](long-campaign/reference/multiple-parties.md); the open-questions table of [the long campaign's index](long-campaign/index.md); [stage 6's implementation notes](long-campaign/stage-06-multiple-parties.md)), for lesser parties only. The user has now settled it, and widened it to every battle.

**Outcome.** Any battle can be auto-resolved, either before it starts (from the world map, beside Attack) or at any point during the player's turn (from the battle screen). The engine plays the battle to its end with the AI's policy on both sides, at once, as the simulator does, and the battle's result screen shows what happened. Everything after a battle (experience, deaths, loot, runes, the location cleared, the blight, the save) runs through the same code as for a played battle. Before choosing, the player sees an **estimate** beside the button: the chance the AI wins the battle for them and the chance a hero dies, from 40 sample battles played out headless on seeds of their own (section 4.6).

**Status: implemented** (plan: `docs/implementation-plans/auto-resolve/`). The design was approved by the user on condition of the estimate. The user's answers (2026-11-20): resolve at once, no playback (8.1); no confirmation (8.2); include a predicted outcome in this feature (8.3). New questions in section 8 have recommended defaults and do not block.

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
| R12 | Wherever Auto-resolve is offered (world map and battle screen), an estimate of its outcome is shown with it: the win chance on the button's label, and on hovering the button a line in the screen's hint giving the win chance, the chance a hero dies, and that it is an estimate of the AI playing the player's side. Until it is ready the label says so ("…"). Note: on the world map the estimate is a tooltip above the Auto-resolve button, not the header hint (an orchestrator decision during verification, because the full hint did not fit beside the status text). |
| R13 | The estimate is computed by a Phaser-free domain module from `FORECAST_SAMPLES` (40) battles played out with `playOut` from the battle as it stands: on the world map from the encounter's setup, mid-battle from an engine `snapshot()` restored with another stream. |
| R14 | Estimating never draws from, steps or changes the real battle's engine, its streams, the world's RNG, `Math.random` or the page's seed, and does not change which seed the real battle gets. Its sample seeds are derived by hashing from the battle (mid-battle: its seed and how far it has gone; on the world map: the location, the party and the day) with a salt, so the figure is deterministic for a given battle state. |
| R15 | Estimating never freezes the screen: it runs one engine step at a time in slices of at most `FORECAST_SLICE_MS` (10 ms) a frame, only while the screen is idle (on the world map with nothing walking, in battle while the player has control), and is thrown away and restarted when the battle state it was for changes. Auto-resolve may be pressed before the estimate is ready. |

### Quality constraints

- Game rules stay out of the scenes: the loop lives in `src/engine/`; the scene only asks for it and shows what it returns (root `CLAUDE.md`, "Architecture").
- Nothing outside the engine draws from the battle's stream. The player's policy gets a stream of its own (the battle's seed plus two, beside the enemy's seed plus one).
- No change to any `BattleEvent`'s shape (`LOG_SCHEMA_VERSION` stays 26) and none to any saved shape (`SAVE_VERSION` stays 26).
- The simulator's refactor guard (`scripts/simulate.test.ts`) must not move: moving the simulator onto the shared loop is a refactor.
- One battle resolves in tens of milliseconds, measured (Node 26, this machine, `runBattle` with no log written, 200 battles after a warm-up): goblin raid threat 1 at level 1, 6 ms; bandit camp threat 4 at level 4, 16 ms; the Source's guardians threat 5 at level 7, 34 ms; bandit camp threat 7 at level 14, 50 ms. Auto-resolve runs its one battle in a single call; the estimate's 40 are sliced (R15).

### Non-goals

- Watching the battle played back fast, or stopping it part-way to take over (question 8.1).
- An estimate of anything but the win and a hero's death (experience, loot, rounds), or one by any player but the AI (the estimate is of auto-resolve, not of the player's own play).
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
| A8 | The manual's Monsters and Battle chapters describe auto-resolve and its estimate, and its screenshots show the new buttons; the long campaign's open-questions row reads answered. | R11 |
| A9 | Confronting a lair, the world footer's button reads "Auto-resolve (…)" and then, within a few seconds and with the map still responsive, "Auto-resolve (win 90%)" or the like; hovering it shows the full estimate line. In battle the button reads "Auto (90%)" likewise and is re-estimated after each of the player's actions. | R12, R15 |
| A10 | The same battle state gives the same estimate every time; the real battle started after an estimate has the seed and log it would have had without one; the real engine's snapshot is identical before and after an estimate. | R13, R14 |
| A11 | An estimate's win share matches the share of its samples won, counted independently in a test by stepping each sample's engine by hand. | R13 |

## 3. Current system (inspected)

**Where battles start.** Every battle in the game starts from `WorldScene.onAttack`, which starts `Battle` with the location's id and the selected party (`src/scenes/WorldScene.ts`), or from the debug console's `fight`, which starts it with an encounter and threat and no location. A lesser party's battle is the same: when its monsters block the days, `blockingParty` selects it and the footer offers Scout, Wait and Attack for it. There are no scripted, story or tutorial battles: the only story tied to battle is two tutorial tips (`battle_start` at round 1, `battle_end_turn` from round 2) raised by `storyFor` with the `battle_turn` moment as each player turn begins (`src/story/tutorial.ts`). The Source is a monster location like any other.

**The battle scene** (`src/scenes/BattleScene.ts`). `create` builds the encounter (`chooseBattle` in `battleSetup.ts`), then either restores a saved engine and enemy RNG or starts `new BattleEngine(setup, { seed, meta: { source: 'game', enemyPolicy: ENEMY_POLICY, party } })` with the enemy's RNG `mulberry32(seed + 1)`. `continueBattle` hands control on: `endBattle` when the phase is `'over'`, `runEnemyAction` (one `POLICIES[ENEMY_POLICY]` step, then its animation, then `continueBattle`) in the enemy's phase, else the player's turn, which on a new round raises the `battle_turn` story moment and saves. `endBattle` settles the battle: item loot (`takeLoot`), rune loot (`takeRunes` seeded from `battleSeed(log)`), `clearLocation`, hit points (`syncUnitsFromEngine`) and, on a win, mana carried, `rewardVictory`, the level-up sting, `wipeParty` on a loss, the save or the slot's deletion, and the result screen (`describeRewards`, `foundNames`, `defeatLines`). `showRestored` shows a battle as it stands with nothing played back (log refilled with `formatEvent`, the fallen faded, `syncUnitsFromEngine`). The buttons are Attack, Skills and End Turn, 140 px wide and `BUTTON_SPACING` (160) apart, centred right of the party column (`PARTY_PANEL_W`, 80); End Turn is enabled exactly while `playerControl` holds.

**The engine** (`src/engine/battleEngine.ts`, `src/engine/policies.ts`). Callers ask (`legalActions`, `getState`) and `step(action)`. `battle_start` carries `meta: Record<string, unknown>`, free-form, so a new key is not a change of the event's shape. `abandon()` ends a battle with `winner: null`. Policies are `({ state, legal, rng }) => Action`; `aggressive` draws nothing from `rng` today (only `random` does), but takes a stream all the same.

**The simulator** (`scripts/simulate.ts`). `fight` builds an engine and loops: while the phase is not `'over'`, abandon if `state.round > args.maxRounds`, else step `POLICIES[args.policies[state.phase]]` with one policy stream `mulberry32(seed ^ 0x9e3779b9)` shared by both sides. `fightAt` then settles a campaign's battle with its own copy of the scene's settlement (hit points, mana, `rewardVictory`, `takeRunes`, `clearLocation`, `wipeParty`), without item loot.

**Snapshots and seeds.** `snapshot()` returns the whole engine as plain data, `rng` among its fields as the battle stream's `mulberry32` state (`mulberry32(s).state()` is `s`), and `BattleEngine.restore` builds an independent engine from it (it `structuredClone`s what it is given). So a copy with another stream is `BattleEngine.restore({ ...snapshot, rng: sampleSeed })`, which leaves the real engine untouched. An encounter's setup is built from the party and the threat alone (`ENCOUNTERS[id](partyFighters(members), threat)`; no randomness in `encounters.ts` or `bandits.ts`), so the world map can build the very battle Attack would start. The world's header and the battle's have a hint line (`hintText`) for hovers. `WorldState.rng` is the world stream's state, read but never to be drawn from here.

**Saving** (`docs/reference/game.md`, "Saving"). `Battle` saves as each player turn begins (engine snapshot, enemy RNG state, ground) and again as the battle ends; a reload rewinds to the start of the turn with the same dice.

**Balance** (`scripts/CLAUDE.md`). The bands are measured by campaigns whose heroes are played by `aggressive`. The guide notes that the game as played runs easier than the tuned figure.

## 4. Proposed behaviour

### 4.1 From the world map

The footer's monster row becomes Scout, Wait, Attack, **Auto-resolve**, shown exactly when Attack is. Auto-resolve starts `Battle` as Attack does, with `auto: true` in its scene data. The battle scene opens on the battle's final state with the result screen over it (4.3). No battle turn is played by hand, so no `battle_turn` story moment is raised and the battle tutorial's tips wait for the first battle the player plays.

The button acts at once, as Attack does, with no confirmation (question 8.2, answered). Its label carries the estimate, "Auto-resolve (win 90%)", or "Auto-resolve (…)" while it is being worked out (4.6).

### 4.2 From the battle screen

A fourth button, the battle's Auto-resolve, sits in the button row (Attack, Skills, End Turn, Auto, at `BUTTON_SPACING`; the row of four spans 620 px, which fits the 760 px right of the party column at the minimum game width). It is enabled when End Turn is, so never during playback or the enemy's turn, and hidden with the others when the battle ends. Pressing it closes the Skills list and any aiming, takes control from the player and resolves the battle from the state it is in, mid-turn included: heroes that have already acted this turn keep what they did, and the policy plays the rest of the turn with what AP they have left. It has no key binding, so that a stray key cannot commit a battle. Its label carries the estimate, **Auto (90%)**, or **Auto (…)** while it is worked out (4.6); the button's 140 px are too narrow for "Auto-resolve" and a figure, so the hint line names it in full on hover.

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

### 4.6 The estimate

**What is shown.** Two figures, both about auto-resolve, not about the player's own play:

- the **win chance**: the share of sample battles the player's side won;
- the **chance a hero dies**: the share of samples that ended with at least one hero fallen. It counts losses (every hero falls) and wins that cost a hero, since a fallen hero is dead either way. A chance is used rather than an average of heroes lost, which would read as a fraction of a person (question 8.5).

Both are rounded to the nearest 5%, shown as ">95%" when every sample came out that way and "<5%" when none did, so that 40 samples never claim certainty, and otherwise clamped to 5% to 95%.

**Where.** Both screens that offer Auto-resolve (note: on the world map the estimate is a tooltip above the Auto-resolve button, not the header hint (an orchestrator decision during verification, because the full hint did not fit beside the status text).):

- **On the button's label**, the win chance alone: "Auto-resolve (win 90%)" in the world's footer (its buttons size to their labels), "Auto (90%)" in battle. While working: "Auto-resolve (…)" and "Auto (…)".
- **On hovering the button**, the screen's hint line (`hintText`, under the header on both screens) gives the whole estimate:
  > Estimate from 40 trial battles with the AI playing your side: it wins about 90% of them, and a hero dies in about 15%. Your own play may do better.

  While working: "Estimating how auto-resolve would go…". If any samples reached the round limit, the line adds "; 3 of 40 drag on past 50 rounds" (they count as not won).

**When it is worked out.**

- **World map:** whenever the footer shows Auto-resolve (the selected party stands among monsters and nothing is walking), from the battle Attack would start: the location's encounter built for the party as it stands. It is worked out again whenever the map redraws after a change (a heal cast, gear changed, another party selected, a day passed), and kept while nothing changes.
- **Battle:** each time the player is given control (the start of each player turn and after each of the player's actions has played), from the engine as it stands then, mid-turn included. Mid-battle, heroes already fallen are counted as they lie: with no reviver left, the chance a hero dies is ">95%", which is the truth.
- An estimate in progress is thrown away when the state it was for changes, when the player presses Auto-resolve, Attack or End Turn, or when the scene is left. Pressing Auto-resolve does not wait for it; the real battle is resolved by its own engine and streams (4.3), so the estimate is advice, never a preview of that exact battle.

**How it is computed** (5.5). `FORECAST_SAMPLES` (40) sample battles, each a copy of the battle with dice of its own, played out by `playOut`'s step with the same policies as auto-resolve (`AUTO_POLICY` for the heroes, the enemy's policy for the foes) and the same round limit. On the world map each copy is a new engine built from the encounter's setup with the sample's seed; mid-battle each is `BattleEngine.restore` of the real engine's `snapshot()`, with the snapshot's `rng` replaced by the sample's seed. The real engine is only read (`snapshot()`), never stepped.

**Seeds.** Sample `i`'s seed is `forecastSeed(base, i)`, a 32-bit hash of `base`, `i` and a fixed salt; its engine stream is that seed, its enemy policy stream the seed plus one, its hero policy stream the seed plus two (as the game lays out a real battle's). `base` is:

- mid-battle, a hash of the battle's seed (`battleSeed(log)`) and the length of its log, so it moves with every action and is the same whenever the battle stands at the same point;
- on the world map, a hash of the location's id, the party's id and the day (`world.turn`), as the real battle's seed does not exist yet. Reading these draws nothing.

The salt and hash keep the samples' seeds apart from the real battle's (its seed, plus one, plus two) in all but a one-in-four-billion coincidence, and even then nothing is shared: each sample owns its own engine and stream objects. No sample reads the page's `?seed=`, the world's RNG or `Math.random`, so the seed the real battle gets is decided exactly as before.

**Cost.** Measured headless (section 2, quality constraints): one battle takes 6 ms at threat 1 and up to 50 ms at threat 7 with level-14 heroes, so 40 samples are 0.25 s to 2 s of work on this machine, perhaps two or three times that on a slow one. It runs in slices of at most `FORECAST_SLICE_MS` (10 ms) a frame, one engine step at a time (a step is well under a millisecond), so the screen stays responsive and the figure arrives in under a second for easy fights and in about four seconds for the hardest on this machine. Samples are independent and each is determined by its seed, so how the work is sliced never changes the figure.

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
- `probe()`: `buttons.auto`, and `forecast` (the `Forecast` shown, or null while working).
- The estimate (4.6): `setPlayerControl(true)` starts a new `Forecaster` from `{ snapshot: engine.snapshot() }` and `battleForecastBase(log)`; losing control drops it. The scene's `update` gives it `workFor(forecaster, FORECAST_SLICE_MS)` each frame while it is unfinished, then sets the label and hint words (`forecastLabel`, `forecastHint`).

The player's policy stream is not saved: the run is synchronous, and a later press seeds a fresh stream from the battle's seed. Since `aggressive` draws nothing today this changes no outcome, but the stream keeps the contract if a drawing policy is ever used.

### 5.4 The world map

- A fourth footer button in `this.buttons` (Scout, Wait, Attack, Auto-resolve), its visibility the same rule; `onAutoResolve` starts `Battle` with `{ game, location, party, auto: true }`.
- `probe()`: `buttons.autoResolve` and `forecast`, and the `WorldProbe` type in `src/testHook.ts`.
- The estimate (4.6): `refresh()` starts a new `Forecaster` from `worldForecastStart(game, party)` when the footer shows Auto-resolve and the start differs from the one in hand (compared by `base` and the setup's party: rebuilt and compared by value, or simply restarted on every `refresh`, which is cheap enough at threat 1 and correct at any; the planner may pick), else drops it; `update` works it in slices as in battle. Hovering the button sets the header hint.

### 5.5 The estimate: `src/game/forecast.ts` (proposed)

Phaser-free, in `src/game/` because the world map's start needs `ENCOUNTERS`; it imports the engine and `autoPlay.ts`, never a scene.

```ts
/** Sample battles an estimate plays. */
export const FORECAST_SAMPLES = 40
/** The most time an estimate takes a frame, in ms. */
export const FORECAST_SLICE_MS = 10

/** Where the samples start: a battle not yet begun (the world map) or one in progress. */
export type ForecastStart = { setup: BattleSetup } | { snapshot: BattleSnapshot }

export interface Forecast {
  samples: number
  /** Samples the player's side won. */
  wins: number
  /** Samples that ended with at least one player-side unit fallen. */
  heroLost: number
  /** Samples stopped at the round limit (counted as not won). */
  stalled: number
}

/** Sample `i`'s seed: a 32-bit hash of the base, `i` and a fixed salt. */
export function forecastSeed(base: number, i: number): number
/** The base for a battle in progress: its seed and how far it has gone. */
export function battleForecastBase(log: readonly BattleEvent[]): number
/** The world map's start and base: the battle Attack would start for `party`, and a hash of the location, the party and the day; null away from monsters. */
export function worldForecastStart(game: GameState, party: Expedition): { start: ForecastStart; base: number } | null

/** An estimate worked one engine step at a time. */
export class Forecaster {
  constructor(start: ForecastStart, base: number, samples?: number)
  /** Takes one step, beginning the next sample as one ends; the forecast once all are done, else null. */
  step(): Forecast | null
}

/** Steps `forecaster` until it is done or `budgetMs` has passed by `now`. */
export function workFor(forecaster: Forecaster, budgetMs: number, now?: () => number): Forecast | null
/** Runs an estimate to its end at once (tests, tools). */
export function forecast(start: ForecastStart, base: number, samples?: number): Forecast

/** The button's figure ("90%", ">95%", "<5%", or "…" for null), and the hint line's words. */
export function forecastFigure(share: number | null, of: number): string
export function forecastLabel(forecast: Forecast | null, short: boolean): string
export function forecastHint(forecast: Forecast | null): string
```

- A sample's engine: from a setup, `new BattleEngine(setup, { seed, meta: { source: 'forecast' } })`; from a snapshot, `BattleEngine.restore({ ...snapshot, rng: seed })` (the snapshot is the real engine's, taken once per estimate and shared read-only; `restore` clones it). Its policy streams are `mulberry32(seed + 1)` (enemy) and `mulberry32(seed + 2)` (heroes); its last round is the start's round plus `AUTO_ROUND_LIMIT`.
- To step one action at a time, `autoPlay.ts` exports the loop's body as `playStep(engine, options): boolean` (false when the battle is over or past `lastRound`), and `playOut` loops over it, so auto-resolve, the simulator and the estimate share one definition of a step.
- A sample's outcome is read from its engine's `getState()` when it stops: won when `winner === 'player'`; a hero lost when any player-side unit has `hp <= 0`.
- Nothing here draws from any stream but the samples' own; nothing calls `randomSeed` or `Math.random`.

### 5.6 Persistence and logs

- **Saves:** no shape changes; `SAVE_VERSION` stays 26. The battle saves at the turn it was pressed in (already saved as that turn began) and at its end, through the existing `save()`.
- **Logs:** no event changes; `LOG_SCHEMA_VERSION` stays 26. `battle_start.meta.playerPolicy` marks a battle auto-resolved from its start. A press mid-battle is not marked in the log; the actions it took are in the log as any action is. The `[battle-log]` dump is unchanged. Sample battles' logs are never dumped or kept.
- **The estimate** is not saved; it is worked out again after a load.

### 5.7 Files

| File | Change |
| --- | --- |
| `src/engine/autoPlay.ts` (new) + `autoPlay.test.ts` | `playStep`, `playOut`, `AUTO_POLICY`, `AUTO_ROUND_LIMIT` |
| `src/game/forecast.ts` (new) + `forecast.test.ts` | the estimate and its words (5.5) |
| `scripts/simulate.ts` | `fight` uses `playOut` |
| `src/scenes/BattleScene.ts` | `auto` scene data, the button, `autoResolve`, the result line, the estimate's slices, label and hint |
| `src/scenes/battleSetup.ts` + test | `autoResolvedLine` |
| `src/scenes/WorldScene.ts` | the footer button, the estimate's slices, label and hint |
| `src/testHook.ts` | probe fields |
| `src/scenes/BattleScene.test.ts`, `WorldScene.test.ts` | smoke cases |
| `e2e/battle.test.ts`, `e2e/world.test.ts` | in-browser cases (section 7) |
| `docs/manual/README.md` + screenshots | 7.3 |
| `docs/reference/scenes.md`, `docs/reference/simulator.md` | the footer, the battle screen, `fight`'s loop |
| `CLAUDE.md` (root), `src/engine/CLAUDE.md`, `src/game/CLAUDE.md`, `src/scenes/CLAUDE.md` | one line each for `autoPlay.ts`, `forecast.ts` (with its seed rule under the game guide's "RNG streams" contract) and the scenes' new control |
| `docs/designs/long-campaign/index.md` | the open question answered |

## 6. Consequences

**Balance.** The campaign bands are measured with `aggressive` playing the heroes, so a company that auto-resolves everything plays at about the tuned difficulty. A careful human does better: the guide records that the game as played runs easier than the tuned figure, and the policy has known blind spots a player does not, all of which cost heroes, and heroes' deaths are permanent:

- it never changes gear, retreats or holds back a wounded hero; it heals by fixed rules;
- it fights a party that is already wounded exactly as a fresh one;
- it was tuned on the ready-made party's builds (`AUTO_PLANS`), and a player's own build may suit it less.

So auto-resolve is a trade the player makes, time for risk, and needs no lever: no penalty, no bonus, no change to experience or loot. It does not move the simulator's figures (5.2), so no retune is due. If play shows auto-resolve to be too costly to use, the remedy is a better hero-side policy (a separate feature, which would then move the bands and need a retune) not a change to the rewards. The estimate (4.6) is what lets the player make that trade knowingly: it shows the AI's odds, and its hint says the player's own play may do better.

**Player time.** This answers the stage 6 question in the wider form the user asked for: every battle, every party.

**Performance.** One battle's loop is tens of milliseconds; the frame in which it runs may stall that long, which is acceptable for a button press. The estimate's 40 battles are sliced at 10 ms a frame, so the frame rate may dip while it works (a screen at rest, nothing animating) but nothing freezes; on the hardest battles the figure takes about four seconds here and longer on slow machines (question 8.4). In battle it is redone after every action, so its work is thrown away often; that costs only idle time.

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
- `src/game/forecast.test.ts`:
  - deterministic: the same start and base give the same `Forecast` twice, and the same however it is sliced (`step` to the end versus `workFor` with a fake clock giving one step a slice) (A10);
  - independent of the real battle: an engine's `snapshot()` is deep-equal before and after an estimate from it; stepping the real engine afterwards gives the log it gives with no estimate made (A10);
  - honest: each sample's outcome, replayed by hand from `forecastSeed(base, i)` with `playOut`, sums to the `Forecast`'s `wins`, `heroLost` and `stalled` (A11);
  - sensible: a level-1 party against a threat-1 goblin raid wins (nearly) every sample; a level-1 party against the Source's guardians at threat 5 wins none (the simulator's cells give 500/500 and 0/500);
  - seeds: `forecastSeed` gives 40 distinct seeds none equal to the battle's seed, plus one or plus two, for a few bases; `Math.random` is not called during an estimate (a spy);
  - mid-battle: a hero already fallen, with no reviver, gives `heroLost === samples`;
  - words: `forecastFigure` rounds to 5% and shows ">95%" and "<5%" only at the ends; `forecastLabel` long and short; `forecastHint` with and without stalled samples, and while working.
- `src/engine/autoPlay.test.ts`: `playStep` stepped to the end gives `playOut`'s log.
- `scripts/simulate.test.ts`: unchanged and passing (A7).
- `battleSetup.test.ts`: `autoResolvedLine` for 1 and several rounds.
- `BattleScene.test.ts`: a scene started with `auto: true` ends with the result screen shown and the probe's result button visible; `WorldScene.test.ts`: the footer's Auto-resolve shows with Attack.

### 7.2 In-browser tests (`npm run test:browser`)

- `e2e/world.test.ts` or `battle.test.ts`: with `?seed=` fixed, a party at a threat-1 lair presses Auto-resolve; the battle's probe shows the result (VICTORY), OK returns to the world map with the location gone and the members' experience raised (A1).
- `e2e/battle.test.ts`: a played battle's first move, then Auto-resolve; the result shows; the saved game read back agrees with the result's outcome (A2).
- A defeat (a weak party against a high-threat lair, seed fixed) wipes the party as a played defeat does (A6).
- The estimate (A9): confronting a threat-1 lair, the world probe's `forecast` becomes non-null and the button's label reads "Auto-resolve (win >95%)" or similar; hovering it puts the estimate line in the hint. In battle the probe's `forecast` is non-null at the start of the player's turn, null right after an action, and non-null again once control returns. With `?seed=` fixed, the battle's `battle_start` seed is the same whether or not the world map's estimate ran first (wait for it, then Attack, against a run that attacks at once).

### 7.3 Docs

- `docs/manual/README.md`: chapter 3, "Monsters", a fourth bullet: **Auto-resolve** fights the battle for you at once, the heroes played by the same rules as the monsters; the result is final, and heroes who fall are dead as in any battle. Chapter 5, a short "Auto-resolve" section (the button, that it finishes the battle from where it stands, the 50-round hand-back, and the estimate: the figure on the button is the AI's chance of winning, from 40 trial battles; hovering adds the chance a hero dies; it is the AI's odds, not a promise, and a careful player usually does better) and a line in "Victory and defeat" that the rewards are the same. The "Battle keys" table is unchanged (no key).
- Screenshots: `npm run manual:screenshots` retakes them; `world-confront` and every battle shot change with the new buttons. The shots wait for the estimate to finish (the probe's `forecast`) so the label is a figure, not "…". `world-confront` may hover the button to show the estimate line.
- `docs/designs/long-campaign/index.md`: the open-questions row "Auto-resolve for lesser parties' battles" becomes answered: every battle, from the world map or the battle screen (this design). Stage 6's notes may point here.

## 8. Open questions and assumptions

### Open questions (8.1 to 8.3 answered; the rest not blocking)

| # | Question | Recommendation |
| --- | --- | --- |
| 8.1 | Should auto-resolve play the battle back fast on the board, with a Stop that hands control back, rather than resolving at once? | **Answered: at once** (user, 2026-11-20). The point is the player's time; a watched battle is still time spent, and Stop adds a mode to the scene (a policy driving the playback loop, a save of the player's stream mid-run). The log keeps every action for a player who wants to read it. A fast playback can be added later on top of `playOut` if wanted. |
| 8.2 | Should Auto-resolve ask for confirmation, given that fallen heroes are dead? | **Answered: no** (user, 2026-11-20). Attack does not ask either, nothing else in the game confirms, and the button is apart from the board and has no key. If play shows misclicks, a second click ("Auto-resolve?") is a small change. |
| 8.3 | Should the player see a prediction (win chance, likely losses) before choosing? | **Answered: yes, in this feature** (user, 2026-11-20); designed in 4.6 and 5.5. |
| 8.4 | Are 40 samples right? They give a win chance within about ±8 points near 50% (and much closer near the ends, where the choice matters most), at up to about four seconds' wait on the hardest battles on this machine. | **Yes, 40.** 20 would halve the wait but double the error to ±11; 100 would be ±5 at ten seconds. The number is one constant (`FORECAST_SAMPLES`) to tune after play. |
| 8.5 | Show the chance a hero dies, or the average number of heroes lost? | **The chance**, as above: it answers "will this cost me someone?", which is the question permadeath asks, and does not read as a fraction of a person. |
| 8.6 | In battle, re-estimate after every action, or only at the start of each player turn? | **After every action**: the estimate is most useful just after a hero falls or a foe does, and the work is only idle time. |

### Assumptions

- "All battles" means every battle the game fights, from both the world map and the battle screen; the Source included (R3). There are no story or tutorial battles to exclude.
- The heroes' AI is `aggressive`, the only policy fit to play a side (`random` is a test policy). No new AI is in scope.
- An auto-resolved battle earns exactly what a played one does; no penalty or bonus (section 6).
- The round limit (50) is a safety net for stalemates, not a rule of play; the simulator's campaigns play `aggressive` against `aggressive` with a cap of 200 and battles last 3 to 12 rounds.
- The player's policy stream is seeded with the battle's seed plus two and not saved (5.3).
- A press mid-battle is not recorded as an event; adding one would bump `LOG_SCHEMA_VERSION` for no reader that needs it today.
- The simulator's settlement (`fightAt`) stays separate from `endBattle`; only the loop is shared.
- The estimate is of auto-resolve only: the same AI, round limit and engine as the real resolve, on other dice. It is advice; the real resolve does not reuse a sample.
- The world map's sample base uses the day, so the estimate of the same lair can change from one day to the next even when nothing else did; within a day and state it is fixed. A player cannot use it to pick dice: the real battle's seed is random (or the page's) and unrelated to it.
- Timings are from this development machine under Node 26; a browser's V8 is assumed comparable, slower hardware slower.
