import { describe, expect, it } from 'vitest'
import { ABILITIES } from '../combat/abilities.ts'
import {
  BARROW_WIGHT_STATS,
  BASILISK_STATS,
  BLIGHT_CULTIST_STATS,
  HILL_GIANT_STATS,
  OGRE_STATS,
  WOLF_STATS,
  WORG_RIDER_STATS,
  STONE_GOLEM_STATS,
  WYVERN_STATS,
  YOUNG_DRAGON_STATS,
  BLIGHT_LICH_STATS,
  ELDER_WYRM_STATS,
  SOURCE_HORROR_STATS,
  baneApplies,
  damageThrough,
  effectiveResistance,
  type CombatantStats,
} from '../combat/combat.ts'
import { SPELLS } from '../combat/spells.ts'
import { hex, hexKey } from '../grid/hex.ts'
import { BattleEngine, formatEvent, type AbilityEvent, type Action, type AttackEvent, type BattleEvent, type CastEvent, type UnitSetup } from './battleEngine.ts'
import { POLICIES } from './policies.ts'

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

describe('ring 12 (stage 11 step 10)', () => {
  describe('the Barrow Wight’s Drain Life', () => {
    const drain: Action = { type: 'cast', unit: 'wight', spell: 'drain_life', target: 'hero' }
    const { manaCost, apCost, range, damage } = SPELLS.drain_life
    /** The wight wounded by `lost`, the hero `range` hexes off. */
    const field = (rng: () => number, lost = 20) =>
      enemyTurn([heroAt('hero', 1, 1), { ...foeAt('wight', BARROW_WIGHT_STATS, 1 + range, 1), hp: BARROW_WIGHT_STATS.maxHp - lost }], rng)

    it('is a caster of one spell, Drain Life, with the mana for it, and no ability', () => {
      expect(BARROW_WIGHT_STATS.magic!.spells).toEqual(['drain_life'])
      expect(BARROW_WIGHT_STATS.magic!.maxMana).toBeGreaterThanOrEqual(manaCost)
      expect(BARROW_WIGHT_STATS.abilities).toBeUndefined()
    })

    it('casts it on a hero in range: the hero loses hit points, whatever its armour, and the wight heals by half of them', () => {
      // A roll that hits, then a 1 on each die.
      const stream = counted([HIT, ...Array<number>(damage!.count).fill(0)])
      const engine = field(stream.rng)
      const [event] = engine.step(drain) as CastEvent[]
      const dealt = damage!.count + damage!.bonus
      expect(event).toMatchObject({ type: 'cast', caster: 'wight', spell: 'drain_life', drained: Math.floor(dealt / 2), outcomes: [{ unit: 'hero', hit: true, damage: dealt }] })
      expect(unitOf(engine, 'hero').hp).toBe(HERO_STATS.maxHp - dealt)
      expect(unitOf(engine, 'wight')).toMatchObject({
        hp: BARROW_WIGHT_STATS.maxHp - 20 + Math.floor(dealt / 2),
        ap: BARROW_WIGHT_STATS.actionPoints - apCost,
        mana: BARROW_WIGHT_STATS.magic!.maxMana - manaCost,
      })
    })

    it('heals nothing on a miss, and cannot reach a hero beyond its range', () => {
      const engine = field(() => MISS)
      const [event] = engine.step(drain) as CastEvent[]
      expect(event).toMatchObject({ drained: 0, outcomes: [{ unit: 'hero', hit: false, damage: 0 }] })
      expect(unitOf(engine, 'wight').hp).toBe(BARROW_WIGHT_STATS.maxHp - 20)
      const far = enemyTurn([heroAt('hero', 1, 1), foeAt('wight', BARROW_WIGHT_STATS, 2 + range, 1)], () => HIT)
      expect(far.legalActions('wight').some((a) => a.type === 'cast')).toBe(false)
    })

    it('takes a blow as any foe does: a plain block, with no word on what the weapon is (the half damage is deferred)', () => {
      expect(BARROW_WIGHT_STATS).toMatchObject({ resistance: 3 })
      expect(BARROW_WIGHT_STATS.wards).toBeUndefined()
      expect(BARROW_WIGHT_STATS.immune).toBeUndefined()
    })
  })

  describe('the Basilisk’s Gaze', () => {
    const { apCost, recharge } = ABILITIES.basilisk_gaze
    const area = ABILITIES.basilisk_gaze.area!
    const gaze = (at = hex(4, 1)): Action => ({ type: 'ability', unit: 'basilisk', ability: 'basilisk_gaze', at })
    /** The Basilisk at (5,1) looking west down the row: heroes 1, 2 and 3 hexes off in it and a fourth 4 off. */
    const field = (rng: () => number) =>
      enemyTurn(
        [
          heroAt('near', 4, 1),
          heroAt('mid', 3, 1),
          heroAt('far', 2, 1),
          heroAt('beyond', 1, 1),
          foeAt('basilisk', BASILISK_STATS, 5, 1),
        ],
        rng,
      )
    const chilled = (engine: BattleEngine, id: string) => unitOf(engine, id).statuses.find((s) => s.id === 'chilled')

    it('is a cone 3 hexes long that deals no damage and lays Chilled, every other turn', () => {
      expect(ABILITIES.basilisk_gaze.name).toBe('Gaze')
      expect(area).toEqual({ shape: 'cone', range: 3, status: { id: 'chilled', turns: area.status!.turns }, halfOnMiss: false })
      expect(recharge).toBe(2)
      expect(BASILISK_STATS.abilities).toEqual(['basilisk_gaze'])
    })

    it('rolls once against each hero in the cone and lays Chilled on those it hits, with no dice and no damage', () => {
      // near: hit; mid: missed; far: hit. No damage dice are drawn.
      const stream = counted([HIT, MISS, HIT])
      const engine = field(stream.rng)
      const [event] = engine.step(gaze()) as AbilityEvent[]
      expect(event).toMatchObject({ type: 'ability', unit: 'basilisk', ability: 'basilisk_gaze', shape: 'cone', apCost, skill: BASILISK_STATS.toHit })
      expect(event.outcomes.map((o) => [o.unit, o.hit, o.half, o.damage])).toEqual([
        ['near', true, false, 0],
        ['mid', false, false, 0],
        ['far', true, false, 0],
      ])
      expect(event.outcomes.map((o) => o.status?.id)).toEqual(['chilled', undefined, 'chilled'])
      expect(stream.draws()).toBe(3)
      for (const id of ['near', 'mid', 'far', 'beyond']) expect(unitOf(engine, id).hp, id).toBe(HERO_STATS.maxHp)
      expect(chilled(engine, 'near')).toMatchObject({ id: 'chilled', turnsLeft: area.status!.turns })
      expect(chilled(engine, 'mid')).toBeUndefined()
      expect(chilled(engine, 'far')).toBeDefined()
      expect(chilled(engine, 'beyond')).toBeUndefined()
      expect(unitOf(engine, 'basilisk')).toMatchObject({ ap: BASILISK_STATS.actionPoints - apCost, recharging: { basilisk_gaze: recharge } })
    })

    it('costs a chilled hero 3 action points on its next turn', () => {
      const engine = field(() => HIT)
      engine.step(gaze())
      engine.step(END_TURN)
      expect(unitOf(engine, 'near').ap).toBe(HERO_STATS.actionPoints - 3)
      expect(unitOf(engine, 'beyond').ap).toBe(HERO_STATS.actionPoints)
    })

    it('is not legal again until its recharge has run: the turn after next', () => {
      const engine = field(() => HIT)
      const ready = () => engine.legalActions('basilisk').some((a) => a.type === 'ability')
      engine.step(gaze())
      expect(ready()).toBe(false)
      engine.step(END_TURN)
      engine.step(END_TURN)
      expect(ready()).toBe(false)
      engine.step(END_TURN)
      engine.step(END_TURN)
      expect(ready()).toBe(true)
    })

    it('is slow: fewer action points than a foe of 8', () => {
      expect(BASILISK_STATS.actionPoints).toBeLessThan(8)
      expect(BASILISK_STATS).toMatchObject({ resistance: 4 })
    })
  })

  describe('the Hill Giant’s Rock', () => {
    const { apCost, recharge } = ABILITIES.giant_rock
    const area = ABILITIES.giant_rock.area!
    const dice = area.damage!
    const rock = (at: ReturnType<typeof hex>): Action => ({ type: 'ability', unit: 'giant', ability: 'giant_rock', at })
    /** The Giant at (6,1); a hero 4 hexes off with one beside it either side and one behind, and an ogre of the Giant's own beside that hero. */
    const field = (rng: () => number, resistance = HERO_STATS.resistance!) =>
      enemyTurn(
        [
          heroAt('target', 2, 1, { resistance }),
          heroAt('beside', 3, 1),
          heroAt('behind', 1, 1),
          heroAt('above', 2, 0),
          foeAt('giant', HILL_GIANT_STATS, 6, 1),
          foeAt('ogre', OGRE_STATS, 2, 2),
        ],
        rng,
      )

    it('is a burst of no radius 4 hexes off, through resistance, with a recharge; the Giant’s weapon is a Club', () => {
      expect(ABILITIES.giant_rock.name).toBe('Rock')
      expect(area).toMatchObject({ shape: 'burst', range: 4, radius: 0, throughResistance: true })
      expect(area.element).toBeUndefined()
      expect(recharge).toBeGreaterThanOrEqual(1)
      expect(HILL_GIANT_STATS).toMatchObject({ weapon: 'Club', resistance: 3, abilities: ['giant_rock'] })
    })

    it('aimed at a hero 4 hexes off, touches only that hero: one roll and its dice, and nothing else is struck', () => {
      const stream = counted([HIT, ...Array<number>(dice.count).fill(0)])
      const engine = field(stream.rng)
      const [event] = engine.step(rock(hex(2, 1))) as AbilityEvent[]
      expect(event).toMatchObject({ type: 'ability', unit: 'giant', ability: 'giant_rock', shape: 'burst', at: hex(2, 1), distance: 4, apCost, skill: HILL_GIANT_STATS.toHit })
      expect(event.outcomes.map((o) => [o.unit, o.hit])).toEqual([['target', true]])
      expect(stream.draws()).toBe(1 + dice.count)
      for (const id of ['beside', 'behind', 'above', 'ogre', 'giant']) expect(unitOf(engine, id).hp, id).toBe(unitOf(engine, id).maxHp)
      expect(unitOf(engine, 'giant')).toMatchObject({ ap: HILL_GIANT_STATS.actionPoints - apCost, recharging: { giant_rock: recharge } })
    })

    it('goes through the hero’s resistance, less the Giant’s piercing, as a blow', () => {
      // A hero in plate of the expected kit's weight (resistance 11 at the Giant's level), a 10 on each die.
      const engine = field(counted([HIT, ...Array<number>(dice.count).fill(0.999)]).rng, 11)
      const [event] = engine.step(rock(hex(2, 1))) as AbilityEvent[]
      const rolled = dice.count * dice.sides + dice.bonus
      const through = damageThrough(rolled, effectiveResistance(HILL_GIANT_STATS, 11))
      // The Giant pierces some of the hero's armour, not all: the armour still turns part of the rock.
      expect(HILL_GIANT_STATS.armorPierce).toBeGreaterThan(0)
      expect(through).toBeLessThan(rolled)
      expect(event.outcomes).toMatchObject([{ unit: 'target', damage: through, resisted: rolled - through }])
      expect(unitOf(engine, 'target').hp).toBe(HERO_STATS.maxHp - through)
    })

    it('says in the log how much the armour stopped, as a weapon hit does, and nothing when it stopped none', () => {
      const names = { giant: 'Hill Giant', target: 'Delwyn' }
      const rolled = dice.count * dice.sides + dice.bonus
      const through = damageThrough(rolled, effectiveResistance(HILL_GIANT_STATS, 11))
      const [cut] = field(counted([HIT, ...Array<number>(dice.count).fill(0.999)]).rng, 11).step(rock(hex(2, 1))) as AbilityEvent[]
      expect(formatEvent(cut, names)).toBe(`Hill Giant hurls a rock: HITS Delwyn for ${through} dmg (armour stops ${rolled - through}).`)
      const [bare] = field(counted([HIT, ...Array<number>(dice.count).fill(0.999)]).rng, 0).step(rock(hex(2, 1))) as AbilityEvent[]
      expect(formatEvent(bare, names)).toBe(`Hill Giant hurls a rock: HITS Delwyn for ${rolled} dmg.`)
    })

    it('cannot be thrown further than 4 hexes, and is aimed at a hero’s hex 2 to 4 off as well as beside it', () => {
      const engine = field(() => HIT)
      const centres = engine.legalActions('giant').flatMap((a) => (a.type === 'ability' && 'at' in a ? [hexKey(a.at)] : []))
      expect(centres).toContain(hexKey(hex(2, 1)))
      expect(centres).toContain(hexKey(hex(3, 1)))
      expect(centres).not.toContain(hexKey(hex(1, 1)))
      expect(() => engine.step(rock(hex(1, 1)))).toThrow('cannot use giant_rock')
    })

    it('is ready again after its recharge, not before', () => {
      const engine = field(() => HIT)
      engine.step(rock(hex(2, 1)))
      expect(engine.legalActions('giant').some((a) => a.type === 'ability')).toBe(false)
      for (let turn = 0; turn < 2 * recharge; turn++) engine.step(END_TURN)
      expect(engine.legalActions('giant').some((a) => a.type === 'ability')).toBe(true)
    })
  })
})

