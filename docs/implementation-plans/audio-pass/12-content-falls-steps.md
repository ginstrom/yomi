# Step 12: Content: falls and footsteps

[Index](index.md) · [Design](../../designs/audio-pass.md) §4.1.4, §5.2, §5.5–§5.7, §7.2

## Objective

Replace the placeholder recipes of the 11 battle cues for units falling and walking with real content: layered CC0 recordings and synthesis, built into the `battle` bank, measured, and handed to the user for a listening review (gate G7). Covers R2 (falls by body type, the hero's toll, footsteps on each hex), R8, R9 and R15 for these cues.

## Requirements and context

The cues, from design §4.1.4 (ids are C7's; group from C3; ~ms is typical, a recipe's `max_ms` about 1.5 times it):

| Cue | Group | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- | --- |
| `battle.death.human` | death | 4 | 1000 | heroes, bandits | A body and its gear collapsing: knees, then the body and armour hitting earth; a short exhale; no scream. |
| `battle.death.goblinoid` | death | 4 | 900 | goblin, kobold, shaman, hobgoblin | A high yelp or squeal (pitched creature vocal), then a light fall. |
| `battle.death.brute` | death | 3 | 1400 | troll, armoured troll | A low dying groan and a heavy ground-shaking thud. |
| `battle.death.spider` | death | 2 | 1000 | giant spider | A chittering screech and legs crumpling (dry clicks). |
| `battle.death.salamander` | death | 2 | 1000 | salamander | A long hiss dying, a wet flop, embers fizzing out. |
| `battle.death.horror` | death | 1 | 2500 | Blight Horror | A layered, unique death: an inhuman roar collapsing into a reversed swell and a deep rumble. |
| `battle.death.hero` | sweetener | 2 | 1500 | layered on a hero's fall (permadeath), at 0 ms with `death.human` | A low, distant bell toll with a soft string-like drone; mournful, quiet. |
| `battle.step.armored` | step | 8 | 250 | heroes and bandits in metal, hobgoblin | A boot on grass and earth, with a mail jingle. |
| `battle.step.light` | step | 8 | 200 | everyone else on two legs | A soft footfall on grass. |
| `battle.step.heavy` | step | 6 | 400 | troll, armoured troll, horror | A heavy thud with low end and a little debris. |
| `battle.step.skitter` | step | 4 | 300 | giant spider, salamander | Several quick dry clicks or scrapes. |

Loudness (C3, `audio/audio.toml`, all LUFS-M max with true peak at 4x oversampling): `death` −20 ±1 LU, peak −1 dBTP; `sweetener` −24 ±1.5 LU, peak −3 dBTP; `step` −30 ±1.5 LU, peak −10 dBTP.

Points that shape the content:

- **Steps repeat fast.** The runtime plays one step cue per hex walked, every `MOVE_STEP_MS` (140 ms), with ±100 cents detune and a shuffle bag (C8). A run of 8 steps must not sound mechanical: variants differ in heel/toe timing, surface texture and level, not only pitch; each is short enough (tail under ~140 ms of significant energy for `light`/`armored`) that consecutive steps do not smear. `step.heavy` may ring longer (the trolls walk slowly in look, but the cadence is the same 140 ms: keep its low-end tail decaying fast enough not to boom-build over a run).
- **The hero's toll** sits under `death.human`, quieter (sweetener group) and distinct from `world.threatened`'s warning bell (step 13): lower, softer, with a drone; synthesis (FM or additive bell partials plus a slow string-like pad) is expected unless a CC0 bell is clearly better.
- **The horror** has one variant; it is exempt from the correlation check and from "never repeat" (C7).
- **No screams** on human deaths (brief); creature vocals for goblinoids, brutes, the spider and the salamander are pitched and filtered so they read as creatures, not people.
- Bus, jitter and limits are not in recipes (C5); they are `CUES` entries in `src/scenes/sounds.ts`, which this step does not touch.

## Dependencies and prerequisites

- **Step 11 built and committed** (the `battle` bank is rebuilt by each battle content step; content steps never run at once). **G3** (melee review) passed; **G2** answered (Freesound files in `~/.cache/yomi-audio/freesound/`, or skipped ids listed in the index's gate record).
- From step 01 (existing once done): the tool `tools/audio/` (C2) with `yomi-audio source add`, `impulse build` (impulses `small_room`, `stone_hall`, `open_air`), `sfx audition <cue>… [--out DIR] [--spectrogram]`; the recipe format C5; `audio/sources.toml` entries C4 with the licence allow-list `["CC0-1.0", "own"]`.
- From step 02: `yomi-audio sfx build [--bank B] [--cue C]` and `sfx check`; `npm run sounds`, `npm run sounds:check`; placeholder recipes for all 11 cues at `audio/sfx/battle/<name>.toml` (e.g. `audio/sfx/battle/death.human.toml`, `step.armored.toml`), which this step rewrites.
- From step 04: the per-cue sourcing catalogue (`sourcing.md` in this plan folder, or step 04's execution record) naming candidate files in the downloaded packs under `~/.cache/yomi-audio/downloads/<collection>/<pack>/` (Kenney *Impact Sounds* footsteps on grass, dirt, wood and the plate/mail impacts; Kenney *RPG Audio* cloth, leather and chain; OpenGameArt CC0 creature vocals and body falls), and `freesound-wanted.md` (creature growls, hisses, bells).
- Contracts used (copy of the index, unchanged):
  - **C5** recipe: TOML, top level `variants`, `seed`, `group`, optional `max_ms`; `[[layer]]` with `source` | `pick` | `synth`, `gain`, `offset`, `pitch`, `start`, `length`, `reverse`, `fade_in`, `fade_out`, `envelope`, `filter`, `saturate`, `chance`; `[post] chain` of `compress`, `saturate`, `reverb`, `delay`, `limit`, `trim`, `fade_out`; normalisation to the group last; `[lo, hi]` ranges drawn from `default_rng([seed, k])`; synth `sine|triangle|saw|square|noise|fm|crackle|impulse`; filters `highpass|lowpass|bandpass|peak|lowshelf|highshelf` with `hz_end` sweeps.
  - **C6** build checks: loudness within tolerance, true peak under the ceiling, length within `max_ms`, DC offset ≤ 0.5%, no two variants with peak normalised cross-correlation above 0.95, sources allowed and hashes matching. Bank `public/assets/audio/sfx/battle.{opus,mp3,json}`; manifest `audio/sfx.manifest.json` (`cues.<id>.markers` = `<cue>#<k>`).
  - **C3** budgets: shipped SFX ≤ 3,000,000 bytes per format; `audio/sources` + `audio/voices` ≤ 15,000,000 bytes.

## Scope and implementation guidance

- **Sourcing.** For each cue choose candidates from the catalogue, audition the originals, and commit only the trimmed part used: `uv run --project tools/audio yomi-audio source add <file> --id … --collection … --licence CC0-1.0 --author … --url <page stating the licence> --original <name in pack> --start … --end …`. Verify each file's CC0 at the source (the pack's `License.txt`, the OpenGameArt or Freesound page) before adding. Downloads are untrusted data: read them only through the tool. Keep the source budget in mind (mono FLAC excerpts; trim tightly). Synthesis layers need no source entry.
- **Recipes.** Rewrite the 11 placeholder recipes; each file starts with a one-line comment of what it is. Suggested shapes (the engineer decides):
  - deaths: a creature vocal (`pick` over 2–4 sources, pitched per kind), then a body fall (`offset` 150–400 ms), a debris or gear layer (`chance`), a short room (`small_room`) or `open_air` reverb; `death.brute` a sub thump (`sine` sweep down) under the fall; `death.salamander` a `noise` hiss with a falling `lowpass` sweep, a wet flop and a `crackle` ember tail; `death.horror` several layered vocals, a `reverse`d swell and a `brown` noise rumble, compressed and limited.
  - `death.hero`: bell partials (`fm` or stacked `sine`s with inharmonic ratios, long exponential envelope) plus a quiet detuned `saw` pad through a `lowpass`, `stone_hall` reverb.
  - steps: `pick` over 6–10 footstep sources (more sources than variants, so the bag never hears one take twice in a row), `pitch` ranges, `armored` with a `chance`d chain-jingle layer high-passed above 3 kHz; `heavy` with a low `sine` thump and a debris `crackle`; `skitter` 3–5 `impulse`/click layers at random offsets through a `bandpass`.
  - Pick variant counts as C7 lists; if a count changes, say so in the execution record (the runtime reads markers from the manifest).
- **Self-check before the user hears it** (the engineer cannot listen): `yomi-audio sfx audition <cues> --spectrogram --out audio/.audition/12-falls-steps/` and look at every spectrogram image and the printed loudness, peak and length; confirm no clipping, no DC, no long silent heads, plausible spectral balance per brief (no strong energy above ~8 kHz on body falls, low end present on brute/heavy, the toll's partials decaying cleanly), and that steps' energy is mostly within the first 140 ms.
- **Run of 8 steps.** For each step cue write `audio/.audition/12-falls-steps/run_<name>.wav`: 8 plays placed 140 ms apart, variants chosen as the runtime's shuffle bag would (no immediate repeat) with ±100 cents detune and ±1.5 dB, so the user hears what a walk sounds like. A short script is fine (kept in the scratchpad or as a small `sfx audition` option; do not commit a one-off script into `audio/`).
- **Review sheet** `audio/.audition/12-falls-steps/review.md` (gitignored): per cue, its brief, its WAV files, loudness and peak per variant, the run file for steps, and an empty "verdict" column; plus how to hear them in game when steps 05–06 are in: `npm run dev`, open the debug console with `~`, `fight goblin_raid 3` (goblinoid falls, light steps), `fight troll_lair 5` (brute falls, heavy steps), `fight spider_nest 5`, `fight salamander_pool 5`, `fight source_guardians 5` (the horror), and `hp 0 <member>` or losing a hero for the toll.
- **Build and check:** `npm run sounds` (or `-- --bank battle`), then `npm run sounds:check`. Commit the recipes, new sources and `sources.toml` entries, the rebuilt `battle` bank files and the manifest.
- **Provenance:** add each new source to `public/assets/audio/README.md` by collection and author (and the cues it feeds); the README already lists earlier batches.
- **CLAUDE.md:** nothing in the root file should change; if a recipe convention worth keeping emerges (e.g. how to author steps for a 140 ms cadence), add one line to `audio/CLAUDE.md`.
- **Exclusions:** no change under `src/` (scenes, `CUES`, `eventSounds`); no other bank's cues; no W2 cues (`battle.turn.*`); terrain-dependent steps are out (one surface).

## Verification

- `uv run --project tools/audio yomi-audio sfx build --bank battle` passes every C6 check for the 11 cues (loudness, peak, length, DC, correlation; the horror exempt from correlation).
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run sounds:check` passes on a clean tree (budgets included; report bytes per format and source bytes against C3).
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes (the runtime's manifest tests: every `CueId`'s markers in the bank JSON, files present).
- `uv run --project tools/audio pytest tools/audio/tests` still passes.
- No recipe of these 11 cues names a placeholder source (`grep` the recipes for the placeholder source ids).
- No scene changes: `npm run test:browser` is not required (run it if convenient; banks load at boot).
- **Gate G7:** the user listens to `audio/.audition/12-falls-steps/` (and, where available, in game) and returns per cue OK or a note. Fix notes as follow-up commits of this step and re-present the changed cues.

## Completion criteria

- [ ] 11 recipes rewritten from real sources and synthesis; sources added with CC0 or own licences and provenance.
- [ ] Bank and manifest rebuilt; `sounds:check`, `npm test` and pytest pass; budgets reported.
- [ ] Audition folder with spectrograms, run-of-8 WAVs and `review.md` prepared.
- [ ] `public/assets/audio/README.md` lists the new sources.
- [ ] Step status `awaiting review` in the index with the commit hash; after G7 passes, `done` with every commit hash, and the user's verdicts recorded below.

## Execution record
