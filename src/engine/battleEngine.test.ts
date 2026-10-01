import { describe, expect, it } from 'vitest'
import { GOBLIN_STATS, type CombatantStats } from '../combat/combat.ts'
import { hex, hexDistance, hexKey } from '../grid/hex.ts'
import {
  BattleEngine,
  LOG_SCHEMA_VERSION,
  formatEvent,
  type Action,
  type AttackEvent,
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
const ATTACK_GOBLIN: Action = { type: 'attack', target: 'goblin' }
const ATTACK_WARRIOR: Action = { type: 'attack', target: 'warrior' }
const END_TURN: Action = { type: 'end_turn' }
/** d20 -> 1: a fumble, so no damage. */
const FUMBLE = 0
/** d20 -> 20 then max damage dice: a crit that fells a Goblin outright. */
const KILL = [0.99, 0.99]

const unitOf = (engine: BattleEngine, id: string) => engine.getState().units.find((u) => u.id === id)!
const nonMoves = (engine: BattleEngine) => engine.legalActions().filter((a) => a.type !== 'move')

describe('BattleEngine', () => {
  it('starts with the first player unit active and logs a self-describing battle_start event', () => {
    const engine = new BattleEngine(DUEL, { seed: 42, meta: { source: 'test' } })
    expect(engine.getState()).toMatchObject({
      phase: 'player',
      round: 1,
      active: 'warrior',
      activeHasMoved: false,
      winner: null,
    })
    expect(unitOf(engine, 'warrior').hp).toBe(WARRIOR_STATS.maxHp)
    expect(unitOf(engine, 'goblin').hp).toBe(GOBLIN_STATS.maxHp)

    expect(engine.getLog()).toHaveLength(1)
    const start = engine.getLog()[0] as BattleStartEvent
    expect(start).toMatchObject({
      type: 'battle_start',
      schemaVersion: LOG_SCHEMA_VERSION,
      seed: 42,
      meta: { source: 'test' },
      board: BOARD,
      units: [
        { ...WARRIOR_STATS, id: 'warrior', side: 'player', hp: WARRIOR_STATS.maxHp, position: hex(1, 1) },
        { ...GOBLIN_STATS, id: 'goblin', side: 'enemy', hp: GOBLIN_STATS.maxHp, position: hex(2, 1) },
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

  it('offers an attack on each adjacent standing foe, plus end_turn', () => {
    const engine = new BattleEngine(DUEL)
    expect(nonMoves(engine)).toEqual([ATTACK_GOBLIN, END_TURN])
  })

  it('rejects attacks on allies, unknown units, fallen foes and foes out of reach', () => {
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, CLERIC]))
    expect(() => engine.step({ type: 'attack', target: 'cleric' })).toThrow(/cannot attack/)
    expect(() => engine.step({ type: 'attack', target: 'nobody' })).toThrow(/cannot attack/)

    const withFallen = new BattleEngine(setup([WARRIOR, GOBLIN, { ...GOBLIN2, hp: 0 }]))
    expect(nonMoves(withFallen)).toEqual([ATTACK_GOBLIN, END_TURN])
    expect(() => withFallen.step({ type: 'attack', target: 'goblin2' })).toThrow(/cannot attack/)

    const apart = new BattleEngine(setup([WARRIOR, { ...GOBLIN, position: hex(4, 1) }]))
    expect(nonMoves(apart)).toEqual([END_TURN])
    expect(() => apart.step(ATTACK_GOBLIN)).toThrow(/cannot attack/)
  })

  it('passes the turn to the enemy after a player attack that does not end the battle', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    const events = engine.step(ATTACK_GOBLIN)
    expect(events).toEqual([
      expect.objectContaining({ type: 'attack', attacker: 'warrior', defender: 'goblin', fumble: true, damage: 0 }),
    ])
    expect(engine.getState()).toMatchObject({ phase: 'enemy', active: 'goblin' })
  })

  it('acts for whichever unit is active, advancing the round after the enemy side', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE, FUMBLE]) })
    engine.step(ATTACK_GOBLIN)
    const [enemyAttack] = engine.step(ATTACK_WARRIOR) as [AttackEvent]
    expect(enemyAttack.attacker).toBe('goblin')
    expect(engine.getState()).toMatchObject({ phase: 'player', active: 'warrior', round: 2 })
  })

  it('lets any unit end its turn without attacking', () => {
    const engine = new BattleEngine(DUEL)
    expect(engine.step(END_TURN)).toEqual([expect.objectContaining({ type: 'end_turn', unit: 'warrior' })])
    expect(engine.step(END_TURN)).toEqual([expect.objectContaining({ type: 'end_turn', unit: 'goblin' })])
    expect(engine.getState()).toMatchObject({ phase: 'player', round: 2 })
    expect(unitOf(engine, 'goblin').hp).toBe(GOBLIN_STATS.maxHp)
  })

  it('gives every standing unit on a side a turn, in roster order, before the other side', () => {
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, CLERIC, GOBLIN2]))
    const order: (string | null)[] = []
    for (let i = 0; i < 5; i++) {
      order.push(engine.getState().active)
      engine.step(END_TURN)
    }
    expect(order).toEqual(['warrior', 'cleric', 'goblin', 'goblin2', 'warrior'])
    expect(engine.getState().round).toBe(2)
  })

  it('skips fallen units and keeps fighting while a side still has someone standing', () => {
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, GOBLIN2]), { rng: sequence(KILL) })
    const events = engine.step(ATTACK_GOBLIN)
    expect(events.map((e) => e.type)).toEqual(['attack', 'unit_down'])
    expect(engine.getState()).toMatchObject({ phase: 'enemy', active: 'goblin2', winner: null })
    expect(nonMoves(engine)).toEqual([ATTACK_WARRIOR, END_TURN])
    engine.step(END_TURN)
    expect(engine.getState().active).toBe('warrior')
    expect(nonMoves(engine)).toEqual([{ type: 'attack', target: 'goblin2' }, END_TURN])
  })

  it('ends the battle when the last unit on a side falls', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence(KILL) })
    const events = engine.step(ATTACK_GOBLIN)
    expect(events).toEqual([
      expect.objectContaining({ type: 'attack', defenderHpAfter: 0 }),
      expect.objectContaining({ type: 'unit_down', unit: 'goblin' }),
      expect.objectContaining({ type: 'battle_end', winner: 'player', reason: 'defeat' }),
    ])

    expect(engine.getState()).toMatchObject({ phase: 'over', active: null, winner: 'player' })
    expect(unitOf(engine, 'goblin').hp).toBe(0)
    expect(engine.legalActions()).toEqual([])
    expect(() => engine.step(ATTACK_GOBLIN)).toThrow(/over/)
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
        // Attack when possible, otherwise hold, whatever side is active.
        const attack = engine.legalActions().find((a) => a.type === 'attack')
        engine.step(i % 3 === 2 || !attack ? END_TURN : attack)
      }
      return engine.getLog()
    }
    expect(play(1234)).toEqual(play(1234))
    expect(play(1234)).not.toEqual(play(4321))
  })

  it('assigns a strictly increasing seq to every event in the log', () => {
    const engine = new BattleEngine(DUEL, { rng: sequence([FUMBLE]) })
    engine.step(ATTACK_GOBLIN)
    engine.step(ATTACK_WARRIOR)
    engine.abandon()
    const seqs = engine.getLog().map((e) => e.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
  })
})

