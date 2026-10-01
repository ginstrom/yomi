import { resolveAttack, type CombatantStats, type RNG } from '../combat/combat.ts'

export type Side = 'player' | 'enemy'
export type Phase = Side | 'over'

export interface UnitSnapshot {
  side: Side
  name: string
  hp: number
  maxHp: number
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
  winner: Side
}

export type BattleEvent = BattleStartEvent | AttackEvent | EndTurnEvent | BattleEndEvent

const other = (side: Side): Side => (side === 'player' ? 'enemy' : 'player')

/**
 * Pure, Phaser-free battle simulation: turn order, attack resolution and a
 * structured event log. Scenes render it; scripts/simulate.ts drives it
 * headlessly for balancing. Both consume the same events, so manual play and
 * batch simulation always agree on what "a battle" means.
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

  constructor(stats: Record<Side, CombatantStats>, rng: RNG = Math.random) {
    this.stats = stats
    this.rng = rng
    this.hp = { player: stats.player.maxHp, enemy: stats.enemy.maxHp }
    this.record<BattleStartEvent>({
      type: 'battle_start',
      round: this.round,
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

  playerAttack(): BattleEvent[] {
    if (this.phase !== 'player') return []
    const events = this.attack('player')
    if (this.winner === null) this.phase = 'enemy'
    return events
  }

  playerEndTurn(): BattleEvent[] {
    if (this.phase !== 'player') return []
    this.phase = 'enemy'
    return [this.record<EndTurnEvent>({ type: 'end_turn', round: this.round, side: 'player' })]
  }

  enemyTurn(): BattleEvent[] {
    if (this.phase !== 'enemy') return []
    const events = this.attack('enemy')
    if (this.winner === null) {
      this.round += 1
      this.phase = 'player'
    }
    return events
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
      events.push(this.record<BattleEndEvent>({ type: 'battle_end', round: this.round, winner: side }))
    }

    return events
  }

  private snapshot(side: Side): UnitSnapshot {
    return { side, name: this.stats[side].name, hp: this.hp[side], maxHp: this.stats[side].maxHp }
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
      if (event.fumble) return `${attackerName} rolls 1 — fumbles the attack!`
      if (event.hit) {
        const crit = event.critical ? ' CRITICAL HIT!' : ''
        return `${attackerName} rolls ${event.attackRoll} (${event.totalToHit} to hit) — HITS ${defenderName} for ${event.damage} dmg.${crit}`
      }
      return `${attackerName} rolls ${event.attackRoll} (${event.totalToHit} to hit) — MISSES ${defenderName}.`
    }
    case 'end_turn':
      return `${names[event.side]} holds position and ends the turn.`
    case 'battle_end':
      return event.winner === 'player' ? `${names.enemy} falls. Victory!` : `${names.player} falls. Defeat...`
  }
}