describe('ring 15 (stage 11 step 11)', () => {
  describe('the Stone Golem', () => {
    const MAGE = { actionPoints: 12, magic: { maxMana: 60, skill: 100, spells: ['acid_arrow', 'curse', 'death_cloud'] as const } }
    /** The player's turn: a caster 2 hexes from the golem. */
    const field = (rng: () => number, golem: CombatantStats = STONE_GOLEM_STATS, hero: Partial<CombatantStats> = {}) =>
      new BattleEngine({ board: BOARD, units: [heroAt('hero', 1, 1, { ...MAGE, magic: { ...MAGE.magic, spells: [...MAGE.magic.spells] }, ...hero }), foeAt('golem', golem, 3, 1)] }, { rng })
    const cast = (spell: 'acid_arrow' | 'curse'): Action => ({ type: 'cast', unit: 'hero', spell, target: 'golem' })

    it('is a wall with a Slam and no ability: resistance 8, immune, warded against poison', () => {
      expect(STONE_GOLEM_STATS).toMatchObject({ weapon: 'Slam', resistance: 8, immune: true, wards: { poison: 99 } })
      expect(STONE_GOLEM_STATS.abilities).toBeUndefined()
      expect(STONE_GOLEM_STATS.magic).toBeUndefined()
    })

    it('is never Corroded: Acid Arrow hits and deals its damage, the status refused and the log saying so', () => {
      const engine = field(() => HIT)
      const [event] = engine.step(cast('acid_arrow')) as CastEvent[]
      expect(event.outcomes[0]).toMatchObject({ unit: 'golem', hit: true, status: null, immune: true })
      expect(event.outcomes[0].damage).toBeGreaterThan(0)
      expect(unitOf(engine, 'golem').statuses).toEqual([])
      expect(formatEvent(event, { hero: 'Hero', golem: 'Stone Golem' })).toContain('unaffected by the rest')
    })

    it('is never Poisoned: Death Cloud lays nothing on it', () => {
      const engine = field(() => HIT)
      const [event] = engine.step({ type: 'cast', unit: 'hero', spell: 'death_cloud', at: hex(3, 1) }) as CastEvent[]
      expect(event.outcomes).toMatchObject([{ unit: 'golem', status: null, immune: true }])
      expect(unitOf(engine, 'golem').statuses).toEqual([])
      expect(formatEvent(event, { hero: 'Hero', golem: 'Stone Golem' })).toBe('Hero casts Death Cloud: Stone Golem is unaffected.')
    })

    it('is still Cursed: a status that does not tick is laid as on any foe', () => {
      const engine = field(() => HIT)
      const [event] = engine.step(cast('curse')) as CastEvent[]
      expect(event.outcomes[0]).toMatchObject({ unit: 'golem', hit: true, status: { id: 'cursed' } })
      expect('immune' in event.outcomes[0]).toBe(false)
      expect(unitOf(engine, 'golem').statuses.map((s) => s.id)).toEqual(['cursed'])
    })

    it('loses nothing to a poison’s tick behind its ward of 99, were one laid (the block without the immunity)', () => {
      const { immune: _immune, ...notImmune } = STONE_GOLEM_STATS
      const engine = field(() => HIT, notImmune)
      engine.step({ type: 'cast', unit: 'hero', spell: 'death_cloud', at: hex(3, 1) })
      expect(unitOf(engine, 'golem').statuses.map((s) => s.id)).toEqual(['poisoned'])
      engine.step(END_TURN)
      expect(unitOf(engine, 'golem').statuses.map((s) => s.id)).toEqual(['poisoned'])
      expect(unitOf(engine, 'golem').hp).toBe(STONE_GOLEM_STATS.maxHp)
    })
  })

  describe('the Young Dragon’s Fire Breath', () => {
    const { apCost, recharge } = ABILITIES.dragon_breath
    const area = ABILITIES.dragon_breath.area!
    const dice = area.damage!
    const breathe: Action = { type: 'ability', unit: 'dragon', ability: 'dragon_breath', at: hex(4, 1) }
    const ones = Array<number>(dice.count).fill(0)
    const sixes = Array<number>(dice.count).fill(0.999)
    /** The Dragon at (5,1) breathing west down the row: heroes 1, 2 and 3 hexes off in the cone and a fourth 4 off. */
    const field = (rng: () => number, near: Partial<CombatantStats> = {}) =>
      enemyTurn([heroAt('near', 4, 1, near), heroAt('mid', 3, 1), heroAt('far', 2, 1), heroAt('beyond', 1, 1), foeAt('dragon', YOUNG_DRAGON_STATS, 5, 1)], rng)

    it('is a cone of fire 3 hexes long, 6d6, half on a miss, laying Seared, with a recharge of 3 and no word on resistance', () => {
      expect(ABILITIES.dragon_breath.name).toBe('Fire Breath')
      expect(area).toEqual({ shape: 'cone', range: 3, damage: { count: 6, sides: 6, bonus: 0 }, element: 'fire', status: { id: 'seared', turns: 1 }, halfOnMiss: true })
      expect(area.throughResistance).toBeUndefined()
      expect(recharge).toBe(3)
      expect(YOUNG_DRAGON_STATS).toMatchObject({ resistance: 4, wards: { fire: 10 }, abilities: ['dragon_breath', 'dragon_strikes'] })
    })

    it('touches the heroes 1 to 3 hexes off toward the aim: a hit deals what it rolls whatever the armour and lays Seared, a miss half and nothing', () => {
      // near: hit, six 6s; mid: missed, six 6s halved; far: hit, six 1s.
      const stream = counted([HIT, ...sixes, MISS, ...sixes, HIT, ...ones])
      const engine = field(stream.rng)
      const [event] = engine.step(breathe) as AbilityEvent[]
      expect(event).toMatchObject({ type: 'ability', unit: 'dragon', ability: 'dragon_breath', shape: 'cone', apCost, skill: YOUNG_DRAGON_STATS.toHit })
      const most = dice.count * dice.sides + dice.bonus
      const least = dice.count + dice.bonus
      expect(event.outcomes.map((o) => [o.unit, o.hit, o.half, o.damage, o.status?.id])).toEqual([
        ['near', true, false, most, 'seared'],
        ['mid', false, true, Math.floor(most / 2), undefined],
        ['far', true, false, least, 'seared'],
      ])
      // The heroes' resistance (6) cut nothing.
      expect(HERO_STATS.resistance).toBeGreaterThan(0)
      expect(unitOf(engine, 'near').hp).toBe(HERO_STATS.maxHp - most)
      expect(unitOf(engine, 'mid').hp).toBe(HERO_STATS.maxHp - Math.floor(most / 2))
      expect(unitOf(engine, 'beyond').hp).toBe(HERO_STATS.maxHp)
      expect(unitOf(engine, 'mid').statuses).toEqual([])
      expect(stream.draws()).toBe(3 * (1 + dice.count))
      expect(unitOf(engine, 'dragon')).toMatchObject({ ap: YOUNG_DRAGON_STATS.actionPoints - apCost, recharging: { dragon_breath: recharge } })
    })

    it('recharges for 3 of its side’s turns', () => {
      const engine = field(() => HIT)
      const ready = () => engine.legalActions('dragon').some((a) => a.type === 'ability' && a.ability === 'dragon_breath')
      engine.step(breathe)
      for (let turn = 0; turn < recharge - 1; turn++) {
        engine.step(END_TURN)
        engine.step(END_TURN)
        expect(ready(), `turn ${turn + 1}`).toBe(false)
      }
      engine.step(END_TURN)
      engine.step(END_TURN)
      expect(ready()).toBe(true)
    })

    it('is cut by a hero’s fire ward, each instance: Ember wards of 7 take a third of its mean 21, and all of a halved low roll', () => {
      // near (warded 7): hit, six 1s: 6, all warded. mid: hit, six 1s: 6.
      const low = field(counted([HIT, ...ones, HIT, ...ones]).rng, { wards: { fire: 7 } })
      const [first] = low.step(breathe) as AbilityEvent[]
      expect(first.outcomes.slice(0, 2).map((o) => [o.unit, o.damage, o.warded])).toEqual([
        ['near', 0, 6],
        ['mid', 6, 0],
      ])
      const high = field(counted([HIT, ...sixes]).rng, { wards: { fire: 7 } })
      const [second] = high.step(breathe) as AbilityEvent[]
      expect(second.outcomes[0]).toMatchObject({ unit: 'near', damage: 36 - 7, warded: 7 })
      // The design's "a third": 7 of the breath's mean of 21.
      const mean = (dice.count * (dice.sides + 1)) / 2 + dice.bonus
      expect(7 / mean).toBeCloseTo(1 / 3)
    })

    it('scarcely feels Flame Arrow: its fire ward of 10 comes off the spell’s damage', () => {
      const flame = SPELLS.flame_arrow.damage!
      const engine = new BattleEngine(
        { board: BOARD, units: [heroAt('hero', 1, 1, { magic: { maxMana: 60, skill: 100, spells: ['flame_arrow'] } }), foeAt('dragon', YOUNG_DRAGON_STATS, 4, 1)] },
        { rng: counted([HIT, ...Array<number>(flame.count).fill(0.999)]).rng },
      )
      const [event] = engine.step({ type: 'cast', unit: 'hero', spell: 'flame_arrow', target: 'dragon' }) as CastEvent[]
      const rolled = flame.count * flame.sides + flame.bonus
      expect(event.outcomes[0]).toMatchObject({ unit: 'dragon', hit: true, damage: rolled - 10, warded: 10 })
      expect(unitOf(engine, 'dragon').hp).toBe(YOUNG_DRAGON_STATS.maxHp - (rolled - 10))
    })
  })

  describe('the Young Dragon’s Bite and Claws', () => {
    const use: Action = { type: 'ability', unit: 'dragon', ability: 'dragon_strikes', target: 'hero' }
    const { apCost, strikes } = ABILITIES.dragon_strikes

    it('is a routine of a Bite of 2d8 and two Claws of 1d8', () => {
      expect(ABILITIES.dragon_strikes.name).toBe('Bite and Claws')
      expect(strikes!.map((s) => [s.name, s.damage!.count, s.damage!.sides])).toEqual([['Bite', 2, 8], ['Claw', 1, 8], ['Claw', 1, 8]])
      expect(ABILITIES.dragon_strikes.area).toBeUndefined()
    })

    it('makes three weapon attacks on one foe in one action, each under its strike’s name, through armour less the Dragon’s piercing', () => {
      // The Bite hits without a critical and rolls its most; the draws after it are the Claws'.
      const engine = enemyTurn([heroAt('hero', 1, 1), foeAt('dragon', YOUNG_DRAGON_STATS, 2, 1)], counted([HIT, 0.999]).rng)
      const attacks = engine.step(use).filter((e): e is AttackEvent => e.type === 'attack')
      expect(attacks.map((e) => [e.attacker, e.ability, e.strike, e.defender])).toEqual([
        ['dragon', 'dragon_strikes', 'Bite', 'hero'],
        ['dragon', 'dragon_strikes', 'Claw', 'hero'],
        ['dragon', 'dragon_strikes', 'Claw', 'hero'],
      ])
      expect(attacks.map((e) => e.apCost)).toEqual([apCost, 0, 0])
      expect(attacks.map((e) => e.damageDice)).toEqual(strikes!.map((s) => s.damage))
      const [bite] = attacks
      expect(bite.hit).toBe(true)
      const rolled = strikes![0].damage!.count * strikes![0].damage!.sides + strikes![0].damage!.bonus
      expect(bite.damage).toBe(damageThrough(rolled, effectiveResistance(YOUNG_DRAGON_STATS, HERO_STATS.resistance!)))
      expect(unitOf(engine, 'dragon').ap).toBe(YOUNG_DRAGON_STATS.actionPoints - apCost)
    })
  })

  describe('the Blight Cultist', () => {
    /** What `aggressive` has the enemy cast on its first turn: its steps' events until a cast or the turn's end. */
    const firstCast = (units: UnitSetup[]) => {
      const engine = enemyTurn(units, () => HIT)
      while (engine.getState().phase === 'enemy') {
        const action = POLICIES.aggressive({
          state: engine.getState(),
          legal: engine.legalActions(),
          legalFor: (unit) => engine.legalActions(unit).filter((a) => a.type !== 'end_turn'),
          rng: () => 0.5,
        })
        const cast = engine.step(action).find((e): e is CastEvent => e.type === 'cast')
        if (cast) return cast
      }
      return null
    }

    it('is a frail caster of the blight: Heal, Curse and Lightning Bolt, the mana for a bolt, and a Dawn rune’s bane applies', () => {
      expect(BLIGHT_CULTIST_STATS.magic!.spells).toEqual(['heal', 'curse', 'lightning_bolt'])
      expect(BLIGHT_CULTIST_STATS.magic!.maxMana).toBeGreaterThanOrEqual(SPELLS.lightning_bolt.manaCost)
      expect(BLIGHT_CULTIST_STATS).toMatchObject({ resistance: 1, blightborn: true })
      expect(baneApplies(BLIGHT_CULTIST_STATS)).toBe(true)
      expect(baneApplies(STONE_GOLEM_STATS)).toBe(false)
      expect(baneApplies(YOUNG_DRAGON_STATS)).toBe(false)
    })

    it('heals a badly wounded ally in range', () => {
      const cast = firstCast([
        heroAt('hero', 0, 0),
        foeAt('cultist', BLIGHT_CULTIST_STATS, 7, 1),
        { ...foeAt('wight', { ...BARROW_WIGHT_STATS, magic: undefined }, 8, 1), hp: 10 },
      ])
      expect(cast).toMatchObject({ type: 'cast', caster: 'cultist', spell: 'heal', outcomes: [{ unit: 'wight' }] })
    })

    it('throws a Lightning Bolt down a line of two heroes, which their armour does not turn, and casts Curse or the Bolt at two that stand apart', () => {
      const bolt = firstCast([heroAt('near', 3, 1), heroAt('far', 2, 1), foeAt('cultist', BLIGHT_CULTIST_STATS, 7, 1)])
      expect(bolt).toMatchObject({ type: 'cast', caster: 'cultist', spell: 'lightning_bolt' })
      expect(bolt!.outcomes.map((o) => [o.unit, o.hit])).toEqual([['near', true], ['far', true]])
      // Every draw is 0.9: a 6 on each of the bolt's 4d6, whole, though the heroes have resistance 6.
      expect(bolt!.outcomes.map((o) => o.damage)).toEqual([24, 24])
      const apart = firstCast([heroAt('high', 3, 0), heroAt('low', 2, 2), foeAt('cultist', BLIGHT_CULTIST_STATS, 7, 1)])
      expect(apart).toMatchObject({ type: 'cast', caster: 'cultist' })
      expect(['curse', 'lightning_bolt']).toContain(apart!.spell)
    })
  })
})

