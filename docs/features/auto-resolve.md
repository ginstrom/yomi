# Feature: auto-resolve for battles

**Slug:** auto-resolve
**Phase:** 5, verification (c1dc3f2..42e7f18)

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

- Should the result screen show what a battle cost (hit points lost, before level-up heals)? Simulated user's friction; applies to played battles too, so it changes the approved design. Blocks nothing; for the user.

## Tiers

- Designer: opus; planner: opus
- Engineer / reviewer per step (planner's suggestions taken): 01 sonnet/sonnet, 02 opus/opus, 03 opus/opus, 04 sonnet/sonnet, 05 opus/opus, 06 sonnet/sonnet, 07 sonnet/sonnet; overall review opus; QA sonnet; simulated user sonnet
- Steps run one at a time in one tree: 01, 02, 03, 04, 05, 06, 07

## Verification

- 01 (ad71f69, sonnet/sonnet): clean, 1 round
- 02 (64b794a + 95ceef8, opus/opus): clean, 1 round; 3 nits fixed
- 03 (f67389b + 45c80b8, opus/opus): clean, 1 round; fixed the 51-round off-by-one (now `autoLastRound`, also in forecast) and a test assumption
- 04 (a9d51d6, sonnet/sonnet): clean, 1 round
- 05 (70c704b, opus/opus): clean, 1 round; occasional single engine steps up to ~48 ms can overrun a 10 ms slice (accepted by orchestrator; revisit if felt in play); two nits carried to step 06
- 06 (aca1957, 10e63c9, 29f8e88, sonnet/sonnet): clean after 2 rounds; restart test made to bite (`forecastRuns`), checked by mutation
- 07 (42e7f18, sonnet): no step review; covered by the overall review
- Overall review (opus, at 42e7f18): clean; 4 non-blocking (manual wording, stale comments, no e2e of battle hand-back, step 07 boxes). Suite: npm test, build pass; 4 browser timeouts under load passed on rerun
- QA (sonnet, at 42e7f18): pass; minor: world hint unwrapped at 840 wide, manual wording; estimate slower in headless (~3 s at threat 1), real hardware unverified. Evidence in .git/pr-review/main/evidence/
- Simulated user (sonnet, hands-on, at 42e7f18): auto-resolve saves the time hoped for; estimate sorts fights. Friction: result screen omits cost; result text over sprites; 20→30% swing after 3 skill points (40-sample noise); second party not reached
- Fixes: step 07 engineer (sonnet) on items 1–5 of the merged findings
