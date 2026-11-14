import { ABILITIES, ABILITY_IDS, abilityApCost, type AbilityId } from '../combat/abilities.ts'
import type { CombatantStats } from '../combat/combat.ts'
import { ALL_SPELL_IDS, SPELLS, STATUSES, spellApCost, spellRange, type ActiveStatus, type SpellId } from '../combat/spells.ts'
import { isMelee, type Action, type UnitSnapshot } from '../engine/battleEngine.ts'
import { hexDistance } from '../grid/hex.ts'

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
  /**
   * Why a greyed skill cannot be used now, the first that holds of: "Needs a
   * melee weapon" (or ranged), "Once a battle", "Recharging (ready in N)",
   * "Needs N mana", "Needs N AP", "No foe in range" (or "No target in range"
   * for an ally's spell), else "Not now"; left out for an enabled one.
   */
  why?: string
}

type MenuUnit = Pick<UnitSnapshot, 'id' | 'magic' | 'abilities' | 'recharging' | 'attackApCost' | 'attackRange' | 'reach'> &
  Partial<Pick<UnitSnapshot, 'usedOnce' | 'ap' | 'mana' | 'side' | 'position'>>

/** Whether `action` is a use of `skill` by the unit `unit`. */
export function usesSkill(action: Action, unit: string, skill: Skill): boolean {
  if (action.type === 'cast') return skill.kind === 'spell' && action.unit === unit && action.spell === skill.id
  if (action.type === 'ability') return skill.kind === 'ability' && action.unit === unit && action.ability === skill.id
  return false
}

/**
 * The rows of `unit`'s Skills list, given the actions legal for it now and,
 * to tell a target out of range, every unit of the battle.
 */
export function skillMenuRows(unit: MenuUnit, legal: readonly Action[], units: readonly UnitSnapshot[] = []): SkillMenuRow[] {
  const known = unit.magic?.spells ?? []
  const spells = ALL_SPELL_IDS.filter((id) => known.includes(id)).map((id): SkillMenuRow => {
    const { name, manaCost, oncePerBattle } = SPELLS[id]
    const enabled = legal.some((action) => usesSkill(action, unit.id, { kind: 'spell', id }))
    const ap = spellApCost(unit, id)
    const why =
      (oncePerBattle && unit.usedOnce?.includes(id) ? 'Once a battle' : undefined) ?? costReason(unit, manaCost, ap) ?? spellTargetReason(unit, id, units)
    return {
      kind: 'spell',
      id,
      label: `${name}  ${manaCost} mana  ${ap} AP`,
      enabled,
      ...(enabled ? {} : { why: why ?? 'Not now' }),
    }
  })
  const has = unit.abilities ?? []
  const abilities = ABILITY_IDS.filter((id) => has.includes(id)).map((id): SkillMenuRow => {
    const { name, manaCost, needs } = ABILITIES[id]
    const mana = manaCost ? `  ${manaCost} mana` : ''
    const recharge = unit.recharging[id] ?? 0
    const melee = isMelee(unit)
    const ap = abilityApCost(unit, id)
    const enabled = legal.some((action) => usesSkill(action, unit.id, { kind: 'ability', id }))
    const weapon = needs === 'melee' && !melee ? 'Needs a melee weapon' : needs === 'ranged' && melee ? 'Needs a ranged weapon' : undefined
    const why =
      weapon ??
      (recharge > 0 ? `Recharging (ready in ${recharge})` : undefined) ??
      costReason(unit, manaCost ?? 0, ap) ??
      abilityTargetReason(unit, id, units)
    return {
      kind: 'ability',
      id,
      label: `${name}${mana}  ${ap} AP`,
      enabled,
      ...(recharge > 0 ? { readyIn: recharge } : {}),
      ...(enabled ? {} : { why: why ?? 'Not now' }),
    }
  })
  return [...spells, ...abilities]
}

/** "Needs 10 mana" or "Needs 6 AP" when the unit has less left than it costs; undefined when it has both, or they are not known. */
function costReason(unit: MenuUnit, mana: number, ap: number): string | undefined {
  if (mana > 0 && unit.mana !== undefined && unit.mana < mana) return `Needs ${mana} mana`
  if (unit.ap !== undefined && unit.ap < ap) return `Needs ${ap} AP`
  return undefined
}

/** Whether a standing foe of `unit` stands within `reach` hexes of it. */
function foeWithin(unit: MenuUnit, units: readonly UnitSnapshot[], reach: number): boolean {
  const { side, position } = unit
  if (!side || !position) return true
  return units.some((other) => other.side !== side && other.hp > 0 && hexDistance(position, other.position) <= reach)
}

/** "No foe in range" or "No target in range" when nothing `spell` could be aimed at is within its reach, the area's radius included. */
function spellTargetReason(unit: MenuUnit, spell: SpellId, units: readonly UnitSnapshot[]): string | undefined {
  if (units.length === 0 || !unit.position || !unit.side) return undefined
  const { target, hostile, radius, shape } = SPELLS[spell]
  const range = spellRange(unit, spell)
  if (target === 'foe') return foeWithin(unit, units, range) ? undefined : 'No foe in range'
  if (target === 'area' && hostile) {
    const reach = range + (shape === 'cone' || shape === 'line' ? 0 : (radius ?? 0))
    return foeWithin(unit, units, reach) ? undefined : 'No foe in range'
  }
  if (target === 'fallen') {
    const { side, position } = unit
    const fallen = units.some(
      (other) =>
        other.side === side &&
        other.hp === 0 &&
        other.fallenThisBattle &&
        hexDistance(position, other.position) <= range &&
        !units.some((standing) => standing.hp > 0 && standing.position.q === other.position.q && standing.position.r === other.position.r),
    )
    return fallen ? undefined : 'No target in range'
  }
  return undefined
}

/** "No foe in range" when no foe stands where `ability` could strike, mark or touch. */
function abilityTargetReason(unit: MenuUnit, ability: AbilityId, units: readonly UnitSnapshot[]): string | undefined {
  if (units.length === 0) return undefined
  const { strikes, foeStatus, area } = ABILITIES[ability]
  let reach: number | null = null
  if (strikes) reach = unit.attackRange
  else if (foeStatus) reach = foeStatus.range === 'weapon' ? unit.attackRange : foeStatus.range
  else if (area) {
    const range = area.weaponRange ? unit.attackRange : area.range
    reach = range + (area.shape === 'cone' || area.shape === 'line' ? 0 : (area.radius ?? 0))
  }
  return reach === null || foeWithin(unit, units, reach) ? undefined : 'No foe in range'
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
