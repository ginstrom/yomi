# Step 15: Simulator: `--plans` and technique counts

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R13, R14; §5.8 "Simulator", §7.2 "Path parity"; AC8) · [Feature record](../../features/skill-trees.md)

**Difficulty:** sonnet. Pass `model: "sonnet"` to the engineer; leave the reviewer's model unset. The step adds a flag and counters to `scripts/simulate.ts` along the lines of the existing ones (`--player-weapon`, `spellsCast`, `areaAttacks`); it changes no rule, and without the flag play is unchanged.

## 1. Objective

The simulator can play a chosen plan per role for the player's side, so stage 4 can run the path-parity cells (design §7.2): `--plans melee=swordmaster,archery=ranger,magic=cryomancer`. Its summary tells what heroes and foes do with their techniques: techniques used by ability id, taunts laid, pins laid and mana spent on techniques, per side.

Without `--plans` every battle and campaign plays exactly as before this step: the refactor guard stays green with its fixture unchanged.

## 2. Requirements and context

- **R13:** the simulator reports what heroes use.
- **R14 / §7.2 step 2:** path parity runs Bandit Camp threat 4 at levels 4 and 8 with each path's plan in its role's slot through `--plans`: melee swordmaster, knight, spellsword, assassin, paladin; archery ranger, rogue_archer, assassin; magic evoker, cryomancer, arcanist, healer, saint.
- **AC8 (R10), the part this step covers:** "`npm run simulate` runs with the new trees. The summary lists techniques used per side." (The capstone half of AC8 is step 23's.)
- `--plans` acts on the player's side only. It replaces `planFor` for a hero tagged in the named skill, everywhere the simulator calls `autoAdvance` for a player hero: raising a single battle's party to `--party-level`, spending a level after a win, recruits hired at the guild hall, guards formed (`formGuard`), the pre-rolls that fill places. Bandits keep their role's plan (`bandits.ts` passes it explicitly) and are never touched by the flag.

### Decisions from the index (unchanged)

- **2. The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
- **5. Mana in technique events.** An `AttackEvent` (the first strike only) or `AbilityEvent` of an ability with a `manaCost` carries `manaCost` and `manaAfter`, as a `CastEvent` does (C11).

### Contracts (copied unchanged from the index)

**C5. Plans (step 03; extended by 13 and 21; read by 15)**

```ts
// src/character/progression.ts
export const PLAN_IDS = ['knight', 'swordmaster', 'spellsword', 'ranger', 'rogue', 'rogue_archer', 'assassin',
  'evoker', 'evoker_healer', 'cryomancer', 'arcanist', 'healer', 'paladin', 'saint', 'bandit_mage'] as const
export type PlanId = (typeof PLAN_IDS)[number]
export const AUTO_PLANS: Record<PlanId, readonly PerkId[]>
export function planFor(character: Character): PlanId   // tagged melee → knight, archery → ranger, magic → evoker_healer
export function autoAdvance(character: Character, plan: PlanId = planFor(character)): void
  // skill points as today; then, while a pick is left: the first node of the plan it qualifies for,
  // else the first qualifying non-capstone node in PERKS order; stops when none qualifies
```

**C15. The simulator (steps 15 and 23)**

```ts
// scripts/simulate.ts
// CliArgs gains plans: Partial<Record<SkillId, PlanId>>  (--plans melee=swordmaster,archery=ranger,magic=cryomancer;
//   unknown role or plan refused; the player's side only; replaces planFor for a hero tagged in that skill;
//   applies to single-battle cells (--encounter --threat --party-level) and to campaigns alike)
// The summary gains per side: techniques used by ability id, taunts laid, pins laid, mana spent on techniques (step 15);
//   counters, deathblows, revives, Unbreakable saves (step 23)
// CampaignRecord gains callings: Partial<Record<PathId, number>> and capstones: Partial<Record<PerkId, number>>
//   (the vanguard's heroes at the end) and the summary the share of campaigns whose vanguard holds a capstone (step 23)
```

This step does the first two lines of C15; step 23 does the rest.

**C11 (step 09, consumed here), the events:**

```ts
// src/engine/battleEngine.ts: AttackEvent (first strike only) and AbilityEvent gain manaCost?: number, manaAfter?: number;
//   LOG_SCHEMA_VERSION = 25 (step 09)
// ABILITY_IDS = ['troll_claws', 'spider_bite', 'spider_web', 'fire_spit',
//   'power_attack', 'cleave', 'taunt', 'pin', 'flame_strike', 'frost_strike', 'thunder_strike',
//   'aimed_shot', 'hunters_mark', 'volley', 'pinning_shot', 'sprint', 'dirty_trick', 'venom_strike',
//   'hamstring', 'smite', 'consecrate']
```

**C12 (step 11, consumed here), the statuses laid:** `taunted` and `pinned` are `StatusId`s. Taunt lays `taunted` through its area's `AbilityEvent` outcomes (status-only); Pin and Pinning Shot lay `pinned` on a hit that leaves the foe standing, recorded on the strike's `AttackEvent` as any strike's status is.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets.
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run scripts/simulate.test.ts` for this file; `npm run test:browser` only after a scene change (this step changes none).
- **The simulator.** A 500-campaign run takes about five minutes; **run one at a time, never two at once**, each with its own `--out` under `logs/` (gitignored). This step measures nothing: only short smoke runs (a few battles).
- **Determinism.** A battle replays from its seed. Counting events draws nothing from any RNG.
- **`tsc` is the linter** (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `.ts` import extensions).
- **Commits.** One commit once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 15: simulator --plans and technique counts". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines this change makes wrong and search it for every name renamed or removed.

## 3. Dependencies and prerequisites

- **Step 03** provides `PLAN_IDS`, `PlanId`, `AUTO_PLANS`, `planFor` and `autoAdvance(character, plan)` (C5).
- **Steps 09–11** provide the hero abilities, `manaCost`/`manaAfter` on technique events (C11) and the `taunted`/`pinned` statuses (C12).
- **Step 13** puts the 18 stage-2 nodes into `PERKS` and the plans, so simulated heroes actually use techniques; the counts are 0 on a run before it.
- **Existing code** (inspected at `50fb4cf`):
  - `scripts/simulate.ts`: `CliArgs` (line ~96), `parseArgs(argv)` (~148, a `switch` over flags, `SINGLE_BATTLE_FLAGS` refused with `--campaign`, campaign-only flags refused without); `autoAdvance` imported from `progression.ts` and called at ~280 (raising a single battle's party to `--party-level`), ~446 (a recruit hired), ~473 and ~477 (a guard formed), ~1338 (members after a win); the summary's per-side counters on a class at ~1684 (`areaAttacks: Record<Side, number>`, `spellsCast` and the like), turned into `Summary` fields (`avgPlayerAreaAttacks`, …) at ~1757, `summarize(events, battles)` at ~1767 and `summarizeCampaigns` at ~1868; the printed summary lines.
  - `scripts/simulate.test.ts`: `parseArgs` tests and `describe('the refactor guard')` (~1596), which calls `parseArgs(['--campaign', '--battles', '5', '--seed', '1', '--parties', '1'])`.

## 4. Scope and implementation guidance

### 4.1 `--plans`

- `CliArgs.plans: Partial<Record<SkillId, PlanId>>`, `{}` by default.
- `parseArgs` reads `--plans <role>=<plan>[,<role>=<plan>...]`. A role is a `SkillId` (`melee`, `archery`, `magic`); a plan a `PlanId`. Refuse with an `Error` naming the bad part and the choices: an unknown role, an unknown plan, a role given twice, a missing value or an entry without `=`. Accept it with single battles and with `--campaign`.
- One helper decides a player hero's plan, e.g. `playerPlan(args, character): PlanId` = `args.plans[<the skill it is tagged in>] ?? planFor(character)` (a hero is tagged in one skill; if none of its tags is named, `planFor`). Every `autoAdvance` call for a player hero passes it; grep `autoAdvance(` in `scripts/simulate.ts` and change each player call (the ones listed in §3 and any other). Thread `args` (or the plans) to where it is needed rather than holding it in a module global.
- Enemy units are built by `encounters.ts`/`bandits.ts`, which are untouched: the flag never reaches them.
- With `plans` empty, `playerPlan` returns `planFor(character)`, the default of `autoAdvance`, so play is byte-for-byte as before.

### 4.2 Technique counts

Per side, added to the counters beside `areaAttacks` and to `Summary`, and printed as lines of the summary after the area-attack and spell lines:

- **techniques used by ability id**: one use per technique action, counted on the `AttackEvent` of a strike with `ability` set and `strike === 0` (the first strike), and on each `AbilityEvent` (areas, self- and foe-status abilities), for the 17 hero ability ids only (the four monster abilities are already counted where they are today; do not double them). A `Record<AbilityId, number>` per side, printed sorted by count, e.g. `Techniques (player): power_attack 3.1, taunt 1.2 a battle`. Averages per battle, as the other lines are.
- **taunts laid**: units on which `taunted` was laid (each outcome of a Taunt `AbilityEvent` that laid it).
- **pins laid**: `pinned` laid by a strike (Pin or Pinning Shot).
- **mana spent on techniques**: the sum of `manaCost` on technique `AttackEvent`s (first strike) and `AbilityEvent`s.

Read only fields the events already carry (decision 5; C11, C12); if a field this needs is missing, stop and report it rather than add it to the engine here. The campaign summary prints the same lines over all its battles if it already prints the battle summary's lines; otherwise leave `summarizeCampaigns` alone.

### 4.3 `CLAUDE.md`

In the simulator-flags paragraph: add `--plans` (`role=plan,...`, the roles `melee`, `archery`, `magic`, the plans `PLAN_IDS`, the player's side only, every `autoAdvance` of a player hero, the way to run the path-parity cells), and add the new summary items (techniques used by id, taunts, pins, mana on techniques) to the list of what the summary prints.

### 4.4 Exclusions

- No engine, policy, node or plan change; no `LOG_SCHEMA_VERSION` change.
- Counters, deathblows, revives, Unbreakable saves, callings and capstones are step 23's.
- No measurement run (steps 16 and 24 use the flag).

## 5. Verification

### Tests (in `npm test`, `scripts/simulate.test.ts`)

- `parseArgs`: `--plans melee=swordmaster,magic=cryomancer` gives `plans` `{ melee: 'swordmaster', magic: 'cryomancer' }`; no flag gives `{}`; each refusal of §4.1 throws, its message naming the bad part; accepted with and without `--campaign`.
- The plan reaches the heroes: a single battle with `--party-level 6 --plans melee=swordmaster` raises the melee-tagged hero along `swordmaster` (it holds, e.g., `power_attack` and no `rooted`), while without the flag it follows `knight`; the archer and mage are as without the flag. Likewise a recruit or a guard hero through the helper (a unit test of `playerPlan` and of the recruit path is enough).
- Bandits are unaffected: an enemy bandit's stats with and without `--plans` are equal.
- Counts on hand-made events: `summarize` over a small list of events (a technique strike of two strikes counted once; an `AbilityEvent` of Taunt laying `taunted` on two foes; a Pin strike laying `pinned`; a mana technique's `manaCost`; a monster's `troll_claws` routine not counted as a technique) gives the expected per-side numbers.
- Counts on a small run: a few seeded battles of `bandit_camp --threat 4 --party-level 4` give non-negative counts, and at least one technique used by the player's side (after step 13 every ready-made hero holds one by level 4).
- **The refactor guard** passes with its fixture unchanged (decision 2).

### Commands

```sh
export PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH
npx vitest run scripts/simulate.test.ts
npm run simulate -- --battles 20 --seed 1 --encounter bandit_camp --threat 4 --party-level 4 --plans melee=swordmaster --out logs/15-smoke.jsonl
npm test
```

The smoke run prints the new lines. No scene changes: `npm run test:browser` is not required.

### Acceptance

- `--plans` parses and is refused as §4.1 says, and steers only the player's heroes.
- The summary shows techniques used by id, taunts, pins and mana on techniques for each side (AC8, first half).
- The guard is green unchanged.

## 6. Completion criteria

- [x] `CliArgs.plans` and `--plans` parsing with its refusals; every player `autoAdvance` call takes the plan.
- [x] Per-side counters and summary lines for techniques by id, taunts, pins and mana on techniques.
- [x] Tests of §5 written first and passing; `npm test` green; the guard fixture unchanged.
- [x] `CLAUDE.md`'s simulator-flags paragraph updated.
- [x] One commit, "Skill trees step 15: simulator --plans and technique counts".
- [x] The index's step table shows `done (<commit>)` for step 15.

## 7. Execution record

Commands (Node 26): `npx vitest run scripts/simulate.test.ts` 116 passed; `npm run simulate -- --battles 20 --seed 1 --encounter bandit_camp --threat 4 --party-level 4 --plans melee=swordmaster --out logs/15-smoke.jsonl` printed the new lines (18 of 20 won; `Techniques (player): aimed_shot 8.20 a battle`, enemy none); `npm test` 1830 passed, `tsc` clean. The refactor guard passed with its fixture unchanged.

Notes for later steps:
- `strike` on an `AttackEvent` is the strike's name (a string), not an index, so a technique's first strike is told by `ability` set, not `opportunity`, and `apCost > 0` (later strikes of a routine carry 0).
- Exported for tests: `playerPlan(plans, character)`, `raisedParty(args)`, `runBattle`; `visitGuildHall(game, party, parties, plans = {})` and `formGuard(game, parties, plans = {})` take the plans last.
- `Summary` gains `playerTechniques`/`enemyTechniques` (Partial record by id, per battle) and `avgPlayer/EnemyTaunts`, `Pins`, `TechniqueMana`. The records print as a line under the table (`Techniques (side): ...`), also at the end of a campaign run (its battle table now omits the two records). `summarizeCampaigns` untouched.
- A taunt is counted per unit laid on (outcomes with `status.id === 'taunted'`); a pin by an attack's `status.id === 'pinned'`.
- Smoke note: with `melee=swordmaster` at level 4 the melee hero's technique (power_attack) was not used in 20 battles; only aimed_shot appeared. Step 16 may want to look at why.
