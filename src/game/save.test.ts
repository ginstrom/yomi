import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { equipFromBackpack } from '../character/character.ts'
import { gainXp, takePerk } from '../character/progression.ts'
import { mulberry32 } from '../combat/rng.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { hex } from '../grid/hex.ts'
import { BASE_ITEMS, IRON_DAGGER, MAGIC_ITEMS, OAK_SHIELD, RING_PROTECTION, IRON_BREASTPLATE, itemById } from '../inventory/inventory.ts'
import { FIRST_PARTY_ID, MAX_PARTIES, PARTY_NAMES, newExpedition, partyId, type Expedition, type Order } from './expedition.ts'
import { ENCOUNTERS } from './encounters.ts'
import { newGame, takeLoot, type GameState } from './gameState.ts'
import { Ground } from './ground.ts'
import { PREROLLS, partyFighters, partyFromDrafts } from './party.ts'
import { openRoute, openRouteRefusal } from './trade.ts'
import { SAVE_VERSION, describeSave, parseSave, saveSummary, serializeSave, type SaveFile, type SavedBattle } from './save.ts'
import { ENCAMPMENT_ID, PARTNERS, encampment, type MonsterLocation, type PartnerLocation } from './worldMap.ts'

const monsters = (game: GameState): MonsterLocation[] =>
  game.world.locations.filter((location): location is MonsterLocation => location.kind === 'monsters')

/** A game some way in: loot in the baggage, a ring worn, a level gained, a perk taken. */
function gameUnderWay(): GameState {
  const game = newGame(undefined, 2, 1)
  const [first] = monsters(game)
  takeLoot(game.parties[0], first)
  const [aldric, brenna] = game.parties[0].members
  aldric.backpack[aldric.backpack.indexOf(null)] = RING_PROTECTION
  equipFromBackpack(aldric, aldric.backpack.indexOf(RING_PROTECTION), [])
  gainXp(brenna, 500)
  takePerk(brenna, 'far_shot')
  brenna.hp -= 3
  game.world.turn = 14
  // A reserve at the guild hall, kit and all.
  game.reserves.push(partyFromDrafts([PREROLLS[3].draft])[0])
  game.world.guildHall = 2
  return game
}

function battleOf(game: GameState): SavedBattle {
  const location = monsters(game)[1]
  const { setup } = ENCOUNTERS[location.encounter](partyFighters(game.parties[0].members), location.threat)
  const engine = new BattleEngine(setup, { seed: 9, meta: { location: location.id } })
  engine.step({ type: 'end_turn' })
  engine.step({ type: 'end_turn' })
  const ground = new Ground()
  ground.pileAt(hex(1, 2)).push(OAK_SHIELD, IRON_DAGGER)
  const enemyRng = mulberry32(10)
  enemyRng()
  return { location: location.id, party: game.parties[0].id, engine: engine.snapshot(), enemyRng: enemyRng.state(), ground: ground.piles() }
}

describe('the encampment’s facilities and graded gear', () => {
  it('save and load as they were', () => {
    const game = gameUnderWay()
    Object.assign(game.world, { tradingPost: 3, workshop: 2, infirmary: 1 })
    game.world.stock = { gold: 7, copper: 3 }
    game.parties[0].members[0].equipment.mainHand = itemById('iron_sword@3+light2')
    game.parties[0].members[1].backpack[0] = itemById('yew_bow+recurve1')!
    game.parties[0].baggage.push(itemById('iron_breastplate@2')!)
    game.parties[0].baggage.push(itemById('steel_longsword@2+light1')!)
    const loaded = parseSave(serializeSave({ game, battle: null, savedAt: 1 }))!.game
    expect([loaded.world.tradingPost, loaded.world.workshop, loaded.world.infirmary]).toEqual([3, 2, 1])
    expect(loaded.world.stock).toEqual({ gold: 7, copper: 3 })
    expect(loaded.parties[0].members[0].equipment.mainHand).toBe(itemById('iron_sword@3+light2'))
    expect(loaded.parties[0].members[1].backpack[0]).toBe(game.parties[0].members[1].backpack[0])
    expect(loaded.parties[0].baggage.at(-2)).toBe(itemById('iron_breastplate@2'))
    expect(loaded.parties[0].baggage.at(-1)).toBe(itemById('steel_longsword@2+light1'))
  })
})

