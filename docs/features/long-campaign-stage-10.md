# Feature: long campaign, stage 10 (forging and the high tiers)

## State

- Request (user's words):
  > The next thing is stage 10 of the long campaign: forging and the high tiers. Its design is docs/designs/long-campaign/stage-10-forging-and-high-tiers.md and it is marked "ready for planning". [...] As with stages 2–9, the approved stage design goes straight to the planner. Start with the bookkeeping commit, then cut a long-campaign-stage-10 branch off main and run the orchestrator. Early figures, the refactor guard and the 50-campaign check run with --near-source as in stage 9. Balance bands are mine to change: bring any out-of-band figures to me.
- Slug `long-campaign-stage-10` · Phase 3, planning · Phase 4 · Next action: step 11 (document and play); then verification · Branch: `long-campaign-stage-10`, off main at 4d51a8b (stage 9 merged as PR #11).
- Path: Large, but the stage design is the approved design. Straight to planning, as stages 2–9 did.
- Links:
  - Stages overview: `docs/designs/long-campaign/index.md`
  - Design: `docs/designs/long-campaign/stage-10-forging-and-high-tiers.md` (status "ready for planning")
  - Previous stage: `docs/features/long-campaign-stage-09.md`
  - Plan: `docs/implementation-plans/long-campaign-stage-10/index.md` (11 steps, 25dee5a)
  - Plan log (history): `docs/implementation-plans/long-campaign-stage-10/log.md`
  - Summary page: `.git/orchestrator/long-campaign-stage-10/summary.html`, https://claude.ai/artifact/L6b8hMdWK1tF9VNUu4cdag
- Open questions: none. Plan questions 1–6 answered 2026-11-23 (decision log); step 02's engineer records them in the index.
- Tiers (engineer / reviewer): planner opus. 01, 06 sonnet / sonnet; 04, 05, 08, 11 sonnet / opus; 02, 03, 07, 09, 10 opus / opus. No escalations.
- Worktrees: 05, 06, 08 ran in worktrees, merged dd96b2c, 32b401d, 9c0f04c. Steps 01–08 clean, 1 review round each (log.md).
- Verification: not started.
- Carried forward, for this plan (from the user):
  - Mithril and the far ores/woods have no use yet (sell only); the simulated player noticed mithril has no stated use.
  - Rune ranks 3–4 drop and embed but can't be fused into.
  - Far bandits wear Masterwork steel from threat 8 (`banditGear`) as a stand-in.
  - Auto-resolve estimate shows "(…)" ~2 s for parties of level 12+; higher-tier gear will make it more common: see whether it can be made faster.
  - Debug `xp` caps at 50000 (~level 12); the play script needs level 15+.
  - The world map header's stock can run to 3 lines at 840 wide, partly under the party column (from the stage 9 PR).
- Not this stage (stage 12): market income; the simulator's spend order; full-campaign route figures; the company's long-campaign policy skew; home-country spawns in the long campaign (~14%, 8.3 a campaign); the accepted early figures (one 288, company 289, one's days 331). Source Guardians stay at SOURCE_FOE_LEVEL 6 until stage 11. Not urgent: placeholder opening story; `locations all` cut off in a normal window.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-23 | Skip architecture and design; the stage design is the approved design | user | new design | Marked ready for planning; precedent stages 2–9 |
| 2026-11-23 | Own branch `long-campaign-stage-10` off main after PR #11 merged | user | branch off stage 9 | One branch and PR per stage |
| 2026-11-23 | Early figures, refactor guard and 50-check run with `--near-source` | user | — | As in stage 9 |
| 2026-11-23 | Plan Q1–3: robes Mithrilweave/Adamantweave/Starweave from the tier's ore; Mithril and Starmetal halve the spell-skill penalty as well as strength relief; bandits Fine at threats 9–17, Masterwork from 18 | user | robes stop at Silk; relief only | Planner defaults; follow the gear reference |
| 2026-11-23 | Plan Q4–5: trophies table empty until stage 11 (hide tiers 4–5 via debug only; wyvern hide from Elder Glade); partners' goods from contacted, unsilenced partners, any whole amount, 3 gold; simulator never buys | user | more partner stand-ins | Design's scope |
| 2026-11-23 | Plan Q6: the simulator applies families by role only from tier 3, keeping today's early policy | user | stop and ask at step 09's gate | Keep the early figure from moving |
| 2026-11-23 | Accept the planner's other departures (index decisions) and tiers | orchestrator | — | Routine engineering choices |
| 2026-11-23 | Step 10: accept the long campaign's gear lag until stage 12 (kit "Done when" clause unmet: Source 1/100, main hand tier 1 at level 10); add a report-only kit line over forge-ready campaigns; stage 12's candidates: keep weak parties off strong targets, forge for the vanguard, workshop before post, workshop level-2 stone cost | user | fix targeting now; cheaper workshop; workshop first | Cause is the simulator's targeting and spend order (stage 12), not the design's levers |
