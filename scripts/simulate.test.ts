import { describe, expect, it } from 'vitest'
import type { Side } from '../src/engine/battleEngine.ts'
import { monsterLocations, parseArgs, runCampaign, summarize, summarizeCampaigns, type LoggedEvent } from './simulate.ts'

function battle(battleId: number, rounds: number, winner: Side | null): LoggedEvent[] {
  return [
    {
      type: 'battle_start',
      battleId,
      seq: 0,
      round: 1,
      schemaVersion: 0,
      seed: null,
      meta: {},
      board: { cols: 1, rows: 1 },
      units: [],
    },
    {
      type: 'battle_end',
      battleId,
      seq: 1,
      round: rounds,
      winner,
      reason: winner ? 'defeat' : 'abandoned',
      survivors: {},
    },
  ]
}

describe('summarize', () => {
  it('averages rounds over decided battles only', () => {
    const events = [...battle(0, 3, 'player'), ...battle(1, 5, 'enemy'), ...battle(2, 200, null)]
    const summary = summarize(events, 3)
    expect(summary.playerWins).toBe(1)
    expect(summary.enemyWins).toBe(1)
    expect(summary.unresolved).toBe(1)
    expect(summary.avgRounds).toBe(4)
  })

  it('reports 0 average rounds when no battle was decided', () => {
    expect(summarize(battle(0, 200, null), 1).avgRounds).toBe(0)
  })
})

describe('summarize, with spells', () => {
  const events = (): LoggedEvent[] => {
    const [start, end] = battle(0, 3, 'player')
    if (start.type !== 'battle_start') throw new Error('expected a battle_start')
    const unit = (id: string, side: Side) => ({ id, side }) as (typeof start.units)[number]
    const cast = (caster: string, target: string, damage: number): LoggedEvent => ({
      type: 'cast', battleId: 0, seq: 1, round: 1, caster, spell: 'magic_arrow', target, distance: 4,
      apCost: 4, apAfter: 4, manaCost: 3, manaAfter: 15, casterFacing: 0, skill: 76, defenderAc: 15,
      damageDice: { count: 1, sides: 10, bonus: 0 }, targetHpBefore: 12, targetHpAfter: 12 - damage,
      attackRoll: 40, chance: 61, hit: damage > 0, critical: false, fumble: false, damage,
    })
    return [
      { ...start, units: [unit('mage', 'player'), unit('shaman', 'enemy')] },
      cast('mage', 'shaman', 7),
      cast('mage', 'shaman', 0),
      cast('shaman', 'mage', 4),
      end,
    ]
  }

  it('counts casts by side, and their damage with the rest, but not among the attacks', () => {
    expect(summarize(events(), 1)).toMatchObject({
      avgPlayerCasts: 2,
      avgEnemyCasts: 1,
      avgPlayerDamageDealt: 7,
      avgEnemyDamageDealt: 4,
      playerHitRate: 0,
      enemyHitRate: 0,
    })
    expect(summarize(battle(0, 3, 'player'), 1)).toMatchObject({ avgPlayerCasts: 0, avgEnemyCasts: 0 })
  })
})

describe('parseArgs', () => {
  it('takes --campaign, and with it refuses the flags that pick one battle', () => {
    expect(parseArgs(['--battles', '5'])).toMatchObject({ battles: 5, campaign: false })
    expect(parseArgs(['--campaign', '--battles', '5', '--seed', '1'])).toMatchObject({ battles: 5, campaign: true, seed: 1 })
    for (const flags of [['--threat', '3'], ['--encounter', 'kobold_scouts'], ['--party-level', '2']]) {
      expect(() => parseArgs(['--campaign', ...flags])).toThrow(`${flags[0]} cannot be used with --campaign`)
      expect(parseArgs(flags).campaign).toBe(false)
    }
  })

  it('arms the party with any weapon, the enchanted ones too', () => {
    expect(parseArgs(['--player-weapon', 'storm_wand']).playerWeapon?.name).toBe('Wand of Storms')
    expect(() => parseArgs(['--player-weapon', 'ring_protection'])).toThrow('--player-weapon must be one of')
  })
})

describe('a campaign', () => {
  const args = parseArgs(['--campaign'])
  const battles = runCampaign(3, 1, args, 100)
  const starts = battles.map((events) => events[0]).filter((e) => e.type === 'battle_start')
  const winners = battles.map((events) => events.at(-1)).map((e) => (e?.type === 'battle_end' ? e.winner : undefined))

  it('fights location after location, nearest first, until the map is clear or a battle is not won', () => {
    expect(battles.length).toBeGreaterThan(1)
    expect(battles.length).toBeLessThanOrEqual(monsterLocations())
    // Every battle but the last is won; the last is lost unless it cleared the map.
    expect(winners.slice(0, -1).every((winner) => winner === 'player')).toBe(true)
    if (battles.length < monsterLocations()) expect(winners.at(-1)).not.toBe('player')
    expect(starts.slice(0, 2).map((e) => e.meta.location)).toEqual(['goblin_raiders', 'kobold_scouts'])
    expect(new Set(starts.map((e) => e.meta.location)).size).toBe(battles.length)
  })

  it('logs each battle with its campaign, location and threat, under an id of its own', () => {
    expect(starts.every((e) => e.meta.campaign === 3 && e.meta.source === 'simulate')).toBe(true)
    expect(starts[0].meta).toMatchObject({ location: 'goblin_raiders', threat: 1, partyLevels: [1, 1, 1] })
    expect(battles.map((events) => events[0].battleId)).toEqual(battles.map((_, i) => 100 + i))
  })

  it('carries the party’s wounds and its levels from battle to battle', () => {
    const second = starts[1]
    expect((second.meta.partyLevels as number[]).every((level) => level >= 2)).toBe(true)
    const heroes = second.units.filter((u) => u.side === 'player')
    expect(heroes).toHaveLength(3)
    // A level heals, so wounds show only on a hero the first battle did not level; none starts above its most.
    expect(heroes.every((u) => u.hp <= u.maxHp && u.hp > 0)).toBe(true)
  })

  it('plays out the same from the same seed, casts included', () => {
    expect(runCampaign(3, 1, args, 100)).toEqual(battles)
    expect(battles.flat().some((e) => e.type === 'cast')).toBe(true)
  })

  it('is summed up by the share that cleared the map and the battles won at each threat', () => {
    const summary = summarizeCampaigns(battles.flat(), 1, monsterLocations())
    const won = winners.filter((winner) => winner === 'player').length
    expect(summary).toMatchObject({
      campaigns: 1,
      cleared: won === monsterLocations() ? 1 : 0,
      avgLocationsCleared: won,
    })
    expect(summary.byThreat.map((row) => row.threat)).toEqual([...new Set(starts.map((e) => e.meta.threat as number))].sort())
    expect(summary.byThreat.reduce((total, row) => total + row.battles, 0)).toBe(battles.length)
    expect(summary.byThreat[0]).toEqual({ threat: 1, battles: 2, won: 2, winRate: 1 })
    // A campaign that stops short has not cleared a shorter map's worth by accident.
    expect(summarizeCampaigns(battles.flat(), 2, won + 1)).toMatchObject({ cleared: 0, clearedShare: 0, avgLocationsCleared: won / 2 })
  })
})
