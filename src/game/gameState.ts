import type { Item } from '../inventory/inventory.ts'
import { STARTING_PARTY_LIMIT, readyMadeParty, type Party } from './party.ts'
import type { SlotId } from './saveSlots.ts'
import { newWorld, type MonsterLocation, type WorldState } from './worldMap.ts'

/**
 * Everything that persists across scenes for one playthrough, and what a save
 * slot holds (save.ts). Created by the party screen on Begin, or read from a
 * slot, and handed to scenes via scene data, never a module global.
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
  /** The most members the party may have. Nothing raises it yet. */
  partyLimit: number
  /** The save slot the playthrough lives in. A game with none is never saved: the simulator's, a test's. */
  slot: SlotId | null
}

/** A game at its start: the given party, the ready-made one by default, at home on a new world. */
export function newGame(party: Party = readyMadeParty(), slot: SlotId | null = null): GameState {
  return { party, world: newWorld(), baggage: [], partyLimit: STARTING_PARTY_LIMIT, slot }
}

/** Moves the loot of a beaten monster location into the baggage, and returns what was found. */
export function takeLoot(game: GameState, location: MonsterLocation): Item[] {
  const found = location.loot.splice(0)
  game.baggage.push(...found)
  return found
}
