import { randomSeed } from '../combat/rng.ts'
import { HexBoard, hexAdd, hexDistance, hexEquals, hexKey, offsetToHex, shortestPath, type BoardSize, type Hex } from '../grid/hex.ts'
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
import type { EncounterId } from './encounters.ts'
import { presences, type Expedition, type PartyPresence } from './expedition.ts'
import type { GameState } from './gameState.ts'
import { initialHeld, updateTerritory, type ImprovementLevel, type Material, type Stock } from './territory.ts'
import type { TradeRoute } from './trade.ts'
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
  /** How dangerous they are, from 1: set by the ring of `THREAT_RINGS` they lie in (`threatAt`). */
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

/**
 * A trade partner (trade.ts): a neutral settlement, never held and never
 * lost, a clean source of `PARTNER_STRENGTH` (blight.ts) whatever its land.
 * The party contacts it by standing on it; it falls silent while its land is
 * at `LOSS_LEVEL` or worse, and its `good` is what it trades.
 */
export interface PartnerLocation extends LocationBase {
  kind: 'partner'
  good: Material
}

export type WorldLocation = MonsterLocation | QuietLocation | PartnerLocation

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
  /** Each improved held resource's level (buildings.ts: 1 an outpost, 2 works, 3 a fort), by its id, which adds to the site's strength and yield; deleted when the site is lost. */
  improvements: Record<string, ImprovementLevel>
  /** The Builders' Lodge's level at the encampment, 0 (none) to `MAX_LODGE_LEVEL` (buildings.ts): the improvement levels it allows. */
  lodge: number
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
  /** The ids of the trade partners contacted (trade.ts), in the order contacted; contact is permanent. */
  contacted: string[]
  /** The ids of the trade partners silent now: entered when the partner's hex reaches `LOSS_LEVEL`, left when it is clean. */
  silent: string[]
  /** The open trade routes, in the order opened (trade.ts). */
  routes: TradeRoute[]
  /** How many trade routes have ever been opened. */
  routesOpened: number
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
export const WORLD_SIZE: BoardSize = { cols: 140, rows: 72 }

/**
 * Stage 8's map (60 × 40) stands inside today's moved by this axial
 * translation, so every distance among its locations is kept (an odd-r board:
 * adding rows alone would not be a translation). A location on an odd stage-8
 * row keeps its column, one on an even row moves a column west; every row
 * gains 17.
 */
export const EARLY_SHIFT: Hex = { q: -9, r: 17 }

/** Where stage 8's offset (`col`, `row`) stands on today's board (`EARLY_SHIFT`). */
export function earlyHex(col: number, row: number): Hex {
  return hexAdd(offsetToHex(col, row), EARLY_SHIFT)
}

/** Where a new game's party stands: the encampment, in the west; offset (9, 36). */
const HOME: Hex = earlyHex(9, 19)
export const ENCAMPMENT_ID = 'encampment'
/** What the encampment is called unless the player names it otherwise. */
export const DEFAULT_ENCAMPMENT_NAME = 'Oakvale'
/** The longest name the encampment may have. */
export const MAX_ENCAMPMENT_NAME_LENGTH = 16
export const SOURCE_ID = 'blight_source'
/** The threat the Source is fought at once it stands in the far ring (long-campaign stage 9; the map places it there from step 04), and the threat of rune loot's Source row. */
export const SOURCE_THREAT = 20

/** Where the Source stands and the threat it is fought at. */
export interface SourcePlace {
  position: Hex
  threat: number
}
/** The Source's place on the map: in the far east, 122 hexes from home, in the last ring, fought at `SOURCE_THREAT`. */
export const SOURCE_PLACE: SourcePlace = { position: offsetToHex(131, 36), threat: SOURCE_THREAT }

/** How far from the party a spawn must be to stop it travelling or camping. */
export const NOTICE_RADIUS = 8

/**
 * The rings of threat around home: a hex up to `upTo` hexes from home (and
 * beyond the last ring's) has the first ring's threat that reaches it. The
 * home country's five rings are 11 hexes wide, as stage 8's bands were; the
 * outer rings are wider and step faster, out to the Source's at 122.
 */
export const THREAT_RINGS: readonly { upTo: number; threat: number }[] = [
  { upTo: 10, threat: 1 },
  { upTo: 21, threat: 2 },
  { upTo: 32, threat: 3 },
  { upTo: 43, threat: 4 },
  { upTo: 54, threat: 5 },
  { upTo: 67, threat: 7 },
  { upTo: 80, threat: 9 },
  { upTo: 94, threat: 12 },
  { upTo: 108, threat: 15 },
  { upTo: 122, threat: 18 },
]

