# Step 08: Content: melee

[Index](index.md) · [Design](../../designs/audio-pass.md) §4.1.1, §4.1.2, §5.2, §5.5, §5.6, §7.2

## Objective

Replace the placeholder recipes of the 13 melee cues with real sound design built from committed CC0 excerpts (Kenney, OpenGameArt) and synthesis, so that a melee exchange in battle sounds at indie-game quality. This is the first content batch and the design's early check on sample quality: its listening review (gate **G3**) sets the style for every later content step, and no content step after this one starts before G3 passes.

Judgement-heavy: sound design by measurement and spectrogram, without ears, for the user to judge.

## Requirements and context

- R2 (battle events sound by the weapon class, outcome and defender's armour), R6 (several variants per cue), R8 (built from text recipes and committed sources with provenance and an allow-listed licence), R9 (each variant meets its group's loudness target and true-peak ceiling), R15 (provenance documented).
- Acceptance touched: AC8 and AC9 (the build and check pass for these cues), and the melee part of design §7.2's listening review.
- The runtime does not change: the cue ids, banks and `CUES` are fixed by steps 02 and 05. Only recipes, sources, the generated bank files and manifest, and the audio README change.

### The cues (from design §4.1.1 and §4.1.2; ids and variant counts per C7)

| Cue | Group | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- | --- |
| `battle.swing.light` | release | 5 | 200 | dagger, shortsword, rapier, bare hands; goblin, kobold, cutthroat | A quick, thin, high whoosh: cloth and air, little low end; a fast flick. |
| `battle.swing.blade` | release | 5 | 300 | sword, Emberblade; captain | A medium whoosh with a faint metallic ring riding its tail. |
| `battle.swing.heavy` | release | 5 | 450 | greatsword, axe, mace, war hammer, staff, halberd; shaman, hobgoblin, brute | A deep, slow whoosh with weight: a low air push, a creak of leather at the start. |
| `battle.swing.thrust` | release | 4 | 250 | spear | A short, rising air stab, tighter than a swing, a wooden shaft rattle. |
| `battle.swing.claw` | release | 4 | 300 | troll, armoured troll, horror, salamander | A swipe: fleshy air, a low breathy grunt under it (pitched-down, filtered). |
| `battle.swing.bite` | release | 3 | 250 | giant spider | A fast hiss into a wet snap of mandibles. |
| `battle.hit.slash` | impact | 6 | 350 | blades, axe, halberd, goblin | A wet flesh/leather cut with a bright metal edge transient and a low thump; small room. |
| `battle.hit.crush` | impact | 6 | 400 | mace, war hammer, staff, bare hands, shaman, hobgoblin | A dull heavy body blow: low thud, cracking wood or bone texture, no edge. |
| `battle.hit.pierce` | impact | 6 | 300 | dagger, rapier, spear, bow, crossbow, kobold | A tight thunk: an arrow or point burying in leather and flesh, a quick high tick at the start. |
| `battle.hit.claw` | impact | 5 | 350 | claws and bites | Tearing: a flesh rip and a slap, rougher and wetter than a slash. |
| `battle.armor.metal` | sweetener | 5 | 300 | layered on a hit on a defender in metal | A clank of plate or mail: a short ringing metal impact, high-passed, with a jingle of rings. |
| `battle.hit.crit` | sweetener | 4 | 500 | layered on any critical (attack, spell, area) | A heavier sub-thump and a bright crack transient, with a short low tail; makes the hit land "twice as hard". |
| `battle.miss.swing` | impact | 4 | 250 | a melee miss | The blade passing through air close by: a doppler-like whoosh-by, no impact. |

Lengths are typical; a recipe's `max_ms` may be up to about 1.5 times the length. Note `battle.hit.pierce` also serves bows and crossbows (step 10 makes the shots, not this hit) and `battle.hit.crit` is layered on spells too, so neither may lean on a sword-specific character. The sweeteners play on top of a hit at the same moment: `battle.armor.metal` and `battle.hit.crit` must sit under and around the hit cues (no long low tail that masks the next blow; leave the hit's transient room).

### Loudness targets (C3, from `audio/audio.toml`)

| Group | Measure | Target | Tolerance | Peak ceiling (dBTP, 4x oversampled) |
| --- | --- | --- | --- | --- |
| `release` | LUFS-M max (400 ms window, padded to 400 ms) | −22 | ±1.0 LU | −3.0 |
| `impact` | LUFS-M max | −19 | ±1.0 LU | −1.0 |
| `sweetener` | LUFS-M max | −24 | ±1.5 LU | −3.0 |

