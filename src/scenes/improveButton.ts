import { describeCost, improvementSite, improveSiteRefusal, lodgeNeeded, nextImprovement } from '../game/buildings.ts'
import type { Expedition } from '../game/expedition.ts'
import { withArticle } from '../game/territory.ts'
import type { WorldState } from '../game/worldMap.ts'

/**
 * The Improve button's text, or null where there is no button (the place
 * refuses: not a held resource, among monsters, a fort already). With the
 * Lodge too low it says so ("A Mine needs the Builders' Lodge"); else it
 * names the next level and its cost ("Build a Mine: 30 gold, 15 stone").
 * `compact` drops the cost and shortens the Lodge's words, for a footer too
 * narrow for the whole.
 */
export function improveLabel(world: WorldState, party: Expedition, compact = false): string | null {
  if (improveSiteRefusal(world, party) !== null) return null
  const next = nextImprovement(world, improvementSite(world, party)!)!
  if (world.lodge < next.lodge) return lodgeNeeded(next, compact)
  const building = withArticle(next.name)
  return compact ? `Build ${building}` : `Build ${building}: ${describeCost(next.cost)}`
}
