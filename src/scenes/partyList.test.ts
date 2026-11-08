import { FIRST_PARTY_ID } from '../game/expedition.ts'
import { describe, expect, it } from 'vitest'
import { maxHp } from '../character/character.ts'
import { leader, newGame } from '../game/gameState.ts'
import { travel } from '../game/worldMap.ts'
import { hexEquals } from '../grid/hex.ts'
import { HEADER_BOTTOM } from './partyPanel.ts'
import {
  PARTY_LIST_W,
  SINGLE_PARTY_NAME,
  deployedParties,
  partyEntryBarRect,
  partyEntryRect,
  partyListInfo,
  type PartyListEntry,
} from './partyList.ts'

/** Where the footer starts in the least window (840×560): WorldScene's messageY − 20. */
const LEAST_FOOTER_TOP = 442

describe('deployedParties', () => {
  it('lists the one party of a new game, with its members, place and hit points', () => {
    const game = newGame(undefined, null, 1)
    const entries = deployedParties(game)
    expect(entries).toHaveLength(1)
    const [entry] = entries
    expect(entry.id).toBe(FIRST_PARTY_ID)
    expect(entry.id).toBe('party_1')
    expect(entry.name).toBe(SINGLE_PARTY_NAME)
    expect(entry.members).toEqual(leader(game).members)
    expect(entry.position).toEqual(game.world.party)
    expect(entry.hp).toBe(leader(game).members.reduce((sum, m) => sum + m.hp, 0))
    expect(entry.maxHp).toBe(leader(game).members.reduce((sum, m) => sum + maxHp(m), 0))
    expect(entry.confronting).toBeNull()
  })

  it('tells which monsters the party stands before', () => {
    const game = newGame(undefined, null, 1)
    const monsters = game.world.locations.find((l) => l.kind === 'monsters')!
    for (let tries = 0; tries < 10 && !hexEquals(game.world.party, monsters.position); tries++) {
      travel(game.world, monsters.position, leader(game).members)
    }
    expect(game.world.confronting).toBe(monsters.id)
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
    const bar = partyEntryBarRect(2, 840)
    expect(bar.y + bar.height).toBeLessThanOrEqual(LEAST_FOOTER_TOP)
  })
})

describe('partyListInfo', () => {
  const game = newGame(undefined, null, 1)
  const base = deployedParties(game)[0]

  it('names the party and tells its members and hit points, and what a click does', () => {
    const entry: PartyListEntry = { ...base, hp: 20, maxHp: 45 }
    expect(partyListInfo(entry)).toEqual({
      title: 'Your party',
      lines: [`${base.members.length} members`, 'Hit points: 20 / 45', 'Click to centre the view on it.'],
    })
  })

  it('tells the monsters a confronting party stands before', () => {
    const entry: PartyListEntry = { ...base, confronting: { id: 'm', name: 'Goblin Raid' } }
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
