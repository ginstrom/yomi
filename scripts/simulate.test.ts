import { describe, expect, it } from 'vitest'
import type { SpellId } from '../src/combat/spells.ts'
import type { CastOutcome, Side } from '../src/engine/battleEngine.ts'
import { canAdvance } from '../src/character/progression.ts'
import { newGame } from '../src/game/gameState.ts'
import { heroId } from '../src/game/encounters.ts'
import { readyMadeParty } from '../src/game/party.ts'
import { OUTPOST_COST } from '../src/game/buildings.ts'
import { craft } from '../src/game/crafting.ts'
import { SOURCE_ID, newWorld, type MonsterLocation } from '../src/game/worldMap.ts'
import {
  MAX_CAMPAIGN_DAYS,
  OUTPOST_ERRAND_RADIUS,
  SOURCE_READY_LEVEL,
  hallErrand,
  nextTarget,
  outpostErrand,
  parseArgs,
  runCampaign,
  summarize,
  summarizeCampaigns,
  craftGear,
  materialNeeds,
  visitFacilities,
  visitGuildHall,
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
      image: false, damage, warded: 0, half: false, healed, hpBefore: 12, hpAfter: 12 - damage + healed, status,
    })
    const cast = (caster: string, spell: SpellId, outcomes: CastOutcome[]): LoggedEvent => ({
      type: 'cast', battleId: 0, seq: 1, round: 1, caster, spell, target: outcomes[0].unit, at: { q: 0, r: 0 },
      distance: 4, apCost: 4, apAfter: 4, manaCost: 3, manaAfter: 15, casterFacing: 0, skill: 76, outcomes, drained: 0,
    })
    return [
      { ...start, units: [unit('mage', 'player'), unit('shaman', 'enemy')] },
      cast('mage', 'magic_arrow', [outcome('shaman', 7)]),
      cast('mage', 'magic_arrow', [outcome('shaman', 0)]),
      cast('shaman', 'magic_arrow', [outcome('mage', 4)]),
      cast('shaman', 'heal', [outcome('shaman', 0, 6)]),
      cast('mage', 'sleep', [outcome('shaman', 0, 0, { id: 'asleep', turnsLeft: 2 })]),
      { type: 'status_tick', battleId: 0, seq: 2, round: 2, unit: 'shaman', status: 'poisoned', damage: 3, warded: 0, hpBefore: 5, hpAfter: 2 },
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

describe('summarize, with area abilities', () => {
  const events = (): LoggedEvent[] => {
    const [start, end] = battle(0, 3, 'player')
    if (start.type !== 'battle_start') throw new Error('expected a battle_start')
    const unit = (id: string, side: Side) => ({ id, side }) as (typeof start.units)[number]
    const outcome = (target: string, damage: number, status: CastOutcome['status'] = null): CastOutcome => ({
      unit: target, attackRoll: 40, chance: 61, defenderAc: 15, hit: status !== null, critical: false, fumble: false,
      image: false, damage, warded: 0, half: status === null, healed: 0, hpBefore: 12, hpAfter: 12 - damage, status,
    })
    const area = (user: string, outcomes: CastOutcome[]): LoggedEvent => ({
      type: 'ability', battleId: 0, seq: 1, round: 1, unit: user, ability: 'fire_spit', at: { q: 0, r: 0 }, shape: 'cone', hexes: [],
      distance: 1, apCost: 4, apAfter: 4, facing: 0, skill: 80, outcomes,
    })
    return [
      { ...start, units: [unit('hero', 'player'), unit('newt', 'enemy'), unit('goblin', 'enemy')] },
      area('newt', [outcome('hero', 9, { id: 'seared', turnsLeft: 1 }), outcome('goblin', 4)]),
      area('newt', [outcome('hero', 3)]),
      end,
    ]
  }

  it('counts area attacks by side, adding their damage and statuses to the user’s side, not among the attacks or casts', () => {
    expect(summarize(events(), 1)).toMatchObject({
      avgEnemyAreaAttacks: 2,
      avgPlayerAreaAttacks: 0,
      avgEnemyDamageDealt: 16,
      avgPlayerDamageDealt: 0,
      avgEnemyStatuses: 1,
      avgEnemyCasts: 0,
      enemyHitRate: 0,
    })
    expect(summarize(battle(0, 3, 'player'), 1)).toMatchObject({ avgPlayerAreaAttacks: 0, avgEnemyAreaAttacks: 0 })
  })

  it('counts a drain’s healing with the caster’s side', () => {
    const [start, end] = battle(0, 3, 'player')
    if (start.type !== 'battle_start') throw new Error('expected a battle_start')
    const drain: LoggedEvent = {
      type: 'cast', battleId: 0, seq: 1, round: 1, caster: 'witch', spell: 'drain_life', target: 'hero', at: { q: 0, r: 0 },
      distance: 2, apCost: 4, apAfter: 4, manaCost: 6, manaAfter: 0, casterFacing: 0, skill: 70, drained: 5, outcomes: [],
    }
    const units = [{ id: 'hero', side: 'player' }, { id: 'witch', side: 'enemy' }] as typeof start.units
    expect(summarize([{ ...start, units }, drain, end], 1)).toMatchObject({ avgEnemyHealing: 5, avgPlayerHealing: 0 })
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

  it('arms the party with any weapon, the enchanted, graded and modified ones too', () => {
    expect(parseArgs(['--player-weapon', 'storm_wand']).playerWeapon?.name).toBe('Wand of Storms')
    expect(parseArgs(['--player-weapon', 'iron_sword@2+light1']).playerWeapon?.name).toBe('Light Fine Iron Longsword (I)')
    expect(() => parseArgs(['--player-weapon', 'ring_protection'])).toThrow('--player-weapon must be the id of a weapon')
    expect(() => parseArgs(['--player-weapon', 'iron_sword+recurve1'])).toThrow('--player-weapon must be the id of a weapon')
  })

  it('takes --ready-level for a campaign only, a positive integer, by default SOURCE_READY_LEVEL', () => {
    expect(parseArgs(['--campaign', '--ready-level', '10']).readyLevel).toBe(10)
    expect(parseArgs([]).readyLevel).toBe(SOURCE_READY_LEVEL)
    expect(parseArgs(['--campaign']).readyLevel).toBe(SOURCE_READY_LEVEL)
    expect(() => parseArgs(['--ready-level', '10'])).toThrow('--ready-level')
    expect(() => parseArgs(['--ready-level', '10'])).toThrow('--campaign')
    expect(() => parseArgs(['--campaign', '--ready-level', '0'])).toThrow('--ready-level must be a positive integer')
    expect(() => parseArgs(['--campaign', '--ready-level', 'x'])).toThrow('--ready-level must be a positive integer')
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
    // A whole campaign again: seconds under the full suite's load.
  }, 20_000)

  it('is summed up by how campaigns ended and the battles won at each threat', () => {
    const other = { ...record, outcome: 'encampment' as const, days: record.days + 10 }
    const summary = summarizeCampaigns(battles.flat(), [record, other])
    expect(summary).toMatchObject({ campaigns: 2, sourceShare: record.outcome === 'source' ? 0.5 : 0, avgDays: record.days + 5 })
    expect(summary.outcomes.encampment).toBe(1)
    expect(summary.byThreat.map((row) => row.threat)).toEqual([...new Set(starts.map((e) => e.meta.threat as number))].sort())
    expect(summary.byThreat.reduce((total, row) => total + row.battles, 0)).toBe(battles.length)
    expect(summary.byThreat[0]).toEqual({ threat: 1, battles: 2, won: 2, winRate: 1 })
  })

  it('records the levels it ended at, the level of each hero who died, and the battles to each mark', () => {
    const last = battles.at(-1)!
    const end = last.at(-1)!
    const lastStart = starts.at(-1)!
    const lastLevels = lastStart.meta.partyLevels as number[]
    if (record.outcome === 'source' && end.type === 'battle_end') {
      // The members left are the heroes standing at the end of the last battle.
      const standing = lastLevels.filter((_, i) => end.survivors[heroId(i)] !== undefined)
      expect(record.finalLevels).toHaveLength(standing.length)
    }
    expect(record.finalLevels.length).toBeGreaterThan(0)
    // Levels never drop: each member left is at least the lowest level that set out on the last battle.
    expect(record.finalLevels.every((level) => level >= Math.min(...lastLevels))).toBe(true)
    expect(record.deathsAtLevel).toHaveLength(record.deaths)
    expect(record.deathsAtLevel.every((level) => level >= 1)).toBe(true)
    const lowestEver = Math.max(...starts.map((e) => Math.min(...(e.meta.partyLevels as number[]))), Math.min(...record.finalLevels))
    if (lowestEver >= 5) {
      expect(record.battlesToLevel[5]).toBeGreaterThanOrEqual(1)
      expect(record.battlesToLevel[5]).toBeLessThanOrEqual(record.battles)
      // The party's lowest level was below 5 when the battle that brought it there began.
      const at = record.battlesToLevel[5]!
      expect(Math.min(...(starts[at - 1].meta.partyLevels as number[]))).toBeLessThan(5)
      if (at < starts.length) expect(Math.min(...(starts[at].meta.partyLevels as number[]))).toBeGreaterThanOrEqual(5)
    } else expect(record.battlesToLevel[5]).toBeUndefined()
    expect(record.battlesToLevel[20]).toBeUndefined()
  })
})

describe('summarizeCampaigns, the levels', () => {
  const base = { ...runCampaign(3, 1, parseArgs(['--campaign']), 0).record }
  const records = [
    { ...base, finalLevels: [6, 7, 8], deathsAtLevel: [4, 3], battlesToLevel: { 5: 10 } },
    { ...base, finalLevels: [8, 9], deathsAtLevel: [4], battlesToLevel: { 5: 14, 10: 30 } },
    { ...base, outcome: 'fallen' as const, finalLevels: [], deathsAtLevel: [], battlesToLevel: {} },
  ]
  const summary = summarizeCampaigns([], records)

  it('averages the lowest and highest final level, leaving out a campaign with no one left', () => {
    expect(summary.avgLowestFinalLevel).toBe(7)
    expect(summary.avgHighestFinalLevel).toBe(8.5)
  })

  it('counts the deaths at each level, in rising level', () => {
    expect(summary.deathsByLevel).toEqual([{ level: 3, deaths: 1 }, { level: 4, deaths: 2 }])
  })

  it('averages the battles to each mark over the campaigns that reached it', () => {
    expect(summary.toLevel).toEqual([
      { level: 5, campaigns: 2, avgBattles: 12 },
      { level: 10, campaigns: 1, avgBattles: 30 },
      { level: 15, campaigns: 0, avgBattles: 0 },
      { level: 20, campaigns: 0, avgBattles: 0 },
    ])
  })
})

describe('nextTarget', () => {
  it('answers the nest pushing on a threatened site before the nearest', () => {
    const world = newWorld(1)
    const party = readyMadeParty()
    expect(nextTarget(world, party)?.id).toBe('goblin_raiders')
    const goldSeam = world.locations.find((l) => l.id === 'gold_seam')!
    const besiegers: MonsterLocation = {
      id: 'besiegers', kind: 'monsters', name: 'Besiegers', position: { q: goldSeam.position.q + 1, r: goldSeam.position.r },
      encounter: 'goblin_raid', threat: 1, loot: [],
    }
    world.locations.push(besiegers)
    expect(nextTarget(world, party)?.id).toBe('goblin_raiders')
    world.held.push('gold_seam')
    world.threatened = ['gold_seam']
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

  it('marches on the Source once every member has the ready level it is given', () => {
    const world = newWorld(1)
    const party = readyMadeParty()
    party.forEach((member, i) => (member.level = 3 + i))
    expect(nextTarget(world, party)?.id).not.toBe(SOURCE_ID)
    expect(nextTarget(world, party, 3)?.id).toBe(SOURCE_ID)
    for (const member of party) member.level = SOURCE_READY_LEVEL
    expect(nextTarget(world, party, SOURCE_READY_LEVEL + 1)?.id).not.toBe(SOURCE_ID)
    expect(nextTarget(world, party, SOURCE_READY_LEVEL)?.id).toBe(SOURCE_ID)
  })
})

describe('the guild hall in a campaign', () => {
  it('sends the party home when the stock affords an upgrade, which raises the hall and fills the new places', () => {
    const game = newGame(undefined, null, 1)
    expect(hallErrand(game)).toBe(false)
    game.world.stock = { gold: 100, iron: 50 }
    expect(hallErrand(game)).toBe(true)
    game.world.threatened = ['iron_vein']
    expect(hallErrand(game)).toBe(false)
    game.world.threatened = []

    expect(visitGuildHall(game)).toBe(1)
    expect(game.world.guildHall).toBe(3)
    expect(game.party.map((member) => member.name)).toEqual(['Aldric', 'Brenna', 'Delwyn', 'Garrick'])
    expect(canAdvance(game.party[3])).toBe(false)
    expect(game.world.stock).toEqual({ gold: 0, iron: 5 })
    // A fifth place, and no gold to fill it.
    expect(hallErrand(game)).toBe(false)
    game.world.stock.gold = 10
    expect(hallErrand(game)).toBe(true)
    expect(visitGuildHall(game)).toBe(1)
    expect(game.party.at(-1)!.name).toBe('Aldric 2')
  })
})

describe('the shrine and outposts in a campaign', () => {
  it('raises the shrine with what the guild hall and the other facilities leave', () => {
    const game = newGame(undefined, null, 1)
    game.world.stock = { gold: 100, iron: 50, silver: 15 }
    visitGuildHall(game)
    visitFacilities(game)
    // The hall's 90 gold first; the shrine's first level would want 20.
    expect(game.world.shrine).toBe(0)
    game.world.stock.gold = 60
    visitFacilities(game)
    expect(game.world.shrine).toBe(2)
    expect(game.world.stock).toMatchObject({ gold: 0, silver: 0 })
  })

  it('puts an outpost on the nearest held site without one, within reach, when the stock affords it', () => {
    const world = newWorld(1)
    const goldSeam = world.locations.find((l) => l.id === 'gold_seam')!
    world.held = [...new Set([...world.held, 'gold_seam'])]
    world.party = { q: goldSeam.position.q - 2, r: goldSeam.position.r }
    expect(outpostErrand(world)).toBeNull()
    world.stock = { ...OUTPOST_COST }
    expect(outpostErrand(world)?.id).toBe('gold_seam')
    world.outposts = ['gold_seam']
    expect(outpostErrand(world)?.id).not.toBe('gold_seam')
    world.outposts = []
    world.party = { q: goldSeam.position.q + OUTPOST_ERRAND_RADIUS + 8, r: goldSeam.position.r }
    expect(outpostErrand(world)?.id).not.toBe('gold_seam')
  })
})

describe('the trading post and crafting in a campaign', () => {
  it('sells the baggage and surplus, builds, buys better grades and crafts at home', () => {
    const game = newGame(undefined, null, 1)
    game.baggage.push(game.party[0].backpack[0]!)
    game.world.stock = { gold: 400, iron: 60, timber: 40, stone: 60, copper: 40, salt: 9 }
    const trade = visitFacilities(game)
    expect(game.baggage).toEqual([])
    expect(trade.goldFromSales).toBeGreaterThan(0)
    expect([game.world.tradingPost, game.world.workshop, game.world.infirmary]).toEqual([3, 2, 1])
    const sword = game.party[0].equipment.mainHand!
    expect([sword.base, sword.grade, sword.mod?.id]).toEqual(['iron_sword', 3, 'light'])
    expect(trade.goldOnGear).toBeGreaterThan(0)
    expect(trade.crafted).toBeGreaterThan(0)
  })

  it('keeps what the buildings still want, and sells the rest in pairs', () => {
    const game = newGame(undefined, null, 1)
    expect(materialNeeds(game).iron).toBeGreaterThan(0)
    expect(materialNeeds(game).salt).toBe(20)
  })

  it('crafts one piece in the field, a day, and nothing it already has', () => {
    const game = newGame(undefined, null, 1)
    game.world.party = { q: game.world.party.q + 1, r: game.world.party.r }
    game.world.stock = { gold: 50, iron: 50, timber: 50 }
    expect(craftGear(game, 1).crafted).toBe(1)
    expect(game.world.turn).toBe(2)
    expect(game.party[0].equipment.mainHand!.id).toBe('iron_sword+balanced1')
    expect(craftGear(game, 1).crafted).toBe(1)
    expect(game.party[1].equipment.mainHand!.id).toBe('yew_bow+recurve1')
    expect(craftGear(game, 1).crafted).toBe(0)
  })

  it('hands back the events of the days a field craft passes, for the campaign to tally', () => {
    const make = () => {
      const game = newGame(undefined, null, 1)
      game.world.party = { q: game.world.party.q + 1, r: game.world.party.r }
      game.world.stock = { gold: 50, iron: 50, timber: 50 }
      return game
    }
    const direct = make()
    const expected = craft(direct, { from: 'worn', member: 0, slot: 'mainHand', itemId: direct.party[0].equipment.mainHand!.id }, 'balanced', 1)
    const result = craftGear(make(), 1)
    expect(expected.refusal).toBeNull()
    expect(result.events).toEqual('events' in expected ? expected.events : undefined)
  })
})
