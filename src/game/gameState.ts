import type { Item } from '../inventory/inventory.ts'
import { newParty, type Party } from './party.ts'
import { newWorld, type MonsterLocation, type WorldState } from './worldMap.ts'

/**
 * Everything that persists across scenes for one playthrough. Created by the
 * menu on "New" and handed to scenes via scene data — never a module global.
 */
export interface GameState {
  party: Party
  world: WorldState
  /**
   * The party's shared pile of items, with no limit, that travels with it:
   * loot goes into it, and on the world map members take from it and put
   * into it, which is how an item passes from one to another.
   */
  baggage: Item[]
}

export function newGame(): GameState {
  return { party: newParty(), world: newWorld(), baggage: [] }
}

/** Moves the loot of a beaten monster location into the baggage, and returns what was found. */
export function takeLoot(game: GameState, location: MonsterLocation): Item[] {
  const found = location.loot.splice(0)
  game.baggage.push(...found)
  return found
}
