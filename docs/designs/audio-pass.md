# Audio pass: sound effects and narration

## 1. Purpose and status

The game's sounds are eight square-wave placeholders (`public/assets/audio/sfx_*.wav`) played on a dozen moments, and its cutscenes are silent. This feature replaces the placeholders with a catalogue of layered, varied sound effects built from CC0 recordings and synthesis by a checked-in build tool, adds sounds to the world map, the encampment and the interface, and adds a framework for narrating cutscenes with speech pre-rendered offline by a local emotion-capable TTS model.

Inputs, all settled and not reopened here:

- Feature record: [`docs/features/audio-pass.md`](../features/audio-pass.md), decisions D1 to D6.
- Architecture brief: [`docs/architecture/audio-pass.md`](../architecture/audio-pass.md). This design follows it; where it narrows or adjusts a "proposed" detail of the brief, the change is called out (section 5.10).

**Status: ready for planning.** One open question from the record (tutorial narration) is decided here with a recommendation (section 4.6). The questions in section 8 do not block planning: each has a default the plan can follow.

## 2. Requirements and scope

### 2.1 Requirements

| ID | Requirement |
| --- | --- |
| R1 | Every sound the game plays is a **cue** from one cue table (`CueId`), played through one player on a declared **bus** (`effects`, `ui`, `music`, `voice`). No scene calls `sound.play` with a raw key. |
| R2 | Battle events sound by what made them: the weapon class of the attacker (release and impact), the outcome (hit, critical, miss, mirror image struck), the defender's armour, the spell's element or school, the area ability, a rune's on-hit element, a status's tick, regeneration, a unit's fall by body type (a hero's with its own toll), and footsteps on each hex walked (section 4.1). |
| R3 | The world map sounds its notable moments: monsters confronted or sighted, the Source sighted, a site threatened, captured or lost, a building raised, an arrival (section 4.2). |
| R4 | The encampment, trading post, crafting screen, inventory and interface sound their actions: clicks, confirm, back, tabs, refusals, a node learnt, gear changed, coins, crafting, runecraft, a facility raised (section 4.3). |
| R5 | Victory, defeat and level-up stings replace the placeholder WAV stings. |
| R6 | Each cue has several variants; a play never repeats the variant just played, and adds small pitch and volume jitter. Choosing a variant never draws from the battle's seeded RNG. |
| R7 | A cue may limit its simultaneous plays and its rate; a safety limiter on the master output prevents clipping when sounds stack. |
| R8 | Sound effects are built by `tools/audio/` from text recipes and committed sources, deterministically; each source carries provenance and an allow-listed licence (CC0 or own); `npm run sounds:check` detects a stale or altered output and enforces the budgets. |
| R9 | Every built sound meets its group's loudness target and true-peak ceiling (section 5.5). |
| R10 | The options menu has a fourth slider, **Voice**; old saved audio settings load with a default for it. Music ducks while a voice line plays. |
| R11 | A cutscene beat can be voiced by declaring a line id, a voice, an emotion and optionally an intensity, a spoken wording and a take on the beat itself. A voiced line never speaks a player-chosen template. The leader is never voiced (D4). |
| R12 | Narration is rendered offline by `tools/audio/` through an engine adapter (Chatterbox primary, Qwen3-TTS fallback, D3), only for lines whose inputs changed; `npm test` fails when a voiced line is stale. |
| R13 | Each voice is designed from a text description (Qwen3-TTS voice design) into reference clips per emotion; no real person's voice is cloned. A listening test (bake-off) on real lines gates adopting an engine. |
| R14 | In `StoryScene`, a voiced beat's line starts as the beat is shown; advancing cuts it; skipping stops it; the beat's text stays on screen as the subtitle; a missing or failed file leaves the beat silent. |
| R15 | Provenance and licences are documented: the audio READMEs, a new `public/assets/voice/README.md`, a new `audio/CLAUDE.md` with a pointer from the root `CLAUDE.md`. |
| R16 | Nothing in the game depends on a sound playing: a missing marker, bank or voice file degrades to silence, never an exception. |

### 2.2 Non-goals

- Runtime TTS; voicing the leader or any player character (D4); voicing tutorial tips in v1 (section 4.6).
- New music. The two themes stay as supplied; only their playback level is calibrated (section 5.5).
- Terrain-dependent footsteps (the battle board has one surface), positional or stereo-panned sound (wave 2), dynamic music, barks and battle cries, lip sync, localisation, an auto-advance or subtitles setting.
- Writing the story. The cutscene text is placeholder; v1 voices the placeholder narration beats only to prove the pipeline end to end.

### 2.3 Waves

