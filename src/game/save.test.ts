import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { equipFromBackpack } from '../character/character.ts'
import { gainXp, takePerk } from '../character/progression.ts'
import { mulberry32 } from '../combat/rng.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { hex } from '../grid/hex.ts'
import { BASE_ITEMS, IRON_DAGGER, MAGIC_ITEMS, OAK_SHIELD, RING_PROTECTION, IRON_BREASTPLATE, itemById } from '../inventory/inventory.ts'
import { FIRST_PARTY_ID, FIRST_PARTY_NAME } from './expedition.ts'
import { ENCOUNTERS } from './encounters.ts'
import { newGame, takeLoot, type GameState } from './gameState.ts'
import { Ground } from './ground.ts'
import { PREROLLS, partyFighters, partyFromDrafts } from './party.ts'
import { SAVE_VERSION, describeSave, parseSave, saveSummary, serializeSave, type SaveFile, type SavedBattle } from './save.ts'
import { encampment, type MonsterLocation } from './worldMap.ts'

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
  takePerk(brenna, 'gain_perception')
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
  return { location: location.id, engine: engine.snapshot(), enemyRng: enemyRng.state(), ground: ground.piles() }
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

  it('is version 20, whose company holds where each party stands and what it confronts', () => {
    expect(SAVE_VERSION).toBe(20)
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
        ...['scout', 'wait', 'camp', 'tower', 'outpost'].map((kind) => ({ kind: 'day', action: { kind } })),
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

describe('a version-18 save', () => {
  const raw = readFileSync(new URL('./fixtures/save-v18.json', import.meta.url), 'utf8')
  const old = JSON.parse(raw)

  it('is the fixture the code before the company wrote', () => {
    expect(old.version).toBe(18)
    expect(Object.keys(old.game)).toEqual(expect.arrayContaining(['party', 'baggage']))
    expect(old.game.world.confronting).toBe('goblin_raiders')
    expect(old.game.world.party).not.toEqual({ q: 0, r: 19 })
  })

  it('migrates into a company of one', () => {
    const loaded = parseSave(raw)!
    expect(loaded).not.toBeNull()
    const { game } = loaded
    expect(game.parties).toHaveLength(1)
    const party = game.parties[0]
    expect([party.id, party.name, party.order]).toEqual([FIRST_PARTY_ID, FIRST_PARTY_NAME, { kind: 'idle' }])
    expect(party.members.map((m) => [m.name, m.level, m.hp])).toEqual(old.game.party.map((m: any) => [m.name, m.level, m.hp]))
    party.members.forEach((m, i) =>
      expect(Object.fromEntries(Object.entries(m.equipment).map(([slot, item]) => [slot, item.id]))).toEqual(old.game.party[i].equipment),
    )
    expect(party.baggage).toEqual([itemById('iron_sword'), itemById('iron_sword@3#ember1')])
    expect(party.baggage[1]).toBe(itemById('iron_sword@3#ember1'))
    expect(party.members[0].backpack[0]).toBe(itemById('iron_sword@3#storm1'))
    expect('party' in game || 'baggage' in game).toBe(false)
    expect(party.position).toEqual(old.game.world.party)
    expect(party.confronting).toBe('goblin_raiders')
    expect('party' in game.world || 'confronting' in game.world).toBe(false)
    expect(game.runes).toEqual({ storm1: 1 })
  })

  it('is checked as strictly as a current one', () => {
    const broken = (change: (saved: any) => void) => {
      const saved = JSON.parse(raw)
      change(saved)
      return JSON.stringify(saved)
    }
    expect(parseSave(broken((s) => (s.game.party = [])))).toBeNull()
    expect(parseSave(broken((s) => delete s.game.baggage))).toBeNull()
    expect(parseSave(broken((s) => s.game.baggage.push('vorpal_spoon')))).toBeNull()
    expect(parseSave(broken((s) => delete s.game.world.party))).toBeNull()
    expect(parseSave(broken((s) => (s.game.world.confronting = 3)))).toBeNull()
  })

  it('leaves versions 17, 19 and 21 unreadable', () => {
    for (const version of [17, 19, 21]) expect(parseSave(JSON.stringify({ ...old, version }))).toBeNull()
  })

  it('reads a version-19 save, never released, as unreadable', () => {
    const v19 = JSON.parse(serializeSave({ game: newGame(undefined, 1, 1), battle: null, savedAt: 1 }))
    v19.version = 19
    for (const party of v19.game.parties) {
      delete party.position
      delete party.confronting
    }
    v19.game.world.party = { q: 0, r: 19 }
    v19.game.world.confronting = null
    expect(parseSave(JSON.stringify(v19))).toBeNull()
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
