import type { Character } from '../character/character.ts'
import type { Item } from '../inventory/inventory.ts'
import type { Pouch } from '../inventory/runes.ts'
import { newStoryState, type StoryState } from '../story/story.ts'
import { newExpedition, type Expedition } from './expedition.ts'
import { readyMadeParty, type Party } from './party.ts'
import type { SlotId } from './saveSlots.ts'
import { encampment, newWorld, type MonsterLocation, type WorldState } from './worldMap.ts'

/**
 * Everything that persists across scenes for one playthrough, and what a save
 * slot holds (save.ts). Created by the party screen on Begin, or read from a
 * slot, and handed to scenes via scene data, never a module global.
 */
export interface GameState {
  /**
   * The company's parties in order (expedition.ts); never empty while the
   * game lasts, and one today. Each holds its members, where it stands, the
   * monsters it faces, and its baggage, the
   * shared pile of items that travels with it: loot goes into it, and on the
   * world map members take from it and put into it, which is how an item
   * passes from one to another.
   */
  parties: Expedition[]
  world: WorldState
  /** The party's rune pouch (runes.ts): runes found, bought and fused, waiting to be embedded or sold. */
  runes: Pouch
  /**
   * The heroes waiting at the guild hall, not in the party (guildHall.ts).
   * The party's limit is the hall's level's (`partyLimit`), not stored.
   */
  reserves: Character[]
  /** The save slot the playthrough lives in. A game with none is never saved: the simulator's, a test's. */
  slot: SlotId | null
  /** The cutscenes played and the tutorial's progress (story.ts). */
  story: StoryState
}

/**
 * A game at its start: the given party, the ready-made one by default, at home
 * on a new world, of `seed` (random by default), in the encampment the player
 * named (Oakvale by default), with the tutorial on if the player ticked it
 * (off by default, as for the simulator and the tests).
 */
export function newGame(
  party: Party = readyMadeParty(),
  slot: SlotId | null = null,
  seed?: number,
  encampmentName?: string,
  tutorial = false,
): GameState {
  const world = newWorld(seed, encampmentName)
  return { parties: [newExpedition(party, encampment(world).position)], world, runes: {}, reserves: [], slot, story: newStoryState(tutorial) }
}

/** The first party: a stopgap while the readers move to explicit parties (stage 5 step 05 removes it). */
export function leader(game: GameState): Expedition {
  return game.parties[0]
}

export function partyById(game: GameState, id: string): Expedition | undefined {
  return game.parties.find((party) => party.id === id)
}

/** Moves the loot of a beaten monster location into the baggage, and returns what was found. */
export function takeLoot(game: GameState, location: MonsterLocation): Item[] {
  const found = location.loot.splice(0)
  leader(game).baggage.push(...found)
  return found
}
