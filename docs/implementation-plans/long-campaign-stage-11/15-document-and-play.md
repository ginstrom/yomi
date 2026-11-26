# Step 15: Document and play

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-11-high-roster.md) (§4 What the player sees, §6 Verification, "Done when") · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.5, §5.2, §4.2 · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.3, §4.5, §4.6 · [Stages index](../../designs/long-campaign/index.md) ("Docs", "Gameplay verification", "Sprites", "The early-game guard") · [Plan log](log.md)

**Difficulty:** sonnet / opus. By this step every rule, constant and figure is decided (steps 01–14), so the engineer (`model: "sonnet"`) writes them down and walks the play script; it judges no balance. The reviewer (opus, model unset) checks the docs against the code, the figures against step 14's record and `log.md`, and that the play script was really walked.

## 1. Objective

Close the stage:
- bring the CLAUDE.md files, `docs/reference/`, the balance and add-content skills, the manual and its screenshots up to date with steps 01–14;
- write the stage design's "Implementation notes" (step 14's figures and the departures) and mark stage 11 in the stages index;
- walk the design's play script in the real game and record what was seen.

No rule, constant, count or band changes here. If the docs or the play script show a bug, fix it test-first only if it is small and in this stage's code; otherwise stop and report it. A fight that seems unfair (won every time, or never) is recorded and brought to the orchestrator, not tuned.

## 2. Requirements and context

- **Stages index, "Docs":** each stage updates CLAUDE.md (architecture, rules of scaling, simulator flags) and the player's manual for what it adds, and on completion adds a short "Implementation notes" section to its own design doc, with the figures measured.
- **Stages index, "Gameplay verification":** a stage is done when its tests pass, its simulator checks hold and its play script has been walked in the game. **"Sprites":** a stage is not done while a unit falls back to a placeholder.
- **Design "Done when":** every ring's kinds, nests and sprites are in, all tests pass, the per-ring cells are fair, the long run is recorded, and every new encounter has been fought in play.
- **Design §6, Play:** `fight <encounter> <threat>` for each new encounter with a party levelled and kitted (`xp` or `level`, `give`). Check each ability fires, its log reads well, and the sprite reads clearly.
- **Design §4, what the player sees:**
  - Ring 7: wolves run down the archer; worg riders strike spear and bite in one action; an ogre sweeps everyone beside it.
  - Ring 15: a Young Dragon's fire breath scorches the front rank; a party with Ember wards shrugs off a third of it; its scales forge drake-scale leather.
  - At the Source: the Horror breathes blight around itself, corroding armour, and regenerates unless seared or corroded.

### Decisions from the index this step documents (unchanged)

