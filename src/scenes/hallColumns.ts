import type { Character } from '../character/character.ts'
import { exchange, moveHero, type HeroRef } from '../game/company.ts'
import type { GameState } from '../game/gameState.ts'
import { homeParties, swap } from '../game/guildHall.ts'
import { partyById } from '../game/gameState.ts'

/**
 * The Guild Hall's columns, free of Phaser: one for each party at home and one
 * for the reserves, and what a pick and a click ask of the company's functions.
 */

/** A column: a party at home (its id), or the reserves (`party` null). */
export interface HallColumn {
  party: string | null
  name: string
  heroes: Character[]
}

export const RESERVES_NAME = 'Reserves'

export function hallColumns(game: GameState): HallColumn[] {
  return [
    ...homeParties(game).map((party) => ({ party: party.id, name: party.name, heroes: party.members })),
    { party: null, name: RESERVES_NAME, heroes: game.reserves },
  ]
}

export interface HallPick {
  party: string | null
  index: number
}
export interface HallClick {
  party: string | null
  /** The hero clicked; absent for a column's header, which takes the picked hero in. */
  index?: number
}

export const refOf = (pick: HallPick): HeroRef => (pick.party === null ? { from: 'reserves', index: pick.index } : { from: 'party', party: pick.party, index: pick.index })

/**
 * What a click does with `pick` picked: a hero clicked in another column swaps with it, a header moves it in.
 * Returns the refusal, or null when done. A click in the pick's own column is the scene's (it only changes the pick).
 */
export function hallAct(game: GameState, pick: HallPick, click: HallClick): string | null {
  if (pick.party === click.party) return null
  if (click.index === undefined) return moveHero(game, refOf(pick), click.party === null ? 'reserves' : { party: click.party })
  if (pick.party !== null && click.party !== null) return exchange(game, pick.party, click.party, [{ kind: 'swap', a: pick.index, b: click.index }])
  const [partyId, member, reserve] = pick.party === null ? [click.party!, click.index, pick.index] : [pick.party, pick.index, click.index]
  const party = partyById(game, partyId)
  return party ? swap(game, party, member, reserve) : `No party "${partyId}".`
}
