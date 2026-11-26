import { describe, expect, it } from 'vitest'
import { ABILITIES } from '../combat/abilities.ts'
import { OGRE_STATS, WOLF_STATS, WORG_RIDER_STATS, WYVERN_STATS, damageThrough, effectiveResistance, type CombatantStats } from '../combat/combat.ts'
import { hex, hexKey } from '../grid/hex.ts'
import { BattleEngine, type AbilityEvent, type Action, type AttackEvent, type UnitSetup } from './battleEngine.ts'

/**
 * The kinds of long-campaign stage 11 (the high roster), ring by ring: what
 * each kind with something special does in the engine, on its own stat block.
 */

const BOARD = { cols: 9, rows: 3 }
const END_TURN: Action = { type: 'end_turn' }

/** A hero in mail, with hit points to stand through every blow here. */
const HERO_STATS: CombatantStats = {
  name: 'Hero',
  maxHp: 200,
  ac: 25,
  resistance: 6,
  toHit: 75,
  critChance: 5,
  damage: { count: 1, sides: 8, bonus: 2 },
  attackApCost: 4,
  attackRange: 1,
  actionPoints: 8,
}

const heroAt = (id: string, q: number, r: number, stats: Partial<CombatantStats> = {}): UnitSetup => ({
  id,
  side: 'player',
  stats: { ...HERO_STATS, ...stats },
  position: hex(q, r),
})
const foeAt = (id: string, stats: CombatantStats, q: number, r: number): UnitSetup => ({ id, side: 'enemy', stats, position: hex(q, r) })

/** A stream of `values` (the last repeated) that counts its draws. */
function counted(values: number[]) {
  let draws = 0
  return { rng: () => values[Math.min(draws++, values.length - 1)], draws: () => draws }
}

/** The battle on the enemy's first turn. */
function enemyTurn(units: UnitSetup[], rng: () => number): BattleEngine {
  const engine = new BattleEngine({ board: BOARD, units }, { rng })
  engine.step(END_TURN)
  return engine
}

const unitOf = (engine: BattleEngine, id: string) => engine.getState().units.find((u) => u.id === id)!
/** Draws: 0.9 is a roll of 10, a hit and no critical; 0.2 a roll of 80, a miss here; on a die 0 is a 1. */
const HIT = 0.9
const MISS = 0.2

