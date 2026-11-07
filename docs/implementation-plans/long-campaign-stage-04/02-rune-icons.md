# Step 02: Rune icons and socket pips

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-04-runes.md) (§2 "Scenes": "Each rune gets an icon, and items show a socket pip row"; S4-R6) · [Stages index](../../designs/long-campaign/index.md) ("Sprites")

**Difficulty:** art judgement. The drawing needs the session's model (engineer opus, reviewer opus; CLAUDE.md, "Subagents"). A mechanical re-export or README row may use `model: "sonnet"`. No code changes.

## Objective

Draw ten rune icons, one per rune kind, and two socket pips (empty and filled), and add the `pip` canvas class they need. Step 08 wires them into `itemIcons.ts` (`RUNE_ICON_KEYS`, `SOCKET_PIP_KEYS`). After that, the inventory, trading post and crafting screens show runes in the pouch and pips on items. The stages index says a stage is not done while anything falls back to a placeholder, so these must be finished drawings.

## Requirements and context

- **Contract C9** (index, copied unchanged):

  | What | Names | Made in | Wired in |
  | --- | --- | --- | --- |
  | Rune icons (20px `icon` canvas) | `icon_rune_<id>` for each of the ten `RUNE_IDS` | step 02 (`art/icons/`) | step 08: `RUNE_ICON_KEYS` |
  | Socket pips (new `pip` canvas, about 6×6) | `icon_socket_empty`, `icon_socket_filled` (the filled one drawn light, to take a tint) | step 02 | step 08: `SOCKET_PIP_KEYS` |

  ```ts
  // src/scenes/itemIcons.ts (existing file, Phaser-free; step 08)
  export const RUNE_ICON_KEYS: Record<RuneId, string>                         // 'icon_rune_ember', …
  export const SOCKET_PIP_KEYS: { empty: string; filled: string }             // 'icon_socket_empty', 'icon_socket_filled'
  /** Each rune's colour, for its filled pip's tint and its rows' text. */
  export const RUNE_COLOURS: Record<RuneId, number>
  /** An item's pips, socket by socket: the rune's id where one sits, null where empty; empty for an item with no sockets. */
  export function socketPips(item: Item): Array<RuneId | null>
  ```

  - `InventoryScene`, `TradingPostScene` and `CraftingScene` load every `RUNE_ICON_KEYS` and `SOCKET_PIP_KEYS` image from `assets/sprites/<key>.png`.
  - They draw an item's pips in a row along the bottom of its icon.
- **The names must be exactly these twelve:** `icon_rune_ember`, `icon_rune_rime`, `icon_rune_storm`, `icon_rune_venom`, `icon_rune_acid`, `icon_rune_stone`, `icon_rune_wind`, `icon_rune_life`, `icon_rune_mind`, `icon_rune_dawn`, `icon_socket_empty` and `icon_socket_filled`. The scenes load `assets/sprites/<key>.png`, so a wrong name is a missing texture in step 08.
- **Correction 13 (index):**
  - There is one icon per rune kind. The rank is a numeral the scenes draw beside it (I to IV), never a separate icon or a variant.
  - There are two socket pips. The filled one is tinted with the rune's colour at runtime (`RUNE_COLOURS`).
  - The pips need a new `pip` canvas class in `art/sprite-tool.toml`.
