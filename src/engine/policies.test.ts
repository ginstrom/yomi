import { describe, expect, it } from 'vitest'
import { GOBLIN_STATS, KOBOLD_STATS, TROLL_STATS, type CombatantStats } from '../combat/combat.ts'
import { hex, type Hex } from '../grid/hex.ts'
import { BattleEngine, areaTouches, castTouches, type Action } from './battleEngine.ts'
import { ABILITIES } from '../combat/abilities.ts'
import type { SpellId } from '../combat/spells.ts'
import { POLICIES, isPolicyName, type PolicyContext } from './policies.ts'

function engineWith(playerAt: Hex, enemyAt: Hex): BattleEngine {
  return new BattleEngine({
    board: { cols: 8, rows: 3 },
    units: [
      { id: 'p1', side: 'player', stats: GOBLIN_STATS, position: playerAt },
      { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: enemyAt },
    ],
  })
}

function context(legal: readonly Action[], rngValue = 0): PolicyContext {
  const engine = engineWith(hex(0, 1), hex(1, 1))
  return { state: engine.getState(), legal, rng: () => rngValue }
}

const choose = (engine: BattleEngine) =>
  POLICIES.aggressive({ state: engine.getState(), legal: engine.legalActions(), rng: () => 0 })

const unitAt = (engine: BattleEngine, id: string) => engine.getState().units.find((u) => u.id === id)!

/** The ids of the units an area ability action would touch. */
function castTouchesArea(engine: BattleEngine, action: Action): string[] {
  if (action.type !== 'ability' || !('at' in action)) throw new Error('expected an area ability')
  const { units } = engine.getState()
  const self = units.find((u) => u.id === action.unit)!
  return areaTouches(units, self, ABILITIES[action.ability].area!, action.at, true).map((u) => u.id)
}

const ATTACK_E1: Action = { type: 'attack', unit: 'p1', target: 'e1' }
const END_TURN: Action = { type: 'end_turn' }

