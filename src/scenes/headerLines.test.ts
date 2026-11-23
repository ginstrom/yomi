import { describe, expect, it } from 'vitest'
import { headerLines, wrapLine } from './headerLines.ts'

const STOCK = 'Stock: gold 12, iron 6, timber 4, stone 3, silver 2'

describe('wrapLine', () => {
  it('leaves a line that fits whole', () => {
    expect(wrapLine(STOCK, 80)).toEqual([STOCK])
  })

  it('breaks only after a separator, never inside an entry', () => {
    expect(wrapLine(STOCK, 24)).toEqual(['Stock: gold 12, iron 6,', 'timber 4, stone 3,', 'silver 2'])
    expect(wrapLine('Last yield: sites 3 gold; market 5 gold', 26)).toEqual(['Last yield: sites 3 gold;', 'market 5 gold'])
  })

  it('leaves a part longer than the width whole on a line of its own', () => {
    expect(wrapLine('Blighted 45% of the land known, blight +12%', 10)).toEqual(['Blighted 45% of the land known,', 'blight +12%'])
  })
})

describe('headerLines', () => {
  const lines = ['Blighted 1%', STOCK, 'Last yield: sites 3 gold']

  it('wraps every line to the width when there is no limit', () => {
    expect(headerLines(lines, 24)).toEqual(['Blighted 1%', 'Stock: gold 12, iron 6,', 'timber 4, stone 3,', 'silver 2', 'Last yield: sites 3 gold'])
  })

  it('keeps as much of the stock as the lines allow, telling how many more there are', () => {
    expect(headerLines(lines, 24, 4)).toEqual(['Blighted 1%', 'Stock: gold 12, iron 6,', 'timber 4, +2 more', 'Last yield: sites 3 gold'])
    expect(headerLines(lines, 24, 3)).toEqual(['Blighted 1%', 'Stock: gold 12, +4 more', 'Last yield: sites 3 gold'])
  })

  it('shortens nothing that fits', () => {
    expect(headerLines(lines, 80, 3)).toEqual(lines)
  })
})
