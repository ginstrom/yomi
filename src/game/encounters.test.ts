import { describe, expect, it } from 'vitest'
import { createWarrior, deriveCombatStats } from '../character/character.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { HERO_ID, goblinRaid } from './encounters.ts'

describe('goblinRaid', () => {
  const encounter = goblinRaid(deriveCombatStats(createWarrior()))

  it('gives every unit a kind to draw it by, and no others', () => {
    expect(Object.keys(encounter.kinds).sort()).toEqual(encounter.setup.units.map((u) => u.id).sort())
  })

  it('pits the hero against a Goblin and a Kobold', () => {
    const state = new BattleEngine(encounter.setup).getState()
    expect(state.units.map((u) => [u.id, u.side, u.name])).toEqual([
      [HERO_ID, 'player', expect.any(String)],
      ['goblin', 'enemy', 'Goblin'],
      ['kobold', 'enemy', 'Kobold'],
    ])
  })
})
