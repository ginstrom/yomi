import { describe, expect, it } from 'vitest'
import { craftCost } from '../game/crafting.ts'
import { FAMILIES, LEGACY_ALIASES, MATERIALS, TIER_BONUS, gearClass } from './catalog.ts'
import { GRADES } from './grades.ts'
import {
  BASE_ITEMS,
  IRON_BATTLE_AXE,
  IRON_BREASTPLATE,
  IRON_DAGGER,
  IRON_GREATSWORD,
  IRON_SHORTSWORD,
  IRON_SWORD,
  MAGIC_ITEMS,
  OAK_SHIELD,
  SPARK_WAND,
  WEAPONS,
  YEW_BOW,
  craftedItem,
  describeItemStats,
  itemById,
  strengthShortfall,
  type ItemStats,
} from './inventory.ts'
import { modifiersFor } from './modifiers.ts'

describe('the catalog', () => {
  it('builds every family in each tier of its material kind, tier 1 first', () => {
    expect(MATERIALS.map((m) => m.id)).toEqual(['iron', 'steel', 'yew', 'ironwood', 'leather', 'wolfhide', 'linen', 'silk'])
    expect(FAMILIES).toHaveLength(28)
    expect(BASE_ITEMS).toHaveLength(56)
    const expected = FAMILIES.flatMap((family) =>
      MATERIALS.filter((m) => m.kind === family.kind).map((material) => ({ family, material })),
    )
    BASE_ITEMS.forEach((item, i) => {
      const { family, material } = expected[i]
      expect(item.family, item.id).toBe(family.id)
      expect(item.material, item.id).toBe(material.id)
      expect(item.tier, item.id).toBe(material.tier)
      expect(item.slot, item.id).toBe(family.slot)
      expect(item.icon, item.id).toBe(family.icon)
      const tier1 = material.tier === 1 ? family.tier1 : undefined
      expect(item.id).toBe(tier1?.id ?? `${material.id}_${family.id}`)
      expect(item.name).toBe(tier1?.name ?? `${material.name} ${family.name}`)
      // A tier's bonus is the only difference from the family's own stats.
      const bonus = TIER_BONUS[gearClass(family.slot)][material.tier]
      const plus: ItemStats = { ...family.stats }
      for (const [key, value] of Object.entries(bonus) as [keyof ItemStats, unknown][]) {
        if (key === 'damage') plus.damage = { ...family.stats.damage!, bonus: family.stats.damage!.bonus + (value as { bonus: number }).bonus }
        else (plus as Record<string, number>)[key] = ((family.stats[key] as number | undefined) ?? 0) + (value as number)
      }
      expect(item.stats, item.id).toEqual(plus)
    })
  })

  it('gives tier 2 its bonus, and never moves AP, range, piercing or a weight', () => {
    expect(itemById('steel_longsword')!.stats).toEqual({ damage: { count: 1, sides: 8, bonus: 5 }, attackApCost: 5, armorPierce: 1 })
    expect(itemById('steel_longsword')!.name).toBe('Steel Longsword')
    expect(itemById('steel_breastplate')!.stats).toMatchObject({ acBonus: 12, resistance: 3 })
    expect(itemById('ironwood_shield')!.stats).toEqual({ acBonus: 12 })
    expect(itemById('ironwood_wand')!.name).toBe('Ironwood Wand')
    expect(itemById('steel_helm')!.stats).toMatchObject({ acBonus: 3, resistance: 1 })
    expect(itemById('silk_robe')!.stats).toEqual({ acBonus: 2, resistance: 1, maxMana: 6, spellSkill: 5 })
    expect(itemById('silk_robe')!.name).toBe('Silk Robe')
    expect(itemById('wolfhide_leather')!.name).toBe('Wolfhide Leather')
    expect(itemById('steel_tower_shield')!.stats).toEqual({ acBonus: 18, resistance: 1, apPenalty: 1, strength: 6 })
    expect(itemById('ironwood_crossbow')!.stats).toMatchObject({ attackApCost: 6, attackRange: 5, armorPierce: 2, rangedPierce: true })
    expect(itemById('steel_spear')!.stats).toMatchObject({ attackRange: 2, reach: true })
  })

  it('keeps the legacy items as they were, but for the renames and the weights the user chose (Q1 b)', () => {
    const today: Array<[typeof IRON_SWORD, string, string, ItemStats]> = [
      [IRON_SWORD, 'iron_sword', 'Iron Longsword', { damage: { count: 1, sides: 8, bonus: 3 }, attackApCost: 5, armorPierce: 1 }],
      [IRON_DAGGER, 'iron_dagger', 'Iron Dagger', { damage: { count: 1, sides: 4, bonus: 0 }, attackApCost: 3 }],
      [IRON_SHORTSWORD, 'iron_shortsword', 'Iron Shortsword', { damage: { count: 1, sides: 3, bonus: 1 }, attackApCost: 4 }],
      // Q1 (b): strength 5.
      [IRON_BATTLE_AXE, 'iron_battle_axe', 'Iron Battle Axe', { damage: { count: 1, sides: 12, bonus: 2 }, attackApCost: 6, armorPierce: 2, strength: 5 }],
      // Renamed from steel_greatsword; Q1 (b): strength 6.
      [IRON_GREATSWORD, 'iron_greatsword', 'Iron Greatsword', { damage: { count: 2, sides: 6, bonus: 3 }, attackApCost: 7, armorPierce: 2, twoHanded: true, strength: 6 }],
      [YEW_BOW, 'yew_bow', 'Yew Bow', { damage: { count: 1, sides: 6, bonus: 0 }, attackApCost: 4, attackRange: 5, twoHanded: true }],
      [OAK_SHIELD, 'oak_shield', 'Oak Shield', { acBonus: 10 }],
      // Renamed from steel_armor; Q1 (b): strength 4 and spell skill −5.
      [IRON_BREASTPLATE, 'iron_breastplate', 'Iron Breastplate', { acBonus: 10, resistance: 2, strength: 4, spellSkill: -5 }],
      [SPARK_WAND, 'spark_wand', 'Wand of Sparks', { damage: { count: 1, sides: 6, bonus: 0 }, attackApCost: 5, attackRange: 4, skill: 'magic' }],
    ]
    for (const [item, id, name, stats] of today) {
      expect([item.id, item.name]).toEqual([id, name])
      expect(item.stats).toEqual(stats)
      expect(itemById(id)).toBe(item)
    }
    expect(IRON_SWORD.description).toBe('A well-balanced blade.')
    expect(IRON_BREASTPLATE.description).toBe('Sturdy plate armor.')
    expect(SPARK_WAND.description).toBe('Spits stinging sparks.')
  })

  it('round-trips every grade and fitting modifier of every item, one object an id', () => {
    for (const base of BASE_ITEMS) {
      for (const grade of GRADES) {
        const graded = craftedItem(base, grade)
        expect(itemById(graded.id)!.id).toBe(graded.id)
        expect([graded.family, graded.material, graded.tier]).toEqual([base.family, base.material, base.tier])
        for (const mod of modifiersFor(base.family!)) {
          for (const modGrade of GRADES) {
            const made = craftedItem(base, grade, { id: mod.id, grade: modGrade })
            expect(itemById(made.id)).toBe(made)
            expect(made.id).toBe(`${base.id}${grade > 1 ? `@${grade}` : ''}+${mod.id}${modGrade}`)
            expect([made.family, made.material, made.tier]).toEqual([base.family, base.material, base.tier])
          }
        }
      }
    }
  })

  it('resolves the legacy alias to the canonical item, which carries the canonical id', () => {
    expect(LEGACY_ALIASES).toEqual({ steel_armor: 'iron_breastplate' })
    expect(itemById('steel_armor')).toBe(IRON_BREASTPLATE)
    expect(itemById('steel_armor@2')).toBe(itemById('iron_breastplate@2'))
    expect(itemById('steel_armor@2+reinforced1')!.id).toBe('iron_breastplate@2+reinforced1')
    expect(itemById('steel_armor@2+reinforced1')).toBe(itemById('iron_breastplate@2+reinforced1'))
    // steel_greatsword is no alias: it is the tier-2 greatsword.
    expect(itemById('steel_greatsword')!.stats!.damage).toEqual({ count: 2, sides: 6, bonus: 5 })
    expect(itemById('steel_greatsword')!.tier).toBe(2)
  })

  it('refuses ids that are not items', () => {
    for (const id of [
      'iron_longsword',
      'yew_shield',
      'yew_wand',
      'yew_staff',
      'leather_leather',
      'iron_bow',
      'yew_longsword',
      'mithril_longsword',
      'iron_pike',
      'storm_wand@2',
      'storm_wand+keen1',
      'iron_sword+recurve1',
      'iron_sword@4',
      'steel_longsword+bearded1',
    ]) {
      expect(itemById(id), id).toBeUndefined()
    }
  })

  it('keeps WEAPONS the six a hero carries and the Wand of Sparks out of the enchanted items', () => {
    expect(WEAPONS.map((w) => w.id)).toEqual(['iron_dagger', 'iron_shortsword', 'iron_sword', 'iron_battle_axe', 'iron_greatsword', 'yew_bow'])
    expect(MAGIC_ITEMS).toHaveLength(8)
    expect(MAGIC_ITEMS.map((item) => item.id)).not.toContain('spark_wand')
    expect(BASE_ITEMS).toContain(SPARK_WAND)
  })

  it('tells the gear class by slot', () => {
    expect(['mainHand', 'offHand', 'armor', 'head', 'gloves', 'boots'].map((s) => gearClass(s as never))).toEqual([
      'weapon',
      'shield',
      'armour',
      'small',
      'small',
      'small',
    ])
  })
})

