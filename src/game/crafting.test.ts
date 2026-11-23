import { describe, expect, it } from 'vitest'
import { maxHp } from '../character/character.ts'
import type { FamilyId } from '../inventory/catalog.ts'
import { IRON_SWORD, STORM_WAND, itemById, type EquipmentSlot } from '../inventory/inventory.ts'
import { socketsOf } from '../inventory/runes.ts'
import { spend } from './buildings.ts'
import {
  FORGE_LEVEL,
  MAX_WORKSHOP_LEVEL,
  TEMPER_LEVEL,
  WORKSHOP_COSTS,
  craft,
  craftCost,
  craftTier,
  craftables,
  forge,
  forgeCost,
  forgeOptions,
  forgeRefusal,
  forgedValue,
  highestGrade,
  options,
  temper,
  temperCost,
  temperRefusal,
  upgradeWorkshop,
} from './crafting.ts'
import { presences } from './expedition.ts'
import { newGame, type GameState } from './gameState.ts'
import { replaceAt, type ItemPlace } from './itemPlace.ts'
import { locationAt, monstersHere, passTurn, travel } from './worldMap.ts'

/** A new game at home, the stock full of everything crafting asks. */
function home() {
  const game = newGame(undefined, null, 1, 'Hearthold')
  game.world.stock = { gold: 500, iron: 100, timber: 100, stone: 100, copper: 100, crystal: 100 }
  return game
}
/** The soldier's longsword, as worn. */
const sword = (game: ReturnType<typeof newGame>): ItemPlace => ({ from: 'worn', party: 'party_1', member: 0, slot: 'mainHand', itemId: game.parties[0].members[0].equipment.mainHand!.id })
/** One step off the encampment: the field. */
const intoField = (game: ReturnType<typeof newGame>) => (game.parties[0].position = { q: game.parties[0].position.q + 1, r: game.parties[0].position.r })

