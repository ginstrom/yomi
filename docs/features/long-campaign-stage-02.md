# Feature: long campaign, stage 2 (special attacks and elements)

**Slug:** long-campaign-stage-02
**Phase:** 6. Report — done; awaiting the user on push/PR and the hand-walked play script

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
| 2026-11-01 | Spider Nest becomes threat-5 only (band 5–5) | user | three foes at 4 and 5; leave trivial at 4 | No map place fights it at 4; stage 9 can widen it |
| 2026-11-01 | Fix the AI's Fireball counting a fully-warded foe toward its two-foe rule (overrides plan correction 13) | user | leave for stage 4/12 | 475 of 1484 pool Fireballs hit only the Salamander for 0 |
| 2026-11-01 | Accept nest balance (spider 451, pool 470 of 500 at threat 5) and guard 248 (+5) | user | tune harder | Fair by the bandit cells' standard; move explained |
| 2026-11-01 | The foe hover panel gives each ability a short description (what it does, reach/area, damage or effect, recharge) — a change to the approved design's tooltip | user | names only | Simulated user learned Fire Spit and Web only by being hit |
| 2026-11-01 | Retune the Salamander Pool to about 445–470 of 500 after the Fireball fix took it to 493 | user | accept 493 | Keep it in the bandit cells' fair range |
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
- Step 04 (b104227): Troll Lair 222/500 at threat 4 (baseline 218), 0/500 at threat 5; guard 242 (baseline 243). Review (opus) clean; reviewer re-ran the threat-4 cell (222). Noted: the Troll's routine spends all 8 AP, so after a killing first claw it no longer steps on; a re-aimed strike goes to the nearest foe (per contract, no measurable effect).
- Step 05 (09b679a): summary identical to step 04 bar two new zero rows; reviewer also matched the full event logs (md5) against a step 04 build. Review (opus) clean. Non-blocking: no test of a fumble on a half-miss area; `drained` now counted in the simulator's healing (from step 03's note).
- Step 06 (b523a7f, 3b70c70): review round 1 (opus) clean with two panel fixes asked (panel stayed up over a control; panel drew from state ahead of playback), fixed in 3b70c70; round 2 clean. Reviewer saw the Troll's routine play as two strikes with "claws" log lines in a browser. Not yet seen: an AbilityEvent in a browser (step 08/09); cone/line sweep shows only a single flash (judge once visible).
- Step 07 (0daf6bf): orchestrator viewed battle-scale previews (both read clearly, distinct from kobold/troll). Review (opus) clean. Cosmetic, left: salamander tail flicks rather than sways; small foot lifts; one foot touches a leg outline in salamander walk_2.
- Step 08 (8b5cf18): spider_nest t4/L4 500/500, t5/L5 451/500; salamander_pool t5/L5 470/500; guard 248 (+5 vs 243). Fire Spit seen in a headless browser log (no console errors), not by eye. Departures: duplicate foe names renamed (Brood Spider, Kobold Stoker, Kobold Warden); band-growth test applies only when max > min. Review (sonnet) clean; passed to step 09: spider meanDamage exception reason is backwards (the routine is why); C7 slot rows not amended for the renames; magic.md:212 still lists Goblin Pillagers.
- Step 09 (0a2dbbc, 13d8e9a, 87dbbc3): guard 248 (+5, explained); no tuning kept at first; Drain Life capped at HP lost; play script walked headless (spread aim and retarget not seen). Review folded into the overall review.
- Overall review round 1 (opus) at 87dbbc3: clean; make test 984, build OK, browser 79/81 (failures from another agent's scratch file and a load timeout). Non-blocking: recharge count one high; manual wording on recharge and Web.
- QA round 1 (sonnet) at 87dbbc3: pass; saw the Salamander's spread aim and a routine retarget (seed 8), save/reload with recharge. Minor: recharge wording; crit/ward brackets.
- Simulated user (sonnet, hands-on) at 87dbbc3: all four goals met; fire-ward lesson learned from the log. Friction: abilities not described in the panel (user chose to add descriptions); panel overlapped a neighbour's name (title added); a reported web "MISSES" vs webbed mismatch investigated — not a bug (earlier web).
- Fixes c8c23b5, 5c205f3, 13ddea9, 7539056, c33acc4, a176ad4 (engineer opus): spider nest threat 5 only; area-spell rule ignores fully-warded foes (pool went 470→493); one bracket for crit+ward; panel title, recharge "ready next turn", generated descriptions; manual; Fire Spit 3d6→4d6+2 (pool 456, guard 248).
- Overall review round 2 (opus) at a176ad4: clean; make test 993; browser debug 4/4, battle 11/11. Two doc nits fixed by the orchestrator.
- QA round 2 (sonnet) at a975aa9: pass; recharge wording right through each cycle; panel readable at 840×560 and full size. Not seen live: a warded critical log line (unit-tested).
- Not done by any agent: the play script walked by hand by the user.
