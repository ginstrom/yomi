# Step 03: Gear sprites

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-03-gear-families.md) (§2 "Icons"; S3-R5) · [Stages index](../../designs/long-campaign/index.md) ("Sprites")

**Difficulty:** art judgement. The engineer and the reviewer should both be opus: drawing needs judgement, so it inherits the session's model (CLAUDE.md, "Subagents"). A mechanical re-export or README row may use `model: "sonnet"`.

## 1. Objective

This step adds fifteen gear sprites to the atlas, laid over the `warrior` body: ten for what a hero holds and five for what it wears. When step 04 adds the new `ItemIcon` values and wires them into `GEAR_SPRITES`, `WORN_SPRITES` and `SWUNG_GEAR`, every new family is drawn on the hero who holds or wears it, and `unitLook.test.ts` passes. The stages index says a stage is not done while anything falls back to a placeholder, so these must be finished drawings.

## 2. Requirements and context

- **Why gear sprites at all** (plan correction 10, copied from the index):

  > **New icons need gear sprites.** The reference says unit sprites stay as they are, but CLAUDE.md and `unitLook.test.ts` require a `GEAR_SPRITES` entry and sprite for every icon that can be held, and a `WORN_SPRITES` entry and sprite for every armour, head or cloak icon. So the ten new held icons and the five new worn icons (robe, leather, plate, cap, helm) each get a gear sprite. Gloves and boots are not drawn on the body (`WORN_SLOTS` is armour, cloak and head), so they get icons only. A tier tints only the icon, never a sprite on the body. The trading post's new level 4 also needs a `camp_trading_post/level_4` frame, since the encampment screen draws `level_<n>`.

  The icons and the `level_4` frame are step 02's job. This step makes only the gear sprites.
- **Contract C6** (from the index, unchanged). `ItemIcon` gains these 19 icons: `rapier`, `mace`, `spear`, `war_hammer`, `halberd`, `longbow`, `crossbow`, `staff`, `buckler`, `tower_shield`, `robe`, `leather`, `plate`, `cap`, `helm`, `gloves`, `gauntlets`, `boots`, `greaves`.

  | What | Names | Made in | Wired in |
  | --- | --- | --- | --- |
  | Item icons (20px `icon` canvas) | `icon_<icon>` for all 19 | step 02 (`art/icons/`) | step 04: `ITEM_ICON_KEYS` |
  | The trading post's level 4 | frame `level_4` of `camp_trading_post` | step 02 (`art/encampment/`) | none: `facilityFrame` already names `level_<n>` |
  | Held gear (32px `unit` canvas, over `warrior`) | `gear_rapier`, `gear_mace`, `gear_spear`, `gear_war_hammer`, `gear_halberd`, `gear_longbow`, `gear_crossbow`, `gear_staff`, `gear_buckler`, `gear_tower_shield` | step 03 (`art/gear/`) | step 04: `GEAR_SPRITES`, and `SWUNG_GEAR` for the six melee ones (rapier, mace, spear, war_hammer, halberd, staff) |
  | Worn gear | `gear_robe`, `gear_leather`, `gear_plate` (armour), `gear_cap`, `gear_helm` (head) | step 03 | step 04: `WORN_SPRITES` |

  The sprite ids must be exactly these fifteen names, because step 04 maps each icon to `gear_<icon>`.
