# Step 07: Sprites for ring 18 and the Source

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-11-high-roster.md) (§2 "Sprites: 14 units, drawn ring by ring", §7 "Sprites as the bottleneck") · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.5 (the roster) · [Stages index](../../designs/long-campaign/index.md) ("Sprites") · [Stage 10's sprite step](../long-campaign-stage-10/05-workshop-sprites.md) (the workflow it used) · [Plan log](log.md)

**Difficulty:** sonnet / opus. Tool work with sprite-tool on text sources, following a written workflow, so `model: "sonnet"` will do. The reviewer should be opus (model unset): it judges whether the three bosses read clearly in battle and beside the rest of the roster, which the checks cannot.

## 1. Objective

Draw the three unit sprites the last ring and the Source need, so that step 12 (ring 18) and step 13 (the Source at 20) can add their kinds without a unit falling back to a placeholder:
- `blight_lich`: the Blight Lich, ring 18's caster boss;
- `elder_wyrm`: the Elder Wyrm, the top threat of ring 18;
- `source_horror`: the Blight Horror rebuilt as the Source's final boss.

No game code changes: only the sprite sources and the exported atlas.

## 2. Requirements and context

- **S11-R1** (design §3): each kind has a sprite. **Stages index, "Sprites":** new units are drawn with sprite-tool by a subagent, following `docs/designs/sprite-drawing-guidance.md`; a stage is not done while a unit falls back to a placeholder.
- **Design §7:** sprites are delegated per ring, in parallel with the blocks.
- **What each kind is** (campaign §5.5; from the index's C3 rows, unchanged):

| Kind | Name | Native | XP | Defence | Special (C4) | Step |
| --- | --- | --- | --- | --- | --- | --- |
| `blight_lich` | Blight Lich | 17 | 300 | res 3, regeneration 3, blightborn | spells `lightning_bolt`, `death_cloud`, `drain_life`, `dark_shield` | 12 |
| `elder_wyrm` | Elder Wyrm | 18 | 450 | res 5, regeneration 2, wards fire 15 | `wyrm_breath`, `wyrm_strikes` | 12 |
| `source_horror` | Blight Horror | 20 | 500 | res 3, regeneration 2, blightborn | `blight_breath`, `horror_claws` | 13 |

- **The look asked for:**
  - `blight_lich`: a caster boss, blight-crowned undead: robed, gaunt, a crown or halo of the blight's sickly colour, a staff or focus; reads as a spellcaster, not a brute.
  - `elder_wyrm`: larger and older than `young_dragon` (step 06), the same family look (body plan, palette family, head shape), with age shown: heavier horns, scarred or darker scales, a bigger wingspan or bulk.
  - `source_horror`: today's `horror` (`art/units/horror.sprite.toml`) rebuilt as the final boss: grander, recognisably the same creature (its silhouette, colours and claws carried over and enlarged or elaborated). **Today's `horror` sprite stays unchanged**: it is still used by the near-home Source (decision 3).

### Contract (copied unchanged from the index)

**C8. Sprites (steps 04 to 07)**

`art/units/<kind>.sprite.toml` for each C3 kind, `idle` and `walk` animations and `[points] chest`, built into `public/assets/sprites/`: step 04 `wolf`, `worg_rider`, `ogre`; 05 `wyvern`, `barrow_wight`, `basilisk`, `hill_giant`; 06 `stone_golem`, `blight_cultist`, `young_dragon`; 07 `blight_lich`, `elder_wyrm`, `source_horror`. Bosses (dragon, lich, wyrm, `source_horror`) on the largest unit canvas `docs/reference/sprites.md` allows. Nothing in `src/` changes.

### Decisions from the index (unchanged)

3. **The Source at 20** *(for the user, Q3)*: a new kind `source_horror` ("Blight Horror", native 20, its own sprite) leads two Blight Cultists at threat 20. **The near-home Source keeps today's `horror` block and slots for threats 1 to 5**, so `--near-source` (the early figures, the refactor guard, the 50-campaign check) fights exactly as before. `SOURCE_FOE_LEVEL` and `maxFoeLevel` are removed. C7.
9. **Sprites: 13** *(for the user, Q9)*: the design says 14; its table names 12 new kinds, and the rebuilt Horror is a 13th (decision 3). The plan draws 13.

### Shared constraints (from the index)

- **Content.** Sprites: `.claude/skills/yomi-sprites/` (`art/CLAUDE.md`, `docs/reference/sprites.md`, `docs/designs/sprite-drawing-guidance.md`); never edit an exported PNG; `npm run sprites`, `npm run sprites:check`, then the `yomi-asset-check` agent. The foe checklist `.claude/skills/yomi-add-content/foe.md` names the sprite line: a sprite named for the kind (its id is the `UnitKind`), with `idle` and `walk` animations and a `[points] chest` (where shots and spells are aimed and fly from).
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit.
- **The refactor guard** (`scripts/simulate.test.ts`) must stay green and is not edited. This step changes no rule the campaign plays, so the 50-campaign check is not run, and it runs **no simulation** (say so in the record).
- **Commits.** One commit once `npm test` passes, without pushing; files staged by path. This step runs in its own worktree and commits on its own branch, merged by the orchestrator before step 12. Message "Stage 11 step 07: sprites for ring 18 and the Source". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines the change makes wrong (none expected); `docs/reference/sprites.md` if it lists the unit sprites; `public/assets/sprites/README.md` for provenance.

## 3. Dependencies and prerequisites

- **None among the plan's steps to start.** Run **in its own git worktree**: it touches only `art/units/` and `public/assets/sprites/`. It must be merged **before step 12** (ring 18, which adds `blight_lich` and `elder_wyrm`) **and step 13** (the Source, which adds `source_horror`): `src/scenes/unitLook.test.ts` fails for a kind with no sprite only once the kind exists, so the sprites must be in first.
- **Shared outputs.** The atlas (`atlas.png`, `atlas.json`, `atlas.anims.json`) and `.sprite-tool-manifest.json` are rebuilt by every sprite step. If steps 04–06 were merged after this worktree was made, merge or rebase onto them and **rebuild the atlas** (`npm run sprites`) before committing, so no earlier sprite is lost; never hand-merge the atlas files.
- **`elder_wyrm` follows `young_dragon`** (step 06). If step 06 is merged, match its look; if not, read its source in step 06's worktree or branch if available, else draw the wyrm to the description above and note for the reviewer that the family match must be checked once both are in.
- **Existing (at `1a008af`):**
  - `art/CLAUDE.md`, `docs/reference/sprites.md` (unit canvases and scales, animation frames), `docs/designs/sprite-drawing-guidance.md`.
  - `.claude/skills/yomi-sprites/`: `SKILL.md`, `workflow.md` (`sprite new` for a unit kind, the manifest), `drawing.md`.
  - `art/units/horror.sprite.toml`: today's Blight Horror, the model for `source_horror`.
  - `art/units/*.sprite.toml`: the roster to sit beside (`troll`, `armored_troll`, `salamander`, `giant_spider`, `shaman`, the bandits).
  - `art/palette.toml`, `art/sprite-tool.toml`; `public/assets/sprites/` (`atlas.*`, `.sprite-tool-manifest.json`, `README.md`).
- **Blocked by nothing now, but open questions may change it:** **Q3** (if the user chooses to reuse `horror`'s art for the rebuilt Horror, `source_horror` is not drawn: it becomes an alias or the kind reuses `horror`'s frames, decided in step 13) and **Q9** (if the user wants a 14th sprite, it is added here or in its ring's sprite step). Check the index's Open questions before starting.

## 4. Scope and guidance

1. **Read first:** the yomi-sprites skill files, `art/CLAUDE.md`, `docs/reference/sprites.md`, `docs/designs/sprite-drawing-guidance.md`; run `sprite guide --project art`. Look (`sprite show`, `sprite preview --grid`) at `horror`, `troll`, `salamander` and, if available, step 06's `young_dragon` and `blight_cultist` (the lich should sit with the cultist as the blight's own).
2. **Create** each with `sprite new` for a unit kind (workflow.md), on the **largest unit canvas** `docs/reference/sprites.md` allows (all three are bosses). Each has `idle` and `walk` animations and a `[points] chest`.
3. **Draw** to §2's looks. Each must read at battle scale against the hex board: a clear silhouette, distinct from its neighbours in the roster (the lich from the cultist and the shaman; the wyrm from the young dragon by size and age; `source_horror` from `horror` by grandeur, while still plainly the same creature).
4. **Check and export:** `sprite check --project art` until `ok`; `npm run sprites`, then `npm run sprites:check` (must pass). Commit everything the build writes into `public/assets/sprites/`, the manifest included. Then run the `yomi-asset-check` agent and record its verdict.
5. **Look at the result:** each sprite at 1x, at battle scale and enlarged (`sprite preview <id> --project art --scale 8`), beside `horror`, `young_dragon` (if in) and the other bosses; previews kept outside the repository (scratchpad or `logs/`). The kinds do not exist in `src/` yet, so they cannot be seen in a battle until steps 12 and 13; say so.
6. **Provenance:** update `public/assets/sprites/README.md` for the new sprites (drawn for the project with sprite-tool, the same licence as the rest).
7. **Exclusions:** no `src/` change (no kind, scene, domain or test code); `art/units/horror.sprite.toml` unchanged; no other sprite; no rule change; no simulation.

## 5. Verification

- `sprite check --project art` prints `ok`; `npm run sprites:check` passes; the `yomi-asset-check` agent reports pass.
- The atlas holds every earlier unit (`horror` among them) and the three new ones, each with `idle` and `walk`.
- `npm test` passes (no code changed; `unitLook.test.ts` does not yet ask for these kinds).
- `git diff --stat` shows only `art/units/blight_lich.sprite.toml`, `art/units/elder_wyrm.sprite.toml`, `art/units/source_horror.sprite.toml`, `public/assets/sprites/` and, if needed, `docs/reference/sprites.md`, plus this task file and the index's row 07.
- No simulation run (recorded).

## 6. Completion criteria

- [x] `blight_lich`, `elder_wyrm` and `source_horror` drawn on the largest unit canvas, each with `idle`, `walk` and `[points] chest`, reading as described.
- [x] Today's `horror` unchanged.
- [x] The atlas rebuilt over every earlier sprite step merged; `npm run sprites:check` and the `yomi-asset-check` agent pass.
- [x] Provenance updated.
- [x] One commit, "Stage 11 step 07: sprites for ring 18 and the Source", on this step's worktree branch, files staged by path, no attribution lines; the index's row 07 updated with status and commit; the orchestrator told it must merge before step 12.

## 7. Execution record

Engineer (sonnet-tier brief), worktree `yomi-s11-sprites`, branch `long-campaign-stage-11-sprites-07`, cut from step 06 (76779ff). Sprite commit 95e5046.

- Drawn on the 32px `unit` canvas (the only unit canvas), each with `idle` (2 frames), `walk` (4 beats, leg/hem rows only) and `[points] chest`: `blight_lich` (violet-robed skeletal sorcerer, acid crown, ember eyes, open ribcage with a green light, tan staff with a violet crystal), `elder_wyrm` (darker hulking red drake on four angled legs, thrust horned head with ember jaws, tall rust wing, ivory horns, tan belly plates, spiked tail), `source_horror` (the horror grown: ridge of tall bone spikes, two pale eyes under a dark brow, wide maw, cracked glowing blight core, forward claw). `art/units/horror.sprite.toml` untouched.
- Contact: `sprite check --project art` ok (144 sprites, 333 frames); `npm run sprites` then `npm run sprites:check` up to date (runlog #38); `yomi-asset-check` agent: PASS, sprite 0.7.0, no pin drift. Atlas rebuilt over steps 04-06 (all earlier sprites kept).
- `npm test` on the clean tree at 95e5046: 2740 passed with `-- --testTimeout=120000` (runlog #41). Two runs with the default 5 s timeout (#37, #40) failed only with "Test timed out" in unrelated files (hex, blight, buildings, progression, debugCommands) because the host was at load average ~15 from another engineer's simulations; no assertion failed.
- No simulation run. No `src/` change; `docs/reference/sprites.md` lists no unit sprites (unchanged); provenance row added to `public/assets/sprites/README.md`.
- Previews (outside the repo): `/private/tmp/claude-501/-Users-ryan-personal-yomi/6b9b93b7-3933-4bd1-a198-fa82ad0fff0d/scratchpad/roster-display.png` (display scale: lich, wight, cultist, shaman, wyrm, young dragon, golem, ogre, hill giant, source_horror, horror, troll), and `blight_lich-6x.png`, `elder_wyrm-6x.png`, `source_horror-6x.png` in the same folder.
- For the reviewer: the kinds do not exist in `src/` yet, so none can be seen in battle until steps 12 and 13. Judge at display scale beside the roster: wyrm vs young dragon (pose, mass, darker value), source_horror vs horror, lich vs wight and cultist.
- The orchestrator must merge this branch before step 12.
