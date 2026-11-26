import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ABILITIES, type Ability, type AbilityId } from '../combat/abilities.ts'
import { GOBLIN_STATS, type CombatantStats, type OnHit } from '../combat/combat.ts'
import { STATUSES, STATUS_IDS, refusesStatus, type SpellId } from '../combat/spells.ts'
import { hex, type Hex } from '../grid/hex.ts'
import {
  BattleEngine,
  LOG_SCHEMA_VERSION,
  formatEvent,
  type AbilityEvent,
  type Action,
  type AttackEvent,
  type BattleEvent,
  type CastEvent,
  type UnitSetup,
} from './battleEngine.ts'

/**
 * The immunity (`CombatantStats.immune`): a status whose rule has a `tick`
 * is never laid on the unit, whatever lays it, the refusal recorded on the
 * event, and nothing drawn or left undrawn for it.
 */

const BOARD = { cols: 9, rows: 3 }
const END_TURN: Action = { type: 'end_turn' }
const NAMES = { hero: 'Hero', golem: 'Golem', other: 'Goblin' }

const HERO_STATS: CombatantStats = {
  name: 'Hero',
  maxHp: 60,
  ac: 25,
  toHit: 75,
  critChance: 5,
  damage: { count: 1, sides: 8, bonus: 2 },
  attackApCost: 4,
  attackRange: 1,
  actionPoints: 12,
  magic: { maxMana: 60, skill: 76, spells: [] },
}
/** A goblin's block with hit points to stand through every blow here. */
const GOLEM_STATS: CombatantStats = { ...GOBLIN_STATS, name: 'Golem', maxHp: 60, actionPoints: 12 }

/** A stream of `values` (the last repeated) that counts its draws. */
function counted(values: number[]) {
  let draws = 0
  return {
    rng: () => values[Math.min(draws++, values.length - 1)],
    draws: () => draws,
  }
}

interface Scene {
  /** Added to the hero's stats (the player's unit, at (1,1)). */
  hero?: Partial<CombatantStats>
  /** Added to the golem's stats (the enemy's unit, at (2,1)): the unit the statuses are laid on unless `victim` says the hero. */
  golem?: Partial<CombatantStats>
  /** The unit that is immune in the immune run; the golem by default. */
  victim?: 'hero' | 'golem'
  /** A second enemy unit beside the golem, never immune. */
  other?: Hex
  /** Whether the enemy acts (the player's turn is ended first). */
  enemyActs?: boolean
  rng?: number[]
  action: Action
}

/** Plays `scene.action` once, the victim immune or not, and gives its events and the draws it made. */
function play(scene: Scene, immune: boolean) {
  const flag = immune ? { immune: true as const } : {}
  const victim = scene.victim ?? 'golem'
  const units: UnitSetup[] = [
    { id: 'hero', side: 'player', stats: { ...HERO_STATS, ...scene.hero, ...(victim === 'hero' ? flag : {}) }, position: hex(1, 1) },
    { id: 'golem', side: 'enemy', stats: { ...GOLEM_STATS, ...scene.golem, ...(victim === 'golem' ? flag : {}) }, position: hex(2, 1) },
    ...(scene.other ? [{ id: 'other', side: 'enemy' as const, stats: GOLEM_STATS, position: scene.other }] : []),
  ]
  // 0.66: a roll of 34, a hit that is no critical, and middling dice.
  const stream = counted(scene.rng ?? [0.66])
  const engine = new BattleEngine({ board: BOARD, units }, { rng: stream.rng })
  if (scene.enemyActs) engine.step(END_TURN)
  const before = stream.draws()
  const events = engine.step(scene.action)
  const statuses = (id: string) => engine.getState().units.find((u) => u.id === id)!.statuses.map((s) => s.id)
  return { engine, events, draws: stream.draws() - before, statuses, victim }
}

/** The events with what the immunity may change taken out: the statuses laid and the `immune` mark. */
function withoutStatuses(events: readonly BattleEvent[]): unknown[] {
  return events.map((event) => {
    if (event.type === 'attack') {
      const { status: _status, onHitStatuses: _onHit, immune: _immune, ...rest } = event
      return rest
    }
    if (event.type === 'cast' || event.type === 'ability') {
      return { ...event, outcomes: event.outcomes.map(({ status: _status, immune: _immune, ...rest }) => rest) }
    }
    return event
  })
}

