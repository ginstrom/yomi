import { FIRST_PARTY_ID } from '../game/expedition.ts'
import { maxHp, type Character } from '../character/character.ts'
import { leader, type GameState } from '../game/gameState.ts'
import type { Hex } from '../grid/hex.ts'
import type { Rect } from './mapScroll.ts'
import { HEADER_BOTTOM } from './partyPanel.ts'

/**
 * The parties the world map lists down its right side, and where each entry
 * sits. `deployedParties` is the only reader of the single party the game
 * holds today (`leader(game)`, its members where it stands); when stage 05 gives the
 * company several parties, it maps `game.parties` here and nothing else moves.
 */

/** The strip down the world map's right side; the map's view keeps to the left of it. */
export const PARTY_LIST_W = 80
/** What the single party is called until stage 06 names parties (design Q2, answered). */
export const SINGLE_PARTY_NAME = 'Your party'

const ENTRY_SIZE = 64
const ENTRY_MARGIN = 8
const ENTRY_PITCH = 80
const BAR_GAP = 2
const BAR_H = 6

export interface PartyListEntry {
  id: string
  name: string
  /** The leader is `members[0]`, the member the map figure is dressed from. */
  members: readonly Character[]
  position: Hex
  /** The monsters the party stands before, if any. */
  confronting: { id: string; name: string } | null
  /** The members' hit points together. */
  hp: number
  /** The members' maximum hit points together. */
  maxHp: number
}

/** Every party of the company, in company order: one today, none for an empty party. */
export function deployedParties(game: GameState): PartyListEntry[] {
  const expedition = leader(game)
  const party = expedition.members
  const { world } = game
  if (party.length === 0) return []
  const location = expedition.confronting === null ? undefined : world.locations.find((l) => l.id === expedition.confronting)
  return [
    {
      id: FIRST_PARTY_ID,
      name: SINGLE_PARTY_NAME,
      members: party,
      position: expedition.position,
      confronting: location ? { id: location.id, name: location.name } : null,
      hp: party.reduce((sum, member) => sum + member.hp, 0),
      maxHp: party.reduce((sum, member) => sum + maxHp(member), 0),
    },
  ]
}

/** Where the `index`th entry's tile is in a window `width` wide. */
export function partyEntryRect(index: number, width: number): Rect {
  return {
    x: width - PARTY_LIST_W + (PARTY_LIST_W - ENTRY_SIZE) / 2,
    y: HEADER_BOTTOM + ENTRY_MARGIN + index * ENTRY_PITCH,
    width: ENTRY_SIZE,
    height: ENTRY_SIZE,
  }
}

/** Where the `index`th entry's hit point bar is, under its tile. */
export function partyEntryBarRect(index: number, width: number): Rect {
  const { x, y, height } = partyEntryRect(index, width)
  return { x, y: y + height + BAR_GAP, width: ENTRY_SIZE, height: BAR_H }
}

/** What the info panel tells of a hovered entry. */
export function partyListInfo(entry: PartyListEntry): { title: string; lines: string[] } {
  const count = entry.members.length
  const lines = [`${count} ${count === 1 ? 'member' : 'members'}`, `Hit points: ${entry.hp} / ${entry.maxHp}`]
  if (entry.confronting) lines.push(`Before the ${entry.confronting.name}`)
  lines.push('Click to centre the view on it.')
  return { title: entry.name, lines }
}
