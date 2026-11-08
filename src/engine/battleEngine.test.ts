import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ABILITIES, type Ability, type AbilityId } from '../combat/abilities.ts'
import { GOBLIN_STATS, TROLL_STATS, type CombatantStats, type OnHit } from '../combat/combat.ts'
import { mulberry32 } from '../combat/rng.ts'
import { SPELL_IDS, type SpellId } from '../combat/spells.ts'
import { HEX_DIRECTIONS, areaOf, hex, hexAdd, hexDistance, hexKey, type Hex } from '../grid/hex.ts'
import {
  ARC_BONUS,
  BattleEngine,
  EQUIP_AP_COST,
  FLANK_BONUS_PER_ALLY,
  LOG_SCHEMA_VERSION,
  areaTouches,
  arcStruck,
  attackArc,
  effectiveStats,
  flankersOf,
  formatEvent,
  isMelee,
  type AbilityEvent,
  type Action,
  type AttackEvent,
  type BattleEvent,
  type BattleStartEvent,
  type GearChange,
  type MoveEvent,
  type UnitSetup,
} from './battleEngine.ts'
import { POLICIES } from './policies.ts'

function sequence(values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

const WARRIOR_STATS: CombatantStats = {
  name: 'Warrior',
  maxHp: 20,
  ac: 25,
  toHit: 75,
  critChance: 5,
  damage: { count: 1, sides: 8, bonus: 2 },
  attackApCost: 5,
  attackRange: 1,
  actionPoints: 8,
}

const BOARD = { cols: 6, rows: 3 }
const setup = (units: UnitSetup[]) => ({ board: BOARD, units })

// The warrior at (1,1) is flanked by goblin to the east and goblin2 to the
// north-east; the cleric stands behind it to the west.
const WARRIOR: UnitSetup = { id: 'warrior', side: 'player', stats: WARRIOR_STATS, position: hex(1, 1) }
const GOBLIN: UnitSetup = { id: 'goblin', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 1) }
const GOBLIN2: UnitSetup = { id: 'goblin2', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 0) }
const CLERIC: UnitSetup = { id: 'cleric', side: 'player', stats: WARRIOR_STATS, position: hex(0, 1) }
const DUEL = setup([WARRIOR, GOBLIN])

const NAMES = { warrior: 'Warrior', goblin: 'Goblin', goblin2: 'Goblin Archer', cleric: 'Cleric' }
const ATTACK_GOBLIN: Action = { type: 'attack', unit: 'warrior', target: 'goblin' }
const ATTACK_WARRIOR: Action = { type: 'attack', unit: 'goblin', target: 'warrior' }
const END_TURN: Action = { type: 'end_turn' }
/** A roll of 100: a fumble, so no damage. */
const FUMBLE = 0
/** A roll of 1 then max damage dice: a crit that fells a Goblin outright. */
const KILL = [0.99, 0.99]
/** A roll of 70: over the Warrior's 60% against a Goblin alone, but within its 70% with one flanker. */
const ROLL_7 = 0.3
/** A roll of 55: over a Goblin's 45% against the Warrior from the front, but within its 55% from behind. */
const ROLL_10 = 0.45

/** Facings, as indices into HEX_DIRECTIONS. */
const EAST = 0
const NORTH_WEST = 2
const WEST = 3
const SOUTH_WEST = 4
const SOUTH_EAST = 5

const unitOf = (engine: BattleEngine, id: string) => engine.getState().units.find((u) => u.id === id)!
const nonMoves = (engine: BattleEngine, unit?: string) => engine.legalActions(unit).filter((a) => a.type !== 'move')
const move = (unit: string, to: Hex): Action => ({ type: 'move', unit, to })

describe('BattleEngine', () => {
  it('starts on the player side with full AP and logs a self-describing battle_start event', () => {
    const engine = new BattleEngine(DUEL, { seed: 42, meta: { source: 'test' } })
    expect(engine.getState()).toMatchObject({ phase: 'player', round: 1, winner: null })
    expect(unitOf(engine, 'warrior')).toMatchObject({ hp: WARRIOR_STATS.maxHp, ap: WARRIOR_STATS.actionPoints })
    // The enemy waits with its free attacks ready.
    expect(unitOf(engine, 'goblin')).toMatchObject({ hp: GOBLIN_STATS.maxHp, ap: 0, reactionReady: true })

    expect(engine.getLog()).toHaveLength(1)
    const start = engine.getLog()[0] as BattleStartEvent
    expect(start).toMatchObject({
      type: 'battle_start',
      schemaVersion: LOG_SCHEMA_VERSION,
      seed: 42,
      meta: { source: 'test' },
      board: BOARD,
      units: [
        { ...WARRIOR_STATS, id: 'warrior', side: 'player', hp: WARRIOR_STATS.maxHp, position: hex(1, 1), ap: 8 },
        { ...GOBLIN_STATS, id: 'goblin', side: 'enemy', hp: GOBLIN_STATS.maxHp, position: hex(2, 1), ap: 0 },
      ],
    })
  })

  it('always records a seed unless the caller injects its own RNG', () => {
    const seeded = new BattleEngine(DUEL).getLog()[0] as BattleStartEvent
    expect(Number.isInteger(seeded.seed)).toBe(true)
    const injected = new BattleEngine(DUEL, { rng: Math.random }).getLog()[0] as BattleStartEvent
    expect(injected.seed).toBeNull()
  })

  it('rejects bad rosters: duplicate ids, a missing side, shared or off-board hexes, unknown facings', () => {
    expect(() => new BattleEngine(setup([WARRIOR, WARRIOR, GOBLIN]))).toThrow(/unique/)
    expect(() => new BattleEngine(setup([WARRIOR]))).toThrow(/No enemy units/)
    expect(() => new BattleEngine(setup([WARRIOR, { ...GOBLIN, position: WARRIOR.position }]))).toThrow(
      /different hexes/,
    )
    expect(() => new BattleEngine(setup([WARRIOR, { ...GOBLIN, position: hex(-5, 0) }]))).toThrow(/off the board/)
    for (const facing of [6, -1, 1.5]) {
      expect(() => new BattleEngine(setup([WARRIOR, { ...GOBLIN, facing }]))).toThrow(/unknown direction/)
    }
  })

  it('can start a unit wounded, capped at maxHp', () => {
    const engine = new BattleEngine(setup([{ ...WARRIOR, hp: 7 }, { ...GOBLIN, hp: 999 }]))
    expect(unitOf(engine, 'warrior').hp).toBe(7)
    expect(unitOf(engine, 'goblin').hp).toBe(GOBLIN_STATS.maxHp)
  })

  it('offers each unit on the side an attack on each adjacent standing foe, then one end_turn', () => {
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, CLERIC, GOBLIN2]))
    expect(nonMoves(engine)).toEqual([ATTACK_GOBLIN, { type: 'attack', unit: 'warrior', target: 'goblin2' }, END_TURN])
    // The cleric touches no foe, so it may only move.
    expect(nonMoves(engine, 'cleric')).toEqual([END_TURN])
    expect(engine.legalActions('cleric').some((a) => a.type === 'move')).toBe(true)
  })

  it('rejects attacks on allies, unknown units, fallen foes and foes out of reach', () => {
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, CLERIC]))
    expect(() => engine.step({ type: 'attack', unit: 'warrior', target: 'cleric' })).toThrow(/cannot attack/)
    expect(() => engine.step({ type: 'attack', unit: 'warrior', target: 'nobody' })).toThrow(/cannot attack/)

    const withFallen = new BattleEngine(setup([WARRIOR, GOBLIN, { ...GOBLIN2, hp: 0 }]))
    expect(nonMoves(withFallen)).toEqual([ATTACK_GOBLIN, END_TURN])
    expect(() => withFallen.step({ type: 'attack', unit: 'warrior', target: 'goblin2' })).toThrow(/cannot attack/)

    const apart = new BattleEngine(setup([WARRIOR, { ...GOBLIN, position: hex(4, 1) }]))
    expect(nonMoves(apart)).toEqual([END_TURN])
    expect(() => apart.step(ATTACK_GOBLIN)).toThrow(/cannot attack/)
  })

  it('only lets the side whose turn it is act', () => {
    const engine = new BattleEngine(DUEL)
    expect(() => engine.step(ATTACK_WARRIOR)).toThrow(/goblin cannot act/)
    expect(() => engine.step({ type: 'attack', unit: 'nobody', target: 'goblin' })).toThrow(/cannot act/)
  })

  it('charges AP for an attack without ending the turn, and refuses one it cannot afford', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    expect(engine.step(ATTACK_GOBLIN)).toEqual([
      expect.objectContaining({ type: 'attack', attacker: 'warrior', defender: 'goblin', opportunity: false }),
    ])
    expect(engine.getState().phase).toBe('player')
    expect(unitOf(engine, 'warrior').ap).toBe(WARRIOR_STATS.actionPoints - WARRIOR_STATS.attackApCost)
    expect(nonMoves(engine)).toEqual([END_TURN])
    expect(() => engine.step(ATTACK_GOBLIN)).toThrow(/too few action points/)
  })

  it('charges each unit its own attack cost, so a lighter weapon strikes more often', () => {
    const quick = { ...WARRIOR, stats: { ...WARRIOR_STATS, attackApCost: 3 } }
    const engine = new BattleEngine(setup([quick, GOBLIN]), { rng: sequence([FUMBLE]) })
    engine.step(ATTACK_GOBLIN)
    engine.step(ATTACK_GOBLIN)
    expect(unitOf(engine, 'warrior').ap).toBe(2)
    expect(nonMoves(engine)).toEqual([END_TURN])
  })

  it('refuses any action from a unit with no AP left', () => {
    const warrior = { ...WARRIOR, stats: { ...WARRIOR_STATS, actionPoints: 7 } }
    const engine = new BattleEngine(setup([warrior, { ...GOBLIN, position: hex(4, 1) }]), { rng: sequence([FUMBLE]) })
    engine.step(move('warrior', hex(3, 1))) // 2 hexes: 2 AP
    engine.step(ATTACK_GOBLIN) // 5 AP
    expect(unitOf(engine, 'warrior').ap).toBe(0)
    expect(engine.legalActions()).toEqual([END_TURN])
    expect(() => engine.step(move('warrior', hex(2, 1)))).toThrow(/cannot act/)
  })

  it('ends the side’s turn on end_turn, refilling the other side’s AP and advancing the round after the enemy', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    engine.step(ATTACK_GOBLIN)
    expect(engine.step(END_TURN)).toEqual([expect.objectContaining({ type: 'end_turn', side: 'player' })])
    expect(engine.getState()).toMatchObject({ phase: 'enemy', round: 1 })
    expect(unitOf(engine, 'goblin').ap).toBe(GOBLIN_STATS.actionPoints)

    expect(engine.step(END_TURN)).toEqual([expect.objectContaining({ type: 'end_turn', side: 'enemy' })])
    expect(engine.getState()).toMatchObject({ phase: 'player', round: 2 })
    expect(unitOf(engine, 'warrior').ap).toBe(WARRIOR_STATS.actionPoints)
  })

  it('lets the side’s units act in any order, interleaved', () => {
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, CLERIC, GOBLIN2]), { rng: sequence([FUMBLE]) })
    engine.step(move('cleric', hex(1, 2)))
    engine.step(ATTACK_GOBLIN)
    engine.step(move('cleric', hex(0, 2)))
    expect(unitOf(engine, 'cleric')).toMatchObject({ position: hex(0, 2), ap: 5 })
    expect(engine.getState().phase).toBe('player')
  })

  it('leaves fallen units out and keeps fighting while a side still has someone standing', () => {
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, GOBLIN2]), { rng: sequence(KILL) })
    const events = engine.step(ATTACK_GOBLIN)
    expect(events.map((e) => e.type)).toEqual(['attack', 'unit_down'])
    expect(engine.getState()).toMatchObject({ phase: 'player', winner: null })
    engine.step(END_TURN)
    expect(unitOf(engine, 'goblin').ap).toBe(0)
    expect(nonMoves(engine)).toEqual([{ type: 'attack', unit: 'goblin2', target: 'warrior' }, END_TURN])
    expect(engine.legalActions().every((a) => a.type === 'end_turn' || a.unit === 'goblin2')).toBe(true)
  })

  it('ends the battle when the last unit on a side falls', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence(KILL) })
    const events = engine.step(ATTACK_GOBLIN)
    expect(events).toEqual([
      expect.objectContaining({ type: 'attack', defenderHpAfter: 0 }),
      expect.objectContaining({ type: 'unit_down', unit: 'goblin' }),
      expect.objectContaining({ type: 'battle_end', winner: 'player', reason: 'defeat' }),
    ])

    expect(engine.getState()).toMatchObject({ phase: 'over', winner: 'player' })
    expect(unitOf(engine, 'goblin').hp).toBe(0)
    expect(engine.legalActions()).toEqual([])
    expect(() => engine.step(ATTACK_GOBLIN)).toThrow(/over/)
    expect(() => engine.step(END_TURN)).toThrow(/over/)
  })

  it('ends at once if a side enters battle with nobody standing', () => {
    const engine = new BattleEngine(setup([WARRIOR, { ...GOBLIN, hp: 0 }]))
    expect(engine.getState()).toMatchObject({ phase: 'over', winner: 'player' })
  })

  it('logs an abandoned battle with no winner, once', () => {
    const engine = new BattleEngine(DUEL)
    expect(engine.abandon()).toEqual([
      expect.objectContaining({ type: 'battle_end', winner: null, reason: 'abandoned' }),
    ])
    expect(engine.getState().phase).toBe('over')
    expect(engine.abandon()).toEqual([])
  })

  it('does not overwrite a finished battle when abandoned', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence(KILL) })
    engine.step(ATTACK_GOBLIN)
    expect(engine.abandon()).toEqual([])
    expect(engine.getState().winner).toBe('player')
  })

  it('replays identically from the logged seed and actions', () => {
    const play = (seed: number) => {
      const engine = new BattleEngine(DUEL, { seed })
      for (let i = 0; i < 12 && engine.legalActions().length; i++) {
        // Attack when possible, otherwise end the turn, whatever side is acting.
        const attack = engine.legalActions().find((a) => a.type === 'attack')
        engine.step(attack ?? END_TURN)
      }
      return engine.getLog()
    }
    expect(play(1234)).toEqual(play(1234))
    expect(play(1234)).not.toEqual(play(4321))
  })

  it('assigns a strictly increasing seq to every event in the log', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    engine.step(ATTACK_GOBLIN)
    engine.step(END_TURN)
    engine.step(ATTACK_WARRIOR)
    engine.abandon()
    const seqs = engine.getLog().map((e) => e.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
  })
})

describe('BattleEngine movement', () => {
  // Five hexes apart, so nobody starts in a zone of control.
  const apart = () =>
    new BattleEngine(setup([{ ...WARRIOR, position: hex(0, 1) }, { ...GOBLIN, position: hex(4, 1) }]))
  const moveTargets = (engine: BattleEngine) =>
    engine.legalActions().flatMap((a) => (a.type === 'move' ? [hexKey(a.to)] : []))

  it('offers moves to on-board hexes its AP can reach, around other units', () => {
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, CLERIC]))
    const targets = moveTargets(engine)
    expect(targets.length).toBeGreaterThan(0)
    for (const key of targets) {
      const [, r] = key.split(',').map(Number)
      expect(r >= 0 && r < BOARD.rows).toBe(true)
    }
    expect(targets).not.toContain(hexKey(GOBLIN.position))
    expect(targets).not.toContain(hexKey(CLERIC.position))
  })

  it('moves along a logged path, charging AP but leaving the turn open', () => {
    const engine = apart()
    const [event] = engine.step(move('warrior', hex(3, 1))) as [MoveEvent]
    expect(event).toMatchObject({
      type: 'move',
      unit: 'warrior',
      from: hex(0, 1),
      to: hex(3, 1),
      destination: hex(3, 1),
      apCost: 3,
    })
    expect(event.path).toEqual([hex(1, 1), hex(2, 1), hex(3, 1)])
    expect(unitOf(engine, 'warrior')).toMatchObject({ position: hex(3, 1), ap: 5 })
    expect(engine.getState().phase).toBe('player')
    // Now adjacent with 5 AP: it can still attack, or move again.
    expect(nonMoves(engine)).toEqual([ATTACK_GOBLIN, END_TURN])
    expect(moveTargets(engine).length).toBeGreaterThan(0)
  })

  it('charges one AP for each hex moved', () => {
    const engine = apart()
    const [event] = engine.step(move('warrior', hex(4, 0))) as [MoveEvent] // 4 hexes
    expect(event.apCost).toBe(4)
    expect(unitOf(engine, 'warrior').ap).toBe(4)
    expect(nonMoves(engine)).toEqual([END_TURN]) // adjacent, but an attack costs 5
  })

  it('rejects moves beyond its AP, off the board or onto a unit', () => {
    const tired = { ...WARRIOR, position: hex(0, 1), stats: { ...WARRIOR_STATS, actionPoints: 3 } }
    const engine = new BattleEngine(setup([tired, { ...GOBLIN, position: hex(4, 1) }]))
    expect(() => engine.step(move('warrior', hex(4, 0)))).toThrow(/cannot move/) // 4 hexes away
    engine.step(move('warrior', hex(1, 1)))
    engine.step(move('warrior', hex(2, 1)))
    engine.step(move('warrior', hex(2, 2))) // 1 AP a hex: all 3 spent
    expect(() => engine.step(move('warrior', hex(1, 2)))).toThrow(/cannot act/)
    const fresh = apart()
    expect(() => fresh.step(move('warrior', hex(0, -1)))).toThrow(/cannot move/)
    expect(() => fresh.step(move('warrior', hex(4, 1)))).toThrow(/cannot move/)
  })

  it('previews a move’s path, cost and provoked foes without changing anything', () => {
    const engine = new BattleEngine(DUEL)
    expect(engine.previewMove('warrior', hex(0, 1))).toEqual({ path: [hex(0, 1)], apCost: 1, provokes: ['goblin'] })
    expect(engine.previewMove('warrior', hex(2, 1))).toBeNull() // occupied
    expect(engine.previewMove('goblin', hex(3, 1))).toBeNull() // not its turn
    expect(unitOf(engine, 'warrior')).toMatchObject({ position: hex(1, 1), ap: 8 })
  })
})

