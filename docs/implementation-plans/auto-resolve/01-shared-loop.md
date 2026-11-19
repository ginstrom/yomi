# Step 01: The shared loop

[Plan index](index.md) · [Design](../../designs/auto-resolve.md) (§5.1 the loop, §5.2 the simulator, §5.5 `playStep`, §7.1 tests) · [Feature record](../../features/auto-resolve.md)

**Suggested engineer:** sonnet. The extraction's shape is fixed by C1, and the refactor guard proves it preserves behaviour.

## 1. Objective

The headless loop that plays a battle out with a policy on each side becomes one Phaser-free module, `src/engine/autoPlay.ts`, with tests, and the simulator's `fight` plays through it. Nothing about play changes: the refactor guard's records and hash hold, and a 50-campaign run hashes the same before and after. The game's enemy policy constant moves into the same module so that the estimate (step 02, in `src/game/`) can name it without importing a scene.

## 2. Requirements and context

- **R10:** the loop is one Phaser-free function in the engine's directory, with tests, used by the battle scene (from step 03) and by the simulator (this step).
- **R4:** the player's side is played by `aggressive` (`AUTO_POLICY`); the enemy by the battle's enemy policy on its own stream. Here: each side gets its own stream argument; the simulator passes one stream for both.
- **R8 / A3:** the same seed and the same start give the same log. **A4:** `playOut` gives the same log as stepping by hand with the same policies and streams. **A5:** a battle that cannot end within the limit stops with `over: false`. **A7:** `npm test` passes with the guard unchanged.
- **Decision 1 (index):** `ENEMY_POLICY` moves to `autoPlay.ts` (exported, still `'aggressive'`), so that the estimate in `src/game/` plays the game's enemy policy without importing a scene. `BattleScene` imports it (step 01).

### Contract C1 (copied unchanged from the index)

```ts
import type { BattleEngine, BattleEvent, Side } from './battleEngine.ts'
import { POLICIES, type PolicyName } from './policies.ts'
import type { RNG } from '../combat/combat.ts'

/** The policy the player's side is played by when a battle is auto-resolved. */
export const AUTO_POLICY: PolicyName = 'aggressive'
/** The policy the game's enemy plays (moved here from BattleScene). */
export const ENEMY_POLICY: PolicyName = 'aggressive'
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
  /** True when the battle ended; false when it stopped past `lastRound`. */
  over: boolean
}

/** One step: false (and nothing done) when the phase is 'over' or the round is past `lastRound`; else steps the side's policy and returns true. */
export function playStep(engine: BattleEngine, options: PlayOutOptions): boolean
/** Steps `engine` with each side's policy until the battle is over or the round passes `lastRound`. */
export function playOut(engine: BattleEngine, options: PlayOutOptions): PlayOut
```

- `playStep`'s body is the simulator's: `state = engine.getState()`; stop if `state.phase === 'over'` or `state.round > lastRound`; else `engine.step(POLICIES[policies[state.phase]]({ state, legal: engine.legalActions(), rng: rngs[state.phase] }))`. It never abandons and draws nothing itself.
- `playOut` loops `playStep`; `over` is `engine.getState().phase === 'over'` when it stops.
- **The simulator's `fight`** (`scripts/simulate.ts`): `const { over } = playOut(engine, { policies: args.policies, rngs: { player: policyRng, enemy: policyRng }, lastRound: args.maxRounds }); if (!over) engine.abandon()`.

### Shared constraints (from the index)

- **Versions:** `LOG_SCHEMA_VERSION` stays 26 and `SAVE_VERSION` stays 26. No step edits either constant.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`, `GUARD_RECORDS` and `GUARD_EVENTS_SHA256`) is never edited by any step and must stay green. A mismatch means the step changed play: fix the code, not the guard.
- **Randomness.** Nothing outside the engine draws from a battle's stream. `playOut`/`playStep` draw nothing themselves; the order of draws in `fight` must not change.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or use the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>`; simulator runs each write their own `--out` under `logs/` (gitignored); never two at once.
- **Test-first.** Write the failing tests first, then the code.
- **Commits.** One commit on `main`, once `npm test` passes, without pushing. Message "Auto-resolve step 01: the shared loop".
- **Docs.** Fix the CLAUDE.md lines and `docs/reference/` text the change makes wrong or incomplete, in this step's commit (root `CLAUDE.md` under 16 KB, each directory's under 12 KB: `scripts/claudeMd.test.ts`).