describe('ring 18 (stage 11 step 12)', () => {
  /** The regeneration events of `unit` among `events`. */
  const regenerated = (events: BattleEvent[], unit: string) => events.filter((e) => e.type === 'regenerate' && e.unit === unit)

  describe('the Blight Lich', () => {
    const MAGE = { actionPoints: 12, magic: { maxMana: 60, skill: 100, spells: ['flame_arrow', 'acid_arrow'] as const } }
    /** The player's turn: a caster 3 hexes from a wounded lich. */
    const field = (rng: () => number) =>
      new BattleEngine(
        {
          board: BOARD,
          units: [heroAt('hero', 1, 1, { ...MAGE, magic: { ...MAGE.magic, spells: [...MAGE.magic.spells] } }), { ...foeAt('lich', BLIGHT_LICH_STATS, 4, 1), hp: 50 }],
        },
        { rng },
      )

    it('is a caster boss of the blight: Death Cloud, Lightning Bolt, Drain Life and Dark Shield, mana for each once, regeneration 3, and a Dawn rune’s bane applies', () => {
      expect(BLIGHT_LICH_STATS.magic!.spells).toEqual(['death_cloud', 'lightning_bolt', 'drain_life', 'dark_shield'])
      const costs = BLIGHT_LICH_STATS.magic!.spells.map((spell) => SPELLS[spell].manaCost)
      expect(BLIGHT_LICH_STATS.magic!.maxMana).toBeGreaterThanOrEqual(costs.reduce((a, b) => a + b, 0))
      expect(BLIGHT_LICH_STATS).toMatchObject({ resistance: 3, regeneration: 3, blightborn: true })
      expect(baneApplies(BLIGHT_LICH_STATS)).toBe(true)
      expect(baneApplies(ELDER_WYRM_STATS)).toBe(true) // it regenerates
    })

    it('regenerates 3 as its side’s turn begins', () => {
      const engine = field(() => HIT)
      const events = engine.step(END_TURN)
      expect(regenerated(events, 'lich')).toMatchObject([{ healed: 3, hpBefore: 50, hpAfter: 53 }])
      expect(unitOf(engine, 'lich').hp).toBe(53)
    })

    it.each([['Seared', 'flame_arrow', 'seared'], ['Corroded', 'acid_arrow', 'corroded']] as const)('does not regenerate while %s', (_name, spell, status) => {
      const engine = field(() => HIT)
      engine.step({ type: 'cast', unit: 'hero', spell, target: 'lich' })
      expect(unitOf(engine, 'lich').statuses.map((s) => s.id)).toContain(status)
      expect(regenerated(engine.step(END_TURN), 'lich')).toEqual([])
    })

    it('has each of its four spells to cast on its turn, with a hero 3 hexes off', () => {
      const engine = enemyTurn([heroAt('hero', 1, 1), heroAt('other', 2, 1), foeAt('lich', BLIGHT_LICH_STATS, 4, 1)], () => HIT)
      const spells = new Set(engine.legalActions('lich').flatMap((a) => (a.type === 'cast' ? [a.spell] : [])))
      expect(spells).toEqual(new Set(['death_cloud', 'lightning_bolt', 'drain_life', 'dark_shield']))
    })

    it('drains a hero’s life to heal itself by half, and lays Shielded on itself with Dark Shield', () => {
      const engine = enemyTurn([heroAt('hero', 1, 1), { ...foeAt('lich', BLIGHT_LICH_STATS, 4, 1), hp: 50 }], counted([HIT, 0.999]).rng)
      const before = unitOf(engine, 'lich').hp
      const [drain] = engine.step({ type: 'cast', unit: 'lich', spell: 'drain_life', target: 'hero' }) as CastEvent[]
      const dice = SPELLS.drain_life.damage!
      const rolled = dice.count * dice.sides + dice.bonus
      // No armour turns it: the hero's resistance of 6 takes nothing.
      expect(drain.outcomes[0]).toMatchObject({ unit: 'hero', hit: true, damage: rolled })
      expect(drain.drained).toBe(Math.floor(rolled / 2))
      expect(unitOf(engine, 'lich').hp).toBe(before + Math.floor(rolled / 2))
      engine.step({ type: 'cast', unit: 'lich', spell: 'dark_shield', target: 'lich' })
      expect(unitOf(engine, 'lich').statuses.map((s) => s.id)).toContain('shielded')
    })
  })

  describe('the Elder Wyrm’s Fire Breath', () => {
    const { apCost, recharge } = ABILITIES.wyrm_breath
    const area = ABILITIES.wyrm_breath.area!
    const dice = area.damage!
    const breathe: Action = { type: 'ability', unit: 'wyrm', ability: 'wyrm_breath', at: hex(5, 1) }
    const sixes = Array<number>(dice.count).fill(0.999)
    /** The Wyrm at (6,1) breathing west down the row: heroes 1 to 4 hexes off in the cone and a fifth 5 off. */
    const field = (rng: () => number) =>
      enemyTurn([heroAt('h1', 5, 1), heroAt('h2', 4, 1), heroAt('h3', 3, 1), heroAt('h4', 2, 1), heroAt('h5', 1, 1), foeAt('wyrm', ELDER_WYRM_STATS, 6, 1)], rng)

    it('is a cone of fire 4 hexes long, 8d6, half on a miss, laying Seared, with a recharge of 3 and no word on resistance', () => {
      expect(ABILITIES.wyrm_breath.name).toBe('Fire Breath')
      expect(area).toEqual({ shape: 'cone', range: 4, damage: { count: 8, sides: 6, bonus: 0 }, element: 'fire', status: { id: 'seared', turns: 1 }, halfOnMiss: true })
      expect(area.throughResistance).toBeUndefined()
      expect(recharge).toBe(3)
      expect(ELDER_WYRM_STATS).toMatchObject({ resistance: 5, regeneration: 2, wards: { fire: 15 }, abilities: ['wyrm_breath', 'wyrm_strikes'] })
    })

    it('touches the heroes 1 to 4 hexes off toward the aim: a hit whole and Seared, a miss half and nothing; the fifth is untouched', () => {
      // The Wyrm hits a hero in mail at 95 (its 115 less armour 25, held to 95): a roll of 99 misses.
      const stream = counted([HIT, ...sixes, 0.01, ...sixes, HIT, ...sixes, HIT, ...sixes])
      const engine = field(stream.rng)
      const [event] = engine.step(breathe) as AbilityEvent[]
      expect(event).toMatchObject({ type: 'ability', unit: 'wyrm', ability: 'wyrm_breath', shape: 'cone', apCost })
      const most = dice.count * dice.sides + dice.bonus
      expect(event.outcomes.map((o) => [o.unit, o.hit, o.damage, o.status?.id])).toEqual([
        ['h1', true, most, 'seared'],
        ['h2', false, Math.floor(most / 2), undefined],
        ['h3', true, most, 'seared'],
        ['h4', true, most, 'seared'],
      ])
      expect(unitOf(engine, 'h5').hp).toBe(HERO_STATS.maxHp)
      expect(stream.draws()).toBe(4 * (1 + dice.count))
      expect(unitOf(engine, 'wyrm')).toMatchObject({ ap: ELDER_WYRM_STATS.actionPoints - apCost, recharging: { wyrm_breath: recharge } })
    })

    it('recharges for 3 of its side’s turns', () => {
      const engine = field(() => HIT)
      const ready = () => engine.legalActions('wyrm').some((a) => a.type === 'ability' && a.ability === 'wyrm_breath')
      engine.step(breathe)
      for (let turn = 0; turn < recharge - 1; turn++) {
        engine.step(END_TURN)
        engine.step(END_TURN)
        expect(ready(), `turn ${turn + 1}`).toBe(false)
      }
      engine.step(END_TURN)
      engine.step(END_TURN)
      expect(ready()).toBe(true)
    })
  })

  describe('the Elder Wyrm', () => {
    it('regenerates 2 as its side’s turn begins', () => {
      const engine = new BattleEngine({ board: BOARD, units: [heroAt('hero', 1, 1), { ...foeAt('wyrm', ELDER_WYRM_STATS, 7, 1), hp: 100 }] }, { rng: () => HIT })
      expect(regenerated(engine.step(END_TURN), 'wyrm')).toMatchObject([{ healed: 2, hpBefore: 100, hpAfter: 102 }])
    })

    it('takes 15 off each fire instance: Flame Arrow’s hit less its ward, and nothing of a low roll', () => {
      const flame = SPELLS.flame_arrow.damage!
      const cast = (draw: number) => {
        const engine = new BattleEngine(
          { board: BOARD, units: [heroAt('hero', 1, 1, { magic: { maxMana: 60, skill: 100, spells: ['flame_arrow'] } }), foeAt('wyrm', ELDER_WYRM_STATS, 4, 1)] },
          { rng: counted([HIT, ...Array<number>(flame.count).fill(draw)]).rng },
        )
        return (engine.step({ type: 'cast', unit: 'hero', spell: 'flame_arrow', target: 'wyrm' }) as CastEvent[])[0].outcomes[0]
      }
      const rolled = flame.count * flame.sides + flame.bonus
      expect(cast(0.999)).toMatchObject({ unit: 'wyrm', hit: true, damage: Math.max(0, rolled - 15), warded: Math.min(15, rolled) })
      const least = flame.count + flame.bonus
      expect(cast(0)).toMatchObject({ unit: 'wyrm', hit: true, damage: Math.max(0, least - 15), warded: Math.min(15, least) })
    })

    it('bites and claws: a routine of a Bite of 2d10 and two Claws of 1d10, one attack event a strike, through armour less its piercing', () => {
      const { apCost, strikes } = ABILITIES.wyrm_strikes
      expect(ABILITIES.wyrm_strikes.name).toBe('Bite and Claws')
      expect(strikes!.map((s) => [s.name, s.damage!.count, s.damage!.sides])).toEqual([['Bite', 2, 10], ['Claw', 1, 10], ['Claw', 1, 10]])
      const engine = enemyTurn([heroAt('hero', 1, 1), foeAt('wyrm', ELDER_WYRM_STATS, 2, 1)], counted([HIT, 0.999]).rng)
      const attacks = engine.step({ type: 'ability', unit: 'wyrm', ability: 'wyrm_strikes', target: 'hero' }).filter((e): e is AttackEvent => e.type === 'attack')
      expect(attacks.map((e) => [e.attacker, e.ability, e.strike])).toEqual([['wyrm', 'wyrm_strikes', 'Bite'], ['wyrm', 'wyrm_strikes', 'Claw'], ['wyrm', 'wyrm_strikes', 'Claw']])
      expect(attacks.map((e) => e.apCost)).toEqual([apCost, 0, 0])
      const rolled = strikes![0].damage!.count * strikes![0].damage!.sides
      expect(attacks[0].damage).toBe(damageThrough(rolled, effectiveResistance(ELDER_WYRM_STATS, HERO_STATS.resistance!)))
    })
  })
})

