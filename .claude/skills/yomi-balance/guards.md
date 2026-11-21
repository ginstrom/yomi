# The guards

## The refactor guard

`scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1 with `--parties 1`, each `CampaignRecord` and a SHA-256 of every battle event, against a fixture. A change that moves play fails it. Re-record it only when play is meant to move, with the old and new figures in the doc comment above `GUARD_RECORDS`.

The guard pattern, for a plan of steps: the steps that must not move play never edit the fixture and keep it green (a mismatch means the step changed play: find the cause and fix it); one step, named in the plan, re-records it.

## The 50-campaign check

A step that touches the domain or the simulator runs this before committing, with a baseline taken before the change, and records "identical" or the diff:

```sh
npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
shasum -a 256 logs/guard-50.jsonl
```

## The policy snapshot

`src/engine/policies.test.ts` holds a snapshot of today's encounters' choices. A change that moves a monster's or bandit's choice fails it; re-record it only when the change is meant, and say why in the test's title as earlier re-recordings do. The refactor guard will usually move too.
