import { describe, expect, it } from 'vitest'
import { newGame, type GameState } from '../game/gameState.ts'
import type { ItemPlace } from '../game/itemPlace.ts'
import { itemById } from '../inventory/inventory.ts'
import {
  actionId,
  actionPreview,
  actionRefusal,
  doneMessage,
  fuseLine,
  parseActionId,
  pouchRows,
  noSocketsHint,
  runeEffectLines,
  runeSocketLine,
  socketRows,
  socketSources,
} from './runecraftView.ts'

/** A new game at home with a level 2 workshop and gold to spare, the soldier wielding `id`. */
function home(id = 'iron_sword@3', workshop = 2): { game: GameState; place: ItemPlace } {
  const game = newGame(undefined, null, 1, 'Hearthold')
  game.world.workshop = workshop
  game.world.stock = { gold: 500 }
  game.parties[0].members[0].equipment.mainHand = itemById(id)!
  return { game, place: { from: 'worn', party: 'party_1', member: 0, slot: 'mainHand', itemId: id } }
}

describe('where sockets come from', () => {
  it('is worked out from socketsOf: the tier-2 materials, Masterwork and the socketed uniques', () => {
    expect(socketSources()).toEqual({
      tiers: [2],
      materials: ['steel', 'ironwood', 'wolfhide', 'silk'],
      grades: ['Masterwork'],
      uniques: ['Wand of Storms', 'Emberblade', 'Hawkeye Bow'],
    })
  })
  it('tells the party with nothing socketed which gear has sockets', () => {
    expect(noSocketsHint()).toBe(
      'Nothing the party has takes a rune. Sockets come on steel, ironwood, wolfhide and silk gear, on Masterwork gear and on the Wand of Storms, Emberblade and Hawkeye Bow.',
    )
  })
  it('tells a rune\'s reader that it goes in a socketed item', () => {
    expect(runeSocketLine()).toBe('Set in a socketed item: tier-2 or Masterwork gear.')
  })
})

describe('the Runes tab', () => {
  it('names each action by an id it can be read back from', () => {
    for (const action of [{ kind: 'embed', key: 'ember1' }, { kind: 'extract', index: 1 }, { kind: 'fuse', key: 'storm2' }] as const) {
      expect(parseActionId(actionId(action))).toEqual(action)
    }
    expect(actionId({ kind: 'embed', key: 'ember1' })).toBe('embed:ember1')
    expect(parseActionId('embed:nonsense')).toBeNull()
    expect(parseActionId('extract:x')).toBeNull()
  })

  it('lists an item\'s sockets, filled ones first with what each rune does there, then the empty', () => {
    expect(socketRows(itemById('steel_longsword@3#ember1')!)).toEqual([
      { index: 0, rune: 'ember1', label: 'Ember I', effect: 'On a hit, +1 fire' },
      { index: 1, rune: null, label: 'Empty socket', effect: null },
    ])
    expect(socketRows(itemById('iron_breastplate@3#ember1')!)[0].effect).toBe('Fire ward 2')
    expect(socketRows(itemById('iron_sword')!)).toEqual([])
  })

  it('lists the pouch in its order, with names and counts', () => {
    const { game } = home()
    game.runes = { storm2: 1, ember1: 2 }
    expect(pouchRows(game)).toEqual([
      { key: 'ember1', count: 2, name: 'Lesser Ember Rune' },
      { key: 'storm2', count: 1, name: 'Storm Rune' },
    ])
  })

  it('says what a rune does in each place', () => {
    expect(runeEffectLines('ember1')).toEqual(['In a weapon: On a hit, +1 fire', 'In armour: Fire ward 2', 'In a shield: Fire ward 2'])
  })

  it('previews an embed: the item made, what changes and the cost', () => {
    const { game, place } = home()
    game.runes = { ember1: 1 }
    expect(actionPreview(game, game.parties[0], place, { kind: 'embed', key: 'ember1' })).toEqual([
      'Set a Lesser Ember Rune in the Masterwork Iron Longsword.',
      'Makes the Masterwork Iron Longsword [Ember I].',
      'On a hit: +1 fire',
      'Costs 5 gold.',
    ])
    expect(actionRefusal(game, game.parties[0], place, { kind: 'embed', key: 'ember1' })).toBeNull()
  })

  it('previews a field embed as taking a day too', () => {
    const { game, place } = home('iron_sword@3', 0)
    game.parties[0].position = { q: game.parties[0].position.q + 1, r: game.parties[0].position.r }
    game.runes = { ember1: 1 }
    expect(actionPreview(game, game.parties[0], place, { kind: 'embed', key: 'ember1' }).at(-1)).toBe('Costs 5 gold and a day.')
  })

  it('previews an extract, the rune going back to the pouch', () => {
    const { game, place } = home('iron_sword@3#ember1')
    expect(actionPreview(game, game.parties[0], place, { kind: 'extract', index: 0 })).toEqual([
      'Take the Lesser Ember Rune out of the Masterwork Iron Longsword [Ember I], intact, into the pouch.',
      'Makes the Masterwork Iron Longsword.',
      'On a hit: no longer +1 fire',
      'Costs 10 gold.',
    ])
  })

  it('previews a fuse, which needs no item', () => {
    const { game } = home()
    game.runes = { storm1: 3 }
    expect(actionPreview(game, game.parties[0], null, { kind: 'fuse', key: 'storm1' })).toEqual(['3 × Lesser Storm Rune → Storm Rune', 'Costs 20 gold.'])
    expect(fuseLine('storm1')).toBe('3 × Lesser Storm Rune → Storm Rune')
    expect(actionRefusal(game, game.parties[0], null, { kind: 'fuse', key: 'storm1' })).toBeNull()
  })

  it('previews nothing to make for a Grand rune, and gives the domain\'s refusal', () => {
    const { game } = home()
    game.runes = { stone4: 3 }
    expect(actionPreview(game, game.parties[0], null, { kind: 'fuse', key: 'stone4' })).toEqual([])
    expect(actionRefusal(game, game.parties[0], null, { kind: 'fuse', key: 'stone4' })).toMatch(/highest rank/)
  })

  it('gives the domain\'s refusals, and asks for an item before an embed or extract', () => {
    const { game, place } = home()
    game.runes = { storm2: 1 }
    expect(actionRefusal(game, game.parties[0], null, { kind: 'embed', key: 'storm2' })).toBe('Click an item to set the rune in first.')
    expect(actionRefusal(game, game.parties[0], place, { kind: 'fuse', key: 'storm2' })).toMatch(/^Fusing to a Greater Storm Rune needs a level 4 workshop/)
    expect(actionRefusal(game, game.parties[0], place, { kind: 'extract', index: 0 })).toMatch(/no rune there/)
  })

  it('says what was done', () => {
    const made = itemById('iron_sword@3#ember1')!
    expect(doneMessage({ kind: 'embed', key: 'ember1' }, made)).toBe('Set the Lesser Ember Rune: the Masterwork Iron Longsword [Ember I].')
    expect(doneMessage({ kind: 'extract', index: 0 }, itemById('iron_sword@3')!, 'ember1')).toBe(
      'Took the Lesser Ember Rune out of the Masterwork Iron Longsword; it is back in the pouch.',
    )
    expect(doneMessage({ kind: 'fuse', key: 'storm1' })).toBe('Fused three Lesser Storm Runes into one Storm Rune.')
  })
})
