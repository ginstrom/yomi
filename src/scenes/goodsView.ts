import { GOOD_PRICE, goodsForSale, type GoodOffer } from '../game/tradingPost.ts'
import { materialName } from '../game/territory.ts'
import type { WorldState } from '../game/worldMap.ts'

/**
 * The trading post's Goods filter in words, Phaser-free: the Market Hall's
 * rows ("Mithril, from Stonehollow") and the amounts Buy offers. The offers
 * and the price are tradingPost.ts's.
 */

/** The amounts the Buy buttons offer: the first is the `confirm` button, the second `confirmAll`. */
export const GOOD_AMOUNTS = [1, 5] as const

/** What the Goods list says when no partner trades with the post. */
export const NO_GOODS = 'No contacted partner trades here yet.'

/** A row of the Goods list. */
export interface GoodRow {
  /** `good:<partner>:<material>`. */
  id: string
  /** "Mithril, from Stonehollow: 3 gold a unit". */
  label: string
  material: GoodOffer['material']
  partner: string
}

/** "wyvern hide" as "Wyvern hide". */
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

export function goodRows(world: WorldState): GoodRow[] {
  return goodsForSale(world).map(({ partner, name, material }) => ({
    id: `good:${partner}:${material}`,
    label: `${capital(materialName(material))}, from ${name}: ${GOOD_PRICE} gold a unit`,
    material,
    partner,
  }))
}

/** "Buy 5 for 15 gold". */
export const buyLabel = (amount: number): string => `Buy ${amount} for ${GOOD_PRICE * amount} gold`