describe('BattleEngine zones of control', () => {
  const opportunity = (events: readonly BattleEvent[]) =>
    events.filter((e): e is AttackEvent => e.type === 'attack' && e.opportunity)

  it('gives a foe a free attack when a unit steps out of its zone, splitting the move around it', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    const events = engine.step(move('warrior', hex(0, 1)))
    expect(events).toEqual([
      expect.objectContaining({ type: 'move', path: [], from: hex(1, 1), to: hex(1, 1), apCost: 1 }),
      expect.objectContaining({ type: 'attack', attacker: 'goblin', defender: 'warrior', opportunity: true }),
      expect.objectContaining({ type: 'move', path: [hex(0, 1)], from: hex(1, 1), to: hex(0, 1), apCost: 0 }),
    ])
    for (const e of events) if (e.type === 'move') expect(e.destination).toEqual(hex(0, 1))
    expect(unitOf(engine, 'goblin').reactionReady).toBe(false)
    expect(unitOf(engine, 'warrior')).toMatchObject({ position: hex(0, 1), ap: 7 })
  })

  it('does not provoke a slide to another hex beside the foe', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    expect(engine.previewMove('warrior', hex(1, 2))!.provokes).toEqual([]) // (1,2) also touches the goblin
    expect(opportunity(engine.step(move('warrior', hex(1, 2))))).toEqual([])
    expect(opportunity(engine.step(move('warrior', hex(1, 1))))).toEqual([])
    expect(unitOf(engine, 'goblin').reactionReady).toBe(true)
  })

  it('gives each foe one free attack per turn', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    expect(opportunity(engine.step(move('warrior', hex(0, 1))))).toHaveLength(1)
    engine.step(move('warrior', hex(1, 1)))
    expect(opportunity(engine.step(move('warrior', hex(0, 1))))).toHaveLength(0) // reaction spent
    engine.step(END_TURN)
    engine.step(END_TURN)
    engine.step(move('warrior', hex(1, 1)))
    expect(opportunity(engine.step(move('warrior', hex(0, 1))))).toHaveLength(1) // ready again
  })

  it('does not provoke when moving into a zone', () => {
    const engine = new BattleEngine(setup([{ ...WARRIOR, position: hex(0, 1) }, { ...GOBLIN, position: hex(4, 1) }]))
    expect(opportunity(engine.step(move('warrior', hex(3, 1))))).toEqual([])
  })

  it('stops the move where the mover falls', () => {
    const engine = new BattleEngine(setup([{ ...WARRIOR, hp: 1 }, GOBLIN, CLERIC]), { rng: sequence(KILL) })
    const events = engine.step(move('warrior', hex(0, 2)))
    expect(events.map((e) => e.type)).toEqual(['move', 'attack', 'unit_down'])
    expect(unitOf(engine, 'warrior')).toMatchObject({ hp: 0, position: hex(1, 1), ap: 0 })
    expect(engine.getState()).toMatchObject({ phase: 'player', winner: null })
  })

  it('ends the battle if the free attack fells the last mover', () => {
    const engine = new BattleEngine(setup([{ ...WARRIOR, hp: 1 }, GOBLIN]), { rng: sequence(KILL) })
    const events = engine.step(move('warrior', hex(0, 1)))
    expect(events.map((e) => e.type)).toEqual(['move', 'attack', 'unit_down', 'battle_end'])
    expect(engine.getState().winner).toBe('enemy')
  })

  it('lets the player react to enemy moves too', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    engine.step(END_TURN)
    expect(opportunity(engine.step(move('goblin', hex(3, 1))))).toEqual([
      expect.objectContaining({ attacker: 'warrior', defender: 'goblin' }),
    ])
  })

  it('routes around zones when an equally short path exists', () => {
    // From (1,1) to (2,2): via (2,1) passes beside the goblin at (3,0); via (1,2) does not.
    const engine = new BattleEngine(setup([WARRIOR, { ...GOBLIN, position: hex(3, 0) }]))
    expect(engine.previewMove('warrior', hex(2, 2))).toEqual({ path: [hex(1, 2), hex(2, 2)], apCost: 2, provokes: [] })
    expect(opportunity(engine.step(move('warrior', hex(2, 2))))).toEqual([])
  })

  it('prefers walking past one foe several times to passing two foes once each', () => {
    const mover: UnitSetup = {
      id: 'mover',
      side: 'player',
      stats: { ...WARRIOR_STATS, actionPoints: 4 },
      position: hex(0, 0),
    }
    const x: UnitSetup = { id: 'x', side: 'enemy', stats: GOBLIN_STATS, position: hex(1, 0) }
    const y: UnitSetup = { id: 'y', side: 'enemy', stats: GOBLIN_STATS, position: hex(3, 1) }
    const engine = new BattleEngine({ board: { cols: 6, rows: 5 }, units: [mover, x, y] }, { rng: sequence([FUMBLE]) })
    expect(engine.previewMove('mover', hex(3, 0))!.provokes).toHaveLength(1)
    expect(opportunity(engine.step(move('mover', hex(3, 0))))).toHaveLength(1)
  })
})

describe('BattleEngine ranged attacks', () => {
  const ARCHER_STATS: CombatantStats = { ...WARRIOR_STATS, name: 'Archer', attackRange: 3 }
  const ARCHER: UnitSetup = { id: 'archer', side: 'player', stats: ARCHER_STATS, position: hex(1, 1) }
  const SHOOT_GOBLIN: Action = { type: 'attack', unit: 'archer', target: 'goblin' }

  it('lets a unit attack any standing foe within its range, and none beyond it', () => {
    const engine = new BattleEngine(
      setup([ARCHER, { ...GOBLIN, position: hex(4, 1) }, { ...GOBLIN2, position: hex(5, 1) }]),
    )
    expect(nonMoves(engine)).toEqual([SHOOT_GOBLIN, END_TURN])
    expect(engine.previewAttack('archer', 'goblin')).not.toBeNull()
    expect(engine.previewAttack('archer', 'goblin2')).toBeNull()
    expect(() => engine.step({ type: 'attack', unit: 'archer', target: 'goblin2' })).toThrow()
  })

  it('still reaches a foe standing next to it', () => {
    const engine = new BattleEngine(setup([ARCHER, GOBLIN]))
    expect(nonMoves(engine)).toEqual([SHOOT_GOBLIN, END_TURN])
  })

  it('turns the shooter towards a distant target and spends the attack cost', () => {
    const engine = new BattleEngine(setup([{ ...ARCHER, facing: WEST }, { ...GOBLIN, position: hex(4, 0) }]), {
      rng: sequence([FUMBLE]),
    })
    const [attack] = engine.step(SHOOT_GOBLIN) as [AttackEvent]
    expect(attack.attackerFacing).toBe(EAST)
    expect(unitOf(engine, 'archer').facing).toBe(EAST)
    expect(unitOf(engine, 'archer').ap).toBe(ARCHER_STATS.actionPoints - ARCHER_STATS.attackApCost)
  })

  it('gains the rear bonus for a shot into a foe’s back, which gives it no turn', () => {
    const engine = new BattleEngine(setup([ARCHER, { ...GOBLIN, position: hex(4, 1), facing: EAST }]), {
      rng: sequence([ROLL_7]),
    })
    expect(unitOf(engine, 'goblin').turnReady).toBe(true)
    expect(engine.previewAttack('archer', 'goblin')).toMatchObject({ arc: 'rear', arcBonus: ARC_BONUS.rear })
    const [attack] = engine.step(SHOOT_GOBLIN) as [AttackEvent]
    expect(attack).toMatchObject({
      melee: false,
      defenderTurned: false,
      defenderFacing: EAST,
      arc: 'rear',
      chance: ARCHER_STATS.toHit + ARC_BONUS.rear - GOBLIN.stats.ac,
      hit: true,
    })
    expect(unitOf(engine, 'goblin')).toMatchObject({ facing: EAST, turnReady: true })
  })

  it('gives no turn against a ranged weapon even from the next hex', () => {
    const engine = new BattleEngine(setup([ARCHER, { ...GOBLIN, facing: EAST }]), { rng: sequence([FUMBLE]) })
    expect(engine.previewAttack('archer', 'goblin')).toMatchObject({ arc: 'rear' })
    expect(engine.step(SHOOT_GOBLIN)[0]).toMatchObject({ defenderTurned: false, arc: 'rear' })
  })

  it('counts allies beside the target as flankers for a shot', () => {
    const engine = new BattleEngine(setup([ARCHER, { ...CLERIC, position: hex(3, 1) }, { ...GOBLIN, position: hex(4, 1) }]))
    expect(engine.previewAttack('archer', 'goblin')).toMatchObject({
      flankers: ['cleric'],
      flankBonus: FLANK_BONUS_PER_ALLY,
    })
  })

  it('holds no zone of control with a ranged weapon', () => {
    // The goblin walks away from the archer beside it and is not struck.
    const engine = new BattleEngine(setup([ARCHER, GOBLIN]))
    engine.step(END_TURN)
    expect(engine.previewMove('goblin', hex(4, 1))!.provokes).toEqual([])
    const events = engine.step(move('goblin', hex(4, 1)))
    expect(events.map((e) => e.type)).toEqual(['move'])
  })

  it('is still struck for walking out of a melee foe’s zone', () => {
    const engine = new BattleEngine(setup([ARCHER, GOBLIN]), { rng: sequence([FUMBLE]) })
    const events = engine.step(move('archer', hex(0, 1)))
    expect(events.map((e) => e.type)).toEqual(['move', 'attack', 'move'])
  })
})

describe('BattleEngine reach', () => {
  // A spear: a melee weapon that strikes from two hexes.
  const SPEAR_STATS: CombatantStats = { ...WARRIOR_STATS, name: 'Spearman', attackRange: 2, reach: true, armorPierce: 1 }
  const SPEARMAN: UnitSetup = { id: 'spearman', side: 'player', stats: SPEAR_STATS, position: hex(1, 1) }
  const THRUST: Action = { type: 'attack', unit: 'spearman', target: 'goblin' }
  const opportunity = (events: readonly BattleEvent[]) =>
    events.filter((e): e is AttackEvent => e.type === 'attack' && e.opportunity)

  it('tells a melee weapon by a range of 1 or by reach', () => {
    expect(isMelee({ attackRange: 1 })).toBe(true)
    expect(isMelee({ attackRange: 2, reach: true })).toBe(true)
    expect(isMelee({ attackRange: 5 })).toBe(false)
  })

  it('strikes a foe two hexes off without moving, as a melee blow the foe turns to meet', () => {
    // The goblin, two hexes east, faces east: the spearman comes at its back.
    const engine = new BattleEngine(setup([SPEARMAN, { ...GOBLIN, position: hex(3, 1), facing: EAST }]), {
      rng: sequence([FUMBLE]),
    })
    expect(nonMoves(engine)).toEqual([THRUST, END_TURN])
    expect(engine.previewAttack('spearman', 'goblin')).toMatchObject({ arc: 'front', arcBonus: 0 })
    const [attack] = engine.step(THRUST) as [AttackEvent]
    expect(attack).toMatchObject({
      distance: 2,
      melee: true,
      armorPierce: 1,
      defenderTurned: true,
      defenderFacing: WEST,
      arc: 'front',
    })
    expect(unitOf(engine, 'goblin').turnReady).toBe(false)
  })

  it('holds a zone of control over the next hexes only', () => {
    const near = new BattleEngine(setup([SPEARMAN, GOBLIN]), { rng: sequence([FUMBLE]) })
    near.step(END_TURN)
    // From beside the spearman to two hexes off: one free attack, a melee one.
    expect(opportunity(near.step(move('goblin', hex(3, 1))))).toEqual([
      expect.objectContaining({ attacker: 'spearman', defender: 'goblin', melee: true, distance: 1 }),
    ])

    const far = new BattleEngine(setup([SPEARMAN, { ...GOBLIN, position: hex(3, 1) }]), { rng: sequence([FUMBLE]) })
    far.step(END_TURN)
    expect(far.previewMove('goblin', hex(4, 1))!.provokes).toEqual([])
    expect(opportunity(far.step(move('goblin', hex(4, 1))))).toEqual([])
    expect(opportunity(far.step(move('goblin', hex(3, 0))))).toEqual([])
  })

  it('does not provoke a slide from one hex beside the spearman to another', () => {
    const engine = new BattleEngine(setup([SPEARMAN, GOBLIN]), { rng: sequence([FUMBLE]) })
    engine.step(END_TURN)
    expect(engine.previewMove('goblin', hex(2, 0))!.provokes).toEqual([])
    expect(opportunity(engine.step(move('goblin', hex(2, 0))))).toEqual([])
  })

  it('judges the arc of a blow as the front of a foe that can still turn, and of a shot as it stands', () => {
    const defender = { position: hex(2, 1), facing: EAST, turnReady: true }
    expect(arcStruck(defender, hex(0, 1), true)).toBe('front')
    expect(arcStruck(defender, hex(0, 1), false)).toBe('rear')
    expect(arcStruck({ ...defender, turnReady: false }, hex(0, 1), true)).toBe('rear')
  })
})

describe('BattleEngine flanking', () => {
  // The goblin at (2,1) has the warrior to its west; (2,2) and (3,0) also touch it.
  const flanker = (id: string, position = hex(2, 2), hp?: number): UnitSetup => ({
    ...CLERIC,
    id,
    position,
    hp,
  })
  const attackOn = (units: UnitSetup[], rolls = [ROLL_7, 0]) =>
    new BattleEngine(setup(units), { rng: sequence(rolls) }).step(ATTACK_GOBLIN)[0] as AttackEvent

  it('turns a miss into a hit with an ally on the other side of the defender', () => {
    expect(attackOn([WARRIOR, GOBLIN])).toMatchObject({ flankers: [], flankBonus: 0, attackRoll: 70, chance: 60, hit: false })
    expect(attackOn([WARRIOR, GOBLIN, flanker('cleric')])).toMatchObject({
      flankers: ['cleric'],
      flankBonus: FLANK_BONUS_PER_ALLY,
      chance: 60 + FLANK_BONUS_PER_ALLY,
      hit: true,
    })
  })

  it('adds a bonus for each adjacent ally', () => {
    const event = attackOn([WARRIOR, GOBLIN, flanker('cleric'), flanker('rogue', hex(3, 0))])
    expect(event).toMatchObject({ flankers: ['cleric', 'rogue'], flankBonus: 2 * FLANK_BONUS_PER_ALLY })
  })

  it('ignores fallen allies, distant allies and the defender’s own side', () => {
    const event = attackOn([
      WARRIOR,
      GOBLIN,
      GOBLIN2, // adjacent to the goblin, but on its side
      flanker('fallen', hex(2, 2), 0),
      flanker('distant', hex(4, 1)),
    ])
    expect(event).toMatchObject({ flankers: [], flankBonus: 0 })
  })

  it('lets enemies flank the player too', () => {
    // goblin2 at (2,0) touches the warrior, so the goblin's attack is flanked.
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, GOBLIN2]), { rng: sequence([FUMBLE]) })
    engine.step(END_TURN)
    const [attack] = engine.step(ATTACK_WARRIOR) as [AttackEvent]
    expect(attack).toMatchObject({ attacker: 'goblin', flankers: ['goblin2'], flankBonus: FLANK_BONUS_PER_ALLY })
  })

  it('exposes the same rule over snapshots for agents', () => {
    const { units } = new BattleEngine(setup([WARRIOR, GOBLIN, flanker('cleric')])).getState()
    const byId = (id: string) => units.find((u) => u.id === id)!
    expect(flankersOf(units, byId('warrior'), byId('goblin'))).toEqual(['cleric'])
    expect(flankersOf(units, byId('goblin'), byId('warrior'))).toEqual([])
  })

  it('previews the flanking and hit chance of a legal attack', () => {
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, GOBLIN2, flanker('cleric')]))
    // Warrior +4 vs AC 13 hits on 9+ (60%); one flanker makes it 7+ (70%).
    expect(engine.previewAttack('warrior', 'goblin')).toEqual({
      flankers: ['cleric'],
      flankBonus: FLANK_BONUS_PER_ALLY,
      arc: 'front',
      arcBonus: 0,
      hitChance: 0.7,
      resistance: 1,
    })
    expect(engine.previewAttack('warrior', 'goblin2')).toEqual({
      flankers: [],
      flankBonus: 0,
      arc: 'front',
      arcBonus: 0,
      hitChance: 0.6,
      resistance: 1,
    })
    expect(engine.previewAttack('cleric', 'goblin2')).toBeNull() // not adjacent
    expect(engine.previewAttack('goblin', 'warrior')).toBeNull() // not the enemy's turn
    engine.step(move('warrior', hex(0, 0)))
    engine.step(move('warrior', hex(1, 1)))
    expect(engine.previewAttack('warrior', 'goblin')).toBeNull() // too few AP
  })

  it('takes the resistance a weapon leaves unpierced off the damage of a hit, never its chance, and logs both', () => {
    const armoured = { ...GOBLIN, stats: { ...GOBLIN_STATS, resistance: 4 } }
    const hit = (pierce: number) => {
      const piercer = { ...WARRIOR, stats: { ...WARRIOR_STATS, armorPierce: pierce } }
      // A roll of 50 hits; the d8 comes up 5, and +2: 7 rolled.
      const engine = new BattleEngine(setup([piercer, armoured]), { rng: sequence([0.5, 0.5]) })
      expect(engine.previewAttack('warrior', 'goblin')).toMatchObject({ hitChance: 0.6, resistance: Math.max(0, 4 - pierce) })
      return engine.step(ATTACK_GOBLIN)[0] as AttackEvent
    }
    expect(hit(0)).toMatchObject({ chance: 60, defenderAc: 15, defenderResistance: 4, armorPierce: 0, rolled: 7, damage: 3 })
    expect(hit(2)).toMatchObject({ chance: 60, armorPierce: 2, rolled: 7, damage: 5 })
    expect(hit(9)).toMatchObject({ rolled: 7, damage: 7 })
  })

  it('lets a hit through the heaviest armour for 1 at least', () => {
    const plated = { ...GOBLIN, stats: { ...GOBLIN_STATS, resistance: 30 } }
    const engine = new BattleEngine(setup([WARRIOR, plated]), { rng: sequence([0.5, 0]) })
    expect(engine.step(ATTACK_GOBLIN)[0]).toMatchObject({ hit: true, rolled: 3, damage: 1 })
  })
})

