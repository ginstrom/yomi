import { describe, expect, it } from 'vitest'
import { SPARK_WAND, YEW_BOW } from '../inventory/inventory.ts'
import { createWarrior, hpPerLevel, maxHp, type Character } from './character.ts'
import { draftCharacter } from './creation.ts'
import { CREATION_PERK_POINTS } from './creation.ts'
import { PERKS, PERK_IDS, knownSpells, nodesCost, perkCost, qualifiesFor, type Perk, type PerkId } from './perks.ts'
import {
  AUTO_PLANS,
  EVEN_FOE_XP_PER_LEVEL,
  PERK_POINTS_PER_LEVEL,
  PLAN_IDS,
  affordableAt,
  autoAdvance,
  canAdvance,
  canAffordPerk,
  gainXp,
  levelUp,
  planFor,
  pointsAt,
  skillPointsPerLevel,
  takePerk,
  xpToNextLevel,
} from './progression.ts'
import { SKILL_IDS, skillLevel } from './skills.ts'
import { BANDIT_PLAN, banditDraft, type BanditRole } from '../game/bandits.ts'
import { READY_MADE } from '../game/party.ts'

describe('xpToNextLevel', () => {
  it('asks for more even foes at each level: under one, then one, two, three', () => {
    const evenFoes = [1, 2, 3, 4, 5].map((level) => xpToNextLevel(level) / (EVEN_FOE_XP_PER_LEVEL * level))
    expect(evenFoes[0]).toBeLessThan(1)
    expect(evenFoes.slice(1)).toEqual([1, 2, 3, 4])
  })

  it('lets two weak foes, each worth half an even one, buy level 3', () => {
    expect(xpToNextLevel(2)).toBe(2 * (EVEN_FOE_XP_PER_LEVEL * 2 * 0.5))
  })
})

describe('skillPointsPerLevel', () => {
  it('gives 2 and a third of the character’s intelligence, and what a perk adds', () => {
    const warrior = createWarrior()
    const points = (intelligence: number) => {
      warrior.attributes.intelligence = intelligence
      return skillPointsPerLevel(warrior)
    }
    expect([1, 2, 3, 5, 6, 8, 9, 10].map(points)).toEqual([2, 2, 3, 3, 4, 4, 5, 5])
    warrior.perks.scholar = 1
    expect(skillPointsPerLevel(warrior)).toBe(7)
    // An attribute a node has raised counts.
    warrior.attributes.intelligence = 5
    warrior.perks = { lasting_magic: 1 }
    expect(skillPointsPerLevel(warrior)).toBe(4)
  })
})

