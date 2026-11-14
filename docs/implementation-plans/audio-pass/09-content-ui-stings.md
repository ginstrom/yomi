# Step 09: Content: interface and stings

[Index](index.md) · [Design](../../designs/audio-pass.md) §4.1.6, §4.1.7, §5.2, §5.5, §5.6, §7.2 · [Feature record](../../features/audio-pass.md)

## Objective

Replace the placeholder recipes of the `ui` bank (7 cues) and the `stings` bank (3 cues) with real content built from committed CC0 or own sources and synthesis, so that every click, tab, refusal and gear change in the game and the victory, defeat and level-up stings sound finished. The step ends at user gate **G4** (listening review).

## Requirements and context

- R4 (encampment and interface sounds), R5 (stings replace the placeholder stings), R6 (several distinct variants per cue), R8 (built by `tools/audio/` from text recipes and committed sources with provenance and an allow-listed licence; `sounds:check` passes), R9 (every variant meets its group's loudness target and true-peak ceiling), R15 (provenance documented).
- **Runtime is not touched.** Which moment plays which cue is steps 05 to 07's work (index C8, C9). This step changes only what the cues sound like. The cue ids are fixed by index C7; do not add or remove cues.
- Engineers cannot hear. Measure everything measurable, look at spectrograms, and leave the judgement by ear to the user at G4.

### The cues (design §4.1.6, §4.1.7; index C7)

Bank `ui`, group `ui` (−26 LUFS-M max, ±1 LU, true peak ≤ −6 dBTP); bus `ui` at runtime (under the Sound FX slider):

| Cue | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- |
| `ui.click` | 4 | 60 | a button or list line pressed, portrait clicks, slider release, story Next | A short dry tick: wood or leather, 1.5 to 3 kHz body, tiny low thump, no tail; tactile, not electronic. |
| `ui.confirm` | 3 | 250 | Begin, Form party, Rename kept, Recruit (committing actions with no sound of their own) | A click and a soft rising wooden-mallet note. |
| `ui.back` | 3 | 120 | Close, Back, Leave, Esc closing a panel | A softer, lower click with a slight downward pitch. |
| `ui.tab` | 4 | 150 | a tab switch (character panel, trading post, crafting, tree tabs) | A parchment flick. |
| `ui.error` | 3 | 200 | any action the game refuses | Two dull muted wood knocks, low; not a buzzer. |
| `ui.learn` | 2 | 700 | a skill-tree node taken | A parchment stamp and a soft rising bell chime. |
| `ui.gear` | 6 | 300 | equip, stow, drop, pick up (battle and world map) | A leather and metal rustle: buckle clink, cloth. |

Bank `stings`, group `sting` (−18 LUFS-I integrated, ±1 LU, true peak ≤ −1 dBTP); bus `music` at runtime (under the Music slider), no jitter:

| Cue | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- |
| `stings.victory` | 1 | 3000 | `battle_end` won | A short triumphant brass-and-drum flourish, resolving major. |
| `stings.defeat` | 1 | 3500 | `battle_end` lost; the encampment lost | A slow falling minor phrase, low strings and a final low drum. |
| `stings.level_up` | 1 | 1800 | the victory screen when any member gained a level (150 ms after the victory sting ends) | A bright ascending arpeggio (harp or bells) with a shimmer. |

Lengths are typical; a recipe's `max_ms` may be up to about 1.5 times the length. `ui.click` is heard more than any other sound in the game: it must be quiet, short and never fatiguing; `ui.back` must be distinguishable from `ui.click` (lower, softer), and `ui.error` must not read as a click. `stings.level_up` follows `stings.victory` closely, so it should sit in a compatible key and register (check the jingle's key by spectrum where possible and note it in review.md). A one-variant cue is exempt from the correlation check.

### Sources (design §5.2; feature record)

In order of preference, all verified CC0 at sourcing:

