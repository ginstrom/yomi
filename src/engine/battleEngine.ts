import { hitChance, resolveAttack, type CombatantStats, type DamageRoll, type RNG } from '../combat/combat.ts'
import { mulberry32, randomSeed, type SeededRng } from '../combat/rng.ts'
import { SPELLS, type SpellId } from '../combat/spells.ts'
import {
  HEX_DIRECTIONS,
  HexBoard,
  hexDirection,
  hexDirectionTowards,
  hexDistance,
  hexEquals,
  hexKey,
  reachableHexes,
  type BoardSize,
  type Hex,
} from '../grid/hex.ts'

/** Bump when event shapes change so log consumers can tell formats apart. */
export const LOG_SCHEMA_VERSION = 14

/** What an attacker's chance to hit gains, in percent, for each other standing ally adjacent to the defender. */
export const FLANK_BONUS_PER_ALLY = 10

/**
 * Which way a defender is struck from, relative to its facing: its three
 * front hexes, the two beside its back, or straight behind it. A shot from
 * further off strikes the arc of the neighbouring hex it comes in over.
 */
export type Arc = 'front' | 'side' | 'rear'

/** What striking a defender in each arc adds to the chance to hit, in percent. */
export const ARC_BONUS: Readonly<Record<Arc, number>> = { front: 0, side: 5, rear: 10 }

/** Where units face before they first move or attack: towards the other side's starting edge. */
export const DEFAULT_FACING: Readonly<Record<Side, number>> = { player: 0, enemy: 3 } // east, west

/** Action points each hex of a move costs. */
export const MOVE_AP_COST_PER_HEX = 1

/**
 * Action points a change of gear costs, whether items are equipped, stowed,
 * dropped or picked up. It is paid once: further changes are free until the
 * unit moves or attacks, or its turn ends.
 */
export const EQUIP_AP_COST = 1

export type Side = 'player' | 'enemy'
export type Phase = Side | 'over'
export type UnitId = string

/** An item as the log names it. */
export interface GearItem {
  id: string
  name: string
}

/** One slot's change of gear: an item put on, taken off, or swapped for another. */
export interface GearChange {
  slot: string
  /** The item that was in the slot; null if it was empty. */
  from: GearItem | null
  /** The item now in the slot; null if it was emptied. */
  to: GearItem | null
}

/**
 * Moves, attacks, casts and gear changes name the acting unit; end_turn ends
 * the whole side's turn. A cast names a spell the unit knows and the foe it
 * is cast on. An equip action carries the stats the unit fights with
 * from then on, since the engine knows stats and not the items behind them;
 * `changes` says which items those were, and `dropped` and `pickedUp` which
 * went onto or came off the ground of the unit's hex. All three are only
 * copied into the log: the caller keeps track of what lies where.
 */
export type Action =
  | { type: 'move'; unit: UnitId; to: Hex }
  | { type: 'attack'; unit: UnitId; target: UnitId }
  | { type: 'cast'; unit: UnitId; spell: SpellId; target: UnitId }
  | {
      type: 'equip'
      unit: UnitId
      stats: CombatantStats
      changes?: readonly GearChange[]
      dropped?: readonly GearItem[]
      pickedUp?: readonly GearItem[]
    }
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
  /** Mana left: full as the battle starts and never refilled; 0 for a unit without magic. */
  mana: number
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
  /** Probability of a hit, from 0.05 to 0.95. */
  hitChance: number
}

/** What a cast would cost and its odds, before the dice are rolled. */
export interface CastPreview {
  apCost: number
  manaCost: number
  /** Probability of the spell striking, from 0.05 to 0.95. */
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
  /** The mover's action points once the move is paid for. */
  apAfter: number
  /**
   * The mover's facing when the segment ends. If a free attack interrupts the
   * move here, this is turned towards the step about to be taken, which is the
   * facing the attack is judged against. Otherwise it is towards the last step.
   */
  facing: number
}

