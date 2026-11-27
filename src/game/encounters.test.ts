import { describe, expect, it } from 'vitest'
import { createWarrior, deriveCombatStats } from '../character/character.ts'
import { mulberry32 } from '../combat/rng.ts'
import { POLICIES } from '../engine/policies.ts'
import { xpToNextLevel } from '../character/progression.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import type { UnitSetup } from '../engine/battleEngine.ts'
import { hexDistance, offsetToHex } from '../grid/hex.ts'
import {
  ARMORED_TROLL_STATS,
  BARROW_WIGHT_STATS,
  BLIGHT_CULTIST_STATS,
  STONE_GOLEM_STATS,
  YOUNG_DRAGON_STATS,
  BLIGHT_LICH_STATS,
  ELDER_WYRM_STATS,
  BASILISK_STATS,
  BLIGHT_HORROR_STATS,
  GIANT_SPIDER_STATS,
  GOBLIN_SHAMAN_STATS,
  GOBLIN_STATS,
  HILL_GIANT_STATS,
  HOBGOBLIN_CHIEF_STATS,
  KOBOLD_STATS,
  OGRE_STATS,
  SALAMANDER_STATS,
  TROLL_STATS,
  WOLF_STATS,
  WORG_RIDER_STATS,
  WYVERN_STATS,
  foeAtLevel,
  foeYardstick,
  type CombatantStats,
  type DamageRoll,
} from '../combat/combat.ts'
import { ABILITIES, type AbilityId } from '../combat/abilities.ts'
import { BANDIT_ROLE, banditStats } from './bandits.ts'
import {
  ENCOUNTERS,
  ENCOUNTER_BANDS,
  ENCOUNTER_COUNTS,
  FOE_NATIVE_LEVEL,
  FOE_XP,
  encountersFor,
  foeStats,
  banditCamp,
  banditCompany,
  barrowWights,
  basiliskLair,
  blightCult,
  golemRuin,
  youngDragon,
  blightLichCourt,
  elderWyrm,
  freebooterHost,
  type BanditKind,
  type EncounterId,
  type MonsterKind,
  goblinRaid,
  hillGiantSteading,
  heroId,
  hobgoblinWarband,
  koboldScouts,
  ogreCamp,
  salamanderPool,
  sourceGuardians,
  SOURCE_FOE_LEVEL,
  spiderNest,
  trollLair,
  wolfPack,
  worgRiders,
  wyvernRoost,
  xpReward,
} from './encounters.ts'
import { readyMadeParty, partyFighters } from './party.ts'

/** A party of four: one more than a new game's, to stand in the second row. */
const party = () => partyFighters([...readyMadeParty(), createWarrior()])
/** The home rings' threats, today's encounters' band (1 to 5). */
const HOME_THREATS = 5
/** Ring 7's counts, from each band's first threat up (stage 11 step 08; the cells' tuning is in the plan's log). */
const WOLF_PACK_COUNTS = [4, 4, 4, 5]
const WORG_RIDERS_COUNTS = [3, 3, 5]
const OGRE_CAMP_COUNTS = [3, 3, 3, 4]
/** Ring 9's counts (stage 11 step 09; the cells' tuning is in the plan's log). */
const WYVERN_ROOST_COUNTS = [4, 4, 3, 3]
/** Ring 12's counts (stage 11 step 10; the cells' tuning is in the plan's log). */
const BARROW_WIGHTS_COUNTS = [4, 4, 4, 4]
const BASILISK_LAIR_COUNTS = [3, 3, 3, 3]
const HILL_GIANT_STEADING_COUNTS = [3, 3, 3, 3]
/** Ring 15's counts (stage 11 step 11; the cells' tuning is in the plan's log). */
const GOLEM_RUIN_COUNTS = [4, 4, 4, 5]
const BLIGHT_CULT_COUNTS = [5, 4, 4, 5, 5]
const YOUNG_DRAGON_COUNTS = [2, 2, 3, 3]
/** Ring 18's counts (stage 11 step 12; the cells' tuning is in the plan's log). */
const BLIGHT_LICH_COURT_COUNTS = [5, 5, 5, 4]
const ELDER_WYRM_COUNTS = [2, 2, 2]

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
  /**
   * The one encounter whose numbers fall as the threat rises, by the user's decision (stage 11 step 09): the Wyvern
   * Roost fields four at 9 and 10 and three at 11 and 12, as the expected kit is the same across its band while the
   * wyverns grow. So threat 11 fields fewer than 10 and is worth less (three wyverns of 11 against four of 10).
   * And the Blight Cult, by the user's decision (stage 11 step 11): five at 14, four at 15 and 16 (without the Cult
   * Elder), five at 17 and 18, as every foe gains 5 to hit and armour class from 14 to 15 and the kit not until 17.
   * And the Blight Lich's Court (stage 11 step 12): five at 17 to 19 and four at 20 (without the Lich's Herald), as
   * the kit is the same from 17 to 20 while the court grows (five at 20 were won 287 times in 500).
   */
  const falls = id === 'wyvern_roost' || id === 'blight_cult' || id === 'blight_lich_court'
  /** Where a falling encounter's count changes, by how many foes: the threats not named keep their count. */
  const FALLS: Partial<Record<EncounterId, Record<number, number>>> = { wyvern_roost: { 11: -1 }, blight_cult: { 15: -1, 17: 1 }, blight_lich_court: { 20: -1 } }
  const fallsAt = (threat: number) => FALLS[id as EncounterId]?.[threat] ?? 0

  it('fields foes of that level, never fewer than before, each with a name and a hex of its own', { timeout: 20_000 }, () => {
    // Each threat's encounter is built once, its foes kept for the next threat's comparison.
    let before: UnitSetup[] | null = null
    for (let threat = min; threat <= max; threat++) {
      const encounter = build(party(), threat)
      const state = new BattleEngine(encounter.setup).getState()
      const now = encounter.setup.units.filter((u) => u.side === 'enemy')
      expect(Object.keys(encounter.kinds).sort()).toEqual(encounter.setup.units.map((u) => u.id).sort())
      expect(new Set(state.units.map((u) => `${u.position.q},${u.position.r}`)).size).toBe(state.units.length)
      expect(new Set(now.map((u) => u.stats.name)).size).toBe(now.length)
      if (before !== null) {
        if (falls) expect([threat, now.length - before.length]).toEqual([threat, fallsAt(threat)])
        else expect(now.length).toBeGreaterThanOrEqual(before.length)
        // The Source's guardians stop growing at SOURCE_FOE_LEVEL (stage 9 step 09), and hold there.
        const held = id === 'source_guardians' && threat > SOURCE_FOE_LEVEL
        if (held) expect(now[0].stats.maxHp).toBe(before[0].stats.maxHp)
        else expect(now[0].stats.maxHp).toBeGreaterThan(before[0].stats.maxHp)
      }
      before = now
    }
    // More at the top than at the bottom, unless the band's counts are flat by design (stage 9 decision 6).
    const flat = new Set(ENCOUNTER_COUNTS[id as EncounterId]).size === 1
    if (max > min && !flat && !falls) expect(foes(max).length).toBeGreaterThan(foes(min).length)
  })

  it('is worth more the higher the threat', () => {
    for (let threat = min + 1; threat <= max; threat++) {
      if (fallsAt(threat) < 0) expect(xpReward(build(party(), threat))).toBeLessThan(xpReward(build(party(), threat - 1)))
      else expect(xpReward(build(party(), threat))).toBeGreaterThan(xpReward(build(party(), threat - 1)))
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
    for (let threat = 1; threat <= HOME_THREATS; threat++) {
      const [horror] = sourceGuardians(party(), threat).setup.units.filter((u) => u.side === 'enemy')
      expect(horror.stats).toEqual({ ...foeAtLevel(BLIGHT_HORROR_STATS, threat), name: 'Blight Horror' })
    }
    expect(BLIGHT_HORROR_STATS.magic?.spells).toEqual(['death_cloud', 'bane'])
  })

  it('raises its foes to SOURCE_FOE_LEVEL at most past threat 5, and to the threat itself up to 5', () => {
    expect(SOURCE_FOE_LEVEL).toBeGreaterThanOrEqual(HOME_THREATS)
    const horror = (threat: number) => sourceGuardians(party(), threat).setup.units.find((u) => u.id === 'horror')!.stats
    for (let threat = 1; threat <= HOME_THREATS; threat++) expect(horror(threat).ac).toBe(foeAtLevel(BLIGHT_HORROR_STATS, threat).ac)
    for (const threat of [6, 12, 20]) expect(horror(threat)).toEqual({ ...foeAtLevel(BLIGHT_HORROR_STATS, Math.min(threat, SOURCE_FOE_LEVEL)), name: 'Blight Horror' })
  })

  it('is worth more than a Goblin Raid of the same threat', () => {
    expect(xpReward(sourceGuardians(party(), HOME_THREATS))).toBeGreaterThan(xpReward(goblinRaid(party(), HOME_THREATS)))
  })

  it('is fought at threats 1 to 20: today\'s counts to 5, then all five guardians', () => {
    expect(ENCOUNTER_BANDS.source_guardians).toEqual({ min: 1, max: 20 })
    expect(ENCOUNTER_COUNTS.source_guardians).toEqual([2, 3, 3, 3, 4, ...Array(15).fill(5)])
  })

  it('fields the same four at threat 5 as before stage 9, and all five slots at the Source\'s threat, raised to SOURCE_FOE_LEVEL at most', () => {
    const field = (threat: number) => sourceGuardians(party(), threat).setup.units.filter((u) => u.side === 'enemy')
    expect(field(5).map((u) => u.id)).toEqual(['horror', 'brute', 'shaman', 'sneak'])
    const top = sourceGuardians(party(), 20)
    expect(top.threat).toBe(20)
    expect(field(20).map((u) => [u.id, top.kinds[u.id]])).toEqual([
      ['horror', 'horror'],
      ['brute', 'goblin'],
      ['shaman', 'shaman'],
      ['sneak', 'kobold'],
      ['cutter', 'goblin'],
    ])
    for (const u of field(20)) expect(u.stats).toEqual({ ...foeStats(top.kinds[u.id] as MonsterKind, SOURCE_FOE_LEVEL), name: u.stats.name })
    expect(sourceGuardians(party(), 25)).toEqual(top)
  })
})