describe('modifiers on the new families', () => {
  it('fits each modifier to its families, every tier', () => {
    expect(modifiersFor('spear').map((m) => m.id)).toEqual(['balanced'])
    expect(modifiersFor('mace').map((m) => m.id)).toEqual(['bearded'])
    expect(modifiersFor('crossbow').map((m) => m.id)).toEqual(['long'])
    expect(modifiersFor('leather').map((m) => m.id)).toEqual(['reinforced'])
    expect(itemById('steel_spear+balanced2')).toBeDefined()
    expect(itemById('steel_crossbow@3+long1')).toBeUndefined() // the crossbow is wood: steel is no crossbow
    expect(itemById('ironwood_crossbow@3+long1')).toBeDefined()
  })

  it('asks timber of a wood family and iron of any other', () => {
    expect(craftCost(itemById('yew_crossbow')!, 1)).toEqual({ gold: 5, timber: 5 })
    expect(craftCost(itemById('ash_staff')!, 1)).toEqual({ gold: 5, timber: 5 })
    expect(craftCost(itemById('leather_armor')!, 1)).toEqual({ gold: 5, iron: 5 })
    expect(craftCost(itemById('iron_sword')!, 1)).toEqual({ gold: 5, iron: 5 })
  })
})

describe('weight', () => {
  it('counts the strength an item asks beyond its wearer', () => {
    expect(strengthShortfall(3, { strength: 6 })).toBe(3)
    expect(strengthShortfall(7, { strength: 6 })).toBe(0)
    expect(strengthShortfall(3, undefined)).toBe(0)
    expect(strengthShortfall(3, {})).toBe(0)
  })

  it('describes reach, ranged piercing, strength, AP and a signed spell skill', () => {
    expect(describeItemStats(itemById('iron_spear')!.stats)).toEqual(['Damage: 1d8+1', 'Attack Cost: 5 AP', 'Reach: 2 hexes', 'Pierces 1 resistance'])
    expect(describeItemStats(itemById('yew_crossbow')!.stats)).toEqual([
      'Damage: 1d10',
      'Attack Cost: 6 AP',
      'Range: 5 hexes',
      'Pierces 2 resistance, even at range',
      'Two-handed',
    ])
    expect(describeItemStats(itemById('iron_plate')!.stats)).toEqual([
      'Strength: 6',
      'Action Points: −1',
      'Armor Class: +6',
      'Resistance: +4',
      'Spell Skill: −15%',
    ])
    expect(describeItemStats(itemById('iron_plate')!.stats, 3)).toContain('Strength: 6 (you have 3): to hit −15%')
    expect(describeItemStats(itemById('iron_plate')!.stats, 6)).toContain('Strength: 6')
    expect(describeItemStats(itemById('iron_plate')!.stats, 8)).toContain('Strength: 6')
    expect(describeItemStats({ spellSkill: 5 })).toEqual(['Spell Skill: +5%'])
  })
})
