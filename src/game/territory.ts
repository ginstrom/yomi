import type { Hex } from '../grid/hex.ts'
import { MAX_BLIGHT, SHIFT_COST, blightAt, boardIndex, netInfluence, type WorldEvent } from './blight.ts'
import type { PartyPresence } from './expedition.ts'
import { partnerDay, tradeDay } from './trade.ts'
import { ENCAMPMENT_ID, encampment, type QuietLocation, type WorldState } from './worldMap.ts'

/**
 * Territory (docs/designs/blight.md §4.5, §4.7): the resources the party
 * holds, and the encampment. Nobody has to stand on a site to take it: a site is captured
 * when its hex is cleansed to level 0 and lost when the blight raises it to
 * its `lossLevel` (`LOSS_LEVEL`, or `MAX_BLIGHT` for a fort). A held site adds
 * clean influence (blight.ts) and yields to the encampment's stock every
 * `YIELD_DAYS`. The encampment is held like any site, and losing it loses the
 * game. A resource's improvement (buildings.ts: an outpost, works or a fort,
 * levels 1 to 3) lifts its site's yield and strength and is razed when the
 * site is lost. A watchtower is lost and warned of as a held site is, at
 * `LOSS_LEVEL`, and yields nothing. At the end of the day the trade
 * partners are contacted and fall silent or wake (`partnerDay` in trade.ts),
 * then the trade routes' day (`tradeDay`): every day a raid or its end is
 * told, and on yield days the routes pay or count their raids.
 */

/** What the warning of a tower under threat calls it. */
export const TOWER_NAME = 'A watchtower'

export type Material = 'gold' | 'iron' | 'timber' | 'silver' | 'stone' | 'salt' | 'copper' | 'crystal' | 'peat'
  // The outer rings' ores and woods (stage 9): no use until stage 10; the trading post buys them.
  | 'ironwood' | 'mithril' | 'elderwood' | 'adamant' | 'wyrmwood' | 'starmetal' | 'heartwood'
export type Stock = Partial<Record<Material, number>>

/** A held site is lost when its hex reaches this level, a fort's aside (`lossLevel`). */
export const LOSS_LEVEL = 2
export const YIELD_DAYS = 5
/** What the encampment yields, in gold. */
export const ENCAMPMENT_YIELD = 2
/** Where a yield comes from: a held site (the default, left out of the event), the encampment's market or a trade route. */
export type YieldSource = 'site' | 'market' | 'route'
/** What the market brings the stock in gold each yield day, by trading post level - 1 (levels 4 to 6), before taint halves it. */
export const MARKET_INCOME: readonly number[] = [0, 0, 0, 2, 3, 5]
/** The market's income at full strength: the trading post's level reads the table. */
export function marketIncome(world: WorldState): number {
  return MARKET_INCOME[world.tradingPost - 1] ?? 0
}
/** A resource's improvement (buildings.ts): 1 an outpost, 2 its works, 3 a fort. */
export type ImprovementLevel = 1 | 2 | 3
/** What each improvement level adds to its site's yield, by level 0 to 3, before taint halves it. */
export const IMPROVEMENT_YIELD: readonly number[] = [0, 1, 3, 3]
/** What a resource's works (level 2) are called, by its material. */
export const WORKS_NAMES: Record<Material, string> = {
  iron: 'Mine', gold: 'Mine', silver: 'Mine', copper: 'Mine', crystal: 'Mine',
  timber: 'Lumber Camp', stone: 'Quarry', salt: 'Saltworks', peat: 'Peat Cuttings',
  mithril: 'Mine', adamant: 'Mine', starmetal: 'Mine',
  ironwood: 'Lumber Camp', elderwood: 'Lumber Camp', wyrmwood: 'Lumber Camp', heartwood: 'Lumber Camp',
}

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
  // The outer rings' (stage 9).
  ironwood_grove: { material: 'ironwood', amount: 2 },
  mithril_lode: { material: 'mithril', amount: 2 },
  elder_grove: { material: 'elderwood', amount: 2 },
  adamant_deep: { material: 'adamant', amount: 2 },
  wyrmwood_thicket: { material: 'wyrmwood', amount: 2 },
  fallen_star: { material: 'starmetal', amount: 2 },
  heartwood: { material: 'heartwood', amount: 2 },
}

/** The encampment and the resources: what the party holds and loses (a trade partner is neither). */
export function sites(world: WorldState): QuietLocation[] {
  return world.locations.filter((l): l is QuietLocation => l.kind === 'encampment' || l.kind === 'resource')
}

/** A site's improvement level, 0 for none (the encampment and towers never have one). */
export function siteImprovement(world: WorldState, id: string): 0 | ImprovementLevel {
  return world.improvements[id] ?? 0
}

