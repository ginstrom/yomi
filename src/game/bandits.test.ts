import { describe, expect, it } from 'vitest'
import { deriveCombatStats, type Character } from '../character/character.ts'
import { draftCharacter, draftProblems } from '../character/creation.ts'
import { autoAdvance, levelUp } from '../character/progression.ts'
import { gradedItem, type Grade } from '../inventory/grades.ts'
import {
  IRON_BATTLE_AXE,
  IRON_DAGGER,
  IRON_SWORD,
  OAK_SHIELD,
  SPARK_WAND,
  IRON_BREASTPLATE,
  YEW_BOW,
  type Item,
} from '../inventory/inventory.ts'
import { BANDIT_ROLE, banditDraft, banditGrade, banditStats, type BanditRole } from './bandits.ts'

const ROLES: readonly BanditRole[] = ['cutthroat', 'archer', 'brute', 'mage', 'captain']

/** The gear table, as the task gives it; every item is plain, the wand included, and takes the grade. */
const GEAR: Record<BanditRole, { mainHand: Item; offHand?: Item; armor?: Item }> = {
  cutthroat: { mainHand: IRON_DAGGER },
  archer: { mainHand: YEW_BOW },
  brute: { mainHand: IRON_BATTLE_AXE, armor: IRON_BREASTPLATE },
  mage: { mainHand: SPARK_WAND },
  captain: { mainHand: IRON_SWORD, offHand: OAK_SHIELD, armor: IRON_BREASTPLATE },
}

/** A hero built by hand the way bandits.ts says it builds a bandit: draft, gear, levels, then one autoAdvance. */
function heroLike(role: BanditRole, level: number, grade: Grade): Character {
  const hero = draftCharacter(banditDraft(role))
  const { mainHand, offHand, armor } = GEAR[role]
  const graded = (item: Item) => gradedItem(item, grade)
  hero.equipment = {
    mainHand: graded(mainHand),
    ...(offHand ? { offHand: graded(offHand) } : {}),
    ...(armor ? { armor: graded(armor) } : {}),
  }
  while (hero.level < level) levelUp(hero)
  autoAdvance(hero)
  return hero
}

describe('banditStats', () => {
  it('equals a hero of the same draft, levels and gear (S1-A3)', () => {
    for (const role of ROLES) {
      for (const level of [1, 3, 5]) {
        for (const grade of [1, 2] as const) {
          expect(banditStats(role, level, grade), `${role} ${level} ${grade}`).toEqual(
            deriveCombatStats(heroLike(role, level, grade)),
          )
        }
      }
    }
  })

  it('gives the same stats for the same arguments', () => {
    for (const role of ROLES) expect(banditStats(role, 4, 2)).toEqual(banditStats(role, 4, 2))
  })

  it('treats a level below 1 as 1', () => {
    expect(banditStats('brute', 0, 1)).toEqual(banditStats('brute', 1, 1))
  })

  it('builds each role from a legal draft', () => {
    for (const role of ROLES) {
      // Only the name may be long: a bandit is renamed by its encounter and never stands in a party.
      const problems = draftProblems(banditDraft(role), []).filter((p) => !p.startsWith('The name is longer'))
      expect(problems, role).toEqual([])
    }
  })

  it('teaches the Hedge-Mage Magic Arrow and Shield by level 3 and Flame Arrow by level 4', () => {
    expect(banditStats('mage', 3, 1).magic?.spells).toEqual(expect.arrayContaining(['magic_arrow', 'shield']))
    expect(banditStats('mage', 4, 1).magic?.spells).toEqual(expect.arrayContaining(['magic_arrow', 'shield', 'flame_arrow']))
  })

  it('shows the gear in the stats', () => {
    expect(banditStats('cutthroat', 3, 1).resistance).toBeUndefined()
    expect(banditStats('archer', 3, 1).resistance).toBeUndefined()
    expect(banditStats('mage', 3, 1).resistance).toBeUndefined()
    expect(banditStats('brute', 3, 1).resistance).toBe(IRON_BREASTPLATE.stats!.resistance)
    expect(banditStats('captain', 3, 1).resistance).toBe(IRON_BREASTPLATE.stats!.resistance)
    expect(banditStats('brute', 3, 2).resistance).toBe(IRON_BREASTPLATE.stats!.resistance! + 1)
    expect(banditStats('cutthroat', 3, 1).weapon).toBe(IRON_DAGGER.name)
    expect(banditStats('archer', 3, 1).attackRange).toBeGreaterThan(1)
    expect(banditStats('brute', 3, 1).weapon).toBe(IRON_BATTLE_AXE.name)
    expect(banditStats('mage', 3, 1).weapon).toBe(SPARK_WAND.name)
    expect(banditStats('captain', 3, 1).weapon).toBe(IRON_SWORD.name)
    // The captain's armour class holds its shield and breastplate; the brute's only the breastplate.
    const agilityAc = (role: BanditRole) => banditDraft(role).attributes.agility
    expect(banditStats('captain', 3, 1).ac).toBeGreaterThanOrEqual(agilityAc('captain') + 20)
    expect(banditStats('brute', 3, 1).ac).toBeLessThan(agilityAc('brute') + 20)
  })

  it('adds a point of damage to a graded weapon at grade 2', () => {
    for (const role of ['cutthroat', 'archer', 'brute', 'captain'] as const) {
      expect(banditStats(role, 3, 2).damage.bonus).toBe(banditStats(role, 3, 1).damage.bonus + 1)
    }
  })
})

describe('banditGrade', () => {
  it('is plain below threat 5 and Fine from it', () => {
    expect([3, 4, 5, 7].map(banditGrade)).toEqual([1, 1, 2, 2])
  })
})

describe('BANDIT_ROLE', () => {
  it('names a role for every bandit kind', () => {
    expect(BANDIT_ROLE).toEqual({
      bandit_cutthroat: 'cutthroat',
      bandit_archer: 'archer',
      bandit_brute: 'brute',
      bandit_mage: 'mage',
      bandit_captain: 'captain',
    })
  })
})

describe('banditStats freezing', () => {
  it('returns a deeply frozen block, shared between calls', () => {
    const isDeepFrozen = (value: unknown): boolean =>
      value === null ||
      typeof value !== 'object' ||
      (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen))
    for (const role of ROLES) {
      const stats = banditStats(role, 5, 2)
      expect(isDeepFrozen(stats)).toBe(true)
      expect(banditStats(role, 5, 2)).toBe(stats)
    }
    expect(banditStats('mage', 5, 1).magic).toBeDefined()
  })
})
