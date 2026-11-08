import { FIRST_PARTY_ID, newExpedition, type Expedition, type Order } from '../game/expedition.ts'
import { describe, expect, it } from 'vitest'
import { maxHp } from '../character/character.ts'
import { newGame } from '../game/gameState.ts'
import { readyMadeParty } from '../game/party.ts'
import { boardIndex } from '../game/blight.ts'
import { UNEXPLORED } from '../game/vision.ts'
import { SOURCE_ID, locationAt, theName, theNameCapital, travel } from '../game/worldMap.ts'
import { hexEquals } from '../grid/hex.ts'
import { HEADER_BOTTOM } from './partyPanel.ts'
import {
  ORDER_COLS,
  PARTY_LIST_W,
  SINGLE_PARTY_NAME,
  deployedParties,
  orderLabel,
  orderLines,
  partyEntryBarRect,
  partyEntryOrderRect,
  partyEntryRect,
  partyListInfo,
  standingRoute,
  travelLabel,
  type PartyListEntry,
} from './partyList.ts'

/** Where the footer starts in the least window (840×560): WorldScene's messageY − 20, the footer having a row of time buttons over its row of actions. */
const LEAST_FOOTER_TOP = 390

describe('deployedParties', () => {
  it('lists the one party of a new game, with its members, place and hit points', () => {
    const game = newGame(undefined, null, 1)
    const entries = deployedParties(game)
    expect(entries).toHaveLength(1)
    const [entry] = entries
    expect(entry.id).toBe(FIRST_PARTY_ID)
    expect(entry.id).toBe('party_1')
    expect(entry.name).toBe(SINGLE_PARTY_NAME)
    expect(entry.members).toEqual(game.parties[0].members)
    expect(entry.position).toEqual(game.parties[0].position)
    expect(entry.hp).toBe(game.parties[0].members.reduce((sum, m) => sum + m.hp, 0))
    expect(entry.maxHp).toBe(game.parties[0].members.reduce((sum, m) => sum + maxHp(m), 0))
    expect(entry.confronting).toBeNull()
  })

  it('names the parties by their own names once there are several', () => {
    const game = newGame(undefined, null, 1)
    game.parties.push({ ...newExpedition(readyMadeParty(), game.parties[0].position), id: 'party_2', name: 'Second Company' })
    expect(deployedParties(game).map(({ id, name }) => [id, name])).toEqual([
      ['party_1', 'First Company'],
      ['party_2', 'Second Company'],
    ])
  })

  it('tells which monsters the party stands before', () => {
    const game = newGame(undefined, null, 1)
    const monsters = game.world.locations.find((l) => l.kind === 'monsters')!
    for (let tries = 0; tries < 10 && !hexEquals(game.parties[0].position, monsters.position); tries++) {
      travel(game, game.parties[0], monsters.position)
    }
    expect(game.parties[0].confronting).toBe(monsters.id)
    expect(deployedParties(game)[0].confronting).toEqual({ id: monsters.id, name: monsters.name })
  })

  it('lists nothing for an empty party', () => {
    const game = newGame([], null, 1)
    expect(deployedParties(game)).toEqual([])
  })
})

describe('the party list’s layout', () => {
  it('puts an entry inside the strip, below the header', () => {
    for (const width of [840, 1280]) {
      const tile = partyEntryRect(0, width)
      expect(tile.x).toBeGreaterThanOrEqual(width - PARTY_LIST_W)
      expect(tile.x + tile.width).toBeLessThanOrEqual(width)
      expect(tile.y).toBeGreaterThan(HEADER_BOTTOM)
      expect(tile).toMatchObject({ width: 64, height: 64 })
    }
  })

  it('puts each bar under its tile, at the tile’s x', () => {
    const tile = partyEntryRect(1, 840)
    const bar = partyEntryBarRect(1, 840)
    expect(bar).toEqual({ x: tile.x, y: tile.y + 66, width: 64, height: 6 })
  })

  it('fits three entries above the footer of the least window', () => {
    const order = partyEntryOrderRect(2, 840)
    expect(order.y + order.height).toBeLessThanOrEqual(LEAST_FOOTER_TOP)
  })
})

