import { SHRINE_STRENGTH } from './blight.ts'
import { MAX_SHRINE_LEVEL, atEncampment, canAfford, describeCost, raiseShrine, shrineCost } from './buildings.ts'
import { leader, type GameState } from './gameState.ts'
import { GUILD_HALL_LEVELS, MAX_GUILD_HALL_LEVEL, upgradeCost, upgradeGuildHall } from './guildHall.ts'
import { MAX_WORKSHOP_LEVEL, upgradeWorkshop, workshopCost } from './crafting.ts'
import { MAX_INFIRMARY_LEVEL, infirmaryCost, infirmaryEffect, raiseInfirmary } from './infirmary.ts'
import type { Stock } from './territory.ts'
import { MAX_TRADING_POST_LEVEL, RUNE_RANK_LEVELS, raiseTradingPost, tradingPostCost } from './tradingPost.ts'
import { encampmentName } from './worldMap.ts'

/**
 * The encampment as the party finds it when it goes in: the facilities built
 * there, each at its level, and what raising each would cost and bring. The
 * encampment screen draws one building for each facility, or an empty plot for
 * one not built yet, from this list alone, so a new facility needs an entry in
 * `FACILITIES` and a sprite. Each facility's own rules stay in its module
 * (guildHall.ts, buildings.ts, tradingPost.ts, crafting.ts, infirmary.ts);
 * this only reads them and calls them.
 */

export type FacilityId = 'guild_hall' | 'shrine' | 'trading_post' | 'workshop' | 'infirmary'

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
  /** Whether the facility has a screen of its own to open (the guild hall's roster), which it has once built. */
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
    improve: (game) => raiseShrine(game.world, leader(game)),
    opens: false,
  },
  {
    id: 'trading_post',
    name: 'Trading Post',
    maxLevel: MAX_TRADING_POST_LEVEL,
    level: (game) => game.world.tradingPost,
    about: () => 'Merchants sell plain gear and runes for gold and buy what the party no longer needs.',
    effect: (_, level) => {
      const gear = level >= 4 ? 'plain, Fine and Masterwork gear, in iron and steel' : `${['plain', 'plain and Fine', 'plain, Fine and Masterwork'][level - 1]} gear`
      // The runes it sells (RUNE_RANK_LEVELS): Lesser from level 2, the rank above from level 4.
      const runes = level >= RUNE_RANK_LEVELS[2]! ? ', and runes of the first two ranks' : level >= RUNE_RANK_LEVELS[1]! ? ', and Lesser runes' : ''
      return `Sells ${gear}${runes}.`
    },
    cost: (game) => tradingPostCost(game.world),
    improve: raiseTradingPost,
    opens: true,
  },
  {
    id: 'workshop',
    name: 'Workshop',
    maxLevel: MAX_WORKSHOP_LEVEL,
    level: (game) => game.world.workshop,
    about: () => 'Smiths and bowyers rework gear, trading one strength of an item for another.',
    effect: (_, level) =>
      [
        'Makes the field modifiers, and Bearded, Keen and Braced, at grade 1. Sets runes, and fuses three Lesser runes into one.',
        'Makes Light, Long and Reinforced too, at up to grade 2. Takes runes out again, for a fee.',
        'Makes every modifier at up to grade 3.',
      ][level - 1],
    cost: (game) => workshopCost(game.world),
    improve: upgradeWorkshop,
    opens: true,
  },
  {
    id: 'infirmary',
    name: 'Infirmary',
    maxLevel: MAX_INFIRMARY_LEVEL,
    level: (game) => game.world.infirmary,
    about: (game) => `Healers tend the wounded who rest at ${encampmentName(game.world)}.`,
    effect: (game, level) => infirmaryEffect(level, encampmentName(game.world)),
    cost: (game) => infirmaryCost(game.world),
    improve: raiseInfirmary,
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
      opens: facility.opens && level > 0,
    }
  })
}

/** Builds the facility, or raises it a level, for the stock; returns why it cannot, or null when done. */
export function improveFacility(game: GameState, id: FacilityId): string | null {
  const facility = FACILITIES.find((f) => f.id === id)
  if (!facility) return 'There is no such facility.'
  return facility.improve(game)
}

/** Sets a facility's level outright, for the debug console; the caller keeps it within the facility's levels. */
export function setFacilityLevel(game: GameState, id: FacilityId, level: number): void {
  const field = { guild_hall: 'guildHall', shrine: 'shrine', trading_post: 'tradingPost', workshop: 'workshop', infirmary: 'infirmary' } as const
  game.world[field[id]] = level
}

function improveRefusal(game: GameState, cost: Stock | null): string | null {
  if (!atEncampment(game.world, leader(game))) return `The party is not at ${encampmentName(game.world)}.`
  if (cost && !canAfford(game.world.stock, cost)) return `It costs ${describeCost(cost)}, more than the stock holds.`
  return null
}

function lowerFirst(words: string): string {
  return words.charAt(0).toLowerCase() + words.slice(1)
}
