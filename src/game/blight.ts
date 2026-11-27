import { mulberry32 } from '../combat/rng.ts'
import { HexBoard, hexDistance, hexNeighbors, hexToOffset, offsetToHex, type BoardSize, type Hex } from '../grid/hex.ts'
import { MAGIC_ITEMS, type Item } from '../inventory/inventory.ts'
import { ENCOUNTER_BANDS, type EncounterId } from './encounters.ts'
import { ROAD_LODGE_LEVEL } from './buildings.ts'
import type { PartyPresence } from './expedition.ts'
import type { ImprovementLevel, Material, YieldSource } from './territory.ts'
import type { RaidCause } from './trade.ts'
import { ENCAMPMENT_ID, threatAt, type MonsterLocation, type WorldState } from './worldMap.ts'

/**
 * The blight (docs/designs/blight.md): every hex of the world map has a level
 * from 0 (clean) to 3 (corrupted), and each day blight and clean influence
 * contend for it. Monster locations, the Source and corrupted land push the
 * blight; the encampment (with its shrine), held sites (with their improvements),
 * trade partners, watchtowers, open trade routes' roads (at Lodge 3) and every party push back. A hex's `shift`
 * counter moves by the difference each day, and a level goes up or down when
 * it reaches `SHIFT_COST` either way. Corrupted land spawns new monster
 * locations. Phaser-free; worldMap.ts calls `advanceDay` once a world turn.
 *
 * This module imports worldMap.ts and worldMap.ts imports it, which is safe
 * while neither calls the other as its module loads; buildings.ts too, for
 * `ROAD_LODGE_LEVEL`, read only inside `sources`.
 */

export const MAX_BLIGHT = 3
export const BLIGHT_NAMES = ['clean', 'tainted', 'blighted', 'corrupted'] as const

/** A monster location pushes with this times its threat, up to `BLIGHT_THREAT_CAP`... */
export const BLIGHT_PER_THREAT = 2
/** The threat above which a nest pushes no harder: the outer rings' nests push as a threat-5 nest does. */
export const BLIGHT_THREAT_CAP = 5
/** ...and the Source with this. */
export const SOURCE_STRENGTH = 20
/** What each corrupted neighbour adds to a hex's blight. */
export const CREEP = 1
/** The clean side: the encampment, a held resource. */
export const CAMP_STRENGTH = 8
export const SITE_STRENGTH = 3
/** A watchtower (buildings.ts), a little stronger than a resource. */
export const TOWER_STRENGTH = 4
/** A trade partner (trade.ts), silent or not: never held, never lost, and always pushing back. */
export const PARTNER_STRENGTH = 3
/** Each hex of an open trade route's road (trade.ts), from the Builders' Lodge's level `ROAD_LODGE_LEVEL`: weak, so it reaches only its own hex. */
export const ROAD_STRENGTH = 1
/** What each level of the encampment's shrine adds to its strength (buildings.ts). */
export const SHRINE_STRENGTH = 3
/** What a held resource's improvement (buildings.ts) adds to its strength, by level 0 to 3: an outpost and works 3, a fort 7. */
export const IMPROVEMENT_STRENGTH: readonly number[] = [0, 3, 3, 7]
/** A party pushes with this plus half the sum of its members' levels. */
export const PARTY_BASE = 2
/** How far a hex's shift counter must go, either way, to move its level by one. */
export const SHIFT_COST = 60

/** The blight's strength rises by this share every `GROWTH_DAYS`, up to `MAX_BLIGHT_GROWTH`. */
export const BLIGHT_GROWTH = 0.1
export const GROWTH_DAYS = 30
export const MAX_BLIGHT_GROWTH = 0.5

/** Each day spawn pressure grows by the corrupted hexes over this, times the growth: 200 × (140 × 72) / (60 × 40), stage 8's pressure per hex on today's board... */
export const SPAWN_DIVISOR = 840
/** ...and a monster location appears when it reaches this. */
export const SPAWN_COST = 30
/** A spawn keeps this many hexes from every party, other monster locations, held sites and watchtowers. */
export const SPAWN_CLEARANCE = 4
/** No spawn while this many monster locations stand on the map. */
export const MAX_MONSTER_LOCATIONS = 60
/** The chance a spawned location guards an item. */
export const SPAWN_LOOT_CHANCE = 0.5

/** A won battle lowers the blight by this many levels within `1 + threat` hexes of it. */
export const CLEANSE_LEVELS = 2