describe('itemById', () => {
  it('finds every item there is, as the constant itself', () => {
    for (const item of [...BASE_ITEMS, ...MAGIC_ITEMS]) expect(itemById(item.id)).toBe(item)
    expect(itemById('vorpal_spoon')).toBeUndefined()
  })

  it('finds everything a new game can hold: kits, backpacks and loot', () => {
    const game = newGame()
    const held = [
      ...game.parties[0].members.flatMap((member) => [...Object.values(member.equipment), ...member.backpack.filter((item) => item !== null)]),
      ...monsters(game).flatMap((location) => location.loot),
    ]
    expect(held.length).toBeGreaterThan(20)
    for (const item of held) expect(itemById(item.id)).toBe(item)
  })
})

describe('a save', () => {
  it('comes back equal from its string, for a game on the world map', () => {
    const file: SaveFile = { game: gameUnderWay(), battle: null, savedAt: 1_760_000_000_000 }
    expect(parseSave(serializeSave(file))).toEqual(file)
    expect(parseSave(serializeSave(newGameFile()))).toEqual(newGameFile())
  })

  it('comes back equal for a game in battle, and its engine plays on', () => {
    const game = gameUnderWay()
    const file: SaveFile = { game, battle: battleOf(game), savedAt: 5 }
    const parsed = parseSave(serializeSave(file))!
    expect(parsed).toEqual(file)
    const restored = BattleEngine.restore(parsed.battle!.engine)
    expect(restored.getState().phase).toBe('player')
    expect(restored.getState().round).toBe(2)
  })

  it('gets every item back as the object inventory.ts has', () => {
    const game = gameUnderWay()
    const parsed = parseSave(serializeSave({ game, battle: battleOf(game), savedAt: 5 }))!
    const itemsOf = (state: GameState) => [
      ...state.parties[0].members.flatMap((member) => [...Object.values(member.equipment), ...member.backpack]),
      ...state.parties[0].baggage,
      ...monsters(state).flatMap((location) => location.loot),
    ]
    const before = itemsOf(game)
    const after = itemsOf(parsed.game)
    expect(after).toHaveLength(before.length)
    after.forEach((item, i) => expect(item).toBe(before[i]))
    expect(parsed.game.parties[0].members[0].equipment.ring1).toBe(RING_PROTECTION)
    expect(parsed.battle!.ground[0].items[0]).toBe(OAK_SHIELD)
    expect(parsed.game.parties[0].baggage.length).toBeGreaterThan(0)
  })

  it('is version 30, the 140 × 72 board of stage 9, whose world holds the trade partners, contacts, silence and routes with their raided flag', () => {
    expect(SAVE_VERSION).toBe(30)
  })

  it('round-trips a hero\'s perk points', () => {
    const game = gameUnderWay()
    game.parties[0].members[1].perkPoints = 5
    const parsed = parseSave(serializeSave({ game, battle: null, savedAt: 5 }))!
    expect(parsed.game.parties[0].members.map((m) => m.perkPoints)).toEqual(game.parties[0].members.map((m) => m.perkPoints))
    expect(parsed.game.parties[0].members[1].perkPoints).toBe(5)
    expect('perkPicks' in parsed.game.parties[0].members[1]).toBe(false)
  })

  it('reads a current save whose hero has no perk points, or a negative or fractional number, as unreadable', () => {
    const saved = JSON.parse(serializeSave({ game: gameUnderWay(), battle: null, savedAt: 5 }))
    const broken = (change: (hero: any) => void) => {
      const copy = structuredClone(saved)
      change(copy.game.parties[0].members[0])
      return JSON.stringify(copy)
    }
    expect(parseSave(broken(() => {}))).not.toBeNull()
    expect(parseSave(broken((hero) => delete hero.perkPoints))).toBeNull()
    expect(parseSave(broken((hero) => (hero.perkPoints = -1)))).toBeNull()
    expect(parseSave(broken((hero) => (hero.perkPoints = 1.5)))).toBeNull()
    expect(parseSave(broken((hero) => (hero.perkPoints = '2')))).toBeNull()
    // A current save holding the old field instead is unreadable too.
    expect(parseSave(broken((hero) => ((hero.perkPicks = hero.perkPoints), delete hero.perkPoints)))).toBeNull()
    // And one holding a stray `perkPicks` beside its perk points.
    expect(parseSave(broken((hero) => (hero.perkPicks = 2)))).toBeNull()
  })

  it('reads a save of any version but 30 as unreadable: there is no migration (stage 8 decision 15, stage 9)', () => {
    const saved = JSON.parse(serializeSave({ game: gameUnderWay(), battle: null, savedAt: 5 }))
    expect(parseSave(JSON.stringify(saved))).not.toBeNull()
    for (const version of [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31]) {
      expect(parseSave(JSON.stringify({ ...saved, version })), `${version}`).toBeNull()
    }
  })

  it('reads a character holding a node at a rank other than 1 as unreadable', () => {
    const saved = JSON.parse(serializeSave({ game: gameUnderWay(), battle: null, savedAt: 5 }))
    saved.game.parties[0].members[0].perks = { weapon_training: 2 }
    expect(parseSave(JSON.stringify(saved))).toBeNull()
  })

  it('reads a current save marked version 20 or 21, never released past stage 5, as unreadable', () => {
    const saved = JSON.parse(serializeSave({ game: gameUnderWay(), battle: null, savedAt: 5 }))
    for (const version of [20, 21]) expect(parseSave(JSON.stringify({ ...saved, version }))).toBeNull()
  })

  it('keeps the party a battle was saved in, the second one’s included', () => {
    const game = gameUnderWay()
    const second: Expedition = { ...game.parties[0], id: 'party_2', name: 'Second', members: partyFromDrafts([PREROLLS[3].draft]), baggage: [] }
    game.parties.push(second)
    const battle = { ...battleOf(game), party: 'party_2' }
    expect(parseSave(serializeSave({ game, battle, savedAt: 5 }))!.battle!.party).toBe('party_2')
  })

  it('reads a battle with no party, or one that names none of the game’s, as unreadable', () => {
    const game = gameUnderWay()
    const raw = serializeSave({ game, battle: battleOf(game), savedAt: 5 })
    const edit = (change: (saved: any) => void) => {
      const saved = JSON.parse(raw)
      change(saved)
      return JSON.stringify(saved)
    }
    expect(parseSave(edit((s) => delete s.battle.party))).toBeNull()
    expect(parseSave(edit((s) => (s.battle.party = 'party_9')))).toBeNull()
    expect(parseSave(edit((s) => (s.battle.party = 1)))).toBeNull()
    expect(parseSave(edit((s) => (s.version = 20)))).toBeNull()
  })

  it('keeps the pouch and an item with runes', () => {
    const game = gameUnderWay()
    game.runes = { ember1: 2, storm2: 1 }
    const runed = itemById('iron_sword@3#ember1')!
    game.parties[0].baggage.push(runed)
    game.parties[0].members[0].equipment.mainHand = runed
    const parsed = parseSave(serializeSave({ game, battle: null, savedAt: 5 }))!
    expect(parsed.game.runes).toEqual({ ember1: 2, storm2: 1 })
    expect(parsed.game.parties[0].baggage.at(-1)).toBe(runed)
    expect(parsed.game.parties[0].members[0].equipment.mainHand).toBe(runed)
  })

  it('reads a bad pouch, or a save of version 17, as unreadable', () => {
    const rewrite = (change: (saved: any) => void) => {
      const saved = JSON.parse(serializeSave({ game: gameUnderWay(), battle: null, savedAt: 5 }))
      change(saved)
      return JSON.stringify(saved)
    }
    for (const runes of [{ fire1: 1 }, { ember5: 1 }, { ember1: 0 }, { ember1: -1 }, { ember1: 1.5 }, [], null]) {
      expect(parseSave(rewrite((saved) => (saved.game.runes = runes)))).toBeNull()
    }
    expect(parseSave(rewrite((saved) => (saved.version = 17)))).toBeNull()
    expect(parseSave(rewrite(() => {}))).not.toBeNull()
  })

  it('writes an item as its id and nothing more', () => {
    const raw = serializeSave({ game: gameUnderWay(), battle: null, savedAt: 5 })
    expect(JSON.parse(raw)).toMatchObject({ version: SAVE_VERSION, savedAt: 5, game: { slot: 2, world: { guildHall: 2 } } })
    expect(JSON.parse(raw).game.reserves[0].equipment).toMatchObject({ armor: 'iron_breastplate' })
    expect(JSON.parse(raw).game.parties[0].members[0].equipment).toMatchObject({ armor: 'iron_breastplate', ring1: 'ring_protection' })
    expect(raw).not.toContain(IRON_BREASTPLATE.description)
  })

  it('leaves the game it wrote untouched', () => {
    const game = gameUnderWay()
    const before = structuredClone(game)
    serializeSave({ game, battle: battleOf(game), savedAt: 5 })
    expect(game).toEqual(before)
    expect(game.parties[0].members[0].equipment.armor).toBe(IRON_BREASTPLATE)
  })
})

