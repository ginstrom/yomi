import type { Element, OnHit } from '../combat/combat.ts'
import { STATUSES, type StatusLaid } from '../combat/spells.ts'
import { gearClass, type Tier } from './catalog.ts'
import type { EquipmentSlot, Item, ItemStats } from './inventory.ts'

/**
 * Runes (docs/designs/long-campaign/stage-04-runes.md): ten kinds at four
 * ranks, each doing one thing in a weapon, another in armour and another in a
 * shield; the sockets an item has for them; and the party's pouch. Plain data
 * and functions only, called by nothing of inventory.ts as it loads, so the
 * two may import each other (as catalog.ts and inventory.ts do).
 */

export const RUNE_IDS = ['ember', 'rime', 'storm', 'venom', 'acid', 'stone', 'wind', 'life', 'mind', 'dawn'] as const
export type RuneId = (typeof RUNE_IDS)[number]
export type Rank = 1 | 2 | 3 | 4
export const RANKS: readonly Rank[] = [1, 2, 3, 4]
export const MAX_RANK: Rank = 4
export type RuneKey = `${RuneId}${Rank}`

/** How a rune acts by where it sits: mainHand a weapon, offHand a shield, every other slot armour. */
export type SlotClass = 'weapon' | 'shield' | 'armour'

export function slotClass(slot: EquipmentSlot): SlotClass {
  if (slot === 'mainHand') return 'weapon'
  if (slot === 'offHand') return 'shield'
  return 'armour'
}

export interface RuneDef {
  id: RuneId
  name: string
  /** The element of its weapon bonus and its ward; none for Stone, Wind, Life, Mind. */
  element?: Element
  effect: Record<SlotClass, (rank: Rank) => ItemStats>
  /** One short line of what it does there at a rank: "+1 fire on a hit", "Frost ward 2". */
  describe: Record<SlotClass, (rank: Rank) => string>
}

/** A number for each rank, 1 to 4. */
type Ladder = readonly [number, number, number, number]
const at = (ladder: Ladder, rank: Rank): number => ladder[rank - 1]

const WARD: Ladder = [2, 4, 6, 9]
const ELEMENT_DAMAGE: Ladder = [1, 2, 3, 5]

type Effect = (rank: Rank) => ItemStats

const ward =
  (element: Element): Effect =>
  (rank) => ({ wards: { [element]: at(WARD, rank) } })
const add =
  (field: 'toHit' | 'armorPierce' | 'resistance' | 'acBonus' | 'critChance' | 'maxHp' | 'spellSkill' | 'maxMana', ladder: Ladder): Effect =>
  (rank) => ({ [field]: at(ladder, rank) })
/** A weapon's on-hit damage of `element`, with `status` from rank `from`. */
const strike =
  (element: Element, ladder: Ladder, status?: { laid: StatusLaid; onCrit?: true; from: Rank }, bane?: true): Effect =>
  (rank) => {
    const entry: OnHit = { damage: at(ladder, rank), element }
    if (bane) entry.bane = true
    if (status && rank >= status.from) {
      entry.status = { ...status.laid }
      if (status.onCrit) entry.onCrit = true
    }
    return { onHit: [entry] }
  }

/** A rune of an element: its own weapon effect, and its ward in armour and in a shield. */
function elemental(id: RuneId, name: string, element: Element, weapon: Effect): RuneDef {
  return rune(id, name, { weapon, armour: ward(element), shield: ward(element) }, element)
}

function rune(id: RuneId, name: string, effect: Record<SlotClass, Effect>, element?: Element): RuneDef {
  const describe = (cls: SlotClass) => (rank: Rank) => describeRuneStats(effect[cls](rank))
  return { id, name, element, effect, describe: { weapon: describe('weapon'), armour: describe('armour'), shield: describe('shield') } }
}

