import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { SpellId } from '../src/combat/spells.ts'
import { BattleEngine, type CastOutcome, type Side } from '../src/engine/battleEngine.ts'
import { GOBLIN_STATS } from '../src/combat/combat.ts'
import { hex, hexDistance, offsetToHex } from '../src/grid/hex.ts'
import { autoAdvance, planFor } from '../src/character/progression.ts'
import type { PerkId } from '../src/character/perks.ts'
import { capstoneOf } from '../src/character/trees.ts'
import { banditStats } from '../src/game/bandits.ts'
import { newGame } from '../src/game/gameState.ts'
import { heroId } from '../src/game/encounters.ts'
import { readyMadeParty } from '../src/game/party.ts'
import { IMPROVEMENT_COSTS, LODGE_COSTS, TOWER_COST, towerHexRefusal } from '../src/game/buildings.ts'
import { GUARD_RADIUS, ROUTE_TIMBER, isContacted, roadTo, routeLimit, type TradeRoute } from '../src/game/trade.ts'
import { HexBoard } from '../src/grid/hex.ts'
import { advance, formParty, moveHero, type DayReport } from '../src/game/company.ts'
import { MAX_PARTIES, presenceOf, type Expedition } from '../src/game/expedition.ts'
import { craft } from '../src/game/crafting.ts'
import type { FamilyId } from '../src/inventory/catalog.ts'
import { itemById, unruned } from '../src/inventory/inventory.ts'
import { modifiersFor } from '../src/inventory/modifiers.ts'
import { maxHp, type Character } from '../src/character/character.ts'
import { worldHealing } from '../src/character/worldCasting.ts'
import { lootRng, rollRunes } from '../src/game/loot.ts'
import { MATERIALS_PER_GOLD, MAX_TRADING_POST_LEVEL, runePrice, salePrice } from '../src/game/tradingPost.ts'
import { pouchKeys } from '../src/inventory/runes.ts'
import { boardIndex, monsterStrength, seedBlight, type WorldEvent } from '../src/game/blight.ts'
import { LOSS_LEVEL, daysToFall, type Stock } from '../src/game/territory.ts'
import { extractRefusal } from '../src/game/runecraft.ts'
import type { EncounterId } from '../src/game/encounters.ts'
import { EARLY_SHIFT, ENCAMPMENT_ID, SOURCE_ID, SOURCE_PLACE, newWorld, routeTo, type MonsterLocation } from '../src/game/worldMap.ts'
import { ABANDON_AFTER } from '../src/game/trade.ts'
import { YIELD_DAYS } from '../src/game/territory.ts'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CAMPAIGN_SEED_STEP,
  MAX_CAMPAIGN_DAYS,
  NEAR_SOURCE,
  campaignGame,
  tally,
  walkingLine,
  FORT_FIRST_DAYS,
  IMPROVE_ERRAND_RADIUS,
  SOURCE_READY_LEVEL,
  HALL_FOR_PARTIES,
  hallErrand,
  nextTarget,
  improveErrand,
  parseArgs,
  playerPlan,
  raisedParty,
  runBattle,
  runCampaign,
  summarize,
  summarizeCampaigns,
  tradeLine,
  waitingLine,
  waitingIncome,
  yieldValue,
  vanguardTallies,
  craftGear,
  materialNeeds,
  visitFacilities,
  PREFERRED_MODIFIERS,
  RUNE_ORDER,
  runecraftGear,
  expectedKit,
  kitLines,
  kitNote,
  kitRole,
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
  lodgeCap,
  strongestParty,
  takenTargets,
  CONTACT_DETOUR,
  TOWER_ERRAND_RADIUS,
  contactErrand,
  routeChoices,
  routeRaiders,
  towerErrand,
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

/** Whether `autoAdvance` has spent all `hero` would spend: no skill point left, and its perk points saved for a node it cannot take yet. */
const spentByPlan = (hero: Character): boolean => {
  const copy = { ...hero, perks: { ...hero.perks }, trained: { ...hero.trained } }
  autoAdvance(copy)
  return hero.skillPoints === 0 && JSON.stringify(copy.perks) === JSON.stringify(hero.perks)
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

  it('takes --waiting with --campaign only, off by default', () => {
    expect(parseArgs(['--campaign']).waiting).toBe(false)
    expect(parseArgs(['--campaign', '--waiting']).waiting).toBe(true)
    expect(() => parseArgs(['--waiting'])).toThrow('--waiting applies only to --campaign')
  })

  it('takes --trading-post for a campaign only, 1 to MAX_TRADING_POST_LEVEL, none by default', () => {
    expect(parseArgs(['--campaign', '--trading-post', '4']).tradingPost).toBe(4)
    expect(parseArgs(['--campaign', '--trading-post', String(MAX_TRADING_POST_LEVEL)]).tradingPost).toBe(MAX_TRADING_POST_LEVEL)
    expect(parseArgs(['--campaign']).tradingPost).toBeNull()
    for (const raw of ['0', String(MAX_TRADING_POST_LEVEL + 1), 'x']) {
      expect(() => parseArgs(['--campaign', '--trading-post', raw])).toThrow(`--trading-post must be from 1 to ${MAX_TRADING_POST_LEVEL}`)
    }
    expect(() => parseArgs(['--trading-post', '4'])).toThrow('--trading-post applies only to --campaign')
  })

  it('runs the long campaign by default: ready level 18, 6000 days, a JSONL log, the Source in its own place', () => {
    expect(SOURCE_READY_LEVEL).toBe(18)
    expect(MAX_CAMPAIGN_DAYS).toBe(6000)
    expect(parseArgs(['--campaign'])).toMatchObject({ readyLevel: 18, log: 'jsonl', nearSource: false })
    expect(parseArgs([])).toMatchObject({ log: 'jsonl', nearSource: false })
  })

  it('takes --log jsonl or none, for battles and campaigns, and refuses anything else', () => {
    expect(parseArgs(['--log', 'none']).log).toBe('none')
    expect(parseArgs(['--campaign', '--log', 'none']).log).toBe('none')
    expect(parseArgs(['--log', 'jsonl']).log).toBe('jsonl')
    for (const raw of ['csv', 'NONE', '']) expect(() => parseArgs(['--log', raw])).toThrow('--log must be jsonl or none')
    expect(() => parseArgs(['--log'])).toThrow('Missing value for --log')
  })

  it('takes --near-source for a campaign only', () => {
    expect(parseArgs(['--campaign', '--near-source']).nearSource).toBe(true)
    expect(() => parseArgs(['--near-source'])).toThrow('--near-source applies only to --campaign')
  })
})

describe('--near-source', () => {
  it('stands the campaign\'s Source at NEAR_SOURCE, stage 8\'s place moved with home, at threat 5', () => {
    expect(NEAR_SOURCE).toEqual({ position: offsetToHex(58, 36), threat: 5 })
    const game = campaignGame(1, parseArgs(['--campaign', '--near-source']))
    const source = game.world.locations.find((l) => l.id === SOURCE_ID) as MonsterLocation
    expect(source.position).toEqual(NEAR_SOURCE.position)
    expect(source.threat).toBe(5)
  })

  it('differs from the default world only in the Source\'s place and threat, the fixed nests above it, and the land they push', () => {
    const near = campaignGame(1, parseArgs(['--campaign', '--near-source'])).world
    const far = campaignGame(1, parseArgs(['--campaign'])).world
    expect(far).toEqual(newWorld(1))
    const source = (world: typeof near) => world.locations.find((l) => l.id === SOURCE_ID) as MonsterLocation
    expect(source(far)).toMatchObject({ position: SOURCE_PLACE.position, threat: SOURCE_PLACE.threat })
    expect(source(near)).not.toEqual(source(far))
    // The Source's push and the outer nests' seed the blight, so the land (and what is seen of it) differs; nothing else does.
    const above = (l: (typeof near.locations)[number]) => l.kind === 'monsters' && !l.source && l.threat > NEAR_SOURCE.threat
    const rest = (world: typeof near) => {
      const { locations, blight: _blight, shift: _shift, seen: _seen, ...others } = world
      return { ...others, locations: locations.filter((l) => l.id !== SOURCE_ID && !above(l)) }
    }
    expect(rest(near)).toEqual(rest(far))
    expect({ ...source(near), position: SOURCE_PLACE.position, threat: SOURCE_PLACE.threat }).toEqual(source(far))
    expect(near.blight).not.toEqual(far.blight)
  })

  it('leaves out the fixed nests above the near Source\'s threat (5), keeping the far sites and partners; the default world holds them', () => {
    const near = campaignGame(1, parseArgs(['--campaign', '--near-source'])).world
    const far = campaignGame(1, parseArgs(['--campaign'])).world
    const nestsAbove = (world: typeof near) => world.locations.filter((l) => l.kind === 'monsters' && !l.source && l.threat > NEAR_SOURCE.threat)
    expect(nestsAbove(near)).toEqual([])
    expect(nestsAbove(far).length).toBeGreaterThanOrEqual(20)
    const quiet = (world: typeof near) => world.locations.filter((l) => l.kind !== 'monsters').map((l) => l.id)
    expect(quiet(near)).toEqual(quiet(far))
    expect(quiet(near)).toEqual(expect.arrayContaining(['mithril_lode', 'heartwood', 'stonehollow', 'emberwatch']))
    // The land is seeded from the locations the world holds: seeding it again changes nothing.
    const again = structuredClone(near)
    seedBlight(again)
    expect(again.blight).toEqual(near.blight)
    expect(again.shift).toEqual(near.shift)
  })

  it('gives the waiting twin the same world', () => {
    const near = parseArgs(['--campaign', '--near-source'])
    expect(waitingIncome(1, near, 40)).toBe(waitingIncome(1, parseArgs(['--campaign']), 40))
  })
})