const newGameFile = (): SaveFile => ({ game: newGame(undefined, 1, 1), battle: null, savedAt: 1 })

describe('parseSave', () => {
  const changed = (change: (saved: any) => void): string => {
    const saved = JSON.parse(serializeSave(newGameFile()))
    change(saved)
    return JSON.stringify(saved)
  }

  it('reads nothing as nothing', () => {
    expect(parseSave(null)).toBeNull()
  })

  it('refuses what is not a save', () => {
    for (const raw of ['{', '', 'null', '42', '"save"', '[]', '{}', '{"version":1}']) expect(parseSave(raw)).toBeNull()
  })

  it('refuses a save of another version', () => {
    expect(parseSave(changed((saved) => (saved.version = SAVE_VERSION + 1)))).toBeNull()
    expect(parseSave(changed((saved) => delete saved.version))).toBeNull()
    expect(parseSave(changed(() => {}))).not.toBeNull()
  })

  it('refuses a save that names an item, a perk or a skill the game does not have', () => {
    expect(parseSave(changed((saved) => (saved.game.parties[0].members[0].equipment.mainHand = 'vorpal_spoon')))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.parties[0].members[1].backpack[0] = 'vorpal_spoon')))).toBeNull()
    expect(parseSave(changed((saved) => saved.game.parties[0].baggage.push('vorpal_spoon')))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.world.locations.find((l: any) => l.loot).loot = ['vorpal_spoon'])))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.parties[0].members[0].perks.second_wind = 1)))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.parties[0].members[0].tagged = ['stealth'])))).toBeNull()
    expect(parseSave(changed((saved) => delete saved.game.parties[0].members[0].trained.magic))).toBeNull()
  })

  it('refuses a save with a part missing', () => {
    for (const part of ['parties', 'world', 'reserves']) {
      expect(parseSave(changed((saved) => delete saved.game[part]))).toBeNull()
    }
    expect(parseSave(changed((saved) => delete saved.game))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.parties = [])))).toBeNull()
    expect(parseSave(changed((saved) => delete saved.game.parties[0].members))).toBeNull()
    expect(parseSave(changed((saved) => delete saved.game.parties[0].baggage))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.parties[0].members = [])))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.parties[0].order = { kind: 'dance' })))).toBeNull()
    expect(parseSave(changed((saved) => delete saved.game.parties[0].order))).toBeNull()
    expect(parseSave(changed((saved) => delete saved.game.parties[0].position))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.parties[0].position = { q: '1', r: 2 })))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.parties[0].position = null)))).toBeNull()
    expect(parseSave(changed((saved) => delete saved.game.parties[0].confronting))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.parties[0].confronting = 7)))).toBeNull()
    expect(parseSave(changed((saved) => saved.game.parties.push(structuredClone(saved.game.parties[0]))))).toBeNull()
    expect(parseSave(changed((saved) => (saved.battle = { location: 'goblin_raiders' })))).toBeNull()
  })

  describe('an order', () => {
    const withOrder = (order: unknown) => parseSave(changed((saved) => (saved.game.parties[0].order = order)))
    const place = { from: 'worn', party: FIRST_PARTY_ID, member: 0, slot: 'mainHand', itemId: 'iron_sword' }

    it('reads a travel order with its destination and route, and a day order with its action', () => {
      const orders = [
        { kind: 'travel', to: hex(5, 6), route: [hex(4, 6), hex(5, 6)] },
        { kind: 'camp' },
        ...['scout', 'wait', 'camp', 'tower', 'improve'].map((kind) => ({ kind: 'day', action: { kind } })),
        { kind: 'day', action: { kind: 'craft', place, modifier: 'light', grade: 2 } },
        { kind: 'day', action: { kind: 'embed', place: { from: 'baggage', party: FIRST_PARTY_ID, index: 0, itemId: 'x' }, rune: 'ember1' } },
        { kind: 'day', action: { kind: 'embed', place: { from: 'backpack', party: FIRST_PARTY_ID, member: 1, index: 2, itemId: 'x' }, rune: 'storm2' } },
      ]
      for (const order of orders) expect(withOrder(order)?.game.parties[0].order).toEqual(order)
    })

    it('refuses a travel order without a destination or with a route that is not of hexes', () => {
      expect(withOrder({ kind: 'travel', route: [hex(4, 6)] })).toBeNull()
      expect(withOrder({ kind: 'travel', to: { q: 'a', r: 1 }, route: [] })).toBeNull()
      expect(withOrder({ kind: 'travel', to: hex(5, 6) })).toBeNull()
      expect(withOrder({ kind: 'travel', to: hex(5, 6), route: hex(5, 6) })).toBeNull()
      expect(withOrder({ kind: 'travel', to: hex(5, 6), route: [hex(4, 6), null] })).toBeNull()
    })

    it('refuses a day order without a known action, or a craft or embed without its fields', () => {
      expect(withOrder({ kind: 'day' })).toBeNull()
      expect(withOrder({ kind: 'day', action: { kind: 'dance' } })).toBeNull()
      expect(withOrder({ kind: 'day', action: { kind: 'craft', place, modifier: 'sparkly', grade: 1 } })).toBeNull()
      expect(withOrder({ kind: 'day', action: { kind: 'craft', place, modifier: 'light', grade: 4 } })).toBeNull()
      expect(withOrder({ kind: 'day', action: { kind: 'craft', modifier: 'light', grade: 1 } })).toBeNull()
      expect(withOrder({ kind: 'day', action: { kind: 'craft', place: { ...place, slot: 'tail' }, modifier: 'light', grade: 1 } })).toBeNull()
      expect(withOrder({ kind: 'day', action: { kind: 'craft', place: { ...place, from: 'pocket' }, modifier: 'light', grade: 1 } })).toBeNull()
      expect(withOrder({ kind: 'day', action: { kind: 'craft', place: { ...place, party: 3 }, modifier: 'light', grade: 1 } })).toBeNull()
      expect(withOrder({ kind: 'day', action: { kind: 'embed', place, rune: 'ember9' } })).toBeNull()
      expect(withOrder({ kind: 'day', action: { kind: 'embed', place: { from: 'baggage', party: FIRST_PARTY_ID, itemId: 'x' }, rune: 'ember1' } })).toBeNull()
    })
  })
})

