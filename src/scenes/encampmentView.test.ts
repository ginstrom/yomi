import { describe, expect, it } from 'vitest'
import { facilities } from '../game/encampment.ts'
import { newGame } from '../game/gameState.ts'
import { facilityFrame, facilityLabel, plotAt } from './encampmentView.ts'

describe('the encampment screen', () => {
  it('draws a facility not built as an empty plot, and a built one by its level', () => {
    expect(facilityFrame({ id: 'shrine', level: 0 })).toBe('camp_plot/base')
    expect(facilityFrame({ id: 'shrine', level: 2 })).toBe('camp_shrine/level_2')
    expect(facilityFrame({ id: 'guild_hall', level: 1 })).toBe('camp_guild_hall/level_1')
  })

  it('labels each by its name and level', () => {
    expect(facilityLabel({ name: 'Shrine', level: 0, maxLevel: 3 })).toBe('Shrine: empty plot')
    expect(facilityLabel({ name: 'Guild Hall', level: 2, maxLevel: 3 })).toBe('Guild Hall 2/3')
  })

  it('gives every facility a plot of its own', () => {
    const plots = facilities(newGame()).map((_, i) => plotAt(i))
    expect(new Set(plots.map(({ x, y }) => `${x},${y}`)).size).toBe(plots.length)
  })
})
