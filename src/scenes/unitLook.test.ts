import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AMULET_FOCUS,
  BASE_ITEMS,
  IRON_SWORD,
  itemById,
  MAGIC_ITEMS,
  OAK_SHIELD,
  RING_FORTUNE,
  RING_PROTECTION,
  SAGE_CIRCLET,
  SHADOW_CLOAK,
  IRON_BREASTPLATE,
  IRON_GREATSWORD,
  WEAPONS,
  YEW_BOW,
} from '../inventory/inventory.ts'
import { FOE_XP, type UnitKind } from '../game/encounters.ts'
import { ARROW_SPRITE, BURST_ANIM, BURST_SPRITE, EFFECT_FRAME, MISSILE_SPRITES, TIP_POINT } from './battleEffects.ts'
import {
  CHEST_POINT,
  GEAR_SPRITES,
  GRIP_POINT,
  gearLayers,
  heroLook,
  pointFromAnchor,
  spriteAnim,
  spriteFrame,
  UNIT_REST_FRAME,
  WORN_BACK_SPRITES,
  WORN_SLOTS,
  WORN_SPRITES,
} from './unitLook.ts'

const atlas = JSON.parse(readFileSync('public/assets/sprites/atlas.json', 'utf8')) as { frames: Record<string, unknown> }
const anims = JSON.parse(readFileSync('public/assets/sprites/atlas.anims.json', 'utf8')) as { anims: Array<{ key: string }> }