describe('a company', () => {
  it('round-trips a company of two with home, garrison and meet orders', () => {
    const game = gameUnderWay()
    const second: Expedition = newExpedition(partyFromDrafts([PREROLLS[3].draft]), hex(4, 6), partyId(2), PARTY_NAMES[1])
    game.parties.push(second)
    const orders: Order[] = [
      { kind: 'home', to: encampment(game.world).position, route: [hex(4, 6), encampment(game.world).position] },
      { kind: 'garrison' },
      { kind: 'meet', party: 'party_1' },
    ]
    for (const order of orders) {
      second.order = order
      game.parties[0].order = order.kind === 'meet' ? { kind: 'meet', party: 'party_2' } : { kind: 'idle' }
      const parsed = parseSave(serializeSave({ game, battle: null, savedAt: 5 }))!
      expect(parsed.game).toEqual(game)
      expect(parsed.game.parties.map((p) => p.order)).toEqual(game.parties.map((p) => p.order))
    }
  })

  it('reads a meet naming no party of the save, or an order of an unknown kind, as unreadable', () => {
    const game = gameUnderWay()
    const raw = serializeSave({ game, battle: null, savedAt: 5 })
    const edit = (change: (saved: any) => void) => {
      const saved = JSON.parse(raw)
      change(saved)
      return JSON.stringify(saved)
    }
    expect(parseSave(edit((s) => (s.game.parties[0].order = { kind: 'meet', party: 'party_9' })))).toBeNull()
    expect(parseSave(edit((s) => (s.game.parties[0].order = { kind: 'meet' })))).toBeNull()
    expect(parseSave(edit((s) => (s.game.parties[0].order = { kind: 'home', to: { q: 0, r: 0 } })))).toBeNull()
    expect(parseSave(edit((s) => (s.game.parties[0].order = { kind: 'patrol' })))).toBeNull()
    expect(parseSave(edit((s) => (s.game.parties[0].order = { kind: 'garrison' })))).not.toBeNull()
  })

  it('reads more than MAX_PARTIES parties, a meet naming its own party or a guild hall outside 1 to 5 as unreadable', () => {
    const game = gameUnderWay()
    for (let n = 2; n <= MAX_PARTIES + 1; n++) game.parties.push(newExpedition(partyFromDrafts([PREROLLS[3].draft]), hex(4, 6), partyId(n), `Party ${n}`))
    const tooMany = serializeSave({ game, battle: null, savedAt: 5 })
    expect(parseSave(tooMany)).toBeNull()
    game.parties.length = MAX_PARTIES
    const raw = serializeSave({ game, battle: null, savedAt: 5 })
    expect(parseSave(raw)).not.toBeNull()
    const edit = (change: (saved: any) => void) => {
      const saved = JSON.parse(raw)
      change(saved)
      return JSON.stringify(saved)
    }
    expect(parseSave(edit((s) => (s.game.parties[0].order = { kind: 'meet', party: 'party_1' })))).toBeNull()
    expect(parseSave(edit((s) => (s.game.world.guildHall = 0)))).toBeNull()
    expect(parseSave(edit((s) => (s.game.world.guildHall = 6)))).toBeNull()
    expect(parseSave(edit((s) => (s.game.world.guildHall = 2.5)))).toBeNull()
    expect(parseSave(edit((s) => (s.game.world.guildHall = 5)))).not.toBeNull()
  })

  it('round-trips with its id, name, position, order, confrontation, members and baggage', () => {
    const game = gameUnderWay()
    game.parties[0].order = { kind: 'travel', to: hex(5, 6), route: [hex(4, 6), hex(5, 6)] }
    const raiders = game.world.locations.find((l) => l.id === 'goblin_raiders')!
    game.parties[0].position = raiders.position
    game.parties[0].confronting = raiders.id
    const parsed = parseSave(serializeSave({ game, battle: null, savedAt: 5 }))!
    expect(parsed.game).toEqual(game)
    expect(parsed.game.parties).toHaveLength(1)
    const [before, after] = [game.parties[0], parsed.game.parties[0]]
    expect(after.position).not.toEqual(encampment(game.world).position)
    expect([after.id, after.name, after.position, after.order, after.confronting]).toEqual([
      before.id,
      before.name,
      raiders.position,
      before.order,
      'goblin_raiders',
    ])
    expect(after.members).toEqual(before.members)
    expect(after.baggage).toHaveLength(before.baggage.length)
    after.baggage.forEach((item, i) => expect(item).toBe(before.baggage[i]))
  })
})

