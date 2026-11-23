import { describe, expect, it } from 'vitest'
import { trophiesFor } from '../game/loot.ts'
import { newGame, type GameState } from '../game/gameState.ts'
import type { ItemPlace } from '../game/itemPlace.ts'
import { itemById } from '../inventory/inventory.ts'
import { FORGE_SLOTS, forgeHint, forgePreview, forgeRows, temperChoices, temperPreview, trophiesLine } from './forgeView.ts'

function home(workshop: number, stock = { gold: 500, mithril: 20 }): GameState {
  const game = newGame(undefined, null, 1, 'Hearthold')
  game.world.workshop = workshop
  game.world.stock = { ...stock }
  return game
}

const baggagePlace = (game: GameState, id: string): ItemPlace => {
  game.parties[0].baggage.push(itemById(id)!)
  return { from: 'baggage', party: game.parties[0].id, index: game.parties[0].baggage.length - 1, itemId: id } as ItemPlace
}

describe('the Forge tab rows', () => {
  it('lists a Mithril Longsword for 30 gold and 8 mithril at workshop 4, a Greatsword for 16 mithril', () => {
    const game = home(4)
    const rows = forgeRows(game, game.parties[0], 'mainHand')
    const sword = rows.find((r) => r.id === 'longsword:mithril')!
    expect(sword.name).toBe('Mithril Longsword')
    expect(sword.costText).toBe('30 gold, 8 mithril')
    expect(sword.refusal).toBeNull()
    expect(rows.find((r) => r.id === 'greatsword:mithril')!.costText).toBe('30 gold, 16 mithril')
  })

  it('has rows for every slot of the filter at workshop 6, and none below 4, with the reason', () => {
    const game = home(6)
    for (const slot of FORGE_SLOTS) expect(forgeRows(game, game.parties[0], slot).length, slot).toBeGreaterThan(0)
    const low = home(3)
    expect(forgeRows(low, low.parties[0], 'mainHand')).toEqual([])
    expect(forgeHint(low)).toBe('A level 4 workshop forges mithril, elderwood, wyvern-hide and mithrilweave.')
  })

  it('carries the domain refusal for a row the stock cannot pay', () => {
    const game = home(4, { gold: 500, mithril: 3 })
    const row = forgeRows(game, game.parties[0], 'mainHand').find((r) => r.id === 'longsword:mithril')!
    expect(row.refusal).toContain('more than the stock holds')
  })
})

describe('the forge preview', () => {
  it('compares the forged item with what the member wears, and tells its sockets', () => {
    const game = home(4)
    const member = game.parties[0].members[0]
    const row = forgeRows(game, game.parties[0], 'mainHand').find((r) => r.id === 'longsword:mithril')!
    const lines = forgePreview(row, member)
    expect(lines[0]).toBe('Forges the Mithril Longsword, into the baggage.')
    expect(lines).toContain('Sockets: 1, 2 at Masterwork.')
    expect(lines.some((l) => l.startsWith('Damage:'))).toBe(true)
    expect(lines[lines.length - 1]).toBe('Costs 30 gold, 8 mithril.')
  })
})

describe('the temper choices', () => {
  it('offers Fine and Masterwork for a plain tier-3 item, Masterwork only above Fine', () => {
    const game = home(4)
    const plain = temperChoices(game, baggagePlace(game, 'mithril_longsword'))
    expect(plain.map((c) => [c.id, c.label])).toEqual([
      ['temper2', 'Temper to Fine'],
      ['temper3', 'Temper to Masterwork'],
    ])
    expect(plain[0].refusal).toBeNull()
    const fine = temperChoices(game, baggagePlace(game, 'mithril_longsword@2'))
    expect(fine.map((c) => c.id)).toEqual(['temper3'])
  })

  it('offers none for a tier-2 item', () => {
    const game = home(4)
    expect(temperChoices(game, baggagePlace(game, 'steel_longsword'))).toEqual([])
  })

  it('previews the extra socket of Masterwork and the cost', () => {
    const game = home(4)
    const place = baggagePlace(game, 'mithril_longsword')
    const masterwork = temperChoices(game, place)[1]
    const lines = temperPreview(itemById('mithril_longsword')!, masterwork)
    expect(lines).toContain('Gains a socket: 2 in all.')
    expect(lines[lines.length - 1]).toMatch(/^Costs 90 gold/)
  })
})

describe('the trophies line', () => {
  it('names materials by materialName, and is null with none', () => {
    expect(trophiesLine({ wyvern_hide: 3 })).toBe('Trophies: 3 wyvern hide')
    expect(trophiesLine({ wolfhide: 1, wyvern_hide: 2 })).toBe('Trophies: 1 wolfhide, 2 wyvern hide')
    expect(trophiesLine({})).toBeNull()
  })

  it('words what an injected table gives for a battle, and nothing from the empty table', () => {
    const table = { troll: { material: 'wyvern_hide' as const, amount: 3 } }
    expect(trophiesLine(trophiesFor(['troll', 'warrior', 'troll'], table))).toBe('Trophies: 6 wyvern hide')
    expect(trophiesLine(trophiesFor(['troll', 'goblin']))).toBeNull()
  })
})
