import { mulberry32 } from '../combat/rng.ts'
import { HexBoard, hexDistance, hexNeighbors, hexToOffset, offsetToHex, type BoardSize, type Hex } from '../grid/hex.ts'
import { MAGIC_ITEMS, type Item } from '../inventory/inventory.ts'
import type { EncounterId } from './encounters.ts'
import type { Material } from './territory.ts'
import { ENCAMPMENT_ID, threatAt, type MonsterLocation, type WorldState } from './worldMap.ts'

/**
 * The blight (docs/designs/blight.md): every hex of the world map has a level
 * from 0 (clean) to 3 (corrupted), and each day blight and clean influence
 * contend for it. Monster locations, the Source and corrupted land push the
 * blight; the encampment (with its shrine), held sites (with their outposts),
 * watchtowers and the party push back. A hex's `shift`
 * counter moves by the difference each day, and a level goes up or down when
 * it reaches `SHIFT_COST` either way. Corrupted land spawns new monster
 * locations. Phaser-free; worldMap.ts calls `advanceDay` once a world turn.
 *
 * This module imports worldMap.ts and worldMap.ts imports it, which is safe
 * while neither calls the other as its module loads.
 */

export const MAX_BLIGHT = 3
export const BLIGHT_NAMES = ['clean', 'tainted', 'blighted', 'corrupted'] as const

/** A monster location pushes with this times its threat... */
export const BLIGHT_PER_THREAT = 2
/** ...and the Source with this. */
export const SOURCE_STRENGTH = 20
/** What each corrupted neighbour adds to a hex's blight. */
export const CREEP = 1
/** The clean side: the encampment, a held resource. */
export const CAMP_STRENGTH = 8
export const SITE_STRENGTH = 3
/** A watchtower (buildings.ts), a little stronger than a resource. */
export const TOWER_STRENGTH = 4
/** What each level of the encampment's shrine adds to its strength (buildings.ts). */
export const SHRINE_STRENGTH = 3
/** What an outpost adds to its held site's strength (buildings.ts). */
export const OUTPOST_STRENGTH = 3
/** The party pushes with this plus half the sum of its members' levels. */
export const PARTY_BASE = 2
/** How far a hex's shift counter must go, either way, to move its level by one. */
export const SHIFT_COST = 60

/** The blight's strength rises by this share every `GROWTH_DAYS`, up to `MAX_BLIGHT_GROWTH`. */
export const BLIGHT_GROWTH = 0.1
export const GROWTH_DAYS = 30
export const MAX_BLIGHT_GROWTH = 0.5

/** Each day spawn pressure grows by the corrupted hexes over this, times the growth... */
export const SPAWN_DIVISOR = 200
/** ...and a monster location appears when it reaches this. */
export const SPAWN_COST = 30
/** A spawn keeps this many hexes from the party, other monster locations, held sites and watchtowers. */
export const SPAWN_CLEARANCE = 4
export const MAX_MONSTER_LOCATIONS = 24
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
  | { type: 'site_lost'; site: string; name: string; outpost?: true }
  | { type: 'tower_built'; tower: string; at: Hex }
  | { type: 'tower_lost'; tower: string; at: Hex }
  | { type: 'outpost_built'; site: string; name: string }
  | { type: 'yield'; site: string; name: string; material: Material; amount: number }
  | { type: 'encampment_lost'; name: string }

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

/** How hard the party pushes: `PARTY_BASE` plus half its levels together. Gear and perks do not count. */
export function partyStrength(party: readonly { level: number }[]): number {
  return PARTY_BASE + Math.floor(party.reduce((sum, member) => sum + member.level, 0) / 2)
}

export function monsterStrength(location: MonsterLocation): number {
  return location.source ? SOURCE_STRENGTH : BLIGHT_PER_THREAT * location.threat
}

