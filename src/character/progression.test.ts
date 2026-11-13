import { describe, expect, it } from 'vitest'
import { SPARK_WAND, YEW_BOW } from '../inventory/inventory.ts'
import { createWarrior, hpPerLevel, maxHp, maxMana, type Character } from './character.ts'
import { draftCharacter } from './creation.ts'
import { PERKS, PERK_IDS, knownSpells, type Perk, type PerkId } from './perks.ts'
import {
  AUTO_PLANS,
  EVEN_FOE_XP_PER_LEVEL,
  PICK_LEVEL_STEP,
  PLAN_IDS,
  autoAdvance,
  canAdvance,
  gainXp,
  levelUp,
  nextPerkLevel,
  picksAt,
  planFor,
  skillPointsPerLevel,
  takePerk,
  xpToNextLevel,
} from './progression.ts'
import { SKILL_IDS, skillLevel } from './skills.ts'
import { READY_MADE } from '../game/party.ts'

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
    // An attribute a node has raised counts.
    warrior.attributes.intelligence = 5
    warrior.perks = { lasting_magic: 1 }
    expect(skillPointsPerLevel(warrior)).toBe(4)
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

  it('levels up at the threshold, carrying the rest over, bringing hit points, skill points, a pick and healing', () => {
    const warrior = createWarrior()
    const before = maxHp(warrior)
    warrior.hp = 3
    const gain = gainXp(warrior, xpToNextLevel(1) + 30)
    expect(gain).toEqual({
      xp: xpToNextLevel(1) + 30,
      levelsGained: 1,
      maxHpGained: hpPerLevel(warrior),
      skillPointsGained: skillPointsPerLevel(warrior),
      perksGained: 1,
    })
    expect([warrior.level, warrior.xp]).toEqual([2, 30])
    expect(maxHp(warrior)).toBe(before + hpPerLevel(warrior))
    expect(warrior.hp).toBe(maxHp(warrior))
    expect([warrior.skillPoints, warrior.perkPicks]).toEqual([skillPointsPerLevel(warrior), 1])
  })

  it('adds up experience across gains', () => {
    const warrior = createWarrior()
    gainXp(warrior, xpToNextLevel(1))
    gainXp(warrior, xpToNextLevel(2) - 50)
    expect([warrior.level, warrior.xp]).toEqual([2, xpToNextLevel(2) - 50])
    expect(gainXp(warrior, 50).levelsGained).toBe(1)
    expect([warrior.level, warrior.xp]).toEqual([3, 0])
  })

  it('brings a pick at every even level and none at an odd one (AC3)', () => {
    const warrior = createWarrior()
    const picks = [2, 3, 4, 5, 6].map((level) => {
      const gained = gainXp(warrior, xpToNextLevel(level - 1)).perksGained
      expect(warrior.level).toBe(level)
      return gained
    })
    expect(picks).toEqual([1, 0, 1, 0, 1])
    expect(warrior.perkPicks).toBe(3)
    expect(nextPerkLevel(warrior)).toBe(8)
    expect('spellPicks' in warrior).toBe(false)
  })

  it('climbs several levels on one large gain, with a pick at each even one', () => {
    const warrior = createWarrior()
    const gain = gainXp(warrior, xpToNextLevel(1) + xpToNextLevel(2) + xpToNextLevel(3))
    expect(gain).toMatchObject({ levelsGained: 3, skillPointsGained: 3 * skillPointsPerLevel(warrior), perksGained: 2 })
    expect([warrior.level, warrior.xp, warrior.perkPicks]).toEqual([4, 0, 2])
    expect(nextPerkLevel(warrior)).toBe(2 * PICK_LEVEL_STEP + 2)
  })
})

describe('picksAt', () => {
  it('counts the three of creation and one every even level: 5 by level 5, 8 by 10, 13 by 20', () => {
    expect([1, 2, 3, 4, 5, 10, 20].map(picksAt)).toEqual([3, 4, 4, 5, 5, 8, 13])
  })
})