describe('orderLabel', () => {
  const setup = () => {
    const game = newGame(undefined, null, 1)
    const party = game.parties[0]
    const world = game.world
    const monsters = world.locations.find((l) => l.kind === 'monsters')!
    const resource = world.locations.find((l) => l.kind === 'resource')!
    const order = (o: Order) => {
      party.order = o
      return orderLabel(world, party)
    }
    return { world, party, monsters, resource, order }
  }
  const far = { q: 1, r: 1 }

  it('says Idle for a party with no order', () => {
    expect(setup().order({ kind: 'idle' })).toBe('Idle')
  })

  it('names a sighted nest a party travels to, but not an unsighted one', () => {
    const { world, monsters, order } = setup()
    world.sighted = []
    expect(order({ kind: 'travel', to: monsters.position, route: [monsters.position] })).toBe('Travelling')
    world.sighted = [monsters.id]
    expect(order({ kind: 'travel', to: monsters.position, route: [monsters.position] })).toBe(`Travelling to ${monsters.name}`)
  })

  it('names a quiet location only on explored land', () => {
    const { world, resource, order } = setup()
    const index = boardIndex(world.board, resource.position)
    world.seen[index] = UNEXPLORED
    expect(order({ kind: 'travel', to: resource.position, route: [resource.position] })).toBe('Travelling')
    world.seen[index] = 0
    expect(order({ kind: 'travel', to: resource.position, route: [resource.position] })).toBe(`Travelling to ${resource.name}`)
  })

  it('says only Travelling to a plain hex', () => {
    const { world, order } = setup()
    const empty = [far, { q: 2, r: 1 }, { q: 3, r: 1 }].find((h) => locationAt(world, h) === null)!
    expect(order({ kind: 'travel', to: empty, route: [empty] })).toBe('Travelling')
  })

  it('says Camping for a camp order, and each day action in a word', () => {
    const { order } = setup()
    expect(order({ kind: 'camp' })).toBe('Camping')
    const day = (action: Extract<Order, { kind: 'day' }>['action']) => order({ kind: 'day', action })
    expect(day({ kind: 'scout' })).toBe('Scouting')
    expect(day({ kind: 'wait' })).toBe('Waiting')
    expect(day({ kind: 'camp' })).toBe('Camping')
    expect(day({ kind: 'tower' })).toBe('Building')
    expect(day({ kind: 'outpost' })).toBe('Building')
    const place = { party: FIRST_PARTY_ID, kind: 'baggage', index: 0, id: 'x' } as never
    expect(day({ kind: 'craft', place, modifier: 'light', grade: 1 })).toBe('Crafting')
    expect(day({ kind: 'embed', place, rune: 'ember1' })).toBe('Crafting')
  })

  it('says which monsters a confronting party stands before, whatever its order', () => {
    const { party, world, monsters } = setup()
    party.confronting = monsters.id
    party.order = { kind: 'idle' }
    expect(orderLabel(world, party)).toBe(`Before the ${monsters.name}`)
  })

  it('reads a name that has its own article as one: before and travelling to the Blight Source', () => {
    const { world, party } = setup()
    const source = world.locations.find((l) => l.id === SOURCE_ID)!
    expect(source.name).toBe('The Blight Source')
    party.confronting = source.id
    expect(orderLabel(world, party)).toBe('Before the Blight Source')
    party.confronting = null
    world.sighted = [source.id]
    party.order = { kind: 'travel', to: source.position, route: [source.position] }
    expect(orderLabel(world, party)).toBe('Travelling to the Blight Source')
    expect(theName('Goblin Raiders')).toBe('the Goblin Raiders')
    expect(theNameCapital('Goblin Raiders')).toBe('The Goblin Raiders')
    expect(theNameCapital('The Blight Source')).toBe('The Blight Source')
  })

  it('gives a travel order’s remaining route as the standing route, and none for any other order', () => {
    const { party } = setup()
    party.order = { kind: 'travel', to: far, route: [{ q: 2, r: 1 }, far] }
    expect(standingRoute(party)).toEqual([{ q: 2, r: 1 }, far])
    for (const order of [{ kind: 'idle' }, { kind: 'camp' }, { kind: 'day', action: { kind: 'wait' } }] as Order[]) {
      party.order = order
      expect(standingRoute(party)).toEqual([])
    }
  })

  it('gives a travel order’s line for a destination alone', () => {
    const { world, monsters } = setup()
    world.sighted = [monsters.id]
    expect(travelLabel(world, monsters.position)).toBe(`Travelling to ${monsters.name}`)
    expect(travelLabel(world, far)).toBe('Travelling')
  })

  it('shows an order line given in place of one party’s own, as while a walk plays', () => {
    const game = newGame(undefined, null, 1)
    expect(deployedParties(game, { party: FIRST_PARTY_ID, order: 'Travelling' })[0].order).toBe('Travelling')
    expect(deployedParties(game, { party: 'party_9', order: 'Travelling' })[0].order).toBe('Idle')
    expect(deployedParties(game, null)[0].order).toBe('Idle')
  })

  it('is carried by the party list’s entries', () => {
    const game = newGame(undefined, null, 1)
    expect(deployedParties(game)[0].order).toBe('Idle')
    const camp: Expedition = game.parties[0]
    camp.order = { kind: 'camp' }
    expect(deployedParties(game)[0].order).toBe('Camping')
  })
})

