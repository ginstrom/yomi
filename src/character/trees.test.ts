import { describe, expect, it } from 'vitest'
import { createWarrior, type Character } from './character.ts'
import { PERKS, PERK_IDS, qualifiesFor, type Perk, type PerkId } from './perks.ts'
import { gainXp, takePerk, xpToNextLevel } from './progression.ts'
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

/** The 75 stage-1 and stage-2 nodes, by path, in `PERKS` order (the plan's C3). */
const STAGE_1: Record<PathId, PerkId[]> = {
  swordmaster: ['weapon_training', 'heavy_hand', 'power_attack', 'armor_breaker', 'gain_strength', 'cleave', 'weapon_mastery'],
  heavy_knight: ['toughness', 'shield_wall', 'taunt', 'rooted', 'pin', 'iron_skin'],
  spellsword: ['arcane_blood', 'flame_strike', 'frost_strike', 'spell_ward', 'thunder_strike', 'battle_mage'],
  ranger: ['marksmanship', 'deadly_aim', 'aimed_shot', 'far_shot', 'hunters_mark', 'volley', 'pinning_shot', 'deadeye'],
  rogue: ['dodger', 'sprint', 'skirmisher', 'dirty_trick', 'evasion'],
  assassin: ['keen_eye', 'venom_strike', 'hamstring', 'fortune'],
  evoker: ['magic_arrow', 'destruction', 'flame_arrow', 'pyromancy', 'fireball', 'acid_arrow', 'death_cloud', 'meteor'],
  cryomancer: ['frostbite', 'numbing_cold', 'sleep', 'frost_blast', 'web', 'lingering_cold'],
  arcanist: ['shield', 'arcane_study', 'mirror_image', 'ward', 'haste', 'lasting_magic', 'quickened_casting', 'mass_haste'],
  healer: ['heal', 'mending', 'greater_heal', 'heal_all', 'greater_heal_all', 'swift_hands'],
  paladin: ['bless', 'smite', 'lay_on_hands', 'blessed_armour', 'consecrate', 'sacred_weapon'],
  saint: ['serenity', 'bane', 'protect', 'scholar', 'curse'],
}

const TIER_ORDER: readonly Tier[] = [1, 2, 3, 'capstone']

