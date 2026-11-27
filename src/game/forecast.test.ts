import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { maxHp } from '../character/character.ts'
import { autoAdvance, levelUp, planFor } from '../character/progression.ts'
import { mulberry32 } from '../combat/rng.ts'
import { AUTO_POLICY, AUTO_ROUND_LIMIT, ENEMY_POLICY, playOut, playStep, type PlayOutOptions } from '../engine/autoPlay.ts'
import { BattleEngine, type BattleEvent, type BattleSetup, type BattleSnapshot } from '../engine/battleEngine.ts'
import { ENCOUNTERS, type EncounterId } from './encounters.ts'
import {
  FORECAST_SAMPLES,
  FORECAST_SLICE_MS,
  Forecaster,
  battleForecastBase,
  forecast,
  forecastFigure,
  forecastHint,
  forecastLabel,
  forecastSeed,
  workFor,
  worldForecastStart,
  type Forecast,
  type ForecastStart,
} from './forecast.ts'
import { newGame } from './gameState.ts'
import { partyFighters, readyMadeParty, type Party } from './party.ts'
import { MATERIALS, type Tier } from '../inventory/catalog.ts'
import { itemById } from '../inventory/inventory.ts'
import type { MonsterLocation } from './worldMap.ts'

const SEED = 7
const BASE = 12345

function setupOf(encounter: EncounterId = 'goblin_raid', threat = 1): BattleSetup {
  return ENCOUNTERS[encounter](partyFighters(readyMadeParty()), threat).setup
}

/** Options as the game plays a battle seeded `seed`. */
function gameOptions(seed: number, lastRound: number): PlayOutOptions {
  return {
    policies: { player: AUTO_POLICY, enemy: ENEMY_POLICY },
    rngs: { enemy: mulberry32(seed + 1), player: mulberry32(seed + 2) },
    lastRound,
  }
}

/** A real battle, stepped `steps` engine steps with the game's policies; its options carry on from there. */
function battleUnderWay(steps: number, seed = SEED): { engine: BattleEngine; options: PlayOutOptions } {
  const engine = new BattleEngine(setupOf(), { seed, meta: { source: 'test' } })
  const options = gameOptions(seed, AUTO_ROUND_LIMIT)
  for (let i = 0; i < steps; i++) expect(playStep(engine, options)).toBe(true)
  return { engine, options }
}

/** Sample `i` rebuilt by hand from C2's rules and played with `playOut`. */
function sampleByHand(start: ForecastStart, base: number, i: number): { won: boolean; heroLost: boolean; stalled: boolean } {
  const s = forecastSeed(base, i)
  const engine =
    'setup' in start
      ? new BattleEngine(start.setup, { seed: s, meta: { source: 'forecast' } })
      : BattleEngine.restore({ ...start.snapshot, rng: s })
  const firstRound = 'setup' in start ? 1 : start.snapshot.round
  const { over } = playOut(engine, gameOptions(s, firstRound + AUTO_ROUND_LIMIT - 1))
  const state = engine.getState()
  return {
    won: state.winner === 'player',
    heroLost: state.units.some((u) => u.side === 'player' && u.hp <= 0),
    stalled: !over,
  }
}

function countByHand(start: ForecastStart, base: number, samples: number): Forecast {
  const result: Forecast = { samples, wins: 0, heroLost: 0, stalled: 0 }
  for (let i = 0; i < samples; i++) {
    const one = sampleByHand(start, base, i)
    if (one.won) result.wins++
    if (one.heroLost) result.heroLost++
    if (one.stalled) result.stalled++
  }
  return result
}

