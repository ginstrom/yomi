import { withRunes, type Item } from '../inventory/inventory.ts'
import {
  MAX_RANK,
  addToPouch,
  capitalised,
  parseRuneKey,
  pouchCount,
  runeFitsOnly,
  runeKey,
  runeName,
  socketsOf,
  takeFromPouch,
  type Rank,
  type RuneKey,
} from '../inventory/runes.ts'
import type { WorldEvent } from './blight.ts'
import { atEncampment, canAfford, describeCost, spend } from './buildings.ts'
import { canCamp } from './camp.ts'
import { craftTier } from './crafting.ts'
import { soloPresences } from './expedition.ts'
import { leader, type GameState } from './gameState.ts'
import { STALE, allPlaces, itemAt, replaceAt, type ItemPlace } from './itemPlace.ts'
import type { Stock } from './territory.ts'
import { encampmentName, passTurn, type WorldState } from './worldMap.ts'

/**
 * Runecraft (docs/designs/long-campaign/stage-04-runes.md §2): runes moved
 * between the party's pouch and an item's sockets. Embedding fills the next
 * empty socket, at the workshop of any level or, for a Lesser rune, in the
 * field for a day; extracting takes a rune back intact at a level 2 workshop;
 * fusing makes three of a rune one of the next rank. Each action checks
 * everything before it changes anything, as crafting does, and a change to a
 * worn item keeps its wearer's hit points within the maximum (`replaceAt`
 * clamps them).
 */

export const EMBED_GOLD_PER_RANK = 5
export const FUSE_GOLD_PER_RANK = 10
export const EXTRACT_GOLD_PER_RANK = 10
export const FUSE_COUNT = 3
/** The workshop level that fuses to each rank; 4 and 5 are stage 10's levels, beyond MAX_WORKSHOP_LEVEL (3), so they are always refused for now. */
export const FUSE_LEVELS: Record<2 | 3 | 4, number> = { 2: 1, 3: 4, 4: 5 }
export const EXTRACT_LEVEL = 2

const rankOf = (key: RuneKey): Rank => parseRuneKey(key)!.rank

export function embedCost(key: RuneKey): Stock {
  return { gold: EMBED_GOLD_PER_RANK * rankOf(key) }
}

/** What fusing three of `from` costs: the new rank's fee. */
export function fuseCost(from: RuneKey): Stock {
  return { gold: FUSE_GOLD_PER_RANK * (rankOf(from) + 1) }
}

export function extractCost(key: RuneKey): Stock {
  return { gold: EXTRACT_GOLD_PER_RANK * rankOf(key) }
}

export type RuneResult = { refusal: string } | { refusal: null; item: Item; events: WorldEvent[] }

/** Every item the party has with a socket (allPlaces order), with its sockets. */
export function socketables(game: GameState): Array<{ place: ItemPlace; item: Item; sockets: number }> {
  return allPlaces(game)
    .map(({ place, item }) => ({ place, item, sockets: socketsOf(item) }))
    .filter(({ sockets }) => sockets > 0)
}

/** A rune's name with its article: "a Lesser Ember Rune", "an Ember Rune". */
export const aRune = (key: RuneKey): string => {
  const name = runeName(key)
  return `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`
}

const unaffordable = (cost: Stock): string => `It costs ${describeCost(cost)}, more than the stock holds.`

/** Where the workshop is, for a refusal given away from it. */
const workshopIsAt = (world: WorldState): string => (atEncampment(world) ? '' : ` The workshop is at ${encampmentName(world)}.`)

/** The workshop's level where the party stands: 0 in the field. */
const workshopHere = (world: WorldState): number => {
  const tier = craftTier(world)
  return tier === 'field' ? 0 : tier
}