describe('the record\'s route counts and walking days', () => {
  const raided = (route: string, days: number): WorldEvent => ({ type: 'route_raided', route, partner: 'millbrook', name: 'Millbrook', cause: 'raiders', days })
  const restored = (route: string): WorldEvent => ({ type: 'route_restored', route, partner: 'millbrook', name: 'Millbrook' })
  const abandoned = (route: string): WorldEvent => ({ type: 'route_abandoned', route, partner: 'millbrook', name: 'Millbrook' })
  const opened = (route: string): WorldEvent => ({ type: 'route_opened', route, partner: 'millbrook', name: 'Millbrook', length: 3 })
  const fresh = () => startCampaign(0, 1, parseArgs(['--campaign', '--parties', '1']))

  it('counts each road turned raided (days 0) as a raid told, and not the raided yield days', () => {
    const run = fresh()
    tally(run, [raided('a', 0), raided('a', 1), raided('a', 2), raided('b', 0)], 10)
    expect(run.record.routeRaidsTold).toBe(2)
  })

  it('counts a raid within ABANDON_AFTER * YIELD_DAYS days of the same route\'s restoring as one flicker', () => {
    const window = ABANDON_AFTER * YIELD_DAYS
    expect(window).toBe(30)
    const within = fresh()
    tally(within, [raided('a', 0)], 5)
    tally(within, [restored('a')], 10)
    tally(within, [raided('a', 0)], 10 + window)
    // Answered once: a later raid is not another flicker of the same restoring.
    tally(within, [raided('a', 0)], 12 + window)
    expect(within.record).toMatchObject({ routeFlickers: 1, routeRaidsTold: 3 })
    const after = fresh()
    tally(after, [restored('a')], 10)
    tally(after, [raided('a', 0)], 11 + window)
    expect(after.record.routeFlickers).toBe(0)
    const other = fresh()
    tally(other, [restored('a')], 10)
    tally(other, [raided('b', 0)], 12)
    expect(other.record.routeFlickers).toBe(0)
  })

  it('counts a route raided on ABANDON_AFTER yield days in all and not abandoned as long-raided', () => {
    const run = fresh()
    // Two runs of raids, the count started afresh between them by a restoring: six in all.
    for (const days of [1, 2, 3]) tally(run, [raided('a', days)], 10 + days)
    tally(run, [restored('a')], 20)
    for (const days of [1, 2]) tally(run, [raided('a', days)], 30 + days)
    expect(run.record.routesRaidedLong).toBe(0)
    tally(run, [raided('a', 3)], 40)
    expect(run.record.routesRaidedLong).toBe(1)
    tally(run, [raided('b', 1)], 41)
    expect(run.record.routesRaidedLong).toBe(1)
    const gone = fresh()
    for (let days = 1; days <= ABANDON_AFTER; days++) tally(gone, [raided('a', days)], days)
    tally(gone, [abandoned('a')], ABANDON_AFTER)
    expect(gone.record.routesRaidedLong).toBe(0)
  })

  it('starts a route\'s count afresh when it is opened again after being abandoned', () => {
    const run = fresh()
    tally(run, [opened('a')], 1)
    for (let days = 1; days <= ABANDON_AFTER; days++) tally(run, [raided('a', days)], 1 + days * YIELD_DAYS)
    tally(run, [abandoned('a')], 1 + ABANDON_AFTER * YIELD_DAYS)
    expect(run.record.routesRaidedLong).toBe(0)
    // Reopened under the same id: three raided yield days, told safe, raided again, three more.
    tally(run, [opened('a')], 50)
    for (const days of [1, 2, 3]) tally(run, [raided('a', days)], 50 + days * YIELD_DAYS)
    tally(run, [restored('a')], 70)
    tally(run, [raided('a', 0)], 72)
    for (const days of [1, 2]) tally(run, [raided('a', days)], 72 + days * YIELD_DAYS)
    expect(run.record.routesRaidedLong).toBe(0)
    tally(run, [raided('a', 3)], 72 + 3 * YIELD_DAYS)
    expect(run.record).toMatchObject({ routesRaidedLong: 1, routeFlickers: 1 })
  })

  it('counts the vanguard\'s walked days in every phase, those walking home also apart', () => {
    const run = fresh()
    const party = run.game.parties[0]
    const plan = planOf(run, party)
    const day = (walked: boolean): DayReport => ({
      events: [],
      partyEvents: [],
      parties: [{ party: party.id, walked: walked ? party.position : null, rested: 0, cast: 0, made: null }],
      interrupt: null,
    })
    plan.running = 'travel'
    plan.phase = 'home'
    takeDays(run, [day(true), day(true), day(false)])
    plan.running = 'travel'
    plan.phase = 'start'
    takeDays(run, [day(true)])
    expect(run.record).toMatchObject({ vanguardWalkDays: 3, vanguardWalkHomeDays: 2 })
    expect(walkingLine(summarizeCampaigns([], [run.record]))).toBe('Walking: the vanguard walked 3.0 days a campaign, 2.0 of them walking home')
  })
})

describe('the threat table', () => {
  it('gives a threat-20 battle its own row', () => {
    const events = runBattle(0, 1, parseArgs(['--encounter', 'freebooter_host', '--threat', '20', '--party-level', '20']))
    const { record } = startCampaign(0, 1, parseArgs(['--campaign']))
    const rows = summarizeCampaigns(events, [record]).byThreat
    expect(rows.map((row) => row.threat)).toEqual([20])
    expect(rows[0].battles).toBe(1)
  }, 20_000)
})

