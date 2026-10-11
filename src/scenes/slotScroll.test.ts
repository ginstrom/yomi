import { describe, expect, it } from 'vitest'
import { SlotScroll } from './slotScroll.ts'

/** A 5 x 2 grid over a list of `count` items. */
function scrollOver(count: number): SlotScroll {
  const scroll = new SlotScroll(5, 2)
  scroll.setCount(count)
  return scroll
}

describe('SlotScroll', () => {
  it('does not scroll a list that fits the grid', () => {
    const scroll = scrollOver(10)
    expect(scroll.maxRow).toBe(0)
    expect(scroll.scrollBy(1)).toBe(false)
    expect(scroll.firstIndex).toBe(0)
    expect(scroll.thumb(100, 16)).toBeNull()
  })

  it('scrolls a row at a time until the last item is in view', () => {
    const scroll = scrollOver(21)
    expect(scroll.maxRow).toBe(3)
    expect(scroll.scrollBy(1)).toBe(true)
    expect(scroll.firstIndex).toBe(5)
    scroll.scrollBy(10)
    expect(scroll.row).toBe(3)
    expect(scroll.firstIndex).toBe(15)
    expect(scroll.scrollBy(1)).toBe(false)
    scroll.scrollBy(-10)
    expect(scroll.row).toBe(0)
  })

  it('jumps to the end of the list', () => {
    const scroll = scrollOver(11)
    scroll.scrollToEnd()
    expect(scroll.firstIndex).toBe(5)
  })

  it('pulls the view back when the list shrinks from under it', () => {
    const scroll = scrollOver(16)
    scroll.scrollToEnd()
    expect(scroll.row).toBe(2)
    scroll.setCount(15)
    expect(scroll.row).toBe(1)
    scroll.setCount(3)
    expect(scroll.row).toBe(0)
  })

  it('scrolls one row for a notch of a mouse wheel', () => {
    const scroll = scrollOver(30)
    expect(scroll.wheel(100)).toBe(true)
    expect(scroll.row).toBe(1)
    expect(scroll.wheel(-100)).toBe(true)
    expect(scroll.row).toBe(0)
  })

  it('builds up the small deltas of a trackpad swipe into rows', () => {
    const scroll = scrollOver(30)
    expect(scroll.wheel(15)).toBe(false)
    expect(scroll.wheel(15)).toBe(false)
    expect(scroll.wheel(15)).toBe(true)
    expect(scroll.row).toBe(1)
    // Turning round drops what had built up the other way.
    scroll.wheel(30)
    expect(scroll.wheel(-30)).toBe(false)
    expect(scroll.wheel(-30)).toBe(true)
    expect(scroll.row).toBe(0)
  })

  it('sizes the thumb to the share of rows shown and moves it with the view', () => {
    const scroll = scrollOver(20)
    expect(scroll.thumb(100, 16)).toEqual({ y: 0, height: 50 })
    scroll.scrollBy(1)
    expect(scroll.thumb(100, 16)).toEqual({ y: 25, height: 50 })
    scroll.scrollToEnd()
    expect(scroll.thumb(100, 16)).toEqual({ y: 50, height: 50 })
    expect(scrollOver(500).thumb(100, 16)?.height).toBe(16)
  })
})
