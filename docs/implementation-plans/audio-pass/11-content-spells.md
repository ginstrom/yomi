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

- [ ] 22 recipes rebuilt from real sources and synthesis; banks and manifest regenerated and committed with the new sources, `sources.toml`, README and `audio/CLAUDE.md` changes, one commit `Audio pass step 11: content: spells and abilities` on `audio-pass` (not pushed).
- [ ] Every Freesound file used verified CC0; every fallback for a skipped G2 file recorded.
- [ ] `audio/.audition/11-spells/` and `review.md` prepared; index status set to `awaiting review`.
- [ ] Gate **G6**: the user's per-cue verdicts recorded below; each "fix" note addressed in a follow-up commit (`Audio pass step 11 review: …`) and re-auditioned until the user approves; then index status `done` with the commit hashes.

## Execution record

