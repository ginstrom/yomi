import { describe, expect, it } from 'vitest'
import { boardHex, boardIndex } from '../game/blight.ts'
import { readyMadeParty } from '../game/party.ts'
import { UNEXPLORED, visibleHexes } from '../game/vision.ts'
import { ENCAMPMENT_ID, newWorld, type WorldState } from '../game/worldMap.ts'
import type { Hex } from '../grid/hex.ts'
import { hexInfo } from './hexInfo.ts'

const party = readyMadeParty()

function info(world: WorldState, at: Hex = world.party) {
  return hexInfo(world, party, visibleHexes(world), at)
}

describe('hexInfo', () => {
  it('tells of the encampment, the party standing there and its blight', () => {
    const world = newWorld(1)
    const oakvale = world.locations.find((l) => l.id === ENCAMPMENT_ID)!
    world.party = oakvale.position
    const { title, lines } = info(world)
    expect(title).toBe(oakvale.name)
    expect(lines).toContain('Your encampment.')
    expect(lines).toContain('Blight: clean.')
    expect(lines).toContain('Your party:')
    expect(lines.some((line) => line.includes(party[0].name))).toBe(true)
  })

  it('says nothing of a hex never explored but how far it is', () => {
    const world = newWorld(1)
    const at = boardHex(world.board, world.seen.indexOf(UNEXPLORED))
    const { title, lines } = info(world, at)
    expect(title).toBe('Unexplored')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^\d+ days away\.$/)
  })

  it('hides monsters not yet sighted and names them once they are', () => {
    const world = newWorld(1)
    const monsters = world.locations.find((l) => l.kind === 'monsters' && !world.sighted.includes(l.id))!
    world.seen[boardIndex(world.board, monsters.position)] = 2
    expect(info(world, monsters.position).title).toBe('Open land')
    world.sighted.push(monsters.id)
    const { title, lines } = info(world, monsters.position)
    expect(title).toBe(monsters.name)
    expect(lines.some((line) => line.startsWith('Monsters, threat'))).toBe(true)
  })

  it('tells the blight out of sight as last seen', () => {
    const world = newWorld(1)
    const at = boardHex(world.board, world.seen.indexOf(UNEXPLORED))
    world.seen[boardIndex(world.board, at)] = 2
    const { lines } = hexInfo(world, party, new Set(), at)
    expect(lines).toContain('Blight: blighted (as last seen).')
    expect(lines).toContain('Out of sight.')
  })
})
