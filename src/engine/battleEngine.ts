import { ABILITIES, abilityApCost, type AbilityId, type Strike } from '../combat/abilities.ts'
import {
  ELEMENTS,
  baneApplies,
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
  type TraitId,
} from '../combat/combat.ts'
import { mulberry32, randomSeed, type SeededRng } from '../combat/rng.ts'
import {
  HELPLESS_BONUS,
  SPELLS,
  STATUSES,
  spellApCost,
  spellRange,
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
export const LOG_SCHEMA_VERSION = 26

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

/**
 * What a taunted unit's chance to hit loses, in percent, on every hostile
 * roll at a unit other than its taunter (the status's `source`).
 */
export const TAUNT_PENALTY = 25

/** What Ambush adds to the chance of a unit's first own-turn weapon attack or technique strike of the battle, whose hit is then critical. */
export const AMBUSH_BONUS = 25

/** Points of resistance a Deadeye's shot pierces beyond its weapon's own. */
export const DEADEYE_PIERCE = 3

/** What a Deadeye's ranged critical multiplies its dice's count by, where any other critical doubles it. */
export const DEADEYE_CRIT_MULTIPLIER = 3

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
  /** Present, and true, once the unit has taken a step since its side's turn began (`UnitRecord.moved`). */
  moved?: true
  /** Present, and true, once the unit has made a weapon attack or technique strike in its own turn this battle (`UnitRecord.attackedYet`). */
  attackedYet?: true
  /** Present, and true, as `UnitRecord.endured` is. */
  endured?: true
  /** Present, and true, as `UnitRecord.refunded` is. */
  refunded?: true
  /** Present, and true, as `UnitRecord.fallenThisBattle` is. */
  fallenThisBattle?: true
  /** Present while `UnitRecord.usedOnce` holds a spell. */
  usedOnce?: SpellId[]
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

/**
 * What an ability would cost and whom it would touch, with the odds on each
 * (a strike's first blow's, as `attack` rolls it; an area's on each unit it
 * touches; null where nothing is rolled), before the dice are rolled.
 */
export interface AbilityPreview {
  apCost: number
  manaCost: number
  outcomes: { unit: UnitId; hitChance: number | null }[]
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
  /** The defender was helpless (Asleep, Frozen), which added `HELPLESS_BONUS` to `chance`. */
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
  /** On a routine's strikes only (a technique's included): the ability, by id. */
  ability?: AbilityId
  /** On a routine's strikes only: the strike's name. */
  strike?: string
  /** On a routine's strikes only: the status the strike laid, as it stands after; absent if none. */
  status?: ActiveStatus
  /**
   * The weapon's on-hit damage (runes), one per entry with damage that applied
   * (a bane only where `baneApplies`), on a hit that struck no image; empty
   * otherwise. The defender lost `damage` and every `bonus[].damage`.
   */
  bonus: AttackBonus[]
  /** On a hit that struck no image, by a weapon with an on-hit heal: hit points the attacker regained (0 at full health); absent otherwise. */
  healed?: number
  /** The on-hit statuses laid, as they stand after; absent if none. */
  onHitStatuses?: ActiveStatus[]
  /** On the first strike of a technique that costs mana: the mana it cost, paid as it began. */
  manaCost?: number
  /** With `manaCost`: the unit's mana once it was paid. */
  manaAfter?: number
  /** `TAUNT_PENALTY`, already taken off `chance`, when a taunted attacker struck a unit other than its taunter; absent otherwise. */
  tauntPenalty?: number
  /**
   * The bonus to the chance from the attacker's traits (Backstab's rear, Iron
   * Skin's free attack, Skirmisher's step, Ambush), already included in
   * `chance`; absent when 0.
   */
  traitBonus?: number
  /** A free attack made by a Counter after the defender of the side in turn missed it with a melee blow; with `opportunity`. */
  counter?: true
  /** The attacker's first own-turn attack of the battle with Ambush: `AMBUSH_BONUS` in `traitBonus`, and a hit is critical. */
  ambush?: true
  /** The hit left the defender at a quarter of its maximum or less and the attacker's Deathblow felled it. */
  deathblow?: true
  /**
   * Action points Blademaster gave back to the attacker, its action having
   * felled the defender: the whole action's cost; `apAfter` is still as paid.
   */
  apRefunded?: number
  /** The defender was kept standing at 1 by Unbreakable. */
  endured?: true
  /** Mana a melee hit that struck no image restored to the attacker (`manaOnHit`, capped at its maximum); absent when none. */
  manaRestored?: number
}

/** One on-hit entry's damage on an attack: flat, after resistance, cut by the defender's ward, never doubled by a critical. */
export interface AttackBonus {
  element?: Element
  bane?: true
  /** The on-hit damage before the defender's ward. */
  rolled: number
  /** What came through the ward: max(0, rolled − ward). */
  damage: number
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
  /**
   * For an area that goes through resistance (`throughResistance`, Volley):
   * the points of the rolled damage the unit's resistance stopped, before its
   * ward; absent for every other cast and area.
   */
  resisted?: number
  /** Hit points restored, no more than the unit had lost. */
  healed: number
  hpBefore: number
  hpAfter: number
  /** The status laid on it, as it stands after; null if none. */
  status: ActiveStatus | null
  /** `TAUNT_PENALTY`, already taken off `chance`, when a taunted user rolled at a unit other than its taunter; absent otherwise. */
  tauntPenalty?: number
  /** The unit was kept standing at 1 by Unbreakable. */
  endured?: true
  /** The unit, fallen this battle, was brought back to stand at `hpAfter` (Revive). */
  revived?: true
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
 * the area has `halfOnMiss`. Also a technique that lays a status with no
 * roll on the user or a foe (Sprint, Hunter's Mark): its one hex, and one
 * outcome shaped as a friendly spell's.
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
  /** For a technique that costs mana: the mana it cost, paid as it began. */
  manaCost?: number
  /** With `manaCost`: the unit's mana once it was paid. */
  manaAfter?: number
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
  /** The unit was kept standing at 1 by Unbreakable. */
  endured?: true
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

/**
 * A status ended: its turns ran out, a sleeper was hurt awake, the last
 * mirror image was struck, the taunter it named fell (`source_fell`), the
 * unit stepped off the hex it was rooted to (`moved`), or Purify ended a
 * hostile status (`cleansed`).
 */
export interface StatusEndEvent extends EventBase {
  type: 'status_end'
  unit: UnitId
  status: StatusId
  reason: 'expired' | 'woke' | 'spent' | 'source_fell' | 'moved' | 'cleansed'
}

/**
 * Hit points or mana a unit regained as its side's turn began, by a rule
 * rather than an action: its Renewing status, a Sanctuary's aura (`source`
 * names the Sanctuary unit) or its own Serenity (`manaRegen`).
 */
export interface RestoreEvent extends EventBase {
  type: 'restore'
  unit: UnitId
  /** Hit points regained, no more than it had lost; absent for mana. */
  hp?: number
  /** Mana regained, no more than its maximum allowed; absent for hit points. */
  mana?: number
  cause: 'renewing' | 'sanctuary' | 'serenity'
  /** For a Sanctuary's: the unit whose aura healed. */
  source?: UnitId
}

/**
 * A status laid by a rule rather than an action: Rooted, as a unit with the
 * trait ends its side's turn unmoved; Mirrored (one image), as a
 * Shadowdancer's side's turn begins with no image left on it.
 */
export interface StatusLaidEvent extends EventBase {
  type: 'status_laid'
  unit: UnitId
  status: StatusId
  turns: number
  cause: 'rooted' | 'shadowdancer'
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
  | RestoreEvent
  | StatusEndEvent
  | StatusLaidEvent
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
  /** It has taken a step since its side's turn began: false as the turn begins, true from its first step. */
  moved: boolean
  /** It has made a weapon attack or technique strike in its own turn this battle (Ambush reads it); a free attack or a counter does not count. */
  attackedYet: boolean
  /** It has been kept standing at 1 hit point by Unbreakable this battle (skill trees step 18). */
  endured: boolean
  /** It has had action points refunded by Blademaster this turn (skill trees step 18). */
  refunded: boolean
  /** It has fallen this battle, whether or not it stands again (skill trees step 20). */
  fallenThisBattle: boolean
  /** The once-a-battle spells it has cast (skill trees step 20). */
  usedOnce: SpellId[]
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
 * What a blow's chance and damage owe to the attacker's traits, besides its
 * stats: the arc it strikes, whether it is a free attack (a counter's
 * included), and whether the attacker has stepped this turn and made an
 * own-turn attack yet this battle.
 */
export interface BlowContext {
  arc: Arc
  free: boolean
  moved: boolean
  attackedYet: boolean
}

/** Whether the blow is an Ambush: the first own-turn attack of the battle by a unit with the trait. */
export function ambushes(attacker: Pick<CombatantStats, 'traits'>, blow: Pick<BlowContext, 'free' | 'attackedYet'>): boolean {
  return !blow.free && !blow.attackedYet && attacker.traits?.includes('ambush') === true
}

/**
 * What the attacker's traits add to a blow's chance to hit: its `rear` to-hit
 * from the rear arc, its `opportunity` to-hit on a free attack, its
 * `movedToHit` on an own-turn attack after a step, `AMBUSH_BONUS` for an
 * Ambush. 0 for a unit with none of them.
 */
export function traitToHit(attacker: CombatantStats, blow: BlowContext): number {
  return (
    (blow.arc === 'rear' ? (attacker.rear?.toHit ?? 0) : 0) +
    (blow.free ? (attacker.opportunity?.toHit ?? 0) : 0) +
    (!blow.free && blow.moved ? (attacker.movedToHit ?? 0) : 0) +
    (ambushes(attacker, blow) ? AMBUSH_BONUS : 0)
  )
}

/**
 * What the attacker's traits add to a hit's damage after its dice (never
 * multiplied by a critical): its `rear` damage from the rear arc, its
 * `opportunity` damage on a free attack, its `critDamage` on a critical, and
 * its `execute` against a defender at half its hit points or less before the
 * blow.
 */
export function traitDamage(
  attacker: CombatantStats,
  blow: Pick<BlowContext, 'arc' | 'free'>,
  critical: boolean,
  defender: { hp: number; maxHp: number },
): number {
  return (
    (blow.arc === 'rear' ? (attacker.rear?.damage ?? 0) : 0) +
    (blow.free ? (attacker.opportunity?.damage ?? 0) : 0) +
    (critical ? (attacker.critDamage ?? 0) : 0) +
    (defender.hp <= Math.floor(defender.maxHp / 2) ? (attacker.execute ?? 0) : 0)
  )
}

/**
 * Whether a weapon hit that would leave the defender at `hp` is a
 * Deathblow: the attacker has the trait, the defender is not `blightborn`
 * and `hp` is a quarter of its maximum or less.
 */
export function deathblows(attacker: Pick<CombatantStats, 'traits'>, defender: Pick<CombatantStats, 'maxHp' | 'blightborn'>, hp: number): boolean {
  return attacker.traits?.includes('deathblow') === true && !defender.blightborn && hp <= Math.floor(defender.maxHp / 4)
}

/** What a Sanctuary heals each unit of its side within `SANCTUARY_RADIUS` (itself included) as their turn begins. */
export const SANCTUARY_HEAL = 3
export const SANCTUARY_RADIUS = 2

/** What Shadowdancer lays as its side's turn begins on a unit with no mirror image left. */
export const SHADOWDANCER_IMAGE = { turns: 2, images: 1 } as const

/** What Unbreakable lays on the unit it keeps standing. */
export const UNBREAKABLE_SHIELD: StatusLaid = { id: 'shielded', turns: 2 }

/** Whether the attacker's weapon attack is a Deadeye's shot: a ranged weapon in the hands of a unit with the trait. */
export function deadeyeShot(attacker: CombatantStats): boolean {
  return !isMelee(attacker) && attacker.traits?.includes('deadeye') === true
}

/** The points of resistance the attacker's weapon attack pierces: its `armorPierce`, and `DEADEYE_PIERCE` more for a Deadeye's shot. */
export function blowPierce(attacker: CombatantStats): number {
  return (attacker.armorPierce ?? 0) + (deadeyeShot(attacker) ? DEADEYE_PIERCE : 0)
}

/** The defender's resistance left against the attacker's weapon attack once `blowPierce` has pierced it (`effectiveResistance`). */
export function resistanceLeft(attacker: CombatantStats, defenderResistance: number): number {
  return effectiveResistance({ ...attacker, armorPierce: blowPierce(attacker) }, defenderResistance)
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
 * What a hostile roll by `attacker` at `target` loses for Taunted:
 * `TAUNT_PENALTY` when the attacker is taunted by a unit other than the
 * target, else 0.
 */
export function tauntPenalty(attacker: { statuses: readonly ActiveStatus[] }, target: { id: UnitId }): number {
  const taunted = attacker.statuses.find((s) => s.id === 'taunted')
  return taunted && taunted.source !== target.id ? TAUNT_PENALTY : 0
}

/** Whether the unit is helpless: a status whose rule is `helpless` (Asleep, Frozen) is on it. No AP, no zone of control, `HELPLESS_BONUS` against it. */
export function isHelpless(unit: { statuses: readonly ActiveStatus[] }): boolean {
  return unit.statuses.some(({ id }) => STATUSES[id].helpless === true)
}

/** Whether the unit cannot move: a status whose rule is `immobile` (Pinned) is on it. */
export function isImmobile(unit: { statuses: readonly ActiveStatus[] }): boolean {
  return unit.statuses.some(({ id }) => STATUSES[id].immobile === true)
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
  let wardAll = 0
  for (const { id } of unit.statuses) {
    wardAll += STATUSES[id].wardAll ?? 0
    ac += STATUSES[id].armorClass ?? 0
    toHit += STATUSES[id].toHit ?? 0
    resistance += STATUSES[id].resistance ?? 0
  }
  const { stats } = unit
  let wards = stats.wards
  if (wardAll !== 0) {
    const all: Partial<Record<Element, number>> = { ...stats.wards }
    for (const e of ELEMENTS) all[e] = (all[e] ?? 0) + wardAll
    wards = all
  }
  return {
    ...stats,
    ...(wards === stats.wards ? {} : { wards }),
    ac: ac === 0 ? stats.ac : Math.max(0, stats.ac + ac),
    ...(resistance === 0 ? {} : { resistance: Math.max(0, (stats.resistance ?? 0) + resistance) }),
    toHit: stats.toHit + toHit,
    ...(stats.magic ? { magic: { ...stats.magic, skill: stats.magic.skill + toHit } } : {}),
  }
}

/** What the auras of a unit's standing allies add to its stats. */
export interface AuraBonus {
  ac: number
  toHit: number
  resistance: number
  wardAll: number
}

const NO_AURA: AuraBonus = { ac: 0, toHit: 0, resistance: 0, wardAll: 0 }

/**
 * The auras, by the trait that holds one: how far it reaches, whether it
 * covers its holder, and what it adds. Two of a kind do not stack.
 */
export const AURAS: Readonly<Record<'guardian' | 'courage' | 'aegis', { radius: number; self: boolean; bonus: Partial<AuraBonus> }>> = {
  guardian: { radius: 1, self: false, bonus: { ac: 5 } },
  courage: { radius: 2, self: false, bonus: { toHit: 5 } },
  aegis: { radius: 2, self: true, bonus: { resistance: 2, wardAll: 2 } },
}
const AURA_KINDS = Object.keys(AURAS) as Array<keyof typeof AURAS>

/** `auraBonus` over any kind of unit, its traits read by `traitsOf`. */
function auraOver<U extends Placed>(units: readonly U[], unit: U, traitsOf: (u: U) => readonly TraitId[] | undefined): AuraBonus {
  let bonus = NO_AURA
  for (const kind of AURA_KINDS) {
    const { radius, self, bonus: adds } = AURAS[kind]
    const held = units.some(
      (u) =>
        u.hp > 0 &&
        u.side === unit.side &&
        (self || u.id !== unit.id) &&
        traitsOf(u)?.includes(kind) === true &&
        hexDistance(u.position, unit.position) <= radius,
    )
    if (!held) continue
    bonus = {
      ac: bonus.ac + (adds.ac ?? 0),
      toHit: bonus.toHit + (adds.toHit ?? 0),
      resistance: bonus.resistance + (adds.resistance ?? 0),
      wardAll: bonus.wardAll + (adds.wardAll ?? 0),
    }
  }
  return bonus
}

/**
 * What the auras of `unit`'s standing allies within reach add to it: for
 * each kind (Guardian +5 armour class within 1, not itself; Aura of Courage
 * +5 to hit within 2, not itself; Aegis +2 resistance and +2 ward against
 * every element within 2, itself included), the kind's bonus if any holder
 * reaches it, however many do.
 */
export function auraBonus(units: readonly UnitSnapshot[], unit: UnitSnapshot): AuraBonus {
  return auraOver(units, unit, (u) => u.traits)
}

/** `stats` with an aura bonus added: armour class, the chance to hit (spells' too), resistance and every ward. */
function withAura(stats: CombatantStats, bonus: AuraBonus): CombatantStats {
  if (bonus === NO_AURA) return stats
  let { wards } = stats
  if (bonus.wardAll !== 0) {
    const all: Partial<Record<Element, number>> = { ...stats.wards }
    for (const e of ELEMENTS) all[e] = (all[e] ?? 0) + bonus.wardAll
    wards = all
  }
  return {
    ...stats,
    ...(wards === stats.wards ? {} : { wards }),
    ac: stats.ac + bonus.ac,
    ...(bonus.resistance === 0 ? {} : { resistance: (stats.resistance ?? 0) + bonus.resistance }),
    toHit: stats.toHit + bonus.toHit,
    ...(stats.magic && bonus.toHit !== 0 ? { magic: { ...stats.magic, skill: stats.magic.skill + bonus.toHit } } : {}),
  }
}

/**
 * The stats every roll reads of a unit where it stands among `units`:
 * `effectiveStats` (its statuses) plus `auraBonus` (its allies' auras). The
 * engine reads the same through its records; previews and the policies
 * read it through this.
 */
export function statsIn(units: readonly UnitSnapshot[], unit: UnitSnapshot): CombatantStats {
  return withAura(effectiveStats({ stats: unit, statuses: unit.statuses }), auraBonus(units, unit))
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

/** The area of an ability as a unit of `attackRange` aims it: its shape, its range (the weapon's for `weaponRange`) and radius. */
export function abilityArea(ability: AbilityId, attackRange: number): AreaSpec | null {
  const area = ABILITIES[ability].area
  if (!area) return null
  return { shape: area.shape, range: area.weaponRange ? attackRange : area.range, radius: area.radius }
}

/**
 * The standing units an area ability of `user` (whose weapon reaches
 * `attackRange`) aimed at `at` touches, in roster order: everyone in its
 * shape, both sides, or only the user's foes for a `foesOnly` area. The
 * engine resolves the ability over these, and the policies judge it by them.
 */
export function abilityTouches<U extends Placed>(units: readonly U[], user: Placed, ability: AbilityId, at: Hex, attackRange: number): U[] {
  const spec = abilityArea(ability, attackRange)
  if (!spec) return []
  const touched = areaTouches(units, user, spec, at, true)
  return ABILITIES[ability].area!.foesOnly ? touched.filter((u) => u.side !== user.side) : touched
}

/**
 * The units a cast of `spell` by `caster` aimed at `aim` would touch, in
 * roster order, whether or not it is legal: the standing target of a spell
 * aimed at a unit, or the fallen one of a spell aimed at the fallen; for an area, every standing unit in its shape (`areaTouches`),
 * everyone for a hostile spell, the caster's own side for a friendly
 * one. The engine resolves a cast over these, and the policies and the
 * battle screen judge one by them, so that the three agree.
 */
export function castTouches<U extends Placed>(units: readonly U[], caster: Placed, spell: SpellId, aim: CastAim): U[] {
  const { target, range, radius, shape = 'burst', hostile } = SPELLS[spell]
  if (target !== 'area') {
    if (!('target' in aim)) return []
    // A spell aimed at the fallen touches its target at 0 hit points.
    return units.filter((u) => u.id === aim.target && (target === 'fallen' ? u.hp <= 0 : u.hp > 0))
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
      // A battle saved before units kept `moved` (save version 23 and older) takes it up as false,
      // and one saved before the stage-3 fields (version 24 and older) takes them up at their defaults.
      this.units = units.map((u) => ({
        ...u,
        moved: u.moved ?? false,
        attackedYet: u.attackedYet ?? false,
        endured: u.endured ?? false,
        refunded: u.refunded ?? false,
        fallenThisBattle: u.fallenThisBattle ?? false,
        usedOnce: u.usedOnce ?? [],
      }))
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
      moved: false,
      attackedYet: false,
      endured: false,
      refunded: false,
      fallenThisBattle: false,
      usedOnce: [],
    }))

    let seed: number | null = null
    if (options.rng) {
      this.rng = options.rng
    } else {
      seed = options.seed ?? randomSeed()
      this.seeded = mulberry32(seed)
      this.rng = this.seeded
    }

    this.readySide('player')
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
    if (this.checkWinner() === null) this.turnBegins('player')
  }

  /** The stats every roll reads of `unit`: its statuses' (`effectiveStats`) and its allies' auras (`statsIn`). */
  private statsOf(unit: UnitRecord): CombatantStats {
    return withAura(effectiveStats(unit), auraOver(this.units, unit, (u) => u.stats.traits))
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
   * centres in board order (row, then column); then for each ability it can
   * use now (`canUse`), in its `abilities` order, a routine at each standing
   * foe in its attack range, in roster order, an area at each legal aim in
   * board order, a status on itself once (aimed at its own id), or a status
   * on each standing foe within the ability's range; then end_turn. Empty once the battle is over. Equip actions
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
        const area = ABILITIES[ability].area
        if (area) {
          for (const at of area.centredOnSelf ? [actor.position] : this.board.hexes) {
            if (this.canAim(actor, ability, at)) actions.push({ type: 'ability', unit: actor.id, ability, at })
          }
          continue
        }
        for (const unit of this.units) {
          if (this.canTarget(actor, ability, unit)) actions.push({ type: 'ability', unit: actor.id, ability, target: unit.id })
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
    return this.blowOdds(actor, foe, 0)
  }

  /** The odds of a blow of `actor` at `foe` now, as `attack` rolls them, with `toHit` added (a technique's). */
  private blowOdds(actor: UnitRecord, foe: UnitRecord, toHit: number): AttackPreview {
    const flankers = flankersOf(this.units, actor, foe)
    const flankBonus = flankers.length * FLANK_BONUS_PER_ALLY
    const arc = arcStruck(foe, actor.position, isMelee(actor.stats))
    const arcBonus = ARC_BONUS[arc]
    const helpless = isHelpless(foe) ? HELPLESS_BONUS : 0
    const attacker = this.statsOf(actor)
    const defender = this.statsOf(foe)
    const traits = traitToHit(attacker, { arc, free: false, moved: actor.moved, attackedYet: actor.attackedYet })
    const chance = hitChance(attacker, defender.ac, flankBonus + arcBonus + helpless + toHit + traits - tauntPenalty(actor, foe))
    return { flankers, flankBonus, arc, arcBonus, hitChance: chance, resistance: resistanceLeft(attacker, defender.resistance ?? 0) }
  }

  /**
   * The costs of a legal use of an ability, whom it would touch and the odds
   * on each, or null if the use isn't legal now. `target` is a unit's id, or
   * for an area the hex it is aimed at. It draws nothing.
   */
  previewAbility(unit: UnitId, ability: AbilityId, target: UnitId | Hex): AbilityPreview | null {
    const actor = this.units.find((u) => u.id === unit)
    if (this.phase === 'over' || !actor || !this.canAct(actor)) return null
    const known = ABILITIES[ability]
    const cost = { apCost: abilityApCost(actor.stats, ability), manaCost: known.manaCost ?? 0 }
    if (typeof target !== 'string') {
      if (!this.canAim(actor, ability, target)) return null
      const attacker = this.statsOf(actor)
      const touched = abilityTouches(this.units, actor, ability, target, attacker.attackRange)
      return {
        ...cost,
        outcomes: touched.map((u) => ({
          unit: u.id,
          hitChance: known.area!.auto ? null : hitChance(attacker, this.statsOf(u).ac, -tauntPenalty(actor, u)),
        })),
      }
    }
    const foe = this.units.find((u) => u.id === target)
    if (!foe || !this.canTarget(actor, ability, foe)) return null
    const first = known.strikes?.[0]
    return { ...cost, outcomes: [{ unit: foe.id, hitChance: first ? this.blowOdds(actor, foe, first.toHit ?? 0).hitChance : null }] }
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
    const { manaCost, hostile } = SPELLS[spell]
    const stats = this.statsOf(actor)
    const caster = spellcaster(stats, spell)
    return {
      apCost: spellApCost(stats, spell),
      manaCost,
      outcomes: castTouches(this.units, actor, spell, aim).map((u) => ({
        unit: u.id,
        hitChance: hostile ? hitChance(caster, this.statsOf(u).ac, -tauntPenalty(actor, u)) : null,
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
      const events = [...this.root(side), ...this.countDownStatuses(side)]
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
      if (!target || !this.canTarget(actor, action.ability, target)) {
        throw new Error(`${actor.id} cannot use ${action.ability} on ${action.target}`)
      }
      const { selfStatus, foeStatus } = ABILITIES[action.ability]
      if (selfStatus || foeStatus) return this.statusAbility(actor, action.ability, target)
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
   * The start of `side`'s turn: `readySide`, then `turnBegins`.
   */
  private startTurn(side: Side): BattleEvent[] {
    this.readySide(side)
    return this.turnBegins(side)
  }

  /**
   * Refills the side's action points, less or more by their statuses, and
   * readies the other side's free attacks and turns to meet a blow (not a
   * helpless unit's). It logs nothing; the battle's first turn does it before
   * `battle_start` is logged, so that the units it shows are ready.
   */
  private readySide(side: Side): void {
    this.phase = side
    for (const u of this.units) {
      if (u.side === side) {
        u.ap = u.hp > 0 ? apAfterStatuses(u, u.stats.actionPoints) : 0
        u.turnReady = false
        u.moved = false
        u.refunded = false
      } else {
        u.reactionReady = u.hp > 0 && !isHelpless(u)
        u.turnReady = u.reactionReady
      }
      u.gearChangePaid = false
    }
  }

  /**
   * What happens to the side's units as its turn begins, logged after
   * `battle_start` on the battle's first turn: its statuses' damage, unit by
   * unit in roster order, which may fell units and end the battle before the
   * side acts (and then nothing more is done but the count-down); then, each
   * a pass over the side's standing units in roster order, regeneration
   * (unless a status stops it), Renewing (likewise), Sanctuary, Serenity and
   * Shadowdancer (`restores`); then a round comes off what the side's
   * standing units have recharging, a helpless unit's included. If a tick
   * ends the battle, it returns there and none of the rest is done. Nothing
   * after the ticks draws.
   */
  private turnBegins(side: Side): BattleEvent[] {
    const events: BattleEvent[] = []
    for (const u of this.units) {
      if (u.side !== side || u.hp <= 0) continue
      for (const status of [...u.statuses]) {
        const { tick, element } = STATUSES[status.id]
        if (!tick || u.hp <= 0 || this.winner !== null) continue
        const rolled = rollDamage(tick, this.rng)
        const damage = warded(rolled, element, this.statsOf(u))
        const hpBefore = u.hp
        const endured = this.applyDamage(u, damage)
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
            ...(endured ? { endured: true as const } : {}),
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
    events.push(...this.restores(side))
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
   * The turn-start passes after regeneration, each over the side's standing
   * units in roster order: Renewing (each status's `regen`, unless a status
   * stops regeneration), Sanctuary (`SANCTUARY_HEAL` from the first standing
   * Sanctuary unit of the side within `SANCTUARY_RADIUS`, itself included;
   * one heal a unit), Serenity (`manaRegen`, up to the maximum mana), then
   * Shadowdancer (Mirrored with one image for 2 turns, on a unit with no
   * image left). A heal or restore of 0 logs nothing. None draws.
   */
  private restores(side: Side): BattleEvent[] {
    const events: BattleEvent[] = []
    const standing = () => this.units.filter((u) => u.side === side && u.hp > 0)
    const heal = (u: UnitRecord, amount: number, cause: RestoreEvent['cause'], source?: UnitId) => {
      const hp = Math.min(amount, u.stats.maxHp - u.hp)
      if (hp <= 0) return
      u.hp += hp
      events.push(this.record<RestoreEvent>({ type: 'restore', round: this.round, unit: u.id, hp, cause, ...(source ? { source } : {}) }))
    }
    for (const u of standing()) {
      if (u.statuses.some(({ id }) => STATUSES[id].stopsRegeneration)) continue
      const regen = u.statuses.reduce((sum, { id }) => sum + (STATUSES[id].regen ?? 0), 0)
      if (regen > 0) heal(u, regen, 'renewing')
    }
    const sanctuaries = standing().filter((u) => u.stats.traits?.includes('sanctuary'))
    if (sanctuaries.length > 0) {
      for (const u of standing()) {
        const source = sanctuaries.find((s) => hexDistance(s.position, u.position) <= SANCTUARY_RADIUS)
        if (source) heal(u, SANCTUARY_HEAL, 'sanctuary', source.id)
      }
    }
    for (const u of standing()) {
      const mana = Math.min(u.stats.manaRegen ?? 0, (u.stats.magic?.maxMana ?? 0) - u.mana)
      if (mana <= 0) continue
      u.mana += mana
      events.push(this.record<RestoreEvent>({ type: 'restore', round: this.round, unit: u.id, mana, cause: 'serenity' }))
    }
    for (const u of standing()) {
      if (!u.stats.traits?.includes('shadowdancer')) continue
      if ((u.statuses.find((st) => st.id === 'mirrored')?.images ?? 0) >= 1) continue
      const { turns, images } = SHADOWDANCER_IMAGE
      this.layStatus(u, { id: 'mirrored', turns, images })
      events.push(this.record<StatusLaidEvent>({ type: 'status_laid', round: this.round, unit: u.id, status: 'mirrored', turns, cause: 'shadowdancer' }))
    }
    return events
  }

  /**
   * As `side`'s turn ends, before its statuses count down: Rooted laid for 2
   * turns on each of its standing units with the trait `rooted` that has not
   * moved this turn, in roster order, so that 1 is left through the other
   * side's turn. It draws nothing.
   */
  private root(side: Side): BattleEvent[] {
    const events: BattleEvent[] = []
    for (const u of this.units) {
      if (u.side !== side || u.hp <= 0 || u.moved || !u.stats.traits?.includes('rooted')) continue
      const turns = 2
      this.layStatus(u, { id: 'rooted', turns })
      events.push(this.record<StatusLaidEvent>({ type: 'status_laid', round: this.round, unit: u.id, status: 'rooted', turns, cause: 'rooted' }))
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

  /** Damage ends each status that `wakesOnDamage` (Asleep) on a unit that still stands. */
  private wake(unit: UnitRecord, damage: number): BattleEvent[] {
    return wakings(unit, damage).flatMap((status) => this.endStatus(unit, status, 'woke'))
  }

  /**
   * Lays a status on `unit`. The same status again takes the longer of the
   * two durations, and its images anew; a new one laid on the unit's own
   * side's turn changes its action points at once. Taunted names the unit
   * that laid it (`source`), the newer taunter replacing the old; no other
   * status keeps one.
   */
  private layStatus(unit: UnitRecord, laid: StatusLaid, by?: UnitRecord): ActiveStatus {
    const source = laid.id === 'taunted' ? by?.id : undefined
    const existing = unit.statuses.find((s) => s.id === laid.id)
    if (existing) {
      existing.turnsLeft = Math.max(existing.turnsLeft, laid.turns)
      if (laid.images !== undefined) existing.images = laid.images
      if (source !== undefined) existing.source = source
      return { ...existing }
    }
    const status: ActiveStatus = {
      id: laid.id,
      turnsLeft: laid.turns,
      ...(laid.images !== undefined ? { images: laid.images } : {}),
      ...(source !== undefined ? { source } : {}),
    }
    unit.statuses.push(status)
    const rule = STATUSES[laid.id]
    if (unit.side === this.phase) {
      if (rule.helpless) unit.ap = 0
      else if (rule.actionPoints) unit.ap = Math.max(0, unit.ap + rule.actionPoints)
    }
    if (rule.helpless) {
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

  /**
   * Whether `actor` has `ability` and can use it now: it holds the weapon the
   * ability `needs`, has its action points (`abilityApCost`) and its mana,
   * and it is not recharging.
   */
  private canUse(actor: UnitRecord, ability: AbilityId): boolean {
    const known = ABILITIES[ability]
    return (
      known !== undefined &&
      actor.stats.abilities?.includes(ability) === true &&
      (known.needs === undefined || (known.needs === 'melee') === isMelee(actor.stats)) &&
      actor.ap >= abilityApCost(actor.stats, ability) &&
      actor.mana >= (known.manaCost ?? 0) &&
      (actor.recharging[ability] ?? 0) <= 0
    )
  }

  /**
   * Whether `actor` can use the `ability` aimed at a unit on `target`: it can
   * use it, and the target suits it: a standing foe within its attack range
   * for a routine, itself for a status on itself, a standing foe within the
   * ability's range for a status on a foe.
   */
  private canTarget(actor: UnitRecord, ability: AbilityId, target: UnitRecord): boolean {
    const { strikes, selfStatus, foeStatus } = ABILITIES[ability]
    if (!this.canUse(actor, ability)) return false
    if (selfStatus) return target === actor
    if (foeStatus) {
      const range = foeStatus.range === 'weapon' ? actor.stats.attackRange : foeStatus.range
      return target.side !== actor.side && target.hp > 0 && hexDistance(target.position, actor.position) <= range
    }
    return strikes !== undefined && this.canAttack(actor, target)
  }

  /**
   * Whether `actor` can use the area `ability` aimed at `at`: it can use it,
   * `at` is on the board, its own hex for an area centred on it, else within
   * range (the weapon's for `weaponRange`) for a burst or 1 to range away for
   * a cone or line, and the area touches a standing foe (`abilityTouches`).
   */
  private canAim(actor: UnitRecord, ability: AbilityId, at: Hex): boolean {
    const area = ABILITIES[ability]?.area
    if (!area || !this.canUse(actor, ability) || !this.board.contains(at)) return false
    if (area.centredOnSelf && !hexEquals(at, actor.position)) return false
    const { attackRange } = this.statsOf(actor)
    const { range } = abilityArea(ability, attackRange)!
    const distance = hexDistance(at, actor.position)
    if (distance > range || (area.shape !== 'burst' && distance < 1)) return false
    return abilityTouches(this.units, actor, ability, at, attackRange).some((u) => u.side !== actor.side)
  }

  /** Whether `actor` knows `spell`, has the action points and mana for it and, for a spell once a battle, has not cast it yet. */
  private canPayFor(actor: UnitRecord, spell: SpellId): boolean {
    const known = SPELLS[spell]
    return (
      known !== undefined &&
      actor.stats.magic?.spells.includes(spell) === true &&
      actor.ap >= spellApCost(this.statsOf(actor), spell) &&
      actor.mana >= known.manaCost &&
      !(known.oncePerBattle && actor.usedOnce.includes(spell))
    )
  }

  /**
   * Whether `actor` can cast `spell` at `aim`: it can pay for it, and the aim
   * suits the spell: a standing foe within range, a standing ally (itself
   * included) within range, itself, a hex of the board within range, its
   * own for a spell centred on it, or an ally within range that fell this
   * battle, at 0 hit points, on a hex no standing unit holds; a hostile area
   * must hold a standing foe.
   */
  private canCast(actor: UnitRecord, spell: SpellId, aim: CastAim): boolean {
    if (!this.canPayFor(actor, spell)) return false
    const { target: kind, hostile, shape = 'burst' } = SPELLS[spell]
    const range = spellRange(this.statsOf(actor), spell)
    if (kind === 'area') {
      if (!('at' in aim) || !this.board.contains(aim.at)) return false
      const distance = hexDistance(aim.at, actor.position)
      if (distance > range || (shape !== 'burst' && distance < 1)) return false
      return !hostile || castTouches(this.units, actor, spell, aim).some((u) => u.side !== actor.side)
    }
    if (!('target' in aim)) return false
    const target = this.units.find((u) => u.id === aim.target)
    if (!target) return false
    if (kind === 'fallen') {
      return (
        target.side === actor.side &&
        target.hp <= 0 &&
        target.fallenThisBattle &&
        hexDistance(target.position, actor.position) <= range &&
        !this.units.some((u) => u.hp > 0 && hexEquals(u.position, target.position))
      )
    }
    if (target.hp <= 0) return false
    if (kind === 'self') return target === actor
    const side = kind === 'foe' ? target.side !== actor.side : target.side === actor.side
    return side && hexDistance(target.position, actor.position) <= range
  }

  /** Foes that would strike `mover` for stepping from `hex` to `to`: those it leaves the side of. */
  private reactorsAt(mover: UnitRecord, hex: Hex, to: Hex): UnitRecord[] {
    // Tumble slips through every zone of control.
    if (mover.stats.traits?.includes('tumble')) return []
    return this.units.filter(
      (u) =>
        u.side !== mover.side &&
        u.hp > 0 &&
        u.reactionReady &&
        !isHelpless(u) &&
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

    // The first step ends Rooted, before any free attack it provokes is rolled.
    actor.moved = true
    if (hasStatus(actor, 'rooted')) events.push(...this.endStatus(actor, 'rooted', 'moved'))
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
   * each foe strikes at most once. None for an immobile unit (Pinned).
   */
  private reachable(actor: UnitRecord): Map<string, Hex[]> {
    if (isImmobile(actor)) return new Map()
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

  /** Pays an ability's action points and mana as it begins and sets its recharge; a paid-for change of gear ends. */
  private payFor(actor: UnitRecord, abilityId: AbilityId): { apCost: number; manaCost: number | undefined } {
    const ability = ABILITIES[abilityId]
    const apCost = abilityApCost(actor.stats, abilityId)
    actor.ap -= apCost
    if (ability.manaCost !== undefined) actor.mana -= ability.manaCost
    actor.gearChangePaid = false
    if (ability.recharge >= 1) actor.recharging[abilityId] = ability.recharge
    return { apCost, manaCost: ability.manaCost }
  }

  /**
   * Pays for a legal routine and makes its strikes in order, each a weapon
   * attack: with the strike's dice and the unit's `abilityDamageBonus`, or
   * for a technique's strike (`weapon`) the unit's own weapon with the
   * strike's modifiers. A strike that `spreads` goes to another standing
   * foe in reach than the strike before it, chosen before its roll (the
   * nearest, the lowest id on a tie), else to the same foe. A strike whose
   * target has fallen goes to the nearest standing foe in reach, the lowest
   * id on a tie; with none, it and the rest are not made. The routine stops
   * when the battle ends.
   */
  private routine(actor: UnitRecord, abilityId: AbilityId, target: UnitRecord): BattleEvent[] {
    const ability = ABILITIES[abilityId]
    const { apCost, manaCost } = this.payFor(actor, abilityId)
    const bonus = actor.stats.abilityDamageBonus ?? 0
    const events: BattleEvent[] = []
    let foe: UnitRecord | null = target
    for (const [i, strike] of (ability.strikes ?? []).entries()) {
      if (this.phase === 'over') break
      if (strike.spreads) foe = this.nearestFoeInReach(actor, foe) ?? (foe.hp > 0 ? foe : null)
      if (foe && foe.hp <= 0) foe = this.nearestFoeInReach(actor)
      if (!foe) break
      const dice = strike.damage ? { ...strike.damage, bonus: strike.damage.bonus + bonus } : actor.stats.damage
      const first = i === 0
      const mana = first && manaCost !== undefined ? manaCost : undefined
      events.push(...this.attack(actor, foe, first ? apCost : 0, { ability: abilityId, strike, dice, manaCost: mana, actionApCost: apCost }))
      // A counter may fell the user between strikes.
      if (actor.hp <= 0) break
    }
    return events
  }

  /**
   * Pays for a legal ability that lays a status with no roll and lays it, on
   * the user itself or on the foe it is aimed at, to which the user turns.
   * It draws nothing from the RNG.
   */
  private statusAbility(actor: UnitRecord, abilityId: AbilityId, target: UnitRecord): BattleEvent[] {
    const ability = ABILITIES[abilityId]
    const laid = ability.selfStatus ?? ability.foeStatus!.status
    const { apCost, manaCost } = this.payFor(actor, abilityId)
    if (target !== actor) actor.facing = hexDirectionTowards(actor.position, target.position)!
    const hpBefore = target.hp
    const status = this.layStatus(target, laid)
    const outcome: CastOutcome = {
      unit: target.id, attackRoll: null, chance: null, defenderAc: null, hit: true, critical: false, fumble: false, image: false,
      damage: 0, warded: 0, half: false, healed: 0, hpBefore, hpAfter: target.hp, status,
    }
    return [
      this.record<AbilityEvent>({
        type: 'ability',
        round: this.round,
        unit: actor.id,
        ability: abilityId,
        at: target.position,
        shape: 'burst',
        hexes: [target.position],
        distance: hexDistance(actor.position, target.position),
        apCost,
        apAfter: actor.ap,
        facing: actor.facing,
        skill: this.statsOf(actor).toHit,
        outcomes: [outcome],
        ...(manaCost !== undefined ? { manaCost, manaAfter: actor.mana } : {}),
      }),
    ]
  }

  /**
   * The standing foe within `actor`'s attack range nearest it, the lowest id
   * on a tie, other than `besides` if given; null if none.
   */
  private nearestFoeInReach(actor: UnitRecord, besides?: UnitRecord | null): UnitRecord | null {
    let nearest: UnitRecord | null = null
    let gap = Infinity
    for (const u of this.units) {
      if (u === besides || !this.canAttack(actor, u)) continue
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
   * lays its status on a hit that leaves the target standing. A technique's
   * strike adds its `toHit` to the chance, its `damageBonus` to a hit's
   * damage after a critical's doubling, and its `onHit` entries (an elemental
   * one raised by the unit's `imbueDamage`) after the weapon's; it draws as a
   * plain attack does. The attacker's traits add to the chance and the
   * damage (`traitToHit`, `traitDamage`), pierce (`blowPierce`), triple a
   * Deadeye's ranged critical, make an Ambush's hit critical and restore mana
   * on a melee hit, none of it drawing anything. A Deathblow, judged on the
   * hit points the hit leaves without Unbreakable, fells the defender (which
   * then does not endure); else the damage goes through `applyDamage`
   * (Unbreakable). Blademaster gives
   * back the AP of an own action that felled (`actionApCost`, for a routine's
   * later strikes), after the event is recorded. A melee blow of the side in
   * turn that misses a defender with Counter is answered at once by a free
   * attack (`counter`), before anything else the action does.
   */
  private attack(
    actor: UnitRecord,
    target: UnitRecord,
    apCost: number | null,
    strike?: { ability: AbilityId; strike: Strike; dice: DamageRoll; manaCost?: number; actionApCost?: number },
    counter = false,
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
    const helpless = isHelpless(target)
    const attacker = this.statsOf(actor)
    const defender = this.statsOf(target)
    const defenderAc = defender.ac
    const defenderResistance = defender.resistance ?? 0
    const technique = strike?.strike
    const taunt = tauntPenalty(actor, target)
    const blow: BlowContext = { arc, free: apCost === null, moved: actor.moved, attackedYet: actor.attackedYet }
    const ambush = ambushes(attacker, blow)
    const traitBonus = traitToHit(attacker, blow)
    // Only an own-turn attack counts towards Ambush; a free attack or a counter does not.
    if (!blow.free) actor.attackedYet = true
    const roll = rollToHit(
      attacker,
      defenderAc,
      this.rng,
      flankBonus + arcBonus + (helpless ? HELPLESS_BONUS : 0) + (technique?.toHit ?? 0) + traitBonus - taunt,
    )
    // An Ambush's hit is critical with no second draw.
    const critical = roll.critical || (ambush && roll.hit)
    const image = roll.hit && this.strikeImage(target)
    const dice = strike?.dice ?? attacker.damage
    const multiplier = deadeyeShot(attacker) ? DEADEYE_CRIT_MULTIPLIER : 2
    // A technique's damage bonus and the traits' come after a critical's multiplying, so they are never multiplied.
    const rolled =
      roll.hit && !image
        ? rollHitDamage(dice, critical, this.rng, multiplier) +
          (technique?.damageBonus ?? 0) +
          traitDamage(attacker, blow, critical, { hp: target.hp, maxHp: defender.maxHp })
        : 0
    const damage = damageThrough(rolled, resistanceLeft(attacker, defenderResistance))
    const result = { ...roll, critical, damage }
    const landed = roll.hit && !image
    const imbue = actor.stats.imbueDamage ?? 0
    const added = (technique?.onHit ?? []).map((entry) => (entry.element && imbue !== 0 ? { ...entry, damage: entry.damage + imbue } : entry))
    const onHit = landed ? [...(attacker.onHit ?? []), ...added] : []
    const bonus: AttackBonus[] = onHit
      .filter((entry) => entry.damage > 0 && (!entry.bane || baneApplies(defender)))
      .map((entry) => ({
        ...(entry.element ? { element: entry.element } : {}),
        ...(entry.bane ? { bane: true as const } : {}),
        rolled: entry.damage,
        damage: warded(entry.damage, entry.element, defender),
      }))
    const total = damage + bonus.reduce((sum, b) => sum + b.damage, 0)
    const defenderHpBefore = target.hp
    // Deathblow is judged on what the hit leaves without Unbreakable: a hit it fells is not endured,
    // and one lethal by itself is a deathblow only where Unbreakable would have kept the unit standing.
    const left = Math.max(0, target.hp - total)
    const deathblow = landed && (left > 0 || this.wouldEndure(target, total)) && deathblows(attacker, defender, left)
    const endured = deathblow ? false : this.applyDamage(target, total)
    if (deathblow) target.hp = 0
    const heals = onHit.some((entry) => entry.heal !== undefined)
    const healing = onHit.reduce((sum, entry) => sum + (entry.heal ?? 0), 0)
    const healed = heals ? Math.min(healing, Math.max(0, actor.stats.maxHp - actor.hp)) : 0
    actor.hp += healed
    // Blademaster: an own action that fells gives back what it paid, once a turn.
    const refund =
      apCost !== null && target.hp <= 0 && !actor.refunded && actor.stats.traits?.includes('blademaster') === true
        ? (strike?.actionApCost ?? apCost)
        : 0
    const laid = strike?.strike.status && landed && target.hp > 0 ? this.layStatus(target, strike.strike.status) : null
    const onHitStatuses = onHit
      .filter((entry) => entry.status && (!entry.onCrit || critical))
      .flatMap((entry) => (target.hp > 0 ? [this.layStatus(target, entry.status!)] : []))
    // A technique's mana was paid as it began; what a hit restores comes after.
    const manaPaid = actor.mana
    const manaRestored =
      landed && isMelee(actor.stats) && actor.stats.magic
        ? Math.min(actor.stats.manaOnHit ?? 0, Math.max(0, actor.stats.magic.maxMana - actor.mana))
        : 0
    actor.mana += manaRestored

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
        armorPierce: blowPierce(attacker),
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
        bonus,
        ...(heals ? { healed } : {}),
        ...(onHitStatuses.length > 0 ? { onHitStatuses } : {}),
        ...(strike?.manaCost !== undefined ? { manaCost: strike.manaCost, manaAfter: manaPaid } : {}),
        ...(taunt > 0 ? { tauntPenalty: taunt } : {}),
        ...(traitBonus !== 0 ? { traitBonus } : {}),
        ...(counter ? { counter: true as const } : {}),
        ...(ambush ? { ambush: true as const } : {}),
        ...(manaRestored > 0 ? { manaRestored } : {}),
        ...(deathblow ? { deathblow: true as const } : {}),
        ...(refund > 0 ? { apRefunded: refund } : {}),
        ...(endured ? { endured: true as const } : {}),
      }),
    ]
    if (refund > 0) {
      actor.ap += refund
      actor.refunded = true
    }

    events.push(...this.imagesSpent(target), ...this.wake(target, total), ...this.fell(target))
    if (!roll.hit && this.counters(target, actor)) {
      target.reactionReady = false
      events.push(...this.attack(target, actor, null, undefined, true))
    }
    return events
  }

  /**
   * Whether `defender` strikes back at `attacker`, whose blow just missed it:
   * the battle goes on, the attacker is of the side in turn and struck with a
   * melee weapon, and the defender has Counter, its free attack ready, a melee
   * weapon and the attacker within its reach.
   */
  private counters(defender: UnitRecord, attacker: UnitRecord): boolean {
    return (
      this.phase === attacker.side &&
      attacker.hp > 0 &&
      defender.hp > 0 &&
      isMelee(attacker.stats) &&
      defender.stats.traits?.includes('counter') === true &&
      defender.reactionReady &&
      isMelee(defender.stats) &&
      hexDistance(defender.position, attacker.position) <= this.statsOf(defender).attackRange
    )
  }

  /**
   * Pays for a legal cast and resolves it over every unit it touches, in
   * roster order. A hostile spell rolls to hit each: on a hit a mirror image
   * takes it if there is one, drawing nothing more, and otherwise the
   * spell's dice are drawn (their count doubled against the bane-struck for
   * a `bane` spell, and its `bonusVs` dice after them against a unit with one
   * of its statuses before the roll) and its status laid on a unit left
   * standing. A friendly one ends its target's hostile statuses for a
   * `cleanse` spell (drawing nothing), draws its heal, if any, and lays its
   * status; one aimed at the fallen (Revive) stands its target up again at a
   * quarter of its maximum hit points, at least 1, its statuses gone, with no
   * AP and no reaction, drawing nothing. A spell once a battle is marked
   * used. Then the cleansed statuses' ends, the wakings, images spent and
   * falls, and at most one end of the battle.
   */
  private cast(actor: UnitRecord, spell: SpellId, aim: CastAim): BattleEvent[] {
    const { manaCost, hostile, damage: dice, element, drain, heal, status: ownStatus, bane, bonusVs, cleanse, oncePerBattle, target: aimedAt } = SPELLS[spell]
    const touched = castTouches(this.units, actor, spell, aim)
    const at = aimHex(this.units, aim)!
    const stats = this.statsOf(actor)
    const magic = stats.magic
    const apCost = spellApCost(stats, spell)
    // The caster's modifiers: flat, so they draw nothing.
    const power = (magic?.power?.all ?? 0) + (element === 'fire' ? (magic?.power?.fire ?? 0) : 0) + (element === 'frost' ? (magic?.power?.frost ?? 0) : 0)
    const extension = (hostile ? magic?.extend?.hostile : magic?.extend?.friendly) ?? 0
    const status = ownStatus && extension !== 0 ? { ...ownStatus, turns: ownStatus.turns + extension } : ownStatus
    const healBonus = magic?.healBonus ?? 0
    actor.ap -= apCost
    actor.mana -= manaCost
    actor.gearChangePaid = false
    if (oncePerBattle) actor.usedOnce.push(spell)
    if (!hexEquals(at, actor.position)) actor.facing = hexDirectionTowards(actor.position, at)!
    const caster = spellcaster(stats, spell)
    const cleansed: Array<{ unit: UnitRecord; status: StatusId }> = []

    const outcomes: StruckOutcome[] = touched.map((unit) => {
      if (hostile) {
        const doubled = dice && bane && baneApplies(this.statsOf(unit)) ? { ...dice, count: dice.count * 2 } : dice
        // Whether the bonus applies is judged before the roll.
        const bonusDice = bonusVs && bonusVs.statuses.some((id) => hasStatus(unit, id)) ? bonusVs.damage : undefined
        return this.strikeUnit(unit, caster, { dice: doubled, bonusDice, element, status, halfOnMiss: false, power, taunt: tauntPenalty(actor, unit) })
      }
      const hpBefore = unit.hp
      if (aimedAt === 'fallen') {
        unit.hp = Math.max(1, Math.floor(unit.stats.maxHp / 4))
        unit.statuses = []
        unit.ap = 0
        unit.reactionReady = false
        unit.turnReady = false
        return {
          unit: unit.id, attackRoll: null, chance: null, defenderAc: null, hit: true, critical: false, fumble: false, image: false,
          damage: 0, warded: 0, half: false, healed: unit.hp, hpBefore, hpAfter: unit.hp, status: null, revived: true,
        }
      }
      if (cleanse) {
        for (const { id } of unit.statuses.filter(({ id }) => STATUSES[id].hostile)) cleansed.push({ unit, status: id })
        unit.statuses = unit.statuses.filter(({ id }) => !STATUSES[id].hostile)
      }
      const healed = heal ? Math.min(rollDamage(heal, this.rng) + healBonus, unit.stats.maxHp - unit.hp) : 0
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
    const ends = cleansed.map(({ unit, status }) =>
      this.record<StatusEndEvent>({ type: 'status_end', round: this.round, unit: unit.id, status, reason: 'cleansed' }),
    )
    return [event, ...ends, ...this.aftermath(outcomes, touched)]
  }

  /**
   * Pays for a legal area ability and resolves it over every unit it
   * touches (`abilityTouches`: both sides, or only foes for `foesOnly`), in
   * roster order. An `auto` area rolls nothing and lays its status on each.
   * Any other rolls each as a hostile spell rolls, with the unit's own chance
   * to hit (a critical doubling the dice): its dice, or the weapon's for
   * `weaponDamage`, their count doubled against the bane-struck for `bane`;
   * resistance ignored, or gone through as a shot's for `throughResistance`;
   * its element cut by each ward; half the dice on a miss where the area has
   * `halfOnMiss`. Then the wakings, images spent and falls, as a cast's.
   */
  private areaAttack(actor: UnitRecord, abilityId: AbilityId, at: Hex): BattleEvent[] {
    const ability = ABILITIES[abilityId]
    const area = ability.area!
    const attacker = this.statsOf(actor)
    const touched = abilityTouches(this.units, actor, abilityId, at, attacker.attackRange)
    const { apCost, manaCost } = this.payFor(actor, abilityId)
    if (!hexEquals(at, actor.position)) actor.facing = hexDirectionTowards(actor.position, at)!
    const bonus = actor.stats.abilityDamageBonus ?? 0
    // A weapon's dice carry its own bonus; the monsters' level step is theirs alone.
    const dice = area.weaponDamage ? attacker.damage : area.damage && { ...area.damage, bonus: area.damage.bonus + bonus }

    const outcomes: StruckOutcome[] = touched.map((unit) => {
      if (area.auto) {
        const hpBefore = unit.hp
        const status = area.status ? this.layStatus(unit, area.status, actor) : null
        return {
          unit: unit.id, attackRoll: null, chance: null, defenderAc: null, hit: true, critical: false, fumble: false, image: false,
          damage: 0, warded: 0, half: false, healed: 0, hpBefore, hpAfter: unit.hp, status,
        }
      }
      const doubled = dice && area.bane && baneApplies(this.statsOf(unit)) ? { ...dice, count: dice.count * 2 } : dice
      return this.strikeUnit(unit, attacker, {
        dice: doubled,
        element: area.element,
        status: area.status,
        halfOnMiss: area.halfOnMiss,
        throughResistance: area.throughResistance,
        taunt: tauntPenalty(actor, unit),
      })
    })
    const event = this.record<AbilityEvent>({
      type: 'ability',
      round: this.round,
      unit: actor.id,
      ability: abilityId,
      at,
      shape: area.shape,
      hexes: areaOf(area.shape, actor.position, at, abilityArea(abilityId, attacker.attackRange)!.range, area.radius ?? 0).filter((h) =>
        this.board.contains(h),
      ),
      distance: hexDistance(actor.position, at),
      apCost,
      apAfter: actor.ap,
      facing: actor.facing,
      skill: attacker.toHit,
      outcomes: outcomes.map(({ woke: _, ...outcome }) => outcome),
      ...(manaCost !== undefined ? { manaCost, manaAfter: actor.mana } : {}),
    })
    return [event, ...this.aftermath(outcomes, touched)]
  }

  /**
   * One unit's share of a hostile cast or area: the roll to hit with
   * `attacker`'s chance against its armour class; on a hit, a mirror image
   * takes it if there is one, drawing nothing more, and otherwise the dice
   * (doubled on a critical) less its ward; on a miss with `halfOnMiss`, half
   * the dice, rounded down, less its ward. With `throughResistance` the
   * damage first goes through its resistance as a shot's does, before the
   * ward. `bonusDice` (a spell's `bonusVs`) are drawn on a hit after the
   * dice, doubled with them on a critical. A blow that wakes a sleeper wakes
   * it before the status is laid, on a hit that left it standing.
   */
  private strikeUnit(
    unit: UnitRecord,
    attacker: CombatantStats,
    blow: {
      dice: DamageRoll | undefined
      bonusDice?: DamageRoll
      element: Element | undefined
      status: StatusLaid | undefined
      halfOnMiss: boolean
      power?: number
      throughResistance?: true
      /** Taken off the chance: `tauntPenalty` of the user at this unit. */
      taunt: number
    },
  ): StruckOutcome {
    const hpBefore = unit.hp
    const defenderAc = this.statsOf(unit).ac
    const roll = rollToHit(attacker, defenderAc, this.rng, -blow.taunt)
    const image = roll.hit && this.strikeImage(unit)
    const half = !roll.hit && blow.halfOnMiss && blow.dice !== undefined
    // A spell's power is added to what its dice dealt, after a critical's doubling and before the ward.
    const power = blow.power ?? 0
    const rolled =
      roll.hit && !image && blow.dice
        ? rollHitDamage(blow.dice, roll.critical, this.rng) + (blow.bonusDice ? rollHitDamage(blow.bonusDice, roll.critical, this.rng) : 0) + power
        : half
          ? Math.floor(Math.max(0, rollDamage(blow.dice!, this.rng)) / 2) + power
          : 0
    const through = blow.throughResistance ? damageThrough(rolled, effectiveResistance(attacker, this.statsOf(unit).resistance ?? 0)) : rolled
    const damage = warded(through, blow.element, this.statsOf(unit))
    const endured = this.applyDamage(unit, damage)
    // A blow that wakes a sleeper wakes it before anything it lays; Sleep itself deals none.
    const woke = wakings(unit, damage)
    if (woke.length > 0) unit.statuses = unit.statuses.filter((s) => !woke.includes(s.id))
    const laid = roll.hit && !image && blow.status && unit.hp > 0 ? this.layStatus(unit, blow.status) : null
    return {
      unit: unit.id, ...roll, defenderAc, image, damage, warded: through - damage, half,
      ...(blow.throughResistance ? { resisted: rolled - through } : {}),
      healed: 0, hpBefore, hpAfter: unit.hp, status: laid,
      ...(blow.taunt > 0 ? { tauntPenalty: blow.taunt } : {}),
      ...(endured ? { endured: true as const } : {}),
      woke,
    }
  }

  /**
   * The one way damage reaches a unit: `n` hit points off, never below 0.
   * Unbreakable: the first damage of the battle that would bring a standing
   * unit with the trait to 0 leaves it at 1 instead, Shielded for 2 turns
   * (`UNBREAKABLE_SHIELD`, as a spell lays it). Returns whether it did. It
   * draws nothing.
   */
  private applyDamage(unit: UnitRecord, n: number): boolean {
    if (this.wouldEndure(unit, n)) {
      unit.hp = 1
      unit.endured = true
      this.layStatus(unit, UNBREAKABLE_SHIELD)
      return true
    }
    unit.hp = Math.max(0, unit.hp - n)
    return false
  }

  /** Whether `n` damage would bring `unit` to 0 and its Unbreakable, not yet spent, keep it standing. */
  private wouldEndure(unit: UnitRecord, n: number): boolean {
    return unit.hp > 0 && unit.hp - n <= 0 && !unit.endured && unit.stats.traits?.includes('unbreakable') === true
  }

  /** What follows a cast or an area: each sleeper woken and image spent, in roster order, then the falls and at most one end of the battle. */
  private aftermath(outcomes: readonly StruckOutcome[], touched: readonly UnitRecord[]): BattleEvent[] {
    const events: BattleEvent[] = []
    for (const outcome of outcomes) {
      const unit = this.units.find((u) => u.id === outcome.unit)!
      for (const status of outcome.woke ?? []) {
        events.push(this.record<StatusEndEvent>({ type: 'status_end', round: this.round, unit: unit.id, status, reason: 'woke' }))
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
    const fallen: UnitRecord[] = []
    for (const target of targets) {
      if (target.hp > 0) continue
      target.ap = 0
      target.statuses = []
      target.fallenThisBattle = true
      fallen.push(target)
      events.push(this.record<UnitDownEvent>({ type: 'unit_down', round: this.round, unit: target.id }))
    }
    if (events.length === 0) return events
    // A taunt ends with its taunter: on every standing unit it taunted, in roster order.
    for (const target of fallen) {
      for (const u of this.units) {
        const taunted = u.statuses.find((s) => s.id === 'taunted')
        if (u.hp > 0 && taunted?.source === target.id) events.push(...this.endStatus(u, 'taunted', 'source_fell'))
      }
    }
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

/** A cast or area outcome, with the statuses its damage woke its unit from, which the event does not keep. */
type StruckOutcome = CastOutcome & { woke?: StatusId[] }

/** The statuses `damage` ends on `unit`: each that `wakesOnDamage` (Asleep), if it hurt and the unit still stands. */
function wakings(unit: UnitRecord, damage: number): StatusId[] {
  if (damage <= 0 || unit.hp <= 0) return []
  return unit.statuses.filter(({ id }) => STATUSES[id].wakesOnDamage).map(({ id }) => id)
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
    turnReady: unit.turnReady,
    statuses: unit.statuses.map((status) => ({ ...status })),
    recharging: { ...unit.recharging },
    ...(unit.moved ? { moved: true as const } : {}),
    ...(unit.attackedYet ? { attackedYet: true as const } : {}),
    ...(unit.endured ? { endured: true as const } : {}),
    ...(unit.refunded ? { refunded: true as const } : {}),
    ...(unit.fallenThisBattle ? { fallenThisBattle: true as const } : {}),
    ...(unit.usedOnce.length > 0 ? { usedOnce: [...unit.usedOnce] } : {}),
  }
}

/** A unit's action points at the start of its turn, `base` changed by its statuses: none while helpless, never below 0. */
function apAfterStatuses(unit: UnitRecord, base: number): number {
  if (isHelpless(unit)) return 0
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
  const notes = [
    ...(outcome.critical ? ['CRITICAL'] : []),
    ...((outcome.resisted ?? 0) > 0 ? [`armour stops ${outcome.resisted}`] : []),
    ...(outcome.warded > 0 ? [`warded ${outcome.warded}`] : []),
  ]
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
  // "Sera revives Aldric."
  if (outcomes[0].revived) return `${names[event.caster]} revives ${names[outcomes[0].unit]}.`
  // "Sera casts Purify on Aldric: +3 (12 hp)." The statuses it took off are told by the `status_end` lines that follow.
  if (spell.cleanse && outcomes.length === 1) {
    const [o] = outcomes
    return `${opening}: +${o.healed} (${o.hpAfter} hp).`
  }
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
  const { verb, selfStatus, foeStatus } = ABILITIES[event.ability]
  const opening = `${names[event.unit]} ${verb}`
  // A status laid with no roll: "Mira sprints.", "Brenna marks Goblin."
  if (selfStatus) return `${opening}.`
  if (foeStatus) return `${opening} ${names[event.outcomes[0].unit]}.`
  // An area that rolls nothing: "Aldric taunts 2 foes."
  if (ABILITIES[event.ability].area?.auto) {
    const laid = event.outcomes.filter((o) => o.status !== null).length
    return `${opening} ${laid} ${laid === 1 ? 'foe' : 'foes'}.`
  }
  if (event.outcomes.length === 0) return `${opening}: it touches no one.`
  return `${opening}: ${event.outcomes.map((o) => hostileOutcome(o, names[o.unit])).join('; ')}.`
}

/** Unbreakable's words: "Mira endures the blow." */
function endures(name: string): string {
  return `${name} endures the blow.`
}

/** The Unbreakable notes a cast's or an area's line ends with, one for each unit it kept standing. */
function enduredNotes(outcomes: readonly CastOutcome[], names: Readonly<Record<UnitId, string>>): string {
  return outcomes
    .filter((o) => o.endured)
    .map((o) => ` ${endures(names[o.unit])}`)
    .join('')
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
      const breaking = event.counter
        ? `${attackerName} strikes back. `
        : event.opportunity
          ? `${defenderName} breaks away — free attack! `
          : ''
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
        const bonus = event.bonus
          .filter((b) => b.damage > 0)
          .map((b) => ` +${b.damage}${b.element ? ` ${b.element}` : ''}${wardedNote(b.rolled - b.damage)}`)
          .join('')
        const statuses = new Set([...(event.status ? [event.status] : []), ...(event.onHitStatuses ?? [])].map((s) => s.id))
        const laid = [...statuses].map((id) => `, ${laidPhrase(id).replace(/^is /, '')}`).join('')
        const heals = (event.healed ?? 0) > 0 ? ` ${attackerName} heals ${event.healed}.` : ''
        const endured = event.endured ? ` ${endures(defenderName)}` : ''
        const deathblow = event.deathblow ? ' A deathblow!' : ''
        return `${roll} — HITS ${defenderName} for ${event.damage} dmg${armour}${bonus}${laid}.${crit}${endured}${deathblow}${heals}`
      }
      return `${roll} — MISSES ${defenderName}.`
    }
    case 'cast':
      return `${describeCast(event, names)}${enduredNotes(event.outcomes, names)}`
    case 'ability':
      return `${describeAbility(event, names)}${enduredNotes(event.outcomes, names)}`
    case 'status_tick': {
      const endured = event.endured ? ` ${endures(names[event.unit])}` : ''
      return `${names[event.unit]} takes ${event.damage} from ${STATUSES[event.status].tickName ?? STATUSES[event.status].adjective}${wardedNote(event.warded)}.${endured}`
    }
    case 'regenerate':
      return `${names[event.unit]} regenerates ${event.healed}.`
    case 'restore':
      if (event.cause === 'serenity') return `${names[event.unit]} regains ${event.mana} mana.`
      if (event.cause === 'renewing') return `${names[event.unit]} is renewed (+${event.hp}).`
      return `${names[event.source!]}'s sanctuary restores ${event.hp} to ${names[event.unit]}.`
    case 'status_laid':
      return event.cause === 'rooted'
        ? `${names[event.unit]} holds their ground (rooted).`
        : `A mirror image appears beside ${names[event.unit]}.`
    case 'status_end':
      if (event.reason === 'woke') return `${names[event.unit]} wakes.`
      if (event.reason === 'spent') return `The last image of ${names[event.unit]} is gone.`
      if (event.reason === 'cleansed') return `${names[event.unit]} is cleansed, no longer ${STATUSES[event.status].adjective}.`
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
