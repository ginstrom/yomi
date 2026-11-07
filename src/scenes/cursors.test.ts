import { describe, expect, it } from 'vitest'
import { SPELLS, type SpellId } from '../combat/spells.ts'
import { CURSORS, healCursor, spellCursor } from './cursors.ts'

describe('healCursor', () => {
  it('is an inline SVG cursor with the hotspot at the centre and a crosshair fallback', () => {
    expect(healCursor()).toMatch(/^url\("data:image\/svg\+xml,[^"]+"\) 16 16, crosshair$/)
  })

  it('differs from the swords and is in CURSORS', () => {
    expect(CURSORS.heal).toBe(healCursor())
    expect(CURSORS.heal).not.toBe(CURSORS.attack)
  })
})

describe('spellCursor', () => {
  it('is the heal cursor for every friendly spell and the swords for every hostile one', () => {
    for (const id of Object.keys(SPELLS) as SpellId[]) {
      expect(spellCursor(id), id).toBe(SPELLS[id].hostile ? 'attack' : 'heal')
    }
  })

  it('covers both kinds', () => {
    const all = Object.values(SPELLS)
    expect(all.some((s) => s.hostile)).toBe(true)
    expect(all.some((s) => !s.hostile)).toBe(true)
  })
})
