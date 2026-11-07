import { deriveCombatStats } from '../character/character.ts'
import { attributeLevel } from '../character/perks.ts'
import { describeCost } from '../game/buildings.ts'
import { craftTier } from '../game/crafting.ts'
import type { GameState } from '../game/gameState.ts'
import { itemAt, type ItemPlace } from '../game/itemPlace.ts'
import { embedCost, embedRefusal, extractCost, extractRefusal, fuseCost, fuseRefusal, FUSE_COUNT } from '../game/runecraft.ts'
import { withRunes, type Item } from '../inventory/inventory.ts'
import {
  MAX_RANK,
  RUNES,
  isRuneKey,
  parseRuneKey,
  pouchCount,
  pouchKeys,
  runeKey,
  runeLabel,
  runeName,
  slotClass,
  socketsOf,
  type Rank,
  type RuneKey,
  type SlotClass,
} from '../inventory/runes.ts'
import { TYPICAL_AP, compareLines } from './gearCompare.ts'

/**
 * The crafting screen's Runes tab in words, Phaser-free: an item's sockets,
 * the pouch's lines, and for each action (embed, extract, fuse) its preview,
 * its refusal and what the message says once it is done. Every rule and
 * number is runecraft.ts's; this only words them.
 */

/** What the player may do on the Runes tab: set a rune from the pouch, take one out of the item selected, or fuse three. */
export type RuneAction = { kind: 'embed'; key: RuneKey } | { kind: 'extract'; index: number } | { kind: 'fuse'; key: RuneKey }

/** An action's id, as the probe and the selection name it: `embed:ember1`, `extract:0`, `fuse:storm1`. */
export function actionId(action: RuneAction): string {
  return action.kind === 'extract' ? `extract:${action.index}` : `${action.kind}:${action.key}`
}

export function parseActionId(id: string): RuneAction | null {
  const [kind, arg] = id.split(':')
  if (kind === 'extract') return /^\d+$/.test(arg ?? '') ? { kind, index: Number(arg) } : null
  if ((kind === 'embed' || kind === 'fuse') && isRuneKey(arg ?? '')) return { kind, key: arg as RuneKey }
  return null
}

/** A socket of the item selected: the rune in it and what it does there, or an empty one. */
export interface SocketRow {
  index: number
  rune: RuneKey | null
  label: string
  effect: string | null
}

export function socketRows(item: Item): SocketRow[] {
  const cls = slotClass(item.slot)
  return Array.from({ length: socketsOf(item) }, (_, index) => {
    const key = item.runes?.[index] ?? null
    if (!key) return { index, rune: null, label: 'Empty socket', effect: null }
    const { id, rank } = parseRuneKey(key)!
    return { index, rune: key, label: runeLabel(key), effect: RUNES[id].describe[cls](rank) }
  })
}

/** The pouch's lines, in its order. */
export function pouchRows(game: GameState): Array<{ key: RuneKey; count: number; name: string }> {
  return pouchKeys(game.runes).map((key) => ({ key, count: pouchCount(game.runes, key), name: runeName(key) }))
}

const PLACES: ReadonlyArray<readonly [SlotClass, string]> = [
  ['weapon', 'In a weapon'],
  ['armour', 'In armour'],
  ['shield', 'In a shield'],
]

/** What a rune does in each place it may sit: "In a weapon: +1 fire on a hit", "In armour: Fire ward 2", ... */
export function runeEffectLines(key: RuneKey): string[] {
  const { id, rank } = parseRuneKey(key)!
  return PLACES.map(([cls, where]) => `${where}: ${RUNES[id].describe[cls](rank)}`)
}

/** "3 × Lesser Storm Rune → Storm Rune". */
export function fuseLine(from: RuneKey): string {
  const { id, rank } = parseRuneKey(from)!
  return `${FUSE_COUNT} × ${runeName(from)} → ${runeName(runeKey(id, (rank + 1) as Rank))}`
}

const NO_ITEM = 'Click an item to set the rune in first.'

/** Why `action` cannot be done now, as runecraft.ts says, or null; an embed or extract with no item selected asks for one. */
export function actionRefusal(game: GameState, place: ItemPlace | null, action: RuneAction): string | null {
  if (action.kind === 'fuse') return fuseRefusal(game, action.key)
  if (!place) return action.kind === 'embed' ? NO_ITEM : 'Click an item first.'
  return action.kind === 'embed' ? embedRefusal(game, place, action.key) : extractRefusal(game, place, action.index)
}

/** The preview of `action`: what it does, the item it makes and what changes, and its cost. Empty where there is nothing to make. */
export function actionPreview(game: GameState, place: ItemPlace | null, action: RuneAction): string[] {
  if (action.kind === 'fuse') {
    if (parseRuneKey(action.key)!.rank === MAX_RANK) return []
    return [fuseLine(action.key), `Costs ${describeCost(fuseCost(action.key))}.`]
  }
  const item = place && itemAt(game, place)
  if (!place || !item) return []
  const compare = (after: Item | undefined) => {
    if (!after) return []
    const ap = place.from === 'baggage' ? TYPICAL_AP : deriveCombatStats(game.party[place.member]).actionPoints
    const strength = place.from === 'baggage' ? undefined : attributeLevel(game.party[place.member], 'strength')
    return [`Makes the ${after.name}.`, ...compareLines(item, after, ap, strength)]
  }
  if (action.kind === 'embed') {
    const day = craftTier(game.world) === 'field' ? ' and a day' : ''
    return [
      `Set ${withArticle(runeName(action.key))} in the ${item.name}.`,
      ...compare(withRunes(item, [...(item.runes ?? []), action.key])),
      `Costs ${describeCost(embedCost(action.key))}${day}.`,
    ]
  }
  const key = item.runes?.[action.index]
  if (!key) return []
  return [
    `Take the ${runeName(key)} out of the ${item.name}, intact, into the pouch.`,
    ...compare(withRunes(item, item.runes!.filter((_, i) => i !== action.index))),
    `Costs ${describeCost(extractCost(key))}.`,
  ]
}

/** The message once `action` is done: `made` is the item it made, and `rune` the one an extract took out. */
export function doneMessage(action: RuneAction, made?: Item, rune?: RuneKey): string {
  if (action.kind === 'fuse') {
    const { id, rank } = parseRuneKey(action.key)!
    return `Fused three ${runeName(action.key)}s into one ${runeName(runeKey(id, (rank + 1) as Rank))}.`
  }
  if (action.kind === 'embed') return `Set the ${runeName(action.key)}: the ${made!.name}.`
  return `Took the ${runeName(rune!)} out of the ${made!.name}; it is back in the pouch.`
}

const withArticle = (name: string): string => `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`
