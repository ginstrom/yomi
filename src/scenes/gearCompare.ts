import { ELEMENTS, formatDamage, type Element, type OnHit } from '../combat/combat.ts'
import { STATUSES } from '../combat/spells.ts'
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
  const wards = wardWords(stats.wards)
  if (wards) words.push(['Wards', wards])
  if (stats.maxHp) words.push(['Max HP', signed(stats.maxHp)])
  // Every entry (a rune's each) on one line, so that a rune set or taken out changes that one line.
  if (stats.onHit?.length) words.push(['On a hit', stats.onHit.map(onHitWords).join('; ')])
  return words
}

/** The wards above 0 in element order, "fire 2, frost 4"; empty with none. */
const wardWords = (wards: Partial<Record<Element, number>> | undefined): string =>
  ELEMENTS.filter((element) => (wards?.[element] ?? 0) > 0).map((element) => `${element} ${wards![element]}`).join(', ')

/** What one on-hit entry (a rune's) does: "+1 fire", "+3 fire, lays Seared", "heals 1", "+2 blight to the regenerating and the blighted". */
function onHitWords(entry: OnHit): string {
  const parts: string[] = []
  if (entry.damage > 0) parts.push(`+${entry.damage} ${entry.element ?? 'damage'}${entry.bane ? ' to the regenerating and the blighted' : ''}`)
  if (entry.heal) parts.push(`heals ${entry.heal}`)
  if (entry.status) parts.push(`lays ${STATUSES[entry.status.id].name}${entry.onCrit ? ' on a critical' : ''}`)
  return parts.join(', ')
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
  for (const element of ELEMENTS) if (s.wards?.[element]) parts.push(`${element} ward ${s.wards[element]}`)
  if (s.maxHp) parts.push(`hp ${signed(s.maxHp)}`)
  for (const entry of s.onHit ?? []) if (entry.damage > 0) parts.push(`+${entry.damage} ${entry.element ?? 'damage'}`)
  return parts.join(', ')
}

/**
 * What changes from `before` to `after`, a line a stat: "Damage: 1d8+3 → 1d8+2",
 * "Attack: 5 AP, 1 attack a turn → 4 AP, 2 attacks a turn", a stat gained as
 * what it now is and one lost as "no longer ..." (never "none"); a stat both have
 * alike is left out, but for a strength the holder falls short of, which stays as context.
 */
export function compareLines(before: Item, after: Item, ap = TYPICAL_AP, strength?: number): string[] {
  const was = new Map(statWords(before.stats ?? {}, ap, strength))
  const now = new Map(statWords(after.stats ?? {}, ap, strength))
  const labels = [...new Set([...was.keys(), ...now.keys()])]
  // A shortfall is kept as context even where the craft leaves it alone: it is what the holder pays.
  const short = (label: string) => label === 'Strength' && strength !== undefined && strengthShortfall(strength, after.stats ?? {}) > 0
  return labels.filter((label) => was.get(label) !== now.get(label) || short(label)).map((label) => changeLine(label, was.get(label), now.get(label)))
}

/** One stat's change: "Damage: 1d8+3 → 1d8+2"; gained, only what it now is ("On a hit: +1 fire"); lost, "Wards: no longer frost 2". */
function changeLine(label: string, was: string | undefined, now: string | undefined): string {
  if (was === now || was === undefined) return `${label}: ${now}`
  if (now === undefined) return `${label}: no longer ${was}`
  return `${label}: ${was} → ${now}`
}

/** The crafting screen's line on what the field makes: the modifiers that need no workshop, at grade I, a day each. */
export function fieldCraftSummary(): string {
  const names = MODIFIER_IDS.map((id) => MODIFIERS[id]).filter((mod) => mod.unlock === 0).map((mod) => mod.name)
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('')
  return `In the field: ${list} at grade ${gradeNumeral(1)}, a day each.`
}

/**
 * The character panel's warning when the weapon held costs more AP to strike with
 * than a turn gives (armour's AP penalty under a heavy weapon); null when it fits.
 */
export function attackCostWarning(attackApCost: number, actionPoints: number): string | null {
  return attackApCost > actionPoints ? `Attack costs ${attackApCost} AP, you have ${actionPoints}: cannot attack` : null
}

/** The widest a wards row may be, in characters at 14 px: the Character tab's stat column leaves 24, the Inventory tab's 29. */
export const WARDS_ROW_CHARS = 24
export const WARDS_WIDE_ROW_CHARS = 29

/**
 * The stat sheet's wards: a "Wards:" line, then the wards above 0 in element order ("fire 2, frost 4"),
 * packed into indented rows of at most `rowChars`, so that all six elements fit the column. Empty
 * when there are none.
 */
export function wardsLines(wards: Partial<Record<Element, number>> | undefined, rowChars = WARDS_ROW_CHARS): string[] {
  const shown = ELEMENTS.filter((element) => (wards?.[element] ?? 0) > 0).map((element) => `${element} ${wards![element]}`)
  return packedLines('Wards:', shown, rowChars)
}

/**
 * The stat sheet's on-hit line for the main hand (runes): an "On a hit:" line, then what a hit
 * adds in the engine's order (damage, healing, statuses), "+3 fire, lays Seared", packed into
 * indented rows as the wards are. A bane is "(bane)" here, for the column's width. Empty with none.
 */
export function onHitLines(onHit: readonly OnHit[] | undefined, rowChars = WARDS_ROW_CHARS): string[] {
  const entries = onHit ?? []
  const parts = [
    ...entries.filter((e) => e.damage > 0).map((e) => `+${e.damage} ${e.element ?? 'damage'}${e.bane ? ' (bane)' : ''}`),
    ...entries.filter((e) => e.heal).map((e) => `heals ${e.heal}`),
    ...entries.filter((e) => e.status).map((e) => `lays ${STATUSES[e.status!.id].name}${e.onCrit ? ' on crit' : ''}`),
  ]
  return packedLines('On a hit:', parts, rowChars)
}

/** `title`, then `parts` joined by commas into indented rows of at most `rowChars`, a row followed by another ending with a comma; empty with no parts. */
function packedLines(title: string, parts: readonly string[], rowChars: number): string[] {
  if (parts.length === 0) return []
  const rows: string[] = []
  for (const part of parts) {
    const last = rows.length - 1
    // One character is kept for the comma a row ends with when another follows.
    if (last >= 0 && `${rows[last]}, ${part}`.length + 1 <= rowChars) rows[last] += `, ${part}`
    else rows.push(part)
  }
  return [title, ...rows.map((row, i) => `  ${row}${i < rows.length - 1 ? ',' : ''}`)]
}
