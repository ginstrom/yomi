import type { PortraitId } from '../character/portraits.ts'
import type { GameState } from '../game/gameState.ts'
import type { StoryMoment } from './story.ts'

/**
 * The cutscenes: scripted scenes of words and pictures that play over the
 * game at the moments the story calls for (story.ts picks them, and
 * StoryScene shows them). A cutscene is data: when it plays and its beats.
 * Writing one is adding an entry to `CUTSCENES`; nothing else needs to know.
 *
 * The ones here are placeholders, to show the machinery working.
 */

/**
 * One beat: a line of the scene, shown until the player clicks on. Text may
 * name the game's own things with `{encampment}` and `{leader}` (the first
 * of the party), which `fillText` puts in.
 */
export interface CutsceneBeat {
  text: string
  /** Who says it, shown over the text; none for narration. Templated as the text is. */
  speaker?: string
  /** The face shown beside the text: a preset portrait, or 'leader' for the party's first member's. */
  portrait?: PortraitId | 'leader'
  /**
   * A picture behind the beat, kept until a later beat names another: the
   * name of `public/assets/cutscenes/<backdrop>.png`, which StoryScene loads
   * when the cutscene plays. Without one, the game under the scene shows dimmed.
   */
  backdrop?: string
}

export interface Cutscene {
  /**
   * Whether it plays at this moment of this game. It is asked only of a
   * cutscene that has not played yet in the game, unless it `repeats`.
   */
  when: (moment: StoryMoment, game: GameState) => boolean
  /** Plays every time `when` holds, not only the first. */
  repeats?: true
  beats: CutsceneBeat[]
}

export const CUTSCENES = {
  /** The game's first sight of the world map, as it begins: a cutscene plays once, so the first time is the only one. */
  intro: {
    when: (moment) => moment.kind === 'world_opened',
    beats: [
      { text: '[Placeholder] The opening of the story goes here.' },
      { speaker: '{leader}', portrait: 'leader', text: '[Placeholder] {encampment} is ours to defend. A line spoken by the party\'s leader.' },
    ],
  },
  /** The Source is found. */
  source_sighted: {
    when: (moment) => moment.kind === 'world_turn' && moment.events.some((event) => event.type === 'sighted' && event.source),
    beats: [{ text: '[Placeholder] The Source of the blight comes into sight.' }],
  },
} satisfies Record<string, Cutscene>

export type CutsceneId = keyof typeof CUTSCENES
export const CUTSCENE_IDS = Object.keys(CUTSCENES) as CutsceneId[]

export const cutscene = (id: CutsceneId): Cutscene => CUTSCENES[id]
