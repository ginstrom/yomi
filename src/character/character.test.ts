import { describe, expect, it } from 'vitest'
import {
  BACKPACK_SIZE,
  IRON_DAGGER,
  IRON_SWORD,
  OAK_SHIELD,
  STEEL_ARMOR,
  STEEL_GREATSWORD,
  WEAPONS,
  YEW_BOW,
  type Item,
} from '../inventory/inventory.ts'
import {
  createCharacter,
  createWarrior,
  deriveCombatStats,
  dropEquipped,
  dropFromBackpack,
  equipFromBackpack,
  gearChanges,
  maxHp,
  pickUp,
  unequipToBackpack,
  weaponSkill,
  type Build,
} from './character.ts'
import { levelUp } from './progression.ts'
import { skillLevel } from './skills.ts'

describe('createWarrior', () => {
  it('starts at full HP with armor, sword and shield equipped and the other weapons in the backpack', () => {
    const warrior = createWarrior()
    expect([warrior.level, warrior.xp, warrior.skillPoints, warrior.perkPicks]).toEqual([1, 0, 0, 0])
    expect(warrior.hp).toBe(maxHp(warrior))
    expect(warrior.equipment).toEqual({ armor: STEEL_ARMOR, mainHand: IRON_SWORD, offHand: OAK_SHIELD })
    expect(warrior.backpack).toHaveLength(BACKPACK_SIZE)
    const carried = warrior.backpack.filter((slot) => slot !== null)
    expect(carried).toEqual(WEAPONS.filter((weapon) => weapon !== IRON_SWORD))
  })

  it('returns independent characters so one playthrough cannot leak into the next', () => {
    const a = createWarrior()
    const b = createWarrior()
    a.hp = 1
    a.backpack[0] = null
    delete a.equipment.offHand
    a.attributes.strength = 1
    a.trained.melee = 30
    a.tagged.pop()
    a.perks.toughness = 1
    expect(b).toEqual(createWarrior())
    expect(b.hp).toBe(maxHp(b))
    expect(b.backpack[0]).toBe(IRON_DAGGER)
    expect(b.equipment.offHand).toBe(OAK_SHIELD)
  })
})

describe('deriveCombatStats', () => {
  it('derives the starting warrior stats from attributes, skills and gear', () => {
    expect(deriveCombatStats(createWarrior())).toEqual({
      name: 'Warrior',
      weapon: 'Iron Longsword',
      // 10 + strength 7 + endurance 7
      maxHp: 24,
      // agility 6, breastplate 15, shield 10
      ac: 31,
      // Melee Weapons: 30 + 2 x (strength 7 + agility 6), and 20 for the tag
      toHit: 76,
      // luck
      critChance: 7,
      // the sword's 1d8+2, and 1 for strength 7
      damage: { count: 1, sides: 8, bonus: 3 },
      attackApCost: 5,
      attackRange: 1,
      actionPoints: 8,
    })
  })

  it('falls back to agility for armour and to bare hands with nothing equipped', () => {
    const naked = { ...createWarrior(), equipment: {} }
    const stats = deriveCombatStats(naked)
    expect(stats.ac).toBe(6)
    expect(stats.toHit).toBe(skillLevel(naked, 'unarmed'))
    // Unarmed 86% rolls a d6; strength adds 1.
    expect(stats.damage).toEqual({ count: 1, sides: 6, bonus: 1 })
    expect(stats.attackApCost).toBe(3)
  })

  it('takes the attack cost from the weapon in hand', () => {
    const warrior = createWarrior()
    warrior.equipment.mainHand = { ...IRON_SWORD, id: 'dagger', stats: { ...IRON_SWORD.stats, attackApCost: 2 } }
    expect(deriveCombatStats(warrior).attackApCost).toBe(2)
  })

  it('takes the reach of a ranged weapon, and 1 hex otherwise', () => {
    const warrior = createWarrior()
    expect(deriveCombatStats({ ...warrior, equipment: {} }).attackRange).toBe(1)
    warrior.equipment.mainHand = YEW_BOW
    expect(deriveCombatStats(warrior)).toMatchObject({ attackRange: 5, damage: YEW_BOW.stats!.damage })
  })

  it('gets nothing from a shield while wielding a two-handed weapon', () => {
    const warrior = createWarrior()
    warrior.equipment.mainHand = STEEL_GREATSWORD
    expect(deriveCombatStats(warrior).ac).toBe(21)
    warrior.equipment.mainHand = IRON_DAGGER
    expect(deriveCombatStats(warrior).ac).toBe(31)
  })

  it('reflects equipment changes', () => {
    const warrior = createWarrior()
    delete warrior.equipment.offHand
    expect(deriveCombatStats(warrior).ac).toBe(21)

    const ring: Item = { ...STEEL_ARMOR, id: 'ring', slot: 'ring1', stats: { toHit: 5, acBonus: 5 } }
    warrior.equipment.ring1 = ring
    expect(deriveCombatStats(warrior)).toMatchObject({ ac: 26, toHit: 81 })
  })
})

