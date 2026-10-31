# Feature: UI feedback — inventory drag and drop, world map drag-to-pan, healing cursor

**Slug:** ui-feedback-drag-pan-cursor
**Phase:** 6. Report — done; awaiting user on follow-ups and any push/PR

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
- Step 03: review round 1 clean (opus) at f54113d, incl. 75k-move fuzz (no loss/duplication); non-blocking stale-drag-after-unreported-release fixed in 53f636f with browser test, plus two test gaps filled
- Step 04 (2026456): docs-only; its step review folded into the overall review (orchestrator decision). Cursor rendered and checked by orchestrator: reads as a cross at 16-32 px. Index row records a stale hash (a533798) — to fix in verification round. Hand check in a dev server not done by engineer; QA covered it

- Overall review (opus) at 2026456: clean. Non-blocking: stale index hash, manual missing slot<->ground drags, WorldScene stale press after unreported release, retaken screenshot font. All fixed in 1844757 and ae2816f (screenshot retaken in podman). npm test 797 pass, test:browser 67 pass. No re-review (non-blocking, each fix has a test or is docs).
- QA (sonnet) at 2026456: pass, no defects against R1–R8. Cosmetic, not fixed: a key mid-drag switches tab and silently cancels the drag; ghost stays put on resize until next move. Evidence in .git/pr-review/armor-resistance/evidence/.
- Simulated user (sonnet, hands-on) at 2026456: all four goals achieved. Fast-drag "no drop" investigated: back-to-back drags within one frame of a redraw (documented next-tick redraw rule), not a defect. "No drag ghost" contradicted by QA evidence.
- Out-of-scope friction, for the user: no on-screen recentre control (Home only); Heal castable on a full-health ally (wastes mana/AP); paper doll still shows armour after unequipping; placeholder story/tutorial modals.
