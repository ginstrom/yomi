import type { AbilityId } from '../combat/abilities.ts'
import type { Element } from '../combat/combat.ts'
import { SPELLS, STATUSES, type SpellId } from '../combat/spells.ts'
import type { AttackEvent, BattleEvent, UnitId } from '../engine/battleEngine.ts'
import type { WorldEvent } from '../game/blight.ts'
import type { DayReport, PartyEvent } from '../game/company.ts'
import type { FoeKind, UnitKind } from '../game/encounters.ts'
import type { ItemIcon } from '../inventory/inventory.ts'
import manifest from '../../audio/sfx.manifest.json'
import { MOVE_STEP_MS, impactMs } from './battleEffects.ts'

/**
 * The cue table: every sound effect the game plays is a cue `<bank>.<name>`,
 * built by `npm run sounds` from a recipe in `audio/sfx/` into a bank of
 * variants (an audio sprite), and listed with its markers and their lengths in
 * the generated manifest. What the build cannot know, how a cue is played (its
 * bus, jitter and voice limits), is here. Kept free of Phaser; `soundPlayer.ts`
 * plays what this decides.
 */

export type CueId = keyof typeof manifest.cues
export type BankId = 'ui' | 'battle' | 'world' | 'stings'
export const BANKS: readonly BankId[] = ['ui', 'battle', 'world', 'stings']

/** Sound FX's slider covers `effects` and `ui`; `music` carries the themes and the stings. */
export type Bus = 'effects' | 'ui' | 'music' | 'voice'

export interface CueSpec {
  bus: Bus
  /** Added to the bus's level, in dB. */
  gainDb?: number
  /** Each play is detuned by up to this many cents either way. */
  detuneCents?: number
  /** Each play's volume moves by up to this many dB either way. */
  volumeJitterDb?: number
  /** At most this many plays of the cue at once; more are dropped. */
  maxVoices?: number
  /** A play this soon after the cue's last start is dropped. */
  minGapMs?: number
}

/** The cues of the `impact` loudness group (audio/audio.toml), which may sound at most three at once. */
const IMPACT_CUES: ReadonlySet<string> = new Set([
  'battle.hit.slash', 'battle.hit.crush', 'battle.hit.pierce', 'battle.hit.claw', 'battle.hit.magic',
  'battle.miss.swing', 'battle.miss.shot', 'battle.miss.magic', 'battle.hit.image',
  'battle.impact.arcane', 'battle.impact.fire', 'battle.impact.fireball', 'battle.impact.frost', 'battle.impact.lightning',
  'battle.impact.acid', 'battle.impact.poison', 'battle.impact.shadow', 'battle.impact.hex', 'battle.impact.web',
  'battle.impact.heal', 'battle.impact.buff',
])

function cueSpec(cue: string): CueSpec {
  const ui = cue.startsWith('ui.')
  const sting = cue.startsWith('stings.')
  const step = cue.startsWith('battle.step.')
  const spec: CueSpec = {
    bus: ui ? 'ui' : sting ? 'music' : 'effects',
    detuneCents: step ? 100 : ui ? 20 : sting || cue === 'world.source' ? 0 : 40,
    volumeJitterDb: ui ? 0.5 : sting ? 0 : 1.5,
  }
  if (step || IMPACT_CUES.has(cue)) spec.maxVoices = 3
  if (cue.startsWith('battle.element.')) spec.maxVoices = 2
  return spec
}

/** Every cue of the manifest, played by the defaults above; the manifest's cue set is the type's. */
export const CUES = Object.fromEntries(Object.keys(manifest.cues).map((cue) => [cue, cueSpec(cue)])) as Record<CueId, CueSpec>

export function cueBank(cue: CueId): BankId {
  return manifest.cues[cue].bank as BankId
}

/** The cue's variants, as the markers of its bank's spritemap. */
export function cueMarkers(cue: CueId): readonly string[] {
  return manifest.cues[cue].markers
}

/** How long the cue's k-th variant lasts. */
export function cueDurationMs(cue: CueId, k = 0): number {
  return manifest.cues[cue].durationsMs[k] ?? 0
}

/** A bank's spritemap and its audio, best first (Opus, then MP3 for browsers that cannot play it). */
export function bankFiles(bank: BankId): { json: string; audio: string[] } {
  const path = `assets/audio/sfx/${bank}`
  return { json: `${path}.json`, audio: [`${path}.opus`, `${path}.mp3`] }
}

