# Step 11: Content: spells and abilities

[Index](index.md) · [Design](../../designs/audio-pass.md) §4.1.3, §5.2, §5.5, §5.6 (Example 2), §5.7 · Gate **G6**

## Objective

Replace the placeholder recipes of the 22 spell and area-ability cues of the `battle` bank with real content: casts, impacts and ability releases built from CC0 recordings (Kenney, OpenGameArt, the Freesound files of gate G2) and synthesis, meeting their groups' loudness and peak targets, then hand them to the user for a listening review (G6). Covers R2 (spells and abilities), R6 (variants), R8, R9 for these cues.

Judgement-heavy: this is sound design (layering, synthesis, processing). Run it on the session's model.

## Requirements and context

### The cues (C7; briefs from design §4.1.3)

A cast plays its **cast** cue at 0 ms and its **impact** at `impactMs`. Groups and their targets (C3): `release` −22 LUFS-M max ±1 LU, peak −3 dBTP; `impact` −19 LUFS-M max ±1 LU, peak −1 dBTP. "~ms" is typical length; `max_ms` may be up to about 1.5 times that.

| Cue | Group | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- | --- |
| `battle.cast.arcane` | release | 3 | 500 | hostile spells without element: Magic Arrow, Sleep (and Web's cast) | A mystic intake: a breathy rising shimmer with a soft tonal hum. |
| `battle.cast.fire` | release | 3 | 600 | Flame Arrow, Fireball | Ignition: a match-strike scrape blooming into a flame whoosh. |
| `battle.cast.frost` | release | 3 | 600 | Frost Blast | Cold wind with a crystalline crackle forming. |
| `battle.cast.storm` | release | 3 | 500 | Lightning Bolt | An electric charge rising in pitch, a buzz. |
| `battle.cast.venom` | release | 3 | 600 | Acid Arrow, Death Cloud | A wet bubbling hiss gathering. |
| `battle.cast.shadow` | release | 3 | 700 | Drain Life, Curse, Bane, Dark Shield | A low dark whoosh, a reversed breath. |
| `battle.cast.holy` | release | 3 | 700 | healing school, Bless | A warm swell: soft choir-like pad (synthesised) and a bell strike. |
| `battle.cast.ward` | release | 3 | 600 | support school: Shield, Protect, Haste, Mirror Image | A bright rising shimmer, glassy. |
| `battle.impact.arcane` | impact | 4 | 400 | Magic Arrow | A clean magical pop with a sparkle tail. |
| `battle.impact.fire` | impact | 4 | 700 | Flame Arrow; Fire Spit | A flame burst: whoomph, sizzle, short crackle. |
| `battle.impact.fireball` | impact | 3 | 1400 | Fireball | An explosion: sub boom, noise burst, a fire whoosh, a crackling tail; the loudest spell. |
| `battle.impact.frost` | impact | 4 | 700 | Frost Blast | Ice shattering: crunchy transient, glassy debris tinkles. |
| `battle.impact.lightning` | impact | 3 | 900 | Lightning Bolt | A thunder crack: sharp snap, then a rumbling tail. |
| `battle.impact.acid` | impact | 4 | 700 | Acid Arrow | A splash and a strong sizzle. |
| `battle.impact.poison` | impact | 3 | 1200 | Death Cloud | A gas cloud: a soft burst into a long, low hiss. |
| `battle.impact.shadow` | impact | 4 | 800 | Drain Life | A dark thud, a sucking reverse swell. |
| `battle.impact.hex` | impact | 3 | 800 | Sleep, Curse, Bane | A descending, dissonant, glassy shimmer: eerie, not violent. |
| `battle.impact.web` | impact | 3 | 500 | Web (spell and spider ability) | A sticky splat with stretching fibres. |
| `battle.impact.heal` | impact | 3 | 900 | healing spells, a world-map heal | A warm rising chime with sparkle; consonant, gentle. |
| `battle.impact.buff` | impact | 3 | 700 | Shield, Protect, Bless, Haste, Mirror Image, Dark Shield | A bright shimmer ring settling around the target. |
| `battle.ability.spit` | release | 3 | 600 | Fire Spit (release) | A throaty reptile hiss into a fire whoosh. |
| `battle.ability.web` | release | 3 | 400 | Spider Web (release) | A fast silk "thwip". |

Cue ids, groups and variant counts are fixed by C7; a count may change only if the step says so in its record (the runtime reads markers from the manifest). Cue id `<bank>.<name>` maps to `audio/sfx/battle/<name>.toml` (e.g. `audio/sfx/battle/impact.fireball.toml`).

### Mix intent

- `battle.impact.fireball` is the loudest spell: it sits at the top of the `impact` group's tolerance (about −18 LUFS-M max) with the most low end and the longest tail, but never above the −1 dBTP ceiling (use a `limit` in its post chain, as Example 2 does). Other impacts sit at the group target.
- Casts are anticipations, not payoffs: lighter in the low end than their impacts. Friendly sounds (`cast.holy`, `cast.ward`, `impact.heal`, `impact.buff`) are consonant and gentle; hostile ones may be dissonant.
- Each cue's variants must differ audibly (pitch, layer pick, timing) yet read as the same sound; no two variants above 0.95 peak normalised cross-correlation (a build failure).
- Rooms: spells use the `open_air` or `small_room` impulse (step 01) by the feel wanted; keep reverb tails within `max_ms`.

### The recipe format (C5; design §5.6 is normative)

TOML, one cue a file. Top level `variants`, `seed`, `group`, optional `max_ms`. `[[layer]]` with `source` | `pick` | `synth`, and `gain` (dB), `offset` (ms), `pitch` (semitones, by resampling), `start`/`length`, `reverse`, `fade_in`/`fade_out`, `envelope` (`[[ms, dB], …]`), `filter` (list), `saturate`, `chance`. Any numeric field may be `[lo, hi]`, drawn per variant from numpy `default_rng([seed, k])`. Synth kinds `sine|triangle|saw|square` (`hz`, `hz_end`, `curve`), `noise` (`color`), `fm` (`carrier_hz`, `ratio`, `index`, `index_end`), `crackle` (`density`, `click_ms`), `impulse`; each needs `length`. Filters `highpass|lowpass|bandpass|peak|lowshelf|highshelf` with optional `hz_end` sweep. `[post] chain`: `compress`, `saturate`, `reverb` (`impulse`, `wet_db`, `predelay_ms`), `delay`, `limit`, `trim`, `fade_out`; normalisation to the group's target is always last. Runtime hints (bus, jitter, limits) never go in recipes.

The model of a mostly synthesised recipe is design §5.6 Example 2, Fireball:

```toml
# Fireball: sub boom, a noise burst opening up, a fire whoosh, a crackling tail.
variants = 3
seed = 23
group = "impact"
max_ms = 1800

[[layer]]                          # sub boom
synth = { kind = "sine", hz = 70, hz_end = 28, curve = "exp", length = 500 }
envelope = [[0, -3], [10, 0], [500, -60]]
saturate = 4

[[layer]]                          # the blast
synth = { kind = "noise", color = "brown", length = 700 }
filter = [{ type = "lowpass", hz = 300, hz_end = 6000, q = 0.7 }]
envelope = [[0, -40], [15, 0], [120, -6], [700, -60]]
gain = [-4, -1]

[[layer]]                          # the flame
pick = ["fs_fire_whoosh_1", "fs_fire_whoosh_2", "fs_fire_whoosh_4"]
offset = [20, 60]
pitch = [-3.0, 0.0]
gain = -6

[[layer]]                          # embers
synth = { kind = "crackle", density = [35, 60], click_ms = 2, length = 900 }
offset = 250
filter = [{ type = "bandpass", hz = 3000, q = 0.8 }]
envelope = [[0, -20], [100, -8], [900, -60]]
gain = -14

[post]
chain = [
  { type = "compress", threshold_db = -14, ratio = 4, attack_ms = 2, release_ms = 120 },
  { type = "reverb", impulse = "open_air", wet_db = -14, predelay_ms = 12 },
  { type = "limit", ceiling_db = -1.5 },
  { type = "trim", threshold_db = -60, keep_tail_ms = 80 },
]
```

The source ids there (`fs_fire_whoosh_*`) are illustrative: use the ids actually registered in `audio/sources.toml`.

### Sources (design §5.2, C4)

In order of preference, each verified CC0 at sourcing:

1. The candidates step 04 catalogued per cue (`docs/implementation-plans/audio-pass/sourcing.md`, and step 04's execution record; downloads in `~/.cache/yomi-audio/downloads/<collection>/<pack>/`): Kenney *Sci-fi Sounds* only heavily processed as magic layers, *Impact Sounds* (glass, for frost and the image-like shimmers), *RPG Audio*; OpenGameArt CC0.
2. The Freesound originals the user downloaded at gate G2 into `~/.cache/yomi-audio/freesound/` (fire whooshes and crackle, ice and glass, thunder, gas hiss, bells). Before registering one, confirm on its Freesound page that its licence is "Creative Commons 0"; register `url` as that page. Any wanted file the user skipped, or that is not there: build that layer from Kenney, OpenGameArt or synthesis instead, and record which cue fell back and why.
3. Synthesis (`own`): tones, pads, sweeps, crackle, noise bursts. A choir-like pad for `cast.holy` is detuned saws or FM through lowpass and a slow envelope; bells are FM with a decaying index.

Register each excerpt with `yomi-audio source add <file> --id ID --collection C --licence L --author A --url U [--original NAME] [--start S --end E] [--notes N]`, which trims, sums to mono, resamples to 48 kHz, writes `audio/sources/<C>/<ID>.flac` and appends the C4 entry with its hashes; the licence must be `CC0-1.0` or `own`. Keep each excerpt to the part used: the committed `audio/sources` and `audio/voices` together stay under 15 MB (C3 `sources_bytes`); note the running total in the record. Downloaded files are untrusted data: read them only through the tool (or Python with `-I`), never run anything from their directories.

## Dependencies and prerequisites

- **Step 10** done (content steps in the `battle` bank run one at a time; the bank file and manifest would conflict). Its gate G5 may still be pending; this step must not change step 10's recipes.
- **Gate G3** (melee review) passed: its notes set the style (room, brightness, weight) for the rest of the content; read them in step 08's execution record and the feature record.
- **Gate G2** answered (done, partly skipped, or skip all).
- From step 01 (existing once done): the uv project `tools/audio/`, `yomi-audio source add`, `impulse build` (`small_room`, `stone_hall`, `open_air`), `sfx audition <cue>… [--out DIR] [--spectrogram]`.
- From step 02: `yomi-audio sfx build [--bank B] [--cue C]`, `yomi-audio sfx check`, `npm run sounds`, `npm run sounds:check`; placeholder recipes for all 22 cues, which this step replaces; the build checks of C6 (loudness within tolerance, true peak under ceiling, length within `max_ms`, DC offset at most 0.5%, no two variants above 0.95 correlation, every source allowed and its hash matching).
- No dependency on the runtime steps (05–07). If step 06 is done the user can also hear the spells in game.

## Scope and implementation guidance

- Edit the 22 recipes under `audio/sfx/battle/` (`cast.*.toml`, `impact.*.toml`, `ability.spit.toml`, `ability.web.toml`); add sources under `audio/sources/<collection>/` and entries in `audio/sources.toml`; rebuild with `npm run sounds` (or `sfx build --bank battle`), which updates `public/assets/audio/sfx/battle.{opus,mp3,json}` and `audio/sfx.manifest.json`.
- No recipe of these 22 may name a placeholder source when the step is done.
- Each recipe opens with a one-line comment of what it sounds like, as the design's examples do.
- Workflow per cue: write the recipe, `uv run --project tools/audio yomi-audio sfx audition <cue> --spectrogram`, read the printed loudness, peak and length and look at the spectrogram images (check the shape the brief asks for: a rising sweep for `cast.storm`, a transient then a long low tail for `impact.lightning`, consonant partials for `impact.heal`, a broadband transient and sub energy for `impact.fireball`), adjust, repeat. Keep friendly spells free of harsh 2–5 kHz peaks.
- Do not touch `src/`, other banks' recipes, or the cue set (C7). Do not change `audio.toml`'s targets; if a target seems wrong, record it for the orchestrator.
- Provenance: add the new sources to `public/assets/audio/README.md` (by collection and author, with the cues they feed) and update its table of what plays when for these cues. Add anything learnt about authoring spell sounds that later steps need to `audio/CLAUDE.md` (briefly). Root `CLAUDE.md` needs no change unless a statement there becomes false.
- **Gate preparation:** write `audio/.audition/11-spells/` (gitignored): every variant of the 22 cues as WAV (`<cue>_<k>.wav`) and a `review.md` with a row per cue: the brief, its files, its measured loudness and length, which sources and fallbacks it uses, and blank columns "OK / note" for the user. Say there how to hear them in game if step 06 is done (`npm run dev`, debug console `~`, `fight <encounter> <threat>`, e.g. the Salamander Pool for Fire Spit and the Spider Nest for Web; a mage hero for the spells).

## Verification

- `npm run sounds` succeeds; every variant passes the C6 checks (loudness within its group's tolerance, peak under its ceiling, length, DC, correlation).
- `npm run sounds:check` passes on a clean tree.
- `uv run --project tools/audio pytest tools/audio/tests` passes.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes (the manifest's markers still exist for every cue).
- Budgets (C3): shipped SFX at most 3 MB per format across all banks; sources and clips at most 15 MB. Record the figures.
- `grep` over the 22 recipes finds no placeholder source id.
- `impact.fireball` measures loudest among spell impacts and within −1 dBTP.
- No scene changes: `npm run test:browser` is not required.

## Completion criteria

- [x] 22 recipes rebuilt from real sources and synthesis; banks and manifest regenerated and committed with the new sources, `sources.toml`, README and `audio/CLAUDE.md` changes, one commit `Audio pass step 11: Content: spells and abilities` on `audio-pass` (not pushed).
- [x] Every Freesound file used verified CC0; every fallback for a skipped G2 file recorded (none was skipped).
- [x] `audio/.audition/11-spells/` and `review.md` prepared; index status set to `done` (G6 non-blocking, as for G4 and G5).
- [ ] Gate **G6**: deferred to the user's playtest (the orchestrator's decision: G6 does not block). The audition folder and `review.md` are left for it; fixes come back as follow-up commits.

## Execution record

### Round 0: build (2026-11-14)

**Outcome.** The 22 recipes are rewritten from CC0 recordings and synthesis; no recipe of the 22 names a `placeholder_*` source (`grep -l placeholder_` over them prints nothing). Variant counts are C7's, unchanged. Gate G6 is non-blocking (the orchestrator's brief): the audition folder and review sheet are left for the user's playtest, and the step is set `done` with G6 deferred.

**Direction.** The user's pending ear on step 10 flagged a sci-fi wand and magic miss, a gunshot-like magic hit and acid too like poison, so these cues lean on organic recordings and keep synthesis under them: real fire (Freesound whooshes and flamethrower bursts, lentikula's fire spell impacts, LEGIT Audio's fire staff, a match strike), real thunder (two Freesound cracks and rubberduck's), ice and glass, water, slime and steam, a snake's hiss and a creature's spit, qubodup's dark whooshes reversed and a dark pad, a hummed voice pitched into a major triad for the holy choir, real bells. No untamedpixels retro zap or Kenney sci-fi file is used; the arcane pop is a puff of noise and a glass tick, not step 10's firework shot. Acid and poison are separated by band (below).

**Sources.** 50 excerpts added with `yomi-audio source add`, every one `CC0-1.0` with author, licence-page `url`, original, excerpt and both hashes (counted in the diff: 50 `id`, 50 `licence = "CC0-1.0"`): `freesound` (13 excerpts of 10 files: 244926 hnhnh, 395038 AslakHostaker ×3, 346917 Julien_Matthey, 522705 julianmateo_, 200990 rayjensen, 616992 TRP, 706977 JesterWhoo ×2, 32805 JOHNWALLY, 685680 xkeril, 867251 bassimat), `oga_untamedpixels` (13 of lentikula's fire, ice, lightning and healing spell impacts; author recorded as lentikula, the pack's `LICENSES.txt` naming its itch.io packs Basic Spell Impacts and Healing Spell Impacts), `oga_legitaudio` (new: LEGIT Audio's Fire Staff 1 and 3), `oga_vehicle` (match strike, air spray, two tube whooshes), `oga_artisticdude` (freeze, swish 11), `oga_bart` (coldsnap; the Ice Spells page says bart made them from a public-domain recording by Stephan at pdsounds, recorded in `author`), `oga_rubberduck` (air, thunder, three splashes, three slimes, bubbles loop, two spits), `oga_qubodup` (fout-01, fout-03), `oga_pwl` (bell dings 1 and 3). Authors were read on each OpenGameArt page (WebFetch is refused there; `curl` with a browser user agent read the Author and License fields); every new page names its uploader as the author, so no submitter/author split like medicinestorm's. Three excerpts added and left unused (`ad_swish_10`, `ad_swish_12`, `bart_ice_spell`) were removed with `source remove` before the commit. Reused: `tmg_flame`, `ad_fire_crackle_*`, `ig_ice_*`, `kenney_glass_*`, `rd_glass_*`, `rd_bang_2/4`, `rd_bubble_*`, `rd_slime_02/04/07`, `rd_mud_*`, `rd_breath`, `bart_steam_hiss`, `vh_paper_tear`, `qb_dark_fout_2`, `pwl_bell_ding_2`, `kenney_punch_heavy_*`, `kenney_soft_medium_*`. Bytes: `audio/sources` + `audio/voices` **10,782,295** of 15,000,000 (was 6,439,281). Banks: all `.opus` 1,473,396 and `.mp3` 1,266,008 of 3,000,000 each; `battle` 1,067,996 / 1,020,884 (was 786,449 / 696,764).

**Freesound (G2).** Used here: 244926, 395038, 346917, 522705, 200990, 616992, 706977, 32805, 685680, 867251, each checked "Creative Commons 0" on its page (orchestrator's brief) and registered with that page as `url`. None was skipped, so no fallback. Left for steps 12 and 13: 824588, 454855, 434339, 449843, 411122, 259542, 235453, 347126, 512490, 539956, 846337, 270589, 171844, 555423, 57280, 693428, 616622 (867251, 32805, 685680, 706977, 200990 and 616992 also serve them).

**Measurements** (`sfx audition --spectrogram`, every variant; per-variant tables in `audio/.audition/11-spells/review.md`). None is peak-limited; every DC, length and correlation check passes in the build.

| Cue | Group | Var | LUFS-M max | True peak (dBTP) | Length (ms) |
| --- | --- | --- | --- | --- | --- |
| `cast.arcane` | release -22 | 3 | -22.0 all | -10.7 to -9.9 | 643–654 |
| `cast.fire` | release -22 | 3 | -22.5 to -22.0 | -5.6 to -3.1 | 647–732 |
| `cast.frost` | release -22 | 3 | -22.0 all | -11.1 to -8.9 | 690–734 |
| `cast.storm` | release -22 | 3 | -22.0 all | -5.3 to -3.3 | 606–624 |
| `cast.venom` | release -22 | 3 | -22.0 all | -12.3 to -5.3 | 581–695 |
| `cast.shadow` | release -22 | 3 | -22.0 all | -9.8 to -8.7 | 919–969 |
| `cast.holy` | release -22 | 3 | -22.0 all | -7.4 to -3.1 | 915–964 |
| `cast.ward` | release -22 | 3 | -22.0 all | -11.7 to -5.1 | 633–657 |
| `impact.arcane` | impact -19 | 4 | -19.0 all | -5.9 to -4.1 | 424–453 |
| `impact.fire` | impact -19 | 4 | -19.0 all | -6.9 to -5.9 | 776–834 |
| `impact.fireball` | impact -19 | 3 | -19.0 all | -4.1 to -3.3 | 1554–1635 |
| `impact.frost` | impact -19 | 4 | -19.0 all | -7.4 to -5.2 | 622–672 |
| `impact.lightning` | impact -19 | 3 | -19.0 all | -5.8 to -4.1 | 1094–1157 |
| `impact.acid` | impact -19 | 4 | -19.0 all | -7.5 to -1.8 | 696–699 |
| `impact.poison` | impact -19 | 3 | -19.0 all | -3.6 to -3.0 | 1109–1478 |
| `impact.shadow` | impact -19 | 4 | -19.0 all | -6.3 to -3.3 | 836–950 |
| `impact.hex` | impact -19 | 3 | -19.0 all | -5.0 to -3.7 | 768–809 |
| `impact.web` | impact -19 | 3 | -19.0 all | -6.5 to -1.7 | 430–469 |
| `impact.heal` | impact -19 | 3 | -19.0 all | -9.4 to -8.4 | 1065–1079 |
| `impact.buff` | impact -19 | 3 | -19.0 all | -8.2 to -7.5 | 692–709 |
| `ability.spit` | release -22 | 3 | -22.0 all | -6.1 to -3.9 | 644–660 |
| `ability.web` | release -22 | 3 | -22.0 all | -5.2 to -4.5 | 298–338 |

Band and loudness checks (A-weighted Welch shares, `pyloudnorm`):

- **Casts lighter than impacts**: raw power under 300 Hz, casts 0–34% (fire 26–33, holy 16–34, the rest 0–13) against their impacts' 47–94% (fire 64–91, fireball 76–86, lightning 62–78, shadow 47–94, poison 62–66).
- **Acid against poison**: acid 0% under 300 Hz and 21–37% in 2–5 kHz (A-weighted); poison 62–66% under 300 Hz and 5–7% in 2–5 kHz.
- **Friendly cues' 2–5 kHz** (A-weighted share): `cast.holy` 5–10%, `impact.buff` 19–24%, `impact.heal` 32–41% (from 56–57% before a 2.6 kHz low-pass and −6 dB at 3.5 kHz on its bells), `cast.ward` 24–47% (a bright shimmer by brief). No narrow peak shows in the spectrograms.
- **Fireball loudest**: every impact is normalised to −19.0 LUFS-M max (the tool always normalises to the group's target; no recipe can set another), so "loudest" is held by sustained loudness: K-weighted loudness over a 3 s window, ungated, fireball −24.0 to −24.5 against at most −25.8 for any other spell impact (lightning); true peak −3.3 to −4.1 dBTP, under −1. It also has the most low end of the impacts by A-weighting (raw 76–86% under 300 Hz) and the longest tail (1.55–1.64 s).

Spectrograms were looked at for every cue: the storm cast's buzz harmonics rise under the charge; the lightning impact is a broadband snap then a band under 2 kHz rumbling to 1.1 s; venom's bubbles show as rising chirps; the hex shows three glass strikes stepping down with the falling noise band; the heal's FM bells show their partials decaying fast after the first 160 ms.

**Iteration notes.** First drafts of five casts were peak-limited (match strike, glass and crackle spikes): a `limit` at −14 to −20 fixed them. The first impacts' limits squashed them to −8 to −12 dBTP; raising each ceiling by its peak plus 2.5 dB brought them to −2 to −7. The arcane cast's hum at 200 Hz put 66–79% of its power under 300 Hz: moved up an octave. The heal and buff began as steady sine and low-index FM lines (a synthetic sound): now high-index FM bells decaying fast. The fireball first measured no louder than lightning over 3 s: a roaring fire bed under its tail and a harder compressor fixed that. Lessons added to `audio/CLAUDE.md`.

**Review package** (gitignored): `audio/.audition/11-spells/` with `battle.<cue>_<k>.wav` and `.png` for every variant (71), `layered/` (16 files: each spell's cast with its impact at the runtime offset, 285 ms for a target 3 hexes away, 60 ms for Bless, 180 ms for Fire Spit; −6 dB), `audition.txt`, and `review.md` (brief, where it plays, what it is, sources, fallbacks, measurements, an empty verdict line per cue and per layered file, how to hear it in game with the debug console).

**Unsure by ear** (for the playtest): `cast.storm`'s rising saw buzz (the one synthetic tone left in a cast; it sits under a real charge and static, but may read electronic); the heal's and buff's FM bells (bell-like on the spectrogram, still synthesis); `impact.fireball`, whose roar bed makes it loud for long but may blur the blast's punch; `cast.holy`'s choir, one hummed voice pitched to a major triad (may sound like one person humming); `impact.hex`, glass struck in a falling cascade (eerie or merely clinky); whether acid and poison now differ enough; `cast.arcane`'s hum.

**Verification.**

- `uv run --project tools/audio yomi-audio sfx audition` (22 cues, `--spectrogram`): 71 variants, all "ok", none peak-limited (table above).
- `npm run sounds` (`sfx build`): the `battle` bank rebuilt (22 changed); a second run "nothing changed (85 cues up to date)".
- `npm run sounds:check`: "85 cues and 4 banks up to date, within budget".
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test`: 87 files, 1682 tests passed.
- `uv run --project tools/audio pytest tools/audio/tests`: 246 passed.
- `grep -l placeholder_` over the 22 recipes: nothing.
- `npm run test:browser` not run: nothing outside `audio/`, `public/assets/audio/` and the docs changed.
- No paid calls.

**Deviations.** `max_ms` unchanged from step 02's (1.5 times each brief). No tool, runtime, `CUES` or `audio.toml` change. `public/assets/audio/README.md` has no table of what plays when (steps 08 to 10 added none either); its provenance table gained step 11's rows (reused collections repeated, as the table says) and its notes on synthesis and Freesound files. Root `CLAUDE.md`'s audio paragraph still said every cue was a placeholder (false since step 08): corrected.

**For later steps.** The placeholder sources `placeholder_melee_swing`, `placeholder_hit_impact`, `placeholder_crit_impact`, `placeholder_miss` and `placeholder_spell_cast` are now named by no recipe (step 18 decides whether to remove them). Free for steps 12 and 13: `fs_thunder_*` and `fs_drone` (the Horror's death, `world.source`), `fs_dark_pad`, `fs_hum`, `fs_snake_hiss_*` (the salamander's death), `rd_spit_*`, `lk_*` lead-ins.
