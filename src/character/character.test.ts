import { describe, expect, it } from 'vitest'
import {
  AMULET_FOCUS,
  BACKPACK_SIZE,
  IRON_DAGGER,
  IRON_SWORD,
  OAK_SHIELD,
  RING_FORTUNE,
  RING_PROTECTION,
  SAGE_CIRCLET,
  SPARK_WAND,
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
  maxMana,
  pickUp,
  unequipToBackpack,
  weaponSkill,
  type Build,
} from './character.ts'
import { levelUp, skillPointsPerLevel, takePerk } from './progression.ts'
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
    expect(stats.toHit).toBe(skillLevel(naked, 'melee'))
    // Bare hands roll a d4 whatever the skill; strength adds 1.
    expect(stats.damage).toEqual({ count: 1, sides: 4, bonus: 1 })
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
    portrait: 'ranger',
    attributes: { strength: 4, perception: 7, endurance: 5, intelligence: 7, agility: 7, luck: 5 },
    tagged: ['archery'],
    mainHand: YEW_BOW,
  }

  it('puts the build’s weapon in hand and the rest in the backpack, the shield too when both hands are full', () => {
    const archer = createCharacter('Archer', ARCHER)
    expect(archer.equipment).toEqual({ armor: STEEL_ARMOR, mainHand: YEW_BOW })
    const carried = archer.backpack.filter((slot) => slot !== null)
    expect(carried).toEqual([...WEAPONS.filter((weapon) => weapon !== YEW_BOW), OAK_SHIELD])
    expect(archer.hp).toBe(10 + 4 + 5)
    expect(archer.portrait).toBe('ranger')
  })

  it('takes a copy of the build, so one character’s growth is not another’s', () => {
    const archer = createCharacter('Archer', ARCHER)
    archer.attributes.luck = 10
    archer.tagged.push('melee')
    expect(ARCHER.attributes.luck).toBe(5)
    expect(ARCHER.tagged).toEqual(['archery'])
  })

  it('starts with the perks its build names, with no pick spent', () => {
    const mage = createCharacter('Mage', { ...ARCHER, perks: ['magic_arrow'] })
    expect([mage.perks, mage.perkPicks]).toEqual([{ magic_arrow: 1 }, 0])
    expect(createCharacter('Archer', ARCHER).perks).toEqual({})
  })
})

