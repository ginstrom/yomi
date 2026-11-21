# Step 13: stage 4 close

- **Plan:** [index.md](index.md) · **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) (§4.1 `art`/`audio`/`e2e` rows, §6, §7, §8 stage 4) · **History:** [log.md](log.md)
- **Result:** directory guides are capped at 8,000 bytes; the root `CLAUDE.md` points to the asset and manual skills; the stage 4 findability check and the description trigger check pass; the final size table is in `log.md`. This is the plan's last step.
- **Tier:** engineer sonnet, reviewer opus. **Tagged [Q3]** (the always-loaded cap).

## 1. Requirements and context

- **R7:** `DIRECTORY_LIMIT_BYTES` in `scripts/claudeMd.test.ts` drops from `12_000` to `8_000`, applied to every directory `CLAUDE.md`. All limits are strict (`<`). The existing comment stays, along with its rule: move detail, never raise a cap.
- **R1, R9:** `art/CLAUDE.md`, `audio/CLAUDE.md` and `e2e/CLAUDE.md` hold only contracts. Steps 10–12 trimmed them. This step proves nothing was lost.
- **R10:** the always-loaded total must stay under `ALWAYS_LOADED_LIMIT_BYTES` (`8_500`, **[Q3]**). That total is the root `CLAUDE.md` bytes plus the sum, over every skill and agent, of the bytes of `name` and of `description`. After step 12 there are five skills (`yomi-add-content`, `yomi-balance`, `yomi-sprites`, `yomi-sound`, `yomi-manual`) and two agents (`yomi-measure`, `yomi-asset-check`). Record before and after sizes.
- **Root `CLAUDE.md` (C5, step 13 part):**
  - The Commands sentence "Sprites, sounds, narration and the manual's screenshots have their own commands, in `art/`, `audio/` and `e2e/`'s guides." now points to the skills: `yomi-sprites`, `yomi-sound` (sounds and narration) and `yomi-manual` (screenshots).
  - The cap sentence in "Keeping these files current" says directory guides are capped at 8 KB. It keeps naming the `.claude/` caps that step 05 added.
  - The root stays at or under 6,500 bytes (design §7 target).
- **Shared constraints:**
  - Move text and never rewrite rules.
  - No game code, rule or constant changes.
  - Commit on the current branch as `Modular context step 13: stage 4 close`, with no attribution lines. Never push. Stage files by path.
  - Default `node` is 22, so prefix commands with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or use `make test`.

## 2. Dependencies and prerequisites

- **Step 10 (expected done):**
  - `.claude/skills/yomi-sprites/` exists, with `SKILL.md`, `workflow.md` and `drawing.md`.
  - `art/CLAUDE.md` is down to its contracts and carries the C4 pointer line.
  - The stage 4 base SHA is the parent of step 10's first commit. Find it with `git log` on the step 10 commits listed in the index, and confirm it against step 10's execution record.
- **Step 11:** `.claude/skills/yomi-sound/` exists, with `SKILL.md`, `commands.md`, `new-cue.md`, `sourcing.md` and `narration.md`. `audio/CLAUDE.md` is down to its contracts plus its pointer.
- **Step 12:**
  - `.claude/skills/yomi-manual/` exists, with `SKILL.md` and `screenshots.md`.
  - `.claude/agents/yomi-asset-check.md` exists, and its run is recorded in `log.md`.
  - `e2e/CLAUDE.md`'s last paragraph is the pointer.
  - The root Subagents line names `yomi-asset-check`.
- **Existing:** `scripts/claudeMd.test.ts` already has the constants C2 lists, including `DIRECTORY_LIMIT_BYTES = 12_000` and `ALWAYS_LOADED_LIMIT_BYTES = 8_500`, and the budget test.
- Check that every one of these exists before you start. If one is missing, stop and report it.

## 3. Scope and implementation guidance

1. **Directory cap.**
   - Measure every directory `CLAUDE.md` (`wc -c CLAUDE.md */CLAUDE.md src/*/CLAUDE.md`).
   - If any guide is already at or over 8,000 bytes, lowering the constant shows the test failing. Then fix that guide by moving detail into the right skill or `docs/reference/` (moved, not dropped), and record the move.
   - If none is over, show the check works another way. Add a temporary oversize `CLAUDE.md` (for example a scratch directory under `src/` with a 9,000-byte file) and confirm the test fails. Then delete the file before committing.
   - Set `DIRECTORY_LIMIT_BYTES = 8_000`.
2. **Root `CLAUDE.md`.** Make the two sentence edits in §1. Search the `CLAUDE.md` files and `.claude/` for any other pointer that still sends sprite, sound, narration or screenshot procedures to `art/`, `audio/` or `e2e/`'s guides, and repoint each one.
3. **Findability check, for `art/CLAUDE.md`, `audio/CLAUDE.md` and `e2e/CLAUDE.md`.**
   - Write a scratch script in the session scratchpad, never in the repository and never committed.
   - For each guide, it takes every backticked span and every bold lead phrase (`**…**`) from `git show <stage-4-base>:<guide>`.
   - It reports each one not found verbatim in the union of the current guide, `.claude/skills/**`, `.claude/agents/**`, `.claude/roles/**` and `docs/reference/**`. Never read `.claude/worktrees/`.
   - The list must be empty, or each entry must be justified in `log.md`. One expected entry: `art/CLAUDE.md`'s last line ("update this file in the same commit"), which design §4.1 drops because the root rule covers it.
   - Record the base SHA used.
