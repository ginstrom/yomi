# Step 02: Item icons and the trading post's level 4

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-03-gear-families.md) (§2 "Icons", S3-R5) · [Stages index](../../designs/long-campaign/index.md) ("Sprites")

**Difficulty:** art judgement. The drawing needs the session's model (engineer opus, reviewer opus; CLAUDE.md, "Subagents"). A mechanical re-export or README row may use `model: "sonnet"`. No code changes.

## Objective

Draw 19 new item icons, one for each new family, and a `level_4` frame for the trading post. When step 04 adds the icons to `ItemIcon` and `ITEM_ICON_KEYS`, the inventory, trading post and crafting screens show them. When step 06 raises the post to level 4, the encampment screen draws the new frame. The stages index says a stage is not done while anything falls back to a placeholder, so these must be finished drawings.

## Requirements and context

- **Contract C6** (index, copied unchanged). `ItemIcon` gains these 19 icons: `rapier`, `mace`, `spear`, `war_hammer`, `halberd`, `longbow`, `crossbow`, `staff`, `buckler`, `tower_shield`, `robe`, `leather`, `plate`, `cap`, `helm`, `gloves`, `gauntlets`, `boots`, `greaves`.

  | What | Names | Made in | Wired in |
  | --- | --- | --- | --- |
  | Item icons (20px `icon` canvas) | `icon_<icon>` for all 19 | step 02 (`art/icons/`) | step 04: `ITEM_ICON_KEYS` |
  | The trading post's level 4 | frame `level_4` of `camp_trading_post` | step 02 (`art/encampment/`) | none: `facilityFrame` already names `level_<n>` |
  | Held gear (32px `unit` canvas, over `warrior`) | `gear_rapier`, `gear_mace`, `gear_spear`, `gear_war_hammer`, `gear_halberd`, `gear_longbow`, `gear_crossbow`, `gear_staff`, `gear_buckler`, `gear_tower_shield` | step 03 (`art/gear/`) | step 04: `GEAR_SPRITES`, and `SWUNG_GEAR` for the six melee ones (rapier, mace, spear, war_hammer, halberd, staff) |
  | Worn gear | `gear_robe`, `gear_leather`, `gear_plate` (armour), `gear_cap`, `gear_helm` (head) | step 03 | step 04: `WORN_SPRITES` |

  ```ts
  // src/scenes/itemIcons.ts (step 04)
  /** A tier-2 material's tint over its family's icon; tier 1 is drawn untinted. */
  export const MATERIAL_TINTS: Readonly<Record<string, number>>   // steel, ironwood, wolfhide, silk
  export function iconTint(item: Item): number | undefined
  ```

- **The names must be exactly `icon_<icon>`** for the icon ids above (for example `icon_war_hammer`, `icon_tower_shield`). The scenes load one icon per `ItemIcon` from `assets/sprites/icon_<icon>.png` (`ITEM_ICON_KEYS` in `src/scenes/itemIcons.ts`). A wrong name is a missing texture in step 04.
- **One icon per family, untinted.** A tier is shown only by a runtime tint (`MATERIAL_TINTS`, step 04 and step 07; correction 10: a tier tints only the icon). Draw every icon in its tier-1 look:
  - metal families in iron greys;
  - wood families in yew browns;
  - hide families in leather browns;
  - the robe in undyed linen.

  The tint multiplies the colours, so keep the metal and cloth parts light enough to take a steel-blue or silk tint without going muddy. Do not draw a `[variants]` table for tiers (art/CLAUDE.md keeps variants for items that differ only in colour, such as an enchanted one; tiers are tinted instead).
