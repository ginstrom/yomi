# Step 03: Sprites: Lodge, market and fort

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-07-site-improvements-and-markets.md) (§2 "A sprite, `camp_lodge`, with three level frames"; §4 "A fort on the Copper Pit shows a palisade") · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §5.3 ("a plot and sprite frames for the Lodge (`camp_lodge`, `level_1..3`), drawn by a subagent") · [Stages index](../../designs/long-campaign/index.md) ("Sprites")

**Difficulty:** sonnet / opus. The engineer's work is tool work with sprite-tool on text sources, following a written workflow, so `model: "sonnet"` will do. The reviewer should be opus (model unset), because it judges whether the drawings read well at size and fit the existing art, which the checks cannot.

## 1. Objective

Draw the art the stage's scenes need, so that no later step falls back to a missing frame:
- the Builders' Lodge at its three levels, for the encampment screen (step 05);
- the trading post's levels 5 and 6 (Market Hall, Trading House), since the encampment draws a facility by `camp_<facility>/level_<n>` and the post now reaches 6 (step 02);
- a palisade, `map_fort`, drawn over a fort's resource icon on the world map (step 04).

No game code changes in this step beyond what the sprite pipeline itself needs (its sources and exports).

## 2. Requirements and context

- **S7-R2** (the Builders' Lodge) needs `camp_lodge`; **S7-R3** (trading post levels 4 to 6) needs frames for levels 5 and 6; **S7-R1**'s design §4 says a fort "shows a palisade" on the map.
- The encampment draws each facility as `camp_<facility>/level_<n>` (`encampmentView.ts`'s `facilityFrame`, existing), so a level with no frame would show nothing. Existing frames: `camp_trading_post` has `level_1` to `level_4`; there is no `camp_lodge`.
- Plan decision 12 (from the index): the design names only `camp_lodge`; the trading post's levels 5 and 6 and `map_fort` are added because the code needs them.
- **The stages index:** "New units, facilities and item icons are drawn with sprite-tool by a subagent, following `docs/designs/sprite-drawing-guidance.md`. A stage is not done while a unit falls back to a placeholder."

### Contract (copied unchanged from the index)

**C3. Sprites (step 03)**

- `camp_lodge`, on the 48px `building` canvas: frames `level_1`, `level_2`, `level_3` (a builders' yard, then with a crane or scaffold and stone, then grander with a road-mason's mark for roads).
- `camp_trading_post` gains `level_5` (Market Hall) and `level_6` (Trading House), grander than `level_4`, same canvas and footprint.
- `map_fort`, on the `map` canvas: a palisade ring drawn over a resource's icon, with frame `base` and an `idle` animation (map sprites have one), transparent where the resource icon should show through.

### Shared constraints (from the index)

- **Sprites** are drawn with sprite-tool by following `art/CLAUDE.md` and `docs/designs/sprite-drawing-guidance.md`; never edit an exported PNG; `npm run sprites` then `npm run sprites:check`.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npm run test:browser` after any scene change (none here).
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) is untouched by this step and must stay green; this step changes no rule, so the 50-campaign check need not be run (say so in the record).
- **Commits.** One commit for this step once `npm test` passes, without pushing. This step runs in its own worktree and commits on its own branch, merged into `long-campaign-stage-07` by the orchestrator. The message is "Stage 7 step 03: sprites: Lodge, market and fort", with no attribution lines.
- **Docs.** CLAUDE.md files stay current. This step adds no table mapping ids to assets (`FACILITY_SPRITES` gains `builders_lodge` in step 05; the map's fort sprite constant is step 04's), so it should need no CLAUDE.md edit; check.

## 3. Dependencies and prerequisites

- **None.** This step may run at any time, in its own git worktree (it touches only `art/` and `public/assets/sprites/`). It must be merged into the stage branch **before step 04** (which draws `map_fort`) **and step 05** (which draws `camp_lodge` and the post's levels 5 and 6).
- **Existing (at `81bdbeb`):**
  - `art/CLAUDE.md`: the sprite-tool workflow (it loads by itself when you work in `art/`); `docs/reference/sprites.md`: canvases and scales.
  - `docs/designs/sprite-drawing-guidance.md`: how to draw for this project.
  - `art/encampment/camp_trading_post.sprite.toml`: frames `level_1` to `level_4` on the 48px `building` canvas.
  - `art/encampment/camp_guild_hall.sprite.toml` (levels 1 to 5), `camp_shrine`, `camp_workshop`, `camp_infirmary`, `camp_plot`: the encampment's style and scale.
  - `art/map/map_resource.sprite.toml` (`canvas = "map"`) and `art/map/map_watchtower.sprite.toml`, `map_encampment`, `map_banner`: the world map's scale and style, each with an `idle` animation.
  - `art/palette.toml` and `art/sprite-tool.toml`: the palette and the tool's config.
  - `public/assets/sprites/`: the exported `atlas.png`, `atlas.json`, `atlas.anims.json`, `.sprite-tool-manifest.json` and `README.md` (provenance and licence).

## 4. Scope and guidance

1. **Read first:** `art/CLAUDE.md`, `docs/designs/sprite-drawing-guidance.md`, and run `sprite guide --project art`. Look (with `sprite show` and `sprite preview`) at `camp_trading_post` `level_1` to `level_4`, `camp_guild_hall`, `map_resource` and `map_watchtower` for scale and style.
2. **The Builders' Lodge.** New `art/encampment/camp_lodge.sprite.toml` (for example `sprite new camp_lodge --canvas building --project art --dir encampment`), frames `level_1`, `level_2`, `level_3`:
   - level 1: a builders' yard, a modest timber workshop with stacked logs and tools;
   - level 2: adds a crane or scaffold and dressed stone;
   - level 3: grander, with a road-mason's mark (a paved stretch or a milestone) for roads;
   - each grander than the one before, the same footprint origin and lighting across levels, so the plot does not jump when the level rises; distinct at a glance from the workshop (smiths and bowyers) next to it.
3. **The trading post's upper levels.** Add `level_5` (Market Hall: a covered hall of stalls, perhaps a second storey) and `level_6` (Trading House: a grand stone-and-timber house with banners or a tower) to `art/encampment/camp_trading_post.sprite.toml`, derived from `level_4`, same canvas and footprint, each grander than the last.
4. **The fort's palisade.** New `art/map/map_fort.sprite.toml` on the `map` canvas: a ring of sharpened stakes around the edge of the icon, drawn so that, placed at the same origin as `map_resource`, the resource icon still shows in the middle (transparent there). Frame `base` and an `[anim.idle]` (a single held frame is fine, or a pennant on one stake with a gentle two-frame flutter). It must read at native size over every resource icon.
5. **Export:** `npm run sprites`, then `npm run sprites:check` (must pass). Commit everything the build writes into `public/assets/sprites/`, the manifest included.
6. **Look at the result:** view the exported frames at 1× and enlarged (`sprite preview <id> --project art --scale 8`, and at display size), and check that the Lodge's three levels, the post's levels 5 and 6 and the palisade over `map_resource` read clearly and match the style. To judge the palisade over the resource, compose the two previews (for example overlay the PNGs with a scratch script outside the repository) or use `--on` if the tool supports it for map sprites.
7. **Provenance:** update `public/assets/sprites/README.md` for the new sprites and frames (drawn for the project with sprite-tool, the same licence as the rest).
8. **Exclusions:** no scene or domain code; no `FACILITY_SPRITES` entry or sixth plot (step 05); no fort drawing on the world map or sprite constant for it (step 04); no works marker (the design asks only for the fort's palisade).

## 5. Verification

- `npm run sprites:check` passes (the exports match the sources).
- `npm test` passes (including `encampmentView.test.ts` and `unitLook.test.ts`, untouched).
- The atlas contains the new frames, and the anims file the palisade's `idle`:

  ```sh
  grep -o '"camp_lodge/level_[0-9]"' public/assets/sprites/atlas.json | sort -u          # level_1..3
  grep -o '"camp_trading_post/level_[0-9]"' public/assets/sprites/atlas.json | sort -u   # level_1..6
  grep -o '"map_fort[^"]*"' public/assets/sprites/atlas.json public/assets/sprites/atlas.anims.json | sort -u   # map_fort/base, map_fort/idle
  ```

- The frames were viewed (record how, and what was seen), the palisade over `map_resource` included.

## 6. Completion criteria

- [ ] `camp_lodge` has `level_1`, `level_2` and `level_3` on the `building` canvas, each grander than the last, with one footprint.
- [ ] `camp_trading_post` has `level_5` and `level_6`, grander than `level_4`, on the same canvas and footprint.
- [ ] `map_fort` on the `map` canvas, with `base` and an `idle` animation, transparent where the resource icon shows.
- [ ] `npm run sprites:check` and `npm test` pass.
- [ ] `public/assets/sprites/README.md` records the new art.
- [ ] The execution record names the exact sprite, frame and animation names (`camp_lodge/level_1..3`, `camp_trading_post/level_5..6`, `map_fort/base`, `map_fort/idle`), the frames' sizes, and how `map_fort` aligns over `map_resource` (same origin and canvas, or the offset step 04 must apply), for steps 04 and 05.
- [ ] One commit, "Stage 7 step 03: sprites: Lodge, market and fort", no attribution lines, on the step's worktree branch; the index's row 03 updated with status and commit.

## 7. Execution record

**Done (engineer).** Drawn as runs in `art/` with sprite-tool, no generator script; `sprite check` ok, `npm run sprites` built 126 sprites / 255 frames, `npm run sprites:check` up to date, `npm test` 96 files / 2319 tests green. No rule changed, so the 50-campaign guard check was not run. No CLAUDE.md edit was needed (no id-to-asset table touched).

Names for steps 04 and 05:
- `camp_lodge/level_1`, `level_2`, `level_3` (`art/encampment/camp_lodge.sprite.toml`), `building` canvas, 48x48, anchor [24, 48]. Footing at rows 44-46, cols 2-45; shed at cols 12-35; crane mast to col 45 at levels 2-3. The plot origin does not move between levels. Also exported: `camp_lodge` (default frame, level_1).
- `camp_trading_post/level_5` (Market Hall: slate-roofed plastered storey where the sign was) and `level_6` (Trading House: stone storey, gold finial, red pennants), 48x48, same canvas and footprint as `level_4`.
- `map_fort/base` and `map_fort/flutter`, animation `map_fort/idle` (base, flutter, 500 ms), `map` canvas 24x24, anchor [12, 12]. Same canvas and origin as `map_resource`: place it at the same position with no offset. Transparent inside the ring. Front stakes cover the bottom rows (18-22) of the resource icon; sides and back sit at its edge.
- Looked at: `sprite preview` at scales 6 and 12 (all frames) and a composite of `map_resource/base` under `map_fort/base`. The palisade reads over the ore, which stays visible in the middle; the Lodge's levels grow each step and differ from the workshop (timber, not steel).
- Notes: the level 3 milestone is slim and reads a little like a bottle at 1x; accepted. The export also writes the `flutter` frame for the fort.