/** How dangerous the monsters at `position` are: the threat of its ring of `THREAT_RINGS` by its distance from home, the last ring's beyond it. */
export function threatAt(position: Hex): number {
  const distance = hexDistance(HOME, position)
  return (THREAT_RINGS.find((ring) => distance <= ring.upTo) ?? THREAT_RINGS[THREAT_RINGS.length - 1]).threat
}

/** A resource at `position`. */
const resourceAt = (id: string, name: string, position: Hex): WorldLocation => ({ id, kind: 'resource', name, position })
/** A resource at stage 8's offset (`earlyHex`). */
const resource = (id: string, name: string, col: number, row: number): WorldLocation => resourceAt(id, name, earlyHex(col, row))
/** A resource of the outer rings, at today's offset. */
const farResource = (id: string, name: string, col: number, row: number): WorldLocation => resourceAt(id, name, offsetToHex(col, row))
/** Monsters at `position`, at the threat of its ring. */
const monstersAt = (id: string, name: string, position: Hex, encounter: EncounterId, loot: Item[]): WorldLocation => ({
  id,
  kind: 'monsters',
  name,
  position,
  encounter,
  threat: threatAt(position),
  loot,
})
/** Monsters at stage 8's offset (`earlyHex`), at the threat of their ring. */
const monsters = (id: string, name: string, col: number, row: number, encounter: EncounterId, loot: Item[]): WorldLocation =>
  monstersAt(id, name, earlyHex(col, row), encounter, loot)
/** Monsters of the outer rings, at today's offset, at the threat of their ring. */
const farMonsters = (id: string, name: string, col: number, row: number, encounter: EncounterId, loot: Item[]): WorldLocation =>
  monstersAt(id, name, offsetToHex(col, row), encounter, loot)

/**
 * The trade partners: Millbrook in the threat 2 ring and Saltmere in the
 * threat 3 ring, each at stage 8's place (`earlyHex`); then the far partners
 * (stage 9), Stonehollow, a mountain hold in the threat 7 ring, Elder Glade, a
 * forest people in the threat 12 ring, and Emberwatch, a fortified pass in the
 * threat 15 ring. A world holds copies (`newWorld`).
 */
export const PARTNERS: readonly PartnerLocation[] = [
  { id: 'millbrook', kind: 'partner', name: 'Millbrook', position: earlyHex(18, 30), good: 'timber' },
  { id: 'saltmere', kind: 'partner', name: 'Saltmere', position: earlyHex(30, 38), good: 'salt' },
  { id: 'stonehollow', kind: 'partner', name: 'Stonehollow', position: offsetToHex(58, 13), good: 'mithril' },
  { id: 'elder_glade', kind: 'partner', name: 'Elder Glade', position: offsetToHex(85, 60), good: 'elderwood' },
  { id: 'emberwatch', kind: 'partner', name: 'Emberwatch', position: offsetToHex(97, 13), good: 'adamant' },
]

/**
 * A new world, the blight seeded from its sources; `seed` is the world RNG's,
 * which only spawns draw from, and `encampmentName` what the player called
 * home. `partners` are placed as copies after the resources and before the
 * monsters (tests may pass none). `source` is where the Source stands and its
 * threat (the simulator's `--near-source` passes its own).
 */
