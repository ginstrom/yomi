# Step 02: Bare hero body and worn-gear sprites

[Index](index.md) · [Design](../../designs/party-list-and-gear-looks.md) §4.2, §4.3 and §5.2 (Docs)

## Objective

Redraw `art/units/warrior.sprite.toml` as a bare body: hair, tunic, trousers, boots and skin hands. Draw four new overlays in `art/gear/`: `gear_breastplate`, `gear_circlet`, `gear_cloak` (collar and clasp) and `gear_cloak_back` (the cape, drawn under the body). Then build the atlas and commit everything the build writes.

This step is **art-heavy**. It covers B-R1, the art of B-R2, the pixel regions behind B-R3, the frames and animations of B-R6, and B-R7 (portraits are not touched).

## Requirements and context

- **B-R1.** The `warrior` body is redrawn bare. Its fist, its `grip` and `chest` points, and its idle and walk frames keep their geometry.
- **B-R2.** Overlays for the Steel Breastplate (icon `armor`), the Sage's Circlet (`circlet`) and the Cloak of Shadows (`cloak`). The cloak has a back part, drawn behind the body, and a front part (collar and clasp), drawn over it.
- **B-R3.** Step 03 draws the layers, bottom first, as: cloak back, body, armour, cloak front, head, main hand, off hand. That order is the same for both facings, because sprites are drawn facing right and the figure is flipped as a whole.
- **B-R6.** Every overlay breathes with the body (`idle_1` is `idle_0` shifted a pixel down, and `[anim.idle] like = "warrior"`). Every overlay holds `idle_0` through the walk (`[anim.walk] rest = true`).
- **B-R7.** Do not touch `art/portraits/`.
- **Q1, answered.** There is no default helm. The horned helm's pixels go nowhere now; stage 03's Helm item will use them. A new party looks as today except that the horned helm is gone and the legs are trousers and boots, not steel.

**Pixel regions** on the body's `idle_0`. Rows and columns count from 0 at the top left, as `sprite show warrior` numbers them. These regions keep the layers composable:

| Region | Rows | Columns | Owned by |
| --- | --- | --- | --- |
| Head | 3–10 | 11–21 | Body: hair and face. Head overlays draw here only. |
| Face | 7–10 | 15–20 | Body. The face stays where it is today (eye at row 8, column 17; nose at row 9, column 19). Head overlays leave it open, except a future helm's cheek guard at column 15. |
| Neck and shoulders | 10–12 | 9–23 | The armour's pauldrons and the cloak front's collar. |
| Torso | 11–21 | 9–21 | Body (tunic). The armour covers it. |
| Arms | 12–19 | 7–10 (shield arm), 19–24 (weapon arm) | Body (sleeves). The armour may cover them down to the wrist. |
| **Fist box** | 17–21 | 20–27 | **Body only.** No worn overlay draws here. The weapon is gripped at `[25, 19]`. |
| **Off hand** | 17–19 | 7–10 | **Body only**: the hand under the shield. |
| Legs | 20–31 | 8–23 | Body only. Only the cloak back, behind the body, reaches below row 21. |

## Dependencies and prerequisites

- **Dependencies:** none. Step 01 may run in parallel in a separate worktree. Step 03 consumes this step's sprites (the index's "Step 02 → 03" contract).
- **sprite-tool is on the host** (`sprite 0.7.0`), not in the podman image, so run every `sprite` and `npm run sprites` command on the host. The baseline `sprite check --project art` prints `ok: 68 sprites`, and `npm run sprites:check` is up to date.
- **Read `art/CLAUDE.md` and run `sprite guide --project art`** before drawing.