export function embedRefusal(game: GameState, place: ItemPlace, key: RuneKey): string | null {
  const { world } = game
  const item = itemAt(game, place)
  if (!item) return STALE
  const sockets = socketsOf(item)
  if (sockets === 0) return `${item.name} has no sockets.`
  if ((item.runes?.length ?? 0) >= sockets) return `Its sockets are full; extract one first.`
  if (pouchCount(game.runes, key) === 0) return `The pouch holds no ${runeName(key)}.`
  const { id, rank } = parseRuneKey(key)!
  const fitsOnly = runeFitsOnly(id, item)
  if (fitsOnly) return `${capitalised(aRune(key))} does nothing in ${item.name}; it fits only ${fitsOnly}.`
  if (craftTier(world) === 'field') {
    if (!canCamp(world)) return 'Nothing can be embedded here now.'
    if (rank > 1) return `Only a Lesser rune can be embedded in the field; ${aRune(key)} needs the workshop.${workshopIsAt(world)}`
  }
  const cost = embedCost(key)
  return canAfford(world.stock, cost) ? null : unaffordable(cost)
}

/** Takes `key` from the pouch into the item's next empty socket, spending the cost; in the field (rank 1 only) the day passes (passTurn) and its events come back. */
export function embed(game: GameState, place: ItemPlace, key: RuneKey): RuneResult {
  const refusal = embedRefusal(game, place, key)
  if (refusal) return { refusal }
  const { world } = game
  const item = itemAt(game, place)!
  const result = withRunes(item, [...(item.runes ?? []), key])!
  takeFromPouch(game.runes, key)
  spend(world.stock, embedCost(key))
  replaceAt(game, place, result)
  const events = craftTier(world) === 'field' ? passTurn(world, soloPresences(world, leader(game).members)) : []
  return { refusal: null, item: result, events }
}

export function extractRefusal(game: GameState, place: ItemPlace, index: number): string | null {
  const { world } = game
  const item = itemAt(game, place)
  if (!item) return STALE
  const key = item.runes?.[index]
  if (!key) return `${item.name} has no rune there.`
  if (workshopHere(world) < EXTRACT_LEVEL) return `Extracting a rune needs a level ${EXTRACT_LEVEL} workshop.${workshopIsAt(world)}`
  const cost = extractCost(key)
  return canAfford(world.stock, cost) ? null : unaffordable(cost)
}

/** Takes the rune at `index` of item.runes back into the pouch, intact, for the fee; the rest close up. No time passes. */
export function extract(game: GameState, place: ItemPlace, index: number): RuneResult {
  const refusal = extractRefusal(game, place, index)
  if (refusal) return { refusal }
  const item = itemAt(game, place)!
  const runes = item.runes!
  const key = runes[index]
  const result = withRunes(item, runes.filter((_, i) => i !== index))!
  replaceAt(game, place, result)
  addToPouch(game.runes, key)
  spend(game.world.stock, extractCost(key))
  return { refusal: null, item: result, events: [] }
}

export function fuseRefusal(game: GameState, from: RuneKey): string | null {
  const { world } = game
  const { id, rank } = parseRuneKey(from)!
  if (rank === MAX_RANK) return 'A Grand rune is the highest rank.'
  const next = runeKey(id, (rank + 1) as Rank)
  const level = FUSE_LEVELS[(rank + 1) as 2 | 3 | 4]
  if (workshopHere(world) < level) return `Fusing to ${aRune(next)} needs a level ${level} workshop.${workshopIsAt(world)}`
  const held = pouchCount(game.runes, from)
  if (held < FUSE_COUNT) return `Fusing takes ${FUSE_COUNT} of the ${runeName(from)}; the pouch holds ${held}.`
  const cost = fuseCost(from)
  return canAfford(world.stock, cost) ? null : unaffordable(cost)
}

/** Three of `from` become one of the next rank, in the pouch, for the fee. No time passes. */
export function fuse(game: GameState, from: RuneKey): string | null {
  const refusal = fuseRefusal(game, from)
  if (refusal) return refusal
  const { id, rank } = parseRuneKey(from)!
  takeFromPouch(game.runes, from, FUSE_COUNT)
  addToPouch(game.runes, runeKey(id, (rank + 1) as Rank))
  spend(game.world.stock, fuseCost(from))
  return null
}
