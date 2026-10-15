import { randomSeed } from '../combat/rng.ts'
import { HexBoard, hexDistance, hexEquals, hexKey, offsetToHex, reachableHexes, type BoardSize, type Hex } from '../grid/hex.ts'
import {
  AMULET_FOCUS,
  EMBERBLADE,
  HAWK_BOW,
  RING_FORTUNE,
  RING_PROTECTION,
  SAGE_CIRCLET,
  SHADOW_CLOAK,
  SPARK_WAND,
  STORM_WAND,
  type Item,
} from '../inventory/inventory.ts'
import { advanceDay, cleanse, seedBlight, type WorldEvent } from './blight.ts'
import { MAX_THREAT, type EncounterId } from './encounters.ts'
import { initialHeld, updateTerritory, type Stock } from './territory.ts'
import { seedSight, updateSight } from './vision.ts'

/**
 * The world map: a hex board the party travels between battles, with points of
 * interest on it. Phaser-free, like the battle rules; `WorldScene` is a view
 * over it. Time passes in turns: a step of travel takes one, and so does
 * scouting or waiting at a monster location, or a day of camping (camp.ts).
 * Every turn passes through `passTurn`, which is the blight's day (blight.ts),
 * the territory's (territory.ts) and what the player sees of them (vision.ts).
 */

interface LocationBase {
  id: string
  name: string
  position: Hex
}

/** Monsters to scout, wait out or attack; attacking fights `encounter` at `threat`, and beating them wins their `loot`. */
export interface MonsterLocation extends LocationBase {
  kind: 'monsters'
  encounter: EncounterId
  /** How dangerous they are, from 1: set by how far from home they lie (`threatAt`). */
  threat: number
  /** What the party finds when it has beaten them (`takeLoot` in gameState.ts): better the further out. */
  loot: Item[]
  /** The Source of the blight: its strongest source, and beating it wins the game. */
  source?: true
}

/** Towns and resources, which the party holds while their land is clean (territory.ts); Oakvale is the encampment. */
export interface QuietLocation extends LocationBase {
  kind: 'town' | 'resource'
}

export type WorldLocation = MonsterLocation | QuietLocation

/** A watchtower the party built (buildings.ts): not a location, as it holds no battle and blocks no route. */
export interface Tower {
  id: string
  position: Hex
}
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
  /** Every hex's blight level, 0 to 3, by `boardIndex` (blight.ts). */
  blight: number[]
  /** Every hex's shift counter, by `boardIndex`: how far the day's influence has pushed it toward its next level. */
  shift: number[]
  /** What corrupted land has built up toward the next spawn. */
  spawnPressure: number
  /** How many monster locations have spawned, which names the next. */
  spawns: number
  /** Where the world's RNG stands (`mulberry32`'s `state()`); only spawns draw from it. */
  rng: number
  /**
   * What the player knows of every hex, by `boardIndex` (vision.ts): `UNEXPLORED`
   * (-1) for a hex never seen, else its blight level when it was last in sight.
   */
  seen: number[]
  /** The ids of the monster locations the player has seen; routes keep clear only of these. */
  sighted: string[]
  /** The ids of the towns and resources held, the encampment among them while the game lasts. */
  held: string[]
  /** The guild hall's level, 1 to `MAX_GUILD_HALL_LEVEL` (guildHall.ts), which sets the party limit. */
  guildHall: number
  /** The watchtowers standing. */
  towers: Tower[]
  /** How many watchtowers have been built, which names the next. */
  towersBuilt: number
  /** The shrine's level at the encampment, 0 (none) to `MAX_SHRINE_LEVEL` (buildings.ts): each adds to the encampment's strength. */
  shrine: number
  /** The ids of the held sites with an outpost (buildings.ts), which adds to a site's strength and yield; razed when the site is lost. */
  outposts: string[]
  /** The held sites and towers the blight is gaining on, as of the last day. */
  threatened: string[]
  /** What held sites have yielded, kept at the encampment, which buildings and the guild hall spend. */
  stock: Stock
  /** 'won' once the Source is beaten, until the player ends the game or goes on in 'endless' mode; 'lost' once the encampment falls. */
  status: WorldStatus
}