describe('gainXp', () => {
  it('keeps experience short of a level, and changes nothing else', () => {
    const warrior = createWarrior()
    warrior.hp = 5
    const gain = gainXp(warrior, xpToNextLevel(1) - 1)
    expect(gain).toEqual({ xp: xpToNextLevel(1) - 1, levelsGained: 0, maxHpGained: 0, skillPointsGained: 0, perkPointsGained: 0 })
    expect(warrior).toEqual({ ...createWarrior(), xp: xpToNextLevel(1) - 1, hp: 5 })
  })

  it('levels up at the threshold, carrying the rest over, bringing hit points, skill points, a perk point and healing', () => {
    const warrior = createWarrior()
    const before = maxHp(warrior)
    warrior.hp = 3
    const gain = gainXp(warrior, xpToNextLevel(1) + 30)
    expect(gain).toEqual({
      xp: xpToNextLevel(1) + 30,
      levelsGained: 1,
      maxHpGained: hpPerLevel(warrior),
      skillPointsGained: skillPointsPerLevel(warrior),
      perkPointsGained: 1,
    })
    expect([warrior.level, warrior.xp]).toEqual([2, 30])
    expect(maxHp(warrior)).toBe(before + hpPerLevel(warrior))
    expect(warrior.hp).toBe(maxHp(warrior))
    expect([warrior.skillPoints, warrior.perkPoints]).toEqual([skillPointsPerLevel(warrior), 1])
  })

  it('adds up experience across gains', () => {
    const warrior = createWarrior()
    gainXp(warrior, xpToNextLevel(1))
    gainXp(warrior, xpToNextLevel(2) - 50)
    expect([warrior.level, warrior.xp]).toEqual([2, xpToNextLevel(2) - 50])
    expect(gainXp(warrior, 50).levelsGained).toBe(1)
    expect([warrior.level, warrior.xp]).toEqual([3, 0])
  })

  it('brings exactly one perk point at every level, odd or even (NC1)', () => {
    const warrior = createWarrior()
    const points = [2, 3, 4, 5, 6].map((level) => {
      const gained = gainXp(warrior, xpToNextLevel(level - 1)).perkPointsGained
      expect(warrior.level).toBe(level)
      return gained
    })
    expect(points).toEqual([1, 1, 1, 1, 1])
    expect(warrior.perkPoints).toBe(5)
    expect('spellPicks' in warrior).toBe(false)
    expect('perkPicks' in warrior).toBe(false)
  })

  it('climbs several levels on one large gain, with a perk point at each', () => {
    const warrior = createWarrior()
    const gain = gainXp(warrior, xpToNextLevel(1) + xpToNextLevel(2) + xpToNextLevel(3))
    expect(gain).toMatchObject({ levelsGained: 3, skillPointsGained: 3 * skillPointsPerLevel(warrior), perkPointsGained: 3 })
    expect([warrior.level, warrior.xp, warrior.perkPoints]).toEqual([4, 0, 3])
  })
})

describe('pointsAt', () => {
  it('counts the three of creation and one every level: 6 by level 4, 10 by 8, 14 by 12, 22 by 20 (NC1)', () => {
    expect([1, 2, 4, 8, 12, 20].map(pointsAt)).toEqual([3, 4, 6, 10, 14, 22])
    expect([pointsAt(1), PERK_POINTS_PER_LEVEL]).toEqual([CREATION_PERK_POINTS, 1])
  })

  it('is what a new hero has, and each level adds exactly one', () => {
    const hero = draftCharacter({ ...READY_MADE[0], perks: [] })
    expect(hero.perkPoints).toBe(pointsAt(1))
    for (let level = 2; level <= 20; level++) {
      levelUp(hero)
      expect(hero.perkPoints).toBe(pointsAt(level))
    }
  })
})

describe('canAffordPerk and affordableAt', () => {
  it('ask the tier\'s cost in perk points, and say the level saving alone reaches it', () => {
    const hero = { ...createWarrior(), level: 9, perkPoints: 1 }
    expect([canAffordPerk(hero, 'toughness'), canAffordPerk(hero, 'taunt'), canAffordPerk(hero, 'pin')]).toEqual([true, false, false])
    expect([affordableAt(hero, 'toughness'), affordableAt(hero, 'taunt'), affordableAt(hero, 'pin'), affordableAt(hero, 'unbreakable')]).toEqual([
      9, 10, 11, 12,
    ])
  })
})

