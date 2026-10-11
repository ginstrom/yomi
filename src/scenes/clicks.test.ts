import { describe, expect, it } from 'vitest'
import { isSecondaryClick } from './clicks.ts'

function click(right: boolean, ctrlKey?: boolean) {
  return { rightButtonDown: () => right, event: { ctrlKey } }
}

describe('isSecondaryClick', () => {
  it('is true of a right-click', () => {
    expect(isSecondaryClick(click(true, false))).toBe(true)
  })

  it('is true of a left-click with Ctrl held', () => {
    expect(isSecondaryClick(click(false, true))).toBe(true)
  })

  it('is false of a plain left-click', () => {
    expect(isSecondaryClick(click(false, false))).toBe(false)
    expect(isSecondaryClick(click(false))).toBe(false)
  })
})