export type MusicKey = 'music_battle' | 'music_world_map'
export const MUSIC_KEYS: readonly MusicKey[] = ['music_battle', 'music_world_map']

/** A theme's files: Ogg Opus, which loops without a gap, with MP3 for browsers that cannot play Opus. */
export function musicFiles(key: MusicKey): string[] {
  return [`assets/audio/${key}.opus`, `assets/audio/${key}.mp3`]
}

/** A cue to start `delayMs` after its event is shown. */
export interface SoundCue {
  cue: CueId
  delayMs: number
}

/** The battle's last blow and fall are heard before the victory or defeat sting. */
export const STING_DELAY_MS = 450

// ---- variants -------------------------------------------------------------

/** Per cue, the shuffle bag of markers still to play and the marker played last. */
export interface VariantState {
  bags: Map<CueId, { bag: string[]; last: string | null }>
}

export function newVariantState(): VariantState {
  return { bags: new Map() }
}

/** Uniform in ±range, and exactly 0 for a range of 0. */
function jitter(range: number | undefined, random: () => number): number {
  return range ? (random() * 2 - 1) * range : 0
}

/**
 * The next variant of a cue, by shuffle bag: every marker once in a random
 * order, then a new bag, which never starts with the marker the last one ended
 * on, so no marker plays twice running; and the detune (cents) and volume (dB)
 * to play it at. `random` is the player's own, never a battle's seeded stream.
 */
export function pickVariant(state: VariantState, cue: CueId, random: () => number): { marker: string; detune: number; volumeDb: number } {
  const markers = cueMarkers(cue)
  let entry = state.bags.get(cue)
  if (!entry) {
    entry = { bag: [], last: null }
    state.bags.set(cue, entry)
  }
  if (entry.bag.length === 0) {
    const bag = [...markers]
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j], bag[i]]
    }
    if (bag.length > 1 && bag[0] === entry.last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]]
    entry.bag = bag
  }
  const marker = entry.bag.shift()!
  entry.last = marker
  const spec = CUES[cue]
  return { marker, detune: jitter(spec.detuneCents, random), volumeDb: jitter(spec.volumeJitterDb, random) }
}

// ---- voice limits ---------------------------------------------------------

/** Effects and ui plays sounding at once, together; beyond it the newest is dropped. */
export const GLOBAL_VOICE_CAP = 24

/** The plays still sounding (by when each ends), per cue and on the effects and ui buses together, and each cue's last start. */
export interface LimitState {
  active: Map<CueId, number[]>
  lastStart: Map<CueId, number>
  global: number[]
}

export function newLimitState(): LimitState {
  return { active: new Map(), lastStart: new Map(), global: [] }
}

/**
 * Whether a play of the cue starting now, sounding until `endsAtMs`, may sound:
 * not within the cue's `minGapMs` of its last start, not beyond its
 * `maxVoices`, and, on the effects and ui buses, not beyond `GLOBAL_VOICE_CAP`.
 * An admitted play is recorded; nothing else changes the state.
 */
export function admitPlay(state: LimitState, cue: CueId, nowMs: number, endsAtMs: number): boolean {
  const spec = CUES[cue]
  const counted = spec.bus === 'effects' || spec.bus === 'ui'
  const active = (state.active.get(cue) ?? []).filter((end) => end > nowMs)
  state.active.set(cue, active)
  state.global = state.global.filter((end) => end > nowMs)
  const last = state.lastStart.get(cue)
  if (spec.minGapMs !== undefined && last !== undefined && nowMs - last < spec.minGapMs) return false
  if (spec.maxVoices !== undefined && active.length >= spec.maxVoices) return false
  if (counted && state.global.length >= GLOBAL_VOICE_CAP) return false
  active.push(endsAtMs)
  if (counted) state.global.push(endsAtMs)
  state.lastStart.set(cue, nowMs)
  return true
}

// ---- battle ---------------------------------------------------------------

/** What the scene knows of a unit that the events do not say: its kind and what it holds and wears. */
export interface SoundContext {
  kind(unit: UnitId): UnitKind | null
  held(unit: UnitId): ItemIcon | null
  body(unit: UnitId): ItemIcon | null
}

/** How a kind of attack sounds: let go, landing, and missing. */
export interface AttackSound {
  release: CueId
  hit: CueId
  miss: CueId
}

