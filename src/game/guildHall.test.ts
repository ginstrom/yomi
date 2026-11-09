import { describe, expect, it } from 'vitest'
import { maxHp, maxMana } from '../character/character.ts'
import { canAdvance, levelUp } from '../character/progression.ts'
import { offsetToHex } from '../grid/hex.ts'
import { newExpedition } from './expedition.ts'
import { newGame, type GameState } from './gameState.ts'
import {
  GUILD_HALL_LEVELS,
  MAX_GUILD_HALL_LEVEL,
  MAX_RESERVES,
  atGuildHall,
  availablePrerolls,
  company,
  companyLimit,
  homeParties,
  homeParty,
  maxParties,
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
    expect(atGuildHall(game.world, game.parties[0])).toBe(true)
    game.parties[0].position = offsetToHex(11, 19)
    expect(atGuildHall(game.world, game.parties[0])).toBe(false)
    expect(upgradeGuildHall(game, game.parties[0])).toMatch(/Oakvale/)
    expect(recruit(game, game.parties[0], GARRICK)).toMatch(/Oakvale/)
    expect(toReserves(game, game.parties[0], 0)).toMatch(/Oakvale/)
  })

  it('sets the party limit by its level, raised for the stock to 4 and then 5', () => {
    const game = atHome()
    expect(partyLimit(game.world)).toBe(3)
    expect(upgradeCost(game.world)).toEqual(GUILD_HALL_LEVELS[1].cost)
    expect(upgradeGuildHall(game, game.parties[0])).toBeNull()
    expect([game.world.guildHall, partyLimit(game.world)]).toEqual([2, 4])
    expect(game.world.stock).toEqual({ gold: 170, iron: 85 })
    expect(upgradeGuildHall(game, game.parties[0])).toBeNull()
    expect(partyLimit(game.world)).toBe(5)
    expect(upgradeCost(game.world)).toEqual(GUILD_HALL_LEVELS[3].cost)
  })

  it('refuses an upgrade the stock cannot pay for, spending nothing', () => {
    const game = atHome()
    game.world.stock = { gold: 29, iron: 15 }
    expect(upgradeGuildHall(game, game.parties[0])).toMatch(/30 gold, 15 iron/)
    expect(game.world.guildHall).toBe(1)
    expect(game.world.stock).toEqual({ gold: 29, iron: 15 })
  })
})

describe('recruiting', () => {
  it('hires a pre-roll into the reserves for the stock, and offers only those not in the company', () => {
    const game = atHome()
    expect(availablePrerolls(game).map((p) => p.draft.name)).toEqual(['Garrick'])
    expect(recruit(game, game.parties[0], GARRICK)).toBeNull()
    expect(game.reserves.map((hero) => hero.name)).toEqual(['Garrick'])
    expect(game.world.stock.gold).toBe(190)
    expect(availablePrerolls(game)).toEqual([])
    expect(recruit(game, game.parties[0], GARRICK)).toMatch(/already in the company/)
  })

  it('joins at the hall’s level whatever the party’s lowest, with its points to spend', () => {
    const game = atHome()
    game.world.guildHall = 3
    for (const member of game.parties[0].members) while (member.level < 5) levelUp(member)
    game.parties[0].members[0].level = 1
    expect(recruitLevel(game)).toBe(3)
    recruit(game, game.parties[0], GARRICK)
    const [garrick] = game.reserves
    expect(garrick.level).toBe(3)
    expect(garrick.xp).toBe(0)
    expect(canAdvance(garrick)).toBe(true)
    expect(garrick.hp).toBe(maxHp(garrick))

    const first = atHome()
    expect(recruitLevel(first)).toBe(1)
    first.world.guildHall = 5
    expect(recruitLevel(first)).toBe(5)
  })

  it('is refused when the reserves are full or the stock short', () => {
    const game = atHome()
    for (let i = 0; i < MAX_RESERVES; i++) expect(recruit(game, game.parties[0], { ...GARRICK, name: `Garrick${i}` })).toBeNull()
    expect(recruitRefusal(game, game.parties[0])).toMatch(/no more than 4/)
    const poor = atHome()
    poor.world.stock = { gold: 9 }
    expect(recruit(poor, poor.parties[0], GARRICK)).toMatch(/10 gold/)
    expect(poor.reserves).toEqual([])
  })
})

