# Audio provenance

Copied byte-for-byte from `~/play/fantasy-tactics/assets/audio/` (`sfx/` and
`music/`), whose README documents them: synthesized placeholder tones
generated in-house with Python's stdlib `wave` module. No third-party
content, no licence or attribution needed. Mono 16-bit PCM WAV, 22050 Hz.
`sfx_spell_cast.wav` was made here the same way and to the same format: a
rising square-wave sweep from Python's stdlib `wave` module. `sfx_heal.wav`
was made here too, in the same format: a soft two-note sine chime, C5 then G5,
fading out.
The other exception is the battle theme, a recorded track supplied separately as
Opus in an `.m4a` container and converted with ffmpeg: `music_battle.opus` is
the same Opus stream remuxed into Ogg (no re-encode), and `music_battle.mp3`
(LAME VBR `-q:a 2`) is the fallback for browsers without Opus support.

| File | Played on |
| --- | --- |
| `sfx_melee_swing.wav` | Every attack |
| `sfx_hit_impact.wav` | An attack or a spell that hits, and a status's damage at a turn's start |
| `sfx_crit_impact.wav` | A critical hit |
| `sfx_miss.wav` | An attack or a spell that misses |
| `sfx_spell_cast.wav` | Every spell cast |
| `sfx_heal.wav` | A spell that heals or helps its own side |
| `sfx_unit_death.wav` | A unit falls |
| `sfx_ui_click.wav` | Button and tab presses |
| `music_victory.wav` | Victory sting |
| `music_defeat.wav` | Defeat sting |
| `music_battle.opus`, `music_battle.mp3` | Looping battle theme, stopped when the battle ends |

The WAVs are placeholders only, meant to be replaced by a real sound pass.
