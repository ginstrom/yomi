---
name: yomi-sound
description: Make or change Yomi's sound effects and narration with the yomi-audio tool: sourcing and licences, recipes, audition, build and check, voicing a line. Use before editing audio/ or a voiced beat.
---

# Making a Yomi sound

Sounds are text sources in `audio/` (recipes, sources, settings), built by the host-only `yomi-audio` tool in `tools/audio/` into `public/assets/audio/` and `public/assets/voice/`. Run every command from the repository root. What `audio/` must keep true (layout, licences, generated files) is in `audio/CLAUDE.md`.

Before handing off, run the `yomi-asset-check` agent (until it exists, `npm run sounds:check` and `npm test`).

## Files here

- [commands.md](commands.md): every `yomi-audio` command, what each is for, how a mistake reports.
- [new-cue.md](new-cue.md): writing a recipe, the build, which event plays which cue, listening without ears.
- [sourcing.md](sourcing.md): choosing, downloading and adding a source, its licence and excerpt.
- [narration.md](narration.md): voicing a cutscene beat, rendering, heteronyms, a new voice.
- `docs/reference/audio.md`: the full detail. Read "Sound design without ears" before writing a recipe, "Designing a voice" before a new voice, and "Narration engines" for the model pins and licences.

Adding the sound for new content (an ability, event or spell) is one line of that content's checklist: `.claude/skills/yomi-add-content/`.
