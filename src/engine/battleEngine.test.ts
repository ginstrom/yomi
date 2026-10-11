import { describe, expect, it } from 'vitest'
import { GOBLIN_STATS, type CombatantStats } from '../combat/combat.ts'
import { HEX_DIRECTIONS, hex, hexAdd, hexKey, type Hex } from '../grid/hex.ts'
import {
  ARC_BONUS,
  BattleEngine,
  EQUIP_AP_COST,
  FLANK_BONUS_PER_ALLY,
  LOG_SCHEMA_VERSION,
  attackArc,
  flankersOf,
  formatEvent,
  type Action,
  type AttackEvent,
  type BattleEvent,
  type BattleStartEvent,
  type GearChange,
  type MoveEvent,
  type UnitSetup,
} from './battleEngine.ts'

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

  it('provokes even when sliding to another hex beside the foe, but each foe strikes once per turn', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    expect(opportunity(engine.step(move('warrior', hex(1, 2))))).toHaveLength(1) // (1,2) also touches the goblin
    expect(opportunity(engine.step(move('warrior', hex(1, 1))))).toHaveLength(0) // reaction spent
    engine.step(END_TURN)
    engine.step(END_TURN)
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

  it('gains the rear bonus for a shot into a foe’s back', () => {
    const engine = new BattleEngine(setup([ARCHER, { ...GOBLIN, position: hex(4, 1), facing: EAST }]), {
      rng: sequence([ROLL_7]),
    })
    expect(engine.previewAttack('archer', 'goblin')).toMatchObject({ arc: 'rear', arcBonus: ARC_BONUS.rear })
    const [attack] = engine.step(SHOOT_GOBLIN) as [AttackEvent]
    expect(attack).toMatchObject({ arc: 'rear', chance: ARCHER_STATS.toHit + ARC_BONUS.rear - GOBLIN.stats.ac, hit: true })
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
    })
    expect(engine.previewAttack('warrior', 'goblin2')).toEqual({
      flankers: [],
      flankBonus: 0,
      arc: 'front',
      arcBonus: 0,
      hitChance: 0.6,
    })
    expect(engine.previewAttack('cleric', 'goblin2')).toBeNull() // not adjacent
    expect(engine.previewAttack('goblin', 'warrior')).toBeNull() // not the enemy's turn
    engine.step(move('warrior', hex(0, 0)))
    engine.step(move('warrior', hex(1, 1)))
    expect(engine.previewAttack('warrior', 'goblin')).toBeNull() // too few AP
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

  it('turns an attacker towards its target, but not the defender towards the attacker', () => {
    const engine = new BattleEngine(setup([{ ...WARRIOR, facing: WEST }, GOBLIN]), { rng: sequence([FUMBLE]) })
    const [attack] = engine.step(ATTACK_GOBLIN) as [AttackEvent]
    expect(attack.attackerFacing).toBe(EAST)
    expect(facingOf(engine, 'warrior')).toBe(EAST)
    expect(facingOf(engine, 'goblin')).toBe(WEST)
  })

  it('turns a miss into a hit when striking from behind', () => {
    const attack = (warriorFacing: number) => {
      const engine = new BattleEngine(setup([{ ...WARRIOR, facing: warriorFacing }, GOBLIN]), {
        rng: sequence([ROLL_10, 0]),
      })
      engine.step(END_TURN)
      return engine.step(ATTACK_WARRIOR)[0] as AttackEvent
    }
    expect(attack(EAST)).toMatchObject({ arc: 'front', arcBonus: 0, attackRoll: 55, chance: 45, hit: false })
    expect(attack(WEST)).toMatchObject({ arc: 'rear', arcBonus: ARC_BONUS.rear, chance: 55, hit: true })
  })

  it('stacks the arc bonus with flanking in the preview', () => {
    const engine = new BattleEngine(
      setup([WARRIOR, { ...GOBLIN, facing: SOUTH_EAST }, { ...CLERIC, position: hex(2, 2) }]),
    )
    // The warrior strikes from the goblin's west, beside its back: 75%, +10 flanking and +5, less the goblin's armour class of 15.
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
          { ...GOBLIN2, position: hex(0, 2) },
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
      ['goblin2', 'front'],
      ['goblin', 'side'],
    ])
  })

  it('exposes the back of a unit that retreats straight away, but not of one that slides aside', () => {
    const freeAttackOn = (to: Hex) => {
      const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
      return engine.step(move('warrior', to)).find((e): e is AttackEvent => e.type === 'attack')!
    }
    expect(freeAttackOn(hex(0, 1))).toMatchObject({ arc: 'rear', arcBonus: ARC_BONUS.rear })
    expect(freeAttackOn(hex(1, 2))).toMatchObject({ arc: 'front', arcBonus: 0 })
  })
})

