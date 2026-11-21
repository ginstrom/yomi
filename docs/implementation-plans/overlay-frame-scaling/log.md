# Overlay frame scaling: log

- 2026-11-21 Step (design as the step) `039dc70`: engineer sonnet, reviewer sonnet, verdict clean, 1 round. npm test 99 files / 2425 tests; build ok. Non-blocking: no e2e for tooltips at 2x; hand look given to QA.
- Browser suite: the engineer's 3 full runs each had 1-2 long-battle 60 s timeouts (character tier-2, saves "deletes the slot", debug "fights any encounter"), all passing alone, under load. The reviewer's lone full run: 177/178; `saves.test.ts` "lists the three slots under Load" failed with `uncaught: Cannot set properties of null (setting 'volume')`; the file passes alone at HEAD and at `039dc70^`. Read as a pre-existing load-sensitive flake; the sound null is worth a look.
- QA (sonnet) at `6a950a7`: 8 screens pass at 1920x1080 and 1280x800, 2560x1440 scale 2, Exchange 1x at 1080p; 58 screenshots in `.git/pr-review/long-campaign-stage-07/evidence/`. Unchecked: DPR > 1, 840x560.