1. Step 04's catalogue (`docs/implementation-plans/audio-pass/sourcing.md`, or wherever step 04's execution record says it wrote the per-cue catalogue), which maps each cue to candidate files in the downloaded packs under `~/.cache/yomi-audio/downloads/kenney/<pack>/`.
2. Kenney packs (kenney.nl, CC0, `License.txt` in each zip): *UI Audio* and *Interface Sounds* (clicks, switches), *RPG Audio* (cloth, leather, metal clicks, book and page sounds, creaks: `ui.tab`, `ui.gear`, `ui.learn`'s stamp), *Music Jingles* (the stings' base, as the feature record decides "Stings from Kenney Music Jingles for now"). A pack missing from the cache is downloaded into its own new, empty directory `~/.cache/yomi-audio/downloads/kenney/<pack>/`.
3. Synthesis (licence `own`): design §5.6 Example 3 is the starting recipe for `ui.click`; synthesised bell or mallet tones for `ui.confirm` and `ui.learn`, knocks for `ui.error`, a shimmer layer for `stings.level_up`.

This step does not depend on Freesound (gate G2). The user may later supply stings recorded with the themes; those would then replace these recipes as plain sources (licence `own`) — not part of this step.

## Dependencies and prerequisites

- **Steps 01 and 02** (existing by the time this step runs): the tool `yomi-audio` (index C2) with `source add`, `impulse build`, `sfx audition`, `sfx build`, `sfx check`; `audio/audio.toml` (C3); `audio/sources.toml` (C4); the placeholder recipes at `audio/sfx/ui/*.toml` and `audio/sfx/stings/*.toml` that this step rewrites; `npm run sounds` and `npm run sounds:check`.
- **Step 04**: the packs downloaded and the per-cue catalogue.
- **Step 08 and gate G3** (melee review): this step starts only after G3 is recorded, because the melee review sets the style and the processing conventions (reverb amounts, saturation, how dry) the user accepted. Read step 08's task file execution record and the G3 outcome in the feature record before starting, and follow any conventions they set.
- Not needed: step 05 to 07 (runtime) for building; if they are done, the user can also hear the sounds in the game at G4.

## Contracts (copied from the index; do not change)

- **C2 commands:** `yomi-audio source add <file> --id ID --collection C --licence L --author A --url U [--original NAME] [--start S --end E] [--notes N]`; `yomi-audio sfx audition <cue>… [--out DIR] [--spectrogram]`; `yomi-audio sfx build [--bank B] [--cue C]`; `yomi-audio sfx check`. npm: `npm run sounds` (`uv run --project tools/audio yomi-audio sfx build`), `npm run sounds:check`.
- **C4 source entry:** `id` (`[a-z0-9_]+`, unique), `file` (`sources/<collection>/<id>.flac`), `licence` in `["CC0-1.0", "own"]`, `author`, `url` (the page the licence is stated on), `original`, optional `original_sha256`, optional `excerpt = { start, end }`, `sha256`, `retrieved`, `notes`.
- **C5 recipes:** one TOML per cue at `audio/sfx/<bank>/<name>.toml` (`audio/sfx/ui/click.toml`, `audio/sfx/stings/level_up.toml`); top level `variants`, `seed`, `group`, optional `max_ms`; `[[layer]]` with `source` | `pick` | `synth` and `gain`, `offset`, `pitch`, `start`, `length`, `reverse`, `fade_in`, `fade_out`, `envelope`, `filter`, `saturate`, `chance`; `[post] chain` of `compress`, `saturate`, `reverb`, `delay`, `limit`, `trim`, `fade_out`; loudness normalisation to the group last. Numeric `[lo, hi]` ranges per variant. Runtime hints (bus, jitter, limits) never in recipes.
- **C6 build checks** (each fails the build): loudness within tolerance; true peak under the ceiling; length within `max_ms`; DC offset ≤ 0.5%; no two variants of a cue above 0.95 peak normalised cross-correlation; every source allowed and hash-matching. `sfx check` fails on stale hashes, missing outputs or budgets (shipped SFX ≤ 3 MB per format; `audio/sources` + `audio/voices` ≤ 15 MB).
- **C7:** the ten cue ids and variant counts above. A content step may change a variant count (the runtime reads markers from the manifest) and must say so in its execution record.

## Scope and implementation guidance