4. **Description trigger check** (one haiku spawn; see the spawn caveat below).
   - Brief a fresh agent with `model: "haiku"`. Give it only the seven `name` + `description` pairs, read from the frontmatter, and these ten tasks. Ask it to name the one skill or agent each task should load. Give it no other context.

     | # | Task | Intended |
     | --- | --- | --- |
     | 1 | Add a Frost Lance spell | `yomi-add-content` |
     | 2 | Retune BC4 | `yomi-balance` |
     | 3 | Draw a new map icon | `yomi-sprites` |
     | 4 | Voice a cutscene line | `yomi-sound` |
     | 5 | Retake the manual's shots | `yomi-manual` |
     | 6 | Measure the one-party campaign win rate at seed 1 | `yomi-measure` |
     | 7 | Check that the sprite and sound builds are current before a PR | `yomi-asset-check` |
     | 8 | Add a new encampment facility | `yomi-add-content` |
     | 9 | Make a new sound cue for opening a chest | `yomi-sound` |
     | 10 | Add a new foe kind | `yomi-add-content` |

   - Every pick must match.
   - On a miss, stop and report the miss with a proposed `description` wording (single line, under 260 bytes, total under the cap). The orchestrator approves before you edit it, as C1 fixes the descriptions.
   - Rerun the whole check with a fresh haiku agent until all ten match. Record every round's answers in `log.md`.
5. **Final sizes.**
   - In `log.md`, fill in the design §7 table with actuals beside "Before":

     | Measure | Before |
     | --- | --- |
     | root | 6,243 |
     | skill descriptions | 0 |
     | agent descriptions | 0 |
     | always loaded | 6,243 |
     | directory guides in total | 55,328 |
     | adding a spell: guides to read | ≈ 22.3 KB |
     | orchestrator resume | record 8.7 KB + index 28 KB |

   - Measure each value with `wc -c`. The always-loaded figure uses the test's own formula.
   - Also list each directory guide's before and after bytes.
6. **[Q3] settled:** the user kept 8,500.
   - Then trim the root `CLAUDE.md` by moving detail to a directory guide, a skill or `docs/reference/`.
   - Never drop a contract. If the cap can't be met without losing triggers, stop and report the smallest total you reached.
7. **Exclusions:** no change to skills' bodies beyond what findability or a trigger miss requires, to `docs/reference/` beyond moved detail, or to the global skills.

### Spawn caveat

The trigger check needs one subagent spawn, and the brief must authorize it. If it doesn't, stop before item 4 and report: the orchestrator runs the check and records it in `log.md`.

## 4. Verification

- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npx vitest run scripts/claudeMd.test.ts`:
  - it fails with the temporary oversize guide (or with a real one over 8,000);
  - after the fix, it passes, with `DIRECTORY_LIMIT_BYTES = 8_000`.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes.
- The findability script lists nothing unjustified for art, audio and e2e. Its output and the base SHA are in `log.md`.
- The trigger check shows 10 of 10 in its last round, recorded in `log.md`.
- `wc -c CLAUDE.md` shows 6,500 bytes or fewer. The always-loaded total in `log.md` is under 8,500 (or the user's cap).
- `git status --short` is clean apart from changes that predate the run. The temporary fixture is gone.
- **Reviewer:**
  - Walk the design §4.1 rows for `art`, `audio` and `e2e` one by one against the diff over steps 10–13 (`git diff <stage-4-base>..HEAD`): every "stays" item is still in the guide, and every "moves" item is in its named skill file.
  - Check that the trigger check really used only the descriptions.
  - Recompute the always-loaded total yourself.

## 5. Plan completion (last step)

Confirm, with evidence in `log.md`, each of the index's completion criteria:

- every step 01–13 is `done` in the index, with its commits, and `npm test` passed at each commit;
- the findability checks of steps 05 and 13 are clean or justified;
- the always-loaded total is under the cap and enforced, with before and after sizes recorded;
- the restricted global diff (steps 07 and 09) shows only design §5.3 and §4.7 lines. Re-run `diff -ru /Users/ryan/.claude/skills-backup-2026-11-21 /Users/ryan/.claude/skills`, ignoring the "Only in" lines for the directories the backup lacks, and confirm it matches what `log.md` holds;
- `yomi-measure` (step 02) and `yomi-asset-check` (step 12) have each been run once, and the stage 3 smoke check (step 09) and this trigger check are recorded.

If any criterion is unmet, leave this step `in progress` and report which.

## 6. Completion criteria

- [ ] `DIRECTORY_LIMIT_BYTES = 8_000`, the test seen failing first, and every guide under it.
- [ ] Root Commands sentence and cap sentence updated; root ≤ 6,500 bytes.
- [ ] Findability of art/audio/e2e: clean or justified, recorded with its base SHA.
- [ ] Trigger check 10/10, every round recorded.
- [ ] Final §7 size table with actuals in `log.md`; always-loaded under 8,500 **[Q3]**.
- [ ] Plan completion criteria confirmed in `log.md`.
- [ ] `## Step 13: stage 4 close` section in `log.md` (C7); index row set `done` with the commit; execution record below filled in. All of this goes in one commit.

## 7. Execution record

- 2026-11-21. Red: `DIRECTORY_LIMIT_BYTES = 8_000` with a temporary 9,000-byte `src/zzscratch/CLAUDE.md` failed the directory test; fixture deleted; no real guide over 8,000.
- Root `CLAUDE.md` 6,817 -> 6,492 (Commands and cap sentences updated; wording trims listed in `log.md`). Always loaded 7,912 of 8,500.
- Findability of art/audio/e2e against base `c2e6cc3`: nothing missing. Trigger check: 10 of 10 in round 1. Details, size tables and plan completion are in `log.md`.
- `npm test`: 98 files, 2,419 tests, all pass. No deviations. Step 13 needs nothing further; the outcome line is appended after review.