/** At the start, every hex is this much more blighted than its influence makes it: the land is already tainted. */
const INITIAL_TAINT = 1
/** The net influence at the start that makes a hex blighted, and corrupted. */
const INITIAL_BLIGHTED = 5
const INITIAL_CORRUPTED = 9

/** What happened on the world map in a turn. Only some are notable enough to stop a journey or a camp (`isNotable` in worldMap.ts). */
export type WorldEvent =
  | { type: 'level_changed'; at: Hex; from: number; to: number }
  | { type: 'spawned'; location: string; name: string; at: Hex; threat: number }
  | { type: 'sighted'; location: string; name: string; at: Hex; threat: number; source?: true }
  | { type: 'site_threatened'; site: string; name: string; days: number }
  | { type: 'site_captured'; site: string; name: string }
  /** `improvement`: the level razed with the site, if it had one. */
  | { type: 'site_lost'; site: string; name: string; improvement?: ImprovementLevel }
  | { type: 'tower_built'; tower: string; at: Hex }
  | { type: 'tower_lost'; tower: string; at: Hex }
  /** `building`: the level's name ("Outpost", "Mine", "Fort", …). */
  | { type: 'site_improved'; site: string; name: string; level: ImprovementLevel; building: string }
  /** `route`: the route's id, for a route's yield (`source: 'route'`, `site` the partner). */
  | { type: 'yield'; site: string; name: string; material: Material; amount: number; source?: YieldSource; route?: string }
  | { type: 'encampment_lost'; name: string }
  /** `home`: the encampment's name. */
  | { type: 'partner_contacted'; partner: string; name: string; home: string }
  | { type: 'partner_silent'; partner: string; name: string }
  | { type: 'partner_restored'; partner: string; name: string }
  /** `name`: the partner's; `length`: the road's hexes. */
  | { type: 'route_opened'; route: string; partner: string; name: string; length: number }
  /** `days`: raided yield days in a row, 1 on the first; `raider`, `raiderName`: the nearest nest, for 'raiders'. */
  | { type: 'route_raided'; route: string; partner: string; name: string; cause: RaidCause; raider?: string; raiderName?: string; days: number }
  | { type: 'route_restored'; route: string; partner: string; name: string }
  | { type: 'route_abandoned'; route: string; partner: string; name: string }

/** Where a hex's level and shift counter are kept in `WorldState.blight` and `.shift`. */
export function boardIndex(board: BoardSize, h: Hex): number {
  const { col, row } = hexToOffset(h)
  return row * board.cols + col
}

export function boardHex(board: BoardSize, index: number): Hex {
  return offsetToHex(index % board.cols, Math.floor(index / board.cols))
}

/** The hex's blight level, 0 off the map. */
export function blightAt(world: WorldState, h: Hex): number {
  const { col, row } = hexToOffset(h)
  if (col < 0 || row < 0 || col >= world.board.cols || row >= world.board.rows) return 0
  return world.blight[row * world.board.cols + col]
}

/** How much stronger the blight is on `turn`: 1, and `BLIGHT_GROWTH` more every `GROWTH_DAYS`, up to 1 + `MAX_BLIGHT_GROWTH`. */
export function blightGrowth(turn: number): number {
  return 1 + Math.min(MAX_BLIGHT_GROWTH, BLIGHT_GROWTH * Math.floor((turn - 1) / GROWTH_DAYS))
}

/** How hard a party pushes: `PARTY_BASE` plus half its members' levels together. Gear and perks do not count. */
export function partyStrength(levels: readonly number[]): number {
  return PARTY_BASE + Math.floor(levels.reduce((sum, level) => sum + level, 0) / 2)
}

export function monsterStrength(location: MonsterLocation): number {
  return location.source ? SOURCE_STRENGTH : BLIGHT_PER_THREAT * Math.min(location.threat, BLIGHT_THREAT_CAP)
}

/** What a held site pushes with: the encampment with its shrine, a resource with its improvement. */
export function siteStrength(world: WorldState, id: string): number {
  if (id === ENCAMPMENT_ID) return CAMP_STRENGTH + SHRINE_STRENGTH * world.shrine
  return SITE_STRENGTH + IMPROVEMENT_STRENGTH[world.improvements[id] ?? 0]
}

// ---- the board's geometry and the fixed sources' fields, worked out once ----

interface Geometry {
  hexes: readonly Hex[]
  neighbours: readonly number[][]
}

const geometries = new Map<string, Geometry>()

