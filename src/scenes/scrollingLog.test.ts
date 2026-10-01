import { describe, expect, it } from 'vitest'
import { ScrollingLog } from './scrollingLog.ts'

function logWith(count: number, history = 50, visible = 3): ScrollingLog {
  const log = new ScrollingLog(history, visible)
  for (let i = 1; i <= count; i++) log.push(`line ${i}`)
  return log
}

describe('ScrollingLog', () => {
  it('shows the newest lines and needs no scrollbar while everything fits', () => {
    const log = logWith(2)
    expect(log.visibleLines()).toEqual(['line 1', 'line 2'])
    expect(log.maxScroll).toBe(0)
    expect(log.thumb(100, 16)).toBeNull()
  })

  it('follows new lines while scrolled to the bottom', () => {
    const log = logWith(5)
    expect(log.visibleLines()).toEqual(['line 3', 'line 4', 'line 5'])
    log.push('line 6')
    expect(log.visibleLines()).toEqual(['line 4', 'line 5', 'line 6'])
  })

  it('holds a scrolled-back view in place as lines arrive', () => {
    const log = logWith(5)
    log.scrollBy(1)
    expect(log.visibleLines()).toEqual(['line 2', 'line 3', 'line 4'])
    log.push('line 6')
    expect(log.visibleLines()).toEqual(['line 2', 'line 3', 'line 4'])
  })

  it('holds the view even when history is full and old lines drop off', () => {
    const log = logWith(5, 5)
    log.scrollBy(1)
    log.push('line 6')
    expect(log.length).toBe(5)
    expect(log.visibleLines()).toEqual(['line 2', 'line 3', 'line 4'])
  })

  it('clamps scrolling to the available history', () => {
    const log = logWith(5)
    log.scrollBy(99)
    expect(log.scrollOffset).toBe(2)
    expect(log.visibleLines()).toEqual(['line 1', 'line 2', 'line 3'])
    log.scrollBy(-99)
    expect(log.scrollOffset).toBe(0)
  })

  it('scrolls to a ratio of the history, 1 being the oldest', () => {
    const log = logWith(7)
    log.scrollToRatio(1)
    expect(log.visibleLines()).toEqual(['line 1', 'line 2', 'line 3'])
    log.scrollToRatio(0.5)
    expect(log.scrollOffset).toBe(2)
    log.scrollToRatio(-1)
    expect(log.scrollOffset).toBe(0)
  })

  it('sizes the thumb by the visible fraction and places it by scroll position', () => {
    const log = logWith(6)
    expect(log.thumb(120, 16)).toEqual({ y: 60, height: 60 })
    log.scrollToRatio(1)
    expect(log.thumb(120, 16)).toEqual({ y: 0, height: 60 })
    expect(logWith(50).thumb(120, 16)?.height).toBe(16)
  })
})
