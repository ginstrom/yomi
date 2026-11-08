import { clampHp, maxHp, type Character } from '../character/character.ts'
import type { EquipmentSlot, Item } from '../inventory/inventory.ts'
import { leader, type GameState } from './gameState.ts'

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
  if (place.from === 'baggage') return leader(game).baggage[place.index] ?? null
  const member = leader(game).members[place.member]
  if (!member) return null
  return (place.from === 'worn' ? member.equipment[place.slot] : member.backpack[place.index]) ?? null
}

/**
 * Puts `item` at `place` in place of what is there, which `itemAt` must have
 * found. A worn change keeps the wearer's hit points within its maximum
 * (`clampHp`), as a Life rune may move it.
 */
export function replaceAt(game: GameState, place: ItemPlace, item: Item): void {
  if (place.from === 'baggage') leader(game).baggage[place.index] = item
  else if (place.from === 'worn') changeWorn(game, place.member, (member) => (member.equipment[place.slot] = item))
  else leader(game).members[place.member].backpack[place.index] = item
}

/** Takes the item at `place` away: out of the baggage, or leaving its slot empty (the wearer's hit points kept within its maximum). */
export function removeAt(game: GameState, place: ItemPlace): void {
  if (place.from === 'baggage') leader(game).baggage.splice(place.index, 1)
  else if (place.from === 'worn') changeWorn(game, place.member, (member) => delete member.equipment[place.slot])
  else leader(game).members[place.member].backpack[place.index] = null
}

/** Changes what member `m` wears, then clamps its hit points against the maximum read before. */
function changeWorn(game: GameState, m: number, change: (member: Character) => void): void {
  const member = leader(game).members[m]
  const before = maxHp(member)
  change(member)
  clampHp(member, before)
}

/** Every item the party has, member by member (worn, then carried), then the baggage's, each with its place. */
export function allPlaces(game: GameState, worn = true): Array<{ place: ItemPlace; item: Item }> {
  const found: Array<{ place: ItemPlace; item: Item }> = []
  leader(game).members.forEach((member, m) => {
    if (worn) {
      for (const [slot, item] of Object.entries(member.equipment) as [EquipmentSlot, Item][]) {
        found.push({ place: { from: 'worn', member: m, slot, itemId: item.id }, item })
      }
    }
    member.backpack.forEach((item, index) => {
      if (item) found.push({ place: { from: 'backpack', member: m, index, itemId: item.id }, item })
    })
  })
  leader(game).baggage.forEach((item, index) => found.push({ place: { from: 'baggage', index, itemId: item.id }, item }))
  return found
}
