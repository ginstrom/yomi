import { describe, expect, it } from 'vitest'
import { deriveCombatStats, type Character } from '../character/character.ts'
import { draftCharacter, draftProblems } from '../character/creation.ts'
import { autoAdvance, levelUp } from '../character/progression.ts'
import { gradedItem, type Grade } from '../inventory/grades.ts'
import { IRON_BATTLE_AXE, IRON_BREASTPLATE, IRON_DAGGER, IRON_SWORD, SPARK_WAND, itemById, type Item } from '../inventory/inventory.ts'
import type { Tier } from '../inventory/catalog.ts'
import { BANDIT_PLAN, BANDIT_ROLE, banditDraft, banditGear, banditStats, type BanditRole } from './bandits.ts'

const G1 = { tier: 1, grade: 1 } as const
const G2 = { tier: 1, grade: 2 } as const
const T2 = { tier: 2, grade: 2 } as const

const ROLES: readonly BanditRole[] = ['cutthroat', 'archer', 'brute', 'mage', 'captain', 'crossbowman']

/** The gear table by family: the tier-1 id and the tier-2 id of each item a role holds. Every item is plain and takes the grade. */
const ID = (tier: Tier, one: string, two: string) => itemById(tier === 1 ? one : two)!
const GEAR: Record<BanditRole, (tier: Tier) => { mainHand: Item; offHand?: Item; armor?: Item }> = {
  cutthroat: (t) => ({ mainHand: ID(t, 'iron_dagger', 'steel_dagger') }),
  archer: (t) => ({ mainHand: ID(t, 'yew_bow', 'ironwood_bow') }),
  brute: (t) => ({
    mainHand: ID(t, 'iron_battle_axe', 'steel_battle_axe'),
    armor: ID(t, 'iron_breastplate', 'steel_breastplate'),
  }),
  mage: (t) => ({ mainHand: ID(t, 'spark_wand', 'ironwood_wand') }),
  captain: (t) => ({
    mainHand: ID(t, 'iron_sword', 'steel_longsword'),
    offHand: ID(t, 'oak_shield', 'ironwood_shield'),
    armor: ID(t, 'iron_breastplate', 'steel_breastplate'),
  }),
  crossbowman: (t) => ({ mainHand: ID(t, 'yew_crossbow', 'ironwood_crossbow') }),
}

/** A hero built by hand the way bandits.ts says it builds a bandit: draft, gear, levels, then one autoAdvance. */
function heroLike(role: BanditRole, level: number, tier: Tier, grade: Grade): Character {
  const hero = draftCharacter(banditDraft(role))
  const { mainHand, offHand, armor } = GEAR[role](tier)
  const graded = (item: Item) => gradedItem(item, grade)
  hero.equipment = {
    mainHand: graded(mainHand),
    ...(offHand ? { offHand: graded(offHand) } : {}),
    ...(armor ? { armor: graded(armor) } : {}),
  }
  while (hero.level < level) levelUp(hero)
  autoAdvance(hero, BANDIT_PLAN[role])
  return hero
}

describe('banditStats', () => {
  it('equals a hero of the same draft, levels and gear (S1-A3)', () => {
    for (const role of ROLES) {
      for (const level of [1, 3, 5]) {
        for (const tier of [1, 2] as const) {
          for (const grade of [1, 2] as const) {
            expect(banditStats(role, level, { tier, grade }), `${role} ${level} ${tier} ${grade}`).toEqual(
              deriveCombatStats(heroLike(role, level, tier, grade)),
            )
          }
        }
      }
    }
  })

  it('gives the same stats for the same arguments', () => {
    for (const role of ROLES) expect(banditStats(role, 4, G2)).toEqual(banditStats(role, 4, G2))
  })

  it('treats a level below 1 as 1', () => {
    expect(banditStats('brute', 0, G1)).toEqual(banditStats('brute', 1, G1))
  })

  it('builds each role from a legal draft', () => {
    for (const role of ROLES) {
      // Only the name may be long: a bandit is renamed by its encounter and never stands in a party.
      const problems = draftProblems(banditDraft(role), []).filter((p) => !p.startsWith('The name is longer'))
      expect(problems, role).toEqual([])
    }
  })

  it('teaches the Hedge-Mage Magic Arrow and Shield by level 3 and Flame Arrow by level 4', () => {
    expect(banditStats('mage', 3, G1).magic?.spells).toEqual(expect.arrayContaining(['magic_arrow', 'shield']))
    expect(banditStats('mage', 4, G1).magic?.spells).toEqual(expect.arrayContaining(['magic_arrow', 'shield', 'flame_arrow']))
  })

  it('shows the gear in the stats', () => {
    expect(banditStats('cutthroat', 3, G1).resistance).toBeUndefined()
    expect(banditStats('archer', 3, G1).resistance).toBeUndefined()
    expect(banditStats('mage', 3, G1).resistance).toBeUndefined()
    expect(banditStats('brute', 3, G1).resistance).toBe(IRON_BREASTPLATE.stats!.resistance)
    expect(banditStats('captain', 3, G1).resistance).toBe(IRON_BREASTPLATE.stats!.resistance)
    expect(banditStats('brute', 3, G2).resistance).toBe(IRON_BREASTPLATE.stats!.resistance! + 1)
    expect(banditStats('cutthroat', 3, G1).weapon).toBe(IRON_DAGGER.name)
    expect(banditStats('archer', 3, G1).attackRange).toBeGreaterThan(1)
    expect(banditStats('brute', 3, G1).weapon).toBe(IRON_BATTLE_AXE.name)
    expect(banditStats('mage', 3, G1).weapon).toBe(SPARK_WAND.name)
    expect(banditStats('captain', 3, G1).weapon).toBe(IRON_SWORD.name)
    // The captain's armour class holds its shield and breastplate; the brute's only the breastplate.
    const agilityAc = (role: BanditRole) => banditDraft(role).attributes.agility
    expect(banditStats('captain', 3, G1).ac).toBeGreaterThanOrEqual(agilityAc('captain') + 20)
    expect(banditStats('brute', 3, G1).ac).toBeLessThan(agilityAc('brute') + 20)
  })

  it('shows tier 2 in the captain\'s stats at threat 6', () => {
    const t1 = banditStats('captain', 6, G2)
    const t2 = banditStats('captain', 6, T2)
    expect(t2.damage.bonus).toBe(t1.damage.bonus + 2)
    expect(t2.resistance).toBe(t1.resistance! + 1)
    expect(t2.ac).toBe(t1.ac + 4)
    expect(t2.weapon).toBe('Fine Steel Longsword')
  })

  it('drafts the crossbowman as the archer, but for its name', () => {
    expect(banditDraft('crossbowman')).toEqual({ ...banditDraft('archer'), name: 'Bandit Crossbowman' })
  })

  it('arms the crossbowman with a crossbow that pierces at range', () => {
    const stats = banditStats('crossbowman', 6, T2)
    expect(stats.weapon).toBe('Fine Ironwood Crossbow')
    // The crossbow's 5; Far Shot's 2 come with the ranger's plan at level 8, after Volley.
    expect(stats.attackRange).toBe(5)
    expect(banditStats('crossbowman', 8, T2).attackRange).toBe(7)
    expect(stats.attackApCost).toBe(6)
  })

  it('adds a point of damage to a graded weapon at grade 2', () => {
    for (const role of ['cutthroat', 'archer', 'brute', 'captain'] as const) {
      expect(banditStats(role, 3, G2).damage.bonus).toBe(banditStats(role, 3, G1).damage.bonus + 1)
    }
  })
})