describe('createCharacter', () => {
  const ARCHER: Build = {
    attributes: { strength: 4, perception: 7, endurance: 5, intelligence: 7, agility: 7, luck: 5 },
    tagged: ['archery', 'firstAid'],
    mainHand: YEW_BOW,
  }

  it('puts the build’s weapon in hand and the rest in the backpack, the shield too when both hands are full', () => {
    const archer = createCharacter('Archer', ARCHER)
    expect(archer.equipment).toEqual({ armor: STEEL_ARMOR, mainHand: YEW_BOW })
    const carried = archer.backpack.filter((slot) => slot !== null)
    expect(carried).toEqual([...WEAPONS.filter((weapon) => weapon !== YEW_BOW), OAK_SHIELD])
    expect(archer.hp).toBe(10 + 4 + 5)
  })

  it('takes a copy of the build, so one character’s growth is not another’s', () => {
    const archer = createCharacter('Archer', ARCHER)
    archer.attributes.luck = 10
    archer.tagged.push('melee')
    expect(ARCHER.attributes.luck).toBe(5)
    expect(ARCHER.tagged).toEqual(['archery', 'firstAid'])
  })
})

describe('what a character’s numbers come from', () => {
  it('strikes with the skill of the weapon in hand', () => {
    expect([undefined, IRON_SWORD, STEEL_GREATSWORD, YEW_BOW].map(weaponSkill)).toEqual([
      'unarmed',
      'melee',
      'melee',
      'archery',
    ])
    const warrior = createWarrior()
    warrior.equipment = { mainHand: YEW_BOW }
    // An untagged skill: 30 + 2 x (perception 4 + agility 6). Strength adds nothing to a shot.
    expect(deriveCombatStats(warrior)).toMatchObject({ toHit: 50, damage: YEW_BOW.stats!.damage })
    warrior.trained.archery = 12
    expect(deriveCombatStats(warrior).toHit).toBe(62)
  })

  it('rolls a bigger die with bare hands the higher the Unarmed skill', () => {
    const brawler = createWarrior()
    brawler.equipment = {}
    brawler.tagged = []
    brawler.attributes = { ...brawler.attributes, strength: 1, agility: 1 }
    const sides = (trained: number) => {
      brawler.trained.unarmed = trained
      return deriveCombatStats(brawler).damage.sides
    }
    // From 44%: up to 54%, at 55%, at 75% and at 100%.
    expect([0, 10, 11, 31, 56].map(sides)).toEqual([2, 2, 4, 6, 8])
  })

  it('gets hit points from strength, endurance and each level', () => {
    const warrior = createWarrior()
    levelUp(warrior)
    levelUp(warrior)
    // Endurance 7 is worth 2 + 3 a level.
    expect(maxHp(warrior)).toBe(24 + 2 * 5)
    warrior.attributes.endurance = 2
    expect(maxHp(warrior)).toBe(10 + 7 + 2 + 2 * 3)
  })

  it('gets action points from agility and a critical chance from luck', () => {
    const warrior = createWarrior()
    const stats = (agility: number, luck: number) => {
      warrior.attributes = { ...warrior.attributes, agility, luck }
      const { actionPoints, critChance } = deriveCombatStats(warrior)
      return [actionPoints, critChance]
    }
    expect(stats(1, 1)).toEqual([5, 1])
    expect(stats(7, 5)).toEqual([8, 5])
    expect(stats(10, 10)).toEqual([10, 10])
  })

  it('adds what perks give', () => {
    const warrior = createWarrior()
    const plain = deriveCombatStats(warrior)
    warrior.perks = { toughness: 2, dodger: 1, heavy_hand: 2, keen_eye: 1, tireless: 1, deadly_aim: 1, far_shot: 1 }
    expect(deriveCombatStats(warrior)).toEqual({
      ...plain,
      maxHp: plain.maxHp + 12,
      ac: plain.ac + 5,
      damage: { ...plain.damage, bonus: plain.damage.bonus + 2 },
      critChance: plain.critChance + 5,
      actionPoints: plain.actionPoints + 1,
    })
    // The archer's perks tell only with a bow in hand, and the swordsman's only without.
    warrior.equipment = { mainHand: YEW_BOW }
    expect(deriveCombatStats(warrior)).toMatchObject({ attackRange: 7, damage: { count: 1, sides: 8, bonus: 1 } })
  })
})