describe('--log none', () => {
  it('writes no file and prints what the same run with a JSONL log prints, but where the log went', () => {
    const dir = mkdtempSync(join(tmpdir(), 'yomi-log-none-'))
    try {
      const run = (log: string, out: string) => {
        const result = spawnSync(process.execPath, ['scripts/simulate.ts', '--battles', '3', '--seed', '1', '--log', log, '--out', out], { encoding: 'utf8' })
        expect(result.status).toBe(0)
        return result.stdout.split('\n')
      }
      const withLog = run('jsonl', join(dir, 'with.jsonl'))
      const without = run('none', join(dir, 'without.jsonl'))
      expect(existsSync(join(dir, 'with.jsonl'))).toBe(true)
      expect(existsSync(join(dir, 'without.jsonl'))).toBe(false)
      expect(withLog[0]).toMatch(/-> .*with\.jsonl$/)
      expect(without[0]).toMatch(/-> no log$/)
      expect(without.slice(1)).toEqual(withLog.slice(1))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)
})

describe('--trading-post', () => {
  it('starts the campaign and its waiting twin with the post at that level, and leaves it at 1 without', () => {
    const plain = startCampaign(0, 1, parseArgs(['--campaign']))
    expect(plain.game.world.tradingPost).toBe(1)
    expect(routeLimit(plain.game.world)).toBe(0)
    const raised = startCampaign(0, 1, parseArgs(['--campaign', '--trading-post', '4']))
    expect(raised.game.world.tradingPost).toBe(4)
    expect(routeLimit(raised.game.world)).toBe(1)
    // The waiting twin starts from the same post, so its market pays from day one as the campaign's does.
    expect(waitingIncome(1, parseArgs(['--campaign', '--trading-post', '4']), 30)).toBeGreaterThan(waitingIncome(1, parseArgs(['--campaign']), 30))
  })

  it('lets the careful company open routes it could not open from a level 1 post', () => {
    const count = (flags: string[]) => {
      // The early game's world (--near-source, stage 9), as the test was written for.
      const args = parseArgs(['--campaign', '--ready-level', '10', '--near-source', ...flags])
      let opened = 0
      for (let c = 0; c < 4; c++) opened += runCampaign(c, 1000 + c, args).record.routesOpened
      return opened
    }
    expect(count([])).toBe(0)
    expect(count(['--trading-post', '4'])).toBeGreaterThan(0)
  }, 120_000)
})

describe('--plans', () => {
  it('takes role=plan pairs, none by default, with and without --campaign', () => {
    expect(parseArgs([]).plans).toEqual({})
    expect(parseArgs(['--plans', 'melee=swordmaster,magic=cryomancer']).plans).toEqual({ melee: 'swordmaster', magic: 'cryomancer' })
    expect(parseArgs(['--campaign', '--plans', 'archery=ranger']).plans).toEqual({ archery: 'ranger' })
  })

  it('refuses a bad role, plan, repeat, missing value or entry without =, naming the part', () => {
    expect(() => parseArgs(['--plans', 'bard=knight'])).toThrow('bard')
    expect(() => parseArgs(['--plans', 'bard=knight'])).toThrow('melee, archery, magic')
    expect(() => parseArgs(['--plans', 'melee=wizard'])).toThrow('wizard')
    expect(() => parseArgs(['--plans', 'melee=wizard'])).toThrow('knight')
    expect(() => parseArgs(['--plans', 'melee=knight,melee=swordmaster'])).toThrow('melee given twice')
    expect(() => parseArgs(['--plans', 'melee'])).toThrow('"melee"')
    expect(() => parseArgs(['--plans'])).toThrow('Missing value for --plans')
    expect(() => parseArgs(['--plans', ''])).toThrow('--plans')
  })

  it('steers the hero tagged in the named skill only, and falls back to planFor', () => {
    const [soldier, archer, mage] = readyMadeParty()
    const plans = parseArgs(['--plans', 'melee=swordmaster']).plans
    expect(playerPlan(plans, soldier)).toBe('swordmaster')
    expect(playerPlan(plans, archer)).toBe(planFor(archer))
    expect(playerPlan(plans, mage)).toBe(planFor(mage))
    expect(playerPlan({}, soldier)).toBe(planFor(soldier))
  })

  it('raises a party along the plan, the others as without the flag', () => {
    const base = parseArgs(['--party-level', '6'])
    const plain = raisedParty(base)
    const planned = raisedParty(parseArgs(['--party-level', '6', '--plans', 'melee=swordmaster']))
    expect(plain[0].perks.power_attack).toBeUndefined()
    expect(planned[0].perks.power_attack).toBe(1)
    expect(planned[0].perks).not.toEqual(plain[0].perks)
    expect(planned[1].perks).toEqual(plain[1].perks)
    expect(planned[2].perks).toEqual(plain[2].perks)
  })

  it('hires recruits along the plan', () => {
    const game = newGame(readyMadeParty(), null, 1)
    game.world.guildHall = 3
    game.world.stock = { ...game.world.stock, gold: 9999 }
    game.parties[0].members.pop()
    visitGuildHall(game, game.parties[0], 1, { melee: 'swordmaster' })
    const hired = game.parties[0].members.at(-1)!
    expect(hired.tagged).toContain('melee')
    expect(hired.perks.power_attack).toBe(1)
  })

  it('leaves the enemy alone: a bandit camp’s foes are the same with the flag', () => {
    const foes = (args: string[]) => {
      const start = runBattle(0, 5, parseArgs(['--encounter', 'bandit_camp', '--threat', '4', '--party-level', '4', ...args]))[0]
      if (start.type !== 'battle_start') throw new Error('expected a battle_start')
      return start.units.filter((u) => u.side === 'enemy')
    }
    expect(foes(['--plans', 'melee=swordmaster'])).toEqual(foes([]))
    expect(banditStats('captain', 4, { tier: 1, grade: 1 })).toBe(banditStats('captain', 4, { tier: 1, grade: 1 }))
  })
  // The parity plans (design skill-trees-node-costs §7.2 step 5): each plan's hero, raised to level 14 by raisedParty,
  // holds its path's capstone, so the level-14 capstone cell measures the capstones.
  const PARITY: readonly [role: string, plan: string, capstone: PerkId][] = [
    ['melee', 'knight', 'unbreakable'],
    ['melee', 'swordmaster', 'blademaster'],
    ['melee', 'spellsword', 'arcane_knight'],
    ['melee', 'paladin', 'aegis'],
    ['archery', 'ranger', 'deadeye'],
    ['archery', 'rogue_archer', 'shadowdancer'],
    ['magic', 'evoker', 'meteor'],
    ['magic', 'cryomancer', 'glacial_prison'],
    ['magic', 'arcanist', 'mass_haste'],
    ['magic', 'healer', 'revive'],
    ['magic', 'saint', 'sanctuary'],
  ]
  // The exceptions. The default evoker_healer (Delwyn's own, a reference beside the parity plans) takes Arcane Blood and
  // Heal All before Fireball (skill trees step 30), so Meteor comes at 15. The others cannot hold it by their asks: the Assassin's Keen Eye asks Luck 6 and Fortune Luck 7, which
  // Aldric (4) and Brenna (4) lack, and their creation nodes lie outside the path, so its other five nodes (Backstab,
  // Venom Strike, Hamstring, Ambush, Executioner: 11 perk points) and Deathblow's 4 need 15 points beyond creation,
  // which come at level 16, not 14 (13).
  const NOT_BY_14: readonly [role: string, plan: string, capstone: PerkId, level: number][] = [
    ['melee', 'assassin', 'deathblow', 16],
    ['archery', 'assassin', 'deathblow', 16],
    ['magic', 'evoker_healer', 'meteor', 15],
  ]
  const roleIndex: Record<string, number> = { melee: 0, archery: 1, magic: 2 }

  it.each(PARITY)('raises the %s hero on the %s plan to level 14 holding %s', (role, plan, capstone) => {
    const hero = raisedParty(parseArgs(['--party-level', '14', '--plans', `${role}=${plan}`]))[roleIndex[role]]
    expect(capstoneOf(hero)).toBe(capstone)
  })

  it.each(NOT_BY_14)('raises the %s hero on the %s plan to %s only at level %i, an exception', (role, plan, capstone, level) => {
    const at = (n: number) => capstoneOf(raisedParty(parseArgs(['--party-level', String(n), '--plans', `${role}=${plan}`]))[roleIndex[role]])
    expect(at(14)).toBeNull()
    expect(at(level - 1)).toBeNull()
    expect(at(level)).toBe(capstone)
  })
})

describe('summarize, with techniques', () => {
  const run = (middle: (outcome: (target: string, status?: CastOutcome['status']) => CastOutcome) => LoggedEvent[]): LoggedEvent[] => {
    const [start, end] = battle(0, 3, 'player')
    if (start.type !== 'battle_start') throw new Error('expected a battle_start')
    const unit = (id: string, side: Side) => ({ id, side }) as (typeof start.units)[number]
    const outcome = (target: string, status: CastOutcome['status'] = null): CastOutcome => ({
      unit: target, attackRoll: 40, chance: 61, defenderAc: 15, hit: true, critical: false, fumble: false,
      image: false, damage: 0, warded: 0, half: false, healed: 0, hpBefore: 12, hpAfter: 12, status,
    })
    return [{ ...start, units: [unit('hero', 'player'), unit('orc', 'enemy'), unit('imp', 'enemy')] }, ...middle(outcome), end]
  }
  const strike = (attacker: string, ability: string, n: number, extra: object = {}): LoggedEvent =>
    ({
      type: 'attack', battleId: 0, seq: 1, round: 1, attacker, defender: 'orc', ability, strike: `s${n}`, hit: true,
      critical: false, damage: 0, bonus: [], opportunity: false, apCost: n === 0 ? 4 : 0, ...extra,
    }) as unknown as LoggedEvent
  const area = (unit: string, ability: string, outcomes: CastOutcome[], extra: object = {}): LoggedEvent =>
    ({ type: 'ability', battleId: 0, seq: 1, round: 1, unit, ability, at: { q: 0, r: 0 }, shape: 'burst', hexes: [], distance: 1, apCost: 4, apAfter: 4, facing: 0, skill: 80, outcomes, ...extra }) as unknown as LoggedEvent

  it('counts a technique once, whatever its strikes, and taunts, pins and mana by side', () => {
    const summary = summarize(
      run((outcome) => [
        strike('hero', 'power_attack', 0, { manaCost: 2, manaAfter: 10 }),
        strike('hero', 'cleave', 0, {}),
        strike('hero', 'cleave', 1, {}),
        area('hero', 'taunt', [outcome('orc', { id: 'taunted', turnsLeft: 2 }), outcome('imp', { id: 'taunted', turnsLeft: 2 })], { manaCost: 3, manaAfter: 7 }),
        strike('hero', 'pin', 0, { status: { id: 'pinned', turnsLeft: 1 } }),
        strike('orc', 'troll_claws', 0, {}),
        area('orc', 'fire_spit', [outcome('hero')]),
      ]),
      1,
    )
    expect(summary.playerTechniques).toEqual({ power_attack: 1, cleave: 1, taunt: 1, pin: 1 })
    expect(summary.enemyTechniques).toEqual({})
    expect(summary).toMatchObject({ avgPlayerTaunts: 2, avgEnemyTaunts: 0, avgPlayerPins: 1, avgEnemyPins: 0, avgPlayerTechniqueMana: 5, avgEnemyTechniqueMana: 0 })
  })

  it('averages over the battles', () => {
    const summary = summarize(run((outcome) => [area('hero', 'taunt', [outcome('orc', { id: 'taunted', turnsLeft: 2 })])]), 2)
    expect(summary.playerTechniques).toEqual({ taunt: 0.5 })
    expect(summary.avgPlayerTaunts).toBe(0.5)
  })
})

describe('summarize, with the stage-3 traits', () => {
  const run = (middle: LoggedEvent[]): LoggedEvent[] => {
    const [start, end] = battle(0, 3, 'player')
    if (start.type !== 'battle_start') throw new Error('expected a battle_start')
    const unit = (id: string, side: Side) => ({ id, side }) as (typeof start.units)[number]
    return [{ ...start, units: [unit('hero', 'player'), unit('ally', 'player'), unit('orc', 'enemy')] }, ...middle, end]
  }
  const attack = (attacker: string, defender: string, extra: object = {}): LoggedEvent =>
    ({ type: 'attack', battleId: 0, seq: 1, round: 1, attacker, defender, hit: true, critical: false, damage: 0, bonus: [], opportunity: false, apCost: 4, ...extra }) as unknown as LoggedEvent
  const outcome = (unit: string, extra: object = {}) =>
    ({ unit, attackRoll: 40, chance: 61, defenderAc: 15, hit: true, critical: false, fumble: false, image: false, damage: 0, warded: 0, half: false, healed: 0, hpBefore: 1, hpAfter: 1, status: null, ...extra })
  const cast = (caster: string, outcomes: object[]): LoggedEvent =>
    ({ type: 'cast', battleId: 0, seq: 1, round: 1, caster, spell: 'revive', drained: 0, outcomes }) as unknown as LoggedEvent
  const tick = (unit: string, extra: object = {}): LoggedEvent =>
    ({ type: 'status_tick', battleId: 0, seq: 1, round: 1, unit, status: 'poisoned', damage: 1, warded: 0, hpBefore: 2, hpAfter: 1, ...extra }) as unknown as LoggedEvent

  it('counts counters, deathblows, revives and Unbreakable saves by side', () => {
    const summary = summarize(
      run([
        attack('hero', 'orc', { counter: true }),
        attack('hero', 'orc', { deathblow: true }),
        attack('orc', 'hero', { counter: true, endured: true }),
        attack('orc', 'ally', { endured: true }),
        cast('hero', [outcome('ally', { revived: true }), outcome('hero', { endured: true })]),
        tick('orc', { endured: true }),
        tick('hero'),
        attack('hero', 'orc'),
      ]),
      1,
    )
    expect(summary).toMatchObject({
      avgPlayerCounters: 1, avgEnemyCounters: 1,
      avgPlayerDeathblows: 1, avgEnemyDeathblows: 0,
      avgPlayerRevives: 1, avgEnemyRevives: 0,
      avgPlayerUnbreakableSaves: 3, avgEnemyUnbreakableSaves: 1,
    })
  })

  it('counts nothing when no event carries the fields, and averages over the battles', () => {
    expect(summarize(run([attack('hero', 'orc')]), 1)).toMatchObject({ avgPlayerCounters: 0, avgPlayerDeathblows: 0, avgPlayerRevives: 0, avgPlayerUnbreakableSaves: 0, avgEnemyUnbreakableSaves: 0 })
    expect(summarize(run([attack('hero', 'orc', { deathblow: true })]), 4).avgPlayerDeathblows).toBe(0.25)
  })
})

describe('callings and capstones of a vanguard', () => {
  const hero = (...perks: string[]) => ({ perks: Object.fromEntries(perks.map((id) => [id, 1])) }) as unknown as Character
  it('counts the deepest paths of each hero, a tie counting every tied path, and the capstones held', () => {
    expect(vanguardTallies([hero('power_attack'), hero('power_attack', 'meteor'), hero()])).toEqual({
      callings: { swordmaster: 2, evoker: 1 },
      capstones: { meteor: 1 },
    })
  })
  it('counts a tie for every path and nothing for a hero with no nodes', () => {
    const tied = vanguardTallies([hero('power_attack', 'fireball')])
    expect(Object.keys(tied.callings).sort()).toEqual(['evoker', 'swordmaster'])
    expect(vanguardTallies([hero()])).toEqual({ callings: {}, capstones: {} })
  })
})

describe('techniques in a small run', () => {
  it('counts what the player’s side used, never negative', () => {
    const events = [0, 1, 2].flatMap((i) => runBattle(i, 100 + i, parseArgs(['--encounter', 'bandit_camp', '--threat', '4', '--party-level', '4'])))
    const summary = summarize(events, 3)
    expect(Object.values(summary.playerTechniques).every((n) => n >= 0)).toBe(true)
    expect(Object.values(summary.playerTechniques).reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
    expect(summary.avgPlayerTaunts).toBeGreaterThanOrEqual(0)
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
    // A whole long campaign again: since stage 9 it walks to the far Source, about 20 seconds alone.
  }, 120_000)

  it('is summed up by how campaigns ended and the battles won at each threat', () => {
    const other = { ...record, outcome: 'encampment' as const, days: record.days + 10 }
    const summary = summarizeCampaigns(battles.flat(), [record, other])
    expect(summary).toMatchObject({ campaigns: 2, sourceShare: record.outcome === 'source' ? 0.5 : 0, avgDays: record.days + 5 })
    expect(summary.outcomes.encampment).toBe(1)
    expect(summary.byThreat.map((row) => row.threat)).toEqual([...new Set(starts.map((e) => e.meta.threat as number))].sort((a, b) => a - b))
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

/**
 * The early game's one-party campaign (`--ready-level 7 --near-source`), for tests that need a campaign's record of
 * any kind: since stage 9 the default, long campaign walks to the far Source and takes many times longer.
 */
const EARLY_ONE = parseArgs(['--campaign', '--parties', '1', '--ready-level', '7', '--near-source'])

describe('summarizeCampaigns, the levels', () => {
  const base = { ...runCampaign(3, 1, EARLY_ONE, 0).record }
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
    expect(spentByPlan(game.parties[0].members[3])).toBe(true)
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

  describe('the improve errand', () => {
    // Iron Vein is 3 hexes from home and held; Gold Seam 7, held too.
    const errandOf = (stock: Stock, lodge = 0) => {
      const game = newGame(undefined, null, 1)
      game.world.stock = { ...stock }
      game.world.lodge = lodge
      const site = (id: string) => game.world.locations.find((l) => l.id === id)!
      return { game, world: game.world, party: game.parties[0], site }
    }
    const ample: Stock = { gold: 500, timber: 100, stone: 100, iron: 100 }

    it('goes nowhere when the stock affords nothing', () => {
      const { world, party } = errandOf({ gold: 14, timber: 10 })
      expect(improveErrand(world, party)).toBeNull()
    })

    it('puts an outpost on the nearest held resource at Lodge 0, never on the encampment', () => {
      const { world, party } = errandOf({ ...IMPROVEMENT_COSTS[0] })
      expect(improveErrand(world, party)?.id).toBe('iron_vein')
      world.improvements = { iron_vein: 1 }
      // Gold Seam is beyond the radius from home; the encampment never counts.
      expect(improveErrand(world, party)).toBeNull()
    })

    it('raises no works at Lodge 0, and works from Lodge 1', () => {
      const at0 = errandOf(ample, 0)
      at0.world.improvements = { iron_vein: 1 }
      expect(improveErrand(at0.world, at0.party)).toBeNull()
      const at1 = errandOf(ample, 1)
      at1.world.improvements = { iron_vein: 1 }
      expect(improveErrand(at1.world, at1.party)?.id).toBe('iron_vein')
      at1.world.stock = { ...IMPROVEMENT_COSTS[1], gold: IMPROVEMENT_COSTS[1].gold! - 1 }
      expect(improveErrand(at1.world, at1.party)).toBeNull()
    })

    it('takes the nearest when several qualify, and ignores a site beyond the radius', () => {
      const { world, party, site } = errandOf(ample)
      party.position = { q: site('gold_seam').position.q - 2, r: site('gold_seam').position.r }
      expect(hexDistance(party.position, site('iron_vein').position)).toBeLessThanOrEqual(IMPROVE_ERRAND_RADIUS)
      expect(improveErrand(world, party)?.id).toBe('gold_seam')
      party.position = { q: site('gold_seam').position.q + IMPROVE_ERRAND_RADIUS + 1, r: site('gold_seam').position.r }
      expect(improveErrand(world, party)).toBeNull()
    })

    it('raises a fort first on a site under FORT_FIRST_DAYS to fall, over a nearer one', () => {
      const { world, party, site } = errandOf(ample, 2)
      const seam = site('gold_seam')
      // Iron Vein 2 hexes off, an outpost; Gold Seam 4, a works.
      party.position = { q: 3 + EARLY_SHIFT.q, r: 19 + EARLY_SHIFT.r }
      world.improvements = { iron_vein: 1, gold_seam: 2 }
      expect([hexDistance(party.position, site('iron_vein').position), hexDistance(party.position, seam.position)]).toEqual([2, 4])
      expect(improveErrand(world, party)?.id).toBe('iron_vein')
      // Nests all round Gold Seam: it falls within days.
      for (const [dq, dr] of [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]) {
        const at = { q: seam.position.q + dq, r: seam.position.r + dr }
        world.locations.push({ id: `nest_${dq}_${dr}`, kind: 'monsters', name: 'Nest', position: at, encounter: 'goblin_raid', threat: 5, loot: [] })
        world.blight[boardIndex(world.board, at)] = 3
      }
      world.blight[boardIndex(world.board, seam.position)] = 2
      const days = daysToFall(world, [presenceOf(party)], seam)
      expect(days).not.toBeNull()
      expect(days!).toBeLessThan(FORT_FIRST_DAYS)
      expect(improveErrand(world, party)?.id).toBe('gold_seam')
      // Not so soon to fall: the nearest again.
      world.locations = world.locations.filter((l) => !l.id.startsWith('nest_'))
      for (const [dq, dr] of [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]) world.blight[boardIndex(world.board, { q: seam.position.q + dq, r: seam.position.r + dr })] = 0
      world.blight[boardIndex(world.board, seam.position)] = 0
      expect(daysToFall(world, [presenceOf(party)], seam)).toBeNull()
      expect(improveErrand(world, party)?.id).toBe('iron_vein')
    })
  })
})

describe('the trading post and crafting in a campaign', () => {
  it('sells the baggage and surplus, builds, buys better grades and crafts at home', () => {
    const game = newGame(undefined, null, 1)
    game.parties[0].baggage.push(game.parties[0].members[0].backpack[0]!)
    // The Lodge already at its limit without a route (its gold is not under test here), its improvements kept for in the stock.
    game.world.lodge = lodgeCap(game.world)
    game.world.stock = { gold: 500, iron: 60, timber: 40, stone: 60, copper: 40, salt: 9 }
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

  it('keeps of the outer rings\' materials only the workshop\'s levels 4 to 6 ores (stage 10), so the careful party sells the rest', () => {
    const outer = ['ironwood', 'mithril', 'elderwood', 'adamant', 'wyrmwood', 'starmetal', 'heartwood'] as const
    const kept = (needs: Stock) => Object.fromEntries(outer.map((material) => [material, needs[material] ?? 0]))
    const none = { ironwood: 0, mithril: 0, elderwood: 0, adamant: 0, wyrmwood: 0, starmetal: 0, heartwood: 0 }
    for (const [shape, expected] of [
      [{}, { ...none, mithril: 20, adamant: 20, starmetal: 10 }],
      [{ tradingPost: 6, workshop: 3, shrine: 3, infirmary: 3, lodge: 3, guildHall: 5 }, { ...none, mithril: 20, adamant: 20, starmetal: 10 }],
      [{ workshop: 5 }, { ...none, starmetal: 10 }],
      [{ workshop: 6 }, none],
    ] as const) {
      const game = newGame(undefined, null, 1)
      Object.assign(game.world, shape)
      expect(kept(materialNeeds(game, 3)), JSON.stringify(shape)).toEqual(expected)
    }
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

  it('counts every level of the post left, and raises it to 6', () => {
    const game = newGame(undefined, null, 1)
    game.world.tradingPost = 4
    const at4 = materialNeeds(game)
    game.world.tradingPost = 6
    const at6 = materialNeeds(game)
    expect((at4.crystal ?? 0) - (at6.crystal ?? 0)).toBe(10)
    expect((at4.silver ?? 0) - (at6.silver ?? 0)).toBe(70)
    game.world.tradingPost = 4
    game.world.stock = { gold: 5000, silver: 500, stone: 500, crystal: 50, timber: 100, iron: 100, copper: 100 }
    visitFacilities(game, game.parties[0])
    expect(game.world.tradingPost).toBe(6)
  })

  it('raises the Builders\' Lodge after the infirmary, to 2 without a route and no further', () => {
    const game = newGame(undefined, null, 1)
    game.world.stock = { gold: 5000, silver: 500, stone: 500, crystal: 50, timber: 100, iron: 100, copper: 100 }
    visitFacilities(game, game.parties[0])
    expect(game.world.routes).toEqual([])
    expect(game.world.lodge).toBe(2)
    // Last for the gold: with only the infirmary's first level and the Lodge's to buy, the infirmary comes first.
    const poor = newGame(undefined, null, 1)
    poor.world.tradingPost = 6
    poor.world.workshop = 3
    poor.world.shrine = 3
    poor.world.stock = { gold: 30, timber: 20 }
    visitFacilities(poor, poor.parties[0])
    expect([poor.world.infirmary, poor.world.lodge]).toEqual([1, 0])
  })

  it('keeps the Lodge\'s levels left to its limit, and each improvement level the Lodge allows', () => {
    const game = newGame(undefined, null, 1)
    const at0 = materialNeeds(game)
    game.world.lodge = 1
    const at1 = materialNeeds(game)
    game.world.lodge = 2
    const at2 = materialNeeds(game)
    // Lodge 0 to 1: its first level (20 timber) no longer kept; the works' 15 stone now kept, its second level's 25 stone still.
    expect((at0.timber ?? 0) - (at1.timber ?? 0)).toBe(LODGE_COSTS[0].timber)
    expect((at1.stone ?? 0) - (at0.stone ?? 0)).toBe(IMPROVEMENT_COSTS[1].stone)
    // Lodge 1 to 2: its second level's 25 stone gone, the fort's 10 stone and 20 iron kept.
    expect((at2.stone ?? 0) - (at1.stone ?? 0)).toBe(IMPROVEMENT_COSTS[2].stone! - LODGE_COSTS[1].stone!)
    expect((at2.iron ?? 0) - (at1.iron ?? 0)).toBe(IMPROVEMENT_COSTS[2].iron)
    // The Lodge's third level waits for an open route, and is not kept for before one.
    expect(at2.iron! - at1.iron!).not.toBe(IMPROVEMENT_COSTS[2].iron! + LODGE_COSTS[2].iron!)
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
    const base = { ...runCampaign(3, 1, EARLY_ONE, 0).record }
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

describe('the kit: roles, the expected kit and the record', () => {
  it('reads a hero\'s kit role from its first tagged skill: the ready-made three are a fighter, an archer and a mage', () => {
    expect(readyMadeParty().map(kitRole)).toEqual(['fighter', 'archer', 'mage'])
    const [fighter] = readyMadeParty()
    expect(kitRole({ ...fighter, tagged: ['magic', 'melee'] })).toBe('mage')
  })

  it('gives gear §5.8\'s expected kit by level, the same for every role', () => {
    const row = (tier: number, grades: number[], sockets: number[], ranks: number[]) => ({ tier, grades, sockets, ranks })
    const rows = [
      row(1, [1, 2], [0, 0], [1, 1]),
      row(2, [2, 3], [1, 2], [1, 2]),
      row(3, [2, 2], [2, 3], [2, 2]),
      row(4, [2, 3], [3, 4], [2, 3]),
      row(5, [3, 3], [4, 6], [3, 4]),
    ]
    for (const role of ['fighter', 'archer', 'mage'] as const) {
      expect([1, 5, 9, 13, 17, 20].map((level) => expectedKit(role, level))).toEqual([...rows, rows[4]])
      expect([4, 8, 12, 16].map((level) => expectedKit(role, level).tier)).toEqual([1, 2, 3, 4])
    }
    expect(expectedKit('mage', 0)).toEqual(rows[0])
    expect(expectedKit('mage', 25)).toEqual(rows[4])
  })

  it('notes the party\'s kit wherever it notes the battles to a level', () => {
    const { record } = runCampaign(3, 1, EARLY_ONE, 0)
    expect(Object.keys(record.battlesToLevel).length).toBeGreaterThan(0)
    expect(Object.keys(record.kitAtLevel)).toEqual(Object.keys(record.battlesToLevel))
    for (const notes of Object.values(record.kitAtLevel)) {
      expect(notes.length).toBeGreaterThan(0)
      for (const note of notes) {
        expect(['fighter', 'archer', 'mage']).toContain(note.role)
        expect(note.tier).toBeGreaterThanOrEqual(1)
        expect(note.sockets).toBeGreaterThanOrEqual(0)
      }
    }
    expect(record.goldOnForging).toBe(0)
  }, 20_000)

  it('notes an enchanted or empty main hand as tier 0, and counts the runes across the worn gear', () => {
    const [fighter, , mage] = readyMadeParty()
    fighter.equipment.mainHand = itemById('steel_longsword@3#ember1')!
    fighter.equipment.armor = itemById('iron_breastplate@3#stone1')!
    expect(kitNote(fighter)).toEqual({ role: 'fighter', tier: 2, sockets: 2 })
    delete mage.equipment.mainHand
    expect(kitNote(mage)).toEqual({ role: 'mage', tier: 0, sockets: 0 })
    mage.equipment.mainHand = itemById('emberblade')!
    expect(kitNote(mage).tier).toBe(0)
  })

  it('averages the kit by mark and role and the forging gold, and prints a Kit line against the expected kit', () => {
    const base = { ...runCampaign(3, 1, EARLY_ONE, 0).record }
    const records = [
      {
        ...base,
        goldOnForging: 60,
        kitAtLevel: {
          5: [{ role: 'fighter' as const, tier: 2, sockets: 1 }, { role: 'archer' as const, tier: 1, sockets: 0 }],
          10: [{ role: 'fighter' as const, tier: 3, sockets: 3 }],
        },
      },
      { ...base, goldOnForging: 0, kitAtLevel: { 5: [{ role: 'fighter' as const, tier: 1, sockets: 0 }, { role: 'mage' as const, tier: 1, sockets: 2 }] } },
    ]
    const summary = summarizeCampaigns([], records)
    expect(summary.avgGoldOnForging).toBe(30)
    expect(summary.kit).toEqual([
      { level: 5, campaigns: 2, roles: { fighter: { tier: 1.5, sockets: 0.5 }, archer: { tier: 1, sockets: 0 }, mage: { tier: 1, sockets: 2 } } },
      { level: 10, campaigns: 1, roles: { fighter: { tier: 3, sockets: 3 } } },
      { level: 15, campaigns: 0, roles: {} },
      { level: 20, campaigns: 0, roles: {} },
    ])
    expect(kitLines(summary)).toEqual([
      'Kit at 5 (2 campaigns): fighter tier 1.5, 0.5 runes; archer tier 1.0, 0.0 runes; mage tier 1.0, 2.0 runes; expected tier 2, 1–2 runes',
      'Kit at 10 (1 campaigns): fighter tier 3.0, 3.0 runes; expected tier 3, 2–3 runes',
    ])
  }, 20_000)
})

describe('summarizeCampaigns, the improvements and income', () => {
  it('averages improvements by level, the Lodge, gold by source and both incomes, and says whether waiting earns less', () => {
    const base = { ...runCampaign(3, 1, EARLY_ONE, 0).record }
    const records = [
      { ...base, improvementsBuilt: [2, 1, 0], improvementLevels: [3, 1, 1, 0], lodgeLevel: 2, goldBySource: { sites: 40, market: 10, routes: 6, sales: 30 }, partnersContacted: 2, routesOpened: 1, routesRaided: 1, routesAbandoned: 0, incomePerDay: 3, waitingIncomePerDay: 1 },
      { ...base, improvementsBuilt: [1, 0, 1], improvementLevels: [4, 0, 0, 1], lodgeLevel: 1, goldBySource: { sites: 20, market: 0, routes: 0, sales: 10 }, partnersContacted: 1, routesOpened: 0, routesRaided: 0, routesAbandoned: 1, incomePerDay: 2, waitingIncomePerDay: 2 },
    ]
    const summary = summarizeCampaigns([], records)
    expect(summary).toMatchObject({
      avgImprovementsBuilt: [1.5, 0.5, 0.5],
      avgImprovementLevels: [3.5, 0.5, 0.5, 0.5],
      avgLodgeLevel: 1.5,
      avgGoldBySource: { sites: 30, market: 5, routes: 3, sales: 20 },
      avgPartnersContacted: 1.5,
      avgRoutesOpened: 0.5,
      avgRoutesRaided: 0.5,
      avgRoutesAbandoned: 0.5,
      avgIncomePerDay: 2.5,
      avgWaitingIncomePerDay: 1.5,
    })
    expect(tradeLine(summary)).toBe('Trade: 1.50 partners contacted; routes 0.50 opened, 0.50 raided, 0.50 abandoned a campaign; 0.00 raids told, 0.00 flickers (raided again within 30 days of safe), 0.00 routes raided 6+ yield days and kept')
    expect(waitingLine(summary)).toBe('Waiting check: income 2.5 a day campaigning, 1.5 waiting at home: waiting earns less')
    expect(waitingLine({ ...summary, avgWaitingIncomePerDay: 2.5 })).toMatch(/waiting earns as much or more$/)
  }, 20_000)
})

describe('the waiting check (A9)', () => {
  it('values the yields: gold as it is, every other material at the trading post\'s rate, nothing else', () => {
    const events: WorldEvent[] = [
      { type: 'yield', site: 'gold_seam', name: 'Gold Seam', material: 'gold', amount: 4 },
      { type: 'yield', site: 'iron_vein', name: 'Iron Vein', material: 'iron', amount: 5 },
      { type: 'yield', site: ENCAMPMENT_ID, name: 'Home', material: 'gold', amount: 3, source: 'market' },
      { type: 'site_captured', site: 'timber_stand', name: 'Timber Stand' },
    ]
    expect(yieldValue(events)).toBe(4 + 3 + 5 / MATERIALS_PER_GOLD)
  })

  it('earns less waiting at home than campaigning over the same first 120 days of seed 1', () => {
    const args = parseArgs(['--campaign', '--parties', '1'])
    const run = startCampaign(0, 1, args)
    let last: DayReport | undefined
    while (run.game.world.turn < 120) {
      const round = playRound(run, last)
      if (!Array.isArray(round)) throw new Error(`The campaign ended (${round}) before day 120`)
      last = round.at(-1)
    }
    const days = run.game.world.turn
    const waiting = waitingIncome(1, args, days)
    expect(waiting).toBeGreaterThan(0)
    expect(waiting).toBeLessThan(run.income / days)
  }, 30_000)

  it('is the same for the same seed and days, and 0 over no days', () => {
    const args = parseArgs(['--campaign', '--parties', '1'])
    expect(waitingIncome(1, args, 40)).toBe(waitingIncome(1, args, 40))
    expect(waitingIncome(1, args, 0)).toBe(0)
  })
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
 * in this stage. Re-recorded in skill trees step 03: the trees' nodes, a pick every even level and the plans
 * changed play. Re-recorded in skill trees step 04: every hero has mana, 2 more a Mage or Cleric node, and the
 * derived passives (resistance, wards, Shield Wall, Sacred Weapon, the spell modifiers) work in battle. Re-hashed in
 * skill trees step 09 for `LOG_SCHEMA_VERSION` 25 alone: the records unchanged, and the new log with every
 * `"schemaVersion":25` written back as 24 hashes to the old `8e01443a...db5c94`. Re-recorded in skill trees step 13:
 * the stage-2 nodes and plans move play (heroes and bandits learn techniques as they level). Re-recorded in skill trees
 * step 16: `techniqueScore` weighing a technique by the blows that fit this turn, then the knight plan taking Pin before
 * Heavy Hand (the bandit Captain and recruited knights). Re-hashed in skill trees step 17 for `LOG_SCHEMA_VERSION` 26
 * alone: the records unchanged, and the new log with each of its 115 `"schemaVersion":26` written back as 25 hashes
 * to the old `aa9ffae5...ff5119`. Re-hashed in skill trees step 21, the records unchanged: the stage-3 nodes enter
 * the plans and the six partial nodes are completed (Iron Skin's free attacks, Battle Mage's mana on hit, Skirmisher,
 * Fortune, Deadeye, Serenity), which changes the heroes' events (the guard's heroes reach level 9, past Iron Skin
 * at 8) but no campaign's figures. Re-recorded in skill trees step 23: `CampaignRecord`
 * gains `callings` and `capstones` (the events unchanged, the hash the same as before). Re-recorded in skill trees
 * step 28: perk points (a node costs its tier's 1 to 4, a point every level) and `autoAdvance` saving for the plan's
 * next node move every hero's and bandit's nodes, so play and the campaigns' figures change. Re-recorded in skill trees
 * step 30: the knight and evoker_healer plans reordered, bandits in plain gear at threat 4 and `FOE_HP_PER_LEVEL`
 * 1.15. Re-recorded in stage 7 step 06: the Lodge, works, forts and the trading post's levels 5 and 6 in the careful
 * party's economy, and the record's improvement, income and waiting fields (`outpostsBuilt` gone; `waitingIncomePerDay`
 * is 0 without `--waiting`). Play moved through `materialNeeds` keeping the Lodge's and the post's higher levels'
 * materials and raising the Lodge: days 389, 385, 310, 423, 29 became 390, 385, 310, 423, 29; outcomes unchanged (four
 * Source, one fallen); campaign 1 built an outpost (0 before), campaign 2 lost two heroes (0 before), campaign 4 raised
 * the Lodge to 1. Re-recorded in stage 8 step 07: every simulated world has the trade partners Millbrook and
 * Saltmere (clean sources of `PARTNER_STRENGTH` from day 1, so the land, the spawns and everything after them move),
 * the vanguard detours to contact a partner once the trading post allows routes, routes open at home, the Lodge
 * may reach 3, raiders are weighed and road towers built; and the record gains `partnersContacted`, `routesOpened`,
 * `routesRaided`, `routesAbandoned` and `goldBySource.routes`. No route opens in these five (the post ends at 1 or 2):
 * the move is the partners' land alone (and contacts made on the way, 1, 1, 1, 0, 0). Days 390, 385, 310, 423, 29
 * became 457, 383, 331, 346, 29; battles 25, 26, 19, 21, 4 became 29, 26, 20, 18, 4; spawns 35, 36, 29, 31, 2 became
 * 39, 36, 30, 28, 2; outcomes four Source and one fallen became three Source and two fallen (campaign 3 now falls on
 * day 346). The 50-campaign check moved from 23 to 22 of 50. A mismatch means a step changed behaviour.
 *
 * Stage 9 step 02: args pinned to `--ready-level 7 --near-source`; four fields added (`vanguardWalkDays` 412, 341,
 * 300, 303, 26; `routeRaidsTold`, `routeFlickers`, `routesRaidedLong` 0, no route opening), play unchanged.
 *
 * Re-recorded in stage 9 step 04 (the board and the rings): the map is 140 × 72 with home and stage 8's locations
 * moved by `EARLY_SHIFT` (every distance among them kept), the near Source at `earlyHex(58, 19)`; the land past
 * stage 8's edges now exists and contends (no edge near the home country), and beyond 54 hexes of home it is the
 * threat 7 ring, whose corruption spawns threat 7 nests (Bandit Gangs, Spider Broods, Salamander Springs) where
 * stage 8 had no land or capped the threat at 5; spawn pressure is a 840th of the corrupted hexes a day (a 200th),
 * up to 60 monster locations (24); a nest past threat 5 pushes as threat 5's. Outcomes unchanged (three Source,
 * two fallen, campaign 3 still falling). Days 457, 383, 331, 346, 29 became 433, 416, 328, 359, 29; battles 29, 26,
 * 20, 18, 4 became 26, 24, 18, 22, 4; spawns 39, 36, 30, 28, 2 became 46, 43, 31, 35, 0; sites captured 6, 4, 4, 2, 0
 * became 6, 4, 3, 5, 0, lost 0 in all before and after; land blighted at the end 0.281, 0.322, 0.332, 0.469, 0.326
 * became 0.299, 0.285, 0.272, 0.280, 0.118 (a share of a board 4.2 times the size). Events hash `e638f2a4...6f1180`
 * became `31f97ff2...d70f9f`.
 *
 * Re-recorded in stage 9 step 05 (the outer rings' content): 24 fixed nests in the rings of threat 7 to 18, seven
 * resource sites and three far partners. `--near-source`'s world leaves out the fixed nests above its Source's
 * threat (5; the user's decision after the step's review: left in, they corrupted the outer rings and drew the
 * spawns away from the home country), keeping the far sites and partners, so the move is the far sites' and
 * partners' land (a partner is a clean source) and the spawns it reshuffles. Outcomes unchanged (three Source, two
 * fallen). Days 433, 416, 328, 359, 29 became 417, 414, 351, 362, 29; battles 26, 24, 18, 22, 4 became 19, 24, 19,
 * 22, 4; spawns 46, 43, 31, 35, 0 became 52, 50, 34, 36, 0; sites captured 6, 4, 3, 5, 0 became 3, 4, 3, 5, 0, lost
 * 0 in all; land blighted at the end 0.299, 0.285, 0.272, 0.280, 0.118 became 0.374, 0.355, 0.274, 0.299, 0.118;
 * partners contacted 1, 1, 1, 0, 0 unchanged. Events hash `31f97ff2...d70f9f` became `e4dd3391...fb6394`. (The
 * step's first version, with the outer nests in the near-Source world, had moved them to fallen, Source, fallen,
 * Source, fallen, with 0.49 to 0.71 of the land blighted.)
 */
const GUARD_RECORDS: CampaignRecord[] = [
  { outcome: "source", days: 417, battles: 19, spawns: 52, captured: 3, lost: 0, blighted: 0.37430555555555556, healedHp: 108, campDays: 28, towersBuilt: 3, towersLost: 0, deaths: 2, recruits: 3, hallLevel: 3, shrineLevel: 1, tradingPostLevel: 1, workshopLevel: 1, infirmaryLevel: 1, goldOnGear: 0, goldFromSales: 56, tierTwoBought: 0, crafted: 7, fieldCraftDays: 2, runesFound: 17, runesBought: 0, runesFused: 1, socketsFilled: 0, goldOnRunes: 20, finalLevels: [8, 8, 8, 7], callings: { heavy_knight: 2, ranger: 1, evoker: 1 }, capstones: {  }, deathsAtLevel: [2, 7], battlesToLevel: { 5: 6 }, roles: { vanguard: { battles: 19, wipes: 0, finalLevels: [[8, 8, 8, 7]] }, guard: { battles: 0, wipes: 0, finalLevels: [] } }, wipes: 0, promotions: 0, vanguardWalkDays: 383, vanguardWalkHomeDays: 106, guardBattles: 0, improvementsBuilt: [0, 0, 0], improvementLevels: [5, 0, 0, 0], lodgeLevel: 1, goldBySource: { sites: 332, market: 0, routes: 0, sales: 56 }, partnersContacted: 1, routesOpened: 0, routesRaided: 0, routesAbandoned: 0, routeRaidsTold: 0, routeFlickers: 0, routesRaidedLong: 0, incomePerDay: 1.2973621103117505, waitingIncomePerDay: 0, goldOnForging: 0, kitAtLevel: { 5: [{ role: "fighter", tier: 1, sockets: 0 }, { role: "archer", tier: 1, sockets: 0 }, { role: "mage", tier: 1, sockets: 0 }] } },
  { outcome: "source", days: 414, battles: 24, spawns: 50, captured: 4, lost: 0, blighted: 0.3554563492063492, healedHp: 288, campDays: 43, towersBuilt: 3, towersLost: 0, deaths: 0, recruits: 2, hallLevel: 3, shrineLevel: 0, tradingPostLevel: 1, workshopLevel: 1, infirmaryLevel: 1, goldOnGear: 0, goldFromSales: 0, tierTwoBought: 0, crafted: 6, fieldCraftDays: 3, runesFound: 19, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [9, 9, 9, 8, 7], callings: { heavy_knight: 3, ranger: 1, evoker: 1 }, capstones: {  }, deathsAtLevel: [], battlesToLevel: { 5: 6 }, roles: { vanguard: { battles: 24, wipes: 0, finalLevels: [[9, 9, 9, 8, 7]] }, guard: { battles: 0, wipes: 0, finalLevels: [] } }, wipes: 0, promotions: 0, vanguardWalkDays: 364, vanguardWalkHomeDays: 77, guardBattles: 0, improvementsBuilt: [0, 0, 0], improvementLevels: [6, 0, 0, 0], lodgeLevel: 1, goldBySource: { sites: 328, market: 0, routes: 0, sales: 0 }, partnersContacted: 1, routesOpened: 0, routesRaided: 0, routesAbandoned: 0, routeRaidsTold: 0, routeFlickers: 0, routesRaidedLong: 0, incomePerDay: 1.3792270531400965, waitingIncomePerDay: 0, goldOnForging: 0, kitAtLevel: { 5: [{ role: "fighter", tier: 1, sockets: 0 }, { role: "archer", tier: 1, sockets: 0 }, { role: "mage", tier: 1, sockets: 0 }] } },
  { outcome: "source", days: 351, battles: 19, spawns: 34, captured: 3, lost: 0, blighted: 0.27420634920634923, healedHp: 243, campDays: 23, towersBuilt: 3, towersLost: 0, deaths: 3, recruits: 3, hallLevel: 3, shrineLevel: 2, tradingPostLevel: 1, workshopLevel: 0, infirmaryLevel: 1, goldOnGear: 0, goldFromSales: 51, tierTwoBought: 0, crafted: 4, fieldCraftDays: 4, runesFound: 13, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [8, 8, 7], callings: { ranger: 1, evoker: 1, heavy_knight: 1 }, capstones: {  }, deathsAtLevel: [2, 8, 7], battlesToLevel: { 5: 6 }, roles: { vanguard: { battles: 19, wipes: 0, finalLevels: [[8, 8, 7]] }, guard: { battles: 0, wipes: 0, finalLevels: [] } }, wipes: 0, promotions: 0, vanguardWalkDays: 319, vanguardWalkHomeDays: 69, guardBattles: 0, improvementsBuilt: [1, 0, 0], improvementLevels: [4, 1, 0, 0], lodgeLevel: 0, goldBySource: { sites: 280, market: 0, routes: 0, sales: 51 }, partnersContacted: 1, routesOpened: 0, routesRaided: 0, routesAbandoned: 0, routeRaidsTold: 0, routeFlickers: 0, routesRaidedLong: 0, incomePerDay: 1.2905982905982907, waitingIncomePerDay: 0, goldOnForging: 0, kitAtLevel: { 5: [{ role: "fighter", tier: 1, sockets: 0 }, { role: "archer", tier: 1, sockets: 0 }, { role: "mage", tier: 1, sockets: 0 }] } },
  { outcome: "fallen", days: 362, battles: 22, spawns: 36, captured: 5, lost: 0, blighted: 0.29851190476190476, healedHp: 254, campDays: 48, towersBuilt: 1, towersLost: 0, deaths: 1, recruits: 3, hallLevel: 3, shrineLevel: 1, tradingPostLevel: 1, workshopLevel: 1, infirmaryLevel: 1, goldOnGear: 0, goldFromSales: 66, tierTwoBought: 0, crafted: 6, fieldCraftDays: 4, runesFound: 17, runesBought: 0, runesFused: 1, socketsFilled: 0, goldOnRunes: 20, finalLevels: [8, 8, 8, 8, 7], callings: { heavy_knight: 3, ranger: 1, evoker: 1 }, capstones: {  }, deathsAtLevel: [3], battlesToLevel: { 5: 9 }, roles: { vanguard: { battles: 22, wipes: 1, finalLevels: [] }, guard: { battles: 0, wipes: 0, finalLevels: [] } }, wipes: 1, promotions: 0, vanguardWalkDays: 308, vanguardWalkHomeDays: 85, guardBattles: 0, improvementsBuilt: [0, 0, 0], improvementLevels: [7, 0, 0, 0], lodgeLevel: 1, goldBySource: { sites: 288, market: 0, routes: 0, sales: 66 }, partnersContacted: 0, routesOpened: 0, routesRaided: 0, routesAbandoned: 0, routeRaidsTold: 0, routeFlickers: 0, routesRaidedLong: 0, incomePerDay: 1.4116022099447514, waitingIncomePerDay: 0, goldOnForging: 0, kitAtLevel: { 5: [{ role: "fighter", tier: 1, sockets: 0 }, { role: "archer", tier: 1, sockets: 0 }, { role: "mage", tier: 1, sockets: 0 }, { role: "fighter", tier: 1, sockets: 0 }] } },
  { outcome: "fallen", days: 29, battles: 4, spawns: 0, captured: 0, lost: 0, blighted: 0.1177579365079365, healedHp: 1, campDays: 1, towersBuilt: 0, towersLost: 0, deaths: 0, recruits: 0, hallLevel: 1, shrineLevel: 0, tradingPostLevel: 1, workshopLevel: 0, infirmaryLevel: 0, goldOnGear: 0, goldFromSales: 0, tierTwoBought: 0, crafted: 1, fieldCraftDays: 1, runesFound: 2, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0, finalLevels: [3, 3, 3], callings: { swordmaster: 1, heavy_knight: 1, ranger: 1, evoker: 1 }, capstones: {  }, deathsAtLevel: [], battlesToLevel: {  }, roles: { vanguard: { battles: 4, wipes: 1, finalLevels: [] }, guard: { battles: 0, wipes: 0, finalLevels: [] } }, wipes: 1, promotions: 0, vanguardWalkDays: 26, vanguardWalkHomeDays: 0, guardBattles: 0, improvementsBuilt: [0, 0, 0], improvementLevels: [2, 0, 0, 0], lodgeLevel: 0, goldBySource: { sites: 20, market: 0, routes: 0, sales: 0 }, partnersContacted: 0, routesOpened: 0, routesRaided: 0, routesAbandoned: 0, routeRaidsTold: 0, routeFlickers: 0, routesRaidedLong: 0, incomePerDay: 0.8620689655172413, waitingIncomePerDay: 0, goldOnForging: 0, kitAtLevel: {} },
]
const GUARD_EVENTS_SHA256 = 'e4dd3391cd473d66b35d9070815f49e7c84fb913268c20894506e03e0cfb6394'

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

  it.each(['idle', 'garrison'] as const)('counts natural healing while %s without counting camping days', (kind) => {
    const { run, game, party } = campaignOf()
    const site = game.world.locations.find((l) => l.id === 'gold_seam')!
    party.position = site.position
    game.world.held.push(site.id)
    party.order = { kind }
    party.members[0].hp = 1
    const reports = advance(game, 1)
    expect(reports).toHaveLength(1)
    expect(party.members[0].hp).toBe(2)
    takeDays(run, reports)
    expect(run.record.healedHp).toBe(1)
    expect(run.record.campDays).toBe(0)
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

  it('logs the party and its role on battle_start, under schema version 26, and counts the battle to the role', () => {
    const { run, game, party } = campaignOf()
    const target = nextTarget(game.world, party, args.readyLevel)!
    party.position = { ...target.position }
    party.confronting = target.id
    carryOut(run, party, { kind: 'fight', target })
    const start = run.battles[0][0]
    expect(start).toMatchObject({ type: 'battle_start', schemaVersion: 26, meta: { party: 'party_1', role: 'vanguard' } })
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

  it('records the improvements built and held by level, the Lodge, gold by source and income a day', () => {
    const { run, game } = campaignOf()
    const { world } = game
    const report = (events: WorldEvent[]): DayReport => ({ events, partyEvents: [], parties: [], interrupt: null })
    takeDays(run, [
      report([
        { type: 'site_improved', site: 'iron_vein', name: 'Iron Vein', level: 1, building: 'Outpost' },
        { type: 'yield', site: 'gold_seam', name: 'Gold Seam', material: 'gold', amount: 4 },
        { type: 'yield', site: 'iron_vein', name: 'Iron Vein', material: 'iron', amount: 5 },
      ]),
      report([
        { type: 'site_improved', site: 'iron_vein', name: 'Iron Vein', level: 2, building: 'Mine' },
        { type: 'site_improved', site: 'gold_seam', name: 'Gold Seam', level: 1, building: 'Outpost' },
        { type: 'yield', site: ENCAMPMENT_ID, name: 'Home', material: 'gold', amount: 3, source: 'market' },
      ]),
    ])
    run.record.goldFromSales = 12
    world.improvements = { iron_vein: 2, gold_seam: 3 }
    world.lodge = 2
    world.turn = 10
    const { record } = finishCampaign(run, 'timeout')
    expect(record.improvementsBuilt).toEqual([2, 1, 0])
    // Held resources at the end, the encampment not among them: Iron Vein a works, Gold Seam a fort.
    expect(record.improvementLevels).toEqual([world.held.length - 3, 0, 1, 1])
    expect(record.lodgeLevel).toBe(2)
    expect(record.goldBySource).toEqual({ sites: 4, market: 3, routes: 0, sales: 12 })
    // 4 + 3 gold and 5 iron at 2 to the gold piece, over 10 days.
    expect(record.incomePerDay).toBeCloseTo((4 + 3 + 5 / MATERIALS_PER_GOLD) / 10)
    // The waiting twin runs only with --waiting.
    expect(record.waitingIncomePerDay).toBe(0)
    run.args = parseArgs(['--campaign', '--parties', '1', '--waiting'])
    expect(finishCampaign(run, 'timeout').record.waitingIncomePerDay).toBe(waitingIncome(1, run.args, 10))
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
    const { record } = runCampaign(1, 1 + CAMPAIGN_SEED_STEP, EARLY_ONE)
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
    it('never walks home only to form a guard: one forms when the vanguard is home for another errand (step 11 measured the walk as no help)', () => {
      const { game, party } = fullCompany(2)
      game.world.guildHall = 4
      game.world.stock = { gold: 10 * GUARD_MIN_SIZE }
      party.position = { q: party.position.q + 3, r: party.position.r }
      expect(party.members).toHaveLength(3)
      expect(hallErrand(game, party, 2, true)).toBe(false)
      expect(hallErrand(game, party, 1, true)).toBe(false)
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
      expect(formed.party.members.every((m) => m.level === 4 && spentByPlan(m))).toBe(true)
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

describe('the simulator’s trade', () => {
  const args = parseArgs(['--campaign', '--parties', '1'])
  type Game = ReturnType<typeof newGame>
  const at = (game: Game, id: string) => game.world.locations.find((l) => l.id === id)!.position
  const shifted = (h: { q: number; r: number }, dq: number, dr = 0) => ({ q: h.q + dq, r: h.r + dr })
  const nest = (id: string, position: { q: number; r: number }, threat = 1): MonsterLocation => ({
    id, kind: 'monsters', name: id, position, encounter: 'goblin_raid', threat, loot: [],
  })
  const route = (partner: string, road: { q: number; r: number }[]): TradeRoute => ({ id: `route_${partner}`, partner, road, opened: 0, raidedDays: 0, raided: false })
  /** Every nest but the Source gone, and these in their place. */
  const onlyNests = (game: Game, nests: MonsterLocation[]) => {
    game.world.locations = [...game.world.locations.filter((l) => l.kind !== 'monsters' || l.source), ...nests]
  }

  describe('contactErrand', () => {
    it('is the nearest uncontacted partner within CONTACT_DETOUR, none beyond, none once contacted or tried', () => {
      const game = newGame(undefined, null, 1)
      game.world.tradingPost = 4
      const party = game.parties[0]
      party.position = shifted(at(game, 'millbrook'), -CONTACT_DETOUR)
      expect(contactErrand(game.world, party)?.id).toBe('millbrook')
      expect(contactErrand(game.world, party, new Set(['millbrook']))).toBeNull()
      party.position = shifted(at(game, 'millbrook'), -CONTACT_DETOUR - 1)
      expect(hexDistance(party.position, at(game, 'saltmere'))).toBeGreaterThan(CONTACT_DETOUR)
      expect(contactErrand(game.world, party)).toBeNull()
      party.position = shifted(at(game, 'millbrook'), 2)
      game.world.contacted.push('millbrook')
      // Saltmere is 14 hexes off: none.
      expect(contactErrand(game.world, party)).toBeNull()
    })

    it('waits while a held site is threatened, a threatened tower not counting', () => {
      const game = newGame(undefined, null, 1)
      game.world.tradingPost = 4
      const party = game.parties[0]
      party.position = shifted(at(game, 'millbrook'), 3)
      game.world.threatened = ['tower_1']
      expect(contactErrand(game.world, party)?.id).toBe('millbrook')
      game.world.held.push('gold_seam')
      game.world.threatened = ['gold_seam']
      expect(contactErrand(game.world, party)).toBeNull()
    })

    it('is none until the trading post allows routes (level 4)', () => {
      const game = newGame(undefined, null, 1)
      const party = game.parties[0]
      party.position = shifted(at(game, 'millbrook'), 2)
      for (const level of [1, 2, 3]) {
        game.world.tradingPost = level
        expect(contactErrand(game.world, party)).toBeNull()
      }
      game.world.tradingPost = 4
      expect(contactErrand(game.world, party)?.id).toBe('millbrook')
    })

    it('leaves the vanguard to choose its nest at once below trading post 4', () => {
      const game = newGame(undefined, null, 1)
      const party = game.parties[0]
      party.position = shifted(at(game, 'millbrook'), 4)
      const run = startCampaign(0, 1, args, 0, game)
      const plan = planOf(run, party)
      plan.phase = 'choose'
      const next = nextTarget(game.world, party, args.readyLevel)!
      expect(decide(run, party)).toEqual({ kind: 'order', order: { kind: 'travel', to: next.position } })
      expect(plan.contactsTried).toEqual([])
    })

    it('takes the first in locations order on a tie', () => {
      const game = newGame(undefined, null, 1)
      game.world.tradingPost = 4
      const party = game.parties[0]
      const saltmere = game.world.locations.find((l) => l.id === 'saltmere')!
      saltmere.position = shifted(at(game, 'millbrook'), -6)
      party.position = shifted(at(game, 'millbrook'), -3)
      expect(contactErrand(game.world, party)?.id).toBe('millbrook')
    })
  })

  it('walks the vanguard to a partner at choose, and back to choosing a nest once it is contacted', () => {
    const game = newGame(undefined, null, 1)
    game.world.tradingPost = 4
    const party = game.parties[0]
    party.position = shifted(at(game, 'millbrook'), 4)
    const run = startCampaign(0, 1, args, 0, game)
    const plan = planOf(run, party)
    plan.phase = 'choose'
    expect(decide(run, party)).toEqual({ kind: 'order', order: { kind: 'travel', to: at(game, 'millbrook') } })
    expect(plan.phase).toBe('contact')
    for (let i = 0; i < 20 && !isContacted(game.world, 'millbrook'); i++) {
      const decision = decide(run, party)
      expect(decision.kind).toBe('order')
      expect(carryOut(run, party, decision)).toBe('standing')
      takeDays(run, advance(game, Infinity))
    }
    expect(isContacted(game.world, 'millbrook')).toBe(true)
    expect(run.record.partnersContacted).toBe(1)
    const next = nextTarget(game.world, party, args.readyLevel)!
    expect(decide(run, party)).toEqual({ kind: 'order', order: { kind: 'travel', to: next.position } })
    expect(plan.phase).toBe('target')
  }, 20_000)

  it('calls the walk off for a partner contacted on the way, or a held site threatened, and chooses a nest', () => {
    const walkingTo = () => {
      const game = newGame(undefined, null, 1)
      game.world.tradingPost = 4
      const party = game.parties[0]
      party.position = shifted(at(game, 'millbrook'), 4)
      const run = startCampaign(0, 1, args, 0, game)
      const plan = planOf(run, party)
      plan.phase = 'choose'
      expect(decide(run, party)).toEqual({ kind: 'order', order: { kind: 'travel', to: at(game, 'millbrook') } })
      return { game, party, run, plan }
    }
    const contacted = walkingTo()
    contacted.game.world.contacted.push('millbrook')
    const next = nextTarget(contacted.game.world, contacted.party, args.readyLevel)!
    expect(decide(contacted.run, contacted.party)).toEqual({ kind: 'order', order: { kind: 'travel', to: next.position } })
    expect(contacted.plan.phase).toBe('target')
    const threatened = walkingTo()
    threatened.game.world.held.push('gold_seam')
    threatened.game.world.threatened = ['gold_seam']
    const defend = nextTarget(threatened.game.world, threatened.party, args.readyLevel)!
    expect(decide(threatened.run, threatened.party)).toEqual({ kind: 'order', order: { kind: 'travel', to: defend.position } })
    expect(threatened.plan.phase).toBe('target')
  })

  it('gives up a partner it cannot reach and chooses a nest instead', () => {
    const game = newGame(undefined, null, 1)
    game.world.tradingPost = 4
    const party = game.parties[0]
    party.position = shifted(at(game, 'millbrook'), 4)
    const run = startCampaign(0, 1, args, 0, game)
    const plan = planOf(run, party)
    plan.phase = 'choose'
    expect(decide(run, party).kind).toBe('order')
    plan.stalled = true
    const next = nextTarget(game.world, party, args.readyLevel)!
    expect(decide(run, party)).toEqual({ kind: 'order', order: { kind: 'travel', to: next.position } })
    expect(plan.contactsTried).toEqual(['millbrook'])
  })

  describe('towerErrand', () => {
    /** A clean world but one tainted road hex 5 from the party, the stock affording a tower. */
    const roadWorld = () => {
      const game = newGame(undefined, null, 1)
      const { world } = game
      const party = game.parties[0]
      party.position = shifted(at(game, ENCAMPMENT_ID), 0, 6)
      const tainted = shifted(party.position, 4, 1)
      world.blight.fill(0)
      world.blight[boardIndex(world.board, tainted)] = 1
      world.routes = [route('millbrook', [tainted])]
      world.stock = { ...TOWER_COST }
      return { game, world, party, tainted }
    }

    it('is the nearest clean hex that guards an unguarded tainted road hex, ties by board index', () => {
      const { world, party, tainted } = roadWorld()
      const chosen = towerErrand(world, party)!
      expect(chosen).not.toBeNull()
      expect(hexDistance(chosen, tainted)).toBeLessThanOrEqual(GUARD_RADIUS)
      expect(towerHexRefusal(world, chosen)).toBeNull()
      // Every hex that would do is no nearer, and at the same distance no earlier on the board.
      const fits = new HexBoard(world.board).hexes.filter((h) =>
        hexDistance(h, party.position) <= TOWER_ERRAND_RADIUS && hexDistance(h, tainted) <= GUARD_RADIUS && towerHexRefusal(world, h) === null)
      const d = hexDistance(chosen, party.position)
      expect(d).toBe(5 - GUARD_RADIUS)
      const ties = fits.filter((h) => hexDistance(h, party.position) === d)
      expect(ties.length).toBeGreaterThan(1)
      expect(Math.min(...ties.map((h) => boardIndex(world.board, h)))).toBe(boardIndex(world.board, chosen))
    })

    it('is none when a tower guards the hex, no route is open, the stock is short, or no hex takes a tower', () => {
      const guardedBy = roadWorld()
      guardedBy.world.towers.push({ id: 'tower_1', position: shifted(guardedBy.tainted, 0, GUARD_RADIUS) })
      expect(towerErrand(guardedBy.world, guardedBy.party)).toBeNull()
      const noRoute = roadWorld()
      noRoute.world.routes = []
      expect(towerErrand(noRoute.world, noRoute.party)).toBeNull()
      const poor = roadWorld()
      poor.world.stock = { gold: TOWER_COST.gold }
      expect(towerErrand(poor.world, poor.party)).toBeNull()
      const tainted = roadWorld()
      tainted.world.blight.fill(1)
      expect(towerErrand(tainted.world, tainted.party)).toBeNull()
      // A clean road hex needs no guard.
      const clean = roadWorld()
      clean.world.blight.fill(0)
      expect(towerErrand(clean.world, clean.party)).toBeNull()
    })

    it('walks to the errand after a win and builds the tower there', () => {
      const { game, party } = roadWorld()
      const run = startCampaign(0, 1, args, 0, game)
      const plan = planOf(run, party)
      const hexTo = towerErrand(game.world, party)!
      plan.phase = 'tower'
      expect(decide(run, party)).toEqual({ kind: 'order', order: { kind: 'travel', to: hexTo } })
      expect(plan.phase).toBe('road_tower')
      party.position = hexTo
      expect(decide(run, party)).toEqual({ kind: 'act', action: { kind: 'tower' } })
      expect(plan.phase).toBe('improve')
    })
  })

  it('lists every raider of every route once, in route order', () => {
    const game = newGame(undefined, null, 1)
    const { world } = game
    const home = at(game, ENCAMPMENT_ID)
    const a = shifted(home, 6)
    const b = shifted(home, -6)
    const both = nest('both', shifted(home, 0, 8))
    world.routes = [route('millbrook', [a, shifted(home, 0, 7)]), route('saltmere', [b, shifted(home, 1, 7)])]
    onlyNests(game, [nest('near_b', shifted(b, -1)), both, nest('near_a', shifted(a, 2))])
    expect(routeRaiders(world).map((l) => l.id)).toEqual(['both', 'near_a', 'near_b'])
  })

  describe('raiders weighed', () => {
    /** The party at home, a nest 2 hexes off, and a raider 5 hexes off beside an open road. */
    const raided = () => {
      const game = newGame(undefined, null, 1)
      const home = at(game, ENCAMPMENT_ID)
      const near = nest('near', shifted(home, -2))
      const raider = nest('raider', shifted(home, 5))
      onlyNests(game, [near, raider])
      game.world.routes = [route('millbrook', [shifted(home, 6)])]
      return { game, near, raider, party: game.parties[0] }
    }

    it('in nextTarget: after a threatened site’s pusher, before a nearer nest, and only one the party is up to', () => {
      const { game, near, raider, party } = raided()
      expect(nextTarget(game.world, party)).toBe(raider)
      raider.threat = 2
      expect(nextTarget(game.world, party)).toBe(near)
      raider.threat = 1
      const site = at(game, 'gold_seam')
      const besiegers = nest('besiegers', shifted(site, 1))
      game.world.locations.push(besiegers)
      game.world.held.push('gold_seam')
      game.world.threatened = ['gold_seam']
      expect(nextTarget(game.world, party)).toBe(besiegers)
    })

    it('in the guard’s choice: defends against a raider before training', () => {
      const { game, near, raider } = raided()
      game.world.guildHall = 4
      for (const hero of readyMadeParty().slice(0, 3)) game.reserves.push(hero)
      const guard = formParty(game, 'Guard', { from: 'reserves', index: 0 }) as Expedition
      while (game.reserves.length > 0) expect(moveHero(game, { from: 'reserves', index: 0 }, { party: guard.id })).toBeNull()
      const run = startCampaign(0, 1, parseArgs(['--campaign']), 0, game)
      expect(roleOf(run, guard)).toBe('guard')
      planOf(run, guard).skipReinforce = true
      expect(guardChoice(run, guard)).toEqual({ kind: 'defend', target: raider })
      game.world.routes = []
      expect(guardChoice(run, guard)).toEqual({ kind: 'train', target: near })
    })
  })

  describe('routes opened at home', () => {
    const atHome = (setUp: (game: Game) => void) => {
      const game = newGame(undefined, null, 1)
      game.world.contacted = ['saltmere', 'millbrook']
      game.world.tradingPost = 6
      game.world.stock = { gold: 500, timber: 100 }
      setUp(game)
      return { game, party: game.parties[0] }
    }

    it('tries the shortest road first, whatever the contact order, skipping a refused partner and a full post', () => {
      const { game, party } = atHome(() => {})
      expect(roadTo(game.world, 'millbrook')!.length).toBeLessThan(roadTo(game.world, 'saltmere')!.length)
      expect(routeChoices(game, party)).toEqual(['millbrook', 'saltmere'])
      game.world.silent = ['millbrook']
      expect(routeChoices(game, party)).toEqual(['saltmere'])
      game.world.silent = []
      game.world.tradingPost = 4
      game.world.routes = [route('saltmere', roadTo(game.world, 'saltmere')!)]
      expect(routeChoices(game, party)).toEqual([])
    })

    it('opens what the slots allow, then raises the Lodge to 3 with a route open, and tallies each route once', () => {
      const { game, party } = atHome((game) => {
        game.world.tradingPost = 4
        game.world.workshop = 3
        game.world.infirmary = 3
        game.world.stock = { gold: 500, timber: 100, stone: 100, iron: 100 }
      })
      const run = startCampaign(0, 1, args, 0, game)
      expect(carryOut(run, party, { kind: 'hall' })).toBeNull()
      // The post stays at 4 (no silver for 5): one slot, the shorter road.
      expect(game.world.tradingPost).toBe(4)
      expect(game.world.routes.map((r) => r.partner)).toEqual(['millbrook'])
      expect(game.world.lodge).toBe(3)
      expect(run.record.routesOpened).toBe(1)
      expect(run.record.routesOpened).toBe(game.world.routesOpened)
    })

    it('raises the Lodge to 2 only, with no partner contacted', () => {
      const { game, party } = atHome((game) => {
        game.world.contacted = []
        game.world.stock = { gold: 500, timber: 100, stone: 100, iron: 100 }
      })
      visitFacilities(game, party)
      expect(game.world.routes).toEqual([])
      expect(game.world.lodge).toBe(2)
    })
  })

  it('keeps a route’s timber for each free slot while a contacted partner has no route, and none otherwise', () => {
    const game = newGame(undefined, null, 1)
    const { world } = game
    world.tradingPost = 5
    const none = materialNeeds(game).timber ?? 0
    world.contacted = ['millbrook']
    expect((materialNeeds(game).timber ?? 0) - none).toBe(2 * ROUTE_TIMBER)
    world.contacted = ['millbrook', 'saltmere']
    world.routes = [route('millbrook', [at(game, 'millbrook')])]
    expect((materialNeeds(game).timber ?? 0) - none).toBe(ROUTE_TIMBER)
    world.contacted = ['millbrook']
    expect((materialNeeds(game).timber ?? 0) - none).toBe(0)
    world.tradingPost = 3
    world.routes = []
    expect((materialNeeds(game).timber ?? 0) - none).toBe(0)
  })

  it('tallies the trade events: contacts, raid runs, abandonments and route gold', () => {
    const game = newGame(undefined, null, 1)
    const run = startCampaign(0, 1, args, 0, game)
    const report = (events: WorldEvent[]): DayReport => ({ events, partyEvents: [], parties: [], interrupt: null })
    const named = { route: 'route_millbrook', partner: 'millbrook', name: 'Millbrook' }
    takeDays(run, [
      report([
        { type: 'partner_contacted', partner: 'millbrook', name: 'Millbrook', home: 'Home' },
        { type: 'yield', site: 'millbrook', name: 'Millbrook', material: 'gold', amount: 2, source: 'route', route: 'route_millbrook' },
        { type: 'yield', site: 'millbrook', name: 'Millbrook', material: 'timber', amount: 1, source: 'route', route: 'route_millbrook' },
      ]),
      report([{ type: 'route_raided', ...named, cause: 'raiders', raider: 'x', raiderName: 'X', days: 1 }]),
      report([{ type: 'route_raided', ...named, cause: 'raiders', raider: 'x', raiderName: 'X', days: 2 }, { type: 'route_abandoned', ...named }]),
    ])
    expect(run.record).toMatchObject({ partnersContacted: 1, routesRaided: 1, routesAbandoned: 1, routesOpened: 0 })
    expect(run.record.goldBySource).toEqual({ sites: 0, market: 0, routes: 2, sales: 0 })
    expect(run.income).toBeCloseTo(2 + 1 / MATERIALS_PER_GOLD)
  })
})

describe('the refactor guard', () => {
  it('plays 5 seeded campaigns exactly as it did before stage 5, with one party, at ready level 7 and the near Source', () => {
    const args = parseArgs(['--campaign', '--battles', '5', '--seed', '1', '--parties', '1', '--ready-level', '7', '--near-source'])
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