describe('BattleEngine facing', () => {
  const facingOf = (engine: BattleEngine, id: string) => unitOf(engine, id).facing

  it('starts each side facing the other, unless the setup says otherwise', () => {
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, { ...GOBLIN2, facing: SOUTH_EAST }]))
    expect([facingOf(engine, 'warrior'), facingOf(engine, 'goblin'), facingOf(engine, 'goblin2')]).toEqual([
      EAST,
      WEST,
      SOUTH_EAST,
    ])
  })

  it('splits a defender’s six sides into three front, two side and one rear', () => {
    const defender = { position: hex(2, 1), facing: EAST }
    const arcs = HEX_DIRECTIONS.map((d) => attackArc(defender, hexAdd(defender.position, d)))
    expect(arcs).toEqual(['front', 'front', 'side', 'rear', 'side', 'front'])
    expect(attackArc({ ...defender, facing: WEST }, hex(3, 1))).toBe('rear')
    expect(() => attackArc(defender, defender.position)).toThrow()
  })

  it('judges a shot from range by the side it comes in over', () => {
    const defender = { position: hex(2, 1), facing: EAST }
    const arcs = HEX_DIRECTIONS.map((d) => attackArc(defender, hex(2 + 3 * d.q, 1 + 3 * d.r)))
    expect(arcs).toEqual(['front', 'front', 'side', 'rear', 'side', 'front'])
  })

  it('turns a mover towards its last step', () => {
    const engine = new BattleEngine(setup([{ ...WARRIOR, position: hex(0, 1) }, { ...GOBLIN, position: hex(4, 1) }]))
    const [event] = engine.step(move('warrior', hex(0, 0))) as [MoveEvent]
    expect(event.facing).toBe(NORTH_WEST)
    expect(facingOf(engine, 'warrior')).toBe(NORTH_WEST)
  })

  it('turns an attacker towards its target, and not a defender struck in front', () => {
    const engine = new BattleEngine(setup([{ ...WARRIOR, facing: WEST }, GOBLIN]), { rng: sequence([FUMBLE]) })
    const [attack] = engine.step(ATTACK_GOBLIN) as [AttackEvent]
    expect(attack).toMatchObject({ attackerFacing: EAST, defenderTurned: false, defenderFacing: WEST })
    expect(facingOf(engine, 'warrior')).toBe(EAST)
    expect(facingOf(engine, 'goblin')).toBe(WEST)
    expect(unitOf(engine, 'goblin').turnReady).toBe(true)
  })

  it('turns a defender struck in its side or rear to face the attacker, even for a miss, once a turn', () => {
    // The goblin faces east; the warrior strikes from its west (rear), then the cleric from its east (now its rear).
    const engine = new BattleEngine(
      setup([WARRIOR, { ...GOBLIN, facing: EAST }, { ...CLERIC, position: hex(3, 1) }]),
      { rng: sequence([FUMBLE]) },
    )
    expect(unitOf(engine, 'goblin').turnReady).toBe(true)
    const [first] = engine.step(ATTACK_GOBLIN) as [AttackEvent]
    expect(first).toMatchObject({ defenderTurned: true, defenderFacing: WEST, arc: 'front', arcBonus: 0, hit: false })
    expect(unitOf(engine, 'goblin')).toMatchObject({ facing: WEST, turnReady: false })
    const [second] = engine.step({ type: 'attack', unit: 'cleric', target: 'goblin' }) as [AttackEvent]
    expect(second).toMatchObject({ defenderTurned: false, defenderFacing: WEST, arc: 'rear', arcBonus: ARC_BONUS.rear })
    engine.step(END_TURN)
    engine.step(END_TURN)
    expect(unitOf(engine, 'goblin').turnReady).toBe(true) // ready again on the player's next turn
  })

  it('readies a turn only for the side not taking its turn', () => {
    const engine = new BattleEngine(DUEL)
    expect(unitOf(engine, 'warrior').turnReady).toBe(false)
    expect(unitOf(engine, 'goblin').turnReady).toBe(true)
    engine.step(END_TURN)
    expect(unitOf(engine, 'warrior').turnReady).toBe(true)
    expect(unitOf(engine, 'goblin').turnReady).toBe(false)
  })

  it('turns a miss into a hit when shooting into a back', () => {
    const attack = (warriorFacing: number) => {
      // The goblin archer shoots from the far west.
      const engine = new BattleEngine(
        setup([
          { ...WARRIOR, position: hex(3, 1), facing: warriorFacing },
          { ...GOBLIN2, position: hex(0, 1), stats: { ...GOBLIN_STATS, attackRange: 3 } },
        ]),
        { rng: sequence([ROLL_10, 0]) },
      )
      engine.step(END_TURN)
      return engine.step({ type: 'attack', unit: 'goblin2', target: 'warrior' })[0] as AttackEvent
    }
    expect(attack(WEST)).toMatchObject({ arc: 'front', arcBonus: 0, attackRoll: 55, chance: 45, hit: false })
    expect(attack(EAST)).toMatchObject({ arc: 'rear', arcBonus: ARC_BONUS.rear, chance: 55, hit: true })
  })

  it('previews the front for a foe that will turn, and stacks the arc bonus with flanking once it cannot', () => {
    // The goblin faces east. The cleric strikes from its north-west and it turns that way, which puts the
    // warrior, south-west of it, beside its back.
    const engine = new BattleEngine(
      setup([
        { ...WARRIOR, position: hex(1, 2) },
        { ...GOBLIN, facing: EAST },
        { ...CLERIC, position: hex(2, 0) },
      ]),
      { rng: sequence([FUMBLE]) },
    )
    expect(engine.previewAttack('warrior', 'goblin')).toMatchObject({ arc: 'front', arcBonus: 0, hitChance: 0.7 })
    engine.step({ type: 'attack', unit: 'cleric', target: 'goblin' })
    // 75%, +10 flanking and +5, less the goblin's armour class of 15.
    expect(engine.previewAttack('warrior', 'goblin')).toMatchObject({
      flankBonus: FLANK_BONUS_PER_ALLY,
      arc: 'side',
      arcBonus: ARC_BONUS.side,
      hitChance: 0.75,
    })
  })

  it('judges a free attack mid-move against the mover turned towards its next step', () => {
    const engine = new BattleEngine(
      {
        board: { cols: 6, rows: 4 },
        units: [
          { ...WARRIOR, position: hex(1, 1) },
          { ...GOBLIN, position: hex(0, 0) },
          { ...GOBLIN2, position: hex(1, 2) },
          { ...CLERIC, position: hex(0, 2) }, // blocks the way round
        ],
      },
      { rng: sequence([FUMBLE]) },
    )
    const events = engine.step(move('warrior', hex(-1, 2)))
    const moves = events.filter((e): e is MoveEvent => e.type === 'move')
    const attacks = events.filter((e): e is AttackEvent => e.type === 'attack')
    expect(moves.map((m) => m.path)).toEqual([[], [hex(0, 1)], [hex(-1, 2)]])
    expect(moves[1].facing).toBe(SOUTH_WEST)
    expect(attacks.map((a) => [a.attacker, a.arc])).toEqual([
      ['goblin2', 'side'],
      ['goblin', 'side'], // facing west still, it would be the front
    ])
    expect(attacks.every((a) => !a.defenderTurned)).toBe(true)
  })

  it('exposes the back of a unit that retreats straight away, which cannot turn on its own turn', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    const attack = engine.step(move('warrior', hex(0, 1))).find((e): e is AttackEvent => e.type === 'attack')!
    expect(attack).toMatchObject({ arc: 'rear', arcBonus: ARC_BONUS.rear, defenderTurned: false })
  })
})

describe('formatEvent', () => {
  it('names a status laid twice by one blow once', () => {
    const base = {
      type: 'attack', attacker: 'warrior', defender: 'goblin', attackRoll: 10, chance: 80, hit: true, critical: false, image: false,
      rolled: 5, damage: 5, bonus: [], flank: 0, arcBonus: 0, arc: 'front',
    } as unknown as BattleEvent
    const line = formatEvent(
      { ...base, onHitStatuses: [{ id: 'seared', turnsLeft: 1 }, { id: 'seared', turnsLeft: 1 }] } as BattleEvent,
      NAMES,
    )
    expect(line.match(/seared/g)).toHaveLength(1)
  })

  it('introduces the battle by side', () => {
    expect(formatEvent(new BattleEngine(DUEL).getLog()[0], NAMES)).toBe("Goblin blocks Warrior's path. Battle begins!")
    const party = new BattleEngine(setup([WARRIOR, GOBLIN, CLERIC, GOBLIN2]))
    expect(formatEvent(party.getLog()[0], NAMES)).toBe(
      "Goblin and Goblin Archer block Warrior and Cleric's path. Battle begins!",
    )
  })

  it('describes a move', () => {
    const engine = new BattleEngine(setup([{ ...WARRIOR, position: hex(0, 1) }, { ...GOBLIN, position: hex(4, 1) }]))
    expect(formatEvent(engine.step(move('warrior', hex(1, 1)))[0], NAMES)).toBe('Warrior moves 1 hex.')
    engine.step(END_TURN)
    expect(formatEvent(engine.step(move('goblin', hex(2, 1)))[0], NAMES)).toBe('Goblin moves 2 hexes.')
  })

  it('describes a free attack interrupting a move', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    expect(engine.step(move('warrior', hex(0, 1))).map((e) => formatEvent(e, NAMES))).toEqual([
      'Warrior starts to move.',
      'Warrior breaks away — free attack! Goblin rolls 100 — fumbles the attack!',
      'Warrior moves 1 hex.',
    ])
  })

  it('describes the end of each side’s turn', () => {
    const engine = new BattleEngine(DUEL)
    expect(formatEvent(engine.step(END_TURN)[0], NAMES)).toBe('You end your turn.')
    expect(formatEvent(engine.step(END_TURN)[0], NAMES)).toBe('The enemy ends its turn.')
  })

  it('describes the flanking bonus in the roll', () => {
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, { ...CLERIC, position: hex(2, 2) }]), {
      rng: sequence([ROLL_7, 0]),
    })
    expect(formatEvent(engine.step(ATTACK_GOBLIN)[0], NAMES)).toBe(
      'Warrior rolls 70 (needs 70 or less, +10 flanking) — HITS Goblin for 2 dmg (armour stops 1).',
    )
  })

  it('describes a side or rear attack in the roll', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([ROLL_10, 0]) })
    const attack = engine.step(move('warrior', hex(0, 1))).find((e) => e.type === 'attack')!
    expect(formatEvent(attack, NAMES)).toBe(
      'Warrior breaks away — free attack! Goblin rolls 55 (needs 55 or less, +10 from behind) — HITS Warrior for 2 dmg.',
    )
  })

  it('describes a defender turning to meet the attack', () => {
    const engine = new BattleEngine(setup([{ ...WARRIOR, facing: WEST }, GOBLIN]), { rng: sequence([ROLL_10, 0]) })
    engine.step(END_TURN)
    expect(formatEvent(engine.step(ATTACK_WARRIOR)[0], NAMES)).toBe(
      'Warrior turns to face Goblin. Goblin rolls 55 (needs 45 or less) — MISSES Warrior.',
    )
  })

  it('describes a fumble', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    const [attack] = engine.step(ATTACK_GOBLIN)
    expect(formatEvent(attack, NAMES)).toBe('Warrior rolls 100 — fumbles the attack!')
  })

  it('describes a critical hit, the fall and the outcome', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence(KILL) })
    const lines = engine.step(ATTACK_GOBLIN).map((e) => formatEvent(e, NAMES))
    expect(lines[0]).toContain('HITS Goblin')
    expect(lines[0]).toContain('CRITICAL HIT!')
    expect(lines.slice(1)).toEqual(['Goblin falls.', 'Victory!'])
  })

  it('describes an abandoned battle', () => {
    const [end] = new BattleEngine(DUEL).abandon()
    expect(formatEvent(end, NAMES)).toBe('The battle is abandoned.')
  })
})

describe('BattleEngine gear changes', () => {
  const BOW_STATS: CombatantStats = { ...WARRIOR_STATS, damage: { count: 1, sides: 8, bonus: 0 }, attackRange: 5 }
  const DAGGER_STATS: CombatantStats = { ...WARRIOR_STATS, damage: { count: 1, sides: 4, bonus: 0 }, attackApCost: 3 }
  const equip = (stats: CombatantStats, changes?: GearChange[]): Action => ({
    type: 'equip',
    unit: 'warrior',
    stats,
    changes,
  })
  const warriorOf = (engine: BattleEngine) => engine.getState().units.find((u) => u.id === 'warrior')!
  // The goblin stands four hexes east of the warrior: out of a sword's reach, inside a bow's.
  const APART = setup([WARRIOR, { ...GOBLIN, position: hex(5, 1) }])

  it('costs an action point and swaps the stats the unit fights with', () => {
    const engine = new BattleEngine(APART, { rng: () => FUMBLE })
    expect(engine.equipCost('warrior')).toBe(EQUIP_AP_COST)
    expect(engine.legalActions('warrior')).not.toContainEqual(ATTACK_GOBLIN)

    const events = engine.step(equip(BOW_STATS))

    expect(events).toMatchObject([{ type: 'equip', unit: 'warrior', apCost: EQUIP_AP_COST, stats: BOW_STATS }])
    expect(warriorOf(engine)).toMatchObject({ ap: WARRIOR_STATS.actionPoints - EQUIP_AP_COST, attackRange: 5 })
    expect(engine.legalActions('warrior')).toContainEqual(ATTACK_GOBLIN)
    expect(events[0]).toMatchObject({ apAfter: 7, changes: [], statsBefore: WARRIOR_STATS })
    expect(formatEvent(events[0], NAMES)).toBe('Warrior changes gear.')
  })

  it('logs which items changed and names them to the player', () => {
    const engine = new BattleEngine(APART, { rng: () => FUMBLE })
    const sword = { id: 'iron_sword', name: 'Iron Longsword' }
    const bow = { id: 'yew_bow', name: 'Yew Bow' }
    const shield = { id: 'oak_shield', name: 'Oak Shield' }
    const changes = [
      { slot: 'mainHand', from: sword, to: bow },
      { slot: 'offHand', from: shield, to: null },
    ]
    const [event] = engine.step(equip(BOW_STATS, changes))
    expect(event).toMatchObject({ type: 'equip', changes })
    expect(formatEvent(event, NAMES)).toBe(
      'Warrior swaps the Iron Longsword for the Yew Bow and puts away the Oak Shield.',
    )
    const [taken] = engine.step(equip(BOW_STATS, [{ slot: 'offHand', from: null, to: shield }]))
    expect(formatEvent(taken, NAMES)).toBe('Warrior takes up the Oak Shield.')
  })

  it('logs what was dropped and picked up, and where', () => {
    const engine = new BattleEngine(APART, { rng: () => FUMBLE })
    const bow = { id: 'yew_bow', name: 'Yew Bow' }
    const shield = { id: 'oak_shield', name: 'Oak Shield' }
    const dagger = { id: 'iron_dagger', name: 'Iron Dagger' }

    // Dropping from the backpack leaves the unit's stats as they were, and still costs the point.
    const [drop] = engine.step({ type: 'equip', unit: 'warrior', stats: WARRIOR_STATS, dropped: [shield, dagger] })
    expect(drop).toMatchObject({
      type: 'equip',
      apCost: EQUIP_AP_COST,
      position: WARRIOR.position,
      changes: [],
      dropped: [shield, dagger],
      pickedUp: [],
    })
    expect(formatEvent(drop, NAMES)).toBe('Warrior drops the Oak Shield and the Iron Dagger.')

    const [swap] = engine.step({
      type: 'equip',
      unit: 'warrior',
      stats: BOW_STATS,
      changes: [{ slot: 'offHand', from: null, to: shield }],
      dropped: [dagger],
      pickedUp: [bow],
    })
    expect(swap).toMatchObject({ apCost: 0, dropped: [dagger], pickedUp: [bow] })
    expect(formatEvent(swap, NAMES)).toBe(
      'Warrior takes up the Oak Shield, drops the Iron Dagger and picks up the Yew Bow.',
    )
  })

  it('says only that an item dropped straight from its slot was dropped', () => {
    const engine = new BattleEngine(APART, { rng: () => FUMBLE })
    const shield = { id: 'oak_shield', name: 'Oak Shield' }
    const [event] = engine.step({
      type: 'equip',
      unit: 'warrior',
      stats: WARRIOR_STATS,
      changes: [{ slot: 'offHand', from: shield, to: null }],
      dropped: [shield],
    })
    expect(event).toMatchObject({ changes: [{ slot: 'offHand', from: shield, to: null }] })
    expect(formatEvent(event, NAMES)).toBe('Warrior drops the Oak Shield.')
  })

  it('logs the weapon, range, cost and numbers behind an attack', () => {
    const engine = new BattleEngine(APART, { rng: () => 0.5 })
    engine.step(equip({ ...BOW_STATS, weapon: 'Yew Bow' }))
    const [shot] = engine.step({ type: 'attack', unit: 'warrior', target: 'goblin' })
    const ap = WARRIOR_STATS.actionPoints - EQUIP_AP_COST - BOW_STATS.attackApCost
    expect(shot).toMatchObject({
      type: 'attack',
      weapon: 'Yew Bow',
      distance: 4,
      apCost: BOW_STATS.attackApCost,
      apAfter: ap,
      toHit: BOW_STATS.toHit,
      defenderAc: GOBLIN.stats.ac,
      damageDice: BOW_STATS.damage,
    })
    if (shot.type !== 'attack') throw new Error('expected an attack')
    expect(shot.defenderHpBefore - shot.defenderHpAfter).toBe(Math.min(shot.damage, shot.defenderHpBefore))
    const [end] = engine.step({ type: 'end_turn' })
    expect(end).toMatchObject({ type: 'end_turn', unspentAp: { warrior: ap } })
  })

  it('charges once for any number of changes until the unit acts', () => {
    const engine = new BattleEngine(APART, { rng: () => FUMBLE })
    engine.step(equip(BOW_STATS))
    expect(engine.equipCost('warrior')).toBe(0)
    expect(engine.step(equip(DAGGER_STATS))).toMatchObject([{ type: 'equip', apCost: 0 }])
    expect(warriorOf(engine).ap).toBe(WARRIOR_STATS.actionPoints - EQUIP_AP_COST)

    engine.step({ type: 'move', unit: 'warrior', to: hex(2, 1) })
    expect(engine.equipCost('warrior')).toBe(EQUIP_AP_COST)
    expect(engine.step(equip(BOW_STATS))).toMatchObject([{ type: 'equip', apCost: EQUIP_AP_COST }])
  })

  it('charges again after an attack', () => {
    const engine = new BattleEngine(APART, { rng: () => FUMBLE })
    engine.step(equip(BOW_STATS))
    engine.step(ATTACK_GOBLIN)
    expect(engine.equipCost('warrior')).toBe(EQUIP_AP_COST)
  })

  it('charges again on the next turn', () => {
    const engine = new BattleEngine(APART, { rng: () => FUMBLE })
    engine.step(equip(BOW_STATS))
    engine.step(END_TURN)
    expect(engine.equipCost('warrior')).toBeNull()
    engine.step(END_TURN)
    expect(engine.equipCost('warrior')).toBe(EQUIP_AP_COST)
  })

  it('lets a unit that spent its last point on a change go on changing, but not start one without a point', () => {
    const engine = new BattleEngine(APART, { rng: () => FUMBLE })
    engine.step({ type: 'move', unit: 'warrior', to: hex(4, 1) })
    engine.step({ type: 'move', unit: 'warrior', to: hex(0, 1) })
    expect(warriorOf(engine).ap).toBe(1)
    engine.step(equip(BOW_STATS))
    expect(warriorOf(engine).ap).toBe(0)
    expect(engine.step(equip(DAGGER_STATS))).toMatchObject([{ type: 'equip', apCost: 0 }])

    const spent = new BattleEngine(APART, { rng: () => FUMBLE })
    spent.step({ type: 'move', unit: 'warrior', to: hex(4, 1) })
    spent.step({ type: 'move', unit: 'warrior', to: hex(0, 1) })
    spent.step({ type: 'move', unit: 'warrior', to: hex(1, 1) })
    expect(spent.equipCost('warrior')).toBeNull()
    expect(() => spent.step(equip(BOW_STATS))).toThrow('cannot change gear')
  })

  it('refuses a change out of turn', () => {
    const engine = new BattleEngine(APART, { rng: () => FUMBLE })
    expect(engine.equipCost('goblin')).toBeNull()
    expect(() => engine.step({ type: 'equip', unit: 'goblin', stats: BOW_STATS })).toThrow('cannot change gear')
  })

  it('drops the zone of control of a unit that takes up a bow', () => {
    const engine = new BattleEngine(DUEL, { rng: () => FUMBLE })
    engine.step(equip(BOW_STATS))
    engine.step(END_TURN)
    const events = engine.step({ type: 'move', unit: 'goblin', to: hex(4, 1) })
    expect(events.map((e) => e.type)).toEqual(['move'])
  })
})

