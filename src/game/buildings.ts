import { hexDistance, hexEquals } from '../grid/hex.ts'
import { blightAt, type WorldEvent } from './blight.ts'
import { act } from './company.ts'
import type { Expedition } from './expedition.ts'
import type { GameState } from './gameState.ts'
import { improvementName, siteImprovement, withArticle, type ImprovementLevel, type Material, type Stock } from './territory.ts'
import { ENCAMPMENT_ID, encampmentName, locationAt, monstersHere, worldActive, type QuietLocation, type WorldState } from './worldMap.ts'

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
 * - A held resource is improved (docs/designs/long-campaign/stage-07-site-improvements-and-markets.md)
 *   by the party standing on it, a level at a time: an outpost (1), its works
 *   (2, named by its material) and a fort (3), each adding to the site's
 *   yield and strength; a fort is lost only when corrupted (territory.ts), and
 *   every level falls with its site. Works need the Builders' Lodge, raised at
 *   the encampment, and a fort its level 2.
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
export function towerSiteRefusal(world: WorldState, party: Expedition): string | null {
  const here = party.position
  if (!worldActive(world) || monstersHere(world, party)) return 'Nothing can be built here now.'
  if (world.towers.some((tower) => hexEquals(tower.position, here))) return 'A watchtower already stands here.'
  if (locationAt(world, here)) return 'A watchtower cannot stand on the encampment or a resource.'
  if (blightAt(world, here) > 0) return 'A watchtower needs clean land.'
  if (world.towers.some((tower) => hexDistance(tower.position, here) < TOWER_SPACING)) {
    return `Too near another watchtower: they must stand ${TOWER_SPACING} hexes apart.`
  }
  return null
}

/** Why no watchtower can be built where the party stands now, or null when one can. */
export function canBuildTower(world: WorldState, party: Expedition): string | null {
  const refusal = towerSiteRefusal(world, party)
  if (refusal) return refusal
  if (!canAfford(world.stock, TOWER_COST)) return `A watchtower costs ${describeCost(TOWER_COST)}, more than the stock holds.`
  return null
}

/**
 * Raises a watchtower where the party stands, with no time passing: the stock
 * pays and the tower stands. Assumes `canBuildTower` said null. Returns the
 * `tower_built` event.
 */
export function raiseTower(world: WorldState, party: Expedition): WorldEvent {
  spend(world.stock, TOWER_COST)
  world.towersBuilt += 1
  const tower = { id: `tower_${world.towersBuilt}`, position: party.position }
  world.towers.push(tower)
  return { type: 'tower_built', tower: tower.id, at: tower.position }
}

/**
 * Builds a watchtower where the party stands, a one-day order on the day loop
 * (`act`): the tower is raised, then the day passes with it standing. Returns
 * the `tower_built` event and the day's, or null, and nothing done, when
 * `canBuildTower` refuses.
 */
export function buildTower(game: GameState, party: Expedition): WorldEvent[] | null {
  if (canBuildTower(game.world, party)) return null
  const report = act(game, party.id, { kind: 'tower' })
  return typeof report === 'string' ? null : report.events
}

/** What raising the shrine to each level costs, from level 1; silver, from further out, buys the higher ones. */
export const SHRINE_COSTS: readonly Stock[] = [{ gold: 20 }, { gold: 40, silver: 15 }, { gold: 80, silver: 30 }]
export const MAX_SHRINE_LEVEL = SHRINE_COSTS.length

/** What each improvement level costs, from the outpost (level 1); an outpost's gold and timber are the home valley's and the Timber Stand's, a little way out. */
export const IMPROVEMENT_COSTS: readonly Stock[] = [{ gold: 15, timber: 10 }, { gold: 30, stone: 15 }, { gold: 50, iron: 20, stone: 10 }]
/** The Builders' Lodge level each improvement level needs, from the outpost. */
export const IMPROVEMENT_LODGE: readonly number[] = [0, 1, 2]
/** What raising the Builders' Lodge to each level costs, from level 1. */
export const LODGE_COSTS: readonly Stock[] = [{ gold: 30, timber: 20 }, { gold: 60, stone: 25 }, { gold: 100, iron: 20, stone: 20 }]
export const MAX_LODGE_LEVEL = LODGE_COSTS.length
/** The highest level `raiseLodge` builds until roads come with trade routes (stage 8). */
export const LODGE_LEVEL_LIMIT = 2
export const ROADS_REFUSAL = 'Roads come with trade routes.'

/** @deprecated until stage 7 step 06: `IMPROVEMENT_COSTS[0]`. */
export const OUTPOST_COST: Stock = IMPROVEMENT_COSTS[0]

/** Whether the party stands at the encampment, free to use what is built there (the guild hall, the shrine). */
export function atEncampment(world: WorldState, party: Expedition): boolean {
  const camp = world.locations.find((l) => l.id === ENCAMPMENT_ID)
  return worldActive(world) && camp !== undefined && hexEquals(camp.position, party.position) && party.confronting === null
}

/** What raising the shrine a level costs, or null at the top level. */
export function shrineCost(world: WorldState): Stock | null {
  return world.shrine < MAX_SHRINE_LEVEL ? SHRINE_COSTS[world.shrine] : null
}

/** Raises the shrine a level, at once and without passing time; returns why it cannot, or null when done. */
export function raiseShrine(world: WorldState, party: Expedition): string | null {
  if (!atEncampment(world, party)) return `The shrine is at ${encampmentName(world)}.`
  const cost = shrineCost(world)
  if (!cost) return 'The shrine is as great as it gets.'
  if (!canAfford(world.stock, cost)) return `The next level costs ${describeCost(cost)}, more than the stock holds.`
  spend(world.stock, cost)
  world.shrine += 1
  return null
}