1. **Encounter compositions and first counts** *(for the user, Q1)*: the design names each encounter's band but not its foes or counts. Default: C5's table (lead kind first, minions from the same or nearer rings), first values that the ring's step tunes against its cells.
2. **Each ring's nests** *(for the user, Q2)*: nests keep their positions and unique loot, and change encounter, id and name; each ring keeps its nest count; bandits keep about a third (2 of 5 in rings 7 to 15, 1 of 4 in ring 18). Spiders and salamanders leave the fixed nests of rings 7 and 9 (they still spawn there). Table: C6.
3. **The Source at 20** *(for the user, Q3)*: a new kind `source_horror` ("Blight Horror", native 20, its own sprite) leads two Blight Cultists at threat 20. **The near-home Source keeps today's `horror` block and slots for threats 1 to 5**, so `--near-source` (the early figures, the refactor guard, the 50-campaign check) fights exactly as before. `SOURCE_FOE_LEVEL` and `maxFoeLevel` are removed. C7.
4. **The cells' reading of "most but not all"** *(for the user, Q4)*: per-ring cells are report-only (the user's bands are not extended); the plan's working reading is **300 to 475 wins of 500** at both band ends, with `--player-kit expected`, a party of the threat's level. A ring step tunes only its own encounters toward it, at most three trials an encounter, then reports. C9.
5. **The yardstick for the new kinds** *(for the user, Q5)*: stage 12's measurement is not ready, so the new kinds are held to a **kitted** fighter growth table measured once in step 02 from `expectedKit` (the "stage 10 `expectedKit` readings" of the design); today's kinds stay on today's bare table, unchanged. C2.
6. **Favoured runes of the new nests** *(for the user, Q6)*: in `FAVOURED_RUNES` (it exists, `loot.ts`): `wyvern_roost` venom, `basilisk_lair` rime, `blight_cult` and `blight_lich_court` storm, `young_dragon` and `elder_wyrm` ember; none for the rest and none for the Source (its encounter id is also the near-home Source's).
7. **Blight Breath** *(for the user, Q7)*: element `blight` (gear §4.6; campaign §5.5's "acid" is read as its Corroded), lays Corroded, **foes only** (the Horror's guardians are the blight's own).
8. **Worg Riders' band is 7 to 9** *(for the user, Q8)*, not the design's 6 to 9: the Worg Rider is native 7 and campaign §5.3 keeps every band's minimum at or above its kinds' native levels. No ring has threat 6, so play is the same either way.
9. **Sprites: 13** *(for the user, Q9)*: the design says 14; its table names 12 new kinds, and the rebuilt Horror is a 13th (decision 3). The plan draws 13.
10. **`--player-kit expected`** *(for the user, Q10)*: each member wears `expectedKit(level)`'s tier at the **low** end of each range (grade, runes filled, rank), in the families stage 10's gear policy picks by role, and the war hammer when the encounter's lead foe has resistance 4 or more; weapon runes Ember then Stone, armour runes Stone then Life (no ring wards: gear §5.8 step 3 stays out). C1.
11. **Sweep and Rock use existing ability fields** (no engine addition beyond the immunity, design §2): Sweep is an area centred on the ogre, radius 1, foes only, through resistance; Rock is a burst of radius 0 at range 4, through resistance. **`throughResistance` means cut by resistance, as a blow: give the kind `armorPierce`, or omit the flag to ignore resistance** (found in step 08; without it only the element's ward cuts an area; breaths keep no flag). If either cannot be built from today's fields, the ring step stops and reports. The wolf's pack bonus, the wyvern's flight and the wight's half damage from non-magic weapons stay out (plain blocks).
12. **The immunity** (step 03): `CombatantStats.immune?: true` means no status whose `StatusRule` has a `tick` (today Poisoned and Corroded) is laid on the unit; checked in the one place a status is laid; the outcome records `immune: true`, so `LOG_SCHEMA_VERSION` 26 → 27; the policy values such a status at 0 on an immune unit. No `SAVE_VERSION` bump for it (a missing field reads as none).
13. **Blightborn:** the Blight Cultist, the Blight Lich and `source_horror` are `blightborn` (Dawn's bane applies), as `horror` is.
14. **Trophies** (gear §4.3) land with their kinds: wolf and worg_rider wolfhide 1 (ring 7), wyvern wyvern_hide 3 (ring 9), basilisk basilisk_scale 3 (ring 12), young_dragon drake_scale 6 (ring 15), elder_wyrm drake_scale 10 (ring 18). **Elder Glade's stand-in** (`STAND_IN_GOODS`) is removed in ring 9's step, when wyverns drop wyvern hide.
15. **The refactor guard and the 50-campaign check stay identical through every step**: `--near-source` drops every fixed nest above threat 5, the near-home Source is unchanged (decision 3), and new `SPAWN_KINDS` are appended with `fromThreat: 7`. If a step moves either, it finds the cause; if the cause is only far spawns' kinds reaching the early campaign, it stops and brings it to the orchestrator (a re-record then needs approval and goes in that step). No step is planned to re-record the guard.
16. **The policy snapshot** (`src/engine/policies.test.ts`) iterates over every encounter, so **each ring step re-records it**, proving only its new encounters' lines were added (every earlier line unchanged), and step 13 re-records it with only `source_guardians` lines above threat 5 changed. Each says so in the test's title.
17. **Versions:** `SAVE_VERSION` 31 → 32, 33, 34, 35, 36 in the ring steps 08 to 12 (each changes fixed locations; no migration, older saves read as unreadable); step 13 changes no fixed location (no bump). `LOG_SCHEMA_VERSION` 26 → 27 in step 03 only.
18. **First values for each kind** (XP, natives, defences, specials): C3 and C4. The ring step authors each block against the kitted yardstick; numbers not given there (dice, AP, armour class, hit points) are the engineer's, recorded.
19. **Early measures with `--near-source`** (as stages 9 and 10): `one`, `company`, `rl10`, the refactor guard and the 50-campaign check. **Stage 12 owns** the accepted out-of-band figures (`one` 288, `company` 289, 331 days), the long campaign's gear lag and the Source at 1 of 100; this stage records the long run and does not tune it. Any figure further out than accepted goes to the orchestrator with options, never tuned away. The user's bands are never changed.
20. **Out of scope:** the deferred behaviours (decision 11), ring-element armour wards in the gear policy, the simulator's spend order and targeting, market income, sounds beyond reusing today's cues (a new cue is allowed only through the `yomi-sound` skill), the trading post selling tier 3+.

The user's answers to Q1–Q10 (index, "Open questions") are recorded there and in the feature record's decision log by the time this step runs; where an answer differs from the default, document the answer, not the default.

### Contracts this step documents (from the index; read the code for their final values)

- **C1/C2** (step 02): `PlayerKit`, `--player-kit own|expected` (single battles only, not with `--player-weapon`), `expectedGear(character, level, leadResistance)`; `KITTED_FIGHTER_GROWTH` and `foeYardstick(level, kit: 'bare' | 'expected' = 'bare')`, the stage 11 kinds held to `'expected'`.
- **C3/C4** (steps 08–13): the 13 kinds (`wolf`, `worg_rider`, `ogre`, `wyvern`, `barrow_wight`, `basilisk`, `hill_giant`, `stone_golem`, `blight_cultist`, `young_dragon`, `blight_lich`, `elder_wyrm`, `source_horror`) and the 11 abilities (`worg_strikes`, `ogre_sweep`, `wyvern_strikes`, `basilisk_gaze`, `giant_rock`, `dragon_breath`, `dragon_strikes`, `wyrm_breath`, `wyrm_strikes`, `blight_breath`, `horror_claws`).
- **C5/C6** (steps 08–12): the 12 encounters (`wolf_pack` 6–9, `worg_riders` 7–9, `ogre_camp` 7–10, `wyvern_roost` 9–12, `barrow_wights` 11–14, `basilisk_lair` 11–14, `hill_giant_steading` 12–15, `golem_ruin` 14–17, `blight_cult` 14–18, `young_dragon` 15–18, `blight_lich_court` 17–20, `elder_wyrm` 18–20), their spawn kinds and favoured runes; the renamed nests of rings 7 to 18.
- **C7** (step 13): `sourceGuardians` at threats 1–5 as before, above 5 `SOURCE_AT_20` (the Blight Horror and two Blight Cultists, fought at 20); `SOURCE_FOE_LEVEL` and `maxFoeLevel` removed.
- **C8** (steps 04–07): the 13 unit sprites.
- **C9**: the cell codes `wp6`, `wp9`, `wr7`, `wr9`, `oc7`, `oc10`, `wy9`, `wy12`, `bw11`, `bw14`, `bl11`, `bl14`, `hg12`, `hg15`, `go14`, `go17`, `cu14`, `cu18`, `yd15`, `yd18`, `lc17`, `lc20`, `ew18`, `ew20`, `sgk20`, and step 02's `bco9k`, `bco12k`, `fh15k`, `fh18k`.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before the commit; `npm run test:browser` (or `-- -t <name>`) after any scene change, `e2e/CLAUDE.md` read first; `npm run build`; `npm run dev` for the play script (http://localhost:5173; `~` opens the debug console, `?seed=42` fixes battle seeds). This step runs **no simulation** (say so).
- **The refactor guard** stays green and unedited; the policy snapshot is not touched. The 50-campaign check is not needed (no rule changes); if a small bug fix touches the domain, run it against step 14's hash and record it in `log.md`.
- **Commits.** One commit once `npm test` passes, on `long-campaign-stage-11`, without pushing; files staged by path. Message "Stage 11 step 15: document and play". No attribution lines.
- **Docs.** Search the CLAUDE.md files, `.claude/` and `docs/reference/` for every name renamed or removed in this stage (`SOURCE_FOE_LEVEL`, `maxFoeLevel`, `STAND_IN_GOODS`, the old nest ids of C6). `scripts/claudeMd.test.ts` caps the root `CLAUDE.md` at 16 KB, each directory's at 8 KB, and the `.claude/` skills, agents and always-loaded total; **`src/game/CLAUDE.md` was 7,654 bytes at the plan's start**: move detail to `docs/reference/game.md` before adding a line.

## 3. Dependencies and prerequisites

- **Step 14** done (and through it 01–13, the sprite steps 04–07 merged): its execution record holds "Figures for the implementation notes"; `log.md` holds every cell and run.
- **Existing tools:** the debug console's `level <n> [member|all] [auto] [@party]` (stage 10), `xp`, `give`, `stock`, `fight <encounter> [threat] [@party]`, `spawn` (`src/scenes/debugCommands.ts`; reference `docs/reference/scenes.md`). The manual's screenshots: `.claude/skills/yomi-manual/` (`e2e/manual.shots.ts`).
- If a command the play script needs is missing or refuses (for example `give` of a forged id), record it and use the nearest equivalent; do not add a command unless trivial and tested.

## 4. Scope and guidance

### 4.1 The CLAUDE.md files

- `src/game/CLAUDE.md`: the scaling line (stage 11: `one`, `company` as step 14 measured; nothing stage 11 adds reaches the early campaign, decision 15); the `encounters.ts` and `loot.ts` lines if they now say more (the Source's two forms, trophies from kills); `tradingPost.ts` no longer sells a stand-in. Mind the cap.
- `src/combat/CLAUDE.md`: the yardstick's two tables (`foeYardstick(level, kit)`, `KITTED_FIGHTER_GROWTH`, the test holding stage 11's kinds to `'expected'`); `immune` beside the stat block; the monsters' abilities in `ABILITY_IDS`.
- `src/engine/CLAUDE.md`: the immunity checked where a status is laid, drawing nothing (RNG discipline's "never draws" list), and the policy's zero value for a status on an immune unit.
- `scripts/CLAUDE.md`: `--player-kit expected` if the guide names flags (else `running.md` only).
- The root `CLAUDE.md`: only if a map row or a cross-directory contract changed (none expected).

### 4.2 `docs/reference/`

- `battle.md`: `CombatantStats.immune` and the outcome's `immune` field (log 27), the formatted line; each new ability (routine, area, shape, element, status, recharge) as the monster abilities are listed today; Sweep and Rock built from existing area fields.
- `game.md`: the new encounters (bands, counts, slots), the Source's two forms and the removal of `SOURCE_FOE_LEVEL`; each ring's fixed nests (C6) and which bandits stay; `SPAWN_KINDS`; `TROPHIES`'s entries; `FAVOURED_RUNES`; the stand-in removed from partners' goods; `SAVE_VERSION` 36.
- `simulator.md`: `--player-kit own|expected`, `expectedGear`, the kitted yardstick's measurement and test.
- `sprites.md`: only if it lists unit kinds or the boss canvas used by step 07.

### 4.3 Skills and agents

- `.claude/skills/yomi-balance/bands.md`: the cell codes and measure names of C9 present (each ring step added them) with "Now" from step 14; the far cells' and long campaign's "Now" from step 14; the bands themselves never changed.
- `running.md` (`--player-kit`, which line carries each new figure), `levers.md` (the new encounters' counts as levers; the near-home Source as the measuring device).
- `.claude/skills/yomi-add-content/`: `foe.md` (the yardstick check now names `'expected'` for new kinds), `status.md` or `foe.md` (`immune`), `encounter.md` if its example of `fromThreat: 7` changed.
- `.claude/agents/`: if an agent's text changed (for example `yomi-measure`'s measure list), change its copy in `.codex/agents/*.toml` too.

### 4.4 The manual

Left by step 09: with Elder Glade's stand-in gone, the manual no longer says where wyvern hide comes from (the Goods line, about line 661, lost its clause). Say it with the trophies: wyverns leave 3 wyvern hide each.

Follow `.claude/skills/yomi-manual/`. In `docs/manual/README.md`: the foes of the far rings (wolves to the elder wyrm, by ring, with what each does: routines, sweep, breath, gaze, spells, regeneration, the golem's immunity), trophies coming from kills (wolfhide, wyvern hide, basilisk scale, drake scale) and the hide tiers they forge, Elder Glade no longer selling wyvern hide, and the Source's guardian at the end. Retake every screenshot the skill lists for screens this stage changed (the battle with a new sprite, the victory screen with trophies, the Market Hall's goods) and any the skill says to retake each stage.

### 4.5 Implementation notes and the stages index

- Add "Implementation notes" to `docs/designs/long-campaign/stage-11-high-roster.md`, and set its **Status** to done: what landed ring by ring; step 14's figures (early figures against step 01, the long run against stage 10, the Source share and battles to level recorded for stage 12, every cell against 300–475); the departures: decisions 3 (the near-home Source kept, `source_horror`), 8 (Worg Riders 7–9), 9 (13 sprites), 11 (Sweep and Rock from existing fields), 12 (the immunity's log field and bump), and 4 (the cells' working reading, not a band); and the user's answers to Q1–Q10 where they differ from the defaults; any cell or play finding left for stage 12.
- `docs/designs/long-campaign/index.md`: stage 11's row marked done with a one-line summary and a link to the notes, as rows 1–10 read; the "early-game guard" convention gains stage 11's figure.

### 4.6 The play script

In the dev build (`npm run dev`), from a new game, with the debug console. Use `?seed=42` so a fight can be replayed. For each new encounter at **both ends of its band** (C5; the Source at 20):
1. Raise the party to the threat's level with `level <T> all auto`, and kit it near `expectedKit` for that level with `give` (the families of decision 10; tier 3+ ids as the catalog names them).
2. `fight <encounter> <T>`; play it out or let the AI play it (auto-resolve), watching the battle.
3. Check and record:
   - **Ring 7:** wolves (10 AP) reaching the archer; the Worg Rider's Spear and Bite as one action, two log lines; the ogre's Sweep striking every hero beside it.
   - **Ring 9:** the wyvern's Bite and Tail Sting, the sting poisoning.
   - **Ring 12:** the wight's Drain Life healing it; the basilisk's Gaze cone chilling; the giant's Rock from range.
   - **Ring 15:** the golem's immunity log line when poison or acid would be laid (a Venom rune's critical, Acid Arrow), poison doing nothing through its ward; the cultist's Lightning Bolt, Curse and Heal; the Young Dragon's Fire Breath on the front rank, then again with Ember runes in the heroes' armour (`give` an armour with an Ember rune, or embed one): about a third less fire (design §4).
   - **Ring 18:** the lich's Lightning Bolt, Death Cloud, Drain Life and Dark Shield, and its regeneration stopped by Seared or Corroded; the Elder Wyrm's breath (cone 4) and routine.
   - **The Source at 20:** the Horror's Blight Breath around itself (Corroded on the heroes, its guardians untouched), its regeneration, stopped by Seared or Corroded; Dawn runes' bane on it and the cultists.
   - Every ability's log line reads well; each sprite reads clearly beside the heroes (no placeholder); the victory screen lists the trophies (wolfhide, wyvern hide 3, basilisk scale 3, drake scale 6 and 10).
4. Once, forge a drake-scale item from drake scale won in play (workshop level 6 via `facility workshop 6`, gold via `stock`), as design §4 says ("its scales forge drake-scale leather"). Check the Market Hall's goods no longer list wyvern hide from Elder Glade.

Record each fight (encounter, threat, party level and kit, won or lost, rounds, what fired, anything odd) in the execution record. A fight that seems unfair is recorded with its cell figure from `log.md` and brought to the orchestrator; do not tune.

### 4.7 Exclusions

No rule, constant, count or band change; no simulation; no new feature. Fix only small bugs in this stage's code, test-first.

## 5. Verification

- `npm test` passes, with `scripts/claudeMd.test.ts` within its caps; `npm run build` passes; `npm run test:browser` passes after the manual's screenshots are retaken.
- `grep -rn "SOURCE_FOE_LEVEL\|maxFoeLevel\|STAND_IN_GOODS" src scripts docs/reference .claude CLAUDE.md` finds nothing but history; the old nest ids of C6 appear nowhere but history.
- Every figure in the implementation notes and `bands.md` matches step 14's record and `log.md` (the reviewer checks).
- The play script's record covers every new encounter at both band ends and every check of §4.6.

## 6. Completion criteria

- [ ] CLAUDE.md files, `docs/reference/`, the balance and add-content skills (and any agent with its `.codex` copy) current with steps 01–14.
- [ ] The manual updated and its screenshots retaken.
- [ ] The stage design's Implementation notes written and its status done; the stages index's row 11 and guard convention updated.
- [ ] The play script walked, each fight and check recorded; anything unfair or broken brought to the orchestrator.
- [ ] One commit, "Stage 11 step 15: document and play", files staged by path, no attribution lines; the index's row 15 updated with status and commit.

## 7. Execution record
