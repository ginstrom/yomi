import { describe, expect, it } from 'vitest'
import { boardHex, boardIndex } from '../game/blight.ts'
import { newExpedition, presences } from '../game/expedition.ts'
import { newGame, type GameState } from '../game/gameState.ts'
import { readyMadeParty } from '../game/party.ts'
import { UNEXPLORED, visibleHexes } from '../game/vision.ts'
import { roadTo } from '../game/trade.ts'
import { ENCAMPMENT_ID } from '../game/worldMap.ts'
import type { Hex } from '../grid/hex.ts'
import { hexInfo } from './hexInfo.ts'

/** A new game on world 1: the game, its world and its one party, the ready-made three, at home. */
function solo() {
  const game = newGame(readyMadeParty(), null, 1)
  return { game, world: game.world, party: game.parties[0] }
}

function info(game: GameState, at: Hex = game.parties[0].position) {
  return hexInfo(game, game.parties[0], visibleHexes(game.world, presences(game.parties)), at)
}

describe('hexInfo of a resource', () => {
  function site(level: 0 | 1 | 2 | 3) {
    const it = solo()
    const iron = it.world.locations.find((l) => l.id === 'iron_vein')!
    if (!it.world.held.includes('iron_vein')) it.world.held.push('iron_vein')
    if (level > 0) it.world.improvements.iron_vein = level as 1 | 2 | 3
    return { ...it, at: iron.position }
  }

  it('gives the building, its yield and strength, and a fort is lost only when corrupted', () => {
    const plain = site(0)
    expect(info(plain.game, plain.at).lines).toContain('Yields 2 iron.')
    expect(info(plain.game, plain.at).lines).toContain('Next: an Outpost, 15 gold, 10 timber.')
    const outpost = site(1)
    expect(info(outpost.game, outpost.at).lines).toContain('Outpost: 3 iron every 5 days.')
    expect(info(outpost.game, outpost.at).lines).toContain('Strength 6 against the blight.')
    const works = site(2)
    works.world.lodge = 1
    const lines = info(works.game, works.at).lines
    expect(lines).toContain('Mine: 5 iron every 5 days.')
    expect(lines).toContain('Strength 6 against the blight.')
    expect(lines).toContain('Next: a Fort, 50 gold, 20 iron, 10 stone (needs Lodge 2).')
    expect(lines).not.toContain('Lost only when corrupted.')
    const fort = site(3)
    const fortLines = info(fort.game, fort.at).lines
    expect(fortLines).toContain('Fort: 5 iron every 5 days.')
    expect(fortLines).toContain('Lost only when corrupted.')
    expect(fortLines.some((l) => l.startsWith('Next:'))).toBe(false)
  })

  it('counts a fort threatened at level 2 to the day corruption takes it', () => {
    const fort = site(3)
    fort.world.threatened.push('iron_vein')
    fort.world.locations.push({ id: 'besiegers', kind: 'monsters', name: 'Besiegers', position: { q: fort.at.q + 2, r: fort.at.r }, encounter: 'goblin_raid', threat: 40, loot: [] })
    const i = boardIndex(fort.world.board, fort.at)
    fort.world.seen[i] = 2
    const line = info(fort.game, fort.at).lines.find((l) => l.startsWith('Under threat'))
    expect(line).toMatch(/^Under threat: falls in \d+ days?\.$/)
  })
})

