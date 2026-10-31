# Feature: UI feedback — inventory drag and drop, world map drag-to-pan, healing cursor

**Slug:** ui-feedback-drag-pan-cursor
**Phase:** 4. Implementation

## Request (user's words)

> Some feedback/fixes for the game. We should be able to drag and drop equipment in the inventory screen; I should be able to click and drag on the world map to pan the map around; when I am targeting a character for healing in the battle screen, my cursor icon should be healing (e.g. stylized cross or book with cross) rather than crossed swords.

## Links

- Design: `docs/designs/ui-feedback-drag-pan-cursor.md` (approved by user 2026-10-31)
- Plan: `docs/implementation-plans/ui-feedback-drag-pan-cursor/index.md` (4 steps)
- Branch: `armor-resistance` (current branch; CLAUDE.md says commit on the current branch)

## Path

Small: three independent UI changes, no new components or contracts. Architecture skipped; short design, then plan.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-10-31 | Small path: skip architecture | orchestrator | architecture brief | Scene-level UI changes only; no domain-rule changes |
| 2026-10-31 | Work on current branch `armor-resistance` | orchestrator | new feature branch | Not the default branch; CLAUDE.md says commit on the current branch |
| 2026-10-31 | No hand-over by dragging onto another member | user | include transfer | Keep change small; later feature |
| 2026-10-31 | All friendly-target spells (heals and buffs) use the cross cursor | user | separate buff icon; heals only | Swords are wrong for buffs too |
| 2026-10-31 | Add a recentre-on-party key on the world map | user | snap back on move only | Cheap; avoids losing place |
| 2026-10-31 | Design approved | user | — | — |

## Open questions

1. Drag onto another party member's portrait to hand over? (adds a domain function; designer left it out)
2. Buff spells share the healing cross? (designer default: yes)
3. Key/button to recentre on the party after panning?

All answered 2026-10-31 (see decision log).

## Model tiers

- Designer: sonnet (small UI feature)
- Planner: sonnet (small plan)
- Step 01 healing cursor: engineer sonnet, reviewer sonnet (routine)
- Step 02 world map pan + Home: engineer opus, reviewer opus (gesture/click interplay)
- Step 03 inventory drag and drop: engineer opus, reviewer opus (gesture + domain change)
- Step 04 docs and final pass: engineer sonnet, reviewer sonnet
- Overall review: opus

## Verification

- Step 01: review round 1 clean (sonnet) at ec196d8; non-blocking: a long comment line in BattleScene refreshHover (re-wrap in step 04)
- Step 02: review round 1 clean (opus) at 7403674; three non-blocking edge cases (release past threshold, Home mid-press, Home page scroll) fixed in 8ee7620 with browser tests; no re-review (non-blocking, covered by overall review)