describe('banditGear', () => {
  it('is tier 1 Fine at threats 3 and 5, plain at 4, tier 2 Fine at 6 and 7, and Masterwork steel from threat 8', () => {
    expect([3, 4, 5, 6, 7, 8, 13, 20].map(banditGear)).toEqual([
      { tier: 1, grade: 2 },
      { tier: 1, grade: 1 },
      { tier: 1, grade: 2 },
      { tier: 2, grade: 2 },
      { tier: 2, grade: 2 },
      { tier: 2, grade: 3 },
      { tier: 2, grade: 3 },
      { tier: 2, grade: 3 },
    ])
  })

  it('builds a bandit of each role at level 20 in Masterwork steel, as a hero built the same way', () => {
    for (const role of ROLES) {
      const stats = banditStats(role, 20, banditGear(20))
      expect(stats, role).toEqual(deriveCombatStats(heroLike(role, 20, 2, 3)))
      expect(stats.weapon, role).toMatch(/^Masterwork (Steel|Ironwood) /)
    }
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
      bandit_crossbowman: 'crossbowman',
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
      const stats = banditStats(role, 5, G2)
      expect(isDeepFrozen(stats)).toBe(true)
      expect(banditStats(role, 5, G2)).toBe(stats)
    }
    expect(banditStats('mage', 5, G1).magic).toBeDefined()
  })
})

describe('what the bandits learn from their plans', () => {
  const gear = banditGear(5)
  const abilities = (role: BanditRole, level: number) => banditStats(role, level, gear).abilities ?? []

  it('gives the Captain Rooted at 3, Taunt at 5 and Pin at 8 (the knight plan takes Heavy Hand after Pin)', () => {
    expect(banditStats('captain', 2, gear).traits ?? []).toEqual([])
    expect(banditStats('captain', 3, gear).traits).toEqual(['rooted'])
    expect([4, 5, 7, 8].map((level) => abilities('captain', level))).toEqual([[], ['taunt'], ['taunt'], ['taunt', 'pin']])
  })

  it('gives the Brute Power Attack at 3 and Cleave at 8', () => {
    expect([2, 3, 7, 8].map((level) => abilities('brute', level))).toEqual([[], ['power_attack'], ['power_attack'], ['power_attack', 'cleave']])
  })

  it('gives the Cutthroat Backstab at 2 (a passive), Dirty Trick at 4 and Sprint at 5', () => {
    expect(abilities('cutthroat', 2)).toEqual([])
    expect(abilities('cutthroat', 4)).toEqual(['dirty_trick'])
    expect(abilities('cutthroat', 5)).toEqual(['sprint', 'dirty_trick'])
  })

  it('gives the Archer and the Crossbowman Aimed Shot at 3 and Volley at 6', () => {
    for (const role of ['archer', 'crossbowman'] as const) {
      expect([2, 3, 5, 6].map((level) => abilities(role, level))).toEqual([[], ['aimed_shot'], ['aimed_shot'], ['aimed_shot', 'volley']])
    }
  })

  it('gives the Hedge-Mage Flame Arrow at 3 and Fireball at 7', () => {
    const learnt = (level: number) => banditStats('mage', level, gear).magic!.spells.filter((id) => id === 'flame_arrow' || id === 'fireball')
    expect([2, 3, 6, 7].map(learnt)).toEqual([[], ['flame_arrow'], ['flame_arrow'], ['flame_arrow', 'fireball']])
  })
})