describe('equipFromBackpack', () => {
  it('swaps the backpack item with whatever its slot held', () => {
    const warrior = createWarrior()
    const index = warrior.backpack.indexOf(IRON_DAGGER)
    expect(equipFromBackpack(warrior, index, [])).toBe(true)
    expect(warrior.equipment.mainHand).toBe(IRON_DAGGER)
    expect(warrior.equipment.offHand).toBe(OAK_SHIELD)
    expect(warrior.backpack[index]).toBe(IRON_SWORD)
  })

  it('stows the shield when a two-handed weapon is equipped', () => {
    const warrior = createWarrior()
    const index = warrior.backpack.indexOf(YEW_BOW)
    const space = warrior.backpack.indexOf(null)
    expect(equipFromBackpack(warrior, index, [])).toBe(true)
    expect(warrior.equipment.mainHand).toBe(YEW_BOW)
    expect(warrior.equipment.offHand).toBeUndefined()
    expect(warrior.backpack[index]).toBe(IRON_SWORD)
    expect(warrior.backpack[space]).toBe(OAK_SHIELD)
    expect(deriveCombatStats(warrior)).toMatchObject({ attackRange: 5, ac: 21 })
  })

  it('stows a two-handed weapon when a shield is equipped', () => {
    const warrior = createWarrior()
    equipFromBackpack(warrior, warrior.backpack.indexOf(STEEL_GREATSWORD), [])
    const index = warrior.backpack.indexOf(OAK_SHIELD)
    expect(equipFromBackpack(warrior, index, [])).toBe(true)
    expect(warrior.equipment.offHand).toBe(OAK_SHIELD)
    expect(warrior.equipment.mainHand).toBeUndefined()
    expect(warrior.backpack[index]).toBe(STEEL_GREATSWORD)
  })

  it('puts the shield in the space the two-handed weapon left when the main hand was empty', () => {
    const warrior = createWarrior()
    delete warrior.equipment.mainHand
    const index = warrior.backpack.indexOf(YEW_BOW)
    warrior.backpack.fill(IRON_DAGGER, warrior.backpack.indexOf(null))
    expect(equipFromBackpack(warrior, index, [])).toBe(true)
    expect(warrior.equipment).toMatchObject({ mainHand: YEW_BOW })
    expect(warrior.equipment.offHand).toBeUndefined()
    expect(warrior.backpack[index]).toBe(OAK_SHIELD)
  })

  it('drops the shield on the ground when the backpack has room only for the weapon coming off', () => {
    const warrior = createWarrior()
    const index = warrior.backpack.indexOf(YEW_BOW)
    warrior.backpack.fill(IRON_DAGGER, warrior.backpack.indexOf(null))
    const ground: Item[] = []
    expect(equipFromBackpack(warrior, index, ground)).toBe(true)
    expect(warrior.equipment).toEqual({ armor: STEEL_ARMOR, mainHand: YEW_BOW })
    expect(warrior.backpack[index]).toBe(IRON_SWORD)
    expect(warrior.backpack).not.toContain(null)
    expect(ground).toEqual([OAK_SHIELD])
  })

  it('drops a two-handed weapon when a shield replaces another off-hand item and the backpack is full', () => {
    const warrior = createWarrior()
    const buckler: Item = { ...OAK_SHIELD, id: 'buckler' }
    warrior.equipment = { mainHand: YEW_BOW, offHand: buckler }
    warrior.backpack.fill(IRON_DAGGER)
    warrior.backpack[0] = OAK_SHIELD
    const ground: Item[] = []
    expect(equipFromBackpack(warrior, 0, ground)).toBe(true)
    expect(warrior.equipment).toEqual({ offHand: OAK_SHIELD })
    expect(warrior.backpack[0]).toBe(buckler)
    expect(ground).toEqual([YEW_BOW])
  })

  it('leaves the backpack space empty when the slot was', () => {
    const warrior = createWarrior()
    delete warrior.equipment.mainHand
    expect(equipFromBackpack(warrior, 0, [])).toBe(true)
    expect(warrior.equipment.mainHand).toBe(IRON_DAGGER)
    expect(warrior.backpack[0]).toBeNull()
  })

  it('does nothing for an empty space', () => {
    const warrior = createWarrior()
    expect(equipFromBackpack(warrior, BACKPACK_SIZE - 1, [])).toBe(false)
    expect(warrior.equipment.mainHand).toBe(IRON_SWORD)
  })
})