describe('BattleEngine spells', () => {
  const MAGE_STATS: CombatantStats = {
    ...WARRIOR_STATS,
    name: 'Mage',
    magic: { maxMana: 18, skill: 76, spells: ['magic_arrow'] },
  }
  const WIDE = { cols: 9, rows: 3 }
  const MAGE: UnitSetup = { id: 'mage', side: 'player', stats: MAGE_STATS, position: hex(1, 1) }
  // Four hexes east of the mage: inside Magic Arrow's five, outside a sword's one.
  const FAR_GOBLIN: UnitSetup = { ...GOBLIN, position: hex(5, 1) }
  const battle = (units: UnitSetup[], rng: number[] = [FUMBLE]) =>
    new BattleEngine({ board: WIDE, units }, { rng: sequence(rng) })
  const cast = (target: string, unit = 'mage'): Action => ({ type: 'cast', unit, spell: 'magic_arrow', target })
  const NAMED = { ...NAMES, mage: 'Mage' }
  /** A roll of 34, within the mage's 61% against a Goblin, then a 7 on the d10. */
  const HIT_FOR_7 = [0.66, 0.6]

  it('starts a caster with its mana, and a unit without magic with none', () => {
    const engine = battle([MAGE, FAR_GOBLIN])
    expect(unitOf(engine, 'mage').mana).toBe(18)
    expect(unitOf(engine, 'goblin').mana).toBe(0)
    expect(engine.getLog()[0]).toMatchObject({ schemaVersion: LOG_SCHEMA_VERSION, units: [{ mana: 18, magic: MAGE_STATS.magic }, {}] })
  })

  it('lists a cast on each foe in the spell’s range, and pays its action points and mana', () => {
    const engine = battle([MAGE, FAR_GOBLIN, { ...GOBLIN2, position: hex(7, 1) }], HIT_FOR_7)
    expect(nonMoves(engine)).toEqual([cast('goblin'), END_TURN])

    const events = engine.step(cast('goblin'))

    expect(events).toEqual([
      expect.objectContaining({
        type: 'cast',
        caster: 'mage',
        spell: 'magic_arrow',
        target: 'goblin',
        distance: 4,
        apCost: 4,
        apAfter: 4,
        manaCost: 3,
        manaAfter: 15,
        casterFacing: EAST,
        skill: 76,
        at: FAR_GOBLIN.position,
        outcomes: [
          {
            unit: 'goblin',
            attackRoll: 34,
            chance: 61,
            defenderAc: 15,
            hit: true,
            critical: false,
            fumble: false,
            image: false,
            damage: 7,
            warded: 0,
            half: false,
            healed: 0,
            hpBefore: 12,
            hpAfter: 5,
            status: null,
          },
        ],
      }),
    ])
    expect(unitOf(engine, 'mage')).toMatchObject({ ap: 4, mana: 15 })
    expect(unitOf(engine, 'goblin').hp).toBe(5)
    expect(formatEvent(events[0], NAMED)).toBe('Mage casts Magic Arrow on Goblin: rolls 34 (needs 61 or less) — HITS Goblin for 7 dmg.')
  })

  it('keeps what mana is left from turn to turn', () => {
    const engine = battle([MAGE, FAR_GOBLIN])
    engine.step(cast('goblin'))
    engine.step(cast('goblin'))
    expect(unitOf(engine, 'mage')).toMatchObject({ ap: 0, mana: 12 })
    engine.step(END_TURN)
    engine.step(END_TURN)
    expect(unitOf(engine, 'mage')).toMatchObject({ ap: 8, mana: 12 })
  })

  it('misses, fumbles and strikes critically as an attack does, with nothing for flank or arc', () => {
    // The cleric stands beside the goblin, whose back is to the mage: a blade would gain from both.
    const flanked = [MAGE, { ...CLERIC, position: hex(4, 1) }, { ...FAR_GOBLIN, facing: EAST }]
    const miss = battle(flanked, [0.3]).step(cast('goblin'))
    expect(miss).toMatchObject([{ outcomes: [{ attackRoll: 70, chance: 61, hit: false, fumble: false, damage: 0 }] }])
    expect(formatEvent(miss[0], NAMED)).toBe('Mage casts Magic Arrow on Goblin: rolls 70 (needs 61 or less) — MISSES Goblin.')

    const fumble = battle(flanked, [FUMBLE]).step(cast('goblin'))
    expect(fumble).toMatchObject([{ outcomes: [{ attackRoll: 100, hit: false, fumble: true }] }])
    expect(formatEvent(fumble[0], NAMED)).toBe('Mage casts Magic Arrow on Goblin: rolls 100 — fumbles the spell!')

    // A roll of 5 is within the mage's critical chance: 2d10, here a 3 and a 3.
    const critical = battle(flanked, [0.95, 0.2]).step(cast('goblin'))
    expect(critical[0]).toMatchObject({ outcomes: [{ attackRoll: 5, critical: true, damage: 6 }] })
    expect(formatEvent(critical[0], NAMED)).toBe(
      'Mage casts Magic Arrow on Goblin: rolls 5 (needs 61 or less) — HITS Goblin for 6 dmg (CRITICAL).',
    )
  })

  it('fells its target and wins the battle', () => {
    const engine = battle([MAGE, FAR_GOBLIN], KILL)
    expect(engine.step(cast('goblin')).map((e) => e.type)).toEqual(['cast', 'unit_down', 'battle_end'])
    expect(engine.getState()).toMatchObject({ phase: 'over', winner: 'player' })
  })

  it('provokes nothing, and ends a paid-for change of gear', () => {
    const engine = battle([MAGE, { ...GOBLIN, position: hex(2, 1) }])
    engine.step({ type: 'equip', unit: 'mage', stats: MAGE_STATS })
    expect(engine.equipCost('mage')).toBe(0)
    expect(engine.step(cast('goblin')).map((e) => e.type)).toEqual(['cast'])
    expect(engine.equipCost('mage')).toBe(EQUIP_AP_COST)
  })

  it('lists a cast for a unit with too few action points to attack', () => {
    const quick = { ...MAGE_STATS, attackApCost: 9, attackRange: 5 }
    const engine = battle([{ ...MAGE, stats: quick }, FAR_GOBLIN])
    expect(nonMoves(engine)).toEqual([cast('goblin'), END_TURN])
  })

  describe('refuses a cast', () => {
    const refused = (engine: BattleEngine, action: Action) => {
      expect(engine.legalActions()).not.toContainEqual(action)
      if (action.type === 'cast') expect(engine.previewCast(action.unit, action.spell, 'at' in action ? action.at : action.target)).toBeNull()
      expect(() => engine.step(action)).toThrow(/cannot cast \w+ at|cannot act now/)
    }
    const with_ = (magic: Partial<NonNullable<CombatantStats['magic']>>, stats: Partial<CombatantStats> = {}) => ({
      ...MAGE,
      stats: { ...MAGE_STATS, ...stats, magic: { ...MAGE_STATS.magic!, ...magic } },
    })

    it('with too little mana', () => {
      refused(battle([with_({ maxMana: 2 }), FAR_GOBLIN]), cast('goblin'))
      const engine = battle([with_({ maxMana: 5 }), FAR_GOBLIN])
      engine.step(cast('goblin'))
      refused(engine, cast('goblin'))
    })

    it('with too few action points', () => {
      refused(battle([with_({}, { actionPoints: 3 }), FAR_GOBLIN]), cast('goblin'))
    })

    it('out of range', () => {
      refused(battle([MAGE, { ...GOBLIN, position: hex(7, 1) }]), cast('goblin'))
    })

    it('on an ally', () => {
      refused(battle([MAGE, CLERIC, FAR_GOBLIN]), cast('cleric'))
    })

    it('on a fallen foe', () => {
      const engine = battle([MAGE, FAR_GOBLIN, { ...GOBLIN2, position: hex(5, 0) }], KILL)
      engine.step(cast('goblin'))
      refused(engine, cast('goblin'))
      expect(engine.legalActions()).toContainEqual(cast('goblin2'))
    })

    it('from a unit that knows no spell, or not that one', () => {
      refused(battle([{ ...MAGE, stats: WARRIOR_STATS }, FAR_GOBLIN]), cast('goblin'))
      refused(battle([with_({ spells: [] }), FAR_GOBLIN]), cast('goblin'))
    })

    it('out of turn', () => {
      const engine = battle([MAGE, FAR_GOBLIN])
      engine.step(END_TURN)
      refused(engine, cast('goblin'))
    })
  })

  it('previews the odds the cast is then rolled at', () => {
    const engine = battle([MAGE, FAR_GOBLIN], HIT_FOR_7)
    expect(engine.previewCast('mage', 'magic_arrow', 'goblin')).toEqual({
      apCost: 4,
      manaCost: 3,
      outcomes: [{ unit: 'goblin', hitChance: 0.61 }],
    })
    expect(engine.step(cast('goblin'))[0]).toMatchObject({ outcomes: [{ chance: 61 }] })
    // Armour takes the chance down, but never below 5 in 100.
    const armoured = battle([MAGE, { ...FAR_GOBLIN, stats: { ...GOBLIN_STATS, ac: 90 } }])
    expect(armoured.previewCast('mage', 'magic_arrow', 'goblin')?.outcomes[0].hitChance).toBe(0.05)
    // A spell pierces nothing, whatever the caster's weapon does.
    const piercing = battle([{ ...MAGE, stats: { ...MAGE_STATS, armorPierce: 50 } }, FAR_GOBLIN])
    expect(piercing.previewCast('mage', 'magic_arrow', 'goblin')?.outcomes[0].hitChance).toBe(0.61)
  })

  it('keeps the mana left within the maximum of new gear, and adds none', () => {
    const engine = battle([MAGE, FAR_GOBLIN])
    const equip = (magic?: CombatantStats['magic']): Action => ({
      type: 'equip',
      unit: 'mage',
      stats: { ...WARRIOR_STATS, name: 'Mage', ...(magic ? { magic } : {}) },
    })
    engine.step(equip({ ...MAGE_STATS.magic!, maxMana: 24 }))
    expect(unitOf(engine, 'mage').mana).toBe(18)
    engine.step(equip({ ...MAGE_STATS.magic!, maxMana: 12 }))
    expect(unitOf(engine, 'mage').mana).toBe(12)
    engine.step(equip())
    expect(unitOf(engine, 'mage').mana).toBe(0)
    engine.step(equip(MAGE_STATS.magic))
    expect(unitOf(engine, 'mage').mana).toBe(0)
  })

  it('replays exactly from its seed and its actions, casts included', () => {
    const run = () => {
      const engine = new BattleEngine({ board: WIDE, units: [MAGE, CLERIC, FAR_GOBLIN, GOBLIN2] }, { seed: 7 })
      const actions: Action[] = [cast('goblin'), cast('goblin2'), END_TURN, END_TURN, cast('goblin2'), move('mage', hex(2, 1))]
      for (const action of actions) if (engine.getState().phase !== 'over') engine.step(action)
      return engine.getLog()
    }
    expect(run()).toEqual(run())
    expect(run().filter((e) => e.type === 'cast')).toHaveLength(3)
  })
})

