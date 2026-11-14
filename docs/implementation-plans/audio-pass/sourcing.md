# Sourcing map: where each W1 cue's raw material comes from

[Index](index.md) · [Step 04](04-sourcing-survey.md) · [Freesound list](freesound-wanted.md) · [Design](../../designs/audio-pass.md) §5.2, §4.1

Read by content steps 08 to 13. It is a map, not a design: judged from file names, pack descriptions and durations (the surveying agent cannot hear), so every candidate still gets auditioned by the content step. Nothing here is a source yet: no `yomi-audio source add` has run, and `audio/sources.toml` is untouched. Retrieved 2026-11-14.

## 1. Collections

Every pack below was downloaded into its own new directory under `~/.cache/yomi-audio/downloads/<collection>/<pack>/` (nothing is committed) and its licence read on the page it came from. Kenney's zips each carry a `License.txt` ("Creative Commons Zero, CC0"). OpenGameArt shows the licence per submission; each page below lists CC0. Two submissions list two licences, CC0 among them, recorded as such. The **alias** is how section 2 names a pack; paths are `<collection>/<pack>/<file>`, and where a pack unzips into subfolders the layout column says which.

### Kenney (collection `kenney`, author "Kenney (kenney.nl)", licence CC0-1.0)

| Alias | Pack (directory) | Licence page | Files | Layout |
| --- | --- | --- | --- | --- |
| `k-impact` | `impact-sounds` | https://kenney.nl/assets/impact-sounds | 130 ogg | `Audio/footstep_<surface>_00N`, `impact<Material>_<weight>_00N` (Bell, Generic, Glass, Metal, Mining, Plank, Plate, Punch, Soft, Tin, Wood) |
| `k-rpg` | `rpg-audio` | https://kenney.nl/assets/rpg-audio | 50 ogg | `Audio/` (belt, book, chop, cloth, creak, door, drawKnife, dropLeather, footstep00-09, handleCoins, handleSmallLeather, knifeSlice, metalClick, metalLatch, metalPot) |
| `k-ui` | `ui-audio` | https://kenney.nl/assets/ui-audio | 50 ogg | `Audio/click1-5`, `mouseclick1`, `mouserelease1`, `rollover1-6`, `switch1-38` |
| `k-iface` | `interface-sounds` | https://kenney.nl/assets/interface-sounds | 100 ogg | `Audio/` (back, bong, click, close, confirmation, drop, error, glass, maximize, minimize, open, pluck, question, scratch, scroll, select, switch, tick, toggle, glitch) |
| `k-jingles` | `music-jingles` | https://kenney.nl/assets/music-jingles | 85 ogg | `Audio/<family> jingles/jingles_<NES\|HIT\|PIZZI\|SAX\|STEEL>00-16` (17 each; all 0.28 to 1.74 s) |
| `k-casino` | `casino-audio` | https://kenney.nl/assets/casino-audio | 50 ogg | `Audio/` (card-*, chip-lay, chips-collide, chips-handle, chips-stack, dice-*) |
| `k-scifi` | `sci-fi-sounds` | https://kenney.nl/assets/sci-fi-sounds | 70 ogg | `Audio/` (laserSmall/Large/Retro, forceField, explosionCrunch, lowFrequency_explosion, slime, impactMetal, doorOpen/Close, engines) |

Licence text in each: `License.txt` at the pack root ("License: (Creative Commons Zero, CC0)").

### OpenGameArt, rubberduck's CC0 collections (collection `opengameart`, author `rubberduck`, licence CC0 as stated on each page)

| Alias | Pack (directory), page `https://opengameart.org/content/<directory>` | Files | Layout |
| --- | --- | --- | --- |
| `rd-creature1` | `80-cc0-creature-sfx` | 80 ogg | flat: alien, barking, breath, bug_01-04, burble, burp, cough, cute, eat, grunt_01-05, howl, hurt_01-05, misc, monster_01-07, roar_01-03, scream_01-02, spit_01-03, troll_01-03, weird |
| `rd-creature2` | `80-cc0-creture-sfx-2` | 80 ogg | flat: alien_07-12, attack_01-05, breath_02, bug_05-13, die_01-04, grunt_06-09, human_01-08, monster_08-20, roar_04-06, slime_01-08, stomp_01, weird_06-09 |
| `rd-bfh` | `75-cc0-breaking-falling-hit-sfx` | 75 ogg | flat: `bfh1_<breaking\|falling\|hit>_NN` of glass, metal, rock, wood and plain |
| `rd-metalwood` | `100-cc0-metal-and-wood-sfx` | 100 ogg | flat: hammer_01-04, keys, metal_hit/sheet/slam/spring/falling, misc, tools_01-12, wood_breaking/cracking/falling/hammer/hit/misc/slam/squeak |
| `rd-rpg` | `80-cc0-rpg-sfx` | 80 ogg | flat: blade, book, chain, creature_*, item_coins, item_gem_01-04, item_stone, item_wood, lock, metal, spell_01-02, spell_fire_01-07, stones, wood |
| `rd-bang` | `25-cc0-bang-firework-sfx` | 25 ogg | flat: bang_01-10, cannon_01-05, fw_01-06, shot_01-03 |
| `rd-water` | `40-cc0-water-splash-slime-sfx` | 40 ogg | flat: bubble_01-03, slime_01-16, splash_01-15, loop_* |
| `rd-mud` | `25-cc0-mud-sfx` | 25 ogg | flat: mud_01-25 |
| `rd-sfx1` | `100-cc0-sfx` | 100 ogg | flat: bell_01-03, glass_01-05, gong_01-02, hit, metal, paper_01-04, slam, splash, spring, switch, wooden, other, weird |
| `rd-sfx2` | `100-cc0-sfx-2` | 100 ogg | flat: `sfx100v2_*`: air_01-03, footstep_01-02, footstep_wet, footstep_wood, glass, hit, misc_01-37, stones, thunder_01, wood |
| `rd-loops` | `30-cc0-sfx-loops` | 30 ogg | flat: alarm, ambient, machine, noise, pump, rain, saw, water_* |
| `rd-weird` | `30-weird-cc0-sfx` | 30 ogg | flat: weird_01-30 |

