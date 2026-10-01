import { resolveAttack, type CombatantStats, type RNG } from '../combat/combat.ts'
import { mulberry32, randomSeed } from '../combat/rng.ts'
import { HexBoard, hexDistance, hexEquals, hexKey, reachableHexes, type BoardSize, type Hex } from '../grid/hex.ts'

/** Bump when event shapes change so log consumers can tell formats apart. */
export const LOG_SCHEMA_VERSION = 4

export type Side = 'player' | 'enemy'
export type Phase = Side | 'over'
export type UnitId = string

export type Action = { type: 'move'; to: Hex } | { type: 'attack'; target: UnitId } | { type: 'end_turn' }

/** A unit entering battle. Roster order within a side is turn order. */
export interface UnitSetup {
  id: UnitId
  side: Side
  stats: CombatantStats
  position: Hex
  /** Lets a unit enter battle already wounded; defaults to (and is capped at) maxHp. */
  hp?: number
}

/** Everything a battle starts from: the board and who stands where. */
export interface BattleSetup {
  board: BoardSize
  units: readonly UnitSetup[]
}

/** Everything an agent may observe about a unit: its full stat block plus current HP. */
export interface UnitSnapshot extends CombatantStats {
  id: UnitId
  side: Side
  hp: number
  position: Hex
}

export interface BattleState {
  round: number
  phase: Phase
  /** The unit whose turn it is; null once the battle is over. */
  active: UnitId | null
  /** Whether the active unit has already moved this turn (a unit moves at most once, before attacking). */
  activeHasMoved: boolean
  /** Every unit in roster order, including fallen ones (hp 0). */
  units: UnitSnapshot[]
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
  board: BoardSize
  units: UnitSnapshot[]
}

export interface MoveEvent extends EventBase {
  type: 'move'
  unit: UnitId
  from: Hex
  to: Hex
  /** Every hex stepped through after `from`, ending at `to`. */
  path: Hex[]
}

export interface AttackEvent extends EventBase {
  type: 'attack'
  attacker: UnitId
  defender: UnitId
  attackRoll: number
  totalToHit: number
  hit: boolean
  critical: boolean
  fumble: boolean
  damage: number
  defenderHpAfter: number
}

export interface UnitDownEvent extends EventBase {
  type: 'unit_down'
  unit: UnitId
}

export interface EndTurnEvent extends EventBase {
  type: 'end_turn'
  unit: UnitId
}

export interface BattleEndEvent extends EventBase {
  type: 'battle_end'
  /** null when the battle was abandoned before a side fell. */
  winner: Side | null
  reason: 'defeat' | 'abandoned'
}

export type BattleEvent = BattleStartEvent | MoveEvent | AttackEvent | UnitDownEvent | EndTurnEvent | BattleEndEvent

export interface BattleOptions {
  /** Seed for the built-in RNG; a random one is chosen (and logged) if omitted. */
  seed?: number
  /** Overrides the seeded RNG entirely, e.g. scripted rolls in tests. */
  rng?: RNG
  meta?: Record<string, unknown>
}

interface UnitRecord {
  id: UnitId
  side: Side
  stats: CombatantStats
  hp: number
  position: Hex
}

const other = (side: Side): Side => (side === 'player' ? 'enemy' : 'player')

/**
 * Pure, Phaser-free battle rules on a hex board: turn order, movement, attack
 * resolution and a structured event log. Sides alternate phases, starting
 * with the player; within a phase each standing unit takes one turn in roster
 * order. A turn is an optional move of up to `speed` hexes, then either an
 * attack on an adjacent foe or end_turn — attacking ends the turn. Whoever is
 * active acts via step(), so the UI, scripted policies and AI agents all drive
 * it the same way. Given the seed in battle_start and the actions in the log,
 * a battle replays exactly.
 */
export class BattleEngine {
  private seq = 0
  private round = 1
  private phase: Phase = 'player'
  private activeIndex: number
  private activeHasMoved = false
  private winner: Side | null = null
  private readonly board: HexBoard
  private readonly units: UnitRecord[]
  private readonly events: BattleEvent[] = []
  private readonly rng: RNG

