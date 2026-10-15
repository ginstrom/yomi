import { describe, expect, it } from 'vitest'
import { SPARK_WAND, YEW_BOW } from '../inventory/inventory.ts'
import { createWarrior, hpPerLevel, maxHp, maxMana } from './character.ts'
import { knownSpells } from './perks.ts'
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
import { SKILL_IDS, skillLevel } from './skills.ts'

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
  it('gives 2 and a third of the character’s intelligence, and what a perk adds', () => {
    const warrior = createWarrior()
    const points = (intelligence: number) => {
      warrior.attributes.intelligence = intelligence
      return skillPointsPerLevel(warrior)
    }
    expect([1, 2, 3, 5, 6, 8, 9, 10].map(points)).toEqual([2, 2, 3, 3, 4, 4, 5, 5])
    warrior.perks.scholar = 1
    expect(skillPointsPerLevel(warrior)).toBe(7)
    // An attribute a perk has raised counts.
    warrior.attributes.intelligence = 5
    warrior.perks = { gain_intelligence: 1 }
    expect(skillPointsPerLevel(warrior)).toBe(4)
  })
})

describe('gainXp', () => {
  it('keeps experience short of a level, and changes nothing else', () => {
    const warrior = createWarrior()
    warrior.hp = 5
    const gain = gainXp(warrior, xpToNextLevel(1) - 1)
    expect(gain).toEqual({ xp: xpToNextLevel(1) - 1, levelsGained: 0, maxHpGained: 0, skillPointsGained: 0, perksGained: 0, spellsGained: 0 })
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
      spellsGained: 0,
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
    expect(warrior.perkPicks).toBe(2)
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
    expect(canAdvance(warrior)).toBe(true)
    // A pick with no perk on offer is nothing to act on yet.
    warrior.attributes = { strength: 4, perception: 4, endurance: 4, intelligence: 4, agility: 4, luck: 4 }
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

  it('trains Magic for a character with a wand in hand, and only skills there are', () => {
    const mage = createWarrior()
    mage.equipment.mainHand = SPARK_WAND
    levelUp(mage)
    autoAdvance(mage)
    expect(mage.trained).toEqual({ melee: 0, archery: 0, magic: skillPointsPerLevel(mage) })
    expect(Object.keys(mage.trained)).toEqual([...SKILL_IDS])
  })

  it('takes Tireless only once it has Toughness, and falls back on any perk on offer', () => {
    const warrior = createWarrior()
    warrior.attributes.endurance = 8
    while (warrior.level < 6) levelUp(warrior)
    autoAdvance(warrior)
    expect(warrior.perks).toEqual({ toughness: 1, tireless: 1 })
    // Nothing a plain fighter wants is on offer to this one but Spellcasting, which it never takes, and the attribute perks.
    const scholar = createWarrior()
    scholar.attributes = { strength: 4, perception: 4, endurance: 4, intelligence: 4, agility: 5, luck: 5 }
    scholar.trained.magic = 42
    scholar.level = 3
    scholar.perkPicks = 2
    autoAdvance(scholar)
    expect(scholar.perks).toEqual({ gain_strength: 1, weapon_training: 1 })
  })
})

describe('spell picks (A3)', () => {
  const caster = () => {
    const mage = createWarrior()
    mage.trained.magic = 32
    mage.perkPicks = 1
    return mage
  }

  it('come two with Spellcasting and one with every level after, and to no one else', () => {
    const mage = caster()
    expect(takePerk(mage, 'spellcasting')).toBe(true)
    expect([mage.perkPicks, mage.spellPicks, maxMana(mage)]).toEqual([0, 2, 0])
    levelUp(mage)
    expect(mage.spellPicks).toBe(3)
    const warrior = createWarrior()
    levelUp(warrior)
    expect(warrior.spellPicks).toBe(0)
    expect(gainXp(mage, xpToNextLevel(2)).spellsGained).toBe(1)
  })

  it('are spent on a spell before a perk pick is, and never on an ordinary perk', () => {
    const mage = caster()
    takePerk(mage, 'spellcasting')
    mage.perkPicks = 1
    expect(takePerk(mage, 'heal')).toBe(true)
    expect([mage.perkPicks, mage.spellPicks]).toEqual([1, 1])
    expect(takePerk(mage, 'keen_eye')).toBe(true)
    expect([mage.perkPicks, mage.spellPicks]).toEqual([0, 1])
    expect(takePerk(mage, 'shield')).toBe(true)
    expect(takePerk(mage, 'protect')).toBe(false)
    mage.perkPicks = 1
    expect(takePerk(mage, 'protect')).toBe(true)
    expect(mage.perkPicks).toBe(0)
  })

  it('bring mana with the first spell, as a perk that raises the maximum raises what is carried', () => {
    const mage = caster()
    takePerk(mage, 'spellcasting')
    expect(mage.mana).toBe(0)
    takePerk(mage, 'heal')
    expect(mage.mana).toBe(maxMana(mage))
    mage.mana = 2
    mage.level = 3
    mage.perkPicks = 1
    takePerk(mage, 'gain_intelligence')
    expect(mage.mana).toBe(4)
  })

  it('are spent by autoAdvance in its order, never on Spellcasting for one without it', () => {
    const mage = caster()
    takePerk(mage, 'spellcasting')
    autoAdvance(mage)
    expect(knownSpells(mage)).toEqual(['magic_arrow', 'heal'])
    expect(mage.spellPicks).toBe(0)
    const warrior = createWarrior()
    warrior.trained.magic = 40
    warrior.perkPicks = 1
    autoAdvance(warrior)
    expect(warrior.perks.spellcasting).toBeUndefined()
  })
})
