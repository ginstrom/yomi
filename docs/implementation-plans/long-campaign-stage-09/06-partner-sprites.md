# Step 06: Partner sprites

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-09-outer-rings.md) (§2 "Partners", §4 "What the player sees": "the mountain hold of Stonehollow and the forest people of Elder Glade") · [Economy reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.3 (Stonehollow a mountain hold, Elder Glade a forest people, Emberwatch a fortified pass) · [Stages index](../../designs/long-campaign/index.md) ("Sprites") · [Stage 8's sprite step](../long-campaign-stage-08/04-sprites.md) (the workflow it used)

**Difficulty:** sonnet / opus. Tool work with sprite-tool on text sources, following a written workflow, so `model: "sonnet"` will do. The reviewer should be opus (model unset): it judges whether the drawings read at map scale, greyed, and beside the existing partner icons, which the checks cannot.

## 1. Objective

Draw a world-map icon for each of the three far trade partners that step 05 places, so step 07 can give each its own sprite instead of the fallback `map_partner_village`:
- `map_partner_hold`: Stonehollow, a mountain hold;
- `map_partner_glade`: Elder Glade, a forest people's glade;
- `map_partner_pass`: Emberwatch, a fortified pass.

No game code changes: only sprite sources and the exported atlas.

## 2. Requirements and context

- **S9-R4** (design §2): Stonehollow, Elder Glade and Emberwatch are added. The design lists no sprites; this step is the plan's addition.
- **Decision 8 (from the index, unchanged):** *Partner sprites are added* *(for the user's eye)*: the design lists no sprites, but stage 8 gave each partner its own, and without new ones a mountain hold, a forest people and a fortified pass would wear Millbrook's village. Step 06 draws three (C6); the orchestrator may drop the step, and the map then falls back to `map_partner_village`. Resource sites share `map_resource` and foes are existing bandit kinds, so no other sprite is needed.
- **How the scene will use the art** (step 07, not this step): `WorldScene` draws a partner with `PARTNER_SPRITES[location.id] ?? LOCATION_SPRITES.partner`, played from frame `base` with its `idle` animation at the map's 2x (`LOCATION_SCALE`). A silent partner's sprite and label are tinted grey (`0x9e9e9e`, `setTint`), so each icon must still read multiplied by that grey.

### Contract (copied unchanged from the index)

**C6. Partner sprites (step 06)**

`map_partner_hold` (Stonehollow, a mountain hold), `map_partner_glade` (Elder Glade, a forest people's glade), `map_partner_pass` (Emberwatch, a fortified pass), each in `art/map/` with the frames and animations `map_partner_village` has, at its size. Step 07 maps them in `PARTNER_SPRITES`.

### Shared constraints (from the index)

- **Content.** Sprites: `.claude/skills/yomi-sprites/` (`art/CLAUDE.md`, `docs/designs/sprite-drawing-guidance.md`); never edit an exported PNG; `npm run sprites` then `npm run sprites:check`, then the `yomi-asset-check` agent.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit.
- **The refactor guard** must stay green; this step changes no rule, so the 50-campaign check is not run (say so in the record).
- **Commits.** One commit once `npm test` passes, without pushing; files staged by path. This step may run in its own worktree and commit on its own branch, merged into `long-campaign-stage-09` by the orchestrator before step 07. Message "Stage 9 step 06: partner sprites". No attribution lines.
- **Docs.** Each step fixes the CLAUDE.md lines its change makes wrong. This step adds no id-to-asset table (that is step 07's `PARTNER_SPRITES`), so it should need no CLAUDE.md edit; check.

## 3. Dependencies and prerequisites

- **None.** May run at any time, in its own git worktree: it touches only `art/` and `public/assets/sprites/`. It must be merged **before step 07** (which maps the sprites) and **step 10** (whose screenshots may show the far partners). If the orchestrator drops this step, step 07 maps nothing and the fallback stands.
- **Existing (at `08854d3`):**
  - `art/CLAUDE.md` (the sprite-tool workflow; loads when you work in `art/`), `docs/reference/sprites.md` (canvases and scales), `docs/designs/sprite-drawing-guidance.md`.
  - `.claude/skills/yomi-sprites/`: `SKILL.md`, `workflow.md`, `drawing.md`.
  - `art/map/map_partner_village.sprite.toml` (Millbrook: `canvas = "map"`, `outline = "auto"`, frames `base` and `turn`, the sails turning, an `[anim.idle]`) and `art/map/map_partner_port.sprite.toml` (Saltmere: frames `base` and `swell`, `[anim.idle] frames = ["base", "swell"]`): the size, frame count, footprint and style to match. Also `map_encampment`, `map_resource`, `map_monsters`, `map_watchtower`, `map_fort`.
  - `art/palette.toml`, `art/sprite-tool.toml`.
  - `public/assets/sprites/`: `atlas.png`, `atlas.json`, `atlas.anims.json`, `.sprite-tool-manifest.json`, `README.md` (provenance and licence).

## 4. Scope and guidance

1. **Read first:** the yomi-sprites skill files, `art/CLAUDE.md`, `docs/designs/sprite-drawing-guidance.md`; run `sprite guide --project art`. Look (`sprite show`, `sprite preview`) at `map_partner_village`, `map_partner_port`, `map_encampment` and `map_resource` for scale and style.
2. **Stonehollow** (`art/map/map_partner_hold.sprite.toml`, `map` canvas): a mountain hold: grey rock peaks or a cliff face with a carved gate or doorway and a lit window, perhaps a banner. Frame `base` and an `[anim.idle]` of two frames (a banner stirring, a light flickering in the gate).
3. **Elder Glade** (`art/map/map_partner_glade.sprite.toml`): a forest people's glade: two or three tall, dark-green trees with a dwelling among or under them (a round hut, a tree-house, a ring of standing stones), distinct from a plain wood. `base` and a two-frame `idle` (leaves swaying, a firefly or a lantern glow).
4. **Emberwatch** (`art/map/map_partner_pass.sprite.toml`): a fortified pass: a stone wall or gatehouse spanning a gap between two rock shoulders, with a beacon or brazier on top (the "ember"). `base` and a two-frame `idle` (the beacon's flame flickering).
5. **All three:** the same footprint, visual weight and baseline as `map_partner_village` and `map_partner_port`, so labels and the hex grid line up; distinct at a glance from each other, from the village and the port, from `map_encampment` (tents and fire; take care that Emberwatch's beacon does not read as the camp's fire) and from `map_resource` and `map_monsters`. Enough value contrast that, multiplied by grey `0x9e9e9e` (a silent partner), the shapes still read; check with a greyed copy of the exported frames made by a scratch script outside the repository.
6. **Export:** `npm run sprites`, then `npm run sprites:check` (must pass). Commit everything the build writes into `public/assets/sprites/`, the manifest included. Then run the `yomi-asset-check` agent and record its verdict.
7. **Look at the result:** each frame at 1x, at the map's 2x and enlarged (`sprite preview <id> --project art --scale 8`), side by side with the village and the port, and greyed.
8. **Provenance:** update `public/assets/sprites/README.md` for the three sprites (drawn for the project with sprite-tool, the same licence as the rest).
9. **Exclusions:** no scene or domain code; no `PARTNER_SPRITES` entry (step 07); no other sprite (resource sites share `map_resource`; the far foes are existing bandit kinds); no rule change.

## 5. Verification

- `npm run sprites:check` passes; the `yomi-asset-check` agent reports pass.
- `npm test` passes (the refactor guard untouched and green).
- The atlas holds the new frames and the anims their `idle`:

  ```sh
  for s in map_partner_hold map_partner_glade map_partner_pass; do
    grep -o "\"$s[^\"]*\"" public/assets/sprites/atlas.json public/assets/sprites/atlas.anims.json | sort -u   # <s>/base, its second frame, <s>/idle
  done
  ```

- The frames were viewed (record how and what was seen), including each greyed and each beside `map_partner_village` and `map_partner_port`.

## 6. Completion criteria

- [ ] `map_partner_hold`, `map_partner_glade`, `map_partner_pass` on the `map` canvas, each with `base` and a two-frame `idle`, at `map_partner_village`'s size and footprint, distinct from each other and from the existing map sprites, readable greyed.
- [ ] `npm run sprites:check` and `npm test` pass; `yomi-asset-check` passes; the 50-campaign check not run (no rule change), said in the record.
- [ ] `public/assets/sprites/README.md` records the new art.
- [ ] The execution record names, for step 07, each sprite's exact frame and animation names, its canvas size and anchor, and whether it sits at the same origin as `map_partner_village` (no offset) or needs one.
- [ ] One commit, "Stage 9 step 06: partner sprites", no attribution lines, files staged by path (on the step's worktree branch if run there); the index's row 06 updated with status and commit.

## 7. Execution record

### Engineer record

- Drew `art/map/map_partner_hold`, `map_partner_glade`, `map_partner_pass` (`.sprite.toml`, runs, `outline = "auto"`). `sprite check` ok; `npm run sprites` then `npm run sprites:check` up to date (131 sprites, 265 frames). README row added in `public/assets/sprites/README.md`. `yomi-asset-check`: sprites:check and sounds:check pass, no pin drift.
- Looked at: `sprite preview <8 ids> --scale 8 --tint none,#9e9e9e --tint-mode multiply` (village, port, encampment, resource, monsters, then the three: all greyed beside the existing ones) and `--anim idle` for the three; at the 1x/2x size via the tint sheet's small copies. Previews: `art/.preview/map_partner_village+7more.plain.tints.png`, `art/.preview/map_partner_hold+map_partner_glade+map_partner_pass.anim-idle.png` (the `art/.preview/` folder is not committed). Seen: hold reads as snowy peaks over a gated cliff with a red banner and lit windows; glade as two tall dark trees flanking a thatched round hut; pass as a pale gatehouse between dark shoulders with a flame. Greyed at 0x9e9e9e all three keep their silhouettes and value contrast (pass's pale tower and the hold's gate stay clear; the glade's dark hut is the faintest).
- For step 07 (all on the `map` canvas, 24x24, anchor 12,12, same origin as `map_partner_village`, no offset; footprint rows 0-21 like the village):
  - `map_partner_hold`: frames `map_partner_hold/base`, `map_partner_hold/stir`; anim `map_partner_hold/idle` (500 ms).
  - `map_partner_glade`: frames `base`, `sway`; anim `map_partner_glade/idle` (600 ms).
  - `map_partner_pass`: frames `base`, `flicker`; anim `map_partner_pass/idle` (400 ms).
- The 50-campaign check was not run (no rule change).
- `npm test`: 2545 pass, 1 fails: `scripts/records.test.ts` "keeps each new plan index under 32000 bytes" (index.md is 34741 bytes, not touched by this step; fails on the branch as inherited).
- Deviations: the index row and `log.md` were not edited (brief); `npm install` modified `package-lock.json`, reverted and not committed.
