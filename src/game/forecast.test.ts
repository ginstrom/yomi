import { afterEach, describe, expect, it, vi } from 'vitest'
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
import { partyFighters, readyMadeParty } from './party.ts'
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
  const options = gameOptions(seed, 1 + AUTO_ROUND_LIMIT)
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
  const { over } = playOut(engine, gameOptions(s, firstRound + AUTO_ROUND_LIMIT))
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
  })

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
