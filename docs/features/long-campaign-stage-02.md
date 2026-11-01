# Feature: long campaign, stage 2 (special attacks and elements)

**Slug:** long-campaign-stage-02
**Phase:** 4. Implementation

## Request (user's words)

> let's move on to the next stage of the plan

The plan is the long campaign's stages (`docs/designs/long-campaign/index.md`); stage 1 is done, so this is stage 2.

## Links

- Stages overview: `docs/designs/long-campaign/index.md`
- Design: `docs/designs/long-campaign/stage-02-special-attacks-and-elements.md` (status "ready for planning"; the stage designs were written and committed with the user, 9c740ae)
- Plan: `docs/implementation-plans/long-campaign-stage-02/index.md` (9 steps, e00b2fa)
- Branch: `armor-resistance` (current; CLAUDE.md says commit on the current branch)

## Path

Large, but the architecture and design are already done: the stage design cuts from the reference designs, which settle the structure (`abilities.ts`, `areaOf`, elements and wards). Go straight to planning.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-01 | Next stage is stage 2 | orchestrator | stage 5 (independent track) | The index's order puts foes and gear first; user said "the next stage" |
| 2026-11-01 | Skip architecture and design; the stage design is the approved design | orchestrator | new brief/design | Stage design marked ready for planning, written with the user |
| 2026-11-01 | Accept the plan's corrections, notably: Troll routine is 8 AP (two 4-AP claws) to keep the design's "same expected damage"; spider Web is a recharging area ability; new nests don't spawn; hero spell policy unchanged | orchestrator | take to user | Each resolves a contradiction in the design or follows its stated intent; flagged to the user in the report |
| 2026-11-01 | Guard re-measured at the start of the stage | orchestrator | — | Index convention; fdc0593 and 51cecb5 (free attacks, defender turning) changed battle rules after stage 1's 238 |

## Open questions

None yet. Stage 1's play script is still for the user to walk.

## Model tiers

- Planner: opus (engine, policy, scene, art, balance)
- Step 01 baseline measurement: engineer sonnet, reviewer sonnet
- Step 02 area shapes: engineer sonnet, reviewer sonnet
- Step 03 elements, wards, monster spells: engineer opus, reviewer opus
- Step 04 routines, recharge, Troll: engineer opus, reviewer opus
- Step 05 area attacks, policy: engineer opus, reviewer opus
- Step 06 scene and foe info panel: engineer sonnet, reviewer opus
- Step 07 sprites: engineer opus, reviewer opus (visual judgement)
- Step 08 kinds, nests, map: engineer sonnet, reviewer sonnet
- Step 09 tune and document: engineer opus, reviewer opus
- Overall review: opus

## Verification

- Step 01 (0804545): guard 243 of 500 (was 238 before fdc0593/51cecb5); Troll Lair 218/500 at threat 4, 0/500 at threat 5. Review (sonnet) clean.
- Step 02 (1465f7a): summary identical to step 01. Review (sonnet) clean. Non-blocking, passed to step 03: no test of cone/line legality in `canCast`. Step 09: stale `areaHexes` in reference/campaign-to-level-20.md:116.
- Step 03 (405f8d5): summary identical (engineer and reviewer each re-ran). Review (opus) clean. Non-blocking, carried forward: drain heals from overkill damage (step 09 decides a cap); `drained` not in the simulator's healing tally (step 08/09); a warded mage still casts a fully-warded spell (step 09 checks vs Salamander); scene doesn't redraw the drainer's HP (step 06).
