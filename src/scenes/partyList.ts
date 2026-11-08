import { maxHp, type Character } from '../character/character.ts'
import type { GameState } from '../game/gameState.ts'
import type { Hex } from '../grid/hex.ts'
import type { Rect } from './mapScroll.ts'
import { HEADER_BOTTOM } from './partyPanel.ts'

/**
 * The parties the world map lists down its right side, and where each entry
 * sits. `deployedParties` maps the company's parties (`game.parties`), one
 * entry each; while there is only one it is called "Your party", and that
 * holds until stage 06 names parties.
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

/** Every party of the company, in company order; a party with no members is left out. */
export function deployedParties(game: GameState): PartyListEntry[] {
  const { world } = game
  return game.parties
    .filter((expedition) => expedition.members.length > 0)
    .map((expedition) => {
      const party = expedition.members
      const location = expedition.confronting === null ? undefined : world.locations.find((l) => l.id === expedition.confronting)
      return {
        id: expedition.id,
        name: game.parties.length === 1 ? SINGLE_PARTY_NAME : expedition.name,
        members: party,
        position: expedition.position,
        confronting: location ? { id: location.id, name: location.name } : null,
        hp: party.reduce((sum, member) => sum + member.hp, 0),
        maxHp: party.reduce((sum, member) => sum + maxHp(member), 0),
      }
    })
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
