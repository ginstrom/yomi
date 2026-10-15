import { SPELLS, STATUSES, type ActiveStatus, type SpellId } from '../combat/spells.ts'
import type { Action, UnitSnapshot } from '../engine/battleEngine.ts'

/**
 * What the battle screen's spell list shows, kept free of Phaser so it can be
 * unit tested: a row for each spell the unit knows, in `SPELL_IDS` order,
 * enabled when the engine lists a cast of it now.
 */
export interface SpellMenuRow {
  spell: SpellId
  /** "Fireball  10 mana  6 AP" */
  label: string
  enabled: boolean
}

/** The rows of `unit`'s spell list, given the actions legal for it now. */
export function spellMenuRows(unit: Pick<UnitSnapshot, 'id' | 'magic'>, legal: readonly Action[]): SpellMenuRow[] {
  return (unit.magic?.spells ?? []).map((spell) => {
    const { name, manaCost, apCost } = SPELLS[spell]
    return {
      spell,
      label: `${name}  ${manaCost} mana  ${apCost} AP`,
      enabled: legal.some((action) => action.type === 'cast' && action.unit === unit.id && action.spell === spell),
    }
  })
}

/** The hint while a spell's target is chosen: "Fireball: choose where (10 mana, 6 AP). Esc or Cancel to go back." */
export function targetingHint(spell: SpellId): string {
  const { name, manaCost, apCost, target, range } = SPELLS[spell]
  const what =
    target === 'foe'
      ? 'choose a foe'
      : target === 'ally'
        ? 'choose an ally'
        : target === 'self' || range === 0
          ? 'click the caster'
          : 'choose where'
  return `${name}: ${what} (${manaCost} mana, ${apCost} AP). Esc or Cancel to go back.`
}

/** "Blessed 2, Shielded 1": a unit's statuses and the turns each has left, or '' for none. */
export function describeStatuses(statuses: readonly ActiveStatus[]): string {
  return statuses.map(({ id, turnsLeft }) => `${STATUSES[id].name} ${turnsLeft}`).join(', ')
}
