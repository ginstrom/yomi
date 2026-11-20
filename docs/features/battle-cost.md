# Feature: battle cost on the result screen

**Slug:** battle-cost
**Phase:** 2, design

## Request (user's words)

> We want the result screen to say what a battle cost, meaning the hit points lost before level-ups heal them. [...] I'd do it as a separate small change. Want it? --- yes

Raised by the auto-resolve simulated user (`docs/features/auto-resolve.md`): after an auto-resolved battle the result screen shows no cost. Applies to every battle, played or auto-resolved.

## Links

- Design: `docs/designs/battle-cost.md` (to write)
- Plan: one step, to write
- Branch: main (CLAUDE.md: commit on the current branch)

## Path

Small: short design, one-step plan, implement, step review. No architecture.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-20 | Show the battle's cost on the result screen as its own change | user | fold into auto-resolve; leave out | Request above |

## Open questions

- None yet.

## Tiers

- Designer: sonnet (small UI addition); engineer / reviewer: sonnet / sonnet