Normalisation to the target is always the last stage of the build; a variant that then peaks over its ceiling fails the build, so transient-heavy hits need a `limit` (or `compress`) in their `[post]` chain.

## Dependencies and prerequisites

- **Step 01** (existing after it): the `yomi-audio` tool (C2) with `source add`, `impulse build` and `sfx audition [--spectrogram]`; the impulses `small_room`, `stone_hall`, `open_air` in `audio/impulses/`; `audio/CLAUDE.md`.
- **Step 02**: `sfx build` and `sfx check`, `npm run sounds` and `npm run sounds:check`; placeholder recipes for all 85 W1 cues, including these 13, at `audio/sfx/battle/<name>.toml`; the banks and `audio/sfx.manifest.json` committed.
- **Step 04**: `docs/implementation-plans/audio-pass/sourcing.md`, the catalogue of downloaded Kenney and OpenGameArt CC0 packs with candidate files per cue, and the packs themselves under `~/.cache/yomi-audio/downloads/<collection>/<pack>/`. If a pack is absent from the cache (another machine, a cleaned cache), download it again from the URL in the catalogue into a new, empty directory of that path.
- **Not needed:** gate G2 (Freesound). This batch uses Kenney, OpenGameArt CC0 and synthesis only. Steps 05 to 07 are not required, but if step 06 is done the user can also hear the batch in game at G3.

## Scope and implementation guidance

### Contracts used (copied from the index; do not change)

- **C2.** Commands: `yomi-audio source add <file> --id ID --collection C --licence L --author A --url U [--original NAME] [--start S --end E] [--notes N]`; `yomi-audio impulse build`; `yomi-audio sfx audition <cue>… [--out DIR] [--spectrogram]`; `yomi-audio sfx build [--bank B] [--cue C]`; `yomi-audio sfx check`. npm scripts `sounds` (`uv run --project tools/audio yomi-audio sfx build`) and `sounds:check` (`… sfx check`). Every command exits non-zero naming the cue or source at fault.
- **C4.** A source entry in `audio/sources.toml`: `id` (`[a-z0-9_]+`, unique), `file` (`sources/<collection>/<id>.flac`), `licence` (allow-list `"CC0-1.0"`, `"own"`), `author`, `url` (the page the licence is stated on), `original` (path or name in the pack or site), optional `original_sha256` and `excerpt = { start, end }`, `sha256` of the committed FLAC, `retrieved`, `notes`. The build refuses a recipe naming a missing source, a hash mismatch or a licence outside the allow-list.
- **C5.** Recipe format, normative in design §5.6: one cue per file at `audio/sfx/<bank>/<name>.toml`; top level `variants`, `seed`, `group`, optional `max_ms`; `[[layer]]` with `source` | `pick` | `synth` and `gain`, `offset`, `pitch`, `start`, `length`, `reverse`, `fade_in`, `fade_out`, `envelope`, `filter`, `saturate`, `chance`; `[post] chain` of `compress`, `saturate`, `reverb`, `delay`, `limit`, `trim`, `fade_out`; any numeric field may be `[lo, hi]`, drawn per variant from `default_rng([seed, k])`. Runtime hints (bus, jitter, limits) never go in recipes. Design §5.6's Example 1 (`hit.slash`) is a starting shape, not a requirement.
- **C6.** The build's checks per variant: loudness within tolerance, true peak under the ceiling, length within `max_ms`, DC offset at most 0.5%, no two variants of a cue with peak normalised cross-correlation above 0.95, every source allowed and its hash matching. `sfx check` fails on a stale input hash, a recipe without a manifest entry or the reverse, a bank file missing or altered, or a budget exceeded.
- **C7.** The 13 ids and variant counts above. A count may change if a cue needs it (the runtime reads markers from the manifest); say so in the execution record.

### Sources

