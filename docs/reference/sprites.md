# Sprites reference

The detail behind `art/CLAUDE.md`, which keeps the contracts, and the `yomi-sprites` skill (`.claude/skills/yomi-sprites/`), which keeps the workflow. `sprite guide
--project art` prints the file format, the palette and the canvas classes;
this file says how the game uses them.

## Canvases

All sprites share `palette.toml`, a muted Baldur's Gate-style palette.

| What | Where | Canvas | Shown at |
| --- | --- | --- | --- |
| Units (one per `UnitKind`; creature size is drawn into the sprite) | `units/` | 32px `unit` | 3x |
| Gear laid over the hero body (`gear_<icon>`) | `gear/` | 32px `unit` | 3x |
| Item icons, runes among them | `icons/` | 20px `icon` | 2x |
| Socket pips (`icon_socket_empty`, `icon_socket_filled`) | `icons/` | 6px `pip` | 2x |
| World map points of interest (`map_<kind>`, one per `LocationKind`; `map_watchtower`; `map_blight`, shown at 1x inside a corrupted hex) | `map/` | 24px `map` | 2x |
| Encampment facilities (`camp_<facility>`, a frame `level_<n>` a level; `camp_plot` for one not built) | `encampment/` | 48px `building` | 3x |
| The encampment's tent and campfire | `encampment/` | 24px `map` | 2x |
| Battle effects (`fx_<name>`) | `effects/` | 16px `effect` | 2x |
| Portraits (`portrait_<id>`, one per `PortraitId` in `src/character/portraits.ts`) | `portraits/` | 32px `portrait` | 2x in the party's column, 4x on the character panel |

A portrait has no outline rule, as it fills its canvas edge to edge: a head
and shoulders facing the viewer, outlined in `k`, over a dark ground with a
lighter disc behind the head.

## Build targets

Both write into `public/assets/sprites/`. `frames` writes loose PNGs
(`<id>.png`, the first frame, and `<id>__<frame>.png` for each frame of a
sprite with several), of which the scenes load the icons and the portraits,
plus `sprites.json`, a per-sprite metadata index (size, anchor, bounds,
display scale) that nothing loads yet. `phaser` writes `atlas.png`,
`atlas.json` and `atlas.anims.json`: every frame on one sheet, and every
`[anim.<name>]` as a Phaser animation called `<id>/<name>`. `BootScene` loads
those, and units, gear and the map's sprites are shown from them. Neither
target filters which sprites it exports (sprite-tool 0.5.0 could, with
`canvases`, `include` or `exclude`), so the loose PNGs of the atlas's sprites
are written and committed though nothing loads them.

## Animation frames

A unit has `idle` (`idle_0`, and `idle_1` with everything above the shins a
pixel lower) and `walk` (`walk_0`, the legs apart; `walk_1`, the left foot
lifted; `walk_0` again; `walk_2`, the right foot lifted: four beats that
change only the leg rows, so gear keeps to its `idle_0`); a map sprite has
`idle` over its `base` frame. A frame that changes a few pixels is derived
(`from`, then `rows` or `runs`); `idle_1` is a whole grid, or derived with
`move`, which takes the rows above the shins a pixel down (`units/shaman`,
`rows = [0, 23]`, whose staff runs below them; `units/warrior`,
`rows = [0, 24]`, knees included).

## The hero's layers

`units/warrior` is a bare body (hair, tunic, trousers, boots, empty hands).
Each thing a hand can hold is a sprite of its own in `gear/` (`gear_<icon>`,
with a `[variants]` table for an enchanted one), laid over the body by
`GEAR_SPRITES` in `src/scenes/unitLook.ts`. What a hero wears is drawn the
same way: `gear_breastplate`, `gear_circlet` and `gear_cloak` (the cloak's
collar and clasp) over the body, and `gear_cloak_back` (the cape), which the
game draws *under* the body though it says `over = "warrior"` like the rest,
so `--on warrior` previews it on top; judge it alone (`--grid`) or in the
game.

Regions of the body's `idle_0` the layers keep to:

- the fist box (rows 17 to 21, columns 20 to 27) and the off hand (rows 17 to
  19, columns 7 to 10) belong to the body alone, so no worn overlay draws
  there;
- head overlays leave the face (rows 7 to 10, columns 15 to 20) open;
- only the cloak's back, behind the body, reaches below row 21;
- a weapon is gripped at column 25: the fist is at rows 18 to 20, columns 22
  to 27, and the weapon leaves row 19 open for the hand to show through. The
  warrior names that pixel `[points] grip = [25, 19]`, which the atlas
  exports on every frame (sinking a pixel in `idle_1`, as `move` carries it)
  and `UnitFigure.swing` turns the weapon about, so moving the fist means
  moving the point, not code.

A gear sprite says `over = "warrior"`: the outline rule is checked against
the body beneath it (the bow's string, one pixel wide, is `unoutlined`), its
`[anim.idle]` is `like = "warrior"`, and its `[anim.walk]` is `rest = true`,
holding `idle_0` while the body walks; `check` warns (W009) of a body
animation a gear sprite neither plays nor rests through. Its `idle_1` is
`idle_0` shifted down a pixel, so the two breathe together.

## Battle effects

`art/effects/fx_<name>.sprite.toml`, on the `effect` canvas, anchored at the
centre, with no outline or grounded rule. Draw one pointing right;
`BattleScene` turns it along its flight. One that flies point first names the
pixel that strikes `[points] tip`, and is placed by it. `fx_arrow` is drawn in
its own colours, edged in `k` to show over the floor; `fx_dart`, `fx_orb` and
`fx_burst` are drawn in pale greys (`W`, `w`, `l`) and tinted in each spell's
colour. A one-shot effect is an animation with `loop = false`
(`fx_burst/burst`), removed when it ends.
