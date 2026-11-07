import { describe, expect, it } from 'vitest'
import { newGame } from '../game/gameState.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { battleSeed, chooseBattle, foundNames } from './battleSetup.ts'

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

describe('battleSeed', () => {
  const stats = {
    name: 'Fighter', maxHp: 10, ac: 10, toHit: 50, critChance: 5,
    damage: { count: 1, sides: 4, bonus: 0 }, attackApCost: 4, attackRange: 1, actionPoints: 8,
  }
  const setup = {
    board: { cols: 6, rows: 3 },
    units: [
      { id: 'a', side: 'player' as const, stats, position: { q: 0, r: 0 } },
      { id: 'b', side: 'enemy' as const, stats, position: { q: 3, r: 0 } },
    ],
  }

  it('is the seed battle_start recorded, kept in a restored engine', () => {
    const engine = new BattleEngine(setup , { seed: 1234 })
    expect(battleSeed(engine.getLog())).toBe(1234)
    expect(battleSeed(BattleEngine.restore(engine.snapshot()).getLog())).toBe(1234)
  })

  it('is null for a battle with no seed, or no log', () => {
    expect(battleSeed(new BattleEngine(setup , { rng: () => 0.5 }).getLog())).toBeNull()
    expect(battleSeed([])).toBeNull()
  })
})

describe('foundNames', () => {
  it('lists the items and then the runes, and nothing when nothing was found', () => {
    expect(foundNames([{ name: 'Iron Sword' }], ['ember1', 'storm2'])).toEqual(['Iron Sword', 'Lesser Ember Rune', 'Storm Rune'])
    expect(foundNames([], [])).toEqual([])
  })
})
