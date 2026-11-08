# Feature: long campaign, stage 5 (a company of one)

**Slug:** long-campaign-stage-05
**Phase:** 3. Planning

## Request (user's words)

> please do stage 5 of the long campaign, "A company of one" (docs/designs/long-campaign/stage-05-company-of-one.md).
> ... It's mostly a refactor that's meant to change no behaviour. It lays the groundwork for stage 6's multiple parties ... The guard: the first step stores a fixture of a seeded --campaign simulator summary. The simulator must give the exact same summary after every step.

## Links

- Stages overview: `docs/designs/long-campaign/index.md`
- Design: `docs/designs/long-campaign/stage-05-company-of-one.md` (status "ready for planning")
- Reference: `docs/designs/long-campaign/reference/multiple-parties.md` §4.2, §5.1–5.3, §7.3 steps 1–2
- Plan: `docs/implementation-plans/long-campaign-stage-05/` (pending)
- Branch: `long-campaign-stage-05`, off main (76cc1ec)

## Path

Large/structural refactor, but architecture and design are done (the stage design cuts from reference/multiple-parties.md). Straight to planning, as stages 2–4 did.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-08 | Stage 5 next | user | stage 7 | Stage 6 depends on it; tree is quiet |
| 2026-11-08 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Stage design marked ready for planning |
| 2026-11-08 | Own branch `long-campaign-stage-05` off main | orchestrator | commit on main | Precedent of stages 1–4 (one branch and PR per stage) |

## Open questions

None yet.

## Model tiers

- Planner: opus

## Verification

(none yet)
