import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BASE_ITEMS, MAGIC_ITEMS, itemById } from '../inventory/inventory.ts'
import { ITEM_ICON_KEYS, MATERIAL_TINTS, iconTint } from './itemIcons.ts'

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
})