const attackSound = (release: CueId, hit: CueId, miss: CueId = 'battle.miss.swing'): AttackSound => ({ release, hit, miss })
const light = (hit: CueId) => attackSound('battle.swing.light', hit)
const blade = attackSound('battle.swing.blade', 'battle.hit.slash')
const heavy = (hit: CueId) => attackSound('battle.swing.heavy', hit)
const thrust = attackSound('battle.swing.thrust', 'battle.hit.pierce')
const claw = attackSound('battle.swing.claw', 'battle.hit.claw')
const bow = attackSound('battle.shot.bow', 'battle.hit.pierce', 'battle.miss.shot')
const crossbow = attackSound('battle.shot.crossbow', 'battle.hit.pierce', 'battle.miss.shot')
const wand = attackSound('battle.shot.wand', 'battle.hit.magic', 'battle.miss.magic')

/** A hero's attack by its main hand's icon, as `GEAR_SPRITES` is keyed; a new weapon icon needs an entry (a test says so). */
export const WEAPON_SOUNDS: Partial<Record<ItemIcon, AttackSound>> = {
  dagger: light('battle.hit.pierce'),
  shortsword: light('battle.hit.slash'),
  rapier: light('battle.hit.pierce'),
  sword: blade,
  sword_ember: blade,
  greatsword: heavy('battle.hit.slash'),
  axe: heavy('battle.hit.slash'),
  halberd: heavy('battle.hit.slash'),
  mace: heavy('battle.hit.crush'),
  war_hammer: heavy('battle.hit.crush'),
  staff: heavy('battle.hit.crush'),
  spear: thrust,
  bow,
  longbow: bow,
  bow_hawk: bow,
  crossbow,
  wand,
  wand_storm: wand,
}

/** A hero with nothing in its main hand. `null` is not an `ItemIcon`, so it is not in the table. */
export const BARE_HANDS: AttackSound = light('battle.hit.crush')

export const FOE_SOUNDS: Record<FoeKind, AttackSound> = {
  goblin: light('battle.hit.slash'),
  kobold: light('battle.hit.pierce'),
  shaman: heavy('battle.hit.crush'),
  hobgoblin: heavy('battle.hit.crush'),
  troll: claw,
  armored_troll: claw,
  horror: claw,
  salamander: claw,
  giant_spider: attackSound('battle.swing.bite', 'battle.hit.claw'),
  bandit_cutthroat: light('battle.hit.pierce'),
  bandit_captain: blade,
  bandit_brute: heavy('battle.hit.slash'),
  bandit_archer: bow,
  bandit_crossbowman: crossbow,
  bandit_mage: wand,
}

/** What a unit of unknown make strikes with: a blade for a blow, a bow for a shot. */
function attackClass(event: AttackEvent, context: SoundContext | undefined): AttackSound {
  const kind = context?.kind(event.attacker) ?? null
  if (kind === 'warrior') {
    const held = context!.held(event.attacker)
    if (held === null) return BARE_HANDS
    const sound = WEAPON_SOUNDS[held]
    if (sound) return sound
  } else if (kind) {
    return FOE_SOUNDS[kind]
  }
  return event.melee ? blade : bow
}

/** Kinds that wear metal whatever the scene says of their body (bandits and monsters have no `Character`). */
const METAL_KINDS: ReadonlySet<UnitKind> = new Set(['hobgoblin', 'armored_troll', 'bandit_brute', 'bandit_captain'])
const METAL_BODIES: ReadonlySet<ItemIcon> = new Set(['armor', 'plate'])

function inMetal(unit: UnitId, context: SoundContext | undefined): boolean {
  const kind = context?.kind(unit) ?? null
  if (kind && METAL_KINDS.has(kind)) return true
  const body = context?.body(unit) ?? null
  return body !== null && METAL_BODIES.has(body)
}

const elementCue = (element: Element): CueId => `battle.element.${element}`

/** A spell's cast and its landing; the overrides win, else the element of a hostile spell, else its school. */
const SPELL_SOUND_OVERRIDES: Partial<Record<SpellId, { cast: CueId; impact: CueId }>> = {
  fireball: { cast: 'battle.cast.fire', impact: 'battle.impact.fireball' },
  sleep: { cast: 'battle.cast.arcane', impact: 'battle.impact.hex' },
  curse: { cast: 'battle.cast.shadow', impact: 'battle.impact.hex' },
  bane: { cast: 'battle.cast.shadow', impact: 'battle.impact.hex' },
  drain_life: { cast: 'battle.cast.shadow', impact: 'battle.impact.shadow' },
  bless: { cast: 'battle.cast.holy', impact: 'battle.impact.buff' },
  dark_shield: { cast: 'battle.cast.shadow', impact: 'battle.impact.buff' },
  web: { cast: 'battle.cast.arcane', impact: 'battle.impact.web' },
  meteor: { cast: 'battle.cast.fire', impact: 'battle.impact.fireball' },
  glacial_prison: { cast: 'battle.cast.frost', impact: 'battle.impact.frost' },
  renew: { cast: 'battle.cast.holy', impact: 'battle.impact.buff' },
  // Holy damage: the holy swell, landing as the Dawn rune's bright chime over a dark swell.
  holy_light: { cast: 'battle.cast.holy', impact: 'battle.element.blight' },
}

