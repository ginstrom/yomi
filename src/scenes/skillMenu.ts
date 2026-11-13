import { ABILITIES, ABILITY_IDS, abilityApCost, type AbilityId } from '../combat/abilities.ts'
import type { CombatantStats } from '../combat/combat.ts'
import { ALL_SPELL_IDS, SPELLS, STATUSES, spellApCost, type ActiveStatus, type SpellId } from '../combat/spells.ts'
import { isMelee, type Action, type UnitSnapshot } from '../engine/battleEngine.ts'

/** An active a unit can pick from its Skills list: a spell, or an ability (a hero's technique). */
export type Skill = { kind: 'spell'; id: SpellId } | { kind: 'ability'; id: AbilityId }

/**
 * What the battle screen's Skills list shows, kept free of Phaser so it can be
 * unit tested: a row for each spell the unit knows, in `ALL_SPELL_IDS` order,
 * then each ability it has, in `ABILITY_IDS` order, enabled when the engine
 * lists a use of it now.
 */
export type SkillMenuRow = Skill & {
  /** "Pin  3 mana  6 AP", "Taunt  3 AP": the AP the unit would pay now, for the weapon it holds. */
  label: string
  enabled: boolean
  /** Turns until a recharging ability is ready again; left out when it is ready. */
  readyIn?: number
  /** Why a skill cannot be used: "Needs a melee weapon" for the weapon held, "Once a battle" for a spell already cast; left out otherwise. */
  why?: string
}

type MenuUnit = Pick<UnitSnapshot, 'id' | 'magic' | 'abilities' | 'recharging' | 'attackApCost' | 'attackRange' | 'reach'> & Partial<Pick<UnitSnapshot, 'usedOnce'>>

/** Whether `action` is a use of `skill` by the unit `unit`. */
export function usesSkill(action: Action, unit: string, skill: Skill): boolean {
  if (action.type === 'cast') return skill.kind === 'spell' && action.unit === unit && action.spell === skill.id
  if (action.type === 'ability') return skill.kind === 'ability' && action.unit === unit && action.ability === skill.id
  return false
}

/** The rows of `unit`'s Skills list, given the actions legal for it now. */
export function skillMenuRows(unit: MenuUnit, legal: readonly Action[]): SkillMenuRow[] {
  const known = unit.magic?.spells ?? []
  const spells = ALL_SPELL_IDS.filter((id) => known.includes(id)).map((id): SkillMenuRow => {
    const { name, manaCost, oncePerBattle } = SPELLS[id]
    return {
      kind: 'spell',
      id,
      label: `${name}  ${manaCost} mana  ${spellApCost(unit, id)} AP`,
      enabled: legal.some((action) => usesSkill(action, unit.id, { kind: 'spell', id })),
      ...(oncePerBattle && unit.usedOnce?.includes(id) ? { why: 'Once a battle' } : {}),
    }
  })
  const has = unit.abilities ?? []
  const abilities = ABILITY_IDS.filter((id) => has.includes(id)).map((id): SkillMenuRow => {
    const { name, manaCost, needs } = ABILITIES[id]
    const mana = manaCost ? `  ${manaCost} mana` : ''
    const recharge = unit.recharging[id] ?? 0
    const melee = isMelee(unit)
    const why = needs === 'melee' && !melee ? 'Needs a melee weapon' : needs === 'ranged' && melee ? 'Needs a ranged weapon' : undefined
    return {
      kind: 'ability',
      id,
      label: `${name}${mana}  ${abilityApCost(unit, id)} AP`,
      enabled: legal.some((action) => usesSkill(action, unit.id, { kind: 'ability', id })),
      ...(recharge > 0 ? { readyIn: recharge } : {}),
      ...(why ? { why } : {}),
    }
  })
  return [...spells, ...abilities]
}

/** A skill's name, as the list and the hints give it. */
export function skillName(skill: Skill): string {
  return skill.kind === 'spell' ? SPELLS[skill.id].name : ABILITIES[skill.id].name
}

/** What a skill does, in a sentence, for the hint over its row. */
export function skillDescription(skill: Skill): string {
  return skill.kind === 'spell' ? SPELLS[skill.id].description : ABILITIES[skill.id].description
}

/**
 * The hint while a skill's target is chosen: "Fireball: choose where (10 mana, 6 AP).",
 * "Pin: choose a foe (3 mana, 6 AP).", "Taunt: click Aldric (3 AP).", each ending
 * "Esc or Cancel to go back.". `stats` are the user's, for its name and its costs.
 */
export function targetingHint(skill: Skill, stats: Pick<CombatantStats, 'name' | 'magic' | 'attackApCost'>): string {
  const back = 'Esc or Cancel to go back.'
  if (skill.kind === 'spell') {
    const { name, manaCost, target, range } = SPELLS[skill.id]
    const what =
      target === 'foe'
        ? 'choose a foe'
        : target === 'ally'
          ? 'choose an ally'
          : target === 'fallen'
            ? 'choose a fallen ally'
            : target === 'self' || range === 0
            ? 'click the caster'
            : 'choose where'
    return `${name}: ${what} (${manaCost} mana, ${spellApCost(stats, skill.id)} AP). ${back}`
  }
  const { name, manaCost, selfStatus, area } = ABILITIES[skill.id]
  const what = selfStatus || area?.centredOnSelf ? `click ${stats.name}` : area ? 'choose where' : 'choose a foe'
  const cost = `${manaCost ? `${manaCost} mana, ` : ''}${abilityApCost(stats, skill.id)} AP`
  return `${name}: ${what} (${cost}). ${back}`
}

/** "Blessed 2, Shielded 1": a unit's statuses and the turns each has left, or '' for none. */
export function describeStatuses(statuses: readonly ActiveStatus[]): string {
  return statuses.map(({ id, turnsLeft }) => `${STATUSES[id].name} ${turnsLeft}`).join(', ')
}