### OpenGameArt, other authors

| Alias | Pack (directory), page `https://opengameart.org/content/<directory>` | Author | Licence on page | Layout |
| --- | --- | --- | --- | --- |
| `swishes` | `swishes-sound-pack` | artisticdude | CC0 | `swishes/swishes/swish-1..13.wav` (0.07 to 0.2 s) |
| `swords20` | `20-sword-sound-effects-attacks-and-clashes` | starninjas | CC0 | `sword_-_starninjas_1/sword.1-10.ogg`, `sword_clash_-_starninjas_0/sword_clash.1-10.ogg` |
| `med-textures` | `medieval-sound-effects-weapon-textures` | medicinestorm | CC0 | `medieval_sfx_textures_1_of_2/` and `_2_of_2/` (long recordings, 2 to 47 s, several actions each: swings, longbow, recurve, crossbow, passbys) |
| `med-impacts` | `medieval-sound-effects-weapon-impacts` | medicinestorm | CC0 | weapon-on-weapon, 4 to 22 s each (not planned for use; clashes are not in the catalogue) |
| `foot-leather-armor` | `footsteps-leather-cloth-armor` | haeldb | **OGA-BY 3.0 and CC0** (CC0 is the one relied on) | `footsteps/footsteps/step_{cloth,lth,metal}*.ogg` (0.19 to 0.25 s) |
| `firestaff` | `fire-staff-sound-effects` | legit-audio | CC0 | `legit_audio_fire_staff_-_free_0/LEGIT Audio_FIRE STAFF - FREE/Wavs/*.wav` (25 files, 8.5 and 17 s) |
| `fire-crackling` | `fire-crackling` | antumdeluge | CC0 | `fire-1.ogg`, `fire-1.wav` (2.9 to 3.6 s) |
| `catching-fire` | `catching-fire` | themightyglider | CC0 | `flame.ogg` (0.45 s) |
| `ice-shatter` | `ice-breakingshattering` | ignasd | CC0 | `IceShatters_0/IceShatters/LedasLuzta*.ogg` (0.4 to 1.3 s) |
| `ice-spells` | `ice-spells` | bart | CC0 | `icespells/ice.wav` (1.2 s), `coldsnap.wav` (2.7 s) |
| `freeze-spell` | `freeze-spell-0` | artisticdude | CC0 | `freeze.wav` (2.1 s) |
| `horn-theircoming` | `their-coming-generic-horn-sound` | stumpystrust | CC0 | `theircoming.ogg` (14 s), `theircoming3.ogg` (5.2 s) |
| `troll-sounds` | `big-scary-troll-sounds` | darsycho | CC0 | `troll-roars.ogg` (10.9 s), `troll-idle-noises.ogg` (25.7 s), `scrapped-troll-sounds.ogg` (10 s) |
| `monster-snarls` | `monster-snarls` | darsycho | CC0 | five long recordings, 7 to 19 s |
| `air-whoosh` | `air-whoosh` | pyranostudios | CC0 | `whoosh2_0.wav` (5.3 s) |
| `magic-spell-sfx` | `magic-spell-sfx` | jaggedstone | CC0 | `magical_1..7.ogg` (1.1 to 2.4 s) |
| `spell-sounds` | `spell-sounds` | haeldb | **OGA-BY 3.0 and CC0** (CC0 relied on) | `electricspell*.ogg` (21 s), `healing.ogg` (22.5 s), `teleport.ogg` |
| `cure-magic` | `cure-magic` | someoneman | CC0 | `curemagic/Cure1-8.wav` (1.1 to 2.1 s) |
| `dark-magic3` | `3-dark-magic-spells` | qubodup | CC0 | `dark_magic/dark_magic/fout-01..03.flac` (1.2 to 3.9 s) |
| `rain-thunder` | `rain-long-thunder` | wuxiascrub | CC0 | `rain-thunder.ogg` (44 s) |
| `steam-hisses` | `steam-release-sounds` | bart | CC0 | `steam_hisses/steam hisses - Marker #1-5.wav` (1.85 s each) |
| `weapons-apparel` | `fantasy-weapons-and-apparel-sfx-library` | vehicle | CC0 (its `readme.txt` says so too) | `weapons-apparel/sfx/*.wav` (arrow, belt-buckle, boots-leather-step, knife/seax sheathe, quiver, sheath, sword-knife-clash) |
| `tinysized` | `fantasy-sound-effects-tinysized-sfx` | vehicle | CC0 | `tinysized/sfx-cc0/*.wav` (apple-cut, cloth-pouch-shake, coins-shake, handsaw, metal-knife-scrape, mud-steps, paper-tear, wood-twigs-break, water-drop, book-page) |
| `combat150` | `150-combat-sound-effects` | untamedpixels | CC0 (its `LICENSES.txt`: every file CC0, from Kenney, lentikula, Kronbits, CoMiGo) | `150gameeffectsounds/{01_combat_melee,02_combat_ranged,03_explosions_destruction,04_magic_spells}/*.wav` |
| `rpg-sound-pack` | `rpg-sound-pack` | artisticdude | CC0 | `rpg_sound_pack/RPG Sound Pack/{battle,interface,inventory,misc,NPC,world}/*.wav` (NPC: beetle, giant, gutteral beast, ogre, shade, slime) |
| `bell-dings` | `bell-dingschimes` | pwl | CC0 | `bell_ding1-4.wav` (1.4 to 2.3 s) |

