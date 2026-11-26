# Step 03: The golem's immunity

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-11-high-roster.md) (§2 "Blocks and abilities", §3 S11-R4, §5 "Versions") · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.5 (the Stone Golem's row) · [Battle reference](../../reference/battle.md) · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) adds one engine rule that must reach every path a status is laid by, without adding or dropping a draw, and bumps the log schema; the reviewer (opus) checks every laying path is covered, the RNG order is untouched, and the guard, the snapshot and the 50-campaign hash did not move.

## 1. Objective

Add `CombatantStats.immune?: true`: a unit with it never has a status laid on it whose `StatusRule` has a `tick` (today Poisoned and Corroded). The refusal is recorded on the event (`immune: true`), the log says so, and the AI values such a status at 0 on an immune unit. No unit has the flag yet: the Stone Golem takes it in step 11. Play does not move.

## 2. Requirements and context

- **S11-R4** (design §3): the golem's immunity flag.
- **Design §2:** "The Stone Golem's immunity to ticking statuses is a `StatusRule`-independent flag, `CombatantStats.immune`, checked when a status is laid. It is the one small engine addition."
- **Design §5, Versions:** "`LOG_SCHEMA_VERSION` is bumped only if a new event field is needed (the immunity's log line)."
- **Campaign §5.5:** Stone Golem, native 14, res 8, "Slam; immune to statuses that tick".

### Decisions from the index (unchanged)

12. **The immunity** (step 03): `CombatantStats.immune?: true` means no status whose `StatusRule` has a `tick` (today Poisoned and Corroded) is laid on the unit; checked in the one place a status is laid; the outcome records `immune: true`, so `LOG_SCHEMA_VERSION` 26 → 27; the policy values such a status at 0 on an immune unit. No `SAVE_VERSION` bump for it (a missing field reads as none).
15. **The refactor guard and the 50-campaign check stay identical through every step**: `--near-source` drops every fixed nest above threat 5, the near-home Source is unchanged (decision 3), and new `SPAWN_KINDS` are appended with `fromThreat: 7`. If a step moves either, it finds the cause; if the cause is only far spawns' kinds reaching the early campaign, it stops and brings it to the orchestrator (a re-record then needs approval and goes in that step). No step is planned to re-record the guard.
16. **The policy snapshot** (`src/engine/policies.test.ts`) iterates over every encounter, so **each ring step re-records it**, proving only its new encounters' lines were added (every earlier line unchanged), and step 13 re-records it with only `source_guardians` lines above threat 5 changed. Each says so in the test's title.
17. **Versions:** `SAVE_VERSION` 31 → 32, 33, 34, 35, 36 in the ring steps 08 to 12 (each changes fixed locations; no migration, older saves read as unreadable); step 13 changes no fixed location (no bump). `LOG_SCHEMA_VERSION` 26 → 27 in step 03 only.
20. **Out of scope:** the deferred behaviours (decision 11), ring-element armour wards in the gear policy, the simulator's spend order and targeting, market income, sounds beyond reusing today's cues (a new cue is allowed only through the `yomi-sound` skill), the trading post selling tier 3+.

This step re-records nothing: no unit has `immune`, so the policy snapshot is unchanged (decision 16 applies to the ring steps).

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file; `npm run build` before a ring step's commit;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` first;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 08–14 run them, in order). Measurements go through the `yomi-measure` agent. Long runs: 100 campaigns took 4 minutes alone in stage 10, up to 20 under load.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, args `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`; `GUARD_RECORDS`, `GUARD_EVENTS_SHA256`. Rules: `.claude/skills/yomi-balance/guards.md`. Every step keeps it green and unedited (decision 15).
- **The 50-campaign check** before committing a domain or simulator step (02, 03, 08–13, 14 if anything changed), against the hash before the step (step 01's, `log.md`), recorded "identical" or the diff in `log.md`:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG for an existing encounter. New spawn kinds are appended (`.claude/skills/yomi-add-content/encounter.md`). The immunity draws nothing. Favoured runes draw from the loot stream, as today.
- **Import cycles.** `src/combat/` imports nothing from `src/game/` or `scripts/`.
- **Content checklists** (`.claude/skills/yomi-add-content/`): `status.md` and `battle-event.md` (this step).
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on `long-campaign-stage-11`, without pushing; files staged by path. Messages "Stage 11 step NN: <title>". No attribution lines.
- **Docs.** Each step fixes the CLAUDE.md lines its change makes wrong and searches the CLAUDE.md files, `.claude/` and `docs/reference/` for every name it renames or removes. `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB.

## 3. Dependencies and prerequisites

- **Step 01** done: its 50-campaign hash in `log.md` is this step's reference. Step 02 may be in progress, but never run a simulation while step 02's runs (one simulation at a time).
- **Existing (inspected at `1a008af`):**
  - `src/combat/combat.ts`: `CombatantStats` (its optional fields, e.g. `wards`, `regeneration`, `blightborn?: true`), `sameCombatStats` (compares every field that matters; it must compare `immune`).
  - `src/combat/spells.ts`: `STATUSES: Record<StatusId, StatusRule>`; `StatusRule.tick?: DamageRoll` (with `tickName`, `element`). Today the statuses with a tick are `poisoned` (1d6, poison) and `corroded` (1d4, acid; also −5 AC, −2 resistance, stops regeneration). A rule that reads "ticks" reads `STATUSES[id].tick !== undefined`, not a list of ids.
  - `src/engine/battleEngine.ts`, `LOG_SCHEMA_VERSION = 26`; the status-laying paths to cover:
    - a hostile spell's and a rolled area ability's outcomes (`CastOutcome.status?: ActiveStatus`, shared by `cast` and the ability path through `strikeUnit` / `aftermath`);
    - a routine's strikes with a `status` (`Strike.status`, e.g. `spider_bite`'s Venom Bite laying `poisoned`);
    - on-hit (rune) statuses laid after damage (Venom rank 2+ lays Poisoned on a critical; Ember rank 3+ Seared; Rime Chilled), and technique strikes' `onHit`;
    - `auto` areas and `foeStatus` abilities that lay with no roll (Taunt, Hunter's Mark: none ticks today, but they go through the same check);
    - `formatEvent`, the on-screen line.
  - `src/engine/policies.ts`: `STATUS_VALUE` and the scoring of a status in area, spell, strike and technique choices.
  - `src/scenes/foeInfo.ts`: the foe hover panel, which describes a foe from its data.
  - `src/engine/CLAUDE.md` ("RNG discipline": what never draws), `docs/reference/battle.md` (statuses, the event fields).
- **Produced for later steps:** the `immune` field and its behaviour, which step 11 sets on `stone_golem` (with wards poison 99). Contract, as decision 12 above.

## 4. Scope and guidance

1. **Test first** (`src/engine/battleEngine.test.ts` or beside the existing status tests): an injected block with `immune: true` (for example a goblin's) and a scripted RNG. For each path of §3 a hit that would lay a ticking status lays none and records `immune: true`; a non-ticking status (Seared, Chilled, Cursed, Webbed) is still laid on it; a unit without the flag is unaffected. Assert the RNG draws are the same count and order with and without the flag (the same scripted sequence consumed).
2. **The field:** `immune?: true` on `CombatantStats`, its doc comment saying what it means (statuses whose rule has a `tick` are never laid); `sameCombatStats` compares it.
3. **One helper** (e.g. `canLay(stats, status)` or `refusesStatus`) deciding whether a status can be laid on a unit, in `src/combat/` or the engine, read by every laying path and by the policy, so they agree (the engine guide's "one helper, many readers").
4. **The event:** where a status would have been laid and is refused, the outcome or attack event carries `immune: true` (on `CastOutcome`, and on `AttackEvent` for strike and on-hit statuses; only when a status was refused, left out otherwise). Bump `LOG_SCHEMA_VERSION` 26 → 27. `formatEvent` adds a short line, e.g. "Stone Golem is unaffected." Follow `battle-event.md` (the scene's log, floating text if it shows statuses, any consumer that switches on fields).
5. **The policy:** a ticking status is worth 0 on an immune unit wherever `STATUS_VALUE` is added (its damage is still scored; wards already reduce it). With no immune unit in any encounter the snapshot must not move.
6. **Snapshots:** `BattleEngine.restore` of a snapshot whose stats lack `immune` reads it as none; no `SAVE_VERSION` bump (decision 12). A test restores such a snapshot.
7. **Foe hover panel:** if cheap, `foeInfo.ts` adds a line such as "Immune to poison and acid" for a unit with the flag (derived from the ticking statuses' `tickName`s). Optional; if done, a unit test, and run `npm run test:browser` only if a scene file other than the helper changed.
8. **Docs:** `docs/reference/battle.md` (the flag, the event field, log 27), `src/combat/CLAUDE.md` or `src/engine/CLAUDE.md` only if a line becomes wrong (note "the immunity draws nothing" under what never draws), `.claude/skills/yomi-add-content/status.md` (a new ticking status is refused on immune units).
9. **Exclusions:** no unit gets `immune` (step 11 does); no new `StatusRule` field; no change to any block, encounter or constant; no draw added, dropped or reordered.

## 5. Verification

- `npm test` passes with the new tests (red first: record the failing run).
- The refactor guard green with `GUARD_RECORDS` and `GUARD_EVENTS_SHA256` unedited; the policy snapshot green and unedited.
- The 50-campaign check (§2's command, `--out logs/s11-03-guard-50.jsonl`): SHA-256 **identical** to step 01's; recorded in `log.md`. (The JSONL carries `LOG_SCHEMA_VERSION` only if `battle_start` records it: if the hash moves only because the schema number is written, show that the events otherwise match and record it; anything else is a finding.)
- `npm run build` passes.

## 6. Completion criteria

- [x] `CombatantStats.immune`, compared by `sameCombatStats`, read through one helper by every status-laying path and by the policy.
- [x] `immune: true` on the event when a status is refused; `formatEvent`'s line; `LOG_SCHEMA_VERSION` 27.
- [x] Tests for every path, the non-ticking statuses, unchanged draws and a restored snapshot without the field.
- [x] Guard and snapshot unedited and green; the 50-campaign hash identical to step 01's (or explained as above), recorded in `log.md`.
- [x] Docs as §4.8.
- [x] One commit, "Stage 11 step 03: the golem's immunity", files staged by path, no attribution lines; the index's row 03 updated with status and commit.

## 7. Execution record

### Engineer

Code commit `d94188b` "Stage 11 step 03: the golem's immunity" (a record-only commit follows).

**Built**

- `CombatantStats.immune?: true` (`combat.ts`), compared by `sameCombatStats`; `refusesStatus(stats, status)` (`spells.ts`): the unit is immune and the status's rule has a `tick`.
- Engine: `layStatus` returns null, changing nothing, where `refusesStatus`; `laidOn` wraps it for outcomes (`{ status, immune? }`). Read by `strikeUnit` (hostile spells, rolled areas), the friendly cast, the `auto` area, `statusAbility` (`foeStatus` / `selfStatus`), and the attack path (the strike's status and each on-hit status). `immune?: true` on `CastOutcome` (its `status` null) and on `AttackEvent`, only when a status was refused. `LOG_SCHEMA_VERSION` 27. `formatEvent`: "…, unaffected by the rest." after a hit's damage; "Golem is unaffected" where nothing else landed.
- Policy: `statusWorth` is 0 where refused; `areaCast`'s status-only count and `statusArea` skip units that refuse the status (`canLay`). The snapshot is unedited.
- `foeInfo.ts`: "Immune to acid and poison" (helper only; no scene file changed, so no browser run).
- Docs: `docs/reference/battle.md` (Immunity; the policy's lines), `docs/reference/scenes.md`, `src/engine/CLAUDE.md` (what never draws), `.claude/skills/yomi-add-content/status.md`.
- Tests: `src/engine/immunity.test.ts` (21; red first, 15 failing before the code): every path with and without the flag (same draw count, same events but for the status fields), the non-ticking statuses, the log lines, a restored snapshot with and without the field. The rolled area ability, the `auto` area and the `foeStatus` paths lay no ticking status in today's data, so the test injects three abilities for them. Also `policies.test.ts` (2, red against the old `policies.ts`), `combat.test.ts`, `foeInfo.test.ts`; the version assertions moved to 27.

**Deviation (approved by the orchestrator, option A): the events hashes re-recorded.** Every `battle_start` writes `schemaVersion`, so log 27 alone moved `GUARD_EVENTS_SHA256` (`e4dd3391…fb6394` → `0b0f4c20…e961af`), the 18 `logs` digests of `src/game/forecast.test.ts` and the 50-campaign hash. Play did not move; the proof table is in `log.md` (step 03). `GUARD_RECORDS`, the forecast tallies and the policy snapshot are untouched and green. Index decision 15 carries the exception. **Later steps compare the 50-campaign check against `1e85d023a1b58697ec36724720f6ad5ba8b4a5dc2362f4ff6b22605ce37ed216`.**

**Runs**

| Run | Result |
| --- | --- |
| `npm test` before the re-record, schema 27 (runlog #33) | 19 failed, the events hashes only |
| `npm test`, version held at 26 (runlog #34) | guard, snapshot and digests pass against the old constants |
| 50-campaign check (`logs/s11-03-guard-50.jsonl`; `…-schema26.jsonl` kept beside it) | `1e85d023…ed216`; `57fdea15…e53e75` at schema 26, identical to step 01's |
| Gate, clean tree at `d94188b`: `npm test` (runlog #58) | 2777 passed |
| Gate, clean tree at `d94188b`: `npm run build` (runlog #59) | passed |

Runlog #35 to #55 are `npm test` runs that failed on test timeouts alone (no assertion) while the host was loaded by another worktree's runs; #56 and #57 passed on the same tree once it was quiet.

**For later steps**

- Step 11 sets `immune: true` on `stone_golem`; the manual's "Hover over a monster" paragraph should then mention the "Immune to …" line (noted in `11-ring-15.md`).
- A new ticking status is refused with no further code; lay statuses only through `layStatus` / `laidOn`.
- The log line names no status ("unaffected by the rest"); the event carries only `immune: true`.