describe('gearLayers', () => {
  it('shows nothing over empty hands', () => {
    expect(gearLayers({})).toEqual([])
    expect(gearLayers({ armor: IRON_BREASTPLATE })).toEqual([])
  })

  it('draws the weapon, then the shield over it', () => {
    expect(gearLayers({ mainHand: IRON_SWORD, offHand: OAK_SHIELD })).toEqual(['gear_sword', 'gear_shield'])
    expect(gearLayers({ offHand: OAK_SHIELD })).toEqual(['gear_shield'])
    expect(gearLayers({ mainHand: YEW_BOW })).toEqual(['gear_bow'])
  })

  it('leaves the off hand out beside a two-handed weapon', () => {
    expect(gearLayers({ mainHand: IRON_GREATSWORD, offHand: OAK_SHIELD })).toEqual(['gear_greatsword'])
  })

  it('has a sprite for everything that can be held', () => {
    const held = [...BASE_ITEMS, ...MAGIC_ITEMS].filter((i) => i.slot === 'mainHand' || i.slot === 'offHand')
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

describe('heroLook', () => {
  it('lays nothing under or over a hero who wears and holds nothing', () => {
    expect(heroLook({})).toEqual({ under: [], over: [] })
  })

  it('lays the breastplate over the body', () => {
    expect(heroLook({ armor: IRON_BREASTPLATE })).toEqual({ under: [], over: ['gear_breastplate'] })
  })

  it('draws the cape under the body, then armour, cloak, head and the hands over it', () => {
    const look = heroLook({
      cloak: SHADOW_CLOAK,
      armor: IRON_BREASTPLATE,
      head: SAGE_CIRCLET,
      mainHand: IRON_SWORD,
      offHand: OAK_SHIELD,
    })
    expect(look).toEqual({
      under: ['gear_cloak_back'],
      over: ['gear_breastplate', 'gear_cloak', 'gear_circlet', 'gear_sword', 'gear_shield'],
    })
  })

  it('shows nothing for the neck or the rings', () => {
    expect(heroLook({ neck: AMULET_FOCUS, ring1: RING_PROTECTION, ring2: RING_FORTUNE })).toEqual({ under: [], over: [] })
  })

  it('still leaves the off hand out beside a two-handed weapon', () => {
    expect(heroLook({ mainHand: IRON_GREATSWORD, offHand: OAK_SHIELD }).over).toEqual(['gear_greatsword'])
  })

  it('dresses a graded breastplate as the plain one', () => {
    expect(heroLook({ armor: itemById('iron_breastplate@2') }).over).toEqual(['gear_breastplate'])
  })

  it('has a sprite for everything that can be worn on the body, the head or the back', () => {
    const worn = [...BASE_ITEMS, ...MAGIC_ITEMS].filter((i) => (WORN_SLOTS as readonly string[]).includes(i.slot))
    expect(new Set(worn.map((i) => i.slot))).toEqual(new Set(WORN_SLOTS))
    for (const item of worn) expect(WORN_SPRITES[item.icon], item.id).toBeDefined()
    for (const item of worn.filter((i) => i.slot === 'cloak')) expect(WORN_BACK_SPRITES[item.icon], item.id).toBeDefined()
  })

  it('names only worn sprites the atlas has, each with idle and walk animations', () => {
    const keys = anims.anims.map((a) => a.key)
    const sprites = [...Object.values(WORN_SPRITES), ...Object.values(WORN_BACK_SPRITES)]
    expect(sprites.length).toBeGreaterThan(0)
    for (const sprite of sprites) {
      expect(atlas.frames[spriteFrame(sprite, UNIT_REST_FRAME)], sprite).toBeDefined()
      for (const anim of ['idle', 'walk']) expect(keys, sprite).toContain(spriteAnim(sprite, anim))
    }
  })
})

describe('the units', () => {
  it('has every kind of unit in the atlas, with idle and walk animations', () => {
    for (const kind of Object.keys(FOE_XP) as UnitKind[]) {
      expect(atlas.frames[spriteFrame(kind, UNIT_REST_FRAME)], kind).toBeDefined()
      for (const anim of ['idle', 'walk']) expect(anims.anims.map((a) => a.key)).toContain(spriteAnim(kind, anim))
    }
  })
})

describe('pointFromAnchor', () => {
  const frame = { pivot: { x: 0.5, y: 1 }, sourceSize: { w: 32, h: 32 }, points: { grip: [25.5, 19.5] } }

  it('measures a frame’s point from its anchor, the feet of a unit', () => {
    expect(pointFromAnchor(frame, 'grip')).toEqual({ x: 9.5, y: -12.5 })
  })

  it('finds nothing in a frame without that point, or without the atlas’s data', () => {
    expect(pointFromAnchor(frame, 'chest')).toBeNull()
    expect(pointFromAnchor({ pivot: frame.pivot, sourceSize: frame.sourceSize }, 'grip')).toBeNull()
    expect(pointFromAnchor(undefined, 'grip')).toBeNull()
  })

  it('finds the grip on every frame of the warrior, the body every hero is drawn on', () => {
    const warrior = Object.keys(atlas.frames).filter((key) => key.startsWith('warrior/'))
    expect(warrior.length).toBeGreaterThan(1)
    for (const key of warrior) expect(pointFromAnchor(atlas.frames[key], GRIP_POINT), key).not.toBeNull()
  })

  it('finds a chest on every frame of every unit, where shots and spells are aimed', () => {
    const kinds: string[] = ['warrior', ...Object.keys(FOE_XP)]
    const frames = Object.keys(atlas.frames).filter((key) => kinds.includes(key.split('/')[0]))
    expect(frames.length).toBeGreaterThan(kinds.length)
    for (const key of frames) expect(pointFromAnchor(atlas.frames[key], CHEST_POINT), key).not.toBeNull()
  })
})

describe('effect sprites', () => {
  it('are in the atlas, a shot or a dart with the tip it strikes with', () => {
    for (const sprite of [ARROW_SPRITE, ...Object.values(MISSILE_SPRITES)]) {
      expect(atlas.frames[spriteFrame(sprite, EFFECT_FRAME)], sprite).toBeDefined()
    }
    expect(pointFromAnchor(atlas.frames[spriteFrame(ARROW_SPRITE, EFFECT_FRAME)], TIP_POINT)).toEqual({ x: 7.5, y: 0.5 })
    expect(pointFromAnchor(atlas.frames[spriteFrame(MISSILE_SPRITES.dart, EFFECT_FRAME)], TIP_POINT)).not.toBeNull()
    expect(anims.anims.map((a) => a.key)).toContain(spriteAnim(BURST_SPRITE, BURST_ANIM))
  })
})