describe('a save\'s improvements and Lodge', () => {
  /** A current save's JSON, its world edited as the test asks. */
  const savedWith = (change: (world: any) => void): string => {
    const saved = JSON.parse(serializeSave({ game: gameUnderWay(), battle: null, savedAt: 5 }))
    change(saved.game.world)
    return JSON.stringify(saved)
  }

  it('round-trips improvements at levels 1 to 3 and the Lodge\'s level', () => {
    const game = gameUnderWay()
    game.world.improvements = { iron_vein: 2, gold_seam: 3, timber_stand: 1 }
    game.world.lodge = 2
    const parsed = parseSave(serializeSave({ game, battle: null, savedAt: 5 }))!
    expect(parsed.game.world.improvements).toEqual({ iron_vein: 2, gold_seam: 3, timber_stand: 1 })
    expect(parsed.game.world.lodge).toBe(2)
    expect(parsed).toEqual({ game, battle: null, savedAt: 5 })
  })

  it('reads a bad improvement or Lodge level, or the old outposts list, as unreadable', () => {
    expect(parseSave(savedWith(() => {}))).not.toBeNull()
    expect(parseSave(savedWith((w) => (w.improvements = { iron_vein: 3 })))).not.toBeNull()
    expect(parseSave(savedWith((w) => (w.lodge = 3)))).not.toBeNull()
    expect(parseSave(savedWith((w) => (w.improvements = { iron_vein: 4 })))).toBeNull()
    expect(parseSave(savedWith((w) => (w.improvements = { iron_vein: 0 })))).toBeNull()
    expect(parseSave(savedWith((w) => (w.improvements = { [ENCAMPMENT_ID]: 1 })))).toBeNull()
    expect(parseSave(savedWith((w) => (w.improvements = { nowhere: 1 })))).toBeNull()
    expect(parseSave(savedWith((w) => (w.improvements = ['iron_vein'])))).toBeNull()
    expect(parseSave(savedWith((w) => delete w.improvements))).toBeNull()
    expect(parseSave(savedWith((w) => (w.lodge = 4)))).toBeNull()
    expect(parseSave(savedWith((w) => (w.lodge = -1)))).toBeNull()
    expect(parseSave(savedWith((w) => (w.lodge = 1.5)))).toBeNull()
    expect(parseSave(savedWith((w) => delete w.lodge))).toBeNull()
  })

  it('reads a day order of the old outpost action as unreadable', () => {
    const saved = JSON.parse(serializeSave({ game: gameUnderWay(), battle: null, savedAt: 5 }))
    saved.game.parties[0].order = { kind: 'day', action: { kind: 'outpost' } }
    expect(parseSave(JSON.stringify(saved))).toBeNull()
    saved.game.parties[0].order = { kind: 'day', action: { kind: 'improve' } }
    expect(parseSave(JSON.stringify(saved))).not.toBeNull()
  })
})

