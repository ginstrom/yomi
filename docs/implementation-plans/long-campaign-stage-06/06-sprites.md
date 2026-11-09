# Step 06: Sprites: barracks and banners

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-06-multiple-parties.md) (§2 Scenes: "Banner sprites in three colours"; guild hall levels 4 and 5) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) §4.1 (level 4, the Barracks), §5.4 ("a banner per party (three colours) on the world map marker, drawn by a subagent") · [Stages index](../../designs/long-campaign/index.md) ("Sprites")

**Difficulty:** sonnet / opus. The engineer's work is tool work with sprite-tool on text sources, following a written workflow, so `model: "sonnet"` will do. The reviewer should be opus (model unset), because it judges whether the drawings read well at size and fit the existing art, which the checks cannot.

## 1. Objective

Draw the art the stage's scenes need, so that no later step falls back to a missing frame:
- the guild hall's levels 4 and 5 (the Barracks), for the encampment screen once the hall can reach them (step 04 raises `MAX_GUILD_HALL_LEVEL` to 5);
- a banner in each of three colours, crimson, azure and green, to stand beside each party's figure on the world map and in the party bar (step 07).

No game code changes in this step beyond what the sprite pipeline itself needs (its sources and exports).

## 2. Requirements and context

- **S6-R6** (the multi-party UI) needs banners; **S6-R1** (hall levels 4 and 5) needs the hall drawn at those levels. The encampment draws each facility as `camp_<facility>/level_<n>` (`encampmentView.ts`'s `facilityFrame`, existing), so a hall at level 4 or 5 with no such frame would show nothing.
- **The stages index:** "New units, facilities and item icons are drawn with sprite-tool by a subagent, following `docs/designs/sprite-drawing-guidance.md`. A stage is not done while a unit falls back to a placeholder."

### Contract (copied unchanged from the index)

**C7. Sprites (step 06)**

- `camp_guild_hall` gains frames `level_4` and `level_5` (the Barracks).
- Banners: three atlas sprites (or one sprite with three frames/anims, the engineer's choice under `art/CLAUDE.md`), each with an `idle` animation, in crimson, azure and green; their names are recorded in step 06's execution record for `BANNER_SPRITES`.

**Decision 10 (from the index, unchanged):** The party bar is stage 5's right-hand strip, kept at its width: each entry gains its banner (colour by party number: 1 crimson, 2 azure, 3 green), and its hover summary leads with the party's name. The left column keeps showing the selected party's members. On the map every party is drawn, its first member's figure with its banner; several on one hex are offset.

So party 1's banner is crimson, party 2's azure and party 3's green.

### Shared constraints (from the index)

- **Sprites** are drawn with sprite-tool by following `art/CLAUDE.md` and `docs/designs/sprite-drawing-guidance.md`; never edit an exported PNG; `npm run sprites` then `npm run sprites:check`.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npm run test:browser` after any scene change (none here).
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) is untouched by this step and must stay green; this step changes no rule, so the 50-campaign check need not be run (say so in the record).
- **Commits.** One commit for this step once `npm test` passes, on `long-campaign-stage-06`, without pushing. Never switch branches. The message is "Stage 6 step 06: sprites: barracks and banners", with no attribution lines.
- **Docs.** CLAUDE.md stays current. This step adds no table mapping ids to assets (step 07 adds `BANNER_SPRITES` and its CLAUDE.md line), so it should need no CLAUDE.md edit; check.

## 3. Dependencies and prerequisites

- **None.** This step may run in parallel with any other step (it touches only `art/` and the exported atlas). Step 07 consumes the banners; step 04 (or its in-browser checks) and step 08 benefit from the hall frames.
- **Existing (at `63d2ea1`):**
  - `art/CLAUDE.md`: the sprite-tool workflow; read it before drawing (it loads by itself when you work in `art/`).
  - `docs/designs/sprite-drawing-guidance.md`: how to draw for this project.
  - `art/encampment/camp_guild_hall.sprite.toml`: frames `level_1` to `level_3` on the 48px `building` canvas.
  - `art/map/`: the world map's sprites (`map_encampment`, `map_monsters`, `map_resource`, `map_watchtower`, `map_blight`), each with an `idle` animation; use them for the map's scale and style.
  - `art/palette.toml` and `art/sprite-tool.toml`: the palette and the tool's config.
  - `public/assets/sprites/`: the exported `atlas.png`, `atlas.json`, `atlas.anims.json`, and `README.md` (provenance and licence).

## 4. Scope and guidance

1. **Read first:** `art/CLAUDE.md` and `docs/designs/sprite-drawing-guidance.md`. Look at `camp_guild_hall`'s three levels and at `map_watchtower` and `map_encampment` for the map's scale.
2. **The Barracks.** Add `level_4` and `level_5` to `art/encampment/camp_guild_hall.sprite.toml`, on the same 48px `building` canvas:
   - each grander than the level before (level 3 is the current top): for example, level 4 adds a barracks wing or a second storey with a yard, level 5 a tower or more banners and a palisade gate;
   - keep the same footprint origin and lighting as levels 1–3 so the plot does not jump when the level rises.
3. **The banners.** Add banner sprites under `art/map/`: a small flag on a pole, sized to stand beside a party's figure on a world-map hex without hiding it.
   - Three colours: crimson (party 1), azure (party 2), green (party 3), using palette colours (add to `art/palette.toml` only if the palette lacks a fitting one).
   - Each has an `idle` animation (a gentle flutter of a few frames), as the other map sprites have.
   - Either three sprites (for example `map_banner_crimson`, `map_banner_azure`, `map_banner_green`) or one sprite with three frame sets/animations; choose by what `art/CLAUDE.md` recommends. The names are the contract step 07 reads.
   - The same sprite will be shown in the party bar at the portrait's corner (step 07), so it must read at its native size.
4. **Export:** `npm run sprites`, then `npm run sprites:check` (must pass).
5. **Look at the result:** view the exported frames (the atlas PNG, or the tool's previews per `art/CLAUDE.md`) at 1× and enlarged, and check that the hall's levels 4 and 5 and the three banners read clearly and match the style.
6. **Provenance:** update `public/assets/sprites/README.md` for the new sprites and frames (drawn for the project with sprite-tool, the same licence as the rest).
7. **Exclusions:** no scene or domain code; no `BANNER_SPRITES` table (step 07); no new item icons or units.

## 5. Verification

- `npm run sprites:check` passes (the exports match the sources).
- `npm test` passes (including `encampmentView.test.ts` and `unitLook.test.ts`, untouched).
- The atlas (`public/assets/sprites/atlas.json`) contains `camp_guild_hall/level_4`, `camp_guild_hall/level_5`, and the banners' frames; `atlas.anims.json` contains each banner's `idle` animation. Check with, for example, `grep -o '"camp_guild_hall/level_[0-9]"' public/assets/sprites/atlas.json | sort -u`.
- The frames were viewed (record how, and what was seen).

## 6. Completion criteria

- [ ] `camp_guild_hall` has `level_4` and `level_5`, grander than `level_3`, on the same canvas.
- [ ] Three banners (crimson, azure, green), each with an `idle` animation, exported into the atlas.
- [ ] `npm run sprites:check` and `npm test` pass.
- [ ] `public/assets/sprites/README.md` records the new art.
- [ ] The execution record names the exact banner sprite and animation names for step 07's `BANNER_SPRITES` (by banner number 1, 2, 3), and the frames' size.
- [ ] One commit, "Stage 6 step 06: sprites: barracks and banners", no attribution lines; the index's row 06 updated with status and commit.

## 7. Execution record


### Execution (engineer)

- `art/encampment/camp_guild_hall.sprite.toml`: `level_4` (the Barracks, a long timber hall with a chimney behind the guild hall) and `level_5` (a pennant on its ridge, gold ridge-line, crossed blades over its middle), derived from `level_3`, same 48px `building` canvas and footprint.
- Banners: `art/map/map_banner.sprite.toml` (crimson) with variants `azure` and `green`, 24px `map` canvas, frames `base`, `flutter_1`, `flutter_2`, anim `idle` (4 beats, 220 ms). Variants export idle animations too.
- **For step 07's `BANNER_SPRITES` (banner 1, 2, 3):** `map_banner`, `map_banner_azure`, `map_banner_green`; animation `<sprite>/idle`; frames 24x24 (pole at column 11, flag at rows 2-9, pole foot at row 20).
- Viewed with `sprite preview ... --scale 8` and at display size; the first Barracks floated above the hall, fixed by running its wall down behind the hall's roof.
- README provenance updated; no CLAUDE.md edit needed (no new id-to-asset table).
- Checks: `npm run sprites:check` up to date (124 sprites, 248 frames); `npm test` 1407 passed. Guard untouched; 50-campaign check not run (no rule change).

### Review round 1

Found 4, fixed 4 (commit 6ad9a75 and the record commit): the Barracks wall has timber framing, windows and a dark edge along the hall roof slopes; level 5 adds a palisade with a gate and a hung banner across the front; the banner tail lifts and drops a full row; the index row carries the commits. Previews regenerated; sprites:check up to date, npm test 1407 passed.
