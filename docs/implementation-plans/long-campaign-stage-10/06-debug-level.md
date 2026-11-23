# Step 06: High levels in the debug console

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-10-forging-and-high-tiers.md) (§6 play script) · [Feature record](../../features/long-campaign-stage-10.md) (carried item 5) · [Plan log](log.md)

**Difficulty:** sonnet / sonnet. One debug command on the pattern of `xp`, under a fixed contract; it moves no rule, so the reviewer checks behaviour and tests, not balance.

## 1. Objective

Give the debug console a way to reach the levels the long campaign's play scripts need (this stage's script asks for level 15; stage 11's for higher): a `level <n>` command that raises party members straight to a level, and with `auto` spends their points as the simulator's raised party does.

## 2. Requirements and context

- **Carried item 5** (feature record): debug `xp` caps out in practice at `xp 50000`, about level 12; the design's play script (§6, part 3: "With `xp` to level 15 and an adamant kit, fight a threat 15 Freebooter Host") needs level 15 and up.
- Why `xp` falls short: `xpToNextLevel(L)` is `EVEN_FOE_XP_PER_LEVEL × L × (L − 1)` (`src/character/progression.ts`), so each level costs more than the last; there is no cap in code, but the sums grow past what one typed number comfortably reaches, and the heroes are left with every point unspent.
- Stage 9's play script walked part 3 with a level-12 party in starting kit, its points unspent, which lost; this command makes the levelled party the simulator fights with (`raisedParty`) reachable in the game.

### Decision from the index (unchanged)

16. **High levels in the debug console** (step 06, carried item): a `level <n>` command, with `auto` to spend points along `planFor`'s plan, rather than a bigger `xp` (whose 50000 reaches about level 12 only because each level costs more).

### Contract produced (copied unchanged from the index)

**C5. The debug console reaches high levels (step 06)**

```ts
// src/scenes/debugCommands.ts, COMMANDS gains:
//   level: usage 'level <n> [member|all] [auto] [@party]'
//   raises each member named (all by default) to level n, a level at a time (levelUp), its experience toward the next level set to 0;
//   with `auto`, after each level autoAdvance(member, planFor(member)) spends its points as the simulator's raised party does;
//   refuses n not above a member's level ('<name> is level L already.') or above 20; changes the game (world map only).
// `xp` is unchanged.
```

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file; `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test.
- **Simulations.** This step runs none: the debug console is a dev tool that changes no rule the campaign plays, so the 50-campaign check is not needed (say so in the execution record). The refactor guard and the policy snapshot are not touched and must stay green.
- **Determinism.** The command draws nothing (`levelUp` and `autoAdvance` draw no world or battle RNG).
- **Versions.** No `SAVE_VERSION` or `LOG_SCHEMA_VERSION` change.
- **Commits.** One commit once `npm test` passes, on `long-campaign-stage-10`, without pushing; files staged by path. Message "Stage 10 step 06: high levels in the debug console". No attribution lines.
- **Docs.** Fix the lines this change makes wrong; `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB.

## 3. Dependencies and prerequisites

- **Step 03** is done: it adds the four trophies to `debugCommands.ts`'s `MATERIALS`; this step edits the same file after it. Nothing else of step 03 is used.
- Existing code (inspected at `f3a1102`):
  - `src/scenes/debugCommands.ts`: `COMMANDS`, each `{ usage, summary, acts?, changes?, run(args, context) }`; `xp` (line ~235) is the model: `integer(text, what)`, `members(party, who)` (a number from 1, the start of a name, `all` or nothing for all), `partyOf(context)` (the `@party` word is stripped by `runCommand` into `context.party`), `DebugError` for refusals.
  - `src/character/progression.ts`: `levelUp(character)`, `autoAdvance(character, plan = planFor(character))`, `planFor(character)`, `xpToNextLevel(level)`.
  - `scripts/simulate.ts`, `raisedParty(args)`: the model for `auto`, a level at a time: `levelUp(member); autoAdvance(member, playerPlan(args.plans, member))`, where `playerPlan` with no `--plans` is `planFor`.
- Read `.claude/skills/yomi-add-content/debug-command.md` (the checklist) and `docs/reference/scenes.md`, "Debug console".

## 4. Scope and guidance

- **`level` in `COMMANDS`** (C5), next to `xp`, `acts: true`, `changes: true`:
  - Parse the arguments in any order after `<n>`: a member word (as `xp`'s second argument) and the literal `auto`. Take care that `auto` is never read as a member's name (a member named "Auto…" is still reached by number).
  - Check every named member before changing any (the refusal rule): `n` must be a whole number, at most 20, and above each named member's level; else `DebugError` with `'<name> is level L already.'` or a line naming the limit.
  - For each member: while below `n`, `levelUp`, then with `auto` `autoAdvance(member, planFor(member))`; at the end its `xp` is 0. Hit points: `levelUp` already handles them; do not heal beyond what it does.
  - One result line a member: `'<name> is now level N.'`, with `auto` adding what was spent (for example the nodes taken, or "points spent along <plan>") so the console shows it worked.
- **`xp` is unchanged.**
- **Exclusions:** no `kit` or gear command, no change to `progression.ts`, no scene change beyond `debugCommands.ts`.

## 5. Verification

- `src/scenes/debugCommands.test.ts`:
  - `level 15` raises every member of a new ready-made party to exactly 15, with `xp` 0 toward 16, and `@party` and a member number or name narrow it as for `xp`;
  - `level 15 all auto` leaves each member as `raisedParty` (with no `--plans`) would at level 15: same level, nodes held and perk points; where the plan can spend, no perk point is left unspent;
  - refusals change nothing: `n` not above a member's level, above 20, not a number; `auto` alone (no `n`);
  - `help level` shows the usage (the `help` test checks every command has usage text).
- `e2e/debug.test.ts`: add nothing unless it lists the commands (it does not at `f3a1102`); run `npm run test:browser -- -t debug` once to confirm the console still works.
- `npm test` passes.

## 6. Completion criteria

- [ ] `level <n> [member|all] [auto] [@party]` as C5, with its refusals; `xp` unchanged.
- [ ] Tests as §5; `npm test` passes; the guard and snapshot untouched.
- [ ] `docs/reference/scenes.md`, "Debug console": `level` added to the list of commands acting on a party (beside `heal`, `hp`, `xp`, …) with a sentence on `auto`; the manual only if it lists debug commands (it does not at `f3a1102`).
- [ ] One commit, "Stage 10 step 06: high levels in the debug console", files staged by path, no attribution lines; the index's row 06 updated with status and commit; the execution record says no simulation was run and why.

## 7. Execution record