describe('orderLines', () => {
  it('keeps a short label on one line', () => {
    expect(orderLines('Idle')).toEqual(['Idle'])
  })

  it('wraps onto two lines within the strip', () => {
    expect(orderLines('Travelling to Troll')).toEqual(['Travelling to', 'Troll'])
  })

  it('cuts what does not fit in two lines with an ellipsis', () => {
    const lines = orderLines('Travelling to Salamander Pool')
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('…')).toBe(true)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(ORDER_COLS)
  })

  it('cuts a word too long for a line', () => {
    expect(orderLines('Supercalifragilistic')[0]).toHaveLength(ORDER_COLS)
  })
})

describe('the order line’s place', () => {
  it('lies under the bar, inside the strip, and clear of the next entry', () => {
    const bar = partyEntryBarRect(0, 840)
    const order = partyEntryOrderRect(0, 840)
    expect(order.y).toBeGreaterThanOrEqual(bar.y + bar.height)
    expect(order.x).toBeGreaterThanOrEqual(840 - PARTY_LIST_W)
    expect(order.x + order.width).toBeLessThanOrEqual(840)
    expect(order.y + order.height).toBeLessThanOrEqual(partyEntryRect(1, 840).y)
  })
})

describe('partyListInfo', () => {
  const game = newGame(undefined, null, 1)
  const base = deployedParties(game)[0]

  it('names the party and tells its members and hit points, and what a click does', () => {
    const entry: PartyListEntry = { ...base, hp: 20, maxHp: 45 }
    expect(partyListInfo(entry)).toEqual({
      title: 'Your party',
      lines: [`${base.members.length} members`, 'Hit points: 20 / 45', 'Idle', 'Click to centre the view on it.'],
    })
  })

  it('tells the monsters a confronting party stands before, once', () => {
    const entry: PartyListEntry = { ...base, confronting: { id: 'm', name: 'Goblin Raid' }, order: 'Before the Goblin Raid' }
    expect(partyListInfo(entry).lines).toEqual([
      `${base.members.length} members`,
      `Hit points: ${base.hp} / ${base.maxHp}`,
      'Before the Goblin Raid',
      'Click to centre the view on it.',
    ])
  })

  it('says “1 member” for one', () => {
    const entry: PartyListEntry = { ...base, members: base.members.slice(0, 1) }
    expect(partyListInfo(entry).lines[0]).toBe('1 member')
  })
})