/**
 * Plays the scene with and without the flag, and checks what must hold of
 * every path: the same draws, the same events but for the statuses, and no
 * `immune` mark without the flag.
 */
function both(scene: Scene) {
  const plain = play(scene, false)
  const immune = play(scene, true)
  expect(immune.draws).toBe(plain.draws)
  expect(withoutStatuses(immune.events)).toEqual(withoutStatuses(plain.events))
  expect(JSON.stringify(plain.events)).not.toContain('"immune"')
  return { plain, immune }
}

const cast = (spell: SpellId, aim: { target: string } | { at: Hex }): Action => ({ type: 'cast', unit: 'hero', spell, ...aim })
const use = (unit: string, ability: string, aim: { target: string } | { at: Hex }): Action =>
  ({ type: 'ability', unit, ability: ability as AbilityId, ...aim }) as Action
const outcomes = (events: readonly BattleEvent[]) => (events[0] as CastEvent | AbilityEvent).outcomes
const attacks = (events: readonly BattleEvent[]) => events.filter((e): e is AttackEvent => e.type === 'attack')

// Abilities that lay a ticking status by the paths no listed ability lays one by today.
const TEST_ABILITIES: Record<string, Ability> = {
  // A rolled area with damage.
  test_spray: {
    name: 'Test Spray', verb: 'sprays', description: 'A test burst.', apCost: 4, recharge: 0,
    area: { shape: 'burst', range: 3, radius: 0, damage: { count: 1, sides: 4, bonus: 0 }, element: 'acid', status: { id: 'corroded', turns: 2 }, halfOnMiss: true },
  },
  // An area that rolls nothing.
  test_miasma: {
    name: 'Test Miasma', verb: 'fouls', description: 'A test aura.', apCost: 3, recharge: 0,
    area: { shape: 'burst', range: 0, radius: 2, status: { id: 'poisoned', turns: 2 }, halfOnMiss: false, foesOnly: true, auto: true, centredOnSelf: true },
  },
  // A status laid on a foe with no roll.
  test_sting: {
    name: 'Test Sting', verb: 'stings', description: 'A test mark.', apCost: 2, recharge: 0,
    foeStatus: { status: { id: 'poisoned', turns: 2 }, range: 3 },
  },
}

beforeAll(() => {
  Object.assign(ABILITIES as Record<string, Ability>, TEST_ABILITIES)
})
afterAll(() => {
  for (const id of Object.keys(TEST_ABILITIES)) delete (ABILITIES as Record<string, Ability>)[id]
})

describe('refusesStatus', () => {
  it('refuses an immune unit exactly the statuses whose rule has a tick, and no unit without the flag any', () => {
    const ticking = STATUS_IDS.filter((id) => STATUSES[id].tick !== undefined)
    expect(ticking).toEqual(expect.arrayContaining(['poisoned', 'corroded']))
    for (const id of STATUS_IDS) {
      expect(refusesStatus({ immune: true }, id)).toBe(ticking.includes(id))
      expect(refusesStatus({}, id)).toBe(false)
    }
  })
})

