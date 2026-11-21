# Feature: overlay frames scale above 1x

## State

- Request (carried forward from `docs/features/long-campaign-stage-07.md`, approved by the user 2026-11-21 as a loose end): "let overlay frames scale above 1 on large windows (encampment buildings stay 96 px at 1280)."
- Slug `overlay-frame-scaling` · Path: small (design, then one step, no planner) · Phase 4, implementation · Next action: engineer builds from the design, reviewer checks · Branch: `long-campaign-stage-07` (current branch; goes out in the PR stacked above stage 7)
- Links: design `docs/designs/overlay-frame-scaling.md`; no plan folder (one step from the design).
- Open questions: none.
- Tiers: designer sonnet; engineer sonnet; reviewer sonnet.
- Verification: not yet.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-21 | Whole-number steps above 1x (1280x800 stays 1x; 1080p and 1440p 2x) | user | fractional; half steps | Crisp pixel art; manual screenshots unchanged |
| 2026-11-21 | Text is not re-rasterised at the scale; look at 1080p later | user | sharp text now | Recommended |
| 2026-11-21 | No cap on the scale | orchestrator | cap | The window fit bounds it (designer Q3) |
| 2026-11-21 | Small path: one step straight from the design | orchestrator | planner | One helper and eight call sites |
