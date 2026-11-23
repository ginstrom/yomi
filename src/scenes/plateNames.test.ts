import { describe, expect, it } from 'vitest'
import { PLATE_NAME_GAP, plateNames } from './plateNames.ts'

/** Ten pixels a character, as a monospace plate. */
const width = (name: string) => name.length * 10

describe('plateNames', () => {
  it('keeps every name whole while nothing runs into anything', () => {
    const plates = [
      { id: 'a', name: 'Freebooter Captain', x: 0, y: 0 },
      { id: 'b', name: 'Freebooter Archer', x: 100, y: 50 },
      { id: 'c', name: 'Brenna', x: 400, y: 0 },
    ]
    expect([...plateNames(plates, width).values()]).toEqual(['Freebooter Captain', 'Freebooter Archer', 'Brenna'])
  })

  it('drops the first word of both names that would run into each other on a row', () => {
    const plates = [
      { id: 'brute', name: 'Freebooter Brute', x: 0, y: 0 },
      { id: 'crossbowman', name: 'Freebooter Crossbowman', x: 100, y: 0 },
    ]
    expect(Object.fromEntries(plateNames(plates, width))).toEqual({ brute: 'Brute', crossbowman: 'Crossbowman' })
  })

  it('leaves a one-word name whole, shortening only the other', () => {
    const plates = [
      { id: 'hero', name: 'Aldric', x: 0, y: 0 },
      { id: 'foe', name: 'Bandit Captain', x: 100, y: 0 },
    ]
    expect(Object.fromEntries(plateNames(plates, width))).toEqual({ hero: 'Aldric', foe: 'Captain' })
  })

  it('stops at the gap: names exactly that far apart are kept', () => {
    const x = (60 + 60) / 2 + PLATE_NAME_GAP
    const plates = [
      { id: 'a', name: 'Bandit', x: 0, y: 0 },
      { id: 'b', name: 'Bandit', x, y: 0 },
    ]
    expect([...plateNames(plates, width).values()]).toEqual(['Bandit', 'Bandit'])
  })
})
