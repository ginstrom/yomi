import { SPELLS, averageRoll, isHealing, type SpellId } from '../combat/spells.ts'
import { manaOf, maxHp, maxMana, type Character } from './character.ts'
import { knownSpells } from './perks.ts'

/**
 * Casting out of battle, on the world map: only healing spells, paid from the
 * mana a caster carried out of its last battle or a day of camping refilled (`manaOf`). A heal restores
 * the average of its dice, rounded down, so the world map rolls no dice and a
 * reload changes nothing; range and area do not apply, and a spell centred on
 * the caster heals the whole party.
 */

/** Whether `spell` is cast on one member (Heal) rather than on the whole party at once (Heal All). */
export function healsOne(spell: SpellId): boolean {
  return SPELLS[spell].target === 'ally'
}

/** The healing spells the character knows, in `SPELL_IDS` order, with whether it has the mana for each now. */
export function worldSpells(caster: Character): Array<{ spell: SpellId; affordable: boolean }> {
  return knownSpells(caster)
    .filter(isHealing)
    .map((spell) => ({ spell, affordable: manaOf(caster) >= SPELLS[spell].manaCost }))
}

/** What `spell` restores to each member it touches out of battle. */
export function worldHealing(spell: SpellId): number {
  const { heal } = SPELLS[spell]
  return heal ? averageRoll(heal) : 0
}

/**
 * Casts a healing spell out of battle: pays its mana and restores
 * `worldHealing` to `target`, or to every member of `party` standing or not
 * for a spell centred on the caster, never above a member's maximum. Returns
 * false, changing nothing, if the caster does not know it, has not the mana,
 * or a one-member spell has no target.
 */
export function castOnWorldMap(caster: Character, spell: SpellId, party: readonly Character[], target?: Character): boolean {
  if (!worldSpells(caster).some((known) => known.spell === spell && known.affordable)) return false
  const touched = healsOne(spell) ? (target ? [target] : []) : party
  if (touched.length === 0) return false
  caster.mana = Math.min(caster.mana, maxMana(caster)) - SPELLS[spell].manaCost
  for (const member of touched) member.hp = Math.min(maxHp(member), member.hp + worldHealing(spell))
  return true
}
