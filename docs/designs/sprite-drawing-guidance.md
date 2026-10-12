# Sprites: drawing guidance and icon variants

## 1. Purpose and status

The magic work drew five item icons (`art/icons/icon_{wand,ring,amulet,circlet,cloak}.sprite.toml`) with a throwaway Python script that placed strings at a row and column and wrote out full 20×20 grids. sprite-tool already has that as a file form (whole-frame runs), and the session did not use it, because nothing it read on the way to drawing pointed there. The same session gave four enchanted items the icon of something else, though the tool can recolour a sprite in one line.

This design is Yomi's half of the fix. The tool's half is in the sprite-tool repository, `docs/designs/text-view-and-runs-discovery.md` (sprite-tool 0.4: a `sprite show` command that prints a sprite as text, and a guide that shows runs in its example). It was split from that design; nothing here changes the tool.

**Status: implemented** on 2026-10-12, R2 included: `v0.4.0` was tagged by then, and the upgrade changed no exported file. The swaps of section 4.3 were kept as given, and a variant is exported as `<id>_<name>.png`, as assumed.

## 2. Requirements and scope

| ID | Requirement | Needs |
| --- | --- | --- |
| R1 | `art/CLAUDE.md` says how to draw: as a grid or as whole-frame runs, with `outline = "auto"`, and never with a script. | 0.3.0 |
| R2 | `art/CLAUDE.md` installs sprite-tool `v0.4.0`, and its loop looks at a sprite with `sprite show` before `sprite preview`. | 0.4.0 |
| R3 | The four enchanted items that borrow an icon get their own, each a recoloured variant of the icon it borrows. | 0.3.0 |

Non-goals:

- Converting the existing sprites to runs. A grid that is drawn stays a grid.
- New artwork for the four items. A variant changes colours only.
- Any change to the build, the export target, the canvas classes or the palette.

Acceptance criteria:

| ID | Criterion | Covers |
| --- | --- | --- |
| A1 | `art/CLAUDE.md` names whole-frame runs and `outline = "auto"`, and says not to generate a grid with a script. Every statement in it is true of the sprite-tool version it tells the reader to install. | R1, R2 |
| A2 | After R2, `art/CLAUDE.md` installs `v0.4.0`, `sprite --version` on the host agrees, and `npm run sprites:check` passes with no exported file changed by the upgrade. | R2 |
| A3 | `sprite check --project art` prints `ok` with 33 sprites (29 and four variants), and `public/assets/sprites/` holds `icon_wand_storm.png`, `icon_sword_ember.png`, `icon_bow_hawk.png` and `icon_ring_fortune.png`. | R3 |
| A4 | In the inventory, the Wand of Storms, Emberblade, the Hawkeye Bow and the Ring of Fortune each show an icon that can be told from the Wand of Sparks, the Iron Longsword, the Yew Bow and the Ring of Protection at the size the game shows it. | R3 |

## 3. Current system

Inspected on 2026-10-12.

- [`art/CLAUDE.md`](../../art/CLAUDE.md) calls the sources "text grids" and gives the loop `check`, `preview`, `npm run sprites`. It mentions neither runs nor `outline = "auto"`. It pins `v0.3.0`.
- `sprite guide --project art` (0.3.0) does state both, in two lines of prose well below its example, which is a grid.
- Every sprite in `art/` is a grid; 5 of the 13 icons use `outline = "auto"`. No sprite has a variant.
- `ItemIcon` ([`src/inventory/inventory.ts`](../../src/inventory/inventory.ts)) has 13 ids, and `ITEM_ICON_KEYS` ([`src/scenes/itemIcons.ts`](../../src/scenes/itemIcons.ts)) maps each to `icon_<id>`. `InventoryScene` and `BattleScene` load every key in that table, so a new icon needs an id, a key and a PNG, and no change to a scene.
- Shared icons: `STORM_WAND` uses `wand`, `EMBERBLADE` uses `sword`, `HAWK_BOW` uses `bow`, and `RING_FORTUNE` uses `ring`.
- A variant is declared in the sprite's own file as `[variants.<name>]` with `swap = { <key> = "<key>", ... }`. It makes a second sprite with the id `<id>_<name>`, with all keys swapped at once, after the outline is added, so `k` stays unless it is named. The `frames` export is assumed to write `<id>_<name>.png` beside the base sprite's; the first build confirms it.