describe('takePerk', () => {
  it('spends a tier-1 node\'s one perk point on a node the character qualifies for, and only once', () => {
    const warrior = createWarrior()
    warrior.level = 3
    expect(takePerk(warrior, 'dodger')).toBe(false)
    warrior.perkPoints = 2
    expect(takePerk(warrior, 'evasion')).toBe(false)
    expect(warrior.perkPoints).toBe(2)
    expect(takePerk(warrior, 'dodger')).toBe(true)
    expect(takePerk(warrior, 'dodger')).toBe(false)
    expect([warrior.perks.dodger, warrior.perkPoints]).toEqual([1, 1])
  })

  it('spends each tier\'s cost, 1, 2, 3 and a capstone 4, and refuses a node it cannot afford (NC2)', () => {
    expect((['toughness', 'taunt', 'pin', 'unbreakable'] as const).map(perkCost)).toEqual([1, 2, 3, 4])
    const knight = { ...createWarrior(), level: 12, perkPoints: 0 }
    knight.trained.melee = 40
    const spend = (perk: PerkId, points: number) => {
      knight.perkPoints = points - 1
      expect(takePerk(knight, perk), `${perk} with ${points - 1}`).toBe(false)
      expect(knight.perks[perk]).toBeUndefined()
      knight.perkPoints = points + 1
      expect(takePerk(knight, perk), `${perk} with ${points + 1}`).toBe(true)
      expect(knight.perkPoints).toBe(1)
    }
    spend('toughness', 1)
    spend('rooted', 2)
    spend('taunt', 2)
    spend('pin', 3)
    spend('iron_skin', 3)
    spend('unbreakable', 4)
    expect(nodesCost(knight)).toBe(1 + 2 + 2 + 3 + 3 + 4)
  })

  it('buys a spell with perk points as any node', () => {
    const mage = createWarrior()
    mage.trained.magic = 32
    mage.perkPoints = 1
    expect(takePerk(mage, 'heal')).toBe(true)
    expect([mage.perkPoints, knownSpells(mage)]).toEqual([0, ['heal']])
  })

  it('adds the hit points and mana a node brings to those the character has left', () => {
    const warrior = createWarrior()
    warrior.level = 3
    warrior.perkPoints = 2
    warrior.hp = 4
    takePerk(warrior, 'toughness')
    // Toughness's 8, a point of endurance, and endurance 8 is worth 1 more for each of two levels.
    expect(warrior.hp).toBe(15)
    warrior.trained.magic = 32
    // Every hero has mana; Heal, a Cleric node, brings 2 more to what it has left.
    warrior.mana = 3
    expect(takePerk(warrior, 'heal')).toBe(true)
    expect(warrior.mana).toBe(3 + 2)
  })
})

describe('canAdvance', () => {
  it('holds while there are skill points, or perk points enough for a node on offer', () => {
    const warrior = createWarrior()
    expect(canAdvance(warrior)).toBe(false)
    warrior.skillPoints = 1
    expect(canAdvance(warrior)).toBe(true)
    warrior.skillPoints = 0
    warrior.perkPoints = 1
    expect(canAdvance(warrior)).toBe(true)
    // A point with no node on offer is nothing to act on yet.
    warrior.perks = Object.fromEntries(PERK_IDS.filter((id) => (PERKS[id] as Perk).tier === 1).map((id) => [id, 1]))
    expect(canAdvance(warrior)).toBe(false)
    // At level 2 the tier-2 nodes open, but each costs 2.
    warrior.level = 2
    expect(canAdvance(warrior)).toBe(false)
    warrior.perkPoints = 2
    expect(canAdvance(warrior)).toBe(true)
  })
})

describe('planFor', () => {
  it('picks by the tagged skill: Melee knight, Archery ranger, Magic evoker_healer', () => {
    expect(READY_MADE.map((draft) => planFor(draftCharacter(draft)))).toEqual(['knight', 'ranger', 'evoker_healer'])
  })
})

describe('AUTO_PLANS', () => {
  it('names fifteen plans, each listing only nodes there are, none twice', () => {
    expect(Object.keys(AUTO_PLANS)).toEqual([...PLAN_IDS])
    for (const plan of PLAN_IDS) {
      expect(AUTO_PLANS[plan].every((id) => PERK_IDS.includes(id))).toBe(true)
      expect(new Set(AUTO_PLANS[plan]).size).toBe(AUTO_PLANS[plan].length)
    }
  })

  it('writes the parity plans as their path, its capstone first and the rest in PERKS order, the rogue archer the rogue path', () => {
    const path = (p: Perk['path']) => {
      const nodes = PERK_IDS.filter((id) => (PERKS[id] as Perk).path === p)
      const capstone = (id: PerkId) => (PERKS[id] as Perk).tier === 'capstone'
      return [...nodes.filter(capstone), ...nodes.filter((id) => !capstone(id))]
    }
    expect(AUTO_PLANS.evoker).toEqual(path('evoker'))
    expect(AUTO_PLANS.saint).toEqual(path('saint'))
    // The cryomancer's alone puts Ice Lance ahead of Web, so that Ice Lance comes before the capstone (skill trees step 24).
    expect([...AUTO_PLANS.cryomancer].sort()).toEqual(path('cryomancer').sort())
    expect(AUTO_PLANS.cryomancer.indexOf('ice_lance')).toBeLessThan(AUTO_PLANS.cryomancer.indexOf('web'))
    expect(AUTO_PLANS.rogue_archer).toEqual(path('rogue'))
  })
})