/** A game whose first party stands on a monster location. */
function gameAtMonsters(): { game: ReturnType<typeof newGame>; location: MonsterLocation } {
  const game = newGame(readyMadeParty(), null, 3)
  const location = game.world.locations.find((l): l is MonsterLocation => l.kind === 'monsters' && !l.source)!
  game.parties[0].position = { ...location.position }
  return { game, location }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('forecast constants', () => {
  it('plays 40 samples in slices of 10 ms', () => {
    expect(FORECAST_SAMPLES).toBe(40)
    expect(FORECAST_SLICE_MS).toBe(10)
  })
})

describe('Forecaster.step', () => {
  it('returns null until done, then the same forecast on every later call', () => {
    const forecaster = new Forecaster({ setup: setupOf() }, BASE, 6)
    let result: Forecast | null = null
    let steps = 0
    while ((result = forecaster.step()) === null) steps++
    expect(steps).toBeGreaterThan(6)
    expect(result.samples).toBe(6)
    expect(forecaster.step()).toEqual(result)
    expect(forecaster.step()).toEqual(result)
  })

  it('defaults to FORECAST_SAMPLES samples', () => {
    expect(forecast({ setup: setupOf() }, BASE).samples).toBe(FORECAST_SAMPLES)
  })
})

describe('determinism (A10)', () => {
  it('gives the same forecast twice from the same start and base', () => {
    expect(forecast({ setup: setupOf() }, BASE, 8)).toEqual(forecast({ setup: setupOf() }, BASE, 8))
  })

  it('gives the same forecast however it is sliced', () => {
    const start: ForecastStart = { setup: setupOf() }
    const whole = forecast(start, BASE, 8)

    const stepped = new Forecaster(start, BASE, 8)
    let byStep: Forecast | null = null
    while (byStep === null) byStep = stepped.step()
    expect(byStep).toEqual(whole)

    // A clock that has passed the budget after every reading lets one step through per slice.
    let t = 0
    const now = () => (t += 100)
    const sliced = new Forecaster(start, BASE, 8)
    let bySlice: Forecast | null = null
    let slices = 0
    while (bySlice === null) {
      bySlice = workFor(sliced, FORECAST_SLICE_MS, now)
      slices++
    }
    expect(slices).toBeGreaterThan(8)
    expect(bySlice).toEqual(whole)
  })

  it('workFor stops when the budget is spent and takes at least one step', () => {
    const forecaster = new Forecaster({ setup: setupOf() }, BASE, 4)
    const step = vi.spyOn(forecaster, 'step')
    let t = 0
    expect(workFor(forecaster, 10, () => (t += 100))).toBeNull()
    expect(step).toHaveBeenCalledTimes(1)
    // A clock that never moves lets it run to the end.
    expect(workFor(forecaster, 10, () => 0)).toEqual(forecast({ setup: setupOf() }, BASE, 4))
  })
})

describe('independence from the real battle (A10)', () => {
  it('leaves the real engine as it was, and its battle plays on as with no estimate', () => {
    const { engine, options } = battleUnderWay(5)
    const before = engine.snapshot()
    forecast({ snapshot: engine.snapshot() }, battleForecastBase(engine.getLog()), 6)
    expect(engine.snapshot()).toEqual(before)
    playOut(engine, options)

    const untouched = battleUnderWay(5)
    playOut(untouched.engine, untouched.options)
    expect(engine.getLog()).toEqual(untouched.engine.getLog())
  })

  it('never writes into the snapshot it was given', () => {
    const { engine } = battleUnderWay(5)
    const snapshot = engine.snapshot()
    const copy = structuredClone(snapshot)
    forecast({ snapshot }, 1, 4)
    expect(snapshot).toEqual(copy)
  })

  it('never calls Math.random', () => {
    const random = vi.spyOn(Math, 'random')
    forecast({ setup: setupOf() }, BASE, 6)
    const { engine } = battleUnderWay(5)
    forecast({ snapshot: engine.snapshot() }, BASE, 6)
    expect(random).not.toHaveBeenCalled()
  })
})

describe('an honest count (A11)', () => {
  it('matches its samples rebuilt and counted by hand, from a setup', () => {
    const start: ForecastStart = { setup: setupOf('hobgoblin_warband', 2) }
    expect(forecast(start, BASE, 10)).toEqual(countByHand(start, BASE, 10))
  })

  it('matches its samples rebuilt and counted by hand, from a snapshot', () => {
    const { engine } = battleUnderWay(9)
    const start: ForecastStart = { snapshot: engine.snapshot() }
    const base = battleForecastBase(engine.getLog())
    expect(forecast(start, base, 10)).toEqual(countByHand(start, base, 10))
  })
})

describe('sensible figures', () => {
  it('a level-1 party wins nearly every goblin raid at threat 1', () => {
    const f = forecast({ setup: setupOf('goblin_raid', 1) }, BASE)
    expect(f.wins).toBeGreaterThanOrEqual(f.samples - 2)
  })

  it('a level-1 party wins no fight with the Source at threat 5', () => {
    const f = forecast({ setup: setupOf('source_guardians', 5) }, BASE)
    expect(f.wins).toBe(0)
    expect(f.heroLost).toBe(f.samples)
  }, 30_000) // plays all 40 samples, ~0.5 s alone but over 5 s when the full suite loads the workers

  it('counts a hero already fallen, with none to revive him, in every sample', () => {
    const { engine } = battleUnderWay(3)
    const snapshot: BattleSnapshot = structuredClone(engine.snapshot())
    const hero = snapshot.units.find((u) => u.side === 'player')!
    hero.hp = 0
    const f = forecast({ snapshot }, BASE, 8)
    expect(f.heroLost).toBe(8)
  })
})

describe('seeds', () => {
  function seedsOf(base: number): number[] {
    return Array.from({ length: FORECAST_SAMPLES }, (_, i) => forecastSeed(base, i))
  }

  it('are distinct 32-bit unsigned integers, none the battle seed or its streams', () => {
    const { engine } = battleUnderWay(4)
    const logBase = battleForecastBase(engine.getLog())
    for (const [base, battleSeed] of [
      [0, 0],
      [1, 1],
      [0xfffffff0, 0xfffffff0],
      [logBase, SEED],
    ]) {
      const seeds = seedsOf(base)
      expect(new Set(seeds).size).toBe(FORECAST_SAMPLES)
      for (const s of seeds) {
        expect(Number.isInteger(s)).toBe(true)
        expect(s).toBeGreaterThanOrEqual(0)
        expect(s).toBeLessThanOrEqual(0xffffffff)
        expect([battleSeed, battleSeed + 1, battleSeed + 2]).not.toContain(s)
      }
    }
  })

  it('a battle base changes as the log grows and is equal for equal logs', () => {
    const a = battleUnderWay(4).engine
    const b = battleUnderWay(4).engine
    expect(battleForecastBase(a.getLog())).toBe(battleForecastBase(b.getLog()))
    const grown = battleUnderWay(5).engine
    expect(grown.getLog().length).toBeGreaterThan(a.getLog().length)
    expect(battleForecastBase(grown.getLog())).not.toBe(battleForecastBase(a.getLog()))
    // Another seed, a log of the same length: another base.
    const length = a.getLog().length
    const other = battleUnderWay(8, SEED + 100).engine.getLog().slice(0, length)
    expect(other.length).toBe(length)
    expect(other[0]).toMatchObject({ type: 'battle_start', seed: SEED + 100 })
    expect(battleForecastBase(other)).not.toBe(battleForecastBase(a.getLog()))
  })

  it('a log with no battle_start reads its seed as 0', () => {
    const [start, second] = battleUnderWay(1).engine.getLog()
    expect(start.type).toBe('battle_start')
    expect(second.type).not.toBe('battle_start')
    const zero = battleForecastBase([{ ...start, seed: 0 } as BattleEvent])
    expect(battleForecastBase([second])).toBe(zero)
    expect(battleForecastBase([{ ...start, seed: null } as BattleEvent])).toBe(zero)
    expect(battleForecastBase([start])).not.toBe(zero)
  })

  it('a world base changes with the location, the party and the day; none equals a fixed battle seed', () => {
    const { game, location } = gameAtMonsters()
    const base = worldForecastStart(game, game.parties[0])!.base
    for (const s of seedsOf(base)) expect([SEED, SEED + 1, SEED + 2]).not.toContain(s)

    const otherParty = { ...game.parties[0], id: game.parties[0].id + 'x' }
    expect(worldForecastStart(game, otherParty)!.base).not.toBe(base)

    game.world.turn += 1
    expect(worldForecastStart(game, game.parties[0])!.base).not.toBe(base)
    game.world.turn -= 1
    expect(worldForecastStart(game, game.parties[0])!.base).toBe(base)

    const another = game.world.locations.find((l): l is MonsterLocation => l.kind === 'monsters' && l.id !== location.id)!
    game.parties[0].position = { ...another.position }
    expect(worldForecastStart(game, game.parties[0])!.base).not.toBe(base)
  })
})

describe('worldForecastStart', () => {
  it('is null where the party stands on no monster location', () => {
    const game = newGame(readyMadeParty(), null, 3)
    expect(worldForecastStart(game, game.parties[0])).toBeNull()
  })

  it('starts from the battle Attack would start, and changes nothing', () => {
    const { game, location } = gameAtMonsters()
    const before = structuredClone(game)
    const result = worldForecastStart(game, game.parties[0])!
    expect(result.start).toEqual({
      setup: ENCOUNTERS[location.encounter](partyFighters(game.parties[0].members), location.threat).setup,
    })
    expect(game).toEqual(before)
  })
})

describe('words', () => {
  const f = (wins: number, heroLost: number, stalled = 0): Forecast => ({ samples: 40, wins, heroLost, stalled })

  it('forecastFigure rounds to 5, clamps, and keeps the ends for all or none', () => {
    expect(forecastFigure(40, 40)).toBe('>95%')
    expect(forecastFigure(0, 40)).toBe('<5%')
    expect(forecastFigure(39, 40)).toBe('95%')
    expect(forecastFigure(1, 40)).toBe('5%')
    expect(forecastFigure(36, 40)).toBe('90%')
    expect(forecastFigure(20, 40)).toBe('50%')
    expect(forecastFigure(null, 40)).toBe('…')
  })

  it('forecastLabel, short and long', () => {
    expect(forecastLabel(f(36, 6), true)).toBe('Auto (90%)')
    expect(forecastLabel(null, true)).toBe('Auto (…)')
    expect(forecastLabel(f(36, 6), false)).toBe('Auto-resolve (win 90%)')
    expect(forecastLabel(null, false)).toBe('Auto-resolve (…)')
    expect(forecastLabel(f(40, 0), false)).toBe('Auto-resolve (win >95%)')
  })

  it('forecastHint', () => {
    expect(forecastHint(null)).toBe('Estimating how auto-resolve would go…')
    expect(forecastHint(f(36, 6))).toBe(
      'Estimate from 40 trial battles with the AI playing your side: it wins about 90% of them, and a hero dies in about 15%. Your own play may do better.',
    )
    expect(forecastHint(f(40, 0))).toBe(
      'Estimate from 40 trial battles with the AI playing your side: it wins over 95% of them, and a hero dies in under 5%. Your own play may do better.',
    )
    expect(forecastHint(f(30, 12, 3))).toBe(
      'Estimate from 40 trial battles with the AI playing your side: it wins about 75% of them, and a hero dies in about 30%; 3 of 40 drag on past 50 rounds. Your own play may do better.',
    )
  })
})

/**
 * The estimate fixture (long-campaign stage 10, step 07): estimates recorded
 * from the code before any speed-up, which every speed-up must leave
 * byte-identical. Each entry's `forecast` is `forecast(start, base, samples)`;
 * its `logs` is a sha256 of every sample's full event log, played again by
 * hand (`sampleByHand`'s rules), so a change to any roll, move or choice in
 * any sample shows even where the tally does not. Parties are the ready-made
 * three raised a level at a time along `planFor` (as debug `level n all auto`
 * and the simulator's `raisedParty`), their worn weapon, shield and armour
 * remade in the same family at the entry's tier (Fine above tier 1).
 *
 * Long-campaign stage 11, step 03: every `logs` digest re-recorded for the log
 * schema's bump to 27 and nothing else (each sample's `battle_start` writes
 * `schemaVersion`); play did not move: all 18 met the old digests with the
 * same code and the version held at 26, and no `forecast` tally changed.
 *
 * Long-campaign stage 11, step 13: the three `source_guardians` entries (threats
 * 10 and 20) re-recorded, and nothing else, for the Source at 20 (the Blight
 * Horror of native 20 and two cultists in place of five foes held at level 6):
 * their `logs`, and the level-18 tally, 4 wins of 4 before, none now.
 */
describe('the estimate fixture (stage 10 step 07)', () => {
  interface Entry {
    level: number
    tier: Tier
    encounter: EncounterId
    threat: number
    base: number
    samples: number
    /** Steps the real battle (seed `base`) takes before the snapshot the estimate starts from; none for a world-map start. */
    steps?: number
    /** Every foe's hit points raised to this, so that samples stall. */
    foeHp?: number
    forecast: Forecast
    logs: string
  }

  function partyAt(level: number, tier: Tier): Party {
    const party = readyMadeParty()
    for (const member of party) {
      while (member.level < level) {
        levelUp(member)
        autoAdvance(member, planFor(member))
      }
      if (tier === 1) continue
      for (const slot of ['mainHand', 'offHand', 'armor'] as const) {
        const worn = member.equipment[slot]
        if (!worn?.family) continue
        const kind = MATERIALS.find((m) => m.id === worn.material)!.kind
        const material = MATERIALS.find((m) => m.tier === tier && m.kind === kind)!
        member.equipment[slot] = itemById(`${material.id}_${worn.family}@2`)!
      }
      member.hp = maxHp(member)
    }
    return party
  }

  function startOf(entry: Entry): ForecastStart {
    const built = ENCOUNTERS[entry.encounter](partyFighters(partyAt(entry.level, entry.tier)), entry.threat).setup
    const setup: BattleSetup = entry.foeHp
      ? { ...built, units: built.units.map((u) => (u.side === 'enemy' ? { ...u, stats: { ...u.stats, maxHp: entry.foeHp! }, hp: entry.foeHp } : u)) }
      : built
    if (entry.steps === undefined) return { setup }
    const engine = new BattleEngine(setup, { seed: entry.base, meta: { source: 'test' } })
    const options = gameOptions(entry.base, AUTO_ROUND_LIMIT)
    for (let i = 0; i < entry.steps; i++) playStep(engine, options)
    return { snapshot: engine.snapshot() }
  }

  /** A sha256 of every sample's event log, in sample order. */
  function logsDigest(start: ForecastStart, base: number, samples: number): string {
    const hash = createHash('sha256')
    for (let i = 0; i < samples; i++) {
      const s = forecastSeed(base, i)
      const engine =
        'setup' in start
          ? new BattleEngine(start.setup, { seed: s, meta: { source: 'forecast' } })
          : BattleEngine.restore({ ...start.snapshot, rng: s })
      const firstRound = 'setup' in start ? 1 : start.snapshot.round
      playOut(engine, gameOptions(s, firstRound + AUTO_ROUND_LIMIT - 1))
      hash.update(JSON.stringify(engine.getLog()))
      hash.update('\n')
    }
    return hash.digest('hex')
  }

  const FIXTURE: Entry[] = [
    { level: 1, tier: 1, encounter: 'goblin_raid', threat: 1, base: 1000, samples: 40, forecast: { samples: 40, wins: 40, heroLost: 0, stalled: 0 },
      logs: 'b5a56057afd0fc781400fccf03d1faeb4b3dc6700bacd1dcef83c464991d2f3e' },
    { level: 1, tier: 1, encounter: 'kobold_scouts', threat: 3, base: 1001, samples: 12, forecast: { samples: 12, wins: 12, heroLost: 0, stalled: 0 },
      logs: 'df9c8d26f01f857bd74861b1befbde922fe2802d7d0e11cfcd301da5d801c022' },
    { level: 3, tier: 1, encounter: 'hobgoblin_warband', threat: 4, base: 1002, samples: 10, forecast: { samples: 10, wins: 8, heroLost: 4, stalled: 0 },
      logs: '7dc29ef4ac8b29e8f2f08ec47a7975979e30292596210dc413d00c388eb9b29d' },
    { level: 4, tier: 1, encounter: 'troll_lair', threat: 3, base: 1003, samples: 10, forecast: { samples: 10, wins: 10, heroLost: 0, stalled: 0 },
      logs: '5c34bcfb697e8bfa7cd2925245ceab88e63b8fc346d2971d7d3f6d636f6f66c3' },
    { level: 5, tier: 2, encounter: 'bandit_camp', threat: 5, base: 1004, samples: 8, forecast: { samples: 8, wins: 8, heroLost: 0, stalled: 0 },
      logs: '1f3260b0cb8e01e61718bddbbbeacdb510544b849ac2b506bd882d18fed34cb0' },
    { level: 6, tier: 2, encounter: 'spider_nest', threat: 6, base: 1005, samples: 8, forecast: { samples: 8, wins: 8, heroLost: 1, stalled: 0 },
      logs: '45745930d986c5867c5be49a400efb7859e53515a54aa330091619e6742ad2af' },
    { level: 8, tier: 2, encounter: 'salamander_pool', threat: 7, base: 1006, samples: 8, forecast: { samples: 8, wins: 8, heroLost: 0, stalled: 0 },
      logs: 'a1c1c4e13d8cd2eaa15ad4a5b4ed54acd739be87a475438385d20f4818dd04fd' },
    { level: 6, tier: 2, encounter: 'bandit_company', threat: 9, base: 1007, samples: 8, forecast: { samples: 8, wins: 0, heroLost: 8, stalled: 0 },
      logs: 'a21b8d0abaf21f3294d813ff5bd1a5138cb3f0e7e32f170e02d061ed1dc75fdc' },
    { level: 12, tier: 3, encounter: 'bandit_company', threat: 12, base: 1008, samples: 6, forecast: { samples: 6, wins: 1, heroLost: 6, stalled: 0 },
      logs: 'c2184c3642122b42567b6a55e9de8af31bb7d681cbb0d5c60f2e85c2fa6c31d8' },
    { level: 10, tier: 3, encounter: 'source_guardians', threat: 10, base: 1009, samples: 6, forecast: { samples: 6, wins: 0, heroLost: 6, stalled: 0 },
      logs: 'e8b90ffb0b69f1d8eaa5f3ab21640addec05d3410c38d023ab4c8a1bbdae1240' },
    { level: 15, tier: 4, encounter: 'freebooter_host', threat: 15, base: 1010, samples: 40, forecast: { samples: 40, wins: 19, heroLost: 26, stalled: 0 },
      logs: '1899c8b6bacec70820e822ed9d254e5631a1d011dbf0d5ba554142cfe1a6da18' },
    { level: 18, tier: 5, encounter: 'freebooter_host', threat: 18, base: 1011, samples: 6, forecast: { samples: 6, wins: 0, heroLost: 6, stalled: 0 },
      logs: '62b93396048b163933fee4426e62b4164f659435eaedb773e481e0306497abb2' },
    { level: 18, tier: 5, encounter: 'source_guardians', threat: 20, base: 1012, samples: 4, forecast: { samples: 4, wins: 0, heroLost: 4, stalled: 0 },
      logs: 'fc16161fa6aa1c637b232ee21db1c8c0f910c59630a22ebaf9afc8ff1f83519e' },
    { level: 15, tier: 4, encounter: 'freebooter_host', threat: 15, base: 1013, samples: 8, steps: 6, forecast: { samples: 8, wins: 5, heroLost: 4, stalled: 0 },
      logs: 'f9f5fec97d03d29047b70c01342fbee5f0b63acd5b5aeefa1bca3fb63969e45f' },
    { level: 6, tier: 2, encounter: 'spider_nest', threat: 6, base: 1014, samples: 8, steps: 15, forecast: { samples: 8, wins: 8, heroLost: 0, stalled: 0 },
      logs: '6abb5da718987b40fe4cde12639849a73d63e8645e343ce28e9d0f02d75dfc72' },
    { level: 4, tier: 1, encounter: 'troll_lair', threat: 3, base: 1015, samples: 8, steps: 20, forecast: { samples: 8, wins: 8, heroLost: 0, stalled: 0 },
      logs: '49c7933eca12cc83f84a31464e9a6978d42610ed5b384c6a1f7fa63eda33497d' },
    { level: 10, tier: 3, encounter: 'source_guardians', threat: 10, base: 1016, samples: 6, steps: 10, forecast: { samples: 6, wins: 0, heroLost: 6, stalled: 0 },
      logs: '13e7d4a737fcfc3e23bca3b853a911b7e3c0c6cd266047572f584f2ccbefe9ba' },
    { level: 10, tier: 1, encounter: 'goblin_raid', threat: 1, base: 1017, samples: 4, foeHp: 3000, forecast: { samples: 4, wins: 0, heroLost: 0, stalled: 4 },
      logs: 'e806d8aece4848177ca039836d308e0c654f1fbcd1cc1029b138a5f3b79e5c95' },
  ]

  it.each(FIXTURE.map((entry) => [`level ${entry.level}, tier ${entry.tier} vs ${entry.encounter} ${entry.threat}${entry.steps !== undefined ? `, ${entry.steps} steps in` : ''}${entry.foeHp ? ', foes unkillable' : ''}`, entry] as const))(
    '%s',
    (_name, entry) => {
      const start = startOf(entry)
      const base = 'snapshot' in start ? battleForecastBase(start.snapshot.events) : entry.base
      expect(forecast(start, base, entry.samples)).toEqual(entry.forecast)
      expect(logsDigest(start, base, entry.samples)).toBe(entry.logs)
    },
    60_000,
  )
})
