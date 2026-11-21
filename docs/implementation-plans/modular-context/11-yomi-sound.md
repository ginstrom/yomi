# Step 11: the `yomi-sound` skill, and `audio/CLAUDE.md` to contracts

- **Plan:** [index.md](index.md) (contracts C1, C2, C4; shared constraints). **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) §4.1 (the `audio` rows), §4.5, §8 stage 4. **Stage:** 4. **Tier:** sonnet engineer, sonnet reviewer.
- **Result:** the sound workflow (commands, a new cue, sourcing, narration) lives in `.claude/skills/yomi-sound/`, `audio/CLAUDE.md` keeps only its contracts plus one pointer line, and every pointer to the moved text lands on the skill.

## 1. Requirements and context

- **R9** (part): the `yomi-sound` skill; `audio/` keeps only its contracts. **R1**: each section that moves has a named destination and nothing is dropped. **R10**: the always-loaded total stays under `ALWAYS_LOADED_LIMIT_BYTES` (8,500); this step adds one skill description.
- No game code, rule, constant or play test changes. Nothing under `audio/` changes except `audio/CLAUDE.md`. No recipe, source, manifest or generated file is touched.
- **Moving text:** gathered lines are moved, not rewritten; trim only to fit the new file. A line may be added only after confirming it in the code. Nothing is dropped.

### The skill (design §4.5)

`.claude/skills/yomi-sound/SKILL.md` frontmatter, verbatim:

```yaml
name: yomi-sound
description: Make or change Yomi's sound effects and narration with the yomi-audio tool: sourcing and licences, recipes, audition, build and check, voicing a line. Use before editing audio/ or a voiced beat.
```

