import { describe, expect, it } from 'vitest'
import { newGame } from '../game/gameState.ts'
import { chooseBattle } from './battleSetup.ts'

describe('chooseBattle', () => {
  const { world } = newGame(undefined, null, 7)
  const nest = world.locations.find((l) => l.kind === 'monsters' && l.id === 'bandit_camp')!
  if (nest.kind !== 'monsters') throw new Error('bandit_camp is a monster location')

  it('fights a monster location at its own encounter and threat, whatever else is asked', () => {
    expect(chooseBattle(world, { location: nest.id, encounter: 'troll_lair', threat: 5 })).toEqual({
      location: nest,
      encounter: 'bandit_camp',
      threat: 3,
    })
  })

  it('fights the encounter and threat asked for when no location is given', () => {
    expect(chooseBattle(world, { encounter: 'kobold_scouts', threat: 2 })).toEqual({
      location: null,
      encounter: 'kobold_scouts',
      threat: 2,
    })
  })

  it('takes no location from an id that names no monster location', () => {
    const quiet = world.locations.find((l) => l.kind !== 'monsters')!
    expect(chooseBattle(world, { location: quiet.id, encounter: 'kobold_scouts', threat: 2 }).location).toBeNull()
  })

  it('falls back to Goblin Raid at its default threat with nothing asked', () => {
    expect(chooseBattle(world, undefined)).toEqual({ location: null, encounter: 'goblin_raid', threat: undefined })
    expect(chooseBattle(world, {})).toEqual({ location: null, encounter: 'goblin_raid', threat: undefined })
  })
})
