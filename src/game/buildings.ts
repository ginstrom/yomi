import { hexDistance, hexEquals } from '../grid/hex.ts'
import { blightAt, type WorldEvent } from './blight.ts'
import type { Material, Stock } from './territory.ts'
import { locationAt, monstersHere, passTurn, worldActive, type WorldState } from './worldMap.ts'

/**
 * What the encampment's stock builds (docs/designs/guild-hall-and-watchtowers.md
 * §4.5), and the stock's arithmetic. A watchtower is built by the party where
 * it stands, on clean land, paid for from the stock wherever the party is;
 * it is a clean source in the blight's contest (blight.ts), sees further than
 * anything else (vision.ts), and is lost as a held site is (territory.ts).
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
  if (locationAt(world, world.party)) return 'A watchtower cannot stand on a town or a resource.'
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