`med-impacts` was downloaded and is licensed CC0, but no cue is mapped to it; it may simply be left in the cache.

Not downloaded though seen CC0 on the search: "Wierd Whooshes" (nine licences listed, mp3 only), previews and mp3-only submissions (lossy).

## 2. Cue by cue

Status: **covered** (candidates fit the brief), **partial** (a key layer comes from a Freesound row or synthesis, with the fallback named), **synth** (best made by synthesis; real files only as a texture). Freesound ids are in `freesound-wanted.md` as `fs <id>`. Durations are in seconds. "Layer" means mixed under or over another; "excerpt" means cut a window out of a longer recording. Synthesis (`synth` layers: noise, saw, sine, fm, crackle; filters, saturation, reverb impulses) can add to any entry; the line says only what it adds that matters.

### battle: release (group `release`)

- **`battle.swing.light`** (covered): `swishes` swish-1..13 (0.07 to 0.20; thin, short; pitch up, pick one per variant); `rpg-sound-pack` battle/swing, swing2, swing3 (0.14 to 0.23); `med-textures` Dagger Swing (3.0) or Seax Swing (9.0), excerpt a single swing. Synth: a high-passed noise sweep for tails and spread.
- **`battle.swing.blade`** (covered): `med-textures` Katana Swing (8.6) and Sabre Swing (23.0), excerpt single swings; `swords20` sword.1..10 (0.54 to 1.38, attack swings; some may include a clash, check); `k-rpg` knifeSlice (0.60). The faint ring: a tail of `k-impact` impactMetal_light (0.21 to 0.48), low in the mix. Synth: ring as two detuned sines.
- **`battle.swing.heavy`** (covered): `med-textures` Axe Swing (6.8) excerpt, pitched down; `air-whoosh` whoosh2_0 (5.3), pitched down and low-passed; leather creak at the start from `k-rpg` creak_001..003 (0.34 to 0.83). Synth: low noise push.
- **`battle.swing.thrust`** (covered): `med-textures` Spear Swing (4.7) excerpt; shaft rattle from `rd-metalwood` wood_misc_01..09 or `tinysized` wood-twigs-break-01; `swishes` for the air. Synth: rising noise stab.
- **`battle.swing.claw`** (covered): `rd-creature1` grunt_01..05 (0.53 to 0.93) and breath (0.67), pitched down and filtered, under a `swishes` swipe; `rd-creature2` attack_01..05 (0.13 to 1.02).
- **`battle.swing.bite`** (partial): `rd-creature2` attack_01..05 and bug_05..13 (0.28 to 0.46) for the snap; `rpg-sound-pack` NPC/beetle bite-small, bite-small2, bite-small3 (0.35 to 0.52); hiss from `steam-hisses` (1.85) or `fs 706977`, `fs 846337` (hiss and lunge, 0.7). Fallback: steam hiss plus a `rd-metalwood` wood_cracking click.
- **`battle.shot.bow`** (covered): `med-textures` English Longbow Shoot (4.0) and Scythian Recurve Shoot (4.1), excerpt the release; `weapons-apparel` arrow-feathers-01..03 (0.27 to 0.91) for the arrow's first whoosh. Synth: a plucked low-mid tone if the real twang is too stringy.
- **`battle.shot.crossbow`** (covered): `med-textures` Crossbow Shoot (3.2) and Crossbow Lever Trigger (5.0), excerpt the clack and thunk; `k-rpg` metalClick (0.45), metalLatch (0.26); `rd-rpg` lock_01..03 (0.34 to 0.41).
- **`battle.shot.wand`** (partial): `combat150` ElectroZap (0.34), EnergyZap (0.37), HeavyZap (0.74), Retro Electric Short 03 and 17 (0.57, 0.77); `spell-sounds` electricspell (21, excerpt); `k-scifi` laserSmall_000..004 (0.24 to 0.41) only heavily processed (design: not sci-fi laser). Synth: crackle and a sparkly high noise sweep carry most of it.

### battle: weapon impacts and outcomes (groups `impact`, `sweetener`)

