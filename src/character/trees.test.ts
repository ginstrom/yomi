import { describe, expect, it } from 'vitest'
import { createWarrior, type Character } from './character.ts'
import { PERKS, PERK_IDS, missingRequirements, qualifiesFor, type Perk, type PerkId } from './perks.ts'
import { gainXp, pointsAt, takePerk, xpToNextLevel } from './progression.ts'
import {
  MANA_PER_TREE_NODE,
  PATHS,
  PATH_IDS,
  TIERS,
  TREES,
  TREE_IDS,
  calling,
  capstoneOf,
  heroTitle,
  pathDepth,
  pathsOf,
  treeNodes,
  type PathId,
  type Tier,
} from './trees.ts'

/** The 95 nodes, by path, in `PERKS` order (the plan's C3, design 4.3). */
const NODES: Record<PathId, PerkId[]> = {
  swordmaster: ['weapon_training', 'heavy_hand', 'power_attack', 'armor_breaker', 'gain_strength', 'cleave', 'weapon_mastery', 'blademaster'],
  heavy_knight: ['toughness', 'shield_wall', 'taunt', 'rooted', 'pin', 'iron_skin', 'guardian', 'unbreakable'],
  spellsword: ['arcane_blood', 'flame_strike', 'frost_strike', 'spell_ward', 'thunder_strike', 'battle_mage', 'arcane_knight'],
  ranger: ['marksmanship', 'deadly_aim', 'aimed_shot', 'far_shot', 'hunters_mark', 'volley', 'pinning_shot', 'deadeye'],
  rogue: ['dodger', 'sprint', 'skirmisher', 'dirty_trick', 'tumble', 'evasion', 'counter', 'shadowdancer'],
  assassin: ['keen_eye', 'backstab', 'venom_strike', 'hamstring', 'fortune', 'ambush', 'executioner', 'deathblow'],
  evoker: ['magic_arrow', 'destruction', 'flame_arrow', 'pyromancy', 'fireball', 'acid_arrow', 'death_cloud', 'meteor'],
  cryomancer: ['frostbite', 'numbing_cold', 'sleep', 'frost_blast', 'web', 'ice_lance', 'lingering_cold', 'glacial_prison'],
  arcanist: ['shield', 'arcane_study', 'mirror_image', 'ward', 'haste', 'lasting_magic', 'quickened_casting', 'mass_haste'],
  healer: ['heal', 'mending', 'greater_heal', 'heal_all', 'greater_heal_all', 'purify', 'swift_hands', 'revive'],
  paladin: ['bless', 'smite', 'lay_on_hands', 'blessed_armour', 'aura_of_courage', 'consecrate', 'sacred_weapon', 'aegis'],
  saint: ['serenity', 'bane', 'protect', 'scholar', 'curse', 'renew', 'holy_light', 'sanctuary'],
}

const TIER_ORDER: readonly Tier[] = [1, 2, 3, 'capstone']

