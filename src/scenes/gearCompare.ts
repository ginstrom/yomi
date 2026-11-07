import { formatDamage } from '../combat/combat.ts'
import { gradeNumeral } from '../inventory/grades.ts'
import { SHORTFALL_TO_HIT, strengthShortfall, type Item, type ItemStats } from '../inventory/inventory.ts'
import { MODIFIER_IDS, MODIFIERS } from '../inventory/modifiers.ts'

/**
 * The trading post's and the crafting screen's words for an item's stats,
 * and for what a craft changes, attacks a turn included: with the AP its
 * holder has, an attack of fewer AP may buy a second blow, which is worth
 * more than the damage it gives up.
 */

/** The AP a hero has with no agility to speak of; what an item in the baggage is judged with. */
export const TYPICAL_AP = 8

/** How many attacks a turn the weapon gives a hero of `ap`, standing still; null for an item that is not a weapon. */
export function attacksPerTurn(stats: ItemStats | undefined, ap: number): number | null {
  if (!stats?.attackApCost) return null
  return Math.floor(ap / stats.attackApCost)
}

const attacks = (n: number) => `${n} ${n === 1 ? 'attack' : 'attacks'} a turn`
const signed = (n: number, unit = '') => `${n < 0 ? '−' : '+'}${Math.abs(n)}${unit}`

/** Each stat the screens show, as `[label, words]`, in a fixed order; a stat the item lacks is left out. */
function statWords(stats: ItemStats, ap: number, strength?: number): Array<[string, string]> {
  const words: Array<[string, string]> = []
  if (stats.damage) words.push(['Damage', formatDamage(stats.damage)])
  if (stats.attackApCost !== undefined) words.push(['Attack', `${stats.attackApCost} AP, ${attacks(attacksPerTurn(stats, ap)!)}`])
  if (stats.damage) words.push(['Range', `${stats.attackRange ?? 1} ${(stats.attackRange ?? 1) === 1 ? 'hex' : 'hexes'}${stats.reach ? ', reach' : ''}`])
  if (stats.armorPierce) words.push(['Pierces', `${stats.armorPierce} resistance${stats.rangedPierce ? ', even at range' : ''}`])
  if (stats.strength) {
    const short = strength === undefined ? 0 : strengthShortfall(strength, stats)
    words.push(['Strength', short > 0 ? `${stats.strength} (you have ${strength}): to hit ${signed(-SHORTFALL_TO_HIT * short, '%')}` : `${stats.strength}`])
  }
  if (stats.apPenalty) words.push(['AP', signed(-stats.apPenalty)])
  if (stats.acBonus) words.push(['Armor Class', signed(stats.acBonus)])
  if (stats.resistance) words.push(['Resistance', signed(stats.resistance)])
  if (stats.toHit) words.push(['To Hit', signed(stats.toHit, '%')])
  if (stats.spellSkill) words.push(['Spell Skill', signed(stats.spellSkill, '%')])
  if (stats.maxMana) words.push(['Mana', signed(stats.maxMana)])
  if (stats.critChance) words.push(['Critical', signed(stats.critChance, '%')])
  return words
}

/**
 * An item's stats as lines: "Damage: 1d8+3", "Attack: 5 AP, 1 attack a turn", ...;
 * with the `strength` of a known wearer, the strength line tells a shortfall's cost.
 */
export function statLines(item: Item, ap = TYPICAL_AP, strength?: number): string[] {
  return statWords(item.stats ?? {}, ap, strength).map(([label, words]) => `${label}: ${words}`)
}

/** An item's stats on one line, for a list: "1d8+3, 5 AP, pierces 1" or "AC +10, resists 2". */
export function statSummary(item: Item): string {
  const s = item.stats ?? {}
  const parts: string[] = []
  if (s.damage) parts.push(formatDamage(s.damage))
  if (s.attackApCost !== undefined) parts.push(`${s.attackApCost} AP`)
  if (s.attackRange !== undefined) parts.push(`${s.reach ? 'reach' : 'range'} ${s.attackRange}`)
  if (s.armorPierce) parts.push(`pierces ${s.armorPierce}`)
  if (s.acBonus) parts.push(`AC ${signed(s.acBonus)}`)
  if (s.resistance) parts.push(`resists ${s.resistance}`)
  if (s.strength) parts.push(`str ${s.strength}`)
  if (s.apPenalty) parts.push(`AP ${signed(-s.apPenalty)}`)
  if (s.toHit) parts.push(`hit ${signed(s.toHit, '%')}`)
  if (s.spellSkill) parts.push(`spell ${signed(s.spellSkill, '%')}`)
  if (s.maxMana) parts.push(`mana ${signed(s.maxMana)}`)
  if (s.critChance) parts.push(`crit ${signed(s.critChance, '%')}`)
  return parts.join(', ')
}

/**
 * What changes from `before` to `after`, a line a stat: "Damage: 1d8+3 → 1d8+2",
 * "Attack: 5 AP, 1 attack a turn → 4 AP, 2 attacks a turn"; a stat both have
 * alike is left out.
 */
export function compareLines(before: Item, after: Item, ap = TYPICAL_AP, strength?: number): string[] {
  const was = new Map(statWords(before.stats ?? {}, ap, strength))
  const now = new Map(statWords(after.stats ?? {}, ap, strength))
  const labels = [...new Set([...was.keys(), ...now.keys()])]
  return labels
    .filter((label) => was.get(label) !== now.get(label))
    .map((label) => `${label}: ${was.get(label) ?? 'none'} → ${now.get(label) ?? 'none'}`)
}

/** The crafting screen's line on what the field makes: the modifiers that need no workshop, at grade I, a day each. */
export function fieldCraftSummary(): string {
  const names = MODIFIER_IDS.map((id) => MODIFIERS[id]).filter((mod) => mod.unlock === 0).map((mod) => mod.name)
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('')
  return `In the field: ${list} at grade ${gradeNumeral(1)}, a day each.`
}
