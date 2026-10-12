import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { IRON_SWORD, MAGIC_ITEMS, OAK_SHIELD, STEEL_ARMOR, STEEL_GREATSWORD, WEAPONS, YEW_BOW } from '../inventory/inventory.ts'
import { GEAR_SPRITES, gearLayers, spriteAnim, spriteFrame, UNIT_REST_FRAME } from './unitLook.ts'

const atlas = JSON.parse(readFileSync('public/assets/sprites/atlas.json', 'utf8')) as { frames: Record<string, unknown> }
const anims = JSON.parse(readFileSync('public/assets/sprites/atlas.anims.json', 'utf8')) as { anims: Array<{ key: string }> }

describe('gearLayers', () => {
  it('shows nothing over empty hands', () => {
    expect(gearLayers({})).toEqual([])
    expect(gearLayers({ armor: STEEL_ARMOR })).toEqual([])
  })

  it('draws the weapon, then the shield over it', () => {
    expect(gearLayers({ mainHand: IRON_SWORD, offHand: OAK_SHIELD })).toEqual(['gear_sword', 'gear_shield'])
    expect(gearLayers({ offHand: OAK_SHIELD })).toEqual(['gear_shield'])
    expect(gearLayers({ mainHand: YEW_BOW })).toEqual(['gear_bow'])
  })

  it('leaves the off hand out beside a two-handed weapon', () => {
    expect(gearLayers({ mainHand: STEEL_GREATSWORD, offHand: OAK_SHIELD })).toEqual(['gear_greatsword'])
  })

  it('has a sprite for everything that can be held', () => {
    const held = [...WEAPONS, ...MAGIC_ITEMS, OAK_SHIELD].filter((i) => i.slot === 'mainHand' || i.slot === 'offHand')
    expect(held.length).toBeGreaterThan(WEAPONS.length)
    for (const item of held) expect(GEAR_SPRITES[item.icon], item.id).toBeDefined()
  })

  it('names only sprites the atlas has, each with an idle animation', () => {
    for (const sprite of Object.values(GEAR_SPRITES)) {
      expect(atlas.frames[spriteFrame(sprite, UNIT_REST_FRAME)], sprite).toBeDefined()
      expect(anims.anims.map((a) => a.key)).toContain(spriteAnim(sprite, 'idle'))
    }
  })
})
