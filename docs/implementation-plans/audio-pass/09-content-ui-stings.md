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

- [ ] Ten recipes rewritten from real sources and/or synthesis; sources added with C4 entries and allowed licences.
- [ ] `npm run sounds`, `npm run sounds:check`, `npm test` and the tool's pytest pass; measurements recorded.
- [ ] `audio/.audition/09-ui-stings/` holds every variant as WAV and a filled-in `review.md`.
- [ ] `public/assets/audio/README.md` lists the new sources.
- [ ] Committed as `Audio pass step 09: interface and stings` on `audio-pass` (not pushed); index status `awaiting review` with the hash.
- [ ] Gate G4 passed (the user's per-cue verdicts recorded below and in the feature record by the orchestrator); review fixes committed; index status `done` with all hashes.

## Execution record

