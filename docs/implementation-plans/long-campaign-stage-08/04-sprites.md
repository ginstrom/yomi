# Step 04: Sprites: partners and the Lodge

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-08-trade-routes.md) (§2 Scenes: "Partner sprites (two settlements)"; "Partner icons, greyed when silent") · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.3 (Millbrook, a farming village; Saltmere, a fishing port on the south coast), §4.5 · [Stages index](../../designs/long-campaign/index.md) ("Sprites") · [Feature record](../../features/long-campaign-stage-08.md) (carried forward from stage 7: the Lodge level 3 sprite)

**Difficulty:** sonnet / opus. The engineer's work is tool work with sprite-tool on text sources, following a written workflow, so `model: "sonnet"` will do. The reviewer should be opus (model unset), because it judges whether the drawings read well at size, when greyed, and beside the existing art, which the checks cannot.

## 1. Objective

Draw the art the stage's scenes need, so that no later step falls back to a missing or placeholder frame:
- a map icon for each trade partner: Millbrook (a farming village) and Saltmere (a fishing port), drawn on the world map by step 05 and greyed there when the partner is silent;
- a redraw of the Builders' Lodge's level 3 (`camp_lodge/level_3`), which becomes reachable in this stage (step 03 lifts the Lodge's limit) and which stage 7's review found weak.

No game code changes in this step beyond what the sprite pipeline itself needs (its sources and exports).

## 2. Requirements and context

- **S8-R1** and **S8-R6** (design §2, Scenes): "Partner icons, greyed when silent" and "Partner sprites (two settlements)". Reference §4.3: Millbrook is a farming village (good: timber); Saltmere is a fishing port on the south coast (good: salt). Reference §4.5: "Partners have their own icon, and a silent partner is greyed."
- **S8-R5** (roads at Lodge 3): the Lodge's level 3 is the level that brings roads; its frame should read as a road-mason's yard.
- **Carried forward from stage 7** (feature record): the `camp_lodge/level_3` frame drawn in stage 7 has a milestone that reads as a bottle at 1x, its paving is faint, and the step from level 2 to level 3 is weak at 1x. It is to be redrawn now that level 3 becomes reachable.
- **How the scenes will use the art** (step 05, not this step): the world map draws each location by an atlas sprite with an `idle` animation (`LOCATION_SPRITES` in `src/scenes/WorldScene.ts`, played from frame `base`) at 2x (`LOCATION_SCALE`), and step 05 adds `PARTNER_SPRITES` keyed by partner id. A silent partner's sprite is tinted grey (`0x9e9e9e`) with Phaser's `setTint`, so the icon must still read when multiplied by that grey. The encampment draws each facility as `camp_<facility>/level_<n>` (`encampmentView.ts`'s `facilityFrame`, existing).
- **The stages index:** "New units, facilities and item icons are drawn with sprite-tool by a subagent, following `docs/designs/sprite-drawing-guidance.md`. A stage is not done while a unit falls back to a placeholder." Until step 05, step 01 makes the map draw a partner with `map_resource` (a temporary placeholder for `tsc`); this step supplies the real icons.

### Contract (copied unchanged from the index)

**C4. Sprites (step 04)**

- `map_partner_village` (Millbrook, a farming village: thatched cottages, a granary or windmill, a strip of field) and `map_partner_port` (Saltmere, a fishing port on the coast: a quay, a boat, salt pans), each on the 24px `map` canvas with frame `base` and an `idle` animation, distinct at a glance from `map_encampment` and `map_resource`, and readable when tinted grey (silent).
- `camp_lodge/level_3` redrawn (stage 7's note: the milestone reads as a bottle, the paving is faint, the 2 → 3 step is weak at 1x): a clearly paved road and a milestone that reads as stone, a plain step up from `level_2`, same canvas, footprint and anchor.

### Shared constraints (from the index)

- **Sprites** follow `.claude/skills/yomi-sprites/` (`art/CLAUDE.md`, `docs/designs/sprite-drawing-guidance.md`); never edit an exported PNG; `npm run sprites` then `npm run sprites:check`, then the `yomi-asset-check` agent (`.claude/agents/yomi-asset-check.md`).
- **Content.** A new location kind's sprite is one line of `.claude/skills/yomi-add-content/location-kind.md` ("an atlas sprite `map_<kind>` with `idle`"); here the partner kind gets one sprite per partner, named in C4, and the `LOCATION_SPRITES` / `PARTNER_SPRITES` entries are step 05's.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npm run test:browser` after any scene change (none here).
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) is untouched by this step and must stay green; this step changes no rule, so the 50-campaign check need not be run (say so in the record).
- **Commits.** One commit for this step once `npm test` passes, without pushing; files staged by path. This step runs in its own worktree and commits on its own branch, merged into `long-campaign-stage-08` by the orchestrator. The message is "Stage 8 step 04: sprites: partners and the Lodge", with no attribution lines.
- **Docs.** CLAUDE.md files stay current. This step adds no table mapping ids to assets (the map's partner sprite tables are step 05's), so it should need no CLAUDE.md edit; check.

## 3. Dependencies and prerequisites

- **None.** This step may run at any time, in its own git worktree (it touches only `art/` and `public/assets/sprites/`). It must be merged into the stage branch **before step 05** (which draws `map_partner_village` and `map_partner_port` on the world map) **and step 08** (whose screenshots show the encampment with the Lodge and the map with the partners).
- **Existing (at `42cde46`):**
  - `art/CLAUDE.md`: the sprite-tool workflow (it loads by itself when you work in `art/`); `docs/reference/sprites.md`: canvases and scales.
  - `docs/designs/sprite-drawing-guidance.md`: how to draw for this project.
  - `art/map/`: `map_encampment`, `map_resource`, `map_monsters`, `map_watchtower`, `map_fort`, `map_banner`, `map_blight` (`canvas = "map"`, 24px, each with an `idle` animation): the world map's scale and style. The partner icons must not be mistaken for `map_encampment` (the player's own camp) or `map_resource`.
  - `art/encampment/camp_lodge.sprite.toml`: frames `level_1`, `level_2`, `level_3` on the 48px `building` canvas, anchor [24, 48] (stage 7 step 03: footing at rows 44–46, cols 2–45; shed at cols 12–35; crane mast to col 45 at levels 2–3; the default frame is `level_1`). Other encampment sources (`camp_trading_post`, `camp_guild_hall`, `camp_workshop`, …) set the style.
  - `art/palette.toml` and `art/sprite-tool.toml`: the palette and the tool's config.
  - `public/assets/sprites/`: the exported `atlas.png`, `atlas.json`, `atlas.anims.json`, `.sprite-tool-manifest.json` and `README.md` (provenance and licence).

## 4. Scope and guidance

1. **Read first:** `art/CLAUDE.md`, `docs/designs/sprite-drawing-guidance.md`, and run `sprite guide --project art`. Look (with `sprite show` and `sprite preview`) at `map_encampment`, `map_resource`, `map_watchtower` and `camp_lodge` (all three levels) for scale and style.
2. **Millbrook.** New `art/map/map_partner_village.sprite.toml` (for example `sprite new map_partner_village --canvas map --project art --dir map`): a farming village of two or three thatched cottages, a granary or a windmill, and a strip of tilled or golden field. Frame `base` and an `[anim.idle]` (a windmill's sails turning over two or three frames, or smoke from a chimney; a single held frame is acceptable).
3. **Saltmere.** New `art/map/map_partner_port.sprite.toml` on the `map` canvas: a fishing port on the coast, with a quay or jetty, a small boat, water at one edge, and white salt pans. Frame `base` and an `[anim.idle]` (the boat bobbing or water shimmering over two frames; a single held frame is acceptable).
4. **Both partner icons:** the same footprint and visual weight as `map_resource` and `map_encampment`, so labels and the hex grid line up; distinct at a glance from the encampment (tents and fire) and from a resource; with enough value contrast that, multiplied by grey `0x9e9e9e` (a silent partner), the shapes still read. Check that by previewing a greyed copy (for example, multiply the exported PNG by the grey in a scratch script outside the repository).
5. **The Lodge's level 3.** Redraw `level_3` in `art/encampment/camp_lodge.sprite.toml`: a clearly paved road (setts or flagstones with visible joints, in contrast against the ground) running out of the yard, and a milestone that reads as dressed stone (a squat block with a carved mark or a rounded top and a darker face, not a narrow bottle shape); a plain step up from `level_2` at 1x (more stone, the paved road, perhaps a second crane arm or a mason's banner). Keep the canvas, the footprint and the anchor [24, 48] as `level_1` and `level_2`, so the plot does not jump when the level rises. Leave `level_1` and `level_2` unchanged.
6. **Export:** `npm run sprites`, then `npm run sprites:check` (must pass). Commit everything the build writes into `public/assets/sprites/`, the manifest included. Then run the `yomi-asset-check` agent and record its verdict.
7. **Look at the result:** view the exported frames at 1x, at the map's 2x and enlarged (`sprite preview <id> --project art --scale 8`), and check that both partner icons and the Lodge's three levels read clearly and match the style; compare `level_2` and `level_3` side by side at 1x.
8. **Provenance:** update `public/assets/sprites/README.md` for the new sprites and the redrawn frame (drawn for the project with sprite-tool, the same licence as the rest).
9. **Exclusions:** no scene or domain code; no `LOCATION_SPRITES` or `PARTNER_SPRITES` entry, no grey tint (step 05); no road overlay art (step 05 draws the roads with Graphics); no other Lodge or trading post frames.

## 5. Verification

- `npm run sprites:check` passes (the exports match the sources); the `yomi-asset-check` agent reports pass.
- `npm test` passes (including `encampmentView.test.ts` and `unitLook.test.ts`, untouched).
- The atlas contains the new frames, and the anims file their `idle`:

  ```sh
  grep -o '"map_partner_village[^"]*"' public/assets/sprites/atlas.json public/assets/sprites/atlas.anims.json | sort -u   # map_partner_village/base, map_partner_village/idle
  grep -o '"map_partner_port[^"]*"' public/assets/sprites/atlas.json public/assets/sprites/atlas.anims.json | sort -u      # map_partner_port/base, map_partner_port/idle
  grep -o '"camp_lodge/level_[0-9]"' public/assets/sprites/atlas.json | sort -u                                            # level_1..3, still
  ```

- The frames were viewed (record how, and what was seen), including each partner icon greyed and the Lodge's `level_2` beside `level_3` at 1x.

## 6. Completion criteria

- [ ] `map_partner_village` and `map_partner_port` on the `map` canvas, each with `base` and an `idle` animation, distinct from `map_encampment` and `map_resource`, readable greyed.
- [ ] `camp_lodge/level_3` redrawn: clear paving, a stone milestone, a plain step up from `level_2`; same canvas, footprint and anchor; `level_1` and `level_2` unchanged.
- [ ] `npm run sprites:check` and `npm test` pass; `yomi-asset-check` passes.
- [ ] `public/assets/sprites/README.md` records the new and redrawn art.
- [ ] The execution record names, for step 05, the exact sprite, frame and animation names (`map_partner_village/base`, `map_partner_village/idle` and any extra frames; the same for `map_partner_port`), the canvas size and anchor of each, and whether they sit at the same origin as `map_resource` (no offset) or need one; and for step 08, that `camp_lodge/level_3` keeps its anchor.
- [ ] One commit, "Stage 8 step 04: sprites: partners and the Lodge", no attribution lines, files staged by path, on the step's worktree branch; the index's row 04 updated with status and commit.

## 7. Execution record

Engineer: sonnet-tier brief, run on worktree branch `long-campaign-stage-08-sprites` (from `long-campaign-stage-08` at c4bc8fa). Per the orchestrator, the index and `log.md` were not edited here (the report lists the lines to add).

**Drawn** (sprite-tool 0.7.0, runs, `outline = "auto"`):
- `art/map/map_partner_village.sprite.toml` (Millbrook): windmill, two thatched cottages, golden field. Frames `base`, `turn`; animation `idle` = base, turn, base, turn at 500 ms (sails turn from a plus to an X).
- `art/map/map_partner_port.sprite.toml` (Saltmere): tiled hut, salt heap and two salt pans on the shore, a jetty, a sailing boat on blue water. Frames `base`, `swell`; animation `idle` = base, swell at 600 ms.
- `camp_lodge/level_3` redrawn in `art/encampment/camp_lodge.sprite.toml`: the milestone is now a squat 6x8 block with a pale lit face, a darker right face and a carved dark mark (no bottle neck); the paving is 28 px wide flagstones in light tan with dark-brown joints (rows 44-46, cols 10-37) in place of the faint t/T checker. `level_1` and `level_2` untouched.

**For step 05:** atlas frames `map_partner_village/base`, `map_partner_village/turn`, `map_partner_port/base`, `map_partner_port/swell`; animations `map_partner_village/idle`, `map_partner_port/idle`. Canvas `map`, 24x24, anchor [12, 12], display scale 2: same canvas, anchor and origin as `map_resource` and `map_encampment`, so no offset. Unlike `map_resource`, the drawings fill nearly the whole 24 px width, so labels beside them should clear that. **For step 08:** `camp_lodge/level_3` keeps canvas `building` 48x48 and anchor [24, 48]; its paving spans cols 10-37 at the footing, inside the footing's cols 2-45.

**Checks:** `sprite check --project art`: ok, 128 sprites, 259 frames. `npm run sprites` built; `npm run sprites:check`: up to date. `yomi-asset-check` agent: PASS (no pin drift). `npm test` (after `npm ci`, as the worktree had no node_modules): 100 files, 2417 tests pass. Refactor guard untouched; no rule changed, so the 50-campaign check was not run. No CLAUDE.md edit needed (no id-to-asset table added). `public/assets/sprites/README.md` updated.

**Review round 1** (found 4, fixed 4): the paving was timber-coloured and is now W/l flagstones with M joints in a staggered bond across cols 8-43 (rows 44-46); the port is now two huts on grass with flat salt pans and a heap, and a small stepped bay at the lower left (rows 13-20); both partner icons moved up one row, so their bottom outline is row 21 like `map_encampment` and `map_resource` (the village's tallest sail now starts at interior row 1); the village `idle` is `["base", "turn"]`. Grey check redone: `grey6x_r2.png` in the scratchpad.

**Review round 2** (found 2, fixed 2): the port's grass fill is gone, so the background is transparent and the outline follows the objects (two huts on a two-row ground strip, flat pans and heap on a one-row strip, the stepped bay with the boat); and Lodge row 45 is now 36 characters. Previews: `grey6x_r3.png`, `map_partner_port_r3.png` in the scratchpad.

**Viewed (first draw):** `sprite preview ... --scale 8` and plain strips of the village, port and Lodge (all three levels, 1x and enlarged). Village reads as windmill and cottages; port as hut, pans, jetty and boat on water; both are clearly unlike the red-roofed `map_encampment` and the ore heap `map_resource`. A greyed copy (multiply by 0x9e9e9e in Chromium via a scratch script, beside encampment and resource) still reads: sails, cottages, boat, jetty and pans keep their shapes. At 1x, level_3 beside level_2 shows the stone milestone, chimney, compass and paved strip, a visible step up. Judgement call: the port is a mostly filled rectangle (water takes the lower half); a reviewer may want a more irregular silhouette. Previews: `/private/tmp/claude-501/-Users-ryan-personal-yomi/7c54671b-04fd-4886-90c6-bd80ec249d26/scratchpad/` (`map_partner_village.plain.png`, `map_partner_port.plain.png`, `camp_lodge.plain.png`, `grey6x.png`).
