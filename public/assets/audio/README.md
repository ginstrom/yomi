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
tool's own reverb impulses. Third-party content in the banks so far (each step's
rows list every collection it draws on, those an earlier step used included):

| Bank: cues | Collection | Author | Pack, licence page (CC0) |
| --- | --- | --- | --- |
| `battle`: the 13 melee cues (`swing.*`, `hit.slash`, `hit.crush`, `hit.pierce`, `hit.claw`, `armor.metal`, `hit.crit`, `miss.swing`; step 08) | `kenney_impact` | Kenney (kenney.nl) | Impact Sounds, https://kenney.nl/assets/impact-sounds |
| | `kenney_rpg` | Kenney (kenney.nl) | RPG Audio, https://kenney.nl/assets/rpg-audio |
| | `oga_medicinestorm` | Ben Jaszczak & Brian Nelson (submitted by MedicineStorm) | Medieval Sound Effects: Weapon Textures, https://opengameart.org/content/medieval-sound-effects-weapon-textures |
| | `oga_rubberduck` | rubberduck | 75 CC0 breaking/falling/hit sfx, 100 CC0 metal and wood sfx, 80 CC0 creature sfx (1 and 2), 40 CC0 water/splash/slime sfx, 25 CC0 mud sfx, 25 CC0 bang/firework sfx: https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx, …/100-cc0-metal-and-wood-sfx, …/80-cc0-creature-sfx, …/80-cc0-creture-sfx-2, …/40-cc0-water-splash-slime-sfx, …/25-cc0-mud-sfx, …/25-cc0-bang-firework-sfx |
| | `oga_starninjas` | starninjas | 20 Sword Sound Effects, https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes |
| | `oga_vehicle` | vehicle | Fantasy Sound Effects (Tinysized SFX), https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx |
| | `oga_artisticdude` | artisticdude | RPG Sound Pack, https://opengameart.org/content/rpg-sound-pack |
| | `oga_bart` | bart | Steam release sounds, https://opengameart.org/content/steam-release-sounds |
| `battle`: 15 cues for shots, magic hits and sweeteners (`shot.bow`, `shot.crossbow`, `shot.wand`, `hit.magic`, `miss.shot`, `miss.magic`, `hit.image`, `element.*`, `heal.small`, `regen`; step 10) | `oga_medicinestorm` | Ben Jaszczak & Brian Nelson (submitted by MedicineStorm) | Medieval Sound Effects: Weapon Textures (bow and crossbow shots, arrow and bolt passes), https://opengameart.org/content/medieval-sound-effects-weapon-textures |
| | `oga_untamedpixels` | untamedpixels (files CC0 per the pack's `LICENSES.txt`) | 150 Combat Sound Effects (electric zaps and sparks), https://opengameart.org/content/150-combat-sound-effects |
| | `oga_rubberduck` | rubberduck | 25 CC0 bang/firework sfx, 75 CC0 breaking/falling/hit sfx (glass), 40 CC0 water/splash/slime sfx (bubbles, slime), 25 CC0 mud sfx: https://opengameart.org/content/25-cc0-bang-firework-sfx, …/75-cc0-breaking-falling-hit-sfx, …/40-cc0-water-splash-slime-sfx, …/25-cc0-mud-sfx |
| | `kenney_impact` | Kenney (kenney.nl) | Impact Sounds (glass, bell, soft), https://kenney.nl/assets/impact-sounds |
| | `kenney_rpg` | Kenney (kenney.nl) | RPG Audio (metalClick, creak), https://kenney.nl/assets/rpg-audio |
| | `kenney_interface` | Kenney (kenney.nl) | Interface Sounds (pluck), https://kenney.nl/assets/interface-sounds |
| | `oga_themightyglider` | themightyglider | Catching Fire, https://opengameart.org/content/catching-fire |
| | `oga_antumdeluge` | antumdeluge | Fire Crackling, https://opengameart.org/content/fire-crackling |
| | `oga_ignasd` | ignasd | Ice Breaking/Shattering, https://opengameart.org/content/ice-breakingshattering |
| | `oga_pwl` | pwl | Bell Dings/Chimes, https://opengameart.org/content/bell-dingschimes |
| | `oga_qubodup` | qubodup | 3 Dark Magic Spells, https://opengameart.org/content/3-dark-magic-spells |
| | `oga_someoneman` | someoneman | Cure Magic, https://opengameart.org/content/cure-magic |
| | `oga_bart` | bart | Steam release sounds, https://opengameart.org/content/steam-release-sounds |
| | `freesound` | MaddieCooper | Freesound 811615 "WET SLAP NOISE", https://freesound.org/people/MaddieCooper/sounds/811615/ (Creative Commons 0, checked on the page; original downloaded by hand, five excerpts kept) |
| `battle`: 22 spell and area-ability cues (`cast.*`, `impact.*`, `ability.spit`, `ability.web`; step 11) | `freesound` | hnhnh; AslakHostaker; Julien_Matthey; julianmateo_; rayjensen; TRP; JesterWhoo; JOHNWALLY; xkeril; bassimat | Freesound 244926 "fire-whoosh.wav", 395038 "Flamethrower_Weapon_Short_Medium_Bursts.wav", 346917 "JM_FX_Fireball 02.wav", 522705 "Fireball, Woosh, Pass, fast", 200990 "thunder-crack", 616992 "Thunder, crack, pretty close", 706977 "Angry snake hissing", 32805 "spooky dark pad.wav", 685680 "Humming in F# Minor", 867251 "Deep Rumbling Drone": https://freesound.org/people/hnhnh/sounds/244926/, …/AslakHostaker/sounds/395038/, …/Julien_Matthey/sounds/346917/, …/julianmateo_/sounds/522705/, …/rayjensen/sounds/200990/, …/TRP/sounds/616992/, …/JesterWhoo/sounds/706977/, …/JOHNWALLY/sounds/32805/, …/xkeril/sounds/685680/, …/bassimat/sounds/867251/ (each Creative Commons 0, checked on its page; originals downloaded by hand at gate G2) |
| | `oga_untamedpixels` | lentikula (Basic Spell Impacts and Healing Spell Impacts, itch.io; compiled as CC0 in untamedpixels' pack) | 150 Combat Sound Effects (fire, ice, lightning and healing spell impacts), https://opengameart.org/content/150-combat-sound-effects |
| | `oga_legitaudio` | LEGIT Audio | Fire Staff Sound Effects, https://opengameart.org/content/fire-staff-sound-effects |
| | `oga_artisticdude` | artisticdude | Freeze Spell, https://opengameart.org/content/freeze-spell-0; Swishes Sound Pack, https://opengameart.org/content/swishes-sound-pack |
| | `oga_bart` | bart (from a public-domain recording by Stephan at pdsounds) | Ice Spells, https://opengameart.org/content/ice-spells; Steam release sounds, https://opengameart.org/content/steam-release-sounds |
| | `oga_vehicle` | vehicle | Fantasy Sound Effects (Tinysized SFX: match strike, air spray, tube whooshes, paper tear), https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx |
| | `oga_rubberduck` | rubberduck | 100 CC0 SFX 2 (air, thunder), 40 CC0 water/splash/slime sfx (splashes, slime, bubbles), 80 CC0 creature sfx (spit, breath), 75 CC0 breaking/falling/hit sfx (glass), 25 CC0 mud sfx, 25 CC0 bang/firework sfx: https://opengameart.org/content/100-cc0-sfx-2, …/40-cc0-water-splash-slime-sfx, …/80-cc0-creature-sfx, …/75-cc0-breaking-falling-hit-sfx, …/25-cc0-mud-sfx, …/25-cc0-bang-firework-sfx |
| | `oga_qubodup` | qubodup | 3 Dark Magic Spells, https://opengameart.org/content/3-dark-magic-spells |
| | `oga_pwl` | pwl | Bell Dings/Chimes, https://opengameart.org/content/bell-dingschimes |
| | `oga_themightyglider` | themightyglider | Catching Fire, https://opengameart.org/content/catching-fire |
| | `oga_antumdeluge` | antumdeluge | Fire Crackling, https://opengameart.org/content/fire-crackling |
| | `oga_ignasd` | ignasd | Ice Breaking/Shattering, https://opengameart.org/content/ice-breakingshattering |
| | `kenney_impact` | Kenney (kenney.nl) | Impact Sounds (glass, punch, soft), https://kenney.nl/assets/impact-sounds |
| `battle`: 11 cues for falls and footsteps (`death.*`, `step.*`; step 12) | `freesound` | TRP; tonsil5; TicAshfield; JesterWhoo; bassimat; rayjensen; JOHNWALLY | Freesound 616622 "Raccoon, bark, screech, yelp, squeal", 555423 "Zombie Pain 2.wav", 824588 "St Peters Church, Kinver - Distant Tolling Bell", and again 706977 "Angry snake hissing", 867251 "Deep Rumbling Drone", 200990 "thunder-crack", 32805 "spooky dark pad.wav": https://freesound.org/people/TRP/sounds/616622/, …/tonsil5/sounds/555423/, …/TicAshfield/sounds/824588/, …/JesterWhoo/sounds/706977/, …/bassimat/sounds/867251/, …/rayjensen/sounds/200990/, …/JOHNWALLY/sounds/32805/ (each Creative Commons 0, checked on its page; originals downloaded by hand at gate G2) |
| | `oga_darsycho` | Darsycho | Big Scary Troll Sounds, https://opengameart.org/content/big-scary-troll-sounds; Monster Snarls, https://opengameart.org/content/monster-snarls |
| | `oga_rubberduck` | rubberduck | 80 CC0 creature sfx (1 and 2: hurt, die, breath, bug, monster), 75 CC0 breaking/falling/hit sfx (falling rock and metal), 100 CC0 metal and wood sfx (wood cracking), 40 CC0 water/splash/slime sfx (splashes, slime): https://opengameart.org/content/80-cc0-creature-sfx, …/80-cc0-creture-sfx-2, …/75-cc0-breaking-falling-hit-sfx, …/100-cc0-metal-and-wood-sfx, …/40-cc0-water-splash-slime-sfx |
| | `oga_artisticdude` | artisticdude | RPG Sound Pack (chainmail, light armour, giant), https://opengameart.org/content/rpg-sound-pack |
| | `oga_vehicle` | vehicle | Fantasy Sound Effects (Tinysized SFX: twigs breaking), https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx |
| | `oga_qubodup` | qubodup | 3 Dark Magic Spells, https://opengameart.org/content/3-dark-magic-spells |
| | `oga_antumdeluge` | antumdeluge | Fire Crackling, https://opengameart.org/content/fire-crackling |
| | `oga_bart` | bart | Steam release sounds, https://opengameart.org/content/steam-release-sounds |
| | `kenney_rpg` | Kenney (kenney.nl) | RPG Audio (footsteps, dropLeather, cloth), https://kenney.nl/assets/rpg-audio |
| | `kenney_impact` | Kenney (kenney.nl) | Impact Sounds (grass footsteps, soft, punch and light metal impacts), https://kenney.nl/assets/impact-sounds |
| `ui`: all 7 cues (`click`, `back`, `confirm`, `tab`, `error`, `learn`, `gear`; step 09) | `kenney_ui` | Kenney (kenney.nl) | UI Audio, https://kenney.nl/assets/ui-audio |
| | `kenney_interface` | Kenney (kenney.nl) | Interface Sounds, https://kenney.nl/assets/interface-sounds |
| | `kenney_rpg` | Kenney (kenney.nl) | RPG Audio, https://kenney.nl/assets/rpg-audio |
| | `kenney_impact` | Kenney (kenney.nl) | Impact Sounds, https://kenney.nl/assets/impact-sounds |
| | `oga_rubberduck` | rubberduck | 100 CC0 SFX, https://opengameart.org/content/100-cc0-sfx |
| | `oga_vehicle` | vehicle | Fantasy Weapons and Apparel SFX Library, https://opengameart.org/content/fantasy-weapons-and-apparel-sfx-library |
| | `oga_artisticdude` | artisticdude | RPG Sound Pack, https://opengameart.org/content/rpg-sound-pack |
| `stings`: `victory`, `defeat`, `level_up` (step 09) | `kenney_jingles` | Kenney (kenney.nl) | Music Jingles, https://kenney.nl/assets/music-jingles (a sax and a pizzicato jingle, extended with synthesized brass, strings, timpani and bells) |

The clicks' bodies, the mallet and bell notes and the stings' chords and
drums are synthesis (own), as are the wand's and the magic hit's crackle and
fizz, the element sweeteners' snaps and sizzles, the blight chime's partials
and the small heal's rising tones (step 10), and in the spells (step 11) the
sub booms and noise bursts, the storm cast's rising buzz and static, the
arcane hum and pop, the hex's falling tones and shimmer, and the heal's and
buff's FM bells; in the falls and steps (step 12) the brute's and the Horror's sub sweeps and brown-noise rumble, the salamander's sparks, the light step's brush of noise, the skitter's scrape and the toll's string drone (detuned saws).

Freesound files used so far: 811615 (`battle.regen`, step 10); 244926,
395038, 346917, 522705 (fire: `cast.fire`, `impact.fire`, `impact.fireball`,
`ability.spit`), 200990, 616992 (`impact.lightning`), 706977
(`ability.spit`, `cast.venom`), 32805 (`cast.shadow`, `impact.shadow`),
685680 (`cast.holy`) and 867251 (`impact.poison`) (step 11); 616622
(`death.goblinoid`), 555423 (`death.brute`), 824588 (`death.hero`), and
again 706977 (`death.salamander`), 867251 and 200990 (`death.horror`) and
32805 (`death.hero`) (step 12). The others of the 28 downloaded at gate G2
serve step 13 (171844 and 846337 were auditioned for step 12 and left out:
a low hum under the scream; a steady tone under a very quiet hiss).

### Still placeholder

Every other cue is still derived entirely from the old placeholder tones
(synthesized in-house with Python's stdlib `wave` module, licence own), kept
as the `placeholder_*` sources under `audio/sources/placeholder/`, until its
content step (13: the `world` bank). The placeholder WAVs that were played directly
before the banks are gone from this folder.
