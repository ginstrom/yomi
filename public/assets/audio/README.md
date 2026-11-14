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
`audio/sources.toml`) and never edited by hand; see `audio/CLAUDE.md`.

### Real content so far

Only CC0 recordings are used, as trimmed mono excerpts committed under
`audio/sources/<collection>/` (each one's original file, excerpt, hashes and
licence page in `audio/sources.toml`), with synthesis (`synth` layers) and the
tool's own reverb impulses. Third-party content in the banks so far:

| Bank: cues | Collection | Author | Pack, licence page (CC0) |
| --- | --- | --- | --- |
| `battle`: the 13 melee cues (`swing.*`, `hit.slash`, `hit.crush`, `hit.pierce`, `hit.claw`, `armor.metal`, `hit.crit`, `miss.swing`; step 08) | `kenney_impact` | Kenney (kenney.nl) | Impact Sounds, https://kenney.nl/assets/impact-sounds |
| | `kenney_rpg` | Kenney (kenney.nl) | RPG Audio, https://kenney.nl/assets/rpg-audio |
| | `oga_medicinestorm` | medicinestorm | Medieval Sound Effects: Weapon Textures, https://opengameart.org/content/medieval-sound-effects-weapon-textures |
| | `oga_rubberduck` | rubberduck | 75 CC0 breaking/falling/hit sfx, 100 CC0 metal and wood sfx, 80 CC0 creature sfx (1 and 2), 40 CC0 water/splash/slime sfx, 25 CC0 mud sfx, 25 CC0 bang/firework sfx: https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx, …/100-cc0-metal-and-wood-sfx, …/80-cc0-creature-sfx, …/80-cc0-creture-sfx-2, …/40-cc0-water-splash-slime-sfx, …/25-cc0-mud-sfx, …/25-cc0-bang-firework-sfx |
| | `oga_starninjas` | starninjas | 20 Sword Sound Effects, https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes |
| | `oga_vehicle` | vehicle | Fantasy Sound Effects (Tinysized SFX), https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx |
| | `oga_artisticdude` | artisticdude | RPG Sound Pack, https://opengameart.org/content/rpg-sound-pack |
| | `oga_bart` | bart | Steam release sounds, https://opengameart.org/content/steam-release-sounds |
| `ui`: all 7 cues (`click`, `back`, `confirm`, `tab`, `error`, `learn`, `gear`; step 09) | `kenney_ui` | Kenney (kenney.nl) | UI Audio, https://kenney.nl/assets/ui-audio |
| | `kenney_interface` | Kenney (kenney.nl) | Interface Sounds, https://kenney.nl/assets/interface-sounds |
| | `kenney_rpg` | Kenney (kenney.nl) | RPG Audio, https://kenney.nl/assets/rpg-audio |
| | `kenney_impact` | Kenney (kenney.nl) | Impact Sounds, https://kenney.nl/assets/impact-sounds |
| | `oga_rubberduck` | rubberduck | 100 CC0 SFX, https://opengameart.org/content/100-cc0-sfx |
| | `oga_vehicle` | vehicle | Fantasy Weapons and Apparel SFX Library, https://opengameart.org/content/fantasy-weapons-and-apparel-sfx-library |
| | `oga_artisticdude` | artisticdude | RPG Sound Pack, https://opengameart.org/content/rpg-sound-pack |
| `stings`: `victory`, `defeat`, `level_up` (step 09) | `kenney_jingles` | Kenney (kenney.nl) | Music Jingles, https://kenney.nl/assets/music-jingles (a sax and a pizzicato jingle, extended with synthesized brass, strings, timpani and bells) |

The clicks' bodies, the mallet and bell notes and the stings' chords and
drums are synthesis (own).

### Still placeholder

Every other cue is still derived entirely from the old placeholder tones
(synthesized in-house with Python's stdlib `wave` module, licence own), kept
as the `placeholder_*` sources under `audio/sources/placeholder/`, until its
content step (10 to 13). The placeholder WAVs that were played directly
before the banks are gone from this folder.
