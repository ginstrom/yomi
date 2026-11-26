import type { AreaShape } from '../grid/hex.ts'
import type { CombatantStats, DamageRoll, Element, OnHit } from './combat.ts'
import type { StatusLaid } from './spells.ts'

export type { AreaShape } from '../grid/hex.ts'

/**
 * One blow of a routine: a weapon attack with its own dice (a monster's), or
 * with the unit's weapon (`weapon`, a hero's technique), never both.
 */
export interface Strike {
  name: string
  /** As the log says it: "bites", "claws", "power-attacks". */
  verb: string
  /** Its own dice; left out for a weapon strike. */
  damage?: DamageRoll
  /** Laid on a hit that leaves the target standing, as a spell's status is. */
  status?: StatusLaid
  /** A blow or shot of the unit's own weapon: its dice, damage bonus, piercing and on-hit runes. */
  weapon?: true
  /** Added to the chance to hit, in percent. */
  toHit?: number
  /** Added to a hit's damage after a critical's doubling, so never doubled. */
  damageBonus?: number
  /** Flat on-hit damage added to the weapon's for this blow; each one with an element is raised by the unit's `imbueDamage`. */
  onHit?: readonly OnHit[]
  /** Goes to another standing foe in reach than the strike before it if there is one (Cleave's second blow). */
  spreads?: true
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
  /** The unit's weapon dice and damage bonus in place of `damage` (Volley); not the monsters' `abilityDamageBonus`. */
  weaponDamage?: true
  /** Its range is the unit's `attackRange`; `range` is then ignored (set to 0). */
  weaponRange?: true
  /**
   * Each hit's damage goes through the target's resistance as a shot's does
   * (`damageThrough`, pierced by the unit's `armorPierce`, which a ranged
   * weapon has only as its own `rangedPierce`), at least 1 when anything was
   * rolled. No on-hit runes are added: an area is not a weapon blow.
   */
  throughResistance?: true
  /** Touches only the user's foes, never its own side or itself (Taunt, Consecrate). */
  foesOnly?: true
  /** No roll and no draw: lays `status` on every unit touched (Taunt). */
  auto?: true
  /** Doubles the dice's count, not the bonus, against a unit `baneApplies` to (Consecrate). */
  bane?: true
  /** Aimed only at the user's own hex: a burst of `range` 0 (Taunt, Consecrate). */
  centredOnSelf?: true
}

/**
 * What a unit can do besides its weapon and its spells: a routine of strikes
 * at one foe, an area, or (a hero's technique) a status laid with no roll on
 * itself or on a foe. It costs action points, and a hero's may cost mana; one
 * with a `recharge` is used at most every that many turns of its side.
 * Monsters' abilities (`MONSTER_ABILITY_IDS`) set none of the heroes' cost
 * fields (mana, weapon AP, a needed weapon) and their strikes have their own
 * dice; the high roster's areas (long-campaign stage 11) may use the area
 * fields the techniques brought (`centredOnSelf`, `foesOnly`,
 * `throughResistance`).
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
  /** ...or an area, rolled like a hostile spell with the unit's toHit, ignoring resistance... */
  area?: AreaAttack
  /** ...or a status laid on the user itself, with no roll (Sprint)... */
  selfStatus?: StatusLaid
  /** ...or a status laid with no roll on a standing foe within `range` hexes, 'weapon' its attack range (Hunter's Mark). */
  foeStatus?: { status: StatusLaid; range: number | 'weapon' }
  /** Mana paid as the action begins; the unit must have it. */
  manaCost?: number
  /** When set, the AP is the weapon's `attackApCost` plus this, and `apCost` is ignored. */
  weaponAp?: number
  /** The weapon it asks for: `isMelee` (bare hands and reach included) or not. */
  needs?: 'melee' | 'ranged'
}