describe('policies', () => {
  it('aggressive stops an archer as soon as its target is in range, then shoots', () => {
    const archer = { ...GOBLIN_STATS, attackApCost: 4, attackRange: 3 }
    const engine = new BattleEngine({
      board: { cols: 8, rows: 3 },
      units: [
        { id: 'p1', side: 'player', stats: archer, position: hex(0, 1) },
        { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(5, 1) },
      ],
    })
    expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(2, 1) })
    engine.step(choose(engine))
    expect(choose(engine)).toEqual(ATTACK_E1)
    engine.step(ATTACK_E1)
    // 2 AP left and the foe in range: it holds its ground rather than walking up.
    expect(choose(engine)).toEqual(END_TURN)
  })

  it('aggressive thrusts with a spear from two hexes rather than walking up', () => {
    const spearman = { ...GOBLIN_STATS, attackRange: 2, reach: true as const }
    const engine = new BattleEngine({
      board: { cols: 8, rows: 3 },
      units: [
        { id: 'p1', side: 'player', stats: spearman, position: hex(0, 1) },
        { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 1) },
      ],
    })
    expect(choose(engine)).toEqual(ATTACK_E1)
  })

  describe('aggressive with a caster', () => {
    // A wand that reaches 4 hexes for 5 AP, and Magic Arrow, which reaches 5 for 4 AP and 3 mana.
    const mage = (maxMana: number) => ({
      ...GOBLIN_STATS,
      attackApCost: 5,
      attackRange: 4,
      magic: { maxMana, skill: 70, spells: ['magic_arrow' as const] },
    })
    const facing = (maxMana: number, ...foes: Array<[id: string, at: Hex, hp?: number]>) =>
      new BattleEngine({
        board: { cols: 8, rows: 3 },
        units: [
          { id: 'p1', side: 'player', stats: mage(maxMana), position: hex(0, 1) },
          ...foes.map(([id, position, hp]) => ({ id, side: 'enemy' as const, stats: GOBLIN_STATS, position, hp })),
        ],
      })

    it('casts on the weakest foe in range before it would strike with its weapon', () => {
      const engine = facing(18, ['e1', hex(3, 1)], ['e2', hex(4, 1), 5], ['e3', hex(4, 0), 5])
      expect(engine.legalActions()).toContainEqual({ type: 'attack', unit: 'p1', target: 'e1' })
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'magic_arrow', target: 'e2' })
    })

    it('stops at its spell’s range while it has the mana, and holds there', () => {
      const engine = facing(6, ['e1', hex(7, 1)])
      expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(2, 1) })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'magic_arrow', target: 'e1' })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual(END_TURN)
    })

    it('closes to its wand’s range once its mana is spent', () => {
      const engine = facing(2, ['e1', hex(7, 1)])
      expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(3, 1) })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual(ATTACK_E1)
    })
  })

  describe('aggressive with spells of every kind (A14)', () => {
    const caster = (spells: SpellId[], maxMana = 40) => ({
      ...GOBLIN_STATS,
      actionPoints: 12,
      magic: { maxMana, skill: 70, spells },
    })
    type Placing = { id: string; side: 'player' | 'enemy'; at: Hex; hp?: number; stats?: CombatantStats }
    const field = (spells: SpellId[], others: Placing[], maxMana?: number, rng?: () => number) =>
      new BattleEngine(
        {
          board: { cols: 9, rows: 4 },
          units: [
            { id: 'p1', side: 'player', stats: caster(spells, maxMana), position: hex(0, 1) },
            ...others.map(({ id, side, at, hp, stats }) => ({ id, side, stats: stats ?? GOBLIN_STATS, position: at, hp })),
          ],
        },
        rng ? { rng } : {},
      )

    it('heals an ally at half its hit points or less before it strikes', () => {
      const engine = field(['magic_arrow', 'heal'], [
        { id: 'p2', side: 'player', at: hex(1, 1), hp: 6 },
        { id: 'e1', side: 'enemy', at: hex(4, 1), hp: 3 },
      ])
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'heal', target: 'p2' })
      // Above half, it strikes instead.
      const hale = field(['magic_arrow', 'heal'], [
        { id: 'p2', side: 'player', at: hex(1, 1), hp: 7 },
        { id: 'e1', side: 'enemy', at: hex(4, 1) },
      ])
      expect(choose(hale)).toEqual({ type: 'cast', unit: 'p1', spell: 'magic_arrow', target: 'e1' })
    })

    it('throws a hostile area spell only where it touches two foes or more and no ally', () => {
      const foes: Placing[] = [
        { id: 'e1', side: 'enemy', at: hex(4, 1) },
        { id: 'e2', side: 'enemy', at: hex(5, 1) },
      ]
      const engine = field(['fireball'], foes)
      const cast = choose(engine)
      expect(cast).toMatchObject({ type: 'cast', spell: 'fireball' })
      const touched = castTouches(engine.getState().units, unitAt(engine, 'p1'), 'fireball', { at: (cast as { at: Hex }).at })
      expect(touched.map((u) => u.id)).toEqual(['e1', 'e2'])
      // An ally beside them leaves no centre that touches both foes and not it.
      const crowded = field(['fireball'], [...foes, { id: 'p2', side: 'player', at: hex(4, 2) }, { id: 'p3', side: 'player', at: hex(5, 0) }])
      expect(choose(crowded).type).not.toBe('cast')
    })

    it('keeps the mana for its cheapest heal rather than spend it on a strike', () => {
      const shaman = field(['magic_arrow', 'heal'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }], 5)
      expect(choose(shaman)).not.toMatchObject({ type: 'cast' })
      const flush = field(['magic_arrow', 'heal'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }], 6)
      expect(choose(flush)).toMatchObject({ type: 'cast', spell: 'magic_arrow' })
    })

    it('guards itself with Mirror Image, then Shield, when a foe stands beside it', () => {
      const engine = field(['shield', 'mirror_image', 'magic_arrow'], [{ id: 'e1', side: 'enemy', at: hex(1, 1) }])
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'mirror_image', target: 'p1' })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'shield', target: 'p1' })
      engine.step(choose(engine))
      expect(choose(engine)).toMatchObject({ spell: 'magic_arrow' })
    })

    it('blesses two allies or more not yet blessed, and puts the healthiest foe to sleep while two stand', () => {
      const engine = field(['bless', 'sleep'], [
        { id: 'p2', side: 'player', at: hex(1, 1) },
        { id: 'e1', side: 'enemy', at: hex(4, 1), hp: 5 },
        { id: 'e2', side: 'enemy', at: hex(4, 2) },
      ])
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'bless', at: hex(0, 1) })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'sleep', target: 'e2' })
    })

    describe('with wards and monster spells (stage 2)', () => {
      const warded = (wards: CombatantStats['wards']): CombatantStats => ({ ...GOBLIN_STATS, wards })

      it('scores a strike after the target’s ward: of two equal foes, the one without', () => {
        const engine = field(['flame_arrow'], [
          { id: 'e1', side: 'enemy', at: hex(4, 1), stats: warded({ fire: 5 }) },
          { id: 'e2', side: 'enemy', at: hex(4, 2) },
        ])
        expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'flame_arrow', target: 'e2' })
        // Unwarded, the first of two equal foes, as ever.
        const even = field(['flame_arrow'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }, { id: 'e2', side: 'enemy', at: hex(4, 2) }])
        expect(choose(even)).toEqual({ type: 'cast', unit: 'p1', spell: 'flame_arrow', target: 'e1' })
      })

      it('casts a weaker spell where a ward would stop its hardest-hitting one', () => {
        const engine = field(['magic_arrow', 'flame_arrow'], [{ id: 'e1', side: 'enemy', at: hex(4, 1), stats: warded({ fire: 99 }) }])
        expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'magic_arrow', target: 'e1' })
        const bare = field(['magic_arrow', 'flame_arrow'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }])
        expect(choose(bare)).toEqual({ type: 'cast', unit: 'p1', spell: 'flame_arrow', target: 'e1' })
      })

      it('counts no foe a hostile area spell’s element is fully warded against towards its two foes; a partly warded one still counts', () => {
        // Fireball's 3d6 averages 10.5: a fire ward of 99 stops it all, a ward of 5 leaves 5.5.
        const shut = field(['fireball'], [{ id: 'e1', side: 'enemy', at: hex(4, 1), stats: warded({ fire: 99 }) }, { id: 'e2', side: 'enemy', at: hex(5, 1) }])
        expect(choose(shut)).not.toMatchObject({ type: 'cast' })
        const partly = field(['fireball'], [{ id: 'e1', side: 'enemy', at: hex(4, 1), stats: warded({ fire: 5 }) }, { id: 'e2', side: 'enemy', at: hex(5, 1) }])
        expect(choose(partly)).toMatchObject({ type: 'cast', spell: 'fireball' })
      })

      it('strikes with Drain Life as with any damaging spell of one foe', () => {
        const engine = field(['drain_life'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }])
        expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'drain_life', target: 'e1' })
      })

      it('throws Lightning Bolt where its line touches two foes and no ally', () => {
        const engine = field(['lightning_bolt'], [{ id: 'e1', side: 'enemy', at: hex(3, 1) }, { id: 'e2', side: 'enemy', at: hex(5, 1) }])
        const cast = choose(engine)
        expect(cast).toMatchObject({ type: 'cast', spell: 'lightning_bolt' })
        const touched = castTouches(engine.getState().units, unitAt(engine, 'p1'), 'lightning_bolt', { at: (cast as { at: Hex }).at })
        expect(touched.map((u) => u.id)).toEqual(['e1', 'e2'])
      })

      it('casts Web on one foe not yet webbed, never on an ally, and not again on a webbed foe', () => {
        // Every roll a 1: the web always lands.
        const engine = field(['web'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }], undefined, () => 0.999)
        const cast = choose(engine)
        expect(cast).toMatchObject({ type: 'cast', spell: 'web' })
        engine.step(cast)
        expect(unitAt(engine, 'e1').statuses.map((s) => s.id)).toEqual(['webbed'])
        expect(choose(engine)).not.toMatchObject({ type: 'cast' })
        // With an ally beside the foe on every side but the far one, no centre touches the foe alone.
        const crowded = field(['web'], [
          { id: 'e1', side: 'enemy', at: hex(4, 1) },
          { id: 'p2', side: 'player', at: hex(3, 1) },
          { id: 'p3', side: 'player', at: hex(3, 2) },
          { id: 'p4', side: 'player', at: hex(4, 0) },
          { id: 'p5', side: 'player', at: hex(5, 0) },
          { id: 'p6', side: 'player', at: hex(4, 2) },
          { id: 'p7', side: 'player', at: hex(5, 1) },
        ])
        expect(choose(crowded)).not.toMatchObject({ type: 'cast', spell: 'web' })
      })

      it('curses the healthiest foe not yet cursed while two stand', () => {
        const engine = field(['curse'], [
          { id: 'e1', side: 'enemy', at: hex(4, 1), hp: 5 },
          { id: 'e2', side: 'enemy', at: hex(4, 2) },
        ], undefined, () => 0.999)
        expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'curse', target: 'e2' })
        engine.step(choose(engine))
        expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'curse', target: 'e1' })
        const alone = field(['curse'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }])
        expect(choose(alone)).not.toMatchObject({ type: 'cast' })
      })

      it('guards itself with Dark Shield when a foe stands beside it and it is not shielded', () => {
        const engine = field(['magic_arrow', 'dark_shield'], [{ id: 'e1', side: 'enemy', at: hex(1, 1) }])
        expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'dark_shield', target: 'p1' })
        engine.step(choose(engine))
        expect(choose(engine)).toMatchObject({ spell: 'magic_arrow' })
        const far = field(['magic_arrow', 'dark_shield'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }])
        expect(choose(far)).toMatchObject({ spell: 'magic_arrow' })
        // Shield first, and Dark Shield not on top of it.
        const both = field(['shield', 'magic_arrow', 'dark_shield'], [{ id: 'e1', side: 'enemy', at: hex(1, 1) }])
        expect(choose(both)).toMatchObject({ spell: 'shield' })
        both.step(choose(both))
        expect(choose(both)).toMatchObject({ spell: 'magic_arrow' })
      })
    })

    it('never casts Protect or Haste', () => {
      const engine = field(['protect', 'haste'], [{ id: 'p2', side: 'player', at: hex(1, 1) }, { id: 'e1', side: 'enemy', at: hex(7, 1) }])
      expect(choose(engine).type).toBe('move')
    })
  })

  it('aggressive attacks whenever attacking is legal, and otherwise ends the turn', () => {
    expect(POLICIES.aggressive(context([END_TURN, ATTACK_E1]))).toEqual(ATTACK_E1)
    expect(POLICIES.aggressive(context([END_TURN]))).toEqual(END_TURN)
  })

  it('aggressive attacks the foe it flanks most', () => {
    // p1 at (1,1) touches both e2 (2,0) and e1 (2,1); p3 at (3,1) touches e1
    // alone, so e1 is flanked though e2 comes first in the legal actions.
    const engine = new BattleEngine({
      board: { cols: 8, rows: 3 },
      units: [
        { id: 'p1', side: 'player', stats: GOBLIN_STATS, position: hex(1, 1) },
        { id: 'p3', side: 'player', stats: GOBLIN_STATS, position: hex(3, 1) },
        { id: 'e2', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 0) },
        { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 1) },
      ],
    })
    expect(engine.legalActions('p1').filter((a) => a.type === 'attack')).toEqual([
      { type: 'attack', unit: 'p1', target: 'e2' },
      ATTACK_E1,
    ])
    expect(choose(engine)).toEqual(ATTACK_E1)
  })

  it('aggressive attacks a foe from behind before one it faces, unless the foe can still turn', () => {
    // Both touch p1 at (1,1); e1 at (2,1) faces west towards it, e2 at (2,0) faces away.
    const engine = new BattleEngine({
      board: { cols: 8, rows: 3 },
      units: [
        { id: 'p1', side: 'player', stats: GOBLIN_STATS, position: hex(1, 1) },
        { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 1) },
        { id: 'e2', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 0), facing: 1 },
      ],
    })
    expect(choose(engine)).toEqual({ type: 'attack', unit: 'p1', target: 'e1' }) // e2 would turn: no better than e1
    const state = engine.getState()
    state.units.find((u) => u.id === 'e2')!.turnReady = false
    expect(POLICIES.aggressive({ state, legal: engine.legalActions(), rng: () => 0 })).toEqual({
      type: 'attack',
      unit: 'p1',
      target: 'e2',
    })
  })

  it('aggressive closes the distance, ends its turn when spent, and attacks next turn', () => {
    const engine = engineWith(hex(0, 1), hex(6, 1))
    // Speed 4, 3 AP: reaching the foe takes 2 AP, leaving too few to strike.
    expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(5, 1) })
    engine.step(choose(engine))
    expect(choose(engine)).toEqual(END_TURN)
    engine.step(END_TURN)
    expect(choose(engine)).toEqual({ type: 'attack', unit: 'e1', target: 'p1' })
  })

  it('aggressive prefers a hex it can still strike from', () => {
    const engine = engineWith(hex(0, 1), hex(4, 1))
    expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(3, 1) }) // 3 AP, 5 left
    engine.step(choose(engine))
    expect(choose(engine)).toEqual(ATTACK_E1)
  })

  describe('aggressive with a strike routine', () => {
    const versus = (stats: CombatantStats, trollAt: Hex, foe: CombatantStats = GOBLIN_STATS) =>
      new BattleEngine({
        board: { cols: 8, rows: 3 },
        units: [
          { id: 'p1', side: 'player', stats, position: trollAt },
          { id: 'e1', side: 'enemy', stats: foe, position: hex(2, 1) },
        ],
      })
    const routine = (ability: 'troll_claws' | 'spider_bite'): Action => ({ type: 'ability', unit: 'p1', ability, target: 'e1' })

    it('uses the Troll’s claws, two strikes, rather than one claw standing still', () => {
      const engine = versus(TROLL_STATS, hex(1, 1))
      expect(engine.legalActions('p1')).toContainEqual(ATTACK_E1)
      expect(choose(engine)).toEqual(routine('troll_claws'))
    })

    it('claws once with its weapon when it has moved and the routine is beyond its AP', () => {
      const engine = versus(TROLL_STATS, hex(0, 1))
      expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(1, 1) })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual(ATTACK_E1)
      engine.step(choose(engine))
      expect(choose(engine)).toEqual(END_TURN)
    })

    it('takes a routine on a tie with its weapon, and the weapon when it does more harm', () => {
      // Two bites of 1d6+2 against one blow of 2d6+4 or 2d6+5, at a foe nothing armours.
      const biter = (bonus: number) => ({ ...GOBLIN_STATS, damage: { count: 2, sides: 6, bonus }, abilities: ['spider_bite' as const] })
      expect(choose(versus(biter(4), hex(1, 1), KOBOLD_STATS))).toEqual(routine('spider_bite'))
      expect(choose(versus(biter(5), hex(1, 1), KOBOLD_STATS))).toEqual(ATTACK_E1)
    })

    it('counts the unit’s ability damage bonus in a routine’s harm', () => {
      const biter = { ...GOBLIN_STATS, damage: { count: 2, sides: 6, bonus: 5 }, abilities: ['spider_bite' as const], abilityDamageBonus: 1 }
      expect(choose(versus(biter, hex(1, 1), KOBOLD_STATS))).toEqual(routine('spider_bite'))
    })

    it('strikes with its weapon while its routine recharges', () => {
      const biter = { ...GOBLIN_STATS, attackApCost: 4, abilities: ['spider_bite' as const] }
      const engine = versus(biter, hex(1, 1), { ...GOBLIN_STATS, maxHp: 60 })
      expect(choose(engine)).toEqual(routine('spider_bite'))
      engine.step(choose(engine))
      expect(engine.legalActions('p1').some((a) => a.type === 'ability')).toBe(false)
      expect(choose(engine)).toEqual(ATTACK_E1)
    })
  })

  describe('aggressive with an area ability', () => {
    // At (3,1), a cone of fire west of it covers (2,1), then (1,1), (1,2) and (2,0).
    const SPITTER: CombatantStats = { ...GOBLIN_STATS, name: 'Salamander', toHit: 80, attackApCost: 4, abilities: ['fire_spit'] }
    const BIG_GOBLIN: CombatantStats = { ...GOBLIN_STATS, maxHp: 60 }
    type Placing = [id: string, side: 'player' | 'enemy', at: Hex, stats?: CombatantStats]
    const field = (self: CombatantStats, selfAt: Hex, ...others: Placing[]) =>
      new BattleEngine({
        board: { cols: 8, rows: 3 },
        units: [
          { id: 'p1', side: 'player', stats: self, position: selfAt },
          ...others.map(([id, side, position, stats = BIG_GOBLIN]) => ({ id, side, stats, position })),
        ],
      })
    const isSpit = (action: Action) => action.type === 'ability' && action.ability === 'fire_spit'

    it('breathes where it touches two foes and no ally, but not where it would touch two allies and one foe', () => {
      const foes = field(SPITTER, hex(3, 1), ['e1', 'enemy', hex(2, 1)], ['e2', 'enemy', hex(2, 0)])
      const chosen = choose(foes)
      expect(isSpit(chosen)).toBe(true)
      expect(castTouchesArea(foes, chosen).sort()).toEqual(['e1', 'e2'])

      const crowded = field(SPITTER, hex(3, 1), ['e1', 'enemy', hex(2, 1)], ['p2', 'player', hex(1, 1)], ['p3', 'player', hex(1, 2)])
      expect(crowded.legalActions('p1').some(isSpit)).toBe(true)
      expect(choose(crowded)).toEqual(ATTACK_E1)
    })

    it('takes an area over a strike only when its net harm is greater', () => {
      // A 6d6+10 blow, some 19.5 a turn on a goblin, against fire's 13.2.
      const heavy = { ...SPITTER, damage: { count: 6, sides: 6, bonus: 10 } }
      expect(choose(field(heavy, hex(3, 1), ['e1', 'enemy', hex(2, 1)]))).toEqual(ATTACK_E1)
      expect(isSpit(choose(field(SPITTER, hex(3, 1), ['e1', 'enemy', hex(2, 1)])))).toBe(true)
    })

    it('scores a fire-warded foe lower', () => {
      // A 4d6+4 blow, 11.05 through the goblin's hide at 65%: under the cone's 13.2, over its 10.2 against a ward of 3.
      const armed = { ...SPITTER, damage: { count: 4, sides: 6, bonus: 4 } }
      expect(isSpit(choose(field(armed, hex(3, 1), ['e1', 'enemy', hex(2, 1)])))).toBe(true)
      const warded = { ...BIG_GOBLIN, wards: { fire: 3 } }
      expect(choose(field(armed, hex(3, 1), ['e1', 'enemy', hex(2, 1), warded]))).toEqual(ATTACK_E1)
      expect(choose(field(SPITTER, hex(3, 1), ['e1', 'enemy', hex(2, 1), { ...BIG_GOBLIN, wards: { fire: 99 } }]))).toEqual(ATTACK_E1)
    })

    it('strikes while its area recharges', () => {
      const engine = field(SPITTER, hex(3, 1), ['e1', 'enemy', hex(2, 1)])
      engine.step(choose(engine))
      expect(engine.getState().units[0].recharging).toEqual({ fire_spit: 2 })
      expect(choose(engine)).toEqual(ATTACK_E1)
    })

    describe('a status-only area (Web)', () => {
      const SPINNER: CombatantStats = { ...GOBLIN_STATS, name: 'Spider', abilities: ['spider_web'] }
      const isWeb = (action: Action) => action.type === 'ability' && action.ability === 'spider_web'

      it('webs a foe from range when no strike is in reach', () => {
        const engine = field(SPINNER, hex(0, 1), ['e1', 'enemy', hex(4, 1)])
        const chosen = choose(engine)
        expect(isWeb(chosen)).toBe(true)
        expect(castTouchesArea(engine, chosen)).toEqual(['e1'])
      })

      it('strikes instead when a foe is in reach', () => {
        expect(choose(field(SPINNER, hex(0, 1), ['e1', 'enemy', hex(1, 1)]))).toEqual(ATTACK_E1)
      })

      it('never webs where it would touch an ally, nor a foe already webbed', () => {
        const near = field(SPINNER, hex(0, 1), ['e1', 'enemy', hex(4, 1)], ['p2', 'player', hex(3, 1)])
        expect(near.legalActions('p1').some(isWeb)).toBe(true)
        expect(choose(near).type).toBe('move')

        const seeded = new BattleEngine(
          { board: { cols: 8, rows: 3 }, units: [{ id: 'p1', side: 'player', stats: SPINNER, position: hex(0, 1) }, { id: 'e1', side: 'enemy', stats: BIG_GOBLIN, position: hex(4, 1) }] },
          { seed: 1 },
        )
        const snapshot = seeded.snapshot()
        snapshot.units[1].statuses = [{ id: 'webbed', turnsLeft: 2 }]
        const webbed = BattleEngine.restore(snapshot)
        expect(webbed.legalActions('p1').some(isWeb)).toBe(true)
        expect(choose(webbed).type).toBe('move')
      })
    })
  })

  it('random picks among legal actions using the supplied rng', () => {
    const legal: Action[] = [ATTACK_E1, END_TURN]
    expect(POLICIES.random(context(legal, 0))).toEqual(ATTACK_E1)
    expect(POLICIES.random(context(legal, 0.99))).toEqual(END_TURN)
  })

  it('recognises only registered policy names', () => {
    expect(isPolicyName('aggressive')).toBe(true)
    expect(isPolicyName('toString')).toBe(false)
  })
})
