import { ATTRIBUTES, ATTRIBUTE_IDS } from '../character/attributes.ts'
import { STARTING_KIT, deriveCombatStats } from '../character/character.ts'
import { draftCharacter, type CharacterDraft } from '../character/creation.ts'
import { PERKS } from '../character/perks.ts'
import { SKILLS, skillLevel } from '../character/skills.ts'

/**
 * What a draft comes to, in the few lines a hover shows of it: its skill, the
 * numbers it fights with, what it was born with, what it holds and its perks.
 * The numbers are those of the character the draft makes, so they are the game's own.
 */
export function draftInfo(draft: CharacterDraft): string[] {
  const character = draftCharacter(draft)
  const stats = deriveCombatStats(character)
  const kit = STARTING_KIT[draft.tagged ?? 'melee']
  // A perk taken twice is listed once, with its ranks.
  const perks = [...new Set(draft.perks)].map((perk) => {
    const ranks = draft.perks.filter((taken) => taken === perk).length
    return ranks > 1 ? `${PERKS[perk].name} x${ranks}` : PERKS[perk].name
  })
  return [
    draft.tagged ? `${SKILLS[draft.tagged].name} ${skillLevel(character, draft.tagged)}%` : 'No tagged skill',
    `HP ${stats.maxHp}  AP ${stats.actionPoints}  AC ${stats.ac}  Mana ${stats.magic ? stats.magic.maxMana : '-'}`,
    ATTRIBUTE_IDS.map((id) => `${ATTRIBUTES[id].name.slice(0, 3).toUpperCase()} ${draft.attributes[id]}`).join('  '),
    `Holds: ${[kit.mainHand.name, ...(kit.offHand ? [kit.offHand.name] : [])].join(', ')}`,
    `Perks: ${perks.length > 0 ? perks.join(', ') : 'none'}`,
  ]
}
