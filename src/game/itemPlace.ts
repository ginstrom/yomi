import type { EquipmentSlot, Item } from '../inventory/inventory.ts'
import type { GameState } from './gameState.ts'

/**
 * Where an item the trading post or crafting acts on lies: the baggage, a
 * party member's equipment or a backpack, named with the item expected
 * there. A place that no longer holds an item of that id is stale, and the
 * action is refused rather than done to whatever moved into it.
 */
export type ItemPlace =
  | { from: 'baggage'; index: number; itemId: string }
  | { from: 'worn'; member: number; slot: EquipmentSlot; itemId: string }
  | { from: 'backpack'; member: number; index: number; itemId: string }

/** A short name for a place, which the screens and their probes tell lines apart by: `baggage:0`, `pack:1:3`, `worn:0:mainHand`. */
export function placeKey(place: ItemPlace): string {
  if (place.from === 'baggage') return `baggage:${place.index}`
  return place.from === 'backpack' ? `pack:${place.member}:${place.index}` : `worn:${place.member}:${place.slot}`
}

export const STALE = 'That item is no longer there.'

/** The item at `place`, or null when the place is stale. */
export function itemAt(game: GameState, place: ItemPlace): Item | null {
  const item = lookUp(game, place)
  return item && item.id === place.itemId ? item : null
}

function lookUp(game: GameState, place: ItemPlace): Item | null {
  if (place.from === 'baggage') return game.baggage[place.index] ?? null
  const member = game.party[place.member]
  if (!member) return null
  return (place.from === 'worn' ? member.equipment[place.slot] : member.backpack[place.index]) ?? null
}

/** Puts `item` at `place` in place of what is there, which `itemAt` must have found. */
export function replaceAt(game: GameState, place: ItemPlace, item: Item): void {
  if (place.from === 'baggage') game.baggage[place.index] = item
  else if (place.from === 'worn') game.party[place.member].equipment[place.slot] = item
  else game.party[place.member].backpack[place.index] = item
}

/** Takes the item at `place` away: out of the baggage, or leaving its slot empty. */
export function removeAt(game: GameState, place: ItemPlace): void {
  if (place.from === 'baggage') game.baggage.splice(place.index, 1)
  else if (place.from === 'worn') delete game.party[place.member].equipment[place.slot]
  else game.party[place.member].backpack[place.index] = null
}

/** Every item the party has, member by member (worn, then carried), then the baggage's, each with its place. */
export function allPlaces(game: GameState, worn = true): Array<{ place: ItemPlace; item: Item }> {
  const found: Array<{ place: ItemPlace; item: Item }> = []
  game.party.forEach((member, m) => {
    if (worn) {
      for (const [slot, item] of Object.entries(member.equipment) as [EquipmentSlot, Item][]) {
        found.push({ place: { from: 'worn', member: m, slot, itemId: item.id }, item })
      }
    }
    member.backpack.forEach((item, index) => {
      if (item) found.push({ place: { from: 'backpack', member: m, index, itemId: item.id }, item })
    })
  })
  game.baggage.forEach((item, index) => found.push({ place: { from: 'baggage', index, itemId: item.id }, item }))
  return found
}
