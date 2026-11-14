import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { equipFromBackpack, maxMana } from '../character/character.ts'
import { nodesCost } from '../character/perks.ts'
import { gainXp, pointsAt, takePerk } from '../character/progression.ts'
import { mulberry32 } from '../combat/rng.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { hex } from '../grid/hex.ts'
import { BASE_ITEMS, IRON_DAGGER, MAGIC_ITEMS, OAK_SHIELD, RING_PROTECTION, IRON_BREASTPLATE, itemById } from '../inventory/inventory.ts'
import { FIRST_PARTY_ID, FIRST_PARTY_NAME, MAX_PARTIES, PARTY_NAMES, newExpedition, partyId, type Expedition, type Order } from './expedition.ts'
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

  it('is version 26, whose characters hold perk points', () => {
    expect(SAVE_VERSION).toBe(26)
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

  it('reads a save of a version other than 26, 25, 24, 23, 22 or 18 as unreadable', () => {
    const saved = JSON.parse(serializeSave({ game: gameUnderWay(), battle: null, savedAt: 5 }))
    for (const version of [17, 19, 20, 21, 27]) expect(parseSave(JSON.stringify({ ...saved, version })), `${version}`).toBeNull()
    for (const version of [26, 25, 24, 23]) expect(parseSave(JSON.stringify({ ...saved, version })), `${version}`).not.toBeNull()
  })

  it('loads a version-24 save, its battle\'s units taking up the stage-3 fields at their defaults', () => {
    const game = gameUnderWay()
    const saved = JSON.parse(serializeSave({ game, battle: battleOf(game), savedAt: 5 }))
    saved.version = 24
    const fields = ['attackedYet', 'endured', 'refunded', 'fallenThisBattle', 'usedOnce']
    for (const unit of saved.battle.engine.units) for (const field of fields) delete unit[field]
    const parsed = parseSave(JSON.stringify(saved))!
    expect(parsed).not.toBeNull()
    const restored = BattleEngine.restore(parsed.battle!.engine)
    expect(restored.snapshot().units.every((u) => !u.attackedYet && !u.endured && !u.refunded && !u.fallenThisBattle && u.usedOnce.length === 0)).toBe(true)
    expect(restored.getState()).toEqual(BattleEngine.restore(battleOf(game).engine).getState())
    expect(JSON.parse(serializeSave(parsed)).version).toBe(SAVE_VERSION)
  })

  it('loads a version-23 save, its battle\'s units taking up `moved` as false', () => {
    const game = gameUnderWay()
    const saved = JSON.parse(serializeSave({ game, battle: battleOf(game), savedAt: 5 }))
    saved.version = 23
    for (const unit of saved.battle.engine.units) delete unit.moved
    const parsed = parseSave(JSON.stringify(saved))!
    expect(parsed).not.toBeNull()
    expect(parsed.game.parties[0].members.map((m) => m.name)).toEqual(game.parties[0].members.map((m) => m.name))
    const restored = BattleEngine.restore(parsed.battle!.engine)
    expect(restored.snapshot().units.every((u) => u.moved === false)).toBe(true)
    expect(JSON.parse(serializeSave(parsed)).version).toBe(SAVE_VERSION)
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

  it('migrates a version-18 battle to the first party', () => {
    const game = gameUnderWay()
    const v = JSON.parse(readFileSync(new URL('./fixtures/save-v18.json', import.meta.url), 'utf8'))
    const battle = JSON.parse(serializeSave({ game, battle: battleOf(game), savedAt: 5 })).battle
    delete battle.party
    expect(parseSave(JSON.stringify({ ...v, battle }))!.battle!.party).toBe(FIRST_PARTY_ID)
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

describe('a version-25 save', () => {
  const raw = readFileSync(new URL('./fixtures/save-v25.json', import.meta.url), 'utf8')
  const old = JSON.parse(raw)
  const loaded = parseSave(raw)!
  const heroes = (game: { parties: { members: any[] }[]; reserves: any[] }) => [...game.parties.flatMap((party) => party.members), ...game.reserves]
  const hero = (save: SaveFile, name: string) => heroes(save.game).find((m) => m.name === name)!

  it('is the fixture skill trees step 27 captured, holding picks', () => {
    expect(old.version).toBe(25)
    expect(heroes(old.game).map((m: any) => [m.name, m.perkPicks])).toEqual([
      ['Aldric', 0], ['Brenna', 0], ['Delwyn', 0], ['Garrick', 0], ['Wren', 3],
    ])
  })

  it('loads with every node kept and the perk points step 27 recorded, over budget at 0 and under budget the rest (NC6)', () => {
    expect(loaded).not.toBeNull()
    const migrated = heroes(loaded.game)
    expect(migrated.map((m) => m.perks)).toEqual(heroes(old.game).map((m: any) => m.perks))
    expect(migrated.map((m) => [m.name, m.level, nodesCost(m), m.perkPoints])).toEqual([
      ['Aldric', 12, 20, 0],
      ['Brenna', 12, 19, 0],
      ['Delwyn', 12, 17, 0],
      ['Garrick', 8, 11, 0],
      ['Wren', 6, 3, pointsAt(6) - 3],
    ])
    expect(hero(loaded, 'Wren').perkPoints).toBe(5)
    for (const m of migrated) expect('perkPicks' in m).toBe(false)
  })

  it('keeps everything else as it was, and saves back as the current version', () => {
    expect(heroes(loaded.game).map((m) => [m.hp, m.mana, m.level])).toEqual(heroes(old.game).map((m: any) => [m.hp, m.mana, m.level]))
    expect(loaded.game.parties.map((p) => p.id)).toEqual(['party_1', 'party_2'])
    expect(JSON.parse(serializeSave(loaded)).version).toBe(SAVE_VERSION)
    expect(parseSave(serializeSave(loaded))).toEqual(loaded)
  })
})

describe('a version-22 save', () => {
  const raw = readFileSync(new URL('./fixtures/save-v22.json', import.meta.url), 'utf8')
  const old = JSON.parse(raw)
  const loaded = parseSave(raw)!
  const heroes = (game: GameState) => [...game.parties.flatMap((party) => party.members), ...game.reserves]
  const hero = (name: string) => heroes(loaded.game).find((m) => m.name === name)!

  /** A version-22 save made from a current game, its characters edited as the test asks. */
  const v22With = (change: (saved: any) => void, game = gameUnderWay(), battle: SavedBattle | null = null): string => {
    const saved = JSON.parse(serializeSave({ game, battle, savedAt: 5 }))
    saved.version = 22
    for (const m of [...saved.game.parties.flatMap((p: any) => p.members), ...saved.game.reserves]) m.spellPicks = 0
    change(saved)
    return JSON.stringify(saved)
  }

  it('is the fixture the code before the skill trees wrote', () => {
    expect(old.version).toBe(22)
    expect(old.game.parties[0].members[1].perks).toMatchObject({ spellcasting: 1, arcane_study: 2, eagle_eye: 1 })
  })

  it('loads, with its parties, reserves, world and no battle as step 01 wrote them', () => {
    expect(loaded).not.toBeNull()
    const { game } = loaded
    expect(game.parties.map((p) => [p.id, p.name, p.members.map((m) => m.name)])).toEqual([
      ['party_1', old.game.parties[0].name, ['Aldric', 'Delwyn']],
      ['party_2', 'Second Company', ['Brenna']],
    ])
    expect(game.reserves.map((m) => [m.name, m.level])).toEqual([['Garrick', 4]])
    expect(game.world.guildHall).toBe(4)
    expect(game.world.turn).toBe(old.game.world.turn)
    expect(game.parties.map((p) => p.position)).toEqual(old.game.parties.map((p: any) => p.position))
    expect(loaded.battle).toBeNull()
    expect(loaded.savedAt).toBe(1_700_000_000_000)
  })

  it('maps a level 6 fighter\'s perks onto the nodes, one rank each, with the perk points it is owed (AC10, NC6)', () => {
    const aldric = hero('Aldric')
    expect(aldric.level).toBe(6)
    // mighty_blow and sunder are one weapon_mastery; gain_endurance and the toughness held are one toughness.
    expect(aldric.perks).toEqual({ weapon_training: 1, weapon_mastery: 1, toughness: 1 })
    // 8 perk points by level 6, less the 1 + 3 + 1 the nodes held cost.
    expect([pointsAt(6), nodesCost(aldric)]).toEqual([8, 5])
    expect(aldric.perkPoints).toBe(3)
  })

  it('keeps every surviving node of a caster whose nodes cost more than its level gives, with no perk points left', () => {
    const delwyn = hero('Delwyn')
    expect(delwyn.perks).toEqual({
      deadeye: 1, lingering_cold: 1, destruction: 1, arcane_study: 1, magic_arrow: 1, flame_arrow: 1,
      fireball: 1, heal: 1, heal_all: 1, shield: 1, bless: 1,
    })
    expect(nodesCost(delwyn)).toBeGreaterThan(pointsAt(6))
    expect(delwyn.perkPoints).toBe(0)
    // 2 × 9 + 5 × 4 + 2 × 10 Mage and Cleric nodes (all but deadeye, Arcane Study among them) + Destruction's 4.
    expect(maxMana(delwyn)).toBe(62)
    expect(delwyn.mana).toBe(40)
  })

  it('folds an archer\'s attribute perks and recomputes its perk points, and a reserve\'s too', () => {
    expect(hero('Brenna').perks).toEqual({ marksmanship: 1, far_shot: 1, skirmisher: 1, fortune: 1, evasion: 1, lasting_magic: 1 })
    // Brenna's six nodes cost 14 against level 6's 8: none left; Garrick's three cost 5 against level 4's 6: one.
    expect(hero('Brenna').perkPoints).toBe(0)
    expect(hero('Garrick').perks).toEqual({ weapon_training: 1, weapon_mastery: 1, toughness: 1 })
    expect(hero('Garrick').perkPoints).toBe(1)
  })

  it('leaves no retired perk, no spell picks and no mana above the maximum on any hero', () => {
    for (const m of heroes(loaded.game)) {
      expect(m.perks).not.toHaveProperty('spellcasting')
      expect(m.perks).not.toHaveProperty('quick_study')
      expect(Object.values(m.perks).every((rank) => rank === 1)).toBe(true)
      expect('spellPicks' in m).toBe(false)
      expect('perkPicks' in m).toBe(false)
      expect(m.mana).toBeLessThanOrEqual(maxMana(m))
    }
  })

  it('saves as the current version and loads back the same', () => {
    expect(JSON.parse(serializeSave(loaded)).version).toBe(SAVE_VERSION)
    expect(parseSave(serializeSave(loaded))).toEqual(loaded)
  })

  it('keeps a battle saved with it, its engine snapshot untouched', () => {
    const game = gameUnderWay()
    const battle = battleOf(game)
    const parsed = parseSave(v22With(() => {}, game, battle))!
    expect(parsed.battle!.party).toBe(game.parties[0].id)
    expect(parsed.battle!.engine).toEqual(battle.engine)
  })

  it('drops a perk id the game does not have', () => {
    const parsed = parseSave(v22With((s) => (s.game.parties[0].members[0].perks = { second_wind: 1, weapon_training: 2 })))!
    expect(parsed.game.parties[0].members[0].perks).toEqual({ weapon_training: 1 })
  })

  it('makes one node of a perk held and a perk folded into it', () => {
    const parsed = parseSave(v22With((s) => (s.game.parties[0].members[1].perks = { eagle_eye: 1, deadeye: 1, gain_luck: 2, fortune: 1 })))!
    expect(parsed.game.parties[0].members[1].perks).toEqual({ deadeye: 1, fortune: 1 })
  })

  it('drops a perk held at rank 0', () => {
    const parsed = parseSave(v22With((s) => (s.game.parties[0].members[0].perks = { weapon_training: 0, toughness: 1 })))!
    expect(parsed.game.parties[0].members[0].perks).toEqual({ toughness: 1 })
  })

  it('recomputes perk points from the level and the nodes\' cost, never below 0', () => {
    const parsed = parseSave(
      v22With((s) => {
        const [low, mid] = s.game.parties[0].members
        Object.assign(low, { level: 1, perkPicks: 7, perks: { weapon_training: 1, heavy_hand: 1, toughness: 1, shield_wall: 1, dodger: 1 } })
        Object.assign(mid, { level: 5, perkPicks: 0, perks: { marksmanship: 1, aimed_shot: 1 } })
        delete low.perkPoints
        delete mid.perkPoints
      }),
    )!
    expect(parsed.game.parties[0].members.slice(0, 2).map((m) => m.perkPoints)).toEqual([0, pointsAt(5) - 3])
  })

  it('clamps mana to the new maximum', () => {
    const parsed = parseSave(v22With((s) => (s.game.parties[0].members[2].mana = 999)))!
    const delwyn = parsed.game.parties[0].members[2]
    expect(delwyn.mana).toBe(maxMana(delwyn))
    expect(delwyn.mana).toBeLessThan(999)
  })

  it('reads a member without a numeric level or a perks object as unreadable', () => {
    expect(parseSave(v22With(() => {}))).not.toBeNull()
    expect(parseSave(v22With((s) => delete s.game.parties[0].members[0].level))).toBeNull()
    expect(parseSave(v22With((s) => (s.game.reserves[0].level = '4')))).toBeNull()
    expect(parseSave(v22With((s) => (s.game.parties[0].members[0].perks = null)))).toBeNull()
    expect(parseSave(v22With((s) => (s.game.parties[0].members[0].perks = { weapon_training: 'two' })))).toBeNull()
    expect(parseSave(v22With((s) => (s.game.reserves = 'none')))).toBeNull()
  })

  it('leaves versions 20 and 21 unreadable', () => {
    for (const version of [20, 21]) expect(parseSave(JSON.stringify({ ...old, version }))).toBeNull()
  })

  it('is checked as strictly as a current one', () => {
    expect(parseSave(v22With((s) => (s.game.parties[0].members[0].equipment.mainHand = 'vorpal_spoon')))).toBeNull()
    expect(parseSave(v22With((s) => (s.game.parties[0].order = { kind: 'dance' })))).toBeNull()
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

  it('migrates into a company of one, its heroes on the skill trees', () => {
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
    // migrateFrom22 then puts its heroes on the trees: Delwyn's Spellcasting is dropped.
    expect(party.members.map((m) => m.perks)).toEqual([
      { weapon_training: 1, toughness: 1, heavy_hand: 1 },
      { marksmanship: 1, deadly_aim: 1, dodger: 1 },
      { arcane_study: 1, keen_eye: 1, magic_arrow: 1, heal: 1 },
    ])
    // Three or four tier-1 nodes at level 1 cost the 3 points of creation or more.
    expect(party.members.map((m) => m.perkPoints)).toEqual([0, 0, 0])
    for (const m of party.members) expect('perkPicks' in m).toBe(false)
    for (const m of party.members) expect('spellPicks' in m).toBe(false)
    expect(party.members[2].mana).toBe(18)
    expect(JSON.parse(serializeSave(loaded)).version).toBe(SAVE_VERSION)
    expect(parseSave(serializeSave(loaded))!.game).toEqual(game)
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
