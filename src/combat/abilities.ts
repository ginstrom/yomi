import type { AreaShape } from '../grid/hex.ts'
import type { DamageRoll, Element } from './combat.ts'
import type { StatusLaid } from './spells.ts'

export type { AreaShape } from '../grid/hex.ts'

/** One blow of a routine: a weapon attack with its own dice. */
export interface Strike {
  name: string
  /** As the log says it: "bites", "claws". */
  verb: string
  damage: DamageRoll
  /** Laid on a hit that leaves the target standing, as a spell's status is. */
  status?: StatusLaid
}

/** An area an ability strikes, rolled like a hostile area spell. */
export interface AreaAttack {
  shape: AreaShape
  range: number
  radius?: number
  /** Left out for an area that only lays a status (Web). */
  damage?: DamageRoll
  element?: Element
  status?: StatusLaid
  /** A miss still deals half the dice, rounded down; no status is laid on a miss. */
  halfOnMiss: boolean
}

/**
 * What a monster can do besides its weapon and its spells: a routine of
 * strikes at one foe, or an area. It costs action points and no mana, and
 * one with a `recharge` is used at most every that many turns of its side.
 */
export interface Ability {
  name: string
  /** As the log says it: "claws", "spits fire", "spins a web". */
  verb: string
  description: string
  apCost: number
  /**
   * Rounds before it can be used again: using one of N ≥ 1 sets its counter
   * to N, which falls by 1 as its side's turn begins, and it is ready at 0.
   * So 1 is once a turn and 2 every other turn; 0 limits nothing but AP.
   */
  recharge: number
  /** A routine of weapon strikes at one foe within the unit's attackRange... (exactly one of strikes and area) */
  strikes?: readonly Strike[]
  /** ...or an area, rolled like a hostile spell with the unit's toHit, ignoring resistance. */
  area?: AreaAttack
}

export const ABILITY_IDS = ['troll_claws', 'spider_bite', 'spider_web', 'fire_spit'] as const

export type AbilityId = (typeof ABILITY_IDS)[number]

const CLAW: Strike = { name: 'Claw', verb: 'claws', damage: { count: 1, sides: 4, bonus: 2 } }
const FANG: DamageRoll = { count: 1, sides: 6, bonus: 2 }

export const ABILITIES: Record<AbilityId, Ability> = {
  troll_claws: {
    name: 'Claws',
    verb: 'claws',
    description: 'Rakes one foe twice, turning to the next foe beside it if the first falls.',
    apCost: 8,
    recharge: 0,
    strikes: [CLAW, CLAW],
  },
  spider_bite: {
    name: 'Bite',
    verb: 'bites',
    description: 'Bites one foe twice, the second bite laying a poison.',
    apCost: 4,
    recharge: 1,
    strikes: [
      { name: 'Bite', verb: 'bites', damage: FANG },
      { name: 'Venom Bite', verb: 'bites', damage: FANG, status: { id: 'poisoned', turns: 3 } },
    ],
  },
  spider_web: {
    name: 'Web',
    verb: 'spins a web',
    description: 'A web 4 hexes off that catches all within a hex of its centre: webbed for 2 turns, 4 fewer action points.',
    apCost: 4,
    recharge: 3,
    area: { shape: 'burst', range: 4, radius: 1, status: { id: 'webbed', turns: 2 }, halfOnMiss: false },
  },
  fire_spit: {
    name: 'Fire Spit',
    verb: 'spits fire',
    description: 'A cone of fire 2 hexes long: 3d6, half on a miss, and no regeneration next turn.',
    apCost: 4,
    recharge: 2,
    area: {
      shape: 'cone',
      range: 2,
      damage: { count: 3, sides: 6, bonus: 0 },
      element: 'fire',
      status: { id: 'seared', turns: 1 },
      halfOnMiss: true,
    },
  },
}