describe('crafting', () => {
  it('crafts a Balanced longsword in the field: a day passes and the stock falls', () => {
    const game = home()
    intoField(game)
    expect(locationAt(game.world, game.parties[0].position)).toBeNull()
    expect(craftTier(game.world, game.parties[0])).toBe('field')
    expect(game.parties[0].members[0].equipment.mainHand).toBe(IRON_SWORD)
    const offered = options(game, sword(game))
    expect(offered.map((o) => `${o.modifier.id}${o.grade}`)).toEqual(['balanced1'])
    const turn = game.world.turn
    const result = craft(game, sword(game), 'balanced', 1)
    expect(result.refusal).toBeNull()
    expect(game.parties[0].members[0].equipment.mainHand).toBe(itemById('iron_sword+balanced1'))
    expect(game.world.turn).toBe(turn + 1)
    expect(game.world.stock).toMatchObject({ gold: 495, iron: 95 })
  })

  it('refuses a workshop modifier or a higher grade in the field', () => {
    const game = home()
    intoField(game)
    expect(craft(game, sword(game), 'keen', 1).refusal).toMatch(/level 1 workshop/)
    expect(craft(game, sword(game), 'balanced', 2).refusal).toMatch(/grade 1 only/)
    expect(craft(game, sword(game), 'recurve', 1).refusal).toMatch(/does not fit/)
    expect(game.parties[0].members[0].equipment.mainHand).toBe(IRON_SWORD)
    expect(game.world.stock.gold).toBe(500)
  })

  it('pays timber for a bow at grade 1', () => {
    const game = home()
    intoField(game)
    const bow = { from: 'worn' as const, party: 'party_1', member: 1, slot: 'mainHand' as const, itemId: 'yew_bow' }
    expect(options(game, bow)[0].cost).toEqual({ gold: 5, timber: 5 })
  })

  it('at a level 2 workshop replaces a modifier with a higher grade, then with another, in no time', () => {
    const game = home()
    game.parties[0].members[0].equipment.mainHand = itemById('iron_sword+balanced1')
    expect(upgradeWorkshop(game, game.parties[0])).toBeNull()
    expect(upgradeWorkshop(game, game.parties[0])).toBeNull()
    expect(craftTier(game.world, game.parties[0])).toBe(2)
    const turn = game.world.turn
    const ids = options(game, sword(game)).map((o) => `${o.modifier.id}${o.grade}`)
    expect(ids).toEqual(['balanced1', 'balanced2', 'keen1', 'keen2', 'light1', 'light2'])
    expect(craft(game, sword(game), 'balanced', 2).refusal).toBeNull()
    expect(game.parties[0].members[0].equipment.mainHand!.id).toBe('iron_sword+balanced2')
    expect(game.world.stock).toMatchObject({ copper: 95 })
    expect(craft(game, sword(game), 'light', 1).refusal).toBeNull()
    expect(game.parties[0].members[0].equipment.mainHand!.id).toBe('iron_sword+light1')
    expect(game.parties[0].members[0].equipment.mainHand!.stats!.attackApCost).toBe(4)
    expect(game.world.turn).toBe(turn)
  })

  it('keeps a grade under a modifier', () => {
    const game = home()
    game.parties[0].baggage.push(itemById('iron_breastplate@2')!)
    game.world.workshop = 2
    const place: ItemPlace = { from: 'baggage', party: 'party_1', index: 0, itemId: 'iron_breastplate@2' }
    expect(craft(game, place, 'reinforced', 1).refusal).toBeNull()
    expect(game.parties[0].baggage[0].id).toBe('iron_breastplate@2+reinforced1')
  })

  it('keeps the runes of a runed item, worn or in the baggage', () => {
    const game = home()
    game.world.workshop = 2
    game.parties[0].members[0].equipment.mainHand = itemById('iron_sword@3#ember1')
    expect(craftables(game, game.parties[0]).some(({ item }) => item.id === 'iron_sword@3#ember1')).toBe(true)
    expect(craft(game, sword(game), 'balanced', 2).refusal).toBeNull()
    expect(game.parties[0].members[0].equipment.mainHand).toBe(itemById('iron_sword@3+balanced2#ember1'))
    game.parties[0].baggage.push(itemById('steel_breastplate@3+reinforced1#stone1.life1')!)
    const place: ItemPlace = { from: 'baggage', party: 'party_1', index: 0, itemId: 'steel_breastplate@3+reinforced1#stone1.life1' }
    expect(craft(game, place, 'reinforced', 2).refusal).toBeNull()
    expect(game.parties[0].baggage[0]).toBe(itemById('steel_breastplate@3+reinforced2#stone1.life1'))
    expect(game.parties[0].baggage[0].runes).toEqual(['stone1', 'life1'])
  })

  it('never works an enchanted item, and lists it nowhere', () => {
    const game = home()
    game.parties[0].baggage.push(STORM_WAND)
    game.world.workshop = 3
    expect(craft(game, { from: 'baggage', party: 'party_1', index: 0, itemId: 'storm_wand' }, 'balanced', 1).refusal).toMatch(/enchanted/)
    expect(craftables(game, game.parties[0]).some(({ item }) => item === STORM_WAND)).toBe(false)
  })

  it('greys an item whose modifiers all need a workshop', () => {
    const game = home()
    intoField(game)
    const axe = craftables(game, game.parties[0]).find(({ item }) => item.id === 'iron_battle_axe')!
    expect(axe.refusal).toMatch(/level 1 workshop/)
    expect(craftables(game, game.parties[0]).find(({ item }) => item.id === 'iron_sword')!.refusal).toBeNull()
  })

  it('refuses without the stock, or a stale selection, changing nothing', () => {
    const game = home()
    intoField(game)
    game.world.stock = { gold: 4, iron: 100 }
    expect(craft(game, sword(game), 'balanced', 1).refusal).toMatch(/more than the stock/)
    expect(craft(game, { ...sword(game), itemId: 'iron_dagger' }, 'balanced', 1).refusal).toMatch(/no longer there/)
    expect(game.world.stock.gold).toBe(4)
  })

  it('is refused in the field among monsters', () => {
    const game = home()
    const raiders = game.world.locations.find((l) => l.id === 'goblin_raiders')!
    while (!monstersHere(game.world, game.parties[0])) travel(game, game.parties[0], raiders.position)
    expect(craft(game, sword(game), 'balanced', 1).refusal).toMatch(/Nothing can be crafted/)
    expect(options(game, sword(game))[0].refusal).toMatch(/Nothing can be crafted/)
  })
})