- **`battle.hit.slash`** (partial): edge and thump from `k-rpg` knifeSlice, chop (0.24), drawKnife (0.40 to 0.48) and `k-impact` impactSoft_medium (0.12 to 0.18); flesh from `fs 411122`, `fs 259542`; fallback `rd-bfh` bfh1_hit_01..13 and `swords20`. Reverb: `small_room`.
- **`battle.hit.crush`** (covered): `k-impact` impactPunch_heavy_000..004 (0.46 to 0.65), impactPunch_medium (0.40 to 0.54), impactWood_heavy and impactWood_medium (0.31 to 0.33); `rd-bfh` bfh1_hit_*, bfh1_wood_hit_01..03, bfh1_rock_hit_01; crack texture from `rd-metalwood` wood_cracking_01..04 (0.18 to 0.31).
- **`battle.hit.pierce`** (covered): `k-impact` impactWood_light (0.27) and impactGeneric_light (0.12 to 0.14) for the tick; `tinysized` apple-cut-01..03 (0.50 to 0.60, a point sinking in something wet); `k-rpg` knifeSlice for the entry; `fs 411122` as an upgrade.
- **`battle.hit.claw`** (partial): wet and torn: `rd-water` slime_01..16 (0.23 to 0.65), `rd-mud` mud_01..25 (0.19 to 0.84), `k-impact` impactSoft_heavy (0.50 to 0.57); rip from `tinysized` cover-paper-tear-01..02 (1.26, 1.39), `k-rpg` cloth_001..004; `fs 811615`, `fs 411122` as upgrades.
- **`battle.hit.magic`** (covered): `combat150` Retro Electric Short 03 and 17, ElectroZap; `rd-bang` shot_03 (0.26) as the pop; `rd-sfx1` hit_01..04. Synth: electric fizz tail.
- **`battle.armor.metal`** (covered): `rpg-sound-pack` inventory/chainmail1 (0.58), chainmail2 (0.75), armor-light (0.50), metal-ringing (0.52); `foot-leather-armor` step_metal (four, 0.25); `k-impact` impactPlate_light, impactPlate_medium (0.49 to 0.66), impactMetal_medium; high-pass all.
- **`battle.hit.crit`** (partial): transient from `rd-bang` bang_01..10 head (1.0 to 1.4, trim to the first 80 ms) or `combat150` Impact_01, HeavyShot_01..03 (0.56 to 0.65), BlastImpact_01..03 (0.61 to 0.72); sub thump from `k-scifi` lowFrequency_explosion_000..001 (1.0, 2.0) or synth sine drop. Mostly synthesised sub thump.
- **`battle.miss.swing`** (covered): `swishes` and `air-whoosh` with a pitch envelope for the doppler; `rpg-sound-pack` battle/swing3. Synth: filtered noise sweep.
- **`battle.miss.shot`** (covered): `med-textures` Scythian Recurve Arrow Passby (3.8), Crossbow Bolt Passby (2.3) and Pass variants, excerpt; soft thud from `k-impact` impactSoft_medium.
- **`battle.miss.magic`** (synth): synth descending crackle; real texture from `k-scifi` forceField_000..004 (0.95 to 0.96, reversed or filtered) or `combat150` Retro Electric Off (2.8, excerpt).
- **`battle.hit.image`** (covered): `k-impact` impactGlass_light, impactGlass_medium (0.21 to 0.54); `rd-bfh` bfh1_glass_breaking_01..06 (0.39 to 0.92), glass_falling_01..04 (tinkles, 0.43 to 0.82); `k-iface` glass_001..006 (0.11 to 0.69); `rd-sfx1` glass_01..05. Synth: shimmer pad under the tinkles.
- **`battle.element.fire`** (covered): `catching-fire` flame (0.45), `fire-crackling` fire-1 (excerpt), `firestaff` Wavs (8.5, excerpt a burst). Synth: crackle.
- **`battle.element.frost`** (covered): `ice-shatter` LedasLuzta (0.40 to 0.84); `ice-spells` ice (1.16); `k-impact` impactGlass_light for sparkle.
- **`battle.element.lightning`** (covered): `combat150` ElectroZap, EnergyZap, Retro Electric Short; `rd-sfx2` sfx100v2_hit_*; synth crackle and a snap. (`k-scifi` laserRetro_000..004, 0.24 to 0.28, only heavily processed.)
- **`battle.element.acid`** (covered): `rd-water` bubble_01..03 (0.36 to 0.70), slime_01..16; sizzle from `steam-hisses`; `k-scifi` slime_000 (0.5).
- **`battle.element.poison`** (covered): `rd-water` bubble_01..03, loop_bubbles_1 and loop_bubbles_02 (4.4, 7.3; excerpt); `steam-hisses` low-passed; `rd-mud`.
- **`battle.element.blight`** (partial): bright chime from `bell-dings` (1.4 to 2.3), `k-iface` bong_001 (0.12), `k-impact` impactBell_heavy_002..004 (0.30 to 0.70); the reversed dark swell from `dark-magic3` fout-01..03 (reverse) or `fs 32805`. Synth: both layers if the files disappoint.
- **`battle.heal.small`** (covered): `cure-magic` Cure2 and Cure4 (1.2, 1.1) quieter and shortened; `k-iface` pluck_001..002 (0.10 to 0.16). Synth: a soft upward shimmer.
- **`battle.regen`** (covered): `rd-mud` mud_01..25 (squelch, 0.19 to 0.84), `rd-water` slime_*; creak from `k-rpg` creak_001..003; `tinysized` mud-steps-01..05 (1.2 to 4.2, excerpt); `fs 811615` as an upgrade.
- **`battle.death.hero`** (partial): the toll from `fs 824588` or `fs 454855` (distant tolling bell, 29 and 55 s; excerpt one strike), drone from `fs 32805`; fallback `k-impact` impactBell_heavy_000..002 (0.7 to 1.74), `bell-dings` bell_ding1..4, `rd-sfx1` bell_01..03 (0.53 to 1.78) and gong_01..02 (1.19 to 1.42), all pitched down and through `stone_hall`. Synth: string-like drone.

### battle: falls (group `death`)