describe('saveSummary', () => {
  it('tells the party, its highest level, the turn and when it was written', () => {
    const game = gameUnderWay()
    const summary = saveSummary({ game, battle: null, savedAt: new Date(2026, 9, 12, 21, 40).getTime() })
    expect(summary).toMatchObject({ names: ['Aldric', 'Brenna', 'Delwyn'], level: game.parties[0].members[1].level, turn: 14, battle: null })
    expect(summary.level).toBeGreaterThan(1)
    expect(describeSave(summary)).toBe(`Aldric, Brenna, Delwyn    Level ${summary.level}    Turn 14    12 Oct 21:40`)
  })

  it('names the monsters of a game saved in battle', () => {
    const game = newGame(undefined, 1)
    const battle = battleOf(game)
    const summary = saveSummary({ game, battle, savedAt: 5 })
    expect(summary.battle).toBe(monsters(game)[1].name)
    expect(describeSave(summary)).toBe(`Aldric, Brenna, Delwyn    Level 1    Turn 1    In battle: ${monsters(game)[1].name}`)
  })
})

const partnersOf = (game: GameState): PartnerLocation[] =>
  game.world.locations.filter((l): l is PartnerLocation => l.kind === 'partner')

describe('the older fixtures (stage 8 decision 15: no migration)', () => {
  it.each(['save-v18.json', 'save-v22.json', 'save-v25.json', 'save-v26.json', 'save-v27.json'])('%s reads as unreadable', (file) => {
    const raw = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8')
    expect(JSON.parse(raw).version).toBeLessThan(SAVE_VERSION)
    expect(parseSave(raw)).toBeNull()
  })

  it('include version 27, the code before stage 8 wrote: works on Iron Vein, the Lodge at 2, no partners', () => {
    const old = JSON.parse(readFileSync(new URL('./fixtures/save-v27.json', import.meta.url), 'utf8'))
    expect(old.version).toBe(27)
    expect(old.game.world.improvements).toEqual({ iron_vein: 2 })
    expect(old.game.world.locations.some((l: any) => l.kind === 'partner')).toBe(false)
    for (const key of ['contacted', 'silent', 'routes', 'routesOpened']) expect(key in old.game.world).toBe(false)
  })
})