describe('craft, as it is (characterization)', () => {
  /** Two games in the field, built alike, each moved on to the first day that brings an event. */
  function eventfulTwins(): [GameState, GameState] {
    const field = () => {
      const game = home()
      intoField(game)
      return game
    }
    const scout = field()
    let quiet = 0
    while (passTurn(scout.world, presences(scout.parties)).length === 0) quiet++
    const make = () => {
      const game = field()
      for (let day = 0; day < quiet; day++) passTurn(game.world, presences(game.parties))
      return game
    }
    return [make(), make()]
  }

  it('in the field spends, replaces the item and then passes the day: the same result, events and game as by hand', () => {
    const [now, then] = eventfulTwins()
    const turn = now.world.turn
    const option = options(then, sword(then)).find((o) => o.modifier.id === 'balanced' && o.grade === 1)!
    spend(then.world.stock, option.cost)
    replaceAt(then, sword(then), option.result)
    const events = passTurn(then.world, presences(then.parties))
    expect(events.length).toBeGreaterThan(0)
    expect(craft(now, sword(now), 'balanced', 1)).toEqual({ refusal: null, item: itemById('iron_sword+balanced1'), events })
    expect(now.world.turn).toBe(turn + 1)
    expect(now.parties[0].confronting).toBeNull()
    expect(JSON.stringify(now)).toBe(JSON.stringify(then))
  })

  it('at a workshop passes no day and returns no events', () => {
    const game = home()
    game.world.workshop = 1
    const turn = game.world.turn
    expect(craft(game, sword(game), 'keen', 1)).toEqual({ refusal: null, item: itemById('iron_sword+keen1'), events: [] })
    expect(game.world.turn).toBe(turn)
  })

  it.each(['lost', 'won'] as const)('is refused, changing nothing, once the game is %s, in the field or at the workshop', (status) => {
    for (const workshop of [0, 1]) {
      const game = home()
      game.world.workshop = workshop
      if (workshop === 0) intoField(game)
      game.world.status = status
      const before = JSON.stringify(game)
      expect(craft(game, sword(game), 'balanced', 1)).toEqual({ refusal: 'Nothing can be crafted here now.' })
      expect(JSON.stringify(game)).toBe(before)
    }
  })

  it('is refused, changing nothing, without the stock or for a stale place', () => {
    const poor = home()
    intoField(poor)
    poor.world.stock = { gold: 4, iron: 100 }
    const stale = home()
    intoField(stale)
    for (const [game, place, pattern] of [
      [poor, sword(poor), /more than the stock/],
      [stale, { ...sword(stale), itemId: 'iron_dagger' }, /no longer there/],
    ] as const) {
      const before = JSON.stringify(game)
      expect(craft(game, place, 'balanced', 1).refusal).toMatch(pattern)
      expect(JSON.stringify(game)).toBe(before)
    }
  })
})

/** A game at home with the workshop at `level` and the far ores, woods and trophies in the stock. */
function forgeHome(level: number): GameState {
  const game = home()
  game.world.workshop = level
  Object.assign(game.world.stock, { mithril: 100, adamant: 100, starmetal: 100, elderwood: 100, wyrmwood: 100, heartwood: 100, wyvern_hide: 100, basilisk_scale: 100, drake_scale: 100 })
  return game
}
/** Everything forging or tempering might change, to show a refusal changed none of it. */
const forgeSnapshot = (game: GameState) =>
  JSON.stringify({ stock: game.world.stock, baggage: game.parties[0].baggage, equipment: game.parties[0].members.map((m) => m.equipment), hp: game.parties[0].members.map((m) => m.hp), turn: game.world.turn })