- **`battle.death.human`** (covered): collapse from `rd-bfh` bfh1_falling_01..07 (0.63 to 1.49), bfh1_metal_falling_01..05 (0.40 to 1.16); `k-rpg` dropLeather (0.42); `k-impact` impactSoft_heavy; exhale from `rd-creature1` breath (0.67) and `rd-creature2` breath_02 (0.36). The `rd-creature2` human_01..08 (0.62 to 0.77) are named human: if they are vocalisations they could be the exhale, but the brief says no scream (check). Optional `fs 171844`, `fs 555423`.
- **`battle.death.goblinoid`** (partial): yelp from `rd-creature1` hurt_01..05 (0.35 to 0.49), scream_01..02 (0.96), `rd-creature2` die_01..04 (0.47 to 0.78), `rd-rpg` creature_die_01 (1.06), creature_hurt_01..02, pitched up; light fall from `k-impact` impactSoft_medium; upgrades `fs 171844`, `fs 555423`, `fs 616622`.
- **`battle.death.brute`** (covered): `troll-sounds` troll-roars (10.9) and scrapped-troll-sounds (10.1), excerpt a groan; `rd-creature1` troll_01..03 (0.42 to 0.79), monster_01..07; `rpg-sound-pack` NPC/ogre1..5 (0.34 to 0.59), giant1..5 (0.54 to 0.93); thud from `k-impact` impactPlate_heavy_000..004 pitched down and `rd-bfh` rock_falling_01..09; `fs 555423` optional.
- **`battle.death.spider`** (covered): `rd-creature1` bug_01..04 and `rd-creature2` bug_05..13 (0.28 to 0.58, chitter), alien_01..12 pitched up for the screech; legs crumpling: `rd-metalwood` wood_cracking_01..04 (0.18 to 0.31) and `tinysized` wood-twigs-break-01..02 (0.40, 0.76); `fs 846337` optional.
- **`battle.death.salamander`** (partial): long hiss from `steam-hisses` (1.85) or `fs 706977`; wet flop from `rd-water` splash_09..10 (0.32 to 0.36) and slime_*; embers from `fire-crackling` tail. Fallback is the steam hiss alone.
- **`battle.death.horror`** (partial): roar from `troll-sounds` troll-roars, `monster-snarls` (7 to 19, excerpt), `rd-creature2` roar_04..06 (0.91 to 1.13) and monster_19..20 (1.42, 1.52), pitched down and layered; reversed swell from `dark-magic3` or `k-scifi` lowFrequency_explosion (reversed); rumble from `fs 867251` or `rain-thunder` (44, excerpt) and `fs 200990`, `fs 616992`. Fallback: `rain-thunder` rumble and `lowFrequency_explosion`.

### battle: spells and area abilities (groups `release`, `impact`)

- **`battle.cast.arcane`** (synth): breathy rising shimmer and a soft hum are synthesis (noise and sine, rising filter); texture from `magic-spell-sfx` magical_1..7 (1.1 to 2.4) if wanted.
- **`battle.cast.fire`** (partial): ignition scrape from `tinysized` match-light-01 (0.76) and lighter-light-01 (0.32) *or* `catching-fire`; bloom into `firestaff` Wavs and `rd-rpg` spell_fire_01..07 (0.65 to 1.93); upgrades `fs 244926`, `fs 522705`, `fs 395038`.
- **`battle.cast.frost`** (covered): `freeze-spell` freeze (2.1) and `ice-spells` coldsnap (2.7), excerpt; `combat150` Ice Spell Impact 1..5 head; wind from `rd-sfx2` air_01..02 (2.6, 1.1).
- **`battle.cast.storm`** (synth): rising-pitch charge buzz is a sawtooth with a pitch sweep; texture from `combat150` Retro Charge 07 and 13 (3.9, 4.1) and `k-scifi` forceField, heavily processed.
- **`battle.cast.venom`** (covered): `rd-water` bubble_01..03 and loop_bubbles (excerpt) with `steam-hisses`; `k-scifi` slime_000.
- **`battle.cast.shadow`** (partial): `dark-magic3` fout-01..03 (1.2 to 3.9) reversed and low-passed; `fs 32805`; fallback `k-scifi` lowFrequency_explosion reversed, `air-whoosh` pitched down.
- **`battle.cast.holy`** (partial): warm swell and bell strike: `spell-sounds` healing (22.5, excerpt), `cure-magic` Cure1..8; bell from `bell-dings`; choir pad synthesised (design), or `fs 685680`.
- **`battle.cast.ward`** (synth): rising glassy shimmer is synthesised; `magic-spell-sfx` magical_1..7, `k-iface` glass_001..006 and `k-scifi` forceField as texture.
- **`battle.impact.arcane`** (synth): clean pop and sparkle tail: `combat150` Retro Charge Magic 11 (1.28) or `rd-rpg` spell_01..02 (0.55 to 0.63) as layers; mostly synthesis.
- **`battle.impact.fire`** (covered): `combat150` Fire Spell Impact 1..5 (1.9 to 3.0, trim to 0.7), `firestaff`, `rd-rpg` spell_fire_*, `catching-fire`; upgrades `fs 244926`, `fs 346917`.
- **`battle.impact.fireball`** (covered): sub boom and noise burst from `k-scifi` explosionCrunch_000..004 (0.78 to 1.98) and lowFrequency_explosion_000..001, `rd-bang` bang_01..10 and cannon_01..05 (0.86 to 1.8), `combat150` BlastImpact_01..03, ElectricExplosion (1.77); whoosh and tail from `rd-rpg` spell_fire_03 (1.93) and `fire-crackling`; upgrades `fs 395038`, `fs 522705`, `fs 346917`.
- **`battle.impact.frost`** (covered): `ice-shatter` LedasLuzta (0.40 to 1.32); `combat150` Ice Spell Impact 1..5; debris `rd-bfh` bfh1_glass_breaking_*.
- **`battle.impact.lightning`** (partial): thunder crack from `rd-sfx2` thunder_01 (5.3, excerpt the crack and rumble); `combat150` Lightning Spell Impact 1..5 (3.7 to 4.7); `rain-thunder` (44, excerpt); upgrades `fs 200990`, `fs 616992`.
- **`battle.impact.acid`** (covered): `rd-water` splash_01..15 (0.32 to 1.38) and slime_*; sizzle from `steam-hisses`.
- **`battle.impact.poison`** (partial): soft burst into a long low hiss: `steam-hisses` (1.85), `rd-sfx2` air_01..02, `tinysized` compressed-air-spray-01..02 (0.58, 2.0), `rd-water` loop_bubbles low-passed; low body `fs 867251`. Fallback all of the first set.
- **`battle.impact.shadow`** (covered): `dark-magic3` fout-01..03; `combat150` Earth Spell Impact 1..5 (1.9 to 3.2, low-passed); reversed swell from a reversed `air-whoosh`.
- **`battle.impact.hex`** (covered): `rd-weird` weird_01..30 (0.29 to 1.26), `magic-spell-sfx` magical_6; `k-iface` glass_*, pitch-bent down. Synth: detuned glass partials.
- **`battle.impact.web`** (covered): `rd-water` slime_01..16, `rd-creature2` slime_01..08 (0.38 to 0.63), `rpg-sound-pack` NPC/slime slime1..10 (0.25 to 0.56); stretch: `tinysized` cover-paper-tear-01..02.
- **`battle.impact.heal`** (covered): `cure-magic` Cure1..8, `combat150` Healing Spell Impact 1..15 (1.8 to 3.3), trimmed to 0.9; `spell-sounds` healing (excerpt).
- **`battle.impact.buff`** (covered): `magic-spell-sfx` magical_1..7, `k-scifi` forceField_000..004 (0.95), `rd-rpg` item_gem_01..04 (0.20 to 0.59); synth: shimmer ring.
- **`battle.ability.spit`** (partial): throaty hiss from `fs 706977` or `steam-hisses`, `rd-creature1` spit_01..03 (0.36 to 0.69), `rd-creature2` attack_*; fire whoosh from `fs 244926`, `fs 395038` or `rd-rpg` spell_fire_07 (0.65). Fallback: `rd-creature1` spit plus `rd-rpg` spell_fire.
- **`battle.ability.web`** (covered): quick "thwip" from `swishes` (0.07 to 0.20) pitched up plus a short `rd-water` slime; `tinysized` tin-whistle-whoosh-01..02, tube-plastic-whoosh-01..02 (0.34 to 0.49) as silk.

