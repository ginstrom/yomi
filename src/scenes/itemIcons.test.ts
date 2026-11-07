import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BASE_ITEMS, MAGIC_ITEMS, itemById } from '../inventory/inventory.ts'
import { RUNE_IDS } from '../inventory/runes.ts'
import {
  ITEM_ICON_KEYS,
  MATERIAL_TINTS,
  RUNE_COLOURS,
  RUNE_ICON_KEYS,
  SOCKET_PIP_KEYS,
  iconTint,
  pipOffsets,
  socketPips,
} from './itemIcons.ts'

describe('item icons', () => {
  it('has an exported icon for every item there is', () => {
    for (const item of [...BASE_ITEMS, ...MAGIC_ITEMS]) {
      const key = ITEM_ICON_KEYS[item.icon]
      expect(key, item.id).toBeDefined()
      expect(existsSync(`public/assets/sprites/${key}.png`), key).toBe(true)
    }
  })

  it('tints a tier-2 item by its material, and nothing else', () => {
    expect(Object.keys(MATERIAL_TINTS).sort()).toEqual(['ironwood', 'silk', 'steel', 'wolfhide'])
    expect(iconTint(itemById('steel_longsword@2+light1')!)).toBe(MATERIAL_TINTS.steel)
    expect(iconTint(itemById('silk_robe')!)).toBe(MATERIAL_TINTS.silk)
    expect(iconTint(itemById('iron_sword')!)).toBeUndefined()
    expect(iconTint(itemById('storm_wand')!)).toBeUndefined()
  })

  it('has an exported icon and a colour for every rune, and both pips', () => {
    for (const id of RUNE_IDS) {
      expect(RUNE_COLOURS[id], id).toBeGreaterThan(0)
      expect(existsSync(`public/assets/sprites/${RUNE_ICON_KEYS[id]}.png`), id).toBe(true)
    }
    for (const key of Object.values(SOCKET_PIP_KEYS)) expect(existsSync(`public/assets/sprites/${key}.png`), key).toBe(true)
  })

  it('lists an item\'s sockets as pips, a rune where one sits', () => {
    expect(socketPips(itemById('iron_sword')!)).toEqual([])
    expect(socketPips(itemById('iron_sword@3')!)).toEqual([null])
    expect(socketPips(itemById('iron_sword@3#ember1')!)).toEqual(['ember'])
    expect(socketPips(itemById('steel_longsword@3#storm1')!)).toEqual(['storm', null])
    expect(socketPips(itemById('emberblade')!)).toEqual([null])
  })

  it('centres a row of pips under the icon, close but not touching', () => {
    expect(pipOffsets(0, 2)).toEqual([])
    expect(pipOffsets(1, 2)).toEqual([{ x: 0, y: 17 }])
    const three = pipOffsets(3, 2)
    expect(three.map((p) => p.x)).toEqual([-10, 0, 10])
    // Inside a 46 px cell, whose half is 23.
    expect(three[2].x + 6).toBeLessThan(23)
  })
})
