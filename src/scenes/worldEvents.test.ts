import { describe, expect, it } from 'vitest'
import type { WorldEvent } from '../game/blight.ts'
import { describeWorldEvent, describeWorldEvents } from './worldEvents.ts'

const spawned: WorldEvent = { type: 'spawned', location: 'spawn_1', name: 'Kobold Nest', at: { q: 0, r: 0 }, threat: 2 }
const sighted: WorldEvent = { ...spawned, type: 'sighted' }
const captured: WorldEvent = { type: 'site_captured', site: 'gold_seam', name: 'Gold Seam' }
const threatened: WorldEvent = { type: 'site_threatened', site: 'iron_vein', name: 'Iron Vein', days: 1 }
const level: WorldEvent = { type: 'level_changed', at: { q: 0, r: 0 }, from: 1, to: 2 }
const yielded: WorldEvent = { type: 'yield', site: 'encampment', name: 'Oakvale', material: 'gold', amount: 2 }

describe('describeWorldEvent', () => {
  it('tells each event, and nothing of a level changing or of a spawn, which is told when sighted', () => {
    expect(describeWorldEvent(sighted)).toBe('You sight a Kobold Nest (threat 2).')
    expect(describeWorldEvent(spawned)).toBe('')
    expect(describeWorldEvent(threatened)).toBe('Iron Vein is under threat: the blight takes it in 1 day.')
    expect(describeWorldEvent(captured)).toBe('Gold Seam is cleansed, and now yours.')
    expect(describeWorldEvent(yielded)).toBe('Oakvale yields 2 gold.')
    expect(describeWorldEvent({ type: 'encampment_lost', name: 'Oakvale' })).toBe('The blight has taken Oakvale.')
    expect(describeWorldEvent(level)).toBe('')
  })
})

describe('describeWorldEvents', () => {
  it('tells what cut the journey short, else the last event that matters and how many more there were', () => {
    expect(describeWorldEvents([sighted, threatened, level], threatened)).toBe(describeWorldEvent(threatened))
    expect(describeWorldEvents([level, yielded])).toBe('')
    expect(describeWorldEvents([captured, level, yielded])).toBe(describeWorldEvent(captured))
    expect(describeWorldEvents([spawned, captured])).toBe(describeWorldEvent(captured))
    expect(describeWorldEvents([sighted, captured])).toBe(`${describeWorldEvent(captured)} (1 more event on the map.)`)
  })
})
