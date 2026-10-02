import { hitChance, resolveAttack, type CombatantStats, type RNG } from '../combat/combat.ts'
import { mulberry32, randomSeed } from '../combat/rng.ts'
import {
  HexBoard,
  hexDirection,
  hexDistance,
  hexEquals,
  hexKey,
  reachableHexes,
  type BoardSize,
  type Hex,
} from '../grid/hex.ts'

/** Bump when event shapes change so log consumers can tell formats apart. */
export const LOG_SCHEMA_VERSION = 7

/** To-hit bonus an attacker gains for each other standing ally adjacent to the defender. */
export const FLANK_BONUS_PER_ALLY = 2

/**
 * Which way a defender is struck from, relative to its facing: its three
 * front hexes, the two beside its back, or straight behind it.
 */
export type Arc = 'front' | 'side' | 'rear'

/** To-hit bonus for striking a defender in each arc. */
export const ARC_BONUS: Readonly<Record<Arc, number>> = { front: 0, side: 1, rear: 2 }

/** Where units face before they first move or attack: towards the other side's starting edge. */
export const DEFAULT_FACING: Readonly<Record<Side, number>> = { player: 0, enemy: 3 } // east, west

/** Action points an attack costs. */
export const ATTACK_AP_COST = 2

/** Action points a move of `steps` hexes costs: one per `speed` hexes or part thereof. */
export function moveApCost(steps: number, speed: number): number {
  return Math.ceil(steps / speed)
}

export type Side = 'player' | 'enemy'
export type Phase = Side | 'over'
export type UnitId = string

/** Moves and attacks name the acting unit; end_turn ends the whole side's turn. */
export type Action =
  | { type: 'move'; unit: UnitId; to: Hex }
  | { type: 'attack'; unit: UnitId; target: UnitId }
  | { type: 'end_turn' }

/** A unit entering battle. Roster order is the order legal actions are listed in. */
export interface UnitSetup {
  id: UnitId
  side: Side
  stats: CombatantStats
  position: Hex
  /** Index into HEX_DIRECTIONS; defaults to DEFAULT_FACING for the unit's side. */
  facing?: number
  /** Lets a unit enter battle already wounded; defaults to (and is capped at) maxHp. */
  hp?: number
}

/** Everything a battle starts from: the board and who stands where. */
export interface BattleSetup {
  board: BoardSize
  units: readonly UnitSetup[]
}

/** Everything an agent may observe about a unit: its full stat block plus its current condition. */
export interface UnitSnapshot extends CombatantStats {
  id: UnitId
  side: Side
  hp: number
  position: Hex
  /**
   * The way the unit faces, as an index into HEX_DIRECTIONS. It turns
   * automatically: towards each step it takes and each foe it attacks.
   */
  facing: number
  /** Action points left this turn; refilled when the unit's side starts its turn. */
  ap: number
  /** Whether the unit can still make a free attack this enemy turn. */
  reactionReady: boolean
}

export interface BattleState {
  round: number
  /** The side taking its turn, or 'over'. */
  phase: Phase
  /** Every unit in roster order, including fallen ones (hp 0). */
  units: UnitSnapshot[]
  winner: Side | null
}

/** What a move to a hex would involve, for UIs and agents to weigh before committing. */
export interface MovePreview {
  path: Hex[]
  apCost: number
  /** Foes whose free attacks the move would provoke, in the order they'd strike. */
  provokes: UnitId[]
}

