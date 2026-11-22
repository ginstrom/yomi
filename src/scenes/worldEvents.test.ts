import { describe, expect, it } from 'vitest'
import type { WorldEvent } from '../game/blight.ts'
import type { DayReport } from '../game/company.ts'
import { newExpedition } from '../game/expedition.ts'
import { newGame, type GameState } from '../game/gameState.ts'
import { readyMadeParty } from '../game/party.ts'
import type { MonsterLocation } from '../game/worldMap.ts'
import { yieldSummary, advanceMessage, describeDays, describeOthers, describeStanding, describePartyEvent, describeWalk, describeWorldEvent, describeWorldEvents } from './worldEvents.ts'

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

  it('tells an improvement built and one razed with its site', () => {
    expect(describeWorldEvent({ type: 'site_improved', site: 'iron_vein', name: 'Iron Vein', level: 1, building: 'Outpost' })).toBe('An outpost stands at Iron Vein.')
    expect(describeWorldEvent({ type: 'site_improved', site: 'iron_vein', name: 'Iron Vein', level: 2, building: 'Mine' })).toBe('A Mine stands at Iron Vein.')
    expect(describeWorldEvent({ type: 'site_lost', site: 'iron_vein', name: 'Iron Vein' })).toBe('Iron Vein is lost to the blight.')
    expect(describeWorldEvent({ type: 'site_lost', site: 'iron_vein', name: 'Iron Vein', improvement: 1 })).toBe('Iron Vein is lost to the blight, and its outpost razed.')
  })
})

describe('improvement and market lines', () => {
  it('says "stand" for a plural works, tells each level razed and the market', () => {
    expect(describeWorldEvent({ type: 'site_improved', site: 'salt_flats', name: 'Salt Flats', level: 2, building: 'Saltworks' })).toBe('Saltworks stand at Salt Flats.')
    expect(describeWorldEvent({ type: 'site_improved', site: 'iron_vein', name: 'Iron Vein', level: 3, building: 'Fort' })).toBe('A Fort stands at Iron Vein.')
    expect(describeWorldEvent({ type: 'site_lost', site: 'iron_vein', name: 'Iron Vein', improvement: 2 })).toBe('Iron Vein is lost to the blight, and its works razed.')
    expect(describeWorldEvent({ type: 'site_lost', site: 'iron_vein', name: 'Iron Vein', improvement: 3 })).toBe('Iron Vein is lost to the blight, and its fort razed.')
    expect(describeWorldEvent({ ...yielded, source: 'market', amount: 3 })).toBe('The market at Oakvale brings 3 gold.')
  })
})

