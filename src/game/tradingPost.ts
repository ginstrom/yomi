import { GRADES, type Grade } from '../inventory/grades.ts'
import { BASE_ITEMS, baseItem, craftedItem, itemById, type Item } from '../inventory/inventory.ts'
import { atEncampment, canAfford, describeCost, spend } from './buildings.ts'
import type { GameState } from './gameState.ts'
import { STALE, allPlaces, itemAt, removeAt, type ItemPlace } from './itemPlace.ts'
import type { Material, Stock } from './territory.ts'
import { encampmentName, type WorldState } from './worldMap.ts'

/**
 * The trading post at the encampment (docs/designs/expeditions-and-encampment.md
 * §4.2): it sells plain items, up to the grade its level allows, into the
 * baggage, and buys whatever the party carries but does not wear, and the
 * stock's materials at a poor rate. It never sells materials. Built from the
 * start; each action returns why it was refused, or null when done.
 */

/** What raising the post to each level costs, from level 1 (built); the level is the highest grade it sells. */
export const TRADING_POST_COSTS: readonly Stock[] = [{}, { gold: 40, stone: 15 }, { gold: 80, copper: 15 }]
export const MAX_TRADING_POST_LEVEL = TRADING_POST_COSTS.length

/** What each plain item costs at grade 1. */
export const PRICES: Readonly<Record<string, number>> = {
  iron_dagger: 6,
  iron_shortsword: 8,
  iron_sword: 12,
  yew_bow: 12,
  oak_shield: 10,
  iron_battle_axe: 14,
  steel_greatsword: 20,
  steel_armor: 20,
}

/** What a grade multiplies a plain price by. */
export const GRADE_PRICE: Record<Grade, number> = { 1: 1, 2: 3, 3: 8 }

/** What each enchanted item is worth; never bought, it sells for half. */
export const VALUES: Readonly<Record<string, number>> = {
  spark_wand: 30,
  storm_wand: 50,
  emberblade: 60,
  hawk_bow: 60,
  ring_protection: 40,
  ring_fortune: 40,
  amulet_focus: 40,
  sage_circlet: 40,
  shadow_cloak: 50,
}

/** How many of a material the post takes for a gold piece. */
export const MATERIALS_PER_GOLD = 2

const notHere = (world: WorldState): string => `The trading post is at ${encampmentName(world)}.`

export function tradingPostCost(world: WorldState): Stock | null {
  return world.tradingPost < MAX_TRADING_POST_LEVEL ? TRADING_POST_COSTS[world.tradingPost] : null
}

/** Raises the trading post a level, at once; returns why it cannot, or null when done. */
export function raiseTradingPost(game: GameState): string | null {
  const { world } = game
  if (!atEncampment(world)) return notHere(world)
  const cost = tradingPostCost(world)
  if (!cost) return 'The trading post is as great as it gets.'
  if (!canAfford(world.stock, cost)) return `The next level costs ${describeCost(cost)}, more than the stock holds.`
  spend(world.stock, cost)
  world.tradingPost += 1
  return null
}

/** What the post asks for a plain item at its grade, modifier aside; null for one it never sells. */
export function buyPrice(item: Item): number | null {
  const base = baseItem(item)
  if (!base) return null
  return PRICES[base.id] * GRADE_PRICE[item.grade ?? 1]
}

/** What the post pays for an item: half its base-and-grade price, or half an enchanted item's value, rounded down. A modifier adds nothing. */
export function salePrice(item: Item): number {
  return Math.floor((buyPrice(item) ?? VALUES[item.id] ?? 0) / 2)
}

/** Every plain item at every grade the post's level allows, plain first. */
export function wares(world: WorldState): Item[] {
  return GRADES.filter((grade) => grade <= world.tradingPost).flatMap((grade) => BASE_ITEMS.map((base) => craftedItem(base, grade)))
}

/** Why `itemId` cannot be bought now, or null when it can. */
export function buyRefusal(game: GameState, itemId: string): string | null {
  const { world } = game
  if (!atEncampment(world)) return notHere(world)
  const item = itemById(itemId)
  const price = item && !item.mod ? buyPrice(item) : null
  if (!item || price === null) return 'The trading post does not sell that.'
  if ((item.grade ?? 1) > world.tradingPost) return `A level ${item.grade} trading post sells that.`
  if ((world.stock.gold ?? 0) < price) return `It costs ${price} gold, more than the stock holds.`
  return null
}

/** Buys `itemId` into the baggage for gold. */
export function buy(game: GameState, itemId: string): string | null {
  const refusal = buyRefusal(game, itemId)
  if (refusal) return refusal
  const item = itemById(itemId)!
  spend(game.world.stock, { gold: buyPrice(item)! })
  game.baggage.push(item)
  return null
}

/** What the post would buy: everything in the backpacks and the baggage, never what is worn. */
export function sellables(game: GameState): Array<{ place: ItemPlace; item: Item; price: number }> {
  return allPlaces(game, false).map(({ place, item }) => ({ place, item, price: salePrice(item) }))
}

/** Sells the item at `place` for gold. A worn item is refused: take it off first. */
export function sell(game: GameState, place: ItemPlace): string | null {
  const { world } = game
  if (!atEncampment(world)) return notHere(world)
  if (place.from === 'worn') return 'Take it off before selling it.'
  const item = itemAt(game, place)
  if (!item) return STALE
  removeAt(game, place)
  world.stock.gold = (world.stock.gold ?? 0) + salePrice(item)
  return null
}

/** Sells `amount` of a material from the stock, in pairs, a gold piece a pair. Gold is never sold. */
export function sellMaterial(game: GameState, material: Material, amount: number): string | null {
  const { world } = game
  if (!atEncampment(world)) return notHere(world)
  if (material === 'gold') return 'Gold is what the post pays in.'
  if (!Number.isInteger(amount) || amount < MATERIALS_PER_GOLD || amount % MATERIALS_PER_GOLD !== 0) {
    return `The post buys ${material} in lots of ${MATERIALS_PER_GOLD}.`
  }
  if ((world.stock[material] ?? 0) < amount) return `The stock holds only ${world.stock[material] ?? 0} ${material}.`
  spend(world.stock, { [material]: amount })
  world.stock.gold = (world.stock.gold ?? 0) + amount / MATERIALS_PER_GOLD
  return null
}
