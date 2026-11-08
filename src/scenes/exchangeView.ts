import type { Character } from '../character/character.ts'
import { exchange, type ExchangeMove } from '../game/company.ts'
import type { Expedition } from '../game/expedition.ts'
import type { GameState } from '../game/gameState.ts'
import { hexEquals } from '../grid/hex.ts'

/**
 * The words and the mapping of the Exchange scene, free of Phaser: which
 * parties can trade here, what a pick and a click ask `exchange` to do, and
 * the lines of a baggage list. The rules are company.ts's.
 */

/** The other parties of the company on `party`'s hex, in list order: those it can exchange with. */
export function exchangePartners(game: GameState, party: Expedition): Expedition[] {
  return game.parties.filter((other) => other !== party && hexEquals(other.position, party.position))
}

/** A hero of the two rows (0 the acting party's, 1 the other's), or one row alone for a click on its header. */
export interface ExchangePick {
  row: 0 | 1
  index: number
}
export interface ExchangeClick {
  row: 0 | 1
  /** The hero clicked; absent for the row's header or an empty place, which takes the picked hero in. */
  index?: number
}

/** What a click with a hero picked asks of `exchange` between parties `ids`, or null when it asks nothing (the same row). */
export function exchangeMove(pick: ExchangePick, click: ExchangeClick, ids: readonly [string, string]): ExchangeMove | null {
  if (pick.row === click.row) return null
  if (click.index === undefined) return { kind: 'member', from: ids[pick.row], index: pick.index }
  return pick.row === 0 ? { kind: 'swap', a: pick.index, b: click.index } : { kind: 'swap', a: click.index, b: pick.index }
}

/** Makes one move between parties `a` and `b`, returning `exchange`'s refusal or null. */
export function tryExchange(game: GameState, a: string, b: string, move: ExchangeMove): string | null {
  return exchange(game, a, b, [move])
}

/** The move of baggage item `index` of row `row` to the other party. */
export function itemMove(row: 0 | 1, index: number, ids: readonly [string, string]): ExchangeMove {
  return { kind: 'item', from: ids[row], index }
}

/** The lines of a baggage list: each item's name, in order. */
export function baggageLines(party: Expedition): Array<{ id: string; name: string }> {
  return party.baggage.map((item) => ({ id: item.id, name: item.name }))
}

/** The small line under a hero's face. */
export function heroNote(hero: Character): string {
  return `Level ${hero.level}`
}