describe('BattleEngine spells of every kind', () => {
  const WIDE = { cols: 9, rows: 3 }
  const ALL_SPELLS = [...SPELL_IDS]
  const caster = (spells: SpellId[] = ALL_SPELLS, extra: Partial<UnitSetup> = {}): UnitSetup => ({
    id: 'mage',
    side: 'player',
    stats: { ...WARRIOR_STATS, name: 'Mage', magic: { maxMana: 60, skill: 76, spells } },
    position: hex(1, 1),
    ...extra,
  })
  const goblinAt = (position: Hex, extra: Partial<UnitSetup> = {}): UnitSetup => ({ ...GOBLIN, position, ...extra })
  const allyAt = (position: Hex, extra: Partial<UnitSetup> = {}): UnitSetup => ({ ...CLERIC, position, ...extra })
  const battle = (units: UnitSetup[], rng: number[] = [0.66]) => new BattleEngine({ board: WIDE, units }, { rng: sequence(rng) })
  const at = (spell: SpellId, centre: Hex): Action => ({ type: 'cast', unit: 'mage', spell, at: centre })
  const on = (spell: SpellId, target: string): Action => ({ type: 'cast', unit: 'mage', spell, target })
  const NAMED = { ...NAMES, mage: 'Mage' }
  const statusesOf = (engine: BattleEngine, id: string) => unitOf(engine, id).statuses

  describe('an area spell', () => {
    it('rolls to hit everyone in its area in roster order, allies included, and can hurt both (A4)', () => {
      // A Fireball centred one hex west of the goblin, the cleric beside it: every draw 0.66, a roll of 34 and 4s on the dice.
      const engine = battle([caster(['fireball']), allyAt(hex(5, 0)), goblinAt(hex(5, 1))])
      const events = engine.step(at('fireball', hex(4, 1)))
      expect(events.map((e) => e.type)).toEqual(['cast', 'unit_down', 'battle_end'])
      expect(events[0]).toMatchObject({
        target: null,
        at: hex(4, 1),
        outcomes: [
          { unit: 'cleric', attackRoll: 34, chance: 51, hit: true, damage: 12, hpAfter: 8 },
          { unit: 'goblin', attackRoll: 34, chance: 61, hit: true, damage: 12, hpAfter: 0 },
        ],
      })
      // A spell owes nothing to armour: the goblin's resistance takes nothing off. Fireball sears whoever it leaves standing.
      expect(formatEvent(events[0], NAMED)).toBe('Mage casts Fireball: HITS Cleric for 12 dmg, seared; HITS Goblin for 12 dmg.')
    })

    it('is not legal where its area holds no foe', () => {
      const engine = battle([caster(['fireball']), allyAt(hex(5, 0)), goblinAt(hex(5, 1))])
      const casts = engine.legalActions().filter((a) => a.type === 'cast')
      expect(casts).not.toContainEqual(at('fireball', hex(2, 0)))
      expect(casts).toContainEqual(at('fireball', hex(4, 1)))
      expect(casts.every((a) => 'at' in a)).toBe(true)
      expect(engine.previewCast('mage', 'fireball', hex(2, 0))).toBeNull()
      expect(() => engine.step(at('fireball', hex(2, 0)))).toThrow('cannot cast fireball at')
    })

    it('previews whom it would touch and the odds on each, allies included', () => {
      const engine = battle([caster(['fireball']), allyAt(hex(5, 0)), goblinAt(hex(5, 1))])
      expect(engine.previewCast('mage', 'fireball', hex(4, 1))).toEqual({
        apCost: 6,
        manaCost: 10,
        outcomes: [
          { unit: 'cleric', hitChance: 0.51 },
          { unit: 'goblin', hitChance: 0.61 },
        ],
      })
    })

    it('loses the battle when it fells the last of both sides', () => {
      const engine = battle([caster(['fireball'], { hp: 3 }), goblinAt(hex(2, 1))])
      const events = engine.step(at('fireball', hex(2, 1)))
      expect(events.map((e) => e.type)).toEqual(['cast', 'unit_down', 'unit_down', 'battle_end'])
      expect(engine.getState()).toMatchObject({ phase: 'over', winner: 'enemy' })
    })

    it('of a friendly spell touches only the caster’s side, and is centred on the caster', () => {
      const engine = battle([caster(['bless']), allyAt(hex(2, 1)), goblinAt(hex(3, 1)), allyAt(hex(7, 1), { id: 'far' })])
      expect(nonMoves(engine).filter((a) => a.type === 'cast')).toEqual([at('bless', hex(1, 1))])
      const [event] = engine.step(at('bless', hex(1, 1)))
      expect(event).toMatchObject({ outcomes: [{ unit: 'mage', attackRoll: null, hit: true }, { unit: 'cleric' }] })
      expect(formatEvent(event, NAMED)).toBe('Mage casts Bless: Mage and Cleric are blessed.')
      expect(statusesOf(engine, 'goblin')).toEqual([])
      expect(statusesOf(engine, 'far')).toEqual([])
    })
  })

  describe('a heal', () => {
    it('restores its dice to a wounded ally, never above its maximum, and rolls nothing to hit (A5)', () => {
      const engine = battle([caster(['heal']), allyAt(hex(3, 1), { hp: 3 }), goblinAt(hex(7, 1))])
      const [event] = engine.step(on('heal', 'cleric'))
      expect(event).toMatchObject({ outcomes: [{ unit: 'cleric', attackRoll: null, healed: 8, hpBefore: 3, hpAfter: 11 }] })
      expect(formatEvent(event, NAMED)).toBe('Mage casts Heal on Cleric: +8 (11 hp).')
      const nearlyWhole = battle([caster(['heal']), allyAt(hex(3, 1), { hp: 18 }), goblinAt(hex(7, 1))])
      expect(nearlyWhole.step(on('heal', 'cleric'))[0]).toMatchObject({ outcomes: [{ healed: 2, hpAfter: 20 }] })
    })

    it('is legal on the caster and a standing ally in range, not on a foe or the fallen', () => {
      const engine = battle([caster(['heal']), allyAt(hex(3, 1)), allyAt(hex(2, 0), { id: 'fallen', hp: 0 }), goblinAt(hex(4, 1))])
      expect(nonMoves(engine).filter((a) => a.type === 'cast')).toEqual([on('heal', 'mage'), on('heal', 'cleric')])
    })
  })

  describe('Sleep', () => {
    const asleep = () => {
      const engine = battle([caster(['sleep']), allyAt(hex(4, 1)), goblinAt(hex(5, 1))])
      engine.step(on('sleep', 'goblin'))
      return engine
    }

    it('takes the sleeper’s action points and its zone of control (A6)', () => {
      const engine = asleep()
      expect(statusesOf(engine, 'goblin')).toEqual([{ id: 'asleep', turnsLeft: 2 }])
      expect(unitOf(engine, 'goblin').reactionReady).toBe(false)
      expect(engine.previewMove('cleric', hex(4, 0))?.provokes).toEqual([])
      engine.step(END_TURN)
      expect(unitOf(engine, 'goblin').ap).toBe(0)
      expect(engine.legalActions()).toEqual([END_TURN])
    })

    it('makes the sleeper helpless, and any damage wakes it', () => {
      const engine = asleep()
      expect(engine.previewAttack('cleric', 'goblin')?.hitChance).toBe(0.8)
      const events = engine.step({ type: 'attack', unit: 'cleric', target: 'goblin' })
      expect(events.map((e) => e.type)).toEqual(['attack', 'status_end'])
      expect(events[0]).toMatchObject({ helpless: true, chance: 80, rolled: 8, damage: 7 })
      expect(events[1]).toMatchObject({ unit: 'goblin', status: 'asleep', reason: 'woke' })
      expect(formatEvent(events[1], NAMED)).toBe('Goblin wakes.')
    })

    it('wears off after two of the sleeper’s turns', () => {
      const engine = asleep()
      engine.step(END_TURN)
      expect(engine.step(END_TURN).map((e) => e.type)).toEqual(['end_turn'])
      engine.step(END_TURN)
      expect(unitOf(engine, 'goblin').ap).toBe(0)
      const events = engine.step(END_TURN)
      expect(events.map((e) => e.type)).toEqual(['status_end', 'end_turn'])
      expect(events[0]).toMatchObject({ unit: 'goblin', status: 'asleep', reason: 'expired' })
      engine.step(END_TURN)
      expect(unitOf(engine, 'goblin').ap).toBe(GOBLIN_STATS.actionPoints)
    })
  })

  it('poisons at the start of each of the poisoned unit’s turns, and can fell it then (A7)', () => {
    const engine = battle([caster(['death_cloud']), goblinAt(hex(5, 1))])
    engine.step(at('death_cloud', hex(5, 1)))
    expect(statusesOf(engine, 'goblin')).toEqual([{ id: 'poisoned', turnsLeft: 3 }])
    const first = engine.step(END_TURN)
    expect(first.map((e) => e.type)).toEqual(['end_turn', 'status_tick'])
    expect(first[1]).toMatchObject({ unit: 'goblin', status: 'poisoned', damage: 4, hpBefore: 12, hpAfter: 8 })
    expect(formatEvent(first[1], NAMED)).toBe('Goblin takes 4 from poison.')
    engine.step(END_TURN)
    engine.step(END_TURN)
    engine.step(END_TURN)
    const third = engine.step(END_TURN)
    expect(third.map((e) => e.type)).toEqual(['end_turn', 'status_tick', 'unit_down', 'battle_end'])
    expect(engine.getState()).toMatchObject({ phase: 'over', winner: 'player' })
  })

  describe('regeneration', () => {
    const troll = (extra: Partial<CombatantStats> = {}, hp?: number) =>
      goblinAt(hex(5, 1), { stats: { ...GOBLIN_STATS, maxHp: 30, regeneration: 3, ...extra }, hp })

    it('heals a regenerating unit as its side’s turn begins, never past its maximum', () => {
      const engine = battle([caster(['magic_arrow']), troll({}, 28)])
      const events = engine.step(END_TURN)
      expect(events.map((e) => e.type)).toEqual(['end_turn', 'regenerate'])
      expect(events[1]).toMatchObject({ unit: 'goblin', healed: 2, hpBefore: 28, hpAfter: 30 })
      expect(formatEvent(events[1], NAMED)).toBe('Goblin regenerates 2.')
      engine.step(END_TURN)
      expect(engine.step(END_TURN).map((e) => e.type)).toEqual(['end_turn'])
    })

    it('is stopped by acid while it lasts', () => {
      // A roll of 34 hits; a 6 on the d8, then 3 of acid as the goblin's turn begins.
      const engine = battle([caster(['acid_arrow']), troll()])
      engine.step(on('acid_arrow', 'goblin'))
      expect(unitOf(engine, 'goblin').hp).toBe(24)
      expect(engine.step(END_TURN).map((e) => e.type)).toEqual(['end_turn', 'status_tick'])
      expect(unitOf(engine, 'goblin').hp).toBe(21)
    })

    it('is stopped by fire for the turn after', () => {
      const engine = battle([caster(['fireball']), troll()])
      engine.step(at('fireball', hex(5, 1)))
      expect(statusesOf(engine, 'goblin')).toEqual([{ id: 'seared', turnsLeft: 1 }])
      expect(engine.step(END_TURN).map((e) => e.type)).toEqual(['end_turn'])
      expect(engine.step(END_TURN).map((e) => e.type)).toEqual(['status_end', 'end_turn'])
      expect(engine.step(END_TURN).map((e) => e.type)).toEqual(['end_turn', 'regenerate'])
    })

    it('takes 2 points of resistance off while acid lasts', () => {
      const quick = { ...WARRIOR_STATS, name: 'Mage', attackApCost: 2, magic: { maxMana: 60, skill: 76, spells: ['acid_arrow' as const] } }
      const engine = battle([caster(['acid_arrow'], { position: hex(4, 1), stats: quick }), troll({ resistance: 5 })])
      expect(engine.previewAttack('mage', 'goblin')?.resistance).toBe(5)
      engine.step(on('acid_arrow', 'goblin'))
      expect(engine.previewAttack('mage', 'goblin')?.resistance).toBe(3)
    })
  })

  it('lets mirror images take three hits, drawing no damage dice for them, and the fourth hurt (A8)', () => {
    const quick = { ...GOBLIN_STATS, attackApCost: 2 }
    // Five draws: four rolls of 34, all within the goblin's 45%, then a 1 on its damage die.
    const engine = battle([caster(['mirror_image']), goblinAt(hex(2, 1), { stats: quick })], [0.66, 0.66, 0.66, 0.66, 0])
    engine.step(on('mirror_image', 'mage'))
    expect(statusesOf(engine, 'mage')).toEqual([{ id: 'mirrored', turnsLeft: 3, images: 3 }])
    engine.step(END_TURN)
    const strike = () => engine.step({ type: 'attack', unit: 'goblin', target: 'mage' })
    expect(strike()).toMatchObject([{ hit: true, image: true, damage: 0 }])
    expect(formatEvent(strike()[0], NAMED)).toContain('strikes an image of Mage')
    const third = strike()
    expect(third.map((e) => e.type)).toEqual(['attack', 'status_end'])
    expect(third[1]).toMatchObject({ status: 'mirrored', reason: 'spent' })
    expect(strike()).toMatchObject([{ hit: true, image: false, damage: 2, defenderHpAfter: 18 }])
  })

  it('counts a status laid on its unit’s own turn as its first, and refreshes it rather than stacking', () => {
    const engine = battle([caster(['bless', 'shield']), goblinAt(hex(7, 1))])
    engine.step(at('bless', hex(1, 1)))
    engine.step(on('shield', 'mage'))
    expect(statusesOf(engine, 'mage')).toEqual([
      { id: 'blessed', turnsLeft: 3 },
      { id: 'shielded', turnsLeft: 3 },
    ])
    expect(unitOf(engine, 'mage').ac).toBe(WARRIOR_STATS.ac)
    expect(engine.previewAttack('goblin', 'mage')).toBeNull()
    engine.step(END_TURN)
    engine.step(END_TURN)
    expect(statusesOf(engine, 'mage').map((s) => s.turnsLeft)).toEqual([2, 2])
    engine.step(at('bless', hex(1, 1)))
    expect(statusesOf(engine, 'mage').map((s) => s.turnsLeft)).toEqual([3, 2])
    engine.step(END_TURN)
    engine.step(END_TURN)
    const events = engine.step(END_TURN)
    expect(events.filter((e) => e.type === 'status_end')).toMatchObject([{ status: 'shielded', reason: 'expired' }])
    expect(formatEvent(events[0], NAMED)).toBe('Mage is no longer shielded.')
  })

  it('adds a status’s armour and chance to hit where both are rolled', () => {
    const engine = battle([caster(['shield', 'bless']), goblinAt(hex(2, 1))])
    engine.step(on('shield', 'mage'))
    engine.step(at('bless', hex(1, 1)))
    // The goblin's 70 against 25 armour and 15 more, from the front.
    engine.step(END_TURN)
    expect(engine.previewAttack('goblin', 'mage')?.hitChance).toBe(0.3)
    engine.step(END_TURN)
    // The mage's 75 and 10 against the goblin's 15.
    expect(engine.previewAttack('mage', 'goblin')?.hitChance).toBe(0.7)
  })

  it('changes action points at once on the unit’s own turn, and at the start of each of its turns', () => {
    const engine = battle([caster(['haste']), allyAt(hex(2, 1)), goblinAt(hex(7, 1))])
    engine.step(on('haste', 'cleric'))
    expect(unitOf(engine, 'cleric').ap).toBe(11)
    engine.step(END_TURN)
    engine.step(END_TURN)
    expect(unitOf(engine, 'cleric').ap).toBe(11)
    engine.step(END_TURN)
    engine.step(END_TURN)
    expect(unitOf(engine, 'cleric').ap).toBe(8)
  })

  it('chills its own side in a Frost Blast at once', () => {
    const engine = battle([caster(['frost_blast']), allyAt(hex(4, 1)), goblinAt(hex(5, 1))])
    engine.step(at('frost_blast', hex(5, 1)))
    expect(unitOf(engine, 'cleric')).toMatchObject({ ap: 5, statuses: [{ id: 'chilled', turnsLeft: 1 }] })
  })

  it('lays no status on a unit it fells, and a fallen unit loses its statuses', () => {
    const engine = battle([caster(['acid_arrow']), goblinAt(hex(5, 1), { hp: 2 })])
    const [event] = engine.step(on('acid_arrow', 'goblin'))
    expect(event).toMatchObject({ outcomes: [{ hpAfter: 0, status: null }] })
  })

  it('replays exactly, and plays on identically from a snapshot taken with statuses in force (A9)', () => {
    const tireless = caster()
    const units = [{ ...tireless, stats: { ...tireless.stats, actionPoints: 20 } }, allyAt(hex(2, 1)), goblinAt(hex(6, 1)), { ...GOBLIN2, position: hex(6, 0) }]
    const run = (snapAt: number | null) => {
      let engine = new BattleEngine({ board: WIDE, units }, { seed: 9 })
      const actions: Action[] = [on('sleep', 'goblin2'), at('death_cloud', hex(6, 1)), at('bless', hex(1, 1)), END_TURN, END_TURN]
      actions.forEach((action, i) => {
        if (i === snapAt) engine = BattleEngine.restore(JSON.parse(JSON.stringify(engine.snapshot())))
        if (engine.getState().phase !== 'over') engine.step(action)
      })
      const policy = mulberry32(1)
      for (let state = engine.getState(); state.phase !== 'over'; state = engine.getState()) {
        engine.step(POLICIES.aggressive({ state, legal: engine.legalActions(), rng: policy }))
      }
      return engine.getLog()
    }
    const log = run(null)
    expect(log.some((e) => e.type === 'status_tick')).toBe(true)
    expect(run(null)).toEqual(log)
    expect(run(3)).toEqual(log)
  })
})

describe('BattleEngine elements, wards and monster spells', () => {
  const WIDE = { cols: 9, rows: 3 }
  const caster = (spells: SpellId[], extra: Partial<UnitSetup> = {}): UnitSetup => ({
    id: 'mage',
    side: 'player',
    stats: { ...WARRIOR_STATS, name: 'Mage', magic: { maxMana: 60, skill: 76, spells } },
    position: hex(1, 1),
    ...extra,
  })
  const goblinAt = (position: Hex, extra: Partial<UnitSetup> = {}): UnitSetup => ({ ...GOBLIN, position, ...extra })
  const wardedGoblin = (position: Hex, wards: CombatantStats['wards'], extra: Partial<UnitSetup> = {}): UnitSetup =>
    goblinAt(position, { stats: { ...GOBLIN_STATS, wards }, ...extra })
  const allyAt = (position: Hex, extra: Partial<UnitSetup> = {}): UnitSetup => ({ ...CLERIC, position, ...extra })
  /** Every draw 0.66 unless told otherwise: a roll of 34, a 4 on a d6, a 6 on a d8. */
  const battle = (units: UnitSetup[], rng: number[] = [0.66]) => new BattleEngine({ board: WIDE, units }, { rng: sequence(rng) })
  const at = (spell: SpellId, centre: Hex): Action => ({ type: 'cast', unit: 'mage', spell, at: centre })
  const on = (spell: SpellId, target: string): Action => ({ type: 'cast', unit: 'mage', spell, target })
  const NAMED = { ...NAMES, mage: 'Mage' }

  describe('a ward', () => {
    it('takes its points off a hit of its element, recording what it stopped', () => {
      const engine = battle([caster(['flame_arrow']), wardedGoblin(hex(5, 1), { fire: 4 })])
      const [event] = engine.step(on('flame_arrow', 'goblin'))
      // 2d8, two 6s: 12, less 4.
      expect(event).toMatchObject({ drained: 0, outcomes: [{ hit: true, damage: 8, warded: 4, hpAfter: 4, status: { id: 'seared' } }] })
      expect(formatEvent(event, NAMED)).toBe(
        'Mage casts Flame Arrow on Goblin: rolls 34 (needs 61 or less) — HITS Goblin for 8 dmg (warded 4), seared.',
      )
    })

    it('stands against a critical hit after the dice are doubled', () => {
      const engine = battle([caster(['flame_arrow']), wardedGoblin(hex(5, 1), { fire: 20 }, { stats: { ...GOBLIN_STATS, maxHp: 40, wards: { fire: 20 } } })], [0.95, 0.66])
      const [event] = engine.step(on('flame_arrow', 'goblin'))
      // 4d8 of 6s: 24, less 20.
      expect(event).toMatchObject({ outcomes: [{ critical: true, damage: 4, warded: 20 }] })
    })

    it('stops a whole Fireball, and Seared is laid all the same', () => {
      const engine = battle([caster(['fireball']), wardedGoblin(hex(5, 1), { fire: 99 })])
      const [event] = engine.step(at('fireball', hex(5, 1)))
      expect(event).toMatchObject({ outcomes: [{ hit: true, damage: 0, warded: 12, hpBefore: 12, hpAfter: 12, status: { id: 'seared' } }] })
      expect(unitOf(engine, 'goblin').statuses).toEqual([{ id: 'seared', turnsLeft: 1 }])
      expect(formatEvent(event, NAMED)).toBe('Mage casts Fireball: HITS Goblin for 0 dmg (warded 12), seared.')
    })

    it('leaves a spell of another element, or of none, as it was', () => {
      const frost = battle([caster(['frost_blast']), wardedGoblin(hex(5, 1), { fire: 99 })]).step(at('frost_blast', hex(5, 1)))
      expect(frost[0]).toMatchObject({ outcomes: [{ damage: 6, warded: 0 }] })
      const arrow = battle([caster(['magic_arrow']), wardedGoblin(hex(5, 1), { fire: 99, poison: 99 })]).step(on('magic_arrow', 'goblin'))
      expect(arrow[0]).toMatchObject({ outcomes: [{ damage: 7, warded: 0 }] })
      expect(formatEvent(arrow[0], NAMED)).toBe('Mage casts Magic Arrow on Goblin: rolls 34 (needs 61 or less) — HITS Goblin for 7 dmg.')
    })

    it('takes its points off each tick of a status of its element', () => {
      const engine = battle([caster(['death_cloud']), wardedGoblin(hex(5, 1), { poison: 3 })])
      engine.step(at('death_cloud', hex(5, 1)))
      const [, tick] = engine.step(END_TURN)
      // A 4 on the d6, less 3.
      expect(tick).toMatchObject({ type: 'status_tick', status: 'poisoned', damage: 1, warded: 3, hpBefore: 12, hpAfter: 11 })
      expect(formatEvent(tick, NAMED)).toBe('Goblin takes 1 from poison (warded 3).')
    })

    it('records no ward on an unwarded tick, and its line is as it was', () => {
      const engine = battle([caster(['death_cloud']), goblinAt(hex(5, 1))])
      engine.step(at('death_cloud', hex(5, 1)))
      const [, tick] = engine.step(END_TURN)
      expect(tick).toMatchObject({ damage: 4, warded: 0 })
      expect(formatEvent(tick, NAMED)).toBe('Goblin takes 4 from poison.')
    })

    it('lets a sleeper sleep on through a tick it stops whole', () => {
      const mage = caster(['sleep', 'death_cloud'])
      const engine = battle([{ ...mage, stats: { ...mage.stats, actionPoints: 20 } }, wardedGoblin(hex(5, 1), { poison: 6 }), { ...GOBLIN2, position: hex(8, 0) }])
      engine.step(on('sleep', 'goblin'))
      engine.step(at('death_cloud', hex(5, 1)))
      const events = engine.step(END_TURN)
      expect(events.map((e) => e.type)).toEqual(['end_turn', 'status_tick'])
      expect(events[1]).toMatchObject({ damage: 0, warded: 4, hpAfter: 12 })
      expect(unitOf(engine, 'goblin').statuses.map((s) => s.id)).toContain('asleep')
    })
  })

  describe('Drain Life', () => {
    // A roll of 34, then three 2s on the d6: 6 damage.
    const DRAIN_6 = [0.66, 0.3]

    it('heals its caster by half the damage dealt, rounded down', () => {
      const engine = battle([caster(['drain_life'], { hp: 10 }), goblinAt(hex(5, 1))], DRAIN_6)
      const [event] = engine.step(on('drain_life', 'goblin'))
      expect(event).toMatchObject({ drained: 3, outcomes: [{ damage: 6, hpAfter: 6 }] })
      expect(unitOf(engine, 'mage').hp).toBe(13)
      expect(formatEvent(event, NAMED)).toBe('Mage casts Drain Life on Goblin: rolls 34 (needs 61 or less) — HITS Goblin for 6 dmg and drains 3.')
    })

    it('heals no more than its caster had lost', () => {
      const engine = battle([caster(['drain_life'], { hp: 19 }), goblinAt(hex(5, 1))], DRAIN_6)
      expect(engine.step(on('drain_life', 'goblin'))[0]).toMatchObject({ drained: 1 })
      expect(unitOf(engine, 'mage').hp).toBe(20)
      const whole = battle([caster(['drain_life']), goblinAt(hex(5, 1))], DRAIN_6)
      const [event] = whole.step(on('drain_life', 'goblin'))
      expect(event).toMatchObject({ drained: 0 })
      expect(formatEvent(event, NAMED)).toBe('Mage casts Drain Life on Goblin: rolls 34 (needs 61 or less) — HITS Goblin for 6 dmg.')
    })

    it('drains only the hit points its target had left', () => {
      const engine = battle([caster(['drain_life'], { hp: 10 }), goblinAt(hex(5, 1), { hp: 2 })], DRAIN_6)
      expect(engine.step(on('drain_life', 'goblin'))[0]).toMatchObject({ drained: 1, outcomes: [{ damage: 6, hpAfter: 0 }] })
      expect(unitOf(engine, 'mage').hp).toBe(11)
    })

    it('drains nothing on a miss', () => {
      const engine = battle([caster(['drain_life'], { hp: 10 }), goblinAt(hex(5, 1))], [0.3])
      expect(engine.step(on('drain_life', 'goblin'))[0]).toMatchObject({ drained: 0, outcomes: [{ hit: false }] })
      expect(unitOf(engine, 'mage').hp).toBe(10)
    })
  })

  it('Web lays Webbed, and the webbed unit has 4 AP fewer on its next turn', () => {
    const engine = battle([caster(['web']), goblinAt(hex(5, 1))])
    const [event] = engine.step(at('web', hex(5, 1)))
    expect(event).toMatchObject({ outcomes: [{ unit: 'goblin', hit: true, damage: 0, warded: 0, status: { id: 'webbed', turnsLeft: 2 } }] })
    expect(formatEvent(event, NAMED)).toBe('Mage casts Web: Goblin is webbed.')
    engine.step(END_TURN)
    expect(unitOf(engine, 'goblin').ap).toBe(GOBLIN_STATS.actionPoints - 4)
  })

  it('Curse takes 15 off the chance to hit and 5 off armour class', () => {
    const engine = battle([caster(['curse']), goblinAt(hex(5, 1))])
    engine.step(on('curse', 'goblin'))
    const goblin = unitOf(engine, 'goblin')
    expect(goblin.statuses).toEqual([{ id: 'cursed', turnsLeft: 3 }])
    expect(effectiveStats({ stats: goblin, statuses: goblin.statuses })).toMatchObject({ toHit: GOBLIN_STATS.toHit - 15, ac: GOBLIN_STATS.ac - 5 })
  })

  it('Dark Shield lays Shielded on its caster', () => {
    const engine = battle([caster(['dark_shield']), goblinAt(hex(5, 1))])
    expect(nonMoves(engine).filter((a) => a.type === 'cast')).toEqual([on('dark_shield', 'mage')])
    const [event] = engine.step(on('dark_shield', 'mage'))
    expect(event).toMatchObject({ drained: 0, outcomes: [{ unit: 'mage', warded: 0, status: { id: 'shielded', turnsLeft: 3 } }] })
    expect(formatEvent(event, NAMED)).toBe('Mage casts Dark Shield: Mage is shielded.')
  })

  describe('Lightning Bolt', () => {
    const units = () => [caster(['lightning_bolt']), allyAt(hex(3, 1)), goblinAt(hex(5, 1)), { ...GOBLIN2, position: hex(8, 0) }]

    it('strikes everyone in a line six hexes long, both sides', () => {
      const engine = battle(units())
      const [event] = engine.step(at('lightning_bolt', hex(2, 1)))
      // 4d6 of 4s: 16 to each.
      expect(event).toMatchObject({
        target: null,
        at: hex(2, 1),
        outcomes: [
          { unit: 'cleric', hit: true, damage: 16, warded: 0, hpAfter: 4 },
          { unit: 'goblin', hit: true, damage: 16, warded: 0, hpAfter: 0 },
        ],
      })
      expect(formatEvent(event, NAMED)).toBe('Mage casts Lightning Bolt: HITS Cleric for 16 dmg; HITS Goblin for 16 dmg.')
    })

    it('is aimed 1 to 6 hexes from its caster, never at the caster’s own hex', () => {
      const engine = battle(units())
      const aims = engine
        .legalActions('mage')
        .filter((a) => a.type === 'cast' && a.spell === 'lightning_bolt')
        .map((a) => ('at' in a ? a.at : null)!)
      expect(aims).toContainEqual(hex(2, 1))
      expect(aims).toContainEqual(hex(7, 1))
      expect(aims).not.toContainEqual(hex(1, 1))
      expect(aims.map((h) => hexDistance(hex(1, 1), h)).every((d) => d >= 1 && d <= 6)).toBe(true)
      expect(aims).not.toContainEqual(hex(8, 1))
      expect(engine.previewCast('mage', 'lightning_bolt', hex(1, 1))).toBeNull()
      expect(() => engine.step(at('lightning_bolt', hex(1, 1)))).toThrow('cannot cast lightning_bolt at')
      expect(() => engine.step(at('lightning_bolt', hex(8, 1)))).toThrow('cannot cast lightning_bolt at')
    })

    it('a ward against lightning stands against it', () => {
      const engine = battle([caster(['lightning_bolt']), wardedGoblin(hex(5, 1), { lightning: 10 }), { ...GOBLIN2, position: hex(8, 0) }])
      const [event] = engine.step(at('lightning_bolt', hex(2, 1)))
      expect(event).toMatchObject({ outcomes: [{ unit: 'goblin', damage: 6, warded: 10 }] })
      expect(formatEvent(event, NAMED)).toBe('Mage casts Lightning Bolt: HITS Goblin for 6 dmg (warded 10).')
    })
  })
})

