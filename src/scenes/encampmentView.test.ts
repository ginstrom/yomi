import { readFileSync } from 'node:fs'
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

  it('draws the guild hall’s barracks at levels 4 and 5, frames the atlas has, as it has every facility’s every level', () => {
    expect(facilityFrame({ id: 'guild_hall', level: 4 })).toBe('camp_guild_hall/level_4')
    expect(facilityFrame({ id: 'guild_hall', level: 5 })).toBe('camp_guild_hall/level_5')
    const atlas = JSON.parse(readFileSync('public/assets/sprites/atlas.json', 'utf8')) as { frames: Record<string, unknown> }
    const names = new Set(Object.keys(atlas.frames))
    for (const facility of facilities(newGame(), newGame().parties[0])) {
      for (let level = 1; level <= facility.maxLevel; level++) expect(names, `${facility.id} ${level}`).toContain(facilityFrame({ id: facility.id, level }))
    }
  })

  it('labels each by its name and level', () => {
    expect(facilityLabel({ name: 'Shrine', level: 0, maxLevel: 3 })).toBe('Shrine: empty plot')
    expect(facilityLabel({ name: 'Guild Hall', level: 2, maxLevel: 3 })).toBe('Guild Hall 2/3')
  })

  it('gives every facility a plot of its own', () => {
    const plots = facilities(newGame(), newGame().parties[0]).map((_, i) => plotAt(i))
    expect(new Set(plots.map(({ x, y }) => `${x},${y}`)).size).toBe(plots.length)
  })
})