describe('formatEvent', () => {
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
      'Warrior rolls 70 (needs 70 or less, +10 flanking) — HITS Goblin for 3 dmg.',
    )
  })

  it('describes a side or rear attack in the roll', () => {
    const engine = new BattleEngine(setup([{ ...WARRIOR, facing: WEST }, GOBLIN]), {
      rng: sequence([ROLL_10, 0]),
    })
    engine.step(END_TURN)
    expect(formatEvent(engine.step(ATTACK_WARRIOR)[0], NAMES)).toBe(
      'Goblin rolls 55 (needs 55 or less, +10 from behind) — HITS Warrior for 2 dmg.',
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
    expect(engine.getLog()[0]).toMatchObject({ schemaVersion: 14, units: [{ mana: 18, magic: MAGE_STATS.magic }, {}] })
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
        attackRoll: 34,
        chance: 61,
        defenderAc: 15,
        hit: true,
        critical: false,
        fumble: false,
        damageDice: { count: 1, sides: 10, bonus: 0 },
        damage: 7,
        targetHpBefore: 12,
        targetHpAfter: 5,
      }),
    ])
    expect(unitOf(engine, 'mage')).toMatchObject({ ap: 4, mana: 15 })
    expect(unitOf(engine, 'goblin').hp).toBe(5)
    expect(formatEvent(events[0], NAMED)).toBe('Mage casts Magic Arrow: rolls 34 (needs 61 or less) — HITS Goblin for 7 dmg.')
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
    expect(miss).toMatchObject([{ attackRoll: 70, chance: 61, hit: false, fumble: false, damage: 0 }])
    expect(formatEvent(miss[0], NAMED)).toBe('Mage casts Magic Arrow: rolls 70 (needs 61 or less) — MISSES Goblin.')

    const fumble = battle(flanked, [FUMBLE]).step(cast('goblin'))
    expect(fumble).toMatchObject([{ attackRoll: 100, hit: false, fumble: true }])
    expect(formatEvent(fumble[0], NAMED)).toBe('Mage casts Magic Arrow: rolls 100 — fumbles the spell!')

    // A roll of 5 is within the mage's critical chance: 2d10, here a 3 and a 3.
    const critical = battle(flanked, [0.95, 0.2]).step(cast('goblin'))
    expect(critical[0]).toMatchObject({ attackRoll: 5, critical: true, damage: 6 })
    expect(formatEvent(critical[0], NAMED)).toBe(
      'Mage casts Magic Arrow: rolls 5 (needs 61 or less) — HITS Goblin for 6 dmg. CRITICAL HIT!',
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
      if (action.type === 'cast') expect(engine.previewCast(action.unit, action.spell, action.target)).toBeNull()
      expect(() => engine.step(action)).toThrow(/cannot cast magic_arrow on|cannot act now/)
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
    expect(engine.previewCast('mage', 'magic_arrow', 'goblin')).toEqual({ apCost: 4, manaCost: 3, hitChance: 0.61 })
    expect(engine.step(cast('goblin'))[0]).toMatchObject({ chance: 61 })
    // Armour takes the chance down, but never below 5 in 100.
    const armoured = battle([MAGE, { ...FAR_GOBLIN, stats: { ...GOBLIN_STATS, ac: 90 } }])
    expect(armoured.previewCast('mage', 'magic_arrow', 'goblin')?.hitChance).toBe(0.05)
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
