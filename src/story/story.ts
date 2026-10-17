import type { WorldEvent } from '../game/blight.ts'
import type { EncounterId } from '../game/encounters.ts'
import type { GameState } from '../game/gameState.ts'
import { encampmentName } from '../game/worldMap.ts'
import { CUTSCENE_IDS, CUTSCENES, type Cutscene, type CutsceneId } from './cutscenes.ts'
import { TUTORIAL } from './tutorial.ts'

/**
 * The story's side of the game: the moments at which a cutscene or a
 * tutorial tip may show, what a game remembers of them, and the choice of
 * what shows at a moment (`storyFor`). Phaser-free; the scenes raise the
 * moments and StoryScene shows what comes of them. Nothing here changes the
 * rules: the simulator never raises a moment.
 */

/**
 * The moments a scene tells the story of, as they happen. A new kind needs a
 * case here and a scene that raises it (`tellStory` in StoryScene.ts).
 */
export type StoryMoment =
  /** The world map opens: a new game, a battle won, a load, the encampment left. */
  | { kind: 'world_opened' }
  /** Time passed on the world map (a journey, scouting, waiting, camping, building), with what it brought. */
  | { kind: 'world_turn'; events: WorldEvent[] }
  /** The player's turn begins in battle, the first included; not again for a turn taken up from a save. */
  | { kind: 'battle_turn'; round: number; encounter: EncounterId; threat: number }
  /** The encampment's screen opens. */
  | { kind: 'encampment_opened' }

/** What a game remembers of its story, saved with it. */
export interface StoryState {
  /** The cutscenes played, each once unless it repeats. */
  played: CutsceneId[]
  /** Whether tutorial tips show: chosen on the party screen, changed from the menu's options or a tip. */
  tutorial: boolean
  /** The tips shown, which never show again; kept while the tutorial is off, so turning it back on goes on from there. */
  tipsShown: string[]
}

export function newStoryState(tutorial = false): StoryState {
  return { played: [], tutorial, tipsShown: [] }
}

/** One thing to show: a cutscene, or a tip (by its id in `TUTORIAL`). */
export type StoryItem = { kind: 'cutscene'; id: CutsceneId } | { kind: 'tip'; id: string }

/**
 * What shows at this moment, in order: the cutscenes whose time it is, in
 * `CUTSCENES`' order, then, with the tutorial on, the tips whose time it is,
 * in `TUTORIAL`'s. Marks each played or shown as it is chosen, so the caller
 * shows the list once and saves the game after.
 */
export function storyFor(game: GameState, moment: StoryMoment): StoryItem[] {
  const { story } = game
  const items: StoryItem[] = []
  for (const id of CUTSCENE_IDS) {
    const scene: Cutscene = CUTSCENES[id]
    if (story.played.includes(id) && !scene.repeats) continue
    if (!scene.when(moment, game)) continue
    if (!story.played.includes(id)) story.played.push(id)
    items.push({ kind: 'cutscene', id })
  }
  if (!story.tutorial) return items
  for (const tip of TUTORIAL) {
    if (story.tipsShown.includes(tip.id)) continue
    if (tip.after !== undefined && !story.tipsShown.includes(tip.after)) continue
    if (!tip.when(moment, game)) continue
    story.tipsShown.push(tip.id)
    items.push({ kind: 'tip', id: tip.id })
  }
  return items
}

/** Turns the tutorial on or off; the tips already shown stay shown. */
export function setTutorial(game: GameState, on: boolean): void {
  game.story.tutorial = on
}

/** A cutscene's or a tip's text with the game's names put in: `{encampment}` and `{leader}`, the party's first member. */
export function fillText(text: string, game: GameState): string {
  return text.replaceAll('{encampment}', encampmentName(game.world)).replaceAll('{leader}', game.party[0]?.name ?? 'The leader')
}