describe('the workshop, levels 4 to 6', () => {
  it('costs 100 gold and 20 mithril, 150 gold and 20 adamant, 200 gold and 10 starmetal; six levels, none beyond', () => {
    expect(MAX_WORKSHOP_LEVEL).toBe(6)
    expect(WORKSHOP_COSTS.slice(3)).toEqual([{ gold: 100, mithril: 20 }, { gold: 150, adamant: 20 }, { gold: 200, starmetal: 10 }])
    const game = home()
    game.world.stock = { gold: 1000, iron: 100, stone: 100, crystal: 100, mithril: 20, adamant: 20, starmetal: 10 }
    while (upgradeWorkshop(game, game.parties[0]) === null);
    expect(game.world.workshop).toBe(6)
    expect(game.world.stock).toEqual({ gold: 1000 - 25 - 40 - 60 - 100 - 150 - 200, iron: 85, stone: 85, crystal: 90, mithril: 0, adamant: 0, starmetal: 0 })
    expect(upgradeWorkshop(game, game.parties[0])).toBe('The workshop is as great as it gets.')
  })

  it('makes modifiers at grade 3 at most at levels 4 to 6', () => {
    for (const level of [4, 5, 6]) {
      expect(highestGrade(level)).toBe(3)
      const game = forgeHome(level)
      expect(Math.max(...options(game, sword(game)).map((o) => o.grade))).toBe(3)
    }
    expect([highestGrade('field'), highestGrade(1), highestGrade(2), highestGrade(3)]).toEqual([1, 1, 2, 3])
  })
})

