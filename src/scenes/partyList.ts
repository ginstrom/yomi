import { maxHp, type Character } from '../character/character.ts'
import type { Expedition } from '../game/expedition.ts'
import type { GameState } from '../game/gameState.ts'
import { UNEXPLORED, isSighted } from '../game/vision.ts'
import { boardIndex } from '../game/blight.ts'
import { locationAt, midSentence, theName, type WorldLocation, type WorldState } from '../game/worldMap.ts'
import { hexEquals, hexKey, type Hex } from '../grid/hex.ts'
import type { Rect } from './mapScroll.ts'
import { HEADER_BOTTOM } from './partyPanel.ts'

/**
 * The parties the world map lists down its right side, and where each entry
 * sits; and where their figures stand on the map. `deployedParties` maps the
 * company's parties (`game.parties`), one entry each; while there is only one
 * it is called "Your party", and once there are more each goes by its name.
 * Each party carries the banner of its number (`bannerOf`), on the map and in
 * the list.
 */

/** The strip down the world map's right side; the map's view keeps to the left of it. */
export const PARTY_LIST_W = 80
/** What the single party is called while the company has no other (stage 5's design Q2, answered); with more, each goes by its name. */
export const SINGLE_PARTY_NAME = 'Your party'

/** Each banner's atlas sprite (art/map/), by banner number, each with an `idle` animation: crimson, azure, green. */
export const BANNER_SPRITES: Readonly<Record<number, string>> = { 1: 'map_banner', 2: 'map_banner_azure', 3: 'map_banner_green' }

/** A party's banner number, from its id (`party_2` is 2), so that a colour stays with its party whatever its place in the list; 1 for an id of no known number. */
export function bannerOf(id: string): number {
  const n = Number(/^party_(\d+)$/.exec(id)?.[1])
  return n in BANNER_SPRITES ? n : 1
}

/** How far apart, in pixels across, the figures of parties sharing a hex stand. */
export const FIGURE_SPREAD = 30

/** Each party's figure's offset across from its hex's centre: 0 for a party alone on its hex, and parties sharing one spread `FIGURE_SPREAD` apart in list order, centred on it. */
export function figureOffsets(parties: readonly Pick<Expedition, 'id' | 'position'>[]): Map<string, number> {
  const byHex = new Map<string, string[]>()
  for (const party of parties) {
    const key = hexKey(party.position)
    byHex.set(key, [...(byHex.get(key) ?? []), party.id])
  }
  const offsets = new Map<string, number>()
  for (const ids of byHex.values()) ids.forEach((id, i) => offsets.set(id, (i - (ids.length - 1) / 2) * FIGURE_SPREAD))
  return offsets
}

/** The party a click on `at` sends `party` to meet: the first other party of the company standing there, in list order, or null (none there, or `party` stands there itself). */
export function meetTarget(game: GameState, party: Expedition, at: Hex): Expedition | null {
  if (hexEquals(party.position, at)) return null
  return game.parties.find((other) => other !== party && other.members.length > 0 && hexEquals(other.position, at)) ?? null
}

/** Columns of the name drawn on an entry's portrait: its width over a 10px monospace character's. */
export const ENTRY_NAME_COLS = 10

/** A party's name as its entry's portrait shows it: "Company" shortened to "Co.", and what still does not fit cut with an ellipsis. */
export function entryName(name: string): string {
  const short = name.replace(/ Company$/, ' Co.')
  return short.length <= ENTRY_NAME_COLS ? short : `${short.slice(0, ENTRY_NAME_COLS - 1).trimEnd()}…`
}

const ENTRY_SIZE = 64
const ENTRY_MARGIN = 8
const ENTRY_PITCH = 104
const BAR_GAP = 2
const BAR_H = 6
const ORDER_GAP = 3
/** The order line's font size, and so its line height and how many columns of monospace fit in the strip. */
export const ORDER_FONT_PX = 9
export const ORDER_LINE_H = 11
export const ORDER_LINES = 2
/** Columns of the order line: the strip's width over a monospace character's (0.6 of the font size). */
export const ORDER_COLS = Math.floor(PARTY_LIST_W / (ORDER_FONT_PX * 0.6))

export interface PartyListEntry {
  id: string
  name: string
  /** The name on the entry's portrait (`entryName`): '' while the company has one party, which the strip leaves unnamed. */
  label: string
  /** The banner's number (`bannerOf`), 1 to 3. */
  banner: number
  /** The leader is `members[0]`, the member the map figure is dressed from. */
  members: readonly Character[]
  position: Hex
  /** The monsters the party stands before, if any. */
  confronting: { id: string; name: string } | null
  /** What the party is doing, in words (`orderLabel`). */
  order: string
  /** The members' hit points together. */
  hp: number
  /** The members' maximum hit points together. */
  maxHp: number
}

/**
 * What a party is doing, in a few words: facing monsters, idle, travelling
 * (to the name of what lies at its destination, but only if the player knows
 * of it), returning home, camping, garrisoning the site it stands on, meeting
 * another of `parties` (the company's), or the day's work it is doing.
 */