- **What each must read as** at battle scale (the `unit` canvas, 32px, shown at 3x), told apart from today's gear (`gear_sword`, `gear_shortsword`, `gear_greatsword`, `gear_dagger`, `gear_axe`, `gear_bow`, `gear_wand`, `gear_shield`, `gear_breastplate`, `gear_circlet`):

  | Sprite | Slot | Family (C1) | Must read as |
  | --- | --- | --- | --- |
  | `gear_rapier` | main hand | rapier, a light thrusting blade | a thin, straight, longish blade with a swept or cup guard; slimmer than `gear_sword` |
  | `gear_mace` | main hand | mace | a short haft with a flanged or knobbed metal head; not an axe |
  | `gear_spear` | main hand | spear, reach 2 | a long shaft with a leaf-shaped point, clearly longer than any sword, so it reads as a polearm that strikes from the second hex |
  | `gear_war_hammer` | main hand | war hammer | a haft with a blocky hammer head and a back spike; heavier-looking than the mace |
  | `gear_halberd` | main hand, two-handed | halberd, reach 2 | a polearm at least as long as the spear, with an axe blade and a spike at the top |
  | `gear_longbow` | main hand, two-handed | longbow | a bow clearly taller than `gear_bow`, string unoutlined as the bow's is |
  | `gear_crossbow` | main hand, two-handed | crossbow | a stock held level with a short bow-arm across its front; not an upright bow |
  | `gear_staff` | main hand, two-handed | staff (Magic) | a tall wooden staff, a knot or small crystal at the top; plainly not a wand or a spear |
  | `gear_buckler` | off hand | buckler | a small round shield, clearly smaller than `gear_shield` |
  | `gear_tower_shield` | off hand | tower shield | a tall rectangular shield, clearly larger than `gear_shield`, covering much of the body's side |
  | `gear_robe` | armour | robe (cloth) | a long cloth robe over the tunic, reaching below the belt; no metal |
  | `gear_leather` | armour | leather armour | a brown jerkin with stitching or straps; not the steel breastplate's colours |
  | `gear_plate` | armour | plate | full plate, heavier than `gear_breastplate`: pauldrons and plates down the torso |
  | `gear_cap` | head | leather cap | a close leather cap |
  | `gear_helm` | head | helm (metal) | a metal helmet, nasal or open-faced |

- **The layering rules** (`art/CLAUDE.md`, a hero drawn in layers; read it whole before drawing):
  - Each sprite says `over = "warrior"` and is drawn on the `unit` canvas, so it lines up with the bare body. The outline rule is checked against the body beneath it. A one-pixel string, like the bow's, is `unoutlined`.
  - **Regions of the body's `idle_0`:**
    - The fist box (rows 17 to 21, columns 20 to 27) and the off hand (rows 17 to 19, columns 7 to 10) belong to the body alone, so no worn overlay draws there.
    - Head overlays (`gear_cap`, `gear_helm`) leave the face open (rows 7 to 10, columns 15 to 20).
    - Only the cloak's back reaches below row 21.
  - **Held weapons** are gripped at column 25. The fist is at rows 18 to 20, columns 22 to 27. The weapon leaves row 19 open for the hand to show through. The warrior's `[points] grip = [25, 19]` is what `UnitFigure.swing` turns a swung weapon about. Long weapons (spear, halberd, staff) extend above and below the grip as the greatsword does, within the canvas.
  - **The off-hand shields** sit at the off hand, as `gear_shield` does.
  - **Animations:** `[anim.idle]` is `like = "warrior"` and `[anim.walk]` is `rest = true`, holding `idle_0` while the body walks. `check` warns (W009) of a body animation a gear sprite neither plays nor rests through. Its `idle_1` is `idle_0` shifted down a pixel (derived with `move`), so the two breathe together.
  - **The worn sprites** follow `gear_breastplate.sprite.toml` (armour) and `gear_circlet.sprite.toml` (head) for frames and animations. `unitLook.test.ts` requires idle and walk animations for worn sprites, and an idle animation for held ones.