describe('yieldSummary', () => {
  const site = (material: 'gold' | 'iron', amount: number): WorldEvent => ({ type: 'yield', site: 's', name: 'S', material, amount })
  const market: WorldEvent = { type: 'yield', site: 'encampment', name: 'Oakvale', material: 'gold', amount: 3, source: 'market' }
  it('sums sites by material, gold first, then the market', () => {
    expect(yieldSummary([site('iron', 3), site('gold', 1), site('iron', 2), site('gold', 3), market])).toBe('Last yield: sites 4 gold, 5 iron; market 3 gold')
    expect(yieldSummary([site('gold', 2)])).toBe('Last yield: sites 2 gold')
    expect(yieldSummary([market])).toBe('Last yield: market 3 gold')
    expect(yieldSummary([level])).toBeNull()
    expect(yieldSummary([])).toBeNull()
  })

  it('takes the heading it is given', () => {
    expect(yieldSummary([site('iron', 2)], 'Yields over 3 days')).toBe('Yields over 3 days: sites 2 iron')
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
  const game = newGame(undefined, null, 1)
  const world = game.world
  const quiet = (): DayReport => ({ events: [], partyEvents: [], parties: [], interrupt: null })

  it('calls a day with nothing to tell a quiet one', () => {
    expect(describeDays([quiet()], game, 30)).toBe('A quiet day.')
  })

  it('says the limit passed quietly', () => {
    const reports = Array.from({ length: 30 }, quiet)
    expect(describeDays(reports, game, 30)).toBe('30 days passed quietly.')
  })

  it('tells the interrupt, and how many days it took', () => {
    const report: DayReport = { ...quiet(), events: [captured], interrupt: { party: null, event: captured } }
    expect(describeDays([quiet(), quiet(), report], game, 30)).toBe(`After 3 days: ${describeWorldEvent(captured)}`)
    expect(describeDays([report], game, 30)).toBe(describeWorldEvent(captured))
  })

  it('tells a party event in its own words, coming upon monsters rather than arriving', () => {
    const monsters = world.locations.find((l) => l.kind === 'monsters')!
    const arrived = { type: 'arrived', party: 'party_1', at: monsters.position } as const
    const confronting = { type: 'confronting', party: 'party_1', location: monsters.id } as const
    const report: DayReport = { ...quiet(), partyEvents: [arrived, confronting], interrupt: { party: 'party_1', event: arrived } }
    expect(describeDays([report], game, 30)).toBe(describePartyEvent(confronting, game))
    expect(describeDays([report], game, 30)).toMatch(/^You come upon the /)
    expect(describeDays([{ ...report, partyEvents: [arrived] }], game, 30)).toBe('The party arrives.')
    const source = world.locations.find((l) => l.id === 'blight_source')!
    expect(describePartyEvent({ ...confronting, location: source.id }, game)).toBe('You come upon the Blight Source (threat 5).')
    expect(describePartyEvent({ type: 'met', party: 'party_1', other: 'party_2' }, game)).toBe('The parties meet.')
  })

  it('adds the hit points rest healed', () => {
    const report: DayReport = { ...quiet(), parties: [{ party: 'party_1', walked: null, rested: 3, cast: 2, made: null }] }
    expect(describeDays([report], game, 30)).toBe('A quiet day. Rest heals 5 hp.')
  })
})

describe('a company’s messages', () => {
  const quiet = (): DayReport => ({ events: [], partyEvents: [], parties: [], interrupt: null })
  const company = (): GameState => {
    const game = newGame(undefined, null, 1)
    game.parties.push({ ...newExpedition(readyMadeParty(), game.parties[0].position), id: 'party_2', name: 'Second Company' })
    return game
  }
  const scouts = (game: GameState) => game.world.locations.find((l) => l.kind === 'monsters')!

  it('names the party an interrupt concerns, its name first', () => {
    const game = company()
    const monsters = scouts(game)
    game.world.sighted = [monsters.id]
    const arrived = { type: 'arrived', party: 'party_2', at: monsters.position } as const
    const report: DayReport = { ...quiet(), partyEvents: [arrived], interrupt: { party: 'party_2', event: arrived } }
    expect(describeDays([report], game, 30)).toBe(`Second Company: arrived at ${monsters.name}.`)
    expect(describeDays([quiet(), report], game, 30)).toBe(`Second Company, after 2 days: arrived at ${monsters.name}.`)
    const confronting = { type: 'confronting', party: 'party_2', location: monsters.id } as const
    expect(describeDays([{ ...report, partyEvents: [arrived, confronting] }], game, 30)).toBe(
      `Second Company: came upon the ${monsters.name} (threat ${monsters.threat}).`,
    )
    const met = { type: 'met', party: 'party_2', other: 'party_1' } as const
    expect(describePartyEvent(met, game)).toBe('Second Company: met First Company.')
    expect(describePartyEvent({ type: 'order_done', party: 'party_1' }, game)).toBe('First Company: has done what it was set to.')
    expect(describeDays([{ ...quiet(), events: [sighted], interrupt: { party: 'party_1', event: sighted } }], game, 30)).toBe(
      `First Company: ${describeWorldEvent(sighted)}`,
    )
  })

  it('names no party for a world event that concerns none, nor with one party', () => {
    const game = company()
    expect(describeDays([{ ...quiet(), events: [threatened], interrupt: { party: null, event: threatened } }], game, 30)).toBe(describeWorldEvent(threatened))
    const single = newGame(undefined, null, 1)
    expect(describeDays([{ ...quiet(), events: [sighted], interrupt: { party: 'party_1', event: sighted } }], single, 30)).toBe(describeWorldEvent(sighted))
    expect(describePartyEvent({ type: 'arrived', party: 'party_1', at: { q: 0, r: 0 } }, single)).toBe('The party arrives.')
  })

  it('tells a walk as a journey, unless another party’s event stopped it', () => {
    const single = newGame(undefined, null, 1)
    const party = single.parties[0]
    expect(describeWalk(single, party, [quiet(), { ...quiet(), events: [captured] }])).toBe(describeWorldEvent(captured))
    const stop: DayReport = { ...quiet(), events: [sighted], interrupt: { party: 'party_1', event: sighted } }
    expect(describeWalk(single, party, [stop])).toBe(`Your journey stops. ${describeWorldEvent(sighted)}`)
    const game = company()
    expect(describeWalk(game, game.parties[0], [stop])).toBe(`First Company: Your journey stops. ${describeWorldEvent(sighted)}`)
    const other = { type: 'arrived', party: 'party_2', at: { q: 0, r: 0 } } as const
    const theirs: DayReport = { ...quiet(), partyEvents: [other], interrupt: { party: 'party_2', event: other } }
    expect(describeWalk(game, game.parties[0], [quiet(), theirs])).toBe('Second Company, after 2 days: arrived.')
    const met = { type: 'met', party: 'party_1', other: 'party_2' } as const
    expect(describeWalk(game, game.parties[0], [{ ...quiet(), partyEvents: [met], interrupt: { party: 'party_1', event: met } }])).toBe(
      'First Company: met Second Company.',
    )
  })

  it('tells a walk that ends among monsters as coming upon them', () => {
    const single = newGame(undefined, null, 1)
    const party = single.parties[0]
    const monsters = scouts(single)
    party.position = monsters.position
    expect(describeWalk(single, party, [quiet()])).toBe(`You come upon the ${monsters.name} (threat ${monsters.threat}).`)
    const game = company()
    game.parties[1].position = monsters.position
    expect(describeWalk(game, game.parties[1], [quiet()])).toBe(`Second Company: came upon the ${monsters.name} (threat ${monsters.threat}).`)
  })

  it('tells what else a party’s own day brought: another party’s event, named, after its own order done', () => {
    const game = company()
    const [first, second] = game.parties
    const monsters = scouts(game)
    game.world.sighted = [monsters.id]
    const done = { type: 'order_done', party: first.id } as const
    const arrived = { type: 'arrived', party: second.id, at: monsters.position } as const
    const confronting = { type: 'confronting', party: second.id, location: monsters.id } as const
    const own: DayReport = { ...quiet(), partyEvents: [done], interrupt: { party: first.id, event: done } }
    expect(describeOthers(game, first, [own])).toEqual({ text: '', party: null })
    const theirs: DayReport = { ...own, partyEvents: [done, arrived, confronting] }
    expect(describeOthers(game, first, [theirs])).toEqual({
      text: `Second Company: came upon the ${monsters.name} (threat ${monsters.threat}).`,
      party: second.id,
    })
    const stopShort = { type: 'order_done', party: second.id } as const
    expect(describeOthers(game, first, [{ ...own, partyEvents: [done, stopShort] }])).toEqual({
      text: 'Second Company: has done what it was set to.',
      party: second.id,
    })
    const met = { type: 'met', party: second.id, other: first.id } as const
    expect(describeOthers(game, first, [{ ...own, partyEvents: [done, met] }]).text).toBe('Second Company: met First Company.')
  })

  it('tells a notable world event that stopped the day, else the day’s world events', () => {
    const game = company()
    const first = game.parties[0]
    const done = { type: 'order_done', party: first.id } as const
    const stop: DayReport = { ...quiet(), events: [captured, sighted], partyEvents: [done], interrupt: { party: first.id, event: sighted } }
    expect(describeOthers(game, first, [stop])).toEqual({ text: `First Company: ${describeWorldEvent(sighted)}`, party: first.id })
    const site: DayReport = { ...quiet(), events: [threatened], interrupt: { party: null, event: threatened } }
    expect(describeOthers(game, first, [site])).toEqual({ text: describeWorldEvent(threatened), party: null })
    expect(describeOthers(game, first, [{ ...quiet(), events: [captured], partyEvents: [done], interrupt: { party: first.id, event: done } }])).toEqual({
      text: describeWorldEvent(captured),
      party: null,
    })
  })
})

describe('describeStanding', () => {
  it('says who stands before the monsters, naming the party where there are several', () => {
    const game = newGame(undefined, null, 1)
    const monsters = game.world.locations.find((l): l is MonsterLocation => l.kind === 'monsters')!
    expect(describeStanding(game, game.parties[0], monsters)).toBe(`You stand before the ${monsters.name} (threat ${monsters.threat}).`)
    game.parties.push({ ...newExpedition(readyMadeParty(), game.parties[0].position), id: 'party_2', name: 'Second Company' })
    expect(describeStanding(game, game.parties[1], monsters)).toBe(`Second Company stands before the ${monsters.name} (threat ${monsters.threat}).`)
  })
})

describe('advanceMessage', () => {
  it('names the one hero with points to spend, or counts several, and says what the "+" is', () => {
    const party = readyMadeParty()
    expect(advanceMessage(party)).toBe('')
    party[0].skillPoints = 2
    expect(advanceMessage(party)).toBe('Aldric has points to spend: click the portrait marked "+".')
    party[2].perkPoints = 1
    expect(advanceMessage(party)).toBe('2 heroes have points to spend: click a portrait marked "+".')
  })
})

describe('trade partner lines (stage 8)', () => {
  it('tell of contact, silence and waking', () => {
    expect(describeWorldEvent({ type: 'partner_contacted', partner: 'millbrook', name: 'Millbrook', home: 'Oakvale' })).toBe('Millbrook will trade with Oakvale.')
    expect(describeWorldEvent({ type: 'partner_silent', partner: 'millbrook', name: 'Millbrook' })).toBe('Millbrook has fallen silent under the blight.')
    expect(describeWorldEvent({ type: 'partner_restored', partner: 'millbrook', name: 'Millbrook' })).toBe('Millbrook is trading again.')
  })

  it('tell of routes', () => {
    const base = { route: 'route_millbrook', partner: 'millbrook', name: 'Millbrook' }
    expect(describeWorldEvent({ type: 'route_opened', ...base, length: 12 })).toBe('A road is opened to Millbrook.')
    const sightedA = { sighted: ['a'] }
    expect(describeWorldEvent({ type: 'route_raided', ...base, cause: 'raiders', raider: 'a', raiderName: 'Goblin Brood', days: 1 }, sightedA)).toBe('Raiders on the Millbrook road: the Goblin Brood.')
    expect(describeWorldEvent({ type: 'route_raided', ...base, cause: 'raiders', raider: 'a', raiderName: 'The Goblin Raiders', days: 1 }, sightedA)).toBe('Raiders on the Millbrook road: the Goblin Raiders.')
    expect(describeWorldEvent({ type: 'route_raided', ...base, cause: 'corrupted', days: 1 })).toBe('The blight has overrun the Millbrook road.')
    expect(describeWorldEvent({ type: 'route_raided', ...base, cause: 'silent', days: 1 })).toBe('The Millbrook road is idle: Millbrook is silent.')
    expect(describeWorldEvent({ type: 'route_raided', ...base, cause: 'silent', days: 2 })).toBe('')
    expect(describeWorldEvent({ type: 'route_restored', ...base })).toBe('The Millbrook road is safe again.')
    expect(describeWorldEvent({ type: 'route_abandoned', ...base })).toBe('The Millbrook road is abandoned.')
  })

  it('names a raider only once the player has sighted it (verification round 1)', () => {
    const raided: WorldEvent = { type: 'route_raided', route: 'route_millbrook', partner: 'millbrook', name: 'Millbrook', cause: 'raiders', raider: 'spawn_3', raiderName: 'Goblin Brood', days: 1 }
    expect(describeWorldEvent(raided, { sighted: [] })).toBe('Raiders on the Millbrook road.')
    expect(describeWorldEvent(raided)).toBe('Raiders on the Millbrook road.')
    expect(describeWorldEvent(raided, { sighted: ['spawn_3'] })).toBe('Raiders on the Millbrook road: the Goblin Brood.')
    expect(describeWorldEvents([raided], null, { sighted: [] })).toBe('Raiders on the Millbrook road.')
    expect(describeWorldEvents([raided], raided, { sighted: ['spawn_3'] })).toBe('Raiders on the Millbrook road: the Goblin Brood.')
  })

  it('tells a route yield', () => {
    const routeYield = (material: 'gold' | 'timber', amount: number): WorldEvent => ({ type: 'yield', site: 'millbrook', name: 'Millbrook', material, amount, source: 'route', route: 'route_millbrook' })
    expect(describeWorldEvent(routeYield('gold', 2))).toBe('The Millbrook road brings 2 gold.')
    expect(describeWorldEvent(routeYield('timber', 1))).toBe('The Millbrook road brings 1 timber.')
  })

  it('sums routes apart from sites and the market', () => {
    const y = (material: 'gold' | 'timber' | 'iron', amount: number, source?: 'site' | 'market' | 'route'): WorldEvent => ({ type: 'yield', site: 's', name: 'S', material, amount, source })
    expect(yieldSummary([y('timber', 1, 'route'), y('gold', 2, 'route'), y('gold', 1, 'route')])).toBe('Last yield: routes 3 gold, 1 timber')
    expect(yieldSummary([y('iron', 4), y('gold', 3, 'market'), y('timber', 1, 'route'), y('gold', 2, 'route')])).toBe('Last yield: sites 4 iron; market 3 gold; routes 2 gold, 1 timber')
  })
})