function geometry(board: BoardSize): Geometry {
  const key = `${board.cols}x${board.rows}`
  let found = geometries.get(key)
  if (!found) {
    const grid = new HexBoard(board)
    const hexes = grid.hexes.map((_, i) => boardHex(board, i))
    const neighbours = hexes.map((h) => hexNeighbors(h).filter((n) => grid.contains(n)).map((n) => boardIndex(board, n)))
    found = { hexes, neighbours }
    geometries.set(key, found)
  }
  return found
}

/** The influence of everything but the parties and creeping corruption, at every hex: what changes only when a location or a held site does. */
interface Fields {
  /** The sources they were worked out from: the memo holds while these are unchanged. */
  sources: Sources
  /** Before growth. */
  blight: Float64Array
  clean: Float64Array
}

/** A memo, not state: a world's fields are worked out again whenever its sources change. */
const fieldMemo = new WeakMap<WorldState, Fields>()

type Sources = { blight: Array<[Hex, number]>; clean: Array<[Hex, number]> }

function sources(world: WorldState): Sources {
  const blight: Array<[Hex, number]> = []
  const clean: Array<[Hex, number]> = []
  for (const location of world.locations) {
    if (location.kind === 'monsters') blight.push([location.position, monsterStrength(location)])
    else if (location.kind === 'partner') clean.push([location.position, PARTNER_STRENGTH])
    else if (world.held.includes(location.id)) clean.push([location.position, siteStrength(world, location.id)])
  }
  for (const tower of world.towers) clean.push([tower.position, TOWER_STRENGTH])
  if (world.lodge >= ROAD_LODGE_LEVEL) for (const route of world.routes) for (const hex of route.road) clean.push([hex, ROAD_STRENGTH])
  return { blight, clean }
}

function addSource(field: Float64Array, hexes: readonly Hex[], at: Hex, strength: number): void {
  for (let i = 0; i < hexes.length; i++) {
    const push = strength - hexDistance(at, hexes[i])
    if (push > 0) field[i] += push
  }
}

const sameList = (a: ReadonlyArray<[Hex, number]>, b: ReadonlyArray<[Hex, number]>): boolean =>
  a.length === b.length && a.every(([h, strength], i) => h.q === b[i][0].q && h.r === b[i][0].r && strength === b[i][1])

function fields(world: WorldState): Fields {
  const { blight, clean } = sources(world)
  const memo = fieldMemo.get(world)
  if (memo && sameList(memo.sources.blight, blight) && sameList(memo.sources.clean, clean)) return memo
  const { hexes } = geometry(world.board)
  // Copies, not the world's own hexes, so a position changed in place still misses the memo.
  const copy = (list: Array<[Hex, number]>): Array<[Hex, number]> => list.map(([h, strength]) => [{ q: h.q, r: h.r }, strength])
  const made: Fields = { sources: { blight: copy(blight), clean: copy(clean) }, blight: new Float64Array(hexes.length), clean: new Float64Array(hexes.length) }
  for (const [at, strength] of blight) addSource(made.blight, hexes, at, strength)
  for (const [at, strength] of clean) addSource(made.clean, hexes, at, strength)
  fieldMemo.set(world, made)
  return made
}

/** 1 at the board index of each hex monsters stand on: they are pinned at blighted or worse, and influence cannot lower them. */
function monsterHexes(world: WorldState): Uint8Array {
  const pinned = new Uint8Array(world.board.cols * world.board.rows)
  for (const l of world.locations) if (l.kind === 'monsters') pinned[boardIndex(world.board, l.position)] = 1
  return pinned
}

/** 1 at the board index of each hex a party stands on, which is neutral ground. */
function neutralHexes(world: WorldState, presences: readonly PartyPresence[]): Uint8Array {
  const neutral = new Uint8Array(world.board.cols * world.board.rows)
  for (const p of presences) neutral[boardIndex(world.board, p.position)] = 1
  return neutral
}

/** What a day's contest reads at every hex, worked out once a day. */
interface Day {
  geometry: Geometry
  field: Fields
  presences: readonly PartyPresence[]
  /** `partyStrength` of each presence, in list order. */
  strengths: readonly number[]
  neutral: Uint8Array
  growth: number
}

function dayOf(world: WorldState, presences: readonly PartyPresence[]): Day {
  return {
    geometry: geometry(world.board),
    field: fields(world),
    presences,
    strengths: presences.map((p) => partyStrength(p.levels)),
    neutral: neutralHexes(world, presences),
    growth: blightGrowth(world.turn),
  }
}