## 3. Dependencies and prerequisites

- **None among this plan's steps.** Steps 02 and 03 consume C1 exactly as above.
- **Existing code at `002457c`:**
  - `scripts/simulate.ts`, `fight` (around lines 287–311): builds the engine with `meta: { source: 'simulate', policies, playerWeapons, ...meta }`, makes one `policyRng = mulberry32(seed ^ 0x9e3779b9)`, then loops `for (let state = engine.getState(); state.phase !== 'over'; state = engine.getState())`, abandoning when `state.round > args.maxRounds`, else stepping `POLICIES[args.policies[state.phase]]({ state, legal: engine.legalActions(), rng: policyRng })`. `args.policies` is `Record<Side, PolicyName>`.
  - `scripts/simulate.test.ts`: `describe('the refactor guard')` (around line 1838), 5 campaigns from seed 1 with `--parties 1`, against `GUARD_RECORDS` and `GUARD_EVENTS_SHA256`.
  - `src/engine/battleEngine.ts`: `Side`, `BattleEvent`, `BattleEngine` (`step`, `legalActions`, `getState`, `getLog`, `abandon`, `snapshot`, static `restore`); `LOG_SCHEMA_VERSION = 26`.
  - `src/engine/policies.ts`: `POLICIES` (`aggressive`, `random`), `PolicyName`.
  - `src/combat/combat.ts`: `type RNG = () => number`; `src/combat/rng.ts`: `mulberry32(seed)` (a `SeededRng` with `state()`).
  - `src/scenes/BattleScene.ts:233`: `const ENEMY_POLICY: PolicyName = 'aggressive'`, used in `create`'s `battle_start` meta and in `runEnemyAction`.
  - `src/game/encounters.ts` (`ENCOUNTERS`) and `src/game/party.ts` (`partyFighters`, the ready-made party) give seeded setups for tests; see `src/engine/battleEngine.test.ts` and `scripts/simulate.ts` (`raisedParty`, `runBattle`) for how a test builds a battle.

## 4. Scope and guidance

1. **Tests first: `src/engine/autoPlay.test.ts`** (domain project). Build battles with a seeded `BattleEngine` (e.g. a ready-made party against `goblin_raid` threat 1, `seed: 1`) and policy streams from `mulberry32`. Cover:
   - a seeded `goblin_raid` played out returns `over: true`, and its `events` end with `battle_end`;
   - **A4:** the events equal those of a second engine from the same seed stepped by hand in a plain loop with the same policies and the same streams (separate stream objects seeded alike); also equal to the tail of `engine.getLog()` after the start;
   - **A3:** twice from the same seed, identical logs;
   - `playStep` called until it returns false gives the same log as `playOut`;
   - from a `snapshot()` taken mid-battle (after some steps) and `BattleEngine.restore`d, with policy streams in the same state as the uninterrupted run's at that point, `playOut` gives the uninterrupted battle's remainder;
   - with `lastRound` already passed (less than the current round), `playStep` returns false and no event is produced; **A5:** with `lastRound` equal to the current round (or a stalemate: two units that cannot reach each other), `playOut` stops with `over: false` and the round past `lastRound`, and the battle is not abandoned (`winner` still null, phase not `'over'`);
   - a side already down at the start (a party member set to 0 hp in the setup, so the engine starts over, or whatever the engine does for a side entering fallen: check `checkWinner`) returns at once with `over: true` and no events;
   - with different streams per side, each policy is handed its own side's stream (a spy policy registered only in the test, or a wrapped RNG counting calls; do not add a policy to `POLICIES`).
