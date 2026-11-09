import type { Hex } from '../grid/hex.ts'
import type { Grade } from '../inventory/grades.ts'
import type { Item } from '../inventory/inventory.ts'
import type { ModifierId } from '../inventory/modifiers.ts'
import type { RuneKey } from '../inventory/runes.ts'
import type { ItemPlace } from './itemPlace.ts'
import type { Party } from './party.ts'

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

/** A party as the world's rules see it. */
export function presenceOf(party: Expedition): PartyPresence {
  return { position: party.position, levels: party.members.map((m) => m.level) }
}

/** The company's presences, one a party, in list order. */
export function presences(parties: readonly Expedition[]): PartyPresence[] {
  return parties.map(presenceOf)
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

/** A party's standing order, which the day loop (company.ts) runs a day at a time. */
export type Order =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Hex; route: Hex[] } // the hexes still to walk, `to` last, planned once when given
  | { kind: 'home'; to: Hex; route: Hex[] } // travel to the encampment, walked as travel is; then idle
  | { kind: 'camp' } // camp until healed: rest, then the party's heals, each day
  | { kind: 'garrison' } // stand on a held resource site, doing nothing each day; never ends by itself
  | { kind: 'meet'; party: string } // a hex a day toward that party's current hex, re-planned daily, until the two share a hex
  | { kind: 'day'; action: DayAction } // one day's action, then idle

/** The kinds an `Order` may have: what a save is checked against. */
export const ORDER_KINDS: readonly Order['kind'][] = ['idle', 'travel', 'home', 'camp', 'garrison', 'meet', 'day']

/** One party of the company: its members, its baggage, where it stands, its standing order and the monsters it faces. */
export interface Expedition {
  /** Stable: 'party_1', … */
  id: string
  /** 'First Company' for the first; the map shows 'Your party' while it is the only one. */
  name: string
  /** The members in battle order. */
  members: Party
  /** Its shared pile of items, with no limit, that travels with it. */
  baggage: Item[]
  /** The hex it stands on. */
  position: Hex
  order: Order
  /**
   * The id of the monster location it has walked into and not yet answered.
   * Until it scouts, waits or attacks, it cannot travel on.
   */
  confronting: string | null
}

/** The most parties the company may have. */
export const MAX_PARTIES = 3
/** The default name of party `n`, `PARTY_NAMES[n - 1]`. */
export const PARTY_NAMES: readonly string[] = ['First Company', 'Second Company', 'Third Company']

/** The id of party number `n` (1 to `MAX_PARTIES`). */
export function partyId(n: number): string {
  return `party_${n}`
}

export const FIRST_PARTY_ID = partyId(1)
export const FIRST_PARTY_NAME = PARTY_NAMES[0]

/** A party standing at `position`, idle, with no baggage. */
export function newExpedition(members: Party, position: Hex, id = FIRST_PARTY_ID, name = FIRST_PARTY_NAME): Expedition {
  return { id, name, members, baggage: [], position, order: { kind: 'idle' }, confronting: null }
}
