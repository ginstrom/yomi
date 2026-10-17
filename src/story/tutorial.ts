import type { GameState } from '../game/gameState.ts'
import type { StoryMoment } from './story.ts'

/**
 * The tutorial: tips that show, each once, at the moments that call for
 * them, while the game's tutorial is on (`StoryState.tutorial`). The script
 * is the order of `TUTORIAL` and each tip's `after`: a tip waits until the
 * one it names has shown, so a lesson can be laid out step by step and each
 * step still waits for its moment. Writing one is adding an entry here.
 *
 * The tips here are placeholders, to show the machinery working.
 */

/**
 * The controls a tip may point at, each named for its scene. The scene that
 * shows a tip says where on screen each of its own is (its `anchors()`), so
 * a new anchor needs a name here and a place there.
 */
export type TutorialAnchor =
  | 'world.party'
  | 'world.camp'
  | 'world.attack'
  | 'world.enterEncampment'
  | 'battle.party'
  | 'battle.endTurn'
  | 'battle.cast'
  | 'encampment.leave'

export interface TutorialTip {
  id: string
  title: string
  /** Templated as a cutscene's text is (`fillText`). */
  text: string
  /** Whether it shows at this moment of this game; asked only while it has not shown. */
  when: (moment: StoryMoment, game: GameState) => boolean
  /** The tip that must have shown first, at an earlier moment or earlier in the same one. */
  after?: string
  /** The control it points at, if it is shown on screen just then. */
  anchor?: TutorialAnchor
}

export const TUTORIAL: TutorialTip[] = [
  {
    id: 'world_travel',
    title: 'Travelling',
    text: '[Placeholder] How to travel the world map. Click a hex to walk there; each hex is a day.',
    when: (moment) => moment.kind === 'world_opened',
  },
  {
    id: 'world_party',
    title: 'Your party',
    text: '[Placeholder] What the portraits at the left are, and how to open a hero\'s panel.',
    when: (moment) => moment.kind === 'world_opened',
    after: 'world_travel',
    anchor: 'world.party',
  },
  {
    id: 'world_monsters',
    title: 'Monsters',
    text: '[Placeholder] What to do when the party comes upon monsters.',
    when: (moment, game) => moment.kind === 'world_turn' && game.world.confronting !== null,
    anchor: 'world.attack',
  },
  {
    id: 'battle_start',
    title: 'Battle',
    text: '[Placeholder] How a battle is fought: select a hero, move, attack.',
    when: (moment) => moment.kind === 'battle_turn' && moment.round === 1,
    anchor: 'battle.party',
  },
  {
    id: 'battle_end_turn',
    title: 'Ending the turn',
    text: '[Placeholder] When the heroes have done what they can, end the turn.',
    when: (moment) => moment.kind === 'battle_turn' && moment.round >= 2,
    after: 'battle_start',
    anchor: 'battle.endTurn',
  },
  {
    id: 'encampment',
    title: '{encampment}',
    text: '[Placeholder] What the encampment\'s facilities are for.',
    when: (moment) => moment.kind === 'encampment_opened',
    anchor: 'encampment.leave',
  },
]

export const tutorialTip = (id: string): TutorialTip | undefined => TUTORIAL.find((tip) => tip.id === id)
