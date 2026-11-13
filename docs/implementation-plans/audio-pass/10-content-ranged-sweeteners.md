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