export function newWorld(
  seed: number = randomSeed(),
  encampmentName: string = DEFAULT_ENCAMPMENT_NAME,
  partners: readonly PartnerLocation[] = PARTNERS,
  source: SourcePlace = SOURCE_PLACE,
): WorldState {
  const world: WorldState = {
    board: WORLD_SIZE,
    turn: 1,
    // The party's home country first, in the west, then the lands further out,
    // whose monsters are the more dangerous the further they lie (threatAt).
    // The home country's stand at their stage-8 offsets, moved by EARLY_SHIFT
    // (earlyHex); the outer rings' (stage 9) at today's offsets, ring by ring,
    // their nests spread north, east and south; the Source last, at `source`.
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
      farResource('ironwood_grove', 'Ironwood Grove', 65, 44),
      farResource('mithril_lode', 'Mithril Lode', 70, 10),
      farResource('elder_grove', 'Elder Grove', 70, 62),
      farResource('adamant_deep', 'Adamant Deep', 93, 28),
      farResource('wyrmwood_thicket', 'Wyrmwood Thicket', 107, 44),
      farResource('fallen_star', 'Fallen Star', 122, 30),
      farResource('heartwood', 'The Heartwood', 114, 58),
      ...partners.map((p) => ({ ...p, position: { ...p.position } })),
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
      // Threat 7 (55 to 67 hexes out).
      farMonsters('wildland_bandits', 'Wildland Bandits', 55, 6, 'bandit_camp', [RING_FORTUNE]),
      farMonsters('webwood_nest', 'Webwood Nest', 62, 20, 'spider_nest', [SHADOW_CLOAK]),
      farMonsters('ashen_pool', 'Ashen Pool', 70, 36, 'salamander_pool', [SPARK_WAND]),
      farMonsters('moorland_bandits', 'Moorland Bandits', 62, 52, 'bandit_camp', [AMULET_FOCUS]),
      farMonsters('hollow_spiders', 'Hollow Spiders', 55, 67, 'spider_nest', [HAWK_BOW]),
      // Threat 9 (68 to 80).
      farMonsters('ironhold_company', 'Ironhold Company', 67, 4, 'bandit_company', [RING_PROTECTION]),
      farMonsters('cinder_springs', 'Cinder Springs', 74, 18, 'salamander_pool', [EMBERBLADE]),
      farMonsters('deepweb_hollow', 'Deepweb Hollow', 83, 36, 'spider_nest', [SAGE_CIRCLET]),
      farMonsters('grey_company', 'Grey Company', 74, 54, 'bandit_company', [STORM_WAND]),
      farMonsters('smoking_mere', 'Smoking Mere', 66, 69, 'salamander_pool', [RING_FORTUNE]),
      // Threat 12 (81 to 94).
      farMonsters('ravenhill_company', 'Ravenhill Company', 80, 5, 'bandit_company', [SHADOW_CLOAK]),
      farMonsters('stonegate_company', 'Stonegate Company', 88, 20, 'bandit_company', [HAWK_BOW]),
      farMonsters('thornwall_company', 'Thornwall Company', 96, 36, 'bandit_company', [AMULET_FOCUS]),
      farMonsters('marsh_company', 'Marsh Company', 88, 52, 'bandit_company', [EMBERBLADE]),
      farMonsters('dustroad_company', 'Dustroad Company', 80, 67, 'bandit_company', [SPARK_WAND]),
      // Threat 15 (95 to 108).
      farMonsters('red_freebooters', 'The Red Freebooters', 95, 6, 'freebooter_host', [STORM_WAND]),
      farMonsters('grey_freebooters', 'The Grey Freebooters', 102, 20, 'freebooter_host', [RING_PROTECTION]),
      farMonsters('wolfhead_host', 'Wolfhead Host', 110, 36, 'freebooter_host', [SAGE_CIRCLET]),
      farMonsters('saltwind_host', 'Saltwind Host', 102, 52, 'freebooter_host', [HAWK_BOW]),
      farMonsters('black_banner_host', 'Black Banner Host', 95, 66, 'freebooter_host', [SHADOW_CLOAK]),
      // Threat 18 (109 to 122), about the Source.
      farMonsters('iron_freebooters', 'The Iron Freebooters', 110, 8, 'freebooter_host', [EMBERBLADE]),
      farMonsters('ashen_host', 'The Ashen Host', 117, 22, 'freebooter_host', [STORM_WAND]),
      farMonsters('last_host', 'The Last Host', 117, 50, 'freebooter_host', [RING_FORTUNE]),
      farMonsters('blightmarch_freebooters', 'Blightmarch Freebooters', 110, 64, 'freebooter_host', [AMULET_FOCUS]),
      {
        ...(monsters(SOURCE_ID, 'The Blight Source', 58, 19, 'source_guardians', [STORM_WAND]) as MonsterLocation),
        position: { ...source.position },
        threat: source.threat,
        source: true,
      },
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
    improvements: {},
    lodge: 0,
    tradingPost: 1,
    workshop: 0,
    infirmary: 0,
    stock: {},
    contacted: [],
    silent: [],
    routes: [],
    routesOpened: 0,
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
 * threatened or lost, the encampment lost, a trade partner fallen silent. A
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
    case 'partner_silent':
    case 'route_abandoned':
      return true
    case 'route_raided':
      // Told once, the day the road turns raided (`days` 0); the yield days' counts are not (economy R9).
      return event.days === 0
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
  return shortestPath(party.position, to, passable)
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
