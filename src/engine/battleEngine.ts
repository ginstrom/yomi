import { ABILITIES, type AbilityId, type Strike } from '../combat/abilities.ts'
import {
  damageThrough,
  effectiveResistance,
  hitChance,
  rollDamage,
  rollHitDamage,
  rollToHit,
  warded,
  type CombatantStats,
  type DamageRoll,
  type Element,
  type RNG,
} from '../combat/combat.ts'
import { mulberry32, randomSeed, type SeededRng } from '../combat/rng.ts'
import {
  HELPLESS_BONUS,
  SPELLS,
  STATUSES,
  type ActiveStatus,
  type SpellId,
  type StatusId,
  type StatusLaid,
} from '../combat/spells.ts'
import {
  HEX_DIRECTIONS,
  HexBoard,
  areaOf,
  hexDirection,
  hexDirectionTowards,
  hexDistance,
  hexEquals,
  hexKey,
  reachableHexes,
  type AreaShape,
  type BoardSize,
  type Hex,
} from '../grid/hex.ts'

/** Bump when event shapes change so log consumers can tell formats apart. */
export const LOG_SCHEMA_VERSION = 22

/** What an attacker's chance to hit gains, in percent, for each other standing ally adjacent to the defender. */
export const FLANK_BONUS_PER_ALLY = 10

/**
 * Which way a defender is struck from, relative to its facing: its three
 * front hexes, the two beside its back, or straight behind it. A shot from
 * further off strikes the arc of the neighbouring hex it comes in over. A
 * defender struck in its side or rear by a melee weapon turns to meet the
 * blow first, if it has not already turned this enemy turn (`turnReady`); a
 * shot or a spell gives it no turn.
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
 * What a cast is aimed at: a unit (a foe, an ally, or the caster itself), or
 * for an area spell the hex at its centre, the caster's own for one centred
 * on it.
 */
export type CastAim = { target: UnitId } | { at: Hex }

/**
 * Moves, attacks, casts, abilities and gear changes name the acting unit;
 * end_turn ends the whole side's turn. A cast names a spell the unit knows
 * and what it is aimed at (`CastAim`); an ability, one the unit has and, for
 * a routine of strikes, the foe it strikes first, or for an area, the hex it
 * is aimed at. An equip action carries the stats the unit fights with
 * from then on, since the engine knows stats and not the items behind them;
 * `changes` says which items those were, and `dropped` and `pickedUp` which
 * went onto or came off the ground of the unit's hex. All three are only
 * copied into the log: the caller keeps track of what lies where.
 */
export type Action =
  | { type: 'move'; unit: UnitId; to: Hex }
  | { type: 'attack'; unit: UnitId; target: UnitId }
  | { type: 'cast'; unit: UnitId; spell: SpellId; target: UnitId }
  | { type: 'cast'; unit: UnitId; spell: SpellId; at: Hex }
  | { type: 'ability'; unit: UnitId; ability: AbilityId; target: UnitId }
  | { type: 'ability'; unit: UnitId; ability: AbilityId; at: Hex }
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
  /** Whether the unit can still turn to meet a melee attack on its side or rear this enemy turn. */
  turnReady: boolean
  /** The lasting effects on it, in the order laid. Its stats here are as it was born to the battle; `effectiveStats` adds these. */
  statuses: ActiveStatus[]
  /** Rounds until each ability that is recharging can be used again; an ability absent here is ready. */
  recharging: Partial<Record<AbilityId, number>>
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
  /** The points the target's resistance takes off each hit, once the attacker's weapon has pierced it. */
  resistance: number
}

/** What a cast would cost and whom it would touch, with the odds on each, before the dice are rolled. */
export interface CastPreview {
  apCost: number
  manaCost: number
  /** Every unit it would touch, in roster order; `hitChance` is from 0.05 to 0.95 for a hostile spell, null for a friendly one, which never misses. */
  outcomes: Array<{ unit: UnitId; hitChance: number | null }>
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
  /** Hexes between attacker and defender: 1 for most blows, 2 for a reach weapon's, more for a shot. */
  distance: number
  /** The blow was struck with a melee weapon, reach included; false for a shot. */
  melee: boolean
  /** The attacker's `attackApCost`, or 0 for a free attack. */
  apCost: number
  /** The attacker's action points once the attack is paid for. */
  apAfter: number
  /** The attacker's standing allies adjacent to the defender when the attack was made. */
  flankers: UnitId[]
  /** What the flankers added to the chance to hit, in percent; already included in `chance`. */
  flankBonus: number
  /** The defender turned to face the attacker before the roll, which spent its `turnReady`. */
  defenderTurned: boolean
  /** The defender's facing when struck, after any turn. */
  defenderFacing: number
  /** Which of the defender's arcs the attack came from, given the defender's facing after any turn. */
  arc: Arc
  /** What the arc added to the chance to hit, in percent; already included in `chance`. */
  arcBonus: number
  /** The attacker's facing after turning to strike. */
  attackerFacing: number
  /** The defender was asleep, which added `HELPLESS_BONUS` to `chance`. */
  helpless: boolean
  /** The roll, 1 to 100: a hit when no higher than `chance`. */
  attackRoll: number
  /** The attacker's own `toHit`, before bonuses and the defender's armour. */
  toHit: number
  /** The chance to hit in percent, after bonuses, armour class and the limits on both ends. */
  chance: number
  /** The defender's armour class, which came off the chance. */
  defenderAc: number
  /** The defender's resistance, of which the weapon pierced `armorPierce` points before the rest came off the damage. */
  defenderResistance: number
  armorPierce: number
  hit: boolean
  critical: boolean
  fumble: boolean
  /** A hit that struck one of the defender's mirror images instead, doing nothing and drawing no damage dice. */
  image: boolean
  /** The dice a hit rolls, before a critical doubles their count. */
  damageDice: DamageRoll
  /** The damage dice's roll, before the defender's resistance. */
  rolled: number
  /** Damage dealt through the defender's resistance (`damageThrough`); it may be more than the defender had left. */
  damage: number
  defenderHpBefore: number
  defenderHpAfter: number
  /** On a routine's strikes only: the ability, by id. */
  ability?: AbilityId
  /** On a routine's strikes only: the strike's name. */
  strike?: string
  /** On a routine's strikes only: the status the strike laid, as it stands after; absent if none. */
  status?: ActiveStatus
}

