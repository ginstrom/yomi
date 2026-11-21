# Drawing rules

- A frame is written as a grid, one character per pixel, or as runs: `[frames.<name>.runs]`, then one line per row that has pixels, each a list of `[column, "pixels"]`. Runs suit a sprite that is mostly empty, which is most of them on the 32px canvases. Do not write a script to generate a grid: placing pixels at a row and column is what runs do.
- With `outline = "auto"` at the top of the file, draw only the interior and the tool adds the `k` outline.
- An item that differs from another only in colour is a `[variants.<name>]` table in that icon's file (`swap = { <key> = "<key>" }`, built as `<id>_<name>.png`), not a new file.
- Loop: `sprite check --project art` until it prints `ok`; `sprite show <id> --project art` to read the result as text, outline included (`--frame <name> --diff` prints only the rows a frame changes from the one it is derived from); `sprite preview <id> --grid --project art` for the colours, looking at the PNG it names (`--on warrior` shows gear over the body, `--points` marks the points); then `npm run sprites`.
- Movement is frames and an `[anim.<name>]` in the sprite's own file; the scenes only say which animation plays.
- A gear sprite (`gear/gear_<icon>`, on the `unit` canvas) says `over = "warrior"`, has `[anim.idle]` `like = "warrior"` and `[anim.walk]` `rest = true`, and keeps out of the body's fist, off-hand and face regions.
