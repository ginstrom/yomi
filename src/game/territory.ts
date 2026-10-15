import type { Hex } from '../grid/hex.ts'
import { SHIFT_COST, blightAt, boardIndex, netInfluence, type WorldEvent } from './blight.ts'
import { ENCAMPMENT_ID, type QuietLocation, type WorldState } from './worldMap.ts'

/**
 * Territory (docs/designs/blight.md §4.5, §4.7): the towns and resources the
 * party holds. Nobody has to stand on a site to take it: a site is captured
 * when its hex is cleansed to level 0 and lost when the blight raises it to
 * `LOSS_LEVEL`. A held site adds clean influence (blight.ts) and yields to the
 * encampment's stock every `YIELD_DAYS`. The encampment is held like any
 * site, and losing it loses the game. A watchtower (buildings.ts) is lost and
 * warned of as a held site is, and yields nothing.
 */

/** What the warning of a tower under threat calls it. */
export const TOWER_NAME = 'A watchtower'

export type Material = 'gold' | 'iron' | 'timber' | 'silver' | 'stone' | 'salt' | 'copper' | 'crystal' | 'peat'
export type Stock = Partial<Record<Material, number>>

/** A held site is lost when its hex reaches this level. */
export const LOSS_LEVEL = 2
export const YIELD_DAYS = 5
/** What a town yields, in gold. */
export const TOWN_YIELD = 2

/** What each resource yields, by its location's id. */
const RESOURCE_YIELDS: Record<string, { material: Material; amount: number }> = {
  iron_vein: { material: 'iron', amount: 2 },
  gold_seam: { material: 'gold', amount: 2 },
  timber_stand: { material: 'timber', amount: 2 },
  peat_bog: { material: 'peat', amount: 2 },
  silver_lode: { material: 'silver', amount: 2 },
  old_quarry: { material: 'stone', amount: 2 },
  salt_flats: { material: 'salt', amount: 2 },
  copper_pit: { material: 'copper', amount: 2 },
  crystal_cave: { material: 'crystal', amount: 2 },
}

export function sites(world: WorldState): QuietLocation[] {
  return world.locations.filter((l): l is QuietLocation => l.kind !== 'monsters')
}

/** What a site yields a time at full strength; a tainted one yields half, rounded down. */
export function siteYield(site: QuietLocation): { material: Material; amount: number } {
  return site.kind === 'town' ? { material: 'gold', amount: TOWN_YIELD } : (RESOURCE_YIELDS[site.id] ?? { material: 'gold', amount: 1 })
}

/** The sites clean enough to hold at the start of a game, the encampment always among them. */
export function initialHeld(world: WorldState): string[] {
  return sites(world)
    .filter((site) => site.id === ENCAMPMENT_ID || blightAt(world, site.position) === 0)
    .map((site) => site.id)
}

/**
 * The days until the blight takes a held site or a tower, at today's
 * influence, or null when the blight is not gaining there. Either falls at
 * `LOSS_LEVEL`.
 */
export function daysToFall(world: WorldState, party: readonly { level: number }[], site: { position: Hex }): number | null {
  const net = netInfluence(world, party, site.position)
  if (net <= 0) return null
  const level = blightAt(world, site.position)
  if (level >= LOSS_LEVEL) return 0
  const shift = world.shift[boardIndex(world.board, site.position)]
  return Math.ceil((SHIFT_COST - shift) / net) + (LOSS_LEVEL - 1 - level) * Math.ceil(SHIFT_COST / net)
}

/**
 * The territory's day, after the blight's: sites captured and lost as their
 * levels now stand, held sites newly under threat, and every `YIELD_DAYS` the
 * yields. Losing the encampment ends the game (`status` 'lost').
 */
export function updateTerritory(world: WorldState, party: readonly { level: number }[]): WorldEvent[] {
  const events: WorldEvent[] = []
  for (const site of sites(world)) {
    const level = blightAt(world, site.position)
    const held = world.held.includes(site.id)
    if (!held && level === 0) {
      world.held.push(site.id)
      events.push({ type: 'site_captured', site: site.id, name: site.name })
    } else if (held && level >= LOSS_LEVEL) {
      world.held = world.held.filter((id) => id !== site.id)
      if (site.id === ENCAMPMENT_ID) {
        world.status = 'lost'
        events.push({ type: 'encampment_lost' })
      } else {
        events.push({ type: 'site_lost', site: site.id, name: site.name })
      }
    }
  }
  for (const tower of world.towers.filter((t) => blightAt(world, t.position) >= LOSS_LEVEL)) {
    world.towers = world.towers.filter((t) => t !== tower)
    events.push({ type: 'tower_lost', tower: tower.id, at: tower.position })
  }
  // Told once, as a site or tower comes under threat; the map shows it for as long as it lasts.
  const threatened: string[] = []
  const watched = [
    ...sites(world).filter((site) => world.held.includes(site.id)),
    ...world.towers.map((tower) => ({ ...tower, name: TOWER_NAME })),
  ]
  for (const site of watched) {
    const days = daysToFall(world, party, site)
    if (days === null) continue
    threatened.push(site.id)
    if (!world.threatened.includes(site.id)) events.push({ type: 'site_threatened', site: site.id, name: site.name, days })
  }
  world.threatened = threatened
  if (world.turn % YIELD_DAYS === 0) {
    for (const site of sites(world)) {
      if (!world.held.includes(site.id)) continue
      const { material, amount } = siteYield(site)
      const yielded = blightAt(world, site.position) > 0 ? Math.floor(amount / 2) : amount
      if (yielded === 0) continue
      world.stock[material] = (world.stock[material] ?? 0) + yielded
      events.push({ type: 'yield', site: site.id, name: site.name, material, amount: yielded })
    }
  }
  return events
}
