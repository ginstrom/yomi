import { describe, expect, it } from 'vitest'
import { maxHp, maxMana } from '../character/character.ts'
import { campDay } from './camp.ts'
import { newGame } from './gameState.ts'
import { FIELD_DRESSING_PER_DAY, NATURAL_HEALING_PER_DAY, raiseInfirmary, restHealing } from './infirmary.ts'

/** A new game at home, the soldier at 1 hit point and the mage's mana spent. */
function wounded(infirmary: number) {
  const game = newGame(undefined, null, 1, 'Hearthold')
  game.world.infirmary = infirmary
  game.parties[0].members[0].hp = 1
  game.parties[0].members[2].mana = 0
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
      const soldier = game.parties[0].members[0]
      campDay(game, game.parties[0])
      expect(soldier.hp, `level ${level}`).toBe(expected(maxHp(soldier)))
      expect(game.parties[0].members[2].mana).toBe(maxMana(game.parties[0].members[2]))
    }
  })

  it('dresses wounds in the field only at its top level', () => {
    for (const [level, healed] of [
      [2, NATURAL_HEALING_PER_DAY],
      [3, FIELD_DRESSING_PER_DAY],
    ]) {
      const game = wounded(level)
      game.parties[0].position = { q: game.parties[0].position.q + 1, r: game.parties[0].position.r }
      expect(restHealing(game.world, game.parties[0], game.parties[0].members[0])).toBe(healed)
      campDay(game, game.parties[0])
      expect(game.parties[0].members[0].hp).toBe(1 + healed)
      expect(game.parties[0].members[2].mana).toBe(maxMana(game.parties[0].members[2]))
    }
  })

  it('is built and raised at the encampment for the stock', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    expect(raiseInfirmary(game, game.parties[0])).toMatch(/costs 20 gold, 10 timber/)
    game.world.stock = { gold: 20, timber: 10 }
    expect(raiseInfirmary(game, game.parties[0])).toBeNull()
    expect([game.world.infirmary, game.world.stock.gold]).toEqual([1, 0])
  })
})
