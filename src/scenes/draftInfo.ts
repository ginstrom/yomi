import { ATTRIBUTES, ATTRIBUTE_IDS } from '../character/attributes.ts'
import { STARTING_KIT, deriveCombatStats } from '../character/character.ts'
import { draftCharacter, type CharacterDraft } from '../character/creation.ts'
import { PERKS, nodeKind } from '../character/perks.ts'
import { SKILLS, SKILL_IDS, skillLevel } from '../character/skills.ts'

/** The skills a draft has chosen, as "Melee Weapons 39%  Archery 34%": its tagged skill first, then any it placed points in. */
export function draftSkills(draft: CharacterDraft): string {
  const character = draftCharacter(draft)
  const chosen = SKILL_IDS.filter((id) => id !== draft.tagged && draft.raises[id] > 0)
  const skills = [...(draft.tagged ? [draft.tagged] : []), ...chosen]
  if (skills.length === 0) return 'No tagged skill'
  return skills.map((id) => `${SKILLS[id].name} ${skillLevel(character, id)}%`).join('  ')
}

/**
 * What a draft comes to, in the few lines a hover shows of it: its skills, the
 * numbers it fights with, what it was born with, what it holds, its perks
 * and, for a caster, its spells.
 * The numbers are those of the character the draft makes, so they are the game's own.
 */
export function draftInfo(draft: CharacterDraft): string[] {
  const character = draftCharacter(draft)
  const stats = deriveCombatStats(character)
  const kit = STARTING_KIT[draft.tagged ?? 'melee']
  // A node chosen twice (which `pruneDraft` would refuse) is listed once.
  const chosen = [...new Set(draft.perks)]
  const perks = chosen.filter((perk) => nodeKind(perk) !== 'spell').map((perk) => PERKS[perk].name)
  const spells = chosen.filter((perk) => nodeKind(perk) === 'spell').map((perk) => PERKS[perk].name)
  return [
    draftSkills(draft),
    `HP ${stats.maxHp}  AP ${stats.actionPoints}  AC ${stats.ac}  Mana ${stats.magic ? stats.magic.maxMana : '-'}`,
    ATTRIBUTE_IDS.map((id) => `${ATTRIBUTES[id].name.slice(0, 3).toUpperCase()} ${draft.attributes[id]}`).join('  '),
    `Holds: ${[kit.mainHand.name, ...(kit.offHand ? [kit.offHand.name] : [])].join(', ')}`,
    `Perks: ${perks.length > 0 ? perks.join(', ') : 'none'}`,
    ...(spells.length > 0 ? [`Spells: ${spells.join(', ')}`] : []),
  ]
}