## 4. Proposed changes

### 4.1 `art/CLAUDE.md`: how to draw (R1)

The bullet that begins "Sources are text grids" becomes "Sources are text", and a new bullet follows it:

> - A frame is written as a grid, one character per pixel, or as runs: `[frames.<name>.runs]`, then one line per row that has pixels, each a list of `[column, "pixels"]`. Runs suit a sprite that is mostly empty, which is most of them on the 32px canvases. With `outline = "auto"` at the top of the file, draw only the interior and the tool adds the `k` outline. Do not write a script to generate a grid: placing pixels at a row and column is what runs do.

This is true of 0.3.0 and is made now, without waiting for the tool.

### 4.2 `art/CLAUDE.md`: version and loop (R2)

When sprite-tool `v0.4.0` is tagged:

- The install command's tag becomes `v0.4.0`, and the host's copy is upgraded with the same command and `--force`.
- The loop bullet becomes: `sprite check --project art` until it prints `ok`; `sprite show <id> --project art` to read the result as text, outline included; `sprite preview <id> --grid --project art` for the colours; then `npm run sprites`.
- The `sprite new` example gains a second form with `--runs`, for a sprite started as runs.

0.4 changes no export, so the upgrade must leave `npm run sprites:check` passing. If it does not, that is a tool bug and the pin stays at `v0.3.0`.

### 4.3 Icon variants (R3)

Four `[variants.<name>]` tables, each in the file of the icon it recolours:

| Item | Source file | Variant | `ItemIcon` | Texture key | Swap to start from |
| --- | --- | --- | --- | --- | --- |
| Wand of Storms | `icon_wand.sprite.toml` | `storm` | `wand_storm` | `icon_wand_storm` | `b = "l", c = "w"` (the blue gem turns pale) |
| Emberblade | `icon_sword.sprite.toml` | `ember` | `sword_ember` | `icon_sword_ember` | `l = "r", w = "o"` (the blade glows red) |
| Hawkeye Bow | `icon_bow.sprite.toml` | `hawk` | `bow_hawk` | `icon_bow_hawk` | `n = "O", t = "y"` (gilded limbs) |
| Ring of Fortune | `icon_ring.sprite.toml` | `fortune` | `ring_fortune` | `icon_ring_fortune` | `R = "G", r = "g", o = "e"` (a green stone) |

The names, ids and keys are fixed by this design. The swaps are a starting point: judge each by `sprite preview <id> --project art` next to its base icon, and change the keys until A4 holds. A swap may use only keys of `art/palette.toml`.

Code and documents that change with them:

- `ItemIcon` gains the four ids, `ITEM_ICON_KEYS` the four keys, and each of the four items its new `icon`.
- `public/assets/sprites/README.md` gains a row for each new PNG, naming the base icon's source file.
- `art/CLAUDE.md` gains one sentence: an item that differs from another only in colour is a `[variants.<name>]` table in that icon's file, not a new file.

The root `CLAUDE.md` needs no change: it already says an icon is keyed by `ITEM_ICON_KEYS`.

## 5. Consequences

- R1 and R3 can be one commit today; R2 is a later commit of its own, since it depends on a release.
- The four new PNGs, `sprites.json` and `.sprite-tool-manifest.json` are committed with the sources, as for any sprite.
- Guidance in `art/CLAUDE.md` repeats two sentences of `sprite guide`. That is the point: the file loads by itself when work starts in `art/`, and the guide has to be asked for and read to the end.

## 6. Verification

- `sprite check --project art`, `npm run sprites`, `npm run sprites:check`, `npm test`.
- `npm run test:browser`, since two scenes load the new textures.
- A4 by eye: one `sprite preview` of the eight icons concerned, and the inventory in the dev server with the four items in a backpack.
- R1 and R2 have no automated check. The test of them is the next sprite drawn: it passes when no generator script is written.

## 7. Open questions and assumptions

Nothing here blocks planning.

- **Assumed:** a variant is exported by the `frames` target as `<id>_<name>.png`. If it is not, R3 falls back to four small files that copy the base grid, and the gap is reported to sprite-tool.
- **Assumed:** recolouring is enough to tell the items apart at 2×. If a swap cannot manage it for one of them, that item gets its own drawing, written as runs.
- **Open:** whether the two wands should differ in shape as well as colour. Not needed for A4.
