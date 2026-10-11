import { hexKey, type Hex } from '../grid/hex.ts'
import type { Item } from '../inventory/inventory.ts'

/** The items lying on one hex, oldest first. */
export interface GroundPile {
  hex: Hex
  items: Item[]
}

/**
 * Loose items lying on a battlefield, hex by hex. A unit reaches only the pile
 * on its own hex: the inventory drops onto it and picks up from it directly
 * (see dropFromBackpack() and pickUp() in character.ts).
 */
export class Ground {
  private readonly byHex = new Map<string, GroundPile>()

  /** The pile on a hex, empty if nothing lies there. Callers add to it and take from it in place. */
  pileAt(hex: Hex): Item[] {
    const key = hexKey(hex)
    let pile = this.byHex.get(key)
    if (!pile) {
      pile = { hex, items: [] }
      this.byHex.set(key, pile)
    }
    return pile.items
  }

  /** Every hex with something lying on it. */
  piles(): GroundPile[] {
    return [...this.byHex.values()].filter((pile) => pile.items.length > 0)
  }
}

/**
 * What changed between two states of a pile: the items it gained and the ones
 * it lost, each in the order the later (or earlier) pile holds them. An item
 * dropped and picked up again is neither.
 */
export function pileChanges(before: readonly Item[], after: readonly Item[]): { dropped: Item[]; pickedUp: Item[] } {
  // Counted by id rather than identity: two of the same item are the same object.
  const missingFrom = (items: readonly Item[], others: readonly Item[]): Item[] => {
    const spare = new Map<string, number>()
    for (const { id } of others) spare.set(id, (spare.get(id) ?? 0) + 1)
    return items.filter(({ id }) => {
      const left = spare.get(id) ?? 0
      spare.set(id, left - 1)
      return left <= 0
    })
  }
  return { dropped: missingFrom(after, before), pickedUp: missingFrom(before, after) }
}