`SKILL.md` (under 4,000 bytes) indexes four supporting files (each under 8,000 bytes), one line each saying when to open it. The full detail stays in `docs/reference/audio.md`, which the files link by section: "Sound design without ears" (read before writing a recipe) and "Designing a voice" (and "Narration engines" for the pins and licences). Also say: run `yomi-asset-check` before handing off (until step 12 creates it, the step's own verification uses `npm run sounds:check`).

| File | Moves from `audio/CLAUDE.md` |
| --- | --- |
| `commands.md` | the Commands table in full (add a source, remove a source, render impulses, audition, build `npm run sounds`, check `npm run sounds:check`, render narration `npm run narration`, design a voice, the tool's tests), the "Run from the repository root (`--root` points elsewhere…)" lead, and "A mistake prints one line naming the cue, source or field at fault and exits 1." |
| `new-cue.md` | "Recipes and the build": the format pointer (`docs/designs/audio-pass.md` §5.6, `tools/audio/yomi_audio/recipe.py`, reference "Recipes", "Building and checking"), *peak-limited* (denser, longer or compressed, not louder), `npm run sounds` incremental by inputs hash, `npm run sounds:check` writes nothing; "Which sound plays when" as procedure (the tables are in `src/scenes/sounds.ts`: `eventSounds`, `worldSounds`, `CUES`, `buttonCue`; `src/scenes/sounds.test.ts` fails on a silent event kind or ability; a new sound = recipe in `sfx/<bank>/`, `npm run sounds`, an entry in `CUES`, the event table that plays it; commit recipe, any new source and generated files together); "Listening" (agents cannot hear; `sfx audition --spectrogram` prints loudness, true peak and length and writes a spectrogram PNG; the user listens from `.audition/`). Also the scenes guide's former sound-effect item, already gathered here or in `yomi-add-content`: "A button that closes or steps back belongs in `BACK_LABELS`" (confirm it is present somewhere after the move). |
| `sourcing.md` | "Sources and licences": the preference order (Kenney, OpenGameArt CC0, Freesound CC0, then synthesis and own recordings; Sonniss and non-redistributable packs excluded), the download folders (`~/.cache/yomi-audio/downloads/<collection>/<pack>/`, `~/.cache/yomi-audio/freesound/`), `source add` (sums to mono, resamples to 48 kHz, records both hashes and the excerpt), checking an excerpt's onset and `--start`/`--end`, and the catalogue (`docs/implementation-plans/audio-pass/sourcing.md`, `freesound-wanted.md`). |
| `narration.md` | "Narration": the `tts` extra (mlx-audio, Apple Silicon, weights in `~/.cache/huggingface/`, about 13 GB, never in the repository); the voiced beat's fields on a cutscene beat in `src/story/cutscenes.ts` (`line`, `voice`, `emotion`, `intensity`, `spoken`, `take` up to three); `narrationProblems` in `src/story/narration.ts`; `npm run narration` with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; edit, render, commit both; Heteronyms (the word list; a respelling is a guess until rendered and auditioned); a new voice and the pins: reference "Designing a voice" and "Narration engines". |

### What stays in `audio/CLAUDE.md` (contracts, design §4.1)

- The intro: text sources for the game's sound; the tool in `tools/audio/` (`yomi_audio`, `yomi-audio`) is **host only**, never part of `npm test` or the podman image; needs `uv` and `ffmpeg`. The pointer to `docs/reference/audio.md` (shortened as fits).
- **Layout** in full, including: generated files never edited by hand (`sfx.manifest.json`, `public/assets/audio/sfx/*`, `voice.manifest.json`, `public/assets/voice/…`), and a merge conflict in them is resolved by taking either side and rerunning `npm run sounds` (or `npm run narration`); `sources.toml` written by the tool, never by hand; the gitignored files.
- From Sources and licences: the allow-list is `CC0-1.0` and `own` (`source add` refuses anything else; a recipe naming a source not allowed, missing or with a different SHA-256 fails to render); never clone a real person's voice; downloads never enter the repository and are untrusted data (scripts elsewhere, read only through the tool or Python with `-I`); only trimmed excerpts are committed, only through `source add`.
- Runtime hints (bus, jitter, voice limits, extra gain) belong in `CUES` in `src/scenes/sounds.ts`, never in a recipe.
- `npm test` fails while a voiced beat's hash differs from `audio/voice.manifest.json` or its files are missing.
- The pointer line (C4, exact): "Commands, a new cue, sourcing and narration: `.claude/skills/yomi-sound/`."

## 2. Dependencies and prerequisites

- Steps 01–10 done. Existing after them (check before starting):
  - `scripts/claudeMd.test.ts` with the C2 caps, frontmatter, budget and name-existence tests (01); `DIRECTORY_LIMIT_BYTES` is still `12_000` (lowered in 13).
  - `.claude/skills/yomi-add-content/` (03, 04), whose `SKILL.md` has a sound-effect row with no file pointing to `audio/CLAUDE.md`, and general rules saying sounds go through `audio/CLAUDE.md`; `story.md` points voiced beats to `audio/CLAUDE.md`; other files (e.g. `ability.md`, `element.md`, `battle-event.md`, `foe.md`, `gear-icon.md`, `spell.md`) may name `audio/CLAUDE.md`.
  - `src/scenes/CLAUDE.md` with the C4 sentence "A sound effect: `audio/CLAUDE.md`, \"Which sound plays when\"." (04).
  - `src/story/CLAUDE.md` trimmed in 04, still saying narration's tooling is in `audio/CLAUDE.md` and "(see `audio/CLAUDE.md`)".
  - `.claude/skills/yomi-sprites/` (10).
- `yomi-asset-check` does not exist yet (12). Stage 4 base for the findability check is the parent of step 10's first commit (recorded by step 10 or 13).

## 3. Scope and implementation guidance

1. Write `.claude/skills/yomi-sound/SKILL.md` and the four files above from the current `audio/CLAUDE.md` text.
2. Trim `audio/CLAUDE.md` to the "What stays" list plus the pointer line.
3. Repoint (search `grep -rn "audio/CLAUDE.md" .claude src docs/reference CLAUDE.md */CLAUDE.md`):
   - `src/scenes/CLAUDE.md`: the sound-effect sentence becomes "A sound effect: `.claude/skills/yomi-sound/new-cue.md`." (C4).
   - `yomi-add-content/SKILL.md`: the sound-effect row points to `.claude/skills/yomi-sound/new-cue.md`; the general rule "sounds through `audio/CLAUDE.md`" becomes `yomi-sound`.
   - `yomi-add-content/story.md`: the voiced-beat pointer → `.claude/skills/yomi-sound/narration.md`.
   - Every other content file naming `audio/CLAUDE.md` for a sound step → `.claude/skills/yomi-sound/new-cue.md` (or `narration.md` for a voice).
   - `src/story/CLAUDE.md`: "Narration's tooling is in `audio/CLAUDE.md`" and "(see `audio/CLAUDE.md`)" → `.claude/skills/yomi-sound/narration.md` where the target text moved; keep `audio/CLAUDE.md` where it still lands on a contract (e.g. the stale-beat rule).
   - `docs/reference/audio.md` line 3 header ("The full detail behind `audio/CLAUDE.md`, which keeps the workflow, the rules…"): one-sentence fix so it says the guide keeps the contracts and `yomi-sound` the workflow. Nothing else in `docs/reference/` changes.
4. **Leave these code comments unedited**, but check that each still lands on text that stays, and report (do not edit) any that no longer does:
   - `scripts/narration.ts:2` "Host only; see audio/CLAUDE.md" (the intro's host-only rule stays).
   - `audio/audio.toml:3` "See audio/CLAUDE.md and docs/designs/audio-pass.md §5.5" (Layout describes `audio.toml`).
   - `audio/sources.toml:4` and `tools/audio/yomi_audio/sources.py:41` (the tool writes the `sources.toml` header; Layout's "written by the tool, never by hand" and the "only through `source add`" contract stay; the trim/mono/resample detail moves to `sourcing.md`). `sources.toml` is tool output: never hand-edit it.
   - `tools/audio/yomi_audio/tts/models.py:6` "Licences were checked … (see audio/CLAUDE.md)" (the intro's pointer to the reference's pinned licences should stay; if it doesn't, say so).
5. **Exclusions:** no change to recipes, sources, manifests, `public/assets/`, `tools/audio/` code, `src/scenes/sounds.ts` or any test of play. No change to `art/`, `e2e/` or the manual (other steps).

## 4. Verification

With `PATH=/opt/homebrew/opt/node@26/bin:$PATH`:

- `npx vitest run scripts/claudeMd.test.ts`: the new `SKILL.md` under 4,000 bytes, each file under 8,000, `name` equals `yomi-sound`, the single-line description under 260 bytes, the always-loaded total under 8,500, and every backticked constant and path in the new and edited `.claude/` files exists (placeholders such as `sfx/<bank>/` are skipped by rule; bare `sfx/…` spans are not repository-prefixed, so write `audio/sfx/…` when a span must be checked).
- `npm test` passes.
- `git status --short audio/ tools/ public/` shows only `audio/CLAUDE.md`.
- `grep -rn "audio/CLAUDE.md" .claude src/*/CLAUDE.md docs/reference` lists only pointers that land on text still in `audio/CLAUDE.md`.
- A quick findability pass on `audio/CLAUDE.md` (the scratch script in the index's shared constraints, base = stage 4 base) should already be empty or justified; step 13 runs it formally.

## 5. Completion criteria

- [ ] `.claude/skills/yomi-sound/` has `SKILL.md`, `commands.md`, `new-cue.md`, `sourcing.md`, `narration.md`, with the verbatim frontmatter.
- [ ] `audio/CLAUDE.md` holds only the listed contracts and the C4 pointer line.
- [ ] Scenes, story and `yomi-add-content` pointers and the `docs/reference/audio.md` header repointed; the five code comments checked and reported.
- [ ] `npm test` passes; one commit `Modular context step 11: yomi-sound skill, audio guide to contracts`, no attribution lines, files staged by path.
- [ ] Index: step 11 `done` with its commit; a `## Step 11` section in `log.md` (C7) with the `audio/CLAUDE.md` before/after bytes and the always-loaded total.

## 6. Execution record

- Wrote `.claude/skills/yomi-sound/` (`SKILL.md` 1,441 bytes; `commands.md` 1,342; `new-cue.md` 1,446; `sourcing.md` 991; `narration.md` 1,258). Text moved, not rewritten; the narration's "Designing a voice"/"Narration engines" pointer now names `docs/reference/audio.md`. `BACK_LABELS` line moved into `new-cue.md`.
- Trimmed `audio/CLAUDE.md` 6,726 -> 2,211 bytes (intro, Layout, a Contracts list, the C4 pointer line). Shortened the reference pointer in the intro.
- Repointed `src/scenes/CLAUDE.md`, `src/story/CLAUDE.md` (both pointers), `yomi-add-content` `SKILL.md` (row and general rule) and `story.md`, and the `docs/reference/audio.md` header. No other content file named `audio/CLAUDE.md`.
- Code comments checked, unedited: `scripts/narration.ts:2` (host-only rule stays), `audio/audio.toml:3` (Layout describes `audio.toml`), `audio/sources.toml:4` and `tools/audio/yomi_audio/sources.py:41` ("written by the tool, never by hand" stays in Layout; the trim/mono/resample detail is now in `sourcing.md`, so those two comments land on a pointer that still holds but not on the detail), `tools/audio/yomi_audio/tts/models.py:6` (the intro still points to the reference's pinned licences).
- `npx vitest run scripts/claudeMd.test.ts` 17 passed; `npm test` 98 files, 2,419 tests pass. The `yomi-sound` frontmatter verbatim; `git status` under `audio/`, `tools/`, `public/` shows only `audio/CLAUDE.md`.