- **The rune icons.** Each is a small carved stone or tablet with a glyph cut into it. All ten share one body shape and size, so that they read as one family of objects. They are told apart at a glance by the glyph and the colour of the glyph and its glow. Do not draw a `[variants]` table: each kind is its own source file, because the glyphs differ.

  | Icon | Rune (C1) | Element | Effect (weapon / armour) | Must read as |
  | --- | --- | --- | --- | --- |
  | `icon_rune_ember` | Ember | fire | fire damage on a hit, Seared at rank 3 / fire ward | a flame glyph in orange and red |
  | `icon_rune_rime` | Rime | frost | frost damage, Chilled on a critical / frost ward | a snowflake or crystal glyph in pale blue and white |
  | `icon_rune_storm` | Storm | lightning | to hit / lightning ward | a zigzag bolt glyph in yellow |
  | `icon_rune_venom` | Venom | poison | poison damage, Poisoned on a critical / poison ward | a fang or drop glyph in green |
  | `icon_rune_acid` | Acid | acid | piercing / acid ward | a dripping or etched glyph in yellow-green; told apart from Venom's green |
  | `icon_rune_stone` | Stone | none | damage / resistance, a shield's armour class | a square or mountain glyph in earthy brown or grey; the plainest of the ten |
  | `icon_rune_wind` | Wind | none | critical / armour class | a swirl or curling glyph in pale grey-cyan |
  | `icon_rune_life` | Life | none | heals on a hit / maximum hit points | a heart or leaf glyph in warm red or bright green; told apart from Venom |
  | `icon_rune_mind` | Mind | none | spell skill in a wand or staff / mana | an eye or star glyph in violet or blue |
  | `icon_rune_dawn` | Dawn | blight | blight-bane damage / blight ward | a sunrise or rayed glyph in gold and white |

  - The ten must be told apart from each other and from today's item icons, at 2x in a 40px inventory cell.
  - Where two glyph colours are close (Venom, Acid and Life; Rime and Wind), the glyph's shape must do the work.
- **The socket pips.**
  - `icon_socket_empty`: a dark, hollow or recessed socket, outlined, reading as "empty" on any icon background.
  - `icon_socket_filled`: a round or faceted gem in light greys and white. A tint multiplies the colours, so keep it light enough to take any `RUNE_COLOURS` tint without going muddy.
  - Both are drawn on the new `pip` canvas and sit in a row along the bottom edge of a 20px item icon. Keep them small enough that three fit across an icon with gaps.
- **The `pip` canvas class.** Add a table to `art/sprite-tool.toml` beside `[canvas.icon]`:

  ```toml
  [canvas.pip]              # a socket pip, laid in a row along the bottom of an item icon
  size = [6, 6]
  anchor = [3, 3]
  display_scale = 2        # as an item icon is shown (ITEM_ICON_SCALE)
  outline = ["k"]
  ```

  The exact size (about 6×6) is the drawer's call. Record the final size in the execution record, because step 08 places the pips by it.
- **Where the sprites come from:** text sources with sprite-tool. Never edit an exported PNG by hand: change the source and run `npm run sprites`.
  - Draw as whole-frame grids or runs with `outline = "auto"`, as the existing icons do (`art/icons/icon_sword.sprite.toml`).
  - Never generate a grid with a script ([`docs/designs/sprite-drawing-guidance.md`](../../designs/sprite-drawing-guidance.md) R1; `art/CLAUDE.md`).
  - All sprites share `art/palette.toml`. Use its keys, and add a colour only if no key will do.