  constructor(setup: BattleSetup, options: BattleOptions = {}) {
    const roster = setup.units
    this.board = new HexBoard(setup.board)
    const ids = new Set(roster.map((u) => u.id))
    if (ids.size !== roster.length) throw new Error('Unit ids must be unique')
    for (const side of ['player', 'enemy'] as const) {
      if (!roster.some((u) => u.side === side)) throw new Error(`No ${side} units in the roster`)
    }
    for (const u of roster) {
      if (!this.board.contains(u.position)) throw new Error(`${u.id} starts off the board`)
    }
    if (new Set(roster.map((u) => hexKey(u.position))).size !== roster.length) {
      throw new Error('Units must start on different hexes')
    }
    this.units = roster.map((u) => ({
      id: u.id,
      side: u.side,
      stats: u.stats,
      hp: Math.max(0, Math.min(u.hp ?? u.stats.maxHp, u.stats.maxHp)),
      position: u.position,
    }))

    let seed: number | null = null
    if (options.rng) {
      this.rng = options.rng
    } else {
      seed = options.seed ?? randomSeed()
      this.rng = mulberry32(seed)
    }

    this.record<BattleStartEvent>({
      type: 'battle_start',
      round: this.round,
      schemaVersion: LOG_SCHEMA_VERSION,
      seed,
      meta: options.meta ?? {},
      board: setup.board,
      units: this.units.map(snapshot),
    })

    // A side may enter battle already fallen (e.g. every member at 0 hp).
    this.activeIndex = -1
    if (!this.checkWinner()) this.advance()
  }

  getState(): BattleState {
    return {
      round: this.round,
      phase: this.phase,
      active: this.phase === 'over' ? null : this.units[this.activeIndex].id,
      activeHasMoved: this.activeHasMoved,
      units: this.units.map(snapshot),
      winner: this.winner,
    }
  }

  getLog(): readonly BattleEvent[] {
    return this.events
  }

  /**
   * Actions available to the active unit: a move to each reachable hex (if it
   * hasn't moved yet), an attack on each adjacent standing foe, and end_turn.
   * Empty once the battle is over.
   */
  legalActions(): Action[] {
    if (this.phase === 'over') return []
    const actor = this.units[this.activeIndex]
    const moves: Action[] = this.activeHasMoved
      ? []
      : [...this.reachable(actor).values()].map((path) => ({ type: 'move', to: path[path.length - 1] }))
    const attacks: Action[] = this.units
      .filter((u) => u.side !== actor.side && u.hp > 0 && hexDistance(u.position, actor.position) === 1)
      .map((u) => ({ type: 'attack', target: u.id }))
    return [...moves, ...attacks, { type: 'end_turn' }]
  }

  /** Performs an action for the active unit. Throws if the battle is over or the action is illegal. */
  step(action: Action): BattleEvent[] {
    if (this.phase === 'over') throw new Error(`Cannot ${action.type}: the battle is over`)
    const actor = this.units[this.activeIndex]

    if (action.type === 'move') return [this.move(actor, action.to)]

    let events: BattleEvent[]
    if (action.type === 'attack') {
      const target = this.units.find((u) => u.id === action.target)
      if (
        !target ||
        target.side === actor.side ||
        target.hp <= 0 ||
        hexDistance(target.position, actor.position) !== 1
      ) {
        throw new Error(`${actor.id} cannot attack ${action.target}`)
      }
      events = this.attack(actor, target)
    } else {
      events = [this.record<EndTurnEvent>({ type: 'end_turn', round: this.round, unit: actor.id })]
    }

    if (this.winner === null) this.advance()
    return events
  }

  /** Ends an unfinished battle (e.g. the player quit) so its log is still complete. */
  abandon(): BattleEvent[] {
    if (this.phase === 'over') return []
    this.phase = 'over'
    return [this.record<BattleEndEvent>({ type: 'battle_end', round: this.round, winner: null, reason: 'abandoned' })]
  }

