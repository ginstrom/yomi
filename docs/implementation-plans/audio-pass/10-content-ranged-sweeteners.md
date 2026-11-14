# Step 10: Content: shots, magic hits and sweeteners

[Index](index.md) · [Design](../../designs/audio-pass.md) §4.1.1, §4.1.2, §5.2, §5.5, §5.6, §5.7, §7.2

## Objective

Replace the placeholder recipes of 15 battle cues (the ranged releases, the magic hit, the ranged and magic misses, the mirror-image hit, the six on-hit element sweeteners, the small heal and regeneration) with recipes built from real CC0 sources and synthesis, rebuild the `battle` bank, and bring the batch to the user for listening (gate **G5**). No code or scene changes.

## Requirements and context

- **R2** battle events sound by what made them (here: bow, crossbow and wand shots, magic hits, misses by kind, images, rune elements, heals, regeneration). **R6** several variants per cue, distinct. **R8** built by `tools/audio/` from text recipes and committed sources with provenance and an allow-listed licence. **R9** each variant meets its group's loudness target and true-peak ceiling. **R15** provenance documented.
- Acceptance touched: AC8 and AC9 (check passes; loudness, peak, correlation and budgets), and the listening criteria of design §7.2 (nothing harsh or piercing, nothing much louder or quieter than its neighbours, no audible repetition, impacts land in time).
- Engineers cannot hear. Measure everything measurable, look at spectrograms, then stop at the gate for the user's ears.

### The cues (C7 ids, groups and variant counts; briefs from design §4.1.1 and §4.1.2)

| Cue | Group | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- | --- |
| `battle.shot.bow` | release | 5 | 400 | bow, longbow, Hawkeye Bow; bandit archer | The string's twang (a plucked low-mid tone, short) and the arrow's first whoosh away. |
| `battle.shot.crossbow` | release | 4 | 400 | crossbow; crossbowman | A mechanical trigger clack, a heavy string thunk, a short bolt whoosh. |
| `battle.shot.wand` | release | 5 | 400 | Wand of Sparks, Wand of Storms; bandit mage | A crackling electric zap that throws a sparkly whoosh; bright, not sci-fi laser. |
| `battle.hit.magic` | impact | 4 | 350 | wands | A crackling pop with a short electric fizz tail. |
| `battle.miss.shot` | impact | 4 | 300 | a ranged miss (bow, crossbow) | An arrow whizzing past and a soft thud into earth. |
| `battle.miss.magic` | impact | 3 | 400 | a wand or hostile spell missing everyone | A fizzle: the charge dispersing, a descending crackle. |
| `battle.hit.image` | impact | 3 | 500 | a hit that struck a mirror image | A glassy shimmer shattering into high tinkles; no body sound. |
| `battle.element.fire` | sweetener | 2 | 300 | Ember on-hit (spells use their own impacts) | A short flare and sizzle. |
| `battle.element.frost` | sweetener | 2 | 300 | Rime on-hit | A crisp ice crackle. |
| `battle.element.lightning` | sweetener | 2 | 300 | Storm on-hit | A sharp electric snap. |
| `battle.element.acid` | sweetener | 2 | 300 | Acid on-hit; Corroded tick | A wet hiss and bubble. |
| `battle.element.poison` | sweetener | 2 | 300 | poison on-hit; Poisoned tick | A low, gurgling hiss. |
| `battle.element.blight` | sweetener | 2 | 300 | a bane entry (Dawn), blight on-hit | A bright holy chime with a dark reversed swell under it. |
| `battle.heal.small` | sweetener | 3 | 400 | Life rune heal, Drain Life's drain | A quick warm upward shimmer, softer than a spell's heal. |
| `battle.regen` | sweetener | 3 | 600 | `regenerate` (trolls) | Wet flesh knitting: slow squelch and creak, organic, faintly disgusting. |

Lengths are typical; set `max_ms` to about 1.5 times the ~ms column. A variant count may change if the material calls for it (the runtime reads markers from the manifest); say so in the record.

