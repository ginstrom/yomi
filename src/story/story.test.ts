import { describe, expect, it } from 'vitest'
import { PORTRAIT_IDS } from '../character/portraits.ts'
import { newGame } from '../game/gameState.ts'
import { parseSave, serializeSave } from '../game/save.ts'
import { CUTSCENES } from './cutscenes.ts'
import { fillText, setTutorial, storyFor, type StoryMoment } from './story.ts'
import { TUTORIAL } from './tutorial.ts'

const opened: StoryMoment = { kind: 'world_opened' }
const battleTurn = (round: number): StoryMoment => ({ kind: 'battle_turn', round, encounter: 'goblin_raid', threat: 1 })

describe('storyFor', () => {
  it('plays a cutscene once, the first time its moment comes', () => {
    const game = newGame(undefined, null, 1)
    expect(storyFor(game, opened)).toEqual([{ kind: 'cutscene', id: 'intro' }])
    expect(game.story.played).toEqual(['intro'])
    expect(storyFor(game, opened)).toEqual([])
  })

  it('plays nothing whose moment has not come', () => {
    const game = newGame(undefined, null, 1)
    expect(storyFor(game, { kind: 'world_turn', events: [] })).toEqual([])
    expect(storyFor(game, battleTurn(1))).toEqual([])
  })

  it('plays the Source\'s cutscene when a turn brings it into sight', () => {
    const game = newGame(undefined, null, 1)
    const sighted = { type: 'sighted', location: 'source', name: 'The Source', at: { q: 0, r: 0 }, threat: 5, source: true } as const
    expect(storyFor(game, { kind: 'world_turn', events: [sighted] })).toEqual([{ kind: 'cutscene', id: 'source_sighted' }])
  })

  it('shows no tips while the tutorial is off, and goes on from where it was once it is on', () => {
    const game = newGame(undefined, null, 1)
    game.story.played = ['intro']
    expect(storyFor(game, opened)).toEqual([])
    setTutorial(game, true)
    expect(storyFor(game, opened)).toEqual([
      { kind: 'tip', id: 'world_travel' },
      { kind: 'tip', id: 'world_party' },
    ])
    setTutorial(game, false)
    setTutorial(game, true)
    expect(storyFor(game, opened)).toEqual([])
  })

  it('shows cutscenes before tips', () => {
    const game = newGame(undefined, null, 1, undefined, true)
    expect(storyFor(game, opened).map((item) => item.kind)).toEqual(['cutscene', 'tip', 'tip'])
  })

  it('holds a tip back until the one it follows has shown', () => {
    const game = newGame(undefined, null, 1, undefined, true)
    expect(storyFor(game, battleTurn(2))).toEqual([])
    expect(storyFor(game, battleTurn(1))).toEqual([{ kind: 'tip', id: 'battle_start' }])
    expect(storyFor(game, battleTurn(2))).toEqual([{ kind: 'tip', id: 'battle_end_turn' }])
  })
})

describe('fillText', () => {
  it('names the encampment and the party\'s leader', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    expect(fillText('{leader} of {encampment}', game)).toBe(`${game.party[0].name} of Hearthold`)
  })
})

describe('the story and the tutorial as written', () => {
  it('gives every tip an id of its own, and follows only tips that come before it', () => {
    const ids = TUTORIAL.map((tip) => tip.id)
    expect(new Set(ids).size).toBe(ids.length)
    TUTORIAL.forEach((tip, index) => {
      if (tip.after) expect(ids.slice(0, index)).toContain(tip.after)
    })
  })

  it('gives every cutscene a beat or more, each with a portrait the game has', () => {
    for (const scene of Object.values(CUTSCENES)) {
      expect(scene.beats.length).toBeGreaterThan(0)
      for (const beat of scene.beats as Array<{ portrait?: string }>) {
        if (beat.portrait) expect(['leader', ...PORTRAIT_IDS]).toContain(beat.portrait)
      }
    }
  })
})

describe('saving the story', () => {
  it('keeps what has played, what has shown and whether the tutorial is on', () => {
    const game = newGame(undefined, null, 1, undefined, true)
    storyFor(game, opened)
    const loaded = parseSave(serializeSave({ game, battle: null, savedAt: 1 }))
    expect(loaded?.game.story).toEqual(game.story)
  })

  it('reads a save naming a cutscene the game does not have as unreadable', () => {
    const game = newGame(undefined, null, 1)
    game.story.played = ['gone' as 'intro']
    expect(parseSave(serializeSave({ game, battle: null, savedAt: 1 }))).toBeNull()
  })
})