describe('hexInfo', () => {
  it('names every party standing on the hex, with its members, and how far the selected party is from it', () => {
    const { game, party } = solo()
    const there = { q: party.position.q + 2, r: party.position.r }
    game.parties.push({ ...newExpedition(readyMadeParty(), there), id: 'party_2', name: 'Second Company' })
    game.parties.push({ ...newExpedition(readyMadeParty().slice(0, 1), there), id: 'party_3', name: 'Third Company' })
    const { lines } = info(game, there)
    expect(lines).toContain('Second Company:')
    expect(lines).toContain('Third Company:')
    expect(lines).not.toContain('First Company:')
    expect(lines.indexOf('Third Company:')).toBe(lines.indexOf('Second Company:') + 4)
    expect(lines.at(-1)).toBe('2 days away.')
    expect(info(game)).toMatchObject({ lines: expect.arrayContaining(['First Company:']) })
  })

  it('tells of the encampment, the party standing there and its blight', () => {
    const { game, world, party } = solo()
    const oakvale = world.locations.find((l) => l.id === ENCAMPMENT_ID)!
    party.position = oakvale.position
    const { title, lines } = info(game)
    expect(title).toBe(oakvale.name)
    expect(lines).toContain('Your encampment.')
    expect(lines).toContain('Blight: clean.')
    expect(lines).toContain('Your party:')
    expect(lines.some((line) => line.includes(party.members[0].name))).toBe(true)
  })

  it('says nothing of a hex never explored but how far it is', () => {
    const { game, world } = solo()
    const at = boardHex(world.board, world.seen.indexOf(UNEXPLORED))
    const { title, lines } = info(game, at)
    expect(title).toBe('Unexplored')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^\d+ days away\.$/)
  })

  it('hides monsters not yet sighted and names them once they are', () => {
    const { game, world } = solo()
    const monsters = world.locations.find((l) => l.kind === 'monsters' && !world.sighted.includes(l.id))!
    world.seen[boardIndex(world.board, monsters.position)] = 2
    expect(info(game, monsters.position).title).toBe('Open land')
    world.sighted.push(monsters.id)
    const { title, lines } = info(game, monsters.position)
    expect(title).toBe(monsters.name)
    expect(lines.some((line) => line.startsWith('Monsters, threat'))).toBe(true)
  })

  it('tells the blight out of sight as last seen', () => {
    const { game, world, party } = solo()
    const at = boardHex(world.board, world.seen.indexOf(UNEXPLORED))
    world.seen[boardIndex(world.board, at)] = 2
    const { lines } = hexInfo(game, party, new Set(), at)
    expect(lines).toContain('Blight: blighted (as last seen).')
    expect(lines).toContain('Out of sight.')
  })
})

describe('hexInfo of a trade partner', () => {
  it('names it and its good, with no resource lines', () => {
    const { game, world } = solo()
    const millbrook = world.locations.find((l) => l.id === 'millbrook')!
    world.seen[boardIndex(world.board, millbrook.position)] = 1
    const { title, lines } = info(game, millbrook.position)
    expect(title).toBe('Millbrook')
    expect(lines).toContain('Trade partner: timber.')
    expect(lines.some((l) => /Resource|Yields|Next:|Strength/.test(l))).toBe(false)
  })
})

describe('hexInfo of a partner and its road (stage 8)', () => {
  function withRoute() {
    const it = solo()
    it.world.contacted.push('millbrook')
    const road = roadTo(it.world, 'millbrook')!
    it.world.routes.push({ id: 'route_millbrook', partner: 'millbrook', road, opened: 1, raidedDays: 0 })
    const millbrook = it.world.locations.find((l) => l.id === 'millbrook')!
    return { ...it, road, at: millbrook.position }
  }

  it('hides a partner until its hex is seen, then tells it', () => {
    const { game, world, at } = withRoute()
    world.seen[boardIndex(world.board, at)] = UNEXPLORED
    expect(info(game, at).title).toBe('Unexplored')
    world.seen[boardIndex(world.board, at)] = 0
    const shown = info(game, at)
    expect(shown.title).toBe('Millbrook')
    expect(shown.lines).toContain('Trade partner: timber.')
    expect(shown.lines.some((l) => l.startsWith('Route open: security '))).toBe(true)
    expect(shown.lines.some((l) => l.startsWith('The Millbrook road:'))).toBe(true)
  })

  it('tells the road on an unexplored road hex', () => {
    const { game, world, road } = withRoute()
    const hex = road[2]
    world.seen[boardIndex(world.board, hex)] = UNEXPLORED
    const shown = info(game, hex)
    expect(shown.title).toBe('Unexplored')
    expect(shown.lines.some((l) => l.startsWith('The Millbrook road: security'))).toBe(true)
  })

  it('tells nothing of roads off them', () => {
    const { game } = withRoute()
    expect(info(game).lines.some((l) => l.includes('road'))).toBe(false)
  })
})
