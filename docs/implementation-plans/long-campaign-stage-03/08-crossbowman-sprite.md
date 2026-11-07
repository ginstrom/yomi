# Step 08: Crossbowman sprite

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-03-gear-families.md) (§2, "Bandits"; stages index, "Sprites")

**Difficulty:** art judgement. Drawing needs the session's model (CLAUDE.md, "Subagents"): engineer opus, reviewer opus. A mechanical re-export or README row may use `model: "sonnet"`.

**Status: blocked on Q2.** Do nothing until the user has answered Q2 (index, "Open questions"). If the answer adds no Crossbowman role (options (c) or (d)), mark this step `skipped (Q2)` in the index's task table, with the date, and stop. Only options (a) and (b) need this sprite.

## 1. Objective

Put one unit sprite into the atlas, `bandit_crossbowman`, with `idle` and `walk` animations and a `chest` point. When step 09 adds the kind to `BanditKind` and `FOE_XP`, the battle screen will draw it and `unitLook.test.ts` will pass. The stages index says a stage is not done while a unit falls back to a placeholder, so this must be a finished drawing.

## 2. Requirements and context

- **Q2 (copied from the index, unchanged):**

  | # | Question | Options | Recommendation | Blocks |
  | --- | --- | --- | --- | --- |
  | Q2 | **Bandits: "may now use the crossbow (a Crossbowman role) and steel at threat 5."** A new role is a new unit kind, which needs a sprite, an experience value and a slot in the Bandit Camp. Steel at threat 5 strengthens the threat-5 Bandit Gangs that spawn on today's map, so the guard moves. | (a) a Crossbowman kind as a slot from threat 6 (off today's map; checked by cells), and steel (tier 2) from threat 5, measured and retuned in step 10; (b) the Crossbowman in the Archer's place at threat 5, with steel from 5; (c) steel only, no Crossbowman; (d) defer both to stage 9, when the rings beyond threat 5 exist | (a): it builds the role the design names, without reshaping today's threat-5 fight, and steel at 5 follows the design | Steps 08 and 09 |

- **C9. Bandits (steps 08 and 09; blocked on Q2)** (copied from the index, unchanged):

  What Q2 decides: whether a Crossbowman role takes the field, and where, and whether bandit gear is steel from threat 5. Whatever the answer, any bandit stays a legal draft whose hero twin has the same stats (the existing test in `bandits.test.ts`). With option (a) of Q2:

  ```ts
  // src/game/bandits.ts
  export type BanditRole = /* existing */ | 'crossbowman'
  /** The tier and grade of bandit gear at a threat: tier 2 from threat 5 (Q2), grade as banditGrade. */
  export function banditGear(threat: number): { tier: Tier; grade: Grade }
  // src/game/encounters.ts
  export type BanditKind = /* existing */ | 'bandit_crossbowman'     // FOE_XP 100; sprite `bandit_crossbowman` (step 08)
  ```

- **The sprite's name must be exactly `bandit_crossbowman`.** A unit is drawn as the atlas sprite named for its `UnitKind` (CLAUDE.md, "Assets and docs").
- **What it needs:**
  - a rest frame `idle_0`;
  - an `idle` animation (`idle_0`, `idle_1`);
  - a `walk` animation (`walk_0`, `walk_1`, `walk_0`, `walk_2`);
  - a `[points] chest`, where shots and spells are aimed and fly from.

  `unitLook.test.ts` ("has every kind of unit in the atlas, with idle and walk animations") checks that every key of `FOE_XP` has the frame `<kind>/idle_0` and the animations `<kind>/idle` and `<kind>/walk`. "finds a chest on every frame of every unit" checks the `chest` point.
- **What it must read as, at battle scale** (the 32px `unit` canvas, shown at 3x):
  - It is clearly one of the bandit family. Follow `art/units/bandit_archer.sprite.toml` (the model) and the other `art/units/bandit_*.sprite.toml` files: their build, palette, rough clothing and hood or headgear.
  - It is told apart from the Bandit Archer at a glance by its weapon: a crossbow held level across the body (a stock and a short horizontal bow at its front), not a tall bow held upright.
  - A different shade of cloak or tunic from the Archer's helps too.
- **The bandits are whole unit sprites**, not the hero's `warrior` with gear layered on: there are no `GEAR_SPRITES` and no `grip` point. The crossbow is drawn into the body's frames.
- **Where the sprite comes from:** a text source drawn with sprite-tool. Never edit an exported PNG by hand: change the source and run `npm run sprites`.
  - Draw whole-frame runs or grids with `outline = "auto"`, and never generate a grid with a script ([`docs/designs/sprite-drawing-guidance.md`](../../designs/sprite-drawing-guidance.md) R1; `art/CLAUDE.md`).
  - Put `[points]` below the top-level `outline = "auto"`, or TOML reads `outline` as a point.
- **Shared constraints (from the index):**
  - `npm test` (prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or `make test`) is the gate before the commit.
  - Commit one commit for this step on `long-campaign-stage-03`, sources and everything the build writes together, without pushing. Never switch branches.
  - The message ends with the repo's `Co-Authored-By` attribution line.

## 3. Dependencies and prerequisites

- **Q2 answered** with option (a) or (b) (see above).
- **Step 03 committed.** Steps 02, 03 and 08 each rebuild the atlas (`atlas.png`, `atlas.json`, `atlas.anims.json`, `.sprite-tool-manifest.json`), so they run one after another to avoid conflicts in generated files. This step does not depend on any code step and may run alongside steps 04 to 07, as long as no other art step is running.
- **Tools and references** (existing):
  - the `sprite` CLI, on the host. Run `sprite guide --project art` first: it prints the format, the palette and the canvas classes;
  - `art/CLAUDE.md`, which covers the workflow and unit animations. Read it before drawing;
  - `art/palette.toml`;
  - `npm run sprites` and `npm run sprites:check`.
