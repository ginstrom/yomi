import { describe, expect, it } from 'vitest'
import { onceEachEvent } from './keyEvents.ts'

describe('onceEachEvent', () => {
  it('passes each event on once, however often Phaser replays it', () => {
    const typed: string[] = []
    const handler = onceEachEvent((event: { key: string }) => typed.push(event.key))
    const b = { key: 'B' }
    const o = { key: 'o' }
    // Two keys within a frame: Phaser's queue is processed on each, so B comes again with o.
    handler(b)
    handler(b)
    handler(o)
    expect(typed).toEqual(['B', 'o'])
    // A key pressed again is a new event, and counts.
    handler({ key: 'o' })
    expect(typed).toEqual(['B', 'o', 'o'])
  })
})
