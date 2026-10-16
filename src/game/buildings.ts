import { hexDistance, hexEquals } from '../grid/hex.ts'
import { blightAt, type WorldEvent } from './blight.ts'
import type { Material, Stock } from './territory.ts'
import { ENCAMPMENT_ID, encampmentName, locationAt, monstersHere, passTurn, worldActive, type QuietLocation, type WorldState } from './worldMap.ts'

/**
 * What the encampment's stock builds, and the stock's arithmetic. Everything
 * is paid for from the stock wherever the party is.
 *
 * - A watchtower (docs/designs/guild-hall-and-watchtowers.md §4.5) is built by
 *   the party where it stands, on clean land; it is a clean source in the
 *   blight's contest (blight.ts), sees further than anything else (vision.ts),
 *   and is lost as a held site is (territory.ts).
 * - The shrine (docs/designs/blight.md §4.6) is raised at the encampment, a
 *   level at a time, each adding to the encampment's strength.
 * - An outpost (blight.md §4.6) is built by the party standing on a held
 *   resource: it adds to the site's strength and yield, and falls with it.
 */

/** Iron and gold, which the home valley yields from the start: timber and stone come too late in a campaign (the simulator never had them). */
export const TOWER_COST: Stock = { iron: 10, gold: 5 }
/** No two watchtowers stand nearer than this, so they cannot be stacked into a wall. */
export const TOWER_SPACING = 4

/** Whether `stock` holds at least `cost` of every material. */
export function canAfford(stock: Stock, cost: Stock): boolean {
  return Object.entries(cost).every(([material, amount]) => (stock[material as Material] ?? 0) >= (amount ?? 0))
}

/** Takes `cost` from `stock`, which must afford it. */
export function spend(stock: Stock, cost: Stock): void {
  for (const [material, amount] of Object.entries(cost)) {
    stock[material as Material] = (stock[material as Material] ?? 0) - (amount ?? 0)
  }
}

/** "10 timber, 5 stone". */
export function describeCost(cost: Stock): string {
  return Object.entries(cost)
    .map(([material, amount]) => `${amount} ${material}`)
    .join(', ')
}

/**
 * Why no watchtower can go where the party stands, the stock aside, or null
 * when the place will do: the party must be free to camp there, on clean
 * land, off every location and tower, and `TOWER_SPACING` from every tower.
 */
export function towerSiteRefusal(world: WorldState): string | null {
  if (!worldActive(world) || monstersHere(world)) return 'Nothing can be built here now.'
  if (world.towers.some((tower) => hexEquals(tower.position, world.party))) return 'A watchtower already stands here.'
  if (locationAt(world, world.party)) return 'A watchtower cannot stand on the encampment or a resource.'
  if (blightAt(world, world.party) > 0) return 'A watchtower needs clean land.'
  if (world.towers.some((tower) => hexDistance(tower.position, world.party) < TOWER_SPACING)) {
    return `Too near another watchtower: they must stand ${TOWER_SPACING} hexes apart.`
  }
  return null
}

/** Why no watchtower can be built where the party stands now, or null when one can. */
export function canBuildTower(world: WorldState): string | null {
  const refusal = towerSiteRefusal(world)
  if (refusal) return refusal
  if (!canAfford(world.stock, TOWER_COST)) return `A watchtower costs ${describeCost(TOWER_COST)}, more than the stock holds.`
  return null
}

/**
 * Builds a watchtower where the party stands: the stock pays, and the day the
 * building takes passes with the tower already standing. Null, and nothing
 * done, when `canBuildTower` refuses.
 */
export function buildTower(world: WorldState, party: readonly { level: number }[]): WorldEvent[] | null {
  if (canBuildTower(world)) return null
  spend(world.stock, TOWER_COST)
  world.towersBuilt += 1
  const tower = { id: `tower_${world.towersBuilt}`, position: world.party }
  world.towers.push(tower)
  return [{ type: 'tower_built', tower: tower.id, at: tower.position }, ...passTurn(world, party)]
}

/** What raising the shrine to each level costs, from level 1; silver, from further out, buys the higher ones. */
export const SHRINE_COSTS: readonly Stock[] = [{ gold: 20 }, { gold: 40, silver: 15 }, { gold: 80, silver: 30 }]
export const MAX_SHRINE_LEVEL = SHRINE_COSTS.length

/** Gold and timber: the home valley's gold and the Timber Stand's, a little way out. */
export const OUTPOST_COST: Stock = { gold: 15, timber: 10 }

/** Whether the party stands at the encampment, free to use what is built there (the guild hall, the shrine). */
export function atEncampment(world: WorldState): boolean {
  const camp = world.locations.find((l) => l.id === ENCAMPMENT_ID)
  return worldActive(world) && camp !== undefined && hexEquals(camp.position, world.party) && world.confronting === null
}

/** What raising the shrine a level costs, or null at the top level. */
export function shrineCost(world: WorldState): Stock | null {
  return world.shrine < MAX_SHRINE_LEVEL ? SHRINE_COSTS[world.shrine] : null
}

/** Raises the shrine a level, at once and without passing time; returns why it cannot, or null when done. */
export function raiseShrine(world: WorldState): string | null {
  if (!atEncampment(world)) return `The shrine is at ${encampmentName(world)}.`
  const cost = shrineCost(world)
  if (!cost) return 'The shrine is as great as it gets.'
  if (!canAfford(world.stock, cost)) return `The next level costs ${describeCost(cost)}, more than the stock holds.`
  spend(world.stock, cost)
  world.shrine += 1
  return null
}

/** The held resource the party stands on, where an outpost could go. */
export function outpostSite(world: WorldState): QuietLocation | null {
  const here = locationAt(world, world.party)
  if (!here || here.kind === 'monsters' || here.id === ENCAMPMENT_ID || !world.held.includes(here.id)) return null
  return here
}

/** Why no outpost can go where the party stands, the stock aside, or null when the place will do. */
export function outpostSiteRefusal(world: WorldState): string | null {
  if (!worldActive(world) || monstersHere(world)) return 'Nothing can be built here now.'
  const site = outpostSite(world)
  if (!site) return 'An outpost goes on a held resource.'
  if (world.outposts.includes(site.id)) return `${site.name} already has an outpost.`
  return null
}

/** Why no outpost can be built where the party stands now, or null when one can. */
export function canBuildOutpost(world: WorldState): string | null {
  const refusal = outpostSiteRefusal(world)
  if (refusal) return refusal
  if (!canAfford(world.stock, OUTPOST_COST)) return `An outpost costs ${describeCost(OUTPOST_COST)}, more than the stock holds.`
  return null
}

/**
 * Builds an outpost at the held site the party stands on: the stock pays, and
 * the day the building takes passes with the outpost already standing. Null,
 * and nothing done, when `canBuildOutpost` refuses.
 */
export function buildOutpost(world: WorldState, party: readonly { level: number }[]): WorldEvent[] | null {
  if (canBuildOutpost(world)) return null
  const site = outpostSite(world)!
  spend(world.stock, OUTPOST_COST)
  world.outposts.push(site.id)
  return [{ type: 'outpost_built', site: site.id, name: site.name }, ...passTurn(world, party)]
}