export function orderLabel(world: WorldState, party: Expedition, parties: readonly Expedition[] = [party]): string {
  if (party.confronting !== null) {
    const location = world.locations.find((l) => l.id === party.confronting)
    if (location) return `Before ${theName(location.name)}`
  }
  const { order } = party
  switch (order.kind) {
    case 'idle':
      return 'Idle'
    case 'travel':
      return travelLabel(world, order.to)
    case 'home':
      return 'Returning home'
    case 'camp':
      return 'Camping'
    case 'garrison': {
      const site = locationAt(world, party.position)
      return site ? `Garrisoning ${midSentence(site.name)}` : 'Garrisoning'
    }
    case 'meet': {
      const other = parties.find((p) => p.id === order.party)
      return other ? `Meeting ${other.name}` : 'Meeting'
    }
    case 'day':
      switch (order.action.kind) {
        case 'scout':
          return 'Scouting'
        case 'wait':
          return 'Waiting'
        case 'camp':
          return 'Camping'
        case 'tower':
        case 'outpost':
          return 'Building'
        case 'craft':
        case 'embed':
          return 'Crafting'
      }
  }
}

/** What is left of a party's travel or home order, its destination last, which the world map draws while nothing is hovered; empty for any other order. */
export function standingRoute(party: Expedition): readonly Hex[] {
  return party.order.kind === 'travel' || party.order.kind === 'home' ? party.order.route : []
}

/** A travel order's line: the name of what lies at `to`, but only if the player knows of it. */
export function travelLabel(world: WorldState, to: Hex): string {
  const location = knownLocationAt(world, to)
  return location ? `Travelling to ${midSentence(location.name)}` : 'Travelling'
}

/** The location at `at` if the player knows of it (monsters sighted, a quiet place on explored land), else null. */
export function knownLocationAt(world: WorldState, at: Hex): WorldLocation | null {
  const location = locationAt(world, at)
  if (!location) return null
  const known = location.kind === 'monsters' ? isSighted(world, location.id) : world.seen[boardIndex(world.board, location.position)] !== UNEXPLORED
  return known ? location : null
}

/** `label` wrapped onto at most `ORDER_LINES` lines of `ORDER_COLS` columns, the last cut short with an ellipsis if it does not fit. */
export function orderLines(label: string): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of label.split(' ')) {
    const joined = line === '' ? word : `${line} ${word}`
    if (joined.length <= ORDER_COLS) line = joined
    else {
      if (line !== '') lines.push(line)
      line = word
    }
  }
  if (line !== '') lines.push(line)
  if (lines.length === 0) return []
  const kept = lines.slice(0, ORDER_LINES)
  const cut = lines.length > ORDER_LINES
  const last = kept.length - 1
  // The words past the last line, or a word too long for it, end in an ellipsis.
  const text = cut ? `${kept[last]} ${lines.slice(ORDER_LINES).join(' ')}` : kept[last]
  if (cut || text.length > ORDER_COLS) kept[last] = `${text.slice(0, ORDER_COLS - 1)}…`
  return kept.map((l, i) => (i < last && l.length > ORDER_COLS ? `${l.slice(0, ORDER_COLS - 1)}…` : l))
}

/** An order line shown in place of a party's own: while the map plays a walk the game has already made, the order it was walking by. */
export interface ShownOrder {
  party: string
  order: string
}

/** Every party of the company, in company order; a party with no members is left out. `shown` replaces one party's order line. */
export function deployedParties(game: GameState, shown: ShownOrder | null = null): PartyListEntry[] {
  const { world } = game
  return game.parties
    .filter((expedition) => expedition.members.length > 0)
    .map((expedition) => {
      const party = expedition.members
      const location = expedition.confronting === null ? undefined : world.locations.find((l) => l.id === expedition.confronting)
      return {
        id: expedition.id,
        name: game.parties.length === 1 ? SINGLE_PARTY_NAME : expedition.name,
        label: game.parties.length === 1 ? '' : entryName(expedition.name),
        banner: bannerOf(expedition.id),
        members: party,
        position: expedition.position,
        order: shown?.party === expedition.id ? shown.order : orderLabel(world, expedition, game.parties),
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

/** Where the `index`th entry's order line is, under its bar. */
export function partyEntryOrderRect(index: number, width: number): Rect {
  const bar = partyEntryBarRect(index, width)
  return { x: width - PARTY_LIST_W, y: bar.y + bar.height + ORDER_GAP, width: PARTY_LIST_W, height: ORDER_LINES * ORDER_LINE_H }
}

/** What the info panel tells of a hovered entry. */
export function partyListInfo(entry: PartyListEntry): { title: string; lines: string[] } {
  const count = entry.members.length
  const lines = [`${count} ${count === 1 ? 'member' : 'members'}`, `Hit points: ${entry.hp} / ${entry.maxHp}`, entry.order]
  lines.push('Click to centre the view on it.')
  return { title: entry.name, lines }
}