/** The held resource the party stands on (never the encampment), where an improvement could go. */
export function improvementSite(world: WorldState, party: Expedition): QuietLocation | null {
  const here = locationAt(world, party.position)
  if (!here || here.kind === 'monsters' || here.id === ENCAMPMENT_ID || !world.held.includes(here.id)) return null
  return here
}

/** The site's next improvement: its level, name, cost and the Lodge level it needs; null at a fort. */
export function nextImprovement(world: WorldState, site: QuietLocation): { level: ImprovementLevel; name: string; cost: Stock; lodge: number } | null {
  const current = siteImprovement(world, site.id)
  if (current === 3) return null
  const level = (current + 1) as ImprovementLevel
  return { level, name: improvementName(site, level), cost: IMPROVEMENT_COSTS[level - 1], lodge: IMPROVEMENT_LODGE[level - 1] }
}

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** Why no improvement can go where the party stands, the Lodge and the stock aside, or null when the place will do. */
export function improveSiteRefusal(world: WorldState, party: Expedition): string | null {
  if (!worldActive(world) || monstersHere(world, party)) return 'Nothing can be built here now.'
  const site = improvementSite(world, party)
  if (!site) return 'Improvements go on a held resource.'
  if (!nextImprovement(world, site)) return `${site.name} is as strong as it gets.`
  return null
}

/** Why the site the party stands on cannot be improved now, or null when it can: the place, then the Lodge, then the stock. */
export function improveRefusal(world: WorldState, party: Expedition): string | null {
  const refusal = improveSiteRefusal(world, party)
  if (refusal) return refusal
  const next = nextImprovement(world, improvementSite(world, party)!)!
  const building = capitalised(withArticle(next.name))
  if (world.lodge < next.lodge) return `${building} ${next.name.endsWith('s') ? 'need' : 'needs'} the Builders' Lodge${next.lodge > 1 ? ` at level ${next.lodge}` : ''}.`
  if (!canAfford(world.stock, next.cost)) return `${building} costs ${describeCost(next.cost)}, more than the stock holds.`
  return null
}

/**
 * Raises the next improvement at the held site the party stands on, with no
 * time passing: the stock pays and the level stands. Assumes `improveRefusal`
 * said null. Returns the `site_improved` event.
 */
export function raiseImprovement(world: WorldState, party: Expedition): WorldEvent {
  const site = improvementSite(world, party)!
  const { level, name, cost } = nextImprovement(world, site)!
  spend(world.stock, cost)
  world.improvements[site.id] = level
  return { type: 'site_improved', site: site.id, name: site.name, level, building: name }
}

/**
 * Improves the held site the party stands on, a one-day order on the day
 * loop (`act`): the level is raised, then the day passes with it standing.
 * Returns the `site_improved` event and the day's, or null, and nothing done,
 * when `improveRefusal` refuses.
 */
export function improveSite(game: GameState, party: Expedition): WorldEvent[] | null {
  if (improveRefusal(game.world, party)) return null
  const report = act(game, party.id, { kind: 'improve' })
  return typeof report === 'string' ? null : report.events
}

/** What raising the Builders' Lodge a level costs, or null at the top level. */
export function lodgeCost(world: WorldState): Stock | null {
  return world.lodge < MAX_LODGE_LEVEL ? LODGE_COSTS[world.lodge] : null
}

/** Raises the Builders' Lodge a level, at once and without passing time, up to `LODGE_LEVEL_LIMIT`; returns why it cannot, or null when done. */
export function raiseLodge(game: GameState, party: Expedition): string | null {
  const { world } = game
  if (!atEncampment(world, party)) return `The Builders' Lodge is at ${encampmentName(world)}.`
  const cost = lodgeCost(world)
  if (!cost || world.lodge >= LODGE_LEVEL_LIMIT) return ROADS_REFUSAL
  if (!canAfford(world.stock, cost)) return `The next level costs ${describeCost(cost)}, more than the stock holds.`
  spend(world.stock, cost)
  world.lodge += 1
  return null
}

// The outpost's names, kept with their old behaviour until the world map (step 04) and the simulator (step 06) move to the improvements'.

/** @deprecated until stage 7 step 06: `improvementSite`. */
export const outpostSite = improvementSite

/** @deprecated until stage 7 step 06. Why no outpost can go where the party stands, the stock aside, or null when the place will do; a site with any improvement is refused. */
export function outpostSiteRefusal(world: WorldState, party: Expedition): string | null {
  if (!worldActive(world) || monstersHere(world, party)) return 'Nothing can be built here now.'
  const site = improvementSite(world, party)
  if (!site) return 'An outpost goes on a held resource.'
  if (siteImprovement(world, site.id) !== 0) return `${site.name} already has an outpost.`
  return null
}

/** @deprecated until stage 7 step 06. Why no outpost can be built where the party stands now, or null when one can. */
export function canBuildOutpost(world: WorldState, party: Expedition): string | null {
  const refusal = outpostSiteRefusal(world, party)
  if (refusal) return refusal
  if (!canAfford(world.stock, OUTPOST_COST)) return `An outpost costs ${describeCost(OUTPOST_COST)}, more than the stock holds.`
  return null
}

/** @deprecated until stage 7 step 06. Builds an outpost (`{ kind: 'improve' }` on an unimproved site) when `canBuildOutpost` allows, a day; else null, nothing done. */
export function buildOutpost(game: GameState, party: Expedition): WorldEvent[] | null {
  if (canBuildOutpost(game.world, party)) return null
  const report = act(game, party.id, { kind: 'improve' })
  return typeof report === 'string' ? null : report.events
}