### battle: steps (group `step`)

- **`battle.step.armored`** (covered): `foot-leather-armor` step_metal (four, 0.25) and step_lth1..4; `k-rpg` footstep00..09 (0.22 to 0.32); `k-impact` footstep_grass_000..004 (0.59 to 0.78, trim); mail jingle from `rpg-sound-pack` chainmail1..2. 8 variants means mixing these layers with detune.
- **`battle.step.light`** (covered): `k-impact` footstep_grass_000..004; `foot-leather-armor` step_lth*, step_cloth*; `weapons-apparel` boots-leather-step-01..04 (0.58 to 0.68); `rd-sfx2` footstep_01..02, footstep_wet_01..03.
- **`battle.step.heavy`** (covered): `rd-bfh` bfh1_rock_falling_* and `k-impact` impactSoft_heavy / impactPunch_heavy pitched down (0.46 to 0.57); debris from `rd-bfh` rock_breaking_01..03; `rd-mud`.
- **`battle.step.skitter`** (covered): `rd-creature1` bug_01..04 and `rd-creature2` bug_05..13 (0.28 to 0.58); dry clicks from `rd-metalwood` wood_cracking_01..04, `k-impact` impactWood_light pitched up.

### world (group `world`)

- **`world.confront`** (partial): low drum hit from `fs 235453`, `fs 347126` plus a dissonant stab: synth (saw cluster, detuned) with `fs 867251` under it; fallback `rd-bang` cannon_01..05 pitched down as the drum and synth stab.
- **`world.sighted`** (partial): distant horn from `horn-theircoming` theircoming3 (5.2) and theircoming (14, excerpt) as a stand-in, upgrades `fs 512490`, `fs 539956`; two drum hits `fs 235453`, `fs 347126`; reverb `open_air`.
- **`world.source`** (partial): drone, rumble, choir are synthesis (design), with `fs 867251`, `fs 32805`, `fs 685680`; fallback `rain-thunder` rumble and `k-scifi` spaceEngineLow_000..004 (5.0, low-passed drone).
- **`world.threatened`** (partial): one distant toll from `fs 824588` or `fs 454855`; fallback `k-impact` impactBell_heavy_000..001 (1.48, 1.74) pitched down with `stone_hall`.
- **`world.captured`** (partial): banner flap from `fs 57280` (37.7, excerpt); bright two-note horn or chime from `bell-dings`, `k-iface` bong_001, or a synth horn pair, `fs 512490` / `fs 539956`; fallback: `rd-sfx1` paper_01..04 or `tinysized` plastic-bag-drop flicks as the flap, plus chime.
- **`world.lost`** (partial): low toll from `fs 824588` / `fs 454855` and crumbling from `rd-bfh` bfh1_rock_breaking_01..03 (0.46 to 1.15), bfh1_rock_falling_*, bfh1_wood_breaking_01..04 (0.25 to 0.49); fallback toll as in `world.threatened`.
- **`world.build`** (covered): `rd-metalwood` hammer_01..04 (0.23 to 0.50), wood_hammer_01..02, wood_slam_01..04 (settle); creak from `k-rpg` creak_001..003; optional `fs 434339`, `fs 449843`.
- **`world.arrive`** (covered): `k-rpg` footstep00..09, dropLeather (0.42), handleSmallLeather (two, 0.31 to 0.34) for the pack set down; chime from `k-iface` bong_001 or `bell-dings`.
- **`world.upgrade`** (covered): `rd-metalwood` hammer_*, tools_01..12 (0.39 to 0.81); sawing from `rd-loops` saw (2.34) or `tinysized` handsaw-sawing-wood-01 (6.4, excerpt); rising chime synth; optional `fs 434339`, `fs 270589`, `fs 449843`.
- **`world.coins`** (covered): `k-rpg` handleCoins (0.85) and handleCoins2 (0.34); `k-casino` chips-handle-1..6 (0.23 to 0.83), chips-stack, chips-collide, chip-lay; `rd-rpg` item_coins_01..04 (0.41 to 1.61); `rpg-sound-pack` inventory/coin..coin3; pouch shake from `tinysized` cloth-pouch-shake-01..02 (0.48, 0.45) and coins-shake-01 (1.19).
- **`world.craft`** (covered): anvil from `k-impact` impactMetal_light..heavy (0.11 to 0.48) and impactMining_000..004 (0.80 to 0.99), `rd-metalwood` metal_hit_01..05 (0.27 to 0.43) and tools_*; file scrape from `tinysized` handsaw-knife-scrape-01..02, metal-knife-scrape-01..03; upgrades `fs 434339`, `fs 270589`, `fs 449843`.
- **`world.rune.embed`** (covered): crystalline click from `k-impact` impactGlass_light (0.21), `rd-rpg` item_gem_01..04, `k-iface` glass_001..006; short synth hum locking in.
- **`world.rune.fuse`** (synth): swelling hum resolving in a chime pop is synthesised; `magic-spell-sfx` magical_* and `bell-dings` as texture.
- **`world.rune.extract`** (synth): reversed shimmer and a pop: reverse of the `rune.embed` layers and `magic-spell-sfx`; mostly synthesis.