describe('a version-30 save', () => {
  /** A game with Millbrook contacted, Saltmere silent and a hand-made route to Millbrook. */
  function trading(): GameState {
    const game = gameUnderWay()
    const { world } = game
    world.contacted = ['millbrook', 'saltmere']
    world.silent = ['saltmere']
    world.routes = [{ id: 'route_millbrook', partner: 'millbrook', road: [{ q: 1, r: 32 }, { ...PARTNERS[0].position }], opened: 12, raidedDays: 2, raided: true }]
    world.routesOpened = 1
    return game
  }
  const edited = (change: (world: any) => void): string => {
    const saved = JSON.parse(serializeSave({ game: trading(), battle: null, savedAt: 5 }))
    change(saved.game.world)
    return JSON.stringify(saved)
  }

  it('starts a new game with the five partners, as copies, and round-trips contacts, silence and routes', () => {
    const game = trading()
    expect(partnersOf(game).map((p) => p.id)).toEqual(['millbrook', 'saltmere', 'stonehollow', 'elder_glade', 'emberwatch'])
    const parsed = parseSave(serializeSave({ game, battle: null, savedAt: 5 }))!
    expect(parsed).toEqual({ game, battle: null, savedAt: 5 })
  })

  it('reads a bad partner, contact, silence, route or count as unreadable', () => {
    expect(parseSave(edited(() => {}))).not.toBeNull()
    const millbrook = (w: any) => w.locations.find((l: any) => l.id === 'millbrook')
    // A good of the outer rings' (stage 9) is a material; one that is none is refused.
    expect(parseSave(edited((w) => (millbrook(w).good = 'mithril')))).not.toBeNull()
    expect(parseSave(edited((w) => (millbrook(w).good = 'unobtainium')))).toBeNull()
    expect(parseSave(edited((w) => delete millbrook(w).good))).toBeNull()
    expect(parseSave(edited((w) => (millbrook(w).good = ['timber'])))).toBeNull()
    expect(parseSave(edited((w) => (w.contacted = ['iron_vein'])))).toBeNull()
    expect(parseSave(edited((w) => (w.contacted = ['millbrook', 'millbrook'])))).toBeNull()
    expect(parseSave(edited((w) => (w.contacted = 'millbrook')))).toBeNull()
    expect(parseSave(edited((w) => delete w.contacted))).toBeNull()
    expect(parseSave(edited((w) => (w.silent = ['nowhere'])))).toBeNull()
    expect(parseSave(edited((w) => delete w.silent))).toBeNull()
    expect(parseSave(edited((w) => delete w.routes))).toBeNull()
    expect(parseSave(edited((w) => (w.routes[0].partner = 'iron_vein')))).toBeNull()
    expect(parseSave(edited((w) => (w.routes[0].id = 7)))).toBeNull()
    expect(parseSave(edited((w) => (w.routes[0].road = [{ q: 1 }])))).toBeNull()
    expect(parseSave(edited((w) => delete w.routes[0].road))).toBeNull()
    expect(parseSave(edited((w) => (w.routes[0].opened = 1.5)))).toBeNull()
    expect(parseSave(edited((w) => (w.routes[0].raidedDays = -1)))).toBeNull()
    expect(parseSave(edited((w) => delete w.routes[0].raided))).toBeNull()
    expect(parseSave(edited((w) => (w.routes = [null])))).toBeNull()
    expect(parseSave(edited((w) => (w.routesOpened = -1)))).toBeNull()
    expect(parseSave(edited((w) => delete w.routesOpened))).toBeNull()
  })

  it('reads a route with the wrong id, a second route to one partner or a route to an uncontacted partner as unreadable', () => {
    expect(parseSave(edited((w) => (w.routes[0].id = 'route_saltmere')))).toBeNull()
    expect(parseSave(edited((w) => (w.routes[0].id = 'millbrook')))).toBeNull()
    expect(parseSave(edited((w) => w.routes.push({ ...w.routes[0] })))).toBeNull()
    expect(parseSave(edited((w) => (w.contacted = ['saltmere'])))).toBeNull()
    // A route to a contacted partner that has since fallen silent is fine.
    expect(parseSave(edited((w) => w.routes.push({ ...w.routes[0], id: 'route_saltmere', partner: 'saltmere' })))).not.toBeNull()
  })

  it('round-trips a route opened by openRoute', () => {
    const game = gameUnderWay()
    const { world } = game
    world.contacted = ['millbrook']
    world.tradingPost = 4
    world.stock = { gold: 100, timber: 20 }
    const party = game.parties[0]
    party.position = { ...encampment(world).position }
    party.confronting = null
    expect(openRouteRefusal(game, party, 'millbrook')).toBeNull()
    openRoute(game, party, 'millbrook')
    expect(world.routes).toHaveLength(1)
    expect(parseSave(serializeSave({ game, battle: null, savedAt: 5 }))).toEqual({ game, battle: null, savedAt: 5 })
  })
})