describe('autoAdvance', () => {
  it('puts skill points into the weapon in hand and saves its perk point for the plan\'s next node', () => {
    const warrior = createWarrior()
    const before = skillLevel(warrior, 'melee')
    for (let i = 0; i < 2; i++) levelUp(warrior)
    autoAdvance(warrior)
    expect(skillLevel(warrior, 'melee')).toBe(before + 2 * 2 * skillPointsPerLevel(warrior) + 10)
    // The knight's plan: Weapon Training (1 point) first, then Toughness (1); Rooted, at 2, waits for a third level.
    expect(warrior.perks).toEqual({ weapon_training: 1, toughness: 1 })
    expect([warrior.skillPoints, warrior.perkPoints]).toEqual([0, 0])
    expect(warrior.hp).toBe(maxHp(warrior))
  })

  it('follows the weapon the character holds', () => {
    const archer = createWarrior()
    archer.equipment.mainHand = YEW_BOW
    levelUp(archer)
    archer.perkPoints = 0
    autoAdvance(archer)
    expect(archer.trained).toMatchObject({ archery: skillPointsPerLevel(archer), melee: 0 })
  })

  it('trains Magic for a character with a wand in hand, and only skills there are', () => {
    const mage = createWarrior()
    mage.equipment.mainHand = SPARK_WAND
    levelUp(mage)
    mage.perkPoints = 0
    autoAdvance(mage)
    expect(mage.trained).toEqual({ melee: 0, archery: 0, magic: skillPointsPerLevel(mage) })
    expect(Object.keys(mage.trained)).toEqual([...SKILL_IDS])
  })

  /** A ready-made hero raised to `level` a level at a time, spent by `autoAdvance` on `plan` at each, as the simulator's `raisedParty` does. */
  const grown = (index: number, level: number, plan?: Parameters<typeof autoAdvance>[1]): Character => {
    const hero = draftCharacter(READY_MADE[index])
    while (hero.level < level) {
      levelUp(hero)
      autoAdvance(hero, plan)
    }
    return hero
  }

  /** The level at which `autoAdvance` takes each node after creation, from `draft`'s level 1 to `upTo`, by `plan`. */
  const nodeLevels = (draft: Parameters<typeof draftCharacter>[0], plan?: Parameters<typeof autoAdvance>[1], upTo = 15) => {
    const hero = draftCharacter(draft)
    const levels: Partial<Record<PerkId, number>> = {}
    while (hero.level < upTo) {
      levelUp(hero)
      autoAdvance(hero, plan)
      for (const id of PERK_IDS) if (hero.perks[id] && !(id in levels) && !draft.perks.includes(id)) levels[id] = hero.level
    }
    return levels
  }

  it('saves for the plan\'s next node rather than spend on a cheaper one: Delwyn keeps Heal All for after Fireball', () => {
    const delwyn = grown(2, 5)
    expect(delwyn.perks.flame_arrow).toBe(1)
    expect(delwyn.perks.heal_all).toBeUndefined()
    // Levels 4 and 5 brought 2 points, saved for Fireball's 3 at level 6.
    expect(delwyn.perkPoints).toBe(2)
    expect(grown(2, 6).perks).toMatchObject({ fireball: 1 })
    expect(grown(2, 6).perks.heal_all).toBeUndefined()
  })

  it('takes the ready-made heroes\' nodes at the levels the costs allow (C18)', () => {
    expect(nodeLevels(READY_MADE[0])).toMatchObject({ rooted: 3, taunt: 5, pin: 8, iron_skin: 11, unbreakable: 15 })
    expect(nodeLevels(READY_MADE[1])).toMatchObject({ aimed_shot: 3, volley: 6, far_shot: 8, deadeye: 12 })
    expect(nodeLevels(READY_MADE[2])).toMatchObject({ flame_arrow: 3, fireball: 6, heal_all: 8, pyromancy: 10, meteor: 14 })
    // Not a level earlier.
    expect(grown(0, 14).perks.unbreakable).toBeUndefined()
    expect(grown(1, 11).perks.deadeye).toBeUndefined()
    expect(grown(2, 13).perks.meteor).toBeUndefined()
  })

  it('takes each bandit role\'s nodes at the levels the costs allow, by its plan (C18)', () => {
    const levels = (role: BanditRole) => nodeLevels(banditDraft(role), BANDIT_PLAN[role], 9)
    expect(levels('captain')).toMatchObject({ rooted: 3, taunt: 5, pin: 8 })
    expect(levels('brute')).toMatchObject({ power_attack: 3, armor_breaker: 5, cleave: 8 })
    expect(levels('archer')).toMatchObject({ aimed_shot: 3, volley: 6 })
    expect(levels('crossbowman')).toMatchObject({ aimed_shot: 3, volley: 6 })
    expect(levels('mage')).toMatchObject({ flame_arrow: 3, destruction: 4, fireball: 7 })
    expect(levels('cutthroat')).toMatchObject({ backstab: 2, dirty_trick: 4, sprint: 5 })
  })

  it('gives each bandit role the nodes of today\'s map\'s levels, 3, 4 and 5', () => {
    const at = (role: BanditRole, level: number) => {
      const bandit = draftCharacter(banditDraft(role))
      while (bandit.level < level) {
        levelUp(bandit)
        autoAdvance(bandit, BANDIT_PLAN[role])
      }
      return PERK_IDS.filter((id) => bandit.perks[id] && !banditDraft(role).perks.includes(id))
    }
    const table = Object.fromEntries(
      (['captain', 'brute', 'archer', 'crossbowman', 'mage', 'cutthroat'] as const).map((role) => [role, [3, 4, 5].map((level) => at(role, level))]),
    )
    expect(table).toEqual({
      captain: [['rooted'], ['rooted'], ['taunt', 'rooted']],
      brute: [['power_attack'], ['power_attack'], ['power_attack', 'armor_breaker']],
      archer: [['aimed_shot'], ['aimed_shot'], ['aimed_shot']],
      crossbowman: [['aimed_shot'], ['aimed_shot'], ['aimed_shot']],
      mage: [['flame_arrow'], ['destruction', 'flame_arrow'], ['destruction', 'flame_arrow']],
      cutthroat: [['backstab'], ['dirty_trick', 'backstab'], ['sprint', 'dirty_trick', 'backstab']],
    })
  })

  it('keeps every hero never migrated on the invariant: points left and nodes\' cost add up to pointsAt(level)', () => {
    const drafts = [...READY_MADE, ...(['captain', 'brute', 'archer', 'crossbowman', 'mage', 'cutthroat'] as const).map(banditDraft)]
    for (const draft of drafts) {
      const hero = draftCharacter(draft)
      expect(hero.perkPoints + nodesCost(hero)).toBe(pointsAt(1))
      while (hero.level < 20) {
        levelUp(hero)
        autoAdvance(hero)
        expect(hero.perkPoints + nodesCost(hero), `${draft.name} at ${hero.level}`).toBe(pointsAt(hero.level))
      }
    }
  })

  /** The plan's first node not held that the hero qualifies for, or would at a higher level alone (C18's target). */
  const planTarget = (hero: Character, plan: (typeof PLAN_IDS)[number]) =>
    AUTO_PLANS[plan].find((id) => qualifiesFor({ ...hero, level: Math.max(hero.level, 99) }, id))

  it('stops only at a node it cannot take yet, and never takes a capstone by the fallback (NC5)', () => {
    for (const plan of PLAN_IDS) {
      for (const index of [0, 1, 2]) {
        const hero = draftCharacter(READY_MADE[index])
        while (hero.level < 20) {
          levelUp(hero)
          autoAdvance(hero, plan)
          const where = `${plan} ${READY_MADE[index].name} ${hero.level}`
          // What it stopped at waits on the level or on points: the plan's target, else the fallback's first.
          const target =
            planTarget(hero, plan) ?? PERK_IDS.find((id) => (PERKS[id] as Perk).tier !== 'capstone' && qualifiesFor(hero, id))
          if (target) expect(qualifiesFor(hero, target) && canAffordPerk(hero, target), where).toBe(false)
        }
        // A capstone comes only from a plan that names it.
        const capstones = PERK_IDS.filter((id) => hero.perks[id] && (PERKS[id] as Perk).tier === 'capstone')
        for (const capstone of capstones) expect(AUTO_PLANS[plan]).toContain(capstone)
      }
    }
  }, 30_000)

  it('writes the plans of C18 in full', () => {
    expect(AUTO_PLANS.knight).toEqual([
      'weapon_training', 'toughness', 'rooted', 'taunt', 'pin', 'heavy_hand', 'iron_skin', 'unbreakable', 'guardian',
      'shield_wall', 'power_attack', 'armor_breaker', 'weapon_mastery',
    ])
    expect(AUTO_PLANS.swordmaster).toEqual([
      'weapon_training', 'heavy_hand', 'power_attack', 'armor_breaker', 'cleave', 'gain_strength', 'weapon_mastery', 'blademaster', 'toughness',
    ])
    expect(AUTO_PLANS.ranger).toEqual([
      'marksmanship', 'deadly_aim', 'aimed_shot', 'volley', 'far_shot', 'deadeye', 'hunters_mark', 'pinning_shot',
      'dodger', 'sprint', 'skirmisher', 'tumble', 'evasion',
    ])
    expect(AUTO_PLANS.rogue).toEqual(['backstab', 'dirty_trick', 'sprint', 'tumble', 'evasion', 'counter', 'skirmisher', 'shadowdancer'])
    expect(AUTO_PLANS.evoker_healer).toEqual([
      'magic_arrow', 'heal', 'destruction', 'flame_arrow', 'fireball', 'heal_all', 'pyromancy', 'meteor', 'greater_heal',
      'mending', 'death_cloud', 'greater_heal_all', 'purify',
    ])
    expect(AUTO_PLANS.bandit_mage).toEqual(['flame_arrow', 'destruction', 'fireball', 'heal', 'heal_all'])
    // The parity plans are their path, the capstone first (taken as soon as it opens), stage-3 nodes included.
    expect(AUTO_PLANS.assassin).toContain('deathblow')
    expect(AUTO_PLANS.healer).toEqual(['revive', 'heal', 'mending', 'greater_heal', 'heal_all', 'greater_heal_all', 'purify', 'swift_hands'])
  })

  it('takes a capstone-first plan\'s capstone at the first level it can afford it, its path the calling', () => {
    // The evoker plan names Meteor first: Delwyn reaches depth 5 by 10 and saves for it, taking it at 12.
    expect(grown(2, 11, 'evoker').perks.meteor).toBeUndefined()
    expect(grown(2, 12, 'evoker').perks.meteor).toBe(1)
    // The spellsword's Arcane Knight and the cryomancer's Glacial Prison, Ice Lance before it, both by 14.
    expect(grown(0, 13, 'spellsword').perks.arcane_knight).toBeUndefined()
    expect(grown(0, 14, 'spellsword').perks).toMatchObject({ arcane_blood: 1, arcane_knight: 1 })
    expect(grown(2, 13, 'cryomancer').perks.glacial_prison).toBeUndefined()
    expect(grown(2, 14, 'cryomancer').perks).toMatchObject({ ice_lance: 1, glacial_prison: 1 })
  })
})