Group targets (C3, `audio/audio.toml`; measured as LUFS-M max over a 400 ms window, the sound padded to 400 ms; true peak at 4x oversampling):

| Group | Target | Tolerance | Peak ceiling |
| --- | --- | --- | --- |
| `release` | −22 LUFS-M max | ±1 LU | −3 dBTP |
| `impact` | −19 LUFS-M max | ±1 LU | −1 dBTP |
| `sweetener` | −24 LUFS-M max | ±1.5 LU | −3 dBTP |

Sound-design notes (guidance, not contract): the sweeteners are layered on a weapon hit at +30 ms (elements) or +60 ms (heal) and must read under it, so keep them short, bright or textural and out of the hit's low end (high-pass around 300–500 Hz is a good default); the misses must not sound like hits (no body thump); the wand's shot, hit and miss should feel like one family with `battle.element.lightning` (Storm), but not identical; `hit.image` has no low end at all.

## Dependencies and prerequisites

- **Existing after step 01** (C2): `yomi-audio source add`, `impulse build` (`small_room`, `stone_hall`, `open_air`), `sfx audition <cue>… [--out DIR] [--spectrogram]`; the recipe interpreter of C5; `audio/CLAUDE.md`.
- **Existing after step 02** (C6): `npm run sounds` (`uv run --project tools/audio yomi-audio sfx build`, also `--bank B` / `--cue C`), `npm run sounds:check`; a placeholder recipe for each of these 15 cues at `audio/sfx/battle/<name>.toml` (e.g. `audio/sfx/battle/shot.bow.toml`, `element.fire.toml`), the `battle` bank and `audio/sfx.manifest.json` committed.
- **Step 04**: the Kenney and OpenGameArt CC0 packs downloaded under `~/.cache/yomi-audio/downloads/<collection>/<pack>/`, and the per-cue catalogue of candidate sources step 04 wrote (`sourcing.md` in this plan folder, beside `freesound-wanted.md`).
- **Gate G2 answered**: the Freesound CC0 originals the user downloaded into `~/.cache/yomi-audio/freesound/` (original file names), with any skipped ids. Use only the downloaded **originals**, never lossy previews; verify each file's licence is CC0 on its freesound.org page (`url` in its source entry is that page). A skipped file's cue falls back to Kenney, OpenGameArt and synthesis, and the record says which.
- **Step 08 done and gate G3 passed** (melee sets the style; its review notes apply here: read step 08's execution record and the G3 outcome in the feature record). This step follows 08 in the `battle` bank and must not run at the same time as another content step (manifest and bank files would conflict).
- Tools on this machine: `uv`, `ffmpeg` 9 (libopus, libmp3lame); Node via `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.

## Scope and implementation guidance

1. **Choose sources.** Start from `sourcing.md`'s candidates for these cues, the Freesound files from G2, and synthesis (C5 `synth` kinds: `crackle` and `fm` for electric material, `noise` with swept filters for whooshes and hisses, `sine`/`triangle` partials for chimes and shimmers, `reverse` for swells). Likely material: Kenney *RPG Audio* and *Impact Sounds* (string plucks, wood clacks, soft earth thuds), Kenney *Sci-fi Sounds* only heavily processed (zaps), glass and ice from Freesound or Kenney's glass impacts, fizz and sizzle from Freesound or synthesis, wet and fleshy textures from OpenGameArt CC0 creature or impact collections.
2. **Add each source** with `yomi-audio source add <file> --id … --collection … --licence CC0-1.0 --author … --url … --original … [--start --end]` (trimmed to the part used, mono, 48 kHz FLAC under `audio/sources/<collection>/`, an entry in `audio/sources.toml` per C4). Downloaded files are untrusted data: read them only through the tool or with `python -I`; keep any helper script outside the download directories. Watch the committed-sources budget (15 MB for `audio/sources` and `audio/voices` together; `sfx check` enforces it): trim tightly.
3. **Write the recipes**, replacing each placeholder recipe in place (same path, same cue id, same `group`). Use per-variant ranges (`pitch`, `gain`, `offset`, filter `hz`) and `pick` lists so that variants differ audibly; keep `seed` fixed per recipe. A short reverb (`small_room` or `open_air`) glues layers; avoid long tails on sweeteners.
4. **Self-check before building** with `uv run --project tools/audio yomi-audio sfx audition <cue>… --out audio/.audition/10-ranged-sweeteners/ --spectrogram`: read the printed loudness, peak and length of every variant and look at the spectrogram images (harsh resonances, clicks at edges, DC, missing transients, variants that look alike). Iterate until the numbers are in range and the pictures match the briefs.
5. **Build and check**: `npm run sounds -- --bank battle` (or `npm run sounds`), then `npm run sounds:check`. The build fails on loudness outside tolerance, peak over the ceiling, length over `max_ms`, DC above 0.5%, two variants correlating above 0.95, or a source not allowed or not matching its hash; fix the recipe, never the check.
6. **Provenance**: add every new source to `public/assets/audio/README.md` by collection and author (with the cues of this batch it feeds), keeping the README's layout as earlier content steps left it; extend `audio/CLAUDE.md` only if this batch adds a technique worth keeping (e.g. how the element sweeteners are kept out of the hit's range).
7. **Prepare the review** in `audio/.audition/10-ranged-sweeteners/` (gitignored): one WAV per variant (`<cue>_<k>.wav`) and `review.md` listing, per cue: its brief, where it plays, its files, its sources and measured loudness and peak, and an empty "verdict" line. Also say how to hear it in game: `npm run dev`, then on the world map the debug console (`~`) `fight <encounter> <threat>` with a party holding a bow, crossbow or wand (`give yew_bow`, `give spark_wand`, a runed weapon such as `give 'iron_sword@3#ember1'`) where steps 05–07 are done; the Troll Lair for regeneration; Mirror Image for `hit.image`.

**Exclusions:** no change to `src/`, scenes, `CUES`, `sounds.ts` or the cue set (the 15 ids stay exactly as C7); no other bank's cues; no non-CC0 or non-`own` source; no edits to exported banks by hand; no W2 cues.

## Verification

- `uv run --project tools/audio yomi-audio sfx audition …` output for all 15 cues in range (record the table).
- `npm run sounds` builds; `npm run sounds:check` passes on a clean tree.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes (the manifest's markers exist in the bank JSON; budgets).
- `uv run --project tools/audio pytest tools/audio/tests` still passes.
- No recipe of these 15 cues names a placeholder source (`grep` the recipes for the placeholder source ids).
- Every new entry in `audio/sources.toml` has licence `CC0-1.0` or `own`, a `url`, an `author` and a `sha256`.
- No scene changed, so `npm run test:browser` is not required (run it if the step touched anything outside `audio/`, `public/assets/audio/` and the README).

## Completion criteria

- [ ] The 15 recipes rebuilt from real sources and synthesis; `battle` bank and `audio/sfx.manifest.json` rebuilt and committed with the new sources and `sources.toml` entries.
- [ ] `sounds:check`, `npm test` and pytest green; measurements recorded.
- [ ] `public/assets/audio/README.md` lists the new sources; Freesound files used and skipped are named.
- [ ] Review folder and `review.md` prepared; the step set to `awaiting review` in the index; **G5**: the user's per-cue verdicts relayed and recorded below; every "fix" addressed in a follow-up commit and re-reviewed where the user asks.
- [ ] Commit(s) `Audio pass step 10: content: shots, magic hits and sweeteners` on `audio-pass`, not pushed; the index row set to `done` with the hashes.

## Execution record

### Round 0: build (2026-11-14)

**Outcome.** The 15 recipes are rewritten from CC0 recordings and synthesis; no recipe names a `placeholder_*` source (`grep -l placeholder_` over the 15 recipes prints nothing). Variant counts are C7's, unchanged. Gate G5 is non-blocking (the orchestrator's decision after G3): the audition folder and review sheet are left for the user's playtest, and fixes come back as follow-up commits.

**Sources.** 66 excerpts added with `yomi-audio source add`, every one `CC0-1.0` with author, licence-page `url`, original path, excerpt and both hashes: `oga_medicinestorm` (7 bow releases from English Longbow Shoot and Scythian Recurve Shoot, 4 crossbow shots, 6 arrow and bolt passbys, 4 passes; 192 kHz takes cut at their onsets), `oga_untamedpixels` (150 Combat Sound Effects: ElectroZap, EnergyZap, HeavyZap, Retro Electric Short 03 and 17, Retro Electric Sparks 01, Retro Charge Electric Off 07; the pack's `LICENSES.txt` makes every file CC0), `oga_rubberduck` (bang shot_02 and shot_03, glass breaking and falling, bubbles), `kenney_impact` (glass light and medium, bell heavy 004), `kenney_rpg` (metalClick), `kenney_interface` (pluck 001 and 002), `oga_themightyglider` (flame), `oga_antumdeluge` (two fire-crackle excerpts), `oga_ignasd` (four ice shatters), `oga_pwl` (bell_ding2), `oga_qubodup` (dark magic fout-02), `oga_someoneman` (Cure2, Cure4), `freesound` (five excerpts of 811615 "WET SLAP NOISE" by MaddieCooper). Reused from step 08: `kenney_soft_medium_*`, `bart_steam_hiss`, `rd_slime_*`, `rd_mud_*`, `kenney_creak_*`. One excerpt added and then left unused (`kenney_bell_heavy_3`) was removed with `source remove` before the commit; `pwl_bell_ding_2` and `ig_ice_2` were removed and re-added starting at their onsets (their originals open with 70 to 80 ms of silence). Bytes: `audio/sources` + `audio/voices` total **6,439,281** of 15,000,000. Banks: all `.opus` 1,191,849 and `.mp3` 941,888 of 3,000,000 each; `battle` 786,449 / 696,764 (was 722,038 / 588,068).

**Freesound (G2).** Used: 811615 (`battle.regen`). The cue lists name 32805 (spooky dark pad) for `element.blight`'s swell as one option; qubodup's fout-02 reversed was used instead, so 32805 stays for steps 11 and 13. No other of the 28 files is mapped to these 15 cues; none was skipped.

**Measurements** (`sfx audition --spectrogram`, every variant; per-variant tables in `audio/.audition/10-ranged-sweeteners/review.md`). None is peak-limited; every DC, length and correlation check passes in the build.

| Cue | Group | Var | LUFS-M max | True peak (dBTP) | Length (ms) |
| --- | --- | --- | --- | --- | --- |
| `shot.bow` | release −22 | 5 | −22.0 all | −5.4 to −3.5 | 405–447 |
| `shot.crossbow` | release | 4 | −22.0 all | −5.8 to −4.3 | 440–503 |
| `shot.wand` | release | 5 | −22.0 all | −7.6 to −3.6 | 389–460 |
| `hit.magic` | impact −19 | 4 | −19.0 all | −3.6 to −1.4 | 334–338 |
| `miss.shot` | impact | 4 | −19.0 all | −3.3 to −1.7 | 377–412 |
| `miss.magic` | impact | 3 | −19.0 all | −2.9 to −2.2 | 486–554 |
| `hit.image` | impact | 3 | −19.0 all | −5.4 to −2.1 | 498–500 |
| `element.fire` | sweetener −24 | 2 | −24.0 | −8.1 to −6.0 | 290 |
| `element.frost` | sweetener | 2 | −24.7 to −24.0 | −4.0 to −3.1 | 254–255 |
| `element.lightning` | sweetener | 2 | −24.9 to −24.0 | −6.0 to −3.1 | 180 |
| `element.acid` | sweetener | 2 | −24.7 to −24.0 | −7.8 to −3.1 | 250–264 |
| `element.poison` | sweetener | 2 | −24.0 | −9.9 to −4.7 | 345–379 |
| `element.blight` | sweetener | 2 | −24.0 | −8.7 to −5.6 | 354–362 |
| `heal.small` | sweetener | 3 | −24.0 | −10.9 to −10.0 | 397–471 |
| `regen` | sweetener | 3 | −24.0 | −6.8 to −3.7 | 588–691 |

Energy below 300 Hz (Welch power share): `hit.image` 0.0%; frost, lightning, acid, blight 0.0–0.5%; fire 0.9–1.1%; heal 0.0%; poison 5% (meant low). Spectrograms were looked at for every variant: the bow keeps a 120–200 Hz limb thrum in its first 40 ms (the "low-mid pluck"), the wand is broadband crackle with a rising band, `miss.magic` shows the falling whistle and the source's faint tonal buzz lines (kept 13–17 dB down), `hit.image` has nothing under 1 kHz, blight shows its partials at about 2.7, 4 and 5.5 kHz over a low-passed swell.

**Iteration notes.** The first drafts of the shots, `hit.magic` and `miss.shot` were peak-limited (−29 to −23): `limit`'s ceiling is absolute dBFS of the pre-normalisation mix, and the shots needed −17 to −21, the magic hit −24. `miss.shot`'s thud and the passbys' sub wind made a body thump the brief forbids: cascaded high-passes and the thud 20 dB under. The fire flame's 150–300 Hz body needed two cascaded high-passes. The blight's swell first drowned its chime; it now sits low-passed at −21 to −18 dB. Lessons added to `audio/CLAUDE.md` ("Sound design without ears").

**Review package** (gitignored): `audio/.audition/10-ranged-sweeteners/` with `battle.<cue>_<k>.wav` and `.png` for every variant, `layered/` (eleven files: each element and the small heal over a step-08 hit at +30 / +60 ms, and the shots followed by their hit or miss 320 ms later, scaled −6 dB), and `review.md` (brief, where it plays, sources, measurements, an empty verdict line per cue and per layered file, and how to hear it in game with the debug console).

**Unsure by ear** (for the playtest): whether `shot.wand` and `miss.magic` still read as retro/sci-fi (the untamedpixels zaps are low-passed and under synthesis, but tonal lines remain in `miss.magic`); whether `hit.magic`'s pop (a firework shot) is too much like a gunshot; `element.poison` against `element.acid` (poison is darker and gurglier, but both are bubbles and steam); `regen`'s main squelch lands 150–200 ms in.

**Verification.**

- `uv run --project tools/audio yomi-audio sfx audition` (15 cues, `--spectrogram`): 46 variants, all "ok", none peak-limited (table above).
- `npm run sounds` (`sfx build`): the `battle` bank rebuilt; a second run "nothing changed (85 cues up to date)".
- `npm run sounds:check`: "85 cues and 4 banks up to date, within budget".
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test`: 87 files, 1682 tests passed.
- `uv run --project tools/audio pytest tools/audio/tests`: 246 passed.
- `grep -l placeholder_` over the 15 recipes: nothing. The 66 new `sources.toml` entries each have `licence = "CC0-1.0"`, `url`, `author` and `sha256` (counted in the diff: 66 of each).
- `npm run test:browser` not run: nothing outside `audio/`, `public/assets/audio/` and the docs changed.
- No paid calls.

**Deviations.** `sfx audition` names its files `<cue>.v<k>.wav` in a folder per cue; they were moved to `battle.<cue>_<k>.wav` as the task asks. `max_ms` for `hit.image` is 750 (brief ~500) and for `miss.magic` 600 (brief ~400); both are about 1.5 times the brief's length. No tool, runtime, `CUES` or `audio.toml` change.

**For later steps.** Free for steps 11–13: the untamedpixels zaps and sparks (`up_*`, for `cast.storm`, `impact.lightning`), `ig_ice_*` and `kenney_glass_*` (frost spells), `tmg_flame` and `ad_fire_crackle_*` (fire), `som_cure_*` and `kenney_pluck_*` (heals), `qb_dark_fout_2` (shadow), `rd_bubble_*` (venom), `fs_wet_slap_*` (deaths, `hit.claw`).