describe('forging', () => {
  it('at level 4 with 30 gold and 20 mithril forges a Mithril Longsword into the baggage for exactly 30 gold and 8 mithril; one socket, two at Masterwork', () => {
    const game = home()
    game.world.workshop = 4
    game.world.stock = { gold: 30, mithril: 20 }
    const turn = game.world.turn
    expect(forge(game, game.parties[0], 'longsword', 'mithril')).toBeNull()
    expect(game.world.stock).toEqual({ gold: 0, mithril: 12 })
    expect(game.world.turn).toBe(turn)
    const sword = game.parties[0].baggage.at(-1)!
    expect(sword).toBe(itemById('mithril_longsword'))
    expect(sword.name).toBe('Mithril Longsword')
    expect(socketsOf(sword)).toBe(1)
    game.world.stock = { gold: 90, mithril: 12 }
    const place: ItemPlace = { from: 'baggage', party: 'party_1', index: game.parties[0].baggage.length - 1, itemId: sword.id }
    expect(temper(game, place, 3)).toBeNull()
    expect(game.world.stock).toEqual({ gold: 0, mithril: 0 })
    expect(game.parties[0].baggage.at(-1)).toBe(itemById('mithril_longsword@3'))
    expect(socketsOf(game.parties[0].baggage.at(-1)!)).toBe(2)
  })

  it('costs each tier its gold and material, doubled for a two-handed family and for plate, in the stock material of the catalog material', () => {
    expect(FORGE_LEVEL).toEqual({ 3: 4, 4: 5, 5: 6 })
    expect(forgeCost('longsword', 'mithril')).toEqual({ gold: 30, mithril: 8 })
    expect(forgeCost('longsword', 'adamant')).toEqual({ gold: 50, adamant: 10 })
    expect(forgeCost('longsword', 'starmetal')).toEqual({ gold: 80, starmetal: 12 })
    expect(forgeCost('greatsword', 'mithril')).toEqual({ gold: 30, mithril: 16 })
    expect(forgeCost('bow', 'wyrmwood')).toEqual({ gold: 50, wyrmwood: 20 })
    expect(forgeCost('plate', 'starmetal')).toEqual({ gold: 80, starmetal: 24 })
    expect(forgeCost('breastplate', 'adamant')).toEqual({ gold: 50, adamant: 10 })
    expect(forgeCost('leather', 'wyvern')).toEqual({ gold: 30, wyvern_hide: 8 })
    expect(forgeCost('boots', 'drake')).toEqual({ gold: 80, drake_scale: 12 })
    expect(forgeCost('robe', 'mithrilweave')).toEqual({ gold: 30, mithril: 8 })
    expect(forgeCost('robe', 'starweave')).toEqual({ gold: 80, starmetal: 12 })
  })

  it('offers nothing below level 4, tier 3 at 4, tiers 3 and 4 at 5, every tier at 6, in FAMILIES then MATERIALS order', () => {
    const rows = (level: number, slot?: EquipmentSlot) => forgeOptions(forgeHome(level), forgeHome(level).parties[0], slot).map((o) => `${o.material}_${o.family}`)
    expect(rows(3)).toEqual([])
    expect(rows(4, 'offHand')).toEqual(['mithril_buckler', 'elderwood_shield', 'mithril_tower_shield'])
    expect(rows(5, 'offHand')).toEqual(['mithril_buckler', 'adamant_buckler', 'elderwood_shield', 'wyrmwood_shield', 'mithril_tower_shield', 'adamant_tower_shield'])
    expect(rows(6, 'armor')).toEqual([
      'mithrilweave_robe', 'adamantweave_robe', 'starweave_robe',
      'wyvern_leather', 'basilisk_leather', 'drake_leather',
      'mithril_breastplate', 'adamant_breastplate', 'starmetal_breastplate',
      'mithril_plate', 'adamant_plate', 'starmetal_plate',
    ])
    expect(rows(6)).toHaveLength(28 * 3)
    expect(rows(4)).toHaveLength(28)
  })

  it('gives each option its tier, item, cost and refusal', () => {
    const game = forgeHome(6)
    game.world.stock.starmetal = 11
    const options = forgeOptions(game, game.parties[0], 'mainHand')
    const sword = options.find((o) => o.family === 'longsword' && o.material === 'starmetal')!
    expect(sword).toMatchObject({ tier: 5, item: itemById('starmetal_longsword'), cost: { gold: 80, starmetal: 12 } })
    expect(sword.refusal).toBe('It costs 80 gold, 12 starmetal, more than the stock holds.')
    expect(options.find((o) => o.family === 'longsword' && o.material === 'mithril')!.refusal).toBeNull()
    intoField(game)
    expect(forgeOptions(game, game.parties[0], 'mainHand')[0].refusal).toBe('The workshop is at Hearthold.')
  })

  it('refuses in order, changing nothing: away, unknown, wrong kind, a low tier, the workshop too low, the stock short', () => {
    const away = forgeHome(6)
    intoField(away)
    const cases: Array<[GameState, FamilyId, string, string]> = [
      [away, 'longsword', 'mithril', 'The workshop is at Hearthold.'],
      [away, 'longsword', 'oak', 'The workshop is at Hearthold.'],
      [forgeHome(6), 'pike' as FamilyId, 'mithril', 'The workshop forges no such thing.'],
      [forgeHome(6), 'longsword', 'oak', 'The workshop forges no such thing.'],
      [forgeHome(6), 'longsword', 'elderwood', 'A Longsword is not made of Elderwood.'],
      [forgeHome(6), 'longsword', 'steel', 'The trading post sells tiers 1 and 2.'],
      [forgeHome(6), 'bow', 'yew', 'The trading post sells tiers 1 and 2.'],
      [forgeHome(4), 'longsword', 'adamant', 'Forging Adamant needs a level 5 workshop.'],
      [forgeHome(0), 'longsword', 'mithril', 'Forging Mithril needs a level 4 workshop.'],
    ]
    const poorGold = forgeHome(4)
    poorGold.world.stock.gold = 29
    poorGold.world.stock.mithril = 0
    cases.push([poorGold, 'longsword', 'mithril', 'It costs 30 gold, 8 mithril, more than the stock holds.'])
    const poorOre = forgeHome(4)
    poorOre.world.stock.mithril = 7
    cases.push([poorOre, 'longsword', 'mithril', 'It costs 30 gold, 8 mithril, more than the stock holds.'])
    for (const [game, family, material, refusal] of cases) {
      const before = forgeSnapshot(game)
      expect(forgeRefusal(game, game.parties[0], family, material)).toBe(refusal)
      expect(forge(game, game.parties[0], family, material)).toBe(refusal)
      expect(forgeSnapshot(game)).toBe(before)
    }
  })

  it('forges hide from its trophy and cloth from its ore', () => {
    const game = forgeHome(6)
    expect(forge(game, game.parties[0], 'leather', 'drake')).toBeNull()
    expect(forge(game, game.parties[0], 'robe', 'mithrilweave')).toBeNull()
    expect(game.parties[0].baggage.slice(-2).map((i) => i.name)).toEqual(['Drake-scale Leather', 'Mithrilweave Robe'])
    expect(game.world.stock).toMatchObject({ drake_scale: 88, mithril: 92, gold: 500 - 80 - 30 })
  })
})