describe('BattleEngine snapshots', () => {
  const FIELD = { board: { cols: 8, rows: 5 }, units: [WARRIOR, CLERIC, { ...GOBLIN, position: hex(6, 1) }, { ...GOBLIN2, position: hex(6, 3) }] }

  /** Plays the battle out with the aggressive policy on both sides, from wherever the engine stands. */
  const playOut = (engine: BattleEngine, policyRng: () => number): readonly BattleEvent[] => {
    for (let state = engine.getState(); state.phase !== 'over'; state = engine.getState()) {
      engine.step(POLICIES.aggressive({ state, legal: engine.legalActions(), rng: policyRng }))
    }
    return engine.getLog()
  }

  it('plays on from a snapshot exactly as the engine it was taken of, through JSON', () => {
    for (const stepsBefore of [0, 3, 9]) {
      const straight = new BattleEngine(FIELD, { seed: 11 })
      const saved = new BattleEngine(FIELD, { seed: 11 })
      const policy = { straight: mulberry32(5), saved: mulberry32(5) }
      for (let i = 0; i < stepsBefore; i++) {
        for (const [engine, rng] of [[straight, policy.straight], [saved, policy.saved]] as const) {
          engine.step(POLICIES.aggressive({ state: engine.getState(), legal: engine.legalActions(), rng }))
        }
      }
      const json = JSON.stringify({ engine: saved.snapshot(), policy: policy.saved.state() })
      const { engine, policy: policyState } = JSON.parse(json)
      const restored = BattleEngine.restore(engine)
      expect(restored.getState()).toEqual(straight.getState())
      expect(restored.legalActions()).toEqual(straight.legalActions())
      const log = playOut(restored, mulberry32(policyState))
      expect(log).toEqual(playOut(straight, policy.straight))
      expect(log.at(-1)?.type).toBe('battle_end')
      expect(log.map((e) => e.seq)).toEqual(log.map((_, i) => i))
    }
  })

  it('records no second battle_start and starts no turn over', () => {
    const engine = new BattleEngine(DUEL, { seed: 3 })
    engine.step({ type: 'move', unit: 'warrior', to: hex(0, 1) })
    const restored = BattleEngine.restore(engine.snapshot())
    expect(restored.getLog()).toEqual(engine.getLog())
    expect(restored.getLog().filter((e) => e.type === 'battle_start')).toHaveLength(1)
    expect(restored.getState()).toEqual(engine.getState())
    expect(restored.getState().units.find((u) => u.id === 'warrior')?.ap).toBe(WARRIOR_STATS.actionPoints - 1)
  })

  it('shares nothing with the engine it was taken of', () => {
    const engine = new BattleEngine(DUEL, { seed: 3 })
    const snapshot = engine.snapshot()
    engine.step({ type: 'move', unit: 'warrior', to: hex(0, 1) })
    expect(snapshot.events).toHaveLength(1)
    expect(snapshot.units[0].position).toEqual(hex(1, 1))
    const restored = BattleEngine.restore(snapshot)
    restored.step(END_TURN)
    expect(snapshot.phase).toBe('player')
  })

  it('cannot be taken of an engine given its own rng', () => {
    expect(() => new BattleEngine(DUEL, { rng: sequence([0.5]) }).snapshot()).toThrow('cannot be snapshotted')
  })
})

describe('areaTouches', () => {
  const unit = (id: string, side: 'player' | 'enemy', q: number, r: number, hp = 5) => ({
    id,
    side,
    hp,
    position: hex(q, r),
  })
  const caster = unit('caster', 'player', 0, 0)
  const units = [
    unit('far', 'enemy', 5, 0),
    caster,
    unit('ally', 'player', 2, 0),
    unit('foe', 'enemy', 1, 1),
    unit('dead', 'enemy', 1, 0, 0),
    unit('off', 'enemy', 0, 3),
  ]
  const ids = (touched: { id: string }[]) => touched.map((u) => u.id)

  it('touches the standing units on a cone, both sides when hostile, in roster order', () => {
    const cone = { shape: 'cone', range: 2 } as const
    expect(ids(areaTouches(units, caster, cone, hex(1, 0), true))).toEqual(['ally', 'foe'])
    expect(ids(areaTouches(units, caster, { shape: 'cone', range: 6 }, hex(1, 0), true))).toEqual(['far', 'ally', 'foe'])
  })

  it('touches the standing units on a line, the caster excluded', () => {
    const line = { shape: 'line', range: 5 } as const
    expect(ids(areaTouches(units, caster, line, hex(1, 0), true))).toEqual(['far', 'ally'])
  })

  it('touches only the caster\'s side when not hostile', () => {
    const line = { shape: 'line', range: 5 } as const
    expect(ids(areaTouches(units, caster, line, hex(1, 0), false))).toEqual(['ally'])
    expect(ids(areaTouches(units, caster, { shape: 'burst', range: 4, radius: 2 }, hex(1, 0), false))).toEqual([
      'caster',
      'ally',
    ])
  })

  it('touches a burst\'s units within the radius of the aim', () => {
    expect(ids(areaTouches(units, caster, { shape: 'burst', range: 4, radius: 1 }, hex(1, 0), true))).toEqual([
      'caster',
      'ally',
      'foe',
    ])
  })
})

describe('BattleEngine strike routines and recharge', () => {
  const WIDE = { cols: 9, rows: 3 }
  const TROLL: UnitSetup = { id: 'troll', side: 'enemy', stats: TROLL_STATS, position: hex(2, 1) }
  const SPIDER_STATS: CombatantStats = { ...GOBLIN_STATS, name: 'Spider', attackApCost: 4, abilities: ['spider_bite'] }
  const SPIDER: UnitSetup = { id: 'spider', side: 'enemy', stats: SPIDER_STATS, position: hex(2, 1) }
  const playerAt = (id: string, position: Hex, extra: Partial<UnitSetup> = {}): UnitSetup => ({ ...WARRIOR, id, position, ...extra })
  /** Every draw 0.66 unless told otherwise: a roll of 34, a 3 on a d4, a 4 on a d6. Starts on the enemy's turn. */
  const enemyTurn = (units: UnitSetup[], rng: number[] = [0.66]) => {
    const engine = new BattleEngine({ board: WIDE, units }, { rng: sequence(rng) })
    engine.step(END_TURN)
    return engine
  }
  const claws = (target: string, unit = 'troll'): Action => ({ type: 'ability', unit, ability: 'troll_claws', target })
  const bite = (target: string): Action => ({ type: 'ability', unit: 'spider', ability: 'spider_bite', target })
  const NAMED = { ...NAMES, troll: 'Troll', spider: 'Spider', zed: 'Zed' }

  it('raises the log schema to 24 (stage 6 step 09, battle_start meta party and role; 23 was stage 4 step 05, AttackEvent.bonus)', () => {
    expect(LOG_SCHEMA_VERSION).toBe(24)
  })

  it('makes one attack per strike, the first carrying the ability’s AP and the rest none', () => {
    const engine = enemyTurn([WARRIOR, TROLL])
    const events = engine.step(claws('warrior'))
    expect(events.map((e) => e.type)).toEqual(['attack', 'attack'])
    // A roll of 34 within the Troll's 40% against the Warrior; a 3 on the d4, +2.
    const strike = { attacker: 'troll', defender: 'warrior', ability: 'troll_claws', strike: 'Claw', opportunity: false, weapon: 'Claws', melee: true }
    expect(events[0]).toMatchObject({ ...strike, apCost: 8, apAfter: 0, hit: true, damageDice: TROLL_STATS.damage, rolled: 5, damage: 5, defenderHpAfter: 15 })
    expect(events[1]).toMatchObject({ ...strike, apCost: 0, apAfter: 0, hit: true, rolled: 5, damage: 5, defenderHpAfter: 10 })
    expect(events[0]).not.toHaveProperty('status')
    expect(unitOf(engine, 'troll').ap).toBe(0)
  })

  it('adds the unit’s ability damage bonus to each strike’s dice', () => {
    const engine = enemyTurn([WARRIOR, { ...TROLL, stats: { ...TROLL_STATS, abilityDamageBonus: 2 } }])
    const events = engine.step(claws('warrior')) as AttackEvent[]
    expect(events.map((e) => [e.damageDice, e.rolled])).toEqual([
      [{ count: 1, sides: 4, bonus: 4 }, 7],
      [{ count: 1, sides: 4, bonus: 4 }, 7],
    ])
  })

  it('leaves a plain attack and a free attack without the strike fields', () => {
    const engine = enemyTurn([WARRIOR, TROLL])
    const [event] = engine.step({ type: 'attack', unit: 'troll', target: 'warrior' })
    expect(Object.keys(event)).not.toEqual(expect.arrayContaining(['ability']))
    expect(event).not.toHaveProperty('strike')
    expect(event).not.toHaveProperty('status')
  })

  it('names the strike’s verb in the log line', () => {
    const engine = enemyTurn([WARRIOR, TROLL])
    const [first] = engine.step(claws('warrior'))
    expect(formatEvent(first, NAMED)).toBe('Troll claws Warrior: rolls 34 (needs 40 or less) — HITS Warrior for 5 dmg.')
  })

  it('lays the Venom Bite’s poison on a hit that leaves the target standing, and records it', () => {
    const engine = enemyTurn([WARRIOR, SPIDER])
    const events = engine.step(bite('warrior')) as AttackEvent[]
    expect(events.map((e) => [e.strike, e.damage, e.status])).toEqual([
      ['Bite', 6, undefined],
      ['Venom Bite', 6, { id: 'poisoned', turnsLeft: 3 }],
    ])
    expect(unitOf(engine, 'warrior').statuses).toEqual([{ id: 'poisoned', turnsLeft: 3 }])
    expect(formatEvent(events[1], NAMED)).toBe('Spider bites Warrior: rolls 34 (needs 45 or less) — HITS Warrior for 6 dmg, poisoned.')
  })

  it('lays no poison on a miss, nor on a bite that fells the target', () => {
    // The second roll is a 100.
    const missed = enemyTurn([WARRIOR, SPIDER], [0.66, 0.66, 0])
    const events = missed.step(bite('warrior')) as AttackEvent[]
    expect(events[1]).toMatchObject({ strike: 'Venom Bite', hit: false })
    expect(events[1]).not.toHaveProperty('status')
    expect(unitOf(missed, 'warrior').statuses).toEqual([])

    const felled = enemyTurn([playerAt('warrior', hex(1, 1), { hp: 8 }), playerAt('cleric', hex(7, 1)), SPIDER])
    const fell = felled.step(bite('warrior'))
    expect(fell.map((e) => e.type)).toEqual(['attack', 'attack', 'unit_down'])
    expect(fell[1]).not.toHaveProperty('status')
  })

  it('turns a strike whose target has fallen on the nearest standing foe in reach, the lowest id on a tie', () => {
    // Zed stands before the cleric in the roster; both are beside the Troll.
    const engine = enemyTurn([playerAt('warrior', hex(1, 1), { hp: 3 }), playerAt('zed', hex(3, 1)), playerAt('cleric', hex(2, 2)), TROLL])
    const events = engine.step(claws('warrior'))
    expect(events.map((e) => e.type)).toEqual(['attack', 'unit_down', 'attack'])
    expect(events[2]).toMatchObject({ defender: 'cleric', strike: 'Claw', apCost: 0 })
  })

  it('turns a ranged routine on the nearest foe before a lower id further off', () => {
    const reaching = { ...TROLL, stats: { ...TROLL_STATS, attackRange: 3 } }
    const engine = enemyTurn([playerAt('warrior', hex(3, 1), { hp: 3 }), playerAt('cleric', hex(5, 1)), playerAt('zed', hex(4, 1)), reaching])
    const events = engine.step(claws('warrior'))
    expect(events.map((e) => e.type)).toEqual(['attack', 'unit_down', 'attack'])
    expect(events[2]).toMatchObject({ defender: 'zed' })
  })

  it('makes no further strike, and logs nothing for it, with no foe left in reach', () => {
    const engine = enemyTurn([playerAt('warrior', hex(1, 1), { hp: 3 }), playerAt('cleric', hex(7, 1)), TROLL])
    expect(engine.step(claws('warrior')).map((e) => e.type)).toEqual(['attack', 'unit_down'])
    expect(engine.getState().phase).toBe('enemy')
  })

  it('stops a routine when the battle ends', () => {
    const engine = enemyTurn([playerAt('warrior', hex(1, 1), { hp: 3 }), TROLL])
    expect(engine.step(claws('warrior')).map((e) => e.type)).toEqual(['attack', 'unit_down', 'battle_end'])
  })

  it('lets the first melee strike on a side turn the defender, and the second find it turned', () => {
    // The Warrior faces east; the Troll comes at its back from the west.
    const engine = enemyTurn([WARRIOR, { ...TROLL, position: hex(0, 1) }])
    const events = engine.step(claws('warrior')) as AttackEvent[]
    expect(events.map((e) => [e.defenderTurned, e.arc])).toEqual([
      [true, 'front'],
      [false, 'front'],
    ])
    expect(unitOf(engine, 'warrior').turnReady).toBe(false)
  })

  it('lists a routine at each foe in reach after the unit’s casts, and not without the AP', () => {
    const caster = { ...TROLL, stats: { ...TROLL_STATS, magic: { maxMana: 10, skill: 60, spells: ['magic_arrow' as const] } } }
    const engine = enemyTurn([WARRIOR, playerAt('cleric', hex(2, 2)), playerAt('zed', hex(8, 1)), caster])
    expect(nonMoves(engine, 'troll')).toEqual([
      { type: 'attack', unit: 'troll', target: 'warrior' },
      { type: 'attack', unit: 'troll', target: 'cleric' },
      { type: 'cast', unit: 'troll', spell: 'magic_arrow', target: 'warrior' },
      { type: 'cast', unit: 'troll', spell: 'magic_arrow', target: 'cleric' },
      claws('warrior'),
      claws('cleric'),
      END_TURN,
    ])
    engine.step({ type: 'attack', unit: 'troll', target: 'warrior' })
    expect(nonMoves(engine, 'troll').filter((a) => a.type === 'ability')).toEqual([])
    expect(() => engine.step(claws('warrior'))).toThrow('troll cannot use troll_claws on warrior')
  })

  it('refuses a routine at a foe out of reach, or by a unit without the ability', () => {
    const engine = enemyTurn([WARRIOR, playerAt('zed', hex(7, 1)), TROLL, { ...GOBLIN, position: hex(1, 0) }])
    expect(() => engine.step(claws('zed'))).toThrow('troll cannot use troll_claws on zed')
    expect(() => engine.step(claws('warrior', 'goblin'))).toThrow('goblin cannot use troll_claws on warrior')
  })

  it('keeps an ability of no recharge listed while the AP allow, and records nothing recharging', () => {
    const engine = enemyTurn([playerAt('warrior', hex(1, 1), { stats: { ...WARRIOR_STATS, maxHp: 60 } }), TROLL])
    for (let turn = 0; turn < 2; turn++) {
      expect(nonMoves(engine, 'troll')).toContainEqual(claws('warrior'))
      engine.step(claws('warrior'))
      expect(unitOf(engine, 'troll').recharging).toEqual({})
      engine.step(END_TURN)
      engine.step(END_TURN)
    }
  })

  it('recharges the spider’s bite: not again the same turn, ready again as its side’s next turn begins', () => {
    const engine = enemyTurn([playerAt('warrior', hex(1, 1), { stats: { ...WARRIOR_STATS, maxHp: 60 } }), SPIDER])
    expect(unitOf(engine, 'spider').recharging).toEqual({})
    engine.step(bite('warrior'))
    expect(unitOf(engine, 'spider')).toMatchObject({ ap: 4, recharging: { spider_bite: 1 } })
    expect(nonMoves(engine, 'spider')).toEqual([{ type: 'attack', unit: 'spider', target: 'warrior' }, END_TURN])
    expect(() => engine.step(bite('warrior'))).toThrow('spider cannot use spider_bite on warrior')
    engine.step(END_TURN)
    // The player's turn begins: the spider's counter waits for its own side's.
    expect(unitOf(engine, 'spider').recharging).toEqual({ spider_bite: 1 })
    engine.step(END_TURN)
    expect(unitOf(engine, 'spider').recharging).toEqual({})
    expect(nonMoves(engine, 'spider')).toContainEqual(bite('warrior'))
  })

  it('counts a recharge down as its side’s turn begins, with its regeneration', () => {
    // A wounded troll that bites as the spider does, so that it regenerates.
    const slow = { ...TROLL, stats: { ...TROLL_STATS, abilities: ['spider_bite' as const] }, hp: 10 }
    const engine = enemyTurn([playerAt('warrior', hex(1, 1), { stats: { ...WARRIOR_STATS, maxHp: 60 } }), slow])
    engine.step({ type: 'ability', unit: 'troll', ability: 'spider_bite', target: 'warrior' })
    expect(unitOf(engine, 'troll').recharging).toEqual({ spider_bite: 1 })
    engine.step(END_TURN)
    const events = engine.step(END_TURN)
    expect(events.map((e) => e.type)).toEqual(['end_turn', 'regenerate'])
    expect(unitOf(engine, 'troll').recharging).toEqual({})
  })

  it('counts a sleeper’s recharge down too', () => {
    const mage: UnitSetup = playerAt('mage', hex(6, 1), { stats: { ...WARRIOR_STATS, name: 'Mage', magic: { maxMana: 20, skill: 76, spells: ['sleep'] } } })
    const engine = enemyTurn([playerAt('warrior', hex(1, 1), { stats: { ...WARRIOR_STATS, maxHp: 60 } }), mage, SPIDER])
    engine.step(bite('warrior'))
    engine.step(END_TURN)
    engine.step({ type: 'cast', unit: 'mage', spell: 'sleep', target: 'spider' })
    expect(unitOf(engine, 'spider').statuses).toContainEqual({ id: 'asleep', turnsLeft: 2 })
    engine.step(END_TURN)
    expect(unitOf(engine, 'spider')).toMatchObject({ ap: 0, recharging: {} })
  })

  it('keeps what is recharging through a snapshot, and plays on identically', () => {
    const field = {
      board: { cols: 8, rows: 5 },
      units: [
        playerAt('warrior', hex(1, 1), { stats: { ...WARRIOR_STATS, maxHp: 40 } }),
        playerAt('cleric', hex(1, 3)),
        { ...SPIDER, position: hex(2, 1) },
        { ...TROLL, position: hex(2, 3) },
      ],
    }
    const play = (engine: BattleEngine, rng: () => number) => {
      for (let state = engine.getState(); state.phase !== 'over'; state = engine.getState()) {
        engine.step(POLICIES.aggressive({ state, legal: engine.legalActions(), rng }))
      }
      return engine.getLog()
    }
    const straight = new BattleEngine(field, { seed: 4 })
    straight.step(END_TURN)
    straight.step(bite('warrior'))
    expect(unitOf(straight, 'spider').recharging).toEqual({ spider_bite: 1 })
    const restored = BattleEngine.restore(JSON.parse(JSON.stringify(straight.snapshot())))
    expect(unitOf(restored, 'spider').recharging).toEqual({ spider_bite: 1 })
    expect(restored.legalActions()).toEqual(straight.legalActions())
    const log = play(restored, () => 0)
    expect(log).toEqual(play(straight, () => 0))
    expect(log.some((e) => e.type === 'attack' && e.ability === 'troll_claws')).toBe(true)
  })
})