/** What an attack would involve before the dice are rolled. */
export interface AttackPreview {
  flankers: UnitId[]
  flankBonus: number
  arc: Arc
  arcBonus: number
  /** Probability of a hit, natural 1s and 20s included. */
  hitChance: number
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

/**
 * A stretch of movement. A move that provokes free attacks is logged in
 * segments, split where the attacks land; the first segment carries the
 * action's AP cost (later ones 0) and may be empty if the mover is struck
 * before its first step. Every segment names the requested destination.
 */
export interface MoveEvent extends EventBase {
  type: 'move'
  unit: UnitId
  from: Hex
  to: Hex
  /** Every hex stepped through after `from`, ending at `to`. */
  path: Hex[]
  destination: Hex
  apCost: number
  /** The mover's facing at the end of the segment: towards its last step, or its next one if it hasn't moved yet. */
  facing: number
}

export interface AttackEvent extends EventBase {
  type: 'attack'
  attacker: UnitId
  defender: UnitId
  /** A free attack provoked by the defender leaving the attacker's zone of control; costs no AP. */
  opportunity: boolean
  /** The attacker's standing allies adjacent to the defender when the attack was made. */
  flankers: UnitId[]
  /** To-hit bonus from flankers, already included in totalToHit. */
  flankBonus: number
  /** Which of the defender's arcs the attack came from, given the defender's facing. */
  arc: Arc
  /** To-hit bonus from the arc, already included in totalToHit. */
  arcBonus: number
  /** The attacker's facing after turning to strike. */
  attackerFacing: number
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
  side: Side
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
  facing: number
  ap: number
  reactionReady: boolean
}

const other = (side: Side): Side => (side === 'player' ? 'enemy' : 'player')

/** The minimum a unit needs for positional rules; both engine records and snapshots qualify. */
type Placed = Pick<UnitSnapshot, 'id' | 'side' | 'hp' | 'position'>

/**
 * The attacker's standing allies adjacent to the defender, in roster order:
 * each one helps surround the defender and grants FLANK_BONUS_PER_ALLY.
 */
export function flankersOf(units: readonly Placed[], attacker: Placed, defender: Placed): UnitId[] {
  return units
    .filter(
      (u) =>
        u.id !== attacker.id &&
        u.side === attacker.side &&
        u.hp > 0 &&
        hexDistance(u.position, defender.position) === 1,
    )
    .map((u) => u.id)
}

/** The arc of `defender` that an attack from the neighbouring hex `from` strikes. */
export function attackArc(defender: Pick<UnitSnapshot, 'position' | 'facing'>, from: Hex): Arc {
  const direction = hexDirection(defender.position, from)
  if (direction === null) throw new Error('Attacks come from a neighbouring hex')
  // Steps clockwise or counter-clockwise from straight ahead: 0, 1, 2 or 3.
  const turn = (direction - defender.facing + 6) % 6
  const away = Math.min(turn, 6 - turn)
  return away <= 1 ? 'front' : away === 2 ? 'side' : 'rear'
}

/**
 * Pure, Phaser-free battle rules on a hex board: turns, action points,
 * movement, zones of control, attack resolution and a structured event log.
 *
 * Sides alternate turns, starting with the player. At the start of its
 * side's turn each standing unit gets its action points, and the side's
 * units then act in any order — moving (one AP per `speed` hexes) and
 * attacking adjacent foes (ATTACK_AP_COST) — until the side ends its turn.
 * An attack gains a to-hit bonus for each other ally adjacent to the
 * defender, and another for striking the defender's side or rear: units
 * face the way they last stepped or struck. Every standing unit exerts a zone of control over its
 * neighbouring hexes: a foe stepping out of one provokes a free attack, at
 * most one per unit per enemy turn.
 *
 * The UI, scripted policies and AI agents all drive it through step(). Given
 * the seed in battle_start and the actions in the log, a battle replays exactly.
 */
export class BattleEngine {
  private seq = 0
  private round = 1
  private phase: Phase = 'player'
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
      facing: u.facing ?? DEFAULT_FACING[u.side],
      ap: 0,
      reactionReady: false,
    }))

    let seed: number | null = null
    if (options.rng) {
      this.rng = options.rng
    } else {
      seed = options.seed ?? randomSeed()
      this.rng = mulberry32(seed)
    }

    this.startTurn('player')
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
    this.checkWinner()
  }

  getState(): BattleState {
    return {
      round: this.round,
      phase: this.phase,
      units: this.units.map(snapshot),
      winner: this.winner,
    }
  }

  getLog(): readonly BattleEvent[] {
    return this.events
  }

  /**
   * Actions available to the side whose turn it is (or, given `unit`, just to
   * that unit): for each of its standing units in roster order, a move to each
   * hex its AP can reach and an attack on each adjacent standing foe if it can
   * afford one; then end_turn. Empty once the battle is over.
   */
  legalActions(unit?: UnitId): Action[] {
    if (this.phase === 'over') return []
    const actions: Action[] = []
    for (const actor of this.units) {
      if (!this.canAct(actor) || (unit !== undefined && actor.id !== unit)) continue
      for (const path of this.reachable(actor).values()) {
        actions.push({ type: 'move', unit: actor.id, to: path[path.length - 1] })
      }
      if (actor.ap < ATTACK_AP_COST) continue
      for (const foe of this.units) {
        if (this.canAttack(actor, foe)) actions.push({ type: 'attack', unit: actor.id, target: foe.id })
      }
    }
    actions.push({ type: 'end_turn' })
    return actions
  }

  /** The path, AP cost and provoked foes of a legal move, or null if the move isn't legal now. */
  previewMove(unit: UnitId, to: Hex): MovePreview | null {
    const actor = this.units.find((u) => u.id === unit)
    if (this.phase === 'over' || !actor || !this.canAct(actor)) return null
    const path = this.reachable(actor).get(hexKey(to))
    if (!path) return null
    const provokes: UnitId[] = []
    let at = actor.position
    for (const step of path) {
      for (const foe of this.reactorsAt(actor, at)) if (!provokes.includes(foe.id)) provokes.push(foe.id)
      at = step
    }
    return { path, apCost: moveApCost(path.length, actor.stats.speed), provokes }
  }

  /** Flanking and odds of a legal attack, or null if the attack isn't legal now. */
  previewAttack(unit: UnitId, target: UnitId): AttackPreview | null {
    const actor = this.units.find((u) => u.id === unit)
    const foe = this.units.find((u) => u.id === target)
    if (this.phase === 'over' || !actor || !foe || !this.canAct(actor)) return null
    if (actor.ap < ATTACK_AP_COST || !this.canAttack(actor, foe)) return null
    const flankers = flankersOf(this.units, actor, foe)
    const flankBonus = flankers.length * FLANK_BONUS_PER_ALLY
    const arc = attackArc(foe, actor.position)
    const arcBonus = ARC_BONUS[arc]
    const chance = hitChance(actor.stats, foe.stats.ac, flankBonus + arcBonus)
    return { flankers, flankBonus, arc, arcBonus, hitChance: chance }
  }

  /** Performs an action for the side whose turn it is. Throws if the battle is over or the action is illegal. */
  step(action: Action): BattleEvent[] {
    if (this.phase === 'over') throw new Error(`Cannot ${action.type}: the battle is over`)

    if (action.type === 'end_turn') {
      const side = this.phase
      const event = this.record<EndTurnEvent>({ type: 'end_turn', round: this.round, side })
      if (side === 'enemy') this.round += 1
      this.startTurn(other(side))
      return [event]
    }

    const actor = this.units.find((u) => u.id === action.unit)
    if (!actor || !this.canAct(actor)) throw new Error(`${action.unit} cannot act now`)
    if (action.type === 'move') return this.move(actor, action.to)

    const target = this.units.find((u) => u.id === action.target)
    if (!target || !this.canAttack(actor, target)) throw new Error(`${actor.id} cannot attack ${action.target}`)
    if (actor.ap < ATTACK_AP_COST) throw new Error(`${actor.id} has too few action points to attack`)
    actor.ap -= ATTACK_AP_COST
    return this.attack(actor, target, false)
  }

  /** Ends an unfinished battle (e.g. the player quit) so its log is still complete. */
  abandon(): BattleEvent[] {
    if (this.phase === 'over') return []
    this.phase = 'over'
    return [this.record<BattleEndEvent>({ type: 'battle_end', round: this.round, winner: null, reason: 'abandoned' })]
  }

  /** Refills the side's action points and readies the other side's free attacks. */
  private startTurn(side: Side): void {
    this.phase = side
    for (const u of this.units) {
      if (u.side === side) u.ap = u.hp > 0 ? u.stats.actionPoints : 0
      else u.reactionReady = u.hp > 0
    }
  }

  private canAct(unit: UnitRecord): boolean {
    return unit.side === this.phase && unit.hp > 0 && unit.ap > 0
  }

  private canAttack(actor: UnitRecord, target: UnitRecord): boolean {
    return target.side !== actor.side && target.hp > 0 && hexDistance(target.position, actor.position) === 1
  }

  /** Foes that would strike `mover` for stepping out of `hex`. */
  private reactorsAt(mover: UnitRecord, hex: Hex): UnitRecord[] {
    // Crit-focused builds may later slip through zones of control; that check belongs here.
    return this.units.filter(
      (u) => u.side !== mover.side && u.hp > 0 && u.reactionReady && hexDistance(u.position, hex) === 1,
    )
  }

  /**
   * Walks the path, pausing for a free attack from each ready foe whose zone
   * the mover steps out of. The mover turns towards each step before taking
   * it, so a free attack strikes whichever arc that exposes. The move ends
   * early if the mover falls.
   */
  private move(actor: UnitRecord, to: Hex): BattleEvent[] {
    const path = this.reachable(actor).get(hexKey(to))
    if (!path) throw new Error(`${actor.id} cannot move to ${hexKey(to)}`)
    const apCost = moveApCost(path.length, actor.stats.speed)
    actor.ap -= apCost

    const events: BattleEvent[] = []
    let segment: Hex[] = []
    let segmentFrom = actor.position
    let firstSegment = true
    const logSegment = () => {
      if (segment.length === 0 && !firstSegment) return
      events.push(
        this.record<MoveEvent>({
          type: 'move',
          round: this.round,
          unit: actor.id,
          from: segmentFrom,
          to: actor.position,
          path: segment,
          destination: to,
          apCost: firstSegment ? apCost : 0,
          facing: actor.facing,
        }),
      )
      firstSegment = false
      segment = []
      segmentFrom = actor.position
    }

    for (const step of path) {
      actor.facing = hexDirection(actor.position, step)!
      const reactors = this.reactorsAt(actor, actor.position)
      if (reactors.length > 0) logSegment()
      for (const foe of reactors) {
        foe.reactionReady = false
        events.push(...this.attack(foe, actor, true))
        if (actor.hp <= 0) return events
      }
      actor.position = step
      segment.push(step)
    }
    logSegment()
    return events
  }

  /**
   * Hexes the unit can move to with its remaining AP: on the board, around
   * standing units, preferring routes that provoke fewer free attacks.
   */
  private reachable(actor: UnitRecord): Map<string, Hex[]> {
    const blocked = (h: Hex) => this.units.some((u) => u !== actor && u.hp > 0 && hexEquals(u.position, h))
    return reachableHexes(
      actor.position,
      actor.ap * actor.stats.speed,
      (h) => this.board.contains(h) && !blocked(h),
      (from) => this.reactorsAt(actor, from).length,
    )
  }

  private attack(actor: UnitRecord, target: UnitRecord, opportunity: boolean): BattleEvent[] {
    actor.facing = hexDirection(actor.position, target.position)!
    const flankers = flankersOf(this.units, actor, target)
    const flankBonus = flankers.length * FLANK_BONUS_PER_ALLY
    const arc = attackArc(target, actor.position)
    const arcBonus = ARC_BONUS[arc]
    const result = resolveAttack(actor.stats, target.stats.ac, this.rng, flankBonus + arcBonus)
    target.hp = Math.max(0, target.hp - result.damage)

    const events: BattleEvent[] = [
      this.record<AttackEvent>({
        type: 'attack',
        round: this.round,
        attacker: actor.id,
        defender: target.id,
        opportunity,
        flankers,
        flankBonus,
        arc,
        arcBonus,
        attackerFacing: actor.facing,
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
      target.ap = 0
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

  private record<E extends BattleEvent>(event: Omit<E, 'seq'>): E {
    const full = { ...event, seq: this.seq++ } as E
    this.events.push(full)
    return full
  }
}

function snapshot(unit: UnitRecord): UnitSnapshot {
  return {
    ...unit.stats,
    id: unit.id,
    side: unit.side,
    hp: unit.hp,
    position: unit.position,
    facing: unit.facing,
    ap: unit.ap,
    reactionReady: unit.reactionReady,
  }
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
      const opening = event.opportunity ? `${defenderName} breaks away — free attack! ` : ''
      if (event.fumble) return `${opening}${attackerName} rolls 1 — fumbles the attack!`
      const flank = event.flankBonus > 0 ? `, +${event.flankBonus} flanking` : ''
      const from = event.arc === 'rear' ? 'from behind' : 'from the side'
      const arc = event.arcBonus > 0 ? `, +${event.arcBonus} ${from}` : ''
      const roll = `${opening}${attackerName} rolls ${event.attackRoll} (${event.totalToHit} to hit${flank}${arc})`
      if (event.hit) {
        const crit = event.critical ? ' CRITICAL HIT!' : ''
        return `${roll} — HITS ${defenderName} for ${event.damage} dmg.${crit}`
      }
      return `${roll} — MISSES ${defenderName}.`
    }
    case 'move': {
      const steps = event.path.length
      if (steps === 0) return `${names[event.unit]} starts to move.`
      return `${names[event.unit]} moves ${steps} ${steps === 1 ? 'hex' : 'hexes'}.`
    }
    case 'unit_down':
      return `${names[event.unit]} falls.`
    case 'end_turn':
      return event.side === 'player' ? 'You end your turn.' : 'The enemy ends its turn.'
    case 'battle_end':
      if (event.winner === null) return 'The battle is abandoned.'
      return event.winner === 'player' ? 'Victory!' : 'Defeat...'
  }
}