describe('ring 7 (stage 11 step 08)', () => {
  describe('the Wolf', () => {
    it('has 10 action points as its turn begins, and no ability: a plain bite', () => {
      const engine = enemyTurn([heroAt('hero', 1, 1), foeAt('wolf', WOLF_STATS, 2, 1)], () => HIT)
      expect(unitOf(engine, 'wolf').ap).toBe(10)
      expect(engine.legalActions('wolf').some((a) => a.type === 'ability')).toBe(false)
      const [bite] = engine.step({ type: 'attack', unit: 'wolf', target: 'hero' }) as AttackEvent[]
      expect(bite).toMatchObject({ attacker: 'wolf', defender: 'hero', apCost: WOLF_STATS.attackApCost, apAfter: 10 - WOLF_STATS.attackApCost })
      expect(bite).not.toHaveProperty('ability')
    })

    it('crosses the board faster than a foe of 8 action points', () => {
      const engine = enemyTurn([heroAt('hero', 0, 1), foeAt('wolf', WOLF_STATS, 8, 1), foeAt('rider', WORG_RIDER_STATS, 8, 0)], () => HIT)
      const reach = (id: string) => Math.min(...engine.legalActions(id).flatMap((a) => (a.type === 'move' ? [a.to.q] : [])))
      expect(reach('wolf')).toBeLessThan(reach('rider'))
    })
  })

  describe('the Worg Rider’s Spear and Bite', () => {
    const use: Action = { type: 'ability', unit: 'rider', ability: 'worg_strikes', target: 'hero' }
    const { apCost, strikes } = ABILITIES.worg_strikes

    it('strikes one foe twice in one action, the Spear then the Bite, as two attacks with their names', () => {
      const stream = counted(strikes!.flatMap((s) => [HIT, ...Array<number>(s.damage!.count).fill(0)]))
      const engine = enemyTurn([heroAt('hero', 1, 1, { resistance: 0 }), foeAt('rider', WORG_RIDER_STATS, 2, 1)], stream.rng)
      const events = engine.step(use) as AttackEvent[]
      expect(events.map((e) => [e.type, e.ability, e.strike, e.defender, e.hit])).toEqual([
        ['attack', 'worg_strikes', 'Spear', 'hero', true],
        ['attack', 'worg_strikes', 'Bite', 'hero', true],
      ])
      // The action's AP on the first strike, none on the second; each strike its own dice, a 1 on each die.
      expect(events.map((e) => e.apCost)).toEqual([apCost, 0])
      expect(events.map((e) => e.damageDice)).toEqual(strikes!.map((s) => s.damage))
      expect(events.map((e) => e.damage)).toEqual(strikes!.map((s) => s.damage!.count + s.damage!.bonus))
      expect(unitOf(engine, 'rider').ap).toBe(WORG_RIDER_STATS.actionPoints - apCost)
      expect(unitOf(engine, 'hero').hp).toBe(HERO_STATS.maxHp - events[0].damage - events[1].damage)
      // A roll and its dice for each strike.
      expect(stream.draws()).toBe(2 + strikes![0].damage!.count + strikes![1].damage!.count)
    })

    it('rolls each strike apart: the Spear may miss and the Bite still land, through armour less the rider’s piercing', () => {
      const stream = counted([MISS, HIT, 0])
      const engine = enemyTurn([heroAt('hero', 1, 1), foeAt('rider', WORG_RIDER_STATS, 2, 1)], stream.rng)
      const [spear, bite] = engine.step(use) as AttackEvent[]
      expect([spear.hit, spear.damage, bite.hit]).toEqual([false, 0, true])
      const rolled = strikes![1].damage!.count + strikes![1].damage!.bonus
      expect(bite.damage).toBe(damageThrough(rolled, effectiveResistance(WORG_RIDER_STATS, HERO_STATS.resistance!)))
    })

    it('needs its foe within the rider’s reach', () => {
      const engine = enemyTurn([heroAt('hero', 1, 1), foeAt('rider', WORG_RIDER_STATS, 2 + WORG_RIDER_STATS.attackRange, 1)], () => HIT)
      expect(() => engine.step(use)).toThrow('rider cannot use worg_strikes on hero')
    })
  })

  describe('the Ogre’s Sweep', () => {
    const sweep = (at = hex(4, 1)): Action => ({ type: 'ability', unit: 'ogre', ability: 'ogre_sweep', at })
    const { apCost, recharge } = ABILITIES.ogre_sweep
    const dice = ABILITIES.ogre_sweep.area!.damage!
    /** The Ogre at (4,1) with a hero either side, a third two hexes off, and a wolf and a second ogre of its own beside it. */
    const field = (rng: () => number) =>
      enemyTurn(
        [
          heroAt('west', 3, 1),
          heroAt('east', 5, 1, { resistance: 0 }),
          heroAt('far', 6, 1),
          foeAt('ogre', OGRE_STATS, 4, 1),
          foeAt('wolf', WOLF_STATS, 4, 0),
          foeAt('brute', OGRE_STATS, 3, 2),
        ],
        rng,
      )

    it('is aimed only at the Ogre’s own hex, and only while a foe stands beside it', () => {
      const engine = field(() => HIT)
      const centres = (id: string) => engine.legalActions(id).flatMap((a) => (a.type === 'ability' && 'at' in a ? [hexKey(a.at)] : []))
      expect(centres('ogre')).toEqual([hexKey(hex(4, 1))])
      expect(() => engine.step(sweep(hex(3, 1)))).toThrow('cannot use ogre_sweep')
      const alone = enemyTurn([heroAt('far', 1, 1), foeAt('ogre', OGRE_STATS, 4, 1)], () => HIT)
      expect(alone.legalActions('ogre').some((a) => a.type === 'ability')).toBe(false)
    })

    it('rolls once against each foe beside it, in roster order, and touches no ally, no foe further off and not the Ogre', () => {
      const hit = [HIT, ...Array<number>(dice.count).fill(0)]
      const stream = counted([...hit, ...hit])
      const engine = field(stream.rng)
      const [event] = engine.step(sweep()) as AbilityEvent[]
      expect(event).toMatchObject({ type: 'ability', unit: 'ogre', ability: 'ogre_sweep', shape: 'burst', at: hex(4, 1), distance: 0, apCost, skill: OGRE_STATS.toHit })
      expect(event.outcomes.map((o) => [o.unit, o.hit, o.half])).toEqual([
        ['west', true, false],
        ['east', true, false],
      ])
      // One roll to hit and the dice for each of the two, and nothing more.
      expect(stream.draws()).toBe(2 * (1 + dice.count))
      // The Ogre's chance against each hero's armour class.
      expect(event.outcomes.map((o) => o.chance)).toEqual([OGRE_STATS.toHit - HERO_STATS.ac, OGRE_STATS.toHit - HERO_STATS.ac])
      for (const id of ['far', 'ogre', 'wolf', 'brute']) expect(unitOf(engine, id).hp, id).toBe(unitOf(engine, id).maxHp)
      expect(unitOf(engine, 'ogre')).toMatchObject({ ap: OGRE_STATS.actionPoints - apCost, recharging: { ogre_sweep: recharge } })
    })

    it('goes through each foe’s resistance, less the Ogre’s piercing, and does nothing on a miss', () => {
      // west: hit, a 1 on each die; east: missed, no dice.
      const stream = counted([HIT, ...Array<number>(dice.count).fill(0), MISS])
      const engine = field(stream.rng)
      const [event] = engine.step(sweep()) as AbilityEvent[]
      const rolled = dice.count + dice.bonus
      const through = damageThrough(rolled, effectiveResistance(OGRE_STATS, HERO_STATS.resistance!))
      expect(through).toBeLessThan(rolled)
      expect(event.outcomes.map((o) => [o.unit, o.hit, o.half, o.damage, o.resisted])).toEqual([
        ['west', true, false, through, rolled - through],
        ['east', false, false, 0, 0],
      ])
      expect(stream.draws()).toBe(1 + dice.count + 1)
      expect(unitOf(engine, 'west').hp).toBe(HERO_STATS.maxHp - through)
      expect(unitOf(engine, 'east').hp).toBe(HERO_STATS.maxHp)
    })

    it('is ready again after its recharge, not before', () => {
      const engine = field(() => HIT)
      engine.step(sweep())
      expect(engine.legalActions('ogre').some((a) => a.type === 'ability')).toBe(false)
      for (let turn = 0; turn < 2 * recharge; turn++) engine.step(END_TURN)
      expect(engine.legalActions('ogre').some((a) => a.type === 'ability')).toBe(true)
    })
  })
})

