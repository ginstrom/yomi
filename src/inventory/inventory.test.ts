import { describe, expect, it } from 'vitest'
import {
  BACKPACK_SIZE,
  EQUIPMENT_SLOT_ORDER,
  IRON_SWORD,
  OAK_SHIELD,
  PLAYER_BACKPACK,
  PLAYER_EQUIPMENT,
  STEEL_ARMOR,
} from './inventory.ts'

describe('inventory', () => {
  it('defines all eleven paperdoll slots exactly once', () => {
    expect(EQUIPMENT_SLOT_ORDER).toHaveLength(11)
    expect(new Set(EQUIPMENT_SLOT_ORDER).size).toBe(11)
  })

  it('equips the starting armor, sword and shield', () => {
    expect(PLAYER_EQUIPMENT.armor).toBe(STEEL_ARMOR)
    expect(PLAYER_EQUIPMENT.mainHand).toBe(IRON_SWORD)
    expect(PLAYER_EQUIPMENT.offHand).toBe(OAK_SHIELD)
  })

  it('starts with an empty backpack of the configured size', () => {
    expect(PLAYER_BACKPACK).toHaveLength(BACKPACK_SIZE)
    expect(PLAYER_BACKPACK.every((slot) => slot === null)).toBe(true)
  })
})
