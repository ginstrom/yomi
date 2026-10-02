import { describe, expect, it } from 'vitest'
import { GOBLIN_STATS, type CombatantStats } from '../combat/combat.ts'
import { HEX_DIRECTIONS, hex, hexAdd, hexKey, type Hex } from '../grid/hex.ts'
import {
  ARC_BONUS,
  ATTACK_AP_COST,
  BattleEngine,
  FLANK_BONUS_PER_ALLY,
  LOG_SCHEMA_VERSION,
  attackArc,
  flankersOf,
  formatEvent,
  moveApCost,
  type Action,
  type AttackEvent,
  type BattleEvent,
  type BattleStartEvent,
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
  ac: 15,
  attackBonus: 4,
  damage: { count: 1, sides: 8, bonus: 2 },
  speed: 3,
  actionPoints: 3,
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
/** d20 -> 1: a fumble, so no damage. */
const FUMBLE = 0
/** d20 -> 20 then max damage dice: a crit that fells a Goblin outright. */
const KILL = [0.99, 0.99]
/** d20 -> 7: the Warrior's 11 misses a Goblin's AC 13 alone, but 13 hits with one flanker. */
const ROLL_7 = 0.3
/** d20 -> 10: a Goblin's 13 misses the Warrior's AC 15 from the front, but 15 hits from behind. */
const ROLL_10 = 0.45

/** Facings, as indices into HEX_DIRECTIONS. */
const EAST = 0
const NORTH_WEST = 2
const WEST = 3
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
        { ...WARRIOR_STATS, id: 'warrior', side: 'player', hp: WARRIOR_STATS.maxHp, position: hex(1, 1), ap: 3 },
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

  it('rejects bad rosters: duplicate ids, a missing side, shared or off-board hexes', () => {
    expect(() => new BattleEngine(setup([WARRIOR, WARRIOR, GOBLIN]))).toThrow(/unique/)
    expect(() => new BattleEngine(setup([WARRIOR]))).toThrow(/No enemy units/)
    expect(() => new BattleEngine(setup([WARRIOR, { ...GOBLIN, position: WARRIOR.position }]))).toThrow(
      /different hexes/,
    )
    expect(() => new BattleEngine(setup([WARRIOR, { ...GOBLIN, position: hex(-5, 0) }]))).toThrow(/off the board/)
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
    expect(unitOf(engine, 'warrior').ap).toBe(WARRIOR_STATS.actionPoints - ATTACK_AP_COST)
    expect(nonMoves(engine)).toEqual([END_TURN])
    expect(() => engine.step(ATTACK_GOBLIN)).toThrow(/too few action points/)
  })

  it('refuses any action from a unit with no AP left', () => {
    const engine = new BattleEngine(setup([WARRIOR, { ...GOBLIN, position: hex(4, 1) }]), { rng: sequence([FUMBLE]) })
    engine.step(move('warrior', hex(3, 1))) // 2 hexes: 1 AP
    engine.step(ATTACK_GOBLIN) // 2 AP
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
    expect(unitOf(engine, 'cleric')).toMatchObject({ position: hex(0, 2), ap: 1 })
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

  it('charges one AP per speed hexes moved, or part thereof', () => {
    expect([1, 3, 4, 6, 7].map((steps) => moveApCost(steps, 3))).toEqual([1, 1, 2, 2, 3])
  })

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
      apCost: 1,
    })
    expect(event.path).toEqual([hex(1, 1), hex(2, 1), hex(3, 1)])
    expect(unitOf(engine, 'warrior')).toMatchObject({ position: hex(3, 1), ap: 2 })
    expect(engine.getState().phase).toBe('player')
    // Now adjacent with 2 AP: it can still attack, or move again.
    expect(nonMoves(engine)).toEqual([ATTACK_GOBLIN, END_TURN])
    expect(moveTargets(engine).length).toBeGreaterThan(0)
  })

  it('charges more AP for longer moves', () => {
    const engine = apart()
    const [event] = engine.step(move('warrior', hex(4, 0))) as [MoveEvent] // 4 hexes
    expect(event.apCost).toBe(2)
    expect(unitOf(engine, 'warrior').ap).toBe(1)
    expect(nonMoves(engine)).toEqual([END_TURN]) // adjacent, but an attack costs 2
  })

  it('rejects moves beyond its AP, off the board or onto a unit', () => {
    const engine = apart()
    engine.step(move('warrior', hex(1, 1)))
    engine.step(move('warrior', hex(2, 1)))
    engine.step(move('warrior', hex(2, 2))) // a hex at a time still costs 1 AP each: all 3 spent
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
    expect(unitOf(engine, 'warrior')).toMatchObject({ position: hex(1, 1), ap: 3 })
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
    expect(unitOf(engine, 'warrior')).toMatchObject({ position: hex(0, 1), ap: 2 })
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
    expect(engine.previewMove('warrior', hex(2, 2))).toEqual({ path: [hex(1, 2), hex(2, 2)], apCost: 1, provokes: [] })
    expect(opportunity(engine.step(move('warrior', hex(2, 2))))).toEqual([])
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
    expect(attackOn([WARRIOR, GOBLIN])).toMatchObject({ flankers: [], flankBonus: 0, totalToHit: 11, hit: false })
    expect(attackOn([WARRIOR, GOBLIN, flanker('cleric')])).toMatchObject({
      flankers: ['cleric'],
      flankBonus: FLANK_BONUS_PER_ALLY,
      totalToHit: 11 + FLANK_BONUS_PER_ALLY,
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
    expect(() => attackArc(defender, hex(4, 1))).toThrow()
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
    expect(attack(EAST)).toMatchObject({ arc: 'front', arcBonus: 0, totalToHit: 13, hit: false })
    expect(attack(WEST)).toMatchObject({ arc: 'rear', arcBonus: ARC_BONUS.rear, totalToHit: 15, hit: true })
  })

  it('stacks the arc bonus with flanking in the preview', () => {
    const engine = new BattleEngine(
      setup([WARRIOR, { ...GOBLIN, facing: SOUTH_EAST }, { ...CLERIC, position: hex(2, 2) }]),
    )
    // The warrior strikes from the goblin's west, beside its back: +4, +2 flanking and +1 hits AC 13 on 6+.
    expect(engine.previewAttack('warrior', 'goblin')).toMatchObject({
      flankBonus: FLANK_BONUS_PER_ALLY,
      arc: 'side',
      arcBonus: ARC_BONUS.side,
      hitChance: 0.75,
    })
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
      'Warrior breaks away — free attack! Goblin rolls 1 — fumbles the attack!',
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
      'Warrior rolls 7 (13 to hit, +2 flanking) — HITS Goblin for 3 dmg.',
    )
  })

  it('describes a side or rear attack in the roll', () => {
    const engine = new BattleEngine(setup([{ ...WARRIOR, facing: WEST }, GOBLIN]), {
      rng: sequence([ROLL_10, 0]),
    })
    engine.step(END_TURN)
    expect(formatEvent(engine.step(ATTACK_WARRIOR)[0], NAMES)).toBe(
      'Goblin rolls 10 (15 to hit, +2 from behind) — HITS Warrior for 2 dmg.',
    )
  })

  it('describes a fumble', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    const [attack] = engine.step(ATTACK_GOBLIN)
    expect(formatEvent(attack, NAMES)).toBe('Warrior rolls 1 — fumbles the attack!')
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
