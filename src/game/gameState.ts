import { createWarrior, type Character } from '../character/character.ts'

/**
 * Everything that persists across scenes for one playthrough. Created by the
 * menu on "New" and handed to scenes via scene data — never a module global.
 */
export interface GameState {
  player: Character
}

export function newGame(): GameState {
  return { player: createWarrior() }
}