export interface AttackEvent extends EventBase {
  type: 'attack'
  attacker: UnitId
  defender: UnitId
  /** A free attack provoked by the defender leaving the attacker's zone of control; costs no AP. */
  opportunity: boolean
  /** The attacker's weapon by name; null if its stats name none. */
  weapon: string | null
  /** Hexes between attacker and defender: 1 for a blow, more for a shot. */
  distance: number
  /** The attacker's `attackApCost`, or 0 for a free attack. */
  apCost: number
  /** The attacker's action points once the attack is paid for. */
  apAfter: number
  /** The attacker's standing allies adjacent to the defender when the attack was made. */
  flankers: UnitId[]
  /** What the flankers added to the chance to hit, in percent; already included in `chance`. */
  flankBonus: number
  /** Which of the defender's arcs the attack came from, given the defender's facing. */
  arc: Arc
  /** What the arc added to the chance to hit, in percent; already included in `chance`. */
  arcBonus: number
  /** The attacker's facing after turning to strike. */
  attackerFacing: number
  /** The roll, 1 to 100: a hit when no higher than `chance`. */
  attackRoll: number
  /** The attacker's own `toHit`, before bonuses and the defender's armour. */
  toHit: number
  /** The chance to hit in percent, after bonuses, armour class and the limits on both ends. */
  chance: number
  /** The armour class taken off the chance. */
  defenderAc: number
  hit: boolean
  critical: boolean
  fumble: boolean
  /** The dice a hit rolls, before a critical doubles their count. */
  damageDice: DamageRoll
  /** Damage rolled; it may be more than the defender had left. */
  damage: number
  defenderHpBefore: number
  defenderHpAfter: number
}

/**
 * A spell cast on a foe. It is rolled as an attack is, with the caster's
 * spell skill for its chance, and nothing for flanking or the arc it strikes.
 */
export interface CastEvent extends EventBase {
  type: 'cast'
  caster: UnitId
  spell: SpellId
  target: UnitId
  /** Hexes between caster and target. */
  distance: number
  apCost: number
  /** The caster's action points once the cast is paid for. */
  apAfter: number
  manaCost: number
  /** The caster's mana once the cast is paid for. */
  manaAfter: number
  /** The caster's facing after turning to its target. */
  casterFacing: number
  /** The caster's spell skill, before the target's armour. */
  skill: number
  /** The roll, 1 to 100: the spell strikes when no higher than `chance`. */
  attackRoll: number
  /** The chance in percent, after armour class and the limits on both ends. */
  chance: number
  defenderAc: number
  hit: boolean
  critical: boolean
  fumble: boolean
  /** The dice the spell rolls, before a critical doubles their count. */
  damageDice: DamageRoll
  /** Damage rolled; it may be more than the target had left. */
  damage: number
  targetHpBefore: number
  targetHpAfter: number
}

/** A unit changed its gear mid-battle: what it wears, and so its stats, or what it carries. */
export interface EquipEvent extends EventBase {
  type: 'equip'
  unit: UnitId
  /** EQUIP_AP_COST, or 0 when the unit had already paid for a change and not acted since. */
  apCost: number
  /** The unit's action points once the change is paid for. */
  apAfter: number
  /** The hex the unit stood on, which is where anything dropped lies and anything picked up lay. */
  position: Hex
  /** The items changed, slot by slot; empty if the caller did not say. */
  changes: GearChange[]
  /** Items left on the ground. */
  dropped: GearItem[]
  /** Items taken from the ground. */
  pickedUp: GearItem[]
  /** The stats the unit fought with until now. */
  statsBefore: CombatantStats
  /** The stats the unit fights with from here on. */
  stats: CombatantStats
}

export interface UnitDownEvent extends EventBase {
  type: 'unit_down'
  unit: UnitId
}

export interface EndTurnEvent extends EventBase {
  type: 'end_turn'
  side: Side
  /** Action points each of the side's standing units left unspent. */
  unspentAp: Record<UnitId, number>
}

export interface BattleEndEvent extends EventBase {
  type: 'battle_end'
  /** null when the battle was abandoned before a side fell. */
  winner: Side | null
  reason: 'defeat' | 'abandoned'
  /** Hit points of every unit still standing. */
  survivors: Record<UnitId, number>
}

export type BattleEvent =
  | BattleStartEvent
  | MoveEvent
  | AttackEvent
  | CastEvent
  | EquipEvent
  | UnitDownEvent
  | EndTurnEvent
  | BattleEndEvent

export interface BattleOptions {
  /** Seed for the built-in RNG; a random one is chosen (and logged) if omitted. */
  seed?: number
  /** Overrides the seeded RNG entirely, e.g. scripted rolls in tests. */
  rng?: RNG
  meta?: Record<string, unknown>
}

