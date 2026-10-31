# Feature: world-map party list, and hero figures that show worn gear

**Slug:** party-list-and-gear-looks
**Phase:** 5. Verification

## Request (user's words)

> Let's address the feedback: on the world map we should have a list of deployed parties on the right side of the map, and clicking on one of those icons should center us on the party, and make that party the displayed one on the left; 2. we should allow healing on healthy ally; 3. character portrait should change dynamically with gear; 4. story and tutorial are looking great; we will fill in text later.

Follow-up to `ui-feedback-drag-pan-cursor` (simulated-user findings).

## Links

- Design: `docs/designs/party-list-and-gear-looks.md` (approved by user 2026-10-31)
- Plan: `docs/implementation-plans/party-list-and-gear-looks/index.md` (4 steps)
- Branch: `armor-resistance` (current; CLAUDE.md says commit on the current branch)

## Path

Medium: design, plan, implement, verify. No architecture brief: the party list is scene-level, and the gear looks are art plus `unitLook`/`UnitFigure` layering.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-10-31 | Healing a full-health ally stays allowed; no change | user | grey out / confirm | User's call |
| 2026-10-31 | Story/tutorial placeholders left as they are | user | — | Text comes later |
| 2026-10-31 | Party list built now for the single party, shaped so stage 06's parties add entries | user | do stages 05–06 first; fold into stage 06 design | Gets the UI now without the multi-party refactor |
| 2026-10-31 | "Portrait changes with gear" = the body figure (inventory doll, battle units, map figure): bare body + armour/head/cloak overlays by worn item; face portraits stay fixed | user | also face portraits; portraits only | Far less art; the doll is where the mismatch shows |
| 2026-10-31 | Skip architecture | orchestrator | brief | No new components or contracts beyond scene helpers |
| 2026-10-31 | No default horned helm; heroes show only worn gear (helm pixels kept for stage 03's Helm) | user | default helm when head empty | Design default |
| 2026-10-31 | Single party labelled "Your party" until stage 06 names parties | user | "First Company" | Design default |
| 2026-10-31 | Design approved (right strip 80px, map view narrows; bare warrior + breastplate/circlet/cloak overlays) | user | — | — |

## Open questions

Both designer questions answered with defaults (see log). Stage 05/06 design wording edits listed in design §5.4 are not made — for a later decision.

## Model tiers

- Designer: opus (art layering plus UI that must anticipate multi-party)
- Planner: opus (art + scene layout + multi-file refactor)
- Step 01 party list: engineer opus, reviewer opus (scene layout/input)
- Step 02 bare body + gear sprites: engineer opus, reviewer opus (art-heavy, needs visual judgement)
- Step 03 hero look code: engineer opus, reviewer opus
- Step 04 manual + screenshots: engineer sonnet, reviewer sonnet
- Overall review: opus
- Steps run sequentially on one branch (02 and 03 must not ship apart)

## Verification

- Step 01 (c90b008): review round 1 (opus) changes needed — party entry drawn above outcome shade (blocking) + 4 non-blocking; fixed in 4058b11 (also fixed pre-existing 0×0 outcome shade that never blocked input). Round 2 clean. Minor leftover: hover summary may not reappear on leave-and-return to the same entry (not fixed).
- Step 02 (3a6c5a4): orchestrator viewed previews (fine); brown cuffs accepted (orchestrator). Review round 1 (opus) clean. Non-blocking, passed to step 03: cape shows only as a doubled outline above row 19; cape wider than designed; bare body all one brown (hair reads like a hood); index hash missing.
- Step 03 (103885e, 08185ad): orchestrator viewed screenshots (fine). Review round 1 (opus) clean, incl. swing, hit outline and fallen fade seen in a browser. Non-blocking, folded into step 04: cape-edge wording (col 25 vs 26 rows 13–15); coverage test could require a cloak back sprite. Hit tint on layers added mid-tint: accepted.
- Step 04 (a05b1f4): manual + 22 screenshots retaken in podman (all content changes; 10 overlay shots kept because the map behind changed — orchestrator decision). Step review folded into overall review. Design §7 hand checks not redone by engineer; QA/sim user cover them.