- **How sprites are drawn.** They are text sources made with sprite-tool. Never edit an exported PNG by hand: change the source and run `npm run sprites`. Draw as whole-frame runs or grids with `outline = "auto"`. Never generate a grid with a script ([`docs/designs/sprite-drawing-guidance.md`](../../designs/sprite-drawing-guidance.md) R1; `art/CLAUDE.md`). Put `[points]` below the top-level `outline = "auto"`, or TOML reads `outline` as a point.
- **Shared constraints (from the index):**
  - commit on `long-campaign-stage-03`, one commit for this step, without pushing, the message ending with the repo's `Co-Authored-By` attribution line;
  - never switch branches;
  - `npm test` (`PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or `make test`) is the gate before the commit.

## 3. Dependencies and prerequisites

- **Step 02 must be committed first.** Both steps run `npm run sprites`, which rebuilds `atlas.png`, `atlas.json`, `atlas.anims.json` and `.sprite-tool-manifest.json`. Run one after the other, never in parallel. This step may run alongside step 01 (step 01 changes no code or art).
- **No code dependency.** This step changes nothing in `src/`.
- **Existing tools and references:**
  - the `sprite` CLI on the host; run `sprite guide --project art` first for the format, the palette and the canvas classes;
  - `art/CLAUDE.md`;
  - `docs/designs/sprite-drawing-guidance.md`;
  - `art/palette.toml`;
  - the existing `art/gear/*.sprite.toml` as models: `gear_sword` and `gear_greatsword` for held blades, `gear_axe` for a haft, `gear_bow` for the bow and its unoutlined string, `gear_shield` for the off hand, `gear_breastplate` for armour, and `gear_circlet` for the head.
- **Produces for step 04:** the fifteen atlas sprites by the exact names of C6. Step 04 adds the `ItemIcon` values and maps them in `GEAR_SPRITES`, `WORN_SPRITES` and `SWUNG_GEAR`. It cannot pass `unitLook.test.ts` without this step.

## 4. Scope and implementation guidance

- **Add** fifteen sources, `art/gear/gear_<icon>.sprite.toml`. Make each with `sprite new gear_<icon> --canvas unit --project art --dir gear` (or `--runs`), or start it from the nearest existing gear sprite's form.
- **The loop** (`art/CLAUDE.md`):
  1. `sprite check --project art` until it prints `ok` (no W009);
  2. `sprite show gear_<icon> --project art` to read it as text, outline included;
  3. `sprite preview gear_<icon> --on warrior --project art` to see it over the body (look at the PNG it names);
  4. `sprite preview gear_<icon> --grid --project art` for the colours, and `--frame idle_1 --diff` for the derived frame;
  5. then `npm run sprites`.
- **Judge at scale.** Preview each held weapon beside its nearest existing one, the spear and halberd beside `gear_greatsword`, the longbow beside `gear_bow`, and the buckler and tower shield beside `gear_shield`. The size differences must show at a glance.
- **Commit** the sources and everything the build writes in `public/assets/sprites/`, `.sprite-tool-manifest.json` included.
- **Update `public/assets/sprites/README.md`** (provenance and licence) with entries for the fifteen sprites, in the form of the existing gear entries.
- **Out of scope:**
  - any code change (`ItemIcon`, `GEAR_SPRITES`, `WORN_SPRITES`, `SWUNG_GEAR` and the `unitLook.test.ts` extension are step 04);
  - the 19 icons and the trading post's `level_4` (step 02);
  - gloves, gauntlets, boots and greaves on the body (not drawn; correction 10);
  - tier variants or tints of gear sprites (tiers tint icons only);
  - the Crossbowman unit sprite (step 08).

## 5. Verification

1. `sprite check --project art` prints `ok`, and `npm run sprites:check` reports the exports up to date.
2. **The atlas carries every sprite with its animations.** For example, from the repo root:

   ```sh
   node -e '
   const anims = new Set(require("./public/assets/sprites/atlas.anims.json").anims.map((a) => a.key));
   const held = ["rapier","mace","spear","war_hammer","halberd","longbow","crossbow","staff","buckler","tower_shield"];
   const worn = ["robe","leather","plate","cap","helm"];
   const missing = [...held.map((n) => `gear_${n}/idle`), ...worn.flatMap((n) => [`gear_${n}/idle`, `gear_${n}/walk`])].filter((k) => !anims.has(k));
   console.log(missing.length ? "missing: " + missing.join(", ") : "all present");'
   ```

   It prints `all present`. The atlas also has each sprite's `idle_0` frame.
3. **Each previewed over `warrior`** (`sprite preview gear_<icon> --on warrior`) reads as the table in §2 says:
   - the hand shows through at row 19 for held weapons;
   - the face is open under the cap and helm;
   - no worn sprite covers the fist box.
4. `npm test` passes. No code has changed, so the existing `unitLook.test.ts` still names only today's sprites.

## 6. Completion criteria

- [ ] Fifteen sources in `art/gear/` with the exact names of C6, each a finished drawing that reads as the table in §2 says at battle scale.
- [ ] Each held sprite has an `idle` animation, and each worn sprite `idle` and `walk`, in the atlas; `sprite check` and `sprites:check` are clean.
- [ ] `public/assets/sprites/README.md` updated.
- [ ] `npm test` passes. Committed after step 02, on `long-campaign-stage-03`, without pushing, the message ending with the repo's `Co-Authored-By` attribution line.
- [ ] Step 03's row in the index set to `done` with the commit, and this file's execution record filled.

## Execution record