/**
 * The day's net influence at hex `i`, blight less clean, as `advanceDay` works
 * it out from the levels `levels` (the day before's). Each party adds its
 * reach to the clean side, in list order. A party's own hex is neutral
 * (`neutral`), so no blight rises on it and none creeps from it, though the
 * parties' influence still lowers it.
 */
function netAt(day: Day, i: number, levels: readonly number[]): number {
  const { hexes, neighbours } = day.geometry
  const { field, presences, strengths, neutral } = day
  let clean = field.clean[i]
  for (let p = 0; p < presences.length; p++) clean += Math.max(0, strengths[p] - hexDistance(presences[p].position, hexes[i]))
  if (neutral[i]) return -clean
  let creep = 0
  for (const n of neighbours[i]) if (levels[n] >= MAX_BLIGHT && !neutral[n]) creep += CREEP
  return (field.blight[i] + creep) * day.growth - clean
}

/** Today's net influence at `h`, blight less clean: above 0 the blight is gaining there. */
export function netInfluence(world: WorldState, presences: readonly PartyPresence[], h: Hex): number {
  const i = boardIndex(world.board, h)
  return netAt(dayOf(world, presences), i, world.blight)
}

/** The levels a new world starts with: what its sources make of land already tainted. Monsters' hexes are at least blighted. */
export function seedBlight(world: WorldState): void {
  const field = fields(world)
  const { hexes } = geometry(world.board)
  const pinned = monsterHexes(world)
  world.blight = hexes.map((_, i) => {
    const net = INITIAL_TAINT + field.blight[i] - field.clean[i]
    const level = net >= INITIAL_CORRUPTED ? 3 : net >= INITIAL_BLIGHTED ? 2 : net >= 1 ? 1 : 0
    return pinned[i] ? Math.max(2, level) : level
  })
  world.shift = hexes.map(() => 0)
}

/**
 * The blight's day: every hex's shift counter moves by its net influence and
 * its level with it, then spawn pressure grows with the corrupted land and may
 * spawn a monster location. Called by `passTurn` after the turn is counted.
 */