- **What each icon must read as** (from contract C1's family table; told apart from each other and from today's 13 icons at a glance, at 2x in a 40px inventory cell):

  | Icon | Family (C1) | Must read as |
  | --- | --- | --- |
  | `rapier` | Rapier, a 4-AP blade, critical +5 | a thin, long, straight blade with a swept or cup hilt; slimmer than `icon_sword` |
  | `mace` | Mace, 1d6+3, pierces 2 | a short haft with a flanged or knobbed iron head |
  | `spear` | Spear, reach 2 | a long shaft corner to corner with a leaf-shaped head; clearly longer than any sword |
  | `war_hammer` | War Hammer, pierces 3 | a haft with a blocky hammer face and a back spike |
  | `halberd` | Halberd, two-handed, reach 2 | a long shaft topped by an axe blade and a spike; distinct from both the spear and `icon_axe` |
  | `longbow` | Longbow, range 7 | a taller, straighter bow than `icon_bow`, with a string |
  | `crossbow` | Crossbow, pierces at range | a stock with a short bow across it and a bolt laid on it |
  | `staff` | Staff, strikes with Magic | a wooden staff with a knotted or crystal-capped head; not a wand (`icon_wand` is short) |
  | `buckler` | Buckler, armour class 6 | a small round metal shield with a boss; clearly smaller than `icon_shield` |
  | `tower_shield` | Tower Shield, armour class 16, AP −1 | a tall rectangular shield filling the canvas's height |
  | `robe` | Robe, mana +6 | a long cloth robe with sleeves and a sash; no metal |
  | `leather` | Leather, armour class 12 | a brown jerkin or cuirass with laces or stitching; told apart from `icon_armor` (the breastplate) |
  | `plate` | Plate, resistance 4, AP −1 | a heavy full harness, plates and pauldrons; bulkier than `icon_armor` |
  | `cap` | Cap, head | a soft leather cap |
  | `helm` | Helm, head | an iron helm with a nasal or visor; told apart from `icon_circlet` |
  | `gloves` | Gloves, to hit +2 | a pair of leather gloves |
  | `gauntlets` | Gauntlets, resistance 1 | a pair of plated iron gauntlets |
  | `boots` | Boots, armour class 3 | a pair of leather boots |
  | `greaves` | Greaves, resistance 1 | a pair of iron shin plates or plated boots; told apart from `boots` |

- **The trading post's `level_4` frame.** `art/encampment/camp_trading_post.sprite.toml` draws a stall under a striped awning. Level 2 adds crates and a barrel, and level 3 a gilded sign. Each frame is derived from the one before (`[frames.level_3] from = "level_2"` with its own `runs`). Add `[frames.level_4] from = "level_3"` so that it reads as a grander, busier post: for example a second awning or bay, a weapon rack with steel blades, or a banner. Level 4 is the market that sells steel (C8). Keep to the 48px `building` canvas and its plot, as the other facilities do. The encampment screen picks the frame by level (`facilityFrame` in `src/scenes/encampmentView.ts`: `level_${facility.level}`), so no code changes.
- **Where the sprites come from:** text sources with sprite-tool. Never edit an exported PNG by hand: change the source and run `npm run sprites`.
  - Draw as whole-frame grids or runs with `outline = "auto"`, as the existing icons do (`art/icons/icon_sword.sprite.toml`).
  - Never generate a grid with a script ([`docs/designs/sprite-drawing-guidance.md`](../../designs/sprite-drawing-guidance.md) R1; `art/CLAUDE.md`).
  - All sprites share `art/palette.toml`. Use its keys; do not add colours unless no key will do.