const ELEMENT_SPELL_SOUNDS: Partial<Record<Element, { cast: CueId; impact: CueId }>> = {
  fire: { cast: 'battle.cast.fire', impact: 'battle.impact.fire' },
  frost: { cast: 'battle.cast.frost', impact: 'battle.impact.frost' },
  lightning: { cast: 'battle.cast.storm', impact: 'battle.impact.lightning' },
  acid: { cast: 'battle.cast.venom', impact: 'battle.impact.acid' },
  poison: { cast: 'battle.cast.venom', impact: 'battle.impact.poison' },
}

export function spellSound(id: SpellId): { cast: CueId; impact: CueId } {
  const override = SPELL_SOUND_OVERRIDES[id]
  if (override) return override
  const spell = SPELLS[id]
  if (spell.hostile) {
    const element = spell.element ? ELEMENT_SPELL_SOUNDS[spell.element] : undefined
    return element ?? { cast: 'battle.cast.arcane', impact: 'battle.impact.arcane' }
  }
  return spell.school === 'healing' ? { cast: 'battle.cast.holy', impact: 'battle.impact.heal' } : { cast: 'battle.cast.ward', impact: 'battle.impact.buff' }
}

/** How an area or status ability sounds: let go (if heard at all), landing, and missing every unit (a magic miss by default). */
export interface AbilitySound {
  release?: CueId
  impact: CueId
  miss?: CueId
}

/** The area and status abilities' sounds; a routine's strikes, a technique's included, are attacks and need none. */
export const ABILITY_SOUNDS: Partial<Record<AbilityId, AbilitySound>> = {
  fire_spit: { release: 'battle.ability.spit', impact: 'battle.impact.fire' },
  spider_web: { release: 'battle.ability.web', impact: 'battle.impact.web' },
  // A shield struck for a challenge, and the hex of the foes it draws.
  taunt: { release: 'battle.armor.metal', impact: 'battle.impact.hex' },
  volley: { release: 'battle.shot.bow', impact: 'battle.hit.pierce', miss: 'battle.miss.shot' },
  consecrate: { release: 'battle.cast.holy', impact: 'battle.element.blight' },
  // Laid with no roll: only the landing is heard.
  hunters_mark: { impact: 'battle.impact.hex' },
  sprint: { impact: 'battle.impact.buff' },
}

export const DEATH: Record<UnitKind, CueId> = {
  warrior: 'battle.death.human',
  bandit_cutthroat: 'battle.death.human',
  bandit_archer: 'battle.death.human',
  bandit_brute: 'battle.death.human',
  bandit_mage: 'battle.death.human',
  bandit_captain: 'battle.death.human',
  bandit_crossbowman: 'battle.death.human',
  goblin: 'battle.death.goblinoid',
  kobold: 'battle.death.goblinoid',
  shaman: 'battle.death.goblinoid',
  hobgoblin: 'battle.death.goblinoid',
  troll: 'battle.death.brute',
  armored_troll: 'battle.death.brute',
  giant_spider: 'battle.death.spider',
  salamander: 'battle.death.salamander',
  horror: 'battle.death.horror',
}

type StepClass = 'light' | 'armored' | 'heavy' | 'skitter'

/** How a kind walks; a two-legged unit in metal (by kind or body icon) clanks. */
export const STEP: Record<UnitKind, StepClass> = {
  warrior: 'light',
  bandit_cutthroat: 'light',
  bandit_archer: 'light',
  bandit_mage: 'light',
  bandit_crossbowman: 'light',
  bandit_brute: 'armored',
  bandit_captain: 'armored',
  hobgoblin: 'armored',
  goblin: 'light',
  kobold: 'light',
  shaman: 'light',
  troll: 'heavy',
  armored_troll: 'heavy',
  horror: 'heavy',
  giant_spider: 'skitter',
  salamander: 'skitter',
}