Each cue in the catalogue is marked **W1** (first pass, this feature's acceptance) or **W2** (designed now, built later when wanted; the plan may leave them out). W2 cues add no new mechanism: each is a recipe and a cue entry.

## 3. Current system (inspected)

- **Sounds.** [`src/scenes/sounds.ts`](../../src/scenes/sounds.ts) has `SOUND_KEYS` (8 `sfx_*`, 2 stings, 2 themes) and `eventSounds(event)`, mapping a `BattleEvent` to `{ key, delayMs }[]`: every attack plays `sfx_melee_swing` (a bow shot too), then miss, hit or crit at `impactMs(event)`; every cast or area ability `sfx_spell_cast`, then a friendly chime or the best outcome; `status_tick` a hit; `regenerate` the heal chime; `unit_down` the death tone; `battle_end` a sting after `STING_DELAY_MS` (450). Constants `SOUND_VOLUME` 0.4, `MUSIC_VOLUME` 0.2.
- **Settings.** [`src/scenes/audioSettings.ts`](../../src/scenes/audioSettings.ts): `master`, `effects`, `music` in `localStorage` `yomi.audio`; `soundVolume(key)` picks a channel by the key's prefix. `MenuScene.SLIDERS` draws three sliders; releasing master or effects plays a click.
- **Loading.** `BootScene.preload` loads every `SOUND_KEYS` entry with `load.audio`; the themes as Opus with an MP3 fallback, the rest WAV.
- **Call sites.** `BattleScene.playSound` and its cue loop in `showEvent`; about 25 direct `sound.play('sfx_ui_click', …)` calls in `PartyScene`, `TradingPostScene`, `InventoryScene` (and `sfx_heal` for a world-map cast), `PartyListView`, `PartyColumn`, `WorldScene`, `EncampmentScene`, `MenuScene`, `GuildHallScene`, `CraftingScene`, `panelButton`, `ExchangeScene`. `WorldScene` plays the world theme (paused under the menu) and clicks only: no world event is heard.
- **Battle data available.** `AttackEvent`: `weapon` (name), `melee`, `distance`, `hit`, `critical`, `image`, `defenderResistance`, `ability`/`strike` on routine strikes, `bonus[]` (rune on-hit, each with an `element`), `healed`. `CastEvent`: `spell` (`SPELLS[id]` has `school`, `hostile`, `element`), `outcomes[]` (hit, critical, image), `distance`, `drained`. `AbilityEvent`: `ability`, `shape`, `outcomes` (with `half`). `StatusTickEvent`: `status` (`STATUSES[id].element`: Corroded acid, Poisoned poison). `MoveEvent`: `path` (one hex a step; `MOVE_STEP_MS` 140 in `BattleScene`). `UnitDownEvent`: `unit`. The event carries no weapon family or unit kind: the scene knows each unit's `UnitKind` (encounter) and a hero's gear (its `Character`), as `attackLook(event, heldIcon)` already uses.
- **Timing.** [`battleEffects.ts`](../../src/scenes/battleEffects.ts): `SWING_IMPACT_MS` 130, `RELEASE_MS` 60, `flightMs(hexes)` = 90 + 45 a hex; `impactMs(event)` gives when an outcome lands.
- **World data.** `WorldEvent` ([`blight.ts`](../../src/game/blight.ts)): `level_changed`, `spawned`, `sighted` (with `source`), `site_threatened`, `site_captured`, `site_lost`, `tower_built`, `tower_lost`, `outpost_built`, `yield`, `encampment_lost`. `PartyEvent` ([`company.ts`](../../src/game/company.ts)): `arrived`, `confronting`, `order_done`, `met`. `WorldScene` tells them through `describeWalk`, `describeDays`, `describeOthers` and `describeWorldEvent`; a walk plays one hex per `WALK_STEP_MS` (140).
- **Story.** [`cutscenes.ts`](../../src/story/cutscenes.ts): `CutsceneBeat { text, speaker?, portrait?, backdrop? }`. Today's content: `intro` (a narrator beat, then a `{leader}` beat) and `source_sighted` (one narrator beat), all placeholder. **There are no fixed speakers yet**, so the v1 voice cast is the narrator alone. [`tutorial.ts`](../../src/story/tutorial.ts) has six placeholder tips. `StoryScene` lazily loads backdrops in `preload`, advances on click, Space or Enter, skips on Esc, and has no audio.
- **Kinds and gear.** `UnitKind` = `warrior` (every hero) or a `FoeKind`: monsters `goblin`, `kobold`, `shaman` (Staff), `hobgoblin` (Morning Star, mail), `troll`, `armored_troll`, `horror`, `salamander` (Claws), `giant_spider` (Fangs); bandits `bandit_cutthroat` (dagger), `_archer` (bow), `_brute` (axe, breastplate), `_mage` (wand), `_captain` (sword, shield, breastplate), `_crossbowman` (crossbow). Weapon icons (`ItemIcon`): `dagger`, `shortsword`, `rapier`, `sword`, `sword_ember`, `greatsword`, `axe`, `mace`, `war_hammer`, `staff` (a melee club), `spear`, `halberd`, `bow`, `longbow`, `bow_hawk`, `crossbow`, `wand`, `wand_storm`; body armour icons `armor` (breastplate), `plate`, `leather`, `robe`.
- **Tooling precedent.** `art/` text sources, a host-installed tool (`sprite`), committed outputs and manifest, `npm run sprites:check` outside `npm test` ([`art/CLAUDE.md`](../../art/CLAUDE.md)). `package.json` has no TOML parser; `tsconfig.json` does not enable `resolveJsonModule`.

## 4. Proposed behaviour

### 4.1 The sound catalogue

Cue ids are `<bank>.<name>`; a recipe lives at `audio/sfx/<bank>/<name>.toml`. Four banks: `ui`, `battle`, `world` (the map and the encampment's screens), `stings`. Lengths are typical, the maximum a recipe may produce being about 1.5 times that. Group names refer to the loudness targets in 5.5.

#### 4.1.1 Battle: weapon releases (group `release`)

Played at 0 ms on an `attack` event, chosen by the attacker's **attack class** (5.3).

| Cue | W | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- | --- |
| `battle.swing.light` | 1 | 5 | 200 | dagger, shortsword, rapier, bare hands; goblin, kobold, cutthroat | A quick, thin, high whoosh: cloth and air, little low end; a fast flick. |
| `battle.swing.blade` | 1 | 5 | 300 | sword, Emberblade; captain | A medium whoosh with a faint metallic ring riding its tail. |
| `battle.swing.heavy` | 1 | 5 | 450 | greatsword, axe, mace, war hammer, staff, halberd; shaman, hobgoblin, brute | A deep, slow whoosh with weight: a low air push, a creak of leather at the start. |
| `battle.swing.thrust` | 1 | 4 | 250 | spear | A short, rising air stab, tighter than a swing, a wooden shaft rattle. |
| `battle.swing.claw` | 1 | 4 | 300 | troll, armoured troll, horror, salamander | A swipe: fleshy air, a low breathy grunt under it (pitched-down, filtered). |
| `battle.swing.bite` | 1 | 3 | 250 | giant spider | A fast hiss into a wet snap of mandibles. |
| `battle.shot.bow` | 1 | 5 | 400 | bow, longbow, Hawkeye Bow; archer | The string's twang (a plucked low-mid tone, short) and the arrow's first whoosh away. |
| `battle.shot.crossbow` | 1 | 4 | 400 | crossbow; crossbowman | A mechanical trigger clack, a heavy string thunk, a short bolt whoosh. |
| `battle.shot.wand` | 1 | 5 | 400 | Wand of Sparks, Wand of Storms; bandit mage | A crackling electric zap that throws a sparkly whoosh; bright, not sci-fi laser. |

#### 4.1.2 Battle: weapon impacts and outcomes (groups `impact`, `sweetener`)

Played at `impactMs(event)`. A hit plays the class's impact; layered on top, when they apply, a sweetener for metal armour, a critical, each rune element (at most two) and a Life rune's heal.

| Cue | W | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- | --- |
| `battle.hit.slash` | 1 | 6 | 350 | blades, axe, halberd, goblin | A wet flesh/leather cut with a bright metal edge transient and a low thump; small room. |
| `battle.hit.crush` | 1 | 6 | 400 | mace, war hammer, staff, bare hands, shaman, hobgoblin | A dull heavy body blow: low thud, cracking wood or bone texture, no edge. |
| `battle.hit.pierce` | 1 | 6 | 300 | dagger, rapier, spear, bow, crossbow, kobold | A tight thunk: an arrow or point burying in leather and flesh, a quick high tick at the start. |
| `battle.hit.claw` | 1 | 5 | 350 | claws and bites | Tearing: a flesh rip and a slap, rougher and wetter than a slash. |
| `battle.hit.magic` | 1 | 4 | 350 | wands | A crackling pop with a short electric fizz tail. |
| `battle.armor.metal` | 1 | 5 | 300 | sweetener: a hit on a defender in metal (5.3) | A clank of plate or mail: a short ringing metal impact, high-passed, with a jingle of rings. |
| `battle.hit.crit` | 1 | 4 | 500 | sweetener: any critical (attack, spell, area) | A heavier sub-thump and a bright crack transient, with a short low tail; makes the hit land "twice as hard". |
| `battle.miss.swing` | 1 | 4 | 250 | a melee miss | The blade passing through air close by: a doppler-like whoosh-by, no impact. |
| `battle.miss.shot` | 1 | 4 | 300 | a ranged miss (bow, crossbow) | An arrow whizzing past and a soft thud into earth. |
| `battle.miss.magic` | 1 | 3 | 400 | a wand or hostile spell missing everyone | A fizzle: the charge dispersing, a descending crackle. |
| `battle.hit.image` | 1 | 3 | 500 | a hit that struck a mirror image | A glassy shimmer shattering into high tinkles; no body sound. |
| `battle.element.fire` | 1 | 2 | 300 | sweetener: Ember on-hit; (spells use their own impacts) | A short flare and sizzle. |
| `battle.element.frost` | 1 | 2 | 300 | Rime on-hit | A crisp ice crackle. |
| `battle.element.lightning` | 1 | 2 | 300 | Storm on-hit | A sharp electric snap. |
| `battle.element.acid` | 1 | 2 | 300 | Acid on-hit; Corroded tick | A wet hiss and bubble. |
| `battle.element.poison` | 1 | 2 | 300 | poison on-hit; Poisoned tick | A low, gurgling hiss. |
| `battle.element.blight` | 1 | 2 | 300 | a bane entry (Dawn), blight on-hit | A bright holy chime with a dark reversed swell under it. |
| `battle.heal.small` | 1 | 3 | 400 | Life rune heal, Drain Life's drain | A quick warm upward shimmer, softer than a spell's heal. |
| `battle.regen` | 1 | 3 | 600 | `regenerate` (trolls) | Wet flesh knitting: slow squelch and creak, organic, faintly disgusting. |

#### 4.1.3 Battle: spells and area abilities (groups `release`, `impact`)

A cast plays its **cast** cue at 0 ms and its **impact** at `impactMs`. Spells are mapped by element and school (5.3); overrides are named below.

| Cue | W | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- | --- |
| `battle.cast.arcane` | 1 | 3 | 500 | hostile spells without element: Magic Arrow, Sleep | A mystic intake: a breathy rising shimmer with a soft tonal hum. |
| `battle.cast.fire` | 1 | 3 | 600 | fire: Flame Arrow, Fireball | Ignition: a match-strike scrape blooming into a flame whoosh. |
| `battle.cast.frost` | 1 | 3 | 600 | frost: Frost Blast | Cold wind with a crystalline crackle forming. |
| `battle.cast.storm` | 1 | 3 | 500 | lightning: Lightning Bolt | An electric charge rising in pitch, a buzz. |
| `battle.cast.venom` | 1 | 3 | 600 | acid and poison: Acid Arrow, Death Cloud | A wet bubbling hiss gathering. |
| `battle.cast.shadow` | 1 | 3 | 700 | Drain Life, Curse, Bane, Dark Shield | A low dark whoosh, a reversed breath. |
| `battle.cast.holy` | 1 | 3 | 700 | healing school, Bless | A warm swell: soft choir-like pad (synthesised) and a bell strike. |
| `battle.cast.ward` | 1 | 3 | 600 | support school: Shield, Protect, Haste, Mirror Image | A bright rising shimmer, glassy. |
| `battle.impact.arcane` | 1 | 4 | 400 | Magic Arrow | A clean magical pop with a sparkle tail. |
| `battle.impact.fire` | 1 | 4 | 700 | Flame Arrow; Fire Spit | A flame burst: whoomph, sizzle, short crackle. |
| `battle.impact.fireball` | 1 | 3 | 1400 | Fireball | An explosion: sub boom, noise burst, a fire whoosh, a crackling tail; the loudest spell. |
| `battle.impact.frost` | 1 | 4 | 700 | Frost Blast | Ice shattering: crunchy transient, glassy debris tinkles. |
| `battle.impact.lightning` | 1 | 3 | 900 | Lightning Bolt | A thunder crack: sharp snap, then a rumbling tail. |
| `battle.impact.acid` | 1 | 4 | 700 | Acid Arrow | A splash and a strong sizzle. |
| `battle.impact.poison` | 1 | 3 | 1200 | Death Cloud | A gas cloud: a soft burst into a long, low hiss. |
| `battle.impact.shadow` | 1 | 4 | 800 | Drain Life | A dark thud, a sucking reverse swell. |
| `battle.impact.hex` | 1 | 3 | 800 | Sleep, Curse, Bane | A descending, dissonant, glassy shimmer: eerie, not violent. |
| `battle.impact.web` | 1 | 3 | 500 | Web (spell and spider ability) | A sticky splat with stretching fibres. |
| `battle.impact.heal` | 1 | 3 | 900 | healing spells, a world-map heal | A warm rising chime with sparkle; consonant, gentle. |
| `battle.impact.buff` | 1 | 3 | 700 | Shield, Protect, Bless, Haste, Mirror Image, Dark Shield | A bright shimmer ring settling around the target. |
| `battle.ability.spit` | 1 | 3 | 600 | Fire Spit (release) | A throaty reptile hiss into a fire whoosh. |
| `battle.ability.web` | 1 | 3 | 400 | Spider Web (release) | A fast silk "thwip". |

#### 4.1.4 Battle: falls, steps, turns (groups `death`, `step`; the hero's toll `sweetener`)

| Cue | W | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- | --- |
| `battle.death.human` | 1 | 4 | 1000 | heroes, bandits | A body and its gear collapsing: knees, then the body and armour hitting earth; a short exhale; no scream. |
| `battle.death.goblinoid` | 1 | 4 | 900 | goblin, kobold, shaman, hobgoblin | A high yelp or squeal (pitched creature vocal), then a light fall. |
| `battle.death.brute` | 1 | 3 | 1400 | troll, armoured troll | A low dying groan and a heavy ground-shaking thud. |
| `battle.death.spider` | 1 | 2 | 1000 | giant spider | A chittering screech and legs crumpling (dry clicks). |
| `battle.death.salamander` | 1 | 2 | 1000 | salamander | A long hiss dying, a wet flop, embers fizzing out. |
| `battle.death.horror` | 1 | 1 | 2500 | Blight Horror | A layered, unique death: an inhuman roar collapsing into a reversed swell and a deep rumble. |
| `battle.death.hero` | 1 | 2 | 1500 | sweetener on a hero's fall (permadeath) | A low, distant bell toll with a soft string-like drone; mournful, quiet. |
| `battle.step.armored` | 1 | 8 | 250 | heroes and bandits in metal, hobgoblin | A boot on grass and earth, with a mail jingle. |
| `battle.step.light` | 1 | 8 | 200 | everyone else on two legs | A soft footfall on grass. |
| `battle.step.heavy` | 1 | 6 | 400 | troll, armoured troll, horror | A heavy thud with low end and a little debris. |
| `battle.step.skitter` | 1 | 4 | 300 | giant spider, salamander | Several quick dry clicks or scrapes. |
| `battle.turn.player` | 2 | 2 | 800 | the player's turn begins (group `release`) | A soft low drum and a short low horn swell. |
| `battle.turn.enemy` | 2 | 2 | 800 | the enemy's turn begins | A low ominous drum. |

#### 4.1.5 World map and encampment (group `world`)

| Cue | W | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- | --- |
| `world.confront` | 1 | 2 | 1500 | `confronting` | A tense stinger: a low drum hit and a dissonant low string or brass stab. |
| `world.sighted` | 1 | 2 | 1200 | `sighted` (not the Source) | A distant war horn or two drum hits, reverberant and low. |
| `world.source` | 1 | 1 | 3000 | `sighted` with `source` | An ominous swell: low drone, a dark choir-like pad, a rumble; plays as the cutscene begins (ducked under its narration). |
| `world.threatened` | 1 | 2 | 1500 | `site_threatened` | A single distant warning bell toll. |
| `world.captured` | 1 | 2 | 1500 | `site_captured` | A banner flap and a bright two-note horn or chime. |
| `world.lost` | 1 | 2 | 1800 | `site_lost`, `tower_lost` | A low toll and crumbling wood and stone. |
| `world.build` | 1 | 3 | 1200 | `tower_built`, `outpost_built` | Hammer knocks on wood, a creak, a final settle. |
| `world.arrive` | 1 | 3 | 500 | `arrived`, `met` | Boots stopping, a pack set down, a soft chime. |
| `world.step` | 2 | 6 | 200 | each hex the selected party walks | A very soft march step. |
| `world.camp` | 2 | 2 | 1500 | Camp, Camp until healed | Kindling catching and crackling. |
| `world.yield` | 2 | 2 | 600 | a day with `yield` events | A soft clink of coin and material. |
| `world.upgrade` | 1 | 2 | 1500 | a facility built or raised (`improveFacility`) | Hammering and a sawing stroke, ending in a rising chime. |
| `world.coins` | 1 | 4 | 500 | a buy or sell at the trading post (items, runes, materials) | Coins counted onto wood, a pouch shake. |
| `world.craft` | 1 | 3 | 900 | a craft at the workshop or in the field | Two or three anvil strikes and a file scrape. |
| `world.rune.embed` | 1 | 3 | 700 | embed | A crystalline click and a short magic hum locking in. |
| `world.rune.fuse` | 1 | 2 | 1300 | fuse | A swelling hum resolving in a chime pop. |
| `world.rune.extract` | 1 | 2 | 700 | extract | A reversed shimmer and a pop. |
| `world.recruit` | 2 | 2 | 1200 | a recruit at the guild hall | A quill scratch and a short welcoming horn. |

#### 4.1.6 Interface (group `ui`)

| Cue | W | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- | --- |
| `ui.click` | 1 | 4 | 60 | a button or list line pressed, portrait clicks, slider release, story Next | A short dry tick: wood or leather, 1.5 to 3 kHz body, tiny low thump, no tail; tactile, not electronic. |
| `ui.confirm` | 1 | 3 | 250 | a committing action with no sound of its own: Begin, Form party, Rename kept, Recruit (W1); an action with its own success sound (a buy, a craft) plays only that | A click and a soft rising wooden-mallet note. |
| `ui.back` | 1 | 3 | 120 | Close, Back, Leave, Esc closing a panel | A softer, lower click with a slight downward pitch. |
| `ui.tab` | 1 | 4 | 150 | a tab switch (character panel, trading post, crafting, tree tabs) | A parchment flick. |
| `ui.error` | 1 | 3 | 200 | any action the game refuses (a refusal message is shown) | Two dull muted wood knocks, low; not a buzzer. |
| `ui.learn` | 1 | 2 | 700 | a skill-tree node taken | A parchment stamp and a soft rising bell chime. |
| `ui.gear` | 1 | 6 | 300 | equip, stow, drop, pick up (battle and world map) | A leather and metal rustle: buckle clink, cloth. |
| `ui.hover` | 2 | 4 | 40 | pointer over a framed button | A barely audible tick, 10 dB under `ui.click`. |

#### 4.1.7 Stings (group `sting`)

| Cue | W | Var | ~ms | Played for | Sound brief |
| --- | --- | --- | --- | --- | --- |
| `stings.victory` | 1 | 1 | 3000 | `battle_end` won | A short triumphant brass-and-drum flourish, resolving major. |
| `stings.defeat` | 1 | 1 | 3500 | `battle_end` lost; the encampment lost | A slow falling minor phrase, low strings and a final low drum. |
| `stings.level_up` | 1 | 1 | 1800 | the victory screen, when any member gained a level | A bright ascending arpeggio (harp or bells) with a shimmer. |

Totals: 85 W1 cues (284 variants, about 167 s of audio) and 7 W2 cues (20 variants, about 11 s); by bank, battle 119 s, world 45 s, UI 6 s, stings 8 s. With the 50 ms gaps between markers and the encode rates of 5.5, that is about 1.5 MB per format, half the 3 MB budget.

### 4.2 When world sounds play

`WorldScene` already tells a walk, a day or an `advance` by one message. With that message, it plays the cues `worldSounds(events, partyEvents)` returns: one cue per kind of event, the two highest in this priority, the second 250 ms after the first:

`encampment_lost` (`stings.defeat`) > `confronting` > `sighted` Source > `site_lost`/`tower_lost` > `sighted` > `site_threatened` > `site_captured` > `tower_built`/`outpost_built` > `arrived`/`met`.

`level_changed`, `spawned` (told only when sighted, which `sighted` covers), `order_done` and `yield` (W2) play nothing. Only events the message tells play: the walk's events for a walk, the days' for `advance`. A building raised by the party's own day action (a tower or an outpost) plays `world.build`; a field craft or embed returned through `CraftedData` plays `world.craft` or `world.rune.embed`.

### 4.3 When encampment and interface sounds play

- Every current `sfx_ui_click` site plays `ui.click`, except where the table in 4.1.6 names another cue: close/back/leave buttons `ui.back`, tab buttons `ui.tab`, the committing buttons `ui.confirm`.
- An action that returns a refusal (every module's `… | null` refusal convention: trading, crafting, runecraft, the guild hall, buildings, `orderAction`, the footer's refused days, a battle click with `noStrikeHint`) plays `ui.error` instead of its success sound.
- Success sounds: `improveFacility` `world.upgrade`; buying or selling `world.coins`; `craft` `world.craft`; `embed`, `fuse`, `extract` their rune cues; taking a node `ui.learn`; any gear change in the inventory `ui.gear`; a world-map heal cast `battle.impact.heal`.
- The victory screen: `stings.victory` from the `battle_end` event as today, then `stings.level_up` when any member's `levelsGained > 0`, starting 150 ms after the victory sting's marker ends.

### 4.4 Variation and limits

- **Variant choice:** a shuffle bag per cue: all markers in a random order, refilled when empty, never starting a new bag with the marker that ended the last one. So a cue never plays the same marker twice running, and over n plays of a cue with v variants each marker is used `floor(n/v)` or `ceil(n/v)` times.
- **Jitter:** each play adds a detune drawn uniformly from ±`detuneCents` and a volume offset from ±`volumeJitterDb`, per cue (defaults in 5.3).
- **Randomness** comes from `Math.random` held by the player. The battle's `mulberry32` is never passed to or reachable from audio code.
- **Limits:** a cue may declare `maxVoices` (simultaneous plays of that cue; a play beyond it is dropped) and `minGapMs` (a play within that time of the last is dropped). Footsteps: `maxVoices` 3. Impacts: 3. `ui.hover`: 1, `minGapMs` 50. Element sweeteners: 2. A global cap of 24 effects-and-ui voices drops the newest beyond it.
- **Limiter:** with Web Audio, the player inserts a `DynamicsCompressorNode` between Phaser's master gain and the destination (threshold −6 dBFS, knee 3, ratio 20, attack 3 ms, release 150 ms), a safety net that is inaudible at normal levels.

### 4.5 Narration: the player's experience

- A voiced beat's line starts `LINE_DELAY_MS` (150 ms) after the beat is drawn, on the voice bus; music ducks 10 dB while it plays (attack 150 ms, release 600 ms after it ends or is cut).
- **Next** (click, Space, Enter, the button) cuts the line with an 80 ms fade and draws the next beat, whose own line then starts. The reader is never held: there is no auto-advance in v1 (the manifest's `durationMs` keeps it possible later).
- **Esc / Skip** stops the line with the same fade and skips as today. Leaving the story (Continue on the last beat) stops any line and releases the duck.
- **Subtitles:** the beat's `text` is always shown; it is the subtitle. There is no subtitle setting.
- An unvoiced beat (the leader's, or any beat without `line`) is silent, as today. A beat whose file is missing, failed to load, or the voice slider at 0 is silent too and nothing else changes.
- Voice lines load in `StoryScene.preload` with the cutscene's backdrops, not at boot.

### 4.6 Decision: tutorial tips are not narrated in v1

The record left open whether tutorial tips are narrated. **Recommendation, adopted by this design: no, not in v1.**

- A tip is an instruction read while the eye is on the control it points at; speech competes with that rather than helps. Indie tactics games of this kind rarely voice tutorials.
- Tips change whenever the interface changes, and each change would need a re-render and a listening pass; they are all placeholders today.
- A tip's title may carry `{encampment}`, and its text will name keys and controls that read better than they sound.
- The mechanism costs nothing to extend: a tip would take the same optional fields as a beat, the exporter would read `TUTORIAL`, and `StoryScene` would play it as it shows. Nothing in this design prevents it. The user can reverse the decision without a redesign.

### 4.7 Settings

The options view has four sliders: **Master, Sound FX, Music, Voice**. Sound FX covers the `effects` and `ui` buses (D6). Releasing the Sound FX or Master slider plays `ui.click` at the new level, as today; releasing Voice plays nothing in W1 (W2: a short narrator sample). Saved settings without `voice` load it at 1.

## 5. Technical design

### 5.1 Layout (proposed)

```
audio/                            text sources (like art/)
  CLAUDE.md                       workflow for this directory
  audio.toml                      sample rate, groups' loudness targets, encode settings, banks, voice post-processing
  sources.toml                    provenance of every source and reference clip
  sources/<collection>/*.flac     trimmed CC0 / own excerpts, mono, 48 kHz
  impulses/*.flac                 reverb impulse responses (synthesised by the tool, licence "own")
  sfx/<bank>/<name>.toml          one recipe per cue
  voices.toml                     the voice registry
  voices/<voice>/<emotion>.flac   reference clips (made by voice design, licence "own")
  sfx.manifest.json               generated: cues, markers, durations, input hashes, bank file hashes
  voice.manifest.json             generated: rendered lines
  bakeoff/                        gitignored: the listening test's renders and scoring sheet
  narration.jobs.json             gitignored: the exporter's job list
tools/audio/                      the uv project (Python 3.11): CLI `yomi-audio`, DSP, recipe interpreter, TTS adapters, pytest
public/assets/audio/sfx/          generated: <bank>.opus, <bank>.mp3, <bank>.json (Phaser audio sprite)
public/assets/audio/              music_battle / music_world_map (unchanged), README.md
public/assets/voice/              generated: <lineId>.opus, <lineId>.mp3, README.md
scripts/narration.ts              exporter: CUTSCENES -> jobs + hashes (Node, native TS)
src/scenes/sounds.ts              cue table, eventSounds, worldSounds, pickVariant (Phaser-free)
src/scenes/soundPlayer.ts         thin Phaser player: playCue, music, ducking, limiter, audio log
src/scenes/audioSettings.ts       + voice, busVolume
src/scenes/storyAudio.ts          which line a beat plays, its files, duck constants (Phaser-free)
src/story/narration.ts            the line rules shared by the exporter and the tests (Phaser-free): spokenText, lineHash, the tag set
```

npm scripts (host only, like `sprites`): `sounds` (`uv run --project tools/audio yomi-audio sfx build`), `sounds:check` (`… sfx check`), `narration` (`node scripts/narration.ts && uv run --project tools/audio yomi-audio voice render`), `narration:check` is not needed (the vitest test covers staleness). The deleted placeholder WAVs (`sfx_*`, `music_victory.wav`, `music_defeat.wav`) leave `public/assets/audio/`.

### 5.2 Sources and provenance

**Collections, in order of preference** (each pack's or file's licence is verified as CC0 at sourcing and recorded; a source with any other licence is refused by the build):

1. **Kenney audio packs** (kenney.nl, CC0, a `License.txt` in each zip, downloadable without an account): *Impact Sounds* (footsteps on several surfaces; metal, plate, wood, glass, punch and soft impacts), *RPG Audio* (cloth, leather, metal clicks, coins, knife slices, chops, book and creak), *UI Audio* and *Interface Sounds* (clicks, switches, rollovers), *Music Jingles* (the stings' base), *Casino Audio* (coins and chips), *Sci-fi Sounds* (zaps and charges, only heavily processed as magic layers).
2. **OpenGameArt, CC0 only** (licence filter "CC0"; the file's page states it): e.g. the CC0 creature, impact and breaking/falling collections by rubberduck, for creature vocals and body falls. Each is verified at sourcing.
3. **Freesound, CC0 only** (licence filter "Creative Commons 0"), for what the above lack: fire whooshes and crackle, ice and glass, thunder, gas hiss, bells, creature growls. Downloading originals needs a free account (section 8, Q1).
4. **Synthesis and own recordings** (`own`): whooshes, sub thumps, magic tones, chimes, impulses, UI ticks; anything the user records.

Sonniss and every non-redistributable pack are excluded (D2).

**A source entry** in `audio/sources.toml`; the build refuses a recipe naming a source that is missing, whose committed file's SHA-256 differs, or whose `licence` is not in the allow-list `["CC0-1.0", "own"]`:

```toml
[[source]]
id = "kenney_impact_plate_heavy_2"
file = "sources/kenney_impact/impact_plate_heavy_2.flac"
licence = "CC0-1.0"
author = "Kenney (kenney.nl)"
url = "https://kenney.nl/assets/impact-sounds"          # the page the licence is stated on
original = "Audio/impactPlate_heavy_002.ogg"            # path or name in the pack or site
original_sha256 = "…"                                  # of the downloaded original, when kept
excerpt = { start = 0.0, end = 0.62 }                   # seconds of the original kept
sha256 = "…"                                           # of the committed FLAC
retrieved = "2026-11-20"
notes = "mono sum, trimmed"

[[source]]
id = "voice_narrator_grave"
file = "voices/narrator/grave.flac"
licence = "own"
author = "generated: Qwen3-TTS VoiceDesign (Apache-2.0)"
design = { model = "Qwen/Qwen3-TTS-…-VoiceDesign", revision = "<hf commit>", seed = 7, description_ref = "voices.toml#narrator", instruction = "…", text = "…" }
sha256 = "…"
```

`yomi-audio source add <file> --id … --licence … --url … --author … [--start s --end s]` trims, sums to mono, resamples to 48 kHz, writes the FLAC and appends the entry with its hashes. Committed sources stay under 15 MB.

### 5.3 The runtime cue table (`sounds.ts`)

- `audio/sfx.manifest.json` is imported (enable `resolveJsonModule`); `CueId = keyof typeof manifest.cues`, a literal union. `CUES: Record<CueId, CueSpec>` declares, per cue, `bus` (`effects` or `ui`; the stings `music`), `gainDb` (default 0, as loudness is set offline), `detuneCents` (default 40; footsteps 100; ui 20; stings and `world.source` 0), `volumeJitterDb` (default 1.5; ui 0.5; stings 0), `maxVoices`, `minGapMs`. A cue in the manifest without an entry, or the reverse, is a type error.
- `SoundContext`, supplied by `BattleScene` (as `attackLook` takes `heldIcon`): `kind(unit): UnitKind`, `held(unit): ItemIcon | null` (a hero's main hand; null otherwise or bare-handed), `body(unit): ItemIcon | null` (a hero's body armour).
- `eventSounds(event, context): SoundCue[]` with `SoundCue = { cue: CueId; delayMs: number }`:
  - `attack`: `release` at 0; at `impactMs(event)`: on a hit that struck no image, the class's `hit`, plus `battle.armor.metal` if the defender is in metal, plus `battle.hit.crit` if critical, plus `battle.element.<e>` for the first two `bonus[]` entries with damage > 0 (a bane entry `blight`) at +30 ms, plus `battle.heal.small` at +60 ms if `healed > 0`; on an image `battle.hit.image`; on a miss the class's `miss`. With no context for a unit, a melee attack falls back to the `blade` class and a shot to `bow`.
  - `cast`: `spellSound(spell).cast` at 0; at `impactMs`: a friendly spell's impact; a hostile spell's impact if any outcome struck (not an image), with `battle.hit.crit` if any was critical, else `battle.hit.image` if only images were struck, else `battle.miss.magic`; `battle.heal.small` at +150 ms if `drained > 0`.
  - `ability`: its release (`ABILITY_SOUNDS`) at 0 and its impact at `impactMs` when anything struck (a `half` with damage counts), else `battle.miss.magic`. A routine's strikes are attacks and sound by the attacker's class.
  - `status_tick`: `battle.element.<STATUSES[status].element>`, nothing when it has none. `regenerate`: `battle.regen`. `unit_down`: `DEATH[kind]`, plus `battle.death.hero` at 0 for a `warrior`. `move`: `STEP[class]` at `i * MOVE_STEP_MS + MOVE_STEP_MS / 2` for each hex `i` of `path` (`MOVE_STEP_MS` moves to `battleEffects.ts` so the helper can read it). `battle_end`: the sting at `STING_DELAY_MS`. `end_turn` (W2): the turn cue for the side about to act. Others: nothing.
- **Tables** in `sounds.ts`, keyed like `GEAR_SPRITES`:
  - `WEAPON_SOUNDS: Partial<Record<ItemIcon, AttackSound>>` and `FOE_SOUNDS: Record<FoeKind, AttackSound>` with `AttackSound = { release: CueId; hit: CueId; miss: CueId }`, per the "played for" columns of 4.1.1 and 4.1.2 (`miss` is `battle.miss.swing` for melee, `battle.miss.shot` for bows and crossbows, `battle.miss.magic` for wands). A test asserts every weapon family's icon in `FAMILIES` (main hand) has an entry, as `unitLook.test.ts` does for sprites.
  - `METAL`: the defender is in metal when its body icon is `armor` or `plate`, or its kind is `hobgoblin`, `armored_troll`, `bandit_brute` or `bandit_captain`.
  - `spellSound(id)`: `SPELL_SOUND_OVERRIDES[id]` if present, else by `SPELLS[id]`: hostile with element `fire|frost|lightning|acid|poison` → `cast.fire|frost|storm|venom|venom` and `impact.fire|frost|lightning|acid|poison`; hostile without element → `cast.arcane`, `impact.arcane`; healing school → `cast.holy`, `impact.heal`; support → `cast.ward`, `impact.buff`. Overrides: Fireball's impact `impact.fireball`; Sleep, Curse, Bane `impact.hex` (Curse and Bane cast `shadow`); Drain Life `cast.shadow`, `impact.shadow`; Bless `cast.holy`; Dark Shield `cast.shadow`; Web `cast.arcane`, `impact.web`. A spell added on another branch (the skill trees add spells) sounds by its element and school with no entry needed.
  - `ABILITY_SOUNDS: Partial<Record<AbilityId, { release; impact }>>`: `fire_spit` (`ability.spit`, `impact.fire`), `spider_web` (`ability.web`, `impact.web`).
  - `DEATH: Record<UnitKind, CueId>` and `STEP: Record<UnitKind, …>` resolved with the body icon (a hero or a metal-clad bandit `armored`, else per 4.1.4).
- `worldSounds(events: readonly (WorldEvent | PartyEvent)[]): SoundCue[]` implements 4.2.
- `pickVariant(state, cue, random): { marker; detune; volume }` is pure over a `VariantState` (the bags and last markers), taking a `random: () => number`.

### 5.4 The player (`soundPlayer.ts`) and settings

- `playCue(scene, cue, delayMs = 0)`: checks limits, calls `pickVariant` with `Math.random`, then `scene.sound.playAudioSprite(bank, marker, { volume: busVolume(bus) × dB(gainDb + jitter), detune })`, through `scene.time.delayedCall` when delayed. A missing bank or marker returns quietly (R16).
- `playCues(scene, cues)` for the lists of `eventSounds` and `worldSounds`.
- Music: `startMusic(scene, key)` / `pauseMusic` / `resumeMusic` / `stopMusic` replace `BattleScene`'s and `WorldScene`'s own handles, registering the playing theme so `duck(scene, on)` can tween its volume to `busVolume('music') × dB(-10)` and back, and so a slider change reapplies the level.
- `installLimiter(game)` once from `BootScene.create` (Web Audio only).
- A bounded dev log of the last 50 plays (`{ cue, marker, bus, at }`), exposed by `main.ts`'s dev hook as `__yomi.audioLog()` for the in-browser tests; game code never reads it.
- `audioSettings.ts`: `AudioSettings` gains `voice` (default 1); `busVolume(bus, settings)` = channel level × `BUS_BASE[bus]`, where `ui` and `effects` read `effects`, `music` reads `music`, `voice` reads `voice`. `BUS_BASE`: effects 1, ui 1, voice 1, music `MUSIC_BASE` (5.5). `soundVolume`, `SOUND_KEYS`, `SoundKey`, `SOUND_VOLUME`, `MUSIC_VOLUME` are removed.
- `BootScene.preload` loads the four banks with `load.audioSprite(bank, 'assets/audio/sfx/<bank>.json', ['…opus', '…mp3'])` and the two themes as today.

### 5.5 Mixing and loudness

Loudness is set offline so that runtime gains stay near 1. Measures: **LUFS-M max** (maximum momentary loudness, BS.1770 K-weighting, 400 ms window, the sound padded with silence to at least 400 ms) for short effects; **LUFS-I** (integrated) for stings, music and speech; **dBTP** true peak at 4x oversampling. Targets live in `audio.toml`; a recipe names its `group`; the build normalises the variant to the target and fails if the peak then exceeds the ceiling (it applies a limiter in the post chain only when the recipe asks for one).

| Group | Target | Tolerance | Peak ceiling |
| --- | --- | --- | --- |
| `ui` | −26 LUFS-M max | ±1 LU | −6 dBTP |
| `step` | −30 LUFS-M max | ±1.5 LU | −10 dBTP |
| `release` (swings, shots, casts, ability releases) | −22 LUFS-M max | ±1 LU | −3 dBTP |
| `impact` (hits, spell impacts, misses, image) | −19 LUFS-M max | ±1 LU | −1 dBTP |
| `sweetener` (armour, crit, elements, small heal, regen, hero toll) | −24 LUFS-M max | ±1.5 LU | −3 dBTP |
| `death` | −20 LUFS-M max | ±1 LU | −1 dBTP |
| `world` | −22 LUFS-M max | ±1 LU | −2 dBTP |
| `sting` | −18 LUFS-I | ±1 LU | −1 dBTP |
| `voice` | −18 LUFS-I | ±1 LU | −1.5 dBTP |
| music themes (as played) | −24 LUFS-I effective | ±1 LU | n/a |

- **Music level:** the themes are not re-encoded. The plan measures each theme's LUFS-I once and sets `MUSIC_BASE = 10^((-24 - measured)/20)` (one value for both if they are within 1 LU, else a per-theme gain in the cue table); the measurement is recorded in `public/assets/audio/README.md`. Today's `MUSIC_VOLUME` 0.2 is the starting point to compare by ear.
- **Ducking:** music −10 dB under a voice line (so about −34 LUFS against speech at −18); effects are not ducked (the story's only effects are clicks).
- **Encode:** SFX banks Opus mono 48 kHz 64 kbps VBR, MP3 mono VBR `-q:a 5`; voice Opus mono 32 kbps (speech application), MP3 mono VBR `-q:a 7`. Markers are separated by 50 ms of silence.

### 5.6 The recipe format

TOML, one cue per file. Top level: `variants` (count), `seed`, `group`, optional `max_ms`. `[[layer]]` entries are mixed after their offsets; `[post]` runs on the mix. Per variant `k`, the interpreter seeds numpy's generator from `(seed, k)`, so variant `k` is fixed.

- **Variation:** any numeric field may be `[lo, hi]` (uniform per variant). `pick = [ids…]` chooses a source per variant from a deterministic shuffle of the list, without repeats until the list is used up. `chance = 0.5` includes the layer in a variant with that probability.
- **Layer fields:** `source` or `pick` or `synth`; `gain` (dB), `offset` (ms), `pitch` (semitones, by resampling, so it changes length), `start`/`length` (ms, trims the source), `reverse`, `fade_in`/`fade_out` (ms), `envelope` (points `[[ms, dB], …]`, linear in dB between points), `filter` (a list, below), `saturate` (drive dB).
- **Synthesis** (`synth = { kind = …, … }`): `sine|triangle|saw|square` (`hz`, `hz_end`, `curve` `lin|exp`); `noise` (`color` `white|pink|brown`); `fm` (`carrier_hz`, `ratio`, `index`, `index_end`); `crackle` (`density` clicks a second, `click_ms`); `impulse` (a single click). Each needs `length`.
- **Filters:** `highpass`, `lowpass`, `bandpass` (`hz`, `q`), with optional `hz_end` to sweep over the layer; `peak` (`hz`, `gain_db`, `q`); `lowshelf`, `highshelf` (`hz`, `gain_db`).
- **Post chain:** `compress` (`threshold_db`, `ratio`, `attack_ms`, `release_ms`), `saturate`, `reverb` (`impulse`, `wet_db`, `predelay_ms`, by convolution), `delay` (`ms`, `feedback`, `wet_db`), `limit` (`ceiling_db`), `trim` (`threshold_db`, `keep_tail_ms`), `fade_out` (`ms`). Loudness normalisation to the group target is always last.
- Runtime hints (bus, jitter, limits) are not in recipes (brief 3.3); they are in `CUES`.

**Example 1, a weapon impact** (`audio/sfx/battle/hit.slash.toml`):

```toml
# A blade biting home: a flesh cut, a bright edge, weight, a small room.
variants = 6
seed = 11
group = "impact"
max_ms = 500

[[layer]]                          # the body of the hit
pick = ["rpg_knife_slice_1", "rpg_knife_slice_2", "fs_flesh_hit_3", "oga_hit_flesh_7"]
pitch = [-2.0, 1.0]
filter = [{ type = "highpass", hz = 120 }]

[[layer]]                          # the edge
source = "kenney_impact_metal_light_2"
gain = [-12, -8]
pitch = [0.0, 3.0]
filter = [{ type = "highpass", hz = 2500 }]
fade_out = 60

[[layer]]                          # weight
synth = { kind = "sine", hz = 90, hz_end = 45, curve = "exp", length = 70 }
envelope = [[0, 0], [5, 0], [70, -60]]
gain = -9

[post]
chain = [
  { type = "compress", threshold_db = -16, ratio = 3, attack_ms = 1, release_ms = 50 },
  { type = "reverb", impulse = "small_room", wet_db = -18, predelay_ms = 6 },
  { type = "trim", threshold_db = -55, keep_tail_ms = 40 },
  { type = "fade_out", ms = 25 },
]
```

**Example 2, a spell impact mostly synthesised** (`audio/sfx/battle/impact.fireball.toml`):

```toml
# Fireball: sub boom, a noise burst opening up, a fire whoosh, a crackling tail.
variants = 3
seed = 23
group = "impact"
max_ms = 1800

[[layer]]                          # sub boom
synth = { kind = "sine", hz = 70, hz_end = 28, curve = "exp", length = 500 }
envelope = [[0, -3], [10, 0], [500, -60]]
saturate = 4

[[layer]]                          # the blast
synth = { kind = "noise", color = "brown", length = 700 }
filter = [{ type = "lowpass", hz = 300, hz_end = 6000, q = 0.7 }]
envelope = [[0, -40], [15, 0], [120, -6], [700, -60]]
gain = [-4, -1]

[[layer]]                          # the flame
pick = ["fs_fire_whoosh_1", "fs_fire_whoosh_2", "fs_fire_whoosh_4"]
offset = [20, 60]
pitch = [-3.0, 0.0]
gain = -6

[[layer]]                          # embers
synth = { kind = "crackle", density = [35, 60], click_ms = 2, length = 900 }
offset = 250
filter = [{ type = "bandpass", hz = 3000, q = 0.8 }]
envelope = [[0, -20], [100, -8], [900, -60]]
gain = -14

[post]
chain = [
  { type = "compress", threshold_db = -14, ratio = 4, attack_ms = 2, release_ms = 120 },
  { type = "reverb", impulse = "open_air", wet_db = -14, predelay_ms = 12 },
  { type = "limit", ceiling_db = -1.5 },
  { type = "trim", threshold_db = -60, keep_tail_ms = 80 },
]
```

**Example 3, a UI tick from synthesis alone** (`audio/sfx/ui/click.toml`):

```toml
# A dry wooden tick: a click through a resonant band and a tiny low thump.
variants = 4
seed = 3
group = "ui"
max_ms = 90

[[layer]]
synth = { kind = "impulse", length = 40 }
filter = [{ type = "bandpass", hz = [1700, 2600], q = 6 }]
envelope = [[0, 0], [30, -48]]

[[layer]]
synth = { kind = "sine", hz = [160, 200], hz_end = 110, length = 25 }
envelope = [[0, -6], [25, -60]]
gain = -12

[post]
chain = [{ type = "fade_out", ms = 8 }]
```

**Impulses** (`small_room`, `stone_hall`, `open_air`) are made by the tool (`yomi-audio impulse build`) as exponentially decaying filtered noise from a short recipe in `audio/impulses/<name>.toml`, committed as FLAC, licence `own`.

### 5.7 The SFX build and check

- `yomi-audio sfx build [--bank B] [--cue C]`: for each recipe whose input hash changed (the recipe's text, every source and impulse it touches, `audio.toml`, and the tool's version from `uv.lock`), render its variants as float PCM, check them (below), then reassemble each touched bank: concatenate variants with 50 ms gaps, encode Opus and MP3 with ffmpeg, write `<bank>.json` in Phaser's audio-sprite shape (`{ resources, spritemap: { "<cue>#<k>": { start, end, loop: false } } }`), and update `audio/sfx.manifest.json`:

  ```json
  { "version": 1, "tool": "yomi-audio 0.1.0",
    "banks": { "battle": { "durationMs": 121400, "opus": { "bytes": 0, "sha256": "…" }, "mp3": { "bytes": 0, "sha256": "…" } } },
    "cues": { "battle.hit.slash": { "bank": "battle", "markers": ["battle.hit.slash#0", "…"], "durationsMs": [312], "inputs": "sha256…" } } }
  ```

- Per-variant checks, which fail the build: loudness within the group's tolerance and peak under its ceiling; length within `max_ms`; no DC offset above 0.5%; no two variants of one cue nearly identical (peak normalised cross-correlation above 0.95); every source licence allowed and hash matching.
- `yomi-audio sfx audition <cue>` writes the variants as WAV into a scratch folder and prints their loudness, for listening while authoring.
- `npm run sounds:check` rebuilds nothing to disk: it recomputes input hashes and fails when a cue's hash differs from the manifest, a recipe exists without a manifest entry or the reverse, a bank file is missing or its hash differs, or a budget is exceeded (shipped SFX 3 MB per format; committed `audio/sources` and `audio/voices` 15 MB together; voice 4 MB per format).
- **Determinism:** same inputs and lock, same PCM (asserted by a pytest that renders a recipe twice and compares hashes). Encoded bytes may differ across ffmpeg builds, which is why the check compares input hashes, not encodes.

### 5.8 Narration

#### 5.8.1 Authoring on a beat

`CutsceneBeat` gains optional fields; a beat is voiced when it has `line`:

```ts
export interface CutsceneBeat {
  text: string
  speaker?: string
  portrait?: PortraitId | 'leader'
  backdrop?: string
  /** A stable id for the spoken line, unique in the game ([a-z0-9_.]+), e.g. 'intro.opening'. Voiced only when set. */
  line?: string
  /** The voice that speaks it, from audio/voices.toml; required with `line`. Never for a `{leader}` speaker. */
  voice?: VoiceId
  /** One of the voice's emotions; 'neutral' when left out. */
  emotion?: Emotion
  /** 0 to 1, how strongly; 0.5 when left out. */
  intensity?: number
  /** What is spoken when the shown text cannot be: no `{…}` templates; may carry nonverbal tags. Defaults to `text`. */
  spoken?: string
  /** Bumped to render the line again with a new seed when a take has a flaw; 0 when left out. */
  take?: number
}
```

`VoiceId` (`'narrator'` in v1) and `Emotion` are unions in `src/story/narration.ts`; a test checks they match `audio/voices.toml`. Rules, enforced by vitest: line ids unique and well-formed; `voice` present with `line` and absent from a beat whose `speaker` is `{leader}` or whose `portrait` is `'leader'`; the spoken text (`spoken ?? text`) contains no `{` or `}`; its nonverbal tags are only `[sigh]`, `[laugh]`, `[chuckle]`, `[gasp]`, `[cough]`, and only for a voice whose engine supports tags; the emotion is one the voice declares; `intensity` within 0 to 1; the spoken text is not empty after tags are removed.

v1 content: `intro`'s first beat (`line: 'intro.opening'`, narrator, `grave`) and `source_sighted`'s beat (`line: 'source.sighted'`, narrator, `tense`), each with a `spoken` that omits "[Placeholder]". The leader's beat stays unvoiced.

#### 5.8.2 The voice registry and the cast

`audio/voices.toml` (the Node side reads it with `smol-toml`, a small BSD-3-Clause devDependency; the Python side with `tomllib`):

```toml
adapter_version = 1

[narrator]
engine = "chatterbox"                # chatterbox | chatterbox_turbo | qwen3_custom
model = "ResembleAI/chatterbox"      # verified at adoption
revision = "<pinned HF commit>"
emotions = ["neutral", "warm", "grave", "tense", "sad", "triumphant", "whisper"]
params = { cfg_weight = 0.5, temperature = 0.8 }

[narrator.design]                    # how the reference clips were made
model = "Qwen/Qwen3-TTS-…-VoiceDesign"
revision = "<pinned HF commit>"
description = "A weathered storyteller in his fifties: low, warm, slightly gravelled, unhurried; neutral British accent; close and dry, no room."
reference_text = "…"                  # a fixed phonetically rich passage of about 9 s, read for every emotion
seed = 7

[narrator.clips]
neutral = "voices/narrator/neutral.flac"
grave = "voices/narrator/grave.flac"
# … one per declared emotion

[narrator.fallback]
engine = "qwen3_custom"
model = "Qwen/Qwen3-TTS-…-CustomVoice"
revision = "<pinned HF commit>"
preset = "<the preset nearest the design, chosen in the bake-off>"
```

**The cast.** Today's cutscenes have no fixed speakers, so v1 ships one voice, **the narrator**. A fixed character (an elder of the encampment, say) is a new table here, its clips, and beats naming it; nothing else changes. The leader is never voiced (D4). The narrator's description is decided in the bake-off between two candidates: A (above) and B, "a woman in her forties: low, resonant, measured, a little husky; neutral British accent; close and dry".

#### 5.8.3 Designing a voice

`yomi-audio voice design <voice>`:

1. **Neutral clip:** Qwen3-TTS VoiceDesign renders the voice's `reference_text` from its `description` and `seed`, N = 4 candidates (seeds `seed`…`seed+3`); the author keeps one by ear. It is about 9 s, trimmed, normalised to −18 LUFS-I, saved as `voices/<voice>/neutral.flac` with a provenance entry.
2. **Emotion clips:** for each other declared emotion, VoiceDesign renders the same text from the same description and seed with the emotion's instruction appended (the table below), N = 4 candidates. Each candidate's **speaker similarity** to the neutral clip is measured with a speaker encoder (Chatterbox's own voice encoder): candidates below cosine 0.75 are discarded as another voice; of the rest the author keeps the one that carries the emotion best.
3. The clip is committed; from then on the engine clones it. **As built (G1, G9):** the narrator is Chatterbox Turbo, which takes one reference clip and ignores exaggeration, so the narrator's only clip is the neutral one (`A_0`, VoiceDesign seed 7); step 15 found emotion clips lowered speaker similarity to it (0.81 to 0.84 against 0.92 to 0.96) and carried little but pace, and the user kept `A_0` alone. A voice on plain `chatterbox` would clone the line's emotion clip (`audio_prompt`) as the paragraph above describes, from clips made by items 1 and 2. Weights live in the Hugging Face cache, outside the repository.

#### 5.8.4 Emotions and their mapping

A closed vocabulary; each voice declares the subset it supports (the narrator: all but `afraid` and `angry`). The adapter maps `emotion` and `intensity` (0 to 1, default 0.5) as follows; the Chatterbox `exaggeration` is interpolated between the two values, `cfg_weight` lowered as exaggeration rises (Chatterbox's guidance, to keep the pace natural).

| Emotion | Reference clip | Exaggeration (0 → 1) | cfg_weight | Qwen3 instruction (clip design and fallback) |
| --- | --- | --- | --- | --- |
| `neutral` | neutral | 0.35 → 0.50 | 0.50 | "Speak calmly and evenly, as a storyteller." |
| `warm` | warm | 0.40 → 0.60 | 0.50 | "Warm, gentle and reassuring." |
| `grave` | grave | 0.40 → 0.65 | 0.45 | "Low, solemn and slow, with gravity." |
| `tense` | tense | 0.50 → 0.80 | 0.40 | "Tense and urgent, hushed but quick." |
| `afraid` | afraid | 0.60 → 0.90 | 0.35 | "Frightened, breath unsteady." |
| `angry` | angry | 0.60 → 1.00 | 0.30 | "Angry and forceful, clipped." |
| `sad` | sad | 0.40 → 0.70 | 0.45 | "Sorrowful and subdued, slow." |
| `triumphant` | triumphant | 0.60 → 0.90 | 0.35 | "Triumphant and rousing, ringing." |
| `whisper` | whisper | 0.30 → 0.50 | 0.50 | "Whispering, breathy and close." |

The fallback engine words intensity into the instruction ("slightly" below 0.34, none to 0.67, "very" above). Nonverbal tags render only with `chatterbox_turbo` (which ignores exaggeration), so a voice uses one control or the other (brief 8). **As built (G1):** v1's narrator is `chatterbox_turbo`, so the table's Reference clip, Exaggeration and cfg_weight columns apply only to a voice on plain `chatterbox`; the narrator's `emotion` is kept as the line's intent (and for the fallback's instruction), but what the listener hears comes from the line's wording and its sound tags (`[sigh]`, `[gasp]`, ...), and from the seed. Words spelled alike and said differently ("the road winds", read as the wind that blows) are not left to the engine: a beat's `spoken` respells or rewords them.

#### 5.8.5 Export, render, manifest

- `scripts/narration.ts` imports `CUTSCENES`, resolves each voiced beat to a job `{ line, spoken, voice: <the voice's resolved table>, emotion, intensity, take, seed, hash }` and writes `audio/narration.jobs.json`. `seed` is the first 32 bits of SHA-256 of `line + '#' + take`. `hash` = SHA-256 of canonical JSON (sorted keys) of `{ spoken, emotion, intensity, take, voice table, the SHA-256 of each of the voice's clips, adapter_version, audio.toml's [voice] table }`. `src/story/narration.ts` holds `spokenText` and `lineHash`, shared by the script and the tests.
- `yomi-audio voice render` reads the jobs, refuses to run if its adapter version differs from `voices.toml`'s, renders only lines whose hash differs from `audio/voice.manifest.json`, post-processes (high-pass 70 Hz; trim silence below −50 dB keeping 120 ms before and 250 ms after; normalise to −18 LUFS-I, −1.5 dBTP), encodes `public/assets/voice/<line>.opus` and `.mp3`, deletes the files of lines no longer in the jobs, and writes the manifest: `{ "lines": { "intro.opening": { "hash": "…", "durationMs": 4120, "voice": "narrator", "engine": "chatterbox@<rev>" } } }`.
- **Adapter** (`tools/audio/yomi_audio/tts/`): `render(job) -> (pcm, sample_rate)` and `fingerprint()`, one module per engine: `chatterbox` (mlx-audio where it supports the model, else the PyTorch MPS package), `chatterbox_turbo`, `qwen3_custom`, `qwen3_design` (used only by `voice design`). Resemble AI's PerTh watermark is in the original `chatterbox` package's output; the mlx port adds none, and the voice README says so.

#### 5.8.6 The listening test (bake-off), the gate before any shipped line

`yomi-audio voice bakeoff` renders, into the gitignored `audio/bakeoff/`, eight lines with blind labels (a separate key file maps labels to configurations):

1. neutral: "Each day the blight creeps a little further from the east, and each day the land remembers less of what it was."
2. warm: "Rest here a while. The fire is small, but it is ours, and it will see us through the night."
3. grave: "Three were lost at the ford. Their names are written now in the guild hall's book, and nowhere else."
4. tense: "Something moves beyond the ridge. Too many feet, too quiet, and coming this way."
5. triumphant: "The Horror falls, and for the first time in a hundred days the wind from the east smells of rain."
6. sad: "The watchtower stood for a season. Now only its stones remember the hands that raised them."
7. whisper: "Listen. Under the wind... the Source is breathing."
8. names and a question: "Who will hold the encampment when the hobgoblins come down past the Salamander Pool, and the kobolds crawl from their warrens?"

Configurations: (a) Chatterbox with narrator A's emotion clips and exaggeration; (b) Chatterbox Turbo with A's neutral clip, lines 3, 6 and 7 carrying `[sigh]`; (c) Qwen3-TTS CustomVoice with instructions; plus narrator B on configuration (a). That is 32 clips. A scoring sheet (`audio/bakeoff/score.md`) asks, per clip, naturalness 1 to 5, emotion fit 1 to 5, same voice as its line 1 (yes/no), mispronunciation or artifact (yes/no, with a note).

**Gate:** a configuration is adoptable when its mean naturalness is at least 4.0, its mean emotion fit at least 3.5, every clip is the same voice, and every artifact is fixed by at most three takes. The user listens, chooses the configuration and the narrator, and the choice is recorded in the feature record's decision log; only then are the shipped lines rendered. If none passes, narration ships as framework only (no voiced beats, silent cutscenes) and the engine choice returns to the user.

#### 5.8.7 Playback (`storyAudio.ts`, `StoryScene`)

- `storyAudio.ts` (Phaser-free): `beatLine(beat, manifest): string | null` (the line id when the beat is voiced and the manifest has it); `voiceFiles(line)`; `linesOf(cutscene)`; constants `LINE_DELAY_MS` 150, `CUT_FADE_MS` 80, `DUCK_DB` −10, `DUCK_ATTACK_MS` 150, `DUCK_RELEASE_MS` 600. It imports `audio/voice.manifest.json`.
- `StoryScene.preload` loads each voiced beat's file as `voice_<line>` beside the backdrops; a load error is ignored. `drawBeat` stops any line (fade), then after `LINE_DELAY_MS` plays the beat's line on the voice bus through `soundPlayer` and ducks; the line's end or cut releases the duck. `skip`, `advance` past the last item, and the scene's shutdown stop it. The probe gains `voice: { line: string | null; playing: boolean }`.

### 5.9 Migration order (for the planner)

1. Runtime first, with today's placeholders: the tool's skeleton, `sources.toml` entries for the eight placeholder WAVs (licence `own`), one recipe per W1 cue pointing at the nearest placeholder, the banks built, `CUES`, `eventSounds` with context, `worldSounds`, `soundPlayer`, the voice bus and slider, every call site moved. The game sounds as today (or more varied in timing), and every hook is in place.
2. Sourcing and the battle bank, melee first, reviewed by ear before the rest (brief's early detection of sample quality).
3. The other banks and stings.
4. Narration: the bake-off and its gate (can run in parallel with 2 and 3), then voice design, the exporter, the render, `StoryScene` playback.

### 5.10 Where this design narrows the brief

- Cue ids are `<bank>.<name>` (the brief's examples `attack.swing.blade`, `hit.blunt` were illustrative).
- The manifests live in `audio/` (`sfx.manifest.json`, `voice.manifest.json`) and are imported by the runtime as JSON, rather than under `public/` (Vite does not import from `public/`); the bank files and voice files stay in `public/`.
- Nonverbal tags are allowed only in `spoken`, which is never displayed, so `fillText` needs no stripping.
- A beat gains `take` (re-render with a new seed) beside the brief's fields.
- The Node exporter reads `voices.toml` with `smol-toml` (a devDependency) to keep the hash in TypeScript as the brief asks.

## 6. Consequences

- **Compatibility:** no save change (`SAVE_VERSION` untouched); `yomi.audio` gains `voice` with a default. No battle rule or event shape changes (`LOG_SCHEMA_VERSION` untouched); audio never touches the seeded RNG, so replays are unchanged and the simulator is unaffected.
- **Repository size:** about 3 MB shipped SFX (both formats), at most 15 MB of committed sources and clips, voice at most 4 MB per format in v1 (about 1 MB with today's lines).
- **Load and memory:** boot loads four bank files (per format) instead of twelve; decoded SFX are about 195 s mono at 48 kHz (gaps included), some 37 MB of float PCM, beside the themes; voice lines load per cutscene.
- **Toolchain:** Python 3.11 under uv, numpy, scipy, soundfile, pyloudnorm, pytest, and for narration mlx-audio / chatterbox and the Qwen3-TTS package; ffmpeg with libopus and libmp3lame. Host only, like sprite-tool; nothing enters the podman image; `npm test` needs none of it.
- **Licences:** shipped SFX derive only from CC0 and own material; speech is generated by MIT (Chatterbox) or Apache-2.0 (Qwen3-TTS) models from designed voices; each model card's licence is rechecked at adoption and recorded in `public/assets/voice/README.md`.
- **Merge with `skill-trees`:** new spells there sound through `spellSound`'s defaults with no table change; new weapon icons would fail the `WEAPON_SOUNDS` coverage test until given an entry, by design.
- **Rollback:** each bank is independent; a bad bank is rebuilt from an earlier recipe. Narration can be removed by deleting a beat's `line`.

## 7. Verification

### 7.1 Acceptance criteria

| ID | Criterion | Req |
| --- | --- | --- |
| AC1 | `grep` finds no `sound.play(` or `sfx_` key in `src/`; every play goes through `playCue` or the music/voice functions of `soundPlayer`. | R1 |
| AC2 | Unit tests: for representative events and contexts, `eventSounds` returns the cues and delays of 5.3 (each weapon class's release, hit and miss; metal sweetener on a breastplate wearer and not on a goblin; crit sweetener; up to two element sweeteners; image; each spell family and override; both area abilities; each tick element; regen; each death class plus the hero toll; one step per hex at the stated times; stings). | R2, R5 |
| AC3 | Every weapon icon of a main-hand family in `FAMILIES` has a `WEAPON_SOUNDS` entry; every `FoeKind` a `FOE_SOUNDS`, `DEATH` and `STEP` entry; every spell id resolves through `spellSound` to existing cues. | R2 |
| AC4 | Unit tests: `worldSounds` plays at most two cues, in the stated priority, 250 ms apart, and nothing for `level_changed`, `spawned`, `order_done`. | R3 |
| AC5 | In the browser (audio log): an attack, a cast, a move, a fall and a battle end log the expected cues; a walk onto monsters logs `world.confront`; a buy logs `world.coins`; a refused buy logs `ui.error`; taking a node logs `ui.learn`. | R2 to R5 |
| AC6 | Unit tests: `pickVariant` never returns the marker just played (10 000 plays of a 2- and a 6-variant cue); each marker's share is within ±1 of n/v; detune and volume within the cue's ranges; the battle engine's RNG state is identical before and after a battle's sounds are chosen (a replayed battle's event log is byte-identical with sounds on). | R6 |
| AC7 | Unit tests: `maxVoices` and `minGapMs` drop excess plays. Browser: 20 `battle.hit.slash` in 1 s through the player never clip the output (limiter installed; no sample above 0 dBFS in a recorded `AudioContext` capture, or the limiter's reduction is engaged). | R7 |
| AC8 | `npm run sounds:check` passes on a clean tree; editing one recipe without building makes it fail naming that cue; a source with licence `CC-BY-4.0` or a wrong SHA-256 makes the build fail; rendering a recipe twice gives identical PCM (pytest). | R8 |
| AC9 | The check reports, for every variant, loudness within its group's tolerance and true peak under its ceiling; no two variants of a cue correlate above 0.95; shipped SFX at most 3 MB per format; committed sources and clips at most 15 MB; voice at most 4 MB per format. | R9, R8 |
| AC10 | The options view shows four sliders; `parseAudioSettings('{"master":0.5,"effects":1,"music":1}')` gives `voice: 1`; voice at 0 silences a line; music volume drops by 10 dB (±1) while a line plays and returns within 1 s after. | R10 |
| AC11 | Vitest refuses (each case a test): a duplicate line id; `line` without `voice`; a voiced `{leader}` beat; spoken text with `{encampment}`; an unknown tag; a tag for a non-tag engine; an emotion the voice lacks. | R11 |
| AC12 | Vitest: every voiced beat's `lineHash` equals the manifest's and its files exist; changing a voiced beat's spoken text without rendering fails the test; `voice render` after that change renders exactly one line. | R12 |
| AC13 | The bake-off's 32 blind clips and scoring sheet exist; the user's choice is recorded in the feature record before any line is committed; each committed clip has a provenance entry naming VoiceDesign, its revision, description and seed; the emotion clips' speaker similarity to neutral is at least 0.75 (printed by `voice design`). | R13 |
| AC14 | Browser: opening the intro cutscene plays `intro.opening` (probe `voice.playing`), Next stops it and the leader's beat is silent; Esc stops it; deleting the voice file leaves the cutscene working and silent. | R14, R16 |
| AC15 | READMEs list every bank's sources by collection and author, the themes' measured loudness, the TTS models, revisions, licences and watermark; `audio/CLAUDE.md` exists; the root `CLAUDE.md` points to it and describes `sounds.ts`, `soundPlayer.ts`, `storyAudio.ts`, `narration.ts`, the npm scripts and the voice bus. | R15 |
| AC16 | Removing a bank's JSON or a marker from the manifest at runtime (a test with the player over a fake sound manager) produces no exception. | R16 |

### 7.2 What "indie-game quality" means here, checkably

Beyond the numbers above (loudness consistency, no clipping, variation, budgets), a listening review by the user, recorded in the feature record, on: the melee bank before the rest (step 2 of 5.9), then each bank; one short battle and one world-map session with sounds on, at default levels, judged for: nothing harsh or piercing, nothing much louder or quieter than its neighbours, no audible repetition in a run of footsteps or repeated attacks, impacts in time with the visuals (the sound lands within one frame of `impactMs`), and the music audible but under the effects.

### 7.3 Testing strategy

- `domain` vitest: `sounds.test.ts` (rewritten), `audioSettings.test.ts`, new `storyAudio.test.ts` and `narration.test.ts` (rules and staleness), a `soundPlayer` test over a fake sound manager for limits and missing markers (the player's logic that touches Phaser is kept to calls on that manager).
- pytest in `tools/audio/` (host): DSP units, recipe parsing and variation, determinism, licence refusal, loudness normalisation, the check's staleness detection on a fixture project.
- In-browser (`npm run test:browser`): audio banks load at boot; the audio log after a battle action and a world walk; the story's voice probe; the menu's four sliders. Headless Chromium plays Web Audio after the tests' first click.
- Manual: the listening reviews of 7.2 and the bake-off.

## 8. Open questions and assumptions

None blocks planning; each has a default the plan follows.

- **Q1. Freesound downloads.** Freesound originals need a logged-in account; an agent cannot log in. *Recommendation:* source v1 from Kenney, OpenGameArt CC0 and synthesis first; where a sound is not good enough from those (likely creature vocals, fire, thunder, bells), the plan lists the Freesound CC0 files wanted and the user downloads them (or provides an API token for the tool). Lossy previews are not used as sources.
- **Q2. Stings.** Victory, defeat and level-up stings built from Kenney *Music Jingles* may not match the two themes' style. *Recommendation:* build them from the jingles for v1; the user may supply stings recorded with the themes later, which then replace the recipes as plain sources (licence `own`).
- **Q3. The narrator's voice.** Male (A) or female (B), decided by listening in the bake-off. *Default:* whichever scores higher.
- **Q4. Tutorial narration.** Decided no for v1 (4.6), reversible without redesign. The user may overrule.
- **Assumptions:** the Qwen3-TTS VoiceDesign and CustomVoice models and Chatterbox run on the M5 as the brief found (via mlx-audio or PyTorch MPS); exact model ids and revisions are pinned at adoption, after rechecking their licences. Phaser 4's Web Audio sound manager supports `playAudioSprite` with `detune` and exposes its master gain node for the limiter; if not, the limiter is dropped and AC7 relies on the loudness ceilings and voice limits. The battle board stays one surface; terrain footsteps wait for terrain.
