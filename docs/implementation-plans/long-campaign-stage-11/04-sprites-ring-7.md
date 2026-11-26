# Step 04: Sprites for ring 7

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-11-high-roster.md) (§2 "Sprites: 14 units, drawn ring by ring", §7 "Sprites as the bottleneck") · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.5 (the roster) · [Stages index](../../designs/long-campaign/index.md) ("Sprites") · [Stage 10's sprite step](../long-campaign-stage-10/05-workshop-sprites.md) (the workflow it used) · [Plan log](log.md)

**Difficulty:** sonnet / opus. Tool work with sprite-tool on text sources, following a written workflow, so the engineer is `model: "sonnet"`. The reviewer is opus (model unset): it judges whether the three new foes read clearly as themselves, at battle scale, beside today's roster, which the checks cannot.

## 1. Objective

Draw the unit sprites of ring 7's three new kinds, so that step 08 can add them as `UnitKind`s without any unit falling back to a placeholder:
- `wolf`, `worg_rider`, `ogre`, each `art/units/<kind>.sprite.toml` with `idle` and `walk` animations and a `[points] chest`, built into `public/assets/sprites/`.

No game code changes: only the sprite sources and the exported atlas.

## 2. Requirements and context

- **S11-R1** (design §3): each kind has a sprite. Design §2: "Sprites: 14 units, drawn ring by ring"; §7: sprites are delegated per ring, in parallel with the blocks. The stages index: a stage is not done while a unit falls back to a placeholder.
- **Decision 9 (from the index, unchanged):** **Sprites: 13** *(for the user, Q9)*: the design says 14; its table names 12 new kinds, and the rebuilt Horror is a 13th (decision 3). The plan draws 13. This step draws three of them.
- **What each kind is** (C3's rows for this step's kinds, unchanged):

  | Kind | Name | Native | XP | Defence | Special (C4) | Step |
  | --- | --- | --- | --- | --- | --- | --- |
  | `wolf` | Wolf | 6 | 80 | — | 10 AP, plain bite | 08 |
  | `worg_rider` | Worg Rider | 7 | 100 | res 1 | `worg_strikes` | 08 |
  | `ogre` | Ogre | 7 | 140 | res 2 | `ogre_sweep` | 08 |

  From campaign §5.5 and C4: the **Wolf** is a fast skirmisher (10 AP) that runs down the archer; the **Worg Rider** is a goblin on a worg, striking with spear and bite in one action ("Spear and Bite"); the **Ogre** is a brute that sweeps everyone beside it ("Sweep", an area centred on itself). The design's play note (§4): "wolves run down the archer. Worg riders strike spear and bite in one action. An ogre sweeps everyone beside it."

### Contract (copied unchanged from the index)

**C8. Sprites (steps 04 to 07)**

`art/units/<kind>.sprite.toml` for each C3 kind, `idle` and `walk` animations and `[points] chest`, built into `public/assets/sprites/`: step 04 `wolf`, `worg_rider`, `ogre`; 05 `wyvern`, `barrow_wight`, `basilisk`, `hill_giant`; 06 `stone_golem`, `blight_cultist`, `young_dragon`; 07 `blight_lich`, `elder_wyrm`, `source_horror`. Bosses (dragon, lich, wyrm, `source_horror`) on the largest unit canvas `docs/reference/sprites.md` allows. Nothing in `src/` changes.

### Shared constraints (from the index)

- **Content checklists** (`.claude/skills/yomi-add-content/`): `foe.md` (each kind: sprite, `MonsterKind`, `FOE_STATS`, `FOE_XP`, `FOE_NATIVE_LEVEL`, `FOE_SOUNDS`, `DEATH`, the yardstick) — this step does only the sprite line; step 08 does the rest. Sprites: `.claude/skills/yomi-sprites/` (`art/CLAUDE.md`, `docs/reference/sprites.md`, `docs/designs/sprite-drawing-guidance.md`); never edit an exported PNG; `npm run sprites`, `npm run sprites:check`, then the `yomi-asset-check` agent.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit.
- **The refactor guard** must stay green and is not edited. Sprite steps (04–07) change no rule and need not run the 50-campaign check; this step runs **no simulation** (say so in the record).
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on its own worktree branch, without pushing; files staged by path. A sprite step runs in its own worktree and commits on its own branch, merged by the orchestrator before its ring step. Messages "Stage 11 step NN: <title>". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines the change makes wrong (none expected); `docs/reference/sprites.md` if it lists the units.

## 3. Dependencies and prerequisites

- **None among the plan's steps.** Runs at any time, **in its own git worktree**: it touches only `art/units/` and `public/assets/sprites/`. It must be **merged before step 08** (ring 7), whose kinds need these frames: `src/scenes/unitLook.test.ts` checks every `UnitKind` has `idle` and `walk` in the atlas, so step 08 cannot commit without them.
- **Beside other sprite steps (05–07):** the atlas, `atlas.json`, `atlas.anims.json` and `.sprite-tool-manifest.json` are shared outputs. If another sprite step merges first, merge it into this branch and rebuild (`npm run sprites`) before handing off, so the atlas holds both.
- **Existing (at `1a008af`):**
  - `art/CLAUDE.md` (the sprite-tool workflow and contracts), `docs/reference/sprites.md` (unit canvases, scales, animation frames), `docs/designs/sprite-drawing-guidance.md`.
  - `.claude/skills/yomi-sprites/`: `SKILL.md`, `workflow.md` (`sprite new` for each kind, the manifest, what to commit), `drawing.md`.
  - `art/units/`: today's units, among them `troll`, `armored_troll`, `giant_spider`, `goblin`, `hobgoblin`, `salamander`, `horror` and the bandits: the scale, canvases, palette and style to match.
  - `art/palette.toml`, `art/sprite-tool.toml`; `public/assets/sprites/` (`atlas.png`, `atlas.json`, `atlas.anims.json`, `.sprite-tool-manifest.json`, `README.md`, provenance and licence).

## 4. Scope and guidance

1. **Read first:** the yomi-sprites skill files, `art/CLAUDE.md`, `docs/reference/sprites.md` (which unit canvas for which size) and `docs/designs/sprite-drawing-guidance.md`; run `sprite guide --project art`. Look (`sprite show`, `sprite preview --grid`) at `troll`, `giant_spider`, `goblin` and `hobgoblin` for scale and style.
2. **Draw** with `sprite new` (as `workflow.md` says), one file per kind:
   - **`wolf`:** low and long, a fast skirmisher: lean grey body, head forward, tail out; the walk a loping run. Smaller and lower than the goblin's head height, wider than tall.
   - **`worg_rider`:** a goblin (in the goblin's palette and face, so it reads as one) riding a larger, darker worg, spear held forward; the worg's bite and the spear both visible. Bigger than the wolf.
   - **`ogre`:** a hulking brute, **bigger than the troll**, heavy-shouldered, a club or great fist ready to sweep; hide or rough cloth, no plate (resistance 2). On the largest canvas it needs without crowding a hex.
   - Each with `idle` and `walk` animations and a `[points] chest` (where shots and spells are aimed and fly from), facing as the other units do.
3. **Export:** `npm run sprites`, then `npm run sprites:check` (must pass). Commit everything the build writes into `public/assets/sprites/`, the manifest included. Then run the `yomi-asset-check` agent and record its verdict.
4. **Check the atlas by hand:** until step 08 these are not `UnitKind`s, so `unitLook.test.ts` does not cover them yet. Confirm in `atlas.json` / `atlas.anims.json` that `wolf`, `worg_rider` and `ogre` each have `idle` and `walk`, named exactly as the kind ids, and that each source has `[points] chest`.
5. **Look at the result:** each at battle scale and enlarged (`sprite preview <id> --project art --scale 8`), side by side with `troll`, `goblin`, `giant_spider` and a bandit; kept outside the repository (scratchpad or `logs/`). The wolf should read as fast and small, the worg rider as a goblin on a beast, the ogre as the biggest of ring 7.
6. **Provenance:** update `public/assets/sprites/README.md` for the new sprites (drawn for the project with sprite-tool, the same licence as the rest).
7. **Exclusions:** no `src/` change (no kind, stat block, scene or test code: step 08 adds them); no other sprite; no rule change; no simulation.

## 5. Verification

- `sprite check --project art` prints `ok`; `npm run sprites:check` passes; the `yomi-asset-check` agent reports pass.
- `atlas.json` and `atlas.anims.json` hold `wolf`, `worg_rider`, `ogre` with `idle` and `walk`; each source has `[points] chest` (checked by hand).
- `npm test` passes (nothing in `src/` changed; the refactor guard green and unedited).
- `git diff --stat` shows only `art/units/`, `public/assets/sprites/` and this plan's files.

## 6. Completion criteria

- [ ] `art/units/wolf.sprite.toml`, `worg_rider.sprite.toml`, `ogre.sprite.toml` drawn, with `idle`, `walk` and `[points] chest`.
- [ ] Built into `public/assets/sprites/` (atlas, anims, manifest); `sprites:check` and the asset check pass; atlas names checked by hand.
- [ ] Looked at beside today's units; the ogre bigger than the troll, the wolf low and fast; preview paths noted.
- [ ] Provenance README updated.
- [ ] No simulation run (stated in the record).
- [ ] One commit, "Stage 11 step 04: sprites for ring 7", on the worktree branch, files staged by path, no attribution lines; the index's row 04 updated with status and commit; merged by the orchestrator before step 08.

## 7. Execution record
