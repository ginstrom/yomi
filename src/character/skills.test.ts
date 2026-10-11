import { describe, expect, it } from 'vitest'
import { createWarrior } from './character.ts'
import {
  MASTERY_COST,
  MASTERY_LEVEL,
  MAX_SKILL,
  SKILLS,
  SKILL_IDS,
  TAG_BONUS,
  raiseSkill,
  skillLevel,
  skillRaiseCost,
} from './skills.ts'

describe('skillLevel', () => {
  it('starts from attributes, with a bonus for a tagged skill', () => {
    // The warrior: strength 7, perception 4, intelligence 4, agility 6; tagged in Melee Weapons.
    const warrior = createWarrior()
    expect(SKILL_IDS).toEqual(['melee', 'archery', 'magic'])
    expect(SKILL_IDS.map((id) => skillLevel(warrior, id))).toEqual([
      30 + 2 * (7 + 6) + TAG_BONUS,
      30 + 2 * (4 + 6),
      20 + 4 * 4,
    ])
    warrior.tagged = ['magic']
    expect(skillLevel(warrior, 'magic')).toBe(36 + TAG_BONUS)
  })

  it('adds what has been trained', () => {
    const warrior = createWarrior()
    warrior.trained.magic = 9
    expect(skillLevel(warrior, 'magic')).toBe(45)
  })

  it('moves with an attribute a perk has raised', () => {
    const warrior = createWarrior()
    warrior.perks.gain_intelligence = 2
    expect(skillLevel(warrior, 'magic')).toBe(20 + 4 * 6)
    warrior.perks.gain_agility = 1
    expect(skillLevel(warrior, 'archery')).toBe(30 + 2 * (4 + 7))
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

  it('costs more from mastery on', () => {
    const warrior = createWarrior()
    warrior.trained.archery = MASTERY_LEVEL - 1 - skillLevel(warrior, 'archery')
    warrior.skillPoints = 1 + MASTERY_COST
    expect(skillRaiseCost(warrior, 'archery')).toBe(1)
    expect(raiseSkill(warrior, 'archery')).toBe(true)
    expect(skillRaiseCost(warrior, 'archery')).toBe(MASTERY_COST)
    expect(raiseSkill(warrior, 'archery')).toBe(true)
    expect([skillLevel(warrior, 'archery'), warrior.skillPoints]).toEqual([MASTERY_LEVEL + 1, 0])
    warrior.skillPoints = MASTERY_COST - 1
    expect(raiseSkill(warrior, 'archery')).toBe(false)
  })

  it('stops at the highest a skill goes, a tagged one too', () => {
    const warrior = createWarrior()
    warrior.trained.melee = MAX_SKILL - 1 - skillLevel(warrior, 'melee')
    warrior.skillPoints = 10
    expect(raiseSkill(warrior, 'melee')).toBe(true)
    expect(skillLevel(warrior, 'melee')).toBe(MAX_SKILL)
    expect(skillRaiseCost(warrior, 'melee')).toBeNull()
    expect(raiseSkill(warrior, 'melee')).toBe(false)
    expect(warrior.skillPoints).toBe(10 - MASTERY_COST)
  })
})