describe('BattleEngine area abilities', () => {
  const WIDE = { cols: 9, rows: 3 }
  const SALAMANDER_STATS: CombatantStats = { ...GOBLIN_STATS, name: 'Salamander', toHit: 80, abilities: ['fire_spit'] }
  // At (3,1), west of it the warrior's (2,1): a cone of 2 aimed there is (2,1), then (1,1), (1,2) and (2,0).
  const SALAMANDER: UnitSetup = { id: 'salamander', side: 'enemy', stats: SALAMANDER_STATS, position: hex(3, 1) }
  const SPIDER_STATS: CombatantStats = { ...GOBLIN_STATS, name: 'Spider', toHit: 80, abilities: ['spider_web'] }
  const SPIDER: UnitSetup = { id: 'spider', side: 'enemy', stats: SPIDER_STATS, position: hex(6, 1) }
  const BOLTER: UnitSetup = { id: 'bolter', side: 'enemy', stats: { ...SALAMANDER_STATS, name: 'Bolter', abilities: ['test_bolt' as AbilityId] }, position: hex(5, 1) }
  const playerAt = (id: string, position: Hex, extra: Partial<UnitSetup> = {}): UnitSetup => ({ ...WARRIOR, id, position, ...extra })
  const goblinAt = (id: string, position: Hex, extra: Partial<UnitSetup> = {}): UnitSetup => ({ ...GOBLIN, id, position, ...extra })
  /** Every draw 0.66 unless told otherwise: a roll of 34, a 4 on a d6. Starts on the enemy's turn. */
  const enemyTurn = (units: UnitSetup[], rng: number[] = [0.66]) => {
    const engine = new BattleEngine({ board: WIDE, units }, { rng: sequence(rng) })
    engine.step(END_TURN)
    return engine
  }
  const spit = (at: Hex, unit = 'salamander'): Action => ({ type: 'ability', unit, ability: 'fire_spit', at })
  const web = (at: Hex): Action => ({ type: 'ability', unit: 'spider', ability: 'spider_web', at })
  const NAMED = { ...NAMES, salamander: 'Salamander', spider: 'Spider', bolter: 'Bolter', mage: 'Mage', zed: 'Zed' }
  const WEST_OF = hex(2, 1)
  /** A roll of 80: over the Salamander's 55% against the Warrior. */
  const MISS = 0.2
  const onBoard = (h: Hex) => {
    const col = h.q + (h.r - (h.r & 1)) / 2
    return h.r >= 0 && h.r < WIDE.rows && col >= 0 && col < WIDE.cols
  }

  // A line with damage and no half on a miss exists only here, to try the rules no listed ability exercises.
  const TEST_BOLT: Ability = {
    name: 'Test Bolt', verb: 'bolts', description: 'A test line.', apCost: 4, recharge: 0,
    area: { shape: 'line', range: 3, damage: { count: 1, sides: 6, bonus: 0 }, halfOnMiss: false },
  }
  beforeAll(() => {
    ;(ABILITIES as Record<string, Ability>).test_bolt = TEST_BOLT
  })
  afterAll(() => {
    delete (ABILITIES as Record<string, Ability>).test_bolt
  })

  it('touches every unit on a cone’s hexes, both sides, the user excluded, in roster order', () => {
    const engine = enemyTurn([
      playerAt('warrior', WEST_OF),
      goblinAt('goblin', hex(2, 0)),
      playerAt('cleric', hex(1, 2)),
      SALAMANDER,
      playerAt('zed', hex(5, 1)),
    ], [MISS])
    const [event] = engine.step(spit(WEST_OF)) as AbilityEvent[]
    expect(event.type).toBe('ability')
    expect(event.shape).toBe('cone')
    expect(event.hexes).toEqual([hex(2, 1), hex(1, 1), hex(1, 2), hex(2, 0)])
    expect(event.outcomes.map((o) => o.unit)).toEqual(['warrior', 'goblin', 'cleric'])
  })

  it('touches the units on a line and a burst, with only the board’s hexes recorded', () => {
    const line = enemyTurn([playerAt('warrior', hex(4, 1)), playerAt('cleric', hex(2, 1)), playerAt('zed', hex(1, 1)), BOLTER], [MISS])
    const [bolt] = line.step({ type: 'ability', unit: 'bolter', ability: 'test_bolt' as AbilityId, at: hex(4, 1) }) as AbilityEvent[]
    expect(bolt.hexes).toEqual([hex(4, 1), hex(3, 1), hex(2, 1)])
    expect(bolt.outcomes.map((o) => o.unit)).toEqual(['warrior', 'cleric'])

    // A burst of 1 on the top row: the three hexes above it are off the board.
    const burst = enemyTurn([playerAt('warrior', hex(3, 0)), playerAt('cleric', hex(2, 1)), playerAt('zed', hex(4, 1)), SPIDER], [MISS])
    const [webbed] = burst.step(web(hex(3, 0))) as AbilityEvent[]
    expect(webbed.hexes).toEqual(areaOf('burst', hex(6, 1), hex(3, 0), 4, 1).filter(onBoard))
    expect(webbed.hexes).toHaveLength(5)
    expect(webbed.outcomes.map((o) => o.unit)).toEqual(['warrior', 'cleric'])
  })

  it('pays its AP and starts its recharge, turns the user to its aim and records the distance and skill', () => {
    const engine = enemyTurn([playerAt('warrior', WEST_OF), SALAMANDER], [MISS])
    const [event] = engine.step(spit(WEST_OF)) as AbilityEvent[]
    expect(event).toMatchObject({ unit: 'salamander', ability: 'fire_spit', at: WEST_OF, distance: 1, apCost: 4, apAfter: 4, facing: WEST, skill: 80 })
    expect(unitOf(engine, 'salamander')).toMatchObject({ ap: 4, facing: WEST, recharging: { fire_spit: 2 } })
  })

  it('deals the dice and the ability damage bonus on a hit, with nothing off for resistance, and lays its status', () => {
    const engine = enemyTurn([
      playerAt('warrior', WEST_OF, { stats: { ...WARRIOR_STATS, resistance: 4 } }),
      { ...SALAMANDER, stats: { ...SALAMANDER_STATS, abilityDamageBonus: 1 } },
    ])
    const [event] = engine.step(spit(WEST_OF)) as AbilityEvent[]
    // A roll of 34 within 55%; 4 + 4 + 4 + 4 on the dice, +2, +1.
    expect(event.outcomes).toEqual([
      {
        unit: 'warrior', attackRoll: 34, chance: 55, defenderAc: 25, hit: true, critical: false, fumble: false, image: false,
        damage: 19, warded: 0, half: false, healed: 0, hpBefore: 20, hpAfter: 1, status: { id: 'seared', turnsLeft: 1 },
      },
    ])
    expect(formatEvent(event, NAMED)).toBe('Salamander spits fire: HITS Warrior for 19 dmg, seared.')
  })

  it('deals half the dice, rounded down, on a miss with halfOnMiss, and lays nothing', () => {
    const engine = enemyTurn([playerAt('warrior', WEST_OF), { ...SALAMANDER, stats: { ...SALAMANDER_STATS, abilityDamageBonus: 1 } }], [MISS, 0.66])
    const [event] = engine.step(spit(WEST_OF)) as AbilityEvent[]
    // 16 on the dice, +2, +1, halved.
    expect(event.outcomes[0]).toMatchObject({ hit: false, half: true, damage: 9, hpAfter: 11, status: null })
    expect(unitOf(engine, 'warrior').statuses).toEqual([])
    expect(formatEvent(event, NAMED)).toBe('Salamander spits fire: MISSES Warrior, 9 dmg (half).')
  })

  it('deals half the dice on a fumble too, a fumble being a miss', () => {
    const engine = enemyTurn([playerAt('warrior', WEST_OF), SALAMANDER], [0.01, 0.66])
    const [event] = engine.step(spit(WEST_OF)) as AbilityEvent[]
    expect(event.outcomes[0]).toMatchObject({ attackRoll: 99, fumble: true, hit: false, half: true, damage: 9, hpAfter: 11, status: null })
  })

  it('deals nothing on a miss without halfOnMiss, drawing no dice for it', () => {
    // The warrior is missed; the cleric's roll is the next draw, a 34 that hits, then a 4.
    const engine = enemyTurn([playerAt('warrior', hex(4, 1)), playerAt('cleric', hex(3, 1)), BOLTER], [MISS, 0.66])
    const [event] = engine.step({ type: 'ability', unit: 'bolter', ability: 'test_bolt' as AbilityId, at: hex(4, 1) }) as AbilityEvent[]
    expect(event.outcomes.map((o) => [o.unit, o.hit, o.half, o.damage])).toEqual([
      ['warrior', false, false, 0],
      ['cleric', true, false, 4],
    ])
  })

  it('cuts its element by a ward, recording the points stopped, and still lays its status', () => {
    const engine = enemyTurn([playerAt('warrior', WEST_OF, { stats: { ...WARRIOR_STATS, wards: { fire: 99 } } }), SALAMANDER])
    const [event] = engine.step(spit(WEST_OF)) as AbilityEvent[]
    expect(event.outcomes[0]).toMatchObject({ hit: true, damage: 0, warded: 18, hpAfter: 20, status: { id: 'seared', turnsLeft: 1 } })
    expect(formatEvent(event, NAMED)).toBe('Salamander spits fire: HITS Warrior for 0 dmg (warded 18), seared.')
  })

  it('cuts a half miss by its ward too', () => {
    const engine = enemyTurn([playerAt('warrior', WEST_OF, { stats: { ...WARRIOR_STATS, wards: { fire: 2 } } }), SALAMANDER], [MISS, 0.66])
    const [event] = engine.step(spit(WEST_OF)) as AbilityEvent[]
    expect(event.outcomes[0]).toMatchObject({ hit: false, half: true, damage: 7, warded: 2 })
    expect(formatEvent(event, NAMED)).toBe('Salamander spits fire: MISSES Warrior, 7 dmg (warded 2) (half).')
  })

  it('doubles the dice on a critical, and fells and ends the battle as a cast does', () => {
    const engine = enemyTurn([playerAt('warrior', WEST_OF), SALAMANDER], [0.99, 0.66])
    const events = engine.step(spit(WEST_OF))
    expect(events.map((e) => e.type)).toEqual(['ability', 'unit_down', 'battle_end'])
    // Eight dice of 4, +2.
    expect((events[0] as AbilityEvent).outcomes[0]).toMatchObject({ critical: true, damage: 34, hpAfter: 0, status: null })
    expect(engine.getState().winner).toBe('enemy')
  })

  it('puts a critical and a ward in one pair of brackets', () => {
    const engine = enemyTurn([playerAt('warrior', WEST_OF, { stats: { ...WARRIOR_STATS, maxHp: 40, wards: { fire: 5 } } }), SALAMANDER], [0.99, 0.66])
    const [event] = engine.step(spit(WEST_OF)) as AbilityEvent[]
    expect(formatEvent(event, NAMED)).toBe('Salamander spits fire: HITS Warrior for 29 dmg (CRITICAL, warded 5), seared.')
  })

  it('strikes a mirror image on a hit, drawing no dice for it', () => {
    const MAGE: UnitSetup = playerAt('mage', WEST_OF, { stats: { ...WARRIOR_STATS, name: 'Mage', magic: { maxMana: 18, skill: 76, spells: ['mirror_image'] } } })
    const engine = new BattleEngine({ board: WIDE, units: [MAGE, playerAt('cleric', hex(1, 1)), SALAMANDER] }, { rng: sequence([0.66, MISS, 0.66]) })
    engine.step({ type: 'cast', unit: 'mage', spell: 'mirror_image', target: 'mage' })
    engine.step(END_TURN)
    const [event] = engine.step(spit(WEST_OF)) as AbilityEvent[]
    // The cleric's roll and dice follow the mage's roll at once: 80 misses, then 18 halved.
    expect(event.outcomes.map((o) => [o.unit, o.hit, o.image, o.damage])).toEqual([
      ['mage', true, true, 0],
      ['cleric', false, false, 9],
    ])
    expect(unitOf(engine, 'mage').statuses).toEqual([{ id: 'mirrored', turnsLeft: 2, images: 2 }])
  })

  it('wakes a sleeper it hurts, as a cast does', () => {
    const MAGE: UnitSetup = playerAt('mage', hex(6, 1), { stats: { ...WARRIOR_STATS, name: 'Mage', magic: { maxMana: 18, skill: 76, spells: ['sleep'] } } })
    const engine = new BattleEngine(
      { board: WIDE, units: [MAGE, playerAt('warrior', WEST_OF), goblinAt('goblin', hex(2, 0), { stats: { ...GOBLIN_STATS, maxHp: 30 } }), SALAMANDER] },
      { rng: sequence([0.66]) },
    )
    engine.step({ type: 'cast', unit: 'mage', spell: 'sleep', target: 'goblin' })
    engine.step(END_TURN)
    expect(unitOf(engine, 'goblin').statuses.map((s) => s.id)).toEqual(['asleep'])
    const events = engine.step(spit(WEST_OF))
    expect(events.map((e) => e.type)).toEqual(['ability', 'status_end'])
    expect(events[1]).toMatchObject({ unit: 'goblin', status: 'asleep', reason: 'woke' })
    expect(unitOf(engine, 'goblin').statuses.map((s) => s.id)).toEqual(['seared'])
  })

  it('webs on a hit with Web, which has no dice to draw', () => {
    // The warrior is hit; the cleric's roll is the very next draw, an 80 that misses.
    const engine = enemyTurn([playerAt('warrior', hex(3, 1)), playerAt('cleric', hex(2, 1)), SPIDER], [0.66, MISS])
    const [event] = engine.step(web(hex(3, 1))) as AbilityEvent[]
    expect(event.outcomes.map((o) => [o.unit, o.hit, o.half, o.damage, o.status])).toEqual([
      ['warrior', true, false, 0, { id: 'webbed', turnsLeft: 2 }],
      ['cleric', false, false, 0, null],
    ])
    expect(formatEvent(event, NAMED)).toBe('Spider spins a web: Warrior is webbed; MISSES Cleric.')
  })

  it('logs a web that hits a unit already webbed as webbing it, never as a miss', () => {
    // Two spiders web the warrior in one turn: the second web finds it webbed already.
    const engine = enemyTurn([playerAt('warrior', hex(3, 1)), SPIDER, { ...SPIDER, id: 'spider2', position: hex(6, 2) }], [0.66])
    engine.step(web(hex(3, 1)))
    expect(unitOf(engine, 'warrior').statuses.map((st) => st.id)).toEqual(['webbed'])
    const [event] = engine.step({ type: 'ability', unit: 'spider2', ability: 'spider_web', at: hex(3, 1) }) as AbilityEvent[]
    expect(event.outcomes[0]).toMatchObject({ hit: true, status: { id: 'webbed', turnsLeft: 2 } })
    expect(formatEvent(event, { ...NAMED, spider2: 'Spider' })).toBe('Spider spins a web: Warrior is webbed.')
  })

  it('lists an area at each legal aim in board order, after the unit’s other actions', () => {
    const engine = enemyTurn([playerAt('warrior', WEST_OF), SALAMANDER])
    const actions = engine.legalActions('salamander')
    const areas = actions.filter((a) => a.type === 'ability')
    const expected = [...Array(WIDE.rows).keys()]
      .flatMap((row) => [...Array(WIDE.cols).keys()].map((col) => hex(col - (row - (row & 1)) / 2, row)))
      .filter((h) => {
        const d = hexDistance(h, SALAMANDER.position)
        return d >= 1 && d <= 2 && areaOf('cone', SALAMANDER.position, h, 2).some((c) => hexKey(c) === hexKey(WEST_OF))
      })
    expect(expected.length).toBeGreaterThan(1)
    expect(areas).toEqual(expected.map((at) => spit(at)))
    expect(actions.slice(actions.length - areas.length - 1, -1)).toEqual(areas)
  })

  it('refuses an aim that touches no foe, a cone or line at the user’s own hex, and a burst beyond its range', () => {
    const engine = enemyTurn([playerAt('warrior', WEST_OF), goblinAt('goblin', hex(4, 1)), SALAMANDER, { ...SPIDER, position: hex(8, 1) }])
    const listed = (at: Hex, ability: AbilityId = 'fire_spit', unit = 'salamander') =>
      engine.legalActions().some((a) => a.type === 'ability' && a.ability === ability && a.unit === unit && 'at' in a && hexKey(a.at) === hexKey(at))
    // Eastwards the cone holds only the salamander's ally.
    expect(listed(hex(4, 1))).toBe(false)
    expect(() => engine.step(spit(hex(4, 1)))).toThrow('salamander cannot use fire_spit at 4,1')
    expect(listed(SALAMANDER.position)).toBe(false)
    expect(() => engine.step(spit(SALAMANDER.position))).toThrow()
    // The warrior is 6 hexes from the spider; a burst of 1 around it is aimed 5 or 6 away.
    expect(listed(WEST_OF, 'spider_web', 'spider')).toBe(false)
    expect(() => engine.step({ type: 'ability', unit: 'spider', ability: 'spider_web', at: hex(3, 1) })).toThrow()
    // A routine's target form is refused for an area, and an area's aim for a routine.
    expect(() => engine.step({ type: 'ability', unit: 'salamander', ability: 'fire_spit', target: 'warrior' })).toThrow()
  })

  it('is not listed while it recharges, and is again once its counter runs out', () => {
    const engine = enemyTurn([playerAt('warrior', WEST_OF, { stats: { ...WARRIOR_STATS, maxHp: 99 } }), SALAMANDER], [MISS, 0.66])
    const spits = () => engine.legalActions('salamander').filter((a) => a.type === 'ability').length
    expect(engine.getState().round).toBe(1)
    engine.step(spit(WEST_OF))
    expect(spits()).toBe(0)
    engine.step(END_TURN)
    engine.step(END_TURN)
    expect(engine.getState().round).toBe(2)
    expect(spits()).toBe(0)
    expect(() => engine.step(spit(WEST_OF))).toThrow()
    engine.step(END_TURN)
    engine.step(END_TURN)
    expect(engine.getState().round).toBe(3)
    expect(spits()).toBeGreaterThan(0)
  })

  it('names "touches no one" for an area that touched nobody', () => {
    const event: AbilityEvent = {
      type: 'ability', seq: 0, round: 1, unit: 'salamander', ability: 'fire_spit', at: WEST_OF, shape: 'cone', hexes: [],
      distance: 1, apCost: 4, apAfter: 4, facing: WEST, skill: 80, outcomes: [],
    }
    expect(formatEvent(event, NAMED)).toBe('Salamander spits fire: it touches no one.')
  })

  it('restores from a snapshot taken after an area attack and plays on identically', () => {
    const field = {
      board: WIDE,
      units: [playerAt('warrior', WEST_OF, { stats: { ...WARRIOR_STATS, maxHp: 60 } }), playerAt('cleric', hex(1, 2)), { ...SALAMANDER, stats: { ...SALAMANDER_STATS, maxHp: 80 } }],
    }
    const play = (engine: BattleEngine, rng: () => number) => {
      for (let state = engine.getState(); state.phase !== 'over'; state = engine.getState()) {
        engine.step(POLICIES.aggressive({ state, legal: engine.legalActions(), rng }))
      }
      return engine.getLog()
    }
    const straight = new BattleEngine(field, { seed: 7 })
    straight.step(END_TURN)
    straight.step(spit(WEST_OF))
    const restored = BattleEngine.restore(JSON.parse(JSON.stringify(straight.snapshot())))
    expect(unitOf(restored, 'salamander').recharging).toEqual({ fire_spit: 2 })
    expect(restored.legalActions()).toEqual(straight.legalActions())
    const log = play(restored, () => 0)
    expect(log).toEqual(play(straight, () => 0))
    expect(log.filter((e) => e.type === 'ability').length).toBeGreaterThan(1)
  })
})

