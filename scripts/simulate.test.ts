import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { SpellId } from '../src/combat/spells.ts'
import { BattleEngine, type CastOutcome, type Side } from '../src/engine/battleEngine.ts'
import { GOBLIN_STATS } from '../src/combat/combat.ts'
import { hex } from '../src/grid/hex.ts'
import { canAdvance } from '../src/character/progression.ts'
import { newGame } from '../src/game/gameState.ts'
import { heroId } from '../src/game/encounters.ts'
import { readyMadeParty } from '../src/game/party.ts'
import { OUTPOST_COST, TOWER_COST } from '../src/game/buildings.ts'
import { advance } from '../src/game/company.ts'
import { craft } from '../src/game/crafting.ts'
import type { FamilyId } from '../src/inventory/catalog.ts'
import { itemById, unruned } from '../src/inventory/inventory.ts'
import { modifiersFor } from '../src/inventory/modifiers.ts'
import { maxHp } from '../src/character/character.ts'
import { worldHealing } from '../src/character/worldCasting.ts'
import { lootRng, rollRunes } from '../src/game/loot.ts'
import { runePrice, salePrice } from '../src/game/tradingPost.ts'
import { pouchKeys } from '../src/inventory/runes.ts'
import { extractRefusal } from '../src/game/runecraft.ts'
import type { EncounterId } from '../src/game/encounters.ts'
import { ENCAMPMENT_ID, SOURCE_ID, routeTo, type MonsterLocation } from '../src/game/worldMap.ts'
import {
  CAMPAIGN_SEED_STEP,
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
  PREFERRED_MODIFIERS,
  RUNE_ORDER,
  runecraftGear,
  visitGuildHall,
  carryOut,
  decide,
  planOf,
  startCampaign,
  type CampaignRecord,
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

describe('summarize, with on-hit effects', () => {
  it('counts an attack’s on-hit damage with its weapon’s, its heal as healing and its statuses', () => {
    // A roll of 50 hits the goblin for 7, 6 through its resistance, then 3 of fire that sears it; the striker heals 1.
    const striker = { ...GOBLIN_STATS, name: 'Striker', toHit: 75, damage: { count: 1, sides: 8, bonus: 2 }, onHit: [{ damage: 3, element: 'fire' as const, status: { id: 'seared' as const, turns: 1 } }, { damage: 0, heal: 1 }] }
    const engine = new BattleEngine(
      { board: { cols: 4, rows: 3 }, units: [
        { id: 'hero', side: 'player', stats: striker, position: hex(1, 1), hp: 10 },
        { id: 'goblin', side: 'enemy', stats: { ...GOBLIN_STATS, maxHp: 30 }, position: hex(2, 1) },
      ] },
      { rng: () => 0.5 },
    )
    engine.step({ type: 'attack', unit: 'hero', target: 'goblin' })
    const events = engine.getLog().map((event) => ({ ...event, battleId: 0 }) as LoggedEvent)
    expect(summarize(events, 1)).toMatchObject({ avgPlayerDamageDealt: 9, avgPlayerHealing: 1, avgPlayerStatuses: 1, playerHitRate: 1 })
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

  it('takes rune loot after each win, from the seed the battle was fought with', () => {
    const won = starts.filter((_, i) => winners[i] === 'player')
    const expected = won.reduce(
      (n, e) => n + rollRunes(e.meta.threat as number, e.meta.encounter as EncounterId, lootRng(e.seed!)).length,
      0,
    )
    expect(record.runesFound).toBeGreaterThan(0)
    expect(record.runesFound).toBe(expected)
    for (const field of ['runesFound', 'runesBought', 'runesFused', 'socketsFilled', 'goldOnRunes'] as const) {
      expect(typeof record[field], field).toBe('number')
    }
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
    const game = newGame(readyMadeParty(), null, 1)
    const { world } = game
    const party = game.parties[0]
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
    const game = newGame(readyMadeParty(), null, 1)
    const { world } = game
    const party = game.parties[0]
    for (const member of party.members) member.level = SOURCE_READY_LEVEL
    expect(nextTarget(world, party)?.id).toBe(SOURCE_ID)
    party.members[0].level = 1
    expect(nextTarget(world, party)?.id).not.toBe(SOURCE_ID)
    world.locations = world.locations.filter((l) => l.kind !== 'monsters' || (l.kind === 'monsters' && l.source))
    expect(nextTarget(world, party)?.id).toBe(SOURCE_ID)
  })

  it('marches on the Source once every member has the ready level it is given', () => {
    const game = newGame(readyMadeParty(), null, 1)
    const { world } = game
    const party = game.parties[0]
    party.members.forEach((member, i) => (member.level = 3 + i))
    expect(nextTarget(world, party)?.id).not.toBe(SOURCE_ID)
    expect(nextTarget(world, party, 3)?.id).toBe(SOURCE_ID)
    for (const member of party.members) member.level = SOURCE_READY_LEVEL
    expect(nextTarget(world, party, SOURCE_READY_LEVEL + 1)?.id).not.toBe(SOURCE_ID)
    expect(nextTarget(world, party, SOURCE_READY_LEVEL)?.id).toBe(SOURCE_ID)
  })
})

describe('the guild hall in a campaign', () => {
  it('sends the party home when the stock affords an upgrade, which raises the hall and fills the new places', () => {
    const game = newGame(undefined, null, 1)
    expect(hallErrand(game, game.parties[0])).toBe(false)
    game.world.stock = { gold: 100, iron: 50 }
    expect(hallErrand(game, game.parties[0])).toBe(true)
    game.world.threatened = ['iron_vein']
    expect(hallErrand(game, game.parties[0])).toBe(false)
    game.world.threatened = []

    expect(visitGuildHall(game, game.parties[0])).toBe(1)
    expect(game.world.guildHall).toBe(3)
    expect(game.parties[0].members.map((member) => member.name)).toEqual(['Aldric', 'Brenna', 'Delwyn', 'Garrick'])
    expect(canAdvance(game.parties[0].members[3])).toBe(false)
    expect(game.world.stock).toEqual({ gold: 0, iron: 5 })
    // A fifth place, and no gold to fill it.
    expect(hallErrand(game, game.parties[0])).toBe(false)
    game.world.stock.gold = 10
    expect(hallErrand(game, game.parties[0])).toBe(true)
    expect(visitGuildHall(game, game.parties[0])).toBe(1)
    expect(game.parties[0].members.at(-1)!.name).toBe('Aldric 2')
  })
})

describe('the shrine and outposts in a campaign', () => {
  it('raises the shrine with what the guild hall and the other facilities leave', () => {
    const game = newGame(undefined, null, 1)
    game.world.stock = { gold: 100, iron: 50, silver: 15 }
    visitGuildHall(game, game.parties[0])
    visitFacilities(game, game.parties[0])
    // The hall's 90 gold first; the shrine's first level would want 20.
    expect(game.world.shrine).toBe(0)
    game.world.stock.gold = 60
    visitFacilities(game, game.parties[0])
    expect(game.world.shrine).toBe(2)
    expect(game.world.stock).toMatchObject({ gold: 0, silver: 0 })
  })

  it('puts an outpost on the nearest held site without one, within reach, when the stock affords it', () => {
    const game = newGame(undefined, null, 1)
    const { world } = game
    const party = game.parties[0]
    const goldSeam = world.locations.find((l) => l.id === 'gold_seam')!
    world.held = [...new Set([...world.held, 'gold_seam'])]
    party.position = { q: goldSeam.position.q - 2, r: goldSeam.position.r }
    expect(outpostErrand(world, party)).toBeNull()
    world.stock = { ...OUTPOST_COST }
    expect(outpostErrand(world, party)?.id).toBe('gold_seam')
    world.outposts = ['gold_seam']
    expect(outpostErrand(world, party)?.id).not.toBe('gold_seam')
    world.outposts = []
    party.position = { q: goldSeam.position.q + OUTPOST_ERRAND_RADIUS + 8, r: goldSeam.position.r }
    expect(outpostErrand(world, party)?.id).not.toBe('gold_seam')
  })
})

describe('the trading post and crafting in a campaign', () => {
  it('sells the baggage and surplus, builds, buys better grades and crafts at home', () => {
    const game = newGame(undefined, null, 1)
    game.parties[0].baggage.push(game.parties[0].members[0].backpack[0]!)
    game.world.stock = { gold: 400, iron: 60, timber: 40, stone: 60, copper: 40, salt: 9 }
    const trade = visitFacilities(game, game.parties[0])
    expect(game.parties[0].baggage).toEqual([])
    expect(trade.goldFromSales).toBeGreaterThan(0)
    expect([game.world.tradingPost, game.world.workshop, game.world.infirmary]).toEqual([3, 2, 1])
    const sword = game.parties[0].members[0].equipment.mainHand!
    expect([sword.base, sword.grade, sword.mod?.id]).toEqual(['iron_sword', 3, 'light'])
    expect(trade.goldOnGear).toBeGreaterThan(0)
    expect(trade.crafted).toBeGreaterThan(0)
  })

  describe('buying the dearest of the family the post sells', () => {
    const shopping = (level: number, gold: number) => {
      const game = newGame(undefined, null, 1)
      game.world.tradingPost = level
      game.world.stock = { gold }
      // Keep every other facility out of the way: only the gear is under test.
      game.world.workshop = 3
      game.world.infirmary = 3
      game.world.shrine = 3
      game.parties[0].members = [game.parties[0].members[0]]
      game.parties[0].members[0].equipment.mainHand = itemById('iron_sword')!
      return game
    }

    it('buys iron at grade 3 from a level 3 post, no tier 2', () => {
      const game = shopping(3, 500)
      const trade = visitFacilities(game, game.parties[0])
      // Its socket takes a rune bought there.
      expect(unruned(game.parties[0].members[0].equipment.mainHand!).id).toBe('iron_sword@3')
      expect(trade.tierTwoBought).toBe(0)
    })

    it('buys steel at grade 3 from a level 4 post, and counts it', () => {
      const game = shopping(4, 500)
      const trade = visitFacilities(game, game.parties[0])
      expect(unruned(game.parties[0].members[0].equipment.mainHand!).id).toBe('steel_longsword@3')
      expect(trade.tierTwoBought).toBeGreaterThanOrEqual(1)
    })

    it('buys the dearest it affords', () => {
      const game = shopping(4, 35)
      const trade = visitFacilities(game, game.parties[0])
      expect(game.parties[0].members[0].equipment.mainHand!.id).toBe('steel_longsword')
      expect(trade.tierTwoBought).toBe(1)
    })

    it('buys nothing when nothing dearer is affordable', () => {
      const game = shopping(4, 12)
      const trade = visitFacilities(game, game.parties[0])
      expect(game.parties[0].members[0].equipment.mainHand!.id).toBe('iron_sword')
      expect(trade.tierTwoBought).toBe(0)
      expect(trade.goldOnGear).toBe(0)
    })

    it('sells the old item back', () => {
      const game = shopping(3, 500)
      const trade = visitFacilities(game, game.parties[0])
      expect(game.parties[0].baggage).toEqual([])
      expect(trade.goldFromSales).toBeGreaterThan(0)
    })
  })

  it('keeps 20 silver for the post while it is below level 4', () => {
    const game = newGame(undefined, null, 1)
    game.world.tradingPost = 3
    expect(materialNeeds(game).silver).toBeGreaterThanOrEqual(20)
    game.world.tradingPost = 4
    const withPost = materialNeeds(game).silver ?? 0
    game.world.tradingPost = 3
    expect(materialNeeds(game).silver! - withPost).toBe(20)
  })

  it('prefers, family by family, only modifiers that fit the family', () => {
    expect(Object.keys(PREFERRED_MODIFIERS)).toEqual(['dagger', 'shortsword', 'longsword', 'battle_axe', 'greatsword', 'bow', 'shield', 'breastplate'])
    for (const [family, preferred] of Object.entries(PREFERRED_MODIFIERS)) {
      const fitting = modifiersFor(family as FamilyId).map((m) => m.id)
      for (const id of preferred!) expect(fitting, `${family} ${id}`).toContain(id)
    }
  })

  it('keeps what the buildings still want, and sells the rest in pairs', () => {
    const game = newGame(undefined, null, 1)
    expect(materialNeeds(game).iron).toBeGreaterThan(0)
    expect(materialNeeds(game).salt).toBe(20)
  })

  it('crafts one piece in the field, a day, and nothing it already has', () => {
    const game = newGame(undefined, null, 1)
    game.parties[0].position = { q: game.parties[0].position.q + 1, r: game.parties[0].position.r }
    game.world.stock = { gold: 50, iron: 50, timber: 50 }
    expect(craftGear(game, game.parties[0], 1).crafted).toBe(1)
    expect(game.world.turn).toBe(2)
    expect(game.parties[0].members[0].equipment.mainHand!.id).toBe('iron_sword+balanced1')
    expect(craftGear(game, game.parties[0], 1).crafted).toBe(1)
    expect(game.parties[0].members[1].equipment.mainHand!.id).toBe('yew_bow+recurve1')
    expect(craftGear(game, game.parties[0], 1).crafted).toBe(0)
  })

  it('hands back the events of the days a field craft passes, for the campaign to tally', () => {
    const make = () => {
      const game = newGame(undefined, null, 1)
      game.parties[0].position = { q: game.parties[0].position.q + 1, r: game.parties[0].position.r }
      game.world.stock = { gold: 50, iron: 50, timber: 50 }
      return game
    }
    const direct = make()
    const expected = craft(direct, { from: 'worn', party: 'party_1', member: 0, slot: 'mainHand', itemId: direct.parties[0].members[0].equipment.mainHand!.id }, 'balanced', 1)
    const result = (() => { const g = make(); return craftGear(g, g.parties[0], 1) })()
    expect(expected.refusal).toBeNull()
    expect(result.events).toEqual('events' in expected ? expected.events : undefined)
  })
})

describe('summarizeCampaigns, the runes', () => {
  it('averages the runes found, bought and fused, the sockets filled and the gold on runes', () => {
    const base = { ...runCampaign(3, 1, parseArgs(['--campaign']), 0).record }
    const records = [
      { ...base, runesFound: 4, runesBought: 1, runesFused: 0, socketsFilled: 2, goldOnRunes: 30 },
      { ...base, runesFound: 2, runesBought: 0, runesFused: 1, socketsFilled: 0, goldOnRunes: 10 },
    ]
    expect(summarizeCampaigns([], records)).toMatchObject({
      avgRunesFound: 3,
      avgRunesBought: 0.5,
      avgRunesFused: 0.5,
      avgSocketsFilled: 1,
      avgGoldOnRunes: 20,
    })
  }, 20_000)
})

describe('runes in a campaign', () => {
  /** One hero at the encampment, its gear and pouch set, the facilities set so that only the runes are at work. */
  const atHome = (opts: { workshop?: number; post?: number; gold?: number; runes?: Record<string, number>; gear?: Record<string, string> }) => {
    const game = newGame(undefined, null, 1)
    game.parties[0].members = [game.parties[0].members[0]]
    game.world.workshop = opts.workshop ?? 1
    game.world.tradingPost = opts.post ?? 1
    game.world.stock = { gold: opts.gold ?? 100 }
    game.runes = { ...opts.runes }
    const hero = game.parties[0].members[0]
    for (const [slot, id] of Object.entries(opts.gear ?? {})) hero.equipment[slot as 'mainHand'] = itemById(id)!
    hero.hp = maxHp(hero)
    return game
  }
  const worn = (game: ReturnType<typeof atHome>, slot: 'mainHand' | 'offHand' | 'armor') => game.parties[0].members[0].equipment[slot]?.id

  it('embeds weapons by Ember, Storm, Stone and armour and shields by Stone, Life', () => {
    expect(RUNE_ORDER).toEqual({ weapon: ['ember', 'storm', 'stone'], shield: ['stone', 'life'], armour: ['stone', 'life'] })
  })

  it('does nothing in the field: no workshop', () => {
    const game = atHome({ workshop: 0, post: 2, runes: { ember1: 3 }, gear: { mainHand: 'iron_sword@3' } })
    expect(runecraftGear(game, game.parties[0])).toEqual({ embedded: 0, fused: 0, bought: 0, gold: 0 })
    expect(game.runes).toEqual({ ember1: 3 })
    expect(game.world.stock).toEqual({ gold: 100 })
    expect(worn(game, 'mainHand')).toBe('iron_sword@3')
  })

  it('fuses three Lesser runes into one, and leaves the rest', () => {
    const three = atHome({ runes: { ember1: 3 } })
    expect(runecraftGear(three, three.parties[0])).toMatchObject({ fused: 1, gold: 20 })
    expect(three.runes).toEqual({ ember2: 1 })
    const five = atHome({ runes: { ember1: 5 } })
    expect(runecraftGear(five, five.parties[0]).fused).toBe(1)
    expect(five.runes).toEqual({ ember1: 2, ember2: 1 })
  })

  it('embeds a rune from the pouch in an empty socket, for its fee', () => {
    const game = atHome({ runes: { ember1: 1 }, gear: { mainHand: 'iron_sword@3' } })
    expect(runecraftGear(game, game.parties[0])).toEqual({ embedded: 1, fused: 0, bought: 0, gold: 5 })
    expect(worn(game, 'mainHand')).toBe('iron_sword@3#ember1')
    expect(game.runes).toEqual({})
    expect(game.world.stock.gold).toBe(95)
  })

  it('buys a Lesser rune for a socket the pouch cannot fill, where the post sells one', () => {
    const game = atHome({ post: 2, gear: { mainHand: 'iron_sword@3' } })
    expect(runecraftGear(game, game.parties[0])).toEqual({ embedded: 1, fused: 0, bought: 1, gold: runePrice('ember1') + 5 })
    expect(worn(game, 'mainHand')).toBe('iron_sword@3#ember1')
    const unsold = atHome({ post: 1, gear: { mainHand: 'iron_sword@3' } })
    expect(runecraftGear(unsold, unsold.parties[0])).toEqual({ embedded: 0, fused: 0, bought: 0, gold: 0 })
    expect(worn(unsold, 'mainHand')).toBe('iron_sword@3')
  })

  it('buys only what the pouch lacks, a rune for each socket', () => {
    const game = atHome({ post: 2, runes: { storm1: 1 }, gear: { mainHand: 'steel_longsword@3' } })
    expect(runecraftGear(game, game.parties[0])).toMatchObject({ embedded: 2, bought: 1 })
    expect(worn(game, 'mainHand')).toBe('steel_longsword@3#ember1.storm1')
  })

  it('embeds the highest rank of a kind first', () => {
    const game = atHome({ runes: { ember1: 1, ember2: 1 }, gear: { mainHand: 'iron_sword@3' } })
    runecraftGear(game, game.parties[0])
    expect(worn(game, 'mainHand')).toBe('iron_sword@3#ember2')
    expect(game.runes).toEqual({ ember1: 1 })
  })

  it('puts Stone, then Life, in armour, and never a Mind rune', () => {
    const stone = atHome({ runes: { life1: 1, stone1: 1, mind1: 1 }, gear: { armor: 'iron_breastplate@3' } })
    runecraftGear(stone, stone.parties[0])
    expect(worn(stone, 'armor')).toBe('iron_breastplate@3#stone1')
    const life = atHome({ runes: { life1: 1, mind1: 1 }, gear: { armor: 'iron_breastplate@3' } })
    runecraftGear(life, life.parties[0])
    expect(worn(life, 'armor')).toBe('iron_breastplate@3#life1')
    const mind = atHome({ runes: { mind1: 1 }, gear: { armor: 'iron_breastplate@3', mainHand: 'spark_wand@3' } })
    expect(runecraftGear(mind, mind.parties[0]).embedded).toBe(0)
    expect(mind.runes).toEqual({ mind1: 1 })
  })

  it('keeps a full hero at full health when a Life rune goes in', () => {
    const game = atHome({ runes: { life1: 1 }, gear: { armor: 'iron_breastplate@3' } })
    runecraftGear(game, game.parties[0])
    expect(game.parties[0].members[0].hp).toBe(maxHp(game.parties[0].members[0]))
  })

  it('embeds nothing it cannot pay for, and leaves the pouch as it was', () => {
    const game = atHome({ gold: 4, runes: { ember1: 1 }, gear: { mainHand: 'iron_sword@3' } })
    expect(runecraftGear(game, game.parties[0])).toEqual({ embedded: 0, fused: 0, bought: 0, gold: 0 })
    expect(game.runes).toEqual({ ember1: 1 })
    expect(worn(game, 'mainHand')).toBe('iron_sword@3')
  })

  describe('replacing runed gear at the trading post', () => {
    /** A level 4 post that sells a dearer sword and breastplate; the other facilities out of the way. */
    const replacing = (workshop: number, gear: Record<string, string>) => {
      const game = atHome({ workshop, post: 4, gold: 500 })
      // Only the item under test is worn, so that nothing else takes the gold.
      game.parties[0].members[0].equipment = Object.fromEntries(Object.entries(gear).map(([slot, id]) => [slot, itemById(id)!]))
      game.parties[0].members[0].hp = maxHp(game.parties[0].members[0])
      game.world.infirmary = 3
      game.world.shrine = 3
      return game
    }

    it('extracts the runes first at a level 2 workshop, for the fee, and embeds them again', () => {
      const game = replacing(2, { mainHand: 'iron_sword@3#storm1' })
      const trade = visitFacilities(game, game.parties[0])
      const sword = game.parties[0].members[0].equipment.mainHand!
      expect(sword.family).toBe('longsword')
      expect(sword.tier).toBe(2)
      expect([...(sword.runes ?? []), ...pouchKeys(game.runes)]).toContain('storm1')
      expect(trade.goldOnRunes).toBeGreaterThanOrEqual(10)
    })

    it('sells the runes with the old item below a level 2 workshop', () => {
      const game = replacing(1, { mainHand: 'iron_sword@3#storm1' })
      // No extraction fee can be paid: a level 1 workshop refuses to take the rune out.
      expect(extractRefusal(game, { from: 'worn', party: 'party_1', member: 0, slot: 'mainHand', itemId: 'iron_sword@3#storm1' }, 0)).toMatch(/level 2 workshop/)
      const trade = visitFacilities(game, game.parties[0])
      expect(game.world.workshop).toBe(1)
      // The rune went with the sword: its half price is in the sale.
      const runed = itemById('iron_sword@3#storm1')!
      expect(salePrice(runed)).toBeGreaterThan(salePrice(unruned(runed)))
      expect(trade.goldFromSales).toBe(salePrice(runed))
      const sword = game.parties[0].members[0].equipment.mainHand!
      expect(sword.tier).toBe(2)
      expect([...(sword.runes ?? []), ...pouchKeys(game.runes)]).not.toContain('storm1')
      expect(game.parties[0].baggage).toEqual([])
    })

    it('keeps hit points within the maximum when Life-runed armour is replaced, no rune going in after', () => {
      const game = replacing(0, { armor: 'iron_breastplate@3#life1' })
      const hero = game.parties[0].members[0]
      const before = maxHp(hero)
      visitFacilities(game, game.parties[0])
      expect(hero.equipment.armor!.runes ?? []).not.toContain('life1')
      expect(maxHp(hero)).toBeLessThan(before)
      expect(hero.hp).toBe(maxHp(hero))
    })
  })
})

/**
 * The refactor guard for stage 5: the output of `--campaign --battles 5 --seed 1` at commit 4a2b824, before any
 * change. Never edit it. A mismatch means a step changed behaviour.
 */
const GUARD_RECORDS: CampaignRecord[] = [
  { outcome: 'source', days: 333, battles: 20, spawns: 30, captured: 2, lost: 0, blighted: 0.41, healedHp: 138, campDays: 18, towersBuilt: 3, towersLost: 0, deaths: 4, recruits: 2, hallLevel: 3, shrineLevel: 1, outpostsBuilt: 0, tradingPostLevel: 1, workshopLevel: 0, infirmaryLevel: 1, goldOnGear: 0, goldFromSales: 5, tierTwoBought: 0, crafted: 4, fieldCraftDays: 4, runesFound: 16, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [8], deathsAtLevel: [8, 8, 7, 7], battlesToLevel: { 5: 6 } },
  { outcome: 'fallen', days: 234, battles: 18, spawns: 28, captured: 4, lost: 0, blighted: 0.42875, healedHp: 68, campDays: 6, towersBuilt: 3, towersLost: 0, deaths: 1, recruits: 2, hallLevel: 2, shrineLevel: 1, outpostsBuilt: 3, tradingPostLevel: 1, workshopLevel: 0, infirmaryLevel: 0, goldOnGear: 0, goldFromSales: 51, tierTwoBought: 0, crafted: 3, fieldCraftDays: 3, runesFound: 11, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [7, 7, 7, 7], deathsAtLevel: [3], battlesToLevel: {5: 10} },
  { outcome: 'fallen', days: 426, battles: 20, spawns: 30, captured: 4, lost: 1, blighted: 0.4425, healedHp: 148, campDays: 29, towersBuilt: 3, towersLost: 0, deaths: 3, recruits: 5, hallLevel: 3, shrineLevel: 3, outpostsBuilt: 0, tradingPostLevel: 1, workshopLevel: 1, infirmaryLevel: 1, goldOnGear: 0, goldFromSales: 184, tierTwoBought: 0, crafted: 9, fieldCraftDays: 3, runesFound: 12, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [8, 8, 7, 7, 7], deathsAtLevel: [3, 4, 2], battlesToLevel: {5: 9} },
  { outcome: 'fallen', days: 125, battles: 9, spawns: 17, captured: 0, lost: 0, blighted: 0.4066666666666667, healedHp: 57, campDays: 6, towersBuilt: 3, towersLost: 0, deaths: 0, recruits: 0, hallLevel: 1, shrineLevel: 0, outpostsBuilt: 0, tradingPostLevel: 1, workshopLevel: 0, infirmaryLevel: 0, goldOnGear: 0, goldFromSales: 0, tierTwoBought: 0, crafted: 1, fieldCraftDays: 1, runesFound: 5, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [5, 5, 5], deathsAtLevel: [], battlesToLevel: { 5: 6 } },
  { outcome: 'fallen', days: 62, battles: 5, spawns: 6, captured: 0, lost: 0, blighted: 0.41791666666666666, healedHp: 1, campDays: 1, towersBuilt: 0, towersLost: 0, deaths: 2, recruits: 0, hallLevel: 2, shrineLevel: 1, outpostsBuilt: 0, tradingPostLevel: 1, workshopLevel: 0, infirmaryLevel: 0, goldOnGear: 0, goldFromSales: 102, tierTwoBought: 0, crafted: 1, fieldCraftDays: 1, runesFound: 3, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [4], deathsAtLevel: [3, 3], battlesToLevel: {} },
]
const GUARD_EVENTS_SHA256 = 'c5c83f8e83d614381e6bd76e5bee1075e5d7b66c6cf9b5873eafce41453b2769'

describe('the campaign’s policy on the day loop', () => {
  const args = parseArgs(['--campaign'])
  const campaignOf = (setUp: (game: ReturnType<typeof newGame>) => void = () => {}) => {
    const game = newGame(undefined, null, 1)
    setUp(game)
    const run = startCampaign(0, 1, args, 0, game)
    return { run, game, party: game.parties[0], plan: planOf(run, game.parties[0]) }
  }
  const home = (game: ReturnType<typeof newGame>) => game.world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position

  it('runs the home errands at the guild hall, then orders the walk to the next target', () => {
    const { run, game, party } = campaignOf((game) => (game.world.stock = { gold: 100, iron: 50 }))
    expect(hallErrand(game, party)).toBe(true)
    expect(decide(run, party)).toEqual({ kind: 'hall' })
    expect(carryOut(run, party, { kind: 'hall' })).toBeNull()
    expect(game.world.guildHall).toBe(3)
    expect(party.members).toHaveLength(4)
    expect(run.record.recruits).toBe(1)
    const target = nextTarget(game.world, party, args.readyLevel)!
    expect(decide(run, party)).toEqual({ kind: 'order', order: { kind: 'travel', to: target.position } })
    expect(game.world.turn).toBe(1)
  })

  it('orders the walk home when there is a hall errand away from home', () => {
    const { run, game, party } = campaignOf((game) => {
      game.world.stock = { gold: 100, iron: 50 }
      game.parties[0].position = { q: game.parties[0].position.q + 2, r: game.parties[0].position.r }
    })
    expect(decide(run, party)).toEqual({ kind: 'order', order: { kind: 'travel', to: home(game) } })
    expect(carryOut(run, party, decide(run, party))).toBe('standing')
    expect(party.order).toMatchObject({ kind: 'travel', to: home(game) })
  })

  it('fights the target it has walked to and confronts, giving no new order', () => {
    const { run, game, party, plan } = campaignOf()
    const target = nextTarget(game.world, party, args.readyLevel)!
    party.position = target.position
    party.confronting = target.id
    Object.assign(plan, { phase: 'target', to: target.position, target })
    expect(decide(run, party)).toEqual({ kind: 'fight', target })
    expect(party.order.kind).toBe('idle')
  })

  it('casts the heals and orders a camp for a party wounded after a win, and no camp for one the cast makes whole', () => {
    const away = (game: ReturnType<typeof newGame>) => (game.parties[0].position = { q: game.parties[0].position.q + 1, r: game.parties[0].position.r })
    const wounded = campaignOf(away)
    wounded.plan.phase = 'heal'
    wounded.party.members[0].hp = 1
    for (const member of wounded.party.members) member.mana = 0
    expect(decide(wounded.run, wounded.party)).toEqual({ kind: 'heal' })
    expect(carryOut(wounded.run, wounded.party, { kind: 'heal' })).toBeNull()
    expect(decide(wounded.run, wounded.party)).toEqual({ kind: 'order', order: { kind: 'camp' } })
    expect(carryOut(wounded.run, wounded.party, { kind: 'order', order: { kind: 'camp' } })).toBe('standing')
    expect(wounded.party.order.kind).toBe('camp')

    const scratched = campaignOf(away)
    scratched.plan.phase = 'heal'
    // Wounded by what one Heal restores, which the mage casts.
    scratched.party.members[0].hp = maxHp(scratched.party.members[0]) - worldHealing('heal')
    expect(decide(scratched.run, scratched.party)).toEqual({ kind: 'heal' })
    carryOut(scratched.run, scratched.party, { kind: 'heal' })
    expect(scratched.run.record.healedHp).toBe(worldHealing('heal'))
    expect(decide(scratched.run, scratched.party)).toEqual({ kind: 'order', order: { kind: 'idle' } })
    expect(carryOut(scratched.run, scratched.party, { kind: 'order', order: { kind: 'idle' } })).toBeNull()
    // Whole, it goes round again: home's errands, then the next target.
    expect(decide(scratched.run, scratched.party)).toMatchObject({ kind: 'order', order: { kind: 'travel' } })
    expect(scratched.game.world.turn).toBe(1)
  })

  it('orders a walk cut short again, on a route planned afresh from where the party stands', () => {
    const { run, game, party, plan } = campaignOf()
    const to = { q: party.position.q + 20, r: party.position.r }
    Object.assign(plan, { phase: 'target', to, target: null })
    expect(decide(run, party)).toEqual({ kind: 'order', order: { kind: 'travel', to } })
    expect(carryOut(run, party, { kind: 'order', order: { kind: 'travel', to } })).toBe('standing')
    const reports = advance(game, Infinity)
    expect(reports.at(-1)!.interrupt?.event.type).toBe('sighted')
    expect(party.position).not.toEqual(to)
    // The order still stands on its old route; the policy replaces it.
    expect(party.order.kind).toBe('travel')
    if (party.order.kind === 'travel') party.order.route = [to]
    const decision = decide(run, party)
    expect(decision).toEqual({ kind: 'order', order: { kind: 'travel', to } })
    const fresh = routeTo(game.world, party, to)
    carryOut(run, party, decision)
    expect(party.order).toEqual({ kind: 'travel', to, route: fresh })
  })

  it('builds the tower and makes the field craft after a win as acts, a day each', () => {
    const { run, game, party, plan } = campaignOf((game) => {
      game.parties[0].position = { q: game.parties[0].position.q + 2, r: game.parties[0].position.r }
      game.world.stock = { ...TOWER_COST, gold: (TOWER_COST.gold ?? 0) + 50, iron: (TOWER_COST.iron ?? 0) + 50, timber: 9 }
    })
    plan.phase = 'tower'
    expect(decide(run, party)).toEqual({ kind: 'act', action: { kind: 'tower' } })
    carryOut(run, party, { kind: 'act', action: { kind: 'tower' } })
    expect(game.world.turn).toBe(2)
    expect(game.world.towers).toHaveLength(1)
    expect(run.record.towersBuilt).toBe(1)
    // No outpost: the stock lacks its timber.
    expect(decide(run, party)).toEqual({ kind: 'craft' })
    carryOut(run, party, { kind: 'craft' })
    expect(game.world.turn).toBe(3)
    expect(run.record).toMatchObject({ crafted: 1, fieldCraftDays: 1 })
    expect(party.order.kind).toBe('idle')
  })
})

describe('the refactor guard', () => {
  it('plays 5 seeded campaigns exactly as it did before stage 5', () => {
    const args = parseArgs(['--campaign', '--battles', '5', '--seed', '1'])
    const records: CampaignRecord[] = []
    const lines: string[] = []
    let firstBattleId = 0
    for (let run = 0; run < 5; run++) {
      const { battles, record } = runCampaign(run, (1 + run * CAMPAIGN_SEED_STEP) >>> 0, args, firstBattleId)
      firstBattleId += battles.length
      records.push(record)
      for (const events of battles) for (const event of events) lines.push(JSON.stringify(event))
    }
    expect(records).toEqual(GUARD_RECORDS)
    expect(createHash('sha256').update(lines.join('\n')).digest('hex')).toBe(GUARD_EVENTS_SHA256)
  }, 60_000)
})
