# Step 06: Sprites for ring 15

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-11-high-roster.md) (§2 "Sprites: 14 units, drawn ring by ring", §7 "Sprites as the bottleneck") · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.5 (the roster) · [Stages index](../../designs/long-campaign/index.md) ("Sprites") · [Stage 10's sprite step](../long-campaign-stage-10/05-workshop-sprites.md) (the workflow it used)

**Difficulty:** sonnet / opus. Tool work with sprite-tool on text sources, following a written workflow, so `model: "sonnet"` will do; the reviewer should be opus (model unset), as it judges whether the three new units read clearly beside the roster and each other, which the checks cannot.

## 1. Objective

Draw the three unit sprites of ring 15, so that step 11's kinds are drawn as themselves and `src/scenes/unitLook.test.ts` (every `UnitKind` in the atlas, with `idle` and `walk`) passes when step 11 adds them:
- `stone_golem`, `blight_cultist`, `young_dragon`.

No game code changes: only the sprite sources and the exported atlas.

## 2. Requirements and context

- **S11-R1** (design §3): each kind's block, abilities, wards, `FOE_XP`, `FOE_NATIVE_LEVEL`, trophy **and sprite**. Design §2: "Sprites: 14 units, drawn ring by ring"; §7: "Delegate them per ring, in parallel with the blocks." The plan draws 13 (index decision 9, Q9); this step draws ring 15's three.
- **Stages index, "Sprites":** new units are drawn with sprite-tool by a subagent, following `docs/designs/sprite-drawing-guidance.md`. A stage is not done while a unit falls back to a placeholder.
- **What each kind is** (campaign §5.5, design §4), to draw from:
  - **Stone Golem** (native 14): a wall of stone, slow and heavy; resistance 8, immune to ticking statuses, warded against poison; strikes with a Slam. Blocky, massive, mineral greys, perhaps runic seams; its walk a slow, heavy tread.
  - **Blight Cultist** (native 14): a robed caster touched by the blight, casting Lightning Bolt, Curse and Heal. Must read as distinct from `bandit_mage` (the Hedge-Mage, a human bandit) and `shaman` (the Goblin Shaman): a human-sized figure in hooded robes in the blight's sickly palette, a staff or censer, blight marks.
  - **Young Dragon** (native 15): the boss of its nest; Fire Breath (a cone 3 hexes long) and a routine of Bite, Claw, Claw; warded against fire. Fire hues (reds, oranges, embers), wings folded or half spread, on the **largest unit canvas** `docs/reference/sprites.md` allows.

### Contract (copied unchanged from the index)

**C8. Sprites (steps 04 to 07)**

`art/units/<kind>.sprite.toml` for each C3 kind, `idle` and `walk` animations and `[points] chest`, built into `public/assets/sprites/`: step 04 `wolf`, `worg_rider`, `ogre`; 05 `wyvern`, `barrow_wight`, `basilisk`, `hill_giant`; 06 `stone_golem`, `blight_cultist`, `young_dragon`; 07 `blight_lich`, `elder_wyrm`, `source_horror`. Bosses (dragon, lich, wyrm, `source_horror`) on the largest unit canvas `docs/reference/sprites.md` allows. Nothing in `src/` changes.

**C3 rows for this step's kinds** (from the index, unchanged; the sprite id is the `UnitKind` id):

| Kind | Name | Native | XP | Defence | Special (C4) | Step |
| --- | --- | --- | --- | --- | --- | --- |
| `stone_golem` | Stone Golem | 14 | 180 | res 8, wards poison 99, `immune` | weapon Slam | 11 |
| `blight_cultist` | Blight Cultist | 14 | 100 | res 1, blightborn | spells `lightning_bolt`, `curse`, `heal` | 11 |
| `young_dragon` | Young Dragon | 15 | 300 | res 4, wards fire 10 | `dragon_breath`, `dragon_strikes` | 11 |

### Shared constraints (from the index)

- **Content.** Sprites: `.claude/skills/yomi-sprites/` (`art/CLAUDE.md`, `docs/reference/sprites.md`, `docs/designs/sprite-drawing-guidance.md`); never edit an exported PNG; `npm run sprites`, `npm run sprites:check`, then the `yomi-asset-check` agent.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit.
- **The refactor guard** must stay green and is not edited. Sprite steps (04–07) change no rule and need not run the 50-campaign check; this step runs **no simulation** (say so in the record).
- **Commits.** One commit per step once `npm test` passes, without pushing; files staged by path. A sprite step runs in its own worktree and commits on its own branch, merged by the orchestrator before its ring step. Messages "Stage 11 step NN: <title>". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines the change makes wrong (none expected); `docs/reference/sprites.md` if it lists the unit kinds.

## 3. Dependencies and prerequisites

- **None among the plan's steps.** Runs at any time, **in its own git worktree**: it touches only `art/units/` and `public/assets/sprites/`. It must be merged **before step 11** (ring 15), whose `unitLook.test.ts` fails for a kind with no sprite.
- **Shared outputs.** The atlas (`atlas.png`, `atlas.json`, `atlas.anims.json`) and `.sprite-tool-manifest.json` are rebuilt by every sprite step. If another sprite step (04, 05 or 07) was merged into the stage branch before this one, merge or rebase onto it first and **rebuild the atlas** (`npm run sprites`) over it, so the exported files hold every sprite; never hand-merge the atlas files.
- **Existing (at `1a008af`):**
  - `art/CLAUDE.md` (the sprite-tool workflow and contracts), `docs/reference/sprites.md` (canvases, scales, animation frames), `docs/designs/sprite-drawing-guidance.md`.
  - `.claude/skills/yomi-sprites/`: `SKILL.md`, `workflow.md` (`sprite new` for each kind, the manifest and `--adopt`, what to commit), `drawing.md`.
  - `art/units/`: today's kinds, the models of scale and style: `troll`, `armored_troll` (a heavy brute), `salamander` (a fire beast), `giant_spider`, `horror` (the blight's own), `shaman` and `bandit_mage` (casters the cultist must not resemble).
  - `art/palette.toml`, `art/sprite-tool.toml`.
  - `public/assets/sprites/`: `atlas.png`, `atlas.json`, `atlas.anims.json`, `.sprite-tool-manifest.json`, `README.md` (provenance and licence).

