import { storage } from '../storage.ts'
import type { GameState } from './gameState.ts'
import { parseSave, serializeSave, type SaveFile, type SavedBattle } from './save.ts'

/**
 * The three save slots, kept in the browser's storage. A playthrough lives in
 * one slot from its beginning to its end, written by the game itself
 * (`saveGame`) and emptied by a defeat (`deleteSlot`). A browser that refuses
 * storage still plays: every function here then reports nothing kept.
 */
export const SLOT_IDS = [1, 2, 3] as const
export type SlotId = (typeof SLOT_IDS)[number]

const slotKey = (slot: SlotId): string => `yomi.save.${slot}`

/** A slot's contents: null when it is empty, and 'unreadable' when what it holds is no save of this version. */
export function readSlot(slot: SlotId): SaveFile | null | 'unreadable' {
  let raw: string | null
  try {
    raw = storage()?.getItem(slotKey(slot)) ?? null
  } catch {
    return null
  }
  if (raw === null) return null
  const file = parseSave(raw)
  if (!file) return 'unreadable'
  // The slot a game is read from is the slot it is written back to.
  file.game.slot = slot
  return file
}

/** Writes a slot. Returns false if the browser refused. */
export function writeSlot(slot: SlotId, file: SaveFile): boolean {
  try {
    const store = storage()
    if (!store) return false
    store.setItem(slotKey(slot), serializeSave(file))
    return true
  } catch {
    return false
  }
}

/** Empties a slot, as a defeat does. Returns false if the browser refused. */
export function deleteSlot(slot: SlotId): boolean {
  try {
    const store = storage()
    if (!store) return false
    store.removeItem(slotKey(slot))
    return true
  } catch {
    return false
  }
}

/** The readable slot written last, which is the one Continue loads; null when there is none. */
export function latestSlot(): SlotId | null {
  let latest: { slot: SlotId; savedAt: number } | null = null
  for (const slot of SLOT_IDS) {
    const file = readSlot(slot)
    if (file && file !== 'unreadable' && (!latest || file.savedAt > latest.savedAt)) latest = { slot, savedAt: file.savedAt }
  }
  return latest?.slot ?? null
}

/** The first slot holding nothing, which a new game takes; null when all are filled, an unreadable one counting as filled. */
export function firstEmptySlot(): SlotId | null {
  return SLOT_IDS.find((slot) => readSlot(slot) === null) ?? null
}

/**
 * Saves the game to its slot: as it stands on the world map, or with the
 * battle it is in. Returns false if the browser refused; a game with no slot
 * is not saved and that is no failure.
 */
export function saveGame(game: GameState, battle: SavedBattle | null = null): boolean {
  if (game.slot === null) return true
  return writeSlot(game.slot, { game, battle, savedAt: Date.now() })
}
