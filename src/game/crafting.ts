import { familyById } from '../inventory/catalog.ts'
import { GRADES, type Grade } from '../inventory/grades.ts'
import { baseItem, craftedItem, type Item } from '../inventory/inventory.ts'
import { MODIFIERS, modifiersFor, type Modifier, type ModifierId } from '../inventory/modifiers.ts'
import type { WorldEvent } from './blight.ts'
import { atEncampment, canAfford, describeCost, spend } from './buildings.ts'
import { canCamp } from './camp.ts'
import { act } from './company.ts'
import type { Expedition } from './expedition.ts'
import { partyById, type GameState } from './gameState.ts'
import { STALE, allPlaces, itemAt, replaceAt, type ItemPlace } from './itemPlace.ts'
import type { Stock } from './territory.ts'
import { encampmentName, type WorldState } from './worldMap.ts'

/**
 * Crafting (docs/designs/expeditions-and-encampment.md §4.3): putting a
 * modifier, at a grade, on a plain item. In the field, anywhere the party may
 * camp, it makes the field modifiers at grade 1 and takes a day; at the
 * encampment's workshop it takes no time, and the workshop's level decides
 * which modifiers it makes and the highest grade. An item already modified
 * loses its modifier for the new one, at the new one's full cost.
 */

/** What building the workshop and raising it to each level costs. */
export const WORKSHOP_COSTS: readonly Stock[] = [
  { gold: 25, iron: 15 },
  { gold: 40, stone: 15 },
  { gold: 60, crystal: 10 },
]
export const MAX_WORKSHOP_LEVEL = WORKSHOP_COSTS.length

/** Where crafting happens: in the field, or at the workshop of its level. */
export type CraftTier = 'field' | number

const notHere = (world: WorldState): string => `The workshop is at ${encampmentName(world)}.`

export function workshopCost(world: WorldState): Stock | null {
  return world.workshop < MAX_WORKSHOP_LEVEL ? WORKSHOP_COSTS[world.workshop] : null
}

/** Builds the workshop or raises it a level, at once; returns why it cannot, or null when done. */
export function upgradeWorkshop(game: GameState, party: Expedition): string | null {
  const { world } = game
  if (!atEncampment(world, party)) return notHere(world)
  const cost = workshopCost(world)
  if (!cost) return 'The workshop is as great as it gets.'
  if (!canAfford(world.stock, cost)) return `The next level costs ${describeCost(cost)}, more than the stock holds.`
  spend(world.stock, cost)
  world.workshop += 1
  return null
}

/** The workshop, where the party stands at the encampment with one built; else the field. */
export function craftTier(world: WorldState, party: Expedition): CraftTier {
  return atEncampment(world, party) && world.workshop > 0 ? world.workshop : 'field'
}

/** The tier's level: the field's is 0, and it makes grade 1 like the first workshop. */
const tierLevel = (tier: CraftTier): number => (tier === 'field' ? 0 : tier)
export const highestGrade = (tier: CraftTier): Grade => Math.max(1, tierLevel(tier)) as Grade

/** What putting a modifier on `item` at `grade` costs: gold, and timber for a wood family or iron for any other at grade 1, copper at 2, crystal at 3. */
export function craftCost(item: Item, grade: Grade): Stock {
  if (grade === 3) return { gold: 20, crystal: 5 }
  if (grade === 2) return { gold: 10, copper: 5 }
  const family = baseItem(item)?.family
  return family && familyById(family).kind === 'wood' ? { gold: 5, timber: 5 } : { gold: 5, iron: 5 }
}

/** One modifier at one grade that can be put on an item here: what it costs, what the item becomes, and why it cannot be done now, or null. */
export interface CraftOption {
  modifier: Modifier
  grade: Grade
  cost: Stock
  result: Item
  refusal: string | null
}

/** Why no modifier can be made here on `item` at all (enchanted, none fits, none unlocked), or null. */
export function itemRefusal(item: Item, tier: CraftTier): string | null {
  const base = baseItem(item)
  if (!base) return 'An enchanted item cannot be worked.'
  const fitting = modifiersFor(base.family!)
  if (fitting.length === 0) return 'No modifier fits it.'
  if (!fitting.some((mod) => mod.unlock <= tierLevel(tier))) {
    return `Needs a level ${Math.min(...fitting.map((mod) => mod.unlock))} workshop.`
  }
  return null
}

