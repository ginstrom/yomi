import { describe, expect, it } from 'vitest'
import { newExpedition } from '../game/expedition.ts'
import { newGame } from '../game/gameState.ts'
import { readyMadeParty } from '../game/party.ts'
import { itemById } from '../inventory/inventory.ts'
import { baggageLines, exchangeMove, exchangePartners, itemMove, tryExchange } from './exchangeView.ts'

function twoOnOneHex() {
  const game = newGame(undefined, null, 1, 'Hearthold')
  const [first] = game.parties
  const second = newExpedition(readyMadeParty().slice(0, 1).map((m) => ({ ...m, name: 'Zed' })), { ...first.position }, 'party_2', 'Second Company')
  game.parties.push(second)
  return { game, first, second }
}

describe('exchangePartners', () => {
  it('lists the other parties on the hex', () => {
    const { game, first, second } = twoOnOneHex()
    expect(exchangePartners(game, first)).toEqual([second])
    second.position = { q: first.position.q + 1, r: first.position.r }
    expect(exchangePartners(game, first)).toEqual([])
  })
})

describe('exchangeMove', () => {
  const ids = ['party_1', 'party_2'] as const
  it('is nothing within a row', () => expect(exchangeMove({ row: 0, index: 0 }, { row: 0, index: 1 }, ids)).toBeNull())
  it('swaps with a hero of the other row, a first', () => {
    expect(exchangeMove({ row: 0, index: 2 }, { row: 1, index: 0 }, ids)).toEqual({ kind: 'swap', a: 2, b: 0 })
    expect(exchangeMove({ row: 1, index: 0 }, { row: 0, index: 2 }, ids)).toEqual({ kind: 'swap', a: 2, b: 0 })
  })
  it('moves a hero to the other row on a header click', () => {
    expect(exchangeMove({ row: 1, index: 0 }, { row: 0 }, ids)).toEqual({ kind: 'member', from: 'party_2', index: 0 })
  })
  it('moves an item', () => expect(itemMove(1, 3, ids)).toEqual({ kind: 'item', from: 'party_2', index: 3 }))
})

describe('through exchange', () => {
  it('moves a baggage item and passes a refusal through', () => {
    const { game, first, second } = twoOnOneHex()
    first.baggage.push(itemById('iron_sword')!)
    expect(baggageLines(first)).toEqual([{ id: 'iron_sword', name: expect.any(String) }])
    expect(tryExchange(game, 'party_1', 'party_2', itemMove(0, 0, ['party_1', 'party_2']))).toBeNull()
    expect(second.baggage).toHaveLength(1)
    expect(tryExchange(game, 'party_1', 'party_2', { kind: 'member', from: 'party_2', index: 0 })).toMatch(/empty/)
  })
})
