import { describe, expect, it } from 'vitest'
import { createWarrior, type Character } from '../character/character.ts'
import {
  BACKPACK_SIZE,
  IRON_DAGGER,
  IRON_SWORD,
  OAK_SHIELD,
  RING_FORTUNE,
  RING_PROTECTION,
  IRON_BREASTPLATE,
  IRON_GREATSWORD,
  type EquipmentSlot,
  type Item,
} from '../inventory/inventory.ts'
import { applyMove, planDrag, validTargets, type DragSource, type DropTarget } from './gearDrag.ts'

const backpack: DropTarget = { kind: 'backpack' }
const ground: DropTarget = { kind: 'ground' }
const slot = (slot: EquipmentSlot): DropTarget => ({ kind: 'equipment', slot })

/** A warrior whose backpack holds nothing but `items` and empty spaces after them. */
function warriorCarrying(...items: Item[]): Character {
  const warrior = createWarrior()
  warrior.backpack = [...items, ...Array<null>(BACKPACK_SIZE - items.length).fill(null)]
  return warrior
}

function fullBackpack(warrior: Character): Character {
  warrior.backpack = warrior.backpack.map((item) => item ?? IRON_DAGGER)
  return warrior
}

describe('planDrag', () => {
  it('equips a backpack item dragged onto its slot', () => {
    const warrior = warriorCarrying(IRON_DAGGER)
    expect(planDrag(warrior, [], { kind: 'backpack', index: 0 }, slot('mainHand'))).toEqual({
      kind: 'equip',
      index: 0,
      slot: 'mainHand',
    })
  })

  it('equips a ring onto either ring slot', () => {
    const warrior = warriorCarrying(RING_PROTECTION)
    warrior.equipment.ring1 = RING_FORTUNE
    const from: DragSource = { kind: 'backpack', index: 0 }
    expect(planDrag(warrior, [], from, slot('ring1'))).toEqual({ kind: 'equip', index: 0, slot: 'ring1' })
    expect(planDrag(warrior, [], from, slot('ring2'))).toEqual({ kind: 'equip', index: 0, slot: 'ring2' })
  })

  it('drops a backpack item dragged onto the ground', () => {
    const warrior = warriorCarrying(IRON_DAGGER)
    expect(planDrag(warrior, [], { kind: 'backpack', index: 0 }, ground)).toEqual({ kind: 'dropBackpack', index: 0 })
  })

  it('stows an equipped item dragged onto the backpack, unless the backpack is full', () => {
    const warrior = warriorCarrying()
    const from: DragSource = { kind: 'equipment', slot: 'mainHand' }
    expect(planDrag(warrior, [], from, backpack)).toEqual({ kind: 'unequip', slot: 'mainHand' })
    expect(planDrag(fullBackpack(warrior), [], from, backpack)).toBeNull()
  })

  it('drops an equipped item dragged onto the ground, even with the backpack full', () => {
    const warrior = fullBackpack(warriorCarrying())
    expect(planDrag(warrior, [], { kind: 'equipment', slot: 'armor' }, ground)).toEqual({
      kind: 'dropEquipped',
      slot: 'armor',
    })
  })

  it('picks up a ground item dragged onto the backpack, unless the backpack is full', () => {
    const warrior = warriorCarrying()
    const from: DragSource = { kind: 'ground', index: 1 }
    expect(planDrag(warrior, [IRON_DAGGER, RING_PROTECTION], from, backpack)).toEqual({ kind: 'pickUp', index: 1 })
    expect(planDrag(fullBackpack(warrior), [IRON_DAGGER, RING_PROTECTION], from, backpack)).toBeNull()
  })

  it('picks up and equips a ground item dragged onto its slot, unless the backpack is full', () => {
    const warrior = warriorCarrying()
    const from: DragSource = { kind: 'ground', index: 0 }
    expect(planDrag(warrior, [IRON_DAGGER], from, slot('mainHand'))).toEqual({
      kind: 'pickUpEquip',
      index: 0,
      slot: 'mainHand',
    })
    expect(planDrag(fullBackpack(warrior), [IRON_DAGGER], from, slot('mainHand'))).toBeNull()
  })

  it('refuses a slot the item does not fit', () => {
    const warrior = warriorCarrying(IRON_DAGGER)
    expect(planDrag(warrior, [], { kind: 'backpack', index: 0 }, slot('offHand'))).toBeNull()
    expect(planDrag(warrior, [IRON_DAGGER], { kind: 'ground', index: 0 }, slot('head'))).toBeNull()
    // Nor does a worn item move from slot to slot, a ring from ring to ring included.
    warrior.equipment.ring1 = RING_PROTECTION
    expect(planDrag(warrior, [], { kind: 'equipment', slot: 'ring1' }, slot('ring2'))).toBeNull()
    expect(planDrag(warrior, [], { kind: 'equipment', slot: 'mainHand' }, slot('offHand'))).toBeNull()
  })

  it('refuses a drop back where the item came from', () => {
    const warrior = warriorCarrying(IRON_DAGGER)
    expect(planDrag(warrior, [], { kind: 'backpack', index: 0 }, backpack)).toBeNull()
    expect(planDrag(warrior, [IRON_DAGGER], { kind: 'ground', index: 0 }, ground)).toBeNull()
    expect(planDrag(warrior, [], { kind: 'equipment', slot: 'mainHand' }, slot('mainHand'))).toBeNull()
  })

  it('refuses a source with no item in it', () => {
    const warrior = warriorCarrying()
    expect(planDrag(warrior, [], { kind: 'backpack', index: 0 }, ground)).toBeNull()
    expect(planDrag(warrior, [], { kind: 'ground', index: 0 }, backpack)).toBeNull()
    expect(planDrag(warrior, [], { kind: 'equipment', slot: 'head' }, ground)).toBeNull()
  })

  it('takes a ghosted off hand for the two-handed weapon in the main hand', () => {
    const warrior = warriorCarrying()
    warrior.equipment = { mainHand: IRON_GREATSWORD }
    const ghost: DragSource = { kind: 'equipment', slot: 'offHand' }
    expect(planDrag(warrior, [], ghost, backpack)).toEqual({ kind: 'unequip', slot: 'mainHand' })
    expect(planDrag(warrior, [], ghost, ground)).toEqual({ kind: 'dropEquipped', slot: 'mainHand' })
    expect(planDrag(warrior, [], ghost, slot('mainHand'))).toBeNull()
  })
})

