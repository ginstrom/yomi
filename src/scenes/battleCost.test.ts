import { describe, expect, it } from 'vitest'
import type { BattleEvent, UnitSnapshot } from '../engine/battleEngine.ts'
import { battleCost, costLines } from './battleCost.ts'

const unit = (id: string, side: 'player' | 'enemy', hp: number): UnitSnapshot => ({ id, side, hp }) as UnitSnapshot
const start = (units: UnitSnapshot[]): BattleEvent[] => [{ type: 'battle_start', units } as unknown as BattleEvent]
const NAMES = { a: 'Aiko', b: 'Ren', c: 'Mia', g: 'Goblin' }

describe('battleCost', () => {
  const log = start([unit('a', 'player', 30), unit('b', 'player', 30), unit('c', 'player', 20), unit('g', 'enemy', 50)])

  it('lists what each hero lost, most first, ignoring foes (A1)', () => {
    const end = [unit('a', 'player', 18), unit('b', 'player', 30), unit('c', 'player', 12), unit('g', 'enemy', 0)]
    expect(battleCost(log, end, NAMES)).toEqual([
      { id: 'a', name: 'Aiko', lost: 12 },
      { id: 'c', name: 'Mia', lost: 8 },
    ])
  })

  it('counts a fallen hero for the hit points they started with', () => {
    const end = [unit('a', 'player', 0), unit('b', 'player', 29), unit('c', 'player', 20)]
    expect(battleCost(log, end, NAMES).map((c) => c.lost)).toEqual([30, 1])
  })

  it('keeps the party order among equal losses', () => {
    const end = [unit('a', 'player', 25), unit('b', 'player', 25), unit('c', 'player', 15)]
    expect(battleCost(log, end, NAMES).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('drops a hero who ends above their start', () => {
    const end = [unit('a', 'player', 35), unit('b', 'player', 20), unit('c', 'player', 20)]
    expect(battleCost(log, end, NAMES).map((c) => c.id)).toEqual(['b'])
  })

  it('is empty when nothing was lost, or the log does not start a battle (A2)', () => {
    expect(battleCost(log, [unit('a', 'player', 30), unit('b', 'player', 30), unit('c', 'player', 20)], NAMES)).toEqual([])
    expect(battleCost([], [], NAMES)).toEqual([])
  })
})

describe('costLines', () => {
  it('is empty for no cost (A2)', () => expect(costLines([])).toEqual([]))

  it('says the total and who lost it', () => {
    const costs = [
      { id: 'a', name: 'Aiko', lost: 12 },
      { id: 'b', name: 'Ren', lost: 8 },
      { id: 'c', name: 'Mia', lost: 3 },
    ]
    expect(costLines(costs)).toEqual(['The battle cost 23 HP: Aiko 12, Ren 8, Mia 3.'])
    expect(costLines([{ id: 'a', name: 'Aiko', lost: 1 }])).toEqual(['The battle cost 1 HP: Aiko 1.'])
  })

  it('wraps onto a second line, then collapses the rest to "and N more" (A3)', () => {
    const costs = ['Alexandria Vanterpool', 'Bartholomew Featherstone', 'Cornelius Ravenscroft', 'Desdemona Whitlock', 'Evangeline Marchbanks', 'Ferdinand Oakenshield'].map((name, i) => ({ id: `h${i}`, name, lost: 100 - i }))
    const lines = costLines(costs)
    expect(lines.length).toBeLessThanOrEqual(2)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(72)
    expect(lines.join(' ')).toMatch(/^The battle cost 585 HP: .*and \d+ more\.$/)
    const wrapped = costLines(costs.slice(0, 3))
    expect(wrapped).toHaveLength(2)
    expect(wrapped.join(' ')).toBe('The battle cost 297 HP: Alexandria Vanterpool 100, Bartholomew Featherstone 99, Cornelius Ravenscroft 98.')
  })

  it('honours a narrower width', () => {
    const costs = [
      { id: 'a', name: 'Aiko', lost: 12 },
      { id: 'b', name: 'Ren', lost: 8 },
    ]
    for (const line of costLines(costs, 24)) expect(line.length).toBeLessThanOrEqual(24)
  })
})