describe('takePerk', () => {
  it('spends one pick on a node the character qualifies for, and only once', () => {
    const warrior = createWarrior()
    warrior.level = 3
    expect(takePerk(warrior, 'dodger')).toBe(false)
    warrior.perkPicks = 2
    expect(takePerk(warrior, 'evasion')).toBe(false)
    expect(warrior.perkPicks).toBe(2)
    expect(takePerk(warrior, 'dodger')).toBe(true)
    expect(takePerk(warrior, 'dodger')).toBe(false)
    expect([warrior.perks.dodger, warrior.perkPicks]).toEqual([1, 1])
  })

  it('buys a spell with the same pick as any node', () => {
    const mage = createWarrior()
    mage.trained.magic = 32
    mage.perkPicks = 1
    expect(takePerk(mage, 'heal')).toBe(true)
    expect([mage.perkPicks, knownSpells(mage)]).toEqual([0, ['heal']])
  })

  it('adds the hit points and mana a node brings to those the character has left', () => {
    const warrior = createWarrior()
    warrior.level = 3
    warrior.perkPicks = 2
    warrior.hp = 4
    takePerk(warrior, 'toughness')
    // Toughness's 8, a point of endurance, and endurance 8 is worth 1 more for each of two levels.
    expect(warrior.hp).toBe(15)
    warrior.trained.magic = 32
    expect(takePerk(warrior, 'heal')).toBe(true)
    expect(warrior.mana).toBe(maxMana(warrior))
  })
})

describe('canAdvance', () => {
  it('holds while there are skill points, or a pick and a node on offer', () => {
    const warrior = createWarrior()
    expect(canAdvance(warrior)).toBe(false)
    warrior.skillPoints = 1
    expect(canAdvance(warrior)).toBe(true)
    warrior.skillPoints = 0
    warrior.perkPicks = 1
    expect(canAdvance(warrior)).toBe(true)
    // A pick with no node on offer is nothing to act on yet.
    warrior.perks = Object.fromEntries(PERK_IDS.filter((id) => (PERKS[id] as Perk).tier === 1).map((id) => [id, 1]))
    expect(canAdvance(warrior)).toBe(false)
    warrior.level = 2
    expect(canAdvance(warrior)).toBe(true)
  })
})

describe('planFor', () => {
  it('picks by the tagged skill: Melee knight, Archery ranger, Magic evoker_healer', () => {
    expect(READY_MADE.map((draft) => planFor(draftCharacter(draft)))).toEqual(['knight', 'ranger', 'evoker_healer'])
  })
})

describe('AUTO_PLANS', () => {
  it('names fifteen plans, each listing only nodes there are, none twice', () => {
    expect(Object.keys(AUTO_PLANS)).toEqual([...PLAN_IDS])
    for (const plan of PLAN_IDS) {
      expect(AUTO_PLANS[plan].every((id) => PERK_IDS.includes(id))).toBe(true)
      expect(new Set(AUTO_PLANS[plan]).size).toBe(AUTO_PLANS[plan].length)
    }
  })

  it('writes the parity plans as their path in PERKS order, the rogue archer the rogue path', () => {
    const path = (p: Perk['path']) => PERK_IDS.filter((id) => (PERKS[id] as Perk).path === p)
    expect(AUTO_PLANS.evoker).toEqual(path('evoker'))
    expect(AUTO_PLANS.saint).toEqual(path('saint'))
    expect(AUTO_PLANS.rogue_archer).toEqual(path('rogue'))
  })
})