describe('validTargets', () => {
  it('lists a backpack item’s slot and the ground', () => {
    const warrior = warriorCarrying(IRON_DAGGER)
    expect(validTargets(warrior, [], { kind: 'backpack', index: 0 })).toEqual([slot('mainHand'), ground])
  })

  it('lists both ring slots for a ring', () => {
    const warrior = warriorCarrying(RING_PROTECTION)
    expect(validTargets(warrior, [], { kind: 'backpack', index: 0 })).toEqual([slot('ring1'), slot('ring2'), ground])
  })

  it('lists the backpack and the ground for a worn item, and only the ground with the backpack full', () => {
    const warrior = warriorCarrying()
    const from: DragSource = { kind: 'equipment', slot: 'armor' }
    expect(validTargets(warrior, [], from)).toEqual([backpack, ground])
    expect(validTargets(fullBackpack(warrior), [], from)).toEqual([ground])
  })

  it('lists the backpack and the item’s slot for a ground item, and nothing with the backpack full', () => {
    const warrior = warriorCarrying()
    const from: DragSource = { kind: 'ground', index: 0 }
    expect(validTargets(warrior, [IRON_BREASTPLATE], from)).toEqual([slot('armor'), backpack])
    expect(validTargets(fullBackpack(warrior), [IRON_BREASTPLATE], from)).toEqual([])
  })

  it('lists nothing for an empty source', () => {
    expect(validTargets(warriorCarrying(), [], { kind: 'backpack', index: 0 })).toEqual([])
  })
})

