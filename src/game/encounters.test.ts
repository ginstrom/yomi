import { describe, expect, it } from 'vitest'
import { createWarrior, deriveCombatStats } from '../character/character.ts'
import { mulberry32 } from '../combat/rng.ts'
import { POLICIES } from '../engine/policies.ts'
import { xpToNextLevel } from '../character/progression.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { hexDistance, offsetToHex } from '../grid/hex.ts'
import {
  ARMORED_TROLL_STATS,
  BLIGHT_HORROR_STATS,
  GOBLIN_SHAMAN_STATS,
  GOBLIN_STATS,
  HOBGOBLIN_CHIEF_STATS,
  KOBOLD_STATS,
  TROLL_STATS,
  foeAtLevel,
  foeYardstick,
  type CombatantStats,
} from '../combat/combat.ts'
import { BANDIT_ROLE, banditStats } from './bandits.ts'
import {
  ENCOUNTERS,
  ENCOUNTER_BANDS,
  ENCOUNTER_COUNTS,
  FOE_NATIVE_LEVEL,
  FOE_XP,
  MAX_THREAT,
  encountersFor,
  foeStats,
  banditCamp,
  type BanditKind,
  type EncounterId,
  type MonsterKind,
  goblinRaid,
  heroId,
  hobgoblinWarband,
  koboldScouts,
  sourceGuardians,
  trollLair,
  xpReward,
} from './encounters.ts'
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

