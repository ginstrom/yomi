# Step 02: Banks, check and placeholder catalogue

[Index](index.md) · [Design](../../designs/audio-pass.md) §5.7, §5.9 step 1, §4.1 · Brief [§3.4](../../architecture/audio-pass.md)

## Objective

Make the tool build banks and check them: `yomi-audio sfx build` renders changed cues, enforces the per-variant checks, assembles each bank into an Opus and an MP3 audio sprite with its Phaser JSON, and writes `audio/sfx.manifest.json`; `yomi-audio sfx check` detects stale or altered outputs and budget overruns. Then give the game its whole W1 cue set at once: all 85 cues of C7 as recipes over today's placeholder sounds, built and committed, so step 05 can build the runtime on real banks and a real `CueId` union before any new content exists. Covers R8, R9 (enforcement) and the cue set of R1.

## Requirements and context

- **R8:** sound effects are built by `tools/audio/` from text recipes and committed sources, deterministically; each source carries provenance and an allow-listed licence (`CC0-1.0` or `own`); `npm run sounds:check` detects a stale or altered output and enforces the budgets.
- **R9:** every built sound meets its group's loudness target and true-peak ceiling (C3).
- **AC8:** `npm run sounds:check` passes on a clean tree; editing one recipe without building makes it fail **naming that cue**; a source with licence `CC-BY-4.0` or a wrong SHA-256 makes the build fail; rendering a recipe twice gives identical PCM (pytest; step 01 already has the determinism test, keep it green).
- **AC9:** the build reports, for every variant, loudness within its group's tolerance and true peak under its ceiling; no two variants of a cue correlate above 0.95; shipped SFX at most 3 MB per format; committed sources and clips at most 15 MB; voice at most 4 MB per format.
- **Design §5.9 step 1 (migration order):** runtime first, with today's placeholders: `sources.toml` entries for the placeholder WAVs (licence `own`), one recipe per W1 cue pointing at the nearest placeholder, the banks built. Content steps 08 to 13 later replace these recipes bank by bank.
- The placeholders are synthesized in-house (see `public/assets/audio/README.md`: Python stdlib `wave`, no third-party content), so their licence is `own`.
- Encoded bytes may differ across ffmpeg builds; the check therefore compares input hashes and the manifest's own record of the encoded files, never a fresh encode.

## Dependencies and prerequisites

