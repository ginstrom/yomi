# Feature: auto-resolve for battles

**Slug:** auto-resolve
**Phase:** 4, implementation (base c1dc3f2)

## Request (user's words)

> there should be an auto-resolve option for all battles

Given in answer to the orchestrator's 2026-11-20 summary, which listed stage 7 (site improvements and markets) as the next roadmap item and noted that auto-resolve for lesser parties' battles (company design §8.3, stages index open question) was waiting on the user playing a multi-party campaign. This settles that question, and widens it from lesser parties to every battle.

## Links

- Design: `docs/designs/auto-resolve.md` (8a818e0, estimate §4.6/§5.5 added in caae9e3; approved 2026-11-20)
- Plan: `docs/implementation-plans/auto-resolve/index.md` (7 steps, c1dc3f2)
- Branch: main
- Prior context: `docs/designs/long-campaign/reference/multiple-parties.md` §6 (player time) and §8.3; `docs/designs/long-campaign/index.md` open-questions table.

## Path

Medium: design, plan, implement, verify. No architecture brief: the engine already runs headless with `POLICIES` on both sides (the simulator), so auto-resolve reuses an existing contract rather than adding components.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-20 | Plan's departures accepted (scene smoke tests → in-browser tests; `ENEMY_POLICY` to autoPlay.ts; restart estimates only when their start / log changes) | orchestrator | follow design to the letter | routine engineering choices; none changes what the player gets |
| 2026-11-20 | Design §8.4–8.6 defaults taken: 40 samples; show chance a hero dies; re-estimate after every action | orchestrator | 20 or 100 samples; expected losses; once a turn | one constant, tunable after play; idle-time only |
| 2026-11-20 | Resolve at once, no playback | user | fast playback with Stop | saves the most time; playback can sit on `playOut` later |
| 2026-11-20 | No confirmation before auto-resolving | user | second click / dialog | Attack doesn't confirm either |
| 2026-11-20 | Show a predicted outcome (estimated win chance) before choosing auto-resolve, in this feature | user | leave for later (designer's rec.) | user's choice |
| 2026-11-20 | Design approved, conditional on the prediction amendment; build on main (CLAUDE.md: commit on the current branch) | user | changes first | |
| 2026-11-20 | Build auto-resolve before stage 7; offer it for every battle, not only lesser parties' | user | stage 7 first; lesser parties only (§8.3's framing) | Request above |

## Open questions

None.

## Notes carried forward

- Step 06: tighten `e2e/world.test.ts` "fits the monster row in the least window" to bound each button's right edge (with its width) clear of the party column and of each other, since the label widens there (step 04 review nit).

## Tiers

- Designer: opus; planner: opus
- Engineer / reviewer per step (planner's suggestions taken): 01 sonnet/sonnet, 02 opus/opus, 03 opus/opus, 04 sonnet/sonnet, 05 opus/opus, 06 sonnet/sonnet, 07 sonnet/sonnet; overall review opus
- Steps run one at a time in one tree: 01, 02, 03, 04, 05, 06, 07

## Verification

- 01 (ad71f69, sonnet/sonnet): clean, 1 round
- 02 (64b794a + 95ceef8, opus/opus): clean, 1 round; 3 nits fixed
- 03 (f67389b + 45c80b8, opus/opus): clean, 1 round; fixed the 51-round off-by-one (now `autoLastRound`, also in forecast) and a test assumption
- 04 (a9d51d6, sonnet/sonnet): clean, 1 round
