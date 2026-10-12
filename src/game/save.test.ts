import { describe, expect, it } from 'vitest'
import { equipFromBackpack } from '../character/character.ts'
import { gainXp, takePerk } from '../character/progression.ts'
import { mulberry32 } from '../combat/rng.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { hex } from '../grid/hex.ts'
import { IRON_DAGGER, MAGIC_ITEMS, OAK_SHIELD, RING_PROTECTION, STEEL_ARMOR, WEAPONS, itemById } from '../inventory/inventory.ts'
import { ENCOUNTERS } from './encounters.ts'
import { newGame, takeLoot, type GameState } from './gameState.ts'
import { Ground } from './ground.ts'
import { partyFighters } from './party.ts'
import { SAVE_VERSION, describeSave, parseSave, saveSummary, serializeSave, type SaveFile, type SavedBattle } from './save.ts'
import type { MonsterLocation } from './worldMap.ts'

const monsters = (game: GameState): MonsterLocation[] =>
  game.world.locations.filter((location): location is MonsterLocation => location.kind === 'monsters')

/** A game some way in: loot in the baggage, a ring worn, a level gained, a perk taken. */
function gameUnderWay(): GameState {
  const game = newGame(undefined, 2)
  const [first] = monsters(game)
  takeLoot(game, first)
  const [aldric, brenna] = game.party
  aldric.backpack[aldric.backpack.indexOf(null)] = RING_PROTECTION
  equipFromBackpack(aldric, aldric.backpack.indexOf(RING_PROTECTION), [])
  gainXp(brenna, 500)
  takePerk(brenna, 'gain_perception')
  brenna.hp -= 3
  game.world.turn = 14
  return game
}

function battleOf(game: GameState): SavedBattle {
  const location = monsters(game)[1]
  const { setup } = ENCOUNTERS[location.encounter](partyFighters(game.party), location.threat)
  const engine = new BattleEngine(setup, { seed: 9, meta: { location: location.id } })
  engine.step({ type: 'end_turn' })
  engine.step({ type: 'end_turn' })
  const ground = new Ground()
  ground.pileAt(hex(1, 2)).push(OAK_SHIELD, IRON_DAGGER)
  const enemyRng = mulberry32(10)
  enemyRng()
  return { location: location.id, engine: engine.snapshot(), enemyRng: enemyRng.state(), ground: ground.piles() }
}

describe('itemById', () => {
  it('finds every item there is, as the constant itself', () => {
    for (const item of [...WEAPONS, ...MAGIC_ITEMS, OAK_SHIELD, STEEL_ARMOR]) expect(itemById(item.id)).toBe(item)
    expect(itemById('vorpal_spoon')).toBeUndefined()
  })

  it('finds everything a new game can hold: kits, backpacks and loot', () => {
    const game = newGame()
    const held = [
      ...game.party.flatMap((member) => [...Object.values(member.equipment), ...member.backpack.filter((item) => item !== null)]),
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
      ...state.party.flatMap((member) => [...Object.values(member.equipment), ...member.backpack]),
      ...state.baggage,
      ...monsters(state).flatMap((location) => location.loot),
    ]
    const before = itemsOf(game)
    const after = itemsOf(parsed.game)
    expect(after).toHaveLength(before.length)
    after.forEach((item, i) => expect(item).toBe(before[i]))
    expect(parsed.game.party[0].equipment.ring1).toBe(RING_PROTECTION)
    expect(parsed.battle!.ground[0].items[0]).toBe(OAK_SHIELD)
    expect(parsed.game.baggage.length).toBeGreaterThan(0)
  })

  it('writes an item as its id and nothing more', () => {
    const raw = serializeSave({ game: gameUnderWay(), battle: null, savedAt: 5 })
    expect(JSON.parse(raw)).toMatchObject({ version: SAVE_VERSION, savedAt: 5, game: { slot: 2, partyLimit: 3 } })
    expect(JSON.parse(raw).game.party[0].equipment).toMatchObject({ armor: 'steel_armor', ring1: 'ring_protection' })
    expect(raw).not.toContain(STEEL_ARMOR.description)
  })

  it('leaves the game it wrote untouched', () => {
    const game = gameUnderWay()
    const before = structuredClone(game)
    serializeSave({ game, battle: battleOf(game), savedAt: 5 })
    expect(game).toEqual(before)
    expect(game.party[0].equipment.armor).toBe(STEEL_ARMOR)
  })
})

const newGameFile = (): SaveFile => ({ game: newGame(undefined, 1), battle: null, savedAt: 1 })

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
    expect(parseSave(changed((saved) => (saved.game.party[0].equipment.mainHand = 'vorpal_spoon')))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.party[1].backpack[0] = 'vorpal_spoon')))).toBeNull()
    expect(parseSave(changed((saved) => saved.game.baggage.push('vorpal_spoon')))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.world.locations.find((l: any) => l.loot).loot = ['vorpal_spoon'])))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.party[0].perks.second_wind = 1)))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.party[0].tagged = ['stealth'])))).toBeNull()
    expect(parseSave(changed((saved) => delete saved.game.party[0].trained.magic))).toBeNull()
  })

  it('refuses a save with a part missing', () => {
    for (const part of ['party', 'world', 'baggage', 'partyLimit']) {
      expect(parseSave(changed((saved) => delete saved.game[part]))).toBeNull()
    }
    expect(parseSave(changed((saved) => delete saved.game))).toBeNull()
    expect(parseSave(changed((saved) => (saved.game.party = [])))).toBeNull()
    expect(parseSave(changed((saved) => (saved.battle = { location: 'goblin_raiders' })))).toBeNull()
  })
})

describe('saveSummary', () => {
  it('tells the party, its highest level, the turn and when it was written', () => {
    const game = gameUnderWay()
    const summary = saveSummary({ game, battle: null, savedAt: new Date(2026, 9, 12, 21, 40).getTime() })
    expect(summary).toMatchObject({ names: ['Aldric', 'Brenna', 'Delwyn'], level: game.party[1].level, turn: 14, battle: null })
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
