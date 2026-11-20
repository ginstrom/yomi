# Feature: battle cost on the result screen

**Slug:** battle-cost
**Phase:** 6, done on main (d4a2d63..ca2d040)

## Request (user's words)

> We want the result screen to say what a battle cost, meaning the hit points lost before level-ups heal them. [...] I'd do it as a separate small change. Want it? --- yes

Raised by the auto-resolve simulated user (`docs/features/auto-resolve.md`): after an auto-resolved battle the result screen shows no cost. Applies to every battle, played or auto-resolved.

## Links

- Design: `docs/designs/battle-cost.md` (822988d)
- Plan: `docs/implementation-plans/battle-cost/index.md` (1 step, 9909900)
- Branch: main (CLAUDE.md: commit on the current branch)

## Path

Small: short design, one-step plan, implement, step review. No architecture.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-20 | Design's open questions taken as recommended: HP only, the fallen counted unmarked, most lost first; proceed without a separate design gate | orchestrator | ask the user | minor; user asked for the change to be done and pushed |
| 2026-11-20 | Show the battle's cost on the result screen as its own change | user | fold into auto-resolve; leave out | Request above |

## Open questions

- None yet.

## Tiers

- Designer, planner, engineer, reviewer: all sonnet; no escalations

## Verification

- 01 (0aea703 + ca2d040, sonnet/sonnet): clean, 1 round; reviewer also ran npm test, build, test:browser (all pass). Non-blocking: the 840×560 lift isn't e2e-tested with a full levelling party of 6 (the driver fields 3); test casts on `battle_start`.
