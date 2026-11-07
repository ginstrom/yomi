# Feature: long campaign, stage 3 (gear families and the first two tiers)

**Slug:** long-campaign-stage-03
**Phase:** 3. Planning

## Request (user's words)

> Stage 3: gear families (Recommended)  — chosen 2026-11-07 as the stage after stage 2

## Links

- Stages overview: `docs/designs/long-campaign/index.md`
- Design: `docs/designs/long-campaign/stage-03-gear-families.md` (status "ready for planning", written with the user)
- Plan: `docs/implementation-plans/long-campaign-stage-03/` (pending)
- Branch: `long-campaign-stage-03`, off `armor-resistance` (3f9744e), which is PR B of two stacked PRs

## Path

Large, but the architecture and design are done (the stage design cuts from reference/gear-and-runes.md). Straight to planning, as stage 2 did.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-07 | Stage 3 next | user | stage 5 | Index order |
| 2026-11-07 | Own branch off armor-resistance | orchestrator | commit on armor-resistance | armor-resistance is under review as PR B; keep it fixed |
| 2026-11-07 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Stage design marked ready for planning |

## Open questions

None yet.

## Model tiers

- Planner: opus

## Verification

(none yet)