export const RUNES: Record<RuneId, RuneDef> = {
  ember: elemental('ember', 'Ember', 'fire', strike('fire', ELEMENT_DAMAGE, { laid: { id: 'seared', turns: 1 }, from: 3 })),
  rime: elemental('rime', 'Rime', 'frost', strike('frost', ELEMENT_DAMAGE, { laid: { id: 'chilled', turns: 1 }, onCrit: true, from: 3 })),
  storm: elemental('storm', 'Storm', 'lightning', add('toHit', [3, 6, 9, 12])),
  venom: elemental('venom', 'Venom', 'poison', strike('poison', [1, 2, 3, 4], { laid: { id: 'poisoned', turns: 3 }, onCrit: true, from: 2 })),
  acid: elemental('acid', 'Acid', 'acid', add('armorPierce', [1, 1, 2, 3])),
  stone: rune('stone', 'Stone', {
    weapon: (rank) => ({ damage: { count: 0, sides: 0, bonus: at([1, 1, 2, 3], rank) } }),
    armour: add('resistance', [1, 1, 2, 3]),
    shield: add('acBonus', [3, 5, 7, 10]),
  }),
  wind: rune('wind', 'Wind', {
    weapon: add('critChance', [3, 6, 9, 12]),
    armour: add('acBonus', [3, 5, 7, 10]),
    shield: add('acBonus', [2, 4, 6, 8]),
  }),
  life: rune('life', 'Life', {
    weapon: (rank) => ({ onHit: [{ damage: 0, heal: at([1, 1, 2, 3], rank) }] }),
    armour: add('maxHp', [4, 8, 12, 18]),
    shield: add('maxHp', [4, 8, 12, 18]),
  }),
  mind: rune('mind', 'Mind', {
    weapon: add('spellSkill', [3, 6, 9, 12]),
    armour: add('maxMana', [3, 6, 9, 12]),
    shield: add('maxMana', [3, 6, 9, 12]),
  }),
  dawn: elemental('dawn', 'Dawn', 'blight', strike('blight', [2, 3, 5, 7], undefined, true)),
}

/** The words of a rune's stats, for its socket line. */
function describeRuneStats(stats: ItemStats): string {
  const parts: string[] = []
  if (stats.damage) parts.push(`damage +${stats.damage.bonus}`)
  if (stats.toHit) parts.push(`to hit +${stats.toHit}%`)
  if (stats.armorPierce) parts.push(`pierces ${stats.armorPierce} resistance`)
  if (stats.resistance) parts.push(`resistance +${stats.resistance}`)
  if (stats.acBonus) parts.push(`armour class +${stats.acBonus}`)
  if (stats.critChance) parts.push(`critical +${stats.critChance}%`)
  if (stats.maxHp) parts.push(`max HP +${stats.maxHp}`)
  if (stats.spellSkill) parts.push(`spell skill +${stats.spellSkill}%`)
  if (stats.maxMana) parts.push(`mana +${stats.maxMana}`)
  for (const [element, n] of Object.entries(stats.wards ?? {})) parts.push(`${capitalised(element)} ward ${n}`)
  if (stats.onHit?.length) parts.push(`on a hit, ${onHitParts(stats.onHit).join(', ')}`)
  const line = parts.join(', ')
  return line.charAt(0).toUpperCase() + line.slice(1)
}

/**
 * How on-hit effects are told: 'long' wherever there is room (the trading post, crafting, the
 * item tooltip, a rune's own line), 'short' in the character panel's narrow stat column.
 */
export type OnHitForm = 'long' | 'short'

/**
 * What a hit with these on-hit entries (a weapon's runes) adds, as words in the engine's order:
 * every damage, then every heal, then every status: "+3 fire", "heals 1", "lays Seared". A bane
 * and a status laid on a critical only say so, at length or, `short`, as "(bane)" and "on crit".
 * The one phrasing of on-hit effects, which every screen joins or labels as it needs.
 */
export function onHitParts(entries: readonly OnHit[], form: OnHitForm = 'long'): string[] {
  const short = form === 'short'
  return [
    ...entries
      .filter((e) => e.damage > 0)
      .map((e) => `+${e.damage} ${e.element ?? 'damage'}${e.bane ? (short ? ' (bane)' : ' to the regenerating and the blighted') : ''}`),
    ...entries.filter((e) => e.heal).map((e) => `heals ${e.heal}`),
    // STATUSES is read only when words are asked for, never as this module loads.
    ...entries.flatMap((e) => e.status
      ? [`lays ${STATUSES[e.status.id].name}${e.onCrit ? (short ? ' on crit' : ' on a critical') : ''}`]
      : []),
  ]
}

export const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

export const RANK_NAMES: Record<Rank, string> = { 1: 'Lesser ', 2: '', 3: 'Greater ', 4: 'Grand ' }

/** A rank as "I" to "IV", in an item's name. */
export function rankNumeral(rank: Rank): string {
  return ['I', 'II', 'III', 'IV'][rank - 1]
}

export function runeKey(id: RuneId, rank: Rank): RuneKey {
  return `${id}${rank}`
}

const RUNE_KEY = /^([a-z]+)([1-4])$/

export function parseRuneKey(text: string): { id: RuneId; rank: Rank } | null {
  const match = RUNE_KEY.exec(text)
  if (!match || !(RUNE_IDS as readonly string[]).includes(match[1])) return null
  return { id: match[1] as RuneId, rank: Number(match[2]) as Rank }
}

