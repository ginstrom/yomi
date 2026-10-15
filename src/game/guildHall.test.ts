import { describe, expect, it } from 'vitest'
import { maxHp, maxMana } from '../character/character.ts'
import { canAdvance, levelUp } from '../character/progression.ts'
import { offsetToHex } from '../grid/hex.ts'
import { newGame, type GameState } from './gameState.ts'
import {
  GUILD_HALL_LEVELS,
  MAX_RESERVES,
  atGuildHall,
  availablePrerolls,
  partyLimit,
  recruit,
  recruitLevel,
  recruitRefusal,
  swap,
  toParty,
  toReserves,
  upgradeCost,
  upgradeGuildHall,
} from './guildHall.ts'
import { PREROLLS } from './party.ts'

const GARRICK = PREROLLS[3].draft

/** A new game at Oakvale with gold and iron enough for anything. */
function atHome(): GameState {
  const game = newGame(undefined, null, 1)
  game.world.stock = { gold: 200, iron: 100 }
  return game
}

describe('the guild hall', () => {
  it('is open only at Oakvale, while the game goes on', () => {
    const game = atHome()
    expect(atGuildHall(game.world)).toBe(true)
    game.world.party = offsetToHex(11, 19)
    expect(atGuildHall(game.world)).toBe(false)
    expect(upgradeGuildHall(game)).toMatch(/Oakvale/)
    expect(recruit(game, GARRICK)).toMatch(/Oakvale/)
    expect(toReserves(game, 0)).toMatch(/Oakvale/)
  })

  it('sets the party limit by its level, raised for the stock to 4 and then 5', () => {
    const game = atHome()
    expect(partyLimit(game.world)).toBe(3)
    expect(upgradeCost(game.world)).toEqual(GUILD_HALL_LEVELS[1].cost)
    expect(upgradeGuildHall(game)).toBeNull()
    expect([game.world.guildHall, partyLimit(game.world)]).toEqual([2, 4])
    expect(game.world.stock).toEqual({ gold: 170, iron: 85 })
    expect(upgradeGuildHall(game)).toBeNull()
    expect(partyLimit(game.world)).toBe(5)
    expect(upgradeCost(game.world)).toBeNull()
    expect(upgradeGuildHall(game)).toMatch(/as large/)
  })

  it('refuses an upgrade the stock cannot pay for, spending nothing', () => {
    const game = atHome()
    game.world.stock = { gold: 29, iron: 15 }
    expect(upgradeGuildHall(game)).toMatch(/30 gold, 15 iron/)
    expect(game.world.guildHall).toBe(1)
    expect(game.world.stock).toEqual({ gold: 29, iron: 15 })
  })
})

describe('recruiting', () => {
  it('hires a pre-roll into the reserves for the stock, and offers only those not in the company', () => {
    const game = atHome()
    expect(availablePrerolls(game).map((p) => p.draft.name)).toEqual(['Garrick'])
    expect(recruit(game, GARRICK)).toBeNull()
    expect(game.reserves.map((hero) => hero.name)).toEqual(['Garrick'])
    expect(game.world.stock.gold).toBe(190)
    expect(availablePrerolls(game)).toEqual([])
    expect(recruit(game, GARRICK)).toMatch(/already in the company/)
  })

  it('joins at the hall’s level or the party’s lowest, whichever is less, with its points to spend', () => {
    const game = atHome()
    game.world.guildHall = 3
    for (const member of game.party) while (member.level < 5) levelUp(member)
    levelUp(game.party[1])
    expect(recruitLevel(game)).toBe(3)
    recruit(game, GARRICK)
    const [garrick] = game.reserves
    expect(garrick.level).toBe(3)
    expect(garrick.xp).toBe(0)
    expect(canAdvance(garrick)).toBe(true)
    expect(garrick.hp).toBe(maxHp(garrick))

    const green = atHome()
    green.world.guildHall = 3
    green.party[0].level = 1
    expect(recruitLevel(green)).toBe(1)
  })

  it('is refused when the reserves are full or the stock short', () => {
    const game = atHome()
    for (let i = 0; i < MAX_RESERVES; i++) expect(recruit(game, { ...GARRICK, name: `Garrick${i}` })).toBeNull()
    expect(recruitRefusal(game)).toMatch(/no more than 4/)
    const poor = atHome()
    poor.world.stock = { gold: 9 }
    expect(recruit(poor, GARRICK)).toMatch(/10 gold/)
    expect(poor.reserves).toEqual([])
  })
})

describe('the roster', () => {
  it('moves members between the party and the reserves, within the limit, never emptying the party', () => {
    const game = atHome()
    recruit(game, GARRICK)
    expect(toParty(game, 0)).toMatch(/party is full/)
    expect(toReserves(game, 2)).toBeNull()
    expect(game.party.map((m) => m.name)).toEqual(['Aldric', 'Brenna'])
    expect(game.reserves.map((m) => m.name)).toEqual(['Garrick', 'Delwyn'])
    expect(toParty(game, 0)).toBeNull()
    expect(game.party.map((m) => m.name)).toEqual(['Aldric', 'Brenna', 'Garrick'])
    expect(toReserves(game, 0)).toBeNull()
    expect(toReserves(game, 0)).toBeNull()
    expect(toReserves(game, 0)).toMatch(/empty/)
  })

  it('swaps a member for a reserve in its place, the reserve rested', () => {
    const game = atHome()
    recruit(game, GARRICK)
    const [garrick] = game.reserves
    garrick.hp = 1
    garrick.mana = 0
    const brenna = game.party[1]
    expect(swap(game, 1, 0)).toBeNull()
    expect(game.party[1]).toBe(garrick)
    expect(game.reserves[0]).toBe(brenna)
    expect([garrick.hp, garrick.mana]).toEqual([maxHp(garrick), maxMana(garrick)])
  })
})
