# Feedback on sprite-tool

Notes from using sprite-tool 0.4.0 to animate Yomi's units and map sprites and
to draw the heroes' gear as layers over a body (October 2026). Each point says
what was needed, what the tool made of it, and what would have helped, most
useful first.

## What worked well

- **The Phaser target needed no glue.** Uncommenting `[[export]] type =
  "phaser"` gave an atlas and an animation file that `load.atlas` and
  `load.animation` take as they are. The pivot it writes from the canvas anchor
  set every sprite's origin, so the scenes lost their `setOrigin` calls.
- **Derived frames suit small animations.** A stride is `from = "idle_0"` and
  nine leg rows; a skull's glowing eyes are one `runs` line. The source says
  what moves and nothing else.
- **Variants carry over to everything.** `[variants.ember]` on the sword's gear
  sprite gave a second sprite with its own frames and its own `idle`
  animation, without a line more.
- **`check` caught a mistake at once.** A frame shifted down a pixel lost its
  bottom row, and the outline rule named every pixel that was left bare.
- **`preview --on` composes layers**, though it is documented for tiles:
  `sprite preview gear_bow --on warrior` showed the bow in the hero's hand,
  which is what made layered gear practical to draw.

## What would help

1. **Choose which sprites a target exports.** The game shows units from the
   atlas and icons from loose PNGs, but both targets export every sprite, so
   the build writes some fifty loose PNGs that nothing loads
   (`warrior__walk_0.png`, `gear_axe__idle_1.png` and so on), and an atlas
   that carries every icon and portrait. An `include` or `exclude` list of
   ids, globs or canvas classes on an `[[export]]` table would fix both.

2. **Move part of a frame.** A breathing frame is the whole figure a pixel
   lower with its feet where they were. `shift` moves the whole canvas, so the
   feet leave it and the frame fails `grounded` and the outline rule. The
   frame had to be written out again in full as a second grid of 32 rows that
   differ from the first by one. A `shift` limited to a range of rows (or a
   rectangle), such as `shift = { by = [0, 1], rows = [0, 27] }`, or a pair of
   `delete_row` and `insert_row` operations, would make it one line and keep
   the two frames from drifting apart when the first is edited.

3. **Layers as a first-class idea.** Gear drawn over a body is three things
   the tool does not know about:
   - The outline rule cannot hold for a part that meets another sprite: a
     crossguard resting on a fist has no outline under it. The gear sprites
     set `outline = false` and lose the check entirely. A sprite could name
     the one it is drawn over (`over = "warrior"`), and the rule be checked on
     the two together.
   - `preview --on` shows only the default frame. With `--frame`, or with an
     animation played side by side, a layer whose second frame has slipped
     out of step with the body's would be seen before it is in the game.
   - Nothing says that the body's `idle` and its gear's must have the same
     frame count and `ms`. A check for that would come with `over`.

4. **A length for each frame of an animation.** `ms` is one number for the
   whole animation, so a pause is written by repeating a frame (`frames =
   ["base", "base", "glow"]`), and a blink, which is open for seconds and shut
   for a moment, would take a dozen repeats. Phaser's format has a duration
   for each frame, and the export already writes one; the source could take
   `frames = ["base", { frame = "glow", ms = 150 }]`, or a list for `ms`.

5. **Preview an animation.** There is no way to see movement before the game
   runs. An animated GIF or APNG from `sprite preview <id> --anim idle`, or
   failing that the animation's frames in a labelled strip, would close the
   loop the way `preview` does for a still.

6. **`shift` loses pixels silently.** The guide says pixels pushed off the
   canvas are lost, and here it was the cause of the failure in point 2. The
   check reported the consequence (bare pixels on the bottom row) and not the
   cause. A warning that a shift dropped pixels would point at it.

7. **Share an animation or a frame between files.** The eight gear sprites end
   with the same nine lines: an `idle_1` shifted from `idle_0` and an `idle`
   animation whose `ms` has to match the body's. A project-level template, or
   an `[anim]` that a sprite takes from another by name, would leave one place
   to change the timing.

8. **Auto outline and detached pixels.** With `outline = "auto"`, a two-pixel
   puff of smoke becomes a four by three dark block. A palette key or a frame
   could be left out of the auto outline (`outline_skip = ["w"]`), for smoke,
   sparks and glints.

9. **Small things.**
   - `sprites.json` lists frames but not animations; a game that loaded the
     loose PNGs would have to read the sources for them.
   - The atlas's frame and animation names (`<id>/<frame>`, `<id>/<anim>`) are
     in the export's docstring and not in `sprite guide`, where the one
     writing the loading code looks.
   - `guide` could say that `preview --on` takes any sprite, not only a tile.
