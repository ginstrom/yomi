import { describe, expect, it } from 'vitest'
import { createWarrior, deriveCombatStats } from '../character/character.ts'
import { LEVEL_UP_HP, xpToNextLevel } from '../character/progression.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { ENCOUNTERS } from './encounters.ts'
import {
  MAX_PARTY_SIZE,
  REVIVED_HP,
  describeRewards,
  joinParty,
  newParty,
  partyFighters,
  rewardVictory,
} from './party.ts'

describe('newParty', () => {
  it('starts with three level 1 fighters, each with a name of its own', () => {
    const party = newParty()
    expect(party.map((m) => [m.level, m.className])).toEqual(Array(3).fill([1, 'Fighter']))
    expect(new Set(party.map((m) => m.name)).size).toBe(3)
  })

  it('gives each member its own gear', () => {
    const [a, b] = newParty()
    a.backpack[0] = null
    delete a.equipment.offHand
    expect(b.backpack[0]).not.toBeNull()
    expect(b.equipment.offHand).toBeDefined()
  })
})

describe('joinParty', () => {
  it('takes members up to the limit and no further', () => {
    const party = newParty()
    while (party.length < MAX_PARTY_SIZE) expect(joinParty(party, createWarrior())).toBe(true)
    expect(joinParty(party, createWarrior())).toBe(false)
    expect(party).toHaveLength(MAX_PARTY_SIZE)
  })
})

describe('partyFighters', () => {
  it('gives each member its stats and the hit points it has left, in party order', () => {
    const party = newParty()
    party[1].hp = 7
    expect(partyFighters(party)).toEqual(party.map((m) => ({ stats: deriveCombatStats(m), hp: m.hp })))
    expect(partyFighters(party)[1].hp).toBe(7)
  })

  it('fits a full party into every encounter', () => {
    const party = newParty()
    while (joinParty(party, createWarrior()));
    for (const build of Object.values(ENCOUNTERS)) {
      const state = new BattleEngine(build(partyFighters(party)).setup).getState()
      expect(state.units.filter((u) => u.side === 'player')).toHaveLength(MAX_PARTY_SIZE)
    }
  })
})

describe('rewardVictory', () => {
  it('gives every member the whole reward', () => {
    const party = newParty()
    const rewards = rewardVictory(party, 50)
    expect(party.map((m) => m.xp)).toEqual([50, 50, 50])
    expect(rewards.map((r) => [r.member, r.gain.xp, r.revived])).toEqual(party.map((m) => [m, 50, false]))
  })

  it('stands a fallen member back up, barely', () => {
    const party = newParty()
    party[2].hp = 0
    const rewards = rewardVictory(party, 10)
    expect(party[2].hp).toBe(REVIVED_HP)
    expect(rewards.map((r) => r.revived)).toEqual([false, false, true])
  })

  it('heals a fallen member whom the reward levels up', () => {
    const party = newParty()
    party[0].hp = 0
    const [reward] = rewardVictory(party, xpToNextLevel(1))
    expect(party[0].hp).toBe(party[0].base.maxHp)
    expect(reward.revived).toBe(false)
  })
})

describe('describeRewards', () => {
  it('shows only the experience when it changed nobody', () => {
    expect(describeRewards(rewardVictory(newParty(), 50))).toEqual(['+50 XP each'])
    expect(describeRewards(rewardVictory([createWarrior()], 50))).toEqual(['+50 XP'])
  })

  it('announces each new level and what it brought, and who got back up', () => {
    const party = [createWarrior('Aldric'), createWarrior('Brenna'), createWarrior('Corwin')]
    party[1].level = 3
    party[1].hp = 0
    expect(describeRewards(rewardVictory(party, xpToNextLevel(1)))).toEqual([
      `+${xpToNextLevel(1)} XP each`,
      `Aldric reaches level 2: +${LEVEL_UP_HP} max HP, +5% to hit, wounds healed`,
      'Brenna gets back up, badly hurt',
      `Corwin reaches level 2: +${LEVEL_UP_HP} max HP, +5% to hit, wounds healed`,
    ])
  })
})
