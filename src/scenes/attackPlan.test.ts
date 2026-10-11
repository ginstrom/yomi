import { describe, expect, it } from 'vitest'
import { GOBLIN_STATS, type CombatantStats } from '../combat/combat.ts'
import { BattleEngine, attackArc, type UnitSetup } from '../engine/battleEngine.ts'
import { hex, hexDistance, offsetToHex, type Hex } from '../grid/hex.ts'
import { planAttack } from './attackPlan.ts'

const WARRIOR_STATS: CombatantStats = {
  name: 'Warrior',
  maxHp: 20,
  ac: 15,
  attackBonus: 4,
  damage: { count: 1, sides: 8, bonus: 2 },
  attackApCost: 5,
  attackRange: 1,
  actionPoints: 8,
}

function battle(warrior: Hex, goblin: Hex, stats: Partial<CombatantStats> = {}): BattleEngine {
  const units: UnitSetup[] = [
    { id: 'warrior', side: 'player', stats: { ...WARRIOR_STATS, ...stats }, position: warrior },
    { id: 'goblin', side: 'enemy', stats: GOBLIN_STATS, position: goblin },
  ]
  return new BattleEngine({ board: { cols: 8, rows: 5 }, units }, { seed: 1 })
}

describe('planAttack', () => {
  it('strikes a foe already in reach without moving', () => {
    expect(planAttack(battle(hex(1, 1), hex(2, 1)), 'warrior', 'goblin')).toEqual({ move: null, attack: true })
  })

  it('moves beside a foe and strikes when the AP covers both', () => {
    const plan = planAttack(battle(hex(0, 1), hex(4, 1)), 'warrior', 'goblin')
    expect(plan.attack).toBe(true)
    expect(hexDistance(plan.move!.to, hex(4, 1))).toBe(1)
  })

  it('walks the shortest way beside a foe when too few AP are left to strike', () => {
    const plan = planAttack(battle(hex(0, 1), hex(4, 1), { actionPoints: 4 }), 'warrior', 'goblin')
    expect(plan).toEqual({ move: { type: 'move', unit: 'warrior', to: hex(3, 1) }, attack: false })
  })

  it('closes in as far as it can when no hex beside the foe is in reach', () => {
    const plan = planAttack(battle(hex(0, 1), hex(7, 1), { actionPoints: 2 }), 'warrior', 'goblin')
    expect(plan).toEqual({ move: { type: 'move', unit: 'warrior', to: hex(2, 1) }, attack: false })
  })

  it('does nothing beside a foe it cannot afford to strike', () => {
    const engine = battle(hex(0, 1), hex(3, 1), { actionPoints: 6 })
    engine.step({ type: 'move', unit: 'warrior', to: hex(1, 1) })
    engine.step({ type: 'move', unit: 'warrior', to: hex(2, 1) })
    expect(planAttack(engine, 'warrior', 'goblin')).toEqual({ move: null, attack: false })
  })

  it("prefers a hex that strikes the foe's rear when it is as safe to reach", () => {
    // The goblin faces west; from the north-east its side and its back are equally near.
    const goblin = offsetToHex(4, 2)
    const plan = planAttack(battle(offsetToHex(6, 0), goblin), 'warrior', 'goblin')
    expect(plan.attack).toBe(true)
    expect(attackArc({ position: goblin, facing: 3 }, plan.move!.to)).toBe('rear')
  })

  it('shoots a foe in range from where it stands', () => {
    const engine = battle(hex(0, 1), hex(4, 1), { attackRange: 5 })
    expect(planAttack(engine, 'warrior', 'goblin')).toEqual({ move: null, attack: true })
  })

  it('walks an archer only as far as it needs to shoot', () => {
    const plan = planAttack(battle(hex(0, 1), hex(6, 1), { attackRange: 4 }), 'warrior', 'goblin')
    expect(plan.attack).toBe(true)
    expect(hexDistance(hex(0, 1), plan.move!.to)).toBe(2)
    expect(hexDistance(plan.move!.to, hex(6, 1))).toBe(4)
  })

  it('does nothing when the foe is in range but the AP cannot cover a shot', () => {
    const engine = battle(hex(0, 1), hex(3, 1), { attackRange: 5 })
    engine.step({ type: 'attack', unit: 'warrior', target: 'goblin' })
    expect(planAttack(engine, 'warrior', 'goblin')).toEqual({ move: null, attack: false })
  })
})