describe('the Source at 20 (stage 11 step 13)', () => {
  const regenerated = (events: BattleEvent[], unit: string) => events.filter((e) => e.type === 'regenerate' && e.unit === unit)

  describe('the Blight Horror’s Blight Breath', () => {
    const { apCost, recharge } = ABILITIES.blight_breath
    const area = ABILITIES.blight_breath.area!
    const dice = area.damage!
    const breathe: Action = { type: 'ability', unit: 'horror', ability: 'blight_breath', at: hex(4, 1) }
    const sixes = Array<number>(dice.count).fill(0.999)
    const most = dice.count * dice.sides + dice.bonus
    /** The Horror at (4,1): heroes 1 and 2 hexes off either side, one 3 off, and two Blight Cultists of its own beside it. */
    const field = (rng: () => number, ward = 0) =>
      enemyTurn(
        [
          heroAt('h1', 3, 1),
          heroAt('h2', 2, 1, ward ? { wards: { blight: ward } } : {}),
          heroAt('h3', 5, 1),
          heroAt('far', 7, 1),
          foeAt('horror', SOURCE_HORROR_STATS, 4, 1),
          foeAt('acolyte', BLIGHT_CULTIST_STATS, 4, 0),
          foeAt('zealot', BLIGHT_CULTIST_STATS, 5, 0),
        ],
        rng,
      )

    it('is a burst of radius 2 around the Horror, foes only, 8d6 blight, half on a miss, laying Corroded, with a recharge of 3 and no word on resistance', () => {
      expect(ABILITIES.blight_breath.name).toBe('Blight Breath')
      expect(area).toMatchObject({ shape: 'burst', centredOnSelf: true, range: 0, radius: 2, foesOnly: true, element: 'blight', status: { id: 'corroded' }, halfOnMiss: true })
      expect(area.throughResistance).toBeUndefined()
      expect(recharge).toBe(3)
    })

    it('is aimed only at the Horror’s own hex', () => {
      const engine = field(() => HIT)
      const centres = engine.legalActions('horror').flatMap((a) => (a.type === 'ability' && a.ability === 'blight_breath' && 'at' in a ? [hexKey(a.at)] : []))
      expect(centres).toEqual([hexKey(hex(4, 1))])
    })

    it('touches every hero within 2 hexes and none of its guardians beside it: a hit whole and Corroded, a miss half and nothing', () => {
      // The Horror hits a hero in mail at 75 (its 125 less armour 25, held to 95): a roll of 99 misses.
      const stream = counted([HIT, ...sixes, 0.01, ...sixes, HIT, ...sixes])
      const engine = field(stream.rng)
      const [event] = engine.step(breathe) as AbilityEvent[]
      expect(event).toMatchObject({ type: 'ability', unit: 'horror', ability: 'blight_breath', shape: 'burst', apCost })
      expect(event.outcomes.map((o) => [o.unit, o.hit, o.damage, o.status?.id])).toEqual([
        ['h1', true, most, 'corroded'],
        ['h2', false, Math.floor(most / 2), undefined],
        ['h3', true, most, 'corroded'],
      ])
      expect(unitOf(engine, 'h1').statuses.map((s) => s.id)).toContain('corroded')
      expect(unitOf(engine, 'h2').statuses).toEqual([])
      for (const id of ['far', 'horror', 'acolyte', 'zealot']) {
        expect(unitOf(engine, id).hp, id).toBe(unitOf(engine, id).maxHp)
        expect(unitOf(engine, id).statuses, id).toEqual([])
      }
      expect(stream.draws()).toBe(3 * (1 + dice.count))
      expect(unitOf(engine, 'horror')).toMatchObject({ ap: SOURCE_HORROR_STATS.actionPoints - apCost, recharging: { blight_breath: recharge } })
    })

    it('is blight: a hero’s blight ward takes that much off its outcome', () => {
      const warded = field(counted([HIT, ...sixes, HIT, ...sixes, HIT, ...sixes]).rng, 10)
      const [wardedEvent] = warded.step(breathe) as AbilityEvent[]
      expect(wardedEvent.outcomes.find((o) => o.unit === 'h2')).toMatchObject({ hit: true, damage: most - 10, warded: 10 })
      expect(wardedEvent.outcomes.find((o) => o.unit === 'h1')).toMatchObject({ hit: true, damage: most })
    })
  })

  describe('the Blight Horror', () => {
    const MAGE = { actionPoints: 12, magic: { maxMana: 60, skill: 100, spells: ['flame_arrow', 'acid_arrow'] as ('flame_arrow' | 'acid_arrow')[] } }
    const field = () =>
      new BattleEngine({ board: BOARD, units: [heroAt('hero', 1, 1, MAGE), { ...foeAt('horror', SOURCE_HORROR_STATS, 4, 1), hp: 100 }] }, { rng: () => HIT })

    it('regenerates 2 as its side’s turn begins', () => {
      expect(regenerated(field().step(END_TURN), 'horror')).toMatchObject([{ healed: 2, hpBefore: 100, hpAfter: 102 }])
    })

    it.each([['Seared', 'flame_arrow', 'seared'], ['Corroded', 'acid_arrow', 'corroded']] as const)('does not regenerate while %s', (_name, spell, status) => {
      const engine = field()
      engine.step({ type: 'cast', unit: 'hero', spell, target: 'horror' })
      expect(unitOf(engine, 'horror').statuses.map((s) => s.id)).toContain(status)
      expect(regenerated(engine.step(END_TURN), 'horror')).toEqual([])
    })

    it('is blightborn: a Dawn rune’s bane applies', () => {
      expect(SOURCE_HORROR_STATS.blightborn).toBe(true)
      expect(baneApplies(SOURCE_HORROR_STATS)).toBe(true)
    })

    it('claws twice: a routine of two Claws of 2d8, one attack event a strike, through armour less its piercing', () => {
      const { apCost, strikes } = ABILITIES.horror_claws
      expect(ABILITIES.horror_claws.name).toBe('Claws')
      expect(strikes!.map((s) => [s.name, s.damage!.count, s.damage!.sides])).toEqual([['Claw', 2, 8], ['Claw', 2, 8]])
      const engine = enemyTurn([heroAt('hero', 1, 1), foeAt('horror', SOURCE_HORROR_STATS, 2, 1)], counted([HIT, 0.999]).rng)
      const attacks = engine.step({ type: 'ability', unit: 'horror', ability: 'horror_claws', target: 'hero' }).filter((e): e is AttackEvent => e.type === 'attack')
      expect(attacks.map((e) => [e.attacker, e.ability, e.strike])).toEqual([['horror', 'horror_claws', 'Claw'], ['horror', 'horror_claws', 'Claw']])
      expect(attacks.map((e) => e.apCost)).toEqual([apCost, 0])
      // A hero in mail (resistance 6) takes the whole roll: the Horror pierces 21.
      expect(attacks[0].damage).toBe(strikes![0].damage!.count * strikes![0].damage!.sides)
    })
  })
})

