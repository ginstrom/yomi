import { describe, expect, it } from 'vitest'
import { PORTRAIT_IDS } from '../character/portraits.ts'
import { MAX_PARTY_SIZE } from '../game/party.ts'
import {
  HEADER_BOTTOM,
  PARTY_PANEL_W,
  partyColumnBottom,
  portraitBarRect,
  portraitClick,
  portraitKey,
  portraitRect,
} from './partyPanel.ts'

describe('the party column’s layout', () => {
  it('stacks the portraits down the column, each clear of the bar under the one above', () => {
    for (let i = 0; i < MAX_PARTY_SIZE; i++) {
      const portrait = portraitRect(i)
      const bar = portraitBarRect(i)
      expect(portrait.x).toBeGreaterThanOrEqual(0)
      expect(portrait.x + portrait.width).toBeLessThanOrEqual(PARTY_PANEL_W)
      expect(bar.y).toBeGreaterThanOrEqual(portrait.y + portrait.height)
      if (i > 0) {
        const above = portraitBarRect(i - 1)
        expect(portrait.y).toBeGreaterThan(above.y + above.height)
      }
    }
    expect(portraitRect(0).y).toBeGreaterThan(HEADER_BOTTOM)
  })

  it('fits a full party in the least window the game gets', () => {
    // MIN_GAME_SIZE in main.ts, which a domain test cannot import: it starts the game.
    expect(partyColumnBottom(MAX_PARTY_SIZE)).toBeLessThanOrEqual(560)
    expect(partyColumnBottom(0)).toBe(HEADER_BOTTOM)
  })
})

describe('portraitKey', () => {
  it('gives every portrait a texture key of its own', () => {
    expect(new Set(PORTRAIT_IDS.map(portraitKey)).size).toBe(PORTRAIT_IDS.length)
    expect(portraitKey('knight')).toBe('portrait_knight')
  })
})

describe('portraitClick', () => {
  it('makes a member active on the first click and opens its panel on the next', () => {
    expect(portraitClick(1, 0)).toBe('activate')
    expect(portraitClick(1, 1)).toBe('open')
    expect(portraitClick(0, null)).toBe('activate')
  })

  it('opens the panel at once of a member that cannot be made active', () => {
    expect(portraitClick(1, 0, false)).toBe('open')
  })
})
