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
import { advance, formParty, moveHero, type DayReport } from '../src/game/company.ts'
import { MAX_PARTIES, type Expedition } from '../src/game/expedition.ts'
import { craft } from '../src/game/crafting.ts'
import type { FamilyId } from '../src/inventory/catalog.ts'
import { itemById, unruned } from '../src/inventory/inventory.ts'
import { modifiersFor } from '../src/inventory/modifiers.ts'
import { maxHp } from '../src/character/character.ts'
import { worldHealing } from '../src/character/worldCasting.ts'
import { lootRng, rollRunes } from '../src/game/loot.ts'
import { runePrice, salePrice } from '../src/game/tradingPost.ts'
import { pouchKeys } from '../src/inventory/runes.ts'
import { boardIndex, monsterStrength } from '../src/game/blight.ts'
import { LOSS_LEVEL, daysToFall } from '../src/game/territory.ts'
import { extractRefusal } from '../src/game/runecraft.ts'
import type { EncounterId } from '../src/game/encounters.ts'
import { ENCAMPMENT_ID, SOURCE_ID, routeTo, type MonsterLocation } from '../src/game/worldMap.ts'
import {
  CAMPAIGN_SEED_STEP,
  MAX_CAMPAIGN_DAYS,
  OUTPOST_ERRAND_RADIUS,
  SOURCE_READY_LEVEL,
  HALL_FOR_PARTIES,
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
  fieldCraft,
  takeDays,
  planOf,
  roleOf,
  setVanguard,
  startCampaign,
  finishCampaign,
  GUARD_MIN_SIZE,
  IDLE_DAYS,
  advanceLimit,
  decideGuard,
  formGuard,
  guardChoice,
  needsDecision,
  playRound,
  strongestParty,
  takenTargets,
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

  it('takes --parties for a campaign only, 1 to MAX_PARTIES, by default MAX_PARTIES', () => {
    expect(parseArgs(['--campaign', '--parties', '1']).parties).toBe(1)
    expect(parseArgs(['--campaign', '--parties', '2']).parties).toBe(2)
    expect(parseArgs(['--campaign']).parties).toBe(MAX_PARTIES)
    expect(parseArgs([]).parties).toBe(MAX_PARTIES)
    for (const raw of ['0', String(MAX_PARTIES + 1), 'x']) {
      expect(() => parseArgs(['--campaign', '--parties', raw])).toThrow(`--parties must be from 1 to ${MAX_PARTIES}`)
    }
    expect(() => parseArgs(['--parties', '2'])).toThrow('--parties applies only to --campaign')
  })
})

