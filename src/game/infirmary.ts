import { maxHp, type Character } from '../character/character.ts'
import { atEncampment, canAfford, describeCost, spend } from './buildings.ts'
import type { GameState } from './gameState.ts'
import type { Stock } from './territory.ts'
import { encampmentName, type WorldState } from './worldMap.ts'

/**
 * The infirmary at the encampment (docs/designs/expeditions-and-encampment.md
 * §4.4): what a day's camping heals. Level 1 heals a third of each member's
 * hit points a day at the encampment, level 2 all of them, and level 3 adds
 * field dressings, `FIELD_DRESSING_PER_DAY` a day anywhere else. It raises no
 * one from the dead, and mana fills as ever.
 */

/** What a day's rest heals each member without an infirmary's help. */
export const NATURAL_HEALING_PER_DAY = 1
/** What a day's rest heals away from the encampment once the infirmary reaches its top level. */
export const FIELD_DRESSING_PER_DAY = 3

/** What building the infirmary and raising it to each level costs. */
export const INFIRMARY_COSTS: readonly Stock[] = [
  { gold: 20, timber: 10 },
  { gold: 40, peat: 15 },
  { gold: 60, salt: 20 },
]
export const MAX_INFIRMARY_LEVEL = INFIRMARY_COSTS.length

export function infirmaryCost(world: WorldState): Stock | null {
  return world.infirmary < MAX_INFIRMARY_LEVEL ? INFIRMARY_COSTS[world.infirmary] : null
}

/** Builds the infirmary or raises it a level, at once; returns why it cannot, or null when done. */
export function raiseInfirmary(game: GameState): string | null {
  const { world } = game
  if (!atEncampment(world)) return `The infirmary is at ${encampmentName(world)}.`
  const cost = infirmaryCost(world)
  if (!cost) return 'The infirmary is as great as it gets.'
  if (!canAfford(world.stock, cost)) return `The next level costs ${describeCost(cost)}, more than the stock holds.`
  spend(world.stock, cost)
  world.infirmary += 1
  return null
}

/** What the infirmary does at `level`, in words. */
export function infirmaryEffect(level: number, home: string): string {
  if (level <= 1) return `A day camped at ${home} heals each member a third of their hit points.`
  if (level === 2) return `A day camped at ${home} heals every member fully.`
  return `A day camped at ${home} heals fully, and elsewhere field dressings heal ${FIELD_DRESSING_PER_DAY} a day.`
}

/** What a day's camping where the party stands heals `member`, before its maximum caps it. */
export function restHealing(world: WorldState, member: Character): number {
  if (atEncampment(world)) {
    if (world.infirmary >= 2) return maxHp(member)
    if (world.infirmary === 1) return Math.ceil(maxHp(member) / 3)
  } else if (world.infirmary >= 3) {
    return FIELD_DRESSING_PER_DAY
  }
  return NATURAL_HEALING_PER_DAY
}
