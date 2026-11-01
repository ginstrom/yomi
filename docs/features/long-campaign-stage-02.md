# Feature: long campaign, stage 2 (special attacks and elements)

**Slug:** long-campaign-stage-02
**Phase:** 3. Planning

## Request (user's words)

> let's move on to the next stage of the plan

The plan is the long campaign's stages (`docs/designs/long-campaign/index.md`); stage 1 is done, so this is stage 2.

## Links

- Stages overview: `docs/designs/long-campaign/index.md`
- Design: `docs/designs/long-campaign/stage-02-special-attacks-and-elements.md` (status "ready for planning"; the stage designs were written and committed with the user, 9c740ae)
- Plan: `docs/implementation-plans/long-campaign-stage-02/index.md` (to be written)
- Branch: `armor-resistance` (current; CLAUDE.md says commit on the current branch)

## Path

Large, but the architecture and design are already done: the stage design cuts from the reference designs, which settle the structure (`abilities.ts`, `areaOf`, elements and wards). Go straight to planning.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-01 | Next stage is stage 2 | orchestrator | stage 5 (independent track) | The index's order puts foes and gear first; user said "the next stage" |
| 2026-11-01 | Skip architecture and design; the stage design is the approved design | orchestrator | new brief/design | Stage design marked ready for planning, written with the user |
| 2026-11-01 | Guard re-measured at the start of the stage | orchestrator | — | Index convention; fdc0593 and 51cecb5 (free attacks, defender turning) changed battle rules after stage 1's 238 |

## Open questions

None yet. Stage 1's play script is still for the user to walk.

## Model tiers

- Planner: opus (engine, policy, scene, art, balance)
- Steps: assigned after the plan

## Verification

(none yet)