**Current files (inspected):**
- **`art/units/warrior.sprite.toml`:**
  - `canvas = "unit"`, with no `outline = "auto"`: it is drawn as a full grid with a hand-placed `k` outline.
  - `[points] grip = [25, 19]` and `chest = [16, 15]`.
  - `idle_0`:
    - horned helm at rows 3 to 8;
    - face `s`/`h`/`S`, with a beard `n` at row 10;
    - pauldrons at row 11;
    - steel arms and a breastplate over a red tabard (`R`/`r`/`y`) at rows 11 to 21, with the belt row 17 `Nnnyynn`;
    - a steel fist at rows 18 to 20, columns 20 to 27;
    - the left hand (`sh`) at row 18, columns 8 to 9;
    - steel legs (`D`/`d`/`l`) with the knee (`w`) at row 24;
    - boots `NNn` at rows 29 and 30.
  - `idle_1` is `from = "idle_0"` with `move = { rows = [0, 24], by = [0, 1] }`.
  - `walk_0` replaces rows 23 to 31; `walk_1` and `walk_2` replace rows 25 to 31.
  - `[anim.idle]` is 600 ms; `[anim.walk]` is 140 ms, `walk_0`, `walk_1`, `walk_0`, `walk_2`.
- **`art/gear/gear_shield.sprite.toml`** is the template for an overlay: `canvas = "unit"`, `over = "warrior"`, `[frames.idle_0.runs]`, `[frames.idle_1] from = "idle_0"` with `shift = [0, 1]`, `[anim.idle] like = "warrior"` and `[anim.walk] rest = true`.

## Scope and implementation guidance

**Sprites:**

1. **`units/warrior`, redrawn with the same id.**
   - Header comment: "A hero's body, bare: hair, tunic, trousers, boots, empty hands. What it wears and holds is drawn over it, from art/gear/." Keep the note on the fist and the shield arm.
   - **Head.** Short hair (`N`/`n`) over the crown and the back of the head (rows 4 to 8, columns 12 to 16). The face in skin, in today's place. Keep the brown beard (`n`) at rows 10 to 11, columns 15 to 17.
   - **Torso.** An arming tunic in `t`/`T` with `n` shading, belted in `N` at row 17.
   - **Arms.** Tunic sleeves to the wrists, and skin hands. The fist keeps today's outline and position (rows 18 to 20, columns 20 to 27), in skin.
   - **Legs.** Trousers in `n`/`N`, and boots in `N`/`k` at rows 29 to 31. The leg silhouette matches today's column for column.
   - `walk_0`, `walk_1` and `walk_2` replace the same rows as today, with the same leg shapes in trouser and boot colours.
   - Unchanged: `[points]`, `idle_1`, and both animations.

2. **`gear/gear_breastplate`** (icon `armor`). This is today's body from row 11 to row 21: pauldrons, steel upper and lower arms, the plate (`D`/`d`/`l`/`w`), and the red tabard (`R`/`r`/`y`) with its belt. Taking it from the current `warrior.sprite.toml` (`git show 3fe4c11:art/units/warrior.sprite.toml`) keeps today's look.
   - It excludes the fist box, the off hand, and everything above row 10 or below row 21.
   - No tunic pixel may show through where the plate is meant to cover it.

3. **`gear/gear_circlet`** (icon `circlet`). A one-pixel silver band (`w`/`l`) across the forehead, at row 6 or 7, from the back of the head to the brow (columns 12 to 18).
   - Outline it in `k` above and below where it meets transparency.
   - Set a blue stone (`c`, with `b`) at the brow, column 17 or 18.

4. **`gear/gear_cloak`** (front part, icon `cloak`). A collar of `B`/`b` across the shoulders, at rows 10 to 12 and columns 11 to 21, with a gold clasp (`y`/`Y`) at the throat (column 18 or 19, row 11).
   - It must not cover the face (rows 7 to 10, columns 15 to 20), apart from the collar's top edge at row 10 if that reads better.

5. **`gear/gear_cloak_back`** (the back part, drawn under the body by step 03). A cape in `B`/`b` with `c` folds, matching the cloak icon. It hangs from the shoulders (row 11) to row 26, about columns 6 to 24 wide, flaring a little toward the hem, and outlined in `k`.
   - Draw it whole; the body hides what is behind it. What shows is:
     - beside the shield arm (columns 5 to 7);
     - beside and below the weapon arm (columns 21 to 25, around the fist box);
     - between and around the legs at rows 21 to 26.
   - Keep `over = "warrior"`, so that the outline check counts the body's pixels.
   - **`sprite preview gear_cloak_back --on warrior` draws it on top, not under.** Judge it alone (`sprite preview gear_cloak_back --grid`). Step 03 judges it on the doll in the running game.
   - Its `shift = [0, 1]` moves the hem with the breath while the legs below row 24 stay still. That is intended.