describe('BattleEngine on-hit effects', () => {
  const EMBER3: OnHit = { damage: 3, element: 'fire', status: { id: 'seared', turns: 1 } }
  const striker = (onHit: OnHit[], extra: Partial<UnitSetup> = {}): UnitSetup => ({
    ...WARRIOR,
    stats: { ...WARRIOR_STATS, onHit },
    ...extra,
  })
  const foe = (stats: Partial<CombatantStats> = {}, extra: Partial<UnitSetup> = {}): UnitSetup => ({
    ...GOBLIN,
    stats: { ...GOBLIN_STATS, maxHp: 30, ...stats },
    ...extra,
  })
  const first = (units: UnitSetup[], rng: number[]) => {
    const engine = new BattleEngine(setup(units), { rng: sequence(rng) })
    const events = engine.step(ATTACK_GOBLIN)
    return { engine, events, attack: events[0] as AttackEvent }
  }
  /** A roll of 50 (a plain hit at 60%), then a 5 on the d8: 7, 6 through the goblin's resistance. */
  const HIT = [0.5, 0.5]
  /** A roll of 1 (a critical), then two 5s: 12, 11 through resistance. */
  const CRIT = [0.99, 0.5, 0.5]
  /** A roll of 90: a miss. */
  const MISS = [0.1]
  const NAMED = { ...NAMES, goblin: 'Troll' }

  it('adds its flat damage on a hit, after resistance, and nothing on a miss', () => {
    const { attack, engine } = first([striker([EMBER3]), foe()], HIT)
    expect(attack).toMatchObject({ hit: true, rolled: 7, damage: 6, bonus: [{ element: 'fire', rolled: 3, damage: 3 }] })
    expect(attack.defenderHpBefore - attack.defenderHpAfter).toBe(9)
    expect(unitOf(engine, 'goblin').hp).toBe(21)
    const missed = first([striker([EMBER3, { damage: 0, heal: 2 }]), foe()], MISS).attack
    expect(missed).toMatchObject({ hit: false, bonus: [] })
    expect(missed.healed).toBeUndefined()
    expect(missed.onHitStatuses).toBeUndefined()
  })

  it('is not doubled by a critical', () => {
    const plain = first([striker([EMBER3]), foe()], HIT).attack
    const critical = first([striker([EMBER3]), foe()], CRIT).attack
    expect(critical).toMatchObject({ critical: true, damage: 11 })
    expect(critical.bonus).toEqual(plain.bonus)
  })

  it('owes nothing to resistance', () => {
    const { attack } = first([striker([EMBER3]), foe({ resistance: 5 })], HIT)
    expect(attack).toMatchObject({ damage: 2, bonus: [{ rolled: 3, damage: 3 }] })
    expect(attack.defenderHpBefore - attack.defenderHpAfter).toBe(5)
  })

  it('is cut by the defender’s ward, and the log says so', () => {
    const { attack } = first([striker([{ damage: 3, element: 'fire' }]), foe({ wards: { fire: 2 } })], HIT)
    expect(attack.bonus).toEqual([{ element: 'fire', rolled: 3, damage: 1 }])
    expect(attack.defenderHpAfter).toBe(30 - 7)
    expect(formatEvent(attack, NAMED)).toBe('Warrior rolls 50 (needs 60 or less) — HITS Troll for 6 dmg (armour stops 1) +1 fire (warded 2).')
    const stopped = first([striker([{ damage: 3, element: 'fire' }]), foe({ wards: { fire: 9 } })], HIT).attack
    expect(stopped.bonus).toEqual([{ element: 'fire', rolled: 3, damage: 0 }])
    expect(formatEvent(stopped, NAMED)).toBe('Warrior rolls 50 (needs 60 or less) — HITS Troll for 6 dmg (armour stops 1).')
  })

  it('wards each entry on its own', () => {
    const { attack } = first([striker([{ damage: 3, element: 'fire' }, { damage: 3, element: 'fire' }]), foe({ wards: { fire: 2 } })], HIT)
    expect(attack.bonus.map((b) => b.damage)).toEqual([1, 1])
    expect(attack.defenderHpAfter).toBe(30 - 8)
  })

  it('takes the total off at once, floored at 0, and fells on the bonus alone', () => {
    const { attack, events, engine } = first([striker([EMBER3]), foe({}, { hp: 8 })], HIT)
    expect(attack).toMatchObject({ damage: 6, defenderHpBefore: 8, defenderHpAfter: 0 })
    expect(attack.onHitStatuses).toBeUndefined()
    expect(events.map((e) => e.type)).toEqual(['attack', 'unit_down', 'battle_end'])
    expect(engine.getState()).toMatchObject({ phase: 'over', winner: 'player' })
  })

  it('wakes a sleeper with the bonus alone', () => {
    // The mage's Sleep hits on a roll of 34; the striker's dice roll 0 on a hit of 50, its fire 2 then waking the goblin.
    const mage: UnitSetup = {
      id: 'mage',
      side: 'player',
      stats: { ...WARRIOR_STATS, name: 'Mage', magic: { maxMana: 20, skill: 76, spells: ['sleep'] } },
      position: hex(0, 1),
    }
    const dud = striker([{ damage: 2, element: 'fire' }], { stats: { ...WARRIOR_STATS, damage: { count: 1, sides: 1, bonus: -1 }, onHit: [{ damage: 2, element: 'fire' }] } })
    const engine = new BattleEngine(setup([mage, dud, foe()]), { rng: sequence([0.66, 0.5, 0.5]) })
    engine.step({ type: 'cast', unit: 'mage', spell: 'sleep', target: 'goblin' })
    expect(unitOf(engine, 'goblin').statuses).toEqual([{ id: 'asleep', turnsLeft: 2 }])
    const events = engine.step(ATTACK_GOBLIN)
    expect(events[0]).toMatchObject({ hit: true, damage: 0, bonus: [{ damage: 2 }] })
    expect(events.map((e) => e.type)).toEqual(['attack', 'status_end'])
    expect(events[1]).toMatchObject({ unit: 'goblin', status: 'asleep', reason: 'woke' })
  })

  it('records nothing when the hit strikes an image', () => {
    const mage: UnitSetup = {
      id: 'mage',
      side: 'enemy',
      stats: { ...GOBLIN_STATS, name: 'Mage', maxHp: 30, magic: { maxMana: 20, skill: 76, spells: ['mirror_image'] } },
      position: hex(2, 1),
    }
    const engine = new BattleEngine(setup([striker([EMBER3, { damage: 0, heal: 2 }], { hp: 10 }), mage]), { rng: sequence(HIT) })
    engine.step(END_TURN)
    engine.step({ type: 'cast', unit: 'mage', spell: 'mirror_image', target: 'mage' })
    engine.step(END_TURN)
    const [attack] = engine.step({ type: 'attack', unit: 'warrior', target: 'mage' }) as AttackEvent[]
    expect(attack).toMatchObject({ hit: true, image: true, damage: 0, bonus: [], defenderHpAfter: 30 })
    expect(attack.healed).toBeUndefined()
    expect(attack.onHitStatuses).toBeUndefined()
    expect(unitOf(engine, 'warrior').hp).toBe(10)
  })

  it('sears with an Ember III, which stops a troll’s regeneration', () => {
    const troll: UnitSetup = { ...GOBLIN, stats: TROLL_STATS }
    // A roll of 50 within 65%, then 7 on the dice: 6 through the troll's resistance, then 3 of fire.
    const { attack, engine } = first([striker([EMBER3]), troll], HIT)
    expect(attack).toMatchObject({ damage: 6, bonus: [{ element: 'fire', rolled: 3, damage: 3 }], defenderHpAfter: 7 })
    expect(attack.onHitStatuses).toEqual([{ id: 'seared', turnsLeft: 1 }])
    expect(formatEvent(attack, NAMED)).toBe('Warrior rolls 50 (needs 65 or less) — HITS Troll for 6 dmg (armour stops 1) +3 fire, seared.')
    expect(engine.step(END_TURN).map((e) => e.type)).toEqual(['end_turn'])
    const plain = first([striker([{ damage: 3, element: 'fire' }]), troll], HIT).engine
    expect(plain.step(END_TURN).map((e) => e.type)).toEqual(['end_turn', 'regenerate'])
  })

  it('lays an on-crit status only on a critical', () => {
    const venom: OnHit = { damage: 2, element: 'poison', status: { id: 'poisoned', turns: 3 }, onCrit: true }
    const rime: OnHit = { damage: 3, element: 'frost', status: { id: 'chilled', turns: 1 }, onCrit: true }
    const plain = first([striker([venom, rime]), foe()], HIT)
    expect(plain.attack.onHitStatuses).toBeUndefined()
    expect(unitOf(plain.engine, 'goblin').statuses).toEqual([])
    const critical = first([striker([venom, rime]), foe()], CRIT)
    expect(critical.attack.onHitStatuses).toEqual([
      { id: 'poisoned', turnsLeft: 3 },
      { id: 'chilled', turnsLeft: 1 },
    ])
    expect(formatEvent(critical.attack, NAMED)).toBe(
      'Warrior rolls 1 (needs 60 or less) — HITS Troll for 11 dmg (armour stops 1) +2 poison +3 frost, poisoned, chilled. CRITICAL HIT!',
    )
  })

  it('heals the wielder on a hit, up to its maximum', () => {
    const life: OnHit = { damage: 0, heal: 2 }
    const wounded = first([striker([life], { hp: 19 }), foe()], HIT)
    expect(wounded.attack).toMatchObject({ healed: 1, bonus: [] })
    expect(unitOf(wounded.engine, 'warrior').hp).toBe(20)
    expect(formatEvent(wounded.attack, NAMED)).toBe('Warrior rolls 50 (needs 60 or less) — HITS Troll for 6 dmg (armour stops 1). Warrior heals 1.')
    expect(first([striker([life]), foe()], HIT).attack).toMatchObject({ healed: 0 })
    expect(first([striker([life], { hp: 19 }), foe()], MISS).attack.healed).toBeUndefined()
    expect(first([striker([]), foe()], HIT).attack.healed).toBeUndefined()
  })

  it('deals a bane only to the regenerating and the blight’s own', () => {
    const dawn: OnHit = { damage: 2, element: 'blight', bane: true }
    expect(first([striker([dawn]), foe({ regeneration: 3 })], HIT).attack.bonus).toEqual([{ element: 'blight', bane: true, rolled: 2, damage: 2 }])
    expect(first([striker([dawn]), foe({ blightborn: true })], HIT).attack.bonus).toEqual([{ element: 'blight', bane: true, rolled: 2, damage: 2 }])
    const goblin = first([striker([dawn]), foe()], HIT).attack
    expect(goblin.bonus).toEqual([])
    expect(goblin.defenderHpAfter).toBe(24)
    expect(first([striker([dawn]), foe({ blightborn: true, wards: { blight: 1 } })], HIT).attack.bonus[0].damage).toBe(1)
  })

  it('comes with free attacks too', () => {
    // The goblin steps away from the warrior, which strikes it on a roll of 50 for 6 and 3 of fire.
    const engine = new BattleEngine(setup([striker([EMBER3]), foe()]), { rng: sequence(HIT) })
    engine.step(END_TURN)
    const events = engine.step({ type: 'move', unit: 'goblin', to: hex(3, 1) })
    const free = events.find((e): e is AttackEvent => e.type === 'attack')!
    expect(free).toMatchObject({ opportunity: true, damage: 6, bonus: [{ damage: 3 }], onHitStatuses: [{ id: 'seared', turnsLeft: 1 }] })
  })

  it('draws nothing from the battle’s RNG', () => {
    const counted = () => {
      const rng = mulberry32(7)
      let draws = 0
      return { rng: () => (draws++, rng()), draws: () => draws }
    }
    const play = (onHit: OnHit[]) => {
      const { rng, draws } = counted()
      const engine = new BattleEngine(setup([striker(onHit, { hp: 15 }), foe()]), { rng })
      const log = [ATTACK_GOBLIN, END_TURN, ATTACK_WARRIOR, END_TURN, ATTACK_GOBLIN].flatMap((action) => engine.step(action))
      return { draws: draws(), rolls: log.filter((e): e is AttackEvent => e.type === 'attack').map((e) => [e.attackRoll, e.rolled]) }
    }
    const runes = play([EMBER3, { damage: 1, element: 'poison', status: { id: 'poisoned', turns: 3 }, onCrit: true }, { damage: 0, heal: 1 }])
    expect(runes).toEqual(play([]))
    expect(runes.draws).toBeGreaterThan(0)
  })

  it('leaves a plain hit’s event and line as they were', () => {
    const { attack } = first([WARRIOR, foe()], HIT)
    expect(attack.bonus).toEqual([])
    expect('healed' in attack).toBe(false)
    expect('onHitStatuses' in attack).toBe(false)
    expect(formatEvent(attack, NAMED)).toBe('Warrior rolls 50 (needs 60 or less) — HITS Troll for 6 dmg (armour stops 1).')
  })

  it('is logged under schema version 24', () => {
    expect(LOG_SCHEMA_VERSION).toBe(24)
    expect(new BattleEngine(DUEL).getLog()[0]).toMatchObject({ schemaVersion: 24 })
  })
})