/** Every item `party` has that crafting could work, member by member (worn, then carried), then the baggage's; one no modifier here fits says why. */
export function craftables(game: GameState, party: Expedition): Array<{ place: ItemPlace; item: Item; refusal: string | null }> {
  const tier = craftTier(game.world, party)
  return allPlaces(game, party)
    .filter(({ item }) => baseItem(item) && modifiersFor(baseItem(item)!.family!).length > 0)
    .map(({ place, item }) => ({ place, item, refusal: itemRefusal(item, tier) }))
}

/** Why crafting cannot be done where the party stands, or null. */
function placeRefusal(game: GameState, party: Expedition, tier: CraftTier): string | null {
  return tier === 'field' && !canCamp(game.world, party) ? 'Nothing can be crafted here now.' : null
}

/** Every modifier unlocked here that fits the item at `place`, at every grade allowed here; empty for a stale place. */
export function options(game: GameState, place: ItemPlace): CraftOption[] {
  const item = itemAt(game, place)
  const base = item && baseItem(item)
  if (!item || !base) return []
  const party = partyById(game, place.party)!
  const tier = craftTier(game.world, party)
  const where = placeRefusal(game, party, tier)
  return modifiersFor(base.family!)
    .filter((mod) => mod.unlock <= tierLevel(tier))
    .flatMap((modifier) =>
      GRADES.filter((grade) => grade <= highestGrade(tier)).map((grade) => {
        const cost = craftCost(item, grade)
        const afford = canAfford(game.world.stock, cost) ? null : `It costs ${describeCost(cost)}, more than the stock holds.`
        return { modifier, grade, cost, result: craftedItem(base, item.grade ?? 1, { id: modifier.id, grade }, item.runes), refusal: where ?? afford }
      }),
    )
}

export type CraftResult = { refusal: string } | { refusal: null; item: Item; events: WorldEvent[] }

/** Why `modifier` at `grade` cannot be put on the item at `place` where its party stands, or null when it can. */
export function craftRefusal(game: GameState, place: ItemPlace, modifier: ModifierId, grade: Grade): string | null {
  const item = itemAt(game, place)
  if (!item) return STALE
  const party = partyById(game, place.party)!
  const tier = craftTier(game.world, party)
  const refusal = placeRefusal(game, party, tier) ?? itemRefusal(item, tier)
  if (refusal) return refusal
  const option = craftOption(game, place, modifier, grade)
  if (!option) {
    const mod = MODIFIERS[modifier]
    if (!mod || !mod.fits.includes(baseItem(item)!.family!)) return `${mod?.name ?? 'That modifier'} does not fit it.`
    if (mod.unlock > tierLevel(tier)) return `${mod.name} needs a level ${mod.unlock} workshop.`
    return tier === 'field' ? 'The field makes grade 1 only.' : `A level ${tier} workshop makes up to grade ${highestGrade(tier)}.`
  }
  return option.refusal
}

const craftOption = (game: GameState, place: ItemPlace, modifier: ModifierId, grade: Grade): CraftOption | undefined =>
  options(game, place).find((o) => o.modifier.id === modifier && o.grade === grade)

/**
 * Puts `modifier` at `grade` on the item at `place`, with no time passing:
 * spends the stock and leaves the new item where the old one was. Assumes
 * `craftRefusal` said null. Returns the new item.
 */
export function applyCraft(game: GameState, place: ItemPlace, modifier: ModifierId, grade: Grade): Item {
  const option = craftOption(game, place, modifier, grade)!
  spend(game.world.stock, option.cost)
  replaceAt(game, place, option.result)
  return option.result
}

/**
 * Puts `modifier` at `grade` on the item at `place`, spending the stock and
 * leaving the new item where the old one was. At the workshop no time passes;
 * in the field it is a one-day order on the day loop (`act`), and the day's
 * events come back for the scene to report.
 */
export function craft(game: GameState, place: ItemPlace, modifier: ModifierId, grade: Grade): CraftResult {
  const refusal = craftRefusal(game, place, modifier, grade)
  if (refusal) return { refusal }
  if (craftTier(game.world, partyById(game, place.party)!) !== 'field') {
    return { refusal: null, item: applyCraft(game, place, modifier, grade), events: [] }
  }
  const report = act(game, place.party, { kind: 'craft', place, modifier, grade })
  if (typeof report === 'string') return { refusal: report }
  const made = report.parties.find((day) => day.party === place.party)!.made!
  return { refusal: null, item: made, events: report.events }
}