describe.each(Object.entries(ENCOUNTERS))('the %s encounter, as the threat rises through its band', (id, build) => {
  const { min, max } = ENCOUNTER_BANDS[id as EncounterId]
  const foes = (threat: number) => build(party(), threat).setup.units.filter((u) => u.side === 'enemy')

  it('fields foes of that level, never fewer than before, each with a name and a hex of its own', () => {
    for (let threat = min; threat <= max; threat++) {
      const encounter = build(party(), threat)
      const state = new BattleEngine(encounter.setup).getState()
      expect(Object.keys(encounter.kinds).sort()).toEqual(encounter.setup.units.map((u) => u.id).sort())
      expect(new Set(state.units.map((u) => `${u.position.q},${u.position.r}`)).size).toBe(state.units.length)
      expect(new Set(foes(threat).map((u) => u.stats.name)).size).toBe(foes(threat).length)
      if (threat > min) {
        expect(foes(threat).length).toBeGreaterThanOrEqual(foes(threat - 1).length)
        expect(foes(threat)[0].stats.maxHp).toBeGreaterThan(foes(threat - 1)[0].stats.maxHp)
      }
    }
    expect(foes(max).length).toBeGreaterThan(foes(min).length)
  })

  it('is worth more the higher the threat', () => {
    for (let threat = min + 1; threat <= max; threat++) {
      expect(xpReward(build(party(), threat))).toBeGreaterThan(xpReward(build(party(), threat - 1)))
    }
  })

  it('fights any threat past the top as the top', () => {
    expect(build(party(), max + 3)).toEqual(build(party(), max))
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

describe('sourceGuardians', () => {
  it('fields the Blight Horror at every threat, a caster of its level', () => {
    for (let threat = 1; threat <= MAX_THREAT; threat++) {
      const [horror] = sourceGuardians(party(), threat).setup.units.filter((u) => u.side === 'enemy')
      expect(horror.stats).toEqual({ ...foeAtLevel(BLIGHT_HORROR_STATS, threat), name: 'Blight Horror' })
    }
    expect(BLIGHT_HORROR_STATS.magic?.spells).toEqual(['death_cloud', 'bane'])
  })

  it('is worth more than a Goblin Raid of the same threat', () => {
    expect(xpReward(sourceGuardians(party(), MAX_THREAT))).toBeGreaterThan(xpReward(goblinRaid(party(), MAX_THREAT)))
  })
})

describe('hobgoblinWarband', () => {
  it('fields the Hobgoblin Chief, in its mail, at every threat', () => {
    for (let threat = 1; threat <= MAX_THREAT; threat++) {
      const [chief] = hobgoblinWarband(party(), threat).setup.units.filter((u) => u.side === 'enemy')
      expect(chief.stats).toEqual({ ...foeAtLevel(HOBGOBLIN_CHIEF_STATS, threat), name: 'Hobgoblin Chief' })
    }
    expect(HOBGOBLIN_CHIEF_STATS.resistance).toBeGreaterThan(GOBLIN_STATS.resistance!)
  })
})

describe('trollLair', () => {
  const kinds = (threat: number) => Object.values(trollLair(party(), threat).kinds)

  it('fields a regenerating Troll at every threat', () => {
    for (let threat = 1; threat <= MAX_THREAT; threat++) expect(kinds(threat)).toContain('troll')
    expect(TROLL_STATS.regeneration).toBeGreaterThan(0)
  })

  it('keeps the Armoured Troll back below threat 5, a goblin taking its place', () => {
    expect(kinds(4)).not.toContain('armored_troll')
    expect(kinds(4)).toEqual(['warrior', 'warrior', 'warrior', 'warrior', 'troll', 'goblin', 'goblin'])
    expect(kinds(5)).toContain('armored_troll')
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

describe('banditCamp', () => {
  const field = (threat: number) =>
    banditCamp(party(), threat)
      .setup.units.filter((u) => u.side === 'enemy')
      .map((u) => u.id)
  const SLOTS = {
    captain: { kind: 'bandit_captain', name: 'Bandit Captain', at: [8, 4] },
    mage: { kind: 'bandit_mage', name: 'Hedge-Mage', at: [9, 4] },
    brute: { kind: 'bandit_brute', name: 'Bandit Brute', at: [8, 2] },
    archer: { kind: 'bandit_archer', name: 'Bandit Archer', at: [9, 6] },
    cutthroat: { kind: 'bandit_cutthroat', name: 'Cutthroat', at: [8, 6] },
  } as const

  it('is registered, with the band 3 to 7 and the counts 2, 2, 2, 4, 4', () => {
    expect(ENCOUNTERS.bandit_camp).toBe(banditCamp)
    expect(ENCOUNTER_BANDS.bandit_camp).toEqual({ min: 3, max: 7 })
    expect(ENCOUNTER_COUNTS.bandit_camp).toEqual([2, 2, 2, 4, 4])
  })

  it('fields the Captain and Brute at threat 3, the Captain and Hedge-Mage at 4 and 5, and four from 6', () => {
    expect(field(3)).toEqual(['captain', 'brute'])
    expect(field(4)).toEqual(['captain', 'mage'])
    expect(field(5)).toEqual(['captain', 'mage'])
    expect(field(6)).toEqual(['captain', 'mage', 'brute', 'archer'])
  })

  it('gives each bandit its kind, name and hex, and stats built by hero rules at the threat\'s level and grade', () => {
    for (const threat of [3, 4, 5]) {
      const camp = banditCamp(party(), threat)
      for (const unit of camp.setup.units.filter((u) => u.side === 'enemy')) {
        const slot = SLOTS[unit.id as keyof typeof SLOTS]
        expect(camp.kinds[unit.id]).toBe(slot.kind)
        expect(unit.position).toEqual(offsetToHex(slot.at[0], slot.at[1]))
        expect(unit.stats).toEqual({ ...foeStats(slot.kind, threat), name: slot.name })
      }
    }
    expect(foeStats('bandit_captain', 5)).toEqual(banditStats('captain', 5, 2))
    expect(foeStats('bandit_mage', 4)).toEqual(banditStats('mage', 4, 1))
  })

  it('fights a threat outside its band as the nearest in it', () => {
    for (const low of [1, 2.5]) {
      expect(banditCamp(party(), low)).toEqual(banditCamp(party(), 3))
      expect(banditCamp(party(), low).threat).toBe(3)
    }
    expect(banditCamp(party(), 9)).toEqual(banditCamp(party(), 7))
    expect(banditCamp(party(), 9).threat).toBe(7)
    expect(banditCamp(party()).threat).toBe(3)
  })

  it('pays 100 a level for each bandit, an even foe', () => {
    for (const kind of Object.keys(BANDIT_ROLE) as BanditKind[]) expect(FOE_XP[kind]).toBe(100)
    expect([3, 4, 5].map((threat) => xpReward(banditCamp(party(), threat)))).toEqual([600, 800, 1000])
  })
})

describe('the encounters\' bands and counts', () => {
  const ids = Object.keys(ENCOUNTERS) as EncounterId[]
  /** The five encounters the map had before bandits, which keep the band 1 to 5. */
  const today = ids.filter((id) => id !== 'bandit_camp')
  const foeCount = (id: EncounterId, threat: number) =>
    ENCOUNTERS[id](party(), threat).setup.units.filter((u) => u.side === 'enemy').length

  it('gives each of today\'s encounters the band 1 to 5', () => {
    expect(today.length).toBe(5)
    for (const id of today) expect(ENCOUNTER_BANDS[id]).toEqual({ min: 1, max: 5 })
  })

  it('gives every encounter one foe count for each threat of its band', () => {
    for (const id of ids) {
      expect(ENCOUNTER_COUNTS[id].length).toBe(ENCOUNTER_BANDS[id].max - ENCOUNTER_BANDS[id].min + 1)
    }
  })

  it('fields the foes it always has: 2, 3, 3, 3, 4 at threats 1 to 5', () => {
    for (const id of today) expect([1, 2, 3, 4, 5].map((threat) => foeCount(id, threat))).toEqual([2, 3, 3, 3, 4])
  })

  it('fights a threat outside its band as the nearest threat in it, and a fractional one as the whole below', () => {
    for (const id of today) {
      expect(ENCOUNTERS[id](party(), 0)).toEqual(ENCOUNTERS[id](party(), 1))
      expect(ENCOUNTERS[id](party(), 9)).toEqual(ENCOUNTERS[id](party(), 5))
      expect(ENCOUNTERS[id](party(), 3.7)).toEqual(ENCOUNTERS[id](party(), 3))
      expect(ENCOUNTERS[id](party(), 0).threat).toBe(1)
      expect(ENCOUNTERS[id](party(), 9).threat).toBe(5)
      expect(ENCOUNTERS[id](party(), 3.7).threat).toBe(3)
    }
  })

  it('lists the encounters whose band holds a threat, in order', () => {
    expect(encountersFor(1)).toEqual(today)
    expect(encountersFor(2)).toEqual(today)
    expect(encountersFor(3)).toEqual([...today, 'bandit_camp'])
    expect(encountersFor(5)).toEqual([...today, 'bandit_camp'])
    expect(encountersFor(6)).toEqual(['bandit_camp'])
    expect(encountersFor(7)).toEqual(['bandit_camp'])
    expect(encountersFor(8)).toEqual([])
    expect(encountersFor(0)).toEqual([])
  })

  it('keeps the top of today\'s map at 5', () => {
    expect(MAX_THREAT).toBe(5)
  })
})

/** Every monster kind's level 1 block, to check `foeStats` against. */
const BLOCKS: Record<MonsterKind, CombatantStats> = {
  goblin: GOBLIN_STATS,
  kobold: KOBOLD_STATS,
  shaman: GOBLIN_SHAMAN_STATS,
  horror: BLIGHT_HORROR_STATS,
  hobgoblin: HOBGOBLIN_CHIEF_STATS,
  troll: TROLL_STATS,
  armored_troll: ARMORED_TROLL_STATS,
}

describe('foeStats', () => {
  const kinds = Object.keys(BLOCKS) as MonsterKind[]

  it('gives every monster kind a native level, 1 for today\'s', () => {
    for (const kind of kinds) expect(FOE_NATIVE_LEVEL[kind]).toBe(1)
  })

  it('scales a monster from its block by foeAtLevel and its native level', () => {
    for (const kind of kinds) {
      for (let level = 1; level <= 5; level++) {
        expect(foeStats(kind, level)).toEqual(foeAtLevel(BLOCKS[kind], level, FOE_NATIVE_LEVEL[kind]))
      }
    }
  })
})

describe('the foe yardstick', () => {
  type Field = 'ac' | 'toHit' | 'maxHp' | 'meanDamage'
  /** The fields a kind is meant to sit outside the yardstick on, and why. */
  const EXCEPTIONS: ReadonlyArray<{ kind: MonsterKind; field: Field; reason: string }> = [
    { kind: 'goblin', field: 'maxHp', reason: 'level 1 foes are a hero\'s own size or less: a hero at level 1 has 32 hit points' },
    { kind: 'goblin', field: 'toHit', reason: 'level 1 foes hit less often than the band; they catch up by 5 a level' },
    { kind: 'kobold', field: 'maxHp', reason: 'the Kobold is a weak foe, worth 50 XP, and dies to a blow or two' },
    { kind: 'kobold', field: 'toHit', reason: 'the Kobold is a weak foe, and level 1 foes hit less often than the band' },
    { kind: 'shaman', field: 'maxHp', reason: 'the Goblin Shaman is frail, a caster to be hunted down' },
    { kind: 'shaman', field: 'toHit', reason: 'the Goblin Shaman\'s weapon is a staff it seldom uses; its spells strike by their own skill' },
    { kind: 'horror', field: 'meanDamage', reason: 'the Blight Horror is a boss: two claws of 2d6+2 a turn and a death cloud, meant to be fought at the top threat only' },
    { kind: 'horror', field: 'toHit', reason: 'a boss\'s level 1 block is a sketch for foeAtLevel to raise; it hits as other level 1 foes do' },
    { kind: 'hobgoblin', field: 'maxHp', reason: 'the Hobgoblin Chief\'s mail (resistance 4) stands for hit points, so its pool is small' },
    { kind: 'hobgoblin', field: 'meanDamage', reason: 'a morning star that pierces armour; a level 1 foe\'s damage is high against a 32 hit point fighter' },
    { kind: 'hobgoblin', field: 'toHit', reason: 'level 1 foes hit less often than the band; they catch up by 5 a level' },
    { kind: 'troll', field: 'maxHp', reason: 'the Troll regenerates 3 a turn, which does the work of hit points' },
    { kind: 'troll', field: 'meanDamage', reason: 'two claws a turn, to make up for hit points a regenerating foe loses' },
    { kind: 'troll', field: 'toHit', reason: 'level 1 foes hit less often than the band; they catch up by 5 a level' },
    { kind: 'armored_troll', field: 'maxHp', reason: 'plates (resistance 5) and regeneration stand for hit points, so its pool is small' },
    { kind: 'armored_troll', field: 'meanDamage', reason: 'one heavy blow of 2d6+2 a turn, the damage of a foe that is a danger in melee' },
    { kind: 'armored_troll', field: 'toHit', reason: 'level 1 foes hit less often than the band; they catch up by 5 a level' },
  ]

  const meanDamage = (s: CombatantStats) =>
    Math.max(1, Math.floor(s.actionPoints / s.attackApCost)) * ((s.damage.count * (s.damage.sides + 1)) / 2 + s.damage.bonus)

  it.each(Object.keys(BLOCKS) as MonsterKind[])('holds the %s to the yardstick at its native level, but for named exceptions', (kind) => {
    const level = FOE_NATIVE_LEVEL[kind]
    const stats = foeStats(kind, level)
    const yardstick = foeYardstick(level)
    const values: Record<Field, number> = { ac: stats.ac, toHit: stats.toHit, maxHp: stats.maxHp, meanDamage: meanDamage(stats) }
    const outside = (Object.keys(values) as Field[]).filter(
      (field) => values[field] < yardstick[field][0] || values[field] > yardstick[field][1],
    )
    const named = EXCEPTIONS.filter((e) => e.kind === kind).map((e) => e.field)
    expect(outside.sort(), `${kind}: ${outside.map((f) => `${f} ${values[f]} outside [${yardstick[f]}]`).join('; ')}`).toEqual(named.sort())
  })

  it('names a reason for every exception', () => {
    for (const e of EXCEPTIONS) expect(e.reason.length).toBeGreaterThan(10)
  })
})
