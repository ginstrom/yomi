import { describe, expect, it } from 'vitest'
import { craftCost } from '../game/crafting.ts'
import { createHash } from 'node:crypto'
import { FAMILIES, LEGACY_ALIASES, MATERIALS, SMALL_RESISTANCE, TIER_BONUS, gearClass } from './catalog.ts'
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
  EMBERBLADE,
  baseItem,
  craftedItem,
  describeItemStats,
  itemById,
  strengthShortfall,
  unmodified,
  unruned,
  withRunes,
  type ItemStats,
} from './inventory.ts'
import { modifiersFor } from './modifiers.ts'

describe('the catalog', () => {
  it('builds every family in each tier of its material kind, tier 1 first', () => {
    expect(MATERIALS.map((m) => m.id)).toEqual([
      'iron', 'steel', 'yew', 'ironwood', 'leather', 'wolfhide', 'linen', 'silk',
      'mithril', 'adamant', 'starmetal', 'elderwood', 'wyrmwood', 'heartwood', 'wyvern', 'basilisk', 'drake', 'mithrilweave', 'adamantweave', 'starweave',
    ])
    for (const kind of ['metal', 'wood', 'hide', 'cloth'] as const) {
      expect(MATERIALS.filter((m) => m.kind === kind).map((m) => m.tier), kind).toEqual([1, 2, 3, 4, 5])
    }
    expect(MATERIALS.every((m) => !m.id.includes('_'))).toBe(true)
    expect(FAMILIES).toHaveLength(28)
    expect(BASE_ITEMS).toHaveLength(140)
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
      expect(itemById(item.id), item.id).toBe(item)
      // At tiers 1 and 2, a tier's bonus is the only difference from the family's own stats.
      if (material.tier > 2) return
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

  it('keeps today\'s 56 tier-1 and tier-2 items byte for byte, in their order (hashed before long-campaign stage 10 step 02)', () => {
    const low = BASE_ITEMS.filter((item) => item.tier! <= 2)
    expect(low).toHaveLength(56)
    expect(createHash('sha256').update(JSON.stringify(low)).digest('hex')).toBe('bf524dffcf0fedee03d889f3264fe263c2b7300d7c419faa1411406425e2f6e1')
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
      // Renamed from steel_armor; Q1 (b): strength 3 (the user, 2026-11-07) and spell skill −5.
      [IRON_BREASTPLATE, 'iron_breastplate', 'Iron Breastplate', { acBonus: 10, resistance: 2, strength: 3, spellSkill: -5 }],
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
      'mithril_bow',
      'elderwood_longsword',
      'wyvern_breastplate',
      'drake_robe',
      'starweave_leather',
      'wyvern_hide_leather',
      'mithril_longsword@4',
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

describe('tiers 3 to 5 (long-campaign stage 10)', () => {
  const stats = (id: string) => itemById(id)!.stats!

  it('names each item after its material, a family\'s tier-1 name only at tier 1', () => {
    for (const [id, name, tier] of [
      ['mithril_longsword', 'Mithril Longsword', 3],
      ['drake_leather', 'Drake-scale Leather', 5],
      ['elderwood_shield', 'Elderwood Shield', 3],
      ['starweave_robe', 'Starweave Robe', 5],
      ['wyvern_cap', 'Wyvern-hide Cap', 3],
      ['basilisk_boots', 'Basilisk-scale Boots', 4],
      ['wyrmwood_wand', 'Wyrmwood Wand', 4],
      ['heartwood_staff', 'Heartwood Staff', 5],
      ['adamantweave_robe', 'Adamantweave Robe', 4],
    ] as const) {
      expect([itemById(id)!.name, itemById(id)!.tier], id).toEqual([name, tier])
    }
    expect(MATERIALS.filter((m) => m.tier >= 3).map((m) => m.stock)).toEqual([
      'mithril', 'adamant', 'starmetal', 'elderwood', 'wyrmwood', 'heartwood', 'wyvern_hide', 'basilisk_scale', 'drake_scale', 'mithril', 'adamant', 'starmetal',
    ])
    expect(MATERIALS.filter((m) => m.tier <= 2).every((m) => m.stock === undefined && !m.strengthRelief && !m.casterFriendly)).toBe(true)
  })

  it('adds damage and to hit to a weapon, and a point of piercing at tiers 4 and 5', () => {
    expect(TIER_BONUS.weapon[3]).toEqual({ damage: { count: 0, sides: 0, bonus: 4 }, toHit: 5 })
    // The longsword (1d8+3, pierce 1); adamant carries no relief.
    expect(stats('mithril_longsword')).toEqual({ damage: { count: 1, sides: 8, bonus: 7 }, attackApCost: 5, armorPierce: 1, toHit: 5 })
    expect(stats('adamant_longsword')).toEqual({ damage: { count: 1, sides: 8, bonus: 9 }, attackApCost: 5, armorPierce: 2, toHit: 5 })
    expect(stats('starmetal_longsword')).toEqual({ damage: { count: 1, sides: 8, bonus: 11 }, attackApCost: 5, armorPierce: 2, toHit: 10 })
    // A weapon that pierced nothing pierces 1 from tier 4; range, AP and two hands never move.
    expect(stats('adamant_dagger')).toEqual({ damage: { count: 1, sides: 4, bonus: 6 }, attackApCost: 3, toHit: 5, armorPierce: 1 })
    expect(stats('heartwood_bow')).toEqual({ damage: { count: 1, sides: 6, bonus: 8 }, attackApCost: 4, attackRange: 5, twoHanded: true, toHit: 10, armorPierce: 1 })
    // The war hammer's −5 to hit is made up at tier 3.
    expect(stats('adamant_war_hammer').toHit).toBe(0)
  })

  it('adds armour class to a shield, and a point of resistance from tier 4', () => {
    expect(stats('elderwood_shield')).toEqual({ acBonus: 14 })
    expect(stats('wyrmwood_shield')).toEqual({ acBonus: 16, resistance: 1 })
    expect(stats('heartwood_shield')).toEqual({ acBonus: 18, resistance: 1 })
    expect(stats('adamant_tower_shield')).toEqual({ acBonus: 22, resistance: 2, apPenalty: 1, strength: 6 })
  })

  it('adds armour class and resistance to body armour', () => {
    expect(stats('wyvern_leather')).toEqual({ acBonus: 16, resistance: 2 })
    expect(stats('basilisk_leather')).toEqual({ acBonus: 18, resistance: 3 })
    expect(stats('drake_leather')).toEqual({ acBonus: 20, resistance: 4 })
    expect(stats('mithrilweave_robe')).toEqual({ acBonus: 4, resistance: 1, maxMana: 6, spellSkill: 5 })
    expect(stats('adamant_breastplate')).toEqual({ acBonus: 16, resistance: 4, spellSkill: -5, strength: 3 })
  })

  it('adds armour class to a small-slot item, and resistance only where its family has some', () => {
    expect(SMALL_RESISTANCE).toEqual({ 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 })
    expect(stats('wyvern_cap')).toEqual({ acBonus: 4 })
    expect(stats('basilisk_cap')).toEqual({ acBonus: 5 })
    expect(stats('drake_cap')).toEqual({ acBonus: 6 })
    expect(stats('drake_gloves')).toEqual({ toHit: 2, acBonus: 3 })
    expect(stats('mithril_helm')).toEqual({ acBonus: 3, resistance: 2, spellSkill: -2, strength: 3 })
    expect(stats('adamant_helm')).toEqual({ acBonus: 4, resistance: 2, spellSkill: -5, strength: 4 })
    expect(stats('starmetal_helm')).toEqual({ acBonus: 5, resistance: 3, spellSkill: -2, strength: 2 })
    expect(stats('adamant_gauntlets')).toEqual({ resistance: 2, spellSkill: -5, strength: 4, acBonus: 2 })
    expect(stats('starmetal_greaves')).toEqual({ resistance: 3, strength: 2, acBonus: 3 })
  })

  it('lets mithril and starmetal ask 1 and 2 less strength, never below 0, and halve a spell-skill penalty toward 0', () => {
    expect(['iron_plate', 'mithril_plate', 'adamant_plate', 'starmetal_plate'].map((id) => stats(id).strength)).toEqual([6, 5, 6, 4])
    expect(['iron_breastplate', 'mithril_breastplate', 'starmetal_breastplate'].map((id) => stats(id).strength)).toEqual([3, 2, 1])
    expect(['iron_plate', 'mithril_plate', 'adamant_plate', 'starmetal_plate'].map((id) => stats(id).spellSkill)).toEqual([-15, -7, -15, -7])
    expect(['mithril_breastplate', 'adamant_breastplate', 'starmetal_breastplate'].map((id) => stats(id).spellSkill)).toEqual([-2, -5, -2])
    expect(stats('mithril_helm').spellSkill).toBe(-2)
    // A family that asks no strength asks none; a material without relief touches nothing.
    expect(stats('starmetal_dagger').strength).toBeUndefined()
    expect(stats('heartwood_longbow').strength).toBe(5)
    // A positive spell skill is never halved.
    expect(stats('starweave_robe').spellSkill).toBe(5)
  })

  it('round-trips grades, modifiers and runes, and refuses runes beyond the sockets', () => {
    for (const id of ['mithril_longsword@3#ember1.storm1', 'adamant_breastplate@2+reinforced2', 'starmetal_longsword@3+keen2#ember3.storm2.ember1', 'drake_leather@3']) {
      expect(itemById(id)?.id, id).toBe(id)
      expect(itemById(id), id).toBe(itemById(id))
    }
    expect(itemById('mithril_longsword#ember1.storm1')).toBeUndefined()
    expect(itemById('mithril_longsword@3#ember1.storm1.ember1')).toBeUndefined()
    expect(itemById('adamant_longsword#ember1.storm1')!.tier).toBe(4)
    expect(itemById('drake_cap@3#ember1.ember1')).toBeUndefined()
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

describe('runed ids', () => {
  const item = (id: string) => itemById(id)!

  it('round-trip, one object an id', () => {
    for (const id of ['iron_sword@3#ember1', 'steel_longsword@3+light1#ember2.storm1', 'emberblade#dawn1', 'iron_breastplate@3#life1']) {
      expect(itemById(id), id).toBeDefined()
      expect(item(id).id).toBe(id)
      expect(itemById(id)).toBe(itemById(id))
    }
  })

  it('resolve an alias with runes to the canonical item', () => {
    expect(itemById('steel_armor@3#stone1')).toBe(itemById('iron_breastplate@3#stone1'))
    expect(item('steel_armor@3#stone1').id).toBe('iron_breastplate@3#stone1')
  })

  it('name the runes after the item', () => {
    expect(item('iron_sword@3#ember1').name).toBe('Masterwork Iron Longsword [Ember I]')
    expect(item('steel_longsword@3#ember2.storm1').name).toBe('Masterwork Steel Longsword [Ember II, Storm I]')
    expect(item('emberblade#dawn1').name).toBe('Emberblade [Dawn I]')
  })

  it('fold each rune into the stats by the slot it sits in', () => {
    const sword = item('iron_sword@3')
    expect(item('iron_sword@3#stone1').stats!.damage!.bonus).toBe(sword.stats!.damage!.bonus + 1)
    expect(item('iron_sword@3#stone1').stats).toEqual({ ...sword.stats, damage: { ...sword.stats!.damage!, bonus: sword.stats!.damage!.bonus + 1 } })
    expect(item('iron_breastplate@3#rime2').stats!.wards).toEqual({ frost: 4 })
    expect(item('iron_breastplate@3#stone1').stats!.resistance).toBe(item('iron_breastplate@3').stats!.resistance! + 1)
    expect(item('iron_breastplate@3#life2').stats!.maxHp).toBe(8)
    expect(item('iron_sword@3#ember3').stats!.onHit).toEqual([{ damage: 3, element: 'fire', status: { id: 'seared', turns: 1 } }])
    expect(item('steel_longsword@3#ember1.ember2').stats!.onHit).toEqual([
      { damage: 1, element: 'fire' },
      { damage: 2, element: 'fire' },
    ])
    expect(item('steel_breastplate@3#rime1.rime2').stats!.wards).toEqual({ frost: 6 })
    expect(item('steel_longsword@3#storm1').stats!.toHit).toBe(item('steel_longsword@3').stats!.toHit! + 3)
    expect(item('emberblade#acid1').stats!.armorPierce).toBe(EMBERBLADE.stats!.armorPierce! + 1)
  })

  it('make another id, and an equal item, of the same runes in another order', () => {
    const a = item('steel_longsword@3#ember1.storm1')
    const b = item('steel_longsword@3#storm1.ember1')
    expect(a).not.toBe(b)
    expect(b.id).toBe('steel_longsword@3#storm1.ember1')
    expect(b.stats).toEqual(a.stats)
  })

  it('keep the family, material, tier, grade and modifier, and a base for a plain item', () => {
    const runed = item('steel_longsword@3+light1#ember2')
    const unrunedItem = item('steel_longsword@3+light1')
    expect([runed.family, runed.material, runed.tier, runed.grade, runed.mod]).toEqual([
      unrunedItem.family,
      unrunedItem.material,
      unrunedItem.tier,
      unrunedItem.grade,
      unrunedItem.mod,
    ])
    expect(runed.runes).toEqual(['ember2'])
    expect(runed.base).toBe('steel_longsword')
    expect(item('steel_longsword#ember1').base).toBe('steel_longsword')
    expect(baseItem(item('iron_sword@3#ember1'))).toBe(IRON_SWORD)
    expect(baseItem(item('steel_longsword#ember1'))).toBe(itemById('steel_longsword'))
    expect(item('emberblade#ember1').base).toBeUndefined()
    expect(baseItem(item('emberblade#ember1'))).toBeNull()
    expect(item('emberblade#ember1').sockets).toBe(1)
  })

  it('come off and go on again as the same objects itemById gives', () => {
    const runed = item('steel_longsword@3+light1#ember2.storm1')
    expect(unruned(runed)).toBe(itemById('steel_longsword@3+light1'))
    expect(unruned(IRON_SWORD)).toBe(IRON_SWORD)
    expect(withRunes(runed, [])).toBe(itemById('steel_longsword@3+light1'))
    expect(withRunes(runed, ['stone1'])).toBe(itemById('steel_longsword@3+light1#stone1'))
    expect(withRunes(item('iron_sword@3'), ['ember1'])).toBe(itemById('iron_sword@3#ember1'))
    expect(withRunes(item('iron_sword@3'), ['ember1', 'storm1'])).toBeUndefined()
    expect(withRunes(EMBERBLADE, ['dawn1'])).toBe(itemById('emberblade#dawn1'))
    expect(craftedItem(itemById('steel_longsword')!, 3, { id: 'light', grade: 1 }, ['ember2', 'storm1'])).toBe(runed)
    expect(craftedItem(itemById('steel_longsword')!, 3, undefined, [])).toBe(itemById('steel_longsword@3'))
    expect(unmodified(runed)).toBe(itemById('steel_longsword@3#ember2.storm1'))
  })

  it('refuse a rune part that is empty, malformed, unfitting or more than the sockets', () => {
    for (const id of [
      'iron_sword#ember1',
      'iron_sword@3#ember1.storm1',
      'iron_sword@3#mind1',
      'iron_sword@3#',
      'iron_sword@3#ember5',
      'iron_sword@3#fire1',
      'iron_sword@3#ember1.',
      'iron_sword@3#ember1#storm1',
      'ring_protection#ember1',
      'emberblade@2#ember1',
      'emberblade#ember1.storm1',
      'mithril_sword@3#ember1',
    ]) {
      expect(itemById(id), id).toBeUndefined()
    }
    expect(itemById('spark_wand@3#mind1')!.stats!.spellSkill).toBe(3)
  })
})

describe('the words of runed stats', () => {
  it('tell wards in element order, maximum hit points and each on-hit effect', () => {
    expect(describeItemStats({ wards: { poison: 2, fire: 4, frost: 0 } })).toEqual(['Fire ward 4', 'Poison ward 2'])
    expect(describeItemStats({ maxHp: 8 })).toEqual(['Max HP: +8'])
    expect(
      describeItemStats({
        onHit: [
          { damage: 3, element: 'fire', status: { id: 'seared', turns: 1 } },
          { damage: 3, element: 'frost', status: { id: 'chilled', turns: 1 }, onCrit: true },
          { damage: 2, element: 'blight', bane: true },
          { damage: 0, heal: 1 },
          { damage: 1 },
        ],
      }),
    ).toEqual([
      'On a hit: +3 fire, lays Seared',
      'On a hit: +3 frost, lays Chilled on a critical',
      'On a hit: +2 blight to the regenerating and the blighted',
      'On a hit: heals 1',
      'On a hit: +1 damage',
    ])
  })
})