describe('tempering', () => {
  /** Puts `id` in the baggage and returns its place. */
  const stow = (game: GameState, id: string): ItemPlace => {
    game.parties[0].baggage.push(itemById(id)!)
    return { from: 'baggage', party: 'party_1', index: game.parties[0].baggage.length - 1, itemId: id }
  }

  it('costs the tier × 10 × grade in gold and 4 × grade of the tier material', () => {
    expect(TEMPER_LEVEL).toBe(3)
    expect(temperCost(itemById('mithril_longsword')!, 2)).toEqual({ gold: 60, mithril: 8 })
    expect(temperCost(itemById('mithril_longsword')!, 3)).toEqual({ gold: 90, mithril: 12 })
    expect(temperCost(itemById('adamant_plate')!, 3)).toEqual({ gold: 120, adamant: 12 })
    expect(temperCost(itemById('drake_boots')!, 2)).toEqual({ gold: 100, drake_scale: 8 })
    expect(temperCost(itemById('starweave_robe')!, 2)).toEqual({ gold: 100, starmetal: 8 })
  })

  it('refuses in order, changing nothing: stale, away, the workshop below 3, enchanted, a low tier, the grade not above, the stock short', () => {
    const cases: Array<[GameState, ItemPlace, 1 | 2 | 3, string]> = []
    const stale = forgeHome(4)
    cases.push([stale, { from: 'baggage', party: 'party_1', index: 0, itemId: 'mithril_longsword' }, 2, 'That item is no longer there.'])
    const away = forgeHome(4)
    const awayPlace = stow(away, 'mithril_longsword')
    intoField(away)
    cases.push([away, awayPlace, 2, 'The workshop is at Hearthold.'])
    const low = forgeHome(2)
    cases.push([low, stow(low, 'mithril_longsword'), 2, 'Tempering needs a level 3 workshop.'])
    const enchanted = forgeHome(3)
    cases.push([enchanted, stow(enchanted, 'storm_wand'), 2, 'An enchanted item cannot be worked.'])
    const steel = forgeHome(3)
    cases.push([steel, stow(steel, 'steel_longsword'), 2, 'The trading post sells the grades of tiers 1 and 2.'])
    const fine = forgeHome(3)
    cases.push([fine, stow(fine, 'mithril_longsword@2'), 2, 'Mithril Longsword is Fine already.'])
    const masterwork = forgeHome(3)
    cases.push([masterwork, stow(masterwork, 'mithril_longsword@3'), 2, 'Mithril Longsword is Masterwork already.'])
    const poor = forgeHome(3)
    poor.world.stock.mithril = 11
    cases.push([poor, stow(poor, 'mithril_longsword'), 3, 'It costs 90 gold, 12 mithril, more than the stock holds.'])
    for (const [game, place, grade, refusal] of cases) {
      const before = forgeSnapshot(game)
      expect(temperRefusal(game, place, grade)).toBe(refusal)
      expect(temper(game, place, grade)).toBe(refusal)
      expect(forgeSnapshot(game)).toBe(before)
    }
  })

  it('goes straight to Masterwork at a level 3 workshop, keeping a modifier and runes, in the baggage', () => {
    const game = forgeHome(3)
    const place = stow(game, 'mithril_longsword+balanced2#ember2')
    const turn = game.world.turn
    expect(temper(game, place, 3)).toBeNull()
    expect(game.parties[0].baggage.at(-1)).toBe(itemById('mithril_longsword@3+balanced2#ember2'))
    expect(game.world.stock).toMatchObject({ gold: 500 - 90, mithril: 100 - 12 })
    expect(game.world.turn).toBe(turn)
  })

  it('tempers a worn item in place, keeping its runes and its wearer within the maximum', () => {
    const game = forgeHome(4)
    const hero = game.parties[0].members[0]
    hero.equipment.armor = itemById('mithril_breastplate#life2')
    const place: ItemPlace = { from: 'worn', party: 'party_1', member: 0, slot: 'armor', itemId: 'mithril_breastplate#life2' }
    expect(temper(game, place, 2)).toBeNull()
    expect(hero.equipment.armor).toBe(itemById('mithril_breastplate@2#life2'))
    expect(hero.hp).toBeLessThanOrEqual(maxHp(hero))
  })
})