- **Step 01 (must be done)** provides, as contracts:
  - The uv project `tools/audio/` (Python 3.11, package `yomi_audio`, console script `yomi-audio`, base deps numpy, scipy, soundfile, pyloudnorm; dev group pytest), every command taking `--root <dir>` (default the repo's `audio/`).
  - `yomi-audio source add <file> --id ID --collection C --licence L --author A --url U [--original NAME] [--start S --end E] [--notes N]`: trims, sums to mono, resamples to 48 kHz, writes `audio/sources/<C>/<ID>.flac`, appends a C4 entry with both hashes, refuses a licence outside the allow-list.
  - `yomi-audio impulse build` (`small_room`, `stone_hall`, `open_air` in `audio/impulses/`).
  - `yomi-audio sfx audition <cue>… [--out DIR] [--spectrogram]`: renders variants as WAV, printing each variant's loudness, peak and length.
  - The recipe interpreter (C5), loudness measurement (LUFS-M max, LUFS-I, true peak at 4x oversampling) and normalisation to the group target, `audio/audio.toml` (C3), `audio/sources.toml` (C4), `audio/CLAUDE.md`, and the `.gitignore` entries of C1.
- Read the step 01 execution record for the actual module names before adding to them.
- Environment: `uv`, `ffmpeg` 9 with libopus and libmp3lame (both verified on this machine). Nothing is downloaded in this step.
- No blockers.

### Contracts this step produces (copied from the index; do not change)

**C2 (this step's rows):**

| Command | Step | Does |
| --- | --- | --- |
| `yomi-audio sfx build [--bank B] [--cue C]` | 02 | renders changed cues, checks them (C6), reassembles touched banks, encodes, writes C6 files |
| `yomi-audio sfx check` | 02 | writes nothing; fails on stale or missing outputs and budget overruns (C6) |

npm scripts (host only): `"sounds": "uv run --project tools/audio yomi-audio sfx build"`, `"sounds:check": "uv run --project tools/audio yomi-audio sfx check"`.

**C3 budgets and encode settings (from `audio/audio.toml`):** `gap_ms = 50`; `banks = ["ui", "battle", "world", "stings"]`; `[budgets] sfx_bytes_per_format = 3_000_000`, `sources_bytes = 15_000_000` (`audio/sources` + `audio/voices` together), `voice_bytes_per_format = 4_000_000`; `[encode.sfx] opus_kbps = 64; mp3_q = 5` (mono 48 kHz, Opus VBR, MP3 VBR `-q:a`). Group targets as in C3 (`ui` −26, `step` −30, `release` −22, `impact` −19, `sweetener` −24, `death` −20, `world` −22 LUFS-M max; `sting` −18 LUFS-I; tolerances and peaks there).

**C6. Banks, manifest and check**

- Bank files `public/assets/audio/sfx/<bank>.opus`, `.mp3` and `<bank>.json` in Phaser's audio-sprite shape: `{ "resources": ["<bank>.opus", "<bank>.mp3"], "spritemap": { "<cue>#<k>": { "start": s, "end": s, "loop": false } } }` (seconds; k from 0; variants concatenated in cue then variant order with `gap_ms` of silence).
- `audio/sfx.manifest.json`:

  ```json
  { "version": 1, "tool": "yomi-audio 0.1.0",
    "banks": { "battle": { "durationMs": 121400, "opus": { "bytes": 0, "sha256": "…" }, "mp3": { "bytes": 0, "sha256": "…" } } },
    "cues": { "battle.hit.slash": { "bank": "battle", "markers": ["battle.hit.slash#0", "…"], "durationsMs": [312, "…"], "inputs": "<sha256>" } } }
  ```

  `inputs` hashes the recipe text, every source and impulse file it touches, `audio.toml`, and the tool's version and `uv.lock`.
- Build checks, each failing the build: loudness within the group's tolerance; true peak under its ceiling; length within `max_ms`; DC offset at most 0.5%; no two variants of a cue with peak normalised cross-correlation above 0.95; every source allowed and its hash matching.
- `sfx check` fails when a cue's input hash differs from the manifest, a recipe has no manifest entry or the reverse, a bank file is missing or its hash differs, or a budget (C3) is exceeded. Encoded bytes are compared only against the manifest's own record, never re-encoded.

**C7. The W1 catalogue** (ids, groups and variant counts; cue id = `<bank>.<name>`, recipe at `audio/sfx/<bank>/<name>.toml`, so `world.rune.embed` is `audio/sfx/world/rune.embed.toml`):

| Bank | Group | Cues (variants) |
| --- | --- | --- |
| battle | release | `swing.light` 5, `swing.blade` 5, `swing.heavy` 5, `swing.thrust` 4, `swing.claw` 4, `swing.bite` 3, `shot.bow` 5, `shot.crossbow` 4, `shot.wand` 5, `cast.arcane` 3, `cast.fire` 3, `cast.frost` 3, `cast.storm` 3, `cast.venom` 3, `cast.shadow` 3, `cast.holy` 3, `cast.ward` 3, `ability.spit` 3, `ability.web` 3 |
| battle | impact | `hit.slash` 6, `hit.crush` 6, `hit.pierce` 6, `hit.claw` 5, `hit.magic` 4, `miss.swing` 4, `miss.shot` 4, `miss.magic` 3, `hit.image` 3, `impact.arcane` 4, `impact.fire` 4, `impact.fireball` 3, `impact.frost` 4, `impact.lightning` 3, `impact.acid` 4, `impact.poison` 3, `impact.shadow` 4, `impact.hex` 3, `impact.web` 3, `impact.heal` 3, `impact.buff` 3 |
| battle | sweetener | `armor.metal` 5, `hit.crit` 4, `element.fire` 2, `element.frost` 2, `element.lightning` 2, `element.acid` 2, `element.poison` 2, `element.blight` 2, `heal.small` 3, `regen` 3, `death.hero` 2 |
| battle | death | `death.human` 4, `death.goblinoid` 4, `death.brute` 3, `death.spider` 2, `death.salamander` 2, `death.horror` 1 |
| battle | step | `step.armored` 8, `step.light` 8, `step.heavy` 6, `step.skitter` 4 |
| world | world | `confront` 2, `sighted` 2, `source` 1, `threatened` 2, `captured` 2, `lost` 2, `build` 3, `arrive` 3, `upgrade` 2, `coins` 4, `craft` 3, `rune.embed` 3, `rune.fuse` 2, `rune.extract` 2 |
| ui | ui | `click` 4, `confirm` 3, `back` 3, `tab` 4, `error` 3, `learn` 2, `gear` 6 |
| stings | sting | `victory` 1, `defeat` 1, `level_up` 1 |

A one-variant cue is exempt from the correlation check and from "never repeat".

**Consumed later:** step 05 imports `audio/sfx.manifest.json` (`CueId = keyof typeof manifest.cues`) and loads `public/assets/audio/sfx/<bank>.json` with its `.opus`/`.mp3`; steps 08 to 13 replace recipes and rerun `npm run sounds`. The cue set fixed here must be exactly C7's 85 ids, no W2 cue.

## Scope and implementation guidance

### Tool (`tools/audio/yomi_audio/`)

1. **`sfx build`**
   - Discover recipes under `audio/sfx/<bank>/*.toml`; the bank is the directory, which must be one of `audio.toml`'s `banks`; the cue id is `<bank>.<file stem>`.
   - Compute each cue's `inputs` hash (C6). Render only cues whose hash differs from the manifest, or that `--cue`/`--bank` name (those are always rebuilt). Cues whose hash matches keep their previous PCM: since a bank is reassembled whenever any of its cues changes, either re-render unchanged cues of a touched bank (fine at this size; deterministic) or cache PCM under the gitignored `audio/.audition/` (or another gitignored cache dir added to `.gitignore`). Prefer re-rendering unless it is slow.
   - Per variant, run every C6 check and fail with a message naming the cue and variant (and the measured value against the limit). Collect all failures in a run before exiting non-zero, so one build reports every bad cue.
   - Assemble each touched bank: cues in sorted id order, variants in order, `gap_ms` of silence between markers (and after the last); write the float mix to a temp WAV, encode with ffmpeg to Opus (mono, 48 kHz, `-b:a 64k`, VBR) and MP3 (mono, `-q:a 5`), write the JSON spritemap with start/end in seconds (round to 1 ms), and record bytes and SHA-256 of each encoded file and the bank's `durationMs` in the manifest.
   - Manifest keys and lists are written in a stable order (sorted keys, two-space indent, trailing newline) so rebuilds diff cleanly. `tool` is `yomi-audio <package version>`.
   - Remove manifest entries (and markers) for recipes that no longer exist; a bank with no recipes left is removed with its files.
   - Before writing anything, enforce `sfx_bytes_per_format` over the would-be bank files and `sources_bytes` over `audio/sources` + `audio/voices`.
2. **`sfx check`** writes nothing. Recompute every cue's `inputs` hash and compare; check recipe/manifest set equality; check each bank's three files exist and that the `.opus`/`.mp3` SHA-256 and byte counts match the manifest and that the JSON's spritemap matches the manifest's markers; check the budgets: SFX bytes per format (sum of bank files), sources + voices bytes, and voice bytes per format (sum of `public/assets/voice/*.opus` and `*.mp3` separately; 0 today). Report every failure, naming the cue, bank or budget; exit non-zero on any.
3. **Shared:** the licence and SHA-256 checks of sources (step 01's registry) are applied by `sfx build` for every source a recipe names; `sfx check` also re-verifies source hashes as part of `inputs`.

### Tests (pytest, `tools/audio/tests/`, write them first)

Use a small fixture project (a temp copy of a tiny `audio/`-shaped tree: an `audio.toml`, a `sources.toml` with one or two short synthetic sources, two banks with two or three recipes, its own public output dir passed via `--root` and an output option or derived path; add an option such as `--out <dir>` for the public bank directory if step 01's `--root` does not already cover it, and document it in `audio/CLAUDE.md`):

- Build then check passes; the manifest and bank JSON have the C6 shapes; markers are `<cue>#<k>`, contiguous, separated by `gap_ms`.
- **AC8:** editing one recipe's text without building makes `sfx check` fail with that cue's id in its output; adding a recipe without building fails ("no manifest entry"); deleting a bank file fails; tampering a bank file's bytes fails.
- **AC8:** a source whose `licence` is `CC-BY-4.0` makes `sfx build` fail naming the source; a source whose committed FLAC no longer matches its `sha256` makes it fail.
- A variant forced too loud (peak over ceiling via a recipe that asks for no normalisation headroom, or a monkeypatched target) fails; two identical variants (no variation, `variants = 2`) fail the correlation check; a one-variant cue passes it; a too-long variant fails `max_ms`.
- Budgets: with a tiny budget in the fixture's `audio.toml`, build and check fail naming the budget.
- Incremental: a second build with nothing changed renders no cue (assert by a counter or log line) and leaves the files byte-identical.

### The placeholder catalogue (`audio/`)

1. **Sources.** Add the ten existing WAVs with `yomi-audio source add`, collection `placeholder`, licence `own`, author "Yomi (synthesized placeholder)", url "https://github.com/ginstrom/yomi" (or the README's path), original = the file name, notes "synthesized placeholder; see public/assets/audio/README.md". Ids: `placeholder_melee_swing`, `placeholder_hit_impact`, `placeholder_crit_impact`, `placeholder_miss`, `placeholder_spell_cast`, `placeholder_heal`, `placeholder_unit_death`, `placeholder_ui_click`, `placeholder_victory`, `placeholder_defeat`. They are 22 050 Hz; `source add` resamples them to 48 kHz.
2. **Recipes.** One recipe per C7 cue, 85 files, at `audio/sfx/<bank>/<name>.toml`, with the design's variant count and its C7 group, built over the nearest placeholder:
   - swings, shots, `ability.*` → `placeholder_melee_swing`; `cast.*` → `placeholder_spell_cast`; hits, `armor.metal`, `element.*`, `impact.*` (hostile) → `placeholder_hit_impact`; `hit.crit` → `placeholder_crit_impact`; misses and `hit.image` → `placeholder_miss`; `impact.heal`, `impact.buff`, `heal.small`, `regen`, `world.captured`, `world.arrive`, `world.upgrade`, `world.rune.*`, `ui.learn` → `placeholder_heal`; `death.*`, `world.lost`, `world.threatened` → `placeholder_unit_death`; steps, `ui.*`, `world.coins`, `world.craft`, `world.build` → `placeholder_ui_click`; `stings.victory`, `world.captured`-like fanfares as you judge → `placeholder_victory`; `stings.defeat`, `world.confront`, `world.source`, `world.sighted` → `placeholder_defeat`; `stings.level_up` → `placeholder_victory` (pitched up).
   - Make each variant distinct enough to pass the 0.95 correlation check: per-variant `pitch` ranges of a few semitones, `chance`d or ranged filters, a ranged `start`/`length` trim. Keep each within a `max_ms` near the design's typical length × 1.5 (C7 lists counts; the lengths are in design §4.1). Loudness normalisation to the group is automatic (C5).
   - A throwaway generator script may produce the 85 files; keep it in the session scratchpad, not in the repo. Each recipe gets a one-line comment `# Placeholder over <source>; replaced by step NN` naming its content step (08 melee, 09 ui/stings, 10 shots/magic hits/sweeteners, 11 spells/abilities, 12 falls/steps, 13 world).
3. **Build** with `npm run sounds`, commit `audio/sources/placeholder/*.flac`, the `sources.toml` entries, the 85 recipes, `audio/sfx.manifest.json` and `public/assets/audio/sfx/{ui,battle,world,stings}.{opus,mp3,json}`. Expect the four banks to be far under the 3 MB budget.

### npm, docs

- `package.json` scripts `sounds` and `sounds:check` exactly as in C2.
- Root `CLAUDE.md`: add the two rows to the Commands table ("Build sound banks from `audio/`" `npm run sounds`; "Check built sounds are up to date" `npm run sounds:check`, beside the sprites rows, noting both need uv and ffmpeg on the host and are not part of `npm test`); in "Assets and docs", a sentence that the sound-effect banks in `public/assets/audio/sfx/` and `audio/sfx.manifest.json` are generated from `audio/` by `npm run sounds` and never edited by hand (pointer to `audio/CLAUDE.md`). Do not yet rewrite the `SOUND_KEYS`/`BootScene` lines; step 05 does, as the runtime still plays the WAVs.
- `audio/CLAUDE.md`: a "Building and checking" section: the build's incremental rule, the per-variant checks and their failure messages, the budgets, `--bank`/`--cue`, what `sfx check` compares and why encoded bytes are not re-encoded, that generated files are never hand-edited and a merge conflict in them is resolved by rerunning `npm run sounds`, and that today's recipes are placeholders to be replaced by the content steps.
- `public/assets/audio/README.md`: a section saying `sfx/` holds generated audio sprites built from `audio/` (recipes and provenance in `audio/sources.toml`), currently derived entirely from the placeholder WAVs listed below (licence own); the WAV table stays until step 05 deletes them.

### Exclusions

- Do **not** delete or change anything in `public/assets/audio/` other than adding `sfx/` and the README note; do **not** touch `src/`, `tsconfig.json`, scenes or tests in `src/` (step 05 imports the manifest and removes the WAVs).
- No downloads, no real content, no W2 cues.

## Shared constraints (from the index)

- Node: prefix npm/node commands with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.
- `npm test` (`tsc && vitest run`) must pass before the commit (it is untouched by this step but must stay green); from this step on `npm run sounds:check` must pass too.
- Host-only tooling never enters `npm test` or the podman image.
- Licence allow-list `["CC0-1.0", "own"]`; never commit a downloaded pack.
- Commit on branch `audio-pass` as `Audio pass step 02: banks, check and placeholder catalogue`, without pushing; never switch branches; leave changes that are not this step's out of the commit.
- Audio never touches the battle or world RNG; no `SAVE_VERSION` or `LOG_SCHEMA_VERSION` change.
- No scene changes in this step, so `npm run test:browser` is not required.

## Verification

```sh
cd /Users/ryan/personal/yomi/.claude/worktrees/audio-pass
uv run --project tools/audio pytest tools/audio/tests          # new build/check tests and step 01's, all green
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run sounds         # builds 85 cues, 4 banks, no check failures
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run sounds:check   # passes on the clean tree
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run sounds         # second run renders nothing; git status shows no change
# AC8 by hand: append a comment to audio/sfx/ui/click.toml, run npm run sounds:check -> fails naming ui.click; revert
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test
python3 -c "import json;m=json.load(open('audio/sfx.manifest.json'));print(len(m['cues']))"   # 85
ls -l public/assets/audio/sfx/                                  # sizes per format well under 3 MB in total
```

Record in the execution record: the pytest summary, the build's per-group loudness summary (or a sample), the four banks' byte sizes per format, the cue count, and the AC8 manual check's output.

## Completion criteria

- [ ] `sfx build` and `sfx check` implement C6 (all checks, budgets, incremental build, stable manifest); tests seen failing first, then green.
- [ ] AC8 cases covered by pytest (stale recipe named; CC-BY-4.0 refused; wrong SHA refused) and the manual check recorded.
- [ ] Ten placeholder sources (collection `placeholder`, licence `own`) and exactly the 85 C7 recipes committed; banks and `audio/sfx.manifest.json` built and committed; `npm run sounds:check` passes on a clean tree.
- [ ] `package.json` has `sounds` and `sounds:check` as in C2.
- [ ] Root `CLAUDE.md` (Commands table, Assets and docs), `audio/CLAUDE.md` (Building and checking) and `public/assets/audio/README.md` updated.
- [ ] `npm test` green; one commit; index row 02 set to `done` with the hash.

## Execution record