/** What a held site pushes with: the encampment with its shrine, a resource with its outpost. */
export function siteStrength(world: WorldState, id: string): number {
  if (id === ENCAMPMENT_ID) return CAMP_STRENGTH + SHRINE_STRENGTH * world.shrine
  return SITE_STRENGTH + (world.outposts.includes(id) ? OUTPOST_STRENGTH : 0)
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

/** The influence of everything but the party and creeping corruption, at every hex: what changes only when a location or a held site does. */
interface Fields {
  key: string
  /** Before growth. */
  blight: Float64Array
  clean: Float64Array
}

/** A memo, not state: a world's fields are worked out again whenever its sources change. */
const fieldMemo = new WeakMap<WorldState, Fields>()

function sources(world: WorldState): { blight: Array<[Hex, number]>; clean: Array<[Hex, number]> } {
  const blight: Array<[Hex, number]> = []
  const clean: Array<[Hex, number]> = []
  for (const location of world.locations) {
    if (location.kind === 'monsters') blight.push([location.position, monsterStrength(location)])
    else if (world.held.includes(location.id)) clean.push([location.position, siteStrength(world, location.id)])
  }
  for (const tower of world.towers) clean.push([tower.position, TOWER_STRENGTH])
  return { blight, clean }
}

function addSource(field: Float64Array, hexes: readonly Hex[], at: Hex, strength: number): void {
  for (let i = 0; i < hexes.length; i++) {
    const push = strength - hexDistance(at, hexes[i])
    if (push > 0) field[i] += push
  }
}

function fields(world: WorldState): Fields {
  const { blight, clean } = sources(world)
  const key = JSON.stringify([blight, clean])
  const memo = fieldMemo.get(world)
  if (memo?.key === key) return memo
  const { hexes } = geometry(world.board)
  const made: Fields = { key, blight: new Float64Array(hexes.length), clean: new Float64Array(hexes.length) }
  for (const [at, strength] of blight) addSource(made.blight, hexes, at, strength)
  for (const [at, strength] of clean) addSource(made.clean, hexes, at, strength)
  fieldMemo.set(world, made)
  return made
}

/** The indices of the hexes monsters stand on: they are pinned at blighted or worse, and influence cannot lower them. */
function monsterHexes(world: WorldState): Set<number> {
  return new Set(
    world.locations.filter((l) => l.kind === 'monsters').map((l) => boardIndex(world.board, l.position)),
  )
}

/**
 * The day's net influence at hex `i`, blight less clean, as `advanceDay` works
 * it out from the levels `levels` (the day before's): the party's own hex is
 * neutral, so no blight rises on it, though the party's influence still lowers it.
 */
function netAt(
  world: WorldState,
  party: readonly { level: number }[],
  i: number,
  levels: readonly number[],
  field: Fields,
  partyIndex: number,
): number {
  const { hexes, neighbours } = geometry(world.board)
  const reach = partyStrength(party) - hexDistance(world.party, hexes[i])
  const clean = field.clean[i] + Math.max(0, reach)
  if (i === partyIndex) return -clean
  let creep = 0
  for (const n of neighbours[i]) if (levels[n] >= MAX_BLIGHT && n !== partyIndex) creep += CREEP
  return (field.blight[i] + creep) * blightGrowth(world.turn) - clean
}

/** Today's net influence at `h`, blight less clean: above 0 the blight is gaining there. */
export function netInfluence(world: WorldState, party: readonly { level: number }[], h: Hex): number {
  const i = boardIndex(world.board, h)
  return netAt(world, party, i, world.blight, fields(world), boardIndex(world.board, world.party))
}

/** The levels a new world starts with: what its sources make of land already tainted. Monsters' hexes are at least blighted. */
export function seedBlight(world: WorldState): void {
  const field = fields(world)
  const { hexes } = geometry(world.board)
  const pinned = monsterHexes(world)
  world.blight = hexes.map((_, i) => {
    const net = INITIAL_TAINT + field.blight[i] - field.clean[i]
    const level = net >= INITIAL_CORRUPTED ? 3 : net >= INITIAL_BLIGHTED ? 2 : net >= 1 ? 1 : 0
    return pinned.has(i) ? Math.max(2, level) : level
  })
  world.shift = hexes.map(() => 0)
}

/**
 * The blight's day: every hex's shift counter moves by its net influence and
 * its level with it, then spawn pressure grows with the corrupted land and may
 * spawn a monster location. Called by `passTurn` after the turn is counted.
 */
export function advanceDay(world: WorldState, party: readonly { level: number }[]): WorldEvent[] {
  const events: WorldEvent[] = []
  const field = fields(world)
  const { hexes } = geometry(world.board)
  const pinned = monsterHexes(world)
  const partyIndex = boardIndex(world.board, world.party)
  const before = world.blight.slice()
  for (let i = 0; i < hexes.length; i++) {
    if (pinned.has(i)) {
      world.blight[i] = Math.max(2, before[i])
      world.shift[i] = 0
      continue
    }
    let shift = world.shift[i] + netAt(world, party, i, before, field, partyIndex)
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
  const spawned = spawn(world, pinned, partyIndex)
  if (spawned) events.push(spawned)
  return events
}

/** What corrupted land spawns: a nest that fights one of these encounters, by its name. */
const SPAWN_KINDS: ReadonlyArray<{ encounter: EncounterId; name: string }> = [
  { encounter: 'goblin_raid', name: 'Goblin Brood' },
  { encounter: 'kobold_scouts', name: 'Kobold Nest' },
]

function spawn(world: WorldState, pinned: Set<number>, partyIndex: number): WorldEvent | null {
  const { hexes } = geometry(world.board)
  const corrupted: number[] = []
  for (let i = 0; i < hexes.length; i++) if (world.blight[i] >= MAX_BLIGHT && !pinned.has(i) && i !== partyIndex) corrupted.push(i)
  world.spawnPressure += (corrupted.length / SPAWN_DIVISOR) * blightGrowth(world.turn)
  if (world.spawnPressure < SPAWN_COST) return null
  // Pressure waits, but no more than one spawn's worth, for room on the map.
  world.spawnPressure = SPAWN_COST
  if (world.locations.filter((l) => l.kind === 'monsters').length >= MAX_MONSTER_LOCATIONS) return null
  const keepClear = [
    world.party,
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
  const kind = SPAWN_KINDS[Math.floor(rng() * SPAWN_KINDS.length)]
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
    // By distance, never by the blight or the date: home's nests stay ones a weak party can beat.
    threat: threatAt(at),
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
    if (pinned.has(i) || hexDistance(at, hexes[i]) > 1 + threat) continue
    world.blight[i] = Math.max(0, world.blight[i] - CLEANSE_LEVELS)
    world.shift[i] = 0
  }
}

/** The share of the map's hexes at blighted or worse. */
export function blightedShare(world: WorldState): number {
  return world.blight.filter((level) => level >= 2).length / world.blight.length
}