### ui (group `ui`)

- **`ui.click`** (covered): `k-ui` click1..5 (0.03 to 0.09), mouseclick1; `k-iface` click_001..005, tick_001..003; wood and leather body from `rd-rpg` wood_01..05 (0.19 to 0.65) and `k-impact` impactWood_light (trim to 60 ms, high-pass). Fully synthesisable (tick plus tiny thump) if the real ones sound electronic.
- **`ui.confirm`** (covered): `k-iface` confirmation_001..004 (0.29 to 0.54), pluck_001..002; mallet note: synth marimba with `k-impact` impactWood_medium as the strike.
- **`ui.back`** (covered): `k-iface` back_001..004 (0.06 to 0.09), close_001..004 (0.15 to 0.32); `k-ui` mouserelease1. Pitch down for the downward slide.
- **`ui.tab`** (covered): `k-rpg` bookFlip1..3 (0.23 to 0.77), bookPlace1..3; `rd-sfx1` paper_01..04 (0.42 to 0.61); `tinysized` book-page-01..02.
- **`ui.error`** (covered): two muted knocks from `rd-metalwood` wood_hit_01..09 (0.26 to 0.41) or `k-impact` impactWood_medium / impactWood_heavy, pitched down; `k-iface` error_001..008 (0.10 to 0.53) are probably electronic beeps, so audition before use.
- **`ui.learn`** (covered): stamp from `k-impact` impactWood_heavy and `k-rpg` bookClose (0.23); rising bell from `bell-dings`, `k-iface` pluck / glass; synth bell.
- **`ui.gear`** (covered): `k-rpg` beltHandle1..2 (0.28 to 0.48), cloth_001..004, clothBelt, handleSmallLeather, metalLatch (0.26); `weapons-apparel` belt-buckle-01..05 (0.20 to 0.84), quiver-leather-squeeze-01..15, sheath-buckle-01; `rpg-sound-pack` inventory/armor-light, cloth, cloth-heavy, metal-small1..3 (0.33 to 0.53). Plenty for 6 variants.

### stings (group `sting`)

- **`stings.victory`** (partial): `k-jingles` Steel, Sax, Hit, Pizzicato and 8-Bit families (17 each, all 0.28 to 1.74 s: none reaches the 3 s the brief wants, so chain two or more, or lay one over a synth brass pad and a drum); `fs 693428` (brass and organ fanfare, 25.9 s, excerpt about 3 s) is the better base. Decision: Kenney jingles for now.
- **`stings.defeat`** (synth): a slow falling minor phrase: low strings and a low drum are synthesis; `k-jingles` Sax and Steel (e.g. SAX07 1.74, STEEL07 1.55) pitched down as a starting layer; `fs 693428` is not suitable.
- **`stings.level_up`** (synth): ascending arpeggio with shimmer is synthesis (harp or bell timbre); `k-jingles` Pizzicato (PIZZI03 1.15, PIZZI07 1.32) and Steel (STEEL07 1.55) as the starting layer, `bell-dings`, `k-iface` pluck.

## 3. Which cues are synthesisable

**Mostly or entirely synthesis** (do not hunt for samples beyond a texture layer): `battle.cast.arcane`, `battle.cast.storm`, `battle.cast.ward`, `battle.impact.arcane`, `battle.miss.magic`, `world.rune.fuse`, `world.rune.extract`, `stings.defeat`, `stings.level_up`, and the sub thump of `battle.hit.crit`. **Synthesis plus a sampled texture:** `ui.click`, `ui.confirm`, `ui.back`, `battle.hit.magic`, all `battle.element.*` snaps and crackles, `battle.cast.holy`, `battle.cast.shadow`, `battle.impact.hex`, `battle.impact.buff`, `battle.heal.small`, `world.source`, `world.rune.embed`, `world.arrive`'s chime, `world.upgrade`'s chime, and the swing whooshes (filtered noise sweeps for tails and variants).

