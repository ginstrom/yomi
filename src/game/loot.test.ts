import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../combat/rng.ts'
import { RUNE_IDS } from '../inventory/runes.ts'
import type { UnitId } from '../engine/battleEngine.ts'
import { TROPHIES, type FoeKind, type Trophy, type UnitKind } from './encounters.ts'
import { FAVOURED_CHANCE, lootRng, rollRunes, takeRunes, takeTrophies, trophiesFor } from './loot.ts'
import { newGame } from './gameState.ts'
import { SOURCE_THREAT } from './worldMap.ts'

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

  it('yields one rune of rank 1 or 2 at threats 4 to 8, rank 1 about 70%', () => {
    for (const threat of [4, 5, 7, 8]) {
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

  it('draws exactly as before stage 9 at threats up to 8 (recorded before the far rows came)', () => {
    const recorded: Record<number, string> = {
      1: '324cfd6a02f8f3ccdef32c1e967c83cdb11385dc4626435278e2b620e59b5659',
      3: '324cfd6a02f8f3ccdef32c1e967c83cdb11385dc4626435278e2b620e59b5659',
      4: 'c170ff0af75ee6e4d8390e9806a83bddf9996cc59c6b963df920a30201f61a62',
      5: 'c170ff0af75ee6e4d8390e9806a83bddf9996cc59c6b963df920a30201f61a62',
      7: 'c170ff0af75ee6e4d8390e9806a83bddf9996cc59c6b963df920a30201f61a62',
      8: 'c170ff0af75ee6e4d8390e9806a83bddf9996cc59c6b963df920a30201f61a62',
    }
    for (const [threat, hash] of Object.entries(recorded)) {
      const out: string[] = []
      for (const encounter of ['goblin_raid', 'spider_nest', 'salamander_pool'] as const) {
        for (let s = 1; s <= 500; s++) {
          const base = lootRng(s)
          let draws = 0
          const rng = () => (draws++, base())
          out.push(`${encounter} ${s}: ${rollRunes(Number(threat), encounter, rng).join(',')} after ${draws}`)
        }
      }
      expect(createHash('sha256').update(out.join('\n')).digest('hex'), `threat ${threat}`).toBe(hash)
    }
  })

  it('yields one rune and a second at 50% at threats 9 to 13, each rank 2 at 60%, else 3', () => {
    for (const threat of [9, 13]) {
      // the second's chance first, then each rune's kind and rank
      expect(rollRunes(threat, 'goblin_raid', scripted([0.6, 0.35, 0.59]))).toEqual(['venom2'])
      expect(rollRunes(threat, 'goblin_raid', scripted([0.49, 0.35, 0.6, 0.0, 0.1]))).toEqual(['venom3', 'ember2'])
      const all = rolls(threat, 'goblin_raid')
      expect(all.every((r) => (r.length === 1 || r.length === 2) && r.every((k) => /[23]$/.test(k)))).toBe(true)
      expect(share(all.filter((r) => r.length === 2).length)).toBeGreaterThan(0.45)
      expect(share(all.filter((r) => r.length === 2).length)).toBeLessThan(0.55)
    }
  })

  it('yields two runes at threats 14 to 19, each rank 4 at 15%, 3 at 60%, else 2', () => {
    for (const threat of [14, 19]) {
      expect(rollRunes(threat, 'goblin_raid', scripted([0.35, 0.14, 0.0, 0.15]))).toEqual(['venom4', 'ember3'])
      expect(rollRunes(threat, 'goblin_raid', scripted([0.35, 0.74, 0.0, 0.75]))).toEqual(['venom3', 'ember2'])
      const ranks = rolls(threat, 'goblin_raid').flatMap((r) => (expect(r).toHaveLength(2), r.map((k) => k.slice(-1))))
      const of = (rank: string) => ranks.filter((k) => k === rank).length / ranks.length
      expect(of('4')).toBeGreaterThan(0.12)
      expect(of('4')).toBeLessThan(0.18)
      expect(of('3')).toBeGreaterThan(0.56)
      expect(of('3')).toBeLessThan(0.64)
    }
  })

  it('yields three runes at the Source\'s threat and above, each rank 3 at 50%, else 4', () => {
    for (const threat of [SOURCE_THREAT, SOURCE_THREAT + 1]) {
      expect(rollRunes(threat, 'source_guardians', scripted([0.35, 0.49, 0.0, 0.5, 0.95, 0.2]))).toEqual(['venom3', 'ember4', 'dawn3'])
      expect(rolls(threat, 'source_guardians').every((r) => r.length === 3 && r.every((k) => /[34]$/.test(k)))).toBe(true)
    }
  })

  it('favours a nest leader\'s element in the far rows too', () => {
    for (const threat of [9, 14, SOURCE_THREAT]) {
      const all = rolls(threat, 'spider_nest').flat()
      const venom = all.filter((k) => k.startsWith('venom')).length / all.length
      expect(venom).toBeGreaterThan(0.5)
      expect(venom).toBeLessThan(0.6)
    }
    expect(rollRunes(14, 'salamander_pool', scripted([0.2, 0.5, 0.9, 0.35, 0.5]))).toEqual(['ember3', 'venom3'])
  })

  it('puts the runes in the pouch on top of what it held', () => {
    const game = newGame()
    game.runes = { venom2: 1 }
    let found = takeRunes(game, 4, 'goblin_raid', 1)
    for (let seed = 2; found[0] !== 'venom2'; seed++) found = takeRunes(game, 4, 'goblin_raid', seed)
    expect(game.runes.venom2).toBeGreaterThanOrEqual(2)
  })
})

describe('trophies', () => {
  const table: Partial<Record<FoeKind, Trophy>> = { troll: { material: 'wyvern_hide', amount: 3 }, salamander: { material: 'drake_scale', amount: 6 } }

  it('sums each foe its kind\'s trophy from a table, a hero and a kind without one giving nothing', () => {
    expect(trophiesFor(['troll'], table)).toEqual({ wyvern_hide: 3 })
    expect(trophiesFor(['troll', 'troll', 'salamander', 'goblin', 'warrior'], table)).toEqual({ wyvern_hide: 6, drake_scale: 6 })
    expect(trophiesFor(['warrior', 'goblin'], table)).toEqual({})
    expect(trophiesFor(['troll', 'salamander'], {})).toEqual({})
  })

  it('adds the foes\' trophies to the stock and returns them, drawing nothing', () => {
    const game = newGame(undefined, null, 1)
    game.world.stock = { gold: 5, wyvern_hide: 1 }
    const rng = JSON.stringify(game.world)
    const kinds: Record<UnitId, UnitKind> = { hero_0: 'warrior', foe_0: 'troll', foe_1: 'troll', foe_2: 'goblin' }
    expect(takeTrophies(game, kinds, table)).toEqual({ wyvern_hide: 6 })
    expect(game.world.stock).toEqual({ gold: 5, wyvern_hide: 7 })
    expect(JSON.stringify({ ...game.world, stock: { gold: 5, wyvern_hide: 1 } })).toBe(rng)
  })

  it('takes nothing this stage: the table is empty until stage 11', () => {
    expect(TROPHIES).toEqual({})
    const game = newGame(undefined, null, 1)
    const before = JSON.stringify(game)
    expect(takeTrophies(game, { foe_0: 'troll', foe_1: 'bandit_brute' })).toEqual({})
    expect(JSON.stringify(game)).toBe(before)
  })
})