/** A footstep's cue for a unit of `kind` wearing `body`; a kind of none known steps lightly. */
export function stepCue(kind: UnitKind | null, body: ItemIcon | null): CueId {
  const walk = kind ? STEP[kind] : 'light'
  if (walk === 'light' && body !== null && METAL_BODIES.has(body)) return 'battle.step.armored'
  return `battle.step.${walk}`
}

/**
 * The cues that go with a battle event, by what made it: the attacker's class,
 * the outcome, the defender's armour, the spell or ability, a rune's element
 * and what walks or falls. An outcome is heard as the blow or the missile lands
 * (`impactMs`). Pure: it draws from no RNG, so listening never moves a battle.
 */
/** An Unbreakable save, however the lethal damage came: a ward's ring, just after the blow, spell or tick lands. */
const ENDURED_CUE: CueId = 'battle.impact.buff'

export function eventSounds(event: BattleEvent, context?: SoundContext): SoundCue[] {
  switch (event.type) {
    case 'attack': {
      const sound = attackClass(event, context)
      const at = impactMs(event)
      const cues: SoundCue[] = [{ cue: sound.release, delayMs: 0 }]
      if (!event.hit) return [...cues, { cue: sound.miss, delayMs: at }]
      if (event.image) return [...cues, { cue: 'battle.hit.image', delayMs: at }]
      cues.push({ cue: sound.hit, delayMs: at })
      if (inMetal(event.defender, context)) cues.push({ cue: 'battle.armor.metal', delayMs: at })
      // A deathblow lands as hard as a critical; an Unbreakable save rings as a ward does.
      if (event.critical || event.deathblow) cues.push({ cue: 'battle.hit.crit', delayMs: at })
      if (event.endured) cues.push({ cue: ENDURED_CUE, delayMs: at + 60 })
      for (const bonus of event.bonus.filter((b) => b.damage > 0).slice(0, 2)) {
        const element = bonus.bane ? 'blight' : bonus.element
        if (element) cues.push({ cue: elementCue(element), delayMs: at + 30 })
      }
      if ((event.healed ?? 0) > 0) cues.push({ cue: 'battle.heal.small', delayMs: at + 60 })
      return cues
    }
    case 'cast': {
      const sound = spellSound(event.spell)
      const at = impactMs(event)
      const cues: SoundCue[] = [{ cue: sound.cast, delayMs: 0 }]
      if (!SPELLS[event.spell].hostile) {
        cues.push({ cue: sound.impact, delayMs: at })
      } else {
        const struck = event.outcomes.filter((o) => o.hit && !o.image)
        if (struck.length > 0) {
          cues.push({ cue: sound.impact, delayMs: at })
          if (struck.some((o) => o.critical)) cues.push({ cue: 'battle.hit.crit', delayMs: at })
        } else {
          cues.push({ cue: event.outcomes.some((o) => o.hit && o.image) ? 'battle.hit.image' : 'battle.miss.magic', delayMs: at })
        }
      }
      if (event.drained > 0) cues.push({ cue: 'battle.heal.small', delayMs: at + 150 })
      if (event.outcomes.some((o) => o.endured)) cues.push({ cue: ENDURED_CUE, delayMs: at + 60 })
      return cues
    }
    case 'ability': {
      const sound = ABILITY_SOUNDS[event.ability]
      if (!sound) return []
      // A miss that still burns for half is heard to strike.
      const struck = event.outcomes.some((o) => (o.hit || (o.half && o.damage > 0)) && !o.image)
      const at = impactMs(event)
      const landing: SoundCue = { cue: struck ? sound.impact : (sound.miss ?? 'battle.miss.magic'), delayMs: at }
      const cues: SoundCue[] = sound.release ? [{ cue: sound.release, delayMs: 0 }, landing] : [landing]
      if (event.outcomes.some((o) => o.endured)) cues.push({ cue: ENDURED_CUE, delayMs: at + 60 })
      return cues
    }
    case 'status_tick': {
      const element = STATUSES[event.status].element
      const cues: SoundCue[] = element ? [{ cue: elementCue(element), delayMs: 0 }] : []
      if (event.endured) cues.push({ cue: ENDURED_CUE, delayMs: 60 })
      return cues
    }
    case 'regenerate':
      return [{ cue: 'battle.regen', delayMs: 0 }]
    case 'restore':
      // A heal's warm shimmer; Serenity's mana alone, every turn, is left silent on purpose.
      return event.hp ? [{ cue: 'battle.heal.small', delayMs: 0 }] : []
    case 'status_laid':
      // Shadowdancer's image is heard as Mirror Image is; Rooted, laid on every unmoved unit each turn, is silent on purpose.
      return event.cause === 'shadowdancer' ? [{ cue: spellSound('mirror_image').impact, delayMs: 0 }] : []
    case 'unit_down': {
      const kind = context?.kind(event.unit) ?? null
      const cues: SoundCue[] = [{ cue: kind ? DEATH[kind] : 'battle.death.human', delayMs: 0 }]
      if (kind === 'warrior') cues.push({ cue: 'battle.death.hero', delayMs: 0 })
      return cues
    }
    case 'move': {
      const cue = stepCue(context?.kind(event.unit) ?? null, context?.body(event.unit) ?? null)
      return event.path.map((_, i) => ({ cue, delayMs: i * MOVE_STEP_MS + MOVE_STEP_MS / 2 }))
    }
    case 'battle_end':
      if (event.winner === 'player') return [{ cue: 'stings.victory', delayMs: STING_DELAY_MS }]
      if (event.winner === 'enemy') return [{ cue: 'stings.defeat', delayMs: STING_DELAY_MS }]
      return []
    default:
      return []
  }
}