describe('the trees', () => {
  it('are four of three paths each, in PATH_IDS order', () => {
    expect(TREE_IDS.map((tree) => TREES[tree].name)).toEqual(['Warrior', 'Scout', 'Mage', 'Cleric'])
    expect(TREE_IDS.flatMap(pathsOf)).toEqual([...PATH_IDS])
    for (const tree of TREE_IDS) expect(pathsOf(tree)).toHaveLength(3)
    expect(PATHS.heavy_knight.name).toBe('Heavy Knight')
  })

  it('ask a level and a depth by tier, and cost 1, 2, 3 and 4 perk points', () => {
    expect(TIERS).toEqual({
      1: { level: 1, depth: 0, cost: 1 },
      2: { level: 2, depth: 1, cost: 2 },
      3: { level: 6, depth: 3, cost: 3 },
      capstone: { level: 12, depth: 5, cost: 4 },
    })
    expect(MANA_PER_TREE_NODE).toBe(2)
  })

  it('hold the 95 nodes in PERKS order, by tree, path, then tier (AC1)', () => {
    expect(PERK_IDS).toHaveLength(95)
    expect(PERK_IDS).toEqual(PATH_IDS.flatMap((path) => NODES[path]))
    for (const path of PATH_IDS) {
      const nodes = PERK_IDS.filter((id) => (PERKS[id] as Perk).path === path)
      expect(nodes).toEqual(NODES[path])
      expect(nodes).toHaveLength(path === 'spellsword' ? 7 : 8)
      const tiers = nodes.map((id) => TIER_ORDER.indexOf((PERKS[id] as Perk).tier))
      expect(tiers).toEqual([...tiers].sort((a, b) => a - b))
      expect(nodes.filter((id) => (PERKS[id] as Perk).tier === 1), path).toHaveLength(2)
      expect(nodes.filter((id) => (PERKS[id] as Perk).tier === 'capstone'), path).toHaveLength(1)
    }
  })

  it('give every node one rank: a node held is never taken again', () => {
    const hero = createWarrior()
    hero.perkPoints = 2
    expect(takePerk(hero, 'toughness')).toBe(true)
    expect(takePerk(hero, 'toughness')).toBe(false)
    expect([hero.perks.toughness, hero.perkPoints]).toEqual([1, 1])
  })
})

describe('depth and the calling', () => {
  it('count the nodes held in a path and in a tree', () => {
    const hero = { perks: { magic_arrow: 1, destruction: 1, shield: 1, heal: 1 } }
    expect([pathDepth(hero, 'evoker'), pathDepth(hero, 'arcanist'), pathDepth(hero, 'ranger')]).toEqual([2, 1, 0])
    expect([treeNodes(hero, 'mage'), treeNodes(hero, 'cleric'), treeNodes(hero, 'warrior')]).toEqual([3, 1, 0])
  })

  it('is no path with no node, the deepest path, or every path tied for it', () => {
    expect(calling({ perks: {} })).toEqual([])
    expect(calling({ perks: { magic_arrow: 1, destruction: 1, shield: 1 } })).toEqual(['evoker'])
    expect(calling({ perks: { magic_arrow: 1, shield: 1, toughness: 1 } })).toEqual(['heavy_knight', 'evoker', 'arcanist'])
  })

  it('finds the one capstone held', () => {
    expect(capstoneOf({ perks: { magic_arrow: 1 } })).toBeNull()
    expect(capstoneOf({ perks: { magic_arrow: 1, mass_haste: 1 } })).toBe('mass_haste')
  })
})

describe('the capstone before level 12', () => {
  it('cannot be taken however deep', () => {
    const deep = createWarrior()
    deep.attributes.intelligence = 9
    deep.trained.magic = 100
    deep.level = 11
    deep.perkPoints = 4
    deep.perks = { magic_arrow: 1, destruction: 1, flame_arrow: 1, pyromancy: 1, fireball: 1, acid_arrow: 1, death_cloud: 1 }
    expect(qualifiesFor(deep, 'meteor')).toBe(false)
    expect(qualifiesFor({ ...deep, level: 12 }, 'meteor')).toBe(true)
  })
})

