import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_POINTS } from '../character/attributes.ts'
import { createWarrior, deriveCombatStats, hpPerLevel, maxHp, maxMana, weaponSkill } from '../character/character.ts'
import {
  attributePointsLeft,
  draftCharacter,
  draftProblems,
  perkPicksLeft,
  skillPointsLeft,
} from '../character/creation.ts'
import { knownSpells } from '../character/perks.ts'
import { canAdvance, skillPointsPerLevel, xpToNextLevel } from '../character/progression.ts'
import { TAGGED_SKILLS, skillLevel } from '../character/skills.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { ENCOUNTERS, MAX_THREAT } from './encounters.ts'
import {
  MAX_PARTY_SIZE,
  READY_MADE,
  REVIVED_HP,
  STARTING_PARTY_LIMIT,
  describeRewards,
  joinParty,
  readyMadeParty,
  partyFighters,
  rewardVictory,
} from './party.ts'

describe('readyMadeParty', () => {
  it('is three level 1 heroes, each with a name and a face of its own', () => {
    const party = readyMadeParty()
    expect(party.map((m) => m.name)).toEqual(['Aldric', 'Brenna', 'Delwyn'])
    expect(party.map((m) => m.level)).toEqual([1, 1, 1])
    expect(new Set(party.map((m) => m.portrait)).size).toBe(3)
  })

  it('is made of drafts with no problems: 35 attribute points, a tag, 10 skill points and 3 picks spent', () => {
    for (const draft of READY_MADE) {
      const others = READY_MADE.filter((other) => other !== draft).map((other) => other.name)
      expect(draftProblems(draft, others)).toEqual([])
      expect([attributePointsLeft(draft), skillPointsLeft(draft), perkPicksLeft(draft)]).toEqual([0, 0, 0])
      const member = draftCharacter(draft)
      expect(Object.values(member.attributes).reduce((a, b) => a + b)).toBe(ATTRIBUTE_POINTS)
      expect(new Set(member.tagged).size).toBe(TAGGED_SKILLS)
      expect([member.skillPoints, member.perkPicks]).toEqual([0, 0])
      expect(Object.values(member.perks).reduce((a, b) => a + b)).toBe(3)
      expect(member.hp).toBe(maxHp(member))
      expect(canAdvance(member)).toBe(false)
      // Each holds a weapon it has a gift for.
      expect(member.tagged).toContain(weaponSkill(member.equipment.mainHand))
    }
  })

  it('makes each the specialist of one skill, near 60% in it and near 10% in the others', () => {
    const [aldric, brenna, delwyn] = readyMadeParty()
    expect(skillLevel(aldric, 'melee')).toBe(60)
    expect(skillLevel(aldric, 'archery')).toBe(9)
    expect(skillLevel(brenna, 'archery')).toBe(61)
    expect(skillLevel(delwyn, 'magic')).toBe(63)
  })

  it('makes the third a mage, who starts knowing Magic Arrow', () => {
    const party = readyMadeParty()
    const mage = party[2]
    expect(party.map((m) => knownSpells(m))).toEqual([[], [], ['magic_arrow']])
    expect([maxHp(mage), maxMana(mage)]).toEqual([17, 18])
    expect(deriveCombatStats(mage)).toMatchObject({
      actionPoints: 8,
      weapon: 'Wand of Sparks',
      toHit: 63,
      attackRange: 4,
      magic: { maxMana: 18, skill: 63, spells: ['magic_arrow'] },
    })
  })

  it('gives each member its own gear', () => {
    const [a, b] = readyMadeParty()
    a.backpack[0] = null
    expect(b.backpack[0]).not.toBeNull()
    expect(readyMadeParty()[0].backpack[0]).not.toBeNull()
  })
})

describe('joinParty', () => {
  it('refuses a fourth member at a limit of 3', () => {
    const party = readyMadeParty()
    expect(joinParty(party, createWarrior(), STARTING_PARTY_LIMIT)).toBe(false)
    expect(party).toHaveLength(3)
    party.pop()
    expect(joinParty(party, createWarrior(), STARTING_PARTY_LIMIT)).toBe(true)
  })

  it('takes members up to a higher limit, and never past the most a party can hold', () => {
    const party = readyMadeParty()
    while (party.length < MAX_PARTY_SIZE) expect(joinParty(party, createWarrior(), MAX_PARTY_SIZE)).toBe(true)
    expect(joinParty(party, createWarrior(), MAX_PARTY_SIZE + 1)).toBe(false)
    expect(party).toHaveLength(MAX_PARTY_SIZE)
  })
})

describe('partyFighters', () => {
  it('gives each member its stats and the hit points it has left, in party order', () => {
    const party = readyMadeParty()
    party[1].hp = 7
    expect(partyFighters(party)).toEqual(party.map((m) => ({ stats: deriveCombatStats(m), hp: m.hp })))
    expect(partyFighters(party)[1].hp).toBe(7)
  })

  it('fits a full party into every encounter, at every threat', () => {
    const party = readyMadeParty()
    while (joinParty(party, createWarrior(), MAX_PARTY_SIZE));
    for (const build of Object.values(ENCOUNTERS)) {
      for (let threat = 1; threat <= MAX_THREAT; threat++) {
        // The engine refuses a setup with two units on one hex.
        const state = new BattleEngine(build(partyFighters(party), threat).setup).getState()
        expect(state.units.filter((u) => u.side === 'player')).toHaveLength(MAX_PARTY_SIZE)
      }
    }
  })
})

/** A party of warriors, every member alike. */
const warriors = (...names: string[]) => names.map((name) => createWarrior(name))

describe('rewardVictory', () => {
  it('gives every member the whole reward', () => {
    const party = readyMadeParty()
    const { members } = rewardVictory(party, 50)
    expect(party.map((m) => m.xp)).toEqual([50, 50, 50])
    expect(members.map((r) => [r.member, r.gain.xp, r.revived])).toEqual(party.map((m) => [m, 50, false]))
  })

  it('stands a fallen member back up, barely, and tends no one', () => {
    const party = warriors('Aldric', 'Brenna', 'Corwin')
    party[0].hp = 5
    party[2].hp = 0
    const { members } = rewardVictory(party, 10)
    expect(members.map((r) => r.revived)).toEqual([false, false, true])
    expect(party.map((m) => m.hp)).toEqual([5, maxHp(party[1]), REVIVED_HP])
  })

  it('heals a fallen member whom the reward levels up', () => {
    const party = readyMadeParty()
    party[0].hp = 0
    const { members } = rewardVictory(party, xpToNextLevel(1))
    expect(party[0].hp).toBe(maxHp(party[0]))
    expect(members[0].revived).toBe(false)
  })
})

describe('describeRewards', () => {
  it('shows only the experience when it changed nobody', () => {
    expect(describeRewards(rewardVictory(readyMadeParty(), 50))).toEqual(['+50 XP each'])
    expect(describeRewards(rewardVictory([createWarrior()], 50))).toEqual(['+50 XP'])
  })

  it('announces each new level and what it brought, and who got back up, and no healer', () => {
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