describe('a campaign', () => {
  const args = parseArgs(['--campaign', '--parties', '1'])
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
  const base = { ...runCampaign(3, 1, parseArgs(['--campaign', '--parties', '1']), 0).record }
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

describe('the guild hall’s cap in the simulator', () => {
  it('raises the hall no further than one party uses by default, and keeps no stone or silver back for the barracks', () => {
    const game = newGame(undefined, null, 1)
    game.world.stock = { gold: 1000, iron: 500, stone: 100, silver: 100 }
    visitGuildHall(game, game.parties[0])
    expect(game.world.guildHall).toBe(HALL_FOR_PARTIES[0])
    expect(game.world.stock).toMatchObject({ stone: 100, silver: 100 })
    expect(hallErrand(game, game.parties[0])).toBe(false)
    const needs = materialNeeds(game)
    game.world.stock = {}
    const unbought = { ...needs }
    game.world.guildHall = 5
    // The hall's own levels add nothing to what is kept once the cap is reached.
    expect(materialNeeds(game)).toEqual(unbought)
  })

  it('recruits join at the hall’s level', () => {
    const game = newGame(undefined, null, 1)
    game.world.stock = { gold: 100, iron: 50 }
    game.parties[0].members.length = 2
    visitGuildHall(game, game.parties[0])
    expect(game.parties[0].members.at(-1)!.level).toBe(3)
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
    const base = { ...runCampaign(3, 1, parseArgs(['--campaign', '--parties', '1']), 0).record }
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
 * The refactor guard: the output of `--campaign --battles 5 --seed 1`, first recorded for stage 5 at commit 4a2b824.
 * Re-recorded in stage 6 step 09, from `--parties 1`, for `LOG_SCHEMA_VERSION` 24 (battle_start meta `party` and
 * `role`) and the company record's new fields, every old field and every other event unchanged; never edited again
 * in this stage. A mismatch means a step changed behaviour.
 */
const GUARD_RECORDS: CampaignRecord[] = [
  { outcome: 'source', days: 333, battles: 20, spawns: 30, captured: 2, lost: 0, blighted: 0.41, healedHp: 138, campDays: 18, towersBuilt: 3, towersLost: 0, deaths: 4, recruits: 2, hallLevel: 3, shrineLevel: 1, outpostsBuilt: 0, tradingPostLevel: 1, workshopLevel: 0, infirmaryLevel: 1, goldOnGear: 0, goldFromSales: 5, tierTwoBought: 0, crafted: 4, fieldCraftDays: 4, runesFound: 16, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [8], deathsAtLevel: [8, 8, 7, 7], battlesToLevel: { 5: 6 }, roles: { vanguard: { battles: 20, wipes: 0, finalLevels: [[8]] }, guard: { battles: 0, wipes: 0, finalLevels: [] } }, wipes: 0, promotions: 0, vanguardWalkHomeDays: 66, guardBattles: 0 },
  { outcome: 'fallen', days: 234, battles: 18, spawns: 28, captured: 4, lost: 0, blighted: 0.42875, healedHp: 68, campDays: 6, towersBuilt: 3, towersLost: 0, deaths: 1, recruits: 2, hallLevel: 2, shrineLevel: 1, outpostsBuilt: 3, tradingPostLevel: 1, workshopLevel: 0, infirmaryLevel: 0, goldOnGear: 0, goldFromSales: 51, tierTwoBought: 0, crafted: 3, fieldCraftDays: 3, runesFound: 11, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [7, 7, 7, 7], deathsAtLevel: [3], battlesToLevel: {5: 10}, roles: { vanguard: { battles: 18, wipes: 1, finalLevels: [] }, guard: { battles: 0, wipes: 0, finalLevels: [] } }, wipes: 1, promotions: 0, vanguardWalkHomeDays: 33, guardBattles: 0 },
  { outcome: 'fallen', days: 426, battles: 20, spawns: 30, captured: 4, lost: 1, blighted: 0.4425, healedHp: 148, campDays: 29, towersBuilt: 3, towersLost: 0, deaths: 3, recruits: 5, hallLevel: 3, shrineLevel: 3, outpostsBuilt: 0, tradingPostLevel: 1, workshopLevel: 1, infirmaryLevel: 1, goldOnGear: 0, goldFromSales: 184, tierTwoBought: 0, crafted: 9, fieldCraftDays: 3, runesFound: 12, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [8, 8, 7, 7, 7], deathsAtLevel: [3, 4, 2], battlesToLevel: {5: 9}, roles: { vanguard: { battles: 20, wipes: 1, finalLevels: [] }, guard: { battles: 0, wipes: 0, finalLevels: [] } }, wipes: 1, promotions: 0, vanguardWalkHomeDays: 129, guardBattles: 0 },
  { outcome: 'fallen', days: 125, battles: 9, spawns: 17, captured: 0, lost: 0, blighted: 0.4066666666666667, healedHp: 57, campDays: 6, towersBuilt: 3, towersLost: 0, deaths: 0, recruits: 0, hallLevel: 1, shrineLevel: 0, outpostsBuilt: 0, tradingPostLevel: 1, workshopLevel: 0, infirmaryLevel: 0, goldOnGear: 0, goldFromSales: 0, tierTwoBought: 0, crafted: 1, fieldCraftDays: 1, runesFound: 5, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [5, 5, 5], deathsAtLevel: [], battlesToLevel: { 5: 6 }, roles: { vanguard: { battles: 9, wipes: 1, finalLevels: [] }, guard: { battles: 0, wipes: 0, finalLevels: [] } }, wipes: 1, promotions: 0, vanguardWalkHomeDays: 0, guardBattles: 0 },
  { outcome: 'fallen', days: 62, battles: 5, spawns: 6, captured: 0, lost: 0, blighted: 0.41791666666666666, healedHp: 1, campDays: 1, towersBuilt: 0, towersLost: 0, deaths: 2, recruits: 0, hallLevel: 2, shrineLevel: 1, outpostsBuilt: 0, tradingPostLevel: 1, workshopLevel: 0, infirmaryLevel: 0, goldOnGear: 0, goldFromSales: 102, tierTwoBought: 0, crafted: 1, fieldCraftDays: 1, runesFound: 3, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [4], deathsAtLevel: [3, 3], battlesToLevel: {}, roles: { vanguard: { battles: 5, wipes: 1, finalLevels: [] }, guard: { battles: 0, wipes: 0, finalLevels: [] } }, wipes: 1, promotions: 0, vanguardWalkHomeDays: 22, guardBattles: 0 },
]
const GUARD_EVENTS_SHA256 = '820e5b5d2740ee6549069200270ab5c882e3e95033d37dc1b5eb191c5c472cf1'

describe('the campaign’s policy on the day loop', () => {
  const args = parseArgs(['--campaign', '--parties', '1'])
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
    // The act is a day order: no day passes until the loop's next advance.
    expect(carryOut(run, party, { kind: 'act', action: { kind: 'tower' } })).toBe('standing')
    expect(game.world.turn).toBe(1)
    expect(party.order).toEqual({ kind: 'day', action: { kind: 'tower' } })
    expect(plan.running).toBe('day')
    let reports = advance(game, Infinity)
    expect(reports).toHaveLength(1)
    takeDays(run, reports)
    expect(game.world.turn).toBe(2)
    expect(game.world.towers).toHaveLength(1)
    expect(run.record.towersBuilt).toBe(1)
    // No outpost: the stock lacks its timber.
    expect(decide(run, party)).toEqual({ kind: 'craft' })
    expect(carryOut(run, party, { kind: 'craft' })).toBe('standing')
    expect(game.world.turn).toBe(2)
    expect(party.order).toMatchObject({ kind: 'day', action: { kind: 'craft' } })
    reports = advance(game, Infinity)
    expect(reports).toHaveLength(1)
    takeDays(run, reports)
    expect(game.world.turn).toBe(3)
    expect(run.record).toMatchObject({ crafted: 1, fieldCraftDays: 1 })
    expect(party.order.kind).toBe('idle')
  })

  it('asks again, passing no day, when an act is refused', () => {
    const { run, game, party } = campaignOf()
    // At the encampment: no watchtower there.
    expect(carryOut(run, party, { kind: 'act', action: { kind: 'tower' } })).toBeNull()
    expect(party.order.kind).toBe('idle')
    expect(game.world.turn).toBe(1)
  })

  describe('fieldCraft', () => {
    const field = (setUp: (game: ReturnType<typeof newGame>) => void = () => {}) => {
      const game = newGame(undefined, null, 1)
      game.parties[0].position = { q: game.parties[0].position.q + 1, r: game.parties[0].position.r }
      game.world.stock = { gold: 50, iron: 50, timber: 50 }
      setUp(game)
      return game
    }
    /** What craftGear(game, party, 1) makes on a twin, as the place it changed and the item it put there. */
    const madeByCraftGear = (setUp?: (game: ReturnType<typeof newGame>) => void) => {
      const game = field(setUp)
      const before = structuredClone(game.parties[0].members.map((m) => m.equipment))
      const { crafted } = craftGear(game, game.parties[0], 1)
      if (crafted === 0) return null
      for (const [member, hero] of game.parties[0].members.entries()) {
        for (const slot of ['mainHand', 'offHand', 'armor'] as const) {
          if (hero.equipment[slot]?.id !== before[member][slot]?.id) return { member, slot, item: hero.equipment[slot]!.id }
        }
      }
      throw new Error('crafted, but nothing changed')
    }
    const cases: Array<[string, (game: ReturnType<typeof newGame>) => void]> = [
      ['the first piece', () => {}],
      ['past a piece that has it', (game) => (game.parties[0].members[0].equipment.mainHand = itemById('iron_sword+balanced1')!)],
    ]
    it.each(cases)('picks the craft craftGear makes: %s', (_, setUp) => {
      const game = field(setUp)
      const action = fieldCraft(game, game.parties[0])
      const made = madeByCraftGear(setUp)
      expect(made).not.toBeNull()
      expect(action).not.toBeNull()
      expect(action!.place).toMatchObject({ from: 'worn', party: 'party_1', member: made!.member, slot: made!.slot })
      expect(`${action!.place.itemId.split('+')[0]}+${action!.modifier}${action!.grade}`).toBe(made!.item)
      expect(game.world.turn).toBe(1)
    })

    it.each<[string, (game: ReturnType<typeof newGame>) => void]>([
      ['with no stock', (game) => (game.world.stock = {})],
      ['when every piece it would craft in the field has it', (game) => {
        game.parties[0].members[0].equipment.mainHand = itemById('iron_sword+balanced1')!
        game.parties[0].members[1].equipment.mainHand = itemById('yew_bow+recurve1')!
      }],
    ])('picks nothing where craftGear makes nothing: %s', (_, setUp) => {
      expect(madeByCraftGear(setUp)).toBeNull()
      const game = field(setUp)
      expect(fieldCraft(game, game.parties[0])).toBeNull()
    })
  })

  it('counts the days of two camping parties once, and the healing of both', () => {
    const { run, game, party } = campaignOf((game) => (game.parties[0].position = { q: game.parties[0].position.q + 1, r: game.parties[0].position.r }))
    const second = { ...structuredClone(party), id: 'party_2', name: 'Second Company', position: { q: party.position.q + 1, r: party.position.r } }
    game.parties.push(second)
    for (const p of game.parties) {
      p.members[0].hp = 1
      for (const m of p.members) m.mana = 0
      expect(carryOut(run, p, { kind: 'order', order: { kind: 'camp' } })).toBe('standing')
    }
    const reports = advance(game, Infinity)
    // Both camped every day the reports cover, so counting each camper would double them.
    expect(reports.every((r) => r.parties.every((day) => day.rested > 0))).toBe(true)
    takeDays(run, reports)
    expect(run.record.campDays).toBe(reports.length)
    const healed = reports.flatMap((r) => r.parties).reduce((n, day) => n + day.rested + day.cast, 0)
    expect(healed).toBeGreaterThan(0)
    expect(run.record.healedHp).toBe(healed)
  })
})

describe('the company’s record', () => {
  const args = parseArgs(['--campaign', '--parties', '1'])
  const campaignOf = (setUp: (game: ReturnType<typeof newGame>) => void = () => {}) => {
    const game = newGame(undefined, null, 1)
    setUp(game)
    const run = startCampaign(0, 1, args, 0, game)
    return { run, game, party: game.parties[0] }
  }
  /** A party of one hero at 1 hit point, standing before the Source, whose battle it is sure to lose. */
  const doomed = (game: ReturnType<typeof newGame>) => {
    const party = game.parties[0]
    const source = game.world.locations.find((l) => l.id === SOURCE_ID) as MonsterLocation
    party.members.splice(1)
    party.members[0].hp = 1
    party.position = { ...source.position }
    party.confronting = source.id
    return source
  }
  const secondParty = (game: ReturnType<typeof newGame>) => {
    const first = game.parties[0]
    const second = { ...structuredClone(first), id: 'party_2', name: 'Second Company', baggage: [], order: { kind: 'idle' as const } }
    game.parties.push(second)
    return second
  }

  it('starts with the new fields at zero, the first party the vanguard', () => {
    const { run, party } = campaignOf()
    expect(run.record).toMatchObject({
      roles: { vanguard: { battles: 0, wipes: 0, finalLevels: [] }, guard: { battles: 0, wipes: 0, finalLevels: [] } },
      wipes: 0, promotions: 0, vanguardWalkHomeDays: 0, guardBattles: 0,
    })
    expect(roleOf(run, party)).toBe('vanguard')
    expect(roleOf(run, { ...party, id: 'party_9' })).toBe('guard')
    setVanguard(run, 'party_9')
    expect(roleOf(run, { ...party, id: 'party_9' })).toBe('vanguard')
    expect(roleOf(run, party)).toBe('guard')
  })

  it('logs the party and its role on battle_start, under schema version 24, and counts the battle to the role', () => {
    const { run, game, party } = campaignOf()
    const target = nextTarget(game.world, party, args.readyLevel)!
    party.position = { ...target.position }
    party.confronting = target.id
    carryOut(run, party, { kind: 'fight', target })
    const start = run.battles[0][0]
    expect(start).toMatchObject({ type: 'battle_start', schemaVersion: 24, meta: { party: 'party_1', role: 'vanguard' } })
    // The new keys come after the old, so the old keys keep their order in the log.
    if (start.type !== 'battle_start') throw new Error('no battle_start')
    expect(Object.keys(start.meta).slice(-2)).toEqual(['party', 'role'])
    expect(run.record.roles.vanguard.battles).toBe(1)
    expect(run.record.guardBattles).toBe(0)
  })

  it('counts a guard’s battle to the guards and to guardBattles', () => {
    const { run, game } = campaignOf()
    const guard = secondParty(game)
    const target = nextTarget(game.world, guard, args.readyLevel)!
    guard.position = { ...target.position }
    guard.confronting = target.id
    carryOut(run, guard, { kind: 'fight', target })
    expect(run.battles[0][0]).toMatchObject({ meta: { party: 'party_2', role: 'guard' } })
    expect(run.record.roles.guard.battles).toBe(1)
    expect(run.record.guardBattles).toBe(1)
    expect(run.record.roles.vanguard.battles).toBe(0)
  })

  it('wipes a party that loses, and goes on while a hero is left in the reserves', () => {
    let source!: MonsterLocation
    const { run, game, party } = campaignOf((game) => {
      source = doomed(game)
      game.reserves.push(readyMadeParty()[1])
    })
    const gear = Object.values(party.members[0].equipment)
    expect(carryOut(run, party, { kind: 'fight', target: source })).not.toBe('fallen')
    expect(run.battles[0].at(-1)).toMatchObject({ type: 'battle_end', winner: 'enemy' })
    expect(run.record.wipes).toBe(1)
    expect(run.record.roles.vanguard.wipes).toBe(1)
    // The wiped party is gone; the reserves stand at the encampment as a new party, the vanguard now.
    expect(game.parties).toHaveLength(1)
    expect(game.parties[0]).not.toBe(party)
    const home = game.world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    expect(game.parties[0].position).toEqual(home)
    expect(run.vanguard).toBe(game.parties[0].id)
    expect(roleOf(run, game.parties[0])).toBe('vanguard')
    expect(source.loot).toEqual(expect.arrayContaining(gear))
  })

  it('ends the campaign fallen when the wipe leaves no hero, its levels the fallen party’s', () => {
    let source!: MonsterLocation
    const { run, game, party } = campaignOf((game) => (source = doomed(game)))
    const levels = party.members.map((m) => m.level)
    expect(carryOut(run, party, { kind: 'fight', target: source })).toBe('fallen')
    expect(game.parties).toHaveLength(0)
    const { record } = finishCampaign(run, 'fallen')
    expect(record).toMatchObject({ outcome: 'fallen', wipes: 1, finalLevels: levels })
    expect(record.roles.vanguard.finalLevels).toEqual([])
  })

  it('reads the vanguard’s levels, not the first party’s, and counts sockets over every party', () => {
    const { run, game } = campaignOf()
    const guard = secondParty(game)
    for (const member of guard.members) member.level = 9
    guard.members[0].equipment.armor = itemById('steel_breastplate#stone1')!
    setVanguard(run, guard.id)
    const first = game.parties[0]
    first.members[0].equipment.mainHand = itemById('steel_longsword#ember1')!
    const { record } = finishCampaign(run, 'timeout')
    expect(record.finalLevels).toEqual(guard.members.map(() => 9))
    expect(record.socketsFilled).toBe(2)
    expect(record.roles.vanguard.finalLevels).toEqual([guard.members.map(() => 9)])
    expect(record.roles.guard.finalLevels).toEqual([first.members.map((m) => m.level)])
  })

  it('counts the vanguard’s days walking home', () => {
    const { run, game, party } = campaignOf((game) => {
      game.world.stock = { gold: 100, iron: 50 }
      game.parties[0].position = { q: game.parties[0].position.q + 3, r: game.parties[0].position.r }
    })
    expect(carryOut(run, party, decide(run, party))).toBe('standing')
    expect(planOf(run, party).phase).toBe('home')
    const reports = advance(game, Infinity)
    takeDays(run, reports)
    const walked = reports.filter((r) => r.parties.find((d) => d.party === party.id)?.walked).length
    expect(walked).toBeGreaterThan(0)
    expect(run.record.vanguardWalkHomeDays).toBe(walked)
  })

  it('has as many vanguard battles as battles in a one-party campaign, and no guard battles', () => {
    const { record } = runCampaign(1, 1 + CAMPAIGN_SEED_STEP, args)
    expect(record.roles.vanguard.battles).toBe(record.battles)
    expect(record.guardBattles).toBe(0)
    expect(record.roles.guard).toEqual({ battles: 0, wipes: 0, finalLevels: [] })
    expect(record.promotions).toBe(0)
  }, 20_000)

  it('is summed up with the wipes, promotions, walks home, guard battles and each role’s battles, wipes and levels', () => {
    const { run } = campaignOf()
    const a = { ...run.record, wipes: 1, vanguardWalkHomeDays: 10, guardBattles: 2, roles: { vanguard: { battles: 4, wipes: 1, finalLevels: [[3, 5]] }, guard: { battles: 2, wipes: 0, finalLevels: [[2], [4]] } } }
    const b = { ...run.record, wipes: 0, vanguardWalkHomeDays: 20, guardBattles: 0, roles: { vanguard: { battles: 6, wipes: 0, finalLevels: [[7]] }, guard: { battles: 0, wipes: 0, finalLevels: [] } } }
    const summary = summarizeCampaigns([], [a, b])
    expect(summary).toMatchObject({ avgWipes: 0.5, avgPromotions: 0, avgVanguardWalkHomeDays: 15, avgGuardBattles: 1 })
    expect(summary.roles.vanguard).toEqual({ avgBattles: 5, avgWipes: 0.5, campaigns: 2, avgLowestFinalLevel: 5, avgHighestFinalLevel: 6 })
    // A campaign with no party of the role is left out of its levels.
    expect(summary.roles.guard).toEqual({ avgBattles: 1, avgWipes: 0, campaigns: 1, avgLowestFinalLevel: 2, avgHighestFinalLevel: 4 })
    expect(summarizeCampaigns([], [{ ...a, hallLevel: 4 }, { ...b, hallLevel: 5 }, { ...b, hallLevel: 3 }])).toMatchObject({ hallFour: 2, hallFive: 1 })
  })
})

describe('the company policy', () => {
  const args = parseArgs(['--campaign'])
  type Game = ReturnType<typeof newGame>
  const home = (game: Game) => game.world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
  const nests = (game: Game) => game.world.locations.filter((l): l is MonsterLocation => l.kind === 'monsters' && !l.source)
  const away = (game: Game, party: Expedition, dq: number) => (party.position = { q: home(game).q + dq, r: home(game).r })
  /** A guard formed at the hall from fresh heroes of the given levels. */
  const guardOf = (game: Game, levels: number[]) => {
    for (const [i, hero] of [...readyMadeParty(), ...readyMadeParty()].slice(0, levels.length).entries()) {
      hero.name = `G${game.parties.length}${i}`
      hero.level = levels[i]
      game.reserves.push(hero)
    }
    const guard = formParty(game, `Guard ${game.parties.length}`, { from: 'reserves', index: 0 }) as Expedition
    while (game.reserves.length > 0) expect(moveHero(game, { from: 'reserves', index: 0 }, { party: guard.id })).toBeNull()
    return guard
  }
  /** A company at a level 5 hall: the vanguard, full, and guards of the given levels, every party at home. */
  const companyOf = (guards: number[][], setUp: (game: Game) => void = () => {}) => {
    const game = newGame(undefined, null, 1)
    game.world.guildHall = 5
    for (const [i, hero] of readyMadeParty().slice(0, 2).entries()) game.parties[0].members.push(Object.assign(hero, { name: `V${i}` }))
    for (const levels of guards) guardOf(game, levels)
    setUp(game)
    const run = startCampaign(0, 1, args, 0, game)
    return { run, game, vanguard: game.parties[0], guards: game.parties.slice(1) }
  }
  const threaten = (game: Game, siteId: string) => {
    game.world.held.push(siteId)
    game.world.threatened = [siteId]
    return game.world.locations.find((l) => l.id === siteId)!
  }

  it('runs a guard by its own policy, and plays three parties by default', () => {
    expect(args.parties).toBe(3)
    const { run, vanguard, guards } = companyOf([[3, 3, 3]])
    expect(roleOf(run, vanguard)).toBe('vanguard')
    expect(roleOf(run, guards[0])).toBe('guard')
  })

  describe('choosing', () => {
    it('reinforces a vanguard short of its limit by meeting it, with a hero within 3 levels of its lowest', () => {
      const { run, game, vanguard, guards: [guard] } = companyOf([[1, 5]])
      for (const m of vanguard.members) m.level = 8
      vanguard.members.splice(2)
      away(game, vanguard, 4)
      expect(guardChoice(run, guard)).toEqual({ kind: 'reinforce' })
      expect(decideGuard(run, guard)).toEqual({ kind: 'order', order: { kind: 'meet', party: vanguard.id } })
      expect(carryOut(run, guard, decideGuard(run, guard))).toBe('standing')
      expect(guard.order).toEqual({ kind: 'meet', party: vanguard.id })
    })

    it('does not reinforce a full vanguard, with heroes all more than 3 levels below, or as a guard of one', () => {
      const full = companyOf([[5, 5, 5]])
      for (const m of full.vanguard.members) m.level = 8
      full.game.world.guildHall = 1 // a party limit of 3: the vanguard is full
      expect(guardChoice(full.run, full.guards[0]).kind).not.toBe('reinforce')
      const low = companyOf([[4, 4, 4]])
      for (const m of low.vanguard.members) m.level = 8
      expect(guardChoice(low.run, low.guards[0]).kind).not.toBe('reinforce')
      const lone = companyOf([[8]])
      for (const m of lone.vanguard.members) m.level = 8
      expect(guardChoice(lone.run, lone.guards[0]).kind).not.toBe('reinforce')
    })

    it('defends a threatened held site from the nest pushing on it, if it is up to its threat', () => {
      const { run, game, guards: [guard] } = companyOf([[1, 1, 1]])
      const site = threaten(game, 'gold_seam')
      const besiegers: MonsterLocation = {
        id: 'besiegers', kind: 'monsters', name: 'Besiegers', position: { q: site.position.q + 1, r: site.position.r },
        encounter: 'goblin_raid', threat: 1, loot: [],
      }
      game.world.locations.push(besiegers)
      expect(guardChoice(run, guard)).toEqual({ kind: 'defend', target: besiegers })
      expect(decideGuard(run, guard)).toEqual({ kind: 'order', order: { kind: 'travel', to: besiegers.position } })
      // Above its level, the pushing nest is not its to fight.
      besiegers.threat = 2
      expect(guardChoice(run, guard).kind).toBe('train')
    })

    it('defends the site nearest to falling first, from the nest pushing hardest on it, whatever the ids', () => {
      const { run, game, guards: [guard] } = companyOf([[2, 2, 2]])
      const { world } = game
      const quarry = world.locations.find((l) => l.id === 'old_quarry')!
      const cave = world.locations.find((l) => l.id === 'crystal_cave')!
      world.held.push(quarry.id, cave.id)
      world.threatened = [cave.id, quarry.id]
      // The quarry, the later id, falls at once; the cave takes days.
      world.blight[boardIndex(world.board, quarry.position)] = LOSS_LEVEL
      world.blight[boardIndex(world.board, cave.position)] = 0
      const nest = (id: string, at: { q: number; r: number }, dq: number): MonsterLocation => ({
        id, kind: 'monsters', name: id, position: { q: at.q + dq, r: at.r }, encounter: 'goblin_raid', threat: 2, loot: [],
      })
      const hardest = nest('quarry_besiegers', quarry.position, 1)
      const weaker = nest('a_quarry_skulkers', quarry.position, 2)
      const caveRaiders = nest('a_cave_raiders', cave.position, 1)
      world.locations = [...world.locations, hardest, weaker, caveRaiders]
      const presence = [{ position: guard.position, levels: guard.members.map((m) => m.level) }]
      expect(daysToFall(world, presence, quarry)).toBe(0)
      expect(daysToFall(world, presence, cave)).toBeGreaterThan(0)
      expect(monsterStrength(weaker) - 2).toBeGreaterThan(0)
      expect(guardChoice(run, guard)).toEqual({ kind: 'defend', target: hardest })
    })

    it('goes home to refill a guard worn below its smallest size when a recruit is affordable', () => {
      const { run, game, vanguard, guards: [guard] } = companyOf([[5]])
      // A vanguard as strong: no swap to be had.
      for (const m of vanguard.members) m.level = 5
      away(game, guard, 3)
      game.world.stock = { gold: 9 }
      expect(guardChoice(run, guard).kind).toBe('train')
      game.world.stock = { gold: 10 }
      expect(guardChoice(run, guard)).toEqual({ kind: 'home' })
      guard.position = { ...home(game) }
      expect(decideGuard(run, guard)).toEqual({ kind: 'hall' })
      carryOut(run, guard, { kind: 'hall' })
      expect(guard.members).toHaveLength(2)
    })

    it('trains on the nearest nest it is up to when nothing is threatened, never the Source', () => {
      const { run, game, guards: [guard] } = companyOf([[1, 1, 1]])
      const upTo = nests(game).filter((l) => l.threat <= 1)
      const distance = (l: MonsterLocation) => Math.max(...[l.position.q - guard.position.q, l.position.r - guard.position.r].map(Math.abs))
      const choice = guardChoice(run, guard)
      expect(choice.kind).toBe('train')
      if (choice.kind !== 'train') return
      expect(upTo).toContain(choice.target)
      expect(choice.target.source).toBeFalsy()
      expect(nextTarget(game.world, guard)).toBe(choice.target)
      expect(distance(choice.target)).toBeGreaterThan(0)
      for (const m of [...guard.members, ...game.parties[0].members]) m.level = 30
      game.world.locations = game.world.locations.filter((l) => l.kind !== 'monsters' || l.source)
      expect(guardChoice(run, guard)).toEqual({ kind: 'home' })
    })

    it('garrisons a threatened held site when no nest is one it is up to: the walk, then the order', () => {
      const { run, game, guards: [guard] } = companyOf([[1, 1, 1]])
      game.world.locations = game.world.locations.filter((l) => l.kind !== 'monsters' || l.source)
      const site = threaten(game, 'gold_seam')
      expect(guardChoice(run, guard)).toEqual({ kind: 'garrison', site })
      expect(decideGuard(run, guard)).toEqual({ kind: 'order', order: { kind: 'travel', to: site.position } })
      guard.position = { ...site.position }
      expect(decideGuard(run, guard)).toEqual({ kind: 'order', order: { kind: 'garrison' } })
      expect(carryOut(run, guard, { kind: 'order', order: { kind: 'garrison' } })).toBe('standing')
      expect(guard.order.kind).toBe('garrison')
      // Asked again while the site is still threatened, it stays.
      expect(decideGuard(run, guard)).toEqual({ kind: 'stand' })
      expect(carryOut(run, guard, { kind: 'stand' })).toBe('standing')
      expect(guard.order.kind).toBe('garrison')
      // A second guard garrisons nothing another holds: it goes home.
      const other = guardOf(game, [1, 1, 1])
      expect(guardChoice(run, other)).toEqual({ kind: 'home' })
    })

    it('goes home with nothing to do, runs the hall there, and then stands idle', () => {
      const { run, game, guards: [guard] } = companyOf([[1, 1, 1]])
      game.world.locations = game.world.locations.filter((l) => l.kind !== 'monsters' || l.source)
      away(game, guard, 3)
      expect(decideGuard(run, guard)).toEqual({ kind: 'order', order: { kind: 'home' } })
      expect(carryOut(run, guard, { kind: 'order', order: { kind: 'home' } })).toBe('standing')
      expect(guard.order.kind).toBe('home')
      guard.position = { ...home(game) }
      guard.order = { kind: 'idle' }
      expect(decideGuard(run, guard)).toEqual({ kind: 'hall' })
      expect(carryOut(run, guard, { kind: 'hall' })).toBeNull()
      expect(decideGuard(run, guard)).toEqual({ kind: 'stand' })
      expect(carryOut(run, guard, { kind: 'stand' })).toBe('standing')
      expect(guard.order.kind).toBe('idle')
    })
  })

  it('promotes the guard’s highest-level hero on meeting the vanguard, and sends the guard home', () => {
    const { run, game, vanguard, guards: [guard] } = companyOf([[5, 7, 6]])
    for (const m of vanguard.members) m.level = 8
    vanguard.members.splice(2)
    away(game, vanguard, 4)
    const best = guard.members[1]
    expect(carryOut(run, guard, decideGuard(run, guard))).toBe('standing')
    let reports: DayReport[] = []
    for (let i = 0; i < 10 && !reports.some((r) => r.partyEvents.some((e) => e.type === 'met')); i++) {
      reports = advance(game, Infinity)
      takeDays(run, reports)
    }
    expect(reports.at(-1)!.partyEvents).toContainEqual({ type: 'met', party: guard.id, other: vanguard.id })
    expect(needsDecision(run, guard, reports.at(-1))).toBe(true)
    expect(decideGuard(run, guard)).toEqual({ kind: 'promote' })
    expect(carryOut(run, guard, { kind: 'promote' })).toBeNull()
    expect(vanguard.members.at(-1)).toBe(best)
    expect(guard.members).not.toContain(best)
    expect(run.record.promotions).toBe(1)
    expect(decideGuard(run, guard)).toEqual({ kind: 'order', order: { kind: 'home' } })
  })

  describe('the swap promotion (decision 16 as amended)', () => {
    /** A full vanguard (5 at a level 5 hall), its weakest at level 5 in the middle, and a guard whose best is `best`. */
    const fullOf = (best: number) => {
      const c = companyOf([[3, best, 4]])
      c.vanguard.members.forEach((m, i) => (m.level = i === 2 ? 5 : 8))
      away(c.game, c.vanguard, 4)
      return c
    }

    it('reinforces a full vanguard when the guard’s best outranks its lowest by 2 levels or more', () => {
      const { run, vanguard, guards: [guard] } = fullOf(7)
      expect(vanguard.members).toHaveLength(5)
      expect(guardChoice(run, guard)).toEqual({ kind: 'reinforce' })
      expect(decideGuard(run, guard)).toEqual({ kind: 'order', order: { kind: 'meet', party: vanguard.id } })
    })

    it('does not reinforce a full vanguard when the guard’s best is only 1 level above its lowest', () => {
      const { run, guards: [guard] } = fullOf(6)
      expect(guardChoice(run, guard).kind).not.toBe('reinforce')
    })

    it('swaps the guard’s best for the vanguard’s weakest on meeting, counts a promotion and sends the guard home', () => {
      const { run, game, vanguard, guards: [guard] } = fullOf(7)
      const best = guard.members[1]
      const weakest = vanguard.members[2]
      expect(carryOut(run, guard, decideGuard(run, guard))).toBe('standing')
      let reports: DayReport[] = []
      for (let i = 0; i < 10 && !reports.some((r) => r.partyEvents.some((e) => e.type === 'met')); i++) {
        reports = advance(game, Infinity)
        takeDays(run, reports)
      }
      expect(reports.at(-1)!.partyEvents).toContainEqual({ type: 'met', party: guard.id, other: vanguard.id })
      expect(decideGuard(run, guard)).toEqual({ kind: 'promote' })
      expect(carryOut(run, guard, { kind: 'promote' })).toBeNull()
      expect(vanguard.members).toHaveLength(5)
      expect(vanguard.members[2]).toBe(best)
      expect(guard.members[1]).toBe(weakest)
      expect(run.record.promotions).toBe(1)
      expect(decideGuard(run, guard)).toEqual({ kind: 'order', order: { kind: 'home' } })
    })
  })

  it('takes its next priority when the exchange is refused', () => {
    const { run, game, vanguard, guards: [guard] } = companyOf([[5, 7, 6]])
    for (const m of vanguard.members) m.level = 8
    vanguard.members.splice(2)
    away(game, vanguard, 4)
    guard.position = { ...vanguard.position }
    vanguard.confronting = nests(game)[0].id
    expect(decideGuard(run, guard)).toEqual({ kind: 'promote' })
    expect(carryOut(run, guard, { kind: 'promote' })).toBeNull()
    expect(run.record.promotions).toBe(0)
    expect(guardChoice(run, guard).kind).not.toBe('reinforce')
  })

  describe('succession', () => {
    const doom = (game: Game, party: Expedition) => {
      const source = game.world.locations.find((l) => l.id === SOURCE_ID) as MonsterLocation
      party.members.splice(1)
      party.members[0].hp = 1
      party.position = { ...source.position }
      party.confronting = source.id
      return source
    }

    it('makes the strongest party left the vanguard when the vanguard is wiped', () => {
      const { run, game, vanguard, guards } = companyOf([[2, 6, 6], [3, 3, 4]])
      const source = doom(game, vanguard)
      expect(carryOut(run, vanguard, { kind: 'fight', target: source })).toBe('standing')
      expect(game.parties).not.toContain(vanguard)
      // The highest lowest level (3 against 2), whatever the mean.
      expect(run.vanguard).toBe(guards[1].id)
      expect(roleOf(run, guards[1])).toBe('vanguard')
      expect(roleOf(run, guards[0])).toBe('guard')
      expect(planOf(run, guards[1]).phase).toBe('start')
      // Then the mean, then the lower id.
      const party = (id: string, levels: number[]) => ({ id, members: levels.map((level) => ({ level })) }) as unknown as Expedition
      expect(strongestParty([party('party_2', [3, 3, 3]), party('party_3', [3, 3, 4])]).id).toBe('party_3')
      expect(strongestParty([party('party_3', [3, 4]), party('party_2', [4, 3])]).id).toBe('party_2')
    })

    it('stops the new vanguard’s guard walk, and has it fight the nest it then stands before', () => {
      const { run, game, vanguard, guards: [guard] } = companyOf([[3, 3, 3]])
      const source = doom(game, vanguard)
      guard.order = { kind: 'travel', to: { q: guard.position.q + 5, r: guard.position.r }, route: [] }
      expect(carryOut(run, vanguard, { kind: 'fight', target: source })).toBe('standing')
      expect(guard.order.kind).toBe('idle')
      const nest = nests(game)[0]
      guard.position = { ...nest.position }
      guard.confronting = nest.id
      expect(decide(run, guard)).toEqual({ kind: 'fight', target: nest })
    })

    it('ends fallen only when no hero is left anywhere', () => {
      const { run, game, vanguard, guards: [guard] } = companyOf([[3, 3, 3]])
      const source = doom(game, vanguard)
      expect(carryOut(run, vanguard, { kind: 'fight', target: source })).toBe('standing')
      doom(game, guard)
      expect(carryOut(run, guard, { kind: 'fight', target: source })).toBe('fallen')
    })

    it('counts the sockets the company fell with', () => {
      const { run, game, vanguard } = companyOf([])
      const source = doom(game, vanguard)
      vanguard.members[0].equipment.mainHand = itemById('steel_longsword#ember1')!
      expect(carryOut(run, vanguard, { kind: 'fight', target: source })).toBe('fallen')
      expect(finishCampaign(run, 'fallen').record.socketsFilled).toBe(1)
    })
  })

  it('keeps every party’s target its own, and no guard ever targets the Source', () => {
    // Level 2 guards: the home band has two nests of threat 1 and four of threat 2.
    const { run, game, vanguard, guards } = companyOf([[2, 2, 2], [2, 2, 2]])
    planOf(run, vanguard).phase = 'choose'
    decide(run, vanguard)
    for (const guard of guards) decideGuard(run, guard)
    const targets = game.parties.map((p) => planOf(run, p).target?.id)
    expect(new Set(targets).size).toBe(3)
    expect(targets).not.toContain(SOURCE_ID)
    expect(targets.every((id) => id !== undefined)).toBe(true)
    // The vanguard leaves a guard's target to it.
    const vanguardPlan = planOf(run, vanguard)
    vanguardPlan.phase = 'choose'
    const guardTarget = planOf(run, guards[0]).target!
    expect(takenTargets(run, vanguard)).toContain(guardTarget.id)
    decide(run, vanguard)
    expect(vanguardPlan.target).not.toBe(guardTarget)
    // Strong as they come, with only the Source left, a guard goes home.
    for (const m of [...guards[1].members, ...vanguard.members]) m.level = 30
    game.world.locations = game.world.locations.filter((l) => l.kind !== 'monsters' || l.source)
    expect(guardChoice(run, guards[1])).toEqual({ kind: 'home' })
  })

  describe('the hall cap', () => {
    const fullCompany = (parties: number) => {
      const game = newGame(undefined, null, 1)
      game.world.stock = { gold: 1000, iron: 500, stone: 100, silver: 100 }
      return { game, party: game.parties[0], parties }
    }
    it('stops at level 4 for two parties and never walks home for level 5', () => {
      const { game, party } = fullCompany(2)
      visitGuildHall(game, party, 2)
      expect(game.world.guildHall).toBe(4)
      guardOf(game, [1, 1, 1])
      expect(hallErrand(game, party, 2, true)).toBe(false)
      expect(hallErrand(game, party, 3, true)).toBe(true)
      expect(materialNeeds(game, 2).silver ?? 0).toBeLessThan(materialNeeds(game, 3).silver ?? 0)
    })
    it('stops at level 3 for one', () => {
      const { game, party } = fullCompany(1)
      visitGuildHall(game, party, 1)
      expect(game.world.guildHall).toBe(3)
      expect(hallErrand(game, party, 1)).toBe(false)
    })
    it('walks home to form a guard the hall allows and the stock can man, under more than one party', () => {
      const { game, party } = fullCompany(2)
      game.world.guildHall = 4
      game.world.stock = { gold: 10 * GUARD_MIN_SIZE }
      party.position = { q: party.position.q + 3, r: party.position.r }
      expect(party.members).toHaveLength(3)
      expect(hallErrand(game, party, 2, true)).toBe(true)
      expect(hallErrand(game, party, 1, true)).toBe(false)
      game.world.stock = { gold: 10 * (GUARD_MIN_SIZE - 1) }
      expect(hallErrand(game, party, 2, true)).toBe(false)
    })
    it('drops the recruit errand for the vanguard of a company with a guard', () => {
      const { game, party } = fullCompany(1)
      game.world.stock = { gold: 10 }
      party.members.splice(2)
      expect(hallErrand(game, party, 1, false)).toBe(true)
      expect(hallErrand(game, party, 1, true)).toBe(false)
    })
  })

  describe('forming a guard', () => {
    it('forms a Second Company of at least three at the hall’s level when the hall allows it and the stock pays', () => {
      const game = newGame(undefined, null, 1)
      game.world.guildHall = 4
      game.world.stock = { gold: 10 * GUARD_MIN_SIZE }
      const formed = formGuard(game, 3)!
      expect(formed.hired).toBe(GUARD_MIN_SIZE)
      expect(formed.party.name).toBe('Second Company')
      expect(formed.party.members).toHaveLength(GUARD_MIN_SIZE)
      expect(formed.party.members.every((m) => m.level === 4 && !canAdvance(m))).toBe(true)
      expect(game.parties).toContain(formed.party)
    })
    it('forms none short of three heroes, under --parties 1, or past the hall’s parties', () => {
      const game = newGame(undefined, null, 1)
      game.world.guildHall = 4
      game.world.stock = { gold: 20 }
      expect(formGuard(game, 3)).toBeNull()
      game.world.stock = { gold: 100 }
      expect(formGuard(game, 1)).toBeNull()
      game.world.guildHall = 3
      expect(formGuard(game, 3)).toBeNull()
      expect(game.parties).toHaveLength(1)
    })
    it('fills the vanguard first, then forms the guard on a hall visit, its role a guard’s', () => {
      const game = newGame(undefined, null, 1)
      game.world.guildHall = 4
      game.world.stock = { gold: 50 }
      const run = startCampaign(0, 1, args, 0, game)
      expect(carryOut(run, game.parties[0], { kind: 'hall' })).toBeNull()
      expect(game.parties[0].members).toHaveLength(5)
      expect(game.parties).toHaveLength(2)
      expect(game.parties[1].members).toHaveLength(3)
      expect(roleOf(run, game.parties[1])).toBe('guard')
      expect(run.record.recruits).toBe(5)
    })
  })

  describe('the loop', () => {
    it('asks a garrisoned guard again after every advance, a walking one only when concerned', () => {
      const { run, game, vanguard, guards: [guard] } = companyOf([[1, 1, 1]])
      const elsewhere: DayReport = { events: [], partyEvents: [], parties: [], interrupt: { party: vanguard.id, event: { type: 'order_done', party: vanguard.id } } }
      guard.order = { kind: 'garrison' }
      expect(needsDecision(run, guard, elsewhere)).toBe(true)
      guard.order = { kind: 'travel', to: home(game), route: [] }
      expect(needsDecision(run, guard, elsewhere)).toBe(false)
    })

    it('passes at most IDLE_DAYS while every party is garrisoned or idle, and then asks each guard again', () => {
      const { run, game, vanguard, guards: [guard] } = companyOf([[1, 1, 1]])
      expect(advanceLimit(game)).toBe(IDLE_DAYS)
      vanguard.order = { kind: 'travel', to: home(game), route: [] }
      expect(advanceLimit(game)).toBe(Infinity)
      vanguard.order = { kind: 'idle' }
      guard.order = { kind: 'garrison' }
      const reports = advance(game, advanceLimit(game))
      expect(reports.length).toBeGreaterThan(0)
      expect(reports.length).toBeLessThanOrEqual(IDLE_DAYS)
      expect(needsDecision(run, guard, reports.at(-1))).toBe(true)
    })

    it('plays rounds of a company with idle guards without spinning', () => {
      const { run, game } = companyOf([[1, 1, 1], [1, 1, 1]])
      let last: DayReport | undefined
      const start = game.world.turn
      for (let i = 0; i < 30; i++) {
        const round = playRound(run, last)
        if (!Array.isArray(round)) break
        expect(round.length).toBeGreaterThan(0)
        last = round.at(-1)
      }
      expect(game.world.turn).toBeGreaterThan(start)
      expect(run.record.guardBattles).toBeGreaterThan(0)
    }, 30_000)
  })
})

describe('the refactor guard', () => {
  it('plays 5 seeded campaigns exactly as it did before stage 5, with one party', () => {
    const args = parseArgs(['--campaign', '--battles', '5', '--seed', '1', '--parties', '1'])
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