describe('an immune unit', () => {
  it('is logged under schema version 27 (stage 11 step 03, `immune` on attack events and outcomes)', () => {
    expect(LOG_SCHEMA_VERSION).toBe(27)
  })

  describe('is never laid a ticking status, the draws unchanged', () => {
    it('by a hostile spell with damage (Acid Arrow)', () => {
      const { plain, immune } = both({ hero: { magic: { maxMana: 60, skill: 76, spells: ['acid_arrow'] } }, action: cast('acid_arrow', { target: 'golem' }) })
      expect(outcomes(plain.events)[0]).toMatchObject({ hit: true, status: { id: 'corroded', turnsLeft: 3 } })
      expect(plain.draws).toBe(2)
      expect(outcomes(immune.events)[0]).toMatchObject({ hit: true, status: null, immune: true })
      expect(outcomes(immune.events)[0].damage).toBeGreaterThan(0)
      expect(immune.statuses('golem')).toEqual([])
    })

    it('by an area spell that only lays one (Death Cloud), the unit beside it poisoned all the same', () => {
      const { plain, immune } = both({
        hero: { magic: { maxMana: 60, skill: 76, spells: ['death_cloud'] } },
        other: hex(3, 1),
        action: cast('death_cloud', { at: hex(3, 1) }),
      })
      expect(outcomes(plain.events).map((o) => o.status?.id)).toEqual(['poisoned', 'poisoned'])
      expect(outcomes(immune.events)).toMatchObject([
        { unit: 'golem', hit: true, status: null, immune: true },
        { unit: 'other', hit: true, status: { id: 'poisoned', turnsLeft: 3 } },
      ])
      expect('immune' in outcomes(immune.events)[1]).toBe(false)
      expect(immune.statuses('golem')).toEqual([])
      expect(immune.statuses('other')).toEqual(['poisoned'])
    })

    it('by a rolled area ability', () => {
      const { plain, immune } = both({ hero: { abilities: ['test_spray' as AbilityId] }, action: use('hero', 'test_spray', { at: hex(2, 1) }) })
      expect(outcomes(plain.events)[0]).toMatchObject({ hit: true, status: { id: 'corroded', turnsLeft: 2 } })
      expect(outcomes(immune.events)[0]).toMatchObject({ hit: true, status: null, immune: true })
      expect(immune.statuses('golem')).toEqual([])
    })

    it('by a routine’s strike (the spider’s Venom Bite)', () => {
      const { plain, immune } = both({
        victim: 'hero',
        golem: { abilities: ['spider_bite'] },
        enemyActs: true,
        action: use('golem', 'spider_bite', { target: 'hero' }),
      })
      expect(attacks(plain.events).map((a) => a.status?.id)).toEqual([undefined, 'poisoned'])
      const [bite, venom] = attacks(immune.events)
      expect('immune' in bite).toBe(false)
      expect(venom).toMatchObject({ hit: true, strike: 'Venom Bite', immune: true })
      expect('status' in venom).toBe(false)
      expect(immune.statuses('hero')).toEqual([])
    })

    it('by a technique’s strike (Venom Strike)', () => {
      const { plain, immune } = both({ hero: { abilities: ['venom_strike'] }, action: use('hero', 'venom_strike', { target: 'golem' }) })
      expect(attacks(plain.events)[0].status).toEqual({ id: 'poisoned', turnsLeft: 3 })
      expect(attacks(immune.events)[0]).toMatchObject({ hit: true, immune: true })
      expect('status' in attacks(immune.events)[0]).toBe(false)
      expect(immune.statuses('golem')).toEqual([])
    })

    it('by a weapon’s on-hit effect (a Venom rune’s critical), the others it carries laid as ever', () => {
      const venom: OnHit = { damage: 2, element: 'poison', status: { id: 'poisoned', turns: 3 }, onCrit: true }
      const rime: OnHit = { damage: 3, element: 'frost', status: { id: 'chilled', turns: 1 }, onCrit: true }
      const scene: Scene = { hero: { onHit: [venom, rime] }, action: { type: 'attack', unit: 'hero', target: 'golem' } }
      // A roll of 1: a critical.
      const { plain, immune } = both({ ...scene, rng: [0.99, 0.5] })
      expect(attacks(plain.events)[0].onHitStatuses?.map((s) => s.id)).toEqual(['poisoned', 'chilled'])
      expect(attacks(immune.events)[0]).toMatchObject({ critical: true, onHitStatuses: [{ id: 'chilled', turnsLeft: 1 }], immune: true })
      // The rune's damage is still dealt: the ward is what stops that.
      expect(attacks(immune.events)[0].bonus).toEqual(attacks(plain.events)[0].bonus)
      expect(immune.statuses('golem')).toEqual(['chilled'])
      // A plain hit lays neither, so nothing is refused.
      const hit = both(scene)
      expect('immune' in attacks(hit.immune.events)[0]).toBe(false)
      // With the Venom rune alone, no status is left to record.
      const alone = both({ ...scene, hero: { onHit: [venom] }, rng: [0.99, 0.5] })
      expect(attacks(alone.immune.events)[0]).toMatchObject({ immune: true })
      expect('onHitStatuses' in attacks(alone.immune.events)[0]).toBe(false)
    })

    it('by an area that rolls nothing', () => {
      const { plain, immune } = both({ hero: { abilities: ['test_miasma' as AbilityId] }, other: hex(3, 1), action: use('hero', 'test_miasma', { at: hex(1, 1) }) })
      expect(plain.draws).toBe(0)
      expect(outcomes(plain.events).map((o) => o.status?.id)).toEqual(['poisoned', 'poisoned'])
      expect(outcomes(immune.events)).toMatchObject([
        { unit: 'golem', status: null, immune: true },
        { unit: 'other', status: { id: 'poisoned' } },
      ])
      expect(immune.statuses('golem')).toEqual([])
    })

    it('by an ability that lays one on a foe with no roll', () => {
      const { plain, immune } = both({ hero: { abilities: ['test_sting' as AbilityId] }, action: use('hero', 'test_sting', { target: 'golem' }) })
      expect(plain.draws).toBe(0)
      expect(outcomes(plain.events)[0].status).toEqual({ id: 'poisoned', turnsLeft: 2 })
      expect(outcomes(immune.events)[0]).toMatchObject({ status: null, immune: true })
      expect(immune.statuses('golem')).toEqual([])
    })

    it('so it never takes a tick', () => {
      const { immune } = both({ hero: { magic: { maxMana: 60, skill: 76, spells: ['death_cloud'] } }, action: cast('death_cloud', { at: hex(2, 1) }) })
      expect(immune.engine.step(END_TURN).map((e) => e.type)).toEqual(['end_turn'])
    })
  })

  describe('is still laid a status that does not tick', () => {
    const laidAlike = (scene: Scene, status: string, on: 'hero' | 'golem' = 'golem') => {
      const plain = play(scene, false)
      const immune = play(scene, true)
      expect(immune.events).toEqual(plain.events)
      expect(JSON.stringify(immune.events)).not.toContain('"immune"')
      expect(immune.statuses(on)).toEqual([status])
    }

    it('Cursed, by a spell', () => {
      laidAlike({ hero: { magic: { maxMana: 60, skill: 76, spells: ['curse'] } }, action: cast('curse', { target: 'golem' }) }, 'cursed')
    })

    it('Webbed, by a rolled area ability', () => {
      laidAlike({ victim: 'hero', golem: { toHit: 80, abilities: ['spider_web'] }, enemyActs: true, action: use('golem', 'spider_web', { at: hex(1, 1) }) }, 'webbed', 'hero')
    })

    it('Seared and Chilled, by a weapon’s on-hit effects', () => {
      const ember: OnHit = { damage: 3, element: 'fire', status: { id: 'seared', turns: 1 } }
      const rime: OnHit = { damage: 3, element: 'frost', status: { id: 'chilled', turns: 1 } }
      const scene: Scene = { hero: { onHit: [ember, rime] }, action: { type: 'attack', unit: 'hero', target: 'golem' } }
      const immune = play(scene, true)
      expect(immune.events).toEqual(play(scene, false).events)
      expect(immune.statuses('golem')).toEqual(['seared', 'chilled'])
    })

    it('Pinned, by a technique’s strike; Taunted and Marked, with no roll', () => {
      laidAlike({ hero: { abilities: ['pin'] }, action: use('hero', 'pin', { target: 'golem' }) }, 'pinned')
      laidAlike({ hero: { abilities: ['taunt'] }, action: use('hero', 'taunt', { at: hex(1, 1) }) }, 'taunted')
      laidAlike({ hero: { abilities: ['hunters_mark'] }, action: use('hero', 'hunters_mark', { target: 'golem' }) }, 'marked')
    })

    it('Shielded, by its own friendly spell', () => {
      const scene: Scene = { victim: 'hero', hero: { magic: { maxMana: 60, skill: 76, spells: ['shield'] } }, action: cast('shield', { target: 'hero' }) }
      laidAlike(scene, 'shielded', 'hero')
    })
  })

  describe('through a saved battle', () => {
    const arrow = cast('acid_arrow', { target: 'golem' })
    /** A seeded battle saved as it begins, as a save file would carry it, and taken up again. */
    const saved = (golem: Partial<CombatantStats>) => {
      const units: UnitSetup[] = [
        { id: 'hero', side: 'player', stats: { ...HERO_STATS, magic: { maxMana: 60, skill: 76, spells: ['acid_arrow'] } }, position: hex(1, 1) },
        { id: 'golem', side: 'enemy', stats: { ...GOLEM_STATS, ...golem }, position: hex(2, 1) },
      ]
      const snapshot = JSON.parse(JSON.stringify(new BattleEngine({ board: BOARD, units }, { seed: 7 }).snapshot()))
      return { snapshot, engine: BattleEngine.restore(snapshot) }
    }
    /** The outcome of the first Acid Arrow that lands, of the three a turn's action points pay for. */
    const firstHit = (engine: BattleEngine) => {
      const all = [1, 2, 3].map(() => (engine.step(arrow) as CastEvent[])[0].outcomes[0])
      const hit = all.find((o) => o.hit)
      expect(hit).toBeDefined()
      return hit!
    }

    it('a snapshot whose stats lack the field is read as a unit that is not immune', () => {
      const { snapshot, engine } = saved({})
      expect(JSON.stringify(snapshot)).not.toContain('immune')
      const hit = firstHit(engine)
      expect(hit.status).toMatchObject({ id: 'corroded' })
      expect('immune' in hit).toBe(false)
    })

    it('a snapshot that carries the flag keeps the immunity', () => {
      const { snapshot, engine } = saved({ immune: true })
      expect(snapshot.units[1].stats.immune).toBe(true)
      expect(firstHit(engine)).toMatchObject({ status: null, immune: true })
      expect(engine.getState().units[1].statuses).toEqual([])
    })
  })

  describe('formatEvent', () => {
    it('says a unit struck by a spell is unaffected by the rest, and one only touched is unaffected', () => {
      const arrow = play({ hero: { magic: { maxMana: 60, skill: 76, spells: ['acid_arrow'] } }, action: cast('acid_arrow', { target: 'golem' }) }, true)
      expect(formatEvent(arrow.events[0], NAMES)).toMatch(/^Hero casts Acid Arrow on Golem: rolls 34 \(needs \d+ or less\) — HITS Golem for \d+ dmg, unaffected by the rest\.$/)
      const cloud = play({ hero: { magic: { maxMana: 60, skill: 76, spells: ['death_cloud'] } }, other: hex(3, 1), action: cast('death_cloud', { at: hex(3, 1) }) }, true)
      expect(formatEvent(cloud.events[0], NAMES)).toBe('Hero casts Death Cloud: Golem is unaffected; Goblin is poisoned.')
    })

    it('says so after a strike’s damage, and after the statuses that were laid', () => {
      const bite = play({ victim: 'hero', golem: { abilities: ['spider_bite'] }, enemyActs: true, action: use('golem', 'spider_bite', { target: 'hero' }) }, true)
      expect(formatEvent(attacks(bite.events)[1], NAMES)).toMatch(/— HITS Hero for \d+ dmg, unaffected by the rest\.$/)
      const venom: OnHit = { damage: 2, element: 'poison', status: { id: 'poisoned', turns: 3 }, onCrit: true }
      const rime: OnHit = { damage: 3, element: 'frost', status: { id: 'chilled', turns: 1 }, onCrit: true }
      const crit = play({ hero: { onHit: [venom, rime] }, rng: [0.99, 0.5], action: { type: 'attack', unit: 'hero', target: 'golem' } }, true)
      expect(formatEvent(crit.events[0], NAMES)).toMatch(/ \+2 poison \+3 frost, chilled, unaffected by the rest\. CRITICAL HIT!$/)
    })

    it('says so of a status laid with no roll', () => {
      const sting = play({ hero: { abilities: ['test_sting' as AbilityId] }, action: use('hero', 'test_sting', { target: 'golem' }) }, true)
      expect(formatEvent(sting.events[0], NAMES)).toBe('Hero stings Golem. Golem is unaffected.')
      const miasma = play({ hero: { abilities: ['test_miasma' as AbilityId] }, other: hex(3, 1), action: use('hero', 'test_miasma', { at: hex(1, 1) }) }, true)
      expect(formatEvent(miasma.events[0], NAMES)).toBe('Hero fouls 1 foe. Golem is unaffected.')
    })
  })
})