describe('a committed hero in every path, under the tiers\' costs (NC3)', () => {
  const tierOf = (id: PerkId) => (PERKS[id] as Perk).tier

  /**
   * A level 1 hero holding `path`'s two T1s and one T1 of another path (its 3
   * creation points), every attribute high and every skill trained to the
   * top, raised to level 14 a level at a time, every point put into the path:
   * its first T2, then a T3 it may take, then a second T2, then the capstone,
   * each bought when its asks and its cost are met, the points saved till
   * then. The level each node came at, and the points held at each level.
   */
  const committedIn = (path: PathId) => {
    const hero = createWarrior()
    hero.attributes = { strength: 8, perception: 9, endurance: 9, intelligence: 9, agility: 9, luck: 9 }
    hero.trained = { melee: 100, archery: 100, magic: 100 }
    const nodes = NODES[path]
    const other: PerkId = path === 'heavy_knight' ? 'dodger' : 'toughness'
    hero.perks = Object.fromEntries([...nodes.slice(0, 2), other].map((id) => [id, 1]))
    hero.perkPoints = 0
    const [t2] = nodes.filter((id) => tierOf(id) === 2)
    const t3 = nodes.find((id) => tierOf(id) === 3 && [undefined, t2].includes((PERKS[id] as Perk).requires as PerkId | undefined))!
    const secondT2 = nodes.find((id) => tierOf(id) === 2 && id !== t2 && (PERKS[id] as Perk).requires !== t3)!
    const capstone = nodes.find((id) => tierOf(id) === 'capstone')!
    const sequence = [t2, t3, secondT2, capstone]
    const came = new Map<PerkId, number>()
    const points = new Map<number, number>()
    while (hero.level < 14) {
      gainXp(hero, xpToNextLevel(hero.level))
      for (const next of sequence.filter((id) => !hero.perks[id])) {
        if (!takePerk(hero, next)) break
        came.set(next, hero.level)
      }
      points.set(hero.level, hero.perkPoints)
    }
    return { came, points, t2, t3, secondT2, capstone, hero }
  }

  it.each(PATH_IDS)('%s: a T2 at 3, the T3 at 6, a second T2 at 8 and the capstone at 12, not earlier', (path) => {
    const { came, points, t2, t3, secondT2, capstone, hero } = committedIn(path)
    expect([came.get(t2), came.get(t3), came.get(secondT2), came.get(capstone)]).toEqual([3, 6, 8, 12])
    // A point banked at level 4, and nothing to spare at 12: the capstone's 4 points are exactly level 12's.
    expect([points.get(4), points.get(12)]).toEqual([1, 0])
    expect(hero.perkPoints + Object.keys(hero.perks).reduce((sum, id) => sum + TIERS[tierOf(id as PerkId)].cost, 0)).toBe(pointsAt(14))
  })
})

describe('the capstone (AC2)', () => {
  /** A level 14 hero with Melee 70% and more, 5 Swordmaster nodes and 6 Assassin nodes, and a capstone's 4 perk points. */
  const duellist = (): Character => {
    const hero = createWarrior()
    hero.level = 14
    hero.attributes.strength = 8
    hero.trained.melee = 100
    hero.perkPoints = 4
    hero.perks = {
      weapon_training: 1,
      heavy_hand: 1,
      power_attack: 1,
      armor_breaker: 1,
      gain_strength: 1,
      keen_eye: 1,
      backstab: 1,
      venom_strike: 1,
      hamstring: 1,
      fortune: 1,
      executioner: 1,
    }
    return hero
  }
  const CAPSTONES = PERK_IDS.filter((id) => (PERKS[id] as Perk).tier === 'capstone')

  it('opens Deathblow, in the calling, and not Blademaster; given 4 perk points, Deathblow is taken (NC3)', () => {
    const hero = duellist()
    expect(calling(hero)).toEqual(['assassin'])
    expect(qualifiesFor(hero, 'deathblow')).toBe(true)
    expect(qualifiesFor(hero, 'blademaster')).toBe(false)
    expect(missingRequirements(hero, 'blademaster')).toContain('Swordmaster must be your deepest path')
    expect(takePerk({ ...duellist(), perks: { ...duellist().perks } }, 'blademaster')).toBe(false)
    expect(takePerk({ ...duellist(), perkPoints: 3, perks: { ...duellist().perks } }, 'deathblow')).toBe(false)
    expect(takePerk(hero, 'deathblow')).toBe(true)
    expect(hero.perkPoints).toBe(0)
  })

  it('closes every other capstone for good once Deathblow is taken, whatever the depths later', () => {
    const hero = duellist()
    hero.perkPoints = 4 + 3 + 3
    expect(takePerk(hero, 'deathblow')).toBe(true)
    expect(takePerk(hero, 'cleave')).toBe(true)
    expect(takePerk(hero, 'weapon_mastery')).toBe(true)
    // Swordmaster 7, Assassin 6 once one node is set aside: Swordmaster is the deeper.
    delete hero.perks.executioner
    hero.perkPoints = 4
    expect(calling(hero)).toEqual(['swordmaster'])
    expect(CAPSTONES).toHaveLength(12)
    for (const capstone of CAPSTONES.filter((id) => id !== 'deathblow')) {
      expect(qualifiesFor(hero, capstone), capstone).toBe(false)
      expect(missingRequirements(hero, capstone), capstone).toContain('Only one capstone')
    }
    expect(capstoneOf(hero)).toBe('deathblow')
  })
})

