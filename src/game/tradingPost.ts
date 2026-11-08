import type { FamilyId, Tier } from '../inventory/catalog.ts'
import { GRADES, type Grade } from '../inventory/grades.ts'
import { BASE_ITEMS, baseItem, craftedItem, itemById, unruned, type EquipmentSlot, type Item } from '../inventory/inventory.ts'
import { addToPouch, parseRuneKey, pouchCount, runeName, takeFromPouch, type Rank, type RuneId, type RuneKey } from '../inventory/runes.ts'
import { atEncampment, canAfford, describeCost, spend } from './buildings.ts'
import { leader, type GameState } from './gameState.ts'
import { STALE, allPlaces, itemAt, removeAt, type ItemPlace } from './itemPlace.ts'
import type { Material, Stock } from './territory.ts'
import { encampmentName, type WorldState } from './worldMap.ts'

/**
 * The trading post at the encampment (docs/designs/expeditions-and-encampment.md
 * §4.2): it sells plain items, up to the grade its level allows, into the
 * baggage, and buys whatever the party carries but does not wear, and the
 * stock's materials at a poor rate. It also sells runes into the pouch (rank 1
 * from level 2, rank 2 from level 4, six kinds) and buys any from it. It never
 * sells materials, nor a runed item. Built from the
 * start; each action returns why it was refused, or null when done.
 */

/** What raising the post to each level costs, from level 1 (built). Levels 1 to 3 sell tier 1 at grades up to the level; level 4 adds tier 2 at every grade. Runes: rank 1 from level 2, rank 2 from level 4. */
export const TRADING_POST_COSTS: readonly Stock[] = [{}, { gold: 40, stone: 15 }, { gold: 80, copper: 15 }, { gold: 120, silver: 20 }]
export const MAX_TRADING_POST_LEVEL = TRADING_POST_COSTS.length

/** The level from which the post sells tier 2. */
export const TIER_TWO_LEVEL = 4

/** What a plain item of each family costs at tier 1 and grade 1. */
export const PRICES: Readonly<Record<FamilyId, number>> = {
  dagger: 6,
  shortsword: 8,
  rapier: 10,
  longsword: 12,
  mace: 12,
  spear: 12,
  battle_axe: 14,
  war_hammer: 18,
  greatsword: 20,
  halberd: 22,
  bow: 12,
  longbow: 16,
  crossbow: 18,
  wand: 30,
  staff: 16,
  buckler: 6,
  shield: 10,
  tower_shield: 18,
  robe: 10,
  leather: 14,
  breastplate: 20,
  plate: 30,
  cap: 4,
  helm: 6,
  gloves: 4,
  gauntlets: 6,
  boots: 4,
  greaves: 6,
}

/** What a tier multiplies a plain price by; every price is even, so tier 2's is whole. */
export const TIER_PRICE: Record<Tier, number> = { 1: 1, 2: 2.5 }

/** What a grade multiplies a plain price by. */
export const GRADE_PRICE: Record<Grade, number> = { 1: 1, 2: 3, 3: 8 }

/** What each enchanted item is worth; never bought, it sells for half. */
export const VALUES: Readonly<Record<string, number>> = {
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
  if (!atEncampment(world, leader(game))) return notHere(world)
  const cost = tradingPostCost(world)
  if (!cost) return 'The trading post is as great as it gets.'
  if (!canAfford(world.stock, cost)) return `The next level costs ${describeCost(cost)}, more than the stock holds.`
  spend(world.stock, cost)
  world.tradingPost += 1
  return null
}

/** What the post asks for a plain item at its tier and grade, modifier aside; null for an enchanted one, which it never sells. */
export function buyPrice(item: Item): number | null {
  const base = baseItem(item)
  if (!base?.family) return null
  return PRICES[base.family] * TIER_PRICE[base.tier ?? 1] * GRADE_PRICE[item.grade ?? 1]
}

/** What the post pays for an item: half its base-and-grade price, or half an enchanted item's value, plus half of each embedded rune's price, rounded down. A modifier adds nothing. */
export function salePrice(item: Item): number {
  const bare = unruned(item)
  const runes = (item.runes ?? []).reduce((sum, key) => sum + runePrice(key), 0)
  return Math.floor(((buyPrice(bare) ?? VALUES[bare.id] ?? 0) + runes) / 2)
}

/** Whether the post at its level sells `item`: tier 1 at grades up to min(level, 3); tier 2 at every grade from `TIER_TWO_LEVEL`. */
export function sells(world: WorldState, item: Item): boolean {
  const base = baseItem(item)
  if (!base || item.mod || item.runes?.length) return false
  if (base.tier === 2) return world.tradingPost >= TIER_TWO_LEVEL
  return (item.grade ?? 1) <= Math.min(world.tradingPost, 3)
}

/** The lowest level whose post sells the plain item `item`. */
function sellingLevel(item: Item): number {
  return item.tier === 2 ? TIER_TWO_LEVEL : (item.grade ?? 1)
}

export interface WaresFilter {
  slot?: EquipmentSlot
  family?: FamilyId
}

