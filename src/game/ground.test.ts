import { describe, expect, it } from 'vitest'
import { hex } from '../grid/hex.ts'
import { IRON_DAGGER, IRON_SWORD, OAK_SHIELD, YEW_BOW } from '../inventory/inventory.ts'
import { Ground, pileChanges } from './ground.ts'

describe('Ground', () => {
  it('keeps a separate pile for each hex', () => {
    const ground = new Ground()
    ground.pileAt(hex(1, 2)).push(OAK_SHIELD)
    ground.pileAt(hex(1, 2)).push(IRON_DAGGER)
    ground.pileAt(hex(3, 0)).push(YEW_BOW)
    expect(ground.pileAt(hex(1, 2))).toEqual([OAK_SHIELD, IRON_DAGGER])
    expect(ground.pileAt(hex(3, 0))).toEqual([YEW_BOW])
    expect(ground.pileAt(hex(0, 0))).toEqual([])
  })

  it('lists only the hexes with something on them', () => {
    const ground = new Ground()
    ground.pileAt(hex(0, 0))
    ground.pileAt(hex(1, 2)).push(OAK_SHIELD)
    const emptied = ground.pileAt(hex(2, 2))
    emptied.push(YEW_BOW)
    emptied.pop()
    expect(ground.piles()).toEqual([{ hex: hex(1, 2), items: [OAK_SHIELD] }])
  })
})

describe('Ground.fromPiles', () => {
  it('puts back the piles another ground listed, sharing none of its lists', () => {
    const ground = new Ground()
    ground.pileAt(hex(1, 2)).push(OAK_SHIELD, IRON_DAGGER)
    ground.pileAt(hex(3, 0)).push(YEW_BOW)
    const restored = Ground.fromPiles(ground.piles())
    expect(restored.piles()).toEqual(ground.piles())
    restored.pileAt(hex(3, 0)).pop()
    expect(ground.pileAt(hex(3, 0))).toEqual([YEW_BOW])
  })
})

describe('pileChanges', () => {
  it('tells what was dropped on a pile and what was picked up from it', () => {
    expect(pileChanges([IRON_SWORD, OAK_SHIELD], [OAK_SHIELD, YEW_BOW, IRON_DAGGER])).toEqual({
      dropped: [YEW_BOW, IRON_DAGGER],
      pickedUp: [IRON_SWORD],
    })
  })

  it('counts nothing for an item dropped and picked up again', () => {
    expect(pileChanges([OAK_SHIELD], [OAK_SHIELD])).toEqual({ dropped: [], pickedUp: [] })
  })

  it('counts each of several of the same item', () => {
    expect(pileChanges([IRON_DAGGER], [IRON_DAGGER, IRON_DAGGER, IRON_DAGGER])).toEqual({
      dropped: [IRON_DAGGER, IRON_DAGGER],
      pickedUp: [],
    })
    expect(pileChanges([IRON_DAGGER, IRON_DAGGER], [IRON_DAGGER]).pickedUp).toEqual([IRON_DAGGER])
  })
})
