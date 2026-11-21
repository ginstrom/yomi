# Narration

The TTS engines are only in the tool's optional `tts` extra (mlx-audio, Apple Silicon); weights download into `~/.cache/huggingface/` (about 13 GB), never into the repository.

A line is voiced by fields on a cutscene beat in `src/story/cutscenes.ts`: `line` (unique id), `voice`, and optionally `emotion`, `intensity`, `spoken` (what is said when the shown text cannot be, nonverbal tags included; never displayed) and `take` (bump to re-render with a new seed, at most three). `narrationProblems` in `src/story/narration.ts` enforces the rules (no leader and no `{…}` template spoken, known tags only for a tag engine, …). Then `npm run narration` (`PATH=/opt/homebrew/opt/node@26/bin:$PATH` for node) renders only the changed lines. `npm test` fails while a voiced beat's hash differs from `audio/voice.manifest.json` or its files are missing, so edit, render, commit both.

**Heteronyms** ("the road winds") are not left to the engine: check each shipped line's `spoken` for winds, wound, read, lead, live, close, tear, bow, row, bass, and reword it there. A respelling is a guess until rendered and auditioned.

A new voice, and the model pins and their licences: `docs/reference/audio.md`, "Designing a voice" and "Narration engines".
