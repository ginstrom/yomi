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
import { act, advance, setOrder, startTravel, worldInterrupt, type DayReport, type OrderRequest } from './company.ts'
import { MAX_THREAT, type EncounterId } from './encounters.ts'
import { presences, type Expedition, type PartyPresence } from './expedition.ts'
import type { GameState } from './gameState.ts'
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

/**
 * The encampment, the party's home and the only settlement, named by the
 * player; and resources, which the party holds while their land is clean
 * (territory.ts), as it holds the encampment.
 */
export interface QuietLocation extends LocationBase {
  kind: 'encampment' | 'resource'
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
  /** Counts from 1. */
  turn: number
  locations: WorldLocation[]
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
  /** The ids of the resources held, the encampment among them while the game lasts. */
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
  /** The trading post's level at the encampment, 1 to `MAX_TRADING_POST_LEVEL` (tradingPost.ts): the grades it sells. */
  tradingPost: number
  /** The workshop's level at the encampment, 0 (none) to `MAX_WORKSHOP_LEVEL` (crafting.ts): the modifiers and grades it makes. */
  workshop: number
  /** The infirmary's level at the encampment, 0 (none) to `MAX_INFIRMARY_LEVEL` (infirmary.ts): what a day's camping heals. */
  infirmary: number
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

/** Where a new game's party stands: the encampment, in the west. */
const HOME: Hex = offsetToHex(9, 19)
export const ENCAMPMENT_ID = 'encampment'
/** What the encampment is called unless the player names it otherwise. */
export const DEFAULT_ENCAMPMENT_NAME = 'Oakvale'
/** The longest name the encampment may have. */
export const MAX_ENCAMPMENT_NAME_LENGTH = 16
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

/**
 * A new world, the blight seeded from its sources; `seed` is the world RNG's,
 * which only spawns draw from, and `encampmentName` what the player called
 * home.
 */
export function newWorld(seed: number = randomSeed(), encampmentName: string = DEFAULT_ENCAMPMENT_NAME): WorldState {
  const world: WorldState = {
    board: WORLD_SIZE,
    turn: 1,
    // The party's home country first, in the west, then the lands further out,
    // whose monsters are the more dangerous the further they lie (threatAt).
    locations: [
      { id: ENCAMPMENT_ID, kind: 'encampment', name: encampmentName.trim() || DEFAULT_ENCAMPMENT_NAME, position: HOME },
      resource('iron_vein', 'Iron Vein', 11, 21),
      resource('gold_seam', 'Gold Seam', 15, 16),
      monsters('goblin_raiders', 'Goblin Raiders', 13, 18, 'goblin_raid', [RING_PROTECTION]),
      monsters('kobold_scouts', 'Kobold Scouts', 16, 21, 'kobold_scouts', [AMULET_FOCUS]),

      resource('timber_stand', 'Timber Stand', 4, 28),
      resource('peat_bog', 'Peat Bog', 21, 4),
      resource('silver_lode', 'Silver Lode', 27, 14),
      resource('old_quarry', 'Old Quarry', 36, 26),
      resource('salt_flats', 'Salt Flats', 33, 36),
      resource('copper_pit', 'Copper Pit', 41, 10),
      resource('crystal_cave', 'Crystal Cave', 56, 24),
      monsters('goblin_reavers', 'Goblin Reavers', 12, 8, 'goblin_raid', [RING_FORTUNE]),
      monsters('kobold_trappers', 'Kobold Trappers', 8, 30, 'kobold_scouts', [SAGE_CIRCLET]),
      monsters('hobgoblin_warband', 'Hobgoblin Warband', 24, 10, 'hobgoblin_warband', [RING_PROTECTION]),
      monsters('kobold_diggers', 'Kobold Diggers', 22, 25, 'kobold_scouts', [SPARK_WAND]),
      monsters('bandit_camp', 'Bandit Camp', 30, 22, 'bandit_camp', [SHADOW_CLOAK]),
      monsters('goblin_marauders', 'Goblin Marauders', 34, 17, 'goblin_raid', [EMBERBLADE]),
      monsters('troll_lair', 'Troll Lair', 39, 31, 'troll_lair', [HAWK_BOW]),
      monsters('bandit_hideout', 'Bandit Hideout', 47, 13, 'bandit_camp', [STORM_WAND]),
      monsters('salamander_pool', 'Salamander Pool', 54, 28, 'salamander_pool', [SAGE_CIRCLET]),
      monsters('spider_nest', 'Spider Nest', 57, 10, 'spider_nest', [EMBERBLADE]),
      { ...(monsters(SOURCE_ID, 'The Blight Source', 58, 19, 'source_guardians', [STORM_WAND]) as MonsterLocation), source: true },
    ],
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
    tradingPost: 1,
    workshop: 0,
    infirmary: 0,
    stock: {},
    status: 'playing',
  }
  seedBlight(world)
  world.held = initialHeld(world)
  // The sites taken at the start push back from the start.
  seedBlight(world)
  // Every new game's party starts at home.
  seedSight(world, [{ position: HOME, levels: [] }])
  return world
}

/** The encampment, which is on the map for as long as the game lasts. */
export function encampment(world: WorldState): QuietLocation {
  return world.locations.find((l): l is QuietLocation => l.id === ENCAMPMENT_ID)!
}

/** What the player called the encampment. */
export function encampmentName(world: WorldState): string {
  return encampment(world).name
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
export function passTurn(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[] {
  world.turn += 1
  return [...advanceDay(world, presences), ...updateTerritory(world, presences), ...updateSight(world, presences)]
}

/**
 * Whether an event stops a journey or a stretch of camping: monsters sighted
 * near a party (within `NOTICE_RADIUS` of some presence), the Source found wherever it is sighted, a held site
 * threatened or lost, the encampment lost. A
 * spawn is not seen as such: it is told when it comes into sight. A tower
 * under threat is told as a site is.
 */
export function isNotable(_world: WorldState, event: WorldEvent, presences: readonly PartyPresence[]): boolean {
  switch (event.type) {
    case 'sighted':
      return event.source === true || presences.some((p) => hexDistance(p.position, event.at) <= NOTICE_RADIUS)
    case 'site_threatened':
    case 'site_lost':
    case 'tower_lost':
    case 'encampment_lost':
      return true
    default:
      return false
  }
}

/** A location's name inside a sentence: a leading article lower-cased ("The Blight Source" reads "the Blight Source"). */
export function midSentence(name: string): string {
  return /^the /i.test(name) ? `the ${name.slice(4)}` : name
}

/** A location's name with "the" in front, unless it has its own article: "the Goblin Raiders", "the Blight Source". */
export function theName(name: string): string {
  return /^the /i.test(name) ? midSentence(name) : `the ${name}`
}

/** `theName` to begin a sentence: "The Goblin Raiders", "The Blight Source". */
export function theNameCapital(name: string): string {
  const named = theName(name)
  return named.charAt(0).toUpperCase() + named.slice(1)
}

export function locationAt(world: WorldState, at: Hex): WorldLocation | null {
  return world.locations.find((l) => hexEquals(l.position, at)) ?? null
}

/** The monster location the party stands on, if any: the one it may scout, wait at or attack. */
export function monstersHere(world: WorldState, party: Expedition): MonsterLocation | null {
  const here = locationAt(world, party.position)
  return here?.kind === 'monsters' ? here : null
}

/**
 * The hexes the party would walk to reach `to`, `to` included, or null when it
 * cannot go there: it is off the map or where the party already stands, or
 * monsters the party walked into still await its answer. The route keeps
 * clear of every monster location the player knows of (`sighted`) except one
 * it ends on, and is planned through the unexplored as through open land.
 */
export function routeTo(world: WorldState, party: Expedition, to: Hex): Hex[] | null {
  const board = new HexBoard(world.board)
  if (party.confronting !== null || !board.contains(to)) return null
  const known = new Set(
    world.locations
      .filter((l) => l.kind === 'monsters' && world.sighted.includes(l.id))
      .map((l) => hexKey(l.position)),
  )
  const passable = (h: Hex) => board.contains(h) && (hexEquals(h, to) || !known.has(hexKey(h)))
  return reachableHexes(party.position, board.hexes.length, passable).get(hexKey(to)) ?? null
}

/** What came of a journey: the hexes walked, what happened on the way, and the event that cut it short if one did. */
export interface Journey {
  walked: Hex[]
  events: WorldEvent[]
  interruptedBy: WorldEvent | null
}

/** A journey and every day's report of it, in order: what the rest of the company did meanwhile, and the interrupt (a party's own event included) that stopped it. */
export interface Walked {
  journey: Journey
  reports: DayReport[]
}

/**
 * Walks the party toward `to` a hex and a turn at a time, and stops early on
 * a notable event (`isNotable`) or where monsters stand on the road: sighted
 * since the route was planned, as they are long before the party reaches them.
 * Walks nowhere if there is no route. Arriving among monsters confronts the
 * party with them. It gives the party a travel order and runs the day loop
 * (company.ts) until something happens; cut short, the order stands.
 */
export function travel(game: GameState, party: Expedition, to: Hex): Journey {
  return walkTo(game, party, to).journey
}

/** `travel`, with the days' reports. */
export function walkTo(game: GameState, party: Expedition, to: Hex): Walked {
  // Refused, nothing changes; blocked at the first hex, startTravel has left the party idle, confronting what stands here.
  if (startTravel(game, party, to) !== 'started') return { journey: { walked: [], events: [], interruptedBy: null }, reports: [] }
  return walkOn(game, party, Infinity)
}

/**
 * Gives the party a walking order (home, or a meet) and runs the day loop
 * until something happens, or `limit` days pass, as `travel` does a travel
 * order. Returns the refusal (nothing changed), or the journey and its days.
 */
export function followOrder(game: GameState, party: Expedition, request: Extract<OrderRequest, { kind: 'home' | 'meet' }>, limit = Infinity): string | Walked {
  return setOrder(game, party.id, request) ?? walkOn(game, party, limit)
}

/** The day loop run for a party's walking order, gathered into a journey; it ends confronting whatever stands where it stopped. */
function walkOn(game: GameState, party: Expedition, limit: number): Walked {
  const reports = advance(game, limit)
  const journey: Journey = { walked: [], events: [], interruptedBy: null }
  for (const report of reports) {
    const walked = report.parties.find((day) => day.party === party.id)?.walked
    if (walked) journey.walked.push(walked)
    journey.events.push(...report.events)
    journey.interruptedBy = worldInterrupt(report)
  }
  party.confronting = monstersHere(game.world, party)?.id ?? null
  return { journey, reports }
}

/**
 * Spends a turn scouting or waiting at the monsters the party stands among,
 * which frees it to travel on: a one-day order on the day loop (`act`).
 * Neither does more yet: scouting learns nothing and the monsters never
 * answer. Returns the day's events, or null when there are no monsters here
 * or the game is over.
 */
export function linger(game: GameState, party: Expedition, how: Lingering): WorldEvent[] | null {
  const world = game.world
  if (!monstersHere(world, party) || !worldActive(world)) return null
  const report = act(game, party.id, { kind: how })
  return typeof report === 'string' ? null : report.events
}

/**
 * Takes a location off the map, as when its monsters are beaten, and cleanses
 * the land around it (`cleanse`). Beating the Source wins the game.
 */
export function clearLocation(game: GameState, id: string): void {
  const world = game.world
  const location = world.locations.find((l) => l.id === id)
  world.locations = world.locations.filter((l) => l.id !== id)
  world.sighted = world.sighted.filter((sighted) => sighted !== id)
  for (const party of game.parties) if (party.confronting === id) party.confronting = null
  if (location?.kind !== 'monsters') return
  cleanse(world, location.position, location.threat)
  // The parties see the land just cleansed.
  updateSight(world, presences(game.parties))
  if (location.source && world.status === 'playing') world.status = 'won'
}
