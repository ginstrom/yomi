# Step 05: Sprites for rings 9 and 12

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-11-high-roster.md) (§2 "Sprites: 14 units, drawn ring by ring", §7 "Sprites as the bottleneck") · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.5 (the roster) · [Stages index](../../designs/long-campaign/index.md) ("Sprites") · [Stage 10's sprite step](../long-campaign-stage-10/05-workshop-sprites.md) (the workflow it used) · [Plan log](log.md)

**Difficulty:** sonnet / opus. Tool work with sprite-tool on text sources, following a written workflow, so `model: "sonnet"` will do. The reviewer should be opus (model unset): it judges whether each unit reads as its kind at battle scale and beside the rest of the roster, which the checks cannot.

## 1. Objective

Draw the four unit sprites for rings 9 and 12, so that steps 09 and 10 can add their kinds without a unit falling back to a placeholder (`src/scenes/unitLook.test.ts` fails for a `UnitKind` with no sprite):
- `wyvern` (ring 9, step 09);
- `barrow_wight`, `basilisk`, `hill_giant` (ring 12, step 10).

No game code changes: only the sprite sources and the exported atlas.

## 2. Requirements and context

- **S11-R1** (design §3): each kind has a sprite. Design §2: "Sprites: 14 units, drawn ring by ring"; §7: "Delegate them per ring, in parallel with the blocks".
- **Stages index, "Sprites":** new units are drawn with sprite-tool by a subagent, following `docs/designs/sprite-drawing-guidance.md`. A stage is not done while a unit falls back to a placeholder.
- **Decision 9 (from the index, unchanged):** **Sprites: 13** *(for the user, Q9)*: the design says 14; its table names 12 new kinds, and the rebuilt Horror is a 13th (decision 3). The plan draws 13. This step draws 4 of them.
- **Decision 11, in part (from the index, unchanged):** the wolf's pack bonus, the wyvern's flight and the wight's half damage from non-magic weapons stay out (plain blocks). So the wyvern **walks**: draw its `walk` as a gait on the ground (wings may half-open for balance), not a flight.

### What each kind is (campaign §5.5 and C3)

| Kind | Name | Native | Role (campaign §5.5) | Defence | Special | Look to draw |
| --- | --- | --- | --- | --- | --- | --- |
| `wyvern` | Wyvern | 9 | flyer (moves over units: deferred) | res 2 | `wyvern_strikes` (Bite, then a Tail Sting laying poison) | a winged drake, two legs and two wings, a long tail ending in a barbed sting; walks |
| `barrow_wight` | Barrow Wight | 11 | undead | res 3 | spells `drain_life` | pale, gaunt, undead, in corroded grave armour (old mail, a burial crown or circlet), faint cold glow in the eyes |
| `basilisk` | Basilisk | 11 | slow, tough | res 4 | `basilisk_gaze` (cone 3, lays Chilled) | low and heavy, many-legged or squat lizard, thick plated hide, a prominent baleful eye or eyes (the gaze) |
| `hill_giant` | Hill Giant | 12 | heavy | res 3 | weapon Club; `giant_rock` (thrown, range 4) | a huge rough humanoid, hide and furs, a great club; visibly **larger than the ogre** (step 04's `ogre`) |

### Contract (copied unchanged from the index)

**C8. Sprites (steps 04 to 07)**

`art/units/<kind>.sprite.toml` for each C3 kind, `idle` and `walk` animations and `[points] chest`, built into `public/assets/sprites/`: step 04 `wolf`, `worg_rider`, `ogre`; 05 `wyvern`, `barrow_wight`, `basilisk`, `hill_giant`; 06 `stone_golem`, `blight_cultist`, `young_dragon`; 07 `blight_lich`, `elder_wyrm`, `source_horror`. Bosses (dragon, lich, wyrm, `source_horror`) on the largest unit canvas `docs/reference/sprites.md` allows. Nothing in `src/` changes.

The C3 rows of this step's kinds (copied unchanged from the index; for reference only, the stat blocks are steps 09 and 10's):

| Kind | Name | Native | XP | Defence | Special (C4) | Step |
| --- | --- | --- | --- | --- | --- | --- |
| `wyvern` | Wyvern | 9 | 150 | res 2 | `wyvern_strikes` | 09 |
| `barrow_wight` | Barrow Wight | 11 | 110 | res 3 | spells `drain_life` | 10 |
| `basilisk` | Basilisk | 11 | 150 | res 4 | `basilisk_gaze` | 10 |
| `hill_giant` | Hill Giant | 12 | 200 | res 3 | weapon Club; `giant_rock` | 10 |

The sprite id is the `UnitKind` id exactly (`wyvern`, `barrow_wight`, `basilisk`, `hill_giant`): steps 09 and 10 add these kinds, and `unitLook.test.ts` looks each kind up in the atlas by that id.

### Shared constraints (from the index)

- **Content.** Sprites: `.claude/skills/yomi-sprites/` (`art/CLAUDE.md`, `docs/reference/sprites.md`, `docs/designs/sprite-drawing-guidance.md`); never edit an exported PNG; `npm run sprites`, `npm run sprites:check`, then the `yomi-asset-check` agent.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit.
- **The refactor guard** must stay green and is not edited. This step changes no rule the campaign plays, so the 50-campaign check is not run, and it runs **no simulation** (say so in the record).
- **Commits.** One commit once `npm test` passes, without pushing; files staged by path. A sprite step runs in its own worktree and commits on its own branch, merged by the orchestrator before its ring step. Message "Stage 11 step 05: sprites for rings 9 and 12". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines the change makes wrong (none expected); `docs/reference/sprites.md` only if it lists the unit sprites.

## 3. Dependencies and prerequisites

- **None among the plan's steps.** Runs at any time, **in its own git worktree** off `long-campaign-stage-11`: it touches only `art/units/` and `public/assets/sprites/`.
- **Must be merged before step 09** (which adds `wyvern`) **and step 10** (which adds `barrow_wight`, `basilisk`, `hill_giant`); neither can commit without these frames.
- **Shared build outputs.** The atlas (`atlas.png`, `atlas.json`, `atlas.anims.json`) and `.sprite-tool-manifest.json` are rebuilt from every source. If another sprite step (04, 06 or 07) was merged into the stage branch before this one, merge or rebase onto the stage branch first and run `npm run sprites` again **after** taking its sources, so this step's atlas holds every unit; never hand-merge atlas files. Step 04's `ogre` in particular is the size reference for `hill_giant`: if it is merged, compare against it; if not, compare against `troll` and `armored_troll` and note it for the reviewer.
- **Existing (at `1a008af`):**
  - `art/CLAUDE.md` (the sprite-tool workflow and contracts), `docs/reference/sprites.md` (unit canvases and scales, animation frames, points), `docs/designs/sprite-drawing-guidance.md`.
  - `.claude/skills/yomi-sprites/`: `SKILL.md`, `workflow.md` (`sprite new` per kind, the manifest, what to commit), `drawing.md`.
  - `art/units/`: today's units to match in style and scale: `troll`, `armored_troll`, `giant_spider`, `salamander`, `horror`, `hobgoblin`, `goblin`, `kobold`, the bandits; each with `idle`, `walk` and `[points] chest`.
  - `art/palette.toml`, `art/sprite-tool.toml`.
  - `public/assets/sprites/`: `atlas.png`, `atlas.json`, `atlas.anims.json`, `.sprite-tool-manifest.json`, `README.md` (provenance and licence).

## 4. Scope and guidance

1. **Read first:** the yomi-sprites skill files, `art/CLAUDE.md`, `docs/reference/sprites.md` (which unit canvas each size of creature takes), `docs/designs/sprite-drawing-guidance.md`; run `sprite guide --project art`. Look (`sprite show`, `sprite preview --grid`) at `troll`, `armored_troll`, `salamander`, `giant_spider` and `horror`, and at step 04's `wolf`, `worg_rider` and `ogre` if merged.
2. **Create** each with `sprite new` as `workflow.md` says, in `art/units/<kind>.sprite.toml`, with `idle` and `walk` animations (the frame counts `docs/reference/sprites.md` gives for units) and a `[points] chest` where shots and spells are aimed and fly from (`unitLook.test.ts` does not enforce the point; check it by hand).
3. **Draw** (see §2's table):
   - `wyvern`: wings folded or half-spread at idle, a sting held high over the back; a ground gait in `walk`. The largest of the four's silhouettes after the giant; not on a boss canvas.
   - `barrow_wight`: thin and upright, cold pale skin or bone, dark corroded mail, a burial circlet; reads as a caster-undead, not a skeleton warrior.
   - `basilisk`: wide and low, slow heavy `walk`; the eye or eyes the brightest point, so the gaze reads at battle scale.
   - `hill_giant`: the tallest and broadest of the four, a club over the shoulder or dragging; clearly larger than the ogre; within the largest non-boss unit canvas, so it does not crowd neighbouring hexes.
   - Each distinct from the others and from today's foes in silhouette and colour at battle scale; consistent outline, light direction and palette with the existing units.
4. **Export:** `npm run sprites`, then `npm run sprites:check` (must pass). Commit everything the build writes into `public/assets/sprites/`, the manifest included. Then run the `yomi-asset-check` agent and record its verdict.
5. **Look at the result:** each sprite at 1x, at battle scale, and enlarged (`sprite preview <id> --project art --scale 8`), side by side with `troll`, `salamander`, `horror` and (if merged) `ogre`; renders kept outside the repository (scratchpad or `logs/`). Note in the record anything the reviewer should look at.
6. **Provenance:** update `public/assets/sprites/README.md` for the four new sprites (drawn for the project with sprite-tool, the same licence as the rest).
7. **Exclusions:** no `src/` change (no kind, scene, domain or test code: steps 09 and 10 add the kinds); no other sprite; no rule change; no simulation.

## 5. Verification

- `sprite check --project art` prints `ok`; `npm run sprites:check` passes; the `yomi-asset-check` agent reports pass.
- `atlas.json` and `atlas.anims.json` hold `wyvern`, `barrow_wight`, `basilisk` and `hill_giant`, each with `idle` and `walk`.
- `npm test` passes (nothing in `src/` changed; `unitLook.test.ts` is unaffected until steps 09 and 10 add the kinds).
- `git diff --stat` against the stage branch shows only `art/units/` and `public/assets/sprites/` (and this task file and the index's row 05).
- No simulation run (say so).

## 6. Completion criteria

- [x] Four sources in `art/units/` (`wyvern`, `barrow_wight`, `basilisk`, `hill_giant`), each with `idle`, `walk` and `[points] chest`.
- [x] The atlas rebuilt with every unit, including any sprite step merged before this one; `sprites:check` and the asset check pass.
- [x] Provenance updated.
- [x] Renders compared beside the roster; notes for the reviewer recorded.
- [x] One commit on this step's worktree branch, "Stage 11 step 05: sprites for rings 9 and 12", files staged by path, no attribution lines; the index's row 05 updated with status and commit, ready for the orchestrator to merge before steps 09 and 10.

## 7. Execution record

Sprites commit 5bc31dc, on `long-campaign-stage-11-sprites-05` (cut from step 04's d7fb2e7, so the atlas holds wolf, worg_rider and ogre too).

- Drawn: `wyvern` (blue-slate drake on two legs, half-open violet wing, tail curled up to an acid sting; rows 3-30), `barrow_wight` (man-sized, pale head, gold circlet, dark mail, cyan eyes, glowing hand; rows 5-30, about 14 columns), `basilisk` (low, six-pixel-thick stone-brown lizard, back spines, cyan-white eye brightest; rows 14-30), `hill_giant` (blue-grey-blue hide, fur mantle, boulder-fist left, club grounded right; fills rows 1-30 and columns 1-30, so the same height as the ogre and broader, with a small head).
- Colour: the giant is blue so it is not mistaken for the ogre (flesh), troll (green) or the coming stone golem (grey).
- Walk frames: only leg rows differ; every walk frame was read with `sprite show <id> --frame`; runs on a row never overlap (adjacent legs are one run). The giant's stride is one leg reaching back (the club side is fixed by the canvas edge).
- Renders (outside the repo): `/private/tmp/claude-501/-Users-ryan-personal-yomi/6b9b93b7-3933-4bd1-a198-fa82ad0fff0d/scratchpad/step05-roster-x6.png` (troll, ogre, hill_giant, wyvern, basilisk, barrow_wight, salamander, horror; idle, walk frames, and display scale).
- Verification: `npm test` runlog #10 (107 files, 2740 tests passed); `npm run sprites:check` runlog #12 (up to date: 138 sprites, 303 frames); `sprite check --project art` ok. No simulation run. Nothing in `src/` changed.
- For the reviewer: the club (a plain brown block with the head resting on the ground) is the weakest read; the wyvern's wing is a triangular sail; the wight's walk_0 stride spreads the pale shins.

### Review round 1

Found (hill giant, wight, wyvern); all fixed in 3d0e480.
- Giant: club now upright over the right shoulder with a shaded wood head, `l` studs and a two-pixel shaft; chest smile replaced by one vertical shade line; face is a brow row over two eyes; the boulder in the left fist shows `m`/`a` stone; header comment matches the pixels; the walk parts both legs (rows 26-30) with non-overlapping runs.
- Wight: legs are dark greaves (no white stockings); `walk_0` strides 1-2 px, no X.
- Wyvern: the wing's `V` dots became two ribs fanning from the shoulder.
- Deviation (accepted by the coordinator): the giant is the ogre's height and about 2 px broader, not "visibly larger" as task section 2 asks; the 32px canvas cannot give more.
- Verification at 3d0e480: `npm test` runlog #18 (2740 passed), `npm run sprites:check` runlog #20 (up to date). Renders: `.../scratchpad/step05-fix-x6.png`, `.../scratchpad/step05-fix-display.png` (scratchpad `/private/tmp/claude-501/-Users-ryan-personal-yomi/6b9b93b7-3933-4bd1-a198-fa82ad0fff0d/scratchpad/`).

### Review round 2

Opus reviewer: clean. Blocking 1 and the small findings resolved; the giant's size stays an accepted deviation. No code change.
