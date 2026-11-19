import { mulberry32 } from '../combat/rng.ts'
import { AUTO_POLICY, AUTO_ROUND_LIMIT, ENEMY_POLICY, playStep, type PlayOutOptions } from '../engine/autoPlay.ts'
import { BattleEngine, type BattleEvent, type BattleSetup, type BattleSnapshot } from '../engine/battleEngine.ts'
import { ENCOUNTERS } from './encounters.ts'
import type { Expedition } from './expedition.ts'
import type { GameState } from './gameState.ts'
import { partyFighters } from './party.ts'
import { monstersHere } from './worldMap.ts'

/**
 * The auto-resolve estimate: sample battles played headless with the AI on
 * both sides, each on a seed of its own hashed from the battle, worked one
 * engine step at a time so that a scene can run it in idle slices. It never
 * touches the real battle's engine or streams, the world's RNG or Math.random.
 */

/** Sample battles an estimate plays. */
export const FORECAST_SAMPLES = 40
/** The most time an estimate takes a frame, in ms. */
export const FORECAST_SLICE_MS = 10

/** Mixed into every sample seed, so that no sample shares a seed with the battle it estimates (distinct from `RUNE_LOOT_SALT`). */
const FORECAST_SALT = 0x464f5245

/** Where the samples start: a battle not yet begun (the world map) or one in progress. */
export type ForecastStart = { setup: BattleSetup } | { snapshot: BattleSnapshot }

export interface Forecast {
  samples: number
  /** Samples the player's side won. */
  wins: number
  /** Samples that ended with at least one player-side unit at hp <= 0. */
  heroLost: number
  /** Samples stopped past the round limit (counted as not won). */
  stalled: number
}

/** murmur3's finaliser: a bijection on 32-bit integers that spreads every bit. */
function fmix(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

/** A 32-bit unsigned hash of numbers, in order. */
function hashNumbers(...values: number[]): number {
  let h = FORECAST_SALT
  for (const value of values) h = fmix((h ^ value) + 0x9e3779b9)
  return h
}

/** FNV-1a of a string. */
function hashString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return h >>> 0
}

/** Sample `i`'s seed: a 32-bit unsigned hash of `base`, `i` and a fixed salt. */
export function forecastSeed(base: number, i: number): number {
  // fmix is a bijection, so distinct samples of one base always get distinct seeds.
  return fmix(hashNumbers(base) ^ i)
}

/** The base for a battle in progress: a hash of battle_start's seed (0 if none) and the log's length. */
export function battleForecastBase(log: readonly BattleEvent[]): number {
  const first = log[0]
  const seed = first?.type === 'battle_start' ? (first.seed ?? 0) : 0
  return hashNumbers(seed, log.length)
}

/** The battle Attack would start for `party` where it stands, and a hash of the location's id, the party's id and world.turn; null when it stands on no monster location. */
export function worldForecastStart(game: GameState, party: Expedition): { start: ForecastStart; base: number } | null {
  const location = monstersHere(game.world, party)
  if (!location) return null
  const setup = ENCOUNTERS[location.encounter](partyFighters(party.members), location.threat).setup
  return { start: { setup }, base: hashNumbers(hashString(location.id), hashString(party.id), game.world.turn) }
}

/** An estimate worked one engine step at a time. */
export class Forecaster {
  private readonly start: ForecastStart
  private readonly base: number
  private readonly tally: Forecast
  /** The sample being played, or null between samples. */
  private engine: BattleEngine | null = null
  private options: PlayOutOptions | null = null
  private next = 0

  constructor(start: ForecastStart, base: number, samples = FORECAST_SAMPLES) {
    this.start = start
    this.base = base
    this.tally = { samples, wins: 0, heroLost: 0, stalled: 0 }
  }

  /** Takes one engine step, beginning the next sample as one ends; the forecast once all are done (and on every call after), else null. */
  step(): Forecast | null {
    for (;;) {
      if (!this.engine || !this.options) {
        if (this.next >= this.tally.samples) return { ...this.tally }
        this.begin(this.next++)
      }
      if (playStep(this.engine!, this.options!)) return null
      this.record(this.engine!)
      this.engine = null
      this.options = null
    }
  }

  private begin(i: number): void {
    const s = forecastSeed(this.base, i)
    const { start } = this
    // restore clones what it is given, so a sample never writes into the caller's snapshot.
    this.engine =
      'setup' in start
        ? new BattleEngine(start.setup, { seed: s, meta: { source: 'forecast' } })
        : BattleEngine.restore({ ...start.snapshot, rng: s })
    const firstRound = 'setup' in start ? 1 : start.snapshot.round
    this.options = {
      policies: { player: AUTO_POLICY, enemy: ENEMY_POLICY },
      rngs: { enemy: mulberry32(s + 1), player: mulberry32(s + 2) },
      lastRound: firstRound + AUTO_ROUND_LIMIT,
    }
  }

  private record(engine: BattleEngine): void {
    const state = engine.getState()
    if (state.winner === 'player') this.tally.wins++
    if (state.units.some((u) => u.side === 'player' && u.hp <= 0)) this.tally.heroLost++
    if (state.phase !== 'over') this.tally.stalled++
  }
}

/** Steps `forecaster` until it is done or `budgetMs` has passed by `now` (default performance.now). */
export function workFor(forecaster: Forecaster, budgetMs: number, now: () => number = () => performance.now()): Forecast | null {
  const until = now() + budgetMs
  for (;;) {
    const result = forecaster.step()
    if (result || now() >= until) return result
  }
}

/** Runs an estimate to its end at once (tests, tools). */
export function forecast(start: ForecastStart, base: number, samples?: number): Forecast {
  const forecaster = new Forecaster(start, base, samples)
  for (;;) {
    const result = forecaster.step()
    if (result) return result
  }
}

/** "90%" (share/of rounded to the nearest 5, clamped to 5..95), ">95%" when share === of, "<5%" when share === 0, "…" for null. */
export function forecastFigure(share: number | null, of: number): string {
  if (share === null) return '…'
  if (share >= of) return '>95%'
  if (share <= 0) return '<5%'
  const percent = Math.round((share / of) * 20) * 5
  return `${Math.min(95, Math.max(5, percent))}%`
}

/** short: "Auto (90%)" / "Auto (…)"; long: "Auto-resolve (win 90%)" / "Auto-resolve (…)". */
export function forecastLabel(forecast: Forecast | null, short: boolean): string {
  const figure = forecastFigure(forecast?.wins ?? null, forecast?.samples ?? 0)
  if (short) return `Auto (${figure})`
  return forecast ? `Auto-resolve (win ${figure})` : `Auto-resolve (${figure})`
}

/** The hint line; "Estimating how auto-resolve would go…" for null. */
export function forecastHint(forecast: Forecast | null): string {
  if (!forecast) return 'Estimating how auto-resolve would go…'
  const f = forecast
  const about = (n: number): string => {
    const figure = forecastFigure(n, f.samples)
    if (figure === '>95%') return 'over 95%'
    if (figure === '<5%') return 'under 5%'
    return `about ${figure}`
  }
  const drag = f.stalled > 0 ? `; ${f.stalled} of ${f.samples} drag on past ${AUTO_ROUND_LIMIT} rounds` : ''
  return `Estimate from ${f.samples} trial battles with the AI playing your side: it wins ${about(f.wins)} of them, and a hero dies in ${about(f.heroLost)}${drag}. Your own play may do better.`
}
