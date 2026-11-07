import { SPELLS, type SpellId } from '../combat/spells.ts'
import type { BattleEvent } from '../engine/battleEngine.ts'
import type { ItemIcon } from '../inventory/inventory.ts'

/**
 * How the battle screen shows a blow, a shot or a spell, and how long it takes
 * to land, kept free of Phaser so it can be unit tested. `BattleScene` draws
 * the effects; this says which and when.
 */

/**
 * The effect sprites (art/effects/, the `effect` canvas): drawn pointing
 * right about their centre, a missile and the burst drawn pale for a tint of
 * its colour. One drawn point first names the pixel that strikes `tip`.
 */
export const ARROW_SPRITE = 'fx_arrow'
export const MISSILE_SPRITES: Record<Missile, string> = { orb: 'fx_orb', dart: 'fx_dart' }
export const BURST_SPRITE = 'fx_burst'
export const BURST_ANIM = 'burst'
export const EFFECT_FRAME = 'main'
export const TIP_POINT = 'tip'

/** A blow is swung; a shot flies, as an arrow from a bow or a bolt from a wand. */
export type AttackLook = 'swing' | 'arrow' | 'bolt'

/** What a hero holds in its weapon hand decides the look of a shot; a foe holds none, and only strikes. */
export function attackLook(event: Extract<BattleEvent, { type: 'attack' }>, heldIcon?: ItemIcon): AttackLook {
  if (event.distance <= 1) return 'swing'
  return heldIcon?.startsWith('wand') ? 'bolt' : 'arrow'
}

/** What flies from the caster: a glowing orb, a dart of light, or nothing for a spell laid on oneself. */
export type Missile = 'orb' | 'dart'
/** What happens where a spell lands. */
export type Impact = 'burst' | 'cloud' | 'sparkle' | 'ring'

export interface SpellLook {
  /** The missile's core and the impact's main colour. */
  colour: number
  /** The trail behind the missile and the impact's sparks. */
  glow: number
  missile: Missile
  impact: Impact
}

const FIRE: SpellLook = { colour: 0xff7a1a, glow: 0xffd54f, missile: 'orb', impact: 'burst' }
const HEALING: SpellLook = { colour: 0x7ee07e, glow: 0xe8ffd8, missile: 'orb', impact: 'sparkle' }
const SUPPORT: SpellLook = { colour: 0x6fa8ff, glow: 0xd8e8ff, missile: 'orb', impact: 'ring' }

export const SPELL_LOOKS: Record<SpellId, SpellLook> = {
  magic_arrow: { colour: 0xb39ddb, glow: 0xf3e5f5, missile: 'dart', impact: 'burst' },
  flame_arrow: { ...FIRE, missile: 'dart' },
  sleep: { colour: 0x9575cd, glow: 0xd1c4e9, missile: 'orb', impact: 'sparkle' },
  frost_blast: { colour: 0x81d4fa, glow: 0xe1f5fe, missile: 'orb', impact: 'burst' },
  fireball: FIRE,
  acid_arrow: { colour: 0x9ccc65, glow: 0xdce775, missile: 'dart', impact: 'burst' },
  death_cloud: { colour: 0x558b2f, glow: 0x9e9d24, missile: 'orb', impact: 'cloud' },
  heal: HEALING,
  greater_heal: HEALING,
  heal_all: HEALING,
  greater_heal_all: HEALING,
  shield: SUPPORT,
  protect: SUPPORT,
  bless: { ...SUPPORT, colour: 0xffe082, glow: 0xfff8e1 },
  mirror_image: { ...SUPPORT, colour: 0xe0e0e0, glow: 0xffffff },
  haste: { ...SUPPORT, colour: 0xfff176, glow: 0xffffff },
  bane: { colour: 0x7b1fa2, glow: 0xce93d8, missile: 'orb', impact: 'cloud' },
}

/** From the start of a swing to the blow landing: the wind-up, then the cut. */
export const SWING_IMPACT_MS = 130
/** A shot's draw or a cast's gesture before the missile leaves. */
export const RELEASE_MS = 60
/** A missile's flight: a moment to leave, then so long a hex. */
export const FLIGHT_BASE_MS = 90
export const FLIGHT_PER_HEX_MS = 45

/** How long a missile takes to cross `hexes`. */
export function flightMs(hexes: number): number {
  return FLIGHT_BASE_MS + FLIGHT_PER_HEX_MS * hexes
}

/**
 * How long after an attack or a cast is shown it lands: when the blow or the
 * missile strikes, hit points change and the sound of the outcome is heard.
 * What follows it in the log (a fall, a battle's end) waits for it (`holdMs`).
 */
export function impactMs(event: BattleEvent): number {
  if (event.type === 'attack') return event.distance <= 1 ? SWING_IMPACT_MS : RELEASE_MS + flightMs(event.distance)
  if (event.type === 'cast') return RELEASE_MS + (event.distance === 0 ? 0 : flightMs(event.distance))
  return 0
}

/** A beat after a blow or a spell lands, for it to be seen before what follows. */
export const SETTLE_MS = 80

/** How long what follows an event in the log waits for it: an attack or a cast until it has landed and settled. */
export function holdMs(event: BattleEvent): number {
  const ms = impactMs(event)
  return ms === 0 ? 0 : ms + SETTLE_MS
}

/** The colour a unit's outline pulses when an outcome lands on it. */
export const OUTLINE_HURT = 0xff3d00
export const OUTLINE_CRITICAL = 0xffea00
export const OUTLINE_HEALED = 0x76ff03
export const OUTLINE_HELPED = 0x40c4ff
export const OUTLINE_IMAGE = 0xffffff

/** The outline for a spell's outcome on one unit: a friendly spell helps or heals, a hostile one hurts on a hit. */
export function castOutline(spell: SpellId, outcome: { hit: boolean; critical?: boolean; image?: boolean }): number | null {
  const { hostile, school } = SPELLS[spell]
  if (outcome.image) return OUTLINE_IMAGE
  if (!hostile) return school === 'healing' ? OUTLINE_HEALED : OUTLINE_HELPED
  if (!outcome.hit) return null
  return outcome.critical ? OUTLINE_CRITICAL : OUTLINE_HURT
}
