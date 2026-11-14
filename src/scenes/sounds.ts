import { SPELLS } from '../combat/spells.ts'
import type { BattleEvent } from '../engine/battleEngine.ts'
import manifest from '../../audio/sfx.manifest.json'
import { impactMs } from './battleEffects.ts'

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

/**
 * The cues that go with a battle event. An outcome is heard as the blow or the
 * missile lands (`impactMs`).
 */
export function eventSounds(event: BattleEvent): SoundCue[] {
  switch (event.type) {
    case 'attack': {
      const outcome: CueId = !event.hit ? 'battle.miss.swing' : event.critical ? 'battle.hit.crit' : 'battle.hit.slash'
      return [
        { cue: 'battle.swing.blade', delayMs: 0 },
        { cue: outcome, delayMs: impactMs(event) },
      ]
    }
    case 'cast': {
      // A friendly spell chimes; a hostile one lands as its best outcome does, an image struck being a miss.
      const struck = event.outcomes.filter((o) => o.hit && !o.image)
      const outcome: CueId = !SPELLS[event.spell].hostile
        ? 'battle.impact.heal'
        : struck.length === 0
          ? 'battle.miss.swing'
          : struck.some((o) => o.critical)
            ? 'battle.hit.crit'
            : 'battle.hit.slash'
      return [
        { cue: 'battle.cast.arcane', delayMs: 0 },
        { cue: outcome, delayMs: impactMs(event) },
      ]
    }
    case 'ability': {
      // A miss that still burns for half is heard to strike.
      const struck = event.outcomes.filter((o) => (o.hit || (o.half && o.damage > 0)) && !o.image)
      const outcome: CueId =
        struck.length === 0 ? 'battle.miss.swing' : struck.some((o) => o.critical) ? 'battle.hit.crit' : 'battle.hit.slash'
      return [
        { cue: 'battle.cast.arcane', delayMs: 0 },
        { cue: outcome, delayMs: impactMs(event) },
      ]
    }
    case 'status_tick':
      return [{ cue: 'battle.hit.slash', delayMs: 0 }]
    case 'regenerate':
      return [{ cue: 'battle.regen', delayMs: 0 }]
    case 'unit_down':
      return [{ cue: 'battle.death.human', delayMs: 0 }]
    case 'battle_end':
      if (event.winner === 'player') return [{ cue: 'stings.victory', delayMs: STING_DELAY_MS }]
      if (event.winner === 'enemy') return [{ cue: 'stings.defeat', delayMs: STING_DELAY_MS }]
      return []
    default:
      return []
  }
}