describe('ring 9 (stage 11 step 09)', () => {
  describe('the Wyvern’s Bite and Sting', () => {
    const use: Action = { type: 'ability', unit: 'wyvern', ability: 'wyvern_strikes', target: 'hero' }
    const { apCost, strikes } = ABILITIES.wyvern_strikes
    const [bite, sting] = strikes!
    const dice = (strike: typeof bite) => Array<number>(strike.damage!.count).fill(0)
    const poison = (engine: BattleEngine) => unitOf(engine, 'hero').statuses.find((s) => s.id === 'poisoned')
    const field = (rng: () => number, hero: Partial<CombatantStats> = {}) => enemyTurn([heroAt('hero', 1, 1, hero), foeAt('wyvern', WYVERN_STATS, 2, 1)], rng)

    it('is a routine of two strikes of their own dice, the Bite then a Tail Sting that poisons', () => {
      expect(ABILITIES.wyvern_strikes.name).toBe('Bite and Sting')
      expect(strikes!.map((s) => s.name)).toEqual(['Bite', 'Tail Sting'])
      expect(bite.status).toBeUndefined()
      expect(sting.status).toEqual({ id: 'poisoned', turns: 3 })
      expect(ABILITIES.wyvern_strikes.area).toBeUndefined()
    })

    it('strikes one foe twice in one action, as two attacks with their names, and the Sting that hits lays Poisoned', () => {
      const stream = counted([HIT, ...dice(bite), HIT, ...dice(sting)])
      const engine = field(stream.rng, { resistance: 0 })
      const events = engine.step(use)
      const attacks = events.filter((e): e is AttackEvent => e.type === 'attack')
      expect(attacks.map((e) => [e.ability, e.strike, e.defender, e.hit])).toEqual([
        ['wyvern_strikes', 'Bite', 'hero', true],
        ['wyvern_strikes', 'Tail Sting', 'hero', true],
      ])
      expect(attacks.map((e) => e.apCost)).toEqual([apCost, 0])
      expect(attacks.map((e) => e.damageDice)).toEqual([bite.damage, sting.damage])
      expect(attacks.map((e) => e.damage)).toEqual([bite, sting].map((s) => s.damage!.count + s.damage!.bonus))
      expect(unitOf(engine, 'wyvern').ap).toBe(WYVERN_STATS.actionPoints - apCost)
      expect(poison(engine)).toMatchObject({ id: 'poisoned', turnsLeft: 3 })
      // A roll and its dice for each strike, and nothing for the poison.
      expect(stream.draws()).toBe(2 + bite.damage!.count + sting.damage!.count)
    })

    it('lays nothing when the Sting misses, though the Bite lands, through armour less the Wyvern’s piercing', () => {
      const stream = counted([HIT, ...dice(bite), MISS])
      const engine = field(stream.rng)
      const attacks = engine.step(use).filter((e): e is AttackEvent => e.type === 'attack')
      expect(attacks.map((e) => e.hit)).toEqual([true, false])
      const rolled = bite.damage!.count + bite.damage!.bonus
      expect(attacks[0].damage).toBe(damageThrough(rolled, effectiveResistance(WYVERN_STATS, HERO_STATS.resistance!)))
      expect(poison(engine)).toBeUndefined()
      expect(unitOf(engine, 'hero').hp).toBe(HERO_STATS.maxHp - attacks[0].damage)
    })

    it('poisons with the Sting alone: the Bite may miss and the Sting still land', () => {
      const engine = field(counted([MISS, HIT, ...dice(sting)]).rng)
      const attacks = engine.step(use).filter((e): e is AttackEvent => e.type === 'attack')
      expect(attacks.map((e) => e.hit)).toEqual([false, true])
      expect(poison(engine)).toMatchObject({ id: 'poisoned' })
    })

    it('lays no poison on a foe the Sting fells', () => {
      // The Bite's least leaves the hero 1 hit point; the Sting takes it.
      const least = bite.damage!.count + bite.damage!.bonus
      const engine = field(counted([HIT, ...dice(bite), HIT, ...dice(sting)]).rng, { maxHp: least + 1, resistance: 0 })
      engine.step(use)
      expect(unitOf(engine, 'hero').hp).toBe(0)
      expect(unitOf(engine, 'hero').statuses).toEqual([])
    })

    it('does not fly: a hero in its way blocks it as any unit is blocked', () => {
      // A board one hex high: the hero at (1,0) stands between the Wyvern and the far side.
      const engine = new BattleEngine({ board: { cols: 5, rows: 1 }, units: [heroAt('hero', 1, 0), foeAt('wyvern', WYVERN_STATS, 2, 0)] }, { rng: () => HIT })
      engine.step(END_TURN)
      const reach = engine.legalActions('wyvern').flatMap((a) => (a.type === 'move' ? [a.to.q] : []))
      expect(reach.every((q) => q > 1)).toBe(true)
    })
  })
})
