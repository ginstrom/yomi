import { describe, expect, it } from 'vitest'
import { maxHp, maxMana } from '../character/character.ts'
import { campDay } from './camp.ts'
import { leader, newGame } from './gameState.ts'
import { FIELD_DRESSING_PER_DAY, NATURAL_HEALING_PER_DAY, raiseInfirmary, restHealing } from './infirmary.ts'

/** A new game at home, the soldier at 1 hit point and the mage's mana spent. */
function wounded(infirmary: number) {
  const game = newGame(undefined, null, 1, 'Hearthold')
  game.world.infirmary = infirmary
  leader(game).members[0].hp = 1
  leader(game).members[2].mana = 0
  return game
}

describe('the infirmary', () => {
  it('heals a day at the encampment by its level: 1, a third, all', () => {
    for (const [level, expected] of [
      [0, () => 1 + NATURAL_HEALING_PER_DAY],
      [1, (max: number) => 1 + Math.ceil(max / 3)],
      [2, (max: number) => max],
    ] as const) {
      const game = wounded(level)
      const soldier = leader(game).members[0]
      campDay(game.world, leader(game).members)
      expect(soldier.hp, `level ${level}`).toBe(expected(maxHp(soldier)))
      expect(leader(game).members[2].mana).toBe(maxMana(leader(game).members[2]))
    }
  })

  it('dresses wounds in the field only at its top level', () => {
    for (const [level, healed] of [
      [2, NATURAL_HEALING_PER_DAY],
      [3, FIELD_DRESSING_PER_DAY],
    ]) {
      const game = wounded(level)
      game.world.party = { q: game.world.party.q + 1, r: game.world.party.r }
      expect(restHealing(game.world, leader(game).members[0])).toBe(healed)
      campDay(game.world, leader(game).members)
      expect(leader(game).members[0].hp).toBe(1 + healed)
      expect(leader(game).members[2].mana).toBe(maxMana(leader(game).members[2]))
    }
  })

  it('is built and raised at the encampment for the stock', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    expect(raiseInfirmary(game)).toMatch(/costs 20 gold, 10 timber/)
    game.world.stock = { gold: 20, timber: 10 }
    expect(raiseInfirmary(game)).toBeNull()
    expect([game.world.infirmary, game.world.stock.gold]).toEqual([1, 0])
  })
})