export const ABILITY_IDS = [
  'troll_claws',
  'spider_bite',
  'spider_web',
  'fire_spit',
  'worg_strikes',
  'ogre_sweep',
  'wyvern_strikes',
  'basilisk_gaze',
  'giant_rock',
  'power_attack',
  'cleave',
  'taunt',
  'pin',
  'flame_strike',
  'frost_strike',
  'thunder_strike',
  'aimed_shot',
  'hunters_mark',
  'volley',
  'pinning_shot',
  'sprint',
  'dirty_trick',
  'venom_strike',
  'hamstring',
  'smite',
  'consecrate',
] as const

export type AbilityId = (typeof ABILITY_IDS)[number]

/** The abilities only monsters have, in `ABILITY_IDS` order; every other ability is a hero's technique. */
export const MONSTER_ABILITY_IDS: readonly AbilityId[] = ['troll_claws', 'spider_bite', 'spider_web', 'fire_spit', 'worg_strikes', 'ogre_sweep', 'wyvern_strikes', 'basilisk_gaze', 'giant_rock']

/** The Spellsword's Strikes, which Arcane Knight makes at the weapon's own AP. */
export const SPELLSWORD_STRIKES: readonly AbilityId[] = ['flame_strike', 'frost_strike', 'thunder_strike']

/**
 * The action points `ability` costs a unit of `stats`: the weapon's attack AP
 * plus its `weaponAp` for a technique (plus nothing for a Spellsword Strike
 * by a unit with the trait `arcane_knight`), else its own.
 */
