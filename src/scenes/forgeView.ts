import { deriveCombatStats, type Character } from '../character/character.ts'
import { attributeLevel } from '../character/perks.ts'
import { describeCost } from '../game/buildings.ts'
import { FORGE_LEVEL, forgeOptions, temperCost, temperRefusal, type ForgeOption } from '../game/crafting.ts'
import type { Expedition } from '../game/expedition.ts'
import type { GameState } from '../game/gameState.ts'
import { itemAt, type ItemPlace } from '../game/itemPlace.ts'
import { materialName, type Material, type Stock } from '../game/territory.ts'
import { MATERIALS, type FamilyId } from '../inventory/catalog.ts'
import { GRADE_DEFS, type Grade } from '../inventory/grades.ts'
import { baseItem, craftedItem, itemById, type EquipmentSlot, type Item } from '../inventory/inventory.ts'
import { socketsOf } from '../inventory/runes.ts'
import { compareLines, statLines, TYPICAL_AP } from './gearCompare.ts'

/**
 * The crafting screen's Forge tab and its Temper options in words, Phaser-free:
 * the slot filter, the rows the workshop forges, the preview of one against what
 * a member wears, the temper choices of an item, and the victory screen's
 * trophies line. Every option, cost and refusal is crafting.ts's; this only words them.
 */

/** The slots the Forge tab filters by, in the order of its buttons (the slots the families fill). */
export const FORGE_SLOTS: readonly EquipmentSlot[] = ['mainHand', 'offHand', 'armor', 'head', 'gloves', 'boots']

export const FORGE_SLOT_LABELS: Partial<Record<EquipmentSlot, string>> = {
  mainHand: 'Weapon',
  offHand: 'Shield',
  armor: 'Armour',
  head: 'Head',
  gloves: 'Gloves',
  boots: 'Boots',
}

/** A line of the Forge tab's list: what is forged, in what, what it costs, and why it cannot be now. */
export interface ForgeRow {
  /** `<family>:<material>`, as the probe and the selection name it. */
  id: string
  family: FamilyId
  material: string
  tier: number
  /** The item's name: "Mithril Longsword". */
  name: string
  /** "30 gold, 8 mithril". */
  costText: string
  refusal: string | null
  item: Item
}

/** Families whose item names are plural: "The Adamant Gauntlets are". */
const PLURAL_FAMILIES: readonly FamilyId[] = ['gloves', 'gauntlets', 'boots', 'greaves']

/** What the forge says once the row's item is in the baggage. */
export const forgedMessage = (row: ForgeRow): string => `The ${row.name} ${PLURAL_FAMILIES.includes(row.family) ? 'are' : 'is'} in the baggage.`

export const forgeRowId = (family: string, material: string): string => `${family}:${material}`

/** The rows for `slot`: crafting.ts's forgeOptions, each worded. Empty below the first forging level. */
export function forgeRows(game: GameState, party: Expedition, slot: EquipmentSlot): ForgeRow[] {
  return forgeOptions(game, party, slot).map(
    ({ family, material, tier, item, cost, refusal }: ForgeOption): ForgeRow => ({
      id: forgeRowId(family, material),
      family,
      material,
      tier,
      name: item.name,
      costText: describeCost(cost),
      refusal,
      item,
    }),
  )
}

/** What the list says when the workshop forges nothing yet: the level that does and what it works. */
export function forgeHint(game: GameState): string {
  const first = Math.min(...Object.values(FORGE_LEVEL))
  const names = MATERIALS.filter((m) => m.tier === 3).map((m) => m.name.toLowerCase())
  const listed = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '')
  return game.world.workshop >= first ? 'Nothing to forge for this slot.' : `A level ${first} workshop forges ${listed}.`
}

/** The AP a member has and the strength they hold: what the comparison reads their gear by. */
export function memberNumbers(member: Character): { ap: number; strength: number } {
  return { ap: deriveCombatStats(member).actionPoints, strength: attributeLevel(member, 'strength') }
}

