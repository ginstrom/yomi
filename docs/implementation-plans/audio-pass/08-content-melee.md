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
