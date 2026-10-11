import { HexBoard, hexEquals, hexKey, offsetToHex, reachableHexes, type BoardSize, type Hex } from '../grid/hex.ts'
import type { EncounterId } from './encounters.ts'

/**
 * The world map: a hex board the party travels between battles, with points of
 * interest on it. Phaser-free, like the battle rules; `WorldScene` is a view
 * over it. Time passes in turns: a step of travel takes one, and so does
 * scouting or waiting at a monster location.
 */

interface LocationBase {
  id: string
  name: string
  position: Hex
}

/** Monsters to scout, wait out or attack; attacking fights `encounter`. */
export interface MonsterLocation extends LocationBase {
  kind: 'monsters'
  encounter: EncounterId
}

/** Towns and resources are only shown for now; nothing happens at them. */
export interface QuietLocation extends LocationBase {
  kind: 'town' | 'resource'
}

export type WorldLocation = MonsterLocation | QuietLocation
export type LocationKind = WorldLocation['kind']

export interface WorldState {
  board: BoardSize
  /** The hex the party stands on. */
  party: Hex
  /** Counts from 1. */
  turn: number
  locations: WorldLocation[]
  /**
   * The id of the monster location the party has walked into and not yet
   * answered. Until it scouts, waits or attacks, it cannot travel on.
   */
  confronting: string | null
}

/** What the party can do about the monsters it stands among, other than attack them. */
export type Lingering = 'scout' | 'wait'

export function newWorld(): WorldState {
  return {
    board: { cols: 12, rows: 7 },
    party: offsetToHex(1, 3),
    turn: 1,
    locations: [
      { id: 'oakvale', kind: 'town', name: 'Oakvale', position: offsetToHex(1, 3) },
      { id: 'stonebridge', kind: 'town', name: 'Stonebridge', position: offsetToHex(10, 2) },
      { id: 'iron_vein', kind: 'resource', name: 'Iron Vein', position: offsetToHex(3, 5) },
      { id: 'gold_seam', kind: 'resource', name: 'Gold Seam', position: offsetToHex(7, 0) },
      {
        id: 'goblin_raiders',
        kind: 'monsters',
        name: 'Goblin Raiders',
        position: offsetToHex(5, 2),
        encounter: 'goblin_raid',
      },
      {
        id: 'kobold_scouts',
        kind: 'monsters',
        name: 'Kobold Scouts',
        position: offsetToHex(8, 5),
        encounter: 'kobold_scouts',
      },
    ],
    confronting: null,
  }
}

export function locationAt(world: WorldState, at: Hex): WorldLocation | null {
  return world.locations.find((l) => hexEquals(l.position, at)) ?? null
}

/** The monster location the party stands on, if any: the one it may scout, wait at or attack. */
export function monstersHere(world: WorldState): MonsterLocation | null {
  const here = locationAt(world, world.party)
  return here?.kind === 'monsters' ? here : null
}

/**
 * The hexes the party would walk to reach `to`, `to` included, or null when it
 * cannot go there: it is off the map or where the party already stands, or
 * monsters the party walked into still await its answer. The route keeps
 * clear of every monster location except one it ends on.
 */
export function routeTo(world: WorldState, to: Hex): Hex[] | null {
  const board = new HexBoard(world.board)
  if (world.confronting !== null || !board.contains(to)) return null
  const passable = (h: Hex) => board.contains(h) && (hexEquals(h, to) || locationAt(world, h)?.kind !== 'monsters')
  return reachableHexes(world.party, board.hexes.length, passable).get(hexKey(to)) ?? null
}

/**
 * Walks the party to `to`, a turn a hex, and returns the hexes walked (none if
 * there is no route). Arriving among monsters confronts the party with them.
 */
export function travel(world: WorldState, to: Hex): Hex[] {
  const route = routeTo(world, to)
  if (!route) return []
  world.party = to
  world.turn += route.length
  world.confronting = monstersHere(world)?.id ?? null
  return route
}

/**
 * Spends a turn scouting or waiting at the monsters the party stands among,
 * which frees it to travel on. Neither does more yet: scouting learns nothing
 * and the monsters never answer. Returns false when there are no monsters here.
 */
export function linger(world: WorldState, _how: Lingering): boolean {
  if (!monstersHere(world)) return false
  world.turn += 1
  world.confronting = null
  return true
}

/** Takes a location off the map, as when its monsters are beaten. */
export function clearLocation(world: WorldState, id: string): void {
  world.locations = world.locations.filter((l) => l.id !== id)
  if (world.confronting === id) world.confronting = null
}
