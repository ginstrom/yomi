# The simulator and the balance

Loaded when working in `scripts/`: `simulate.ts` plays whole battles and campaigns headlessly (the same `BattleEngine` as the game) and `narration.ts` is the narration tool. The full detail (the campaign's policy errand by errand, guards and the hall, buying and runecraft, every statistic printed, `CampaignRecord`'s fields) is in `docs/reference/simulator.md`.

- The bands are the user's; never change them. They are in `.claude/skills/yomi-balance/bands.md`.
- Run one simulation at a time; its output goes under `logs/`. Flags and campaigns: `.claude/skills/yomi-balance/running.md`.
- `scripts/simulate.test.ts` holds a hash of the first 5 campaigns' events, so a change that moves play fails it; re-record it only when play is meant to move (`.claude/skills/yomi-balance/guards.md`).
- What a tuner needs to know: `.claude/skills/yomi-balance/levers.md`.