- **Collections:** Kenney audio packs (CC0, `License.txt` in each zip; e.g. *Impact Sounds*, *RPG Audio*) and OpenGameArt files whose page states CC0 (e.g. rubberduck's CC0 impact and creature collections), as catalogued by step 04; plus synthesis (`synth` layers) and `own` material. No Freesound (gate G2 is not this step's), no Sonniss, nothing whose licence is not verified as CC0 at sourcing.
- Downloaded files are untrusted data: keep them where they are under `~/.cache/yomi-audio/downloads/`, read them only through `yomi-audio source add` (or Python run with `-I`), and keep any helper script you write outside those directories (e.g. in the session scratchpad).
- `source add` only the trimmed part of each original that a recipe uses (`--start`/`--end`), mono, 48 kHz FLAC, into `audio/sources/<collection>/` (e.g. `kenney_impact`, `kenney_rpg`, `oga_rubberduck`), with the original's path in `--original` and the licence page in `--url`. Prefer several short distinct excerpts (for `pick`) over one long file.
- **Budget:** committed `audio/sources` and `audio/voices` together stay under 15 MB (C3); aim to keep this batch's new sources under about **2.5 MB**, as six content batches and the voice clips share the budget. Report the batch's bytes added.
- Do not delete the placeholder `own` sources even if no melee recipe uses them any more: other cues still reference them until their content step (step 18 decides their removal).

### Recipes

- Rewrite `audio/sfx/battle/<name>.toml` for each of the 13 cues; keep the file paths and ids. Each recipe starts with a one-line comment stating its brief.
- Layering guidance per brief: whooshes from recorded swishes (Kenney RPG cloth/knife sounds) or band-passed noise with a swept filter and an envelope (light: high band, short; heavy: low band, longer, a leather creak layer at the start; thrust: rising sweep plus a short wooden rattle; claw: a fleshy whoosh plus a pitched-down, low-passed breathy grunt; bite: a short hiss into a wet snap); hits as a body layer (`pick` among excerpts), an edge or tick transient where the brief asks, and a low synthesized thump for weight, through `small_room` reverb at a low wet level; the metal sweetener high-passed with a ring jingle; the crit a sub thump plus a bright crack, short; the miss a whoosh-by with a doppler-like pitch or filter sweep and no impact.
- Variation: `pick` lists of distinct excerpts, `pitch` ranges of a few semitones, `gain`, `offset` and filter ranges, and `chance` on secondary layers, so variants differ audibly and pass the 0.95 correlation check without sounding like different weapons.
- Keep each variant's length close to the brief's (within `max_ms`); trim tails with `trim` and `fade_out`.

### Self-checks without ears (before building)

For each cue, `uv run --project tools/audio yomi-audio sfx audition <cue> --spectrogram --out audio/.audition/08-melee/<cue>/` and:

- read the printed loudness, peak and length of every variant against the group target, the ceiling and the brief's length;
- look at every spectrogram PNG (the Read tool shows images): energy where the brief puts it (a light swing high and short with little below ~300 Hz; a heavy swing with low end and a longer body; a crush with low thud and no bright edge; a slash or pierce with an early bright transient; the metal sweetener mostly above ~2 kHz with a ringing decay; no clicks at layer edges, no DC, no clipped flat tops, no long silent tails);
- compare variants of a cue side by side for audible difference and family resemblance;
- check the impact cues and sweeteners together: a hit and its sweeteners mixed at their group levels should not mask each other's transient (render a sum in the scratchpad if useful).

### Build, check and docs

- `npm run sounds` (rebuilds the `battle` bank and the manifest), then `npm run sounds:check` on the result.
- `public/assets/audio/README.md`: record provenance of the `battle` bank's melee cues: per collection, the packs or files used and their authors and licence pages (the per-source detail stays in `audio/sources.toml`). Keep the README's existing sections for what is still placeholder.
- `audio/CLAUDE.md`: only if this step learns something the workflow section should say (e.g. a good layering pattern or a pitfall); no root `CLAUDE.md` change is expected, as no module, script or rule changes.
- No scene changes: `npm run test:browser` is not required (it may be run to confirm the banks still load).

### Review package for gate G3

Write `audio/.audition/08-melee/` (gitignored): every variant of the 13 cues as 48 kHz WAV (`<cue>/<k>.wav`) and `review.md` with, per cue: its brief, its files, each variant's loudness, peak and length, and a line for the user's verdict (OK / note). Also a "layered" folder with a few hit + sweetener combinations (slash + metal, crush + crit, pierce + metal + crit) as they will sound together. Say in `review.md` how to hear the batch in game when step 06 is done: `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run dev`, open http://localhost:5173, start or load a game, on the world map open the debug console with `~` and run `fight <encounter> <threat>` (e.g. `fight goblin_raid 1`, or `bandit_camp 3` for metal-clad foes).