describe('crafting tier 3 and up', () => {
  it('asks 5 of the tier material in place of iron, copper or crystal; tiers 1 and 2 as before', () => {
    const mithril = itemById('mithril_longsword')!
    expect([1, 2, 3].map((g) => craftCost(mithril, g as 1 | 2 | 3))).toEqual([{ gold: 5, mithril: 5 }, { gold: 10, mithril: 5 }, { gold: 20, mithril: 5 }])
    expect(craftCost(itemById('wyvern_leather')!, 1)).toEqual({ gold: 5, wyvern_hide: 5 })
    expect(craftCost(itemById('heartwood_bow')!, 3)).toEqual({ gold: 20, heartwood: 5 })
    expect([1, 2, 3].map((g) => craftCost(itemById('steel_longsword')!, g as 1 | 2 | 3))).toEqual([{ gold: 5, iron: 5 }, { gold: 10, copper: 5 }, { gold: 20, crystal: 5 }])
    expect([1, 2, 3].map((g) => craftCost(itemById('ironwood_bow')!, g as 1 | 2 | 3))).toEqual([{ gold: 5, timber: 5 }, { gold: 10, copper: 5 }, { gold: 20, crystal: 5 }])
  })

  it('lists a tier-3 item no modifier fits, to be tempered, and the same items as before for tiers 1 and 2', () => {
    const game = forgeHome(4)
    const before = craftables(game, game.parties[0]).map(({ item, refusal }) => [item.id, refusal])
    game.parties[0].baggage.push(itemById('steel_rapier')!, itemById('mithril_rapier')!, itemById('mithril_longsword')!)
    const listed = craftables(game, game.parties[0])
    expect(listed.map(({ item, refusal }) => [item.id, refusal])).toEqual([...before, ['mithril_rapier', 'No modifier fits it.'], ['mithril_longsword', null]])
  })
})

describe('a forged item\'s worth', () => {
  it('is 1.5 × its forge gold and its temper gold; nothing below tier 3', () => {
    expect(forgedValue(itemById('mithril_longsword')!)).toBe(45)
    expect(forgedValue(itemById('mithril_greatsword')!)).toBe(45)
    expect(forgedValue(itemById('mithril_longsword@2')!)).toBe(135)
    expect(forgedValue(itemById('mithril_longsword@3+balanced1')!)).toBe(180)
    expect(forgedValue(itemById('starmetal_plate@3')!)).toBe(345)
    expect(forgedValue(itemById('steel_longsword@3')!)).toBe(0)
    expect(forgedValue(STORM_WAND)).toBe(0)
  })
})