export function isRuneKey(text: string): text is RuneKey {
  return parseRuneKey(text) !== null
}

/** "Lesser Ember Rune", "Storm Rune", "Grand Stone Rune". */
export function runeName(key: RuneKey): string {
  const { id, rank } = parseRuneKey(key)!
  return `${RANK_NAMES[rank]}${RUNES[id].name} Rune`
}

/** "Ember I", as in an item's name. */
export function runeLabel(key: RuneKey): string {
  const { id, rank } = parseRuneKey(key)!
  return `${RUNES[id].name} ${rankNumeral(rank)}`
}

/** What `rune` at `rank` adds to an item of slot class `cls`; folded into a runed item's stats by inventory.ts. */
export function runeStats(rune: RuneId, rank: Rank, cls: SlotClass): ItemStats {
  return RUNES[rune].effect[cls](rank)
}

export const SOCKETS_BY_TIER: Record<Tier, number> = { 1: 0, 2: 1 }
export const MAX_SOCKETS = 3

/**
 * Sockets: by tier (SOCKETS_BY_TIER), +1 at Masterwork, at most MAX_SOCKETS,
 * a small slot (head, gloves, boots) at most 1; an enchanted item its own
 * `sockets`, else 0. A runed item keeps its tier, grade and `sockets`, so
 * this is the same of the item with or without its runes.
 */
export function socketsOf(item: Item): number {
  if (item.tier === undefined) return item.sockets ?? 0
  const sockets = Math.min(MAX_SOCKETS, SOCKETS_BY_TIER[item.tier] + (item.grade === 3 ? 1 : 0))
  return gearClass(item.slot) === 'small' ? Math.min(1, sockets) : sockets
}

/**
 * Where `rune` fits, when `item` is not such a place, so that it would do nothing there; null
 * when it fits. Only two runes are refused, and only in a weapon: Mind in one that does not
 * strike with Magic (correction 7), and Acid in one that would not use its piercing, a ranged
 * weapon other than the crossbow, as a shot pierces only with `rangedPierce`. A shot is what
 * `deriveCombatStats` takes for one (beyond a hex, no reach), written out so that nothing here
 * loads the engine or the character.
 */
export function runeFitsOnly(rune: RuneId, item: Item): string | null {
  if (item.slot !== 'mainHand') return null
  const stats = item.stats ?? {}
  if (rune === 'mind' && stats.skill !== 'magic') return 'a wand or a staff'
  // Shot: it strikes beyond the next hex (a weapon names no range for 1) and has no reach.
  const shot = (stats.attackRange ?? 1) > 1 && !stats.reach
  if (rune === 'acid' && shot && !stats.rangedPierce) return 'a melee weapon or a crossbow'
  return null
}

/** Whether `rune` may sit in `item`: everywhere but where `runeFitsOnly` names somewhere else. */
export function runeFits(rune: RuneId, item: Item): boolean {
  return runeFitsOnly(rune, item) === null
}

/**
 * The tooltip's socket line: "Sockets: 1 of 2 (Ember I)", the runes by name only, as the
 * item's stat lines already fold in what they do; "Sockets: 0 of 2" with none set. Empty
 * for an item with no sockets.
 */
export function socketLines(item: Item): string[] {
  const sockets = socketsOf(item)
  if (sockets === 0) return []
  const runes = item.runes ?? []
  const names = runes.length ? ` (${runes.map(runeLabel).join(', ')})` : ''
  return [`Sockets: ${runes.length} of ${sockets}${names}`]
}

/** The party's rune pouch: a count for each rune key held; a key at 0 is left out. */
export type Pouch = Partial<Record<RuneKey, number>>

export function pouchCount(pouch: Pouch, key: RuneKey): number {
  return pouch[key] ?? 0
}

export function addToPouch(pouch: Pouch, key: RuneKey, n = 1): void {
  const count = pouchCount(pouch, key) + n
  if (count > 0) pouch[key] = count
  else delete pouch[key]
}

/** Takes `n` of `key` from the pouch; false, and nothing taken, if it holds fewer. */
export function takeFromPouch(pouch: Pouch, key: RuneKey, n = 1): boolean {
  if (pouchCount(pouch, key) < n) return false
  addToPouch(pouch, key, -n)
  return true
}

/** The keys held, in RUNE_IDS order then rank. */
export function pouchKeys(pouch: Pouch): RuneKey[] {
  return RUNE_IDS.flatMap((id) => RANKS.map((rank) => runeKey(id, rank))).filter((key) => pouchCount(pouch, key) > 0)
}
