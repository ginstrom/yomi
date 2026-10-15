import { describe, expect, it } from 'vitest'
import type { SpellId } from '../src/combat/spells.ts'
import type { CastOutcome, Side } from '../src/engine/battleEngine.ts'
import { readyMadeParty } from '../src/game/party.ts'
import { SOURCE_ID, newWorld, type MonsterLocation } from '../src/game/worldMap.ts'
import {
  MAX_CAMPAIGN_DAYS,
  SOURCE_READY_LEVEL,
  nextTarget,
  parseArgs,
  runCampaign,
  summarize,
  summarizeCampaigns,
  type LoggedEvent,
} from './simulate.ts'

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
    const outcome = (target: string, damage: number, healed = 0, status: CastOutcome['status'] = null): CastOutcome => ({
      unit: target, attackRoll: 40, chance: 61, defenderAc: 15, hit: damage > 0, critical: false, fumble: false,
      image: false, damage, healed, hpBefore: 12, hpAfter: 12 - damage + healed, status,
    })
    const cast = (caster: string, spell: SpellId, outcomes: CastOutcome[]): LoggedEvent => ({
      type: 'cast', battleId: 0, seq: 1, round: 1, caster, spell, target: outcomes[0].unit, at: { q: 0, r: 0 },
      distance: 4, apCost: 4, apAfter: 4, manaCost: 3, manaAfter: 15, casterFacing: 0, skill: 76, outcomes,
    })
    return [
      { ...start, units: [unit('mage', 'player'), unit('shaman', 'enemy')] },
      cast('mage', 'magic_arrow', [outcome('shaman', 7)]),
      cast('mage', 'magic_arrow', [outcome('shaman', 0)]),
      cast('shaman', 'magic_arrow', [outcome('mage', 4)]),
      cast('shaman', 'heal', [outcome('shaman', 0, 6)]),
      cast('mage', 'sleep', [outcome('shaman', 0, 0, { id: 'asleep', turnsLeft: 2 })]),
      { type: 'status_tick', battleId: 0, seq: 2, round: 2, unit: 'shaman', status: 'poisoned', damage: 3, hpBefore: 5, hpAfter: 2 },
      end,
    ]
  }

  it('counts casts by side, their damage and a status’s with the rest, healing and statuses, but not among the attacks', () => {
    expect(summarize(events(), 1)).toMatchObject({
      avgPlayerCasts: 3,
      avgEnemyCasts: 2,
      avgPlayerDamageDealt: 10,
      avgEnemyDamageDealt: 4,
      avgEnemyHealing: 6,
      avgPlayerHealing: 0,
      avgPlayerStatuses: 1,
      avgEnemyStatuses: 0,
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
  const { battles, record } = runCampaign(3, 1, args, 100)
  const starts = battles.map((events) => events[0]).filter((e) => e.type === 'battle_start')
  const winners = battles.map((events) => events.at(-1)).map((e) => (e?.type === 'battle_end' ? e.winner : undefined))

  it('fights nest after nest, the home band first, until the Source is beaten or a battle is not won', () => {
    expect(battles.length).toBeGreaterThan(1)
    // Every battle but the last is won; the last is the Source's unless the party fell.
    expect(winners.slice(0, -1).every((winner) => winner === 'player')).toBe(true)
    expect(record.outcome).toBe(winners.at(-1) === 'player' ? 'source' : 'fallen')
    if (record.outcome === 'source') expect(starts.at(-1)?.meta.location).toBe(SOURCE_ID)
    expect(starts.slice(0, 2).map((e) => e.meta.location)).toEqual(['goblin_raiders', 'kobold_scouts'])
    expect(new Set(starts.map((e) => e.meta.location)).size).toBe(battles.length)
    expect(record.battles).toBe(battles.length)
  })

  it('spends days as it goes, while the blight spawns', () => {
    expect(record.days).toBeGreaterThan(battles.length)
    expect(record.days).toBeLessThanOrEqual(MAX_CAMPAIGN_DAYS + 1)
    expect(record.spawns).toBeGreaterThan(0)
    const days = starts.map((e) => e.meta.day as number)
    expect(days).toEqual([...days].sort((a, b) => a - b))
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
    expect(runCampaign(3, 1, args, 100)).toEqual({ battles, record })
    expect(battles.flat().some((e) => e.type === 'cast')).toBe(true)
  })

  it('is summed up by how campaigns ended and the battles won at each threat', () => {
    const other = { ...record, outcome: 'encampment' as const, days: record.days + 10 }
    const summary = summarizeCampaigns(battles.flat(), [record, other])
    expect(summary).toMatchObject({ campaigns: 2, sourceShare: record.outcome === 'source' ? 0.5 : 0, avgDays: record.days + 5 })
    expect(summary.outcomes.encampment).toBe(1)
    expect(summary.byThreat.map((row) => row.threat)).toEqual([...new Set(starts.map((e) => e.meta.threat as number))].sort())
    expect(summary.byThreat.reduce((total, row) => total + row.battles, 0)).toBe(battles.length)
    expect(summary.byThreat[0]).toEqual({ threat: 1, battles: 2, won: 2, winRate: 1 })
  })
})

describe('nextTarget', () => {
  it('answers the nest pushing on a threatened site before the nearest', () => {
    const world = newWorld(1)
    const party = readyMadeParty()
    expect(nextTarget(world, party)?.id).toBe('goblin_raiders')
    const stonebridge = world.locations.find((l) => l.id === 'stonebridge')!
    const besiegers: MonsterLocation = {
      id: 'besiegers', kind: 'monsters', name: 'Besiegers', position: { q: stonebridge.position.q + 1, r: stonebridge.position.r },
      encounter: 'goblin_raid', threat: 1, loot: [],
    }
    world.locations.push(besiegers)
    expect(nextTarget(world, party)?.id).toBe('goblin_raiders')
    world.held.push('stonebridge')
    world.threatened = ['stonebridge']
    expect(nextTarget(world, party)).toBe(besiegers)
  })

  it('marches on the Source once every member is ready, or nothing else is left', () => {
    const world = newWorld(1)
    const party = readyMadeParty()
    for (const member of party) member.level = SOURCE_READY_LEVEL
    expect(nextTarget(world, party)?.id).toBe(SOURCE_ID)
    party[0].level = 1
    expect(nextTarget(world, party)?.id).not.toBe(SOURCE_ID)
    world.locations = world.locations.filter((l) => l.kind !== 'monsters' || (l.kind === 'monsters' && l.source))
    expect(nextTarget(world, party)?.id).toBe(SOURCE_ID)
  })
})