  /** Moving doesn't end the turn: the unit may still attack or end it. */
  private move(actor: UnitRecord, to: Hex): MoveEvent {
    if (this.activeHasMoved) throw new Error(`${actor.id} has already moved this turn`)
    const path = this.reachable(actor).get(hexKey(to))
    if (!path) throw new Error(`${actor.id} cannot move to ${hexKey(to)}`)
    const from = actor.position
    actor.position = to
    this.activeHasMoved = true
    return this.record<MoveEvent>({ type: 'move', round: this.round, unit: actor.id, from, to, path })
  }

  /** Hexes the unit can move to this turn: on the board, within its speed, around standing units. */
  private reachable(actor: UnitRecord): Map<string, Hex[]> {
    const blocked = (h: Hex) => this.units.some((u) => u !== actor && u.hp > 0 && hexEquals(u.position, h))
    return reachableHexes(actor.position, actor.stats.speed, (h) => this.board.contains(h) && !blocked(h))
  }

  private attack(actor: UnitRecord, target: UnitRecord): BattleEvent[] {
    const result = resolveAttack(actor.stats, target.stats.ac, this.rng)
    target.hp = Math.max(0, target.hp - result.damage)

    const events: BattleEvent[] = [
      this.record<AttackEvent>({
        type: 'attack',
        round: this.round,
        attacker: actor.id,
        defender: target.id,
        attackRoll: result.attackRoll,
        totalToHit: result.totalToHit,
        hit: result.hit,
        critical: result.critical,
        fumble: result.fumble,
        damage: result.damage,
        defenderHpAfter: target.hp,
      }),
    ]

    if (target.hp <= 0) {
      events.push(this.record<UnitDownEvent>({ type: 'unit_down', round: this.round, unit: target.id }))
      const end = this.checkWinner()
      if (end) events.push(end)
    }
    return events
  }

  /** Ends the battle if a side has no standing units, returning the battle_end event. */
  private checkWinner(): BattleEndEvent | null {
    for (const side of ['player', 'enemy'] as const) {
      if (this.units.some((u) => u.side === side && u.hp > 0)) continue
      this.winner = other(side)
      this.phase = 'over'
      return this.record<BattleEndEvent>({
        type: 'battle_end',
        round: this.round,
        winner: this.winner,
        reason: 'defeat',
      })
    }
    return null
  }

  /** Hands the turn to the next standing unit of the current side, else to the other side. */
  private advance(): void {
    this.activeHasMoved = false
    const side = this.phase as Side
    const next = this.units.findIndex((u, i) => i > this.activeIndex && u.side === side && u.hp > 0)
    if (next !== -1) {
      this.activeIndex = next
      return
    }
    if (side === 'enemy') this.round += 1
    this.phase = other(side)
    // Each side has a standing unit here, or checkWinner would have ended the battle.
    this.activeIndex = this.units.findIndex((u) => u.side === this.phase && u.hp > 0)
  }

  private record<E extends BattleEvent>(event: Omit<E, 'seq'>): E {
    const full = { ...event, seq: this.seq++ } as E
    this.events.push(full)
    return full
  }
}

function snapshot(unit: UnitRecord): UnitSnapshot {
  return { ...unit.stats, id: unit.id, side: unit.side, hp: unit.hp, position: unit.position }
}

/** Joins names as "A", "A and B", "A, B and C". */
function listNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Renders an event as the human-readable line BattleScene pushes to its log. */
export function formatEvent(event: BattleEvent, names: Readonly<Record<UnitId, string>>): string {
  switch (event.type) {
    case 'battle_start': {
      const sideNames = (side: Side) => listNames(event.units.filter((u) => u.side === side).map((u) => names[u.id]))
      const enemies = event.units.filter((u) => u.side === 'enemy').length
      return `${sideNames('enemy')} ${enemies === 1 ? 'blocks' : 'block'} ${sideNames('player')}'s path. Battle begins!`
    }
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
    case 'move': {
      const steps = event.path.length
      return `${names[event.unit]} moves ${steps} ${steps === 1 ? 'hex' : 'hexes'}.`
    }
    case 'unit_down':
      return `${names[event.unit]} falls.`
    case 'end_turn':
      return `${names[event.unit]} holds position and ends the turn.`
    case 'battle_end':
      if (event.winner === null) return 'The battle is abandoned.'
      return event.winner === 'player' ? 'Victory!' : 'Defeat...'
  }
}
