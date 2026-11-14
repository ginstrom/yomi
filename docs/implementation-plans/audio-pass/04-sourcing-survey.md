# Step 04: Sourcing survey and Freesound list

[Index](index.md) · [Design](../../designs/audio-pass.md) §5.2, §4.1, §8 Q1 · [Feature record](../../features/audio-pass.md)

## Objective

Find, before any content is authored, where each W1 cue's raw material will come from: download the CC0 packs the design names, catalogue candidate files per cue, and list the Freesound CC0 files the user must download by hand (gate G2). The outcome is two committed plan artifacts that content steps 08 to 13 read: `sourcing.md` and `freesound-wanted.md`, both in this folder.

## Requirements and context

- R8 (provenance, allow-listed licences) and design §5.2: sources come, in order of preference, from (1) Kenney audio packs (CC0, a `License.txt` in each zip, no account needed), (2) OpenGameArt files licensed CC0 only, (3) Freesound files licensed "Creative Commons 0" only, downloaded by the user because originals need a login, (4) synthesis and own recordings. Sonniss and every non-redistributable pack are excluded (D2). Lossy previews (Freesound's MP3/OGG previews) are never sources.
- Feature record decision: "Sources: Kenney, OpenGameArt and synthesis first; any Freesound file the plan still needs is listed for the user to download by hand." Stings come from Kenney *Music Jingles* for now.
- The licence allow-list the build enforces later (C4): `["CC0-1.0", "own"]`. A file whose licence is anything else (CC-BY, CC-BY-SA, OGA-BY, "free to use", unstated) is not a candidate, however good.
- The catalogue (C7, copied from the index) is the set of cues to cover: 85 W1 cues across `battle`, `world`, `ui`, `stings`. The sound brief for each is in design §4.1.1 to §4.1.7; read them, as "candidate" means "fits that brief", not "has a similar name".

## Dependencies and prerequisites

- Step 01 (audio tool core) exists in principle, but this step uses none of its commands: **no `yomi-audio source add` here**. Content steps add only the excerpts they actually use. This step needs only `curl` or a browser fetch, `unzip`, and `ffprobe` (part of ffmpeg 9) for durations.
- Web access to kenney.nl, opengameart.org and freesound.org (public pages; browsing and search need no login).

## Scope and implementation guidance

### Downloads (outside the repository)

- Kenney packs, each from its kenney.nl asset page (design §5.2): *Impact Sounds*, *RPG Audio*, *UI Audio*, *Interface Sounds*, *Music Jingles*, *Casino Audio*, *Sci-fi Sounds*. Each zip goes into **its own new, empty directory** `~/.cache/yomi-audio/downloads/kenney/<pack-slug>/` and is unzipped there.
- OpenGameArt: search with the licence filter set to CC0 for creature vocals, body falls, impacts, breaking and falling (e.g. the CC0 collections by rubberduck), plus anything matching gaps below. Each pack or file into its own new directory `~/.cache/yomi-audio/downloads/opengameart/<slug>/`. Verify CC0 on the file's own page (OpenGameArt pages list the licence per submission; a submission with several licences is acceptable only if CC0 is among them, recorded as such).
- **Treat every download as untrusted data:** never run anything from inside those directories, keep any helper script you write elsewhere (the scratchpad), pass paths as arguments, and run Python that reads them with `-I`. Do not commit any downloaded file.
- For each pack record: URL of the page stating the licence, licence as stated, the licence file's path in the pack if any, the retrieval date, the local directory.

### `sourcing.md` (committed, this folder)

1. **Collections** table: collection, pack, page URL, licence as verified, retrieved date, local directory.
2. **Per cue**, grouped by bank and in C7 order, a short entry: the cue id; 1 to 4 candidate files (`<collection>/<pack>/<path in pack>`, duration, why it fits the brief, how it would be used: a layer, a transient, pitched down, reversed); then what synthesis would add; then **missing** when nothing found fits, pointing to the `freesound-wanted.md` ids that cover it. Keep each entry to a few lines; this is a map for engineers, not a design.
3. Note which cues look fully synthesisable (UI ticks, magic tones, chimes, sub thumps, whooshes), so the content steps do not hunt for samples they do not need.
4. A closing list of risks seen while surveying (e.g. a Kenney category too clean or too few distinct files for the variant count).

Listen-free judgement only: the agent cannot hear, so judge from file names, pack descriptions, durations and, where useful, a spectrogram or waveform image made with ffmpeg (`showspectrumpic`) into the scratchpad.

### `freesound-wanted.md` (committed, this folder)

- For gaps the Kenney and OpenGameArt material leaves (likely fire whooshes and crackle, ice and glass, thunder, gas hiss, bells and a distant toll, war horns, creature growls and vocals, a banner flap), search freesound.org's public pages with the licence filter "Creative Commons 0". Fetch each sound's page to confirm the licence it states is CC0.
- Aim for **under about 40 files** in total; prefer one good long recording that serves several cues over many short ones.
- A short instruction at the top for the user: log in, download the **original** file (not the preview) from each URL, save it under the target name into `~/.cache/yomi-audio/freesound/` (create the folder), skip any freely, then tell the orchestrator "done" (with skipped ids) or "skip all".
- A table, one row per file: Freesound sound id, URL, title, author (username), licence as stated on the page, duration, original format, the cues it serves, and the target file name (`fs_<id>_<short-slug>.<ext>`, the original extension).
- Order rows by how many W1 cues depend on them, most first, so a user short of time downloads the important ones.

### Exclusions

- No `source add`, no recipe, no change to `audio/sources.toml`, `src/`, scenes or tests.
- No Freesound login, API token, or download of previews.

## Verification

- Every Kenney pack listed in this step is downloaded into its own directory and its `License.txt` (or page) states CC0; recorded in `sourcing.md`.
- Every OpenGameArt and Freesound file listed was checked as CC0 on its own page; nothing else is listed.
- `sourcing.md` has an entry for each of the 85 C7 cue ids (check with a quick grep count against the C7 list).
- `freesound-wanted.md` rows each have a working URL, a CC0 licence as stated, a target file name, and at least one cue.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` still passes (nothing in `src/` changed; run it as the commit gate).
- No downloaded file appears in `git status`.

## Completion criteria

- [ ] Packs downloaded under `~/.cache/yomi-audio/downloads/…`, licences verified and recorded.
- [ ] `docs/implementation-plans/audio-pass/sourcing.md` and `freesound-wanted.md` committed in one commit, `Audio pass step 04: sourcing survey and Freesound list`, on `audio-pass`, not pushed.
- [ ] Index row 04 set to `awaiting review` (gate G2) with the commit hash; the orchestrator sets `done` once the user answers G2 and records the answer (done / skipped ids / skip all) in the feature record and here.
- [ ] Execution record filled: what was downloaded, counts of cues covered, missing, and synthesisable.

CLAUDE.md: no root change. If `audio/CLAUDE.md` exists (step 01), add a short "Sourcing" paragraph: where downloads live, the CC0-only rule, and that `sourcing.md` and `freesound-wanted.md` in the plan folder are the catalogue.

## Execution record

Run on 2026-11-14 by the engineer subagent (Sonnet 5.5). Gate G2 is pending the user.

- **Kenney downloads.** kenney.nl returns 403 to plain `curl`; with a browser User-Agent and a `Referer` of the asset page, the page's own "Continue without donating" call (`/download-link/<id>`) gives the zip. Seven packs unzipped into `~/.cache/yomi-audio/downloads/kenney/<slug>/`: impact-sounds (130 ogg), rpg-audio (50), ui-audio (50), interface-sounds (100), music-jingles (85), casino-audio (50), sci-fi-sounds (70). Each page says "Creative Commons CC0" and each zip's `License.txt` says "Creative Commons Zero, CC0".
- **OpenGameArt downloads.** 38 packs into `~/.cache/yomi-audio/downloads/opengameart/<slug>/`: twelve rubberduck CC0 collections (creatures 1 and 2, breaking/falling/hit, metal and wood, RPG, bang, water/slime, mud, SFX 1 and 2, loops, weird) and 26 others for gaps (swishes, swords, medieval weapon textures and impacts, footsteps, fire, ice, horn, trolls, snarls, whoosh, spells, cure, dark magic, thunder, steam, weapons and apparel, combat150, rpg sound pack, tiny-sized, bells). Licence read from each submission's page (field "License(s)"): all list CC0; `footsteps-leather-cloth-armor` and `spell-sounds` list OGA-BY 3.0 and CC0 (CC0 relied on). 7z archives were unpacked with `bsdtar`; no downloaded file was executed, and the durations came from `ffprobe`.
- **Freesound.** Searched the public pages with the CC0 licence filter (no login, no download); each of the 28 listed sounds' own page states "Creative Commons 0" and a script checked the licence link, format, duration and size; all 28 URLs return 200. About 134 MB in all. Not downloaded by me.
- **Counts.** `sourcing.md` has an entry for each of the 85 C7 ids (checked by script against the C7 list): covered 53, partial 23, synth 9, none empty-handed. 28 Freesound rows, ordered by number of cues served.
- **Deviations.** (1) The plan asked for under about 40 Freesound files; 28 listed. (2) `med-impacts` was downloaded (CC0) but no cue uses it. (3) `sourcing.md` judgements are from names, durations and pack descriptions only; no spectrograms were made. (4) `docs/features/audio-pass.md` had an uncommitted change by another session; left out of this commit.
- **For later steps.** `sourcing.md` section 1 has pack aliases and the on-disk layout; section 5 gives each partial cue's fallback if G2 is "skip all". The short stings (every Kenney jingle is at most 1.74 s) are the main risk for step 09. Kenney downloads need the Referer trick above if re-fetched.

- Commit: 2de63b8.