/** What a cast did to one unit it touched. */
export interface CastOutcome {
  unit: UnitId
  /** For a hostile spell, the roll as an attack records it; null for a friendly one, which never misses. */
  attackRoll: number | null
  chance: number | null
  defenderAc: number | null
  hit: boolean
  critical: boolean
  fumble: boolean
  /** A hit that struck a mirror image instead, doing nothing. */
  image: boolean
  /** Damage dealt, after the unit's ward; it may be more than the unit had left. */
  damage: number
  /** The points of the rolled damage the unit's ward stopped (`warded`); 0 when none did. */
  warded: number
  /** The damage is half the dice for a miss (an area ability's `halfOnMiss`); false on every cast outcome. */
  half: boolean
  /** Hit points restored, no more than the unit had lost. */
  healed: number
  hpBefore: number
  hpAfter: number
  /** The status laid on it, as it stands after; null if none. */
  status: ActiveStatus | null
}

/**
 * A spell cast. A hostile one is rolled against each unit it touches as an
 * attack is, with the caster's spell skill for its chance and nothing for
 * flanking or the arc it strikes; a friendly one never misses.
 */
export interface CastEvent extends EventBase {
  type: 'cast'
  caster: UnitId
  spell: SpellId
  /** The unit aimed at, or null for an area. */
  target: UnitId | null
  /** The hex aimed at: the target's, or the area's centre. */
  at: Hex
  /** Hexes between caster and `at`. */
  distance: number
  apCost: number
  /** The caster's action points once the cast is paid for. */
  apAfter: number
  manaCost: number
  /** The caster's mana once the cast is paid for. */
  manaAfter: number
  /** The caster's facing after turning to its aim. */
  casterFacing: number
  /** The caster's spell skill, its statuses included, before the target's armour. */
  skill: number
  /** One for each unit touched, in roster order. */
  outcomes: CastOutcome[]
  /** Hit points the caster regained by the spell's `drain` of the hit points its targets lost, no more than it had lost; 0 for any other spell. */
  drained: number
}

/**
 * An area ability used: rolled against each unit it touches, both sides, as
 * a hostile area spell is, with the unit's chance to hit; resistance is
 * ignored, a ward cuts its element, and a miss deals half the dice where
 * the area has `halfOnMiss`.
 */
export interface AbilityEvent extends EventBase {
  type: 'ability'
  unit: UnitId
  ability: AbilityId
  /** The hex aimed at. */
  at: Hex
  shape: AreaShape
  /** Every hex of the area on the board, in areaOf's order. */
  hexes: Hex[]
  /** Hexes between the unit and `at`. */
  distance: number
  apCost: number
  apAfter: number
  /** The unit's facing after turning to its aim. */
  facing: number
  /** The unit's toHit, its statuses included: the chance before each target's armour class. */
  skill: number
  /** One for each unit touched, in roster order. */
  outcomes: CastOutcome[]
}

/** A status dealt its damage as its unit's turn began. */
export interface StatusTickEvent extends EventBase {
  type: 'status_tick'
  unit: UnitId
  status: StatusId
  /** Damage dealt, after the unit's ward against the status's element. */
  damage: number
  /** The points of the rolled damage the ward stopped; 0 when none did. */
  warded: number
  hpBefore: number
  hpAfter: number
}

/** A unit regained hit points by its own regeneration as its side's turn began. */
export interface RegenerateEvent extends EventBase {
  type: 'regenerate'
  unit: UnitId
  /** Hit points regained, no more than it had lost. */
  healed: number
  hpBefore: number
  hpAfter: number
}

