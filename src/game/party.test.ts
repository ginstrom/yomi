import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_POINTS, MAX_ATTRIBUTE, MIN_ATTRIBUTE } from '../character/attributes.ts'
import { createWarrior, deriveCombatStats, hpPerLevel, maxHp, weaponSkill } from '../character/character.ts'
import { canAdvance, skillPointsPerLevel, xpToNextLevel } from '../character/progression.ts'
import { TAGGED_SKILLS } from '../character/skills.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { ENCOUNTERS } from './encounters.ts'
import {
  MAX_PARTY_SIZE,
  REVIVED_HP,
  describeRewards,
  firstAidHp,
  joinParty,
  newParty,
  partyFighters,
  rewardVictory,
} from './party.ts'

describe('newParty', () => {
  it('starts with three level 1 heroes, each with a name of its own', () => {
    const party = newParty()
    expect(party.map((m) => m.level)).toEqual([1, 1, 1])
    expect(new Set(party.map((m) => m.name)).size).toBe(3)
    expect(new Set(party.map((m) => m.portrait)).size).toBe(3)
  })

  it('makes each a different build of the same worth, hale and with nothing yet to spend', () => {
    const party = newParty()
    for (const member of party) {
      expect(Object.values(member.attributes).reduce((a, b) => a + b)).toBe(ATTRIBUTE_POINTS)
      for (const value of Object.values(member.attributes)) {
        expect(value).toBeGreaterThanOrEqual(MIN_ATTRIBUTE)
        expect(value).toBeLessThanOrEqual(MAX_ATTRIBUTE)
      }
      expect(new Set(member.tagged).size).toBe(TAGGED_SKILLS)
      expect(member.hp).toBe(maxHp(member))
      expect(canAdvance(member)).toBe(false)
      // Each holds a weapon it has a gift for.
      expect(member.tagged).toContain(weaponSkill(member.equipment.mainHand))
    }
    expect(new Set(party.map((m) => JSON.stringify(m.attributes))).size).toBe(3)
  })

  it('gives each member its own gear', () => {
    const [a, , c] = newParty()
    a.backpack[0] = null
    delete a.equipment.offHand
    expect(c.backpack[0]).not.toBeNull()
    expect(c.equipment.offHand).toBeDefined()
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

/** A party of warriors: no healer to speak of, and every member alike. */
const warriors = (...names: string[]) => names.map((name) => createWarrior(name))

describe('rewardVictory', () => {
  it('gives every member the whole reward', () => {
    const party = newParty()
    const { members } = rewardVictory(party, 50)
    expect(party.map((m) => m.xp)).toEqual([50, 50, 50])
    expect(members.map((r) => [r.member, r.gain.xp, r.revived])).toEqual(party.map((m) => [m, 50, false]))
  })

  it('stands a fallen member back up, barely, for the healer to tend', () => {
    const party = warriors('Aldric', 'Brenna', 'Corwin')
    party[2].hp = 0
    const { members } = rewardVictory(party, 10)
    expect(members.map((r) => r.revived)).toEqual([false, false, true])
    expect(party[2].hp).toBe(REVIVED_HP + firstAidHp(party[0]))
  })

  it('heals a fallen member whom the reward levels up', () => {
    const party = newParty()
    party[0].hp = 0
    const { members } = rewardVictory(party, xpToNextLevel(1))
    expect(party[0].hp).toBe(maxHp(party[0]))
    expect(members[0].revived).toBe(false)
  })

  it('has the best healer standing tend everyone, up to their full hit points', () => {
    const party = warriors('Aldric', 'Brenna', 'Corwin')
    party[1].trained.firstAid = 30
    party[1].perks.healer = 1
    // First Aid 56% and the Healer perk: 5 + 3.
    expect(firstAidHp(party[1])).toBe(8)
    party[0].hp = 10
    party[1].hp = 2
    party[2].hp = maxHp(party[2]) - 3
    const { members, healer } = rewardVictory(party, 10)
    expect(healer).toBe(party[1])
    expect(members.map((r) => r.tended)).toEqual([8, 8, 3])
    expect(party.map((m) => m.hp)).toEqual([18, 10, maxHp(party[2])])
  })

  it('leaves the tending to the next best when the healer has fallen', () => {
    const party = warriors('Aldric', 'Brenna', 'Corwin')
    party[1].trained.firstAid = 30
    party[0].hp = 10
    party[1].hp = 0
    const { members, healer } = rewardVictory(party, 10)
    expect(healer).toBe(party[0])
    expect(members[0].tended).toBe(firstAidHp(party[0]))
    expect(party[0].hp).toBe(10 + firstAidHp(party[0]))
  })

  it('names no healer when no one was hurt', () => {
    expect(rewardVictory(newParty(), 10).healer).toBeNull()
  })
})

describe('describeRewards', () => {
  it('shows only the experience when it changed nobody', () => {
    expect(describeRewards(rewardVictory(newParty(), 50))).toEqual(['+50 XP each'])
    expect(describeRewards(rewardVictory([createWarrior()], 50))).toEqual(['+50 XP'])
  })

  it('announces each new level and what it brought, who got back up, and the healer’s work', () => {
    const party = warriors('Aldric', 'Brenna', 'Corwin')
    party[1].level = 3
    party[1].hp = 0
    const hp = hpPerLevel(party[0])
    const points = skillPointsPerLevel(party[0])
    expect(describeRewards(rewardVictory(party, xpToNextLevel(1)))).toEqual([
      `+${xpToNextLevel(1)} XP each`,
      `Aldric reaches level 2: +${hp} max HP, ${points} skill points, wounds healed`,
      'Brenna gets back up, badly hurt',
      `Corwin reaches level 2: +${hp} max HP, ${points} skill points, wounds healed`,
      `Aldric tends the party's wounds: up to ${firstAidHp(party[0])} HP each`,
    ])
  })

  it('announces a perk with the level that brings one', () => {
    const [hero] = warriors('Aldric')
    hero.level = 2
    expect(describeRewards(rewardVictory([hero], xpToNextLevel(2)))[1]).toBe(
      `Aldric reaches level 3: +${hpPerLevel(hero)} max HP, ${skillPointsPerLevel(hero)} skill points, a perk, wounds healed`,
    )
  })
})
