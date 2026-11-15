import { describe, expect, it } from 'vitest'
import { createWarrior } from './character.ts'
import {
  SKILL_COST_TIERS,
  MAX_SKILL,
  SKILLS,
  SKILL_IDS,
  TAG_BONUS,
  raiseSkill,
  skillLevel,
  skillRaiseCost,
  skillRaiseRefusal,
} from './skills.ts'

describe('skillLevel', () => {
  it('starts from attributes, with a bonus for a tagged skill', () => {
    // The warrior: strength 7, perception 4, intelligence 4, agility 6; tagged in Melee Weapons.
    const warrior = createWarrior()
    expect(SKILL_IDS).toEqual(['melee', 'archery', 'magic'])
    expect(SKILL_IDS.map((id) => skillLevel(warrior, id))).toEqual([
      7 + 6 + TAG_BONUS,
      4 + 6,
      2 * 4,
    ])
    warrior.tagged = ['magic']
    expect(skillLevel(warrior, 'magic')).toBe(8 + TAG_BONUS)
  })

  it('adds what has been trained', () => {
    const warrior = createWarrior()
    warrior.trained.magic = 9
    expect(skillLevel(warrior, 'magic')).toBe(17)
  })

  it('moves with an attribute a perk has raised', () => {
    const warrior = createWarrior()
    warrior.perks.lasting_magic = 1
    expect(skillLevel(warrior, 'magic')).toBe(2 * 5)
    warrior.perks.skirmisher = 1
    expect(skillLevel(warrior, 'archery')).toBe(4 + 7)
  })

  it('gives every skill a name and a word on what it does', () => {
    for (const id of SKILL_IDS) expect([SKILLS[id].name, SKILLS[id].description].every((text) => text.length > 0)).toBe(true)
  })
})

describe('raiseSkill', () => {
  it('spends a point on 1%, or on 2% of a tagged skill', () => {
    const warrior = createWarrior()
    warrior.skillPoints = 3
    expect(raiseSkill(warrior, 'archery')).toBe(true)
    expect(raiseSkill(warrior, 'melee')).toBe(true)
    expect([warrior.trained.archery, warrior.trained.melee, warrior.skillPoints]).toEqual([1, 2, 1])
  })

  it('does nothing without a point to spend', () => {
    const warrior = createWarrior()
    expect(raiseSkill(warrior, 'melee')).toBe(false)
    expect(warrior.trained.melee).toBe(0)
  })

  it('costs 2 points from 80% and 3 from 90%', () => {
    const warrior = createWarrior()
    expect(SKILL_COST_TIERS).toEqual([
      { level: 80, cost: 2 },
      { level: 90, cost: 3 },
    ])
    warrior.trained.archery = 79 - skillLevel(warrior, 'archery')
    warrior.skillPoints = 1 + 2
    expect(skillRaiseCost(warrior, 'archery')).toBe(1)
    expect(raiseSkill(warrior, 'archery')).toBe(true)
    expect(skillRaiseCost(warrior, 'archery')).toBe(2)
    expect(raiseSkill(warrior, 'archery')).toBe(true)
    expect([skillLevel(warrior, 'archery'), warrior.skillPoints]).toEqual([81, 0])
    warrior.skillPoints = 1
    expect(raiseSkill(warrior, 'archery')).toBe(false)
    warrior.trained.archery += 89 - skillLevel(warrior, 'archery')
    expect(skillRaiseCost(warrior, 'archery')).toBe(2)
    warrior.trained.archery += 1
    expect(skillRaiseCost(warrior, 'archery')).toBe(3)
    warrior.trained.archery += 9
    expect(skillRaiseCost(warrior, 'archery')).toBe(3)
    warrior.trained.archery += 1
    expect(skillRaiseCost(warrior, 'archery')).toBeNull()
  })

  it('caps a skill at 100%', () => {
    expect(MAX_SKILL).toBe(100)
  })

  it('refuses a raise at 100% or more, with a reason, and keeps the points', () => {
    const warrior = createWarrior()
    warrior.skillPoints = 10
    expect(skillRaiseRefusal(warrior, 'melee')).toBeNull()
    // A node's bonus may carry a skill past 100; points never raise it further.
    warrior.trained.melee = 105 - skillLevel(warrior, 'melee')
    expect(skillRaiseRefusal(warrior, 'melee')).toBe('Melee Weapons is at 105%; skill points raise a skill no higher than 100%')
    expect(raiseSkill(warrior, 'melee')).toBe(false)
    expect(warrior.skillPoints).toBe(10)
  })

  it('says when the points do not cover a raise', () => {
    const warrior = createWarrior()
    warrior.trained.archery = 85 - skillLevel(warrior, 'archery')
    warrior.skillPoints = 1
    expect(skillRaiseRefusal(warrior, 'archery')).toBe('Needs 2 skill points; you have 1')
    warrior.skillPoints = 0
    expect(skillRaiseRefusal(warrior, 'melee')).toBe('Needs 1 skill point; you have 0')
  })

  it('stops at the highest a skill goes, a tagged one too', () => {
    const warrior = createWarrior()
    warrior.trained.melee = MAX_SKILL - 1 - skillLevel(warrior, 'melee')
    warrior.skillPoints = 10
    expect(raiseSkill(warrior, 'melee')).toBe(true)
    expect(skillLevel(warrior, 'melee')).toBe(MAX_SKILL)
    expect(skillRaiseCost(warrior, 'melee')).toBeNull()
    expect(raiseSkill(warrior, 'melee')).toBe(false)
    expect(warrior.skillPoints).toBe(10 - SKILL_COST_TIERS[SKILL_COST_TIERS.length - 1].cost)
  })
})