2. **`src/engine/autoPlay.ts`** per C1. Doc comments as in C1. No Phaser, no scene import.
3. **`scripts/simulate.ts`, `fight`**: replace the loop with C1's two lines; keep the engine's construction, the meta and `policyRng` exactly as they are; `fight` still returns the engine.
4. **`ENEMY_POLICY`** (decision 1): delete the local constant in `BattleScene.ts` and import `ENEMY_POLICY` from `../engine/autoPlay.ts`. Its uses are unchanged. Drop the `PolicyName` import there if it becomes unused (`noUnusedLocals`).
5. **The 50-campaign check**, besides the guard test. Before any code change:

   ```sh
   npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50-before.jsonl > logs/guard-50-before.txt
   ```

   After the change:

   ```sh
   npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50-after.jsonl > logs/guard-50-after.txt
   shasum -a 256 logs/guard-50-before.jsonl logs/guard-50-after.jsonl
   diff logs/guard-50-before.txt logs/guard-50-after.txt
   ```

   The two hashes must be equal and the summaries identical (timing lines aside, if any). Record both in the execution record. Run one simulation at a time.
6. **Docs:**
   - root `CLAUDE.md`, the module map's engine line: add `src/engine/autoPlay.ts`: the headless loop (`playStep`, `playOut`) that plays a battle with a policy on each side, shared by the simulator and auto-resolve, with `AUTO_POLICY`, `ENEMY_POLICY` and `AUTO_ROUND_LIMIT` (one line's worth);
   - `src/engine/CLAUDE.md`: one line, e.g. under "The AI", that `autoPlay.ts` is the one loop stepping a battle by policies (simulator and game), drawing nothing itself, each side's policy on the stream it is given;
   - `docs/reference/simulator.md`, "Flags and single battles": a sentence that each battle plays through `playOut` (`autoPlay.ts`), both sides on one policy stream (`seed ^ 0x9e3779b9`), abandoned when it passes `--max-rounds`.

**Exclusions:** no scene behaviour (step 03), no `forecast.ts` (step 02), no change to `fightAt`'s settlement, no new policy, no change to `policies.ts` or the engine.

## 5. Verification

- `npx vitest run src/engine/autoPlay.test.ts`: fails before the module exists, passes after.
- `npx vitest run scripts/simulate.test.ts -t "refactor guard"` passes with the fixture unedited (`git diff scripts/simulate.test.ts` empty).
- 50-campaign check: identical hashes and summaries before and after (above).
- `npm test` passes (includes `tsc`, the guard and `scripts/claudeMd.test.ts`).
- No scene behaviour changes, so no in-browser run is required; optionally `npm run test:browser -- -t "victorious"` to confirm the enemy still plays.

## 6. Completion criteria

- [ ] `src/engine/autoPlay.ts` exports exactly C1's names and signatures; its tests cover A3, A4, A5, `playStep` to the end, a restored snapshot's remainder and a side already down.
- [ ] `fight` plays through `playOut` and abandons on `over: false`; the guard test is green and unedited.
- [ ] 50-campaign check identical before and after, recorded below.
- [ ] `ENEMY_POLICY` lives in `autoPlay.ts`; `BattleScene` imports it.
- [ ] Root `CLAUDE.md`, `src/engine/CLAUDE.md` and `docs/reference/simulator.md` updated.
- [ ] `npm test` passes; one commit on `main`; the index's row 01 updated with status and hash.

## 7. Execution record

Engineer: sonnet-class subagent, no paid calls.

- Baseline (before code): `npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50-before.jsonl` ran in 21 s.
- Red: `npx vitest run src/engine/autoPlay.test.ts` failed (module missing). Green: 10 tests pass (A3, A4, A5, `playStep` to the end, restored snapshot's remainder, past-`lastRound`, side already down, per-side streams via `random` vs `aggressive` counting streams).
- `src/engine/autoPlay.ts` per C1; `playOut` collects the events `engine.step` returns (a private `stepOnce` shared with `playStep`). `fight` now calls `playOut` and abandons on `over: false`. `ENEMY_POLICY` moved; `BattleScene` imports it and no longer imports `PolicyName`.
- 50-campaign check after: `shasum -a 256` of before and after both `50755e5127b00b599dd9f0bfe0015342cfc5304809baa401b2e085270d40ff1f`; summaries differ only in the `--out` filename on two lines.
- `npm test`: 94 files, 2284 tests pass (tsc, guard unedited, claudeMd limits). In-browser tests not run (no scene behaviour change).
- Docs: root `CLAUDE.md`, `src/engine/CLAUDE.md`, `docs/reference/simulator.md`.
- Deviations: none. Later steps: the test builds its battle from `ENCOUNTERS.goblin_raid(partyFighters(readyMadeParty()), 1).setup`, a usable pattern for step 02's tests.