describe('the roster', () => {
  it('moves members between the party and the reserves, within the limit, never emptying the party', () => {
    const game = atHome()
    recruit(game, game.parties[0], GARRICK)
    expect(toParty(game, game.parties[0], 0)).toMatch(/party is full/)
    expect(toReserves(game, game.parties[0], 2)).toBeNull()
    expect(game.parties[0].members.map((m) => m.name)).toEqual(['Aldric', 'Brenna'])
    expect(game.reserves.map((m) => m.name)).toEqual(['Garrick', 'Delwyn'])
    expect(toParty(game, game.parties[0], 0)).toBeNull()
    expect(game.parties[0].members.map((m) => m.name)).toEqual(['Aldric', 'Brenna', 'Garrick'])
    expect(toReserves(game, game.parties[0], 0)).toBeNull()
    expect(toReserves(game, game.parties[0], 0)).toBeNull()
    expect(toReserves(game, game.parties[0], 0)).toMatch(/empty/)
  })

  it('swaps a member for a reserve in its place, the reserve rested', () => {
    const game = atHome()
    recruit(game, game.parties[0], GARRICK)
    const [garrick] = game.reserves
    garrick.hp = 1
    garrick.mana = 0
    const brenna = game.parties[0].members[1]
    expect(swap(game, game.parties[0], 1, 0)).toBeNull()
    expect(game.parties[0].members[1]).toBe(garrick)
    expect(game.reserves[0]).toBe(brenna)
    expect([garrick.hp, garrick.mana]).toEqual([maxHp(garrick), maxMana(garrick)])
  })
})

describe('the guild hall’s five levels', () => {
  it('sets the party limit, the parties and the company by level', () => {
    const rows = GUILD_HALL_LEVELS.map((_, i) => {
      const game = atHome()
      game.world.guildHall = i + 1
      return [partyLimit(game.world), maxParties(game.world), companyLimit(game.world)]
    })
    expect(rows).toEqual([[3, 1, 7], [4, 1, 8], [5, 1, 9], [5, 2, 14], [5, 3, 18]])
    expect(MAX_GUILD_HALL_LEVEL).toBe(5)
  })

  it('is raised to 5 for the stock, then refused', () => {
    const game = atHome()
    game.world.stock = { gold: 500, iron: 200, stone: 50, silver: 50 }
    for (let level = 2; level <= 5; level++) expect(upgradeGuildHall(game, game.parties[0])).toBeNull()
    expect(game.world.guildHall).toBe(5)
    expect(game.world.stock).toEqual({ gold: 500 - 30 - 60 - 120 - 200, iron: 200 - 15 - 30 - 40, stone: 10, silver: 20 })
    expect(upgradeGuildHall(game, game.parties[0])).toMatch(/as large/)
  })

  it('refuses a recruit when the company holds as many as the hall allows', () => {
    const game = atHome()
    const [first] = game.parties[0].members
    for (let i = 0; company(game).length < companyLimit(game.world); i++) game.parties[0].members.push({ ...structuredClone(first), name: `Pad${i}` })
    expect(company(game).length).toBe(7)
    expect(recruitRefusal(game, game.parties[0])).toMatch(/level 1 keeps no more than 7/)
    expect(recruit(game, game.parties[0], GARRICK)).toMatch(/no more than 7/)
    game.world.guildHall = 4
    expect(recruitRefusal(game, game.parties[0])).toBeNull()
  })
})

describe('the parties at home', () => {
  it('lists the parties at the encampment and picks the one the encampment acts for', () => {
    const game = atHome()
    const second = newExpedition([structuredClone(game.parties[0].members[0])], { ...game.parties[0].position }, 'party_2', 'Second Company')
    game.parties.push(second)
    expect(homeParties(game).map((p) => p.id)).toEqual(['party_1', 'party_2'])
    expect(homeParty(game, 'party_2')).toBe(second)
    expect(homeParty(game)).toBe(game.parties[0])
    second.position = offsetToHex(11, 19)
    expect(homeParty(game, 'party_2')).toBe(game.parties[0])
    game.parties[0].position = offsetToHex(11, 19)
    expect(homeParty(game, 'party_1')).toBeNull()
    expect(homeParties(game)).toEqual([])
  })
})
