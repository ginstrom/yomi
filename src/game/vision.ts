import { hexToOffset, type Hex } from '../grid/hex.ts'
import { boardIndex, type WorldEvent } from './blight.ts'
import { ENCAMPMENT_ID, SOURCE_ID, type WorldState } from './worldMap.ts'

/**
 * Fog of war (docs/designs/guild-hall-and-watchtowers.md §4.6): what the
 * player knows of the world map. The party, the encampment, the held sites
 * and the watchtowers see every hex within a radius; nothing blocks sight. A
 * hex once seen stays explored, remembered at the blight level it had when last in sight
 * (`WorldState.seen`), and a monster location once seen stays known
 * (`WorldState.sighted`). Knowledge only: the blight's rules work on the true
 * state, and the simulator ignores it. Vision draws no dice.
 */

export const PARTY_VISION = 5
export const CAMP_VISION = 6
export const TOWN_VISION = 3
export const SITE_VISION = 2
export const TOWER_VISION = 8

/** `WorldState.seen` holds this for a hex never seen. */
export const UNEXPLORED = -1

/** Every hex within `radius` of `at` that is on the board, by `boardIndex`. */
function hexesWithin(world: WorldState, at: Hex, radius: number, into: Set<number>): void {
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      const h = { q: at.q + dq, r: at.r + dr }
      const { col, row } = hexToOffset(h)
      if (col < 0 || row < 0 || col >= world.board.cols || row >= world.board.rows) continue
      into.add(boardIndex(world.board, h))
    }
  }
}

/** The hexes in sight now, by `boardIndex`: within sight of the party, the encampment, a held site or a watchtower. */
export function visibleHexes(world: WorldState): Set<number> {
  const visible = new Set<number>()
  hexesWithin(world, world.party, PARTY_VISION, visible)
  for (const location of world.locations) {
    if (location.kind === 'monsters' || !world.held.includes(location.id)) continue
    const radius = location.id === ENCAMPMENT_ID ? CAMP_VISION : location.kind === 'town' ? TOWN_VISION : SITE_VISION
    hexesWithin(world, location.position, radius, visible)
  }
  for (const tower of world.towers) hexesWithin(world, tower.position, TOWER_VISION, visible)
  return visible
}

/**
 * Brings what the player knows up to date: every hex in sight is remembered
 * at its level now, and every monster location in sight becomes known, each
 * newly seen one told as a `sighted` event. Called after every change to the
 * land (`passTurn`, `clearLocation`, a new world).
 */
export function updateSight(world: WorldState): WorldEvent[] {
  const visible = visibleHexes(world)
  for (const i of visible) world.seen[i] = world.blight[i]
  const events: WorldEvent[] = []
  for (const location of world.locations) {
    if (location.kind !== 'monsters' || world.sighted.includes(location.id)) continue
    if (!visible.has(boardIndex(world.board, location.position))) continue
    world.sighted.push(location.id)
    events.push({ type: 'sighted', location: location.id, name: location.name, at: location.position, threat: location.threat })
  }
  return events
}

/**
 * A new world's knowledge: all unexplored but what its watchers see, and the
 * Source, which the party was sent to destroy, marked from the start.
 */
export function seedSight(world: WorldState): void {
  world.seen = world.blight.map(() => UNEXPLORED)
  world.sighted = []
  const source = world.locations.find((l) => l.id === SOURCE_ID)
  if (source) {
    const i = boardIndex(world.board, source.position)
    world.seen[i] = world.blight[i]
    world.sighted.push(source.id)
  }
  updateSight(world)
}

/** Whether the player knows of the monster location `id`. */
export function isSighted(world: WorldState, id: string): boolean {
  return world.sighted.includes(id)
}

/** The share of the explored hexes the player last saw blighted or worse: the header's figure. */
export function knownBlightedShare(world: WorldState): number {
  let explored = 0
  let blighted = 0
  for (const level of world.seen) {
    if (level === UNEXPLORED) continue
    explored++
    if (level >= 2) blighted++
  }
  return explored === 0 ? 0 : blighted / explored
}