describe('BattleEngine movement', () => {
  const apart = () =>
    new BattleEngine(setup([{ ...WARRIOR, position: hex(0, 1) }, { ...GOBLIN, position: hex(4, 1) }]))
  const moveTargets = (engine: BattleEngine) =>
    engine.legalActions().flatMap((a) => (a.type === 'move' ? [hexKey(a.to)] : []))

  it('offers moves to on-board hexes within speed, around other units', () => {
    const engine = new BattleEngine(setup([WARRIOR, GOBLIN, CLERIC]))
    const targets = moveTargets(engine)
    expect(targets.length).toBeGreaterThan(0)
    for (const key of targets) {
      const [q, r] = key.split(',').map(Number)
      expect(hexDistance(hex(q, r), WARRIOR.position)).toBeLessThanOrEqual(WARRIOR_STATS.speed)
      expect(r >= 0 && r < BOARD.rows).toBe(true)
    }
    expect(targets).not.toContain(hexKey(GOBLIN.position))
    expect(targets).not.toContain(hexKey(CLERIC.position))
  })

  it('moves along a logged path without ending the turn, then allows no second move', () => {
    const engine = apart()
    const [event] = engine.step({ type: 'move', to: hex(3, 1) }) as [MoveEvent]
    expect(event).toMatchObject({ type: 'move', unit: 'warrior', from: hex(0, 1), to: hex(3, 1) })
    expect(event.path).toEqual([hex(1, 1), hex(2, 1), hex(3, 1)])
    expect(unitOf(engine, 'warrior').position).toEqual(hex(3, 1))
    expect(engine.getState()).toMatchObject({ active: 'warrior', activeHasMoved: true })

    // Now adjacent: it can attack or end the turn, but not move again.
    expect(engine.legalActions()).toEqual([ATTACK_GOBLIN, END_TURN])
    expect(() => engine.step({ type: 'move', to: hex(2, 1) })).toThrow(/already moved/)
  })

  it('rejects moves beyond speed, off the board or onto a unit', () => {
    const engine = apart()
    expect(() => engine.step({ type: 'move', to: hex(4, 0) })).toThrow(/cannot move/) // 4 steps away
    expect(() => engine.step({ type: 'move', to: hex(0, -1) })).toThrow(/cannot move/)
    const crowded = new BattleEngine(setup([WARRIOR, GOBLIN]))
    expect(() => crowded.step({ type: 'move', to: GOBLIN.position })).toThrow(/cannot move/)
  })

  it('lets each unit move again on its next turn', () => {
    const engine = apart()
    engine.step({ type: 'move', to: hex(1, 1) })
    engine.step(END_TURN)
    expect(engine.getState()).toMatchObject({ active: 'goblin', activeHasMoved: false })
    expect(moveTargets(engine).length).toBeGreaterThan(0)
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
    expect(formatEvent(engine.step({ type: 'move', to: hex(1, 1) })[0], NAMES)).toBe('Warrior moves 1 hex.')
    engine.step(END_TURN)
    expect(formatEvent(engine.step({ type: 'move', to: hex(2, 1) })[0], NAMES)).toBe('Goblin moves 2 hexes.')
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