/** What the post sells, narrowed by `filter`: by tier, then grade, then `FAMILIES` order. */
export function wares(world: WorldState, filter: WaresFilter = {}): Item[] {
  const listed: Item[] = []
  for (const tier of [1, 2]) {
    for (const grade of GRADES) {
      for (const base of BASE_ITEMS) {
        if (base.tier !== tier) continue
        if (filter.slot && base.slot !== filter.slot) continue
        if (filter.family && base.family !== filter.family) continue
        const item = craftedItem(base, grade)
        if (sells(world, item)) listed.push(item)
      }
    }
  }
  return listed
}

/** Why `itemId` cannot be bought now, or null when it can. */
export function buyRefusal(game: GameState, itemId: string): string | null {
  const { world } = game
  if (!atEncampment(world, leader(game))) return notHere(world)
  const item = itemById(itemId)
  const price = item && !item.mod && !item.runes?.length ? buyPrice(item) : null
  if (!item || price === null) return 'The trading post does not sell that.'
  if (!sells(world, item)) return `A level ${sellingLevel(item)} trading post sells that.`
  if ((world.stock.gold ?? 0) < price) return `It costs ${price} gold, more than the stock holds.`
  return null
}

/** Buys `itemId` into the baggage for gold. */
export function buy(game: GameState, itemId: string): string | null {
  const refusal = buyRefusal(game, itemId)
  if (refusal) return refusal
  const item = itemById(itemId)!
  spend(game.world.stock, { gold: buyPrice(item)! })
  leader(game).baggage.push(item)
  return null
}

/** What the post would buy: everything in the backpacks and the baggage, never what is worn. */
export function sellables(game: GameState): Array<{ place: ItemPlace; item: Item; price: number }> {
  return allPlaces(game, false).map(({ place, item }) => ({ place, item, price: salePrice(item) }))
}

/** Sells the item at `place` for gold. A worn item is refused: take it off first. */
export function sell(game: GameState, place: ItemPlace): string | null {
  const { world } = game
  if (!atEncampment(world, leader(game))) return notHere(world)
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
  if (!atEncampment(world, leader(game))) return notHere(world)
  if (material === 'gold') return 'Gold is what the post pays in.'
  if (!Number.isInteger(amount) || amount < MATERIALS_PER_GOLD || amount % MATERIALS_PER_GOLD !== 0) {
    return `The post buys ${material} in lots of ${MATERIALS_PER_GOLD}.`
  }
  if ((world.stock[material] ?? 0) < amount) return `The stock holds only ${world.stock[material] ?? 0} ${material}.`
  spend(world.stock, { [material]: amount })
  world.stock.gold = (world.stock.gold ?? 0) + amount / MATERIALS_PER_GOLD
  return null
}

/** What a rune is worth by rank, any kind. */
export const RUNE_PRICES: Record<Rank, number> = { 1: 15, 2: 45, 3: 135, 4: 405 }

/** The kinds the post sells; the rest come only from loot and fusing. */
export const SHOP_RUNES: readonly RuneId[] = ['ember', 'rime', 'storm', 'stone', 'wind', 'life']

/** The post level that sells each rank. */
export const RUNE_RANK_LEVELS: Partial<Record<Rank, number>> = { 1: 2, 2: 4 }

export function runePrice(key: RuneKey): number {
  return RUNE_PRICES[parseRuneKey(key)!.rank]
}

/** What the post pays for a rune from the pouch: a third of its price, rounded down. */
export function runeSalePrice(key: RuneKey): number {
  return Math.floor(runePrice(key) / 3)
}

/** The runes the post sells at its level: the shop kinds at rank 1 from level 2, then rank 2 from level 4. */
export function runeWares(world: WorldState): RuneKey[] {
  const listed: RuneKey[] = []
  for (const rank of [1, 2] as const) {
    if (world.tradingPost < RUNE_RANK_LEVELS[rank]!) continue
    for (const id of SHOP_RUNES) listed.push(`${id}${rank}`)
  }
  return listed
}

/** Why `key` cannot be bought now, or null when it can. */
export function buyRuneRefusal(game: GameState, key: RuneKey): string | null {
  const { world } = game
  if (!atEncampment(world, leader(game))) return notHere(world)
  const parsed = parseRuneKey(key)
  const level = parsed && SHOP_RUNES.includes(parsed.id) ? RUNE_RANK_LEVELS[parsed.rank] : undefined
  if (!parsed || level === undefined) return 'The trading post does not sell that.'
  if (world.tradingPost < level) return `A level ${level} trading post sells that.`
  const price = runePrice(key)
  if ((world.stock.gold ?? 0) < price) return `It costs ${price} gold, more than the stock holds.`
  return null
}

/** Buys one rune into the pouch for gold. */
export function buyRune(game: GameState, key: RuneKey): string | null {
  const refusal = buyRuneRefusal(game, key)
  if (refusal) return refusal
  spend(game.world.stock, { gold: runePrice(key) })
  addToPouch(game.runes, key)
  return null
}

/** Sells one rune from the pouch. */
export function sellRune(game: GameState, key: RuneKey): string | null {
  const { world } = game
  if (!atEncampment(world, leader(game))) return notHere(world)
  if (pouchCount(game.runes, key) < 1) return `The pouch holds no ${runeName(key)}.`
  takeFromPouch(game.runes, key)
  world.stock.gold = (world.stock.gold ?? 0) + runeSalePrice(key)
  return null
}
