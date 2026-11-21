# Feature: overlay frames scale above 1x

## State

- Request (carried forward from `docs/features/long-campaign-stage-07.md`, approved by the user 2026-11-21 as a loose end): "let overlay frames scale above 1 on large windows (encampment buildings stay 96 px at 1280)."
- Slug `overlay-frame-scaling` · Path: small (design, then one step, no planner) · Phase 6, done (`039dc70`); not pushed · In PR #9 · Next action: merge with #9 · Branch: `long-campaign-stage-07` (current branch; goes out in the PR stacked above stage 7)
- Links: design `docs/designs/overlay-frame-scaling.md`; no plan index (one step from the design); history `docs/implementation-plans/overlay-frame-scaling/log.md`.
- Open questions: none.
- Tiers: designer sonnet; engineer sonnet; reviewer sonnet.
- Verification: step review (sonnet) clean at `039dc70`. QA (sonnet, hand look at 1280x800, 1920x1080, 2560x1440): pass, no defects; evidence `.git/pr-review/long-campaign-stage-07/evidence/overlay-*.png`. Simulated user: not run (layout only).

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-21 | Whole-number steps above 1x (1280x800 stays 1x; 1080p and 1440p 2x) | user | fractional; half steps | Crisp pixel art; manual screenshots unchanged |
| 2026-11-21 | Text is not re-rasterised at the scale; look at 1080p later | user | sharp text now | Recommended |
| 2026-11-21 | No cap on the scale | orchestrator | cap | The window fit bounds it (designer Q3) |
| 2026-11-21 | Small path: one step straight from the design | orchestrator | planner | One helper and eight call sites |
