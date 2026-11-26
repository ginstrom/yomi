import { FAMILIES, MATERIALS, familyById, type FamilyDef, type FamilyId, type MaterialDef } from '../inventory/catalog.ts'
import { GRADES, GRADE_DEFS, type Grade } from '../inventory/grades.ts'
import { baseItem, craftedItem, itemById, type EquipmentSlot, type Item } from '../inventory/inventory.ts'
import { MODIFIERS, modifiersFor, type Modifier, type ModifierId } from '../inventory/modifiers.ts'
import type { WorldEvent } from './blight.ts'
import { atEncampment, canAfford, describeCost, spend } from './buildings.ts'
import { canCamp } from './camp.ts'
import { act } from './company.ts'
import type { Expedition } from './expedition.ts'
import { partyById, type GameState } from './gameState.ts'
import { STALE, allPlaces, itemAt, replaceAt, type ItemPlace } from './itemPlace.ts'
import type { Material, Stock } from './territory.ts'
import { encampmentName, type WorldState } from './worldMap.ts'

/**
 * Crafting (docs/designs/expeditions-and-encampment.md §4.3): putting a
 * modifier, at a grade, on a plain item. In the field, anywhere the party may
 * camp, it makes the field modifiers at grade 1 and takes a day; at the
 * encampment's workshop it takes no time, and the workshop's level decides
 * which modifiers it makes and the highest grade. An item already modified
 * loses its modifier for the new one, at the new one's full cost.
 *
 * From level 4 the workshop also forges tiers 3 to 5 from gold and the tier's
 * ore, wood or trophy, and from level 3 tempers them to Fine and Masterwork
 * (docs/designs/long-campaign/stage-10-forging-and-high-tiers.md; gear-and-runes
 * §4.3, §5.4): the trading post sells only tiers 1 and 2 and their grades.
 */

