---
name: yomi-balance
description: Yomi's balance bands, tuning levers, simulator runs and the refactor guard and policy snapshot. Use before changing anything that moves a battle or campaign outcome, or to measure or tune.
---

# Balance

Yomi's campaign and its cells were tuned against bands the user set. Use this before changing anything that moves a battle or campaign outcome. The full simulator detail (every flag, the campaign's policy, every statistic) is in `docs/reference/simulator.md`.

## When it applies

- Any change that moves an outcome: a foe, an encounter, its counts or band, healing, the party limit, the ready-made party.
- Hero growth: creation budgets, skill or perk points a level, what a node costs, a node, spell or technique, mana, the plans.
- Anything the refactor guard (`scripts/simulate.test.ts`) or the policy snapshot (`src/engine/policies.test.ts`) fails on.

## The order

1. Measure the baseline before the change (the `yomi-measure` agent, one run at a time; `bands.md` names the measures).
2. Make the change, with the levers in `levers.md`.
3. Re-measure with `yomi-measure` and compare with the bands. The user sets the bands; only the user changes a band.
4. If play moved, re-record the guards (`guards.md`), saying why. A measuring step updates the "Now" column.

## Files

- `bands.md`: the bands and their "Now" figures, the cell codes, the measure names `yomi-measure` takes.
- `running.md`: the flags, cells, campaigns, one run at a time, where each figure is printed.
- `levers.md`: what a tuner needs to know, and when to retune.
- `guards.md`: the refactor guard, the 50-campaign check, the policy snapshot.
