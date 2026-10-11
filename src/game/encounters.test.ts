import { describe, expect, it } from 'vitest'
import { createWarrior, deriveCombatStats } from '../character/character.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { xpToNextLevel } from '../character/progression.ts'
import { ENCOUNTERS, FOE_XP, HERO_ID, goblinRaid, koboldScouts, xpReward } from './encounters.ts'

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

describe('xpReward', () => {
  const hero = deriveCombatStats(createWarrior())

  it('adds up what the foes are worth, and nothing for the hero', () => {
    expect(xpReward(goblinRaid(hero))).toBe(FOE_XP.goblin + FOE_XP.kobold)
    expect(xpReward(koboldScouts(hero))).toBe(2 * FOE_XP.kobold)
  })

  it('makes a lone Goblin, or any first battle, worth a new hero\'s second level', () => {
    expect(FOE_XP.goblin).toBeGreaterThanOrEqual(xpToNextLevel(1))
    for (const build of Object.values(ENCOUNTERS)) expect(xpReward(build(hero))).toBeGreaterThanOrEqual(xpToNextLevel(1))
  })
})