/** A unit as the engine keeps it. Exported for `BattleSnapshot`; callers otherwise see `UnitSnapshot`s. */
export interface UnitRecord {
  id: UnitId
  side: Side
  stats: CombatantStats
  hp: number
  position: Hex
  facing: number
  ap: number
  mana: number
  reactionReady: boolean
  /** The unit has paid for a change of gear and not moved, attacked or cast since. */
  gearChangePaid: boolean
}

/**
 * Everything an engine holds, as plain data that survives JSON: what a save
 * keeps of a battle (game/save.ts). `BattleEngine.restore` makes of it an
 * engine that plays on exactly as the one snapshotted would have.
 */
export interface BattleSnapshot {
  board: BoardSize
  units: UnitRecord[]
  round: number
  phase: Phase
  winner: Side | null
  seq: number
  events: BattleEvent[]
  /** Where the engine's dice stand (`SeededRng.state`). */
  rng: number
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

/** The arc of `defender` that an attack from the hex `from` strikes, whether beside it or at range. */
export function attackArc(defender: Pick<UnitSnapshot, 'position' | 'facing'>, from: Hex): Arc {
  const direction = hexDirectionTowards(defender.position, from)
  if (direction === null) throw new Error('Attacks come from another hex')
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
 * units then act in any order — moving (MOVE_AP_COST_PER_HEX a hex) and
 * attacking foes within the unit's `attackRange` (for its `attackApCost`) —
 * until the side ends its turn. Nothing blocks a shot: there is no line of sight yet.
 * An attack gains a to-hit bonus for each other ally adjacent to the
 * defender, and another for striking the defender's side or rear: units
 * face the way they last stepped or struck. Every standing unit with a melee
 * weapon exerts a zone of control over its neighbouring hexes: a foe stepping
 * out of one provokes a free attack, at most one per unit per enemy turn.
 * A ranged weapon (`attackRange` above 1) holds no zone. A unit with magic
 * (`stats.magic`) may cast a spell it knows on a foe within the spell's
 * range, for the spell's action points and mana; mana starts full and does
 * not come back during the battle. A cast provokes nothing. A unit may change
 * its gear on its own turn for EQUIP_AP_COST, dropping and picking up included.
 *
 * The UI, scripted policies and AI agents all drive it through step(). Given
 * the seed in battle_start and the actions in the log, a battle replays exactly.
 */
export class BattleEngine {
  private seq = 0
  private round = 1
  private phase: Phase = 'player'
  private winner: Side | null = null
  private readonly boardSize: BoardSize
  private readonly board: HexBoard
  private readonly units: UnitRecord[]
  private readonly events: BattleEvent[] = []
  private readonly rng: RNG
  /** The built-in RNG, whose place in its stream a snapshot can record; null for an engine given its own. */
  private readonly seeded: SeededRng | null = null

  /** `restored` is `restore`'s way in: the engine then takes up that snapshot and starts nothing. */
  constructor(setup: BattleSetup, options: BattleOptions = {}, restored?: BattleSnapshot) {
    const roster = setup.units
    this.boardSize = setup.board
    this.board = new HexBoard(setup.board)
    if (restored) {
      const { units, events, rng, ...rest } = structuredClone(restored)
      this.units = units
      this.events.push(...events)
      this.seeded = mulberry32(rng)
      this.rng = this.seeded
      this.round = rest.round
      this.phase = rest.phase
      this.winner = rest.winner
      this.seq = rest.seq
      return
    }
    const ids = new Set(roster.map((u) => u.id))
    if (ids.size !== roster.length) throw new Error('Unit ids must be unique')
    for (const side of ['player', 'enemy'] as const) {
      if (!roster.some((u) => u.side === side)) throw new Error(`No ${side} units in the roster`)
    }
    for (const u of roster) {
      if (!this.board.contains(u.position)) throw new Error(`${u.id} starts off the board`)
      const facing = u.facing ?? DEFAULT_FACING[u.side]
      if (!Number.isInteger(facing) || facing < 0 || facing >= HEX_DIRECTIONS.length) {
        throw new Error(`${u.id} faces an unknown direction: ${facing}`)
      }
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
      mana: u.stats.magic?.maxMana ?? 0,
      reactionReady: false,
      gearChangePaid: false,
    }))

    let seed: number | null = null
    if (options.rng) {
      this.rng = options.rng
    } else {
      seed = options.seed ?? randomSeed()
      this.seeded = mulberry32(seed)
      this.rng = this.seeded
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

  /**
   * The engine as plain data, sharing nothing with it. It may be taken at any
   * time; the game takes one as the player's turn begins. Throws for an engine
   * given its own `rng`, whose place in its stream cannot be recorded.
   */
  snapshot(): BattleSnapshot {
    if (!this.seeded) throw new Error('An engine with its own rng cannot be snapshotted')
    return structuredClone({
      board: this.boardSize,
      units: this.units,
      round: this.round,
      phase: this.phase,
      winner: this.winner,
      seq: this.seq,
      events: this.events,
      rng: this.seeded.state(),
    })
  }

  /**
   * The engine a snapshot was taken of, to play on from there. Nothing is
   * started over: no `battle_start` is recorded and no turn begun, so its log
   * is the same log, carried on.
   */
  static restore(snapshot: BattleSnapshot): BattleEngine {
    return new BattleEngine({ board: snapshot.board, units: [] }, {}, snapshot)
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
   * hex its AP can reach, an attack on each standing foe in range if it can
   * afford one, and for each spell it knows and can pay for a cast on each
   * standing foe in the spell's range; then end_turn. Empty once the battle is over. Equip actions
   * are not listed, as the engine cannot know what gear a unit carries: see
   * equipCost().
   */
  legalActions(unit?: UnitId): Action[] {
    if (this.phase === 'over') return []
    const actions: Action[] = []
    for (const actor of this.units) {
      if (!this.canAct(actor) || (unit !== undefined && actor.id !== unit)) continue
      for (const path of this.reachable(actor).values()) {
        actions.push({ type: 'move', unit: actor.id, to: path[path.length - 1] })
      }
      if (actor.ap >= actor.stats.attackApCost) {
        for (const foe of this.units) {
          if (this.canAttack(actor, foe)) actions.push({ type: 'attack', unit: actor.id, target: foe.id })
        }
      }
      for (const spell of actor.stats.magic?.spells ?? []) {
        for (const foe of this.units) {
          if (this.canCast(actor, spell, foe)) actions.push({ type: 'cast', unit: actor.id, spell, target: foe.id })
        }
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
    return { path, apCost: path.length * MOVE_AP_COST_PER_HEX, provokes }
  }

  /** Flanking and odds of a legal attack, or null if the attack isn't legal now. */
  previewAttack(unit: UnitId, target: UnitId): AttackPreview | null {
    const actor = this.units.find((u) => u.id === unit)
    const foe = this.units.find((u) => u.id === target)
    if (this.phase === 'over' || !actor || !foe || !this.canAct(actor)) return null
    if (actor.ap < actor.stats.attackApCost || !this.canAttack(actor, foe)) return null
    const flankers = flankersOf(this.units, actor, foe)
    const flankBonus = flankers.length * FLANK_BONUS_PER_ALLY
    const arc = attackArc(foe, actor.position)
    const arcBonus = ARC_BONUS[arc]
    const chance = hitChance(actor.stats, foe.stats.ac, flankBonus + arcBonus)
    return { flankers, flankBonus, arc, arcBonus, hitChance: chance }
  }

  /** The costs and odds of a legal cast, or null if the cast isn't legal now. */
  previewCast(unit: UnitId, spell: SpellId, target: UnitId): CastPreview | null {
    const actor = this.units.find((u) => u.id === unit)
    const foe = this.units.find((u) => u.id === target)
    if (this.phase === 'over' || !actor || !foe || !this.canAct(actor) || !this.canCast(actor, spell, foe)) return null
    const { apCost, manaCost } = SPELLS[spell]
    return { apCost, manaCost, hitChance: hitChance(spellcaster(actor.stats, spell), foe.stats.ac) }
  }

  /**
   * The action points a change of gear would cost the unit now, or null if it
   * cannot change gear: it is not its side's turn, it has fallen, or it has
   * not the points. The cost is 0 while an earlier change is still paid for.
   */
  equipCost(unit: UnitId): number | null {
    const actor = this.units.find((u) => u.id === unit)
    if (!actor || actor.side !== this.phase || actor.hp <= 0) return null
    const cost = actor.gearChangePaid ? 0 : EQUIP_AP_COST
    return actor.ap >= cost ? cost : null
  }

  /** Performs an action for the side whose turn it is. Throws if the battle is over or the action is illegal. */
  step(action: Action): BattleEvent[] {
    if (this.phase === 'over') throw new Error(`Cannot ${action.type}: the battle is over`)

    if (action.type === 'end_turn') {
      const side = this.phase
      const unspentAp = Object.fromEntries(
        this.units.filter((u) => u.side === side && u.hp > 0).map((u) => [u.id, u.ap]),
      )
      const event = this.record<EndTurnEvent>({ type: 'end_turn', round: this.round, side, unspentAp })
      if (side === 'enemy') this.round += 1
      this.startTurn(other(side))
      return [event]
    }

    const actor = this.units.find((u) => u.id === action.unit)
    // Checked first: a unit that spent its last point on a change of gear may still change again.
    if (actor && action.type === 'equip') return this.equip(actor, action)
    if (!actor || action.type === 'equip' || !this.canAct(actor)) throw new Error(`${action.unit} cannot act now`)
    if (action.type === 'move') return this.move(actor, action.to)

    const target = this.units.find((u) => u.id === action.target)
    if (action.type === 'cast') {
      if (!target || !this.canCast(actor, action.spell, target)) {
        throw new Error(`${actor.id} cannot cast ${action.spell} on ${action.target}`)
      }
      return this.cast(actor, action.spell, target)
    }
    if (!target || !this.canAttack(actor, target)) throw new Error(`${actor.id} cannot attack ${action.target}`)
    if (actor.ap < actor.stats.attackApCost) throw new Error(`${actor.id} has too few action points to attack`)
    actor.ap -= actor.stats.attackApCost
    actor.gearChangePaid = false
    return this.attack(actor, target, actor.stats.attackApCost)
  }

  /** Ends an unfinished battle (e.g. the player quit) so its log is still complete. */
  abandon(): BattleEvent[] {
    if (this.phase === 'over') return []
    this.phase = 'over'
    return [
      this.record<BattleEndEvent>({
        type: 'battle_end',
        round: this.round,
        winner: null,
        reason: 'abandoned',
        survivors: this.survivors(),
      }),
    ]
  }

  /** Refills the side's action points and readies the other side's free attacks. */
  private startTurn(side: Side): void {
    this.phase = side
    for (const u of this.units) {
      if (u.side === side) u.ap = u.hp > 0 ? u.stats.actionPoints : 0
      else u.reactionReady = u.hp > 0
      u.gearChangePaid = false
    }
  }

  private canAct(unit: UnitRecord): boolean {
    return unit.side === this.phase && unit.hp > 0 && unit.ap > 0
  }

  private canAttack(actor: UnitRecord, target: UnitRecord): boolean {
    return (
      target.side !== actor.side &&
      target.hp > 0 &&
      hexDistance(target.position, actor.position) <= actor.stats.attackRange
    )
  }

  /** Whether `actor` knows `spell`, can pay for it, and `target` is a standing foe within its range. */
  private canCast(actor: UnitRecord, spell: SpellId, target: UnitRecord): boolean {
    const known = SPELLS[spell]
    return (
      known !== undefined &&
      actor.stats.magic?.spells.includes(spell) === true &&
      actor.ap >= known.apCost &&
      actor.mana >= known.manaCost &&
      target.side !== actor.side &&
      target.hp > 0 &&
      hexDistance(target.position, actor.position) <= known.range
    )
  }

  /** Foes that would strike `mover` for stepping out of `hex`. */
  private reactorsAt(mover: UnitRecord, hex: Hex): UnitRecord[] {
    // Crit-focused builds may later slip through zones of control; that check belongs here.
    return this.units.filter(
      (u) =>
        u.side !== mover.side &&
        u.hp > 0 &&
        u.reactionReady &&
        u.stats.attackRange === 1 &&
        hexDistance(u.position, hex) === 1,
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
    const apCost = path.length * MOVE_AP_COST_PER_HEX
    actor.ap -= apCost
    actor.gearChangePaid = false

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
          apAfter: actor.ap,
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
        events.push(...this.attack(foe, actor, null))
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
   * standing units, preferring routes that provoke fewer distinct foes, since
   * each foe strikes at most once.
   */
  private reachable(actor: UnitRecord): Map<string, Hex[]> {
    const blocked = (h: Hex) => this.units.some((u) => u !== actor && u.hp > 0 && hexEquals(u.position, h))
    return reachableHexes(
      actor.position,
      Math.floor(actor.ap / MOVE_AP_COST_PER_HEX),
      (h) => this.board.contains(h) && !blocked(h),
      (from) => this.reactorsAt(actor, from).map((u) => u.id),
    )
  }

  /**
   * Swaps the unit's stats for those of its new gear; its wounds and remaining AP carry over.
   * So does its mana, kept within the new maximum: gear put on adds none to spend.
   */
  private equip(actor: UnitRecord, action: Extract<Action, { type: 'equip' }>): BattleEvent[] {
    const { stats } = action
    const apCost = this.equipCost(actor.id)
    if (apCost === null) throw new Error(`${actor.id} cannot change gear now`)
    const statsBefore = actor.stats
    actor.ap -= apCost
    actor.gearChangePaid = true
    actor.stats = stats
    actor.hp = Math.min(actor.hp, stats.maxHp)
    actor.mana = Math.min(actor.mana, stats.magic?.maxMana ?? 0)
    return [
      this.record<EquipEvent>({
        type: 'equip',
        round: this.round,
        unit: actor.id,
        apCost,
        apAfter: actor.ap,
        position: actor.position,
        changes: [...(action.changes ?? [])],
        dropped: [...(action.dropped ?? [])],
        pickedUp: [...(action.pickedUp ?? [])],
        statsBefore,
        stats,
      }),
    ]
  }

  /** Resolves an attack already paid for; an `apCost` of null marks a free attack. */
  private attack(actor: UnitRecord, target: UnitRecord, apCost: number | null): BattleEvent[] {
    actor.facing = hexDirectionTowards(actor.position, target.position)!
    const flankers = flankersOf(this.units, actor, target)
    const flankBonus = flankers.length * FLANK_BONUS_PER_ALLY
    const arc = attackArc(target, actor.position)
    const arcBonus = ARC_BONUS[arc]
    const result = resolveAttack(actor.stats, target.stats.ac, this.rng, flankBonus + arcBonus)
    const defenderHpBefore = target.hp
    target.hp = Math.max(0, target.hp - result.damage)

    const events: BattleEvent[] = [
      this.record<AttackEvent>({
        type: 'attack',
        round: this.round,
        attacker: actor.id,
        defender: target.id,
        opportunity: apCost === null,
        weapon: actor.stats.weapon ?? null,
        distance: hexDistance(actor.position, target.position),
        apCost: apCost ?? 0,
        apAfter: actor.ap,
        flankers,
        flankBonus,
        arc,
        arcBonus,
        attackerFacing: actor.facing,
        attackRoll: result.attackRoll,
        toHit: actor.stats.toHit,
        chance: result.chance,
        defenderAc: target.stats.ac,
        hit: result.hit,
        critical: result.critical,
        fumble: result.fumble,
        damageDice: actor.stats.damage,
        damage: result.damage,
        defenderHpBefore,
        defenderHpAfter: target.hp,
      }),
    ]

    events.push(...this.fell(target))
    return events
  }

  /** Pays for a legal cast and resolves it: one roll to hit, and on a hit the spell's dice, as an attack draws them. */
  private cast(actor: UnitRecord, spell: SpellId, target: UnitRecord): BattleEvent[] {
    const { apCost, manaCost, damage } = SPELLS[spell]
    actor.ap -= apCost
    actor.mana -= manaCost
    actor.gearChangePaid = false
    actor.facing = hexDirectionTowards(actor.position, target.position)!
    const result = resolveAttack(spellcaster(actor.stats, spell), target.stats.ac, this.rng)
    const targetHpBefore = target.hp
    target.hp = Math.max(0, target.hp - result.damage)

    return [
      this.record<CastEvent>({
        type: 'cast',
        round: this.round,
        caster: actor.id,
        spell,
        target: target.id,
        distance: hexDistance(actor.position, target.position),
        apCost,
        apAfter: actor.ap,
        manaCost,
        manaAfter: actor.mana,
        casterFacing: actor.facing,
        skill: actor.stats.magic!.skill,
        attackRoll: result.attackRoll,
        chance: result.chance,
        defenderAc: target.stats.ac,
        hit: result.hit,
        critical: result.critical,
        fumble: result.fumble,
        damageDice: damage,
        damage: result.damage,
        targetHpBefore,
        targetHpAfter: target.hp,
      }),
      ...this.fell(target),
    ]
  }

  /** What follows a blow or a spell on `target`: nothing if it stands, else its fall and perhaps the battle's end. */
  private fell(target: UnitRecord): BattleEvent[] {
    if (target.hp > 0) return []
    target.ap = 0
    const events: BattleEvent[] = [
      this.record<UnitDownEvent>({ type: 'unit_down', round: this.round, unit: target.id }),
    ]
    const end = this.checkWinner()
    if (end) events.push(end)
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
        survivors: this.survivors(),
      })
    }
    return null
  }

  private survivors(): Record<UnitId, number> {
    return Object.fromEntries(this.units.filter((u) => u.hp > 0).map((u) => [u.id, u.hp]))
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
    mana: unit.mana,
    reactionReady: unit.reactionReady,
  }
}

/** The caster as `resolveAttack` sees it casting `spell`: its spell skill for its chance, the spell's dice for its damage. */
function spellcaster(stats: CombatantStats, spell: SpellId): CombatantStats {
  return { ...stats, toHit: stats.magic?.skill ?? 0, damage: SPELLS[spell].damage }
}

/** Joins names as "A", "A and B", "A, B and C". */
export function listNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** "the Oak Shield", "the Oak Shield and the Yew Bow". */
function listItems(items: readonly GearItem[]): string {
  return listNames(items.map((item) => `the ${item.name}`))
}

/** "swaps the Iron Longsword for the Yew Bow", "takes up the Oak Shield", "puts away the Oak Shield". */
function describeGearChange({ from, to }: GearChange): string {
  if (from && to) return `swaps the ${from.name} for the ${to.name}`
  return to ? `takes up the ${to.name}` : `puts away the ${from?.name ?? 'gear'}`
}

/**
 * Renders an event as the human-readable line BattleScene pushes to its log.
 * It is a summary: the event itself carries more than the line says.
 */
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
      if (event.fumble) return `${opening}${attackerName} rolls ${event.attackRoll} — fumbles the attack!`
      const flank = event.flankBonus > 0 ? `, +${event.flankBonus} flanking` : ''
      const from = event.arc === 'rear' ? 'from behind' : 'from the side'
      const arc = event.arcBonus > 0 ? `, +${event.arcBonus} ${from}` : ''
      const roll = `${opening}${attackerName} rolls ${event.attackRoll} (needs ${event.chance} or less${flank}${arc})`
      if (event.hit) {
        const crit = event.critical ? ' CRITICAL HIT!' : ''
        return `${roll} — HITS ${defenderName} for ${event.damage} dmg.${crit}`
      }
      return `${roll} — MISSES ${defenderName}.`
    }
    case 'cast': {
      const opening = `${names[event.caster]} casts ${SPELLS[event.spell].name}: rolls ${event.attackRoll}`
      if (event.fumble) return `${opening} — fumbles the spell!`
      const roll = `${opening} (needs ${event.chance} or less)`
      if (event.hit) {
        const crit = event.critical ? ' CRITICAL HIT!' : ''
        return `${roll} — HITS ${names[event.target]} for ${event.damage} dmg.${crit}`
      }
      return `${roll} — MISSES ${names[event.target]}.`
    }
    case 'move': {
      const steps = event.path.length
      if (steps === 0) return `${names[event.unit]} starts to move.`
      return `${names[event.unit]} moves ${steps} ${steps === 1 ? 'hex' : 'hexes'}.`
    }
    case 'equip': {
      // An item dropped straight from its slot is not also "put away".
      const dropped = new Set(event.dropped.map((item) => item.id))
      const deeds = event.changes
        .filter(({ from, to }) => to !== null || from === null || !dropped.has(from.id))
        .map(describeGearChange)
      if (event.dropped.length > 0) deeds.push(`drops ${listItems(event.dropped)}`)
      if (event.pickedUp.length > 0) deeds.push(`picks up ${listItems(event.pickedUp)}`)
      if (deeds.length === 0) return `${names[event.unit]} changes gear.`
      return `${names[event.unit]} ${listNames(deeds)}.`
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