/** What building the workshop and raising it to each level costs. */
export const WORKSHOP_COSTS: readonly Stock[] = [
  { gold: 25, iron: 15 },
  { gold: 40, stone: 15 },
  { gold: 60, crystal: 10 },
  { gold: 100, mithril: 20 },
  { gold: 150, adamant: 20 },
  { gold: 200, starmetal: 10 },
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
/** The highest grade of modifier made here: the workshop's level, the field's 1, never above 3 (levels 4 to 6 make grade 3). */
export const highestGrade = (tier: CraftTier): Grade => Math.min(3, Math.max(1, tierLevel(tier))) as Grade

/** The stock material a tier-3+ catalog material spends, from its `MaterialDef.stock`. */
export const stockOf = (material: MaterialDef): Material => material.stock!
const materialDef = (id: string | undefined): MaterialDef | undefined => MATERIALS.find((m) => m.id === id)

/**
 * What putting a modifier on `item` at `grade` costs: gold, and timber for a
 * wood family or iron for any other at grade 1, copper at 2, crystal at 3; a
 * tier-3+ item asks 5 of its tier's stock material in their place.
 */
export function craftCost(item: Item, grade: Grade): Stock {
  const high = materialDef(item.material)
  if (high?.stock) return { gold: grade === 3 ? 20 : grade === 2 ? 10 : 5, [stockOf(high)]: 5 }
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

/** Every item `party` has that crafting could work, member by member (worn, then carried), then the baggage's, a tier-3+ plain item always (it can be tempered); one with no temper path left and no modifier that fits here says why. */
export function craftables(game: GameState, party: Expedition): Array<{ place: ItemPlace; item: Item; refusal: string | null }> {
  const tier = craftTier(game.world, party)
  return allPlaces(game, party)
    .filter(({ item }) => baseItem(item) && (modifiersFor(baseItem(item)!.family!).length > 0 || (item.tier ?? 1) >= 3))
    .map(({ place, item }) => ({ place, item, refusal: hasTemperPath(item) ? null : itemRefusal(item, tier) }))
}

/** Whether tempering still has a grade to offer `item`: a plain tier-3+ item below Masterwork. Such an item is never greyed in the list. */
const hasTemperPath = (item: Item): boolean => baseItem(item) !== undefined && isHighTier(item.tier) && (item.grade ?? 1) < 3

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

// Forging and tempering (stage 10): tiers 3 to 5, at the encampment's workshop, with no time passing.

export type HighTier = 3 | 4 | 5
/** The workshop level that forges each tier. */
export const FORGE_LEVEL: Record<HighTier, number> = { 3: 4, 4: 5, 5: 6 }
/** What forging an item of each tier costs in gold. */
export const FORGE_GOLD: Record<HighTier, number> = { 3: 30, 4: 50, 5: 80 }
/** What forging an item of each tier costs in its stock material; doubled for a two-handed family and for plate. */
export const FORGE_MATERIAL: Record<HighTier, number> = { 3: 8, 4: 10, 5: 12 }
/** The workshop level that tempers a tier-3+ item. */
export const TEMPER_LEVEL = 3

const isHighTier = (tier: number | undefined): tier is HighTier => tier !== undefined && tier >= 3
const isHeavy = (family: FamilyDef): boolean => family.stats.twoHanded === true || family.id === 'plate'

/** What forging `family` in the tier-3+ catalog `material` costs (assumes a tier-3+ material: callers check `forgeRefusal` first): the tier's gold and stock material, doubled for a two-handed family or plate. */
export function forgeCost(family: FamilyId, material: string): Stock {
  const def = materialDef(material)!
  const tier = def.tier as HighTier
  return { gold: FORGE_GOLD[tier], [stockOf(def)]: FORGE_MATERIAL[tier] * (isHeavy(familyById(family)) ? 2 : 1) }
}

/** One item the workshop forges at its level: its family, material, tier, the plain item, its cost and why it cannot be forged now, or null. */
export interface ForgeOption {
  family: FamilyId
  material: string
  tier: HighTier
  item: Item
  cost: Stock
  refusal: string | null
}

/** Every item the workshop's level forges, of `slot` if given: in `FAMILIES` order, each in its kind's tier-3+ materials in `MATERIALS` order; none below level 4. */
export function forgeOptions(game: GameState, party: Expedition, slot?: EquipmentSlot): ForgeOption[] {
  return FAMILIES.filter((family) => !slot || family.slot === slot).flatMap((family) =>
    MATERIALS.filter((m) => m.kind === family.kind && isHighTier(m.tier) && FORGE_LEVEL[m.tier as HighTier] <= game.world.workshop).map((m) => ({
      family: family.id,
      material: m.id,
      tier: m.tier as HighTier,
      item: itemById(`${m.id}_${family.id}`)!,
      cost: forgeCost(family.id, m.id),
      refusal: forgeRefusal(game, party, family.id, m.id),
    })),
  )
}

/** Why `family` in `material` cannot be forged where the party stands, or null when it can. */
export function forgeRefusal(game: GameState, party: Expedition, family: FamilyId, material: string): string | null {
  const { world } = game
  if (!atEncampment(world, party)) return notHere(world)
  const familyDef = FAMILIES.find((f) => f.id === family)
  const def = materialDef(material)
  if (!familyDef || !def) return 'The workshop forges no such thing.'
  if (def.kind !== familyDef.kind) return `A ${familyDef.name} is not made of ${def.name}.`
  if (!isHighTier(def.tier)) return 'The trading post sells tiers 1 and 2.'
  if (world.workshop < FORGE_LEVEL[def.tier]) return `Forging ${def.name} needs a level ${FORGE_LEVEL[def.tier]} workshop.`
  const cost = forgeCost(family, material)
  return canAfford(world.stock, cost) ? null : `It costs ${describeCost(cost)}, more than the stock holds.`
}

/** Forges `family` in `material` into the party's baggage, spending the cost, with no time passing; returns why it cannot, or null when done. */
export function forge(game: GameState, party: Expedition, family: FamilyId, material: string): string | null {
  const refusal = forgeRefusal(game, party, family, material)
  if (refusal) return refusal
  spend(game.world.stock, forgeCost(family, material))
  party.baggage.push(itemById(`${material}_${family}`)!)
  return null
}

/** What tempering the tier-3+ `item` to `grade` costs (assumes a tier-3+ item: callers check `temperRefusal` first): gold tier × 10 × grade and 4 × grade of its tier's stock material. */
export function temperCost(item: Item, grade: Grade): Stock {
  const def = materialDef(item.material)!
  return { gold: def.tier * 10 * grade, [stockOf(def)]: 4 * grade }
}

/** Why the item at `place` cannot be tempered to `grade`, or null when it can. */
export function temperRefusal(game: GameState, place: ItemPlace, grade: Grade): string | null {
  const { world } = game
  const item = itemAt(game, place)
  if (!item) return STALE
  if (!atEncampment(world, partyById(game, place.party)!)) return notHere(world)
  if (world.workshop < TEMPER_LEVEL) return `Tempering needs a level ${TEMPER_LEVEL} workshop.`
  if (!baseItem(item)) return 'An enchanted item cannot be worked.'
  if (!isHighTier(item.tier)) return 'The trading post sells the grades of tiers 1 and 2.'
  const current = item.grade ?? 1
  if (grade <= current) return `${baseItem(item)!.name} is ${GRADE_DEFS[current].prefix.trim() || 'plain'} already.`
  const cost = temperCost(item, grade)
  return canAfford(world.stock, cost) ? null : `It costs ${describeCost(cost)}, more than the stock holds.`
}

/** Tempers the item at `place` straight to `grade`, keeping its modifier and runes, in its place, with no time passing; returns why it cannot, or null when done. */
export function temper(game: GameState, place: ItemPlace, grade: Grade): string | null {
  const refusal = temperRefusal(game, place, grade)
  if (refusal) return refusal
  const item = itemAt(game, place)!
  spend(game.world.stock, temperCost(item, grade))
  replaceAt(game, place, craftedItem(baseItem(item)!, grade, item.mod, item.runes))
  return null
}

/** What a forged item is worth: 1.5 × (its forge gold + the temper gold of its grade), the material not counted; 0 below tier 3. */
export function forgedValue(item: Item): number {
  if (!isHighTier(item.tier)) return 0
  const grade = item.grade ?? 1
  return 1.5 * (FORGE_GOLD[item.tier] + (grade > 1 ? temperCost(item, grade).gold! : 0))
}