export function advanceDay(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[] {
  const events: WorldEvent[] = []
  const day = dayOf(world, presences)
  const { hexes } = day.geometry
  const pinned = monsterHexes(world)
  const before = world.blight.slice()
  for (let i = 0; i < hexes.length; i++) {
    if (pinned[i]) {
      world.blight[i] = Math.max(2, before[i])
      world.shift[i] = 0
      continue
    }
    let shift = world.shift[i] + netAt(day, i, before)
    let level = before[i]
    if (shift >= SHIFT_COST) {
      shift = 0
      if (level < MAX_BLIGHT) level++
    } else if (shift <= -SHIFT_COST) {
      shift = 0
      if (level > 0) level--
    }
    // A counter does not bank what its level cannot use.
    if ((level === MAX_BLIGHT && shift > 0) || (level === 0 && shift < 0)) shift = 0
    world.shift[i] = shift
    if (level !== before[i]) {
      world.blight[i] = level
      events.push({ type: 'level_changed', at: hexes[i], from: before[i], to: level })
    }
  }
  const spawned = spawn(world, presences, pinned, day.neutral)
  if (spawned) events.push(spawned)
  return events
}

/**
 * What corrupted land spawns: a nest that fights one of these encounters, by
 * its name, where the encounter's band holds the threat and the threat is
 * `fromThreat` or more (the outer rings' kinds, from 7, so the home rings
 * spawn as they did before stage 9). New kinds go after these, keeping the
 * draws of the threats they do not reach.
 */
export const SPAWN_KINDS: ReadonlyArray<{ encounter: EncounterId; name: string; fromThreat?: number }> = [
  { encounter: 'goblin_raid', name: 'Goblin Brood' },
  { encounter: 'kobold_scouts', name: 'Kobold Nest' },
  { encounter: 'bandit_camp', name: 'Bandit Gang' },
  { encounter: 'spider_nest', name: 'Spider Brood', fromThreat: 7 },
  { encounter: 'salamander_pool', name: 'Salamander Spring', fromThreat: 7 },
  { encounter: 'bandit_company', name: 'Bandit Troop', fromThreat: 7 },
  { encounter: 'freebooter_host', name: 'Freebooter Band', fromThreat: 7 },
  { encounter: 'wolf_pack', name: 'Wolf Pack', fromThreat: 7 },
  { encounter: 'worg_riders', name: 'Worg Band', fromThreat: 7 },
  { encounter: 'ogre_camp', name: 'Ogre Camp', fromThreat: 7 },
  { encounter: 'wyvern_roost', name: 'Wyvern Roost', fromThreat: 7 },
  { encounter: 'barrow_wights', name: 'Barrow', fromThreat: 7 },
  { encounter: 'basilisk_lair', name: 'Basilisk Lair', fromThreat: 7 },
  { encounter: 'hill_giant_steading', name: 'Giant Steading', fromThreat: 7 },
  { encounter: 'golem_ruin', name: 'Golem Ruin', fromThreat: 7 },
  { encounter: 'blight_cult', name: 'Blight Cult', fromThreat: 7 },
  { encounter: 'young_dragon', name: 'Dragon Lair', fromThreat: 7 },
  { encounter: 'blight_lich_court', name: 'Lich Court', fromThreat: 7 },
  { encounter: 'elder_wyrm', name: 'Wyrm Lair', fromThreat: 7 },
]

function spawn(
  world: WorldState,
  presences: readonly PartyPresence[],
  pinned: Uint8Array,
  neutral: Uint8Array,
): WorldEvent | null {
  const { hexes } = geometry(world.board)
  const corrupted: number[] = []
  for (let i = 0; i < hexes.length; i++) if (world.blight[i] >= MAX_BLIGHT && !pinned[i] && !neutral[i]) corrupted.push(i)
  world.spawnPressure += (corrupted.length / SPAWN_DIVISOR) * blightGrowth(world.turn)
  if (world.spawnPressure < SPAWN_COST) return null
  // Pressure waits, but no more than one spawn's worth, for room on the map.
  world.spawnPressure = SPAWN_COST
  if (world.locations.filter((l) => l.kind === 'monsters').length >= MAX_MONSTER_LOCATIONS) return null
  const keepClear = [
    ...presences.map((p) => p.position),
    ...world.locations.filter((l) => l.kind === 'monsters' || world.held.includes(l.id)).map((l) => l.position),
    ...world.towers.map((tower) => tower.position),
  ]
  const occupied = new Set(world.locations.map((l) => boardIndex(world.board, l.position)))
  const candidates = corrupted.filter(
    (i) => !occupied.has(i) && keepClear.every((h) => hexDistance(h, hexes[i]) >= SPAWN_CLEARANCE),
  )
  if (candidates.length === 0) return null

  const rng = mulberry32(world.rng)
  const at = hexes[candidates[Math.floor(rng() * candidates.length)]]
  // By distance, never by the blight or the date: home's nests stay ones a weak party can beat.
  const threat = threatAt(at)
  const eligible = SPAWN_KINDS.filter(
    (k) => threat >= (k.fromThreat ?? 1) && threat >= ENCOUNTER_BANDS[k.encounter].min && threat <= ENCOUNTER_BANDS[k.encounter].max,
  )
  // No kind for this threat: no spawn, the world RNG left as it was and the pressure kept for another day.
  // Unreachable on today's map, as every threat of THREAT_RINGS has a kind (blight.test.ts checks it); a guard for a ring added without one.
  if (eligible.length === 0) return null
  const kind = eligible[Math.floor(rng() * eligible.length)]
  const loot: Item[] = rng() < SPAWN_LOOT_CHANCE ? [MAGIC_ITEMS[Math.floor(rng() * MAGIC_ITEMS.length)]] : []
  world.rng = rng.state()
  world.spawnPressure -= SPAWN_COST
  world.spawns += 1
  const location: MonsterLocation = {
    id: `spawn_${world.spawns}`,
    kind: 'monsters',
    name: kind.name,
    position: at,
    encounter: kind.encounter,
    threat,
    loot,
  }
  world.locations.push(location)
  world.blight[boardIndex(world.board, at)] = MAX_BLIGHT
  return { type: 'spawned', location: location.id, name: location.name, at, threat: location.threat }
}

/** A won battle at `at`: the blight within `1 + threat` hexes drops `CLEANSE_LEVELS` levels and its counters start over. */
export function cleanse(world: WorldState, at: Hex, threat: number): void {
  const { hexes } = geometry(world.board)
  const pinned = monsterHexes(world)
  for (let i = 0; i < hexes.length; i++) {
    if (pinned[i] || hexDistance(at, hexes[i]) > 1 + threat) continue
    world.blight[i] = Math.max(0, world.blight[i] - CLEANSE_LEVELS)
    world.shift[i] = 0
  }
}

/** The share of the map's hexes at blighted or worse. */
export function blightedShare(world: WorldState): number {
  return world.blight.filter((level) => level >= 2).length / world.blight.length
}
