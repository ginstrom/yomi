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

- [x] 11 recipes rewritten from real sources and synthesis; sources added with CC0 or own licences and provenance.
- [x] Bank and manifest rebuilt; `sounds:check`, `npm test` and pytest pass; budgets reported.
- [x] Audition folder with spectrograms, run-of-8 WAVs and `review.md` prepared.
- [x] `public/assets/audio/README.md` lists the new sources.
- [x] Step status `done` in the index with the commit hash. G7 is non-blocking (the orchestrator's brief): accepted on measurements and review, the user's listening deferred to the playtest, so no verdicts are recorded yet.

## Execution record

### Round 0: build (2026-11-14)

**Outcome.** The 11 recipes are rewritten from CC0 recordings and synthesis; no recipe of the 11 names a `placeholder_*` source (`grep -l placeholder_` over `audio/sfx/battle/{death,step}.*.toml` prints nothing). Variant counts and `max_ms` are C7's and step 02's, unchanged. Gate G7 is non-blocking (the orchestrator's brief): the audition folder and review sheet are left for the user's playtest, and the step is set `done` with G7 deferred.

**Direction.** Organic fantasy, not retro or sci-fi: every vocal is a real recording (rubberduck's creature vocals, Darsycho's troll roars and monster snarls, a raccoon's squeals, a groan), every fall real impacts, gear and earth; synthesis only under them (sub sweeps, brown-noise rumble, sparks, a scrape, the toll's string drone). Deaths stay in the game's tone: no scream on a human (a breath 13 dB down, then the body and kit), nothing gory (the salamander's "wet flop" is a splash and slime into shallows, not a flesh slap), each kind told apart by what speaks (below). Steps are quiet (−30 LUFS-M max), short (139–206 ms; heavy 249–291) and varied: two picked layers (10 footfalls, 5 grass steps) with pitch, filter, envelope and chance layers, so the eight variants differ in heel/toe timing, texture and level.

**Sources.** 52 excerpts added with `yomi-audio source add`, every one `CC0-1.0` with author, licence-page `url`, original, excerpt and both hashes (counted in the diff: 52 `id`, 52 `licence = "CC0-1.0"`, 52 `url`, 52 `sha256`):

- `kenney_rpg` (footstep00–09, dropLeather) and `kenney_impact` (footstep_grass_000–004, impactSoft_heavy_000–003): the packs' `License.txt` say CC0. The names on disk are `Audio/footstep0N.ogg` in RPG Audio and `Audio/footstep_grass_00N.ogg` in Impact Sounds (`sourcing.md` writes them loosely).
- `oga_rubberduck` (16): 80 CC0 creature sfx hurt_01, hurt_02; …sfx-2 die_01, die_02, breath_02, bug_08, _10, _12, monster_19, _20; creature sfx bug_02, _04; 75 CC0 breaking/falling/hit sfx rock_falling_01, _03, metal_falling_01, _02.
- `oga_darsycho` (new): Big Scary Troll Sounds (two troll-roars excerpts) and Monster Snarls (monster-snarl-5), author Darsycho as both pages state, licence CC0 (read with `curl` and a browser user agent, as in step 11).
- `oga_artisticdude` (RPG Sound Pack giant2), `oga_vehicle` (Tinysized wood-twigs-break-01, -02).
- `freesound`: 616622 by TRP (six raccoon squeals), 555423 by tonsil5 (the groan), 824588 by TicAshfield (three single strikes of the bell: the first, which no earlier strike rings under, and two with a free decay). Authors as the Freesound pages (and `freesound-wanted.md`) state; each checked "Creative Commons 0" (the orchestrator's brief).
- Reused: `rd_breath`, `kenney_soft_medium_*`, `kenney_punch_heavy_*`, `kenney_metal_light_*`, `kenney_cloth_*`, `ad_chainmail_*`, `ad_armor_light`, `rd_wood_crack_*`, `rd_splash_*`, `rd_slime_09/13/15`, `ad_fire_crackle_*`, `bart_steam_hiss`, `fs_snake_hiss_*` (706977), `qb_dark_fout_1`, `fs_drone` (867251), `fs_thunder_1` (200990), `fs_dark_pad` (32805).

Excerpts were cut to what a recipe reads: a layer pitched down by p semitones reads only length × 2^(p/12) of its source, which trimmed the bells, roars and groans and took the step's sources from 2,408,622 to 2,064,686 bytes. Candidates were auditioned by registering them in a scratch copy of `audio/` (`source add --root`), never by reading the downloads directly. Left out after auditioning: Freesound 171844 (a low hum under the scream) and 846337 (very quiet, with a steady tone under the hiss); the leather/cloth/metal footsteps (OGA-BY and CC0, noisy takes) in favour of Kenney's; `bfh1_falling_*` (bright debris, not bodies).

**Budgets.** `audio/sources` + `audio/voices` **12,846,981** of 15,000,000 (was 10,782,295), leaving about 2.15 MB for step 13. Banks: all `.opus` 1,592,732 and `.mp3` 1,393,784 of 3,000,000 each; `battle` 1,187,332 / 1,148,660 (was 1,067,996 / 1,020,884).

**Measurements** (`sfx audition --spectrogram`, every variant; per-variant tables in `audio/.audition/12-falls-steps/review.md`). None is peak-limited; every DC, length and correlation check passes in the build.

| Cue | Group | Var | LUFS-M max | True peak (dBTP) | Length (ms) |
| --- | --- | --- | --- | --- | --- |
| `death.human` | death −20 | 4 | −20.0 all | −5.4 to −5.2 | 896–1171 |
| `death.goblinoid` | death | 4 | −20.0 all | −9.8 to −7.9 | 748–774 |
| `death.brute` | death | 3 | −20.0 all | −9.1 to −4.8 | 1441–1496 |
| `death.spider` | death | 2 | −20.0 all | −9.1 to −5.1 | 894–914 |
| `death.salamander` | death | 2 | −20.0 all | −3.8 to −1.4 | 1128–1436 |
| `death.horror` | death | 1 | −20.0 | −9.0 | 2757 |
| `death.hero` | sweetener −24 | 2 | −24.0 all | −14.7 to −14.5 | 1864–1874 |
| `step.armored` | step −30 | 8 | −30.0 all | −12.3 to −10.4 | 151–177 |
| `step.light` | step | 8 | −30.9 to −30.0 | −12.0 to −10.1 | 139–166 |
| `step.heavy` | step | 6 | −30.0 all | −12.8 to −10.9 | 249–291 |
| `step.skitter` | step | 4 | −31.5 to −30.0 | −11.2 to −10.1 | 173–206 |

- **Steps within the cadence** (energy in the first 140 ms, and what is left after it): armoured 99–100% (tail −18 to −56 dB), light 100% (−38 dB or less), heavy 88–99% (−9 to −22 dB), skitter 81–100% (meant to chatter on).
- **Falls told apart** (raw power under 300 Hz; A-weighted 2–5 kHz share): human 76–91%, 14–51% (the kit's rattle); goblinoid 22–35%, 26–86% (yelp and squeal); brute 59–92%, 1–9%; spider 11–15%, 79–92% (clicks, no voiced harmonics); salamander 7–12%, 24–55% (hiss and splash); horror 42%, 26%, 2.76 s long; the toll 13%, 18%. No fall has more than 4% of its A-weighted energy above 8 kHz.
- Spectrograms were looked at for every variant: the human's breath, knees and the body at 330–450 ms with the kit's rattle over it; the goblin's yelp harmonics under the squeal's band at 1.5–4 kHz; the brute's groan darkening into the thud at 620–800 ms; the spider's broadband screech and the snaps after; the salamander's hiss closing down before the splash; the Horror's roar wall to 1.43 s, then the low rumble; the toll's partials (hum near 208 Hz, strike tone near G4) decaying over the drone.

**Iteration notes.** The first steps were peak-limited (−32 to −37): a `limit` at −14 (armoured), −16 (skitter) and −21 (light) brought them to target. A Kenney footfall's toe tap at 70–110 ms made the walk tick twice per hex: damped by an envelope. The heavy step's soft-heavy impact rang as a 90 Hz sine: envelope cut and 3–5 dB under the slap. The human's breath was as loud as the fall: 4 dB down. The brute's thud was weaker than its groan: the groan 3–4 dB down, the thud up 3–4. The Horror's reversed swell (1.4 s, pitched down) outlasted the fall: cut to 850 ms before reversing, the fall moved to 1.43 s, total 3.6 to 2.76 s. The toll ran past `max_ms` on its stone-hall tail: layers shortened to 1.3 s, trim at −42 dB. Lessons added to `audio/CLAUDE.md`.

**Review package** (gitignored): `audio/.audition/12-falls-steps/` with `battle.<cue>_<k>.wav` and `.png` for every variant (40), `run_armored.wav`, `run_light.wav`, `run_heavy.wav`, `run_skitter.wav` (8 plays 140 ms apart, the shuffle bag without an immediate repeat, ±100 cents, ±1.5 dB), `layered/` (`hero_fall_<h>_<k>.wav`: `death.human` k with `death.hero` h at 0 ms; `all_falls_in_order.wav`, variant 0 of each fall 0.6 s apart; −6 dB), `audition.txt`, and `review.md` (brief, where it plays, what it is, measurements, an empty verdict line per cue and per run and layered file, and how to hear it in game with the debug console).

**Unsure by ear** (for the playtest): the goblinoid squeal, a raccoon's, which may read as an animal rather than a goblin; the toll's string drone (detuned saws, the one synthetic tone; it sits under a real bell and a dark pad); whether the armoured step's mail jingle, heard on every hero's every hex, is too much; whether the Horror's roar "collapses" or merely stops at 1.43 s; whether the brute's groan (a zombie-pain take among them) is too human; the salamander's hiss against its splash (the splash peaks higher, the hiss is broadband and long).

**For step 13.** `death.hero` uses Freesound 824588's strikes pitched down about 4 semitones with a drone: `world.threatened` and `world.lost` should keep their toll distinct (higher, unpitched or 454855's bell, no drone). Free for step 13: 454855, 434339, 449843, 235453, 347126, 512490, 539956, 270589, 57280, 693428, and the placeholder sources `placeholder_unit_death` and `placeholder_ui_click`, still named by world recipes.

**Verification.**

- `uv run --project tools/audio yomi-audio sfx audition` (11 cues, `--spectrogram`): 40 variants, all "ok", none peak-limited (table above).
- `npm run sounds` (`sfx build`): the `battle` bank rebuilt (11 changed), every C6 check passing (death −20.0 all, peak ≤ −1.4; step −31.5 to −30.0, peak ≤ −10.1; sweetener ≤ −3.1); a second run "nothing changed (85 cues up to date)".
- `npm run sounds:check`: "85 cues and 4 banks up to date, within budget".
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test`: 87 files, 1682 tests passed.
- `uv run --project tools/audio pytest tools/audio/tests`: 246 passed.
- `grep -l placeholder_` over the 11 recipes: nothing.
- `npm run test:browser` not run: nothing outside `audio/`, `public/assets/audio/` and the docs changed.
- No paid calls.

**Deviations.** Root `CLAUDE.md`'s audio paragraph said the falls and steps were placeholders (the task says nothing there should change, but the file's own rule requires it to stay true): now says only the world cues are. `public/assets/audio/README.md` gained step 12's rows, reused collections repeated, its synthesis and Freesound paragraphs extended and the placeholder paragraph narrowed to step 13. Index row 11 now names its commit by hash (`953a9b8`), the orchestrator's bookkeeping fix. No tool, runtime, `CUES` or `audio.toml` change.

