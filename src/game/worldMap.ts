import { HexBoard, hexDistance, hexEquals, hexKey, offsetToHex, reachableHexes, type BoardSize, type Hex } from '../grid/hex.ts'
import { MAX_THREAT, type EncounterId } from './encounters.ts'

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

/** Monsters to scout, wait out or attack; attacking fights `encounter` at `threat`. */
export interface MonsterLocation extends LocationBase {
  kind: 'monsters'
  encounter: EncounterId
  /** How dangerous they are, from 1: set by how far from home they lie (`threatAt`). */
  threat: number
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

/**
 * The map is far larger than a window shows, so the party sees only what lies
 * around it and the rest comes into view as it travels.
 */
export const WORLD_SIZE: BoardSize = { cols: 60, rows: 40 }

/** Where a new game's party stands: Oakvale, in the west. */
const HOME: Hex = offsetToHex(9, 19)

/**
 * How many hexes from home each step of threat is. The first band holds the
 * party's home country, and the map's far corners reach the top threat.
 */
export const THREAT_BAND = 11

/** How dangerous the monsters at `position` are: 1 around home, and one more for every `THREAT_BAND` hexes out, up to `MAX_THREAT`. */
export function threatAt(position: Hex): number {
  return Math.min(MAX_THREAT, 1 + Math.floor(hexDistance(HOME, position) / THREAT_BAND))
}

const town = (id: string, name: string, col: number, row: number): WorldLocation => ({
  id,
  kind: 'town',
  name,
  position: offsetToHex(col, row),
})
const resource = (id: string, name: string, col: number, row: number): WorldLocation => ({
  id,
  kind: 'resource',
  name,
  position: offsetToHex(col, row),
})
const monsters = (id: string, name: string, col: number, row: number, encounter: EncounterId): WorldLocation => ({
  id,
  kind: 'monsters',
  name,
  position: offsetToHex(col, row),
  encounter,
  threat: threatAt(offsetToHex(col, row)),
})

export function newWorld(): WorldState {
  return {
    board: WORLD_SIZE,
    party: HOME,
    turn: 1,
    // The party's home country first, in the west, then the lands further out,
    // whose monsters are the more dangerous the further they lie (threatAt).
    locations: [
      town('oakvale', 'Oakvale', 9, 19),
      town('stonebridge', 'Stonebridge', 18, 18),
      resource('iron_vein', 'Iron Vein', 11, 21),
      resource('gold_seam', 'Gold Seam', 15, 16),
      monsters('goblin_raiders', 'Goblin Raiders', 13, 18, 'goblin_raid'),
      monsters('kobold_scouts', 'Kobold Scouts', 16, 21, 'kobold_scouts'),

      town('greyford', 'Greyford', 6, 5),
      town('millbrook', 'Millbrook', 10, 34),
      town('highmoor', 'Highmoor', 30, 8),
      town('saltmarsh', 'Saltmarsh', 25, 31),
      town('eastwatch', 'Eastwatch', 44, 20),
      town('thornwick', 'Thornwick', 52, 6),
      town('deepwell', 'Deepwell', 50, 34),
      resource('timber_stand', 'Timber Stand', 4, 28),
      resource('peat_bog', 'Peat Bog', 21, 4),
      resource('silver_lode', 'Silver Lode', 27, 14),
      resource('old_quarry', 'Old Quarry', 36, 26),
      resource('salt_flats', 'Salt Flats', 33, 36),
      resource('copper_pit', 'Copper Pit', 41, 10),
      resource('crystal_cave', 'Crystal Cave', 56, 24),
      monsters('goblin_reavers', 'Goblin Reavers', 12, 8, 'goblin_raid'),
      monsters('kobold_trappers', 'Kobold Trappers', 8, 30, 'kobold_scouts'),
      monsters('goblin_warband', 'Goblin Warband', 24, 10, 'goblin_raid'),
      monsters('kobold_diggers', 'Kobold Diggers', 22, 25, 'kobold_scouts'),
      monsters('kobold_skulkers', 'Kobold Skulkers', 30, 22, 'kobold_scouts'),
      monsters('goblin_marauders', 'Goblin Marauders', 34, 17, 'goblin_raid'),
      monsters('kobold_lurkers', 'Kobold Lurkers', 39, 31, 'kobold_scouts'),
      monsters('goblin_outriders', 'Goblin Outriders', 47, 13, 'goblin_raid'),
      monsters('kobold_tunnellers', 'Kobold Tunnellers', 54, 28, 'kobold_scouts'),
      monsters('goblin_pillagers', 'Goblin Pillagers', 57, 10, 'goblin_raid'),
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