- **Shared constraints (from the index):**
  - One commit for this step, sources and exports together, on `long-campaign-stage-04`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
  - `npm test` passes before the commit (local Node 26: `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or `make test`).

## Dependencies and prerequisites

- **No step dependency.** This step may run alongside step 01, since it touches no code and cannot move the simulator.
- **No other art step this stage**, so nothing else rebuilds the atlas at the same time.
- **Existing tools and references:**
  - the `sprite` CLI, on the host; run `sprite guide --project art` first, which prints the file format, the palette and the canvas classes;
  - `art/CLAUDE.md` (the workflow and the loop; read it before drawing);
  - `docs/designs/sprite-drawing-guidance.md`;
  - the existing sources in `art/icons/` for style, size and outline;
  - `npm run sprites` and `npm run sprites:check`.
- **Consumed by later steps:**
  - step 08 adds `RUNE_ICON_KEYS`, `SOCKET_PIP_KEYS`, `RUNE_COLOURS` and `socketPips`, loads the images in three scenes and draws the pips;
  - step 09 uses the rune icons in the crafting screen's Runes tab and the trading post's Runes section.

## Scope and implementation guidance

- **Add** ten files `art/icons/icon_rune_<id>.sprite.toml`, for example with `sprite new icon_rune_<id> --canvas icon --project art --dir icons --runs` (art/CLAUDE.md). Each has a single `base` frame, as the existing icons do.
- **Add** the `[canvas.pip]` table to `art/sprite-tool.toml`, and two files `art/icons/icon_socket_empty.sprite.toml` and `art/icons/icon_socket_filled.sprite.toml` on that canvas, each with a single `base` frame.
- **The loop** (from `art/CLAUDE.md`):
  1. `sprite check --project art` until it prints `ok`;
  2. `sprite show <id> --project art` to read the result as text, outline included;
  3. `sprite preview <id> --grid --project art`, looking at the PNG it names, for the colours;
  4. then `npm run sprites`.

  Judge the rune icons side by side, and next to today's item icons, for consistent scale and weight.
- **Commit** the sources and everything the build writes in `public/assets/sprites/`, `.sprite-tool-manifest.json` included.
- **Update `public/assets/sprites/README.md`** (provenance and licence) with a row for each of the twelve new PNGs, in the form of the existing icon rows. Its "used by" column is `InventoryScene`, `TradingPostScene` and `CraftingScene`.
- **Delegation:** the drawing may be handed to a subagent on the session's model.
- **Out of scope:**
  - any code change (`itemIcons.ts`, the scenes and the rune data are steps 03, 08 and 09);
  - icons per rank (the rank is a numeral; correction 13);
  - tinted variants of the filled pip (tinted at runtime).

## Verification

1. `sprite check --project art` prints `ok`, and `npm run sprites:check` is clean after `npm run sprites`.
2. The twelve loose PNGs exist:

   ```sh
   for i in rune_ember rune_rime rune_storm rune_venom rune_acid rune_stone rune_wind rune_life rune_mind rune_dawn socket_empty socket_filled; do test -f public/assets/sprites/icon_$i.png || echo "missing $i"; done
   ```

   This prints nothing.
3. `art/sprite-tool.toml` has a `[canvas.pip]` table, and the two pip PNGs are of its size (`file public/assets/sprites/icon_socket_*.png`).
4. **By eye:**
   - a preview grid of the ten rune icons, next to a few existing item icons. Each reads as its rune, and none is mistaken for another (Venom, Acid and Life; Rime and Wind).
   - a tint test: preview `icon_socket_filled` multiplied by a strong orange and a strong green, and confirm it stays legible.
   - three pips laid along the bottom of a 20px icon at 2x, and confirm they fit with gaps.
5. `npm test` passes (nothing in it reads the new files yet, but it is the gate).

## Completion criteria

- [x] Ten `icon_rune_<id>` and two `icon_socket_<state>` sources in `art/icons/`, finished drawings, each passing `sprite check`.
- [x] `[canvas.pip]` in `art/sprite-tool.toml`, its final size recorded below.
- [x] The exports, the atlas and the manifest rebuilt and committed; `npm run sprites:check` clean.
- [x] `public/assets/sprites/README.md` has the twelve rows.
- [x] `npm test` passes; one commit on `long-campaign-stage-04`, not pushed.
- [x] Step 02's row in [index.md](index.md) set to `done` with the commit.

## Execution record

- Drew ten `art/icons/icon_rune_<id>.sprite.toml` (20px, `outline = "auto"`, one shared stone-tablet body, a 8x10 glyph on a dark field) and `icon_socket_empty` / `icon_socket_filled` on a new `pip` canvas.
- **Pip size: 6x6**, anchor 3,3, scale 2 (the drawn pixels are 4x4 inside the outline, so a pip is 12px on screen; three fit in a 40px cell with gaps).
- **Palette:** added five keys, since none of the existing ones gave orange, acid yellow-green, violet or pale cyan: `F` flame, `E` acid, `v` violet, `V` light violet, `z` pale cyan.
- Glyphs: Ember flame, Rime snowflake, Storm bolt, Venom drop, Acid dripping bar, Stone plain block, Wind swirl lines, Life heart, Mind eye, Dawn rising sun.
- Checked: `sprite check` ok (121 sprites); `npm run sprites`, then `sprites:check` up to date; PNG sizes 6x6; tint test (none, orange, green) legible; `npm test` 1064 passed.
- Previews: `art/.preview/icon_rune_ember+13more.plain.png` (ten runes beside a sword and ring and the pips), `art/.preview/icon_socket_filled+icon_socket_empty.plain.tints.png`. `art/CLAUDE.md` and the sprites README updated.
