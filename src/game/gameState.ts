import { createWarrior, type Character } from '../character/character.ts'
import { newWorld, type WorldState } from './worldMap.ts'

/**
 * Everything that persists across scenes for one playthrough. Created by the
 * menu on "New" and handed to scenes via scene data — never a module global.
 */
export interface GameState {
  player: Character
  world: WorldState
}

export function newGame(): GameState {
  return { player: createWarrior(), world: newWorld() }
}