- **Shared constraints (from the index):**
  - One commit for this step, on `long-campaign-stage-03`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
  - `npm test` passes before the commit (local Node 26: `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or `make test`).
  - Never commit on `armor-resistance` or `encampment-gear-and-resistance`.

## Dependencies and prerequisites

- **No step dependency.** This step may run alongside step 01 (it touches no code and moves no simulator figure).
- **Step 03 runs after this one.** `npm run sprites` rebuilds the whole atlas (`atlas.png`, `atlas.json`, `atlas.anims.json`) and the manifest, so two art steps committed in parallel would conflict on generated files.
- **Existing tools and references:**
  - the `sprite` CLI, on the host; run `sprite guide --project art` first, which prints the file format, the palette and the canvas classes;
  - `art/CLAUDE.md` (the workflow and the loop; read it before drawing);
  - `docs/designs/sprite-drawing-guidance.md`;
  - the 13 existing sources in `art/icons/` for style, size and outline;
  - `npm run sprites` and `npm run sprites:check`.
- **Consumed by later steps:**
  - step 04 adds the 19 ids to `ItemIcon` and `ITEM_ICON_KEYS`, and must not until this step is committed;
  - step 06 makes level 4 reachable;
  - step 07 applies the tints.

## Scope and implementation guidance

- **Add** 19 files `art/icons/icon_<icon>.sprite.toml`, for example with `sprite new icon_<icon> --canvas icon --project art --dir icons --runs` (art/CLAUDE.md). Each has a single `base` frame, as the existing icons do.
- **Edit** `art/encampment/camp_trading_post.sprite.toml`: add the `level_4` frame, and extend the file's header comment by a line on what level 4 adds.
- **The loop** (from `art/CLAUDE.md`):
  1. `sprite check --project art` until it prints `ok`;
  2. `sprite show <id> --project art` to read the result as text, outline included;
  3. `sprite preview <id> --grid --project art`, looking at the PNG it names, for the colours;
  4. `sprite show camp_trading_post --frame level_4 --diff` for the derived frame;
  5. then `npm run sprites`.

  Judge the icons side by side with the existing ones for consistent scale and weight.
- **Commit** the sources and everything the build writes in `public/assets/sprites/`, `.sprite-tool-manifest.json` included.
- **Update `public/assets/sprites/README.md`** (provenance and licence): a row for each new `icon_<icon>.png` in the form of the existing icon rows. Its "used by" column is `InventoryScene` (also `TradingPostScene` and `CraftingScene`, as the existing rows say). Note the new `camp_trading_post` frame where the facility's row is.
- **Delegation:** the drawing may be handed to a subagent on the session's model.
- **Out of scope:**
  - any code change (`ItemIcon`, `ITEM_ICON_KEYS`, `MATERIAL_TINTS` and the scenes are steps 04 and 07);
  - the gear sprites on the body (step 03);
  - tier variants (tints at runtime);
  - icons for socket pips (stage 4).

## Verification

1. `sprite check --project art` prints `ok`, and `npm run sprites:check` is clean after `npm run sprites`.
2. The 19 loose PNGs exist:

   ```sh
   for i in rapier mace spear war_hammer halberd longbow crossbow staff buckler tower_shield robe leather plate cap helm gloves gauntlets boots greaves; do test -f public/assets/sprites/icon_$i.png || echo "missing $i"; done
   ```

   This prints nothing.
3. The atlas has the frame `camp_trading_post/level_4` (look it up in `public/assets/sprites/atlas.json`'s frames).
4. **By eye:** a preview grid of all 19 next to today's icons. Each reads as its family and none is mistaken for another (spear and halberd, buckler and shield, boots and greaves, leather and breastplate, helm and circlet). A tint test helps: preview one metal icon multiplied by a pale steel-blue and confirm it stays legible. The level 4 frame reads as a step up from level 3 at 3x.
5. `npm test` passes (nothing in it reads the new files yet, but it is the gate).

## Completion criteria

- [ ] 19 `art/icons/icon_<icon>.sprite.toml` sources with the exact names of C6, finished drawings in the tier-1 look, legible under a tint.
- [ ] `camp_trading_post` has a `level_4` frame derived from `level_3`.
- [ ] `npm run sprites` run; sources and every generated file in `public/assets/sprites/` (manifest included) committed together; `sprites:check` clean.
- [ ] `public/assets/sprites/README.md` lists the new icons and the new frame.
- [ ] `npm test` passes; one commit on `long-campaign-stage-03`, not pushed, the message ending with the `Co-Authored-By` line.
- [ ] Step 02's row in the [index](index.md) set to `done` with the commit; the execution record below filled in.

## Execution record

- **Built:** 19 `art/icons/icon_<icon>.sprite.toml` (C6 names exactly), whole-frame grids with `outline = "auto"`, a single `base` frame each, drawn by hand in the tier-1 look (iron greys, yew and leather browns, the robe in undyed linen with a red sash), no `[variants]`. `camp_trading_post` gains `level_4` (`from = "level_3"`): a blue banner with a gold mark on a pole west of the stall, and a rack of three steel blades east of it behind the barrel; the header comment says so. `public/assets/sprites/README.md` has a row per new icon and notes the frame on the `camp_*` row.
- **Iteration:** the mace's first head (flanges as horizontal ridges) read as a claw, its second (a plain knobbed ball) as the axe at 1x; the third, a ball ribbed with dark vertical flanges, reads as neither.
- **Checks:** `sprite check --project art` → `ok: 93 sprites, 190 frames`; `npm run sprites` → `built: 93 sprites, 190 frames, 2 targets`; `npm run sprites:check` → `up to date`; the 19-PNG loop printed nothing; `atlas.json` has `camp_trading_post/level_4` (1 match); `npm test` → 997 passed (71 files), as at baseline.
- **By eye:** `sprite preview` of all 19 beside today's 13 at 1x and enlarged; the pairs the task names are told apart (spear: leaf head, no blade / halberd: blade and top spike; buckler: small round boss / shield: wooden heater / tower shield: full-height iron slab; boots: brown with feet / greaves: grey shin plates with knee cops and straps; leather: brown laced jerkin / breastplate: grey; helm: dome with nasal / circlet: band). Tint test (`--tint none,#a8bcd8,#e0c8e8,#8a7060`) on rapier, mace, war hammer, tower shield, buckler, plate, helm, robe, leather, staff, greaves: all stay legible; the darkest (#8a7060) muddies the plate's and greaves' bands a little, so step 04/07 should keep tier tints pale as planned. Level 4 against level 3 at 4x reads as the grander post.
- **Deviations:** none. The README's "used by" column names `InventoryScene`, `TradingPostScene` and `CraftingScene` (the existing icon rows name only `InventoryScene`).
- **For later steps:** step 04 may wire the 19 ids into `ItemIcon`/`ITEM_ICON_KEYS`; the longbow is drawn without an arrow (the bow has one) and the crossbow with a steel prod, so a steel tint shows on its prod and bolt head.