## 4. Scope and guidance

1. **Read first:** the yomi-sprites skill files, `art/CLAUDE.md`, `docs/reference/sprites.md`, `docs/designs/sprite-drawing-guidance.md`; run `sprite guide --project art`. Look (`sprite show`, `sprite preview --grid`) at `troll`, `armored_troll`, `salamander`, `horror`, `shaman` and `bandit_mage`.
2. **Create** each with `sprite new` as `workflow.md` says, in `art/units/`: `stone_golem.sprite.toml`, `blight_cultist.sprite.toml`, `young_dragon.sprite.toml`. Each has `idle` and `walk` animations and a `[points] chest` (where shots and spells are aimed and fly from).
   - `stone_golem`: a heavy unit canvas; reads as stone at a glance, heavier than the Armoured Troll.
   - `blight_cultist`: a human-sized canvas; hooded robes in the blight's palette (as `horror`'s), clearly not the Hedge-Mage or the Goblin Shaman.
   - `young_dragon`: the largest unit canvas allowed (C8); fire hues; the biggest and most imposing of the three.
   - Each readable at battle scale against the board, its silhouette distinct from the others and from today's roster.
3. **Export:** `npm run sprites`, then `npm run sprites:check` (must pass). Commit everything the build writes into `public/assets/sprites/`, the manifest included. Then run the `yomi-asset-check` agent and record its verdict.
4. **Look at the result:** each at 1x, at battle scale and enlarged (`sprite preview <id> --project art --scale 8`), beside the models above; keep previews outside the repository (scratchpad or `logs/`). Optional: in the dev build after step 11 lands; not required here.
5. **Provenance:** update `public/assets/sprites/README.md` for the three new sprites (drawn for the project with sprite-tool, the same licence as the rest).
6. **Exclusions:** no `src/` change (no kind, scene, domain or test code; step 11 adds the kinds); no other sprite; no rule change; no simulation.

