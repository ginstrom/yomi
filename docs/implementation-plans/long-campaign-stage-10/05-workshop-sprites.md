# Step 05: Workshop sprites

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-10-forging-and-high-tiers.md) (§2 "The workshop": levels 4 to 6) · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.3 (workshop levels) · [Stages index](../../designs/long-campaign/index.md) ("Sprites") · [Stage 9's sprite step](../long-campaign-stage-09/06-partner-sprites.md) (the workflow it used)

**Difficulty:** sonnet / opus. Tool work with sprite-tool on text sources, following a written workflow, so `model: "sonnet"` will do; the reviewer should be opus (model unset), as it judges whether the new levels read as grander forges beside the other buildings, which the checks cannot.

## 1. Objective

Draw three new levels of the encampment's workshop, so that step 03's workshop levels 4 to 6 are drawn as themselves rather than failing to find a frame:
- `camp_workshop/level_4`, `level_5`, `level_6`.

No game code changes: only the sprite source and the exported atlas.

## 2. Requirements and context

- **S10-R2** (design §2, "The workshop"): levels 4 to 6, which forge tiers 3, 4 and 5 (gear §4.3: 100 gold and 20 mithril; 150 gold and 20 adamant; 200 gold and 10 starmetal). The design lists no sprites; this step is the plan's addition.
- **Decision 11 (from the index, unchanged):** **Workshop sprites for levels 4 to 6** (step 05): the design lists none, but the encampment draws a facility by `camp_<facility>/level_<n>`, and the stages index says a stage is not done while something falls back to a placeholder.
- **How the scene uses the art** (existing, not this step): `facilityFrame` (`src/scenes/encampmentView.ts`) names `camp_workshop/level_<level>` for any built level, so `level_4` to `level_6` are named already; `EncampmentScene` draws a building at `BUILDING_SCALE` (2) on its plot, its labels between its neighbours'.

### Contract (copied unchanged from the index)

**C4. Workshop sprites (step 05)**

`camp_workshop` (`art/encampment/`) gains frames `level_4`, `level_5`, `level_6`, at the size and in the style of `level_1` to `level_3`, each grander (a forge with a stack and bellows at 4, a second hearth at 5, a star-lit great forge at 6, or as the sprite guidance suits). `facilityFrame` already names them; nothing in `src/` changes.

### Shared constraints (from the index)

- **Content.** Sprites: `.claude/skills/yomi-sprites/` (`art/CLAUDE.md`, `docs/designs/sprite-drawing-guidance.md`); never edit an exported PNG; `npm run sprites` then `npm run sprites:check`, then the `yomi-asset-check` agent.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit.
- **The refactor guard** must stay green and is not edited. This step changes no rule the campaign plays, so the 50-campaign check is not run, and it runs **no simulation** (say so in the record).
- **Commits.** One commit once `npm test` passes, without pushing; files staged by path. A step run in a worktree commits on its own branch, merged by the orchestrator. Message "Stage 10 step 05: workshop sprites". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines the change makes wrong (none expected: no id-to-asset table changes); `docs/reference/sprites.md` if it lists the facilities' levels.

## 3. Dependencies and prerequisites

- **None.** May run at any time, **in its own git worktree**: it touches only `art/` and `public/assets/sprites/`. It must be merged **before step 08** (the scenes, whose in-browser tests show the encampment at workshop levels 4 to 6, and which fail on a missing frame) and step 11 (screenshots).
- **Existing (at `f3a1102`):**
  - `art/CLAUDE.md` (the sprite-tool workflow), `docs/reference/sprites.md` (canvases and scales), `docs/designs/sprite-drawing-guidance.md`.
  - `.claude/skills/yomi-sprites/`: `SKILL.md`, `workflow.md`, `drawing.md`.
  - `art/encampment/camp_workshop.sprite.toml`: `canvas = "building"`, frames `level_1` to `level_3`: the size, footprint, baseline and style to extend.
  - `art/encampment/camp_trading_post.sprite.toml`: levels 1 to 6 (levels 4 to 6 drawn in stage 7: the Market, Market Hall and Trading House), the model of how a building grows past level 3 without outgrowing its plot.
  - `art/palette.toml`, `art/sprite-tool.toml`.
  - `public/assets/sprites/`: `atlas.png`, `atlas.json`, `atlas.anims.json`, `.sprite-tool-manifest.json`, `README.md` (provenance and licence).

## 4. Scope and guidance

1. **Read first:** the yomi-sprites skill files, `art/CLAUDE.md`, `docs/designs/sprite-drawing-guidance.md`; run `sprite guide --project art`. Look (`sprite show`, `sprite preview`) at `camp_workshop` levels 1 to 3 and `camp_trading_post` levels 3 to 6.
2. **Draw** in `art/encampment/camp_workshop.sprite.toml`, after `level_3`:
   - `level_4`: level 3's workshop become a forge: a chimney stack with smoke or glow, bellows, an anvil out front.
   - `level_5`: a second hearth or forge wing, more stone, a quench trough or racks of blades.
   - `level_6`: a great forge, the grandest: a tall stack, a pale star-metal glow (a hint of the starmetal it works), banners or a carved lintel.
   - Each grander than the last and recognisably the same building; the same canvas, footprint, baseline and visual weight band as the trading post's levels 4 to 6, so labels and plots line up and no building overlaps its neighbour at `BUILDING_SCALE`.
3. **Export:** `npm run sprites`, then `npm run sprites:check` (must pass). Commit everything the build writes into `public/assets/sprites/`, the manifest included. Then run the `yomi-asset-check` agent and record its verdict.
4. **Look at the result:** each frame at 1x, at `BUILDING_SCALE` (2x) and enlarged (`sprite preview camp_workshop --project art --scale 8`), beside `camp_trading_post` levels 4 to 6 and the other buildings' top levels (`camp_guild_hall` level 5, `camp_shrine`, `camp_infirmary`, `camp_lodge` level 3); if convenient, in the running game (`npm run dev`, debug `facility workshop 6`, the encampment), kept outside the repository (scratchpad or `logs/`).
5. **Provenance:** update `public/assets/sprites/README.md` for the new frames (drawn for the project with sprite-tool, the same licence as the rest).
6. **Exclusions:** no `src/` change (no scene, domain or test code); no other sprite; no rule change; no simulation.

## 5. Verification

- `npm run sprites:check` passes; the `yomi-asset-check` agent reports pass.
- `npm test` passes (the refactor guard untouched and green).
- The atlas holds the new frames:

  ```sh
  grep -o '"camp_workshop/level_[0-9]"' public/assets/sprites/atlas.json | sort -u   # level_1 to level_6
  ```

- The frames were viewed (record how and what was seen), beside the trading post's levels 4 to 6, at `BUILDING_SCALE`.

## 6. Completion criteria

- [ ] `camp_workshop` frames `level_4`, `level_5`, `level_6` on the `building` canvas, at the size and footprint of `level_1` to `level_3`, each grander, distinct from the other buildings.
- [ ] `npm run sprites:check` and `npm test` pass; `yomi-asset-check` passes; the 50-campaign check not run and no simulation run (no rule change), said in the record.
- [ ] `public/assets/sprites/README.md` records the new art.
- [ ] The execution record names, for step 08, the exact frame names and whether they sit at the same origin as `level_1` to `level_3` (no offset) or need one.
- [ ] One commit, "Stage 10 step 05: workshop sprites", no attribution lines, files staged by path (on the step's worktree branch); the index's row 05 updated with status and commit.

## 7. Execution record