describe('hobgoblinWarband', () => {
  it('fields the Hobgoblin Chief, in its mail, at every threat', () => {
    for (let threat = 1; threat <= HOME_THREATS; threat++) {
      const [chief] = hobgoblinWarband(party(), threat).setup.units.filter((u) => u.side === 'enemy')
      expect(chief.stats).toEqual({ ...foeAtLevel(HOBGOBLIN_CHIEF_STATS, threat), name: 'Hobgoblin Chief' })
    }
    expect(HOBGOBLIN_CHIEF_STATS.resistance).toBeGreaterThan(GOBLIN_STATS.resistance!)
  })
})

describe('trollLair', () => {
  const kinds = (threat: number) => Object.values(trollLair(party(), threat).kinds)

  it('fields a regenerating Troll at every threat', () => {
    for (let threat = 1; threat <= HOME_THREATS; threat++) expect(kinds(threat)).toContain('troll')
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
    crossbowman: { kind: 'bandit_crossbowman', name: 'Bandit Crossbowman', at: [9, 2] },
    brute: { kind: 'bandit_brute', name: 'Bandit Brute', at: [8, 2] },
    archer: { kind: 'bandit_archer', name: 'Bandit Archer', at: [9, 6] },
    cutthroat: { kind: 'bandit_cutthroat', name: 'Cutthroat', at: [8, 6] },
  } as const

  it('is registered, with the band 3 to 7 and the counts 2, 2, 2, 4, 4', () => {
    expect(ENCOUNTERS.bandit_camp).toBe(banditCamp)
    expect(ENCOUNTER_BANDS.bandit_camp).toEqual({ min: 3, max: 7 })
    expect(ENCOUNTER_COUNTS.bandit_camp).toEqual([2, 2, 2, 4, 4])
  })

  it('fields the Captain with the Brute at threat 3, the Hedge-Mage at 4 and the Archer at 5, and the Crossbowman in the fourth place from 6', () => {
    expect(field(3)).toEqual(['captain', 'brute'])
    expect(field(4)).toEqual(['captain', 'mage'])
    expect(field(5)).toEqual(['captain', 'archer'])
    expect(field(6)).toEqual(['captain', 'archer', 'mage', 'crossbowman'])
    expect(field(7)).toEqual(['captain', 'archer', 'mage', 'crossbowman'])
  })

  it('gives each bandit its kind, name and hex, and stats built by hero rules at the threat\'s level and grade', () => {
    for (const threat of [3, 4, 5, 6, 7]) {
      const camp = banditCamp(party(), threat)
      for (const unit of camp.setup.units.filter((u) => u.side === 'enemy')) {
        const slot = SLOTS[unit.id as keyof typeof SLOTS]
        expect(camp.kinds[unit.id]).toBe(slot.kind)
        expect(unit.position).toEqual(offsetToHex(slot.at[0], slot.at[1]))
        expect(unit.stats).toEqual({ ...foeStats(slot.kind, threat), name: slot.name })
      }
    }
    expect(foeStats('bandit_captain', 5)).toEqual(banditStats('captain', 5, { tier: 1, grade: 2 }))
    expect(foeStats('bandit_mage', 4)).toEqual(banditStats('mage', 4, { tier: 1, grade: 1 }))
    expect(foeStats('bandit_archer', 5)).toEqual(banditStats('archer', 5, { tier: 1, grade: 2 }))
    expect(foeStats('bandit_captain', 6)).toEqual(banditStats('captain', 6, { tier: 2, grade: 2 }))
    expect(foeStats('bandit_crossbowman', 6)).toEqual(banditStats('crossbowman', 6, { tier: 2, grade: 2 }))
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
    expect([3, 4, 5, 6].map((threat) => xpReward(banditCamp(party(), threat)))).toEqual([600, 800, 1000, 2400])
  })
})

/** The two far bandit encounters: their slots (id, kind, name, hex), band and counts, as C1 of stage 9's plan names them. */
describe.each([
  {
    id: 'bandit_company' as const,
    build: banditCompany,
    band: { min: 8, max: 13 },
    counts: [4, 4, 4, 4, 4, 4],
    kinds: ['bandit_brute', 'bandit_crossbowman', 'bandit_mage', 'bandit_archer', 'bandit_cutthroat'],
    names: ['Bandit Sergeant'],
  },
  {
    id: 'freebooter_host' as const,
    build: freebooterHost,
    band: { min: 14, max: 20 },
    counts: [4, 4, 4, 5, 5, 5, 5],
    kinds: ['bandit_captain', 'bandit_brute', 'bandit_crossbowman', 'bandit_mage', 'bandit_archer'],
    names: ['Freebooter Captain'],
  },
])('the far bandits: $id', ({ id, build, band, counts, kinds, names }) => {
  const enemies = (threat: number) => build(party(), threat).setup.units.filter((u) => u.side === 'enemy')

  it('is registered, after the Salamander Pool, with its band and counts', () => {
    const ids = Object.keys(ENCOUNTERS)
    expect(ENCOUNTERS[id]).toBe(build)
    expect(ids.indexOf(id)).toBeGreaterThan(ids.indexOf('salamander_pool'))
    expect(ENCOUNTER_BANDS[id]).toEqual(band)
    expect(ENCOUNTER_COUNTS[id]).toEqual(counts)
    expect(build(party()).threat).toBe(band.min)
  })

  it('fields its count of bandits at every threat of its band, the first slots in order, each at the threat\'s level and gear', () => {
    for (let threat = band.min; threat <= band.max; threat++) {
      const encounter = build(party(), threat)
      const foes = enemies(threat)
      expect(encounter.threat).toBe(threat)
      expect(foes.length).toBe(counts[threat - band.min])
      expect(foes.map((u) => encounter.kinds[u.id])).toEqual(kinds.slice(0, foes.length))
      for (const u of foes) {
        const kind = encounter.kinds[u.id] as BanditKind
        // Masterwork steel at 8; long-campaign stage 10: Fine mithril at 9 to 11, Fine adamant at 12 to 17, Masterwork starmetal from 18.
        const gear =
          threat >= 18 ? ({ tier: 5, grade: 3 } as const)
          : threat >= 12 ? ({ tier: 4, grade: 2 } as const)
          : threat >= 9 ? ({ tier: 3, grade: 2 } as const)
          : ({ tier: 2, grade: 3 } as const)
        expect(u.stats).toEqual({ ...banditStats(BANDIT_ROLE[kind], threat, gear), name: u.stats.name })
      }
    }
    expect(enemies(band.min)[0].stats.name).toBe(names[0])
  })

  it('stands every slot in the far columns, 8 and 9, on a hex of its own', () => {
    const far = [8, 9].flatMap((col) => Array.from({ length: 9 }, (_, row) => offsetToHex(col, row)))
    const foes = build(party(), 30).setup.units.filter((u) => u.side === 'enemy')
    for (const u of foes) expect(far).toContainEqual(u.position)
    expect(new Set(foes.map((u) => `${u.position.q},${u.position.r}`)).size).toBe(foes.length)
  })

  it('clamps a threat outside its band to the nearest in it, and pays more the higher the threat', () => {
    expect(build(party(), band.min - 3)).toEqual(build(party(), band.min))
    expect(build(party(), band.max + 3)).toEqual(build(party(), band.max))
    for (let threat = band.min + 1; threat <= band.max; threat++) {
      expect(xpReward(build(party(), threat))).toBeGreaterThan(xpReward(build(party(), threat - 1)))
    }
    expect(xpReward(build(party(), band.min))).toBe(100 * counts[0] * band.min)
  })
})

describe('spiderNest', () => {
  const field = (threat: number) =>
    spiderNest(party(), threat)
      .setup.units.filter((u) => u.side === 'enemy')
      .map((u) => u.id)

  it('is registered, with the band 4 to 9 and the counts 3 at threat 4 and 4 from 5', () => {
    expect(ENCOUNTERS.spider_nest).toBe(spiderNest)
    expect(ENCOUNTER_BANDS.spider_nest).toEqual({ min: 4, max: 9 })
    expect(ENCOUNTER_COUNTS.spider_nest).toEqual([3, 4, 4, 4, 4, 4])
  })

  it('fields a Giant Spider, a Kobold Sneak and a Brood Spider at threat 4, and a Nest Spider too from threat 5 to 9', () => {
    for (const threat of [1, 4]) {
      expect(field(threat)).toEqual(['spider', 'sneak', 'spider2'])
      expect(spiderNest(party(), threat).threat).toBe(4)
    }
    for (const threat of [5, 9, 12]) {
      expect(field(threat)).toEqual(['spider', 'sneak', 'spider2', 'spider3'])
      expect(spiderNest(party(), threat).threat).toBe(Math.min(threat, 9))
    }
    expect(spiderNest(party()).threat).toBe(5)
  })

  it('names and places its foes', () => {
    const units = spiderNest(party(), 5).setup.units.filter((u) => u.side === 'enemy')
    expect(units.map((u) => [u.id, u.stats.name, u.position])).toEqual([
      ['spider', 'Giant Spider', offsetToHex(8, 4)],
      ['sneak', 'Kobold Sneak', offsetToHex(9, 2)],
      ['spider2', 'Brood Spider', offsetToHex(8, 6)],
      ['spider3', 'Nest Spider', offsetToHex(9, 6)],
    ])
  })

  it('pays (100 + 50 + 100 + 100) x 5', () => {
    expect(xpReward(spiderNest(party(), 5))).toBe((100 + 50 + 100 + 100) * 5)
  })
})

describe('salamanderPool', () => {
  it('is registered, with the band 5 to 9 and the count 3 at each', () => {
    expect(ENCOUNTERS.salamander_pool).toBe(salamanderPool)
    expect(ENCOUNTER_BANDS.salamander_pool).toEqual({ min: 5, max: 9 })
    expect(ENCOUNTER_COUNTS.salamander_pool).toEqual([3, 3, 3, 3, 3])
  })

  it('fields a Salamander between two Kobolds at any threat, fought as the nearest of 5 to 9', () => {
    for (const threat of [1, 5, 9, 12]) {
      const pool = salamanderPool(party(), threat)
      expect(pool.threat).toBe(Math.min(Math.max(threat, 5), 9))
      expect(pool.setup.units.filter((u) => u.side === 'enemy').map((u) => [u.id, u.stats.name, u.position])).toEqual([
        ['salamander', 'Salamander', offsetToHex(8, 4)],
        ['kobold', 'Kobold Stoker', offsetToHex(8, 2)],
        ['kobold2', 'Kobold Warden', offsetToHex(8, 6)],
      ])
    }
    expect(salamanderPool(party()).threat).toBe(5)
  })

  it('pays (120 + 50 + 50) x 5', () => {
    expect(xpReward(salamanderPool(party(), 5))).toBe((120 + 50 + 50) * 5)
  })
})

describe('the Giant Spider and the Salamander', () => {
  it('keeps the spider\'s block at its native level, a level on at 5', () => {
    expect(foeStats('giant_spider', 4)).toEqual({ ...GIANT_SPIDER_STATS, abilityDamageBonus: 0 })
    expect(foeStats('giant_spider', 5)).toEqual(foeAtLevel(GIANT_SPIDER_STATS, 5, 4))
    expect(foeStats('giant_spider', 4).abilities).toEqual(['spider_bite', 'spider_web'])
    expect(GIANT_SPIDER_STATS.magic).toBeUndefined()
  })

  it('wards the Salamander against fire and gives it the Fire Spit', () => {
    const stats = foeStats('salamander', 5)
    expect(stats.wards?.fire).toBe(99)
    expect(stats.abilities).toEqual(['fire_spit'])
    expect(stats).toEqual({ ...SALAMANDER_STATS, abilityDamageBonus: 0 })
  })
})

describe('ring 7\'s encounters (long-campaign stage 11 step 08)', () => {
  /** The foes an encounter fields at a threat: [kind, name], in slot order. */
  const fielded = (build: typeof wolfPack, threat: number) => {
    const { setup, kinds } = build(party(), threat)
    return setup.units.filter((u) => u.side === 'enemy').map((u) => [kinds[u.id], u.stats.name])
  }
  /** Every foe of the encounter at `threat` is its kind at that level, under its own name. */
  const atLevel = (build: typeof wolfPack, threat: number) => {
    const { setup, kinds, threat: fought } = build(party(), threat)
    expect(fought).toBe(threat)
    for (const u of setup.units.filter((u) => u.side === 'enemy')) {
      expect(u.stats).toEqual({ ...foeStats(kinds[u.id] as MonsterKind, threat), name: u.stats.name })
    }
  }

  it('are registered after the Freebooter Host, in order, with their bands and counts', () => {
    expect(Object.keys(ENCOUNTERS).slice(Object.keys(ENCOUNTERS).indexOf('wolf_pack')).slice(0, 3)).toEqual(['wolf_pack', 'worg_riders', 'ogre_camp'])
    expect(Object.keys(ENCOUNTERS).indexOf('wolf_pack')).toBe(Object.keys(ENCOUNTERS).indexOf('freebooter_host') + 1)
    expect([ENCOUNTER_BANDS.wolf_pack, ENCOUNTER_BANDS.worg_riders, ENCOUNTER_BANDS.ogre_camp]).toEqual([
      { min: 6, max: 9 },
      { min: 7, max: 9 },
      { min: 7, max: 10 },
    ])
    expect(ENCOUNTER_COUNTS.wolf_pack).toEqual(WOLF_PACK_COUNTS)
    expect(ENCOUNTER_COUNTS.worg_riders).toEqual(WORG_RIDERS_COUNTS)
    expect(ENCOUNTER_COUNTS.ogre_camp).toEqual(OGRE_CAMP_COUNTS)
  })

  it('fields the Wolf Pack, the Pack Leader first: wolves only, at both ends of 6 to 9', () => {
    const pack = [
      ['wolf', 'Pack Leader'],
      ['wolf', 'Grey Wolf'],
      ['wolf', 'Lean Wolf'],
      ['wolf', 'Scarred Wolf'],
      ['wolf', 'Young Wolf'],
    ]
    expect(fielded(wolfPack, 6)).toEqual(pack.slice(0, WOLF_PACK_COUNTS[0]))
    expect(fielded(wolfPack, 9)).toEqual(pack.slice(0, WOLF_PACK_COUNTS[3]))
    atLevel(wolfPack, 6)
    atLevel(wolfPack, 9)
    expect(wolfPack(party(), 5)).toEqual(wolfPack(party(), 6))
  })

  it('fields the Worg Riders, the Chief leading: three riders at 7, and from 8 the wolves in the Outrider\'s place, five at 9', () => {
    expect(fielded(worgRiders, 7)).toEqual([
      ['worg_rider', 'Worg Rider Chief'],
      ['worg_rider', 'Worg Rider'],
      ['worg_rider', 'Worg Outrider'],
    ])
    expect(fielded(worgRiders, 8)).toEqual([
      ['worg_rider', 'Worg Rider Chief'],
      ['wolf', 'Grey Wolf'],
      ['worg_rider', 'Worg Rider'],
    ])
    expect(fielded(worgRiders, 9)).toEqual([
      ['worg_rider', 'Worg Rider Chief'],
      ['wolf', 'Grey Wolf'],
      ['worg_rider', 'Worg Rider'],
      ['wolf', 'Lean Wolf'],
      ['wolf', 'Young Wolf'],
    ])
    expect(WORG_RIDERS_COUNTS).toEqual([3, 3, 5])
    atLevel(worgRiders, 7)
    atLevel(worgRiders, 9)
    expect(worgRiders(party(), 6)).toEqual(worgRiders(party(), 7))
  })

  it('fields the Ogre Camp, an Ogre leading, with a rider, a second Ogre and a wolf, at both ends of 7 to 10', () => {
    const camp = [
      ['ogre', 'Ogre'],
      ['worg_rider', 'Worg Rider'],
      ['ogre', 'Ogre Brute'],
      ['wolf', 'Camp Wolf'],
    ]
    expect(fielded(ogreCamp, 7)).toEqual(camp.slice(0, OGRE_CAMP_COUNTS[0]))
    expect(fielded(ogreCamp, 10)).toEqual(camp.slice(0, OGRE_CAMP_COUNTS[3]))
    atLevel(ogreCamp, 7)
    atLevel(ogreCamp, 10)
  })

  it('writes the kinds as campaign §5.5 has them: the Wolf fast and unarmoured, the Rider and the Ogre with their abilities', () => {
    expect(foeStats('wolf', 6)).toEqual(WOLF_STATS)
    expect(WOLF_STATS).toMatchObject({ actionPoints: 10, attackRange: 1 })
    expect(WOLF_STATS.resistance ?? 0).toBe(0)
    expect(WOLF_STATS.abilities).toBeUndefined()
    expect(foeStats('worg_rider', 7)).toEqual({ ...WORG_RIDER_STATS, abilityDamageBonus: 0 })
    expect(WORG_RIDER_STATS).toMatchObject({ resistance: 1, abilities: ['worg_strikes'] })
    expect(foeStats('ogre', 7)).toEqual({ ...OGRE_STATS, abilityDamageBonus: 0 })
    expect(OGRE_STATS).toMatchObject({ resistance: 2, abilities: ['ogre_sweep'] })
    expect([FOE_XP.wolf, FOE_XP.worg_rider, FOE_XP.ogre]).toEqual([80, 100, 140])
  })
})

describe('ring 9\'s encounter (long-campaign stage 11 step 09)', () => {
  const fielded = (threat: number) => {
    const { setup, kinds } = wyvernRoost(party(), threat)
    return setup.units.filter((u) => u.side === 'enemy').map((u) => [kinds[u.id], u.stats.name, u.stats])
  }
  const ROOST = ['Wyvern', 'Wyvern Mate', 'Young Wyvern', 'Old Wyvern']

  it('is registered after ring 7\'s, with its band and counts', () => {
    expect(Object.keys(ENCOUNTERS).indexOf('wyvern_roost')).toBe(Object.keys(ENCOUNTERS).indexOf('ogre_camp') + 1)
    expect(ENCOUNTER_BANDS.wyvern_roost).toEqual({ min: 9, max: 12 })
    expect(ENCOUNTER_COUNTS.wyvern_roost).toEqual(WYVERN_ROOST_COUNTS)
  })

  it.each([
    [9, 0],
    [12, 3],
  ])('fields the Wyvern Roost at threat %i: wyverns only, each the kind at that level under its own name', (threat, index) => {
    const foes = fielded(threat)
    expect(wyvernRoost(party(), threat).threat).toBe(threat)
    expect(foes.map(([kind, name]) => [kind, name])).toEqual(ROOST.slice(0, WYVERN_ROOST_COUNTS[index]).map((name) => ['wyvern', name]))
    for (const [, name, stats] of foes) expect(stats).toEqual({ ...foeStats('wyvern', threat), name })
  })

  it('fields four at 9 and 10 and three at 11 and 12: the Old Wyvern keeps to the roost\'s near threats', () => {
    expect([9, 10, 11, 12].map((threat) => fielded(threat).length)).toEqual([4, 4, 3, 3])
    expect(fielded(11).map(([, name]) => name)).toEqual(['Wyvern', 'Wyvern Mate', 'Young Wyvern'])
  })

  it('is fought below its band as at 9 and above it as at 12', () => {
    expect(wyvernRoost(party(), 8)).toEqual(wyvernRoost(party(), 9))
    expect(wyvernRoost(party())).toEqual(wyvernRoost(party(), 9))
    expect(wyvernRoost(party(), 13)).toEqual(wyvernRoost(party(), 12))
  })

  it('writes the Wyvern as campaign §5.5 has it, but for its flight: resistance 2, Bite and Sting, 150 XP, native 9', () => {
    expect(foeStats('wyvern', 9)).toEqual({ ...WYVERN_STATS, abilityDamageBonus: 0 })
    expect(WYVERN_STATS).toMatchObject({ name: 'Wyvern', resistance: 2, abilities: ['wyvern_strikes'], attackRange: 1 })
    expect(FOE_XP.wyvern).toBe(150)
    expect(FOE_NATIVE_LEVEL.wyvern).toBe(9)
  })
})

describe('ring 12\'s encounters (long-campaign stage 11 step 10)', () => {
  const fielded = (build: typeof barrowWights, threat: number) => {
    const { setup, kinds, threat: fought } = build(party(), threat)
    expect(fought).toBe(threat)
    const foes = setup.units.filter((u) => u.side === 'enemy')
    // Every foe is its kind at the threat's level (no kind here is native above its band's first threat), under its own name.
    for (const u of foes) expect(u.stats).toEqual({ ...foeStats(kinds[u.id] as MonsterKind, threat), name: u.stats.name })
    return foes.map((u) => [kinds[u.id], u.stats.name])
  }
  const WIGHTS = [['barrow_wight', 'Barrow King'], ['barrow_wight', 'Barrow Wight'], ['barrow_wight', 'Grave Wight'], ['barrow_wight', 'Pale Wight']]
  const LAIR = [['basilisk', 'Basilisk'], ['ogre', 'Ogre Keeper'], ['basilisk', 'Basilisk Mate']]
  const STEADING = [['hill_giant', 'Hill Giant'], ['hill_giant', 'Giant Chief'], ['ogre', 'Ogre Thrall']]

  it('are registered after the Wyvern Roost, in order, with their bands and counts', () => {
    const ids = Object.keys(ENCOUNTERS)
    expect(ids.slice(ids.indexOf('wyvern_roost') + 1).slice(0, 3)).toEqual(['barrow_wights', 'basilisk_lair', 'hill_giant_steading'])
    expect([ENCOUNTER_BANDS.barrow_wights, ENCOUNTER_BANDS.basilisk_lair, ENCOUNTER_BANDS.hill_giant_steading]).toEqual([
      { min: 11, max: 14 },
      { min: 11, max: 14 },
      { min: 12, max: 15 },
    ])
    expect(ENCOUNTER_COUNTS.barrow_wights).toEqual(BARROW_WIGHTS_COUNTS)
    expect(ENCOUNTER_COUNTS.basilisk_lair).toEqual(BASILISK_LAIR_COUNTS)
    expect(ENCOUNTER_COUNTS.hill_giant_steading).toEqual(HILL_GIANT_STEADING_COUNTS)
  })

  it.each([
    ['barrow_wights', barrowWights, WIGHTS, BARROW_WIGHTS_COUNTS, 11, 14],
    ['basilisk_lair', basiliskLair, LAIR, BASILISK_LAIR_COUNTS, 11, 14],
    ['hill_giant_steading', hillGiantSteading, STEADING, HILL_GIANT_STEADING_COUNTS, 12, 15],
  ] as const)('fields %s at its band\'s two ends: its counts\' number of foes, the lead first, each at the threat\'s level', (_id, build, slots, counts, min, max) => {
    expect(fielded(build, min)).toEqual(slots.slice(0, counts[0]))
    expect(fielded(build, max)).toEqual(slots.slice(0, counts[max - min]))
    // Below its band as at its first threat, above it as at its last.
    expect(build(party(), min - 1)).toEqual(build(party(), min))
    expect(build(party())).toEqual(build(party(), min))
    expect(build(party(), max + 1)).toEqual(build(party(), max))
  })

  it('writes the kinds as campaign §5.5 has them, but for the wight\'s half damage: resistance, special, XP and native level', () => {
    expect(foeStats('barrow_wight', 11)).toEqual(BARROW_WIGHT_STATS)
    expect(foeStats('basilisk', 11)).toEqual({ ...BASILISK_STATS, abilityDamageBonus: 0 })
    expect(foeStats('hill_giant', 12)).toEqual({ ...HILL_GIANT_STATS, abilityDamageBonus: 0 })
    expect(BARROW_WIGHT_STATS).toMatchObject({ name: 'Barrow Wight', resistance: 3, magic: { spells: ['drain_life'] } })
    expect(BASILISK_STATS).toMatchObject({ name: 'Basilisk', resistance: 4, abilities: ['basilisk_gaze'] })
    expect(HILL_GIANT_STATS).toMatchObject({ name: 'Hill Giant', resistance: 3, weapon: 'Club', abilities: ['giant_rock'] })
    expect([FOE_XP.barrow_wight, FOE_XP.basilisk, FOE_XP.hill_giant]).toEqual([110, 150, 200])
    expect([FOE_NATIVE_LEVEL.barrow_wight, FOE_NATIVE_LEVEL.basilisk, FOE_NATIVE_LEVEL.hill_giant]).toEqual([11, 11, 12])
  })

  it('pierces enough of the expected kit\'s resistance (11 to 13 at these levels) for each kind\'s blow to tell', () => {
    // The line under the plan's C3: wolf 4, worg rider 6, ogre 5, wyvern 11; the wight 8, the basilisk 9, the giant 9.
    expect([BARROW_WIGHT_STATS.armorPierce, BASILISK_STATS.armorPierce, HILL_GIANT_STATS.armorPierce]).toEqual([8, 9, 9])
  })
})

describe('ring 15\'s encounters (long-campaign stage 11 step 11)', () => {
  const fielded = (build: typeof golemRuin, threat: number) => {
    const built = build(party(), threat)
    const { setup, kinds, threat: fought } = built
    expect(fought).toBe(threat)
    expect(xpReward(built)).toBeGreaterThan(0)
    const foes = setup.units.filter((u) => u.side === 'enemy')
    // Every foe is its kind at the threat's level (no kind here is native above its band's first threat), under its own name.
    for (const u of foes) expect(u.stats).toEqual({ ...foeStats(kinds[u.id] as MonsterKind, threat), name: u.stats.name })
    return foes.map((u) => [kinds[u.id], u.stats.name])
  }
  const RUIN = [['stone_golem', 'Stone Golem'], ['barrow_wight', 'Ruin Wight'], ['stone_golem', 'Stone Warden'], ['barrow_wight', 'Pale Wight'], ['stone_golem', 'Stone Sentinel']]
  const CULT = [['blight_cultist', 'Blight Cultist'], ['barrow_wight', 'Risen Wight'], ['blight_cultist', 'Cult Acolyte'], ['barrow_wight', 'Grave Wight'], ['blight_cultist', 'Cult Elder']]
  const LAIR = [['young_dragon', 'Young Dragon'], ['wyvern', 'Lair Wyvern'], ['wyvern', 'Wyvern Mate']]

  it('are registered after the Hill Giant Steading, in order, with their bands and counts', () => {
    const ids = Object.keys(ENCOUNTERS)
    expect(ids.slice(ids.indexOf('hill_giant_steading') + 1).slice(0, 3)).toEqual(['golem_ruin', 'blight_cult', 'young_dragon'])
    expect([ENCOUNTER_BANDS.golem_ruin, ENCOUNTER_BANDS.blight_cult, ENCOUNTER_BANDS.young_dragon]).toEqual([
      { min: 14, max: 17 },
      { min: 14, max: 18 },
      { min: 15, max: 18 },
    ])
    expect(ENCOUNTER_COUNTS.golem_ruin).toEqual(GOLEM_RUIN_COUNTS)
    expect(ENCOUNTER_COUNTS.blight_cult).toEqual(BLIGHT_CULT_COUNTS)
    expect(ENCOUNTER_COUNTS.young_dragon).toEqual(YOUNG_DRAGON_COUNTS)
  })

  it.each([
    ['golem_ruin', golemRuin, RUIN, GOLEM_RUIN_COUNTS, 14, 17],
    ['blight_cult', blightCult, CULT, BLIGHT_CULT_COUNTS, 14, 18],
    ['young_dragon', youngDragon, LAIR, YOUNG_DRAGON_COUNTS, 15, 18],
  ] as const)('fields %s at its band\'s two ends: its counts\' number of foes, the lead first, each at the threat\'s level', (_id, build, slots, counts, min, max) => {
    expect(fielded(build, min)).toEqual(slots.slice(0, counts[0]))
    expect(fielded(build, max)).toEqual(slots.slice(0, counts[max - min]))
    // Below its band as at its first threat, above it as at its last.
    expect(build(party(), min - 1)).toEqual(build(party(), min))
    expect(build(party())).toEqual(build(party(), min))
    expect(build(party(), max + 1)).toEqual(build(party(), max))
  })

  it('writes the kinds as campaign §5.5 has them: resistance, wards, special, XP and native level', () => {
    expect(foeStats('stone_golem', 14)).toEqual(STONE_GOLEM_STATS)
    expect(foeStats('blight_cultist', 14)).toEqual(BLIGHT_CULTIST_STATS)
    expect(foeStats('young_dragon', 15)).toEqual({ ...YOUNG_DRAGON_STATS, abilityDamageBonus: 0 })
    expect(STONE_GOLEM_STATS).toMatchObject({ name: 'Stone Golem', resistance: 8, wards: { poison: 99 }, immune: true, weapon: 'Slam' })
    expect(STONE_GOLEM_STATS.abilities).toBeUndefined()
    expect(BLIGHT_CULTIST_STATS).toMatchObject({ name: 'Blight Cultist', resistance: 1, blightborn: true, magic: { spells: ['heal', 'curse', 'lightning_bolt'] } })
    expect(YOUNG_DRAGON_STATS).toMatchObject({ name: 'Young Dragon', resistance: 4, wards: { fire: 10 }, abilities: ['dragon_breath', 'dragon_strikes'] })
    expect([FOE_XP.stone_golem, FOE_XP.blight_cultist, FOE_XP.young_dragon]).toEqual([180, 100, 300])
    expect([FOE_NATIVE_LEVEL.stone_golem, FOE_NATIVE_LEVEL.blight_cultist, FOE_NATIVE_LEVEL.young_dragon]).toEqual([14, 14, 15])
  })

  it('pierces enough of the expected kit\'s resistance (13 at 14 to 16) for each kind\'s blow to tell; the cultist\'s is a dart thrown 4 hexes', () => {
    // The line under the plan's C3: wolf 4, worg rider 6, ogre 5, wyvern 11, wight 8, basilisk 9, giant 9; the golem 9, the cultist 10, the dragon 10.
    expect([STONE_GOLEM_STATS.armorPierce, BLIGHT_CULTIST_STATS.armorPierce, YOUNG_DRAGON_STATS.armorPierce]).toEqual([9, 10, 10])
    expect(BLIGHT_CULTIST_STATS).toMatchObject({ weapon: 'Blight Dart', attackRange: 4 })
  })
})

describe('ring 18\'s encounters (long-campaign stage 11 step 12)', () => {
  const fielded = (build: typeof blightLichCourt, threat: number) => {
    const { setup, kinds, threat: fought } = build(party(), threat)
    expect(fought).toBe(threat)
    const foes = setup.units.filter((u) => u.side === 'enemy')
    for (const u of foes) expect(u.stats).toEqual({ ...foeStats(kinds[u.id] as MonsterKind, threat), name: u.stats.name })
    return foes.map((u) => [kinds[u.id], u.stats.name])
  }
  const COURT = [['blight_lich', 'Blight Lich'], ['barrow_wight', 'Barrow Guard'], ['blight_cultist', 'Lich\'s Acolyte'], ['barrow_wight', 'Crypt Warden'], ['blight_cultist', 'Lich\'s Herald']]
  const WYRM = [['elder_wyrm', 'Elder Wyrm'], ['young_dragon', 'Wyrmling'], ['young_dragon', 'Brood Drake']]

  it('are registered after the Dragon Lair, in order, with their bands and counts', () => {
    const ids = Object.keys(ENCOUNTERS)
    expect(ids.slice(ids.indexOf('young_dragon') + 1).slice(0, 2)).toEqual(['blight_lich_court', 'elder_wyrm'])
    expect([ENCOUNTER_BANDS.blight_lich_court, ENCOUNTER_BANDS.elder_wyrm]).toEqual([{ min: 17, max: 20 }, { min: 18, max: 20 }])
    expect(ENCOUNTER_COUNTS.blight_lich_court).toEqual(BLIGHT_LICH_COURT_COUNTS)
    expect(ENCOUNTER_COUNTS.elder_wyrm).toEqual(ELDER_WYRM_COUNTS)
  })

  it.each([
    ['blight_lich_court', blightLichCourt, COURT, BLIGHT_LICH_COURT_COUNTS, 17, 20],
    ['elder_wyrm', elderWyrm, WYRM, ELDER_WYRM_COUNTS, 18, 20],
  ] as const)('fields %s at its band\'s two ends: its counts\' number of foes, the lead first, each at the threat\'s level', (_id, build, slots, counts, min, max) => {
    expect(fielded(build, min)).toEqual(slots.slice(0, counts[0]))
    expect(fielded(build, max)).toEqual(slots.slice(0, counts[max - min]))
    expect(build(party(), min - 1)).toEqual(build(party(), min))
    expect(build(party())).toEqual(build(party(), min))
    expect(build(party(), max + 1)).toEqual(build(party(), max))
  })

  it('writes the kinds as campaign §5.5 has them: resistance, regeneration, wards, special, XP and native level', () => {
    expect(foeStats('blight_lich', 17)).toEqual(BLIGHT_LICH_STATS)
    expect(foeStats('elder_wyrm', 18)).toEqual({ ...ELDER_WYRM_STATS, abilityDamageBonus: 0 })
    expect(BLIGHT_LICH_STATS).toMatchObject({ name: 'Blight Lich', resistance: 3, regeneration: 3, blightborn: true, magic: { spells: ['death_cloud', 'lightning_bolt', 'drain_life', 'dark_shield'] } })
    expect(ELDER_WYRM_STATS).toMatchObject({ name: 'Elder Wyrm', resistance: 5, regeneration: 2, wards: { fire: 15 }, abilities: ['wyrm_breath', 'wyrm_strikes'] })
    expect([FOE_XP.blight_lich, FOE_XP.elder_wyrm]).toEqual([300, 450])
    expect([FOE_NATIVE_LEVEL.blight_lich, FOE_NATIVE_LEVEL.elder_wyrm]).toEqual([17, 18])
  })

  it('pierces enough of the expected kit\'s resistance (21 on the fighter and archer from 17) for each kind\'s blow to tell', () => {
    // The line under the plan's C3: wolf 4, worg rider 6, ogre 5, wyvern 11, wight 8, basilisk 9, giant 9, golem 9,
    // cultist 10, young dragon 10; the lich 14, the elder wyrm 21 (all of it).
    expect([BLIGHT_LICH_STATS.armorPierce, ELDER_WYRM_STATS.armorPierce]).toEqual([14, 21])
  })
})

describe('the encounters\' bands and counts', () => {
  const ids = Object.keys(ENCOUNTERS) as EncounterId[]
  /** The five encounters the map had before bandits, which keep the counts 2, 3, 3, 3, 4 at threats 1 to 5. */
  const today: EncounterId[] = ['goblin_raid', 'kobold_scouts', 'hobgoblin_warband', 'troll_lair', 'source_guardians']
  /** Of those, the ones whose band is still 1 to 5 (the Source's grew to 20 in stage 9). */
  const near = today.filter((id) => id !== 'source_guardians')
  const foeCount = (id: EncounterId, threat: number) =>
    ENCOUNTERS[id](party(), threat).setup.units.filter((u) => u.side === 'enemy').length

  it('gives each of today\'s encounters but the Source the band 1 to 5', () => {
    expect(ids.slice(0, 5).sort()).toEqual([...today].sort())
    for (const id of near) expect(ENCOUNTER_BANDS[id]).toEqual({ min: 1, max: 5 })
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
      const top = ENCOUNTER_BANDS[id].max
      expect(ENCOUNTERS[id](party(), 0)).toEqual(ENCOUNTERS[id](party(), 1))
      expect(ENCOUNTERS[id](party(), top + 4)).toEqual(ENCOUNTERS[id](party(), top))
      expect(ENCOUNTERS[id](party(), 3.7)).toEqual(ENCOUNTERS[id](party(), 3))
      expect(ENCOUNTERS[id](party(), 0).threat).toBe(1)
      expect(ENCOUNTERS[id](party(), top + 4).threat).toBe(top)
      expect(ENCOUNTERS[id](party(), 3.7).threat).toBe(3)
    }
  })

  it('lists the encounters whose band holds a threat, in order', () => {
    expect(encountersFor(1)).toEqual(today)
    expect(encountersFor(2)).toEqual(today)
    expect(encountersFor(3)).toEqual([...today, 'bandit_camp'])
    expect(encountersFor(4)).toEqual([...today, 'bandit_camp', 'spider_nest'])
    expect(encountersFor(5)).toEqual([...today, 'bandit_camp', 'spider_nest', 'salamander_pool'])
    expect(encountersFor(6)).toEqual(['source_guardians', 'bandit_camp', 'spider_nest', 'salamander_pool', 'wolf_pack'])
    expect(encountersFor(7)).toEqual(['source_guardians', 'bandit_camp', 'spider_nest', 'salamander_pool', 'wolf_pack', 'worg_riders', 'ogre_camp'])
    expect(encountersFor(8)).toEqual(['source_guardians', 'spider_nest', 'salamander_pool', 'bandit_company', 'wolf_pack', 'worg_riders', 'ogre_camp'])
    expect(encountersFor(9)).toEqual(['source_guardians', 'spider_nest', 'salamander_pool', 'bandit_company', 'wolf_pack', 'worg_riders', 'ogre_camp', 'wyvern_roost'])
    expect(encountersFor(10)).toEqual(['source_guardians', 'bandit_company', 'ogre_camp', 'wyvern_roost'])
    expect(encountersFor(11)).toEqual(['source_guardians', 'bandit_company', 'wyvern_roost', 'barrow_wights', 'basilisk_lair'])
    expect(encountersFor(12)).toEqual(['source_guardians', 'bandit_company', 'wyvern_roost', 'barrow_wights', 'basilisk_lair', 'hill_giant_steading'])
    expect(encountersFor(13)).toEqual(['source_guardians', 'bandit_company', 'barrow_wights', 'basilisk_lair', 'hill_giant_steading'])
    expect(encountersFor(14)).toEqual(['source_guardians', 'freebooter_host', 'barrow_wights', 'basilisk_lair', 'hill_giant_steading', 'golem_ruin', 'blight_cult'])
    expect(encountersFor(15)).toEqual(['source_guardians', 'freebooter_host', 'hill_giant_steading', 'golem_ruin', 'blight_cult', 'young_dragon'])
    expect(encountersFor(16)).toEqual(['source_guardians', 'freebooter_host', 'golem_ruin', 'blight_cult', 'young_dragon'])
    expect(encountersFor(17)).toEqual(['source_guardians', 'freebooter_host', 'golem_ruin', 'blight_cult', 'young_dragon', 'blight_lich_court'])
    expect(encountersFor(18)).toEqual(['source_guardians', 'freebooter_host', 'blight_cult', 'young_dragon', 'blight_lich_court', 'elder_wyrm'])
    for (const threat of [19, 20]) expect(encountersFor(threat)).toEqual(['source_guardians', 'freebooter_host', 'blight_lich_court', 'elder_wyrm'])
    expect(encountersFor(21)).toEqual([])
    expect(encountersFor(0)).toEqual([])
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
  giant_spider: GIANT_SPIDER_STATS,
  salamander: SALAMANDER_STATS,
  wolf: WOLF_STATS,
  worg_rider: WORG_RIDER_STATS,
  ogre: OGRE_STATS,
  wyvern: WYVERN_STATS,
  barrow_wight: BARROW_WIGHT_STATS,
  basilisk: BASILISK_STATS,
  hill_giant: HILL_GIANT_STATS,
  stone_golem: STONE_GOLEM_STATS,
  blight_cultist: BLIGHT_CULTIST_STATS,
  young_dragon: YOUNG_DRAGON_STATS,
  blight_lich: BLIGHT_LICH_STATS,
  elder_wyrm: ELDER_WYRM_STATS,
}

describe('foeStats', () => {
  const kinds = Object.keys(BLOCKS) as MonsterKind[]

  it('gives every monster kind a native level, 1 but for the Giant Spider\'s 4, the Salamander\'s 5 and stage 11\'s kinds (ring 7: the Wolf 6, the Worg Rider and the Ogre 7; ring 9: the Wyvern 9; ring 12: the Barrow Wight and the Basilisk 11, the Hill Giant 12; ring 15: the Stone Golem and the Blight Cultist 14, the Young Dragon 15; ring 18: the Blight Lich 17, the Elder Wyrm 18)', () => {
    const above: Partial<Record<MonsterKind, number>> = { giant_spider: 4, salamander: 5, wolf: 6, worg_rider: 7, ogre: 7, wyvern: 9, barrow_wight: 11, basilisk: 11, hill_giant: 12, stone_golem: 14, blight_cultist: 14, young_dragon: 15, blight_lich: 17, elder_wyrm: 18 }
    for (const kind of kinds) expect(FOE_NATIVE_LEVEL[kind]).toBe(above[kind] ?? 1)
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
    { kind: 'giant_spider', field: 'maxHp', reason: 'the Giant Spider is a fragile ambusher; its Web and venom are its danger, not its hit points' },
    { kind: 'giant_spider', field: 'meanDamage', reason: 'its routine of two bites (1d6+2 each, the second poisoning) is 11 a turn, above the band: the spider is built to hit hard and die fast' },
    { kind: 'salamander', field: 'maxHp', reason: 'the Salamander\'s fire ward and Fire Spit stand for hit points, so its pool is small' },
    { kind: 'armored_troll', field: 'toHit', reason: 'level 1 foes hit less often than the band; they catch up by 5 a level' },
  ]

  /**
   * The kinds added in long-campaign stage 11, held to the kitted yardstick (`foeYardstick(level, 'expected')`) until
   * stage 12 measures again; every other kind stays on the bare one. Each ring step adds its kinds here.
   */
  const STAGE_11_KINDS: readonly MonsterKind[] = ['wolf', 'worg_rider', 'ogre', 'wyvern', 'barrow_wight', 'basilisk', 'hill_giant', 'stone_golem', 'blight_cultist', 'young_dragon', 'blight_lich', 'elder_wyrm']
  /** The fields a stage 11 kind is meant to sit outside the kitted yardstick on, and why. */
  const STAGE_11_EXCEPTIONS: typeof EXCEPTIONS = [
    { kind: 'elder_wyrm', field: 'toHit', reason: 'the top threat hits as a Young Dragon raised to 18 does (115): at 100 it was the weaker of the two in its own lair' },
    { kind: 'elder_wyrm', field: 'maxHp', reason: 'the top threat, a boss: 185 hit points, and two foes in its lair at every threat (a third, a young dragon raised to 20, made the lair a rout)' },
  ]

  const mean = (roll: DamageRoll, bonus = 0) => (roll.count * (roll.sides + 1)) / 2 + roll.bonus + bonus
  /** A routine's turn: its strikes' means, times the uses a turn its AP allow, once at most if it recharges. */
  const routineTurn = (s: CombatantStats, id: AbilityId) => {
    const { strikes = [], apCost, recharge } = ABILITIES[id]
    const uses = Math.floor(s.actionPoints / apCost)
    return (recharge >= 1 ? Math.min(1, uses) : uses) * strikes.reduce((sum, strike) => sum + mean(strike.damage!, s.abilityDamageBonus), 0)
  }
  /** The better of the weapon's turn and the best routine's. */
  const meanDamage = (s: CombatantStats) =>
    Math.max(
      Math.max(1, Math.floor(s.actionPoints / s.attackApCost)) * mean(s.damage),
      ...(s.abilities ?? []).map((id) => routineTurn(s, id)),
    )

  /** Holds `kind` at its native level to the yardstick of `kit`: the fields outside it are exactly those `exceptions` names for it. */
  const holds = (kind: MonsterKind, kit: 'bare' | 'expected', exceptions: typeof EXCEPTIONS) => {
    const level = FOE_NATIVE_LEVEL[kind]
    const stats = foeStats(kind, level)
    const yardstick = foeYardstick(level, kit)
    const values: Record<Field, number> = { ac: stats.ac, toHit: stats.toHit, maxHp: stats.maxHp, meanDamage: meanDamage(stats) }
    const outside = (Object.keys(values) as Field[]).filter(
      (field) => values[field] < yardstick[field][0] || values[field] > yardstick[field][1],
    )
    const named = exceptions.filter((e) => e.kind === kind).map((e) => e.field)
    expect(outside.sort(), `${kind}: ${outside.map((f) => `${f} ${values[f]} outside [${yardstick[f]}]`).join('; ')}`).toEqual(named.sort())
  }

  it.each((Object.keys(BLOCKS) as MonsterKind[]).filter((kind) => !STAGE_11_KINDS.includes(kind)))(
    'holds the %s to the yardstick at its native level, but for named exceptions',
    (kind) => holds(kind, 'bare', EXCEPTIONS),
  )

  it.each(STAGE_11_KINDS)('holds the %s to the kitted yardstick at its native level, but for named exceptions', (kind) => holds(kind, 'expected', STAGE_11_EXCEPTIONS))

  it('holds each kind to one yardstick: stage 11\'s kinds are monster kinds, named once, their exceptions theirs', () => {
    expect(new Set(STAGE_11_KINDS).size).toBe(STAGE_11_KINDS.length)
    for (const kind of STAGE_11_KINDS) expect(Object.keys(BLOCKS)).toContain(kind)
    for (const e of STAGE_11_EXCEPTIONS) expect(STAGE_11_KINDS).toContain(e.kind)
    for (const e of EXCEPTIONS) expect(STAGE_11_KINDS).not.toContain(e.kind)
  })

  it('counts a routine’s turn: the Troll’s claws are its two weapon claws, a recharging routine once a turn', () => {
    expect(meanDamage(TROLL_STATS)).toBe(9)
    expect(routineTurn(TROLL_STATS, 'troll_claws')).toBe(9)
    expect(routineTurn({ ...GOBLIN_STATS, abilityDamageBonus: 1 }, 'spider_bite')).toBe(13)
    expect(meanDamage({ ...GOBLIN_STATS, abilities: ['spider_bite'] })).toBe(11)
  })

  it('names a reason for every exception', () => {
    for (const e of [...EXCEPTIONS, ...STAGE_11_EXCEPTIONS]) expect(e.reason.length).toBeGreaterThan(10)
  })
})
