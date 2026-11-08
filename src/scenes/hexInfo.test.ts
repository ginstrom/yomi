import { describe, expect, it } from 'vitest'
import { boardHex, boardIndex } from '../game/blight.ts'
import { presences } from '../game/expedition.ts'
import { leader, newGame, type GameState } from '../game/gameState.ts'
import { readyMadeParty } from '../game/party.ts'
import { UNEXPLORED, visibleHexes } from '../game/vision.ts'
import { ENCAMPMENT_ID } from '../game/worldMap.ts'
import type { Hex } from '../grid/hex.ts'
import { hexInfo } from './hexInfo.ts'

/** A new game on world 1: the game, its world and its one party, the ready-made three, at home. */
function solo() {
  const game = newGame(readyMadeParty(), null, 1)
  return { game, world: game.world, party: leader(game) }
}

function info(game: GameState, at: Hex = leader(game).position) {
  return hexInfo(game, leader(game), visibleHexes(game.world, presences(game.parties)), at)
}

describe('hexInfo', () => {
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