/**
 * What forging `row` gives against what `member` wears in its slot: the sockets it has, what is worn, the changes
 * (or its stats where the slot is empty), and the cost. The refusal is the scene's to add last.
 */
export function forgePreview(game: GameState, row: ForgeRow, member: Character): string[] {
  const { item } = row
  const { ap, strength } = memberNumbers(member)
  const worn = member.equipment[item.slot]
  const sockets = socketsOf(item)
  const best = socketsOf(itemById(`${item.id}@3`) ?? item)
  const stockId = MATERIALS.find((m) => m.id === row.material)!.stock as Material
  const held = game.world.stock[stockId] ?? 0
  const socketLine = sockets === 0 ? 'No sockets.' : `Sockets: ${sockets}${best > sockets ? `, ${best} at Masterwork` : ''}.`
  return [
    `Forges the ${item.name}, into the baggage.`,
    socketLine,
    worn ? `${member.name} wears the ${worn.name}:` : `${member.name} wears nothing there:`,
    ...(worn ? compareLines(worn, item, ap, strength) : statLines(item, ap, strength)),
    `The stock holds ${held} ${materialName(stockId)}.`,
    `Costs ${row.costText}.`,
  ]
}

/** One way to temper an item: to Fine or to Masterwork. */
export interface TemperChoice {
  grade: Grade
  /** `temper2`, `temper3`: beside the modifiers' `<modifier><grade>` ids. */
  id: string
  /** "Temper to Fine". */
  label: string
  cost: Stock
  /** The item once tempered, its modifier and runes kept. */
  result: Item
  refusal: string | null
}

export const temperId = (grade: Grade): string => `temper${grade}`

/** Whether the item at `place` has a temper row on the Modify tab: a plain tier-3+ item, whether or not any grade is left. Its options keep their places across a temper. */
export function hasTemperRow(game: GameState, place: ItemPlace): boolean {
  const item = itemAt(game, place)
  return !!item && !!baseItem(item) && (item.tier ?? 1) >= 3
}

/** The grades a tier-3+ plain item may be tempered to (those above its own), each with its cost and refusal; none for any other item. */
export function temperChoices(game: GameState, place: ItemPlace): TemperChoice[] {
  const item = itemAt(game, place)
  const base = item && baseItem(item)
  if (!item || !base || (item.tier ?? 1) < 3) return []
  return ([2, 3] as const)
    .filter((grade) => grade > (item.grade ?? 1))
    .map((grade) => ({
      grade,
      id: temperId(grade),
      label: `Temper to ${GRADE_DEFS[grade].prefix.trim()}`,
      cost: temperCost(item, grade),
      result: craftedItem(base, grade, item.mod, item.runes),
      refusal: temperRefusal(game, place, grade),
    }))
}

/** What tempering shows: the item it makes, what changes (the extra socket of Masterwork among it), what is kept and the cost. */
export function temperPreview(item: Item, choice: TemperChoice, ap = TYPICAL_AP, strength?: number): string[] {
  const grown = socketsOf(choice.result) - socketsOf(item)
  const kept = [item.mod ? 'modifier' : null, item.runes?.length ? 'runes' : null].filter((x) => x !== null)
  return [
    `Tempers it to the ${choice.result.name}.`,
    ...(grown > 0 ? [`Gains ${grown === 1 ? 'a socket' : `${grown} sockets`}: ${socketsOf(choice.result)} in all.`] : []),
    ...(kept.length ? [`Keeps its ${kept.join(' and ')}.`] : []),
    ...compareLines(item, choice.result, ap, strength),
    `Costs ${describeCost(choice.cost)}.`,
  ]
}

/** The victory screen's line for the trophies a battle's foes left, or null when none: "Trophies: 3 wyvern hide, 1 wolfhide.". */
export function trophiesLine(trophies: Stock): string | null {
  const parts = (Object.entries(trophies) as Array<[keyof Stock, number]>)
    .filter(([, amount]) => amount > 0)
    .map(([material, amount]) => `${amount} ${materialName(material)}`)
  return parts.length ? `Trophies: ${parts.join(', ')}.` : null
}