describe('what a character’s numbers come from', () => {
  it('strikes with the skill of the weapon in hand', () => {
    expect([undefined, IRON_SWORD, STEEL_GREATSWORD, YEW_BOW, SPARK_WAND].map(weaponSkill)).toEqual([
      'melee',
      'melee',
      'melee',
      'archery',
      'magic',
    ])
    const warrior = createWarrior()
    warrior.equipment = { mainHand: YEW_BOW }
    // An untagged skill: 30 + 2 x (perception 4 + agility 6). Strength adds nothing to a shot.
    expect(deriveCombatStats(warrior)).toMatchObject({ toHit: 50, damage: YEW_BOW.stats!.damage })
    warrior.trained.archery = 12
    expect(deriveCombatStats(warrior).toHit).toBe(62)
  })

  it('rolls the same die with bare hands however high the skill', () => {
    const brawler = createWarrior()
    brawler.equipment = {}
    brawler.trained.melee = 60
    expect(deriveCombatStats(brawler).damage).toMatchObject({ count: 1, sides: 4 })
  })

  it('strikes with Magic through a wand, which is a ranged weapon in every other respect', () => {
    const warrior = createWarrior()
    warrior.equipment = { mainHand: SPARK_WAND }
    warrior.perks = { heavy_hand: 2, deadly_aim: 1, far_shot: 1 }
    // Magic 20 + 4 x intelligence 4; nothing from strength 7, and the archer's perks tell.
    expect(deriveCombatStats(warrior)).toMatchObject({
      toHit: 36,
      attackRange: 6,
      damage: { count: 1, sides: 6, bonus: 1 },
    })
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

describe('magic', () => {
  /** The warrior, intelligence 4, taught Magic Arrow. */
  const caster = () => ({ ...createWarrior(), perks: { magic_arrow: 1 } })

  it('gives no mana and no magic to a character that knows no spell, whatever it wears', () => {
    const warrior = createWarrior()
    warrior.equipment.head = SAGE_CIRCLET
    expect(maxMana(warrior)).toBe(0)
    expect(deriveCombatStats(warrior).magic).toBeUndefined()
  })

  it('gives a caster mana by its intelligence, its level and its gear', () => {
    const mage = caster()
    expect(maxMana(mage)).toBe(8)
    mage.level = 3
    expect(maxMana(mage)).toBe(8 + 2 * 2)
    mage.equipment.head = SAGE_CIRCLET
    expect(maxMana(mage)).toBe(8 + 2 * 2 + 6)
    mage.attributes.intelligence = 9
    mage.level = 1
    mage.equipment = {}
    expect(maxMana(mage)).toBe(18)
  })

  it('fights with the spells its perks teach, at its Magic and what its gear adds to a spell', () => {
    const mage = caster()
    expect(deriveCombatStats(mage).magic).toEqual({ maxMana: 8, skill: 36, spells: ['magic_arrow'] })
    mage.equipment.neck = AMULET_FOCUS
    mage.trained.magic = 4
    expect(deriveCombatStats(mage).magic).toMatchObject({ skill: 50 })
    // The amulet helps a spell, not a wand.
    mage.equipment.mainHand = SPARK_WAND
    expect(deriveCombatStats(mage).toHit).toBe(40)
  })

  it('adds an item’s critical chance', () => {
    const warrior = createWarrior()
    warrior.equipment.ring1 = RING_FORTUNE
    warrior.equipment.ring2 = RING_FORTUNE
    expect(deriveCombatStats(warrior).critChance).toBe(7 + 10)
  })
})

describe('a perk that raises an attribute', () => {
  const at = (level: number) => {
    const warrior = createWarrior()
    while (warrior.level < level) levelUp(warrior)
    warrior.perkPicks = 1
    return warrior
  }

  it('raises hit points for endurance, the levels already gained included, and those left with them', () => {
    const warrior = at(3)
    const before = maxHp(warrior)
    warrior.hp = 10
    expect(takePerk(warrior, 'gain_endurance')).toBe(true)
    // One for the endurance, and endurance 8 is worth one more for each of two levels gained.
    expect(maxHp(warrior)).toBe(before + 3)
    expect(warrior.hp).toBe(13)
    expect(warrior.attributes.endurance).toBe(7)
  })

  it('raises hit points and, at 7 and 9, melee damage for strength', () => {
    const warrior = at(3)
    warrior.perkPicks = 2
    const before = deriveCombatStats(warrior)
    takePerk(warrior, 'gain_strength')
    expect(deriveCombatStats(warrior)).toMatchObject({ maxHp: before.maxHp + 1, damage: before.damage })
    takePerk(warrior, 'gain_strength')
    expect(deriveCombatStats(warrior).damage.bonus).toBe(before.damage.bonus + 1)
    // Melee Weapons starts from strength.
    expect(deriveCombatStats(warrior).toHit).toBe(before.toHit + 4)
  })

  it('raises armour, and action points at an even value, for agility', () => {
    const warrior = at(3)
    warrior.perkPicks = 2
    const before = deriveCombatStats(warrior)
    takePerk(warrior, 'gain_agility')
    expect(deriveCombatStats(warrior)).toMatchObject({ ac: before.ac + 1, actionPoints: before.actionPoints })
    takePerk(warrior, 'gain_agility')
    expect(deriveCombatStats(warrior)).toMatchObject({ ac: before.ac + 2, actionPoints: before.actionPoints + 1 })
  })

  it('raises the critical chance for luck', () => {
    const warrior = at(3)
    takePerk(warrior, 'gain_luck')
    expect(deriveCombatStats(warrior).critChance).toBe(8)
  })

  it('raises Magic and mana for intelligence, and the skill points of later levels only', () => {
    const mage = at(3)
    mage.perkPicks = 2
    mage.perks.magic_arrow = 1
    const before = { magic: skillLevel(mage, 'magic'), mana: maxMana(mage), points: mage.skillPoints }
    const perLevel = skillPointsPerLevel(mage)
    takePerk(mage, 'gain_intelligence')
    expect(skillLevel(mage, 'magic')).toBe(before.magic + 4)
    // Intelligence 5: 2 more at level 1; half of it is still 2 a level.
    expect(maxMana(mage)).toBe(before.mana + 2)
    expect(mage.skillPoints).toBe(before.points)
    takePerk(mage, 'gain_intelligence')
    expect(skillPointsPerLevel(mage)).toBe(perLevel + 1)
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

  it('puts a ring on the first ring slot, then the second, then in place of the first', () => {
    const warrior = createWarrior()
    const other: Item = { ...RING_FORTUNE, id: 'other_ring' }
    warrior.backpack = [RING_PROTECTION, RING_PROTECTION, other, ...Array<null>(BACKPACK_SIZE - 3).fill(null)]
    const plain = deriveCombatStats(warrior).ac
    expect(equipFromBackpack(warrior, 0, [])).toBe(true)
    expect(warrior.equipment).toMatchObject({ ring1: RING_PROTECTION })
    expect(warrior.equipment.ring2).toBeUndefined()
    expect(deriveCombatStats(warrior).ac).toBe(plain + 5)
    expect(equipFromBackpack(warrior, 1, [])).toBe(true)
    expect(warrior.equipment).toMatchObject({ ring1: RING_PROTECTION, ring2: RING_PROTECTION })
    // Two of the same ring both count.
    expect(deriveCombatStats(warrior).ac).toBe(plain + 10)
    expect(equipFromBackpack(warrior, 2, [])).toBe(true)
    expect(warrior.equipment).toMatchObject({ ring1: other, ring2: RING_PROTECTION })
    expect(warrior.backpack[2]).toBe(RING_PROTECTION)
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