export function abilityApCost(stats: Pick<CombatantStats, 'attackApCost' | 'traits'>, ability: AbilityId): number {
  const { weaponAp, apCost } = ABILITIES[ability]
  if (weaponAp === undefined) return apCost
  const knight = stats.traits?.includes('arcane_knight') === true && SPELLSWORD_STRIKES.includes(ability)
  return stats.attackApCost + (knight ? 0 : weaponAp)
}

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
    description: 'A cone of fire 2 hexes long: 4d6+2, half on a miss, and no regeneration next turn.',
    apCost: 4,
    recharge: 2,
    area: {
      shape: 'cone',
      range: 2,
      damage: { count: 4, sides: 6, bonus: 2 },
      element: 'fire',
      status: { id: 'seared', turns: 1 },
      halfOnMiss: true,
    },
  },
  // ---- The high roster (long-campaign stage 11), ring by ring.
  worg_strikes: {
    name: 'Spear and Bite',
    verb: 'strikes',
    description: 'The rider’s spear and the worg’s bite at one foe, turning to the next foe beside it if the first falls.',
    apCost: 6,
    recharge: 0,
    strikes: [
      { name: 'Spear', verb: 'spears', damage: { count: 1, sides: 8, bonus: 2 } },
      { name: 'Bite', verb: 'bites', damage: { count: 1, sides: 6, bonus: 1 } },
    ],
  },
  ogre_sweep: {
    name: 'Sweep',
    verb: 'sweeps its club',
    description: 'Every foe beside the user takes 2d8+2, through armour.',
    apCost: 6,
    recharge: 1,
    area: {
      shape: 'burst',
      centredOnSelf: true,
      range: 0,
      radius: 1,
      foesOnly: true,
      throughResistance: true,
      damage: { count: 2, sides: 8, bonus: 2 },
      halfOnMiss: false,
    },
  },
  wyvern_strikes: {
    name: 'Bite and Sting',
    verb: 'strikes',
    description: 'Bites one foe and stings it with its tail, the sting laying a poison; it turns to the next foe beside it if the first falls.',
    apCost: 6,
    recharge: 0,
    strikes: [
      { name: 'Bite', verb: 'bites', damage: { count: 2, sides: 6, bonus: 2 } },
      { name: 'Tail Sting', verb: 'stings', damage: { count: 1, sides: 4, bonus: 0 }, status: { id: 'poisoned', turns: 3 } },
    ],
  },
  basilisk_gaze: {
    name: 'Gaze',
    verb: 'fixes its gaze',
    description: 'A cone 3 hexes long: no damage, but each one it catches is chilled for a turn, 3 fewer action points.',
    apCost: 3,
    recharge: 2,
    area: { shape: 'cone', range: 3, status: { id: 'chilled', turns: 1 }, halfOnMiss: false },
  },
  giant_rock: {
    name: 'Rock',
    verb: 'hurls a rock',
    description: 'A rock thrown at one foe up to 4 hexes off: 2d10+2, through armour.',
    apCost: 6,
    recharge: 1,
    area: {
      shape: 'burst',
      range: 4,
      radius: 0,
      throughResistance: true,
      damage: { count: 2, sides: 10, bonus: 2 },
      halfOnMiss: false,
    },
  },
  // ---- The heroes' techniques (design §4.3). `apCost` is ignored where `weaponAp` is set.
  power_attack: {
    name: 'Power Attack',
    verb: 'power-attacks',
    description: 'A weapon blow at −10 to hit for +6 damage.',
    apCost: 0,
    weaponAp: 2,
    recharge: 0,
    needs: 'melee',
    strikes: [{ name: 'Power Attack', verb: 'power-attacks', weapon: true, toHit: -10, damageBonus: 6 }],
  },
  cleave: {
    name: 'Cleave',
    verb: 'cleaves',
    description: 'Two weapon blows at −5 each, the second at another foe in reach if there is one.',
    apCost: 0,
    weaponAp: 2,
    recharge: 2,
    needs: 'melee',
    strikes: [
      { name: 'Cleave', verb: 'cleaves', weapon: true, toHit: -5 },
      { name: 'Cleave', verb: 'cleaves', weapon: true, toHit: -5, spreads: true },
    ],
  },
  taunt: {
    name: 'Taunt',
    verb: 'taunts',
    description: 'Lays Taunted on every foe within 2 hexes for a turn: they strike others at −25.',
    apCost: 3,
    recharge: 2,
    area: { shape: 'burst', range: 0, radius: 2, status: { id: 'taunted', turns: 1 }, halfOnMiss: false, foesOnly: true, auto: true, centredOnSelf: true },
  },
  pin: {
    name: 'Pin',
    verb: 'pins',
    description: 'A weapon blow; a hit pins the foe for a turn.',
    apCost: 0,
    weaponAp: 1,
    manaCost: 3,
    recharge: 1,
    needs: 'melee',
    strikes: [{ name: 'Pin', verb: 'pins', weapon: true, status: { id: 'pinned', turns: 1 } }],
  },
  flame_strike: {
    name: 'Flame Strike',
    verb: 'flame-strikes',
    description: 'A weapon blow; a hit adds 5 fire and sears the foe for a turn.',
    apCost: 0,
    weaponAp: 1,
    manaCost: 3,
    recharge: 0,
    needs: 'melee',
    strikes: [{ name: 'Flame Strike', verb: 'flame-strikes', weapon: true, onHit: [{ damage: 5, element: 'fire' }], status: { id: 'seared', turns: 1 } }],
  },
  frost_strike: {
    name: 'Frost Strike',
    verb: 'frost-strikes',
    description: 'A weapon blow; a hit adds 4 frost and chills the foe for a turn.',
    apCost: 0,
    weaponAp: 1,
    manaCost: 3,
    recharge: 0,
    needs: 'melee',
    strikes: [{ name: 'Frost Strike', verb: 'frost-strikes', weapon: true, onHit: [{ damage: 4, element: 'frost' }], status: { id: 'chilled', turns: 1 } }],
  },
  thunder_strike: {
    name: 'Thunder Strike',
    verb: 'thunder-strikes',
    description: 'A weapon blow at +10 to hit; a hit adds 7 lightning.',
    apCost: 0,
    weaponAp: 1,
    manaCost: 4,
    recharge: 0,
    needs: 'melee',
    strikes: [{ name: 'Thunder Strike', verb: 'thunder-strikes', weapon: true, toHit: 10, onHit: [{ damage: 7, element: 'lightning' }] }],
  },
  aimed_shot: {
    name: 'Aimed Shot',
    verb: 'takes aim at',
    description: 'A weapon shot at +20 to hit for +3 damage.',
    apCost: 0,
    weaponAp: 2,
    recharge: 0,
    needs: 'ranged',
    strikes: [{ name: 'Aimed Shot', verb: 'takes aim at', weapon: true, toHit: 20, damageBonus: 3 }],
  },
  hunters_mark: {
    name: "Hunter's Mark",
    verb: 'marks',
    description: 'Marks a foe within weapon range for 2 turns: 10 off its armour class.',
    apCost: 2,
    recharge: 3,
    foeStatus: { status: { id: 'marked', turns: 2 }, range: 'weapon' },
  },
  volley: {
    name: 'Volley',
    verb: 'volleys',
    description: 'A rain of shots on a hex within weapon range: everyone within 1 hex of it, allies too, takes a shot, through armour.',
    apCost: 0,
    weaponAp: 2,
    recharge: 2,
    needs: 'ranged',
    // `range` 0: `weaponRange` makes it the weapon's.
    area: { shape: 'burst', range: 0, radius: 1, halfOnMiss: false, weaponDamage: true, weaponRange: true, throughResistance: true },
  },
  pinning_shot: {
    name: 'Pinning Shot',
    verb: 'pins',
    description: 'A weapon shot; a hit pins the foe for a turn.',
    apCost: 0,
    weaponAp: 1,
    manaCost: 3,
    recharge: 1,
    needs: 'ranged',
    strikes: [{ name: 'Pinning Shot', verb: 'pins', weapon: true, status: { id: 'pinned', turns: 1 } }],
  },
  sprint: {
    name: 'Sprint',
    verb: 'sprints',
    description: '3 more action points this turn.',
    apCost: 0,
    recharge: 3,
    selfStatus: { id: 'hasted', turns: 1 },
  },
  dirty_trick: {
    name: 'Dirty Trick',
    verb: 'plays a dirty trick on',
    description: 'A weapon blow; a hit banes the foe for 2 turns: −15 to hit.',
    apCost: 0,
    weaponAp: 1,
    recharge: 2,
    needs: 'melee',
    strikes: [{ name: 'Dirty Trick', verb: 'plays a dirty trick on', weapon: true, status: { id: 'baned', turns: 2 } }],
  },
  venom_strike: {
    name: 'Venom Strike',
    verb: 'envenoms',
    description: 'A weapon blow or shot; a hit poisons the foe for 3 turns.',
    apCost: 0,
    weaponAp: 1,
    manaCost: 2,
    recharge: 0,
    strikes: [{ name: 'Venom Strike', verb: 'envenoms', weapon: true, status: { id: 'poisoned', turns: 3 } }],
  },
  hamstring: {
    name: 'Hamstring',
    verb: 'hamstrings',
    description: 'A weapon blow or shot; a hit slows the foe for a turn: 3 fewer action points.',
    apCost: 0,
    weaponAp: 1,
    recharge: 2,
    strikes: [{ name: 'Hamstring', verb: 'hamstrings', weapon: true, status: { id: 'slowed', turns: 1 } }],
  },
  smite: {
    name: 'Smite',
    verb: 'smites',
    description: 'A weapon blow; a hit adds 4 damage, and 6 more against the regenerating and the blightborn.',
    apCost: 0,
    weaponAp: 1,
    manaCost: 3,
    recharge: 0,
    needs: 'melee',
    strikes: [{ name: 'Smite', verb: 'smites', weapon: true, onHit: [{ damage: 4 }, { damage: 6, bane: true }] }],
  },
  consecrate: {
    name: 'Consecrate',
    verb: 'consecrates the ground',
    description: 'Every foe beside the user takes 2d6, half on a miss, double the dice against the regenerating and the blightborn.',
    apCost: 5,
    manaCost: 5,
    recharge: 2,
    area: {
      shape: 'burst',
      range: 0,
      radius: 1,
      damage: { count: 2, sides: 6, bonus: 0 },
      halfOnMiss: true,
      foesOnly: true,
      bane: true,
      centredOnSelf: true,
    },
  },
}
