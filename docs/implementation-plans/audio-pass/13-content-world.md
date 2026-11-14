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

- [x] 14 recipes rewritten from real content; sources added with C4 entries and allowed licences; Freesound use verified CC0 and skipped files recorded.
- [x] World bank and manifest rebuilt; `npm run sounds:check` and `npm test` pass; budgets reported.
- [x] `public/assets/audio/README.md` lists the world bank's provenance.
- [x] `audio/.audition/13-world/` and its `review.md` prepared; commit `Audio pass step 13: content, world`. (Index status set to `done`, not `awaiting review`: G8 is non-blocking by the orchestrator's brief.)
- [ ] **Gate G8:** deferred to the user's playtest (the orchestrator's brief); the review sheet's verdict lines are empty until then, and fixes from it will be follow-up commits.

## Execution record

### Round 0: build (2026-11-14)

**Outcome.** The 14 world recipes are rewritten from CC0 recordings and synthesis; no recipe of any bank names a `placeholder_*` source (`grep -rl placeholder_ audio/sfx/` prints nothing; the last two, `placeholder_unit_death` and `placeholder_ui_click`, were named only by world recipes). Variant counts and `max_ms` are C7's and step 02's, unchanged. Gate G8 is non-blocking (the orchestrator's brief): the audition folder and review sheet are left for the user's playtest, and the step is set `done` with G8 deferred.

**Direction.** Organic fantasy, not retro or sci-fi, and informing without nagging between turns. The stingers are one family: a war drum and a taiko (Freesound 235453, 347126) under `confront`, `sighted` and `lost`, the tolling bell 454855 in `threatened` and `lost`, the drone 867251 in `confront` and `source`, reverb `stone_hall` (confront, source) or `open_air` (the rest). `confront`'s dissonant brass stab is the distant war horn (512490) pitched to D and E-flat at once over a quiet saw cluster on the same notes; `sighted` is that horn on A, far off, answering two damped drum hits; `source` is mostly recordings (the drone twice, the dark pad, hummed voices an octave down as the choir, thunder pitched down 10 semitones as the rumble) with a synthesized sub swell and brown-noise air. `threatened` is one strike of SamuelGremaud's bell (a bell in D: hum near 294 Hz, strongest partial near F5), unpitched, no drone, open air: about 6 semitones above the hero's toll (824588 pitched down 4 over a string drone in a stone hall, step 12) and another bell. `lost` is that bell 2.6–3.2 semitones down, alone for 280 ms, then timber, stone and rubble with the drum as the thud. `captured` is a banner snapping (57280) and the war horn 539956's own two-note call (D-sharp 4 rising a fourth to G-sharp 4), brightened, with a soft G-sharp bell. The encampment's handiwork is close and dry (`small_room`, wet −14 to −20): coins counted onto a counter with a pouch; two or three anvil strikes (434339, 270589) and a file stroke (449843); hammer knocks on timber, a creak and a settle (`build`, outdoors); hammering, a saw stroke and a rising G5–B5–D6 chime (`upgrade`); steps stopping, a pack set down and a soft C6 bell (`arrive`); and the runes: a gem click and a short hum locking in with a ping, a hummed swell resolving in a gem pop and an A5–E6 chime, and a reversed bell and glass rising into a pluck pop.

**Sources.** 28 excerpts added with `yomi-audio source add`, every one `CC0-1.0` with author, licence-page `url`, original, excerpt and both hashes:

- `freesound` (13): fs_war_drum (235453, jcdecha), fs_taiko (347126, NovaSoundTechnology), fs_distant_horn (512490, DeVern), fs_war_horn_1 and _2 (539956, adharca; the call's two notes), fs_bell_toll_1 and _2 (454855, SamuelGremaud; two strikes), fs_flap (57280, _earthbound_), fs_anvil_1, _2, _3 (434339, draftcraft; three strikes), fs_anvil_hit (270589, michorvath), fs_file (449843, NearTheAtmoshphere; one stroke). Each author and the licence "Creative Commons 0" were read on the sound's own page (fetched with `curl` and a browser user agent; every title names the author as recorded).
- `kenney_rpg` (2): kenney_coins, kenney_coins_2 (`Audio/handleCoins.ogg`, `Audio/handleCoins2.ogg`; `sourcing.md` names files loosely: the RPG Audio creaks it calls `creak_001..003` are `Audio/creak1.ogg`..`creak3.ogg` on disk, and its `k-iface` `glass_001..006` are `Audio/glass_00N.ogg`).
- `oga_rubberduck` (10): rd_coins_2, _3, rd_gem_1, _3 (80 CC0 RPG SFX `item_coins_0N.ogg`, `item_gem_0N.ogg`), rd_wood_hammer_1, _2, rd_wood_slam_4 (100 CC0 metal and wood sfx), rd_rock_break_1, _2, rd_wood_break_3 (75 CC0 breaking/falling/hit sfx).
- `oga_vehicle` (3): vh_pouch_1, _2 (`tinysized/sfx-cc0/cloth-pouch-shake-0N.wav`), vh_handsaw (`handsaw-sawing-wood-01.wav`, one stroke).
- Reused: `fs_drone` (867251), `fs_dark_pad` (32805), `fs_hum` (685680), `fs_thunder_1` (200990), `kenney_creak_1`, `_2`, `kenney_wood_heavy_3`, `_4`, `kenney_wood_medium_0`, `_2`, `_4`, `kenney_footstep_0`–`_9`, `kenney_drop_leather`, `kenney_small_leather`, `kenney_punch_heavy_0`–`_4`, `kenney_glass_light_0`–`_4`, `kenney_metal_click`, `kenney_pluck_1`, `_2`, `pwl_bell_ding_1`, `_3`, `rd_wood_crack_1`, `_3`, `rd_rock_fall_1`, `_3`.

Every added source is named by a recipe. Of the 28 Freesound originals, 23 are now used: 171844 and 846337 (left out by step 12 on quality), and 693428, 411122 and 259542 (meant for the victory sting and the melee hits, which earlier steps made from other material) are not. Candidates were auditioned by registering them in a scratch root outside the repository (`source add --root`), never by reading the downloads directly. Left out after auditioning: Kenney's casino chips (all treble, no "onto wood"), the metal hammers of rubberduck's pack (high and thin; the wood hammers knock on timber), Kenney's `impactBell_heavy` (thin beside 454855), `theircoming3` (a horn at D2 with little above it), rubberduck's cannons (the Freesound drums are cleaner) and 449843's other strokes (one stroke reads as a file).

**Budgets.** `audio/sources` + `audio/voices` **14,453,971** of 15,000,000 (was 12,846,981; this step added 1,606,990), leaving about 546 KB. Banks: all `.opus` **1,774,232** and `.mp3` **1,583,600** of 3,000,000 each; `world.opus` 405,708 and `world.mp3` 307,700 (were 224,208 / 117,884).

**Measurements** (`sfx audition --spectrogram`, every variant; per-variant tables in `audio/.audition/13-world/review.md`). Every variant is −22.0 LUFS-M max; none is peak-limited; every DC, length and correlation check passes in the build. Band shares are of power (raw under 300 Hz; A-weighted 300 Hz–2 kHz and 2–5 kHz).

| Cue | Var | True peak (dBTP) | Length (ms) | Raw <300 | A 300–2k | A 2–5k |
| --- | --- | --- | --- | --- | --- | --- |
| `confront` | 2 | −9.4, −9.2 | 2071, 1941 | 79–82% | 46–52% | 2% |
| `sighted` | 2 | −6.7, −6.2 | 1416, 1719 | 35–78% | 83–96% | 2% |
| `source` | 1 | −9.3 | 3814 | 97% | 74% | 1% |
| `threatened` | 2 | −12.2, −10.6 | 1699, 1672 | 7–11% | 93–94% | 4–6% |
| `lost` | 2 | −5.2, −5.6 | 2058, 2014 | 71–85% | 55–65% | 12–34% |
| `captured` | 2 | −8.0, −8.0 | 1672, 1669 | 21–24% | 90–91% | 3% |
| `build` | 3 | −8.0 to −7.5 | 1272–1438 | 31–42% | 83–87% | 10–14% |
| `arrive` | 3 | −9.0 to −5.8 | 647–742 | 32–50% | 78–87% | 5–12% |
| `upgrade` | 2 | −9.9, −9.8 | 1956, 1960 | 11–28% | 66–69% | 27–31% |
| `coins` | 4 | −6.5 to −4.2 | 428–574 | 2–22% | 30–51% | 32–56% |
| `craft` | 3 | −5.1 to −4.7 | 988–1111 | 36–49% | 12–17% | 41–61% |
| `rune.embed` | 3 | −10.8 to −10.3 | 697–739 | 0% | 85–87% | 11–14% |
| `rune.fuse` | 2 | −10.4, −8.2 | 1618, 1635 | 1% | 85–90% | 7–14% |
| `rune.extract` | 2 | −10.8, −4.7 | 700, 703 | 0–1% | 64–96% | 3–33% |

- No cue holds more than 14% of its A-weighted energy above 8 kHz (the craft's file stroke at most; the stingers 0%).
- Lengths against the plan's typical ones: the stingers run 0.2–0.6 s past them on their reverb tails (confront 1.94–2.07 s for ~1.5 s), all within `max_ms`; `world.source` is 3.8 s (~3 s, max 4.5).
- Spectrograms were looked at for every variant: the confront's drum and taiko, the horn stab's pair of lines near 296 and 311 Hz to 0.55 s and the drone's tail; the sighted drums at 0 and 0.25–0.34 s under the horn's harmonic stack on A; the Source's swell to 1.3–2.3 s and its fade; the toll's strike and its partials' decay; the lost toll alone, then the break at 0.3–0.5 s; the flap, then the two horn notes with the bell on the second; the knocks, creak and settle; the coins' clinks over the pouch; the two or three anvil strikes, then the file's broadband stroke; the runes' clicks, hums and chimes, and the extract's reversed rise into one pop.

**Iteration notes.** The first `sighted` had its drums 16–22 dB under the horn A-weighted (low-passed at 700 Hz): opened to 1.4 kHz and 9–12 dB up against the horn, they sit 1–4 dB under it. The first `craft` held 80% of its A-weighted energy at 2–5 kHz (the anvil's ring near 4.3 kHz): pitched down 2.5–4.5 semitones, the ring cut 8 dB at 3.4 kHz and a punch under each strike for the hammer's weight (cascade high-passed at 160 Hz after it first added 74–82% sub), 41–61%. `lost` led with the crumble: the toll now rings alone for 280 ms and the stone and rubble sit 2–5 dB lower and darker. `confront`'s stab was raised 2 dB and its drone lowered 3. `arrive` ran 796 ms against 750: a shorter bell and trim. The FM bells ended at −45 dB and left a step after the reverb (a line on the upgrade's spectrogram at 1.75 s): `fade_out = 60` on every FM layer. `rune.extract` had two pops (the reversed glass and bell, pitched up, ended 60–100 ms before the pluck): placed by their pitched lengths to end on it. Lessons added to `audio/CLAUDE.md`.

**Review package** (gitignored): `audio/.audition/13-world/` with `<cue>/<cue>.v<k>.wav` and `.png` for every variant (33), `layered/` (`stingers_in_order.wav`, `handiwork_in_order.wav`, `pair_sighted_then_threatened.wav` and `pair_confront_then_arrive.wav` 250 ms apart as a world message plays them, `coins_x4.wav`, `toll_threatened_vs_hero.wav` with step 12's `death.hero`; −6 dB), `audition.txt`, and `review.md` (brief, where it plays, what it is, measurements, an empty verdict line per cue and per layered file, and how to hear it in game with the debug console; step 07's hooks exist, so every cue plays in game).

**Unsure by ear** (for the playtest): the confront's brass stab (a real horn pitched −7 and −6 semitones at once), which may read as a detuned recording rather than brass; whether the captured call, a war horn, reads as a gain rather than a threat; the anvil's ring, still bright (41–61% at 2–5 kHz) for a cue heard at every craft; the rune hums (soft FM, the embed's on A4), which may sound synthetic; the arrive bell, heard at every arrival; whether the threatened toll's faint strike (454855 is a swinging bell: each strike rises only 7–8 dB over the ring before it) reads as one toll.

**Tidy-up from step 12's review.** `audio/sfx/battle/step.armored.toml`'s mail layer lists `{ type = "highpass", hz = 3000 }` twice: kept, with a comment saying it is on purpose (a 24 dB/octave slope, as `audio/CLAUDE.md`'s cascade lesson). The recipe's text changed its inputs hash; the rebuilt `battle` bank came out byte for byte the same (the manifest's hash for the cue alone moved).

**Verification.**

- `uv run --project tools/audio yomi-audio sfx audition` (14 cues, `--spectrogram`): 33 variants, all "ok", none peak-limited (table above).
- `uv run --project tools/audio yomi-audio sfx build --bank world`, then `npm run sounds` (`sfx build`): the `world` bank rebuilt (14 changed), every C6 check passing (world −22.0 all, peak ≤ −4.2 dBTP; correlation, DC and length), then the `battle` bank for `step.armored`'s comment.
- `npm run sounds:check`: "85 cues and 4 banks up to date, within budget".
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test`: 87 files, 1682 tests passed.
- `uv run --project tools/audio pytest tools/audio/tests`: 246 passed.
- `npm run test:browser -- e2e/audio.test.ts -t "loads the banks"`: 1 passed (the banks and themes load at boot).
- `grep -rl placeholder_ audio/sfx/`: nothing.
- No paid calls; the Freesound pages were read with `curl` (nine requests).

**Deviations.** Root `CLAUDE.md`'s audio paragraph said the world cues were still placeholders: now says every cue is real content and no recipe names the old tones (its own rule requires it to stay true). `audio/CLAUDE.md`'s "Content so far" now includes the world bank and its "rest are placeholders" line says no placeholder is named. `public/assets/audio/README.md` gained the world bank's rows (reused collections repeated), its synthesis and Freesound paragraphs extended, and "Still placeholder" became "No placeholder left". The placeholder sources stay registered (named by nothing) for step 18 to remove or document. No tool, runtime, `CUES` or `audio.toml` change.

**For later steps.** About 546 KB of the 15 MB sources budget is left; removing the ten `placeholder_*` sources in step 18 frees their bytes (`du -k audio/sources/placeholder`). The review sheet's verdicts are empty until the user's playtest.