describe('the capstone (AC2, in the Mage tree)', () => {
  /** A level 14 hero with Magic for anything, 5 Evoker and 6 Arcanist nodes. */
  const hybrid = (): Character => {
    const hero = createWarrior()
    hero.level = 14
    hero.attributes.intelligence = 9
    hero.trained.magic = 100
    hero.perkPoints = 4 + 3 + 3
    hero.perks = {
      magic_arrow: 1,
      destruction: 1,
      flame_arrow: 1,
      pyromancy: 1,
      fireball: 1,
      shield: 1,
      arcane_study: 1,
      mirror_image: 1,
      ward: 1,
      haste: 1,
      lasting_magic: 1,
    }
    return hero
  }

  it('is open only in the calling', () => {
    const hero = hybrid()
    expect(calling(hero)).toEqual(['arcanist'])
    expect(qualifiesFor(hero, 'mass_haste')).toBe(true)
    expect(qualifiesFor(hero, 'meteor')).toBe(false)
  })

  it('closes every other for good once one is taken, whatever the depths later', () => {
    const hero = hybrid()
    expect(takePerk(hero, 'mass_haste')).toBe(true)
    // Evoker becomes the deepest path: 7 against 7, then (an Arcanist node set aside) 7 against 6.
    expect(takePerk(hero, 'acid_arrow')).toBe(true)
    expect(takePerk(hero, 'death_cloud')).toBe(true)
    delete hero.perks.lasting_magic
    expect(calling(hero)).toEqual(['evoker'])
    hero.perkPoints = 4
    expect(qualifiesFor(hero, 'meteor')).toBe(false)
    expect(capstoneOf(hero)).toBe('mass_haste')
  })

  it('opens both while two paths tie, until one is taken', () => {
    const hero = hybrid()
    delete hero.perks.lasting_magic
    expect(calling(hero)).toEqual(['evoker', 'arcanist'])
    expect(qualifiesFor(hero, 'meteor')).toBe(true)
    expect(qualifiesFor(hero, 'mass_haste')).toBe(true)
    expect(takePerk(hero, 'meteor')).toBe(true)
    expect(qualifiesFor(hero, 'mass_haste')).toBe(false)
  })
})

describe('heroTitle', () => {
  const hero = (level: number, ...perks: PerkId[]) => ({ ...createWarrior(), level, perks: Object.fromEntries(perks.map((id) => [id, 1])) })

  it('is the level alone with no node', () => {
    expect(heroTitle(hero(1))).toBe('Level 1')
  })

  it('names the deepest path', () => {
    expect(heroTitle(hero(9, 'toughness', 'shield_wall', 'iron_skin'))).toBe('Level 9 \u00b7 Heavy Knight')
  })

  it('adds the second-deepest path only at 3 nodes or more', () => {
    const knight: PerkId[] = ['toughness', 'shield_wall', 'iron_skin', 'weapon_training']
    expect(heroTitle(hero(9, ...knight, 'bless', 'lay_on_hands', 'blessed_armour'))).toBe('Level 9 \u00b7 Heavy Knight / Paladin')
    expect(heroTitle(hero(9, ...knight, 'bless', 'lay_on_hands'))).toBe('Level 9 \u00b7 Heavy Knight')
  })

  it('settles a tie for deepest in PATH_IDS order, the loser being the second', () => {
    expect(heroTitle(hero(5, 'bless', 'lay_on_hands', 'blessed_armour', 'toughness', 'shield_wall', 'iron_skin'))).toBe(
      'Level 5 \u00b7 Heavy Knight / Paladin',
    )
  })
})