export type WorldStatus = 'playing' | 'won' | 'endless' | 'lost'

/** What the party can do about the monsters it stands among, other than attack them. */
export type Lingering = 'scout' | 'wait'

/**
 * The map is far larger than a window shows, so the party sees only what lies
 * around it and the rest comes into view as it travels.
 */
export const WORLD_SIZE: BoardSize = { cols: 60, rows: 40 }

/** Where a new game's party stands: Oakvale, in the west, the encampment. */
const HOME: Hex = offsetToHex(9, 19)
export const ENCAMPMENT_ID = 'oakvale'
export const SOURCE_ID = 'blight_source'

/** How far from the party a spawn must be to stop it travelling or camping. */
export const NOTICE_RADIUS = 8

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
const monsters = (
  id: string,
  name: string,
  col: number,
  row: number,
  encounter: EncounterId,
  loot: Item[],
): WorldLocation => ({
  id,
  kind: 'monsters',
  name,
  position: offsetToHex(col, row),
  encounter,
  threat: threatAt(offsetToHex(col, row)),
  loot,
})

/** A new world, the blight seeded from its sources; `seed` is the world RNG's, which only spawns draw from. */
export function newWorld(seed: number = randomSeed()): WorldState {
  const world: WorldState = {
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
      monsters('goblin_raiders', 'Goblin Raiders', 13, 18, 'goblin_raid', [RING_PROTECTION]),
      monsters('kobold_scouts', 'Kobold Scouts', 16, 21, 'kobold_scouts', [AMULET_FOCUS]),

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
      monsters('goblin_reavers', 'Goblin Reavers', 12, 8, 'goblin_raid', [RING_FORTUNE]),
      monsters('kobold_trappers', 'Kobold Trappers', 8, 30, 'kobold_scouts', [SAGE_CIRCLET]),
      monsters('goblin_warband', 'Goblin Warband', 24, 10, 'goblin_raid', [RING_PROTECTION]),
      monsters('kobold_diggers', 'Kobold Diggers', 22, 25, 'kobold_scouts', [SPARK_WAND]),
      monsters('kobold_skulkers', 'Kobold Skulkers', 30, 22, 'kobold_scouts', [SHADOW_CLOAK]),
      monsters('goblin_marauders', 'Goblin Marauders', 34, 17, 'goblin_raid', [EMBERBLADE]),
      monsters('kobold_lurkers', 'Kobold Lurkers', 39, 31, 'kobold_scouts', [HAWK_BOW]),
      monsters('goblin_outriders', 'Goblin Outriders', 47, 13, 'goblin_raid', [STORM_WAND]),
      monsters('kobold_tunnellers', 'Kobold Tunnellers', 54, 28, 'kobold_scouts', [SAGE_CIRCLET]),
      monsters('goblin_pillagers', 'Goblin Pillagers', 57, 10, 'goblin_raid', [EMBERBLADE]),
      { ...(monsters(SOURCE_ID, 'The Blight Source', 58, 19, 'source_guardians', [STORM_WAND]) as MonsterLocation), source: true },
    ],
    confronting: null,
    blight: [],
    shift: [],
    seen: [],
    sighted: [],
    spawnPressure: 0,
    spawns: 0,
    rng: seed | 0,
    held: [ENCAMPMENT_ID],
    threatened: [],
    guildHall: 1,
    towers: [],
    towersBuilt: 0,
    shrine: 0,
    outposts: [],
    stock: {},
    status: 'playing',
  }
  seedBlight(world)
  world.held = initialHeld(world)
  // The sites taken at the start push back from the start.
  seedBlight(world)
  seedSight(world)
  return world
}

/** Whether the game goes on: not lost, and not waiting on the player's choice after the Source. */
export function worldActive(world: WorldState): boolean {
  return world.status === 'playing' || world.status === 'endless'
}