/** The level-up sting starts this long after the battle ends: the victory sting's start, its length, and a breath. */
export function levelUpDelayMs(): number {
  return STING_DELAY_MS + cueDurationMs('stings.victory') + 150
}

// ---- world and interface ----------------------------------------------------

/** The gap between the two cues a world message plays. */
export const WORLD_SOUND_GAP_MS = 250

/** The kinds of world event that sound, highest priority first, with the cue each plays and what makes an event of it. */
const WORLD_SOUND_KINDS: readonly { cue: CueId; is: (event: WorldEvent | PartyEvent) => boolean }[] = [
  { cue: 'stings.defeat', is: (e) => e.type === 'encampment_lost' },
  { cue: 'world.confront', is: (e) => e.type === 'confronting' },
  { cue: 'world.source', is: (e) => e.type === 'sighted' && e.source === true },
  { cue: 'world.lost', is: (e) => e.type === 'site_lost' || e.type === 'tower_lost' || e.type === 'route_abandoned' },
  { cue: 'world.sighted', is: (e) => e.type === 'sighted' && e.source !== true },
  { cue: 'world.threatened', is: (e) => e.type === 'site_threatened' || e.type === 'partner_silent' || (e.type === 'route_raided' && e.days === 1) },
  { cue: 'world.captured', is: (e) => e.type === 'site_captured' || e.type === 'route_restored' || e.type === 'partner_restored' },
  { cue: 'world.build', is: (e) => e.type === 'tower_built' || e.type === 'site_improved' || e.type === 'partner_contacted' || e.type === 'route_opened' },
  { cue: 'world.arrive', is: (e) => e.type === 'arrived' || e.type === 'met' },
]

/**
 * What a world message sounds: one cue per kind of event, the two highest in
 * priority, the second `WORLD_SOUND_GAP_MS` after the first.
 * Pure, and drawing no RNG.
 */
export function worldSounds(events: readonly (WorldEvent | PartyEvent)[]): SoundCue[] {
  return WORLD_SOUND_KINDS.filter((kind) => events.some(kind.is))
    .slice(0, 2)
    .map((kind, i) => ({ cue: kind.cue, delayMs: i * WORLD_SOUND_GAP_MS }))
}

/** The events of days that passed, world's and parties', for `worldSounds`; with `own`, that party's own events are left out (its action's words tell what it did). */
export function reportEvents(reports: readonly DayReport[], own?: string): (WorldEvent | PartyEvent)[] {
  return reports.flatMap((report) => [...report.events, ...report.partyEvents.filter((event) => event.party !== own)])
}

/** The sound of an action that returns a refusal (`string | null`): the error when refused, else its success cue. */
export function refusalCue(refusal: string | null, success: CueId): CueId {
  return refusal !== null ? 'ui.error' : success
}

/** The cue of a runecraft action. */
export function runeCue(kind: 'embed' | 'fuse' | 'extract'): CueId {
  return `world.rune.${kind}`
}

/** The labels of buttons that leave a screen or step back from one. */
const BACK_LABELS: ReadonlySet<string> = new Set(['Close', 'Back', 'Leave', 'Cancel', 'Back to game', 'Main Menu', 'End'])

/** What pressing a button of this label sounds: `ui.back` for one that closes or steps back, else a click. */
export function buttonCue(label: string): CueId {
  return BACK_LABELS.has(label) ? 'ui.back' : 'ui.click'
}