describe('autoAdvance', () => {
  it('puts skill points into the weapon in hand and spends the pick by its plan, leaving nothing unspent', () => {
    const warrior = createWarrior()
    const before = skillLevel(warrior, 'melee')
    for (let i = 0; i < 2; i++) levelUp(warrior)
    autoAdvance(warrior)
    expect(skillLevel(warrior, 'melee')).toBe(before + 2 * 2 * skillPointsPerLevel(warrior) + 10)
    expect([warrior.skillPoints, warrior.perkPicks]).toEqual([0, 0])
    // The knight's plan: Weapon Training first.
    expect(warrior.perks).toEqual({ weapon_training: 1 })
    expect(warrior.hp).toBe(maxHp(warrior))
  })

  it('follows the weapon the character holds', () => {
    const archer = createWarrior()
    archer.equipment.mainHand = YEW_BOW
    levelUp(archer)
    archer.perkPicks = 0
    autoAdvance(archer)
    expect(archer.trained).toMatchObject({ archery: skillPointsPerLevel(archer), melee: 0 })
  })

  it('trains Magic for a character with a wand in hand, and only skills there are', () => {
    const mage = createWarrior()
    mage.equipment.mainHand = SPARK_WAND
    levelUp(mage)
    mage.perkPicks = 0
    autoAdvance(mage)
    expect(mage.trained).toEqual({ melee: 0, archery: 0, magic: skillPointsPerLevel(mage) })
    expect(Object.keys(mage.trained)).toEqual([...SKILL_IDS])
  })

  /** A ready-made hero raised to `level` and spent by `autoAdvance` on `plan`. */
  const grown = (index: number, level: number, plan?: Parameters<typeof autoAdvance>[1]): Character => {
    const hero = draftCharacter(READY_MADE[index])
    while (hero.level < level) levelUp(hero)
    autoAdvance(hero, plan)
    return hero
  }
  const held = (hero: Character) => PERK_IDS.filter((id) => hero.perks[id])

  it('follows each written plan in order, as far as the hero qualifies (the knight, the ranger, the evoker-healer)', () => {
    // Aldric, his three picks of levels 2, 4 and 6 spent at once: Shield Wall, Armour Breaker, then Weapon
    // Mastery (strength 9, three Swordmaster nodes), as Iron Skin asks three Heavy Knight nodes. Listed in PERKS order.
    expect(held(grown(0, 6))).toEqual(['weapon_training', 'heavy_hand', 'armor_breaker', 'weapon_mastery', 'toughness', 'shield_wall'])
    // Spent a level at a time, the same.
    const aldric = draftCharacter(READY_MADE[0])
    const order: PerkId[] = []
    while (aldric.level < 6) {
      levelUp(aldric)
      const before = held(aldric)
      autoAdvance(aldric)
      order.push(...held(aldric).filter((id) => !before.includes(id)))
    }
    expect(order).toEqual(['shield_wall', 'armor_breaker', 'weapon_mastery'])
    // Brenna: Far Shot, then Skirmisher (Deadeye is a capstone far off); Evasion asks three Rogue nodes, so the
    // fallback's first node on offer in PERKS order, Toughness.
    const brenna = grown(1, 6)
    expect(brenna.perkPicks).toBe(0)
    expect(held(brenna)).toEqual(['toughness', 'marksmanship', 'deadly_aim', 'far_shot', 'dodger', 'skirmisher'])
    // Delwyn: Destruction, Flame Arrow at 2 and 4, then Heal All at 6.
    expect(knownSpells(grown(2, 6))).toEqual(expect.arrayContaining(['magic_arrow', 'flame_arrow', 'heal', 'heal_all']))
  })

  it('spends every pick it can and never takes a capstone by the fallback', () => {
    for (const plan of PLAN_IDS) {
      for (const index of [0, 1, 2]) {
        const hero = grown(index, 14, plan)
        const capstones = PERK_IDS.filter((id) => hero.perks[id] && (PERKS[id] as Perk).tier === 'capstone')
        // A capstone comes only from a plan that names it.
        for (const capstone of capstones) expect(AUTO_PLANS[plan]).toContain(capstone)
        // A pick is left only when nothing is on offer.
        if (hero.perkPicks > 0) {
          const offered = PERK_IDS.filter((id: PerkId) => (PERKS[id] as Perk).tier !== 'capstone' && !hero.perks[id])
          expect(offered.every((id) => !takePerk({ ...hero, perks: { ...hero.perks } }, id))).toBe(true)
        }
      }
    }
  })

  it('takes the plan\'s capstone when it reaches it in the plan and the path is its calling (the evoker and Meteor)', () => {
    // Delwyn's six Evoker nodes before Meteor fill his picks to level 12; Meteor is the next, at 14.
    expect(grown(2, 12, 'evoker').perks.meteor).toBeUndefined()
    expect(grown(2, 14, 'evoker').perks.meteor).toBe(1)
  })
})
