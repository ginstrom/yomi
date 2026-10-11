import { describe, expect, it } from 'vitest'
import { createWarrior } from './character.ts'
import { EVEN_FOE_XP_PER_LEVEL, LEVEL_UP_HP, TO_HIT_PER_STEP, gainXp, xpToNextLevel } from './progression.ts'

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

describe('gainXp', () => {
  it('keeps experience short of a level, and changes nothing else', () => {
    const warrior = createWarrior()
    warrior.hp = 5
    const gain = gainXp(warrior, xpToNextLevel(1) - 1)
    expect(gain).toEqual({ xp: xpToNextLevel(1) - 1, levelsGained: 0, maxHpGained: 0, toHitGained: 0 })
    expect([warrior.level, warrior.xp, warrior.hp]).toEqual([1, xpToNextLevel(1) - 1, 5])
    expect(warrior.base).toEqual(createWarrior().base)
  })

  it('levels up at the threshold, carrying the rest over, raising stats and healing', () => {
    const warrior = createWarrior()
    const before = { ...warrior.base }
    warrior.hp = 3
    const gain = gainXp(warrior, xpToNextLevel(1) + 30)
    expect(gain).toEqual({
      xp: xpToNextLevel(1) + 30,
      levelsGained: 1,
      maxHpGained: LEVEL_UP_HP,
      toHitGained: TO_HIT_PER_STEP,
    })
    expect([warrior.level, warrior.xp]).toEqual([2, 30])
    expect(warrior.base.maxHp).toBe(before.maxHp + LEVEL_UP_HP)
    expect(warrior.base.toHit).toBe(before.toHit + TO_HIT_PER_STEP)
    expect(warrior.hp).toBe(warrior.base.maxHp)
  })

  it('adds up experience across gains', () => {
    const warrior = createWarrior()
    gainXp(warrior, xpToNextLevel(1))
    gainXp(warrior, xpToNextLevel(2) - 50)
    expect([warrior.level, warrior.xp]).toEqual([2, xpToNextLevel(2) - 50])
    expect(gainXp(warrior, 50).levelsGained).toBe(1)
    expect([warrior.level, warrior.xp]).toEqual([3, 0])
  })

  it('climbs several levels on one large gain, with attack rising on every second', () => {
    const warrior = createWarrior()
    const before = { ...warrior.base }
    const gain = gainXp(warrior, xpToNextLevel(1) + xpToNextLevel(2) + xpToNextLevel(3))
    expect(gain.levelsGained).toBe(3)
    expect([warrior.level, warrior.xp]).toEqual([4, 0])
    expect(warrior.base.maxHp).toBe(before.maxHp + 3 * LEVEL_UP_HP)
    expect(warrior.base.toHit).toBe(before.toHit + 2 * TO_HIT_PER_STEP)
  })
})
