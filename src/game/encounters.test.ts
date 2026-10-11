import { describe, expect, it } from 'vitest'
import { createWarrior, deriveCombatStats } from '../character/character.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { ENCOUNTERS, HERO_ID, goblinRaid } from './encounters.ts'

describe.each(Object.entries(ENCOUNTERS))('the %s encounter', (_id, build) => {
  const encounter = build(deriveCombatStats(createWarrior()), 5)

  it('gives every unit a kind to draw it by, and no others', () => {
    expect(Object.keys(encounter.kinds).sort()).toEqual(encounter.setup.units.map((u) => u.id).sort())
  })

  it('sets the hero, at the hit points given, against foes on the board', () => {
    const state = new BattleEngine(encounter.setup).getState()
    const hero = state.units.find((u) => u.id === HERO_ID)!
    expect([hero.side, hero.hp]).toEqual(['player', 5])
    expect(state.units.filter((u) => u.side === 'enemy').length).toBeGreaterThan(0)
    expect(new Set(state.units.map((u) => `${u.position.q},${u.position.r}`)).size).toBe(state.units.length)
  })
})

describe('goblinRaid', () => {
  const encounter = goblinRaid(deriveCombatStats(createWarrior()))

  it('pits the hero against a Goblin and a Kobold', () => {
    const state = new BattleEngine(encounter.setup).getState()
    expect(state.units.map((u) => [u.id, u.side, u.name])).toEqual([
      [HERO_ID, 'player', expect.any(String)],
      ['goblin', 'enemy', 'Goblin'],
      ['kobold', 'enemy', 'Kobold'],
    ])
  })
})
