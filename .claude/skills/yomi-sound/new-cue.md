# A new cue

## Recipes and the build

The format is normative in `docs/designs/audio-pass.md` §5.6, the tool's reading of it in `tools/audio/yomi_audio/recipe.py`; conventions and what the build fails on are in the reference ("Recipes", "Building and checking"). Runtime hints (bus, jitter, voice limits, extra gain) belong in `CUES` in `src/scenes/sounds.ts`, never in a recipe. A cue too short to reach its loudness target is reported *peak-limited*: make it denser, longer or compressed, not louder. `npm run sounds` is incremental by inputs hash; `npm run sounds:check` writes nothing and never re-encodes.

## Which sound plays when

The tables mapping game events to cues are in `src/scenes/sounds.ts` (`eventSounds`, `worldSounds`, `CUES`, `buttonCue`; not copied here, so they cannot go stale). `src/scenes/sounds.test.ts` fails when an event kind or an ability would sound nothing without an entry saying so. A new sound: a recipe in `sfx/<bank>/`, `npm run sounds`, an entry in `CUES`, and the event table that plays it; commit the recipe, any new source and the generated files together. A button that closes or steps back also belongs in `BACK_LABELS` (`src/scenes/sounds.ts`).

## Listening

Agents cannot hear. Measure instead: `sfx audition --spectrogram` prints each
variant's loudness, true peak and length against its group and writes a
spectrogram PNG per variant to look at. The user listens, from the WAVs in
`.audition/`.
