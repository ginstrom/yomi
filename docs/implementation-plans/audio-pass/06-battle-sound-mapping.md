# Step 06: Battle sound mapping

[Index](index.md) · [Design](../../designs/audio-pass.md) §4.1.1–4.1.4, §4.3 (victory screen), §5.3 · Feature record: [`docs/features/audio-pass.md`](../../features/audio-pass.md)

## Objective

Battle events sound by what made them. `eventSounds(event, context)` turns each `BattleEvent` into cues from the attacker's weapon class, the outcome, the defender's armour, the spell's element or school, the area ability, a rune's on-hit element, a status's tick, regeneration, the faller's body type (with the hero's toll), and a footstep for each hex walked. `BattleScene` supplies the context. The victory screen adds the level-up sting. Covers R2, R5 (level-up) and R6 (replay unchanged); acceptance AC2, AC3, AC5 (battle parts) and AC6 (replay part).

## Requirements and context

- **R2:** battle events sound by the attacker's weapon class (release and impact), the outcome (hit, critical, miss, mirror image struck), the defender's armour, the spell's element or school, the area ability, a rune's on-hit element, a status's tick, regeneration, a unit's fall by body type (a hero's with its own toll), and footsteps on each hex walked.
- **R5 (part):** `stings.level_up` plays on the victory screen when any member gained a level.
- **R6 (part):** choosing sounds never draws from the battle's seeded RNG. A replayed battle's event log is byte-identical with sounds on.
- **Determinism (shared constraint):** audio never draws from `mulberry32` or the world RNG. Only `soundPlayer`'s `Math.random` picks variants. `eventSounds` is pure and draws nothing. `LOG_SCHEMA_VERSION` and `SAVE_VERSION` do not change. The simulator is untouched.
- **Event data available** (existing, nothing added to events):
  - `AttackEvent`: `attacker`, `defender`, `weapon` (a name), `melee`, `distance`, `hit`, `critical`, `image`, `ability`/`strike` on routine strikes, `bonus[]` (each with `element`, `damage`, and a bane entry), `healed`.
  - `CastEvent`: `spell`, `outcomes[]` (`hit`, `critical`, `image`), `drained`.
  - `AbilityEvent`: `ability`, `outcomes` (with `half`, `damage`).
  - `StatusTickEvent`: `status` (`STATUSES[id].element`: Corroded acid, Poisoned poison).
  - `RegenerateEvent`, `UnitDownEvent` (`unit`), `MoveEvent` (`path`, one hex a step), `BattleEndEvent` (`winner`).
  - Events carry no weapon family or unit kind. The scene knows both: `kinds[u.id]` from the encounter (`BattleScene` around line 340), and a hero's `Character` (`this.heroes.get(id)`), as `attackLook(event, heldIcon)` already uses at line 1411.
- **Timing** (existing, `battleEffects.ts`): `impactMs(event)` gives when an outcome lands. `MOVE_STEP_MS` (140) lives today in `BattleScene.ts` (line 191); this step moves it to `battleEffects.ts` so the helper can read it.

## Dependencies and prerequisites

- **Step 05 (must be done):** it produces the C8 runtime. This step relies on:
  - in `sounds.ts`: `CueId`, `CUES`, `SoundCue`, `STING_DELAY_MS`, `cueMarkers`;
  - in `soundPlayer.ts`: `playCues(scene, cues)`, `playCue`, `audioLog()`;
  - `BattleScene` already plays `eventSounds(event)` through `playCues`, mapped onto new ids (step 05's interim mapping, below);
  - `window.__yomi.audioLog()` in dev builds.
- **Step 02:** all 85 W1 cues of C7 exist in `audio/sfx.manifest.json`, built from placeholders. Real content arrives in steps 08 to 12 and needs no change here.
- This step needs no Python, no ffmpeg and no downloads.

### Contracts produced (copied from the index, C8 step-06 part; do not change)

```ts
// src/scenes/sounds.ts (Phaser-free)
export interface SoundContext { kind(unit: UnitId): UnitKind | null; held(unit: UnitId): ItemIcon | null; body(unit: UnitId): ItemIcon | null }
export function eventSounds(event: BattleEvent, context?: SoundContext): SoundCue[]
export interface AttackSound { release: CueId; hit: CueId; miss: CueId }
export const WEAPON_SOUNDS: Partial<Record<ItemIcon, AttackSound>>
export const FOE_SOUNDS: Record<FoeKind, AttackSound>
export function spellSound(id: SpellId): { cast: CueId; impact: CueId }
export const ABILITY_SOUNDS: Partial<Record<AbilityId, { release: CueId; impact: CueId }>>
export const DEATH: Record<UnitKind, CueId>
```

Contracts consumed, unchanged from step 05:

- `SoundCue = { cue: CueId; delayMs: number }`
- `STING_DELAY_MS = 450`
- `cueMarkers(cue)`
- `CueId = keyof typeof manifest.cues`

The step table may be exported as `STEP` (e.g. `Record<UnitKind, StepClass>` plus a resolver taking the body icon) so the coverage test can read it. Its exact shape is the implementer's choice, as no other step consumes it.

C9 (index): `MOVE_STEP_MS` (140) moves from `BattleScene.ts` to `battleEffects.ts` in this step. The level-up sting plays 150 ms after the victory sting's marker ends, when any member's `levelsGained > 0`.

## Scope and implementation guidance

### `src/scenes/sounds.ts`: replace the interim `eventSounds`

Step 05's interim mapping, which this step replaces:

- an attack plays `battle.swing.blade`, then `battle.hit.slash`, `battle.hit.crit` or `battle.miss.swing`;
- a cast or ability plays `battle.cast.arcane`, then `battle.impact.heal` for a friendly spell, or the hit, crit or miss cue;
- a tick plays `battle.hit.slash`;
- `regenerate` plays `battle.regen`;
- `unit_down` plays `battle.death.human`;
- `battle_end` plays a sting.

Rules (design §5.3, normative):

- **`attack`:**
  - At 0 ms, the attacker's class `release`.
  - At `impactMs(event)`, on a hit that struck no image:
    - the class's `hit`;
    - `battle.armor.metal` if the defender is in metal (METAL, below);
    - `battle.hit.crit` if `critical`;
    - `battle.element.<e>` for each of the first two `bonus[]` entries with `damage > 0`, at +30 ms (a bane entry plays `battle.element.blight`);
    - `battle.heal.small` at +60 ms if `healed > 0`.
  - On a hit on an image, `battle.hit.image`.
  - On a miss, the class's `miss`.
  - A routine's strikes (`ability`/`strike` set) are attacks and sound by the attacker's class.
- **`cast`:**
  - At 0 ms, `spellSound(spell).cast`.
  - At `impactMs`:
    - for a friendly spell, its impact;
    - for a hostile spell where any outcome struck (hit, not an image), its impact, plus `battle.hit.crit` if any of those was critical;
    - else, if only images were struck, `battle.hit.image`;
    - else `battle.miss.magic`.
  - `battle.heal.small` at `impactMs` + 150 ms if `drained > 0`.
- **`ability`** (an area):
  - At 0 ms, its `ABILITY_SOUNDS` release.
  - At `impactMs`, its impact when anything struck (a `half` outcome with `damage > 0` counts; an image does not), else `battle.miss.magic`.
- **`status_tick`:** `battle.element.<STATUSES[status].element>` at 0. Nothing when the status has no element.
- **`regenerate`:** `battle.regen`.
- **`unit_down`:** `DEATH[kind]` at 0, plus `battle.death.hero` at 0 when the kind is `warrior`.
- **`move`:** the mover's step cue at `i * MOVE_STEP_MS + MOVE_STEP_MS / 2` for each hex `i` (0-based) of `path`.
- **`battle_end`:** `stings.victory` (player won) or `stings.defeat` (enemy won) at `STING_DELAY_MS`. Nothing otherwise.
- **Every other event:** nothing. `end_turn` stays silent (its turn cues are W2, out of scope).
- **No context**, or a context returning null for the unit: a melee attack (`event.melee`) falls back to the `blade` class and a shot to `bow`. With no kind, a unit falls as `battle.death.human` and steps as `battle.step.light`. With no body icon, a warrior is not in metal.

### Attack classes (design §4.1.1, §4.1.2 "played for")

| Class | release | hit | miss | Weapon icons (`WEAPON_SOUNDS`) | Foe kinds (`FOE_SOUNDS`) |
| --- | --- | --- | --- | --- | --- |
| light | `battle.swing.light` | `battle.hit.pierce` (dagger, rapier); `battle.hit.slash` (shortsword); `battle.hit.crush` (bare hands) | `battle.miss.swing` | `dagger` (pierce), `shortsword` (slash), `rapier` (pierce) | `goblin` (hit slash), `kobold` (hit pierce), `bandit_cutthroat` (dagger: pierce) |
| blade | `battle.swing.blade` | `battle.hit.slash` | `battle.miss.swing` | `sword`, `sword_ember` | `bandit_captain` |
| heavy | `battle.swing.heavy` | `battle.hit.slash` (greatsword, axe, halberd); `battle.hit.crush` (mace, war hammer, staff) | `battle.miss.swing` | `greatsword`, `axe`, `halberd` (slash); `mace`, `war_hammer`, `staff` (crush) | `shaman` (crush), `hobgoblin` (crush), `bandit_brute` (axe: slash) |
| thrust | `battle.swing.thrust` | `battle.hit.pierce` | `battle.miss.swing` | `spear` | — |
| claw | `battle.swing.claw` | `battle.hit.claw` | `battle.miss.swing` | — | `troll`, `armored_troll`, `horror`, `salamander` |
| bite | `battle.swing.bite` | `battle.hit.claw` | `battle.miss.swing` | — | `giant_spider` |
| bow | `battle.shot.bow` | `battle.hit.pierce` | `battle.miss.shot` | `bow`, `longbow`, `bow_hawk` | `bandit_archer` |
| crossbow | `battle.shot.crossbow` | `battle.hit.pierce` | `battle.miss.shot` | `crossbow` | `bandit_crossbowman` |
| wand | `battle.shot.wand` | `battle.hit.magic` | `battle.miss.magic` | `wand`, `wand_storm` | `bandit_mage` |

- A hero's class comes from `context.held(attacker)` through `WEAPON_SOUNDS`.
- Bare hands (`held` null on a hero) use the light class with `battle.hit.crush`. Bare hands are a constant beside the table, as `null` is not an `ItemIcon`.
- A foe's class comes from `FOE_SOUNDS[kind]`.
- Check the icon names against `ItemIcon` in the code. The coverage test below is the authority.

### METAL (design §5.3)

The defender is in metal when its `context.body` icon is `armor` (breastplate) or `plate`, or its kind is one of `hobgoblin`, `armored_troll`, `bandit_brute` or `bandit_captain`. `leather`, `robe` and no body armour are not metal.

### `spellSound(id)` (design §5.3)

`SPELL_SOUND_OVERRIDES[id]` wins when present. Otherwise the sound comes from `SPELLS[id]`:

| Spell | cast | impact |
| --- | --- | --- |
| hostile, element `fire` | `battle.cast.fire` | `battle.impact.fire` |
| hostile, element `frost` | `battle.cast.frost` | `battle.impact.frost` |
| hostile, element `lightning` | `battle.cast.storm` | `battle.impact.lightning` |
| hostile, element `acid` | `battle.cast.venom` | `battle.impact.acid` |
| hostile, element `poison` | `battle.cast.venom` | `battle.impact.poison` |
| hostile, no element | `battle.cast.arcane` | `battle.impact.arcane` |
| healing school | `battle.cast.holy` | `battle.impact.heal` |
| support school | `battle.cast.ward` | `battle.impact.buff` |

Overrides:

| Spell | cast | impact |
| --- | --- | --- |
| Fireball | `battle.cast.fire` | `battle.impact.fireball` |
| Sleep | `battle.cast.arcane` | `battle.impact.hex` |
| Curse, Bane | `battle.cast.shadow` | `battle.impact.hex` |
| Drain Life | `battle.cast.shadow` | `battle.impact.shadow` |
| Bless | `battle.cast.holy` | `battle.impact.buff` |
| Dark Shield | `battle.cast.shadow` | `battle.impact.buff` |
| Web | `battle.cast.arcane` | `battle.impact.web` |

- An element not listed (`blight`) falls back by school, or to arcane.
- A spell added on another branch (the `skill-trees` work adds spells) sounds by its element and school, with no entry needed.

### `ABILITY_SOUNDS`

| Ability | release | impact |
| --- | --- | --- |
| `fire_spit` | `battle.ability.spit` | `battle.impact.fire` |
| `spider_web` | `battle.ability.web` | `battle.impact.web` |

Check the ids against `ABILITIES`. A routine (e.g. `troll_claws`) needs no entry: its strikes are attacks.

### `DEATH` (design §4.1.4)

| Kinds | Cue |
| --- | --- |
| `warrior` and every bandit kind | `battle.death.human` |
| `goblin`, `kobold`, `shaman`, `hobgoblin` | `battle.death.goblinoid` |
| `troll`, `armored_troll` | `battle.death.brute` |
| `giant_spider` | `battle.death.spider` |
| `salamander` | `battle.death.salamander` |
| `horror` | `battle.death.horror` |

`battle.death.hero` is added for a `warrior`.

### STEP (design §4.1.4, resolved with the body icon)

| Units | Cue |
| --- | --- |
| A hero or bandit whose body icon is `armor` or `plate`, `bandit_brute`, `bandit_captain`, `hobgoblin` | `battle.step.armored` |
| `troll`, `armored_troll`, `horror` | `battle.step.heavy` |
| `giant_spider`, `salamander` | `battle.step.skitter` |
| Everyone else on two legs (unarmoured heroes and bandits, `goblin`, `kobold`, `shaman`) | `battle.step.light` |

Bandits wear no `Character` in the scene, so a bandit's metal comes from its kind, as METAL's list does.

### `src/scenes/battleEffects.ts`

Move `MOVE_STEP_MS = 140` here and export it. `BattleScene` imports it, and its walk tween and `moveStepMs` usage are unchanged.

### `src/scenes/BattleScene.ts`

- Build one `SoundContext` per battle:
  - `kind(id)`: the encounter's `kinds[id]` (null if unknown);
  - `held(id)`: `this.heroes.get(id)?.equipment.mainHand?.icon ?? null` for a hero, null for a foe;
  - `body(id)`: the hero's body-armour icon, or null.
- The context reads the characters live, so a mid-battle gear change is heard.
- Pass the context to `eventSounds` where events are played (today around line 1373, through `playCues` since step 05).
- **Level-up sting:**
  - When the victory screen shows (around line 2126, `rewardVictory`), and any member's gain has `levelsGained > 0`, play `stings.level_up`.
  - Start it 150 ms after the victory sting's marker ends.
  - Compute that time from the event's timing: the sting starts at `STING_DELAY_MS` after `battle_end`'s playback. Its length is the manifest's `durationsMs[0]` of `stings.victory` (read through a small Phaser-free helper in `sounds.ts`, e.g. `cueDurationMs(cue, k = 0)`; additions beside the contract are fine).
  - Keep the rule in `sounds.ts` (e.g. `levelUpDelayMs()`) so it is unit-tested. The scene only schedules.
  - The gains are `rewardVictory`'s per-member results, the same data `describeRewards` reads.
- No other scene changes. Refusal sounds (`noStrikeHint` playing `ui.error`) and gear sounds belong to step 07.

### Exclusions

- No new cues (the 85 of C7 are fixed).
- No W2 turn cues.
- No changes to events, the engine or recipes.
- No positional sound.

## Verification

Write the tests first and see them fail.

### Domain: `src/scenes/sounds.test.ts` (AC2)

Representative events with a stub `SoundContext` return the stated cues and delays:

- each class's release, hit and miss: a dagger, sword, greatsword, mace, spear, bow, crossbow and wand on a hero; bare hands; one foe of each class;
- the metal sweetener on a breastplate wearer, on `plate` and on a `hobgoblin`, and not on a `goblin` nor on a leather wearer;
- the crit sweetener;
- one and two element sweeteners at +30 ms, a third ignored, and a bane entry as `blight`;
- `healed > 0`: `battle.heal.small` at +60 ms;
- an image struck by an attack and by a spell;
- each spell family and each override: a friendly spell, a hostile hit with crit, an image-only cast, a miss (`battle.miss.magic`), and `drained` at +150;
- both area abilities, struck, `half`-only and missed;
- each tick element, and a tick with no element (nothing);
- `regenerate`;
- each death class, plus the hero toll for `warrior`;
- a 3-hex move giving three steps at 70, 210 and 350 ms, by class (armoured hero, light hero, troll, spider);
- `battle_end` for each winner and for neither;
- the no-context fallbacks (melee to blade, shot to bow).

Also the level-up delay helper: `STING_DELAY_MS` + the victory marker's duration + 150.

### Domain, coverage (AC3)

- Every main-hand weapon family's icon in `FAMILIES` (`src/inventory/catalog.ts`) has a `WEAPON_SOUNDS` entry, as `unitLook.test.ts` does for sprites.
- Every `FoeKind` has a `FOE_SOUNDS`, `DEATH` and STEP entry, and `warrior` has `DEATH` and STEP entries.
- Every id in `ALL_SPELL_IDS` resolves through `spellSound` to cues present in `CUES` (and in the manifest).
- Every `ABILITY_SOUNDS` cue exists.

Consequence for the merge with `skill-trees`: a new weapon icon there fails this coverage test until it is given an entry. That is by design (design §6). New spells need nothing.

### Domain, replay (AC6, part)

A seeded battle (a `BattleEngine` from a real encounter with a `mulberry32` seed, played by the `aggressive` policy to its end, as existing engine tests do) is played twice:

- once plain;
- once calling `eventSounds(event, context)` on every event, with a stub context.

The two event logs (`JSON.stringify`) are byte-identical, and so are the engines' RNG states (`state()`) at the end. `eventSounds` must not touch the RNG. The test proves it.

### Browser (AC5, battle parts)

Add cases to `e2e/battle.test.ts` (read `e2e/CLAUDE.md` first) that read `window.__yomi.audioLog()` after each action:

- an attack logs its class's release and an outcome cue (e.g. a hero with the sword: `battle.swing.blade`, then `battle.hit.slash`, `battle.hit.crit` or `battle.miss.swing`);
- a cast logs a `battle.cast.*` and an outcome;
- a move logs one `battle.step.*` per hex;
- a fall logs a `battle.death.*`;
- a battle end logs `stings.victory` (and `stings.level_up` when a member levelled, if a test setup can arrange it, e.g. by the debug console's `xp` before a `fight`).

Use the seed in the address for determinism where an outcome matters.

### Commands

Prefix every command with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`:

- `npx vitest run src/scenes/sounds.test.ts`
- `npm test`
- `npm run test:browser`: **this step changes a scene, so it is required**
- `npm run sounds:check`: should still pass; nothing in `audio/` changes

## Completion criteria

- [ ] The C8 step-06 exports exist exactly as in the index, and the rules and tables above are implemented. Tests were seen failing first.
- [ ] AC2, AC3 and AC6 (replay part) pass in the domain project, and AC5's battle parts pass in the browser.
- [ ] `MOVE_STEP_MS` is exported from `battleEffects.ts` and no longer defined in `BattleScene.ts`.
- [ ] The level-up sting plays after the victory sting when a member levelled.
- [ ] `npm test` and `npm run test:browser` pass, and `npm run sounds:check` is unaffected.
- [ ] CLAUDE.md is updated in the same commit:
  - the scene-helper list's `sounds.ts` entry: the cue table, `eventSounds(event, context)` mapping events to cues by attack class, armour, element, ability, body type and steps, with the tables keyed like `GEAR_SPRITES` and a coverage test that a new weapon icon must satisfy;
  - the `battleEffects.ts` entry, which now also holds `MOVE_STEP_MS`;
  - any "Assets and docs" line on sounds that this makes wrong.
  - Search CLAUDE.md for `MOVE_STEP_MS` and `eventSounds`, and fix stale mentions.
- [ ] One commit, `Audio pass step 06: Battle sound mapping`, on `audio-pass`, not pushed. Set the index row's status to `done` with the hash.

## Execution record

