# Step 13: Content: world

[Index](index.md) · [Design](../../designs/audio-pass.md) §4.1.5, §4.2, §5.2, §5.5–§5.7 · Feature record: [`docs/features/audio-pass.md`](../../features/audio-pass.md)

## Objective

Replace the placeholder-built recipes of the `world` bank with real content: the 14 W1 world cues built from committed CC0 and own sources and synthesis, the `world` bank rebuilt, the manifest updated, provenance recorded, and the batch handed to the user for a listening review (gate **G8**). This step is judgement-heavy: it is sound design, not wiring.

## Requirements and context

- R3 (the world map sounds its notable moments), R4 (encampment and interface success sounds: coins, craft, runecraft, a facility raised), R6 (several distinct variants per cue), R8 (built from recipes and committed sources with provenance and an allowed licence), R9 (every variant meets the group's loudness and peak), R15 (provenance documented).
- **Group `world`** (C3): measure `momentary_max`, target **−22 LUFS-M max**, tolerance **±1 LU**, true-peak ceiling **−2 dBTP**. A recipe may set `max_ms` to about 1.5 times the typical length below.
- **Cues** (C7; recipe file `audio/sfx/world/<name>.toml` for cue `world.<name>`; `world.rune.embed` is `audio/sfx/world/rune.embed.toml`). Variant counts are the design's; a change of count must be stated in the execution record (the runtime reads markers from the manifest).

| Cue | Var | ~ms | Played for | Sound brief (design §4.1.5) |
| --- | --- | --- | --- | --- |
| `world.confront` | 2 | 1500 | `confronting` | A tense stinger: a low drum hit and a dissonant low string or brass stab. |
| `world.sighted` | 2 | 1200 | `sighted` (not the Source) | A distant war horn or two drum hits, reverberant and low. |
| `world.source` | 1 | 3000 | `sighted` with `source` | An ominous swell: low drone, a dark choir-like pad, a rumble; plays as the Source cutscene begins. |
| `world.threatened` | 2 | 1500 | `site_threatened` | A single distant warning bell toll. |
| `world.captured` | 2 | 1500 | `site_captured` | A banner flap and a bright two-note horn or chime. |
| `world.lost` | 2 | 1800 | `site_lost`, `tower_lost` | A low toll and crumbling wood and stone. |
| `world.build` | 3 | 1200 | `tower_built`, `outpost_built` | Hammer knocks on wood, a creak, a final settle. |
| `world.arrive` | 3 | 500 | `arrived`, `met` | Boots stopping, a pack set down, a soft chime. |
| `world.upgrade` | 2 | 1500 | a facility built or raised | Hammering and a sawing stroke, ending in a rising chime. |
| `world.coins` | 4 | 500 | a buy or sell at the trading post | Coins counted onto wood, a pouch shake. |
| `world.craft` | 3 | 900 | a craft at the workshop or in the field | Two or three anvil strikes and a file scrape. |
| `world.rune.embed` | 3 | 700 | embed | A crystalline click and a short magic hum locking in. |
| `world.rune.fuse` | 2 | 1300 | fuse | A swelling hum resolving in a chime pop. |
| `world.rune.extract` | 2 | 700 | extract | A reversed shimmer and a pop. |

- **Out of scope:** the W2 world cues (`world.step`, `world.camp`, `world.yield`, `world.recruit`) are not built and get no recipe; when they play (design §4.2) is step 07's, not this step's; no runtime or scene change.
- **Coherence.** The world cues are heard one or two at a time over the world theme (design §4.2: at most two cues, 250 ms apart), so they should read clearly at −22 LUFS-M without being harsh; the stingers (`confront`, `sighted`, `source`, `threatened`, `lost`) should feel like one family (shared low drum, reverb `open_air` or `stone_hall`), and the encampment's (`coins`, `craft`, `upgrade`, `rune.*`) like close, dry handiwork (`small_room` or none). `world.source` is a single variant, exempt from the correlation check; `detuneCents` and jitter for it are 0 at runtime (C8), so it is heard exactly as built.
- Recipe format (C5, normative in design §5.6): TOML, top level `variants`, `seed`, `group = "world"`, optional `max_ms`; `[[layer]]` with `source` | `pick` | `synth`, `gain`, `offset`, `pitch`, `start`, `length`, `reverse`, `fade_in`, `fade_out`, `envelope`, `filter`, `saturate`, `chance`; `[post] chain` (`compress`, `saturate`, `reverb`, `delay`, `limit`, `trim`, `fade_out`), loudness normalisation to the group always last. Any numeric field may be `[lo, hi]` drawn per variant from `default_rng([seed, k])`. Synth kinds `sine|triangle|saw|square|noise|fm|crackle|impulse`; filters `highpass|lowpass|bandpass|peak|lowshelf|highshelf` (`hz_end` sweeps). Runtime hints (bus, jitter, limits) never go in recipes.

## Dependencies and prerequisites

- **Step 02 (done):** `yomi-audio sfx build`/`sfx check`, `npm run sounds` and `npm run sounds:check`, and placeholder recipes for all 14 cues in `audio/sfx/world/` (these are what this step rewrites). Step 01's `source add`, `impulse build` (impulses `small_room`, `stone_hall`, `open_air`) and `sfx audition` exist.
- **Step 04 (done):** the survey catalogue `docs/implementation-plans/audio-pass/sourcing.md` (per cue, candidate files from the downloaded packs) and the packs under `~/.cache/yomi-audio/downloads/<collection>/<pack>/`, notably Kenney *RPG Audio* (cloth, leather, metal clicks, coins, chops, creaks, book), *Casino Audio* (coins and chips), *Impact Sounds* (wood, metal, glass, stone impacts) and *Music Jingles* if a horn phrase is usable.
- **Gate G2 (answered):** the Freesound CC0 originals the user downloaded into `~/.cache/yomi-audio/freesound/` (bells, horns, banner flaps, drums, crumbling stone and the like, as `freesound-wanted.md` listed for the world cues). For each file used, verify on its Freesound page that its licence is "Creative Commons 0" before `source add`. Where the user skipped a file, the cue falls back to Kenney, OpenGameArt CC0 and synthesis (a bell from FM or additive partials, a horn from filtered saw with vibrato, a drum from a pitched sine thump and noise), and the execution record says which cues did.
- **Gate G3 (passed):** the melee review set the style; take its notes (in step 08's execution record and the feature record) into account.
- **Sequencing:** the `world` bank is separate from `battle`, but this step must not run at the same time as another content step: `audio/sfx.manifest.json` and the README are shared. If a merge touches a generated file, rerun `npm run sounds` rather than hand-merge.
- **Contracts used (copied from the index, unchanged):**
  - C2: `yomi-audio source add <file> --id ID --collection C --licence L --author A --url U [--original NAME] [--start S --end E] [--notes N]` (trims, sums to mono, resamples to 48 kHz, writes `audio/sources/<C>/<ID>.flac`, appends a C4 entry; refuses a licence outside `["CC0-1.0", "own"]`); `yomi-audio sfx audition <cue>… [--out DIR] [--spectrogram]`; `yomi-audio sfx build [--bank B] [--cue C]`; `yomi-audio sfx check`; every command takes `--root`. Run as `uv run --project tools/audio yomi-audio …`.
  - C4: each `[[source]]` entry has `id` (`[a-z0-9_]+`, unique), `file`, `licence`, `author`, `url` (the page the licence is stated on), `original`, optional `original_sha256` and `excerpt`, `sha256`, `retrieved`, `notes`.
  - C6: bank files `public/assets/audio/sfx/world.opus`, `world.mp3`, `world.json` (Phaser audio sprite, markers `<cue>#<k>`); `audio/sfx.manifest.json` per cue `{ bank, markers, durationsMs, inputs }`, per bank `{ durationMs, opus, mp3 }`. Build checks: loudness within tolerance, true peak under ceiling, length within `max_ms`, DC offset ≤ 0.5%, no two variants of a cue with peak normalised cross-correlation above 0.95, sources allowed and hashes matching. `sfx check` fails on stale hashes, missing or altered bank files, or a budget (C3) exceeded: shipped SFX 3 MB per format (all banks), committed `audio/sources` + `audio/voices` 15 MB together.

## Scope and implementation guidance

Affected paths (all existing after step 02, except new source FLACs): `audio/sfx/world/*.toml` (14 recipes rewritten), `audio/sources.toml` and `audio/sources/<collection>/*.flac` (new excerpts), `public/assets/audio/sfx/world.*`, `audio/sfx.manifest.json`, `public/assets/audio/README.md`, and `audio/CLAUDE.md` only if a workflow lesson is worth keeping.

1. Read `sourcing.md` and the G2 outcome; listen-by-measure: for each candidate original, inspect length, loudness and a spectrogram (the audition tool or a scratch script outside the repo; Python reading downloads runs with `-I` or through the tool, as downloads are untrusted data).
2. Add only the trimmed parts actually used with `source add` (collections e.g. `kenney_rpg`, `kenney_casino`, `kenney_impact`, `freesound`, `oga`), each with its page URL, author and original name. Keep the committed-sources budget in mind (report the bytes this step added).
3. Write each recipe as layered design per the brief: e.g. `coins` from `pick` over several Kenney coin hits at offsets with pitch ranges plus a pouch rustle; `craft` from two or three metal impacts at varied offsets plus a filtered noise file scrape; `build` from wood knocks and a creak; `rune.*` from a glass/crystal click plus FM or sine hums (`rune.extract` with `reverse = true` on the shimmer); `source` mostly synthesis (sub drone, detuned saw pad through lowpass for the choir-like body, brown-noise rumble) with long `open_air` or `stone_hall` reverb. Give each cue enough per-variant variation (`pick`, pitch, offsets, `chance`) to stay under the 0.95 correlation limit while sounding like the same event.
4. Self-check before building: `uv run --project tools/audio yomi-audio sfx audition world.<name>… --out audio/.audition/13-world/ --spectrogram`; look at every spectrogram (no harsh resonances above ~6 kHz at the stingers' level, no clicks at cuts, tails not chopped) and the printed loudness, peak and length.
5. `npm run sounds` (or `sfx build --bank world`), then `npm run sounds:check`.
6. Update `public/assets/audio/README.md`: the `world` bank's sources by collection and author (Kenney, Freesound authors and sound ids, OpenGameArt authors), each CC0 or own, and which cues are pure synthesis.
7. Prepare the review: `audio/.audition/13-world/` (gitignored) holds every variant as WAV and a `review.md` listing, per cue, its brief, its variant files and its measured loudness, plus how to hear the cues in game: `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run dev`, open http://localhost:5173, then (once step 07's hooks exist) walk onto a nest (`world.confront`), explore until monsters are sighted, build a watchtower, enter the encampment and raise a facility, buy and sell at the trading post (`world.coins`), and craft, embed, fuse and extract at the crafting screen; the debug console (`~`) helps (`give`, `facility`, `goto`, `days`). If step 07 is not yet done, say the cues can only be heard from the audition files.

Invariants: no recipe names a placeholder source once done; no file under `src/` or any scene changes; no runtime hint in a recipe; the cue set stays the 14 of C7 for this bank.

## Verification

- `uv run --project tools/audio yomi-audio sfx build --bank world` succeeds (every build check of C6 passes for every variant: loudness −22 ±1 LUFS-M max, true peak ≤ −2 dBTP, lengths, DC, correlation ≤ 0.95).
- `npm run sounds:check` passes on a clean tree.
- `grep` of `audio/sfx/world/*.toml` finds no placeholder source id.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes (the manifest marker tests and size budgets).
- No scene changed: `npm run test:browser` is not required; running `npm run test:browser -- -t <the boot/audio test>` is welcome as a check that the bank still loads.
- Report the bytes of `world.opus` and `world.mp3`, the total SFX bytes per format against 3 MB, and the committed sources' total against 15 MB.

## Completion criteria

- [ ] 14 recipes rewritten from real content; sources added with C4 entries and allowed licences; Freesound use verified CC0 and skipped files recorded.
- [ ] World bank and manifest rebuilt; `npm run sounds:check` and `npm test` pass; budgets reported.
- [ ] `public/assets/audio/README.md` lists the world bank's provenance.
- [ ] `audio/.audition/13-world/` and its `review.md` prepared; index status set to `awaiting review`; commit `Audio pass step 13: content, world`.
- [ ] **Gate G8:** the user's per-cue verdict (OK or a note) recorded below; fixes made as follow-up commits and re-reviewed where asked; index status `done` with the commit hashes.

## Execution record