/** A status ended: its turns ran out, a sleeper was hurt awake, or the last mirror image was struck. */
export interface StatusEndEvent extends EventBase {
  type: 'status_end'
  unit: UnitId
  status: StatusId
  reason: 'expired' | 'woke' | 'spent'
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
  | AbilityEvent
  | StatusTickEvent
  | RegenerateEvent
  | StatusEndEvent
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
  turnReady: boolean
  /** The unit has paid for a change of gear and not moved, attacked or cast since. */
  gearChangePaid: boolean
  statuses: ActiveStatus[]
  /** Rounds until each ability that is recharging can be used again; an ability absent here is ready. */
  recharging: Partial<Record<AbilityId, number>>
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

/** A weapon that strikes as melee: range 1, or reach (a spear, from two hexes). */
export function isMelee(stats: Pick<CombatantStats, 'attackRange' | 'reach'>): boolean {
  return stats.attackRange === 1 || stats.reach === true
}

/**
 * The arc an attack from `from` will strike: the front, if it is a blow with
 * a melee weapon (`melee`, reach included) the defender can still turn to
 * meet; otherwise the arc it is struck in as it stands.
 */
export function arcStruck(
  defender: Pick<UnitSnapshot, 'position' | 'facing' | 'turnReady'>,
  from: Hex,
  melee: boolean,
): Arc {
  return defender.turnReady && melee ? 'front' : attackArc(defender, from)
}

/** Whether the unit has `status` in force. */
export function hasStatus(unit: { statuses: readonly ActiveStatus[] }, status: StatusId): boolean {
  return unit.statuses.some((s) => s.id === status)
}

/**
 * The stats every rule reads: the unit's own, with what its statuses add to
 * its armour class and resistance (neither below 0 by a status), its chance
 * to hit and its spells' chance.
 */
export function effectiveStats(unit: { stats: CombatantStats; statuses: readonly ActiveStatus[] }): CombatantStats {
  if (unit.statuses.length === 0) return unit.stats
  let ac = 0
  let toHit = 0
  let resistance = 0
  for (const { id } of unit.statuses) {
    ac += STATUSES[id].armorClass ?? 0
    toHit += STATUSES[id].toHit ?? 0
    resistance += STATUSES[id].resistance ?? 0
  }
  const { stats } = unit
  return {
    ...stats,
    ac: ac === 0 ? stats.ac : Math.max(0, stats.ac + ac),
    ...(resistance === 0 ? {} : { resistance: Math.max(0, (stats.resistance ?? 0) + resistance) }),
    toHit: stats.toHit + toHit,
    ...(stats.magic ? { magic: { ...stats.magic, skill: stats.magic.skill + toHit } } : {}),
  }
}

/** The hex a cast is aimed at: its target's, or the area's centre. Null for a target not on the roster. */
export function aimHex(units: readonly Placed[], aim: CastAim): Hex | null {
  if ('at' in aim) return aim.at
  return units.find((u) => u.id === aim.target)?.position ?? null
}

export interface AreaSpec {
  shape: AreaShape
  range: number
  radius?: number
}

/** The standing units an area of `area` from `caster` aimed at `at` touches, in roster order: everyone if `hostile`, else the caster's side. */
export function areaTouches<U extends Placed>(
  units: readonly U[],
  caster: Placed,
  area: AreaSpec,
  at: Hex,
  hostile: boolean,
): U[] {
  const covered = new Set(areaOf(area.shape, caster.position, at, area.range, area.radius ?? 0).map(hexKey))
  return units.filter((u) => u.hp > 0 && covered.has(hexKey(u.position)) && (hostile || u.side === caster.side))
}

/**
 * The units a cast of `spell` by `caster` aimed at `aim` would touch, in
 * roster order, whether or not it is legal: the standing target of a spell
 * aimed at a unit; for an area, every standing unit in its shape (`areaTouches`),
 * everyone for a hostile spell, the caster's own side for a friendly
 * one. The engine resolves a cast over these, and the policies and the
 * battle screen judge one by them, so that the three agree.
 */
export function castTouches<U extends Placed>(units: readonly U[], caster: Placed, spell: SpellId, aim: CastAim): U[] {
  const { target, range, radius, shape = 'burst', hostile } = SPELLS[spell]
  if (target !== 'area') {
    if (!('target' in aim)) return []
    return units.filter((u) => u.id === aim.target && u.hp > 0)
  }
  const center = aimHex(units, aim)
  if (!center) return []
  return areaTouches(units, caster, { shape, range, radius }, center, hostile)
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
 * face the way they last stepped or struck, and once each enemy turn a
 * defender turns to meet a melee blow on its side or rear. Every standing unit
 * with a melee weapon exerts a zone of control over its neighbouring hexes:
 * a foe stepping out of one, not merely to another hex beside it, provokes
 * a free attack, at most one per unit per enemy turn.
 * A melee weapon is one of range 1, or with `reach` (`isMelee`): a spear strikes
 * from two hexes but holds its zone over the next hexes only. A ranged weapon
 * holds no zone. A unit with magic
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
      turnReady: false,
      gearChangePaid: false,
      statuses: [],
      recharging: {},
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
   * afford one, and for each spell it knows and can pay for, in `SPELL_IDS`
   * order, a cast at each legal aim: units in roster order, or an area's
   * centres in board order (row, then column); then for each ability it has
   * the AP for and is not recharging, in its `abilities` order, a routine at
   * each standing foe in its attack range, in roster order, or an area at
   * each legal aim in board order; then end_turn. Empty once the battle is over. Equip actions
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
        if (!this.canPayFor(actor, spell)) continue
        if (SPELLS[spell].target === 'area') {
          const centres = SPELLS[spell].range === 0 ? [actor.position] : this.board.hexes
          for (const at of centres) {
            if (this.canCast(actor, spell, { at })) actions.push({ type: 'cast', unit: actor.id, spell, at })
          }
        } else {
          for (const u of this.units) {
            if (this.canCast(actor, spell, { target: u.id })) actions.push({ type: 'cast', unit: actor.id, spell, target: u.id })
          }
        }
      }
      for (const ability of actor.stats.abilities ?? []) {
        if (!this.canUse(actor, ability)) continue
        if (ABILITIES[ability].area) {
          for (const at of this.board.hexes) {
            if (this.canAim(actor, ability, at)) actions.push({ type: 'ability', unit: actor.id, ability, at })
          }
          continue
        }
        for (const foe of this.units) {
          if (this.canStrike(actor, ability, foe)) actions.push({ type: 'ability', unit: actor.id, ability, target: foe.id })
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
      for (const foe of this.reactorsAt(actor, at, step)) if (!provokes.includes(foe.id)) provokes.push(foe.id)
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
    const arc = arcStruck(foe, actor.position, isMelee(actor.stats))
    const arcBonus = ARC_BONUS[arc]
    const helpless = hasStatus(foe, 'asleep') ? HELPLESS_BONUS : 0
    const attacker = effectiveStats(actor)
    const defender = effectiveStats(foe)
    const chance = hitChance(attacker, defender.ac, flankBonus + arcBonus + helpless)
    return { flankers, flankBonus, arc, arcBonus, hitChance: chance, resistance: effectiveResistance(attacker, defender.resistance ?? 0) }
  }

  /**
   * The costs of a legal cast, whom it would touch and the odds on each, or
   * null if the cast isn't legal now. `target` is a unit's id, or for an area
   * spell the hex at its centre.
   */
  previewCast(unit: UnitId, spell: SpellId, target: UnitId | Hex): CastPreview | null {
    const actor = this.units.find((u) => u.id === unit)
    const aim: CastAim = typeof target === 'string' ? { target } : { at: target }
    if (this.phase === 'over' || !actor || !this.canAct(actor) || !this.canCast(actor, spell, aim)) return null
    const { apCost, manaCost, hostile } = SPELLS[spell]
    const caster = spellcaster(effectiveStats(actor), spell)
    return {
      apCost,
      manaCost,
      outcomes: castTouches(this.units, actor, spell, aim).map((u) => ({
        unit: u.id,
        hitChance: hostile ? hitChance(caster, effectiveStats(u).ac) : null,
      })),
    }
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
      const events = this.countDownStatuses(side)
      const unspentAp = Object.fromEntries(
        this.units.filter((u) => u.side === side && u.hp > 0).map((u) => [u.id, u.ap]),
      )
      events.push(this.record<EndTurnEvent>({ type: 'end_turn', round: this.round, side, unspentAp }))
      if (side === 'enemy') this.round += 1
      events.push(...this.startTurn(other(side)))
      return events
    }

    const actor = this.units.find((u) => u.id === action.unit)
    // Checked first: a unit that spent its last point on a change of gear may still change again.
    if (actor && action.type === 'equip') return this.equip(actor, action)
    if (!actor || action.type === 'equip' || !this.canAct(actor)) throw new Error(`${action.unit} cannot act now`)
    if (action.type === 'move') return this.move(actor, action.to)

    if (action.type === 'cast') {
      const aim: CastAim = 'at' in action ? { at: action.at } : { target: action.target }
      if (!this.canCast(actor, action.spell, aim)) {
        const on = 'at' in action ? hexKey(action.at) : action.target
        throw new Error(`${actor.id} cannot cast ${action.spell} at ${on}`)
      }
      return this.cast(actor, action.spell, aim)
    }
    if (action.type === 'ability' && 'at' in action) {
      if (!this.canAim(actor, action.ability, action.at)) {
        throw new Error(`${actor.id} cannot use ${action.ability} at ${hexKey(action.at)}`)
      }
      return this.areaAttack(actor, action.ability, action.at)
    }
    if (action.type === 'ability') {
      const target = this.units.find((u) => u.id === action.target)
      if (!target || !this.canStrike(actor, action.ability, target)) {
        throw new Error(`${actor.id} cannot use ${action.ability} on ${action.target}`)
      }
      return this.routine(actor, action.ability, target)
    }
    const target = this.units.find((u) => u.id === action.target)
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

  /**
   * Refills the side's action points, less or more by their statuses, and
   * readies the other side's free attacks and turns to meet a blow (not a
   * sleeper's); then deals the
   * side's statuses' damage, unit by unit in roster order, which may fell
   * units and end the battle before the side acts; then the side's units that
   * still stand regenerate, in roster order, those whose statuses allow it;
   * then a round comes off what the side's standing units have recharging, a
   * sleeper's included (done whether or not the battle has just ended).
   */
  private startTurn(side: Side): BattleEvent[] {
    this.phase = side
    for (const u of this.units) {
      if (u.side === side) {
        u.ap = u.hp > 0 ? apAfterStatuses(u, u.stats.actionPoints) : 0
        u.turnReady = false
      } else {
        u.reactionReady = u.hp > 0 && !hasStatus(u, 'asleep')
        u.turnReady = u.reactionReady
      }
      u.gearChangePaid = false
    }
    const events: BattleEvent[] = []
    for (const u of this.units) {
      if (u.side !== side || u.hp <= 0) continue
      for (const status of [...u.statuses]) {
        const { tick, element } = STATUSES[status.id]
        if (!tick || u.hp <= 0 || this.winner !== null) continue
        const rolled = rollDamage(tick, this.rng)
        const damage = warded(rolled, element, effectiveStats(u))
        const hpBefore = u.hp
        u.hp = Math.max(0, u.hp - damage)
        events.push(
          this.record<StatusTickEvent>({
            type: 'status_tick',
            round: this.round,
            unit: u.id,
            status: status.id,
            damage,
            warded: rolled - damage,
            hpBefore,
            hpAfter: u.hp,
          }),
        )
        events.push(...this.wake(u, damage), ...this.fell(u))
      }
    }
    if (this.winner !== null) return events
    for (const u of this.units) {
      if (u.side !== side || u.hp <= 0 || !u.stats.regeneration) continue
      if (u.statuses.some(({ id }) => STATUSES[id].stopsRegeneration)) continue
      const healed = Math.min(u.stats.regeneration, u.stats.maxHp - u.hp)
      if (healed <= 0) continue
      const hpBefore = u.hp
      u.hp += healed
      events.push(this.record<RegenerateEvent>({ type: 'regenerate', round: this.round, unit: u.id, healed, hpBefore, hpAfter: u.hp }))
    }
    for (const u of this.units) {
      if (u.side !== side || u.hp <= 0) continue
      for (const [ability, rounds] of Object.entries(u.recharging) as Array<[AbilityId, number]>) {
        if (rounds <= 1) delete u.recharging[ability]
        else u.recharging[ability] = rounds - 1
      }
    }
    return events
  }

  /**
   * At the end of `side`'s turn, a turn off each of its units' statuses, and
   * the end of those that have run out.
   */
  private countDownStatuses(side: Side): BattleEvent[] {
    const events: BattleEvent[] = []
    for (const u of this.units) {
      if (u.side !== side) continue
      for (const status of u.statuses) status.turnsLeft -= 1
      for (const status of u.statuses.filter((s) => s.turnsLeft <= 0)) events.push(...this.endStatus(u, status.id, 'expired'))
    }
    return events
  }

  /** Takes `status` off `unit` and logs its end. */
  private endStatus(unit: UnitRecord, status: StatusId, reason: StatusEndEvent['reason']): BattleEvent[] {
    unit.statuses = unit.statuses.filter((s) => s.id !== status)
    return [this.record<StatusEndEvent>({ type: 'status_end', round: this.round, unit: unit.id, status, reason })]
  }

  /** Damage wakes a sleeper that still stands. */
  private wake(unit: UnitRecord, damage: number): BattleEvent[] {
    return damage > 0 && unit.hp > 0 && hasStatus(unit, 'asleep') ? this.endStatus(unit, 'asleep', 'woke') : []
  }

  /**
   * Lays a status on `unit`. The same status again takes the longer of the
   * two durations, and its images anew; a new one laid on the unit's own
   * side's turn changes its action points at once.
   */
  private layStatus(unit: UnitRecord, laid: StatusLaid): ActiveStatus {
    const existing = unit.statuses.find((s) => s.id === laid.id)
    if (existing) {
      existing.turnsLeft = Math.max(existing.turnsLeft, laid.turns)
      if (laid.images !== undefined) existing.images = laid.images
      return { ...existing }
    }
    const status: ActiveStatus = { id: laid.id, turnsLeft: laid.turns, ...(laid.images !== undefined ? { images: laid.images } : {}) }
    unit.statuses.push(status)
    const rule = STATUSES[laid.id]
    if (unit.side === this.phase) {
      if (rule.sleep) unit.ap = 0
      else if (rule.actionPoints) unit.ap = Math.max(0, unit.ap + rule.actionPoints)
    }
    if (rule.sleep) {
      unit.reactionReady = false
      unit.turnReady = false
    }
    return { ...status }
  }

  /**
   * A hit on a mirrored unit strikes one of its images: true if it did, the
   * images then one fewer. `imagesSpent` ends the status once the last is gone.
   */
  private strikeImage(unit: UnitRecord): boolean {
    const mirrored = unit.statuses.find((s) => s.id === 'mirrored')
    if (!mirrored || (mirrored.images ?? 0) <= 0) return false
    mirrored.images = (mirrored.images ?? 0) - 1
    return true
  }

  /** Ends a unit's Mirrored once its last image has been struck. */
  private imagesSpent(unit: UnitRecord): BattleEvent[] {
    const mirrored = unit.statuses.find((s) => s.id === 'mirrored')
    return mirrored && (mirrored.images ?? 0) <= 0 ? this.endStatus(unit, 'mirrored', 'spent') : []
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

  /** Whether `actor` has `ability`, has the action points for it, and it is not recharging. */
  private canUse(actor: UnitRecord, ability: AbilityId): boolean {
    const known = ABILITIES[ability]
    return (
      known !== undefined &&
      actor.stats.abilities?.includes(ability) === true &&
      actor.ap >= known.apCost &&
      (actor.recharging[ability] ?? 0) <= 0
    )
  }

  /** Whether `actor` can use the routine `ability` on `target`: it can use it, and the target is a standing foe within its attack range. */
  private canStrike(actor: UnitRecord, ability: AbilityId, target: UnitRecord): boolean {
    return this.canUse(actor, ability) && ABILITIES[ability].strikes !== undefined && this.canAttack(actor, target)
  }

  /**
   * Whether `actor` can use the area `ability` aimed at `at`: it can use it,
   * `at` is on the board, within range for a burst or 1 to range away for a
   * cone or line, and the area touches a standing foe.
   */
  private canAim(actor: UnitRecord, ability: AbilityId, at: Hex): boolean {
    const area = ABILITIES[ability]?.area
    if (!area || !this.canUse(actor, ability) || !this.board.contains(at)) return false
    const distance = hexDistance(at, actor.position)
    if (distance > area.range || (area.shape !== 'burst' && distance < 1)) return false
    return areaTouches(this.units, actor, area, at, true).some((u) => u.side !== actor.side)
  }

  /** Whether `actor` knows `spell` and has the action points and mana for it. */
  private canPayFor(actor: UnitRecord, spell: SpellId): boolean {
    const known = SPELLS[spell]
    return (
      known !== undefined &&
      actor.stats.magic?.spells.includes(spell) === true &&
      actor.ap >= known.apCost &&
      actor.mana >= known.manaCost
    )
  }

  /**
   * Whether `actor` can cast `spell` at `aim`: it can pay for it, and the aim
   * suits the spell: a standing foe within range, a standing ally (itself
   * included) within range, itself, or a hex of the board within range, its
   * own for a spell centred on it; a hostile area must hold a standing foe.
   */
  private canCast(actor: UnitRecord, spell: SpellId, aim: CastAim): boolean {
    if (!this.canPayFor(actor, spell)) return false
    const { target: kind, range, hostile, shape = 'burst' } = SPELLS[spell]
    if (kind === 'area') {
      if (!('at' in aim) || !this.board.contains(aim.at)) return false
      const distance = hexDistance(aim.at, actor.position)
      if (distance > range || (shape !== 'burst' && distance < 1)) return false
      return !hostile || castTouches(this.units, actor, spell, aim).some((u) => u.side !== actor.side)
    }
    if (!('target' in aim)) return false
    const target = this.units.find((u) => u.id === aim.target)
    if (!target || target.hp <= 0) return false
    if (kind === 'self') return target === actor
    const side = kind === 'foe' ? target.side !== actor.side : target.side === actor.side
    return side && hexDistance(target.position, actor.position) <= range
  }

  /** Foes that would strike `mover` for stepping from `hex` to `to`: those it leaves the side of. */
  private reactorsAt(mover: UnitRecord, hex: Hex, to: Hex): UnitRecord[] {
    // Crit-focused builds may later slip through zones of control; that check belongs here.
    return this.units.filter(
      (u) =>
        u.side !== mover.side &&
        u.hp > 0 &&
        u.reactionReady &&
        !hasStatus(u, 'asleep') &&
        isMelee(u.stats) &&
        hexDistance(u.position, hex) === 1 &&
        hexDistance(u.position, to) > 1,
    )
  }

  /**
   * Walks the path, pausing for a free attack from each ready foe whose zone
   * the mover steps out of; a step to another hex beside the foe provokes
   * nothing. The mover turns towards each step before taking
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
      const reactors = this.reactorsAt(actor, actor.position, step)
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
      (from, to) => this.reactorsAt(actor, from, to).map((u) => u.id),
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

  /**
   * Pays for a legal routine and makes its strikes in order, each a weapon
   * attack with the strike's dice and the unit's `abilityDamageBonus`. A
   * strike whose target has fallen goes to the nearest standing foe in
   * reach, the lowest id on a tie; with none, it and the rest are not made.
   * The routine stops when the battle ends.
   */
  private routine(actor: UnitRecord, abilityId: AbilityId, target: UnitRecord): BattleEvent[] {
    const ability = ABILITIES[abilityId]
    actor.ap -= ability.apCost
    actor.gearChangePaid = false
    if (ability.recharge >= 1) actor.recharging[abilityId] = ability.recharge
    const bonus = actor.stats.abilityDamageBonus ?? 0
    const events: BattleEvent[] = []
    let foe: UnitRecord | null = target
    for (const [i, strike] of (ability.strikes ?? []).entries()) {
      if (this.phase === 'over') break
      if (foe.hp <= 0) foe = this.nearestFoeInReach(actor)
      if (!foe) break
      const dice = { ...strike.damage, bonus: strike.damage.bonus + bonus }
      events.push(...this.attack(actor, foe, i === 0 ? ability.apCost : 0, { ability: abilityId, strike, dice }))
    }
    return events
  }

  /** The standing foe within `actor`'s attack range nearest it, the lowest id on a tie; null if none. */
  private nearestFoeInReach(actor: UnitRecord): UnitRecord | null {
    let nearest: UnitRecord | null = null
    let gap = Infinity
    for (const u of this.units) {
      if (!this.canAttack(actor, u)) continue
      const d = hexDistance(actor.position, u.position)
      if (d < gap || (d === gap && nearest !== null && u.id < nearest.id)) {
        nearest = u
        gap = d
      }
    }
    return nearest
  }

  /**
   * Resolves an attack already paid for; an `apCost` of null marks a free
   * attack. A defender struck in its side or rear by a melee weapon turns to
   * face the attacker first if it still can, whether the blow then lands or
   * not; a shot gives it no turn. A routine's strike rolls its own `dice` and
   * lays its status on a hit that leaves the target standing.
   */
  private attack(
    actor: UnitRecord,
    target: UnitRecord,
    apCost: number | null,
    strike?: { ability: AbilityId; strike: Strike; dice: DamageRoll },
  ): BattleEvent[] {
    actor.facing = hexDirectionTowards(actor.position, target.position)!
    const defenderTurned =
      target.turnReady && isMelee(actor.stats) && attackArc(target, actor.position) !== 'front'
    if (defenderTurned) {
      target.facing = hexDirectionTowards(target.position, actor.position)!
      target.turnReady = false
    }
    const flankers = flankersOf(this.units, actor, target)
    const flankBonus = flankers.length * FLANK_BONUS_PER_ALLY
    const arc = attackArc(target, actor.position)
    const arcBonus = ARC_BONUS[arc]
    const helpless = hasStatus(target, 'asleep')
    const attacker = effectiveStats(actor)
    const defender = effectiveStats(target)
    const defenderAc = defender.ac
    const defenderResistance = defender.resistance ?? 0
    const roll = rollToHit(attacker, defenderAc, this.rng, flankBonus + arcBonus + (helpless ? HELPLESS_BONUS : 0))
    const image = roll.hit && this.strikeImage(target)
    const dice = strike?.dice ?? attacker.damage
    const rolled = roll.hit && !image ? rollHitDamage(dice, roll.critical, this.rng) : 0
    const damage = damageThrough(rolled, effectiveResistance(attacker, defenderResistance))
    const result = { ...roll, damage }
    const defenderHpBefore = target.hp
    target.hp = Math.max(0, target.hp - damage)
    const laid = strike?.strike.status && roll.hit && !image && target.hp > 0 ? this.layStatus(target, strike.strike.status) : null

    const events: BattleEvent[] = [
      this.record<AttackEvent>({
        type: 'attack',
        round: this.round,
        attacker: actor.id,
        defender: target.id,
        opportunity: apCost === null,
        weapon: actor.stats.weapon ?? null,
        distance: hexDistance(actor.position, target.position),
        melee: isMelee(actor.stats),
        apCost: apCost ?? 0,
        apAfter: actor.ap,
        flankers,
        flankBonus,
        defenderTurned,
        defenderFacing: target.facing,
        arc,
        arcBonus,
        attackerFacing: actor.facing,
        helpless,
        attackRoll: result.attackRoll,
        toHit: attacker.toHit,
        chance: result.chance,
        defenderAc,
        defenderResistance,
        armorPierce: actor.stats.armorPierce ?? 0,
        hit: result.hit,
        critical: result.critical,
        fumble: result.fumble,
        image,
        damageDice: strike ? dice : actor.stats.damage,
        rolled,
        damage: result.damage,
        defenderHpBefore,
        defenderHpAfter: target.hp,
        ...(strike ? { ability: strike.ability, strike: strike.strike.name } : {}),
        ...(laid ? { status: laid } : {}),
      }),
    ]

    events.push(...this.imagesSpent(target), ...this.wake(target, damage), ...this.fell(target))
    return events
  }

  /**
   * Pays for a legal cast and resolves it over every unit it touches, in
   * roster order. A hostile spell rolls to hit each: on a hit a mirror image
   * takes it if there is one, drawing nothing more, and otherwise the
   * spell's dice are drawn and its status laid on a unit left standing. A
   * friendly one draws its heal, if any, and lays its status. Then the
   * wakings, images spent and falls, and at most one end of the battle.
   */
  private cast(actor: UnitRecord, spell: SpellId, aim: CastAim): BattleEvent[] {
    const { apCost, manaCost, hostile, damage: dice, element, drain, heal, status } = SPELLS[spell]
    const touched = castTouches(this.units, actor, spell, aim)
    const at = aimHex(this.units, aim)!
    actor.ap -= apCost
    actor.mana -= manaCost
    actor.gearChangePaid = false
    if (!hexEquals(at, actor.position)) actor.facing = hexDirectionTowards(actor.position, at)!
    const caster = spellcaster(effectiveStats(actor), spell)

    const outcomes: StruckOutcome[] = touched.map((unit) => {
      if (hostile) return this.strikeUnit(unit, caster, { dice, element, status, halfOnMiss: false })
      const hpBefore = unit.hp
      const healed = heal ? Math.min(rollDamage(heal, this.rng), unit.stats.maxHp - unit.hp) : 0
      unit.hp += Math.max(0, healed)
      const laid = status ? this.layStatus(unit, status) : null
      return {
        unit: unit.id, attackRoll: null, chance: null, defenderAc: null, hit: true, critical: false, fumble: false, image: false,
        damage: 0, warded: 0, half: false, healed: Math.max(0, healed), hpBefore, hpAfter: unit.hp, status: laid,
      }
    })
    // A drain heals a caster its own area left standing, by a share of the hit points all it touched lost
    // (not the overkill past what a target had left).
    const dealt = outcomes.reduce((sum, o) => sum + (o.hpBefore - o.hpAfter), 0)
    const drained = drain && actor.hp > 0 ? Math.min(Math.floor(drain * dealt), actor.stats.maxHp - actor.hp) : 0
    actor.hp += drained

    const event = this.record<CastEvent>({
      type: 'cast',
      round: this.round,
      caster: actor.id,
      spell,
      target: 'target' in aim ? aim.target : null,
      at,
      distance: hexDistance(actor.position, at),
      apCost,
      apAfter: actor.ap,
      manaCost,
      manaAfter: actor.mana,
      casterFacing: actor.facing,
      skill: caster.toHit,
      outcomes: outcomes.map(({ woke: _, ...outcome }) => outcome),
      drained,
    })
    return [event, ...this.aftermath(outcomes, touched)]
  }

  /**
   * Pays for a legal area ability and resolves it over every unit it
   * touches, both sides, in roster order: each rolled as a hostile spell
   * rolls, with the unit's own chance to hit, resistance ignored, its
   * element cut by each ward, and half the dice on a miss where the area has
   * `halfOnMiss`. Then the wakings, images spent and falls, as a cast's.
   */
  private areaAttack(actor: UnitRecord, abilityId: AbilityId, at: Hex): BattleEvent[] {
    const ability = ABILITIES[abilityId]
    const area = ability.area!
    const touched = areaTouches(this.units, actor, area, at, true)
    actor.ap -= ability.apCost
    actor.gearChangePaid = false
    if (ability.recharge >= 1) actor.recharging[abilityId] = ability.recharge
    if (!hexEquals(at, actor.position)) actor.facing = hexDirectionTowards(actor.position, at)!
    const attacker = effectiveStats(actor)
    const bonus = actor.stats.abilityDamageBonus ?? 0
    const dice = area.damage && { ...area.damage, bonus: area.damage.bonus + bonus }

    const outcomes = touched.map((unit) =>
      this.strikeUnit(unit, attacker, { dice, element: area.element, status: area.status, halfOnMiss: area.halfOnMiss }),
    )
    const event = this.record<AbilityEvent>({
      type: 'ability',
      round: this.round,
      unit: actor.id,
      ability: abilityId,
      at,
      shape: area.shape,
      hexes: areaOf(area.shape, actor.position, at, area.range, area.radius ?? 0).filter((h) => this.board.contains(h)),
      distance: hexDistance(actor.position, at),
      apCost: ability.apCost,
      apAfter: actor.ap,
      facing: actor.facing,
      skill: attacker.toHit,
      outcomes: outcomes.map(({ woke: _, ...outcome }) => outcome),
    })
    return [event, ...this.aftermath(outcomes, touched)]
  }

  /**
   * One unit's share of a hostile cast or area: the roll to hit with
   * `attacker`'s chance against its armour class; on a hit, a mirror image
   * takes it if there is one, drawing nothing more, and otherwise the dice
   * (doubled on a critical) less its ward; on a miss with `halfOnMiss`, half
   * the dice, rounded down, less its ward. A blow that wakes a sleeper wakes
   * it before the status is laid, on a hit that left it standing.
   */
  private strikeUnit(
    unit: UnitRecord,
    attacker: CombatantStats,
    blow: { dice: DamageRoll | undefined; element: Element | undefined; status: StatusLaid | undefined; halfOnMiss: boolean },
  ): StruckOutcome {
    const hpBefore = unit.hp
    const defenderAc = effectiveStats(unit).ac
    const roll = rollToHit(attacker, defenderAc, this.rng)
    const image = roll.hit && this.strikeImage(unit)
    const half = !roll.hit && blow.halfOnMiss && blow.dice !== undefined
    const rolled =
      roll.hit && !image && blow.dice
        ? rollHitDamage(blow.dice, roll.critical, this.rng)
        : half
          ? Math.floor(Math.max(0, rollDamage(blow.dice!, this.rng)) / 2)
          : 0
    const damage = warded(rolled, blow.element, effectiveStats(unit))
    unit.hp = Math.max(0, unit.hp - damage)
    // A blow that wakes a sleeper wakes it before anything it lays; Sleep itself deals none.
    const woke = damage > 0 && unit.hp > 0 && hasStatus(unit, 'asleep')
    if (woke) unit.statuses = unit.statuses.filter((s) => s.id !== 'asleep')
    const laid = roll.hit && !image && blow.status && unit.hp > 0 ? this.layStatus(unit, blow.status) : null
    return {
      unit: unit.id, ...roll, defenderAc, image, damage, warded: rolled - damage, half, healed: 0, hpBefore, hpAfter: unit.hp, status: laid, woke,
    }
  }

  /** What follows a cast or an area: each sleeper woken and image spent, in roster order, then the falls and at most one end of the battle. */
  private aftermath(outcomes: readonly StruckOutcome[], touched: readonly UnitRecord[]): BattleEvent[] {
    const events: BattleEvent[] = []
    for (const outcome of outcomes) {
      const unit = this.units.find((u) => u.id === outcome.unit)!
      if (outcome.woke) {
        events.push(this.record<StatusEndEvent>({ type: 'status_end', round: this.round, unit: unit.id, status: 'asleep', reason: 'woke' }))
      }
      if (outcome.image) events.push(...this.imagesSpent(unit))
    }
    events.push(...this.fellAll(touched))
    return events
  }

  /** What follows a blow or a spell on `target`: nothing if it stands, else its fall and perhaps the battle's end. */
  private fell(target: UnitRecord): BattleEvent[] {
    return this.fellAll([target])
  }

  /**
   * The falls of those of `targets` that have no hit points left, in their
   * order, each losing its statuses; then, once, the battle's end if a side
   * has none standing. The player's side is judged first, so a spell that
   * fells the last of both sides loses the battle.
   */
  private fellAll(targets: readonly UnitRecord[]): BattleEvent[] {
    const events: BattleEvent[] = []
    for (const target of targets) {
      if (target.hp > 0) continue
      target.ap = 0
      target.statuses = []
      events.push(this.record<UnitDownEvent>({ type: 'unit_down', round: this.round, unit: target.id }))
    }
    if (events.length === 0) return events
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

/** A cast or area outcome, with whether it woke its unit, which the event does not keep. */
type StruckOutcome = CastOutcome & { woke?: boolean }

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
    turnReady: unit.turnReady,
    statuses: unit.statuses.map((status) => ({ ...status })),
    recharging: { ...unit.recharging },
  }
}

/** A unit's action points at the start of its turn, `base` changed by its statuses: none while asleep, never below 0. */
function apAfterStatuses(unit: UnitRecord, base: number): number {
  if (hasStatus(unit, 'asleep')) return 0
  const change = unit.statuses.reduce((total, { id }) => total + (STATUSES[id].actionPoints ?? 0), 0)
  return Math.max(0, base + change)
}

/** The caster as `rollToHit` sees it casting `spell`: its spell skill for its chance and the spell's dice for its damage; a spell's damage owes nothing to resistance, so no weapon's piercing either. */
function spellcaster(stats: CombatantStats, spell: SpellId): CombatantStats {
  return { ...stats, toHit: stats.magic?.skill ?? 0, damage: SPELLS[spell].damage ?? NO_DAMAGE, armorPierce: 0 }
}

const NO_DAMAGE: DamageRoll = { count: 0, sides: 0, bonus: 0 }

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

/** What a status laid does to a unit, for the log: "falls asleep", "is blessed". */
function laidPhrase(status: StatusId): string {
  return status === 'asleep' ? 'falls asleep' : `is ${STATUSES[status].adjective}`
}

/** The verb of a routine's strike, by its name: "claws", "bites". */
function strikeVerb(event: AttackEvent): string {
  const ability = ABILITIES[event.ability!]
  return ability.strikes?.find((s) => s.name === event.strike)?.verb ?? ability.verb
}

/** " (warded N)" after a damage the ward took N off, else nothing. */
function wardedNote(points: number): string {
  return points > 0 ? ` (warded ${points})` : ''
}

/** What one unit made of a hostile cast: "HITS Goblin for 7 dmg", "Goblin falls asleep", "MISSES Goblin". */
function hostileOutcome(outcome: CastOutcome, name: string): string {
  if (!outcome.hit) {
    const missed = outcome.fumble ? `fumbles at ${name}` : `MISSES ${name}`
    return outcome.half ? `${missed}, ${outcome.damage} dmg${wardedNote(outcome.warded)} (half)` : missed
  }
  if (outcome.image) return `strikes an image of ${name}`
  const notes = [...(outcome.critical ? ['CRITICAL'] : []), ...(outcome.warded > 0 ? [`warded ${outcome.warded}`] : [])]
  const struck = outcome.damage > 0 || outcome.warded > 0
  const parts = struck ? [`HITS ${name} for ${outcome.damage} dmg${notes.length > 0 ? ` (${notes.join(', ')})` : ''}`] : []
  if (outcome.status) parts.push(struck ? laidPhrase(outcome.status.id).replace(/^is /, '') : `${name} ${laidPhrase(outcome.status.id)}`)
  return parts.join(', ') || `HITS ${name}`
}

/**
 * A cast's line: one that touches a single unit gives the roll as an attack's
 * does; one that touches several lists each.
 */
function describeCast(event: CastEvent, names: Readonly<Record<UnitId, string>>): string {
  const spell = SPELLS[event.spell]
  const on = event.target !== null && event.target !== event.caster ? ` on ${names[event.target]}` : ''
  const opening = `${names[event.caster]} casts ${spell.name}${on}`
  const { outcomes } = event
  if (outcomes.length === 0) return `${opening}: it touches no one.`
  if (!spell.hostile) {
    const healed = outcomes.filter((o) => o.healed > 0 || spell.heal)
    if (spell.heal && outcomes.length === 1) return `${opening}: +${outcomes[0].healed} (${outcomes[0].hpAfter} hp).`
    if (spell.heal) return `${opening}: ${healed.map((o) => `${names[o.unit]} +${o.healed}`).join(', ')}.`
    const who = listNames(outcomes.map((o) => names[o.unit]))
    const status = spell.status ? STATUSES[spell.status.id].adjective : 'helped'
    return `${opening}: ${who} ${outcomes.length === 1 ? 'is' : 'are'} ${status}.`
  }
  const drains = event.drained > 0 ? ` and drains ${event.drained}` : ''
  if (spell.target !== 'area' && outcomes.length === 1) {
    const [o] = outcomes
    if (o.fumble) return `${opening}: rolls ${o.attackRoll} — fumbles the spell!`
    return `${opening}: rolls ${o.attackRoll} (needs ${o.chance} or less) — ${hostileOutcome(o, names[o.unit])}${drains}.`
  }
  return `${opening}: ${outcomes.map((o) => hostileOutcome(o, names[o.unit])).join('; ')}${drains}.`
}

/** An area ability's line: "Salamander spits fire: HITS Aldric for 9 dmg; MISSES Bryn, 4 dmg (half)." */
function describeAbility(event: AbilityEvent, names: Readonly<Record<UnitId, string>>): string {
  const opening = `${names[event.unit]} ${ABILITIES[event.ability].verb}`
  if (event.outcomes.length === 0) return `${opening}: it touches no one.`
  return `${opening}: ${event.outcomes.map((o) => hostileOutcome(o, names[o.unit])).join('; ')}.`
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
      const breaking = event.opportunity ? `${defenderName} breaks away — free attack! ` : ''
      const opening = `${breaking}${event.defenderTurned ? `${defenderName} turns to face ${attackerName}. ` : ''}`
      // A routine's strike names its verb: "Troll claws Aldric: rolls 23".
      const striker = event.ability ? `${attackerName} ${strikeVerb(event)} ${defenderName}:` : attackerName
      if (event.fumble) return `${opening}${striker} rolls ${event.attackRoll} — fumbles the attack!`
      const flank = event.flankBonus > 0 ? `, +${event.flankBonus} flanking` : ''
      const from = event.arc === 'rear' ? 'from behind' : 'from the side'
      const arc = event.arcBonus > 0 ? `, +${event.arcBonus} ${from}` : ''
      const roll = `${opening}${striker} rolls ${event.attackRoll} (needs ${event.chance} or less${flank}${arc})`
      if (event.image) return `${roll} — strikes an image of ${defenderName}.`
      if (event.hit) {
        const crit = event.critical ? ' CRITICAL HIT!' : ''
        const absorbed = event.rolled - event.damage
        const armour = absorbed > 0 ? ` (armour stops ${absorbed})` : ''
        const laid = event.status ? `, ${laidPhrase(event.status.id).replace(/^is /, '')}` : ''
        return `${roll} — HITS ${defenderName} for ${event.damage} dmg${armour}${laid}.${crit}`
      }
      return `${roll} — MISSES ${defenderName}.`
    }
    case 'cast':
      return describeCast(event, names)
    case 'ability':
      return describeAbility(event, names)
    case 'status_tick':
      return `${names[event.unit]} takes ${event.damage} from ${STATUSES[event.status].tickName ?? STATUSES[event.status].adjective}${wardedNote(event.warded)}.`
    case 'regenerate':
      return `${names[event.unit]} regenerates ${event.healed}.`
    case 'status_end':
      if (event.reason === 'woke') return `${names[event.unit]} wakes.`
      if (event.reason === 'spent') return `The last image of ${names[event.unit]} is gone.`
      return event.status === 'asleep' ? `${names[event.unit]} wakes.` : `${names[event.unit]} is no longer ${STATUSES[event.status].adjective}.`
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
