import { SHRINE_STRENGTH } from './blight.ts'
import { MAX_SHRINE_LEVEL, atEncampment, canAfford, describeCost, raiseShrine, shrineCost } from './buildings.ts'
import type { GameState } from './gameState.ts'
import { GUILD_HALL_LEVELS, MAX_GUILD_HALL_LEVEL, upgradeCost, upgradeGuildHall } from './guildHall.ts'
import type { Stock } from './territory.ts'
import { encampmentName } from './worldMap.ts'

/**
 * The encampment as the party finds it when it goes in: the facilities built
 * there, each at its level, and what raising each would cost and bring. The
 * encampment screen draws one building for each facility, or an empty plot for
 * one not built yet, from this list alone, so a new facility needs an entry in
 * `FACILITIES` and a sprite. Each facility's own rules stay in its module
 * (guildHall.ts, buildings.ts); this only reads them and calls them.
 */

export type FacilityId = 'guild_hall' | 'shrine'

/** What the encampment screen shows of a facility. */
export interface FacilityView {
  id: FacilityId
  name: string
  /** 0 while it is not built, else 1 to `maxLevel`. */
  level: number
  maxLevel: number
  /** A line on what the facility is for. */
  about: string
  /** What it does at its level now, or what it would do once built. */
  effect: string
  /** What the next level brings, or null at the top level. */
  next: string | null
  /** What the next level costs, or null at the top level. */
  cost: Stock | null
  /** The words of the button that buys the next level: Build at level 0, else Raise. */
  action: string | null
  /** Why the next level cannot be bought now, or null when it can (or there is none). */
  refusal: string | null
  /** Whether the facility has a screen of its own to open (the guild hall's roster). */
  opens: boolean
}

interface Facility {
  id: FacilityId
  name: string
  maxLevel: number
  /** Built from the start, as the guild hall is, or only once the stock pays for it. */
  level: (game: GameState) => number
  about: (game: GameState) => string
  /** What the facility does at `level` (1 and up). */
  effect: (game: GameState, level: number) => string
  cost: (game: GameState) => Stock | null
  /** Buys the next level; returns why it cannot, or null when done. */
  improve: (game: GameState) => string | null
  opens: boolean
}

const FACILITIES: readonly Facility[] = [
  {
    id: 'guild_hall',
    name: 'Guild Hall',
    maxLevel: MAX_GUILD_HALL_LEVEL,
    level: (game) => game.world.guildHall,
    about: () => 'Heroes gather here: the reserves wait, recruits are hired, and the party is chosen.',
    effect: (_, level) => `A party of up to ${GUILD_HALL_LEVELS[level - 1].partyLimit}; recruits join at up to level ${level}.`,
    cost: (game) => upgradeCost(game.world),
    improve: upgradeGuildHall,
    opens: true,
  },
  {
    id: 'shrine',
    name: 'Shrine',
    maxLevel: MAX_SHRINE_LEVEL,
    level: (game) => game.world.shrine,
    about: (game) => `A holy place whose wards help ${encampmentName(game.world)} hold its land against the blight.`,
    effect: (game, level) => `${encampmentName(game.world)} pushes back the blight with ${SHRINE_STRENGTH * level} more strength.`,
    cost: (game) => shrineCost(game.world),
    improve: (game) => raiseShrine(game.world),
    opens: false,
  },
]

/** Every facility of the encampment, built or not, in the order the screen lays them out. */
export function facilities(game: GameState): FacilityView[] {
  return FACILITIES.map((facility) => {
    const level = facility.level(game)
    const cost = facility.cost(game)
    const top = level >= facility.maxLevel
    return {
      id: facility.id,
      name: facility.name,
      level,
      maxLevel: facility.maxLevel,
      about: facility.about(game),
      effect: level > 0 ? facility.effect(game, level) : `Not built. Once built: ${lowerFirst(facility.effect(game, 1))}`,
      next: top ? null : facility.effect(game, level + 1),
      cost: top ? null : cost,
      action: top ? null : level === 0 ? 'Build' : `Raise to level ${level + 1}`,
      refusal: top ? null : improveRefusal(game, cost),
      opens: facility.opens,
    }
  })
}

/** Builds the facility, or raises it a level, for the stock; returns why it cannot, or null when done. */
export function improveFacility(game: GameState, id: FacilityId): string | null {
  const facility = FACILITIES.find((f) => f.id === id)
  if (!facility) return 'There is no such facility.'
  return facility.improve(game)
}

function improveRefusal(game: GameState, cost: Stock | null): string | null {
  if (!atEncampment(game.world)) return `The party is not at ${encampmentName(game.world)}.`
  if (cost && !canAfford(game.world.stock, cost)) return `It costs ${describeCost(cost)}, more than the stock holds.`
  return null
}

function lowerFirst(words: string): string {
  return words.charAt(0).toLowerCase() + words.slice(1)
}
