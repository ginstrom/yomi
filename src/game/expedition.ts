import type { Hex } from '../grid/hex.ts'
import type { Grade } from '../inventory/grades.ts'
import type { Item } from '../inventory/inventory.ts'
import type { ModifierId } from '../inventory/modifiers.ts'
import type { RuneKey } from '../inventory/runes.ts'
import type { ItemPlace } from './itemPlace.ts'
import type { Party } from './party.ts'
import type { WorldState } from './worldMap.ts'

/**
 * The company's parties as the world's rules see them. The blight, sight,
 * territory and `passTurn` take a list of presences, one a party, and work
 * over all of them; with a list of one they give what the single party did.
 */

/** A party as the world's rules see it: where it stands, and its members' levels. */
export interface PartyPresence {
  position: Hex
  levels: readonly number[]
}

/** The one party of today's game as a list of one presence, standing where `world.party` says. Transitional: step 04 of stage 5 removes it. */
export function soloPresences(world: WorldState, party: readonly { level: number }[]): PartyPresence[] {
  return [{ position: world.party, levels: party.map((m) => m.level) }]
}

/** A one-day action of a party (stage 5 step 07 runs them). */
export type DayAction =
  | { kind: 'scout' }
  | { kind: 'wait' }
  | { kind: 'camp' } // one day's rest (campDay), no spells
  | { kind: 'tower' } // build a watchtower where it stands
  | { kind: 'outpost' } // build an outpost on the held site it stands on
  | { kind: 'craft'; place: ItemPlace; modifier: ModifierId; grade: Grade } // a field craft
  | { kind: 'embed'; place: ItemPlace; rune: RuneKey } // a field embed

/** A party's standing order (stage 6 adds home, garrison and meet). */
export type Order =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Hex; route: Hex[] } // the hexes still to walk, `to` last, planned once when given
  | { kind: 'camp' } // camp until healed: rest, then the party's heals, each day
  | { kind: 'day'; action: DayAction } // one day's action, then idle

/** The kinds an `Order` may have: what a save is checked against. */
export const ORDER_KINDS: readonly Order['kind'][] = ['idle', 'travel', 'camp', 'day']

/** One party of the company: its members, its baggage and its standing order. */
export interface Expedition {
  /** Stable: 'party_1', … */
  id: string
  /** 'First Company' for the first; the map shows 'Your party' while it is the only one. */
  name: string
  /** The members in battle order. */
  members: Party
  /** Its shared pile of items, with no limit, that travels with it. */
  baggage: Item[]
  order: Order
}

export const FIRST_PARTY_ID = 'party_1'
export const FIRST_PARTY_NAME = 'First Company'

export function newExpedition(members: Party): Expedition {
  return { id: FIRST_PARTY_ID, name: FIRST_PARTY_NAME, members, baggage: [], order: { kind: 'idle' } }
}