## 5. Verification

- `sprite check --project art` prints `ok`; `npm run sprites:check` passes; the `yomi-asset-check` agent reports pass.
- Each of the three has `idle`, `walk` and `[points] chest` (`sprite show`; the chest point is not enforced, check by hand).
- `npm test` passes (no `src/` change; `unitLook.test.ts` covers the new frames only once step 11 adds the kinds).
- `git diff --stat` shows only `art/units/` (three new files) and `public/assets/sprites/` (plus this task file and the index's row 06).

## 6. Completion criteria

- [x] `art/units/stone_golem.sprite.toml`, `blight_cultist.sprite.toml`, `young_dragon.sprite.toml`, each with `idle`, `walk` and `[points] chest`; the dragon on the largest unit canvas.
- [x] The atlas rebuilt (over any sprite step merged before), `sprites:check` and the asset check pass; provenance updated.
- [x] The look judged beside the roster and recorded below; no simulation run (said so).
- [x] One commit on the worktree's branch, "Stage 11 step 06: sprites for ring 15", files staged by path, no attribution lines; the index's row 06 updated with status and commit; merged by the orchestrator before step 11.

## 7. Execution record

Engineer (sonnet tier) record. Branch `long-campaign-stage-11-sprites-06`, cut from step 05's finished branch (bb6b960), so the atlas was rebuilt over the sprites of steps 04 and 05.

- Drawn (32px `unit` canvas, the largest the project has; `outline = "auto"`, runs): `stone_golem` (grey stone slabs, dark-stone seams, two cyan eyes under a brow, a glowing cyan rune ring on the chest, fist-boulders, pillar legs; breath moves the head and shoulders, the walk lifts each foot in turn with the legs parting on `walk_0`), `blight_cultist` (man-sized, dark steel-blue hooded robe, face a black hollow with two acid-green eyes under the brow, one hand raised round a green orb, a censer on a chain in the other, moss-green vein down the robe and along the hem, boots that part in the walk), `young_dragon` (red drake facing right on a raised neck, ivory horns, ember glowing in its open jaws, gold throat plates and belly band, a rust-and-bone wing folded up over the back, four thick legs in two pairs, a short spiked tail; the walk moves the hind pair back and the fore pair forward, then lifts each pair in turn). Each has `idle` (2 frames), `walk` (`walk_0`, `walk_1`, `walk_0`, `walk_2`) and `[points] chest` (golem 15,14 on the rune; cultist 15,15; dragon 20,15 at the shoulder).
- Look: judged at 6x, 12x and display scale beside troll, armored_troll, ogre, hill_giant, wyvern, salamander, shaman, bandit_mage, horror and warrior. Grey stone with cyan accents is its own colour (ogre flesh, troll green, hill giant light blue, wyvern blue-slate); the cultist is the only dark robed figure, with a censer where the shaman and Hedge-Mage have staves; the dragon is told from the wyvern (two legs, one violet wing, raised sting) and the salamander (low, flame spine) by its four-legged mass, raised neck and tall wing. Redrawn twice: the first dragon was a slab on piano legs; the neck, a taller wing and paired legs fixed it. Walk frames checked with `sprite show --frame`: no overlapping runs, no notches. Previews (outside the repository): `/private/tmp/claude-501/-Users-ryan-personal-yomi/6b9b93b7-3933-4bd1-a198-fa82ad0fff0d/scratchpad/s06/new_6x.png` (the three, 6x, with display-size column) and `.../s06/display_beside_roster.png` (display scale beside the roster).
- Verification on the clean tree at `7ebb9c6`: `sprite check --project art` ok (141 sprites, 318 frames); `npm test` exit 0, 107 files, 2740 tests (runlog #25); `npm run sprites:check` exit 0 (runlog #26); `yomi-asset-check` PASS. `public/assets/sprites/README.md` updated. No `src/` change; **no simulation run**.
