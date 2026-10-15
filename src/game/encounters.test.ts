import { describe, expect, it } from 'vitest'
import { createWarrior, deriveCombatStats } from '../character/character.ts'
import { mulberry32 } from '../combat/rng.ts'
import { POLICIES } from '../engine/policies.ts'
import { xpToNextLevel } from '../character/progression.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { hexDistance } from '../grid/hex.ts'
import { GOBLIN_STATS, foeAtLevel } from '../combat/combat.ts'
import { ENCOUNTERS, FOE_XP, MAX_THREAT, goblinRaid, heroId, koboldScouts, xpReward } from './encounters.ts'
import { readyMadeParty, partyFighters } from './party.ts'

/** A party of four: one more than a new game's, to stand in the second row. */
const party = () => partyFighters([...readyMadeParty(), createWarrior()])

describe.each(Object.entries(ENCOUNTERS))('the %s encounter', (_id, build) => {
  const wounded = party().map((fighter, i) => ({ ...fighter, hp: 5 + i }))
  const encounter = build(wounded)
  const state = new BattleEngine(encounter.setup).getState()

  it('gives every unit a kind to draw it by, and no others', () => {
    expect(Object.keys(encounter.kinds).sort()).toEqual(encounter.setup.units.map((u) => u.id).sort())
  })

  it('sets the party, in order and at the hit points given, against foes on the board', () => {
    const heroes = state.units.filter((u) => u.side === 'player')
    expect(heroes.map((u) => [u.id, u.hp, u.name])).toEqual(
      wounded.map((fighter, i) => [heroId(i), 5 + i, fighter.stats.name]),
    )
    expect(state.units.filter((u) => u.side === 'enemy').length).toBeGreaterThan(0)
    expect(new Set(state.units.map((u) => `${u.position.q},${u.position.r}`)).size).toBe(state.units.length)
  })

  it('lines the first three of the party up with a hex between each, and the fourth in a gap behind', () => {
    const [first, second, third, fourth] = state.units.filter((u) => u.side === 'player')
    for (const other of [second, third]) expect(hexDistance(first.position, other.position)).toBe(2)
    for (const front of [first, second]) expect(hexDistance(fourth.position, front.position)).toBe(1)
  })

  it('fights with a party of one', () => {
    const alone = new BattleEngine(build(party().slice(0, 1)).setup).getState()
    expect(alone.units.filter((u) => u.side === 'player').map((u) => u.id)).toEqual([heroId(0)])
  })
})

describe.each(Object.entries(ENCOUNTERS))('the %s encounter, as the threat rises', (_id, build) => {
  const foes = (threat: number) => build(party(), threat).setup.units.filter((u) => u.side === 'enemy')

  it('fields foes of that level, never fewer than before, each with a name and a hex of its own', () => {
    for (let threat = 1; threat <= MAX_THREAT; threat++) {
      const encounter = build(party(), threat)
      const state = new BattleEngine(encounter.setup).getState()
      expect(Object.keys(encounter.kinds).sort()).toEqual(encounter.setup.units.map((u) => u.id).sort())
      expect(new Set(state.units.map((u) => `${u.position.q},${u.position.r}`)).size).toBe(state.units.length)
      expect(new Set(foes(threat).map((u) => u.stats.name)).size).toBe(foes(threat).length)
      if (threat > 1) {
        expect(foes(threat).length).toBeGreaterThanOrEqual(foes(threat - 1).length)
        expect(foes(threat)[0].stats.maxHp).toBeGreaterThan(foes(threat - 1)[0].stats.maxHp)
      }
    }
    expect(foes(MAX_THREAT).length).toBeGreaterThan(foes(1).length)
  })

  it('is worth more the higher the threat', () => {
    for (let threat = 2; threat <= MAX_THREAT; threat++) {
      expect(xpReward(build(party(), threat))).toBeGreaterThan(xpReward(build(party(), threat - 1)))
    }
  })

  it('fights any threat past the top as the top', () => {
    expect(build(party(), MAX_THREAT + 3)).toEqual(build(party(), MAX_THREAT))
  })
})

describe('goblinRaid', () => {
  it('raises its foes to the level of the threat', () => {
    const [goblin] = goblinRaid(party(), 3).setup.units.filter((u) => u.side === 'enemy')
    expect(goblin.stats).toEqual({ ...foeAtLevel(GOBLIN_STATS, 3), name: 'Goblin' })
  })

  it('pits the party against a Goblin and a Kobold', () => {
    const state = new BattleEngine(goblinRaid(party()).setup).getState()
    expect(state.units.filter((u) => u.side === 'enemy').map((u) => [u.id, u.name])).toEqual([
      ['goblin', 'Goblin'],
      ['kobold', 'Kobold'],
    ])
  })
})

describe('the Goblin Shaman (A15)', () => {
  it('stays home at threat 1 and joins the raid from threat 2, a caster of its level', () => {
    const kinds = (threat: number) => Object.values(goblinRaid(party(), threat).kinds)
    expect(kinds(1)).not.toContain('shaman')
    expect(kinds(2)).toContain('shaman')
    const shaman = goblinRaid(party(), 3).setup.units.find((u) => u.id === 'shaman')!
    expect(shaman.stats.magic).toEqual({ maxMana: 20, skill: 70, spells: ['magic_arrow', 'heal', 'bane'] })
  })

  it('casts in a battle fought out by the policies', () => {
    const fighters = readyMadeParty().map((member) => ({ stats: deriveCombatStats(member) }))
    let casts = 0
    for (let seed = 1; seed <= 5; seed++) {
      const engine = new BattleEngine(goblinRaid(fighters, 2).setup, { seed })
      const rng = mulberry32(seed)
      for (let state = engine.getState(); state.phase !== 'over' && state.round < 50; state = engine.getState()) {
        engine.step(POLICIES.aggressive({ state, legal: engine.legalActions(), rng }))
      }
      casts += engine.getLog().filter((e) => e.type === 'cast' && e.caster === 'shaman').length
    }
    expect(casts).toBeGreaterThan(0)
  })
})

describe('xpReward', () => {
  it('adds up what the foes are worth, and nothing for the party', () => {
    expect(xpReward(goblinRaid(party()))).toBe(FOE_XP.goblin + FOE_XP.kobold)
    expect(xpReward(koboldScouts(party()))).toBe(2 * FOE_XP.kobold)
  })

  it('counts a foe of level L as L of its kind', () => {
    expect(xpReward(koboldScouts(party(), 2))).toBe(3 * FOE_XP.kobold * 2)
  })

  it('makes a lone Goblin, or any first battle, worth a new hero\'s second level', () => {
    expect(FOE_XP.goblin).toBeGreaterThanOrEqual(xpToNextLevel(1))
    for (const build of Object.values(ENCOUNTERS)) expect(xpReward(build(party()))).toBeGreaterThanOrEqual(xpToNextLevel(1))
  })
})