**Every overlay:**
- `canvas = "unit"` and `over = "warrior"`.
- Runs, since these sprites are mostly empty.
- Edges outlined in `k` by hand.
- `idle_0` lines up with the body's `idle_0` pixel for pixel.
- `idle_1` is `from = "idle_0"` with `shift = [0, 1]`.
- `[anim.idle] like = "warrior"` and `[anim.walk] rest = true`.
- A header comment in the style of `gear_shield`.
- No `[variants]`.

**Loop** (from `art/CLAUDE.md`):
1. Run `sprite check --project art` until it prints `ok`. W009 means an overlay neither plays nor rests through the walk.
2. Run `sprite show <id> --project art`.
3. Run `sprite preview gear_<x> --on warrior --project art` for the over-layers, and look at the PNG.
4. Run `sprite preview warrior --anim walk --project art`, and `sprite show warrior --frame walk_1 --diff`.
5. Run `sprite preview gear_sword --on warrior` and `gear_shield --on warrior`. The held gear must still sit in the bare fist and on the bare arm.
6. Run `npm run sprites`, and keep everything it writes, the manifest included (`.sprite-tool-manifest.json`, `atlas.*`, `sprites.json`, and the loose PNGs).

**Docs (same commit):**
- **`public/assets/sprites/README.md`:**
  - The `warrior/*` row says the body is bare.
  - The `gear_*/*` row (or a new row) names the worn overlays: "`UnitFigure`, by `GEAR_SPRITES`, `WORN_SPRITES` and `WORN_BACK_SPRITES`" (those maps arrive in step 03; name them now).
- **`art/CLAUDE.md`, the hero-layers bullet:**
  - `units/warrior` is a bare body.
  - Worn overlays (`gear_breastplate`, `gear_circlet`, `gear_cloak`, `gear_cloak_back`) follow the same rules as held gear.
  - The region rules: the fist box (rows 17 to 21, columns 20 to 27) and the off hand (rows 17 to 19, columns 7 to 10) belong to the body only, and head overlays leave the face open.
  - A back layer (`gear_cloak_back`) is drawn under the body even though it says `over = "warrior"`, and `--on` previews it on top.
- **Root CLAUDE.md.** Its assets paragraph still says "Every hero is the `warrior` body, bare-handed, with a sprite laid over it for what is in each hand". That stays true for this step's code (nothing lays worn gear yet). Step 03 rewrites it, so leave it.

**Exclusions:**
- No change to `src/`.
- No portraits.
- No bandit or foe sprites. They are separate files and do not derive from `warrior`.

## Verification

- `sprite check --project art` prints `ok` (72 sprites).
- `npm run sprites:check` prints "up to date" after `npm run sprites`.
- `npm test` passes. In `src/scenes/unitLook.test.ts`, `grip` and `chest` must be on every `warrior/*` frame, every `GEAR_SPRITES` sprite must be in the atlas, and every unit kind must have `idle` and `walk`.
- **Check the atlas for the new sprites.** `public/assets/sprites/atlas.json` has `gear_breastplate/idle_0` (and `idle_1`, and the same for `gear_circlet`, `gear_cloak` and `gear_cloak_back`). `atlas.anims.json` has `<id>/idle` and `<id>/walk` for each.
- **Visual record.** In the execution record, paste the `sprite show` text of `warrior` and of each overlay's `idle_0`, and list the preview PNGs you looked at.

## Completion criteria

- [ ] Five sources written: one redrawn and four new.
- [ ] The build output is committed with them.
- [ ] Checks green.
- [ ] `art/CLAUDE.md` and the sprites README are updated in the same commit.
- [ ] The execution record notes anything step 03 should judge in the game (the cape's read at map scale 1).
- [ ] This step's status and commit are recorded in the index.

## Execution record
