# Sourcing a sound

The allow-list and the rule that downloads never enter the repository are in `audio/CLAUDE.md`.

- Preference: Kenney packs (kenney.nl), OpenGameArt CC0 only, Freesound CC0
  only, then synthesis and own recordings. Sonniss and every
  non-redistributable pack are excluded.
- Each pack goes in its own new, empty folder
  `~/.cache/yomi-audio/downloads/<collection>/<pack>/`; Freesound originals
  (downloaded by the user) in `~/.cache/yomi-audio/freesound/`. Keep scripts
  elsewhere, and read them only through the tool (or Python run with `-I`).
- `source add` sums to mono, resamples to 48 kHz and records both hashes and
  the excerpt. Check an excerpt's onset first (some originals open with
  silence); leave `--start`/`--end` off to keep a short file whole.
- The catalogue of candidates per cue, pack licences and fallbacks is
  `docs/implementation-plans/audio-pass/sourcing.md` (and
  `freesound-wanted.md`, the download list): read it before choosing files.