/**
 * Passes one world turn: the turn count, the blight's day, the territory's
 * and what comes into sight, and returns what happened. Every way of spending
 * time comes through here.
 */
export function passTurn(world: WorldState, party: readonly { level: number }[]): WorldEvent[] {
  world.turn += 1
  return [...advanceDay(world, party), ...updateTerritory(world, party), ...updateSight(world)]
}

/**
 * Whether an event stops a journey or a stretch of camping: monsters sighted
 * near the party, a held site threatened or lost, the encampment lost. A
 * spawn is not seen as such: it is told when it comes into sight. A tower
 * under threat is told as a site is.
 */
export function isNotable(world: WorldState, event: WorldEvent): boolean {
  switch (event.type) {
    case 'sighted':
      return hexDistance(world.party, event.at) <= NOTICE_RADIUS
    case 'site_threatened':
    case 'site_lost':
    case 'tower_lost':
    case 'encampment_lost':
      return true
    default:
      return false
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
 * clear of every monster location the player knows of (`sighted`) except one
 * it ends on, and is planned through the unexplored as through open land.
 */
export function routeTo(world: WorldState, to: Hex): Hex[] | null {
  const board = new HexBoard(world.board)
  if (world.confronting !== null || !board.contains(to)) return null
  const known = new Set(
    world.locations
      .filter((l) => l.kind === 'monsters' && world.sighted.includes(l.id))
      .map((l) => hexKey(l.position)),
  )
  const passable = (h: Hex) => board.contains(h) && (hexEquals(h, to) || !known.has(hexKey(h)))
  return reachableHexes(world.party, board.hexes.length, passable).get(hexKey(to)) ?? null
}

/** What came of a journey: the hexes walked, what happened on the way, and the event that cut it short if one did. */
export interface Journey {
  walked: Hex[]
  events: WorldEvent[]
  interruptedBy: WorldEvent | null
}

/**
 * Walks the party toward `to` a hex and a turn at a time, and stops early on
 * a notable event (`isNotable`) or where monsters stand on the road: sighted
 * since the route was planned, as they are long before the party reaches them.
 * Walks nowhere if there is no route. Arriving among monsters confronts the
 * party with them.
 */
export function travel(world: WorldState, to: Hex, party: readonly { level: number }[]): Journey {
  const journey: Journey = { walked: [], events: [], interruptedBy: null }
  const route = worldActive(world) ? routeTo(world, to) : null
  if (!route) return journey
  for (const h of route) {
    // A nest spawned on the road since the route was planned.
    if (!hexEquals(h, to) && locationAt(world, h)?.kind === 'monsters') break
    world.party = h
    journey.walked.push(h)
    const day = passTurn(world, party)
    journey.events.push(...day)
    journey.interruptedBy = day.find((event) => isNotable(world, event)) ?? null
    if (journey.interruptedBy || !worldActive(world)) break
  }
  world.confronting = monstersHere(world)?.id ?? null
  return journey
}

/**
 * Spends a turn scouting or waiting at the monsters the party stands among,
 * which frees it to travel on. Neither does more yet: scouting learns nothing
 * and the monsters never answer. Returns false when there are no monsters here.
 */
export function linger(world: WorldState, _how: Lingering, party: readonly { level: number }[]): WorldEvent[] | null {
  if (!monstersHere(world) || !worldActive(world)) return null
  world.confronting = null
  return passTurn(world, party)
}

/**
 * Takes a location off the map, as when its monsters are beaten, and cleanses
 * the land around it (`cleanse`). Beating the Source wins the game.
 */
export function clearLocation(world: WorldState, id: string): void {
  const location = world.locations.find((l) => l.id === id)
  world.locations = world.locations.filter((l) => l.id !== id)
  world.sighted = world.sighted.filter((sighted) => sighted !== id)
  if (world.confronting === id) world.confronting = null
  if (location?.kind !== 'monsters') return
  cleanse(world, location.position, location.threat)
  // The party sees the land it has just cleansed.
  updateSight(world)
  if (location.source && world.status === 'playing') world.status = 'won'
}
