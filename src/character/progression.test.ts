import { describe, expect, it } from 'vitest'
import { SPARK_WAND, YEW_BOW } from '../inventory/inventory.ts'
import { createWarrior, hpPerLevel, maxHp, type Character } from './character.ts'
import { draftCharacter } from './creation.ts'
import { PERKS, PERK_IDS, knownSpells, type Perk, type PerkId } from './perks.ts'
import {
  AUTO_PLANS,
  EVEN_FOE_XP_PER_LEVEL,
  PICK_LEVEL_STEP,
  PLAN_IDS,
  autoAdvance,
  canAdvance,
  gainXp,
  levelUp,
  nextPerkLevel,
  picksAt,
  planFor,
  skillPointsPerLevel,
  takePerk,
  xpToNextLevel,
} from './progression.ts'
import { SKILL_IDS, skillLevel } from './skills.ts'
import { banditDraft } from '../game/bandits.ts'
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
    expect(gain).toEqual({ xp: xpToNextLevel(1) - 1, levelsGained: 0, maxHpGained: 0, skillPointsGained: 0, perksGained: 0 })
    expect(warrior).toEqual({ ...createWarrior(), xp: xpToNextLevel(1) - 1, hp: 5 })
  })

  it('levels up at the threshold, carrying the rest over, bringing hit points, skill points, a pick and healing', () => {
    const warrior = createWarrior()
    const before = maxHp(warrior)
    warrior.hp = 3
    const gain = gainXp(warrior, xpToNextLevel(1) + 30)
    expect(gain).toEqual({
      xp: xpToNextLevel(1) + 30,
      levelsGained: 1,
      maxHpGained: hpPerLevel(warrior),
      skillPointsGained: skillPointsPerLevel(warrior),
      perksGained: 1,
    })
    expect([warrior.level, warrior.xp]).toEqual([2, 30])
    expect(maxHp(warrior)).toBe(before + hpPerLevel(warrior))
    expect(warrior.hp).toBe(maxHp(warrior))
    expect([warrior.skillPoints, warrior.perkPicks]).toEqual([skillPointsPerLevel(warrior), 1])
  })

  it('adds up experience across gains', () => {
    const warrior = createWarrior()
    gainXp(warrior, xpToNextLevel(1))
    gainXp(warrior, xpToNextLevel(2) - 50)
    expect([warrior.level, warrior.xp]).toEqual([2, xpToNextLevel(2) - 50])
    expect(gainXp(warrior, 50).levelsGained).toBe(1)
    expect([warrior.level, warrior.xp]).toEqual([3, 0])
  })

  it('brings a pick at every even level and none at an odd one (AC3)', () => {
    const warrior = createWarrior()
    const picks = [2, 3, 4, 5, 6].map((level) => {
      const gained = gainXp(warrior, xpToNextLevel(level - 1)).perksGained
      expect(warrior.level).toBe(level)
      return gained
    })
    expect(picks).toEqual([1, 0, 1, 0, 1])
    expect(warrior.perkPicks).toBe(3)
    expect(nextPerkLevel(warrior)).toBe(8)
    expect('spellPicks' in warrior).toBe(false)
  })

  it('climbs several levels on one large gain, with a pick at each even one', () => {
    const warrior = createWarrior()
    const gain = gainXp(warrior, xpToNextLevel(1) + xpToNextLevel(2) + xpToNextLevel(3))
    expect(gain).toMatchObject({ levelsGained: 3, skillPointsGained: 3 * skillPointsPerLevel(warrior), perksGained: 2 })
    expect([warrior.level, warrior.xp, warrior.perkPicks]).toEqual([4, 0, 2])
    expect(nextPerkLevel(warrior)).toBe(2 * PICK_LEVEL_STEP + 2)
  })
})