describe('what `aggressive` has the new kinds do with their abilities', () => {
  /** The actions `aggressive` chooses for the enemy over the rest of its turn. */
  const enemyPlays = (engine: BattleEngine): Action[] => {
    const chosen: Action[] = []
    while (engine.getState().phase === 'enemy') {
      const action = POLICIES.aggressive({
        state: engine.getState(),
        legal: engine.legalActions(),
        legalFor: (unit) => engine.legalActions(unit).filter((a) => a.type !== 'end_turn'),
        rng: () => 0.5,
      })
      chosen.push(action)
      engine.step(action)
    }
    return chosen
  }
  const abilitiesIn = (actions: Action[]) => actions.flatMap((a) => (a.type === 'ability' ? [a.ability] : []))
  /** A hero to stand through every blow of a few turns. */
  const sturdy = (id: string, q: number, r: number) => heroAt(id, q, r, { maxHp: 2000 })

  it('the Ogre clubs one hero beside it, and sweeps when two stand beside it', () => {
    const alone = enemyTurn([sturdy('west', 3, 1), foeAt('ogre', OGRE_STATS, 4, 1)], () => HIT)
    // Sweep is there to be chosen: the club is picked over it, not for want of it.
    expect(alone.legalActions('ogre')).toContainEqual({ type: 'ability', unit: 'ogre', ability: 'ogre_sweep', at: hex(4, 1) })
    const one = enemyPlays(alone)
    expect(one[0]).toMatchObject({ type: 'attack', unit: 'ogre', target: 'west' })
    expect(abilitiesIn(one)).toEqual([])
    const two = enemyPlays(enemyTurn([sturdy('west', 3, 1), sturdy('east', 5, 1), foeAt('ogre', OGRE_STATS, 4, 1)], () => HIT))
    expect(two[0]).toEqual({ type: 'ability', unit: 'ogre', ability: 'ogre_sweep', at: hex(4, 1) })
  })

  it('the Hill Giant throws its Rock at a hero 4 hexes off rather than walk to it first', () => {
    const field = enemyTurn([sturdy('target', 2, 1), foeAt('giant', HILL_GIANT_STATS, 6, 1)], () => HIT)
    // It could walk towards the hero instead: the Rock is picked over a step, not for want of one.
    expect(field.legalActions('giant').some((a) => a.type === 'move')).toBe(true)
    const plays = enemyPlays(field)
    expect(plays[0]).toEqual({ type: 'ability', unit: 'giant', ability: 'giant_rock', at: hex(2, 1) })
  })

  it('the Blight Horror breathes on its first turn, then not again until Blight Breath has recharged', () => {
    const { recharge } = ABILITIES.blight_breath
    const engine = enemyTurn([sturdy('h1', 3, 1), sturdy('h2', 5, 1), foeAt('horror', SOURCE_HORROR_STATS, 4, 1)], () => HIT)
    const breathed: boolean[] = []
    for (let turn = 0; turn <= recharge + 1; turn++) {
      if (turn > 0) engine.step(END_TURN)
      const ready = engine.legalActions('horror').some((a) => a.type === 'ability' && a.ability === 'blight_breath')
      const plays = enemyPlays(engine)
      breathed.push(abilitiesIn(plays).includes('blight_breath'))
      // It breathes whenever the breath is ready, and only then; its claws fill the rest of each turn.
      expect([turn, breathed[turn]]).toEqual([turn, ready])
      expect(abilitiesIn(plays).some((id) => id === 'horror_claws')).toBe(true)
    }
    expect(breathed).toEqual([true, ...Array<boolean>(recharge - 1).fill(false), true, false].slice(0, recharge + 2))
  })
})