describe('the trees', () => {
  it('are four of three paths each, in PATH_IDS order', () => {
    expect(TREE_IDS.map((tree) => TREES[tree].name)).toEqual(['Warrior', 'Scout', 'Mage', 'Cleric'])
    expect(TREE_IDS.flatMap(pathsOf)).toEqual([...PATH_IDS])
    for (const tree of TREE_IDS) expect(pathsOf(tree)).toHaveLength(3)
    expect(PATHS.heavy_knight.name).toBe('Heavy Knight')
  })

  it('ask a level and a depth by tier', () => {
    expect(TIERS).toEqual({ 1: { level: 1, depth: 0 }, 2: { level: 2, depth: 1 }, 3: { level: 6, depth: 3 }, capstone: { level: 12, depth: 5 } })
    expect(MANA_PER_TREE_NODE).toBe(2)
  })

  it('hold the 75 stage-1 and stage-2 nodes in PERKS order, by tree, path, then tier', () => {
    expect(PERK_IDS).toHaveLength(75)
    expect(PERK_IDS).toEqual(PATH_IDS.flatMap((path) => STAGE_1[path]))
    for (const path of PATH_IDS) {
      const nodes = PERK_IDS.filter((id) => (PERKS[id] as Perk).path === path)
      expect(nodes).toEqual(STAGE_1[path])
      const tiers = nodes.map((id) => TIER_ORDER.indexOf((PERKS[id] as Perk).tier))
      expect(tiers).toEqual([...tiers].sort((a, b) => a - b))
      expect(nodes.filter((id) => (PERKS[id] as Perk).tier === 'capstone').length).toBeLessThanOrEqual(1)
      // Every path opens with a node of the first tier (the second T1 of a few paths is a later stage's technique).
      expect((PERKS[nodes[0]] as Perk).tier).toBe(1)
    }
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

/**
 * A level 1 mage (intelligence 9, Magic trained high enough for every spell of
 * the path) holding `t1s`, raised level by level, each even level's pick spent
 * on the first of `path` it qualifies for; returns the level each node came at.
 */
function committed(t1s: PerkId[], path: PerkId[]): Map<PerkId, number> {
  const mage = createWarrior()
  mage.attributes.intelligence = 9
  mage.trained.magic = 100
  mage.perks = Object.fromEntries(t1s.map((id) => [id, 1]))
  const came = new Map<PerkId, number>()
  while (mage.level < 14) {
    gainXp(mage, xpToNextLevel(mage.level))
    while (mage.perkPicks > 0) {
      const next = path.find((id) => qualifiesFor(mage, id))
      if (!next || !takePerk(mage, next)) break
      came.set(next, mage.level)
    }
  }
  return came
}

describe('a committed hero (AC1, stage 1)', () => {
  it('takes an Evoker T3 at level 6 and Meteor at level 12, and not before', () => {
    const came = committed(['magic_arrow', 'destruction'], ['flame_arrow', 'pyromancy', 'fireball', 'acid_arrow', 'death_cloud', 'meteor'])
    expect([came.get('flame_arrow'), came.get('pyromancy')]).toEqual([2, 4])
    expect(came.get('fireball')).toBe(6)
    expect(came.get('meteor')).toBe(12)
  })

  it('takes an Arcanist T3 at level 6 and Mass Haste at level 12, and not before', () => {
    const came = committed(['shield', 'arcane_study'], ['mirror_image', 'ward', 'haste', 'lasting_magic', 'quickened_casting', 'mass_haste'])
    expect(came.get('haste')).toBe(6)
    expect(came.get('mass_haste')).toBe(12)
  })

  it('cannot take its capstone before level 12 however deep', () => {
    const deep = createWarrior()
    deep.attributes.intelligence = 9
    deep.trained.magic = 100
    deep.level = 11
    deep.perks = { magic_arrow: 1, destruction: 1, flame_arrow: 1, pyromancy: 1, fireball: 1, acid_arrow: 1, death_cloud: 1 }
    expect(qualifiesFor(deep, 'meteor')).toBe(false)
    expect(qualifiesFor({ ...deep, level: 12 }, 'meteor')).toBe(true)
  })
})

describe('the capstone (AC2, with stage-1 stand-ins)', () => {
  /** A level 14 hero with Magic for anything, 5 Evoker and 6 Arcanist nodes. */
  const hybrid = (): Character => {
    const hero = createWarrior()
    hero.level = 14
    hero.attributes.intelligence = 9
    hero.trained.magic = 100
    hero.perkPicks = 3
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
    hero.perkPicks = 1
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

describe('a committed hero in the Warrior and Scout trees (AC1, stage 2)', () => {
  /** A hero with `t1s`, attributes and skills for every ask, taking `path` in order at levels 2, 4 and 6. */
  const committedWarrior = (t1s: PerkId[], path: PerkId[]): Map<PerkId, number> => {
    const hero = createWarrior()
    Object.assign(hero.attributes, { strength: 9, endurance: 8, perception: 9, agility: 8 })
    hero.trained.melee = 100
    hero.trained.archery = 100
    hero.perks = Object.fromEntries(t1s.map((id) => [id, 1]))
    const came = new Map<PerkId, number>()
    while (hero.level < 6) {
      gainXp(hero, xpToNextLevel(hero.level))
      while (hero.perkPicks > 0) {
        const next = path.find((id) => qualifiesFor(hero, id))
        if (!next || !takePerk(hero, next)) break
        came.set(next, hero.level)
      }
    }
    return came
  }

  it('takes Cleave at level 6 after Power Attack and Armour Breaker', () => {
    const came = committedWarrior(['weapon_training', 'heavy_hand'], ['power_attack', 'armor_breaker', 'cleave'])
    expect([came.get('power_attack'), came.get('armor_breaker'), came.get('cleave')]).toEqual([2, 4, 6])
  })

  it('takes Pin at level 6 after Taunt and Rooted', () => {
    const came = committedWarrior(['toughness', 'shield_wall'], ['taunt', 'rooted', 'pin'])
    expect([came.get('taunt'), came.get('rooted'), came.get('pin')]).toEqual([2, 4, 6])
  })

  it('takes Volley at level 6 after Aimed Shot and Far Shot', () => {
    const came = committedWarrior(['marksmanship', 'deadly_aim'], ['aimed_shot', 'far_shot', 'volley'])
    expect([came.get('aimed_shot'), came.get('far_shot'), came.get('volley')]).toEqual([2, 4, 6])
  })
})
