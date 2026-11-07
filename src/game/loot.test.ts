import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../combat/rng.ts'
import { RUNE_IDS } from '../inventory/runes.ts'
import { FAVOURED_CHANCE, lootRng, rollRunes, takeRunes } from './loot.ts'
import { newGame } from './gameState.ts'

const scripted = (values: number[]) => () => values.shift() ?? 0
const seeds = Array.from({ length: 2000 }, (_, i) => i + 1)
const rolls = (threat: number, encounter: Parameters<typeof rollRunes>[1]) => seeds.map((s) => rollRunes(threat, encounter, lootRng(s)))
const share = (n: number) => n / seeds.length

describe('rune loot', () => {
  it('is deterministic and draws from a stream of its own', () => {
    expect(rollRunes(4, 'goblin_raid', lootRng(7))).toEqual(rollRunes(4, 'goblin_raid', lootRng(7)))
    const a = newGame(), b = newGame()
    expect(takeRunes(a, 5, 'troll_lair', 9)).toEqual(takeRunes(b, 5, 'troll_lair', 9))
    expect(a.runes).toEqual(b.runes)
    for (const seed of [1, 2, 3, 42]) {
      expect(lootRng(seed)()).not.toBe(mulberry32(seed)())
      expect(lootRng(seed)()).not.toBe(mulberry32(seed + 1)())
    }
  })

  it('yields nothing or a rank 1 rune about half the time at threats 1 to 3', () => {
    for (const threat of [1, 2, 3]) {
      const all = rolls(threat, 'goblin_raid')
      expect(all.every((r) => r.length <= 1 && r.every((k) => k.endsWith('1')))).toBe(true)
      expect(share(all.filter((r) => r.length === 1).length)).toBeGreaterThan(0.4)
      expect(share(all.filter((r) => r.length === 1).length)).toBeLessThan(0.6)
    }
  })

  it('yields one rune of rank 1 or 2 from threat 4, rank 1 about 70%', () => {
    for (const threat of [4, 5, 7, 9]) {
      const all = rolls(threat, 'goblin_raid')
      expect(all.every((r) => r.length === 1 && /[12]$/.test(r[0]))).toBe(true)
      const one = share(all.filter((r) => r[0].endsWith('1')).length)
      expect(one).toBeGreaterThan(0.64)
      expect(one).toBeLessThan(0.76)
    }
  })

  it('draws every kind, and favours a nest leader\'s element', () => {
    const kinds = new Set(rolls(4, 'goblin_raid').map((r) => r[0].replace(/\d$/, '')))
    expect(kinds.size).toBe(RUNE_IDS.length)
    const ember = share(rolls(4, 'salamander_pool').filter((r) => r[0].startsWith('ember')).length)
    expect(ember).toBeGreaterThan(0.5)
    expect(ember).toBeLessThan(0.6)
    const venom = share(rolls(5, 'spider_nest').filter((r) => r[0].startsWith('venom')).length)
    expect(venom).toBeGreaterThan(0.5)
    expect(venom).toBeLessThan(0.6)
    expect(FAVOURED_CHANCE).toBe(0.5)
  })

  it('draws in a fixed order', () => {
    expect(rollRunes(4, 'goblin_raid', scripted([0.35, 0.8]))).toEqual(['venom2'])
    expect(rollRunes(2, 'goblin_raid', scripted([0.9]))).toEqual([])
    expect(rollRunes(2, 'goblin_raid', scripted([0.1, 0.0]))).toEqual(['ember1'])
    expect(rollRunes(4, 'salamander_pool', scripted([0.2, 0.5]))).toEqual(['ember1'])
    expect(rollRunes(4, 'salamander_pool', scripted([0.9, 0.35, 0.8]))).toEqual(['venom2'])
  })

  it('puts the runes in the pouch on top of what it held', () => {
    const game = newGame()
    game.runes = { venom2: 1 }
    let found = takeRunes(game, 4, 'goblin_raid', 1)
    for (let seed = 2; found[0] !== 'venom2'; seed++) found = takeRunes(game, 4, 'goblin_raid', seed)
    expect(game.runes.venom2).toBeGreaterThanOrEqual(2)
  })
})
