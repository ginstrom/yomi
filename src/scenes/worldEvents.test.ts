import { describe, expect, it } from 'vitest'
import type { WorldEvent } from '../game/blight.ts'
import type { DayReport } from '../game/company.ts'
import { newGame } from '../game/gameState.ts'
import { describeDays, describePartyEvent, describeWorldEvent, describeWorldEvents } from './worldEvents.ts'

const spawned: WorldEvent = { type: 'spawned', location: 'spawn_1', name: 'Kobold Nest', at: { q: 0, r: 0 }, threat: 2 }
const sighted: WorldEvent = { ...spawned, type: 'sighted' }
const captured: WorldEvent = { type: 'site_captured', site: 'gold_seam', name: 'Gold Seam' }
const threatened: WorldEvent = { type: 'site_threatened', site: 'iron_vein', name: 'Iron Vein', days: 1 }
const level: WorldEvent = { type: 'level_changed', at: { q: 0, r: 0 }, from: 1, to: 2 }
const yielded: WorldEvent = { type: 'yield', site: 'encampment', name: 'Oakvale', material: 'gold', amount: 2 }

describe('describeWorldEvent', () => {
  it('tells each event, and nothing of a level changing or of a spawn, which is told when sighted', () => {
    expect(describeWorldEvent(sighted)).toBe('You sight a Kobold Nest (threat 2).')
    expect(describeWorldEvent({ ...sighted, name: 'The Blight Source', threat: 5, source: true })).toBe(
      'You have found the heart of the blight, the Blight Source (threat 5). Destroy it to end the blight.',
    )
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

describe('describeDays', () => {
  const world = newGame(undefined, null, 1).world
  const quiet = (): DayReport => ({ events: [], partyEvents: [], parties: [], interrupt: null })

  it('calls a day with nothing to tell a quiet one', () => {
    expect(describeDays([quiet()], world, 30)).toBe('A quiet day.')
  })

  it('says the limit passed quietly', () => {
    const reports = Array.from({ length: 30 }, quiet)
    expect(describeDays(reports, world, 30)).toBe('30 days passed quietly.')
  })

  it('tells the interrupt, and how many days it took', () => {
    const report: DayReport = { ...quiet(), events: [captured], interrupt: { party: null, event: captured } }
    expect(describeDays([quiet(), quiet(), report], world, 30)).toBe(`After 3 days: ${describeWorldEvent(captured)}`)
    expect(describeDays([report], world, 30)).toBe(describeWorldEvent(captured))
  })

  it('tells a party event in its own words, coming upon monsters rather than arriving', () => {
    const monsters = world.locations.find((l) => l.kind === 'monsters')!
    const arrived = { type: 'arrived', party: 'party_1', at: monsters.position } as const
    const confronting = { type: 'confronting', party: 'party_1', location: monsters.id } as const
    const report: DayReport = { ...quiet(), partyEvents: [arrived, confronting], interrupt: { party: 'party_1', event: arrived } }
    expect(describeDays([report], world, 30)).toBe(describePartyEvent(confronting, world))
    expect(describeDays([report], world, 30)).toMatch(/^You come upon the /)
    expect(describeDays([{ ...report, partyEvents: [arrived] }], world, 30)).toBe('The party arrives.')
    const source = world.locations.find((l) => l.id === 'blight_source')!
    expect(describePartyEvent({ ...confronting, location: source.id }, world)).toBe('You come upon the Blight Source (threat 5).')
  })

  it('adds the hit points rest healed', () => {
    const report: DayReport = { ...quiet(), parties: [{ party: 'party_1', walked: null, rested: 3, cast: 2, made: null }] }
    expect(describeDays([report], world, 30)).toBe('A quiet day. Rest heals 5 hp.')
  })
})