Counts over the 85 cues: **covered 53, partial 23, synth 9** (every cue has at least a fallback from downloaded material or synthesis; none is empty-handed). Partial: `battle.swing.bite`, `shot.wand`, `hit.slash`, `hit.claw`, `hit.crit`, `element.blight`, `death.hero`, `death.goblinoid`, `death.salamander`, `death.horror`, `cast.fire`, `cast.shadow`, `cast.holy`, `impact.lightning`, `impact.poison`, `ability.spit`, `world.confront`, `world.sighted`, `world.source`, `world.threatened`, `world.captured`, `world.lost`, `stings.victory`. Synth: `battle.miss.magic`, `cast.arcane`, `cast.storm`, `cast.ward`, `impact.arcane`, `world.rune.fuse`, `world.rune.extract`, `stings.defeat`, `stings.level_up`. Section 5 gives each partial's fallback if gate G2 is "skip all".

## 4. Risks seen while surveying

- **The stings are short.** Every Kenney jingle is 1.74 s or less; `stings.victory` asks about 3 s and `stings.defeat` 3.5 s, and a chiptune or pizzicato family may not read as "brass and drum" or "low strings". Stings need synthesis or chaining; plan for an extra listening round at step 09's gate.
- **Footstep variety.** Kenney's footstep sets are five variants per surface and their grass files run 0.59 to 0.78 s (probably a step with a tail). `battle.step.*` need 8, 8, 6 and 4 variants that pass the 0.95 correlation check; expect to mix layers and use detune, not raw files.
- **Excerpts from long recordings.** The `med-textures` swings, bows and passbys are 2 to 47 s recordings of several actions each; `source add --start/--end` makes the excerpts, which means listening to find the strikes (spectrogram or onset detection first). Same for the Freesound bells, thunder and horns.
- **Sci-fi packs are clean.** `k-scifi` zaps and `combat150`'s retro electric files sound game-like; the design wants wand and lightning bright but not laser, so treat them as layers under synthesis, not cues.
- **Creature vocals are generic.** The rubberduck creature packs are stylised, mostly small-animal and alien sounds; goblin and kobold deaths and the Horror's roar rely on pitching and layering, and `battle.death.horror` (one variant, 2.5 s) is the cue most likely to need a second listening round.
- **Names can mislead.** `rd-creature2` human_01..08 and `k-iface` error_001..008 are guesses from names; neither was heard.
- **Bell and drum realism.** The tolling bell, war horn and drums that make `world.threatened`, `world.lost`, `world.sighted`, `world.confront` and `battle.death.hero` land are all Freesound files; with "skip all", Kenney's `impactBell_heavy` and pitched cannon hits stand in and will be thinner.
- **Lossy originals.** Every Freesound row is a wav or flac original. The Kenney and `rd-*` packs are ogg (lossy); `source add` writes FLAC from them, so their quality is the original's and they are encoded once more at build.
- **Mixed-licence pages.** `foot-leather-armor` and `spell-sounds` list OGA-BY 3.0 and CC0; they may be used under CC0 only, and `source add` records `licence = "CC0-1.0"`, but a content step that wants to be strictly clean can avoid them (alternatives: `weapons-apparel` boots, `k-impact` footsteps, `cure-magic`).
- **Total download size.** About 810 MB in the cache for 7 Kenney and 38 OpenGameArt packs, unpacked (the Freesound list is another 134 MB); none is committed, and the committed sources budget is 15 MB.

## 5. If gate G2 is "skip all"

Each `partial` cue has the fallback named in its entry, in short:

| Cues | Fallback without Freesound |
| --- | --- |
| `world.threatened`, `world.lost`, `battle.death.hero`, `battle.element.blight` | `k-impact` impactBell_heavy, `bell-dings`, `rd-sfx1` bell_*/gong_*, pitched down, through `stone_hall`; synth drone |
| `world.confront`, `world.sighted` | pitched `rd-bang` cannon_* as drum hits, `horn-theircoming` as the horn, synth stab |
| `world.captured` | `rd-sfx1` paper_* flicks as the flap, `bell-dings` chime |
| `world.source`, `battle.cast.shadow`, `battle.death.horror` | `rain-thunder` rumble, `k-scifi` lowFrequency_explosion and spaceEngineLow, `dark-magic3`, synthesis |
| `battle.cast.fire`, `battle.impact.fire`, `battle.impact.fireball`, `battle.ability.spit` | `firestaff`, `rd-rpg` spell_fire_01..07, `combat150` Fire Spell Impact, `fire-crackling`, `catching-fire`, `rd-bang` |
| `battle.impact.lightning` | `rd-sfx2` thunder_01, `combat150` Lightning Spell Impact, `rain-thunder` |
| `battle.hit.slash`, `hit.pierce`, `hit.claw`, `regen` | `rd-bfh`, `rd-mud`, `rd-water`, `k-impact` impactSoft, `tinysized` apple-cut and paper-tear |
| `battle.swing.bite`, `death.salamander`, `death.spider` | `steam-hisses`, `rd-creature` bug_* and attack_* |
| `battle.death.goblinoid`, `death.brute` | `rd-creature1` hurt, scream, `rd-creature2` die, `troll-sounds`, `rpg-sound-pack` ogre and giant |
| `world.craft`, `world.build`, `world.upgrade` | `k-impact` impactMetal and impactMining, `rd-metalwood` hammer_* and tools_*, `tinysized` handsaw (no change in coverage) |
| `stings.victory` | `k-jingles` chained, synth brass |

Content steps 08 and 09 (melee, UI and stings) lean on no Freesound row except `stings.victory`'s optional fanfare; steps 10 to 13 do, and the `fs` ids appear only in the entries above (`grep -n 'fs <id>' sourcing.md`).
