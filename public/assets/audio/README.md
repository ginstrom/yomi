# Audio provenance

## The themes

Two recorded tracks, supplied separately as Opus in an `.m4a` container (the
world map's as "Map Motif") and converted with ffmpeg: each `.opus` is the
same Opus stream remuxed into Ogg (no re-encode), and each `.mp3` (LAME VBR
`-q:a 2`) is the fallback for browsers without Opus support.

| File | Played on |
| --- | --- |
| `music_battle.opus`, `music_battle.mp3` | Looping battle theme, stopped when the battle ends |
| `music_world_map.opus`, `music_world_map.mp3` | Looping world map theme, paused under the menu |

### Their level

The themes are not re-encoded; the player brings each to −24 LUFS-I as
played. Measured once (2026-11-14) with
`ffmpeg -nostats -i <file>.opus -filter_complex ebur128=peak=true -f null -`,
the "Integrated loudness I:" value:

| Theme | LUFS-I | LRA | Gain `10^((−24 − I)/20)` |
| --- | --- | --- | --- |
| `music_battle` | −14.2 | 7.9 LU | 0.324 (−9.8 dB) |
| `music_world_map` | −11.7 | 7.3 LU | 0.243 (−12.3 dB) |

They are 2.5 LU apart, more than the 1 LU one shared value allows, so each
has its own gain (`MUSIC_GAIN` in `src/scenes/audioSettings.ts`) and the music
bus's base `MUSIC_BASE` is 1. The placeholders' fixed `MUSIC_VOLUME` was 0.2
for both, which played the battle theme at about −28.2 LUFS and the world
map's at −25.7; both now sit at −24, 4 and 1.7 dB louder.

## `sfx/`: the sound-effect banks

`sfx/` holds generated audio sprites, one per bank (`ui`, `battle`, `world`,
`stings`): `<bank>.opus`, `<bank>.mp3` and `<bank>.json` (Phaser's
audio-sprite map of markers `<cue>#<k>`), which `BootScene` loads and
`src/scenes/soundPlayer.ts` plays by cue. They are built from `audio/` by
`npm run sounds` (recipes in `audio/sfx/`, provenance of every source in
`audio/sources.toml`) and never edited by hand; see `audio/CLAUDE.md`. For now
every cue is derived entirely from the old placeholder tones (synthesized
in-house with Python's stdlib `wave` module, licence own), kept as the
`placeholder_*` sources under `audio/sources/placeholder/`, so the banks
contain no third-party content. The placeholder WAVs that were played
directly before the banks are gone from this folder.