/** What a resource's improvement at `level` is called: "Outpost", its works ("Mine", "Quarry", …), "Fort". */
export function improvementName(site: QuietLocation, level: ImprovementLevel): string {
  if (level === 1) return 'Outpost'
  if (level === 3) return 'Fort'
  return WORKS_NAMES[RESOURCE_YIELDS[site.id]?.material ?? 'gold']
}

/** Whether an improvement's name is plural ("Saltworks", "Peat Cuttings"), so takes "need" and "stand" rather than "needs" and "stands". */
export function isPluralName(name: string): boolean {
  return name.endsWith('s')
}

/** The text with its first letter in capitals: "an Outpost" → "An Outpost". */
export function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** An improvement's name with its article: "an Outpost", "a Mine"; a plural name ("Saltworks", "Peat Cuttings") bare. */
export function withArticle(name: string): string {
  if (isPluralName(name)) return name
  return `${/^[AEIOU]/i.test(name) ? 'an' : 'a'} ${name}`
}

/** The level at which a held site's hex loses it: `MAX_BLIGHT` (corrupted) for a fort, else `LOSS_LEVEL`. */
export function lossLevel(world: WorldState, id: string): number {
  return siteImprovement(world, id) === 3 ? MAX_BLIGHT : LOSS_LEVEL
}

/** What a site yields a time at full strength, its improvement's share included; a tainted one yields half, rounded down. */
export function siteYield(world: WorldState, site: QuietLocation): { material: Material; amount: number } {
  const own = site.kind === 'encampment' ? { material: 'gold' as const, amount: ENCAMPMENT_YIELD } : (RESOURCE_YIELDS[site.id] ?? { material: 'gold' as const, amount: 1 })
  return { ...own, amount: own.amount + IMPROVEMENT_YIELD[siteImprovement(world, site.id)] }
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
 * its `lossLevel` (a tower's and the encampment's is `LOSS_LEVEL`).
 */
export function daysToFall(world: WorldState, presences: readonly PartyPresence[], site: { id: string; position: Hex }): number | null {
  const net = netInfluence(world, presences, site.position)
  if (net <= 0) return null
  const loss = lossLevel(world, site.id)
  const level = blightAt(world, site.position)
  if (level >= loss) return 0
  const shift = world.shift[boardIndex(world.board, site.position)]
  return Math.ceil((SHIFT_COST - shift) / net) + (loss - 1 - level) * Math.ceil(SHIFT_COST / net)
}

/**
 * The territory's day, after the blight's: sites captured and lost as their
 * levels now stand, held sites newly under threat, and every `YIELD_DAYS` the
 * yields. Losing the encampment ends the game (`status` 'lost').
 */
export function updateTerritory(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[] {
  const events: WorldEvent[] = []
  for (const site of sites(world)) {
    const level = blightAt(world, site.position)
    const held = world.held.includes(site.id)
    if (!held && level === 0) {
      world.held.push(site.id)
      events.push({ type: 'site_captured', site: site.id, name: site.name })
    } else if (held && level >= lossLevel(world, site.id)) {
      world.held = world.held.filter((id) => id !== site.id)
      const improvement = siteImprovement(world, site.id)
      if (site.id === ENCAMPMENT_ID) {
        world.status = 'lost'
        events.push({ type: 'encampment_lost', name: site.name })
      } else if (improvement !== 0) {
        // An improvement, of whatever level, is razed with its site.
        delete world.improvements[site.id]
        events.push({ type: 'site_lost', site: site.id, name: site.name, improvement })
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
    const days = daysToFall(world, presences, site)
    if (days === null) continue
    threatened.push(site.id)
    if (!world.threatened.includes(site.id)) events.push({ type: 'site_threatened', site: site.id, name: site.name, days })
  }
  world.threatened = threatened
  if (world.turn % YIELD_DAYS === 0) {
    for (const site of sites(world)) {
      if (!world.held.includes(site.id)) continue
      const { material, amount } = siteYield(world, site)
      const yielded = blightAt(world, site.position) > 0 ? Math.floor(amount / 2) : amount
      if (yielded === 0) continue
      world.stock[material] = (world.stock[material] ?? 0) + yielded
      events.push({ type: 'yield', site: site.id, name: site.name, material, amount: yielded })
    }
    // The market's gold comes after every site's, so a day's earlier events keep their order.
    const camp = encampment(world)
    const income = marketIncome(world)
    const market = blightAt(world, camp.position) > 0 ? Math.floor(income / 2) : income
    if (market > 0) {
      world.stock.gold = (world.stock.gold ?? 0) + market
      events.push({ type: 'yield', site: ENCAMPMENT_ID, name: camp.name, material: 'gold', amount: market, source: 'market' })
    }
  }
  // The partners' day and then the routes' come last, so a day's earlier events keep their order.
  events.push(...partnerDay(world, presences))
  events.push(...tradeDay(world, presences))
  return events
}