describe('unequipToBackpack', () => {
  it('stows the item in the first empty space', () => {
    const warrior = createWarrior()
    const space = warrior.backpack.indexOf(null)
    expect(unequipToBackpack(warrior, 'offHand')).toBe(true)
    expect(warrior.equipment.offHand).toBeUndefined()
    expect(warrior.backpack[space]).toBe(OAK_SHIELD)
  })

  it('does nothing for an empty slot or a full backpack', () => {
    const warrior = createWarrior()
    expect(unequipToBackpack(warrior, 'head')).toBe(false)
    warrior.backpack.fill(IRON_DAGGER)
    expect(unequipToBackpack(warrior, 'mainHand')).toBe(false)
    expect(warrior.equipment.mainHand).toBe(IRON_SWORD)
  })
})

describe('dropping and picking up', () => {
  it('drops a backpack item on the ground, leaving its space empty', () => {
    const warrior = createWarrior()
    const ground: Item[] = [OAK_SHIELD]
    expect(dropFromBackpack(warrior, 0, ground)).toBe(true)
    expect(warrior.backpack[0]).toBeNull()
    expect(ground).toEqual([OAK_SHIELD, IRON_DAGGER])
    expect(dropFromBackpack(warrior, 0, ground)).toBe(false)
    expect(ground).toHaveLength(2)
  })

  it('drops an equipped item on the ground', () => {
    const warrior = createWarrior()
    const ground: Item[] = []
    expect(dropEquipped(warrior, 'offHand', ground)).toBe(true)
    expect(warrior.equipment.offHand).toBeUndefined()
    expect(ground).toEqual([OAK_SHIELD])
    expect(dropEquipped(warrior, 'head', ground)).toBe(false)
    expect(deriveCombatStats(warrior).ac).toBe(21)
  })

  it('picks an item up into the first empty backpack space', () => {
    const warrior = createWarrior()
    const ground: Item[] = [OAK_SHIELD, STEEL_ARMOR]
    const space = warrior.backpack.indexOf(null)
    expect(pickUp(warrior, ground, 1)).toBe(true)
    expect(warrior.backpack[space]).toBe(STEEL_ARMOR)
    expect(ground).toEqual([OAK_SHIELD])
  })

  it('picks nothing up from an empty spot or into a full backpack', () => {
    const warrior = createWarrior()
    const ground: Item[] = [OAK_SHIELD]
    expect(pickUp(warrior, ground, 3)).toBe(false)
    warrior.backpack.fill(IRON_DAGGER)
    expect(pickUp(warrior, ground, 0)).toBe(false)
    expect(ground).toEqual([OAK_SHIELD])
  })
})

describe('gearChanges', () => {
  it('names what each changed slot held and holds, in paperdoll order', () => {
    const warrior = createWarrior()
    const before = { ...warrior.equipment }
    expect(gearChanges(before, warrior.equipment)).toEqual([])

    equipFromBackpack(warrior, warrior.backpack.indexOf(YEW_BOW), [])
    expect(gearChanges(before, warrior.equipment)).toEqual([
      { slot: 'mainHand', from: { id: 'iron_sword', name: 'Iron Longsword' }, to: { id: 'yew_bow', name: 'Yew Bow' } },
      { slot: 'offHand', from: { id: 'oak_shield', name: 'Oak Shield' }, to: null },
    ])
  })
})

describe('deriveCombatStats weapon name', () => {
  it('names the weapon in hand, or fists', () => {
    const warrior = createWarrior()
    expect(deriveCombatStats(warrior).weapon).toBe('Iron Longsword')
    delete warrior.equipment.mainHand
    expect(deriveCombatStats(warrior).weapon).toBe('Fists')
  })
})