- **Produces for step 09:** the atlas sprite `bandit_crossbowman`. Step 09 must not add `bandit_crossbowman` to `FOE_XP` until this step is committed.

## 4. Scope and implementation guidance

1. Create `art/units/bandit_crossbowman.sprite.toml`. Use `sprite new bandit_crossbowman --canvas unit --project art --dir units`, or start from a copy of `bandit_archer.sprite.toml` and redraw its weapon and colours. Match the existing units' frame names, animation timings (`[anim.idle]` 600 ms, `[anim.walk]` 140 ms) and the `chest` point's place on the body.
2. Work in the loop (from `art/CLAUDE.md`):
   - `sprite check --project art` until it prints `ok`;
   - `sprite show bandit_crossbowman --project art` to read the result as text;
   - `sprite preview bandit_crossbowman --grid --project art`, looking at the PNG it names; add `--points` to see the chest;
   - `sprite show bandit_crossbowman --frame <name> --diff` for a derived frame;
   - then `npm run sprites`.
3. Compare it side by side with `bandit_archer`, using a preview of each. The two must be easy to tell apart at 3x.
4. Commit the source and everything the build writes in `public/assets/sprites/`, `.sprite-tool-manifest.json` included.
5. Add a row or entry for the sprite to `public/assets/sprites/README.md` (provenance and licence), in the form of the existing bandit entries.
6. **Out of scope:**
   - any code change: `BanditRole`, `BanditKind`, `FOE_XP`, the draft, the gear and the camp's slots are step 09;
   - new battle effects: the crossbow's bolt uses the existing arrow look.

## 5. Verification

- `sprite check --project art` prints `ok`, and `npm run sprites:check` reports the exports up to date.
- The atlas has the frames and animations. For example, from the repo root:

  ```sh
  node -e '
  const atlas = require("./public/assets/sprites/atlas.json");
  const anims = require("./public/assets/sprites/atlas.anims.json");
  const keys = new Set(anims.anims.map((a) => a.key));
  const names = JSON.stringify(atlas);
  for (const k of ["bandit_crossbowman/idle", "bandit_crossbowman/walk"]) console.log(k, keys.has(k));
  console.log("idle_0", names.includes("bandit_crossbowman/idle_0"));
  '
  ```

  Each line should print `true`.
- The `chest` point is on every frame. `sprite preview bandit_crossbowman --grid --points --project art` shows it.
- `npm test` passes. `unitLook.test.ts` cannot check the new kind until step 09 adds it to `FOE_XP`. It must still pass, which shows the atlas has not broken any other sprite.
- A preview at battle scale, beside `bandit_archer`, shows that the two are easy to tell apart. Record the PNG paths you looked at.

## 6. Completion criteria

- [ ] Q2 answered. If the role is dropped, this step is marked `skipped (Q2)` in the index, and nothing else is done.
- [ ] `art/units/bandit_crossbowman.sprite.toml` has `idle_0`, `idle` and `walk` animations and a `chest` point, and reads as a bandit holding a crossbow, distinct from the Archer.
- [ ] The atlas and loose PNGs are rebuilt with `npm run sprites` and committed with the source and manifest.
- [ ] `public/assets/sprites/README.md` has the new entry.
- [ ] `npm test` passes. Committed on `long-campaign-stage-03` without pushing, the message ending with the `Co-Authored-By` line.
- [ ] The index row for step 08 is set to `done` with the commit, and step 09 is told that the sprite exists.

## Execution record


**2026-11-07, engineer.** Q2 answered (a) by the user: a Crossbowman role from threat 6, so the sprite was drawn.

- `art/units/bandit_crossbowman.sprite.toml`: runs with `outline = "auto"`, the body and legs on `bandit_archer`'s build (same frame names, `idle_1` by `move` rows 0 to 24, the same walk beats, 600 ms and 140 ms). A brown leather cap with a short brim, a red kerchief at the throat (the bandits' red), an olive tunic (the archer's is light tan, the cutthroat's brown), a quiver of bolts at the back hip (the archer's quiver is at the shoulder), and a crossbow held level at the belt in the near fist: a tan and brown stock, a steel bow-arm (`l`, `d`, `D`) at its front, the string in `W` (unoutlined) drawn back to the nut, in `gear_crossbow`'s colours. `chest = [16, 15]`, as the archer's.
- `sprite check --project art`: `ok: 109 sprites, 225 frames`. `npm run sprites`: built; `npm run sprites:check`: up to date.
- The atlas check of section 5: `bandit_crossbowman/idle true`, `bandit_crossbowman/walk true`, `idle_0 true`; the chest point is on every frame (grid preview with `--points`).
- `npm test`: 73 files, 1050 tests passed (with step 07's uncommitted work in the tree).
- Previews looked at: `art/.preview/bandit_crossbowman+bandit_archer+bandit_cutthroat+bandit_captain+bandit_brute+bandit_mage.plain.png` (every frame of each bandit at display scale, 3x), `art/.preview/bandit_crossbowman.grid.png` (with points), `art/.preview/bandit_crossbowman.anim-walk.gif`. Beside the archer it reads as one of the family and is told apart at a glance by the green tunic and the level crossbow against the tall upright bow. Facings: the game mirrors the sprite; nothing in it is one-sided beyond what every unit has.
- `public/assets/sprites/README.md`: a row for `bandit_crossbowman/*`.
- For step 09: the atlas sprite `bandit_crossbowman` exists, with `idle_0`, `idle`, `walk` and `chest`; adding the kind to `FOE_XP` will be checked by `unitLook.test.ts`.
