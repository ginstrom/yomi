import { describe, expect, it } from 'vitest'
import { YEW_BOW } from '../inventory/inventory.ts'
import { createWarrior, hpPerLevel, maxHp } from './character.ts'
import {
  EVEN_FOE_XP_PER_LEVEL,
  PERK_LEVEL_STEP,
  autoAdvance,
  canAdvance,
  gainXp,
  levelUp,
  nextPerkLevel,
  skillPointsPerLevel,
  takePerk,
  xpToNextLevel,
} from './progression.ts'
import { MASTERY_LEVEL, skillLevel } from './skills.ts'

describe('xpToNextLevel', () => {
  it('asks for more even foes at each level: under one, then one, two, three', () => {
    const evenFoes = [1, 2, 3, 4, 5].map((level) => xpToNextLevel(level) / (EVEN_FOE_XP_PER_LEVEL * level))
    expect(evenFoes[0]).toBeLessThan(1)
    expect(evenFoes.slice(1)).toEqual([1, 2, 3, 4])
  })

  it('lets two weak foes, each worth half an even one, buy level 3', () => {
    expect(xpToNextLevel(2)).toBe(2 * (EVEN_FOE_XP_PER_LEVEL * 2 * 0.5))
  })
})

describe('skillPointsPerLevel', () => {
  it('gives 2 and half the character’s intelligence, and what a perk adds', () => {
    const warrior = createWarrior()
    const points = (intelligence: number) => {
      warrior.attributes.intelligence = intelligence
      return skillPointsPerLevel(warrior)
    }
    expect([1, 4, 7, 10].map(points)).toEqual([2, 4, 5, 7])
    warrior.perks.scholar = 1
    expect(skillPointsPerLevel(warrior)).toBe(9)
  })
})

describe('gainXp', () => {
  it('keeps experience short of a level, and changes nothing else', () => {
    const warrior = createWarrior()
    warrior.hp = 5
    const gain = gainXp(warrior, xpToNextLevel(1) - 1)
    expect(gain).toEqual({ xp: xpToNextLevel(1) - 1, levelsGained: 0, maxHpGained: 0, skillPointsGained: 0, perksGained: 0 })
    expect(warrior).toEqual({ ...createWarrior(), xp: xpToNextLevel(1) - 1, hp: 5 })
  })

  it('levels up at the threshold, carrying the rest over, bringing hit points and skill points and healing', () => {
    const warrior = createWarrior()
    const before = maxHp(warrior)
    warrior.hp = 3
    const gain = gainXp(warrior, xpToNextLevel(1) + 30)
    expect(gain).toEqual({
      xp: xpToNextLevel(1) + 30,
      levelsGained: 1,
      maxHpGained: hpPerLevel(warrior),
      skillPointsGained: skillPointsPerLevel(warrior),
      perksGained: 0,
    })
    expect([warrior.level, warrior.xp]).toEqual([2, 30])
    expect(maxHp(warrior)).toBe(before + hpPerLevel(warrior))
    expect(warrior.hp).toBe(maxHp(warrior))
    expect([warrior.skillPoints, warrior.perkPicks]).toEqual([skillPointsPerLevel(warrior), 0])
  })

  it('adds up experience across gains', () => {
    const warrior = createWarrior()
    gainXp(warrior, xpToNextLevel(1))
    gainXp(warrior, xpToNextLevel(2) - 50)
    expect([warrior.level, warrior.xp]).toEqual([2, xpToNextLevel(2) - 50])
    expect(gainXp(warrior, 50).levelsGained).toBe(1)
    expect([warrior.level, warrior.xp]).toEqual([3, 0])
  })

  it('climbs several levels on one large gain, with a perk at every third', () => {
    const warrior = createWarrior()
    const gain = gainXp(warrior, xpToNextLevel(1) + xpToNextLevel(2) + xpToNextLevel(3))
    expect(gain).toMatchObject({ levelsGained: 3, skillPointsGained: 3 * skillPointsPerLevel(warrior), perksGained: 1 })
    expect([warrior.level, warrior.xp, warrior.perkPicks]).toEqual([4, 0, 1])
    expect(nextPerkLevel(warrior)).toBe(2 * PERK_LEVEL_STEP)
  })

  it('earns more with a perk for it', () => {
    const warrior = createWarrior()
    warrior.perks.quick_study = 2
    expect(gainXp(warrior, 50).xp).toBe(60)
    expect(warrior.xp).toBe(60)
  })
})

describe('takePerk', () => {
  it('spends a pick on a rank of a perk the character qualifies for', () => {
    const warrior = createWarrior()
    warrior.level = 3
    expect(takePerk(warrior, 'dodger')).toBe(false)
    warrior.perkPicks = 2
    expect(takePerk(warrior, 'tireless')).toBe(false)
    expect(takePerk(warrior, 'dodger')).toBe(true)
    expect(takePerk(warrior, 'dodger')).toBe(true)
    expect([warrior.perks.dodger, warrior.perkPicks]).toEqual([2, 0])
  })

  it('adds the hit points a perk brings to those the character has left', () => {
    const warrior = createWarrior()
    warrior.level = 3
    warrior.perkPicks = 1
    warrior.hp = 4
    takePerk(warrior, 'toughness')
    expect(warrior.hp).toBe(10)
  })
})

describe('canAdvance', () => {
  it('holds while there are skill points or a perk to take', () => {
    const warrior = createWarrior()
    expect(canAdvance(warrior)).toBe(false)
    warrior.skillPoints = 1
    expect(canAdvance(warrior)).toBe(true)
    warrior.skillPoints = 0
    warrior.perkPicks = 1
    // A pick with no perk on offer is nothing to act on yet.
    expect(canAdvance(warrior)).toBe(false)
    warrior.level = 3
    expect(canAdvance(warrior)).toBe(true)
  })
})

describe('autoAdvance', () => {
  it('puts skill points into the weapon in hand and takes a perk, leaving nothing unspent', () => {
    const warrior = createWarrior()
    const before = skillLevel(warrior, 'melee')
    for (let i = 0; i < 2; i++) levelUp(warrior)
    autoAdvance(warrior)
    expect(skillLevel(warrior, 'melee')).toBe(before + 2 * 2 * skillPointsPerLevel(warrior))
    expect([warrior.skillPoints, warrior.perkPicks]).toEqual([0, 0])
    expect(warrior.perks).toEqual({ toughness: 1 })
    expect(warrior.hp).toBe(maxHp(warrior))
  })

  it('follows the weapon the character holds', () => {
    const archer = createWarrior()
    archer.equipment.mainHand = YEW_BOW
    levelUp(archer)
    autoAdvance(archer)
    expect(archer.trained).toMatchObject({ archery: skillPointsPerLevel(archer), melee: 0 })
  })

  it('turns to First Aid, for a character with the gift, once the weapon is mastered', () => {
    const warrior = createWarrior()
    warrior.tagged = ['melee', 'firstAid']
    warrior.trained.melee = MASTERY_LEVEL - skillLevel(warrior, 'melee')
    warrior.skillPoints = 3
    autoAdvance(warrior)
    expect(warrior.trained.firstAid).toBe(6)
    expect(skillLevel(warrior, 'melee')).toBe(MASTERY_LEVEL)
  })
})