describe('applyMove', () => {
  it('makes each kind of move', () => {
    const warrior = warriorCarrying(IRON_DAGGER)
    const pile: Item[] = []
    expect(applyMove(warrior, pile, { kind: 'equip', index: 0, slot: 'mainHand' })).toBe(true)
    expect(warrior.equipment.mainHand).toBe(IRON_DAGGER)
    expect(warrior.backpack[0]).toBe(IRON_SWORD)

    expect(applyMove(warrior, pile, { kind: 'dropBackpack', index: 0 })).toBe(true)
    expect(pile).toEqual([IRON_SWORD])

    expect(applyMove(warrior, pile, { kind: 'unequip', slot: 'offHand' })).toBe(true)
    expect(warrior.equipment.offHand).toBeUndefined()
    expect(warrior.backpack[0]).toBe(OAK_SHIELD)

    expect(applyMove(warrior, pile, { kind: 'dropEquipped', slot: 'mainHand' })).toBe(true)
    expect(pile).toEqual([IRON_SWORD, IRON_DAGGER])

    expect(applyMove(warrior, pile, { kind: 'pickUp', index: 1 })).toBe(true)
    expect(pile).toEqual([IRON_SWORD])
    expect(warrior.backpack[1]).toBe(IRON_DAGGER)

    expect(applyMove(warrior, pile, { kind: 'pickUpEquip', index: 0, slot: 'mainHand' })).toBe(true)
    expect(pile).toEqual([])
    expect(warrior.equipment.mainHand).toBe(IRON_SWORD)
    expect(warrior.backpack.filter((item) => item !== null)).toEqual([OAK_SHIELD, IRON_DAGGER])
  })

  it('picks up and equips in place of what the slot held, which takes the space the item came into', () => {
    const warrior = warriorCarrying(IRON_DAGGER)
    const pile: Item[] = [IRON_GREATSWORD]
    expect(applyMove(warrior, pile, { kind: 'pickUpEquip', index: 0, slot: 'mainHand' })).toBe(true)
    expect(warrior.equipment.mainHand).toBe(IRON_GREATSWORD)
    expect(warrior.equipment.offHand).toBeUndefined()
    expect(warrior.backpack.slice(0, 3)).toEqual([IRON_DAGGER, IRON_SWORD, OAK_SHIELD])
    expect(pile).toEqual([])
  })

  it('picks up and equips a two-handed weapon with one backpack space free, the off-hand item falling to the ground', () => {
    const warrior = createWarrior()
    warrior.backpack = Array<Item | null>(BACKPACK_SIZE).fill(IRON_DAGGER)
    warrior.backpack[4] = null
    const pile: Item[] = [IRON_GREATSWORD]
    expect(applyMove(warrior, pile, { kind: 'pickUpEquip', index: 0, slot: 'mainHand' })).toBe(true)
    expect(warrior.equipment.mainHand).toBe(IRON_GREATSWORD)
    expect(warrior.equipment.offHand).toBeUndefined()
    expect(warrior.backpack[4]).toBe(IRON_SWORD)
    expect(pile).toEqual([OAK_SHIELD])
  })

  it('changes nothing when the move cannot be made', () => {
    const refused = [
      // Not the item's slot: neither picked up nor equipped.
      { kind: 'pickUpEquip', index: 0, slot: 'head' },
      { kind: 'equip', index: 0, slot: 'offHand' },
      { kind: 'equip', index: 5, slot: 'mainHand' },
      { kind: 'dropBackpack', index: 5 },
      { kind: 'dropEquipped', slot: 'head' },
      { kind: 'unequip', slot: 'head' },
      { kind: 'pickUp', index: 3 },
    ] as const
    for (const move of refused) {
      const warrior = warriorCarrying(IRON_DAGGER)
      const pile: Item[] = [IRON_BREASTPLATE]
      const before = structuredClone({ warrior, pile })
      expect(applyMove(warrior, pile, move), move.kind).toBe(false)
      expect({ warrior, pile }, move.kind).toEqual(before)
    }
  })

  it('picks up nothing for an equip when the backpack is full', () => {
    const warrior = fullBackpack(warriorCarrying())
    const pile: Item[] = [IRON_DAGGER]
    const before = structuredClone({ warrior, pile })
    expect(applyMove(warrior, pile, { kind: 'pickUpEquip', index: 0, slot: 'mainHand' })).toBe(false)
    expect({ warrior, pile }).toEqual(before)
  })
})
