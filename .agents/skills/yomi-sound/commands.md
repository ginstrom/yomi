# Commands

Run from the repository root (`--root` points elsewhere, as the tests do):

| Task | Command |
| --- | --- |
| Add a source | `uv run --project tools/audio yomi-audio source add <file> --id ID --collection C --licence L --author A --url U [--original NAME] [--start S --end E] [--notes N]` |
| Remove a source no recipe names (file and entry) | `uv run --project tools/audio yomi-audio source remove <id>` |
| Render the impulses | `uv run --project tools/audio yomi-audio impulse build [name ...]` |
| Listen to a cue | `uv run --project tools/audio yomi-audio sfx audition <cue>... [--out DIR] [--spectrogram]` |
| Build the banks (`npm run sounds`) | `uv run --project tools/audio yomi-audio sfx build [--bank B] [--cue C]` |
| Check the banks (`npm run sounds:check`) | `uv run --project tools/audio yomi-audio sfx check` |
| Render the narration lines whose inputs changed (`npm run narration`, which exports the jobs first; needs `--extra tts`) | `uv run --project tools/audio --extra tts yomi-audio voice render` |
| Design a voice's emotion clips | `uv run --project tools/audio --extra tts yomi-audio voice design <voice> [--emotions E,...] [--candidates N]` |
| The tool's tests | `uv run --project tools/audio pytest tools/audio/tests` |

A mistake prints one line naming the cue, source or field at fault and exits 1.
