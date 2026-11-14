import { deriveCombatStats, type Character } from '../character/character.ts'
import { knownAbilities, knownSpells, nodeKind, perkTeaching, type NodeKind } from '../character/perks.ts'
import { ABILITIES, abilityApCost, type AbilityId } from '../combat/abilities.ts'
import { formatDamage, type CombatantStats } from '../combat/combat.ts'
import { SPELLS, spellApCost, spellPower, type HeroSpellId } from '../combat/spells.ts'

/** One line of the Abilities tab: an active the hero knows, a spell or a technique. */
export interface AbilityRow {
  /** The spell this row is, for the world map's Cast button; null for a technique. */
  spell: HeroSpellId | null
  /** The technique this row is; null for a spell. */
  ability: AbilityId | null
  name: string
  /** What kind of node taught it. */
  kind: NodeKind
  /** Action points, with the hero's discounts, a technique's for the weapon held. */
  ap: number
  /** Mana, or null for an at-will active. */
  mana: number | null
  /** Turns between uses, or null for an active with none. */
  recharge: number | null
  /** What it does, a spell's dice with the caster's power added. */
  description: string
}

/**
 * The actives `character` knows: its spells in `knownSpells` order, then its
 * techniques in `ABILITY_IDS` order.
 */
export function abilityRows(character: Character): AbilityRow[] {
  const stats = deriveCombatStats(character)
  const spells = knownSpells(character).map((spell): AbilityRow => {
    const teacher = perkTeaching(spell)
    return {
      spell,
      ability: null,
      name: SPELLS[spell].name,
      kind: teacher ? nodeKind(teacher) : 'spell',
      ap: spellApCost(stats, spell),
      mana: SPELLS[spell].manaCost,
      recharge: null,
      description: shownDescription(spell, stats.magic?.power),
    }
  })
  const techniques = knownAbilities(character).map((ability): AbilityRow => {
    const { name, manaCost, recharge, description } = ABILITIES[ability]
    return {
      spell: null,
      ability,
      name,
      kind: manaCost ? 'mana' : 'at-will',
      ap: abilityApCost(stats, ability),
      mana: manaCost ?? null,
      recharge: recharge > 0 ? recharge : null,
      description,
    }
  })
  return [...spells, ...techniques]
}

/**
 * `spell`'s description with its first dice raised by the power a caster
 * adds to it ("1d10+2 to a foe within 5 hexes" with Destruction): the engine
 * adds power once to each damaging outcome, so only the spell's own dice.
 */
export function shownDescription(spell: HeroSpellId, power: NonNullable<CombatantStats['magic']>['power']): string {
  const { description, damage } = SPELLS[spell]
  const added = spellPower({ magic: { maxMana: 0, skill: 0, spells: [], ...(power ? { power } : {}) } }, spell)
  if (!damage || added === 0) return description
  return description.replace(formatDamage(damage), formatDamage({ ...damage, bonus: damage.bonus + added }))
}

/**
 * The Abilities tab's rows, in the panel's own pixels: two columns of
 * `ABILITY_ROWS_PER_COLUMN`, a page at a time. A row is its name (and a
 * heal's Cast button), a line of its kind and costs, and a description cut
 * to `ABILITY_DESCRIPTION_LINES`; each line's height is fixed, so no row can
 * reach into the next.
 */
export const ABILITY_LIST = {
  x: 24,
  y: 108,
  columnGap: 24,
  /** From a row's top: where its cost line and description begin. */
  costY: 16,
  descriptionY: 30,
  /** The description's line height at its 10px type. */
  descriptionLineH: 12,
  rowH: 56,
  /** Where the footer's text begins; the rows end above it. */
  footerTop: 448,
} as const

export const ABILITY_DESCRIPTION_LINES = 2
export const ABILITY_COLUMNS = 2
export const ABILITY_ROWS_PER_COLUMN = 6
export const ABILITY_ROWS_PER_PAGE = ABILITY_COLUMNS * ABILITY_ROWS_PER_COLUMN

/** Where the `index`th row goes: its page, its column and its row in the column. */
export function abilityRowPlace(index: number): { page: number; column: number; row: number } {
  const page = Math.floor(index / ABILITY_ROWS_PER_PAGE)
  const onPage = index % ABILITY_ROWS_PER_PAGE
  return { page, column: Math.floor(onPage / ABILITY_ROWS_PER_COLUMN), row: onPage % ABILITY_ROWS_PER_COLUMN }
}

/** How many pages `count` rows take, at least one. */
export function abilityPages(count: number): number {
  return Math.max(1, Math.ceil(count / ABILITY_ROWS_PER_PAGE))
}

/** The `index`th row's box on its page, its last description line included, for a panel `panelWidth` wide. */
export function abilityRowRect(index: number, panelWidth: number): { x: number; y: number; width: number; height: number } {
  const { column, row } = abilityRowPlace(index)
  const width = (panelWidth - 2 * ABILITY_LIST.x - ABILITY_LIST.columnGap) / ABILITY_COLUMNS
  return {
    x: ABILITY_LIST.x + column * (width + ABILITY_LIST.columnGap),
    y: ABILITY_LIST.y + row * ABILITY_LIST.rowH,
    width,
    height: ABILITY_LIST.descriptionY + ABILITY_DESCRIPTION_LINES * ABILITY_LIST.descriptionLineH,
  }
}

/** "spell, 3 mana, 4 AP" or "at-will, 7 AP, recharge 2": a row's second line. */
export function abilityCostLine({ kind, mana, ap, recharge }: Pick<AbilityRow, 'kind' | 'mana' | 'ap' | 'recharge'>): string {
  return [kind, mana === null ? null : `${mana} mana`, `${ap} AP`, recharge === null ? null : `recharge ${recharge}`].filter(Boolean).join(', ')
}