Paths touched (and only these): `audio/sfx/ui/*.toml`, `audio/sfx/stings/*.toml`, new `audio/sources/<collection>/*.flac` and their `audio/sources.toml` entries, `audio/sfx.manifest.json`, `public/assets/audio/sfx/ui.*` and `stings.*`, `public/assets/audio/README.md`, and `audio/CLAUDE.md` only if a convention is worth recording there. No change under `src/`, `scripts/`, `e2e/` or any scene.

1. **Pick sources** per cue from the catalogue; listen-free selection means using filenames, pack descriptions, durations and spectrograms (`sfx audition --spectrogram` on a trial recipe, or a scratch script run outside the download folders). Prefer several distinct sources per cue (`pick`) over one source pitched several ways, so variants are genuinely different.
2. **Add sources** with `yomi-audio source add`, trimmed to the part used (keep excerpts short: UI sources are fractions of a second; a jingle is kept whole only as long as needed). Collections: `kenney_ui`, `kenney_interface`, `kenney_rpg`, `kenney_jingles` (or the names step 04/08 established). Record `url`, `original` (path inside the pack), `retrieved`.
3. **Write the recipes**, replacing the placeholders. Guidance per cue:
   - `ui.click`: start from design §5.6 Example 3 (impulse through a resonant band plus a tiny low sine thump), optionally blended with a short Kenney click; keep it under ~90 ms, dry, no reverb.
   - `ui.back`: the click family pitched lower and softer, a slight downward sweep (`hz_end` below `hz`).
   - `ui.confirm`: a click then a soft rising mallet/marimba-like tone (synth `fm` or `sine` with a short envelope, or a Kenney UI tone), consonant.
   - `ui.tab`: a parchment or page flick (Kenney RPG book/page sounds), high-passed, very short.
   - `ui.error`: two low, muted wooden knocks ~80 ms apart; low-passed; never a tone or buzzer.
   - `ui.learn`: a stamp (book close / thud from RPG Audio) and a soft rising bell chime (synthesised partials or a Kenney chime), ~700 ms.
   - `ui.gear`: leather and cloth rustle with a buckle or small metal clink (RPG Audio cloth, leather, metal clicks); six variants from different combinations (`pick`, `chance`).
   - `stings.victory`, `stings.defeat`: from Music Jingles, the jingle closest to each brief (major, triumphant brass/drum; slow, minor, falling), trimmed and faded; light processing only (gentle compression, trim, fade). Group `sting` is integrated loudness.
   - `stings.level_up`: an ascending arpeggio jingle from the pack if one fits, else a synthesised bell/harp arpeggio, with a shimmer layer; keep it shorter than the victory sting.
4. **Self-check** before building: `yomi-audio sfx audition <cue>… --out audio/.audition/09-ui-stings/ --spectrogram`; look at every spectrogram (the agent can read images): no clipping, no DC, no long silent tails, transients where the brief wants them, bands where the brief says (e.g. the click's 1.5 to 3 kHz body), variants visibly different; check printed loudness and peak against the group. Iterate until all pass.
5. **Build and check:** `npm run sounds` (only the `ui` and `stings` banks should change), then `npm run sounds:check`; confirm the budgets still hold and record the bank sizes.
6. **Review sheet:** write `audio/.audition/09-ui-stings/review.md` (gitignored): for each cue its brief, the variant WAV files, each variant's loudness, peak and length, the sources used, and a blank "OK / note" line for the user; plus how to hear them in game if steps 05 to 07 are done (`npm run dev`, click around the menu, character panel and trading post; win and lose a battle with the debug console's `fight` to hear the stings).
7. **Provenance:** update `public/assets/audio/README.md` with the `ui` and `stings` banks' sources by collection and author (Kenney, CC0; own synthesis), as design AC15 requires.
8. Stop at **gate G4**: set the step `awaiting review` in the index, report the review folder, and wait. Fixes from the user's notes are follow-up commits of this step (rebuild, re-audition the changed cues into the same folder, update review.md).

Exclusions: no change to cue ids, buses, jitter, limits or call sites; no W2 cue (`ui.hover`); no Freesound source; no Sonniss or any non-CC0 material.

## Verification

