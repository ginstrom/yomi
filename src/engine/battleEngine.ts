import { resolveAttack, type CombatantStats, type RNG } from '../combat/combat.ts'
import { mulberry32, randomSeed } from '../combat/rng.ts'

/** Bump when event shapes change so log consumers can tell formats apart. */
export const LOG_SCHEMA_VERSION = 2

export type Side = 'player' | 'enemy'
export type Phase = Side | 'over'

export type Action = { type: 'attack' } | { type: 'end_turn' }

/** Everything an agent may observe about a unit: its full stat block plus current HP. */
export interface UnitSnapshot extends CombatantStats {
  side: Side
  hp: number
}

export interface BattleState {
  round: number
  phase: Phase
  player: UnitSnapshot
  enemy: UnitSnapshot
  winner: Side | null
}

interface EventBase {
  seq: number
  round: number
}

export interface BattleStartEvent extends EventBase {
  type: 'battle_start'
  schemaVersion: number
  /** Seed of the engine's RNG; null when the caller injected its own RNG. */
  seed: number | null
  /** Free-form caller context (policies, source, build...) for log analysis. */
  meta: Record<string, unknown>
  player: UnitSnapshot
  enemy: UnitSnapshot
}

export interface AttackEvent extends EventBase {
  type: 'attack'
  attacker: Side
  defender: Side
  attackRoll: number
  totalToHit: number
  hit: boolean
  critical: boolean
  fumble: boolean
  damage: number
  defenderHpAfter: number
}

export interface EndTurnEvent extends EventBase {
  type: 'end_turn'
  side: Side
}

export interface BattleEndEvent extends EventBase {
  type: 'battle_end'
  /** null when the battle was abandoned before anyone fell. */
  winner: Side | null
  reason: 'defeat' | 'abandoned'
}

export type BattleEvent = BattleStartEvent | AttackEvent | EndTurnEvent | BattleEndEvent

export interface BattleOptions {
  /** Seed for the built-in RNG; a random one is chosen (and logged) if omitted. */
  seed?: number
  /** Overrides the seeded RNG entirely, e.g. scripted rolls in tests. */
  rng?: RNG
  /** Lets a unit enter battle already wounded; defaults to maxHp. */
  startHp?: Partial<Record<Side, number>>
  meta?: Record<string, unknown>
}

const ALL_ACTIONS: readonly Action[] = [{ type: 'attack' }, { type: 'end_turn' }]

const other = (side: Side): Side => (side === 'player' ? 'enemy' : 'player')

/**
 * Pure, Phaser-free battle rules: turn order, attack resolution and a
 * structured event log. It's side-agnostic — whoever's phase it is acts via
 * step(), so the UI, scripted policies and AI agents all drive it the same
 * way. Given the seed in battle_start and the actions in the log, a battle
 * replays exactly.
 */
export class BattleEngine {
  private seq = 0
  private round = 1
  private phase: Phase = 'player'
  private hp: Record<Side, number>
  private winner: Side | null = null
  private readonly events: BattleEvent[] = []
  private readonly stats: Record<Side, CombatantStats>
  private readonly rng: RNG

  constructor(stats: Record<Side, CombatantStats>, options: BattleOptions = {}) {
    this.stats = stats
    let seed: number | null = null
    if (options.rng) {
      this.rng = options.rng
    } else {
      seed = options.seed ?? randomSeed()
      this.rng = mulberry32(seed)
    }
    const startHp = options.startHp ?? {}
    const initialHp = (side: Side) => Math.min(startHp[side] ?? stats[side].maxHp, stats[side].maxHp)
    this.hp = { player: initialHp('player'), enemy: initialHp('enemy') }
    this.record<BattleStartEvent>({
      type: 'battle_start',
      round: this.round,
      schemaVersion: LOG_SCHEMA_VERSION,
      seed,
      meta: options.meta ?? {},
      player: this.snapshot('player'),
      enemy: this.snapshot('enemy'),
    })
  }

  getState(): BattleState {
    return {
      round: this.round,
      phase: this.phase,
      player: this.snapshot('player'),
      enemy: this.snapshot('enemy'),
      winner: this.winner,
    }
  }

  getLog(): readonly BattleEvent[] {
    return this.events
  }

  /** Actions available to the side whose phase it is; empty once the battle is over. */
  legalActions(): readonly Action[] {
    return this.phase === 'over' ? [] : ALL_ACTIONS
  }

  /** Performs an action for the side whose phase it is. Throws if the battle is over. */
  step(action: Action): BattleEvent[] {
    const side = this.phase
    if (side === 'over') throw new Error(`Cannot ${action.type}: the battle is over`)

    const events =
      action.type === 'attack'
        ? this.attack(side)
        : [this.record<EndTurnEvent>({ type: 'end_turn', round: this.round, side })]

    if (this.winner === null) {
      if (side === 'enemy') this.round += 1
      this.phase = other(side)
    }
    return events
  }

  /** Ends an unfinished battle (e.g. the player quit) so its log is still complete. */
  abandon(): BattleEvent[] {
    if (this.phase === 'over') return []
    this.phase = 'over'
    return [this.record<BattleEndEvent>({ type: 'battle_end', round: this.round, winner: null, reason: 'abandoned' })]
  }

  private attack(side: Side): BattleEvent[] {
    const defender = other(side)
    const result = resolveAttack(this.stats[side], this.stats[defender].ac, this.rng)
    this.hp[defender] = Math.max(0, this.hp[defender] - result.damage)

    const events: BattleEvent[] = [
      this.record<AttackEvent>({
        type: 'attack',
        round: this.round,
        attacker: side,
        defender,
        attackRoll: result.attackRoll,
        totalToHit: result.totalToHit,
        hit: result.hit,
        critical: result.critical,
        fumble: result.fumble,
        damage: result.damage,
        defenderHpAfter: this.hp[defender],
      }),
    ]

    if (this.hp[defender] <= 0) {
      this.winner = side
      this.phase = 'over'
      events.push(
        this.record<BattleEndEvent>({ type: 'battle_end', round: this.round, winner: side, reason: 'defeat' }),
      )
    }

    return events
  }

  private snapshot(side: Side): UnitSnapshot {
    return { ...this.stats[side], side, hp: this.hp[side] }
  }

  private record<E extends BattleEvent>(event: Omit<E, 'seq'>): E {
    const full = { ...event, seq: this.seq++ } as E
    this.events.push(full)
    return full
  }
}

/** Renders an event as the human-readable line BattleScene pushes to its log. */
export function formatEvent(event: BattleEvent, names: Record<Side, string>): string {
  switch (event.type) {
    case 'battle_start':
      return `${names.enemy} blocks ${names.player}'s path. Battle begins!`
    case 'attack': {
      const attackerName = names[event.attacker]
      const defenderName = names[event.defender]
      if (event.fumble) return `${attackerName} rolls ${event.attackRoll} — fumbles the attack!`
      if (event.hit) {
        const crit = event.critical ? ' CRITICAL HIT!' : ''
        return `${attackerName} rolls ${event.attackRoll} (${event.totalToHit} to hit) — HITS ${defenderName} for ${event.damage} dmg.${crit}`
      }
      return `${attackerName} rolls ${event.attackRoll} (${event.totalToHit} to hit) — MISSES ${defenderName}.`
    }
    case 'end_turn':
      return `${names[event.side]} holds position and ends the turn.`
    case 'battle_end':
      if (event.winner === null) return 'The battle is abandoned.'
      return event.winner === 'player' ? `${names.enemy} falls. Victory!` : `${names.player} falls. Defeat...`
  }
}
