import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newGame } from './gameState.ts'
import { serializeSave, type SaveFile } from './save.ts'
import { SLOT_IDS, deleteSlot, firstEmptySlot, latestSlot, readSlot, saveGame, writeSlot } from './saveSlots.ts'

/** A stand-in for the browser's storage, which Node has none of. */
class MemoryStorage {
  readonly values = new Map<string, string>()
  getItem = (key: string): string | null => this.values.get(key) ?? null
  setItem = (key: string, value: string): void => void this.values.set(key, value)
  removeItem = (key: string): void => void this.values.delete(key)
}

const file = (savedAt: number): SaveFile => ({ game: newGame(), battle: null, savedAt })

let store: MemoryStorage

beforeEach(() => {
  store = new MemoryStorage()
  vi.stubGlobal('localStorage', store)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the slots', () => {
  it('are three, each empty to begin with', () => {
    expect(SLOT_IDS).toEqual([1, 2, 3])
    expect(SLOT_IDS.map(readSlot)).toEqual([null, null, null])
    expect([latestSlot(), firstEmptySlot()]).toEqual([null, 1])
  })

  it('give back what was written, as a game of that slot', () => {
    expect(writeSlot(2, file(7))).toBe(true)
    expect([...store.values.keys()]).toEqual(['yomi.save.2'])
    const read = readSlot(2) as SaveFile
    expect(read).toEqual({ ...file(7), game: { ...file(7).game, slot: 2 } })
    expect([readSlot(1), readSlot(3)]).toEqual([null, null])
  })

  it('tell the slot written last and the first empty one', () => {
    writeSlot(1, file(50))
    writeSlot(2, file(90))
    expect([latestSlot(), firstEmptySlot()]).toEqual([2, 3])
    writeSlot(1, file(120))
    writeSlot(3, file(10))
    expect([latestSlot(), firstEmptySlot()]).toEqual([1, null])
  })

  it('read damage and other versions as unreadable, which neither loads nor counts as the latest', () => {
    store.setItem('yomi.save.1', '{')
    store.setItem('yomi.save.2', serializeSave(file(999)).replace('"version":1', '"version":0'))
    expect([readSlot(1), readSlot(2)]).toEqual(['unreadable', 'unreadable'])
    expect(latestSlot()).toBeNull()
    // An unreadable slot is not empty: a new game does not take it unasked.
    expect(firstEmptySlot()).toBe(3)
    writeSlot(3, file(1))
    expect([latestSlot(), firstEmptySlot()]).toEqual([3, null])
  })

  it('are emptied by deleteSlot', () => {
    writeSlot(1, file(5))
    writeSlot(2, file(9))
    expect(deleteSlot(2)).toBe(true)
    expect(readSlot(2)).toBeNull()
    expect([latestSlot(), firstEmptySlot()]).toEqual([1, 2])
  })
})

describe('saveGame', () => {
  it('writes the game to its own slot, stamped with the time', () => {
    vi.useFakeTimers({ now: 1234 })
    const game = newGame(undefined, 3)
    expect(saveGame(game)).toBe(true)
    expect(readSlot(3)).toEqual({ game, battle: null, savedAt: 1234 })
    game.world.turn = 9
    vi.setSystemTime(2000)
    saveGame(game)
    expect(readSlot(3)).toMatchObject({ game: { world: { turn: 9 } }, savedAt: 2000 })
  })

  it('writes the battle the game is in', () => {
    const game = newGame(undefined, 1)
    const battle = { location: 'goblin_raiders', enemyRng: 4, ground: [], engine: { board: { cols: 1, rows: 1 }, units: [], round: 1, phase: 'player' as const, winner: null, seq: 0, events: [], rng: 3 } }
    saveGame(game, battle)
    expect((readSlot(1) as SaveFile).battle).toEqual(battle)
    saveGame(game)
    expect((readSlot(1) as SaveFile).battle).toBeNull()
  })

  it('saves nothing for a game with no slot, which is no failure', () => {
    expect(saveGame(newGame())).toBe(true)
    expect(store.values.size).toBe(0)
  })
})

describe('a browser that refuses storage', () => {
  it('reads every slot as empty and reports each write as failed, when storage throws', () => {
    const refusing = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('full') }, removeItem: () => { throw new Error('denied') } }
    vi.stubGlobal('localStorage', refusing)
    expect(readSlot(1)).toBeNull()
    expect(writeSlot(1, file(1))).toBe(false)
    expect(deleteSlot(1)).toBe(false)
    expect(saveGame(newGame(undefined, 1))).toBe(false)
    expect([latestSlot(), firstEmptySlot()]).toEqual([null, 1])
  })

  it('does the same when there is no storage at all', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readSlot(2)).toBeNull()
    expect(writeSlot(2, file(1))).toBe(false)
    expect(saveGame(newGame(undefined, 2))).toBe(false)
  })
})
