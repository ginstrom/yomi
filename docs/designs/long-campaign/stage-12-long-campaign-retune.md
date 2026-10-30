# Stage 12: The long-campaign retune

Part of [the long campaign](index.md). Reference: section 6 and section 7.2 of each design in [`reference/`](reference/).

## 1. Purpose and status

Every system is in: rings to 20, the full roster, gear to tier 5 with runes, the economy with routes, and the company. This stage tunes them together toward the measure the game has always used: **a careful company beats the Source about two times in three.** It then rewrites the documentation for the long campaign.

It adds no new mechanics, only the measurements and tools needed to tune them, and the numbers themselves.

**Status:** ready for planning once stage 11 is done.

## 2. Scope

**In:**
- **The yardstick from expected kit.** `foeYardstick` is re-measured from `expectedKit` (gear §5.8), so the foe blocks are judged against the gear a party has at that level. Blocks outside their bands are retuned or named as exceptions with a reason.
- **One simulator policy.** The company roles (stage 6), the gear policy (stage 10), the rune policy (stage 4) and the economy errands (stages 7 and 8) are checked together:
  - the guard defends routes;
  - the vanguard reinforces through meetings;
  - home visits buy, forge and rune in a stated order.

  Any conflicts found are resolved in favour of the simpler rule, and the order is recorded in CLAUDE.md.
- **The headline.**
  - `make simulate ARGS="--campaign --battles 500 --seed 1 --log none"` with `SOURCE_READY_LEVEL` 18. The target is about 2 in 3 beating the Source.
  - Secondary targets:
    - most campaigns reach level 18 or more before the Source;
    - no ring is won 100% by a party of its own level with expected kit;
    - the vanguard's walking days drop compared with `--parties 1`;
    - the waiting check holds;
    - gear tracks the expected kit within a tier.
- **Levers, in order:**
  1. foe counts per band;
  2. a ring's foe blocks;
  3. ring widths and nest counts (pacing);
  4. economy sources (yields, route income);
  5. the blight (`BLIGHT_THREAT_CAP`, road and fort strength);
  6. the Source's guardians.

  Each change is recorded with its effect, as CLAUDE.md's rules of scaling do today.
- **The early-game figure** (`--ready-level 7`) is re-measured and kept as the regression guard for later work.
- **Documentation.**
  - CLAUDE.md's rules of scaling are rewritten for rings, bands, native levels, the yardstick and expected kit, with the new headline and history.
  - Its architecture section covers `catalog.ts`, `runes.ts`, `runecraft.ts`, `loot.ts`, `trade.ts`, `company.ts`, `abilities.ts` and `bandits.ts`.
  - Its simulator flags and record are updated.
  - The manual: the rings and foes, gear and runes, the economy, the company.
  - [`../blight.md`](../blight.md) §5.4 and [`../guild-hall-and-watchtowers.md`](../guild-hall-and-watchtowers.md) §8 are marked as answered.
  - [`index.md`](index.md) gets a closing status.
- **The manual's screenshots** are retaken (`npm run manual:screenshots`).

**Out:** new mechanics. Anything the tuning shows is missing goes into a new design, not into this stage.

## 3. Requirements

| ID | Requirement |
| --- | --- |
| S12-R1 | The yardstick is measured from expected kit, and every kind is within it or a named exception. |
| S12-R2 | The simulator's policies are checked together, with their order recorded. |
| S12-R3 | The headline and secondary targets above are met, or their gaps are explained in CLAUDE.md. |
| S12-R4 | The early-game guard is re-measured and recorded. |
| S12-R5 | The documentation listed above is updated. |

## 4. Verification

**Simulator:** the headline run and the secondary measures, from seed 1. A second seed (seed 2) confirms the headline is within a few points.

**Play script:** a full campaign played by hand, at least to the threat-12 ring, with notes in the stage's implementation notes on:
- pacing: days and battles per ring;
- the company's feel: time spent in guard battles, and whether auto-resolve is needed (company §8.3);
- the economy: what was always short and what piled up;
- the blight: did roads and forts make it too easy?
- gear: did each tier feel earned, and did runes create real choices?

The notes are the input to whatever comes next.

**Done when:** the headline is met or explained, the documentation is current, and the play notes are written.