describe('picksAt', () => {
  it('counts the three of creation and one every even level: 5 by level 5, 8 by 10, 13 by 20', () => {
    expect([1, 2, 3, 4, 5, 10, 20].map(picksAt)).toEqual([3, 4, 4, 5, 5, 8, 13])
  })
})

describe('takePerk', () => {
  it('spends one pick on a node the character qualifies for, and only once', () => {
    const warrior = createWarrior()
    warrior.level = 3
    expect(takePerk(warrior, 'dodger')).toBe(false)
    warrior.perkPicks = 2
    expect(takePerk(warrior, 'evasion')).toBe(false)
    expect(warrior.perkPicks).toBe(2)
    expect(takePerk(warrior, 'dodger')).toBe(true)
    expect(takePerk(warrior, 'dodger')).toBe(false)
    expect([warrior.perks.dodger, warrior.perkPicks]).toEqual([1, 1])
  })

  it('buys a spell with the same pick as any node', () => {
    const mage = createWarrior()
    mage.trained.magic = 32
    mage.perkPicks = 1
    expect(takePerk(mage, 'heal')).toBe(true)
    expect([mage.perkPicks, knownSpells(mage)]).toEqual([0, ['heal']])
  })

  it('adds the hit points and mana a node brings to those the character has left', () => {
    const warrior = createWarrior()
    warrior.level = 3
    warrior.perkPicks = 2
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
  it('holds while there are skill points, or a pick and a node on offer', () => {
    const warrior = createWarrior()
    expect(canAdvance(warrior)).toBe(false)
    warrior.skillPoints = 1
    expect(canAdvance(warrior)).toBe(true)
    warrior.skillPoints = 0
    warrior.perkPicks = 1
    expect(canAdvance(warrior)).toBe(true)
    // A pick with no node on offer is nothing to act on yet.
    warrior.perks = Object.fromEntries(PERK_IDS.filter((id) => (PERKS[id] as Perk).tier === 1).map((id) => [id, 1]))
    expect(canAdvance(warrior)).toBe(false)
    warrior.level = 2
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
  it('puts skill points into the weapon in hand and spends the pick by its plan, leaving nothing unspent', () => {
    const warrior = createWarrior()
    const before = skillLevel(warrior, 'melee')
    for (let i = 0; i < 2; i++) levelUp(warrior)
    autoAdvance(warrior)
    expect(skillLevel(warrior, 'melee')).toBe(before + 2 * 2 * skillPointsPerLevel(warrior) + 10)
    expect([warrior.skillPoints, warrior.perkPicks]).toEqual([0, 0])
    // The knight's plan: Weapon Training first.
    expect(warrior.perks).toEqual({ weapon_training: 1 })
    expect(warrior.hp).toBe(maxHp(warrior))
  })

  it('follows the weapon the character holds', () => {
    const archer = createWarrior()
    archer.equipment.mainHand = YEW_BOW
    levelUp(archer)
    archer.perkPicks = 0
    autoAdvance(archer)
    expect(archer.trained).toMatchObject({ archery: skillPointsPerLevel(archer), melee: 0 })
  })

  it('trains Magic for a character with a wand in hand, and only skills there are', () => {
    const mage = createWarrior()
    mage.equipment.mainHand = SPARK_WAND
    levelUp(mage)
    mage.perkPicks = 0
    autoAdvance(mage)
    expect(mage.trained).toEqual({ melee: 0, archery: 0, magic: skillPointsPerLevel(mage) })
    expect(Object.keys(mage.trained)).toEqual([...SKILL_IDS])
  })

  /** A ready-made hero raised to `level` and spent by `autoAdvance` on `plan`. */
  const grown = (index: number, level: number, plan?: Parameters<typeof autoAdvance>[1]): Character => {
    const hero = draftCharacter(READY_MADE[index])
    while (hero.level < level) levelUp(hero)
    autoAdvance(hero, plan)
    return hero
  }
  const held = (hero: Character) => PERK_IDS.filter((id) => hero.perks[id])

  /** The node `autoAdvance` takes at each level from 2 to 7, from `draft`'s level 1, by `plan`. */
  const taken = (draft: Parameters<typeof draftCharacter>[0], plan?: Parameters<typeof autoAdvance>[1]): Record<number, PerkId[]> => {
    const hero = draftCharacter(draft)
    const picks: Record<number, PerkId[]> = {}
    while (hero.level < 7) {
      levelUp(hero)
      const before = held(hero)
      autoAdvance(hero, plan)
      expect(hero.perkPicks).toBe(0)
      picks[hero.level] = held(hero).filter((id) => !before.includes(id))
    }
    return picks
  }

  it('follows the knight plan from Aldric: Rooted, Taunt and Pin at levels 2, 4 and 6', () => {
    expect(taken(READY_MADE[0])).toEqual({ 2: ['rooted'], 3: [], 4: ['taunt'], 5: [], 6: ['pin'], 7: [] })
    // Spent all at once at level 6, the same nodes (Pin asks Melee 55 and three Heavy Knight nodes).
    expect(held(grown(0, 6))).toEqual(['weapon_training', 'heavy_hand', 'toughness', 'taunt', 'rooted', 'pin'])
  })

  it('follows the ranger plan from Brenna: Aimed Shot, Far Shot and Volley', () => {
    expect(taken(READY_MADE[1])).toEqual({ 2: ['aimed_shot'], 3: [], 4: ['far_shot'], 5: [], 6: ['volley'], 7: [] })
  })

  it('follows the swordmaster plan from the Brute: Power Attack, Armour Breaker and Cleave', () => {
    expect(taken(banditDraft('brute'), 'swordmaster')).toEqual({ 2: ['power_attack'], 3: [], 4: ['armor_breaker'], 5: [], 6: ['cleave'], 7: [] })
  })

  it('follows the rogue plan from the Cutthroat: Backstab, Dirty Trick, then Sprint, which opens Tumble', () => {
    expect(taken(banditDraft('cutthroat'), 'rogue')).toEqual({ 2: ['backstab'], 3: [], 4: ['dirty_trick'], 5: [], 6: ['sprint'], 7: [] })
  })

  it('follows the knight plan from the Captain: Rooted, Taunt and Pin at levels 2, 4 and 6, Heavy Hand after', () => {
    // The Captain's draft holds Weapon Training and Toughness; the plan takes Heavy Hand only after Pin.
    expect(taken(banditDraft('captain'), 'knight')).toEqual({ 2: ['rooted'], 3: [], 4: ['taunt'], 5: [], 6: ['pin'], 7: [] })
  })

  it('follows the evoker-healer plan, which holds no stage-2 node', () => {
    expect(knownSpells(grown(2, 6))).toEqual(expect.arrayContaining(['magic_arrow', 'flame_arrow', 'heal', 'heal_all']))
  })

  it('writes the six plans of C5 in full', () => {
    expect(AUTO_PLANS.knight).toEqual([
      'weapon_training', 'toughness', 'rooted', 'taunt', 'pin', 'heavy_hand', 'iron_skin', 'guardian', 'unbreakable',
      'shield_wall', 'power_attack', 'armor_breaker', 'weapon_mastery',
    ])
    expect(AUTO_PLANS.swordmaster).toEqual([
      'weapon_training', 'heavy_hand', 'power_attack', 'armor_breaker', 'cleave', 'gain_strength', 'weapon_mastery', 'blademaster', 'toughness',
    ])
    expect(AUTO_PLANS.ranger).toEqual([
      'marksmanship', 'deadly_aim', 'aimed_shot', 'far_shot', 'volley', 'hunters_mark', 'pinning_shot', 'deadeye',
      'dodger', 'sprint', 'skirmisher', 'tumble', 'evasion',
    ])
    expect(AUTO_PLANS.rogue).toEqual(['backstab', 'dirty_trick', 'sprint', 'tumble', 'evasion', 'counter', 'skirmisher', 'shadowdancer'])
    expect(AUTO_PLANS.evoker_healer).toEqual([
      'magic_arrow', 'heal', 'destruction', 'flame_arrow', 'heal_all', 'fireball', 'pyromancy', 'mending', 'meteor',
      'greater_heal', 'death_cloud', 'greater_heal_all', 'purify',
    ])
    expect(AUTO_PLANS.bandit_mage).toEqual(['flame_arrow', 'destruction', 'fireball', 'heal', 'heal_all'])
    // The parity plans are their path, the capstone first (taken as soon as it opens), stage-3 nodes included.
    expect(AUTO_PLANS.assassin).toContain('deathblow')
    expect(AUTO_PLANS.healer).toEqual(['revive', 'heal', 'mending', 'greater_heal', 'heal_all', 'greater_heal_all', 'purify', 'swift_hands'])
  })

  it('takes the ready-made heroes to their capstones at 12: Aldric Unbreakable, Brenna Deadeye and Delwyn Meteor', () => {
    expect(grown(0, 11).perks.unbreakable).toBeUndefined()
    expect(grown(0, 12).perks.unbreakable).toBe(1)
    expect(grown(1, 11).perks.deadeye).toBeUndefined()
    expect(grown(1, 12).perks.deadeye).toBe(1)
    // Delwyn's creation picks are the design's build B (Destruction, not Arcane Study), so his six picks to level 12
    // are the plan's Flame Arrow, Heal All, Fireball, Pyromancy, Mending and Meteor (skill trees step 24).
    expect(grown(2, 11).perks.meteor).toBeUndefined()
    expect(grown(2, 12).perks).toMatchObject({ mending: 1, meteor: 1 })
  })

  it('spends every pick of the ready-made heroes to level 20, levelled one at a time', () => {
    for (const index of [0, 1, 2]) {
      const hero = draftCharacter(READY_MADE[index])
      while (hero.level < 20) {
        levelUp(hero)
        autoAdvance(hero)
      }
      expect([hero.level, hero.perkPicks], READY_MADE[index].name).toEqual([20, 0])
    }
  })

  it('spends every pick it can and never takes a capstone by the fallback', () => {
    for (const plan of PLAN_IDS) {
      for (const index of [0, 1, 2]) {
        const hero = grown(index, 14, plan)
        const capstones = PERK_IDS.filter((id) => hero.perks[id] && (PERKS[id] as Perk).tier === 'capstone')
        // A capstone comes only from a plan that names it.
        for (const capstone of capstones) expect(AUTO_PLANS[plan]).toContain(capstone)
        // A pick is left only when nothing is on offer.
        if (hero.perkPicks > 0) {
          const offered = PERK_IDS.filter((id: PerkId) => (PERKS[id] as Perk).tier !== 'capstone' && !hero.perks[id])
          expect(offered.every((id) => !takePerk({ ...hero, perks: { ...hero.perks } }, id))).toBe(true)
        }
      }
    }
  })

  it('takes Aldric down the Spellsword path to Arcane Knight at 12, Arcane Blood asking Intelligence 3', () => {
    expect(grown(0, 12, 'spellsword').perks).toMatchObject({ arcane_blood: 1, arcane_knight: 1 })
  })

  it('gives the cryomancer Ice Lance before Glacial Prison: both at 12', () => {
    expect(grown(2, 12, 'cryomancer').perks).toMatchObject({ ice_lance: 1, glacial_prison: 1 })
  })

  it('takes the plan\'s capstone as soon as it opens, the path its calling (the evoker and Meteor)', () => {
    // The evoker plan names Meteor first: Delwyn takes it with level 12's pick, at Evoker depth 6.
    expect(grown(2, 11, 'evoker').perks.meteor).toBeUndefined()
    expect(grown(2, 12, 'evoker').perks.meteor).toBe(1)
  })
})