- `uv run --project tools/audio pytest tools/audio/tests` passes (no tool change expected; run it anyway).
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run sounds` succeeds with every per-variant check passing; `npm run sounds:check` passes on a clean tree.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes (the manifest's markers exist in the bank JSON; budgets).
- No recipe under `audio/sfx/ui/` or `audio/sfx/stings/` names a placeholder source (`grep` the recipes for the placeholder source ids from step 02).
- `git diff --stat` shows only the paths listed in Scope.
- No scene changed, so `npm run test:browser` is not required; if steps 05 to 07 are done, running it once confirms the banks still load.

## Completion criteria

- [x] Ten recipes rewritten from real sources and/or synthesis; sources added with C4 entries and allowed licences.
- [x] `npm run sounds`, `npm run sounds:check`, `npm test` and the tool's pytest pass; measurements recorded.
- [x] `audio/.audition/09-ui-stings/` holds every variant as WAV and a filled-in `review.md`.
- [x] `public/assets/audio/README.md` lists the new sources.
- [x] Committed as `Audio pass step 09: interface and stings` on `audio-pass` (not pushed); index status `awaiting review` with the hash.
- [ ] Gate G4 passed (the user's per-cue verdicts recorded below and in the feature record by the orchestrator); review fixes committed; index status `done` with all hashes.

## Execution record


### Round 0: build (2026-11-14)

**Outcome.** The seven `ui` recipes and the three `stings` recipes are rewritten from CC0 recordings and synthesis; none names a `placeholder_*` source (`grep -l placeholder_ audio/sfx/ui/*.toml audio/sfx/stings/*.toml` prints nothing). Variant counts are unchanged from C7. Gate G4 no longer blocks (feature record): the batch was judged on its measurements and spectrograms, and the audition folder is left for the user's later playtest. Also in this step's commit: step 08's G3 outcome recorded in its execution record and its index row set `done`.

**Sources.** 29 excerpts added with `yomi-audio source add` (all `CC0-1.0`, original path and both hashes recorded; first written as 31, corrected in round 1, which also removed `rd_paper_02`, never drawn): `kenney_ui` (`click1`, `click4`, `click5`), `kenney_interface` (`tick_001`, `tick_002`, `back_002`, `back_004`), `kenney_rpg` (`bookFlip2`, `bookFlip3`, `bookClose`, `bookPlace1`, `beltHandle1`, `metalLatch`, `clothBelt` 0–0.45 s, `handleSmallLeather`), `kenney_impact` (`impactWood_medium_000`, `_002`, `_004`), `kenney_jingles` (`SAX10`, `SAX07`, `PIZZI10`), `oga_rubberduck` (100 CC0 SFX `paper_01`, `_02`, `_04`, 0–0.4 s), `oga_vehicle` (`belt-buckle-01`, `-04`, `quiver-leather-squeeze-05`), `oga_artisticdude` (`inventory/metal-small2`, `inventory/cloth`); step 08's `kenney_cloth_1`/`_2` reused. Bytes: the batch adds **833,817** to `audio/sources` (now 3,214,361 with no `audio/voices` yet, of 15,000,000). Shipped banks after the build: `ui` 85,862 `.opus` / 62,444 `.mp3`, `stings` 96,343 / 64,916; all banks 1,128,451 `.opus` and 833,312 `.mp3`, each under 3,000,000.

**Measurements** (`sfx audition --spectrogram`; per variant in `audio/.audition/09-ui-stings/review.md`; A50 = loudest 50 ms, A-weighted, from a scratch script outside the repository):

| Cue | Var | Level | True peak (dBTP) | Length (ms) | A50 (dB) |
| --- | --- | --- | --- | --- | --- |
| `ui.click` | 4 | −31.7 to −30.5 LUFS-M, peak-limited | −6.0 | 45 | −24.2 to −22.7 |
| `ui.back` | 3 | −32.5 to −31.8, peak-limited | −6.1 to −6.0 | 98–100 | −24.3 to −23.0 |
| `ui.confirm` | 3 | −26.0 | −13.8 to −13.3 | 325–352 | −22.0 to −21.8 |
| `ui.tab` | 4 | −28.1 (lim) to −26.0 | −8.9 to −6.1 | 126–136 | −24.0 to −21.3 |
| `ui.error` | 3 | −26.0 | −7.6 to −6.5 | 219–234 | −27.9 to −27.5 |
| `ui.learn` | 2 | −26.0 | −9.8 to −9.3 | 819–824 | −25.3 to −25.2 |
| `ui.gear` | 6 | −28.5 (lim, #3) to −26.0 | −12.4 to −6.1 | 249–302 | −24.2 to −22.6 |
| `stings.victory` | 1 | −18.0 LUFS-I | −2.9 | 3406 | −16.9 |
| `stings.defeat` | 1 | −18.0 LUFS-I | −3.4 | 3986 | −18.4 |
| `stings.level_up` | 1 | −18.0 LUFS-I | −8.7 | 2330 | −14.9 |

The build reports `ui.click`, `ui.back`, `ui.tab#0` and `ui.gear#3` peak-limited; that is the short-cue rule (feature record) and suits the click, heard most. Every per-variant check passed (loudness, peak, length, DC, correlation, sources).

**Judging without ears.** Click: 79–94% of its A-weighted energy in 1–4 kHz (two variants centred in 1–2 kHz, two in 2–4 kHz), nothing under 500 Hz but the quiet thump; back: 57–88% in 0.5–2 kHz, lower than the click and at about the same or 1 dB softer A50 though twice as long; error: 250–500 Hz with the second knock visible at ~80 ms, no tone; tab: 75–90% above 2 kHz; confirm and learn show their two notes a fifth apart (C5–G5, G5–D6). Keys by pitch tracking: the victory sting's pickup is D E F# G landing on the G major chord (chroma G, D, B), level-up is in G (chroma G, D, B) and follows it, the defeat is F E D# D over D minor (chroma D, A, F).

**Iteration notes.** The design's impulse-through-a-band click (fixed in `test_build.py`) gave all spike and no body: −35 to −29 LUFS-M across variants and its energy at 150 Hz, the thump's; its body is now two decaying sines. `ui.back` was 3 dB louder than the click by A50 until its compressor came out and its decay shortened. `ui.error`'s first draft was 53–75% under 250 Hz (inaudible on small speakers); its knocks were raised and band-limited to 160 Hz–1.7 kHz. Tab and gear varied by 5–6 dB between picked sources until a `limit` at −20 dB. FM notes ended with an audible cut where the envelope stopped at −40 dB; they now fade. The defeat's string and bass layers came down 3–4 dB to keep the sub under the phrase. Lessons are in `audio/CLAUDE.md` ("Sound design without ears").

**Audition folder for the user's playtest** (gitignored): `audio/.audition/09-ui-stings/` with `<cue>/<k>.wav` and `.png` for every variant, `sequence/victory_then_level_up.wav` (victory, 150 ms, level-up, as the game plays them), and `review.md` (brief, sources, per-variant measurements, a verdict line per cue, how to hear them in game).

**Verification.**

- `uv run --project tools/audio pytest tools/audio/tests`: 203 passed.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run sounds`: wrote the `ui` and `stings` banks only; every check passed.
- `npm run sounds:check`: "85 cues and 4 banks up to date, within budget".
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test`: 85 files, 1623 tests passed.
- `git diff --stat`: only the step's paths (recipes, sources and their entries, manifest, `ui`/`stings` bank files, the audio README, `audio/CLAUDE.md`) and the plan docs.
- `npm run test:browser` not run: no scene changed.
- No paid calls; no Freesound material.

**Deviations.** `sfx audition` names its files `<cue>.v<k>.wav`; renamed to `<cue>/<k>.wav` as in step 08. No tool, runtime, `CUES` or `audio.toml` change. The stings are longer than their briefs' typical lengths (victory 3.4 s against ~3, defeat 4.0 against ~3.5, level-up 2.3 against ~1.8) because of their reverb tails, within each `max_ms`; level-up stays shorter than victory. The placeholder sources the old `ui` and `stings` recipes used stay: other banks' placeholder recipes (steps, world) still use them, and step 18 decides their removal.

**For later steps.** The click family (sine modes) and the bell/mallet FM notes can serve `world.upgrade`'s chime and `world.rune.*` (step 13). The stings' keys: G major (victory, level-up), D minor (defeat).

Commit: `f135fc0` ("Audio pass step 09: interface and stings"). G4 no longer blocks (feature record), so the step is `done`; the last criterion's user verdicts, if any, come back from playtesting as follow-up fixes.

### Round 1: review fixes (2026-11-14)

| # | Finding | Outcome |
| --- | --- | --- |
| 1 (blocking) | `rd_paper_02` committed and credited but never drawn: `ui.tab` listed five sources for four variants | Fixed. Added `yomi-audio source remove <id>` (`sources.remove_source`, CLI in `cli.py`): deletes the file and its entry, drops an emptied collection folder, and refuses an unknown id or one any recipe still names (`source` or `pick`), changing nothing; five tests in `test_sources.py` (red first: import error), whose `entries` helper now reads a `sources.toml` left with no entries. `ui.tab`'s pick is now the four drawn sources (one each: `bookFlip2`, `paper_01`, `paper_04`, `bookFlip3`) and `rd_paper_02` was removed with the new command. Every new source of the step was checked drawn by resolving every `ui` variant with the tool's own `resolve`. |
| 2 | The record said 31 new excerpts; the diff adds 29 | Fixed in round 0's text; after round 1, 28 (796,094 bytes; `audio/sources` 3,176,638 of 15,000,000). |
| 3 | `ui.error`'s second knock picked from the same three sources, so a variant could knock one source twice | Fixed: knock two now picks from other wood (`kenney_wood_heavy_3`, `_4`, `rd_wood_hit_3`, step 08's), pitched 0 to −2, so every variant pairs two different sources (#0 medium_2 + wood_hit_3, #1 medium_0 + heavy_4, #2 medium_4 + heavy_3). Re-auditioned: −26.3 to −26.0 LUFS-M, −6.7 to −6.0 dBTP, 198–211 ms, A50 −27.4 to −26.8, energy still 250–500 Hz. |
| 4 | `ui.back` lower but not clearly softer than `ui.click` | Left as is, as asked; `review.md` now asks the user to listen for it, with the runtime gain as the fix if needed. |
| 5 | "Pairs of detuned saws" claimed for every voice; `oga_vehicle` originals lacked `weapons-apparel/` | Fixed: the victory, defeat and `audio/CLAUDE.md` wording now says which voices are doubled; the three `vh_*` entries' `original` rewritten with the tool's own `upsert_entry` (the hash and every other field unchanged). |

Re-auditioned `ui.tab` (−28.1 lim to −26.0 LUFS-M, −8.7 to −6.1 dBTP, 126–136 ms) and `ui.error` into `audio/.audition/09-ui-stings/`, and updated `review.md`. `audio/CLAUDE.md`'s command table gains `source remove`; so does the index's C2 table.

Verification: `uv run --project tools/audio pytest tools/audio/tests` (208 passed), `npm run sounds` (rebuilt `ui`, and `stings` for its comments, rendering the same audio; `ui` now 84,849 `.opus` / 62,324 `.mp3`; all banks 1,127,438 / 833,192), `npm run sounds:check` ("85 cues and 4 banks up to date, within budget"), `npm test` (85 files, 1623 tests passed).

### Round 2: review fixes (2026-11-14)

| # | Finding | Outcome |
| --- | --- | --- |
| 1 (blocking) | `source remove` looked only at layers' `source` and `pick`, so `source remove impulse_small_room` deleted the impulse that `[post]` reverb steps use | Fixed. `_recipes_naming` now loads each recipe and asks `Recipe.source_ids()`, which lists reverb impulses (`impulse_<name>`) beside sources and picks; and every `impulse_` id is refused outright, as `impulse build` owns them (`IMPULSE_PREFIX` now lives in `sources.py` and `recipe.py` imports it). Two tests, red first: removing a used impulse is refused naming the recipe, and an impulse no recipe uses is refused as an impulse; both leave the FLAC and its entry. Live: `source remove impulse_small_room` refuses, naming `battle.hit.*` and `ui.confirm`, `ui.learn`. |

Verification: `uv run --project tools/audio pytest tools/audio/tests` 210 passed; `npm run sounds:check` "85 cues and 4 banks up to date, within budget" (no recipe, source or bank changed).