Exclusions: no other cue's recipe, no runtime code, no change to `CUES`, `audio.toml` or the tool (report a tool bug instead of patching it here, unless it blocks the step; then fix it with a pytest and say so).

## Verification

- `uv run --project tools/audio yomi-audio sfx audition …` metrics for every variant within target ± tolerance and under the ceiling (recorded in `review.md` and summarised in the execution record).
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run sounds` succeeds; `npm run sounds:check` passes on a clean tree.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes (the manifest and marker tests).
- No recipe of the 13 cues names a placeholder source (`grep` the recipes for the placeholder source ids).
- The batch's source bytes added and the total of `audio/sources` + `audio/voices` (under 15 MB) are reported; the shipped SFX bytes per format stay under 3 MB (`sfx check` enforces it).
- Gate **G3**: the user listens to `audio/.audition/08-melee/` (and the game, if step 06 is done) and returns, per cue, OK or a note. Each note is addressed in a follow-up commit ("Audio pass step 08: review fixes"), with the audition package refreshed, until every cue is OK.

## Completion criteria

- [ ] The 13 recipes rewritten from real sources and synthesis; every new source in `audio/sources.toml` with CC0 or own licence and provenance.
- [ ] `npm run sounds`, `npm run sounds:check` and `npm test` pass; budgets respected and reported.
- [ ] `public/assets/audio/README.md` lists this batch's collections and authors.
- [ ] Review package written; one commit "Audio pass step 08: Content: melee" on `audio-pass` (not pushed); index status set to `awaiting review` with the hash.
- [ ] G3 recorded as passed (relayed by the orchestrator), fixes committed; index status `done` with every commit hash. Later content steps (09 to 13) may start only now.

## Execution record

### Round 0: build (2026-11-14)

**Outcome.** The 13 melee recipes are rewritten from CC0 recordings and synthesis; no recipe names a `placeholder_*` source (`grep -l placeholder_ audio/sfx/battle/{swing.*,hit.slash,hit.crush,hit.pierce,hit.claw,armor.metal,hit.crit,miss.swing}.toml` prints nothing). The step waits at gate **G3**.

**Sources.** 82 excerpts added with `yomi-audio source add` (all `CC0-1.0`, each with its original's path, excerpt and both hashes): `kenney_impact` (punch heavy and medium, soft medium, generic light, wood heavy, metal light), `kenney_rpg` (knife slice, chop, creak, cloth), `oga_medicinestorm` (single swings cut from the Dagger, Katana, Axe and Spear swing takes of *Medieval Sound Effects: Weapon Textures*, 192 kHz), `oga_rubberduck` (hits, wood cracks and rattles, grunts, breath, a snap, slime, mud, bangs), `oga_starninjas` (three sword attacks, for the blade's ring), `oga_vehicle` (apple cuts, a paper tear), `oga_artisticdude` (chainmail, light armour, metal ringing, two beetle bites), `oga_bart` (a steam hiss). Twelve excerpts added during the work and then left unused by the final recipes were removed again before the commit (their entries and files; never committed). Bytes: the batch adds **2,067,993** to `audio/sources`; `audio/sources` + `audio/voices` total **2,380,544** of 15,000,000. Shipped banks: `.opus` 1,045,184 and `.mp3` 764,000, under 3,000,000 each (`sfx check`: "within budget"); the `battle` bank is 722,038 / 588,068 bytes.

**Measurements** (`sfx audition --spectrogram`, every variant; the table per variant is in `audio/.audition/08-melee/review.md`):

| Cue | Group | Variants | LUFS-M max | True peak (dBTP) | Length (ms) |
| --- | --- | --- | --- | --- | --- |
| `swing.light` | release −22 | 5 | −22.0 all | −6.0 to −3.3 | 181–205 |
| `swing.blade` | release | 5 | −22.0 all | −8.9 to −4.9 | 290–336 |
| `swing.heavy` | release | 5 | −22.0 all | −8.6 to −7.2 | 548–621 |
| `swing.thrust` | release | 4 | −22.5 to −22.0 | −6.9 to −3.1 | 232–273 |
| `swing.claw` | release | 4 | −22.0 all | −7.8 to −4.9 | 320–356 |
| `swing.bite` | release | 3 | −22.1 to −22.0 | −5.7 to −3.1 | 272–288 |
| `hit.slash` | impact −19 | 6 | −19.0 all | −3.8 to −2.1 | 297–349 |
| `hit.crush` | impact | 6 | −19.0 all | −2.0 to −1.3 | 303–333 |
| `hit.pierce` | impact | 6 | −19.5 to −19.0 | −2.1 to −1.1 | 239–254 |
| `hit.claw` | impact | 5 | −19.7 to −19.0 | −4.9 to −1.0 | 338–390 |
| `armor.metal` | sweetener −24 | 5 | −24.0 all | −8.8 to −7.6 | 284–347 |
| `hit.crit` | sweetener | 4 | −24.0 all | −4.5 to −3.9 | 260–282 |
| `miss.swing` | impact | 4 | −19.0 all | −1.8 to −1.5 | 262–283 |

None of the 13 is reported peak-limited by the final build (the placeholders' impacts were −20.6 to −22.6). Variant counts are unchanged from C7.

**Judging without ears.** Spectrograms of every variant were looked at, and each variant's energy split by band with A-weighting (a scratch script outside the repository): the light swing sits 64–77% in 2–6 kHz with nothing under 500 Hz; the heavy swing 35–81% in 500 Hz–2 kHz with its low push and a 1 kHz creak at the front; the blade's whoosh is mid-band with the ring as faint lines at about 4, 7 and 10 kHz from 70 ms on; the crush has no energy above 3 kHz but a dulled crack; slash and pierce show a broadband edge or tick in their first 30 ms; the metal sweetener has nothing under 500 Hz; the crit is a 62–90 Hz sine drop with the crack above 1.4 kHz in its first 100 ms. Layered sums (slash + metal, crush + crit, pierce + metal + crit, claw + crit, a whole sword blow) keep each hit's transient visible at the front; their sums peak up to +3.3 dBTP before the runtime limiter.

**Iteration notes** (what changed from the first draft, in short): the blade's ring was 30 dB too loud (it outweighed the whoosh above 6 kHz); the heavy swing and the crit were nearly all sub until their sine and brown-noise layers came down; the crush's crack was cut to below 2.8 kHz (it gave an edge the brief forbids) and its 80 Hz tail shortened; `kenney_knife_slice_1` made two slash variants and one claw variant sound like other cues and was dropped; two dagger excerpts (3 and 6) carry a click 30 dB over the swing and were dropped (they pinned the true peak); short hits reached −19 only with a `limit` far under their peak (−11 to −17 dB); DC (0.5 to 0.9%) from short sine drops and low sources was fixed with high-passes; `hit.crit` variants 0 and 3 correlated at 0.951 until the sine's range widened. These lessons are in `audio/CLAUDE.md` ("Sound design without ears").

**Review package for G3** (gitignored): `audio/.audition/08-melee/` with `<cue>/<k>.wav` and `<k>.png` for every variant, `layered/` (eight combinations, scaled −6 dB so a WAV player does not clip), and `review.md` (brief, sources, per-variant loudness, peak and length, a verdict line per cue and per layered file, and how to hear the batch in game with the debug console's `fight`).

**Verification.**

- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test`: 85 files, 1623 tests passed.
- `uv run --project tools/audio pytest tools/audio/tests`: 203 passed.
- `npm run sounds`: built the `battle` bank (the melee cues changed); a second run "nothing changed (85 cues up to date)".
- `npm run sounds:check`: "85 cues and 4 banks up to date, within budget".
- `npm run test:browser` not run: no scene changed.
- No paid calls; no Freesound material (G2 not needed).

**Deviations.** `sfx audition` names its files `<cue>.v<k>.wav`; they were renamed to `<cue>/<k>.wav` as the plan asks. No tool, runtime, `CUES` or `audio.toml` change. `public/assets/audio/README.md` gained a "Real content so far" table by collection and kept the placeholder section for the other cues; `audio/CLAUDE.md` gained the lessons above and says which cues are real.

**For later steps.** G3's verdicts set the style. Free for reuse by steps 10–13: `oga_medicinestorm` swings (a whoosh-by for `miss.shot` too), `kenney_metal_light_*`, `rd_bang_*`, `rd_slime_*`, `rd_mud_*`, `bart_steam_hiss`, the grunts.

Commit: `6ff2d6f` ("Audio pass step 08: Content: melee").
