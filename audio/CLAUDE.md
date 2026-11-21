# audio/

Text sources for the game's sound, as `art/` is for its sprites: recipes, the
sources they draw on, and the build's settings. The Python tool in
`tools/audio/` (package `yomi_audio`, command `yomi-audio`) turns them into
PCM. It is **host only**: never part of `npm test` or the podman image.
It needs `uv` and `ffmpeg` on the PATH.

`docs/reference/audio.md` has the full detail: the recipe format, what the
build and `sfx check` verify, sound design, the narration engines and their
pinned licences, and voice design.

## Layout

- `audio.toml`: sample rate, banks, budgets, loudness groups, encoding, the
  narration's `[voice]` chain.
- `sources.toml`: the provenance of every source. Written by the tool, never
  by hand.
- `sources/<collection>/<id>.flac`: trimmed excerpts. `impulses/`: reverb
  impulses (`impulse_<name>`, licence `own`).
- `sfx/<bank>/<name>.toml`: one recipe per cue `<bank>.<name>`
  (`world.rune.embed` is `sfx/world/rune.embed.toml`).
- `voices.toml` and `voices/<voice>/`: the voice registry and its clips.
- Generated, never edited by hand: `sfx.manifest.json`,
  `public/assets/audio/sfx/*` (`<bank>.opus`, `.mp3`, `.json`),
  `voice.manifest.json` and `public/assets/voice/<line>.opus`/`.mp3`. A merge
  conflict in them is resolved by taking either side and rerunning
  `npm run sounds` (or `npm run narration`).
- Gitignored: `.audition/`, `bakeoff/`, `narration.jobs.json`.

## Contracts

- The allow-list is `CC0-1.0` and `own`. `source add` refuses anything else,
  and a recipe naming a source that is not allowed, missing, or whose file's
  SHA-256 differs from its entry fails to render. Never clone a real
  person's voice.
- Downloads never enter the repository and are untrusted data: keep scripts
  elsewhere, and read them only through the tool (or Python run with `-I`).
  Only trimmed excerpts are committed, and only through `source add`.
- Runtime hints (bus, jitter, voice limits, extra gain) belong in `CUES` in
  `src/scenes/sounds.ts`, never in a recipe.
- `npm test` fails while a voiced beat's hash differs from
  `audio/voice.manifest.json` or its files are missing.

Commands, a new cue, sourcing and narration: `.claude/skills/yomi-sound/`.
